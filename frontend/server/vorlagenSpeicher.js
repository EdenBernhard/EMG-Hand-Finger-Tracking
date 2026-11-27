// Dateibasierte Ablage der eigenen Messplan-Vorlagen (für alle Probanden gleich) in einer JSON-Datei.
// Die Standard-Messpläne stehen im Code (modell/messplanVorlagen.js) und werden nie gespeichert.
// Schreibzugriffe laufen nacheinander und atomar.
import fs from "node:fs/promises";
import path from "node:path";
import { HttpFehler } from "./http.js";
import {
  STANDARD_VORLAGEN, istStandardName, bereinigeEigeneVorlagen, mitVorlage, MAX_EIGENE_VORLAGEN,
} from "../public/js/modell/messplanVorlagen.js";

export class VorlagenSpeicher {
  #reihe = Promise.resolve();

  constructor(datei) {
    this.datei = datei;
  }

  #exklusiv(fn) {
    const jetzt = this.#reihe.catch(() => {}).then(fn);
    this.#reihe = jetzt;
    return jetzt;
  }

  async #eigene() {
    try {
      return bereinigeEigeneVorlagen(JSON.parse(await fs.readFile(this.datei, "utf8")));
    } catch (e) {
      if (e.code === "ENOENT") return [];
      throw e;
    }
  }

  async #schreibe(eigene) {
    await fs.mkdir(path.dirname(this.datei), { recursive: true });
    await fs.writeFile(this.datei + ".tmp", JSON.stringify(eigene, null, 2));
    await fs.rename(this.datei + ".tmp", this.datei);
    return eigene;
  }

  // Standard-Messpläne zuerst, dann die eigenen
  async liste() {
    return [...STANDARD_VORLAGEN, ...(await this.#eigene())];
  }

  // messplan: { name, bewegungen, intervallS, ... }; eine gleichnamige eigene Vorlage wird ersetzt
  speichere(messplan) {
    return this.#exklusiv(async () => {
      const name = String(messplan?.name || "").trim();
      if (!name) throw new HttpFehler(400, "Bitte einen Namen für die Vorlage angeben.");
      if (istStandardName(name)) throw new HttpFehler(400, `„${name}“ ist ein Standard-Messplan. Bitte einen anderen Namen wählen.`);
      const eigene = await this.#eigene();
      const ersetzt = eigene.some((v) => v.name === name);
      if (!ersetzt && eigene.length >= MAX_EIGENE_VORLAGEN) {
        throw new HttpFehler(400, `Höchstens ${MAX_EIGENE_VORLAGEN} eigene Vorlagen.`);
      }
      const neu = mitVorlage(eigene, messplan);
      if (!neu.find((v) => v.name === name)?.bewegungen.length) {
        throw new HttpFehler(400, "Bitte mindestens eine Bewegung angeben.");
      }
      await this.#schreibe(neu);
      return this.liste();
    });
  }

  loesche(id) {
    return this.#exklusiv(async () => {
      const eigene = await this.#eigene();
      if (!eigene.some((v) => v.id === id)) throw new HttpFehler(404, "Vorlage nicht gefunden.");
      await this.#schreibe(eigene.filter((v) => v.id !== id));
      return this.liste();
    });
  }
}
