// Einstieg: wählt anhand der Adresse (#/ oder #/p/<id>/<schritt>) die Ansicht.
import { sitzung } from "./sitzung.js";
import { esc } from "./hilfen.js";
import { zeigeListe } from "./ansichten/liste.js";
import { zeigeAssistent } from "./ansichten/assistent.js";

const app = document.getElementById("app");

async function route() {
  const [bereich, id, schritt, parameter] = location.hash.replace(/^#\/?/, "").split("/");
  try {
    if (bereich === "p" && id) {
      await sitzung.speichereJetzt();
      await sitzung.oeffne(id);
      await zeigeAssistent(app, schritt, parameter);
    } else {
      await sitzung.schliesse();
      await zeigeListe(app);
    }
    window.scrollTo(0, 0);
  } catch (e) {
    app.innerHTML = `<div class="karte"><p class="fehler">${esc(e.message)}</p><a href="#/">Zur Übersicht</a></div>`;
  }
}

window.addEventListener("hashchange", route);
window.addEventListener("beforeunload", () => sitzung.speichereJetzt());
route();
