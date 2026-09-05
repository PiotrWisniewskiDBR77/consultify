import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const source = fs.readFileSync(
  path.resolve(process.cwd(), 'scripts/dev/odbior-zywo/zrzut.mjs'),
  'utf8',
);

describe('kanoniczny zrzut: opt-in motywu', () => {
  it('zachowuje light jako wartość domyślną', () => {
    expect(source).toContain("const motyw = get('motyw', 'light')");
    expect(source).toContain('colorScheme: motyw');
  });

  it('przekazuje motyw do init script i przełącza klasę dark', () => {
    expect(source).toContain('await ctx.addInitScript((theme) => {');
    expect(source).toContain("theme === 'dark'");
    expect(source).toContain("classList.add('dark')");
    expect(source).toContain("classList.remove('dark')");
    expect(source).toContain('}, motyw);');
  });

  it('nadaje ciemnemu artefaktowi sufiks __dark tylko raz', () => {
    const darkOut = (requestedOut: string) => requestedOut.replace(/(?<!__dark)(\.[^.\/]+)$/, '__dark$1');
    expect(darkOut('ev/a.png')).toBe('ev/a__dark.png');
    expect(darkOut('ev/a__dark.png')).toBe('ev/a__dark.png');
  });
});
