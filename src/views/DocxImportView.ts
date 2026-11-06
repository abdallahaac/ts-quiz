import { inEditor } from "../application/initialize";
import { importDocx, type DocxImportResult } from "../importers/DocxImporter";

const editors = new WeakMap<Document, () => void>();

/**
 * A progressive enhancement for environments that execute quiz JavaScript in
 * editor mode. Brightspace's native Design View may suppress scripts entirely.
 * Authoring content remains the underlying, editable HTML table.
 */
export function installDocxEditor(doc: Document = document): () => void {
  const existing = editors.get(doc);
  if (existing) return existing;

  let panel: HTMLElement | undefined;
  let disposed = false;

  const mount = (): void => {
    const source = doc.querySelector<HTMLElement>(
      "#quiz-authoring-source, [data-quiz-source], .quiz-authoring-source",
    );
    if (!source || !source.querySelector("table")) return;

    const section = doc.createElement("section");
    section.className = "quiz-docx-import-tools";
    section.setAttribute("contenteditable", "false");
    section.setAttribute("aria-label", "Import questions from Word");
    const heading = doc.createElement("h2");
    heading.textContent = "Import questions from Word";
    const explanation = doc.createElement("p");
    explanation.textContent =
      "Choose a .docx file with a four-column table: Question, Instructions, Answers, Feedback. The imported questions will be checked before replacing your existing question rows.";
    const inputLabel = doc.createElement("label");
    const inputLabelText = doc.createElement("span");
    inputLabelText.textContent = "Word document (.docx)";
    const input = doc.createElement("input");
    input.type = "file";
    input.accept =
      ".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    inputLabel.append(inputLabelText, input);
    const status = doc.createElement("p");
    status.className = "quiz-docx-import-status";
    status.setAttribute("role", "status");
    status.setAttribute("aria-live", "polite");
    status.textContent = "No document selected.";
    const apply = doc.createElement("button");
    apply.type = "button";
    apply.className = "quiz-button";
    apply.textContent = "Replace question rows";
    apply.disabled = true;
    const copy = doc.createElement("button");
    copy.type = "button";
    copy.className = "quiz-button";
    copy.textContent = "Copy table HTML";
    copy.disabled = true;
    const actions = doc.createElement("div");
    actions.className = "quiz-docx-import-actions";
    actions.append(apply, copy);
    section.append(heading, explanation, inputLabel, status, actions);
    source.before(section);
    panel = section;
    let pending: DocxImportResult | undefined;
    let sequence = 0;

    input.addEventListener("change", async () => {
      const token = ++sequence;
      pending = undefined;
      apply.disabled = true;
      copy.disabled = true;
      const file = input.files?.[0];
      if (!file) {
        status.textContent = "No document selected.";
        return;
      }
      status.textContent = `Reading ${file.name}…`;
      try {
        const parsed = await importDocx(file, doc);
        if (disposed || token !== sequence || !section.isConnected) return;
        if (parsed.diagnostics.length) {
          status.textContent = `Import blocked. ${parsed.diagnostics.join(" ")}`;
          return;
        }
        pending = parsed;
        apply.disabled = false;
        status.textContent = `Validated ${parsed.count} question(s) from ${file.name}. Select "Replace question rows" to apply them.`;
      } catch (error) {
        if (disposed || token !== sequence || !section.isConnected) return;
        status.textContent =
          error instanceof Error ? error.message : "Unable to read this Word document.";
      }
    });

    apply.addEventListener("click", () => {
      if (!pending) return;
      const current = source.querySelector("table");
      const next = pending.source.querySelector("table");
      const replacement = next?.tBodies[0];
      if (!(current instanceof HTMLTableElement) || !replacement) {
        status.textContent = "The editable question table could not be found.";
        return;
      }
      const tbody = current.tBodies[0];
      if (!tbody) {
        status.textContent = "The editable question table has no question rows section.";
        return;
      }
      const count = pending.count;
      tbody.replaceWith(doc.importNode(replacement, true));
      pending = undefined;
      apply.disabled = true;
      copy.disabled = false;
      status.textContent =
        `Imported ${count} question(s) into the editable table. These changes exist only in this page until saved through an authoring workflow; they are not automatically written to the source file or Brightspace.`;
    });

    copy.addEventListener("click", async () => {
      const table = source.querySelector("table");
      if (!table) return;
      try {
        await doc.defaultView?.navigator.clipboard.writeText(table.outerHTML);
        status.textContent =
          "Question table HTML copied. Paste it into the quiz source HTML to persist locally.";
      } catch {
        status.textContent =
          "Clipboard access was blocked. Copy the table HTML from your browser developer tools instead.";
      }
    });
  };

  const refresh = (): void => {
    if (disposed) return;
    if (inEditor(doc)) {
      if (!panel) mount();
    } else {
      panel?.remove();
      panel = undefined;
    }
  };
  const observer = new MutationObserver(refresh);
  observer.observe(doc.documentElement, {
    attributes: true,
    attributeFilter: ["contenteditable", "class"],
  });
  if (doc.body) {
    observer.observe(doc.body, {
      attributes: true,
      attributeFilter: ["contenteditable", "class"],
    });
  }
  refresh();
  const cleanup = (): void => {
    if (disposed) return;
    disposed = true;
    observer.disconnect();
    panel?.remove();
    panel = undefined;
    editors.delete(doc);
  };
  editors.set(doc, cleanup);
  return cleanup;
}
