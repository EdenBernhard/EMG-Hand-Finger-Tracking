"""Öffnet den Receiver über das SDK und wartet, bis er bereit ist (Zustand Idle)."""

from __future__ import annotations

import time
from typing import Any

from emg_tracking.acquisition.sdk_loader import WaveplusSdk

STATE_POLL_S = 0.05
FAILED_STATES = ("CommunicationError", "InitializingError")


def _wait_until_idle(sdk: WaveplusSdk, daq: Any, ready_timeout_s: float) -> None:
    deadline = time.monotonic() + ready_timeout_s
    while daq.State != sdk.DeviceState.Idle:
        state = str(daq.State)
        if state in FAILED_STATES:
            raise RuntimeError(f"Receiver meldet {state} (InitialError: {daq.InitialError}).")
        if time.monotonic() > deadline:
            raise RuntimeError(
                f"Receiver nach {ready_timeout_s:g} s nicht bereit (Zustand {state}). "
                "Per USB verbunden, Treiber installiert, EMG and Motion Tools geschlossen?"
            )
        time.sleep(STATE_POLL_S)


def open_daq(sdk: WaveplusSdk, ready_timeout_s: float) -> Any:
    """Nach ``new DaqSystem()`` initialisiert das SDK den Receiver im Hintergrund
    (NotConnected -> Initializing -> Idle). Der Aufrufer gibt ihn mit ``Dispose()`` wieder frei."""
    daq = sdk.DaqSystem()
    try:
        _wait_until_idle(sdk, daq, ready_timeout_s)
    except BaseException:
        daq.Dispose()
        raise
    return daq
