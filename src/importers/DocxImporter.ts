import { parseQuestions } from "../parsers/QuizParser";

const WORD_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
const HEADINGS = ["Question", "Instructions", "Answers", "Feedback"] as const;
const MAX_DOCX_BYTES = 20 * 1024 * 1024;
const MAX_XML_BYTES = 8 * 1024 * 1024;

const direct = (element: Element, name: string): Element[] =>
  Array.from(element.children).filter(
    (child) => child.namespaceURI === WORD_NS && child.localName === name,
  );

const wordText = (element: Element): string =>
  Array.from(element.getElementsByTagName("*"))
    .filter((child) => child.namespaceURI === WORD_NS)
    .map((child) => {
      switch (child.localName) {
        case "t":
          return child.textContent ?? "";
        case "tab":
          return " ";
        case "br":
        case "cr":
          return "\n";
        default:
          return "";
      }
    })
    .join("");

function paragraphs(cell: Element): string[] {
  // Each Word paragraph represents one choice in an Answers cell.
  if (cell.getElementsByTagNameNS(WORD_NS, "tbl").length)
    throw new Error("Nested tables in DOCX question cells are not supported.");
  if (
    cell.getElementsByTagNameNS(WORD_NS, "drawing").length ||
    cell.getElementsByTagNameNS(WORD_NS, "pict").length
  )
    throw new Error("Embedded images in DOCX question cells are not supported.");
  return Array.from(cell.getElementsByTagNameNS(WORD_NS, "p"))
    .map((paragraph) => wordText(paragraph).trim())
    .filter(Boolean);
}

function rowCells(row: Element): Element[] {
  const cells = direct(row, "tc");
  if (
    cells.length !== 4 ||
    cells.some(
      (cell) =>
        cell.getElementsByTagNameNS(WORD_NS, "gridSpan").length ||
        cell.getElementsByTagNameNS(WORD_NS, "vMerge").length,
    )
  )
    throw new Error(
      "Each DOCX question row must contain four separate, unmerged cells.",
    );
  return cells;
}

/** Convert an OOXML Word question table to the quiz's existing authoring format. */
export function wordTableToSource(xml: string, doc: Document = document): HTMLElement {
  const parsed = new DOMParser().parseFromString(xml, "application/xml");
  if (parsed.querySelector("parsererror"))
    throw new Error("The Word document contains invalid XML.");
  const body = parsed.getElementsByTagNameNS(WORD_NS, "body")[0];
  if (!body) throw new Error("The Word document has no document body.");
  const matching = direct(body, "tbl").filter((table) => {
    const firstRow = direct(table, "tr")[0];
    const cells = firstRow ? direct(firstRow, "tc") : [];
    return (
      cells.length === 4 &&
      cells.every(
        (cell, index) =>
          wordText(cell).trim().toLowerCase() === HEADINGS[index]!.toLowerCase(),
      )
    );
  });
  if (matching.length !== 1)
    throw new Error(
      "Expected exactly one Word table with these columns: Question, Instructions, Answers, Feedback.",
    );
  const rows = direct(matching[0]!, "tr").slice(1);
  const wrapper = doc.createElement("div");
  const table = doc.createElement("table");
  const head = doc.createElement("thead");
  const headerRow = doc.createElement("tr");
  for (const label of HEADINGS) {
    const th = doc.createElement("th");
    th.textContent = label;
    headerRow.append(th);
  }
  head.append(headerRow);
  const tbody = doc.createElement("tbody");
  rows.forEach((row, index) => {
    const tr = doc.createElement("tr");
    rowCells(row).forEach((cell, column) => {
      const td = doc.createElement("td");
      const entries = paragraphs(cell);
      entries.forEach((entry, paragraphIndex) => {
        const p = doc.createElement(
          column === 0 && paragraphIndex === 0 ? "h2" : "p",
        );
        p.textContent = entry;
        td.append(p);
      });
      tr.append(td);
    });
    tbody.append(tr);
    if (!tr.cells.length)
      throw new Error(`Word question row ${index + 1} is empty or malformed.`);
  });
  table.append(head, tbody);
  wrapper.append(table);
  return wrapper;
}

