// Suivi des erreurs : envoi à Sentry si SENTRY_DSN est défini (API « store », sans SDK), toujours dans les logs.
const DSN = process.env.SENTRY_DSN ? new URL(process.env.SENTRY_DSN) : null;
const ENDPOINT = DSN && `${DSN.protocol}//${DSN.host}/api/${DSN.pathname.replace(/\//g, "")}/store/`;

export function reportError(err, { url, source = "serveur", extra } = {}) {
  console.error(`[${source}]`, err?.stack || err);
  if (!DSN) return;
  const message = String(err?.message || err).slice(0, 500);
  fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Sentry-Auth": `Sentry sentry_version=7, sentry_key=${DSN.username}, sentry_client=mafeliza/1.0`,
    },
    body: JSON.stringify({
      event_id: crypto.randomUUID().replace(/-/g, ""),
      timestamp: new Date().toISOString(),
      platform: source === "navigateur" ? "javascript" : "node",
      level: "error",
      environment: process.env.VERCEL_ENV || "local",
      tags: { source },
      request: url ? { url } : undefined,
      exception: { values: [{ type: err?.name || "Error", value: message, stacktrace: undefined }] },
      extra: { stack: String(err?.stack || "").slice(0, 4000), ...extra },
    }),
  }).catch(() => {});
}
