// Stellt aus dem gespeicherten Probanden zusammen, was gemessen wird: Messplan und Kontext
// (Messplan-Name, Elektroden-Platzierung, Notiz). Der Browser schickt nur IDs und die Notiz, damit
// in der Aufnahme genau das steht, was beim Probanden gespeichert ist.
import { HttpFehler } from "./http.js";

const MAX_NOTIZ = 500;

// Platzierung und Notiz, wie sie mit einer Aufnahme gespeichert werden
export function aufnahmeKontext(proband, { platzierungId, notiz } = {}) {
  const pl = platzierungId ? proband.platzierungen.find((x) => x.id === platzierungId) : null;
  if (platzierungId && !pl) throw new HttpFehler(400, "Platzierung nicht gefunden.");
  return {
    platzierung: pl && { id: pl.id, name: pl.name, variante: pl.variante, elektrodenAbstand: pl.elektrodenAbstand },
    notiz: String(notiz || "").trim().slice(0, MAX_NOTIZ),
  };
}

export function erstelleAuftrag(proband, { messplanId, platzierungId, notiz } = {}) {
  const eintrag = proband.messplaene.find((m) => m.id === messplanId);
  if (!eintrag) throw new HttpFehler(400, "Messplan nicht gefunden.");
  const { id, name, ...plan } = eintrag;
  if (!plan.bewegungen.length) throw new HttpFehler(400, "Bitte mindestens eine Bewegung angeben.");
  return { plan, kontext: { messplan: { id, name }, ...aufnahmeKontext(proband, { platzierungId, notiz }) } };
}
