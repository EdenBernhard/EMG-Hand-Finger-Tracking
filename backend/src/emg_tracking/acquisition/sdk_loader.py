"""Lädt das .NET-SDK von Cometa (Waveplus.DaqSys) über pythonnet.

Das SDK ist eine .NET-Framework-Bibliothek; pythonnet startet dafür die .NET-Framework-Laufzeit
("netfx") im Python-Prozess. Danach sind die SDK-Klassen wie Python-Klassen nutzbar.
"""

from __future__ import annotations

import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any

REQUIRED_FILES = ("Waveplus.DaqSys.dll", "Waveplus.DaqSysInterface.dll", "CyUSB.dll")
DOTNET_RUNTIME = "netfx"  # das SDK zielt auf .NET Framework 4.6.1, nicht auf .NET (Core)


@dataclass(frozen=True)
class WaveplusSdk:
    """Die Klassen und Aufzählungen des SDK, die die Erfassung braucht."""

    DaqSystem: Any
    CaptureConfiguration: Any
    SensorConfiguration: Any
    DeviceState: Any
    SamplingRate: Any
    DataAvailableEventPeriod: Any
    SensorType: Any
    AccelerometerFullScale: Any
    version: str  # Assembly-Version von Waveplus.DaqSys, z. B. "5.0.7.0"


def _start_runtime() -> None:
    import pythonnet

    if pythonnet.get_runtime_info() is None:  # nur einmal pro Prozess möglich
        pythonnet.load(DOTNET_RUNTIME)


def load_sdk(sdk_dir: Path) -> WaveplusSdk:
    missing = [name for name in REQUIRED_FILES if not (sdk_dir / name).exists()]
    if missing:
        raise FileNotFoundError(
            f"SDK-Dateien fehlen in {sdk_dir}: {', '.join(missing)}. "
            "Die DLLs aus dem Cometa-SDK (bin/NET.4.6.1) dorthin kopieren, siehe README."
        )
    _start_runtime()
    import clr  # erst nach dem Start der Laufzeit importierbar

    if str(sdk_dir) not in sys.path:
        sys.path.append(str(sdk_dir))  # dort sucht clr.AddReference nach den Assemblies
    clr.AddReference("Waveplus.DaqSys")
    clr.AddReference("Waveplus.DaqSysInterface")

    from System.Reflection import AssemblyName
    from Waveplus.DaqSys import CaptureConfiguration, DaqSystem, SensorConfiguration
    from Waveplus.DaqSysInterface import (
        AccelerometerFullScale,
        DataAvailableEventPeriod,
        DeviceState,
        SamplingRate,
    )
    from WaveplusLab.Shared.Definitions import SensorType

    version = AssemblyName.GetAssemblyName(str(sdk_dir / REQUIRED_FILES[0])).Version.ToString()
    return WaveplusSdk(
        DaqSystem=DaqSystem,
        CaptureConfiguration=CaptureConfiguration,
        SensorConfiguration=SensorConfiguration,
        DeviceState=DeviceState,
        SamplingRate=SamplingRate,
        DataAvailableEventPeriod=DataAvailableEventPeriod,
        SensorType=SensorType,
        AccelerometerFullScale=AccelerometerFullScale,
        version=version,
    )
