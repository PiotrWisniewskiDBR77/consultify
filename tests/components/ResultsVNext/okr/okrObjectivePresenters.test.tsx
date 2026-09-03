import { describe, expect, it, vi } from 'vitest';

import { buildOkrObjectivePreview } from '../../../../src/components/ResultsVNext/okr/okrObjectivePresenters';

describe('buildOkrObjectivePreview', () => {
  // Scalenie 2026-09-03: patrz komentarz w okrKeyResultPresenters.test.tsx —
  // gwarancja demo zachowana, mechanizm nasz (nazwisko zamiast "You").
  it('never exposes a raw owner UUID in the business preview', () => {
    const currentUserId = 'd2b6a316-08c5-47cf-9bf7-4ba50311d5a2';
    const preview = buildOkrObjectivePreview(
      {
        objectiveId: 'objective-1',
        title: 'Potwierdzić mierzalne rezultaty transformacji',
        ownerUserId: currentUserId,
        status: 'active',
        ambitionType: 'committed',
        progress: 58,
        confidence: 'medium',
        keyResults: [],
        createdAt: '2026-08-13T00:00:00.000Z',
        updatedAt: '2026-08-13T00:00:00.000Z',
      } as any,
      {
        isPolish: false,
        parentSetStatus: 'active',
        resolveMemberName: (userId: string) =>
          userId === currentUserId ? 'Anna Kowalska' : null,
        onClose: vi.fn(),
        onOpenKeyResults: vi.fn(),
        onEdit: vi.fn(),
        onCancel: vi.fn(),
      }
    );

    const owner = preview.details?.properties?.find((property) => property.id === 'owner');
    expect(owner?.value).toBe('Anna Kowalska');
    expect(JSON.stringify(preview.details)).not.toContain(currentUserId);
  });
});
