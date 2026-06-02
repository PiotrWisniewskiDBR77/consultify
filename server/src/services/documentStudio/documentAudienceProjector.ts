/**
 * Consultify Document Studio — Audience-driven projector (Epic E9, Slice 9.1).
 *
 * Pure transformation that takes a base `DocumentSchema` and an
 * `AudienceProfile` and returns a new `DocumentVariant` (projected schema
 * + provenance). The projection is purely structural / metadata-level:
 *
 *   - schema-level scalar overrides (`audience`, `communicationRegister`,
 *     `density`, `languageStyle`),
 *   - section / block tag filtering against `AudienceProfile.sectionFilters`
 *     and `AudienceProfile.blockFilters`,
 *   - executive-summary policy (`'preserve'` | `'expand'` | `'drop'`),
 *   - appendix policy (`'preserve'` | `'drop'`).
 *
 * No LLM rewrite. No network. No clock dependency beyond an injected
 * `now()` for deterministic provenance timestamps in tests. The projector
 * never mutates the input schema; it deep-clones every section / block it
 * keeps so downstream renderers (DOCX / PDF / preview) can mutate the
 * variant freely without leaking back into the source artifact.
 */

import { isAppendixSection } from './documentDocxStructure.js';
import type {
  AudienceProfile,
  AudienceProfileTagFilter,
  DocumentBlock,
  DocumentSchema,
  DocumentSection,
  DocumentVariant,
  DocumentVariantProvenance,
} from './documentStudioTypes.js';

/**
 * Title patterns the projector considers an executive summary. Localized
 * (PL "streszczenie", EN "executive summary") and matched against the
 * lowercased section title with anchored word-start semantics so a
 * section called "Executive Summary" or "Streszczenie zarządcze" both
 * trigger, but "Executive committee findings" does not.
 */
const EXECUTIVE_SUMMARY_TITLE_PATTERNS: RegExp[] = [
  /^executive\s+summary\b/i,
  /^exec\s+summary\b/i,
  /^streszczenie\b/i,
];

/**
 * Returns `true` if the section title looks like an executive summary
 * heading. Used by the projector when `executiveSummaryPolicy === 'drop'`.
 */
export function isExecutiveSummarySection(section: DocumentSection): boolean {
  const title = String(section.title || '').trim();
  if (!title) return false;
  return EXECUTIVE_SUMMARY_TITLE_PATTERNS.some((rx) => rx.test(title));
}

/**
 * Tag-filter decision: should an element with `tags` survive the filter?
 *
 *   - `exclude` wins over `include`: any matching exclude tag drops the
 *     element regardless of include matches.
 *   - When `include` is set and non-empty, untagged elements still survive
 *     (default-include). Tagged elements need at least one include match.
 *   - When neither list is set / both empty, every element survives.
 */
export function passesTagFilter(
  tags: string[] | undefined,
  filter: AudienceProfileTagFilter
): boolean {
  const elementTags = Array.isArray(tags)
    ? tags.filter((t) => typeof t === 'string' && t.length > 0)
    : [];
  const exclude = Array.isArray(filter.exclude)
    ? filter.exclude.filter((t) => t && t.length > 0)
    : [];
  if (elementTags.length > 0 && exclude.some((tag) => elementTags.includes(tag))) {
    return false;
  }
  const include = Array.isArray(filter.include)
    ? filter.include.filter((t) => t && t.length > 0)
    : [];
  if (include.length === 0) return true;
  if (elementTags.length === 0) return true; // default-include for untagged elements
  return include.some((tag) => elementTags.includes(tag));
}

/** Deep-clones a block; cheap because blocks are plain JSON-ish records. */
function cloneBlock(block: DocumentBlock): DocumentBlock {
  return JSON.parse(JSON.stringify(block)) as DocumentBlock;
}

/** Deep-clones a section without its blocks (blocks handled separately). */
function cloneSectionShell(section: DocumentSection): DocumentSection {
  return {
    sectionId: section.sectionId,
    orderIndex: section.orderIndex,
    level: section.level,
    title: section.title,
    purpose: section.purpose,
    blocks: [],
    sourceRefs: Array.isArray(section.sourceRefs)
      ? section.sourceRefs.map((ref) => ({ ...ref }))
      : [],
    kind: section.kind,
    audienceTags: Array.isArray(section.audienceTags) ? [...section.audienceTags] : undefined,
  };
}

export interface ProjectDocumentForAudienceOptions {
  /** Override the wallclock for deterministic provenance timestamps. */
  now?: () => Date;
}

/**
 * Project a base `DocumentSchema` through an `AudienceProfile`. Returns
 * the projected schema plus a `DocumentVariantProvenance` record that
 * explains what was kept / dropped and references the source artifact.
 *
 * The projection NEVER mutates the input schema or profile. Profiles
 * with empty `audienceLabels` inherit the source schema's `audience`.
 */
