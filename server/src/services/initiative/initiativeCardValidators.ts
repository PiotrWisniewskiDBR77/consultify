/**
 * Initiative card §B3 validators (M13 Depth · Seria K · K1).
 *
 * Deterministic, cheap quality checks from CARD_CONTENT_FORMULA §B3 — a fast
 * complement to the LLM reviewer (G2). ADVISORY per decision Q7 (soft, like the
 * gate soft-block): they surface issues, they never block a save. Each rule maps
 * 1:1 to the formula: lang_pl · no_filler · problem_len · hypothesis_format.
 */

export interface CardValidationIssue {
  rule: string;
  message: string;
}

export type CardRule = 'lang_pl' | 'no_filler' | 'problem_len' | 'hypothesis_format';

// §A5 — acronyms/methodologies allowed inside otherwise-Polish prose.
const ALLOWED_TOKENS = new Set(
  [
    'sipoc',
    'flowchart',
    'raci',
    'raid',
    'kpi',
    'sla',
    'otif',
    'tto',
    'ttr',
    'nps',
    'mece',
    'pmo',
    'wbs',
    'capex',
    'opex',
    'roi',
    'scada',
    'osd',
    'osp',
    'pse',
    'npv',
    'go',
    'no',
  ].map((s) => s.toLowerCase())
);

// Common English function words — their presence in prose signals EN drift.
const EN_STOPWORDS = new Set([
  'the',
  'and',
  'with',
  'this',
  'that',
  'for',
  'are',
  'will',
  'from',
  'which',
  'have',
  'has',
  'these',
  'those',
  'their',
  'them',
  'they',
  'because',
  'should',
  'would',
  'could',
  'about',
  'into',
  'over',
  'between',
  'process',
  'value',
]);

const FILLER_PATTERNS: RegExp[] = [
  /\blorem ipsum\b/i,
  /\bTODO\b/,
  /\bTBD\b/i,
  /\bplaceholder\b/i,
  /\bfoo\b|\bbar\b/i,
  /\bxxx+\b/i,
  /\blik\.{2,}\b/i,
  /\[[^\]]*\]/, // [bracketed placeholder]
  /\bto be (defined|determined|added)\b/i,
];

const HYPOTHESIS_RE = /Jeśli .+ to .+ (bo|ponieważ) .+/i;

function words(text: string): string[] {
  return String(text || '')
    .toLowerCase()
    .split(/[^a-ząćęłńóśźż0-9]+/)
    .filter(Boolean);
}

/**
 * Run the requested §B3 rules against a card field's text. Returns the issues
 * found (empty = clean). Default runs the two universal rules (lang_pl,
 * no_filler).
 */
export function validateCardContent(
  text: string,
  rules: CardRule[] = ['lang_pl', 'no_filler']
): CardValidationIssue[] {
  const issues: CardValidationIssue[] = [];
  const raw = String(text || '').trim();
  if (!raw) return issues; // empty handled by empty_fields_justified elsewhere

  if (rules.includes('lang_pl')) {
    const enHits = new Set(words(raw).filter((w) => EN_STOPWORDS.has(w) && !ALLOWED_TOKENS.has(w)));
    if (enHits.size >= 2) {
      issues.push({
        rule: 'lang_pl',
        message: `Proza wygląda na angielską (np. ${[...enHits].slice(0, 3).join(', ')}). Karta powinna być po polsku.`,
      });
    }
  }

  if (rules.includes('no_filler')) {
    const hit = FILLER_PATTERNS.find((re) => re.test(raw));
    if (hit) {
      issues.push({
        rule: 'no_filler',
        message: 'Wykryto placeholder / wypełniacz — uzupełnij treścią.',
      });
    }
  }

  if (rules.includes('problem_len')) {
    const n = words(raw).length;
    if (n < 120 || n > 250) {
      issues.push({
        rule: 'problem_len',
        message: `Opis problemu ma ${n} słów (oczekiwane 120–250).`,
      });
    }
  }

  if (rules.includes('hypothesis_format')) {
    if (!HYPOTHESIS_RE.test(raw)) {
      issues.push({
        rule: 'hypothesis_format',
        message: 'Hipoteza powinna mieć format „Jeśli … to … bo/ponieważ …".',
      });
    }
  }

  return issues;
}

