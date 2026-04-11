import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "./queryClient";
import type { CalendarEvent, SeriesInfo, UserPreferences } from "@shared/schema";

export function useSeries() {
  return useQuery<SeriesInfo[]>({
    queryKey: ["/api/series"],
  });
}

export function usePreferences() {
  return useQuery<UserPreferences>({
    queryKey: ["/api/preferences"],
  });
}

export function useSavePreferences() {
  return useMutation({
    mutationFn: async (enabledSeries: string[]) => {
      const res = await apiRequest("PUT", "/api/preferences", {
        enabledSeries: JSON.stringify(enabledSeries),
      });
      return res.json();
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
      if (seriesIds.length === 0) return [];
      const res = await apiRequest(
        "GET",
        `/api/events?series=${seriesParam}&from=${from}&to=${to}`
      );
      return res.json();
    },
    enabled: seriesIds.length > 0,
  });
}
