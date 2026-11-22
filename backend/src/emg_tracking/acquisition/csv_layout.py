"""Spaltenaufbau der Rohdaten-CSV, gleich dem CSV-Export einer C3D-Datei aus EMG and Motion Tools.

``Time``, danach für jeden Sensor 1 bis ``n_sensors`` der Reihe nach: ``Emg_<n>`` (nur für Sensoren in
``emg_sensors``) und ``Acc_<n> :X``, ``Acc_<n> :Y``, ``Acc_<n> :Z``. So lassen sich eigene Messungen und
Aufnahmen aus EMG and Motion Tools mit demselben Code (z. B. dem Notebook in Datenaufbereitung/) auswerten.
Nicht aufgenommene Sensoren stehen wie bei EMG and Motion Tools mit 0 in der Datei.
"""

from __future__ import annotations

from dataclasses import dataclass

TIME_COLUMN = "Time"
AXES = ("X", "Y", "Z")


def emg_column(sensor_id: int) -> str:
    return f"Emg_{sensor_id}"


def acc_column(sensor_id: int, axis: str) -> str:
    return f"Acc_{sensor_id} :{axis}"  # Leerzeichen vor dem Doppelpunkt wie bei EMG and Motion Tools


@dataclass(frozen=True)
class CsvLayout:
    emg_sensors: tuple[int, ...]  # Sensoren mit Emg_-Spalte (in EMG and Motion Tools als EMG konfiguriert)
    n_sensors: int  # Sensoren mit Acc_-Spalten (1 bis n_sensors)

    def __post_init__(self) -> None:
        if any(i < 1 or i > self.n_sensors for i in self.emg_sensors):
            raise ValueError(f"emg_sensors {self.emg_sensors} müssen zwischen 1 und {self.n_sensors} liegen")

    def header(self) -> list[str]:
        columns = [TIME_COLUMN]
        for sensor_id in range(1, self.n_sensors + 1):
            if sensor_id in self.emg_sensors:
                columns.append(emg_column(sensor_id))
            columns.extend(acc_column(sensor_id, axis) for axis in AXES)
        return columns

    def check_recordable(self, sensor_ids: tuple[int, ...]) -> None:
        missing = [i for i in sensor_ids if i not in self.emg_sensors]
        if missing:
            raise ValueError(f"Sensor {missing} hat keine Emg_-Spalte; in [csv] emg_sensors eintragen.")
