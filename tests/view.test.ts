import { afterEach, expect, it, vi } from "vitest";
import { initialize, dispose, inEditor } from "../src/application/initialize";
import { BrightspaceAdapter } from "../src/adapters/BrightspaceAdapter";
import { renderFeedback } from "../src/views/FeedbackView";
import { answerLabel } from "../src/utils/markup";
import { mountFixture, questions } from "./helpers";

afterEach(() => {
  dispose();
  document.body.removeAttribute("contenteditable");
  document.body.className = "";
  document.documentElement.removeAttribute("contenteditable");
  document.documentElement.className = "";
  document.designMode = "off";
  document.head.innerHTML = "";
  document.body.innerHTML = "";
  vi.restoreAllMocks();
});
function select(root: HTMLElement, value: number) {
  const input = root.querySelector<HTMLInputElement>(
    `input[value="${value}"]`,
  )!;
  input.checked = true;
  input.dispatchEvent(new Event("change", { bubbles: true }));
}
function click(root: HTMLElement, selector: string) {
  root.querySelector<HTMLElement>(selector)!.click();
}
it("initializes once, selects and grades an answer, announces feedback, and restores navigation state", () => {
  const root = mountFixture(),
    cleanup = initialize();
  expect(initialize()).toBe(cleanup);
  expect(root.hasAttribute("data-quiz-ready")).toBe(true);
  expect(root.querySelector("[data-check]")?.hasAttribute("disabled")).toBe(
    true,
  );
  expect(root.querySelector("details[open]")).not.toBeNull();
  select(root, 0);
  expect(root.querySelector("[data-check]")?.hasAttribute("disabled")).toBe(
    false,
  );
  click(root, "[data-check]");
  expect(
    root.querySelector(".question-feedback__content")?.textContent,
  ).toContain("Correct answer: B.");
  expect(document.activeElement?.className).toBe("question-feedback__content");
  expect(root.nextElementSibling?.textContent).toBe("Question 1: Incorrect.");
  expect(root.querySelectorAll("input:disabled")).toHaveLength(4);
  click(root, "[data-next]");
  expect(document.activeElement?.id).toBe("quiz-active-panel");
  expect(
    root.querySelector('[aria-current="step"]')?.getAttribute("data-jump"),
  ).toBe("1");
  click(root, "[data-prev]");
  expect(root.querySelector("input:checked")?.getAttribute("value")).toBe("0");
  click(root, "[data-reset]");
  expect(root.querySelector("input:checked")).toBeNull();
  expect(document.activeElement?.getAttribute("value")).toBe("0");
  expect(root.querySelector("[data-check]")?.hasAttribute("disabled")).toBe(
    true,
  );
});
it("selects by clicking the answer text, preserves links, and supports jump controls", () => {
  const root = mountFixture();
  initialize();
  click(root, ".answer-option__text");
  expect(root.querySelector("input:checked")?.getAttribute("value")).toBe("0");
  const anchor = document.createElement("a");
  anchor.href = "#guide";
  root.querySelectorAll(".answer-option__text")[1]!.append(anchor);
  anchor.click();
  expect(root.querySelector("input:checked")?.getAttribute("value")).toBe("0");
  click(root, '[data-jump="1"]');
  expect(root.querySelector(".carousel-progress-banner")?.textContent).toBe(
    "Question 2 of 2",
  );
  expect(root.querySelector("[data-next]")?.hasAttribute("disabled")).toBe(
    true,
  );
});
it("cleans up retained controls, live regions, observers, warnings, and permits remount", async () => {
  const root = mountFixture();
  const cleanup = initialize()!;
  const oldRadio = root.querySelector<HTMLInputElement>("input")!;
  cleanup();
  cleanup();
  oldRadio.dispatchEvent(new Event("change", { bubbles: true }));
  expect(root.children).toHaveLength(0);
  expect(root.hasAttribute("data-quiz-ready")).toBe(false);
  expect(document.querySelector(".quiz-asset-warning")).toBeNull();
  expect(root.nextElementSibling).toBeNull();
  initialize();
  expect(root.querySelector("input:checked")).toBeNull();
  document.body.setAttribute("contenteditable", "true");
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(root.children).toHaveLength(0);
  expect(root.hasAttribute("data-quiz-ready")).toBe(false);
  document.body.removeAttribute("contenteditable");
  initialize();
  expect(root.querySelector("input")).not.toBeNull();
});
it.each(["body", "html", "tiny", "design"])(
  "does not modify authoring content in %s editor mode",
  (mode) => {
    const root = mountFixture();
    if (mode === "body") document.body.setAttribute("contenteditable", "true");
    if (mode === "html")
      document.documentElement.setAttribute("contenteditable", "");
    if (mode === "tiny") document.body.className = "mce-content-body";
    if (mode === "design") document.designMode = "on";
    const before = document.body.innerHTML;
    expect(inEditor(document)).toBe(true);
    expect(initialize()).toBeUndefined();
    expect(document.body.innerHTML).toBe(before);
    expect(root.children).toHaveLength(0);
  },
);
it("shows author-facing diagnostics and prevents partial learner quizzes", () => {
  const root = mountFixture();
  document.querySelector("#quiz-authoring-source h2")!.textContent = "";
  initialize();
  expect(root.querySelector('[role="alert"]')?.textContent).toContain(
    "Question row 1",
  );
  expect(root.querySelector("input")).toBeNull();
  expect(root.hasAttribute("data-quiz-ready")).toBe(true);
});
it("handles a missing mount, missing source, and a single question", () => {
  expect(initialize()).toBeUndefined();
  const root = mountFixture();
  document.querySelector("#quiz-authoring-source")!.remove();
  initialize();
  expect(root.textContent).toContain("editable question source is missing");
  dispose();
  mountFixture();
  document.querySelectorAll("tbody tr")[1]!.remove();
  initialize();
  expect(document.querySelector(".carousel-indicators")).toBeNull();
  expect(document.querySelector("[data-next]")).toBeNull();
});
it("builds real custom controls only when all required components are available", () => {
  const root = mountFixture();
  vi.spyOn(BrightspaceAdapter, "available").mockReturnValue(true);
  initialize();
  expect(root.querySelector("d2l-button[data-check]")).not.toBeNull();
  expect(root.querySelector("d2l-collapsible-panel")).not.toBeNull();
  select(root, 1);
  click(root, "[data-check]");
  expect(root.querySelector("d2l-alert")).not.toBeNull();
  expect(root.nextElementSibling?.textContent).toBe("Question 1: Correct.");
});
it("waits for custom element rendering before focusing feedback", async () => {
  const alert = document.createElement("d2l-alert") as HTMLElement & {
    updateComplete: Promise<unknown>;
  };
  const feedback = document.createElement("div");
  feedback.tabIndex = -1;
  alert.append(feedback);
  document.body.append(alert);
  alert.updateComplete = Promise.resolve();
  await new BrightspaceAdapter(true).focusFeedback(feedback);
  expect(document.activeElement).toBe(feedback);
});
it("generates feedback only after grading and supports answer labels beyond Z", () => {
  const q = questions()[0]!;
  expect(renderFeedback(q, { status: "selected", selected: 0 }, false)).toBe(
    "",
  );
  expect(
    renderFeedback(
      q,
      {
        status: "graded",
        selected: 0,
        evaluation: { correct: false, correctIndex: 1 },
      },
      false,
    ),
  ).toContain(q.feedback);
  expect(answerLabel(25)).toBe("Z.");
  expect(answerLabel(26)).toBe("AA.");
});
