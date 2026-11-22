// Startet eine Messung als Python-Prozess (backend, emg_tracking.acquisition.measurement.cli), hält
// ihren Zustand und gibt jedes Ereignis an alle Zuhörer weiter. Es läuft höchstens eine Messung,
// weil nur ein Programm den Receiver gleichzeitig nutzen kann. Der Server selbst greift nie auf
// die Sensoren zu.
import { spawn } from "node:child_process";
import readline from "node:readline";
import { HttpFehler } from "./http.js";
import { bereinigeMessplan, anzahlVorgaben } from "../public/js/modell/messplan.js";

const STOPP_FRIST_MS = 20_000;   // so lange darf Python nach „stop“ brauchen (Receiver-Start dauert bis 10 s)
const STDERR_ZEILEN = 5;          // so viele letzte Zeilen erscheinen in der Fehlermeldung

export class MessungSteuerung {
  #prozess = null;
  #zustand = { laeuft: false };
  #zuhoerer = new Set();
  #stderr = [];
  #stoppTimer = null;
  #abgeschlossen = false;

  // befehl: { programm, argumente, arbeitsordner }; beiFertig(probandId, ereignis, plan, kontext) wird vor dem
  // Weiterreichen von „finished“ abgewartet (z. B. um die Aufnahme beim Probanden zu speichern).
  constructor(befehl, beiFertig = async () => {}) {
    this.befehl = befehl;
    this.beiFertig = beiFertig;
  }

  get zustand() {
    return this.#zustand;
  }

  abonniere(zuhoerer) {
    this.#zuhoerer.add(zuhoerer);
    return () => this.#zuhoerer.delete(zuhoerer);
  }

  #melde(ereignis) {
    for (const z of this.#zuhoerer) z(ereignis);
  }

  // kontext (Messplan-Name, Platzierung, Notiz) wird nur dokumentiert: in protocol.json und in der Aufnahme
  starte(probandId, eingabe, kontext = {}) {
    if (this.#prozess) throw new HttpFehler(409, "Es läuft bereits eine Messung.");
    const plan = bereinigeMessplan(eingabe);
    if (!plan.bewegungen.length) throw new HttpFehler(400, "Bitte mindestens eine Bewegung angeben.");

    const { programm, argumente, arbeitsordner } = this.befehl;
    const prozess = spawn(programm, argumente, {
      cwd: arbeitsordner,
      env: { ...process.env, PYTHONIOENCODING: "utf-8" },
      windowsHide: true,
    });
    this.#prozess = prozess;
    this.#stderr = [];
    this.#abgeschlossen = false;
    this.#zustand = { laeuft: true, probandId, plan, kontext, phase: "start", gestartet: new Date().toISOString(),
      anzahl: anzahlVorgaben(plan), vorgabe: null };

    // Ereignisse nacheinander verarbeiten, auch wenn beiFertig asynchron ist
    let kette = Promise.resolve();
    readline.createInterface({ input: prozess.stdout }).on("line", (zeile) => {
      kette = kette.then(() => this.#verarbeite(zeile, probandId, plan, kontext));
    });
    readline.createInterface({ input: prozess.stderr }).on("line", (zeile) => {
      this.#stderr = [...this.#stderr, zeile].slice(-STDERR_ZEILEN);
    });
    prozess.on("error", (e) => {
      kette = kette.then(() => this.#beende({ type: "error", message: `Python ließ sich nicht starten: ${e.message}` }));
    });
    prozess.on("close", (code) => {
      kette = kette.then(() => this.#beende({ type: "error",
        message: `Die Messung endete unerwartet (Code ${code}). ${this.#stderr.join(" ")}`.trim() }));
    });

    prozess.stdin.on("error", () => {});   // Prozess schon beendet: Fehler kommt über „close“
    prozess.stdin.write(JSON.stringify({
      subject_id: probandId, movements: plan.bewegungen.map((b) => ({ name: b.name, count: b.anzahl })),
      interval_s: plan.intervallS,
      repetitions: plan.wiederholungen, lead_in_s: plan.vorlaufS,
      label: kontext.messplan?.name || "", context: kontext,
    }) +"\n");
    this.#melde({ type: "state", ...this.#zustand });
    return this.#zustand;
  }

  stoppe() {
    if (!this.#prozess) throw new HttpFehler(409, "Es läuft keine Messung.");
    this.#prozess.stdin.write(JSON.stringify({ command: "stop" }) + "\n");
    this.#zustand = { ...this.#zustand, phase: "stoppt" };
    this.#melde({ type: "state", ...this.#zustand });
    const prozess = this.#prozess;
    clearTimeout(this.#stoppTimer);
    this.#stoppTimer = setTimeout(() => prozess.kill(), STOPP_FRIST_MS);
  }

  async #verarbeite(zeile, probandId, plan, kontext) {
    let ereignis;
    try {
      ereignis = JSON.parse(zeile);
    } catch {
      console.log(`[messung] ${zeile}`);   // z. B. Ausgaben des SDK; kein Ereignis
      return;
    }
    if (ereignis.type === "finished" || ereignis.type === "error") return this.#beende(ereignis, probandId, plan, kontext);
    if (ereignis.type === "waiting_for_sensors") this.#zustand = { ...this.#zustand, phase: "warten" };
    if (ereignis.type === "recording") this.#zustand = { ...this.#zustand, phase: "aufnahme", aufnahme: ereignis };
    if (ereignis.type === "cue") this.#zustand = { ...this.#zustand, vorgabe: ereignis };
    this.#melde(ereignis);
  }

  // Nur das erste Abschluss-Ereignis zählt („close“ folgt immer nach „finished“/„error“)
  async #beende(ereignis, probandId, plan, kontext) {
    if (this.#abgeschlossen) return;
    this.#abgeschlossen = true;
    clearTimeout(this.#stoppTimer);
    if (ereignis.type === "finished" && ereignis.saved) {
      try {
        await this.beiFertig(probandId, ereignis, plan, kontext);
      } catch (e) {
        console.error(e);
      }
    }
    if (this.#prozess && this.#prozess.exitCode === null) this.#prozess.stdin.end();
    this.#prozess = null;
    this.#zustand = { laeuft: false, letzte: { probandId, ...ereignis } };
    this.#melde(ereignis);
  }
}
