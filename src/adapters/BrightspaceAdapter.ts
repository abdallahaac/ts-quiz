import { escapeHTML } from "../utils/markup";
interface BrightspaceElement extends HTMLElement {
  readonly updateComplete?: Promise<unknown>;
}
/** Component creation and asynchronous Lit focus are isolated from the application. */
export class BrightspaceAdapter {
  constructor(readonly components: boolean) {}
  static available(doc: Document): boolean {
    return [
      "d2l-button",
      "d2l-alert",
      "d2l-icon",
      "d2l-collapsible-panel",
    ].every((name) => !!doc.defaultView?.customElements?.get(name));
  }
  button(
    text: string,
    attr: string,
    primary = false,
    disabled = false,
    hidden = false,
  ): string {
    const tag = this.components ? "d2l-button" : "button";
    return `<${tag} class="quiz-button" type="button" ${attr} ${primary ? "primary" : ""} ${disabled ? "disabled" : ""} ${hidden ? "hidden" : ""} title="${escapeHTML(text)}">${escapeHTML(text)}</${tag}>`;
  }
  instructions(html: string): string {
    if (!html.trim() || !html.replace(/<[^>]*>/g, "").trim()) return "";
    if (!this.components)
      return `<details class="interaction-instructions-panel" open><summary>Instructions</summary>${html.trim()}</details>`;
    return `<d2l-collapsible-panel class="interaction-instructions-panel" panel-title="Instructions" expand-collapse-label="Instructions" heading-level="3" heading-style="3" expanded><div class="interaction-instruction-list">${html.trim()}</div></d2l-collapsible-panel>`;
  }
  async focusFeedback(feedback: HTMLElement | null): Promise<void> {
    const alert = feedback?.closest<BrightspaceElement>("d2l-alert");
    if (alert?.updateComplete) {
      await alert.updateComplete;
      await alert.updateComplete;
    }
    if (feedback?.isConnected) feedback.focus();
  }
}
