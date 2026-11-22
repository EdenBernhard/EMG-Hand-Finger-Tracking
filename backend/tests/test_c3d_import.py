"""Tests des C3D-Imports (Kanalnamen, CSV, Kommandozeile). Lesen echter C3D-Dateien nur mit ezc3d."""

import csv
import io
import json
from datetime import datetime

import numpy as np
import pytest

from emg_tracking.acquisition.c3d_import import cli
from emg_tracking.acquisition.c3d_import.analog_csv_writer import write_analog_csv
from emg_tracking.acquisition.c3d_import.analog_recording import AnalogRecording, unique_labels

SUBJECT = "74a248d61c25"
RATE = 2000
POINT_RATE = 100  # C3D braucht Marker-Frames; Analogwerte sind ein Vielfaches davon


def write_c3d(path, labels, samples):
    ezc3d = pytest.importorskip("ezc3d")
    c3d = ezc3d.c3d()
    c3d["parameters"]["POINT"]["RATE"]["value"] = [POINT_RATE]
    c3d["parameters"]["POINT"]["LABELS"]["value"] = ("marker",)
    c3d["data"]["points"] = np.zeros((4, 1, samples.shape[1] * POINT_RATE // RATE))
    c3d["parameters"]["ANALOG"]["RATE"]["value"] = [RATE]
    c3d["parameters"]["ANALOG"]["LABELS"]["value"] = tuple(labels)
    c3d["parameters"]["ANALOG"]["UNITS"]["value"] = tuple("V" for _ in labels)
    c3d["data"]["analogs"] = samples[np.newaxis]
    c3d.write(str(path))


def test_unique_labels_replaces_empty_and_duplicates():
    assert unique_labels([" EMG 5 ", "", "EMG 5"], 4) == ("EMG 5", "channel_2", "channel_3", "channel_4")


def test_recording_rejects_mismatched_shapes():
    with pytest.raises(ValueError):
        AnalogRecording(("a",), ("V",), RATE, np.zeros((2, 3)))
    with pytest.raises(ValueError):
        AnalogRecording(("a",), ("V",), 0, np.zeros((1, 3)))


def test_csv_has_index_time_and_channels():
    rec = AnalogRecording(("EMG 5", "EMG 6"), ("V", "V"), RATE, np.array([[0.5, 1.5], [-2.0, 3.25]]))
    out = io.StringIO()
    write_analog_csv(out, rec)
    rows = list(csv.reader(io.StringIO(out.getvalue())))
    assert rows == [["sample_index", "time_s", "EMG 5", "EMG 6"], ["0", "0.0", "0.5", "-2.0"],
                    ["1", "0.0005", "1.5", "3.25"]]
    assert rec.duration_s == 2 / RATE


def test_cli_imports_c3d_for_subject(tmp_path, monkeypatch, capsys):
    samples = np.arange(2 * 40, dtype=float).reshape(2, 40)
    source = tmp_path / "upload_temp.c3d"
    write_c3d(source, ["EMG 5", "EMG 6"], samples)
    subjects = tmp_path / "probanden"
    monkeypatch.setattr(cli, "load_config", lambda _: type("Cfg", (), {"subjects_dir": subjects}))

    code = cli.main([str(source), "--subject", SUBJECT, "--name", "Testlauf 2 Sensoren567.c3d",
                     "--context", json.dumps({"notiz": "alt"})])
    event = json.loads(capsys.readouterr().out)
    assert code == 0 and event["type"] == "finished", event
    assert event["samples"] == 40 and event["channels"] == ["EMG 5", "EMG 6"] and event["sampling_rate_hz"] == RATE

    stem = event["recording"]
    assert stem.endswith("_testlauf-2-sensoren567")
    folder = subjects / SUBJECT
    assert (folder / f"{stem}.c3d").read_bytes() == source.read_bytes()
    rows = list(csv.reader(open(folder / f"{stem}.csv", encoding="utf-8")))
    assert rows[0] == ["sample_index", "time_s", "EMG 5", "EMG 6"] and len(rows) == 41
    assert [float(v) for v in rows[1][2:]] == [0.0, 40.0]
    protocol = json.loads((folder / f"{stem}.protocol.json").read_text(encoding="utf-8"))
    assert protocol["source"] == "c3d" and protocol["original_file"] == "Testlauf 2 Sensoren567.c3d"
    assert protocol["context"] == {"notiz": "alt"} and protocol["channels"][0] == {"label": "EMG 5", "unit": "V"}


def test_import_rejects_bad_input_without_leaving_files(tmp_path):
    broken = tmp_path / "kaputt.c3d"
    broken.write_bytes(b"keine c3d")
    with pytest.raises(ValueError):
        cli.import_c3d(broken, "../boese", "a.c3d", {}, tmp_path)
    with pytest.raises(ValueError):
        cli.import_c3d(broken, SUBJECT, "a.csv", {}, tmp_path)
    pytest.importorskip("ezc3d")
    with pytest.raises(Exception):
        cli.import_c3d(broken, SUBJECT, "a.c3d", {}, tmp_path)
    assert not (tmp_path / SUBJECT).exists()


def test_import_refuses_to_overwrite(tmp_path):
    source = tmp_path / "a.c3d"
    write_c3d(source, ["EMG 1"], np.zeros((1, 20)))
    now = datetime(2026, 11, 22, 12, 0, 0)
    cli.import_c3d(source, SUBJECT, "a.c3d", {}, tmp_path, now)
    with pytest.raises(FileExistsError):
        cli.import_c3d(source, SUBJECT, "a.c3d", {}, tmp_path, now)


def test_cli_reports_errors_as_json(tmp_path, capsys):
    assert cli.main([str(tmp_path / "fehlt.c3d"), "--subject", SUBJECT, "--context", "[]"]) == 1
    assert json.loads(capsys.readouterr().out)["type"] == "error"
