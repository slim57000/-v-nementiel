#!/usr/bin/env python3
"""Signature de distribution sans Mac ni « cloud signing » : via l'API App Store Connect,
crée un certificat de distribution temporaire + un profil App Store, les installe sur le Mac de
GitHub (trousseau temporaire), puis les supprime après l'envoi (commande « cleanup »)."""
import base64, json, os, subprocess, sys, time, urllib.request, urllib.error, uuid
import jwt  # PyJWT

KEY_ID, ISSUER, BUNDLE = os.environ["KEY_ID"], os.environ["ISSUER_ID"], os.environ["IOS_BUNDLE_ID"]
KEY = open(os.environ["KEY_PATH"]).read()
TMP = os.environ.get("RUNNER_TEMP", "/tmp")
STATE = f"{TMP}/asc_state.json"

def api(method, path, body=None, allow=()):
    token = jwt.encode({"iss": ISSUER, "iat": int(time.time()), "exp": int(time.time()) + 900, "aud": "appstoreconnect-v1"},
                       KEY, algorithm="ES256", headers={"kid": KEY_ID, "typ": "JWT"})
    req = urllib.request.Request(f"https://api.appstoreconnect.apple.com/v1{path}", method=method,
                                 data=json.dumps(body).encode() if body else None,
                                 headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req) as r:
            raw = r.read()
            return json.loads(raw) if raw else {}
    except urllib.error.HTTPError as e:
        if e.code in allow:
            return {"error": e.code}
        sys.exit(f"API Apple {method} {path} : {e.code} {e.read().decode()[:800]}")

def run(*cmd):
    subprocess.run(cmd, check=True)

def setup():
    # 1. Clé + demande de certificat, puis certificat de distribution
    run("openssl", "genrsa", "-out", f"{TMP}/dist.key", "2048")
    run("openssl", "req", "-new", "-key", f"{TMP}/dist.key", "-out", f"{TMP}/dist.csr", "-subj", "/CN=MaFeliza CI/O=MaFeliza/C=FR")
    csr = open(f"{TMP}/dist.csr").read()
    body = {"data": {"type": "certificates", "attributes": {"certificateType": "DISTRIBUTION", "csrContent": csr}}}
    cert = api("POST", "/certificates", body, allow=(409,))
    if cert.get("error") == 409:
        # Limite Apple atteinte : l'ancien certificat de distribution (inutilisable ici, sans sa clé privée)
        # est révoqué. Les apps déjà publiées ne sont pas affectées.
        for t in ("DISTRIBUTION", "IOS_DISTRIBUTION"):
            for old in api("GET", f"/certificates?filter[certificateType]={t}&limit=50")["data"]:
                print(f"Révocation de l'ancien certificat : {old['attributes'].get('name')} ({old['id']})")
                api("DELETE", f"/certificates/{old['id']}")
        cert = api("POST", "/certificates", body)
    cert = cert["data"]
    open(f"{TMP}/dist.cer", "wb").write(base64.b64decode(cert["attributes"]["certificateContent"]))
    # 2. Identifiant de l'app (créé s'il n'existe pas encore)
    found = api("GET", f"/bundleIds?filter[identifier]={BUNDLE}&filter[platform]=IOS")["data"]
    bundle = next((b for b in found if b["attributes"]["identifier"] == BUNDLE), None)
    if not bundle:
        bundle = api("POST", "/bundleIds", {"data": {"type": "bundleIds", "attributes": {"identifier": BUNDLE, "name": "MaFeliza", "platform": "IOS"}}})["data"]
    # 3. Profil App Store lié à ce certificat
    name = f"MaFeliza CI {uuid.uuid4().hex[:8]}"
    prof = api("POST", "/profiles", {"data": {"type": "profiles", "attributes": {"name": name, "profileType": "IOS_APP_STORE"},
        "relationships": {"bundleId": {"data": {"type": "bundleIds", "id": bundle["id"]}},
                          "certificates": {"data": [{"type": "certificates", "id": cert["id"]}]}}}})["data"]
    pdir = os.path.expanduser("~/Library/MobileDevice/Provisioning Profiles")
    os.makedirs(pdir, exist_ok=True)
    open(f"{pdir}/{prof['attributes']['uuid']}.mobileprovision", "wb").write(base64.b64decode(prof["attributes"]["profileContent"]))
    # 4. Trousseau temporaire avec la clé + le certificat
    run("openssl", "x509", "-inform", "DER", "-in", f"{TMP}/dist.cer", "-out", f"{TMP}/dist.pem")
    run("openssl", "pkcs12", "-export", "-legacy", "-inkey", f"{TMP}/dist.key", "-in", f"{TMP}/dist.pem", "-out", f"{TMP}/dist.p12", "-passout", "pass:ci")
    kc = f"{TMP}/ci.keychain-db"
    run("security", "create-keychain", "-p", "ci", kc)
    run("security", "set-keychain-settings", "-lut", "21600", kc)
    run("security", "unlock-keychain", "-p", "ci", kc)
    run("security", "import", f"{TMP}/dist.p12", "-k", kc, "-P", "ci", "-T", "/usr/bin/codesign", "-T", "/usr/bin/security")
    run("security", "set-key-partition-list", "-S", "apple-tool:,apple:,codesign:", "-s", "-k", "ci", kc)
    existing = subprocess.run(["security", "list-keychains", "-d", "user"], capture_output=True, text=True).stdout.split()
    run("security", "list-keychains", "-d", "user", "-s", kc, *[k.strip('"') for k in existing])
    # 5. Options d'export (signature manuelle avec ce profil) et état pour le nettoyage
    open(f"{TMP}/ExportOptions.plist", "w").write(f"""<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>method</key><string>app-store-connect</string>
  <key>destination</key><string>upload</string>
  <key>teamID</key><string>{os.environ["APPLE_TEAM_ID"]}</string>
  <key>signingStyle</key><string>manual</string>
  <key>signingCertificate</key><string>Apple Distribution</string>
  <key>provisioningProfiles</key><dict><key>{BUNDLE}</key><string>{name}</string></dict>
  <key>uploadSymbols</key><true/>
</dict></plist>""")
    json.dump({"cert": cert["id"], "profile": prof["id"]}, open(STATE, "w"))
    print(f"Certificat et profil « {name} » prêts.")

def cleanup():
    if not os.path.exists(STATE):
        return
    st = json.load(open(STATE))
    api("DELETE", f"/profiles/{st['profile']}")
    api("DELETE", f"/certificates/{st['cert']}")  # n'affecte pas les builds déjà envoyés
    print("Certificat et profil temporaires supprimés.")

{"setup": setup, "cleanup": cleanup}[sys.argv[1]]()
