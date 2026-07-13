/**
 * P07 §2.3.5 — Operator-grade notebook search baseline.
 * SQL filters + LIKE keyword path, optional merge from `notebookService.semanticSearch`,
 * operator hints from canon (`notebookCanon`).
 */

import { all as dbAll, get as dbGet } from '../../utils/DbPromise.js';
import logger from '../../utils/Logger.js';
import notebookService from '../notebookService.js';
import { P07_SEARCH_BASELINE } from './notebookCanon.js';

const LOG_PREFIX = '[P07-NotebookSearch]';

const isPostgres = (): boolean => process.env.DB_TYPE === 'postgres';

export type MatchKind = 'keyword' | 'semantic' | 'metadata';

export interface NotebookSearchFilters {
  q?: string;
  status?: string;
  maturity?: string;
  tags?: string[];
  type?: string;
  owner?: string;
  visibility?: string;
  has_attachments?: boolean;
  linked_artifact_type?: string;
  linked_artifact_id?: string;
  capture_source?: string;
  date_range?: { from?: string; to?: string };
  author?: string;
  attachment_type?: string;
  /** #18 — orphan cleanup: pages with zero link_graph_edges rows (no topics/mentions/backlinks). */
  orphaned?: boolean;
}

export interface NotebookSearchResult {
  note_id: string;
  title: string;
  snippet: string;
  match_kind: MatchKind;
  updated_at: string;
  status: string;
  maturity: string;
  tags: string[];
  has_attachments: boolean;
  linked_artifacts_count: number;
}

export interface NotebookSearchResponse {
  results: NotebookSearchResult[];
  total: number;
  filters_applied: string[];
  degraded: boolean;
  degraded_reason: string | null;
}

type WhereBuild = {
  conditions: string[];
  params: unknown[];
  filtersApplied: string[];
};

const OPERATOR_KEYS = new Set(['tag', 'type', 'status', 'maturity', 'owner', 'source', 'has']);

/**
 * Parses inline operator hints (P07 §2.3.5) from a free-text query.
 * Supported: tag:, type:, status:, maturity:, owner:, source:, has:attachment
 */
