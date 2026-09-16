import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

describe('OPEN-1/U-38 Execution task document routing', () => {
  const source = readFileSync(join(process.cwd(), 'src/components/Execution/ExecutionHub.tsx'), 'utf8');

  it('routes legacy task documents to manager-safe TaskDetailView', () => {
    expect(source).toContain('if (executionCaseId) {');
    expect(source).toContain('<TaskDetailView');
    expect(source).toContain('ownerScoped={false}');
    expect(source).toContain("taskId={workIdParts.join(':')}");
  });
});
