/**
 * Raporty Realizacji — migawki na czterech poziomach (zlecenie 1.12-R4, DEC-427).
 *
 * DLACZEGO OSOBNA TRASA, A NIE `runtime-v1/report-runs`
 * ----------------------------------------------------
 * Pomiar 06.09.2026 (`server/src/domain/initiatives-execution/reportRun.ts`):
 *   • `ReportRun` trzyma `sources[]` (sourceType/sourceId/version/freshness/confidence)
 *     — to rejestr ATESTACJI pochodzenia danych, nie treści raportu. Nie ma w nim miejsca
 *     na sekcje, tabelę decyzji po terminie ani RAG per inicjatywa.
 *   • `transitionReportRun` wymaga DWÓCH różnych aktorów: `VALIDATE`/`FREEZE` robi owner,
 *     `DECIDE`/`PUBLISH` wyłącznie `approverId !== ownerId` (reportRun.ts:228, :241).
 *     Jedna osoba nie doprowadzi migawki do „Opublikowany".
 * Ta trasa NIE zastępuje tamtego rejestru — dokłada brakującą warstwę treści. Katalog
 * definicji zostaje jeden: `report_definitions` (migracja 910 + 20260906).
 *
 * BEZPIECZEŃSTWO: każdy odczyt i zapis jest zawężony do `organization_id` z ZWERYFIKOWANEGO
 * tokenu (nigdy z body/query). Wiersz obcej organizacji ma być nieodróżnialny od
 * nieistniejącego → 404, nigdy 403.
 */

import { Request, Response, Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';

import { isAuthenticated, verifyToken } from '../middleware/auth.middleware.js';
import { unifiedExportService } from '../services/export/UnifiedExportService.js';
import { all as dbAll, get as dbGet, run as dbRun } from '../utils/DbPromise.js';
import logger from '../utils/Logger.js';
import { parseMaybeJson } from '../utils/pgFlags.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

interface AuthRequest extends Request {
  user?: { id: string; organizationId: string; firstName?: string; lastName?: string };
}

/** Cztery poziomy raportowania (A1 pkt 8 metodyki 1.12). */
export const EXECUTION_REPORT_LEVELS = ['OWNER', 'PMO', 'STEERCO', 'BOARD'] as const;
export type ExecutionReportLevel = (typeof EXECUTION_REPORT_LEVELS)[number];

/**
 * Poziom + status MVP per klucz definicji. Źródłem NAZW pozostaje baza
 * (`report_definitions`); tutaj żyje tylko przypisanie do poziomu i decyzja
 * „MVP vs Fala 2" (DECYZJA CTO — pytanie 4 z C5 planu 1.12: cztery raporty,
 * po jednym na poziom; reszta widoczna, ale bez generowania).
 */
export const EXECUTION_REPORT_CATALOG: Record<
  string,
  { level: ExecutionReportLevel; mvp: boolean; formats: Array<'SCREEN' | 'DOCX' | 'PDF'> }
> = {
  'initiative-card': { level: 'OWNER', mvp: true, formats: ['SCREEN'] },
  'weekly-exec': { level: 'PMO', mvp: true, formats: ['SCREEN', 'DOCX'] },
  'program-health': { level: 'STEERCO', mvp: true, formats: ['SCREEN', 'PDF'] },
  'sponsor-onepager': { level: 'BOARD', mvp: true, formats: ['SCREEN', 'PDF', 'DOCX'] },
  'milestone-slippage': { level: 'PMO', mvp: false, formats: ['SCREEN'] },
  'decision-backlog': { level: 'PMO', mvp: false, formats: ['SCREEN'] },
  'capacity-utilization': { level: 'PMO', mvp: false, formats: ['SCREEN'] },
  'blockers-recovery': { level: 'PMO', mvp: false, formats: ['SCREEN'] },
  'cross-dependency': { level: 'PMO', mvp: false, formats: ['SCREEN'] },
  'delivery-confidence': { level: 'STEERCO', mvp: false, formats: ['SCREEN'] },
  'budget-variance': { level: 'STEERCO', mvp: false, formats: ['SCREEN'] },
  'monthly-pmo': { level: 'BOARD', mvp: false, formats: ['SCREEN'] },
};

const SectionSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  narrative: z.string().optional(),
  bullets: z.array(z.string()).optional(),
  table: z
    .object({
      columns: z.array(z.object({ id: z.string().min(1), label: z.string().min(1) })).min(1),
      rows: z.array(z.record(z.string(), z.string())),
    })
    .optional(),
  empty: z.string().optional(),
});

