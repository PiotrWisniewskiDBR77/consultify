import { describe, expect, it } from 'vitest';

import { canonicalize, contentHash } from '../contentHash';
import {
  ImmutableOutputError,
  InvalidTransitionError,
  approve,
  computeOutputHash,
  mutateConclusions,
  proposeInitiatives,
  reopen,
  sendBack,
  submitForReview,
} from '../outputLifecycle';
import { OutputNotApprovedError, renderToolReport } from '../renderReport';
import type { ToolOutput, ToolReportDocument } from '../types';

/** Ile bloków danego rodzaju zawiera dokument. */
function countBlocks(doc: ToolReportDocument, kind: string): number {
  return doc.sections.reduce((n, s) => n + s.blocks.filter((b) => b.kind === kind).length, 0);
}

/** Bloki konkluzji K1-K4 w kolejności występowania. */
function conclusionBlocks(doc: ToolReportDocument) {
  return doc.sections
    .flatMap((s) => s.blocks)
    .filter((b): b is Extract<typeof b, { kind: 'conclusion' }> => b.kind === 'conclusion');
}

function makeOutput(overrides: Partial<ToolOutput> = {}): ToolOutput {
  const base: ToolOutput = {
    id: 'out-1',
    organizationId: 'org-1',
    toolSessionId: 'sess-1',
    toolType: 'dynamic-swot',
    methodPackVersion: '1.0.0',
    version: 1,
    title: 'SWOT — wejście na rynek DACH',
    status: 'draft',
    items: [
      { id: 'i1', label: 'Silny zespół wdrożeniowy', bucket: 'strengths', evidenceKind: 'fact', impact: 'high' },
      { id: 'i2', label: 'Rosnący popyt w DACH', bucket: 'opportunities', evidenceKind: 'observation', impact: 'medium' },
    ],
    tensions: [
      { id: 't1', posture: 'attack', title: 'Zespół × popyt', sourceItemIds: ['i1', 'i2'], priority: 5 },
      { id: 't2', posture: 'defend', title: 'Zespół × presja cenowa', sourceItemIds: ['i1', 'i2'], priority: 3 },
    ],
    conclusions: [
      {
        id: 'c1',
        k1Fact: 'Popyt w DACH rośnie 3 kwartały z rzędu przy stałej obsadzie wdrożeń.',
        k2Meaning: 'Przewaga wdrożeniowa jest niewykorzystana, a okno rynkowe się zamyka.',
        k3Actions: ['Uruchomić pilota w DACH', 'Zatrudnić dwóch wdrożeniowców'],
        k4Effect: 'Pierwszy klient referencyjny w 6 miesięcy.',
        tradeoff: { chosen: 'Pilot w DACH', rejected: 'Rozwój produktu', why: 'Okno rynkowe zamyka się szybciej niż dług produktowy rośnie.' },
        sourceTensionIds: ['t1'],
      },
    ],
    createdAt: '2026-08-13T10:00:00Z',
    contentHash: '',
  };
  const merged = { ...base, ...overrides };
  return { ...merged, contentHash: computeOutputHash(merged) };
}

describe('contentHash — determinizm', () => {
  it('daje ten sam hash dla tej samej treści (10 przebiegów)', () => {
    const value = { b: 2, a: [3, 1, 2], c: { z: 'x', y: 'w' } };
    const hashes = new Set(Array.from({ length: 10 }, () => contentHash(value)));
    expect(hashes.size, 'hash musi być stabilny między przebiegami').toBe(1);
  });

  it('nie zależy od kolejności kluczy obiektu (sort w pamięci)', () => {
    expect(contentHash({ a: 1, b: 2 })).toBe(contentHash({ b: 2, a: 1 }));
  });

  it('ZALEŻY od kolejności tablicy — kolejność sekcji jest znacząca', () => {
    expect(contentHash([1, 2])).not.toBe(contentHash([2, 1]));
  });

  it('normalizuje -0 i 0 do tej samej postaci', () => {
    expect(contentHash({ v: -0 })).toBe(contentHash({ v: 0 }));
  });

  it('stabilnie serializuje liczby zmiennoprzecinkowe', () => {
    // Klasyczna pułapka: 0.1+0.2 !== 0.3, ale ta sama wartość musi dać ten sam hash.
    const v = 0.1 + 0.2;
    expect(contentHash({ v })).toBe(contentHash({ v: 0.1 + 0.2 }));
    expect(canonicalize({ v })).toBe(canonicalize({ v }));
  });

  it('pomija undefined, więc brak klucza nie zmienia hasha', () => {
    expect(contentHash({ a: 1, b: undefined })).toBe(contentHash({ a: 1 }));
  });

  it('wykrywa zmianę treści', () => {
    const a = makeOutput();
    const b = makeOutput({ title: 'inny tytuł' });
    // tytuł nie wchodzi do hasha merytorycznego
    expect(a.contentHash).toBe(b.contentHash);
    const c = makeOutput({ tensions: [] });
    expect(a.contentHash).not.toBe(c.contentHash);
  });
});

