import { describe, expect, it } from 'vitest';

import type { SWOTItem, SWOTMove, SWOTTension } from '@/store/useToolStore';

import { buildSwotOutput, odmienNapiecia } from '../buildSwotOutput';
import { approve, submitForReview } from '../outputLifecycle';
import { renderToolReport } from '../renderReport';

function item(over: Partial<SWOTItem> & Pick<SWOTItem, 'id' | 'quadrant'>): SWOTItem {
  return {
    text: `pozycja ${over.id}`,
    impact: 'high',
    proposalStatus: 'accepted',
    evidenceStatus: 'confirmed',
    ...over,
  } as SWOTItem;
}

function tension(over: Partial<SWOTTension> & Pick<SWOTTension, 'id' | 'linkedItemIds'>): SWOTTension {
  return {
    title: `napięcie ${over.id}`,
    type: 'attack',
    linkedCorrelationIds: [],
    insight: 'insight',
    ...over,
  } as SWOTTension;
}

/** Ruch spełniający bramkę W2 — komplet trade-offu i odrzuconej opcji. */
function validMove(over: Partial<SWOTMove> = {}): SWOTMove {
  return {
    id: 'm1',
    title: 'Uruchomić pilota w DACH',
    category: 'quick-win',
    rationale: 'Popyt rośnie, a zespół wdrożeniowy jest niewykorzystany.',
    linkedTensionIds: ['t1'],
    linkedItemIds: ['i1'],
    expectedImpact: 'high',
    estimatedEffort: 'medium',
    firstStep: 'Wybrać klienta pilotażowego',
    ownerRole: 'Dyrektor sprzedaży',
    tradeoff: { chosen: 'Pilot w DACH', deferred: 'Rozwój produktu', cost: 'Dług produktowy rośnie o kwartał' },
    rejectedAlternative: { option: 'Wejście przez partnera', reason: 'Utrata kontroli nad wdrożeniem' },
    ...over,
  } as SWOTMove;
}

const BASE = {
  id: 'out-1',
  organizationId: 'org-1',
  toolSessionId: 'sess-1',
  methodPackVersion: '1.0.0',
  title: 'SWOT — DACH',
  createdAt: '2026-08-13T10:00:00Z',
};

