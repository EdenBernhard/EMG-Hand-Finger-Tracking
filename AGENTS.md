# EMG-Hand-Finger-Tracking

Studienarbeit (DHBW Karlsruhe, Informatik): EMG-Signale auslesen, Hand- und Fingerbewegungen per Machine Learning klassifizieren und vorhersagen, und die erkannten Bewegungen in Computeraktionen sowie eine Roboterhand-Steuerung übersetzen. Ein späteres Ziel ist es, die Vorhersage zu optimieren.

Dieses Repo ist ein Neubau in Python. Die Vorgänger-Repos waren in C#/Java (EMG_Analyse, SST-EMG-Sensor).

## Architektur
Ziel: Hand- und Fingerbewegungen anhand der gemessenen EMG-Werte per ML erkennen und vorhersagen. Die Pipeline besteht aus vier Stufen, in dieser Reihenfolge:

1. **Erfassung** – Rohdaten vom Sensor auslesen (aktuell `src/emg_tracking/acquisition/`)
2. **Vorverarbeitung** – Daten bereinigen, filtern und normalisieren
3. **ML** – Merkmale/Modelle, Training, Evaluation
4. **Ausgabe** – Vorhersage und Übersetzung in Aktionen (Computeraktionen, Roboterhand)

Regeln für jeden Code, den Codex schreibt oder ändert:
- **Single Responsibility:** Jede Klasse und jede Datei hat genau eine Aufgabe. Funktionalität wird sinnvoll auf Klassen/Dateien aufgeteilt, statt große Sammelmodule zu bauen.
- **Stufen sauber trennen:** Jeder Code gehört zu genau einer Stufe. Eine Stufe hängt nur von der vorherigen ab (über klar definierte Datenstrukturen), nie umgekehrt. So vermischt z. B. die Erfassung keine Filterung und das ML keine Hardwarezugriffe.
- **Wenige Abhängigkeiten:** Neue Pakete nur, wenn sie klar nötig sind. Die Standardbibliothek wird bevorzugt, und Abhängigkeiten bleiben klein und übersichtlich.
- Generierten Code vor dem Abschluss immer gegen diese Regeln prüfen.

## Leitlinien
- **Datenqualität & Reproduzierbarkeit zuerst:** feste Seeds, versionierte Konfiguration (Abtastrate, Filter, Fensterung), keine Magic Numbers im Code.
- **Messbarkeit:** Jede Pipeline-Stufe bekommt Tests bzw. Metriken. Ergebnisse müssen über mehrere Probanden vergleichbar sein.
- **Nutzbarkeit für andere:** Das Repo soll für jeden zum Auslesen von EMG-Daten nutzbar sein, und die Daten werden ML-fertig aufbereitet.
- Kommunikation und Doku auf Deutsch. Code, Bezeichner und Commit-Messages dürfen Englisch sein.

## Forschungslogbuch / Session-Protokolle
Aus dieser Arbeit entsteht eine wissenschaftliche Arbeit. Deshalb wird jede Arbeitssession dokumentiert.

- Am Ende einer Session schreibt `/protokoll` eine Notiz nach `docs/sessions/JJJJ-MM-TT.md` (Format siehe Skill `protokoll`).
- **Wenn ich signalisiere, dass ich für heute fertig bin** („passt“, „das war's“, „Feierabend“ o. ä.) und in dieser Session noch kein `/protokoll` lief, frag kurz nach, ob du die Session protokollieren sollst.
- Halte während der Session Entscheidungen samt Begründung und verworfene Ansätze im Blick. Genau das fehlt später im Diff und ist für die Arbeit am wertvollsten.
- Notizen in `docs/sessions/` nie nachträglich umschreiben, nur ergänzen. Sie sind Primärquellen.
