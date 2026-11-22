"""Laden der versionierten Erfassungs-Konfiguration."""

from __future__ import annotations

import tomllib
from dataclasses import dataclass
from pathlib import Path

from emg_tracking.acquisition.csv_layout import CsvLayout

# backend/src/emg_tracking/config.py -> backend/
BACKEND_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_CONFIG = BACKEND_ROOT / "config" / "acquisition.toml"


@dataclass(frozen=True)
class AcquisitionConfig:
    sdk_dir: Path
    device_ready_timeout_s: float
    sensor_ids: tuple[int, ...]
    event_period_ms: int
    startup_timeout_s: float
    accelerometer_full_scale: str
    check_impedance: bool
    csv_layout: CsvLayout
    data_dir: Path
    subjects_dir: Path
    source_file: Path


def load_config(path: Path = DEFAULT_CONFIG) -> AcquisitionConfig:
    with open(path, "rb") as f:
        raw = tomllib.load(f)

    sensor_ids = tuple(raw["capture"]["sensor_ids"])
    if not sensor_ids or any(i < 1 for i in sensor_ids):
        raise ValueError(f"sensor_ids müssen 1-basiert und nicht leer sein: {sensor_ids}")
    csv_layout = CsvLayout(tuple(raw["csv"]["emg_sensors"]), int(raw["csv"]["n_sensors"]))
    csv_layout.check_recordable(sensor_ids)

    return AcquisitionConfig(
        sdk_dir=BACKEND_ROOT / raw["sdk"]["dir"],
        device_ready_timeout_s=float(raw["sdk"]["device_ready_timeout_s"]),
        sensor_ids=sensor_ids,
        event_period_ms=raw["capture"]["event_period_ms"],
        startup_timeout_s=float(raw["capture"]["startup_timeout_s"]),
        accelerometer_full_scale=raw["capture"]["accelerometer_full_scale"],
        # fehlt der Abschnitt (ältere Konfiguration), wird nicht geprüft
        csv_layout=csv_layout,
        check_impedance=bool(raw.get("impedance", {}).get("check_before_measurement", False)),
        data_dir=BACKEND_ROOT / raw["output"]["data_dir"],
        subjects_dir=BACKEND_ROOT / raw["output"]["subjects_dir"],
        source_file=Path(path),
    )
