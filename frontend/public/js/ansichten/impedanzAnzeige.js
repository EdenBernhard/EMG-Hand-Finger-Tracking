// Ergebnis des Impedanz-Checks vor der Messung: je Sensor bestanden / nicht bestanden / nicht geprüft.
// Das SDK liefert keinen Widerstandswert, nur den Vergleich mit der Schwelle des Herstellers.
import { esc } from "../hilfen.js";

const OHM_PRO_KILOOHM = 1000;
const TEXTE = { Passed: "bestanden", Failed: "nicht bestanden", NotExecuted: "nicht geprüft" };

const kachel = (r) => `<div class="impedanz-sensor ${r.passed ? "ok" : "schlecht"}">
    <strong>Sensor ${esc(r.sensor_id)}</strong><span>${esc(TEXTE[r.report] || r.report)}</span></div>`;

// ereignis: { results: [{sensor_id, report, passed}], passed, threshold_ohm }
export function impedanzHtml({ results = [], passed, threshold_ohm }) {
  const schwelle = threshold_ohm ? ` (Schwelle ${threshold_ohm / OHM_PRO_KILOOHM} kΩ)` : "";
  const fazit = passed
    ? `Alle Sensoren bestanden${schwelle}. Die Messung startet.`
    : `Nicht alle Sensoren bestanden${schwelle}. Elektroden und Hautkontakt prüfen (siehe README, Fehlerbehebung), ` +
      "dann abbrechen und neu starten – oder trotzdem messen; das wird mit der Aufnahme gespeichert.";
  return `<div class="impedanz-raster">${results.map(kachel).join("")}</div>
    <p class="${passed ? "info" : "hinweis"}">${esc(fazit)}</p>`;
}

// Kurzform für die Tabelle der bisherigen Messungen; zusammenfassung aus impedanzZusammenfassung()
export function impedanzKurz(zusammenfassung) {
  if (!zusammenfassung) return "–";
  if (zusammenfassung.bestanden) return "ok";
  const sensoren = zusammenfassung.nichtBestanden.join(", ");
  return `Sensor ${sensoren} nicht ok${zusammenfassung.trotzdemGemessen ? " (trotzdem gemessen)" : ""}`;
}
