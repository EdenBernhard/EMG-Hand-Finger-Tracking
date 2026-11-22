// Ordnet Anfragen den Aktionen zu: REST-API für Probanden, Fotos, Messungen und die Webseite selbst.
import { HttpFehler, sendeJson, sendeLeer, leseJson } from "./http.js";
import { sendeDatei, dateiImOrdner } from "./statischeDateien.js";
import { sendeEreignisStrom } from "./ereignisStrom.js";
import { erstelleAuftrag, aufnahmeKontext } from "./messungsAuftrag.js";
import { pruefeDateiname } from "./c3dImport.js";
import { neueImportAufnahme } from "../public/js/modell/aufnahmen.js";

// c3dImport: C3dImport-Instanz; fehlt sie, gibt es keinen Import (404)
export function erstelleRouter(speicher, steuerung, { publicOrdner, maxAnfrageBytes, c3dImport }) {
  const body = (req) => leseJson(req, maxAnfrageBytes);

  // [Methode, Muster, Aktion(req, res, ...Parameter)]
  const routen = [
    ["GET", /^\/api\/probanden$/, async (req, res) => sendeJson(res, 200, await speicher.liste())],
    ["POST", /^\/api\/probanden$/, async (req, res) => sendeJson(res, 201, await speicher.legeAn((await body(req)).name))],
    ["GET", /^\/api\/probanden\/([^/]+)$/, async (req, res, id) => sendeJson(res, 200, await speicher.lade(id))],
    ["PUT", /^\/api\/probanden\/([^/]+)$/, async (req, res, id) => sendeJson(res, 200, await speicher.aktualisiere(id, await body(req)))],
    ["DELETE", /^\/api\/probanden\/([^/]+)$/, async (req, res, id) => { await speicher.loesche(id); sendeLeer(res); }],
    ["POST", /^\/api\/probanden\/([^/]+)\/bild\/([^/]+)$/,
      async (req, res, id, seite) => sendeJson(res, 200, await speicher.speichereBild(id, seite, await body(req)))],
    ["POST", /^\/api\/probanden\/([^/]+)\/messung$/, async (req, res, id) => {
      const { plan, kontext } = erstelleAuftrag(await speicher.lade(id), await body(req));   // 404/400 vor dem Start
      sendeJson(res, 202, steuerung.starte(id, plan, kontext));
    }],
    // Rumpf: die C3D-Datei als Rohdaten; ?datei=<Originalname>&platzierungId=&notiz=
    ["POST", /^\/api\/probanden\/([^/]+)\/import-c3d$/, async (req, res, id) => {
      if (!c3dImport) throw new HttpFehler(404, "Nicht gefunden.");
      const frage = new URL(req.url, "http://x").searchParams;
      const datei = pruefeDateiname(frage.get("datei"));
      const kontext = aufnahmeKontext(await speicher.lade(id),   // 404/400 vor dem Upload
        { platzierungId: frage.get("platzierungId"), notiz: frage.get("notiz") });
      const ergebnis = await c3dImport.importiere(req, id, datei, kontext);
      const aufnahme = neueImportAufnahme(ergebnis, datei, kontext);
      await speicher.ergaenzeAufnahme(id, aufnahme);
      sendeJson(res, 201, aufnahme);
    }],
    ["GET", /^\/api\/messung$/, async (req, res) => sendeJson(res, 200, steuerung.zustand)],
    ["POST", /^\/api\/messung\/fortsetzen$/, async (req, res) => { steuerung.setzeFort(); sendeLeer(res, 202); }],
    ["POST", /^\/api\/messung\/stopp$/, async (req, res) => { steuerung.stoppe(); sendeLeer(res, 202); }],
    ["GET", /^\/api\/messung\/ereignisse$/, async (req, res) => sendeEreignisStrom(req, res, steuerung)],
    ["GET", /^\/bilder\/([^/]+)\/([^/]+)$/, async (req, res, id, datei) => sendeDatei(res, speicher.bildPfad(id, datei))],
    ["GET", /^\/.*$/, async (req, res) => sendeDatei(res, dateiImOrdner(publicOrdner, new URL(req.url, "http://x").pathname))],
  ];

  return async function behandle(req, res) {
    const pfad = new URL(req.url, "http://x").pathname;
    try {
      for (const [methode, muster, aktion] of routen) {
        const treffer = req.method === methode && muster.exec(pfad);
        if (treffer) return await aktion(req, res, ...treffer.slice(1));
      }
      throw new HttpFehler(404, "Nicht gefunden.");
    } catch (e) {
      if (!(e instanceof HttpFehler)) console.error(e);
      req.resume();   // ungelesenen Upload verwerfen, sonst erreicht die Fehlermeldung den Browser nicht
      if (!res.headersSent) sendeJson(res, e.status || 500, { fehler: e.status ? e.message : "Interner Fehler." });
    }
  };
}
