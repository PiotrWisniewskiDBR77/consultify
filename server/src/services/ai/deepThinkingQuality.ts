/**
 * Deep Thinking Quality Gate (Enterprise MVP)
 *
 * Heuristic, language-tolerant validator that checks for decision-grade structure
 * and key consulting elements (trade-offs, assumptions/gaps, boundary conditions, early signals).
 *
 * Important:
 * - This must NOT reward length. It should reward clarity + completeness.
 * - It must be cheap to run (no model calls).
 */

export type DeepThinkingDoDResult = {
  ok: boolean;
  missing: string[];
};

export type DeepThinkingRubricScore = {
  total: number; // 0..12
  criteria: Record<
    | 'structure'
    | 'framing'
    | 'options'
    | 'recommendation'
    | 'risks'
    | 'actionability',
    0 | 1 | 2
  >;
  notes: string[];
};

function hasAny(text: string, needles: string[]): boolean {
  const t = text.toLowerCase();
  return needles.some((n) => t.includes(n.toLowerCase()));
}

function extractSection(text: string, headingNeedles: string[]): string | null {
  const lines = String(text || '').split('\n');
  const idx = lines.findIndex((l) => hasAny(l, headingNeedles));
  if (idx < 0) return null;

  const out: string[] = [];
  for (let i = idx + 1; i < lines.length; i += 1) {
    const line = lines[i] || '';
    // Stop on next heading-ish line (very heuristic)
    if (i > idx + 1 && /^[A-ZĄĆĘŁŃÓŚŹŻ][A-Za-zĄĆĘŁŃÓŚŹŻąćęłńóśźż\s&+/-]{2,}$/.test(line.trim())) {
      break;
    }
    out.push(line);
  }
  return out.join('\n').trim();
}

function countListItems(text: string): number {
  const t = String(text || '');
  const items = t.match(/^\s*(?:-|\*|\d+\.)\s+\S+/gm);
  return items ? items.length : 0;
}

function extractOptions(text: string): string[] {
  const optionsSection = extractSection(text, ['options', 'opcje', 'warianty']);
  if (!optionsSection) return [];
  const lines = optionsSection.split('\n');
  const items: string[] = [];
  for (const l of lines) {
    const m = l.match(/^\s*(?:-|\*|\d+\.)\s+(.+)\s*$/);
    if (m?.[1]) items.push(m[1].trim());
  }
  // Deduplicate by normalized form
  const seen = new Set<string>();
  const uniq: string[] = [];
  for (const it of items) {
    const norm = it.toLowerCase().replace(/[^a-ząćęłńóśźż0-9\s]/gi, '').replace(/\s+/g, ' ').trim();
    if (!norm) continue;
    if (seen.has(norm)) continue;
    seen.add(norm);
    uniq.push(it);
  }
  return uniq;
}

