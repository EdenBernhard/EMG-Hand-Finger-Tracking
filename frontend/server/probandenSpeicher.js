// Dateibasierte Ablage: je Proband ein Ordner mit proband.json und den zwei Fotos.
// Schreibzugriffe auf denselben Probanden laufen nacheinander (Webseite und Messung speichern beide).
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { HttpFehler } from "./http.js";
import { normalisiere, neuePlatzierung } from "../public/js/modell/platzierungen.js";
import { normalisiereMessplaene } from "../public/js/modell/messplaene.js";
import { bereinigeAufnahmen } from "../public/js/modell/aufnahmen.js";

const ID_MUSTER = /^[a-f0-9]{12}$/;
const SEITEN = ["innen", "oben"];
const BILD_MUSTER = /^(innen|oben)\.(jpg|png)$/;
const DATA_URL_MUSTER = /^data:image\/(jpeg|png);base64,([A-Za-z0-9+/=]+)$/;
const FELDER = ["name", "arm", "notiz", "mass", "platzierungen", "messplaene"];   // aufnahmen nur über ergaenzeAufnahme
const MAX_NAME = 80;

function vervollstaendige(p) {
  normalisiere(p);
  normalisiereMessplaene(p);
  p.aufnahmen = bereinigeAufnahmen(p.aufnahmen);
  return p;
}

export class ProbandenSpeicher {
  #reihe = new Map();

  constructor(ordner) {
    this.ordner = ordner;
  }

  // Führt fn erst aus, wenn alle vorherigen Schreibzugriffe auf diesen Probanden fertig sind
  #exklusiv(id, fn) {
    const jetzt = (this.#reihe.get(id) || Promise.resolve()).catch(() => {}).then(fn);
    this.#reihe.set(id, jetzt);
    return jetzt;
  }

  #pfad(id, datei = "proband.json") {
    if (!ID_MUSTER.test(id)) throw new HttpFehler(404, "Proband nicht gefunden.");
    return path.join(this.ordner, id, datei);
  }

  async liste() {
    await fs.mkdir(this.ordner, { recursive: true });
    const ids = (await fs.readdir(this.ordner)).filter((d) => ID_MUSTER.test(d));
    const alle = await Promise.all(ids.map((id) => this.lade(id).catch(() => null)));
    return alle.filter(Boolean).sort((a, b) => (b.geaendert || "").localeCompare(a.geaendert || ""));
  }

  async lade(id) {
    try {
      return vervollstaendige(JSON.parse(await fs.readFile(this.#pfad(id), "utf8")));
    } catch (e) {
      if (e instanceof HttpFehler) throw e;
      throw new HttpFehler(404, "Proband nicht gefunden.");
    }
  }

  async #speichere(p) {
    vervollstaendige(p);
    p.geaendert = new Date().toISOString();
    const datei = this.#pfad(p.id);
    await fs.mkdir(path.dirname(datei), { recursive: true });
    await fs.writeFile(datei + ".tmp", JSON.stringify(p, null, 2));
    await fs.rename(datei + ".tmp", datei);   // atomar: nie halb geschriebene Dateien
    return p;
  }

  async legeAn(name) {
    const n = String(name || "").trim().slice(0, MAX_NAME);
    if (!n) throw new HttpFehler(400, "Bitte einen Namen oder ein Kürzel angeben.");
    return this.#speichere({
      id: crypto.randomBytes(6).toString("hex"), name: n, arm: "rechts",
      mass: {}, innen: {}, oben: {}, platzierungen: [neuePlatzierung()], erstellt: new Date().toISOString(),
    });
  }

  // Übernimmt nur bekannte Felder; Bilddateien setzt ausschließlich speichereBild
  aktualisiere(id, eingabe) {
    return this.#exklusiv(id, async () => {
      const p = await this.lade(id);
      for (const k of FELDER) {
        if (!(k in eingabe)) continue;
        if ((k === "platzierungen" || k === "messplaene") && !Array.isArray(eingabe[k])) continue; // nie versehentlich alle verlieren
        p[k] = eingabe[k];
      }
      for (const s of SEITEN) {
        // Punkte gehören zu genau einem Foto: Wurde es inzwischen ersetzt (z. B. vom Handy), sind sie veraltet
        const aktuell = eingabe[s]?.version === p[s]?.version;
        if (eingabe[s] && typeof eingabe[s].punkte === "object" && aktuell) p[s] = { ...p[s], punkte: eingabe[s].punkte };
      }
      return this.#speichere(p);
    });
  }

  ergaenzeAufnahme(id, aufnahme) {
    return this.#exklusiv(id, async () => {
      const p = await this.lade(id);
      p.aufnahmen.push(aufnahme);
      return this.#speichere(p);
    });
  }

  // Entfernt den Eintrag einer Aufnahme (die Dateien löscht aufnahmeDateien.js); 404, wenn es ihn nicht gibt
  entferneAufnahme(id, name) {
    return this.#exklusiv(id, async () => {
      const p = await this.lade(id);
      if (!p.aufnahmen.some((a) => a.name === name)) throw new HttpFehler(404, "Aufnahme nicht gefunden.");
      p.aufnahmen = p.aufnahmen.filter((a) => a.name !== name);
      return this.#speichere(p);
    });
  }

  loesche(id) {
    return this.#exklusiv(id, async () => {
      await this.lade(id);
      await fs.rm(path.dirname(this.#pfad(id)), { recursive: true, force: true });
    });
  }

  speichereBild(id, seite, { dataUrl, breite, hoehe }) {
    return this.#exklusiv(id, async () => {
      if (!SEITEN.includes(seite)) throw new HttpFehler(400, "Unbekannte Seite.");
      const m = DATA_URL_MUSTER.exec(dataUrl || "");
      if (!m) throw new HttpFehler(400, "Bitte ein JPG- oder PNG-Foto hochladen.");
      const p = await this.lade(id);
      const datei = `${seite}.${m[1] === "png" ? "png" : "jpg"}`;
      for (const alt of ["jpg", "png"]) await fs.rm(this.#pfad(id, `${seite}.${alt}`), { force: true });
      await fs.writeFile(this.#pfad(id, datei), Buffer.from(m[2], "base64"));
      p[seite] = { bild: datei, version: Date.now(), breite, hoehe, punkte: {} };
      return this.#speichere(p);
    });
  }

  // Ordner des Probanden (dort und in den Platzierungs-Unterordnern liegen die Messungen des Backends)
  ordnerVon(id) {
    return path.dirname(this.#pfad(id));
  }

  bildPfad(id, datei) {
    if (!BILD_MUSTER.test(datei)) throw new HttpFehler(404, "Bild nicht gefunden.");
    return this.#pfad(id, datei);
  }
}
