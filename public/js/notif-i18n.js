// Traduction anglaise des notifications (créées en français) — partagée par le site (cloche)
// et par le serveur (notifications du téléphone, selon la langue de chaque personne).
export const NOTIF_EN = [
  [/^⏰ « (.+) » commence dans 1 heure$/, "⏰ “$1” starts in 1 hour"],
  [/^Le live démarre à (\d+)h(\d+) : installez-vous !$/, "The live starts at $1:$2. Get ready!"],
  [/^(.*) Réaction à votre story$/, "$1 Reaction to your story"],
  [/^(.*) Réaction à votre événement$/, "$1 Reaction to your event"],
  [/^✅ (.+) viendra peut-être$/, "✅ $1 might come"],
  [/^✅ (.+) vient$/, "✅ $1 is coming"],
  [/^👋 (.+) vous a ajouté en ami$/, "👋 $1 added you as a friend"],
  [/^💬 (.+) a commenté votre story$/, "💬 $1 commented on your story"],
  [/^💬 (.+) a répondu$/, "💬 $1 replied"],
  [/^● Live aujourd'hui : (.+)$/, "● Live today: $1"],
  [/^● Live demain : (.+)$/, "● Live tomorrow: $1"],
  [/^📅 (.+), c'est aujourd'hui !$/, "📅 $1 is today!"],
  [/^📅 (.+), c'est demain !$/, "📅 $1 is tomorrow!"],
  [/^✍️ Livre d'or — (.+)$/, "✍️ Guestbook — $1"],
  [/^🎞️ Le replay de « (.+) » est disponible$/, "🎞️ The replay of “$1” is available"],
  [/^Vous pouvez maintenant vous écrire\.$/, "You can now message each other."],
  [/^Il a été envoyé à vos invités par email\.$/, "It has been sent to your guests by email."],
  [/^(.+) a réagi à votre story de « (.+) »$/, "$1 reacted to your story of “$2”"],
  [/^Quelqu'un a réagi à « (.+) »$/, "Someone reacted to “$1”"],
  [/^Demain à (.+)$/, "Tomorrow at $1"],
  [/^Aujourd'hui à (.+)$/, "Today at $1"],
  [/^(.+) : a partagé un souvenir$/, "$1: shared a memory"],
  [/^(.+) · (\d+) personnes$/, "$1 · $2 people"],
];
export function translateNotif(t, lang) {
  if (lang !== "en" || !t) return t;
  for (const [re, en] of NOTIF_EN) if (re.test(t)) return t.replace(re, en);
  return t;
}
