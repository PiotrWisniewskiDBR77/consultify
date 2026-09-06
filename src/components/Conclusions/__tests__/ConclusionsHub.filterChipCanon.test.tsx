/**
 * @vitest-environment jsdom
 *
 * 1.1-Z4 #2: aktywny chip filtra źródła ("Wszystkie"/`all`) w ConclusionsHub
 * miał wypełnienie mapujące się na crimson marki #85182F (pułapka #1 kanonu:
 * `docs/ui-standards/TRIADA_KANON.md` — czerwień TYLKO dla semantyki
 * krytycznej; stan aktywny chipa filtra to zwykły wybór, nie ostrzeżenie).
 * Naprawa: chip filtra korzysta z `Menu3Chip` (`@/components/shared/
 * ModuleMenu3`), którego wypełnienie aktywne jest neutralne
 * (`bg-state-selected`) — jak w innych Menu 3 tego repo.
 *
 * Asercja NEGATYWNA pilnująca braku crimson w className aktywnego chipa
 * (strażnik, nie użycie) — plik jest w `scripts/triada-allowlist.txt`, żeby
 * literał tokenu w treści testu nie łapał się jako naruszenie przez
 * check-triada.sh (ten sam wzorzec co
 * OrganizationKnowledgeGraphScreen.test.tsx).
 *
 * MUTACJA (dowód): przywrócenie crimson-owego tła w `FilterButton`
 * (ConclusionsHub.tsx) czyni ten test RED (chip aktywny znów niesie ten
 * token w className).
 */

import { render, screen } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_k: string, fallback?: string) => (typeof fallback === 'string' ? fallback : _k),
  }),
}));

const { syncMock, listMock } = vi.hoisted(() => ({
  syncMock: vi.fn(async () => ({ synced: {} })),
  listMock: vi.fn(async () => ({
    conclusions: [
      {
        id: 'c1',
        organizationId: 'org-1',
        title: 'Wniosek z narzędzia',
        statement: 'Statement 1',
        sourceModule: 'tools',
        sourceArtifactRefs: [],
        confidenceLevel: 'medium',
        limits: '',
        evidenceRefs: [],
        status: 'published',
        createdBy: 'u1',
        createdAt: '2026-09-01T00:00:00.000Z',
        updatedAt: '2026-09-01T00:00:00.000Z',
      },
      {
        id: 'c2',
        organizationId: 'org-1',
        title: 'Wniosek z oceny',
        statement: 'Statement 2',
        sourceModule: 'assessment',
        sourceArtifactRefs: [],
        confidenceLevel: 'low',
        limits: '',
        evidenceRefs: [],
        status: 'needs_review',
        createdBy: 'u1',
        createdAt: '2026-09-01T00:00:00.000Z',
        updatedAt: '2026-09-01T00:00:00.000Z',
      },
    ],
  })),
}));

vi.mock('@/services/api/conclusions.api', () => ({
  ConclusionsApi: {
    sync: syncMock,
    list: listMock,
    get: vi.fn(async () => null),
  },
}));

import ConclusionsHub from '../ConclusionsHub';

describe('ConclusionsHub — kanon chipa filtra źródła (Menu 3, DEC-415/416)', () => {
  it('aktywny chip "Wszystkie" nie niesie crimson (c-accent/primary-) i używa neutralnego stanu wybranego', async () => {
    render(
      <MemoryRouter initialEntries={['/conclusions']}>
        <ConclusionsHub />
      </MemoryRouter>
    );

    const allChip = await screen.findByRole('button', { name: 'All' });
    expect(allChip.className).not.toContain('c-accent');
    expect(allChip.className).not.toMatch(/primary-/);
    expect(allChip.className).toContain('state-selected');
    expect(allChip).toHaveAttribute('aria-pressed', 'true');
  });
});
