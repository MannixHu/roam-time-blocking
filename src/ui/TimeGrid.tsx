import React, { useRef, useState, useCallback } from "react";
import type { TimeBlockData, TagConfig } from "../types";
import { TimeBlock } from "./TimeBlock";
import { DragSelection, DragSelectionData } from "./DragSelection";
import { snapToGrid, formatTime } from "../core/timeParser";

interface TimeGridProps {
  startHour: number;
  endHour: number;
  timeBlocks: TimeBlockData[];
  onBlockClick: (uid: string) => void;
  onCreateBlock: (startHour: number, startMinute: number, endHour: number, endMinute: number) => void;
  selectedTagColor?: string;
  dayBoundaryHour?: number; // Hour that marks the start of a new day (default 5)
  pixelsPerHour?: number; // Configurable height per hour (default 48)
}

const DEFAULT_PIXELS_PER_HOUR = 48;
const GRANULARITY = 15; // 15-minute granularity

// Calculate column layout for overlapping blocks
interface BlockLayout {
  block: TimeBlockData;
  column: number;
  totalColumns: number;
}

function calculateBlockLayouts(blocks: TimeBlockData[]): BlockLayout[] {
  if (blocks.length === 0) return [];

  // Sort blocks by start time, then by end time (longer blocks first)
  const sorted = [...blocks].sort((a, b) => {
    const aStart = a.timeRange.startHour * 60 + a.timeRange.startMinute;
    const bStart = b.timeRange.startHour * 60 + b.timeRange.startMinute;
    if (aStart !== bStart) return aStart - bStart;
    const aEnd = a.timeRange.endHour * 60 + a.timeRange.endMinute;
    const bEnd = b.timeRange.endHour * 60 + b.timeRange.endMinute;
    return bEnd - aEnd; // Longer blocks first
  });

  // Track columns: each column has an end time
  const columns: number[] = [];
  const layouts: Map<string, { column: number; group: TimeBlockData[] }> = new Map();

  // Group overlapping blocks and assign columns
  for (const block of sorted) {
    const start = block.timeRange.startHour * 60 + block.timeRange.startMinute;
    const end = block.timeRange.endHour * 60 + block.timeRange.endMinute;

    // Find first available column
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

    layouts.set(block.uid, { column, group: [] });
  }

  // Calculate total columns for each overlapping group
  const result: BlockLayout[] = [];

  for (const block of sorted) {
    const layout = layouts.get(block.uid)!;
    const start = block.timeRange.startHour * 60 + block.timeRange.startMinute;
    const end = block.timeRange.endHour * 60 + block.timeRange.endMinute;

    // Find all blocks that overlap with this one
    let maxColumn = layout.column;
    for (const other of sorted) {
      if (other.uid === block.uid) continue;
      const otherStart = other.timeRange.startHour * 60 + other.timeRange.startMinute;
      const otherEnd = other.timeRange.endHour * 60 + other.timeRange.endMinute;

      // Check overlap
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

// Format hour for display, handling hours > 24 (next day early morning)
function formatHourLabel(hour: number): string {
  const actualHour = hour % 24;
  const pad = (n: number) => n.toString().padStart(2, "0");
  if (hour >= 24) {
    return `${pad(actualHour)}:00 +1`;
  }
  return `${pad(actualHour)}:00`;
}

export const TimeGrid: React.FC<TimeGridProps> = ({
  startHour,
  endHour,
  timeBlocks,
  onBlockClick,
  onCreateBlock,
  selectedTagColor,
  dayBoundaryHour = 5,
  pixelsPerHour = DEFAULT_PIXELS_PER_HOUR,
}) => {
  const gridRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<number | null>(null);
  const [dragCurrent, setDragCurrent] = useState<number | null>(null);

  // Use configurable pixels per hour
  const PIXELS_PER_HOUR = pixelsPerHour;

  // Calculate total hours, supporting cross-midnight (e.g., 6:00 to 29:00 for 6AM to 5AM next day)
  const effectiveEndHour = endHour <= startHour ? endHour + 24 : endHour;
  const hours = Array.from({ length: effectiveEndHour - startHour }, (_, i) => startHour + i);

  const getMinutesFromY = useCallback(
    (y: number): number => {
      if (!gridRef.current) return 0;
      const rect = gridRef.current.getBoundingClientRect();
      const relativeY = y - rect.top + gridRef.current.scrollTop;
      const minutes = (relativeY / PIXELS_PER_HOUR) * 60 + startHour * 60;
      return snapToGrid(Math.max(startHour * 60, Math.min(effectiveEndHour * 60, minutes)), GRANULARITY);
    },
    [startHour, effectiveEndHour]
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      // Only start drag on the grid background, not on blocks
      if ((e.target as HTMLElement).closest("[data-timeblock]")) return;

      const minutes = getMinutesFromY(e.clientY);
      setIsDragging(true);
      setDragStart(minutes);
      setDragCurrent(minutes);
    },
    [getMinutesFromY]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isDragging) return;
      const minutes = getMinutesFromY(e.clientY);
      setDragCurrent(minutes);
    },
    [isDragging, getMinutesFromY]
  );

  const handleMouseUp = useCallback(() => {
    if (!isDragging || dragStart === null || dragCurrent === null) {
      setIsDragging(false);
      setDragStart(null);
      setDragCurrent(null);
      return;
    }

    const startMinutes = Math.min(dragStart, dragCurrent);
    const endMinutes = Math.max(dragStart, dragCurrent);

    // Ensure minimum 15-minute block
    const adjustedEnd = Math.max(endMinutes, startMinutes + GRANULARITY);

    // Only create if there's a meaningful selection
    if (adjustedEnd > startMinutes) {
      const startH = Math.floor(startMinutes / 60);
      const startM = startMinutes % 60;
      const endH = Math.floor(adjustedEnd / 60);
      const endM = adjustedEnd % 60;

      onCreateBlock(startH, startM, endH, endM);
    }

    setIsDragging(false);
    setDragStart(null);
    setDragCurrent(null);
  }, [isDragging, dragStart, dragCurrent, onCreateBlock]);

  const handleMouseLeave = useCallback(() => {
    if (isDragging) {
      setIsDragging(false);
      setDragStart(null);
      setDragCurrent(null);
    }
  }, [isDragging]);

  // Calculate drag selection display
  const dragSelection: DragSelectionData | null =
    isDragging && dragStart !== null && dragCurrent !== null
      ? (() => {
          const startMinutes = Math.min(dragStart, dragCurrent);
          const endMinutes = Math.max(dragStart, dragCurrent);
          const adjustedEnd = Math.max(endMinutes, startMinutes + GRANULARITY);

          const top = ((startMinutes - startHour * 60) / 60) * PIXELS_PER_HOUR;
          const height = ((adjustedEnd - startMinutes) / 60) * PIXELS_PER_HOUR;

          const startH = Math.floor(startMinutes / 60);
          const startM = startMinutes % 60;
          const endH = Math.floor(adjustedEnd / 60);
          const endM = adjustedEnd % 60;

          return {
            top,
            height,
            startTime: formatTime(startH, startM),
            endTime: formatTime(endH, endM),
          };
        })()
      : null;

  return (
    <div
      ref={gridRef}
      className="tb-flex-1 tb-flex tb-overflow-y-auto tb-relative tb-select-none tb-cursor-crosshair"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
    >
      {/* Hour labels */}
      <div className="tb-w-[45px] tb-shrink-0 tb-border-r tb-border-[var(--border-color,#e0e0e0)] tb-bg-[var(--background-color,#fff)]">
        {hours.map((hour) => (
          <div
            key={hour}
            className="tb-flex tb-items-start tb-justify-end tb-pr-1.5 tb-pt-0.5 tb-text-[10px] tb-text-[var(--text-secondary,#888)]"
            style={{ height: PIXELS_PER_HOUR }}
          >
            {formatHourLabel(hour)}
          </div>
        ))}
      </div>

      {/* Blocks container */}
      <div className="tb-flex-1 tb-relative tb-min-h-full">
        {/* Hour grid lines */}
        {hours.map((hour) => (
          <div
            key={hour}
            className="tb-absolute tb-left-0 tb-right-0 tb-h-px tb-bg-[var(--border-color,#e0e0e0)] tb-pointer-events-none"
            style={{ top: (hour - startHour) * PIXELS_PER_HOUR }}
          />
        ))}

        {/* Half-hour grid lines (subtle dashed) */}
        {hours.map((hour) => (
          <div
            key={`${hour}-half`}
            className="tb-absolute tb-left-0 tb-right-0 tb-h-0 tb-border-t tb-border-dashed tb-border-[var(--border-light,#e8e8e8)] tb-opacity-60 tb-pointer-events-none"
            style={{ top: (hour - startHour) * PIXELS_PER_HOUR + PIXELS_PER_HOUR / 2 }}
          />
        ))}

        {/* Rendered time blocks with column layout for overlaps */}
        {calculateBlockLayouts(timeBlocks).map(({ block, column, totalColumns }) => (
          <TimeBlock
            key={block.uid}
            data={block}
            startHour={startHour}
            pixelsPerHour={PIXELS_PER_HOUR}
            onClick={() => onBlockClick(block.uid)}
            column={column}
            totalColumns={totalColumns}
          />
        ))}

        {/* Drag selection overlay */}
        {dragSelection && <DragSelection selection={dragSelection} color={selectedTagColor} />}
      </div>
    </div>
  );
};
