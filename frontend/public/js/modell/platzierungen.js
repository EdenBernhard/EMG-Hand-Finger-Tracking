// Platzierungen eines Probanden: Jede ist eine eigene Berechnung (Anordnung, Elektrodenabstand,
// Notiz) auf Basis derselben Maße und Fotos. Wird von Browser und Server gleichermaßen genutzt.
import { VARIANTEN, STANDARD_VARIANTE } from "./varianten.js";
import { ANNAHMEN } from "./annahmen.js";
import { positiveZahl } from "./zahl.js";

const MAX_ANZAHL = 20;
const MAX_NAME = 80;
const MAX_NOTIZ = 500;
const ID_MUSTER = /^[a-f0-9]{8}$/;

export function neueId() {
  const bytes = crypto.getRandomValues(new Uint8Array(4));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

// Name wie die Anordnung; bei Wiederholung „(2)“, „(3)“ … anhängen
function freierName(basis, vorhandene) {
  const namen = new Set(vorhandene.map((p) => p.name));
  if (!namen.has(basis)) return basis;
  for (let i = 2; ; i++) if (!namen.has(`${basis} (${i})`)) return `${basis} (${i})`;
}

export function neuePlatzierung(vorhandene = [], { variante = STANDARD_VARIANTE, elektrodenAbstand, name } = {}) {
  const v = VARIANTEN[variante] ? variante : STANDARD_VARIANTE;
  return bereinige({
    id: neueId(),
    name: (name || "").trim() || freierName(VARIANTEN[v].name, vorhandene),
    variante: v,
    elektrodenAbstand: elektrodenAbstand ?? ANNAHMEN.elektrodenAbstandCm,
    notiz: "",
    erstellt: new Date().toISOString(),
  });
}

// Nur bekannte Felder mit gültigen Werten übernehmen
export function bereinige(x) {
  const { min, max } = ANNAHMEN.elektrodenAbstandBereichCm;
  const abstand = positiveZahl(x.elektrodenAbstand);
  return {
    id: ID_MUSTER.test(x.id) ? x.id : neueId(),
    name: String(x.name || "").trim().slice(0, MAX_NAME) || "Platzierung",
    variante: VARIANTEN[x.variante] ? x.variante : STANDARD_VARIANTE,
    elektrodenAbstand: abstand && abstand >= min && abstand <= max ? abstand : ANNAHMEN.elektrodenAbstandCm,
    notiz: String(x.notiz || "").slice(0, MAX_NOTIZ),
    erstellt: typeof x.erstellt === "string" ? x.erstellt : new Date().toISOString(),
  };
}

// Bringt die Platzierungen eines Probanden in gültige Form. Ältere Probanden hatten genau eine
// Anordnung direkt am Probanden (variante, elektrodenAbstand); daraus wird die erste Platzierung.
export function normalisiere(proband) {
  let liste = Array.isArray(proband.platzierungen) ? proband.platzierungen : null;
  if (!liste) {
    liste = [neuePlatzierung([], { variante: proband.variante, elektrodenAbstand: proband.elektrodenAbstand })];
  }
  const ids = new Set();
  proband.platzierungen = liste.slice(0, MAX_ANZAHL).map(bereinige).map((p) => {
    while (ids.has(p.id)) p.id = neueId();
    ids.add(p.id);
    return p;
  });
  delete proband.variante;
  delete proband.elektrodenAbstand;
  return proband;
}

export const MAX_PLATZIERUNGEN = MAX_ANZAHL;