/* ────────────────────────────────────────────────────────────────────────────
 * §B3 STRUCTURAL validators (Uspójnienie F3.1).
 *
 * The four rules above check a single prose *field*; the ten below check the
 * *shape* of a whole initiative card (counts, mixes, presence of sizing/owner).
 * Each is a pure, deterministic function `(card) => Result`. ADVISORY like the
 * rest — they surface a fail with a readable PL reason, they never throw, and
 * they tolerate missing fields (treat absent as empty rather than crashing).
 *
 * Field-source assumptions (canonical InitiativeDefinitionService columns, with
 * common aliases tolerated):
 *   - kpis:            card.kpis | card.kpi | card.success_criteria (array of
 *                      objects {baseline,target,unit} or strings)
 *   - RAID:            card.key_risks | card.raid | card.raid_log (items carry a
 *                      `type`/`category` of RISK|ASSUMPTION|ISSUE|DEPENDENCY)
 *   - scope_in/out:    card.scope_in / card.scope_out (string[] or string)
 *   - deliverables:    card.deliverables
 *   - success_criteria:card.success_criteria
 *   - kill_criteria:   card.kill_criteria
 *   - milestones:      card.milestones
 *   - sizing/ROI:      card.cost_capex | card.cost_opex | card.expected_roi
 *   - owner:           card.owner_business_id | card.ownerId | card.owner_id
 * ──────────────────────────────────────────────────────────────────────────── */

export type CardStructRule =
  | 'kpi_baseline_target'
  | 'raid_mix'
  | 'scope_out_mece'
  | 'scope_in_count'
  | 'deliverables_count'
  | 'success_count'
  | 'kill_count'
  | 'milestones_count'
  | 'roi_sizing'
  | 'owner_assigned';

export interface CardValidationResult {
  id: CardStructRule;
  pass: boolean;
  reason: string;
}

/** Loosely-typed initiative card — every field optional, validators tolerate absence. */
export interface InitiativeCardData {
  kpis?: unknown;
  kpi?: unknown;
  key_risks?: unknown;
  raid?: unknown;
  raid_log?: unknown;
  scope_in?: unknown;
  scope_out?: unknown;
  deliverables?: unknown;
  success_criteria?: unknown;
  kill_criteria?: unknown;
  milestones?: unknown;
  cost_capex?: unknown;
  cost_opex?: unknown;
  expected_roi?: unknown;
  owner_business_id?: unknown;
  ownerId?: unknown;
  owner_id?: unknown;
  [k: string]: unknown;
}

type Card = InitiativeCardData | null | undefined;

/** Coerce any field into an array of items (tolerant: undefined→[], scalar→[scalar], JSON string→parsed). */
function asArray(value: unknown): unknown[] {
  if (value == null) return [];
  if (Array.isArray(value)) return value.filter((v) => v != null && v !== '');
  if (typeof value === 'string') {
    const s = value.trim();
    if (!s) return [];
    if (s.startsWith('[')) {
      try {
        const parsed = JSON.parse(s);
        return Array.isArray(parsed) ? parsed.filter((v) => v != null && v !== '') : [s];
      } catch {
        // not JSON — fall through to single item
      }
    }
    return [s];
  }
  return [value];
}

/** Treat a value as "present" for sizing/owner checks (non-empty string, finite non-NaN number). */
function isPresent(value: unknown): boolean {
  if (value == null) return false;
  if (typeof value === 'number') return Number.isFinite(value) && value !== 0;
  if (typeof value === 'string') return value.trim().length > 0;
  return Boolean(value);
}

