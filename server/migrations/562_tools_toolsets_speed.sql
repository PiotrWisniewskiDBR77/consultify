-- Bundle 05 (T019, T022–T024) — Tools: toolsets + Speed Tool
-- PostgreSQL-native seed migration for additional Known Tools + KB "How to use".

-- ==========================================
-- SEED: OPERATIONAL TOOLSET (missing 5/10)
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
    'tool-known-constraint-control',
    'constraint-control',
    'constraint-control',
    'Constraint Control (TOC)',
    'process',
    'operational',
    'Identify and manage the system constraint to improve throughput and delivery.',
    $${
      "en": "Identify and manage the system constraint to improve throughput and delivery.",
      "pl": "Identyfikuj i zarządzaj wąskim gardłem (TOC), aby poprawić przepustowość i terminowość."
    }$$,
    $${
      "en": {
        "shortDescription": "A practical TOC playbook: find the constraint, protect it, and improve flow.",
        "whenToUse": "Use when delivery is late, WIP grows, or output is capped by a bottleneck.",
        "whatYouGet": ["Constraint hypothesis", "Buffer policy", "Action list and initiatives"],
        "inputs": ["Process flow", "Throughput by step", "Queues/WIP", "Downtime and changeovers"],
        "steps": ["Identify constraint", "Protect (buffers)", "Exploit (standard work)", "Subordinate (WIP rules)", "Elevate (capacity)"],
        "outputs": ["Constraint plan", "Buffer/priority rules", "3–7 initiative concepts"],
        "commonMistakes": ["Optimizing non-constraints", "No buffer discipline", "Measuring utilization instead of flow"],
        "example": "Bottleneck is packaging → protect with buffer, reduce changeovers, subordinate upstream release.",
        "nextSteps": ["Generate report/deck", "Create initiatives batch"]
      },
      "pl": {
        "shortDescription": "Praktyczny TOC: znajdź ograniczenie, chroń je i popraw przepływ.",
        "whenToUse": "Gdy terminy są niepewne, rośnie WIP lub wynik ogranicza wąskie gardło.",
        "whatYouGet": ["Hipoteza constraintu", "Polityka buforów", "Lista działań i inicjatywy"],
        "inputs": ["Flow procesu", "Przepustowość per krok", "Kolejki/WIP", "Przestoje i przezbrojenia"],
        "steps": ["Zidentyfikuj constraint", "Chroń (bufory)", "Wykorzystaj (standard work)", "Podporządkuj (reguły WIP)", "Podnieś (capacity)"],
        "outputs": ["Plan constraintu", "Reguły buforów/prioritetów", "3–7 koncepcji inicjatyw"],
        "commonMistakes": ["Optymalizacja nie-constraintów", "Brak dyscypliny buforów", "Mierzenie wykorzystania zamiast flow"],
        "example": "Wąskie gardło: pakowanie → bufor, redukcja przezbrojeń, sterowanie release upstream.",
        "nextSteps": ["Wygeneruj raport/prezentację", "Utwórz batch inicjatyw"]
      }
    }$$,
    'Shield',
    0,
    1,
    0,
    $$["operations","toc","throughput"]$$,
    204
  ),
  (
    'tool-known-decision-engine',
    'decision-engine',
    'decision-engine',
    'Decision Engine',
    'analysis',
    'operational',
    'Make trade-offs explicit with criteria, weights, and defensible decisions.',
    $${
      "en": "Make trade-offs explicit with criteria, weights, and defensible decisions.",
      "pl": "Uczyń trade-offy jawne przez kryteria, wagi i obronne decyzje."
    }$$,
    $${
      "en": {
        "shortDescription": "A lightweight decision framework for selecting options under constraints.",
        "whenToUse": "Use when many options compete for capacity and you need a defensible choice.",
        "whatYouGet": ["Criteria set", "Scored options", "Decision rationale"],
        "inputs": ["Options list", "Decision criteria", "Constraints", "Risks/assumptions"],
        "steps": ["Define criteria", "Weight criteria", "Score options", "Stress-test assumptions", "Select and document"],
        "outputs": ["Decision table", "Top picks", "Initiative-ready notes"],
        "commonMistakes": ["Too many criteria", "Hidden assumptions", "Scoring without evidence"],
        "example": "Choose 2 automation candidates using impact, effort, risk and dependency weights.",
        "nextSteps": ["Generate report/deck", "Create initiatives batch"]
      },
      "pl": {
        "shortDescription": "Lekki framework decyzyjny do wyboru opcji pod ograniczenia.",
        "whenToUse": "Gdy wiele opcji konkuruje o zasoby i trzeba obronić wybór.",
        "whatYouGet": ["Zestaw kryteriów", "Scoring opcji", "Uzasadnienie decyzji"],
        "inputs": ["Lista opcji", "Kryteria decyzji", "Ograniczenia", "Ryzyka/założenia"],
        "steps": ["Zdefiniuj kryteria", "Nadaj wagi", "Oceń opcje", "Przetestuj założenia", "Wybierz i udokumentuj"],
        "outputs": ["Tabela decyzji", "Top wybory", "Notatki pod inicjatywy"],
        "commonMistakes": ["Za dużo kryteriów", "Ukryte założenia", "Ocena bez evidence"],
        "example": "Wybór 2 kandydatów automatyzacji wg impact/effort/ryzyko/zależności.",
        "nextSteps": ["Wygeneruj raport/prezentację", "Utwórz batch inicjatyw"]
      }
    }$$,
    'GitBranch',
    0,
    1,
    0,
    $$["operations","decision","prioritization"]$$,
    205
  ),
  (
    'tool-known-control-tower',
    'control-tower',
    'control-tower',
    'Control Tower',
    'process',
    'operational',
    'Build an operational control tower: KPIs, thresholds, ownership, and cadence.',
    $${
      "en": "Build an operational control tower: KPIs, thresholds, ownership, and cadence.",
      "pl": "Zbuduj control tower: KPI, progi, ownership i rytm zarządzania."
    }$$,
    $${
      "en": {
        "shortDescription": "A practical blueprint for daily/weekly operational control.",
        "whenToUse": "Use when outcomes drift, firefighting dominates, or there is no clear cadence.",
        "whatYouGet": ["KPI set", "Thresholds and alerts", "Operating cadence"],
        "inputs": ["Goals", "Leading/lagging indicators", "Owners", "Escalation rules"],
        "steps": ["Define outcomes", "Pick KPIs", "Set thresholds", "Assign owners", "Set meeting cadence"],
        "outputs": ["Control tower spec", "KPI dictionary", "Initiative concepts"],
        "commonMistakes": ["Too many KPIs", "No owner", "No escalation rule"],
        "example": "OTIF control tower: daily board + threshold-based escalation + root-cause routine.",
        "nextSteps": ["Generate report/deck", "Create initiatives batch"]
      },
      "pl": {
        "shortDescription": "Praktyczny blueprint codziennego/tygodniowego sterowania operacjami.",
        "whenToUse": "Gdy wyniki dryfują, dominuje gaszenie pożarów, a brak rytmu zarządzania.",
        "whatYouGet": ["Zestaw KPI", "Progi i alerty", "Cadence spotkań"],
        "inputs": ["Cele", "Leading/lagging KPI", "Ownerzy", "Reguły eskalacji"],
        "steps": ["Zdefiniuj outcomes", "Wybierz KPI", "Ustal progi", "Przypisz ownerów", "Ustal rytm spotkań"],
        "outputs": ["Spec control tower", "Słownik KPI", "Koncepcje inicjatyw"],
        "commonMistakes": ["Za dużo KPI", "Brak ownera", "Brak reguł eskalacji"],
        "example": "OTIF: daily board + eskalacja po progach + rutyna root-cause.",
        "nextSteps": ["Wygeneruj raport/prezentację", "Utwórz batch inicjatyw"]
      }
    }$$,
    'Radar',
    0,
    1,
    0,
    $$["operations","kpi","governance"]$$,
    206
  ),
  (
    'tool-known-automation-pipeline',
    'automation-pipeline',
    'automation-pipeline',
    'Automation Pipeline',
    'process',
    'operational',
    'Create a repeatable pipeline for spotting, sizing, and delivering automation.',
    $${
      "en": "Create a repeatable pipeline for spotting, sizing, and delivering automation.",
      "pl": "Zbuduj powtarzalny pipeline wykrywania, sizingu i dostarczania automatyzacji."
    }$$,
    $${
      "en": {
        "shortDescription": "A funnel for automation: identify → qualify → prioritize → deliver.",
        "whenToUse": "Use when automation is ad-hoc and you need a predictable backlog and delivery.",
        "whatYouGet": ["Automation backlog", "Sizing rules", "Delivery checklist"],
        "inputs": ["Candidate processes", "Impact hypothesis", "Constraints and dependencies", "Risk/compliance notes"],
        "steps": ["Identify candidates", "Qualify (data/feasibility)", "Size impact/effort", "Prioritize", "Deliver and track"],
        "outputs": ["Pipeline board", "Top candidates", "Initiative concepts"],
        "commonMistakes": ["No qualification gate", "Sizing without baseline", "Ignoring change management"],
        "example": "Build a quarterly pipeline: 30 ideas → 10 qualified → 3 delivered with measurable savings.",
        "nextSteps": ["Generate report/deck", "Create initiatives batch"]
      },
      "pl": {
        "shortDescription": "Lejek automatyzacji: identyfikuj → kwalifikuj → priorytetyzuj → dowoź.",
        "whenToUse": "Gdy automatyzacja jest ad-hoc i potrzebujesz przewidywalnego backlogu i delivery.",
        "whatYouGet": ["Backlog automatyzacji", "Reguły sizingu", "Checklist delivery"],
        "inputs": ["Kandydaci procesów", "Hipoteza wpływu", "Ograniczenia i zależności", "Ryzyka/compliance"],
        "steps": ["Zidentyfikuj", "Zakwalifikuj (dane/wykonalność)", "Oszacuj impact/effort", "Ustal priorytety", "Dowiez i mierz"],
        "outputs": ["Board pipeline", "Top kandydaci", "Koncepcje inicjatyw"],
        "commonMistakes": ["Brak bramki kwalifikacji", "Sizing bez baseline", "Pomijanie change management"],
        "example": "Pipeline kwartalny: 30 pomysłów → 10 qualified → 3 dowiezione z mierzalnymi oszczędnościami.",
        "nextSteps": ["Wygeneruj raport/prezentację", "Utwórz batch inicjatyw"]
      }
    }$$,
    'Zap',
    0,
    1,
    0,
    $$["operations","automation","pipeline"]$$,
    207
  )
