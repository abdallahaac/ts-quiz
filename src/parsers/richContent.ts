import type { Answer } from "../domain/models";

export const normalizeText = (value: unknown) =>
  String(value ?? "")
    .replace(/[\u200b-\u200d\ufeff]/g, "")
    .replace(/\s+/g, " ")
    .trim();
var allowedTags = new Set(
  "P BR STRONG B EM I U S SUB SUP SPAN A UL OL LI BLOCKQUOTE CODE H4 H5 H6".split(
    " ",
  ),
);
var droppedTags = new Set(
  "SCRIPT STYLE IFRAME OBJECT EMBED FORM INPUT BUTTON TEXTAREA SELECT SVG MATH TEMPLATE NOSCRIPT".split(
    " ",
  ),
);
export function cleanClone<T extends Element>(node: T): T {
  const clone = node.cloneNode(true) as T;
  for (const el of [...clone.querySelectorAll("*")]) {
    if (droppedTags.has(el.tagName)) {
      el.remove();
      continue;
    }
    if (!allowedTags.has(el.tagName)) {
      el.replaceWith(...el.childNodes);
      continue;
    }
    for (const attr of [...el.attributes]) {
      if (
        !(
          el.tagName === "A" && ["href", "title", "target"].includes(attr.name)
        ) &&
        !["lang", "dir"].includes(attr.name)
      )
        el.removeAttribute(attr.name);
    }
    if (el.tagName === "A") {
      const href = (el.getAttribute("href") || "")
        .split("")
        .filter((char) => char.charCodeAt(0) > 32)
        .join("");
      if (
        /^[a-z][\w+.-]*:/i.test(href) &&
        !/^(https?:|mailto:|tel:)/i.test(href)
      )
        el.removeAttribute("href");
      if (el.getAttribute("target") === "_blank")
        el.setAttribute("rel", "noopener noreferrer");
    }
  }
  return clone;
}
export function richHTML(node: Element | null | undefined): string {
  return node ? cleanClone(node).innerHTML.trim() : "";
}
export function answerFromListItem(li: Element): Answer {
  const clone = cleanClone(li);
  const walker = li.ownerDocument.createTreeWalker(clone, 4);
  const nodes: Text[] = [];
  let node;
  while ((node = walker.nextNode())) nodes.push(node as Text);
  const raw = nodes.map((item) => item.data).join("");
  const tokens = [
    ...raw.matchAll(
      /\[\s*C[\s\u200b-\u200d\ufeff]*O[\s\u200b-\u200d\ufeff]*R[\s\u200b-\u200d\ufeff]*R[\s\u200b-\u200d\ufeff]*E[\s\u200b-\u200d\ufeff]*C[\s\u200b-\u200d\ufeff]*T\s*\]/gi,
    ),
  ];
  let offset = 0;
  for (const item of nodes) {
    const start = offset;
    offset += item.length;
    item.data = item.data
      .split("")
      .filter(
        (_character, index) =>
          !tokens.some(
            (token) =>
              start + index >= token.index &&
              start + index < token.index + token[0].length,
          ),
      )
      .join("");
  }
  const text = normalizeText(clone.textContent);
  return {
    html: clone.innerHTML.trim(),
    text,
    markerCount: tokens.length,
    correct: tokens.length === 1,
  };
}
export function between(
  container: Element,
  start: Element | null | undefined,
  end: Element | null | undefined,
  includeStart = false,
): HTMLDivElement {
  const range = container.ownerDocument.createRange();
  range.selectNodeContents(container);
  if (start)
    includeStart ? range.setStartBefore(start) : range.setStartAfter(start);
  if (end) range.setEndBefore(end);
  const result = container.ownerDocument.createElement("div");
  result.append(range.cloneContents());
  return result;
}
