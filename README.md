# EMG-Hand-Finger-Tracking
Erfassung, Aufbereitung und Klassifikation von Oberflächen-EMG-Signalen des Unterarms zur Erkennung von Fingerbewegungen – Python-Neubau der Studienarbeit „Analyse und Klassifikation von EMG-Signalen“ (D. Bitzer, DHBW Karlsruhe).

Ziele: saubere, reproduzierbare Rohdaten, vergleichbare Messungen über mehrere Probanden und ML-fertig aufbereitete Datensätze.

> **Status:** im Aufbau. Diese README beschreibt, wie das Messsystem eingerichtet und wie mit dem Repo gearbeitet wird. Das weitere Vorgehen steht im [Fahrplan](docs/ROADMAP.md).

---

## Inhalt

- [Wie die Daten fließen](#wie-die-daten-fließen)
- [Was du brauchst](#was-du-brauchst)
- [Schritt für Schritt zur ersten Messung](#schritt-für-schritt-zur-ersten-messung)
- [Rohdaten aufnehmen](#rohdaten-aufnehmen)
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
4. Die Konfiguration als **`.cfg`-Datei** unter `config\EMGHandMotionToolConfig.cfg` im Repo speichern. Diese Datei braucht nur das Testskript in Schritt 6. Für echte Aufnahmen stehen die Sensoren in `config/acquisition.toml` (siehe [Rohdaten aufnehmen](#rohdaten-aufnehmen)). Die dort eingetragenen `sensor_ids` müssen zu den hier notierten Kanälen passen.
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

Testskript, angelehnt an das Beispiel, das im `wavex`-Paket mitgeliefert wird (`wavex/test.py`). Mit dieser Hardware getestet am 29.10.2026. Als `test_aufnahme.py` im Repo-Ordner speichern und mit `python test_aufnahme.py` starten.

```python
import time
from pathlib import Path

import matplotlib.pyplot as plt
import numpy as np
import wavex

CONFIG_FILE = Path(__file__).resolve().parent / "config" / "EMGHandMotionToolConfig.cfg"  # aus Schritt 4
WARMUP_S = 7      # Anlaufzeit der Sensoren, siehe Hinweis unten
DURATION_S = 5

buffer = []

def on_data(args):
    # args.EmgSamples: NumPy-Array [Kanal, Sample]; kopieren, da der Puffer danach wiederverwendet wird
    buffer.append(args.EmgSamples.copy())

daq = wavex.DaqSystem()
try:
    # Reihenfolge wie im Herstellerbeispiel: erst Erfassung konfigurieren, dann .cfg laden
    capture_cfg = wavex.CaptureConfiguration()
    capture_cfg.set_emg_acq_p(wavex.enums.EmgAcqPType.Emg_2kHz_Acc_142Hz)  # WavePlus: EMG mit 2000 Hz
    daq.OnDataAvailable(on_data)
    daq.ConfigureCapture(capture_cfg)
    enabled = daq.LoadConfiguration(str(CONFIG_FILE))
    print("Aktivierte EMG-Kanäle:", [i + 1 for i, on in enumerate(enabled["EnabledEfaChannels"]) if on])

    daq.StartCapturing(wavex.enums.DataAvailableEventPeriod.ms_100)
    time.sleep(WARMUP_S)           # Anlaufphase abwarten und verwerfen
    buffer.clear()
    print(f"Aufnahme läuft {DURATION_S} s – Finger bewegen ...")
    time.sleep(DURATION_S)
    daq.StopCapturing()
finally:
    daq.close()                    # Gerät freigeben, auch bei Fehlern

emg = np.concatenate(buffer, axis=1)   # [Kanal, Sample] in µV
print("Form:", emg.shape)              # bei 2000 Hz und 5 s ca. 10 000 Samples pro Kanal
np.save("test_aufnahme.npy", emg)

plt.plot(emg.T)
plt.xlabel("Sample (2000 Hz)")
plt.ylabel("EMG [µV]")
plt.show()
```

Wenn ein Signal erscheint, das bei Fingerbewegungen deutlich ausschlägt, funktioniert die gesamte Kette.

> **Anlaufphase:** Nach `StartCapturing` senden die Sensoren erst nach etwa 5 s (gemessen am 29.10.2026), und nicht alle gleichzeitig. Bis dahin liefert der Receiver pro Kanal nur einen konstanten Wert. Ohne Wartezeit sieht man deshalb nur flache Linien.
>
> **`ConfigureCapture` mit `set_emg_acq_p`** ist nötig, weil der Receiver ein WavePlus ist (Suffix `_p`). Mit dem Wave-X-Modus (`set_emg_acq_x`) kommen keine Daten.

### Schritt 7 – Vorbereitung vor dem Anlegen der Elektroden

Der Kontakt zwischen Haut und Elektrode entscheidet über die Datenqualität. Ein schlechter Kontakt lässt sich später durch keinen Filter retten. Diese Schritte deshalb **vor jeder Sitzung** vollständig durchgehen und das Ergebnis im Sitzungsprotokoll festhalten.

**7.1 Material prüfen**

- [ ] **Elektroden:** frische, vorgegelte Ag/AgCl-Einwegelektroden. Cometa liefert **Ambu BlueSensor N** (`N-00-S`, ca. 44,8 × 22 mm) mit. Wegen ihrer schmalen Form passen sie gut an den Unterarm. Große EKG-Elektroden (z. B. BlueSensor R, VL) sind ungeeignet, weil sie Signale benachbarter Muskeln mitmessen (Übersprechen).
- [ ] **Haltbarkeitsdatum** prüfen. Angebrochene Beutel wieder verschließen. Ausgetrocknetes Gel ist die häufigste Ursache für einen fehlschlagenden Impedanz-Check.
- [ ] Elektroden **nie wiederverwenden**, auch nicht innerhalb derselben Sitzung nach dem Umkleben.
- [ ] Bei **Mini Wave**: die mitgelieferten Einweg-Klebepads für das Sensorgehäuse bereitlegen (siehe 8.3). Bei **Pico** werden keine Pads benötigt.
- [ ] Alkoholtupfer, Einwegrasierer, ggf. Abrasivgel oder ein trockenes, raues Tuch, Hautmarker bzw. Schablone (Strumpf).

**7.2 Sensoren und Receiver vorbereiten**

- [ ] Sensoren vollständig geladen: Ladestation-LED **grün** (8-h-Ladezyklus beendet), Sensor-LED **orange aus**.
- [ ] Sensoren auf Beschädigungen prüfen, besonders die Kabel und Druckknöpfe der Mini Wave.
- [ ] Receiver einschalten (Schalter hinten). Die erste LED links auf der Vorderseite muss leuchten.
- [ ] Notieren, **welcher Sensor (Kanalnummer auf dem Gehäuse)** an welche Position kommt. Bei jeder Sitzung und jedem Probanden dieselbe Zuordnung verwenden, auch beim Sensortyp: Pico (feste Druckknöpfe) und Mini Wave (Kabel) messen wegen des unterschiedlichen Elektrodenabstands nicht identisch.

**7.3 Messumgebung**

- [ ] Receiver **mindestens 1,5 m** vom Probanden entfernt aufstellen. Receiver und Proband nie gleichzeitig berühren.
- [ ] Smartphones und andere Funkgeräte **mindestens 30 cm** von Sensoren und Receiver fernhalten. Nicht direkt neben anderen elektromedizinischen Geräten messen.
- [ ] Netzbrummen (50 Hz) verringern: Abstand zu Steckdosenleisten und Netzkabeln. Den Laptop möglichst im Akkubetrieb laufen lassen.
- [ ] Der Raum sollte normal temperiert sein (Betriebsbereich 10–35 °C). Kalte Haut erhöht die Impedanz, Schweiß verschlechtert die Haftung.

**7.4 Proband und Haut**

- [ ] Fragen, ob eine **Unverträglichkeit gegen Elektrodengel oder Kleber** bekannt ist.
- [ ] Die Haut an den Messstellen muss **unverletzt** sein. Nicht auf Wunden, Ekzemen oder gereizter Haut messen.
- [ ] Der Proband sitzt bequem. Der Unterarm liegt entspannt auf, die Handfläche zeigt in die Position, die auch während der Messung gilt.
- [ ] Messstellen mit Schablone oder Strumpf anzeichnen (siehe Schritt 8.1).
- [ ] **Hautvorbereitung**, in dieser Reihenfolge:
  1. Haare an den Messstellen **rasieren**.
  2. Haut **leicht anrauen**, z. B. mit Abrasivgel oder einigen Strichen mit einem trockenen, rauen Tuch. Das entfernt abgestorbene Hautschüppchen und senkt die Hautimpedanz deutlich.
  3. Mit **Alkohol** reinigen (Fett, Creme, Schweiß).
  4. Haut **vollständig trocknen lassen**. Auf feuchter Haut haften die Elektroden schlecht.

### Schritt 8 – Sensoren anbringen (für echte Messungen)

**8.1 Positionen**

1. Elektroden über dem Muskelbauch, **parallel zum Faserverlauf** kleben (Unterarm: Fingerbeuger und -strecker). Laut Cometa liegen sie in Längsrichtung **mittig zwischen Innervationszone und distaler Sehne**, also nicht direkt auf der Innervationszone und nicht auf der Sehne. In Querrichtung halten sie Abstand zum Rand des Muskels, damit Nachbarmuskeln möglichst wenig einstreuen.
2. Elektrodenabstand etwa **20 mm** (Mitte zu Mitte, SENIAM-Empfehlung). Beim Pico ist er durch die festen Druckknöpfe vorgegeben.
3. Positionen markieren oder eine Schablone verwenden (in der Studienarbeit: markierter Strumpf), damit sie bei jeder Sitzung und jedem Probanden gleich sind. Am besten zusätzlich ein Foto der Platzierung ins Sitzungsprotokoll legen.

**8.2 Pico**

1. Elektroden auf die Druckknöpfe des Pico klicken (fest einrasten lassen) und den Pico mit den Elektroden auf die Haut kleben.
2. Die Elektroden halten den Sensor, zusätzliche Klebepads sind nicht nötig. Die Elektroden sollten aber vollflächig aufliegen: Eine Schablone oder ein Strumpf darf den Sensor andrücken, ihn aber nicht wegziehen oder kippen.

**8.3 Mini Wave**

Reihenfolge laut Cometa:

1. Elektroden auf die vorbereitete Haut kleben.
2. Einweg-Klebepad erst auf das Sensorgehäuse, dann auf die Haut kleben. Das Gehäuse darf **nie direkt auf der Haut** liegen. Pads nicht wiederverwenden, beim Umsetzen ein neues Pad nehmen.
3. Gehäuse so platzieren, dass die Kabel die Elektroden **ohne Zug** erreichen. Nahe am Handgelenk oder Ellenbogen prüfen, ob die Bewegung die Kabel spannt.
4. Erst danach die Druckknöpfe mit den Elektroden verbinden.

> Zieht ein Kabel an der Elektrode, verliert diese teilweise den Kontakt. Typisches Symptom: Das Signal wird besser, wenn man den Sensor andrückt.

**8.4 Kurz warten, dann prüfen**

1. Nach dem Aufkleben **ca. 5 Minuten warten**. In dieser Zeit zieht das Gel in die Haut ein und die Impedanz sinkt (Erfahrungswert, keine Herstellerangabe).
2. Sensor-LEDs prüfen: grün = verbunden. Am Receiver leuchtet pro verbundenem Kanal eine LED.
3. In EMG and Motion Tools den **Impedanz-Check** ausführen (Konfiguration → EMG → *Check Impedance*, Grenze < 100 kΩ, nur WavePlus) und das Ergebnis pro Kanal ins Protokoll schreiben.
4. **Ruhesignal** prüfen, z. B. in der Biofeedback-Ansicht (Spalte *BFB* in der EMG-Konfiguration aktivieren): Bei entspanntem Arm liegt der Balken nahe 0 %. Beim Anspannen schlägt er deutlich aus.
5. Erst wenn alle Kanäle diese Prüfung bestehen, EMG and Motion Tools schließen und die Aufnahme starten. Sonst: siehe [Fehlerbehebung](#fehlerbehebung).

> **Hintergrund:** Laut Datenblatt verarbeiten die Sensoren Eingangssignale bis **±3 mV**, mit 16 Bit und 2000 Hz, und haben einen **Hardware-Bandpass 1. Ordnung (10–500 Hz bzw. 10–1000 Hz)**. Ruhewerte nahe ±3000 µV bedeuten deshalb, dass der Kanal übersteuert ist. Das passiert fast immer, weil der Elektrodenkontakt fehlt, nicht wegen eines Muskelsignals. Der Hardwarefilter ersetzt außerdem nicht die Software-Filterung in Stufe 3, weil er nur flach abfällt (6 dB/Oktave).

---

## Rohdaten aufnehmen

Voraussetzung: Einrichtung bis [Schritt 5](#schritt-5--python-umgebung-einrichten), für echte Messungen zusätzlich Schritt 7 und 8.

```powershell
python -m emg_tracking.acquisition.cli --duration 10 --name test
```

Sensoren (`sensor_ids`), Event-Periode und maximale Anlaufzeit (`startup_timeout_s`) stehen in `config/acquisition.toml`; die Abtastrate ist fest 2000 Hz. Die `.cfg` aus Schritt 4 wird dafür nicht gebraucht.
Jede Aufnahme landet in `data/raw/` als CSV plus Kopie der verwendeten Konfiguration.

Nach dem Start wartet die CLI, bis **alle** gewählten Sensoren echte Messwerte liefern (Anlaufphase, ca. 5 s). Erst ab dann wird gespeichert, und erst ab dann zählt `--duration`. Sendet ein Sensor bis `startup_timeout_s` nicht, bricht die Aufnahme ab und nennt die betroffenen Sensoren.

| Spalte | Bedeutung |
|---|---|
| `sample_index` | fortlaufend ab 0 (= erster echter Messwert nach der Anlaufphase); Zeit in s = Index / 2000 |
| `host_time_ns` | PC-Zeit beim Eintreffen des SDK-Events (gleich für alle Zeilen eines Events) |
| `sensor_<id>_uV` | Rohwert in µV, unverändert vom SDK, ohne Filter |
| `usb_lost_packets` | vom SDK gemeldete USB-Paketverluste des Events |

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
| Python findet kein Gerät | EMG and Motion Tools noch geöffnet? Schließen. Sensoren eingeschaltet und geladen? Konfigurationspfad korrekt? |
| Testskript zeigt nur flache Linien (jeder Kanal ein konstanter Wert) | Die Aufnahme lag in der Anlaufphase der Sensoren (ca. 5 s nach dem Start) oder `ConfigureCapture` fehlt. Skript aus Schritt 6 in der aktuellen Fassung verwenden. |
| CLI: „Keine Messwerte nach … s. Ohne Messwerte: Sensor […]“ | Die genannten Sensoren senden nicht: ausgeschaltet, Akku leer, nicht mit dem Receiver gekoppelt, oder `sensor_ids` in `config/acquisition.toml` passt nicht zu den Kanälen aus Schritt 4. |
| `pip install -e ".[dev]"` schlägt fehl | Python-Version ≥ 3.11 und 64-Bit prüfen (`python -c "import struct; print(struct.calcsize('P')*8)"` → `64`). |

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
- Cometa: Python-Paket [`wavex` auf PyPI](https://pypi.org/project/wavex/)
- Qualisys: [Cometa – Anforderungen und Treiberinstallation](https://docs.qualisys.com/qtm/content/integrations/emgs/cometa_qdev_requirements.htm)
- D. Bitzer: *Analyse und Klassifikation von EMG-Signalen*, Studienarbeit, DHBW Karlsruhe (Kap. 4.1–4.3, Anhang 4)
- Ursprüngliche Repositories: [SST-EMG-Sensor](https://github.com/db1tz3r/SST-EMG-Sensor), [EMG_Analyse](https://github.com/db1tz3r/EMG_Analyse)
