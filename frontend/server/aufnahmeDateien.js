// Findet die Dateien einer Aufnahme im Ordner des Probanden. Das Backend legt sie je Elektroden-Platzierung
// in einen Unterordner (<platzierung>_<id>/ bzw. ohne_platzierung/); ältere liegen direkt im Probanden-Ordner.
import fs from "node:fs/promises";
import path from "node:path";
import { HttpFehler } from "./http.js";

const NAME_MUSTER = /^[A-Za-z0-9_-]{1,80}$/;   // wie in public/js/modell/aufnahmen.js
const CSV_ENDUNG = ".csv";
export const ANALYSE_ENDUNG = ".analyse.html";

async function ordnerMitUnterordnern(probandOrdner) {
  const eintraege = await fs.readdir(probandOrdner, { withFileTypes: true }).catch(() => []);
  return [probandOrdner, ...eintraege.filter((e) => e.isDirectory()).map((e) => path.join(probandOrdner, e.name))];
}

// { csv, analyse } mit vollständigen Pfaden; 404, wenn die Rohdaten fehlen
export async function findeAufnahme(probandOrdner, name) {
  if (!NAME_MUSTER.test(name)) throw new HttpFehler(404, "Aufnahme nicht gefunden.");
  for (const ordner of await ordnerMitUnterordnern(probandOrdner)) {
    const csv = path.join(ordner, name + CSV_ENDUNG);
    if (await fs.stat(csv).then((s) => s.isFile(), () => false)) {
      return { csv, analyse: path.join(ordner, name + ANALYSE_ENDUNG) };
    }
  }
  throw new HttpFehler(404, "Rohdaten der Aufnahme nicht gefunden.");
}

// Namen aller Aufnahmen, für die schon eine Analyse-Seite existiert
export async function vorhandeneAnalysen(probandOrdner) {
  const namen = [];
  for (const ordner of await ordnerMitUnterordnern(probandOrdner)) {
    for (const datei of await fs.readdir(ordner).catch(() => [])) {
      if (datei.endsWith(ANALYSE_ENDUNG)) namen.push(datei.slice(0, -ANALYSE_ENDUNG.length));
    }
  }
  return namen;
}
