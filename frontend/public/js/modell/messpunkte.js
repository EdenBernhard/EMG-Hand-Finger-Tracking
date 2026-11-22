// Messpunkte, die auf den Fotos angeklickt werden, und die Maßband-Messungen.
// Texte bewusst ohne Fachsprache: Sie werden so in der Oberfläche angezeigt.

export const SEITEN = ["innen", "oben"];

export const PUNKTE = {
  innen: [
    { key: "armbeuge", name: "Mitte der Armbeuge",
      tipp: "Die Falte innen am Ellenbogen. Setz den Punkt genau in die Mitte der Falte." },
    { key: "handgelenk", name: "Mitte der Handgelenksfalte",
      tipp: "Die Falte am Handgelenk, die dem Ellenbogen am nächsten ist. Punkt in die Mitte." },
    { key: "daumen", name: "Daumen", nurFoto: true,
      tipp: "Klick einfach irgendwo auf den Daumen. So weiß die Seite, wo die Daumenseite ist." },
  ],
  oben: [
    { key: "spitze", name: "Ellenbogenspitze",
      tipp: "Der harte Knochen hinten am Ellenbogen, auf den man sich aufstützt." },
    { key: "knubbel", name: "Knubbel außen am Ellenbogen",
      tipp: "Der Knochenhöcker am Ellenbogen auf der Daumenseite. Am besten tastbar, wenn der Arm leicht gebeugt ist." },
    { key: "handgelenk", name: "Mitte des Handgelenks oben",
      tipp: "Auf der Handrückenseite, genau in der Mitte zwischen den beiden Knochenhöckern am Handgelenk." },
  ],
};

export const MESSUNGEN = [
  { key: "laengeInnen", name: "Länge Innenseite",
    tipp: "Maßband von der Mitte der Armbeuge gerade bis zur Mitte der Handgelenksfalte." },
  { key: "laengeOben", name: "Länge Oberseite",
    tipp: "Maßband vom Knubbel außen am Ellenbogen bis zur Mitte des Handgelenks oben." },
  { key: "umfangDick", name: "Umfang an der dicksten Stelle",
    tipp: "Maßband einmal um den Unterarm, dort wo er am dicksten ist (kurz unter dem Ellenbogen)." },
  { key: "umfangHand", name: "Umfang kurz über dem Handgelenk",
    tipp: "Maßband einmal um den Unterarm, 4 Finger breit (ca. 4 cm) oberhalb der Handgelenksfalte." },
];

// Plausibler Wertebereich für Maßband-Eingaben in cm
export const MESSBEREICH_CM = { min: 5, max: 60 };
