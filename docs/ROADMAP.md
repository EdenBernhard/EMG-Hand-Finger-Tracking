# Fahrplan – was noch fehlt

Weiteres Vorgehen im Projekt. Einrichtung und Nutzung des Repos stehen in der [README](../README.md).

Mit `wavex` entfällt die gesamte C#-/SDK-Schicht der ursprünglichen Studienarbeit (C#-Programm, TCP-Übertragung, SDK-DLLs). Die offenen Punkte, in sinnvoller Reihenfolge:

## Stufe 1 – Bis zur ersten Messung

- [x] Treiber installiert, Receiver erscheint als „EMG and Motion Device“ ([README, Schritt 3](../README.md#schritt-3--treiber-installieren))
- [x] Sensoren in EMG and Motion Tools erkannt, `.cfg` gespeichert (2000 Hz, eigene Kanäle)
- [ ] Testskript aus [README, Schritt 6](../README.md#schritt-6--erster-datenabruf) läuft und zeigt bei Fingerbewegung einen klaren Ausschlag

Erst wenn diese Stufe steht, lohnt sich der Rest – hier zeigt sich, ob `wavex` mit der vorhandenen Hardware zuverlässig läuft.

## Stufe 2 – Saubere Datenerfassung

Hier lagen die meisten Probleme des Altsystems.

- [ ] **Aufnahmeskript mit Protokoll:** Proband-ID, Sitzung, Sensorplatzierung, Bewegung und Wiederholung werden bei jeder Aufnahme mitgeschrieben.
- [ ] **Speicherformat:** Rohdaten in µV plus Metadaten in einer Datei (z. B. HDF5 oder Parquet). Nur Rohdaten speichern, alles Weitere später berechnen – so lässt sich die Vorverarbeitung ändern, ohne neu zu messen.
- [ ] **Labels:** Zeitpunkte, wann welche Bewegung ausgeführt wurde, z. B. über ein Skript, das die Bewegung ansagt („Ringfinger beugen … jetzt“) und den Zeitpunkt speichert. Ohne saubere Labels lernt kein Modell etwas Verlässliches.
- [ ] **Qualitätsprüfung pro Aufnahme:** Paketverluste (Lücken in `ScanNumber`/Zeitstempeln), Rauschen in Ruhe, Übersteuerung, 50-Hz-Netzbrummen.

## Stufe 3 – Verarbeitung und Klassifikation

- [ ] **Vorverarbeitung:** Bandpass 20–450 Hz und Notch-Filter 50 Hz (fehlten im Altsystem komplett).
- [ ] **Segmentierung über gleitende Fenster** (z. B. 200 ms, 50 % Überlappung) statt der fehleranfälligen Zyklus-Erkennung.
- [ ] **Standardmerkmale:** MAV, RMS, Wellenformlänge, Zero Crossings, Slope Sign Changes, Medianfrequenz in Hz – mit getesteten Bibliotheken (`numpy`, `scipy`) statt Eigenbau.
- [ ] **Evaluation:** Trennung von Training und Test nach **Sitzung** und nach **Proband** (Leave-one-subject-out), Konfusionsmatrix, F1 pro Klasse, feste Zufalls-Seeds.

## Stufe 4 – Studiendesign

- [ ] **Messprotokoll:** Bewegungen, Wiederholungen, Pausen, Kraftniveau, Sensorpositionen mit Schablone.
  - [x] Webapp [`frontend/`](../frontend/README.md) berechnet die Elektrodenpositionen pro Proband aus tastbaren Punkten, Maßband-Maßen und Fotos (Anordnungen A–E, D und E mit nur 3 Sensoren – gezielt bzw. als Ring); pro Proband lassen sich mehrere Platzierungen anlegen und vergleichen.
  - [ ] Positionswerte der Anordnungen mit Testmessungen prüfen und anpassen.
  - [x] Messung mit Bewegungsvorgaben aus der Webapp (Schritt 7): Bewegungen, Intervall, Wiederholungen, Vorlauf; Piepton und Anzeige im Browser, Takt und Labels (`.cues.csv`) in Python auf der Sample-Zeitachse. Erfassung über das .NET-SDK (Waveplus.DaqSys) und pythonnet statt `wavex`.
  - [x] Mehrere benannte Messpläne pro Proband; jede Messung speichert Messplan, Elektroden-Platzierung und Notiz.
  - [ ] Mit angeschlossenem Receiver testen (bisher nur ohne Hardware geprüft).
- [ ] **Anzahl der Probanden** festlegen und ob die Sensoren zwischen Sitzungen bewusst neu angelegt werden – das ist entscheidend für die Generalisierung auf neue Personen.
- [ ] Mit dem Betreuer klären, ob für Messungen an anderen Personen eine **Einverständniserklärung** nötig ist.
