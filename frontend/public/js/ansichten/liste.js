// Startseite: alle Probanden, neuen anlegen, öffnen, löschen.
import { api } from "../api.js";
import { sitzung } from "../sitzung.js";
import { esc, datum } from "../hilfen.js";
import { fortschritt } from "../modell/fortschritt.js";

const chip = (ok, text) => `<span class="chip ${ok ? "ok" : ""}">${ok ? "✓ " : ""}${text}</span>`;

function eintrag(p) {
  const f = fortschritt(p);
  const ziel = f.messungen && f.innen && f.oben ? "platzierungen" : "daten";
  const n = p.platzierungen.length;
  return `<div class="karte liste-eintrag">
    <div>
      <h3>${esc(p.name)} <span class="klein">· Arm ${esc(p.arm)} · ${n} ${n === 1 ? "Platzierung" : "Platzierungen"}</span></h3>
      <div class="chips">${chip(f.messungen, "Maße")}${chip(f.innen, "Foto innen")}${chip(f.oben, "Foto oben")}${chip(f.aufnahmen, "EMG-Messung")}</div>
      <p class="klein">Zuletzt geändert ${datum(p.geaendert)}</p>
    </div>
    <div class="reihe">
      <a class="knopf haupt" href="#/p/${p.id}/${ziel}">Öffnen</a>
      <button class="gefahr" data-loeschen="${p.id}" data-name="${esc(p.name)}">Löschen</button>
    </div>
  </div>`;
}

export async function zeigeListe(el) {
  const liste = await api.liste();
  el.innerHTML = `
    <h1>Probanden</h1>
    <p class="klein">Für jeden Probanden wird die Platzierung einzeln berechnet. Alles wird automatisch gespeichert.</p>
    <form class="karte reihe" id="neu">
      <div style="flex:1;min-width:220px">
        <label for="neu-name" style="margin-top:0">Neuer Proband</label>
        <input type="text" id="neu-name" placeholder="Name oder Kürzel, z. B. P01" maxlength="80" required>
      </div>
      <button class="haupt" style="align-self:flex-end">Anlegen und starten</button>
    </form>
    <p class="fehler" id="neu-fehler"></p>
    ${liste.length ? liste.map(eintrag).join("") : `<p class="klein">Noch keine Probanden angelegt.</p>`}`;

  el.querySelector("#neu").addEventListener("submit", async (ev) => {
    ev.preventDefault();
    try {
      const p = await api.legeAn(el.querySelector("#neu-name").value);
      sitzung.setze(p);
      location.hash = `#/p/${p.id}/daten`;
    } catch (e) {
      el.querySelector("#neu-fehler").textContent = e.message;
    }
  });
  el.querySelectorAll("[data-loeschen]").forEach((b) => b.addEventListener("click", async () => {
    if (!confirm(`Proband „${b.dataset.name}“ mit allen Fotos löschen?`)) return;
    await api.loesche(b.dataset.loeschen);
    zeigeListe(el);
  }));
}
