/**
 * Kontekst modułu jako ŹRÓDŁO dla Teresy (2026-09-06).
 *
 * PRZYCZYNA `degraded: no_sources` (zmierzona 05/06.09 na bazie `consultify_noc`):
 *
 *   1. `routes/ai.routes.ts` liczy `used_sources` WYŁĄCZNIE z ramek SSE `citations`.
 *      Cytaty emitują tylko cztery ścieżki: baza wiedzy produktu (help docs),
 *      wyszukiwanie web, załączniki rozmowy i korpus dokumentów organizacji.
 *   2. Korpus dokumentów organizacji jest za flagą `ENABLE_ORG_KNOWLEDGE_RETRIEVAL`,
 *      która na stanowisku (i na stagingu) NIE jest ustawiona → blok jest bezczynny.
 *   3. Nawet po jej włączeniu nic by nie znalazł: `SELECT count(*) FROM knowledge_chunks`
 *      = 0, `knowledge_documents` = 0, `ai_knowledge_embeddings` = 0. Organizacja DBR77
 *      nie ma ZAINDEKSOWANYCH dokumentów.
 *   4. Ale dane modułu ISTNIEJĄ: 71 inicjatyw i 84 zadania w DBR77 (20 przypisanych do
 *      konta audytowego). `AIContextBuilder` je czyta i wkłada do promptu
 *      (`AIPipeline.buildExecutionSection` / `buildOrganizationSection`), więc Teresa
 *      NA NICH ODPOWIADA — tylko nigdy ich nie nazywa. Rodowód (`source_ledger`)
 *      meldował `no_sources` mimo realnego ugruntowania. To był fałsz w drugą stronę:
 *      odpowiedź była ugruntowana, a rodowód mówił, że nie ma źródeł.
 *
 * `docs/ssot/ZASADY_AI_TERESA_SSOT.md` Z1 wymienia trzy klasy źródeł, które Teresa ma
 * NAZYWAĆ: kontekst organizacji, dokumenty/materiały ORAZ **dane modułu w zasięgu**.
 * Trzecia klasa nie miała żadnej implementacji po stronie cytatów — ten moduł ją dokłada.
 *
 * Zasada: cytujemy WYŁĄCZNIE rekordy, które faktycznie trafiły do promptu, zawsze
 * ograniczone do `organization_id` żądania. Gdy moduł nic nie ma — nie wymyślamy
 * źródeł, `no_sources` zostaje i jest uczciwe.
 */

import { all as dbAll } from '../../utils/DbPromise.js';
import logger from '../../utils/Logger.js';

import type { AiLanguage } from './languagePolicy.js';

export type ModuleContextKey =
  | 'initiatives'
  | 'my_work'
  | 'execution'
  | 'assessment'
  | 'org_overview';

export interface ModuleContextCitation {
  id: string;
  type: string;
  title: string;
  reference: string;
  excerpt: string;
}

export interface ModuleContextGrounding {
  moduleKey: ModuleContextKey;
  /** Doklejane do `systemInstruction` — model widzi realne rekordy klienta. */
  systemInstructionAddon: string;
  /** Emitowane jako ramka SSE `citations` — to one wypełniają `source_ledger.used_sources`. */
  citations: ModuleContextCitation[];
  /** Diagnostyka do `ai_run_events` / dowodów; nie idzie do modelu. */
  counts: Record<string, number>;
}

export interface ModuleContextGroundingInput {
  organizationId: string;
  userId: string;
  screenContext?: Record<string, unknown> | null;
  projectId?: string | null;
  language?: AiLanguage;
  /** `privateMode` albo `knowledgeSources.organizationData === false` → nie wolno czytać danych org. */
  allowOrganizationData?: boolean;
  /** Wstrzykiwalne na potrzeby testów (bez realnej bazy). */
  queryFn?: (sql: string, params: unknown[]) => Promise<any[]>;
}

const MODULE_LABELS_PL: Record<ModuleContextKey, string> = {
  initiatives: 'Inicjatywy',
  my_work: 'Moja praca',
  execution: 'Realizacja',
  assessment: 'Ocena',
  org_overview: 'Przegląd organizacji',
};

/**
 * Rozpoznanie modułu z `screenContext`. Front wysyła to pole w kilku kształtach
 * (`moduleId`, `currentScreen`, `page.route`, `pathname`) — bierzemy wszystkie
 * i dopasowujemy po wzorcu, a nie po dokładnej wartości.
 */
