import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { captureInstallPrompt } from "./lib/pwa";

if (!window.location.hash) {
  window.location.hash = "#/";
}

captureInstallPrompt();

createRoot(document.getElementById("root")!).render(<App />);
