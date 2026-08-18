import { describe, expect, it } from 'vitest';

import { normalizeManagementReportProjects } from '../ManagementReportsView';

describe('normalizeManagementReportProjects', () => {
  const project = { id: 'project-1', name: 'Real project' };

  it.each([[project], { data: [project] }, { data: { projects: [project] } }])(
    'normalizes direct and canonical project envelopes',
    (response) => {
      expect(normalizeManagementReportProjects(response)).toEqual([project]);
    }
  );

  it('fails closed for a malformed project response', () => {
    expect(() => normalizeManagementReportProjects({ data: {} })).toThrow(
      'Invalid projects response'
    );
  });
});
