import type { RoamExtensionAPI, TimeBlockSettings, ColorConfig, TagConfig } from "../types";
import { colorConfigsToTagConfigs } from "../types";
import { createColorConfigEditorComponent } from "./TagConfigEditor";

// Default 4 colors: Red, Green, Yellow, Gray
export const DEFAULT_COLOR_CONFIGS: ColorConfig[] = [
  { color: "#E53935", tags: [] }, // Red
  { color: "#7CB342", tags: [] }, // Green
  { color: "#FDD835", tags: [] }, // Yellow
  { color: "#757575", tags: [] }, // Gray
];

export const DEFAULT_SETTINGS: TimeBlockSettings = {
  dayStartHour: 6,
  dayEndHour: 22,
  colorConfigs: DEFAULT_COLOR_CONFIGS,
  defaultColor: "#9E9E9E",
  hourHeight: 48,
};

export function registerSettingsPanel(extensionAPI: RoamExtensionAPI): void {
  const ColorConfigEditorComponent = createColorConfigEditorComponent(extensionAPI);

  extensionAPI.settings.panel.create({
    tabTitle: "TimeBlock",
    settings: [
      {
        id: "dayStartHour",
        name: "Day Start Hour",
        description: "Hour to start displaying in the calendar (0-23)",
        action: {
          type: "input",
          placeholder: "6",
        },
      },
      {
        id: "dayEndHour",
        name: "Day End Hour",
        description: "Hour to end displaying (0-30, where 24-30 = next day's 0-6 AM)",
        action: {
          type: "input",
          placeholder: "22",
        },
      },
      {
        id: "colorConfigs",
        name: "Color & Tag Configuration",
        description: "Configure colors and their associated tags",
        action: {
          type: "reactComponent",
          component: ColorConfigEditorComponent,
        },
      },
      {
        id: "hourHeight",
        name: "Hour Height (pixels)",
        description: "Height in pixels for each hour (20-100). Smaller = more hours visible",
        action: {
          type: "input",
          placeholder: "48",
        },
      },
    ],
  });
}

export function loadSettings(extensionAPI: RoamExtensionAPI): TimeBlockSettings {
  const dayStartHour = Math.min(23, Math.max(0, Number(extensionAPI.settings.get("dayStartHour")) || DEFAULT_SETTINGS.dayStartHour));
  const rawDayEndHour = Number(extensionAPI.settings.get("dayEndHour")) || DEFAULT_SETTINGS.dayEndHour;
  const dayEndHour = Math.min(30, Math.max(0, rawDayEndHour));
  const defaultColor = DEFAULT_SETTINGS.defaultColor;
  const rawHourHeight = Number(extensionAPI.settings.get("hourHeight")) || DEFAULT_SETTINGS.hourHeight;
  const hourHeight = Math.min(100, Math.max(20, rawHourHeight));

  // Try to load from new ColorConfig format
  let colorConfigs: ColorConfig[] = [];
  const colorConfigsJson = extensionAPI.settings.get("colorConfigs") as string;

  if (colorConfigsJson) {
    try {
      colorConfigs = JSON.parse(colorConfigsJson) as ColorConfig[];
    } catch (e) {
      console.error("[TimeBlock] Failed to parse colorConfigs:", e);
    }
  }

  // Migrate from old TagConfig format if needed
  if (colorConfigs.length === 0) {
    const tagConfigsJson = extensionAPI.settings.get("tagConfigs") as string;
    if (tagConfigsJson) {
      try {
        const oldTags = JSON.parse(tagConfigsJson) as TagConfig[];
        colorConfigs = migrateFromTagConfigs(oldTags);
        // Save migrated data
        extensionAPI.settings.set("colorConfigs", JSON.stringify(colorConfigs));
        console.log("[TimeBlock] Migrated from TagConfig to ColorConfig format");
      } catch (e) {
        console.error("[TimeBlock] Failed to migrate tagConfigs:", e);
      }
    }
  }

  // Use defaults if still empty
  if (colorConfigs.length === 0) {
    colorConfigs = DEFAULT_COLOR_CONFIGS;
  }

  return {
    dayStartHour,
    dayEndHour,
    colorConfigs,
    defaultColor,
    hourHeight,
  };
}

// Migrate old TagConfig[] to ColorConfig[]
function migrateFromTagConfigs(tagConfigs: TagConfig[]): ColorConfig[] {
  const colorMap = new Map<string, string[]>();

  for (const tc of tagConfigs) {
    const existing = colorMap.get(tc.color) || [];
    existing.push(tc.tag);
    colorMap.set(tc.color, existing);
  }

  const result: ColorConfig[] = [];
  for (const [color, tags] of colorMap) {
    result.push({ color, tags });
  }

  // Ensure we have the 4 default colors even if empty
  for (const defaultConfig of DEFAULT_COLOR_CONFIGS) {
    if (!result.find((c) => c.color === defaultConfig.color)) {
      result.push({ ...defaultConfig });
    }
  }

  return result;
}
