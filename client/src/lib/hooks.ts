import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "./queryClient";
import type { CalendarEvent, SeriesInfo, UserPreferences } from "@shared/schema";
import { getEnabledSeriesFromCookie, setEnabledSeriesCookie } from "./preferencesCookie";

export function useSeries() {
  return useQuery<SeriesInfo[]>({
    queryKey: ["/api/series"],
  });
}

export function usePreferences() {
  return useQuery<UserPreferences>({
    queryKey: ["/api/preferences"],
    queryFn: () => {
      const fromCookie = getEnabledSeriesFromCookie();
      const enabledSeries = fromCookie ?? [];
      return { id: 0, enabledSeries: JSON.stringify(enabledSeries) };
    },
    staleTime: Infinity,
  });
}

export function useSavePreferences() {
  return useMutation({
    mutationFn: async (enabledSeries: string[]) => {
      setEnabledSeriesCookie(enabledSeries);
      return { id: 0, enabledSeries: JSON.stringify(enabledSeries) };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/preferences"] });
      queryClient.invalidateQueries({ queryKey: ["/api/events"] });
    },
  });
}

export function useEvents(seriesIds: string[], from: string, to: string) {
  const seriesParam = seriesIds.join(",");
  return useQuery<CalendarEvent[]>({
    queryKey: ["/api/events", seriesParam, from, to],
    queryFn: async () => {
      const res = await apiRequest(
        "GET",
        `/api/events?series=${seriesParam}&from=${from}&to=${to}`
      );
      return res.json();
    },
    enabled: seriesIds.length > 0,
    initialData: seriesIds.length === 0 ? [] : undefined,
  });
}