describe('buildSwotOutput — most sesja → Output', () => {
  const items = [item({ id: 'i1', quadrant: 'strengths' }), item({ id: 'i2', quadrant: 'opportunities' })];
  const tensions = [tension({ id: 't1', linkedItemIds: ['i1', 'i2'] })];

  it('buduje Output ze stanu sesji', () => {
    const { output } = buildSwotOutput({ ...BASE, items, tensions, moves: [validMove()] });
    expect(output.status).toBe('draft');
    expect(output.items).toHaveLength(2);
    expect(output.tensions).toHaveLength(1);
    expect(output.conclusions).toHaveLength(1);
    expect(output.contentHash).toBeTruthy();
  });

  // Reguła silnika, nie nasza: do syntezy wchodzą tylko pozycje zaakceptowane.
  it('POMIJA pozycje niezaakceptowane', () => {
    // 'ai-proposed' = propozycja Teresy jeszcze niezatwierdzona przez człowieka
    const withPending = [...items, item({ id: 'i3', quadrant: 'threats', proposalStatus: 'ai-proposed' })];
    const { output } = buildSwotOutput({ ...BASE, items: withPending, tensions, moves: [] });
    expect(output.items.map((i) => i.id)).toEqual(['i1', 'i2']);
  });

  it('ODRZUCA napięcie oparte na pozycji niezaakceptowanej', () => {
    const t = [tension({ id: 't9', linkedItemIds: ['i1', 'brak'] })];
    const { output, droppedTensionIds } = buildSwotOutput({ ...BASE, items, tensions: t, moves: [] });
    expect(output.tensions).toHaveLength(0);
    expect(droppedTensionIds).toEqual(['t9']);
  });

  // K1 musi być liczone, nie opowiedziane.
  it('liczy wagę napięcia deterministycznie z wpływu obu pozycji', () => {
    const { output } = buildSwotOutput({ ...BASE, items, tensions, moves: [] });
    // high + high = 3 + 3
    expect(output.tensions[0].priority).toBe(6);
  });

  it('waga spada, gdy wpływ pozycji jest niższy', () => {
    const mixed = [item({ id: 'i1', quadrant: 'strengths', impact: 'low' }), items[1]];
    const { output } = buildSwotOutput({ ...BASE, items: mixed, tensions, moves: [] });
    expect(output.tensions[0].priority).toBe(4); // low(1) + high(3)
  });

  // BRAMKA W2: ruch bez odrzuconej alternatywy nie wchodzi do Outputu.
  it('ODRZUCA ruch bez odrzuconej alternatywy', () => {
    const bad = validMove({ id: 'm2', rejectedAlternative: undefined });
    const { output, rejectedMoves } = buildSwotOutput({ ...BASE, items, tensions, moves: [bad] });
    expect(output.conclusions).toHaveLength(0);
    expect(rejectedMoves).toHaveLength(1);
    expect(rejectedMoves[0].moveId).toBe('m2');
    // Komunikat silnika: „Ruch nie wskazuje odrzuconego wariantu…"
    expect(rejectedMoves[0].reasons.join(' ')).toMatch(/odrzucon/i);
  });

  it('ODRZUCA ruch bez uzasadnienia', () => {
    const bad = validMove({ id: 'm3', rationale: '' });
    const { rejectedMoves } = buildSwotOutput({ ...BASE, items, tensions, moves: [bad] });
    expect(rejectedMoves.map((r) => r.moveId)).toContain('m3');
  });

  it('ODRZUCA ruch z wiszącym linkiem do nieistniejącej pozycji', () => {
    const bad = validMove({ id: 'm4', linkedItemIds: ['nie-ma'], linkedTensionIds: [] });
    const { rejectedMoves } = buildSwotOutput({ ...BASE, items, tensions, moves: [bad] });
    expect(rejectedMoves.map((r) => r.moveId)).toContain('m4');
  });

  // Defekty jakości wykryte na zrzucie, zanim ekran zobaczył właściciel.
  it('K1 ma poprawną polską odmianę liczebnika', () => {
    expect(odmienNapiecia(1)).toBe('napięcie');
    expect(odmienNapiecia(2)).toBe('napięcia');
    expect(odmienNapiecia(4)).toBe('napięcia');
    expect(odmienNapiecia(5)).toBe('napięć');
    expect(odmienNapiecia(12)).toBe('napięć'); // nastka, nie „napięcia"
    expect(odmienNapiecia(22)).toBe('napięcia');
    expect(odmienNapiecia(25)).toBe('napięć');
  });

  it('K1 nie wypuszcza surowego enumu postawy do klienta', () => {
    const { output } = buildSwotOutput({ ...BASE, items, tensions, moves: [validMove()] });
    const k1 = output.conclusions[0].k1Fact;
    expect(k1).toContain('postawa: atak');
    expect(k1).not.toContain('attack');
    expect(k1).toContain('1 napięcie');
  });

  it('K4 nie wypuszcza surowego enumu wpływu do klienta', () => {
    const { output } = buildSwotOutput({ ...BASE, items, tensions, moves: [validMove()] });
    const k4 = output.conclusions[0].k4Effect;
    expect(k4).toContain('wysoki');
    expect(k4).not.toContain('high');
  });

  it('K4 wskazuje rolę odpowiedzialną, nie „organizację"', () => {
    const { output } = buildSwotOutput({ ...BASE, items, tensions, moves: [validMove()] });
    expect(output.conclusions[0].k4Effect).toContain('Dyrektor sprzedaży');
  });

  it('mapuje status dowodu na typ evidence', () => {
    const mixed = [
      item({ id: 'i1', quadrant: 'strengths', evidenceStatus: 'confirmed' }),
      item({ id: 'i2', quadrant: 'opportunities', evidenceStatus: 'declared-unconfirmed' as never }),
      item({ id: 'i4', quadrant: 'threats', evidenceStatus: undefined }),
    ];
    const { output } = buildSwotOutput({ ...BASE, items: mixed, tensions: [], moves: [] });
    expect(output.items.find((i) => i.id === 'i1')!.evidenceKind).toBe('fact');
    expect(output.items.find((i) => i.id === 'i2')!.evidenceKind).toBe('hypothesis');
    // brak stempla NIGDY nie awansuje na fakt
    expect(output.items.find((i) => i.id === 'i4')!.evidenceKind).toBe('observation');
  });

  it('jest deterministyczny — ten sam stan sesji daje ten sam hash', () => {
    const run = () => buildSwotOutput({ ...BASE, items, tensions, moves: [validMove()] }).output.contentHash;
    expect(new Set([run(), run(), run(), run(), run()]).size).toBe(1);
  });
});

describe('pełna ścieżka Session → Output → Report → Initiative', () => {
  it('przechodzi end-to-end na realnych regułach silnika', () => {
    const items = [item({ id: 'i1', quadrant: 'strengths' }), item({ id: 'i2', quadrant: 'opportunities' })];
    const tensions = [tension({ id: 't1', linkedItemIds: ['i1', 'i2'] })];

    // 1. Sesja → Output
    const { output } = buildSwotOutput({ ...BASE, items, tensions, moves: [validMove()] });
    expect(output.status).toBe('draft');

    // 2. Przegląd → zatwierdzenie przez człowieka
    const approved = approve(submitForReview(output), 'piotr', '2026-08-13T12:00:00Z');
    expect(approved.status).toBe('approved');

    // 3. Output → Report i Presentation z tego samego Artifactu
    const report = renderToolReport([approved], {
      id: 'rep-1',
      organizationId: 'org-1',
      kind: 'report',
      title: 'Raport SWOT',
    });
    const deck = renderToolReport([approved], {
      id: 'deck-1',
      organizationId: 'org-1',
      kind: 'presentation',
      theme: 'executive-night',
      title: 'SWOT — prezentacja',
    });

    // lineage w obie strony
    expect(report.sourceOutputIds).toEqual([approved.id]);
    expect(deck.sourceOutputIds).toEqual([approved.id]);
    expect(report.sections[0].sourceOutputId).toBe(approved.id);

    // 4. Output → propozycja inicjatywy ze wskazaniem wniosku źródłowego
    // (proposeInitiatives testowane osobno; tu sprawdzamy spójność lineage)
    expect(approved.conclusions[0].sourceTensionIds).toEqual(['t1']);
    expect(output.tensions[0].sourceItemIds).toEqual(['i1', 'i2']);
  });
});
