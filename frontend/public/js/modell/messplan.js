// Messplan eines Probanden: welche Bewegungen wie oft direkt hintereinander, in welchem Takt, mit
// welcher Pause nach jeder Bewegung und wie oft der ganze Ablauf durchlaufen wird. Wird von Browser (Eingabe) und Server (Prüfung vor dem
// Start) gleichermaßen genutzt.

export const GRENZEN = {
  intervallS: { min: 1, max: 60, standard: 5 },
  wiederholungen: { min: 1, max: 50, standard: 5 },   // Durchläufe des ganzen Ablaufs
  vorlaufS: { min: 0, max: 30, standard: 3 },          // Ruhe vor der ersten Bewegung
  pauseS: { min: 0, max: 60, standard: 0 },            // Ruhe nach jeder Bewegung (eigene Vorgabe), 0 = keine
  anzahl: { min: 1, max: 20, standard: 1 },            // je Bewegung, direkt hintereinander
  maxBewegungen: 20,
  maxBewegungLaenge: 40,
};

export const STANDARD_BEWEGUNGEN = [
  "Ruhe", "Faust", "Hand öffnen", "Daumen beugen", "Zeigefinger beugen",
  "Mittelfinger beugen", "Ringfinger beugen", "Kleinen Finger beugen",
];

function zahlImBereich(x, { min, max, standard }, ganzzahlig = false) {
  const n = Number(x);
  if (x === "" || x == null || !Number.isFinite(n)) return standard;
  const begrenzt = Math.min(max, Math.max(min, n));
  return ganzzahlig ? Math.round(begrenzt) : begrenzt;
}

// Eine Bewegung als { name, anzahl }; ältere Messpläne speicherten nur den Namen als Text
export function bereinigeBewegung(x) {
  const roh = typeof x === "object" && x !== null ? x : { name: x };
  return {
    name: String(roh.name ?? "").trim().slice(0, GRENZEN.maxBewegungLaenge),
    anzahl: zahlImBereich(roh.anzahl, GRENZEN.anzahl, true),
  };
}

export const neueBewegung = (name = "") => ({ name, anzahl: GRENZEN.anzahl.standard });

// Nur gültige Werte übernehmen; fehlende Angaben bekommen Standardwerte, leere Namen fallen weg
export function bereinigeMessplan(x = {}) {
  const liste = Array.isArray(x.bewegungen) ? x.bewegungen : STANDARD_BEWEGUNGEN;
  return {
    bewegungen: liste.map(bereinigeBewegung).filter((b) => b.name).slice(0, GRENZEN.maxBewegungen),
    intervallS: zahlImBereich(x.intervallS, GRENZEN.intervallS),
    wiederholungen: zahlImBereich(x.wiederholungen, GRENZEN.wiederholungen, true),
    vorlaufS: zahlImBereich(x.vorlaufS, GRENZEN.vorlaufS),
    pauseS: zahlImBereich(x.pauseS, GRENZEN.pauseS),
  };
}

export const vorgabenJeDurchlauf = (plan) => plan.bewegungen.reduce((n, b) => n + b.anzahl, 0);

// Bewegungen über alle Durchläufe, ohne Pausen
export const anzahlBewegungen = (plan) => vorgabenJeDurchlauf(plan) * plan.wiederholungen;

// Alle Vorgaben mit eigenem Piepton: mit Pause folgt jeder Bewegung eine Vorgabe „Ruhe“ (wie im Backend)
export const anzahlVorgaben = (plan) => anzahlBewegungen(plan) * (plan.pauseS > 0 ? 2 : 1);

export const dauerS = (plan) => plan.vorlaufS + anzahlBewegungen(plan) * (plan.intervallS + plan.pauseS);

export const bewegungText = (b) => (b.anzahl > 1 ? `${b.name} ×${b.anzahl}` : b.name);
