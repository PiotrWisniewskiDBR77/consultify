import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

describe('Initiatives timeline truthful empty-state contract', { retry: 0 }, () => {
  it('distinguishes initiatives without timeline dates from no initiatives in execution', { retry: 0 }, () => {
    const source = fs.readFileSync(
      path.resolve('src/components/Execution/ExecutionTimelineView.tsx'),
      'utf8'
    );
    const en = JSON.parse(fs.readFileSync(path.resolve('public/locales/en/translation.json'), 'utf8'));

    expect(source).toContain('filteredInitiatives.length > 0');
    expect(source).toContain("t('execution.empty.noTimelineDates')");
    expect(en.execution.empty.noTimelineDates).toMatch(/date|schedule/i);
    expect(en.execution.empty.noTimelineDates).not.toMatch(/move initiatives to execution/i);
  });
});
