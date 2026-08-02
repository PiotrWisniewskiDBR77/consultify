-- Bundle 04 (T018-T021) — Tools: Known Tools library + KB linking (top 10)
-- PostgreSQL-native migration.

-- Ensure base table exists (older DBs may not have 252_tools_system applied)
CREATE TABLE IF NOT EXISTS tools (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    category TEXT NOT NULL,
    tool_type TEXT,
    library_category TEXT,
    description TEXT,
    description_translations TEXT,
    library_content_translations TEXT,
    icon TEXT,
    is_licensed INTEGER DEFAULT 0,
    license_holder TEXT,
    is_active INTEGER DEFAULT 1,
    is_coming_soon INTEGER DEFAULT 0,
    config_schema TEXT,
    help_url TEXT,
    tags_json TEXT DEFAULT '[]',
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ==========================================
-- TOOLS LIBRARY FIELDS (extends existing `tools`)
-- ==========================================

ALTER TABLE tools
  ADD COLUMN IF NOT EXISTS tool_type TEXT;

ALTER TABLE tools
  ADD COLUMN IF NOT EXISTS library_category TEXT; -- strategic | operational | digital | automation

ALTER TABLE tools
  ADD COLUMN IF NOT EXISTS library_content_translations TEXT; -- JSON string: {en:{...},pl:{...}}

ALTER TABLE tools
  ADD COLUMN IF NOT EXISTS tags_json TEXT DEFAULT '[]'; -- JSON string array

-- ==========================================
-- Normalize is_licensed to the canonical INTEGER type before the integer seed.
-- On drifted DBs the column became BOOLEAN, which (a) breaks the integer INSERT
-- below and (b) already breaks toolsService.ts (`is_licensed === 1` is never
-- true for a boolean). Convert true→1 / false→0; semantics preserved.
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tools' AND column_name = 'is_licensed' AND data_type = 'boolean'
  ) THEN
    ALTER TABLE tools ALTER COLUMN is_licensed DROP DEFAULT;
    ALTER TABLE tools ALTER COLUMN is_licensed TYPE INTEGER USING (CASE WHEN is_licensed THEN 1 ELSE 0 END);
    ALTER TABLE tools ALTER COLUMN is_licensed SET DEFAULT 0;
  END IF;
END $$;

-- SEED: TOP 10 KNOWN TOOLS (T019 list)
-- Source of truth: `tool_type` values in the tools engine (`tool_sessions.tool_type`)
-- ==========================================

