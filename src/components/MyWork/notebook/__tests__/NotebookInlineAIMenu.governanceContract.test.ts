import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const source = fs.readFileSync(path.resolve(__dirname, '../NotebookInlineAIMenu.tsx'), 'utf8');

describe('Notebook inline AI governance contract', () => {
  it('shows the exact before/proposed content and Teresa provenance before resolution', () => {
    expect(source).toContain('originalText: contextText');
    expect(source).toContain('revisedText: revised');
    expect(source).toContain("'Źródło: Teresa'");
    expect(source).toContain('createdAt: new Date()');
    expect(source).not.toContain('border-c-accent/30 bg-c-accent-soft');
    expect(source).toContain("'Before'");
    expect(source).toContain("'Proposed'");
    expect(source).toContain('notebook-inline-ai-preview');
  });

  it('keeps explicit accept/reject and fail-closed retry for every remote step', () => {
    expect(source).toContain("setErrorAction('generate')");
    expect(source).toContain("setErrorAction('approve')");
    expect(source).toContain("setErrorAction('reject')");
    expect(source).toContain('void handleApprove()');
    expect(source).toContain('void handleReject()');
    expect(source).toContain("t('common.retry', 'Retry')");
  });
});