const SnapshotSchema = z.object({
  definitionKey: z.string().min(1),
  title: z.string().min(1),
  subtitle: z.string().optional(),
  rag: z.enum(['GREEN', 'AMBER', 'RED', 'GREY']),
  ragReason: z.string().optional(),
  period: z.object({ start: z.string().min(1), end: z.string().min(1) }),
  asOf: z.string().min(1),
  metrics: z
    .array(
      z.object({
        id: z.string().min(1),
        label: z.string().min(1),
        value: z.string(),
        hint: z.string().optional(),
        tone: z.enum(['NEUTRAL', 'WARN', 'CRIT', 'OK', 'GREY']).optional(),
      })
    )
    .default([]),
  sections: z.array(SectionSchema).min(1),
});

export type ExecutionReportSnapshotPayload = z.infer<typeof SnapshotSchema>;

const RAG_LABEL_PL: Record<string, string> = {
  GREEN: 'Zielony',
  AMBER: 'Żółty',
  RED: 'Czerwony',
  GREY: 'Szary (luka danych)',
};

const LEVEL_LABEL_PL: Record<ExecutionReportLevel, string> = {
  OWNER: 'Właściciel inicjatywy',
  PMO: 'PMO',
  STEERCO: 'Komitet sterujący',
  BOARD: 'Zarząd',
};

const formatDatePl = (iso: string) => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat('pl-PL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
};

/** Ucieczka znaku `|`, żeby komórka nie rozbiła tabeli markdown. */
const cell = (value: string) => String(value ?? '').replace(/\|/g, '\\|').replace(/\n+/g, ' ');

/**
 * Migawka → markdown. Jedno źródło dla DOCX i PDF: `UnifiedExportService` renderuje
 * markdown na natywne prymitywy każdego formatu (nagłówki, listy, tabele), więc nowy
 * układ raportu Realizacji NIE wymaga drugiego generatora — to jest ten „minimalny
 * wspólny wołacz" z kroku 3 zlecenia.
 */
export function snapshotToMarkdown(
  snapshot: ExecutionReportSnapshotPayload,
  level: ExecutionReportLevel,
  statusLabel = 'Szkic'
): string {
  const lines: string[] = [];
  if (snapshot.subtitle) lines.push(`_${snapshot.subtitle}_`, '');
  lines.push(
    `**Status:** ${statusLabel}  `,
    `**Poziom raportu:** ${LEVEL_LABEL_PL[level]}  `,
    `**Okres:** ${formatDatePl(snapshot.period.start)} – ${formatDatePl(snapshot.period.end)}  `,
    `**Stan danych na:** ${formatDatePl(snapshot.asOf)}  `,
    `**Ocena RAG:** ${RAG_LABEL_PL[snapshot.rag] ?? snapshot.rag}${
      snapshot.ragReason ? ` — ${snapshot.ragReason}` : ''
    }`,
    ''
  );
  if (snapshot.metrics.length) {
    lines.push('| Miernik | Wartość |', '| --- | --- |');
    for (const metric of snapshot.metrics) {
      lines.push(`| ${cell(metric.label)} | ${cell(metric.value)} |`);
    }
    lines.push('');
  }
  for (const section of snapshot.sections) {
    lines.push(`## ${section.title}`, '');
    if (section.narrative) lines.push(section.narrative, '');
    if (section.bullets?.length) {
      for (const bullet of section.bullets) lines.push(`- ${bullet}`);
      lines.push('');
    }
    if (section.table && section.table.rows.length) {
      lines.push(`| ${section.table.columns.map((c) => cell(c.label)).join(' | ')} |`);
      lines.push(`| ${section.table.columns.map(() => '---').join(' | ')} |`);
      for (const row of section.table.rows) {
        lines.push(`| ${section.table.columns.map((c) => cell(row[c.id] ?? '—')).join(' | ')} |`);
      }
      lines.push('');
    }
    const hasContent =
      Boolean(section.narrative) ||
      Boolean(section.bullets?.length) ||
      Boolean(section.table?.rows.length);
    if (!hasContent) {
      lines.push(section.empty || 'Brak danych w tym okresie.', '');
    }
  }
  return lines.join('\n');
}