ON CONFLICT (id) DO NOTHING;

-- ==========================================
-- SEED: DIGITAL TOOLSET (10)
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
    'tool-known-robotics-feasibility',
    'robotics-feasibility',
    'robotics-feasibility',
    'Robotics Feasibility',
    'analysis',
    'digital',
    'Assess feasibility, prerequisites, and ROI for robotics in operations.',
    $${
      "en": "Assess feasibility, prerequisites, and ROI for robotics in operations.",
      "pl": "Oceń wykonalność, prerekwizyty i ROI robotyki w operacjach."
    }$$,
    $${
      "en": {
        "shortDescription": "Fast feasibility check for robotics: where it fits and what it takes.",
        "whenToUse": "Use when manual handling limits throughput, safety, or quality.",
        "whatYouGet": ["Feasibility score", "Prerequisites", "Quick wins vs bets"],
        "inputs": ["Task list", "Cycle time and variability", "Safety constraints", "CapEx/Opex assumptions"],
        "steps": ["Select candidates", "Check constraints", "Define cell concept", "Estimate impact", "Plan pilot"],
        "outputs": ["Feasibility notes", "Pilot plan", "Initiative concepts"],
        "commonMistakes": ["Ignoring variability", "No product mix view", "Underestimating integration"],
        "example": "Palletizing: stable SKUs + space available → pilot cell with safety fencing.",
        "nextSteps": ["Generate report/deck", "Create initiatives batch"]
      },
      "pl": {
        "shortDescription": "Szybka wykonalność robotyki: gdzie pasuje i czego wymaga.",
        "whenToUse": "Gdy manualne operacje ograniczają przepustowość, BHP lub jakość.",
        "whatYouGet": ["Feasibility score", "Prerekwizyty", "Quick wins vs zakłady"],
        "inputs": ["Lista zadań", "Czas cyklu i zmienność", "Ograniczenia BHP", "Założenia CapEx/Opex"],
        "steps": ["Wybierz kandydatów", "Sprawdź ograniczenia", "Zdefiniuj koncept celi", "Oszacuj wpływ", "Zaplanuj pilota"],
        "outputs": ["Notatki wykonalności", "Plan pilota", "Koncepcje inicjatyw"],
        "commonMistakes": ["Ignorowanie zmienności", "Brak spojrzenia na mix", "Niedoszacowanie integracji"],
        "example": "Paletyzacja: stabilne SKU + miejsce → pilot celi z wygrodzeniem.",
        "nextSteps": ["Wygeneruj raport/prezentację", "Utwórz batch inicjatyw"]
      }
    }$$,
    'Bot',
    0,
    1,
    0,
    $$["digital","robotics","automation"]$$,
    301
  ),
  (
    'tool-known-logistics-automation',
    'logistics-automation',
    'logistics-automation',
    'Logistics Automation',
    'analysis',
    'digital',
    'Identify automation opportunities across warehousing and logistics flows.',
    $${
      "en": "Identify automation opportunities across warehousing and logistics flows.",
      "pl": "Zidentyfikuj możliwości automatyzacji w magazynie i logistyce."
    }$$,
    $${
      "en": {
        "shortDescription": "Spot opportunities in inbound, storage, picking, packing and shipping.",
        "whenToUse": "Use when OTIF is unstable, travel time is high, or labor constraints appear.",
        "whatYouGet": ["Opportunity map", "Prerequisites", "Initiative concepts"],
        "inputs": ["Volumes and peaks", "Layouts", "Travel paths", "Service levels and constraints"],
        "steps": ["Map flows", "Find hotspots", "Pick solutions", "Estimate impact", "Define roadmap"],
        "outputs": ["Hotspot list", "Solution shortlist", "Quick wins vs bets"],
        "commonMistakes": ["No peak analysis", "Ignoring layout constraints", "No change management plan"],
        "example": "High pick travel → slotting redesign + pick-to-light + wave planning.",
        "nextSteps": ["Generate report/deck", "Create initiatives batch"]
      },
      "pl": {
        "shortDescription": "Wykryj okazje w inbound, składowaniu, kompletacji, pakowaniu i wysyłce.",
        "whenToUse": "Gdy OTIF jest niestabilny, rośnie travel time lub brakuje rąk do pracy.",
        "whatYouGet": ["Mapa okazji", "Prerekwizyty", "Koncepcje inicjatyw"],
        "inputs": ["Wolumeny i piki", "Layouty", "Ścieżki ruchu", "SLA i ograniczenia"],
        "steps": ["Zmapuj flow", "Znajdź hotspoty", "Dobierz rozwiązania", "Oszacuj wpływ", "Zdefiniuj roadmap"],
        "outputs": ["Lista hotspotów", "Shortlista rozwiązań", "Quick wins vs zakłady"],
        "commonMistakes": ["Brak analizy peaków", "Pomijanie ograniczeń layoutu", "Brak planu change"],
        "example": "Wysoki travel picking → slotting + pick-to-light + wave planning.",
        "nextSteps": ["Wygeneruj raport/prezentację", "Utwórz batch inicjatyw"]
      }
    }$$,
    'Truck',
    0,
    1,
    0,
    $$["digital","logistics","warehouse"]$$,
    302
  ),
  (
    'tool-known-rpa-scanner',
    'rpa-scanner',
    'rpa-scanner',
    'RPA Scanner',
    'analysis',
    'digital',
    'Scan processes for RPA suitability and build a prioritized automation backlog.',
    $${
      "en": "Scan processes for RPA suitability and build a prioritized automation backlog.",
      "pl": "Skanuj procesy pod RPA i zbuduj priorytetyzowany backlog automatyzacji."
    }$$,
    $${
      "en": {
        "shortDescription": "Find RPA-ready steps and quantify impact quickly.",
        "whenToUse": "Use when repetitive admin work consumes capacity or causes errors.",
        "whatYouGet": ["Candidate list", "Sizing fields", "Prioritized backlog"],
        "inputs": ["Process map", "Volumes", "Systems used", "Exception rate"],
        "steps": ["Identify repetitive steps", "Check rule-based fit", "Estimate savings", "Assess risk", "Prioritize"],
        "outputs": ["RPA shortlist", "Sizing sheet", "Initiative concepts"],
        "commonMistakes": ["Automating broken processes", "No exception handling plan", "Ignoring access/security"],
        "example": "Invoice matching: automate PO match + exception queue with owner.",
        "nextSteps": ["Generate report/deck", "Create initiatives batch"]
      },
      "pl": {
        "shortDescription": "Wykryj kroki gotowe pod RPA i szybko oszacuj wpływ.",
        "whenToUse": "Gdy powtarzalna praca administracyjna zjada capacity lub generuje błędy.",
        "whatYouGet": ["Lista kandydatów", "Pola sizingu", "Priorytetyzowany backlog"],
        "inputs": ["Mapa procesu", "Wolumeny", "Systemy", "Odsetek wyjątków"],
        "steps": ["Znajdź powtarzalne kroki", "Sprawdź fit (reguły)", "Oszacuj oszczędności", "Oceń ryzyko", "Ustal priorytety"],
        "outputs": ["Shortlista RPA", "Arkusz sizingu", "Koncepcje inicjatyw"],
        "commonMistakes": ["Automatyzowanie zepsutych procesów", "Brak obsługi wyjątków", "Pomijanie security/access"],
        "example": "Match faktur: automatyczny PO match + kolejka wyjątków z ownerem.",
        "nextSteps": ["Wygeneruj raport/prezentację", "Utwórz batch inicjatyw"]
      }
    }$$,
    'Scan',
    0,
    1,
    0,
    $$["digital","rpa","backoffice"]$$,
    303
  ),
  (
    'tool-known-ai-discovery',
    'ai-discovery',
    'ai-discovery',
    'AI Discovery',
    'analysis',
    'digital',
    'Identify AI use-cases, prerequisites, and risk controls to move from idea to pilot.',
    $${
      "en": "Identify AI use-cases, prerequisites, and risk controls to move from idea to pilot.",
      "pl": "Zidentyfikuj use-case’y AI, prerekwizyty i kontrolę ryzyk — od idei do pilota."
    }$$,
    $${
      "en": {
        "shortDescription": "A structured funnel for AI use-cases with feasibility and risk gates.",
        "whenToUse": "Use when AI hype exists but you need a realistic pilot-ready shortlist.",
        "whatYouGet": ["Use-case shortlist", "Prerequisites", "Pilot plan"],
        "inputs": ["Business pains", "Data sources", "Process owners", "Compliance constraints"],
        "steps": ["Define outcomes", "List candidate use-cases", "Check data fit", "Assess risks", "Plan pilot"],
        "outputs": ["Top use-cases", "Readiness gaps", "Initiative concepts"],
        "commonMistakes": ["No data ownership", "Ignoring model risk", "No success metric"],
        "example": "Service triage: define SLA metrics, gather labeled tickets, run pilot with human-in-the-loop.",
        "nextSteps": ["Generate report/deck", "Create initiatives batch"]
      },
      "pl": {
        "shortDescription": "Ustrukturyzowany lejek use-case’ów AI z bramkami wykonalności i ryzyk.",
        "whenToUse": "Gdy jest hype na AI, ale potrzebujesz shortlisty gotowej do pilota.",
        "whatYouGet": ["Shortlista use-case", "Prerekwizyty", "Plan pilota"],
        "inputs": ["Bóle biznesowe", "Źródła danych", "Ownerzy procesów", "Ograniczenia compliance"],
        "steps": ["Zdefiniuj outcomes", "Zbierz use-case", "Sprawdź data fit", "Oceń ryzyka", "Zaplanuj pilota"],
        "outputs": ["Top use-case", "Luki readiness", "Koncepcje inicjatyw"],
        "commonMistakes": ["Brak ownership danych", "Ignorowanie model risk", "Brak metryki sukcesu"],
        "example": "Triage zgłoszeń: SLA, etykiety, pilot z human-in-the-loop.",
        "nextSteps": ["Wygeneruj raport/prezentację", "Utwórz batch inicjatyw"]
      }
    }$$,
    'Sparkles',
    0,
    1,
    0,
    $$["digital","ai","use-cases"]$$,
    304
  ),
  (
    'tool-known-integration-diagnostic',
    'integration-diagnostic',
    'integration-diagnostic',
    'Integration Diagnostic',
    'analysis',
    'digital',
    'Diagnose integration pain points, dependencies, and quick wins across systems.',
    $${
      "en": "Diagnose integration pain points, dependencies, and quick wins across systems.",
      "pl": "Zdiagnozuj problemy integracji, zależności i quick wins między systemami."
    }$$,
    $${
      "en": {
        "shortDescription": "Find where integrations break, why, and what to fix first.",
        "whenToUse": "Use when data is inconsistent, manual rework exists, or lead time is driven by handoffs.",
        "whatYouGet": ["Dependency map", "Failure hotspots", "Roadmap candidates"],
        "inputs": ["System list", "Interfaces", "Data owners", "SLA and incidents"],
        "steps": ["Map integrations", "List failures", "Assess impact", "Define standards", "Prioritize fixes"],
        "outputs": ["Integration map", "Fix backlog", "Initiative concepts"],
        "commonMistakes": ["No ownership", "Ignoring data contracts", "Fixing symptoms only"],
        "example": "Order-to-cash: define data contract, add monitoring, remove CSV handoffs.",
        "nextSteps": ["Generate report/deck", "Create initiatives batch"]
      },
      "pl": {
        "shortDescription": "Wykryj, gdzie integracje się psują, dlaczego i co naprawić najpierw.",
        "whenToUse": "Gdy dane są niespójne, istnieje manual rework lub lead time wynika z handoffów.",
        "whatYouGet": ["Mapa zależności", "Hotspoty awarii", "Kandydaci roadmapy"],
        "inputs": ["Lista systemów", "Interfejsy", "Ownerzy danych", "SLA i incydenty"],
        "steps": ["Zmapuj integracje", "Zbierz awarie", "Oceń impact", "Ustal standardy", "Priorytetyzuj fixy"],
        "outputs": ["Mapa integracji", "Backlog fixów", "Koncepcje inicjatyw"],
        "commonMistakes": ["Brak ownership", "Pomijanie data contracts", "Leczenie objawów"],
        "example": "Order-to-cash: data contract, monitoring, eliminacja CSV handoffów.",
        "nextSteps": ["Wygeneruj raport/prezentację", "Utwórz batch inicjatyw"]
      }
    }$$,
    'Cable',
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
    'Create a value pool of digital opportunities and prioritize them into a roadmap.',
    $${
      "en": "Create a value pool of digital opportunities and prioritize them into a roadmap.",
      "pl": "Zbuduj pulę wartości inicjatyw digital i ułóż je w roadmapę."
    }$$,
    $${
      "en": {
        "shortDescription": "Translate opportunities into a quantified value pool and sequencing.",
        "whenToUse": "Use when planning transformation and you need an impact-based roadmap.",
        "whatYouGet": ["Value pool", "Sequenced roadmap", "Initiative concepts"],
        "inputs": ["Opportunity list", "Impact hypothesis", "Dependencies", "Constraints/capacity"],
        "steps": ["Normalize list", "Estimate impact", "Group themes", "Sequence by dependency", "Define initiatives"],
        "outputs": ["Value pool table", "Roadmap", "Quick wins vs bets"],
        "commonMistakes": ["Double-counting benefits", "No dependency view", "Ignoring adoption cost"],
        "example": "Roadmap: data foundation → integration reliability → AI use-cases.",
        "nextSteps": ["Generate report/deck", "Create initiatives batch"]
      },
      "pl": {
        "shortDescription": "Przełóż okazje na policzalną pulę wartości i sekwencję.",
        "whenToUse": "Gdy planujesz transformację i potrzebujesz roadmapy opartej o impact.",
        "whatYouGet": ["Value pool", "Roadmapa", "Koncepcje inicjatyw"],
        "inputs": ["Lista okazji", "Hipoteza wpływu", "Zależności", "Ograniczenia/zasoby"],
        "steps": ["Ujednolić listę", "Oszacuj impact", "Zgrupuj tematy", "Ułóż sekwencję", "Zdefiniuj inicjatywy"],
        "outputs": ["Tabela value pool", "Roadmapa", "Quick wins vs zakłady"],
        "commonMistakes": ["Podwójne liczenie korzyści", "Brak zależności", "Pomijanie kosztu adopcji"],
        "example": "Roadmapa: fundament danych → niezawodność integracji → use-case AI.",
        "nextSteps": ["Wygeneruj raport/prezentację", "Utwórz batch inicjatyw"]
      }
    }$$,
    'Coins',
    0,
    1,
    0,
    $$["digital","roadmap","value"]$$,
    306
  ),
  (
    'tool-known-legacy-analyzer',
    'legacy-analyzer',
    'legacy-analyzer',
    'Legacy Analyzer',
    'analysis',
    'digital',
    'Assess legacy systems risks, constraints, and modernization options.',
    $${
      "en": "Assess legacy systems risks, constraints, and modernization options.",
      "pl": "Oceń ryzyka, ograniczenia i opcje modernizacji systemów legacy."
    }$$,
    $${
      "en": {
        "shortDescription": "A pragmatic way to decide what to modernize, when, and how.",
        "whenToUse": "Use when delivery slows down due to legacy constraints or technical debt.",
        "whatYouGet": ["Constraint list", "Modernization options", "Roadmap candidates"],
        "inputs": ["System landscape", "Incidents", "Change lead time", "Dependency map"],
        "steps": ["Map constraints", "Assess risk", "Pick options", "Sequence", "Define initiatives"],
        "outputs": ["Legacy heatmap", "Option shortlist", "Initiative concepts"],
        "commonMistakes": ["Big-bang rewrites", "No risk control", "Ignoring integration dependencies"],
        "example": "Strangler pattern + API facade to reduce coupling and improve delivery speed.",
        "nextSteps": ["Generate report/deck", "Create initiatives batch"]
      },
      "pl": {
        "shortDescription": "Pragmatyczna decyzja: co modernizować, kiedy i jak.",
        "whenToUse": "Gdy delivery zwalnia przez legacy lub dług techniczny.",
        "whatYouGet": ["Lista ograniczeń", "Opcje modernizacji", "Kandydaci roadmapy"],
        "inputs": ["Krajobraz systemów", "Incydenty", "Lead time zmian", "Mapa zależności"],
        "steps": ["Zmapuj constraints", "Oceń ryzyko", "Wybierz opcje", "Ułóż sekwencję", "Zdefiniuj inicjatywy"],
        "outputs": ["Heatmapa legacy", "Shortlista opcji", "Koncepcje inicjatyw"],
        "commonMistakes": ["Big-bang rewrite", "Brak kontroli ryzyk", "Pomijanie zależności integracji"],
        "example": "Strangler pattern + API facade: mniej coupling, szybsze delivery.",
        "nextSteps": ["Wygeneruj raport/prezentację", "Utwórz batch inicjatyw"]
      }
    }$$,
    'Layers',
    0,
    1,
    0,
    $$["digital","legacy","architecture"]$$,
    307
  ),
  (
    'tool-known-data-inventory',
    'data-inventory',
    'data-inventory',
    'Data Inventory',
    'analysis',
    'digital',
    'Create a usable inventory of data sources, owners, quality and access constraints.',
    $${
      "en": "Create a usable inventory of data sources, owners, quality and access constraints.",
      "pl": "Stwórz inwentaryzację danych: źródła, ownerzy, jakość i ograniczenia dostępu."
    }$$,
    $${
      "en": {
        "shortDescription": "A practical data catalog starter focused on owners and fitness for use.",
        "whenToUse": "Use when AI/analytics projects stall due to unknown data ownership or quality.",
        "whatYouGet": ["Source list", "Ownership", "Quality gaps and actions"],
        "inputs": ["Systems list", "Key entities", "Access rules", "Quality issues"],
        "steps": ["List sources", "Assign owners", "Assess quality", "Define access", "Create backlog"],
        "outputs": ["Inventory table", "Gap list", "Initiative concepts"],
        "commonMistakes": ["Catalog without owners", "No quality criteria", "No access plan"],
        "example": "Customer entity: define master source, quality checks, and access policy.",
        "nextSteps": ["Generate report/deck", "Create initiatives batch"]
      },
      "pl": {
        "shortDescription": "Start katalogu danych z naciskiem na ownerów i przydatność.",
        "whenToUse": "Gdy projekty AI/analityki blokuje niejasny ownership danych lub jakość.",
        "whatYouGet": ["Lista źródeł", "Ownership", "Luki jakości i działania"],
        "inputs": ["Lista systemów", "Kluczowe encje", "Reguły dostępu", "Problemy jakości"],
        "steps": ["Zbierz źródła", "Przypisz ownerów", "Oceń jakość", "Ustal dostęp", "Zbuduj backlog"],
        "outputs": ["Tabela inventory", "Lista luk", "Koncepcje inicjatyw"],
        "commonMistakes": ["Katalog bez ownerów", "Brak kryteriów jakości", "Brak planu dostępu"],
        "example": "Encja klient: master source, quality checks, polityka dostępu.",
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
    'Pain → Solution',
    'analysis',
    'digital',
    'Translate pains into solution concepts with prerequisites, risks, and sequencing.',
    $${
      "en": "Translate pains into solution concepts with prerequisites, risks, and sequencing.",
      "pl": "Przełóż bóle na koncepcje rozwiązań z prerekwizytami, ryzykami i sekwencją."
    }$$,
    $${
      "en": {
        "shortDescription": "A bridge from pain points to implementable solution options.",
        "whenToUse": "Use after discovery interviews when you need to propose concrete solutions.",
        "whatYouGet": ["Solution options", "Prerequisites and risks", "Initiative concepts"],
        "inputs": ["Pain points", "Constraints", "Stakeholders", "Current systems"],
        "steps": ["Clarify pains", "Define desired outcomes", "Propose options", "Check feasibility", "Sequence"],
        "outputs": ["Option shortlist", "Readiness gaps", "Initiative concepts"],
        "commonMistakes": ["Jumping to tech", "No outcome metric", "Ignoring adoption"],
        "example": "Pain: late order confirmations → solution: integration + automated confirmations + monitoring.",
        "nextSteps": ["Generate report/deck", "Create initiatives batch"]
      },
      "pl": {
        "shortDescription": "Most od pain pointów do wdrażalnych opcji rozwiązań.",
        "whenToUse": "Po wywiadach discovery, gdy trzeba zaproponować konkretne rozwiązania.",
        "whatYouGet": ["Opcje rozwiązań", "Prerekwizyty i ryzyka", "Koncepcje inicjatyw"],
        "inputs": ["Pain pointy", "Ograniczenia", "Stakeholderzy", "Aktualne systemy"],
        "steps": ["Doprecyzuj bóle", "Zdefiniuj outcomes", "Zaproponuj opcje", "Sprawdź wykonalność", "Ułóż sekwencję"],
        "outputs": ["Shortlista opcji", "Luki readiness", "Koncepcje inicjatyw"],
        "commonMistakes": ["Skok do technologii", "Brak metryki outcome", "Ignorowanie adopcji"],
        "example": "Ból: spóźnione potwierdzenia → integracja + automatyczne potwierdzenia + monitoring.",
        "nextSteps": ["Wygeneruj raport/prezentację", "Utwórz batch inicjatyw"]
      }
    }$$,
    'ArrowRight',
    0,
    1,
    0,
    $$["digital","solutioning","discovery"]$$,
    309
  ),
  (
    'tool-known-pain-explorer',
    'pain-explorer',
    'pain-explorer',
    'Pain Explorer',
    'analysis',
    'digital',
    'Structure pains and map them to measurable outcomes, owners, and evidence.',
    $${
      "en": "Structure pains and map them to measurable outcomes, owners, and evidence.",
      "pl": "Ustrukturyzuj bóle i powiąż je z mierzalnymi outcome’ami, ownerami i evidence."
    }$$,
    $${
      "en": {
        "shortDescription": "Turn fuzzy complaints into a crisp problem statement with evidence.",
        "whenToUse": "Use early in discovery to align stakeholders on what really hurts and why.",
        "whatYouGet": ["Pain map", "Outcome metrics", "Discovery questions"],
        "inputs": ["Interview notes", "Process context", "Data signals", "Constraints"],
        "steps": ["Capture pains", "Group themes", "Link evidence", "Define outcomes", "Prioritize"],
        "outputs": ["Prioritized pains", "Outcome hypotheses", "Initiative hints"],
        "commonMistakes": ["Mixing symptoms and causes", "No evidence", "No owner"],
        "example": "Pain: rework in master data → outcome: reduce corrections by 60% with data stewardship.",
        "nextSteps": ["Generate report/deck", "Create initiatives batch"]
      },
      "pl": {
        "shortDescription": "Zamień ogólne narzekania w jasny problem z evidence.",
        "whenToUse": "Na początku discovery, aby uzgodnić, co naprawdę boli i dlaczego.",
        "whatYouGet": ["Mapa painów", "Metryki outcome", "Pytania discovery"],
        "inputs": ["Notatki z wywiadów", "Kontekst procesu", "Sygnały z danych", "Ograniczenia"],
        "steps": ["Zbierz bóle", "Zgrupuj tematy", "Podepnij evidence", "Zdefiniuj outcomes", "Ustal priorytety"],
        "outputs": ["Priorytety painów", "Hipotezy outcome", "Wskazówki inicjatyw"],
        "commonMistakes": ["Mieszanie objawów z przyczynami", "Brak evidence", "Brak ownera"],
        "example": "Ból: rework w danych podstawowych → outcome: -60% korekt przez stewardship.",
        "nextSteps": ["Wygeneruj raport/prezentację", "Utwórz batch inicjatyw"]
      }
    }$$,
    'Search',
    0,
    1,
    0,
    $$["digital","discovery","pain"]$$,
    310
  )
ON CONFLICT (id) DO NOTHING;

-- ==========================================
-- SEED: SPEED TOOL (process-automation)
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
    'tool-known-process-automation',
    'process-automation',
    'process-automation',
    'Process Automation (Speed Tool)',
    'process',
    'automation',
    'Canonical method to identify, map, measure, redesign and justify process automation.',
    $${
      "en": "Canonical method to identify, map, measure, redesign and justify process automation.",
      "pl": "Kanoniczna metoda identyfikacji, mapowania, pomiaru, redesignu i uzasadnienia automatyzacji procesu."
    }$$,
    $${
      "en": {
        "shortDescription": "A step-by-step wizard to move from process pain to ROI-backed automation initiatives.",
        "whenToUse": "Use when you need a fast, defensible automation business case and execution plan.",
        "whatYouGet": ["Process map", "Baseline vs target", "Economics and payback", "Initiative set"],
        "inputs": ["Process steps", "Volumes", "Cycle time/errors", "Cost assumptions", "Constraints/dependencies"],
        "steps": ["Identification", "Process mapping", "Measurement", "Redesign", "Re-estimation", "Economics", "Initiatives"],
        "outputs": ["Automation plan", "Savings model", "3–7 initiative concepts"],
        "commonMistakes": ["No baseline", "Optimizing a broken process", "Ignoring exceptions and controls"],
        "example": "AP automation: baseline 120h/week → target 60h/week; payback 4.5 months.",
        "nextSteps": ["Generate report/deck", "Create initiatives batch"]
      },
      "pl": {
        "shortDescription": "Wizard krok-po-kroku: od bólu procesu do inicjatyw automatyzacji z ROI.",
        "whenToUse": "Gdy potrzebujesz szybkiego, obronnego business case i planu realizacji automatyzacji.",
        "whatYouGet": ["Mapa procesu", "Baseline vs target", "Ekonomia i payback", "Zestaw inicjatyw"],
        "inputs": ["Kroki procesu", "Wolumeny", "Czas/błędy", "Założenia kosztów", "Ograniczenia/zależności"],
        "steps": ["Identyfikacja", "Mapowanie procesu", "Pomiar", "Redesign", "Re-estymacja", "Ekonomia", "Inicjatywy"],
        "outputs": ["Plan automatyzacji", "Model oszczędności", "3–7 koncepcji inicjatyw"],
        "commonMistakes": ["Brak baseline", "Optymalizacja zepsutego procesu", "Pomijanie wyjątków i kontroli"],
        "example": "Automatyzacja AP: baseline 120h/tydz. → target 60h/tydz.; payback 4,5 mies.",
        "nextSteps": ["Wygeneruj raport/prezentację", "Utwórz batch inicjatyw"]
      }
    }$$,
    'Zap',
    0,
    1,
    0,
    $$["automation","process","roi"]$$,
    401
  )
ON CONFLICT (id) DO NOTHING;

-- ==========================================
-- KB ARTICLES (How to use) for newly added tools
-- ==========================================

-- Guard (strict-schema repair, 2026-08): kb_articles/kb_article_translations
-- are created by 739_knowledge_base_public_articles.sql, a HIGHER-numbered
-- file that runs after this one. Same guard pattern as
-- 559_tools_known_tools_library.sql — see that file's comment for the full
-- rationale. Additive/idempotent: unchanged behavior wherever the tables
-- already exist.
DO $kb_seed_guard$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'kb_articles'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'kb_article_translations'
  ) THEN

