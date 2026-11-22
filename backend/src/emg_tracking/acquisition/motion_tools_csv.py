"""Schreibt RawBlocks als CSV im Aufbau von EMG and Motion Tools (siehe ``csv_layout``).

Eine Zeile pro Zeitpunkt, Dezimalpunkt. ``Time`` = Sample-Index / Abtastrate in s; die Zeilennummer
(ab 0) ist damit der ``sample_index`` aus ``cues.csv``. EMG in µV und Beschleunigung in g, unverändert
vom SDK; nicht aufgenommene Sensoren mit 0.
"""

from __future__ import annotations

import csv
from typing import TextIO

import numpy as np

from emg_tracking.acquisition.csv_layout import AXES, CsvLayout, acc_column, emg_column
from emg_tracking.acquisition.raw_block import RawBlock


class MotionToolsCsvWriter:
    def __init__(self, out: TextIO, layout: CsvLayout, sensor_ids: tuple[int, ...], sampling_rate_hz: float) -> None:
        layout.check_recordable(sensor_ids)
        self.sensor_ids = sensor_ids
        self._fs = sampling_rate_hz
        header = layout.header()
        index = {name: i for i, name in enumerate(header)}
        self._n_columns = len(header)
        self._emg_columns = [index[emg_column(i)] for i in sensor_ids]
        self._acc_columns = [[index[acc_column(i, axis)] for axis in AXES] for i in sensor_ids]
        self._writer = csv.writer(out, lineterminator="\n")
        self._writer.writerow(header)

    def write(self, block: RawBlock) -> None:
        if block.sensor_ids != self.sensor_ids:
            raise ValueError(f"Block-Sensoren {block.sensor_ids} passen nicht zu {self.sensor_ids}")
        rows = np.zeros((block.n_samples, self._n_columns))
        rows[:, 0] = (block.first_sample_index + np.arange(block.n_samples)) / self._fs
        rows[:, self._emg_columns] = block.samples.T
        if block.accelerometer is not None:
            for sensor, columns in enumerate(self._acc_columns):
                rows[:, columns] = block.accelerometer[sensor].T
        # repr() liefert die kürzeste exakte Darstellung, unabhängig vom Locale (wie pandas.to_csv)
        self._writer.writerows([repr(v) for v in row] for row in rows.tolist())
