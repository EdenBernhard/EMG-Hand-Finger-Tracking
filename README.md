# EMG-Hand-Finger-Tracking
Erfassung, Aufbereitung und Klassifikation von Oberflächen-EMG-Signalen des Unterarms zur Erkennung von Fingerbewegungen – Python-Neubau der Studienarbeit „Analyse und Klassifikation von EMG-Signalen“ (D. Bitzer, DHBW Karlsruhe).

Ziele: saubere, reproduzierbare Rohdaten, vergleichbare Messungen über mehrere Probanden und ML-fertig aufbereitete Datensätze.

> **Status:** im Aufbau. Diese README beschreibt, wie das Messsystem eingerichtet und wie mit dem Repo gearbeitet wird. Das weitere Vorgehen steht im [Fahrplan](docs/ROADMAP.md).

---

## Inhalt

- [Aufbau des Repos](#aufbau-des-repos)
- [Wie die Daten fließen](#wie-die-daten-fließen)
- [Was du brauchst](#was-du-brauchst)
- [Schritt für Schritt zur ersten Messung](#schritt-für-schritt-zur-ersten-messung)
- [Rohdaten aufnehmen](#rohdaten-aufnehmen)
- [Messung mit Bewegungsvorgaben (Webapp)](#messung-mit-bewegungsvorgaben-webapp)
- [Fehlerbehebung](#fehlerbehebung)
- [Hinweise zu Herstellerdateien](#hinweise-zu-herstellerdateien)
- [Quellen](#quellen)

---

## Aufbau des Repos

```
EMG-Hand-Finger-Tracking/
├── backend/     Auslesen der Sensoren und Pipeline (Python): src/, tests/, config/, Driver/, data/
├── frontend/    Webapp pro Proband (Node.js): Elektrodenplatzierung und Messung mit Bewegungsvorgaben, siehe frontend/README.md
└── docs/        Fahrplan und Session-Protokolle
```

Alle Python-Befehle in dieser README werden im Ordner **`backend`** ausgeführt.

---

## Wie die Daten fließen

```
Haut ─▶ Cometa-Sensoren (Pico / Mini Wave) ──Funk──▶ WavePlus-Receiver ──USB──▶ Windows-PC
                                                                                  │
                                                     Treiber (EmgMUsb) ◀──────────┘
                                                            │
                              Python: Cometa-.NET-SDK (Waveplus.DaqSys) über pythonnet
                                                            │
                                         Speichern ─▶ Vorverarbeitung ─▶ Klassifikation
```

- Die Sensoren digitalisieren das Signal selbst (2000 Hz) und funken es über ein **proprietäres Funkprotokoll** (kein Bluetooth) an den Receiver. Deshalb ist der Receiver zwingend nötig.
- Der Receiver ist für den PC ein USB-Gerät mit der Kennung `USB\VID_04B4&PID_1002`. Damit Windows ihn ansprechen kann, braucht es den Cometa-Treiber.
- Python lädt das .NET-SDK von Cometa (`Waveplus.DaqSys.dll`, Version 5.0.7) über [pythonnet](https://pythonnet.github.io/) direkt in den Python-Prozess. Ein separates C#-Programm (wie in der ursprünglichen Studienarbeit) ist damit nicht nötig. Das Paket `wavex` wird seit 2026-11-18 nicht mehr verwendet.

---

## Was du brauchst

### Hardware

| Komponente | Hinweis | Bezugsquelle |
|---|---|---|
| Cometa **WavePlus-Receiver** inkl. USB-Kabel | Originalkabel verwenden | Messsystem des Labors / Betreuer |
| Cometa-**EMG-Sensoren** (Pico oder Mini Wave) | Studienarbeit: 3 Sensoren am Unterarm | Messsystem des Labors |
| **Ladestation** der Sensoren | vor der Messung 2–3 h laden | Messsystem des Labors |
| **Einweg-Klebeelektroden** (Ag/AgCl, vorgegelt) | Verbrauchsmaterial; empfohlen: Ambu BlueSensor N (`N-00-S`), von Cometa mitgeliefert | Labor / Medizinbedarf |
| Einweg-Klebepads für Mini-Wave-Gehäuse | nur bei Mini Wave, nicht bei Pico | Messsystem des Labors / Cometa |
| Alkoholtupfer, Einwegrasierer, ggf. Abrasivgel | Hautvorbereitung (Schritt 7.4) | Apotheke / Drogerie |
| **Windows-PC mit x64-Prozessor** (Intel/AMD) | kein Mac, kein Linux, kein Windows on ARM (Snapdragon), kein Raspberry Pi | – |

### Software

| Software | Wofür | Bezugsquelle |
|---|---|---|
| **Cometa EMG and Motion Tools** | Funktionstest, Sensorkonfiguration, Konfigurationsdatei (`.cfg`) | Liegt dem Messsystem bei oder kostenlos für Cometa-Kunden auf [cometasystems.com/emg-and-motion-tools](https://www.cometasystems.com/emg-and-motion-tools/) (Registrierung für Updates) |
| **WavePlus-USB-Treiber** (`EmgMUsb`) | Windows erkennt den Receiver | Im Software-/Treiberpaket von Cometa; sonst beim Cometa-Support oder beim Laborverantwortlichen anfragen |
| **Python ≥ 3.11 (64-Bit)** | Datenerfassung und Auswertung | [python.org/downloads/windows](https://www.python.org/downloads/windows/) |
| **Cometa-SDK Waveplus.Daq** (.NET, getestet: 5.0.7 vom 16.04.2020) | Zugriff auf Receiver und Sensoren; daraus werden `Waveplus.DaqSys.dll`, `Waveplus.DaqSysInterface.dll` und `CyUSB.dll` gebraucht | Von Cometa (SDK-Paket, nicht öffentlich); beim Laborverantwortlichen oder Cometa-Support anfragen |
| **.NET Framework ≥ 4.6.1** | Laufzeit für das SDK | in Windows 10/11 enthalten (4.8) |
| Python-Paket **`pythonnet`** | lädt das .NET-SDK in Python | wird mit dem Projekt installiert (Schritt 5) |
| **Node.js ≥ 20** | Webapp in `frontend/` (Platzierung, Messung mit Bewegungsvorgaben) | [nodejs.org](https://nodejs.org/) |
| **Git** | Repo klonen | [git-scm.com](https://git-scm.com/download/win) |

---

## Schritt für Schritt zur ersten Messung

### Schritt 1 – Sensoren laden

Sensoren in die Ladestation legen und **2–3 Stunden** vollständig laden.

### Schritt 2 – EMG and Motion Tools installieren

1. Installationsdatei vom Cometa-Paket bzw. von der [Cometa-Website](https://www.cometasystems.com/emg-and-motion-tools/) holen.
2. Installer ausführen (Administratorrechte).
3. Prüfen, ob im Installationsordner bzw. im Paket ein Ordner mit Treibern liegt (Name ähnlich `emgmusbdrivers` oder `Drivers\Win10\x64`). Den brauchst du in Schritt 3.

### Schritt 3 – Treiber installieren

Benötigt wird der Treiber **ab Version 3.1.0.0** (`DriverVer=05/06/2017,3.1.0.00` in der `.inf`). Nur diese Version ist von Microsoft signiert. Die ältere Version 3.0.0.20 (`DriverVer=01/30/2017,3.0.0.20`) ist nur von Cometa signiert und wird von Windows 11 bei aktivem Secure Boot blockiert (Fehlercode 52, siehe [Fehlerbehebung](#fehlerbehebung)). Version und Signatur vor der Installation prüfen: `DriverVer` in der `.inf` ansehen, und Rechtsklick auf `emgmusb.cat` → *Eigenschaften* → *Digitale Signaturen* muss „Microsoft Windows Hardware Compatibility Publisher“ zeigen.

Der Treiber besteht aus fünf Dateien, die **zusammen in einem Ordner** bleiben müssen:

| Datei | Zweck |
|---|---|
| `EmgMUsb.inf` | Installationsanweisung (welches Gerät, welche Dateien) |
| `EmgMUsb.sys` | eigentlicher Kernel-Treiber |
| `emgmusb.cat` | von Microsoft signierter Katalog mit Prüfsummen aller Dateien |
| `EmgMUsb.spt` | Skript, das der Treiber beim Start ausführt |
| `WdfCoinstaller01011.dll` | Hilfsdatei des Windows-Treiber-Frameworks |

**3.1 Receiver anschließen und Gerät identifizieren**

1. Receiver mit dem Originalkabel **direkt** am PC anschließen (kein USB-Hub).
2. Geräte-Manager öffnen (`Win + X` → *Geräte-Manager*).
3. Das Gerät erscheint meist unter *Andere Geräte* (gelbes Warndreieck) oder als unbekanntes USB-Gerät.
4. Rechtsklick → *Eigenschaften* → *Details* → *Hardware-IDs*. Vor der Treiberinstallation steht dort in der Regel **`USB\VID_04B4&PID_1004`**. Das ist der Rohzustand des Receivers. Nach der Installation führt der Treiber `EmgMUsb.spt` aus, und der Receiver meldet sich neu als **`USB\VID_04B4&PID_1002`** („EMG and Motion Device“). Die `.inf` deckt beide Kennungen ab.

**3.2 Treiber installieren** – eine der beiden Varianten:

*Variante A – Geräte-Manager*

Rechtsklick auf das Gerät → *Treiber aktualisieren* → *Auf meinem Computer nach Treibern suchen* → *Aus einer Liste verfügbarer Treiber auswählen* → **Datenträger…** → *Durchsuchen* → `EmgMUsb.inf` wählen → **„EMG and Motion Device“** installieren.

> Der Umweg über *Datenträger* ist nötig, weil die `.inf` (`ExcludeFromSelect = *`) den Treiber nicht in der normalen Auswahlliste anzeigt.

*Variante B – Terminal* (Terminal **als Administrator** öffnen):

```powershell
pnputil /add-driver "C:\Pfad\zum\Treiberordner\EmgMUsb.inf" /install
```

> **Nicht** per Rechtsklick auf die `.inf` → *Installieren*: Diese Methode setzt einen `[DefaultInstall]`-Abschnitt voraus, den diese `.inf` nicht hat – die Installation schlägt dann fehl oder bewirkt nichts. Auch der *Kompatibilitätsmodus* hilft nicht, er wirkt nur auf `.exe`-Dateien.

**3.3 Erfolg prüfen**

- Im Geräte-Manager steht **„EMG and Motion Device“** ohne Warndreieck (ggf. Receiver einmal ab- und wieder anstecken).
- Alternativ im Terminal: `pnputil /enum-devices /connected` muss für `USB\VID_04B4&PID_1002` den Status **Gestartet** zeigen. Steht dort noch `PID_1004` mit einem Problemcode, hat der Treiber nicht geladen (siehe [Fehlerbehebung](#fehlerbehebung)).
- Installierte Version prüfen: `pnputil /enum-drivers` → Eintrag `emgmusb.inf` muss Version **3.1.0.0** und als Signaturgeber „Microsoft Windows Hardware Compatibility Publisher“ zeigen.

### Schritt 4 – Funktionstest und Konfiguration in EMG and Motion Tools

1. Sensoren einschalten, EMG and Motion Tools starten.
2. Die Software muss den Receiver und die Sensoren anzeigen. Notiere, **auf welchem Kanal** welcher Sensor liegt.
3. Abtastrate auf **2000 Hz** stellen und die benötigten Sensoren aktivieren.
4. Die Konfiguration als **`.cfg`-Datei** unter `backend\config\EMGHandMotionToolConfig.cfg` im Repo speichern. Diese Datei braucht nur das Testskript in Schritt 6. Für echte Aufnahmen stehen die Sensoren in `backend/config/acquisition.toml` (siehe [Rohdaten aufnehmen](#rohdaten-aufnehmen)). Die dort eingetragenen `sensor_ids` müssen zu den hier notierten Kanälen passen.
5. EMG and Motion Tools **schließen**, bevor Python auf den Receiver zugreift (nur ein Programm kann das Gerät gleichzeitig nutzen).

### Schritt 5 – Python-Umgebung einrichten

Im Terminal (PowerShell):

```powershell
git clone https://github.com/EdenBernhard/EMG-Hand-Finger-Tracking.git
cd EMG-Hand-Finger-Tracking\backend      # Python-Teil liegt im Ordner backend

python --version                 # muss 3.11 oder neuer sein, 64-Bit
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -e ".[dev]"          # Projekt inkl. pythonnet, numpy und pytest
```

Danach die SDK-Dateien aus dem Cometa-SDK-Paket (Ordner `bin\NET.4.6.1`) nach `backend\lib\cometa\` kopieren:

```powershell
mkdir lib\cometa
copy "<SDK-Ordner>\bin\NET.4.6.1\*.dll" lib\cometa\     # Waveplus.DaqSys.dll, Waveplus.DaqSysInterface.dll, CyUSB.dll
```

Der Ordner ist per `.gitignore` ausgeschlossen (proprietär). Ein anderer Ort lässt sich in `backend/config/acquisition.toml` unter `[sdk] dir` eintragen.

> Falls PowerShell das Aktivieren blockiert: `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` einmalig ausführen.

### Schritt 6 – Erster Datenabruf

Kurze Aufnahme über die Kommandozeile (im Ordner `backend`, Umgebung aktiviert, EMG and Motion Tools geschlossen):

```powershell
python -m emg_tracking.acquisition.cli --duration 5 --name funktionstest
```

Die CLI wartet, bis der Receiver bereit ist und alle Sensoren aus `config/acquisition.toml` senden, nimmt dann 5 s auf und speichert sie unter `data/raw/` (Format siehe [Rohdaten aufnehmen](#rohdaten-aufnehmen)). Wenn die Werte in der CSV bei Fingerbewegungen deutlich ausschlagen, funktioniert die gesamte Kette.

> **Anlaufphase:** Nach `StartCapturing` senden die Sensoren erst nach etwa 5 s (gemessen am 29.10.2026, damals noch über `wavex`), und nicht alle gleichzeitig. Bis dahin liefert der Receiver pro Kanal nur einen konstanten Wert. Die Erfassung erkennt das und verwirft diese Samples.
>
> **Ablauf im SDK:** `new DaqSystem()` → warten, bis `State == Idle` (der Receiver wird im Hintergrund initialisiert) → `ConfigureCapture` (2000 Hz) → `ConfigureSensor` je Sensor als `EMG_SENSOR` → `DataAvailable` abonnieren → `StartCapturing`. Die Werte in `Samples[sensor, sample]` sind laut SDK-Handbuch in µV.
>
> Das frühere Testskript `backend/test_aufnahme.py` nutzt noch `wavex` und die `.cfg` aus Schritt 4. Es gehört nicht mehr zur Einrichtung.

> **Hintergrund:** Laut Datenblatt verarbeiten die Sensoren Eingangssignale bis **±3 mV**, mit 16 Bit und 2000 Hz, und haben einen **Hardware-Bandpass 1. Ordnung (10–500 Hz bzw. 10–1000 Hz)**. Ruhewerte nahe ±3000 µV bedeuten deshalb, dass der Kanal übersteuert ist. Das passiert fast immer, weil der Elektrodenkontakt fehlt, nicht wegen eines Muskelsignals. Der Hardwarefilter ersetzt außerdem nicht die Software-Filterung in Stufe 3, weil er nur flach abfällt (6 dB/Oktave).

---

## Rohdaten aufnehmen

Voraussetzung: Einrichtung bis [Schritt 5](#schritt-5--python-umgebung-einrichten), für echte Messungen zusätzlich Schritt 7 und 8. Im Ordner `backend` mit aktivierter Umgebung:

```powershell
python -m emg_tracking.acquisition.cli --duration 10 --name test
```

Sensoren (`sensor_ids`), Event-Periode, maximale Anlaufzeit (`startup_timeout_s`) und der Ort der SDK-Dateien (`[sdk]`) stehen in `backend/config/acquisition.toml`; die Abtastrate ist fest 2000 Hz. Die `.cfg` aus Schritt 4 wird dafür nicht gebraucht.
Jede Aufnahme landet in `backend/data/raw/` als CSV plus Kopie der verwendeten Konfiguration.

Nach dem Start wartet die CLI, bis **alle** gewählten Sensoren echte Messwerte liefern (Anlaufphase, ca. 5 s). Erst ab dann wird gespeichert, und erst ab dann zählt `--duration` (in Samples, nicht in Rechnerzeit). Sendet ein Sensor bis `startup_timeout_s` nicht, bricht die Aufnahme ab und nennt die betroffenen Sensoren.

| Spalte | Bedeutung |
|---|---|
| `sample_index` | fortlaufend ab 0 (= erster echter Messwert nach der Anlaufphase); Zeit in s = Index / 2000 |
| `host_time_ns` | PC-Zeit beim Eintreffen des SDK-Events (gleich für alle Zeilen eines Events) |
| `sensor_<id>_uV` | Rohwert in µV, unverändert vom SDK, ohne Filter |
| `usb_lost_packets` | vom SDK gemeldete USB-Paketverluste des Events |


---

## Messung mit Bewegungsvorgaben (Webapp)

Für Trainingsdaten wird nicht frei aufgenommen, sondern nach einem **Messplan**. Die Webapp in [`frontend/`](frontend/README.md) verwaltet pro Proband (Schritt 7 „EMG-Messung“) beliebig viele benannte Messpläne (z. B. „Finger einzeln“, „Pinch“), und jeder lässt sich beliebig oft messen. Ein Messplan besteht aus einer Liste von Bewegungen mit je einer **Anzahl** (so oft direkt hintereinander, z. B. Pinch 3×), ein Intervall, die Zahl der **Durchläufe** des ganzen Ablaufs und einen Vorlauf. Bei Faust 1× und Pinch 3× mit 2 Durchläufen lautet die Folge: Faust, Pinch, Pinch, Pinch, Faust, Pinch, Pinch, Pinch. Vor dem Start wählst du die verwendete Elektroden-Platzierung (aus Schritt 6) und gibst optional eine Notiz ein; beides steht später in der Aufnahme. Nach dem Start piept die Webapp im Intervall und zeigt groß die Bewegung, die ab diesem Ton ausgeführt werden soll, mit Countdown und Vorschau auf die nächste.

```powershell
cd frontend
npm start            # http://localhost:3000 → Proband öffnen → 7 · EMG-Messung
```

Der Node-Server startet dafür `python -m emg_tracking.acquisition.measurement.cli` im Ordner `backend` (Python aus `backend\.venv`, sonst `python` aus dem PATH; anderes Python per `$env:PYTHON`). Nur dieser Python-Prozess greift auf den Receiver zu. Es läuft immer höchstens eine Messung.

**Takt:** Die Vorgaben werden in Samples gezählt, nicht im Browser: Vorgabe *k* beginnt bei Sample `(Vorlauf + k · Intervall) · 2000`, gezählt ab dem ersten echten Messwert. Die Labels liegen damit exakt auf der Zeitachse der Rohdaten. Der Piepton kommt etwas später (Event-Periode von 10 ms plus Übertragung), die Reaktion des Probanden nochmals später. Das muss die Vorverarbeitung berücksichtigen, z. B. indem sie den Anfang jedes Segments verwirft.

Dateien in `backend/data/raw/<Proband-ID>/` (die ID aus der Webapp, nicht der Name); der Namensstamm ist `<Zeit>_<Name des Messplans>`, z. B. `2026-11-18_10-15-00_pinch`:

| Datei | Inhalt |
|---|---|
| `<Stamm>.csv` | Rohdaten, Format wie bei der CLI |
| `<Stamm>.cues.csv` | eine Zeile je Vorgabe: `cue_index`, `repetition` (Durchlauf), `movement`, `in_row`/`in_row_of` (z. B. 2/3 = zweiter von drei Pinches am Stück), `sample_index` (Beginn), `emitted_host_time_ns` (Zeitpunkt der Meldung an die Webapp) |
| `<Stamm>.protocol.json` | Messplan (`label` = Name), `context` (Messplan-ID, Elektroden-Platzierung mit Anordnung und Elektrodenabstand, Notiz), Sensoren, SDK-Version, `end_sample_index` (Ende der letzten Vorgabe), Anzahl Samples, ob vollständig oder vorzeitig gestoppt |
| `<Stamm>.config.toml` | Kopie der verwendeten Konfiguration |

Eine Bewegung gilt von ihrem `sample_index` bis zum `sample_index` der nächsten Zeile bzw. bis `end_sample_index`. Samples vor der ersten Vorgabe sind der Vorlauf (Ruhe). Wird vor dem ersten Messwert gestoppt, bleibt nichts gespeichert.

---

## Fehlerbehebung

| Problem | Ursache / Lösung |
|---|---|
| Geräte-Manager zeigt ein falsches Gerät | Gerät hängt an einem falschen Treiber: Rechtsklick → *Gerät deinstallieren* (ggf. Haken *Treiber entfernen*, aber nur bei Nicht-Windows-Treibern), neu anstecken, Schritt 3.2 wiederholen. |
| Hardware-ID ist `PID_1004` statt `PID_1002` | Vor der Treiberinstallation normal (Rohzustand des Receivers, siehe Schritt 3.1). Bleibt es nach der Installation bei `PID_1004`, hat der Treiber nicht geladen. Dann den Problemcode mit `pnputil /enum-devices /connected` prüfen. |
| Gerät bleibt auf `PID_1004`, **Problemcode 52** (`CM_PROB_UNSIGNED_DRIVER`) | Es ist die alte Treiberversion **3.0.0.20** installiert. Sie ist nur von Cometa signiert, und Windows lädt sie bei aktivem Secure Boot nicht. Lösung: Version **3.1.0.0** installieren (von Microsoft signiert, siehe Schritt 3). Sie ersetzt die alte Version, Secure Boot kann dabei an bleiben. Einen anderen Treiber nur ausprobieren, wenn er neuer als 3.0.0.20 oder von Microsoft signiert ist. |
| Windows meldet eine ungültige Signatur | Der Katalog ist von Microsoft signiert, also ist meist eine Datei verändert oder unvollständig (z. B. durch Git oder einen abgebrochenen Download). Originalpaket neu holen, **nicht** die Signaturprüfung abschalten. |
| Treiber installiert, Gerät meldet Fehlercode | Windows 11 kann ältere Treiber über die **Speicherintegrität** blockieren (*Windows-Sicherheit → Gerätesicherheit → Kernisolierung*). Wird der Treiber dort als inkompatibel gelistet: bei Cometa nach einem neueren Treiber fragen. |
| Letzter Ausweg bei Signaturproblemen | Signaturprüfung **für einen Neustart** deaktivieren: *Einstellungen → System → Wiederherstellung → Erweiterter Start → Problembehandlung → Erweiterte Optionen → Starteinstellungen → F7*. Danach ist sie automatisch wieder aktiv. |
| **Impedanz-Check schlägt fehl** / Ruhesignal sehr hoch (Biofeedback-Balken > 30 % in Ruhe, Werte nahe ±3000 µV) | Schlechter Kontakt zwischen Haut und Elektrode. Der Reihe nach prüfen: frische Elektroden (Haltbarkeit, Gel nicht ausgetrocknet), Hautvorbereitung nach Schritt 7.4, ca. 5 min warten, Druckknöpfe fest eingerastet, kein Zug an Kabeln oder Gehäuse (Schritt 8.3). Wird das Signal besser, wenn man den Sensor andrückt, ist es fast sicher ein Kontaktproblem. |
| Problem bleibt bei einem Kanal trotz neuer Elektroden | Sensor mit einem funktionierenden Sensor **an derselben Stelle** tauschen. Wandert der Fehler mit dem Sensor mit, liegt es an der Hardware (Kabel, Druckknopf, Akku, LED blinkt grün = Akku schwach). Bleibt er an der Stelle, liegt es an Haut oder Position. |
| Starkes 50-Hz-Brummen | Netzteil vom Laptop abziehen, Abstand zu Steckdosenleisten und Netzkabeln, Receiver ≥ 1,5 m vom Probanden (Schritt 7.3). Brummen schlägt besonders bei schlechtem Elektrodenkontakt durch. |
| „Receiver nach 10 s nicht bereit (Zustand NotConnected)“ | Receiver nicht per USB verbunden, Treiber nicht geladen (Schritt 3) oder EMG and Motion Tools noch geöffnet. Bei `InitializingError`/`CommunicationError`: Receiver ab- und wieder anstecken. |
| „SDK-Dateien fehlen in …“ | Die DLLs aus dem Cometa-SDK liegen nicht in `backend/lib/cometa/` (Schritt 5) bzw. im Ordner aus `[sdk] dir`. |
| Webapp: „Python ließ sich nicht starten“ oder „No module named emg_tracking“ | Der Server nimmt das falsche Python. `backend\.venv` anlegen und dort `pip install -e ".[dev]"` ausführen, oder vor `npm start` `$env:PYTHON` auf die passende `python.exe` setzen. |
| CLI: „Keine Messwerte nach … s. Ohne Messwerte: Sensor […]“ | Die genannten Sensoren senden nicht: ausgeschaltet, Akku leer, nicht mit dem Receiver gekoppelt, oder `sensor_ids` in `backend/config/acquisition.toml` passt nicht zu den Kanälen aus Schritt 4. |
| `pip install -e ".[dev]"` schlägt fehl | Im Ordner `backend` ausführen (dort liegt `pyproject.toml`). Python-Version ≥ 3.11 und 64-Bit prüfen (`python -c "import struct; print(struct.calcsize('P')*8)"` → `64`). |

---

## Hinweise zu Herstellerdateien

Treiber, SDK-Bibliotheken (`Waveplus.DaqSys.dll`, `CyUSB.dll` usw.) und die Cometa-Software sind **proprietär** und werden in diesem Repository **nicht** mitverteilt. Bezugsquellen siehe [Software](#software).

---

## Quellen

- Cometa: [EMG and Motion Tools](https://www.cometasystems.com/emg-and-motion-tools/)
- Cometa: *Wave Plus – Use and Maintenance Manual*, Rev. 1, 05/05/2025 (Kap. 1.10, 6.1–6.4, 9) – liegt dem Messsystem in Papierform bei
- Cometa: *EMG and Motion Tools – Software Manual*, Rev. 08.15, 11/03/2025 (Kap. 8.3, 12, 21)
- Ambu: [BlueSensor-Katalog](https://cdn.shopify.com/s/files/1/1046/1086/files/Ambu-BlueSensor-Catalog.pdf) (Elektrodengrößen)
- SENIAM: [Empfehlungen zur Elektrodenplatzierung für Oberflächen-EMG](http://www.seniam.org/)
- Cometa: *Waveplus.Daq.NET library*, Rel. 3.0.0.2 (Handbuch, 29.07.2016) und SDK-Paket `Waveplus.Daq_SDK_5.0.7_2020_04_16` mit C#-Beispiel (`WaveplusDaqExampleForm.cs`); vom Hersteller, nicht öffentlich
- [pythonnet](https://pythonnet.github.io/) (Python ↔ .NET)
- Qualisys: [Cometa – Anforderungen und Treiberinstallation](https://docs.qualisys.com/qtm/content/integrations/emgs/cometa_qdev_requirements.htm)
- D. Bitzer: *Analyse und Klassifikation von EMG-Signalen*, Studienarbeit, DHBW Karlsruhe (Kap. 4.1–4.3, Anhang 4)
- Ursprüngliche Repositories: [SST-EMG-Sensor](https://github.com/db1tz3r/SST-EMG-Sensor), [EMG_Analyse](https://github.com/db1tz3r/EMG_Analyse)


## 1. Testrun Datenablauf:

Mit drei Fingern max( Zeigefinger, Mittelfinger, Daumen)

### Startzustand: Flache Hand

1. Hand zu Faust langsam ballen und 2-3 Sekunden halten (Daumen wird nicht umschlossen von anderen Fingern)
2. Hand Drehung um 45 Grad nach oben gegen den Uhrzeigersinn
3. Zeigefinger austrecken
4. Handform beibehalten und drei Wischbewegungen von rechts nach links (Mit Reset)
5. Hand zu Faust zurück ballen
6. Daumen hoch
7. Daumen drei mal auf Zeigefinger drücken
8. Zeigefinger mit gestreckten Daumen ausstrecken
9. "Pinch Bewegung" von Daumen und Zeige Finger drei mal
10. Hand zu Faust zurück ballen
11. Mittelfinger und Zeigefinger austrecken
12. Handform beibehalten und drei Wischbewegungen von rechts nach links mit beiden Fingern (Mit Reset)
13. Hand zu Faust zurück ballen
14. and Drehung um 45 Grad zur Seite gegen im Uhrzeigersinn
15. Faust zur falchen Hand zurück formen
16. ENDE

<img width="1587" height="727" alt="image" src="https://github.com/user-attachments/assets/10dab344-3e16-4d56-bdf5-ad02d8342c9b" />



## Literatur

- https://ieeexplore.ieee.org/stamp/stamp.jsp?tp=&arnumber=10623717&tag=1
- https://journals.plos.org/plosone/article/file?id=10.1371/journal.pone.0186132&type=printable
   
