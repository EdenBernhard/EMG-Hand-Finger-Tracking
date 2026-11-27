// Vorlagen für Messpläne, für alle Probanden gleich: feste Standard-Messpläne (hier im Code, damit sie
// versioniert sind) und eigene Vorlagen (gespeichert vom Server). Wer eine Vorlage auswählt, bekommt
// eine Kopie als Messplan des Probanden. Wird von Browser und Server genutzt.
import { bereinigeMessplan } from "./messplan.js";
import { neueId } from "./platzierungen.js";

const MAX_NAME = 80;
export const MAX_EIGENE_VORLAGEN = 50;
const ID_MUSTER = /^[a-f0-9]{8}$/;
const STANDARD_PRAEFIX = "standard-";

// MVC: maximale willkürliche Kontraktion je Muskelgruppe, nach jeder Anspannung Ruhe
const MVC = {
  id: `${STANDARD_PRAEFIX}mvc`,
  name: "MVC",
  bewegungen: [
    { name: "Hand zur Faust", anzahl: 3 },
    { name: "Handgelenk beugen (Faust)", anzahl: 3 },
    { name: "Handgelenk strecken (Faust)", anzahl: 3 },
    { name: "Finger strecken", anzahl: 3 },
  ],
  intervallS: 5,
  pauseS: 10,
  wiederholungen: 1,
  vorlaufS: 3,
};

// Kontinuierlicher Ablauf mit 15 Bewegungen, ohne Pausen (wie der erste Testlauf)
const KONTINUIERLICH = {
  id: `${STANDARD_PRAEFIX}kontinuierlich`,
  name: "Kontinuierlich",
  bewegungen: [
    "Faust ballen, halten (Daumen außen)",
    "Drehung 45° nach oben (gegen Uhrzeiger)",
    "Zeigefinger ausstrecken",
    "3× Wischen rechts→links (Zeigefinger)",
    "Zurück zur Faust",
    "Daumen hoch",
    "Daumen 3× auf Zeigefinger drücken",
    "Zeigefinger und Daumen ausstrecken",
    "3× Pinch (Daumen und Zeigefinger)",
    "Zurück zur Faust",
    "Zeige- und Mittelfinger ausstrecken",
    "3× Wischen rechts→links (zwei Finger)",
    "Zurück zur Faust",
    "Drehung 45° zur Seite",
    "Faust zur flachen Hand",
  ].map((name) => ({ name, anzahl: 1 })),
  intervallS: 5,
  pauseS: 0,
  wiederholungen: 1,
  vorlaufS: 3,
};

export const STANDARD_VORLAGEN = [MVC, KONTINUIERLICH].map((v) => ({ ...v, ...bereinigeMessplan(v), standard: true }));

export const istStandardName = (name) => STANDARD_VORLAGEN.some((v) => v.name === name);

export function bereinigeVorlage(x = {}) {
  return {
    id: ID_MUSTER.test(x.id) ? x.id : neueId(),
    name: String(x.name || "").trim().slice(0, MAX_NAME),
    ...bereinigeMessplan(x),
    standard: false,
  };
}

// Eigene Vorlagen ohne leere Namen und ohne Namen der Standard-Messpläne; je Name nur die letzte
export function bereinigeEigeneVorlagen(liste) {
  if (!Array.isArray(liste)) return [];
  const nachName = new Map();
  for (const v of liste.map(bereinigeVorlage)) {
    if (v.name && !istStandardName(v.name)) nachName.set(v.name, v);
  }
  return [...nachName.values()].slice(-MAX_EIGENE_VORLAGEN);
}

// Übernimmt einen Messplan als eigene Vorlage; eine gleichnamige wird ersetzt (behält ihre ID)
export function mitVorlage(eigene, messplan) {
  const neu = bereinigeVorlage({ ...messplan, id: undefined });
  const alt = eigene.find((v) => v.name === neu.name);
  return bereinigeEigeneVorlagen([...eigene.filter((v) => v !== alt), { ...neu, id: alt?.id ?? neu.id }]);
}
