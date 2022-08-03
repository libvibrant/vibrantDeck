import os
import sys
import struct
import subprocess
from typing import List

CTM_PROP = "GAMESCOPE_COLOR_MATRIX"

def saturation_to_coeffs(saturation: float) -> List[float]:
    coeff = (1.0 - saturation) / 3.0

    coeffs = [coeff] * 9
    coeffs[0] += saturation
    coeffs[4] += saturation
    coeffs[8] += saturation
    return coeffs

def float_to_long(x: float) -> int:
    return struct.unpack("!I", struct.pack("!f", x))[0]

def long_to_float(x: int) -> float:
    return struct.unpack("!f", struct.pack("!I", x))[0]

class Plugin:

    async def set_saturation(self, saturation: float):
        saturation = max(saturation, 0.0)
        saturation = min(saturation, 4.0)

        # Generate color transformation matrix
        coeffs = saturation_to_coeffs(saturation)

        # represent floats as longs
        long_coeffs = map(str, map(float_to_long, coeffs))
        # concatenate longs to comma-separated list for xprop
        ctm_param = ",".join(list(long_coeffs))

        command = ["xprop", "-root", "-f", CTM_PROP, "32c", "-set", CTM_PROP, ctm_param]

        if "DISPLAY" not in os.environ:
            command.insert(1, ":1")
            command.insert(1, "-display")

        completed = subprocess.run(command, stderr=sys.stderr, stdout=sys.stdout)

        return completed.returncode == 0

    async def get_saturation(self) -> float:
        command = ["xprop", "-root", CTM_PROP]

        if "DISPLAY" not in os.environ:
            command.insert(1, ":1")
            command.insert(1, "-display")

        completed = subprocess.run(command, capture_output=True)
        stdout = completed.stdout.decode("utf-8")

        # Good output: "GAMESCOPE_COLOR_MATRIX(CARDINAL) = 1065353216, 0, 0, 0, 1065353216, 0, 0, 0, 1065353216"
        # Bad output: "GAMESCOPE_COLOR_MATRIX:  not found."
        if "=" in stdout:

            # "1065353216, 0, 0, 0, 1065353216, 0, 0, 0, 1065353216"
            ctm_param = stdout.split("=")[1]
            # [1065353216, 0, 0, 0, 1065353216, 0, 0, 0, 1065353216]
            long_coeffs = list(map(int, ctm_param.split(",")));
            # [1.0, 0, 0, 0, 1.0, 0, 0, 0, 1.0]
            coeffs = list(map(long_to_float, long_coeffs))
            # 1.0
            saturation = round(coeffs[0] - coeffs[1], 2)

            return saturation

        return 1.0
