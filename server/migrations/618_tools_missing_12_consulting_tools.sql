-- Bundle 05+ (v3) — Tools: Seed 12 missing Known Tools entries + KB "How to use"
-- Adds the 12 consulting toolTypes that are in V3 SSOT but missing from registry:
-- Strategy: ambition-decomposer, focus-tradeoff, narrative-engine
-- Operations: smed-planner, dms-builder, inventory-autopilot
-- Digital: integration-diagnostic, digital-value-pool, legacy-analyzer, data-inventory, pain-to-solution, pain-explorer

-- ==========================================
-- Ensure required columns exist (idempotent)
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
-- SEED: 12 MISSING KNOWN TOOLS (Library entries)
-- Source of truth: canonical toolType in `docs/product/CONSULTING_TOOLS_TOOL_SPECS_V3.md`
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
  -- ========== STRATEGY (3) ==========
  (
    'tool-known-ambition-decomposer',
    'ambition-decomposer',
    'ambition-decomposer',
    'Ambition Decomposer',
    'analysis',
    'strategic',
    'Translate vision into measurable dimensions, targets, and initiative clusters.',
    $${
      "en": "Translate vision into measurable dimensions, targets, and initiative clusters.",
      "pl": "Przełóż wizję na mierzalne wymiary, cele i klastry inicjatyw."
    }$$,
    $${
      "en": {
        "shortDescription": "Turn a vision into measurable dimensions, targets, and initiative themes.",
        "whenToUse": "Use when you have a vision but need a structured path to measurable outcomes and initiatives.",
        "whatYouGet": ["Ambition tree", "Targets & metrics", "Initiative themes"],
        "inputs": ["Vision statement", "Strategic targets", "Constraints", "Stakeholder expectations"],
        "steps": ["Define ambition", "Decompose into dimensions", "Assign metrics and targets", "Identify gaps", "Draft initiative themes"],
        "outputs": ["Ambition map", "Metric targets", "3–7 initiative themes"],
        "commonMistakes": ["Vague ambition", "No measurable targets", "Too many dimensions"],
        "example": "Ambition: +30% delivery reliability → dimensions: OTIF, lead time, quality → initiatives: control tower, WIP limits, quality gates.",
        "nextSteps": ["Generate report/deck", "Create initiatives batch"]
      },
      "pl": {
        "shortDescription": "Zamień wizję w wymiary, cele i tematy inicjatyw.",
        "whenToUse": "Gdy masz wizję, ale potrzebujesz ścieżki do mierzalnych efektów i inicjatyw.",
        "whatYouGet": ["Drzewo ambicji", "Cele i metryki", "Tematy inicjatyw"],
        "inputs": ["Opis wizji", "Cele strategiczne", "Ograniczenia", "Oczekiwania stakeholderów"],
        "steps": ["Zdefiniuj ambicję", "Rozbij na wymiary", "Przypisz metryki i cele", "Wskaż luki", "Zrób draft tematów inicjatyw"],
        "outputs": ["Mapa ambicji", "Cele metryk", "3–7 tematów inicjatyw"],
        "commonMistakes": ["Ogólna ambicja", "Brak mierzalnych celów", "Za dużo wymiarów"],
        "example": "Ambicja: +30% niezawodności dostaw → OTIF/lead time/jakość → control tower, limity WIP, bramki jakości.",
        "nextSteps": ["Wygeneruj raport/prezentację", "Utwórz batch inicjatyw"]
      }
    }$$,
    'Target',
    0,
    1,
    0,
    $$["strategy","targets","roadmap"]$$,
    108
  ),
  (
    'tool-known-focus-tradeoff',
    'focus-tradeoff',
    'focus-tradeoff',
    'Focus & Trade-offs',
    'analysis',
    'strategic',
    'Make trade-offs explicit and decide what NOT to do.',
    $${
      "en": "Make trade-offs explicit and decide what NOT to do.",
      "pl": "Uczyń trade-offy jawne i zdecyduj czego NIE robić."
    }$$,
    $${
      "en": {
        "shortDescription": "Expose conflicts, constraints, and stop-doing decisions.",
        "whenToUse": "Use when priorities conflict, scope creeps, or stakeholders pull in different directions.",
        "whatYouGet": ["Trade-off map", "Stop-doing list", "Decision rationale"],
        "inputs": ["Competing priorities", "Constraints", "Stakeholder positions", "Risks/assumptions"],
        "steps": ["List conflicts", "Define decision criteria", "Explore alternatives", "Document trade-offs", "Draft stop/exit initiatives"],
        "outputs": ["Trade-off summary", "Stop-doing decisions", "3–7 initiative concepts"],
        "commonMistakes": ["Avoiding a decision", "Hidden constraints", "No rationale"],
        "example": "Trade-off: speed vs compliance → decision: phase rollout + controls; stop: custom exceptions.",
        "nextSteps": ["Generate report/deck", "Create initiatives batch"]
      },
      "pl": {
        "shortDescription": "Ujawnij konflikty, ograniczenia i decyzje stop-doing.",
        "whenToUse": "Gdy priorytety się gryzą, rośnie scope, a stakeholderzy ciągną w różne strony.",
        "whatYouGet": ["Mapa trade-offów", "Lista stop-doing", "Uzasadnienie decyzji"],
        "inputs": ["Kolidujące priorytety", "Ograniczenia", "Stanowiska stakeholderów", "Ryzyka/założenia"],
        "steps": ["Wypisz konflikty", "Ustal kryteria", "Przeanalizuj alternatywy", "Udokumentuj trade-offy", "Zrób draft inicjatyw stop/exit"],
        "outputs": ["Podsumowanie trade-offów", "Decyzje stop-doing", "3–7 koncepcji inicjatyw"],
        "commonMistakes": ["Unikanie decyzji", "Ukryte ograniczenia", "Brak uzasadnienia"],
        "example": "Trade-off: szybkość vs compliance → rollout fazami + kontrole; stop: wyjątki custom.",
        "nextSteps": ["Wygeneruj raport/prezentację", "Utwórz batch inicjatyw"]
      }
    }$$,
    'GitBranch',
    0,
    1,
    0,
    $$["strategy","tradeoffs","focus"]$$,
    109
  ),
  (
    'tool-known-narrative-engine',
    'narrative-engine',
    'narrative-engine',
    'Narrative & Alignment',
    'analysis',
    'strategic',
    'Create a coherent strategy narrative and test alignment.',
    $${
      "en": "Create a coherent strategy narrative and test alignment.",
      "pl": "Zbuduj spójną narrację strategii i sprawdź alignment."
    }$$,
    $${
      "en": {
        "shortDescription": "Build an executive-ready storyline and alignment checks.",
        "whenToUse": "Use when you must communicate strategy clearly across stakeholders and avoid inconsistent messaging.",
        "whatYouGet": ["Storyline outline", "Alignment checklist", "Messaging gaps"],
        "inputs": ["Key strategic choices", "Target audiences", "Stakeholder messages", "Evidence/assumptions"],
        "steps": ["Define audience", "Draft answer-first storyline", "Add supporting points", "Run alignment checks", "Draft communication initiatives"],
        "outputs": ["Narrative draft", "Alignment risks", "3–7 initiative concepts"],
        "commonMistakes": ["No answer-first", "Too much detail", "No evidence tags"],
        "example": "Narrative: 'We win by reliability' → proof points + initiatives: control tower, standard work, vendor scorecards.",
        "nextSteps": ["Generate report/deck", "Create initiatives batch"]
      },
      "pl": {
        "shortDescription": "Stwórz narrację executive-ready i checklistę alignmentu.",
        "whenToUse": "Gdy musisz jasno komunikować strategię i uniknąć sprzecznych przekazów.",
        "whatYouGet": ["Szkic narracji", "Checklist alignmentu", "Luki w komunikacji"],
        "inputs": ["Wybory strategiczne", "Odbiorcy", "Przekazy stakeholderów", "Evidence/założenia"],
        "steps": ["Zdefiniuj odbiorców", "Zrób narrację answer-first", "Dodaj punkty wspierające", "Sprawdź alignment", "Zrób draft inicjatyw komunikacyjnych"],
        "outputs": ["Draft narracji", "Ryzyka alignmentu", "3–7 koncepcji inicjatyw"],
        "commonMistakes": ["Brak answer-first", "Za dużo detali", "Brak tagowania evidence"],
        "example": "Narracja: 'Wygrywamy niezawodnością' → proof points + inicjatywy: control tower, standard work, scorecards.",
        "nextSteps": ["Wygeneruj raport/prezentację", "Utwórz batch inicjatyw"]
      }
    }$$,
    'FileText',
    0,
    1,
    0,
    $$["strategy","narrative","alignment"]$$,
    110
  ),
  -- ========== OPERATIONS (3) ==========
  (
    'tool-known-smed-planner',
    'smed-planner',
    'smed-planner',
    'SMED Planner',
    'process',
    'operational',
    'Reduce changeover time by classifying steps and converting internal to external.',
    $${
      "en": "Reduce changeover time by classifying steps and converting internal to external.",
      "pl": "Redukuj czas przezbrojenia przez klasyfikację kroków i konwersję internal→external."
    }$$,
    $${
      "en": {
        "shortDescription": "A structured changeover reduction plan with measurable ROI levers.",
        "whenToUse": "Use when changeovers drive downtime, batching, and delivery instability.",
        "whatYouGet": ["Step list (internal/external)", "Conversion plan", "Improvement backlog"],
        "inputs": ["Changeover steps", "Time per step", "Constraints/safety notes", "Volume/impact assumptions"],
        "steps": ["Capture steps", "Classify internal/external", "Convert where possible", "Standardize tools/layout", "Estimate impact and draft initiatives"],
        "outputs": ["SMED plan", "Target time", "3–7 initiative concepts"],
        "commonMistakes": ["No baseline timing", "Ignoring safety/quality", "No sustain plan"],
        "example": "Convert tool prep to external + quick clamps → reduce changeover 45→25 min.",
        "nextSteps": ["Generate report/deck", "Create initiatives batch"]
      },
      "pl": {
        "shortDescription": "Plan redukcji przezbrojeń z mierzalnym wpływem.",
        "whenToUse": "Gdy przezbrojenia generują przestoje, batchowanie i niestabilne terminy.",
        "whatYouGet": ["Lista kroków (internal/external)", "Plan konwersji", "Backlog usprawnień"],
        "inputs": ["Kroki przezbrojenia", "Czas per krok", "Ograniczenia/BHP", "Założenia wolumenu i wpływu"],
        "steps": ["Zbierz kroki", "Klasyfikuj internal/external", "Konwertuj gdzie się da", "Ustandaryzuj narzędzia/layout", "Oszacuj wpływ i zrób inicjatywy"],
        "outputs": ["Plan SMED", "Czas docelowy", "3–7 koncepcji inicjatyw"],
        "commonMistakes": ["Brak baseline czasów", "Ignorowanie BHP/jakości", "Brak sustain"],
        "example": "Konwersja przygotowania narzędzi + szybkozłącza → 45→25 min.",
        "nextSteps": ["Wygeneruj raport/prezentację", "Utwórz batch inicjatyw"]
      }
    }$$,
    'Clock',
    0,
    1,
    0,
    $$["operations","smed","setup"]$$,
    208
  ),
  (
    'tool-known-dms-builder',
    'dms-builder',
    'dms-builder',
    'Daily Management System',
    'process',
    'operational',
    'Define daily/weekly cadence, KPIs, and escalation to drive predictable execution.',
    $${
      "en": "Define daily/weekly cadence, KPIs, and escalation to drive predictable execution.",
      "pl": "Zdefiniuj rytm daily/weekly, KPI i eskalację dla przewidywalnej realizacji."
    }$$,
    $${
      "en": {
        "shortDescription": "A tiered meeting and KPI system that turns issues into initiatives.",
        "whenToUse": "Use when firefighting dominates and there is no clear cadence, ownership, or escalation.",
        "whatYouGet": ["Tier cadence", "KPI board", "Escalation rules"],
        "inputs": ["Org structure", "KPIs (leading/lagging)", "Meeting cadence constraints", "Issue examples"],
        "steps": ["Define tiers", "Select KPIs", "Define thresholds", "Set escalation rules", "Draft rollout initiatives"],
        "outputs": ["DMS blueprint", "Cadence & ownership", "3–7 initiative concepts"],
        "commonMistakes": ["Too many KPIs", "No escalation logic", "Meetings without decisions"],
        "example": "Tier 1 daily + Tier 2 weekly; OTIF threshold breach escalates within 24h.",
        "nextSteps": ["Generate report/deck", "Create initiatives batch"]
      },
      "pl": {
        "shortDescription": "System tier spotkań i KPI, który zamienia problemy w inicjatywy.",
        "whenToUse": "Gdy dominuje gaszenie pożarów i brakuje rytmu, ownershipu i eskalacji.",
        "whatYouGet": ["Cadence tierów", "Tablica KPI", "Reguły eskalacji"],
        "inputs": ["Struktura org", "KPI (leading/lagging)", "Ograniczenia spotkań", "Przykłady problemów"],
        "steps": ["Zdefiniuj tiery", "Wybierz KPI", "Ustal progi", "Ustal eskalację", "Zrób inicjatywy rollout"],
        "outputs": ["Blueprint DMS", "Cadence i ownership", "3–7 koncepcji inicjatyw"],
        "commonMistakes": ["Za dużo KPI", "Brak logiki eskalacji", "Spotkania bez decyzji"],
        "example": "Tier 1 daily + Tier 2 weekly; breach progu OTIF eskaluje w 24h.",
        "nextSteps": ["Wygeneruj raport/prezentację", "Utwórz batch inicjatyw"]
      }
    }$$,
    'Radar',
    0,
    1,
    0,
    $$["operations","cadence","kpi"]$$,
    209
  ),
  (
    'tool-known-inventory-autopilot',
    'inventory-autopilot',
    'inventory-autopilot',
    'Inventory Autopilot',
    'analysis',
    'operational',
    'Define replenishment policies and simulate cash/stockout trade-offs.',
    $${
      "en": "Define replenishment policies and simulate cash/stockout trade-offs.",
      "pl": "Zdefiniuj polityki uzupełnień i zasymuluj trade-off cash/stockout."
    }$$,
    $${
      "en": {
        "shortDescription": "A policy-first inventory playbook based on segmentation and service levels.",
        "whenToUse": "Use when inventory is too high or stockouts are frequent and policies are inconsistent.",
        "whatYouGet": ["SKU segmentation", "Policy table", "Simulation assumptions"],
        "inputs": ["SKU groups", "Demand variability", "Lead times", "Service level targets", "Cost assumptions"],
        "steps": ["Segment SKUs", "Set service targets", "Define reorder policies", "Simulate scenarios", "Draft improvement initiatives"],
        "outputs": ["Policy set", "Scenario notes", "3–7 initiative concepts"],
        "commonMistakes": ["No segmentation", "Ignoring lead time variability", "No governance cadence"],
        "example": "A/X items: high service, frequent review; C/Z: make-to-order or low service target.",
        "nextSteps": ["Generate report/deck", "Create initiatives batch"]
      },
      "pl": {
        "shortDescription": "Polityki zapasów oparte o segmentację i poziomy serwisu.",
        "whenToUse": "Gdy zapasy są za duże albo są częste braki, a polityki są niespójne.",
        "whatYouGet": ["Segmentacja SKU", "Tabela polityk", "Założenia symulacji"],
        "inputs": ["Grupy SKU", "Zmienność popytu", "Lead time", "Cele serwisu", "Założenia kosztów"],
        "steps": ["Segmentuj SKU", "Ustal cele serwisu", "Zdefiniuj polityki", "Zasymuluj scenariusze", "Zrób inicjatywy usprawnień"],
        "outputs": ["Zestaw polityk", "Notatki scenariuszy", "3–7 koncepcji inicjatyw"],
        "commonMistakes": ["Brak segmentacji", "Ignorowanie zmienności lead time", "Brak rytmu governance"],
        "example": "A/X: wysoki serwis i częsty przegląd; C/Z: MTO albo niski cel serwisu.",
        "nextSteps": ["Wygeneruj raport/prezentację", "Utwórz batch inicjatyw"]
      }
    }$$,
    'Boxes',
    0,
    1,
    0,
    $$["operations","inventory","policy"]$$,
    210
  ),
  -- ========== DIGITAL (6) ==========
  (
    'tool-known-integration-diagnostic',
    'integration-diagnostic',
    'integration-diagnostic',
    'Integration Diagnostic',
    'analysis',
    'digital',
    'Map integration debt and build an architecture remediation roadmap.',
    $${
      "en": "Map integration debt and build an architecture remediation roadmap.",
      "pl": "Zmapuj dług integracyjny i zbuduj roadmapę naprawy architektury."
    }$$,
    $${
      "en": {
        "shortDescription": "Diagnose integration debt and create a prioritized architecture roadmap.",
        "whenToUse": "Use when point-to-point integrations multiply, data is inconsistent, and changes take too long.",
        "whatYouGet": ["Integration debt map", "Architecture roadmap", "Priority actions"],
        "inputs": ["System landscape", "Integration inventory", "Pain points", "Change backlog"],
        "steps": ["Inventory integrations", "Score debt per connection", "Identify patterns", "Draft target architecture", "Prioritize remediation initiatives"],
        "outputs": ["Debt heatmap", "Target architecture sketch", "3–7 initiative concepts"],
        "commonMistakes": ["Incomplete inventory", "No business impact scoring", "Boil-the-ocean roadmap"],
        "example": "42 point-to-point links → consolidate to event bus for top-5 pain flows; phase over 3 quarters.",
        "nextSteps": ["Generate report/deck", "Create initiatives batch"]
      },
      "pl": {
        "shortDescription": "Zdiagnozuj dług integracyjny i stwórz priorytetyzowaną roadmapę architektury.",
        "whenToUse": "Gdy mnożą się integracje point-to-point, dane są niespójne, a zmiany trwają za długo.",
        "whatYouGet": ["Mapa długu integracyjnego", "Roadmapa architektury", "Priorytetowe akcje"],
        "inputs": ["Krajobraz systemów", "Inwentarz integracji", "Pain pointy", "Backlog zmian"],
        "steps": ["Zinwentaryzuj integracje", "Oceń dług per połączenie", "Zidentyfikuj wzorce", "Zrób draft docelowej architektury", "Priorytetyzuj inicjatywy naprawcze"],
        "outputs": ["Heatmapa długu", "Szkic docelowej architektury", "3–7 koncepcji inicjatyw"],
        "commonMistakes": ["Niekompletny inwentarz", "Brak scoringu wpływu biznesowego", "Roadmapa boil-the-ocean"],
        "example": "42 linki point-to-point → konsolidacja na event bus dla top-5 flow; fazowanie na 3 kwartały.",
        "nextSteps": ["Wygeneruj raport/prezentację", "Utwórz batch inicjatyw"]
      }
    }$$,
    'Network',
    0,
    1,
    0,
    $$["digital","integration","architecture"]$$,
    305
  ),
  (
    'tool-known-digital-value-pool',
    'digital-value-pool',
    'digital-value-pool',
    'Digital Value Pool',
    'analysis',
    'digital',
    'Identify where digital changes the economics of the business.',
    $${
      "en": "Identify where digital changes the economics of the business.",
      "pl": "Wskaż, gdzie cyfryzacja zmienia ekonomię biznesu."
    }$$,
    $${
      "en": {
        "shortDescription": "Find where digital levers shift unit economics, margins, or revenue.",
        "whenToUse": "Use when digital investment lacks a clear economic thesis and ROI is hand-waved.",
        "whatYouGet": ["Value pool map", "Economic levers", "Initiative shortlist"],
        "inputs": ["P&L structure", "Cost drivers", "Revenue streams", "Digital capabilities inventory"],
        "steps": ["Map value chain economics", "Identify digital levers per segment", "Size pools", "Rank by feasibility", "Draft initiative concepts"],
        "outputs": ["Value pool sizing", "Lever ranking", "3–7 initiative concepts"],
        "commonMistakes": ["No baseline economics", "Technology-first thinking", "Ignoring adoption cost"],
        "example": "Digital self-service shifts 30% of support volume → €2M/yr savings; pilot in Q2.",
        "nextSteps": ["Generate report/deck", "Create initiatives batch"]
      },
      "pl": {
        "shortDescription": "Znajdź, gdzie dźwignie cyfrowe zmieniają unit economics, marże lub przychody.",
        "whenToUse": "Gdy inwestycje cyfrowe nie mają jasnej tezy ekonomicznej, a ROI jest zgadywane.",
        "whatYouGet": ["Mapa pul wartości", "Dźwignie ekonomiczne", "Shortlista inicjatyw"],
        "inputs": ["Struktura P&L", "Drivery kosztów", "Strumienie przychodów", "Inwentarz capabilities cyfrowych"],
        "steps": ["Zmapuj ekonomię łańcucha wartości", "Wskaż dźwignie cyfrowe per segment", "Oszacuj pule", "Rankuj wg wykonalności", "Zrób draft inicjatyw"],
        "outputs": ["Sizing pul wartości", "Ranking dźwigni", "3–7 koncepcji inicjatyw"],
        "commonMistakes": ["Brak baseline ekonomii", "Myślenie technology-first", "Ignorowanie kosztu adopcji"],
        "example": "Cyfrowy self-service przenosi 30% wolumenu supportu → €2M/rok oszczędności; pilot w Q2.",
        "nextSteps": ["Wygeneruj raport/prezentację", "Utwórz batch inicjatyw"]
      }
    }$$,
    'DollarSign',
    0,
    1,
    0,
    $$["digital","value","economics"]$$,
    306
  ),
  (
    'tool-known-legacy-analyzer',
    'legacy-analyzer',
    'legacy-analyzer',
    'Legacy Analyzer',
    'analysis',
    'digital',
    'Quantify the drag of legacy systems on speed, cost, and risk.',
    $${
      "en": "Quantify the drag of legacy systems on speed, cost, and risk.",
      "pl": "Zmierz obciążenie legacy systemów na szybkość, koszt i ryzyko."
    }$$,
    $${
      "en": {
        "shortDescription": "Score legacy systems by drag on speed, cost, and risk to prioritize modernization.",
        "whenToUse": "Use when legacy systems slow delivery, inflate costs, or create compliance/security risk.",
        "whatYouGet": ["Legacy drag scorecard", "Risk heatmap", "Modernization backlog"],
        "inputs": ["System inventory", "Incident/change data", "Cost allocations", "Business criticality"],
        "steps": ["Inventory legacy systems", "Score drag dimensions", "Map business impact", "Identify modernization patterns", "Draft initiative backlog"],
        "outputs": ["Drag scorecard", "Risk heatmap", "3–7 initiative concepts"],
        "commonMistakes": ["No cost baseline", "Ignoring people/skill risk", "Big-bang replacement bias"],
        "example": "ERP module scores 9/10 drag on speed → strangler-fig migration over 4 quarters.",
        "nextSteps": ["Generate report/deck", "Create initiatives batch"]
      },
      "pl": {
        "shortDescription": "Oceń legacy systemy wg obciążenia szybkości, kosztu i ryzyka pod modernizację.",
        "whenToUse": "Gdy legacy spowalnia delivery, zawyża koszty lub tworzy ryzyko compliance/security.",
        "whatYouGet": ["Scorecard obciążenia legacy", "Heatmapa ryzyk", "Backlog modernizacji"],
        "inputs": ["Inwentarz systemów", "Dane incydentów/zmian", "Alokacje kosztów", "Krytyczność biznesowa"],
        "steps": ["Zinwentaryzuj legacy", "Oceń wymiary obciążenia", "Zmapuj wpływ biznesowy", "Wskaż wzorce modernizacji", "Zrób backlog inicjatyw"],
        "outputs": ["Scorecard obciążenia", "Heatmapa ryzyk", "3–7 koncepcji inicjatyw"],
        "commonMistakes": ["Brak baseline kosztów", "Ignorowanie ryzyka ludzi/kompetencji", "Bias na big-bang replacement"],
        "example": "Moduł ERP: 9/10 drag na szybkość → migracja strangler-fig w 4 kwartały.",
        "nextSteps": ["Wygeneruj raport/prezentację", "Utwórz batch inicjatyw"]
      }
    }$$,
    'HardDrive',
    0,
    1,
    0,
    $$["digital","legacy","modernization"]$$,
    307
  ),
  (
    'tool-known-data-inventory',
    'data-inventory',
    'data-inventory',
    'Data Inventory',
    'analysis',
    'digital',
    'Map decisions to data needs and identify gaps in availability and quality.',
    $${
      "en": "Map decisions to data needs and identify gaps in availability and quality.",
      "pl": "Zmapuj decyzje na potrzeby danych i wskaż luki w dostępności i jakości."
    }$$,
    $${
      "en": {
        "shortDescription": "Link business decisions to data assets and surface gaps.",
        "whenToUse": "Use when decisions are made on gut feel, data is scattered, or quality is unknown.",
        "whatYouGet": ["Decision→data map", "Gap register", "Data initiative backlog"],
        "inputs": ["Key decisions list", "Data sources", "Quality assessments", "Ownership info"],
        "steps": ["List key decisions", "Map data needs per decision", "Assess availability and quality", "Identify gaps", "Draft data initiatives"],
        "outputs": ["Decision→data matrix", "Gap register", "3–7 initiative concepts"],
        "commonMistakes": ["Inventory without decision link", "No quality scoring", "No ownership assignment"],
        "example": "Demand planning decision needs 5 data sets; 2 missing, 1 poor quality → 3 data initiatives.",
        "nextSteps": ["Generate report/deck", "Create initiatives batch"]
      },
      "pl": {
        "shortDescription": "Połącz decyzje biznesowe z zasobami danych i ujawnij luki.",
        "whenToUse": "Gdy decyzje opierają się na intuicji, dane są rozproszone, a jakość nieznana.",
        "whatYouGet": ["Mapa decyzja→dane", "Rejestr luk", "Backlog inicjatyw danych"],
        "inputs": ["Lista kluczowych decyzji", "Źródła danych", "Oceny jakości", "Info o ownership"],
        "steps": ["Wypisz kluczowe decyzje", "Zmapuj potrzeby danych per decyzja", "Oceń dostępność i jakość", "Wskaż luki", "Zrób inicjatywy danych"],
        "outputs": ["Macierz decyzja→dane", "Rejestr luk", "3–7 koncepcji inicjatyw"],
        "commonMistakes": ["Inwentarz bez powiązania z decyzjami", "Brak scoringu jakości", "Brak przypisania ownership"],
        "example": "Decyzja planowania popytu wymaga 5 zbiorów; 2 brakujące, 1 słaba jakość → 3 inicjatywy danych.",
        "nextSteps": ["Wygeneruj raport/prezentację", "Utwórz batch inicjatyw"]
      }
    }$$,
    'Database',
    0,
    1,
    0,
    $$["digital","data","governance"]$$,
    308
  ),
  (
    'tool-known-pain-to-solution',
    'pain-to-solution',
    'pain-to-solution',
    'Pain-to-Solution Mapper',
    'analysis',
    'digital',
    'Map pains to solution archetypes and build a prioritized solution backlog.',
    $${
      "en": "Map pains to solution archetypes and build a prioritized solution backlog.",
      "pl": "Zmapuj bóle na archetypy rozwiązań i zbuduj priorytetyzowany backlog rozwiązań."
    }$$,
    $${
      "en": {
        "shortDescription": "Match validated pains to proven solution patterns and prioritize.",
        "whenToUse": "Use when you have a pain inventory but need to move from problems to actionable solutions.",
        "whatYouGet": ["Pain→archetype map", "Solution backlog", "Feasibility notes"],
        "inputs": ["Pain inventory", "Solution archetypes catalog", "Constraints", "Feasibility criteria"],
        "steps": ["Review pains", "Match to archetypes", "Score feasibility", "Prioritize solutions", "Draft initiative concepts"],
        "outputs": ["Pain→solution mapping", "Prioritized backlog", "3–7 initiative concepts"],
        "commonMistakes": ["Solution before pain validation", "Ignoring constraints", "No feasibility check"],
        "example": "Pain: manual order entry → archetype: e-commerce portal + integration; feasibility: high; pilot Q3.",
        "nextSteps": ["Generate report/deck", "Create initiatives batch"]
      },
      "pl": {
        "shortDescription": "Dopasuj zwalidowane bóle do sprawdzonych wzorców rozwiązań i priorytetyzuj.",
        "whenToUse": "Gdy masz inwentarz bólów, ale musisz przejść od problemów do wykonalnych rozwiązań.",
        "whatYouGet": ["Mapa ból→archetyp", "Backlog rozwiązań", "Notatki wykonalności"],
        "inputs": ["Inwentarz bólów", "Katalog archetypów", "Ograniczenia", "Kryteria wykonalności"],
        "steps": ["Przejrzyj bóle", "Dopasuj do archetypów", "Oceń wykonalność", "Priorytetyzuj rozwiązania", "Zrób draft inicjatyw"],
        "outputs": ["Mapowanie ból→rozwiązanie", "Priorytetyzowany backlog", "3–7 koncepcji inicjatyw"],
        "commonMistakes": ["Rozwiązanie przed walidacją bólu", "Ignorowanie ograniczeń", "Brak sprawdzenia wykonalności"],
        "example": "Ból: ręczne wprowadzanie zamówień → archetyp: portal e-commerce + integracja; wykonalność: wysoka; pilot Q3.",
        "nextSteps": ["Wygeneruj raport/prezentację", "Utwórz batch inicjatyw"]
      }
    }$$,
    'Lightbulb',
    0,
    1,
    0,
    $$["digital","solutions","mapping"]$$,
    309
  ),
  (
    'tool-known-pain-explorer',
    'pain-explorer',
    'pain-explorer',
    'Pain Explorer',
    'analysis',
    'digital',
    'Turn chaotic pains into structured problems with hypotheses and evidence tags.',
    $${
      "en": "Turn chaotic pains into structured problems with hypotheses and evidence tags.",
      "pl": "Zamień chaotyczne bóle w ustrukturyzowane problemy z hipotezami i tagami evidence."
    }$$,
    $${
      "en": {
        "shortDescription": "Structure messy pains into clear problems, hypotheses, and evidence gaps.",
        "whenToUse": "Use at the start of discovery when stakeholders list many pains but nothing is structured.",
        "whatYouGet": ["Structured problem list", "Hypotheses", "Evidence gaps"],
        "inputs": ["Raw pain statements", "Stakeholder interviews", "Existing data/reports", "Context notes"],
        "steps": ["Collect raw pains", "Cluster and deduplicate", "Formulate problem statements", "Draft hypotheses", "Tag evidence vs assumptions"],
        "outputs": ["Problem register", "Hypothesis set", "3–7 investigation initiatives"],
        "commonMistakes": ["Jumping to solutions", "No evidence tagging", "Too many clusters"],
        "example": "15 raw pains → 4 problem clusters → 8 hypotheses; 3 have evidence, 5 need validation.",
        "nextSteps": ["Generate report/deck", "Create initiatives batch"]
      },
      "pl": {
        "shortDescription": "Ustrukturyzuj chaotyczne bóle w jasne problemy, hipotezy i luki w evidence.",
        "whenToUse": "Na starcie discovery, gdy stakeholderzy wymieniają wiele bólów, ale nic nie jest ustrukturyzowane.",
        "whatYouGet": ["Lista ustrukturyzowanych problemów", "Hipotezy", "Luki w evidence"],
        "inputs": ["Surowe opisy bólów", "Wywiady ze stakeholderami", "Istniejące dane/raporty", "Notatki kontekstowe"],
        "steps": ["Zbierz surowe bóle", "Klastruj i deduplikuj", "Sformułuj problem statements", "Zrób draft hipotez", "Otaguj evidence vs assumptions"],
        "outputs": ["Rejestr problemów", "Zestaw hipotez", "3–7 inicjatyw badawczych"],
        "commonMistakes": ["Skakanie do rozwiązań", "Brak tagowania evidence", "Za dużo klastrów"],
        "example": "15 surowych bólów → 4 klastry problemów → 8 hipotez; 3 mają evidence, 5 wymaga walidacji.",
        "nextSteps": ["Wygeneruj raport/prezentację", "Utwórz batch inicjatyw"]
      }
    }$$,
    'Search',
    0,
    1,
    0,
    $$["digital","discovery","problems"]$$,
    310
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
-- KNOWLEDGE BASE: "HOW TO USE" ARTICLE PER TOOL (12)
-- ==========================================

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

INSERT INTO kb_articles (
  id, category_id, slug, status, is_featured, is_public, view_count, reading_time_minutes,
  thumbnail_url, video_url, video_teaser_url, related_modules, target_audience, created_at
) VALUES
  ('kb-art-tools-ambition-decomposer', 'kb-cat-tools-features', 'tools-ambition-decomposer-how-to', 'published', 0, 0, 0, 5, NULL, NULL, NULL, '["ambition-decomposer"]', '["consultant","manager"]', NOW()),
  ('kb-art-tools-focus-tradeoff', 'kb-cat-tools-features', 'tools-focus-tradeoff-how-to', 'published', 0, 0, 0, 5, NULL, NULL, NULL, '["focus-tradeoff"]', '["consultant","manager"]', NOW()),
  ('kb-art-tools-narrative-engine', 'kb-cat-tools-features', 'tools-narrative-engine-how-to', 'published', 0, 0, 0, 5, NULL, NULL, NULL, '["narrative-engine"]', '["consultant","manager"]', NOW()),
  ('kb-art-tools-smed-planner', 'kb-cat-tools-features', 'tools-smed-planner-how-to', 'published', 0, 0, 0, 5, NULL, NULL, NULL, '["smed-planner"]', '["consultant","manager"]', NOW()),
  ('kb-art-tools-dms-builder', 'kb-cat-tools-features', 'tools-dms-builder-how-to', 'published', 0, 0, 0, 5, NULL, NULL, NULL, '["dms-builder"]', '["consultant","manager"]', NOW()),
  ('kb-art-tools-inventory-autopilot', 'kb-cat-tools-features', 'tools-inventory-autopilot-how-to', 'published', 0, 0, 0, 5, NULL, NULL, NULL, '["inventory-autopilot"]', '["consultant","manager"]', NOW()),
  ('kb-art-tools-integration-diagnostic', 'kb-cat-tools-features', 'tools-integration-diagnostic-how-to', 'published', 0, 0, 0, 5, NULL, NULL, NULL, '["integration-diagnostic"]', '["consultant","manager"]', NOW()),
  ('kb-art-tools-digital-value-pool', 'kb-cat-tools-features', 'tools-digital-value-pool-how-to', 'published', 0, 0, 0, 5, NULL, NULL, NULL, '["digital-value-pool"]', '["consultant","manager"]', NOW()),
  ('kb-art-tools-legacy-analyzer', 'kb-cat-tools-features', 'tools-legacy-analyzer-how-to', 'published', 0, 0, 0, 5, NULL, NULL, NULL, '["legacy-analyzer"]', '["consultant","manager"]', NOW()),
  ('kb-art-tools-data-inventory', 'kb-cat-tools-features', 'tools-data-inventory-how-to', 'published', 0, 0, 0, 5, NULL, NULL, NULL, '["data-inventory"]', '["consultant","manager"]', NOW()),
  ('kb-art-tools-pain-to-solution', 'kb-cat-tools-features', 'tools-pain-to-solution-how-to', 'published', 0, 0, 0, 5, NULL, NULL, NULL, '["pain-to-solution"]', '["consultant","manager"]', NOW()),
  ('kb-art-tools-pain-explorer', 'kb-cat-tools-features', 'tools-pain-explorer-how-to', 'published', 0, 0, 0, 5, NULL, NULL, NULL, '["pain-explorer"]', '["consultant","manager"]', NOW())
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  status = EXCLUDED.status,
  category_id = EXCLUDED.category_id,
  related_modules = EXCLUDED.related_modules,
  target_audience = EXCLUDED.target_audience,
  reading_time_minutes = EXCLUDED.reading_time_minutes;

INSERT INTO kb_article_translations (id, article_id, language, title, summary, content, video_script)
VALUES
  -- ambition-decomposer
  (
    'kb-art-trans-tools-ambition-decomposer-en',
    'kb-art-tools-ambition-decomposer',
    'en',
    'How to use: Ambition Decomposer',
    'Turn a vision into measurable dimensions, targets, and initiative themes.',
    $$# Ambition Decomposer — How to use

## Purpose / when to use
Use when you have a vision but need a structured path to measurable outcomes and initiatives.

## Inputs
- Vision statement + strategic targets
- Constraints and stakeholder expectations
- Evidence links (where available)

## Steps
1) Define ambition and horizon  
2) Decompose into 3–7 measurable dimensions  
3) Assign metrics and targets (baseline → target)  
4) Identify gaps and dependencies  
5) Draft initiative themes and owners

