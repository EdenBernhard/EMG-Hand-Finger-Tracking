// Prüft den Upload von C3D-Dateien; Python ist durch testhilfen/fakeC3dImport.mjs ersetzt.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { ProbandenSpeicher } from "../server/probandenSpeicher.js";
import { erstelleRouter } from "../server/routen.js";
import { MessungSteuerung } from "../server/messungSteuerung.js";
import { C3dImport } from "../server/c3dImport.js";

const MAX_BYTES = 64;
let server, basis, ordner, tempOrdner;

before(async () => {
  ordner = await fs.mkdtemp(path.join(os.tmpdir(), "emg-test-"));
  tempOrdner = await fs.mkdtemp(path.join(os.tmpdir(), "emg-upload-"));
  const c3dImport = new C3dImport({ programm: process.execPath, argumente: [path.resolve("testhilfen", "fakeC3dImport.mjs")],
    arbeitsordner: path.resolve("."), maxBytes: MAX_BYTES, zeitlimitMs: 10_000 }, tempOrdner);
  const steuerung = new MessungSteuerung({ programm: process.execPath, argumente: [], arbeitsordner: ordner });
  server = http.createServer(erstelleRouter(new ProbandenSpeicher(ordner), steuerung,
    { publicOrdner: path.resolve("public"), maxAnfrageBytes: 1024 * 1024, c3dImport }));
  await new Promise((ok) => server.listen(0, ok));
  basis = `http://localhost:${server.address().port}`;
});

after(async () => {
  server.close();
  await fs.rm(ordner, { recursive: true, force: true });
  await fs.rm(tempOrdner, { recursive: true, force: true });
});

const neuerProband = async () => (await (await fetch(`${basis}/api/probanden`, { method: "POST", body: JSON.stringify({ name: "P" }) })).json());

const lade = async (id, frage, inhalt = "c3d-inhalt") => {
  const r = await fetch(`${basis}/api/probanden/${id}/import-c3d?${new URLSearchParams(frage)}`, { method: "POST", body: inhalt });
  return { status: r.status, daten: await r.json() };
};

test("C3D-Datei wird konvertiert und beim Probanden eingetragen", async () => {
  const p = await neuerProband();
  const pl = p.platzierungen[0];
  const { status, daten } = await lade(p.id, { datei: "Testlauf 2.c3d", platzierungId: pl.id, notiz: " alt " });
  assert.equal(status, 201);
  assert.equal(daten.quelle, "c3d");
  assert.equal(daten.originalDatei, "Testlauf 2.c3d");
  assert.equal(daten.dauerS, 2);
  assert.deepEqual(daten.kanaele, ["EMG 5", "EMG 6"]);
  assert.equal(daten.platzierung.id, pl.id);
  assert.equal(daten.notiz, "alt");

  const gespeichert = await (await fetch(`${basis}/api/probanden/${p.id}`)).json();
  assert.equal(gespeichert.aufnahmen.length, 1);
  assert.equal(gespeichert.aufnahmen[0].name, daten.name);
  assert.deepEqual(await fs.readdir(tempOrdner), [], "temporäre Datei wird gelöscht");
});

test("Ungültige Uploads werden abgewiesen, ohne Aufnahme", async () => {
  const p = await neuerProband();
  assert.equal((await lade(p.id, { datei: "messung.csv" })).status, 400);
  assert.equal((await lade(p.id, { datei: "../boese.c3d" })).status, 400);
  assert.equal((await lade(p.id, { datei: "a.c3d", platzierungId: "gibtsnicht" })).status, 400);
  assert.equal((await lade("0123456789ab", { datei: "a.c3d" })).status, 404);
  assert.equal((await lade(p.id, { datei: "a.c3d" }, "")).status, 400);
  assert.equal((await lade(p.id, { datei: "a.c3d" }, "x".repeat(MAX_BYTES + 1))).status, 413);

  const kaputt = await lade(p.id, { datei: "a.c3d" }, "kaputt");
  assert.equal(kaputt.status, 422);
  assert.match(kaputt.daten.fehler, /keine Analogkanäle/);

  const gespeichert = await (await fetch(`${basis}/api/probanden/${p.id}`)).json();
  assert.equal(gespeichert.aufnahmen.length, 0);
  assert.deepEqual(await fs.readdir(tempOrdner), []);
});
