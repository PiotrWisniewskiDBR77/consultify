/**
 * @vitest-environment jsdom
 *
 * Regression coverage for the RowList generic-collapse bug in
 * `IdeaBusinessCaseSection.tsx` (Program D / epic E08, §6.2 business-case
 * schema). Before the fix, `RowList<T>`'s `newRow: () => T` let a fresh
 * object literal narrower than the row type (e.g. `{ metric: '' }` for
 * `BusinessCaseBaselineMetric`) win type inference for `T`, which silently
 * dropped 'value'/'unit'/'source'/'impact' from every `update()` call's
 * accepted patch shape at the TYPE level (TS2339/TS2353 at
 * IdeaBusinessCaseSection.tsx:601-614, 772-773, 1008-1009).
 *
 * Investigation confirmed there was NO actual runtime data loss (the
 * `update()` closure does a plain `{ ...row, ...patch }` JS spread — types
 * are erased at runtime, and the server's `content: z.unknown()` schema
 * never re-validates the shape — see task report). These tests exist to
 * guard the RUNTIME round trip regardless, and the type hole itself is
 * guarded by keeping `newRow: () => NoInfer<T>` in `RowList`'s signature
 * (verified separately via a scoped `tsc` check — removing `NoInfer`
 * reproduces exactly the five errors above).
 *
 * Each test: open a section -> add a row -> edit ALL of its fields via the
 * real DOM inputs -> click "Save section" -> wait for the mocked
 * PUT round trip -> assert (a) the network call carried every field, and
 * (b) the component's OWN state (the `draft` reset off `businessCase`
 * after a successful save, per `IdeaBusinessCaseSection.tsx`'s
 * `useEffect(() => setDraft(businessCase.sections), [businessCase.updatedAt])`)
 * still shows every field in the re-rendered inputs — a genuine
 * edit -> save -> read-back path, not just an assertion on mock call args.
 */
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { EMPTY_SELECTION } from '../ideaSelectionTypes';

let saveCallCount = 0;
const upsertMock = vi.fn(async (ideaId: string, body: Record<string, any>) => {
  saveCallCount += 1;
  const key = Object.keys(body)[0];
  const patch = body[key];
  const stamp = `2026-01-01T00:00:${String(saveCallCount).padStart(2, '0')}.000Z`;
  return {
    id: 'bc-1',
    ideaId,
    organizationId: 'org-1',
    version: saveCallCount,
    createdBy: 'user-1',
    updatedBy: 'user-1',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: stamp,
    // Server-echo: exactly what was sent, wrapped in a full section envelope
    // (mirrors ideaBusinessCaseService's "PUT replaces what you send"
    // contract — content: z.unknown() server-side, no re-validation).
    sections: {
      [key]: {
        content: patch.content,
        lineage: patch.lineage ?? [],
        claims: patch.claims ?? [],
        meta: {
          authoredBy: 'user',
          acceptedBy: null,
          acceptedAt: null,
          updatedBy: 'user-1',
          updatedAt: stamp,
        },
      },
    },
  };
});

vi.mock('@/services/api/ideaBusinessCase.api', () => ({
  fetchIdeaBusinessCase: vi.fn(async () => null),
  upsertIdeaBusinessCase: (...args: [string, Record<string, any>]) => upsertMock(...args),
}));

vi.mock('@/services/api/evidence.api', () => ({
  fetchEvidenceEnvelope: vi.fn(async () => null),
  upsertEvidenceEnvelope: vi.fn(async () => ({})),
}));

import { IdeaBusinessCaseSection } from '../panel/IdeaBusinessCaseSection';

function baseProps() {
  return {
    ideaId: 'idea-1',
    tool: 'whiteboard' as const,
    selection: EMPTY_SELECTION,
    graphNodes: [] as any[],
    isPolish: true,
  };
}

/** Opens a SubCard by its title text and returns the card's own container for scoped queries. */
async function openCard(titleText: string): Promise<HTMLElement> {
  const titleEl = await screen.findByText(titleText);
  const headerButton = titleEl.closest('button');
  if (!headerButton) throw new Error(`No header button found for "${titleText}"`);
  fireEvent.click(headerButton);
  const card = headerButton.parentElement;
  if (!card) throw new Error(`No card container found for "${titleText}"`);
  return card as HTMLElement;
}

