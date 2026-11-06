import { defineConfig } from "@playwright/test";
export default defineConfig({
	testDir: "./tests/browser",
	fullyParallel: true,
	use: {
		baseURL: "http://127.0.0.1:4173/content/enforced/test-course/quiz/",
		channel: "chrome",
		reducedMotion: "reduce",
		trace: "retain-on-failure",
	},
	projects: [
		{ name: "desktop", use: { viewport: { width: 1100, height: 1000 } } },
		{ name: "mobile", use: { viewport: { width: 390, height: 844 } } },
	],
	webServer: {
		command: "node scripts/test-server.mjs",
		url: "http://127.0.0.1:4173/content/enforced/test-course/quiz/index.html",
		reuseExistingServer: false,
	},
});
