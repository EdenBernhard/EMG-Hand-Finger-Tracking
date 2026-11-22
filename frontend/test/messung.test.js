// Prüft Start, Ereignisstrom, Stopp und Fehlerfälle einer Messung; Python ist durch testhilfen/fakeMessung.mjs ersetzt.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { ProbandenSpeicher } from "../server/probandenSpeicher.js";
import { MessungSteuerung } from "../server/messungSteuerung.js";
import { erstelleRouter } from "../server/routen.js";
import { neueAufnahme } from "../public/js/modell/aufnahmen.js";
import { bereinigeMessplan, dauerS, GRENZEN } from "../public/js/modell/messplan.js";

let server, basis, ordner, speicher;

before(async () => {
  ordner = await fs.mkdtemp(path.join(os.tmpdir(), "emg-messung-"));
  speicher = new ProbandenSpeicher(ordner);
  const steuerung = new MessungSteuerung(
    { programm: process.execPath, argumente: [path.resolve("testhilfen", "fakeMessung.mjs")], arbeitsordner: path.resolve(".") },
    (id, ereignis, plan, kontext) => speicher.ergaenzeAufnahme(id, neueAufnahme(ereignis, plan, kontext)));
  server = http.createServer(erstelleRouter(speicher, steuerung, { publicOrdner: path.resolve("public"), maxAnfrageBytes: 1024 * 1024 }));
  await new Promise((ok) => server.listen(0, ok));
  basis = `http://localhost:${server.address().port}`;
});

after(async () => {
  server.closeAllConnections();
  server.close();
  await fs.rm(ordner, { recursive: true, force: true });
});

const post = (pfad, daten) => fetch(basis + pfad, { method: "POST", body: daten && JSON.stringify(daten) });

// Liest den Ereignisstrom, bis „finished“ oder „error“ kommt; wartet ruft man auf, sobald der Strom steht
async function ereignisse(waehrenddessen) {
  const antwort = await fetch(`${basis}/api/messung/ereignisse`);
  const leser = antwort.body.getReader();
  const decoder = new TextDecoder();
  const liste = [];
  let rest = "";
  let gestartet = false;
  for (;;) {
    const { value, done } = await leser.read();
    if (done) break;
    rest += decoder.decode(value, { stream: true });
    const bloecke = rest.split("\n\n");
    rest = bloecke.pop();
    for (const b of bloecke.filter((x) => x.startsWith("data: "))) liste.push(JSON.parse(b.slice("data: ".length)));
    if (!gestartet && liste.length) {
      gestartet = true;
      await waehrenddessen();
    }
    if (liste.some((e) => e.type === "finished" || e.type === "error")) break;
  }
  await leser.cancel();
  return liste;
}

const neuerProband = async () => (await (await post("/api/probanden", { name: "P01" })).json()).id;
const put = async (id, daten) =>
  (await fetch(`${basis}/api/probanden/${id}`, { method: "PUT", body: JSON.stringify(daten) })).json();

// Proband mit zwei Messplänen; gibt { id, plaene, platzierung } zurück
async function probandMitPlaenen() {
  const id = await neuerProband();
  const p = await put(id, { messplaene: [
    { name: "Finger", bewegungen: ["Faust", { name: "Pinch", anzahl: 2 }], intervallS: 2, wiederholungen: 2, vorlaufS: 1 },
    { name: "Pinch 3×", bewegungen: [{ name: "Pinch", anzahl: 3 }], intervallS: 2, wiederholungen: 1, vorlaufS: 0 },
  ] });
  return { id, plaene: p.messplaene, platzierung: p.platzierungen[0] };
}

test("Messplan wird begrenzt und mit Standardwerten ergänzt", () => {
  const plan = bereinigeMessplan({ bewegungen: [" Faust ", "", { name: "Pinch", anzahl: 3 }, { name: "x", anzahl: 99 }],
    intervallS: 999, wiederholungen: "2.6" });
  assert.deepEqual(plan.bewegungen,
    [{ name: "Faust", anzahl: 1 }, { name: "Pinch", anzahl: 3 }, { name: "x", anzahl: GRENZEN.anzahl.max }],
    "alte Pläne (nur Namen) werden übernommen, Anzahl begrenzt");
  assert.equal(plan.intervallS, GRENZEN.intervallS.max);
  assert.equal(plan.wiederholungen, 3);
  assert.equal(plan.vorlaufS, GRENZEN.vorlaufS.standard);
  assert.equal(dauerS(plan), plan.vorlaufS + (1 + 3 + GRENZEN.anzahl.max) * 3 * plan.intervallS);
  assert.ok(bereinigeMessplan(undefined).bewegungen.length > 0, "ohne Angabe: Standardliste");
});

