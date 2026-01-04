import { formatTimeRange } from "./timeParser";
import { getPageUidByTitle, getTodayPageTitle, getBlockInfo, getBlockContent } from "../api/roamQueries";
import { escapeRegex } from "./utils";
import type { TagConfig } from "../types";

function generateBlockUid(): string {
  // Generate a 9-character alphanumeric UID similar to Roam's format
  return Math.random().toString(36).substring(2, 11);
}

// Update the tag on an existing block
export async function updateBlockTag(
  blockUid: string,
  newTag: TagConfig,
  configuredTags: TagConfig[]
): Promise<void> {
  const content = getBlockContent(blockUid);
  if (!content) return;

  // Build regex patterns for all configured tags
  const tagPatterns = configuredTags.map((tag) => {
    const escaped = escapeRegex(tag.tag);
    // Match: #tag, #[[tag]], or [[tag]]
    return `#${escaped}(?![\\w-])|#\\[\\[${escaped}\\]\\]|\\[\\[${escaped}\\]\\]`;
  });

  // Remove all existing configured tags
  let newContent = content;
  for (const pattern of tagPatterns) {
    newContent = newContent.replace(new RegExp(pattern, "gi"), "");
  }

  // Clean up extra spaces
  newContent = newContent.replace(/\s+/g, " ").trim();

  // Add new tag at the end
  newContent = `${newContent} #${newTag.tag}`;

  // Update the block
  await window.roamAlphaAPI.updateBlock({
    block: {
      uid: blockUid,
      string: newContent,
    },
  });
}

export async function createTimeBlock(
  startHour: number,
  startMinute: number,
  endHour: number,
  endMinute: number,
  siblingUid?: string,
  tag?: string
): Promise<string> {
  const pageTitle = getTodayPageTitle();
  const pageUid = getPageUidByTitle(pageTitle);

  if (!pageUid) {
    throw new Error(`Could not find page: ${pageTitle}`);
  }

  // Format time range
  const timeString = formatTimeRange(startHour, startMinute, endHour, endMinute);

  // Build block text (extra space between time and tag for easier editing)
  let blockText = timeString;
  if (tag) {
    blockText += `  #${tag}`;
  }

  const newUid = generateBlockUid();

  // Check for focused block (cursor position)
  const focusedBlock = window.roamAlphaAPI.ui.getFocusedBlock();
  const targetSiblingUid = siblingUid || focusedBlock?.["block-uid"];

  if (targetSiblingUid) {
    // Insert at current cursor position (same order as focused block, pushing it down)
    const siblingInfo = getBlockInfo(targetSiblingUid);
    if (siblingInfo) {
      await window.roamAlphaAPI.createBlock({
        location: {
          "parent-uid": siblingInfo.parentUid,
          order: siblingInfo.order,
        },
        block: {
          string: blockText,
          uid: newUid,
        },
      });
      return newUid;
    }
  }

  // Fallback: Insert at end of today's page
  await window.roamAlphaAPI.createBlock({
    location: {
      "parent-uid": pageUid,
      order: "last",
    },
    block: {
      string: blockText,
      uid: newUid,
    },
  });

  return newUid;
}

export function navigateToBlock(blockUid: string): void {
  window.roamAlphaAPI.ui.mainWindow.openBlock({
    block: { uid: blockUid },
  });
}

// Remove all configured tags from a block (keep time)
export async function removeBlockTag(blockUid: string, configuredTags: TagConfig[]): Promise<void> {
  const content = getBlockContent(blockUid);
  if (!content) return;

  // Build regex patterns for all configured tags
  const tagPatterns = configuredTags.map((tag) => {
    const escaped = escapeRegex(tag.tag);
    // Match: #tag, #[[tag]], or [[tag]]
    return `#${escaped}(?![\\w-])|#\\[\\[${escaped}\\]\\]|\\[\\[${escaped}\\]\\]`;
  });

  // Remove all existing configured tags
  let newContent = content;
  for (const pattern of tagPatterns) {
    newContent = newContent.replace(new RegExp(pattern, "gi"), "");
  }

  // Clean up extra spaces
  newContent = newContent.replace(/\s+/g, " ").trim();

  // Update the block
  await window.roamAlphaAPI.updateBlock({
    block: {
      uid: blockUid,
      string: newContent,
    },
  });
}

// Remove all configured tags AND time text from a block
export async function removeBlockTimeAndTag(blockUid: string, configuredTags: TagConfig[]): Promise<void> {
  const content = getBlockContent(blockUid);
  if (!content) return;

  // Build regex patterns for all configured tags
  const tagPatterns = configuredTags.map((tag) => {
    const escaped = escapeRegex(tag.tag);
    // Match: #tag, #[[tag]], or [[tag]]
    return `#${escaped}(?![\\w-])|#\\[\\[${escaped}\\]\\]|\\[\\[${escaped}\\]\\]`;
  });

  // Remove all existing configured tags
  let newContent = content;
  for (const pattern of tagPatterns) {
    newContent = newContent.replace(new RegExp(pattern, "gi"), "");
  }

  // Also remove time range patterns
  // Match: HH:MM-HH:MM, HH:MM - HH:MM, HHMM-HHMM, etc.
  const timeRangePattern = /\d{1,2}:\d{2}\s*[-–]\s*\d{1,2}:\d{2}|\d{4}\s*[-–]\s*\d{4}/g;
  newContent = newContent.replace(timeRangePattern, "");

  // Clean up extra spaces
  newContent = newContent.replace(/\s+/g, " ").trim();

  // Update the block
  await window.roamAlphaAPI.updateBlock({
    block: {
      uid: blockUid,
      string: newContent,
    },
  });
}

// Update the time range of a block
export async function updateBlockTime(
  blockUid: string,
  newStartHour: number,
  newStartMinute: number,
  newEndHour: number,
  newEndMinute: number
): Promise<void> {
  const content = getBlockContent(blockUid);
  if (!content) return;

  // Match common time range patterns:
  // HH:MM-HH:MM, HH:MM - HH:MM, HHMM-HHMM, etc.
  const timeRangePattern = /\d{1,2}:\d{2}\s*[-–]\s*\d{1,2}:\d{2}|\d{4}\s*[-–]\s*\d{4}/;

  const newTimeRange = formatTimeRange(newStartHour, newStartMinute, newEndHour, newEndMinute);

  let newContent: string;
  if (timeRangePattern.test(content)) {
    // Replace existing time range
    newContent = content.replace(timeRangePattern, newTimeRange);
  } else {
    // Prepend time range if none exists
    newContent = `${newTimeRange} ${content}`;
  }

  // Update the block
  await window.roamAlphaAPI.updateBlock({
    block: {
      uid: blockUid,
      string: newContent,
    },
  });
}
