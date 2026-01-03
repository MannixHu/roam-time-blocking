/**
 * Draggable TimeBlock component using @dnd-kit
 * Supports drag-to-move and resize handles
 */
import React from "react";
import { useDraggable } from "@dnd-kit/core";
import type { TimeBlockData } from "../types";
import { formatTime } from "../core/timeParser";

interface TimeBlockProps {
  data: TimeBlockData;
  startHour: number;
  pixelsPerHour: number;
  onClick: (e: React.MouseEvent) => void;
  onContextMenu: (e: React.MouseEvent) => void;
  onResizeStart?: (uid: string, edge: "top" | "bottom", e: React.MouseEvent) => void;
  column?: number;
  totalColumns?: number;
  isSelected?: boolean;
  isDragging?: boolean;
  isResizing?: boolean;
  resizePreview?: { startMinutes: number; endMinutes: number; startTime: string; endTime: string } | null;
}

function darkenColor(hex: string, percent: number): string {
  const color = hex.replace("#", "");
  const num = parseInt(color, 16);
  const r = Math.max(0, (num >> 16) - Math.round(255 * (percent / 100)));
  const g = Math.max(0, ((num >> 8) & 0x00ff) - Math.round(255 * (percent / 100)));
  const b = Math.max(0, (num & 0x0000ff) - Math.round(255 * (percent / 100)));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

export const TimeBlock: React.FC<TimeBlockProps> = ({
  data,
  startHour,
  pixelsPerHour,
  onClick,
  onContextMenu,
  onResizeStart,
  column = 0,
  totalColumns = 1,
  isSelected = false,
  isDragging = false,
  isResizing = false,
  resizePreview = null,
}) => {
  const { timeRange, tag, text, uid } = data;

  // @dnd-kit draggable hook
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: uid,
    disabled: !isSelected || isResizing, // Disable drag while resizing
  });

  // Calculate position and height - use resize preview if available
  const originalStartMinutes = timeRange.startHour * 60 + timeRange.startMinute;
  const originalEndMinutes = timeRange.endHour * 60 + timeRange.endMinute;

  // Use preview values during resize, otherwise use original
  const startMinutes = resizePreview ? resizePreview.startMinutes : originalStartMinutes;
  const endMinutes = resizePreview ? resizePreview.endMinutes : originalEndMinutes;
  const durationMinutes = endMinutes - startMinutes;

  const top = ((startMinutes - startHour * 60) / 60) * pixelsPerHour;
  const height = Math.max((durationMinutes / 60) * pixelsPerHour, 20);

  // Calculate width and left position for overlapping blocks
  const widthPercent = 100 / totalColumns;
  const leftPercent = column * widthPercent;
  const leftCalc = totalColumns === 1 ? "1px" : `calc(${leftPercent}% + 1px)`;
  const widthCalc = totalColumns === 1 ? "calc(100% - 2px)" : `calc(${widthPercent}% - 2px)`;

  const backgroundColor = tag?.color || "#cccccc";
  const borderColor = darkenColor(backgroundColor, 20);
  const displayText = text.replace(timeRange.originalText, "").trim();

  // Show preview time during resize, otherwise show actual time
  const timeDisplay = resizePreview
    ? `${resizePreview.startTime}-${resizePreview.endTime}`
    : `${formatTime(timeRange.startHour, timeRange.startMinute)}-${formatTime(timeRange.endHour, timeRange.endMinute)}`;

  // Apply transform from @dnd-kit
  const style: React.CSSProperties = {
    top: `${top}px`,
    height: `${height}px`,
    left: leftCalc,
    width: widthCalc,
    backgroundColor,
    borderLeft: `3px solid ${borderColor}`,
    // Apply @dnd-kit transform
    transform: transform ? `translate3d(0, ${transform.y}px, 0)` : undefined,
    // Hide original when dragging (DragOverlay shows the preview)
    opacity: isDragging ? 0.3 : 1,
  };

  const handleTopResizeStart = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    onResizeStart?.(uid, "top", e);
  };

  const handleBottomResizeStart = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    onResizeStart?.(uid, "bottom", e);
  };

  // Resize handle height
  const resizeHandleHeight = 6; // pixels

  return (
    <div
      ref={setNodeRef}
      data-timeblock
      className={`tb-absolute tb-rounded tb-overflow-visible tb-z-[1] tb-box-border hover:tb-shadow-lg hover:tb-z-[2] tb-transition-shadow ${
        isSelected ? "tb-ring-2 tb-ring-blue-500 tb-ring-offset-1 tb-z-[3]" : ""
      } ${isResizing ? "tb-z-[10]" : ""}`}
      style={style}
      onClick={onClick}
      onContextMenu={onContextMenu}
      title={isSelected ? "Drag center to move, drag edges to resize" : text}
    >
      {/* Top resize handle - outside the drag area */}
      {isSelected && (
        <div
          className="tb-absolute tb-left-0 tb-right-0 tb-cursor-ns-resize tb-bg-blue-500/0 hover:tb-bg-blue-500/40 tb-rounded-t tb-transition-colors tb-z-10"
          style={{ top: 0, height: resizeHandleHeight }}
          onMouseDown={handleTopResizeStart}
          onPointerDown={(e) => e.stopPropagation()} // Prevent @dnd-kit from capturing
        />
      )}

      {/* Main drag area - only this area triggers @dnd-kit drag */}
      <div
        className="tb-absolute tb-left-0 tb-right-0 tb-px-1 tb-overflow-hidden"
        style={{
          top: isSelected ? resizeHandleHeight : 0,
          bottom: isSelected ? resizeHandleHeight : 0,
          cursor: isDragging ? "grabbing" : isSelected ? "grab" : "pointer",
        }}
        {...(isSelected && !isResizing ? { ...listeners, ...attributes } : {})}
      >
        <div className={`tb-text-[9px] tb-font-semibold tb-pt-0.5 ${isResizing ? "tb-text-blue-700" : "tb-text-black/70"}`}>
          {timeDisplay}
        </div>
        {height > 30 && (
          <div className="tb-text-[10px] tb-whitespace-nowrap tb-overflow-hidden tb-text-ellipsis tb-text-black/80 tb-mt-px">
            {displayText || (tag?.tag ? `#${tag.tag}` : "")}
          </div>
        )}
      </div>

      {/* Bottom resize handle - outside the drag area */}
      {isSelected && (
        <div
          className="tb-absolute tb-left-0 tb-right-0 tb-cursor-ns-resize tb-bg-blue-500/0 hover:tb-bg-blue-500/40 tb-rounded-b tb-transition-colors tb-z-10"
          style={{ bottom: 0, height: resizeHandleHeight }}
          onMouseDown={handleBottomResizeStart}
          onPointerDown={(e) => e.stopPropagation()} // Prevent @dnd-kit from capturing
        />
      )}
    </div>
  );
};
