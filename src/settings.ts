import { JsonObject, JsonProperty, JsonSerializer } from 'typescript-json-serializer';
import { DEFAULT_APP } from './util';

const SETTINGS_KEY = "vibrantDeck";

const serializer = new JsonSerializer();

@JsonObject()
export class AppSetting {
  @JsonProperty()
  saturation?: number;

  hasSettings(): boolean {
    if (this.saturation != undefined)
      return true;
    return false;
  }
}

@JsonObject()
export class Settings {
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