## Common mistakes
- Vague ambition without targets
- Too many dimensions
- No explicit assumptions register

## Next steps in Consultify
Finalize the session, then generate an initiatives batch and a short deck.$$,
    NULL
  ),
  (
    'kb-art-trans-tools-ambition-decomposer-pl',
    'kb-art-tools-ambition-decomposer',
    'pl',
    'Jak używać: Ambition Decomposer',
    'Przełóż wizję na wymiary, cele i tematy inicjatyw.',
    $$# Ambition Decomposer — Jak używać

## Purpose / kiedy używać
Gdy masz wizję, ale potrzebujesz ścieżki do mierzalnych efektów i inicjatyw.

## Inputs
- Wizja + cele strategiczne
- Ograniczenia i oczekiwania stakeholderów
- Evidence (jeśli dostępne)

## Steps
1) Zdefiniuj ambicję i horyzont  
2) Rozbij na 3–7 mierzalnych wymiarów  
3) Przypisz metryki i cele (baseline → target)  
4) Wskaż luki i zależności  
5) Zrób draft tematów inicjatyw i ownerów

## Common mistakes
- Ogólna ambicja bez celów
- Za dużo wymiarów
- Brak rejestru założeń

## Next steps w Consultify
Sfinalizuj sesję, a potem wygeneruj batch inicjatyw i krótki deck.$$,
    NULL
  ),
  -- focus-tradeoff
  (
    'kb-art-trans-tools-focus-tradeoff-en',
    'kb-art-tools-focus-tradeoff',
    'en',
    'How to use: Focus & Trade-offs',
    'Make trade-offs explicit and decide what not to do.',
    $$# Focus & Trade-offs — How to use

## Purpose / when to use
Use when priorities conflict, scope creeps, or stakeholders pull in different directions.

## Steps
1) List conflicts and constraints  
2) Define decision criteria  
3) Explore alternatives  
4) Document trade-offs and rationale  
5) Draft stop-doing and enabling initiatives

