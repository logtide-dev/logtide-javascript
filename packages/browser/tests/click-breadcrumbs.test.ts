import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ClickBreadcrumbIntegration } from '../src/integrations/click-breadcrumbs';
import type { Client } from '@logtide/types';

function createMockClient(): Client {
  return {
    captureError: vi.fn(),
    captureLog: vi.fn(),
    addBreadcrumb: vi.fn(),
  };
}

describe('ClickBreadcrumbIntegration', () => {
  let integration: ClickBreadcrumbIntegration;
  let client: Client;

  beforeEach(() => {
    client = createMockClient();
    integration = new ClickBreadcrumbIntegration();
  });

  afterEach(() => {
    integration.teardown();
    vi.restoreAllMocks();
  });

  it('has the correct name', () => {
    expect(integration.name).toBe('click-breadcrumbs');
  });

  it('skips setup when document is not available', () => {
    const origDocument = globalThis.document;
    // @ts-expect-error - remove document for test
    delete globalThis.document;

    integration.setup(client);
    // Should not throw
    expect(client.addBreadcrumb).not.toHaveBeenCalled();

    globalThis.document = origDocument;
  });

  it('records click breadcrumb with element details', () => {
    integration.setup(client);

    const button = document.createElement('button');
    button.id = 'submit-btn';
    button.className = 'primary large';
    button.textContent = 'Submit Order';
    button.setAttribute('data-testid', 'submit-button');
    document.body.appendChild(button);

    button.click();

    expect(client.addBreadcrumb).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'ui',
        category: 'ui.click',
        message: expect.stringContaining('button#submit-btn'),
        data: expect.objectContaining({
          tagName: 'BUTTON',
          id: 'submit-btn',
          className: 'primary large',
          textContent: 'Submit Order',
          testId: 'submit-button',
        }),
      }),
    );

    document.body.removeChild(button);
  });

  it('records click breadcrumb for element without id or class', () => {
    integration.setup(client);

    const span = document.createElement('span');
    span.textContent = 'Click me';
    document.body.appendChild(span);

    span.click();

    expect(client.addBreadcrumb).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'ui',
        category: 'ui.click',
        message: 'span "Click me"',
        data: expect.objectContaining({
          tagName: 'SPAN',
          textContent: 'Click me',
        }),
      }),
    );

    document.body.removeChild(span);
  });

  it('truncates long text content', () => {
    integration = new ClickBreadcrumbIntegration({ maxTextLength: 10 });
    integration.setup(client);

    const div = document.createElement('div');
    div.textContent = 'This is a very long text that should be truncated';
    document.body.appendChild(div);

    div.click();

    const call = (client.addBreadcrumb as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call.data.textContent).toBe('This is a …');

    document.body.removeChild(div);
  });

  it('records input breadcrumb', () => {
    integration.setup(client);

    const input = document.createElement('input');
    input.id = 'email';
    input.type = 'email';
    document.body.appendChild(input);

    input.dispatchEvent(new Event('input', { bubbles: true }));

    expect(client.addBreadcrumb).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'ui',
        category: 'ui.input',
        message: expect.stringContaining('input#email'),
      }),
    );

    document.body.removeChild(input);
  });

  it('debounces input events per element (1s)', () => {
    vi.useFakeTimers();
    integration.setup(client);

    const input = document.createElement('input');
    input.id = 'search';
    document.body.appendChild(input);

    // First input — should record
    input.dispatchEvent(new Event('input', { bubbles: true }));
    expect(client.addBreadcrumb).toHaveBeenCalledTimes(1);

    // Second input within 1s — should be debounced
    input.dispatchEvent(new Event('input', { bubbles: true }));
    expect(client.addBreadcrumb).toHaveBeenCalledTimes(1);

    // Advance past debounce window
    vi.advanceTimersByTime(1100);

    // Third input — should record again
    input.dispatchEvent(new Event('input', { bubbles: true }));
    expect(client.addBreadcrumb).toHaveBeenCalledTimes(2);

    document.body.removeChild(input);
    vi.useRealTimers();
  });

  it('cleans up event listeners on teardown', () => {
    integration.setup(client);

    const button = document.createElement('button');
    button.textContent = 'Test';
    document.body.appendChild(button);

    integration.teardown();

    button.click();
    expect(client.addBreadcrumb).not.toHaveBeenCalled();

    document.body.removeChild(button);
  });

  it('includes timestamp in breadcrumb', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-15T12:00:00Z'));

    integration.setup(client);

    const div = document.createElement('div');
    div.textContent = 'Test';
    document.body.appendChild(div);

    div.click();

    const call = (client.addBreadcrumb as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call.timestamp).toBe(Date.now());

    document.body.removeChild(div);
    vi.useRealTimers();
  });
});
