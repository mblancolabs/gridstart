import { useState, useMemo, useRef, useEffect } from "react";
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addMonths,
  subMonths,
  isSameMonth,
  isSameDay,
  isToday,
  addDays,
} from "date-fns";
import { ChevronLeft, ChevronRight, MapPin, Calendar as CalendarIcon, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useEvents, usePreferences } from "@/lib/hooks";
import type { CalendarEvent } from "@shared/schema";

// ---------- Timezone helpers ----------

const userTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
const shortTzName =
  new Intl.DateTimeFormat("en", {
    timeZoneName: "short",
  })
    .formatToParts(new Date())
    .find((p) => p.type === "timeZoneName")?.value || userTz;

// eslint-disable-next-line react-refresh/only-export-components
export function formatLocalTime(isoString: string): string {
  const d = new Date(isoString);
  return d.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

// eslint-disable-next-line react-refresh/only-export-components
export function formatLocalDate(isoString: string): string {
  const d = new Date(isoString);
  return d.toLocaleDateString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

/*
function formatLocalDay(isoString: string): string {
  const d = new Date(isoString);
  return d.toLocaleDateString([], {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}
*/

// ---------- Color helpers ----------

// eslint-disable-next-line react-refresh/only-export-components
export function lightenColor(hex: string, minLightness: number = 55): string {
  // Ensure calendar cell event text is readable on dark backgrounds
  // Parse hex -> hsl, boost lightness if too dark
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b),
    min = Math.min(r, g, b);
  let h = 0,
    s = 0,
    l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / d + 2) / 6;
    else h = ((r - g) / d + 4) / 6;
  }
  if (l * 100 < minLightness) l = minLightness / 100;
  // hsl -> rgb
  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const nr = Math.round(hue2rgb(p, q, h + 1 / 3) * 255);
  const ng = Math.round(hue2rgb(p, q, h) * 255);
  const nb = Math.round(hue2rgb(p, q, h - 1 / 3) * 255);
  return `#${nr.toString(16).padStart(2, "0")}${ng.toString(16).padStart(2, "0")}${nb.toString(16).padStart(2, "0")}`;
}

// ---------- Session type styling ----------

// eslint-disable-next-line react-refresh/only-export-components
export function getSessionIcon(sessionType?: string): string {
  if (!sessionType) return "";
  const lower = sessionType.toLowerCase();
  if (lower.includes("race")) return "🏁";
  if (lower.includes("sprint")) return "⚡";
  if (lower.includes("quali")) return "🔴";
  if (lower.includes("practice") || lower.includes("fp")) return "🔧";
  if (lower.includes("test")) return "🧪";
  return "";
}

// eslint-disable-next-line react-refresh/only-export-components
export function getSessionBadgeVariant(
  sessionType?: string,
): "default" | "secondary" | "outline-solid" | "destructive" {
  if (!sessionType) return "outline-solid";
  const lower = sessionType.toLowerCase();
  if (lower.includes("race")) return "default";
  if (lower.includes("sprint")) return "default";
  if (lower.includes("quali")) return "secondary";
  return "outline-solid";
}

// ---------- Race weekend grouping ----------

interface RaceWeekend {
  raceName: string;
  seriesId: string;
  seriesShortName: string;
  seriesColor: string;
  location?: string;
  round?: number;
  sessions: CalendarEvent[];
}

