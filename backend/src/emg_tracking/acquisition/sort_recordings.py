"""Sortiert ältere Aufnahmen, die noch direkt im Ordner eines Probanden liegen, in die Platzierungs-Ordner.

Aufruf im Ordner ``backend``: ``python -m emg_tracking.acquisition.sort_recordings [--dry-run]``

Die Platzierung steht in ``<stamm>.protocol.json`` unter ``context.platzierung``. Verschoben werden alle
Dateien ``<stamm>.*`` (CSV, Vorgaben, Konfiguration, C3D-Original). Aufnahmen ohne protocol.json bleiben
liegen; vorhandene Dateien am Ziel werden nie überschrieben.
"""

from __future__ import annotations

import argparse
import json
import sys
from dataclasses import dataclass
from pathlib import Path

from emg_tracking.acquisition.placement_folder import placement_folder
from emg_tracking.config import DEFAULT_CONFIG, load_config

PROTOCOL_SUFFIX = ".protocol.json"


@dataclass(frozen=True)
class Move:
    source: Path
    target: Path


def planned_moves(subject_dir: Path) -> list[Move]:
    moves: list[Move] = []
    for protocol in sorted(subject_dir.glob(f"*{PROTOCOL_SUFFIX}")):
        stem = protocol.name[: -len(PROTOCOL_SUFFIX)]
        context = json.loads(protocol.read_text(encoding="utf-8")).get("context") or {}
        folder = placement_folder(subject_dir, context.get("platzierung"))
        for source in sorted(p for p in subject_dir.iterdir() if p.is_file() and p.name.startswith(f"{stem}.")):
            moves.append(Move(source, folder / source.name))
    return moves


def apply(moves: list[Move]) -> None:
    clashes = [m.target for m in moves if m.target.exists()]
    if clashes:  # vor dem ersten Verschieben prüfen: entweder alles oder nichts
        raise FileExistsError(f"Ziel existiert bereits, nichts verschoben: {', '.join(map(str, clashes))}")
    for move in moves:
        move.target.parent.mkdir(exist_ok=True)
        move.source.rename(move.target)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--dry-run", action="store_true", help="nur anzeigen, was verschoben würde")
    parser.add_argument("--config", type=Path, default=DEFAULT_CONFIG)
    args = parser.parse_args(argv)

    subjects_dir = load_config(args.config).subjects_dir
    subject_dirs = sorted(p for p in subjects_dir.iterdir() if p.is_dir()) if subjects_dir.exists() else []
    moves = [m for d in subject_dirs for m in planned_moves(d)]
    for m in moves:
        print(f"{m.source.relative_to(subjects_dir)} -> {m.target.relative_to(subjects_dir)}")
    if not args.dry_run:
        apply(moves)
    print(f"{len(moves)} Datei(en) {'würden verschoben' if args.dry_run else 'verschoben'}.", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
