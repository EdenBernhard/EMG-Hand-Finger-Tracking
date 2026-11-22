// Schritte 4 und 5: Foto einer Seite hochladen, danach Punkte anklicken.
import { api } from "../api.js";
import { sitzung } from "../sitzung.js";
import { verkleinere } from "../zeichnen/bilder.js";
import { zeigePunkteKlicken } from "./punkteKlicken.js";

const HALTUNG = { innen: "Handfläche zeigt nach oben.", oben: "Handrücken zeigt nach oben." };

export function zeigeFoto(el, seite) {
  const p = sitzung.proband;
  const vorhanden = !!api.bildUrl(p.id, p[seite]);
  el.innerHTML = `
    <div class="karte">
      <p>${HALTUNG[seite]} Fotografiere senkrecht von oben, sodass der ganze Unterarm vom Ellenbogen bis zur Hand drauf ist. Die Kreuze sollten gut zu sehen sein.</p>
      <div class="reihe">
        <label class="knopf ${vorhanden ? "" : "haupt"}" style="margin:0">${vorhanden ? "Anderes Foto wählen" : "Foto hochladen"}
          <input type="file" accept="image/*" capture="environment" id="datei" hidden></label>
        <span class="klein" id="upload-status"></span>
      </div>
    </div>
    <div id="klickbereich"></div>`;

  el.querySelector("#datei").addEventListener("change", async (ev) => {
    const datei = ev.target.files[0];
    if (!datei) return;
    const status = el.querySelector("#upload-status");
    status.textContent = "Wird hochgeladen …";
    try {
      await sitzung.speichereJetzt();
      sitzung.setze(await api.ladeBildHoch(p.id, seite, await verkleinere(datei)));
      zeigeFoto(el, seite);
    } catch (e) {
      status.textContent = e.message;
    }
  });
  if (vorhanden) return zeigePunkteKlicken(el.querySelector("#klickbereich"), seite);
}
