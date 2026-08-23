import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const source = fs.readFileSync(path.resolve(__dirname, '../WorkCanvasDocumentPanel.tsx'), 'utf8');

describe('WorkCanvasDocumentPanel owner feedback', () => {
  it('uses an explicit workspace outcome instead of the unexplained PROMOTE label', () => {
    expect(source).toContain('data-testid="canvas-workspace-destinations"');
    expect(source).toContain('Create in workspace');
    expect(source).not.toContain('data-testid="canvas-promote-strip"');
    expect(source).not.toMatch(/>\s*Promote\s*</);
  });

  it('retains the concrete workspace destination commands', () => {
    for (const actionId of [
      'send-to-idea',
      'save-as-note',
      'create-initiative',
      'create-decision',
      'create-task',
    ]) {
      expect(source).toContain(`'${actionId}'`);
    }
  });

  it('puts the Rich, DOC and MD switcher directly in the Canvas bar without menu duplicates', () => {
    expect(source).toContain('data-testid="canvas-direct-view-switcher"');
    expect(source).toContain("['rich', 'Rich']");
    expect(source).toContain("['document', 'DOC']");
    expect(source).toContain("['md', 'MD']");
    expect(source).not.toContain('data-testid="canvas-view-actions"');
    expect(source).not.toContain('Switch Rich/Dock/MD view');
    expect(source).not.toContain('Edit Markdown manually');
    expect(source).not.toContain('Back to document view');
  });

  it('contains the floating menu in an opaque elevated layer and restores trigger focus', () => {
    expect(source).toContain('ref={diagnosticsTriggerRef}');
    expect(source).toContain('ref={diagnosticsPanelRef}');
    expect(source).toContain('diagnosticsTriggerRef.current?.focus()');
    expect(source).toContain('role="dialog"');
    expect(source).toContain('tabIndex={-1}');
    expect(source).toContain('w-[min(360px,calc(100vw-24px))]');
    expect(source).toContain('absolute right-0 top-full z-50 mt-2');
    expect(source).toContain('diagnosticsTriggerRef.current?.getBoundingClientRect().bottom');
    expect(source).toContain('overscroll-contain');
    expect(source).toContain('bg-[#ffffff]');
    expect(source).toContain('dark:bg-[#151E32]');
  });
});
