import type {
  AnswerStrategy,
  Attempt,
  ChangeKind,
  Question,
  QuizChange,
  QuizState,
} from "../domain/models";
import { QuizEventEmitter } from "../events/QuizEventEmitter";
const unanswered: Attempt = Object.freeze({ status: "unanswered" });

/** Owns transitions only; no DOM, component registry, or browser globals. */
export class QuizSession {
  private current: QuizState = Object.freeze({
    index: 0,
    attempts: Object.freeze({}),
    direction: "next",
    phase: "answering",
  });
  private readonly changes = new QuizEventEmitter<QuizChange>();
  private disposed = false;
  constructor(
    readonly questions: readonly Question[],
    private readonly strategy: AnswerStrategy,
  ) {
    if (!questions.length || questions.some((q) => !q.valid))
      throw new Error("A session requires valid questions");
  }
  get state(): QuizState {
    return this.current;
  }
  get question(): Question {
    return this.questions[this.current.index]!;
  }
  attempt(question = this.question): Attempt {
    return this.current.attempts[question.id] ?? unanswered;
  }
  subscribe(listener: (change: QuizChange) => void): () => void {
    return this.changes.subscribe(listener);
  }
  select(selected: number): void {
    if (
      !Number.isInteger(selected) ||
      !this.question.answers[selected] ||
      this.attempt().status === "graded"
    )
      return;
    this.updateAttempt("select", { status: "selected", selected });
  }
  check(): void {
    const attempt = this.attempt();
    if (attempt.status !== "selected") return;
    const evaluation = Object.freeze(
      this.strategy.evaluate(this.question, attempt.selected),
    );
    this.updateAttempt("check", {
      status: "graded",
      selected: attempt.selected,
      evaluation,
    });
  }
  reset(): void {
    this.updateAttempt("reset", unanswered);
  }
  go(index: number): void {
    if (
      !Number.isInteger(index) ||
      index < 0 ||
      index >= this.questions.length ||
      index === this.current.index
    )
      return;
    this.commit("navigate", {
      ...this.current,
      index,
      direction: index > this.current.index ? "next" : "previous",
    });
  }
  restart(): void {
    this.commit("restart", {
      index: 0,
      attempts: Object.freeze({}),
      direction: "next",
      phase: "answering",
    });
  }
  dispose(): void {
    this.disposed = true;
    this.changes.clear();
  }
  private updateAttempt(kind: ChangeKind, attempt: Attempt): void {
    this.commit(kind, {
      ...this.current,
      attempts: Object.freeze({
        ...this.current.attempts,
        [this.question.id]: Object.freeze(attempt),
      }),
    });
  }
  private commit(kind: ChangeKind, next: QuizState): void {
    if (this.disposed) return;
    const completed = this.questions.every(
      (q) => next.attempts[q.id]?.status === "graded",
    );
    const phase = completed
      ? "completed"
      : next.attempts[this.questions[next.index]!.id]?.status === "graded"
        ? "feedback"
        : "answering";
    this.current = Object.freeze({ ...next, phase });
    this.changes.emit({ kind, state: this.current });
  }
}
