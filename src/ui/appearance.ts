import type { SettingsStore } from "../storage/local/settings-store.js";

export const APPEARANCE_CHANGED_EVENT = "ev:appearance-changed";
export const APPEARANCE_SETTINGS_KEY = "appearance.v1";

export type AppearanceMode = "light" | "dark" | "system";
export type AccentName = "orange" | "blue" | "purple" | "green" | "red";

export interface AppearanceSettings {
  mode: AppearanceMode;
  accent: AccentName;
}

export const DEFAULT_APPEARANCE: AppearanceSettings = {
  mode: "dark",
  accent: "orange",
};

let currentAppearance: AppearanceSettings = DEFAULT_APPEARANCE;

function isAppearanceMode(value: DynamicValue): value is AppearanceMode {
  return value === "light" || value === "dark" || value === "system";
}

function isAccentName(value: DynamicValue): value is AccentName {
  return value === "orange"
    || value === "blue"
    || value === "purple"
    || value === "green"
    || value === "red";
}

function parseAppearance(value: DynamicValue): AppearanceSettings {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return DEFAULT_APPEARANCE;
  }

  const record = value as DynamicObject;
  return {
    mode: isAppearanceMode(record.mode) ? record.mode : DEFAULT_APPEARANCE.mode,
    accent: isAccentName(record.accent) ? record.accent : DEFAULT_APPEARANCE.accent,
  };
}

export function getAppearanceSettings(): AppearanceSettings {
  return currentAppearance;
}

export function setAppearanceSettings(next: AppearanceSettings): void {
  currentAppearance = parseAppearance(next);
  document.documentElement.dataset.evAccent = currentAppearance.accent;
  document.dispatchEvent(new Event(APPEARANCE_CHANGED_EVENT));
}

export async function loadAppearanceSettings(settings: SettingsStore): Promise<AppearanceSettings> {
  const stored = await settings.get<DynamicValue>(APPEARANCE_SETTINGS_KEY);
  const parsed = parseAppearance(stored);
  setAppearanceSettings(parsed);
  return parsed;
}

export async function saveAppearanceSettings(
  settings: SettingsStore,
  next: AppearanceSettings,
): Promise<void> {
  const parsed = parseAppearance(next);
  await settings.set(APPEARANCE_SETTINGS_KEY, parsed);
  setAppearanceSettings(parsed);
}