// eslint-disable-next-line react-refresh/only-export-components
export function groupIntoWeekends(events: CalendarEvent[]): (CalendarEvent | RaceWeekend)[] {
  // Group F1 (or other Jolpica-sourced) events by race name, keep others as singles
  //const result: (CalendarEvent | RaceWeekend)[] = [];
  const raceGroupMap = new Map<string, CalendarEvent[]>();
  const singleEvents: CalendarEvent[] = [];

  for (const event of events) {
    if (event.raceName && event.sessionType) {
      const key = `${event.seriesId}-${event.raceName}`;
      if (!raceGroupMap.has(key)) raceGroupMap.set(key, []);
      raceGroupMap.get(key)!.push(event);
    } else {
      singleEvents.push(event);
    }
  }

  // Build weekends
  const weekends: RaceWeekend[] = [];
  raceGroupMap.forEach((sessions) => {
    const first = sessions[0];
    weekends.push({
      raceName: first.raceName!,
      seriesId: first.seriesId,
      seriesShortName: first.seriesShortName,
      seriesColor: first.seriesColor,
      location: first.location,
      round: first.round,
      sessions: sessions.sort(
        (a: CalendarEvent, b: CalendarEvent) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime(),
      ),
    });
  });

  // Merge weekends and single events, sorted by earliest start date
  const allItems: { sortDate: string; item: CalendarEvent | RaceWeekend }[] = [];

  for (const w of weekends) {
    allItems.push({ sortDate: w.sessions[0].startDate, item: w });
  }
  for (const e of singleEvents) {
    allItems.push({ sortDate: e.startDate, item: e });
  }

  allItems.sort(
    (
      a: { sortDate: string; item: CalendarEvent | RaceWeekend },
      b: { sortDate: string; item: CalendarEvent | RaceWeekend },
    ) => new Date(a.sortDate).getTime() - new Date(b.sortDate).getTime(),
  );

  return allItems.map((i) => i.item);
}

function isRaceWeekend(item: CalendarEvent | RaceWeekend): item is RaceWeekend {
  return "sessions" in item;
}

// ---------- Component ----------

