"""Empfangsschleife: holt Blöcke vom Receiver und reicht sie an einen Verarbeiter weiter."""

from __future__ import annotations

import queue
import threading
import time
from typing import Callable, Protocol

from emg_tracking.acquisition.raw_block import RawBlock

QUEUE_POLL_S = 0.1


class BlockSource(Protocol):
    blocks: queue.Queue[RawBlock]
    errors: queue.Queue[BaseException]

    def silent_sensor_ids(self) -> list[int]: ...
    def __enter__(self) -> BlockSource: ...
    def __exit__(self, *exc: object) -> None: ...


def record(
    receiver: BlockSource,
    handle_block: Callable[[RawBlock], bool],
    startup_timeout_s: float,
    stop_requested: threading.Event | None = None,
) -> int:
    """Gibt jeden echten Block an ``handle_block``, bis dieser ``False`` liefert, ``stop_requested``
    gesetzt wird oder Strg+C kommt. Gibt die Anzahl übergebener Samples zurück.

    Kommen nach ``startup_timeout_s`` keine echten Messwerte, stimmt etwas nicht (Sensor aus,
    nicht gekoppelt, falsche ``sensor_ids``).
    """
    n = 0
    t_start = time.monotonic()
    with receiver:
        try:
            while stop_requested is None or not stop_requested.is_set():
                if not receiver.errors.empty():
                    raise receiver.errors.get()
                try:
                    block = receiver.blocks.get(timeout=QUEUE_POLL_S)
                except queue.Empty:
                    if n == 0 and time.monotonic() - t_start > startup_timeout_s:
                        silent = receiver.silent_sensor_ids()
                        detail = f" Ohne Messwerte: Sensor {silent}." if silent else ""
                        raise RuntimeError(
                            f"Keine Messwerte nach {startup_timeout_s:g} s.{detail} Sensoren eingeschaltet, "
                            "mit dem Receiver gekoppelt, sensor_ids korrekt?"
                        )
                    continue
                n += block.n_samples
                if not handle_block(block):
                    break
        except KeyboardInterrupt:
            pass
    return n
