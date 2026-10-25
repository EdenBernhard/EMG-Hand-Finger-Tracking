"""Empfang von Rohdaten des Cometa-Wave-Plus-Systems über das Paket ``wavex``.

Es wird nichts gefiltert oder umgerechnet: Die Werte sind die µV-Werte, die das SDK in
``EmgSamples[kanal, zeitpunkt]`` liefert.
"""

from __future__ import annotations

import queue
import time
from types import ModuleType
from typing import Any, Sequence

from emg_tracking.acquisition.raw_block import RawBlock

SAMPLING_RATE_HZ = 2000  # einzige EMG-Rate für WavePlus (EmgAcqPType.Emg_2kHz_Acc_142Hz)


class CometaReceiver:
    """Startet die Erfassung und stellt die empfangenen Blöcke in eine Queue.

    ``sdk`` ist das Modul ``wavex`` (in Tests eine Nachbildung). Das SDK ruft den Callback
    aus einem eigenen Thread auf; ``EmgSamples`` zeigt dabei direkt in den nativen Puffer
    und muss sofort kopiert werden.
    """

    def __init__(self, sdk: ModuleType, sensor_ids: Sequence[int], event_period_ms: int) -> None:
        if any(i < 1 for i in sensor_ids):
            raise ValueError(f"sensor_ids sind 1-basiert: {sensor_ids}")
        self.sensor_ids = tuple(sensor_ids)
        self.blocks: queue.Queue[RawBlock] = queue.Queue()
        self.errors: queue.Queue[BaseException] = queue.Queue()
        self._sdk = sdk
        self._rows = [i - 1 for i in self.sensor_ids]
        periods = sdk.enums.DataAvailableEventPeriod
        if f"ms_{event_period_ms}" not in periods.__members__:
            raise ValueError(f"event_period_ms={event_period_ms} nicht erlaubt: {list(periods.__members__)}")
        self._period = periods[f"ms_{event_period_ms}"]
        self._daq: Any = None
        self._sample_counter = 0

    def _on_data(self, e: Any) -> None:
        try:
            host_time_ns = time.time_ns()
            emg = e.EmgSamples
            if emg.shape[1] != e.ScanNumber:
                raise ValueError(f"EmgSamples {emg.shape} passt nicht zu ScanNumber {e.ScanNumber}")
            if max(self._rows) >= emg.shape[0]:
                raise IndexError(f"Sensor {max(self.sensor_ids)} nicht im Event ({emg.shape[0]} Kanäle)")
            samples = emg[self._rows, :].copy()  # eigene Kopie, der native Puffer wird wiederverwendet
            block = RawBlock(self._sample_counter, host_time_ns, self.sensor_ids, samples, int(e.UsbLostPackets))
            self._sample_counter += block.n_samples
            self.blocks.put(block)
        except BaseException as exc:  # Ausnahmen im SDK-Thread sonst stillschweigend verloren
            self.errors.put(exc)

    def start(self) -> None:
        daq = self._sdk.DaqSystem()
        try:
            cfg = self._sdk.CaptureConfiguration()
            cfg.set_emg_acq_p(self._sdk.enums.EmgAcqPType.Emg_2kHz_Acc_142Hz)
            daq.ConfigureCapture(cfg)  # wirft RuntimeError, wenn das Gerät nicht antwortet
            daq.OnDataAvailable(self._on_data)  # vor dem Start, damit kein Event verloren geht
            daq.StartCapturing(self._period)
        except BaseException:
            daq.close()
            raise
        self._daq = daq

    def stop(self) -> None:
        if self._daq is not None:
            try:
                self._daq.StopCapturing()
            finally:
                self._daq.close()  # meldet den Callback ab und gibt das Gerät frei
                self._daq = None

    def __enter__(self) -> CometaReceiver:
        self.start()
        return self

    def __exit__(self, *exc: object) -> None:
        self.stop()
