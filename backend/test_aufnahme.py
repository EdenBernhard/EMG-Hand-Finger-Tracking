"""Funktionstest aus README Schritt 6: 5 s EMG über die .cfg aus EMG and Motion Tools aufnehmen.

Nur zum Testen der Kette Sensor → Receiver → Treiber → wavex, nicht Teil der Pipeline.
Aufruf im Ordner ``backend``: ``python test_aufnahme.py`` (EMG and Motion Tools vorher schließen).
"""

import time
from pathlib import Path

import matplotlib.pyplot as plt
import numpy as np
import wavex

BACKEND_ROOT = Path(__file__).resolve().parent
CONFIG_FILE = BACKEND_ROOT / "config" / "EMGHandMotionToolConfig.cfg"
OUTPUT_FILE = BACKEND_ROOT / "test_aufnahme.npy"
DURATION_S = 5
WARMUP_S = 7  # Anlaufzeit der Sensoren nach StartCapturing, siehe unten
SAMPLING_RATE_HZ = 2000

buffer = []


def on_data(args):
    # args.EmgSamples: NumPy-Array [Kanal, Sample]; kopieren, da der Puffer danach wiederverwendet wird
    buffer.append(args.EmgSamples.copy())


daq = wavex.DaqSystem()
try:
    # Reihenfolge wie im Herstellerbeispiel wavex/test.py: erst Erfassung konfigurieren, dann .cfg laden
    capture_cfg = wavex.CaptureConfiguration()
    capture_cfg.set_emg_acq_p(wavex.enums.EmgAcqPType.Emg_2kHz_Acc_142Hz)  # WavePlus: EMG mit 2000 Hz
    daq.OnDataAvailable(on_data)
    daq.ConfigureCapture(capture_cfg)

    enabled = daq.LoadConfiguration(str(CONFIG_FILE))
    print("Aktivierte EMG-Kanäle:", [i + 1 for i, on in enumerate(enabled["EnabledEfaChannels"]) if on])

    daq.StartCapturing(wavex.enums.DataAvailableEventPeriod.ms_100)
    # Gemessen 2026-10-29: Die Sensoren senden erst ca. 5 s nach dem Start, davor liefert der
    # Receiver nur konstante Werte. Diese Anlaufphase wird verworfen.
    print(f"Warte {WARMUP_S} s, bis die Sensoren senden ...")
    time.sleep(WARMUP_S)
    buffer.clear()
    print(f"Aufnahme läuft {DURATION_S} s – Finger bewegen ...")
    time.sleep(DURATION_S)
    daq.StopCapturing()
finally:
    daq.close()  # Gerät freigeben, auch wenn etwas schiefgeht

if not buffer:
    raise SystemExit("Keine Daten empfangen. Sensoren an? EMG and Motion Tools geschlossen?")

emg = np.concatenate(buffer, axis=1)  # [Kanal, Sample] in µV
print("Form:", emg.shape, f"(erwartet ca. {DURATION_S * SAMPLING_RATE_HZ} Samples pro Kanal)")
np.save(OUTPUT_FILE, emg)
print("Gespeichert:", OUTPUT_FILE)

plt.plot(emg.T)
plt.xlabel(f"Sample ({SAMPLING_RATE_HZ} Hz)")
plt.ylabel("EMG [µV]")
plt.show()