INSERT INTO kb_articles (
  id, category_id, slug, status, is_featured, is_public, view_count, reading_time_minutes,
  thumbnail_url, video_url, video_teaser_url, related_modules, target_audience, created_at
) VALUES
  ('kb-art-tools-constraint-control', 'kb-cat-tools-features', 'tools-constraint-control-how-to', 'published', 0, 0, 0, 5, NULL, NULL, NULL, '["constraint-control"]', '["consultant","manager"]', NOW()),
  ('kb-art-tools-decision-engine', 'kb-cat-tools-features', 'tools-decision-engine-how-to', 'published', 0, 0, 0, 5, NULL, NULL, NULL, '["decision-engine"]', '["consultant","manager"]', NOW()),
  ('kb-art-tools-control-tower', 'kb-cat-tools-features', 'tools-control-tower-how-to', 'published', 0, 0, 0, 5, NULL, NULL, NULL, '["control-tower"]', '["consultant","manager"]', NOW()),
  ('kb-art-tools-automation-pipeline', 'kb-cat-tools-features', 'tools-automation-pipeline-how-to', 'published', 0, 0, 0, 5, NULL, NULL, NULL, '["automation-pipeline"]', '["consultant","manager"]', NOW()),
  ('kb-art-tools-robotics-feasibility', 'kb-cat-tools-features', 'tools-robotics-feasibility-how-to', 'published', 0, 0, 0, 5, NULL, NULL, NULL, '["robotics-feasibility"]', '["consultant","manager"]', NOW()),
  ('kb-art-tools-logistics-automation', 'kb-cat-tools-features', 'tools-logistics-automation-how-to', 'published', 0, 0, 0, 5, NULL, NULL, NULL, '["logistics-automation"]', '["consultant","manager"]', NOW()),
  ('kb-art-tools-rpa-scanner', 'kb-cat-tools-features', 'tools-rpa-scanner-how-to', 'published', 0, 0, 0, 5, NULL, NULL, NULL, '["rpa-scanner"]', '["consultant","manager"]', NOW()),
  ('kb-art-tools-ai-discovery', 'kb-cat-tools-features', 'tools-ai-discovery-how-to', 'published', 0, 0, 0, 5, NULL, NULL, NULL, '["ai-discovery"]', '["consultant","manager"]', NOW()),
  ('kb-art-tools-integration-diagnostic', 'kb-cat-tools-features', 'tools-integration-diagnostic-how-to', 'published', 0, 0, 0, 5, NULL, NULL, NULL, '["integration-diagnostic"]', '["consultant","manager"]', NOW()),
  ('kb-art-tools-digital-value-pool', 'kb-cat-tools-features', 'tools-digital-value-pool-how-to', 'published', 0, 0, 0, 5, NULL, NULL, NULL, '["digital-value-pool"]', '["consultant","manager"]', NOW()),
  ('kb-art-tools-legacy-analyzer', 'kb-cat-tools-features', 'tools-legacy-analyzer-how-to', 'published', 0, 0, 0, 5, NULL, NULL, NULL, '["legacy-analyzer"]', '["consultant","manager"]', NOW()),
  ('kb-art-tools-data-inventory', 'kb-cat-tools-features', 'tools-data-inventory-how-to', 'published', 0, 0, 0, 5, NULL, NULL, NULL, '["data-inventory"]', '["consultant","manager"]', NOW()),
  ('kb-art-tools-pain-to-solution', 'kb-cat-tools-features', 'tools-pain-to-solution-how-to', 'published', 0, 0, 0, 5, NULL, NULL, NULL, '["pain-to-solution"]', '["consultant","manager"]', NOW()),
  ('kb-art-tools-pain-explorer', 'kb-cat-tools-features', 'tools-pain-explorer-how-to', 'published', 0, 0, 0, 5, NULL, NULL, NULL, '["pain-explorer"]', '["consultant","manager"]', NOW()),
  ('kb-art-tools-process-automation', 'kb-cat-tools-features', 'tools-process-automation-how-to', 'published', 0, 0, 0, 6, NULL, NULL, NULL, '["process-automation"]', '["consultant","manager"]', NOW())
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  status = EXCLUDED.status,
  category_id = EXCLUDED.category_id,
  related_modules = EXCLUDED.related_modules,
  target_audience = EXCLUDED.target_audience,
  reading_time_minutes = EXCLUDED.reading_time_minutes;

