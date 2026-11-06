import { expect, it, vi } from "vitest";
import { QuizSession } from "../src/application/QuizSession";
import { MultipleChoiceStrategy } from "../src/strategies/MultipleChoiceStrategy";
import { QuizEventEmitter } from "../src/events/QuizEventEmitter";
import { questions } from "./helpers";

it("grades both outcomes, locks checked answers, and resets only the current question", () => {
  const session = new QuizSession(questions(), new MultipleChoiceStrategy());
  expect(session.state.phase).toBe("answering");
  session.check();
  expect(session.attempt().status).toBe("unanswered");
  session.select(0);
  session.check();
  expect(session.attempt()).toMatchObject({
    status: "graded",
    selected: 0,
    evaluation: { correct: false, correctIndex: 1 },
  });
  session.select(1);
  expect(session.attempt()).toMatchObject({ selected: 0 });
  expect(session.state.phase).toBe("feedback");
  session.go(1);
  session.select(1);
  session.check();
  expect(session.state.phase).toBe("completed");
  session.reset();
  expect(session.state.phase).toBe("answering");
  expect(session.attempt().status).toBe("unanswered");
  session.go(0);
  expect(session.attempt().status).toBe("graded");
  session.restart();
  expect(session.state.index).toBe(0);
  expect(session.state.attempts).toEqual({});
});
it("enforces navigation boundaries, direction, and invalid answer guards", () => {
  const session = new QuizSession(questions(), new MultipleChoiceStrategy()),
    changed = vi.fn();
  session.subscribe(changed);
  for (const i of [-1, 2, NaN, 0.5, Infinity, 0]) session.go(i);
  for (const i of [-1, 100, NaN, 0.5]) session.select(i);
  expect(changed).not.toHaveBeenCalled();
  session.go(1);
  expect(session.state.direction).toBe("next");
  session.go(0);
  expect(session.state.direction).toBe("previous");
});
it("injects grading and emits immutable typed state snapshots", () => {
  const evaluate = vi.fn(() => ({ correct: true, correctIndex: 0 }));
  const session = new QuizSession(questions(), { evaluate });
  const listener = vi.fn();
  const unsubscribe = session.subscribe(listener);
  session.select(0);
  const snapshot = session.state;
  session.check();
  expect(evaluate).toHaveBeenCalledWith(session.question, 0);
  expect(snapshot.attempts[session.question.id]?.status).toBe("selected");
  expect(Object.isFrozen(session.state)).toBe(true);
  expect(listener).toHaveBeenCalledTimes(2);
  unsubscribe();
  session.reset();
  expect(listener).toHaveBeenCalledTimes(2);
  session.dispose();
  session.select(0);
  expect(session.attempt().status).toBe("unanswered");
});
it("rejects an unusable question bank and invalid direct grading requests", () => {
  expect(() => new QuizSession([], new MultipleChoiceStrategy())).toThrow();
  expect(() =>
    new MultipleChoiceStrategy().evaluate(questions()[0]!, -1),
  ).toThrow(RangeError);
});
it("allows observers to unsubscribe during dispatch", () => {
  const emitter = new QuizEventEmitter<string>(),
    listener = vi.fn();
  const stop = emitter.subscribe(() => stop());
  emitter.subscribe(listener);
  emitter.emit("one");
  emitter.emit("two");
  expect(listener.mock.calls).toEqual([["one"], ["two"]]);
  emitter.clear();
  emitter.emit("three");
  expect(listener).toHaveBeenCalledTimes(2);
});
