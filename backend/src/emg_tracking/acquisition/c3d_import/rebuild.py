"""Erzeugt die CSV aller C3D-Importe neu aus der mitgespeicherten Originaldatei (z. B. nach einer Formatänderung).

Aufruf im Ordner ``backend``: ``python -m emg_tracking.acquisition.c3d_import.rebuild``

Gefunden werden Importe über ``<stamm>.protocol.json`` mit ``source: "c3d"``; die C3D-Datei selbst bleibt
unverändert. Jede CSV wird erst vollständig in eine temporäre Datei geschrieben und dann ersetzt.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from emg_tracking.acquisition.c3d_import.analog_csv_writer import write_analog_csv
from emg_tracking.acquisition.c3d_import.c3d_reader import read_c3d
from emg_tracking.acquisition.c3d_import.cli import SOURCE
from emg_tracking.config import DEFAULT_CONFIG, load_config

PROTOCOL_PATTERN = "*.protocol.json"
TEMP_SUFFIX = ".tmp"


def imported_recordings(subjects_dir: Path) -> list[tuple[Path, Path]]:
    """(C3D-Original, CSV) je Import."""
    found = []
    for protocol in sorted(subjects_dir.rglob(PROTOCOL_PATTERN)):
        content = json.loads(protocol.read_text(encoding="utf-8"))
        if content.get("source") == SOURCE:
            files = content["files"]
            found.append((protocol.parent / files["original"], protocol.parent / files["raw"]))
    return found


def rebuild_csv(original: Path, csv_path: Path) -> None:
    recording = read_c3d(original)
    temp = csv_path.with_name(csv_path.name + TEMP_SUFFIX)
    with open(temp, "w", newline="", encoding="utf-8") as out:
        write_analog_csv(out, recording)
    temp.replace(csv_path)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--config", type=Path, default=DEFAULT_CONFIG)
    args = parser.parse_args(argv)
    subjects_dir = load_config(args.config).subjects_dir
    recordings = imported_recordings(subjects_dir) if subjects_dir.exists() else []
    for original, csv_path in recordings:
        rebuild_csv(original, csv_path)
        print(csv_path.relative_to(subjects_dir))
    print(f"{len(recordings)} CSV-Datei(en) neu erzeugt.", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
