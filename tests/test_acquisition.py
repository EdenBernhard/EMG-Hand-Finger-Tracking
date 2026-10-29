"""Tests der Erfassung ohne Hardware: Das Paket wavex wird nachgebildet."""

import csv
import io
import queue
from enum import IntEnum
from types import SimpleNamespace

import numpy as np
import pytest

from emg_tracking.acquisition import cli
from emg_tracking.acquisition.csv_writer import RawCsvWriter
from emg_tracking.acquisition.raw_block import RawBlock
from emg_tracking.acquisition.receiver import CometaReceiver
from emg_tracking.acquisition.startup_gate import StartupGate
from emg_tracking.config import load_config


class DataAvailableEventPeriod(IntEnum):  # wie wavex.enums
    ms_100 = 0
    ms_50 = 1
    ms_25 = 2
    ms_10 = 3


class EmgAcqPType(IntEnum):
    Emg_2kHz_Acc_142Hz = 0


class FakeCaptureConfiguration:
    def set_emg_acq_p(self, acq_type):
        self.emg_acq_p = acq_type


class FakeDaqSystem:
    def __init__(self, configure_ok=True):
        self.configure_ok = configure_ok
        self.callback = None
        self.capturing = False
        self.closed = False

    def ConfigureCapture(self, cfg):
        if not self.configure_ok:
            raise RuntimeError("WaveX_ConfigureCapture failed")
        self.cfg = cfg

    def OnDataAvailable(self, cb):
        self.callback = cb

    def StartCapturing(self, period):
        assert self.callback, "Callback muss vor dem Start registriert sein"
        self.period = period
        self.capturing = True

    def StopCapturing(self):
        self.capturing = False

    def close(self):
        self.closed = True

    def fire(self, emg, usb_lost=0):
        # wie wavex: EmgSamples hat 36 Zeilen und zeigt auf einen wiederverwendeten Puffer
        buf = np.zeros((36, emg.shape[1]), dtype=np.float32)
        buf[: emg.shape[0]] = emg
        self.callback(SimpleNamespace(EmgSamples=buf, ScanNumber=emg.shape[1], UsbLostPackets=usb_lost))
        buf[:] = -1  # Puffer wird überschrieben; der Receiver muss vorher kopiert haben


def fake_wavex(created, configure_ok=True):
    def make_daq():
        daq = FakeDaqSystem(configure_ok)
        created.append(daq)
        return daq

    return SimpleNamespace(
        DaqSystem=make_daq,
        CaptureConfiguration=FakeCaptureConfiguration,
        enums=SimpleNamespace(DataAvailableEventPeriod=DataAvailableEventPeriod, EmgAcqPType=EmgAcqPType),
    )


class FakeReceiver:
    def __init__(self, blocks=()):
        self.sensor_ids = (1,)
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


def test_receiver_configures_sdk_and_copies_selected_sensors():
    created = []
    rx = CometaReceiver(fake_wavex(created), [1, 3], event_period_ms=10)
    with rx:
        daq = created[0]
        assert daq.capturing and daq.period == DataAvailableEventPeriod.ms_10
        assert daq.cfg.emg_acq_p == EmgAcqPType.Emg_2kHz_Acc_142Hz
        # erstes Sample je Kanal = eingefrorener Startwert, wird verworfen (siehe StartupGate)
        daq.fire(np.array([[0, 1, 2], [0, 0, 0], [0, 3, 4]], dtype=np.float32), usb_lost=5)
        daq.fire(np.array([[5], [0], [6]], dtype=np.float32))
    assert not daq.capturing and daq.closed
    assert rx.errors.empty()

    b1, b2 = rx.blocks.get_nowait(), rx.blocks.get_nowait()
    assert b1.first_sample_index == 0 and b1.usb_lost_packets == 5
    np.testing.assert_array_equal(b1.samples, [[1, 2], [3, 4]])  # trotz überschriebenem Puffer
    assert b2.first_sample_index == 2
    np.testing.assert_array_equal(b2.samples, [[5], [6]])


def test_receiver_rejects_invalid_config_before_touching_device():
    created = []
    with pytest.raises(ValueError):
        CometaReceiver(fake_wavex(created), [1], event_period_ms=7)
    with pytest.raises(ValueError):
        CometaReceiver(fake_wavex(created), [0], event_period_ms=10)
    assert not created


def test_receiver_releases_device_when_configuration_fails():
    created = []
    rx = CometaReceiver(fake_wavex(created, configure_ok=False), [1], 10)
    with pytest.raises(RuntimeError):
        rx.start()
    assert created[0].closed


