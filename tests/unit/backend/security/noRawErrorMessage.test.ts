import { readFileSync, readdirSync } from 'node:fs';
import { extname, join, relative, resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const routesRoot = resolve(process.cwd(), 'server/src/routes');
const rawResponseProperty =
  /(?:error|message):\s*(?:\((?:err|error) as Error\)|(?:err|error|e))\.message/g;

function routeFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      return entry.name === '__tests__' ? [] : routeFiles(path);
    }
    return extname(entry.name) === '.ts' ? [path] : [];
  });
}

describe('raw route error response guard', () => {
  it('keeps direct err.message response properties at baseline zero', () => {
    const violations = routeFiles(routesRoot).flatMap((file) => {
      const source = readFileSync(file, 'utf8');
      return [...source.matchAll(rawResponseProperty)].map((match) => {
        const line = source.slice(0, match.index).split('\n').length;
        return `${relative(process.cwd(), file)}:${line}:${match[0]}`;
      });
    });

    expect(violations, violations.join('\n')).toEqual([]);
  });
});
