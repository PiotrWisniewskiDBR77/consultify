import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const source = fs.readFileSync(path.resolve(__dirname, '../AssignInterviewModal.tsx'), 'utf8');

describe('AssignInterviewModal owner creator contract', () => {
  it('exposes a named modal dialog with a labelled close action', () => {
    expect(source).toContain('role="dialog"');
    expect(source).toContain('aria-modal="true"');
    expect(source).toContain('aria-labelledby="assign-interview-dialog-title"');
    expect(source).toContain('aria-describedby="assign-interview-dialog-description"');
    expect(source).toContain("aria-label={t('common.close', 'Close')}");
  });

  it('owns focus, Escape and responsive creator geometry', () => {
    expect(source).toContain("event.key === 'Escape'");
    expect(source).toContain("event.key !== 'Tab'");
    expect(source).toContain('previouslyFocusedRef.current?.focus()');
    expect(source).toContain('max-w-4xl');
    expect(source).toContain('min-h-0 flex-1');
    expect(source).toContain('grid-cols-1 gap-4 sm:grid-cols-2');
    expect(source).toContain('if (!isSubmitting) onClose()');
    expect(source).toContain('disabled={isSubmitting}');
  });
});