INSERT INTO tools (
  id,
  name,
  tool_type,
  display_name,
  category,
  library_category,
  description,
  description_translations,
  library_content_translations,
  icon,
  is_licensed,
  is_active,
  is_coming_soon,
  tags_json,
  sort_order
) VALUES
  (
    'tool-known-dynamic-swot',
    'dynamic-swot',
    'dynamic-swot',
    'Dynamic SWOT',
    'analysis',
    'strategic',
    'AI-powered SWOT that ends with actionable takeaways and initiative concepts.',
    $${
      "en": "AI-powered SWOT that ends with actionable takeaways and initiative concepts.",
      "pl": "SWOT wspierany przez AI, kończący się konkretnymi wnioskami i koncepcjami inicjatyw."
    }$$,
    $${
      "en": {
        "shortDescription": "A modern SWOT used to identify strengths, weaknesses, opportunities, and threats and translate them into actions.",
        "whenToUse": "Use when you need a fast, shared view of the current situation and a first list of initiatives.",
        "whatYouGet": ["Key takeaways", "Risks & unknowns", "Draft initiatives"],
        "inputs": ["Context (industry, scope)", "Current goals", "Known constraints", "Top signals from data/interviews"],
        "steps": ["Capture signals", "Group into SWOT", "Validate/normalize", "Derive implications", "Propose initiatives"],
        "outputs": ["SWOT summary", "Prioritized implications", "3–7 initiative concepts"],
        "commonMistakes": ["Mixing symptoms with causes", "Listing too many items", "No link to actions"],
        "example": "Weakness: long lead time. Opportunity: supplier digitalization. Initiative: introduce supplier portal + forecasting.",
        "nextSteps": ["Generate report/deck", "Create initiatives batch"]
      },
      "pl": {
        "shortDescription": "Nowoczesny SWOT do zebrania sygnałów, zbudowania wspólnego obrazu sytuacji i przełożenia go na działania.",
        "whenToUse": "Gdy potrzebujesz szybkiej diagnozy i pierwszej listy inicjatyw opartych o fakty.",
        "whatYouGet": ["Najważniejsze wnioski", "Ryzyka i niewiadome", "Draft inicjatyw"],
        "inputs": ["Kontekst (branża, zakres)", "Cele", "Ograniczenia", "Sygnały z danych/wywiadów"],
        "steps": ["Zbierz sygnały", "Ułóż w SWOT", "Zweryfikuj i uprość", "Wyciągnij implikacje", "Zaproponuj inicjatywy"],
        "outputs": ["Podsumowanie SWOT", "Priorytety implikacji", "3–7 koncepcji inicjatyw"],
        "commonMistakes": ["Mieszanie objawów z przyczynami", "Za długa lista", "Brak przełożenia na działania"],
        "example": "Słabość: długi lead time. Szansa: cyfryzacja dostawców. Inicjatywa: portal dostawcy + prognozowanie.",
        "nextSteps": ["Wygeneruj raport/prezentację", "Utwórz batch inicjatyw"]
      }
    }$$,
    'Target',
    0,
    1,
    0,
    $$["strategy","swot","diagnosis"]$$,
    101
  ),
  (
    'tool-known-market-forces',
    'market-forces',
    'market-forces',
    'Market Forces (Porter)',
    'analysis',
    'strategic',
    'Porter 5 Forces analysis translated into strategic risks and initiatives.',
    $${
      "en": "Porter 5 Forces analysis translated into strategic risks and initiatives.",
      "pl": "Analiza 5 sił Portera przełożona na ryzyka strategiczne i inicjatywy."
    }$$,
    $${
      "en": {
        "shortDescription": "Assess competitive pressure through five forces and identify where value is captured or lost.",
        "whenToUse": "Use when entering a new market, facing margin pressure, or planning differentiation/defensibility.",
        "whatYouGet": ["Force scorecard", "Defensibility levers", "Draft initiatives"],
        "inputs": ["Industry definition", "Key competitors", "Supplier/customer structure", "Substitutes & entrants signals"],
        "steps": ["Score each force", "Explain evidence", "Identify pressure points", "Define strategic levers", "Propose initiatives"],
        "outputs": ["5-forces summary", "Key risks", "3–7 initiative concepts"],
        "commonMistakes": ["Vague evidence", "Ignoring substitutes", "No actionable levers"],
        "example": "High buyer power → initiatives: product bundling, switching costs, service-level differentiation.",
        "nextSteps": ["Generate report/deck", "Create initiatives batch"]
      },
      "pl": {
        "shortDescription": "Ocena presji konkurencyjnej przez 5 sił i wskazanie dźwigni obrony marży.",
        "whenToUse": "Gdy wchodzisz na nowy rynek, masz presję na marżę lub planujesz wyróżnienie/obronę pozycji.",
        "whatYouGet": ["Scorecard 5 sił", "Dźwignie defensywności", "Draft inicjatyw"],
        "inputs": ["Definicja branży", "Konkurenci", "Struktura dostawców/klientów", "Substytuty i sygnały wejść"],
        "steps": ["Oceń siły", "Opisz evidence", "Wskaż punkty presji", "Zdefiniuj dźwignie", "Zaproponuj inicjatywy"],
        "outputs": ["Podsumowanie 5 sił", "Kluczowe ryzyka", "3–7 koncepcji inicjatyw"],
        "commonMistakes": ["Zbyt ogólne uzasadnienia", "Pomijanie substytutów", "Brak dźwigni w działaniach"],
        "example": "Wysoka siła nabywców → bundling, koszty zmiany, wyróżnienie SLA.",
        "nextSteps": ["Wygeneruj raport/prezentację", "Utwórz batch inicjatyw"]
      }
    }$$,
    'TrendingUp',
    0,
    1,
    0,
    $$["strategy","porter","competition"]$$,
    102
  ),
  (
    'tool-known-growth-paths',
    'growth-paths',
    'growth-paths',
    'Growth Paths (Ansoff)',
    'analysis',
    'strategic',
    'Ansoff matrix to explore growth options and select viable paths with risk framing.',
    $${
      "en": "Ansoff matrix to explore growth options and select viable paths with risk framing.",
      "pl": "Macierz Ansoffa do wyboru ścieżek wzrostu wraz z oceną ryzyk."
    }$$,
    $${
      "en": {
        "shortDescription": "Explore growth through market/product moves and select feasible bets.",
        "whenToUse": "Use when strategy needs growth options: new products, new markets, or diversification.",
        "whatYouGet": ["Option map", "Risk framing", "Draft initiatives"],
        "inputs": ["Current products/segments", "Adjacent markets", "Capabilities", "Risk appetite"],
        "steps": ["Map options in matrix", "Estimate value & risk", "Select 1–2 paths", "Define enabling initiatives"],
        "outputs": ["Chosen growth paths", "Assumptions & unknowns", "3–7 initiative concepts"],
        "commonMistakes": ["Picking too many paths", "Ignoring capability gaps", "No experiment plan"],
        "example": "Market development → expand to DACH with partner channel and localized offering.",
        "nextSteps": ["Generate report/deck", "Create initiatives batch"]
      },
      "pl": {
        "shortDescription": "Wybór opcji wzrostu przez ruchy produkt/rynek i selekcja wykonalnych zakładów.",
        "whenToUse": "Gdy potrzebujesz opcji wzrostu: nowe produkty, nowe rynki lub dywersyfikacja.",
        "whatYouGet": ["Mapa opcji", "Ocena ryzyk", "Draft inicjatyw"],
        "inputs": ["Aktualne produkty/segmenty", "Rynki sąsiednie", "Kompetencje", "Apetyt na ryzyko"],
        "steps": ["Ułóż opcje w macierzy", "Oceń wartość i ryzyko", "Wybierz 1–2 ścieżki", "Zdefiniuj inicjatywy"],
        "outputs": ["Wybrane ścieżki wzrostu", "Założenia i niewiadome", "3–7 koncepcji inicjatyw"],
        "commonMistakes": ["Za dużo ścieżek", "Pomijanie luk kompetencyjnych", "Brak planu eksperymentów"],
        "example": "Rozwój rynku → wejście do DACH przez partnerów i lokalizację oferty.",
        "nextSteps": ["Wygeneruj raport/prezentację", "Utwórz batch inicjatyw"]
      }
    }$$,
    'ArrowRight',
    0,
    1,
    0,
    $$["strategy","ansoff","growth"]$$,
    103
  ),
  (
    'tool-known-value-chain',
    'value-chain',
    'value-chain',
    'Value Chain Analysis',
    'analysis',
    'strategic',
    'Map activities and identify cost/value drivers to target improvements and initiatives.',
    $${
      "en": "Map activities and identify cost/value drivers to target improvements and initiatives.",
      "pl": "Mapa łańcucha wartości i identyfikacja dźwigni kosztu/wartości pod inicjatywy."
    }$$,
    $${
      "en": {
        "shortDescription": "Understand where value is created and where costs/constraints accumulate across activities.",
        "whenToUse": "Use when you need to focus optimization and differentiation efforts across the end-to-end chain.",
        "whatYouGet": ["Activity map", "Value/cost hotspots", "Draft initiatives"],
        "inputs": ["Main activities", "Support functions", "Cost drivers", "Quality/service pain points"],
        "steps": ["Map primary/support activities", "Mark hotspots", "Link drivers to outcomes", "Prioritize levers", "Propose initiatives"],
        "outputs": ["Hotspot list", "Prioritized levers", "3–7 initiative concepts"],
        "commonMistakes": ["Too detailed mapping", "No linkage to outcomes", "Ignoring support functions"],
        "example": "Hotspot in inbound logistics → initiatives: slotting redesign, supplier ASN, yard management.",
        "nextSteps": ["Generate report/deck", "Create initiatives batch"]
      },
      "pl": {
        "shortDescription": "Zrozumienie, gdzie powstaje wartość i gdzie kumulują się koszty/ograniczenia w procesach.",
        "whenToUse": "Gdy chcesz ukierunkować optymalizację i wyróżnienie w całym łańcuchu end-to-end.",
        "whatYouGet": ["Mapa aktywności", "Hotspoty koszt/wartość", "Draft inicjatyw"],
        "inputs": ["Aktywności główne i wspierające", "Dźwignie kosztu", "Bóle jakości/SLA"],
        "steps": ["Zmapuj aktywności", "Zaznacz hotspoty", "Połącz dźwignie z outcome", "Ustal priorytety", "Zaproponuj inicjatywy"],
        "outputs": ["Lista hotspotów", "Priorytety dźwigni", "3–7 koncepcji inicjatyw"],
        "commonMistakes": ["Zbyt szczegółowa mapa", "Brak powiązania z outcome", "Pomijanie funkcji wsparcia"],
        "example": "Hotspot w logistyce wejściowej → redesign slottingu, ASN dostawców, yard management.",
        "nextSteps": ["Wygeneruj raport/prezentację", "Utwórz batch inicjatyw"]
      }
    }$$,
    'Map',
    0,
    1,
    0,
    $$["strategy","value-chain","operating-model"]$$,
    104
  ),
  (
    'tool-known-portfolio-priority',
    'portfolio-priority',
    'portfolio-priority',
    'Portfolio Prioritization',
    'analysis',
    'strategic',
    'Prioritize initiatives and bets using impact/effort and constraints.',
    $${
      "en": "Prioritize initiatives and bets using impact/effort and constraints.",
      "pl": "Priorytetyzacja inicjatyw i zakładów (impact/effort) z uwzględnieniem ograniczeń."
    }$$,
    $${
      "en": {
        "shortDescription": "Make trade-offs explicit and select what to do first.",
        "whenToUse": "Use when you have many options and need a defensible order of execution.",
        "whatYouGet": ["Priority matrix", "Top picks", "Draft initiatives"],
        "inputs": ["Candidate initiatives", "Impact estimates", "Effort/cost", "Dependencies and constraints"],
        "steps": ["Normalize list", "Score impact/effort", "Map to matrix", "Select winners", "Define next actions"],
        "outputs": ["Ranked backlog", "Quick wins vs bets", "3–7 initiative concepts"],
        "commonMistakes": ["No common scoring rules", "Ignoring dependencies", "Overfitting to one metric"],
        "example": "Pick 2 quick wins + 1 strategic bet; define sequencing by dependency graph.",
        "nextSteps": ["Generate report/deck", "Create initiatives batch"]
      },
      "pl": {
        "shortDescription": "Uczyń trade-offy jawne i wybierz, co robimy najpierw.",
        "whenToUse": "Gdy masz wiele opcji i potrzebujesz obronić kolejność realizacji.",
        "whatYouGet": ["Macierz priorytetów", "Top wybory", "Draft inicjatyw"],
        "inputs": ["Kandydaci inicjatyw", "Wpływ", "Wysiłek/koszt", "Zależności i ograniczenia"],
        "steps": ["Ujednolić listę", "Oceń impact/effort", "Ułóż w macierzy", "Wybierz zwycięzców", "Zdefiniuj kolejne kroki"],
        "outputs": ["Ranking backlogu", "Quick wins vs zakłady", "3–7 koncepcji inicjatyw"],
        "commonMistakes": ["Brak wspólnych zasad scoringu", "Pomijanie zależności", "Przywiązanie do jednej metryki"],
        "example": "Wybierz 2 quick wins + 1 strategic bet i zaplanuj sekwencję wg zależności.",
        "nextSteps": ["Wygeneruj raport/prezentację", "Utwórz batch inicjatyw"]
      }
    }$$,
    'ListTodo',
    0,
    1,
    0,
    $$["strategy","prioritization","portfolio"]$$,
    105
  ),
  (
    'tool-known-risk-uncertainty',
    'risk-uncertainty',
    'risk-uncertainty',
    'Risk & Uncertainty',
    'analysis',
    'strategic',
    'Structure risks, unknowns and mitigations before committing to initiatives.',
    $${
      "en": "Structure risks, unknowns and mitigations before committing to initiatives.",
      "pl": "Strukturyzacja ryzyk, niewiadomych i mitigacji przed zatwierdzeniem inicjatyw."
    }$$,
    $${
      "en": {
        "shortDescription": "Identify what could go wrong and what is unknown, then design mitigations and follow-ups.",
        "whenToUse": "Use when decisions are high-stakes or information is incomplete/mixed.",
        "whatYouGet": ["Risk register", "Unknowns list", "Mitigation actions"],
        "inputs": ["Planned changes", "Constraints", "Past incidents", "Assumptions"],
        "steps": ["List risks", "Separate unknowns", "Estimate likelihood/impact", "Define mitigations", "Add follow-up questions"],
        "outputs": ["Prioritized risks", "Mitigation plan", "3–7 initiative concepts"],
        "commonMistakes": ["Treating unknowns as facts", "No owner for mitigation", "Overconfidence"],
        "example": "Unknown: data quality. Mitigation: data profiling sprint + acceptance criteria.",
        "nextSteps": ["Generate report/deck", "Create initiatives batch"]
      },
      "pl": {
        "shortDescription": "Zidentyfikuj co może pójść źle i co jest niewiadomą, a potem zaprojektuj mitigacje i follow-up.",
        "whenToUse": "Gdy decyzje są wysokiego ryzyka lub dane są niepełne/mieszane.",
        "whatYouGet": ["Rejestr ryzyk", "Lista niewiadomych", "Plan mitigacji"],
        "inputs": ["Planowane zmiany", "Ograniczenia", "Incydenty historyczne", "Założenia"],
        "steps": ["Wypisz ryzyka", "Oddziel niewiadome", "Oceń prawdopodobieństwo i wpływ", "Zdefiniuj mitigacje", "Dodaj pytania follow-up"],
        "outputs": ["Priorytety ryzyk", "Plan mitigacji", "3–7 koncepcji inicjatyw"],
        "commonMistakes": ["Traktowanie niewiadomych jako faktów", "Brak ownera mitigacji", "Nadmierna pewność"],
        "example": "Niewiadoma: jakość danych. Mitigacja: sprint profilowania + kryteria akceptacji.",
        "nextSteps": ["Wygeneruj raport/prezentację", "Utwórz batch inicjatyw"]
      }
    }$$,
    'AlertTriangle',
    0,
    1,
    0,
    $$["strategy","risk","uncertainty"]$$,
    106
  ),
  (
    'tool-known-capability-mapper',
    'capability-mapper',
    'capability-mapper',
    'Capability Mapper',
    'analysis',
    'strategic',
    'Map capabilities, maturity, and gaps to build a focused transformation roadmap.',
    $${
      "en": "Map capabilities, maturity, and gaps to build a focused transformation roadmap.",
      "pl": "Mapa kompetencji i luk do zbudowania ukierunkowanego roadmapu transformacji."
    }$$,
    $${
      "en": {
        "shortDescription": "Make capability gaps visible and translate them into a roadmap.",
        "whenToUse": "Use when scaling operations or digitalization requires new capabilities and ownership.",
        "whatYouGet": ["Capability map", "Gap analysis", "Draft initiatives"],
        "inputs": ["Capability list", "Current maturity", "Target maturity", "Constraints and owners"],
        "steps": ["Define capability taxonomy", "Rate maturity", "Identify gaps", "Prioritize gaps", "Propose initiatives"],
        "outputs": ["Gap heatmap", "Roadmap candidates", "3–7 initiative concepts"],
        "commonMistakes": ["No clear taxonomy", "All capabilities 'high'", "No owner for capabilities"],
        "example": "Gap: data governance → initiative: data ownership model + stewardship + tooling.",
        "nextSteps": ["Generate report/deck", "Create initiatives batch"]
      },
      "pl": {
        "shortDescription": "Uwidocznij luki kompetencyjne i przełóż je na roadmap.",
        "whenToUse": "Gdy skalowanie operacji lub cyfryzacja wymaga nowych kompetencji i ownershipu.",
        "whatYouGet": ["Mapa kompetencji", "Analiza luk", "Draft inicjatyw"],
        "inputs": ["Lista kompetencji", "Dojrzałość obecna", "Dojrzałość docelowa", "Ograniczenia i ownerzy"],
        "steps": ["Zdefiniuj taksonomię", "Oceń dojrzałość", "Wskaż luki", "Ustal priorytety", "Zaproponuj inicjatywy"],
        "outputs": ["Heatmapa luk", "Kandydaci roadmapu", "3–7 koncepcji inicjatyw"],
        "commonMistakes": ["Brak taksonomii", "Wszystko 'wysokie'", "Brak ownera kompetencji"],
        "example": "Luka: data governance → model ownershipu danych + stewardship + narzędzia.",
        "nextSteps": ["Wygeneruj raport/prezentację", "Utwórz batch inicjatyw"]
      }
    }$$,
    'Users',
    0,
    1,
    0,
    $$["strategy","capabilities","roadmap"]$$,
    107
  ),
  (
    'tool-known-a3-problem-solving',
    'a3-problem-solving',
    'a3-problem-solving',
    'A3 Problem Solving',
    'process',
    'operational',
    'A3/PDCA problem solving translated into a concrete improvement plan.',
    $${
      "en": "A3/PDCA problem solving translated into a concrete improvement plan.",
      "pl": "Rozwiązywanie problemów A3/PDCA przełożone na konkretny plan usprawnień."
    }$$,
    $${
      "en": {
        "shortDescription": "Structured root-cause problem solving with a single-page narrative.",
        "whenToUse": "Use when recurring issues need a clear owner, root cause, and countermeasures.",
        "whatYouGet": ["A3 summary", "Root causes", "Countermeasures"],
        "inputs": ["Problem statement", "Current state data", "Target condition", "Constraints"],
        "steps": ["Define problem", "Analyze current state", "Find root cause", "Design countermeasures", "Plan follow-up"],
        "outputs": ["A3 narrative", "Action plan", "Initiative concepts"],
        "commonMistakes": ["Jumping to solutions", "No measurable target", "No follow-up"],
        "example": "Defect rate 4% → root cause: training + setup variability → countermeasures: SOP + training + SMED.",
        "nextSteps": ["Generate report/deck", "Create initiatives batch"]
      },
      "pl": {
        "shortDescription": "Ustrukturyzowane rozwiązywanie problemów z narracją na jednej stronie.",
        "whenToUse": "Gdy powtarzające się problemy wymagają ownera, przyczyny i działań korygujących.",
        "whatYouGet": ["Podsumowanie A3", "Przyczyny źródłowe", "Countermeasures"],
        "inputs": ["Opis problemu", "Dane stanu obecnego", "Stan docelowy", "Ograniczenia"],
        "steps": ["Zdefiniuj problem", "Przeanalizuj stan obecny", "Znajdź root cause", "Zaprojektuj działania", "Zaplanuj follow-up"],
        "outputs": ["Narracja A3", "Plan działań", "Koncepcje inicjatyw"],
        "commonMistakes": ["Skok do rozwiązań", "Brak mierzalnego celu", "Brak follow-up"],
        "example": "Braki 4% → przyczyna: szkolenia + zmienność przezbrojeń → SOP + szkolenia + SMED.",
        "nextSteps": ["Wygeneruj raport/prezentację", "Utwórz batch inicjatyw"]
      }
    }$$,
    'FileText',
    0,
    1,
    0,
    $$["operations","a3","root-cause"]$$,
    201
  ),
  (
    'tool-known-vsm-builder',
    'vsm-builder',
    'vsm-builder',
    'VSM Builder',
    'process',
    'operational',
    'Value Stream Mapping to visualize flow, waste, and improvement priorities.',
    $${
      "en": "Value Stream Mapping to visualize flow, waste, and improvement priorities.",
      "pl": "Mapowanie strumienia wartości (VSM) do wizualizacji przepływu, marnotrawstw i priorytetów usprawnień."
    }$$,
    $${
      "en": {
        "shortDescription": "Map the current flow and design the future state with measurable improvements.",
        "whenToUse": "Use when lead time is high, WIP grows, or handoffs create delays and rework.",
        "whatYouGet": ["Current-state map", "Waste hotspots", "Future-state actions"],
        "inputs": ["Process steps", "Times (VA/NVA)", "Queues/WIP", "Demand and constraints"],
        "steps": ["Map current state", "Calculate lead time", "Mark waste", "Design future state", "Define initiatives"],
        "outputs": ["VSM summary", "Hotspots", "Initiative concepts"],
        "commonMistakes": ["No real times", "Ignoring queues", "Future state without feasibility"],
        "example": "Reduce handoffs by combining steps + WIP limits + standard work.",
        "nextSteps": ["Generate report/deck", "Create initiatives batch"]
      },
      "pl": {
        "shortDescription": "Zmapuj przepływ stanu obecnego i zaprojektuj stan przyszły z mierzalnymi usprawnieniami.",
        "whenToUse": "Gdy lead time jest wysoki, rośnie WIP lub przekazania generują opóźnienia i poprawki.",
        "whatYouGet": ["Mapa stanu obecnego", "Hotspoty marnotrawstw", "Akcje stanu przyszłego"],
        "inputs": ["Kroki procesu", "Czasy (VA/NVA)", "Kolejki/WIP", "Popyt i ograniczenia"],
        "steps": ["Zmapuj stan obecny", "Policz lead time", "Zaznacz waste", "Zaprojektuj stan przyszły", "Zdefiniuj inicjatywy"],
        "outputs": ["Podsumowanie VSM", "Hotspoty", "Koncepcje inicjatyw"],
        "commonMistakes": ["Brak realnych czasów", "Pomijanie kolejek", "Stan przyszły bez wykonalności"],
        "example": "Redukcja handoffów przez łączenie kroków + limity WIP + standard work.",
        "nextSteps": ["Wygeneruj raport/prezentację", "Utwórz batch inicjatyw"]
      }
    }$$,
    'Workflow',
    0,
    1,
    0,
    $$["operations","lean","vsm"]$$,
    202
  ),
  (
    'tool-known-sop-builder',
    'sop-builder',
    'sop-builder',
    'SOP Builder',
    'process',
    'operational',
    'Create clear standard operating procedures that improve repeatability and quality.',
    $${
      "en": "Create clear standard operating procedures that improve repeatability and quality.",
      "pl": "Tworzenie SOP (standardów pracy) zwiększających powtarzalność i jakość."
    }$$,
    $${
      "en": {
        "shortDescription": "Turn tacit knowledge into a simple, usable standard.",
        "whenToUse": "Use when performance varies by shift/person or training time is too long.",
        "whatYouGet": ["SOP draft", "Checklist", "Training-ready steps"],
        "inputs": ["Process steps", "Critical parameters", "Quality checks", "Safety/compliance notes"],
        "steps": ["Define scope", "Capture steps", "Add checks", "Add visuals/notes", "Review and publish"],
        "outputs": ["SOP structure", "Checklist", "Improvement backlog"],
        "commonMistakes": ["Too long SOP", "No critical checks", "No owner / review cadence"],
        "example": "Packing SOP: steps + photos + quality checks + escalation rules.",
        "nextSteps": ["Generate report/deck", "Create initiatives batch"]
      },
      "pl": {
        "shortDescription": "Zamień wiedzę nieformalną w prosty standard do użycia na co dzień.",
        "whenToUse": "Gdy wyniki zależą od zmiany/osoby albo onboarding trwa zbyt długo.",
        "whatYouGet": ["Draft SOP", "Checklist", "Kroki do szkolenia"],
        "inputs": ["Kroki procesu", "Parametry krytyczne", "Kontrole jakości", "Uwagi BHP/compliance"],
        "steps": ["Ustal zakres", "Zbierz kroki", "Dodaj kontrole", "Dodaj notatki/wizualizacje", "Zrób review i opublikuj"],
        "outputs": ["Struktura SOP", "Checklist", "Backlog usprawnień"],
        "commonMistakes": ["Za długi SOP", "Brak krytycznych kontroli", "Brak ownera/cyklu review"],
        "example": "SOP pakowania: kroki + zdjęcia + kontrole jakości + eskalacje.",
        "nextSteps": ["Wygeneruj raport/prezentację", "Utwórz batch inicjatyw"]
      }
    }$$,
    'CheckCircle2',
    0,
    1,
    0,
    $$["operations","sop","standard-work"]$$,
    203
  )
