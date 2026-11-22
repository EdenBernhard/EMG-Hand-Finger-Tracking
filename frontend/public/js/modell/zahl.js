// Liest eine positive Zahl aus Eingaben wie 25, "25", "24,5"; sonst null.
export function positiveZahl(wert) {
  const n = typeof wert === "string" ? parseFloat(wert.replace(",", ".")) : wert;
  return Number.isFinite(n) && n > 0 ? n : null;
}