describe('IdeaBusinessCaseSection — RowList round trip (no silent field loss)', () => {
  beforeEach(() => {
    upsertMock.mockClear();
    saveCallCount = 0;
  });

  it('problem/baseline: value, unit AND source all survive add-row -> edit -> save -> read back', async () => {
    render(<IdeaBusinessCaseSection {...baseProps()} />);
    const card = await openCard('1. Problem i punkt odniesienia');

    fireEvent.click(within(card).getByRole('button', { name: /Dodaj miernik/i }));

    fireEvent.change(within(card).getByPlaceholderText('Miernik'), {
      target: { value: 'Adopcja' },
    });
    fireEvent.change(within(card).getByPlaceholderText('Wartość'), {
      target: { value: '42' },
    });
    fireEvent.change(within(card).getByPlaceholderText('Jednostka'), {
      target: { value: '%' },
    });
    fireEvent.change(within(card).getByPlaceholderText('Źródło'), {
      target: { value: 'CRM' },
    });

    fireEvent.click(within(card).getByRole('button', { name: /Zapisz sekcję/i }));

    await waitFor(() => expect(upsertMock).toHaveBeenCalledTimes(1));
    const [, body] = upsertMock.mock.calls[0];
    expect(body.problemBaseline.content.baseline).toEqual([
      { metric: 'Adopcja', value: '42', unit: '%', source: 'CRM' },
    ]);

    // Read back from the component's own post-save state (draft reset off
    // `businessCase.updatedAt`) — the inputs must still show every field.
    await waitFor(() => {
      expect(within(card).getByPlaceholderText('Miernik')).toHaveValue('Adopcja');
    });
    expect(within(card).getByPlaceholderText('Wartość')).toHaveValue('42');
    expect(within(card).getByPlaceholderText('Jednostka')).toHaveValue('%');
    expect(within(card).getByPlaceholderText('Źródło')).toHaveValue('CRM');
  });

  it('stakeholders & processes: an affected process keeps "impact" through the same round trip', async () => {
    render(<IdeaBusinessCaseSection {...baseProps()} />);
    const card = await openCard('3. Interesariusze i procesy');

    fireEvent.click(within(card).getByRole('button', { name: /Dodaj proces/i }));

    fireEvent.change(within(card).getByPlaceholderText('Proces'), {
      target: { value: 'Onboarding klienta' },
    });
    fireEvent.change(within(card).getByPlaceholderText('Wpływ'), {
      target: { value: 'Krok 3 wydłużony o 2 dni' },
    });

    fireEvent.click(within(card).getByRole('button', { name: /Zapisz sekcję/i }));

    await waitFor(() => expect(upsertMock).toHaveBeenCalledTimes(1));
    const [, body] = upsertMock.mock.calls[0];
    expect(body.stakeholdersProcesses.content.affectedProcesses).toEqual([
      { name: 'Onboarding klienta', impact: 'Krok 3 wydłużony o 2 dni' },
    ]);

    await waitFor(() => {
      expect(within(card).getByPlaceholderText('Proces')).toHaveValue('Onboarding klienta');
    });
    expect(within(card).getByPlaceholderText('Wpływ')).toHaveValue('Krok 3 wydłużony o 2 dni');
  });

  it('benefits & disbenefits: a disbenefit keeps "value" through the same round trip', async () => {
    render(<IdeaBusinessCaseSection {...baseProps()} />);
    const card = await openCard('7. Korzyści i utracone korzyści');

    // Disbenefits' add button label is the generic "Dodaj" (benefits' own is
    // "Dodaj korzyść") — scope to the exact accessible name to avoid picking
    // the sibling RowList's button.
    fireEvent.click(within(card).getByRole('button', { name: 'Dodaj' }));

    fireEvent.change(within(card).getByPlaceholderText('Opis'), {
      target: { value: 'Utrata przychodu w Q1' },
    });
    fireEvent.change(within(card).getByPlaceholderText('Wartość'), {
      target: { value: '-15000 PLN' },
    });

    fireEvent.click(within(card).getByRole('button', { name: /Zapisz sekcję/i }));

    await waitFor(() => expect(upsertMock).toHaveBeenCalledTimes(1));
    const [, body] = upsertMock.mock.calls[0];
    expect(body.benefitsDisbenefits.content.disbenefits).toEqual([
      { description: 'Utrata przychodu w Q1', value: '-15000 PLN' },
    ]);

    await waitFor(() => {
      expect(within(card).getByPlaceholderText('Opis')).toHaveValue('Utrata przychodu w Q1');
    });
    expect(within(card).getByPlaceholderText('Wartość')).toHaveValue('-15000 PLN');
  });
});
