"""Macht aus dem Namen eines Messplans einen sicheren Teil des Dateinamens (z. B. "Pinch 3×" -> "pinch-3")."""

from __future__ import annotations

import re
import unicodedata

FALLBACK = "messung"
MAX_LENGTH = 40
UMLAUTS = str.maketrans({"ä": "ae", "ö": "oe", "ü": "ue", "ß": "ss"})


def recording_name(label: str) -> str:
    text = unicodedata.normalize("NFKD", label.lower().translate(UMLAUTS))
    text = text.encode("ascii", "ignore").decode("ascii")
    slug = re.sub(r"[^a-z0-9]+", "-", text).strip("-")[:MAX_LENGTH].strip("-")
    return slug or FALLBACK