## Next steps in Consultify
Finalize and generate initiatives batch.$$,
    NULL
  ),
  (
    'kb-art-trans-tools-focus-tradeoff-pl',
    'kb-art-tools-focus-tradeoff',
    'pl',
    'Jak używać: Focus & Trade-offs',
    'Uczyń trade-offy jawne i zdecyduj czego nie robić.',
    $$# Focus & Trade-offs — Jak używać

## Purpose / kiedy używać
Gdy priorytety się gryzą, rośnie scope albo stakeholderzy ciągną w różne strony.

## Steps
1) Wypisz konflikty i ograniczenia  
2) Ustal kryteria decyzji  
3) Oceń alternatywy  
4) Udokumentuj trade-offy i uzasadnienie  
5) Zrób inicjatywy stop-doing i enabling

## Next steps w Consultify
Sfinalizuj i wygeneruj batch inicjatyw.$$,
    NULL
  ),
  -- narrative-engine
  (
    'kb-art-trans-tools-narrative-engine-en',
    'kb-art-tools-narrative-engine',
    'en',
    'How to use: Narrative & Alignment',
    'Create an executive-ready narrative and alignment checks.',
    $$# Narrative & Alignment — How to use

## Purpose / when to use
Use when you must communicate strategy clearly across stakeholders and avoid inconsistent messaging.

## Steps
1) Define audience and required decision  
2) Draft answer-first storyline  
3) Add supporting proof points (tag evidence vs assumptions)  
4) Run alignment checklist  
5) Draft communication and enablement initiatives

