import { fireEvent, render } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import { sanitizeString } from '../../../../server/src/utils/security.utils';
import { CellEditor } from '../../MyWork/table/CellEditor';
import { PlatformCellRenderer } from '../../MyWork/table/PlatformCellRenderer';
import { CodeExecutionBlock } from '../CodeInterpreter/CodeExecutionBlock';

const hostileHtml = Buffer.from(
  'PHA+PHN0cm9uZz5BbGxvd2VkPC9zdHJvbmc+PC9wPjxpbWcgc3JjPSJ4IiBvbmVycm9yPSJ3aW5kb3cuX194c3M9MSI+PHNjcmlwdD53aW5kb3cuX194c3M9Mjwvc2NyaXB0PjxhIGhyZWY9ImphdmFzY3JpcHQ6YWxlcnQoMSkiPmxpbms8L2E+',
  'base64'
).toString('utf8');

function expectSanitizedRichHtml(container: HTMLElement): void {
  expect(container.querySelector('strong')?.textContent).toBe(
    Buffer.from('QWxsb3dlZA==', 'base64').toString('utf8')
  );
  expect(container.querySelector('script')).toBeNull();
  expect(container.querySelector('[onerror]')).toBeNull();
  expect(container.querySelector('a')?.getAttribute('href') ?? '').not.toMatch(/^javascript:/i);
}

describe('FEEDBACK-1/0c defensive rich HTML boundaries', () => {
  it('sanitizes CodeExecutionBlock HTML while preserving benign markup', () => {
    const { container } = render(
      <CodeExecutionBlock
        code="print('ok')"
        language="python"
        result={{
          success: true,
          stdout: '',
          stderr: '',
          executionTime: 1,
          outputs: [{ type: 'html', data: hostileHtml }],
        }}
      />
    );
    expectSanitizedRichHtml(container);
  });

  it('sanitizes legacy long-text HTML in PlatformCellRenderer', () => {
    const { container } = render(<PlatformCellRenderer fieldType="longText" value={hostileHtml} />);
    expectSanitizedRichHtml(container);
  });

  it('sanitizes legacy rich text before CellEditor writes it to the DOM and saves it', () => {
    const onSave = vi.fn();
    const { container } = render(
      <CellEditor fieldType="longText" value={hostileHtml} onSave={onSave} onCancel={vi.fn()} />
    );
    const editor = container.querySelector('[contenteditable="true"]') as HTMLElement;
    expectSanitizedRichHtml(editor);
    editor.innerHTML = hostileHtml;
    fireEvent.blur(editor);
    expect(onSave).toHaveBeenCalledTimes(1);
    const saved = String(onSave.mock.calls[0][0]);
    expect(saved).toContain('<strong>Allowed</strong>');
    expect(saved).not.toContain('<script');
    expect(saved).not.toContain('onerror');
    expect(saved).not.toContain('javascript:');
  });

  it('keeps an encoded script payload inert when React renders it as text', () => {
    const stored = sanitizeString('&lt;script&gt;window.__xss=1&lt;/script&gt;');
    const { container } = render(<div>{stored}</div>);
    expect(container.textContent).toBe('&lt;script&gt;window.__xss=1&lt;/script&gt;');
    expect(container.querySelector('script')).toBeNull();
  });
});
