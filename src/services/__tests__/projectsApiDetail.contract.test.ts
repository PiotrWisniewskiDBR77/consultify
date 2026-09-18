import { describe, expect, it } from 'vitest';

import apiSource from '../api.ts?raw';

describe('PJ-1 project details API contract', () => {
  it('uses the real /projects/:id endpoint instead of the historical browser stub', () => {
    const start = apiSource.indexOf('getProjectDetails: async');
    expect(start).toBeGreaterThan(-1);
    const body = apiSource.slice(start, start + 420);
    expect(body).toContain('fetchWithRetry(`${API_URL}/projects/${projectId}`');
    expect(body).toContain("handleResponse(res, 'Failed to fetch project details')");
    expect(body).not.toContain("({ id: projectId, name: '', description: '', goal: '', status: 'active' })");
  });
});
