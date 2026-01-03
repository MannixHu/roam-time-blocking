/**
 * WeekGrid - 7-day week view
 */
import React, { useMemo, useCallback } from "react";
import type { TimeBlockData } from "../types";
import { formatTime } from "../core/timeParser";

interface WeekGridProps {
  startHour: number;
  endHour: number;
  weekBlocks: Map<string, TimeBlockData[]>; // keyed by page title
  weekDates: Date[]; // 7 dates in order
  pageTitles: string[]; // 7 page titles matching the dates
  onBlockClick: (uid: string, event: React.MouseEvent) => void;
  onBlockContextMenu: (uid: string, event: React.MouseEvent) => void;
  pixelsPerHour?: number;
  selectedBlockUids: Set<string>;
  weekStartDay: 0 | 1;
}

const DEFAULT_PIXELS_PER_HOUR = 48;
const DAY_NAMES_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAY_NAMES_MON_START = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function formatHourLabel(hour: number): string {
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${pad(hour)}:00`;
}

function formatDayHeader(date: Date, weekStartDay: 0 | 1): { dayName: string; dayNum: string } {
  const dayOfWeek = date.getDay();
  const dayName = weekStartDay === 1 ? DAY_NAMES_MON_START[dayOfWeek === 0 ? 6 : dayOfWeek - 1] : DAY_NAMES_SHORT[dayOfWeek];
  const dayNum = date.getDate().toString();
  return { dayName, dayNum };
}

// Calculate column layout for overlapping blocks within a day
interface BlockLayout {
  block: TimeBlockData;
  column: number;
  totalColumns: number;
}

function calculateBlockLayouts(blocks: TimeBlockData[]): BlockLayout[] {
  if (blocks.length === 0) return [];

  const sorted = [...blocks].sort((a, b) => {
    const aStart = a.timeRange.startHour * 60 + a.timeRange.startMinute;
    const bStart = b.timeRange.startHour * 60 + b.timeRange.startMinute;
    if (aStart !== bStart) return aStart - bStart;
    const aEnd = a.timeRange.endHour * 60 + a.timeRange.endMinute;
    const bEnd = b.timeRange.endHour * 60 + b.timeRange.endMinute;
    return bEnd - aEnd;
  });

  const columns: number[] = [];
  const layouts: Map<string, { column: number }> = new Map();

  for (const block of sorted) {
    const start = block.timeRange.startHour * 60 + block.timeRange.startMinute;
    const end = block.timeRange.endHour * 60 + block.timeRange.endMinute;

    let column = -1;
    for (let i = 0; i < columns.length; i++) {
      if (columns[i] <= start) {
        column = i;
        break;
      }
    }

    if (column === -1) {
      column = columns.length;
      columns.push(end);
    } else {
      columns[column] = end;
    }

    layouts.set(block.uid, { column });
  }

  const result: BlockLayout[] = [];

  for (const block of sorted) {
    const layout = layouts.get(block.uid)!;
    const start = block.timeRange.startHour * 60 + block.timeRange.startMinute;
    const end = block.timeRange.endHour * 60 + block.timeRange.endMinute;

    let maxColumn = layout.column;
    for (const other of sorted) {
      if (other.uid === block.uid) continue;
      const otherStart = other.timeRange.startHour * 60 + other.timeRange.startMinute;
      const otherEnd = other.timeRange.endHour * 60 + other.timeRange.endMinute;

      if (start < otherEnd && end > otherStart) {
        const otherLayout = layouts.get(other.uid)!;
        maxColumn = Math.max(maxColumn, otherLayout.column);
      }
    }

    result.push({
      block,
      column: layout.column,
      totalColumns: maxColumn + 1,
    });
  }

  return result;
}

// Check if a date is today
function isToday(date: Date): boolean {
  const today = new Date();
  return (
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear()
  );
}

// Check if a color is light (for text contrast)
function isLightColor(hex: string): boolean {
  const color = hex.replace("#", "");
  const r = parseInt(color.substring(0, 2), 16);
  const g = parseInt(color.substring(2, 4), 16);
  const b = parseInt(color.substring(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5;
}

export const WeekGrid: React.FC<WeekGridProps> = ({
  startHour,
  endHour,
  weekBlocks,
  weekDates,
  pageTitles,
  onBlockClick,
  onBlockContextMenu,
  pixelsPerHour = DEFAULT_PIXELS_PER_HOUR,
  selectedBlockUids,
  weekStartDay,
}) => {
  const PIXELS_PER_HOUR = pixelsPerHour;
  const effectiveEndHour = endHour <= startHour ? endHour + 24 : endHour;
  const hours = Array.from({ length: effectiveEndHour - startHour }, (_, i) => startHour + i);
  const gridHeight = hours.length * PIXELS_PER_HOUR;

  // Memoize block layouts for each day
  const dayLayouts = useMemo(() => {
    const layouts = new Map<string, BlockLayout[]>();
    for (const title of pageTitles) {
      const dayBlocks = weekBlocks.get(title) || [];
      layouts.set(title, calculateBlockLayouts(dayBlocks));
    }
    return layouts;
  }, [weekBlocks, pageTitles]);

  return (
    <div className="tb-flex tb-flex-col tb-flex-1 tb-overflow-hidden">
      {/* Day headers */}
      <div className="tb-flex tb-shrink-0 tb-border-b tb-border-[var(--border-color,#e0e0e0)]">
        {/* Empty space for hour labels */}
        <div className="tb-w-[35px] tb-shrink-0" />

        {weekDates.map((date, i) => {
          const { dayName, dayNum } = formatDayHeader(date, weekStartDay);
          const today = isToday(date);
          return (
            <div
              key={i}
              className={`tb-flex-1 tb-min-w-0 tb-text-center tb-py-1 tb-border-l tb-border-[var(--border-color,#e0e0e0)] ${
                today ? "tb-bg-blue-50" : ""
              }`}
            >
              <div className="tb-text-[10px] tb-text-[var(--text-secondary,#888)]">{dayName}</div>
              <div
                className={`tb-text-[12px] tb-font-semibold ${
                  today ? "tb-text-blue-600" : "tb-text-[var(--text-color,#333)]"
                }`}
              >
                {dayNum}
              </div>
            </div>
          );
        })}
      </div>

      {/* Scrollable content */}
      <div className="tb-flex tb-flex-1 tb-overflow-y-auto">
        {/* Hour labels */}
        <div className="tb-w-[35px] tb-shrink-0 tb-border-r tb-border-[var(--border-color,#e0e0e0)] tb-bg-[var(--background-color,#fff)]">
          {hours.map((hour) => (
            <div
              key={hour}
              className="tb-flex tb-items-start tb-justify-end tb-pr-1 tb-pt-0.5 tb-text-[9px] tb-text-[var(--text-secondary,#888)]"
              style={{ height: PIXELS_PER_HOUR }}
            >
              {formatHourLabel(hour)}
            </div>
          ))}
        </div>

        {/* Day columns */}
        {weekDates.map((date, dayIndex) => {
          const pageTitle = pageTitles[dayIndex];
          const layouts = dayLayouts.get(pageTitle) || [];
          const today = isToday(date);

          return (
            <div
              key={dayIndex}
              className={`tb-flex-1 tb-min-w-0 tb-relative tb-border-l tb-border-[var(--border-color,#e0e0e0)] ${
                today ? "tb-bg-blue-50/30" : ""
              }`}
              style={{ height: gridHeight }}
            >
              {/* Hour grid lines */}
              {hours.map((hour) => (
                <div
                  key={hour}
                  className="tb-absolute tb-left-0 tb-right-0 tb-h-px tb-bg-[var(--border-color,#e0e0e0)] tb-pointer-events-none"
                  style={{ top: (hour - startHour) * PIXELS_PER_HOUR }}
                />
              ))}

              {/* Half-hour grid lines */}
              {hours.map((hour) => (
                <div
                  key={`${hour}-half`}
                  className="tb-absolute tb-left-0 tb-right-0 tb-h-0 tb-border-t tb-border-dashed tb-border-[var(--border-light,#e8e8e8)] tb-opacity-40 tb-pointer-events-none"
                  style={{ top: (hour - startHour) * PIXELS_PER_HOUR + PIXELS_PER_HOUR / 2 }}
                />
              ))}

              {/* Time blocks for this day */}
              {layouts.map(({ block, column, totalColumns }) => {
                const startMinutes = block.timeRange.startHour * 60 + block.timeRange.startMinute;
                const endMinutes = block.timeRange.endHour * 60 + block.timeRange.endMinute;
                const top = ((startMinutes - startHour * 60) / 60) * PIXELS_PER_HOUR;
                const height = Math.max(((endMinutes - startMinutes) / 60) * PIXELS_PER_HOUR, 16);
                const width = `${100 / totalColumns}%`;
                const left = `${(column / totalColumns) * 100}%`;
                const isSelected = selectedBlockUids.has(block.uid);
                const bgColor = block.tag?.color || "#cccccc";

                return (
                  <div
                    key={block.uid}
                    data-timeblock={block.uid}
                    className={`tb-absolute tb-overflow-hidden tb-rounded-sm tb-text-[8px] tb-leading-tight tb-cursor-pointer tb-transition-shadow hover:tb-shadow-md ${
                      isSelected ? "tb-ring-2 tb-ring-blue-500 tb-ring-offset-1 tb-shadow-lg" : ""
                    }`}
                    style={{
                      top,
                      height,
                      width,
                      left,
                      backgroundColor: bgColor,
                      borderLeft: "2px solid rgba(0,0,0,0.15)",
                      color: isLightColor(bgColor) ? "#333" : "#fff",
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      onBlockClick(block.uid, e);
                    }}
                    onContextMenu={(e) => {
                      e.stopPropagation();
                      onBlockContextMenu(block.uid, e);
                    }}
                  >
                    <div className="tb-px-0.5 tb-py-px tb-truncate">
                      {formatTime(block.timeRange.startHour, block.timeRange.startMinute)}
                    </div>
                    {height > 24 && (
                      <div className="tb-px-0.5 tb-truncate tb-opacity-90">
                        {block.text.replace(block.timeRange.originalText, "").trim() ||
                          (block.tag?.tag ? `#${block.tag.tag}` : "")}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
};
