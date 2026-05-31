import { useRegisterSW } from "virtual:pwa-register/react";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { useEffect, useState, useCallback } from "react";
import { getDeferredPrompt, clearDeferredPrompt } from "@/lib/pwa";

export function PwaInstallButton() {
  const [available, setAvailable] = useState(() => !!getDeferredPrompt());

  useEffect(() => {
    const handler = () => setAvailable(true);
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = useCallback(async () => {
    const dp = getDeferredPrompt();
    if (!dp) return;
    dp.prompt();
    const { outcome } = await dp.userChoice;
    if (outcome === "accepted") {
      clearDeferredPrompt();
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
          <Button variant="default" size="sm" onClick={() => updateServiceWorker(true)}>
            Update
          </Button>
        ),
      });
    }
  }, [needRefresh, updateServiceWorker]);

  return null;
}
