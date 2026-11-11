// Test de bout en bout (navigateur) : inscription → événement → invités → live → livre d'or → film → mur → suppression.
// Usage : node test/e2e-az.mjs <dossier-captures> [https://mafeliza.com]   (crée puis supprime un compte et un événement de test)
import { chromium } from "playwright";
const B=process.argv[3]||'http://localhost:3000', S=process.argv[2]||'.', IMG=new URL('../public/img/demo/', import.meta.url).pathname;
const b = await chromium.launch({ args:['--autoplay-policy=no-user-gesture-required'], ...(B.startsWith('https') && { proxy:{ server: process.env.HTTPS_PROXY } }) });
const R = []; const ok = (step, cond, info='') => { R.push(`${cond ? '✅' : '❌'} ${step}${info ? ' — '+info : ''}`); };
const errs = [];
const mk = async (w) => { const c = await b.newContext({ locale:'fr-FR', viewport:{width:390,height:844} }); await c.addInitScript(()=>{try{localStorage.setItem('em-consent','refused')}catch{}});
  const p = await c.newPage(); p.setDefaultTimeout(8000); globalThis.__last = p; p.on('pageerror',e=>errs.push(`${w}: ${e.message}`)); p.on('response', r=>{ if(r.status()>=500) errs.push(`${w} HTTP ${r.status()} ${r.url().replace(B,'')}`); }); return p; };
