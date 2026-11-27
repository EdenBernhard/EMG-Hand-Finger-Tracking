"""Eigener Ausgabekanal für die JSON-Ereignisse der Messung.

Die Webapp liest stdout Zeile für Zeile als JSON. Schreibt das SDK (.NET über pythonnet oder nativer
Code) selbst etwas nach stdout, etwa ohne Zeilenende, klebt es vor der nächsten JSON-Zeile, und das
Ereignis geht verloren (z. B. ``finished`` nach „Abbrechen“). Deshalb bekommen die Ereignisse eine
Kopie von stdout, und stdout selbst zeigt danach auf stderr: Fremde Ausgaben landen dort als Log.
"""

from __future__ import annotations

import io
import os
import sys
from typing import TextIO


def take_event_output() -> TextIO:
    """Gibt den Kanal für die Ereignisse zurück und leitet alles andere auf stdout nach stderr um.

    Muss vor dem Laden des SDK aufgerufen werden. Ohne echten Dateideskriptor (z. B. in Tests mit
    umgeleitetem ``sys.stdout``) bleibt es bei ``sys.stdout``.
    """
    try:
        stdout_fd, stderr_fd = sys.stdout.fileno(), sys.stderr.fileno()
    except (AttributeError, io.UnsupportedOperation):
        return sys.stdout
    sys.stdout.flush()
    events_fd = os.dup(stdout_fd)
    os.dup2(stderr_fd, stdout_fd)  # unter Windows setzt das auch STD_OUTPUT_HANDLE, den .NET nutzt
    sys.stdout = sys.stderr
    return open(events_fd, "w", encoding="ascii", newline="\n")
