import type { ParsedTimeRange } from "../types";

// Regex patterns for different time formats
const TIME_PATTERNS = [
  // 24-hour: 10:00-12:00 or 10:00 - 12:00
  {
    pattern: /(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})(?!\s*[ap])/i,
    parse: (match: RegExpMatchArray): ParsedTimeRange => ({
      startHour: parseInt(match[1], 10),
      startMinute: parseInt(match[2], 10),
      endHour: parseInt(match[3], 10),
      endMinute: parseInt(match[4], 10),
      originalText: match[0],
    }),
  },
  // 12-hour with minutes: 10:00am-12:00pm
  {
    pattern: /(\d{1,2}):(\d{2})\s*(am|pm)\s*-\s*(\d{1,2}):(\d{2})\s*(am|pm)/i,
    parse: (match: RegExpMatchArray): ParsedTimeRange => ({
      startHour: convert12to24(parseInt(match[1], 10), match[3]),
      startMinute: parseInt(match[2], 10),
      endHour: convert12to24(parseInt(match[4], 10), match[6]),
      endMinute: parseInt(match[5], 10),
      originalText: match[0],
    }),
  },
  // 12-hour short: 10am-12pm
  {
    pattern: /(\d{1,2})\s*(am|pm)\s*-\s*(\d{1,2})\s*(am|pm)/i,
    parse: (match: RegExpMatchArray): ParsedTimeRange => ({
      startHour: convert12to24(parseInt(match[1], 10), match[2]),
      startMinute: 0,
      endHour: convert12to24(parseInt(match[3], 10), match[4]),
      endMinute: 0,
      originalText: match[0],
    }),
  },
];

function convert12to24(hour: number, period: string): number {
  const isPM = period.toLowerCase() === "pm";
  if (hour === 12) return isPM ? 12 : 0;
  return isPM ? hour + 12 : hour;
}

export function parseTimeRange(text: string): ParsedTimeRange | null {
  for (const { pattern, parse } of TIME_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      const result = parse(match);
      // Validate the time range
      if (isValidTimeRange(result)) {
        return result;
      }
    }
  }
  return null;
}

function isValidTimeRange(range: ParsedTimeRange): boolean {
  const { startHour, startMinute, endHour, endMinute } = range;

  // Check hour bounds
  if (startHour < 0 || startHour > 23 || endHour < 0 || endHour > 23) {
    return false;
  }

  // Check minute bounds
  if (startMinute < 0 || startMinute > 59 || endMinute < 0 || endMinute > 59) {
    return false;
  }

  // Check that end is after start (or same for instant events)
  const startTotal = startHour * 60 + startMinute;
  const endTotal = endHour * 60 + endMinute;

  return endTotal >= startTotal;
}

export function snapToGrid(minutes: number, granularity: number): number {
  return Math.round(minutes / granularity) * granularity;
}

export function formatTimeRange(startHour: number, startMinute: number, endHour: number, endMinute: number): string {
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${pad(startHour)}:${pad(startMinute)}-${pad(endHour)}:${pad(endMinute)}`;
}

export function formatTime(hour: number, minute: number): string {
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${pad(hour)}:${pad(minute)}`;
}

export function timeRangeToMinutes(range: ParsedTimeRange): { start: number; end: number } {
  return {
    start: range.startHour * 60 + range.startMinute,
    end: range.endHour * 60 + range.endMinute,
  };
}
