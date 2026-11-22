// Zugriff auf die Server-API.

async function anfrage(pfad, { methode = "GET", daten } = {}) {
  const r = await fetch(pfad, {
    method: methode,
    headers: daten ? { "Content-Type": "application/json" } : undefined,
    body: daten ? JSON.stringify(daten) : undefined,
  });
  if (r.status === 204) return null;
  const antwort = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(antwort.fehler || `Fehler ${r.status}`);
  return antwort;
}

export const api = {
  liste: () => anfrage("/api/probanden"),
  lade: (id) => anfrage(`/api/probanden/${id}`),
  legeAn: (name) => anfrage("/api/probanden", { methode: "POST", daten: { name } }),
  speichere: (id, daten) => anfrage(`/api/probanden/${id}`, { methode: "PUT", daten }),
  loesche: (id) => anfrage(`/api/probanden/${id}`, { methode: "DELETE" }),
  ladeBildHoch: (id, seite, bild) => anfrage(`/api/probanden/${id}/bild/${seite}`, { methode: "POST", daten: bild }),
  // auftrag: { messplanId, platzierungId, notiz }
  starteMessung: (id, auftrag) => anfrage(`/api/probanden/${id}/messung`, { methode: "POST", daten: auftrag }),
  stoppeMessung: () => anfrage("/api/messung/stopp", { methode: "POST" }),
  // Ruft beiEreignis mit jedem Ereignis der Messung auf (zuerst den aktuellen Zustand); gibt eine Abmeldefunktion zurück
  abonniereMessung(beiEreignis) {
    const quelle = new EventSource("/api/messung/ereignisse");
    quelle.onmessage = (e) => beiEreignis(JSON.parse(e.data));
    return () => quelle.close();
  },
  bildUrl: (id, seiteDaten) =>
    seiteDaten && seiteDaten.bild ? `/bilder/${id}/${seiteDaten.bild}?v=${seiteDaten.version || 0}` : null,
};
