// Ersatz für den Python-Konverter (emg_tracking.acquisition.c3d_import.cli) in den Tests: gleiche
// Argumente, gleiche Ausgabe. Inhalt "kaputt" in der Datei ergibt eine Fehlermeldung wie vom Backend.
import fs from "node:fs";

const argumente = process.argv.slice(2);
const wert = (name) => argumente[argumente.indexOf(name) + 1];
const datei = argumente.at(-1);
const sende = (e) => process.stdout.write(JSON.stringify(e) + "\n");

process.stderr.write("eine Meldung\n");
if (fs.readFileSync(datei, "utf8").includes("kaputt")) {
  sende({ type: "error", message: "Die C3D-Datei enthält keine Analogkanäle (EMG)." });
  process.exit(1);
}
sende({ type: "finished", recording: `2026-11-22_12-00-00_${wert("--subject")}`, samples: 4000, duration_s: 2,
  sampling_rate_hz: 2000, channels: ["EMG 5", "EMG 6"], kontext: JSON.parse(wert("--context")), name: wert("--name") });
