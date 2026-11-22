// Geometrie eines Fotos: Mittellinie, Richtung zur Daumenseite und Maßstab (Pixel pro cm).
import { ANNAHMEN as A } from "./annahmen.js";
import { positiveZahl } from "./zahl.js";
import { sub, mul, len, norm, dot, mid, senkrecht } from "./vektor.js";

// Je Seite: Start/Ende der Mittellinie, Referenzstrecke für den Maßstab und ein Hinweis,
// auf welcher Seite der Mittellinie der Daumen liegt.
const DEFINITION = {
  innen: {
    noetig: ["armbeuge", "handgelenk", "daumen"],
    linie: (p) => [p.armbeuge, p.handgelenk],
    referenz: (p) => [p.armbeuge, p.handgelenk],
    referenzMass: "laengeInnen",
    daumenRichtung: (p) => sub(p.daumen, p.handgelenk),
  },
  oben: {
    noetig: ["spitze", "knubbel", "handgelenk"],
    linie: (p) => [mid(p.spitze, p.knubbel), p.handgelenk],
    referenz: (p) => [p.knubbel, p.handgelenk],
    referenzMass: "laengeOben",
    daumenRichtung: (p) => sub(p.knubbel, mid(p.spitze, p.knubbel)),
  },
};

export function seitenGeometrie(proband, seite) {
  const def = DEFINITION[seite];
  const p = (proband[seite] || {}).punkte || {};
  if (!def || def.noetig.some((k) => !p[k])) return null;

  const [start, ende] = def.linie(p);
  const e = norm(sub(ende, start));                    // Richtung Ellenbogen → Handgelenk
  let n = senkrecht(e);
  if (dot(n, def.daumenRichtung(p)) < 0) n = mul(n, -1); // n zeigt zur Daumenseite

  const [r0, r1] = def.referenz(p);
  const refCm = positiveZahl((proband.mass || {})[def.referenzMass]);
  const pxProCm = len(sub(r1, r0)) / (refCm || A.standardLaengeCm);

  return { seite, start, ende, e, n, pxProCm, laengeCm: len(sub(ende, start)) / pxProCm, geschaetzt: !refCm };
}
