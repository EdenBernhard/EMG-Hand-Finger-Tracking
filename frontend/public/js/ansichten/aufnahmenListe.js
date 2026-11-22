// Tabelle der bisherigen Messungen eines Probanden (neueste zuerst).
import { esc, datum, dauerText } from "../hilfen.js";
import { bewegungText } from "../modell/messplan.js";

const bewegungen = (a) => (a.plan?.bewegungen || [])
  .map((b) => bewegungText(typeof b === "string" ? { name: b, anzahl: 1 } : b)).join(", ");

const platzierung = (pl) => (pl ? `${pl.name} (${pl.variante})` : "–");

export function aufnahmenListe(p) {
  if (!p.aufnahmen.length) return "";
  const zeilen = [...p.aufnahmen].reverse().map((a) => `<tr>
      <td>${esc(datum(a.erstellt))}</td>
      <td title="${esc(bewegungen(a))}">${esc(a.messplan?.name || "–")}</td>
      <td>${esc(platzierung(a.platzierung))}</td>
      <td>${esc(a.notiz || "")}</td>
      <td>${esc(dauerText(a.dauerS))}</td>
      <td>${esc(a.vorgaben)}${a.vollstaendig ? "" : " (abgebrochen)"}</td>
      <td class="klein"><code>${esc(a.name)}</code></td></tr>`).join("");
  return `<div class="karte">
    <h2 style="margin-top:0">Bisherige Messungen</h2>
    <p class="klein">Dateien unter <code>data/probanden/${esc(p.id)}/</code>: <code>&lt;Datei&gt;.csv</code> (Rohdaten),
      <code>.cues.csv</code> (Bewegungsvorgaben mit Sample-Index), <code>.protocol.json</code> (Messplan, Platzierung, Notiz, Ablauf).</p>
    <div class="tabelle"><table>
      <thead><tr><th>Datum</th><th>Messplan</th><th>Platzierung</th><th>Notiz</th><th>Dauer</th><th>Vorgaben</th><th>Datei</th></tr></thead>
      <tbody>${zeilen}</tbody></table></div>
  </div>`;
}