def test_record_writes_raw_values_and_lost_packets():
    ids = (1, 4)
    blocks = [
        RawBlock(0, 100, ids, np.array([[0.5, -1.25], [10.0, 20.0]], dtype=np.float32), 0),
        RawBlock(2, 200, ids, np.array([[0.1], [30.0]], dtype=np.float32), 1),
    ]
    out = io.StringIO()
    n = cli.record(FakeReceiver(blocks), RawCsvWriter(out, ids), duration_s=0, startup_timeout_s=1)

    rows = list(csv.reader(io.StringIO(out.getvalue())))
    assert n == 3
    assert rows[0] == ["sample_index", "host_time_ns", "sensor_1_uV", "sensor_4_uV", "usb_lost_packets"]
    assert rows[1:] == [
        ["0", "100", "0.5", "10.0", "0"],
        ["1", "100", "-1.25", "20.0", "0"],
        ["2", "200", "0.1", "30.0", "1"],
    ]


def test_record_fails_when_no_data_arrives():
    with pytest.raises(RuntimeError, match="Keine Messwerte"):
        cli.record(FakeReceiver(), RawCsvWriter(io.StringIO(), (1,)), duration_s=1, startup_timeout_s=0)


def test_startup_gate_discards_frozen_blocks_and_trims_frozen_prefix():
    gate = StartupGate()
    frozen = np.array([[7.0, 7.0, 7.0], [-3.0, -3.0, -3.0]], dtype=np.float32)
    assert gate.admit(frozen).shape == (2, 0) and not gate.is_open

    first_live = np.array([[7.0, 7.0, 1.5, 2.5], [-3.0, -3.0, 0.5, 0.25]], dtype=np.float32)
    np.testing.assert_array_equal(gate.admit(first_live), [[1.5, 2.5], [0.5, 0.25]])
    assert gate.is_open and gate.discarded_samples == 5

    constant_later = np.full((2, 3), 3299.9, dtype=np.float32)  # z. B. Übersteuerung nach dem Anlauf
    np.testing.assert_array_equal(gate.admit(constant_later), constant_later)


def test_startup_gate_waits_for_all_channels():
    gate = StartupGate()
    # Kanal 0 sendet ab Sample 1, Kanal 1 bleibt eingefroren
    assert gate.admit(np.array([[1.0, 2.0, 3.0], [5.0, 5.0, 5.0]], dtype=np.float32)).shape == (2, 0)
    assert gate.silent_channels() == [1]
    # Kanal 1 sendet ab Sample 2 dieses Blocks: die Aufnahme beginnt dort für beide Kanäle
    out = gate.admit(np.array([[4.0, 5.0, 6.0], [5.0, 5.0, 9.0]], dtype=np.float32))
    np.testing.assert_array_equal(out, [[6.0], [9.0]])
    assert gate.silent_channels() == []


def test_receiver_starts_sample_index_at_first_real_value():
    created = []
    rx = CometaReceiver(fake_wavex(created), [1], event_period_ms=10)
    with rx:
        daq = created[0]
        daq.fire(np.array([[4.0, 4.0]], dtype=np.float32))  # Anlaufphase: eingefroren
        daq.fire(np.array([[4.0, 8.0, 9.0]], dtype=np.float32))
    block = rx.blocks.get_nowait()
    assert rx.blocks.empty()
    assert block.first_sample_index == 0
    np.testing.assert_array_equal(block.samples, [[8.0, 9.0]])


def test_receiver_names_silent_sensors():
    created = []
    rx = CometaReceiver(fake_wavex(created), [5, 7], event_period_ms=10)
    emg = np.zeros((7, 3), dtype=np.float32)
    emg[4] = [1.0, 2.0, 3.0]  # Sensor 5 sendet
    emg[6] = [8.0, 8.0, 8.0]  # Sensor 7 bleibt eingefroren
    with rx:
        created[0].fire(emg)
    assert rx.blocks.empty()
    assert rx.silent_sensor_ids() == [7]


def test_csv_writer_rejects_mismatched_sensors():
    writer = RawCsvWriter(io.StringIO(), (1, 2))
    with pytest.raises(ValueError):
        writer.write(RawBlock(0, 0, (1, 3), np.zeros((2, 1), dtype=np.float32), 0))


def test_default_config_loads():
    cfg = load_config()
    assert cfg.sensor_ids and cfg.event_period_ms > 0
