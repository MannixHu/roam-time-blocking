import type { RoamExtensionAPI, TimeBlockSettings, TagConfig } from "../types";
import { createTagConfigEditorComponent } from "./TagConfigEditor";

export const DEFAULT_SETTINGS: TimeBlockSettings = {
  dayStartHour: 6,
  dayEndHour: 22,
  configuredTags: [
    { tag: "longTerm", color: "#4A90D9", isPageRef: false },
    { tag: "shortTerm", color: "#7CB342", isPageRef: false },
  ],
  defaultColor: "#9E9E9E",
  hourHeight: 48, // pixels per hour (smaller = more hours visible)
};

export function registerSettingsPanel(extensionAPI: RoamExtensionAPI): void {
  // Create the tag config editor component with extensionAPI access
  const TagConfigEditorComponent = createTagConfigEditorComponent(extensionAPI);

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
        id: "tagConfigs",
        name: "Tag Configuration",
        description: "Configure tags and their colors for time block tracking",
        action: {
          type: "reactComponent",
          component: TagConfigEditorComponent,
        },
      },
      {
        id: "defaultColor",
        name: "Default Color",
        description: "Color for blocks without matching tags",
        action: {
          type: "input",
          placeholder: "#9E9E9E",
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
  // Support hours up to 30 (6 AM next day)
  const dayEndHour = Math.min(30, Math.max(0, rawDayEndHour));
  const defaultColor = (extensionAPI.settings.get("defaultColor") as string) || DEFAULT_SETTINGS.defaultColor;
  // Hour height: 20-100 pixels, default 48
  const rawHourHeight = Number(extensionAPI.settings.get("hourHeight")) || DEFAULT_SETTINGS.hourHeight;
  const hourHeight = Math.min(100, Math.max(20, rawHourHeight));

  // Try to load tags from new JSON format first
  let configuredTags: TagConfig[] = [];
  const tagConfigsJson = extensionAPI.settings.get("tagConfigs") as string;

  if (tagConfigsJson) {
    try {
      configuredTags = JSON.parse(tagConfigsJson) as TagConfig[];
    } catch (e) {
      console.error("[TimeBlock] Failed to parse tagConfigs:", e);
    }
  }

  // Fallback to old string format for backward compatibility
  if (configuredTags.length === 0) {
    const tagsStr = (extensionAPI.settings.get("timeBlockTags") as string) || "";
    const colorsStr = (extensionAPI.settings.get("tagColors") as string) || "";
    configuredTags = parseTagsAndColors(tagsStr, colorsStr, defaultColor);

    // Migrate to new format if old format exists
    if (configuredTags.length > 0) {
      extensionAPI.settings.set("tagConfigs", JSON.stringify(configuredTags));
      console.log("[TimeBlock] Migrated tags to new format");
    }
  }

  return {
    dayStartHour,
    dayEndHour,
    configuredTags: configuredTags.length > 0 ? configuredTags : DEFAULT_SETTINGS.configuredTags,
    defaultColor,
    hourHeight,
  };
}

// Keep for backward compatibility migration
function parseTagsAndColors(tagsStr: string, colorsStr: string, defaultColor: string): TagConfig[] {
  if (!tagsStr.trim()) return [];

  // Parse color map: "tag:#color, tag2:#color2"
  const colorMap = new Map<string, string>();
  if (colorsStr.trim()) {
    colorsStr.split(",").forEach((pair) => {
      const [tag, color] = pair.split(":").map((s) => s.trim());
      if (tag && color) {
        colorMap.set(tag.toLowerCase(), color);
      }
    });
  }

  // Parse tags: "tag1, tag2, [[PageRef]]"
  return tagsStr.split(",").map((t) => {
    const trimmed = t.trim();
    const isPageRef = trimmed.startsWith("[[") && trimmed.endsWith("]]");
    const tag = isPageRef ? trimmed.slice(2, -2) : trimmed.replace(/^#/, "");
    const color = colorMap.get(tag.toLowerCase()) || defaultColor;

    return { tag, color, isPageRef };
  });
}
