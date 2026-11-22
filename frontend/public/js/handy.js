// Handy-Seite: Fotos von Innen- und Oberseite direkt mit der Kamera aufnehmen und an den Laptop schicken.
// Kennt nur das Token aus dem QR-Code (im #-Teil der Adresse, geht nicht an Server-Logs) und nie Name
// oder ID des Probanden. verkleinere() codiert neu und entfernt dabei EXIF-Daten wie den GPS-Ort.
import { verkleinere } from "./zeichnen/bilder.js";
import { SEITEN_NAMEN, HALTUNG, AUFNAHME, DATENSCHUTZ } from "./modell/fotoAnleitung.js";

const app = document.getElementById("app");
const token = location.hash.slice(1);
const api = `/api/handy/${encodeURIComponent(token)}`;

async function anfrage(pfad, daten) {
  const r = await fetch(pfad, daten && {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(daten) });
  const antwort = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(antwort.fehler || `Fehler ${r.status}`);
  return antwort;
}

function zeigeFehler(text) {
  app.innerHTML = `<div class="karte"><p class="fehler"></p></div>`;
  app.querySelector(".fehler").textContent = text;
}

function zeige(seiten) {
  app.innerHTML = `
    <div class="karte"><p>${AUFNAHME}</p><p class="hinweis">${DATENSCHUTZ}</p></div>
    ${Object.keys(SEITEN_NAMEN).map((s) => `
      <div class="karte handy-seite">
        <h2 style="margin-top:0">${SEITEN_NAMEN[s]} ${seiten[s] ? "✓" : ""}</h2>
        <p>${HALTUNG[s]}</p>
        <label class="knopf ${seiten[s] ? "" : "haupt"} handy-knopf">${seiten[s] ? "Neu aufnehmen" : "Foto aufnehmen"}
          <input type="file" accept="image/*" capture="environment" data-seite="${s}" hidden></label>
        <p class="klein" data-status="${s}"></p>
      </div>`).join("")}
    <p class="klein">Fertig? Am Laptop geht es automatisch weiter. Diese Seite kann dann geschlossen werden.</p>`;

  for (const eingabe of app.querySelectorAll("input[data-seite]")) {
    eingabe.addEventListener("change", async () => {
      const seite = eingabe.dataset.seite;
      const status = app.querySelector(`[data-status="${seite}"]`);
      if (!eingabe.files[0]) return;
      status.textContent = "Wird gesendet …";
      try {
        await anfrage(`${api}/bild/${seite}`, await verkleinere(eingabe.files[0]));
        zeige({ ...seiten, [seite]: true });
      } catch (e) {
        status.textContent = e.message;
      }
    });
  }
}

anfrage(api).then((d) => zeige(d.seiten)).catch((e) => zeigeFehler(e.message));
