// Der gerade geöffnete Proband und das automatische Speichern seiner Änderungen.
import { api } from "./api.js";

const VERZOEGERUNG_MS = 400;
const FELDER = ["name", "arm", "notiz", "mass", "innen", "oben", "platzierungen", "messplaene"];   // aufnahmen schreibt nur der Server

let proband = null;
let timer = null;

export const sitzung = {
  get proband() {
    return proband;
  },

  async oeffne(id) {
    if (proband && proband.id === id) return proband;
    await this.speichereJetzt();
    proband = await api.lade(id);
    return proband;
  },

  setze(neuerProband) {
    proband = neuerProband;
  },

  async schliesse() {
    await this.speichereJetzt();
    proband = null;
  },

  speichereSpaeter() {
    clearTimeout(timer);
    timer = setTimeout(() => this.speichereJetzt(), VERZOEGERUNG_MS);
  },

  async speichereJetzt() {
    clearTimeout(timer);
    if (!proband) return;
    const daten = Object.fromEntries(FELDER.map((k) => [k, proband[k]]));
    const antwort = await api.speichere(proband.id, daten);
    // Nur den Zeitstempel übernehmen: offene Ansichten halten Referenzen auf proband.innen/oben
    if (proband && proband.id === antwort.id) proband.geaendert = antwort.geaendert;
  },
};
