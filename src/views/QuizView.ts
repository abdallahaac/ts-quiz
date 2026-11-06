import type { QuizSession } from "../application/QuizSession";
import { BrightspaceAdapter } from "../adapters/BrightspaceAdapter";
import { escapeHTML } from "../utils/markup";
import { renderOptions } from "./QuestionView";
import { renderFeedback } from "./FeedbackView";
import { renderDots } from "./CarouselView";
export class QuizView {
  private readonly live: HTMLParagraphElement;
  constructor(
    readonly root: HTMLElement,
    private readonly adapter: BrightspaceAdapter,
    private readonly globalInstructions: string,
  ) {
    this.live = root.ownerDocument.createElement("p");
    this.live.className = "sr-only";
    this.live.setAttribute("aria-live", "polite");
    this.live.setAttribute("aria-atomic", "true");
    root.after(this.live);
  }
  render(session: QuizSession): void {
    const { root } = this;
    const { questions, state } = session;
    const q = session.question;
    const attempt = session.attempt();
    const isChecked = attempt.status === "graded";
    root.innerHTML = `
      <div class="quiz-section-instructions" aria-label="Activity instructions">
        <div class="quiz-section-instructions__icon" aria-hidden="true"><d2l-icon icon="tier1:draft"></d2l-icon><span class="quiz-fallback-icon">ⓘ</span></div>
        <div class="quiz-section-instructions__text">${this.globalInstructions}</div>
      </div>
      <div class="carousel-shell">
        <div class="carousel-progress-banner" aria-live="polite">Question ${state.index + 1} of ${questions.length}</div>
        <div id="quiz-active-panel" class="carousel-panel" data-direction="${state.direction}" role="group" aria-roledescription="slide" aria-label="Question ${state.index + 1} of ${questions.length}" tabindex="-1">
          <section class="question-card block-card">
            <h2 class="question-legend" id="quiz-question-heading">${q.prompt}</h2>
            ${this.adapter.instructions(q.instructions)}
            <fieldset class="question-fieldset">
              <legend class="sr-only">${escapeHTML(q.plainPrompt)}</legend>
              <div class="answer-options answer-options--radio" role="radiogroup" aria-label="${escapeHTML(q.plainPrompt)}">${renderOptions(q, attempt)}</div>
              ${renderFeedback(q, attempt, this.adapter.components)}
            </fieldset>
          </section>
        </div>
        <div class="activity-actions ${questions.length < 2 ? "activity-actions--single" : ""}">
          ${
            questions.length > 1
              ? `<div class="activity-actions__secondary">
            ${this.adapter.button("Previous", "data-prev", false, state.index === 0)}
            ${this.adapter.button("Next", "data-next", false, state.index === questions.length - 1)}
          </div>`
              : ""
          }
          ${renderDots(questions, state)}
          <div class="activity-actions__primary">
            ${this.adapter.button("Check", "data-check", true, isChecked || attempt.status === "unanswered", isChecked)}
            ${this.adapter.button("Try Again", "data-reset", true, false, !isChecked)}
          </div>
        </div>
      </div>
      `;
  }
  updateSelection(): void {
    this.root.querySelector("[data-check]")?.removeAttribute("disabled");
  }
  focusPanel(): void {
    this.root.querySelector<HTMLElement>("#quiz-active-panel")?.focus();
  }
  focusAnswer(): void {
    this.root.querySelector<HTMLElement>("[data-answer-index]")?.focus();
  }
  focusFeedback(): void {
    void this.adapter.focusFeedback(
      this.root.querySelector(".question-feedback__content"),
    );
  }
  announce(message: string): void {
    this.live.textContent = message;
  }
  dispose(): void {
    this.live.remove();
    this.root.replaceChildren();
  }
}
