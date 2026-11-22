"""Tests der Analyse-Seite: Notebook mit fester CSV ausführen, ohne die Notebook-Datei zu verändern.

Mit kleinen Test-Notebooks statt des echten (das braucht pandas, scikit-learn usw. und etwa 30 s).
"""

import json

import pytest

from emg_tracking.analysis import cli
from emg_tracking.analysis.notebook_report import EXTERNAL_SCRIPT, csv_name_in_notebook, run_notebook

nbformat = pytest.importorskip("nbformat")
pytest.importorskip("nbclient")
pytest.importorskip("nbconvert")
pytest.importorskip("ipykernel")

TIMEOUT_S = 60
# liest wie das echte Notebook über read_csv("..."), aber ohne pandas
READ = "def read_csv(path):\n    return open(path).read().splitlines()\n"


def notebook(tmp_path, *sources):
    nb = nbformat.v4.new_notebook(cells=[nbformat.v4.new_code_cell(s) for s in sources])
    nb.metadata["kernelspec"] = {"name": "ds", "display_name": "Python (ds)", "language": "python"}
    path = tmp_path / "analyse.ipynb"
    nbformat.write(nb, path)
    return path


def test_csv_name_is_taken_from_read_csv():
    nb = nbformat.v4.new_notebook(cells=[nbformat.v4.new_markdown_cell('read_csv("falsch.csv")'),
                                         nbformat.v4.new_code_cell('df = pd.read_csv(\n    "./Testlauf_2.csv")')])
    assert csv_name_in_notebook(nb) == "Testlauf_2.csv"
    with pytest.raises(ValueError):
        csv_name_in_notebook(nbformat.v4.new_notebook(cells=[nbformat.v4.new_code_cell("x = 1")]))


def test_external_scripts_are_removed():
    page = '<script src="https://cdn.example/a.js"></script><script>lokal()</script>'
    assert EXTERNAL_SCRIPT.sub("", page) == "<script>lokal()</script>"


def test_notebook_runs_with_given_csv_and_stays_unchanged(tmp_path):
    path = notebook(tmp_path, READ + 'rows = read_csv("./Testlauf.csv")\nprint("Zeilen:", len(rows))')
    before = path.read_bytes()
    csv_path = tmp_path / "messung.csv"
    csv_path.write_text("Time,Emg_5\n0.0,1.5\n0.0005,2.5\n", encoding="utf-8")

    report = run_notebook(path, csv_path, "python3", TIMEOUT_S)
    assert report.error is None
    assert "Zeilen: 3" in report.html
    assert path.read_bytes() == before, "Notebook-Datei wird nicht verändert"
    assert csv_path.exists(), "Original-CSV bleibt"


def test_failing_cell_still_gives_page_up_to_error(tmp_path, capsys):
    path = notebook(tmp_path, READ + 'read_csv("./Testlauf.csv")\nprint("erste Zelle ok")', 'raise KeyError("Emg_5")')
    csv_path = tmp_path / "messung.csv"
    csv_path.write_text("Time\n0.0\n", encoding="utf-8")
    out = tmp_path / "messung.analyse.html"

    assert cli.main(["--csv", str(csv_path), "--out", str(out), "--notebook", str(path),
                     "--cell-timeout", str(TIMEOUT_S)]) == 0
    event = json.loads(capsys.readouterr().out.strip().splitlines()[-1])
    assert event["type"] == "finished" and "KeyError" in event["error"]
    assert "erste Zelle ok" in out.read_text(encoding="utf-8")


def test_missing_csv_is_reported(tmp_path, capsys):
    assert cli.main(["--csv", str(tmp_path / "fehlt.csv"), "--out", str(tmp_path / "x.html")]) == 1
    assert json.loads(capsys.readouterr().out)["type"] == "error"