/** Pick a RAID item's category/type label, upper-cased; '' when unknown. */
function raidKind(item: unknown): string {
  if (item == null) return '';
  if (typeof item === 'string') return item.trim().toUpperCase();
  if (typeof item === 'object') {
    const o = item as Record<string, unknown>;
    const raw = o.type ?? o.category ?? o.kind ?? o.raid_type ?? o.raidType;
    return raw == null ? '' : String(raw).trim().toUpperCase();
  }
  return '';
}

/** A KPI item has a usable baseline→target with a unit. */
function kpiHasBaselineTargetUnit(item: unknown): boolean {
  if (item == null || typeof item !== 'object') return false;
  const o = item as Record<string, unknown>;
  const baseline = o.baseline ?? o.base ?? o.from ?? o.current;
  const target = o.target ?? o.goal ?? o.to;
  const unit = o.unit ?? o.units ?? o.measure ?? o.uom;
  return isPresent(baseline) && isPresent(target) && isPresent(unit);
}

const pass = (id: CardStructRule, reason: string): CardValidationResult => ({
  id,
  pass: true,
  reason,
});
const fail = (id: CardStructRule, reason: string): CardValidationResult => ({
  id,
  pass: false,
  reason,
});

function countReason(label: string, n: number, min: number): string {
  return `${label}: ${n} (wymagane ≥${min}).`;
}

// 1. ≥1 KPI with baseline→target + unit.
export function kpiBaselineTarget(card: Card): CardValidationResult {
  const id: CardStructRule = 'kpi_baseline_target';
  const kpis = asArray(card?.kpis ?? card?.kpi);
  if (kpis.length === 0)
    return fail(id, 'Brak KPI — wymagany ≥1 KPI z baseline→target i jednostką.');
  const ok = kpis.some(kpiHasBaselineTargetUnit);
  return ok
    ? pass(id, 'Co najmniej jeden KPI ma baseline, target i jednostkę.')
    : fail(id, 'Żaden KPI nie ma kompletu baseline + target + jednostka.');
}

// 2. ≥2 RISK + ≥1 ASSUMPTION + ≥1 DEPENDENCY.
export function raidMix(card: Card): CardValidationResult {
  const id: CardStructRule = 'raid_mix';
  const items = asArray(card?.key_risks ?? card?.raid ?? card?.raid_log);
  if (items.length === 0)
    return fail(id, 'Brak wpisów RAID — wymagane ≥2 RISK + ≥1 ASSUMPTION + ≥1 DEPENDENCY.');
  let risks = 0;
  let assumptions = 0;
  let dependencies = 0;
  for (const it of items) {
    const k = raidKind(it);
    if (k.startsWith('RISK') || k.startsWith('RYZYK')) risks += 1;
    else if (k.startsWith('ASSUMP') || k.startsWith('ZAŁOŻ') || k.startsWith('ZALOZ'))
      assumptions += 1;
    else if (k.startsWith('DEPEND') || k.startsWith('ZALEŻ') || k.startsWith('ZALEZ'))
      dependencies += 1;
  }
  const ok = risks >= 2 && assumptions >= 1 && dependencies >= 1;
  return ok
    ? pass(
        id,
        `Mix RAID spełniony (RISK ${risks}, ASSUMPTION ${assumptions}, DEPENDENCY ${dependencies}).`
      )
    : fail(
        id,
        `Mix RAID niespełniony — RISK ${risks}/2, ASSUMPTION ${assumptions}/1, DEPENDENCY ${dependencies}/1.`
      );
}

// 3. scope_out ≥3.
export function scopeOutMece(card: Card): CardValidationResult {
  const id: CardStructRule = 'scope_out_mece';
  const n = asArray(card?.scope_out).length;
  return n >= 3
    ? pass(id, `Poza zakresem: ${n} pozycji.`)
    : fail(id, countReason('Poza zakresem (scope_out)', n, 3));
}

