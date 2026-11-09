
import ezc3d
import pandas as pd
import numpy as np

# Load C3D file
c3d = ezc3d.c3d("Testlauf_2_Sensoren567.c3d")

# Extract analog data
analog = c3d["data"]["analogs"][0]

# Get channel names
labels = c3d["parameters"]["ANALOG"]["LABELS"]["value"]

# Create timestamps
sampling_rate = (
    c3d["parameters"]["POINT"]["RATE"]["value"][0]
    * c3d["parameters"]["ANALOG"]["GEN_SCALE"]["value"][0]
    * 0 + 2000
)

timestamps = np.arange(analog.shape[1]) / sampling_rate

# Create DataFrame
df = pd.DataFrame(
    analog.T,
    columns=labels
)

df.insert(0, "Time", timestamps)

# Export CSV
df.to_csv("Testlauf_2_Sensoren567.csv", index=False)

print(df.head())
print("Shape:", df.shape)

