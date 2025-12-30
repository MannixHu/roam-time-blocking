import type React from "react";

// Time block data types
export interface ParsedTimeRange {
  startHour: number;
  startMinute: number;
  endHour: number;
  endMinute: number;
  originalText: string;
}

export interface TagConfig {
  tag: string;
  color: string;
  isPageRef: boolean; // true for [[Tag]], false for #tag
}

export interface TimeBlockData {
  uid: string;
  text: string;
  timeRange: ParsedTimeRange;
  tag: TagConfig | null;
  parentUid: string;
  order: number;
}

export interface TimeBlockSettings {
  dayStartHour: number;
  dayEndHour: number;
  configuredTags: TagConfig[];
  defaultColor: string;
  hourHeight: number; // pixels per hour (default 60)
}

// Roam API types
export interface RoamBlock {
  uid: string;
  string: string;
  order: number;
  parentUid?: string;
}

export interface RoamExtensionAPI {
  settings: {
    get: (key: string) => unknown;
    set: (key: string, value: unknown) => void;
    panel: {
      create: (config: SettingsPanelConfig) => void;
    };
  };
}

export interface SettingsPanelConfig {
  tabTitle: string;
  settings: SettingItem[];
}

export interface SettingItem {
  id: string;
  name: string;
  description: string;
  action: {
    type: "input" | "select" | "switch" | "reactComponent";
    placeholder?: string;
    options?: { id: string; label: string }[];
    component?: React.FC;
  };
}

// Extend window for Roam global API
declare global {
  interface Window {
    roamAlphaAPI: {
      q: (query: string, ...args: unknown[]) => unknown[][];
      pull: (pattern: string, lookup: [string, string]) => Record<string, unknown> | null;
      createBlock: (args: {
        location: { "parent-uid": string; order: number | "last" };
        block: { string: string; uid?: string };
      }) => Promise<void>;
      updateBlock: (args: { block: { uid: string; string: string } }) => Promise<void>;
      data?: {
        addPullWatch: (
          pattern: string,
          lookupRef: string,
          callback: (before: unknown, after: unknown) => void
        ) => number;
        removePullWatch: (watchId: number) => void;
      };
      ui: {
        mainWindow: {
          openBlock: (args: { block: { uid: string } }) => void;
        };
        rightSidebar: {
          open: () => void;
          addWindow: (args: { window: { type: string; "block-uid": string } }) => void;
        };
        getFocusedBlock: () => { "block-uid": string } | null;
      };
      util: {
        dateToPageTitle: (date: Date) => string;
      };
    };
  }
}

export {};
