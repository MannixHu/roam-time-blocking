import type { TimeBlockData, TagConfig } from "../types";
import { parseTimeRange } from "./timeParser";
import { findAssociatedTag } from "./tagResolver";
import { getBlockWithParent, getTodayPageTitle, getNextDayPageTitle } from "../api/roamQueries";

export function scanPageForTimeBlocks(
  pageTitle: string,
  configuredTags: TagConfig[],
  isNextDay: boolean = false,
  dayBoundaryHour: number = 5
): TimeBlockData[] {
  const blocks = getBlockWithParent(pageTitle);
  const timeBlocks: TimeBlockData[] = [];

  for (const block of blocks) {
    const timeRange = parseTimeRange(block.string);

    if (timeRange) {
      // For next day's page, only include blocks before the day boundary (early morning)
      if (isNextDay && timeRange.startHour >= dayBoundaryHour) {
        continue;
      }

      // Only process blocks that have time ranges
      const tag = findAssociatedTag(block.uid, configuredTags);

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

export function scanTodayForTimeBlocks(
  configuredTags: TagConfig[],
  dayBoundaryHour: number = 5
): TimeBlockData[] {
  const todayTitle = getTodayPageTitle();
  const nextDayTitle = getNextDayPageTitle();

  // Scan today's page
  const todayBlocks = scanPageForTimeBlocks(todayTitle, configuredTags, false, dayBoundaryHour);

  // Scan next day's page for early morning blocks (before day boundary)
  const nextDayBlocks = scanPageForTimeBlocks(nextDayTitle, configuredTags, true, dayBoundaryHour);

  // Combine and sort by adjusted time
  const allBlocks = [...todayBlocks, ...nextDayBlocks];

  return allBlocks.sort((a, b) => {
    const aMinutes = a.timeRange.startHour * 60 + a.timeRange.startMinute;
    const bMinutes = b.timeRange.startHour * 60 + b.timeRange.startMinute;
    return aMinutes - bMinutes;
  });
}