ON CONFLICT (name) DO UPDATE SET
  tool_type = EXCLUDED.tool_type,
  display_name = EXCLUDED.display_name,
  category = EXCLUDED.category,
  library_category = EXCLUDED.library_category,
  description = EXCLUDED.description,
  description_translations = EXCLUDED.description_translations,
  library_content_translations = EXCLUDED.library_content_translations,
  icon = EXCLUDED.icon,
  is_licensed = EXCLUDED.is_licensed,
  is_active = EXCLUDED.is_active,
  is_coming_soon = EXCLUDED.is_coming_soon,
  tags_json = EXCLUDED.tags_json,
  sort_order = EXCLUDED.sort_order;

-- ==========================================
-- KNOWLEDGE BASE: "HOW TO USE" ARTICLE PER TOOL (top 10)
-- Reuses existing KB tables + related_modules filter.
-- ==========================================

-- Guard (strict-schema repair, 2026-08): kb_categories/kb_articles/etc. are
-- created by 739_knowledge_base_public_articles.sql, a HIGHER-numbered file
-- that runs AFTER this one in numeric order. On a genuinely fresh DB those
-- tables do not exist yet at this point, so the INSERTs below are wrapped in
-- a runtime existence check (PL/pgSQL only plans/executes a statement when
-- control actually reaches it, so a false IF never touches the missing
-- tables) instead of reordering the whole file. Additive/idempotent: on an
-- environment where the tables already exist (including a DB that already
-- ran the old, unguarded version of this file successfully), behavior is
-- unchanged — same INSERT ... ON CONFLICT statements, same outcome.
DO $kb_seed_guard$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'kb_categories'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'kb_category_translations'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'kb_articles'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'kb_article_translations'
  ) THEN

