"""Bringt ``DataAvailableEventArgs.AccelerometerSamples`` in die Form ``(Sensor, Achse X/Y/Z, Zeitpunkt)``.

Das SDK liefert ein ``float[,,]`` mit einer Zeile je installiertem Sensor, Werte in g. Die Reihenfolge
der beiden anderen Dimensionen ist im SDK nicht dokumentiert; erkannt wird sie an der Achsen-Dimension
der Länge 3. Bei der ersten Messung mit echten Sensoren prüfen: Ruhe-Werte nahe 1 g auf einer Achse.
"""

from __future__ import annotations

import numpy as np

N_AXES = 3


def sensor_axis_time(accelerometer: np.ndarray, n_samples: int) -> np.ndarray:
    """Gibt die ersten ``n_samples`` Zeitpunkte als ``(Sensoren, 3, n_samples)`` zurück."""
    if accelerometer.ndim != 3:
        raise ValueError(f"AccelerometerSamples hat {accelerometer.ndim} statt 3 Dimensionen: {accelerometer.shape}")
    if accelerometer.shape[1] == N_AXES and accelerometer.shape[2] >= n_samples:
        return accelerometer[:, :, :n_samples]
    if accelerometer.shape[2] == N_AXES and accelerometer.shape[1] >= n_samples:
        return accelerometer[:, :n_samples, :].transpose(0, 2, 1)
    raise ValueError(f"AccelerometerSamples {accelerometer.shape} passt nicht zu ScanNumber {n_samples}")
