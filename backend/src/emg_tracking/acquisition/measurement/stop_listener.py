"""Wartet in einem Hintergrund-Thread auf den Stopp-Befehl der Webapp.

Jede Zeile ist JSON, z. B. ``{"command": "stop"}``. Endet der Eingabestrom (die Webapp bzw. ihr
Server wurde beendet), wird ebenfalls gestoppt, damit keine Messung verwaist weiterläuft.
"""

from __future__ import annotations

import json
import threading
from typing import BinaryIO

STOP_COMMAND = "stop"


def _is_stop(line: bytes) -> bool:
    try:
        return json.loads(line.decode("utf-8")).get("command") == STOP_COMMAND
    except (ValueError, AttributeError):
        return False


def listen_for_stop(stream: BinaryIO, stop_requested: threading.Event) -> threading.Thread:
    def run() -> None:
        for line in stream:
            if _is_stop(line):
                break
        stop_requested.set()

    thread = threading.Thread(target=run, name="stop-listener", daemon=True)
    thread.start()
    return thread
