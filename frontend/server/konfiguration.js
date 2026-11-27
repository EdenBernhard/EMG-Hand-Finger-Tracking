// Einstellungen des Servers; per Umgebungsvariable überschreibbar.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const FRONTEND_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const REPO_ROOT = path.resolve(FRONTEND_ROOT, "..");
const BACKEND_ROOT = path.join(REPO_ROOT, "backend");
const VENV_PYTHON = path.join(BACKEND_ROOT, ".venv", "Scripts", "python.exe");

// PYTHON gesetzt > virtuelle Umgebung im Backend > python aus dem PATH
const python = process.env.PYTHON || (fs.existsSync(VENV_PYTHON) ? VENV_PYTHON : "python");

export const KONFIGURATION = {
  port: Number(process.env.PORT) || 3000,
  // Gemeinsam mit dem Backend (subjects_dir in backend/config/acquisition.toml): dort landen auch die Messungen
  datenOrdner: path.resolve(process.env.DATA_DIR || path.join(REPO_ROOT, "data", "probanden")),
  // Eigene Messplan-Vorlagen, für alle Probanden gleich (die Standard-Messpläne stehen im Code)
  vorlagenDatei: path.resolve(process.env.VORLAGEN_DATEI || path.join(REPO_ROOT, "data", "messplan_vorlagen.json")),
  publicOrdner: path.join(FRONTEND_ROOT, "public"),
  maxAnfrageBytes: 20 * 1024 * 1024,   // Fotos kommen als Base64, im Browser auf 1600 px verkleinert
  messung: {
    programm: python,
    argumente: ["-m", "emg_tracking.acquisition.measurement.cli"],
    arbeitsordner: BACKEND_ROOT,
  },
  // Analyse je Aufnahme: führt Datenaufbereitung/Clustering_ Analyse.ipynb mit der CSV aus (backend: pip install -e ".[analyse]")
  analyse: {
    programm: python,
    argumente: ["-m", "emg_tracking.analysis.cli"],
    arbeitsordner: BACKEND_ROOT,
    zeitlimitMs: 60 * 60_000,   // lange Aufnahmen (mehrere Minuten) brauchen im Notebook lange
  },
  // Fotos vom Handy: so lange gilt ein QR-Code bzw. Link
  handy: { gueltigMin: 30 },
  // C3D-Dateien aus EMG and Motion Tools: Upload als Rohdaten, Konvertierung in CSV durch das Backend
  c3dImport: {
    programm: python,
    argumente: ["-m", "emg_tracking.acquisition.c3d_import.cli"],
    arbeitsordner: BACKEND_ROOT,
    maxBytes: 1024 * 1024 * 1024,   // 1 GB; 16 Kanäle × 2000 Hz × 4 Byte sind rund 7,7 MB pro Minute
    zeitlimitMs: 5 * 60_000,
  },
};
