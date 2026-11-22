"""Impedanz-Check der Elektroden über das SDK (``DaqSystem.CheckElectrodeImpedance``).

Das SDK liefert je Sensor nur ein ``SensorCheckReport`` (Passed, Failed, NotExecuted), keinen
Widerstandswert. Laut Handbuch von EMG and Motion Tools gilt der Check als bestanden, wenn die
Impedanz unter der werkseitigen Schwelle von 100 kΩ liegt.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Sequence

from emg_tracking.acquisition.device import open_daq
from emg_tracking.acquisition.sdk_loader import WaveplusSdk

PASSED = "Passed"
THRESHOLD_OHM = 100_000  # nur zur Dokumentation; die Schwelle steckt im Sensor, nicht im SDK-Aufruf


@dataclass(frozen=True)
class ImpedanceResult:
    sensor_id: int
    report: str  # Name des SensorCheckReport: Passed, Failed oder NotExecuted

    @property
    def passed(self) -> bool:
        return self.report == PASSED

    def to_dict(self) -> dict[str, Any]:
        return {"sensor_id": self.sensor_id, "report": self.report, "passed": self.passed}


def _report_for(reports: Any, sensor_id: int) -> str:
    """Das SDK gibt ein Array zurück: entweder nur für den geprüften Sensor oder eines je
    installiertem Sensor (dann an Position sensor_id - 1)."""
    reports = list(reports)
    if len(reports) == 1:
        return str(reports[0])
    if len(reports) >= sensor_id:
        return str(reports[sensor_id - 1])
    raise RuntimeError(f"Impedanz-Check: kein Ergebnis für Sensor {sensor_id} ({len(reports)} Einträge)")


def check_impedance(sdk: WaveplusSdk, sensor_ids: Sequence[int], ready_timeout_s: float) -> tuple[ImpedanceResult, ...]:
    """Prüft die Sensoren nacheinander und gibt den Receiver danach wieder frei."""
    daq = open_daq(sdk, ready_timeout_s)
    try:
        installed = daq.InstalledSensors
        if max(sensor_ids) > installed:
            raise RuntimeError(f"Sensor {max(sensor_ids)} gewählt, der Receiver kennt nur {installed} Sensoren.")
        return tuple(ImpedanceResult(i, _report_for(daq.CheckElectrodeImpedance(i), i)) for i in sensor_ids)
    finally:
        daq.Dispose()
