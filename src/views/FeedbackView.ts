import type { Question, Attempt } from "../domain/models";
import { answerLabel } from "../utils/markup";
export function renderFeedback(
  q: Question,
  attempt: Attempt,
  components: boolean,
): string {
  if (attempt.status !== "graded") return "";
  const correctIndex = attempt.evaluation.correctIndex;
  const tag = components ? "d2l-alert" : "aside";
  return `<${tag} class="question-feedback ${components ? "" : "quiz-feedback-fallback"}" type="default">
      <div class="question-feedback__content" role="region" aria-label="Feedback" tabindex="-1">
        <h3>Feedback</h3>
        <div class="question-feedback__body">
          <p><strong>Correct answer: ${answerLabel(correctIndex)}</strong></p>
          ${q.feedback}
        </div>
      </div>
    </${tag}>`;
}
