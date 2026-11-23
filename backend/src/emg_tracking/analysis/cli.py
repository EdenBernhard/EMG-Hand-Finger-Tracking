"""Erzeugt die Analyse-Seite einer Aufnahme (so ruft es die Webapp auf).

Aufruf im Ordner ``backend``: ``python -m emg_tracking.analysis.cli --csv <aufnahme.csv> --out <aufnahme.analyse.html>``

Führt das Notebook (Standard: ``Datenaufbereitung/Clustering_ Analyse.ipynb``) unverändert mit dieser CSV
aus. Bricht eine Zelle ab, enthält die Seite alles bis dahin samt Fehlermeldung.
stdout: eine JSON-Zeile mit ``type`` = ``finished`` (``error``: Meldung oder null) oder ``error``.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from emg_tracking.analysis.notebook_report import run_notebook

REPO_ROOT = Path(__file__).resolve().parents[4]  # backend/src/emg_tracking/analysis/cli.py -> Repo
DEFAULT_NOTEBOOK = REPO_ROOT / "Datenaufbereitung" / "Clustering_ Analyse.ipynb"
# Das Notebook nennt den Kernel „ds“ (Umgebung des Autors); hier läuft es mit dem Python dieses Prozesses.
DEFAULT_KERNEL = "python3"
DEFAULT_CELL_TIMEOUT_S = 1800  # großzügig für sehr lange Aufnahmen
TEMP_SUFFIX = ".tmp"


def _emit(event_type: str, **fields) -> None:
    print(json.dumps({"type": event_type, **fields}, ensure_ascii=True), flush=True)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--csv", type=Path, required=True)
    parser.add_argument("--out", type=Path, required=True)
    parser.add_argument("--notebook", type=Path, default=DEFAULT_NOTEBOOK)
    parser.add_argument("--kernel", default=DEFAULT_KERNEL)
    parser.add_argument("--cell-timeout", type=int, default=DEFAULT_CELL_TIMEOUT_S)
    args = parser.parse_args(argv)
    try:
        if not args.csv.is_file():
            raise FileNotFoundError(f"CSV nicht gefunden: {args.csv}")
        print(f"Führe {args.notebook.name} mit {args.csv.name} aus ...", file=sys.stderr)
        report = run_notebook(args.notebook, args.csv, args.kernel, args.cell_timeout)
        temp = args.out.with_name(args.out.name + TEMP_SUFFIX)
        temp.write_text(report.html, encoding="utf-8")
        temp.replace(args.out)  # nie eine halb geschriebene Seite
    except Exception as exc:
        print(f"Fehler: {exc}", file=sys.stderr)
        _emit("error", message=str(exc))
        return 1
    _emit("finished", out=str(args.out), error=report.error)
    return 0


if __name__ == "__main__":
    sys.exit(main())
