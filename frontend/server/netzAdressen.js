// IPv4-Adressen dieses Rechners im lokalen Netz, unter denen das Handy den Server erreicht.
// Die wahrscheinlichste (Heim-WLAN) steht vorn, denn die erste Adresse landet im QR-Code.
import os from "node:os";

const LINK_LOKAL = /^169\.254\./;   // Windows vergibt sie ohne DHCP; darüber ist nichts erreichbar
// Virtuelle Adapter (WSL, Hyper-V, VMs, Docker): von außen, also vom Handy, nicht erreichbar
const VIRTUELL = /vethernet|wsl|hyper-v|virtualbox|vmware|docker|vbox|loopback/i;
// Übliche Bereiche von Heimroutern zuerst; 172.16/12 nutzen oft virtuelle Netze
const VORRANG = [/^192\.168\./, /^10\./, /^172\.(1[6-9]|2\d|3[01])\./];

const rang = (ip) => {
  const i = VORRANG.findIndex((muster) => muster.test(ip));
  return i === -1 ? VORRANG.length : i;
};

export function lanAdressen(schnittstellen = os.networkInterfaces()) {
  return Object.entries(schnittstellen)
    .filter(([name]) => !VIRTUELL.test(name))
    .flatMap(([, adressen]) => adressen || [])
    .filter((a) => (a.family === "IPv4" || a.family === 4) && !a.internal && !LINK_LOKAL.test(a.address))
    .map((a) => a.address)
    .sort((a, b) => rang(a) - rang(b));
}
