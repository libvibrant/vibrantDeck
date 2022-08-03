/*!
 * vibrantDeck - Adjust color vibrancy of Steam Deck output
 * Copyright (C) 2022 Sefa Eyeoglu <contact@scrumplex.net> (https://scrumplex.net)
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

import {
  definePlugin,
  PanelSection,
  PanelSectionRow,
  SliderField,
  ServerAPI,
  ToggleField,
  staticClasses,
} from "decky-frontend-lib";
import { VFC, useState, useEffect } from "react";
import { FaEyeDropper } from "react-icons/fa";

// Appease TypeScript
declare var SteamClient: any;

interface SaturationArgs {
  saturation: number
}

const keyInGameOnly = "vibrantDeck_inGameOnly";
const keySaturation = "vibrantDeck_saturation";
let lastInGameOnly: boolean = true;
let lastSaturation: number = 100;

let lifetimeHook: any = null;
let runningGames: number[] = [];

const applySaturation = (serverAPI: ServerAPI, saturation: number) => {
  console.log("Applying saturation " + saturation.toString());
  serverAPI.callPluginMethod<SaturationArgs, boolean>("set_saturation", {"saturation": saturation / 100.0});
};

const Content: VFC<{ serverAPI: ServerAPI }> = ({serverAPI}) => {
  const [currentInGameOnly, setCurrentInGameOnly] = useState<boolean>(lastInGameOnly);
  const [currentSaturation, setCurrentSaturation] = useState<number>(lastSaturation);

  useEffect(() => {
    console.log("Setting inGameOnly " + currentInGameOnly.toString());
    lastInGameOnly = currentInGameOnly;
    localStorage.setItem(keyInGameOnly, currentInGameOnly.toString());
  }, [currentInGameOnly]);

  useEffect(() => {
    console.log("Setting saturation " + currentSaturation.toString());
    lastSaturation = currentSaturation;
    localStorage.setItem(keySaturation, currentSaturation.toString());
  }, [currentSaturation]);

  return (
    <PanelSection title="Control">
      <PanelSectionRow>
        <ToggleField
          label="In-Game only"
          description="Only apply saturation while a game is running"
          checked={currentInGameOnly}
          onChange={(inGameOnly) => {
            setCurrentInGameOnly(inGameOnly);

            // apply target saturation, if in-game-only is off, or if we are in a game either way
            applySaturation(serverAPI, !inGameOnly || runningGames.length > 0 ? currentSaturation : 100);
          }}
        />
      </PanelSectionRow>
      <PanelSectionRow>
        <SliderField
          label="Saturation"
          description="Control the saturation of the display"
          value={currentSaturation}
          step={5}
          max={400}
          min={0}
          showValue={true}
          onChange={(saturation: number) => {
            setCurrentSaturation(saturation);

            // apply target saturation, if in-game-only is off, or if we are in a game either way
            if (!currentInGameOnly || runningGames.length > 0)
              applySaturation(serverAPI, saturation);
          }}
        />
      </PanelSectionRow>
    </PanelSection>
  );
};

export default definePlugin((serverApi: ServerAPI) => {
  // load settings
  const localInGameOnly = localStorage.getItem(keyInGameOnly);
  const localSaturation = localStorage.getItem(keySaturation);

  if (localInGameOnly != null)
    lastInGameOnly = localInGameOnly == "true";
  try {
    if (localSaturation != null)
      lastSaturation = parseInt(localSaturation);
  } catch {}

  console.debug(`Initial settings inGameOnly=${lastInGameOnly} saturation=${lastSaturation}`);

  lifetimeHook = SteamClient.GameSessions.RegisterForAppLifetimeNotifications((update: any) => {
    if (update.bRunning) {
      runningGames.push(update.unAppID);
    } else {
      const index: number = runningGames.indexOf(update.unAppID);
      if (index >= 0)
        runningGames.splice(index, 1);
      else
        console.warn(`Unexpected end of application with appId ${update.unAppID}, instanceId ${update.nInstanceID}`);
    }
    if (lastInGameOnly)
      applySaturation(serverApi, runningGames.length > 0 ? lastSaturation : 100);
  });

  // apply saturation initially if user wants it always on
  if (!lastInGameOnly) {
    applySaturation(serverApi, lastSaturation);
  }

  return {
    title: <div className={staticClasses.Title}>vibrantDeck</div>,
    content: <Content serverAPI={serverApi} />,
    icon: <FaEyeDropper />,
    onDismount() {
      lifetimeHook!.unregister();
      applySaturation(serverApi, 100); // reset saturation if we won't be running anymore
    }
  };
});
