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

import type {
  DocumentBlock,
  DocumentQaCategory,
  DocumentQaCategoryReport,
  DocumentQaFinding,
  DocumentQaReport,
  DocumentQaSeverity,
  DocumentSchema,
  DocumentTypeKey,
} from './documentStudioTypes.js';

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
// Brand QA
// -----------------------------------------------------------------------------

function runBrandQa(schema: DocumentSchema): DocumentQaCategoryReport {
  const findings: DocumentQaFinding[] = [];
  const language = schema.language;
  const banned = [...BANNED_PHRASES_GLOBAL, ...(BANNED_PHRASES_BY_LANGUAGE[language] ?? [])];
  const casualForExecutive =
    schema.communicationRegister === 'executive' ? EXECUTIVE_BANNED_CASUAL : [];

  for (const section of schema.sections) {
    for (const block of section.blocks) {
      if (!isEditableBlock(block)) continue;
      const text = blockToText(block);
      if (!text.trim()) continue;

      const bannedHits = findPhraseMatches(text, banned);
      for (const phrase of bannedHits) {
        findings.push(
          makeFinding(
            'medium',
            `Brand voice: avoid "${phrase}" — fluff or marketing-speak that weakens consulting tone.`,
            'banned_phrase',
            { sectionId: section.sectionId, blockId: block.blockId }
          )
        );
      }

      if (casualForExecutive.length > 0) {
        const casualHits = findPhraseMatches(text, casualForExecutive);
        for (const phrase of casualHits) {
          findings.push(
            makeFinding(
              'high',
              `Register mismatch: "${phrase}" is too casual for ${schema.communicationRegister} register.`,
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

  return categoryReport('brand', findings, 70, (score, fs) =>
    fs.length === 0
      ? 'Brand voice clean: no banned phrases, register holds, no shouty caps.'
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

  for (const section of schema.sections) {
    for (const block of section.blocks) {
      if (!isEditableBlock(block)) continue;
      const text = blockToText(block);
      const trimmed = text.trim();
      if (!trimmed) continue;
      editableBlockCount += 1;
      const words = countWords(trimmed);
      totalWords += words;

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
// Public entry point
// -----------------------------------------------------------------------------

export function runDocumentQa(schema: DocumentSchema): DocumentQaReport {
  const categories: DocumentQaCategoryReport[] = [
    runBrandQa(schema),
    runLanguageQa(schema),
    runSourceQa(schema),
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
