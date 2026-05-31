import type { CalendarEvent } from "@shared/schema";

export const STANDARD_SESSION_NAMES = [
  "Practice",
  "Practice 1",
  "Practice 2",
  "Practice 3",
  "Qualifying",
  "Sprint Qualifying",
  "Sprint",
  "Warm Up",
  "Race",
  "Test",
] as const;

export const SESSION_NAME_ALIASES: Record<string, string> = {
  race: "Race",
  "grand prix": "Race",
  gp: "Race",
  "sprint quali": "Sprint Qualifying",
  "sprint qualify": "Sprint Qualifying",
  "sprint qualifying": "Sprint Qualifying",
  "sprint shootout": "Sprint Qualifying",
  qualifying: "Qualifying",
  quali: "Qualifying",
  "practice 3": "Practice 3",
  fp3: "Practice 3",
  "practice 2": "Practice 2",
  fp2: "Practice 2",
  "practice 1": "Practice 1",
  fp1: "Practice 1",
  practice: "Practice",
  test: "Test",
  "warm up": "Warm Up",
  warm: "Warm Up",
  wup: "Warm Up",
};

const standardNamesSet = new Set<string>(STANDARD_SESSION_NAMES);

const normalizeSessionNameCache = new Map<string, string | undefined>();

export function normalizeSessionName(label?: string): string | undefined {
  if (!label) return undefined;

  const normalized = label.trim();

  const cached = normalizeSessionNameCache.get(normalized);
  if (cached !== undefined) return cached;

  let result: string | undefined;

  if (standardNamesSet.has(normalized)) {
    result = normalized;
  } else {
    const lower = normalized.toLowerCase();
    if (SESSION_NAME_ALIASES[lower]) {
      result = SESSION_NAME_ALIASES[lower];
    } else {
      const practiceMatch = lower.match(/^(fp|practice)\s*([1-9])$/);
      if (practiceMatch) {
        const practiceNumber = Number(practiceMatch[2]);
        result = practiceNumber >= 1 && practiceNumber <= 3 ? `Practice ${practiceNumber}` : "Practice";
      } else {
        const qualifyingMatch = lower.match(/^(q|qualifying)\s*(\d+)$/);
        if (qualifyingMatch) {
          result = "Qualifying";
        } else if (lower.includes("practice")) {
          result = "Practice";
        } else if (lower.includes("test")) {
          result = "Test";
        } else if (lower.includes("warm") || lower.includes("wup")) {
          result = "Warm Up";
        } else if (lower.includes("sprint qual") || lower.includes("sprint shootout")) {
          result = "Sprint Qualifying";
        } else if (lower.includes("sprint")) {
          result = "Sprint";
        } else if (lower.includes("qualifying") || lower.includes("quali")) {
          result = "Qualifying";
        } else if (lower.includes("race") || lower.includes("gp") || lower.includes("grand prix")) {
          result = "Race";
        }
      }
    }
  }

  normalizeSessionNameCache.set(normalized, result);
  return result;
}

export function normalizeSessionNames(values?: unknown): string[] | undefined {
  if (!Array.isArray(values)) return undefined;
  const uniqueNames: string[] = [];

  for (const value of values) {
    const normalized = normalizeSessionName(String(value));
    if (normalized && !uniqueNames.includes(normalized)) {
      uniqueNames.push(normalized);
    }
  }

  return uniqueNames.length > 0 ? uniqueNames : undefined;
}

function getSessionCategory(sessionName: string): string {
  if (/^Practice\s+\d+$/i.test(sessionName)) return "Practice";
  if (/^Qualifying\s+\d+$/i.test(sessionName)) return "Qualifying";
  return sessionName;
}

export function sessionNameMatches(sessionType: string | undefined, allowedSessionNames: string[]): boolean {
  const normalizedSessionType = normalizeSessionName(sessionType);
  if (!normalizedSessionType) return false;

  const sessionCategory = getSessionCategory(normalizedSessionType);
  return allowedSessionNames.some((allowed) => {
    const normalizedAllowed = normalizeSessionName(allowed);
    if (!normalizedAllowed) return false;

    if (normalizedAllowed === normalizedSessionType) {
      return true;
    }

    if (normalizedAllowed === "Practice" && sessionCategory === "Practice") {
      return true;
    }

    if (normalizedAllowed === "Qualifying" && sessionCategory === "Qualifying") {
      return true;
    }

    return false;
  });
}

export function filterEventsBySessionNames(events: CalendarEvent[], allowedSessionNames: string[]): CalendarEvent[] {
  return events.filter((event) => sessionNameMatches(event.sessionType, allowedSessionNames));
}
