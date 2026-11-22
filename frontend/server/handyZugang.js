// Zeitlich begrenzte Zugänge für die Handy-Seite: Ein zufälliges Token steht für genau einen Probanden.
// Das Handy kennt nur das Token, nie Name oder ID. Tokens leben nur im Speicher (nach Neustart ungültig).
import crypto from "node:crypto";
import { HttpFehler } from "./http.js";

const TOKEN_BYTES = 16;   // 128 Bit, nicht zu erraten
const TOKEN_MUSTER = /^[a-f0-9]{32}$/;
const MS_PRO_MIN = 60_000;

export class HandyZugang {
  #tokens = new Map();   // token → { probandId, ablauf }

  // jetzt: Uhr in ms (in Tests ersetzbar)
  constructor(gueltigMin, jetzt = () => Date.now()) {
    this.gueltigMs = gueltigMin * MS_PRO_MIN;
    this.jetzt = jetzt;
  }

  // Ein neuer Zugang ersetzt den bisherigen desselben Probanden
  erstelle(probandId) {
    for (const [token, z] of this.#tokens) if (z.probandId === probandId || z.ablauf <= this.jetzt()) this.#tokens.delete(token);
    const token = crypto.randomBytes(TOKEN_BYTES).toString("hex");
    const ablauf = this.jetzt() + this.gueltigMs;
    this.#tokens.set(token, { probandId, ablauf });
    return { token, ablauf: new Date(ablauf).toISOString() };
  }

  probandZu(token) {
    const z = TOKEN_MUSTER.test(token) && this.#tokens.get(token);
    if (!z) throw new HttpFehler(404, "Unbekannter Link. Bitte am Laptop einen neuen QR-Code erzeugen.");
    if (z.ablauf <= this.jetzt()) {
      this.#tokens.delete(token);
      throw new HttpFehler(410, "Der Link ist abgelaufen. Bitte am Laptop einen neuen QR-Code erzeugen.");
    }
    return z.probandId;
  }
}
