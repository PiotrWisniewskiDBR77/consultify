import { describe, expect, it } from 'vitest';

import {
  validateInsightCard,
  validateInitiativeCard,
  validateCard,
  buildRepairBriefFromVerdict,
  type InsightCardData,
  type InitiativeCardInput,
} from '../../../server/src/services/cardContentFormulaValidator.js';

// ────────────────────────────────────────────────────────────────────────────
// Fixtures — a "gold" insight/initiative that should score high, and helpers.
// ────────────────────────────────────────────────────────────────────────────

const PL_SUMMARY_60_130 =
  'Zespół sprzedaży traci realne szanse, bo proces obsługi zapytań nie ma priorytetyzacji ' +
  'ani mierzonego przepływu, co potwierdzają wywiady z trzema rolami. Największym wąskim ' +
  'gardłem jest brak triage, przez co lead-time rośnie do kilkunastu dni w segmencie ' +
  'kluczowym. Rekomendujemy wdrożenie mierzonego przepływu z jasnym progiem SLA. Poziom ' +
  'pewności jest wysoki, bo obserwacja powtarza się u wszystkich rozmówców i jest poparta ' +
  'danymi operacyjnymi z ostatnich dwóch kwartałów działania firmy.';

const longThemeDesc = (label: string) =>
  `${label}: obserwacja powtarza się w wielu wywiadach i wskazuje na systemowy brak ` +
  'mierzonego przepływu; rozmówcy niezależnie opisują ten sam mechanizm opóźnień, który ' +
  'blokuje realizację zamówień w kluczowym segmencie i realnie obniża konwersję sprzedaży, ' +
  'a jednocześnie utrudnia planowanie zdolności zespołu, bo nikt nie widzi rzeczywistego ' +
  'obciążenia kolejki ani czasu reakcji na poszczególne zapytania klientów strategicznych ' +
  'oraz nie potrafi wskazać, gdzie dokładnie zamówienia utykają w procesie obsługi.';

function goldInsight(): InsightCardData {
  return {
    title: 'Brak triage zapytań wydłuża lead-time w segmencie kluczowym',
    executive_summary: PL_SUMMARY_60_130,
    themes: [
      // strong ⇒ ≥2 evidence_refs (§3.2); tytuły = action-title z czasownikiem.
      { title: 'Brak triage wydłuża obsługę zapytań kluczowych', description: longThemeDesc('Brak triage'), evidence_refs: ['a1', 'a2'], strength: 'strong' },
      { title: 'Rosnący lead-time obniża konwersję w segmencie kluczowym', description: longThemeDesc('Lead-time'), evidence_refs: ['a2', 'a3'], strength: 'strong' },
      { title: 'Utrata szans sprzedażowych rośnie bez priorytetyzacji', description: longThemeDesc('Utrata szans'), evidence_refs: ['a3'], strength: 'moderate' },
    ],
    issues: [
      // severity=high uzasadnione kosztem/skutkiem (§3.3); tytuł ≥4 słowa.
      {
        title: 'Brak priorytetów w kolejce wydłuża obsługę',
        description: 'Zapytania nie są priorytetyzowane, przez co lead-time rośnie i firma traci sprzedaż w segmencie kluczowym.',
        severity: 'high',
        evidence_refs: ['a1'],
      },
      {
        title: 'Brak mierzenia czasu obsługi ukrywa wąskie gardło',
        description: 'Nikt nie mierzy czasu obsługi, więc nie widać, gdzie utyka proces.',
        severity: 'medium',
        evidence_refs: ['a2'],
      },
    ],
    opportunities: [],
    signals: [],
    evidence_map: [
      { answer_id: 'a1', question_text: 'Q1', answer_snippet: 'brak priorytetów w kolejce', linked_themes: [], linked_issues: [] },
    ],
    missing_data: ['Brak danych o wolumenie zapytań', 'Brak baseline lead-time'],
    material_quality: {
      score: 82,
      limitations: ['Mała próba ról'],
      missing_voices: ['Dział IT'],
      recommended_followups: ['Zebrać dane wolumenowe'],
    },
  };
}

