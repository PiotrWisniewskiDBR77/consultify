import { describe, expect, it } from 'vitest';

import {
  EVIDENCE_MISSING,
  evidenceMissingPack,
  type Bilingual,
  type ToolPack,
} from '../contract';
import { validateAll, validateToolPack } from '../validator';

const bi = (pl: string, en: string): Bilingual => ({ pl, en });

/** Minimalny poprawny pack — baza do mutacji w testach. */
function completePack(overrides: Partial<ToolPack> = {}): ToolPack {
  return {
    toolType: 'dynamic-swot',
    displayName: bi('Dynamiczny SWOT', 'Dynamic SWOT'),
    category: 'strategic',
    packVersion: '1.0.0',
    contentStatus: 'PACK_COMPLETE',
    runtimeStatus: 'RUNTIME_PENDING',
    provenance: [
      {
        source: 'knowledge/tool-kb/dynamic-swot/methodology/v1/dynamic-swot-methodology.pl.md',
        verifiableInRepo: true,
      },
    ],
    library: {
      whatItIs: bi('Strategiczna diagnoza pozycji firmy.', 'Strategic diagnosis of position.'),
      whatItIsNot: bi('To nie jest lista życzeń zarządu.', 'It is not a management wish list.'),
      whenToUse: bi('Przed decyzją o kierunku strategii.', 'Before a strategic direction call.'),
      whenNotToUse: bi('Gdy problem jest czysto operacyjny.', 'When the problem is operational.'),
      whyItMatters: bi('Zamienia opinie w napięcia i ruchy.', 'Turns opinions into moves.'),
      inputsRequired: bi('Dane rynkowe i wyniki finansowe.', 'Market data and financials.'),
      roles: bi('Zarząd, właściciel obszaru, analityk.', 'Board, area owner, analyst.'),
      outcome: bi('Napięcia, ruchy i kandydaci inicjatyw.', 'Tensions, moves, initiatives.'),
      estimatedEffort: '2-4 h',
      license: 'free',
    },
    purpose: bi('Uporządkować pozycję strategiczną.', 'Structure the strategic position.'),
    useCases: ['Przegląd strategii'],
    contraindications: ['Problem operacyjny'],
    phases: [
      {
        id: 'mission',
        title: bi('Misja', 'Mission'),
        goal: bi('Ustalić pytanie decyzyjne.', 'Frame the decision question.'),
        whatGoodLooksLike: 'Jedno ostre pytanie decyzyjne.',
        evidenceToAskFor: 'Kontekst i horyzont czasowy.',
        completionCriterion: 'Pytanie zaakceptowane przez właściciela.',
      },
    ],
    questions: [
      {
        id: 'q-mission-1',
        phaseId: 'mission',
        prompt: bi('Jaką decyzję ma wesprzeć ta analiza?', 'What decision does this support?'),
        answerType: 'text',
        challengeRule: 'Odrzuć odpowiedź bez horyzontu czasowego.',
      },
    ],
    classificationRules: 'S/W wewnętrzne, O/T zewnętrzne.',
    evidenceExpectations: 'Fakt, obserwacja lub hipoteza — jawnie oznaczone.',
    relationships: 'Siła+Szansa = atak; Słabość+Zagrożenie = ekspozycja.',
    interpretationRules: 'Czytaj napięcia, nie pojedyncze kafelki.',
    completionCriteria: 'Każda ćwiartka ma dowody i co najmniej jeden ruch.',
    signatureArchetype: 'quadrant-strategic-field',
    signatureRationale: 'SWOT jest z natury polem 2x2 wewnętrzne/zewnętrzne.',
    mapping: {
      output: 'Napięcia + rekomendowane ruchy jako niezmienny snapshot.',
      report: 'Sekcja diagnozy w raporcie wykonawczym.',
      initiative: 'Każdy ruch staje się kandydatem na inicjatywę.',
    },
    ...overrides,
  };
}

