/**
 * Shared Method Kernel — Teresa Intent -> Preview -> Commit -> Settle.
 *
 * Persists src/method-core/contracts/teresa.ts previews into
 * `method_teresa_previews`. A commit always resolves through a previewId
 * (unrepresentable otherwise, per the contract's `TeresaCommitRequest`), and
 * this service additionally refuses a commit whose preview:
 *  - does not exist                              -> preview_not_found
 *  - has already been consumed                   -> preview_already_consumed
 *  - has expired                                  -> preview_expired
 *  - carries quality verdict `invalid`            -> quality_invalid
 *  - targets a session that is currently `frozen` -> session_frozen
 *
 * Consumption is single-use: `consumed_at`/`consumed_by` are set on the
 * first successful commit and checked on every subsequent one.
 */

import * as DbPromise from '../utils/DbPromise.js';
import { genId, nowIso, parseJson, runOrThrow } from './db.js';
import type {
  TeresaCommitRequest,
  TeresaCommitResult,
  TeresaIntent,
  TeresaPreview,
  TeresaProposedChange,
  TeresaQualityVerdict,
  TeresaStatement,
} from './contracts/index.js';

interface MethodTeresaPreviewRow {
  id: string;
  organization_id: string;
  session_id: string;
  capability_id: string;
  intent_json: unknown;
  preview_json: unknown;
  quality_verdict: string;
  created_at: string;
  expires_at: string;
  consumed_at: string | null;
  consumed_by: string | null;
}

interface StoredPreviewBody {
  statements: readonly TeresaStatement[];
  proposedChanges: readonly TeresaProposedChange[];
  quality: TeresaQualityVerdict;
}

const DEFAULT_TTL_MS = 15 * 60 * 1000; // 15 minutes — previews go stale fast by design.

export interface CreatePreviewInput {
  readonly organizationId: string;
  readonly intent: TeresaIntent;
  readonly statements: readonly TeresaStatement[];
  readonly proposedChanges: readonly TeresaProposedChange[];
  readonly quality: TeresaQualityVerdict;
  /** Overrides the default 15-minute preview TTL. */
  readonly ttlMs?: number;
}

function toPreview(row: MethodTeresaPreviewRow): TeresaPreview {
  const body = parseJson<StoredPreviewBody>(row.preview_json, {
    statements: [],
    proposedChanges: [],
    quality: { verdict: 'invalid', failedChecks: [] },
  });
  return {
    previewId: row.id,
    intent: parseJson<TeresaIntent>(row.intent_json, {
      capabilityId: row.capability_id as TeresaIntent['capabilityId'],
      sessionId: row.session_id,
      invokedBy: 'local_action',
      actorUserId: '',
    }),
    statements: body.statements,
    proposedChanges: body.proposedChanges,
    quality: body.quality,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
  };
}

export class TeresaProposalService {
  async createPreview(input: CreatePreviewInput): Promise<TeresaPreview> {
    const id = genId();
    const createdAt = nowIso();
    const expiresAt = new Date(Date.now() + (input.ttlMs ?? DEFAULT_TTL_MS)).toISOString();
    const body: StoredPreviewBody = {
      statements: input.statements,
      proposedChanges: input.proposedChanges,
      quality: input.quality,
    };

    await runOrThrow(
      `INSERT INTO method_teresa_previews
         (id, organization_id, session_id, capability_id, intent_json, preview_json,
          quality_verdict, created_at, expires_at, consumed_at, consumed_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL)`,
      [
        id,
        input.organizationId,
        input.intent.sessionId,
        input.intent.capabilityId,
        JSON.stringify(input.intent),
        JSON.stringify(body),
        input.quality.verdict,
        createdAt,
        expiresAt,
      ]
    );

    return {
      previewId: id,
      intent: input.intent,
      statements: input.statements,
      proposedChanges: input.proposedChanges,
      quality: input.quality,
      createdAt,
      expiresAt,
    };
  }

  async getPreview(organizationId: string, previewId: string): Promise<TeresaPreview | null> {
    const row = await this.getPreviewRow(organizationId, previewId);
    return row ? toPreview(row) : null;
  }

  async commit(organizationId: string, request: TeresaCommitRequest): Promise<TeresaCommitResult> {
    const row = await this.getPreviewRow(organizationId, request.previewId);
    if (!row) {
      return { ok: false, refusal: { kind: 'preview_not_found' } };
    }
    if (row.consumed_at) {
      return { ok: false, refusal: { kind: 'preview_already_consumed' } };
    }
    if (new Date(row.expires_at).getTime() <= Date.now()) {
      return { ok: false, refusal: { kind: 'preview_expired', expiredAt: row.expires_at } };
    }

    const body = parseJson<StoredPreviewBody>(row.preview_json, {
      statements: [],
      proposedChanges: [],
      quality: { verdict: 'invalid', failedChecks: [] },
    });
    if (row.quality_verdict === 'invalid' || body.quality.verdict === 'invalid') {
      return {
        ok: false,
        refusal: { kind: 'quality_invalid', failedChecks: body.quality.failedChecks },
      };
    }

    const sessionRow = await DbPromise.get<{ id: string; state: string }>(
      `SELECT id, state FROM method_sessions WHERE id = ?`,
      [row.session_id]
    );
    if (sessionRow && sessionRow.state === 'frozen') {
      return { ok: false, refusal: { kind: 'session_frozen' } };
    }

    const result = await DbPromise.run(
      `UPDATE method_teresa_previews SET consumed_at = ?, consumed_by = ?
        WHERE id = ? AND consumed_at IS NULL`,
      [nowIso(), request.actorUserId, row.id],
      { fallback: false }
    );
    if (!result.success) {
      throw new Error(`method-core: preview consume UPDATE failed: ${result.error ?? 'unknown error'}`);
    }
    if (!result.changes) {
      // Lost a concurrent race to consume the same preview.
      return { ok: false, refusal: { kind: 'preview_already_consumed' } };
    }

    return { ok: true, eventIds: [] };
  }

  /**
   * WHERE organization_id = ? AND id = ? — both allow-listed by the test
   * mock's SELECT parser, so this filters correctly under mock and real
   * Postgres alike without needing an application-level backstop.
   */
  private async getPreviewRow(
    organizationId: string,
    previewId: string
  ): Promise<MethodTeresaPreviewRow | null> {
    const row = await DbPromise.get<MethodTeresaPreviewRow>(
      `SELECT * FROM method_teresa_previews WHERE organization_id = ? AND id = ?`,
      [organizationId, previewId]
    );
    return row ?? null;
  }
}

export const teresaProposalService = new TeresaProposalService();
