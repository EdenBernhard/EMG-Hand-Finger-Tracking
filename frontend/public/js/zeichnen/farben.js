// Farben für Kanäle und Markierungen (je Kanal eine eigene, damit Foto und Liste zusammenpassen).

export const KANAL_FARBEN = ["#0F6E56", "#185FA5", "#993556", "#854F0B", "#534AB7", "#A32D2D"];
export const kanalFarbe = (index) => KANAL_FARBEN[index % KANAL_FARBEN.length];

export const PUNKT_FARBE = "#0F6E56";
export const PUNKT_FARBE_AKTIV = "#D85A30";