describe('cykl życia Outputu — niezmienność', () => {
  it('przechodzi draft → in_review → approved', () => {
    const approved = approve(submitForReview(makeOutput()), 'user-1', '2026-08-13T12:00:00Z');
    expect(approved.status).toBe('approved');
    expect(approved.approvedBy).toBe('user-1');
  });

  it('NIE pozwala zatwierdzić z pominięciem przeglądu', () => {
    expect(() => approve(makeOutput(), 'user-1', 'now')).toThrow(InvalidTransitionError);
  });

  it('wymaga wskazania człowieka zatwierdzającego', () => {
    expect(() => approve(submitForReview(makeOutput()), '', 'now')).toThrow();
  });

  it('pozwala odesłać do poprawy z przeglądu', () => {
    expect(sendBack(submitForReview(makeOutput())).status).toBe('draft');
  });

  // NAJWAŻNIEJSZY TEST: zatwierdzony snapshot jest niezmienny.
  it('BLOKUJE edycję zatwierdzonego Outputu w miejscu', () => {
    const approved = approve(submitForReview(makeOutput()), 'user-1', 'now');
    expect(() => mutateConclusions(approved, [])).toThrow(ImmutableOutputError);
  });

  it('reopen tworzy NOWĄ rewizję i zachowuje oryginał jako dowód', () => {
    const approved = approve(submitForReview(makeOutput()), 'user-1', 'now');
    const { superseded, revision } = reopen(approved, 'out-2', '2026-08-13T13:00:00Z');

    expect(superseded.id).toBe('out-1');
    expect(superseded.status).toBe('superseded');
    // oryginalny ślad zatwierdzenia zostaje nienaruszony
    expect(superseded.approvedBy).toBe('user-1');

    expect(revision.id).toBe('out-2');
    expect(revision.version).toBe(2);
    expect(revision.supersedesId).toBe('out-1');
    expect(revision.status).toBe('draft');
    expect(revision.approvedBy).toBeUndefined();
  });

  it('nie pozwala otworzyć niezatwierdzonego Outputu', () => {
    expect(() => reopen(makeOutput(), 'out-2', 'now')).toThrow(InvalidTransitionError);
  });
});

describe('propozycje inicjatyw', () => {
  it('wyprowadza propozycje wyłącznie z zatwierdzonego Outputu', () => {
    expect(() => proposeInitiatives(makeOutput())).toThrow();
  });

  it('każda propozycja wskazuje wniosek źródłowy (traceability)', () => {
    const approved = approve(submitForReview(makeOutput()), 'user-1', 'now');
    const proposals = proposeInitiatives(approved);
    expect(proposals).toHaveLength(1);
    expect(proposals[0].sourceConclusionId).toBe('c1');
    expect(proposals[0].proposedTitle).toBe('Uruchomić pilota w DACH');
    expect(proposals[0].status).toBe('proposed');
  });
});

