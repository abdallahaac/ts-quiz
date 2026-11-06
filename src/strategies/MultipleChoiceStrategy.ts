import type { AnswerStrategy, Evaluation, Question } from "../domain/models";

export class MultipleChoiceStrategy implements AnswerStrategy {
  evaluate(question: Question, selected: number): Evaluation {
    const answer = question.answers[selected];
    const correctIndex = question.answers.findIndex((answer) => answer.correct);
    if (!Number.isInteger(selected) || !answer || correctIndex < 0)
      throw new RangeError("Invalid answer selection");
    return Object.freeze({ correct: answer.correct, correctIndex });
  }
}
