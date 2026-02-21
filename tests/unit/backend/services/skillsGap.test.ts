/**
 * Contract tests for skillsGapService.
 * Validates gap computation logic with mocked DB calls.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../../server/src/utils/DbPromise.js', () => ({
  all: vi.fn(),
  get: vi.fn(),
  run: vi.fn(),
}));

vi.mock('uuid', () => ({
  v4: () => 'test-uuid-gap-001',
}));

import * as DbPromise from '../../../../server/src/utils/DbPromise.js';
import {
  computeInitiativeGap,
  computeGapByCompetency,
} from '../../../../server/src/services/skillsGapService.js';

const mockAll = DbPromise.all as any;
const mockGet = DbPromise.get as any;

describe('skillsGapService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('computeInitiativeGap', () => {
    it('returns correct gap for a simple initiative with missing skill', async () => {
      mockGet.mockResolvedValueOnce({ id: 'init-1', title: 'Digital Transformation', project_id: 'proj-1' });
      mockAll.mockResolvedValueOnce([
        { id: 'r1', capability_id: 'cap-1', capability_name: 'Lean Six Sigma', category_name: 'Operations', min_level: 4, priority: 'required', headcount: null },
        { id: 'r2', capability_id: 'cap-2', capability_name: 'Agile', category_name: 'Digital', min_level: 3, priority: 'nice_to_have', headcount: null },
      ]);
      mockAll.mockResolvedValueOnce([
        { user_id: 'u1', first_name: 'Alice', last_name: 'Smith', email: 'a@test.com' },
        { user_id: 'u2', first_name: 'Bob', last_name: 'Jones', email: 'b@test.com' },
      ]);
      mockAll.mockResolvedValueOnce([
        { user_id: 'u1', capability_id: 'cap-2', level: 4 },
      ]);

      const gap = await computeInitiativeGap('org-1', 'init-1');

      expect(gap.initiativeName).toBe('Digital Transformation');
      expect(gap.totalRequirements).toBe(2);
      expect(gap.teamSize).toBe(2);
      expect(gap.profilesComplete).toBe(1);
      expect(gap.unknownCoveragePercent).toBe(50);

      const leanReq = gap.requirements.find((r) => r.capabilityId === 'cap-1');
      expect(leanReq?.status).toBe('missing');
      expect(leanReq?.recommendation).toBe('hire');

      const agileReq = gap.requirements.find((r) => r.capabilityId === 'cap-2');
      expect(agileReq?.status).toBe('covered');
      expect(agileReq?.coveredBy).toHaveLength(1);
      expect(agileReq?.coveredBy[0].firstName).toBe('Alice');
    });

    it('handles partial gap when level is insufficient', async () => {
      mockGet.mockResolvedValueOnce({ id: 'init-2', title: 'Test Init', project_id: null });
      mockAll.mockResolvedValueOnce([
        { id: 'r1', capability_id: 'cap-1', capability_name: 'Strategy', category_name: null, min_level: 5, priority: 'required', headcount: null },
      ]);
      mockAll.mockResolvedValueOnce([
        { user_id: 'u1', first_name: 'Charlie', last_name: 'Brown', email: 'c@test.com' },
      ]);
      mockAll.mockResolvedValueOnce([
        { user_id: 'u1', capability_id: 'cap-1', level: 3 },
      ]);

      const gap = await computeInitiativeGap('org-1', 'init-2');

      expect(gap.requirements[0].status).toBe('partial');
      expect(gap.requirements[0].bestAvailableLevel).toBe(3);
      expect(gap.requirements[0].recommendation).toBe('outsource');
    });

    it('returns unknown when no profiles exist', async () => {
      mockGet.mockResolvedValueOnce({ id: 'init-3', title: 'Empty', project_id: 'proj-2' });
      mockAll.mockResolvedValueOnce([
        { id: 'r1', capability_id: 'cap-1', capability_name: 'PM', category_name: null, min_level: 3, priority: 'required', headcount: null },
      ]);
      mockAll.mockResolvedValueOnce([
        { user_id: 'u1', first_name: 'D', last_name: 'E', email: 'd@e.com' },
      ]);
      mockAll.mockResolvedValueOnce([]);

      const gap = await computeInitiativeGap('org-1', 'init-3');

      expect(gap.requirements[0].status).toBe('unknown');
      expect(gap.unknown).toBe(1);
      expect(gap.unknownCoveragePercent).toBe(100);
    });

    it('returns empty persons when no team members', async () => {
      mockGet.mockResolvedValueOnce({ id: 'init-4', title: 'Solo', project_id: null });
      mockAll.mockResolvedValueOnce([
        { id: 'r1', capability_id: 'cap-1', capability_name: 'PM', category_name: null, min_level: 2, priority: 'required', headcount: null },
      ]);
      mockAll.mockResolvedValueOnce([]);

      const gap = await computeInitiativeGap('org-1', 'init-4');

      expect(gap.teamSize).toBe(0);
      expect(gap.persons).toHaveLength(0);
      expect(gap.requirements[0].status).toBe('missing');
    });

    it('correctly computes person gaps', async () => {
      mockGet.mockResolvedValueOnce({ id: 'init-5', title: 'PersonGap', project_id: 'proj-3' });
      mockAll.mockResolvedValueOnce([
        { id: 'r1', capability_id: 'cap-1', capability_name: 'Finance', category_name: null, min_level: 4, priority: 'required', headcount: null },
        { id: 'r2', capability_id: 'cap-2', capability_name: 'Analytics', category_name: null, min_level: 3, priority: 'nice_to_have', headcount: null },
      ]);
      mockAll.mockResolvedValueOnce([
        { user_id: 'u1', first_name: 'Eve', last_name: 'Fox', email: 'e@test.com' },
      ]);
      mockAll.mockResolvedValueOnce([
        { user_id: 'u1', capability_id: 'cap-1', level: 2 },
        { user_id: 'u1', capability_id: 'cap-2', level: 5 },
      ]);

      const gap = await computeInitiativeGap('org-1', 'init-5');

      const eve = gap.persons[0];
      expect(eve.hasProfile).toBe(true);
      expect(eve.gaps).toHaveLength(1);
      expect(eve.gaps[0].capabilityName).toBe('Finance');
      expect(eve.gaps[0].required).toBe(4);
      expect(eve.gaps[0].actual).toBe(2);
    });
  });

  describe('computeGapByCompetency', () => {
    it('aggregates gap across initiatives', async () => {
      mockAll.mockResolvedValueOnce([
        { capability_id: 'cap-1', capability_name: 'PM', category_name: 'Ops', initiative_id: 'i1', min_level: 3, headcount: 2 },
        { capability_id: 'cap-1', capability_name: 'PM', category_name: 'Ops', initiative_id: 'i2', min_level: 4, headcount: 1 },
        { capability_id: 'cap-2', capability_name: 'Finance', category_name: null, initiative_id: 'i1', min_level: 3, headcount: null },
      ]);
      mockAll.mockResolvedValueOnce([
        { capability_id: 'cap-1', user_count: 3 },
      ]);

      const result = await computeGapByCompetency('org-1');

      expect(result).toHaveLength(2);

      const pm = result.find((r) => r.capabilityId === 'cap-1');
      expect(pm?.totalDemand).toBe(3);
      expect(pm?.totalSupply).toBe(3);
      expect(pm?.initiativesCovered).toBe(2);

      const fin = result.find((r) => r.capabilityId === 'cap-2');
      expect(fin?.totalDemand).toBe(1);
      expect(fin?.totalSupply).toBe(0);
      expect(fin?.initiativesMissing).toBe(1);
    });
  });
});
