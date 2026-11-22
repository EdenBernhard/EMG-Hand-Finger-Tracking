// Kleine Hilfen für Anfragen und Antworten mit node:http.
import fs from "node:fs";

export class HttpFehler extends Error {
  constructor(status, meldung) {
    super(meldung);
    this.status = status;
  }
}

export function sendeJson(res, status, daten) {
  const body = JSON.stringify(daten);
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Content-Length": Buffer.byteLength(body) });
  res.end(body);
}

export function sendeLeer(res, status = 204) {
  res.writeHead(status);
  res.end();
}

// Schreibt den Rumpf der Anfrage unverändert in eine Datei (für große Uploads, ohne Base64)
export function speichereRumpf(req, datei, maxBytes) {
  return new Promise((ok, fehler) => {
    const ziel = fs.createWriteStream(datei);
    let groesse = 0;
    let abgebrochen = false;
    const abbruch = (e) => {
      if (abgebrochen) return;
      abgebrochen = true;
      req.unpipe(ziel);
      ziel.destroy();
      req.resume();   // Rest verwerfen, damit die Antwort noch ankommt
      fehler(e);
    };
    req.on("data", (stueck) => {
      groesse += stueck.length;
      if (groesse > maxBytes) abbruch(new HttpFehler(413, "Die Datei ist zu groß."));
    });
    req.on("error", abbruch);
    ziel.on("error", abbruch);
    ziel.on("finish", () => {
      if (!abgebrochen) groesse ? ok(groesse) : fehler(new HttpFehler(400, "Die Datei ist leer."));
    });
    req.pipe(ziel);
  });
}

export function leseJson(req, maxBytes) {
  return new Promise((ok, fehler) => {
    const teile = [];
    let groesse = 0;
    req.on("data", (stueck) => {
      groesse += stueck.length;
      if (groesse > maxBytes) {
        fehler(new HttpFehler(413, "Die Datei ist zu groß."));
        req.destroy();
        return;
      }
      teile.push(stueck);
    });
    req.on("end", () => {
      if (groesse === 0) return ok({});
      try {
        ok(JSON.parse(Buffer.concat(teile).toString("utf8")));
      } catch {
        fehler(new HttpFehler(400, "Ungültige Anfrage."));
      }
    });
    req.on("error", fehler);
  });
}
