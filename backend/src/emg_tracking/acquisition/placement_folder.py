"""Unterordner eines Probanden je Elektroden-Platzierung, z. B. ``a-nah-am-ellenbogen_eedaaa2f``.

Die Platzierungs-ID am Ende hält die Zuordnung stabil: Wird eine Platzierung in der Webapp
umbenannt, landen neue Aufnahmen weiter im bereits vorhandenen Ordner mit dieser ID.
"""

from __future__ import annotations

import re
from pathlib import Path
from typing import Any

from emg_tracking.acquisition.measurement.recording_name import recording_name

NO_PLACEMENT = "ohne_platzierung"
PLACEMENT_ID_PATTERN = re.compile(r"^[a-f0-9]{8}$")  # wie neueId() in frontend/public/js/modell/platzierungen.js
SEPARATOR = "_"


def placement_folder(subject_dir: Path, placement: dict[str, Any] | None) -> Path:
    """``placement`` ist der Kontext der Webapp: ``{"id", "name", "variante", ...}`` oder None."""
    placement_id = str((placement or {}).get("id", ""))
    if not PLACEMENT_ID_PATTERN.match(placement_id):
        return subject_dir / NO_PLACEMENT
    existing = sorted(p for p in subject_dir.glob(f"*{SEPARATOR}{placement_id}") if p.is_dir())
    if existing:
        return existing[0]
    name = str(placement.get("name") or placement.get("variante") or "")
    return subject_dir / f"{recording_name(name)}{SEPARATOR}{placement_id}"
