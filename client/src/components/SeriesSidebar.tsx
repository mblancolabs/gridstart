import { useMemo } from "react";
import { ChevronDown, Settings } from "lucide-react";
import { Link } from "wouter";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useSeries, usePreferences, useSavePreferences } from "@/lib/hooks";
import { Skeleton } from "@/components/ui/skeleton";
import type { SeriesInfo } from "@shared/schema";

export function SeriesSidebar() {
  const { data: series, isLoading: seriesLoading } = useSeries();
  const { data: prefs, isLoading: prefsLoading } = usePreferences();
  const savePrefs = useSavePreferences();

  const enabledSeries = useMemo(() => {
    if (!prefs) return [];
    try {
      return JSON.parse(prefs.enabledSeries) as string[];
    } catch {
      return [];
    }
  }, [prefs]);

  const categories = useMemo(() => {
    if (!series) return [];
    const map = new Map<string, SeriesInfo[]>();
    for (const s of series) {
      if (!map.has(s.category)) map.set(s.category, []);
      map.get(s.category)!.push(s);
    }
    return Array.from(map.entries()).map(([name, items]) => ({ name, items }));
  }, [series]);

  const toggleSeries = (id: string) => {
    const next = enabledSeries.includes(id)
      ? enabledSeries.filter((s) => s !== id)
      : [...enabledSeries, id];
    savePrefs.mutate(next);
  };

  const isLoading = seriesLoading || prefsLoading;

  return (
    <aside className="w-72 shrink-0 border-r border-border bg-sidebar overflow-y-auto hidden lg:block">
      <div className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Racing Series
          </h3>
          <Link href="/settings">
            <Button variant="ghost" size="icon" className="h-7 w-7" data-testid="button-settings-link">
              <Settings className="h-3.5 w-3.5" />
            </Button>
          </Link>
        </div>

        {isLoading && (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
              </div>
            ))}
          </div>
        )}

        {!isLoading &&
          categories.map((cat) => (
            <Collapsible key={cat.name} defaultOpen>
              <CollapsibleTrigger className="flex items-center gap-1.5 w-full text-left group" data-testid={`trigger-category-${cat.name.toLowerCase().replace(/\s+/g, "-")}`}>
                <ChevronDown className="h-3 w-3 text-muted-foreground transition-transform group-data-[state=closed]:-rotate-90" />
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  {cat.name}
                </span>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-1.5 space-y-0.5">
                {cat.items.map((s) => {
                  const enabled = enabledSeries.includes(s.id);
                  return (
                    <div
                      key={s.id}
                      className="flex items-center justify-between py-1.5 px-1 rounded hover:bg-accent/50 transition-colors"
                      data-testid={`sidebar-series-${s.id}`}
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: s.color }}
                        />
                        <span className="text-sm">{s.shortName}</span>
                      </div>
                      <Switch
                        checked={enabled}
                        onCheckedChange={() => toggleSeries(s.id)}
                        className="scale-75"
                        data-testid={`sidebar-switch-${s.id}`}
                      />
                    </div>
                  );
                })}
              </CollapsibleContent>
            </Collapsible>
          ))}
      </div>
    </aside>
  );
}
