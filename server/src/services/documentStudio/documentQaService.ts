/**
 * Consultify Document Studio — QA Engine (MVP-3 hardening slice).
 *
 * Three QA categories from the vision are implemented deterministically:
 *
 *   - **Brand QA**: scans every paragraph / list item for banned phrases
 *     (default catalog per language) and for register mismatches against
 *     `schema.communicationRegister` (e.g. casual contractions in
 *     `executive` register).
 *   - **Language QA**: enforces language consistency against `schema.language`
 *     (Polish vs English diacritic / character heuristics) and a density
 *     check (average words per block matches `schema.density`).
 *   - **Source QA**: detects sections with non-trivial content but no
 *     `sourceRefs`, blocks marked `isAssumption: true` (which require
 *     source resolution before export), and documents with no `sourceRefs`
 *     at the schema root.
 *
 * All checks are deterministic — no LLM call — so the engine is safe to
 * run on every save / pre-export and is fully auditable. Future categories
 * (Methodology, Executive, Risk, Data, Format, Export, Completeness)
 * are added per the type taxonomy without changing the public envelope.
 *
 * The engine returns a `DocumentQaReport` with one `DocumentQaCategoryReport`
 * per category. `anyBlocking === true` is the signal for the UI / Mode 3
 * export pipeline to soft-block the export when the document type's
 * `requiresApprovalForExport(...)` policy demands a clean QA pass.
 */

import { randomUUID } from 'node:crypto';

import { compareSourceVersionPin } from './documentSourceVersionRegistryService.js';
import type {
  BrandVoiceProfile,
  DocumentBlock,
  DocumentQaCategory,
  DocumentQaCategoryReport,
  DocumentQaFinding,
  DocumentQaReport,
  DocumentQaSeverity,
  DocumentSchema,
  DocumentSourceRef,
  DocumentTemplate,
  DocumentTypeKey,
  FormattingSchema,
  TemplateSectionBlueprint,
} from './documentStudioTypes.js';
import {
  documentChartBlockContent,
  documentSourceRefHasVersionPin,
  isDocumentChartBlock,
  summarizeDocumentChartBlock,
} from './documentStudioTypes.js';

/**
 * Options accepted by `runDocumentQa`. Both the template and the brand
 * voice profile are optional because the QA engine MUST stay useful for
 * Mode 1 (no template) and for tenants that have not activated a custom
 * voice profile yet — the global baseline keeps the contract honest.
 *
 * - `template`: when supplied, Completeness and Methodology switch into
 *   template-aware mode and check blueprint coverage / order on top of
 *   their type-aware baseline.
 * - `brandVoiceProfile`: when supplied AND its `languageScope` matches
 *   the schema's language, Brand QA layers tenant-specific banned
 *   phrases / glossary entries / required keywords on top of the global
 *   catalogue and applies the optional `registerOverride` to pin the
 *   register check stricter than the schema requests. The profile is
 *   resolved by the caller (typically `documentStudioService.runQaForDocument`)
 *   from the active row in `documentBrandVoiceService`.
 */
export interface RunDocumentQaOptions {
  template?: DocumentTemplate | null;
  brandVoiceProfile?: BrandVoiceProfile | null;
  /**
   * Tenant context for the source-drift hard comparator (Slice
   * E5.6.qa.hard). When omitted, hard-drift checks are skipped and
   * the source-drift category falls back to the soft (unpinned)
   * surface only — preserving backward compatibility for callers
   * that do not have a tenant id at hand (test harnesses, dev
   * tools, single-tenant ad-hoc runs).
   */
  organizationId?: string;
}

/**
 * Document types that require a clean QA pass before export. Mode 3 export
 * soft-blocks these types when `runDocumentQa(schema).anyBlocking === true`,
 * unless the caller passes an explicit `qaOverride` (audited).
 *
 * The list is intentionally conservative — only high-stakes deliverables
 * are gated. Drafts and lower-stakes documents (workshop summaries,
 * generic documents, interviews) export freely so consultants can iterate.
 */
export const APPROVAL_GATED_DOCUMENT_TYPES: ReadonlySet<DocumentTypeKey> = new Set<DocumentTypeKey>(
  [
    'decision_memo',
    'board_report',
    'steering_committee_report',
    'business_case',
    'sales_proposal',
    'client_final_report',
    'due_diligence_note',
    'ai_audit_report',
    'internal_policy_document',
  ]
);

export function requiresApprovalForExport(documentType: DocumentTypeKey): boolean {
  return APPROVAL_GATED_DOCUMENT_TYPES.has(documentType);
}

/**
 * Thrown by the export pipeline when the document type is approval-gated
 * and any QA category goes blocking. Carries the full report so the
 * caller / route can render a remediation surface without a second
 * round-trip.
 */
export class QaBlockingError extends Error {
  readonly code = 'qa_blocking';
  readonly report: DocumentQaReport;
  constructor(report: DocumentQaReport) {
    super('QA blocking findings prevent export of an approval-gated document');
    this.name = 'QaBlockingError';
    this.report = report;
  }
}

/**
 * Thrown when the caller passes `qaOverride: true` but their role is not
 * authorized by the `canOverrideQa` policy. The export pipeline raises
 * this error BEFORE running QA so the audit log records the attempt
 * even when QA itself would have passed.
 */
export class QaOverrideUnauthorizedError extends Error {
  readonly code = 'qa_override_unauthorized';
  readonly role: string;
  constructor(role: string) {
    super(
      `Role "${role}" is not authorized to override the export QA gate. Required: SUPERADMIN / OWNER / ADMIN / MANAGER (or equivalent).`
    );
    this.name = 'QaOverrideUnauthorizedError';
    this.role = role;
  }
}

/**
 * Roles authorized to bypass the export QA gate. Mirrors the role
 * vocabulary normalized by `auth.middleware.ts:normalizePermissionRole`
 * (`SUPERADMIN`, `OWNER`, `ADMIN`, `PROJECT_MANAGER`) plus the legacy
 * `MANAGER` alias so callers that haven't been re-normalized still work.
 *
 * Team members, viewers, guests, and clients cannot override; their
 * QA-blocked export attempts must go through the privileged role.
 */
const QA_OVERRIDE_ALLOWED_ROLES: ReadonlySet<string> = new Set([
  'SUPERADMIN',
  'SUPER_ADMIN',
  'OWNER',
  'ADMIN',
  'ADMINISTRATOR',
  'PROJECT_MANAGER',
  'MANAGER',
]);

export function canOverrideQa(role: string | null | undefined): boolean {
  if (!role) return false;
  return QA_OVERRIDE_ALLOWED_ROLES.has(String(role).trim().toUpperCase());
}

const SEVERITY_DEDUCTION: Record<DocumentQaSeverity, number> = {
  low: 5,
  medium: 12,
  high: 25,
};

// -----------------------------------------------------------------------------
// Banned phrase catalogs
// -----------------------------------------------------------------------------

/**
 * Phrases consultants should not ship in deliverables, regardless of language.
 * These map to either fluff (no value) or AI-marker-language ("as an AI...")
 * and ALL-CAPS marketing screams.
 *
 * Matching is case-insensitive and word-boundary based (so "amazing" does not
 * trigger inside "amazingly", but "amazingly" itself does match its own entry).
 */
const BANNED_PHRASES_GLOBAL: ReadonlyArray<string> = [
  'as an ai',
  'as a language model',
  'lorem ipsum',
  'placeholder',
  'TBD',
  'TODO',
];

const BANNED_PHRASES_BY_LANGUAGE: Record<'pl' | 'en', ReadonlyArray<string>> = {
  en: [
    'amazing',
    'incredible',
    'game-changing',
    'world-class',
    'cutting-edge',
    'synergy',
    'leverage best-of-breed',
    'utilize',
    "we'll see",
  ],
  pl: [
    'rewolucyjny',
    'absolutnie najlepszy',
    'światowej klasy',
    'innowacyjny',
    'synergia',
    'na koniec dnia',
  ],
};

/**
 * Casual / hedging markers that must not appear when the document targets the
 * executive register. We intentionally do NOT block them in `professional`
 * or `narrative` registers.
 */
const EXECUTIVE_BANNED_CASUAL: ReadonlyArray<string> = [
  'you guys',
  'kinda',
  'sorta',
  'stuff',
  'thing',
  'i guess',
  'i think',
  'basically',
  'literally',
];

// -----------------------------------------------------------------------------
// Density targets (words per editable block)
// -----------------------------------------------------------------------------

const DENSITY_TARGETS = {
  concise: { min: 12, max: 60 },
  standard: { min: 30, max: 120 },
  detailed: { min: 60, max: 220 },
  comprehensive: { min: 100, max: 400 },
} as const;

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function blockToText(block: DocumentBlock): string {
  const content = block.content;
  if (!content || typeof content !== 'object') return '';
  const payload = content as Record<string, unknown>;
  if (typeof payload.text === 'string') return payload.text;
  if (Array.isArray(payload.items)) {
    return payload.items.map((item) => String(item)).join('\n');
  }
  return '';
}

function isEditableBlock(block: DocumentBlock): boolean {
  const type = String(block.type || '').toLowerCase();
  return (
    type === 'paragraph' ||
    type === 'heading' ||
    type === 'bullet_list' ||
    type === 'numbered_list' ||
    type === 'callout' ||
    type === 'quote'
  );
}

