// Die Messpläne eines Probanden: jeder mit eigener ID und eigenem Namen (z. B. „Finger einzeln“, „Pinch“).
// Wird von Browser und Server genutzt. Ältere Probanden hatten genau einen Messplan direkt am
// Probanden (proband.messplan); daraus wird der erste Eintrag.
import { bereinigeMessplan } from "./messplan.js";
import { neueId } from "./platzierungen.js";

const MAX_ANZAHL = 20;
const MAX_NAME = 80;
const ID_MUSTER = /^[a-f0-9]{8}$/;
const STANDARD_NAME = "Messplan";

function freierName(basis, vorhandene) {
  const namen = new Set(vorhandene.map((m) => m.name));
  if (!namen.has(basis)) return basis;
  for (let i = 2; ; i++) if (!namen.has(`${basis} ${i}`)) return `${basis} ${i}`;
}

export function bereinigeEintrag(x = {}) {
  return {
    id: ID_MUSTER.test(x.id) ? x.id : neueId(),
    name: String(x.name || "").trim().slice(0, MAX_NAME) || STANDARD_NAME,
    ...bereinigeMessplan(x),
  };
}

// vorlage: ein vorhandener Messplan, dessen Einstellungen übernommen werden (Kopie)
export function neuerMessplan(vorhandene = [], vorlage = {}, name) {
  return bereinigeEintrag({ ...vorlage, id: undefined, name: (name || "").trim() || freierName(STANDARD_NAME, vorhandene) });
}

export function normalisiereMessplaene(proband) {
  let liste = Array.isArray(proband.messplaene) ? proband.messplaene : [];
  if (!liste.length) liste = [proband.messplan ? { ...proband.messplan, name: STANDARD_NAME } : {}];
  const ids = new Set();
  proband.messplaene = liste.slice(0, MAX_ANZAHL).map(bereinigeEintrag).map((m) => {
    while (ids.has(m.id)) m.id = neueId();
    ids.add(m.id);
    return m;
  });
  delete proband.messplan;
  return proband;
}

export const MAX_MESSPLAENE = MAX_ANZAHL;
