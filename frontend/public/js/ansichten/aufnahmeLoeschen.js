// Knopf „Löschen“ in der Tabelle der bisherigen Messungen: fragt nach und löscht die Aufnahme samt Dateien.
import { api } from "../api.js";

// beiGeloescht(aufnahmen) bekommt die verbleibenden Aufnahmen; Fehler zeigt meldung(text, "fehler")
export function verbindeLoeschen(el, p, { beiGeloescht, meldung }) {
  el.addEventListener("click", async (e) => {
    const knopf = e.target.closest("[data-loeschen]");
    if (!knopf) return;
    const name = knopf.dataset.loeschen;
    if (!confirm(`Messung „${name}“ löschen?\n\nRohdaten, Vorgaben, Protokoll und Analyse dieser Messung werden ` +
      "endgültig gelöscht.")) return;
    knopf.disabled = true;
    try {
      beiGeloescht(await api.loescheAufnahme(p.id, name));
      meldung(`Messung „${name}“ gelöscht.`);
    } catch (fehler) {
      knopf.disabled = false;
      meldung(fehler.message, "fehler");
    }
  });
}
