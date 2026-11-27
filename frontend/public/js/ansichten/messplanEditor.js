// Eingabe eines Messplans: Name, Bewegungen mit Anzahl (direkt hintereinander), Intervall, Pause,
// Durchläufe, Vorlauf. Änderungen landen sofort im übergebenen Eintrag und werden automatisch gespeichert.
import { sitzung } from "../sitzung.js";
import { esc, dauerText } from "../hilfen.js";
import {
  GRENZEN, STANDARD_BEWEGUNGEN, bereinigeMessplan, neueBewegung, anzahlBewegungen, vorgabenJeDurchlauf, dauerS,
} from "../modell/messplan.js";

const MAX_NAME = 80;

const zahlFeld = (id, titel, einheit, wert, { min, max }, schritt) => `
  <div><label for="${id}" style="margin-top:0">${titel}</label>
    <div class="feld-einheit"><input type="number" id="${id}" min="${min}" max="${max}" step="${schritt}" value="${esc(wert)}">${einheit}</div></div>`;

const zeile = (b, i) => `
  <li class="bewegung" data-i="${i}">
    <input type="text" class="bw-name" maxlength="${GRENZEN.maxBewegungLaenge}" value="${esc(b.name)}"
      placeholder="z. B. Pinch" aria-label="Bewegung ${i + 1}">
    <span class="feld-einheit bw-anzahl-feld"><input type="number" class="bw-anzahl" min="${GRENZEN.anzahl.min}"
      max="${GRENZEN.anzahl.max}" step="1" value="${esc(b.anzahl)}" aria-label="Anzahl direkt hintereinander">×</span>
    <button type="button" class="bw-weg" aria-label="Bewegung entfernen">✕</button>
  </li>`;

const zusammenfassung = (plan) => plan.bewegungen.length
  ? `${anzahlBewegungen(plan)} Bewegungen (${vorgabenJeDurchlauf(plan)} je Durchlauf × ${plan.wiederholungen})` +
    (plan.pauseS > 0 ? `, nach jeder ${plan.pauseS} s Pause` : "") + ` · Dauer ca. ${dauerText(dauerS(plan))}`
  : "Bitte mindestens eine Bewegung eintragen.";

// eintrag: { id, name, bewegungen, intervallS, pauseS, wiederholungen, vorlaufS }; beiNamensAenderung(name) z. B. für die Tabs
export function zeigeMessplanEditor(el, eintrag, { beiNamensAenderung = () => {} } = {}) {
  // Arbeitsliste der Zeilen, auch mit noch leerem Namen; gespeichert wird die bereinigte Fassung
  let zeilen = eintrag.bewegungen.map((b) => ({ ...b }));

  el.innerHTML = `
    <div class="karte">
      <label for="mp-name" style="margin-top:0">Name des Messplans</label>
      <input type="text" id="mp-name" maxlength="${MAX_NAME}" value="${esc(eintrag.name)}" placeholder="z. B. Finger einzeln">
      <p class="klein" style="margin-top:.8rem">Zu jedem Piepton wird die nächste Bewegung angezeigt und ausgeführt, bis der nächste Ton kommt.
        <strong>Anzahl</strong>: so oft wird die Bewegung direkt hintereinander angesagt, jedes Mal mit eigenem Ton (z. B. Pinch 3×).
        <strong>Pause</strong>: Ruhe nach jeder einzelnen Bewegung, mit eigenem Ton und als „Ruhe“ gelabelt (0 = keine Pause).
        <strong>Durchläufe</strong>: so oft wird die ganze Liste wiederholt.</p>
      <ol class="bewegungen" id="mp-liste"></ol>
      <div class="reihe" style="margin:.4rem 0 .9rem">
        <button type="button" id="mp-neu">+ Bewegung</button>
        <button type="button" id="mp-standard">Standardliste einsetzen</button>
      </div>
      <div class="einstellungen">
        ${zahlFeld("mp-intervall", "Intervall", "s", eintrag.intervallS, GRENZEN.intervallS, 0.5)}
        ${zahlFeld("mp-pause", "Pause danach", "s", eintrag.pauseS, GRENZEN.pauseS, 0.5)}
        ${zahlFeld("mp-wiederholungen", "Durchläufe", "×", eintrag.wiederholungen, GRENZEN.wiederholungen, 1)}
        ${zahlFeld("mp-vorlauf", "Vorlauf (Ruhe)", "s", eintrag.vorlaufS, GRENZEN.vorlaufS, 0.5)}
      </div>
      <p class="info" id="mp-summe"></p>
    </div>`;

  const liste = el.querySelector("#mp-liste");
  const uebernimm = () => {
    Object.assign(eintrag, bereinigeMessplan({
      bewegungen: zeilen,
      intervallS: el.querySelector("#mp-intervall").value,
      pauseS: el.querySelector("#mp-pause").value,
      wiederholungen: el.querySelector("#mp-wiederholungen").value,
      vorlaufS: el.querySelector("#mp-vorlauf").value,
    }));
    el.querySelector("#mp-summe").textContent = zusammenfassung(eintrag);
    el.querySelector("#mp-neu").disabled = zeilen.length >= GRENZEN.maxBewegungen;
    sitzung.speichereSpaeter();
  };
  const zeichneListe = () => {
    liste.innerHTML = zeilen.map(zeile).join("");
    uebernimm();
  };

  el.querySelector("#mp-name").addEventListener("input", (e) => {
    const name = e.target.value.trim();
    if (!name) return;
    eintrag.name = name;
    sitzung.speichereSpaeter();
    beiNamensAenderung(name);
  });
  liste.addEventListener("input", (e) => {
    const i = Number(e.target.closest("[data-i]").dataset.i);
    if (e.target.classList.contains("bw-name")) zeilen[i].name = e.target.value;
    if (e.target.classList.contains("bw-anzahl")) zeilen[i].anzahl = e.target.value;
    uebernimm();
  });
  liste.addEventListener("click", (e) => {
    if (!e.target.classList.contains("bw-weg")) return;
    zeilen.splice(Number(e.target.closest("[data-i]").dataset.i), 1);
    zeichneListe();
  });
  el.querySelectorAll(".einstellungen input").forEach((f) => f.addEventListener("input", uebernimm));
  el.querySelector("#mp-neu").addEventListener("click", () => {
    zeilen.push(neueBewegung());
    zeichneListe();
    liste.querySelector("li:last-child .bw-name").focus();
  });
  el.querySelector("#mp-standard").addEventListener("click", () => {
    zeilen = STANDARD_BEWEGUNGEN.map(neueBewegung);
    zeichneListe();
  });
  zeichneListe();
}
