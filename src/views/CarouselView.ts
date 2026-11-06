import type { Question, QuizState } from "../domain/models";
export function renderDots(
  questions: readonly Question[],
  state: QuizState,
): string {
  if (questions.length < 2) return "";
  return `<nav class="carousel-indicators" aria-label="Quiz question navigation">${questions.map((_q, i) => `<button type="button" class="carousel-indicator" data-jump="${i}" aria-label="Go to question ${i + 1}" title="Go to question ${i + 1}" aria-current="${i === state.index ? "step" : "false"}"><span class="sr-only">Question ${i + 1}</span></button>`).join("")}</nav>`;
}
