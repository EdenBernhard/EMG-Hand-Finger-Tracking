"""Tests der Ablage nach Elektroden-Platzierung (Ordnername, Umbenennen, Einsortieren alter Aufnahmen)."""

import json

import pytest

from emg_tracking.acquisition.placement_folder import NO_PLACEMENT, placement_folder
from emg_tracking.acquisition.sort_recordings import apply, planned_moves

PLACEMENT = {"id": "eedaaa2f", "name": "A · Nah am Ellenbogen", "variante": "A"}


def test_folder_name_from_placement_name_and_id(tmp_path):
    assert placement_folder(tmp_path, PLACEMENT) == tmp_path / "a-nah-am-ellenbogen_eedaaa2f"
    assert placement_folder(tmp_path, {"id": "eedaaa2f", "name": "", "variante": "B"}).name == "b_eedaaa2f"


def test_missing_or_invalid_placement_goes_to_fallback(tmp_path):
    for placement in (None, {}, {"id": "../boese", "name": "x"}):
        assert placement_folder(tmp_path, placement) == tmp_path / NO_PLACEMENT


def test_renamed_placement_keeps_existing_folder(tmp_path):
    (tmp_path / "a-nah-am-ellenbogen_eedaaa2f").mkdir()
    assert placement_folder(tmp_path, {**PLACEMENT, "name": "Neuer Name"}) == tmp_path / "a-nah-am-ellenbogen_eedaaa2f"


def write_recording(subject, stem, context, suffixes=(".csv", ".cues.csv", ".config.toml")):
    (subject / f"{stem}.protocol.json").write_text(json.dumps({"context": context}), encoding="utf-8")
    for suffix in suffixes:
        (subject / f"{stem}{suffix}").write_text("x", encoding="utf-8")


def test_sort_moves_all_files_of_a_recording(tmp_path):
    write_recording(tmp_path, "2026-11-22_17-54-12_kontinuierlich", {"platzierung": PLACEMENT})
    write_recording(tmp_path, "2026-11-22_21-43-45_mvc", {"notiz": "alt"}, suffixes=(".csv", ".c3d"))
    (tmp_path / "proband.json").write_text("{}", encoding="utf-8")
    (tmp_path / "innen.jpg").write_bytes(b"")

    apply(planned_moves(tmp_path))
    folder = tmp_path / "a-nah-am-ellenbogen_eedaaa2f"
    assert sorted(p.name for p in folder.iterdir()) == [f"2026-11-22_17-54-12_kontinuierlich{s}" for s in
                                                        (".config.toml", ".csv", ".cues.csv", ".protocol.json")]
    assert sorted(p.name for p in (tmp_path / NO_PLACEMENT).iterdir()) == [
        "2026-11-22_21-43-45_mvc.c3d", "2026-11-22_21-43-45_mvc.csv", "2026-11-22_21-43-45_mvc.protocol.json"]
    assert (tmp_path / "proband.json").exists() and (tmp_path / "innen.jpg").exists(), "Webapp-Dateien bleiben"
    assert planned_moves(tmp_path) == [], "zweiter Lauf hat nichts mehr zu tun"


def test_sort_never_overwrites(tmp_path):
    write_recording(tmp_path, "stamm", {"platzierung": PLACEMENT}, suffixes=(".csv",))
    target = tmp_path / "a-nah-am-ellenbogen_eedaaa2f"
    target.mkdir()
    (target / "stamm.csv").write_text("vorhanden", encoding="utf-8")
    with pytest.raises(FileExistsError):
        apply(planned_moves(tmp_path))
    assert (tmp_path / "stamm.protocol.json").exists(), "nichts verschoben"
    assert (target / "stamm.csv").read_text(encoding="utf-8") == "vorhanden"
