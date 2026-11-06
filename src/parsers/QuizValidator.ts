import type { Answer } from "../domain/models";
import { normalizeText } from "./richContent";
const placeholderAnswer = /^Replace with answer [A-Z]\.$/i;
export function validateQuestion({
  plainPrompt,
  hasHeading,
  feedbackText,
  rawFeedbackText,
  answers,
  nestedAnswers,
}: {
  plainPrompt: string;
  hasHeading: boolean;
  feedbackText: string;
  rawFeedbackText: string;
  answers: readonly Answer[];
  nestedAnswers: boolean;
}): string[] {
  const issues: string[] = [];
  if (
    !plainPrompt ||
    plainPrompt === "NEW QUESTION — replace this heading to activate"
  )
    issues.push(
      "Replace the question heading with meaningful question text (Heading 2).",
    );
  if (!hasHeading) issues.push("Set the question heading to Heading 2.");
  if (
    !normalizeText(feedbackText) ||
    normalizeText(rawFeedbackText) === "Replace with feedback for the learner."
  )
    issues.push("Add meaningful feedback.");
  const meaningful = answers.filter(
    (answer) => answer.text && !placeholderAnswer.test(answer.text),
  );
  if (meaningful.length < 2)
    issues.push(
      `Provide at least two meaningful answers; found ${meaningful.length}.`,
    );
  answers.forEach((answer, i) => {
    if (!answer.text || placeholderAnswer.test(answer.text))
      issues.push(
        `Answer ${i + 1} is empty or still a placeholder. Write an answer or delete that list item.`,
      );
  });
  if (nestedAnswers)
    issues.push(
      "Keep answer choices at one list level; outdent nested choices.",
    );
  const markers = answers.reduce((sum, answer) => sum + answer.markerCount, 0);
  if (markers !== 1)
    issues.push(
      `Use exactly one [CORRECT] marker across the answer list; found ${markers}.`,
    );
  return issues;
}
