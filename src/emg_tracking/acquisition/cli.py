"""Kommandozeile: Rohdaten empfangen und unverändert als CSV speichern.

Aufruf: ``python -m emg_tracking.acquisition.cli --duration 10``
(Strg+C beendet die Aufnahme ebenfalls).
"""

from __future__ import annotations

import argparse
import queue
import shutil
import time
from datetime import datetime
from pathlib import Path

from emg_tracking.acquisition.csv_writer import RawCsvWriter
from emg_tracking.acquisition.receiver import SAMPLING_RATE_HZ, CometaReceiver
from emg_tracking.config import DEFAULT_CONFIG, load_config

QUEUE_POLL_S = 0.1
# wavex meldet ein fehlendes Gerät nicht zuverlässig (GetDeviceState liefert immer None),
# daher gilt: kommen nach dem Start so lange keine Daten, stimmt etwas nicht.
NO_DATA_TIMEOUT_S = 3.0


def record(receiver: CometaReceiver, writer: RawCsvWriter, duration_s: float | None) -> int:
    """Nimmt bis ``duration_s`` (None: bis Strg+C) auf und gibt die Anzahl Samples zurück."""
    n = 0
    t_start = time.monotonic()
    t_end = None if duration_s is None else t_start + duration_s
    with receiver:
        try:
            while t_end is None or time.monotonic() < t_end:
                if not receiver.errors.empty():
                    raise receiver.errors.get()
                try:
                    block = receiver.blocks.get(timeout=QUEUE_POLL_S)
                except queue.Empty:
                    if n == 0 and time.monotonic() - t_start > NO_DATA_TIMEOUT_S:
                        raise RuntimeError(
                            f"Keine Daten nach {NO_DATA_TIMEOUT_S} s. Receiver per USB verbunden, "
                            "Treiber installiert, Sensoren eingeschaltet?"
                        )
                    continue
                writer.write(block)
                n += block.n_samples
        except KeyboardInterrupt:
            pass
    while not receiver.blocks.empty():  # nach Stop noch eingegangene Blöcke mitnehmen
        block = receiver.blocks.get_nowait()
        writer.write(block)
        n += block.n_samples
    return n


def n_rows_written(csv_path: Path) -> int:
    """Anzahl Datenzeilen (ohne Kopfzeile) einer Aufnahme; 0, wenn die Datei fehlt."""
    if not csv_path.exists():
        return 0
    with open(csv_path, encoding="utf-8") as f:
        return max(sum(1 for _ in f) - 1, 0)


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--config", type=Path, default=DEFAULT_CONFIG)
    parser.add_argument("--duration", type=float, default=None, help="Sekunden (Standard: bis Strg+C)")
    parser.add_argument("--name", default="aufnahme", help="Präfix des Dateinamens")
    args = parser.parse_args(argv)

    import wavex  # lädt die nativen Cometa-DLLs; erst hier, damit der Rest ohne SDK testbar bleibt

    cfg = load_config(args.config)
    cfg.data_dir.mkdir(parents=True, exist_ok=True)
    stem = f"{datetime.now():%Y-%m-%d_%H-%M-%S}_{args.name}"
    csv_path = cfg.data_dir / f"{stem}.csv"
    cfg_copy = cfg.data_dir / f"{stem}.config.toml"
    shutil.copyfile(cfg.source_file, cfg_copy)

    receiver = CometaReceiver(wavex, cfg.sensor_ids, cfg.event_period_ms)
    try:
        with open(csv_path, "w", newline="", encoding="utf-8") as f:
            print("Aufnahme läuft ... (Strg+C zum Beenden)")
            n = record(receiver, RawCsvWriter(f, cfg.sensor_ids), args.duration)
    except BaseException:
        if n_rows_written(csv_path) == 0:  # keine halbleeren Aufnahmen im Datenordner lassen
            csv_path.unlink(missing_ok=True)
            cfg_copy.unlink(missing_ok=True)
        raise

    print(f"{n} Samples ({n / SAMPLING_RATE_HZ:.1f} s) gespeichert: {csv_path}")


if __name__ == "__main__":
    main()
