// Zeichnet Mittellinie und Elektrodenpaare einer Seite auf das Foto.
import { kanalFarbe } from "./farben.js";

const LINIE_BASIS = 1 / 450;   // Linienstärke relativ zur längeren Bildseite
const MITTIG_CM = 0.3;         // Kanäle näher an der Mittellinie bekommen das Etikett oberhalb
const MIN_SCHRIFT_PX = 14;

function zeichnePaar(ctx, k, lw) {
  const { e1, e2, radius } = k.px;
  const farbe = kanalFarbe(k.index);
  ctx.setLineDash(k.optional ? [lw * 3, lw * 2] : []);
  ctx.lineWidth = lw * 2.5;
  ctx.strokeStyle = farbe;
  ctx.beginPath(); ctx.moveTo(e1.x, e1.y); ctx.lineTo(e2.x, e2.y); ctx.stroke();
  for (const e of [e1, e2]) {
    ctx.beginPath(); ctx.arc(e.x, e.y, radius, 0, 2 * Math.PI);
    ctx.fillStyle = "rgba(255,255,255,.92)"; ctx.fill();
    ctx.lineWidth = lw * 2.2; ctx.stroke();
  }
  ctx.setLineDash([]);
}

// Etikett zur Außenseite des Arms; mittige Kanäle bekommen es oberhalb (Richtung Ellenbogen)
function zeichneEtikett(ctx, k, geo, lw) {
  const { e1, e2, radius, mitte } = k.px;
  const mittig = Math.abs(k.quer) < MITTIG_CM;
  const richtung = mittig ? { x: -geo.e.x, y: -geo.e.y } : k.quer > 0 ? geo.n : { x: -geo.n.x, y: -geo.n.y };
  const abstand = mittig ? Math.hypot(e2.x - e1.x, e2.y - e1.y) / 2 + radius * 2.2 : radius * 1.6 + lw * 10;
  const x = mitte.x + richtung.x * abstand;
  const y = mitte.y + richtung.y * abstand;
  const fs = Math.max(MIN_SCHRIFT_PX, lw * 9);
  ctx.font = `bold ${fs}px system-ui`;
  const breite = ctx.measureText(k.ch).width + fs * 0.7;
  ctx.fillStyle = kanalFarbe(k.index);
  ctx.beginPath(); ctx.roundRect(x - breite / 2, y - fs * 0.7, breite, fs * 1.4, fs * 0.35); ctx.fill();
  ctx.fillStyle = "#fff"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText(k.ch, x, y);
}

export function zeichneElektroden(canvas, img, seite, ergebnis) {
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0);
  const geo = ergebnis.geo[seite];
  if (!geo) return;
  const lw = Math.max(canvas.width, canvas.height) * LINIE_BASIS;

  ctx.setLineDash([lw * 4, lw * 3]);
  ctx.lineWidth = lw;
  ctx.strokeStyle = "rgba(255,255,255,.9)";
  ctx.beginPath(); ctx.moveTo(geo.start.x, geo.start.y); ctx.lineTo(geo.ende.x, geo.ende.y); ctx.stroke();
  ctx.setLineDash([]);

  for (const k of ergebnis.kanaele.filter((x) => x.seite === seite && x.px)) {
    zeichnePaar(ctx, k, lw);
    zeichneEtikett(ctx, k, geo, lw);
  }
}
