// Startet die Analyse einer Aufnahme als Python-Prozess (backend, emg_tracking.analysis.cli: führt das Notebook
// aus Datenaufbereitung/ unverändert aus) und merkt sich ihren Zustand. Es läuft höchstens eine Analyse
// gleichzeitig, weil das Notebook den Rechner für einige Zeit auslastet.
import fs from "node:fs/promises";
import { HttpFehler } from "./http.js";
import { fuehrePythonAus } from "./pythonAufruf.js";

export const STATUS = { keine: "keine", laeuft: "laeuft", fertig: "fertig", fehler: "fehler" };

const schluessel = (probandId, name) => `${probandId}/${name}`;

export class AnalyseSteuerung {
  #laufend = null;          // Schlüssel der laufenden Analyse
  #ergebnisse = new Map();  // Schlüssel → { status, fehler, hinweis } der zuletzt beendeten Analyse

  // befehl: { programm, argumente, arbeitsordner, zeitlimitMs }
  constructor(befehl) {
    this.befehl = befehl;
  }

  // dateien: { csv, analyse } aus findeAufnahme()
  async zustand(probandId, name, dateien) {
    const key = schluessel(probandId, name);
    if (this.#laufend === key) return { status: STATUS.laeuft };
    const vorhanden = await fs.stat(dateien.analyse).then(() => true, () => false);
    const letztes = this.#ergebnisse.get(key);
    if (letztes?.status === STATUS.fehler) return letztes;
    return vorhanden ? { status: STATUS.fertig, hinweis: letztes?.hinweis ?? null } : { status: STATUS.keine };
  }

  laeuftFuer(probandId, name) {
    return this.#laufend === schluessel(probandId, name);
  }

  starte(probandId, name, dateien) {
    const key = schluessel(probandId, name);
    if (this.#laufend === key) return { status: STATUS.laeuft };
    if (this.#laufend) throw new HttpFehler(409, "Es läuft bereits eine Analyse. Bitte kurz warten.");
    this.#laufend = key;
    this.#ergebnisse.delete(key);
    fuehrePythonAus(this.befehl, ["--csv", dateien.csv, "--out", dateien.analyse])
      // hinweis: das Notebook lief durch, aber eine Zelle brach ab (die Seite zeigt alles bis dahin)
      .then((e) => this.#ergebnisse.set(key, { status: STATUS.fertig, hinweis: e.error || null }))
      .catch((e) => this.#ergebnisse.set(key, { status: STATUS.fehler, fehler: e.message }))
      .finally(() => { this.#laufend = null; });
    return { status: STATUS.laeuft };
  }
}
