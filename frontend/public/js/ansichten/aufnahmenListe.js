// Tabelle der bisherigen Messungen eines Probanden (neueste zuerst).
import { esc, datum, dauerText } from "../hilfen.js";
import { bewegungText } from "../modell/messplan.js";
import { impedanzKurz } from "./impedanzAnzeige.js";
import { ALLE_STARTEN_ID } from "./analyseAktionen.js";

const bewegungen = (a) => (a.plan?.bewegungen || [])
  .map((b) => bewegungText(typeof b === "string" ? { name: b, anzahl: 1 } : b)).join(", ");

const platzierung = (pl) => (pl ? `${pl.name} (${pl.variante})` : "–");

const vorgaben = (a) => `${a.vorgaben}${a.vollstaendig ? "" : " (abgebrochen)"}`;

export function aufnahmenListe(p) {
  if (!p.aufnahmen.length) return "";
  const zeilen = [...p.aufnahmen].reverse().map((a) => `<tr>
      <td>${esc(datum(a.erstellt))}</td>
      <td title="${esc(bewegungen(a))}">${esc(a.messplan?.name || "–")}</td>
      <td>${esc(platzierung(a.platzierung))}</td>
      <td>${esc(a.notiz || "")}</td>
      <td>${esc(dauerText(a.dauerS))}</td>
      <td>${esc(vorgaben(a))}</td>
      <td>${esc(impedanzKurz(a.impedanz))}</td>
      <td class="klein"><code>${esc(a.name)}</code></td>
      <td class="analyse-zelle" data-analyse="${esc(a.name)}"></td>
      <td><button class="gefahr" data-loeschen="${esc(a.name)}" title="Fehlerhafte Messung löschen">Löschen</button></td></tr>`).join("");
  return `<div class="karte">
    <h2 style="margin-top:0">Bisherige Messungen</h2>
    <p class="klein">Dateien unter <code>data/probanden/${esc(p.id)}/&lt;Platzierung&gt;_&lt;ID&gt;/</code>, je Elektroden-Platzierung ein Ordner
      (ohne Platzierung: <code>ohne_platzierung/</code>): <code>&lt;Datei&gt;.csv</code> (Rohdaten),
      <code>.events.csv</code> (PC-Zeit und USB-Verluste je SDK-Event), <code>.cues.csv</code> (Bewegungsvorgaben mit Sample-Index), <code>.protocol.json</code> (Messplan, Platzierung, Notiz, Ablauf). Die CSV hat den Aufbau von EMG and Motion Tools; „Analysieren“ führt damit das Notebook
      aus <code>Datenaufbereitung/</code> aus. Mehrere Analysen lassen sich auf einmal starten; sie warten und laufen nacheinander.</p>
    <div class="reihe"><button id="${ALLE_STARTEN_ID}">Alle ohne Analyse starten</button></div>
    <div class="tabelle"><table>
      <thead><tr><th>Datum</th><th>Messplan</th><th>Platzierung</th><th>Notiz</th><th>Dauer</th><th>Vorgaben</th><th>Impedanz</th><th>Datei</th><th>Analyse</th><th></th></tr></thead>
      <tbody>${zeilen}</tbody></table></div>
  </div>`;
}
