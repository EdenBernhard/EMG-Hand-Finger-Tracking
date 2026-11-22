// Startet einen kurzen Python-Befehl des Backends und liefert sein Ergebnis: die letzte JSON-Zeile auf
// stdout mit type "finished" (sonst Fehler mit Meldung bzw. den letzten Zeilen von stderr).
import { spawn } from "node:child_process";
import { HttpFehler } from "./http.js";

const STDERR_ZEILEN = 5;   // so viele letzte Zeilen erscheinen in der Fehlermeldung

const alsJson = (zeile) => {
  try {
    return JSON.parse(zeile);
  } catch {
    return null;
  }
};

// befehl: { programm, argumente, arbeitsordner, zeitlimitMs }; zusatz: weitere Argumente
export function fuehrePythonAus(befehl, zusatz, fehlerStatus = 422) {
  const { programm, argumente, arbeitsordner, zeitlimitMs } = befehl;
  return new Promise((ok, fehler) => {
    const prozess = spawn(programm, [...argumente, ...zusatz],
      { cwd: arbeitsordner, env: { ...process.env, PYTHONIOENCODING: "utf-8" }, windowsHide: true });
    let stdout = "";
    let stderr = [];
    const timer = setTimeout(() => prozess.kill(), zeitlimitMs);
    prozess.stdout.on("data", (d) => { stdout += d; });
    prozess.stderr.on("data", (d) => { stderr = [...stderr, ...String(d).split(/\r?\n/).filter(Boolean)].slice(-STDERR_ZEILEN); });
    prozess.on("error", (e) => {
      clearTimeout(timer);
      fehler(new HttpFehler(500, `Python ließ sich nicht starten: ${e.message}`));
    });
    prozess.on("close", (code) => {
      clearTimeout(timer);
      const ergebnis = stdout.split(/\r?\n/).map(alsJson)
        .filter((e) => e && (e.type === "finished" || e.type === "error")).at(-1);
      if (ergebnis?.type === "finished") return ok(ergebnis);
      fehler(new HttpFehler(fehlerStatus, ergebnis?.message
        || `Python endete unerwartet (Code ${code}). ${stderr.join(" ")}`.trim()));
    });
  });
}
