"""
vibrantDeck - Adjust color vibrancy of Steam Deck output
Copyright (C) 2022,2023 Sefa Eyeoglu <contact@scrumplex.net> (https://scrumplex.net)

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

import os
import sys
import struct
import subprocess
from typing import Iterable

# Takes 0.0..1.0, 0.5 being sRGB 0.5..1.0 being "boosted"
SDR_GAMUT_PROP = "GAMESCOPE_COLOR_SDR_GAMUT_WIDENESS"
# Brightness/exposure multiplier for SDR content
SDR_INPUT_GAIN_PROP = "GAMESCOPE_SDR_INPUT_GAIN"
# Night mode for color temperature control (3 floats: amount, hue, saturation)
NIGHT_MODE_PROP = "GAMESCOPE_COLOR_NIGHT_MODE"


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

    async def set_vibrancy(self, vibrancy: float):
        vibrancy = max(vibrancy, 0.0)
        vibrancy = min(vibrancy, 1.0)

        return set_cardinal_prop(SDR_GAMUT_PROP, [float_to_long(vibrancy)])

    async def get_vibrancy(self) -> float:
        command = ["xprop", "-root", SDR_GAMUT_PROP]

        if "DISPLAY" not in os.environ:
            command.insert(1, ":1")
            command.insert(1, "-display")

        completed = subprocess.run(command, capture_output=True)
        stdout = completed.stdout.decode("utf-8")

        # Good output: "GAMESCOPE_COLOR_SDR_GAMUT_WIDENESS(CARDINAL) = 1065353216"
        # Bad output: "GAMESCOPE_COLOR_SDR_GAMUT_WIDENESS:  not found."
        if "=" in stdout:

            # "1065353216"
            wideness_param = stdout.split("=")[1]
            # 1065353216
            wideness_param = int(wideness_param)
            # 1.0
            return round(long_to_float(wideness_param), 2)

        return 1.0

    async def set_brightness(self, brightness: float):
        """
        Set brightness/exposure multiplier using SDR input gain.
        brightness: 0.5 to 2.0 (represents 50% to 200%)
        """
        brightness = max(brightness, 0.5)
        brightness = min(brightness, 2.0)

        return set_cardinal_prop(SDR_INPUT_GAIN_PROP, [float_to_long(brightness)])

    async def set_color_temperature(self, temperature: int, intensity: float):
        """
        Set color temperature shift using night mode HSV transformation.
        temperature: -100 to +100 (warm to cool)
                    -100 = red/orange shift (warm)
                    +100 = blue shift (cool)
        intensity: 0.0 to 1.0 (effect strength/amount)
        """
        # Clamp temperature to valid range
        temperature = max(-100, min(100, temperature))
        
        # Map temperature (-100 to +100) to hue rotation
        # We use a smaller range to avoid extreme color shifts
        # -100 = -0.083 (30° warm shift)
        # +100 = +0.083 (30° cool shift)
        hue = (temperature / 100.0) * 0.083
        
        # Clamp intensity
        amount = max(0.0, min(1.0, intensity))
        
        # Saturation at 1.0 maintains color intensity during hue shift
        saturation = 1.0
        
        # Night mode expects 3 floats: [amount, hue, saturation]
        values = [
            float_to_long(amount),
            float_to_long(hue),
            float_to_long(saturation)
        ]
        
        return set_cardinal_prop(NIGHT_MODE_PROP, values)
