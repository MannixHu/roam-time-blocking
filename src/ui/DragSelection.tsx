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
      className="tb-absolute tb-left-1 tb-right-1 tb-border-2 tb-border-dashed tb-rounded tb-pointer-events-none tb-z-10 tb-flex tb-items-center tb-justify-center"
      style={{
        top: `${selection.top}px`,
        height: `${Math.max(selection.height, 15)}px`,
        backgroundColor: bgColor,
        borderColor: borderColor,
      }}
    >
      <span
        className="tb-text-[10px] tb-font-semibold tb-bg-white/90 tb-px-1.5 tb-py-0.5 tb-rounded-sm"
        style={{ color: borderColor }}
      >
        {selection.startTime} - {selection.endTime}
      </span>
    </div>
  );
};
