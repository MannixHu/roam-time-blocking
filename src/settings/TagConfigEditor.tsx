import React, { useState, useEffect, useCallback } from "react";
import type { RoamExtensionAPI, TagConfig } from "../types";
import { DEFAULT_SETTINGS } from "./settingsPanel";

// Preset colors for quick selection
const COLOR_PRESETS = [
  { name: "Blue", value: "#4A90D9" },
  { name: "Green", value: "#7CB342" },
  { name: "Red", value: "#E53935" },
  { name: "Orange", value: "#F4511E" },
  { name: "Purple", value: "#8E24AA" },
  { name: "Teal", value: "#00897B" },
  { name: "Gray", value: "#757575" },
  { name: "Pink", value: "#D81B60" },
];

interface TagRowProps {
  tag: TagConfig;
  onChange: (updated: TagConfig) => void;
  onRemove: () => void;
}

const TagRow: React.FC<TagRowProps> = ({ tag, onChange, onRemove }) => {
  return (
    <div className="tb-flex tb-items-center tb-gap-2 tb-py-2 tb-border-b tb-border-[var(--border-color,#e0e0e0)] tb-flex-wrap">
      {/* Tag name input */}
      <input
        type="text"
        className="bp3-input tb-flex-1 tb-min-w-[100px] tb-max-w-[180px] tb-px-2 tb-py-1 tb-text-[13px]"
        value={tag.tag}
        onChange={(e) => onChange({ ...tag, tag: e.target.value })}
        placeholder="tag name"
      />

      {/* Color picker section */}
      <div className="tb-flex tb-items-center tb-gap-1.5">
        {/* Native color input */}
        <input
          type="color"
          className="timeblock-color-input tb-w-8 tb-h-7 tb-border tb-border-[var(--border-color,#ccc)] tb-rounded tb-p-0 tb-cursor-pointer tb-bg-transparent"
          value={tag.color}
          onChange={(e) => onChange({ ...tag, color: e.target.value })}
          title="Pick custom color"
        />

        {/* Preset color buttons */}
        <div className="tb-flex tb-gap-1 tb-flex-wrap">
          {COLOR_PRESETS.map((preset) => (
            <button
              key={preset.value}
              type="button"
              className={`tb-w-5 tb-h-5 tb-rounded-full tb-border-2 tb-cursor-pointer tb-p-0 hover:tb-scale-[1.15] tb-transition-transform ${
                tag.color === preset.value
                  ? "tb-border-[#333] tb-shadow-[0_0_0_1px_#fff_inset]"
                  : "tb-border-transparent"
              }`}
              style={{ backgroundColor: preset.value }}
              onClick={() => onChange({ ...tag, color: preset.value })}
              title={preset.name}
            />
          ))}
        </div>
      </div>

      {/* Remove button */}
      <button
        type="button"
        className="tb-bg-transparent tb-border-none tb-text-[#999] tb-cursor-pointer tb-p-1 tb-flex tb-items-center tb-justify-center tb-rounded hover:tb-text-[#e53935] hover:tb-bg-[rgba(229,57,53,0.1)] tb-transition-colors"
        onClick={onRemove}
        title="Remove tag"
      >
        <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
          <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
        </svg>
      </button>
    </div>
  );
};

interface TagConfigEditorProps {
  extensionAPI: RoamExtensionAPI;
}

export const TagConfigEditor: React.FC<TagConfigEditorProps> = ({ extensionAPI }) => {
  const [tags, setTags] = useState<TagConfig[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load tags from storage on mount
  useEffect(() => {
    const loadTags = () => {
      // Try new JSON format first
      const tagConfigsJson = extensionAPI.settings.get("tagConfigs") as string;

      if (tagConfigsJson) {
        try {
          const parsed = JSON.parse(tagConfigsJson) as TagConfig[];
          setTags(parsed);
          setIsLoaded(true);
          return;
        } catch (e) {
          console.error("[TimeBlock] Failed to parse tagConfigs:", e);
        }
      }

      // Fallback to old format for migration
      const tagsStr = (extensionAPI.settings.get("timeBlockTags") as string) || "";
      const colorsStr = (extensionAPI.settings.get("tagColors") as string) || "";
      const defaultColor = (extensionAPI.settings.get("defaultColor") as string) || DEFAULT_SETTINGS.defaultColor;

      if (tagsStr.trim()) {
        const migrated = parseOldFormat(tagsStr, colorsStr, defaultColor);
        setTags(migrated);
        // Save in new format
        extensionAPI.settings.set("tagConfigs", JSON.stringify(migrated));
      } else {
        // Use defaults
        setTags(DEFAULT_SETTINGS.configuredTags);
      }

      setIsLoaded(true);
    };

    loadTags();
  }, [extensionAPI]);

  // Auto-save when tags change (debounced)
  useEffect(() => {
    if (!isLoaded) return;

    const timer = setTimeout(() => {
      extensionAPI.settings.set("tagConfigs", JSON.stringify(tags));
      console.log("[TimeBlock] Tags saved:", tags);
    }, 300);

    return () => clearTimeout(timer);
  }, [tags, isLoaded, extensionAPI]);

  const handleTagChange = useCallback((index: number, updated: TagConfig) => {
    setTags((prev) => {
      const newTags = [...prev];
      newTags[index] = updated;
      return newTags;
    });
  }, []);

  const handleRemoveTag = useCallback((index: number) => {
    setTags((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleAddTag = useCallback(() => {
    const newTag: TagConfig = {
      tag: "",
      color: COLOR_PRESETS[tags.length % COLOR_PRESETS.length].value,
      isPageRef: false,
    };
    setTags((prev) => [...prev, newTag]);
  }, [tags.length]);

  if (!isLoaded) {
    return <div className="tb-py-2">Loading...</div>;
  }

  return (
    <div className="tb-py-2">
      {tags.length === 0 ? (
        <div className="tb-py-3 tb-text-[var(--text-secondary,#888)] tb-text-xs tb-italic">
          No tags configured. Add a tag to get started.
        </div>
      ) : (
        tags.map((tag, index) => (
          <TagRow
            key={index}
            tag={tag}
            onChange={(updated) => handleTagChange(index, updated)}
            onRemove={() => handleRemoveTag(index)}
          />
        ))
      )}

      <button
        type="button"
        className="tb-mt-3 tb-px-4 tb-py-2 tb-bg-[#4A90D9] tb-text-white tb-border-none tb-rounded tb-cursor-pointer tb-text-[13px] tb-font-medium hover:tb-bg-[#3a7bc8] tb-transition-colors"
        onClick={handleAddTag}
      >
        + Add Tag
      </button>
    </div>
  );
};

// Parse old string format for migration
function parseOldFormat(tagsStr: string, colorsStr: string, defaultColor: string): TagConfig[] {
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

// Wrapper component that will be used in settings panel
// This allows us to pass extensionAPI through closure
export function createTagConfigEditorComponent(extensionAPI: RoamExtensionAPI): React.FC {
  return function TagConfigEditorWrapper() {
    return <TagConfigEditor extensionAPI={extensionAPI} />;
  };
}
