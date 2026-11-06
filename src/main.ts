import { initialize, dispose } from "./application/initialize";
import config from "../config.json";

export { initialize, dispose };

const start = (): void => {
  if (import.meta.env.DEV && config.editorMode) {
    document.body.contentEditable = "true";
  }

  initialize();
};

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", start, {
    once: true,
  });
} else {
  start();
}

window.addEventListener("pageshow", start);

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    document.removeEventListener("DOMContentLoaded", start);
    window.removeEventListener("pageshow", start);
    dispose();
  });
}