function blockHasRenderableContent(block: DocumentBlock): boolean {
  if (isEditableBlock(block)) return blockToText(block).trim().length > 0;
  const content = block.content as Record<string, unknown> | null | undefined;
  if (!content) return false;
  const type = String(block.type || '').toLowerCase();
  if (type === 'table' || type === 'risk_table') {
    const rows = Array.isArray(content.rows) ? content.rows : [];
    return rows.some((row) =>
      Array.isArray(row) ? row.some((cell) => String(cell ?? '').trim().length > 0) : false
    );
  }
  if (type === 'kpi_strip') {
    const items = Array.isArray(content.items) ? content.items : [];
    return items.some((item) => {
      if (!item || typeof item !== 'object') return false;
      const value = item as Record<string, unknown>;
      return (
        String(value.label ?? '').trim().length > 0 || String(value.value ?? '').trim().length > 0
      );
    });
  }
  if (type === 'image') {
    return ['src', 'url', 'data', 'assetId'].some(
      (key) => String(content[key] ?? '').trim().length > 0
    );
  }
  if (type === 'chart') {
    return Array.isArray(content.series) && content.series.length > 0;
  }
  if (type === 'footnote' || type === 'citation') {
    return ['text', 'label', 'title', 'citation'].some(
      (key) => String(content[key] ?? '').trim().length > 0
    );
  }
  return false;
}

function countWords(text: string): number {
  if (!text) return 0;
  return text
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter((token) => token.length > 0).length;
}

function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function findPhraseMatches(haystack: string, needles: ReadonlyArray<string>): string[] {
  const lower = haystack.toLowerCase();
  const hits: string[] = [];
  for (const needle of needles) {
    const trimmed = needle.trim();
    if (!trimmed) continue;
    const pattern = new RegExp(`\\b${escapeRegex(trimmed.toLowerCase())}\\b`, 'i');
    if (pattern.test(lower)) hits.push(trimmed);
  }
  return hits;
}

const POLISH_DIACRITICS = /[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/;
// Common Polish stopwords / words that don't share their form with English.
const POLISH_TOKEN_HINTS =
  /\b(jest|oraz|które|które?|nasze|naszej|naszych|naszą|przez|firmy|projekt|projektu|raporcie|raportu|stronie|między|wynika|wynikają|wynikać|należy|powinien|powinna|można|mamy|jeśli|gdy|natomiast|wówczas|aby|żeby|dlatego|ponieważ|jednakże|ponadto)\b/i;
const ENGLISH_TOKEN_HINTS =
  /\b(the|and|with|of|to|for|that|this|these|those|will|should|would|could|because|however|moreover|therefore|whereas|while|across|within|between|provide|provides|provided|deliver|delivers|delivered|impact|outcome|outcomes|recommend|recommends|recommended)\b/i;

function detectLanguageOfText(text: string): 'pl' | 'en' | 'unknown' {
  const trimmed = text.trim();
  if (trimmed.length < 8) return 'unknown';
  if (POLISH_DIACRITICS.test(trimmed)) return 'pl';
  if (POLISH_TOKEN_HINTS.test(trimmed)) return 'pl';
  if (ENGLISH_TOKEN_HINTS.test(trimmed)) return 'en';
  return 'unknown';
}

function makeFinding(
  severity: DocumentQaSeverity,
  message: string,
  code: string,
  options: { sectionId?: string; blockId?: string } = {}
): DocumentQaFinding {
  return {
    findingId: `qa_${randomUUID()}`,
    severity,
    message,
    code,
    sectionId: options.sectionId,
    blockId: options.blockId,
  };
}

function scoreFromFindings(findings: DocumentQaFinding[]): number {
  let total = 100;
  for (const f of findings) total -= SEVERITY_DEDUCTION[f.severity];
  return Math.max(0, Math.min(100, total));
}

function categoryReport(
  category: DocumentQaCategory,
  findings: DocumentQaFinding[],
  blockingThreshold: number,
  summaryFn: (score: number, findings: DocumentQaFinding[]) => string
): DocumentQaCategoryReport {
  const score = scoreFromFindings(findings);
  return {
    category,
    score,
    findings,
    blocking: score < blockingThreshold,
    summary: summaryFn(score, findings),
  };
}

// -----------------------------------------------------------------------------
// Section-title heuristics (PL + EN)
// -----------------------------------------------------------------------------

const STOPWORDS_TITLE = new Set<string>([
  // EN
  'and',
  'or',
  'of',
  'the',
  'a',
  'an',
  'to',
  'for',
  'in',
  'on',
  'with',
  'by',
  'at',
  'into',
  // PL
  'i',
  'oraz',
  'do',
  'na',
  'w',
  'z',
  'o',
  'dla',
  'po',
  'pod',
  'nad',
  'bez',
]);

function normalizeTitle(title: string): string[] {
  return title
    .toLowerCase()
    .normalize('NFD')
    .replace(/ł/g, 'l')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length > 0 && !STOPWORDS_TITLE.has(token));
}

/**
 * Returns true when every significant token of the blueprint title appears
 * (in any order) in the section title. This tolerates Mode 3 reworded
 * titles like "Findings — operational diagnostic" still satisfying the
 * blueprint's "Findings" entry.
 */
function fuzzyMatchTitle(blueprintTitle: string, sectionTitle: string): boolean {
  const blueprintTokens = normalizeTitle(blueprintTitle);
  if (blueprintTokens.length === 0) return false;
  const sectionTokens = new Set(normalizeTitle(sectionTitle));
  return blueprintTokens.every((token) => sectionTokens.has(token));
}

const EXEC_SUMMARY_HINTS: ReadonlyArray<string> = [
  'executive summary',
  'tl dr',
  'tldr',
  'streszczenie zarzadcze',
  'streszczenie',
  'podsumowanie zarzadcze',
  'decision summary',
  'key takeaways',
];

const DECISION_SECTION_HINTS: ReadonlyArray<string> = [
  'recommendations',
  'recommended actions',
  'next steps',
  'next-steps',
  'action items',
  'decisions',
  'decisions required',
  'rekomendacje',
  'kolejne kroki',
  'decyzje',
  'wnioski i rekomendacje',
  'zalecenia',
];

const METHODOLOGY_SECTION_HINTS_QA: ReadonlyArray<string> = [
  'methodology',
  'approach',
  'scope and methodology',
  'scope methodology',
  'metodologia',
  'podejscie',
  'zakres prac',
  'zakres i metodologia',
];

const ASSUMPTIONS_SECTION_HINTS_QA: ReadonlyArray<string> = [
  'assumptions',
  'scenarios',
  'sensitivity',
  'zalozenia',
  'scenariusze',
  'wrazliwosc',
];

const RISKS_SECTION_HINTS_QA: ReadonlyArray<string> = [
  'risks',
  'risk register',
  'ryzyka',
  'rejestr ryzyk',
];

const APPENDIX_SECTION_HINTS: ReadonlyArray<string> = [
  'appendix',
  'appendices',
  'attachment',
  'zalacznik',
  'zalaczniki',
];

function normalizeForHints(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/ł/g, 'l')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function sectionTitleMatchesAnyHint(title: string, hints: ReadonlyArray<string>): boolean {
  const norm = normalizeForHints(title);
  return hints.some((hint) => norm.includes(hint));
}

function findSectionByHints(
  schema: DocumentSchema,
  hints: ReadonlyArray<string>
): DocumentSchema['sections'][number] | undefined {
  return schema.sections.find((section) => sectionTitleMatchesAnyHint(section.title, hints));
}

/**
 * Document-type policies that drive Completeness / Executive QA.
 *
 * - `EXEC_SUMMARY_REQUIRED`: types where missing Executive Summary is a
 *   blocking finding (executive deliverables that drive a decision).
 * - `DECISION_SECTION_REQUIRED`: types where the document MUST contain a
 *   forward-looking action / next-steps / recommendations section.
 * - `EXECUTIVE_QA_APPLIES`: types where Executive QA's tone / verb /
 *   accountability / time-anchor checks fire at all (others are exempt).
 */
const EXEC_SUMMARY_REQUIRED: ReadonlySet<DocumentTypeKey> = new Set<DocumentTypeKey>([
  'executive_memo',
  'decision_memo',
  'board_report',
  'steering_committee_report',
  'business_case',
  'sales_proposal',
  'client_final_report',
  'due_diligence_note',
  'ai_audit_report',
  'internal_policy_document',
]);

const DECISION_SECTION_REQUIRED: ReadonlySet<DocumentTypeKey> = new Set<DocumentTypeKey>([
  'executive_memo',
  'decision_memo',
  'board_report',
  'steering_committee_report',
  'project_status_report',
  'business_case',
  'sales_proposal',
  'client_final_report',
  'due_diligence_note',
  'ai_audit_report',
  'internal_policy_document',
  'implementation_plan',
  'change_management_plan',
]);

const EXECUTIVE_QA_APPLIES: ReadonlySet<DocumentTypeKey> = new Set<DocumentTypeKey>([
  'executive_memo',
  'decision_memo',
  'board_report',
  'steering_committee_report',
  'business_case',
  'sales_proposal',
  'client_final_report',
  'due_diligence_note',
  'ai_audit_report',
  'internal_policy_document',
]);

const METHODOLOGY_REQUIRED_TYPES: ReadonlySet<DocumentTypeKey> = new Set<DocumentTypeKey>([
  'ai_audit_report',
  'research_report',
  'due_diligence_note',
  'client_final_report',
  'business_case',
]);

const ASSUMPTIONS_REQUIRED_TYPES: ReadonlySet<DocumentTypeKey> = new Set<DocumentTypeKey>([
  'business_case',
  'due_diligence_note',
  'ai_audit_report',
]);

const RISKS_REQUIRED_TYPES: ReadonlySet<DocumentTypeKey> = new Set<DocumentTypeKey>([
  'ai_audit_report',
  'business_case',
  'due_diligence_note',
  'risk_register_report',
  'steering_committee_report',
  'board_report',
  'implementation_plan',
  'change_management_plan',
]);

