import type { RoamBlock } from "../types";

export function getBlockContent(uid: string): string {
  const result = window.roamAlphaAPI.pull("[:block/string]", [":block/uid", uid]);
  return (result?.[":block/string"] as string) || "";
}

export function getParentBlockUid(uid: string): string | null {
  // Use :block/_children to get the direct parent (the block that has this as a child)
  const result = window.roamAlphaAPI.pull("[{:block/_children [:block/uid]}]", [":block/uid", uid]);
  const parentData = result?.[":block/_children"] as Array<{ ":block/uid": string }> | undefined;
  return parentData?.[0]?.[":block/uid"] || null;
}

export function getBlocksOnPage(pageTitle: string): RoamBlock[] {
  const query = `
    [:find ?uid ?string ?order
     :in $ ?title
     :where
       [?page :node/title ?title]
       [?block :block/page ?page]
       [?block :block/uid ?uid]
       [?block :block/string ?string]
       [?block :block/order ?order]]
  `;

  const results = window.roamAlphaAPI.q(query, pageTitle) as [string, string, number][];

  return results.map(([uid, string, order]) => ({
    uid,
    string,
    order,
  }));
}

export function getBlockWithParent(pageTitle: string): Array<{ uid: string; string: string; order: number; parentUid: string }> {
  // First get all blocks on the page
  const query = `
    [:find ?uid ?string ?order
     :in $ ?title
     :where
       [?page :node/title ?title]
       [?block :block/page ?page]
       [?block :block/uid ?uid]
       [?block :block/string ?string]
       [?block :block/order ?order]]
  `;

  const results = window.roamAlphaAPI.q(query, pageTitle) as [string, string, number][];

  // For each block, get its direct parent using pull API
  return results.map(([uid, string, order]) => {
    const pullResult = window.roamAlphaAPI.pull(
      "[{:block/_children [:block/uid]}]",
      [":block/uid", uid]
    );
    const parentData = pullResult?.[":block/_children"] as Array<{ ":block/uid": string }> | undefined;
    const parentUid = parentData?.[0]?.[":block/uid"] || "";

    return {
      uid,
      string,
      order,
      parentUid,
    };
  });
}

export function getPageUidByTitle(title: string): string | null {
  const result = window.roamAlphaAPI.q(
    `[:find ?uid :in $ ?title :where [?page :node/title ?title] [?page :block/uid ?uid]]`,
    title
  ) as [string][];

  return result[0]?.[0] || null;
}

export function getTodayPageTitle(): string {
  // Use Roam's built-in date formatter
  return window.roamAlphaAPI.util.dateToPageTitle(new Date());
}

export function getNextDayPageTitle(): string {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return window.roamAlphaAPI.util.dateToPageTitle(tomorrow);
}

export function getBlockInfo(uid: string): { parentUid: string; order: number } | null {
  // Use pull API to get direct parent (not all ancestors)
  const result = window.roamAlphaAPI.pull(
    "[:block/order {:block/_children [:block/uid]}]",
    [":block/uid", uid]
  );

  if (!result) return null;

  const order = result[":block/order"] as number | undefined;
  // :block/_children gives us the parent that has this block as a child
  const parentData = result[":block/_children"] as Array<{ ":block/uid": string }> | undefined;
  const parentUid = parentData?.[0]?.[":block/uid"];

  if (parentUid === undefined || order === undefined) return null;

  return {
    parentUid,
    order,
  };
}

// Get page title for a specific date
export function getPageTitleForDate(date: Date): string {
  return window.roamAlphaAPI.util.dateToPageTitle(date);
}

// Get page title from page UID
export function getPageTitleFromUid(uid: string): string | null {
  const result = window.roamAlphaAPI.pull("[:node/title]", [":block/uid", uid]);
  return (result?.[":node/title"] as string) || null;
}

// Get the page title that a block belongs to
export function getBlockPageTitle(blockUid: string): string | null {
  const result = window.roamAlphaAPI.pull(
    "[{:block/page [:node/title]}]",
    [":block/uid", blockUid]
  );
  const pageData = result?.[":block/page"] as { ":node/title": string } | undefined;
  return pageData?.[":node/title"] || null;
}

// Extract page UID from current URL hash
export function getCurrentPageUidFromUrl(): string | null {
  const hash = window.location.hash;
  // Roam URL patterns:
  // #/app/{workspace}/page/{uid}
  // #/app/{workspace}/page/{uid}/{block-uid}
  const match = hash.match(/\/page\/([a-zA-Z0-9_-]+)/);
  return match ? match[1] : null;
}

// Try to parse a daily page title to Date
// Roam uses formats like "January 5th, 2024" or localized versions
export function parseDailyPageTitle(title: string): Date | null {
  // Try to use Roam's API to check if this is a daily page
  // by converting it back and forth
  try {
    // Common date patterns in Roam
    // "January 5th, 2024", "5th January 2024", etc.
    const patterns = [
      // January 5th, 2024
      /^([A-Za-z]+)\s+(\d{1,2})(?:st|nd|rd|th)?,?\s*(\d{4})$/,
      // 5th January 2024
      /^(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]+),?\s*(\d{4})$/,
      // 2024-01-05
      /^(\d{4})-(\d{2})-(\d{2})$/,
    ];

    const months: Record<string, number> = {
      january: 0, february: 1, march: 2, april: 3, may: 4, june: 5,
      july: 6, august: 7, september: 8, october: 9, november: 10, december: 11
    };

    // Try pattern 1: January 5th, 2024
    const match1 = title.match(patterns[0]);
    if (match1) {
      const monthName = match1[1].toLowerCase();
      const day = parseInt(match1[2], 10);
      const year = parseInt(match1[3], 10);
      if (months[monthName] !== undefined) {
        return new Date(year, months[monthName], day);
      }
    }

    // Try pattern 2: 5th January 2024
    const match2 = title.match(patterns[1]);
    if (match2) {
      const day = parseInt(match2[1], 10);
      const monthName = match2[2].toLowerCase();
      const year = parseInt(match2[3], 10);
      if (months[monthName] !== undefined) {
        return new Date(year, months[monthName], day);
      }
    }

    // Try pattern 3: 2024-01-05
    const match3 = title.match(patterns[2]);
    if (match3) {
      return new Date(parseInt(match3[1], 10), parseInt(match3[2], 10) - 1, parseInt(match3[3], 10));
    }

    return null;
  } catch {
    return null;
  }
}

// Check if a page title is a daily page and return the date
export function getDailyPageDate(pageTitle: string): Date | null {
  const parsed = parseDailyPageTitle(pageTitle);
  if (!parsed) return null;

  // Verify by converting back to page title
  const expectedTitle = getPageTitleForDate(parsed);
  if (expectedTitle === pageTitle) {
    return parsed;
  }

  return null;
}

// Get the currently viewed page's date (if it's a daily page)
export function getCurrentViewedDate(): Date | null {
  const pageUid = getCurrentPageUidFromUrl();
  if (!pageUid) return null;

  const pageTitle = getPageTitleFromUid(pageUid);
  if (!pageTitle) return null;

  return getDailyPageDate(pageTitle);
}
