"""Tests der Erfassung ohne Hardware: Das .NET-SDK wird nachgebildet (tests/fake_sdk.py)."""

import csv
import io
import threading

import numpy as np
import pytest

from emg_tracking.acquisition.cli import DurationLimitedWriter
from emg_tracking.acquisition.csv_writer import RawCsvWriter
from emg_tracking.acquisition.impedance_check import check_impedance
from emg_tracking.acquisition.raw_block import RawBlock
from emg_tracking.acquisition.receiver import SAMPLING_RATE_HZ, CometaReceiver
from emg_tracking.acquisition.recording import record
from emg_tracking.acquisition.recording_files import RecordingFiles
from emg_tracking.acquisition.sdk_loader import load_sdk
from emg_tracking.acquisition.startup_gate import StartupGate
from emg_tracking.config import load_config
from fake_sdk import (
    AccelerometerFullScale,
    DataAvailableEventPeriod,
    INSTALLED_SENSORS,
    DeviceState,
    FakeDaqSystem,
    FakeReceiver,
    SamplingRate,
    SensorCheckReport,
    SensorType,
    copy_array,
    fake_sdk,
)


def make_receiver(created, sensor_ids=(1,), timeout_s=1.0, accelerometer="g_2", period=10, **daq_kwargs):
    return CometaReceiver(
        fake_sdk(created, **daq_kwargs), sensor_ids, period, accelerometer, timeout_s, to_numpy=copy_array
    )


def test_receiver_configures_sdk_and_copies_selected_sensors():
    created = []
    rx = make_receiver(created, sensor_ids=[1, 3])
    with rx:
        daq = created[0]
        assert daq.period == DataAvailableEventPeriod.ms_10
        assert daq.capture_config.SamplingRate == SamplingRate.Hz_2000
        assert daq.sensor_configs == {
            1: (SensorType.EMG_SENSOR, AccelerometerFullScale.g_2),
            3: (SensorType.EMG_SENSOR, AccelerometerFullScale.g_2),
        }
        assert daq.handlers_at_start, "Handler muss vor StartCapturing angemeldet sein"
        # erstes Sample je Kanal = eingefrorener Startwert, wird verworfen (siehe StartupGate)
        daq.fire(np.array([[0, 1, 2], [0, 0, 0], [0, 3, 4]], dtype=np.float32), usb_lost=5)
        daq.fire(np.array([[5], [0], [6]], dtype=np.float32))
    assert daq.disposed and not daq.DataAvailable.handlers and daq.State == DeviceState.Idle
    assert rx.errors.empty()

    b1, b2 = rx.blocks.get_nowait(), rx.blocks.get_nowait()
    assert b1.first_sample_index == 0 and b1.usb_lost_packets == 5
    np.testing.assert_array_equal(b1.samples, [[1, 2], [3, 4]])  # trotz überschriebenem Puffer
    assert b2.first_sample_index == 2
    np.testing.assert_array_equal(b2.samples, [[5], [6]])


def test_receiver_rejects_invalid_config_before_touching_device():
    created = []
    with pytest.raises(ValueError):
        make_receiver(created, period=7)
    with pytest.raises(ValueError):
        make_receiver(created, sensor_ids=[0])
    with pytest.raises(ValueError, match="accelerometer_full_scale"):
        make_receiver(created, accelerometer="g_3")
    assert not created


def test_receiver_releases_device_when_configuration_fails():
    created = []
    rx = make_receiver(created, configure_ok=False)
    with pytest.raises(RuntimeError):
        rx.start()
    assert created[0].disposed and not created[0].DataAvailable.handlers


def test_receiver_waits_until_device_is_idle():
    created = []
    rx = make_receiver(created, states=(DeviceState.NotConnected, DeviceState.Initializing, DeviceState.Idle))
    with rx:
        assert created[0].period is not None


def test_receiver_reports_initializing_error_and_timeout():
    created = []
    with pytest.raises(RuntimeError, match="InitializingError"):
        make_receiver(created, states=(DeviceState.Initializing, DeviceState.InitializingError)).start()
    with pytest.raises(RuntimeError, match="nicht bereit"):
        make_receiver(created, timeout_s=0, states=(DeviceState.NotConnected,)).start()
    assert all(d.disposed for d in created)


def test_receiver_rejects_sensor_not_installed():
    created = []
    with pytest.raises(RuntimeError, match="kennt nur"):
        make_receiver(created, sensor_ids=[17]).start()
    assert created[0].disposed


def test_receiver_starts_sample_index_at_first_real_value():
    created = []
    rx = make_receiver(created)
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
    rx = make_receiver(created, sensor_ids=[5, 7])
    emg = np.zeros((7, 3), dtype=np.float32)
    emg[4] = [1.0, 2.0, 3.0]  # Sensor 5 sendet
    emg[6] = [8.0, 8.0, 8.0]  # Sensor 7 bleibt eingefroren
    with rx:
        created[0].fire(emg)
    assert rx.blocks.empty()
    assert rx.silent_sensor_ids() == [7]


