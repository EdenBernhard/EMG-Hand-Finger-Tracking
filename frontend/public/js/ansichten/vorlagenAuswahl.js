// Messplan-Vorlagen für alle Probanden: eine Vorlage als neuen Messplan übernehmen, den aktuellen
// Messplan als eigene Vorlage speichern, eigene Vorlagen löschen. Die Standard-Messpläne sind fest.
import { api } from "../api.js";
import { sitzung } from "../sitzung.js";
import { esc, dauerText } from "../hilfen.js";
import { dauerS } from "../modell/messplan.js";
import { neuerMessplan, MAX_MESSPLAENE } from "../modell/messplaene.js";

const adresse = (p, m) => `#/p/${p.id}/messung/${m.id}`;

const option = (v) => `<option value="${esc(v.id)}">${esc(v.name)} (ca. ${esc(dauerText(dauerS(v)))})</option>`;

const optionen = (vorlagen) => {
  const gruppe = (titel, liste) => (liste.length ? `<optgroup label="${titel}">${liste.map(option).join("")}</optgroup>` : "");
  return gruppe("Standard-Messpläne", vorlagen.filter((v) => v.standard)) +
    gruppe("Eigene Vorlagen", vorlagen.filter((v) => !v.standard));
};

// Gibt eine Funktion zurück, die die Beschriftung nach einer Namensänderung des Messplans auffrischt
export function zeigeVorlagenAuswahl(el, p, aktiv) {
  el.innerHTML = `
    <div class="karte">
      <h2 style="margin-top:0">Vorlagen</h2>
      <p class="klein">Für alle Probanden gleich. Eine Vorlage wird als Kopie zu einem eigenen Messplan dieses Probanden.</p>
      <div class="reihe">
        <select id="vl-liste" aria-label="Vorlage"><option>Lädt …</option></select>
        <button class="haupt" id="vl-uebernehmen" disabled>Als Messplan übernehmen</button>
        <button class="gefahr" id="vl-loeschen" disabled>Vorlage löschen</button>
      </div>
      <div class="reihe" style="margin-top:.6rem">
        <button id="vl-speichern"></button>
      </div>
      <p id="vl-meldung"></p>
    </div>`;

  const $ = (id) => el.querySelector(id);
  let vorlagen = [];
  const meldung = (text, klasse = "info") => {
    $("#vl-meldung").className = text ? klasse : "";
    $("#vl-meldung").textContent = text || "";
  };
  const gewaehlt = () => vorlagen.find((v) => v.id === $("#vl-liste").value);
  const knoepfe = () => {
    const v = gewaehlt();
    $("#vl-uebernehmen").disabled = !v || p.messplaene.length >= MAX_MESSPLAENE;
    $("#vl-loeschen").disabled = !v || v.standard;
  };
  const zeige = (liste, auswahlId) => {
    vorlagen = liste;
    $("#vl-liste").innerHTML = optionen(vorlagen);
    if (auswahlId && vorlagen.some((v) => v.id === auswahlId)) $("#vl-liste").value = auswahlId;
    knoepfe();
  };
  // Fehlermeldungen des Servers anzeigen statt abzubrechen
  const versuche = async (fn) => {
    try {
      await fn();
    } catch (e) {
      meldung(e.message, "fehler");
    }
  };
  const beschrifte = () => { $("#vl-speichern").textContent = `„${aktiv.name}“ als Vorlage speichern`; };

  $("#vl-liste").addEventListener("change", () => { meldung(""); knoepfe(); });
  $("#vl-uebernehmen").addEventListener("click", async () => {
    const v = gewaehlt();
    const neu = neuerMessplan(p.messplaene, v, v.name);
    p.messplaene.push(neu);
    await sitzung.speichereJetzt();
    location.hash = adresse(p, neu);
  });
  $("#vl-loeschen").addEventListener("click", () => versuche(async () => {
    const v = gewaehlt();
    if (!confirm(`Vorlage „${v.name}“ für alle Probanden löschen? Messpläne, die daraus entstanden sind, bleiben erhalten.`)) return;
    zeige(await api.loescheVorlage(v.id));
    meldung(`Vorlage „${v.name}“ gelöscht.`);
  }));
  $("#vl-speichern").addEventListener("click", () => versuche(async () => {
    const vorhanden = vorlagen.find((v) => !v.standard && v.name === aktiv.name);
    if (vorhanden && !confirm(`Die Vorlage „${aktiv.name}“ gibt es schon. Überschreiben?`)) return;
    const liste = await api.speichereVorlage(aktiv);
    zeige(liste, liste.find((v) => !v.standard && v.name === aktiv.name)?.id);
    meldung(`„${aktiv.name}“ ist jetzt als Vorlage für alle Probanden gespeichert.`);
  }));

  beschrifte();
  versuche(async () => zeige(await api.vorlagen()));
  return beschrifte;
}
