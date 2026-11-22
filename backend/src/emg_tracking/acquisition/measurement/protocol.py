"""Messplan einer Messung: welche Bewegungen, wie oft direkt hintereinander, in welchem Takt, wie oft insgesamt."""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Any

# Wird als Ordnername unter data/raw/ verwendet, daher nur unkritische Zeichen.
SUBJECT_ID_PATTERN = re.compile(r"^[A-Za-z0-9_-]{1,64}$")
MAX_LABEL_LENGTH = 80


def _positive_int(value: Any, what: str) -> int:
    if not isinstance(value, int) or isinstance(value, bool) or value < 1:
        raise ValueError(f"{what} muss eine ganze Zahl ≥ 1 sein: {value!r}")
    return value


@dataclass(frozen=True)
class Movement:
    name: str
    count: int = 1  # so oft direkt hintereinander, jedes Mal mit eigener Vorgabe (z. B. Pinch 3×)

    @classmethod
    def from_raw(cls, raw: Any) -> Movement | None:
        """Nimmt ``"Faust"`` oder ``{"name": "Pinch", "count": 3}``; leere Namen ergeben None."""
        if isinstance(raw, dict):
            name = str(raw.get("name", "")).strip()
            return cls(name, _positive_int(raw.get("count", 1), f"count von {name!r}")) if name else None
        name = str(raw).strip()
        return cls(name) if name else None


@dataclass(frozen=True)
class MeasurementProtocol:
    subject_id: str  # Pseudonym des Probanden (in der Webapp: die Proband-ID, nicht der Name)
    movements: tuple[Movement, ...]  # Reihenfolge innerhalb eines Durchlaufs
    interval_s: float  # Abstand zwischen zwei Vorgaben
    repetitions: int  # wie oft der ganze Ablauf durchlaufen wird
    lead_in_s: float  # Vorlauf ohne Vorgabe zwischen erstem Messwert und erster Bewegung
    label: str = ""  # Name des Messplans, z. B. "Finger einzeln"; fließt in den Dateinamen ein
    # Angaben der Webapp, die nur dokumentiert, nicht ausgewertet werden (Platzierung, Notiz, ...)
    context: dict[str, Any] = field(default_factory=dict)

    @classmethod
    def from_dict(cls, raw: dict[str, Any]) -> MeasurementProtocol:
        subject_id = str(raw.get("subject_id", ""))
        if not SUBJECT_ID_PATTERN.match(subject_id):
            raise ValueError(f"Ungültige subject_id: {subject_id!r}")
        movements = tuple(m for m in map(Movement.from_raw, raw.get("movements", ())) if m)
        if not movements:
            raise ValueError("Mindestens eine Bewegung angeben.")
        interval_s = float(raw.get("interval_s", 0))
        if interval_s <= 0:
            raise ValueError(f"interval_s muss positiv sein: {interval_s}")
        repetitions = _positive_int(raw.get("repetitions", 0), "repetitions")
        lead_in_s = float(raw.get("lead_in_s", 0))
        if lead_in_s < 0:
            raise ValueError(f"lead_in_s darf nicht negativ sein: {lead_in_s}")
        label = str(raw.get("label", "")).strip()[:MAX_LABEL_LENGTH]
        context = raw.get("context") or {}
        if not isinstance(context, dict):
            raise ValueError(f"context muss ein JSON-Objekt sein: {context!r}")
        return cls(subject_id, movements, interval_s, repetitions, lead_in_s, label, context)

    def to_dict(self) -> dict[str, Any]:
        return {
            "subject_id": self.subject_id,
            "movements": [{"name": m.name, "count": m.count} for m in self.movements],
            "interval_s": self.interval_s,
            "repetitions": self.repetitions,
            "lead_in_s": self.lead_in_s,
            "label": self.label,
            "context": self.context,
        }
