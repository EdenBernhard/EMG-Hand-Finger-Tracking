// Umfang des Unterarms an einer Stelle entlang der Achse, aus den zwei gemessenen Umfängen.
import { ANNAHMEN as A } from "./annahmen.js";
import { positiveZahl } from "./zahl.js";

export function unterarmLaengeCm(proband) {
  return positiveZahl((proband.mass || {}).laengeInnen) || A.standardLaengeCm;
}

// anteil: 0 = Ellenbogen, 1 = Handgelenk. Bis zur dicksten Stelle konstant, danach linear
// bis zur Messstelle über dem Handgelenk.
export function umfangBei(proband, anteil) {
  const m = proband.mass || {};
  const L = unterarmLaengeCm(proband);
  const dick = positiveZahl(m.umfangDick) || A.umfangDickFaktor * L;
  const hand = positiveZahl(m.umfangHand) || A.umfangHandFaktor * L;
  const tDick = A.dicksteStelleAnteil;
  const tHand = Math.max(tDick + A.minAbstandMessstellen, 1 - A.umfangHandAbstandCm / L);
  if (anteil <= tDick) return dick;
  const k = (anteil - tDick) / (tHand - tDick);
  return Math.max(hand * A.minUmfangHandFaktor, dick + (hand - dick) * k);
}
