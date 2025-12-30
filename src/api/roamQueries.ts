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
  const query = `
    [:find ?uid ?string ?order ?parent-uid
     :in $ ?title
     :where
       [?page :node/title ?title]
       [?block :block/page ?page]
       [?block :block/uid ?uid]
       [?block :block/string ?string]
       [?block :block/order ?order]
       [?block :block/parents ?parent]
       [?parent :block/uid ?parent-uid]]
  `;

  const results = window.roamAlphaAPI.q(query, pageTitle) as [string, string, number, string][];

  return results.map(([uid, string, order, parentUid]) => ({
    uid,
    string,
    order,
    parentUid,
  }));
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
  const query = `
    [:find ?parent-uid ?order
     :in $ ?uid
     :where
       [?block :block/uid ?uid]
       [?block :block/order ?order]
       [?block :block/parents ?parent]
       [?parent :block/uid ?parent-uid]]
  `;

  const results = window.roamAlphaAPI.q(query, uid) as [string, number][];

  if (results.length === 0) return null;

  return {
    parentUid: results[0][0],
    order: results[0][1],
  };
}