describe('validateInsightCard (§A2/§B3)', () => {
  it('gold insight passes with a high score and no violations', () => {
    const v = validateInsightCard(goldInsight());
    expect(v.kind).toBe('insight');
    expect(v.violations).toEqual([]);
    expect(v.score).toBe(100);
    expect(v.pass).toBe(true);
  });

  it('flags missing executive_summary as a hard violation', () => {
    const card = goldInsight();
    card.executive_summary = '';
    const v = validateInsightCard(card);
    expect(v.violationCodes).toContain('insight.summary_present');
    expect(v.violations.find((x) => x.code === 'insight.summary_present')?.severity).toBe('hard');
    expect(v.pass).toBe(false);
  });

  it('flags too-short summary length (soft)', () => {
    const card = goldInsight();
    card.executive_summary = 'Za krótkie podsumowanie bez treści i konkretu.';
    const codes = validateInsightCard(card).violationCodes;
    expect(codes).toContain('insight.summary_len');
  });

  it('flags themes_count when < 3', () => {
    const card = goldInsight();
    card.themes = (card.themes as any[]).slice(0, 1);
    expect(validateInsightCard(card).violationCodes).toContain('insight.themes_count');
  });

  it('flags theme without evidence_refs', () => {
    const card = goldInsight();
    (card.themes as any[])[0].evidence_refs = [];
    expect(validateInsightCard(card).violationCodes).toContain('insight.theme_evidence');
  });

  it('flags incomplete material_quality as HARD (§A6.2 crash-risk)', () => {
    const card = goldInsight();
    card.material_quality = { score: 50 }; // missing limitations/missing_voices/recommended_followups
    const v = validateInsightCard(card);
    const mq = v.violations.find((x) => x.code === 'insight.material_quality_complete');
    expect(mq).toBeTruthy();
    expect(mq?.severity).toBe('hard');
    expect(v.pass).toBe(false);
  });

  it('flags missing material_quality object entirely (HARD)', () => {
    const card = goldInsight();
    delete card.material_quality;
    expect(validateInsightCard(card).violationCodes).toContain('insight.material_quality_complete');
  });

  it('accepts overall_material_score as the score sub-field (live generation field name)', () => {
    // The live pipeline (buildInsightMaterialQuality) and renderer (InsightViewer)
    // use `overall_material_score`, not a bare `score`. Requiring `score` would
    // hard-fail every real card even though material_quality is complete.
    const card = goldInsight();
    card.material_quality = {
      overall_material_score: 82,
      limitations: ['Mała próba ról'],
      missing_voices: ['Dział IT'],
      recommended_followups: ['Zebrać dane wolumenowe'],
    };
    const v = validateInsightCard(card);
    expect(v.violationCodes).not.toContain('insight.material_quality_complete');
    expect(v.pass).toBe(true);
  });

  it('flags English prose (lang_pl)', () => {
    const card = goldInsight();
    card.executive_summary =
      'The team will improve the process and increase value because this change should reduce delays across the board.';
    expect(validateInsightCard(card).violationCodes).toContain('insight.lang_pl');
  });

  it('flags placeholder filler as HARD (no_filler)', () => {
    const card = goldInsight();
    card.title = 'Key message for this insight';
    const v = validateInsightCard(card);
    const f = v.violations.find((x) => x.code === 'insight.no_filler');
    expect(f?.severity).toBe('hard');
  });

  it('flags evidence snippet longer than 120 chars', () => {
    const card = goldInsight();
    (card.evidence_map as any[])[0].answer_snippet = 'x'.repeat(121);
    expect(validateInsightCard(card).violationCodes).toContain('insight.evidence_snippet_len');
  });

  it('flags missing_data_count when < 2', () => {
    const card = goldInsight();
    card.missing_data = ['tylko jeden'];
    expect(validateInsightCard(card).violationCodes).toContain('insight.missing_data_count');
  });

  it('tolerates camelCase persisted fields (executiveSummary/materialQuality)', () => {
    const gold = goldInsight();
    const camel: InsightCardData = {
      title: gold.title,
      executiveSummary: gold.executive_summary,
      themes: gold.themes,
      issues: gold.issues,
      evidenceMap: gold.evidence_map,
      missingData: gold.missing_data,
      materialQuality: gold.material_quality,
    };
    const v = validateInsightCard(camel);
    expect(v.violationCodes).not.toContain('insight.summary_present');
    expect(v.violationCodes).not.toContain('insight.material_quality_complete');
  });

  it('does not throw on null / empty card', () => {
    expect(() => validateInsightCard(null)).not.toThrow();
    expect(() => validateInsightCard(undefined)).not.toThrow();
    expect(validateInsightCard({}).pass).toBe(false);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// 13-TYPE FORMULA — §5.2 per-type thresholds (PASS uses §3 wzorzec, FAIL uses
// §3 anti-wzorzec). Each block is a self-documenting test of one doctrine rule.
// ────────────────────────────────────────────────────────────────────────────

describe('validateInsightCard — §5 per-type formula', () => {
  it('title_is_thesis: flags a bare topic title (§3.2 anti-wzorzec)', () => {
    const card = goldInsight();
    // "Planowanie produkcji" = temat, nie teza (≤3 słowa, brak czasownika).
    (card.themes as any[])[0].title = 'Planowanie produkcji';
    expect(validateInsightCard(card).violationCodes).toContain('insight.title_is_thesis');
  });

  it('title_is_thesis: passes an action-title carrying a verb (§3.2 wzorzec)', () => {
    const v = validateInsightCard(goldInsight());
    expect(v.violationCodes).not.toContain('insight.title_is_thesis');
  });

  it('theme_strength_grounded: strength=strong with <2 refs fails (§3.2)', () => {
    const card = goldInsight();
    (card.themes as any[])[0].evidence_refs = ['a1']; // strong ale 1 ref
    expect(validateInsightCard(card).violationCodes).toContain('insight.theme_strength_grounded');
  });

  it('summary_sowhat: summary with no number nor value-driver fails (§3.1)', () => {
    const card = goldInsight();
    card.executive_summary =
      'Zespół pracuje nad usprawnieniami i chce działać lepiej niż dotychczas. ' +
      'Wiele rzeczy wymaga uwagi. Trzeba się temu przyjrzeć spokojnie i dokładnie.';
    expect(validateInsightCard(card).violationCodes).toContain('insight.summary_sowhat');
  });

  it('issue_severity_justified: high severity without a cost/consequence fails (§3.3)', () => {
    const card = goldInsight();
    (card.issues as any[])[0] = {
      title: 'Problem z danymi jest poważny dla firmy',
      description: 'Dane bywają niespójne.',
      severity: 'high',
      evidence_refs: ['a1'],
    };
    expect(validateInsightCard(card).violationCodes).toContain('insight.issue_severity_justified');
  });

  it('opp_measurable: opportunity without a number and no opt-out fails (§3.4)', () => {
    const card = goldInsight();
    card.opportunities = [
      { title: 'Automatyzacja procesów da duże korzyści', description: 'Można wiele zautomatyzować.', impact: 'high' },
    ];
    expect(validateInsightCard(card).violationCodes).toContain('insight.opp_measurable');
  });

  it('opp_measurable: measurable opportunity passes (§3.4 wzorzec)', () => {
    const card = goldInsight();
    card.opportunities = [
      {
        title: 'Triage S/M/L skróci medianę lead-time do ≤20 dni',
        description: '60% zleceń to powtarzalne „S"; rozdzielenie ścieżek skróci lead-time z 34 do 20 dni w 6 mies.',
        impact: 'high',
        evidence_refs: ['a1'],
      },
    ];
    expect(validateInsightCard(card).violationCodes).not.toContain('insight.opp_measurable');
  });

  it('signal_type_valid: an unknown signal type fails (§3.9)', () => {
    const card = goldInsight();
    card.signals = [
      { title: 'Coś się dzieje w organizacji między ludźmi a systemem', description: 'x'.repeat(200), type: 'random' },
    ];
    expect(validateInsightCard(card).violationCodes).toContain('insight.signal_type_valid');
  });

  it('snippet_verbatim: an analyst paraphrase snippet fails (§3.14)', () => {
    const card = goldInsight();
    (card.evidence_map as any[])[0].answer_snippet = 'Respondent opisał proces planowania jako suboptymalny.';
    expect(validateInsightCard(card).violationCodes).toContain('insight.snippet_verbatim');
  });

  it('tension_two_sided: a one-sided tension fails (§3.10)', () => {
    const card = goldInsight();
    card.tensions = [{ title: 'Dobrzy vs źli pracownicy', description: 'Jedna strona ma rację.' }];
    expect(validateInsightCard(card).violationCodes).toContain('insight.tension_two_sided');
  });

  it('tension_two_sided: a two-sided grounded tension passes (§3.10 wzorzec)', () => {
    const card = goldInsight();
    card.tensions = [
      {
        title: 'Standaryzacja globalna vs elastyczność lokalna',
        description: 'Oba prawdziwe — program musi rozstrzygnąć, gdzie standaryzować.',
        pole_a: 'COO: bez wspólnych procesów nie ma skali (H3)',
        pole_b: 'Kier. Brno: elastyczność to nasza przewaga (H12)',
      },
    ];
    expect(validateInsightCard(card).violationCodes).not.toContain('insight.tension_two_sided');
  });

  it('pattern_multisource: a single-source "pattern" fails (§3.11)', () => {
    const card = goldInsight();
    card.patterns = [{ title: 'Ludzie narzekają na IT', description: 'Jeden rozmówca to powiedział.' }];
    expect(validateInsightCard(card).violationCodes).toContain('insight.pattern_multisource');
  });

  it('model_heldby: a mental model without held_by/implication fails (§3.12)', () => {
    const card = goldInsight();
    card.mental_models = [{ model: 'Pracownicy boją się zmian', description: 'Stereotyp.' }];
    expect(validateInsightCard(card).violationCodes).toContain('insight.model_heldby');
  });

  it('power_implication: an org-chart power entry without stance/implication fails (§3.13)', () => {
    const card = goldInsight();
    card.power_dynamics = [{ actor: 'Zarząd', description: 'Zarząd ma władzę decyzyjną.' }];
    expect(validateInsightCard(card).violationCodes).toContain('insight.power_implication');
  });

  it('qc_multivoice: quotes from a single role fail (§3.15)', () => {
    const card = goldInsight();
    card.quote_comparison = [
      { title: 'Kto jest właścicielem lead-time?', quotes: [{ role: 'COO', quote: 'To produkcja.' }] },
    ];
    expect(validateInsightCard(card).violationCodes).toContain('insight.qc_multivoice');
  });

  it('readout_sections: a readout missing the six-step chain fails (§3.5)', () => {
    const card = goldInsight();
    card.consulting_readout = `${'Ściana tekstu bez nagłówków. '.repeat(60)}`;
    expect(validateInsightCard(card).violationCodes).toContain('insight.readout_sections');
  });

  it('finding_quote/quote_attribution: SOFT in tools, HARD on the report path (§D20)', () => {
    const card = goldInsight();
    card.key_findings = [{ title: 'Firma stoi przed wyzwaniami', description: 'Ogólnik.' }];
    card.quote_bank = [{ quote: 'Tak, mamy pewne wyzwania.' }]; // brak atrybucji

    const tools = validateInsightCard(card); // ścieżka narzędzi
    expect(tools.violationCodes).toContain('insight.finding_quote');
    expect(tools.violations.find((x) => x.code === 'insight.finding_quote')?.severity).toBe('soft');
    expect(tools.violations.find((x) => x.code === 'insight.quote_attribution')?.severity).toBe('soft');

    const report = validateInsightCard(card, { reportPath: true }); // ścieżka raportu klienta
    expect(report.violations.find((x) => x.code === 'insight.finding_quote')?.severity).toBe('hard');
    expect(report.violations.find((x) => x.code === 'insight.quote_attribution')?.severity).toBe('hard');
    expect(report.pass).toBe(false);
  });

  it('finding_quote: a finding WITH an attributed verbatim quote passes (§3.6 wzorzec)', () => {
    const card = goldInsight();
    card.key_findings = [
      {
        title: 'Największym hamulcem jest warstwa planowania, nie technologia',
        description: 'SAP jest wdrożony i omijany.',
        quote: 'Mój Excel wie więcej niż SAP.',
        role: 'planista, Wrocław (H7)',
      },
    ];
    expect(validateInsightCard(card, { reportPath: true }).violationCodes).not.toContain('insight.finding_quote');
  });

  it('reco_measurable: a recommendation without effect+horizon fails (§3.7)', () => {
    const card = goldInsight();
    card.recommendations = [{ title: 'Usprawnić planowanie', description: 'Trzeba to poprawić.' }];
    expect(validateInsightCard(card).violationCodes).toContain('insight.reco_measurable');
  });
});

// ────────────────────────────────────────────────────────────────────────────
// INITIATIVE
// ────────────────────────────────────────────────────────────────────────────

function goldInitiative(): InitiativeCardInput {
  return {
    title: 'Wdrożyć triage i SLA obsługi zapytań w segmencie kluczowym',
    problem_statement: Array.from({ length: 160 }, (_, i) => `słowo${i}`).join(' '),
    hypothesis: 'Jeśli wdrożymy triage i SLA, to mediana lead-time spadnie do 5 dni, bo każde zapytanie wejdzie w mierzony przepływ.',
    summary: 'Krótkie streszczenie inicjatywy po polsku z jasnym efektem.',
    description: '',
    business_value: 'Odblokowanie 5–10% sprzedaży w segmencie kluczowym.',
    kpis: [{ baseline: '14 dni', target: '5 dni', unit: 'dni' }, { baseline: '60%', target: '90%', unit: '%' }],
    key_risks: [
      { type: 'RISK', description: 'Opór organizacji' },
      { type: 'RISK', description: 'Braki danych baseline' },
      { type: 'ASSUMPTION', description: 'Sponsor dostępny' },
      { type: 'DEPENDENCY', description: 'Wdrożenie CRM' },
    ],
    scope_in: ['Triage zapytań', 'Definicja SLA', 'Mierzenie lead-time'],
    scope_out: ['Narzędzie CRM → N5', 'Szkolenia miękkie', 'Zmiana cennika'],
    deliverables: ['Procedura triage', 'Definicja SLA', 'Dashboard lead-time', 'Playbook obsługi'],
    success_criteria: ['Lead-time ≤5 dni', 'OTIF ≥90%', 'SLA mierzone', 'Kolejka priorytetyzowana'],
    kill_criteria: ['Brak sponsora po 4 tyg.', 'Brak danych baseline po 6 tyg.'],
    milestones: ['Tyg. 1–2 od startu: triage', 'Tyg. 3–6: SLA', 'Mies. 3–6: dashboard'],
    expected_roi: '~5x',
    owner_business_id: 'user-1',
  };
}

describe('validateInitiativeCard (§A3/§B3)', () => {
  it('gold initiative passes with a high score', () => {
    const v = validateInitiativeCard(goldInitiative());
    expect(v.kind).toBe('initiative');
    expect(v.pass).toBe(true);
    expect(v.score).toBeGreaterThanOrEqual(90);
  });

  it('flags non-falsifiable hypothesis as HARD', () => {
    const card = goldInitiative();
    card.hypothesis = 'Poprawimy efektywność obsługi.';
    const v = validateInitiativeCard(card);
    const h = v.violations.find((x) => x.code === 'initiative.hypothesis_format');
    expect(h?.severity).toBe('hard');
    expect(v.pass).toBe(false);
  });

  it('flags KPI without baseline/target/unit as HARD', () => {
    const card = goldInitiative();
    card.kpis = [{ target: '5 dni' }]; // no baseline/unit
    const v = validateInitiativeCard(card);
    expect(v.violationCodes).toContain('initiative.kpi_baseline_target');
    expect(v.violations.find((x) => x.code === 'initiative.kpi_baseline_target')?.severity).toBe('hard');
  });

  it('flags RAID mix violation (HARD)', () => {
    const card = goldInitiative();
    card.key_risks = [{ type: 'RISK', description: 'jedno' }];
    const v = validateInitiativeCard(card);
    expect(v.violationCodes).toContain('initiative.raid_mix');
  });

  it('flags too-few deliverables / success_criteria / kill_criteria (soft)', () => {
    const card = goldInitiative();
    card.deliverables = ['tylko jeden'];
    card.success_criteria = ['jeden'];
    card.kill_criteria = ['jeden'];
    const codes = validateInitiativeCard(card).violationCodes;
    expect(codes).toContain('initiative.deliverables_count');
    expect(codes).toContain('initiative.success_count');
    expect(codes).toContain('initiative.kill_count');
  });

  it('flags generic "Improve X" title without quantification', () => {
    const card = goldInitiative();
    card.title = 'Improve customer service';
    expect(validateInitiativeCard(card).violationCodes).toContain('initiative.title_generic');
  });

  it('flags out-of-range problem_statement length', () => {
    const card = goldInitiative();
    card.problem_statement = 'Za krótko.';
    expect(validateInitiativeCard(card).violationCodes).toContain('initiative.problem_len');
  });

  it('flags placeholder filler as HARD', () => {
    const card = goldInitiative();
    card.summary = 'TODO uzupełnić streszczenie';
    const v = validateInitiativeCard(card);
    expect(v.violations.find((x) => x.code === 'initiative.no_filler')?.severity).toBe('hard');
  });

  it('does not throw on null / empty card', () => {
    expect(() => validateInitiativeCard(null)).not.toThrow();
    expect(validateInitiativeCard({}).pass).toBe(false);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// Dispatcher + repair brief
// ────────────────────────────────────────────────────────────────────────────

describe('validateCard dispatcher + repair brief', () => {
  it('validateCard routes by kind', () => {
    expect(validateCard('insight', goldInsight()).kind).toBe('insight');
    expect(validateCard('initiative', goldInitiative()).kind).toBe('initiative');
  });

  it('buildRepairBriefFromVerdict returns empty string for a clean verdict', () => {
    const v = validateInsightCard(goldInsight());
    expect(buildRepairBriefFromVerdict(v)).toBe('');
  });

  it('buildRepairBriefFromVerdict enumerates codes for a failing verdict', () => {
    const card = goldInsight();
    delete card.material_quality;
    const v = validateInsightCard(card);
    const brief = buildRepairBriefFromVerdict(v);
    expect(brief).toContain('insight.material_quality_complete');
    expect(brief).toContain('CARD_CONTENT_FORMULA');
  });

  it('score floors at 0 and never goes negative on a very bad card', () => {
    const v = validateInsightCard({ title: '', executive_summary: '', themes: [], issues: [], missing_data: [] });
    expect(v.score).toBeGreaterThanOrEqual(0);
    expect(v.pass).toBe(false);
  });
});
