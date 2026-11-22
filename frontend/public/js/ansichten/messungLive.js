// Anzeige während der Messung: aktuelle Bewegung groß, Countdown bis zum nächsten Piepton, Stopp.
// Den Takt gibt Python vor (gezählt in Samples); hier wird nur angezeigt und gepiept.
import { api } from "../api.js";
import { esc, zahlText } from "../hilfen.js";
import { ton } from "../ton.js";
import { impedanzHtml } from "./impedanzAnzeige.js";

const ANZEIGE_TAKT_MS = 100;
const MS_PRO_S = 1000;

const PHASEN = {
  start: "Starte die Messung …",
  impedanz: "Prüfe die Impedanz der Elektroden …",
  impedanz_entscheidung: "Impedanz-Check nicht bestanden – wie weiter?",
  warten: "Verbinde mit dem Receiver und warte, bis alle Sensoren senden (ca. 5 s) …",
  stoppt: "Messung wird beendet …",
};

// kontext: { messplan: {name}, platzierung: {name, variante} | null, notiz } für die Kopfzeile
export function erstelleLiveAnzeige(el, kontext = {}) {
  const kopf = [kontext.messplan?.name, kontext.platzierung && `Platzierung ${kontext.platzierung.name}`, kontext.notiz]
    .filter(Boolean).join(" · ");
  el.innerHTML = `
    <div class="karte live">
      <h2 style="margin-top:0">${esc(kopf || "Messung")}</h2>
      <p class="klein" id="lv-phase"></p>
      <div id="lv-impedanz"></div>
      <div class="live-bewegung" id="lv-bewegung">–</div>
      <div class="live-balken"><div id="lv-balken"></div></div>
      <p class="live-zeile"><span id="lv-rest"></span><span id="lv-naechste"></span></p>
      <div class="reihe">
        <button class="haupt" id="lv-trotzdem" hidden>Trotzdem messen</button>
        <button class="gefahr" id="lv-stopp">Messung stoppen</button>
        <button id="lv-ton" hidden>Ton aktivieren</button>
      </div>
      <p class="fehler" id="lv-fehler"></p>
    </div>`;

  const $ = (id) => el.querySelector(id);
  let ziel = null;     // performance.now(), zu dem die aktuelle Vorgabe endet
  let laenge = null;   // Dauer der aktuellen Vorgabe in ms

  const zeichneCountdown = () => {
    $("#lv-ton").hidden = ton.bereit;
    if (ziel === null) return;
    const rest = Math.max(0, ziel - performance.now());
    $("#lv-rest").textContent = `noch ${zahlText(rest / MS_PRO_S)} s`;
    $("#lv-balken").style.width = `${100 * (1 - rest / laenge)}%`;
  };
  const takt = setInterval(zeichneCountdown, ANZEIGE_TAKT_MS);
  const starteCountdown = (sekunden) => {
    laenge = sekunden * MS_PRO_S;
    ziel = performance.now() + laenge;
    zeichneCountdown();
  };

  $("#lv-stopp").addEventListener("click", async () => {
    $("#lv-stopp").disabled = true;
    try {
      await api.stoppeMessung();
    } catch (e) {
      $("#lv-fehler").textContent = e.message;
      $("#lv-stopp").disabled = false;
    }
  });
  $("#lv-ton").addEventListener("click", () => ton.freigeben());
  $("#lv-trotzdem").addEventListener("click", async () => {
    $("#lv-trotzdem").disabled = true;
    try {
      await api.setzeMessungFort();
    } catch (e) {
      $("#lv-fehler").textContent = e.message;
      $("#lv-trotzdem").disabled = false;
    }
  });

  return {
    phase(name) {
      $("#lv-phase").textContent = PHASEN[name] || "";
      if (name === "stoppt") $("#lv-stopp").disabled = true;
      const entscheiden = name === "impedanz_entscheidung";
      $("#lv-trotzdem").hidden = !entscheiden;
      $("#lv-trotzdem").disabled = false;
      $("#lv-stopp").textContent = entscheiden ? "Abbrechen" : "Messung stoppen";
    },
    impedanz(ereignis) {
      $("#lv-impedanz").innerHTML = impedanzHtml(ereignis);
      this.phase(ereignis.passed ? "impedanz" : "impedanz_entscheidung");
    },
    aufnahme({ first_cue_in_s, total_cues }) {
      $("#lv-impedanz").innerHTML = "";   // Platz für die Bewegung; das Ergebnis steht später in der Tabelle
      $("#lv-phase").textContent = `Aufnahme läuft · ${total_cues} Vorgaben`;
      $("#lv-bewegung").textContent = "Ruhe – gleich geht's los";
      $("#lv-naechste").textContent = "";
      starteCountdown(first_cue_in_s);
    },
    vorgabe({ index, repetition, movement, in_row = 1, in_row_of = 1, next_movement, ends_in_s }, { anzahl, mitTon = true }) {
      if (mitTon) ton.neueBewegung();
      $("#lv-phase").textContent = `Vorgabe ${index + 1} von ${anzahl} · Durchlauf ${repetition}`;
      $("#lv-bewegung").textContent = in_row_of > 1 ? `${movement} (${in_row}/${in_row_of})` : movement;
      $("#lv-naechste").innerHTML = next_movement ? `Als Nächstes: <strong>${esc(next_movement)}</strong>` : "Danach: Ende";
      starteCountdown(ends_in_s);
    },
    beende() {
      clearInterval(takt);
    },
  };
}
