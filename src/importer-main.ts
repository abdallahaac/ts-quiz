import { importDocx, type DocxImportResult } from "./importers/DocxImporter";
import { importedTableHtml, mergeQuestionsIntoQuizHtml } from "./importers/QuizHtmlExporter";
import { parseQuestions } from "./parsers/QuizParser";

const byId = <T extends HTMLElement>(id: string): T => {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing importer control: ${id}`);
  return element as T;
};

function main(): void {
  const wordFile = byId<HTMLInputElement>("word-file");
  const quizFile = byId<HTMLInputElement>("quiz-file");
  const status = byId<HTMLElement>("import-status");
  const alert = byId<HTMLElement>("import-error");
  const preview = byId<HTMLElement>("question-preview");
  const previewList = byId<HTMLOListElement>("question-preview-list");
  const copy = byId<HTMLButtonElement>("copy-table");
  const download = byId<HTMLButtonElement>("download-quiz");
  let imported: DocxImportResult | undefined;
  let attempt = 0;

  const fail = (message: string): void => {
    alert.textContent = message;
    alert.hidden = false;
  };
  const clearError = (): void => {
    alert.textContent = "";
    alert.hidden = true;
  };

  wordFile.addEventListener("change", async () => {
    const current = ++attempt;
    imported = undefined;
    copy.disabled = true;
    download.disabled = true;
    preview.hidden = true;
    previewList.replaceChildren();
    clearError();
    const file = wordFile.files?.[0];
    if (!file) {
      status.textContent = "Choose a Word document to begin.";
      return;
    }

    status.textContent = `Reading ${file.name}…`;
    try {
      const result = await importDocx(file);
      if (current !== attempt) return;
      if (result.diagnostics.length) {
        fail(
          "The Word table needs corrections before importing: " +
            result.diagnostics.join(" "),
        );
        status.textContent = "Import blocked; no quiz content was changed.";
        return;
      }

      imported = result;
      const questions = parseQuestions(result.source).questions;
      for (const question of questions) {
        const item = document.createElement("li");
        item.textContent = `${question.plainPrompt} (${question.answers.length} answers)`;
        previewList.append(item);
      }
      preview.hidden = false;
      copy.disabled = false;
      download.disabled = false;
      status.textContent =
        `Validated ${result.count} question(s). Copy the table or download an updated quiz HTML file.`;
    } catch (error) {
      if (current !== attempt) return;
      fail(error instanceof Error ? error.message : "The DOCX file could not be read.");
      status.textContent = "Import failed; no quiz content was changed.";
    }
  });

  copy.addEventListener("click", async () => {
    if (!imported) return;
    clearError();
    try {
      if (!navigator.clipboard?.writeText) {
        throw new Error(
          "Clipboard access is unavailable. Use Download updated quiz HTML instead.",
        );
      }
      await navigator.clipboard.writeText(importedTableHtml(imported.source));
      status.textContent =
        "HTML table copied. In Brightspace Code View, replace the existing question table with this HTML, then save.";
    } catch (error) {
      fail(error instanceof Error ? error.message : "Could not copy HTML.");
    }
  });

  download.addEventListener("click", async () => {
    if (!imported) return;
    clearError();
    download.disabled = true;
    status.textContent = "Preparing updated quiz HTML…";
    try {
      let baseHtml: string;
      const supplied = quizFile.files?.[0];
      if (supplied) {
        baseHtml = await supplied.text();
      } else {
        // This importer is deployed beside index.html in Brightspace Manage Files.
        // An authenticated same-origin request keeps the latest course HTML.
        const response = await fetch("./index.html", { credentials: "same-origin" });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        baseHtml = await response.text();
      }
      const output = mergeQuestionsIntoQuizHtml(baseHtml, imported.source);
      const blob = new Blob([output], { type: "text/html;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "index.html";
      anchor.hidden = true;
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      status.textContent =
        "Downloaded index.html. Replace the existing quiz HTML in Brightspace Manage Files (after backing it up); the importer cannot save into the course automatically.";
    } catch (error) {
      fail(
        "Could not prepare the quiz HTML. Select the current index.html in the optional field, then retry. " +
          (error instanceof Error ? error.message : ""),
      );
      status.textContent = "No quiz HTML was changed.";
    } finally {
      download.disabled = false;
    }
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", main, { once: true });
} else {
  main();
}
