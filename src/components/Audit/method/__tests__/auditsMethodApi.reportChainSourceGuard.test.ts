import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

describe('auditsMethodApi report-chain source guard', () => {
  it('keeps both commands that make the server chain reachable from the client', () => {
    const source = fs.readFileSync(
      path.resolve(process.cwd(), 'src/components/Audit/method/auditsMethodApi.ts'),
      'utf8'
    );
    expect(source).toMatch(/export async function finalizeOutput\s*\(/);
    expect(source).toMatch(/export async function generateReport\s*\(/);
  });
});
