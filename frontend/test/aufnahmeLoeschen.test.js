// Prüft das Löschen einer fehlerhaften Aufnahme: Eintrag und alle Dateien weg, andere bleiben unberührt.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { ProbandenSpeicher } from "../server/probandenSpeicher.js";
import { AnalyseSteuerung } from "../server/analyseSteuerung.js";
import { erstelleRouter } from "../server/routen.js";

const NEBENDATEIEN = [".csv", ".events.csv", ".cues.csv", ".protocol.json", ".config.toml", ".analyse.html"];
const ABFRAGE_MS = 50;
let server, basis, ordner, speicher;

before(async () => {
  ordner = await fs.mkdtemp(path.join(os.tmpdir(), "emg-loeschen-"));
  speicher = new ProbandenSpeicher(ordner);
  const analyse = new AnalyseSteuerung({ programm: process.execPath, argumente: [path.resolve("testhilfen", "fakeAnalyse.mjs")],
    arbeitsordner: path.resolve("."), zeitlimitMs: 10_000 });
  server = http.createServer(erstelleRouter(speicher, null, { publicOrdner: path.resolve("public"), maxAnfrageBytes: 1024 * 1024, analyse }));
  await new Promise((ok) => server.listen(0, ok));
  basis = `http://localhost:${server.address().port}`;
});

after(async () => {
  server.closeAllConnections();
  server.close();
  await fs.rm(ordner, { recursive: true, force: true });
});

const anfrage = (methode, pfad) => fetch(basis + pfad, { method: methode });

// Proband mit Aufnahmen (Eintrag in proband.json und Dateien im Platzierungs-Ordner)
async function probandMit(namen) {
  const { id } = await speicher.legeAn("P");
  const unterordner = path.join(ordner, id, "a-nah-am-ellenbogen_eedaaa2f");
  await fs.mkdir(unterordner, { recursive: true });
  for (const name of namen) {
    for (const endung of NEBENDATEIEN) await fs.writeFile(path.join(unterordner, name + endung), "Time\n");
    await speicher.ergaenzeAufnahme(id, { name, erstellt: new Date().toISOString() });
  }
  return { id, unterordner };
}

test("Löschen entfernt Eintrag und alle Dateien dieser Aufnahme, sonst nichts", async () => {
  const { id, unterordner } = await probandMit(["2026-11-27_10-00-00_mvc", "2026-11-27_10-00-00_mvc-2"]);
  const r = await anfrage("DELETE", `/api/probanden/${id}/aufnahmen/2026-11-27_10-00-00_mvc`);
  assert.equal(r.status, 200);
  assert.deepEqual((await r.json()).map((a) => a.name), ["2026-11-27_10-00-00_mvc-2"]);
  assert.deepEqual((await speicher.lade(id)).aufnahmen.map((a) => a.name), ["2026-11-27_10-00-00_mvc-2"]);
  const uebrig = (await fs.readdir(unterordner)).sort();
  assert.deepEqual(uebrig, NEBENDATEIEN.map((e) => "2026-11-27_10-00-00_mvc-2" + e).sort(), "ähnlicher Name bleibt");
});

test("Eintrag ohne Dateien lässt sich löschen; Unbekanntes gibt 404", async () => {
  const { id } = await speicher.legeAn("P");
  await speicher.ergaenzeAufnahme(id, { name: "ohne_dateien" });
  assert.equal((await anfrage("DELETE", `/api/probanden/${id}/aufnahmen/ohne_dateien`)).status, 200);
  assert.equal((await anfrage("DELETE", `/api/probanden/${id}/aufnahmen/ohne_dateien`)).status, 404);
  assert.equal((await anfrage("DELETE", `/api/probanden/${id}/aufnahmen/..%2Fproband`)).status, 404);
  assert.equal((await anfrage("DELETE", "/api/probanden/0123456789ab/aufnahmen/x")).status, 404);
});

test("Während ihre Analyse läuft, bleibt die Aufnahme erhalten", async () => {
  const { id, unterordner } = await probandMit(["laeuft"]);
  assert.equal((await anfrage("POST", `/api/probanden/${id}/aufnahmen/laeuft/analyse`)).status, 202);
  assert.equal((await anfrage("DELETE", `/api/probanden/${id}/aufnahmen/laeuft`)).status, 409);
  await fs.access(path.join(unterordner, "laeuft.csv"));
  assert.equal((await speicher.lade(id)).aufnahmen.length, 1);

  const zustand = async () => (await (await anfrage("GET", `/api/probanden/${id}/aufnahmen/laeuft/analyse`)).json()).status;
  while (await zustand() === "laeuft") await new Promise((ok) => setTimeout(ok, ABFRAGE_MS));
  assert.equal((await anfrage("DELETE", `/api/probanden/${id}/aufnahmen/laeuft`)).status, 200, "danach geht es");
  assert.deepEqual(await fs.readdir(unterordner), []);
});