## Next steps in Consultify
Generate a deck/report, then create initiatives batch.$$,
    NULL
  ),
  (
    'kb-art-trans-tools-narrative-engine-pl',
    'kb-art-tools-narrative-engine',
    'pl',
    'Jak używać: Narrative & Alignment',
    'Stwórz narrację executive-ready i sprawdź alignment.',
    $$# Narrative & Alignment — Jak używać

## Purpose / kiedy używać
Gdy musisz jasno komunikować strategię i uniknąć sprzecznych przekazów.

## Steps
1) Zdefiniuj odbiorców i decyzję  
2) Zrób narrację answer-first  
3) Dodaj proof points (taguj evidence vs assumptions)  
4) Przejdź checklistę alignmentu  
5) Zrób inicjatywy komunikacyjne i enablement

## Next steps w Consultify
Wygeneruj deck/raport, a potem batch inicjatyw.$$,
    NULL
  ),
  -- smed-planner
  (
    'kb-art-trans-tools-smed-planner-en',
    'kb-art-tools-smed-planner',
    'en',
    'How to use: SMED Planner',
    'Reduce changeover time and translate actions into initiatives.',
    $$# SMED Planner — How to use

## Purpose / when to use
Use when changeovers drive downtime, batching, and delivery instability.

## Steps
1) Capture the changeover steps (facts + timing)  
2) Classify internal vs external  
3) Convert internal to external where possible  
4) Standardize tools/layout and critical checks  
5) Estimate impact and draft initiatives

