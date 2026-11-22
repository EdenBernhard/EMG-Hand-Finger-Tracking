// Schritt 1: Grunddaten des Probanden. Anordnungen werden in Schritt 6 als Platzierungen angelegt.
import { sitzung } from "../sitzung.js";
import { esc } from "../hilfen.js";

const auswahl = (name, wert, aktiv, inhalt) =>
  `<label class="variante"><input type="radio" name="${name}" value="${wert}" ${aktiv ? "checked" : ""}>${inhalt}</label>`;

export function zeigeDaten(el) {
  const p = sitzung.proband;
  el.innerHTML = `
    <div class="karte">
      <label for="f-name" style="margin-top:0">Name oder Kürzel</label>
      <input type="text" id="f-name" value="${esc(p.name)}" maxlength="80">

      <label>Welcher Arm wird gemessen?</label>
      <div class="reihe">
        ${auswahl("arm", "rechts", p.arm === "rechts", "Rechter Arm")}
        ${auswahl("arm", "links", p.arm === "links", "Linker Arm")}
      </div>

      <label for="f-notiz">Notiz (optional)</label>
      <textarea id="f-notiz" rows="2" placeholder="z. B. Sitzung 1, Haut mit Alkohol gereinigt">${esc(p.notiz)}</textarea>

      <p class="info">Welche Elektroden-Anordnung(en) du ausprobierst, legst du in Schritt 6 fest. Dort kannst du für diesen Probanden beliebig viele Platzierungen berechnen.</p>
    </div>`;

  const setze = (feld, wert) => { p[feld] = wert; sitzung.speichereSpaeter(); };
  el.querySelector("#f-name").addEventListener("input", (e) => e.target.value.trim() && setze("name", e.target.value.trim()));
  el.querySelector("#f-notiz").addEventListener("input", (e) => setze("notiz", e.target.value));
  el.querySelectorAll("input[name=arm]").forEach((r) => r.addEventListener("change", () => setze("arm", r.value)));
}
