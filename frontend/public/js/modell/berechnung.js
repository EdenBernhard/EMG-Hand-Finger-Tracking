// Berechnet für eine Platzierung jeden Kanal: Lage auf dem Arm (cm) und auf den Fotos (Pixel).
// Maße und Fotos kommen vom Probanden, Anordnung und Elektrodenabstand von der Platzierung.
import { ANNAHMEN as A } from "./annahmen.js";
import { VARIANTEN, STANDARD_VARIANTE } from "./varianten.js";
import { seitenGeometrie } from "./seitenGeometrie.js";
import { umfangBei, unterarmLaengeCm } from "./umfang.js";
import { ringKanaele } from "./ring.js";
import { positiveZahl } from "./zahl.js";
import { add, sub, mul, norm } from "./vektor.js";

export function variante(platzierung) {
  return VARIANTEN[platzierung.variante] || VARIANTEN[STANDARD_VARIANTE];
}

export function kanaele(proband, platzierung) {
  const v = variante(platzierung);
  return v.ring ? ringKanaele(proband, v.ring) : v.kanaele;
}

export function elektrodenAbstandCm(platzierung) {
  return positiveZahl(platzierung.elektrodenAbstand) || A.elektrodenAbstandCm;
}

// Lage eines Kanals entlang der Mittellinie und um den Arm herum (Zylindermodell)
function lageAufArm(proband, k, geo) {
  const L = geo ? geo.laengeCm : unterarmLaengeCm(proband);
  const anteil = k.anteil != null ? k.anteil : Math.min(1, Math.max(0, 1 - k.cmVomHandgelenk / L));
  const umfang = umfangBei(proband, anteil);
  const radiusCm = umfang / (2 * Math.PI);
  const winkelUmArm = k.quer / radiusCm;
  return {
    anteil, umfang, radiusCm,
    cmVomHandgelenk: (1 - anteil) * L,
    amRand: Math.abs(winkelUmArm) > A.randWinkelRad,
    winkelUmArm: Math.max(-Math.PI / 2, Math.min(Math.PI / 2, winkelUmArm)),
  };
}

// Projektion auf das Foto: seitlicher Versatz = r · sin(φ), weiter außen also verkürzt
function lageAufFoto(platzierung, k, lage, geo) {
  const basis = add(geo.start, mul(sub(geo.ende, geo.start), lage.anteil));
  const mitte = add(basis, mul(geo.n, lage.radiusCm * Math.sin(lage.winkelUmArm) * geo.pxProCm));
  const w = ((k.winkel || 0) * Math.PI) / 180;
  const richtung = norm(add(mul(geo.e, Math.cos(w)), mul(geo.n, Math.sin(w))));
  const verkuerzung = Math.max(A.minVerkuerzung, Math.sqrt(Math.cos(lage.winkelUmArm)));
  const halb = (elektrodenAbstandCm(platzierung) / 2) * geo.pxProCm * verkuerzung;
  return {
    mitte,
    e1: sub(mitte, mul(richtung, halb)),   // ellenbogennahe Elektrode
    e2: add(mitte, mul(richtung, halb)),   // handnahe Elektrode
    radius: A.elektrodenRadiusCm * geo.pxProCm,
  };
}

export function berechne(proband, platzierung) {
  const geo = { innen: seitenGeometrie(proband, "innen"), oben: seitenGeometrie(proband, "oben") };
  const liste = kanaele(proband, platzierung).map((k, index) => {
    const g = geo[k.seite];
    const lage = lageAufArm(proband, k, g);
    return { ...k, index, ...lage, px: g ? lageAufFoto(platzierung, k, lage, g) : null };
  });
  return { geo, kanaele: liste, abstandCm: elektrodenAbstandCm(platzierung) };
}
