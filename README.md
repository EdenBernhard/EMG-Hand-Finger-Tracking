# EMG-Hand-Finger-Tracking
Erfassung, Aufbereitung und Klassifikation von Oberflächen-EMG-Signalen des Unterarms zur Erkennung von Fingerbewegungen – Python-Neubau der Studienarbeit „Analyse und Klassifikation von EMG-Signalen“ (D. Bitzer, DHBW Karlsruhe).

Ziele: saubere, reproduzierbare Rohdaten, vergleichbare Messungen über mehrere Probanden und ML-fertig aufbereitete Datensätze.

> **Status:** im Aufbau. Diese README beschreibt zunächst die Einrichtung des Messsystems.

---

## Inhalt

- [Wie die Daten fließen](#wie-die-daten-fließen)
- [Was du brauchst](#was-du-brauchst)
- [Schritt für Schritt zur ersten Messung](#schritt-für-schritt-zur-ersten-messung)
- [Fahrplan – was noch fehlt](#fahrplan--was-noch-fehlt)
- [Fehlerbehebung](#fehlerbehebung)
- [Hinweise zu Herstellerdateien](#hinweise-zu-herstellerdateien)
- [Quellen](#quellen)

---

## Wie die Daten fließen

```
Haut ─▶ Cometa-Sensoren (Pico / Mini Wave) ──Funk──▶ WavePlus-Receiver ──USB──▶ Windows-PC
                                                                                  │
                                                     Treiber (EmgMUsb) ◀──────────┘
                                                            │
                                                Python: Cometa-Paket `wavex`
                                                            │
                                         Speichern ─▶ Vorverarbeitung ─▶ Klassifikation
```

- Die Sensoren digitalisieren das Signal selbst (2000 Hz) und funken es über ein **proprietäres Funkprotokoll** (kein Bluetooth) an den Receiver. Deshalb ist der Receiver zwingend nötig.
- Der Receiver ist für den PC ein USB-Gerät mit der Kennung `USB\VID_04B4&PID_1002`. Damit Windows ihn ansprechen kann, braucht es den Cometa-Treiber.
- Python greift über das offizielle Cometa-Paket [`wavex`](https://pypi.org/project/wavex/) auf die Daten zu. Ein separates C#-Programm (wie in der ursprünglichen Studienarbeit) ist damit nicht mehr nötig.

---

## Was du brauchst

### Hardware

| Komponente | Hinweis | Bezugsquelle |
|---|---|---|
| Cometa **WavePlus-Receiver** inkl. USB-Kabel | Originalkabel verwenden | Messsystem des Labors / Betreuer |
| Cometa-**EMG-Sensoren** (Pico oder Mini Wave) | Studienarbeit: 3 Sensoren am Unterarm | Messsystem des Labors |
| **Ladestation** der Sensoren | vor der Messung 2–3 h laden | Messsystem des Labors |
| **Einweg-Klebeelektroden** | Verbrauchsmaterial | Labor / Medizinbedarf |
| Alkoholtupfer, ggf. Einwegrasierer | Hautvorbereitung | Apotheke / Drogerie |
| **Windows-PC mit x64-Prozessor** (Intel/AMD) | kein Mac, kein Linux, kein Windows on ARM (Snapdragon), kein Raspberry Pi | – |

### Software

| Software | Wofür | Bezugsquelle |
|---|---|---|
| **Cometa EMG and Motion Tools** | Funktionstest, Sensorkonfiguration, Konfigurationsdatei (`.cfg`) | Liegt dem Messsystem bei oder kostenlos für Cometa-Kunden auf [cometasystems.com/emg-and-motion-tools](https://www.cometasystems.com/emg-and-motion-tools/) (Registrierung für Updates) |
| **WavePlus-USB-Treiber** (`EmgMUsb`) | Windows erkennt den Receiver | Im Software-/Treiberpaket von Cometa; sonst beim Cometa-Support oder beim Laborverantwortlichen anfragen |
| **Python ≥ 3.11 (64-Bit)** | Datenerfassung und Auswertung | [python.org/downloads/windows](https://www.python.org/downloads/windows/) |
| Python-Paket **`wavex`** | Zugriff auf Receiver und Sensoren aus Python | wird mit dem Projekt installiert (Schritt 5; [PyPI](https://pypi.org/project/wavex/), Herausgeber: Cometa srl) |
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
4. Rechtsklick → *Eigenschaften* → *Details* → *Hardware-IDs*. Dort muss **`USB\VID_04B4&PID_1002`** stehen.

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

### Schritt 4 – Funktionstest und Konfiguration in EMG and Motion Tools

1. Sensoren einschalten, EMG and Motion Tools starten.
2. Die Software muss den Receiver und die Sensoren anzeigen. Notiere, **auf welchem Kanal** welcher Sensor liegt.
3. Abtastrate auf **2000 Hz** stellen und die benötigten Sensoren aktivieren.
4. Die Konfiguration als **`.cfg`-Datei** speichern, z. B. unter `config\3sensoren_2000hz.cfg` im Repo. Python lädt später genau diese Datei – so ist jede Messung mit derselben Konfiguration reproduzierbar.
5. EMG and Motion Tools **schließen**, bevor Python auf den Receiver zugreift (nur ein Programm kann das Gerät gleichzeitig nutzen).

### Schritt 5 – Python-Umgebung einrichten

Im Terminal (PowerShell) im Repo-Ordner:

```powershell
git clone https://github.com/EdenBernhard/EMG-Hand-Finger-Tracking.git
cd EMG-Hand-Finger-Tracking

python --version                 # muss 3.11 oder neuer sein, 64-Bit
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -e ".[dev]"          # Projekt inkl. wavex, numpy und pytest
pip install matplotlib           # nur für das Testskript in Schritt 6
```

> Falls PowerShell das Aktivieren blockiert: `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` einmalig ausführen.

### Schritt 6 – Erster Datenabruf

Testskript, angelehnt an das Beispiel aus der [`wavex`-Dokumentation](https://pypi.org/project/wavex/) (mit der Hardware dieses Projekts noch nicht getestet):

```python
import time
import numpy as np
import matplotlib.pyplot as plt
import wavex

buffer = []

def on_data(args):
    # args.EmgSamples: NumPy-Array [Kanal, Sample]; kopieren, da der Puffer danach wiederverwendet wird
    buffer.append(args.EmgSamples.copy())

daq = wavex.DaqSystem()
enabled = daq.LoadConfiguration(r"config\3sensoren_2000hz.cfg")   # in Schritt 4 gespeichert
print("Aktivierte Kanäle:", enabled)

daq.OnDataAvailable(on_data)
daq.StartCapturing(wavex.enums.DataAvailableEventPeriod.ms_100)
time.sleep(5)                      # 5 s aufnehmen – dabei Finger bewegen
daq.StopCapturing()

emg = np.concatenate(buffer, axis=1)   # [Kanal, Sample] in µV
print("Form:", emg.shape)              # bei 2000 Hz und 5 s ≈ 10 000 Samples pro Kanal
np.save("test_aufnahme.npy", emg)

plt.plot(emg.T)
plt.xlabel("Sample (2000 Hz)")
plt.ylabel("EMG [µV]")
plt.show()
```

Wenn ein Signal erscheint, das bei Fingerbewegungen deutlich ausschlägt, funktioniert die gesamte Kette.

> Statt einer `.cfg`-Datei lässt sich die Erfassung laut `wavex`-Dokumentation auch direkt im Code konfigurieren (Methoden mit Suffix `_p` für WavePlus, z. B. `set_emg_acq_p`). Der Treiber aus Schritt 3 bleibt in jedem Fall nötig – ihn braucht Windows, unabhängig von der Bibliothek.

### Schritt 7 – Sensoren anbringen (für echte Messungen)

1. Haut an den Messstellen mit Alkohol reinigen, bei Bedarf rasieren.
2. Elektroden über dem Muskelbauch, **parallel zum Faserverlauf** kleben (Unterarm: Fingerbeuger und -strecker).
3. Positionen markieren oder eine Schablone verwenden (in der Studienarbeit: markierter Strumpf), damit sie bei jeder Sitzung und jedem Probanden gleich sind.
4. Kabel bzw. Sensoren so fixieren, dass sie sich bei Bewegung nicht verschieben (Bewegungsartefakte).

---

## Fahrplan – was noch fehlt

Mit `wavex` entfällt die gesamte C#-/SDK-Schicht der ursprünglichen Studienarbeit (C#-Programm, TCP-Übertragung, SDK-DLLs). Die offenen Punkte, in sinnvoller Reihenfolge:

### Stufe 1 – Bis zur ersten Messung

- [ ] Treiber installiert, Receiver erscheint als „EMG and Motion Device“ ([Schritt 3](#schritt-3--treiber-installieren))
- [ ] Sensoren in EMG and Motion Tools erkannt, `.cfg` gespeichert (2000 Hz, eigene Kanäle)
- [ ] Testskript aus [Schritt 6](#schritt-6--erster-datenabruf) läuft und zeigt bei Fingerbewegung einen klaren Ausschlag

Erst wenn diese Stufe steht, lohnt sich der Rest – hier zeigt sich, ob `wavex` mit der vorhandenen Hardware zuverlässig läuft.

### Stufe 2 – Saubere Datenerfassung

Hier lagen die meisten Probleme des Altsystems.

- [ ] **Aufnahmeskript mit Protokoll:** Proband-ID, Sitzung, Sensorplatzierung, Bewegung und Wiederholung werden bei jeder Aufnahme mitgeschrieben.
- [ ] **Speicherformat:** Rohdaten in µV plus Metadaten in einer Datei (z. B. HDF5 oder Parquet). Nur Rohdaten speichern, alles Weitere später berechnen – so lässt sich die Vorverarbeitung ändern, ohne neu zu messen.
- [ ] **Labels:** Zeitpunkte, wann welche Bewegung ausgeführt wurde, z. B. über ein Skript, das die Bewegung ansagt („Ringfinger beugen … jetzt“) und den Zeitpunkt speichert. Ohne saubere Labels lernt kein Modell etwas Verlässliches.
- [ ] **Qualitätsprüfung pro Aufnahme:** Paketverluste (Lücken in `ScanNumber`/Zeitstempeln), Rauschen in Ruhe, Übersteuerung, 50-Hz-Netzbrummen.

### Stufe 3 – Verarbeitung und Klassifikation

- [ ] **Vorverarbeitung:** Bandpass 20–450 Hz und Notch-Filter 50 Hz (fehlten im Altsystem komplett).
- [ ] **Segmentierung über gleitende Fenster** (z. B. 200 ms, 50 % Überlappung) statt der fehleranfälligen Zyklus-Erkennung.
- [ ] **Standardmerkmale:** MAV, RMS, Wellenformlänge, Zero Crossings, Slope Sign Changes, Medianfrequenz in Hz – mit getesteten Bibliotheken (`numpy`, `scipy`) statt Eigenbau.
- [ ] **Evaluation:** Trennung von Training und Test nach **Sitzung** und nach **Proband** (Leave-one-subject-out), Konfusionsmatrix, F1 pro Klasse, feste Zufalls-Seeds.

### Stufe 4 – Studiendesign

- [ ] **Messprotokoll:** Bewegungen, Wiederholungen, Pausen, Kraftniveau, Sensorpositionen mit Schablone.
- [ ] **Anzahl der Probanden** festlegen und ob die Sensoren zwischen Sitzungen bewusst neu angelegt werden – das ist entscheidend für die Generalisierung auf neue Personen.
- [ ] Mit dem Betreuer klären, ob für Messungen an anderen Personen eine **Einverständniserklärung** nötig ist.

---

## Fehlerbehebung

| Problem | Ursache / Lösung |
|---|---|
| Geräte-Manager zeigt ein falsches Gerät | Gerät hängt an einem falschen Treiber: Rechtsklick → *Gerät deinstallieren* (ggf. Haken *Treiber entfernen*, aber nur bei Nicht-Windows-Treibern), neu anstecken, Schritt 3.2 wiederholen. |
| Hardware-ID ist nicht `PID_1002` (z. B. `PID_1004`) | Gerät meldet sich anders. Die `.inf` deckt das ab, trotzdem Rücksprache mit Cometa halten. |
| Windows meldet eine ungültige Signatur | Der Katalog ist von Microsoft signiert, also ist meist eine Datei verändert oder unvollständig (z. B. durch Git oder einen abgebrochenen Download). Originalpaket neu holen, **nicht** die Signaturprüfung abschalten. |
| Treiber installiert, Gerät meldet Fehlercode | Windows 11 kann ältere Treiber über die **Speicherintegrität** blockieren (*Windows-Sicherheit → Gerätesicherheit → Kernisolierung*). Wird der Treiber dort als inkompatibel gelistet: bei Cometa nach einem neueren Treiber fragen. |
| Letzter Ausweg bei Signaturproblemen | Signaturprüfung **für einen Neustart** deaktivieren: *Einstellungen → System → Wiederherstellung → Erweiterter Start → Problembehandlung → Erweiterte Optionen → Starteinstellungen → F7*. Danach ist sie automatisch wieder aktiv. |
| Python findet kein Gerät | EMG and Motion Tools noch geöffnet? Schließen. Sensoren eingeschaltet und geladen? Konfigurationspfad korrekt? |
| `pip install -e ".[dev]"` schlägt fehl | Python-Version ≥ 3.11 und 64-Bit prüfen (`python -c "import struct; print(struct.calcsize('P')*8)"` → `64`). |

---

## Hinweise zu Herstellerdateien

Treiber, SDK-Bibliotheken (`Waveplus.DaqSys.dll`, `CyUSB.dll` usw.) und die Cometa-Software sind **proprietär** und werden in diesem Repository **nicht** mitverteilt. Bezugsquellen siehe [Software](#software).

---

## Quellen

- Cometa: [EMG and Motion Tools](https://www.cometasystems.com/emg-and-motion-tools/)
- Cometa: Python-Paket [`wavex` auf PyPI](https://pypi.org/project/wavex/)
- Qualisys: [Cometa – Anforderungen und Treiberinstallation](https://docs.qualisys.com/qtm/content/integrations/emgs/cometa_qdev_requirements.htm)
- D. Bitzer: *Analyse und Klassifikation von EMG-Signalen*, Studienarbeit, DHBW Karlsruhe (Kap. 4.1–4.3, Anhang 4)
- Ursprüngliche Repositories: [SST-EMG-Sensor](https://github.com/db1tz3r/SST-EMG-Sensor), [EMG_Analyse](https://github.com/db1tz3r/EMG_Analyse)

## Rohdaten aufnehmen (Cometa Wave Plus)

### Aufnahme
Voraussetzung: Einrichtung bis Schritt 5.

```powershell
python -m emg_tracking.acquisition.cli --duration 10 --name test
```

Sensoren und Event-Periode stehen in `config/acquisition.toml`; die Abtastrate ist fest 2000 Hz.
Jede Aufnahme landet in `data/raw/` als CSV plus Kopie der verwendeten Konfiguration.

| Spalte | Bedeutung |
|---|---|
| `sample_index` | fortlaufend ab 0; Zeit in s = Index / 2000 |
| `host_time_ns` | PC-Zeit beim Eintreffen des SDK-Events (gleich für alle Zeilen eines Events) |
| `sensor_<id>_uV` | Rohwert in µV, unverändert vom SDK, ohne Filter |
| `usb_lost_packets` | vom SDK gemeldete USB-Paketverluste des Events |
