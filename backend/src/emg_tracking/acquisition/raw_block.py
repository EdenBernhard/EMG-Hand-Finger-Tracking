"""Datenstruktur, die die Erfassung an die nächste Pipeline-Stufe übergibt."""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np


@dataclass(frozen=True)
class RawBlock:
    """Ein DataAvailable-Event: ``samples[i]`` ist die Zeitreihe von ``sensor_ids[i]`` in µV."""

    first_sample_index: int  # fortlaufender Sample-Zähler seit Start (Zeit = Index / fs)
    host_time_ns: int  # time.time_ns() beim Eintreffen des Events
    sensor_ids: tuple[int, ...]
    samples: np.ndarray  # float32, Form (len(sensor_ids), n_samples), eigene Kopie
    usb_lost_packets: int  # so, wie das SDK es für dieses Event meldet (nicht interpretiert)

    @property
    def n_samples(self) -> int:
        return self.samples.shape[1]