// 4. scope_in ≥3.
export function scopeInCount(card: Card): CardValidationResult {
  const id: CardStructRule = 'scope_in_count';
  const n = asArray(card?.scope_in).length;
  return n >= 3
    ? pass(id, `W zakresie: ${n} pozycji.`)
    : fail(id, countReason('W zakresie (scope_in)', n, 3));
}

// 5. deliverables ≥4.
export function deliverablesCount(card: Card): CardValidationResult {
  const id: CardStructRule = 'deliverables_count';
  const n = asArray(card?.deliverables).length;
  return n >= 4
    ? pass(id, `Produkty/rezultaty: ${n}.`)
    : fail(id, countReason('Produkty (deliverables)', n, 4));
}

// 6. success_criteria ≥4.
export function successCount(card: Card): CardValidationResult {
  const id: CardStructRule = 'success_count';
  const n = asArray(card?.success_criteria).length;
  return n >= 4
    ? pass(id, `Kryteria sukcesu: ${n}.`)
    : fail(id, countReason('Kryteria sukcesu (success_criteria)', n, 4));
}

// 7. kill_criteria ≥2.
export function killCount(card: Card): CardValidationResult {
  const id: CardStructRule = 'kill_count';
  const n = asArray(card?.kill_criteria).length;
  return n >= 2
    ? pass(id, `Kryteria zatrzymania: ${n}.`)
    : fail(id, countReason('Kryteria stop (kill_criteria)', n, 2));
}

// 8. milestones ≥3.
export function milestonesCount(card: Card): CardValidationResult {
  const id: CardStructRule = 'milestones_count';
  const n = asArray(card?.milestones).length;
  return n >= 3
    ? pass(id, `Kamienie milowe: ${n}.`)
    : fail(id, countReason('Kamienie milowe (milestones)', n, 3));
}

// 9. ≥1 of cost_capex | cost_opex | expected_roi present.
export function roiSizing(card: Card): CardValidationResult {
  const id: CardStructRule = 'roi_sizing';
  const present = [card?.cost_capex, card?.cost_opex, card?.expected_roi].filter(isPresent).length;
  return present >= 1
    ? pass(id, 'Oszacowanie (CAPEX/OPEX/ROI) obecne.')
    : fail(
        id,
        'Brak oszacowania — uzupełnij co najmniej jedno z: cost_capex, cost_opex, expected_roi.'
      );
}

// 10. owner present (owner_business_id | ownerId | owner_id).
export function ownerAssigned(card: Card): CardValidationResult {
  const id: CardStructRule = 'owner_assigned';
  const ok =
    isPresent(card?.owner_business_id) || isPresent(card?.ownerId) || isPresent(card?.owner_id);
  return ok
    ? pass(id, 'Właściciel inicjatywy przypisany.')
    : fail(id, 'Brak właściciela — przypisz owner_business_id (lub ownerId).');
}

/** Registry of structural validators, keyed by rule id (stable order). */
export const CARD_STRUCT_VALIDATORS: Record<CardStructRule, (card: Card) => CardValidationResult> =
  {
    kpi_baseline_target: kpiBaselineTarget,
    raid_mix: raidMix,
    scope_out_mece: scopeOutMece,
    scope_in_count: scopeInCount,
    deliverables_count: deliverablesCount,
    success_count: successCount,
    kill_count: killCount,
    milestones_count: milestonesCount,
    roi_sizing: roiSizing,
    owner_assigned: ownerAssigned,
  };

/**
 * Run all (or a subset of) structural §B3 validators against an initiative card.
 * Returns one result per rule (pass or fail with a PL reason). Never throws.
 */
export function validateCardStructure(
  card: Card,
  rules: CardStructRule[] = Object.keys(CARD_STRUCT_VALIDATORS) as CardStructRule[]
): CardValidationResult[] {
  return rules.map((rule) => CARD_STRUCT_VALIDATORS[rule](card));
}