const RISK_BEARING_TYPES: ReadonlySet<DocumentTypeKey> = RISKS_REQUIRED_TYPES;

const RISK_CRITICAL_TYPES: ReadonlySet<DocumentTypeKey> = new Set<DocumentTypeKey>([
  'risk_register_report',
  'ai_audit_report',
]);

/** Word-count floor per blueprint length hint. */
const BLUEPRINT_MIN_WORDS: Record<string, number> = {
  short: 12,
  medium: 35,
  long: 80,
  comprehensive: 120,
};

// -----------------------------------------------------------------------------
// Brand QA
// -----------------------------------------------------------------------------

/**
 * Decide whether the supplied profile applies to the schema's language.
 * Returns `null` when the profile is missing OR scoped to a different
 * language so the rest of `runBrandQa` can short-circuit cleanly.
 */
function resolveBrandVoiceProfile(
  schema: DocumentSchema,
  profile: BrandVoiceProfile | null | undefined
): BrandVoiceProfile | null {
  if (!profile) return null;
  if (profile.status !== 'active') return null;
  if (profile.languageScope !== 'all' && profile.languageScope !== schema.language) {
    return null;
  }
  return profile;
}

function runBrandQa(
  schema: DocumentSchema,
  profile: BrandVoiceProfile | null = null
): DocumentQaCategoryReport {
  const findings: DocumentQaFinding[] = [];
  const language = schema.language;
  const activeProfile = resolveBrandVoiceProfile(schema, profile);

  // Layer the tenant-specific banned set on top of the global catalogue,
  // then subtract the tenant's escape-hatch entries (case-insensitive).
  const disabledLower = new Set<string>(
    (activeProfile?.disabledGlobalBannedPhrases ?? []).map((p) => p.toLowerCase())
  );
  const bannedBase = [
    ...BANNED_PHRASES_GLOBAL,
    ...(BANNED_PHRASES_BY_LANGUAGE[language] ?? []),
  ].filter((phrase) => !disabledLower.has(phrase.toLowerCase()));
  const tenantBanned = activeProfile?.bannedPhrases ?? [];
  const tenantBannedLower = new Set<string>(tenantBanned.map((p) => p.toLowerCase()));
  const banned = [...bannedBase, ...tenantBanned];

  // Register override pins the register check stricter than the schema
  // requests — e.g. activate the executive casual lexicon even when the
  // schema is `professional`. Falls back to the schema's register.
  const effectiveRegister = activeProfile?.registerOverride ?? schema.communicationRegister;
  const casualForExecutive = effectiveRegister === 'executive' ? EXECUTIVE_BANNED_CASUAL : [];

  // Glossary entries: directed (avoid → prefer). Each `avoid` hit emits a
  // medium finding pointing at the preferred form. Avoid double-flagging
  // when the same phrase is also on the tenant banned list.
  const glossaryEntries = activeProfile?.glossaryEntries ?? [];

  for (const section of schema.sections) {
    for (const block of section.blocks) {
      if (!isEditableBlock(block)) continue;
      const text = blockToText(block);
      if (!text.trim()) continue;

      const bannedHits = findPhraseMatches(text, banned);
      for (const phrase of bannedHits) {
        const phraseLower = phrase.toLowerCase();
        const isTenantBanned = tenantBannedLower.has(phraseLower);
        findings.push(
          makeFinding(
            'medium',
            isTenantBanned
              ? `Brand voice (tenant): avoid "${phrase}" — banned by your organization's brand voice profile.`
              : `Brand voice: avoid "${phrase}" — fluff or marketing-speak that weakens consulting tone.`,
            isTenantBanned ? 'tenant_banned_phrase' : 'banned_phrase',
            { sectionId: section.sectionId, blockId: block.blockId }
          )
        );
      }

      // Glossary suggestions — skip avoids that already fired as banned
      // hits in the same block to keep the report deduplicated.
      if (glossaryEntries.length > 0) {
        const bannedInBlock = new Set(bannedHits.map((p) => p.toLowerCase()));
        const avoidsToCheck = glossaryEntries
          .map((entry) => entry.avoid)
          .filter((avoid) => !bannedInBlock.has(avoid.toLowerCase()));
        const glossaryHits = findPhraseMatches(text, avoidsToCheck);
        for (const phrase of glossaryHits) {
          const entry = glossaryEntries.find((g) => g.avoid.toLowerCase() === phrase.toLowerCase());
          if (!entry) continue;
          findings.push(
            makeFinding(
              'medium',
              `Brand voice (glossary): replace "${entry.avoid}" with "${entry.prefer}"${entry.note ? ` — ${entry.note}` : '.'}`,
              'glossary_replacement',
              { sectionId: section.sectionId, blockId: block.blockId }
            )
          );
        }
      }

      if (casualForExecutive.length > 0) {
        const casualHits = findPhraseMatches(text, casualForExecutive);
        for (const phrase of casualHits) {
          findings.push(
            makeFinding(
              'high',
              `Register mismatch: "${phrase}" is too casual for ${effectiveRegister} register.`,
              'register_mismatch',
              { sectionId: section.sectionId, blockId: block.blockId }
            )
          );
        }
      }

      // Excessive ALL-CAPS run (heuristic: a word of length ≥ 5 in all caps
      // appearing more than 1× in a single block signals shouty marketing).
      const capsRuns = (text.match(/\b[A-ZĄĆĘŁŃÓŚŹŻ]{5,}\b/g) ?? []).filter(
        (token) => !/^[IVXLCDM]+$/.test(token) // exclude roman numerals
      );
      if (capsRuns.length >= 2) {
        findings.push(
          makeFinding(
            'low',
            `Excessive ALL-CAPS in block (${capsRuns.length} occurrences). Reserve ALL-CAPS for acronyms.`,
            'excessive_caps',
            { sectionId: section.sectionId, blockId: block.blockId }
          )
        );
      }
    }
  }

  // Required keywords — assert each must-appear term is present at least
  // once anywhere in the document body. Accumulates a single high
  // finding per missing keyword, attached to the first section so the
  // UI can scroll to a stable anchor (the keyword is a document-level
  // requirement, not a per-block one).
  const requiredKeywords = activeProfile?.requiredKeywords ?? [];
  if (requiredKeywords.length > 0 && schema.sections.length > 0) {
    const fullText = schema.sections
      .flatMap((section) => section.blocks.filter(isEditableBlock).map(blockToText))
      .join('\n');
    const fullTextLower = fullText.toLowerCase();
    const anchorSection = schema.sections[0]!;
    for (const keyword of requiredKeywords) {
      const trimmed = keyword.trim();
      if (!trimmed) continue;
      const pattern = new RegExp(`\\b${escapeRegex(trimmed.toLowerCase())}\\b`, 'i');
      if (!pattern.test(fullTextLower)) {
        findings.push(
          makeFinding(
            'high',
            `Brand voice (required): keyword "${trimmed}" must appear at least once in the document.`,
            'required_keyword_missing',
            { sectionId: anchorSection.sectionId }
          )
        );
      }
    }
  }

  return categoryReport('brand', findings, 70, (score, fs) =>
    fs.length === 0
      ? activeProfile
        ? `Brand voice clean: tenant profile "${activeProfile.name}" applied; no findings.`
        : 'Brand voice clean: no banned phrases, register holds, no shouty caps.'
      : `Brand voice: ${fs.length} finding(s); score ${score}/100.`
  );
}

// -----------------------------------------------------------------------------
// Language QA
// -----------------------------------------------------------------------------

function runLanguageQa(schema: DocumentSchema): DocumentQaCategoryReport {
  const findings: DocumentQaFinding[] = [];
  const target = schema.language;
  const densityRange = DENSITY_TARGETS[schema.density] ?? DENSITY_TARGETS.standard;

  let editableBlockCount = 0;
  let totalWords = 0;
  const isSafetyPlaceholder = (text: string): boolean => {
    const normalized = text.trim();
    return (
      normalized === 'Treść usunięta — niepoparte twierdzenie (założenie do weryfikacji).' ||
      normalized === 'Content removed — unsupported claim (assumption to verify).'
    );
  };

  for (const section of schema.sections) {
    for (const block of section.blocks) {
      if (!isEditableBlock(block)) continue;
      const text = blockToText(block);
      const trimmed = text.trim();
      if (!trimmed) continue;
      const words = countWords(trimmed);

      const detected = detectLanguageOfText(trimmed);
      if (detected !== 'unknown' && detected !== target) {
        findings.push(
          makeFinding(
            'high',
            `Language mismatch: block detected as ${detected.toUpperCase()} but document target is ${target.toUpperCase()}.`,
            'language_mismatch',
            { sectionId: section.sectionId, blockId: block.blockId }
          )
        );
      }

      // Headings and explicit assumptions/removal placeholders are not prose
      // density samples. Counting them made a fully localized PL document
      // remain Language-blocking after fail-closed grounding (OMEGA).
      const densityEligible =
        block.type !== 'heading' && block.isAssumption !== true && !isSafetyPlaceholder(trimmed);
      if (!densityEligible) continue;
      editableBlockCount += 1;
      totalWords += words;

      // Per-block density check: paragraphs that are way under the floor are
      // stubs; way over the ceiling are a hint that the density target was
      // ignored for that block.
      if (words > 0 && words < densityRange.min) {
        findings.push(
          makeFinding(
            'low',
            `Density: block has ${words} words; below the ${schema.density} target (≥ ${densityRange.min}).`,
            'density_under',
            { sectionId: section.sectionId, blockId: block.blockId }
          )
        );
      } else if (words > densityRange.max) {
        findings.push(
          makeFinding(
            'low',
            `Density: block has ${words} words; above the ${schema.density} target (≤ ${densityRange.max}).`,
            'density_over',
            { sectionId: section.sectionId, blockId: block.blockId }
          )
        );
      }
    }
  }

  // Document-level average density (medium severity if persistently off).
  if (editableBlockCount >= 3) {
    const avgWords = Math.round(totalWords / editableBlockCount);
    if (avgWords < densityRange.min * 0.7) {
      findings.push(
        makeFinding(
          'medium',
          `Document density: average ${avgWords} words/block is well below the ${schema.density} floor (${densityRange.min}). The document feels too thin overall.`,
          'document_density_under'
        )
      );
    } else if (avgWords > densityRange.max * 1.3) {
      findings.push(
        makeFinding(
          'medium',
          `Document density: average ${avgWords} words/block exceeds the ${schema.density} ceiling (${densityRange.max}). The document is overweight.`,
          'document_density_over'
        )
      );
    }
  }

  return categoryReport('language', findings, 70, (score, fs) =>
    fs.length === 0
      ? `Language consistency clean: ${target.toUpperCase()} throughout, density on target.`
      : `Language QA: ${fs.length} finding(s); score ${score}/100.`
  );
}

