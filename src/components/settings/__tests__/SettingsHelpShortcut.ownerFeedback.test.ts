import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

describe('SET-OWN-001 permanent Settings help-shortcut removal', () => {
  it('contains no InfoButton import or render in the complete Settings component tree', () => {
    const root = path.resolve(process.cwd(), 'src/components/settings');
    const files: string[] = [];
    const visit = (directory: string) => {
      for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        const target = path.join(directory, entry.name);
        if (entry.isDirectory()) visit(target);
        else if (/\.tsx?$/.test(entry.name)) files.push(target);
      }
    };
    visit(root);

    const source = files
      .filter((file) => !file.includes(`${path.sep}__tests__${path.sep}`))
      .map((file) => fs.readFileSync(file, 'utf8'))
      .join('\n');
    expect(source).not.toContain('InfoButton');
    expect(source).not.toContain('data-info-button');
    expect(source).not.toContain('info-button');
  });

  it('does not rely on CSS hiding to simulate removal', () => {
    const css = fs.readFileSync(path.resolve(process.cwd(), 'src/index.css'), 'utf8');
    expect(css).not.toMatch(
      /\.settings-domain-content[\s\S]{0,120}(?:data-info-button|info-button)/
    );
  });
});
