// Zeichnet die angeklickten Messpunkte nummeriert auf das Foto.
import { PUNKT_FARBE, PUNKT_FARBE_AKTIV } from "./farben.js";

const PUNKT_GROESSE = 1 / 90; // Radius relativ zur längeren Bildseite

export function zeichnePunkte(ctx, img, punkte, gesetzt, aktiv) {
  ctx.drawImage(img, 0, 0);
  const r = Math.max(img.naturalWidth, img.naturalHeight) * PUNKT_GROESSE;
  punkte.forEach((p, i) => {
    const q = gesetzt[p.key];
    if (!q) return;
    ctx.beginPath();
    ctx.arc(q.x, q.y, r, 0, 2 * Math.PI);
    ctx.fillStyle = p.key === aktiv ? PUNKT_FARBE_AKTIV : PUNKT_FARBE;
    ctx.fill();
    ctx.lineWidth = r / 4;
    ctx.strokeStyle = "#fff";
    ctx.stroke();
    ctx.fillStyle = "#fff";
    ctx.font = `bold ${r * 1.2}px system-ui`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(i + 1), q.x, q.y);
  });
}
