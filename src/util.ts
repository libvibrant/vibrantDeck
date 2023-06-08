import { Router, ServerAPI, ServerResponse } from "decky-frontend-lib";
import { GammaSetting } from "./settings";

interface SaturationArgs {
  saturation: number;
}
interface GammaGainArgs {
  values: number[];
}
interface GammaBlendArgs {
  value: number;
}

type ActiveAppChangedHandler = (newAppId: string, oldAppId: string) => void;
type ExternalDisplayStatusChangedHandler = (
  newExternalDisplayConnected: boolean
) => void;
type UnregisterFn = () => void;

export const DEFAULT_APP = "0";

export class RunningApps {
  private listeners: ActiveAppChangedHandler[] = [];
  private lastAppId: string = "";
  private intervalId: any;

  private pollActive() {
    const newApp = RunningApps.active();
    if (this.lastAppId != newApp) {
      this.listeners.forEach((h) => h(newApp, this.lastAppId));
    }
    this.lastAppId = newApp;
  }

  register() {
    if (this.intervalId == undefined)
      this.intervalId = setInterval(() => this.pollActive(), 100);
  }

  unregister() {
    if (this.intervalId != undefined) clearInterval(this.intervalId);
    this.intervalId = undefined;
  }

  listenActiveChange(fn: ActiveAppChangedHandler): UnregisterFn {
    const idx = this.listeners.push(fn) - 1;
    return () => {
      this.listeners.splice(idx, 1);
    };
  }

  static active() {
    return Router.MainRunningApp?.appid || DEFAULT_APP;
  }
}

export class ExternalDisplayState {
  private backend: Backend;
  private listeners: ExternalDisplayStatusChangedHandler[] = [];
  private lastConnectedState: boolean = false;
  private static currentConnectedState: boolean = false;
  private static connectedDisplays: Array<string> = [];
  private intervalId: any;

  constructor(backend: Backend) {
    this.backend = backend;
  }

  private pollActive() {
    if (
      ExternalDisplayState.currentConnectedState !=
      this.lastConnectedState
    ) {
      this.listeners.forEach((h) =>
        h(ExternalDisplayState.currentConnectedState)
      );
    }
    this.lastConnectedState =
    ExternalDisplayState.currentConnectedState;
      this.backend.getDisplays().then((value: ServerResponse<Array<string>>) => {
      if (value.success && value.result.length > 0) {
        ExternalDisplayState.connectedDisplays = value.result;
        ExternalDisplayState.currentConnectedState = (value.result.length > 1);
      } else {
        ExternalDisplayState.connectedDisplays = ["Err "+value.result];
        ExternalDisplayState.currentConnectedState = false;
      }
    });
  }

  register() {
    if (this.intervalId == undefined)
    this.intervalId = setInterval(() => this.pollActive(), 3000);
  }

  unregister() {
    if (this.intervalId != undefined) clearInterval(this.intervalId);
    this.intervalId = undefined;
  }

  listenChange(fn: ExternalDisplayStatusChangedHandler): UnregisterFn {
    const idx = this.listeners.push(fn) - 1;
    return () => {
      this.listeners.splice(idx, 1);
    };
  }

  current() {
    return ExternalDisplayState.currentConnectedState;
  }

  displays() {
    return ExternalDisplayState.connectedDisplays;
  }
}

export class Backend {
  private serverAPI: ServerAPI;

  constructor(serverAPI: ServerAPI) {
    this.serverAPI = serverAPI;
  }

  applySaturation(saturation: number) {
    console.log("Applying saturation " + saturation.toString());
    this.serverAPI.callPluginMethod<SaturationArgs, boolean>("set_saturation", {
      saturation: saturation / 100.0,
    });
  }

  applyGamma(gamma: GammaSetting) {
    const defaults = new GammaSetting();
    const default_values = [
      defaults.gainR / 100.0,
      defaults.gainG / 100.0,
      defaults.gainB / 100.0,
    ];
    const values = [
      gamma.gainR / 100.0,
      gamma.gainG / 100.0,
      gamma.gainB / 100.0,
    ];
    console.log(
      `Applying gamma ${gamma.linear ? "linear" : ""} gain ${values.toString()}`
    );
    if (gamma.linear) {
      this.serverAPI.callPluginMethod<GammaGainArgs, boolean>(
        "set_gamma_gain",
        { values: default_values }
      );
      this.serverAPI.callPluginMethod<GammaGainArgs, boolean>(
        "set_gamma_linear_gain",
        { values: values }
      );
      this.serverAPI.callPluginMethod<GammaBlendArgs, boolean>(
        "set_gamma_linear_gain_blend",
        { value: 1.0 }
      );
    } else {
      this.serverAPI.callPluginMethod<GammaGainArgs, boolean>(
        "set_gamma_gain",
        { values: values }
      );
      this.serverAPI.callPluginMethod<GammaGainArgs, boolean>(
        "set_gamma_linear_gain",
        { values: default_values }
      );
      this.serverAPI.callPluginMethod<GammaBlendArgs, boolean>(
        "set_gamma_linear_gain_blend",
        { value: 0.0 }
      );
    }
  }

  getDisplays() {
    return this.serverAPI.callPluginMethod<void, Array<string>>(
      "get_displays",
      undefined
    );
  }
}
