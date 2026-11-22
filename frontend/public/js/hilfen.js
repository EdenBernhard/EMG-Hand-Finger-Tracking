// Kleine Hilfen für die Anzeige.

const ERSATZ = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ERSATZ[c]);

export const zahlText = (x, stellen = 1) => (x == null ? "–" : x.toFixed(stellen).replace(".", ","));

const SEKUNDEN_PRO_MINUTE = 60;
export const dauerText = (s) => {
  const ganz = Math.round(s);
  return `${Math.floor(ganz / SEKUNDEN_PRO_MINUTE)}:${String(ganz % SEKUNDEN_PRO_MINUTE).padStart(2, "0")} min`;
};

export const datum = (iso) =>
  iso ? new Date(iso).toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short" }) : "";
