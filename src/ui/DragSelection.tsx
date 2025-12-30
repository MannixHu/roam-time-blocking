import React from "react";

export interface DragSelectionData {
  top: number;
  height: number;
  startTime: string;
  endTime: string;
}

interface DragSelectionProps {
  selection: DragSelectionData;
  color?: string;
}

export const DragSelection: React.FC<DragSelectionProps> = ({ selection, color }) => {
  const bgColor = color ? `${color}40` : "rgba(66, 133, 244, 0.25)"; // 40 = 25% opacity in hex
  const borderColor = color || "#4285f4";

  return (
    <div
      className="timeblock-drag-selection"
      style={{
        top: `${selection.top}px`,
        height: `${Math.max(selection.height, 15)}px`,
        backgroundColor: bgColor,
        borderColor: borderColor,
      }}
    >
      <span className="timeblock-drag-time" style={{ color: borderColor }}>
        {selection.startTime} - {selection.endTime}
      </span>
    </div>
  );
};
