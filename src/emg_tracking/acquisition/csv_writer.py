"""Schreibt RawBlocks unverändert als CSV (eine Zeile pro Zeitpunkt, Dezimalpunkt)."""

from __future__ import annotations

import csv
from typing import TextIO

from emg_tracking.acquisition.raw_block import RawBlock


class RawCsvWriter:
    """Werte je Event (host_time_ns, usb_lost_packets) stehen in jeder Zeile des Events.

    Das bläht die Datei etwas auf, hält sie aber zu einer einzigen, einfach lesbaren Tabelle.
    """

    def __init__(self, out: TextIO, sensor_ids: tuple[int, ...]) -> None:
        self.sensor_ids = sensor_ids
        self._writer = csv.writer(out, lineterminator="\n")
        self._writer.writerow(self.header(sensor_ids))

    @staticmethod
    def header(sensor_ids: tuple[int, ...]) -> list[str]:
        return ["sample_index", "host_time_ns"] + [f"sensor_{i}_uV" for i in sensor_ids] + ["usb_lost_packets"]

    def write(self, block: RawBlock) -> None:
        if block.sensor_ids != self.sensor_ids:
            raise ValueError(f"Block-Sensoren {block.sensor_ids} passen nicht zu {self.sensor_ids}")
        for t, values in enumerate(block.samples.T):
            # str() auf float32 liefert die kürzeste exakte Darstellung, unabhängig vom Locale
            self._writer.writerow(
                [block.first_sample_index + t, block.host_time_ns]
                + [str(v) for v in values]
                + [block.usb_lost_packets]
            )
