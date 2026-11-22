// Pieptöne über die Web Audio API. Browser erlauben Ton erst nach einem Klick: freigeben() muss
// daher in einem Klick-Handler aufgerufen werden (z. B. beim Start der Messung).

const NEUE_BEWEGUNG = { frequenzHz: 880, dauerS: 0.18 };
const ENDE = { frequenzHz: 523, dauerS: 0.6 };
const LAUTSTAERKE = 0.25;
const RAMPE_S = 0.01;   // weiches Ein- und Ausblenden, sonst knackt es

let kontext = null;

function spiele({ frequenzHz, dauerS }) {
  if (!kontext || kontext.state !== "running") return;
  const t = kontext.currentTime;
  const oszillator = kontext.createOscillator();
  const lautstaerke = kontext.createGain();
  oszillator.frequency.value = frequenzHz;
  lautstaerke.gain.setValueAtTime(0, t);
  lautstaerke.gain.linearRampToValueAtTime(LAUTSTAERKE, t + RAMPE_S);
  lautstaerke.gain.setValueAtTime(LAUTSTAERKE, t + dauerS - RAMPE_S);
  lautstaerke.gain.linearRampToValueAtTime(0, t + dauerS);
  oszillator.connect(lautstaerke).connect(kontext.destination);
  oszillator.start(t);
  oszillator.stop(t + dauerS);
}

export const ton = {
  freigeben() {
    kontext ||= new AudioContext();
    if (kontext.state === "suspended") kontext.resume();
  },
  get bereit() {
    return !!kontext && kontext.state === "running";
  },
  neueBewegung: () => spiele(NEUE_BEWEGUNG),
  ende: () => spiele(ENDE),
};
