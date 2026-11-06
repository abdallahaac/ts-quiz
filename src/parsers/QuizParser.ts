import type { Question, ParseResult, UnusedQuestion } from "../domain/models";
import {
  normalizeText,
  richHTML,
  cleanClone,
  answerFromListItem,
  between,
} from "./richContent";
interface QuestionFields {
  prompt: Element | undefined;
  instructions: Element;
  list: Element;
  feedback: Element;
}
import { validateQuestion } from "./QuizValidator";
export const optionalTemplate = {
  prompt: "NEW QUESTION — replace this heading to activate",
  instructions: "<p>Choose one answer, then select Check.</p>",
  answers:
    "<li>Replace with answer A.</li><li><strong>[CORRECT]</strong> Replace with answer B.</li><li>Replace with answer C.</li><li>Replace with answer D.</li>",
  feedback: "<p>Replace with feedback for the learner.</p>",
};
const compact = (html: string) => html.replace(/>\s+</g, "><").trim();
function parseQuestion(
  fragment: Element,
  index: number,
  optional: boolean,
  fields: QuestionFields | null = null,
): Question | UnusedQuestion {
  const issues: string[] = [];
  const prompt = fields
    ? fields.prompt
    : fragment.querySelector("h2, [data-quiz-prompt], .quiz-prompt");
  const labels = [...fragment.querySelectorAll("h3")];
  let instructions: Element | null | undefined,
    list: Element | null | undefined,
    feedback: Element | null | undefined;
  if (fields) {
    ({ instructions, list, feedback } = fields);
  } else if (labels.length) {
    const expected = ["instructions", "answers", "feedback"];
    if (
      labels.length !== 3 ||
      labels.some(
        (label, i) =>
          normalizeText(label.textContent).toLowerCase() !== expected[i],
      )
    ) {
      issues.push(
        "Keep the three Heading 3 field labels in order: Instructions, Answers, Feedback.",
      );
    } else {
      instructions = between(fragment, labels[0], labels[1]);
      const answerField = between(fragment, labels[1], labels[2]);
      const lists = [...answerField.querySelectorAll("ul, ol")].filter(
        (el) => !el.parentElement?.closest("ul, ol"),
      );
      list = lists[0];
      const rest = answerField.cloneNode(true) as Element;
      rest.querySelectorAll("ul, ol").forEach((el) => el.remove());
      if (lists.length !== 1 || normalizeText(rest.textContent))
        issues.push(
          "Answers must contain one bulleted or numbered list; keep every choice in that list.",
        );
      feedback = between(fragment, labels[2], null);
      if (normalizeText(between(fragment, prompt, labels[0]).textContent))
        issues.push(
          "Move text below the question heading into the Instructions field.",
        );
    }
  } else {
    instructions = fragment.querySelector("[data-quiz-instructions]");
    list = fragment.querySelector("[data-quiz-answers]");
    feedback = fragment.querySelector("[data-quiz-feedback]");
    for (const field of ["instructions", "answers", "feedback"]) {
      if (fragment.querySelectorAll(`[data-quiz-${field}]`).length > 1)
        issues.push(
          `More than one ${field} field was found. Restore the next question's Heading 2.`,
        );
    }
    if (!list || !feedback)
      issues.push(
        "Question fields are missing. Copy a complete question, including its field labels and answer list.",
      );
  }
  const promptHTML = richHTML(prompt);
  const plainPrompt = normalizeText(prompt && cleanClone(prompt).textContent);
  const instructionHTML = richHTML(instructions);
  const feedbackHTML = richHTML(feedback);
  const answers = [...(list?.children || [])]
    .filter((el) => el.tagName === "LI")
    .map(answerFromListItem);
  const untouched =
    optional &&
    labels.length === 0 &&
    plainPrompt === optionalTemplate.prompt &&
    compact(instructionHTML) === optionalTemplate.instructions &&
    compact(richHTML(list)) === optionalTemplate.answers &&
    compact(feedbackHTML) === optionalTemplate.feedback;
  if (untouched) return { index, unused: true };
  issues.push(
    ...validateQuestion({
      plainPrompt,
      hasHeading: !!prompt?.matches("h2"),
      feedbackText: feedback ? (cleanClone(feedback).textContent ?? "") : "",
      rawFeedbackText: feedback?.textContent ?? "",
      answers,
      nestedAnswers: !!list?.querySelector("li ul, li ol"),
    }),
  );
  return {
    type: "multiple-choice",
    id: `quiz-q${index}`,
    index,
    prompt: promptHTML,
    plainPrompt,
    instructions: instructionHTML,
    answers,
    feedback: feedbackHTML,
    issues,
    valid: issues.length === 0,
  };
}
function tableAnswerList(
  cell: HTMLTableCellElement,
  issues: string[],
): HTMLUListElement {
  const doc = cell.ownerDocument;
  const list = doc.createElement("ul");
  list.setAttribute("data-quiz-answers", "");
  const lists = [...cell.querySelectorAll("ul, ol")].filter(
    (node) => !node.parentElement?.closest("ul, ol"),
  );
  if (lists.length) {
    const rest = cell.cloneNode(true) as Element;
    rest.querySelectorAll("ul, ol").forEach((node) => node.remove());
    if (lists.length !== 1 || normalizeText(rest.textContent))
      issues.push(
        "In Answers, use one paragraph per answer OR one list; do not mix a list with separate answer paragraphs.",
      );
    for (const item of lists[0]!.children)
      if (item.tagName === "LI") list.append(item.cloneNode(true));
    return list;
  }
  const visit = (container: Element): void => {
    let inline = doc.createElement("li");
    const flush = () => {
      if (
        normalizeText(inline.textContent) ||
        inline.querySelector("img, svg, math, iframe, object, input")
      )
        list.append(inline);
      inline = doc.createElement("li");
    };
    for (const node of container.childNodes) {
      const element = node.nodeType === 1 ? (node as Element) : null;
      if (element && ["P", "DIV"].includes(element.tagName)) {
        flush();
        if (element.querySelector("p, div")) visit(element);
        else {
          const item = doc.createElement("li");
          item.innerHTML = element.innerHTML;
          list.append(item);
        }
      } else inline.append(node.cloneNode(true));
    }
    flush();
  };
  visit(cell);
  return list;
}
function parseQuestionTable(
  source: Element,
  tables: HTMLTableElement[],
): ParseResult {
  const diagnostics: string[] = [];
  const questions: Question[] = [];
  let unused = 0;
  if (tables.length !== 1)
    return {
      questions,
      unused,
      diagnostics: [
        "Keep one question table. Add questions with Insert row below instead of adding or splitting tables.",
      ],
    };
  const table = tables[0]!;
  const outside = source.cloneNode(true) as Element;
  outside.querySelectorAll("table").forEach((node) => node.remove());
  if (normalizeText(outside.textContent))
    diagnostics.push(
      "Question content appears outside the table. Move it into a question row or remove it.",
    );
  const rows = [...table.rows].filter((row) => row.closest("table") === table);
  const labels = ["question", "instructions", "answers", "feedback"];
  const header = rows.shift();
  if (
    !header ||
    header.cells.length !== 4 ||
    [...header.cells].some(
      (cell, i) =>
        normalizeText(cell.textContent).toLowerCase() !== labels[i] ||
        cell.colSpan !== 1 ||
        cell.rowSpan !== 1,
    )
  )
    diagnostics.push(
      "Restore the four table column headings in this order: Question, Instructions, Answers, Feedback. Do not add, delete, or merge columns.",
    );
  for (const [index, row] of rows.entries()) {
    const position = index + 1;
    const cells = [...row.cells];
    if (
      cells.length !== 4 ||
      cells.some((cell) => cell.colSpan !== 1 || cell.rowSpan !== 1)
    ) {
      diagnostics.push(
        `Question row ${position}: Keep four separate cells. Undo merged, split, or deleted cells.`,
      );
      continue;
    }
    if (row.querySelector("table")) {
      diagnostics.push(
        `Question row ${position}: Nested tables are not supported. Keep the question in the four existing cells.`,
      );
      continue;
    }
    if (
      !normalizeText(row.textContent) &&
      !row.querySelector(
        "img, svg, math, iframe, object, embed, script, input, a[href]",
      )
    ) {
      unused++;
      continue;
    }
    const [promptCell, instructions, answers, feedback] = cells as [
      HTMLTableCellElement,
      HTMLTableCellElement,
      HTMLTableCellElement,
      HTMLTableCellElement,
    ];
    const issues: string[] = [];
    const headings = promptCell.querySelectorAll("h2");
    const rest = promptCell.cloneNode(true) as Element;
    rest.querySelectorAll("h2").forEach((node) => node.remove());
    if (headings.length !== 1 || normalizeText(rest.textContent))
      issues.push(
        "In Question, use one Heading 2 for the question text. Put any instructions in the Instructions column.",
      );
    const q = parseQuestion(row, position, false, {
      prompt: headings[0],
      instructions,
      list: tableAnswerList(answers, issues),
      feedback,
    });
    if ("unused" in q) continue;
    q.issues = q.issues.map((issue) =>
      issue
        .replace("that list item", "that paragraph or list item")
        .replace("across the answer list", "in Answers"),
    );
    q.issues.push(...issues);
    q.valid = q.issues.length === 0;
    questions.push(q);
    for (const issue of q.issues)
      diagnostics.push(
        `Question row ${position}${q.plainPrompt ? ` (${q.plainPrompt})` : ""}: ${issue}`,
      );
  }
  if (!questions.length)
    diagnostics.push(
      "No active questions found. Fill in a question row, or use Insert row below to add one.",
    );
  return { questions, diagnostics, unused };
}
export function parseQuestions(source: Element | null): ParseResult {
  if (!source)
    return {
      questions: [],
      diagnostics: [
        "The editable question source is missing. Restore the quiz topic file.",
      ],
      unused: 0,
    };
  const tables = [...source.querySelectorAll("table")].filter(
    (table) => !table.parentElement?.closest("table"),
  );
  if (tables.length) return parseQuestionTable(source, tables);
  const prompts = [
    ...source.querySelectorAll("h2, [data-quiz-prompt], .quiz-prompt"),
  ];
  const diagnostics: string[] = [];
  const questions: Question[] = [];
  let unused = 0;
  if (normalizeText(between(source, null, prompts[0]).textContent))
    diagnostics.push(
      "Content appears before the first question heading. Restore its Heading 2 or remove the leftover question content.",
    );
  for (const [index, prompt] of prompts.entries()) {
    const fragment = between(source, prompt, prompts[index + 1], true);
    const optional =
      prompt.hasAttribute("data-quiz-optional") ||
      !!prompt.closest("[data-quiz-optional]");
    const q = parseQuestion(fragment, index + 1, optional);
    if ("unused" in q) {
      unused++;
      continue;
    }
    questions.push(q);
    for (const issue of q.issues)
      diagnostics.push(
        `Question ${q.index}${q.plainPrompt ? ` (${q.plainPrompt})` : ""}: ${issue}`,
      );
  }
  for (const wrapper of source.querySelectorAll(
    "[data-quiz-question], .quiz-edit-question",
  )) {
    if (
      !wrapper.querySelector("h2, [data-quiz-prompt], .quiz-prompt") &&
      normalizeText(wrapper.textContent)
    )
      diagnostics.push(
        "A question block has no question heading. Restore its Heading 2 or delete the whole block.",
      );
  }
  if (!questions.length)
    diagnostics.push(
      "No active questions found. Add at least one complete question.",
    );
  return { questions, diagnostics, unused };
}