const closeDialogs = (p) => p.evaluate(() => document.querySelectorAll('[role=dialog]:not(.hidden):not(#gb-sheet):not(#name-sheet)').forEach(e => { if (!e.id?.startsWith('gb')) e.remove(); }));
try {
// 1. Inscription
const o = await mk('orga'); const email = `test-az-${Date.now()}@mafeliza.com`;
await o.goto(B+'/connexion'); await o.fill('#email', email); await o.fill('#password', 'TestClaude123!'); await o.locator('#login button.btn-block').first().click(); await o.waitForTimeout(2500);
ok('Inscription : pas de fenêtres empilées', (await o.locator('#guide').count()) === 0 || (await o.locator('#age-sheet').count()) === 0);
if (await o.locator('input[type=date]').count()) { await o.fill('input[type=date]', '1990-05-12'); await o.click('button:has-text("Confirmer")'); await o.waitForTimeout(800); await o.click('button:has-text("Oui")').catch(()=>{}); await o.waitForTimeout(1200); }
await o.waitForTimeout(1500); ok('Guide de bienvenue affiché après la date de naissance', (await o.locator('#guide').count()) === 1);
const me = await (await o.request.get(B+'/api/auth/me')).json(); ok('Inscription', !!me.id, me.email);
// 2. Création de l'événement (formulaire)
await o.goto(B+'/edit'); await o.waitForTimeout(1500); await closeDialogs(o);
await o.check('input[name=type][value=mariage]').catch(()=>{});
await o.fill('#name', 'Mariage Test A-Z'); await o.fill('#date', new Date().toISOString().slice(0,10)); await o.fill('#time', '15:00'); await o.fill('#location', 'Salle des fêtes, Lyon');
await o.click('label:has(input[name=visibility][value=unlisted])');
await o.setInputFiles('#cover', IMG+'mariage-2.jpg').catch(()=>{}); await o.waitForTimeout(800);
await o.click('#save'); await o.waitForURL(/faire-part|dashboard/, { timeout: 15000 }).catch(()=>{}); await o.waitForTimeout(2000);
const evs = await (await o.request.get(B+'/api/events')).json(); const ev = evs[0];
ok('Création de l\'événement', !!ev?.slug, ev ? `${ev.name} (${ev.visibility})${ev.cover ? ', couverture ✔' : ', sans couverture'}` : (await o.locator('#error').innerText().catch(()=>'')));
ok('Page faire-part après création', /faire-part/.test(o.url()));
// 3. Tableau de bord
await o.goto(B+'/dashboard'); await o.waitForTimeout(2500); await closeDialogs(o);
ok('Tableau de bord : carte raccourcis', await o.locator('#my-quick').count() > 0);
ok('Tableau de bord : Photos des invités / Mur photo / Livre d\'or', await o.locator('.tool-row').count() >= 2 && await o.locator(`a[href="/e/${ev.slug}#livre-dor"]`).count() > 0);
// 4. Invité : ouverture du lien
const g = await mk('invité'); await g.goto(B+'/e/'+ev.slug); await g.waitForTimeout(2500);
ok('Invité : enveloppe d\'invitation', await g.locator('#env').count() === 1);
await g.click('#env').catch(()=>{}); await g.waitForTimeout(2500);
ok('Invité : enveloppe ouverte', await g.locator('#env').count() === 0);
ok('Invité : affiche d\'accueil', await g.locator('#ev-hero').count() > 0);
// RSVP
await g.click('[data-hero="rsvp"]').catch(()=>{}); await g.waitForTimeout(800); await g.click('[data-rsvp="yes"]'); await g.waitForTimeout(800);
if (await g.locator('#name-sheet').count()) { await g.fill('#name-sheet input', 'Tata Marie'); await g.click('#name-sheet button'); await g.waitForTimeout(1500); }
const rs = await (await o.request.get(B+`/api/events/${ev.id}/rsvp`).catch(()=>null))?.json?.().catch(()=>null);
ok('Invité : réponse « Je viens »', (await g.locator('[data-rsvp="yes"].active, [data-rsvp="yes"].on, [data-rsvp="yes"][aria-pressed="true"]').count()) > 0 || JSON.stringify(rs||'').includes('Tata'), rs ? JSON.stringify(rs).slice(0,60) : '');
// Livre d'or (texte + photo)
await g.click('#gb-open'); await g.waitForTimeout(500); await g.fill('#gb-text', 'Félicitations aux mariés ! 💛'); await g.setInputFiles('#gb-photo', IMG+'alliances.jpg'); await g.waitForTimeout(1000);
await g.click('#gb-form button.btn-block:not(#gb-cancel)'); await g.waitForTimeout(500);
if (await g.locator('#name-sheet').count()) { await g.fill('#name-sheet input', 'Tata Marie'); await g.click('#name-sheet button'); }
await g.waitForTimeout(2500);
ok('Invité : message + photo dans le livre d\'or', await g.locator('#gb-list .gb-entry').count() === 1, (await g.locator('#gb-error').innerText().catch(()=>'')) || '');
// Live : chat, réaction, photo
await g.goto(B+'/live?e='+ev.slug); await g.waitForTimeout(2500);
await g.fill('#chat-text', 'On vous regarde ❤️'); await g.click('#chat button[aria-label="Envoyer"], #chat button:last-child'); await g.waitForTimeout(1500);
ok('Invité : message dans le chat du live', (await g.locator('.chat-msg').count()) > 0);
await g.locator('[data-react], .react-btn, .live-reacts button').first().click().catch(()=>{}); await g.waitForTimeout(500);
const [fc] = await Promise.all([g.waitForEvent('filechooser', { timeout: 5000 }).catch(()=>null), g.click('#add-photo')]);
if (fc) { await fc.setFiles(IMG+'live-mariage.jpg'); await g.waitForTimeout(3000); }
const photos = await (await g.request.get(B+`/api/public/${ev.slug}/photos`)).json();
ok('Invité : photo ajoutée depuis le live', photos.length === 1, `${photos.length} photo(s)`);
ok('Live : photos des invités affichées', (await g.locator('#photo-strip img, #photo-strip .vid').count()) >= 1);
// 5. Organisateur : livre d'or, film, mur, album, stats
await o.goto(B+'/e/'+ev.slug+'#livre-dor'); await o.waitForTimeout(3000);
ok('Organisateur : voit le livre d\'or', await o.locator('#gb-list .gb-entry').count() === 1);
ok('Organisateur : carte film souvenir', await o.locator('.film-card').count() === 1);
await o.goto(B+'/e/'+ev.slug+'?film=1'); await o.waitForTimeout(2500); await o.click('.film-start').catch(()=>{}); await o.waitForTimeout(5000);
ok('Film souvenir : se lance et défile', (await o.locator('#film .film-bars b[style*="100%"]').count()) >= 1);
await o.goto(B+'/mur?id='+ev.id); await o.waitForTimeout(2500);
ok('Mur photo : photos affichées', (await o.locator('.wall-slide').count()) >= 1, await o.locator('#w-count').innerText().catch(()=>''));
await o.goto(B+'/album?id='+ev.id); await o.waitForTimeout(2000);
ok('Album : photos et messages', (await o.locator('#album img').count()) >= 2, `${await o.locator('#album img').count()} images`);
await o.goto(B+'/dashboard'); await o.waitForTimeout(2500); await closeDialogs(o);
await o.click(`[data-action="stats"]`).catch(()=>{}); await o.waitForTimeout(1500);
ok('Statistiques', (await o.locator('.sheet:not(.hidden), [role=dialog]').count()) > 0); await closeDialogs(o);
await o.goto(B+'/faire-part?id='+ev.id); await o.waitForTimeout(2500); await o.click('#share'); await o.waitForTimeout(800);
ok('Partage du faire-part (menu)', await o.locator('#share-sheet').count() > 0); await closeDialogs(o);
// Carte de partage
const og = await o.request.get(B+`/og/${ev.slug}.png`); ok('Carte de partage Facebook/WhatsApp', og.status() === 200 && (og.headers()['content-type']||'').includes('png'));
// 6. Modération : suppression photo + message
const entries = await (await o.request.get(B+`/api/public/${ev.slug}/guestbook`)).json();
ok('Suppression d\'une photo (organisateur)', (await o.request.delete(B+`/api/public/${ev.slug}/photos/${photos[0]?.id}`)).ok());
ok('Suppression d\'un message (organisateur)', (await o.request.delete(B+`/api/public/${ev.slug}/guestbook/${entries[0]?.id}`)).ok());
// 7. Nettoyage
ok('Suppression de l\'événement', (await o.request.delete(B+'/api/events/'+ev.id)).ok());
ok('Suppression du compte', (await o.request.delete(B+'/api/auth/me')).ok());
} catch (e) { R.push('💥 '+e.message.split('\n')[0]); await globalThis.__last?.screenshot({ path: S+'/az-fail.png' }).catch(()=>{}); }
console.log(R.join('\n')); console.log('Erreurs :', errs.length ? errs : 'aucune'); await b.close();
