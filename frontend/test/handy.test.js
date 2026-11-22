// Prüft den Foto-Upload vom Handy: Zugang per Token, Ablauf, Anonymität und Schutz vor Zugriffen aus dem Netz.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { ProbandenSpeicher } from "../server/probandenSpeicher.js";
import { MessungSteuerung } from "../server/messungSteuerung.js";
import { HandyZugang } from "../server/handyZugang.js";
import { erstelleRouter } from "../server/routen.js";
import { istErlaubt } from "../server/zugriffsSchutz.js";
import { lanAdressen } from "../server/netzAdressen.js";

const PNG_1PX = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
const GUELTIG_MIN = 30;
const LAN_IP = "192.168.178.23";
const MS_PRO_MIN = 60_000;
let server, basis, ordner, uhr;

before(async () => {
  ordner = await fs.mkdtemp(path.join(os.tmpdir(), "emg-handy-"));
  uhr = 0;
  const handyZugang = new HandyZugang(GUELTIG_MIN, () => uhr);
  const steuerung = new MessungSteuerung({ programm: process.execPath, argumente: [], arbeitsordner: ordner });
  server = http.createServer(erstelleRouter(new ProbandenSpeicher(ordner), steuerung,
    { publicOrdner: path.resolve("public"), maxAnfrageBytes: 1024 * 1024, handyZugang, adressen: () => [LAN_IP] }));
  await new Promise((ok) => server.listen(0, ok));
  basis = `http://localhost:${server.address().port}`;
});

after(async () => {
  server.close();
  await fs.rm(ordner, { recursive: true, force: true });
});

const anfrage = async (pfad, methode = "GET", daten) => {
  const r = await fetch(basis + pfad, { method: methode, body: daten && JSON.stringify(daten) });
  return { status: r.status, daten: await r.json().catch(() => null) };
};
const tokenAus = (url) => url.split("#")[1];

async function zugang(name = "Geheimer Name") {
  const p = (await anfrage("/api/probanden", "POST", { name })).daten;
  const z = await anfrage(`/api/probanden/${p.id}/handy-zugang`, "POST");
  assert.equal(z.status, 201);
  return { p, urls: z.daten.urls };
}

test("Handy lädt ein Foto hoch, ohne Name oder ID zu sehen", async () => {
  const { p, urls } = await zugang();
  assert.equal(urls.length, 1);
  assert.ok(urls[0].startsWith(`http://${LAN_IP}:`));
  assert.match(urls[0], /:\d+\/handy\.html#[a-f0-9]{32}$/);
  const t = tokenAus(urls[0]);

  const status = await anfrage(`/api/handy/${t}`);
  assert.deepEqual(status.daten, { seiten: { innen: false, oben: false } });
  const hoch = await anfrage(`/api/handy/${t}/bild/oben`, "POST", { dataUrl: PNG_1PX, breite: 1, hoehe: 1 });
  assert.deepEqual(hoch.daten, { seite: "oben", ok: true });
  for (const antwort of [status, hoch]) {
    assert.ok(!JSON.stringify(antwort.daten).includes("Geheimer Name"), "kein Name an das Handy");
    assert.ok(!JSON.stringify(antwort.daten).includes(p.id), "keine ID an das Handy");
  }
  assert.equal((await anfrage(`/api/probanden/${p.id}`)).daten.oben.bild, "oben.png");
  assert.deepEqual((await anfrage(`/api/handy/${t}`)).daten.seiten, { innen: false, oben: true });
  assert.equal((await anfrage(`/api/handy/${t}/bild/seitlich`, "POST", { dataUrl: PNG_1PX })).status, 400);
  assert.equal((await anfrage("/api/probanden/0123456789ab/handy-zugang", "POST")).status, 404);
});

test("Zugang läuft ab, wird ersetzt und ist ohne Token nutzlos", async () => {
  const zugaenge = new HandyZugang(GUELTIG_MIN, () => uhr);
  const erster = zugaenge.erstelle("0123456789ab").token;
  const zweiter = zugaenge.erstelle("0123456789ab").token;
  assert.throws(() => zugaenge.probandZu(erster), { status: 404 }, "neuer QR-Code macht den alten ungültig");
  assert.equal(zugaenge.probandZu(zweiter), "0123456789ab");
  uhr += GUELTIG_MIN * MS_PRO_MIN;
  assert.throws(() => zugaenge.probandZu(zweiter), { status: 410 });
  uhr = 0;
  assert.throws(() => zugaenge.probandZu("../../etc"), { status: 404 });
  assert.equal((await anfrage(`/api/handy/${"0".repeat(32)}`)).status, 404);
});

test("Veraltete Punkte überschreiben ein neues Foto nicht", async () => {
  const { p } = await zugang();
  const nachHandy = (await anfrage(`/api/probanden/${p.id}/bild/innen`, "POST", { dataUrl: PNG_1PX, breite: 1, hoehe: 1 })).daten;
  const alt = { ...nachHandy.innen, version: nachHandy.innen.version - 1, punkte: { armbeuge: { x: 1, y: 2 } } };
  assert.deepEqual((await anfrage(`/api/probanden/${p.id}`, "PUT", { innen: alt })).daten.innen.punkte, {});
  const passend = { ...nachHandy.innen, punkte: { armbeuge: { x: 3, y: 4 } } };
  assert.deepEqual((await anfrage(`/api/probanden/${p.id}`, "PUT", { innen: passend })).daten.innen.punkte, passend.punkte);
});

test("Aus dem Netz nur die Handy-Seite, vom Laptop alles", () => {
  const req = (adresse, url) => ({ socket: { remoteAddress: adresse }, url });
  for (const lokal of ["127.0.0.1", "::1", "::ffff:127.0.0.1"]) assert.ok(istErlaubt(req(lokal, "/api/probanden")));
  const netz = "192.168.178.40";
  for (const erlaubt of ["/handy.html", "/js/handy.js", "/js/zeichnen/bilder.js", "/style.css", "/api/handy/abc/bild/oben"]) {
    assert.ok(istErlaubt(req(netz, erlaubt)), erlaubt);
  }
  for (const verboten of ["/", "/index.html", "/api/probanden", "/api/probanden/0123456789ab", "/bilder/0123456789ab/oben.jpg",
    "/api/messung", "/js/main.js"]) {
    assert.ok(!istErlaubt(req(netz, verboten)), verboten);
  }
});

test("WLAN-Adressen: ohne interne, link-lokale und virtuelle Adapter, Heimnetz zuerst", () => {
  assert.deepEqual(lanAdressen({
    "vEthernet (WSL (Hyper-V firewall))": [{ family: "IPv4", address: "172.18.160.1", internal: false }],
    "Loopback Pseudo-Interface 1": [{ family: "IPv4", address: "127.0.0.1", internal: true }],
    "Ethernet 5": [{ family: "IPv4", address: "10.0.0.7", internal: false }],
    WLAN: [{ family: "IPv4", address: "192.168.178.23", internal: false }, { family: "IPv6", address: "fe80::1", internal: false }],
    apipa: [{ family: "IPv4", address: "169.254.3.4", internal: false }],
  }), ["192.168.178.23", "10.0.0.7"]);
});

test("Handy-Seite und QR-Bibliothek werden ausgeliefert", async () => {
  assert.equal((await fetch(`${basis}/handy.html`)).status, 200);
  assert.match((await fetch(`${basis}/vendor/qrcode-generator.mjs`)).headers.get("content-type"), /javascript/);
});