-- Ensure category exists (if seed migration was skipped in a given env)
INSERT INTO kb_categories (id, slug, icon, sort_order, is_active, is_public)
VALUES ('kb-cat-tools-features', 'tools-features', 'Wrench', 5, 1, 0)
ON CONFLICT (id) DO NOTHING;

INSERT INTO kb_category_translations (id, category_id, language, name, description)
VALUES
  ('kb-cat-trans-tools-features-en', 'kb-cat-tools-features', 'en', 'Tools & Features', 'Platform deep-dives and feature guides'),
  ('kb-cat-trans-tools-features-pl', 'kb-cat-tools-features', 'pl', 'Narzędzia i funkcje', 'Przewodniki po narzędziach i funkcjach platformy')
ON CONFLICT (category_id, language) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description;

-- Articles: stable IDs + slugs
INSERT INTO kb_articles (
  id, category_id, slug, status, is_featured, is_public, view_count, reading_time_minutes,
  thumbnail_url, video_url, video_teaser_url, related_modules, target_audience, created_at
) VALUES
  ('kb-art-tools-dynamic-swot', 'kb-cat-tools-features', 'tools-dynamic-swot-how-to', 'published', 0, 0, 0, 4, NULL, NULL, NULL, '["dynamic-swot"]', '["consultant","manager"]', NOW()),
  ('kb-art-tools-market-forces', 'kb-cat-tools-features', 'tools-market-forces-how-to', 'published', 0, 0, 0, 4, NULL, NULL, NULL, '["market-forces"]', '["consultant","manager"]', NOW()),
  ('kb-art-tools-growth-paths', 'kb-cat-tools-features', 'tools-growth-paths-how-to', 'published', 0, 0, 0, 4, NULL, NULL, NULL, '["growth-paths"]', '["consultant","manager"]', NOW()),
  ('kb-art-tools-value-chain', 'kb-cat-tools-features', 'tools-value-chain-how-to', 'published', 0, 0, 0, 5, NULL, NULL, NULL, '["value-chain"]', '["consultant","manager"]', NOW()),
  ('kb-art-tools-portfolio-priority', 'kb-cat-tools-features', 'tools-portfolio-priority-how-to', 'published', 0, 0, 0, 4, NULL, NULL, NULL, '["portfolio-priority"]', '["consultant","manager"]', NOW()),
  ('kb-art-tools-risk-uncertainty', 'kb-cat-tools-features', 'tools-risk-uncertainty-how-to', 'published', 0, 0, 0, 4, NULL, NULL, NULL, '["risk-uncertainty"]', '["consultant","manager"]', NOW()),
  ('kb-art-tools-capability-mapper', 'kb-cat-tools-features', 'tools-capability-mapper-how-to', 'published', 0, 0, 0, 5, NULL, NULL, NULL, '["capability-mapper"]', '["consultant","manager"]', NOW()),
  ('kb-art-tools-a3-problem-solving', 'kb-cat-tools-features', 'tools-a3-problem-solving-how-to', 'published', 0, 0, 0, 5, NULL, NULL, NULL, '["a3-problem-solving"]', '["consultant","manager"]', NOW()),
  ('kb-art-tools-vsm-builder', 'kb-cat-tools-features', 'tools-vsm-builder-how-to', 'published', 0, 0, 0, 5, NULL, NULL, NULL, '["vsm-builder"]', '["consultant","manager"]', NOW()),
  ('kb-art-tools-sop-builder', 'kb-cat-tools-features', 'tools-sop-builder-how-to', 'published', 0, 0, 0, 4, NULL, NULL, NULL, '["sop-builder"]', '["consultant","manager"]', NOW())
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  status = EXCLUDED.status,
  category_id = EXCLUDED.category_id,
  related_modules = EXCLUDED.related_modules,
  target_audience = EXCLUDED.target_audience,
  reading_time_minutes = EXCLUDED.reading_time_minutes;

