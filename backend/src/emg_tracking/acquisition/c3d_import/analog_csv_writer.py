"""Schreibt eine AnalogRecording als CSV: eine Zeile pro Zeitpunkt, Dezimalpunkt, Kanalnamen als Spalten."""

from __future__ import annotations

import csv
from typing import TextIO

from emg_tracking.acquisition.c3d_import.analog_recording import AnalogRecording


def header(recording: AnalogRecording) -> list[str]:
    return ["sample_index", "time_s", *recording.labels]


def write_analog_csv(out: TextIO, recording: AnalogRecording) -> None:
    writer = csv.writer(out, lineterminator="\n")
    writer.writerow(header(recording))
    for index, values in enumerate(recording.samples.T):
        # repr() auf float liefert die kürzeste exakte Darstellung, unabhängig vom Locale
        writer.writerow([index, repr(index / recording.sampling_rate_hz), *map(repr, values.tolist())])
