/** @vitest-environment node */
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const source = fs.readFileSync(
  path.resolve(process.cwd(), 'src/components/Execution/ExecutionHub.tsx'),
  'utf8'
);

describe('Execution canonical data-source contract', () => {
  it('admits review rows only through the explicit demo-data toggle', () => {
    expect(source).toContain('const allowDemoData = shouldAllowDemoData();');
    expect(source).toContain('const reviewInitiatives = allowDemoData');
    expect(source).not.toMatch(/const reviewInitiatives = import\.meta\.env\.DEV/);
  });

  it('fails closed instead of replacing a failed canonical read with DEV fixtures', () => {
    expect(source).toContain('const fallbackInitiatives = allowDemoData');
    expect(source).toContain(': [];');
    expect(source).not.toMatch(/const fallbackInitiatives = import\.meta\.env\.DEV/);
  });
});
