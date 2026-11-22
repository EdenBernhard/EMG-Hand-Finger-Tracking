"""Kommandozeile: Rohdaten empfangen und unverändert als CSV (Aufbau wie EMG and Motion Tools) speichern.

Aufruf im Ordner ``backend``: ``python -m emg_tracking.acquisition.cli --duration 10``
(Strg+C beendet die Aufnahme ebenfalls).
"""

from __future__ import annotations

import argparse
from pathlib import Path

from emg_tracking.acquisition.block_events_csv import BlockEventCsvWriter
from emg_tracking.acquisition.motion_tools_csv import MotionToolsCsvWriter
from emg_tracking.acquisition.raw_block import RawBlock
from emg_tracking.acquisition.receiver import SAMPLING_RATE_HZ, CometaReceiver
from emg_tracking.acquisition.recording import record
from emg_tracking.acquisition.recording_files import RecordingFiles
from emg_tracking.acquisition.recording_writer import RecordingWriter
from emg_tracking.acquisition.sdk_loader import load_sdk
from emg_tracking.config import DEFAULT_CONFIG, load_config


class DurationLimitedWriter:
    """Schreibt Blöcke, bis ``duration_s`` (None: unbegrenzt) ab dem ersten Messwert erreicht ist.

    Die Dauer zählt in Samples, nicht in Rechnerzeit; der letzte Block kann sie um höchstens
    eine Event-Periode überschreiten.
    """

    def __init__(self, writer: RecordingWriter, duration_s: float | None) -> None:
        self._writer = writer
        self._limit = None if duration_s is None else round(duration_s * SAMPLING_RATE_HZ)
        self.n_samples = 0

    def __call__(self, block: RawBlock) -> bool:
        if self.n_samples == 0:
            print("Sensoren senden, Aufnahme läuft ... (Strg+C zum Beenden)")
        self._writer.write(block)
        self.n_samples += block.n_samples
        return self._limit is None or self.n_samples < self._limit


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--config", type=Path, default=DEFAULT_CONFIG)
    parser.add_argument("--duration", type=float, default=None, help="Sekunden (Standard: bis Strg+C)")
    parser.add_argument("--name", default="aufnahme", help="Präfix des Dateinamens")
    args = parser.parse_args(argv)

    cfg = load_config(args.config)
    sdk = load_sdk(cfg.sdk_dir)
    files = RecordingFiles.create(cfg.data_dir, args.name)
    files.copy_config(cfg.source_file)

    receiver = CometaReceiver(
        sdk, cfg.sensor_ids, cfg.event_period_ms, cfg.accelerometer_full_scale, cfg.device_ready_timeout_s
    )
    try:
        with open(files.raw_csv, "w", newline="", encoding="utf-8") as raw, \
                open(files.events_csv, "w", newline="", encoding="utf-8") as block_events:
            print(f"Warte, bis die Sensoren senden (höchstens {cfg.startup_timeout_s:g} s) ...")
            writer = RecordingWriter(MotionToolsCsvWriter(raw, cfg.csv_layout, cfg.sensor_ids, SAMPLING_RATE_HZ),
                                     BlockEventCsvWriter(block_events))
            handler = DurationLimitedWriter(writer, args.duration)
            n = record(receiver, handler, cfg.startup_timeout_s)
    except BaseException:
        files.discard_if_empty()
        raise
    if files.discard_if_empty():
        raise SystemExit("Keine Messwerte gespeichert.")
    print(f"{n} Samples ({n / SAMPLING_RATE_HZ:.1f} s) gespeichert: {files.raw_csv}")


if __name__ == "__main__":
    main()
