"""Schreibt eine AnalogRecording als CSV wie das frühere Skript Converter/convertC3D.py.

``Time`` (Sample-Index / Abtastrate in s), danach die Kanäle in der Reihenfolge der C3D-Datei mit ihren
Namen (bei EMG and Motion Tools ``Emg_<n>``, ``Acc_<n> :X`` …). Das ist derselbe Aufbau wie bei eigenen
Messungen (``emg_tracking.acquisition.csv_layout``), damit beide ohne Anpassung ins Notebook passen.
"""

from __future__ import annotations

import csv
from typing import TextIO

from emg_tracking.acquisition.c3d_import.analog_recording import AnalogRecording
from emg_tracking.acquisition.csv_layout import TIME_COLUMN


def header(recording: AnalogRecording) -> list[str]:
    return [TIME_COLUMN, *recording.labels]


def write_analog_csv(out: TextIO, recording: AnalogRecording) -> None:
    writer = csv.writer(out, lineterminator="\n")
    writer.writerow(header(recording))
    for index, values in enumerate(recording.samples.T):
        # repr() auf float liefert die kürzeste exakte Darstellung, unabhängig vom Locale (wie pandas.to_csv)
        writer.writerow([repr(index / recording.sampling_rate_hz), *map(repr, values.tolist())])
