# Frontend – Elektroden platzieren und messen

Kleine Webapp für **Messvorbereitung und Messdurchführung**: Sie führt pro Proband Schritt für Schritt durch Markieren, Messen und Fotografieren des Unterarms, zeichnet die Elektrodenpositionen in die Fotos ein und startet EMG-Messungen mit Bewegungsvorgaben (Piepton im Intervall, Anzeige der auszuführenden Bewegung). Sie ist kein Teil der Pipeline (Erfassung → Vorverarbeitung → ML → Ausgabe) und greift selbst nicht auf die Sensoren zu: Für eine Messung startet der Server einen Python-Prozess in [`../backend`](../backend) (`emg_tracking.acquisition.measurement.cli`), der den Receiver über das Cometa-SDK liest, Rohdaten und Bewegungsvorgaben speichert und den Ablauf als JSON-Zeilen zurückmeldet.

## Start

Voraussetzung: [Node.js](https://nodejs.org/) ab Version 20. Es werden keine Pakete installiert.

```powershell
cd frontend
npm start          # http://localhost:3000
npm test           # Modell- und API-Tests
```

Optional: `$env:PORT=8080` bzw. `$env:DATA_DIR="D:\pfad"` vor `npm start`. Für Messungen muss das Backend eingerichtet sein (README im Hauptordner, Schritt 5). Der Server nimmt `backend\.venv\Scripts\python.exe`, falls vorhanden, sonst `python` aus dem PATH; ein anderes Python per `$env:PYTHON`.
Probanden-Daten liegen in `frontend/data/probanden/<id>/` (`proband.json` mit Maßen, Punkten und allen Platzierungen, dazu `innen.jpg`, `oben.jpg`) und sind per `.gitignore` von Git ausgeschlossen. Ältere `proband.json` mit nur einer Anordnung werden beim Laden automatisch in eine Platzierung umgewandelt.

## Ablauf in der App

1. **Proband** – Name/Kürzel, Arm, Notiz
2. **Punkte markieren** – 2 Punkte innen, 3 oben ertasten und mit Hautstift ankreuzen
3. **Messen** – 2 Längen und 2 Umfänge mit dem Maßband
4. **Foto Innenseite** – hochladen, Kreuze und Daumen anklicken
5. **Foto Oberseite** – hochladen, Kreuze anklicken
6. **Platzierungen** – beliebig viele Berechnungen pro Proband auf Basis derselben Maße und Fotos, jeweils mit eigener Anordnung, eigenem Elektrodenabstand und Notiz. Je Platzierung: Fotos mit Elektrodenpaaren (als PNG herunterladbar), Maßband-Anleitung und Testbewegung je Kanal, druckbar.
7. **EMG-Messung** – beliebig viele benannte Messpläne pro Proband (Tabs, kopierbar), jeder beliebig oft messbar. Ein Messplan: Bewegungen mit Anzahl (so oft direkt hintereinander, z. B. Pinch 3×), Intervall, Durchläufe des ganzen Ablaufs, Vorlauf. Vor dem Start Elektroden-Platzierung wählen und optional eine Notiz eingeben; beides wird mit der Aufnahme gespeichert. Während der Messung: aktuelle Bewegung groß, Countdown bis zum nächsten Piepton, Vorschau, Stopp. Darunter die bisherigen Messungen des Probanden.

Den Takt der Messung gibt Python vor (gezählt in Samples, siehe README im Hauptordner, „Messung mit Bewegungsvorgaben“). Der Browser zeigt nur an und piept; deshalb verschieben gedrosselte Browser-Tabs die Labels nicht. Ton erst nach einem Klick: Browser erlauben Audio nur nach einer Nutzeraktion, notfalls erscheint der Knopf „Ton aktivieren“.

Anordnungen: **A** nah am Ellenbogen (4 + 1 Kanäle), **B** nah am Handgelenk (WETrak), **C** Ring mit 6 Sensoren, **D** nur 3 Sensoren gezielt (Fingerbeuger, Fingerstrecker, Daumenbeuger – dieselben Stellen wie K1, K3, K5 aus A, damit 3 und 5 Sensoren direkt vergleichbar sind), **E** Ring mit 3 Sensoren (alle 120°, Gegenstück zu D). Ringe mit anderer Sensorzahl: in `varianten.js` einfach `ring.anzahl` setzen.

## Aufbau

```
frontend/
├── server/                    Node-Server, nur Standardbibliothek
│   ├── server.js              Startpunkt
│   ├── konfiguration.js       Port, Datenordner, Größenlimit, Python-Befehl für Messungen
│   ├── routen.js              URL → Aktion
│   ├── probandenSpeicher.js   Ablage der Probanden und Fotos
│   ├── messungSteuerung.js    startet/stoppt den Python-Messprozess, hält dessen Zustand
│   ├── messungsAuftrag.js     Messplan + Platzierung + Notiz aus dem gespeicherten Probanden
│   ├── ereignisStrom.js       Server-Sent Events: Messereignisse an den Browser
│   ├── statischeDateien.js    Auslieferung von public/
│   └── http.js                JSON lesen/senden, Fehlerklasse
├── public/
│   ├── index.html, style.css
│   └── js/
│       ├── main.js            Routing
│       ├── api.js, sitzung.js Server-Zugriff, automatisches Speichern
│       ├── ton.js             Pieptöne (Web Audio)
│       ├── modell/            Berechnung und Platzierungen (ohne DOM, auch vom Server genutzt)
│       ├── ansichten/         je Schritt eine Datei
│       └── zeichnen/          Canvas: Punkte, Elektroden, Download
├── test/                      node:test
└── testhilfen/                Ersatz für den Python-Messprozess in den Tests
```

## Berechnung

- Jede Armseite hat eine **Mittellinie** zwischen zwei angeklickten Punkten: innen Armbeuge → Handgelenksfalte, oben Mitte zwischen Ellenbogenspitze und Knubbel → Mitte Handgelenk.
- Der **Maßstab** (Pixel pro cm) ergibt sich aus einer gemessenen Länge, deren Endpunkte auf dem Foto angeklickt wurden.
- Eine Elektrode ist definiert durch die Lage **entlang der Linie** (Anteil oder cm vom Handgelenk) und einen **seitlichen Abstand auf der Haut** in cm (+ = Daumenseite).
- Der seitliche Abstand wird mit einem **Zylindermodell** (Radius aus dem gemessenen Umfang) auf das Foto projiziert. Weit seitliche Positionen erscheinen dadurch verkürzt.
- Positionen der Anordnungen: [`public/js/modell/varianten.js`](public/js/modell/varianten.js). Alle übrigen Zahlenannahmen: [`public/js/modell/annahmen.js`](public/js/modell/annahmen.js).

## Grenzen

- Die Positionswerte sind **Startwerte** aus Atlas-Proportionen (Prometheus) und Literatur (Basmajian & Blumenstein; Cao et al. 2024, WETrak für Anordnung B), keine individuell gemessenen Muskellagen. Vor dem Aufkleben den Muskel bei der Testbewegung ertasten.
- Fotos haben Perspektive. Die Maßband-Anleitung ist genauer als das Foto.
