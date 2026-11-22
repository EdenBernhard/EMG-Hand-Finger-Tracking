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
  publicOrdner: path.join(FRONTEND_ROOT, "public"),
  maxAnfrageBytes: 20 * 1024 * 1024,   // Fotos kommen als Base64, im Browser auf 1600 px verkleinert
  messung: {
    programm: python,
    argumente: ["-m", "emg_tracking.acquisition.measurement.cli"],
    arbeitsordner: BACKEND_ROOT,
  },
};
