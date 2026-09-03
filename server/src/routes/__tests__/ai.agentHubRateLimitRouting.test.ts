import { describe, expect, it } from 'vitest';

import { isAgentHubDatabaseRead } from '../ai.routes.js';

describe('Agent Hub rate-limit routing', () => {
  it.each([
    ['/agent-plan'],
    ['/agent-plan/processes'],
    ['/agent-plan/plan-1'],
    ['/agent-manifests'],
    ['/agent-manifests/manifest-1'],
  ])('keeps the database GET %s outside the generative AI bucket', (path) => {
    expect(isAgentHubDatabaseRead('GET', path)).toBe(true);
  });

  it.each([
    ['POST', '/agent-plan'],
    ['PATCH', '/agent-plan/plan-1/steps'],
    ['GET', '/chat'],
    ['POST', '/chat'],
  ])('retains the generative limiter for %s %s', (method, path) => {
    expect(isAgentHubDatabaseRead(method, path)).toBe(false);
  });
});
