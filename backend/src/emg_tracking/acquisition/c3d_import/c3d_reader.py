"""Liest die Analogkanäle (EMG) einer C3D-Datei mit ezc3d.

ezc3d ist optional (``pip install -e .[c3d]``) und wird erst beim Lesen importiert, damit die
übrige Erfassung ohne das Paket läuft. Die Abtastrate kommt aus ANALOG:RATE der Datei; ezc3d
wendet SCALE, OFFSET und GEN_SCALE bereits an.
"""

from __future__ import annotations

from pathlib import Path

import numpy as np

from emg_tracking.acquisition.c3d_import.analog_recording import AnalogRecording, unique_labels


def read_c3d(path: Path) -> AnalogRecording:
    try:
        import ezc3d
    except ImportError as exc:
        raise RuntimeError("Für den C3D-Import fehlt das Paket ezc3d (im Ordner backend: pip install -e .[c3d])") from exc

    c3d = ezc3d.c3d(str(path))
    analog = c3d["parameters"]["ANALOG"]
    samples = np.asarray(c3d["data"]["analogs"][0], dtype=np.float64)
    if samples.size == 0:
        raise ValueError("Die C3D-Datei enthält keine Analogkanäle (EMG).")

    n_channels = samples.shape[0]
    units = list(analog.get("UNITS", {}).get("value", []))
    return AnalogRecording(
        labels=unique_labels(list(analog["LABELS"]["value"]), n_channels),
        units=tuple(str(units[i]).strip() if i < len(units) else "" for i in range(n_channels)),
        sampling_rate_hz=float(analog["RATE"]["value"][0]),
        samples=samples,
    )
