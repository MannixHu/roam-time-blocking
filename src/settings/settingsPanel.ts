import type { RoamExtensionAPI, TimeBlockSettings, TagConfig } from "../types";

export const DEFAULT_SETTINGS: TimeBlockSettings = {
  dayStartHour: 6,
  dayEndHour: 22,
  configuredTags: [
    { tag: "longTerm", color: "#4A90D9", isPageRef: false },
    { tag: "shortTerm", color: "#7CB342", isPageRef: false },
  ],
  defaultColor: "#9E9E9E",
};

export function registerSettingsPanel(extensionAPI: RoamExtensionAPI): void {
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
        description: "Hour to end displaying in the calendar (0-23)",
        action: {
          type: "input",
          placeholder: "22",
        },
      },
      {
        id: "timeBlockTags",
        name: "Time Block Tags",
        description:
          "Tags that trigger time block parsing. Format: tag1, tag2, [[PageRef]]. Comma-separated.",
        action: {
          type: "input",
          placeholder: "longTerm, shortTerm, [[Meeting]]",
        },
      },
      {
        id: "tagColors",
        name: "Tag Colors",
        description:
          "Color for each tag. Format: tag:#color, tag2:#color2. Comma-separated.",
        action: {
          type: "input",
          placeholder: "longTerm:#4A90D9, shortTerm:#7CB342, Meeting:#F4511E",
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
    ],
  });
}

export function loadSettings(extensionAPI: RoamExtensionAPI): TimeBlockSettings {
  const dayStartHour = Number(extensionAPI.settings.get("dayStartHour")) || DEFAULT_SETTINGS.dayStartHour;
  const dayEndHour = Number(extensionAPI.settings.get("dayEndHour")) || DEFAULT_SETTINGS.dayEndHour;
  const defaultColor = (extensionAPI.settings.get("defaultColor") as string) || DEFAULT_SETTINGS.defaultColor;

  // Parse tags
  const tagsStr = (extensionAPI.settings.get("timeBlockTags") as string) || "";
  const colorsStr = (extensionAPI.settings.get("tagColors") as string) || "";

  const configuredTags = parseTagsAndColors(tagsStr, colorsStr, defaultColor);

  return {
    dayStartHour,
    dayEndHour,
    configuredTags: configuredTags.length > 0 ? configuredTags : DEFAULT_SETTINGS.configuredTags,
    defaultColor,
  };
}

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
