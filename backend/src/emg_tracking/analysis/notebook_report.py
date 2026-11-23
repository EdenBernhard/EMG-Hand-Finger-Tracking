"""Führt ein Analyse-Notebook unverändert mit der CSV einer Aufnahme aus und macht daraus eine HTML-Seite.

Das Notebook liest den Pfad der Aufnahme aus der Umgebungsvariable ``CSV_ENV_VAR`` (ohne sie wertet es
seine eigene Voreinstellung aus). Übergeben wird der absolute Pfad, damit das Notebook auch die
Nebendateien der Aufnahme findet (``.protocol.json``, ``.cues.csv``). Arbeitsordner ist ein leerer
temporärer Ordner, damit das Notebook nichts ins Repo schreibt.
Die Notebook-Datei wird nur gelesen, nie geschrieben; Kernel und Ausgaben gibt es nur im Speicher.
"""

from __future__ import annotations

import os
import re
import tempfile
from dataclasses import dataclass
from pathlib import Path

CSV_ENV_VAR = "EMG_ANALYSIS_CSV"
# nbconvert bindet MathJax und require.js von einem CDN ein; das Notebook braucht beides nicht, und die Seite
# soll offline und ohne Anfragen nach außen funktionieren.
EXTERNAL_SCRIPT = re.compile(r"""<script[^>]*\ssrc=["']https?://[^"']*["'][^>]*>\s*</script>""")


@dataclass(frozen=True)
class Report:
    html: str
    error: str | None  # letzte Zeile der Fehlermeldung (Typ: Text), falls eine Zelle abbrach; HTML zeigt bis dahin


def run_notebook(notebook_path: Path, csv_path: Path, kernel_name: str, cell_timeout_s: int) -> Report:
    import nbformat
    from nbclient import NotebookClient
    from nbclient.exceptions import CellExecutionError
    from nbconvert import HTMLExporter

    notebook = nbformat.read(notebook_path, as_version=nbformat.NO_CONVERT)
    kernel_env = {**os.environ, CSV_ENV_VAR: str(csv_path.resolve())}
    with tempfile.TemporaryDirectory(prefix="emg-analyse-") as workdir:
        client = NotebookClient(notebook, kernel_name=kernel_name, timeout=cell_timeout_s,
                                resources={"metadata": {"path": workdir}})
        error = None
        try:
            client.execute(env=kernel_env)  # wird an start_kernel des Kernel-Managers durchgereicht
        except CellExecutionError as exc:
            lines = [line for line in str(exc).splitlines() if line.strip()]
            error = lines[-1] if lines else "Eine Zelle des Notebooks ist abgebrochen."
    html, _ = HTMLExporter().from_notebook_node(notebook)
    return Report(EXTERNAL_SCRIPT.sub("", html), error)
