import { test, expect } from "@playwright/test";
test("Vite serves npm components, lazy dictionaries, and local Lato assets", async ({
  page,
}) => {
  const errors: string[] = [],
    missing: string[] = [];
  await page.route("https://templates.lcs.brightspace.com/**", (route) =>
    route.fulfill({ contentType: "text/css", body: "" }),
  );
  await page.route("**/d2l/le/contentstyler/**", (route) =>
    route.fulfill({ contentType: "text/css", body: "" }),
  );
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("response", (response) => {
    if (
      response.url().startsWith("http://127.0.0.1:4174/") &&
      response.status() >= 400
    )
      missing.push(response.url());
  });
  await page.goto("brightspace-quiz.html");
  await expect(page.locator("d2l-button[data-check]")).toBeVisible();
  await page.getByRole("radio").nth(1).check();
  await page.getByRole("button", { name: "Check", exact: true }).click();
  await expect(page.getByRole("region", { name: "Feedback" })).toBeFocused();
  await page.evaluate(async () => {
    await document.fonts.ready;
  });
  expect(await page.evaluate(() => document.fonts.check("19px Lato"))).toBe(
    true,
  );
  await expect(page.locator(".quiz-asset-warning")).toHaveCount(0);
  expect(errors).toEqual([]);
  expect(missing).toEqual([]);
});
