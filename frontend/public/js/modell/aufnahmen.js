// Abgeschlossene EMG-Messungen eines Probanden (nur die Übersicht; die Daten liegen im Backend
// unter backend/data/raw/<proband-id>/<name>.*). Wird von Browser und Server genutzt.

const MAX_ANZAHL = 500;
const NAME_MUSTER = /^[A-Za-z0-9_-]{1,80}$/;

const zahl = (x) => (Number.isFinite(Number(x)) ? Number(x) : 0);

// kontext: { messplan: {id, name}, platzierung: {id, name, variante, elektrodenAbstand} | null, notiz }
export function neueAufnahme(ereignis, plan, kontext) {
  return {
    name: ereignis.recording,
    erstellt: new Date().toISOString(),
    dauerS: zahl(ereignis.duration_s),
    vorgaben: zahl(ereignis.cues),
    vollstaendig: !!ereignis.completed,
    plan,
    ...kontext,
  };
}

export function bereinigeAufnahmen(liste) {
  if (!Array.isArray(liste)) return [];
  return liste.filter((a) => a && NAME_MUSTER.test(a.name)).slice(-MAX_ANZAHL);
}