-- Translations (EN/PL) — concise, consulting-grade "How to use" structure
INSERT INTO kb_article_translations (id, article_id, language, title, summary, content, video_script)
VALUES
  (
    'kb-art-trans-tools-dynamic-swot-en',
    'kb-art-tools-dynamic-swot',
    'en',
    'How to use: Dynamic SWOT',
    'A practical guide to running a Dynamic SWOT and turning it into initiatives.',
    $$# Dynamic SWOT — How to use

## Purpose / when to use
Use Dynamic SWOT to build a shared view of the current situation and translate it into concrete next steps.

## Inputs
- Context and scope
- Goals (what “good” looks like)
- Signals (data points, interview insights)

## Steps
1) Capture signals (facts first)  
2) Group into SWOT buckets  
3) Normalize (merge duplicates, remove vague items)  
4) Derive implications (“so what?”)  
5) Draft initiatives (3–7) with owners and assumptions

## How to interpret results
Look for patterns: repeated constraints, capability gaps, and external shifts. Separate **unknowns** from statements.

## Common mistakes
- Mixing symptoms with root causes
- Writing long lists with no prioritization
- Not turning implications into actions

## Example
Threat: rising energy cost → initiative: energy monitoring + quick wins (leaks, peak shaving).

## Next steps in Consultify
Generate a short report/deck, then create an initiatives batch from the session.$$,
    NULL
  ),
  (
    'kb-art-trans-tools-dynamic-swot-pl',
    'kb-art-tools-dynamic-swot',
    'pl',
    'Jak używać: Dynamic SWOT',
    'Praktyczny przewodnik SWOT i przełożenie na inicjatywy.',
    $$# Dynamic SWOT — Jak używać

## Purpose / kiedy używać
Dynamic SWOT pomaga zbudować wspólny obraz sytuacji i przełożyć go na konkretne działania.

## Inputs
- Kontekst i zakres
- Cele (jak wygląda „sukces”)
- Sygnały (dane, wnioski z wywiadów)

## Steps
1) Zbierz sygnały (najpierw fakty)  
2) Ułóż w SWOT  
3) Uprość i ujednolić listę  
4) Wyciągnij implikacje („so what?”)  
5) Zrób draft 3–7 inicjatyw z założeniami

