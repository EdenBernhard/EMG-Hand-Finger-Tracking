# Nachträglich gesetzte Labels

Hier liegen Labels für Aufnahmen, die **nicht** über die Webapp mit Bewegungsvorgaben entstanden sind (z. B. Testläufe mit EMG and Motion Tools). Die Rohdaten selbst liegen wie alle Aufnahmen unter `data/` und sind nicht versioniert.

Das Format entspricht dem der Pipeline (siehe README, „Messung mit Bewegungsvorgaben“):

- `<Stamm>.cues.csv`: eine Zeile je Bewegung, `sample_index` = Beginn auf der Zeitachse der Rohdaten (2000 Hz). Eine Bewegung gilt bis zur nächsten Zeile bzw. bis `end_sample_index`. Samples vor der ersten Zeile sind Ruhe.
- `<Stamm>.protocol.json`: `end_sample_index`, Sensoren und unter `context` die Herkunft der Labels sowie die Sicherheit je Zeile (`hoch` / `mittel` / `unsicher`).

Unterschiede zu Labels aus der Webapp:

- Die Exporte haben eine Spalte `Time` statt `sample_index`. Umrechnung: `sample_index = round(Time · 2000)`.
- Die Zeitpunkte wurden **nachträglich aus den Signalen** gesetzt und nicht während der Aufnahme vorgegeben. Ihre Genauigkeit liegt eher bei ±0,3 s als bei einem Sample, und Zeilen mit `unsicher` können ganz danebenliegen. Für Training und Evaluation sollte man sie nicht wie echte Vorgaben behandeln.
- Bewegungen mit Wiederholung („3× Pinch“) stehen als **eine** Zeile (`in_row_of = 1`), weil sich die einzelnen Wiederholungen nicht sicher abgrenzen lassen.
- `emitted_host_time_ns` bleibt leer.
- Abschnitte, die zu keiner Bewegung des Ablaufs passen, heißen `unklar` und sollten verworfen werden.

| Aufnahme | Ablauf | Anmerkung |
|---|---|---|
| `2026-11-22_21-44-52_testlauf-000-pa-5-kon` | 15 Bewegungen aus „1. Testrun Datenablauf“ (README) | Sensor 5 ohne Signal, Acc von Sensor 2 unruhig; 20,5–26,1 s `unklar` |
