import { render, screen } from '@testing-library/react';
import i18next, { type i18n } from 'i18next';
import React from 'react';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import type { GovernedChatHandoffProposal } from '@/services/api/v8/chat';

import plTranslation from '../../../../public/locales/pl/translation.json';
import { GovernedChatHandoffCard } from '../GovernedChatHandoffCard';

vi.unmock('react-i18next');

const englishFallbacks = {
  'state.pending': 'Pending review',
  'state.materializable': 'Ready to create',
  'state.working': 'Working',
  'state.materialized': 'Created',
  'state.rejected': 'Rejected',
  'state.failed': 'Action failed',
  'state.approved': 'Approved',
  title: 'Governed document proposal',
  provenance: 'Pinned to this message and its server-verified content hash.',
  citations: '{{count}} source references preserved.',
  noCitations: 'No source references were found.',
  source: 'Source',
  hash: 'Hash',
  version: 'Version',
  approve: 'Approve',
  reject: 'Reject',
  createDocument: 'Create document',
  created: 'Document created',
  rejected: 'Proposal rejected',
} as const;

const proposal = (state: GovernedChatHandoffProposal['state']): GovernedChatHandoffProposal => ({
  proposalId: `proposal-${state}`,
  producerRecordId: 'message-1',
  sourceContentHash: 'a'.repeat(64),
  sourceVersion: 1,
  targetKind: 'document',
  payload: {
    messageId: 'message-1',
    suggestedTitle: 'Treść danych fixture',
    citationStats: { totalFound: 3, verified: 2, unverified: 1 },
  },
  state,
  decidedAt: state === 'pending' ? null : '2026-08-30T12:00:00.000Z',
  updatedAt: '2026-08-30T12:00:00.000Z',
});

describe('GovernedChatHandoffCard day179 Polish translations', () => {
  let testI18n: i18n;

  beforeAll(async () => {
    testI18n = i18next.createInstance();
    await testI18n.use(initReactI18next).init({
      lng: 'pl',
      fallbackLng: false,
      resources: { pl: { translation: plTranslation } },
      interpolation: { escapeValue: false },
    });
  });

  it('resolves all 19 unique product keys without their English fallbacks', () => {
    expect(Object.keys(englishFallbacks)).toHaveLength(19);

    for (const [suffix, fallback] of Object.entries(englishFallbacks)) {
      const key = `chat.governedHandoff.${suffix}`;
      const translated = testI18n.t(key, fallback, suffix === 'citations' ? { count: 3 } : {});
      expect(translated, key).not.toBe(fallback.replace('{{count}}', '3'));
      expect(translated, key).not.toBe(key);
    }

    expect(testI18n.t('chat.governedHandoff.citations', { count: 1 })).toBe(
      'Zachowano 1 odwołanie do źródła.'
    );
    expect(testI18n.t('chat.governedHandoff.citations', { count: 3 })).toBe(
      'Zachowano 3 odwołania do źródeł.'
    );
    expect(testI18n.t('chat.governedHandoff.citations', { count: 5 })).toBe(
      'Zachowano 5 odwołań do źródeł.'
    );
  });

  it.each(['pending', 'approved', 'rejected'] as const)(
    'renders the %s state in Polish without product-label English fallbacks',
    (state) => {
      const { container } = render(
        <I18nextProvider i18n={testI18n}>
          <GovernedChatHandoffCard
            proposal={proposal(state)}
            onApprove={vi.fn()}
            onReject={vi.fn()}
            onMaterialize={vi.fn()}
          />
        </I18nextProvider>
      );

      const card = screen.getByTestId(`governed-chat-handoff-proposal-${state}`);
      expect(card).toHaveAttribute('aria-label', 'Kontrolowana propozycja dokumentu');
      expect(container.textContent).toContain('Źródło');
      expect(container.textContent).toContain('Skrót');
      expect(container.textContent).toContain('Wersja');

      for (const fallback of Object.values(englishFallbacks)) {
        expect(container.textContent).not.toContain(fallback.replace('{{count}}', '3'));
      }
    }
  );
});
