import { initialize, dispose } from "./application/initialize";
export { initialize, dispose };

const start = (): void => {
  initialize();
};
if (document.readyState === "loading")
  document.addEventListener("DOMContentLoaded", start, { once: true });
else start();
// Restore a page brought back from the browser's back/forward cache after pagehide cleanup.
window.addEventListener("pageshow", start);
if (import.meta.hot)
  import.meta.hot.dispose(() => {
    document.removeEventListener("DOMContentLoaded", start);
    window.removeEventListener("pageshow", start);
    dispose();
  });
