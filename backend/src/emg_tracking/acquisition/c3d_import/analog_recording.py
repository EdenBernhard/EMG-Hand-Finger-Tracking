"""Analogkanäle einer C3D-Datei: Kanalnamen, Einheiten, Abtastrate und Messwerte."""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np

FALLBACK_LABEL = "channel_{}"  # 1-basiert, für leere oder doppelte Kanalnamen


@dataclass(frozen=True)
class AnalogRecording:
    labels: tuple[str, ...]
    units: tuple[str, ...]
    sampling_rate_hz: float
    samples: np.ndarray  # Form (Kanäle, Zeitpunkte), Werte wie in der Datei skaliert

    def __post_init__(self) -> None:
        if self.samples.ndim != 2 or self.samples.shape[0] != len(self.labels):
            raise ValueError(f"{len(self.labels)} Kanalnamen passen nicht zu Messwerten der Form {self.samples.shape}")
        if len(self.units) != len(self.labels):
            raise ValueError("Anzahl Einheiten und Kanalnamen unterscheiden sich")
        if self.sampling_rate_hz <= 0:
            raise ValueError(f"Abtastrate muss positiv sein: {self.sampling_rate_hz}")

    @property
    def n_samples(self) -> int:
        return self.samples.shape[1]

    @property
    def duration_s(self) -> float:
        return self.n_samples / self.sampling_rate_hz


def unique_labels(raw: list[str] | tuple[str, ...], n_channels: int) -> tuple[str, ...]:
    """Bereinigt Kanalnamen, damit sie als CSV-Spalten taugen (leer oder doppelt -> channel_<n>)."""
    labels: list[str] = []
    for i in range(n_channels):
        label = str(raw[i]).strip() if i < len(raw) else ""
        labels.append(label if label and label not in labels else FALLBACK_LABEL.format(i + 1))
    return tuple(labels)
