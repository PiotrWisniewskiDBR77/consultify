import { randomUUID } from 'node:crypto';

import { get, run } from '../utils/DbPromise.js';
import {
  applyPresentationEditPlan,
  parsePresentationEditIntent,
} from './presentationAgentEditService.js';

export class PresentationTeresaBridgeError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode = 409
  ) {
    super(message);
    this.name = 'PresentationTeresaBridgeError';
  }
}

export interface ApplyApprovedPresentationTeresaEditInput {
  deckId: string;
  organizationId: string;
  userId: string;
  instruction: string;
  expectedVersion?: number | null;
  language?: string | null;
}

export interface ApplyApprovedPresentationTeresaEditResult {
  deckId: string;
  operationId: string;
  versionBefore: number;
  versionAfter: number;
  actions: string[];
  skippedLockedSlides: number[];
  reply: string;
}

function parseDeckJson(value: unknown): Record<string, any> {
  if (value && typeof value === 'object') return structuredClone(value as Record<string, any>);
  if (typeof value !== 'string' || !value.trim()) return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    throw new PresentationTeresaBridgeError(
      'Presentation deck data is invalid',
      'P08_PRESENTATION_DECK_INVALID',
      500
    );
  }
}

function getCards(deck: Record<string, any>): any[] {
  return Array.isArray(deck.cards)
    ? deck.cards
    : Array.isArray(deck.slides)
      ? deck.slides
      : [];
}

/**
 * Applies an already user-approved global Teresa edit through the Presentation
 * Studio persistence lane. The write is version-checked, append-only in the
 * version history, and records the AI operation in the same transaction.
 */
export async function applyApprovedPresentationTeresaEdit(
  input: ApplyApprovedPresentationTeresaEditInput
): Promise<ApplyApprovedPresentationTeresaEditResult> {
  const deckId = String(input.deckId || '').trim();
  const instruction = String(input.instruction || '').trim();
  if (!deckId) {
    throw new PresentationTeresaBridgeError(
      'Presentation write requires an opened deck',
      'P08_PRESENTATION_DECK_REQUIRED'
    );
  }
  if (!instruction) {
    throw new PresentationTeresaBridgeError(
      'Presentation write requires an explicit instruction',
      'P08_PRESENTATION_INSTRUCTION_REQUIRED'
    );
  }

  const row = await get<any>(
    `SELECT id, title, version, deck_json
       FROM presentation_decks
      WHERE id = ? AND organization_id = ?`,
    [deckId, input.organizationId],
    { fallback: false }
  );
  if (!row) {
    throw new PresentationTeresaBridgeError(
      'Presentation deck not found',
      'P08_PRESENTATION_NOT_FOUND',
      404
    );
  }

  const versionBefore = Number(row.version || 1);
  if (
    input.expectedVersion != null &&
    Number.isFinite(Number(input.expectedVersion)) &&
    Number(input.expectedVersion) !== versionBefore
  ) {
    throw new PresentationTeresaBridgeError(
      'Presentation changed after Teresa received its context',
      'P08_PRESENTATION_VERSION_CONFLICT'
    );
  }

  const originalDeck = parseDeckJson(row.deck_json);
  const plan = parsePresentationEditIntent(instruction);
  if (!plan.actionable) {
    throw new PresentationTeresaBridgeError(
      plan.noOpReason || 'Presentation instruction is not actionable',
      'P08_PRESENTATION_INTENT_UNSUPPORTED'
    );
  }

  const edit = applyPresentationEditPlan({
    plan,
    prompt: instruction,
    isPolish: String(input.language || '').toLowerCase().startsWith('pl'),
    deck: {
      ...originalDeck,
      deck_id: originalDeck.deck_id || deckId,
      title: originalDeck.title || row.title,
    },
  });
  const operationId = randomUUID().replace(/-/g, '');
  const snapshotId = randomUUID().replace(/-/g, '');
  const versionAfter = versionBefore + 1;
  const proposedDeck = {
    ...edit.deck,
    ai: {
      ...(edit.deck?.ai || {}),
      lastResolvedOperationId: operationId,
      reviewState: 'clean',
    },
    updated_at: new Date().toISOString(),
  };
  const originalJson = JSON.stringify(originalDeck);
  const proposedJson = JSON.stringify(proposedDeck);
  const diff = {
    editPlan: edit.plan,
    skippedLockedSlides: edit.skippedLockedSlides,
    changedSlides: edit.appliedActions.length,
  };

  await run('BEGIN TRANSACTION', [], { fallback: false });
  try {
    await run(
      `INSERT INTO presentation_deck_versions
         (id, deck_id, version, deck_json_snapshot, slide_count, created_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
      [snapshotId, deckId, versionBefore, row.deck_json || originalJson, getCards(originalDeck).length, input.userId],
      { fallback: false }
    );
    await run(
      `INSERT INTO presentation_ai_operations
         (id, deck_id, organization_id, user_id, operation_type, status, prompt, reply,
          actions_json, diff_json, original_deck_json, proposed_deck_json,
          version_before, version_after, created_at, resolved_at)
       VALUES (?, ?, ?, ?, 'teresa_edit', 'applied', ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [
        operationId,
        deckId,
        input.organizationId,
        input.userId,
        instruction,
        edit.reply,
        JSON.stringify(edit.appliedActions),
        JSON.stringify(diff),
        originalJson,
        proposedJson,
        versionBefore,
        versionAfter,
      ],
      { fallback: false }
    );
    const update = await run(
      `UPDATE presentation_decks
          SET deck_json = ?, version = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND organization_id = ? AND version = ?`,
      [proposedJson, versionAfter, deckId, input.organizationId, versionBefore],
      { fallback: false }
    );
    if ((update.changes ?? 0) !== 1) {
      throw new PresentationTeresaBridgeError(
        'Presentation changed while Teresa was applying the approved edit',
        'P08_PRESENTATION_VERSION_CONFLICT'
      );
    }
    await run('COMMIT', [], { fallback: false });
  } catch (error) {
    await run('ROLLBACK', [], { fallback: false }).catch(() => undefined);
    throw error;
  }

  return {
    deckId,
    operationId,
    versionBefore,
    versionAfter,
    actions: edit.appliedActions,
    skippedLockedSlides: edit.skippedLockedSlides,
    reply: edit.reply,
  };
}
