import { useMemo, useState } from "react";
import { Calendar, Copy, Check, ExternalLink } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { usePreferences } from "@/lib/hooks";

export function SyncDialog() {
  const { data: prefs } = usePreferences();
  const [copied, setCopied] = useState(false);

  const enabledSeries = useMemo(() => {
    if (!prefs) return [];
    try {
      return JSON.parse(prefs.enabledSeries) as string[];
    } catch {
      return [];
    }
  }, [prefs]);

  const subscriptionUrl = useMemo(() => {
    const base = window.location.origin;
    const seriesParam = enabledSeries.join(",");
    return `${base}/api/export.ics?series=${seriesParam}`;
  }, [enabledSeries]);

  const googleCalUrl = useMemo(() => {
    return `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(subscriptionUrl)}`;
  }, [subscriptionUrl]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(subscriptionUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      const input = document.createElement("input");
      input.value = subscriptionUrl;
      document.body.appendChild(input);
      input.select();
      document.execCommand("copy");
      document.body.removeChild(input);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" data-testid="button-sync-calendar">
          <Calendar className="h-4 w-4 mr-2" />
          <span className="hidden sm:inline">Sync Calendar</span>
          <span className="sm:hidden">Sync</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display">Sync with Calendar</DialogTitle>
          <DialogDescription>
            Subscribe to your selected series in your preferred calendar app.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {/* Subscription URL */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Subscription URL
            </label>
            <div className="flex gap-2">
              <div className="flex-1 bg-muted rounded-md px-3 py-2 text-xs font-mono break-all max-h-20 overflow-auto" data-testid="text-subscription-url">
                {subscriptionUrl}
              </div>
              <Button
                variant="outline"
                size="icon"
                onClick={handleCopy}
                data-testid="button-copy-url"
              >
                {copied ? (
                  <Check className="h-4 w-4 text-green-500" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          {/* Quick links */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Quick Subscribe
            </label>
            <div className="space-y-2">
              <a
                href={googleCalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 p-3 rounded-lg border border-border hover:bg-accent/50 transition-colors text-sm"
                data-testid="link-google-calendar"
              >
                <ExternalLink className="h-4 w-4 text-muted-foreground" />
                Open in Google Calendar
              </a>
            </div>
          </div>

          {/* Instructions */}
          <div className="text-xs text-muted-foreground space-y-1.5 border-t border-border pt-3">
            <p className="font-medium text-foreground">How to subscribe:</p>
            <p><strong>Apple Calendar:</strong> File → New Calendar Subscription → paste the URL</p>
            <p><strong>Google Calendar:</strong> Click the link above or add by URL in settings</p>
            <p><strong>Outlook:</strong> Add Calendar → From Internet → paste the URL</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
