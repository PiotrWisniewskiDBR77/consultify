/**
 * initiativeMaterializeService (F5 — „Zrób materiał") — inicjatywa/portfel → realny
 * plik Office (deck/raport/tabela) przez DOJRZAŁY silnik M17 deliverables.
 *
 * Most: REALNE dane inicjatywy (status/KPI/ROI/właściciel/kamienie milowe) → wejście
 * generatorów M17 → bufor pliku. Bez fabrykacji: tylko realne pola; brak → „—".
 *
 * Reużyte z M17 (server/src/services/deliverables/ + workbook/):
 *   • TABELA  → `tableSchemaToWorkbook` + `buildWorkbookBuffer` (XLSX, ścieżka B4,
 *               deterministyczna, bez LLM). Tabela inicjatyw: kolumny
 *               nazwa/status/właściciel/KPI/postęp/ROI.
 *   • RAPORT  → `contentToDocumentSchema` + `renderDocumentSchemaToDocxBuffer` (DOCX).
 *   • DECK    → `deckPlansToPptxBuffer` (PPTX, minimalny renderer z planów slajdów,
 *               fail-soft). Intent slajdów = portfolio inicjatyw.
 *
 * Fail-soft: każda ścieżka łapie błąd i zwraca `null` (nigdy nie wiesza routera).
 * Strictly org-scoped: portfel czyta tylko inicjatywy danej organizacji.
 */
import logger from '../../utils/Logger.js';
import * as queryHelpers from '../../utils/queryHelpers.js';
import {
  tableSchemaToWorkbook,
  buildWorkbookBuffer,
  type TableSchemaLike,
} from '../workbook/WorkbookBuilder.js';
import {
  contentToDocumentSchema,
  safeBundleBaseName,
} from '../deliverables/bundleExportRuntime.js';
import { renderDocumentSchemaToDocxBuffer } from '../documentStudio/documentDocxRenderer.js';
import { deckPlansToPptxBuffer, type DeckPlanSlide } from '../deliverables/bundlePptxRuntime.js';
import type { BusinessPlanSpine } from '../deliverables/businessPlanSpine.js';

const LOG = '[initiativeMaterializeService]';

export type MaterializeFormat = 'deck' | 'report' | 'table';

/** Minimal DB surface — `queryHelpers` satisfies it; tests pass a mock. */
export interface MaterializeDb {
  queryOne<T = any>(sql: string, params?: unknown[]): Promise<T | null>;
  queryAll<T = any>(sql: string, params?: unknown[]): Promise<T[]>;
}

/** Wynik: realny bufor pliku + nazwa + mime (do Content-Disposition). */
export interface MaterializeResult {
  format: MaterializeFormat;
  buffer: Buffer;
  filename: string;
  mimeType: string;
}

const MIME: Record<MaterializeFormat, string> = {
  table: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  report: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  deck: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
};
const EXT: Record<MaterializeFormat, string> = { table: 'xlsx', report: 'docx', deck: 'pptx' };

const DASH = '—';

// ── Normalized initiative view (only REAL fields; missing → undefined) ──
interface InitiativeView {
  id: string;
  name: string;
  status: string | null;
  priority: string | null;
  ownerName: string | null;
  expectedRoi: number | null;
  costCapex: number | null;
  costOpex: number | null;
  businessValue: string | null;
  problemStatement: string | null;
  hypothesis: string | null;
  summary: string | null;
  startDate: string | null;
  endDate: string | null;
  /** Liczone z realnych kamieni milowych. */
  progressPct: number | null;
  primaryKpi: string | null;
  milestones: Array<{ name: string; status: string | null; targetDate: string | null }>;
}

function str(v: unknown): string | null {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  return s.length ? s : null;
}
function num(v: unknown): number | null {
  if (v === undefined || v === null || v === '') return null;
  const n = typeof v === 'number' ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : null;
}
/** „—" gdy brak; nigdy nie zmyśla wartości. */
function orDash(v: string | null): string {
  return v && v.length ? v : DASH;
}
function fmtRoi(roi: number | null): string {
  return roi === null ? DASH : `${roi}%`;
}

