import { describe, expect, it } from "vitest";
import { parseQuestions, optionalTemplate } from "../src/parsers/QuizParser";
import { answerFromListItem } from "../src/parsers/richContent";
import {
  originalParse,
  originalSource,
  questionRow,
  tableSource,
} from "./helpers";

const cases: [string, () => Element | null][] = [
  ["supplied questions and unused row", originalSource],
  ["missing source", () => null],
  ["paragraph choices", () => tableSource(questionRow())],
  [
    "list choices",
    () =>
      tableSource(
        questionRow("<ol><li>Wrong</li><li>[CORRECT] Right</li></ol>"),
      ),
  ],
  [
    "inline choices",
    () => tableSource(questionRow("Wrong<div>[CORRECT] Right</div>")),
  ],
  [
    "nested paragraph wrappers",
    () =>
      tableSource(
        questionRow("<div><p>Wrong</p><div>[CORRECT] Right</div></div>"),
      ),
  ],
  [
    "entirely empty row",
    () =>
      tableSource(
        "<tr><td><h2>\u200b</h2></td><td><br></td><td></td><td></td></tr>",
      ),
  ],
  [
    "incomplete row",
    () => tableSource(questionRow("", "<h2>Started</h2>", "")),
  ],
  [
    "missing marker",
    () => tableSource(questionRow("<p>Wrong</p><p>Right</p>")),
  ],
  [
    "duplicate markers",
    () =>
      tableSource(questionRow("<p>[CORRECT] Wrong</p><p>[CORRECT] Right</p>")),
  ],
  [
    "split formatted marker",
    () =>
      tableSource(
        questionRow("<p>Wrong</p><p>[<b>CO</b>R\u200bRECT] Right</p>"),
      ),
  ],
  [
    "empty answer",
    () => tableSource(questionRow("<p></p><p>[CORRECT] Right</p>")),
  ],
  [
    "placeholder answer",
    () =>
      tableSource(
        questionRow("<p>Replace with answer A.</p><p>[CORRECT] Right</p>"),
      ),
  ],
  [
    "nested choices",
    () =>
      tableSource(
        questionRow(
          "<ul><li>Wrong<ul><li>Nested</li></ul></li><li>[CORRECT] Right</li></ul>",
        ),
      ),
  ],
  [
    "mixed list and paragraphs",
    () =>
      tableSource(questionRow("<p>Wrong</p><ul><li>[CORRECT] Right</li></ul>")),
  ],
  [
    "two lists",
    () =>
      tableSource(
        questionRow("<ul><li>Wrong</li></ul><ul><li>[CORRECT] Right</li></ul>"),
      ),
  ],
  [
    "missing heading",
    () => tableSource(questionRow(undefined, "<p>Question?</p>")),
  ],
  [
    "two headings",
    () => tableSource(questionRow(undefined, "<h2>One</h2><h2>Two</h2>")),
  ],
  [
    "missing feedback",
    () => tableSource(questionRow(undefined, undefined, "")),
  ],
  [
    "invalid header",
    () =>
      tableSource(
        questionRow(),
        "<th>Answers</th><th>Question</th><th>Feedback</th><th>Instructions</th>",
      ),
  ],
  [
    "merged cells",
    () =>
      tableSource(
        '<tr><td colspan="2">Question</td><td>Answers</td><td>Feedback</td></tr>',
      ),
  ],
  [
    "nested table",
    () => tableSource(questionRow("<table><tr><td>Nested</td></tr></table>")),
  ],
  [
    "content outside table",
    () => {
      const source = tableSource(questionRow());
      source.append("Leftover");
      return source;
    },
  ],
  [
    "multiple tables",
    () => {
      const source = tableSource(questionRow());
      source.append(source.firstChild!.cloneNode(true));
      return source;
    },
  ],
];
describe("original parser parity", () => {
  it.each(cases)("%s", (_name, source) => {
    const input = source();
    const expected = originalParse(input);
    const result = parseQuestions(input);
    expect(result).toEqual({
      ...expected,
      questions: expected.questions.map((q) => ({
        ...q,
        type: "multiple-choice",
      })),
    });
  });
});
it("preserves authored source and exposes valid models", () => {
  const source = originalSource(),
    before = source.innerHTML;
  const parsed = parseQuestions(source);
  expect(parsed.diagnostics).toEqual([]);
  expect(parsed.unused).toBe(1);
  expect(parsed.questions).toHaveLength(2);
  expect(parsed.questions[0]!.answers[1]!.correct).toBe(true);
  expect(source.innerHTML).toBe(before);
});
it("removes executable content while preserving safe rich text and relative links", () => {
  const li = document.createElement("li");
  li.innerHTML =
    '[CORRECT] <em lang="fr" onclick="bad()">Safe</em><script>bad()</script><a href="java\nscript:bad()" target="_blank">bad link</a><a href="../guide.html">guide</a><img src="x" onerror="bad()">';
  const result = answerFromListItem(li);
  expect(result.html).not.toMatch(/script|onclick|onerror|<img|\[CORRECT\]/i);
  expect(result.html).toContain('href="../guide.html"');
  expect(result.html).toContain('rel="noopener noreferrer"');
});
it.each(["labels", "data", "optional"])(
  "preserves legacy %s authoring",
  (format) => {
    const source = document.createElement("div");
    if (format === "labels")
      source.innerHTML =
        "<h2>Question?</h2><h3>Instructions</h3><p>Select one.</p><h3>Answers</h3><ul><li>Wrong</li><li>[CORRECT] Right</li></ul><h3>Feedback</h3><p>Explanation.</p>";
    else if (format === "data")
      source.innerHTML =
        "<section data-quiz-question><h2>Question?</h2><div data-quiz-instructions></div><ul data-quiz-answers><li>Wrong</li><li>[CORRECT] Right</li></ul><div data-quiz-feedback>Explanation.</div></section>";
    else
      source.innerHTML = `<section data-quiz-optional><h2>${optionalTemplate.prompt}</h2><div data-quiz-instructions>${optionalTemplate.instructions}</div><ul data-quiz-answers>${optionalTemplate.answers}</ul><div data-quiz-feedback>${optionalTemplate.feedback}</div></section>`;
    const expected = originalParse(source);
    expect(parseQuestions(source)).toEqual({
      ...expected,
      questions: expected.questions.map((q) => ({
        ...q,
        type: "multiple-choice",
      })),
    });
  },
);

it("parses detached authoring documents without a browser window", () => {
  const doc = new DOMParser().parseFromString(
    tableSource(questionRow()).outerHTML,
    "text/html",
  );
  expect(doc.defaultView).toBeNull();
  const expected = originalParse(doc.body);
  expect(parseQuestions(doc.body)).toEqual({
    ...expected,
    questions: expected.questions.map((q) => ({
      ...q,
      type: "multiple-choice",
    })),
  });
});
