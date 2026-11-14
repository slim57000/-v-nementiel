// 🛡️ Modération automatique : propos injurieux / haineux et spam refusés avant publication.
// Liste volontairement courte (insultes et termes haineux sans ambiguïté), sur des mots entiers, pour ne pas
// bloquer des messages normaux. Les accents, majuscules et lettres répétées / chiffres (« c0nnaaard ») sont ramenés à la forme simple.
const WORDS = [
  // français
  "connard", "connasse", "salope", "salaud", "encule", "enculé", "enculer", "batard", "bâtard", "pute", "putain de ta", "fdp", "ntm", "nique ta mere",
  "niquetamere", "fils de pute", "ta gueule", "tg", "pd", "pédé", "tapette", "gouine", "bougnoule", "negro", "sale noir", "sale arabe", "sale juif",
  "youpin", "bicot", "chinetoque", "bamboula", "crève", "creve", "va mourir", "suicide toi", "abruti", "débile mental", "grosse vache", "trou du cul",
  // anglais
  "fuck you", "fucking", "motherfucker", "bitch", "cunt", "whore", "slut", "asshole", "dickhead", "nigger", "nigga", "faggot", "kill yourself", "kys",
  // turc / arabe / espagnol (les plus courants)
  "orospu", "siktir", "amına", "amina koyim", "piç", "yarrak", "sharmouta", "charmouta", "kess emak", "hijo de puta", "puta madre", "maricón", "cabrón",
];
const norm = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
  .replace(/[0@]/g, "o").replace(/[1!|]/g, "i").replace(/3/g, "e").replace(/4/g, "a").replace(/5\$/g, "s").replace(/7/g, "t")
  .replace(/(.)\1+/g, "$1").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
const PATTERNS = WORDS.map((w) => new RegExp(`(^| )${norm(w).replace(/ /g, " ?")}s?( |$)`, "u"));
const LINK = /(https?:\/\/\S+|www\.\S+|\b[\w-]+\.(com|net|org|ru|xyz|top|click|link|io|biz|info)\b\S*)/gi;
const SAFE_LINK = /(mafeliza\.com|youtube\.com|youtu\.be|google\.[a-z.]+\/maps|goo\.gl\/maps|maps\.app\.goo\.gl|leetchi\.com|lepotcommun\.fr|paypal\.(me|com))/i;

// Renvoie le motif du refus, ou "" si le texte peut être publié.
export function abuseReason(text) {
  const t = norm(text);
  if (!t) return "";
  if (PATTERNS.some((re) => re.test(t))) return "Ce message contient des propos injurieux ou haineux : il n'a pas été publié.";
  const links = String(text).match(LINK) || [];
  if (links.length >= 3 || (links.length && !SAFE_LINK.test(text) && /(gagn|gratuit|crypto|bitcoin|casino|promo|cliquez|click here|free money|earn)/i.test(text))) {
    return "Ce message ressemble à du spam (liens publicitaires) : il n'a pas été publié.";
  }
  return "";
}

// Express : refuse la requête si un des champs texte est abusif.
export const rejectAbuse = (...fields) => (req, res, next) => {
  for (const f of fields) {
    const reason = abuseReason(req.body?.[f]);
    if (reason) return res.status(422).json({ error: reason });
  }
  next();
};
