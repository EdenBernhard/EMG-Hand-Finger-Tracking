"""Schreibt je SDK-Event (RawBlock) eine Zeile mit den Angaben, die nicht in die Rohdaten-CSV passen.

Die Rohdaten-CSV hat den Aufbau von EMG and Motion Tools und damit keinen Platz für die PC-Zeit und
die vom SDK gemeldeten USB-Paketverluste. Beides ist für die Datenqualität wichtig und steht hier.
"""

from __future__ import annotations

import csv
from typing import TextIO

from emg_tracking.acquisition.raw_block import RawBlock

HEADER = ["first_sample_index", "n_samples", "host_time_ns", "usb_lost_packets"]


class BlockEventCsvWriter:
    def __init__(self, out: TextIO) -> None:
        self._writer = csv.writer(out, lineterminator="\n")
        self._writer.writerow(HEADER)

    def write(self, block: RawBlock) -> None:
        self._writer.writerow([block.first_sample_index, block.n_samples, block.host_time_ns, block.usb_lost_packets])