function ownerFromRow(row: Record<string, unknown>): string | null {
  const first = str(row.owner_first_name) ?? str(row.ob_first_name);
  const last = str(row.owner_last_name) ?? str(row.ob_last_name);
  const full = [first, last].filter(Boolean).join(' ').trim();
  return full.length ? full : null;
}

/** Read one initiative (org-scoped) + its milestones + primary KPI → normalized view. */
async function loadInitiative(
  db: MaterializeDb,
  initiativeId: string,
  orgId?: string,
): Promise<InitiativeView | null> {
  const params: unknown[] = [initiativeId];
  let where = 'i.id = ?';
  if (orgId) {
    where += ' AND i.organization_id = ?';
    params.push(orgId);
  }
  const row = await db.queryOne<Record<string, unknown>>(
    `SELECT i.*,
            ob.first_name AS owner_first_name, ob.last_name AS owner_last_name
     FROM initiatives i
     LEFT JOIN users ob ON i.owner_business_id = ob.id
     WHERE ${where}
     LIMIT 1`,
    params,
  );
  if (!row) return null;

  // Milestones (real) → progress.
  let milestones: InitiativeView['milestones'] = [];
  try {
    const mrows = await db.queryAll<Record<string, unknown>>(
      `SELECT name, status, target_date FROM initiative_milestones
       WHERE initiative_id = ? ORDER BY order_index ASC, target_date ASC`,
      [initiativeId],
    );
    milestones = (mrows ?? []).map((m) => ({
      name: orDash(str(m.name)),
      status: str(m.status),
      targetDate: str(m.target_date),
    }));
  } catch (err) {
    logger.warn(`${LOG} milestones load failed (degraded): ${err instanceof Error ? err.message : String(err)}`);
  }
  const progressPct = milestones.length
    ? Math.round(
        (milestones.filter((m) => (m.status ?? '').toUpperCase() === 'COMPLETED').length /
          milestones.length) *
          100,
      )
    : null;

  // Primary KPI (real) — first is_primary, fallback first row.
  let primaryKpi: string | null = null;
  try {
    const kpi = await db.queryOne<Record<string, unknown>>(
      `SELECT name, target_value, unit FROM initiative_kpis
       WHERE initiative_id = ? ORDER BY is_primary DESC, sort_order ASC LIMIT 1`,
      [initiativeId],
    );
    if (kpi) {
      const name = str(kpi.name);
      const target = num(kpi.target_value);
      const unit = str(kpi.unit);
      if (name) {
        primaryKpi = target !== null ? `${name}: ${target}${unit ? ` ${unit}` : ''}` : name;
      }
    }
  } catch (err) {
    logger.warn(`${LOG} kpi load failed (degraded): ${err instanceof Error ? err.message : String(err)}`);
  }

  return {
    id: String(row.id),
    name: orDash(str(row.title) ?? str(row.name)),
    status: str(row.status),
    priority: str(row.priority),
    ownerName: ownerFromRow(row),
    expectedRoi: num(row.expected_roi),
    costCapex: num(row.cost_capex),
    costOpex: num(row.cost_opex),
    businessValue: str(row.business_value),
    problemStatement: str(row.problem_statement),
    hypothesis: str(row.hypothesis),
    summary: str(row.summary),
    startDate: str(row.start_date) ?? str(row.planned_start_date),
    endDate: str(row.end_date) ?? str(row.planned_end_date),
    progressPct,
    primaryKpi,
    milestones,
  };
}

