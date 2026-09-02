import { readFileSync, readdirSync } from 'node:fs';
import { extname, join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { CHAT_ACTION_DEFINITIONS } from '@/types/domain/chatActions';

const REPO_ROOT = process.cwd();
const EXCLUDED = new Set([
  'src/types/domain/chatActions.ts',
  'src/services/chatActionRegistry.ts',
  'src/services/chatActionHandler.ts',
  'src/actions/federatedActionAdapters.ts',
]);

function sourceFiles(directory: string): string[] {
  return readdirSync(join(REPO_ROOT, directory), { withFileTypes: true }).flatMap((entry) => {
    const relative = join(directory, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === '__tests__' || entry.name === 'node_modules' || entry.name === '_backup') {
        return [];
      }
      return sourceFiles(relative);
    }
    return ['.ts', '.tsx'].includes(extname(entry.name)) && !EXCLUDED.has(relative)
      ? [relative]
      : [];
  });
}

describe('day223 ChatActionType producer inventory', () => {
  it('does not allow the producer-less inventory to grow beyond eight types', () => {
    const files = [...sourceFiles('src'), ...sourceFiles('server/src')];
    const producerCounts = Object.fromEntries(
      CHAT_ACTION_DEFINITIONS.map(({ type }) => {
        const literal = `'${type}'`;
        const count = files.filter((file) => readFileSync(join(REPO_ROOT, file), 'utf8').includes(literal)).length;
        return [type, count];
      })
    );
    const producerLess = Object.entries(producerCounts)
      .filter(([, count]) => count === 0)
      .map(([type]) => type);

    expect(producerLess, JSON.stringify(producerCounts, null, 2)).toHaveLength(8);
  });

  it('keeps governed draft creation out of the legacy chat action catalog', () => {
    const types = CHAT_ACTION_DEFINITIONS.map(({ type }) => type);
    expect(types).not.toContain('CREATE_TASK');
    expect(types).not.toContain('CREATE_DECISION');
    expect(types).not.toContain('CREATE_INITIATIVE');
  });
});