describe('validateToolPack', () => {
  it('przepuszcza kompletny pack', () => {
    const r = validateToolPack(completePack());
    expect(r.valid).toBe(true);
    expect(r.contentComplete).toBe(true);
    expect(r.issues.filter((i) => i.severity === 'error')).toHaveLength(0);
  });

  // BRAMKA PUBLIKACJI — najważniejszy test negatywny.
  it('BLOKUJE RUNTIME_ACTIVE, gdy pack nie jest kompletny', () => {
    const r = validateToolPack(
      completePack({ contentStatus: 'PACK_PARTIAL', runtimeStatus: 'RUNTIME_ACTIVE' })
    );
    expect(r.publishableAsActive).toBe(false);
    expect(r.valid).toBe(false);
    expect(r.issues.some((i) => i.field === 'runtimeStatus')).toBe(true);
  });

  it('BLOKUJE RUNTIME_ACTIVE dla packa EVIDENCE_MISSING', () => {
    const pack = evidenceMissingPack(
      'vsm-builder',
      bi('Kreator VSM', 'VSM Builder'),
      'operational',
      'flow-value-stream',
      'RUNTIME_ACTIVE'
    );
    const r = validateToolPack(pack);
    expect(r.publishableAsActive).toBe(false);
    expect(r.valid).toBe(false);
  });

  it('dopuszcza pack EVIDENCE_MISSING, gdy runtime nie twierdzi, że działa', () => {
    const pack = evidenceMissingPack(
      'vsm-builder',
      bi('Kreator VSM', 'VSM Builder'),
      'operational',
      'flow-value-stream',
      'COMING_SOON'
    );
    const r = validateToolPack(pack);
    expect(r.valid).toBe(true);
    expect(r.contentComplete).toBe(false);
    expect(r.publishableAsActive).toBe(false);
  });

  it('wykrywa EVIDENCE_MISSING przemycone do treści kompletnego packa', () => {
    const pack = completePack();
    pack.library.whenToUse = bi(`${EVIDENCE_MISSING} — brak`, `${EVIDENCE_MISSING} — none`);
    const r = validateToolPack(pack);
    expect(r.valid).toBe(false);
    expect(r.issues.some((i) => i.field === 'library.whenToUse')).toBe(true);
  });

  it('wymaga tłumaczenia PL i EN', () => {
    const pack = completePack();
    pack.library.whatItIs = bi('Strategiczna diagnoza pozycji firmy.', '');
    const r = validateToolPack(pack);
    expect(r.valid).toBe(false);
    expect(r.issues.some((i) => i.field === 'library.whatItIs')).toBe(true);
  });

  it('wykrywa pytanie wskazujące nieistniejącą fazę', () => {
    const pack = completePack();
    pack.questions[0].phaseId = 'nie-ma-takiej';
    const r = validateToolPack(pack);
    expect(r.valid).toBe(false);
    expect(r.issues.some((i) => i.field === 'questions[0].phaseId')).toBe(true);
  });

  it('wykrywa zduplikowane id faz', () => {
    const pack = completePack();
    pack.phases = [pack.phases[0], { ...pack.phases[0] }];
    const r = validateToolPack(pack);
    expect(r.valid).toBe(false);
    expect(r.issues.some((i) => i.field === 'phases')).toBe(true);
  });

  it('wymaga mapowania Output/Report/Initiative', () => {
    const pack = completePack();
    pack.mapping.initiative = EVIDENCE_MISSING;
    const r = validateToolPack(pack);
    expect(r.valid).toBe(false);
    expect(r.issues.some((i) => i.field === 'mapping.initiative')).toBe(true);
  });

  it('wymaga źródeł dla kompletnego packa', () => {
    const r = validateToolPack(completePack({ provenance: [] }));
    expect(r.valid).toBe(false);
    expect(r.issues.some((i) => i.field === 'provenance')).toBe(true);
  });

  it('ostrzega o źródłach niewryfikowalnych w repo, ale nie blokuje', () => {
    const r = validateToolPack(
      completePack({
        provenance: [{ source: 'knowledge/Strategie /Creately.zip', verifiableInRepo: false }],
      })
    );
    expect(r.valid).toBe(true);
    expect(r.issues.some((i) => i.severity === 'warning' && i.field === 'provenance')).toBe(true);
  });

  it('odrzuca wersję spoza semver', () => {
    const r = validateToolPack(completePack({ packVersion: 'v1' }));
    expect(r.valid).toBe(false);
    expect(r.issues.some((i) => i.field === 'packVersion')).toBe(true);
  });
});

describe('validateAll', () => {
  it('liczy stany treści i runtime rozdzielnie', () => {
    const { summary } = validateAll([
      completePack(),
      evidenceMissingPack(
        'vsm-builder',
        bi('Kreator VSM', 'VSM Builder'),
        'operational',
        'flow-value-stream',
        'COMING_SOON'
      ),
    ]);
    expect(summary.total).toBe(2);
    expect(summary.packComplete).toBe(1);
    expect(summary.evidenceMissing).toBe(1);
    expect(summary.runtimeActive).toBe(0);
    expect(summary.invalid).toBe(0);
  });
});
