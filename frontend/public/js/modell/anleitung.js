// Maßband-Anleitung je Kanal in Alltagssprache.
import { elektrodenAbstandCm } from "./berechnung.js";

const START = { innen: "der Mitte der Handgelenksfalte", oben: "der Mitte des Handgelenks oben" };
const ZIEL = { innen: "Mitte der Armbeuge", oben: "Mitte zwischen Ellenbogenspitze und Knubbel" };
const MIN_QUER_CM = 0.25; // kleinere Versätze werden nicht extra erwähnt

const cm = (x) => x.toFixed(1).replace(".", ",");

export function anleitung(kanal, platzierung) {
  const schritte = [
    `Maßband an ${START[kanal.seite]} anlegen und gerade Richtung ${ZIEL[kanal.seite]} führen. ` +
      `Bei ${cm(kanal.cmVomHandgelenk)} cm markieren.`,
  ];
  if (Math.abs(kanal.quer) >= MIN_QUER_CM) {
    schritte.push(`Von dort ${cm(Math.abs(kanal.quer))} cm um den Arm herum zur ` +
      `${kanal.quer > 0 ? "Daumenseite" : "Kleinfingerseite"} gehen.`);
  }
  schritte.push(`Das ist die Mitte zwischen den beiden Elektroden. Die Elektroden ` +
    `${cm(elektrodenAbstandCm(platzierung))} cm auseinander kleben, ` +
    (kanal.winkel ? "leicht schräg wie auf dem Foto (unteres Ende Richtung Daumen)."
                  : "in Längsrichtung des Arms (Ellenbogen – Hand)."));
  return schritte;
}