def test_record_writes_raw_values_and_lost_packets():
    ids = (1, 4)
    blocks = [
        RawBlock(0, 100, ids, np.array([[0.5, -1.25], [10.0, 20.0]], dtype=np.float32), 0),
        RawBlock(2, 200, ids, np.array([[0.1], [30.0]], dtype=np.float32), 1),
    ]
    out = io.StringIO()
    n = record(FakeReceiver(blocks, ids), DurationLimitedWriter(RawCsvWriter(out, ids), 3 / SAMPLING_RATE_HZ), 1)

    rows = list(csv.reader(io.StringIO(out.getvalue())))
    assert n == 3
    assert rows[0] == ["sample_index", "host_time_ns", "sensor_1_uV", "sensor_4_uV", "usb_lost_packets"]
    assert rows[1:] == [
        ["0", "100", "0.5", "10.0", "0"],
        ["1", "100", "-1.25", "20.0", "0"],
        ["2", "200", "0.1", "30.0", "1"],
    ]


def test_duration_counts_samples_not_wall_time():
    ids = (1,)
    blocks = [RawBlock(i * 2, 0, ids, np.zeros((1, 2), dtype=np.float32), 0) for i in range(5)]
    writer = DurationLimitedWriter(RawCsvWriter(io.StringIO(), ids), 4 / SAMPLING_RATE_HZ)
    assert record(FakeReceiver(blocks), writer, 1) == 4


def test_record_fails_when_no_data_arrives():
    with pytest.raises(RuntimeError, match="Keine Messwerte"):
        record(FakeReceiver(), lambda block: True, startup_timeout_s=0)


def test_record_stops_on_request():
    stop = threading.Event()
    stop.set()
    block = RawBlock(0, 0, (1,), np.zeros((1, 2), dtype=np.float32), 0)
    assert record(FakeReceiver([block]), lambda b: True, 1, stop) == 0


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


def test_csv_writer_rejects_mismatched_sensors():
    writer = RawCsvWriter(io.StringIO(), (1, 2))
    with pytest.raises(ValueError):
        writer.write(RawBlock(0, 0, (1, 3), np.zeros((2, 1), dtype=np.float32), 0))


def test_recording_files_discard_only_empty_recordings(tmp_path):
    files = RecordingFiles.create(tmp_path / "P01", "messung")
    files.raw_csv.write_text("sample_index\n", encoding="utf-8")
    files.cues_csv.write_text("cue_index\n", encoding="utf-8")
    assert files.discard_if_empty() and not any(p.exists() for p in files.all())
    assert not files.directory.exists(), "leerer Probanden-Ordner wird mit entfernt"

    files = RecordingFiles.create(tmp_path / "P01", "messung")
    files.raw_csv.write_text("sample_index\n0\n", encoding="utf-8")
    assert not files.discard_if_empty() and files.raw_csv.exists()


def test_sdk_loader_names_missing_files(tmp_path):
    with pytest.raises(FileNotFoundError, match="Waveplus.DaqSys.dll"):
        load_sdk(tmp_path)


def test_net_array_copy_matches_dotnet_layout():
    pytest.importorskip("pythonnet")
    from emg_tracking.acquisition.net_array import float_matrix_to_numpy
    from emg_tracking.acquisition.sdk_loader import _start_runtime

    try:
        _start_runtime()
    except Exception as exc:  # z. B. kein .NET Framework (nicht Windows)
        pytest.skip(f".NET-Laufzeit nicht verfügbar: {exc}")
    from System import Array, Single

    net = Array.CreateInstance(Single, 3, 4)
    for i in range(3):
        for j in range(4):
            net[i, j] = i * 10 + j + 0.5
    out = float_matrix_to_numpy(net)
    assert out.dtype == np.float32
    np.testing.assert_array_equal(out, [[i * 10 + j + 0.5 for j in range(4)] for i in range(3)])
    assert float_matrix_to_numpy(Array.CreateInstance(Single, 16, 0)).shape == (16, 0)


def test_default_config_loads():
    cfg = load_config()
    assert cfg.sensor_ids and cfg.event_period_ms > 0 and cfg.device_ready_timeout_s > 0
    assert cfg.sdk_dir.name == "cometa"


def test_impedance_check_reports_each_sensor_and_releases_device():
    created = []
    sdk = fake_sdk(created, impedance={2: "Failed"})
    results = check_impedance(sdk, (1, 2, 4), ready_timeout_s=1)
    assert [(r.sensor_id, r.report, r.passed) for r in results] == [(1, "Passed", True), (2, "Failed", False),
                                                                     (4, "Passed", True)]
    assert created[0].impedance_checked == [1, 2, 4] and created[0].disposed


def test_impedance_check_accepts_single_report_and_rejects_unknown_sensor():
    created = []
    sdk = fake_sdk(created)
    original = FakeDaqSystem.CheckElectrodeImpedance
    try:
        FakeDaqSystem.CheckElectrodeImpedance = lambda self, sensor: [SensorCheckReport.Failed]
        assert not check_impedance(sdk, (3,), 1)[0].passed
    finally:
        FakeDaqSystem.CheckElectrodeImpedance = original
    with pytest.raises(RuntimeError, match="kennt nur"):
        check_impedance(sdk, (INSTALLED_SENSORS + 1,), 1)
    assert all(d.disposed for d in created)