/**
 * Sanitizer wejścia serwera koduje encje HTML w CIELE ŻĄDANIA, więc migawka wysłana
 * z przeglądarki jako „Compliance & GDPR Audit" ląduje w bazie jako
 * „Compliance &amp; GDPR Audit" (zmierzone 06.09 na pierwszym eksporcie PDF).
 * Odkodowujemy przy ODCZYCIE — jedno miejsce dla dokumentu na ekranie i dla pliku.
 * Wynik jest zwykłym tekstem: React go ponownie escapuje, a DOCX/PDF nie interpretują HTML.
 */
const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
};
function decodeEntitiesOnce(value: string): string {
  return value.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (match, body: string) => {
    if (body[0] === '#') {
      const isHex = body[1] === 'x' || body[1] === 'X';
      const code = Number.parseInt(isHex ? body.slice(2) : body.slice(1), isHex ? 16 : 10);
      if (Number.isFinite(code) && code > 0 && code <= 0x10ffff) {
        try {
          return String.fromCodePoint(code);
        } catch {
          return match;
        }
      }
      return match;
    }
    const named = NAMED_ENTITIES[body.toLowerCase()];
    return named !== undefined ? named : match;
  });
}
export function decodeSnapshotEntities<T>(value: T): T {
  if (typeof value === 'string') {
    let current: string = value;
    for (let i = 0; i < 5; i += 1) {
      const next = decodeEntitiesOnce(current);
      if (next === current) break;
      current = next;
    }
    return current as unknown as T;
  }
  if (Array.isArray(value)) return value.map((item) => decodeSnapshotEntities(item)) as unknown as T;
  // Daty z pg wracają jako `Date`. Bez tego wyjątku rekurencja zamieniała je w `{}`
  // i rejestr pokazywał „UNKNOWN – UNKNOWN" w kolumnie Okres (zmierzone na zrzucie 02).
  if (value instanceof Date) return value;
  if (value && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      out[key] = decodeSnapshotEntities(item);
    }
    return out as unknown as T;
  }
  return value;
}

const rowToDto = (row: any) => ({
  id: row.id,
  definitionKey: row.definitionKey,
  level: row.level,
  title: row.title,
  status: row.status,
  rag: row.rag,
  period: { start: row.periodStart, end: row.periodEnd },
  asOf: row.asOf,
  createdAt: row.createdAt,
  createdByName: row.createdByName,
  publishedAt: row.publishedAt,
});

/** GET /api/execution-reports/definitions — katalog z poziomem i znacznikiem MVP. */
router.get(
  '/definitions',
  verifyToken,
  isAuthenticated,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId ?? null;
    const rows = (await dbAll(
      `SELECT id, key, name, audience, cadence, scope, sections_json AS "sectionsJson",
              source_binding AS "sourceBinding"
         FROM report_definitions
        WHERE kind = 'EXECUTION_PACK'
          AND (organization_id IS NULL OR organization_id = ?)
        ORDER BY key`,
      [orgId]
    )) as any[];
    res.json({
      definitions: rows.map((row) => {
        const meta = EXECUTION_REPORT_CATALOG[row.key] ?? {
          level: 'PMO' as ExecutionReportLevel,
          mvp: false,
          formats: ['SCREEN' as const],
        };
        return {
          key: row.key,
          name: row.name,
          audience: row.audience,
          cadence: row.cadence,
          scope: row.scope,
          sections: parseMaybeJson<string[]>(row.sectionsJson, []),
          level: meta.level,
          mvp: meta.mvp,
          formats: meta.formats,
        };
      }),
    });
  })
);

