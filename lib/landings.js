// Pages d'atterrissage pour Google (une par recherche visée : « mariage en direct », « faire-part en ligne »…).
// Rendues côté serveur (lisibles par Google sans JavaScript), avec FAQ, fil d'Ariane et données structurées.
// Titre et description restent modifiables depuis Admin → Réglages → Référencement.

export const LANDINGS = {
  "mariage-en-direct": {
    label: "Mariage en direct",
    title: "Diffuser son mariage en direct gratuitement — MaFeliza",
    description: "Filmez votre mariage avec un simple téléphone et partagez-le en direct avec les proches qui ne peuvent pas venir. Replay, livre d'or et photos inclus.",
    h1: "Diffusez votre mariage en direct, depuis un simple téléphone",
    intro: "Grands-parents trop loin, amis à l'étranger, cousins malades : avec MaFeliza, ceux qui ne peuvent pas venir vivent votre « oui » en direct, sans installer d'application.",
    image: "/img/demo/live-mariage.jpg",
    blocks: [
      ["📱 Un téléphone suffit", "Un proche ouvre l'espace caméraman avec un code et filme la cérémonie. Pas de matériel, pas de compte YouTube, pas de réglages compliqués."],
      ["👵 Simple pour les seniors", "Les invités à distance cliquent sur le lien reçu par SMS ou WhatsApp et la vidéo démarre. Un mode « grands-parents » affiche tout en grand."],
      ["🎬 Replay envoyé automatiquement", "À la fin du live, le replay est enregistré et envoyé par email à tous vos invités. Ils peuvent revoir la cérémonie quand ils veulent."],
      ["💬 Ils participent à distance", "Réactions en direct, messages au livre d'or, photos partagées : les proches éloignés font vraiment partie de la fête."],
    ],
    steps: ["Créez votre mariage sur MaFeliza (gratuit, 2 minutes).", "Envoyez le faire-part avec le lien à vos invités.", "Le jour J, un proche filme avec le code caméraman.", "Le replay part automatiquement à la fin du live."],
    faq: [
      ["Est-ce que c'est gratuit ?", "Oui, créer un événement et diffuser votre mariage en direct est gratuit. Des options Premium existent pour retirer la signature MaFeliza et garder le replay plus longtemps."],
      ["Faut-il installer une application ?", "Non. Les invités regardent depuis leur navigateur, sur téléphone, tablette ou ordinateur. Le caméraman utilise aussi son navigateur."],
      ["Mon mariage sera-t-il visible par tout le monde ?", "Non, si vous le souhaitez. Un événement privé n'est accessible qu'avec le lien et le code d'accès que vous donnez à vos invités."],
      ["Combien de temps le replay reste-t-il disponible ?", "Le replay reste en ligne plusieurs jours en version gratuite, et plus longtemps avec Premium. Vous pouvez aussi le retirer à tout moment."],
    ],
  },
  "faire-part-en-ligne": {
    label: "Faire-part en ligne",
    title: "Faire-part en ligne gratuit à envoyer par WhatsApp — MaFeliza",
    description: "Créez un faire-part numérique élégant en 2 minutes : mariage, baptême, anniversaire. Envoi par WhatsApp, SMS ou email, réponses des invités en un clic.",
    h1: "Un faire-part en ligne élégant, prêt à envoyer en 2 minutes",
    intro: "Choisissez un style, ajoutez une photo et votre texte : votre faire-part numérique est prêt à être partagé sur WhatsApp, par SMS ou par email. Vos invités répondent en un clic.",
    image: "/img/demo/mariage-porte.jpg",
    blocks: [
      ["🎨 Des styles soignés", "Classique, moderne, élégant ou fleuri : chaque style s'adapte à votre photo et à votre événement, avec des textes déjà rédigés que vous pouvez modifier."],
      ["📲 Partage en une touche", "Le faire-part s'envoie en image avec son lien juste en dessous, idéal pour WhatsApp. Un QR code permet aussi de l'imprimer."],
      ["✅ Réponses des invités (RSVP)", "Vos invités indiquent s'ils viennent, combien ils seront, et vous recevez chaque réponse par email et notification."],
      ["🌱 Zéro papier, zéro frais d'envoi", "Pas d'impression ni de timbres : modifiez la date ou le lieu à tout moment, tout le monde voit la dernière version."],
    ],
    steps: ["Créez votre événement gratuitement.", "Choisissez le style et la photo du faire-part.", "Partagez-le sur WhatsApp, par SMS ou email.", "Suivez les réponses de vos invités en direct."],
    faq: [
      ["Le faire-part en ligne est-il gratuit ?", "Oui, la création et l'envoi du faire-part sont gratuits, sans limite d'invités."],
      ["Puis-je l'envoyer sur WhatsApp ?", "Oui. MaFeliza génère une belle image du faire-part avec le lien juste en dessous, prête à envoyer dans une conversation WhatsApp."],
      ["Mes invités doivent-ils créer un compte ?", "Non. Ils ouvrent le lien et peuvent répondre directement, sans inscription."],
      ["Puis-je l'imprimer aussi ?", "Oui, le faire-part contient un QR code : imprimé, il renvoie vers la page de l'événement."],
    ],
  },
  "livre-d-or-numerique": {
    label: "Livre d'or numérique",
    title: "Livre d'or numérique pour mariage et anniversaire — MaFeliza",
    description: "Un livre d'or en ligne où vos invités laissent messages, photos et vidéos depuis leur téléphone. À garder et télécharger pour toujours.",
    h1: "Le livre d'or numérique que vos invités remplissent depuis leur téléphone",
    intro: "Fini le cahier oublié sur une table : avec un QR code, chaque invité écrit un mot, ajoute une photo ou se filme quelques secondes. Vous gardez tous les souvenirs au même endroit.",
    image: "/img/demo/alliances.jpg",
    blocks: [
      ["✍️ Messages, photos et vidéos", "Un mot doux, une photo de la soirée ou une courte vidéo de 15 secondes : vos invités choisissent comment laisser leur souvenir."],
      ["📷 QR code sur les tables", "Imprimez le QR code de votre événement : les invités scannent et écrivent directement, même ceux qui ne sont pas à l'aise avec la technologie."],
      ["💛 Même à distance", "Les proches qui suivent le live peuvent aussi signer le livre d'or. Personne n'est oublié."],
      ["🎞️ Un film souvenir automatique", "Les photos et les plus beaux messages sont assemblés en un petit film « Revivez l'événement » à partager."],
    ],
    steps: ["Créez votre événement.", "Affichez ou imprimez le QR code.", "Les invités écrivent depuis leur téléphone.", "Relisez, épinglez et téléchargez les souvenirs."],
    faq: [
      ["Les invités doivent-ils installer quelque chose ?", "Non, il suffit de scanner le QR code ou d'ouvrir le lien. Tout se passe dans le navigateur."],
      ["Puis-je modérer les messages ?", "Oui, vous pouvez masquer, épingler ou supprimer n'importe quel message de votre livre d'or."],
      ["Puis-je récupérer les photos ?", "Oui, toutes les photos et vidéos de l'événement se téléchargent en une seule archive."],
      ["Combien ça coûte ?", "Le livre d'or numérique est inclus gratuitement dans chaque événement MaFeliza."],
    ],
  },
  "album-photo-partage": {
    label: "Album photo partagé",
    title: "Album photo partagé pour récupérer les photos des invités — MaFeliza",
    description: "Récupérez toutes les photos et vidéos prises par vos invités dans un seul album partagé, grâce à un QR code. Idéal pour mariage, baptême et anniversaire.",
    h1: "Toutes les photos de vos invités, réunies dans un seul album",
    intro: "Le lendemain d'une fête, les photos sont éparpillées dans des dizaines de téléphones. Avec MaFeliza, chaque invité les ajoute en quelques secondes dans l'album partagé de votre événement.",
    image: "/img/demo/anniversaire.jpg",
    blocks: [
      ["📥 Ajout en un clic", "Les invités scannent le QR code et envoient leurs photos et vidéos sans créer de compte."],
      ["🔒 Privé si vous le voulez", "Votre album n'est visible que par les personnes qui ont le lien et le code de votre événement."],
      ["⬇️ Téléchargement en une fois", "Récupérez toutes les photos en haute qualité dans une seule archive, avec leurs vraies dates."],
      ["📖 Album souvenir", "Créez ensuite un album souvenir à partager à toute la famille."],
    ],
    steps: ["Créez votre événement.", "Partagez le lien ou le QR code.", "Les invités ajoutent leurs photos.", "Téléchargez tout en une archive."],
    faq: [
      ["Y a-t-il une limite de photos ?", "Vos invités peuvent ajouter de nombreuses photos et vidéos ; des limites généreuses évitent seulement les abus."],
      ["La qualité des photos est-elle conservée ?", "Oui, les photos sont gardées en bonne qualité et téléchargeables à tout moment."],
      ["Faut-il un compte pour ajouter des photos ?", "Non, un invité peut ajouter ses photos directement depuis le lien de l'événement."],
      ["Est-ce gratuit ?", "Oui, l'album partagé est inclus gratuitement dans chaque événement."],
    ],
  },
  "bapteme": {
    label: "Baptême",
    title: "Baptême : faire-part en ligne, live et album photo — MaFeliza",
    description: "Organisez le baptême de votre enfant : faire-part numérique, réponses des invités, cérémonie en direct pour la famille éloignée et album photo partagé.",
    h1: "Le baptême de votre enfant, partagé avec toute la famille",
    intro: "Faire-part, réponses des invités, cérémonie en direct pour ceux qui sont loin, photos et livre d'or : tout le baptême au même endroit, simple pour les parents comme pour les grands-parents.",
    image: "/img/demo/bebe.jpg",
    blocks: [
      ["💌 Faire-part de baptême", "Des modèles tendres prêts à personnaliser avec la photo de bébé, à envoyer par WhatsApp ou SMS."],
      ["⛪ Cérémonie en direct", "La famille à l'étranger suit la cérémonie en direct depuis son téléphone, puis reçoit le replay."],
      ["📷 Photos de tous les invités", "Chaque invité ajoute ses photos : vous les récupérez toutes pour l'album de bébé."],
      ["✍️ Mots pour plus tard", "Parrain, marraine, grands-parents laissent un message que votre enfant pourra lire en grandissant."],
    ],
    steps: ["Créez le baptême en 2 minutes.", "Envoyez le faire-part.", "Diffusez la cérémonie en direct.", "Gardez photos et messages pour toujours."],
    faq: [
      ["Peut-on aussi l'utiliser pour une communion ?", "Oui, MaFeliza convient à la communion, à la bar-mitsva et à toutes les fêtes religieuses ou familiales."],
      ["Le live fonctionne-t-il dans une église ?", "Oui, avec une connexion 4G ou 5G correcte sur le téléphone qui filme."],
      ["La famille doit-elle s'inscrire ?", "Non, un simple lien suffit pour regarder et laisser un message."],
      ["Est-ce gratuit ?", "Oui, créer et partager l'événement est gratuit."],
    ],
  },
  "anniversaire": {
    label: "Anniversaire",
    title: "Invitation d'anniversaire en ligne et souvenirs partagés — MaFeliza",
    description: "Créez une invitation d'anniversaire en ligne, suivez les réponses, partagez la fête en direct et récupérez les photos de tous les invités.",
    h1: "Un anniversaire inoubliable, de l'invitation aux souvenirs",
    intro: "Anniversaire surprise, 30 ans, 50 ans ou 80 ans de mamie : invitez, organisez et partagez la fête avec ceux qui comptent, même à distance.",
    image: "/img/demo/anniversaire-bougies.jpg",
    blocks: [
      ["🎉 Invitation en ligne", "Une jolie invitation à envoyer en un clic, avec les réponses des invités en temps réel."],
      ["🎂 Les absents soufflent aussi les bougies", "Diffusez le moment du gâteau en direct pour la famille éloignée."],
      ["💝 Cagnotte et programme", "Ajoutez un lien de cagnotte et le programme de la soirée directement sur la page de l'événement."],
      ["📸 Les photos de tout le monde", "Livre d'or, photos et petit film souvenir à partager après la fête."],
    ],
    steps: ["Créez l'anniversaire.", "Envoyez l'invitation.", "Partagez la fête en direct.", "Revivez-la avec le film souvenir."],
    faq: [
      ["Peut-on organiser un anniversaire surprise ?", "Oui, rendez l'événement privé : seules les personnes qui ont le lien et le code y accèdent."],
      ["Peut-on ajouter une cagnotte ?", "Oui, ajoutez le lien de votre cagnotte, il s'affiche sur la page de l'événement."],
      ["Ça marche pour un anniversaire d'enfant ?", "Oui, de la fête d'enfant aux 90 ans, toutes les fêtes sont possibles."],
      ["Est-ce gratuit ?", "Oui, la création et le partage sont gratuits."],
    ],
  },
  "remise-de-diplome": {
    label: "Remise de diplôme",
    title: "Remise de diplôme en direct pour la famille — MaFeliza",
    description: "Partagez votre remise de diplôme en direct avec la famille qui ne peut pas venir, puis gardez le replay, les photos et les messages de félicitations.",
    h1: "Votre remise de diplôme, vécue par toute la famille",
    intro: "Les places sont limitées et la famille est loin ? Diffusez la cérémonie depuis un téléphone et recevez les félicitations de tous vos proches au même endroit.",
    image: "/img/demo/diplome-lancer.jpg",
    blocks: [
      ["🎓 La cérémonie en direct", "Un proche filme avec son téléphone, la famille regarde en direct depuis n'importe où."],
      ["👏 Félicitations en direct", "Réactions et messages s'affichent pendant le live et restent dans le livre d'or."],
      ["🎬 Replay pour ceux qui travaillaient", "Le replay est envoyé automatiquement à la fin de la cérémonie."],
      ["📷 Photos de la fête", "Les invités ajoutent leurs photos de la cérémonie et de la fête qui suit."],
    ],
    steps: ["Créez l'événement.", "Partagez le lien à la famille.", "Diffusez la cérémonie.", "Gardez replay et félicitations."],
    faq: [
      ["L'école doit-elle être d'accord ?", "Renseignez-vous auprès de l'établissement : certaines cérémonies limitent la diffusion. Un événement privé limite l'accès à vos proches."],
      ["Le replay est-il conservé ?", "Oui, il reste disponible plusieurs jours, plus longtemps avec Premium."],
      ["Faut-il une bonne connexion ?", "Une 4G ou 5G correcte sur le téléphone qui filme suffit."],
      ["Est-ce gratuit ?", "Oui, créer l'événement et diffuser en direct est gratuit."],
    ],
  },
};

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const ld = (o) => `<script type="application/ld+json">${JSON.stringify(o).replace(/</g, "\\u003c")}</script>`;

