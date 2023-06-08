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
  GammaSetting,
} from "./settings";
import {
  RunningApps,
  Backend,
  DEFAULT_APP,
  ExternalDisplayState,
} from "./util";

// Appease TypeScript
declare var SteamClient: any;

let settings: Settings;

const Content: VFC<{
  applyFn: (appId: string, external: boolean) => void;
  resetFn: () => void;
  listenModeFn: (enabled: boolean) => void;
  externalDisplayState: ExternalDisplayState;
}> = ({ applyFn, resetFn, listenModeFn, externalDisplayState }) => {
  const [initialized, setInitialized] = useState<boolean>(false);

  const [currentEnabled, setCurrentEnabled] = useState<boolean>(true);
  const [currentAppOverride, setCurrentAppOverride] = useState<boolean>(false);
  const [currentAppOverridable, setCurrentAppOverridable] =
    useState<boolean>(false);
  const [currentTargetSaturation, setCurrentTargetSaturation] =
    useState<number>(100);
  const [currentTargetGammaLinear, setCurrentTargetGammaLinear] =
    useState<boolean>(true);
  const [currentAdvancedSettings, setCurrentAdvancedSettings] =
    useState<boolean>(false);
  const [currentTargetGammaRed, setCurrentTargetGammaRed] =
    useState<number>(100);
  const [currentTargetGammaGreen, setCurrentTargetGammaGreen] =
    useState<number>(100);
  const [currentTargetGammaBlue, setCurrentTargetGammaBlue] =
    useState<number>(100);
  const [currentHasExternalDisplay, setCurrentHasExternalDisplay] =
    useState<boolean>(false);

  const refresh = () => {
    // prevent updates while we are reloading
    setInitialized(false);
    const external = externalDisplayState.current();
    setCurrentHasExternalDisplay(external);
    setCurrentEnabled(settings.getEnabled(external));
    setCurrentAdvancedSettings(settings.advancedSettingsUI);

    const activeApp = RunningApps.active();
    const appDict = external ? settings.externalPerApp : settings.perApp;
    // does active app have a saved setting
    setCurrentAppOverride(appDict[activeApp]?.hasSettings() || false);
    setCurrentAppOverridable(activeApp != DEFAULT_APP);

    // get configured saturation for current app (also Deck UI!)
    setCurrentTargetSaturation(settings.appSaturation(activeApp, external));
    setCurrentTargetGammaLinear(settings.appGamma(activeApp, external).linear);
    setCurrentTargetGammaRed(settings.appGamma(activeApp, external).gainR);
    setCurrentTargetGammaGreen(settings.appGamma(activeApp, external).gainG);
    setCurrentTargetGammaBlue(settings.appGamma(activeApp, external).gainB);

    setInitialized(true);
  };

  useEffect(() => {
    if (!initialized || !currentEnabled) return;

    let activeApp = RunningApps.active();
    if (currentAppOverride && currentAppOverridable) {
      console.log(
        `Setting app ${activeApp} to saturation ${currentTargetSaturation}`
      );
    } else {
      console.log(`Setting global to saturation ${currentTargetSaturation}`);
      activeApp = DEFAULT_APP;
    }

    settings.ensureApp(activeApp, currentHasExternalDisplay).saturation = currentTargetSaturation;
    
    applyFn(RunningApps.active(), currentHasExternalDisplay);

    saveSettingsToLocalStorage(settings);
  }, [currentTargetSaturation, currentEnabled, initialized]);

  useEffect(() => {
    if (!initialized || !currentEnabled) return;

    let activeApp = RunningApps.active();
    if (currentAppOverride && currentAppOverridable) {
      console.log(
        `Setting app ${activeApp} to${
          currentTargetGammaLinear ? " linear" : ""
        } gamma ${currentTargetGammaRed} ${currentTargetGammaGreen} ${currentTargetGammaBlue}`
      );
    } else {
      console.log(
        `Setting global to${
          currentTargetGammaLinear ? " linear" : ""
        } gamma ${currentTargetGammaRed} ${currentTargetGammaGreen} ${currentTargetGammaBlue}`
      );
      activeApp = DEFAULT_APP;
    }

    const gamma =  settings.ensureApp(activeApp, currentHasExternalDisplay).ensureGamma();
    gamma.linear = currentTargetGammaLinear;
    gamma.gainR = currentTargetGammaRed;
    gamma.gainG = currentTargetGammaGreen;
    gamma.gainB = currentTargetGammaBlue;
    settings.advancedSettingsUI = currentAdvancedSettings;
    applyFn(RunningApps.active(), currentHasExternalDisplay);

    saveSettingsToLocalStorage(settings);
  }, [
    currentTargetGammaLinear,
    currentTargetGammaRed,
    currentTargetGammaGreen,
    currentTargetGammaBlue,
    currentEnabled,
    currentAdvancedSettings,
    initialized,
  ]);

  useEffect(() => {
    if (!initialized || !currentEnabled) return;

    const activeApp = RunningApps.active();
    if (activeApp == DEFAULT_APP) return;

    console.log(`Setting app ${activeApp} to override ${currentAppOverride}`);

    if (!currentAppOverride) {
      settings.ensureApp(activeApp, false).saturation = undefined;
      settings.ensureApp(activeApp, false).gamma = undefined;
      settings.ensureApp(activeApp, true).saturation = undefined;
      settings.ensureApp(activeApp, true).gamma = undefined;
      setCurrentTargetSaturation(settings.appSaturation(DEFAULT_APP, currentHasExternalDisplay));
      setCurrentTargetGammaLinear(settings.appGamma(DEFAULT_APP, currentHasExternalDisplay).linear);
      setCurrentTargetGammaRed(settings.appGamma(DEFAULT_APP, currentHasExternalDisplay).gainR);
      setCurrentTargetGammaGreen(settings.appGamma(DEFAULT_APP, currentHasExternalDisplay).gainG);
      setCurrentTargetGammaBlue(settings.appGamma(DEFAULT_APP, currentHasExternalDisplay).gainB);
    }
    saveSettingsToLocalStorage(settings);
  }, [currentAppOverride, currentEnabled, initialized]);

  useEffect(() => {
    if (!initialized) return;

    listenModeFn(currentEnabled || settings.getEnabled(!currentHasExternalDisplay));

    if (!currentEnabled) resetFn();

    settings.setEnabled(currentHasExternalDisplay, currentEnabled);
    saveSettingsToLocalStorage(settings);
  }, [currentEnabled, initialized]);

  useEffect(() => {
    if (!initialized) return;
    externalDisplayState.listenChange((newValue) => {
      setCurrentHasExternalDisplay(newValue);
      refresh();
    })
  }, [initialized, externalDisplayState]);

  useEffect(() => {
    refresh();
  }, []);

  return (
    <div>
      <PanelSection title={
            currentHasExternalDisplay ? "External Display" : "Internal Display"
          }>
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
              label="Saturation"
              description="Control the saturation of the display"
              value={currentTargetSaturation}
              step={1}
              max={400}
              min={0}
              showValue={true}
              onChange={(saturation: number) => {
                setCurrentTargetSaturation(saturation);
              }}
            />
          </PanelSectionRow>
          <PanelSectionRow>
            <ToggleField
              label="Linear Gamma Gain"
              description={"Use linear gamma scale"}
              checked={currentTargetGammaLinear}
              onChange={(linear) => {
                setCurrentTargetGammaLinear(linear);
              }}
            />
          </PanelSectionRow>
          <PanelSectionRow>
            <ToggleField
              label="Advanced Settings"
              description={"Enable advanced settings"}
              checked={currentAdvancedSettings}
              onChange={(advancedSettings) => {
                setCurrentTargetGammaGreen(currentTargetGammaRed);
                setCurrentTargetGammaBlue(currentTargetGammaRed);
                setCurrentAdvancedSettings(advancedSettings);
              }}
            />
          </PanelSectionRow>
          {!currentAdvancedSettings && (
            <PanelSectionRow>
              <SliderField
                label="Gamma"
                description={`Control${
                  currentTargetGammaLinear ? " linear" : ""
                } gamma gain`}
                value={currentTargetGammaRed}
                step={1}
                max={900}
                min={-50}
                resetValue={100}
                showValue={true}
                onChange={(value: number) => {
                  setCurrentTargetGammaRed(value);
                  setCurrentTargetGammaGreen(value);
                  setCurrentTargetGammaBlue(value);
                }}
              />
            </PanelSectionRow>
          )}
          {currentAdvancedSettings && (
            <div>
              <PanelSectionRow>
                <SliderField
                  label="Gamma Red"
                  description={`Control${
                    currentTargetGammaLinear ? " linear" : ""
                  } gamma gain for red`}
                  value={currentTargetGammaRed}
                  step={1}
                  max={900}
                  min={-50}
                  resetValue={100}
                  showValue={true}
                  onChange={(value: number) => {
                    setCurrentTargetGammaRed(value);
                  }}
                />
              </PanelSectionRow>
              <PanelSectionRow>
                <SliderField
                  label="Gamma Green"
                  description={`Control${
                    currentTargetGammaLinear ? " linear" : ""
                  } gamma gain for green´`}
                  value={currentTargetGammaGreen}
                  step={1}
                  max={900}
                  min={-50}
                  resetValue={100}
                  showValue={true}
                  onChange={(value: number) => {
                    setCurrentTargetGammaGreen(value);
                  }}
                />
              </PanelSectionRow>
              <PanelSectionRow>
                <SliderField
                  label="Gamma Blue"
                  description={`Control${
                    currentTargetGammaLinear ? " linear" : ""
                  } gamma gain for blue`}
                  value={currentTargetGammaBlue}
                  step={1}
                  max={900}
                  min={-50}
                  resetValue={100}
                  showValue={true}
                  onChange={(value: number) => {
                    setCurrentTargetGammaBlue(value);
                  }}
                />
              </PanelSectionRow>
            </div>
          )}
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
  const externalDisplayState = new ExternalDisplayState(backend);

  const applySettings = (appId: string, external: boolean) => {
    const saturation = settings.appSaturation(appId, external);
    backend.applySaturation(saturation);
    const gamma = settings.appGamma(appId, external);
    backend.applyGamma(gamma);
  };

  const resetSettings = () => {
    // NOTE: This code ignores night mode as we don't have a good way to interface with it.
    console.log("Resetting color values to defaults");
    backend.applySaturation(100);
    backend.applyGamma(new GammaSetting());
  };

  const listenForChanges = (enabled: boolean) => {
    if (enabled) {
      console.log("Listening for actively running apps");
      runningApps.register();
      externalDisplayState.register();
    } else {
      console.log("Stopped listening for actively running apps");
      runningApps.unregister();
      externalDisplayState.unregister();
    }
  };

  // apply initially
  if (settings.getEnabled(externalDisplayState.current())) {
    applySettings(RunningApps.active(), externalDisplayState.current());
  }

  runningApps.listenActiveChange(() => applySettings(RunningApps.active(), externalDisplayState.current()));
  externalDisplayState.listenChange(() => applySettings(RunningApps.active(), externalDisplayState.current()));
  listenForChanges(settings.getEnabled(true) || settings.getEnabled(false));

  return {
    title: <div className={staticClasses.Title}>vibrantDeck</div>,
    content: (
      <Content
        applyFn={applySettings}
        resetFn={resetSettings}
        listenModeFn={listenForChanges}
        externalDisplayState={externalDisplayState}
      />
    ),
    icon: <FaEyeDropper />,
    onDismount() {
      runningApps.unregister();
      externalDisplayState.unregister();
      // reset color settings to default values
      resetSettings();
    },
  };
});
