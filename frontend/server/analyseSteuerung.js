// Startet die Analyse einer Aufnahme als Python-Prozess (backend, emg_tracking.analysis.cli: führt das Notebook
// aus Datenaufbereitung/ unverändert aus) und merkt sich ihren Zustand. Beliebig viele Analysen lassen sich
// anstoßen; sie warten in einer Warteschlange, und höchstens `gleichzeitig` laufen auf einmal, weil jedes
// Notebook viel Arbeitsspeicher und Rechenzeit braucht.
import fs from "node:fs/promises";
import { fuehrePythonAus } from "./pythonAufruf.js";

export const STATUS = { keine: "keine", wartet: "wartet", laeuft: "laeuft", fertig: "fertig", fehler: "fehler" };
const STANDARD_GLEICHZEITIG = 1;

const schluessel = (probandId, name) => `${probandId}/${name}`;

export class AnalyseSteuerung {
  #laufend = new Set();     // Schlüssel der laufenden Analysen
  #warteschlange = [];      // [{ key, dateien }] in Startreihenfolge
  #ergebnisse = new Map();  // Schlüssel → { status, fehler, hinweis } der zuletzt beendeten Analyse

  // befehl: { programm, argumente, arbeitsordner, zeitlimitMs, gleichzeitig }
  constructor(befehl) {
    this.befehl = befehl;
    this.gleichzeitig = Math.max(1, Math.floor(befehl.gleichzeitig ?? STANDARD_GLEICHZEITIG));
  }

  // { status: "wartet", vorher } – vorher: so viele Analysen warten noch davor
  #wartend(key) {
    const vorher = this.#warteschlange.findIndex((a) => a.key === key);
    return vorher < 0 ? null : { status: STATUS.wartet, vorher };
  }

  // dateien: { csv, analyse } aus findeAufnahme()
  async zustand(probandId, name, dateien) {
    const key = schluessel(probandId, name);
    if (this.#laufend.has(key)) return { status: STATUS.laeuft };
    const wartend = this.#wartend(key);
    if (wartend) return wartend;
    const vorhanden = await fs.stat(dateien.analyse).then(() => true, () => false);
    const letztes = this.#ergebnisse.get(key);
    if (letztes?.status === STATUS.fehler) return letztes;
    return vorhanden ? { status: STATUS.fertig, hinweis: letztes?.hinweis ?? null } : { status: STATUS.keine };
  }

  // Läuft oder wartet die Analyse dieser Aufnahme (dann z. B. nicht löschen)?
  istAktiv(probandId, name) {
    const key = schluessel(probandId, name);
    return this.#laufend.has(key) || !!this.#wartend(key);
  }

  // Reiht die Analyse ein; ist sie schon aktiv, bleibt es bei der einen
  starte(probandId, name, dateien) {
    const key = schluessel(probandId, name);
    if (!this.istAktiv(probandId, name)) {
      this.#ergebnisse.delete(key);
      this.#warteschlange.push({ key, dateien });
      this.#starteNaechste();
    }
    return this.#laufend.has(key) ? { status: STATUS.laeuft } : this.#wartend(key);
  }

  #starteNaechste() {
    while (this.#laufend.size < this.gleichzeitig && this.#warteschlange.length) {
      const { key, dateien } = this.#warteschlange.shift();
      this.#laufend.add(key);
      fuehrePythonAus(this.befehl, ["--csv", dateien.csv, "--out", dateien.analyse])
        // hinweis: das Notebook lief durch, aber eine Zelle brach ab (die Seite zeigt alles bis dahin)
        .then((e) => this.#ergebnisse.set(key, { status: STATUS.fertig, hinweis: e.error || null }))
        .catch((e) => this.#ergebnisse.set(key, { status: STATUS.fehler, fehler: e.message }))
        .finally(() => {
          this.#laufend.delete(key);
          this.#starteNaechste();
        });
    }
  }
}
