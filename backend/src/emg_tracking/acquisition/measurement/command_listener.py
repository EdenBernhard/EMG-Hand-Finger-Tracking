"""Wartet in einem Hintergrund-Thread auf Befehle der Webapp.

Jede Zeile ist JSON: ``{"command": "stop"}`` beendet die Messung, ``{"command": "continue"}``
setzt sie nach einem nicht bestandenen Impedanz-Check trotzdem fort. Endet der Eingabestrom (die
Webapp bzw. ihr Server wurde beendet), wird ebenfalls gestoppt, damit keine Messung verwaist weiterläuft.
"""

from __future__ import annotations

import json
import threading
from typing import BinaryIO

STOP_COMMAND = "stop"
CONTINUE_COMMAND = "continue"


def _command(line: bytes) -> str | None:
    try:
        return json.loads(line.decode("utf-8")).get("command")
    except (ValueError, AttributeError):
        return None


def listen_for_commands(
    stream: BinaryIO, stop_requested: threading.Event, continue_requested: threading.Event | None = None,
) -> threading.Thread:
    def run() -> None:
        for line in stream:
            command = _command(line)
            if command == STOP_COMMAND:
                break
            if command == CONTINUE_COMMAND and continue_requested is not None:
                continue_requested.set()
        stop_requested.set()

    thread = threading.Thread(target=run, name="command-listener", daemon=True)
    thread.start()
    return thread
