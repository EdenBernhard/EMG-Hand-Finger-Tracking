// Ergebnis einer Platzierung: Fotos mit Elektroden und Maßband-Anleitung je Kanal.
import { api } from "../api.js";
import { esc, zahlText } from "../hilfen.js";
import { SEITEN } from "../modell/messpunkte.js";
import { berechne, variante } from "../modell/berechnung.js";
import { anleitung } from "../modell/anleitung.js";
import { kanalFarbe } from "../zeichnen/farben.js";
import { ladeBild } from "../zeichnen/bilder.js";
import { zeichneElektroden } from "../zeichnen/elektroden.js";
import { ladeCanvasHerunter } from "../zeichnen/download.js";

const SEITEN_NAME = { innen: "Innenseite", oben: "Oberseite" };

function kanalKarte(k, platzierung) {
  const farbe = kanalFarbe(k.index);
  return `<div class="kanal" style="border-color:${farbe}">
    <span class="kanal-tag" style="color:${farbe}">${esc(k.ch)}</span>
    <div>
      <strong>${esc(k.name)}</strong>${k.optional ? " <span class='chip'>optional</span>" : ""}
      <span class="klein">· ${SEITEN_NAME[k.seite]} · ${esc(k.fach)}</span>
      <ul>${anleitung(k, platzierung).map((t) => `<li>${esc(t)}</li>`).join("")}</ul>
      ${k.amRand ? `<p class="klein">Liegt fast am Rand des Arms – auf dem Foto nur verkürzt zu sehen.</p>` : ""}
      <p class="klein"><strong>Test:</strong> ${esc(k.test)}</p>
    </div>
  </div>`;
}

export async function zeigeErgebnis(el, proband, platzierung) {
  const v = variante(platzierung);
  const erg = berechne(proband, platzierung);
  const geschaetzt = SEITEN.some((s) => erg.geo[s] && erg.geo[s].geschaetzt);

  el.innerHTML = `
    <div class="karte">
      <h2 style="margin:0">${esc(platzierung.name)}</h2>
      <p class="klein">Anordnung ${esc(v.name)}: ${esc(v.text)}</p>
      <p class="klein">Proband: ${esc(proband.name)} · Arm ${esc(proband.arm)} · Elektrodenabstand ${zahlText(erg.abstandCm)} cm${platzierung.notiz ? " · " + esc(platzierung.notiz) : ""}</p>
    </div>
    <div class="spalten">
      ${SEITEN.map((s) => `
        <div class="karte">
          <h3>${SEITEN_NAME[s]}</h3>
          ${api.bildUrl(proband.id, proband[s])
            ? `<canvas class="foto" id="erg-${s}"></canvas>
               <button class="nicht-drucken" style="margin-top:.6rem" data-download="${s}">Bild herunterladen</button>`
            : `<p class="klein">Kein Foto.</p>`}
        </div>`).join("")}
    </div>
    <div class="karte">
      <h2 style="margin-top:0">Anleitung zum Aufkleben</h2>
      <p class="klein">Das Foto zeigt die ungefähre Lage. Genauer wird es mit dem Maßband nach dieser Anleitung. Danach die Testbewegung machen lassen: Unter der Elektrode sollte sich der Muskel deutlich anspannen.</p>
      ${erg.kanaele.map((k) => kanalKarte(k, platzierung)).join("")}
    </div>
    ${geschaetzt ? `<div class="hinweis">Ohne gemessene Längen wird ein Durchschnittsarm angenommen. Die Positionen sind dann ungenauer.</div>` : ""}`;

  for (const s of SEITEN) {
    const url = api.bildUrl(proband.id, proband[s]);
    if (!url) continue;
    const canvas = el.querySelector(`#erg-${s}`);
    zeichneElektroden(canvas, await ladeBild(url), s, erg);
    el.querySelector(`[data-download=${s}]`).addEventListener("click", () =>
      ladeCanvasHerunter(canvas, `${proband.name}_${platzierung.name}_${s}.png`));
  }
}
