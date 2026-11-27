// Ersatz für den Python-Messprozess in den Tests: spricht dasselbe Zeilenprotokoll (stdin/stdout).
// FAKE_MODUS: "durchlauf" (Impedanz ok, alle Vorgaben, dann fertig), "stopp" (wartet auf {"command":"stop"}),
// "impedanz_fehler" (Sensor 2 besteht nicht, wartet auf {"command":"continue"} oder "stop"),
// "absturz" (Ausgabe auf stderr, Exit-Code 3).
import readline from "node:readline";

const modus = process.env.FAKE_MODUS || "durchlauf";
const sende = (e) => process.stdout.write(JSON.stringify(e) + "\n");
const zeilen = readline.createInterface({ input: process.stdin });
const THRESHOLD_OHM = 100_000;
let plan = null;
let impedanz = null;

zeilen.on("line", (zeile) => {
  const daten = JSON.parse(zeile);
  if (!plan) {
    plan = daten;
    starte();
  } else if (daten.command === "continue" && impedanz && !impedanz.passed) {
    impedanz = { ...impedanz, continued_despite_failure: true };
    laufe();
  } else if (daten.command === "stop") {
    sende({ type: "finished", saved: false, recording: null, samples: 0, duration_s: 0, cues: 0, completed: false,
      impedance: impedanz });
    process.exit(0);
  }
});

function starte() {
  if (modus === "absturz") {
    process.stderr.write("Traceback: kaputt\n");
    process.exit(3);
  }
  const fehler = modus === "impedanz_fehler";
  const results = [1, 2].map((id) => ({ sensor_id: id, report: fehler && id === 2 ? "Failed" : "Passed",
    passed: !(fehler && id === 2) }));
  sende({ type: "checking_impedance", sensor_ids: [1, 2] });
  impedanz = { results, passed: !fehler, threshold_ohm: THRESHOLD_OHM, continued_despite_failure: false };
  sende({ type: "impedance", results, passed: !fehler, threshold_ohm: THRESHOLD_OHM });
  if (!fehler) laufe();
}

function laufe() {
  sende({ type: "waiting_for_sensors", timeout_s: 15 });
  console.log("eine Zeile, die kein JSON ist");
  if (modus === "stopp") return;
  const vorgaben = [];
  for (let r = 1; r <= plan.repetitions; r++) {
    for (const m of plan.movements) {
      for (let i = 1; i <= m.count; i++) {
        vorgaben.push([r, m.name]);
        if (plan.pause_s > 0) vorgaben.push([r, "Ruhe"]);
      }
    }
  }
  sende({ type: "recording", first_cue_in_s: plan.lead_in_s, total_cues: vorgaben.length, duration_s: 1,
    echo: { label: plan.label, context: plan.context } });   // nur für die Tests: was bei Python ankam
  vorgaben.forEach(([r, m], i) => sende({ type: "cue", index: i, repetition: r, movement: m, sample_index: i * 10,
    next_movement: vorgaben[i + 1]?.[1] ?? null, ends_in_s: plan.interval_s }));
  sende({ type: "finished", saved: true, recording: "2026-11-18_10-00-00_messung", samples: 2000, duration_s: 1,
    cues: vorgaben.length, completed: true, impedance: impedanz });
  process.exit(0);
}
