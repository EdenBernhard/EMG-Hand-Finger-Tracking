"""Kopiert ein mehrdimensionales .NET-Array (``float[,]``, ``float[,,]``) in ein NumPy-Array.

Elementweiser Zugriff über pythonnet kostet pro Wert einen Aufruf in die .NET-Laufzeit. Stattdessen
wird das Array kurz im Speicher festgehalten (``GCHandle``, Pinned) und als Ganzes kopiert.
.NET legt mehrdimensionale Arrays zeilenweise ab, wie NumPy (C-Reihenfolge).
"""

from __future__ import annotations

import ctypes

import numpy as np


def float_array_to_numpy(net_array) -> np.ndarray:
    """Eigene Kopie als float32 mit Form ``(GetLength(0), ..., GetLength(Rank - 1))``."""
    from System.Runtime.InteropServices import GCHandle, GCHandleType

    shape = tuple(net_array.GetLength(d) for d in range(net_array.Rank))
    out = np.empty(shape, dtype=np.float32)
    if out.size == 0:
        return out
    handle = GCHandle.Alloc(net_array, GCHandleType.Pinned)
    try:
        ctypes.memmove(out.ctypes.data, handle.AddrOfPinnedObject().ToInt64(), out.nbytes)
    finally:
        handle.Free()
    return out
