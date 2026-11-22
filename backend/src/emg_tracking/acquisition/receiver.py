"""Empfang von Rohdaten des Cometa-Wave-Plus-Systems über das .NET-SDK (Waveplus.DaqSys).

Es wird nichts gefiltert oder umgerechnet: Die Werte sind die µV-Werte, die das SDK in
``DataAvailableEventArgs.Samples[sensor, zeitpunkt]`` liefert.
"""

from __future__ import annotations

import queue
import time
from typing import Any, Callable, Sequence

import numpy as np

from emg_tracking.acquisition.device import open_daq
from emg_tracking.acquisition.net_array import float_matrix_to_numpy
from emg_tracking.acquisition.raw_block import RawBlock
from emg_tracking.acquisition.sdk_loader import WaveplusSdk
from emg_tracking.acquisition.startup_gate import StartupGate

SAMPLING_RATE_HZ = 2000  # einzige Rate des SDK (SamplingRate.Hz_2000)
EVENT_PERIODS_MS = (10, 25, 50, 100)  # DataAvailableEventPeriod laut SDK-Handbuch


def _member(enum_type: Any, name: str, what: str) -> Any:
    try:
        return getattr(enum_type, name)
    except AttributeError:
        raise ValueError(f"{what}={name!r} gibt es im SDK nicht") from None


class CometaReceiver:
    """Startet die Erfassung und stellt die empfangenen Blöcke in eine Queue.

    ``sdk`` kommt aus ``load_sdk`` (in Tests eine Nachbildung). Das SDK ruft ``DataAvailable``
    aus einem eigenen Thread auf; ``Samples`` ist ein .NET-Array und wird sofort nach NumPy
    kopiert. Die Anlaufphase ohne echte Messwerte wird über ``StartupGate`` verworfen;
    ``sample_index`` 0 ist der erste echte Messwert.
    """

    def __init__(
        self,
        sdk: WaveplusSdk,
        sensor_ids: Sequence[int],
        event_period_ms: int,
        accelerometer_full_scale: str,
        device_ready_timeout_s: float,
        to_numpy: Callable[[Any], np.ndarray] = float_matrix_to_numpy,
    ) -> None:
        if any(i < 1 for i in sensor_ids):
            raise ValueError(f"sensor_ids sind 1-basiert: {sensor_ids}")
        if event_period_ms not in EVENT_PERIODS_MS:
            raise ValueError(f"event_period_ms={event_period_ms} nicht erlaubt: {EVENT_PERIODS_MS}")
        self.sensor_ids = tuple(sensor_ids)
        self.blocks: queue.Queue[RawBlock] = queue.Queue()
        self.errors: queue.Queue[BaseException] = queue.Queue()
        self.startup_gate = StartupGate()
        self._sdk = sdk
        self._rows = [i - 1 for i in self.sensor_ids]
        self._period = _member(sdk.DataAvailableEventPeriod, f"ms_{event_period_ms}", "event_period_ms")
        self._accelerometer = _member(sdk.AccelerometerFullScale, accelerometer_full_scale, "accelerometer_full_scale")
        self._ready_timeout_s = device_ready_timeout_s
        self._to_numpy = to_numpy
        self._handler = self._on_data  # dasselbe Objekt für += und -=
        self._subscribed = False
        self._daq: Any = None
        self._sample_counter = 0

    def _on_data(self, sender: Any, e: Any) -> None:
        try:
            host_time_ns = time.time_ns()
            n = e.ScanNumber
            emg = self._to_numpy(e.Samples)
            if emg.shape[1] < n:
                raise ValueError(f"Samples {emg.shape} passt nicht zu ScanNumber {n}")
            if max(self._rows) >= emg.shape[0]:
                raise IndexError(f"Sensor {max(self.sensor_ids)} nicht im Event ({emg.shape[0]} Kanäle)")
            samples = self.startup_gate.admit(emg[self._rows, :n])  # Zeilenauswahl kopiert
            if samples.shape[1] == 0:
                return
            block = RawBlock(self._sample_counter, host_time_ns, self.sensor_ids, samples, int(e.USBLostPackets))
            self._sample_counter += block.n_samples
            self.blocks.put(block)
        except BaseException as exc:  # Ausnahmen im SDK-Thread sonst stillschweigend verloren
            self.errors.put(exc)

    def silent_sensor_ids(self) -> list[int]:
        """Sensoren, die seit dem Start noch keinen echten Messwert geliefert haben."""
        return [self.sensor_ids[row] for row in self.startup_gate.silent_channels()]

    def _configure(self, daq: Any) -> None:
        installed = daq.InstalledSensors
        if max(self.sensor_ids) > installed:
            raise RuntimeError(f"Sensor {max(self.sensor_ids)} gewählt, der Receiver kennt nur {installed} Sensoren.")
        capture = self._sdk.CaptureConfiguration()
        capture.SamplingRate = self._sdk.SamplingRate.Hz_2000
        daq.ConfigureCapture(capture)
        sensor = self._sdk.SensorConfiguration()
        sensor.SensorType = self._sdk.SensorType.EMG_SENSOR
        sensor.AccelerometerFullScale = self._accelerometer
        for sensor_id in self.sensor_ids:
            daq.ConfigureSensor(sensor, sensor_id)

    def start(self) -> None:
        daq = open_daq(self._sdk, self._ready_timeout_s)
        try:
            self._configure(daq)
            daq.DataAvailable += self._handler  # vor dem Start, damit kein Event verloren geht
            self._subscribed = True
            daq.StartCapturing(self._period)
        except BaseException:
            self._release(daq)
            raise
        self._daq = daq

    def _release(self, daq: Any) -> None:
        try:
            if self._subscribed:
                daq.DataAvailable -= self._handler
                self._subscribed = False
        finally:
            daq.Dispose()  # gibt das Gerät frei

    def stop(self) -> None:
        if self._daq is None:
            return
        daq, self._daq = self._daq, None
        try:
            if daq.State == self._sdk.DeviceState.Capturing:
                daq.StopCapturing()
        finally:
            self._release(daq)

    def __enter__(self) -> CometaReceiver:
        self.start()
        return self

    def __exit__(self, *exc: object) -> None:
        self.stop()
