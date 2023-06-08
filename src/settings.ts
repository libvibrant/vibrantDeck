import {
  JsonObject,
  JsonProperty,
  JsonSerializer,
} from "typescript-json-serializer";
import { DEFAULT_APP } from "./util";

const SETTINGS_KEY = "vibrantDeck";

const serializer = new JsonSerializer();

@JsonObject()
export class GammaSetting {
  @JsonProperty()
  linear: boolean = true;
  @JsonProperty()
  gainR: number = 100;
  @JsonProperty()
  gainG: number = 100;
  @JsonProperty()
  gainB: number = 100;
}

@JsonObject()
export class AppSetting {
  @JsonProperty()
  saturation?: number;
  @JsonProperty()
  gamma?: GammaSetting;

  ensureGamma(): GammaSetting {
    if (this.gamma == undefined) this.gamma = new GammaSetting();
    return this.gamma;
  }

  hasSettings(): boolean {
    if (this.saturation != undefined) return true;
    if (this.gamma != undefined) return true;
    return false;
  }
}

@JsonObject()
export class Settings {
  @JsonProperty()
  private enabled: boolean = true;
  @JsonProperty({ dataStructure: "dictionary", type: AppSetting })
  perApp: { [appId: string]: AppSetting } = {};
  @JsonProperty()
  advancedSettingsUI: boolean = true;
  @JsonProperty()
  externalEnabled: boolean = false;
  @JsonProperty({ dataStructure: "dictionary", type: AppSetting })
  externalPerApp: { [appId: string]: AppSetting } = {};

  ensureApp(appId: string, external: boolean): AppSetting {
    const appDict = external ? this.externalPerApp : this.perApp;
    if (!(appId in appDict)) {
      appDict[appId] = new AppSetting();
    }
    return appDict[appId];
  }

  getEnabled(external: boolean): boolean {
    // app saturation or global saturation or fallback 100
    return external ? this.externalEnabled : this.enabled;
  }

  setEnabled(external: boolean, value: boolean) {
    // app saturation or global saturation or fallback 100
    if (external) {
      this.externalEnabled = value;
    } else {
      this.enabled = value;
    }
  }

  appSaturation(appId: string, external: boolean): number {
    // app saturation or global saturation or fallback 100
    const appDict = external ? this.externalPerApp : this.perApp;
    if (appDict[appId]?.saturation != undefined)
      return appDict[appId].saturation!!;
    if (appDict[DEFAULT_APP]?.saturation != undefined)
      return appDict[DEFAULT_APP].saturation!!;
    return 100;
  }

  appGamma(appId: string, external: boolean) {
    // app gamma or global gamma or fallback to defaults
    const appDict = external ? this.externalPerApp : this.perApp;
    if (appDict[appId]?.gamma != undefined) return appDict[appId].gamma!!;
    if (appDict[DEFAULT_APP]?.gamma != undefined)
      return appDict[DEFAULT_APP].gamma!!;
    return new GammaSetting();
  }
}

export function loadSettingsFromLocalStorage(): Settings {
  const settingsString = localStorage.getItem(SETTINGS_KEY) || "{}";
  const settingsJson = JSON.parse(settingsString);
  const settings = serializer.deserializeObject(settingsJson, Settings);
  return settings || new Settings();
}

export function saveSettingsToLocalStorage(settings: Settings) {
  const settingsJson = serializer.serializeObject(settings) || {};
  const settingsString = JSON.stringify(settingsJson);
  localStorage.setItem(SETTINGS_KEY, settingsString);
}
