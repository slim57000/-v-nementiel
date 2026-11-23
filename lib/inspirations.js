// « Inspirations » : vidéos de fêtes libres de droits (Pixabay, Coverr, Pexels), lues directement par le téléphone.
const TTL = 6 * 3600 * 1000; // nouvelle récolte toutes les 6 h
const POOL_MAX = 900;           // vidéos gardées par bibliothèque (les plus anciennes sortent)

// Thèmes recherchés : tous les types d'événements MaFeliza. À chaque récolte, 12 thèmes au hasard et une page au
// hasard (1 à 4) : les vidéos changent souvent, et la réserve grossit au fil des jours au lieu de tourner en rond.
const THEMES = [
  "wedding", "wedding dance", "wedding ceremony", "bride", "groom", "wedding rings", "bridal bouquet", "first dance", "wedding party", "wedding decoration",
  "engagement", "proposal", "henna night", "birthday party", "birthday cake", "blowing candles", "kids birthday", "surprise party",
  "baby shower", "gender reveal", "baptism", "christening", "communion", "graduation", "graduation cap", "retirement party",
  "anniversary dinner", "family celebration", "family dinner", "gala dinner", "champagne toast", "celebration party", "confetti party",
  "dance floor", "fireworks", "sparklers", "party balloons", "eid celebration", "christmas family", "new year party",
];
const pick = (n) => [...THEMES].sort(() => Math.random() - 0.5).slice(0, n);
const page = () => String(1 + Math.floor(Math.random() * 4));

// Réserve d'une bibliothèque : récolte (fetchOne(thème, page) → vidéos) ajoutée à la réserve, sans doublon.
function library(name, fetchOne) {
  const pool = new Map();
  let at = 0, running = null;
  return async () => {
    if (pool.size && Date.now() - at < TTL) return [...pool.values()];
    running ||= (async () => {
      const lists = await Promise.all(pick(12).map((q) => fetchOne(q, page()).catch((err) => { console.error(`Réels ${name} :`, err.message); return []; })));
      for (const v of lists.flat()) if (v && !pool.has(v.id)) pool.set(v.id, { ...v, added: Date.now() });
      while (pool.size > POOL_MAX) pool.delete(pool.keys().next().value);
      if (lists.some((l) => l.length)) at = Date.now();
    })().finally(() => { running = null; });
    if (!pool.size) await running; // première fois : on attend ; ensuite la récolte se fait en arrière-plan
    return [...pool.values()];
  };
}

// Pexels (clé PEXELS_API_KEY, gratuite) : vidéos verticales en MP4 lues directement par le téléphone.
const PEXELS = process.env.PEXELS_API_KEY;
const pexels = library("Pexels", async (q, pg) => {
  const r = await fetch(`https://api.pexels.com/videos/search?${new URLSearchParams({ query: q, orientation: "portrait", per_page: "30", size: "medium", page: pg })}`, { headers: { Authorization: PEXELS }, signal: AbortSignal.timeout(8000) });
  if (!r.ok) throw new Error(`Pexels ${r.status}`);
  return (await r.json()).videos.map((v) => {
    // Plus petit fichier MP4 vertical d'au moins 900 px de haut : net sur téléphone, léger à charger.
    const files = v.video_files.filter((f) => f.file_type === "video/mp4" && f.height > f.width).sort((a, b) => a.height - b.height);
    const file = files.find((f) => f.height >= 900) || files.at(-1);
    return file && { id: `px${v.id}`, src: file.link, thumb: v.image, title: q, channel: v.user?.name || "Pexels", credit: v.url, source: "Pexels", portrait: true };
  });
});

// Pixabay (clé PIXABAY_API_KEY, gratuite) : verticales en priorité, horizontales en dernier recours.
const PIXABAY = process.env.PIXABAY_API_KEY;
const pixabay = library("Pixabay", async (q, pg) => {
  const r = await fetch(`https://pixabay.com/api/videos/?${new URLSearchParams({ key: PIXABAY, q, per_page: "50", safesearch: "true", page: pg })}`, { signal: AbortSignal.timeout(8000) });
  if (r.status === 400) return []; // page au-delà des résultats
  if (!r.ok) throw new Error(`Pixabay ${r.status}`);
  return (await r.json()).hits.map((h) => {
    const f = h.videos.medium?.url ? h.videos.medium : h.videos.small;
    return f?.url && { id: `pb${h.id}`, src: f.url, thumb: f.thumbnail || h.videos.tiny?.thumbnail || "", title: q, channel: h.user || "Pixabay",
      credit: h.pageURL, source: "Pixabay", portrait: f.height > f.width };
  });
});

// Coverr (clé COVERR_API_KEY, gratuite) : vidéos libres de droits, fichiers MP4 lus directement.
const COVERR = process.env.COVERR_API_KEY;
const coverr = library("Coverr", async (q, pg) => {
  const r = await fetch(`https://api.coverr.co/videos?${new URLSearchParams({ query: q, urls: "true", page_size: "50", page: String(Number(pg) - 1) })}`, { headers: { Authorization: `Bearer ${COVERR}` }, signal: AbortSignal.timeout(8000) });
  if (!r.ok) throw new Error(`Coverr ${r.status}`);
  const data = await r.json();
  return (data.hits || data.videos || []).map((h) => {
    const src = h.urls?.mp4 || h.urls?.mp4_preview || h.urls?.mp4_download;
    const portrait = h.is_vertical ?? (Number(h.max_height) > Number(h.max_width));
    return src && { id: `cv${h.id}`, src, thumb: h.poster || h.thumbnail || "", title: q, channel: "Coverr", credit: `https://coverr.co/videos/${h.slug || h.id}`, source: "Coverr", portrait: Boolean(portrait) };
  });
});

export async function inspirations(lang) {
  // Toutes les bibliothèques configurées sont mêlées (verticales d'abord).
  const libs = (await Promise.all([PIXABAY && pixabay().catch(() => []), COVERR && coverr().catch(() => []), PEXELS && pexels().catch(() => [])].filter(Boolean))).filter((l) => l.length);
  // Les plus récentes de chaque réserve d'abord (mélangées ensuite à chaque chargement des Réels).
  for (const l of libs) l.sort((a, b) => b.added - a.added);
  const out = [];
  for (let i = 0; libs.some((l) => l[i]); i++) for (const l of libs) if (l[i]) out.push(l[i]);
  // 300 vidéos tirées au hasard dans la réserve à chaque chargement (réponse légère, jamais deux fois la même suite).
  const sample = out.sort(() => Math.random() - 0.5).slice(0, 300);
  return [...sample.filter((v) => v.portrait !== false), ...sample.filter((v) => v.portrait === false)];
}