export function parseOperatorHints(query: string): {
  cleanQuery: string;
  extractedFilters: Partial<NotebookSearchFilters>;
} {
  const extracted: Partial<NotebookSearchFilters> = {};
  const tagAcc: string[] = [];
  const tokens = String(query || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const kept: string[] = [];

  for (const raw of tokens) {
    const colon = raw.indexOf(':');
    if (colon <= 0) {
      kept.push(raw);
      continue;
    }
    const key = raw.slice(0, colon).toLowerCase();
    const val = raw.slice(colon + 1);
    if (!OPERATOR_KEYS.has(key) || !val) {
      kept.push(raw);
      continue;
    }

    if (key === 'tag') {
      tagAcc.push(val);
      continue;
    }
    if (key === 'type') {
      extracted.type = val;
      continue;
    }
    if (key === 'status') {
      extracted.status = val.toLowerCase();
      continue;
    }
    if (key === 'maturity') {
      extracted.maturity = val.toLowerCase();
      continue;
    }
    if (key === 'owner') {
      extracted.owner = val;
      continue;
    }
    if (key === 'source') {
      const s = val.toLowerCase();
      extracted.capture_source = s === 'upload' ? 'upload' : s;
      continue;
    }
    if (key === 'has' && val.toLowerCase() === 'attachment') {
      extracted.has_attachments = true;
      continue;
    }

    kept.push(raw);
  }

  if (tagAcc.length) {
    extracted.tags = tagAcc;
  }

  return {
    cleanQuery: kept.join(' ').trim(),
    extractedFilters: extracted,
  };
}

function parseTagsJson(raw: string | null | undefined): string[] {
  if (raw == null || raw === '') return [];
  try {
    const v = JSON.parse(raw) as unknown;
    return Array.isArray(v) ? v.map((x) => String(x)) : [];
  } catch {
    return [];
  }
}

function hasAttachmentsRow(attachmentsJson: string | null | undefined): boolean {
  const s = String(attachmentsJson ?? '').trim();
  if (!s || s === '[]' || s === 'null') return false;
  try {
    const v = JSON.parse(s) as unknown;
    return Array.isArray(v) && v.length > 0;
  } catch {
    return s !== '[]';
  }
}

function resolveOwnerFilter(owner: string | undefined, userId: string): string | null {
  if (owner == null || owner === '') return null;
  const o = owner.trim().toLowerCase();
  if (o === 'me') return userId;
  return owner.trim();
}

function linkCountExpr(): string {
  return `(
    SELECT COUNT(*)::int
    FROM link_graph_edges e
    WHERE e.organization_id = np.organization_id
      AND (
        (e.source_type = 'notebook_page' AND e.source_id = np.id)
        OR (e.target_type = 'notebook_page' AND e.target_id = np.id)
      )
  )`;
}

function linkCountExprSqlite(): string {
  return `(
    SELECT CAST(COUNT(*) AS INTEGER)
    FROM link_graph_edges e
    WHERE e.organization_id = np.organization_id
      AND (
        (e.source_type = 'notebook_page' AND e.source_id = np.id)
        OR (e.target_type = 'notebook_page' AND e.target_id = np.id)
      )
  )`;
}

function buildVisibilityWhere(userId: string): { sql: string; params: unknown[] } {
  return {
    sql: `(
      (lower(np.visibility) = 'private' AND np.owner_user_id = ?)
      OR (lower(np.visibility) = 'project' AND np.project_id IS NOT NULL
          AND EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = np.project_id AND pm.user_id = ?))
    )`,
    params: [userId, userId],
  };
}

function buildStructuredWhere(
  organizationId: string,
  userId: string,
  filters: NotebookSearchFilters
): WhereBuild {
  const conditions: string[] = ['np.organization_id = ?'];
  const params: unknown[] = [organizationId];
  const filtersApplied: string[] = ['organization_id', 'visibility'];

  const vis = buildVisibilityWhere(userId);
  conditions.push(vis.sql);
  params.push(...vis.params);

  if (filters.status != null && filters.status !== '') {
    conditions.push('lower(np.status) = lower(?)');
    params.push(filters.status.trim());
    filtersApplied.push('status');
  }
  if (filters.maturity != null && filters.maturity !== '') {
    conditions.push('lower(np.maturity) = lower(?)');
    params.push(filters.maturity.trim());
    filtersApplied.push('maturity');
  }
  if (filters.visibility != null && filters.visibility !== '') {
    conditions.push('lower(np.visibility) = lower(?)');
    params.push(filters.visibility.trim());
    filtersApplied.push('visibility');
  }

  if (filters.author != null && filters.author !== '') {
    conditions.push('np.owner_user_id = ?');
    params.push(filters.author.trim());
    filtersApplied.push('author');
  } else {
    const ownerId = resolveOwnerFilter(filters.owner, userId);
    if (ownerId) {
      conditions.push('np.owner_user_id = ?');
      params.push(ownerId);
      filtersApplied.push('owner');
    }
  }

  if (filters.type != null && filters.type !== '') {
    conditions.push("lower(coalesce(np.note_type, '')) = lower(?)");
    params.push(filters.type.trim());
    filtersApplied.push('type');
  }

  if (filters.capture_source != null && filters.capture_source !== '') {
    conditions.push("lower(coalesce(np.capture_source, '')) = lower(?)");
    params.push(filters.capture_source.trim());
    filtersApplied.push('capture_source');
  }

  if (filters.has_attachments === true) {
    if (isPostgres()) {
      conditions.push(`COALESCE(np.attachments_json::jsonb, '[]'::jsonb) <> '[]'::jsonb`);
    } else {
      conditions.push(
        `(np.attachments_json IS NOT NULL AND trim(np.attachments_json) NOT IN ('', '[]', 'null'))`
      );
    }
    filtersApplied.push('has_attachments');
  }

  if (filters.tags != null && filters.tags.length > 0) {
    for (const t of filters.tags) {
      const tag = String(t).trim();
      if (!tag) continue;
      if (isPostgres()) {
        conditions.push(`np.tags_json::jsonb @> ?::jsonb`);
        params.push(JSON.stringify([tag]));
      } else {
        conditions.push(
          `EXISTS (SELECT 1 FROM json_each(np.tags_json) je WHERE lower(je.value) = lower(?))`
        );
        params.push(tag);
      }
    }
    filtersApplied.push('tags');
  }

  if (filters.date_range?.from) {
    conditions.push('np.updated_at >= ?');
    params.push(filters.date_range.from);
    filtersApplied.push('date_range.from');
  }
  if (filters.date_range?.to) {
    conditions.push('np.updated_at <= ?');
    params.push(filters.date_range.to);
    filtersApplied.push('date_range.to');
  }

  if (filters.linked_artifact_type && filters.linked_artifact_id) {
    const at = filters.linked_artifact_type.trim();
    const aid = filters.linked_artifact_id.trim();
    conditions.push(
      `EXISTS (
        SELECT 1 FROM link_graph_edges e2
        WHERE e2.organization_id = np.organization_id
          AND (
            (e2.source_type = 'notebook_page' AND e2.source_id = np.id
              AND e2.target_type = ? AND e2.target_id = ?)
            OR (e2.target_type = 'notebook_page' AND e2.target_id = np.id
              AND e2.source_type = ? AND e2.source_id = ?)
          )
      )`
    );
    params.push(at, aid, at, aid);
    filtersApplied.push('linked_artifact');
  }

  if (filters.orphaned === true) {
    // #18 — a page is "orphaned" when it has zero link_graph_edges rows in
    // either direction (no topics, no @mentions out, no backlinks in).
    // Reuses the exact same connection definition as the connection graph
    // (NotebookGraphView) and the "Mentioned in" bar (NotebookBacklinksBar).
    const lc = isPostgres() ? linkCountExpr() : linkCountExprSqlite();
    conditions.push(`${lc} = 0`);
    filtersApplied.push('orphaned');
  }

  if (filters.attachment_type != null && filters.attachment_type !== '') {
    const at = filters.attachment_type.trim();
    if (isPostgres()) {
      conditions.push(
        `EXISTS (
          SELECT 1
          FROM jsonb_array_elements(COALESCE(np.attachments_json::jsonb, '[]'::jsonb)) att
          WHERE lower(att->>'type') = lower(?)
        )`
      );
      params.push(at);
    } else {
      conditions.push(`lower(coalesce(np.attachments_json, '')) LIKE lower(?)`);
      params.push(`%"type":"${at.replace(/%/g, '')}"%`);
    }
    filtersApplied.push('attachment_type');
  }

  return { conditions, params, filtersApplied };
}

function appendTextSearch(where: WhereBuild, qTrim: string, filtersApplied: string[]): void {
  if (!qTrim) return;
  const like = `%${qTrim.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_')}%`;
  where.conditions.push(
    `(lower(np.title) LIKE lower(?) ESCAPE '\\' OR lower(coalesce(np.content_text, '')) LIKE lower(?) ESCAPE '\\')`
  );
  where.params.push(like, like);
  filtersApplied.push('q');
}

type RawSearchRow = {
  id: string;
  title: string | null;
  content_text: string | null;
  updated_at: string | null;
  status: string | null;
  maturity: string | null;
  tags_json: string | null;
  attachments_json: string | null;
  linked_count: number | string | null;
  _match_total?: number | string | null;
};

function rowToResult(
  row: RawSearchRow,
  qForSnippet: string,
  match_kind: MatchKind,
  maxSnippet: number
): NotebookSearchResult {
  const content = row.content_text ?? '';
  const snippet = buildSnippet(content, qForSnippet, maxSnippet);

  const lc = row.linked_count;
  const linkedN =
    typeof lc === 'number' ? Math.round(lc) : lc != null ? Math.round(Number(lc)) || 0 : 0;

  return {
    note_id: row.id,
    title: String(row.title ?? ''),
    snippet,
    match_kind,
    updated_at: String(row.updated_at ?? ''),
    status: String(row.status ?? ''),
    maturity: String(row.maturity ?? ''),
    tags: parseTagsJson(row.tags_json),
    has_attachments: hasAttachmentsRow(row.attachments_json),
    linked_artifacts_count: linkedN,
  };
}

/**
 * Builds a readable snippet around the first occurrence of `query` with `**highlight**` markers.
 */
export function buildSnippet(contentText: string, query: string, maxLen = 200): string {
  const text = String(contentText ?? '')
    .replace(/\s+/g, ' ')
    .trim();
  const q = String(query ?? '').trim();
  if (!text) return '';
  if (!q) {
    return text.length <= maxLen ? text : `${text.slice(0, maxLen)}…`;
  }

  const lowerText = text.toLowerCase();
  const lowerQ = q.toLowerCase();
  const idx = lowerText.indexOf(lowerQ);
  if (idx < 0) {
    return text.length <= maxLen ? text : `${text.slice(0, maxLen)}…`;
  }

  const radius = Math.max(40, Math.floor(maxLen / 2) - q.length);
  const start = Math.max(0, idx - radius);
  let end = Math.min(text.length, idx + q.length + radius);
  if (end - start > maxLen + q.length) {
    end = start + maxLen + q.length;
  }

  const slice = text.slice(start, end);
  let rel = idx - start;
  if (rel < 0 || rel > slice.length) {
    rel = slice.toLowerCase().indexOf(lowerQ);
  }
  if (rel < 0) {
    return text.length <= maxLen ? text : `${text.slice(0, maxLen)}…`;
  }

  const esc = (s: string) => s.replace(/\*/g, '\\*');
  const before = esc(slice.slice(0, rel));
  const match = esc(slice.slice(rel, rel + q.length));
  const after = esc(slice.slice(rel + q.length));
  let out = `${before}**${match}**${after}`;
  if (start > 0) out = `…${out}`;
  if (end < text.length) out = `${out}…`;
  return out;
}

export function getSearchContract(): typeof P07_SEARCH_BASELINE {
  return P07_SEARCH_BASELINE;
}

async function countMatching(whereSql: string, params: unknown[]): Promise<number> {
  const sql = isPostgres()
    ? `SELECT COUNT(*)::int AS c FROM notebook_pages np WHERE ${whereSql}`
    : `SELECT COUNT(*) AS c FROM notebook_pages np WHERE ${whereSql}`;
  const row = await dbGet<{ c: number | string }>(sql, params, { fallback: false }).catch(
    () => null
  );
  if (!row) return 0;
  const n = row.c;
  return typeof n === 'number' ? n : parseInt(String(n), 10) || 0;
}

/**
 * Operator-grade notebook search: structured SQL filters, LIKE on title/content for `q`,
 * optional semantic hits merged from `notebookService.semanticSearch` (first page only).
 */
export async function searchNotebook(
  organizationId: string,
  userId: string,
  filters: NotebookSearchFilters,
  options?: { limit?: number; offset?: number }
): Promise<NotebookSearchResponse> {
  const limit = Math.min(Math.max(options?.limit ?? 50, 1), 200);
  const offset = Math.max(options?.offset ?? 0, 0);
  let semanticEnrichmentApplied = false;
  let degraded = false;
  let degraded_reason: string | null = null;

  const qTrim = String(filters.q ?? '').trim();
  const structuredBase = buildStructuredWhere(organizationId, userId, filters);
  const whereKeyword = {
    conditions: [...structuredBase.conditions],
    params: [...structuredBase.params],
    filtersApplied: [...structuredBase.filtersApplied],
  };
  appendTextSearch(whereKeyword, qTrim, whereKeyword.filtersApplied);

  const countWhere = whereKeyword.conditions.join(' AND ');
  const lcExpr = isPostgres() ? linkCountExpr() : linkCountExprSqlite();

  const selectSql = `
    SELECT
      COUNT(*) OVER() AS _match_total,
      np.id,
      np.title,
      np.content_text,
      np.updated_at,
      np.status,
      np.maturity,
      np.tags_json,
      np.attachments_json,
      ${lcExpr} AS linked_count
    FROM notebook_pages np
    WHERE ${countWhere}
    ORDER BY np.updated_at DESC
    LIMIT ?
    OFFSET ?
  `;

  let rows: RawSearchRow[] = [];
  let activeWhere = countWhere;
  let activeParams = whereKeyword.params;
  let appliedFilters = whereKeyword.filtersApplied;

  try {
    rows = await dbAll<RawSearchRow>(selectSql, [...whereKeyword.params, limit, offset], {
      fallback: false,
    });
  } catch (err: any) {
    const msg = err?.message || String(err);
    if (msg.includes('note_type') || (msg.includes('column') && msg.includes('does not exist'))) {
      logger.warn(`${LOG_PREFIX} retrying without note_type filter`, { err: msg });
      const withoutType = { ...filters, type: undefined };
      const s2 = buildStructuredWhere(organizationId, userId, withoutType);
      const w2 = {
        conditions: [...s2.conditions],
        params: [...s2.params],
        filtersApplied: [...s2.filtersApplied],
      };
      appendTextSearch(w2, qTrim, w2.filtersApplied);
      const cw = w2.conditions.join(' AND ');
      try {
        rows = await dbAll<RawSearchRow>(
          `
    SELECT
      COUNT(*) OVER() AS _match_total,
      np.id,
      np.title,
      np.content_text,
      np.updated_at,
      np.status,
      np.maturity,
      np.tags_json,
      np.attachments_json,
      ${lcExpr} AS linked_count
    FROM notebook_pages np
    WHERE ${cw}
    ORDER BY np.updated_at DESC
    LIMIT ?
    OFFSET ?
  `,
          [...w2.params, limit, offset],
          { fallback: false }
        );
        activeWhere = cw;
        activeParams = w2.params;
        appliedFilters = w2.filtersApplied.filter((x) => x !== 'type');
      } catch (e2) {
        logger.error(`${LOG_PREFIX} search failed`, { err: e2 });
        return {
          results: [],
          total: 0,
          filters_applied: w2.filtersApplied,
          degraded: true,
          degraded_reason: 'Notebook search query failed',
        };
      }
    } else if (msg.includes('link_graph_edges') || msg.includes('no such table')) {
      logger.warn(`${LOG_PREFIX} link_graph unavailable; linked_count = 0`, { err: msg });
      degraded = true;
      degraded_reason = 'Link graph unavailable — linked artifact counts omitted';
      const selectNoLink = `
    SELECT
      COUNT(*) OVER() AS _match_total,
      np.id,
      np.title,
      np.content_text,
      np.updated_at,
      np.status,
      np.maturity,
      np.tags_json,
      np.attachments_json,
      0 AS linked_count
    FROM notebook_pages np
    WHERE ${countWhere}
    ORDER BY np.updated_at DESC
    LIMIT ?
    OFFSET ?
  `;
      try {
        rows = await dbAll<RawSearchRow>(selectNoLink, [...whereKeyword.params, limit, offset], {
          fallback: false,
        });
      } catch (e3) {
        logger.error(`${LOG_PREFIX} search failed (no link_graph fallback)`, { err: e3 });
        return {
          results: [],
          total: 0,
          filters_applied: whereKeyword.filtersApplied,
          degraded: true,
          degraded_reason: 'Notebook search query failed',
        };
      }
    } else {
      logger.error(`${LOG_PREFIX} search failed`, { err });
      return {
        results: [],
        total: 0,
        filters_applied: whereKeyword.filtersApplied,
        degraded: true,
        degraded_reason: 'Notebook search query failed',
      };
    }
  }

  const total =
    rows.length > 0
      ? Number(rows[0]._match_total ?? 0)
      : await countMatching(activeWhere, activeParams).catch((err) => {
          logger.warn(`${LOG_PREFIX} total count failed`, { err });
          degraded = true;
          degraded_reason = degraded_reason ?? 'Search count failed — results may be incomplete';
          return 0;
        });

  const matchKind: MatchKind = qTrim ? 'keyword' : 'metadata';
  const maxSnippet = 200;
  const results: NotebookSearchResult[] = rows.map((r) =>
    rowToResult(r, qTrim, matchKind, maxSnippet)
  );

  if (qTrim && offset === 0) {
    try {
      const sem = await notebookService.semanticSearch(organizationId, userId, qTrim, {
        limit: Math.min(limit + 25, 100),
      });
      if (sem.length > 0) semanticEnrichmentApplied = true;
      const seen = new Set(results.map((r) => r.note_id));
      const structuredOnly = buildStructuredWhere(organizationId, userId, filters);
      const baseWhere = structuredOnly.conditions.join(' AND ');

      for (const s of sem) {
        if (seen.has(s.pageId)) continue;
        const checkSql = `SELECT 1 AS ok FROM notebook_pages np WHERE np.id = ? AND ${baseWhere} LIMIT 1`;
        const ok = await dbGet<{ ok: number }>(checkSql, [s.pageId, ...structuredOnly.params], {
          fallback: true,
        });
        if (!ok) continue;

        const detailSql = `
          SELECT
            np.id,
            np.title,
            np.content_text,
            np.updated_at,
            np.status,
            np.maturity,
            np.tags_json,
            np.attachments_json,
            ${lcExpr} AS linked_count
          FROM notebook_pages np
          WHERE np.id = ? AND ${baseWhere}
          LIMIT 1
        `;
        let detail: RawSearchRow | null = null;
        try {
          detail = await dbGet<RawSearchRow>(detailSql, [s.pageId, ...structuredOnly.params], {
            fallback: false,
          });
        } catch {
          const detailNoLink = `
          SELECT
            np.id,
            np.title,
            np.content_text,
            np.updated_at,
            np.status,
            np.maturity,
            np.tags_json,
            np.attachments_json,
            0 AS linked_count
          FROM notebook_pages np
          WHERE np.id = ? AND ${baseWhere}
          LIMIT 1
        `;
          detail = await dbGet<RawSearchRow>(detailNoLink, [s.pageId, ...structuredOnly.params], {
            fallback: true,
          });
        }

        if (!detail) continue;

        const snippetFromSemantic =
          s.snippet && s.snippet.trim()
            ? buildSnippet(String(s.snippet), qTrim, maxSnippet)
            : buildSnippet(detail.content_text ?? '', qTrim, maxSnippet);

        const lc = detail.linked_count;
        const linkedN =
          typeof lc === 'number' ? Math.round(lc) : lc != null ? Math.round(Number(lc)) || 0 : 0;

        results.push({
          note_id: detail.id,
          title: String(detail.title ?? ''),
          snippet: snippetFromSemantic,
          match_kind: 'semantic',
          updated_at: String(detail.updated_at ?? ''),
          status: String(detail.status ?? ''),
          maturity: String(detail.maturity ?? ''),
          tags: parseTagsJson(detail.tags_json),
          has_attachments: hasAttachmentsRow(detail.attachments_json),
          linked_artifacts_count: linkedN,
        });
        seen.add(s.pageId);
        if (results.length >= limit) break;
      }
    } catch (err) {
      logger.warn(`${LOG_PREFIX} semanticSearch degraded`, { err });
      degraded = true;
      degraded_reason = 'Semantic search unavailable — keyword results only';
    }
  }

  results.sort((a, b) => {
    const ta = new Date(a.updated_at).getTime();
    const tb = new Date(b.updated_at).getTime();
    return tb - ta;
  });

  const trimmed = results.slice(0, limit);

  const filters_applied = [
    ...appliedFilters,
    ...(semanticEnrichmentApplied ? ['semantic_enrichment'] : []),
  ];

  return {
    results: trimmed,
    total,
    filters_applied: [...new Set(filters_applied)],
    degraded,
    degraded_reason,
  };
}
