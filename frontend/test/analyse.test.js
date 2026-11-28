// Prüft die Analyse je Aufnahme: Start, Zustand, Seite; Python ist durch testhilfen/fakeAnalyse.mjs ersetzt.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { ProbandenSpeicher } from "../server/probandenSpeicher.js";
import { MessungSteuerung } from "../server/messungSteuerung.js";
import { AnalyseSteuerung } from "../server/analyseSteuerung.js";
import { erstelleRouter } from "../server/routen.js";

const ABFRAGE_MS = 50;
let server, basis, ordner;

before(async () => {
  ordner = await fs.mkdtemp(path.join(os.tmpdir(), "emg-analyse-"));
  const analyse = new AnalyseSteuerung({ programm: process.execPath, argumente: [path.resolve("testhilfen", "fakeAnalyse.mjs")],
    arbeitsordner: path.resolve("."), zeitlimitMs: 10_000 });
  const steuerung = new MessungSteuerung({ programm: process.execPath, argumente: [], arbeitsordner: ordner });
  server = http.createServer(erstelleRouter(new ProbandenSpeicher(ordner), steuerung,
    { publicOrdner: path.resolve("public"), maxAnfrageBytes: 1024 * 1024, analyse }));
  await new Promise((ok) => server.listen(0, ok));
  basis = `http://localhost:${server.address().port}`;
});

after(async () => {
  server.close();
  await fs.rm(ordner, { recursive: true, force: true });
});

const json = async (pfad, methode = "GET") => {
  const r = await fetch(basis + pfad, { method: methode, body: methode === "POST" && pfad === "/api/probanden" ? JSON.stringify({ name: "P" }) : undefined });
  return { status: r.status, daten: await r.json().catch(() => null) };
};

// Proband mit Aufnahmen im Platzierungs-Ordner (wie vom Backend angelegt); inhalte: Name → CSV-Text
async function probandMit(inhalte) {
  const { id } = (await json("/api/probanden", "POST")).daten;
  const unterordner = path.join(ordner, id, "a-nah-am-ellenbogen_eedaaa2f");
  await fs.mkdir(unterordner, { recursive: true });
  for (const [name, text] of Object.entries(inhalte)) await fs.writeFile(path.join(unterordner, `${name}.csv`), text);
  return { id, unterordner };
}

async function warteBisFertig(id, name) {
  for (;;) {
    const { daten } = await json(`/api/probanden/${id}/aufnahmen/${name}/analyse`);
    if (daten.status !== "laeuft" && daten.status !== "wartet") return daten;
    await new Promise((ok) => setTimeout(ok, ABFRAGE_MS));
  }
}

test("Analyse läuft, die Seite liegt neben der CSV und wird ohne Skripte ausgeliefert", async () => {
  const { id, unterordner } = await probandMit({ "2026-11-22_10-00-00_faust": "Time,Emg_5\n0.0,1.0\n" });
  const name = "2026-11-22_10-00-00_faust";
  assert.deepEqual((await json(`/api/probanden/${id}/analysen`)).daten.namen, []);
  assert.equal((await json(`/api/probanden/${id}/aufnahmen/${name}/analyse`)).daten.status, "keine");

  const start = await json(`/api/probanden/${id}/aufnahmen/${name}/analyse`, "POST");
  assert.equal(start.status, 202);
  assert.equal(start.daten.status, "laeuft");
  assert.deepEqual(await warteBisFertig(id, name), { status: "fertig", hinweis: null });

  await fs.access(path.join(unterordner, `${name}.analyse.html`));
  assert.deepEqual((await json(`/api/probanden/${id}/analysen`)).daten.namen, [name]);
  const seite = await fetch(`${basis}/analyse/${id}/${name}`);
  assert.equal(seite.status, 200);
  assert.match(await seite.text(), /Analyse von Time,Emg_5/);
  assert.match(seite.headers.get("content-security-policy"), /sandbox.*default-src 'none'/);
});

test("Abbruch im Notebook, Fehler, und weitere Analysen warten in der Schlange", async () => {
  const { id } = await probandMit({ abbruch: "abbruch\n", kaputt: "kaputt\n", zweite: "Time\n", dritte: "Time\n" });
  await json(`/api/probanden/${id}/aufnahmen/abbruch/analyse`, "POST");
  const zweite = await json(`/api/probanden/${id}/aufnahmen/zweite/analyse`, "POST");
  assert.equal(zweite.status, 202);
  assert.deepEqual(zweite.daten, { status: "wartet", vorher: 0 });
  assert.deepEqual((await json(`/api/probanden/${id}/aufnahmen/dritte/analyse`, "POST")).daten, { status: "wartet", vorher: 1 });
  assert.deepEqual((await json(`/api/probanden/${id}/aufnahmen/zweite/analyse`, "POST")).daten,
    { status: "wartet", vorher: 0 }, "nochmals starten reiht nicht doppelt ein");
  assert.deepEqual(await warteBisFertig(id, "abbruch"), { status: "fertig", hinweis: "KeyError: 'Emg_5'" });
  assert.deepEqual(await warteBisFertig(id, "zweite"), { status: "fertig", hinweis: null });
  assert.deepEqual(await warteBisFertig(id, "dritte"), { status: "fertig", hinweis: null });

  await json(`/api/probanden/${id}/aufnahmen/kaputt/analyse`, "POST");
  const fehler = await warteBisFertig(id, "kaputt");
  assert.equal(fehler.status, "fehler");
  assert.match(fehler.fehler, /read_csv/);
  assert.equal((await fetch(`${basis}/analyse/${id}/kaputt`)).status, 404, "ohne Seite nichts anzuzeigen");
});

test("Unbekannte Aufnahmen und Probanden", async () => {
  const { id } = await probandMit({});
  assert.equal((await json(`/api/probanden/${id}/aufnahmen/gibtsnicht/analyse`, "POST")).status, 404);
  assert.equal((await json(`/api/probanden/${id}/aufnahmen/..%2F..%2Fproband/analyse`)).status, 404);
  assert.equal((await json("/api/probanden/0123456789ab/analysen")).status, 404);
});

test("Mit gleichzeitig: 2 laufen zwei Analysen parallel, die dritte wartet", async () => {
  const parallel = new AnalyseSteuerung({ programm: process.execPath, argumente: [path.resolve("testhilfen", "fakeAnalyse.mjs")],
    arbeitsordner: path.resolve("."), zeitlimitMs: 10_000, gleichzeitig: 2 });
  const { unterordner } = await probandMit({ a: "Time\n", b: "Time\n", c: "Time\n" });
  const dateien = (n) => ({ csv: path.join(unterordner, `${n}.csv`), analyse: path.join(unterordner, `${n}.analyse.html`) });
  assert.deepEqual(["a", "b", "c"].map((n) => parallel.starte("p", n, dateien(n)).status), ["laeuft", "laeuft", "wartet"]);
  assert.ok(parallel.istAktiv("p", "c"));
  while (parallel.istAktiv("p", "c")) await new Promise((ok) => setTimeout(ok, ABFRAGE_MS));
  for (const n of ["a", "b", "c"]) await fs.access(dateien(n).analyse);
});
