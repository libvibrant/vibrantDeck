import {
  JsonObject,
  JsonProperty,
  JsonSerializer,
} from "typescript-json-serializer";
import { DEFAULT_APP } from "./util";

const SETTINGS_KEY = "vibrantDeck-v2";

const serializer = new JsonSerializer();

@JsonObject()
export class AppSetting {
  @JsonProperty()
  vibrancy?: number;

  hasSettings(): boolean {
    if (this.vibrancy != undefined) return true;
    return false;
  }
}

@JsonObject()
export class Settings {
  @JsonProperty()
  enabled: boolean = true;
  @JsonProperty({ dataStructure: "dictionary", type: AppSetting })
  perApp: { [appId: string]: AppSetting } = {};
  @JsonProperty()
  advancedSettingsUI: boolean = true;

  ensureApp(appId: string): AppSetting {
    if (!(appId in this.perApp)) {
      this.perApp[appId] = new AppSetting();
    }
    return this.perApp[appId];
  }

  appVibrancy(appId: string): number {
    // app vibrancy or global saturation or fallback 100
    if (this.perApp[appId]?.vibrancy != undefined)
      return this.perApp[appId].vibrancy!!;
    if (this.perApp[DEFAULT_APP]?.vibrancy != undefined)
      return this.perApp[DEFAULT_APP].vibrancy!!;
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
