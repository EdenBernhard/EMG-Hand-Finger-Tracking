"""Meldet den Verlauf einer Messung als JSON-Zeilen (eine Zeile pro Ereignis), z. B. an die Webapp.

Nur ASCII (Umlaute als \\u-Escapes), damit die Ausgabe unabhängig von der Codepage der Konsole ist.
"""

from __future__ import annotations

import json
import threading
from typing import Any, TextIO


class EventStream:
    def __init__(self, out: TextIO) -> None:
        self._out = out
        self._lock = threading.Lock()

    def emit(self, event_type: str, **fields: Any) -> None:
        line = json.dumps({"type": event_type, **fields}, ensure_ascii=True)
        with self._lock:
            self._out.write(line + "\n")
            self._out.flush()
