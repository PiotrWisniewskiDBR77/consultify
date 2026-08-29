import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const source = fs.readFileSync(
  path.resolve(process.cwd(), 'src/components/LLMSelector.tsx'),
  'utf8'
);

describe('LLMSelector top-bar crimson contract', () => {
  it('keeps the selector surface neutral while preserving semantic outage signals', () => {
    const buttonStart = source.indexOf('data-testid="llm-tier-selector"');
    const buttonEnd = source.indexOf('{/* Status Dot / Icon */}', buttonStart);
    const buttonClasses = source.slice(buttonStart, buttonEnd);

    expect(buttonStart).toBeGreaterThan(-1);
    expect(buttonEnd).toBeGreaterThan(buttonStart);
    expect(buttonClasses).toContain(
      "'bg-slate-50 dark:bg-white/5 border-slate-300 dark:border-navy-600 hover:bg-slate-100 dark:hover:bg-white/10'"
    );
    expect(buttonClasses).not.toContain('bg-danger-');
    expect(buttonClasses).not.toContain('border-danger-');

    expect(source).toContain("isUnavailable ? 'bg-danger-500'");
    expect(source).toContain("'text-danger-600 dark:text-danger-400'");
  });
});
