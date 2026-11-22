// Tabelle der bisherigen Messungen eines Probanden (neueste zuerst).
import { esc, datum, dauerText } from "../hilfen.js";
import { bewegungText } from "../modell/messplan.js";
import { QUELLE_C3D } from "../modell/aufnahmen.js";
import { impedanzKurz } from "./impedanzAnzeige.js";

const bewegungen = (a) => (a.plan?.bewegungen || [])
  .map((b) => bewegungText(typeof b === "string" ? { name: b, anzahl: 1 } : b)).join(", ");

const platzierung = (pl) => (pl ? `${pl.name} (${pl.variante})` : "–");

const importiert = (a) => a.quelle === QUELLE_C3D;
const messplan = (a) => (importiert(a) ? "C3D-Import" : a.messplan?.name || "–");
const titel = (a) => (importiert(a) ? `${a.originalDatei || ""} · ${(a.kanaele || []).join(", ")}` : bewegungen(a));
const vorgaben = (a) => (importiert(a) ? "–" : `${a.vorgaben}${a.vollstaendig ? "" : " (abgebrochen)"}`);

export function aufnahmenListe(p) {
  if (!p.aufnahmen.length) return "";
  const zeilen = [...p.aufnahmen].reverse().map((a) => `<tr>
      <td>${esc(datum(a.erstellt))}</td>
      <td title="${esc(titel(a))}">${esc(messplan(a))}</td>
      <td>${esc(platzierung(a.platzierung))}</td>
      <td>${esc(a.notiz || "")}</td>
      <td>${esc(dauerText(a.dauerS))}</td>
      <td>${esc(vorgaben(a))}</td>
      <td>${esc(impedanzKurz(a.impedanz))}</td>
      <td class="klein"><code>${esc(a.name)}</code></td>
      <td class="analyse-zelle" data-analyse="${esc(a.name)}"></td></tr>`).join("");
  return `<div class="karte">
    <h2 style="margin-top:0">Bisherige Messungen</h2>
    <p class="klein">Dateien unter <code>data/probanden/${esc(p.id)}/&lt;Platzierung&gt;_&lt;ID&gt;/</code>, je Elektroden-Platzierung ein Ordner
      (ohne Platzierung: <code>ohne_platzierung/</code>): <code>&lt;Datei&gt;.csv</code> (Rohdaten),
      <code>.events.csv</code> (PC-Zeit und USB-Verluste je SDK-Event), <code>.cues.csv</code> (Bewegungsvorgaben mit Sample-Index), <code>.protocol.json</code> (Messplan, Platzierung, Notiz, Ablauf); bei C3D-Importen zusätzlich <code>.c3d</code> (Original), ohne <code>.cues.csv</code>. Die CSV hat den Aufbau von EMG and Motion Tools; „Analysieren“ führt damit das Notebook
      aus <code>Datenaufbereitung/</code> aus.</p>
    <div class="tabelle"><table>
      <thead><tr><th>Datum</th><th>Messplan</th><th>Platzierung</th><th>Notiz</th><th>Dauer</th><th>Vorgaben</th><th>Impedanz</th><th>Datei</th><th>Analyse</th></tr></thead>
      <tbody>${zeilen}</tbody></table></div>
  </div>`;
}
