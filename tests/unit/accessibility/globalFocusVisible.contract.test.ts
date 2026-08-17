import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const css = fs.readFileSync(path.resolve(process.cwd(), 'src/index.css'), 'utf8');

describe('global keyboard focus contract', () => {
  it('keeps the canonical focus token enabled without an opt-in html class', () => {
    const baseline = css.match(
      /:root\s+:where\([\s\S]*?\):focus-visible\s*\{([\s\S]*?)\}/
    );

    expect(baseline?.[1]).toContain('var(--c-focus-solid, #2563eb)');
    expect(baseline?.[1]).toContain('outline-offset: 2px !important');
    expect(baseline?.[0]).toContain('button');
    expect(baseline?.[0]).toContain("[tabindex]:not([tabindex='-1'])");
    expect(baseline?.[0]).not.toContain('html.focus-highlight');
  });

  it('preserves the frozen no-frame decision only for typing editors', () => {
    expect(css).toMatch(
      /:root textarea:focus-visible,[\s\S]*?:root \.ProseMirror:focus-visible\s*\{[\s\S]*?outline: none !important;/
    );
  });
});
