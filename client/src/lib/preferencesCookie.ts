const COOKIE_NAME = "gridstart_enabled_series";
const YEAR_SECONDS = 60 * 60 * 24 * 365;

export function getEnabledSeriesFromCookie(): string[] | null {
  const cookies = document.cookie.split(";");
  for (const cookie of cookies) {
    const [name, value] = cookie.trim().split("=");
    if (name === COOKIE_NAME) {
      try {
        const parsed = JSON.parse(decodeURIComponent(value));
        if (Array.isArray(parsed)) return parsed;
      } catch {
        return null;
      }
    }
  }
  return null;
}

export function setEnabledSeriesCookie(series: string[]): void {
  const value = encodeURIComponent(JSON.stringify(series));
  const secure = location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${COOKIE_NAME}=${value}; path=/; max-age=${YEAR_SECONDS}; SameSite=Lax${secure}`;
}