export default function Home() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const eventListRef = useRef<HTMLDivElement>(null);
  const [isDark, setIsDark] = useState(document.documentElement.classList.contains("dark"));

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsDark(document.documentElement.classList.contains("dark"));
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  //const { data: series } = useSeries();
  const { data: prefs } = usePreferences();

  const enabledSeries = useMemo(() => {
    if (!prefs) return [];
    try {
      return JSON.parse(prefs.enabledSeries) as string[];
    } catch {
      return [];
    }
  }, [prefs]);

  // Fetch events for a wider range to have data for surrounding months
  const from = format(subMonths(startOfMonth(currentMonth), 1), "yyyy-MM-dd");
  const to = format(addMonths(endOfMonth(currentMonth), 1), "yyyy-MM-dd");

  const { data: events, isLoading } = useEvents(enabledSeries, from, to);

  // Build a map of date -> events for the calendar grid (using local dates)
  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    if (!events) return map;
    for (const event of events) {
      // Use local date for calendar grid placement
      const d = new Date(event.startDate);
      const dateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      if (!map.has(dateKey)) map.set(dateKey, []);
      map.get(dateKey)!.push(event);
    }
    return map;
  }, [events]);

  // Calendar grid days
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

  const calendarDays: Date[] = [];
  let day = gridStart;
  while (day <= gridEnd) {
    calendarDays.push(day);
    day = addDays(day, 1);
  }

  // Upcoming events (from today forward, this month)
  const upcomingItems = useMemo(() => {
    if (!events) return [];
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const monthEvents = events.filter((e) => {
      const d = new Date(e.startDate);
      return isSameMonth(d, currentMonth) && d >= now;
    });
    return groupIntoWeekends(monthEvents);
  }, [events, currentMonth]);

  const handleDayClick = (d: Date) => {
    setSelectedDay(d);
    const dateKey = format(d, "yyyy-MM-dd");
    setTimeout(() => {
      const el = document.getElementById(`events-${dateKey}`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }, 50);
  };

  const goToday = () => {
    setCurrentMonth(new Date());
    setSelectedDay(new Date());
  };

  const weekDays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  return (
    <div className="flex-1 overflow-auto">
      <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        {/* Timezone indicator */}
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Clock className="h-3 w-3" />
          <span>All times shown in your local timezone ({shortTzName})</span>
        </div>

        {/* Month navigation */}
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl font-bold tracking-tight" data-testid="text-month-title">
            {format(currentMonth, "MMMM yyyy")}
          </h2>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={goToday} data-testid="button-today">
              Today
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
              data-testid="button-prev-month"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
              data-testid="button-next-month"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Calendar grid */}
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <div className="grid grid-cols-7 border-b border-border">
            {weekDays.map((wd) => (
              <div
                key={wd}
                className="py-2 text-center text-xs font-medium text-muted-foreground uppercase tracking-wider"
              >
                {wd}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7">
            {calendarDays.map((d, index) => {
              const dateKey = format(d, "yyyy-MM-dd");
              const dayEvents = eventsByDate.get(dateKey) || [];
              const inMonth = isSameMonth(d, currentMonth);
              const today = isToday(d);
              const isSelected = selectedDay && isSameDay(d, selectedDay);

              const uniqueColors = Array.from(new Set(dayEvents.map((e) => e.seriesColor))).slice(0, 4);

              return (
                <button
                  key={dateKey}
                  onClick={() => handleDayClick(d)}
                  data-testid={`button-day-${dateKey}`}
                  className={`
                    relative min-h-[60px] sm:min-h-[72px] p-1.5 text-left border-b border-r border-border
                    transition-colors duration-100
                    ${!inMonth ? "opacity-30" : ""}
                    ${isSelected ? "bg-accent" : "hover:bg-accent/50"}
                    ${index % 7 === 6 ? "border-r-0" : ""}
                  `}
                >
                  <span
                    className={`
                      inline-flex items-center justify-center w-6 h-6 text-xs font-medium rounded-full
                      ${today ? "bg-primary text-primary-foreground" : ""}
                    `}
                  >
                    {format(d, "d")}
                  </span>

                  {uniqueColors.length > 0 && (
                    <div className="flex gap-0.5 mt-1 flex-wrap">
                      {uniqueColors.map((color, idx) => (
                        <span
                          key={color ?? `color-${idx}`}
                          className="w-1.5 h-1.5 rounded-full"
                          style={{ backgroundColor: color ?? "transparent" }}
                        />
                      ))}
                    </div>
                  )}

                  {dayEvents.length > 0 && (
                    <div className="hidden sm:block mt-0.5">
                      {dayEvents.slice(0, 2).map((e) => (
                        <div
                          key={e.id}
                          className="text-[10px] leading-tight truncate rounded px-1 py-0.5 mt-0.5 font-medium"
                          style={{
                            backgroundColor: e.seriesColor + "25",
                            color: isDark ? lightenColor(e.seriesColor, 65) : e.seriesColor,
                          }}
                        >
                          {`${e.title}`.trim()}
                        </div>
                      ))}
                      {dayEvents.length > 2 && (
                        <div className="text-[10px] text-muted-foreground mt-0.5 px-1">
                          +{dayEvents.length - 2} more
                        </div>
                      )}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Events list */}
        <div ref={eventListRef} className="space-y-4">
          <h3 className="font-display text-lg font-bold" data-testid="text-upcoming-title">
            {enabledSeries.length === 0
              ? "No series selected"
              : isLoading
                ? "Loading events..."
                : upcomingItems.length === 0
                  ? "No upcoming events this month"
                  : "Upcoming Events"}
          </h3>

          {isLoading && (
            <div className="space-y-3" data-testid="skeleton-events">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex gap-3 p-3 rounded-lg border border-border bg-card">
                  <Skeleton className="w-16 h-16 rounded-md" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {!isLoading && enabledSeries.length === 0 && (
            <div className="text-center py-12 text-muted-foreground" data-testid="text-empty-state">
              <CalendarIcon className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p className="text-sm">Enable some series from the sidebar to see events.</p>
            </div>
          )}

          {!isLoading &&
            upcomingItems.map((item, idx) =>
              isRaceWeekend(item) ? (
                <RaceWeekendCard
                  key={`weekend-${item.seriesId}-${item.round ?? 0}-${item.sessions[0]?.id ?? idx}`}
                  weekend={item}
                  selectedDay={selectedDay}
                />
              ) : (
                <SingleEventCard key={item.id} event={item} selectedDay={selectedDay} />
              ),
            )}
        </div>
      </div>
    </div>
  );
}

// ---------- Race weekend card ----------

function RaceWeekendCard({ weekend, selectedDay }: { weekend: RaceWeekend; selectedDay: Date | null }) {
  const firstDate = weekend.sessions[0].startDate;
  const lastDate = weekend.sessions[weekend.sessions.length - 1].startDate;

  return (
    <div
      id={`events-${format(new Date(firstDate), "yyyy-MM-dd")}`}
      data-testid={`card-weekend-${weekend.seriesId}-${weekend.round}`}
      className="rounded-lg border border-border bg-card overflow-hidden"
    >
      {/* Weekend header */}
      <div className="px-4 py-3 border-b border-border flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <span
            className="inline-flex items-center justify-center px-2 py-1 rounded text-[11px] font-bold uppercase tracking-wide text-white shrink-0"
            style={{ backgroundColor: weekend.seriesColor }}
          >
            {weekend.seriesShortName}
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold leading-tight truncate">
              {weekend.round ? `R${weekend.round} — ` : ""}
              {weekend.raceName}
            </p>
            {weekend.location && (
              <p className="flex items-center gap-1 mt-0.5 text-xs text-muted-foreground truncate">
                <MapPin className="h-3 w-3 shrink-0" />
                {weekend.location}
              </p>
            )}
          </div>
        </div>
        <div className="text-xs text-muted-foreground shrink-0 text-right">
          {formatLocalDate(firstDate)}
          {formatLocalDate(firstDate) !== formatLocalDate(lastDate) && ` — ${formatLocalDate(lastDate)}`}
        </div>
      </div>

      {/* Sessions list */}
      <div className="divide-y divide-border">
        {weekend.sessions.map((session) => {
          const isHighlighted = selectedDay && isSameDay(new Date(session.startDate), selectedDay);

          return (
            <div
              key={session.id}
              data-testid={`card-session-${session.id}`}
              className={`px-4 py-2.5 flex items-center gap-3 text-sm ${isHighlighted ? "bg-accent" : ""}`}
            >
              {/* Time column */}
              <div className="w-16 shrink-0 text-right">
                {session.isAllDay ? (
                  <span className="text-xs text-muted-foreground">All day</span>
                ) : (
                  <span className="font-mono text-xs font-medium">{formatLocalTime(session.startDate)}</span>
                )}
              </div>

              {/* Session icon */}
              <span className="text-sm shrink-0 w-5 text-center">{getSessionIcon(session.sessionType)}</span>

              {/* Session name */}
              <span className="flex-1 min-w-0 truncate">{session.sessionType || session.title}</span>

              {/* Day label */}
              <span className="text-xs text-muted-foreground shrink-0">
                {new Date(session.startDate).toLocaleDateString([], {
                  weekday: "short",
                })}
              </span>

              {/* Badge */}
              <Badge variant={getSessionBadgeVariant(session.sessionType)} className="text-[10px] shrink-0">
                {session.sessionType || "Event"}
              </Badge>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------- Single event card (non-grouped) ----------

function SingleEventCard({ event, selectedDay }: { event: CalendarEvent; selectedDay: Date | null }) {
  const isHighlighted = selectedDay && isSameDay(new Date(event.startDate), selectedDay);

  return (
    <div
      id={`events-${format(new Date(event.startDate), "yyyy-MM-dd")}`}
      data-testid={`card-event-${event.id}`}
      className={`flex items-start gap-3 p-3 rounded-lg border bg-card ${
        isHighlighted ? "border-primary/40 ring-1 ring-primary/20" : "border-border"
      }`}
    >
      {/* Series badge */}
      <span
        className="inline-flex items-center justify-center px-2 py-1 rounded text-[11px] font-bold uppercase tracking-wide text-white shrink-0"
        style={{ backgroundColor: event.seriesColor }}
      >
        {event.seriesShortName}
      </span>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold leading-tight truncate">{event.title}</p>
        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
          {event.isAllDay ? (
            <span className="flex items-center gap-1">
              <CalendarIcon className="h-3 w-3" />
              {formatLocalDate(event.startDate)}
            </span>
          ) : (
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatLocalDate(event.startDate)}, {formatLocalTime(event.startDate)}
              <span className="text-muted-foreground/60">{shortTzName}</span>
            </span>
          )}
          {event.location && (
            <span className="flex items-center gap-1 truncate">
              <MapPin className="h-3 w-3 shrink-0" />
              {event.location}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
