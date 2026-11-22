// Startkarte: Elektroden-Platzierung wählen, Notiz eingeben, Messung mit dem gewählten Messplan starten.
import { api } from "../api.js";
import { sitzung } from "../sitzung.js";
import { esc } from "../hilfen.js";
import { ton } from "../ton.js";

const MAX_NOTIZ = 500;
const letzteWahl = new Map();   // Proband-ID → zuletzt gewählte Platzierung (für diese Browsersitzung)
const letzteNotiz = new Map();  // Proband-ID → Notiz, bleibt nach einem Fehlstart erhalten

// Vorauswahl: zuletzt hier gewählt, sonst die der letzten Messung, sonst die erste Platzierung
function vorauswahl(p) {
  const vorhanden = (id) => p.platzierungen.some((x) => x.id === id);
  if (letzteWahl.has(p.id) && (letzteWahl.get(p.id) === "" || vorhanden(letzteWahl.get(p.id)))) return letzteWahl.get(p.id);
  const zuletzt = [...p.aufnahmen].reverse().find((a) => a.platzierung && vorhanden(a.platzierung.id));
  return zuletzt ? zuletzt.platzierung.id : (p.platzierungen[0]?.id || "");
}

// meldung(text, klasse) zeigt Fehler an; gesperrt: es läuft eine Messung für einen anderen Probanden.
// Gibt eine Funktion zurück, die die Beschriftung des Start-Knopfs aktualisiert.
export function zeigeMessungStart(el, p, eintrag, { gesperrt, meldung }) {
  const gewaehlt = vorauswahl(p);
  const optionen = [`<option value="">– keine Angabe –</option>`, ...p.platzierungen.map((x) =>
    `<option value="${x.id}" ${x.id === gewaehlt ? "selected" : ""}>${esc(x.name)} (Anordnung ${esc(x.variante)})</option>`)];
  el.innerHTML = `
    <div class="karte">
      <h2 style="margin-top:0">Messung starten</h2>
      <div class="einstellungen">
        <div><label for="ms-platzierung" style="margin-top:0">Elektroden-Platzierung</label>
          <select id="ms-platzierung">${optionen.join("")}</select></div>
        <div><label for="ms-notiz" style="margin-top:0">Notiz zu dieser Messung (optional)</label>
          <input type="text" id="ms-notiz" maxlength="${MAX_NOTIZ}" placeholder="z. B. Sitzung 2, nach 5 min Pause" value="${esc(letzteNotiz.get(p.id) || "")}"></div>
      </div>
      <p class="klein">Vor dem Start: Sensoren einschalten und anbringen, EMG and Motion Tools schließen. Die Aufnahme beginnt, sobald alle Sensoren senden; dann folgt der Vorlauf und danach der erste Piepton.</p>
      <div class="reihe"><button class="haupt" id="ms-start" ${gesperrt ? "disabled" : ""}></button>
        ${gesperrt ? `<span class="klein">Es läuft gerade eine Messung für einen anderen Probanden.</span>` : ""}</div>
    </div>`;

  const auswahl = el.querySelector("#ms-platzierung");
  auswahl.addEventListener("change", () => letzteWahl.set(p.id, auswahl.value));
  el.querySelector("#ms-notiz").addEventListener("input", (e) => letzteNotiz.set(p.id, e.target.value));
  const start = el.querySelector("#ms-start");
  const beschrifte = () => { start.textContent = `„${eintrag.name}“ messen`; };
  beschrifte();
  start.addEventListener("click", async () => {
    if (!eintrag.bewegungen.length) return meldung("Bitte mindestens eine Bewegung eintragen.", "fehler");
    start.disabled = true;
    ton.freigeben();   // im Klick, sonst bleibt der Browser stumm
    meldung("");
    try {
      await sitzung.speichereJetzt();   // der Server startet mit dem gespeicherten Messplan
      await api.starteMessung(p.id,
        { messplanId: eintrag.id, platzierungId: auswahl.value || null, notiz: el.querySelector("#ms-notiz").value });
    } catch (e) {
      meldung(e.message, "fehler");
      start.disabled = false;
    }
  });
  return beschrifte;   // nach einer Namensänderung aufrufen
}