// -----------------------------------------------------------------------------
// Source QA
// -----------------------------------------------------------------------------

const MIN_WORDS_FOR_SOURCE_REQUIREMENT = 12;

function runSourceQa(schema: DocumentSchema): DocumentQaCategoryReport {
  const findings: DocumentQaFinding[] = [];

  // Document-level: no sources at all on a non-trivial document.
  const totalEditableBlocks = schema.sections.reduce(
    (acc, s) => acc + s.blocks.filter(isEditableBlock).length,
    0
  );
  if (schema.sourceRefs.length === 0 && totalEditableBlocks >= 3) {
    findings.push(
      makeFinding(
        'high',
        'Document has no source references at all. Consulting deliverables must cite their inputs.',
        'document_no_sources'
      )
    );
  }

  // Section-level: sections with non-trivial content but no sourceRefs.
  for (const section of schema.sections) {
    let sectionWords = 0;
    let nonAssumptionBlocks = 0;
    let assumptionBlocks = 0;

    for (const block of section.blocks) {
      if (!isEditableBlock(block)) continue;
      const text = blockToText(block);
      const words = countWords(text);
      sectionWords += words;
      if (block.isAssumption) {
        assumptionBlocks += 1;
      } else if (words > 0) {
        nonAssumptionBlocks += 1;
      }

      // Per-block: assumption flagged but no section-level sourceRefs to
      // anchor it. Assumptions are allowed during drafting but must be
      // resolved before export.
      if (block.isAssumption && section.sourceRefs.length === 0) {
        findings.push(
          makeFinding(
            'medium',
            'Block is flagged as an assumption and the section has no source references to resolve it.',
            'unresolved_assumption',
            { sectionId: section.sectionId, blockId: block.blockId }
          )
        );
      }
    }

    if (
      nonAssumptionBlocks > 0 &&
      sectionWords >= MIN_WORDS_FOR_SOURCE_REQUIREMENT &&
      section.sourceRefs.length === 0
    ) {
      findings.push(
        makeFinding(
          'high',
          `Section "${section.title}" has substantive content (${sectionWords} words across ${nonAssumptionBlocks} block(s)) but no source references.`,
          'section_no_sources',
          { sectionId: section.sectionId }
        )
      );
    } else if (
      assumptionBlocks > 0 &&
      nonAssumptionBlocks === 0 &&
      section.sourceRefs.length === 0
    ) {
      // Section is purely assumptions — allowed in drafts, but must be
      // tracked. Lower severity than a content section without sources.
      findings.push(
        makeFinding(
          'low',
          `Section "${section.title}" contains only assumptions and must be sourced or removed before export.`,
          'section_only_assumptions',
          { sectionId: section.sectionId }
        )
      );
    }
  }

  return categoryReport('sources', findings, 70, (score, fs) =>
    fs.length === 0
      ? 'Source coverage clean: every substantive section has at least one source reference.'
      : `Source QA: ${fs.length} finding(s); score ${score}/100.`
  );
}

// -----------------------------------------------------------------------------
// Source-drift QA (Slice E5.6.qa — NFR-17 follow-up).
//
// Builds on the substrate added in slice E5.6: every `DocumentSourceRef`
// may now carry a `sourceVersion` and / or `sourceSnapshotId`. Refs
// without either field are "unpinned" — the document cannot detect
// whether the underlying source has advanced beyond the version the
// author saw at generation time, so an approver cannot confidently
// re-render against an authoritative snapshot.
//
// The category is intentionally NON-BLOCKING (threshold 0) because
// pre-E5.6 schemas legitimately have only unpinned refs and we MUST
// NOT soft-block their export the moment the QA pipeline learns
// about pinning. Findings start as `low` severity advisory chips and
// the FE-E2 right-panel Sources tab uses them to surface a "pin
// snapshot" affordance per ref.
//
// A future follow-up will compare pinned `sourceVersion` against the
// live source registry to flag HARD drift ("source advanced from v3
// to v5 while document was approved against v3"). That requires the
// source registry to expose a per-source latest-version lookup,
// which is out of scope for this slice; we deliver the unpinned-
// detection layer first because it is registry-independent and
// already actionable in the UI.
// -----------------------------------------------------------------------------

interface SourceRefDriftLocation {
  scope: 'document' | 'section' | 'block';
  sectionId?: string;
  blockId?: string;
}

function emitDriftFinding(
  findings: DocumentQaFinding[],
  ref: DocumentSourceRef,
  location: SourceRefDriftLocation,
  organizationId: string | undefined
): void {
  const refLabel = ref.sourceTitle?.trim()
    ? `"${ref.sourceTitle.trim()}"`
    : `${ref.sourceType}:${ref.sourceId}`;
  const where =
    location.scope === 'document'
      ? 'at the artifact level'
      : location.scope === 'section'
        ? 'on a section'
        : 'on a block';

  if (!documentSourceRefHasVersionPin(ref)) {
    findings.push(
      makeFinding(
        'low',
        `Source reference ${refLabel} is not pinned (no sourceVersion / sourceSnapshotId) ${where}; future re-renders cannot detect drift if the underlying source advances.`,
        'source_drift_unpinned',
        { sectionId: location.sectionId, blockId: location.blockId }
      )
    );
    return;
  }

  // Slice E5.6.qa.hard — when the ref IS pinned and we have a
  // tenant context (`organizationId`), consult the per-tenant
  // version registry to detect HARD drift (pinned ≠ latest known
  // version). HARD drift is a `medium`-severity advisory: louder
  // than soft (unpinned) drift but still non-blocking, because
  // gating on it requires explicit approver consent that we don't
  // have yet at the schema level.
  //
  // Refs whose tuple is unknown to the registry (no observations
  // for `(orgId, sourceType, sourceId)`) intentionally do NOT fire
  // a hard-drift finding — that case is the soft-drift territory
  // (the registry simply has no comparison baseline).
  const pinnedVersion = ref.sourceVersion?.trim();
  if (organizationId && pinnedVersion && pinnedVersion.length > 0) {
    try {
      const cmp = compareSourceVersionPin({
        organizationId,
        sourceType: ref.sourceType,
        sourceId: ref.sourceId,
        pinnedSourceVersion: pinnedVersion,
      });
      if (cmp.kind === 'hard_drift') {
        findings.push(
          makeFinding(
            'medium',
            `Source reference ${refLabel} is pinned to v${pinnedVersion} ${where}, but the source registry has since recorded a newer version (v${cmp.latest.sourceVersion} at ${cmp.latest.recordedAt}); re-render or re-pin before approval.`,
            'source_drift_hard',
            { sectionId: location.sectionId, blockId: location.blockId }
          )
        );
      }
    } catch {
      // Defensive: registry hiccups must never fail QA. The pinned
      // ref is treated as in-sync until a future QA run can read
      // the registry successfully.
    }
  }
}

function runSourceDriftQa(
  schema: DocumentSchema,
  organizationId?: string
): DocumentQaCategoryReport {
  const findings: DocumentQaFinding[] = [];

  // Document-level sourceRefs. May exist without per-section / per-block
  // anchoring on early-MVP schemas.
  for (const ref of schema.sourceRefs ?? []) {
    emitDriftFinding(findings, ref, { scope: 'document' }, organizationId);
  }

  // Section + block-level refs.
  for (const section of schema.sections ?? []) {
    for (const ref of section.sourceRefs ?? []) {
      emitDriftFinding(
        findings,
        ref,
        { scope: 'section', sectionId: section.sectionId },
        organizationId
      );
    }
    for (const block of section.blocks ?? []) {
      if (block.sourceRef) {
        emitDriftFinding(
          findings,
          block.sourceRef,
          { scope: 'block', sectionId: section.sectionId, blockId: block.blockId },
          organizationId
        );
      }
    }
  }

  // Threshold = 0 → category is NEVER blocking. NFR-17 wants advisory
  // surfacing for both soft (unpinned) and hard (pinned-but-stale)
  // drift, not export gating. A future slice can flip the threshold
  // once approver consent for hard-drift gating is in place.
  return categoryReport('source_drift', findings, 0, (score, fs) => {
    if (fs.length === 0) {
      return 'Source-drift QA clean: every source reference is pinned and aligned with the latest known version.';
    }
    const hard = fs.filter((f) => f.code === 'source_drift_hard').length;
    const unpinned = fs.filter((f) => f.code === 'source_drift_unpinned').length;
    const parts: string[] = [];
    if (hard > 0) parts.push(`${hard} hard-drift (pinned≠latest)`);
    if (unpinned > 0) parts.push(`${unpinned} unpinned`);
    return `Source-drift QA: ${parts.join(', ')} (advisory); score ${score}/100.`;
  });
}