export function projectDocumentForAudience(
  schema: DocumentSchema,
  profile: AudienceProfile,
  options: ProjectDocumentForAudienceOptions = {}
): DocumentVariant {
  if (!schema || typeof schema !== 'object') {
    throw new Error('projectDocumentForAudience: schema is required');
  }
  if (!profile || typeof profile !== 'object') {
    throw new Error('projectDocumentForAudience: profile is required');
  }

  const now = (options.now ?? (() => new Date()))();

  const sectionsKept: string[] = [];
  const sectionsDropped: { sectionId: string; reason: string }[] = [];
  let blocksDropped = 0;

  const projectedSections: DocumentSection[] = [];

  const inputSections = Array.isArray(schema.sections) ? schema.sections : [];
  for (const section of inputSections) {
    if (profile.appendixPolicy === 'drop' && isAppendixSection(section)) {
      sectionsDropped.push({ sectionId: section.sectionId, reason: 'appendix_policy_drop' });
      continue;
    }

    if (profile.executiveSummaryPolicy === 'drop' && isExecutiveSummarySection(section)) {
      sectionsDropped.push({ sectionId: section.sectionId, reason: 'executive_summary_drop' });
      continue;
    }

    if (!passesTagFilter(section.audienceTags, profile.sectionFilters)) {
      sectionsDropped.push({ sectionId: section.sectionId, reason: 'section_tag_filter' });
      continue;
    }

    const projectedSection = cloneSectionShell(section);
    const inputBlocks = Array.isArray(section.blocks) ? section.blocks : [];
    for (const block of inputBlocks) {
      if (!passesTagFilter(block.audienceTags, profile.blockFilters)) {
        blocksDropped += 1;
        continue;
      }
      projectedSection.blocks.push(cloneBlock(block));
    }
    projectedSections.push(projectedSection);
    sectionsKept.push(section.sectionId);
  }

  const audienceLabels =
    Array.isArray(profile.audienceLabels) && profile.audienceLabels.length > 0
      ? [...profile.audienceLabels]
      : Array.isArray(schema.audience)
        ? [...schema.audience]
        : [];

  const projectedSchema: DocumentSchema = {
    ...schema,
    audience: audienceLabels,
    communicationRegister: profile.registerOverride ?? schema.communicationRegister,
    density: profile.densityOverride ?? schema.density,
    languageStyle: profile.languageStyleOverride ?? schema.languageStyle,
    sections: projectedSections,
    sourceRefs: Array.isArray(schema.sourceRefs)
      ? schema.sourceRefs.map((ref) => ({ ...ref }))
      : [],
    formattingSchema: schema.formattingSchema
      ? JSON.parse(JSON.stringify(schema.formattingSchema))
      : schema.formattingSchema,
    updatedAt: now.toISOString(),
  };

  const provenance: DocumentVariantProvenance = {
    sourceDocumentId: schema.documentId,
    sourceArtifactId: schema.artifactId,
    profileId: profile.profileId,
    profileVersion: profile.version,
    projectedAt: now.toISOString(),
    sectionsKept,
    sectionsDropped,
    blocksDropped,
  };

  return { schema: projectedSchema, provenance };
}

/**
 * Audit / explainability helper: describe the decisions a profile would
 * make against a schema without performing the deep clone. Returns a
 * pure structural summary suitable for surfacing in the AI editor side
 * panel ("variant Board would drop sections X, Y because exec_summary_drop").
 */
export function describeAudienceProjectionPlan(
  schema: DocumentSchema,
  profile: AudienceProfile
): {
  effectiveAudience: string[];
  effectiveRegister: string;
  effectiveDensity: string;
  effectiveLanguageStyle: string;
  sectionsKept: string[];
  sectionsDropped: { sectionId: string; reason: string }[];
  blocksDroppedEstimate: number;
} {
  const inputSections = Array.isArray(schema.sections) ? schema.sections : [];
  const sectionsKept: string[] = [];
  const sectionsDropped: { sectionId: string; reason: string }[] = [];
  let blocksDroppedEstimate = 0;

  for (const section of inputSections) {
    if (profile.appendixPolicy === 'drop' && isAppendixSection(section)) {
      sectionsDropped.push({ sectionId: section.sectionId, reason: 'appendix_policy_drop' });
      continue;
    }
    if (profile.executiveSummaryPolicy === 'drop' && isExecutiveSummarySection(section)) {
      sectionsDropped.push({ sectionId: section.sectionId, reason: 'executive_summary_drop' });
      continue;
    }
    if (!passesTagFilter(section.audienceTags, profile.sectionFilters)) {
      sectionsDropped.push({ sectionId: section.sectionId, reason: 'section_tag_filter' });
      continue;
    }
    sectionsKept.push(section.sectionId);
    const blocks = Array.isArray(section.blocks) ? section.blocks : [];
    for (const block of blocks) {
      if (!passesTagFilter(block.audienceTags, profile.blockFilters)) {
        blocksDroppedEstimate += 1;
      }
    }
  }

  const audienceLabels =
    Array.isArray(profile.audienceLabels) && profile.audienceLabels.length > 0
      ? [...profile.audienceLabels]
      : Array.isArray(schema.audience)
        ? [...schema.audience]
        : [];

  return {
    effectiveAudience: audienceLabels,
    effectiveRegister: profile.registerOverride ?? schema.communicationRegister,
    effectiveDensity: profile.densityOverride ?? schema.density,
    effectiveLanguageStyle: profile.languageStyleOverride ?? schema.languageStyle,
    sectionsKept,
    sectionsDropped,
    blocksDroppedEstimate,
  };
}
