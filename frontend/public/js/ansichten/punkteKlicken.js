// Messpunkte nacheinander auf dem Foto anklicken; einzelne Punkte lassen sich neu setzen.
import { api } from "../api.js";
import { sitzung } from "../sitzung.js";
import { esc } from "../hilfen.js";
import { PUNKTE } from "../modell/messpunkte.js";
import { ladeBild } from "../zeichnen/bilder.js";
import { zeichnePunkte } from "../zeichnen/punkte.js";

export async function zeigePunkteKlicken(el, seite) {
  const p = sitzung.proband;
  const punkte = PUNKTE[seite];
  const daten = p[seite];
  daten.punkte = daten.punkte || {};
  const naechsterOffener = () => (punkte.find((x) => !daten.punkte[x.key]) || {}).key || null;
  let aktiv = naechsterOffener();

  const img = await ladeBild(api.bildUrl(p.id, daten));
  el.innerHTML = `
    <div class="foto-bereich">
      <div class="karte" style="padding:.6rem"><canvas class="foto klickbar" id="leinwand"></canvas></div>
      <div class="karte">
        <h3>Punkte anklicken</h3>
        <p class="klein">Klick auf dem Foto genau auf das Kreuz. Zum Korrigieren den Punkt in der Liste antippen und neu klicken.</p>
        <ul class="punkt-liste" id="pliste"></ul>
        <p class="klein" id="tipp"></p>
        <button id="reset">Alle Punkte löschen</button>
      </div>
    </div>`;
  const c = el.querySelector("#leinwand");
  c.width = img.naturalWidth;
  c.height = img.naturalHeight;

  function aktualisiere() {
    zeichnePunkte(c.getContext("2d"), img, punkte, daten.punkte, aktiv);
    el.querySelector("#pliste").innerHTML = punkte.map((x, i) => {
      const klasse = `${x.key === aktiv ? "aktuell" : ""} ${daten.punkte[x.key] ? "gesetzt" : ""}`;
      return `<li data-key="${x.key}" class="${klasse}" style="cursor:pointer">${i + 1}. ${esc(x.name)}</li>`;
    }).join("");
    const ap = punkte.find((x) => x.key === aktiv);
    el.querySelector("#tipp").textContent = ap ? ap.tipp : "Alle Punkte gesetzt. Weiter zum nächsten Schritt.";
    el.querySelectorAll("#pliste li").forEach((li) =>
      li.addEventListener("click", () => { aktiv = li.dataset.key; aktualisiere(); }));
  }

  c.addEventListener("click", (ev) => {
    if (!aktiv) return;
    const rect = c.getBoundingClientRect();
    const k = c.width / rect.width;
    daten.punkte[aktiv] = { x: Math.round((ev.clientX - rect.left) * k), y: Math.round((ev.clientY - rect.top) * k) };
    aktiv = naechsterOffener();
    aktualisiere();
    sitzung.speichereSpaeter();
  });
  el.querySelector("#reset").addEventListener("click", () => {
    daten.punkte = {};
    aktiv = punkte[0].key;
    aktualisiere();
    sitzung.speichereSpaeter();
  });
  aktualisiere();
}
