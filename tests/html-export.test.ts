import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { parseQuestions } from "../src/parsers/QuizParser";
import {
  importedTableHtml,
  mergeQuestionsIntoQuizHtml,
} from "../src/importers/QuizHtmlExporter";

const sourceHTML = readFileSync("index.html", "utf8");

function importedSource(): HTMLElement {
  const container = document.createElement("div");
  container.innerHTML = `<table><thead><tr><th>Question</th><th>Instructions</th><th>Answers</th><th>Feedback</th></tr></thead>
    <tbody><tr><td><h2>Imported question?</h2></td><td><p>Choose one.</p></td>
    <td><p>Wrong</p><p>[CORRECT] Right</p></td><td><p>Explanation.</p></td></tr></tbody></table>`;
  return container;
}

describe("Word importer HTML export", () => {
  it("retains existing Brightspace quiz assets and replaces only the table body", () => {
    const output = mergeQuestionsIntoQuizHtml(sourceHTML, importedSource());
    const doc = new DOMParser().parseFromString(output, "text/html");
    const table = doc.querySelector("#quiz-authoring-source table");
    const parsed = parseQuestions(doc.querySelector("#quiz-authoring-source"));

    expect(output.startsWith("<!doctype html>")).toBe(true);
    expect(table?.querySelectorAll("tbody tr")).toHaveLength(1);
    expect(parsed.diagnostics).toEqual([]);
    expect(parsed.questions[0]?.plainPrompt).toBe("Imported question?");
    expect(doc.querySelector("#quiz-learner-root")).not.toBeNull();
    expect(doc.querySelector('script[src="./src/main.ts"]')).not.toBeNull();
    expect(doc.querySelector('a[href="./import-questions.html"]')).not.toBeNull();
    expect(output).not.toContain("Which action makes a link’s purpose easier to understand?");
  });

  it("keeps the source question-bank table editable in the generated HTML", () => {
    const output = importedTableHtml(importedSource());
    const doc = new DOMParser().parseFromString(output, "text/html");
    expect(doc.querySelector("table.quiz-question-table")).not.toBeNull();
    expect(doc.querySelector("caption")?.textContent).toBe("Question bank — one row per question");
    expect(parseQuestions(doc.body).diagnostics).toEqual([]);
  });

  it("rejects an unrelated HTML document rather than overwriting it", () => {
    expect(() =>
      mergeQuestionsIntoQuizHtml("<!doctype html><html><body></body></html>", importedSource()),
    ).toThrow("not a compatible quiz index.html");
  });

  it("never interprets question text as executable markup", () => {
    const source = importedSource();
    source.querySelector("h2")!.textContent = "<img src=x onerror=alert(1)>";
    const output = mergeQuestionsIntoQuizHtml(sourceHTML, source);
    const doc = new DOMParser().parseFromString(output, "text/html");
    const heading = doc.querySelector("#quiz-authoring-source tbody h2");
    expect(heading?.textContent).toBe("<img src=x onerror=alert(1)>");
    expect(doc.querySelector("#quiz-authoring-source img")).toBeNull();
  });
});
