import { test, expect } from "@playwright/test";

test("Brightspace editor shows a static Word import link without running quiz JS", async ({ page }) => {
  await page.route("**/content/enforced/test-course/quiz/index.html", async (route) => {
    const response = await route.fetch();
    const html = (await response.text()).replace("<body>", '<body contenteditable="true">');
    await route.fulfill({ response, body: html, contentType: "text/html" });
  });
  await page.route("**/assets/*.js", (route) => route.abort());
  await page.goto("index.html");
  const link = page.getByRole("link", { name: /Import questions from Word \(opens in a new tab\)/ });
  await expect(link).toBeVisible();
  await expect(link).toHaveAttribute("href", "./import-questions.html");
  await expect(page.locator(".quiz-question-table")).toBeVisible();
});

test("standalone importer is a normal page with a DOCX file input and export actions", async ({ page }) => {
  await page.goto("import-questions.html");
  await expect(page.getByRole("heading", { name: "Import questions from Word" })).toBeVisible();
  await expect(page.locator("#word-file")).toHaveAttribute("accept", /\.docx/);
  await expect(page.locator("#download-quiz")).toBeDisabled();
  await expect(page.locator("#copy-table")).toBeDisabled();
});
