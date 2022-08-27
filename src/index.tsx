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
import { loadSettingsFromLocalStorage, Settings, saveSettingsToLocalStorage, GammaSetting } from "./settings";
import { RunningApps, Backend, DEFAULT_APP } from "./util";

// Appease TypeScript
declare var SteamClient: any;

let settings: Settings;

const Content: VFC<{ runningApps: RunningApps, applyFn: (appId: string) => void }> = ({ runningApps, applyFn }) => {
  const [initialized, setInitialized] = useState<boolean>(false);

  const [currentAppOverride, setCurrentAppOverride] = useState<boolean>(false);
  const [currentAppOverridable, setCurrentAppOverridable] = useState<boolean>(false);
  const [currentTargetSaturation, setCurrentTargetSaturation] = useState<number>(100);
  const [currentTargetGammaLinear, setCurrentTargetGammaLinear] = useState<boolean>(true);
  const [currentTargetGammaRed, setCurrentTargetGammaRed] = useState<number>(100);
  const [currentTargetGammaGreen, setCurrentTargetGammaGreen] = useState<number>(100);
  const [currentTargetGammaBlue, setCurrentTargetGammaBlue] = useState<number>(100);

  const refresh = () => {
    const activeApp = RunningApps.active();
    // does active app have a saved setting
    setCurrentAppOverride(settings.perApp[activeApp]?.hasSettings() || false);
    setCurrentAppOverridable(activeApp != DEFAULT_APP);

    // get configured saturation for current app (also Deck UI!)
    setCurrentTargetSaturation(settings.appSaturation(activeApp));
    setCurrentTargetGammaLinear(settings.appGamma(activeApp).linear);
    setCurrentTargetGammaRed(settings.appGamma(activeApp).gain_r);
    setCurrentTargetGammaGreen(settings.appGamma(activeApp).gain_g);
    setCurrentTargetGammaBlue(settings.appGamma(activeApp).gain_b);

    setInitialized(true);
  }

  useEffect(() => {
    const activeApp = RunningApps.active();
    if (!initialized)
      return;

    if (currentAppOverride && currentAppOverridable) {
      console.log(`Setting app ${activeApp} to saturation ${currentTargetSaturation}`);
      settings.ensureApp(activeApp).saturation = currentTargetSaturation;
    } else {
      console.log(`Setting global to saturation ${currentTargetSaturation}`);
      settings.ensureApp(DEFAULT_APP).saturation = currentTargetSaturation;
    }
    applyFn(activeApp);

    saveSettingsToLocalStorage(settings);
  }, [currentTargetSaturation, initialized]);

  useEffect(() => {
    const activeApp = RunningApps.active();
    if (!initialized)
      return;

    if (currentAppOverride && currentAppOverridable) {
      console.log(`Setting app ${activeApp} to${currentTargetGammaLinear ? " linear" : ""} gamma ${currentTargetGammaRed} ${currentTargetGammaGreen} ${currentTargetGammaBlue}`);
      settings.ensureApp(activeApp).ensureGamma().linear = currentTargetGammaLinear;
      settings.ensureApp(activeApp).ensureGamma().gain_r = currentTargetGammaRed;
      settings.ensureApp(activeApp).ensureGamma().gain_g = currentTargetGammaGreen;
      settings.ensureApp(activeApp).ensureGamma().gain_b = currentTargetGammaBlue;
    } else {
      console.log(`Setting global to${currentTargetGammaLinear ? " linear" : ""} gamma ${currentTargetGammaRed} ${currentTargetGammaGreen} ${currentTargetGammaBlue}`);
      settings.ensureApp(DEFAULT_APP).ensureGamma().linear = currentTargetGammaLinear;
      settings.ensureApp(DEFAULT_APP).ensureGamma().gain_r = currentTargetGammaRed;
      settings.ensureApp(DEFAULT_APP).ensureGamma().gain_g = currentTargetGammaGreen;
      settings.ensureApp(DEFAULT_APP).ensureGamma().gain_b = currentTargetGammaBlue;
    }
    applyFn(activeApp);

    saveSettingsToLocalStorage(settings);
  }, [currentTargetGammaLinear, currentTargetGammaRed, currentTargetGammaGreen, currentTargetGammaBlue, initialized]);

  useEffect(() => {
    const activeApp = RunningApps.active();
    if (!initialized)
      return;
    if (activeApp == DEFAULT_APP)
      return;

    console.log(`Setting app ${activeApp} to override ${currentAppOverride}`);

    if (!currentAppOverride) {
      settings.ensureApp(activeApp).saturation = undefined;
      settings.ensureApp(activeApp).gamma = undefined;
      setCurrentTargetSaturation(settings.appSaturation(DEFAULT_APP));
      setCurrentTargetGammaLinear(settings.appGamma(DEFAULT_APP).linear);
      setCurrentTargetGammaRed(settings.appGamma(DEFAULT_APP).gain_r);
      setCurrentTargetGammaGreen(settings.appGamma(DEFAULT_APP).gain_g);
      setCurrentTargetGammaBlue(settings.appGamma(DEFAULT_APP).gain_b);
    }
    saveSettingsToLocalStorage(settings);
  }, [currentAppOverride, initialized]);

  useEffect(() => {
    refresh();
    runningApps.listenActiveChange(() => refresh());
  }, []);

  return (
    <PanelSection title="Profile">
      <PanelSectionRow>
        <ToggleField
          label="Use per-game profile"
          description={"Currently using " + (currentAppOverride && currentAppOverridable ? "per-app" : "global") + " profile"}
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
          step={5}
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
        <SliderField
          label="Gamma Red"
          description={`Control${currentTargetGammaLinear ? " linear" : ""} gamma gain for red`}
          value={currentTargetGammaRed}
          step={5}
          max={900}
          min={-50}
          showValue={true}
          onChange={(value: number) => {
            setCurrentTargetGammaRed(value);
          }}
        />
      </PanelSectionRow>
      <PanelSectionRow>
        <SliderField
          label="Gamma Green"
          description={`Control${currentTargetGammaLinear ? " linear" : ""} gamma gain for green´`}
          value={currentTargetGammaGreen}
          step={5}
          max={900}
          min={-50}
          showValue={true}
          onChange={(value: number) => {
            setCurrentTargetGammaGreen(value);
          }}
        />
      </PanelSectionRow>
      <PanelSectionRow>
        <SliderField
          label="Gamma Blue"
          description={`Control${currentTargetGammaLinear ? " linear" : ""} gamma gain for blue`}
          value={currentTargetGammaBlue}
          step={5}
          max={900}
          min={-50}
          showValue={true}
          onChange={(value: number) => {
            setCurrentTargetGammaBlue(value);
          }}
        />
      </PanelSectionRow>
    </PanelSection>
  );
};

export default definePlugin((serverAPI: ServerAPI) => {
  // load settings
  settings = loadSettingsFromLocalStorage();

  const backend = new Backend(serverAPI);
  const runningApps = new RunningApps();

  const applySettings = (appId: string) => {
    const saturation = settings.appSaturation(appId);
    backend.applySaturation(saturation);
    const gamma = settings.appGamma(appId);
    backend.applyGamma(gamma);
  };

  runningApps.register();

  // apply initially
  applySettings(RunningApps.active());

  return {
    title: <div className={staticClasses.Title}>vibrantDeck</div>,
    content: <Content runningApps={runningApps} applyFn={applySettings} />,
    icon: <FaEyeDropper />,
    onDismount() {
      runningApps.unregister();
      // reset color settings to default values
      backend.applySaturation(100);
      backend.applyGamma(new GammaSetting());
    }
  };
});
