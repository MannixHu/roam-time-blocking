import type { TimeBlockData } from "../types";

// Calculate column layout for overlapping blocks - optimized O(n log n) algorithm
export interface BlockLayout {
  block: TimeBlockData;
  column: number;
  totalColumns: number;
}

export function calculateBlockLayouts(blocks: TimeBlockData[]): BlockLayout[] {
  if (blocks.length === 0) return [];

  // Sort by start time, then by duration (longer first)
  const sorted = [...blocks].sort((a, b) => {
    const aStart = a.timeRange.startHour * 60 + a.timeRange.startMinute;
    const bStart = b.timeRange.startHour * 60 + b.timeRange.startMinute;
    if (aStart !== bStart) return aStart - bStart;
    const aEnd = a.timeRange.endHour * 60 + a.timeRange.endMinute;
    const bEnd = b.timeRange.endHour * 60 + b.timeRange.endMinute;
    return bEnd - aEnd;
  });

  // First pass: Assign columns using greedy algorithm
  // columns[i] = end time of the block currently occupying column i
  const columns: number[] = [];
  const blockColumns: Map<string, number> = new Map();

  for (const block of sorted) {
    const start = block.timeRange.startHour * 60 + block.timeRange.startMinute;
    const end = block.timeRange.endHour * 60 + block.timeRange.endMinute;

    // Find first available column (where previous block has ended)
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

    blockColumns.set(block.uid, column);
  }

  // Second pass: Find overlap groups using sweep line
  // Instead of O(n²) pairwise comparison, we use events
  type Event = { time: number; type: "start" | "end"; uid: string; column: number };
  const events: Event[] = [];

  for (const block of sorted) {
    const start = block.timeRange.startHour * 60 + block.timeRange.startMinute;
    const end = block.timeRange.endHour * 60 + block.timeRange.endMinute;
    const column = blockColumns.get(block.uid)!;

    events.push({ time: start, type: "start", uid: block.uid, column });
    events.push({ time: end, type: "end", uid: block.uid, column });
  }

  // Sort events: by time, then ends before starts (to handle touching blocks correctly)
  events.sort((a, b) => {
    if (a.time !== b.time) return a.time - b.time;
    // Process ends before starts at same time
    return a.type === "end" ? -1 : 1;
  });

  // Sweep through events to compute max overlapping columns for each block
  const activeBlocks = new Set<string>();
  const blockMaxColumns: Map<string, number> = new Map();
  let currentMaxColumn = 0;

  for (const event of events) {
    if (event.type === "start") {
      activeBlocks.add(event.uid);
      currentMaxColumn = Math.max(currentMaxColumn, event.column);

      // All currently active blocks are in the same overlap group
      // Update their max column
      for (const uid of activeBlocks) {
        const prevMax = blockMaxColumns.get(uid) || 0;
        blockMaxColumns.set(uid, Math.max(prevMax, currentMaxColumn));
      }
    } else {
      // Before removing, ensure this block knows about current max
      const prevMax = blockMaxColumns.get(event.uid) || 0;
      blockMaxColumns.set(event.uid, Math.max(prevMax, currentMaxColumn));

      activeBlocks.delete(event.uid);

      // Recalculate current max column after removal
      if (activeBlocks.size > 0) {
        currentMaxColumn = 0;
        for (const uid of activeBlocks) {
          currentMaxColumn = Math.max(currentMaxColumn, blockColumns.get(uid)!);
        }
      }
    }
  }

  // Build result
  const result: BlockLayout[] = [];
  for (const block of sorted) {
    const column = blockColumns.get(block.uid)!;
    const maxColumn = blockMaxColumns.get(block.uid) || column;

    result.push({
      block,
      column,
      totalColumns: maxColumn + 1,
    });
  }

  return result;
}
