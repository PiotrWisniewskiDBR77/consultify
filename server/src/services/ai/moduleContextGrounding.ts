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
  | 'chat'
  | 'interview'
  | 'tools'
  | 'initiatives'
  | 'my_work'
  | 'execution'
  | 'assessment'
  | 'results'
  | 'finance'
  | 'materials'
  | 'audits'
  | 'meetings'
  | 'admin'
  | 'settings'
  | 'organization'
  | 'partner'
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
  chat: 'Czat',
  interview: 'Wywiad',
  tools: 'Narzędzia',
  initiatives: 'Inicjatywy',
  my_work: 'Moja praca',
  execution: 'Realizacja',
  assessment: 'Ocena',
  results: 'Wyniki',
  finance: 'Finanse',
  materials: 'Materiały',
  audits: 'Audyty',
  meetings: 'Spotkania',
  admin: 'Administracja',
  settings: 'Ustawienia',
  organization: 'Organizacja',
  partner: 'Partner',
  org_overview: 'Przegląd organizacji',
};

/**
 * Rozpoznanie modułu z `screenContext`. Front wysyła to pole w kilku kształtach
 * (`moduleId`, `currentScreen`, `page.route`, `pathname`) — bierzemy wszystkie
 * i dopasowujemy po wzorcu, a nie po dokładnej wartości.
 */
