// Importiert eine hochgeladene C3D-Datei (EMG and Motion Tools): speichert den Upload in einer
// temporären Datei und lässt ihn vom Backend (emg_tracking.acquisition.c3d_import.cli) in CSV
// umwandeln und beim Probanden ablegen. Der Server liest die C3D-Datei selbst nicht.
import crypto from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { HttpFehler, speichereRumpf } from "./http.js";
import { fuehrePythonAus } from "./pythonAufruf.js";

const DATEI_MUSTER = /^[^\\/:*?"<>|\x00-\x1f]{1,120}\.c3d$/i;

export function pruefeDateiname(name) {
  const n = String(name || "").trim();
  if (!DATEI_MUSTER.test(n)) throw new HttpFehler(400, "Bitte eine .c3d-Datei hochladen.");
  return n;
}

export class C3dImport {
  // befehl: { programm, argumente, arbeitsordner, maxBytes, zeitlimitMs }
  constructor(befehl, tempOrdner = os.tmpdir()) {
    this.befehl = befehl;
    this.tempOrdner = tempOrdner;
  }

  // Gibt das Ergebnis des Backends zurück: { recording, samples, duration_s, sampling_rate_hz, channels }
  async importiere(req, probandId, dateiName, kontext) {
    // Endung .c3d ist Pflicht: ezc3d öffnet andere Dateinamen nicht
    const temp = path.join(this.tempOrdner, `emg-import-${crypto.randomBytes(6).toString("hex")}.c3d`);
    try {
      await speichereRumpf(req, temp, this.befehl.maxBytes);
      return await fuehrePythonAus(this.befehl,
        ["--subject", probandId, "--name", dateiName, "--context", JSON.stringify(kontext), temp]);
    } finally {
      await fs.rm(temp, { force: true });
    }
  }
}
