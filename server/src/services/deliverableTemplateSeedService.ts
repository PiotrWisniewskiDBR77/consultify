/**
 * deliverableTemplateSeedService — DBR77 curated template seed data.
 *
 * Eksportuje stałe z danymi szablonów (używane przez unit testy)
 * oraz funkcję seedDbr77Templates(), która wykonuje seed SQL idempotentnie.
 *
 * Seed jest normalnie wykonywany przez runTablePlatformMigrations() poprzez
 * plik server/migrations/784_dbr77_template_seeds.sql (pattern 7xx_*.sql).
 * Ta funkcja jest alternatywną ścieżką do uruchomienia ręcznego.
 */

import logger from '../utils/Logger.js';
import { queryRun } from '../utils/queryHelpers.js';

// ──────────────────────────────────────────────────────────────────────────────
// Static seed data (źródło prawdy dla unit testów)
// ──────────────────────────────────────────────────────────────────────────────

export interface DocTemplateSection {
  key: string;
  type: string;
  title: string;
  order: number;
  required: boolean;
  defaultLength?: string;
  purpose?: string;
}

export interface DocTemplateSeed {
  id: string;
  name: string;
  description: string;
  source_type: string;
  report_type: string;
  is_system: boolean;
  is_public: boolean;
  sections: DocTemplateSection[];
}

export interface DeckTemplateSeed {
  id: string;
  name: string;
  description: string;
  deck_type: string;
  is_system: boolean;
  is_active: boolean;
  outline: Array<{ intent: string; title: string }>;
}

export interface TableTemplateField {
  name: string;
  type: string;
  options?: string[];
}

export interface TableTemplateSeed {
  name: string;
  description: string;
  category: string;
  is_featured: boolean;
  schema_snapshot: { fields: TableTemplateField[] };
}

// ──────────────────────────────────────────────────────────────────────────────

export const DBR77_DOC_TEMPLATES: DocTemplateSeed[] = [
  {
    id: 'dbr77-doc-audit-report',
    name: 'Raport audytowy',
    description:
      'Ustrukturyzowany raport z audytu organizacyjnego lub procesowego. Sekcje: streszczenie, metodologia, wyniki, rekomendacje.',
    source_type: 'DELIVERABLE',
    report_type: 'audit_report',
    is_system: true,
    is_public: true,
    sections: [
      {
        key: 'executive_summary',
        type: 'summary',
        title: 'Streszczenie wykonawcze',
        order: 0,
        required: true,
        defaultLength: 'short',
        purpose: 'Kluczowe wyniki i rekomendacje w skrócie',
      },
      {
        key: 'methodology',
        type: 'methodology',
        title: 'Metodologia',
        order: 1,
        required: true,
        defaultLength: 'short',
        purpose: 'Zakres i podejście badawcze',
      },
      {
        key: 'findings',
        type: 'findings',
        title: 'Wyniki',
        order: 2,
        required: true,
        defaultLength: 'long',
        purpose: 'Szczegółowe ustalenia według obszarów',
      },
      {
        key: 'recommendations',
        type: 'recommendations',
        title: 'Rekomendacje',
        order: 3,
        required: true,
        defaultLength: 'medium',
        purpose: 'Priorytety działań i plan wdrożenia',
      },
    ],
  },
  {
    id: 'dbr77-doc-exec-memo',
    name: 'Executive memo',
    description:
      'Zwięzłe memo decyzyjne dla zarządu. Sekcje: kontekst, problem, opcje, rekomendacja.',
    source_type: 'DELIVERABLE',
    report_type: 'exec_memo',
    is_system: true,
    is_public: true,
    sections: [
      {
        key: 'context',
        type: 'context',
        title: 'Kontekst',
        order: 0,
        required: true,
        defaultLength: 'short',
        purpose: 'Sytuacja i tło decyzji',
      },
      {
        key: 'problem',
        type: 'findings',
        title: 'Problem',
        order: 1,
        required: true,
        defaultLength: 'short',
        purpose: 'Kluczowe wyzwanie do rozwiązania',
      },
      {
        key: 'options',
        type: 'list',
        title: 'Opcje',
        order: 2,
        required: true,
        defaultLength: 'medium',
        purpose: 'Warianty rozwiązania z analizą',
      },
      {
        key: 'recommendation',
        type: 'recommendations',
        title: 'Rekomendacja',
        order: 3,
        required: true,
        defaultLength: 'short',
        purpose: 'Rekomendowana opcja z uzasadnieniem',
      },
    ],
  },
  {
    id: 'dbr77-doc-status-report',
    name: 'Raport statusowy',
    description:
      'Okresowy raport postępu projektu dla sponsora. Sekcje: streszczenie statusu, zakres, postęp, ryzyka, następne kroki.',
    source_type: 'DELIVERABLE',
    report_type: 'status_report',
    is_system: true,
    is_public: true,
    sections: [
      {
        key: 'status_summary',
        type: 'summary',
        title: 'Streszczenie statusu',
        order: 0,
        required: true,
        defaultLength: 'short',
        purpose: 'Status RAG, kluczowe osiągnięcia i alerty',
      },
      {
        key: 'scope',
        type: 'context',
        title: 'Zakres i cele',
        order: 1,
        required: true,
        defaultLength: 'short',
        purpose: 'Cele okresu i zakres prac',
      },
      {
        key: 'progress',
        type: 'findings',
        title: 'Postęp i osiągnięcia',
        order: 2,
        required: true,
        defaultLength: 'long',
        purpose: 'Co zrobiono względem planu',
      },
      {
        key: 'risks',
        type: 'list',
        title: 'Ryzyka i blokery',
        order: 3,
        required: true,
        defaultLength: 'medium',
        purpose: 'Otwarte ryzyka, blokery, plan mitygacji',
      },
      {
        key: 'next_steps',
        type: 'recommendations',
        title: 'Następne kroki',
        order: 4,
        required: true,
        defaultLength: 'short',
        purpose: 'Priorytety i decyzje na kolejny okres',
      },
    ],
  },
];

