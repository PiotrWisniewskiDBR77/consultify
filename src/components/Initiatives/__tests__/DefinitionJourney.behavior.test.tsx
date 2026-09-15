/** @vitest-environment jsdom */
import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    i18n: { language: 'en' },
    t: (key: string, fallback?: string) => fallback || key,
  }),
}));
vi.mock('@/services/api', () => ({ Api: { get: vi.fn(), post: vi.fn() } }));
vi.mock('@/utils/enumLabel', () => ({ enumLabel: (_kind: string, value: string) => value }));
import { Api } from '@/services/api';
import { DefinitionApprovalContent } from '../DefinitionApprovalContent';
import { DefinitionCardContent } from '../DefinitionCardContent';
const initialCards = () => [
  {
    cardKey: 'summary-scope',
    cardVersion: 1,
    applicability: 'REQUIRED',
    completion: 'IN_PROGRESS',
    quality: 'UNKNOWN',
    freshness: 'CURRENT',
    reviewState: 'REQUESTED',
    content: {
      problem: 'Existing problem',
      outcome: 'Existing outcome',
      inScope: ['Line A'],
      outOfScope: ['Other'],
    },
    evidenceRefs: ['source:1'],
    estimate: { value: '40–60 h', basis: 'Current scope and named team' },
    estimatedBy: 'owner',
    estimatedAt: '2026-09-15T12:00:00.000Z',
    publishedBy: 'owner',
  },
  {
    cardKey: 'strategic-fit',
    cardVersion: 1,
    applicability: 'REQUIRED',
    completion: 'IN_PROGRESS',
    quality: 'UNKNOWN',
    freshness: 'CURRENT',
    reviewState: 'REQUESTED',
    content: { objectives: ['Existing objective'], rationale: 'Existing rationale' },
    evidenceRefs: ['source:2'],
    estimate: null,
    estimatedBy: null,
    estimatedAt: null,
    publishedBy: 'owner',
  },
];
let persisted = initialCards();
let version = 5;
beforeEach(() => {
  persisted = initialCards();
  version = 5;
  vi.mocked(Api.get).mockImplementation(async (url: string) => {
    if (url.endsWith('/definition-approval'))
      return {
        enabled: true,
        initiativeId: 'A',
        initiativeVersion: version,
        lifecycleState: 'REGISTERED_DRAFT',
        decision: null,
        authorities: [],
        participants: [],
        actorId: 'owner',
        capabilities: { edit: true, review: false, request: true, decide: false },
      };
    if (url.endsWith('/readiness'))
      return {
        readiness: 'NOT_READY',
        findings: [
          {
            findingId: 'definition:summary-scope:FIELD_REQUIRED:outcome',
            cardKey: 'summary-scope',
            severity: 'BLOCKER',
            rule: 'FIELD_REQUIRED:outcome',
            message: 'Define the expected outcome before requesting approval.',
          },
        ],
      };
    return { initiativeVersion: version, cards: structuredClone(persisted) };
  });
  vi.mocked(Api.post).mockImplementation(async (url: string, payload: any) => {
    const key = url.split('/cards/')[1]?.split('/')[0];
    persisted = persisted.map((card) =>
      card.cardKey === key
        ? { ...card, ...structuredClone(payload), cardVersion: card.cardVersion + 1 }
        : card
    );
    version += 1;
    return { status: 'APPLIED', aggregateVersion: version };
  });
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.unstubAllEnvs();
});
describe('IE01 Definition journey', () => {
  it('shows the persisted card estimate and a disabled approval action to an unauthorized viewer', async () => {
    vi.stubEnv('VITE_INITIATIVES_PORTFOLIO_ANALYSIS', 'true');
    render(
      <DefinitionCardContent
        initiativeId="A"
        actorId="viewer"
        participants={[]}
        canEdit={false}
        canReview={false}
        selectedCardKey="summary-scope"
        onChanged={async () => {}}
      />
    );
    const estimate = await screen.findByRole('textbox', { name: 'Estimate' });
    await waitFor(() => expect(estimate).toHaveValue('40–60 h'));
    expect(screen.getByText('You do not have permission to approve this card.')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Accept card content' })).toBeDisabled();
    expect(Api.post).not.toHaveBeenCalled();
  });

  it('publishes the estimate through the existing canonical card command', async () => {
    vi.stubEnv('VITE_INITIATIVES_PORTFOLIO_ANALYSIS', 'true');
    render(
      <DefinitionCardContent
        initiativeId="A"
        actorId="owner"
        participants={[]}
        canEdit
        canReview={false}
        selectedCardKey="summary-scope"
        onChanged={async () => {}}
      />
    );
    const estimate = await screen.findByRole('textbox', { name: 'Estimate' });
    fireEvent.change(estimate, { target: { value: '64 h' } });
    fireEvent.change(screen.getByRole('textbox', { name: 'Estimate basis' }), {
      target: { value: 'Four workshops and synthesis' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save card and request review' }));
    await waitFor(() =>
      expect(Api.post).toHaveBeenCalledWith(
        expect.stringContaining('/summary-scope/publications'),
        expect.objectContaining({
          estimate: { value: '64 h', basis: 'Four workshops and synthesis' },
        })
      )
    );
  });

  it('shows the exact blocker and opens its affected outcome field without any write', async () => {
    render(<DefinitionApprovalContent initiativeId="A" />);
    const finding = await screen.findByRole('button', {
      name: /Define the expected outcome before requesting approval/,
    });
    fireEvent.click(finding);
    await waitFor(() =>
      expect(screen.getByRole('textbox', { name: 'Expected outcome' })).toHaveFocus()
    );
    expect(Api.post).not.toHaveBeenCalled();
  });
  it('preserves unsent scope draft while another card is saved and refreshed, then submits only the chosen card', async () => {
    render(
      <DefinitionCardContent
        initiativeId="A"
        actorId="owner"
        participants={[]}
        canEdit
        canReview={false}
        onChanged={async () => {}}
      />
    );
    const outcome = await screen.findByRole('textbox', { name: 'Expected outcome' });
    await waitFor(() => expect(outcome).toHaveValue('Existing outcome'));
    fireEvent.change(outcome, { target: { value: 'Unsent outcome revision' } });
    fireEvent.change(screen.getByRole('combobox', { name: 'Card' }), {
      target: { value: 'strategic-fit' },
    });
    fireEvent.change(screen.getByRole('textbox', { name: 'Rationale' }), {
      target: { value: 'New strategic rationale' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save card and request review' }));
    await waitFor(() => expect(Api.post).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Save card and request review' })
      ).not.toBeDisabled()
    );
    expect(persisted[0].content.outcome).toBe('Existing outcome');
    expect(persisted[1].content.rationale).toBe('New strategic rationale');
    fireEvent.change(screen.getByRole('combobox', { name: 'Card' }), {
      target: { value: 'summary-scope' },
    });
    expect(screen.getByRole('textbox', { name: 'Expected outcome' })).toHaveValue(
      'Unsent outcome revision'
    );
    fireEvent.click(screen.getByRole('button', { name: 'Save card and request review' }));
    await waitFor(() => expect(Api.post).toHaveBeenCalledTimes(2));
    expect(Api.post).toHaveBeenLastCalledWith(
      '/initiatives/runtime-v1/initiatives/A/cards/summary-scope/publications',
      expect.objectContaining({
        expectedVersion: 6,
        expectedCardVersion: 1,
        content: expect.objectContaining({ outcome: 'Unsent outcome revision' }),
      })
    );
  });
  it('keeps a rejected section draft visible and unsaved, without mutating the last published content', async () => {
    render(
      <DefinitionCardContent
        initiativeId="A"
        actorId="owner"
        participants={[]}
        canEdit
        canReview={false}
        onChanged={async () => {}}
      />
    );
    await waitFor(() =>
      expect(screen.getByRole('textbox', { name: 'Expected outcome' })).toHaveValue(
        'Existing outcome'
      )
    );
    fireEvent.change(screen.getByRole('textbox', { name: 'Expected outcome' }), {
      target: { value: 'Conflicting local outcome' },
    });
    vi.mocked(Api.post).mockRejectedValueOnce(new Error('Card version conflict'));
    fireEvent.click(screen.getByRole('button', { name: 'Save card and request review' }));
    await screen.findByRole('alert');
    expect(screen.getByRole('textbox', { name: 'Expected outcome' })).toHaveValue(
      'Conflicting local outcome'
    );
    expect(screen.getByRole('status', { name: 'Card save state' })).toHaveTextContent(
      'Unsaved draft'
    );
    expect(persisted[0].content.outcome).toBe('Existing outcome');
  });
  it('requires publishing an edited reviewer draft before accepting the card, preserving independent review semantics', async () => {
    render(
      <DefinitionCardContent
        initiativeId="A"
        actorId="reviewer"
        participants={[]}
        canEdit
        canReview
        onChanged={async () => {}}
      />
    );
    await waitFor(() =>
      expect(screen.getByRole('textbox', { name: 'Expected outcome' })).toHaveValue(
        'Existing outcome'
      )
    );
    fireEvent.change(screen.getByRole('textbox', { name: 'Review rationale' }), {
      target: { value: 'Reviewed against source' },
    });
    expect(screen.getByRole('button', { name: 'Accept card content' })).not.toBeDisabled();
    fireEvent.change(screen.getByRole('textbox', { name: 'Expected outcome' }), {
      target: { value: 'Reviewer proposed outcome' },
    });
    expect(screen.getByRole('button', { name: 'Accept card content' })).toBeDisabled();
    expect(Api.post).not.toHaveBeenCalled();
  });
  it('preserves a draft across section unmounts while keeping another actor isolated', async () => {
    const draftStore = { current: {} };
    const props = { initiativeId: 'A', actorId: 'owner', participants: [], canEdit: true, canReview: false, onChanged: async () => {}, draftStore };
    const first = render(<DefinitionCardContent {...props} selectedCardKey="summary-scope" />);
    await waitFor(() => expect(screen.getByRole('textbox', { name: 'Expected outcome' })).toHaveValue('Existing outcome'));
    fireEvent.change(screen.getByRole('textbox', { name: 'Expected outcome' }), { target: { value: 'Draft retained across real section unmount' } });
    first.unmount();
    const second = render(<DefinitionCardContent {...props} selectedCardKey="summary-scope" />);
    await waitFor(() => expect(screen.getByRole('textbox', { name: 'Expected outcome' })).toHaveValue('Draft retained across real section unmount'));
    second.unmount();
    render(<DefinitionCardContent {...props} actorId="other-actor" selectedCardKey="summary-scope" />);
    await waitFor(() => expect(screen.getByRole('textbox', { name: 'Expected outcome' })).toHaveValue('Existing outcome'));
    expect(Api.post).not.toHaveBeenCalled();
  });

  it('blocks editing until the first canonical card read resolves, then publishes against the loaded card version', async () => {
    let resolve!: (value: any) => void;
    vi.mocked(Api.get).mockImplementationOnce(() => new Promise(done => { resolve=done; }));
    render(<DefinitionCardContent initiativeId="A" actorId="owner" participants={[]} canEdit canReview={false} selectedCardKey="summary-scope" onChanged={async()=>{}} />);
    const outcome=screen.getByRole('textbox',{name:'Expected outcome'});
    expect(outcome).toBeDisabled();
    expect(screen.getByRole('button',{name:'Save card and request review'})).toBeDisabled();
    await act(async()=>{resolve({initiativeVersion:5,cards:structuredClone(persisted)});});
    await waitFor(()=>expect(outcome).toHaveValue('Existing outcome'));
    expect(outcome).toBeEnabled();
    fireEvent.change(outcome,{target:{value:'Updated after read'}});
    fireEvent.click(screen.getByRole('button',{name:'Save card and request review'}));
    await waitFor(()=>expect(Api.post).toHaveBeenCalledWith(expect.stringContaining('/summary-scope/publications'),expect.objectContaining({expectedVersion:5,expectedCardVersion:1,content:expect.objectContaining({outcome:'Updated after read'})})));
  });

});