## Next steps in Consultify
Finalize and generate initiatives batch.$$,
    NULL
  ),
  (
    'kb-art-trans-tools-smed-planner-pl',
    'kb-art-tools-smed-planner',
    'pl',
    'Jak używać: SMED Planner',
    'Redukuj przezbrojenia i zamień działania w inicjatywy.',
    $$# SMED Planner — Jak używać

## Purpose / kiedy używać
Gdy przezbrojenia generują przestoje, batchowanie i niestabilne terminy.

## Steps
1) Zbierz kroki przezbrojenia (fakty + czasy)  
2) Klasyfikuj internal vs external  
3) Konwertuj internal→external  
4) Standaryzuj narzędzia/layout i kontrole krytyczne  
5) Oszacuj wpływ i zrób inicjatywy

## Next steps w Consultify
Sfinalizuj i wygeneruj batch inicjatyw.$$,
    NULL
  ),
  -- dms-builder
  (
    'kb-art-trans-tools-dms-builder-en',
    'kb-art-tools-dms-builder',
    'en',
    'How to use: Daily Management System',
    'Build cadence, KPIs and escalation that turns issues into actions.',
    $$# Daily Management System — How to use

## Purpose / when to use
Use when firefighting dominates and there is no clear cadence, ownership, or escalation.

## Steps
1) Define tiers and meeting cadence  
2) Select leading/lagging KPIs  
3) Define thresholds and escalation rules  
4) Assign owners and routines  
5) Draft rollout initiatives