/** GET /api/execution-reports/runs — rejestr migawek organizacji. */
router.get(
  '/runs',
  verifyToken,
  isAuthenticated,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId;
    if (!orgId) {
      res.status(401).json({ error: 'AUTH_REQUIRED' });
      return;
    }
    const rows = (await dbAll(
      `SELECT id, definition_key AS "definitionKey", level, title, status, rag,
              period_start AS "periodStart", period_end AS "periodEnd", as_of AS "asOf",
              created_at AS "createdAt", created_by_name AS "createdByName",
              published_at AS "publishedAt"
         FROM execution_report_snapshots
        WHERE organization_id = ?
        ORDER BY created_at DESC`,
      [orgId]
    )) as any[];
    res.json({ items: rows.map((row) => decodeSnapshotEntities(rowToDto(row))) });
  })
);

/** GET /api/execution-reports/runs/:id — pełna migawka (sekcje + mierniki). */
router.get(
  '/runs/:id',
  verifyToken,
  isAuthenticated,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId;
    const row = await loadSnapshot(String(req.params.id), orgId);
    if (!row) {
      res.status(404).json({ error: 'NOT_FOUND' });
      return;
    }
    res.json({
      ...rowToDto(row),
      payload: decodeSnapshotEntities(parseMaybeJson<any>(row.payload, {})),
    });
  })
);

async function loadSnapshot(id: string, orgId?: string) {
  if (!orgId) return null;
  return (await dbGet(
    `SELECT id, definition_key AS "definitionKey", level, title, status, rag,
            period_start AS "periodStart", period_end AS "periodEnd", as_of AS "asOf",
            created_at AS "createdAt", created_by_name AS "createdByName",
            published_at AS "publishedAt", payload
       FROM execution_report_snapshots
      WHERE id = ? AND organization_id = ?`,
    [id, orgId]
  )) as any;
}

/** POST /api/execution-reports/runs — zapis migawki (`Szkic`). */
router.post(
  '/runs',
  verifyToken,
  isAuthenticated,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId;
    if (!orgId) {
      res.status(401).json({ error: 'AUTH_REQUIRED' });
      return;
    }
    const parsed = SnapshotSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'VALIDATION_FAILED', code: 'SNAPSHOT_INVALID' });
      return;
    }
    const snapshot = parsed.data;
    const meta = EXECUTION_REPORT_CATALOG[snapshot.definitionKey];
    if (!meta) {
      res.status(400).json({ error: 'UNKNOWN_DEFINITION' });
      return;
    }
    if (!meta.mvp) {
      // Fala 2 — definicja jest widoczna w katalogu, ale nie generuje migawki.
      res.status(409).json({ error: 'DEFINITION_NOT_AVAILABLE_YET', code: 'WAVE_2' });
      return;
    }
    const id = uuidv4();
    // Nazwisko autora czytamy z bazy, nie z tokenu: `req.user.name` powstaje z claimu,
    // którego nasze tokeny nie niosą — `splitDisplayName` daje wtedy zastępcze „User"
    // i taki podpis trafiłby na dokument raportu (zmierzone 06.09 na pierwszej migawce).
    const authorRow = req.user?.id
      ? ((await dbGet(`SELECT first_name AS "firstName", last_name AS "lastName" FROM users WHERE id = ?`, [
          req.user.id,
        ])) as any)
      : null;
    const authorName =
      [authorRow?.firstName, authorRow?.lastName].filter(Boolean).join(' ').trim() ||
      [req.user?.firstName, req.user?.lastName].filter(Boolean).join(' ').trim() ||
      null;
    await dbRun(
      `INSERT INTO execution_report_snapshots
         (id, organization_id, definition_key, level, title, period_start, period_end, as_of,
          status, rag, payload, created_by, created_by_name)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'DRAFT', ?, ?::JSONB, ?, ?)`,
      [
        id,
        orgId,
        snapshot.definitionKey,
        meta.level,
        snapshot.title,
        snapshot.period.start,
        snapshot.period.end,
        snapshot.asOf,
        snapshot.rag,
        JSON.stringify(snapshot),
        req.user?.id ?? null,
        authorName,
      ]
    );
    const row = await loadSnapshot(id, orgId);
    res.status(201).json({ ...rowToDto(row), payload: decodeSnapshotEntities(snapshot) });
  })
);