// -----------------------------------------------------------------------------
// Completeness QA (Sprint 2 — Slice 2.1)
// -----------------------------------------------------------------------------

function isSectionEmpty(section: DocumentSchema['sections'][number]): boolean {
  if (!Array.isArray(section.blocks) || section.blocks.length === 0) return true;
  return !section.blocks.some(blockHasRenderableContent);
}

function runCompletenessQa(
  schema: DocumentSchema,
  template: DocumentTemplate | null
): DocumentQaCategoryReport {
  const findings: DocumentQaFinding[] = [];
  const sections = Array.isArray(schema.sections) ? schema.sections : [];

  if (sections.length === 0) {
    findings.push(
      makeFinding(
        'high',
        'Document has zero sections — there is nothing to render or export.',
        'completeness_no_sections'
      )
    );
  } else {
    for (const section of sections) {
      if (isSectionEmpty(section)) {
        findings.push(
          makeFinding(
            'high',
            `Section "${section.title || section.sectionId}" is empty (no editable blocks or all blocks blank).`,
            'completeness_empty_section',
            { sectionId: section.sectionId }
          )
        );
      }
    }
  }

  // Template-aware: blueprint-required sections that are missing from the
  // schema and per-section length floor.
  if (template) {
    const blueprintRequired = template.sectionBlueprint.filter((s) => s.required);
    for (const required of blueprintRequired) {
      const found = sections.find((section) => fuzzyMatchTitle(required.title, section.title));
      if (!found) {
        findings.push(
          makeFinding(
            'high',
            `Required template section "${required.title}" is missing from the schema.`,
            'completeness_required_section_missing'
          )
        );
      }
    }

    for (const blueprint of template.sectionBlueprint) {
      const lengthHint = blueprint.expectedLengthHint;
      if (!lengthHint) continue;
      const minWords = BLUEPRINT_MIN_WORDS[lengthHint];
      if (!minWords) continue;
      const matchingSection = sections.find((section) =>
        fuzzyMatchTitle(blueprint.title, section.title)
      );
      if (!matchingSection) continue;
      const editableBlocks = matchingSection.blocks.filter(isEditableBlock);
      if (editableBlocks.length === 0) continue;
      const allShort = editableBlocks.every((block) => {
        const text = blockToText(block).trim();
        if (!text) return true;
        return countWords(text) < minWords;
      });
      if (allShort) {
        findings.push(
          makeFinding(
            'low',
            `Section "${matchingSection.title}" is short of the "${lengthHint}" target (≥ ${minWords} words/block).`,
            'completeness_block_too_short',
            { sectionId: matchingSection.sectionId }
          )
        );
      }
    }
  }

  // Type-aware: executive summary requirement.
  if (EXEC_SUMMARY_REQUIRED.has(schema.documentType)) {
    const hasExecSummary =
      sections.length > 0 && Boolean(findSectionByHints(schema, EXEC_SUMMARY_HINTS));
    if (!hasExecSummary) {
      findings.push(
        makeFinding(
          'high',
          `Document type "${schema.documentType}" requires an Executive Summary (or PL: "Streszczenie zarządcze").`,
          'completeness_missing_executive_summary'
        )
      );
    }
  }

  // Type-aware: decision / next-steps / recommendations requirement.
  if (DECISION_SECTION_REQUIRED.has(schema.documentType)) {
    const hasDecisionSection =
      sections.length > 0 && Boolean(findSectionByHints(schema, DECISION_SECTION_HINTS));
    if (!hasDecisionSection) {
      findings.push(
        makeFinding(
          'medium',
          `Document type "${schema.documentType}" should contain a Recommendations / Next Steps / Decisions section.`,
          'completeness_missing_decision_section'
        )
      );
    }
  }

  return categoryReport('completeness', findings, 70, (score, fs) =>
    fs.length === 0
      ? 'Completeness clean: every required section is present and populated.'
      : `Completeness QA: ${fs.length} finding(s); score ${score}/100.`
  );
}

// -----------------------------------------------------------------------------
// Methodology QA (Sprint 2 — Slice 2.2)
// -----------------------------------------------------------------------------

function runMethodologyQa(
  schema: DocumentSchema,
  template: DocumentTemplate | null
): DocumentQaCategoryReport {
  const findings: DocumentQaFinding[] = [];
  const sections = Array.isArray(schema.sections) ? schema.sections : [];

  // Template-aware: order, optional missing, drift.
  if (template) {
    const blueprint = template.sectionBlueprint;

    // Build the indices of blueprint sections in the order they appear in
    // the schema. If the resulting array is not monotonically increasing
    // we have an order mismatch.
    const orderTrace: number[] = [];
    for (const section of sections) {
      const idx = blueprint.findIndex((b) => fuzzyMatchTitle(b.title, section.title));
      if (idx >= 0) orderTrace.push(idx);
    }
    let orderMismatch = false;
    for (let i = 1; i < orderTrace.length; i += 1) {
      const prev = orderTrace[i - 1];
      const curr = orderTrace[i];
      if (prev !== undefined && curr !== undefined && curr < prev) {
        orderMismatch = true;
        break;
      }
    }
    if (orderMismatch) {
      findings.push(
        makeFinding(
          'medium',
          'Section ordering does not match the template blueprint.',
          'methodology_section_order_mismatch'
        )
      );
    }

    for (const bp of blueprint) {
      if (bp.required) continue;
      const present = sections.some((section) => fuzzyMatchTitle(bp.title, section.title));
      if (!present) {
        findings.push(
          makeFinding(
            'low',
            `Optional blueprint section "${bp.title}" is missing.`,
            'methodology_optional_section_missing'
          )
        );
      }
    }

    for (const section of sections) {
      const matched = blueprint.some((b: TemplateSectionBlueprint) =>
        fuzzyMatchTitle(b.title, section.title)
      );
      if (!matched) {
        findings.push(
          makeFinding(
            'low',
            `Section "${section.title}" is not declared in the template blueprint (drift).`,
            'methodology_drift_section',
            { sectionId: section.sectionId }
          )
        );
      }
    }
  }

  // Type-aware: structural sections required regardless of template.
  if (METHODOLOGY_REQUIRED_TYPES.has(schema.documentType)) {
    const hasMethodology = Boolean(findSectionByHints(schema, METHODOLOGY_SECTION_HINTS_QA));
    if (!hasMethodology) {
      findings.push(
        makeFinding(
          'high',
          `Document type "${schema.documentType}" requires a Methodology / Approach / Scope section.`,
          'methodology_missing_methodology_section'
        )
      );
    }
  }

  if (ASSUMPTIONS_REQUIRED_TYPES.has(schema.documentType)) {
    const hasAssumptions = Boolean(findSectionByHints(schema, ASSUMPTIONS_SECTION_HINTS_QA));
    if (!hasAssumptions) {
      findings.push(
        makeFinding(
          'medium',
          `Document type "${schema.documentType}" should contain an Assumptions / Scenarios section.`,
          'methodology_missing_assumptions_section'
        )
      );
    }
  }

  if (RISKS_REQUIRED_TYPES.has(schema.documentType)) {
    const hasRisks = Boolean(findSectionByHints(schema, RISKS_SECTION_HINTS_QA));
    if (!hasRisks) {
      findings.push(
        makeFinding(
          'medium',
          `Document type "${schema.documentType}" should contain a Risks section.`,
          'methodology_missing_risks_section'
        )
      );
    }
  }

  return categoryReport('methodology', findings, 70, (score, fs) =>
    fs.length === 0
      ? 'Methodology clean: blueprint coverage and structural sections present.'
      : `Methodology QA: ${fs.length} finding(s); score ${score}/100.`
  );
}

// -----------------------------------------------------------------------------
// Executive QA (Sprint 2 — Slice 2.3)
// -----------------------------------------------------------------------------

const EXEC_ACTION_VERBS_EN: ReadonlyArray<string> = [
  'recommend',
  'recommends',
  'recommended',
  'approve',
  'approves',
  'approved',
  'decide',
  'decides',
  'decided',
  'authorize',
  'authorise',
  'endorse',
  'commit',
  'mandate',
  'we propose',
  'we recommend',
];

const EXEC_ACTION_VERBS_PL: ReadonlyArray<string> = [
  'rekomendujemy',
  'rekomenduje',
  'decydujemy',
  'zatwierdzamy',
  'akceptujemy',
  'proponujemy',
  'wnosimy',
  'rekomendacja',
  'decyzja',
];

const EXEC_OWNER_TOKENS: ReadonlyArray<string> = [
  'cfo',
  'ceo',
  'coo',
  'cio',
  'cto',
  'chro',
  'pmo',
  'sponsor',
  'owner',
  'steerco',
  'steering committee',
  'sponsor projektu',
  'wlasciciel',
  'wlasciciela',
  'kierownik',
  'dyrektor',
  'zarzad',
];

const EXEC_TIME_ANCHORS =
  /\b(q[1-4]|h[12]|fy\d{2,4}|\d{1,3}\s?(?:days?|day|dni|dzien|tygodni|miesiac|miesiecy)|january|february|march|april|may|june|july|august|september|october|november|december|styczen|luty|marzec|kwiecien|maj|czerwiec|lipiec|sierpien|wrzesien|pazdziernik|listopad|grudzien|by\s+(?:end\s+of\s+)?q[1-4]|do\s+konca\s+q[1-4]|10\/0?\d|0?\d\/0?\d\/\d{2,4}|\d{4}-\d{2}-\d{2}|2026|2025|30\/60\/90)\b/i;

