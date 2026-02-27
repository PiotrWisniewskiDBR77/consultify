/**
 * Research Routes (V3-M10/M11/M12)
 *
 * Minimal "enterprise research backbone":
 * - EDGAR submissions fetch (SEC)
 * - GDELT doc search
 * - Evidence persistence with citation fields
 */
import { type Request, type Response, Router } from 'express';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';

import { isAuthenticated, verifyToken } from '../middleware/auth.middleware.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { all as dbAll, get as dbGet, run as dbRun } from '../utils/DbPromise.js';
import logger from '../utils/Logger.js';

const router = Router();
router.use(verifyToken);
router.use(isAuthenticated);

function getOrgId(req: any): string {
  return req.user?.organizationId || req.user?.organization_id || '';
}

function sha256(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex');
}

async function ensureTable(): Promise<boolean> {
  const cols = await dbAll<{ name: string }>('PRAGMA table_info(research_evidence)', []).catch(() => []);
  return (cols || []).length > 0;
}

function padCik(cik: string): string {
  const digits = cik.replace(/\D/g, '');
  return digits.padStart(10, '0');
}

router.get(
  '/evidence',
  asyncHandler(async (req: Request, res: Response) => {
    if (!(await ensureTable())) return res.status(501).json({ error: 'Research evidence store not available' });
    const orgId = getOrgId(req);
    const source = req.query.source ? String(req.query.source).trim().toLowerCase() : null;
    const limit = Math.min(200, Math.max(1, Number(req.query.limit || 50)));

    const rows = await dbAll<any[]>(
      source
        ? `SELECT id, source, query_key, title, summary, source_url, retrieved_at, hash, license_note, created_at
           FROM research_evidence
           WHERE organization_id = ? AND source = ?
           ORDER BY created_at DESC
           LIMIT ?`
        : `SELECT id, source, query_key, title, summary, source_url, retrieved_at, hash, license_note, created_at
           FROM research_evidence
           WHERE organization_id = ?
           ORDER BY created_at DESC
           LIMIT ?`,
      source ? [orgId, source, limit] : [orgId, limit]
    );
    return res.json({ evidence: rows || [] });
  })
);

router.get(
  '/evidence/:id',
  asyncHandler(async (req: Request, res: Response) => {
    if (!(await ensureTable())) return res.status(501).json({ error: 'Research evidence store not available' });
    const orgId = getOrgId(req);
    const id = String(req.params.id || '').trim();
    const row = await dbGet<any>(`SELECT * FROM research_evidence WHERE id = ? AND organization_id = ?`, [
      id,
      orgId,
    ]);
    if (!row) return res.status(404).json({ error: 'Not found' });
    return res.json({
      ...row,
      payload: (() => {
        try {
          return JSON.parse(row.payload_json || '{}');
        } catch {
          return row.payload_json;
        }
      })(),
    });
  })
);

