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
}

const PIXELS_PER_HOUR = 60;
const GRANULARITY = 15; // 15-minute granularity

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
}) => {
  const gridRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<number | null>(null);
  const [dragCurrent, setDragCurrent] = useState<number | null>(null);

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
      if ((e.target as HTMLElement).closest(".timeblock-block")) return;

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
      className="timeblock-grid"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
    >
      {/* Hour labels */}
      <div className="timeblock-hour-labels">
        {hours.map((hour) => (
          <div key={hour} className="timeblock-hour-label" style={{ height: PIXELS_PER_HOUR }}>
            {formatHourLabel(hour)}
          </div>
        ))}
      </div>

      {/* Blocks container */}
      <div className="timeblock-blocks-container">
        {/* Hour grid lines */}
        {hours.map((hour) => (
          <div
            key={hour}
            className="timeblock-hour-line"
            style={{ top: (hour - startHour) * PIXELS_PER_HOUR }}
          />
        ))}

        {/* Half-hour grid lines (subtle) */}
        {hours.map((hour) => (
          <div
            key={`${hour}-half`}
            className="timeblock-half-hour-line"
            style={{ top: (hour - startHour) * PIXELS_PER_HOUR + PIXELS_PER_HOUR / 2 }}
          />
        ))}

        {/* Rendered time blocks */}
        {timeBlocks.map((block) => (
          <TimeBlock
            key={block.uid}
            data={block}
            startHour={startHour}
            pixelsPerHour={PIXELS_PER_HOUR}
            onClick={() => onBlockClick(block.uid)}
          />
        ))}

        {/* Drag selection overlay */}
        {dragSelection && <DragSelection selection={dragSelection} color={selectedTagColor} />}
      </div>
    </div>
  );
};