## Next steps in Consultify
Generate a deck/report and an initiatives batch.$$,
    NULL
  ),
  (
    'kb-art-trans-tools-dms-builder-pl',
    'kb-art-tools-dms-builder',
    'pl',
    'Jak używać: Daily Management System',
    'Zbuduj cadence, KPI i eskalację, które zamieniają problemy w działania.',
    $$# Daily Management System — Jak używać

## Purpose / kiedy używać
Gdy dominuje gaszenie pożarów i brakuje rytmu, ownershipu i eskalacji.

## Steps
1) Zdefiniuj tiery i rytm spotkań  
2) Wybierz leading/lagging KPI  
3) Ustal progi i reguły eskalacji  
4) Przypisz ownerów i rutyny  
5) Zrób inicjatywy rollout

## Next steps w Consultify
Wygeneruj deck/raport i batch inicjatyw.$$,
    NULL
  ),
  -- inventory-autopilot
  (
    'kb-art-trans-tools-inventory-autopilot-en',
    'kb-art-tools-inventory-autopilot',
    'en',
    'How to use: Inventory Autopilot',
    'Define inventory policies and simulate cash/stockout trade-offs.',
    $$# Inventory Autopilot — How to use

## Purpose / when to use
Use when inventory is too high or stockouts are frequent and policies are inconsistent.

## Steps
1) Segment SKUs (ABC/XYZ or equivalent)  
2) Set service targets by segment  
3) Define replenishment policies and governance cadence  
4) Simulate scenarios (baseline → target)  
5) Draft initiatives (policy, data, forecasting, S&OP integration)

