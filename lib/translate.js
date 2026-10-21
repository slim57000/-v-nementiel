// Traduction automatique des noms d'événements (« Léa et Olivier » → « Léa and Olivier », « लिया और ओलिवियर »…)
// dans la langue du visiteur. Cache mémoire ; un nom pas encore traduit est renvoyé tel quel puis traduit en fond.
const cache = new Map(); // `${langue}|${texte}` → traduction (ou promesse en cours)
const SKIP = new Set(["Événement privé", "Événement sur invitation"]); // déjà traduits par le dictionnaire du site
const GTX = { zh: "zh-CN" };

function fetchTr(text, lang) {
  const key = `${lang}|${text}`;
  if (cache.has(key)) return cache.get(key);
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${GTX[lang] || lang}&dt=t&q=${encodeURIComponent(text)}`;
  const p = fetch(url, { signal: AbortSignal.timeout(4000) })
    .then((r) => (r.ok ? r.json() : null))
    .then((j) => { const out = j?.[0]?.map((x) => x[0]).join("") || text; cache.set(key, out); return out; })
    .catch(() => { cache.delete(key); return text; });
  cache.set(key, p);
  if (cache.size > 20000) cache.delete(cache.keys().next().value);
  return p;
}

export const reqLangFull = (req) => /(?:^|;\s*)em-lang=([a-z]{2})/.exec(req?.headers?.cookie || "")?.[1] || "fr";

// Remplace `name` des événements (objets avec date + nom) dans une réponse JSON ; attend au plus `wait` ms.
export async function translateNames(data, lang, wait = 1200) {
  if (!lang || lang === "fr" || !data || typeof data !== "object") return data;
  data = JSON.parse(JSON.stringify(data)); // copie : ne jamais toucher aux objets en cache
  const found = [];
  const walk = (o, depth) => {
    if (!o || typeof o !== "object" || depth > 4) return;
    if (Array.isArray(o)) return o.forEach((x) => walk(x, depth + 1));
    if (typeof o.name === "string" && o.date && o.name.trim() && !SKIP.has(o.name) && o.name.length < 200) found.push(o);
    for (const v of Object.values(o)) if (v && typeof v === "object") walk(v, depth + 1);
  };
  walk(data, 0);
  if (!found.length) return data;
  const timer = new Promise((r) => setTimeout(r, wait));
  await Promise.race([Promise.all(found.map((o) => fetchTr(o.name, lang))), timer]);
  for (const o of found) { const v = cache.get(`${lang}|${o.name}`); if (typeof v === "string") o.name = v; }
  return data;
}

// Middleware : traduit les noms d'événements dans les réponses JSON des GET.
export function translateMiddleware(req, res, next) {
  const lang = reqLangFull(req);
  if (req.method !== "GET" || lang === "fr") return next();
  const json = res.json.bind(res);
  res.json = (body) => { translateNames(body, lang).then((b) => json(b), () => json(body)); return res; };
  next();
}
