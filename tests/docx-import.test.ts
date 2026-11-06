import { describe, expect, it, afterEach } from "vitest";
import { importDocx, wordTableToSource } from "../src/importers/DocxImporter";
import { parseQuestions } from "../src/parsers/QuizParser";
import { installDocxEditor } from "../src/views/DocxImportView";
import { mountFixture } from "./helpers";

const w = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
const paragraph = (text: string): string =>
  `<w:p><w:r><w:t>${text}</w:t></w:r></w:p>`;
const cell = (...entries: string[]): string =>
  `<w:tc>${entries.map(paragraph).join("")}</w:tc>`;
const row = (...cells: string[]): string =>
  `<w:tr>${cells.join("")}</w:tr>`;
const xml = (question = "Which HTML element is semantic?"): string =>
  `<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="${w}"><w:body><w:tbl>${row(
    cell("Question"),
    cell("Instructions"),
    cell("Answers"),
    cell("Feedback"),
  )}${row(
    cell(question),
    cell("Choose one."),
    cell("Wrong", "[CORRECT] Heading", "Also wrong"),
    cell("A heading has meaning."),
  )}</w:tbl></w:body></w:document>`;

function storedDocx(content: string): File {
  const encoder = new TextEncoder();
  const name = encoder.encode("word/document.xml");
  const data = encoder.encode(content);
  const local = new Uint8Array(30 + name.length + data.length);
  const l = new DataView(local.buffer);
  l.setUint32(0, 0x04034b50, true);
  l.setUint16(26, name.length, true);
  l.setUint32(18, data.length, true);
  l.setUint32(22, data.length, true);
  local.set(name, 30);
  local.set(data, 30 + name.length);
  const central = new Uint8Array(46 + name.length);
  const c = new DataView(central.buffer);
  c.setUint32(0, 0x02014b50, true);
  c.setUint16(28, name.length, true);
  c.setUint32(20, data.length, true);
  c.setUint32(24, data.length, true);
  central.set(name, 46);
  const end = new Uint8Array(22);
  const e = new DataView(end.buffer);
  e.setUint32(0, 0x06054b50, true);
  e.setUint16(8, 1, true);
  e.setUint16(10, 1, true);
  e.setUint32(12, central.length, true);
  e.setUint32(16, local.length, true);
  const bytes = new Uint8Array(local.length + central.length + end.length);
  bytes.set(local);
  bytes.set(central, local.length);
  bytes.set(end, local.length + central.length);
  const file = new File([bytes], "questions.docx", {
    type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });
  // jsdom's File may not provide arrayBuffer even though browsers do.
  Object.defineProperty(file, "arrayBuffer", {
    value: async () => bytes.buffer.slice(0),
  });
  return file;
}

describe("Word question-table import", () => {
  it("creates an editable HTML table accepted by the existing quiz parser", () => {
    const source = wordTableToSource(xml());
    const parsed = parseQuestions(source);
    expect(parsed.diagnostics).toEqual([]);
    expect(parsed.questions).toHaveLength(1);
    expect(parsed.questions[0]?.plainPrompt).toBe(
      "Which HTML element is semantic?",
    );
    expect(parsed.questions[0]?.answers[1]?.correct).toBe(true);
    expect(source.querySelectorAll("tbody tr td")).toHaveLength(4);
  });

  it("reads a locally uploaded DOCX without a server request", async () => {
    const file = storedDocx(xml());
    const parsed = await importDocx(file);
    expect(parsed.count).toBe(1);
    expect(parsed.diagnostics).toEqual([]);
  });

  it("rejects a Word table with missing columns", () => {
    const bad = `<w:document xmlns:w="${w}"><w:body><w:tbl>${row(
      cell("Question"), cell("Answers"), cell("Feedback")
    )}</w:tbl></w:body></w:document>`;
    expect(() => wordTableToSource(bad)).toThrow("Expected exactly one Word table");
  });

  it("preserves safety by treating Word content as text, not HTML", () => {
    const source = wordTableToSource(xml("&lt;script&gt;bad()&lt;/script&gt;"));
    expect(source.querySelector("script")).toBeNull();
    expect(source.querySelector("h2")?.textContent).toBe("<script>bad()</script>");
  });

  it("does not enable importing when the existing parser rejects the content", async () => {
    const parsed = await importDocx(storedDocx(xml("")));
    expect(parsed.diagnostics.length).toBeGreaterThan(0);
  });
});

describe("editor-only upload controls", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    document.body.removeAttribute("contenteditable");
    document.documentElement.removeAttribute("contenteditable");
  });
  it("appears only in editor mode and cleans up on exit", async () => {
    mountFixture();
    const dispose = installDocxEditor();
    expect(document.querySelector(".quiz-docx-import-tools")).toBeNull();
    document.body.setAttribute("contenteditable", "true");
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(document.querySelector('input[type="file"][accept*=".docx"]')).not.toBeNull();
    document.body.removeAttribute("contenteditable");
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(document.querySelector(".quiz-docx-import-tools")).toBeNull();
    dispose();
  });
});
