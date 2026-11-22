// Karte im Foto-Schritt: QR-Code für die Handy-Seite. Solange sie offen ist, schaut der Laptop regelmäßig
// nach, ob ein neues Foto dieser Seite angekommen ist, und meldet es über beiNeuemFoto(proband).
import qrcode from "../../vendor/qrcode-generator.mjs";
import { api } from "../api.js";
import { esc, datum } from "../hilfen.js";

const ABFRAGE_MS = 2000;
const QR_TYP = 0;            // 0: kleinste passende QR-Version
const QR_FEHLERKORREKTUR = "M";
const QR_ZELLE_PX = 5;
const QR_RAND_ZELLEN = 4;    // Ruhezone laut QR-Standard

const qrSvg = (text) => {
  const qr = qrcode(QR_TYP, QR_FEHLERKORREKTUR);
  qr.addData(text);
  qr.make();
  return qr.createSvgTag({ cellSize: QR_ZELLE_PX, margin: QR_RAND_ZELLEN, scalable: true });
};

export function zeigeHandyQr(el, p, seite, { beiNeuemFoto }) {
  el.innerHTML = `<div class="karte">
      <h3>Mit dem Handy fotografieren</h3>
      <p class="klein">QR-Code mit dem Handy scannen (gleiches WLAN), Foto aufnehmen – es erscheint hier automatisch.
        Das Handy sieht keinen Namen, nur einen zeitlich begrenzten Link.</p>
      <button id="hq-start">QR-Code anzeigen</button>
      <div id="hq-inhalt"></div>
    </div>`;
  const inhalt = el.querySelector("#hq-inhalt");
  const version = p[seite]?.version || 0;
  let abfrage = null;
  const beende = () => clearInterval(abfrage);
  window.addEventListener("hashchange", beende, { once: true });

  const zeigeCode = (urls, url) => {
    inhalt.innerHTML = `<div class="handy-qr">${qrSvg(url)}</div>
      <p class="klein"><code>${esc(url.replace(/#.*/, "#…"))}</code></p>
      ${urls.length > 1 ? `<label for="hq-adresse">Adresse (falls das Handy nichts lädt)</label>
        <select id="hq-adresse">${urls.map((u) => `<option ${u === url ? "selected" : ""}>${esc(u.replace(/#.*/, ""))}</option>`).join("")}</select>` : ""}`;
    inhalt.querySelector("#hq-adresse")?.addEventListener("change", (e) => zeigeCode(urls, urls[e.target.selectedIndex]));
  };

  el.querySelector("#hq-start").addEventListener("click", async (e) => {
    e.target.disabled = true;
    try {
      const { urls, ablauf } = await api.erstelleHandyZugang(p.id);
      if (!urls.length) {
        inhalt.innerHTML = `<p class="hinweis">Keine WLAN-Adresse gefunden. Ist der Laptop mit dem WLAN verbunden?</p>`;
        e.target.disabled = false;
        return;
      }
      zeigeCode(urls, urls[0]);
      inhalt.insertAdjacentHTML("beforeend", `<p class="klein">Gültig bis ${esc(datum(ablauf))}.</p>`);
      e.target.textContent = "Neuen QR-Code erzeugen";
      e.target.disabled = false;
      beende();
      abfrage = setInterval(async () => {
        const neu = await api.lade(p.id).catch(() => null);
        if (neu && (neu[seite]?.version || 0) !== version) {
          beende();
          beiNeuemFoto(neu);
        }
      }, ABFRAGE_MS);
    } catch (fehler) {
      inhalt.innerHTML = `<p class="fehler">${esc(fehler.message)}</p>`;
      e.target.disabled = false;
    }
  });
}
