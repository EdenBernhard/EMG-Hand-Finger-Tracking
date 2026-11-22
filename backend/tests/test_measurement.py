"""Tests der Messung mit Bewegungsvorgaben (Zeitplan, Labels, Ereignisse, Kommandozeile)."""

import csv
import io
import json
import os
import threading
from types import SimpleNamespace

import numpy as np
import pytest

from emg_tracking.acquisition.csv_writer import RawCsvWriter
from emg_tracking.acquisition.measurement import cli
from emg_tracking.acquisition.measurement.cue_csv_writer import CueCsvWriter
from emg_tracking.acquisition.measurement.cue_schedule import CueSchedule
from emg_tracking.acquisition.measurement.event_stream import EventStream
from emg_tracking.acquisition.measurement.measurement import Measurement
from emg_tracking.acquisition.measurement.protocol import MeasurementProtocol, Movement
from emg_tracking.acquisition.measurement.recording_name import recording_name
from emg_tracking.acquisition.measurement.stop_listener import listen_for_stop
from emg_tracking.acquisition.raw_block import RawBlock
from emg_tracking.acquisition.recording import record
from fake_sdk import FakeReceiver

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
    m = Measurement(schedule, RawCsvWriter(raw, (1,)), CueCsvWriter(cues), EventStream(out), FS, clock_ns=lambda: 42)

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


@pytest.mark.parametrize("data", [b'{"command": "stop"}\n', b"kaputt\n{}\n", b""])
def test_stop_listener_stops_on_command_or_end_of_input(data):
    stop = threading.Event()
    listen_for_stop(io.BytesIO(data), stop).join(timeout=1)
    assert stop.is_set()


def test_cli_runs_measurement_and_writes_files(tmp_path, monkeypatch):
    config = tmp_path / "acquisition.toml"
    config.write_text(
        "[sdk]\ndir = 'lib/cometa'\ndevice_ready_timeout_s = 1\n"
        "[capture]\nsensor_ids = [1]\nevent_period_ms = 10\nstartup_timeout_s = 1\naccelerometer_full_scale = 'g_2'\n"
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
    folder = tmp_path / "raw" / PLAN["subject_id"]
    stem = finished["recording"]
    assert stem.endswith("_daumen")
    protocol = json.loads((folder / f"{stem}.protocol.json").read_text(encoding="utf-8"))
    assert protocol["movements"] == [{"name": "Daumen schließen", "count": 1}] and protocol["end_sample_index"] == 30
    assert protocol["label"] == "Daumen" and protocol["context"]["notiz"] == "Sitzung 2"
    assert protocol["sampling_rate_hz"] == FS and protocol["sdk"].endswith("0.0.0-test")
    assert (folder / f"{stem}.cues.csv").read_text(encoding="utf-8").splitlines()[1].startswith("0,1,Daumen schließen,1,1,10,")
    assert (folder / f"{stem}.config.toml").exists() and (folder / f"{stem}.csv").exists()


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
