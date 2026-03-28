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
});