const EXEC_SUMMARY_WORD_BUDGET = 220;

const EXPLICIT_NO_DECISION_PATTERNS: ReadonlyArray<RegExp> = [
  /\bbrief nie wskazuje decyzji do zatwierdzenia\b/i,
  /\bbrak decyzji do (?:podjecia|zatwierdzenia)\b/i,
  /\bnie (?:jest )?wymagana zadna decyzja\b/i,
  /\bno decision (?:is )?(?:requested|required)\b/i,
  /\bthe brief identifies no decision (?:for approval|to approve)\b/i,
];

function runExecutiveQa(schema: DocumentSchema): DocumentQaCategoryReport {
  const findings: DocumentQaFinding[] = [];

  if (!EXECUTIVE_QA_APPLIES.has(schema.documentType)) {
    return categoryReport(
      'executive',
      [],
      70,
      () => 'Executive QA: not applicable to this document type.'
    );
  }

  const execSection = findSectionByHints(schema, EXEC_SUMMARY_HINTS);
  const decisionSection = findSectionByHints(schema, DECISION_SECTION_HINTS);
  if (!execSection) {
    findings.push(
      makeFinding(
        'high',
        `Executive document type "${schema.documentType}" has no Executive Summary section.`,
        'executive_summary_absent'
      )
    );
  } else {
    const editable = execSection.blocks.filter(isEditableBlock);
    const summaryText = editable
      .map((b) => blockToText(b))
      .join(' ')
      .trim();
    const summaryWords = countWords(summaryText);
    if (summaryWords > EXEC_SUMMARY_WORD_BUDGET) {
      findings.push(
        makeFinding(
          'medium',
          `Executive Summary has ${summaryWords} words (>${EXEC_SUMMARY_WORD_BUDGET}). Tighten to a single board-ready paragraph.`,
          'executive_summary_too_long',
          { sectionId: execSection.sectionId }
        )
      );
    }
    const verbs = schema.language === 'pl' ? EXEC_ACTION_VERBS_PL : EXEC_ACTION_VERBS_EN;
    const lower = normalizeForHints(summaryText);
    const hasActionVerb = verbs.some((verb) => lower.includes(normalizeForHints(verb)));
    const decisionTextForAbsence = decisionSection
      ? decisionSection.blocks.map((block) => blockToText(block)).join(' ')
      : '';
    const explicitNoDecisionText = normalizeForHints(
      `${summaryText} ${decisionTextForAbsence}`.trim()
    );
    const explicitlyNoDecision = EXPLICIT_NO_DECISION_PATTERNS.some((pattern) =>
      pattern.test(explicitNoDecisionText)
    );
    if (!hasActionVerb && !explicitlyNoDecision && summaryText.length > 0) {
      findings.push(
        makeFinding(
          'high',
          'Executive Summary contains no action / decision verb (e.g. "recommend", "approve", "rekomendujemy").',
          'executive_summary_missing_action_verb',
          { sectionId: execSection.sectionId }
        )
      );
    }
  }

  if (decisionSection) {
    const editable = decisionSection.blocks.filter(isEditableBlock).filter((b) => {
      const t = blockToText(b).trim();
      return t.length > 0;
    });
    if (editable.length < 2) {
      findings.push(
        makeFinding(
          'medium',
          `Decision section "${decisionSection.title}" has only ${editable.length} actionable block(s); should be ≥ 2.`,
          'executive_thin_decision_section',
          { sectionId: decisionSection.sectionId }
        )
      );
    }
    const decisionText = editable.map((b) => blockToText(b)).join(' ');
    const decisionLower = normalizeForHints(decisionText);
    const hasOwner = EXEC_OWNER_TOKENS.some((token) =>
      decisionLower.includes(normalizeForHints(token))
    );
    if (!hasOwner && decisionText.length > 0) {
      findings.push(
        makeFinding(
          'medium',
          `Decision section "${decisionSection.title}" names no owner / responsible role.`,
          'executive_decisions_without_owner',
          { sectionId: decisionSection.sectionId }
        )
      );
    }
    const hasTime = EXEC_TIME_ANCHORS.test(decisionText);
    if (!hasTime && decisionText.length > 0) {
      findings.push(
        makeFinding(
          'low',
          `Decision section "${decisionSection.title}" contains no time anchor (Q1–Q4, deadline, or day count).`,
          'executive_decisions_without_time_anchor',
          { sectionId: decisionSection.sectionId }
        )
      );
    }
  }

  return categoryReport('executive', findings, 70, (score, fs) =>
    fs.length === 0
      ? 'Executive QA clean: Executive Summary and decision section drive a decision with owner + time anchor.'
      : `Executive QA: ${fs.length} finding(s); score ${score}/100.`
  );
}

// -----------------------------------------------------------------------------
// Risk QA (Sprint 3 — Slice 3.1)
// -----------------------------------------------------------------------------

const RISK_SEVERITY_HINTS_EN: ReadonlyArray<string> = [
  'high',
  'medium',
  'low',
  'critical',
  'severe',
  'p0',
  'p1',
  'p2',
  'p3',
  'rag',
  'red',
  'amber',
  'green',
];

const RISK_SEVERITY_HINTS_PL: ReadonlyArray<string> = [
  'krytyczny',
  'krytyczne',
  'wysoki',
  'wysokie',
  'wysoka',
  'sredni',
  'srednia',
  'srednie',
  'niski',
  'niska',
  'niskie',
  'priorytet',
];

const RISK_MITIGATION_HINTS_EN: ReadonlyArray<string> = [
  'mitigation',
  'mitigated',
  'mitigate',
  'control',
  'controls',
  'remediation',
  'remediate',
  'mitigation plan',
  'parallel poc',
  'retention review',
];

const RISK_MITIGATION_HINTS_PL: ReadonlyArray<string> = [
  'mitygacja',
  'mityguj',
  'plan naprawczy',
  'plan dzialan',
  'kontrola',
  'kontrole',
  'monitoring',
  'monitorowanie',
];

function runRiskQa(schema: DocumentSchema): DocumentQaCategoryReport {
  const findings: DocumentQaFinding[] = [];

  const risksSection = findSectionByHints(schema, RISKS_SECTION_HINTS_QA);

  // Risk-bearing types missing the section entirely.
  if (!risksSection) {
    if (RISK_BEARING_TYPES.has(schema.documentType)) {
      findings.push(
        makeFinding(
          RISK_CRITICAL_TYPES.has(schema.documentType) ? 'high' : 'medium',
          `Document type "${schema.documentType}" requires a Risks section.`,
          'risk_section_missing'
        )
      );
      // Stack a second finding for risk-critical types so the score
      // collapses below the blocking threshold even with a single
      // structural omission.
      if (RISK_CRITICAL_TYPES.has(schema.documentType)) {
        findings.push(
          makeFinding(
            'high',
            'Risk register report without a Risks section is incoherent and cannot be exported.',
            'risk_section_missing_blocks_export'
          )
        );
      }
    }
    return categoryReport('risk', findings, 70, (score, fs) =>
      fs.length === 0
        ? 'Risk QA: not applicable.'
        : `Risk QA: ${fs.length} finding(s); score ${score}/100.`
    );
  }

  // Section exists. Check structural content.
  const editableBlocks = risksSection.blocks.filter(isEditableBlock);
  const populatedEditableBlocks = editableBlocks.filter((b) => blockToText(b).trim().length > 0);
  const riskTableBlocks = risksSection.blocks.filter((b) => String(b.type) === 'risk_table');
  const nonEmptyRiskTables = riskTableBlocks.filter((block) => {
    const content = block.content as Record<string, unknown> | undefined;
    const rows =
      content && Array.isArray((content as { rows?: unknown[] }).rows)
        ? ((content as { rows?: unknown[] }).rows as unknown[])
        : [];
    return rows.length > 0;
  });

  if (populatedEditableBlocks.length === 0 && nonEmptyRiskTables.length === 0) {
    findings.push(
      makeFinding(
        'high',
        'Risks section is empty (no narrative blocks and no populated risk_table).',
        'risk_section_empty',
        { sectionId: risksSection.sectionId }
      )
    );
    if (RISK_CRITICAL_TYPES.has(schema.documentType)) {
      findings.push(
        makeFinding(
          'high',
          'Risk register report has an empty Risks section — export must be blocked.',
          'risk_section_empty_blocks_export',
          { sectionId: risksSection.sectionId }
        )
      );
    }
  } else if (populatedEditableBlocks.length > 0) {
    const sectionText = populatedEditableBlocks.map((b) => blockToText(b)).join(' ');
    const lower = normalizeForHints(sectionText);
    const severityHints =
      schema.language === 'pl' ? RISK_SEVERITY_HINTS_PL : RISK_SEVERITY_HINTS_EN;
    const mitigationHints =
      schema.language === 'pl' ? RISK_MITIGATION_HINTS_PL : RISK_MITIGATION_HINTS_EN;
    const hasSeverity = severityHints.some((hint) => lower.includes(normalizeForHints(hint)));
    if (!hasSeverity) {
      findings.push(
        makeFinding(
          'medium',
          'Risks section contains no severity / impact classification (high / medium / low / critical / RAG / P0–P3).',
          'risk_section_no_severity',
          { sectionId: risksSection.sectionId }
        )
      );
    }
    const hasMitigation = mitigationHints.some((hint) => lower.includes(normalizeForHints(hint)));
    if (!hasMitigation) {
      findings.push(
        makeFinding(
          'medium',
          'Risks section contains no mitigation / control language.',
          'risk_section_no_mitigation',
          { sectionId: risksSection.sectionId }
        )
      );
    }
    const hasOwner = EXEC_OWNER_TOKENS.some((token) => lower.includes(normalizeForHints(token)));
    if (!hasOwner) {
      findings.push(
        makeFinding(
          'low',
          'Risks section names no owner / responsible role.',
          'risk_section_no_owner',
          { sectionId: risksSection.sectionId }
        )
      );
    }
  }

  for (const block of riskTableBlocks) {
    const content = block.content as Record<string, unknown> | undefined;
    const rows =
      content && Array.isArray((content as { rows?: unknown[] }).rows)
        ? ((content as { rows?: unknown[] }).rows as unknown[])
        : [];
    if (rows.length === 0) {
      findings.push(
        makeFinding(
          'medium',
          'Empty `risk_table` block: no rows declared.',
          'risk_empty_risk_table',
          { sectionId: risksSection.sectionId, blockId: block.blockId }
        )
      );
    }
  }

  return categoryReport('risk', findings, 70, (score, fs) =>
    fs.length === 0
      ? 'Risk QA clean: severity, mitigation and ownership present.'
      : `Risk QA: ${fs.length} finding(s); score ${score}/100.`
  );
}

