import { useMemo } from "react";
import { Link } from "wouter";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useSeries, usePreferences, useSavePreferences } from "@/lib/hooks";
import { Skeleton } from "@/components/ui/skeleton";
import type { SeriesInfo } from "@shared/schema";

export default function Settings() {
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

  // Group by category
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
    const next = enabledSeries.includes(id) ? enabledSeries.filter((s) => s !== id) : [...enabledSeries, id];
    savePrefs.mutate(next);
  };

  const toggleCategory = (items: SeriesInfo[], enable: boolean) => {
    const ids = items.map((s) => s.id);
    let next: string[];
    if (enable) {
      next = Array.from(new Set([...enabledSeries, ...ids]));
    } else {
      next = enabledSeries.filter((s) => !ids.includes(s));
    }
    savePrefs.mutate(next);
  };

  const isLoading = seriesLoading || prefsLoading;

  return (
    <div className="flex-1 overflow-auto">
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        <div className="flex items-center gap-3">
          <Link href="/">
            <Button variant="ghost" size="icon" aria-label="Back" data-testid="button-back">
              <ChevronLeft className="h-4 w-4" />
            </Button>
          </Link>
          <h2 className="font-display text-xl font-bold" data-testid="text-settings-title">
            Series Configuration
          </h2>
        </div>

        {isLoading && (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="space-y-3">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ))}
          </div>
        )}

        {!isLoading &&
          categories.map((cat) => {
            const allEnabled = cat.items.every((s) => enabledSeries.includes(s.id));

            return (
              <div key={cat.name} className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="font-display text-sm font-bold uppercase tracking-wider text-muted-foreground">
                    {cat.name}
                  </h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs h-7"
                    onClick={() => toggleCategory(cat.items, !allEnabled)}
                    data-testid={`button-toggle-category-${cat.name.toLowerCase().replace(/\s+/g, "-")}`}
                  >
                    {allEnabled ? "Deselect All" : "Select All"}
                  </Button>
                </div>

                <div className="rounded-lg border border-border bg-card divide-y divide-border">
                  {cat.items.map((s) => {
                    const enabled = enabledSeries.includes(s.id);
                    return (
                      <div
                        key={s.id}
                        className="flex items-center justify-between px-4 py-3"
                        data-testid={`row-series-${s.id}`}
                      >
                        <div className="flex items-center gap-3">
                          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
                          <div>
                            <p className="text-sm font-medium">{s.name}</p>
                            <p className="text-xs text-muted-foreground">{s.shortName}</p>
                          </div>
                        </div>
                        <Switch
                          checked={enabled}
                          onCheckedChange={() => toggleSeries(s.id)}
                          data-testid={`switch-series-${s.id}`}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
      </div>
    </div>
  );
}
