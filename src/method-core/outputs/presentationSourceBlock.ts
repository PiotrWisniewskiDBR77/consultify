/**
 * PresentationSourceBlock construction — TOOL_SESSION_WORKSPACE_STANDARD.md §7A.
 *
 * ★ Traceability (canon test 6): every block MUST carry `sourceOutputId` +
 *   `sourceVersion`. Both are required constructor arguments here (not
 *   optional fields a caller could omit) — there is no code path that
 *   produces a `PresentationSourceBlock` without them.
 * ★ Approved-only by default (canon test 5): a block built from a
 *   `proposed`/`needs_evidence` Finding is refused UNLESS the caller passes
 *   `allowDraftContent: true`, and even then `provenance.isDraft` is forced
 *   to `true` so the presentation layer can never silently present draft
 *   content as approved.
 */

import { deepFreeze } from './freeze';
import type {
  AssessmentOutput,
  Finding,
  PresentationConfidentiality,
  PresentationDensity,
  PresentationLayout,
  PresentationSourceBlock,
  PresentationVisualIntent,
} from './types';

export class PresentationSourceBlockError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PresentationSourceBlockError';
  }
}

function isDraftEvidence(finding: Finding): boolean {
  return finding.supportingEvidence.some((e) => e.strength === 'E0');
}

export interface CreatePresentationSourceBlockInput {
  readonly blockId: string;
  readonly blockType: PresentationSourceBlock['blockType'];
  readonly finding: Finding | null;
  readonly dataSnapshot: unknown;
  readonly title: string;
  readonly keyMessage: string;
  readonly visualIntent: PresentationVisualIntent;
  readonly preferredLayouts: readonly PresentationLayout[];
  readonly density: PresentationDensity;
  readonly themeTokens: Readonly<Record<string, string>>;
  readonly confidentiality: PresentationConfidentiality;
  readonly generatedBy: 'human' | 'teresa';
  readonly generatedAt: string;
  /** Must be explicitly true to let a proposed/needs-evidence Finding through. */
  readonly allowDraftContent?: boolean;
}

export function createPresentationSourceBlock(
  output: AssessmentOutput,
  input: CreatePresentationSourceBlockInput
): PresentationSourceBlock {
  const findingIsDraft = input.finding ? isDraftEvidence(input.finding) : false;

  if (findingIsDraft && !input.allowDraftContent) {
    throw new PresentationSourceBlockError(
      `PresentationSourceBlock ${input.blockId} refused: source finding ${input.finding?.id} ` +
        'is proposed/needs-evidence content. Only accepted content may enter a block by ' +
        'default — pass allowDraftContent: true for an explicit, tagged draft.'
    );
  }

  const block: PresentationSourceBlock = {
    sourceOutputId: output.id,
    sourceVersion: output.version,
    blockType: input.blockType,
    blockId: input.blockId,
    dataSnapshot: input.dataSnapshot,
    title: input.title,
    keyMessage: input.keyMessage,
    evidenceRefs: input.finding
      ? input.finding.supportingEvidence.map((e) => e.evidenceId)
      : [],
    visualIntent: input.visualIntent,
    preferredLayouts: input.preferredLayouts,
    density: input.density,
    themeTokens: input.themeTokens,
    confidentiality: input.confidentiality,
    freshness: output.frozenAt,
    provenance: {
      generatedBy: input.generatedBy,
      generatedAt: input.generatedAt,
      isDraft: findingIsDraft,
    },
  };

  return deepFreeze(block);
}
