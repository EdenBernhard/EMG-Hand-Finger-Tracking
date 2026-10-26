---
name: protokoll
description: Schreibt eine Session-Notiz für das Forschungslogbuch der Studienarbeit nach docs/sessions/ und committet sie. Verwenden bei /protokoll oder wenn Eden die aktuelle Arbeitssession dokumentieren möchte.
argument-hint: "[optionale Erkenntnisse/Notizen zur Session]"
disable-model-invocation: true
model: sonnet
---

# /protokoll – Session-Notiz für das Forschungslogbuch

Diese Notizen sind Primärquellen für eine wissenschaftliche Arbeit. Sie müssen später fast direkt in Methodik, Ergebnisse und Diskussion übernommen werden können.

## 1. Material sammeln
- **Gesprächsverlauf dieser Session:** Ziel, was gebaut oder getestet wurde, Entscheidungen samt Begründung, betrachtete Alternativen, Fehlschläge.
- **Git:** `git status`, `git diff` (staged + unstaged) und `git log --oneline` seit der neuesten Datei in `docs/sessions/`. Gibt es noch keine Datei, nimm die Commits von heute.
- **Zusätzliche Notizen von Eden:** $ARGUMENTS
  (Das kann diktierter Text sein: Füllwörter und Selbstkorrekturen auflösen, die letzte Aussage gilt.)

## 2. Datei schreiben
`docs/sessions/JJJJ-MM-TT.md` mit dem heutigen Datum. Existiert die Datei schon, hänge einen neuen Abschnitt `## Session HH:MM` an und überschreibe nichts.

Kopf der Datei (nur beim Anlegen):
```
# Session JJJJ-MM-TT – <Thema in wenigen Worten>
```

Abschnitte (auf Deutsch, kompakt, leere Abschnitte weglassen):
- **Ziel der Session**
- **Durchgeführt**: 2–5 sachliche Sätze im Stil eines Methodenteils
- **Code-Änderungen**: Datei/Modul → was und vor allem *warum*; kurze Commit-Hashes als Beleg
- **Ergebnisse / Beobachtungen**: konkrete Zahlen, Parameter, Testergebnisse, Metriken mit Einheit
- **Interpretation**: nur wenn Eden selbst eine Deutung geäußert hat; getrennt von den Beobachtungen
- **Entscheidungen & Begründung**: „X statt Y, weil …“, inkl. verworfener Alternativen
- **Probleme / Verworfenes**: was nicht funktioniert hat und weshalb
- **Offene Fragen / nächste Schritte**
- **Quellen**: nur wenn genannt (Paper, Doku, Datenblatt)

## 3. Regeln
- Nichts erfinden. Unsichere Angaben markieren: „(nicht verifiziert)“.
- Beobachtung und Interpretation trennen.
- Keinen Code abschreiben, nur inhaltlich zusammenfassen.
- Fehlen wichtige Zahlen oder ist eine Begründung unklar, stelle **eine** gebündelte Rückfrage, bevor du schreibst.

## 4. Commit
- Committe die Notiz mit der Message `docs: Session-Protokoll JJJJ-MM-TT`.
- Gibt es noch uncommittete Code-Änderungen aus dieser Session, frag, ob sie in einem eigenen Commit vorher mit sollen. Committe nichts, was erkennbar nicht zu dieser Session gehört.
- Nicht automatisch pushen. Frag am Ende kurz, ob gepusht werden soll, denn das Forschungslogbuch im Chat liest die Notizen von GitHub.

## 5. Abschluss
Gib Eden eine Zusammenfassung in 2–3 Sätzen und nenne den Dateipfad.