async function zipDocumentXml(file: File): Promise<string> {
  if (!/\.docx$/i.test(file.name))
    throw new Error("Choose a Microsoft Word .docx file.");
  if (file.size > MAX_DOCX_BYTES)
    throw new Error("DOCX files must be smaller than 20 MB.");
  const bytes = new Uint8Array(await file.arrayBuffer());
  const data = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const u16 = (offset: number) => data.getUint16(offset, true);
  const u32 = (offset: number) => data.getUint32(offset, true);
  // Read ZIP's central directory rather than assuming local-header sizes
  // (Word archives may use data descriptors).
  let end = -1;
  for (let at = bytes.length - 22; at >= Math.max(0, bytes.length - 65557); at--) {
    if (u32(at) === 0x06054b50 && at + 22 + u16(at + 20) === bytes.length) {
      end = at;
      break;
    }
  }
  if (end < 0) throw new Error("This is not a valid DOCX ZIP archive.");
  const count = u16(end + 10);
  let cursor = u32(end + 16);
  if (count > 5000 || cursor > end)
    throw new Error("Unsupported DOCX archive structure.");
  for (let i = 0; i < count; i++) {
    if (cursor + 46 > end || u32(cursor) !== 0x02014b50)
      throw new Error("The DOCX central directory is malformed.");
    const flags = u16(cursor + 8);
    const method = u16(cursor + 10);
    const compressedSize = u32(cursor + 20);
    const xmlSize = u32(cursor + 24);
    const nameLength = u16(cursor + 28);
    const extraLength = u16(cursor + 30);
    const commentLength = u16(cursor + 32);
    const localOffset = u32(cursor + 42);
    const next = cursor + 46 + nameLength + extraLength + commentLength;
    if (next > end) throw new Error("Malformed DOCX file entry.");
    const filename = new TextDecoder().decode(bytes.subarray(cursor + 46, cursor + 46 + nameLength));
    cursor = next;
    if (filename !== "word/document.xml") continue;
    if (flags & 1) throw new Error("Password-protected DOCX files are not supported.");
    if (xmlSize > MAX_XML_BYTES || xmlSize === 0 || compressedSize > MAX_DOCX_BYTES)
      throw new Error("The Word document content is too large.");
    if (localOffset + 30 > bytes.length || u32(localOffset) !== 0x04034b50)
      throw new Error("The Word document entry is invalid.");
    const start = localOffset + 30 + u16(localOffset + 26) + u16(localOffset + 28);
    if (start + compressedSize > bytes.length)
      throw new Error("The Word document entry is incomplete.");
    const compressed = new ArrayBuffer(compressedSize);
    new Uint8Array(compressed).set(bytes.subarray(start, start + compressedSize));
    if (method === 0) {
      if (compressedSize !== xmlSize) throw new Error("Invalid DOCX file size.");
      return new TextDecoder().decode(compressed);
    }
    if (method !== 8) throw new Error("Unsupported DOCX compression method.");
    if (typeof DecompressionStream === "undefined")
      throw new Error("This browser cannot unpack DOCX files. Try a current version of Chrome, Edge, Firefox or Safari.");
    const reader = new Blob([compressed]).stream()
      .pipeThrough(new DecompressionStream("deflate-raw"))
      .getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const result = await reader.read();
      if (result.done) break;
      size += result.value.length;
      if (size > MAX_XML_BYTES) {
        await reader.cancel();
        throw new Error("Expanded DOCX content exceeds 8 MB.");
      }
      chunks.push(result.value);
    }
    if (size !== xmlSize)
      throw new Error("The DOCX file has an invalid uncompressed size.");
    const output = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      output.set(chunk, offset);
      offset += chunk.length;
    }
    return new TextDecoder().decode(output);
  }
  throw new Error("The DOCX file does not contain word/document.xml.");
}

export interface DocxImportResult {
  source: HTMLElement;
  count: number;
  diagnostics: string[];
}

export async function importDocx(file: File, doc: Document = document): Promise<DocxImportResult> {
  const source = wordTableToSource(await zipDocumentXml(file), doc);
  const parsed = parseQuestions(source);
  return { source, count: parsed.questions.length, diagnostics: parsed.diagnostics };
}