INSERT INTO kb_article_translations (id, article_id, language, title, summary, content, video_script)
VALUES
  (
    'kb-art-trans-tools-constraint-control-en',
    'kb-art-tools-constraint-control',
    'en',
    'How to use: Constraint Control (TOC)',
    'A practical guide to using TOC to improve throughput and delivery reliability.',
    $$# Constraint Control (TOC) — How to use

## Purpose / when to use
Use this tool to find the system constraint (bottleneck) and improve flow without optimizing everything at once.

## Inputs
- Process steps and queues/WIP
- Throughput by step, downtime/changeovers
- Delivery goals (OTIF, lead time)

## Steps
1) Identify the constraint  
2) Protect it (buffers, priorities)  
3) Exploit it (standard work, changeover)  
4) Subordinate upstream/downstream rules  
5) Elevate (capacity) and repeat

## Outputs
- Constraint playbook + buffer policy
- Initiative shortlist

## Common mistakes
- Optimizing non-constraints
- No buffer discipline
- Measuring utilization instead of flow

## Next steps in Consultify
Generate a report/deck, then create an initiatives batch from the session.$$,
    NULL
  ),
  (
    'kb-art-trans-tools-constraint-control-pl',
    'kb-art-tools-constraint-control',
    'pl',
    'Jak używać: Constraint Control (TOC)',
    'Praktyczny przewodnik TOC: wąskie gardło, bufory i poprawa przepływu.',
    $$# Constraint Control (TOC) — Jak używać

## Purpose / kiedy używać
Użyj narzędzia, aby znaleźć wąskie gardło i poprawić flow bez „optymalizacji wszystkiego naraz”.

## Inputs
- Kroki procesu i kolejki/WIP
- Przepustowość per krok, przestoje/przezbrojenia
- Cele dostaw (OTIF, lead time)

## Steps
1) Zidentyfikuj constraint  
2) Chroń (bufory, priorytety)  
3) Wykorzystaj (standard work, przezbrojenia)  
4) Podporządkuj reguły upstream/downstream  
5) Podnieś capacity i powtórz cykl

