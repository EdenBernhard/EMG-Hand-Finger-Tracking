// 2D-Vektorrechnung in Bildkoordinaten (x nach rechts, y nach unten).

export const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y });
export const add = (a, b) => ({ x: a.x + b.x, y: a.y + b.y });
export const mul = (a, s) => ({ x: a.x * s, y: a.y * s });
export const len = (a) => Math.hypot(a.x, a.y);
export const norm = (a) => mul(a, 1 / (len(a) || 1));
export const dot = (a, b) => a.x * b.x + a.y * b.y;
export const mid = (a, b) => mul(add(a, b), 0.5);
export const senkrecht = (a) => ({ x: -a.y, y: a.x });
