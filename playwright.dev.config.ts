import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/dev",
  use: {
    baseURL: "http://127.0.0.1:4174/",
    channel: "chrome",
    reducedMotion: "reduce",
  },
  webServer: {
    command: "npm run dev -- --port 4174 --strictPort",
    url: "http://127.0.0.1:4174/brightspace-quiz.html",
  },
});
