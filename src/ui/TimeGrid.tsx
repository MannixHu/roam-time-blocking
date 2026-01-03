/**
 * TimeGrid with @dnd-kit for drag interactions
 */
import React, { useState, useCallback, useMemo, useEffect } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
  DragMoveEvent,
  Modifier,
} from "@dnd-kit/core";
import { restrictToVerticalAxis, restrictToParentElement } from "@dnd-kit/modifiers";

import type { TimeBlockData } from "../types";
import { TimeBlock } from "./TimeBlock";
import { DragSelection, DragSelectionData } from "./DragSelection";
import { snapToGrid, formatTime } from "../core/timeParser";

interface TimeGridProps {
  startHour: number;
  endHour: number;
  timeBlocks: TimeBlockData[];
  onBlockClick: (uid: string, event: React.MouseEvent) => void;
  onBlockContextMenu: (uid: string, event: React.MouseEvent) => void;
  onBlockDrag: (uid: string, newStartHour: number, newStartMinute: number, newEndHour: number, newEndMinute: number) => void;
  onCreateBlock: (startHour: number, startMinute: number, endHour: number, endMinute: number) => void;
  selectedTagColor?: string;
  dayBoundaryHour?: number;
  pixelsPerHour?: number;
  selectedBlockUids: Set<string>;
  timeGranularity?: number;
}

const DEFAULT_PIXELS_PER_HOUR = 48;
const DEFAULT_GRANULARITY = 15; // 15-minute granularity

// Calculate column layout for overlapping blocks
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

function formatHourLabel(hour: number): { displayTime: string; actualTime: string | null } {
  const pad = (n: number) => n.toString().padStart(2, "0");
  if (hour >= 24) {
    const actualHour = hour % 24;
    return {
      displayTime: `${pad(hour)}:00`,
      actualTime: `${pad(actualHour)}:00`,
    };
  }
  return {
    displayTime: `${pad(hour)}:00`,
    actualTime: null,
  };
}

