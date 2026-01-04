import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import ReactDOM from "react-dom/client";
import type { RoamExtensionAPI, TimeBlockData, TimeBlockSettings, ColorConfig, TagConfig } from "../types";
import { colorConfigsToTagConfigs } from "../types";
import { loadSettings } from "../settings/settingsPanel";
import { scanDateForTimeBlocks, scanWeekForTimeBlocks, getWeekStartDate } from "../core/blockScanner";
import { createTimeBlock, updateBlockTag, removeBlockTag, removeBlockTimeAndTag, updateBlockTime } from "../core/blockCreator";
import { getCurrentViewedDate, getPageTitleForDate, getBlockPageTitle, getDailyPageDate } from "../api/roamQueries";
import { isLightColor, showToast, cleanupToastContainer } from "../core/utils";
import { TimeGrid } from "./TimeGrid";
import { WeekGrid } from "./WeekGrid";

function getDayBoundaryHour(dayEndHour: number): number {
  if (dayEndHour > 24) {
    return dayEndHour - 24;
  }
  return 0;
}

interface CalendarSidebarProps {
  extensionAPI: RoamExtensionAPI;
}

const CalendarSidebar: React.FC<CalendarSidebarProps> = ({ extensionAPI }) => {
  const [timeBlocks, setTimeBlocks] = useState<TimeBlockData[]>([]);
  const [weekBlocks, setWeekBlocks] = useState<Map<string, TimeBlockData[]>>(new Map());
  const [settings, setSettings] = useState<TimeBlockSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [viewedDate, setViewedDate] = useState<Date>(new Date()); // The date being displayed
  const [displayTitle, setDisplayTitle] = useState("");
  const [selectedBlockUids, setSelectedBlockUids] = useState<Set<string>>(new Set());
  const [selectedTagIndex, setSelectedTagIndex] = useState<number>(0); // Remember selected tag for new blocks
  const [viewMode, setViewMode] = useState<"day" | "week">("day"); // Current view mode

  // Track last focused block before user interacts with sidebar
  const lastFocusedBlockRef = useRef<string | null>(null);
  const lastCaptureTimeRef = useRef<number>(0);

  // Refs for performance - avoid re-creating callbacks
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  // Capture focused block - extract UID from DOM active element (more reliable)
  const captureFocusedBlock = useCallback((force = false) => {
    // Throttle captures to avoid performance issues (except when forced)
    const now = Date.now();
    if (!force && now - lastCaptureTimeRef.current < 500) return; // 500ms throttle
    lastCaptureTimeRef.current = now;

    // Method 1: Try Roam API first
    const focused = window.roamAlphaAPI.ui.getFocusedBlock();
    if (focused?.["block-uid"]) {
      lastFocusedBlockRef.current = focused["block-uid"];
      return;
    }

    // Method 2: Fallback to DOM active element (Roam textarea has UID in id attribute)
    const activeEl = document.activeElement;
    if (activeEl?.id && activeEl.id.startsWith("block-input-")) {
      // Roam textarea ID format: block-input-{windowId}-{blockUid} (UID is last 9 chars)
      const blockUid = activeEl.id.substring(activeEl.id.length - 9);
      if (blockUid.length === 9) {
        lastFocusedBlockRef.current = blockUid;
      }
    }

    // Method 3: Find any focused textarea in Roam content
    if (!lastFocusedBlockRef.current) {
      const focusedTextarea = document.querySelector(".roam-body-main textarea:focus, #right-sidebar textarea:focus") as HTMLTextAreaElement;
      if (focusedTextarea?.id?.startsWith("block-input-")) {
        const blockUid = focusedTextarea.id.substring(focusedTextarea.id.length - 9);
        if (blockUid.length === 9) {
          lastFocusedBlockRef.current = blockUid;
        }
      }
    }
  }, []);

  // Capture on mouseenter - force capture to ensure we get the focused block
  const handleMouseEnter = useCallback(() => {
    captureFocusedBlock(true); // Force capture on enter
  }, [captureFocusedBlock]);

  // Throttled mousemove - only capture every 500ms to reduce overhead
  const handleMouseMove = useCallback(() => {
    // The global focusin listener already tracks focus changes
    // Only capture here as a fallback with longer throttle (100ms is set in captureFocusedBlock)
    captureFocusedBlock();
  }, [captureFocusedBlock]);

  const refreshTimeBlocks = useCallback(() => {
    const currentSettings = settingsRef.current;
    if (!currentSettings) return;

    setIsLoading(true);
    try {
      const dayBoundaryHour = getDayBoundaryHour(currentSettings.dayEndHour);
      const tagConfigs = colorConfigsToTagConfigs(currentSettings.colorConfigs);

      if (viewMode === "week") {
        // Week view: load 7 days starting from week start
        const weekStart = getWeekStartDate(viewedDate, currentSettings.weekStartDay);
        const blocks = scanWeekForTimeBlocks(weekStart, tagConfigs, dayBoundaryHour);
        setWeekBlocks(blocks);

        // Format week range title
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 6);
        const formatShort = (d: Date) => `${d.getMonth() + 1}/${d.getDate()}`;
        setDisplayTitle(`${formatShort(weekStart)} - ${formatShort(weekEnd)}`);
      } else {
        // Day view: load single day
        const blocks = scanDateForTimeBlocks(viewedDate, tagConfigs, dayBoundaryHour);
        setTimeBlocks(blocks);
        setDisplayTitle(getPageTitleForDate(viewedDate));
      }
    } catch (error) {
      console.error("[TimeBlock] Error scanning for time blocks:", error);
    } finally {
      setIsLoading(false);
    }
  }, [viewedDate, viewMode]);

  // Global focus listener to track last focused Roam block and update viewed date
  useEffect(() => {
    const handleGlobalFocusIn = (e: FocusEvent) => {
      const target = e.target as HTMLElement;
      if (target?.id?.startsWith("block-input-")) {
        const blockUid = target.id.substring(target.id.length - 9);
        if (blockUid.length === 9) {
          lastFocusedBlockRef.current = blockUid;

          // Check which page this block belongs to
          const pageTitle = getBlockPageTitle(blockUid);
          if (pageTitle) {
            const pageDate = getDailyPageDate(pageTitle);
            if (pageDate) {
              // Block belongs to a daily page - update viewed date
              setViewedDate(pageDate);
            }
          }
        }
      }
    };

    document.addEventListener("focusin", handleGlobalFocusIn);
    return () => document.removeEventListener("focusin", handleGlobalFocusIn);
  }, []);

  // URL change listener for dynamic page detection
  const updateViewedDateFromUrl = useCallback(() => {
    const dateFromUrl = getCurrentViewedDate();
    if (dateFromUrl) {
      // User is viewing a daily page - show that day's blocks
      setViewedDate(dateFromUrl);
    } else {
      // Not on a daily page - default to today
      setViewedDate(new Date());
    }
  }, []);

  useEffect(() => {
    // Check on mount
    updateViewedDateFromUrl();

    // Listen for URL changes
    window.addEventListener("hashchange", updateViewedDateFromUrl);
    window.addEventListener("popstate", updateViewedDateFromUrl);

    return () => {
      window.removeEventListener("hashchange", updateViewedDateFromUrl);
      window.removeEventListener("popstate", updateViewedDateFromUrl);
    };
  }, [updateViewedDateFromUrl]);

  // Load settings on mount
  useEffect(() => {
    const loadedSettings = loadSettings(extensionAPI);
    setSettings(loadedSettings);
  }, [extensionAPI]);

  // Refresh blocks when settings change
  useEffect(() => {
    if (settings) {
      refreshTimeBlocks();
    }
  }, [settings, refreshTimeBlocks]);

  // Watch for changes - optimized with longer debounce
  useEffect(() => {
    if (!settings) return;

    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    const debouncedRefresh = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(refreshTimeBlocks, 1500); // 1.5s debounce for typing
    };

    const pageTitle = getPageTitleForDate(viewedDate);
    const pullPattern = `[:block/string :block/uid]`;
    const lookupRef = `[:node/title "${pageTitle}"]`;

    let watchId: number | null = null;
    try {
      if (window.roamAlphaAPI.data?.addPullWatch) {
        watchId = window.roamAlphaAPI.data.addPullWatch(pullPattern, lookupRef, debouncedRefresh);
      }
    } catch (e) {
      console.warn("[TimeBlock] Could not add pull watch:", e);
    }

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      if (watchId !== null && window.roamAlphaAPI.data?.removePullWatch) {
        try {
          window.roamAlphaAPI.data.removePullWatch(watchId);
        } catch (e) {
          // Ignore
        }
      }
    };
  }, [settings, refreshTimeBlocks, viewedDate]);

  // Handle clicking on a time block - only for selection
  const handleBlockClick = useCallback(
    (uid: string, event: React.MouseEvent) => {
      const isMultiSelect = event.ctrlKey || event.metaKey || event.shiftKey;

      if (isMultiSelect) {
        // Multi-select mode: toggle selection
        setSelectedBlockUids((prev) => {
          const newSet = new Set(prev);
          if (newSet.has(uid)) {
            newSet.delete(uid);
          } else {
            newSet.add(uid);
          }
          return newSet;
        });
      } else {
        // Single click mode: toggle selection
        if (selectedBlockUids.has(uid) && selectedBlockUids.size === 1) {
          // Click on already selected block - deselect it
          setSelectedBlockUids(new Set());
        } else {
          // Select this block only
          setSelectedBlockUids(new Set([uid]));
        }
      }
    },
    [selectedBlockUids]
  );

  // Handle clicking on a tag button - select tag and optionally apply to selected blocks
  const handleTagClick = useCallback(
    async (config: ColorConfig, index: number) => {
      const currentSettings = settingsRef.current;
      if (!currentSettings) return;

      // Always remember the selected tag for new blocks
      setSelectedTagIndex(index);

      // If blocks are selected, apply the tag to them
      if (selectedBlockUids.size > 0 && config.tags.length > 0) {
        const tagConfigs = colorConfigsToTagConfigs(currentSettings.colorConfigs);
        const tagConfig: TagConfig = { tag: config.tags[0], color: config.color, isPageRef: false };

        for (const uid of selectedBlockUids) {
          try {
            await updateBlockTag(uid, tagConfig, tagConfigs);
          } catch (error) {
            console.error("[TimeBlock] Error updating block tag:", error);
            showToast("Failed to update block tag", "error");
          }
        }
        setSelectedBlockUids(new Set());
        // Small delay to let Roam commit the changes
        setTimeout(refreshTimeBlocks, 100);
      }
    },
    [selectedBlockUids, refreshTimeBlocks]
  );

  // Handle removing tags AND time from selected blocks (Remove button)
  const handleRemoveTag = useCallback(async () => {
    const currentSettings = settingsRef.current;
    if (!currentSettings || selectedBlockUids.size === 0) return;

    const tagConfigs = colorConfigsToTagConfigs(currentSettings.colorConfigs);

    for (const uid of selectedBlockUids) {
      try {
        await removeBlockTimeAndTag(uid, tagConfigs);
      } catch (error) {
        console.error("[TimeBlock] Error removing block tag:", error);
        showToast("Failed to remove block", "error");
      }
    }
    setSelectedBlockUids(new Set());
    // Small delay to let Roam commit the changes
    setTimeout(refreshTimeBlocks, 100);
  }, [selectedBlockUids, refreshTimeBlocks]);

  // Handle right-click to remove tag
  const handleBlockContextMenu = useCallback(
    async (uid: string, event: React.MouseEvent) => {
      event.preventDefault();
      const currentSettings = settingsRef.current;
      if (!currentSettings) return;

      const uidsToUpdate = selectedBlockUids.has(uid) ? Array.from(selectedBlockUids) : [uid];
      const tagConfigs = colorConfigsToTagConfigs(currentSettings.colorConfigs);

      for (const blockUid of uidsToUpdate) {
        try {
          await removeBlockTag(blockUid, tagConfigs);
        } catch (error) {
          console.error("[TimeBlock] Error removing block tag:", error);
          showToast("Failed to remove tag", "error");
        }
      }

      setSelectedBlockUids(new Set());
      // Small delay to let Roam commit the changes
      setTimeout(refreshTimeBlocks, 100);
    },
    [selectedBlockUids, refreshTimeBlocks]
  );

  // Handle dragging time block to change time
  const handleBlockDrag = useCallback(
    async (uid: string, newStartHour: number, newStartMinute: number, newEndHour: number, newEndMinute: number) => {
      try {
        await updateBlockTime(uid, newStartHour, newStartMinute, newEndHour, newEndMinute);
        // Small delay to let Roam commit the changes
        setTimeout(refreshTimeBlocks, 100);
      } catch (error) {
        console.error("[TimeBlock] Error updating block time:", error);
        showToast("Failed to update block time", "error");
      }
    },
    [refreshTimeBlocks]
  );

  const handleCreateBlock = useCallback(
    async (startHour: number, startMinute: number, endHour: number, endMinute: number) => {
      try {
        const currentSettings = settingsRef.current;
        // Get the selected tag from colorConfigs
        const tagsWithConfig = currentSettings?.colorConfigs.filter((c) => c.tags.length > 0) || [];
        const selectedConfig = tagsWithConfig[selectedTagIndex];
        const tag = selectedConfig?.tags[0];

        await createTimeBlock(startHour, startMinute, endHour, endMinute, lastFocusedBlockRef.current || undefined, tag);
        // Don't clear ref - keep it so multiple blocks can be created at same location
        // The global focus listener will update it when user clicks elsewhere in Roam
        // Small delay to let Roam commit the changes
        setTimeout(refreshTimeBlocks, 100);
      } catch (error) {
        console.error("[TimeBlock] Error creating time block:", error);
        showToast("Failed to create block", "error");
      }
    },
    [selectedTagIndex, refreshTimeBlocks]
  );

  // Clear selection when clicking outside
  const handleGridClick = useCallback(() => {
    // Don't clear if clicking on a block (handled by handleBlockClick)
  }, []);

  const handlePrevious = useCallback(() => {
    setViewedDate((prev) => {
      const newDate = new Date(prev);
      if (viewMode === "week") {
        newDate.setDate(newDate.getDate() - 7);
      } else {
        newDate.setDate(newDate.getDate() - 1);
      }
      return newDate;
    });
  }, [viewMode]);

  const handleNext = useCallback(() => {
    setViewedDate((prev) => {
      const newDate = new Date(prev);
      if (viewMode === "week") {
        newDate.setDate(newDate.getDate() + 7);
      } else {
        newDate.setDate(newDate.getDate() + 1);
      }
      return newDate;
    });
  }, [viewMode]);

  const handleGoToToday = useCallback(() => {
    setViewedDate(new Date());
  }, []);

  // Combined refresh: re-detect page and refresh blocks
  const handleRefresh = useCallback(() => {
    updateViewedDateFromUrl();
    // refreshTimeBlocks will be called automatically when viewedDate changes
    // But also call it directly in case the date didn't change
    refreshTimeBlocks();
  }, [updateViewedDateFromUrl, refreshTimeBlocks]);

  // Calculate week dates and page titles for WeekGrid
  const weekData = useMemo(() => {
    if (!settings || viewMode !== "week") return null;

    const weekStart = getWeekStartDate(viewedDate, settings.weekStartDay);
    const dates: Date[] = [];
    const titles: string[] = [];

    for (let i = 0; i < 7; i++) {
      const date = new Date(weekStart);
      date.setDate(date.getDate() + i);
      dates.push(date);
      titles.push(getPageTitleForDate(date));
    }

    return { dates, titles };
  }, [viewedDate, settings, viewMode]);

  // Memoized week block count to avoid recalculating on every render
  const weekBlockCount = useMemo(() => {
    if (viewMode !== "week") return 0;
    let total = 0;
    for (const blocks of weekBlocks.values()) {
      total += blocks.length;
    }
    return total;
  }, [weekBlocks, viewMode]);

  if (!settings) {
    return (
      <div className="tb-flex tb-flex-col tb-flex-1 tb-min-h-0 tb-w-full tb-font-sans tb-text-xs tb-bg-[var(--background-color,#fff)]">
        <div className="tb-flex tb-items-center tb-justify-center tb-flex-1 tb-text-[var(--text-secondary,#666)]">
          Loading...
        </div>
      </div>
    );
  }

  return (
    <div
      className="tb-flex tb-flex-col tb-flex-1 tb-min-h-0 tb-w-full tb-font-sans tb-text-xs tb-bg-[var(--background-color,#fff)]"
      onMouseEnter={handleMouseEnter}
      onMouseMove={handleMouseMove}
    >
      {/* Header */}
      <div className="tb-flex tb-justify-between tb-items-center tb-px-2 tb-py-1.5 tb-border-b tb-border-[var(--border-color,#e0e0e0)] tb-shrink-0">
        <div className="tb-flex tb-items-center tb-gap-1">
          {/* Navigation buttons */}
          <button
            className="tb-bg-transparent tb-border-none tb-cursor-pointer tb-p-1 tb-rounded tb-text-[var(--text-secondary,#666)] tb-flex tb-items-center tb-justify-center hover:tb-bg-[var(--hover-bg,#f0f0f0)]"
            onClick={handlePrevious}
            title={viewMode === "week" ? "Previous week" : "Previous day"}
          >
            <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
              <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z" />
            </svg>
          </button>
          <button
            className="tb-bg-transparent tb-border-none tb-cursor-pointer tb-px-1.5 tb-py-0.5 tb-rounded tb-text-[10px] tb-text-[var(--text-secondary,#666)] hover:tb-bg-[var(--hover-bg,#f0f0f0)]"
            onClick={handleGoToToday}
            title="Go to today"
          >
            Today
          </button>
          <button
            className="tb-bg-transparent tb-border-none tb-cursor-pointer tb-p-1 tb-rounded tb-text-[var(--text-secondary,#666)] tb-flex tb-items-center tb-justify-center hover:tb-bg-[var(--hover-bg,#f0f0f0)]"
            onClick={handleNext}
            title={viewMode === "week" ? "Next week" : "Next day"}
          >
            <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
              <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z" />
            </svg>
          </button>
        </div>

        <span className="tb-font-semibold tb-text-[12px] tb-text-[var(--text-color,#333)] tb-truncate tb-mx-1">
          {displayTitle || "Today"}
        </span>

        <div className="tb-flex tb-items-center tb-gap-1">
          {/* Delete button - shown when blocks selected */}
          {selectedBlockUids.size > 0 && (
            <button
              className="tb-px-1.5 tb-py-0.5 tb-rounded tb-text-[10px] tb-font-medium tb-border-none tb-cursor-pointer tb-whitespace-nowrap tb-bg-[#e53935] tb-text-white hover:tb-bg-[#c62828]"
              onClick={handleRemoveTag}
              title="Remove tag from selected blocks"
            >
              ✕ {selectedBlockUids.size}
            </button>
          )}
          {/* View mode toggle - segmented control style */}
          <div className="tb-flex tb-rounded tb-overflow-hidden tb-border tb-border-[var(--border-color,#ccc)]">
            <button
              className={`tb-px-2 tb-py-0.5 tb-text-[10px] tb-border-none tb-cursor-pointer tb-transition-colors ${
                viewMode === "day"
                  ? "tb-bg-blue-500 tb-text-white"
                  : "tb-bg-transparent tb-text-[var(--text-secondary,#666)] hover:tb-bg-[var(--hover-bg,#f0f0f0)]"
              }`}
              onClick={() => setViewMode("day")}
              title="Day view"
            >
              Day
            </button>
            <button
              className={`tb-px-2 tb-py-0.5 tb-text-[10px] tb-border-none tb-cursor-pointer tb-border-l tb-border-[var(--border-color,#ccc)] tb-transition-colors ${
                viewMode === "week"
                  ? "tb-bg-blue-500 tb-text-white"
                  : "tb-bg-transparent tb-text-[var(--text-secondary,#666)] hover:tb-bg-[var(--hover-bg,#f0f0f0)]"
              }`}
              onClick={() => setViewMode("week")}
              title="Week view"
            >
              Week
            </button>
          </div>
          <button
            className="tb-bg-transparent tb-border-none tb-cursor-pointer tb-p-1 tb-rounded tb-text-[var(--text-secondary,#666)] tb-flex tb-items-center tb-justify-center hover:tb-bg-[var(--hover-bg,#f0f0f0)] disabled:tb-opacity-50 disabled:tb-cursor-not-allowed"
            onClick={handleRefresh}
            title="Refresh"
            disabled={isLoading}
          >
            <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
              <path d="M17.65 6.35A7.958 7.958 0 0012 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08A5.99 5.99 0 0112 18c-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z" />
            </svg>
          </button>
          <button
            className="tb-bg-transparent tb-border-none tb-cursor-pointer tb-p-1 tb-rounded tb-text-[var(--text-secondary,#666)] tb-flex tb-items-center tb-justify-center hover:tb-bg-[var(--hover-bg,#f0f0f0)] hover:tb-text-[#e53935]"
            onClick={unmountSidebar}
            title="Close"
          >
            <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Tag Selector - select tag for new blocks, or apply to selected blocks */}
      <div className="tb-flex tb-items-center tb-gap-1.5 tb-px-2 tb-py-1.5 tb-border-b tb-border-[var(--border-color,#e0e0e0)] tb-shrink-0 tb-overflow-x-auto">
        {settings.colorConfigs
          .filter((config) => config.tags.length > 0)
          .map((config, index) => {
            const isSelected = selectedTagIndex === index;
            return (
              <button
                key={index}
                className={`tb-px-2 tb-py-0.5 tb-rounded tb-text-[11px] tb-border-2 tb-cursor-pointer tb-whitespace-nowrap tb-transition-all hover:tb-opacity-80 hover:tb-scale-105 ${
                  isSelected ? "tb-ring-2 tb-ring-offset-1 tb-ring-blue-500" : ""
                }`}
                style={{
                  backgroundColor: config.color,
                  color: isLightColor(config.color) ? "#333" : "#fff",
                  borderColor: isSelected ? "white" : "transparent",
                }}
                onClick={() => handleTagClick(config, index)}
                title={isSelected ? `Selected: #${config.tags[0]}` : `Select #${config.tags[0]}`}
              >
                #{config.tags[0]}
              </button>
            );
          })}
        {settings.colorConfigs.filter((c) => c.tags.length > 0).length === 0 && (
          <span className="tb-text-[11px] tb-text-[var(--text-secondary,#888)]">
            No tags configured
          </span>
        )}
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="tb-flex tb-items-center tb-justify-center tb-flex-1 tb-text-[var(--text-secondary,#666)]">
          Loading...
        </div>
      ) : viewMode === "week" && weekData ? (
        <WeekGrid
          startHour={settings.dayStartHour}
          endHour={settings.dayEndHour}
          weekBlocks={weekBlocks}
          weekDates={weekData.dates}
          pageTitles={weekData.titles}
          onBlockClick={handleBlockClick}
          onBlockContextMenu={handleBlockContextMenu}
          pixelsPerHour={settings.hourHeight}
          selectedBlockUids={selectedBlockUids}
          weekStartDay={settings.weekStartDay}
        />
      ) : (
        <TimeGrid
          startHour={settings.dayStartHour}
          endHour={settings.dayEndHour}
          timeBlocks={timeBlocks}
          onBlockClick={handleBlockClick}
          onBlockContextMenu={handleBlockContextMenu}
          onBlockDrag={handleBlockDrag}
          onCreateBlock={handleCreateBlock}
          selectedTagColor={settings.colorConfigs.filter((c) => c.tags.length > 0)[selectedTagIndex]?.color}
          dayBoundaryHour={getDayBoundaryHour(settings.dayEndHour)}
          pixelsPerHour={settings.hourHeight}
          selectedBlockUids={selectedBlockUids}
          timeGranularity={settings.timeGranularity}
        />
      )}

      {/* Footer */}
      <div className="tb-px-3 tb-py-1.5 tb-border-t tb-border-[var(--border-color,#e0e0e0)] tb-text-[10px] tb-text-[var(--text-secondary,#888)] tb-text-center tb-shrink-0">
        {viewMode === "week"
          ? `${weekBlockCount} blocks this week`
          : `${timeBlocks.length} blocks | Click to select | Ctrl+Click multi-select`}
      </div>
    </div>
  );
};

// Container management
let root: ReactDOM.Root | null = null;
let container: HTMLDivElement | null = null;

export function renderSidebar(extensionAPI: RoamExtensionAPI): void {
  if (!container) {
    container = document.createElement("div");
    container.id = "timeblock-sidebar-container";
    // Set container styles for proper height - fill available space
    container.style.display = "flex";
    container.style.flexDirection = "column";
    container.style.height = "100%";
    container.style.flex = "1";
  }

  const sidebarContent = document.querySelector("#roam-right-sidebar-content .sidebar-content");

  if (sidebarContent && !container.parentNode) {
    sidebarContent.prepend(container);
  } else if (!sidebarContent) {
    const rightSidebar = document.getElementById("right-sidebar");
    if (rightSidebar && !container.parentNode) {
      rightSidebar.prepend(container);
    }
  }

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

  // Clean up toast container to prevent memory leaks
  cleanupToastContainer();
}