/** Org-wide portfolio (real initiatives) → normalized views (no fabrication). */
async function loadPortfolio(db: MaterializeDb, orgId: string): Promise<InitiativeView[]> {
  const rows = await db.queryAll<Record<string, unknown>>(
    `SELECT i.*,
            ob.first_name AS owner_first_name, ob.last_name AS owner_last_name
     FROM initiatives i
     LEFT JOIN users ob ON i.owner_business_id = ob.id
     WHERE i.organization_id = ?
     ORDER BY i.created_at DESC`,
    [orgId],
  );
  const views: InitiativeView[] = [];
  for (const row of rows ?? []) {
    const id = String(row.id);
    // Progress per initiative from real milestones (best-effort).
    let progressPct: number | null = null;
    let primaryKpi: string | null = null;
    try {
      const mrows = await db.queryAll<Record<string, unknown>>(
        `SELECT status FROM initiative_milestones WHERE initiative_id = ?`,
        [id],
      );
      if (mrows?.length) {
        const done = mrows.filter((m) => String(m.status ?? '').toUpperCase() === 'COMPLETED').length;
        progressPct = Math.round((done / mrows.length) * 100);
      }
      const kpi = await db.queryOne<Record<string, unknown>>(
        `SELECT name, target_value, unit FROM initiative_kpis
         WHERE initiative_id = ? ORDER BY is_primary DESC, sort_order ASC LIMIT 1`,
        [id],
      );
      if (kpi && str(kpi.name)) {
        const target = num(kpi.target_value);
        const unit = str(kpi.unit);
        primaryKpi = target !== null ? `${str(kpi.name)}: ${target}${unit ? ` ${unit}` : ''}` : str(kpi.name);
      }
    } catch {
      // fail-soft per-row enrichment
    }
    views.push({
      id,
      name: orDash(str(row.title) ?? str(row.name)),
      status: str(row.status),
      priority: str(row.priority),
      ownerName: ownerFromRow(row),
      expectedRoi: num(row.expected_roi),
      costCapex: num(row.cost_capex),
      costOpex: num(row.cost_opex),
      businessValue: str(row.business_value),
      problemStatement: str(row.problem_statement),
      hypothesis: str(row.hypothesis),
      summary: str(row.summary),
      startDate: str(row.start_date) ?? str(row.planned_start_date),
      endDate: str(row.end_date) ?? str(row.planned_end_date),
      progressPct,
      primaryKpi,
      milestones: [],
    });
  }
  return views;
}

// ════════════════════════════════════════════════════════════════════════
// TABELA — initiatives → TableSchemaLike → XLSX (M17 workbook path, no LLM)
// ════════════════════════════════════════════════════════════════════════

/** Build a `TableSchemaLike` of initiatives (cols: name/status/owner/KPI/progress/ROI). */
export function buildInitiativesTableSchema(views: InitiativeView[]): TableSchemaLike {
  const fields = [
    { key: 'name', header: 'Inicjatywa', type: 'singleLineText' },
    { key: 'status', header: 'Status', type: 'singleLineText' },
    { key: 'owner', header: 'Właściciel', type: 'singleLineText' },
    { key: 'kpi', header: 'KPI', type: 'singleLineText' },
    { key: 'progress', header: 'Postęp', type: 'percent' },
    { key: 'roi', header: 'ROI', type: 'singleLineText' },
  ];
  const seedRows = views.map((v) => ({
    name: orDash(v.name),
    status: orDash(v.status),
    owner: orDash(v.ownerName),
    kpi: orDash(v.primaryKpi),
    // percent column: ExcelJS percent fmt expects a fraction; missing → 0 placeholder
    progress: v.progressPct === null ? 0 : v.progressPct / 100,
    roi: fmtRoi(v.expectedRoi),
  }));
  return { fields, seedRows, conditionalFormatting: [] };
}

async function materializeTable(views: InitiativeView[], title: string): Promise<Buffer | null> {
  try {
    if (!views.length) return null;
    const schema = buildInitiativesTableSchema(views);
    const wb = tableSchemaToWorkbook(schema, { title, headerColor: '4472C4' });
    return await buildWorkbookBuffer(wb);
  } catch (err) {
    logger.warn(`${LOG} table materialize failed: ${err instanceof Error ? err.message : String(err)}`);
    return null;
  }
}

// ════════════════════════════════════════════════════════════════════════
// RAPORT — initiative(s) → content → DocumentSchema → DOCX (M17 doc path)
// ════════════════════════════════════════════════════════════════════════

/** Minimal spine-meta stub (DOCX renderer reads only meta.company + meta.language). */
function spineStub(company: string): BusinessPlanSpine {
  return { meta: { company, language: 'PL', thesis: '', ask: '' } } as BusinessPlanSpine;
}

