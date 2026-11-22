// Prüft die Server-API gegen einen temporären Datenordner.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { ProbandenSpeicher } from "../server/probandenSpeicher.js";
import { erstelleRouter } from "../server/routen.js";
import { MessungSteuerung } from "../server/messungSteuerung.js";

const PNG_1PX = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
let server, basis, ordner;

before(async () => {
  ordner = await fs.mkdtemp(path.join(os.tmpdir(), "emg-test-"));
  const publicOrdner = path.resolve("public");
  const steuerung = new MessungSteuerung({ programm: process.execPath, argumente: [], arbeitsordner: ordner });
  server = http.createServer(erstelleRouter(new ProbandenSpeicher(ordner), steuerung, { publicOrdner, maxAnfrageBytes: 1024 * 1024 }));
  await new Promise((ok) => server.listen(0, ok));
  basis = `http://localhost:${server.address().port}`;
});

after(async () => {
  server.close();
  await fs.rm(ordner, { recursive: true, force: true });
});

const anfrage = async (pfad, methode = "GET", daten) => {
  const r = await fetch(basis + pfad, { method: methode, body: daten && JSON.stringify(daten) });
  return { status: r.status, daten: r.status === 204 ? null : await r.json().catch(() => null) };
};

test("Proband anlegen, ändern, Foto hochladen, löschen", async () => {
  const neu = await anfrage("/api/probanden", "POST", { name: "P01" });
  assert.equal(neu.status, 201);
  const id = neu.daten.id;

  assert.equal(neu.daten.platzierungen.length, 1, "neuer Proband startet mit einer Platzierung");
  const geaendert = await anfrage(`/api/probanden/${id}`, "PUT", {
    platzierungen: [...neu.daten.platzierungen, { id: "abcdef12", name: "Test D", variante: "D", elektrodenAbstand: 2 }],
    mass: { laengeInnen: 25 }, innen: { bild: "../boese.jpg", punkte: { armbeuge: { x: 1, y: 2 } } }, id: "x" });
  assert.deepEqual(geaendert.daten.platzierungen.map((x) => x.variante), ["A", "D"]);
  const ohneListe = await anfrage(`/api/probanden/${id}`, "PUT", { platzierungen: "kaputt" });
  assert.equal(ohneListe.daten.platzierungen.length, 2, "ungültige Liste überschreibt nichts");
  assert.equal(geaendert.daten.id, id, "id lässt sich nicht überschreiben");
  assert.equal(geaendert.daten.innen.bild, undefined, "Bilddatei lässt sich per PUT nicht setzen");

  const bild = await anfrage(`/api/probanden/${id}/bild/oben`, "POST", { dataUrl: PNG_1PX, breite: 1, hoehe: 1 });
  assert.equal(bild.daten.oben.bild, "oben.png");
  assert.equal((await fetch(`${basis}/bilder/${id}/oben.png`)).status, 200);

  assert.equal((await anfrage("/api/probanden")).daten.length, 1);
  assert.equal((await anfrage(`/api/probanden/${id}`, "DELETE")).status, 204);
  assert.equal((await anfrage(`/api/probanden/${id}`)).status, 404);
});

test("Ungültige Eingaben werden abgewiesen", async () => {
  assert.equal((await anfrage("/api/probanden", "POST", { name: "  " })).status, 400);
  assert.equal((await anfrage("/api/probanden/../../etc")).status, 404);
  const { daten } = await anfrage("/api/probanden", "POST", { name: "P02" });
  assert.equal((await anfrage(`/api/probanden/${daten.id}/bild/seitlich`, "POST", { dataUrl: PNG_1PX })).status, 400);
  assert.equal((await anfrage(`/api/probanden/${daten.id}/bild/oben`, "POST", { dataUrl: "data:text/html;base64,AA==" })).status, 400);
  assert.equal((await fetch(`${basis}/bilder/${daten.id}/proband.json`)).status, 404);
});

test("Alte Probanden-Dateien werden beim Laden umgestellt", async () => {
  const id = "0123456789ab";
  await fs.mkdir(path.join(ordner, id), { recursive: true });
  await fs.writeFile(path.join(ordner, id, "proband.json"), JSON.stringify({ id, name: "Alt", variante: "C", elektrodenAbstand: 2 }));
  const { daten } = await anfrage(`/api/probanden/${id}`);
  assert.equal(daten.platzierungen[0].variante, "C");
  assert.equal(daten.variante, undefined);
});

test("Webseite und Module werden ausgeliefert, nichts außerhalb von public", async () => {
  assert.equal((await fetch(`${basis}/`)).status, 200);
  assert.match((await fetch(`${basis}/js/main.js`)).headers.get("content-type"), /javascript/);
  assert.equal((await fetch(`${basis}/%2e%2e/package.json`)).status, 404);
});
