"""Erkennung der Anlaufphase des Cometa-Receivers.

Nach ``StartCapturing`` liefert der Receiver einige Sekunden lang (gemessen 2026-10-29: ca. 5 s)
pro Kanal nur einen eingefrorenen Wert, bevor der jeweilige Sensor tatsächlich sendet. Die
Sensoren starten dabei nicht gleichzeitig. Diese Samples sind keine Messwerte und werden verworfen.
"""

from __future__ import annotations

import numpy as np


class StartupGate:
    """Lässt Samples erst durch, wenn jeder Kanal seinen eingefrorenen Startwert verlassen hat.

    Der eingefrorene Wert eines Kanals ist sein allererstes Sample. Die Aufnahme beginnt mit dem
    ersten Sample, ab dem alle Kanäle senden; danach wird alles unverändert durchgelassen.
    """

    def __init__(self) -> None:
        self.is_open = False
        self.discarded_samples = 0
        self._frozen: np.ndarray | None = None
        self._live: np.ndarray | None = None

    def silent_channels(self) -> list[int]:
        """Zeilenindizes der Kanäle, die noch keinen echten Messwert geliefert haben."""
        if self.is_open:
            return []
        if self._live is None:
            return []  # noch kein Event, keine Aussage möglich
        return [int(i) for i in np.flatnonzero(~self._live)]

    def admit(self, samples: np.ndarray) -> np.ndarray:
        """Gibt die durchzulassenden Samples zurück (Form ``(kanäle, n)``, ``n`` ggf. 0)."""
        if self.is_open:
            return samples
        if self._frozen is None:
            self._frozen = samples[:, 0].copy()
            self._live = np.zeros(samples.shape[0], dtype=bool)

        start = 0
        for ch in np.flatnonzero(~self._live):
            changed = np.flatnonzero(samples[ch] != self._frozen[ch])
            if changed.size:
                self._live[ch] = True
                start = max(start, int(changed[0]))

        if not self._live.all():
            self.discarded_samples += samples.shape[1]
            return samples[:, :0]
        self.is_open = True
        self.discarded_samples += start
        return samples[:, start:]
