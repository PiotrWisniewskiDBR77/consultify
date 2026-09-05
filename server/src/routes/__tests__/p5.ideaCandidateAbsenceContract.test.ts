/** @vitest-environment node */

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const routeSource = readFileSync(new URL('../my-work.routes.ts', import.meta.url), 'utf8');
const clientSource = readFileSync(
  new URL('../../../../src/services/api.ts', import.meta.url),
  'utf8'
);

describe('P5 idea candidate absence contract', () => {
  it('returns 200 candidate:null only for the expected absent handoff', () => {
    expect(routeSource).toContain("error.code === 'HANDOFF_NOT_FOUND'");
    expect(routeSource).toContain('return res.json({ candidate: null });');
    expect(routeSource).toContain('res.json({ candidate });');
  });

  it('uses the shared in-flight GET coalescer and unwraps the candidate envelope', () => {
    const method = clientSource.slice(
      clientSource.indexOf('getIdeaProcessFlowCandidate:'),
      clientSource.indexOf('approveIdeaProcessFlowCandidate:')
    );
    expect(method).toContain('fetchWithRetry(');
    expect(method).not.toMatch(/\bfetch\(/);
    expect(method).toContain('return body.candidate;');
    expect(clientSource).toContain('const inFlightGetRequests = new Map<string, Promise<Response>>()');
  });
});
