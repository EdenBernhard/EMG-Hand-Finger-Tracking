// Liefert Dateien aus einem Ordner aus (HTML, JS, CSS, Bilder) – ohne Pfade außerhalb davon.
import fs from "node:fs/promises";
import path from "node:path";
import { HttpFehler } from "./http.js";

const TYPEN = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
};

export async function sendeDatei(res, datei, { cache = false } = {}) {
  let inhalt;
  try {
    inhalt = await fs.readFile(datei);
  } catch {
    throw new HttpFehler(404, "Nicht gefunden.");
  }
  res.writeHead(200, {
    "Content-Type": TYPEN[path.extname(datei).toLowerCase()] || "application/octet-stream",
    "Cache-Control": cache ? "max-age=3600" : "no-cache",
  });
  res.end(inhalt);
}

export function dateiImOrdner(ordner, urlPfad) {
  let relativ;
  try {
    relativ = decodeURIComponent(urlPfad === "/" ? "/index.html" : urlPfad);
  } catch {
    throw new HttpFehler(404, "Nicht gefunden.");
  }
  const ziel = path.resolve(ordner, "." + relativ);
  if (ziel !== ordner && !ziel.startsWith(ordner + path.sep)) throw new HttpFehler(404, "Nicht gefunden.");
  return ziel;
}
