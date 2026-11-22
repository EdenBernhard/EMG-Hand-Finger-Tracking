"""Führt ein Analyse-Notebook unverändert mit der CSV einer Aufnahme aus und macht daraus eine HTML-Seite.

Das Notebook liest seine CSV über einen festen Dateinamen relativ zum Arbeitsordner
(``pd.read_csv("./Testlauf_2_Sensoren567.csv")``). Deshalb läuft es in einem leeren temporären Ordner,
in dem die gewählte CSV unter genau diesem Namen liegt (als harter Link, bei großen Dateien ohne Kopie).
Die Notebook-Datei wird nur gelesen, nie geschrieben; Kernel und Ausgaben gibt es nur im Speicher.
"""

from __future__ import annotations

import os
import re
import shutil
import tempfile
from dataclasses import dataclass
from pathlib import Path

READ_CSV_PATTERN = re.compile(r"""read_csv\(\s*["']([^"']+\.csv)["']""")
# nbconvert bindet MathJax und require.js von einem CDN ein; das Notebook braucht beides nicht, und die Seite
# soll offline und ohne Anfragen nach außen funktionieren.
EXTERNAL_SCRIPT = re.compile(r"""<script[^>]*\ssrc=["']https?://[^"']*["'][^>]*>\s*</script>""")


@dataclass(frozen=True)
class Report:
    html: str
    error: str | None  # letzte Zeile der Fehlermeldung (Typ: Text), falls eine Zelle abbrach; HTML zeigt bis dahin


def csv_name_in_notebook(notebook) -> str:
    """Dateiname aus dem ersten ``read_csv("...")`` einer Code-Zelle."""
    for cell in notebook.cells:
        if cell.cell_type == "code":
            match = READ_CSV_PATTERN.search(cell.source)
            if match:
                return Path(match.group(1)).name
    raise ValueError("Im Notebook gibt es kein read_csv(\"...csv\") mit festem Dateinamen.")


def _place(csv_path: Path, target: Path) -> None:
    try:
        os.link(csv_path, target)  # gleicher Datenträger: sofort, kein Platzbedarf
    except OSError:
        shutil.copyfile(csv_path, target)


def run_notebook(notebook_path: Path, csv_path: Path, kernel_name: str, cell_timeout_s: int) -> Report:
    import nbformat
    from nbclient import NotebookClient
    from nbclient.exceptions import CellExecutionError
    from nbconvert import HTMLExporter

    notebook = nbformat.read(notebook_path, as_version=nbformat.NO_CONVERT)
    with tempfile.TemporaryDirectory(prefix="emg-analyse-") as workdir:
        _place(csv_path, Path(workdir) / csv_name_in_notebook(notebook))
        client = NotebookClient(notebook, kernel_name=kernel_name, timeout=cell_timeout_s,
                                resources={"metadata": {"path": workdir}})
        error = None
        try:
            client.execute()
        except CellExecutionError as exc:
            lines = [line for line in str(exc).splitlines() if line.strip()]
            error = lines[-1] if lines else "Eine Zelle des Notebooks ist abgebrochen."
    html, _ = HTMLExporter().from_notebook_node(notebook)
    return Report(EXTERNAL_SCRIPT.sub("", html), error)
