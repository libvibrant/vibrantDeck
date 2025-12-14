import { Router, ServerAPI } from "decky-frontend-lib";

interface VibrancyArgs {
  vibrancy: number;
}

interface BrightnessArgs {
  brightness: number;
}

interface ColorTemperatureArgs {
  temperature: number;
  intensity: number;
}

type ActiveAppChangedHandler = (newAppId: string, oldAppId: string) => void;
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

export class Backend {
  private serverAPI: ServerAPI;

  constructor(serverAPI: ServerAPI) {
    this.serverAPI = serverAPI;
  }

  applyVibrancy(vibrancy: number) {
    console.log("Applying vibrancy " + vibrancy.toString());
    this.serverAPI.callPluginMethod<VibrancyArgs, boolean>("set_vibrancy", {
      vibrancy: vibrancy / 200.0, // Gamescope wants 0.0..1.0, where 0.5 is sRGB, let's map our 0..200 to that
    });
  }

  applyBrightness(brightness: number) {
    console.log("Applying brightness " + brightness.toString());
    this.serverAPI.callPluginMethod<BrightnessArgs, boolean>("set_brightness", {
      brightness: brightness / 100.0, // Convert 50-200% to 0.5-2.0
    });
  }

  applyColorTemperature(temperature: number, intensity: number) {
    console.log(
      `Applying color temperature ${temperature} with intensity ${intensity}`,
    );
    this.serverAPI.callPluginMethod<ColorTemperatureArgs, boolean>(
      "set_color_temperature",
      {
        temperature: temperature, // -100 to +100
        intensity: intensity / 100.0, // Convert 0-100% to 0.0-1.0
      },
    );
  }
}
