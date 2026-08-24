/** @vitest-environment node */
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const source = fs.readFileSync(
  path.resolve(process.cwd(), 'src/components/initiatives/CanonicalInitiativeCardWorkspace.tsx'),
  'utf8'
);

describe('Initiative to Execution link contract', () => {
  it('keeps the Execution link available after the Initiative enters execution', () => {
    expect(source).toContain("initiative.initiative.lifecycleState === 'IN_EXECUTION'");
    expect(source).toContain("lifecycleState === 'IN_EXECUTION'");
    expect(source).toContain(
      'onOpenExecution(linkedExecutionCase.executionCaseId, initiativeId)'
    );
  });
});
