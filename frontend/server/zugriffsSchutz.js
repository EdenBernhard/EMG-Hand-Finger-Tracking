// Entscheidet, wer was abrufen darf. Der Server lauscht im ganzen Netz (für das Handy), aber nur der
// Laptop selbst sieht Probanden, Namen, Fotos und Messungen. Aus dem Netz gibt es nur die Handy-Seite
// und ihre API, die über ein Token läuft.
const LOKALE_ADRESSEN = new Set(["127.0.0.1", "::1", "::ffff:127.0.0.1"]);

// alles, was handy.html lädt (Imports von js/handy.js eingeschlossen)
const HANDY_DATEIEN = new Set(["/handy.html", "/style.css", "/js/handy.js", "/js/zeichnen/bilder.js",
  "/js/modell/fotoAnleitung.js"]);
const HANDY_API = /^\/api\/handy\//;

export const istLokal = (req) => LOKALE_ADRESSEN.has(req.socket.remoteAddress);

export function istErlaubt(req) {
  if (istLokal(req)) return true;
  const pfad = new URL(req.url, "http://x").pathname;
  return HANDY_DATEIEN.has(pfad) || HANDY_API.test(pfad);
}