export const DBR77_DECK_TEMPLATES: DeckTemplateSeed[] = [
  {
    id: 'dbr77-deck-board',
    name: 'Board deck',
    description:
      'Prezentacja dla zarządu lub rady nadzorczej. Układ: okładka, agenda, kontekst, wyniki, plan, Q&A.',
    deck_type: 'board_presentation',
    is_system: true,
    is_active: true,
    outline: [
      { intent: 'cover', title: 'Tytuł prezentacji' },
      { intent: 'agenda', title: 'Agenda' },
      { intent: 'context', title: 'Kontekst i tło' },
      { intent: 'performance_overview', title: 'Wyniki i status' },
      { intent: 'roadmap', title: 'Plan działania' },
      { intent: 'next_steps', title: 'Decyzje i Q&A' },
    ],
  },
  {
    id: 'dbr77-deck-diagnostic',
    name: 'Diagnostic deck',
    description:
      'Diagnoza organizacji lub procesu. Układ: teza, dane, analiza, wnioski, rekomendacje.',
    deck_type: 'diagnostic',
    is_system: true,
    is_active: true,
    outline: [
      { intent: 'cover', title: 'Diagnoza' },
      { intent: 'executive_summary', title: 'Teza i kluczowe wnioski' },
      { intent: 'data_overview', title: 'Dane i obserwacje' },
      { intent: 'analysis', title: 'Analiza' },
      { intent: 'key_messages', title: 'Wnioski' },
      { intent: 'recommendations', title: 'Rekomendacje' },
    ],
  },
  {
    id: 'dbr77-deck-investor-pitch',
    name: 'Investor pitch',
    description:
      'Pitch inwestorski: problem→rozwiązanie→trakcja→ask. Układ: okładka, teza, problem/rynek, rozwiązanie, model+trakcja, plan, ask.',
    deck_type: 'investor_pitch',
    is_system: true,
    is_active: true,
    outline: [
      { intent: 'cover', title: 'Pitch inwestorski' },
      { intent: 'executive_summary', title: 'Teza i ask' },
      { intent: 'context', title: 'Problem i rynek' },
      { intent: 'key_messages', title: 'Rozwiązanie i przewaga' },
      { intent: 'performance_overview', title: 'Trakcja i model' },
      { intent: 'roadmap', title: 'Plan i kamienie milowe' },
      { intent: 'next_steps', title: 'Ask i następne kroki' },
    ],
  },
];

