import { useRegisterSW } from "virtual:pwa-register/react";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { useEffect, useState, useCallback } from "react";

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
  prompt(): Promise<void>;
}

declare global {
  interface WindowEventMap {
    beforeinstallprompt: BeforeInstallPromptEvent;
  }
}

let deferredPrompt: BeforeInstallPromptEvent | null = null;

export function captureInstallPrompt() {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e;
  });
}

export function resetInstallPrompt() {
  deferredPrompt = null;
}

export function PwaInstallButton() {
  const [available, setAvailable] = useState(false);

  useEffect(() => {
    const handler = () => setAvailable(true);
    window.addEventListener("beforeinstallprompt", handler);
    if (deferredPrompt) setAvailable(true);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = useCallback(async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      deferredPrompt = null;
      setAvailable(false);
    }
  }, []);

  if (!available) return null;

  return (
    <Button variant="outline" size="sm" onClick={handleInstall}>
      Install App
    </Button>
  );
}

export function PwaUpdatePrompt() {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  useEffect(() => {
    if (needRefresh) {
      toast({
        title: "Update available",
        description: "A new version of GridStart is ready.",
        action: (
          <Button
            variant="default"
            size="sm"
            onClick={() => updateServiceWorker(true)}
          >
            Update
          </Button>
        ),
      });
    }
  }, [needRefresh, updateServiceWorker]);

  return null;
}