/** POST /api/execution-reports/runs/:id/publish — `Szkic` → `Opublikowany`. */
router.post(
  '/runs/:id/publish',
  verifyToken,
  isAuthenticated,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId;
    const row = await loadSnapshot(String(req.params.id), orgId);
    if (!row) {
      res.status(404).json({ error: 'NOT_FOUND' });
      return;
    }
    if (row.status === 'PUBLISHED') {
      res.json(rowToDto(row));
      return;
    }
    await dbRun(
      `UPDATE execution_report_snapshots
          SET status = 'PUBLISHED', published_at = now()
        WHERE id = ? AND organization_id = ?`,
      [row.id, orgId]
    );
    res.json(rowToDto(await loadSnapshot(row.id, orgId)));
  })
);

const EXPORTS: Record<
  string,
  { contentType: string; extension: string; render: (src: any) => Promise<Buffer> }
> = {
  docx: {
    contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    extension: 'docx',
    render: (src) => unifiedExportService.exportDocx(src),
  },
  pdf: {
    contentType: 'application/pdf',
    extension: 'pdf',
    render: (src) => unifiedExportService.exportPdf(src),
  },
};

const exportSnapshot = (format: 'docx' | 'pdf') =>
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId;
    const row = await loadSnapshot(String(req.params.id), orgId);
    if (!row) {
      res.status(404).json({ error: 'NOT_FOUND' });
      return;
    }
    const payload = decodeSnapshotEntities(
      parseMaybeJson<ExecutionReportSnapshotPayload | null>(row.payload, null)
    );
    if (!payload?.sections?.length) {
      res.status(409).json({ error: 'EMPTY_SNAPSHOT', code: 'NO_SECTIONS' });
      return;
    }
    const target = EXPORTS[format];
    try {
      const statusLabel = row.status === 'PUBLISHED' ? 'Opublikowany' : 'Szkic';
      const buffer = await target.render({
        title: row.title,
        markdown: snapshotToMarkdown(payload, row.level as ExecutionReportLevel, statusLabel),
        sourceLabel: `Consultify · Realizacja · ${LEVEL_LABEL_PL[row.level as ExecutionReportLevel] ?? row.level}`,
        // `lifecycle` i `updatedAt` CELOWO pominięte: UnifiedExportService drukuje przy nich
        // zaszyte po angielsku etykiety „Lifecycle:" / „Updated:" (UnifiedExportService.ts:296,
        // :306). Ta sama informacja jest w markdownie po polsku, więc dokument zostaje w
        // jednym języku bez ruszania współdzielonego silnika eksportu.
        author: row.createdByName || undefined,
      });
      const safeName = String(row.title)
        .normalize('NFKD')
        .replace(/[^\p{L}\p{N}]+/gu, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 80);
      res.setHeader('Content-Type', target.contentType);
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${safeName || 'raport'}.${target.extension}"`
      );
      res.end(buffer);
    } catch (error) {
      logger.error('[ExecutionReports] eksport nie powiódł się', {
        id: row.id,
        format,
        error: (error as Error)?.message,
      });
      res.status(500).json({ error: 'EXPORT_FAILED', code: `EXPORT_${format.toUpperCase()}_FAILED` });
    }
  });

router.get('/runs/:id/export.docx', verifyToken, isAuthenticated, exportSnapshot('docx'));
router.get('/runs/:id/export.pdf', verifyToken, isAuthenticated, exportSnapshot('pdf'));

export default router;