## How to interpret results
Szukaj wzorców: powtarzalnych ograniczeń, luk kompetencyjnych i zmian zewnętrznych. Oddziel **niewiadome** od tez.

## Common mistakes
- Mieszanie objawów z przyczynami
- Długie listy bez priorytetów
- Brak przełożenia implikacji na działania

## Example
Zagrożenie: wzrost kosztu energii → inicjatywa: monitoring energii + quick wins (wycieki, peak shaving).

## Next steps w Consultify
Wygeneruj krótki raport/prezentację, a potem utwórz batch inicjatyw z sesji.$$,
    NULL
  )
  ,
  (
    'kb-art-trans-tools-market-forces-en',
    'kb-art-tools-market-forces',
    'en',
    'How to use: Market Forces (Porter)',
    'Run a 5-forces analysis that produces defensible strategic levers and initiatives.',
    $$# Market Forces (Porter) — How to use

## Purpose / when to use
Use 5 Forces to understand margin pressure and where competitive power shifts.

## Inputs
- Market definition and segments
- Competitors, customers, suppliers
- Substitute/entrant signals

## Steps
1) Score each force (1–5) with evidence  
2) Identify top 1–2 pressure points  
3) Define strategic levers (defensibility, differentiation, cost)  
4) Draft 3–7 initiatives with assumptions and risks

## How to interpret results
Focus on the forces that materially change profitability and bargaining power.

## Common mistakes
- Vague evidence (“strong competition”)
- Ignoring substitutes
- No levers → no actions

## Next steps in Consultify
Generate a report/deck, then create an initiatives batch.$$,
    NULL
  ),
  (
    'kb-art-trans-tools-market-forces-pl',
    'kb-art-tools-market-forces',
    'pl',
    'Jak używać: Market Forces (Porter)',
    'Analiza 5 sił Portera z wnioskami, dźwigniami i inicjatywami.',
    $$# Market Forces (Porter) — Jak używać

## Purpose / kiedy używać
5 sił pomaga zrozumieć presję na marżę i to, gdzie zmienia się siła przetargowa.

## Inputs
- Definicja rynku i segmenty
- Konkurenci, klienci, dostawcy
- Sygnały substytutów i wejść

## Steps
1) Oceń każdą siłę (1–5) z evidence  
2) Wybierz 1–2 główne punkty presji  
3) Zdefiniuj dźwignie (defensywność, wyróżnienie, koszt)  
4) Zrób draft 3–7 inicjatyw z ryzykami i założeniami

## How to interpret results
Skup się na siłach, które realnie zmieniają rentowność i siłę przetargową.

## Common mistakes
- Ogólne uzasadnienia
- Pomijanie substytutów
- Brak przełożenia na działania

## Next steps w Consultify
Wygeneruj raport/prezentację, a potem utwórz batch inicjatyw.$$,
    NULL
  ),
  (
    'kb-art-trans-tools-growth-paths-en',
    'kb-art-tools-growth-paths',
    'en',
    'How to use: Growth Paths (Ansoff)',
    'Use Ansoff to choose 1–2 growth bets and define enabling initiatives.',
    $$# Growth Paths (Ansoff) — How to use

## Purpose / when to use
Use Ansoff when you need structured growth options (products/markets) and risk framing.

## Inputs
- Current offerings and segments
- Adjacent markets / customer needs
- Capability constraints and appetite for risk

## Steps
1) List options in the 2×2 matrix  
2) Rate value and risk  
3) Select 1–2 paths  
4) Define experiments + enabling initiatives

## Common mistakes
- Selecting too many paths
- No capability gap plan

