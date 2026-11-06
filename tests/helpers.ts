import { readFileSync } from "node:fs";
import { parseQuestions } from "../src/parsers/QuizParser";
import type { ParseResult } from "../src/domain/models";
export const originalHTML = readFileSync(
  "tests/fixtures/original.html",
  "utf8",
);
const parserCode = originalHTML.slice(
  originalHTML.indexOf("// src/native-quiz/parser.js"),
  originalHTML.indexOf("// src/native-quiz/carousel.js"),
);
// Executes only the supplied parser, without starting its application or loading assets.
export const originalParse = new Function(
  `${parserCode}; return parseQuestions;`,
)() as (source: Element | null) => ParseResult;
export function originalSource(): HTMLElement {
  const wrapper = document.createElement("div");
  wrapper.innerHTML = originalHTML;
  return wrapper.querySelector<HTMLElement>("#quiz-authoring-source")!;
}
export function tableSource(
  rows: string,
  header = "<th>Question</th><th>Instructions</th><th>Answers</th><th>Feedback</th>",
): HTMLElement {
  const source = document.createElement("div");
  source.innerHTML = `<table><thead><tr>${header}</tr></thead><tbody>${rows}</tbody></table>`;
  return source;
}
export function questionRow(
  answers = "<p>Wrong</p><p><strong>[CORRECT]</strong> Right</p>",
  prompt = "<h2>Question?</h2>",
  feedback = "<p>Explanation.</p>",
): string {
  return `<tr><td>${prompt}</td><td></td><td>${answers}</td><td>${feedback}</td></tr>`;
}
export function questions() {
  return parseQuestions(originalSource()).questions;
}
export function mountFixture(): HTMLElement {
  document.body.innerHTML = originalHTML
    .match(/<body>([\s\S]*?)<\/body>/)![1]!
    .replace(/<script>[\s\S]*?<\/script>/g, "");
  return document.getElementById("quiz-learner-root")!;
}
