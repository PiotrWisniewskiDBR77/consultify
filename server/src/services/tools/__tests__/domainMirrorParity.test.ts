import { describe, expect, it } from 'vitest';

import {
  evaluateSwotAcceptGate as evaluateClientGate,
  stampAcceptedSwotItem as stampClientItem,
} from '../../../../../src/config/swot/swotAcceptGate.js';
import { buildSwotOutput as buildClientOutput } from '../../../../../src/toolOutputs/buildSwotOutput.js';
import {
  evaluateSwotAcceptGate as evaluateServerGate,
  stampAcceptedSwotItem as stampServerItem,
} from '../domain/swotAcceptGate.js';
import { buildSwotOutput as buildServerOutput } from '../domain/buildSwotOutput.js';

const acceptedItems = [
  {
    id: 'strength-1',
    text: 'Silna baza klientów',
    impact: 'high' as const,
    quadrant: 'strengths' as const,
    proposalStatus: 'accepted' as const,
    evidenceStatus: 'confirmed' as const,
    evidenceType: 'fact' as const,
    linkedSignalIds: ['signal-1'],
  },
  {
    id: 'opportunity-1',
    text: 'Rosnący segment rynku',
    impact: 'medium' as const,
    quadrant: 'opportunities' as const,
    proposalStatus: 'accepted' as const,
    evidenceStatus: 'declared' as const,
  },
];

describe('server-owned SWOT/Tool Output domain parity', () => {
  it('returns the same accept verdict and authoritative evidence stamp', () => {
    const candidate = {
      text: 'Silna baza klientów',
      quadrant: 'strengths',
      linkedSignalIds: ['signal-1'],
      evidenceStatus: 'missing',
    };

    const serverGate = evaluateServerGate(candidate);
    const clientGate = evaluateClientGate(candidate);
    expect(serverGate).toEqual(clientGate);
    expect(serverGate.ok).toBe(true);
    expect(clientGate.ok).toBe(true);
    if (!serverGate.ok || !clientGate.ok) throw new Error('fixture must pass the accept gate');
    expect(stampServerItem(candidate, serverGate)).toEqual(stampClientItem(candidate, clientGate));
  });

  it('builds byte-equivalent deterministic Output content and hash', () => {
    const input = {
      id: 'output-1',
      organizationId: 'org-1',
      toolSessionId: 'session-1',
      methodPackVersion: 'dynamic-swot@1',
      title: 'Strategiczny SWOT',
      createdAt: '2026-08-14T00:00:00.000Z',
      items: acceptedItems,
      tensions: [
        {
          id: 'tension-1',
          title: 'Wykorzystać bazę klientów do ekspansji',
          type: 'attack' as const,
          linkedCorrelationIds: [],
          linkedItemIds: ['strength-1', 'opportunity-1'],
          insight: 'Przewaga dystrybucyjna przyspiesza wejście.',
          proposalStatus: 'accepted' as const,
        },
      ],
      moves: [
        {
          id: 'move-1',
          title: 'Uruchomić pilotaż',
          category: 'quick-win' as const,
          rationale: 'Tension 1 uzasadnia pilotaż.',
          linkedTensionIds: ['tension-1'],
          linkedItemIds: ['strength-1', 'opportunity-1'],
          expectedImpact: 'high' as const,
          estimatedEffort: 'medium' as const,
          firstStep: 'Wybrać segment i właściciela',
          tradeoff: { chosen: 'Pilotaż', deferred: 'Pełne wdrożenie', cost: 'Dwa tygodnie' },
          rejectedAlternative: { option: 'Pełny rollout', reason: 'Brak walidacji popytu' },
          ownerRole: 'Head of Growth',
        },
      ],
    };

    expect(buildServerOutput(input)).toEqual(buildClientOutput(input));
  });
});
