import type { Integration, Client } from '@logtide/types';
import type { ClickBreadcrumbOptions } from '../types';

/**
 * Captures click and input events as UI breadcrumbs via event delegation.
 *
 * - Click: records tag, id, class, text content, data-testid
 * - Input: records element descriptor only (never captures values)
 * - Input events are debounced (one breadcrumb per element per 1s)
 */
export class ClickBreadcrumbIntegration implements Integration {
  name = 'click-breadcrumbs';

  private client: Client | null = null;
  private maxTextLength: number;
  private onClick: ((event: Event) => void) | null = null;
  private onInput: ((event: Event) => void) | null = null;
  private inputTimers = new Map<string, number>();

  constructor(options?: ClickBreadcrumbOptions) {
    this.maxTextLength = options?.maxTextLength ?? 200;
  }

  setup(client: Client): void {
    if (typeof document === 'undefined') return;

    this.client = client;

    this.onClick = (event: Event) => {
      const target = event.target as Element | null;
      if (!target) return;

      const descriptor = this.describeElement(target);
      this.client!.addBreadcrumb({
        type: 'ui',
        category: 'ui.click',
        message: descriptor.summary,
        timestamp: Date.now(),
        data: descriptor.data,
      });
    };

    this.onInput = (event: Event) => {
      const target = event.target as Element | null;
      if (!target) return;

      const key = this.elementKey(target);
      if (this.inputTimers.has(key)) return;

      // Debounce: one breadcrumb per element per 1s
      this.inputTimers.set(
        key,
        window.setTimeout(() => {
          this.inputTimers.delete(key);
        }, 1000),
      );

      const descriptor = this.describeElement(target);
      this.client!.addBreadcrumb({
        type: 'ui',
        category: 'ui.input',
        message: descriptor.summary,
        timestamp: Date.now(),
        data: descriptor.data,
      });
    };

    document.addEventListener('click', this.onClick, { capture: true });
    document.addEventListener('input', this.onInput, { capture: true });
  }

  teardown(): void {
    if (typeof document !== 'undefined') {
      if (this.onClick) {
        document.removeEventListener('click', this.onClick, { capture: true });
      }
      if (this.onInput) {
        document.removeEventListener('input', this.onInput, { capture: true });
      }
    }

    for (const timer of this.inputTimers.values()) {
      clearTimeout(timer);
    }
    this.inputTimers.clear();
    this.onClick = null;
    this.onInput = null;
    this.client = null;
  }

  private describeElement(el: Element): {
    summary: string;
    data: Record<string, unknown>;
  } {
    const tagName = el.tagName?.toLowerCase() ?? 'unknown';
    const id = el.id || undefined;
    const className =
      el.className && typeof el.className === 'string'
        ? el.className.trim()
        : undefined;
    const testId =
      el.getAttribute?.('data-testid') ?? undefined;
    const textContent = this.truncate(
      el.textContent?.trim() ?? '',
      this.maxTextLength,
    );

    // Build summary: button#submit-btn.primary "Submit Order"
    let summary = tagName;
    if (id) summary += `#${id}`;
    if (className) summary += `.${className.split(/\s+/).join('.')}`;
    if (textContent) summary += ` "${textContent}"`;

    const data: Record<string, unknown> = { tagName: el.tagName };
    if (id) data.id = id;
    if (className) data.className = className;
    if (textContent) data.textContent = textContent;
    if (testId) data.testId = testId;

    return { summary, data };
  }

  private elementKey(el: Element): string {
    const tag = el.tagName ?? '';
    const id = el.id ?? '';
    const name = (el as HTMLInputElement).name ?? '';
    return `${tag}:${id}:${name}`;
  }

  private truncate(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength) + '…';
  }
}