## Outputs
- Playbook constraintu + polityka buforów
- Shortlista inicjatyw

## Common mistakes
- Optymalizacja nie-constraintów
- Brak dyscypliny buforów
- Mierzenie wykorzystania zamiast flow

## Next steps w Consultify
Wygeneruj raport/prezentację, a potem utwórz batch inicjatyw z sesji.$$,
    NULL
  ),
  (
    'kb-art-trans-tools-decision-engine-en',
    'kb-art-tools-decision-engine',
    'en',
    'How to use: Decision Engine',
    'Select options with criteria, weights and evidence.',
    $$# Decision Engine — How to use

## Purpose / when to use
Use when many options compete for capacity and you need a defensible choice.

## Inputs
- Options list
- Criteria + weights
- Constraints, risks and dependencies

## Steps
1) Define 4–7 criteria  
2) Set weights  
3) Score options with evidence  
4) Stress-test assumptions  
5) Document the decision and next actions

## Outputs
- Decision table + rationale
- Initiative-ready notes

## Common mistakes
- Too many criteria
- Hidden assumptions
- Scoring without evidence

## Next steps in Consultify
Generate a report/deck, then create an initiatives batch from the session.$$,
    NULL
  ),
  (
    'kb-art-trans-tools-decision-engine-pl',
    'kb-art-tools-decision-engine',
    'pl',
    'Jak używać: Decision Engine',
    'Wybór opcji przez kryteria, wagi i evidence.',
    $$# Decision Engine — Jak używać

## Purpose / kiedy używać
Gdy wiele opcji konkuruje o zasoby i trzeba obronić wybór.

## Inputs
- Lista opcji
- Kryteria + wagi
- Ograniczenia, ryzyka i zależności

## Steps
1) Zdefiniuj 4–7 kryteriów  
2) Ustal wagi  
3) Oceń opcje na bazie evidence  
4) Przetestuj założenia  
5) Udokumentuj decyzję i kolejne kroki

