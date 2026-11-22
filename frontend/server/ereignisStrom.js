// Server-Sent Events: schickt dem Browser den aktuellen Messzustand und danach jedes Ereignis.
const HALTE_VERBINDUNG_MS = 15_000;   // Kommentarzeile, damit Proxys/Browser die Verbindung offen lassen

export function sendeEreignisStrom(req, res, steuerung) {
  res.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });
  const sende = (ereignis) => res.write(`data: ${JSON.stringify(ereignis)}\n\n`);
  sende({ type: "state", ...steuerung.zustand });
  const abmelden = steuerung.abonniere(sende);
  const halten = setInterval(() => res.write(": ping\n\n"), HALTE_VERBINDUNG_MS);
  req.on("close", () => {
    clearInterval(halten);
    abmelden();
  });
}
