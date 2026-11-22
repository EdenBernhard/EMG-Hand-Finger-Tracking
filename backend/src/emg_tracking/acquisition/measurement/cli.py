"""Messung mit Bewegungsvorgaben, gesteuert über stdin/stdout (so startet sie die Webapp).

Aufruf im Ordner ``backend``: ``python -m emg_tracking.acquisition.measurement.cli``

- stdin, erste Zeile: Messplan als JSON (siehe ``MeasurementProtocol``), z. B.
  ``{"subject_id": "P01", "movements": ["Faust", {"name": "Pinch", "count": 3}], "interval_s": 5,
  "repetitions": 3, "lead_in_s": 3, "label": "Finger einzeln", "context": {"notiz": "..."}}``
  (``count``: so oft direkt hintereinander, Standard 1; ``label`` und ``context`` sind optional)
- stdin, danach: ``{"command": "stop"}`` beendet die Messung vorzeitig (ebenso das Ende von stdin).
- stdout: ein JSON-Objekt pro Zeile mit ``type`` = ``waiting_for_sensors``, ``recording``, ``cue``,
  ``finished`` oder ``error``. Menschenlesbare Meldungen gehen nach stderr.

Dateien in ``data/raw/<subject_id>/``, Stamm ``<zeit>_<label als Dateiname>``: ``<stamm>.csv`` (Rohdaten), ``<stamm>.cues.csv`` (Vorgaben),
``<stamm>.protocol.json`` (Messplan und Ablauf) und ``<stamm>.config.toml`` (Kopie der Konfiguration).
"""

from __future__ import annotations

import argparse
import json
import sys
import threading
from datetime import datetime
from pathlib import Path

from emg_tracking.acquisition.csv_writer import RawCsvWriter
from emg_tracking.acquisition.measurement.cue_csv_writer import CueCsvWriter
from emg_tracking.acquisition.measurement.cue_schedule import CueSchedule
from emg_tracking.acquisition.measurement.event_stream import EventStream
from emg_tracking.acquisition.measurement.measurement import Measurement
from emg_tracking.acquisition.measurement.protocol import MeasurementProtocol
from emg_tracking.acquisition.measurement.recording_name import recording_name
from emg_tracking.acquisition.measurement.stop_listener import listen_for_stop
from emg_tracking.acquisition.receiver import SAMPLING_RATE_HZ, CometaReceiver
from emg_tracking.acquisition.recording import record
from emg_tracking.acquisition.recording_files import RecordingFiles
from emg_tracking.acquisition.sdk_loader import load_sdk
from emg_tracking.config import DEFAULT_CONFIG, AcquisitionConfig, load_config

def _write_protocol_json(
    files: RecordingFiles, protocol: MeasurementProtocol, cfg: AcquisitionConfig, sdk_version: str,
    started_at: datetime, measurement: Measurement, stopped_early: bool,
) -> None:
    content = {
        **protocol.to_dict(),
        "started_at": started_at.isoformat(timespec="seconds"),
        "sampling_rate_hz": SAMPLING_RATE_HZ,
        "sensor_ids": list(cfg.sensor_ids),
        "sdk": f"Waveplus.DaqSys {sdk_version}",
        "n_samples": measurement.n_samples,
        "n_cues": measurement.n_cues,
        "end_sample_index": measurement.schedule.end_sample_index,
        "completed": measurement.completed,
        "stopped_early": stopped_early,
        "files": {"raw": files.raw_csv.name, "cues": files.cues_csv.name, "config": files.config_copy.name},
    }
    files.protocol_json.write_text(json.dumps(content, ensure_ascii=False, indent=2), encoding="utf-8")


def run(protocol: MeasurementProtocol, cfg: AcquisitionConfig, events: EventStream, stop: threading.Event) -> None:
    sdk = load_sdk(cfg.sdk_dir)
    started_at = datetime.now()
    files = RecordingFiles.create(cfg.data_dir / protocol.subject_id, recording_name(protocol.label), started_at)
    receiver = CometaReceiver(
        sdk, cfg.sensor_ids, cfg.event_period_ms, cfg.accelerometer_full_scale, cfg.device_ready_timeout_s
    )
    try:
        files.copy_config(cfg.source_file)
        with open(files.raw_csv, "w", newline="", encoding="utf-8") as raw, \
                open(files.cues_csv, "w", newline="", encoding="utf-8") as cues:
            measurement = Measurement(
                CueSchedule(protocol, SAMPLING_RATE_HZ), RawCsvWriter(raw, cfg.sensor_ids), CueCsvWriter(cues),
                events, SAMPLING_RATE_HZ,
            )
            print(f"Warte, bis die Sensoren senden (höchstens {cfg.startup_timeout_s:g} s) ...", file=sys.stderr)
            events.emit("waiting_for_sensors", timeout_s=cfg.startup_timeout_s)
            record(receiver, measurement, cfg.startup_timeout_s, stop)
    except BaseException:
        files.discard_if_empty()
        raise

    saved = not files.discard_if_empty()
    if saved:
        _write_protocol_json(files, protocol, cfg, sdk.version, started_at, measurement, stop.is_set())
    events.emit(
        "finished",
        saved=saved,
        recording=files.stem if saved else None,
        samples=measurement.n_samples,
        duration_s=measurement.n_samples / SAMPLING_RATE_HZ,
        cues=measurement.n_cues,
        completed=measurement.completed,
    )


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--config", type=Path, default=DEFAULT_CONFIG)
    args = parser.parse_args(argv)

    events = EventStream(sys.stdout)
    # Ungepuffert und als Bytes: Ein gepufferter Reader würde den Stopp-Befehl mit der ersten Zeile
    # vorauslesen, und sein Lock bringt Python beim Beenden zum Absturz, solange der Stopp-Thread
    # noch liest. UTF-8 wird selbst decodiert, sonst gälte die Codepage der Konsole.
    stdin = open(sys.stdin.fileno(), "rb", buffering=0, closefd=False)
    try:
        protocol = MeasurementProtocol.from_dict(json.loads(stdin.readline().decode("utf-8")))
        stop = threading.Event()
        listen_for_stop(stdin, stop)
        run(protocol, load_config(args.config), events, stop)
    except Exception as exc:
        print(f"Fehler: {exc}", file=sys.stderr)
        events.emit("error", message=str(exc))
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
