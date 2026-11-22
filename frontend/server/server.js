// Startpunkt: node server/server.js  (oder npm start)
import http from "node:http";
import { KONFIGURATION } from "./konfiguration.js";
import { ProbandenSpeicher } from "./probandenSpeicher.js";
import { MessungSteuerung } from "./messungSteuerung.js";
import { erstelleRouter } from "./routen.js";
import { C3dImport } from "./c3dImport.js";
import { HandyZugang } from "./handyZugang.js";
import { lanAdressen } from "./netzAdressen.js";
import { neueAufnahme } from "../public/js/modell/aufnahmen.js";

const speicher = new ProbandenSpeicher(KONFIGURATION.datenOrdner);
const steuerung = new MessungSteuerung(KONFIGURATION.messung,
  (probandId, ereignis, plan, kontext) => speicher.ergaenzeAufnahme(probandId, neueAufnahme(ereignis, plan, kontext)));
const c3dImport = new C3dImport(KONFIGURATION.c3dImport);
const handyZugang = new HandyZugang(KONFIGURATION.handy.gueltigMin);
const server = http.createServer(erstelleRouter(speicher, steuerung, { ...KONFIGURATION, c3dImport, handyZugang }));

server.listen(KONFIGURATION.port, () => {
  console.log(`Elektroden-Platzierung läuft auf http://localhost:${KONFIGURATION.port}`);
  console.log(`Probanden-Daten: ${KONFIGURATION.datenOrdner}`);
  console.log(`Messungen: ${KONFIGURATION.messung.programm} ${KONFIGURATION.messung.argumente.join(" ")} ` +
    `(in ${KONFIGURATION.messung.arbeitsordner})`);
  const lan = lanAdressen();
  console.log(lan.length
    ? `Im WLAN (nur Handy-Seite für Fotos): ${lan.map((ip) => `http://${ip}:${KONFIGURATION.port}`).join(", ")}`
    : "Keine WLAN-Adresse gefunden: Fotos vom Handy gehen erst, wenn der Laptop im WLAN ist.");
});
