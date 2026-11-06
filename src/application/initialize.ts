import { parseQuestions } from "../parsers/QuizParser";
import { richHTML } from "../parsers/richContent";
import { BrightspaceAdapter } from "../adapters/BrightspaceAdapter";
import { MultipleChoiceStrategy } from "../strategies/MultipleChoiceStrategy";
import { QuizSession } from "./QuizSession";
import { QuizController } from "./QuizController";
import { QuizView } from "../views/QuizView";

const mounted = new WeakMap<HTMLElement, () => void>();
const editable =
  '.mce-content-body, [contenteditable="true"], [contenteditable=""]';
export function inEditor(doc: Document): boolean {
  return (
    doc.designMode?.toLowerCase() === "on" ||
    !!doc.body?.isContentEditable ||
    doc.documentElement.isContentEditable ||
    !!doc.body?.matches(editable) ||
    doc.documentElement.matches(editable)
  );
}
export function dispose(doc: Document = document): void {
  const root = doc.getElementById("quiz-learner-root");
  if (root) mounted.get(root)?.();
}
export function initialize(doc: Document = document): (() => void) | undefined {
  const root = doc.getElementById("quiz-learner-root");
  const win = doc.defaultView;
  if (!root || !win || inEditor(doc)) return;
  const existing = mounted.get(root);
  if (existing) return existing;
  const source = doc.querySelector(
    "#quiz-authoring-source, [data-quiz-source], .quiz-authoring-source",
  );
  const { questions, diagnostics } = parseQuestions(source);
  let active = true;
  let controller: QuizController | undefined;
  let warning: HTMLElement | undefined;
  const warn = (message: string): void => {
    if (!active || inEditor(doc) || warning) return;
    warning = doc.createElement("p");
    warning.className = "quiz-asset-warning";
    warning.setAttribute("role", "status");
    warning.textContent = message;
    root.before(warning);
  };
  if (diagnostics.length) {
    const notice = doc.createElement("div");
    notice.className = "quiz-problem";
    notice.setAttribute("role", "alert");
    const title = doc.createElement("h2");
    title.textContent = "Quiz configuration needs attention";
    const help = doc.createElement("p");
    help.textContent =
      "Reopen Edit HTML / Design View, correct the following items, then Save and Close.";
    const list = doc.createElement("ul");
    for (const message of diagnostics) {
      const item = doc.createElement("li");
      item.textContent = message;
      list.append(item);
    }
    notice.append(title, help, list);
    root.replaceChildren(notice);
  } else {
    const components = BrightspaceAdapter.available(doc);
    const view = new QuizView(
      root,
      new BrightspaceAdapter(components),
      richHTML(
        doc.querySelector(
          "[data-quiz-global-instructions], .quiz-edit-instructions",
        ),
      ),
    );
    controller = new QuizController(
      new QuizSession(questions, new MultipleChoiceStrategy()),
      view,
    );
    if (!components)
      warn(
        "The D2L component bundle did not load. Basic quiz controls are available. Ask the course owner to restore assets/brightspace-components.js from the complete quiz package.",
      );
    void doc.fonts
      ?.load("19px Lato")
      .catch(() =>
        warn(
          "The Lato font files did not load. Ask the course owner to restore the fonts folder from the complete quiz package.",
        ),
      );
  }
  root.setAttribute("data-quiz-ready", "");
  const cleanup = (): void => {
    if (!active) return;
    active = false;
    observer.disconnect();
    doc.removeEventListener("focusin", checkEditor);
    win.removeEventListener("pagehide", cleanup);
    controller?.dispose();
    root.replaceChildren();
    warning?.remove();
    root.removeAttribute("data-quiz-ready");
    mounted.delete(root);
  };
  const checkEditor = (): void => {
    if (inEditor(doc)) cleanup();
  };
  const observer = new win.MutationObserver(checkEditor);
  observer.observe(doc.body, {
    attributes: true,
    attributeFilter: ["contenteditable", "class"],
  });
  observer.observe(doc.documentElement, {
    attributes: true,
    attributeFilter: ["contenteditable", "class"],
  });
  doc.addEventListener("focusin", checkEditor);
  win.addEventListener("pagehide", cleanup);
  mounted.set(root, cleanup);
  return cleanup;
}
