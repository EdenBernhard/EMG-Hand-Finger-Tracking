"""Laden der versionierten Erfassungs-Konfiguration."""

from __future__ import annotations

import tomllib
from dataclasses import dataclass
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_CONFIG = REPO_ROOT / "config" / "acquisition.toml"


@dataclass(frozen=True)
class AcquisitionConfig:
    sensor_ids: tuple[int, ...]
    event_period_ms: int
    data_dir: Path
    source_file: Path


def load_config(path: Path = DEFAULT_CONFIG) -> AcquisitionConfig:
    with open(path, "rb") as f:
        raw = tomllib.load(f)

    sensor_ids = tuple(raw["capture"]["sensor_ids"])
    if not sensor_ids or any(i < 1 for i in sensor_ids):
        raise ValueError(f"sensor_ids müssen 1-basiert und nicht leer sein: {sensor_ids}")

    return AcquisitionConfig(
        sensor_ids=sensor_ids,
        event_period_ms=raw["capture"]["event_period_ms"],
        data_dir=REPO_ROOT / raw["output"]["data_dir"],
        source_file=Path(path),
    )
