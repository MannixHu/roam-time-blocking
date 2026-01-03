import type { RoamBlock } from "../types";

export function getBlockContent(uid: string): string {
  const result = window.roamAlphaAPI.pull("[:block/string]", [":block/uid", uid]);
  return (result?.[":block/string"] as string) || "";
}

export function getParentBlockUid(uid: string): string | null {
  const result = window.roamAlphaAPI.pull("[{:block/parents [:block/uid]}]", [":block/uid", uid]);
  const parents = result?.[":block/parents"] as Array<{ ":block/uid": string }> | undefined;
  // Return the immediate parent (first in the list is closest ancestor)
  return parents?.[0]?.[":block/uid"] || null;
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
