// Schritt 6: Platzierungen eines Probanden anlegen, auswählen, bearbeiten, löschen.
import { sitzung } from "../sitzung.js";
import { esc } from "../hilfen.js";
import { VARIANTEN, STANDARD_VARIANTE } from "../modell/varianten.js";
import { ANNAHMEN } from "../modell/annahmen.js";
import { fortschritt } from "../modell/fortschritt.js";
import { neuePlatzierung, MAX_PLATZIERUNGEN } from "../modell/platzierungen.js";
import { zeigeErgebnis } from "./ergebnisAnsicht.js";

const optionen = (aktiv) => Object.entries(VARIANTEN)
  .map(([k, v]) => `<option value="${k}" ${k === aktiv ? "selected" : ""}>${esc(v.name)}</option>`).join("");

function hinweise(p) {
  const f = fortschritt(p);
  return [
    [!f.messungen, "messen", "Maße fehlen – Werte werden geschätzt"],
    [!f.innen, "innen", "Foto Innenseite oder Punkte fehlen"],
    [!f.oben, "oben", "Foto Oberseite oder Punkte fehlen"],
  ].filter(([ja]) => ja)
    .map(([, s, t]) => `<div class="hinweis nicht-drucken">${esc(t)}. <a href="#/p/${p.id}/${s}">Jetzt ergänzen</a></div>`).join("");
}

const tabs = (p, aktiv) => p.platzierungen.map((x) =>
  `<a href="#/p/${p.id}/platzierungen/${x.id}" class="${aktiv && x.id === aktiv.id ? "aktiv" : ""}">${esc(x.name)}</a>`).join("");

function einstellungen(a) {
  const { min, max } = ANNAHMEN.elektrodenAbstandBereichCm;
  return `<div class="karte nicht-drucken">
    <div class="einstellungen">
      <div><label for="pl-name" style="margin-top:0">Name der Platzierung</label>
        <input type="text" id="pl-name" maxlength="80" value="${esc(a.name)}"></div>
      <div><label for="pl-variante" style="margin-top:0">Anordnung</label>
        <select id="pl-variante">${optionen(a.variante)}</select></div>
      <div><label for="pl-abstand" style="margin-top:0">Elektrodenabstand</label>
        <div class="feld-einheit"><input type="number" id="pl-abstand" min="${min}" max="${max}" step="0.5" value="${esc(a.elektrodenAbstand)}"> cm</div></div>
    </div>
    <label for="pl-notiz">Notiz zu dieser Platzierung (optional)</label>
    <textarea id="pl-notiz" rows="2" placeholder="z. B. Sitzung 2, K2 einen Zentimeter weiter nach außen gesetzt">${esc(a.notiz)}</textarea>
    <div class="reihe" style="margin-top:.8rem">
      <button id="pl-kopie">Als Kopie anlegen</button>
      <button id="pl-drucken">Drucken</button>
      <button class="gefahr" id="pl-loeschen">Löschen</button>
    </div>
  </div>`;
}

export async function zeigePlatzierungen(el, platzierungId) {
  const p = sitzung.proband;
  const aktiv = p.platzierungen.find((x) => x.id === platzierungId) || p.platzierungen[0] || null;
  const voll = p.platzierungen.length >= MAX_PLATZIERUNGEN;

  el.innerHTML = `
    ${hinweise(p)}
    <div class="karte nicht-drucken">
      <h2 style="margin-top:0">Platzierungen</h2>
      <p class="klein">Jede Platzierung ist eine eigene Berechnung mit denselben Maßen und Fotos. So kannst du für diesen Probanden mehrere Anordnungen ausprobieren und vergleichen.</p>
      <div class="tabs" id="tabs">${tabs(p, aktiv)}</div>
      <form class="reihe" id="neu">
        <select id="neu-variante" style="width:auto" aria-label="Anordnung für neue Platzierung">${optionen(STANDARD_VARIANTE)}</select>
        <button class="haupt" ${voll ? "disabled" : ""}>+ Neue Platzierung</button>
        ${voll ? `<span class="klein">Höchstens ${MAX_PLATZIERUNGEN} Platzierungen.</span>` : ""}
      </form>
    </div>
    ${aktiv ? einstellungen(aktiv) : `<p class="klein">Noch keine Platzierung angelegt.</p>`}
    <div id="ergebnis"></div>`;

  const oeffne = async (neu) => {
    p.platzierungen.push(neu);
    await sitzung.speichereJetzt();
    location.hash = `#/p/${p.id}/platzierungen/${neu.id}`;
  };
  el.querySelector("#neu").addEventListener("submit", (ev) => {
    ev.preventDefault();
    oeffne(neuePlatzierung(p.platzierungen, { variante: el.querySelector("#neu-variante").value }));
  });
  if (!aktiv) return;

  const ergebnis = el.querySelector("#ergebnis");
  const neuBerechnen = () => zeigeErgebnis(ergebnis, p, aktiv);
  const aendere = (feld, wert, neuZeichnen) => {
    aktiv[feld] = wert;
    sitzung.speichereSpaeter();
    if (neuZeichnen) neuBerechnen();
  };

  el.querySelector("#pl-name").addEventListener("input", (e) => {
    if (!e.target.value.trim()) return;
    aendere("name", e.target.value.trim(), false);
    el.querySelector("#tabs").innerHTML = tabs(p, aktiv);
    ergebnis.querySelector("h2").textContent = aktiv.name;
  });
  el.querySelector("#pl-variante").addEventListener("change", (e) => aendere("variante", e.target.value, true));
  el.querySelector("#pl-abstand").addEventListener("change", (e) => {
    const v = parseFloat(e.target.value);
    if (Number.isFinite(v)) aendere("elektrodenAbstand", v, true);
  });
  el.querySelector("#pl-notiz").addEventListener("change", (e) => aendere("notiz", e.target.value, true));
  el.querySelector("#pl-drucken").addEventListener("click", () => window.print());
  el.querySelector("#pl-kopie").disabled = voll;
  el.querySelector("#pl-kopie").addEventListener("click", () => {
    const kopie = neuePlatzierung(p.platzierungen,
      { variante: aktiv.variante, elektrodenAbstand: aktiv.elektrodenAbstand, name: `${aktiv.name} (Kopie)` });
    oeffne({ ...kopie, notiz: aktiv.notiz });
  });
  el.querySelector("#pl-loeschen").addEventListener("click", async () => {
    if (!confirm(`Platzierung „${aktiv.name}“ löschen? Maße und Fotos bleiben erhalten.`)) return;
    p.platzierungen = p.platzierungen.filter((x) => x !== aktiv);
    await sitzung.speichereJetzt();
    const naechste = p.platzierungen[0];
    const ziel = `#/p/${p.id}/platzierungen${naechste ? "/" + naechste.id : ""}`;
    if (location.hash === ziel) zeigePlatzierungen(el, naechste && naechste.id);
    else location.hash = ziel;
  });

  await neuBerechnen();
}