## Outputs
- Tabela decyzji + uzasadnienie
- Notatki pod inicjatywy

## Common mistakes
- Za dużo kryteriów
- Ukryte założenia
- Ocena bez evidence

## Next steps w Consultify
Wygeneruj raport/prezentację, a potem utwórz batch inicjatyw z sesji.$$,
    NULL
  ),
  (
    'kb-art-trans-tools-control-tower-en',
    'kb-art-tools-control-tower',
    'en',
    'How to use: Control Tower',
    'A guide to building KPI control with thresholds and cadence.',
    $$# Control Tower — How to use

## Purpose / when to use
Use when outcomes drift and firefighting dominates.

## Steps
1) Define outcomes  
2) Pick leading/lagging KPIs  
3) Set thresholds + escalation rules  
4) Assign owners  
5) Establish daily/weekly cadence

## Outputs
- KPI dictionary
- Control cadence and escalation

## Common mistakes
- Too many KPIs
- No owner
- No escalation rule

## Next steps in Consultify
Generate a report/deck, then create an initiatives batch from the session.$$,
    NULL
  ),
  (
    'kb-art-trans-tools-control-tower-pl',
    'kb-art-tools-control-tower',
    'pl',
    'Jak używać: Control Tower',
    'Jak zbudować KPI, progi, ownerów i rytm.',
    $$# Control Tower — Jak używać

## Purpose / kiedy używać
Gdy wyniki dryfują i dominuje gaszenie pożarów.

## Steps
1) Zdefiniuj outcomes  
2) Wybierz leading/lagging KPI  
3) Ustal progi + reguły eskalacji  
4) Przypisz ownerów  
5) Ustal rytm daily/weekly

## Outputs
- Słownik KPI
- Cadence + eskalacja

## Common mistakes
- Za dużo KPI
- Brak ownera
- Brak reguł eskalacji

## Next steps w Consultify
Wygeneruj raport/prezentację, a potem utwórz batch inicjatyw z sesji.$$,
    NULL
  ),
  (
    'kb-art-trans-tools-automation-pipeline-en',
    'kb-art-tools-automation-pipeline',
    'en',
    'How to use: Automation Pipeline',
    'Build a repeatable automation funnel and delivery checklist.',
    $$# Automation Pipeline — How to use

## Purpose / when to use
Use when automation is ad-hoc and you need a predictable backlog and delivery.

## Steps
1) Identify candidates  
2) Qualify (data/feasibility)  
3) Size impact/effort (baseline → target)  
4) Prioritize by constraints/dependencies  
5) Deliver and track benefits

