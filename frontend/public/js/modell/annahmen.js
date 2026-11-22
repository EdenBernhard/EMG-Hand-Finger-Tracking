// Alle Zahlen-Annahmen des Modells an einer Stelle (keine Magic Numbers im Code).

export const ANNAHMEN = {
  // Elektroden
  elektrodenAbstandCm: 2,          // Mitte zu Mitte, SENIAM; beim Pico durch die Druckknöpfe vorgegeben
  elektrodenRadiusCm: 0.5,         // gezeichneter Gelkontakt
  elektrodenAbstandBereichCm: { min: 1, max: 5 },

  // Ersatzwerte, wenn Maße fehlen (Durchschnittsarm)
  standardLaengeCm: 25,
  umfangDickFaktor: 1.05,          // Umfang dickste Stelle ≈ 1,05 × Unterarmlänge
  umfangHandFaktor: 0.65,          // Umfang über dem Handgelenk ≈ 0,65 × Unterarmlänge

  // Wo die Umfänge gemessen werden
  dicksteStelleAnteil: 0.25,       // dickste Stelle bei ca. 25 % ab Ellenbogen
  umfangHandAbstandCm: 4,          // Messstelle „4 Finger breit über dem Handgelenk“
  minUmfangHandFaktor: 0.95,       // Umfang wird distal nicht kleiner als 95 % des Handgelenk-Umfangs
  minAbstandMessstellen: 0.25,     // Schutz bei sehr kurzen Armen: Messstellen mind. 25 % auseinander

  // Darstellung
  randWinkelRad: 1.2,              // ab diesem Winkel um den Arm gilt eine Position als „am Rand“
  minVerkuerzung: 0.35,            // Elektrodenpaar wird am Rand höchstens auf 35 % verkürzt gezeichnet
};
