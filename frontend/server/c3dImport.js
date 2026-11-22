// Importiert eine hochgeladene C3D-Datei (EMG and Motion Tools): speichert den Upload in einer
// temporären Datei und lässt ihn vom Backend (emg_tracking.acquisition.c3d_import.cli) in CSV
// umwandeln und beim Probanden ablegen. Der Server liest die C3D-Datei selbst nicht.
import { spawn } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { HttpFehler, speichereRumpf } from "./http.js";

const DATEI_MUSTER = /^[^\\/:*?"<>|\x00-\x1f]{1,120}\.c3d$/i;
const STDERR_ZEILEN = 5;   // so viele letzte Zeilen erscheinen in der Fehlermeldung

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
      return await this.#konvertiere(temp, probandId, dateiName, kontext);
    } finally {
      await fs.rm(temp, { force: true });
    }
  }

  #konvertiere(datei, probandId, dateiName, kontext) {
    const { programm, argumente, arbeitsordner, zeitlimitMs } = this.befehl;
    return new Promise((ok, fehler) => {
      const prozess = spawn(programm,
        [...argumente, "--subject", probandId, "--name", dateiName, "--context", JSON.stringify(kontext), datei],
        { cwd: arbeitsordner, env: { ...process.env, PYTHONIOENCODING: "utf-8" }, windowsHide: true });
      let stdout = "";
      let stderr = [];
      const timer = setTimeout(() => prozess.kill(), zeitlimitMs);
      prozess.stdout.on("data", (d) => { stdout += d; });
      prozess.stderr.on("data", (d) => { stderr = [...stderr, ...String(d).split(/\r?\n/).filter(Boolean)].slice(-STDERR_ZEILEN); });
      prozess.on("error", (e) => {
        clearTimeout(timer);
        fehler(new HttpFehler(500, `Python ließ sich nicht starten: ${e.message}`));
      });
      prozess.on("close", (code) => {
        clearTimeout(timer);
        const ergebnis = stdout.split(/\r?\n/).map((z) => { try { return JSON.parse(z); } catch { return null; } })
          .find((e) => e && (e.type === "finished" || e.type === "error"));
        if (ergebnis?.type === "finished") return ok(ergebnis);
        fehler(new HttpFehler(422, ergebnis?.message
          || `Die Konvertierung endete unerwartet (Code ${code}). ${stderr.join(" ")}`.trim()));
      });
    });
  }
}
