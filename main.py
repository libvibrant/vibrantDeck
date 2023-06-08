"""
vibrantDeck - Adjust color vibrancy of Steam Deck output
Copyright (C) 2022 Sefa Eyeoglu <contact@scrumplex.net> (https://scrumplex.net)

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
"""

import glob
import os
import sys
import struct
import subprocess
from typing import List, Iterable

CTM_PROP = "GAMESCOPE_COLOR_MATRIX"
GAMMA_LGAIN_BLEND_PROP = "GAMESCOPE_COLOR_LINEARGAIN_BLEND"
GAMMA_LGAIN_PROP = "GAMESCOPE_COLOR_LINEARGAIN"
GAMMA_GAIN_PROP = "GAMESCOPE_COLOR_GAIN"


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


def set_cardinal_prop(prop_name: str, values: Iterable[int]):

    param = ",".join(map(str, values))

    command = ["xprop", "-root", "-f", prop_name,
               "32c", "-set", prop_name, param]

    if "DISPLAY" not in os.environ:
        command.insert(1, ":1")
        command.insert(1, "-display")

    completed = subprocess.run(command, stderr=sys.stderr, stdout=sys.stdout)

    return completed.returncode == 0


class Plugin:

    async def set_saturation(self, saturation: float):
        saturation = max(saturation, 0.0)
        saturation = min(saturation, 4.0)

        # Generate color transformation matrix
        coeffs = saturation_to_coeffs(saturation)

        # represent floats as longs
        long_coeffs = map(float_to_long, coeffs)

        return set_cardinal_prop(CTM_PROP, long_coeffs)

    # values = 3 floats, R, G and B values respectively
    async def set_gamma_linear_gain(self, values: List[float]):
        long_values = map(float_to_long, values)

        return set_cardinal_prop(GAMMA_LGAIN_PROP, long_values)

    # values = 3 floats, R, G and B values respectively
    async def set_gamma_gain(self, values: List[float]):
        long_values = map(float_to_long, values)

        return set_cardinal_prop(GAMMA_GAIN_PROP, long_values)

    # value = weight of lineargain (1.0 means that only linear gain is used) (0.0 <= value <= 1.0)
    async def set_gamma_linear_gain_blend(self, value: float):
        long_value = float_to_long(value)

        return set_cardinal_prop(GAMMA_LGAIN_BLEND_PROP, [long_value])

    # TODO make this generic
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
            long_coeffs = list(map(int, ctm_param.split(",")))
            # [1.0, 0, 0, 0, 1.0, 0, 0, 0, 1.0]
            coeffs = list(map(long_to_float, long_coeffs))
            # 1.0
            saturation = round(coeffs[0] - coeffs[1], 2)

            return saturation

        return 1.0
    
    async def get_displays(self) -> List[str]:
        displays = []
        display_status_files = glob.glob("/sys/class/drm/*/status")
        for filename in display_status_files:
            with open(filename) as f:
                status = f.read()
                if status.startswith("connected"):
                    displays.append(filename.split('/')[4])

        return displays