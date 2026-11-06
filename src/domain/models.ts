export interface Answer {
  readonly html: string;
  readonly text: string;
  readonly markerCount: number;
  readonly correct: boolean;
}
export interface Question {
  readonly type: "multiple-choice";
  readonly id: string;
  readonly index: number;
  readonly prompt: string;
  readonly plainPrompt: string;
  readonly instructions: string;
  readonly answers: readonly Answer[];
  readonly feedback: string;
  issues: string[];
  valid: boolean;
}
export interface UnusedQuestion {
  index: number;
  unused: true;
}
export interface ParseResult {
  questions: Question[];
  diagnostics: string[];
  unused: number;
}
export interface Evaluation {
  readonly correct: boolean;
  readonly correctIndex: number;
}
export interface AnswerStrategy {
  evaluate(question: Question, selected: number): Evaluation;
}
export type Attempt =
  | { readonly status: "unanswered" }
  | { readonly status: "selected"; readonly selected: number }
  | {
      readonly status: "graded";
      readonly selected: number;
      readonly evaluation: Evaluation;
    };
export interface QuizState {
  readonly index: number;
  readonly attempts: Readonly<Record<string, Attempt>>;
  readonly direction: "next" | "previous";
  readonly phase: "answering" | "feedback" | "completed";
}
export type ChangeKind = "select" | "check" | "reset" | "navigate" | "restart";
export interface QuizChange {
  readonly kind: ChangeKind;
  readonly state: QuizState;
}
