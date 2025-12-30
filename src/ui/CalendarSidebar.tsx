import React, { useState, useEffect, useCallback } from "react";
import ReactDOM from "react-dom/client";
import type { RoamExtensionAPI, TimeBlockData, TimeBlockSettings, TagConfig } from "../types";
import { loadSettings } from "../settings/settingsPanel";
import { scanTodayForTimeBlocks } from "../core/blockScanner";
import { createTimeBlock, navigateToBlock } from "../core/blockCreator";
import { getTodayPageTitle } from "../api/roamQueries";
import { TimeGrid } from "./TimeGrid";

// Calculate day boundary based on dayEndHour setting
// If dayEndHour > 24, scan next day's page for early morning blocks up to (dayEndHour - 24)
function getDayBoundaryHour(dayEndHour: number): number {
  if (dayEndHour > 24) {
    return dayEndHour - 24; // e.g., 30 -> 6 AM next day
  }
  return 0; // Don't scan next day if dayEndHour <= 24
}

interface CalendarSidebarProps {
  extensionAPI: RoamExtensionAPI;
}

const CalendarSidebar: React.FC<CalendarSidebarProps> = ({ extensionAPI }) => {
  const [timeBlocks, setTimeBlocks] = useState<TimeBlockData[]>([]);
  const [settings, setSettings] = useState<TimeBlockSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [todayTitle, setTodayTitle] = useState("");
  const [selectedTag, setSelectedTag] = useState<TagConfig | null>(null);

  const refreshTimeBlocks = useCallback(() => {
    if (!settings) return;

    setIsLoading(true);
    try {
      const dayBoundaryHour = getDayBoundaryHour(settings.dayEndHour);
      const blocks = scanTodayForTimeBlocks(settings.configuredTags, dayBoundaryHour);
      setTimeBlocks(blocks);
      setTodayTitle(getTodayPageTitle());
    } catch (error) {
      console.error("[TimeBlock] Error scanning for time blocks:", error);
    } finally {
      setIsLoading(false);
    }
  }, [settings]);

  // Load settings on mount
  useEffect(() => {
    const loadedSettings = loadSettings(extensionAPI);
    setSettings(loadedSettings);
    // Set default selected tag
    if (loadedSettings.configuredTags.length > 0) {
      setSelectedTag(loadedSettings.configuredTags[0]);
    }
  }, [extensionAPI]);

  // Refresh blocks when settings change
  useEffect(() => {
    if (settings) {
      refreshTimeBlocks();
    }
  }, [settings, refreshTimeBlocks]);

  // Set up periodic refresh
  useEffect(() => {
    const interval = setInterval(refreshTimeBlocks, 30000);
    return () => clearInterval(interval);
  }, [refreshTimeBlocks]);

  // Watch for changes using Roam's native API
  useEffect(() => {
    if (!settings) return;

    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    const debouncedRefresh = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        console.log("[TimeBlock] Data changed, refreshing...");
        refreshTimeBlocks();
      }, 300);
    };

    // Use Roam's addPullWatch to monitor today's page for changes
    const todayTitle = getTodayPageTitle();
    const pullPattern = `[:block/string :block/uid {:block/children ...}]`;
    const lookupRef = `[:node/title "${todayTitle}"]`;

    const watchCallback = (_before: unknown, _after: unknown) => {
      debouncedRefresh();
    };

    // Add pull watch for today's page
    let watchId: number | null = null;
    try {
      if (window.roamAlphaAPI.data?.addPullWatch) {
        watchId = window.roamAlphaAPI.data.addPullWatch(pullPattern, lookupRef, watchCallback);
        console.log("[TimeBlock] Pull watch added for:", todayTitle);
      } else {
        console.log("[TimeBlock] addPullWatch not available, using fallback");
      }
    } catch (e) {
      console.warn("[TimeBlock] Could not add pull watch:", e);
    }

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      if (watchId !== null && window.roamAlphaAPI.data?.removePullWatch) {
        try {
          window.roamAlphaAPI.data.removePullWatch(watchId);
          console.log("[TimeBlock] Pull watch removed");
        } catch (e) {
          console.warn("[TimeBlock] Could not remove pull watch:", e);
        }
      }
    };
  }, [settings, refreshTimeBlocks]);

  const handleBlockClick = useCallback((uid: string) => {
    navigateToBlock(uid);
  }, []);

  const handleCreateBlock = useCallback(
    async (startHour: number, startMinute: number, endHour: number, endMinute: number) => {
      try {
        await createTimeBlock(startHour, startMinute, endHour, endMinute, undefined, selectedTag?.tag);
        refreshTimeBlocks();
      } catch (error) {
        console.error("[TimeBlock] Error creating time block:", error);
      }
    },
    [selectedTag, refreshTimeBlocks]
  );

  if (!settings) {
    return (
      <div className="tb-flex tb-flex-col tb-flex-1 tb-min-h-0 tb-w-full tb-font-sans tb-text-xs tb-bg-[var(--background-color,#fff)]">
        <div className="tb-flex tb-items-center tb-justify-center tb-flex-1 tb-text-[var(--text-secondary,#666)]">
          Loading settings...
        </div>
      </div>
    );
  }

  return (
    <div className="tb-flex tb-flex-col tb-flex-1 tb-min-h-0 tb-w-full tb-font-sans tb-text-xs tb-bg-[var(--background-color,#fff)]">
      {/* Header */}
      <div className="tb-flex tb-justify-between tb-items-center tb-px-3 tb-py-2 tb-border-b tb-border-[var(--border-color,#e0e0e0)] tb-shrink-0">
        <div className="tb-font-semibold tb-text-[13px] tb-text-[var(--text-color,#333)]">
          {todayTitle || "Today"}
        </div>
        <button
          className="tb-bg-transparent tb-border-none tb-cursor-pointer tb-p-1 tb-rounded tb-text-[var(--text-secondary,#666)] tb-flex tb-items-center tb-justify-center hover:tb-bg-[var(--hover-bg,#f0f0f0)] disabled:tb-opacity-50 disabled:tb-cursor-not-allowed"
          onClick={refreshTimeBlocks}
          title="Refresh"
          disabled={isLoading}
        >
          <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
            <path d="M17.65 6.35A7.958 7.958 0 0012 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08A5.99 5.99 0 0112 18c-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z" />
          </svg>
        </button>
      </div>

      {/* Tag Selector */}
      {settings.configuredTags.length > 0 && (
        <div className="tb-flex tb-flex-wrap tb-gap-1.5 tb-px-3 tb-py-2 tb-border-b tb-border-[var(--border-color,#e0e0e0)] tb-shrink-0">
          {settings.configuredTags.map((tag) => (
            <button
              key={tag.tag}
              className={`timeblock-tag-btn ${selectedTag?.tag === tag.tag ? "selected" : ""}`}
              style={{
                backgroundColor: selectedTag?.tag === tag.tag ? tag.color : "transparent",
                borderColor: tag.color,
                color: selectedTag?.tag === tag.tag ? "#fff" : tag.color,
              }}
              onClick={() => setSelectedTag(tag)}
            >
              #{tag.tag}
            </button>
          ))}
        </div>
      )}

      {/* Content */}
      {isLoading ? (
        <div className="tb-flex tb-items-center tb-justify-center tb-flex-1 tb-text-[var(--text-secondary,#666)]">
          Loading...
        </div>
      ) : (
        <TimeGrid
          startHour={settings.dayStartHour}
          endHour={settings.dayEndHour}
          timeBlocks={timeBlocks}
          onBlockClick={handleBlockClick}
          onCreateBlock={handleCreateBlock}
          selectedTagColor={selectedTag?.color}
          dayBoundaryHour={getDayBoundaryHour(settings.dayEndHour)}
          pixelsPerHour={settings.hourHeight}
        />
      )}

      {/* Footer with block count */}
      <div className="tb-px-3 tb-py-1.5 tb-border-t tb-border-[var(--border-color,#e0e0e0)] tb-text-[10px] tb-text-[var(--text-secondary,#888)] tb-text-center tb-shrink-0">
        {timeBlocks.length} time block{timeBlocks.length !== 1 ? "s" : ""}
      </div>
    </div>
  );
};

