import { formatTimeRange } from "./timeParser";
import { getPageUidByTitle, getTodayPageTitle, getBlockInfo } from "../api/roamQueries";

function generateBlockUid(): string {
  // Generate a 9-character alphanumeric UID similar to Roam's format
  return Math.random().toString(36).substring(2, 11);
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

  // Build block text
  let blockText = timeString;
  if (tag) {
    blockText += ` #${tag} `;
  }

  const newUid = generateBlockUid();

  if (siblingUid) {
    // Insert after sibling
    const siblingInfo = getBlockInfo(siblingUid);
    if (siblingInfo) {
      await window.roamAlphaAPI.createBlock({
        location: {
          "parent-uid": siblingInfo.parentUid,
          order: siblingInfo.order + 1,
        },
        block: {
          string: blockText,
          uid: newUid,
        },
      });
    } else {
      // Fallback to page level
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
    }
  } else {
    // Insert at top level of page
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
  }

  return newUid;
}

export function navigateToBlock(blockUid: string): void {
  window.roamAlphaAPI.ui.mainWindow.openBlock({
    block: { uid: blockUid },
  });
}
