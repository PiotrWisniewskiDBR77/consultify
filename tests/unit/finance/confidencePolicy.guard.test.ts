import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const repoRoot = path.resolve(import.meta.dirname, '../../..');
const read = (file: string) => readFileSync(path.join(repoRoot, file), 'utf8');

describe('Finance confidence and tenant policy guard', () => {
  it('adds no migration that could rewrite historical confidence', () => {
    const changed = execFileSync(
      'git',
      ['diff', '--name-only', 'codex/m03-admin-20260824...HEAD', '--', 'server/migrations'],
      { cwd: repoRoot, encoding: 'utf8' }
    ).trim();
    expect(changed).toBe('');
  });

  it('preserves the historical confidence fallback order', () => {
    expect(read('server/src/services/financeStatementAnalyticsService.ts')).toContain(
      'directHead?.mapping_confidence ?? directHead?.confidence ?? (isDerived ? 1 : 0)'
    );
  });

  it('preserves the mapping confidence threshold at 0.85', () => {
    const source = read('src/components/Finance/FinancialStatementMappingEditor.tsx');
    expect(source.match(/0\.85/g)).toHaveLength(2);
  });

  it('keeps both canonical Finance router guards ahead of every subrouter', () => {
    const source = read('server/src/routes/v8/finance-v2/index.ts');
    const membership = source.indexOf('financeV2Router.use(requireActiveMembership)');
    const mutation = source.indexOf('financeV2Router.use(requireCanonicalFinanceMutation)');
    const firstSubrouter = source.indexOf('financeV2Router.use(modelsRoutes)');
    expect(membership).toBeGreaterThan(-1);
    expect(mutation).toBeGreaterThan(membership);
    expect(firstSubrouter).toBeGreaterThan(mutation);
  });
});
