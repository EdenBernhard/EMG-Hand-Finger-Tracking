# EMG-Hand-Finger-Tracking

Studienarbeit (DHBW Karlsruhe, Informatik): EMG-Signale auslesen, Hand- und Fingerbewegungen per Machine Learning klassifizieren und vorhersagen, und die erkannten Bewegungen in Computeraktionen sowie eine Roboterhand-Steuerung übersetzen. Ein späteres Ziel ist es, die Vorhersage zu optimieren.

Dieses Repo ist ein Neubau in Python. Die Vorgänger-Repos waren in C#/Java (EMG_Analyse, SST-EMG-Sensor).

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