test("Messung läuft durch, Ereignisse kommen an, Aufnahme wird beim Probanden gespeichert", async () => {
  const { id, plaene, platzierung } = await probandMitPlaenen();
  process.env.FAKE_MODUS = "durchlauf";
  let start;
  const liste = await ereignisse(async () => {
    start = await post(`/api/probanden/${id}/messung`,
      { messplanId: plaene[0].id, platzierungId: platzierung.id, notiz: "Sitzung 2" });
  });
  assert.equal(start.status, 202);
  assert.deepEqual(liste.map((e) => e.type),
    ["state", "state", "checking_impedance", "impedance", "waiting_for_sensors", "recording",
      "cue", "cue", "cue", "cue", "cue", "cue", "finished"]);
  assert.equal(liste[0].laeuft, false);
  assert.equal(liste[1].probandId, id);
  assert.equal(liste[1].kontext.messplan.name, "Finger");
  assert.deepEqual(liste.filter((e) => e.type === "cue").map((e) => e.movement),
    ["Faust", "Pinch", "Pinch", "Faust", "Pinch", "Pinch"], "Anzahl je Bewegung kommt bei Python an");
  const echo = liste.find((e) => e.type === "recording").echo;
  assert.equal(echo.label, "Finger", "Name des Messplans geht als label an Python");
  assert.deepEqual(echo.context.platzierung, { id: platzierung.id, name: platzierung.name,
    variante: platzierung.variante, elektrodenAbstand: platzierung.elektrodenAbstand });
  assert.equal(echo.context.notiz, "Sitzung 2");

  const p = await (await fetch(`${basis}/api/probanden/${id}`)).json();
  assert.equal(p.aufnahmen.length, 1, "finished wird erst gemeldet, wenn die Aufnahme gespeichert ist");
  const a = p.aufnahmen[0];
  assert.equal(a.name, "2026-11-18_10-00-00_messung");
  assert.deepEqual(a.messplan, { id: plaene[0].id, name: "Finger" });
  assert.equal(a.platzierung.id, platzierung.id);
  assert.equal(a.notiz, "Sitzung 2");
  assert.deepEqual(a.impedanz, { bestanden: true, nichtBestanden: [], trotzdemGemessen: false });
  assert.deepEqual(a.plan.bewegungen, [{ name: "Faust", anzahl: 1 }, { name: "Pinch", anzahl: 2 }]);
  assert.equal((await (await fetch(`${basis}/api/messung`)).json()).laeuft, false);

  assert.equal((await put(id, { aufnahmen: [] })).aufnahmen.length, 1, "aufnahmen lassen sich per PUT nicht überschreiben");
});

test("Mehrere Messungen mit verschiedenen Messplänen, ohne Platzierung", async () => {
  const { id, plaene } = await probandMitPlaenen();
  process.env.FAKE_MODUS = "durchlauf";
  await ereignisse(() => post(`/api/probanden/${id}/messung`, { messplanId: plaene[0].id }));
  const liste = await ereignisse(() => post(`/api/probanden/${id}/messung`, { messplanId: plaene[1].id }));
  assert.deepEqual(liste.filter((e) => e.type === "cue").map((e) => e.movement), ["Pinch", "Pinch", "Pinch"]);
  const p = await speicher.lade(id);
  assert.deepEqual(p.aufnahmen.map((a) => a.messplan.name), ["Finger", "Pinch 3×"]);
  assert.equal(p.aufnahmen[1].platzierung, null);
});

test("Alter einzelner Messplan wird zum ersten Eintrag der Liste", async () => {
  const id = "0123456789ac";
  await fs.mkdir(path.join(ordner, id), { recursive: true });
  await fs.writeFile(path.join(ordner, id, "proband.json"),
    JSON.stringify({ id, name: "Alt", messplan: { bewegungen: ["Faust"], intervallS: 4 } }));
  const p = await speicher.lade(id);
  assert.equal(p.messplaene.length, 1);
  assert.equal(p.messplaene[0].name, "Messplan");
  assert.deepEqual(p.messplaene[0].bewegungen, [{ name: "Faust", anzahl: 1 }]);
  assert.equal(p.messplaene[0].intervallS, 4);
  assert.equal(p.messplan, undefined);
  assert.equal((await put(id, { messplaene: "kaputt" })).messplaene.length, 1, "ungültige Liste überschreibt nichts");
});

