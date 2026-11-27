"""Tests der Messung mit Bewegungsvorgaben (Zeitplan, Labels, Ereignisse, Kommandozeile)."""

import csv
import io
import json
import os
import subprocess
import sys
import threading
from types import SimpleNamespace

import numpy as np
import pytest

from emg_tracking.acquisition.block_events_csv import BlockEventCsvWriter
from emg_tracking.acquisition.csv_layout import CsvLayout
from emg_tracking.acquisition.motion_tools_csv import MotionToolsCsvWriter
from emg_tracking.acquisition.recording_writer import RecordingWriter
from emg_tracking.acquisition.measurement import cli
from emg_tracking.acquisition.measurement.cue_csv_writer import CueCsvWriter
from emg_tracking.acquisition.measurement.cue_schedule import CueSchedule
from emg_tracking.acquisition.measurement.event_stream import EventStream
from emg_tracking.acquisition.measurement.measurement import Measurement
from emg_tracking.acquisition.measurement.protocol import MeasurementProtocol, Movement
from emg_tracking.acquisition.measurement.recording_name import recording_name
from emg_tracking.acquisition.measurement.command_listener import listen_for_commands
from emg_tracking.acquisition.raw_block import RawBlock
from emg_tracking.acquisition.recording import record
from emg_tracking.config import load_config
from fake_sdk import FakeReceiver, fake_sdk

FS = 2000
PLAN = {"subject_id": "74a248d61c25", "movements": ["Faust", "Ruhe"], "interval_s": 0.01, "repetitions": 2,
        "lead_in_s": 0.005}


def blocks(n_blocks, size, ids=(1,)):
    return [RawBlock(i * size, i, ids, np.full((len(ids), size), i, dtype=np.float32), 0) for i in range(n_blocks)]


def events_of(out):
    return [json.loads(line) for line in out.getvalue().splitlines()]


def test_protocol_validates_input():
    p = MeasurementProtocol.from_dict({**PLAN, "movements": [" Faust ", "", {"name": "Pinch", "count": 3}, {"name": " "}]})
    assert p.movements == (Movement("Faust", 1), Movement("Pinch", 3))
    assert MeasurementProtocol.from_dict(p.to_dict()) == p
    for bad in ({"subject_id": "../x"}, {"movements": []}, {"interval_s": 0}, {"repetitions": 0},
                {"repetitions": True}, {"repetitions": 1.5}, {"lead_in_s": -1},
                {"movements": [{"name": "Pinch", "count": 0}]}, {"movements": [{"name": "Pinch", "count": "3"}]},
                {"context": "Notiz"}):
        with pytest.raises(ValueError):
            MeasurementProtocol.from_dict({**PLAN, **bad})


def test_recording_name_is_safe_for_file_names():
    assert recording_name("Pinch 3× – Übung") == "pinch-3-uebung"
    assert recording_name("../../etc") == "etc"
    assert recording_name("  ") == recording_name("✋") == "messung"
    assert len(recording_name("x" * 200)) == 40


def test_schedule_places_cues_in_samples():
    s = CueSchedule(MeasurementProtocol.from_dict(PLAN), FS)
    assert [(c.index, c.repetition, c.movement, c.sample_index) for c in s.cues] == [
        (0, 1, "Faust", 10), (1, 1, "Ruhe", 30), (2, 2, "Faust", 50), (3, 2, "Ruhe", 70)]
    assert s.end_sample_index == 90


def test_schedule_repeats_single_movement_in_a_row():
    plan = MeasurementProtocol.from_dict({**PLAN, "movements": ["Faust", {"name": "Pinch", "count": 3}], "lead_in_s": 0})
    s = CueSchedule(plan, FS)
    assert [(c.repetition, c.movement, c.in_row, c.in_row_of) for c in s.cues] == [
        (1, "Faust", 1, 1), (1, "Pinch", 1, 3), (1, "Pinch", 2, 3), (1, "Pinch", 3, 3),
        (2, "Faust", 1, 1), (2, "Pinch", 1, 3), (2, "Pinch", 2, 3), (2, "Pinch", 3, 3)]
    assert [c.sample_index for c in s.cues] == [k * 20 for k in range(8)]  # jede Vorgabe ein Intervall
    assert s.end_sample_index == 160


