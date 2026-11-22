// Ersatz für emg_tracking.analysis.cli in den Tests: gleiche Argumente, gleiche Ausgabe.
// Inhalt der CSV: "kaputt" → Fehler wie vom Backend, "abbruch" → Seite mit Hinweis, sonst fertig.
import fs from "node:fs";

const DAUER_MS = 300;   // damit sich eine laufende Analyse beobachten lässt
const argumente = process.argv.slice(2);
const wert = (name) => argumente[argumente.indexOf(name) + 1];
const sende = (e) => process.stdout.write(JSON.stringify(e) + "\n");
const inhalt = fs.readFileSync(wert("--csv"), "utf8");

setTimeout(() => {
  if (inhalt.includes("kaputt")) {
    sende({ type: "error", message: "Im Notebook gibt es kein read_csv" });
    process.exit(1);
  }
  fs.writeFileSync(wert("--out"), `<html><body>Analyse von ${inhalt.split("\n")[0]}</body></html>`);
  sende({ type: "finished", out: wert("--out"), error: inhalt.includes("abbruch") ? "KeyError: 'Emg_5'" : null });
}, DAUER_MS);