// -----------------------------------------------------------------------------
// Data QA (Sprint 3 — Slice 3.2)
// -----------------------------------------------------------------------------

const CURRENCY_PATTERNS: ReadonlyArray<{ code: string; regex: RegExp }> = [
  { code: 'USD', regex: /\b(?:USD|US\$|\$)\s?\d/i },
  { code: 'EUR', regex: /\b(?:EUR|€)\s?\d/i },
  { code: 'GBP', regex: /\b(?:GBP|£)\s?\d/i },
  { code: 'PLN', regex: /\b(?:PLN|z[ł]?)\s?\d/i },
  { code: 'CHF', regex: /\bCHF\s?\d/i },
];

const FX_CONVERSION_HINTS: ReadonlyArray<string> = [
  'fx',
  'foreign exchange',
  'exchange rate',
  'converted at',
  'converted using',
  'kurs walutowy',
  'kurs wymiany',
  'przeliczone',
  'po kursie',
];

const PERCENT_PATTERN = /([\w \t/_-]{1,40}?)(\d{1,3}(?:[.,]\d+)?)\s?%/g;

const SUSPICIOUS_PLACEHOLDER_PATTERNS: ReadonlyArray<{
  pattern: RegExp;
  severity: DocumentQaSeverity;
}> = [
  { pattern: /\bTBD\b/, severity: 'medium' },
  { pattern: /\bN\/A\b/, severity: 'medium' },
  { pattern: /\bXXX+\b/, severity: 'medium' },
  { pattern: /\bdo uzupelnienia\b/, severity: 'low' },
  { pattern: /\bdo uzupe[ł]nienia\b/, severity: 'low' },
];

const DATE_FORMAT_PATTERNS: ReadonlyArray<{ name: string; regex: RegExp }> = [
  { name: 'iso', regex: /\b\d{4}-\d{2}-\d{2}\b/ },
  { name: 'slash', regex: /\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/ },
  {
    name: 'long_en',
    regex:
      /\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}\b/i,
  },
  {
    name: 'long_pl',
    regex:
      /\b(?:styczen|luty|marzec|kwiecien|maj|czerwiec|lipiec|sierpien|wrzesien|pazdziernik|listopad|grudzien)\s+\d{4}\b/i,
  },
];

function runDataQa(schema: DocumentSchema): DocumentQaCategoryReport {
  const findings: DocumentQaFinding[] = [];

  const detectedCurrencies = new Set<string>();
  let fxMentioned = false;

  // Aggregate placeholder hits and date format names across the document.
  let placeholderHits = 0;
  let placeholderSeverity: DocumentQaSeverity = 'low';
  const detectedDateFormats = new Set<string>();

  // KPI inconsistency: same key noun phrase + percent on different blocks.
  const kpiByKey = new Map<string, Set<string>>();

  for (const section of schema.sections) {
    for (const block of section.blocks) {
      // Empty kpi_strip block (structural).
      if (String(block.type) === 'kpi_strip') {
        const content = block.content as { items?: unknown[] } | undefined;
        const items = Array.isArray(content?.items) ? content?.items : [];
        if (!items || items.length === 0) {
          findings.push(
            makeFinding(
              'medium',
              'Empty `kpi_strip` block: no KPIs declared.',
              'data_empty_kpi_strip',
              { sectionId: section.sectionId, blockId: block.blockId }
            )
          );
        }
        continue;
      }
      if (!isEditableBlock(block)) continue;
      const text = blockToText(block);
      if (!text) continue;
      const normalized = normalizeForHints(text);

      // Currency tokens
      for (const { code, regex } of CURRENCY_PATTERNS) {
        if (regex.test(text)) detectedCurrencies.add(code);
      }
      if (FX_CONVERSION_HINTS.some((hint) => normalized.includes(hint))) {
        fxMentioned = true;
      }

      // KPI percent matches (per-block to avoid cross-line bleed).
      let match: RegExpExecArray | null;
      const blockRegex = new RegExp(PERCENT_PATTERN.source, 'g');
      while ((match = blockRegex.exec(text)) !== null) {
        const keyRaw = (match[1] ?? '').trim();
        const value = match[2] ?? '';
        if (!keyRaw || keyRaw.length < 3) continue;
        const keyTokens = normalizeTitle(keyRaw);
        if (keyTokens.length === 0) continue;
        const key = keyTokens.slice(-2).join('_');
        if (!key) continue;
        const set = kpiByKey.get(key) ?? new Set<string>();
        set.add(value);
        kpiByKey.set(key, set);
      }

      // Placeholder values
      for (const { pattern, severity } of SUSPICIOUS_PLACEHOLDER_PATTERNS) {
        const localPattern = new RegExp(pattern.source, 'gi');
        const hits = text.match(localPattern);
        if (hits && hits.length > 0) {
          placeholderHits += hits.length;
          if (severity === 'medium') placeholderSeverity = 'medium';
        }
      }

      // Date formats
      for (const { name, regex } of DATE_FORMAT_PATTERNS) {
        if (regex.test(text)) detectedDateFormats.add(name);
      }
    }
  }

  if (detectedCurrencies.size > 1 && !fxMentioned) {
    findings.push(
      makeFinding(
        'medium',
        `Mixed currencies (${[...detectedCurrencies].sort().join(', ')}) without an FX / conversion phrase.`,
        'data_currency_mix_without_fx'
      )
    );
  }

  for (const [key, valueSet] of kpiByKey.entries()) {
    if (valueSet.size > 1) {
      findings.push(
        makeFinding(
          'medium',
          `KPI "${key.replace(/_/g, ' ')}" reported with conflicting values: ${[...valueSet].join(', ')}%.`,
          'data_inconsistent_kpi_percent'
        )
      );
    }
  }

  if (placeholderHits > 0) {
    findings.push(
      makeFinding(
        placeholderSeverity,
        `${placeholderHits} placeholder value(s) detected (TBD / N/A / XXX / "do uzupełnienia").`,
        'data_placeholder_values_present'
      )
    );
  }

  if (detectedDateFormats.size >= 3) {
    findings.push(
      makeFinding(
        'medium',
        `Mixed date formats across the document: ${[...detectedDateFormats].sort().join(', ')}.`,
        'data_mixed_date_formats'
      )
    );
  }

  return categoryReport('data', findings, 70, (score, fs) =>
    fs.length === 0
      ? 'Data QA clean: currencies, KPIs and dates are internally consistent.'
      : `Data QA: ${fs.length} finding(s); score ${score}/100.`
  );
}

// -----------------------------------------------------------------------------
// Format QA (Sprint 3 — Slice 3.3)
// -----------------------------------------------------------------------------

