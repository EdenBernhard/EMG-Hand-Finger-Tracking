// Schritt 3: Maßband-Messungen eingeben.
import { sitzung } from "../sitzung.js";
import { esc } from "../hilfen.js";
import { MESSUNGEN, MESSBEREICH_CM } from "../modell/messpunkte.js";

export function zeigeMessen(el) {
  const p = sitzung.proband;
  const m = p.mass || (p.mass = {});
  el.innerHTML = `
    <div class="karte">
      <p>Du brauchst ein weiches Maßband. Miss jede Strecke direkt auf der Haut, zwischen den Kreuzen aus Schritt 2.</p>
      ${MESSUNGEN.map((x) => `
        <label for="m-${x.key}">${esc(x.name)}</label>
        <p class="klein" style="margin-top:0">${esc(x.tipp)}</p>
        <div class="feld-einheit"><input type="number" inputmode="decimal" id="m-${x.key}" data-key="${x.key}"
          min="${MESSBEREICH_CM.min}" max="${MESSBEREICH_CM.max}" step="0.1" value="${esc(m[x.key] ?? "")}"> cm</div>`).join("")}
      <p class="fehler" id="m-fehler"></p>
    </div>`;

  el.querySelectorAll("input").forEach((inp) => inp.addEventListener("input", () => {
    const v = parseFloat(inp.value.replace(",", "."));
    m[inp.dataset.key] = Number.isFinite(v) ? v : null;
    const ausserhalb = Number.isFinite(v) && (v < MESSBEREICH_CM.min || v > MESSBEREICH_CM.max);
    el.querySelector("#m-fehler").textContent = ausserhalb ? "Der Wert sieht ungewöhnlich aus – bitte in Zentimetern eingeben." : "";
    sitzung.speichereSpaeter();
  }));
}
