/**
 * Contract tests for competencyTaxonomyService.
 * Validates the service layer logic for categories, levels, and requirements.
 * Uses mocked DB calls.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../../server/src/utils/DbPromise.js', () => ({
  all: vi.fn(),
  get: vi.fn(),
  run: vi.fn(),
}));

vi.mock('uuid', () => ({
  v4: () => 'test-uuid-001',
}));

import * as DbPromise from '../../../../server/src/utils/DbPromise.js';
import {
  createCategory,
  getCategories,
  getLevels,
  seedDefaultLevels,
  getCompetenciesWithStats,
  getInitiativeRequirements,
  addInitiativeRequirement,
  deleteInitiativeRequirement,
} from '../../../../server/src/services/competencyTaxonomyService.js';

const mockAll = DbPromise.all as any;
const mockGet = DbPromise.get as any;
const mockRun = DbPromise.run as any;

describe('competencyTaxonomyService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getCategories', () => {
    it('returns mapped categories for an organization', async () => {
      mockAll.mockResolvedValue([
        {
          id: 'cat-1',
          organization_id: 'org-1',
          name: 'Strategy',
          name_pl: 'Strategia',
          description: null,
          description_pl: null,
          icon: 'Target',
          color: '#8b5cf6',
          sort_order: 1,
          is_system: false,
          is_active: true,
          created_by: null,
          created_at: '2026-01-01',
          updated_at: '2026-01-01',
        },
      ]);

      const categories = await getCategories('org-1');
      expect(categories).toHaveLength(1);
      expect(categories[0].name).toBe('Strategy');
      expect(categories[0].namePl).toBe('Strategia');
      expect(categories[0].icon).toBe('Target');
      expect(mockAll).toHaveBeenCalledWith(
        expect.stringContaining('WHERE organization_id = $1'),
        ['org-1']
      );
    });
  });

  describe('createCategory', () => {
    it('inserts a category and returns it', async () => {
      mockRun.mockResolvedValue(undefined);
      mockGet.mockResolvedValue({
        id: 'test-uuid-001',
        organization_id: 'org-1',
        name: 'Digital',
        name_pl: 'Cyfryzacja',
        description: null,
        description_pl: null,
        icon: 'Cpu',
        color: '#06b6d4',
        sort_order: 3,
        is_system: false,
        is_active: true,
        created_by: 'user-1',
        created_at: '2026-01-01',
        updated_at: '2026-01-01',
      });

      const cat = await createCategory('org-1', {
        name: 'Digital',
        namePl: 'Cyfryzacja',
        icon: 'Cpu',
        color: '#06b6d4',
        sortOrder: 3,
        createdBy: 'user-1',
      });

      expect(cat.name).toBe('Digital');
      expect(cat.namePl).toBe('Cyfryzacja');
      expect(mockRun).toHaveBeenCalledTimes(1);
      expect(mockRun).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO competency_categories'),
        expect.arrayContaining(['test-uuid-001', 'org-1', 'Digital', 'Cyfryzacja'])
      );
    });
  });

  describe('getLevels', () => {
    it('returns ordered levels', async () => {
      mockAll.mockResolvedValue([
        { id: 'l1', organization_id: 'org-1', level_value: 1, label: 'Novice', label_pl: 'Początkujący', description: null, description_pl: null, is_system: true, created_at: '2026-01-01' },
        { id: 'l2', organization_id: 'org-1', level_value: 2, label: 'Beginner', label_pl: 'Podstawowy', description: null, description_pl: null, is_system: true, created_at: '2026-01-01' },
      ]);

      const levels = await getLevels('org-1');
      expect(levels).toHaveLength(2);
      expect(levels[0].levelValue).toBe(1);
      expect(levels[0].label).toBe('Novice');
    });
  });

  describe('seedDefaultLevels', () => {
    it('returns existing levels if already populated', async () => {
      mockAll.mockResolvedValue([
        { id: 'l1', organization_id: 'org-1', level_value: 1, label: 'Custom', label_pl: null, description: null, description_pl: null, is_system: false, created_at: '2026-01-01' },
      ]);

      const levels = await seedDefaultLevels('org-1');
      expect(levels).toHaveLength(1);
      expect(levels[0].label).toBe('Custom');
      expect(mockRun).not.toHaveBeenCalled();
    });
  });

  describe('getCompetenciesWithStats', () => {
    it('joins with categories and usage stats', async () => {
      mockAll.mockResolvedValue([
        {
          id: 'c1',
          organization_id: 'org-1',
          name: 'Project Management',
          description: 'Managing projects',
          domain: 'general',
          category_id: 'cat-1',
          category_name: 'Operations',
          tags: '[]',
          is_active: true,
          initiative_count: 3,
          user_count: 5,
          created_at: '2026-01-01',
          updated_at: '2026-01-01',
        },
      ]);

      const comps = await getCompetenciesWithStats('org-1');
      expect(comps).toHaveLength(1);
      expect(comps[0].name).toBe('Project Management');
      expect(comps[0].categoryName).toBe('Operations');
      expect(comps[0].initiativeCount).toBe(3);
      expect(comps[0].userCount).toBe(5);
    });
  });

  describe('getInitiativeRequirements', () => {
    it('returns expanded requirements with capability names', async () => {
      mockAll.mockResolvedValue([
        {
          id: 'r1',
          organization_id: 'org-1',
          initiative_id: 'init-1',
          capability_id: 'c1',
          capability_name: 'Project Management',
          category_name: 'Operations',
          min_level: 3,
          priority: 'required',
          headcount: 2.0,
          justification: 'Critical for delivery',
          notes: null,
          created_by: 'user-1',
          created_at: '2026-01-01',
        },
      ]);

      const reqs = await getInitiativeRequirements('org-1', 'init-1');
      expect(reqs).toHaveLength(1);
      expect(reqs[0].capabilityName).toBe('Project Management');
      expect(reqs[0].minLevel).toBe(3);
      expect(reqs[0].priority).toBe('required');
      expect(reqs[0].headcount).toBe(2.0);
    });
  });

  describe('addInitiativeRequirement', () => {
    it('inserts a requirement and returns expanded result', async () => {
      mockRun.mockResolvedValue(undefined);
      mockGet.mockResolvedValue({
        id: 'test-uuid-001',
        organization_id: 'org-1',
        initiative_id: 'init-1',
        capability_id: 'c1',
        capability_name: 'Lean Six Sigma',
        category_name: 'Operations',
        min_level: 4,
        priority: 'nice_to_have',
        headcount: 1.0,
        justification: 'Process improvement',
        notes: null,
        created_by: 'user-1',
        created_at: '2026-01-01',
      });

      const req = await addInitiativeRequirement('org-1', {
        initiativeId: 'init-1',
        capabilityId: 'c1',
        minLevel: 4,
        priority: 'nice_to_have',
        headcount: 1.0,
        justification: 'Process improvement',
        createdBy: 'user-1',
      });

      expect(req.capabilityName).toBe('Lean Six Sigma');
      expect(req.minLevel).toBe(4);
      expect(req.priority).toBe('nice_to_have');
      expect(mockRun).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO capability_requirements'),
        expect.any(Array)
      );
    });
  });

  describe('deleteInitiativeRequirement', () => {
    it('deletes a requirement by id and org', async () => {
      mockRun.mockResolvedValue(undefined);

      await deleteInitiativeRequirement('org-1', 'r1');

      expect(mockRun).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM capability_requirements'),
        ['r1', 'org-1']
      );
    });
  });
});