## Outputs
- Automation backlog
- Delivery checklist

## Common mistakes
- No qualification gate
- Sizing without baseline
- Ignoring change management

## Next steps in Consultify
Generate a report/deck, then create an initiatives batch from the session.$$,
    NULL
  ),
  (
    'kb-art-trans-tools-automation-pipeline-pl',
    'kb-art-tools-automation-pipeline',
    'pl',
    'Jak używać: Automation Pipeline',
    'Powtarzalny lejek automatyzacji i checklist delivery.',
    $$# Automation Pipeline — Jak używać

## Purpose / kiedy używać
Gdy automatyzacja jest ad-hoc i potrzebujesz przewidywalnego backlogu i delivery.

## Steps
1) Zidentyfikuj kandydatów  
2) Zakwalifikuj (dane/wykonalność)  
3) Oszacuj impact/effort (baseline → target)  
4) Priorytetyzuj wg zależności/ograniczeń  
5) Dowiez i mierz korzyści

## Outputs
- Backlog automatyzacji
- Checklist delivery

## Common mistakes
- Brak bramki kwalifikacji
- Sizing bez baseline
- Pomijanie change management

## Next steps w Consultify
Wygeneruj raport/prezentację, a potem utwórz batch inicjatyw z sesji.$$,
    NULL
  ),
  (
    'kb-art-trans-tools-robotics-feasibility-en',
    'kb-art-tools-robotics-feasibility',
    'en',
    'How to use: Robotics Feasibility',
    'Quickly assess robotics fit, prerequisites and pilot plan.',
    $$# Robotics Feasibility — How to use

## Purpose / when to use
Use to decide whether robotics fits (variability, safety, integration) and what pilot to run.

## Steps
1) Pick candidate tasks  
2) Check variability + constraints  
3) Define cell concept  
4) Estimate baseline → target impact  
5) Plan a pilot

## Common mistakes
- Ignoring variability
- Underestimating integration effort

## Next steps in Consultify
Generate a report/deck, then create an initiatives batch from the session.$$,
    NULL
  ),
  (
    'kb-art-trans-tools-robotics-feasibility-pl',
    'kb-art-tools-robotics-feasibility',
    'pl',
    'Jak używać: Robotics Feasibility',
    'Szybko oceń fit robotyki, prerekwizyty i plan pilota.',
    $$# Robotics Feasibility — Jak używać

## Purpose / kiedy używać
Aby zdecydować, czy robotyka pasuje (zmienność, BHP, integracja) i jaki pilot uruchomić.

## Steps
1) Wybierz kandydatów  
2) Sprawdź zmienność i ograniczenia  
3) Zdefiniuj koncept celi  
4) Oszacuj baseline → target  
5) Zaplanuj pilota

## Common mistakes
- Ignorowanie zmienności
- Niedoszacowanie integracji

## Next steps w Consultify
Wygeneruj raport/prezentację, a potem utwórz batch inicjatyw z sesji.$$,
    NULL
  ),
  (
    'kb-art-trans-tools-logistics-automation-en',
    'kb-art-tools-logistics-automation',
    'en',
    'How to use: Logistics Automation',
    'Map flows, find hotspots and build a roadmap.',
    $$# Logistics Automation — How to use

## Steps
1) Map inbound/storage/pick/pack/ship  
2) Find hotspots (travel, queues, errors)  
3) Pick solution options  
4) Estimate impact and prerequisites  
5) Sequence into a roadmap

## Next steps in Consultify
Generate a report/deck, then create an initiatives batch from the session.$$,
    NULL
  ),
  (
    'kb-art-trans-tools-logistics-automation-pl',
    'kb-art-tools-logistics-automation',
    'pl',
    'Jak używać: Logistics Automation',
    'Zmapuj flow, znajdź hotspoty i zbuduj roadmapę.',
    $$# Logistics Automation — Jak używać

## Steps
1) Zmapuj inbound/storage/pick/pack/ship  
2) Znajdź hotspoty (travel, kolejki, błędy)  
3) Dobierz opcje rozwiązań  
4) Oszacuj impact i prerekwizyty  
5) Ułóż roadmapę

## Next steps w Consultify
Wygeneruj raport/prezentację, a potem utwórz batch inicjatyw z sesji.$$,
    NULL
  ),
  (
    'kb-art-trans-tools-rpa-scanner-en',
    'kb-art-tools-rpa-scanner',
    'en',
    'How to use: RPA Scanner',
    'Find RPA-ready steps and size impact.',
    $$# RPA Scanner — How to use

## Steps
1) Identify repetitive steps  
2) Check rule-based fit + exceptions  
3) Estimate baseline → target time  
4) Assess access/security  
5) Prioritize into a backlog

## Next steps in Consultify
Generate a report/deck, then create an initiatives batch from the session.$$,
    NULL
  ),
  (
    'kb-art-trans-tools-rpa-scanner-pl',
    'kb-art-tools-rpa-scanner',
    'pl',
    'Jak używać: RPA Scanner',
    'Wykryj kroki pod RPA i oszacuj wpływ.',
    $$# RPA Scanner — Jak używać

## Steps
1) Zidentyfikuj powtarzalne kroki  
2) Sprawdź fit reguł + wyjątki  
3) Oszacuj baseline → target czasu  
4) Oceń access/security  
5) Ułóż backlog

## Next steps w Consultify
Wygeneruj raport/prezentację, a potem utwórz batch inicjatyw z sesji.$$,
    NULL
  ),
  (
    'kb-art-trans-tools-ai-discovery-en',
    'kb-art-tools-ai-discovery',
    'en',
    'How to use: AI Discovery',
    'Move from AI ideas to pilot-ready use-cases.',
    $$# AI Discovery — How to use

## Steps
1) Define outcomes + success metrics  
2) List candidate use-cases  
3) Check data fit and ownership  
4) Assess risks/compliance  
5) Plan a pilot (human-in-the-loop)

## Next steps in Consultify
Generate a report/deck, then create an initiatives batch from the session.$$,
    NULL
  ),
  (
    'kb-art-trans-tools-ai-discovery-pl',
    'kb-art-tools-ai-discovery',
    'pl',
    'Jak używać: AI Discovery',
    'Od pomysłów AI do shortlisty gotowej do pilota.',
    $$# AI Discovery — Jak używać

## Steps
1) Zdefiniuj outcomes + metryki sukcesu  
2) Zbierz use-case’y  
3) Sprawdź data fit i ownership  
4) Oceń ryzyka/compliance  
5) Zaplanuj pilota (human-in-the-loop)

## Next steps w Consultify
Wygeneruj raport/prezentację, a potem utwórz batch inicjatyw z sesji.$$,
    NULL
  ),
  (
    'kb-art-trans-tools-integration-diagnostic-en',
    'kb-art-tools-integration-diagnostic',
    'en',
    'How to use: Integration Diagnostic',
    'Map dependencies and prioritize integration fixes.',
    $$# Integration Diagnostic — How to use

## Steps
1) Map interfaces and owners  
2) List failures and rework  
3) Define data contracts/standards  
4) Prioritize fixes by impact and dependency  
5) Add monitoring and controls

## Next steps in Consultify
Generate a report/deck, then create an initiatives batch from the session.$$,
    NULL
  ),
  (
    'kb-art-trans-tools-integration-diagnostic-pl',
    'kb-art-tools-integration-diagnostic',
    'pl',
    'Jak używać: Integration Diagnostic',
    'Mapa zależności i priorytetyzacja fixów integracji.',
    $$# Integration Diagnostic — Jak używać

## Steps
1) Zmapuj interfejsy i ownerów  
2) Zbierz awarie i rework  
3) Ustal data contracts/standardy  
4) Priorytetyzuj fixy wg impact/zależności  
5) Dodaj monitoring i kontrole

