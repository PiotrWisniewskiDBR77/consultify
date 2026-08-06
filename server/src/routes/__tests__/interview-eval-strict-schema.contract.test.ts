import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const source = fs.readFileSync(
  path.resolve(process.cwd(), 'server/src/controllers/InterviewController.ts'),
  'utf8'
);

describe('Interview answer evaluation strict-output schema', () => {
  it('requires fixType while allowing an explicit null no-remediation value', () => {
    const schemaBlock = source.match(
      /const EvalSchema = z\.object\(\{[\s\S]*?recommendations: z\.array\(z\.string\(\)\),\n\s*\}\);/
    )?.[0];

    expect(schemaBlock).toBeTruthy();
    expect(schemaBlock).toMatch(/fixType:[\s\S]*?\.nullable\(\)/);
    expect(schemaBlock).not.toMatch(/fixType:[\s\S]*?\.optional\(\)/);
  });
});
