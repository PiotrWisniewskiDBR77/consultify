/**
 * Product module catalog for Teresa (in-app AI chat) and Anna (text chat).
 *
 * Compact bilingual (EN/PL) description of every product-facing module — what it
 * is and what you do in it — injected into the system prompt so the assistants
 * can answer "what does X do / how do I use X" even when the Knowledge Base has
 * no article.
 *
 * SSOT NOTE: the canonical, user-visible source is the frontend Help panel
 * (src/config/helpExperience.ts). The server build cannot import from the
 * frontend `src/` tree (separate tsconfig rootDir), so this catalog mirrors the
 * `summary` + key actions of each Help document. If you change a module summary
 * in helpExperience.ts, update the matching line here.
 */

interface ModuleCatalogEntry {
  titleEn: string;
  titlePl: string;
  summaryEn: string;
  summaryPl: string;
  // One concise "what you do here" line (parity with the voice digest).
  useEn: string;
  usePl: string;
}

const MODULE_CATALOG: ModuleCatalogEntry[] = [
  {
    titleEn: 'Chat',
    titlePl: 'Chat',
    summaryEn:
      'Always-on workspace with Teresa, the AI consultant who knows your organization context; ask, draft, and trigger actions across modules.',
    summaryPl:
      'Zawsze dostępna przestrzeń z Teresą — konsultantką AI znającą kontekst organizacji; pytaj, twórz i uruchamiaj akcje w modułach.',
    useEn:
      'Ask about any module or your data, draft artifacts inline, and hand off context to the right module.',
    usePl:
      'Pytaj o dowolny moduł lub swoje dane, twórz artefakty w rozmowie i przekazuj kontekst do właściwego modułu.',
  },
  {
    titleEn: 'Interview',
    titlePl: 'Interview',
    summaryEn:
      'Discovery stage that gathers facts about the organization, its constraints, and the reality of work today.',
    summaryPl:
      'Etap discovery, który zbiera fakty o organizacji, jej ograniczeniach i o tym, jak wygląda praca dzisiaj.',
    useEn:
      'Run interview templates from Inbox, review in Sessions, and synthesize answers into Insight (Wniosek) cards.',
    usePl:
      'Uruchamiaj szablony wywiadu z Inbox, rób review w Sessions i syntetyzuj odpowiedzi w karty Wniosku.',
  },
  {
    titleEn: 'Tools & Assessments',
    titlePl: 'Tools & Assessments',
    summaryEn:
      'Discovery tools and assessments that define the target state and surface gaps versus today.',
    summaryPl:
      'Narzędzia discovery i oceny, które definiują stan docelowy i ujawniają luki względem stanu dzisiejszego.',
    useEn:
      'Pick discovery tools and assessments, score current vs target state, and produce a gap map.',
    usePl:
      'Wybieraj narzędzia discovery i oceny, oceniaj stan obecny vs docelowy i twórz mapę luk.',
  },
  {
    titleEn: 'Audits',
    titlePl: 'Audyty',
    summaryEn:
      'Orchestrates structured maturity programs — DRD, SIRI, ADMA, Lean — into a single comparable assessment with defensible evidence.',
    summaryPl:
      'Orkiestruje ustrukturyzowane programy dojrzałości — DRD, SIRI, ADMA, Lean — w jeden porównywalny pomiar z obronnymi dowodami.',
    useEn:
      'Run a recognized maturity framework end to end and capture comparable, evidence-backed scores.',
    usePl:
      'Przeprowadź uznany framework dojrzałości od początku do końca i zbierz porównywalne, udowodnione oceny.',
  },
  {
    titleEn: 'Initiatives',
    titlePl: 'Initiatives',
    summaryEn:
      'Turns diagnosis into prioritized initiatives, charters, and roadmap — the engine of the transformation.',
    summaryPl:
      'Zamienia diagnozę w priorytetyzowane inicjatywy, kartę projektu i roadmapę — silnik transformacji.',
    useEn: 'Turn insights and gaps into prioritized initiatives with charters, owners, and KPIs.',
    usePl: 'Zamieniaj wnioski i luki w priorytetyzowane inicjatywy z charterami, ownerami i KPI.',
  },
  {
    titleEn: 'Execution',
    titlePl: 'Execution',
    summaryEn:
      'Delivery stage for pilots and rollout — turning approved initiatives into managed, tracked work.',
    summaryPl:
      'Etap dostarczania pilotów i rolloutu — zamiana zatwierdzonych inicjatyw w zarządzaną, śledzoną pracę.',
    useEn:
      'Move approved initiatives into delivery — pilots, rollout, tasks, owners, and tracking.',
    usePl:
      'Przesuwaj zatwierdzone inicjatywy w realizację — piloty, rollout, taski, ownerzy i śledzenie.',
  },
  {
    titleEn: 'Results (Benefits)',
    titlePl: 'Wyniki (Benefits)',
    summaryEn:
      'Validates and measures outcomes — KPI/ROI and benefit realization — to prove the change worked.',
    summaryPl:
      'Waliduje i mierzy wyniki — KPI/ROI i realizację korzyści — aby udowodnić, że zmiana zadziałała.',
    useEn: 'Track KPI/ROI and benefit realization to prove the change worked.',
    usePl: 'Śledź KPI/ROI i realizację korzyści, aby udowodnić, że zmiana zadziałała.',
  },
  {
    titleEn: 'Finance',
    titlePl: 'Finance',
    summaryEn:
      'Checks value, ROI, payback, and the economic consequences of change; supports prioritization and result validation.',
    summaryPl:
      'Sprawdza wartość, ROI, payback i ekonomiczne konsekwencje zmiany; wspiera priorytetyzację i walidację wyników.',
    useEn: 'Model value, ROI, and payback, and stress-test the economics behind decisions.',
    usePl: 'Modeluj wartość, ROI i payback oraz testuj ekonomikę stojącą za decyzjami.',
  },
  {
    titleEn: 'My Work',
    titlePl: 'My Work',
    summaryEn:
      'Personal hub for tasks, inbox, and decisions — where assigned work and follow-ups land.',
    summaryPl: 'Osobisty hub zadań, inboxa i decyzji — tu trafia przypisana praca i follow-upy.',
    useEn: 'Manage personal tasks, inbox, and decisions; promote follow-ups into the right module.',
    usePl: 'Zarządzaj zadaniami, inboxem i decyzjami; przekazuj follow-upy do właściwego modułu.',
  },
  {
    titleEn: 'Ideas / Notes',
    titlePl: 'Ideas / Notatki',
    summaryEn:
      'Ideation and knowledge capture — Mind Map, Process Flow, Table, Whiteboard, and notebooks.',
    summaryPl:
      'Ideacja i przechwytywanie wiedzy — Mind Map, Process Flow, Tabela, Whiteboard i notatniki.',
    useEn:
      'Capture ideas and knowledge in Mind Map, Process Flow, Table, Whiteboard, and notebooks.',
    usePl: 'Przechwytuj idee i wiedzę w Mind Map, Process Flow, Tabeli, Whiteboard i notatnikach.',
  },
  {
    titleEn: 'Outputs / Presentations',
    titlePl: 'Outputs / Prezentacje',
    summaryEn:
      'Turns work into communication for leaders and clients — reports and stakeholder-ready presentations.',
    summaryPl:
      'Zamienia pracę w komunikację dla liderów i klientów — raporty i prezentacje gotowe dla interesariuszy.',
    useEn: 'Turn work into reports and stakeholder-ready presentations.',
    usePl: 'Zamieniaj pracę w raporty i prezentacje gotowe dla interesariuszy.',
  },
  {
    titleEn: 'Document Studio',
    titlePl: 'Document Studio',
    summaryEn:
      'AI-assisted workspace for writing long-form, structured documents — draft, structure, and refine with AI.',
    summaryPl:
      'Wspierana przez AI przestrzeń do pisania długich, ustrukturyzowanych dokumentów — twórz, strukturyzuj i dopracowuj z AI.',
    useEn: 'Generate and refine long-form, structured documents with AI.',
    usePl: 'Generuj i dopracowuj długie, ustrukturyzowane dokumenty z AI.',
  },
  {
    titleEn: 'Presentation Studio',
    titlePl: 'Presentation Studio',
    summaryEn:
      'Generates and edits slide decks from a brief, document, or data — fast, structured, on-brand.',
    summaryPl:
      'Generuje i edytuje prezentacje z briefu, dokumentu lub danych — szybko, ze strukturą, spójnie z marką.',
    useEn: 'Generate and edit slide decks from a brief, document, or data.',
    usePl: 'Generuj i edytuj prezentacje z briefu, dokumentu lub danych.',
  },
  {
    titleEn: 'Table Studio',
    titlePl: 'Table Studio',
    summaryEn:
      'AI-assisted workspace for building and reasoning over operational tables — AI fills, computes, and explains.',
    summaryPl:
      'Wspierana przez AI przestrzeń do budowania i analizy tabel operacyjnych — AI uzupełnia, liczy i wyjaśnia.',
    useEn: 'Build operational tables and let AI fill, compute, and explain them.',
    usePl: 'Buduj tabele operacyjne i pozwól AI je uzupełniać, liczyć i wyjaśniać.',
  },
  {
    titleEn: 'Meeting',
    titlePl: 'Spotkanie',
    summaryEn: 'Turns live conversations into structured notes, decisions, and follow-up tasks.',
    summaryPl: 'Zamienia rozmowy na żywo w uporządkowane notatki, decyzje i zadania do wykonania.',
    useEn:
      'Capture meetings into notes, decisions, and action items, then promote them to tasks or initiatives.',
    usePl:
      'Zapisuj spotkania w notatki, decyzje i zadania, a potem przekazuj je do tasków lub inicjatyw.',
  },
  {
    titleEn: 'Settings',
    titlePl: 'Ustawienia',
    summaryEn:
      'Control your profile, preferences, AI behavior, security, data controls, and integrations.',
    summaryPl:
      'Kontroluj profil, preferencje, zachowanie AI, bezpieczeństwo, ustawienia danych i integracje.',
    useEn: 'Configure your profile, AI behavior, security, data controls, and integrations.',
    usePl: 'Konfiguruj profil, zachowanie AI, bezpieczeństwo, ustawienia danych i integracje.',
  },
];

