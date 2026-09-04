import { execFileSync } from 'node:child_process';
import { readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

import type { Request } from 'express';
import { describe, expect, it } from 'vitest';

import { mapAppErrorResponse } from '../../../../server/src/middleware/appErrorMapper.js';

function routeFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    if (statSync(path).isDirectory()) return name === '__tests__' ? [] : routeFiles(path);
    return path.endsWith('.ts') && !/\.(?:test|spec)\.ts$/.test(path) ? [path] : [];
  });
}

describe('day313 request propagation to app error mapper', () => {
  it('leaves no mapper call with undefined when req is in lexical scope', () => {
    const root = process.cwd();
    const output = execFileSync(
      process.execPath,
      [
        resolve(root, 'scripts/dev/codemod-error-mapper-req.mjs'),
        '--check',
        ...routeFiles(resolve(root, 'server/src/routes')),
      ],
      { cwd: root, encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 }
    );
    const inventory = JSON.parse(output) as { eligible: string[] };
    expect(inventory.eligible).toEqual([]);
  });

  it('uses Polish with Accept-Language pl and English without the header', () => {
    const error = Object.assign(new Error('raw database detail'), { code: '23505' });
    const polishReq = { get: (name: string) => (name === 'Accept-Language' ? 'pl-PL' : undefined) } as Request;
    const englishReq = { get: () => undefined } as unknown as Request;
    expect(mapAppErrorResponse(error, polishReq).error).toBe('Operacja jest w konflikcie z aktualnym stanem.');
    expect(mapAppErrorResponse(error, englishReq).error).toBe('The operation conflicts with the current state.');
  });
});