export function detectModuleKey(screenContext?: Record<string, unknown> | null): ModuleContextKey {
  const page = (screenContext?.page || {}) as Record<string, unknown>;
  const raw = [
    screenContext?.moduleId,
    screenContext?.module,
    screenContext?.currentModule,
    screenContext?.screenId,
    screenContext?.currentScreen,
    screenContext?.route,
    screenContext?.pathname,
    screenContext?.path,
    page.route,
    page.pathname,
    page.helpModuleId,
  ]
    .filter((v) => typeof v === 'string')
    .join(' ')
    .toLowerCase();

  if (!raw.trim()) return 'org_overview';
  if (/my-?work|mywork|moja-?praca|\btasks?\b|zadani/.test(raw)) return 'my_work';
  if (/initiativ|inicjatyw/.test(raw)) return 'initiatives';
  if (/execution|realizacj|rollout/.test(raw)) return 'execution';
  if (/assessment|ocena|diagnoz/.test(raw)) return 'assessment';
  return 'org_overview';
}

/** Identyfikator otwartej karty (np. inicjatywa otwarta w prawym panelu). */
function detectOpenRecordId(screenContext?: Record<string, unknown> | null): string | null {
  const page = (screenContext?.page || {}) as Record<string, unknown>;
  const candidates = [
    screenContext?.selectedObjectId,
    screenContext?.selectedId,
    screenContext?.initiativeId,
    screenContext?.recordId,
    screenContext?.entityId,
    page.selectedObjectId,
    page.recordId,
  ];
  for (const candidate of candidates) {
    if (typeof candidate !== 'string') continue;
    const trimmed = candidate.trim();
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trimmed)) {
      return trimmed;
    }
  }
  return null;
}

