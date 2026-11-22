// Kanäle einer Ring-Anordnung: N Sensoren gleichmäßig um den Unterarm verteilt.
// Start (Kanal 1) ist die Mitte der Oberseite über dem Fingerstrecker, weiter geht es
// über die Kleinfingerseite zur Innenseite und über die Daumenseite zurück.
import { umfangBei, unterarmLaengeCm } from "./umfang.js";

const VOLL = 360;
const VIERTEL = 90;                // bis hierhin (ab Oberseite Mitte) liegt ein Punkt noch oben
const HALB = 180;                  // Mitte der Innenseite
const MITTIG_CM = 0.3;             // kleinere Versätze gelten als „Mitte“

const SEITEN_NAME = { oben: "Oben", innen: "Innen" };

// Winkel um den Arm (0° = Oberseite Mitte, Richtung Kleinfingerseite) → Seite und Versatz auf der Haut
function lageAmUmfang(grad, umfang) {
  const anteil = (g) => (g / VOLL) * umfang;
  if (grad <= VIERTEL) return { seite: "oben", quer: -anteil(grad) };
  if (grad < VOLL - VIERTEL) return { seite: "innen", quer: anteil(grad - HALB) };
  return { seite: "oben", quer: anteil(VOLL - grad) };
}

function name(seite, quer, istStart) {
  const wo = Math.abs(quer) < MITTIG_CM ? "Mitte" : quer < 0 ? "Kleinfingerseite" : "Daumenseite";
  return `${SEITEN_NAME[seite]}, ${wo}${istStart ? " (Startpunkt)" : ""}`;
}

export function ringKanaele(proband, ring) {
  const L = unterarmLaengeCm(proband);
  const cmVomHandgelenk = L * (1 - ring.anteilAbEllenbogen);
  const umfang = umfangBei(proband, ring.anteilAbEllenbogen);

  return Array.from({ length: ring.anzahl }, (_, i) => {
    const { seite, quer } = lageAmUmfang((i * VOLL) / ring.anzahl, umfang);
    return {
      ch: `R${i + 1}`, seite, quer, cmVomHandgelenk, winkel: 0,
      name: name(seite, quer, i === 0), fach: "Ringposition",
      test: "Faust machen: Alle Kanäle sollten etwas Signal zeigen.",
    };
  });
}