export const TimeGrid: React.FC<TimeGridProps> = ({
  startHour,
  endHour,
  timeBlocks,
  onBlockClick,
  onBlockContextMenu,
  onBlockDrag,
  onCreateBlock,
  selectedTagColor,
  dayBoundaryHour = 5,
  pixelsPerHour = DEFAULT_PIXELS_PER_HOUR,
  selectedBlockUids,
  timeGranularity = DEFAULT_GRANULARITY,
}) => {
  const PIXELS_PER_HOUR = pixelsPerHour;
  const GRANULARITY = timeGranularity;
  const effectiveEndHour = endHour <= startHour ? endHour + 24 : endHour;
  const hours = Array.from({ length: effectiveEndHour - startHour }, (_, i) => startHour + i);

  // Drag state
  const [activeId, setActiveId] = useState<string | null>(null);
  const [dragDelta, setDragDelta] = useState<number>(0); // pixels

  // Drag-to-create state
  const [isCreating, setIsCreating] = useState(false);
  const [createStartY, setCreateStartY] = useState<number | null>(null);
  const [createCurrentY, setCreateCurrentY] = useState<number | null>(null);
  const [createStartClientY, setCreateStartClientY] = useState<number | null>(null); // Track pixel position for drag threshold
  const gridRef = React.useRef<HTMLDivElement>(null);

  // Resize state
  const [resizingUid, setResizingUid] = useState<string | null>(null);
  const [resizeEdge, setResizeEdge] = useState<"top" | "bottom" | null>(null);
  const [resizeStartY, setResizeStartY] = useState<number | null>(null);
  const [resizeOriginalStart, setResizeOriginalStart] = useState<number | null>(null);
  const [resizeOriginalEnd, setResizeOriginalEnd] = useState<number | null>(null);
  const [resizeCurrentMinutes, setResizeCurrentMinutes] = useState<{ start: number; end: number } | null>(null);

  // @dnd-kit sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5, // 5px movement before drag starts
      },
    }),
    useSensor(KeyboardSensor)
  );

  // Custom snap-to-15-minutes modifier
  const snapTo15MinModifier: Modifier = useCallback(
    ({ transform }) => {
      const gridSize = PIXELS_PER_HOUR / 4; // 15 minutes
      return {
        ...transform,
        x: 0, // No horizontal movement
        y: Math.round(transform.y / gridSize) * gridSize,
      };
    },
    [PIXELS_PER_HOUR]
  );

  const modifiers = useMemo(
    () => [restrictToVerticalAxis, snapTo15MinModifier],
    [snapTo15MinModifier]
  );

  // Get active block for DragOverlay
  const activeBlock = useMemo(
    () => timeBlocks.find((b) => b.uid === activeId),
    [timeBlocks, activeId]
  );

  const activeBlockLayout = useMemo(() => {
    if (!activeBlock) return null;
    const layouts = calculateBlockLayouts(timeBlocks);
    return layouts.find((l) => l.block.uid === activeId);
  }, [timeBlocks, activeId, activeBlock]);

  // Calculate new time from drag delta - snap to absolute 15-minute positions
  const calculateNewTime = useCallback(
    (block: TimeBlockData, deltaY: number) => {
      const deltaMinutes = (deltaY / PIXELS_PER_HOUR) * 60;

      const startMinutes = block.timeRange.startHour * 60 + block.timeRange.startMinute;
      const endMinutes = block.timeRange.endHour * 60 + block.timeRange.endMinute;
      const duration = endMinutes - startMinutes;

      // Calculate new start and snap to absolute 15-minute position
      const rawNewStart = startMinutes + deltaMinutes;
      const newStartMinutes = Math.round(rawNewStart / GRANULARITY) * GRANULARITY;
      const newEndMinutes = newStartMinutes + duration;

      return {
        startHour: Math.floor(newStartMinutes / 60),
        startMinute: newStartMinutes % 60,
        endHour: Math.floor(newEndMinutes / 60),
        endMinute: newEndMinutes % 60,
      };
    },
    [PIXELS_PER_HOUR]
  );

  // DnD event handlers
  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string);
    setDragDelta(0);
  }, []);

  const handleDragMove = useCallback((event: DragMoveEvent) => {
    if (event.delta) {
      setDragDelta(event.delta.y);
    }
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, delta } = event;
      const blockId = active.id as string;
      const block = timeBlocks.find((b) => b.uid === blockId);

      if (block && delta.y !== 0) {
        const newTime = calculateNewTime(block, delta.y);

        // Bounds check
        if (
          newTime.startHour >= startHour &&
          newTime.endHour <= effectiveEndHour
        ) {
          onBlockDrag(
            blockId,
            newTime.startHour,
            newTime.startMinute,
            newTime.endHour,
            newTime.endMinute
          );
        }
      }

      setActiveId(null);
      setDragDelta(0);
    },
    [timeBlocks, calculateNewTime, startHour, effectiveEndHour, onBlockDrag]
  );

  const handleDragCancel = useCallback(() => {
    setActiveId(null);
    setDragDelta(0);
  }, []);

  // Drag-to-create handlers (keep original logic for now)
  const getMinutesFromY = useCallback(
    (clientY: number): number => {
      if (!gridRef.current) return 0;
      const rect = gridRef.current.getBoundingClientRect();
      const relativeY = clientY - rect.top + gridRef.current.scrollTop;
      const minutes = (relativeY / PIXELS_PER_HOUR) * 60 + startHour * 60;
      return snapToGrid(Math.max(startHour * 60, Math.min(effectiveEndHour * 60, minutes)), GRANULARITY);
    },
    [startHour, effectiveEndHour, PIXELS_PER_HOUR]
  );

  // Resize handlers - defined first since they're used by mouse handlers below
  const handleResizeStart = useCallback(
    (uid: string, edge: "top" | "bottom", e: React.MouseEvent) => {
      const block = timeBlocks.find((b) => b.uid === uid);
      if (!block) return;

      const startMinutes = block.timeRange.startHour * 60 + block.timeRange.startMinute;
      const endMinutes = block.timeRange.endHour * 60 + block.timeRange.endMinute;

      setResizingUid(uid);
      setResizeEdge(edge);
      setResizeStartY(e.clientY);
      setResizeOriginalStart(startMinutes);
      setResizeOriginalEnd(endMinutes);
      setResizeCurrentMinutes({ start: startMinutes, end: endMinutes });
    },
    [timeBlocks]
  );

  const handleResizeMove = useCallback(
    (e: React.MouseEvent) => {
      if (!resizingUid || resizeStartY === null || resizeOriginalStart === null || resizeOriginalEnd === null || !resizeEdge) {
        return;
      }

      const deltaY = e.clientY - resizeStartY;
      const deltaMinutes = (deltaY / PIXELS_PER_HOUR) * 60;

      let newStart = resizeOriginalStart;
      let newEnd = resizeOriginalEnd;

      if (resizeEdge === "top") {
        // Snap to absolute 15-minute position
        const rawNewStart = resizeOriginalStart + deltaMinutes;
        newStart = Math.round(rawNewStart / GRANULARITY) * GRANULARITY;
        // Ensure minimum duration of 15 minutes and bounds
        newStart = Math.min(newStart, resizeOriginalEnd - GRANULARITY);
        newStart = Math.max(newStart, startHour * 60);
      } else {
        // Snap to absolute 15-minute position
        const rawNewEnd = resizeOriginalEnd + deltaMinutes;
        newEnd = Math.round(rawNewEnd / GRANULARITY) * GRANULARITY;
        // Ensure minimum duration of 15 minutes and bounds
        newEnd = Math.max(newEnd, resizeOriginalStart + GRANULARITY);
        newEnd = Math.min(newEnd, effectiveEndHour * 60);
      }

      setResizeCurrentMinutes({ start: newStart, end: newEnd });
    },
    [resizingUid, resizeStartY, resizeOriginalStart, resizeOriginalEnd, resizeEdge, PIXELS_PER_HOUR, startHour, effectiveEndHour]
  );

  const handleResizeEnd = useCallback(() => {
    if (!resizingUid || !resizeCurrentMinutes) {
      setResizingUid(null);
      setResizeEdge(null);
      return;
    }

    const { start, end } = resizeCurrentMinutes;

    // Only update if changed
    if (start !== resizeOriginalStart || end !== resizeOriginalEnd) {
      onBlockDrag(
        resizingUid,
        Math.floor(start / 60),
        start % 60,
        Math.floor(end / 60),
        end % 60
      );
    }

    setResizingUid(null);
    setResizeEdge(null);
    setResizeStartY(null);
    setResizeOriginalStart(null);
    setResizeOriginalEnd(null);
    setResizeCurrentMinutes(null);
  }, [resizingUid, resizeCurrentMinutes, resizeOriginalStart, resizeOriginalEnd, onBlockDrag]);

  // Get resize preview for the resizing block
  const getResizePreview = useCallback(
    (uid: string) => {
      if (resizingUid !== uid || !resizeCurrentMinutes) return null;
      return {
        startMinutes: resizeCurrentMinutes.start,
        endMinutes: resizeCurrentMinutes.end,
        startTime: formatTime(Math.floor(resizeCurrentMinutes.start / 60), resizeCurrentMinutes.start % 60),
        endTime: formatTime(Math.floor(resizeCurrentMinutes.end / 60), resizeCurrentMinutes.end % 60),
      };
    },
    [resizingUid, resizeCurrentMinutes]
  );

  const handleGridMouseDown = useCallback(
    (e: React.MouseEvent) => {
      // Only on empty grid area
      if ((e.target as HTMLElement).closest("[data-timeblock]")) return;

      const minutes = getMinutesFromY(e.clientY);
      setIsCreating(true);
      setCreateStartY(minutes);
      setCreateCurrentY(minutes);
      setCreateStartClientY(e.clientY); // Track pixel position for drag threshold
    },
    [getMinutesFromY]
  );

  const handleGridMouseMove = useCallback(
    (e: React.MouseEvent) => {
      // Handle resize first
      if (resizingUid) {
        handleResizeMove(e);
        return;
      }
      if (!isCreating) return;
      const minutes = getMinutesFromY(e.clientY);
      setCreateCurrentY(minutes);
    },
    [isCreating, getMinutesFromY, resizingUid, handleResizeMove]
  );

  const handleGridMouseUp = useCallback((e: React.MouseEvent) => {
    // Handle resize end first
    if (resizingUid) {
      handleResizeEnd();
      return;
    }

    if (!isCreating || createStartY === null || createCurrentY === null) {
      setIsCreating(false);
      return;
    }

    // Check minimum drag distance (8 pixels) to prevent accidental creation on click
    const MIN_DRAG_DISTANCE = 8;
    const dragDistance = createStartClientY !== null ? Math.abs(e.clientY - createStartClientY) : 0;

    if (dragDistance < MIN_DRAG_DISTANCE) {
      // Too short drag, treat as click - don't create block
      setIsCreating(false);
      setCreateStartY(null);
      setCreateCurrentY(null);
      setCreateStartClientY(null);
      return;
    }

    const startMinutes = Math.min(createStartY, createCurrentY);
    const endMinutes = Math.max(createStartY, createCurrentY);
    const adjustedEnd = Math.max(endMinutes, startMinutes + GRANULARITY);

    if (adjustedEnd > startMinutes) {
      onCreateBlock(
        Math.floor(startMinutes / 60),
        startMinutes % 60,
        Math.floor(adjustedEnd / 60),
        adjustedEnd % 60
      );
    }

    setIsCreating(false);
    setCreateStartY(null);
    setCreateCurrentY(null);
    setCreateStartClientY(null);
  }, [isCreating, createStartY, createCurrentY, createStartClientY, onCreateBlock, resizingUid, handleResizeEnd]);

  const handleGridMouseLeave = useCallback(() => {
    // Cancel resize on mouse leave
    if (resizingUid) {
      setResizingUid(null);
      setResizeEdge(null);
      setResizeStartY(null);
      setResizeOriginalStart(null);
      setResizeOriginalEnd(null);
      setResizeCurrentMinutes(null);
    }
    setIsCreating(false);
    setCreateStartY(null);
    setCreateCurrentY(null);
    setCreateStartClientY(null);
  }, [resizingUid]);

  // Keyboard support: Arrow keys to move selected blocks
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (selectedBlockUids.size === 0) return;
      if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;

      e.preventDefault();
      const direction = e.key === "ArrowUp" ? -1 : 1;
      const deltaMinutes = direction * GRANULARITY;

      // Move all selected blocks
      for (const uid of selectedBlockUids) {
        const block = timeBlocks.find((b) => b.uid === uid);
        if (!block) continue;

        const startMinutes = block.timeRange.startHour * 60 + block.timeRange.startMinute;
        const endMinutes = block.timeRange.endHour * 60 + block.timeRange.endMinute;
        const newStartMinutes = startMinutes + deltaMinutes;
        const newEndMinutes = endMinutes + deltaMinutes;

        // Bounds check
        if (newStartMinutes < startHour * 60 || newEndMinutes > effectiveEndHour * 60) {
          continue;
        }

        onBlockDrag(
          uid,
          Math.floor(newStartMinutes / 60),
          newStartMinutes % 60,
          Math.floor(newEndMinutes / 60),
          newEndMinutes % 60
        );
      }
    },
    [selectedBlockUids, timeBlocks, startHour, effectiveEndHour, onBlockDrag]
  );

  // Calculate drag selection for create
  const dragSelection: DragSelectionData | null = useMemo(() => {
    if (!isCreating || createStartY === null || createCurrentY === null) return null;

    const startMinutes = Math.min(createStartY, createCurrentY);
    const endMinutes = Math.max(createStartY, createCurrentY);
    const adjustedEnd = Math.max(endMinutes, startMinutes + GRANULARITY);

    const top = ((startMinutes - startHour * 60) / 60) * PIXELS_PER_HOUR;
    const height = ((adjustedEnd - startMinutes) / 60) * PIXELS_PER_HOUR;

    return {
      top,
      height,
      startTime: formatTime(Math.floor(startMinutes / 60), startMinutes % 60),
      endTime: formatTime(Math.floor(adjustedEnd / 60), adjustedEnd % 60),
    };
  }, [isCreating, createStartY, createCurrentY, startHour, PIXELS_PER_HOUR]);

  // Calculate preview time for active drag
  const previewTime = useMemo(() => {
    if (!activeBlock || dragDelta === 0) return null;
    return calculateNewTime(activeBlock, dragDelta);
  }, [activeBlock, dragDelta, calculateNewTime]);

  const blockLayouts = useMemo(() => calculateBlockLayouts(timeBlocks), [timeBlocks]);

  return (
    <DndContext
      sensors={sensors}
      modifiers={modifiers}
      onDragStart={handleDragStart}
      onDragMove={handleDragMove}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div
        ref={gridRef}
        tabIndex={0}
        className="tb-flex-1 tb-flex tb-overflow-y-auto tb-relative tb-select-none tb-cursor-crosshair focus:tb-outline-none"
        onMouseDown={handleGridMouseDown}
        onMouseMove={handleGridMouseMove}
        onMouseUp={handleGridMouseUp}
        onMouseLeave={handleGridMouseLeave}
        onKeyDown={handleKeyDown}
      >
        {/* Hour labels */}
        <div className="tb-w-[45px] tb-shrink-0 tb-border-r tb-border-[var(--border-color,#e0e0e0)] tb-bg-[var(--background-color,#fff)]">
          {hours.map((hour) => {
            const { displayTime, actualTime } = formatHourLabel(hour);
            return (
              <div
                key={hour}
                className="tb-flex tb-flex-col tb-items-end tb-pr-1 tb-pt-0.5 tb-text-[var(--text-secondary,#888)]"
                style={{ height: PIXELS_PER_HOUR }}
              >
                <span className="tb-text-[10px] tb-leading-tight">{displayTime}</span>
                {actualTime && (
                  <span className="tb-text-[8px] tb-text-[var(--text-secondary,#aaa)] tb-leading-tight">
                    {actualTime}
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* Blocks container */}
        <div className="tb-flex-1 tb-relative tb-min-h-full" style={{ width: "calc(100% - 45px)" }}>
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
              className="tb-absolute tb-left-0 tb-right-0 tb-h-0 tb-border-t tb-border-dashed tb-border-[var(--border-light,#e8e8e8)] tb-opacity-60 tb-pointer-events-none"
              style={{ top: (hour - startHour) * PIXELS_PER_HOUR + PIXELS_PER_HOUR / 2 }}
            />
          ))}

          {/* Time blocks */}
          {blockLayouts.map(({ block, column, totalColumns }) => (
            <TimeBlock
              key={block.uid}
              data={block}
              startHour={startHour}
              pixelsPerHour={PIXELS_PER_HOUR}
              onClick={(e) => onBlockClick(block.uid, e)}
              onContextMenu={(e) => onBlockContextMenu(block.uid, e)}
              onResizeStart={handleResizeStart}
              column={column}
              totalColumns={totalColumns}
              isSelected={selectedBlockUids.has(block.uid)}
              isDragging={activeId === block.uid}
              isResizing={resizingUid === block.uid}
              resizePreview={getResizePreview(block.uid)}
            />
          ))}

          {/* Drag selection overlay for create */}
          {dragSelection && <DragSelection selection={dragSelection} color={selectedTagColor} />}
        </div>
      </div>

      {/* Drag Overlay - renders outside the scrollable container */}
      <DragOverlay>
        {activeBlock && activeBlockLayout && (
          <div
            className="tb-rounded tb-px-1 tb-py-0.5 tb-shadow-xl tb-opacity-90"
            style={{
              width: "150px",
              height: `${Math.max(
                ((activeBlock.timeRange.endHour * 60 + activeBlock.timeRange.endMinute) -
                  (activeBlock.timeRange.startHour * 60 + activeBlock.timeRange.startMinute)) /
                  60 *
                  PIXELS_PER_HOUR,
                20
              )}px`,
              backgroundColor: activeBlock.tag?.color || "#cccccc",
              borderLeft: "3px solid rgba(0,0,0,0.2)",
            }}
          >
            <div className="tb-text-[9px] tb-font-semibold tb-text-blue-700">
              {previewTime
                ? `${formatTime(previewTime.startHour, previewTime.startMinute)}-${formatTime(previewTime.endHour, previewTime.endMinute)}`
                : `${formatTime(activeBlock.timeRange.startHour, activeBlock.timeRange.startMinute)}-${formatTime(activeBlock.timeRange.endHour, activeBlock.timeRange.endMinute)}`}
            </div>
            <div className="tb-text-[10px] tb-text-black/80 tb-mt-px tb-truncate">
              {activeBlock.text.replace(activeBlock.timeRange.originalText, "").trim() ||
                (activeBlock.tag?.tag ? `#${activeBlock.tag.tag}` : "")}
            </div>
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
};
