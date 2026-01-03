import React from "react";
import type { RoamExtensionAPI, TimeBlockSettings, ColorConfig, TagConfig } from "../types";
import { colorConfigsToTagConfigs } from "../types";
import { createColorConfigEditorComponent } from "./TagConfigEditor";

// Default color configs with tags
export const DEFAULT_COLOR_CONFIGS: ColorConfig[] = [
  { color: "#7CB342", tags: ["longTerm"] },  // Green - longTerm
  { color: "#757575", tags: ["midTerm"] },   // Gray - midTerm
  { color: "#E53935", tags: ["shortTerm"] }, // Red - shortTerm
];

export const DEFAULT_SETTINGS: TimeBlockSettings = {
  dayStartHour: 8,
  dayEndHour: 26,
  colorConfigs: DEFAULT_COLOR_CONFIGS,
  defaultColor: "#9E9E9E",
  hourHeight: 36,
  viewMode: "day",
  weekStartDay: 1, // Monday
  timeGranularity: 15, // 15 minutes
};

// Create Week Start Day selector component
function createWeekStartDayComponent(extensionAPI: RoamExtensionAPI): React.FC {
  return function WeekStartDaySelector() {
    const [value, setValue] = React.useState<string>(() => {
      const saved = extensionAPI.settings.get("weekStartDay");
      return saved !== undefined && saved !== null ? String(saved) : "1";
    });

    const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
      const newValue = e.target.value;
      setValue(newValue);
      extensionAPI.settings.set("weekStartDay", newValue);
    };

    return React.createElement("select", {
      value,
      onChange: handleChange,
      style: {
        padding: "6px 12px",
        borderRadius: "4px",
        border: "1px solid #555",
        fontSize: "14px",
        backgroundColor: "#33404c",
        color: "#8d9aa6",
        cursor: "pointer",
        outline: "none",
      },
    }, [
      React.createElement("option", { key: "1", value: "1", style: { backgroundColor: "#33404c", color: "#8d9aa6" } }, "Monday"),
      React.createElement("option", { key: "0", value: "0", style: { backgroundColor: "#33404c", color: "#8d9aa6" } }, "Sunday"),
    ]);
  };
}

export function registerSettingsPanel(extensionAPI: RoamExtensionAPI): void {
  const ColorConfigEditorComponent = createColorConfigEditorComponent(extensionAPI);
  const WeekStartDayComponent = createWeekStartDayComponent(extensionAPI);

  extensionAPI.settings.panel.create({
    tabTitle: "TimeBlock",
    settings: [
      {
        id: "dayStartHour",
        name: "Day Start Hour",
        description: "Hour to start displaying in the calendar (0-23)",
        action: {
          type: "input",
          placeholder: "8",
        },
      },
      {
        id: "dayEndHour",
        name: "Day End Hour",
        description: "Hour to end displaying (0-30, where 24-30 = next day's 0-6 AM)",
        action: {
          type: "input",
          placeholder: "26",
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
          placeholder: "36",
        },
      },
      {
        id: "weekStartDay",
        name: "Week Start Day",
        description: "First day of the week for week view",
        action: {
          type: "reactComponent",
          component: WeekStartDayComponent,
        },
      },
      {
        id: "timeGranularity",
        name: "Time Granularity (minutes)",
        description: "Snap interval for dragging blocks (5, 10, 15, 30, etc.)",
        action: {
          type: "input",
          placeholder: "15",
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

  // New settings
  const viewMode = (extensionAPI.settings.get("viewMode") as "day" | "week") || DEFAULT_SETTINGS.viewMode;
  const rawWeekStartDay = Number(extensionAPI.settings.get("weekStartDay"));
  const weekStartDay = (rawWeekStartDay === 0 || rawWeekStartDay === 1) ? rawWeekStartDay as 0 | 1 : DEFAULT_SETTINGS.weekStartDay;
  const rawTimeGranularity = Number(extensionAPI.settings.get("timeGranularity")) || DEFAULT_SETTINGS.timeGranularity;
  const timeGranularity = Math.min(60, Math.max(5, rawTimeGranularity)); // 5-60 minutes

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
    viewMode,
    weekStartDay,
    timeGranularity,
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

  // Ensure we have the default colors even if empty
  for (const defaultConfig of DEFAULT_COLOR_CONFIGS) {
    if (!result.find((c) => c.color === defaultConfig.color)) {
      result.push({ ...defaultConfig });
    }
  }

  return result;
}
