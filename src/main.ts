import { initialize, dispose } from "./application/initialize";
import { installDocxEditor } from "./views/DocxImportView";
import config from "../config.json";

export { initialize, dispose };

let cleanupEditor: (() => void) | undefined;
const start = (): void => {
  // Local simulation only: real Brightspace editing mode remains auto-detected.
  if (import.meta.env.DEV && config.editorMode) {
    document.body.contentEditable = "true";
  }
  cleanupEditor ??= installDocxEditor();
  initialize();
};
if (document.readyState === "loading")
  document.addEventListener("DOMContentLoaded", start, { once: true });
else start();
// Restore a page brought back from the browser's back/forward cache.
window.addEventListener("pageshow", start);
if (import.meta.hot)
  import.meta.hot.dispose(() => {
    document.removeEventListener("DOMContentLoaded", start);
    window.removeEventListener("pageshow", start);
    cleanupEditor?.();
    cleanupEditor = undefined;
    dispose();
  });
