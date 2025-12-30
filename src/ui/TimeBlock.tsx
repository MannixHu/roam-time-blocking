import React from "react";
import type { TimeBlockData } from "../types";
import { formatTime } from "../core/timeParser";

interface TimeBlockProps {
  data: TimeBlockData;
  startHour: number;
  pixelsPerHour: number;
  onClick: () => void;
}

function darkenColor(hex: string, percent: number): string {
  // Remove # if present
  const color = hex.replace("#", "");
  const num = parseInt(color, 16);
  const r = Math.max(0, (num >> 16) - Math.round(255 * (percent / 100)));
  const g = Math.max(0, ((num >> 8) & 0x00ff) - Math.round(255 * (percent / 100)));
  const b = Math.max(0, (num & 0x0000ff) - Math.round(255 * (percent / 100)));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

export const TimeBlock: React.FC<TimeBlockProps> = ({ data, startHour, pixelsPerHour, onClick }) => {
  const { timeRange, tag, text } = data;

  // Calculate position and height
  const startMinutes = timeRange.startHour * 60 + timeRange.startMinute;
  const endMinutes = timeRange.endHour * 60 + timeRange.endMinute;
  const durationMinutes = endMinutes - startMinutes;

  const top = ((startMinutes - startHour * 60) / 60) * pixelsPerHour;
  const height = Math.max((durationMinutes / 60) * pixelsPerHour, 20); // Minimum 20px height

  // Get color from tag or default
  const backgroundColor = tag?.color || "#cccccc";
  const borderColor = darkenColor(backgroundColor, 20);

  // Extract display text (remove time range from text)
  const displayText = text.replace(timeRange.originalText, "").trim();

  // Format time display
  const timeDisplay = `${formatTime(timeRange.startHour, timeRange.startMinute)}-${formatTime(timeRange.endHour, timeRange.endMinute)}`;

  return (
    <div
      className="timeblock-block"
      style={{
        top: `${top}px`,
        height: `${height}px`,
        backgroundColor,
        borderLeft: `4px solid ${borderColor}`,
      }}
      onClick={onClick}
      title={text}
    >
      <div className="timeblock-block-time">{timeDisplay}</div>
      {height > 30 && (
        <div className="timeblock-block-text">{displayText || (tag?.tag ? `#${tag.tag}` : "")}</div>
      )}
    </div>
  );
};
