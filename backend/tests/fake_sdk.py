"""Nachbildung des .NET-SDK (Waveplus.DaqSys), damit die Erfassung ohne Hardware testbar ist."""

from __future__ import annotations

import queue
from enum import Enum
from types import SimpleNamespace

import numpy as np

from emg_tracking.acquisition.sdk_loader import WaveplusSdk

INSTALLED_SENSORS = 16


class NetEnum(Enum):
    def __str__(self) -> str:  # wie .NET-Enums unter pythonnet: str() liefert den Namen
        return self.name


DeviceState = NetEnum(
    "DeviceState", "NotConnected Initializing CommunicationError InitializingError UpdatingFirmware Idle Capturing"
)
SamplingRate = NetEnum("SamplingRate", "Hz_2000")
DataAvailableEventPeriod = NetEnum("DataAvailableEventPeriod", "ms_100 ms_50 ms_25 ms_10")
SensorType = NetEnum("SensorType", "EMG_SENSOR INERTIAL_SENSOR")
AccelerometerFullScale = NetEnum("AccelerometerFullScale", "g_2 g_4 g_8 g_16")
SensorCheckReport = NetEnum("SensorCheckReport", "Failed Passed NotExecuted")


class FakeEvent:
    """Unterstützt ``+=`` und ``-=`` wie ein .NET-Event unter pythonnet."""

    def __init__(self) -> None:
        self.handlers: list = []

    def __iadd__(self, handler):
        self.handlers.append(handler)
        return self

    def __isub__(self, handler):
        self.handlers.remove(handler)
        return self


class FakeConfiguration(SimpleNamespace):
    pass


class FakeDaqSystem:
    # impedance: Sensor-ID -> Name des SensorCheckReport; nicht genannte Sensoren bestehen
    def __init__(self, states=(DeviceState.Idle,), configure_ok=True, impedance=None):
        self._states = list(states)  # nacheinander gelieferte Zustände beim Abfragen von State
        self._state = self._states.pop(0)
        self.configure_ok = configure_ok
        self.InstalledSensors = INSTALLED_SENSORS
        self.InitialError = "Success"
        self.DataAvailable = FakeEvent()
        self.capture_config = None
        self.sensor_configs: dict[int, tuple] = {}
        self.handlers_at_start: list = []
        self.period = None
        self.disposed = False
        self.impedance = impedance or {}
        self.impedance_checked: list[int] = []

    @property
    def State(self):
        if self._states and self._state not in (DeviceState.Capturing,):
            self._state = self._states.pop(0)
        return self._state

    def ConfigureCapture(self, cfg):
        if not self.configure_ok:
            raise RuntimeError("ConfiguringCapture")
        self.capture_config = cfg

    def ConfigureSensor(self, cfg, sensor):
        self.sensor_configs[sensor] = (cfg.SensorType, cfg.AccelerometerFullScale)

    def StartCapturing(self, period):
        self.handlers_at_start = list(self.DataAvailable.handlers)
        self.period = period
        self._state = DeviceState.Capturing

    def StopCapturing(self):
        self._state = DeviceState.Idle

    def CheckElectrodeImpedance(self, sensor):
        """Wie vermutlich das SDK: ein Eintrag je installiertem Sensor, nur der geprüfte ist ausgeführt."""
        self.impedance_checked.append(sensor)
        reports = [SensorCheckReport.NotExecuted] * INSTALLED_SENSORS
        reports[sensor - 1] = SensorCheckReport[self.impedance.get(sensor, "Passed")]
        return reports

    def Dispose(self):
        self.disposed = True

    def fire(self, emg, usb_lost=0):
        """Wie das SDK: ``Samples`` hat eine Zeile pro installiertem Sensor."""
        buf = np.zeros((INSTALLED_SENSORS, emg.shape[1]), dtype=np.float32)
        buf[: emg.shape[0]] = emg
        e = SimpleNamespace(Samples=buf, ScanNumber=emg.shape[1], USBLostPackets=usb_lost)
        for handler in list(self.DataAvailable.handlers):
            handler(self, e)
        buf[:] = -1  # Puffer wird wiederverwendet; der Receiver muss vorher kopiert haben


def fake_sdk(created: list, **daq_kwargs) -> WaveplusSdk:
    def make_daq():
        daq = FakeDaqSystem(**daq_kwargs)
        created.append(daq)
        return daq

    return WaveplusSdk(
        DaqSystem=make_daq,
        CaptureConfiguration=FakeConfiguration,
        SensorConfiguration=FakeConfiguration,
        DeviceState=DeviceState,
        SamplingRate=SamplingRate,
        DataAvailableEventPeriod=DataAvailableEventPeriod,
        SensorType=SensorType,
        AccelerometerFullScale=AccelerometerFullScale,
        version="0.0.0-test",
    )


def copy_array(a):
    return np.array(a, dtype=np.float32, copy=True)


class FakeReceiver:
    """Liefert vorgegebene RawBlocks, ohne SDK."""

    def __init__(self, blocks=(), sensor_ids=(1,)):
        self.sensor_ids = tuple(sensor_ids)
        self.blocks = queue.Queue()
        self.errors = queue.Queue()
        for b in blocks:
            self.blocks.put(b)

    def silent_sensor_ids(self):
        return [] if not self.blocks.empty() else list(self.sensor_ids)

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        pass
