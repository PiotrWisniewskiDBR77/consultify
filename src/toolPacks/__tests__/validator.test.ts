import { describe, expect, it } from 'vitest';

import {
  EVIDENCE_MISSING,
  evidenceMissingPack,
  type Bilingual,
  type ToolPack,
} from '../contract';
import type { RuntimeReadinessManifest } from '../runtimeReadiness';
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
    engine: {
      engineDir: 'src/config/swot',
      questionBankModule: 'src/config/swot/dynamicSwotQuestionBank.ts',
      expectedQuestionNodeCount: 17,
      bankBackedPhaseIds: ['mission'],
      rendererComponent: 'src/components/DiscoveryTools/tools/DynamicSWOT',
    },
    rights: {
      methodologyName: 'SWOT / TOWS',
      commonlyAttributedTo: 'Atrybucja rozproszona.',
      sourceUsed: 'knowledge/tool-kb/dynamic-swot/methodology/v1/dynamic-swot-methodology.pl.md',
      sourceType: 'REPO_CANON',
      copiedContent: 'no',
      trademarkNote: 'Nie znaleziono znaku towarowego.',
      commercialUseStatus: 'LEGAL_REVIEW_REQUIRED',
      legalReviewStatus: 'LEGAL_REVIEW_REQUIRED',
      publicationStatus: 'LEGAL_REVIEW_REQUIRED',
      uncertainty: 'Brak noty licencyjnej w repo.',
    },
    conclusion: {
      k1FactSource: 'swotTensionEngine — napięcia liczone z zaakceptowanych pozycji.',
      k2GroundingScope: 'Wyłącznie pozycje sesji + profil organizacji.',
      k3PrioritySource: 'Ranking impact-weighted z silnika napięć.',
      k4EffectRule: 'Efekt obserwowalny z horyzontem czasowym, bez kwot spoza wsadu.',
      tradeoffRule: 'Każdy ruch podaje wybrane, odrzucone i uzasadnienie.',
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

  // K1 z silnika, nie z LLM — twarda reguła CONCLUSION_LAYER_STANDARD.
  it('wymaga kontraktu konkluzji W2 (K1-K4 + trade-off)', () => {
    const pack = completePack();
    pack.conclusion.k1FactSource = EVIDENCE_MISSING;
    const r = validateToolPack(pack);
    expect(r.valid).toBe(false);
    expect(r.issues.some((i) => i.field === 'conclusion.k1FactSource')).toBe(true);
  });

  it('wymaga reguły trade-off wymaganej przez W2', () => {
    const pack = completePack();
    pack.conclusion.tradeoffRule = EVIDENCE_MISSING;
    const r = validateToolPack(pack);
    expect(r.valid).toBe(false);
    expect(r.issues.some((i) => i.field === 'conclusion.tradeoffRule')).toBe(true);
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

/**
 * Bramka RUNTIME_ACTIVE po review Codexa (P0).
 * Wcześniej wystarczyła kompletna treść — narzędzie z zerowym runtime
 * przechodziło. Teraz wymagany jest manifest dowodów wobec candidate SHA.
 */
describe('bramka RUNTIME_ACTIVE — wymaga dowodów, nie deklaracji', () => {
  const SHA = 'abc1234def';

  function passingManifest(sha = SHA): RuntimeReadinessManifest {
    return {
      manifestVersion: '1.0.0',
      toolType: 'dynamic-swot',
      gates: {
        sessionImplemented: 'PASS',
        persistenceVerified: 'PASS',
        reopenVerified: 'PASS',
        rendererImplemented: 'PASS',
        outputImplemented: 'PASS',
        reportImplemented: 'PASS',
        approvalVerified: 'PASS',
        initiativeHandoffVerified: 'PASS',
        automatedTestsPassed: 'PASS',
        manualAcceptancePassed: 'PASS',
      },
      lightMpq: 29,
      darkMpq: 29,
      hasSignatureSurface: true,
      evidenceLedgerRefs: ['docs/evidence/swot-light.png'],
      verifiedAt: '2026-08-13T12:00:00Z',
      verifiedAgainstSha: sha,
    };
  }

  it('ODRZUCA RUNTIME_ACTIVE bez manifestu (dawna dziura)', () => {
    const r = validateToolPack(
      completePack({ runtimeStatus: 'RUNTIME_ACTIVE' }),
      SHA
    );
    expect(r.publishableAsActive).toBe(false);
    expect(r.issues.some((i) => i.field === 'runtimeReadiness')).toBe(true);
  });

  it('ODRZUCA, gdy choć jedna bramka nie jest PASS', () => {
    const m = passingManifest();
    m.gates.manualAcceptancePassed = 'NOT_RUN';
    const r = validateToolPack(
      completePack({ runtimeStatus: 'RUNTIME_ACTIVE', runtimeReadiness: m }),
      SHA
    );
    expect(r.publishableAsActive).toBe(false);
    expect(r.issues.some((i) => i.message.includes('manualAcceptancePassed'))).toBe(true);
  });

  it('ODRZUCA dowody z innego SHA (zestarzały manifest)', () => {
    const r = validateToolPack(
      completePack({ runtimeStatus: 'RUNTIME_ACTIVE', runtimeReadiness: passingManifest('stary999') }),
      SHA
    );
    expect(r.publishableAsActive).toBe(false);
    expect(r.issues.some((i) => i.message.includes('nieaktualny'))).toBe(true);
  });

  it('ODRZUCA MPQ poniżej progu dla powierzchni sygnaturowej', () => {
    const m = passingManifest();
    m.darkMpq = 27; // próg sygnaturowy to 29
    const r = validateToolPack(
      completePack({ runtimeStatus: 'RUNTIME_ACTIVE', runtimeReadiness: m }),
      SHA
    );
    expect(r.publishableAsActive).toBe(false);
    expect(r.issues.some((i) => i.message.includes('darkMpq'))).toBe(true);
  });

  it('ODRZUCA brak trwałych dowodów', () => {
    const m = passingManifest();
    m.evidenceLedgerRefs = [];
    const r = validateToolPack(
      completePack({ runtimeStatus: 'RUNTIME_ACTIVE', runtimeReadiness: m }),
      SHA
    );
    expect(r.publishableAsActive).toBe(false);
  });

  it('PRZEPUSZCZA dopiero przy komplecie dowodów wobec bieżącego SHA', () => {
    const r = validateToolPack(
      completePack({ runtimeStatus: 'RUNTIME_ACTIVE', runtimeReadiness: passingManifest() }),
      SHA
    );
    expect(r.issues.filter((i) => i.severity === 'error')).toHaveLength(0);
    expect(r.publishableAsActive).toBe(true);
  });
});

describe('walidacja treści PACK_COMPLETE (P1)', () => {
  it('wymaga wiązania z silnikiem i bankiem pytań', () => {
    const r = validateToolPack(completePack({ engine: undefined }));
    expect(r.valid).toBe(false);
    expect(r.issues.some((i) => i.field === 'engine')).toBe(true);
  });

  it('wymaga rejestru praw', () => {
    const r = validateToolPack(completePack({ rights: undefined }));
    expect(r.valid).toBe(false);
    expect(r.issues.some((i) => i.field === 'rights')).toBe(true);
  });

  it('ZABRANIA wpisania „Free" jako wniosku prawnego', () => {
    const pack = completePack();
    pack.rights!.commercialUseStatus = 'Free';
    const r = validateToolPack(pack);
    expect(r.valid).toBe(false);
    expect(r.issues.some((i) => i.field === 'rights.commercialUseStatus')).toBe(true);
  });

  it('wymaga zadeklarowania rozmiaru banku pytań', () => {
    const pack = completePack();
    pack.engine!.expectedQuestionNodeCount = 0;
    const r = validateToolPack(pack);
    expect(r.valid).toBe(false);
    expect(r.issues.some((i) => i.field === 'engine.expectedQuestionNodeCount')).toBe(true);
  });

  it('wykrywa fazę banku, która nie istnieje w packu', () => {
    const pack = completePack();
    pack.engine!.bankBackedPhaseIds = ['nie-ma'];
    const r = validateToolPack(pack);
    expect(r.valid).toBe(false);
    expect(r.issues.some((i) => i.field === 'engine.bankBackedPhaseIds')).toBe(true);
  });

  it('wymaga zastosowań i przeciwwskazań', () => {
    expect(validateToolPack(completePack({ useCases: [] })).valid).toBe(false);
    expect(validateToolPack(completePack({ contraindications: [] })).valid).toBe(false);
  });

  it('wymaga reguły challenge w każdym pytaniu', () => {
    const pack = completePack();
    pack.questions[0].challengeRule = EVIDENCE_MISSING;
    const r = validateToolPack(pack);
    expect(r.valid).toBe(false);
    expect(r.issues.some((i) => i.field === 'questions[0].challengeRule')).toBe(true);
  });

  it('wymaga kompletu pól każdej fazy', () => {
    const pack = completePack();
    pack.phases[0].completionCriterion = EVIDENCE_MISSING;
    const r = validateToolPack(pack);
    expect(r.valid).toBe(false);
    expect(r.issues.some((i) => i.field === 'phases[0].completionCriterion')).toBe(true);
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
