// Welche Schritte für einen Probanden schon erledigt sind.
import { MESSUNGEN } from "./messpunkte.js";
import { seitenGeometrie } from "./seitenGeometrie.js";
import { positiveZahl } from "./zahl.js";

export function fortschritt(proband) {
  const m = proband.mass || {};
  return {
    grunddaten: !!proband.name,
    messungen: MESSUNGEN.every((x) => positiveZahl(m[x.key])),
    innen: !!seitenGeometrie(proband, "innen"),
    oben: !!seitenGeometrie(proband, "oben"),
    aufnahmen: (proband.aufnahmen || []).length > 0,
  };
}
