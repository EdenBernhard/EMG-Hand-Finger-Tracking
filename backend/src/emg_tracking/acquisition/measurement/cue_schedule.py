"""Zeitplan der Bewegungsvorgaben, gezählt in Samples ab dem ersten echten Messwert."""

from __future__ import annotations

from dataclasses import dataclass

from emg_tracking.acquisition.measurement.protocol import MeasurementProtocol


@dataclass(frozen=True)
class Cue:
    """Ab ``sample_index`` soll ``movement`` ausgeführt werden, bis zur nächsten Vorgabe."""

    index: int  # fortlaufend ab 0 über alle Durchläufe
    repetition: int  # Durchlauf des ganzen Ablaufs, ab 1
    movement: str
    in_row: int  # die wievielte direkte Wiederholung dieser Bewegung, 1 .. in_row_of
    in_row_of: int  # Anzahl der Bewegung laut Messplan (z. B. Pinch 3×)
    sample_index: int


class CueSchedule:
    """Vorgabe k liegt bei ``Vorlauf + k · Intervall``; die Messung endet ein Intervall nach der letzten.

    Reihenfolge: je Durchlauf alle Bewegungen der Liste, jede so oft direkt hintereinander wie ihre
    Anzahl. Rundung auf ganze Samples: Bei 2000 Hz ist der Fehler höchstens 0,25 ms je Vorgabe und
    summiert sich nicht, weil jede Vorgabe direkt aus Vorlauf und Intervall berechnet wird.
    """

    def __init__(self, protocol: MeasurementProtocol, sampling_rate_hz: int) -> None:
        interval = protocol.interval_s * sampling_rate_hz
        lead_in = protocol.lead_in_s * sampling_rate_hz
        order = [
            (r + 1, m.name, i + 1, m.count)
            for r in range(protocol.repetitions)
            for m in protocol.movements
            for i in range(m.count)
        ]
        self.cues = tuple(
            Cue(k, repetition, name, in_row, in_row_of, round(lead_in + k * interval))
            for k, (repetition, name, in_row, in_row_of) in enumerate(order)
        )
        self.end_sample_index = round(lead_in + len(order) * interval)
        self._next = 0

    def due(self, samples_received: int) -> list[Cue]:
        """Vorgaben, deren Sample inzwischen empfangen wurde und die noch nicht gemeldet sind."""
        start = self._next
        while self._next < len(self.cues) and self.cues[self._next].sample_index < samples_received:
            self._next += 1
        return list(self.cues[start : self._next])

    def is_finished(self, samples_received: int) -> bool:
        return samples_received >= self.end_sample_index
