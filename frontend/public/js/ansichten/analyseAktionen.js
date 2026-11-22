// Knöpfe in der Spalte „Analyse“ der bisherigen Messungen: Notebook für eine Aufnahme ausführen lassen,
// Fortschritt verfolgen und die fertige Seite in einem neuen Tab öffnen.
import { api } from "../api.js";
import { esc } from "../hilfen.js";

const ABFRAGE_MS = 2000;
const STATUS = { keine: "keine", laeuft: "laeuft", fertig: "fertig", fehler: "fehler" };   // wie server/analyseSteuerung.js

function zeichne(zelle, p, { status, fehler, hinweis }) {
  const name = zelle.dataset.analyse;
  const oeffnen = `<a class="knopf" href="${esc(api.analyseUrl(p.id, name))}" target="_blank" rel="noopener">Anzeigen</a>`;
  const starten = (text) => `<button data-start>${text}</button>`;
  if (status === STATUS.laeuft) zelle.innerHTML = `<span class="klein">läuft …</span>`;
  else if (status === STATUS.fertig) {
    zelle.innerHTML = `${oeffnen} ${starten("Neu")}` +
      (hinweis ? `<div class="klein" title="${esc(hinweis)}">Notebook brach ab: ${esc(hinweis)}</div>` : "");
  } else if (status === STATUS.fehler) {
    zelle.innerHTML = `${starten("Erneut")}<div class="fehler" title="${esc(fehler)}">${esc(fehler)}</div>`;
  } else zelle.innerHTML = starten("Analysieren");
}

// Fragt den Zustand ab, bis die Analyse nicht mehr läuft
function verfolge(zelle, p) {
  const takt = setInterval(async () => {
    if (!zelle.isConnected) return clearInterval(takt);   // Ansicht gewechselt
    const z = await api.analyseZustand(p.id, zelle.dataset.analyse).catch((e) => ({ status: STATUS.fehler, fehler: e.message }));
    if (z.status !== STATUS.laeuft) {
      clearInterval(takt);
      zeichne(zelle, p, z);
    }
  }, ABFRAGE_MS);
}

export async function verbindeAnalysen(el, p) {
  const zellen = [...el.querySelectorAll("[data-analyse]")];
  if (!zellen.length) return;
  const fertig = new Set((await api.analysen(p.id).catch(() => ({ namen: [] }))).namen);
  for (const zelle of zellen) {
    zeichne(zelle, p, { status: fertig.has(zelle.dataset.analyse) ? STATUS.fertig : STATUS.keine });
    zelle.addEventListener("click", async (e) => {
      if (!e.target.closest("[data-start]")) return;
      zeichne(zelle, p, { status: STATUS.laeuft });
      try {
        await api.starteAnalyse(p.id, zelle.dataset.analyse);
        verfolge(zelle, p);
      } catch (fehler) {
        zeichne(zelle, p, { status: STATUS.fehler, fehler: fehler.message });
      }
    });
  }
}