function initiativeReportSections(v: InitiativeView): GenContentSection[] {
  const sections: GenContentSection[] = [];
  sections.push({
    heading: 'Przegląd inicjatywy',
    blocks: [
      {
        type: 'kpi',
        content: {
          items: [
            { label: 'Status', value: orDash(v.status) },
            { label: 'Właściciel', value: orDash(v.ownerName) },
            { label: 'Postęp', value: v.progressPct === null ? DASH : `${v.progressPct}%` },
            { label: 'ROI', value: fmtRoi(v.expectedRoi) },
          ],
        },
      },
    ],
  });
  if (v.problemStatement || v.summary) {
    sections.push({
      heading: 'Problem i kontekst',
      blocks: [{ type: 'text', content: { text: orDash(v.problemStatement ?? v.summary) } }],
    });
  }
  if (v.hypothesis) {
    sections.push({
      heading: 'Teza',
      blocks: [{ type: 'text', content: { text: v.hypothesis } }],
    });
  }
  if (v.businessValue) {
    sections.push({
      heading: 'Wartość biznesowa',
      blocks: [{ type: 'text', content: { text: v.businessValue } }],
    });
  }
  if (v.milestones.length) {
    sections.push({
      heading: 'Kamienie milowe',
      blocks: [
        {
          type: 'bulletList',
          content: {
            items: v.milestones.map(
              (m) => `${m.name} — ${orDash(m.status)}${m.targetDate ? ` (${m.targetDate})` : ''}`,
            ),
          },
        },
      ],
    });
  }
  return sections;
}

interface GenContentSection {
  heading: string;
  blocks: Array<{ type: string; content: unknown }>;
}

async function materializeReport(
  views: InitiativeView[],
  company: string,
  portfolio: boolean,
): Promise<Buffer | null> {
  try {
    if (!views.length) return null;
    let sections: GenContentSection[];
    if (portfolio) {
      sections = [
        {
          heading: 'Portfel inicjatyw',
          blocks: [
            {
              type: 'bulletList',
              content: {
                items: views.map(
                  (v) =>
                    `${orDash(v.name)} — status ${orDash(v.status)}, właściciel ${orDash(v.ownerName)}, ` +
                    `postęp ${v.progressPct === null ? DASH : `${v.progressPct}%`}, ROI ${fmtRoi(v.expectedRoi)}`,
                ),
              },
            },
          ],
        },
        ...views.flatMap((v) => initiativeReportSections(v)),
      ];
    } else {
      sections = initiativeReportSections(views[0]);
    }
    const schema = contentToDocumentSchema({ sections } as never, spineStub(company));
    return await renderDocumentSchemaToDocxBuffer(schema);
  } catch (err) {
    logger.warn(`${LOG} report materialize failed: ${err instanceof Error ? err.message : String(err)}`);
    return null;
  }
}

// ════════════════════════════════════════════════════════════════════════
// DECK — initiative(s) → deck plans → PPTX (M17 minimal renderer, fail-soft)
// ════════════════════════════════════════════════════════════════════════

function initiativeDeckPlans(views: InitiativeView[], portfolio: boolean, title: string): DeckPlanSlide[] {
  const plans: DeckPlanSlide[] = [];
  plans.push({ slideIndex: 0, layoutIntent: 'cover', title, keyMessage: portfolio ? 'Portfel inicjatyw' : orDash(views[0]?.name) });
  if (portfolio) {
    plans.push({
      slideIndex: 1,
      layoutIntent: 'initiative_portfolio',
      title: 'Portfel inicjatyw',
      keyMessage: views
        .map((v) => `${orDash(v.name)} — ${orDash(v.status)} (ROI ${fmtRoi(v.expectedRoi)})`)
        .join('; '),
    });
    views.slice(0, 12).forEach((v, i) => {
      plans.push({
        slideIndex: i + 2,
        layoutIntent: 'key_messages',
        title: orDash(v.name),
        keyMessage:
          `Status ${orDash(v.status)} · Właściciel ${orDash(v.ownerName)} · ` +
          `Postęp ${v.progressPct === null ? DASH : `${v.progressPct}%`} · ROI ${fmtRoi(v.expectedRoi)}`,
      });
    });
  } else {
    const v = views[0];
    plans.push({
      slideIndex: 1,
      layoutIntent: 'single_insight',
      title: 'Problem',
      keyMessage: orDash(v.problemStatement ?? v.summary),
    });
    plans.push({
      slideIndex: 2,
      layoutIntent: 'performance_overview',
      title: 'Status i postęp',
      keyMessage:
        `Status ${orDash(v.status)} · Postęp ${v.progressPct === null ? DASH : `${v.progressPct}%`} · ` +
        `ROI ${fmtRoi(v.expectedRoi)} · KPI ${orDash(v.primaryKpi)}`,
    });
    if (v.milestones.length) {
      plans.push({
        slideIndex: 3,
        layoutIntent: 'next_steps',
        title: 'Kamienie milowe',
        keyMessage: v.milestones.map((m) => `${m.name} (${orDash(m.status)})`).join('; '),
      });
    }
  }
  return plans;
}

