// Fotos laden und vor dem Hochladen verkleinern.

const MAX_SEITE_PX = 1600;
const JPEG_QUALITAET = 0.88;

export function ladeBild(url) {
  return new Promise((ok, fehler) => {
    const img = new Image();
    img.onload = () => ok(img);
    img.onerror = () => fehler(new Error("Bild konnte nicht geladen werden."));
    img.src = url;
  });
}

export async function verkleinere(datei) {
  const url = URL.createObjectURL(datei);
  try {
    const img = await ladeBild(url).catch(() => {
      throw new Error("Diese Datei ist kein lesbares Foto.");
    });
    const f = Math.min(1, MAX_SEITE_PX / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement("canvas");
    c.width = Math.round(img.naturalWidth * f);
    c.height = Math.round(img.naturalHeight * f);
    c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
    return { dataUrl: c.toDataURL("image/jpeg", JPEG_QUALITAET), breite: c.width, hoehe: c.height };
  } finally {
    URL.revokeObjectURL(url);
  }
}
