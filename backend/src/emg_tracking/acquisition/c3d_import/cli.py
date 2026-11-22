"""Importiert eine C3D-Datei aus EMG and Motion Tools als Aufnahme eines Probanden (so ruft es die Webapp auf).

Aufruf im Ordner ``backend``:
``python -m emg_tracking.acquisition.c3d_import.cli --subject <id> [--name Original.c3d] [--context JSON] <datei.c3d>``

Dateien in ``data/probanden/<subject>/<platzierung>_<platzierungs-id>/`` (``subjects_dir`` der Konfiguration;
ohne Platzierung im Kontext: ``ohne_platzierung/``), Stamm ``<zeit>_<Originalname als Dateiname>``:
``<stamm>.csv`` (``Time`` und die Analogkanäle wie beim früheren Converter/convertC3D.py), ``<stamm>.c3d`` (unveränderte
Originaldatei) und ``<stamm>.protocol.json`` (Herkunft, Kanäle, Einheiten, Abtastrate, Kontext der Webapp).

stdout: genau eine JSON-Zeile mit ``type`` = ``finished`` oder ``error``. Meldungen gehen nach stderr.
"""

from __future__ import annotations

import argparse
import json
import shutil
import sys
from datetime import datetime
from pathlib import Path
from typing import Any

from emg_tracking.acquisition.c3d_import.analog_csv_writer import write_analog_csv
from emg_tracking.acquisition.c3d_import.analog_recording import AnalogRecording
from emg_tracking.acquisition.c3d_import.c3d_reader import read_c3d
from emg_tracking.acquisition.measurement.event_stream import EventStream
from emg_tracking.acquisition.measurement.protocol import SUBJECT_ID_PATTERN
from emg_tracking.acquisition.measurement.recording_name import recording_name
from emg_tracking.acquisition.placement_folder import placement_folder
from emg_tracking.acquisition.recording_files import RecordingFiles
from emg_tracking.config import DEFAULT_CONFIG, load_config

SOURCE = "c3d"
C3D_SUFFIX = ".c3d"


def _write_protocol_json(
    path: Path, subject_id: str, original_name: str, imported_at: datetime, recording: AnalogRecording,
    files: dict[str, str], context: dict[str, Any],
) -> None:
    content = {
        "subject_id": subject_id,
        "source": SOURCE,
        "original_file": original_name,
        "imported_at": imported_at.isoformat(timespec="seconds"),
        "sampling_rate_hz": recording.sampling_rate_hz,
        "channels": [{"label": label, "unit": unit} for label, unit in zip(recording.labels, recording.units)],
        "n_samples": recording.n_samples,
        "duration_s": recording.duration_s,
        "context": context,
        "files": files,
    }
    path.write_text(json.dumps(content, ensure_ascii=False, indent=2), encoding="utf-8")


def import_c3d(
    source: Path, subject_id: str, original_name: str, context: dict[str, Any], subjects_dir: Path,
    now: datetime | None = None,
) -> tuple[RecordingFiles, AnalogRecording]:
    if not SUBJECT_ID_PATTERN.match(subject_id):
        raise ValueError(f"Ungültige subject_id: {subject_id!r}")
    if Path(original_name).suffix.lower() != C3D_SUFFIX:
        raise ValueError(f"Keine C3D-Datei: {original_name!r}")

    recording = read_c3d(source)  # vor dem Anlegen von Dateien: eine kaputte Datei hinterlässt nichts
    imported_at = now or datetime.now()
    folder = placement_folder(subjects_dir / subject_id, context.get("platzierung"))
    files = RecordingFiles.create(folder, recording_name(Path(original_name).stem), imported_at)
    original_copy = files.directory / f"{files.stem}{C3D_SUFFIX}"
    written = (files.raw_csv, original_copy, files.protocol_json)
    if any(p.exists() for p in written):
        raise FileExistsError(f"Aufnahme {files.stem} existiert bereits; bitte kurz warten und erneut importieren.")

    try:
        with open(files.raw_csv, "w", newline="", encoding="utf-8") as out:
            write_analog_csv(out, recording)
        shutil.copyfile(source, original_copy)
        _write_protocol_json(
            files.protocol_json, subject_id, original_name, imported_at, recording,
            {"raw": files.raw_csv.name, "original": original_copy.name}, context,
        )
    except BaseException:
        for path in written:
            path.unlink(missing_ok=True)
        raise
    return files, recording


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("source", type=Path, help="C3D-Datei")
    parser.add_argument("--subject", required=True, help="Proband-ID (Ordner unter subjects_dir)")
    parser.add_argument("--name", help="Originaler Dateiname, falls source eine temporäre Kopie ist")
    parser.add_argument("--context", default="{}", help="JSON mit Angaben der Webapp (Platzierung, Notiz)")
    parser.add_argument("--config", type=Path, default=DEFAULT_CONFIG)
    args = parser.parse_args(argv)

    events = EventStream(sys.stdout)
    try:
        context = json.loads(args.context)
        if not isinstance(context, dict):
            raise ValueError("--context muss ein JSON-Objekt sein")
        files, recording = import_c3d(
            args.source, args.subject, args.name or args.source.name, context, load_config(args.config).subjects_dir
        )
    except Exception as exc:
        print(f"Fehler: {exc}", file=sys.stderr)
        events.emit("error", message=str(exc))
        return 1

    print(f"Gespeichert: {files.raw_csv}", file=sys.stderr)
    events.emit(
        "finished",
        recording=files.stem,
        samples=recording.n_samples,
        duration_s=recording.duration_s,
        sampling_rate_hz=recording.sampling_rate_hz,
        channels=list(recording.labels),
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