export function detectModuleKey(screenContext?: Record<string, unknown> | null): ModuleContextKey {
  const page = (screenContext?.page || {}) as Record<string, unknown>;
  const rawParts = [
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
  ].filter((v) => typeof v === 'string');
  // `UnifiedChatPanel` przekazuje dziś `routeInfo` jako obiekt. Poprzednia
  // wersja ignorowała go, przez co każdy moduł wpadał do `org_overview`.
  // [ODMROZENIE 13_CHAT DEC-397]
  try {
    rawParts.push(JSON.stringify(screenContext || {}), JSON.stringify(page || {}));
  } catch { /* obiekt diagnostyczny nie może zablokować czatu */ }
  const raw = rawParts.join(' ').toLowerCase();

  if (!raw.trim()) return 'org_overview';
  if (/partner/.test(raw)) return 'partner';
  if (/settings|ustawieni/.test(raw)) return 'settings';
  if (/\/admin|administracj/.test(raw)) return 'admin';
  if (/meetings?|spotkani/.test(raw)) return 'meetings';
  if (/audit-program|\baudits?\b|audyt/.test(raw)) return 'audits';
  if (/presentation|document-studio|materials|materia/.test(raw)) return 'materials';
  if (/finance|financial|finanse|economics/.test(raw)) return 'finance';
  if (/results|wyniki|\bkpi\b|\bokr\b/.test(raw)) return 'results';
  if (/my-?work|mywork|moja-?praca|\btasks?\b|zadani/.test(raw)) return 'my_work';
  if (/interview|wywiad/.test(raw)) return 'interview';
  if (/discovery[-_]?tools|known[-_]?tool|narzędzi|narzedzi|tool_session/.test(raw)) return 'tools';
  if (/initiativ|inicjatyw/.test(raw)) return 'initiatives';
  if (/execution|realizacj|rollout/.test(raw)) return 'execution';
  if (/assessment|ocena|diagnoz/.test(raw)) return 'assessment';
  if (/organization|organizacj|context/.test(raw)) return 'organization';
  if (/\bchat\b/.test(raw)) return 'chat';
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

  const pushRows = (
    heading: string,
    kind: string,
    referenceRoot: string,
    rows: any[],
    toTitle: (row: any) => string,
    toExcerpt: (row: any) => string
  ) => {
    counts[kind] = rows.length;
    if (rows.length === 0) return;
    lines.push(`### ${heading} (${rows.length})`);
    rows.forEach((row: any, index: number) => {
      const title = truncate(toTitle(row) || 'Rekord bez nazwy', 180);
      const excerpt = truncate(toExcerpt(row), 360);
      lines.push(`- [M${citations.length + 1}] ${title}${excerpt ? ` — ${excerpt}` : ''}`);
      pushCitation(kind, index + 1, row.id, title, `${referenceRoot}/${row.id}`, excerpt || title);
    });
  };

  // Dane są rozdzielone per moduł. To celowe: źródło z Inicjatyw nie może
  // nabijać licznika „Źródła” na ekranie Spotkań albo Finansów.
  // [ODMROZENIE 02_INTERVIEW DEC-397]
  if (moduleKey === 'interview') {
    const rows = await safeQuery(
      `SELECT id, name, status, answered_questions, total_questions, summary_facts, summary_gaps
         FROM interview_sessions WHERE organization_id = ?
        ORDER BY COALESCE(updated_at, created_at) DESC LIMIT 12`,
      [organizationId]
    );
    pushRows('Sesje wywiadów', 'interviews', 'interview/sessions', rows,
      (r) => r.name || 'Wywiad bez nazwy',
      (r) => `status: ${r.status || '—'}; odpowiedzi: ${r.answered_questions ?? '—'}/${r.total_questions ?? '—'}${r.summary_facts ? `; fakty: ${truncate(r.summary_facts, 180)}` : ''}${r.summary_gaps ? `; luki: ${truncate(r.summary_gaps, 160)}` : ''}`);
  }

  // [ODMROZENIE 03_DISCOVERY_TOOLS DEC-397]
  if (moduleKey === 'tools') {
    const rows = await safeQuery(
      `SELECT id, name, tool_type, status, completion_percent, confidence_avg
         FROM tool_sessions WHERE organization_id = ?
        ORDER BY COALESCE(updated_at, created_at) DESC LIMIT 12`,
      [organizationId]
    );
    pushRows('Sesje narzędzi', 'tools', 'discovery-tools/sessions', rows,
      (r) => r.name || r.tool_type || 'Sesja narzędzia',
      (r) => `typ: ${r.tool_type || '—'}; status: ${r.status || '—'}; ukończenie: ${r.completion_percent ?? '—'}%`);
  }

  // [ODMROZENIE 04_ASSESSMENT DEC-397]
  if (moduleKey === 'assessment') {
    const rows = await safeQuery(
      `SELECT id, name, framework_type, framework, status, completion_percent, overall_score, maturity_level
         FROM assessments WHERE organization_id = ?
        ORDER BY COALESCE(updated_at, created_at) DESC LIMIT 12`,
      [organizationId]
    );
    pushRows('Oceny', 'assessments', 'assessment', rows,
      (r) => r.name || r.framework_type || r.framework || 'Ocena bez nazwy',
      (r) => `status: ${r.status || '—'}; ukończenie: ${r.completion_percent ?? '—'}%; poziom: ${r.maturity_level || '—'}; wynik: ${r.overall_score ?? '—'}`);
  }

  // [ODMROZENIE 09_RESULTS DEC-397]
  if (moduleKey === 'results') {
    const rows = await safeQuery(
      `SELECT d.kpi_id AS id, d.kpi_code AS code, d.status,
              v.name, v.unit, v.target_geometry, v.target_value, v.measurement_frequency_days
         FROM rvn_kpi_definitions d
         LEFT JOIN rvn_kpi_definition_versions v
           ON v.definition_version_id = d.current_definition_version_id
          AND v.organization_id = d.organization_id
        WHERE d.organization_id = ?
        ORDER BY d.updated_at DESC LIMIT 15`,
      [organizationId]
    );
    pushRows('Definicje KPI', 'kpis', 'results/kpi', rows,
      (r) => r.name || r.code || 'KPI bez nazwy',
      (r) => `kod: ${r.code || '—'}; status: ${r.status || '—'}; jednostka: ${r.unit || '—'}; typ celu: ${r.target_geometry || '—'}; cel: ${r.target_value ?? '—'}; częstotliwość: ${r.measurement_frequency_days ?? '—'} dni`);
  }

  // [ODMROZENIE 10_FINANCE DEC-397]
  if (moduleKey === 'finance') {
    const rows = await safeQuery(
      `SELECT id, entity_name, period_label, currency, pack_status, source_statement_count,
              pack_readiness_status, pack_readiness_score
         FROM financial_statement_packs WHERE organization_id = ?
        ORDER BY COALESCE(updated_at, created_at) DESC LIMIT 12`,
      [organizationId]
    );
    pushRows('Pakiety sprawozdań finansowych', 'financial_statements', 'finance/statements', rows,
      (r) => r.entity_name || 'Sprawozdanie bez nazwy',
      (r) => `okres: ${r.period_label || '—'}; waluta: ${r.currency || '—'}; status: ${r.pack_status || '—'}; dokumenty: ${r.source_statement_count ?? '—'}; gotowość: ${r.pack_readiness_score ?? '—'}`);
  }

  // [ODMROZENIE 11_MATERIALS DEC-397]
  if (moduleKey === 'materials') {
    const rows = await safeQuery(
      `SELECT id, title, status, deck_type, slide_count, language
         FROM presentation_decks WHERE organization_id = ?
        ORDER BY COALESCE(updated_at, created_at) DESC LIMIT 12`,
      [organizationId]
    );
    pushRows('Prezentacje', 'presentations', 'presentations', rows,
      (r) => r.title || 'Prezentacja bez tytułu',
      (r) => `status: ${r.status || '—'}; typ: ${r.deck_type || '—'}; slajdy: ${r.slide_count ?? '—'}; język: ${r.language || '—'}`);
  }

  // [ODMROZENIE 12_AUDITS DEC-397]
  if (moduleKey === 'audits') {
    const rows = await safeQuery(
      `SELECT id, name, status, lifecycle_state, objective
         FROM audit_programs WHERE organization_id = ?
        ORDER BY COALESCE(updated_at, created_at) DESC LIMIT 12`,
      [organizationId]
    );
    pushRows('Programy audytowe', 'audits', 'audit-programs', rows,
      (r) => r.name || 'Audyt bez nazwy',
      (r) => `status: ${r.status || r.lifecycle_state || '—'}${r.objective ? `; cel: ${truncate(r.objective, 220)}` : ''}`);
  }

  // [ODMROZENIE 08_MEETINGS DEC-397]
  if (moduleKey === 'meetings') {
    const rows = await safeQuery(
      `SELECT id, title, status, start_at, end_at, location
         FROM meetings WHERE organization_id = ?
        ORDER BY COALESCE(updated_at, created_at) DESC LIMIT 12`,
      [organizationId]
    );
    pushRows('Spotkania', 'meetings', 'meetings', rows,
      (r) => r.title || 'Spotkanie bez tytułu',
      (r) => `status: ${r.status || '—'}; termin: ${r.start_at || '—'}${r.location ? `; miejsce: ${r.location}` : ''}`);
  }

  // [ODMROZENIE 01_ORGANIZATION DEC-397]
  if (moduleKey === 'organization') {
    const rows = await safeQuery(
      `SELECT id, company_name, industry, company_size, location, employee_count,
              annual_revenue, key_metrics, stakeholders, open_gaps, completeness_percent
         FROM organization_context WHERE organization_id = ?
        ORDER BY updated_at DESC LIMIT 5`,
      [organizationId]
    );
    pushRows('Twierdzenia kontekstu organizacji', 'organization_claims', 'organization/claims', rows,
      (r) => r.company_name || 'Profil organizacji',
      (r) => `branża: ${r.industry || '—'}; skala: ${r.company_size || '—'}; pracownicy: ${r.employee_count ?? '—'}; przychód: ${r.annual_revenue ?? '—'}; kompletność: ${r.completeness_percent ?? '—'}%; luki: ${truncate(r.open_gaps || '', 180)}`);
  }

  // ---------------------------------------------------------------- inicjatywy
  const wantsInitiatives =
    moduleKey === 'initiatives' || moduleKey === 'execution' || moduleKey === 'chat' || moduleKey === 'org_overview';
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

  if (citations.length === 0) {
    if (moduleKey === 'org_overview' || moduleKey === 'chat') return null;
    return {
      moduleKey,
      citations: [],
      counts,
      systemInstructionAddon: [
        `## DANE MODUŁU W ZASIĘGU — ${MODULE_LABELS_PL[moduleKey].toUpperCase()}`,
        'BRAK DANYCH W MODULE dla tej organizacji i tego widoku.',
        'Odpowiedz po polsku i powiedz wprost: „Brak danych w module”.',
        'Nie zastępuj danych modułu ogólnym profilem organizacji, pamięcią ani przykładowymi danymi.',
        'Nie wymyślaj źródeł; liczba użytych źródeł ma pozostać równa 0.',
      ].join('\n'),
    };
  }

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