// How the two core deliverables are documented — mirrors the in-app Help docs
// (CARD_CONTENT_FORMULA + INITIATIVE_FORMULA) so the assistant can answer
// "how do we document an insight / an initiative".
const METHODS_EN = [
  'HOW WE DOCUMENT INSIGHTS & INITIATIVES:',
  '- Insight (Wniosek) from interviews: answer-first (first sentence = conclusion), evidence-grounded via an evidence map (every claim links to a session/document/data), ≥3 themes, ≥2 issues, missing data, material quality, honest about uncertainty, MECE. Flow: questions → assignment → insights → initiatives.',
  '- Initiative: starts as a charter-lite — falsifiable thesis ("if X then Y because Z"), one owner, impact × effort, ≥1 KPI (baseline → target), and a mandatory source link (lineage). The full charter (scope, deliverables, success/kill criteria, milestones, RAID, RACI) is filled progressively through gates DRAFT → review → approved → executing → done → tracking → archived.',
];
const METHODS_PL = [
  'JAK DOKUMENTUJEMY WNIOSKI I INICJATYWY:',
  '- Wniosek z wywiadów: answer-first (pierwsze zdanie = konkluzja), ugruntowany w dowodach przez mapę dowodów (każda teza wiąże się z sesją/dokumentem/danymi), ≥3 motywy, ≥2 problemy, braki danych, jakość materiału, uczciwa niepewność, MECE. Przepływ: pytania → przypisanie → insighty → inicjatywy.',
  '- Inicjatywa: startuje jako charter-lite — falsyfikowalna teza („jeśli X to Y bo Z"), jeden owner, impact × effort, ≥1 KPI (baseline → target) i obowiązkowe powiązanie ze źródłem (lineage). Pełny charter (zakres, rezultaty, kryteria sukcesu/zatrzymania, kamienie milowe, RAID, RACI) uzupełniany progresywnie przez bramki DRAFT → review → approved → executing → done → tracking → archived.',
];

export function buildProductModuleCatalog(language?: string): string {
  const pl = String(language || '')
    .toLowerCase()
    .startsWith('pl');
  const heading = pl
    ? '## MODUŁY CONSULTIFY (używaj do pytań jak / co robi aplikacja)'
    : '## CONSULTIFY MODULES (use to answer how-to / what-is questions about the app)';
  const useLabel = pl ? 'Użycie' : 'Use';
  const lines = MODULE_CATALOG.map((m) =>
    pl
      ? `- ${m.titlePl}: ${m.summaryPl} ${useLabel}: ${m.usePl}`
      : `- ${m.titleEn}: ${m.summaryEn} ${useLabel}: ${m.useEn}`
  );
  const methods = pl ? METHODS_PL : METHODS_EN;
  return [heading, ...lines, '', ...methods].join('\n');
}
