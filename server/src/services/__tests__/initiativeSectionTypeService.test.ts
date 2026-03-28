import { beforeEach, describe, expect, it, vi } from 'vitest';

const { dbAllMock } = vi.hoisted(() => ({
  dbAllMock: vi.fn(),
}));

vi.mock('../../database/Database.js', () => ({
  getDatabase: vi.fn(() => ({})),
}));

vi.mock('../../utils/DbPromise.js', () => ({
  default: {
    all: dbAllMock,
  },
}));

import { InitiativeSectionTypeService } from '../initiativeSectionTypeService.js';

describe('InitiativeSectionTypeService', () => {
  beforeEach(() => {
    dbAllMock.mockReset();
  });

  it('returns an empty list when initiative section types table is missing', async () => {
    dbAllMock.mockRejectedValueOnce(
      new Error('SQLITE_ERROR: no such table: initiative_section_types')
    );

    const service = new InitiativeSectionTypeService();

    await expect(service.getAllSectionTypes('org-1')).resolves.toEqual([]);
  });

  it('filters active section types in memory to avoid boolean drift across databases', async () => {
    dbAllMock.mockResolvedValueOnce([
      {
        id: 'section-1',
        organization_id: null,
        key: 'overview',
        name: 'Overview',
        category: 'content',
        column_position: 'left',
        default_order: 10,
        component_key: 'OverviewSection',
        is_system: 1,
        is_active: 1,
        created_at: '2026-03-28T00:00:00.000Z',
        updated_at: '2026-03-28T00:00:00.000Z',
      },
      {
        id: 'section-2',
        organization_id: null,
        key: 'legacy',
        name: 'Legacy',
        category: 'content',
        column_position: 'left',
        default_order: 20,
        component_key: 'LegacySection',
        is_system: 1,
        is_active: 0,
        created_at: '2026-03-28T00:00:00.000Z',
        updated_at: '2026-03-28T00:00:00.000Z',
      },
    ]);

    const service = new InitiativeSectionTypeService();
    const result = await service.getAllSectionTypes('org-1');

    expect(result.map((item) => item.id)).toEqual(['section-1']);
    expect(String(dbAllMock.mock.calls[0]?.[1] || '')).not.toContain('is_active = 1');
  });
});
