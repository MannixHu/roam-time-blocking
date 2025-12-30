import type { TagConfig } from "../types";
import { getBlockContent, getParentBlockUid } from "../api/roamQueries";

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function createTagMatcher(config: TagConfig): RegExp {
  // Match both #tag and [[tag]] formats (case-insensitive)
  const escaped = escapeRegex(config.tag);
  // Match: #tag, #[[tag]], or [[tag]]
  return new RegExp(`(#${escaped}(?![\\w-])|#\\[\\[${escaped}\\]\\]|\\[\\[${escaped}\\]\\])`, "i");
}

export function findAssociatedTag(blockUid: string, configuredTags: TagConfig[]): TagConfig | null {
  if (configuredTags.length === 0) return null;

  // Build matchers for each tag
  const tagMatchers = configuredTags.map((config) => ({
    config,
    regex: createTagMatcher(config),
  }));

  let currentUid: string | null = blockUid;

  while (currentUid) {
    const content = getBlockContent(currentUid);

    // Check each configured tag
    for (const { config, regex } of tagMatchers) {
      if (regex.test(content)) {
        return config;
      }
    }

    // Move to parent block
    currentUid = getParentBlockUid(currentUid);
  }

  return null; // No matching tag found in hierarchy
}

export function findTagInText(text: string, configuredTags: TagConfig[]): TagConfig | null {
  if (configuredTags.length === 0) return null;

  for (const config of configuredTags) {
    const regex = createTagMatcher(config);
    if (regex.test(text)) {
      return config;
    }
  }

  return null;
}