## Next steps w Consultify
Wygeneruj raport/prezentację, a potem utwórz batch inicjatyw z sesji.$$,
    NULL
  ),
  (
    'kb-art-trans-tools-digital-value-pool-en',
    'kb-art-tools-digital-value-pool',
    'en',
    'How to use: Digital Value Pool',
    'Quantify opportunities and sequence a roadmap.',
    $$# Digital Value Pool — How to use

## Steps
1) Normalize opportunity list  
2) Estimate impact hypothesis (baseline → target)  
3) Group into themes  
4) Sequence by dependency and capacity  
5) Translate into initiatives

## Next steps in Consultify
Generate a report/deck, then create an initiatives batch from the session.$$,
    NULL
  ),
  (
    'kb-art-trans-tools-digital-value-pool-pl',
    'kb-art-tools-digital-value-pool',
    'pl',
    'Jak używać: Digital Value Pool',
    'Policz okazje i ułóż roadmapę.',
    $$# Digital Value Pool — Jak używać

## Steps
1) Ujednolić listę okazji  
2) Oszacuj hipotezę wpływu (baseline → target)  
3) Zgrupuj w tematy  
4) Ułóż sekwencję wg zależności i capacity  
5) Przełóż na inicjatywy

## Next steps w Consultify
Wygeneruj raport/prezentację, a potem utwórz batch inicjatyw z sesji.$$,
    NULL
  ),
  (
    'kb-art-trans-tools-legacy-analyzer-en',
    'kb-art-tools-legacy-analyzer',
    'en',
    'How to use: Legacy Analyzer',
    'Assess legacy constraints and pick modernization options.',
    $$# Legacy Analyzer — How to use

## Steps
1) Map legacy constraints and incidents  
2) Assess delivery risk and cost of delay  
3) Pick modernization options (strangler, facade, replace)  
4) Sequence by dependency  
5) Define initiatives and controls

## Next steps in Consultify
Generate a report/deck, then create an initiatives batch from the session.$$,
    NULL
  ),
  (
    'kb-art-trans-tools-legacy-analyzer-pl',
    'kb-art-tools-legacy-analyzer',
    'pl',
    'Jak używać: Legacy Analyzer',
    'Oceń ograniczenia legacy i wybierz opcje modernizacji.',
    $$# Legacy Analyzer — Jak używać

## Steps
1) Zmapuj constraints i incydenty  
2) Oceń ryzyko delivery i koszt opóźnień  
3) Wybierz opcje (strangler, facade, replace)  
4) Ułóż sekwencję wg zależności  
5) Zdefiniuj inicjatywy i kontrole

## Next steps w Consultify
Wygeneruj raport/prezentację, a potem utwórz batch inicjatyw z sesji.$$,
    NULL
  ),
  (
    'kb-art-trans-tools-data-inventory-en',
    'kb-art-tools-data-inventory',
    'en',
    'How to use: Data Inventory',
    'Create owners-first data inventory and fix readiness gaps.',
    $$# Data Inventory — How to use

## Steps
1) List sources and key entities  
2) Assign owners/stewards  
3) Define quality criteria and checks  
4) Define access and security constraints  
5) Create a backlog of fixes

## Next steps in Consultify
Generate a report/deck, then create an initiatives batch from the session.$$,
    NULL
  ),
  (
    'kb-art-trans-tools-data-inventory-pl',
    'kb-art-tools-data-inventory',
    'pl',
    'Jak używać: Data Inventory',
    'Inwentaryzacja danych z ownership i działaniami.',
    $$# Data Inventory — Jak używać

## Steps
1) Zbierz źródła i encje  
2) Przypisz ownerów/stewardów  
3) Ustal kryteria jakości i testy  
4) Zdefiniuj dostęp i security  
5) Zbuduj backlog działań

## Next steps w Consultify
Wygeneruj raport/prezentację, a potem utwórz batch inicjatyw z sesji.$$,
    NULL
  ),
  (
    'kb-art-trans-tools-pain-to-solution-en',
    'kb-art-tools-pain-to-solution',
    'en',
    'How to use: Pain → Solution',
    'Translate pains into solution options with feasibility gates.',
    $$# Pain → Solution — How to use

## Steps
1) Clarify pains and who feels them  
2) Define outcomes and success metrics  
3) Propose solution options  
4) Check prerequisites and risks  
5) Sequence and define initiatives

## Next steps in Consultify
Generate a report/deck, then create an initiatives batch from the session.$$,
    NULL
  ),
  (
    'kb-art-trans-tools-pain-to-solution-pl',
    'kb-art-tools-pain-to-solution',
    'pl',
    'Jak używać: Pain → Solution',
    'Od bólu do opcji rozwiązań z bramkami wykonalności.',
    $$# Pain → Solution — Jak używać

## Steps
1) Doprecyzuj bóle i kto je odczuwa  
2) Zdefiniuj outcomes i metryki sukcesu  
3) Zaproponuj opcje rozwiązań  
4) Sprawdź prerekwizyty i ryzyka  
5) Ułóż sekwencję i zdefiniuj inicjatywy

## Next steps w Consultify
Wygeneruj raport/prezentację, a potem utwórz batch inicjatyw z sesji.$$,
    NULL
  ),
  (
    'kb-art-trans-tools-pain-explorer-en',
    'kb-art-tools-pain-explorer',
    'en',
    'How to use: Pain Explorer',
    'Structure pains into evidence-backed outcomes.',
    $$# Pain Explorer — How to use

## Steps
1) Capture pains from interviews and data  
2) Group into themes  
3) Link evidence and owners  
4) Define outcomes (baseline → target)  
5) Prioritize for discovery and delivery

## Next steps in Consultify
Generate a report/deck, then create an initiatives batch from the session.$$,
    NULL
  ),
  (
    'kb-art-trans-tools-pain-explorer-pl',
    'kb-art-tools-pain-explorer',
    'pl',
    'Jak używać: Pain Explorer',
    'Ustrukturyzuj bóle w outcome’y oparte o evidence.',
    $$# Pain Explorer — Jak używać

## Steps
1) Zbierz bóle z wywiadów i danych  
2) Zgrupuj w tematy  
3) Podepnij evidence i ownerów  
4) Zdefiniuj outcomes (baseline → target)  
5) Ustal priorytety discovery i delivery

## Next steps w Consultify
Wygeneruj raport/prezentację, a potem utwórz batch inicjatyw z sesji.$$,
    NULL
  ),
  (
    'kb-art-trans-tools-process-automation-en',
    'kb-art-tools-process-automation',
    'en',
    'How to use: Process Automation (Speed Tool)',
    'A canonical wizard: identify → map → measure → redesign → justify → initiatives.',
    $$# Process Automation (Speed Tool) — How to use

## Purpose / when to use
Use to create a defensible automation business case and an execution-ready initiative set.

## Steps
1) Identification (process + goal)  
2) Process mapping (steps/handoffs)  
3) Measurement (volume, baseline time/errors)  
4) Redesign (automation candidates + controls)  
5) Re-estimation (target time/errors)  
6) Economics (savings, payback)  
7) Initiatives (owners, dependencies, milestones)

## Common mistakes
- No baseline
- Optimizing a broken process
- Ignoring exceptions and controls

## Next steps in Consultify
Generate a report/deck, then create an initiatives batch from the session.$$,
    NULL
  ),
  (
    'kb-art-trans-tools-process-automation-pl',
    'kb-art-tools-process-automation',
    'pl',
    'Jak używać: Process Automation (Speed Tool)',
    'Wizard: identyfikacja → mapowanie → pomiar → redesign → ekonomia → inicjatywy.',
    $$# Process Automation (Speed Tool) — Jak używać

## Purpose / kiedy używać
Aby zbudować obronny business case automatyzacji i zestaw inicjatyw gotowych do realizacji.

## Steps
1) Identyfikacja (proces + cel)  
2) Mapowanie procesu (kroki/handoffy)  
3) Pomiar (wolumen, baseline czasu/błędów)  
4) Redesign (kandydaci automatyzacji + kontrole)  
5) Re-estymacja (target czasu/błędów)  
6) Ekonomia (oszczędności, payback)  
7) Inicjatywy (ownerzy, zależności, milestone’y)

## Common mistakes
- Brak baseline
- Optymalizacja zepsutego procesu
- Pomijanie wyjątków i kontroli

## Next steps w Consultify
Wygeneruj raport/prezentację, a potem utwórz batch inicjatyw z sesji.$$,
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