export const DBR77_TABLE_TEMPLATES: TableTemplateSeed[] = [
  {
    name: 'Rejestr ryzyk',
    description:
      'Tabela do śledzenia ryzyk projektu lub organizacji. Kolumny: ryzyko, prawdopodobieństwo, wpływ, właściciel, status.',
    category: 'risk',
    is_featured: true,
    schema_snapshot: {
      fields: [
        { name: 'Ryzyko', type: 'text' },
        {
          name: 'Prawdopodobieństwo',
          type: 'singleSelect',
          options: ['Niskie', 'Średnie', 'Wysokie'],
        },
        { name: 'Wpływ', type: 'singleSelect', options: ['Niski', 'Średni', 'Wysoki'] },
        { name: 'Właściciel', type: 'text' },
        { name: 'Status', type: 'singleSelect', options: ['Otwarty', 'W trakcie', 'Zamknięty'] },
      ],
    },
  },
  {
    name: 'Dashboard KPI',
    description:
      'Tabela wskaźników KPI z celami i aktualnymi wynikami. Kolumny: wskaźnik, cel, wynik, odchylenie, trend.',
    category: 'kpi',
    is_featured: true,
    schema_snapshot: {
      fields: [
        { name: 'Wskaźnik', type: 'text' },
        { name: 'Cel', type: 'number' },
        { name: 'Wynik', type: 'number' },
        { name: 'Odchylenie', type: 'number' },
        { name: 'Trend', type: 'singleSelect', options: ['↑ Wzrost', '→ Stabilny', '↓ Spadek'] },
      ],
    },
  },
  {
    name: 'Rejestr inicjatyw',
    description:
      'Tabela do śledzenia inicjatyw/zadań z priorytetem i postępem. Kolumny: inicjatywa, właściciel, priorytet, status, postęp.',
    category: 'initiative',
    is_featured: true,
    schema_snapshot: {
      fields: [
        { name: 'Inicjatywa', type: 'text' },
        { name: 'Właściciel', type: 'text' },
        { name: 'Priorytet', type: 'singleSelect', options: ['Wysoki', 'Średni', 'Niski'] },
        { name: 'Status', type: 'singleSelect', options: ['Backlog', 'W toku', 'Zrobione'] },
        { name: 'Postęp (%)', type: 'number' },
      ],
    },
  },
];

// ──────────────────────────────────────────────────────────────────────────────
// Seed function (idempotent — SQL migration 784 is the primary path)
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Seeds DBR77 curated templates into DB.
 * Idempotent: ON CONFLICT DO NOTHING for doc/deck; WHERE NOT EXISTS for table (UUID PK).
 * The SQL migration 784_dbr77_template_seeds.sql covers the normal startup path.
 * Call this manually only when the migration runner is not available.
 */
export async function seedDbr77Templates(): Promise<void> {
  const TAG = '[deliverableTemplateSeedService]';

  // Doc templates
  for (const t of DBR77_DOC_TEMPLATES) {
    try {
      await queryRun(
        `INSERT INTO report_builder_templates
           (id, organization_id, name, description, source_type, report_type,
            sections_json, is_system, is_public, created_by, created_at, updated_at)
         VALUES ($1, NULL, $2, $3, $4, $5, $6, true, true, NULL, NOW(), NOW())
         ON CONFLICT (id) DO NOTHING`,
        [t.id, t.name, t.description, t.source_type, t.report_type, JSON.stringify(t.sections)]
      );
    } catch (err: any) {
      logger.warn(`${TAG} Doc template seed skipped (${t.id}): ${err?.message}`);
    }
  }

  // Deck templates
  for (const t of DBR77_DECK_TEMPLATES) {
    try {
      await queryRun(
        `INSERT INTO presentation_templates
           (id, organization_id, name, description, deck_type, audience, goal,
            outline_json, is_system, is_active, created_by, created_at, updated_at)
         VALUES ($1, NULL, $2, $3, $4, 'executive', 'inform', $5, true, true, NULL, NOW(), NOW())
         ON CONFLICT (id) DO NOTHING`,
        [t.id, t.name, t.description, t.deck_type, JSON.stringify(t.outline)]
      );
    } catch (err: any) {
      logger.warn(`${TAG} Deck template seed skipped (${t.id}): ${err?.message}`);
    }
  }

  // Table templates (UUID PK — no text id to conflict on; guard via name+category)
  for (const t of DBR77_TABLE_TEMPLATES) {
    try {
      await queryRun(
        `INSERT INTO tp_base_templates
           (name, description, category, schema_snapshot, is_featured, status,
            visibility, created_by, created_at)
         SELECT $1, $2, $3, $4::jsonb, $5, 'approved', 'system', NULL, NOW()
         WHERE NOT EXISTS (
           SELECT 1 FROM tp_base_templates WHERE name = $1 AND category = $3
         )`,
        [t.name, t.description, t.category, JSON.stringify(t.schema_snapshot), t.is_featured]
      );
      await queryRun(
        `UPDATE tp_base_templates
            SET status = 'approved', visibility = 'system'
          WHERE name = $1 AND category = $2 AND created_by IS NULL`,
        [t.name, t.category]
      );
    } catch (err: any) {
      logger.warn(`${TAG} Table template seed skipped (${t.name}): ${err?.message}`);
    }
  }

  logger.info(
    `${TAG} DBR77 template seed complete (doc:${DBR77_DOC_TEMPLATES.length}, deck:${DBR77_DECK_TEMPLATES.length}, table:${DBR77_TABLE_TEMPLATES.length})`
  );
}
