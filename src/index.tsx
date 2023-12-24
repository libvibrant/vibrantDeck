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
import {
  loadSettingsFromLocalStorage,
  Settings,
  saveSettingsToLocalStorage,
} from "./settings";
import { RunningApps, Backend, DEFAULT_APP } from "./util";

let settings: Settings;

const Content: VFC<{
  applyFn: (appId: string) => void;
  resetFn: () => void;
  listenModeFn: (enabled: boolean) => void;
}> = ({ applyFn, resetFn, listenModeFn }) => {
  const [initialized, setInitialized] = useState<boolean>(false);

  const [currentEnabled, setCurrentEnabled] = useState<boolean>(true);
  const [currentAppOverride, setCurrentAppOverride] = useState<boolean>(false);
  const [currentAppOverridable, setCurrentAppOverridable] =
    useState<boolean>(false);
  const [currentTargetVibrancy, setCurrentTargetVibrancy] =
    useState<number>(100);

  const refresh = () => {
    // prevent updates while we are reloading
    setInitialized(false);

    setCurrentEnabled(settings.enabled);

    const activeApp = RunningApps.active();
    // does active app have a saved setting
    setCurrentAppOverride(settings.perApp[activeApp]?.hasSettings() || false);
    setCurrentAppOverridable(activeApp != DEFAULT_APP);

    // get configured vibrancy for current app (also Deck UI!)
    setCurrentTargetVibrancy(settings.appVibrancy(activeApp));

    setInitialized(true);
  };

  useEffect(() => {
    if (!initialized || !currentEnabled) return;

    let activeApp = RunningApps.active();
    if (currentAppOverride && currentAppOverridable) {
      console.log(
        `Setting app ${activeApp} to vibrancy ${currentTargetVibrancy}`,
      );
    } else {
      console.log(`Setting global to vibrancy ${currentTargetVibrancy}`);
      activeApp = DEFAULT_APP;
    }
    settings.ensureApp(activeApp).vibrancy = currentTargetVibrancy;
    applyFn(RunningApps.active());

    saveSettingsToLocalStorage(settings);
  }, [currentTargetVibrancy, currentEnabled, initialized]);

  useEffect(() => {
    if (!initialized || !currentEnabled) return;
    applyFn(RunningApps.active());

    saveSettingsToLocalStorage(settings);
  }, [currentEnabled, initialized]);

  useEffect(() => {
    if (!initialized || !currentEnabled) return;

    const activeApp = RunningApps.active();
    if (activeApp == DEFAULT_APP) return;

    console.log(`Setting app ${activeApp} to override ${currentAppOverride}`);

    if (!currentAppOverride) {
      settings.ensureApp(activeApp).vibrancy = undefined;
      setCurrentTargetVibrancy(settings.appVibrancy(DEFAULT_APP));
    }
    saveSettingsToLocalStorage(settings);
  }, [currentAppOverride, currentEnabled, initialized]);

  useEffect(() => {
    if (!initialized) return;

    listenModeFn(currentEnabled);

    if (!currentEnabled) resetFn();

    settings.enabled = currentEnabled;
    saveSettingsToLocalStorage(settings);
  }, [currentEnabled, initialized]);

  useEffect(() => {
    refresh();
  }, []);

  return (
    <div>
      <PanelSection title="General">
        <PanelSectionRow>
          <ToggleField
            label="Enable color settings"
            checked={currentEnabled}
            onChange={(enabled) => {
              setCurrentEnabled(enabled);
            }}
          />
        </PanelSectionRow>
      </PanelSection>
      {currentEnabled && (
        <PanelSection title="Profile">
          <PanelSectionRow>
            <ToggleField
              label="Use per-game profile"
              description={
                "Currently using " +
                (currentAppOverride && currentAppOverridable
                  ? "per-app"
                  : "global") +
                " profile"
              }
              checked={currentAppOverride && currentAppOverridable}
              disabled={!currentAppOverridable}
              onChange={(override) => {
                setCurrentAppOverride(override);
              }}
            />
          </PanelSectionRow>
          <PanelSectionRow>
            <SliderField
              label="Vibrancy"
              description="Control the vibrancy of the display"
              value={currentTargetVibrancy}
              step={1}
              max={200}
              min={0}
              showValue={true}
              onChange={(vibrancy: number) => {
                setCurrentTargetVibrancy(vibrancy);
              }}
            />
          </PanelSectionRow>
        </PanelSection>
      )}
    </div>
  );
};

export default definePlugin((serverAPI: ServerAPI) => {
  // load settings
  settings = loadSettingsFromLocalStorage();

  const backend = new Backend(serverAPI);
  const runningApps = new RunningApps();

  const applySettings = (appId: string) => {
    const vibrancy = settings.appVibrancy(appId);
    backend.applyVibrancy(vibrancy);
  };

  const resetSettings = () => {
    // NOTE: This code ignores night mode as we don't have a good way to interface with it.
    console.log("Resetting color values to defaults");
    backend.applyVibrancy(100);
  };

  const listenForRunningApps = (enabled: boolean) => {
    if (enabled) {
      console.log("Listening for actively running apps");
      runningApps.register();
    } else {
      console.log("Stopped listening for actively running apps");
      runningApps.unregister();
    }
  };

  // apply initially
  if (settings.enabled) {
    applySettings(RunningApps.active());
  }

  runningApps.listenActiveChange(() => applySettings(RunningApps.active()));
  listenForRunningApps(settings.enabled);

  return {
    title: <div className={staticClasses.Title}>vibrantDeck</div>,
    content: (
      <Content
        applyFn={applySettings}
        resetFn={resetSettings}
        listenModeFn={listenForRunningApps}
      />
    ),
    icon: <FaEyeDropper />,
    onDismount() {
      runningApps.unregister();
      // reset color settings to default values
      resetSettings();
    },
  };
});