function runFormatQa(schema: DocumentSchema): DocumentQaCategoryReport {
  const findings: DocumentQaFinding[] = [];

  // Section-level heading hierarchy: levels MUST not skip (e.g. H1 → H3
  // without an H2 in between).
  let prevSectionLevel: number | null = null;
  for (const section of schema.sections) {
    const level = typeof section.level === 'number' ? section.level : 1;
    if (prevSectionLevel !== null && level > prevSectionLevel + 1) {
      findings.push(
        makeFinding(
          'low',
          `Heading level skip across sections: H${prevSectionLevel} → H${level} (no intermediate level).`,
          'format_heading_level_skip',
          { sectionId: section.sectionId }
        )
      );
    }
    prevSectionLevel = level;

    // Block-level heading skip inside a section's block stream.
    let prevBlockHeadingLevel: number | null = level;
    for (const block of section.blocks) {
      if (String(block.type) === 'heading') {
        const content = block.content as { level?: number } | undefined;
        const headingLevel = typeof content?.level === 'number' ? content.level : 1;
        if (prevBlockHeadingLevel !== null && headingLevel > prevBlockHeadingLevel + 1) {
          findings.push(
            makeFinding(
              'low',
              `Heading level skip inside section "${section.title}": H${prevBlockHeadingLevel} → H${headingLevel}.`,
              'format_block_heading_skip',
              { sectionId: section.sectionId, blockId: block.blockId }
            )
          );
        }
        prevBlockHeadingLevel = headingLevel;
      }
    }

    // Whitespace artifacts: 2+ consecutive empty paragraphs.
    let consecutiveEmpty = 0;
    for (const block of section.blocks) {
      if (String(block.type) === 'paragraph') {
        const text = blockToText(block).trim();
        if (text === '') {
          consecutiveEmpty += 1;
          if (consecutiveEmpty === 2) {
            findings.push(
              makeFinding(
                'low',
                `Two or more consecutive empty paragraphs in section "${section.title}" — collapse them before export.`,
                'format_consecutive_empty_paragraphs',
                { sectionId: section.sectionId, blockId: block.blockId }
              )
            );
          }
        } else {
          consecutiveEmpty = 0;
        }
      } else {
        consecutiveEmpty = 0;
      }
    }

    // Lists and tables.
    for (const block of section.blocks) {
      const type = String(block.type);
      if (type === 'bullet_list' || type === 'numbered_list') {
        const content = block.content as { items?: unknown[] } | undefined;
        const items = Array.isArray(content?.items) ? (content?.items ?? []) : [];
        if (items.length === 0) {
          findings.push(
            makeFinding('low', `Empty list in section "${section.title}".`, 'format_empty_list', {
              sectionId: section.sectionId,
              blockId: block.blockId,
            })
          );
        } else if (items.length === 1) {
          findings.push(
            makeFinding(
              'low',
              `Single-item list in section "${section.title}" — convert to a paragraph.`,
              'format_single_item_list',
              { sectionId: section.sectionId, blockId: block.blockId }
            )
          );
        }
      } else if (type === 'table') {
        const content = block.content as { header?: unknown; rows?: unknown } | undefined;
        const hasHeader =
          Array.isArray(content?.header) && (content?.header as unknown[]).length > 0;
        if (!hasHeader) {
          findings.push(
            makeFinding(
              'medium',
              `Table in section "${section.title}" has no header row.`,
              'format_table_without_header',
              { sectionId: section.sectionId, blockId: block.blockId }
            )
          );
        }
      } else if (type === 'chart') {
        // Slice E17.charts.qa — chart-block validation. Substrate-
        // level checks; richer semantic checks (axis-label fit, color
        // contrast, etc.) defer to the renderer follow-up.
        if (!isDocumentChartBlock(block)) {
          findings.push(
            makeFinding(
              'medium',
              `Chart in section "${section.title}" has malformed payload (missing kind / title / non-finite values).`,
              'format_chart_invalid_payload',
              { sectionId: section.sectionId, blockId: block.blockId }
            )
          );
          continue;
        }
        const summary = summarizeDocumentChartBlock(block);
        if (summary.seriesCount === 0) {
          findings.push(
            makeFinding(
              'medium',
              `Chart "${summary.title ?? '(untitled)'}" in section "${section.title}" has no valid series — at least one series with finite numeric values is required.`,
              'format_chart_no_series',
              { sectionId: section.sectionId, blockId: block.blockId }
            )
          );
        }
        const chart = documentChartBlockContent(block);
        if (chart && Array.isArray(chart.categories) && chart.categories.length > 0) {
          // Series value count must match category count when both
          // are declared (otherwise the renderer falls back to "1, 2, 3"
          // and the labels desynchronize from the bars).
          for (const series of chart.series) {
            if (Array.isArray(series.values) && series.values.length !== chart.categories.length) {
              findings.push(
                makeFinding(
                  'low',
                  `Chart "${summary.title ?? '(untitled)'}" series "${series.label}" has ${series.values.length} values but ${chart.categories.length} categories — counts will desynchronize on render.`,
                  'format_chart_series_category_mismatch',
                  { sectionId: section.sectionId, blockId: block.blockId }
                )
              );
            }
          }
        }
        // Pie / donut charts traditionally don't carry x/y axis
        // labels (axes don't apply); for bar / line / area / scatter
        // we surface a `low` finding when the author forgot them so
        // the FE chart-preview can encourage richer semantics.
        if (
          chart &&
          (chart.kind === 'bar' ||
            chart.kind === 'line' ||
            chart.kind === 'area' ||
            chart.kind === 'scatter') &&
          !summary.hasAxisLabels
        ) {
          findings.push(
            makeFinding(
              'low',
              `Chart "${summary.title ?? '(untitled)'}" (${chart.kind}) is missing axis labels — add xAxisLabel + yAxisLabel for clearer interpretation.`,
              'format_chart_missing_axis_labels',
              { sectionId: section.sectionId, blockId: block.blockId }
            )
          );
        }
      }
    }
  }

  return categoryReport('format', findings, 70, (score, fs) =>
    fs.length === 0
      ? 'Format QA clean: heading hierarchy, lists, tables and charts are well-formed.'
      : `Format QA: ${fs.length} finding(s); score ${score}/100.`
  );
}

// -----------------------------------------------------------------------------
// Export QA (Sprint 3 — Slice 3.4)
// -----------------------------------------------------------------------------

function isFormattingSchemaUsable(formattingSchema: FormattingSchema | undefined): boolean {
  if (!formattingSchema || typeof formattingSchema !== 'object') return false;
  if (!formattingSchema.fonts || !formattingSchema.headingStyles) return false;
  if (!formattingSchema.page || !formattingSchema.page.size) return false;
  return true;
}

function runExportQa(schema: DocumentSchema): DocumentQaCategoryReport {
  const findings: DocumentQaFinding[] = [];
  const formattingSchema = schema.formattingSchema as FormattingSchema | undefined;

  if (!formattingSchema) {
    findings.push(
      makeFinding(
        'high',
        'FormattingSchema is missing — exporters cannot render fonts, page or styles.',
        'export_missing_formatting_schema'
      )
    );
    findings.push(
      makeFinding(
        'high',
        'Document without a FormattingSchema cannot be exported safely.',
        'export_missing_formatting_schema_blocks_export'
      )
    );
  } else {
    const missingKeys: string[] = [];
    if (!formattingSchema.fonts) missingKeys.push('fonts');
    if (!formattingSchema.headingStyles) missingKeys.push('headingStyles');
    if (!formattingSchema.page || !formattingSchema.page.size) missingKeys.push('page.size');
    if (missingKeys.length > 0) {
      findings.push(
        makeFinding(
          'medium',
          `FormattingSchema is missing required keys: ${missingKeys.join(', ')}.`,
          'export_formatting_schema_keys_missing'
        )
      );
    }
    if (formattingSchema.coverPage && (!schema.title || schema.title.trim().length === 0)) {
      findings.push(
        makeFinding(
          'medium',
          'Cover page is enabled but the document has no title.',
          'export_cover_page_without_title'
        )
      );
    }
    if (formattingSchema.toc) {
      const hasLevelOne = schema.sections.some((section) => section.level === 1);
      if (!hasLevelOne) {
        findings.push(
          makeFinding(
            'medium',
            'Table of contents is enabled but the document has no level-1 sections.',
            'export_toc_without_level_one'
          )
        );
      }
    }
    if (formattingSchema.appendixStyle && formattingSchema.appendixStyle !== 'none') {
      const hasAppendix = schema.sections.some((section) =>
        sectionTitleMatchesAnyHint(section.title, APPENDIX_SECTION_HINTS)
      );
      if (!hasAppendix) {
        findings.push(
          makeFinding(
            'low',
            `Appendix style "${formattingSchema.appendixStyle}" is set but no Appendix sections are present.`,
            'export_appendix_style_without_sections'
          )
        );
      }
    }
    if (
      formattingSchema.footers?.enabled &&
      formattingSchema.footers?.confidentialityLabel &&
      !schema.confidentiality
    ) {
      findings.push(
        makeFinding(
          'low',
          'Confidentiality footer is enabled but the document has no confidentiality value.',
          'export_confidentiality_footer_without_value'
        )
      );
    }
  }

  // Schema walk: count total renderable text.
  let totalTextChars = 0;
  for (const section of schema.sections) {
    if (section.title.trim().length > 0) totalTextChars += section.title.trim().length;
    for (const block of section.blocks) {
      const text = blockToText(block).trim();
      totalTextChars += text.length;
    }
  }
  if (isFormattingSchemaUsable(formattingSchema) && totalTextChars === 0) {
    findings.push(
      makeFinding(
        'high',
        'Schema walk produced zero renderable text — the document is effectively empty.',
        'export_zero_content_after_walk'
      )
    );
    findings.push(
      makeFinding('high', 'Empty schema cannot be exported.', 'export_zero_content_blocks_export')
    );
  }

  return categoryReport('export', findings, 70, (score, fs) =>
    fs.length === 0
      ? 'Export QA clean: formatting schema and structure are export-ready.'
      : `Export QA: ${fs.length} finding(s); score ${score}/100.`
  );
}

// -----------------------------------------------------------------------------
// Public entry point
// -----------------------------------------------------------------------------

export function runDocumentQa(
  schema: DocumentSchema,
  options: RunDocumentQaOptions = {}
): DocumentQaReport {
  const template = options.template ?? null;
  const brandVoiceProfile = options.brandVoiceProfile ?? null;
  const categories: DocumentQaCategoryReport[] = [
    runBrandQa(schema, brandVoiceProfile),
    runLanguageQa(schema),
    runCompletenessQa(schema, template),
    runSourceQa(schema),
    // Slice E5.6.qa — twinned with `sources` and runs immediately
    // after it so the right-panel QA tab keeps the two cards adjacent.
    // Slice E5.6.qa.hard — passes `organizationId` (when supplied) so
    // pinned refs can be compared against the per-tenant version
    // registry for HARD drift (pinned ≠ latest known).
    runSourceDriftQa(schema, options.organizationId),
    runMethodologyQa(schema, template),
    runExecutiveQa(schema),
    runRiskQa(schema),
    runDataQa(schema),
    runFormatQa(schema),
    runExportQa(schema),
  ];
  return {
    artifactId: schema.artifactId,
    organizationId: '', // populated by the route layer (kept out of the schema).
    generatedAt: new Date().toISOString(),
    anyBlocking: categories.some((c) => c.blocking),
    categories,
  };
}

/**
 * Test-only helper: expose the density catalog for assertions without
 * leaking it from the type module.
 */
export function __getDensityTargetsForTests() {
  return DENSITY_TARGETS;
}
