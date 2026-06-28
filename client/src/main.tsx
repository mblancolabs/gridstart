import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { captureInstallPrompt } from "./lib/pwa";

if (!window.location.hash) {
  window.location.hash = "#/";
}

captureInstallPrompt();

navigator.serviceWorker?.addEventListener("controllerchange", () => {
  window.location.reload();
});

setInterval(() => {
  navigator.serviceWorker
    ?.getRegistration()
    ?.then((reg) => reg?.update());
}, 60 * 60 * 1000);

createRoot(document.getElementById("root")!).render(<App />);