test("Stopp beendet die Messung; nur eine Messung gleichzeitig", async () => {
  const { id, plaene } = await probandMitPlaenen();
  process.env.FAKE_MODUS = "stopp";
  const liste = await ereignisse(async () => {
    assert.equal((await post(`/api/probanden/${id}/messung`, { messplanId: plaene[0].id })).status, 202);
    assert.equal((await post(`/api/probanden/${id}/messung`, { messplanId: plaene[1].id })).status, 409);
    assert.equal((await post("/api/messung/stopp")).status, 202);
  });
  const fertig = liste.at(-1);
  assert.equal(fertig.type, "finished");
  assert.equal(fertig.saved, false);
  assert.equal((await speicher.lade(id)).aufnahmen.length, 0);
  assert.equal((await post("/api/messung/stopp")).status, 409, "danach läuft keine Messung mehr");
});

test("Nicht bestandener Impedanz-Check wartet auf „Trotzdem messen“", async () => {
  const { id, plaene } = await probandMitPlaenen();
  process.env.FAKE_MODUS = "impedanz_fehler";
  assert.equal((await post("/api/messung/fortsetzen")).status, 409, "ohne Messung nichts fortzusetzen");
  let zustand;
  const liste = await ereignisse(async () => {
    await post(`/api/probanden/${id}/messung`, { messplanId: plaene[0].id });
    for (;;) {   // warten, bis Python das Ergebnis gemeldet hat
      zustand = await (await fetch(`${basis}/api/messung`)).json();
      if (zustand.phase === "impedanz_entscheidung") break;
      await new Promise((ok) => setTimeout(ok, 20));
    }
    assert.equal((await post("/api/messung/fortsetzen")).status, 202);
  });
  assert.deepEqual(zustand.impedanz.results.map((r) => r.passed), [true, false]);
  assert.ok(liste.some((e) => e.type === "cue"), "nach „Trotzdem messen“ läuft die Messung");
  const a = (await speicher.lade(id)).aufnahmen.at(-1);
  assert.deepEqual(a.impedanz, { bestanden: false, nichtBestanden: [2], trotzdemGemessen: true });
});

test("Abbrechen nach nicht bestandenem Impedanz-Check speichert nichts", async () => {
  const { id, plaene } = await probandMitPlaenen();
  process.env.FAKE_MODUS = "impedanz_fehler";
  const liste = await ereignisse(async () => {
    await post(`/api/probanden/${id}/messung`, { messplanId: plaene[0].id });
    while ((await (await fetch(`${basis}/api/messung`)).json()).phase !== "impedanz_entscheidung") {
      await new Promise((ok) => setTimeout(ok, 20));
    }
    assert.equal((await post("/api/messung/stopp")).status, 202);
  });
  assert.equal(liste.at(-1).saved, false);
  assert.equal((await speicher.lade(id)).aufnahmen.length, 0);
});

test("Absturz von Python wird als Fehler gemeldet", async () => {
  const { id, plaene } = await probandMitPlaenen();
  process.env.FAKE_MODUS = "absturz";
  const liste = await ereignisse(() => post(`/api/probanden/${id}/messung`, { messplanId: plaene[0].id }));
  const fehler = liste.at(-1);
  assert.equal(fehler.type, "error");
  assert.match(fehler.message, /Code 3.*Traceback: kaputt/);
});

test("Ungültige Starts werden abgewiesen, bevor Python startet", async () => {
  const { id, plaene } = await probandMitPlaenen();
  assert.equal((await post(`/api/probanden/${id}/messung`, { messplanId: "ffffffff" })).status, 400);
  assert.equal((await post(`/api/probanden/${id}/messung`, { messplanId: plaene[0].id, platzierungId: "ffffffff" })).status, 400);
  assert.equal((await post("/api/probanden/0123456789ab/messung", { messplanId: plaene[0].id })).status, 404);
  assert.equal((await (await fetch(`${basis}/api/messung`)).json()).laeuft, false);
});
