import type { QuizChange } from "../domain/models";
import { QuizSession } from "./QuizSession";
import { QuizView } from "../views/QuizView";

/** Delegated listeners survive view updates and are removed explicitly on disposal. */
export class QuizController {
  private readonly unsubscribe: () => void;
  constructor(
    readonly session: QuizSession,
    private readonly view: QuizView,
  ) {
    this.unsubscribe = session.subscribe((change) => this.onChange(change));
    view.root.addEventListener("change", this.onAnswer);
    view.root.addEventListener("click", this.onClick);
    view.render(session);
  }
  dispose(): void {
    this.view.root.removeEventListener("change", this.onAnswer);
    this.view.root.removeEventListener("click", this.onClick);
    this.unsubscribe();
    this.session.dispose();
    this.view.dispose();
  }
  private readonly onAnswer = (event: Event): void => {
    const target = event.target;
    if (
      !(
        target instanceof
        this.view.root.ownerDocument.defaultView!.HTMLInputElement
      ) ||
      !target.matches("[data-answer-index]")
    )
      return;
    this.session.select(Number(target.value));
  };
  private readonly onClick = (event: MouseEvent): void => {
    const win = this.view.root.ownerDocument.defaultView!;
    if (!(event.target instanceof win.Element)) return;
    const target = event.target;
    const control = target.closest<HTMLElement>(
      "[data-check], [data-reset], [data-prev], [data-next], [data-jump]",
    );
    if (control) {
      if (control.hasAttribute("disabled") || control.hasAttribute("hidden"))
        return;
      if (control.hasAttribute("data-check")) this.session.check();
      else if (control.hasAttribute("data-reset")) this.session.reset();
      else if (control.hasAttribute("data-prev"))
        this.session.go(this.session.state.index - 1);
      else if (control.hasAttribute("data-next"))
        this.session.go(this.session.state.index + 1);
      else this.session.go(Number(control.dataset.jump));
      return;
    }
    const option = target.closest(".answer-option");
    if (
      !option ||
      target.closest("a, input, label") ||
      this.session.attempt().status === "graded"
    )
      return;
    const input = option.querySelector("input");
    if (!input) return;
    input.checked = true;
    input.dispatchEvent(new win.Event("change", { bubbles: true }));
    input.focus();
  };
  private onChange({ kind }: QuizChange): void {
    if (kind === "select") {
      this.view.updateSelection();
      return;
    }
    this.view.render(this.session);
    switch (kind) {
      case "check": {
        this.view.focusFeedback();
        const attempt = this.session.attempt();
        if (attempt.status === "graded")
          this.view.announce(
            `Question ${this.session.state.index + 1}: ${attempt.evaluation.correct ? "Correct" : "Incorrect"}.`,
          );
        break;
      }
      case "navigate":
        this.view.focusPanel();
        this.view.announce(
          `Question ${this.session.state.index + 1} of ${this.session.questions.length}`,
        );
        break;
      case "reset":
      case "restart":
        this.view.focusAnswer();
        this.view.announce("Question reset.");
        break;
    }
  }
}
