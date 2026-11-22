// Schematische Unterarm-Skizze mit nummerierten Messpunkten (für Schritt 2).

const BREITE = 240; // viewBox-Breite, zum Spiegeln für den linken Arm

// Text bleibt beim Spiegeln lesbar: um die eigene x-Position zurückspiegeln
const lesbar = (x, gespiegelt) => (gespiegelt ? `transform="translate(${2 * x},0) scale(-1,1)"` : "");

const nummer = (x, y, n, g) => `<circle cx="${x}" cy="${y}" r="11" fill="#0F6E56"/>
  <text x="${x}" y="${y + 4.5}" text-anchor="middle" font-size="13" font-weight="700" fill="#fff" ${lesbar(x, g)}>${n}</text>`;

const ARM = `<path d="M62 40 L178 40 L160 262 L82 262 Z" fill="#F1EFE8" stroke="#888780"/>
  <rect x="74" y="262" width="94" height="78" rx="22" fill="#F1EFE8" stroke="#888780"/>`;

const INHALT = {
  // Handfläche oben: Daumen beim rechten Arm rechts
  innen: (g) => `${ARM}
    <ellipse cx="186" cy="292" rx="16" ry="30" fill="#F1EFE8" stroke="#888780" transform="rotate(-20 186 292)"/>
    <path d="M95 52 Q120 60 145 52" stroke="#888780" fill="none"/>
    <path d="M90 254 Q121 260 152 254" stroke="#888780" fill="none"/>
    ${nummer(120, 66, 1, g)}${nummer(121, 240, 2, g)}
    <text x="200" y="352" font-size="12" fill="#5F5E5A" text-anchor="middle" ${lesbar(200, g)}>Daumen</text>`,
  // Handrücken oben: Daumen beim rechten Arm links
  oben: (g) => `${ARM}
    <ellipse cx="56" cy="292" rx="16" ry="30" fill="#F1EFE8" stroke="#888780" transform="rotate(20 56 292)"/>
    ${nummer(150, 46, 1, g)}${nummer(78, 58, 2, g)}${nummer(121, 246, 3, g)}
    <text x="42" y="352" font-size="12" fill="#5F5E5A" text-anchor="middle" ${lesbar(42, g)}>Daumen</text>`,
};

export function skizze(seite, linkerArm) {
  const spiegel = linkerArm ? `transform="translate(${BREITE},0) scale(-1,1)"` : "";
  return `<svg class="skizze" viewBox="0 0 ${BREITE} 360" role="img" aria-label="Skizze ${seite === "innen" ? "Innenseite" : "Oberseite"}">
    <g ${spiegel}>${INHALT[seite](linkerArm)}</g></svg>`;
}
