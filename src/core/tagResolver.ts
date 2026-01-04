import type { TagConfig } from "../types";
import { getBlockContent, getParentBlockUid } from "../api/roamQueries";
import { escapeRegex } from "./utils";

// Maximum depth to traverse parent hierarchy (prevent performance issues with deeply nested structures)
const MAX_PARENT_DEPTH = 50;

function createTagMatcher(config: TagConfig): RegExp {
  // Match both #tag and [[tag]] formats (case-insensitive)
  const escaped = escapeRegex(config.tag);
  // Match: #tag, #[[tag]], or [[tag]]
  return new RegExp(`(#${escaped}(?![\\w-])|#\\[\\[${escaped}\\]\\]|\\[\\[${escaped}\\]\\])`, "i");
}

// Build tag matchers once for reuse
function buildTagMatchers(configuredTags: TagConfig[]): Array<{ config: TagConfig; regex: RegExp }> {
  return configuredTags.map((config) => ({
    config,
    regex: createTagMatcher(config),
  }));
}

// Check if text contains any configured tag
function findTagInTextWithMatchers(
  text: string,
  matchers: Array<{ config: TagConfig; regex: RegExp }>
): TagConfig | null {
  for (const { config, regex } of matchers) {
    if (regex.test(text)) {
      return config;
    }
  }
  return null;
}

// Optimized batch tag resolution using pre-fetched data
export function findAssociatedTagBatch(
  blockUid: string,
  matchers: Array<{ config: TagConfig; regex: RegExp }>,
  contentMap: Map<string, string>,
  parentMap: Map<string, string>
): TagConfig | null {
  if (matchers.length === 0) return null;

  let currentUid: string | null = blockUid;
  const visited = new Set<string>(); // Prevent infinite loops
  let depth = 0;

  while (currentUid && !visited.has(currentUid) && depth < MAX_PARENT_DEPTH) {
    visited.add(currentUid);
    depth++;

    // Use cached content
    const content = contentMap.get(currentUid);
    if (content) {
      const tag = findTagInTextWithMatchers(content, matchers);
      if (tag) return tag;
    }

    // Use cached parent relationship
    currentUid = parentMap.get(currentUid) || null;
  }

  return null;
}

// Create a batch resolver for multiple blocks
export function createBatchTagResolver(
  configuredTags: TagConfig[],
  contentMap: Map<string, string>,
  parentMap: Map<string, string>
): (blockUid: string) => TagConfig | null {
  const matchers = buildTagMatchers(configuredTags);

  return (blockUid: string) => {
    return findAssociatedTagBatch(blockUid, matchers, contentMap, parentMap);
  };
}

// Legacy function - still works but less efficient (kept for backward compatibility)
export function findAssociatedTag(blockUid: string, configuredTags: TagConfig[]): TagConfig | null {
  if (configuredTags.length === 0) return null;

  const tagMatchers = buildTagMatchers(configuredTags);
  let currentUid: string | null = blockUid;
  let depth = 0;

  while (currentUid && depth < MAX_PARENT_DEPTH) {
    depth++;
    const content = getBlockContent(currentUid);

    const tag = findTagInTextWithMatchers(content, tagMatchers);
    if (tag) return tag;

    // Move to parent block
    currentUid = getParentBlockUid(currentUid);
  }

  return null;
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
