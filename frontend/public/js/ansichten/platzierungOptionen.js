// <option>-Liste der Elektroden-Platzierungen eines Probanden (für Messung und C3D-Import).
import { esc } from "../hilfen.js";

export function platzierungOptionen(p, gewaehlt) {
  return [`<option value="">– keine Angabe –</option>`, ...p.platzierungen.map((x) =>
    `<option value="${esc(x.id)}" ${x.id === gewaehlt ? "selected" : ""}>${esc(x.name)} (Anordnung ${esc(x.variante)})</option>`)]
    .join("");
}
