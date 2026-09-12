/** @vitest-environment jsdom */
import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    i18n: { language: 'en' },
    t: (key: string, fallback?: string) => fallback || key,
  }),
}));
vi.mock('@/services/api', () => ({ Api: { get: vi.fn(), post: vi.fn(async () => ({})) } }));
vi.mock('@/utils/enumLabel', () => ({ enumLabel: (_kind: string, value: string) => value }));
import { Api } from '@/services/api';
import { DefinitionCardContent } from '../DefinitionCardContent';
import { DefinitionApprovalContent } from '../DefinitionApprovalContent';
const deferred = () => {
  let resolve!: (v: any) => void;
  const promise = new Promise<any>((r) => {
    resolve = r;
  });
  return { promise, resolve };
};
const card = (name: string) => ({
  cardKey: 'summary-scope',
  cardVersion: 1,
  aggregateVersion: 5,
  applicability: 'REQUIRED',
  completion: 'COMPLETE',
  quality: 'SUFFICIENT',
  freshness: 'CURRENT',
  reviewState: 'ACCEPTED',
  content: { problem: name, outcome: name, inScope: ['Line'], outOfScope: ['Other'] },
  evidenceRefs: ['evidence:' + name],
  publishedBy: 'owner',
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
describe('IE00 delayed document identity', () => {
  it('late A card read cannot overwrite B or submit A content using the B URL with equal versions', async () => {
    const a = deferred(),
      b = deferred();
    vi.mocked(Api.get).mockImplementation((url: string) =>
      url.includes('/A/') ? a.promise : b.promise
    );
    const props = {
      actorId: 'owner',
      participants: [],
      canEdit: true,
      canReview: false,
      onChanged: async () => {},
    };
    const view = render(<DefinitionCardContent initiativeId="A" {...props} />);
    view.rerender(<DefinitionCardContent initiativeId="B" {...props} />);
    await act(async () => {
      b.resolve({ initiativeVersion: 5, cards: [card('B content')] });
    });
    await waitFor(() =>
      expect(screen.getByRole('textbox', { name: 'Expected outcome' })).toHaveValue(
        'B content'
      )
    );
    await act(async () => {
      a.resolve({ initiativeVersion: 5, cards: [card('A content')] });
    });
    expect(screen.getByRole('textbox', { name: 'Expected outcome' })).toHaveValue(
      'B content'
    );
    fireEvent.click(screen.getByRole('button', { name: 'Save card and request review' }));
    await waitFor(() =>
      expect(Api.post).toHaveBeenCalledWith(
        '/initiatives/runtime-v1/initiatives/B/cards/summary-scope/publications',
        expect.objectContaining({
          expectedVersion: 5,
          content: expect.objectContaining({ outcome: 'B content' }),
        })
      )
    );
  });
  it('late A approval read cannot replace the active B decision or expose A request actions under B', async () => {
    const a = deferred(),
      b = deferred();
    vi.mocked(Api.get).mockImplementation((url: string) =>
      url.endsWith('/definition-approval')
        ? url.includes('/A/')
          ? a.promise
          : b.promise
        : Promise.resolve(
            url.endsWith('/cards')
              ? { initiativeVersion: 5, cards: [] }
              : { readiness: 'READY', findings: [] }
          )
    );
    const read = (id: string) => ({
      enabled: true,
      sourceContract: 'RUNTIME_INITIATIVE_GATE',
      initiativeId: id,
      initiativeVersion: 5,
      lifecycleState: id === 'A' ? 'REGISTERED_DRAFT' : 'DEFINED',
      decision: null,
      authorities: [{ id: 'authority', name: 'Authority' }],
      participants: [],
      actorId: 'owner',
      capabilities: { request: id === 'A', decide: false, edit: false, review: false },
    });
    const view = render(<DefinitionApprovalContent initiativeId="A" />);
    view.rerender(<DefinitionApprovalContent initiativeId="B" />);
    await act(async () => {
      b.resolve(read('B'));
    });
    await screen.findByText('Initiative state: DEFINED');
    await act(async () => {
      a.resolve(read('A'));
    });
    expect(screen.getByText('Initiative state: DEFINED')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Request Definition approval' })
    ).not.toBeInTheDocument();
    expect(Api.post).not.toHaveBeenCalled();
  });
});