function truncate(value: unknown, max: number): string {
  const s = String(value ?? '').replace(/\s+/g, ' ').trim();
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

/**
 * Buduje blok kontekstu modułu + cytaty.
 * Zwraca `null`, gdy nie wolno czytać danych organizacji albo gdy moduł nic nie ma —
 * wtedy `no_sources` zostaje i jest UCZCIWE.
 */
export async function buildModuleContextGrounding(
  input: ModuleContextGroundingInput
): Promise<ModuleContextGrounding | null> {
  const { organizationId, userId } = input;
  if (!organizationId || input.allowOrganizationData === false) return null;

  const query = input.queryFn || ((sql: string, params: unknown[]) => dbAll(sql, params as any));
  const safeQuery = async (sql: string, params: unknown[]): Promise<any[]> => {
    try {
      const rows = await query(sql, params);
      return Array.isArray(rows) ? rows : [];
    } catch (err: any) {
      // Brak kolumny/tabeli w danym wydaniu schematu nie może wywrócić czatu.
      logger.debug(`[ModuleContext] query skipped: ${err?.message || err}`);
      return [];
    }
  };

  const moduleKey = detectModuleKey(input.screenContext);
  const openRecordId = detectOpenRecordId(input.screenContext);
  const lines: string[] = [];
  const citations: ModuleContextCitation[] = [];
  const counts: Record<string, number> = {};

  const pushCitation = (
    kind: string,
    ordinal: number,
    id: string,
    title: string,
    reference: string,
    excerpt: string
  ) => {
    citations.push({
      id: `module_${kind}_${ordinal}_${String(id).slice(0, 40)}`,
      type: 'module_data',
      title,
      reference,
      excerpt: truncate(excerpt, 480),
    });
  };

  // ---------------------------------------------------------------- inicjatywy
  const wantsInitiatives =
    moduleKey === 'initiatives' || moduleKey === 'execution' || moduleKey === 'org_overview';
  if (wantsInitiatives) {
    const rows = await safeQuery(
      `SELECT id, name, title, status, current_stage, summary, problem_statement,
              owner_business_id, updated_at, created_at
         FROM initiatives
        WHERE organization_id = ?
        ORDER BY COALESCE(updated_at, created_at) DESC
        LIMIT ?`,
      [organizationId, moduleKey === 'initiatives' ? 12 : 6]
    );
    counts.initiatives = rows.length;
    if (rows.length > 0) {
      lines.push(`### Inicjatywy organizacji (${rows.length} najświeższych)`);
      rows.forEach((row: any, index: number) => {
        const name = row.name || row.title || 'Inicjatywa bez nazwy';
        const status = row.status || row.current_stage || 'brak statusu';
        const summary = truncate(row.summary || row.problem_statement || '', 200);
        lines.push(`- [M${citations.length + 1}] ${name} — status: ${status}${summary ? `; ${summary}` : ''}`);
        pushCitation(
          'initiative',
          index + 1,
          row.id,
          `Inicjatywa: ${name}`,
          `initiatives/${row.id}`,
          summary || `Status: ${status}`
        );
      });
    }
  }

  // ------------------------------------------------------------- otwarta karta
  if (openRecordId && (moduleKey === 'initiatives' || moduleKey === 'execution')) {
    const rows = await safeQuery(
      `SELECT id, name, title, status, current_stage, summary, problem_statement,
              hypothesis, success_criteria, key_risks, business_value, expected_roi
         FROM initiatives
        WHERE id = ? AND organization_id = ?
        LIMIT 1`,
      [openRecordId, organizationId]
    );
    counts.openRecord = rows.length;
    if (rows.length > 0) {
      const row: any = rows[0];
      const name = row.name || row.title || 'Inicjatywa bez nazwy';
      const detail = [
        `status: ${row.status || row.current_stage || '—'}`,
        row.summary ? `opis: ${truncate(row.summary, 400)}` : '',
        row.problem_statement ? `problem: ${truncate(row.problem_statement, 300)}` : '',
        row.hypothesis ? `hipoteza: ${truncate(row.hypothesis, 300)}` : '',
        row.success_criteria ? `kryteria sukcesu: ${truncate(row.success_criteria, 300)}` : '',
        row.key_risks ? `ryzyka: ${truncate(row.key_risks, 300)}` : '',
        row.business_value ? `wartość: ${truncate(row.business_value, 200)}` : '',
      ]
        .filter(Boolean)
        .join('; ');
      lines.push(`### Karta otwarta przez użytkownika`);
      lines.push(`- [M${citations.length + 1}] ${name} — ${detail}`);
      pushCitation('open_record', 1, row.id, `Otwarta karta: ${name}`, `initiatives/${row.id}`, detail);
    }
  }

  // -------------------------------------------------------------------- zadania
  const wantsTasks = moduleKey === 'my_work' || moduleKey === 'execution';
  if (wantsTasks) {
    const rows = await safeQuery(
      `SELECT id, title, status, priority, due_date, blocked_reason, initiative_id
         FROM tasks
        WHERE organization_id = ?
          AND assignee_id = ?
          AND LOWER(COALESCE(status, '')) NOT IN ('done', 'completed', 'cancelled')
        ORDER BY COALESCE(due_date, updated_at, created_at) ASC
        LIMIT 15`,
      [organizationId, userId]
    );
    counts.tasks = rows.length;
    if (rows.length > 0) {
      lines.push(`### Zadania przypisane do użytkownika (${rows.length})`);
      rows.forEach((row: any, index: number) => {
        const title = row.title || 'Zadanie bez tytułu';
        const detail = [
          `status: ${row.status || '—'}`,
          row.priority ? `priorytet: ${row.priority}` : '',
          row.due_date ? `termin: ${String(row.due_date).slice(0, 10)}` : '',
          row.blocked_reason ? `blokada: ${truncate(row.blocked_reason, 160)}` : '',
        ]
          .filter(Boolean)
          .join('; ');
        lines.push(`- [M${citations.length + 1}] ${title} — ${detail}`);
        pushCitation('task', index + 1, row.id, `Zadanie: ${title}`, `tasks/${row.id}`, detail);
      });
    }
  }

  // ------------------------------------------------------------------- decyzje
  if (moduleKey === 'org_overview' || moduleKey === 'execution') {
    const rows = await safeQuery(
      `SELECT id, title, status, selected_option, decision_rationale, decided_at, created_at
         FROM decisions
        WHERE organization_id = ?
        ORDER BY COALESCE(decided_at, created_at) DESC
        LIMIT 6`,
      [organizationId]
    );
    counts.decisions = rows.length;
    if (rows.length > 0) {
      lines.push(`### Ostatnie decyzje organizacji (${rows.length})`);
      rows.forEach((row: any, index: number) => {
        const title = row.title || 'Decyzja bez tytułu';
        const detail = [
          `status: ${row.status || '—'}`,
          row.selected_option ? `wybrano: ${truncate(row.selected_option, 160)}` : '',
          row.decision_rationale ? `uzasadnienie: ${truncate(row.decision_rationale, 240)}` : '',
        ]
          .filter(Boolean)
          .join('; ');
        lines.push(`- [M${citations.length + 1}] ${title} — ${detail}`);
        pushCitation('decision', index + 1, row.id, `Decyzja: ${title}`, `decisions/${row.id}`, detail);
      });
    }
  }

  if (citations.length === 0) return null;

  const label = MODULE_LABELS_PL[moduleKey];
  const systemInstructionAddon = [
    `## DANE MODUŁU W ZASIĘGU — ${label.toUpperCase()}`,
    'To są REALNE rekordy tej organizacji, odczytane na potrzeby tego pytania.',
    '',
    ...lines,
    '',
    'Zasady korzystania z tego bloku:',
    '- Opierając się na konkretnym rekordzie, podaj jego znacznik inline: [M1], [M2], …',
    '- Nie wymyślaj rekordów, których tu nie ma, i nie zmyślaj liczb.',
    '- Jeśli pytanie dotyczy czegoś, czego w tym bloku nie ma — powiedz to wprost.',
  ].join('\n');

  return { moduleKey, systemInstructionAddon, citations, counts };
}

export default { buildModuleContextGrounding, detectModuleKey };