def test_schedule_adds_rest_cue_after_each_movement():
    plan = MeasurementProtocol.from_dict(
        {**PLAN, "movements": [{"name": "Faust", "count": 2}], "repetitions": 1, "lead_in_s": 0, "pause_s": 0.02})
    s = CueSchedule(plan, FS)
    assert [(c.index, c.movement, c.in_row, c.in_row_of, c.sample_index) for c in s.cues] == [
        (0, "Faust", 1, 2, 0), (1, "Ruhe", 1, 1, 20), (2, "Faust", 2, 2, 60), (3, "Ruhe", 1, 1, 80)]
    assert s.end_sample_index == 120  # endet nach der letzten Pause


def test_protocol_validates_pause():
    assert MeasurementProtocol.from_dict(PLAN).pause_s == 0
    p = MeasurementProtocol.from_dict({**PLAN, "pause_s": 10})
    assert p.pause_s == 10 and MeasurementProtocol.from_dict(p.to_dict()) == p
    with pytest.raises(ValueError):
        MeasurementProtocol.from_dict({**PLAN, "pause_s": -1})


def test_schedule_reports_each_cue_once():
    s = CueSchedule(MeasurementProtocol.from_dict(PLAN), FS)
    assert s.due(10) == []  # Sample 10 ist noch nicht da (Indizes 0..9)
    assert [c.index for c in s.due(11)] == [0]
    assert s.due(11) == []
    assert [c.index for c in s.due(71)] == [1, 2, 3]  # mehrere in einem Block
    assert not s.is_finished(89) and s.is_finished(90)


def test_measurement_writes_raw_data_and_labels_and_stops_at_end():
    raw, cues, out = io.StringIO(), io.StringIO(), io.StringIO()
    schedule = CueSchedule(MeasurementProtocol.from_dict(PLAN), FS)
    writer = RecordingWriter(MotionToolsCsvWriter(raw, CsvLayout((1,), 1), (1,), FS), BlockEventCsvWriter(io.StringIO()))
    m = Measurement(schedule, writer, CueCsvWriter(cues), EventStream(out), FS, clock_ns=lambda: 42)

    n = record(FakeReceiver(blocks(20, 20)), m, startup_timeout_s=1)

    assert n == 100 and m.completed and m.n_cues == 4  # endet nach dem Block mit Sample 90
    assert len(raw.getvalue().splitlines()) == 1 + 100
    rows = list(csv.reader(io.StringIO(cues.getvalue())))
    assert rows[0] == ["cue_index", "repetition", "movement", "in_row", "in_row_of", "sample_index", "emitted_host_time_ns"]
    assert rows[1] == ["0", "1", "Faust", "1", "1", "10", "42"]
    ev = events_of(out)
    assert ev[0] == {"type": "recording", "first_cue_in_s": 0.005, "total_cues": 4, "duration_s": 0.045}
    assert [e["movement"] for e in ev[1:]] == ["Faust", "Ruhe", "Faust", "Ruhe"]
    assert ev[1]["next_movement"] == "Ruhe" and ev[1]["ends_in_s"] == 0.01
    assert ev[-1]["next_movement"] is None and ev[-1]["ends_in_s"] == 0.01


def test_event_stream_is_ascii_json_lines():
    out = io.StringIO()
    EventStream(out).emit("cue", movement="Faust schließen")
    assert out.getvalue() == '{"type": "cue", "movement": "Faust schlie\\u00dfen"}\n'
    assert events_of(out)[0]["movement"] == "Faust schließen"


def test_foreign_stdout_output_does_not_break_event_lines():
    # Echter Prozess: SDK-Ausgaben ohne Zeilenende (print, nativ auf fd 1) landen auf stderr
    script = (
        "import os, sys\n"
        "from emg_tracking.acquisition.measurement.event_output import take_event_output\n"
        "from emg_tracking.acquisition.measurement.event_stream import EventStream\n"
        "events = EventStream(take_event_output())\n"
        "print('SDK sagt', end=''); sys.stdout.flush(); os.write(1, b'nativ ohne Zeilenende')\n"
        "events.emit('finished', saved=False)\n"
    )
    result = subprocess.run([sys.executable, "-c", script], capture_output=True, check=True)
    assert [json.loads(line) for line in result.stdout.decode("ascii").splitlines()] == [
        {"type": "finished", "saved": False}]
    assert b"SDK sagt" in result.stderr and b"nativ ohne Zeilenende" in result.stderr


