import { JsonObject, JsonProperty, JsonSerializer } from 'typescript-json-serializer';
import { DEFAULT_APP } from './util';

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
    if (this.gamma == undefined)
      this.gamma = new GammaSetting();
    return this.gamma;
  }

  hasSettings(): boolean {
    if (this.saturation != undefined)
      return true;
    if (this.gamma != undefined)
      return true;
    return false;
  }
}

@JsonObject()
export class Settings {
  @JsonProperty()
  enabled: boolean = true;
  @JsonProperty({ isDictionary: true, type: AppSetting })
  perApp: { [appId: string]: AppSetting } = {};

  ensureApp(appId: string): AppSetting {
    if (!(appId in this.perApp)) {
      this.perApp[appId] = new AppSetting();
    }
    return this.perApp[appId];
  }

  appSaturation(appId: string): number {
    // app saturation or global saturation or fallback 100
    if (this.perApp[appId]?.saturation != undefined)
      return this.perApp[appId].saturation!!;
    if (this.perApp[DEFAULT_APP]?.saturation != undefined)
      return this.perApp[DEFAULT_APP].saturation!!;
    return 100;
  }

  appGamma(appId: string) {
    // app gamma or global gamma or fallback to defaults
    if (this.perApp[appId]?.gamma != undefined)
      return this.perApp[appId].gamma!!;
    if (this.perApp[DEFAULT_APP]?.gamma != undefined)
      return this.perApp[DEFAULT_APP].gamma!!;
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
