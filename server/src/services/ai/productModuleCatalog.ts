/**
 * Product module catalog for Teresa (in-app AI chat).
 *
 * Compact bilingual (EN/PL) description of every product-facing module, injected
 * into the system prompt for product / how-to questions so Teresa can answer
 * "what does X do / how do I use X" even when the Knowledge Base has no article.
 *
 * SSOT NOTE: the canonical, user-visible source is the frontend Help panel
 * (src/config/helpExperience.ts). The server build cannot import from the
 * frontend `src/` tree (separate tsconfig rootDir), so this catalog mirrors the
 * `summary` of each Help document. If you change a module summary in
 * helpExperience.ts, update the matching line here.
 */

interface ModuleCatalogEntry {
  titleEn: string;
  titlePl: string;
  summaryEn: string;
  summaryPl: string;
}

const MODULE_CATALOG: ModuleCatalogEntry[] = [
  {
    titleEn: 'Chat',
    titlePl: 'Chat',
    summaryEn:
      'Always-on workspace with Teresa, the AI consultant who knows your organization context; ask, draft, and trigger actions across modules.',
    summaryPl:
      'Zawsze dostępna przestrzeń z Teresą — konsultantką AI znającą kontekst organizacji; pytaj, twórz i uruchamiaj akcje w modułach.',
  },
  {
    titleEn: 'Interview',
    titlePl: 'Interview',
    summaryEn:
      'Discovery stage that gathers facts about the organization, its constraints, and the reality of work today.',
    summaryPl:
      'Etap discovery, który zbiera fakty o organizacji, jej ograniczeniach i o tym, jak wygląda praca dzisiaj.',
  },
  {
    titleEn: 'Tools & Assessments',
    titlePl: 'Tools & Assessments',
    summaryEn:
      'Discovery tools and assessments that define the target state and surface gaps versus today.',
    summaryPl:
      'Narzędzia discovery i oceny, które definiują stan docelowy i ujawniają luki względem stanu dzisiejszego.',
  },
  {
    titleEn: 'Audits',
    titlePl: 'Audyty',
    summaryEn:
      'Orchestrates structured maturity programs — DRD, SIRI, ADMA, Lean — into a single comparable assessment with defensible evidence.',
    summaryPl:
      'Orkiestruje ustrukturyzowane programy dojrzałości — DRD, SIRI, ADMA, Lean — w jeden porównywalny pomiar z obronnymi dowodami.',
  },
  {
    titleEn: 'Initiatives',
    titlePl: 'Initiatives',
    summaryEn:
      'Turns diagnosis into prioritized initiatives, charters, and roadmap — the engine of the transformation.',
    summaryPl:
      'Zamienia diagnozę w priorytetyzowane inicjatywy, kartę projektu i roadmapę — silnik transformacji.',
  },
  {
    titleEn: 'Execution',
    titlePl: 'Execution',
    summaryEn:
      'Delivery stage for pilots and rollout — turning approved initiatives into managed, tracked work.',
    summaryPl:
      'Etap dostarczania pilotów i rolloutu — zamiana zatwierdzonych inicjatyw w zarządzaną, śledzoną pracę.',
  },
  {
    titleEn: 'Results (Benefits)',
    titlePl: 'Wyniki (Benefits)',
    summaryEn:
      'Validates and measures outcomes — KPI/ROI and benefit realization — to prove the change worked.',
    summaryPl:
      'Waliduje i mierzy wyniki — KPI/ROI i realizację korzyści — aby udowodnić, że zmiana zadziałała.',
  },
  {
    titleEn: 'Finance',
    titlePl: 'Finance',
    summaryEn:
      'Checks value, ROI, payback, and the economic consequences of change; supports prioritization and result validation.',
    summaryPl:
      'Sprawdza wartość, ROI, payback i ekonomiczne konsekwencje zmiany; wspiera priorytetyzację i walidację wyników.',
  },
  {
    titleEn: 'My Work',
    titlePl: 'My Work',
    summaryEn:
      'Personal hub for tasks, inbox, and decisions — where assigned work and follow-ups land.',
    summaryPl:
      'Osobisty hub zadań, inboxa i decyzji — tu trafia przypisana praca i follow-upy.',
  },
  {
    titleEn: 'Ideas / Notes',
    titlePl: 'Ideas / Notatki',
    summaryEn:
      'Ideation and knowledge capture — Mind Map, Process Flow, Table, Whiteboard, and notebooks.',
    summaryPl:
      'Ideacja i przechwytywanie wiedzy — Mind Map, Process Flow, Tabela, Whiteboard i notatniki.',
  },
  {
    titleEn: 'Outputs / Presentations',
    titlePl: 'Outputs / Prezentacje',
    summaryEn:
      'Turns work into communication for leaders and clients — reports and stakeholder-ready presentations.',
    summaryPl:
      'Zamienia pracę w komunikację dla liderów i klientów — raporty i prezentacje gotowe dla interesariuszy.',
  },
  {
    titleEn: 'Document Studio',
    titlePl: 'Document Studio',
    summaryEn:
      'AI-assisted workspace for writing long-form, structured documents — draft, structure, and refine with AI.',
    summaryPl:
      'Wspierana przez AI przestrzeń do pisania długich, ustrukturyzowanych dokumentów — twórz, strukturyzuj i dopracowuj z AI.',
  },
  {
    titleEn: 'Presentation Studio',
    titlePl: 'Presentation Studio',
    summaryEn:
      'Generates and edits slide decks from a brief, document, or data — fast, structured, on-brand.',
    summaryPl:
      'Generuje i edytuje prezentacje z briefu, dokumentu lub danych — szybko, ze strukturą, spójnie z marką.',
  },
  {
    titleEn: 'Table Studio',
    titlePl: 'Table Studio',
    summaryEn:
      'AI-assisted workspace for building and reasoning over operational tables — AI fills, computes, and explains.',
    summaryPl:
      'Wspierana przez AI przestrzeń do budowania i analizy tabel operacyjnych — AI uzupełnia, liczy i wyjaśnia.',
  },
  {
    titleEn: 'Meeting',
    titlePl: 'Spotkanie',
    summaryEn:
      'Turns live conversations into structured notes, decisions, and follow-up tasks.',
    summaryPl:
      'Zamienia rozmowy na żywo w uporządkowane notatki, decyzje i zadania do wykonania.',
  },
  {
    titleEn: 'Settings',
    titlePl: 'Ustawienia',
    summaryEn:
      'Control your profile, preferences, AI behavior, security, data controls, and integrations.',
    summaryPl:
      'Kontroluj profil, preferencje, zachowanie AI, bezpieczeństwo, ustawienia danych i integracje.',
  },
];

/**
 * Build the compact product module catalog block for the given language.
 * Returns a heading plus one line per module.
 */
export function buildProductModuleCatalog(language?: string): string {
  const pl = String(language || '').toLowerCase().startsWith('pl');
  const heading = pl
    ? '## MODUŁY CONSULTIFY (używaj do pytań jak / co robi aplikacja)'
    : '## CONSULTIFY MODULES (use to answer how-to / what-is questions about the app)';
  const lines = MODULE_CATALOG.map((m) =>
    pl ? `- ${m.titlePl}: ${m.summaryPl}` : `- ${m.titleEn}: ${m.summaryEn}`
  );
  return [heading, ...lines].join('\n');
}
