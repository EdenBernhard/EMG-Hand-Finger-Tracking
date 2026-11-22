// Schritt 7: EMG-Messungen. Wechselt zwischen Vorbereitung (Messpläne, Start) und Live-Anzeige;
// der Zustand kommt als Ereignisstrom vom Server, so bleibt die Anzeige auch nach Neuladen aktuell.
import { api } from "../api.js";
import { sitzung } from "../sitzung.js";
import { dauerText } from "../hilfen.js";
import { ton } from "../ton.js";
import { normalisiereMessplaene } from "../modell/messplaene.js";
import { zeigeMessplanAuswahl } from "./messplanAuswahl.js";
import { zeigeMessplanEditor } from "./messplanEditor.js";
import { zeigeMessungStart } from "./messungStart.js";
import { erstelleLiveAnzeige } from "./messungLive.js";
import { aufnahmenListe } from "./aufnahmenListe.js";
import { zeigeC3dImport } from "./c3dImportKarte.js";

const ergebnisText = (e) => e.saved
  ? `Messung gespeichert: ${e.recording} · ${dauerText(e.duration_s)} · ${e.cues} Vorgaben` +
    (e.completed ? "" : " · vorzeitig beendet")
  : "Messung beendet, es wurden keine Daten gespeichert.";

export function zeigeMessung(el, messplanId) {
  const p = sitzung.proband;
  // Fehlen bei Probanden, die ein älterer Server geliefert hat; ergänzen statt abzustürzen
  normalisiereMessplaene(p);
  p.aufnahmen = Array.isArray(p.aufnahmen) ? p.aufnahmen : [];
  const eintrag = p.messplaene.find((m) => m.id === messplanId) || p.messplaene[0];

  el.innerHTML = `<p id="ms-meldung"></p><div id="ms-haupt"></div><div id="ms-import"></div>
    <div id="ms-liste">${aufnahmenListe(p)}</div>`;
  const haupt = el.querySelector("#ms-haupt");
  zeigeC3dImport(el.querySelector("#ms-import"), p, {
    beiImport: (aufnahme) => {
      p.aufnahmen.push(aufnahme);
      el.querySelector("#ms-liste").innerHTML = aufnahmenListe(p);
    },
  });
  const meldung = (text, klasse = "info") => {
    const m = el.querySelector("#ms-meldung");
    m.className = text ? klasse : "";
    m.textContent = text || "";
  };
  let live = null;
  let zustand = { laeuft: false };
  const meine = () => zustand.laeuft && zustand.probandId === p.id;

  const zeigeVorbereitung = (gesperrt = false) => {
    live?.beende();
    live = null;
    haupt.innerHTML = `<div id="ms-auswahl"></div><div id="ms-plan"></div><div id="ms-start"></div>`;
    const tabsNeu = zeigeMessplanAuswahl(haupt.querySelector("#ms-auswahl"), p, eintrag);
    const startNeu = zeigeMessungStart(haupt.querySelector("#ms-start"), p, eintrag, { gesperrt, meldung });
    zeigeMessplanEditor(haupt.querySelector("#ms-plan"), eintrag, { beiNamensAenderung: () => { tabsNeu(); startNeu(); } });
  };
  const zeigeLive = () => {
    live ||= erstelleLiveAnzeige(haupt, zustand.kontext);
  };

  const beiEreignis = async (e) => {
    if (e.type === "state") {
      zustand = e;
      if (!meine()) return zeigeVorbereitung(e.laeuft);
      zeigeLive();
      if (e.impedanz) live.impedanz(e.impedanz);
      live.phase(e.phase);
      if (e.vorgabe) live.vorgabe(e.vorgabe, { anzahl: e.anzahl, mitTon: false });
      else if (e.aufnahme) live.aufnahme(e.aufnahme);
      return;
    }
    const ende = e.type === "finished" || e.type === "error";
    if (!meine()) {   // Messung eines anderen Probanden: Start wieder freigeben, sobald sie endet
      if (ende) {
        zustand = { laeuft: false };
        zeigeVorbereitung();
      }
      return;
    }
    if (e.type === "checking_impedance") live.phase("impedanz");
    if (e.type === "impedance") live.impedanz(e);
    if (e.type === "waiting_for_sensors") live.phase("warten");
    if (e.type === "recording") live.aufnahme(e);
    if (e.type === "cue") live.vorgabe(e, { anzahl: zustand.anzahl });
    if (ende) {
      zustand = { laeuft: false };
      if (e.type === "error") {
        zeigeVorbereitung();
        return meldung(e.message, "fehler");
      }
      ton.ende();
      p.aufnahmen = (await api.lade(p.id)).aufnahmen || [];
      zeigeVorbereitung();
      meldung(ergebnisText(e), e.completed ? "info" : "hinweis");
      el.querySelector("#ms-liste").innerHTML = aufnahmenListe(p);
    }
  };

  const abmelden = api.abonniereMessung(beiEreignis);
  window.addEventListener("hashchange", () => {
    abmelden();
    live?.beende();
  }, { once: true });
}
