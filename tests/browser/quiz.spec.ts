import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { createHash } from "node:crypto";

test.beforeEach(async ({ page }) => {
	// Apply the same neutral course theme to both versions; actual course overrides
	// cannot be reproduced outside an authenticated Brightspace tenant.
	await page.route("https://templates.lcs.brightspace.com/**", (route) =>
		route.fulfill({ contentType: "text/css", body: "" }),
	);
	await page.route("**/d2l/le/contentstyler/**", (route) =>
		route.fulfill({ contentType: "text/css", body: "" }),
	);
});
async function ready(page: Page, name = "index.html") {
	await page.goto(name);
	await expect(page.locator("#quiz-learner-root")).toHaveAttribute(
		"data-quiz-ready",
		"",
	);
	await page.evaluate(async () => {
		await document.fonts.ready;
	});
	await expect(page.locator(".quiz-loading")).toBeHidden();
}

test("classic build loads from a nested course folder with all local assets", async ({
	page,
}) => {
	const errors: string[] = [],
		missing: string[] = [];
	page.on("pageerror", (error) => errors.push(error.message));
	page.on("response", (response) => {
		if (
			response.status() >= 400 &&
			response.url().includes("/content/enforced/test-course/")
		)
			missing.push(response.url());
	});
	await ready(page);
	await expect(page.locator("d2l-button[data-check]")).toBeVisible();
	await expect(page.locator(".quiz-asset-warning")).toHaveCount(0);
	await page.getByRole("radio").nth(1).check();
	await page.getByRole("button", { name: "Check", exact: true }).click();
	await expect(page.getByRole("region", { name: "Feedback" })).toContainText(
		"Correct answer: B.",
	);
	await expect(page.getByRole("region", { name: "Feedback" })).toBeFocused();
	await page.getByRole("button", { name: "Next", exact: true }).click();
	await expect(page.locator("#quiz-active-panel")).toBeFocused();
	await page.getByRole("button", { name: "Previous", exact: true }).click();
	await expect(page.getByRole("radio").nth(1)).toBeChecked();
	await page.getByRole("button", { name: "Try Again", exact: true }).click();
	await expect(page.getByRole("radio").first()).toBeFocused();
	expect(errors).toEqual([]);
	expect(missing).toEqual([]);
});

test("native fallback supports keyboard answers, grading and reset", async ({
	page,
}) => {
	await page.route("**/assets/brightspace-components.js", (route) =>
		route.abort(),
	);
	await ready(page);
	await expect(page.locator("button[data-check]")).toBeDisabled();
	const radios = page.getByRole("radio");
	await radios.first().focus();
	await page.keyboard.press("ArrowDown");
	await expect(radios.nth(1)).toBeChecked();
	await page.getByRole("button", { name: "Check", exact: true }).click();
	await expect(page.locator("aside.question-feedback")).toBeVisible();
	await expect(radios.nth(1)).toBeDisabled();
	await page.getByRole("button", { name: "Try Again", exact: true }).click();
	await expect(radios.first()).toBeFocused();
	await expect(
		page.getByRole("button", { name: "Check", exact: true }),
	).toBeDisabled();
});

test("author edits are parsed from HTML without a rebuild", async ({
	page,
}) => {
	await page.route("**/index.html", async (route) => {
		const response = await route.fetch();
		const body = (await response.text()).replace(
			"Which action makes a link’s purpose easier to understand?",
			"Edited in the HTML question table?",
		);
		await route.fulfill({ response, body });
	});
	await ready(page);
	await expect(page.locator("d2l-button[data-check]")).toBeVisible();
	await expect(
		page.getByRole("heading", { name: "Edited in the HTML question table?" }),
	).toBeVisible();
	await page.getByRole("radio").first().check();
	await page.getByRole("button", { name: "Check", exact: true }).click();
	await expect(page.getByRole("region", { name: "Feedback" })).toBeVisible();
});

test("editor retains a visible editable table without learner controls", async ({
	page,
}) => {
	await page.route("**/index.html", async (route) => {
		const response = await route.fetch();
		await route.fulfill({
			response,
			body: (await response.text()).replace(
				"<body>",
				'<body contenteditable="true">',
			),
		});
	});
	await page.goto("index.html");
	await expect(page.locator(".quiz-question-table")).toBeVisible();
	await expect(page.locator(".quiz-editor-guide")).toBeVisible();
	await expect(page.locator("#quiz-learner-root")).toBeHidden();
	await expect(page.locator(".quiz-loading")).toBeHidden();
	await expect(page.getByRole("radio")).toHaveCount(0);
});

test("no accessibility violations before and after feedback", async ({
	page,
}) => {
	await ready(page);
	expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
	await page.getByRole("radio").first().check();
	await page.getByRole("button", { name: "Check", exact: true }).click();
	expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test("visual appearance matches the supplied quiz through learner interactions", async ({
	page,
	context,
}, info) => {
	const baseline = await context.newPage();
	await baseline.route("https://templates.lcs.brightspace.com/**", (route) =>
		route.fulfill({ contentType: "text/css", body: "" }),
	);
	await baseline.route("**/d2l/le/contentstyler/**", (route) =>
		route.fulfill({ contentType: "text/css", body: "" }),
	);
	await ready(baseline, "original.html");
	await ready(page);
	const compare = async (stage: string) => {
		const hash = (buffer: Buffer) =>
			createHash("sha256").update(buffer).digest("hex");
		let before: Buffer = Buffer.alloc(0),
			after: Buffer = Buffer.alloc(0);
		// Native radio paint and asynchronous D2L icons can settle after feedback
		// receives focus. Require exact pixels once both renderers have settled.
		await expect
			.poll(
				async () => {
					for (const current of [baseline, page]) {
						await current.evaluate(async () => {
							const elements = [
								...document.querySelectorAll("*"),
							] as (Element & {
								updateComplete?: Promise<unknown>;
								loadingComplete?: Promise<unknown>;
							})[];
							await Promise.all(
								elements.flatMap((element) => [
									element.updateComplete,
									element.loadingComplete,
								]),
							);
							await document.fonts.ready;
						});
					}
					before = await baseline
						.locator(".quiz-page")
						.screenshot({ animations: "disabled" });
					after = await page
						.locator(".quiz-page")
						.screenshot({ animations: "disabled" });
					return hash(after) === hash(before);
				},
				{ message: stage, timeout: 5000 },
			)
			.toBe(true)
			.catch(async (error) => {
				await info.attach(`${stage}-original`, {
					body: before,
					contentType: "image/png",
				});
				await info.attach(`${stage}-refactored`, {
					body: after,
					contentType: "image/png",
				});
				throw error;
			});
	};
	await compare("initial");
	for (const current of [baseline, page]) {
		await current.getByRole("radio").first().check();
		await current.getByRole("button", { name: "Check", exact: true }).click();
		await expect(
			current.getByRole("region", { name: "Feedback" }),
		).toBeFocused();
	}
	await compare("incorrect-feedback");
	for (const current of [baseline, page])
		await current.getByRole("button", { name: "Next", exact: true }).click();
	await compare("next-question");
	for (const current of [baseline, page]) {
		await current.getByRole("radio").nth(1).check();
		await current.getByRole("button", { name: "Check", exact: true }).click();
		await expect(
			current.getByRole("region", { name: "Feedback" }),
		).toBeFocused();
	}
	await compare("correct-feedback");
	await baseline.close();
});
