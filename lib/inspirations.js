// « Inspirations » : vidéos de fêtes libres de droits (Pixabay, Coverr, Pexels), lues directement par le téléphone.
const TTL = 24 * 3600 * 1000; // 24 h de cache par bibliothèque

// Pexels (clé PEXELS_API_KEY, gratuite) : vidéos verticales libres de droits, en fichiers MP4 lus directement
// par le téléphone (lecture automatique fiable).
const PEXELS = process.env.PEXELS_API_KEY;
const PEXELS_WORDS = ["wedding", "wedding dance", "birthday party", "birthday cake", "celebration party", "baby shower", "graduation", "engagement", "family celebration", "confetti party"];
let pexCache = null;
async function pexels() {
  if (pexCache && Date.now() - pexCache.at < TTL) return pexCache.list;
  const one = async (q) => {
    const r = await fetch(`https://api.pexels.com/videos/search?${new URLSearchParams({ query: q, orientation: "portrait", per_page: "30", size: "medium" })}`, { headers: { Authorization: PEXELS }, signal: AbortSignal.timeout(8000) });
    if (!r.ok) throw new Error(`Pexels ${r.status}`);
    return (await r.json()).videos.map((v) => {
      // Plus petit fichier MP4 vertical d'au moins 900 px de haut : net sur téléphone, léger à charger.
      const files = v.video_files.filter((f) => f.file_type === "video/mp4" && f.height > f.width).sort((a, b) => a.height - b.height);
      const file = files.find((f) => f.height >= 900) || files.at(-1);
      return file && { id: `px${v.id}`, src: file.link, thumb: v.image, title: q, channel: v.user?.name || "Pexels", credit: v.url, source: "Pexels", portrait: true };
    }).filter(Boolean);
  };
  const lists = await Promise.all(PEXELS_WORDS.map((q) => one(q).catch((err) => { console.error("Réels Pexels :", err.message); return []; })));
  const seen = new Set(), list = [];
  for (let i = 0; i < 30; i++) for (const l of lists) { const v = l[i]; if (v && !seen.has(v.id)) { seen.add(v.id); list.push(v); } }
  if (list.length) pexCache = { at: Date.now(), list };
  return list.length ? list : pexCache?.list || [];
}

// Pixabay (clé PIXABAY_API_KEY, gratuite, obtenue tout de suite) : même principe que Pexels.
// Vidéos verticales en priorité ; les horizontales sont gardées en dernier recours (affichées en entier).
const PIXABAY = process.env.PIXABAY_API_KEY;
let pixCache = null;
async function pixabay() {
  if (pixCache && Date.now() - pixCache.at < TTL) return pixCache.list;
  const one = async (q) => {
    const r = await fetch(`https://pixabay.com/api/videos/?${new URLSearchParams({ key: PIXABAY, q, per_page: "50", safesearch: "true" })}`, { signal: AbortSignal.timeout(8000) });
    if (!r.ok) throw new Error(`Pixabay ${r.status}`);
    return (await r.json()).hits.map((h) => {
      const f = h.videos.medium?.url ? h.videos.medium : h.videos.small;
      if (!f?.url) return null;
      return { id: `pb${h.id}`, src: f.url, thumb: f.thumbnail || h.videos.tiny?.thumbnail || "", title: q, channel: h.user || "Pixabay",
        credit: h.pageURL, source: "Pixabay", portrait: f.height > f.width };
    }).filter(Boolean);
  };
  const lists = await Promise.all(PEXELS_WORDS.map((q) => one(q).catch((err) => { console.error("Réels Pixabay :", err.message); return []; })));
  const seen = new Set(), all = [];
  for (let i = 0; i < 50; i++) for (const l of lists) { const v = l[i]; if (v && !seen.has(v.id)) { seen.add(v.id); all.push(v); } }
  const list = [...all.filter((v) => v.portrait), ...all.filter((v) => !v.portrait)];
  if (list.length) pixCache = { at: Date.now(), list };
  return list.length ? list : pixCache?.list || [];
}

// Coverr (clé COVERR_API_KEY, gratuite) : vidéos libres de droits, fichiers MP4 lus directement.
const COVERR = process.env.COVERR_API_KEY;
let covCache = null;
async function coverr() {
  if (covCache && Date.now() - covCache.at < TTL) return covCache.list;
  const one = async (q) => {
    const r = await fetch(`https://api.coverr.co/videos?${new URLSearchParams({ query: q, urls: "true", page_size: "50" })}`, { headers: { Authorization: `Bearer ${COVERR}` }, signal: AbortSignal.timeout(8000) });
    if (!r.ok) throw new Error(`Coverr ${r.status}`);
    const data = await r.json();
    return (data.hits || data.videos || []).map((h) => {
      const src = h.urls?.mp4 || h.urls?.mp4_preview || h.urls?.mp4_download;
      if (!src) return null;
      const portrait = h.is_vertical ?? (Number(h.max_height) > Number(h.max_width));
      return { id: `cv${h.id}`, src, thumb: h.poster || h.thumbnail || "", title: q, channel: "Coverr", credit: `https://coverr.co/videos/${h.slug || h.id}`, source: "Coverr", portrait: Boolean(portrait) };
    }).filter(Boolean);
  };
  const lists = await Promise.all(PEXELS_WORDS.map((q) => one(q).catch((err) => { console.error("Réels Coverr :", err.message); return []; })));
  const seen = new Set(), all = [];
  for (let i = 0; i < 50; i++) for (const l of lists) { const v = l[i]; if (v && !seen.has(v.id)) { seen.add(v.id); all.push(v); } }
  const list = [...all.filter((v) => v.portrait), ...all.filter((v) => !v.portrait)];
  if (list.length) covCache = { at: Date.now(), list };
  return list.length ? list : covCache?.list || [];
}

export async function inspirations(lang) {
  // Toutes les bibliothèques configurées sont mêlées (verticales d'abord).
  const libs = (await Promise.all([PIXABAY && pixabay().catch(() => []), COVERR && coverr().catch(() => []), PEXELS && pexels().catch(() => [])].filter(Boolean))).filter((l) => l.length);
  const out = [];
  for (let i = 0; libs.some((l) => l[i]); i++) for (const l of libs) if (l[i]) out.push(l[i]);
  return [...out.filter((v) => v.portrait !== false), ...out.filter((v) => v.portrait === false)];
}