## Next steps in Consultify
Report/deck → initiatives batch.$$,
    NULL
  ),
  (
    'kb-art-trans-tools-growth-paths-pl',
    'kb-art-tools-growth-paths',
    'pl',
    'Jak używać: Growth Paths (Ansoff)',
    'Macierz Ansoffa do wyboru 1–2 zakładów wzrostu i inicjatyw wspierających.',
    $$# Growth Paths (Ansoff) — Jak używać

## Purpose / kiedy używać
Gdy potrzebujesz opcji wzrostu i ramy ryzyk (produkt/rynek).

## Inputs
- Aktualna oferta i segmenty
- Rynki sąsiednie / potrzeby klientów
- Ograniczenia kompetencyjne i apetyt na ryzyko

## Steps
1) Wypisz opcje w macierzy 2×2  
2) Oceń wartość i ryzyko  
3) Wybierz 1–2 ścieżki  
4) Zdefiniuj eksperymenty + inicjatywy umożliwiające

## Common mistakes
- Za dużo ścieżek na raz
- Brak planu domknięcia luk kompetencyjnych

## Next steps w Consultify
Raport/prezentacja → batch inicjatyw.$$,
    NULL
  ),
  (
    'kb-art-trans-tools-value-chain-en',
    'kb-art-tools-value-chain',
    'en',
    'How to use: Value Chain Analysis',
    'Map activities, spot value/cost hotspots, and define initiatives with measurable levers.',
    $$# Value Chain Analysis — How to use

## Purpose / when to use
Use when you need to focus optimization and differentiation across the end-to-end chain.

## Inputs
- Primary + support activities
- Cost and service drivers
- Pain points (quality, lead time, SLA)

## Steps
1) Map activities  
2) Mark hotspots (cost, delays, defects)  
3) Link drivers to outcomes  
4) Prioritize levers  
5) Draft initiatives

## Common mistakes
- Overly detailed mapping
- No link to outcomes

## Next steps in Consultify
Report/deck → initiatives batch.$$,
    NULL
  ),
  (
    'kb-art-trans-tools-value-chain-pl',
    'kb-art-tools-value-chain',
    'pl',
    'Jak używać: Value Chain Analysis',
    'Mapa łańcucha wartości i hotspotów pod usprawnienia i inicjatywy.',
    $$# Value Chain Analysis — Jak używać

## Purpose / kiedy używać
Gdy chcesz ukierunkować optymalizację i wyróżnienie w całym łańcuchu end-to-end.

## Inputs
- Aktywności główne i wspierające
- Dźwignie kosztu i poziomu obsługi
- Bóle (jakość, lead time, SLA)

## Steps
1) Zmapuj aktywności  
2) Zaznacz hotspoty (koszt, opóźnienia, błędy)  
3) Połącz dźwignie z outcome  
4) Ustal priorytety  
5) Zrób draft inicjatyw

## Common mistakes
- Zbyt szczegółowa mapa
- Brak powiązania z outcome

## Next steps w Consultify
Raport/prezentacja → batch inicjatyw.$$,
    NULL
  ),
  (
    'kb-art-trans-tools-portfolio-priority-en',
    'kb-art-tools-portfolio-priority',
    'en',
    'How to use: Portfolio Prioritization',
    'Create a defensible order of execution using impact/effort and constraints.',
    $$# Portfolio Prioritization — How to use

## Purpose / when to use
Use when you have many options and must make trade-offs explicit.

## Inputs
- Candidate initiatives
- Impact/effort estimates
- Dependencies and constraints

## Steps
1) Normalize the list  
2) Define scoring rules  
3) Score + map to matrix  
4) Select winners and sequencing  
5) Draft initiatives/batches

## Common mistakes
- No common scoring rules
- Ignoring dependencies

## Next steps in Consultify
Report/deck → initiatives batch.$$,
    NULL
  ),
  (
    'kb-art-trans-tools-portfolio-priority-pl',
    'kb-art-tools-portfolio-priority',
    'pl',
    'Jak używać: Portfolio Prioritization',
    'Priorytetyzacja inicjatyw (impact/effort) z uwzględnieniem zależności.',
    $$# Portfolio Prioritization — Jak używać

## Purpose / kiedy używać
Gdy masz wiele opcji i musisz jasno pokazać trade-offy.

## Inputs
- Kandydaci inicjatyw
- Szacunki impact/effort
- Zależności i ograniczenia

## Steps
1) Ujednolić listę  
2) Ustalić zasady scoringu  
3) Oceniać + ułożyć w macierzy  
4) Wybrać zwycięzców i sekwencję  
5) Zrobić batch inicjatyw

## Common mistakes
- Brak wspólnych zasad scoringu
- Pomijanie zależności

## Next steps w Consultify
Raport/prezentacja → batch inicjatyw.$$,
    NULL
  ),
  (
    'kb-art-trans-tools-risk-uncertainty-en',
    'kb-art-tools-risk-uncertainty',
    'en',
    'How to use: Risk & Uncertainty',
    'Separate risks from unknowns and design mitigations before committing to a roadmap.',
    $$# Risk & Uncertainty — How to use

## Purpose / when to use
Use for high-stakes decisions or when information is incomplete/mixed.

## Inputs
- Planned changes and assumptions
- Constraints and past incidents

## Steps
1) List risks  
2) Separate unknowns (missing info)  
3) Rate likelihood/impact  
4) Define mitigations + owners  
5) Add 1–3 follow-up questions

## Common mistakes
- Treating unknowns as facts
- No owner for mitigations

## Next steps in Consultify
Report/deck → initiatives batch.$$,
    NULL
  ),
  (
    'kb-art-trans-tools-risk-uncertainty-pl',
    'kb-art-tools-risk-uncertainty',
    'pl',
    'Jak używać: Risk & Uncertainty',
    'Oddziel ryzyka od niewiadomych i zaprojektuj mitigacje przed roadmapem.',
    $$# Risk & Uncertainty — Jak używać

## Purpose / kiedy używać
Przy decyzjach wysokiego ryzyka albo gdy dane są niepełne/mieszane.

## Inputs
- Planowane zmiany i założenia
- Ograniczenia i incydenty historyczne

## Steps
1) Wypisz ryzyka  
2) Oddziel niewiadome (brak informacji)  
3) Oceń prawdopodobieństwo i wpływ  
4) Zdefiniuj mitigacje + ownerów  
5) Dodaj 1–3 pytania follow-up

## Common mistakes
- Traktowanie niewiadomych jak faktów
- Brak ownera mitigacji

