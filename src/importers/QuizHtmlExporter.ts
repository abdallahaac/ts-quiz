/**
 * Keep the course's existing quiz HTML, assets, typography and editor markup.
 * Only replace the authored question rows after validation by DocxImporter.
 * Neither this function nor DOMParser executes scripts.
 */
export function mergeQuestionsIntoQuizHtml(
  html: string,
  importedSource: Element,
): string {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const target = doc.querySelector<HTMLTableElement>(
    "#quiz-authoring-source table.quiz-question-table",
  );
  const sourceRows = importedSource.querySelector("table tbody");

  if (!target || !target.tBodies[0] || !sourceRows) {
    throw new Error(
      "The selected HTML is not a compatible quiz index.html with a question table.",
    );
  }
  const replacement = doc.importNode(sourceRows, true);
  target.tBodies[0].replaceWith(replacement);

  // DOMParser serializes an HTML document without a doctype.
  // Retain the same document type used for the deployed quiz.
  return `<!doctype html>\n${doc.documentElement.outerHTML}\n`;
}

export function importedTableHtml(importedSource: Element): string {
  const table = importedSource.querySelector<HTMLTableElement>("table");
  if (!table) throw new Error("The imported Word table is missing.");
  const copy = table.cloneNode(true) as HTMLTableElement;
  copy.classList.add("quiz-question-table");
  const caption = copy.createCaption();
  caption.textContent = "Question bank — one row per question";
  return copy.outerHTML;
}