// ------------------------------------------------------------
// EDGAR connector (SEC) — VERIFIED in SSOT
// ------------------------------------------------------------
router.post(
  '/edgar/submissions',
  asyncHandler(async (req: Request, res: Response) => {
    if (!(await ensureTable())) return res.status(501).json({ error: 'Research evidence store not available' });
    const orgId = getOrgId(req);
    const cikRaw = String((req.body as any)?.cik || '').trim();
    if (!cikRaw) return res.status(400).json({ error: 'cik is required' });

    const cik = padCik(cikRaw);
    const url = `https://data.sec.gov/submissions/CIK${cik}.json`;

    const userAgent =
      process.env.SEC_USER_AGENT ||
      process.env.EDGAR_USER_AGENT ||
      'Consultify Research Connector (contact: admin@dbr77.com)';

    const started = Date.now();
    const r = await fetch(url, { headers: { 'User-Agent': userAgent, Accept: 'application/json' } });
    const text = await r.text();
    if (!r.ok) {
      logger.warn('[Research] EDGAR fetch failed', { cik, status: r.status, body: text.slice(0, 500) });
      return res.status(502).json({ error: `EDGAR HTTP ${r.status}`, details: text.slice(0, 2000) });
    }

    const retrievedAt = new Date().toISOString();
    const hash = sha256(text);
    const id = `re-${uuidv4()}`;

    await dbRun(
      `INSERT INTO research_evidence (
        id, organization_id, source, query_key, title, summary,
        source_url, retrieved_at, hash, license_note, payload_json, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        orgId,
        'edgar',
        `cik:${cik}`,
        `SEC EDGAR submissions (CIK ${cik})`,
        'Company submissions JSON from data.sec.gov (see source_url).',
        url,
        retrievedAt,
        hash,
        'SEC EDGAR APIs (public data). Follow SEC fair access policy; include User-Agent.',
        text,
        (req as any).user?.id || null,
      ]
    );

    return res.json({
      success: true,
      id,
      source: 'edgar',
      cik,
      sourceUrl: url,
      retrievedAt,
      durationMs: Math.max(0, Date.now() - started),
    });
  })
);

// ------------------------------------------------------------
// GDELT connector — VERIFIED in SSOT (metadata ingest)
// ------------------------------------------------------------
router.post(
  '/gdelt/search',
  asyncHandler(async (req: Request, res: Response) => {
    if (!(await ensureTable())) return res.status(501).json({ error: 'Research evidence store not available' });
    const orgId = getOrgId(req);
    const q = String((req.body as any)?.query || (req.body as any)?.q || '').trim();
    if (!q) return res.status(400).json({ error: 'query is required' });

    const max = Math.min(50, Math.max(1, Number((req.body as any)?.maxRecords || 10)));
    const url =
      `https://api.gdeltproject.org/api/v2/doc/doc?` +
      `query=${encodeURIComponent(q)}&mode=artlist&format=json&maxrecords=${max}&sort=hybridrel`;

    const started = Date.now();
    const r = await fetch(url, { headers: { Accept: 'application/json' } });
    const text = await r.text();
    if (!r.ok) {
      logger.warn('[Research] GDELT fetch failed', { q, status: r.status, body: text.slice(0, 500) });
      return res.status(502).json({ error: `GDELT HTTP ${r.status}`, details: text.slice(0, 2000) });
    }

    const retrievedAt = new Date().toISOString();
    const hash = sha256(text);
    const id = `re-${uuidv4()}`;

    let title = `GDELT doc search: ${q}`;
    let summary = `Top ${max} results from GDELT doc API (metadata).`;
    try {
      const parsed = JSON.parse(text);
      const count = Number(parsed?.articles?.length || parsed?.data?.length || 0);
      summary = `GDELT returned ${count} records for query "${q}".`;
    } catch {
      // ignore
    }

    await dbRun(
      `INSERT INTO research_evidence (
        id, organization_id, source, query_key, title, summary,
        source_url, retrieved_at, hash, license_note, payload_json, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        orgId,
        'gdelt',
        `q:${q}`,
        title,
        summary,
        url,
        retrievedAt,
        hash,
        'GDELT project (public metadata). Respect API limits; store citations via source_url.',
        text,
        (req as any).user?.id || null,
      ]
    );

    return res.json({
      success: true,
      id,
      source: 'gdelt',
      query: q,
      sourceUrl: url,
      retrievedAt,
      durationMs: Math.max(0, Date.now() - started),
    });
  })
);

// ------------------------------------------------------------
// Knowledge sources (M11): OpenAlex + Crossref (unified "search")
// ------------------------------------------------------------
router.post(
  '/openalex/search',
  asyncHandler(async (req: Request, res: Response) => {
    if (!(await ensureTable())) return res.status(501).json({ error: 'Research evidence store not available' });
    const orgId = getOrgId(req);
    const q = String((req.body as any)?.query || (req.body as any)?.q || '').trim();
    if (!q) return res.status(400).json({ error: 'query is required' });
    const perPage = Math.min(25, Math.max(1, Number((req.body as any)?.limit || 10)));

    const url = `https://api.openalex.org/works?search=${encodeURIComponent(q)}&per-page=${perPage}`;
    const started = Date.now();
    const r = await fetch(url, { headers: { Accept: 'application/json' } });
    const text = await r.text();
    if (!r.ok) {
      return res.status(502).json({ error: `OpenAlex HTTP ${r.status}`, details: text.slice(0, 2000) });
    }

    const retrievedAt = new Date().toISOString();
    const hash = sha256(text);
    const id = `re-${uuidv4()}`;

    await dbRun(
      `INSERT INTO research_evidence (
        id, organization_id, source, query_key, title, summary,
        source_url, retrieved_at, hash, license_note, payload_json, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        orgId,
        'openalex',
        `q:${q}`,
        `OpenAlex search: ${q}`,
        `OpenAlex works search results (top ${perPage}). Dedupe candidate keys: DOI/arXivId/PMID (client-side).`,
        url,
        retrievedAt,
        hash,
        'OpenAlex API (metadata). Respect provider policies; store citations via source_url.',
        text,
        (req as any).user?.id || null,
      ]
    );

    return res.json({
      success: true,
      id,
      source: 'openalex',
      query: q,
      sourceUrl: url,
      retrievedAt,
      durationMs: Math.max(0, Date.now() - started),
    });
  })
);

router.post(
  '/crossref/search',
  asyncHandler(async (req: Request, res: Response) => {
    if (!(await ensureTable())) return res.status(501).json({ error: 'Research evidence store not available' });
    const orgId = getOrgId(req);
    const q = String((req.body as any)?.query || (req.body as any)?.q || '').trim();
    if (!q) return res.status(400).json({ error: 'query is required' });
    const rows = Math.min(50, Math.max(1, Number((req.body as any)?.limit || 10)));

    const url = `https://api.crossref.org/works?query.bibliographic=${encodeURIComponent(q)}&rows=${rows}`;
    const started = Date.now();
    const r = await fetch(url, { headers: { Accept: 'application/json' } });
    const text = await r.text();
    if (!r.ok) {
      return res.status(502).json({ error: `Crossref HTTP ${r.status}`, details: text.slice(0, 2000) });
    }

    const retrievedAt = new Date().toISOString();
    const hash = sha256(text);
    const id = `re-${uuidv4()}`;

    await dbRun(
      `INSERT INTO research_evidence (
        id, organization_id, source, query_key, title, summary,
        source_url, retrieved_at, hash, license_note, payload_json, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        orgId,
        'crossref',
        `q:${q}`,
        `Crossref search: ${q}`,
        `Crossref works results (top ${rows}). Dedupe keys: DOI.`,
        url,
        retrievedAt,
        hash,
        'Crossref REST API (metadata). Respect provider policies; store citations via source_url.',
        text,
        (req as any).user?.id || null,
      ]
    );

    return res.json({
      success: true,
      id,
      source: 'crossref',
      query: q,
      sourceUrl: url,
      retrievedAt,
      durationMs: Math.max(0, Date.now() - started),
    });
  })
);

// ------------------------------------------------------------
// Competitive intel (M12): Wappalyzer snapshot (BYOS)
// ------------------------------------------------------------
router.post(
  '/competitive/wappalyzer/snapshot',
  asyncHandler(async (req: Request, res: Response) => {
    if (!(await ensureTable())) return res.status(501).json({ error: 'Research evidence store not available' });
    const orgId = getOrgId(req);
    const domain = String((req.body as any)?.domain || '').trim();
    const apiKey = String((req.body as any)?.apiKey || '').trim();
    if (!domain) return res.status(400).json({ error: 'domain is required' });
    if (!apiKey) return res.status(400).json({ error: 'apiKey is required (customer BYOS)' });

    // Wappalyzer lookup (requires BYOS key)
    const url = `https://api.wappalyzer.com/v2/lookup/?urls=${encodeURIComponent(domain)}`;
    const started = Date.now();
    const r = await fetch(url, { headers: { Accept: 'application/json', 'x-api-key': apiKey } });
    const text = await r.text();
    if (!r.ok) {
      logger.warn('[Research] Wappalyzer fetch failed', { domain, status: r.status, body: text.slice(0, 500) });
      return res.status(502).json({ error: `Wappalyzer HTTP ${r.status}`, details: text.slice(0, 2000) });
    }

    const retrievedAt = new Date().toISOString();
    const hash = sha256(text);
    const id = `re-${uuidv4()}`;

    await dbRun(
      `INSERT INTO research_evidence (
        id, organization_id, source, query_key, title, summary,
        source_url, retrieved_at, hash, license_note, payload_json, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        orgId,
        'wappalyzer',
        `domain:${domain}`,
        `Wappalyzer snapshot: ${domain}`,
        'Technology stack snapshot (customer-provided subscription).',
        url,
        retrievedAt,
        hash,
        'Customer-provided Wappalyzer subscription (BYOS). Store only results + citation URL; do not persist API key.',
        text,
        (req as any).user?.id || null,
      ]
    );

    return res.json({
      success: true,
      id,
      source: 'wappalyzer',
      domain,
      sourceUrl: url,
      retrievedAt,
      durationMs: Math.max(0, Date.now() - started),
    });
  })
);

export default router;