describe('deterministyczny renderer Report/Presentation', () => {
  const approvedOutput = () => approve(submitForReview(makeOutput()), 'user-1', 'now');
  const opts = { id: 'rep-1', organizationId: 'org-1', title: 'Raport', kind: 'report' as const };

  it('renderuje raport z zatwierdzonego Outputu', () => {
    const doc = renderToolReport([approvedOutput()], opts);
    expect(doc.sections).toHaveLength(1);
    expect(doc.sourceOutputIds).toEqual(['out-1']);
    expect(doc.kind).toBe('report');
  });

  // KLUCZOWA WŁASNOŚĆ: ten sam Output + ta sama wersja renderera = ten sam dokument.
  it('jest deterministyczny — 10 przebiegów daje jeden hash', () => {
    const out = approvedOutput();
    const hashes = new Set(
      Array.from({ length: 10 }, () => renderToolReport([out], opts).contentHash)
    );
    expect(hashes.size).toBe(1);
  });

  it('ODMAWIA renderowania z niezatwierdzonego Outputu', () => {
    expect(() => renderToolReport([makeOutput()], opts)).toThrow(OutputNotApprovedError);
  });

  it('wymaga co najmniej jednego Outputu', () => {
    expect(() => renderToolReport([], opts)).toThrow();
  });

  it('scala WIELE Outputów z zachowaniem lineage', () => {
    const a = approvedOutput();
    const b = approve(submitForReview(makeOutput({ id: 'out-9' })), 'user-1', 'now');
    const doc = renderToolReport([a, b], opts);
    expect(doc.sourceOutputIds).toEqual(['out-1', 'out-9']);
    expect(doc.sections.map((s) => s.sourceOutputId)).toEqual(['out-1', 'out-9']);
  });

  /*
   * Action title = WNIOSEK, nie statystyka silnika i nie powtórzenie K1.
   * Pierwotnie tytuł brał K1, przez co nagłówek brzmiał „Podstawa: 2 napięcia
   * o wadze 6" i dublował treść bloku konkluzji. Wykryte na zrzucie przed
   * odbiorem właściciela.
   */
  it('action title jest rekomendacją, nie powtórzeniem K1', () => {
    const doc = renderToolReport([approvedOutput()], opts);
    const title = doc.sections[0].actionTitle;
    expect(title).toBe('Uruchomić pilota w DACH');
    // nagłówek nie może być tym samym tekstem co K1
    const k1 = conclusionBlocks(doc)[0].k1Fact;
    expect(title).not.toBe(k1);
  });

  it('action title spada na K2, gdy brak akcji K3', () => {
    const out = approvedOutput();
    const noActions = { ...out, conclusions: [{ ...out.conclusions[0], k3Actions: [] }] };
    const doc = renderToolReport([noActions], { ...opts, id: 'rep-2' });
    expect(doc.sections[0].actionTitle).toContain('Przewaga wdrożeniowa');
  });

  it('prezentacja skraca treść, ale NIE zmienia znaczenia', () => {
    const out = approvedOutput();
    const report = renderToolReport([out], opts);
    const deck = renderToolReport([out], { ...opts, id: 'p-1', kind: 'presentation' });

    // pełna lista dowodów zostaje w raporcie, nie na slajdzie
    expect(countBlocks(report, 'evidence-list')).toBe(1);
    expect(countBlocks(deck, 'evidence-list')).toBe(0);

    // ale wnioski i ich klasyfikacja są identyczne
    const rc = conclusionBlocks(report)[0];
    const dc = conclusionBlocks(deck)[0];
    expect(dc.k1Fact).toBe(rc.k1Fact);
    expect(dc.tradeoff).toEqual(rc.tradeoff);
  });

  it('oba motywy renderują tę samą treść merytoryczną', () => {
    const out = approvedOutput();
    const light = renderToolReport([out], { ...opts, theme: 'executive-paper' });
    const dark = renderToolReport([out], { ...opts, theme: 'executive-night' });
    expect(light.sections).toEqual(dark.sections);
    // ale hash się różni, bo motyw jest częścią dokumentu
    expect(light.contentHash).not.toBe(dark.contentHash);
  });

  it('sortuje napięcia stabilnie przy równym priorytecie', () => {
    const out = approve(
      submitForReview(
        makeOutput({
          tensions: [
            { id: 'tB', posture: 'attack', title: 'B', sourceItemIds: ['i1', 'i2'], priority: 4 },
            { id: 'tA', posture: 'defend', title: 'A', sourceItemIds: ['i1', 'i2'], priority: 4 },
          ],
        })
      ),
      'user-1',
      'now'
    );
    const first = renderToolReport([out], opts).contentHash;
    const second = renderToolReport([out], opts).contentHash;
    expect(first).toBe(second);
  });
});