## Next steps in Consultify
Finalize and generate initiatives batch.$$,
    NULL
  ),
  (
    'kb-art-trans-tools-inventory-autopilot-pl',
    'kb-art-tools-inventory-autopilot',
    'pl',
    'Jak używać: Inventory Autopilot',
    'Zdefiniuj polityki zapasów i zasymuluj trade-off cash/stockout.',
    $$# Inventory Autopilot — Jak używać

## Purpose / kiedy używać
Gdy zapasy są za duże albo są częste braki, a polityki są niespójne.

## Steps
1) Segmentuj SKU (ABC/XYZ lub podobnie)  
2) Ustal cele serwisu per segment  
3) Zdefiniuj polityki uzupełnień i cadence governance  
4) Zasymuluj scenariusze (baseline → target)  
5) Zrób inicjatywy (polityki, dane, forecasting, integracja z S&OP)

## Next steps w Consultify
Sfinalizuj i wygeneruj batch inicjatyw.$$,
    NULL
  ),
  -- integration-diagnostic
  (
    'kb-art-trans-tools-integration-diagnostic-en',
    'kb-art-tools-integration-diagnostic',
    'en',
    'How to use: Integration Diagnostic',
    'Map integration debt and build an architecture remediation roadmap.',
    $$# Integration Diagnostic — How to use

## Purpose / when to use
Use when point-to-point integrations multiply, data is inconsistent, and changes take too long.

## Steps
1) Inventory all integrations (source, target, protocol, frequency)  
2) Score debt per connection (fragility, cost, change speed)  
3) Identify patterns and anti-patterns  
4) Draft target architecture sketch  
5) Prioritize remediation initiatives

## Next steps in Consultify
Generate a deck/report and an initiatives batch.$$,
    NULL
  ),
  (
    'kb-art-trans-tools-integration-diagnostic-pl',
    'kb-art-tools-integration-diagnostic',
    'pl',
    'Jak używać: Integration Diagnostic',
    'Zmapuj dług integracyjny i zbuduj roadmapę naprawy architektury.',
    $$# Integration Diagnostic — Jak używać

## Purpose / kiedy używać
Gdy mnożą się integracje point-to-point, dane są niespójne, a zmiany trwają za długo.

## Steps
1) Zinwentaryzuj integracje (źródło, cel, protokół, częstotliwość)  
2) Oceń dług per połączenie (kruchość, koszt, szybkość zmian)  
3) Zidentyfikuj wzorce i antywzorce  
4) Zrób szkic docelowej architektury  
5) Priorytetyzuj inicjatywy naprawcze

## Next steps w Consultify
Wygeneruj deck/raport i batch inicjatyw.$$,
    NULL
  ),
  -- digital-value-pool
  (
    'kb-art-trans-tools-digital-value-pool-en',
    'kb-art-tools-digital-value-pool',
    'en',
    'How to use: Digital Value Pool',
    'Identify where digital changes the economics of the business.',
    $$# Digital Value Pool — How to use

## Purpose / when to use
Use when digital investment lacks a clear economic thesis and ROI is hand-waved.

## Steps
1) Map value chain economics (cost, revenue, margin per segment)  
2) Identify digital levers per segment  
3) Size value pools (conservative, base, upside)  
4) Rank by feasibility and time-to-value  
5) Draft initiative concepts with economic framing

## Next steps in Consultify
Generate a deck/report and an initiatives batch.$$,
    NULL
  ),
  (
    'kb-art-trans-tools-digital-value-pool-pl',
    'kb-art-tools-digital-value-pool',
    'pl',
    'Jak używać: Digital Value Pool',
    'Wskaż, gdzie cyfryzacja zmienia ekonomię biznesu.',
    $$# Digital Value Pool — Jak używać

## Purpose / kiedy używać
Gdy inwestycje cyfrowe nie mają jasnej tezy ekonomicznej, a ROI jest zgadywane.

## Steps
1) Zmapuj ekonomię łańcucha wartości (koszt, przychód, marża per segment)  
2) Wskaż dźwignie cyfrowe per segment  
3) Oszacuj pule wartości (konserwatywnie, bazowo, optymistycznie)  
4) Rankuj wg wykonalności i time-to-value  
5) Zrób draft inicjatyw z ramowaniem ekonomicznym

