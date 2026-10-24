// « Inspirations » : YouTube Shorts de fêtes (mariages, anniversaires…) trouvés automatiquement
// via l'API officielle YouTube (clé YOUTUBE_API_KEY), dans la langue du visiteur. Les vidéos restent
// hébergées par YouTube (intégration officielle, auteur affiché) : aucune copie.
const KEY = process.env.YOUTUBE_API_KEY;
const WORDS = {
  fr: ["mariage", "anniversaire surprise", "baptême"], en: ["wedding", "birthday surprise", "baby shower"], de: ["Hochzeit", "Geburtstag Überraschung", "Taufe"],
  es: ["boda", "cumpleaños sorpresa", "bautizo"], it: ["matrimonio", "compleanno sorpresa", "battesimo"], pt: ["casamento", "aniversário surpresa", "chá de bebê"],
  nl: ["bruiloft", "verjaardag verrassing", "babyshower"], pl: ["wesele", "urodziny niespodzianka", "chrzciny"], ro: ["nuntă", "zi de naștere surpriză", "botez"],
  ru: ["свадьба", "день рождения сюрприз", "крестины"], uk: ["весілля", "день народження сюрприз", "хрестини"], tr: ["düğün", "doğum günü sürprizi", "sünnet düğünü"],
  ar: ["حفل زفاف", "عيد ميلاد مفاجأة", "عقيقة"], hi: ["शादी", "जन्मदिन सरप्राइज", "हल्दी"], zh: ["婚礼", "生日惊喜", "订婚"],
};
const cache = new Map(); // langue → { at, list }
const TTL = 24 * 3600 * 1000; // 24 h : 3 recherches (50 vidéos chacune) par langue et par jour, bien sous le quota gratuit

async function search(q, lang) {
  const u = new URL("https://www.googleapis.com/youtube/v3/search");
  Object.entries({ part: "snippet", type: "video", videoDuration: "short", videoEmbeddable: "true", safeSearch: "strict",
    maxResults: "50", order: "relevance", relevanceLanguage: lang, q: `${q} #shorts`, key: KEY }).forEach(([k, v]) => u.searchParams.set(k, v));
  const r = await fetch(u, { signal: AbortSignal.timeout(8000) });
  if (!r.ok) throw new Error(`YouTube ${r.status}`);
  return (await r.json()).items.map((it) => ({
    id: it.id.videoId, title: it.snippet.title, channel: it.snippet.channelTitle,
    thumb: it.snippet.thumbnails?.high?.url || it.snippet.thumbnails?.medium?.url || "",
  }));
}

export async function inspirations(lang) {
  if (!KEY) return [];
  const L = WORDS[lang] ? lang : "en";
  const c = cache.get(L);
  if (c && Date.now() - c.at < TTL) return c.list;
  try {
    const lists = await Promise.all(WORDS[L].map((w) => search(w, L).catch(() => [])));
    // Un de chaque thème à tour de rôle, sans doublons.
    const seen = new Set(), list = [];
    for (let i = 0; i < 50; i++) for (const l of lists) { const v = l[i]; if (v && !seen.has(v.id)) { seen.add(v.id); list.push(v); } }
    if (list.length) cache.set(L, { at: Date.now(), list });
    return list;
  } catch (err) {
    console.error("Inspirations :", err.message);
    return c?.list || [];
  }
}
