// Prüft die Geometrie des Platzierungsmodells.
import { test } from "node:test";
import assert from "node:assert/strict";
import { berechne } from "../public/js/modell/berechnung.js";
import { anleitung } from "../public/js/modell/anleitung.js";
import { fortschritt } from "../public/js/modell/fortschritt.js";
import { umfangBei } from "../public/js/modell/umfang.js";
import { neuePlatzierung, normalisiere } from "../public/js/modell/platzierungen.js";

const nahe = (a, b, tol = 1e-6) => Math.abs(a - b) < tol;
const platz = (variante = "A") => ({ variante, elektrodenAbstand: 2 });

// Innenfoto: Armbeuge oben (y=100), Handgelenk unten (y=600), Daumen rechts.
// Oberseite: Ellenbogen links, Hand rechts, Knubbel (Daumenseite) oben.
const proband = () => ({
  name: "T1",
  mass: { laengeInnen: 25, laengeOben: 24, umfangDick: 26, umfangHand: 16 },
  innen: { punkte: { armbeuge: { x: 300, y: 100 }, handgelenk: { x: 300, y: 600 }, daumen: { x: 420, y: 680 } } },
  oben: { punkte: { spitze: { x: 100, y: 330 }, knubbel: { x: 110, y: 270 }, handgelenk: { x: 580, y: 300 } } },
});

test("Maßstab und Daumenseite werden aus den Punkten bestimmt", () => {
  const { geo } = berechne(proband(), platz());
  assert.ok(nahe(geo.innen.pxProCm, 20), "500 px / 25 cm");
  assert.ok(geo.innen.n.x > 0.99, "innen: Daumenseite rechts");
  assert.ok(geo.oben.n.y < -0.99, "oben: Daumenseite (Knubbel) oben");
});

test("Variante A: Lage entlang der Linie und seitlicher Versatz", () => {
  const k = berechne(proband(), platz()).kanaele;
  const k1 = k.find((x) => x.ch === "K1");
  assert.ok(nahe(k1.px.mitte.y, 100 + 0.45 * 500), "K1 bei 45 %");
  assert.ok(k1.px.mitte.x < 300, "K1 zur Kleinfingerseite versetzt");
  assert.ok(nahe(k1.cmVomHandgelenk, 13.75), "K1 13,75 cm vom Handgelenk");

  const k4 = k.find((x) => x.ch === "K4");
  assert.ok(k4.px.mitte.y < 300, "K4 zur Daumenseite versetzt");
  assert.ok(k4.px.e2.y < k4.px.e1.y, "K4: handnahes Ende zeigt zur Daumenseite");
});

test("Elektrodenabstand entspricht im Bild dem eingestellten Abstand", () => {
  const { kanaele, geo } = berechne(proband(), platz());
  const k3 = kanaele.find((x) => x.ch === "K3");
  const d = Math.hypot(k3.px.e2.x - k3.px.e1.x, k3.px.e2.y - k3.px.e1.y) / geo.oben.pxProCm;
  assert.ok(nahe(d, 2));
});

test("Variante B: feste Entfernung vom Handgelenk", () => {
  const c2 = berechne(proband(), platz("B")).kanaele.find((x) => x.ch === "C2");
  assert.ok(nahe(c2.cmVomHandgelenk, 4));
});

test("Variante C: sechs Kanäle, Zylinderprojektion", () => {
  const p = proband();
  const { kanaele, geo } = berechne(p, platz("C"));
  assert.equal(kanaele.length, 6);
  assert.equal(kanaele.filter((k) => k.seite === "innen").length, 3);
  const r3 = kanaele.find((k) => k.ch === "R3"), r5 = kanaele.find((k) => k.ch === "R5");
  const breiteCm = Math.abs(r5.px.mitte.x - r3.px.mitte.x) / geo.innen.pxProCm;
  const radius = umfangBei(p, 1 / 3) / (2 * Math.PI);
  assert.ok(nahe(breiteCm, 2 * radius * Math.sin(Math.PI / 3)));
});

test("Ohne Fotos: keine Pixel, aber Anleitung und Fortschritt", () => {
  const p = { name: "x" };
  const k = berechne(p, platz()).kanaele[0];
  assert.equal(k.px, null);
  assert.ok(anleitung(k, platz()).length >= 2);
  assert.deepEqual(fortschritt(p), { grunddaten: true, messungen: false, innen: false, oben: false, aufnahmen: false });
});

test("Variante D: drei Sensoren an denselben Stellen wie die entsprechenden Kanäle aus A", () => {
  const a = berechne(proband(), platz("A")).kanaele;
  const d = berechne(proband(), platz("D")).kanaele;
  assert.deepEqual(d.map((k) => k.ch), ["S1", "S2", "S3"]);
  for (const [s, k] of [["S1", "K1"], ["S2", "K3"], ["S3", "K5"]]) {
    const pd = d.find((x) => x.ch === s).px.mitte, pa = a.find((x) => x.ch === k).px.mitte;
    assert.ok(nahe(pd.x, pa.x) && nahe(pd.y, pa.y), `${s} liegt wie ${k}`);
  }
});

test("Platzierungen: Namen werden eindeutig, ungültige Werte korrigiert", () => {
  const a = neuePlatzierung([], { variante: "D" });
  const b = neuePlatzierung([a], { variante: "D" });
  assert.equal(a.name, "D · Nur 3 Sensoren");
  assert.equal(b.name, "D · Nur 3 Sensoren (2)");
  const p = normalisiere({ platzierungen: [{ ...a }, { ...a }, { variante: "X", elektrodenAbstand: 99, name: "  " }] });
  assert.notEqual(p.platzierungen[0].id, p.platzierungen[1].id, "doppelte IDs werden ersetzt");
  assert.equal(p.platzierungen[2].variante, "A");
  assert.equal(p.platzierungen[2].elektrodenAbstand, 2);
});

test("Platzierungen: alte Probanden mit einer Anordnung werden übernommen", () => {
  const p = normalisiere({ name: "alt", variante: "B", elektrodenAbstand: 2.5 });
  assert.equal(p.platzierungen.length, 1);
  assert.equal(p.platzierungen[0].variante, "B");
  assert.equal(p.platzierungen[0].elektrodenAbstand, 2.5);
  assert.equal(p.variante, undefined);
});

test("Variante E: Ring mit 3 Sensoren alle 120°, einer oben, zwei innen", () => {
  const p = proband();
  const { kanaele, geo } = berechne(p, platz("E"));
  assert.deepEqual(kanaele.map((k) => [k.ch, k.seite]), [["R1", "oben"], ["R2", "innen"], ["R3", "innen"]]);
  const drittel = umfangBei(p, 1 / 3) / 3;
  assert.ok(nahe(kanaele[0].quer, 0));
  assert.ok(nahe(kanaele[1].quer, drittel - umfangBei(p, 1 / 3) / 2), "R2: Kleinfingerseite der Innenseite");
  assert.ok(kanaele[1].quer < 0 && kanaele[2].quer > 0, "R2 Kleinfinger-, R3 Daumenseite");
  assert.ok(nahe(kanaele[1].quer, -kanaele[2].quer), "symmetrisch zur Innenseiten-Mitte");
  assert.ok(kanaele.every((k) => k.px), "alle Kanäle haben Bildpositionen");
  assert.ok(geo.innen && geo.oben);
});
