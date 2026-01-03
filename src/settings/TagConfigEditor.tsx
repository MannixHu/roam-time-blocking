import React, { useState, useEffect, useCallback } from "react";
import type { RoamExtensionAPI, ColorConfig } from "../types";
import { DEFAULT_COLOR_CONFIGS } from "./settingsPanel";

interface ColorRowProps {
  config: ColorConfig;
  onChange: (updated: ColorConfig) => void;
  onRemove: () => void;
  canRemove: boolean;
}

const ColorRow: React.FC<ColorRowProps> = ({ config, onChange, onRemove, canRemove }) => {
  const [tagInput, setTagInput] = useState(config.tags.join(", "));

  // Sync input when config changes externally
  useEffect(() => {
    setTagInput(config.tags.join(", "));
  }, [config.tags]);

  const handleTagsBlur = () => {
    const newTags = tagInput
      .split(",")
      .map((t) => t.trim().replace(/^#/, ""))
      .filter((t) => t.length > 0);
    onChange({ ...config, tags: newTags });
  };

  return (
    <div className="tb-flex tb-items-center tb-gap-2 tb-py-2 tb-border-b tb-border-[var(--border-color,#e0e0e0)]">
      {/* Color picker */}
      <input
        type="color"
        className="timeblock-color-input tb-w-8 tb-h-8 tb-border tb-border-[var(--border-color,#ccc)] tb-rounded tb-p-0 tb-cursor-pointer tb-bg-transparent tb-shrink-0"
        value={config.color}
        onChange={(e) => onChange({ ...config, color: e.target.value })}
        title="Pick color"
      />

      {/* Tags input */}
      <input
        type="text"
        className="bp3-input tb-flex-1 tb-min-w-[150px] tb-px-2 tb-py-1 tb-text-[13px]"
        value={tagInput}
        onChange={(e) => setTagInput(e.target.value)}
        onBlur={handleTagsBlur}
        onKeyDown={(e) => e.key === "Enter" && handleTagsBlur()}
        placeholder="tag1, tag2, tag3..."
      />

      {/* Remove button */}
      {canRemove && (
        <button
          type="button"
          className="tb-bg-transparent tb-border-none tb-text-[#999] tb-cursor-pointer tb-p-1 tb-flex tb-items-center tb-justify-center tb-rounded hover:tb-text-[#e53935] hover:tb-bg-[rgba(229,57,53,0.1)] tb-transition-colors tb-shrink-0"
          onClick={onRemove}
          title="Remove color"
        >
          <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
          </svg>
        </button>
      )}
    </div>
  );
};

interface ColorConfigEditorProps {
  extensionAPI: RoamExtensionAPI;
}

export const ColorConfigEditor: React.FC<ColorConfigEditorProps> = ({ extensionAPI }) => {
  const [configs, setConfigs] = useState<ColorConfig[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load configs on mount
  useEffect(() => {
    const loadConfigs = () => {
      const colorConfigsJson = extensionAPI.settings.get("colorConfigs") as string;

      if (colorConfigsJson) {
        try {
          const parsed = JSON.parse(colorConfigsJson) as ColorConfig[];
          setConfigs(parsed);
          setIsLoaded(true);
          return;
        } catch (e) {
          console.error("[TimeBlock] Failed to parse colorConfigs:", e);
        }
      }

      // Use defaults
      setConfigs([...DEFAULT_COLOR_CONFIGS]);
      setIsLoaded(true);
    };

    loadConfigs();
  }, [extensionAPI]);

  // Auto-save when configs change (debounced)
  useEffect(() => {
    if (!isLoaded) return;

    const timer = setTimeout(() => {
      extensionAPI.settings.set("colorConfigs", JSON.stringify(configs));
      console.log("[TimeBlock] Color configs saved:", configs);
    }, 300);

    return () => clearTimeout(timer);
  }, [configs, isLoaded, extensionAPI]);

  const handleConfigChange = useCallback((index: number, updated: ColorConfig) => {
    setConfigs((prev) => {
      const newConfigs = [...prev];
      newConfigs[index] = updated;
      return newConfigs;
    });
  }, []);

  const handleRemoveConfig = useCallback((index: number) => {
    setConfigs((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleAddConfig = useCallback(() => {
    // Generate a random color
    const randomColor = `#${Math.floor(Math.random() * 16777215).toString(16).padStart(6, "0")}`;
    setConfigs((prev) => [...prev, { color: randomColor, tags: [] }]);
  }, []);

  if (!isLoaded) {
    return <div className="tb-py-2">Loading...</div>;
  }

  return (
    <div className="tb-py-2">
      <div className="tb-text-[11px] tb-text-[var(--text-secondary,#666)] tb-mb-2">
        Each color can have multiple tags (comma-separated)
      </div>

      {configs.map((config, index) => (
        <ColorRow
          key={index}
          config={config}
          onChange={(updated) => handleConfigChange(index, updated)}
          onRemove={() => handleRemoveConfig(index)}
          canRemove={configs.length > 1}
        />
      ))}

      <button
        type="button"
        className="tb-mt-3 tb-px-4 tb-py-2 tb-bg-[#4A90D9] tb-text-white tb-border-none tb-rounded tb-cursor-pointer tb-text-[13px] tb-font-medium hover:tb-bg-[#3a7bc8] tb-transition-colors"
        onClick={handleAddConfig}
      >
        + Add Color
      </button>
    </div>
  );
};

// Wrapper for settings panel
export function createColorConfigEditorComponent(extensionAPI: RoamExtensionAPI): React.FC {
  return function ColorConfigEditorWrapper() {
    return <ColorConfigEditor extensionAPI={extensionAPI} />;
  };
}

// Keep old export for backward compatibility during migration
export const createTagConfigEditorComponent = createColorConfigEditorComponent;
