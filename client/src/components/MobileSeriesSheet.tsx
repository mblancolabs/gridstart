import { useMemo } from "react";
import { SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useSeries, usePreferences, useSavePreferences } from "@/lib/hooks";
import type { SeriesInfo } from "@shared/schema";

export function MobileSeriesSheet() {
  const { data: series } = useSeries();
  const { data: prefs } = usePreferences();
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

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" size="icon" className="lg:hidden" data-testid="mobile-series-trigger">
          <SlidersHorizontal className="h-4 w-4" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-80 overflow-y-auto" data-testid="mobile-series-sheet">
        <SheetHeader>
          <SheetTitle className="font-display">Racing Series</SheetTitle>
          <SheetDescription>Toggle series to show in your calendar.</SheetDescription>
        </SheetHeader>

        <div className="mt-4 space-y-4">
          {categories.map((cat) => (
            <div key={cat.name} className="space-y-1.5">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                {cat.name}
              </h4>
              {cat.items.map((s) => {
                const enabled = enabledSeries.includes(s.id);
                return (
                  <div
                    key={s.id}
                    className="flex items-center justify-between py-2 px-1"
                    data-testid={`mobile-series-${s.id}`}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: s.color }}
                      />
                      <span className="text-sm">{s.name}</span>
                    </div>
                    <Switch
                      checked={enabled}
                      onCheckedChange={() => toggleSeries(s.id)}
                      data-testid={`mobile-switch-${s.id}`}
                    />
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