// Container management
let root: ReactDOM.Root | null = null;
let container: HTMLDivElement | null = null;

export function renderSidebar(extensionAPI: RoamExtensionAPI): void {
  // Create container if it doesn't exist
  if (!container) {
    container = document.createElement("div");
    container.id = "timeblock-sidebar-container";
  }

  // Find the sidebar-content inside right sidebar
  const sidebarContent = document.querySelector("#roam-right-sidebar-content .sidebar-content");

  if (sidebarContent && !container.parentNode) {
    // Insert at the top of sidebar-content
    sidebarContent.prepend(container);
    console.log("[TimeBlock] Inserted into .sidebar-content");
  } else if (!sidebarContent) {
    // Fallback: try to find right-sidebar and prepend there
    const rightSidebar = document.getElementById("right-sidebar");
    if (rightSidebar && !container.parentNode) {
      rightSidebar.prepend(container);
      console.log("[TimeBlock] Fallback: prepended to right-sidebar");
    } else if (!rightSidebar) {
      console.error("[TimeBlock] Could not find sidebar elements");
      // Last resort: floating panel
      document.body.appendChild(container);
      container.style.position = "fixed";
      container.style.right = "20px";
      container.style.top = "50px";
      container.style.width = "300px";
      container.style.zIndex = "9999";
      container.style.boxShadow = "0 4px 12px rgba(0,0,0,0.15)";
      container.style.borderRadius = "8px";
      container.style.overflow = "hidden";
      console.log("[TimeBlock] Using floating panel fallback");
    }
  }

  // Render React component
  if (!root) {
    root = ReactDOM.createRoot(container);
  }

  root.render(<CalendarSidebar extensionAPI={extensionAPI} />);
}

export function unmountSidebar(): void {
  if (root) {
    root.unmount();
    root = null;
  }

  if (container && container.parentNode) {
    container.parentNode.removeChild(container);
  }
  container = null;
}
