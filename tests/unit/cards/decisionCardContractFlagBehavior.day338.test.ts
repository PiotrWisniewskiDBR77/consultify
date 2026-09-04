// KONTRAKT DYŻURU 338 — wykonuje realne ciało resolvera flagi z widoku Decyzji.
import fs from 'node:fs';
import path from 'node:path';

import { beforeEach, describe, expect, it, vi } from 'vitest';

const VIEW = path.resolve(__dirname, '../../../src/components/MyWork/DecisionDetailView.tsx');

function loadResolver(): () => boolean {
  const source = fs.readFileSync(VIEW, 'utf8');
  const start = source.indexOf('function useDecisionCardContractEnabled(): boolean {');
  const end = source.indexOf('\n}\n\ntype ConsequenceTimeline', start);
  expect(start).toBeGreaterThan(-1);
  expect(end).toBeGreaterThan(start);

  const body = source
    .slice(start, end + 2)
    .replace('function useDecisionCardContractEnabled(): boolean', 'function resolver()')
    .replace('import.meta.env.VITE_VF1_DECISION_CARD_CONTRACT', 'runtimeEnv.flag');

  return new Function(
    'useMemo',
    'runtimeEnv',
    `${body}; return resolver;`
  )((fn: () => boolean) => fn(), { flag: undefined }) as () => boolean;
}

describe('DEC-388 R6 — flaga kontraktu Decyzji broni zachowania', () => {
  beforeEach(() => {
    window.history.replaceState({}, '', '/');
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it("ff.cardContract='1' włącza kontrakt", () => {
    window.localStorage.setItem('ff.cardContract', '1');
    expect(loadResolver()()).toBe(true);
  });

  it("ff.cardContract='0' wyłącza kontrakt", () => {
    window.localStorage.setItem('ff.cardContract', '0');
    expect(loadResolver()()).toBe(false);
  });

  it('brak klucza zachowuje bezpieczne default OFF', () => {
    expect(loadResolver()()).toBe(false);
  });
});
