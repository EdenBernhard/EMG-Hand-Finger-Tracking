"""Verarbeitet die Blöcke einer Messung: Rohdaten schreiben, fällige Vorgaben melden und protokollieren."""

from __future__ import annotations

import time
from typing import Callable

from emg_tracking.acquisition.csv_writer import RawCsvWriter
from emg_tracking.acquisition.measurement.cue_csv_writer import CueCsvWriter
from emg_tracking.acquisition.measurement.cue_schedule import CueSchedule
from emg_tracking.acquisition.measurement.event_stream import EventStream
from emg_tracking.acquisition.raw_block import RawBlock


class Measurement:
    """Wird von ``recording.record`` mit jedem echten Block aufgerufen (``handle_block``)."""

    def __init__(
        self,
        schedule: CueSchedule,
        raw_writer: RawCsvWriter,
        cue_writer: CueCsvWriter,
        events: EventStream,
        sampling_rate_hz: int,
        clock_ns: Callable[[], int] = time.time_ns,
    ) -> None:
        self.schedule = schedule
        self.n_samples = 0
        self.n_cues = 0
        self._raw_writer = raw_writer
        self._cue_writer = cue_writer
        self._events = events
        self._fs = sampling_rate_hz
        self._clock_ns = clock_ns

    @property
    def completed(self) -> bool:
        return self.schedule.is_finished(self.n_samples)

    def __call__(self, block: RawBlock) -> bool:
        if self.n_samples == 0:
            self._events.emit(
                "recording",
                first_cue_in_s=self.schedule.cues[0].sample_index / self._fs,
                total_cues=len(self.schedule.cues),
                duration_s=self.schedule.end_sample_index / self._fs,
            )
        self._raw_writer.write(block)
        self.n_samples += block.n_samples
        for cue in self.schedule.due(self.n_samples):
            self._cue_writer.write(cue, self._clock_ns())
            self.n_cues += 1
            following = self.schedule.cues[cue.index + 1] if cue.index + 1 < len(self.schedule.cues) else None
            self._events.emit(
                "cue",
                index=cue.index,
                repetition=cue.repetition,
                movement=cue.movement,
                in_row=cue.in_row,
                in_row_of=cue.in_row_of,
                sample_index=cue.sample_index,
                next_movement=following.movement if following else None,
                ends_in_s=((following.sample_index if following else self.schedule.end_sample_index) - cue.sample_index)
                / self._fs,
            )
        return not self.completed
