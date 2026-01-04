import type { TimeBlockData, TagConfig } from "../types";
import { parseTimeRange } from "./timeParser";
import { createBatchTagResolver } from "./tagResolver";
import { getBlockHierarchyData, getPageTitleForDate } from "../api/roamQueries";

export function scanPageForTimeBlocks(
  pageTitle: string,
  configuredTags: TagConfig[],
  isNextDay: boolean = false,
  dayBoundaryHour: number = 5
): TimeBlockData[] {
  // Batch fetch all blocks and hierarchy data in one go
  const { blocks, contentMap, parentMap } = getBlockHierarchyData(pageTitle);
  const timeBlocks: TimeBlockData[] = [];

  // Create batch resolver with pre-fetched data
  const resolveTag = createBatchTagResolver(configuredTags, contentMap, parentMap);

  for (const block of blocks) {
    const timeRange = parseTimeRange(block.string);

    if (timeRange) {
      // For next day's page, only include blocks before the day boundary (early morning)
      if (isNextDay && timeRange.startHour >= dayBoundaryHour) {
        continue;
      }

      // Use batch resolver - no API calls, just map lookups
      const tag = resolveTag(block.uid);

      // Only include if a matching tag was found (or if no tags are configured)
      if (tag || configuredTags.length === 0) {
        // Adjust time for next day blocks (add 24 hours for display)
        const adjustedTimeRange = isNextDay
          ? {
              ...timeRange,
              startHour: timeRange.startHour + 24,
              endHour: timeRange.endHour + 24,
            }
          : timeRange;

        timeBlocks.push({
          uid: block.uid,
          text: block.string,
          timeRange: adjustedTimeRange,
          tag,
          parentUid: block.parentUid,
          order: block.order,
        });
      }
    }
  }

  return timeBlocks;
}

// Scan for time blocks on a specific date (with next day boundary support)
export function scanDateForTimeBlocks(
  targetDate: Date,
  configuredTags: TagConfig[],
  dayBoundaryHour: number = 5
): TimeBlockData[] {
  const targetTitle = getPageTitleForDate(targetDate);

  // Get next day's date
  const nextDay = new Date(targetDate);
  nextDay.setDate(nextDay.getDate() + 1);
  const nextDayTitle = getPageTitleForDate(nextDay);

  // Scan target date's page
  const targetBlocks = scanPageForTimeBlocks(targetTitle, configuredTags, false, dayBoundaryHour);

  // Scan next day's page for early morning blocks (before day boundary)
  const nextDayBlocks = scanPageForTimeBlocks(nextDayTitle, configuredTags, true, dayBoundaryHour);

  // Combine and sort by adjusted time
  const allBlocks = [...targetBlocks, ...nextDayBlocks];

  return allBlocks.sort((a, b) => {
    const aMinutes = a.timeRange.startHour * 60 + a.timeRange.startMinute;
    const bMinutes = b.timeRange.startHour * 60 + b.timeRange.startMinute;
    return aMinutes - bMinutes;
  });
}

// Legacy function for backward compatibility - scans today's blocks
export function scanTodayForTimeBlocks(
  configuredTags: TagConfig[],
  dayBoundaryHour: number = 5
): TimeBlockData[] {
  return scanDateForTimeBlocks(new Date(), configuredTags, dayBoundaryHour);
}

// Scan for time blocks for a whole week
export function scanWeekForTimeBlocks(
  weekStartDate: Date,
  configuredTags: TagConfig[],
  dayBoundaryHour: number = 5
): Map<string, TimeBlockData[]> {
  const weekBlocks = new Map<string, TimeBlockData[]>();

  for (let i = 0; i < 7; i++) {
    const date = new Date(weekStartDate);
    date.setDate(date.getDate() + i);
    const pageTitle = getPageTitleForDate(date);

    // For week view, we don't include next-day blocks to avoid confusion
    // Each day column shows only that day's blocks
    const dayBlocks = scanPageForTimeBlocks(pageTitle, configuredTags, false, dayBoundaryHour);

    weekBlocks.set(pageTitle, dayBlocks.sort((a, b) => {
      const aMinutes = a.timeRange.startHour * 60 + a.timeRange.startMinute;
      const bMinutes = b.timeRange.startHour * 60 + b.timeRange.startMinute;
      return aMinutes - bMinutes;
    }));
  }

  return weekBlocks;
}

// Get the start of week for a given date
export function getWeekStartDate(date: Date, weekStartDay: 0 | 1 = 1): Date {
  const d = new Date(date);
  const day = d.getDay(); // 0 = Sunday, 1 = Monday, etc.

  // Calculate days to subtract to get to week start
  let diff: number;
  if (weekStartDay === 1) {
    // Monday start
    diff = day === 0 ? 6 : day - 1;
  } else {
    // Sunday start
    diff = day;
  }

  d.setDate(d.getDate() - diff);
  return d;
}
