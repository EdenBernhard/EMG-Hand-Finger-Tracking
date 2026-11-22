"""Schreibt die Bewegungsvorgaben einer Messung als CSV (eine Zeile pro Vorgabe).

``sample_index`` ist der geplante Beginn auf der Zeitachse der Rohdaten-CSV. Die Bewegung gilt bis
zur nächsten Zeile bzw. bis ``end_sample_index`` aus der ``.protocol.json``.
``emitted_host_time_ns`` ist der Zeitpunkt (time.time_ns), zu dem die Vorgabe an die Webapp ging;
der Piepton kommt etwas später (Event-Periode + Übertragung), die Reaktion des Probanden noch später.
``in_row``/``in_row_of``: die wievielte direkte Wiederholung einer Bewegung (z. B. 2 von 3 bei Pinch 3×).
"""

from __future__ import annotations

import csv
from typing import TextIO

from emg_tracking.acquisition.measurement.cue_schedule import Cue

HEADER = ["cue_index", "repetition", "movement", "in_row", "in_row_of", "sample_index", "emitted_host_time_ns"]


class CueCsvWriter:
    def __init__(self, out: TextIO) -> None:
        self._out = out
        self._writer = csv.writer(out, lineterminator="\n")
        self._writer.writerow(HEADER)

    def write(self, cue: Cue, emitted_host_time_ns: int) -> None:
        self._writer.writerow([
            cue.index, cue.repetition, cue.movement, cue.in_row, cue.in_row_of, cue.sample_index, emitted_host_time_ns,
        ])
        self._out.flush()  # wenige Zeilen; bei einem Absturz sollen die Labels nicht fehlen
