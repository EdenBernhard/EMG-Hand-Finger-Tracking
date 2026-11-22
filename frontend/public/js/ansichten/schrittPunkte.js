// Schritt 2: Erklärt, welche Punkte ertastet und mit Hautstift markiert werden.
import { sitzung } from "../sitzung.js";
import { esc } from "../hilfen.js";
import { PUNKTE } from "../modell/messpunkte.js";
import { skizze } from "./skizze.js";

const liste = (seite) => `<ol class="punkte">${PUNKTE[seite].filter((p) => !p.nurFoto)
  .map((p) => `<li><strong>${esc(p.name)}</strong> – ${esc(p.tipp)}</li>`).join("")}</ol>`;

export function zeigePunkte(el) {
  const links = sitzung.proband.arm === "links";
  el.innerHTML = `
    <div class="karte">
      <h2 style="margin-top:0">So geht’s</h2>
      <p>Die Elektrodenpositionen werden von ein paar festen Punkten am Arm aus berechnet. Diese Punkte ertastest du und malst sie mit einem Hautstift als kleines Kreuz auf. Auf den Fotos klickst du sie später an.</p>
      <div class="info">Proband sitzt, Unterarm liegt locker auf dem Tisch, Ellenbogen leicht gebeugt. Für alle Fotos und Messungen dieselbe Haltung.</div>
    </div>
    <div class="spalten">
      <div class="karte"><h3>Innenseite (Handfläche zeigt nach oben)</h3>${skizze("innen", links)}${liste("innen")}</div>
      <div class="karte"><h3>Oberseite (Handrücken zeigt nach oben)</h3>${skizze("oben", links)}${liste("oben")}</div>
    </div>
    <div class="hinweis">Knochenpunkte findest du am besten, wenn der Muskel locker ist: mit zwei Fingern leicht kreisend tasten, bis du den harten Höcker spürst.</div>`;
}
