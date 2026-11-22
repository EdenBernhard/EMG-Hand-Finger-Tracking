"""Dateinamen einer Aufnahme und Aufräumen, falls keine Messwerte zustande kamen."""

from __future__ import annotations

import shutil
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path

TIMESTAMP_FORMAT = "%Y-%m-%d_%H-%M-%S"


@dataclass(frozen=True)
class RecordingFiles:
    """Alle Dateien einer Aufnahme teilen sich den Namensstamm ``<zeit>_<name>``."""

    directory: Path
    stem: str

    @classmethod
    def create(cls, directory: Path, name: str, now: datetime | None = None) -> RecordingFiles:
        directory.mkdir(parents=True, exist_ok=True)
        return cls(directory, f"{(now or datetime.now()):{TIMESTAMP_FORMAT}}_{name}")

    @property
    def raw_csv(self) -> Path:
        return self.directory / f"{self.stem}.csv"

    @property
    def config_copy(self) -> Path:
        return self.directory / f"{self.stem}.config.toml"

    @property
    def events_csv(self) -> Path:
        return self.directory / f"{self.stem}.events.csv"

    @property
    def cues_csv(self) -> Path:
        return self.directory / f"{self.stem}.cues.csv"

    @property
    def protocol_json(self) -> Path:
        return self.directory / f"{self.stem}.protocol.json"

    def all(self) -> tuple[Path, ...]:
        return (self.raw_csv, self.events_csv, self.config_copy, self.cues_csv, self.protocol_json)

    def copy_config(self, source: Path) -> None:
        shutil.copyfile(source, self.config_copy)

    def n_raw_rows(self) -> int:
        """Anzahl Datenzeilen (ohne Kopfzeile) der Rohdaten; 0, wenn die Datei fehlt."""
        if not self.raw_csv.exists():
            return 0
        with open(self.raw_csv, encoding="utf-8") as f:
            return max(sum(1 for _ in f) - 1, 0)

    def discard_if_empty(self) -> bool:
        """Keine halbleeren Aufnahmen im Datenordner lassen. Gibt zurück, ob gelöscht wurde."""
        if self.n_raw_rows() > 0:
            return False
        for path in self.all():
            path.unlink(missing_ok=True)
        try:
            self.directory.rmdir()  # nur wenn leer, z. B. der Ordner eines Probanden nach einem Fehlstart
        except OSError:
            pass
        return True