## Next steps w Consultify
Wygeneruj deck/raport i batch inicjatyw.$$,
    NULL
  ),
  -- legacy-analyzer
  (
    'kb-art-trans-tools-legacy-analyzer-en',
    'kb-art-tools-legacy-analyzer',
    'en',
    'How to use: Legacy Analyzer',
    'Quantify the drag of legacy systems on speed, cost, and risk.',
    $$# Legacy Analyzer — How to use

## Purpose / when to use
Use when legacy systems slow delivery, inflate costs, or create compliance/security risk.

## Steps
1) Inventory legacy systems (age, tech stack, criticality)  
2) Score drag dimensions (speed, cost, risk)  
3) Map business impact per system  
4) Identify modernization patterns (wrap, replace, retire)  
5) Draft initiative backlog with sequencing

## Next steps in Consultify
Generate a deck/report and an initiatives batch.$$,
    NULL
  ),
  (
    'kb-art-trans-tools-legacy-analyzer-pl',
    'kb-art-tools-legacy-analyzer',
    'pl',
    'Jak używać: Legacy Analyzer',
    'Zmierz obciążenie legacy systemów na szybkość, koszt i ryzyko.',
    $$# Legacy Analyzer — Jak używać

## Purpose / kiedy używać
Gdy legacy spowalnia delivery, zawyża koszty lub tworzy ryzyko compliance/security.

## Steps
1) Zinwentaryzuj legacy (wiek, stos technologiczny, krytyczność)  
2) Oceń wymiary obciążenia (szybkość, koszt, ryzyko)  
3) Zmapuj wpływ biznesowy per system  
4) Wskaż wzorce modernizacji (wrap, replace, retire)  
5) Zrób backlog inicjatyw z sekwencjonowaniem

## Next steps w Consultify
Wygeneruj deck/raport i batch inicjatyw.$$,
    NULL
  ),
  -- data-inventory
  (
    'kb-art-trans-tools-data-inventory-en',
    'kb-art-tools-data-inventory',
    'en',
    'How to use: Data Inventory',
    'Map decisions to data needs and identify gaps.',
    $$# Data Inventory — How to use

## Purpose / when to use
Use when decisions are made on gut feel, data is scattered, or quality is unknown.

## Steps
1) List key business decisions  
2) Map data needs per decision  
3) Assess availability and quality of each data set  
4) Identify gaps and ownership issues  
5) Draft data initiatives (collection, quality, governance)

## Next steps in Consultify
Generate a deck/report and an initiatives batch.$$,
    NULL
  ),
  (
    'kb-art-trans-tools-data-inventory-pl',
    'kb-art-tools-data-inventory',
    'pl',
    'Jak używać: Data Inventory',
    'Zmapuj decyzje na potrzeby danych i wskaż luki.',
    $$# Data Inventory — Jak używać

## Purpose / kiedy używać
Gdy decyzje opierają się na intuicji, dane są rozproszone, a jakość nieznana.

## Steps
1) Wypisz kluczowe decyzje biznesowe  
2) Zmapuj potrzeby danych per decyzja  
3) Oceń dostępność i jakość każdego zbioru danych  
4) Wskaż luki i problemy z ownership  
5) Zrób inicjatywy danych (zbieranie, jakość, governance)

## Next steps w Consultify
Wygeneruj deck/raport i batch inicjatyw.$$,
    NULL
  ),
  -- pain-to-solution
  (
    'kb-art-trans-tools-pain-to-solution-en',
    'kb-art-tools-pain-to-solution',
    'en',
    'How to use: Pain-to-Solution Mapper',
    'Map pains to solution archetypes and build a prioritized backlog.',
    $$# Pain-to-Solution Mapper — How to use

## Purpose / when to use
Use when you have a pain inventory but need to move from problems to actionable solutions.

## Steps
1) Review validated pains  
2) Match each pain to solution archetypes  
3) Score feasibility (technical, organizational, economic)  
4) Prioritize solutions by impact and feasibility  
5) Draft initiative concepts

## Next steps in Consultify
Generate a deck/report and an initiatives batch.$$,
    NULL
  ),
  (
    'kb-art-trans-tools-pain-to-solution-pl',
    'kb-art-tools-pain-to-solution',
    'pl',
    'Jak używać: Pain-to-Solution Mapper',
    'Zmapuj bóle na archetypy rozwiązań i zbuduj priorytetyzowany backlog.',
    $$# Pain-to-Solution Mapper — Jak używać

## Purpose / kiedy używać
Gdy masz inwentarz bólów, ale musisz przejść od problemów do wykonalnych rozwiązań.

## Steps
1) Przejrzyj zwalidowane bóle  
2) Dopasuj każdy ból do archetypów rozwiązań  
3) Oceń wykonalność (techniczna, organizacyjna, ekonomiczna)  
4) Priorytetyzuj rozwiązania wg wpływu i wykonalności  
5) Zrób draft inicjatyw

## Next steps w Consultify
Wygeneruj deck/raport i batch inicjatyw.$$,
    NULL
  ),
  -- pain-explorer
  (
    'kb-art-trans-tools-pain-explorer-en',
    'kb-art-tools-pain-explorer',
    'en',
    'How to use: Pain Explorer',
    'Turn chaotic pains into structured problems with hypotheses.',
    $$# Pain Explorer — How to use

## Purpose / when to use
Use at the start of discovery when stakeholders list many pains but nothing is structured.

## Steps
1) Collect raw pain statements from stakeholders  
2) Cluster and deduplicate  
3) Formulate clear problem statements  
4) Draft hypotheses for each problem  
5) Tag evidence vs assumptions and identify validation needs

## Next steps in Consultify
Generate a deck/report and an initiatives batch.$$,
    NULL
  ),
  (
    'kb-art-trans-tools-pain-explorer-pl',
    'kb-art-tools-pain-explorer',
    'pl',
    'Jak używać: Pain Explorer',
    'Zamień chaotyczne bóle w ustrukturyzowane problemy z hipotezami.',
    $$# Pain Explorer — Jak używać

## Purpose / kiedy używać
Na starcie discovery, gdy stakeholderzy wymieniają wiele bólów, ale nic nie jest ustrukturyzowane.

## Steps
1) Zbierz surowe opisy bólów od stakeholderów  
2) Klastruj i deduplikuj  
3) Sformułuj jasne problem statements  
4) Zrób draft hipotez per problem  
5) Otaguj evidence vs assumptions i wskaż potrzeby walidacji

## Next steps w Consultify
Wygeneruj deck/raport i batch inicjatyw.$$,
    NULL
  )
ON CONFLICT (article_id, language) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  content = EXCLUDED.content,
  video_script = EXCLUDED.video_script;
