// Speichert den Inhalt eines Canvas als PNG-Datei.
export function ladeCanvasHerunter(canvas, dateiname) {
  canvas.toBlob((blob) => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = dateiname.replace(/[^\wäöüÄÖÜß.-]+/g, "_");
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }, "image/png");
}
