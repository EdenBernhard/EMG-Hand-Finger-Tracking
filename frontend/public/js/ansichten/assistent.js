// Rahmen des Schritt-Assistenten: Überschrift, Schrittleiste, Inhalt, Vor/Zurück.
import { sitzung } from "../sitzung.js";
import { esc } from "../hilfen.js";
import { fortschritt } from "../modell/fortschritt.js";
import { zeigeDaten } from "./schrittDaten.js";
import { zeigePunkte } from "./schrittPunkte.js";
import { zeigeMessen } from "./schrittMessen.js";
import { zeigeFoto } from "./schrittFoto.js";
import { zeigePlatzierungen } from "./schrittPlatzierungen.js";
import { zeigeMessung } from "./schrittMessung.js";

export const SCHRITTE = [
  { key: "daten", titel: "1 · Proband", zeige: zeigeDaten },
  { key: "punkte", titel: "2 · Punkte markieren", zeige: zeigePunkte },
  { key: "messen", titel: "3 · Messen", zeige: zeigeMessen },
  { key: "innen", titel: "4 · Foto Innenseite", zeige: (el) => zeigeFoto(el, "innen") },
  { key: "oben", titel: "5 · Foto Oberseite", zeige: (el) => zeigeFoto(el, "oben") },
  { key: "platzierungen", titel: "6 · Platzierungen", zeige: zeigePlatzierungen },
  { key: "messung", titel: "7 · EMG-Messung", zeige: zeigeMessung },
];

export function zeigeAssistent(el, schrittKey, parameter) {
  const p = sitzung.proband;
  const f = fortschritt(p);
  const erledigt = { daten: f.grunddaten, punkte: f.innen && f.oben, messen: f.messungen, innen: f.innen, oben: f.oben,
    platzierungen: p.platzierungen.length > 0 && f.messungen && f.innen && f.oben, messung: f.aufnahmen };
  const i = Math.max(0, SCHRITTE.findIndex((s) => s.key === schrittKey));
  const link = (s, klasse, text) => `<a class="${klasse}" href="#/p/${p.id}/${s.key}">${text}</a>`;

  el.innerHTML = `
    <p class="klein nicht-drucken"><a href="#/">← Alle Probanden</a></p>
    <h1>${esc(p.name)}</h1>
    <ol class="schritte">${SCHRITTE.map((s, j) =>
      `<li>${link(s, `${j === i ? "aktiv" : ""} ${erledigt[s.key] ? "fertig" : ""}`, s.titel)}</li>`).join("")}</ol>
    <section id="inhalt"></section>
    <div class="navigation">
      ${i > 0 ? link(SCHRITTE[i - 1], "knopf", "← Zurück") : "<span></span>"}
      ${i < SCHRITTE.length - 1 ? link(SCHRITTE[i + 1], "knopf haupt", "Weiter →") : ""}
    </div>`;
  return SCHRITTE[i].zeige(el.querySelector("#inhalt"), parameter);
}