@pytest.mark.parametrize("data", [b'{"command": "stop"}\n', b"kaputt\n{}\n", b""])
def test_command_listener_stops_on_command_or_end_of_input(data):
    stop = threading.Event()
    listen_for_commands(io.BytesIO(data), stop).join(timeout=1)
    assert stop.is_set()


def test_cli_runs_measurement_and_writes_files(tmp_path, monkeypatch):
    config = tmp_path / "acquisition.toml"
    config.write_text(
        "[sdk]\ndir = 'lib/cometa'\ndevice_ready_timeout_s = 1\n"
        "[capture]\nsensor_ids = [1]\nevent_period_ms = 10\nstartup_timeout_s = 1\naccelerometer_full_scale = 'g_2'\n"
        "[csv]\nemg_sensors = [1, 2, 4, 5, 6, 7]\nn_sensors = 16\n"
        f"[output]\ndata_dir = '{tmp_path.as_posix()}/frei'\nsubjects_dir = '{tmp_path.as_posix()}/raw'\n",
        encoding="utf-8",
    )
    monkeypatch.setattr(cli, "load_sdk", lambda path: SimpleNamespace(version="0.0.0-test"))
    monkeypatch.setattr(cli, "CometaReceiver", lambda *args: FakeReceiver(blocks(10, 20)))
    plan = {**PLAN, "movements": ["Daumen schließen"], "repetitions": 1, "label": "Daumen",
            "context": {"platzierung": {"id": "abcdef12", "name": "A"}, "notiz": "Sitzung 2"}}
    # Echte Pipe wie bei der Webapp: stdin bleibt offen (Ende von stdin hieße „stoppen“)
    read_fd, write_fd = os.pipe()
    os.write(write_fd, (json.dumps(plan, ensure_ascii=False) + "\n").encode("utf-8"))
    out = io.StringIO()
    monkeypatch.setattr("sys.stdin", SimpleNamespace(fileno=lambda: read_fd))
    monkeypatch.setattr("sys.stdout", out)

    try:
        assert cli.main(["--config", str(config)]) == 0
    finally:
        os.close(write_fd)
        os.close(read_fd)

    ev = events_of(out)
    assert [e["type"] for e in ev] == ["waiting_for_sensors", "recording", "cue", "finished"]
    finished = ev[-1]
    assert finished["saved"] and finished["completed"] and finished["cues"] == 1
    folder = tmp_path / "raw" / PLAN["subject_id"] / "a_abcdef12"  # Platzierung "A", ID abcdef12
    stem = finished["recording"]
    assert stem.endswith("_daumen")
    protocol = json.loads((folder / f"{stem}.protocol.json").read_text(encoding="utf-8"))
    assert protocol["movements"] == [{"name": "Daumen schließen", "count": 1}] and protocol["end_sample_index"] == 30
    assert protocol["label"] == "Daumen" and protocol["context"]["notiz"] == "Sitzung 2"
    assert protocol["sampling_rate_hz"] == FS and protocol["sdk"].endswith("0.0.0-test")
    assert (folder / f"{stem}.cues.csv").read_text(encoding="utf-8").splitlines()[1].startswith("0,1,Daumen schließen,1,1,10,")
    assert (folder / f"{stem}.config.toml").exists() and (folder / f"{stem}.csv").exists()
    header = (folder / f"{stem}.csv").read_text(encoding="utf-8").splitlines()[0].split(",")
    assert header[:3] == ["Time", "Emg_1", "Acc_1 :X"] and len(header) == 1 + 6 + 16 * 3, "Aufbau wie EMG and Motion Tools"
    assert (folder / f"{stem}.events.csv").read_text(encoding="utf-8").startswith("first_sample_index,")
    assert protocol["files"]["events"] == f"{stem}.events.csv"


def test_cli_reports_invalid_plan_as_error_event(monkeypatch):
    read_fd, write_fd = os.pipe()
    os.write(write_fd, b'{"subject_id": "x"}\n')
    os.close(write_fd)
    out = io.StringIO()
    monkeypatch.setattr("sys.stdin", SimpleNamespace(fileno=lambda: read_fd))
    monkeypatch.setattr("sys.stdout", out)
    try:
        assert cli.main([]) == 1
    finally:
        os.close(read_fd)
    assert events_of(out)[0]["type"] == "error"


