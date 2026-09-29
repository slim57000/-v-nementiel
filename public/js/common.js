// Utilitaires partagés par toutes les pages.

export const EVENT_TYPES = {
  mariage: { label: "Mariage", icon: "💍" },
  anniversaire: { label: "Anniversaire", icon: "🎂" },
  bapteme: { label: "Baptême", icon: "🕊️" },
  communion: { label: "Communion", icon: "🕯️" },
  fiancailles: { label: "Fiançailles", icon: "💞" },
  "baby-shower": { label: "Baby shower", icon: "🍼" },
  diplome: { label: "Remise de diplôme", icon: "🎓" },
  retraite: { label: "Retraite", icon: "🌴" },
  inauguration: { label: "Inauguration", icon: "🎀" },
  autre: { label: "Autre", icon: "🎉" },
};

export async function api(path, options = {}) {
  const res = await fetch(path, {
    ...options,
    headers: { "Content-Type": "application/json", ...options.headers },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error || "Une erreur est survenue."), { status: res.status, data });
  return data;
}

export const $ = (sel, root = document) => root.querySelector(sel);

export function esc(text) {
  const div = document.createElement("div");
  div.textContent = text ?? "";
  return div.innerHTML;
}

export function toast(message) {
  const el = document.createElement("div");
  el.className = "toast";
  el.setAttribute("role", "status");
  el.textContent = message;
  document.body.append(el);
  setTimeout(() => el.remove(), 2600);
}

export async function copy(text, message = "Copié !") {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    // Repli pour les navigateurs sans API presse-papier (http, vieux Android).
    const ta = Object.assign(document.createElement("textarea"), { value: text });
    document.body.append(ta);
    ta.select();
    document.execCommand("copy");
    ta.remove();
  }
  toast(message);
}

// Partage natif si disponible (mobile), sinon copie du lien.
export async function share({ title, text, url }) {
  if (navigator.share) {
    try { return await navigator.share({ title, text, url }); } catch (e) { if (e.name === "AbortError") return; }
  }
  copy(url, "Lien copié !");
}

export const eventUrl = (slug) => `${location.origin}/e/${slug}`;

export function formatDate(date, time) {
  const d = new Date(`${date}T${time}`);
  const day = d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  return `${day.charAt(0).toUpperCase()}${day.slice(1)} à ${time.replace(":", "h")}`;
}

// Redimensionne une photo côté navigateur (photos de téléphone souvent > 5 Mo) et renvoie une data URL JPEG.
export function resizeImage(file, maxSize = 1600) {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith("image/")) return reject(new Error("Merci de choisir une image."));
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(img.src);
      resolve(canvas.toDataURL("image/jpeg", 0.85));
    };
    img.onerror = () => reject(new Error("Image illisible."));
    img.src = URL.createObjectURL(file);
  });
}
