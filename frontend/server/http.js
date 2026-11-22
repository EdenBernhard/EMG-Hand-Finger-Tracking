// Kleine Hilfen für Anfragen und Antworten mit node:http.

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
