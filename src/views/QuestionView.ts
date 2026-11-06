import type { Question, Attempt } from "../domain/models";
import { answerLabel, escapeHTML } from "../utils/markup";
export function renderOptions(q: Question, attempt: Attempt): string {
  const selected =
    attempt.status === "unanswered" ? undefined : attempt.selected;
  return q.answers
    .map((answer, index) => {
      const chosen = selected === index;
      const graded = attempt.status === "graded";
      const result =
        graded && (answer.correct || chosen)
          ? `<span class="answer-option__result-icon"><d2l-icon icon="tier1:${answer.correct ? "check" : "close-default"}" style="color:${answer.correct ? "var(--activity-success)" : "var(--activity-danger)"}" aria-hidden="true"></d2l-icon><span class="quiz-fallback-icon" style="color:${answer.correct ? "var(--activity-success)" : "var(--activity-danger)"}" aria-hidden="true">${answer.correct ? "✓" : "×"}</span><span class="sr-only">${answer.correct ? "Correct" : "Incorrect"}</span></span>`
          : "";
      return `<div class="answer-option ${graded ? "is-checked is-disabled" : ""}">
        <input id="${q.id}-answer-${index}" class="answer-option__input" type="radio" name="quiz-answer-${escapeHTML(q.id)}" value="${index}" data-answer-index="${index}" aria-labelledby="${q.id}-label-${index}" ${chosen ? "checked" : ""} ${graded ? "disabled" : ""}>
        ${result}<label for="${q.id}-answer-${index}" class="answer-option__marker"><span class="sr-only">Answer </span>${answerLabel(index)}</label><div id="${q.id}-label-${index}" class="answer-option__text">${answer.html}</div>
      </div>`;
    })
    .join("");
}
