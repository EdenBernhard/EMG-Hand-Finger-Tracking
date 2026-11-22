// Startpunkt: node server/server.js  (oder npm start)
import http from "node:http";
import { KONFIGURATION } from "./konfiguration.js";
import { ProbandenSpeicher } from "./probandenSpeicher.js";
import { MessungSteuerung } from "./messungSteuerung.js";
import { erstelleRouter } from "./routen.js";
import { neueAufnahme } from "../public/js/modell/aufnahmen.js";

const speicher = new ProbandenSpeicher(KONFIGURATION.datenOrdner);
const steuerung = new MessungSteuerung(KONFIGURATION.messung,
  (probandId, ereignis, plan, kontext) => speicher.ergaenzeAufnahme(probandId, neueAufnahme(ereignis, plan, kontext)));
const server = http.createServer(erstelleRouter(speicher, steuerung, KONFIGURATION));

server.listen(KONFIGURATION.port, () => {
  console.log(`Elektroden-Platzierung läuft auf http://localhost:${KONFIGURATION.port}`);
  console.log(`Probanden-Daten: ${KONFIGURATION.datenOrdner}`);
  console.log(`Messungen: ${KONFIGURATION.messung.programm} ${KONFIGURATION.messung.argumente.join(" ")} ` +
    `(in ${KONFIGURATION.messung.arbeitsordner})`);
});
