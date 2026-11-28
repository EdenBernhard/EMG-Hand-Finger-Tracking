// Knöpfe in der Spalte „Analyse“ der bisherigen Messungen: Notebook für eine Aufnahme ausführen lassen
// (auch für alle ohne Analyse auf einmal), Warteschlange und Fortschritt verfolgen und die fertige Seite in
// einem neuen Tab öffnen.
import { api } from "../api.js";
import { esc } from "../hilfen.js";

const ABFRAGE_MS = 2000;
// wie server/analyseSteuerung.js
const STATUS = { keine: "keine", wartet: "wartet", laeuft: "laeuft", fertig: "fertig", fehler: "fehler" };
const aktiv = (status) => status === STATUS.wartet || status === STATUS.laeuft;
export const ALLE_STARTEN_ID = "al-alle";

function zeichne(zelle, p, { status, fehler, hinweis, vorher }) {
  zelle.dataset.status = status;
  const name = zelle.dataset.analyse;
  const oeffnen = `<a class="knopf" href="${esc(api.analyseUrl(p.id, name))}" target="_blank" rel="noopener">Anzeigen</a>`;
  const starten = (text) => `<button data-start>${text}</button>`;
  if (status === STATUS.laeuft) zelle.innerHTML = `<span class="klein">läuft …</span>`;
  else if (status === STATUS.wartet) {
    zelle.innerHTML = `<span class="klein">wartet${vorher ? ` (${vorher} davor)` : ""} …</span>`;
  } else if (status === STATUS.fertig) {
    zelle.innerHTML = `${oeffnen} ${starten("Neu")}` +
      (hinweis ? `<div class="klein" title="${esc(hinweis)}">Notebook brach ab: ${esc(hinweis)}</div>` : "");
  } else if (status === STATUS.fehler) {
    zelle.innerHTML = `${starten("Erneut")}<div class="fehler" title="${esc(fehler)}">${esc(fehler)}</div>`;
  } else zelle.innerHTML = starten("Analysieren");
}

// Fragt den Zustand ab, bis die Analyse weder wartet noch läuft
function verfolge(zelle, p) {
  const takt = setInterval(async () => {
    if (!zelle.isConnected) return clearInterval(takt);   // Ansicht gewechselt
    const z = await api.analyseZustand(p.id, zelle.dataset.analyse).catch((e) => ({ status: STATUS.fehler, fehler: e.message }));
    zeichne(zelle, p, z);
    if (!aktiv(z.status)) clearInterval(takt);
  }, ABFRAGE_MS);
}

async function starte(zelle, p) {
  zeichne(zelle, p, { status: STATUS.wartet });
  try {
    zeichne(zelle, p, await api.starteAnalyse(p.id, zelle.dataset.analyse));
    verfolge(zelle, p);
  } catch (fehler) {
    zeichne(zelle, p, { status: STATUS.fehler, fehler: fehler.message });
  }
}

export async function verbindeAnalysen(el, p) {
  const zellen = [...el.querySelectorAll("[data-analyse]")];
  if (!zellen.length) return;
  // Zustand jeder Aufnahme, damit auch nach Neuladen sichtbar ist, was wartet oder läuft
  const zustaende = await Promise.all(zellen.map((z) =>
    api.analyseZustand(p.id, z.dataset.analyse).catch(() => ({ status: STATUS.keine }))));
  zellen.forEach((zelle, i) => {
    zeichne(zelle, p, zustaende[i]);
    if (aktiv(zustaende[i].status)) verfolge(zelle, p);
    zelle.addEventListener("click", (e) => {
      if (e.target.closest("[data-start]")) starte(zelle, p);
    });
  });
  const alle = el.querySelector(`#${ALLE_STARTEN_ID}`);
  alle?.addEventListener("click", async () => {
    alle.disabled = true;
    // nacheinander anstoßen, damit die Warteschlange der Reihenfolge der Tabelle folgt
    for (const zelle of zellen.filter((z) => z.dataset.status === STATUS.keine)) await starte(zelle, p);
    alle.disabled = false;
  });
}
