-- Bundle 05+ (v3) — Tools: Seed missing Known Tools entries (6) + KB "How to use"
-- Adds the 6 consulting toolTypes that are in SSOT inventory but missing from registry:
-- Strategy: ambition-decomposer, focus-tradeoff, narrative-engine
-- Operations: smed-planner, dms-builder, inventory-autopilot
-- NOTE: These 6 tools are also included in migration 618 (which adds all 12 missing tools).
-- Both migrations use ON CONFLICT ... DO UPDATE so running both is safe and idempotent.

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
-- SEED: 6 MISSING KNOWN TOOLS (Library entries)
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
  (
    'tool-known-ambition-decomposer',
    'ambition-decomposer',
    'ambition-decomposer',
    'Ambition Decomposer',
    'analysis',
    'strategic',
    'Translate vision into measurable dimensions and initiative clusters.',
    $${
      "en": "Translate vision into measurable dimensions and initiative clusters.",
      "pl": "Przełóż wizję na mierzalne wymiary i klastry inicjatyw."
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
-- KNOWLEDGE BASE: "HOW TO USE" ARTICLE PER TOOL (6)
-- ==========================================

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

INSERT INTO kb_articles (
  id, category_id, slug, status, is_featured, is_public, view_count, reading_time_minutes,
  thumbnail_url, video_url, video_teaser_url, related_modules, target_audience, created_at
) VALUES
  ('kb-art-tools-ambition-decomposer', 'kb-cat-tools-features', 'tools-ambition-decomposer-how-to', 'published', 0, 0, 0, 5, NULL, NULL, NULL, '["ambition-decomposer"]', '["consultant","manager"]', NOW()),
  ('kb-art-tools-focus-tradeoff', 'kb-cat-tools-features', 'tools-focus-tradeoff-how-to', 'published', 0, 0, 0, 5, NULL, NULL, NULL, '["focus-tradeoff"]', '["consultant","manager"]', NOW()),
  ('kb-art-tools-narrative-engine', 'kb-cat-tools-features', 'tools-narrative-engine-how-to', 'published', 0, 0, 0, 5, NULL, NULL, NULL, '["narrative-engine"]', '["consultant","manager"]', NOW()),
  ('kb-art-tools-smed-planner', 'kb-cat-tools-features', 'tools-smed-planner-how-to', 'published', 0, 0, 0, 5, NULL, NULL, NULL, '["smed-planner"]', '["consultant","manager"]', NOW()),
  ('kb-art-tools-dms-builder', 'kb-cat-tools-features', 'tools-dms-builder-how-to', 'published', 0, 0, 0, 5, NULL, NULL, NULL, '["dms-builder"]', '["consultant","manager"]', NOW()),
  ('kb-art-tools-inventory-autopilot', 'kb-cat-tools-features', 'tools-inventory-autopilot-how-to', 'published', 0, 0, 0, 5, NULL, NULL, NULL, '["inventory-autopilot"]', '["consultant","manager"]', NOW())
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
  )
ON CONFLICT (article_id, language) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  content = EXCLUDED.content,
  video_script = EXCLUDED.video_script;

