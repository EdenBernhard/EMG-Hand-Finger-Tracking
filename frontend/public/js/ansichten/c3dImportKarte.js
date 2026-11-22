// Karte zum Hochladen von C3D-Dateien aus EMG and Motion Tools. Das Backend wandelt jede Datei in
// CSV um und legt sie beim Probanden ab; danach erscheint sie unter „Bisherige Messungen“.
import { api } from "../api.js";
import { esc } from "../hilfen.js";
import { platzierungOptionen } from "./platzierungOptionen.js";

const MAX_NOTIZ = 500;

// beiImport(aufnahme) wird nach jeder erfolgreich importierten Datei aufgerufen
export function zeigeC3dImport(el, p, { beiImport }) {
  el.innerHTML = `
    <div class="karte">
      <h2 style="margin-top:0">C3D-Dateien importieren</h2>
      <p class="klein">Aufnahmen aus EMG and Motion Tools (.c3d) hochladen. Sie werden in CSV umgewandelt und mit der
        Originaldatei bei diesem Probanden gespeichert.</p>
      <div class="einstellungen">
        <div><label for="ci-dateien" style="margin-top:0">Dateien</label>
          <input type="file" id="ci-dateien" accept=".c3d" multiple></div>
        <div><label for="ci-platzierung" style="margin-top:0">Elektroden-Platzierung</label>
          <select id="ci-platzierung">${platzierungOptionen(p, "")}</select></div>
        <div><label for="ci-notiz" style="margin-top:0">Notiz (optional, gilt für alle Dateien)</label>
          <input type="text" id="ci-notiz" maxlength="${MAX_NOTIZ}" placeholder="z. B. Testlauf mit Sensoren 5–7"></div>
      </div>
      <div class="reihe"><button class="haupt" id="ci-start" disabled>Hochladen und konvertieren</button></div>
      <p id="ci-meldung"></p>
    </div>`;

  const eingabe = el.querySelector("#ci-dateien");
  const start = el.querySelector("#ci-start");
  const meldung = (html, klasse = "info") => {
    const m = el.querySelector("#ci-meldung");
    m.className = html ? klasse : "";
    m.innerHTML = html;
  };
  eingabe.addEventListener("change", () => { start.disabled = !eingabe.files.length; meldung(""); });

  start.addEventListener("click", async () => {
    const dateien = [...eingabe.files];
    const angaben = { platzierungId: el.querySelector("#ci-platzierung").value || null,
      notiz: el.querySelector("#ci-notiz").value };
    start.disabled = eingabe.disabled = true;
    const fehler = [];
    let erfolgreich = 0;
    for (const [i, datei] of dateien.entries()) {   // nacheinander: jede Datei startet einen Python-Prozess
      meldung(`Konvertiere ${esc(datei.name)} (${i + 1} von ${dateien.length}) …`);
      try {
        beiImport(await api.importiereC3d(p.id, datei, angaben));
        erfolgreich++;
      } catch (e) {
        fehler.push(`${esc(datei.name)}: ${esc(e.message)}`);
      }
    }
    const text = `${erfolgreich} von ${dateien.length} Datei(en) importiert.`;
    meldung(fehler.length ? `${text}<br>${fehler.join("<br>")}` : text, fehler.length ? "fehler" : "info");
    eingabe.value = "";
    eingabe.disabled = false;
  });
}
