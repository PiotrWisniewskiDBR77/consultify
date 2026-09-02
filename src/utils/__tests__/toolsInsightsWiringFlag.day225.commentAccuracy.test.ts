import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const SOURCE_PATH = resolve(process.cwd(), 'src/utils/toolsInsightsWiringFlag.ts');

describe('Day225 toolsInsightsWiringFlag comment accuracy', () => {
  it('records the dated correction and keeps owner acceptance as the reason for default OFF', () => {
    const source = readFileSync(SOURCE_PATH, 'utf8');

    expect(source).toContain('SPROSTOWANE 01.09 (dyżur 225)');
    expect(source).toContain('2026-08-28 09:35 UTC');
    expect(source).toContain('migracje 946/947/948 mają status `success`');
    expect(source).toContain('docs/program/funkcje/ZNALEZISKO_TOOL_OUTPUTS.md');
    expect(source).toContain('do świadomego akceptu właściciela');
    expect(source).toContain('resolved = fromQuery ?? fromLs ?? fromEnv ?? false');
  });

  it('rejects the three stale claims that tool_outputs is absent from staging', () => {
    const source = readFileSync(SOURCE_PATH, 'utf8');

    expect(source).not.toContain('tabela `tool_outputs` NIE ISTNIEJE');
    expect(source).not.toContain('tool_outputs nie istnieje na bazie');
    expect(source).not.toContain('`tool_outputs` does not exist on the staging');
  });
});
