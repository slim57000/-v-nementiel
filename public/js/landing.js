// Pages d'atterrissage (référencement) : bannière cookies, statistiques, bouton « Créer » collant une fois le haut de page dépassé.
import "./common.js";

const sticky = document.getElementById("lp-sticky"), hero = document.querySelector(".hx"), final = document.querySelector(".lp-final");
if (sticky && hero && "IntersectionObserver" in window) {
  let heroVisible = true, finalVisible = false;
  const paint = () => sticky.classList.toggle("show", !heroVisible && !finalVisible);
  new IntersectionObserver(([e]) => { heroVisible = e.isIntersecting; paint(); }).observe(hero);
  if (final) new IntersectionObserver(([e]) => { finalVisible = e.isIntersecting; paint(); }).observe(final);
}
