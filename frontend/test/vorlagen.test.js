// Prüft die Messplan-Vorlagen (Standard-Messpläne, eigene Vorlagen über die API) und die Pause im Messplan.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { ProbandenSpeicher } from "../server/probandenSpeicher.js";
import { VorlagenSpeicher } from "../server/vorlagenSpeicher.js";
import { erstelleRouter } from "../server/routen.js";
import { STANDARD_VORLAGEN, bereinigeEigeneVorlagen } from "../public/js/modell/messplanVorlagen.js";
import { bereinigeMessplan, anzahlVorgaben, anzahlBewegungen, dauerS, GRENZEN } from "../public/js/modell/messplan.js";
import { neuerMessplan } from "../public/js/modell/messplaene.js";

let server, basis, ordner, datei;

before(async () => {
  ordner = await fs.mkdtemp(path.join(os.tmpdir(), "emg-vorlagen-"));
  datei = path.join(ordner, "messplan_vorlagen.json");
  server = http.createServer(erstelleRouter(new ProbandenSpeicher(path.join(ordner, "probanden")), null,
    { publicOrdner: path.resolve("public"), maxAnfrageBytes: 1024 * 1024, vorlagen: new VorlagenSpeicher(datei) }));
  await new Promise((ok) => server.listen(0, ok));
  basis = `http://localhost:${server.address().port}`;
});

after(async () => {
  server.closeAllConnections();
  server.close();
  await fs.rm(ordner, { recursive: true, force: true });
});

const anfrage = (methode, pfad, daten) =>
  fetch(basis + pfad, { method: methode, body: daten && JSON.stringify(daten) });

test("Pause: jede Bewegung bekommt eine Ruhe-Vorgabe, die Dauer wächst entsprechend", () => {
  const plan = bereinigeMessplan({ bewegungen: [{ name: "Faust", anzahl: 3 }], intervallS: 5, pauseS: 10,
    wiederholungen: 2, vorlaufS: 3 });
  assert.equal(anzahlBewegungen(plan), 6);
  assert.equal(anzahlVorgaben(plan), 12);
  assert.equal(dauerS(plan), 3 + 6 * 15);
  const ohne = bereinigeMessplan({ ...plan, pauseS: undefined });
  assert.equal(ohne.pauseS, 0, "ältere Messpläne ohne Pause");
  assert.equal(anzahlVorgaben(ohne), 6);
  assert.equal(bereinigeMessplan({ ...plan, pauseS: 999 }).pauseS, GRENZEN.pauseS.max);
});

test("Standard-Messpläne MVC und Kontinuierlich", () => {
  const [mvc, kon] = STANDARD_VORLAGEN;
  assert.equal(mvc.name, "MVC");
  assert.deepEqual(mvc.bewegungen.map((b) => b.anzahl), [3, 3, 3, 3]);
  assert.equal(mvc.pauseS, 10);
  assert.equal(kon.name, "Kontinuierlich");
  assert.equal(kon.bewegungen.length, 15);
  assert.equal(kon.pauseS, 0);
  for (const v of STANDARD_VORLAGEN) {
    assert.deepEqual(bereinigeMessplan(v).bewegungen, v.bewegungen, `${v.name}: Namen passen in die Grenzen`);
  }
  const kopie = neuerMessplan([], mvc, mvc.name);
  assert.equal(kopie.name, "MVC");
  assert.notEqual(kopie.id, mvc.id);
  assert.equal(kopie.standard, undefined, "die Kopie ist ein normaler Messplan");
});

test("Eigene Vorlagen: speichern, ersetzen, löschen; Standard-Namen sind reserviert", async () => {
  const start = await (await anfrage("GET", "/api/messplan-vorlagen")).json();
  assert.deepEqual(start.map((v) => v.name), ["MVC", "Kontinuierlich"]);

  const plan = { id: "abcdef12", name: "Pinch", bewegungen: [{ name: "Pinch", anzahl: 3 }], intervallS: 2, pauseS: 1 };
  let liste = await (await anfrage("POST", "/api/messplan-vorlagen", plan)).json();
  const eigene = liste.find((v) => v.name === "Pinch");
  assert.equal(eigene.standard, false);
  assert.equal(eigene.pauseS, 1);
  assert.notEqual(eigene.id, plan.id, "eigene ID, nicht die des Messplans");

  liste = await (await anfrage("POST", "/api/messplan-vorlagen", { ...plan, intervallS: 4 })).json();
  const ersetzt = liste.filter((v) => v.name === "Pinch");
  assert.equal(ersetzt.length, 1, "gleicher Name ersetzt");
  assert.equal(ersetzt[0].intervallS, 4);
  assert.equal(ersetzt[0].id, eigene.id);
  assert.equal(JSON.parse(await fs.readFile(datei, "utf8")).length, 1);

  assert.equal((await anfrage("POST", "/api/messplan-vorlagen", { ...plan, name: "MVC" })).status, 400);
  assert.equal((await anfrage("POST", "/api/messplan-vorlagen", { ...plan, name: " " })).status, 400);
  assert.equal((await anfrage("POST", "/api/messplan-vorlagen", { ...plan, name: "Leer", bewegungen: [] })).status, 400);

  assert.equal((await anfrage("DELETE", "/api/messplan-vorlagen/standard-mvc")).status, 404, "Standard ist fest");
  liste = await (await anfrage("DELETE", `/api/messplan-vorlagen/${eigene.id}`)).json();
  assert.deepEqual(liste.map((v) => v.name), ["MVC", "Kontinuierlich"]);
});

test("Kaputte Vorlagen-Datei: ungültige Einträge fallen weg", () => {
  const liste = bereinigeEigeneVorlagen([{ name: "" }, { name: "MVC" }, { name: "A", intervallS: 2 }, { name: "A", intervallS: 3 }]);
  assert.deepEqual(liste.map((v) => [v.name, v.intervallS]), [["A", 3]]);
  assert.deepEqual(bereinigeEigeneVorlagen("kaputt"), []);
});
