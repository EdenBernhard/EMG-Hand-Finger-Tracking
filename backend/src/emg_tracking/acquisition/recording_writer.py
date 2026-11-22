"""Schreibt jeden Block einer Aufnahme in beide Dateien: Rohdaten (Aufbau EMG and Motion Tools) und Events."""

from __future__ import annotations

from emg_tracking.acquisition.block_events_csv import BlockEventCsvWriter
from emg_tracking.acquisition.motion_tools_csv import MotionToolsCsvWriter
from emg_tracking.acquisition.raw_block import RawBlock


class RecordingWriter:
    def __init__(self, raw: MotionToolsCsvWriter, events: BlockEventCsvWriter) -> None:
        self._raw = raw
        self._events = events

    def write(self, block: RawBlock) -> None:
        self._raw.write(block)
        self._events.write(block)