async function materializeDeck(
  views: InitiativeView[],
  company: string,
  portfolio: boolean,
): Promise<Buffer | null> {
  try {
    if (!views.length) return null;
    const title = portfolio ? `${company} — Portfel inicjatyw` : `${company} — ${orDash(views[0].name)}`;
    const plans = initiativeDeckPlans(views, portfolio, title);
    return await deckPlansToPptxBuffer(plans, { title, company, language: 'pl' });
  } catch (err) {
    logger.warn(`${LOG} deck materialize failed: ${err instanceof Error ? err.message : String(err)}`);
    return null;
  }
}

// ════════════════════════════════════════════════════════════════════════
// Public API
// ════════════════════════════════════════════════════════════════════════

function resultFor(
  format: MaterializeFormat,
  buffer: Buffer | null,
  baseName: string,
): MaterializeResult | null {
  if (!buffer || buffer.length === 0) return null;
  return {
    format,
    buffer,
    filename: `${safeBundleBaseName(baseName)}.${EXT[format]}`,
    mimeType: MIME[format],
  };
}

/**
 * Jedna inicjatywa → materiał (deck/raport/tabela). Org-scope opcjonalny (gdy
 * podany — twardo filtruje cross-org). Fail-soft: null gdy brak inicjatywy lub
 * generacja padnie.
 */
export async function materializeInitiative(
  db: MaterializeDb,
  initiativeId: string,
  format: MaterializeFormat,
  opts: { orgId?: string; company?: string } = {},
): Promise<MaterializeResult | null> {
  try {
    const view = await loadInitiative(db, initiativeId, opts.orgId);
    if (!view) {
      logger.warn(`${LOG} initiative not found (id=${initiativeId})`);
      return null;
    }
    const company = opts.company || 'Organizacja';
    const baseName = view.name && view.name !== DASH ? view.name : 'inicjatywa';
    let buffer: Buffer | null = null;
    if (format === 'table') buffer = await materializeTable([view], `${baseName} — przegląd`);
    else if (format === 'report') buffer = await materializeReport([view], company, false);
    else if (format === 'deck') buffer = await materializeDeck([view], company, false);
    return resultFor(format, buffer, baseName);
  } catch (err) {
    logger.warn(`${LOG} materializeInitiative failed: ${err instanceof Error ? err.message : String(err)}`);
    return null;
  }
}

/**
 * Cały portfel organizacji → materiał (deck/raport/tabela). Strictly org-scoped.
 * Fail-soft: null gdy portfel pusty lub generacja padnie.
 */
export async function materializePortfolio(
  db: MaterializeDb,
  orgId: string,
  format: MaterializeFormat,
  opts: { company?: string } = {},
): Promise<MaterializeResult | null> {
  try {
    const views = await loadPortfolio(db, orgId);
    if (!views.length) {
      logger.warn(`${LOG} portfolio empty (org=${orgId})`);
      return null;
    }
    const company = opts.company || 'Organizacja';
    let buffer: Buffer | null = null;
    if (format === 'table') buffer = await materializeTable(views, 'Portfel inicjatyw');
    else if (format === 'report') buffer = await materializeReport(views, company, true);
    else if (format === 'deck') buffer = await materializeDeck(views, company, true);
    return resultFor(format, buffer, 'portfel-inicjatyw');
  } catch (err) {
    logger.warn(`${LOG} materializePortfolio failed: ${err instanceof Error ? err.message : String(err)}`);
    return null;
  }
}
