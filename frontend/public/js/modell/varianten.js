// Elektroden-Anordnungen. Startwerte aus Atlas-Proportionen (Prometheus) und Literatur
// (Basmajian & Blumenstein; Cao et al. 2024, WETrak), vor der Messung per Testbewegung prüfen.
//
// Felder je Kanal:
//   seite            "innen" (Handfläche oben) | "oben" (Handrücken oben)
//   anteil           Lage auf der Mittellinie, 0 = Ellenbogen, 1 = Handgelenk
//   cmVomHandgelenk  alternativ: feste Entfernung vom Handgelenkspunkt in cm
//   quer             seitlicher Abstand auf der Haut in cm, + = Daumenseite, − = Kleinfingerseite
//   winkel           Neigung des Elektrodenpaars in Grad, + = handnahes Ende zeigt zur Daumenseite

// Anordnung A: gezielt auf die Muskelbäuche im ellenbogennahen Unterarm
const KANAELE_A = [
  { ch: "K1", name: "Fingerbeuger", fach: "M. flexor digitorum superficialis", seite: "innen",
    anteil: 0.45, quer: -1.0, winkel: 0,
    test: "Zeige- und Mittelfinger krümmen, als würdest du etwas festkrallen." },
  { ch: "K2", name: "Tiefer Fingerbeuger", fach: "M. flexor digitorum profundus", seite: "innen",
    anteil: 0.35, quer: -3.0, winkel: 0,
    test: "Fingerspitzen fest in die Handfläche drücken (Faust, nur die Endglieder)." },
  { ch: "K3", name: "Fingerstrecker", fach: "M. extensor digitorum", seite: "oben",
    anteil: 0.35, quer: 0, winkel: 0,
    test: "Finger gerade nach oben strecken, Handgelenk bleibt locker." },
  { ch: "K4", name: "Daumen-Abspreizer", fach: "Mm. abductor pollicis longus / extensor pollicis brevis", seite: "oben",
    anteil: 0.68, quer: 2.0, winkel: 25,
    test: "Daumen weit zur Seite wegspreizen." },
  { ch: "K5", name: "Daumenbeuger", fach: "M. flexor pollicis longus", seite: "innen",
    anteil: 0.72, quer: 2.0, winkel: 10, optional: true,
    test: "Nur das vorderste Daumenglied einknicken." },
];

// Anordnung D: drei Kanäle aus A an exakt denselben Stellen, damit sich 3 und 5 Sensoren
// direkt vergleichen lassen. Daumenbeuger statt Abspreizer, weil er für den Pinch-Griff nötig ist
// und sich nicht aus den Streckern ableiten lässt.
const D_AUS_A = ["K1", "K3", "K5"];
const KANAELE_D = D_AUS_A.map((ch, i) => ({ ...KANAELE_A.find((k) => k.ch === ch), ch: `S${i + 1}`, optional: false }));

export const VARIANTEN = {
  A: {
    name: "A · Nah am Ellenbogen",
    text: "Elektroden auf den dicken Muskelbäuchen. Gute, kräftige Signale. Empfohlener Start.",
    kanaele: KANAELE_A,
  },
  B: {
    name: "B · Nah am Handgelenk",
    text: "Alle Elektroden wie ein Armband kurz über dem Handgelenk (nach Cao et al. 2024, WETrak). Gut für einzelne Finger.",
    kanaele: [
      { ch: "C1", name: "Kleinfinger-Strecker", fach: "M. extensor digiti minimi", seite: "oben",
        cmVomHandgelenk: 4, quer: -1.8, winkel: 0, optional: true,
        test: "Kleinen Finger strecken." },
      { ch: "C2", name: "Fingerstrecker", fach: "M. extensor digitorum", seite: "oben",
        cmVomHandgelenk: 4, quer: 0, winkel: 0,
        test: "Zeige- und Mittelfinger strecken." },
      { ch: "C3", name: "Daumenstrecker", fach: "Mm. abductor pollicis longus / extensor pollicis brevis et longus", seite: "oben",
        cmVomHandgelenk: 6, quer: 2.2, winkel: 25,
        test: "Daumen abspreizen und strecken." },
      { ch: "C4", name: "Daumenbeuger", fach: "M. flexor pollicis longus", seite: "innen",
        cmVomHandgelenk: 4.5, quer: 1.8, winkel: 10,
        test: "Vorderstes Daumenglied einknicken. Nicht direkt auf die Pulsstelle kleben." },
      { ch: "C5", name: "Fingerbeuger", fach: "M. flexor digitorum superficialis", seite: "innen",
        cmVomHandgelenk: 4, quer: -0.5, winkel: 0,
        test: "Zeige- und Mittelfinger krümmen." },
    ],
  },
  C: {
    name: "C · Ring",
    text: "6 Sensoren gleichmäßig rund um den Unterarm, ohne gezielte Muskeln. Gut zum Vergleichen.",
    ring: { anzahl: 6, anteilAbEllenbogen: 1 / 3 },
    kanaele: [], // wird in ring.js aus dem Umfang berechnet
  },
  D: {
    name: "D · Nur 3 Sensoren",
    text: "Fingerbeuger, Fingerstrecker und Daumenbeuger an denselben Stellen wie in A. Gut für den Pinch-Griff; das Abspreizen des Daumens wird nur indirekt mitgemessen.",
    kanaele: KANAELE_D,
  },
  E: {
    name: "E · Ring mit 3 Sensoren",
    text: "3 Sensoren gleichmäßig rund um den Unterarm (alle 120°): einer oben über dem Fingerstrecker, zwei auf der Innenseite. Gegenstück zu D: gleiche Sensorzahl, aber ohne gezielte Muskeln.",
    ring: { anzahl: 3, anteilAbEllenbogen: 1 / 3 },
    kanaele: [], // wird in ring.js aus dem Umfang berechnet
  },
};

export const STANDARD_VARIANTE = "A";