## Next steps w Consultify
Raport/prezentacja → batch inicjatyw.$$,
    NULL
  ),
  (
    'kb-art-trans-tools-capability-mapper-en',
    'kb-art-tools-capability-mapper',
    'en',
    'How to use: Capability Mapper',
    'Build a capability map, rate maturity, identify gaps, and translate them into initiatives.',
    $$# Capability Mapper — How to use

## Purpose / when to use
Use when scaling or digitalization requires new capabilities and clear ownership.

## Inputs
- Capability taxonomy
- Current vs target maturity
- Constraints and owners

## Steps
1) Define taxonomy  
2) Rate maturity  
3) Identify gaps + evidence  
4) Prioritize gaps  
5) Draft initiatives that close gaps

## Common mistakes
- No clear taxonomy
- Everyone rates everything “high”

## Next steps in Consultify
Report/deck → initiatives batch.$$,
    NULL
  ),
  (
    'kb-art-trans-tools-capability-mapper-pl',
    'kb-art-tools-capability-mapper',
    'pl',
    'Jak używać: Capability Mapper',
    'Mapa kompetencji, dojrzałości i luk przełożona na inicjatywy.',
    $$# Capability Mapper — Jak używać

## Purpose / kiedy używać
Gdy skalowanie lub cyfryzacja wymaga nowych kompetencji i jasnego ownershipu.

## Inputs
- Taksonomia kompetencji
- Dojrzałość obecna vs docelowa
- Ograniczenia i ownerzy

## Steps
1) Zdefiniuj taksonomię  
2) Oceń dojrzałość  
3) Wskaż luki + evidence  
4) Ustal priorytety luk  
5) Zrób draft inicjatyw domykających luki

## Common mistakes
- Brak taksonomii
- Zawyżone oceny („wszędzie wysokie”)

## Next steps w Consultify
Raport/prezentacja → batch inicjatyw.$$,
    NULL
  ),
  (
    'kb-art-trans-tools-a3-problem-solving-en',
    'kb-art-tools-a3-problem-solving',
    'en',
    'How to use: A3 Problem Solving',
    'Run an A3 narrative from problem to root cause to countermeasures.',
    $$# A3 Problem Solving — How to use

## Purpose / when to use
Use for recurring issues that need a clear owner, target condition, and follow-up.

## Inputs
- Problem statement + data
- Target condition
- Constraints

## Steps
1) Define problem  
2) Describe current state  
3) Find root cause  
4) Design countermeasures  
5) Plan follow-up and standards

## Common mistakes
- Jumping to solutions
- No measurable target

## Next steps in Consultify
Report/deck → initiatives batch.$$,
    NULL
  ),
  (
    'kb-art-trans-tools-a3-problem-solving-pl',
    'kb-art-tools-a3-problem-solving',
    'pl',
    'Jak używać: A3 Problem Solving',
    'Narracja A3 od problemu przez root cause po countermeasures.',
    $$# A3 Problem Solving — Jak używać

## Purpose / kiedy używać
Przy problemach powtarzalnych, gdzie potrzebujesz ownera, celu i follow-up.

## Inputs
- Problem + dane
- Stan docelowy
- Ograniczenia

## Steps
1) Zdefiniuj problem  
2) Opisz stan obecny  
3) Znajdź root cause  
4) Zaprojektuj countermeasures  
5) Zaplanuj follow-up i standardy

## Common mistakes
- Skok do rozwiązań
- Brak mierzalnego celu

## Next steps w Consultify
Raport/prezentacja → batch inicjatyw.$$,
    NULL
  ),
  (
    'kb-art-trans-tools-vsm-builder-en',
    'kb-art-tools-vsm-builder',
    'en',
    'How to use: VSM Builder',
    'Map current state, quantify lead time, design future state, and derive initiatives.',
    $$# VSM Builder — How to use

## Purpose / when to use
Use when lead time is high, WIP grows, or handoffs create rework.

## Inputs
- Steps and handoffs
- VA/NVA times
- Queues/WIP and constraints

## Steps
1) Map current state  
2) Quantify lead time and waste  
3) Design future state  
4) Define initiatives and sequencing

## Common mistakes
- Guessing times
- Ignoring queues/WIP

## Next steps in Consultify
Report/deck → initiatives batch.$$,
    NULL
  ),
  (
    'kb-art-trans-tools-vsm-builder-pl',
    'kb-art-tools-vsm-builder',
    'pl',
    'Jak używać: VSM Builder',
    'VSM: mapa stanu obecnego, lead time, stan przyszły i inicjatywy.',
    $$# VSM Builder — Jak używać

## Purpose / kiedy używać
Gdy lead time jest wysoki, rośnie WIP lub przekazania generują poprawki.

## Inputs
- Kroki i handoffy
- Czasy VA/NVA
- Kolejki/WIP i ograniczenia

## Steps
1) Zmapuj stan obecny  
2) Policz lead time i waste  
3) Zaprojektuj stan przyszły  
4) Zdefiniuj inicjatywy i sekwencję

## Common mistakes
- Zgadywanie czasów
- Pomijanie kolejek/WIP

## Next steps w Consultify
Raport/prezentacja → batch inicjatyw.$$,
    NULL
  ),
  (
    'kb-art-trans-tools-sop-builder-en',
    'kb-art-tools-sop-builder',
    'en',
    'How to use: SOP Builder',
    'Create a usable SOP with critical checks, escalation rules, and a review cadence.',
    $$# SOP Builder — How to use

## Purpose / when to use
Use when performance varies by shift/person or training takes too long.

## Inputs
- Process steps
- Critical parameters and checks
- Safety/compliance notes

## Steps
1) Define scope  
2) Capture steps (simple language)  
3) Add critical checks + escalation  
4) Add training notes/visuals  
5) Review and publish

## Common mistakes
- SOP too long to use
- Missing critical checks

## Next steps in Consultify
Report/deck → initiatives batch.$$,
    NULL
  ),
  (
    'kb-art-trans-tools-sop-builder-pl',
    'kb-art-tools-sop-builder',
    'pl',
    'Jak używać: SOP Builder',
    'SOP: kroki, kontrole krytyczne, eskalacje i cykl review.',
    $$# SOP Builder — Jak używać

## Purpose / kiedy używać
Gdy wyniki zależą od zmiany/osoby albo onboarding trwa zbyt długo.

## Inputs
- Kroki procesu
- Parametry krytyczne i kontrole
- Uwagi BHP/compliance

## Steps
1) Ustal zakres  
2) Zbierz kroki (prosty język)  
3) Dodaj kontrole krytyczne + eskalacje  
4) Dodaj notatki/wizualizacje do szkolenia  
5) Zrób review i opublikuj

## Common mistakes
- SOP za długi do użycia
- Brak kontroli krytycznych

## Next steps w Consultify
Raport/prezentacja → batch inicjatyw.$$,
    NULL
  )
ON CONFLICT (article_id, language) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  content = EXCLUDED.content,
  video_script = EXCLUDED.video_script;

  END IF;
END
$kb_seed_guard$;
