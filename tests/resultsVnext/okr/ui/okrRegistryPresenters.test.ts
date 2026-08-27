import { describe, expect, it, vi } from 'vitest';

import { buildOkrSetRowMenu } from '../../../../src/components/ResultsVNext/okr/okrRegistryPresenters';
import type { OkrSetDto } from '../../../../src/components/ResultsVNext/okr/okrApi';

describe('OKR registry — concise owner-approved row menu', () => {
  it('shows executable navigation and preview without fake disabled Edit or Archive actions', () => {
    const row = { setId: 'set-1', status: 'submitted' } as OkrSetDto;
    const menu = buildOkrSetRowMenu(row, true, {
      onPreview: vi.fn(),
      onOpenWorkspace: vi.fn(),
      onOpenObjectives: vi.fn(),
    });

    expect(menu.primary?.map((action) => action.label)).toEqual(['Otwórz', 'Cele (Objectives)']);
    expect(menu.statusTransitions).toEqual([]);
    expect(menu.universalHandlers).toEqual({ preview: expect.any(Function) });
  });
});
