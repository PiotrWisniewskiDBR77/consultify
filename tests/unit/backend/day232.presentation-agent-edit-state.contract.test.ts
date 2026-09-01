import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const source = readFileSync(
  resolve(process.cwd(), 'server/src/routes/presentations.routes.ts'),
  'utf8'
);

describe('Day232 presentation agent edit state gate source contract', { retry: 0 }, () => {
  it('reads operation status from persistent storage before enforcing the route gate', () => {
    expect(source).toContain('status: row.status');
    expect(source.indexOf('SELECT * FROM presentation_ai_operations WHERE id = ?')).toBeLessThan(
      source.indexOf('return pendingDeckAiOperations.get(operationId) || null')
    );
  });

  it('claims a proposal with a conditional status UPDATE and verifies one changed row', () => {
    expect(source).toContain("expectedStatus ? ' AND status = ?' : ''");
    expect(source).toContain('const resolved = (result?.changes ?? 0) === 1');
    expect(source).toContain("resolveAiOperation(operationId, 'accepted', undefined, 'draft')");
    expect(source).toContain("resolveAiOperation(operationId, 'rejected', undefined, 'draft')");
  });

  it('distinguishes resolved proposals from hidden or foreign proposals', () => {
    expect(source).toContain("if (op.status !== 'draft')");
    expect(source).toContain("code: 'AI_PROPOSAL_ALREADY_RESOLVED'");
    expect(source).toContain("error: 'AI proposal not found'");
  });
});