// Liens vers toutes les pages (maillage interne : aide Google à les découvrir et à comprendre le site).
export const landingLinks = (except) => Object.entries(LANDINGS).filter(([slug]) => slug !== except)
  .map(([slug, p]) => `<a href="/${slug}">${esc(p.label)}</a>`).join(" · ");

export function renderLanding(slug, base) {
  const p = LANDINGS[slug];
  const url = `${base}/${slug}`;
  const img = `${base}${p.image}`;
  return `<!doctype html>
<html lang="fr" data-lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <meta name="theme-color" content="#e8137a">
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&family=Quicksand:wght@600;700&display=swap" media="print" onload="this.media='all'">
  <link rel="stylesheet" href="/css/app.css">
  <link rel="icon" href="/img/logo.png" type="image/png">
  <link rel="apple-touch-icon" href="/img/icon-180.png">
  <title>${esc(p.title)}</title>
  <meta name="description" content="${esc(p.description)}">
  <link rel="canonical" href="${esc(url)}">
  <meta property="og:type" content="website">
  <meta property="og:url" content="${esc(url)}">
  <meta property="og:title" content="${esc(p.title)}">
  <meta property="og:description" content="${esc(p.description)}">
  <meta property="og:image" content="${esc(img)}">
  <meta property="og:locale" content="fr_FR">
  <meta name="twitter:card" content="summary_large_image">
  ${ld({ "@context": "https://schema.org", "@type": "FAQPage", mainEntity: p.faq.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })) })}
  ${ld({ "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [
    { "@type": "ListItem", position: 1, name: "MaFeliza", item: `${base}/` },
    { "@type": "ListItem", position: 2, name: p.label, item: url },
  ] })}
  ${ld({ "@context": "https://schema.org", "@type": "WebPage", name: p.title, description: p.description, url, inLanguage: "fr-FR", primaryImageOfPage: img })}
</head>
<body>
  <main class="container lp" style="max-width:640px">
    <nav class="lp-crumbs"><a href="/?accueil">MaFeliza</a> › <span>${esc(p.label)}</span></nav>
    <h1>${esc(p.h1)}</h1>
    <p class="lp-intro">${esc(p.intro)}</p>
    <a href="/connexion?next=/edit" class="btn btn-block">Créer mon événement gratuitement</a>
    <img class="lp-hero" src="${esc(p.image)}" alt="${esc(p.h1)}" width="1200" height="800" loading="eager">
    ${p.blocks.map(([h, t]) => `<section class="lp-block"><h2>${esc(h)}</h2><p>${esc(t)}</p></section>`).join("\n    ")}
    <section class="lp-steps"><h2>Comment ça marche ?</h2><ol>${p.steps.map((s) => `<li>${esc(s)}</li>`).join("")}</ol></section>
    <section class="lp-faq"><h2>Questions fréquentes</h2>
      ${p.faq.map(([q, a]) => `<details><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join("\n      ")}
    </section>
    <a href="/connexion?next=/edit" class="btn btn-block">✨ Commencer, c'est gratuit</a>
    <p class="lp-more"><b>Voir aussi :</b> ${landingLinks(slug)}</p>
  </main>
  <footer class="site-footer">
    <a href="/?accueil">Accueil</a> · <a href="/decouvrir">Découvrir</a> · <a href="/contact">Contact</a><br>
    <a href="/mentions-legales">Mentions légales</a> · <a href="/cgu">CGU</a> · <a href="/confidentialite">Confidentialité</a> · <a href="#" data-cookies>Gérer les cookies</a>
  </footer>
  <script type="module" src="/js/landing.js"></script>
</body>
</html>`;
}