def write_config(tmp_path, impedance):
    config = tmp_path / "acquisition.toml"
    config.write_text(
        "[sdk]\ndir = 'lib/cometa'\ndevice_ready_timeout_s = 1\n"
        "[capture]\nsensor_ids = [1, 2]\nevent_period_ms = 10\nstartup_timeout_s = 1\naccelerometer_full_scale = 'g_2'\n"
        "[csv]\nemg_sensors = [1, 2, 4, 5, 6, 7]\nn_sensors = 16\n"
        f"[impedance]\ncheck_before_measurement = {str(impedance).lower()}\n"
        f"[output]\ndata_dir = '{tmp_path.as_posix()}/frei'\nsubjects_dir = '{tmp_path.as_posix()}/raw'\n",
        encoding="utf-8",
    )
    return load_config(config)


def run_with_impedance(tmp_path, monkeypatch, impedance, decide=None):
    """decide: None (nichts), "continue" oder "stop" – schon vor dem Check gesetzt."""
    monkeypatch.setattr(cli, "load_sdk", lambda path: fake_sdk([], impedance=impedance))
    monkeypatch.setattr(cli, "CometaReceiver", lambda *args: FakeReceiver(blocks(10, 20, ids=(1, 2)), sensor_ids=(1, 2)))
    stop, proceed = threading.Event(), threading.Event()
    {"continue": proceed, "stop": stop}.get(decide, threading.Event()).set()
    out = io.StringIO()
    cli.run(MeasurementProtocol.from_dict({**PLAN, "repetitions": 1}), write_config(tmp_path, True), EventStream(out),
            stop, proceed)
    return events_of(out)


def test_cli_checks_impedance_before_recording(tmp_path, monkeypatch):
    ev = run_with_impedance(tmp_path, monkeypatch, {})
    assert [e["type"] for e in ev][:3] == ["checking_impedance", "impedance", "waiting_for_sensors"]
    assert ev[1]["passed"] and [r["sensor_id"] for r in ev[1]["results"]] == [1, 2]
    finished = ev[-1]
    protocol = json.loads((tmp_path / "raw" / PLAN["subject_id"] / "ohne_platzierung" / f"{finished['recording']}.protocol.json")
                          .read_text(encoding="utf-8"))
    assert protocol["impedance"]["passed"] and not protocol["impedance"]["continued_despite_failure"]


def test_cli_continues_after_failed_impedance_only_on_request(tmp_path, monkeypatch):
    ev = run_with_impedance(tmp_path, monkeypatch, {2: "Failed"}, decide="continue")
    assert not ev[1]["passed"] and ev[1]["results"][1] == {"sensor_id": 2, "report": "Failed", "passed": False}
    finished = ev[-1]
    assert finished["saved"]
    protocol = json.loads((tmp_path / "raw" / PLAN["subject_id"] / "ohne_platzierung" / f"{finished['recording']}.protocol.json")
                          .read_text(encoding="utf-8"))
    assert protocol["impedance"]["continued_despite_failure"]


def test_cli_stop_after_failed_impedance_saves_nothing(tmp_path, monkeypatch):
    ev = run_with_impedance(tmp_path, monkeypatch, {1: "NotExecuted"}, decide="stop")
    assert [e["type"] for e in ev] == ["checking_impedance", "impedance", "finished"]
    assert not ev[-1]["saved"]
    assert not (tmp_path / "raw").exists()


def test_cli_waits_for_decision_after_failed_impedance(tmp_path, monkeypatch):
    monkeypatch.setattr(cli, "load_sdk", lambda path: fake_sdk([], impedance={1: "Failed"}))
    stop, proceed = threading.Event(), threading.Event()
    out = io.StringIO()
    worker = threading.Thread(target=cli.run, args=(MeasurementProtocol.from_dict(PLAN), write_config(tmp_path, True),
                                                    EventStream(out), stop, proceed))
    worker.start()
    worker.join(timeout=0.5)
    assert worker.is_alive(), "ohne Entscheidung geht es nicht weiter"
    stop.set()
    worker.join(timeout=2)
    assert not worker.is_alive() and events_of(out)[-1]["type"] == "finished"


@pytest.mark.parametrize("data", [b'{"command": "continue"}\n{"command": "stop"}\n'])
def test_command_listener_sets_continue(data):
    stop, proceed = threading.Event(), threading.Event()
    listen_for_commands(io.BytesIO(data), stop, proceed).join(timeout=1)
    assert proceed.is_set() and stop.is_set()