export function validateDeepThinkingDoD(text: string, language?: string): DeepThinkingDoDResult {
  const t = String(text || '').trim();
  if (!t) return { ok: false, missing: ['empty_output'] };

  // Accept both EN/PL headings (models may translate)
  const required: Array<{ key: string; needles: string[] }> = [
    { key: 'executive_summary', needles: ['executive summary', 'podsumowanie', 'streszczenie'] },
    { key: 'problem_framing', needles: ['problem framing', 'ramy problemu', 'definicja problemu'] },
    { key: 'options', needles: ['options', 'opcje', 'warianty'] },
    { key: 'recommendation', needles: ['recommendation', 'rekomendacja', 'zalecenie'] },
    { key: 'risks', needles: ['risks', 'ryzyka', 'blind spots', 'ślepe plamki'] },
    { key: 'next_actions', needles: ['next actions', 'kolejne kroki', 'następne kroki', 'checklista'] },
  ];

  const missing = required.filter((r) => !hasAny(t, r.needles)).map((r) => r.key);

  // Options: require 2–4 distinct items (consulting standard); do not reward dumping 10 options.
  const options = extractOptions(t);
  if (hasAny(t, ['options', 'opcje', 'warianty'])) {
    if (options.length < 2) missing.push('min_two_options');
    if (options.length > 4) missing.push('too_many_options');
  }

  // Framing: "what if we do nothing" must be present (explicitly or semantically close)
  const ifDoNothingNeedles = [
    'if we do nothing',
    'do nothing',
    'no action',
    'status quo',
    'if nothing changes',
    // PL
    'jeśli nic nie zrobimy',
    'nic nie zrobimy',
    'brak działania',
    'status quo',
    'bez zmian',
  ];
  if (!hasAny(t, ifDoNothingNeedles)) missing.push('framing_if_do_nothing');

  // Trade-offs must be explicit (at least once)
  const tradeoffNeedles = [
    'trade-off',
    'tradeoff',
    'trade offs',
    'tension',
    'compromise',
    // PL
    'kompromis',
    'trade-off',
    'kosztem',
    'w zamian',
    'balans',
  ];
  if (!hasAny(t, tradeoffNeedles)) missing.push('tradeoffs_missing');

  // Boundary conditions in recommendation (unless/if-only-if/etc.)
  const boundaryNeedles = [
    'unless',
    'only if',
    'if and only if',
    'if ',
    'when ',
    // PL
    'chyba że',
    'pod warunkiem',
    'jeśli',
    'gdy',
    'nie działa gdy',
  ];
  if (!hasAny(t, boundaryNeedles)) missing.push('boundary_conditions_missing');

  // Assumptions & gaps: must declare unknowns explicitly
  const assumptionsNeedles = [
    'assumption',
    'assumptions',
    'unknown',
    'we don’t know',
    'gap',
    'missing data',
    // PL
    'założen',
    'nie wiemy',
    'brak danych',
    'luka',
    'hipotez',
  ];
  if (!hasAny(t, assumptionsNeedles)) missing.push('assumptions_or_gaps_missing');

  // Next actions: must be checklist-like AND include early signals/monitoring
  const nextActionsSection = extractSection(t, ['next actions', 'kolejne kroki', 'następne kroki', 'checklista']);
  if (nextActionsSection) {
    if (countListItems(nextActionsSection) < 2) missing.push('next_actions_checklist_too_short');
  }
  const earlySignalsNeedles = [
    'early signal',
    'leading indicator',
    'monitor',
    'watch',
    'signal',
    // PL
    'wczesne sygna',
    'wskaźnik',
    'monitoruj',
    'obserwuj',
    'sygnał',
  ];
  if (!hasAny(t, earlySignalsNeedles)) missing.push('early_signals_missing');

  // Anti-garbage: long but empty outputs should fail (prevent "pretty headings only").
  const exec = extractSection(t, ['executive summary', 'podsumowanie', 'streszczenie']) || '';
  if (t.length > 1800 && exec.replace(/\s+/g, ' ').trim().length < 40) missing.push('executive_summary_too_thin');

  return { ok: missing.length === 0, missing };
}

export function scoreDeepThinkingRubric(text: string, language?: string): DeepThinkingRubricScore {
  const t = String(text || '').trim();
  const notes: string[] = [];
  if (!t) {
    return {
      total: 0,
      criteria: {
        structure: 0,
        framing: 0,
        options: 0,
        recommendation: 0,
        risks: 0,
        actionability: 0,
      },
      notes: ['empty_output'],
    };
  }

  const dod = validateDeepThinkingDoD(t, language);
  const hasStructure = dod.missing.filter((m) => m.endsWith('_summary') || m.includes('framing') || m === 'options' || m === 'recommendation' || m === 'risks' || m === 'next_actions').length === 0;

  const structure: 0 | 1 | 2 = hasStructure ? 2 : dod.missing.length <= 3 ? 1 : 0;

  const framing: 0 | 1 | 2 =
    dod.missing.includes('problem_framing') || dod.missing.includes('framing_if_do_nothing')
      ? 0
      : 2;
  if (framing < 2) notes.push('framing_missing_elements');

  const options = extractOptions(t);
  const optionsScore: 0 | 1 | 2 =
    options.length >= 2 && options.length <= 4 ? (dod.missing.includes('tradeoffs_missing') ? 1 : 2) : options.length >= 2 ? 1 : 0;
  if (optionsScore < 2) notes.push('options_need_tradeoffs_or_count_fix');

  const recommendation: 0 | 1 | 2 =
    dod.missing.includes('recommendation') ? 0 : dod.missing.includes('boundary_conditions_missing') ? 1 : 2;
  if (recommendation < 2) notes.push('recommendation_needs_boundary_conditions');

  const risks: 0 | 1 | 2 =
    dod.missing.includes('risks') ? 0 : dod.missing.includes('assumptions_or_gaps_missing') ? 1 : 2;
  if (risks < 2) notes.push('risks_need_assumptions_gaps');

  const nextActionsSection = extractSection(t, ['next actions', 'kolejne kroki', 'następne kroki', 'checklista']) || '';
  const actionability: 0 | 1 | 2 =
    !nextActionsSection
      ? 0
      : countListItems(nextActionsSection) >= 2 && !dod.missing.includes('early_signals_missing')
        ? 2
        : 1;
  if (actionability < 2) notes.push('next_actions_need_checklist_and_early_signals');

  const criteria = { structure, framing, options: optionsScore, recommendation, risks, actionability };
  const total = (Object.values(criteria) as number[]).reduce((a, b) => a + b, 0);

  return { total, criteria, notes };
}

