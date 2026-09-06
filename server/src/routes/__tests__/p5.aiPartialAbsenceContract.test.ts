/** @vitest-environment node */

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const serverSource = readFileSync(new URL('../ai.routes.ts', import.meta.url), 'utf8');
const clientSource = readFileSync(
  new URL('../../../../src/hooks/useAIStream.ts', import.meta.url),
  'utf8'
);

describe('P5 stream partial absence contract', () => {
  it('returns a successful found:false payload instead of an expected 404', () => {
    expect(serverSource).toContain("return res.json({ found: false });");
    expect(serverSource).not.toContain("res.status(404).json({ error: 'No partial response found' })");
  });

  it('maps found:false to null without retaining 404 as control flow', () => {
    expect(clientSource).toContain("body.found === false ? null : body");
    expect(clientSource).not.toContain('response.status === 404');
  });
});
