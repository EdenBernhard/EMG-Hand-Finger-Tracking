// Messpläne eines Probanden als Tabs: auswählen, neu anlegen, kopieren, löschen.
import { sitzung } from "../sitzung.js";
import { esc } from "../hilfen.js";
import { neuerMessplan, MAX_MESSPLAENE } from "../modell/messplaene.js";

const adresse = (p, m) => `#/p/${p.id}/messung/${m.id}`;

const tabs = (p, aktiv) => p.messplaene.map((m) =>
  `<a href="${adresse(p, m)}" class="${m.id === aktiv.id ? "aktiv" : ""}">${esc(m.name)}</a>`).join("");

// Gibt eine Funktion zurück, die die Tabs neu zeichnet (z. B. nach einer Namensänderung)
export function zeigeMessplanAuswahl(el, p, aktiv) {
  const voll = p.messplaene.length >= MAX_MESSPLAENE;
  el.innerHTML = `
    <div class="karte">
      <h2 style="margin-top:0">Messpläne</h2>
      <p class="klein">Jeder Messplan ist ein eigener Ablauf (z. B. „Finger einzeln“, „Pinch“). Jeder lässt sich beliebig oft messen.</p>
      <div class="tabs" id="mpa-tabs">${tabs(p, aktiv)}</div>
      <div class="reihe">
        <button class="haupt" id="mpa-neu" ${voll ? "disabled" : ""}>+ Neuer Messplan</button>
        <button id="mpa-kopie" ${voll ? "disabled" : ""}>Als Kopie anlegen</button>
        <button class="gefahr" id="mpa-loeschen" ${p.messplaene.length < 2 ? "disabled" : ""}>Löschen</button>
        ${voll ? `<span class="klein">Höchstens ${MAX_MESSPLAENE} Messpläne.</span>` : ""}
      </div>
    </div>`;

  const oeffne = async (neu) => {
    p.messplaene.push(neu);
    await sitzung.speichereJetzt();
    location.hash = adresse(p, neu);
  };
  el.querySelector("#mpa-neu").addEventListener("click", () => oeffne(neuerMessplan(p.messplaene)));
  el.querySelector("#mpa-kopie").addEventListener("click", () =>
    oeffne(neuerMessplan(p.messplaene, aktiv, `${aktiv.name} (Kopie)`)));
  el.querySelector("#mpa-loeschen").addEventListener("click", async () => {
    if (!confirm(`Messplan „${aktiv.name}“ löschen? Bisherige Messungen bleiben erhalten.`)) return;
    p.messplaene = p.messplaene.filter((m) => m !== aktiv);
    await sitzung.speichereJetzt();
    location.hash = adresse(p, p.messplaene[0]);
  });
  return () => { el.querySelector("#mpa-tabs").innerHTML = tabs(p, aktiv); };
}
