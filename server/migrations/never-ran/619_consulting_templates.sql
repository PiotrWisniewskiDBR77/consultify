-- V3-E12: Consulting Templates Library (60 frameworks) — DB persistence
-- Migration: 619_consulting_templates.sql
-- Date: 2026-03-04
--
-- Previously in-memory only (consultingTemplatesRegistry.ts)
-- This migration creates the consulting_templates table and seeds all 60 frameworks.

-- ==========================================
-- CONSULTING TEMPLATES TABLE
-- ==========================================

CREATE TABLE IF NOT EXISTS consulting_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug VARCHAR(100) NOT NULL UNIQUE,
  name VARCHAR(200) NOT NULL,
  name_pl VARCHAR(200) NOT NULL,
  category VARCHAR(50) NOT NULL CHECK (category IN ('strategy', 'operations', 'digital_transformation')),
  archetype CHAR(1) NOT NULL CHECK (archetype IN ('A', 'B', 'C', 'D', 'E', 'F', 'G', 'H')),
  description TEXT NOT NULL DEFAULT '',
  description_pl TEXT NOT NULL DEFAULT '',
  tags_json TEXT NOT NULL DEFAULT '[]',
  output_mapping_json TEXT NOT NULL DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ==========================================
-- INDEXES
-- ==========================================

CREATE INDEX IF NOT EXISTS idx_consulting_templates_category ON consulting_templates(category);
CREATE INDEX IF NOT EXISTS idx_consulting_templates_archetype ON consulting_templates(archetype);

-- ==========================================
-- SEED: Strategy templates (20)
-- ==========================================

INSERT INTO consulting_templates (slug, name, name_pl, category, archetype, description, description_pl, tags_json, output_mapping_json, sort_order)
VALUES
  ('mece-issue-tree', 'MECE Issue Tree', 'Drzewo problemów MECE', 'strategy', 'D',
   'Decompose a complex problem into mutually exclusive, collectively exhaustive branches to ensure complete coverage.',
   'Dekompozycja złożonego problemu na wzajemnie wykluczające się, łącznie wyczerpujące gałęzie.',
   '["problem-solving","decomposition","analysis"]',
   '{"reportSections":["Problem Statement","Issue Branches","Key Findings"],"deckSlides":["Issue Tree Overview","Priority Branches"],"initiativeCategories":["analysis","strategy"]}',
   1)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name, name_pl = EXCLUDED.name_pl, category = EXCLUDED.category,
  archetype = EXCLUDED.archetype, description = EXCLUDED.description, description_pl = EXCLUDED.description_pl,
  tags_json = EXCLUDED.tags_json, output_mapping_json = EXCLUDED.output_mapping_json,
  sort_order = EXCLUDED.sort_order, updated_at = NOW();

INSERT INTO consulting_templates (slug, name, name_pl, category, archetype, description, description_pl, tags_json, output_mapping_json, sort_order)
VALUES
  ('hypothesis-driven-strategy', 'Hypothesis-Driven Strategy', 'Strategia oparta na hipotezach', 'strategy', 'D',
   'Structure strategic analysis around testable hypotheses with supporting/refuting evidence.',
   'Strukturyzacja analizy strategicznej wokół testowalnych hipotez z dowodami za i przeciw.',
   '["hypothesis","evidence","strategy"]',
   '{"reportSections":["Hypothesis Set","Evidence Matrix","Conclusions"],"deckSlides":["Hypothesis Overview","Evidence Summary"],"initiativeCategories":["strategy","validation"]}',
   2)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name, name_pl = EXCLUDED.name_pl, category = EXCLUDED.category,
  archetype = EXCLUDED.archetype, description = EXCLUDED.description, description_pl = EXCLUDED.description_pl,
  tags_json = EXCLUDED.tags_json, output_mapping_json = EXCLUDED.output_mapping_json,
  sort_order = EXCLUDED.sort_order, updated_at = NOW();

INSERT INTO consulting_templates (slug, name, name_pl, category, archetype, description, description_pl, tags_json, output_mapping_json, sort_order)
VALUES
  ('pyramid-principle', 'Pyramid Principle', 'Zasada piramidy', 'strategy', 'D',
   'Structure communication top-down: answer first, then supporting arguments grouped logically.',
   'Strukturyzacja komunikacji top-down: odpowiedź najpierw, potem argumenty pogrupowane logicznie.',
   '["communication","structure","storytelling"]',
   '{"reportSections":["Governing Thought","Key Arguments","Supporting Detail"],"deckSlides":["Executive Summary","Argument Flow"],"initiativeCategories":["communication","strategy"]}',
   3)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name, name_pl = EXCLUDED.name_pl, category = EXCLUDED.category,
  archetype = EXCLUDED.archetype, description = EXCLUDED.description, description_pl = EXCLUDED.description_pl,
  tags_json = EXCLUDED.tags_json, output_mapping_json = EXCLUDED.output_mapping_json,
  sort_order = EXCLUDED.sort_order, updated_at = NOW();

INSERT INTO consulting_templates (slug, name, name_pl, category, archetype, description, description_pl, tags_json, output_mapping_json, sort_order)
VALUES
  ('pestel', 'PESTEL Analysis', 'Analiza PESTEL', 'strategy', 'A',
   'Scan macro-environment across Political, Economic, Social, Technological, Environmental, and Legal factors.',
   'Skan makrootoczenia: czynniki polityczne, ekonomiczne, społeczne, technologiczne, środowiskowe i prawne.',
   '["macro","environment","scanning"]',
   '{"reportSections":["Factor Analysis","Impact Assessment","Strategic Implications"],"deckSlides":["PESTEL Dashboard","Top Factors"],"initiativeCategories":["strategy","risk"]}',
   4)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name, name_pl = EXCLUDED.name_pl, category = EXCLUDED.category,
  archetype = EXCLUDED.archetype, description = EXCLUDED.description, description_pl = EXCLUDED.description_pl,
  tags_json = EXCLUDED.tags_json, output_mapping_json = EXCLUDED.output_mapping_json,
  sort_order = EXCLUDED.sort_order, updated_at = NOW();

INSERT INTO consulting_templates (slug, name, name_pl, category, archetype, description, description_pl, tags_json, output_mapping_json, sort_order)
VALUES
  ('market-sizing-tam-sam-som', 'Market Sizing (TAM/SAM/SOM)', 'Sizing rynku (TAM/SAM/SOM)', 'strategy', 'H',
   'Estimate total, serviceable, and obtainable market sizes using top-down and bottom-up approaches.',
   'Szacowanie rynku całkowitego, adresowalnego i osiągalnego metodami top-down i bottom-up.',
   '["market","sizing","economics"]',
   '{"reportSections":["Market Definition","Sizing Methodology","TAM/SAM/SOM Estimates"],"deckSlides":["Market Funnel","Sizing Assumptions"],"initiativeCategories":["growth","market-entry"]}',
   5)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name, name_pl = EXCLUDED.name_pl, category = EXCLUDED.category,
  archetype = EXCLUDED.archetype, description = EXCLUDED.description, description_pl = EXCLUDED.description_pl,
  tags_json = EXCLUDED.tags_json, output_mapping_json = EXCLUDED.output_mapping_json,
  sort_order = EXCLUDED.sort_order, updated_at = NOW();

INSERT INTO consulting_templates (slug, name, name_pl, category, archetype, description, description_pl, tags_json, output_mapping_json, sort_order)
VALUES
  ('customer-segmentation', 'Customer Segmentation', 'Segmentacja klientów', 'strategy', 'C',
   'Divide customer base into actionable segments based on needs, value, and behavior.',
   'Podział bazy klientów na segmenty wg potrzeb, wartości i zachowań.',
   '["customers","segmentation","targeting"]',
   '{"reportSections":["Segmentation Criteria","Segment Profiles","Targeting Recommendations"],"deckSlides":["Segment Map","Priority Segments"],"initiativeCategories":["marketing","growth"]}',
   6)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name, name_pl = EXCLUDED.name_pl, category = EXCLUDED.category,
  archetype = EXCLUDED.archetype, description = EXCLUDED.description, description_pl = EXCLUDED.description_pl,
  tags_json = EXCLUDED.tags_json, output_mapping_json = EXCLUDED.output_mapping_json,
  sort_order = EXCLUDED.sort_order, updated_at = NOW();

INSERT INTO consulting_templates (slug, name, name_pl, category, archetype, description, description_pl, tags_json, output_mapping_json, sort_order)
VALUES
  ('jobs-to-be-done', 'Jobs To Be Done', 'Jobs To Be Done', 'strategy', 'A',
   'Identify the functional, emotional, and social jobs customers hire products to do.',
   'Identyfikacja funkcjonalnych, emocjonalnych i społecznych zadań, do których klienci „zatrudniają" produkty.',
   '["innovation","customer","needs"]',
   '{"reportSections":["Job Map","Unmet Needs","Opportunity Scoring"],"deckSlides":["JTBD Canvas","Opportunity Landscape"],"initiativeCategories":["innovation","product"]}',
   7)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name, name_pl = EXCLUDED.name_pl, category = EXCLUDED.category,
  archetype = EXCLUDED.archetype, description = EXCLUDED.description, description_pl = EXCLUDED.description_pl,
  tags_json = EXCLUDED.tags_json, output_mapping_json = EXCLUDED.output_mapping_json,
  sort_order = EXCLUDED.sort_order, updated_at = NOW();

INSERT INTO consulting_templates (slug, name, name_pl, category, archetype, description, description_pl, tags_json, output_mapping_json, sort_order)
VALUES
  ('competitive-benchmarking', 'Competitive Benchmarking', 'Benchmarking konkurencyjny', 'strategy', 'E',
   'Compare performance against competitors across key dimensions to identify gaps and advantages.',
   'Porównanie wyników z konkurencją w kluczowych wymiarach — identyfikacja luk i przewag.',
   '["competition","benchmarking","analysis"]',
   '{"reportSections":["Benchmark Dimensions","Competitor Profiles","Gap Analysis"],"deckSlides":["Benchmark Scorecard","Competitive Positioning"],"initiativeCategories":["strategy","improvement"]}',
   8)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name, name_pl = EXCLUDED.name_pl, category = EXCLUDED.category,
  archetype = EXCLUDED.archetype, description = EXCLUDED.description, description_pl = EXCLUDED.description_pl,
  tags_json = EXCLUDED.tags_json, output_mapping_json = EXCLUDED.output_mapping_json,
  sort_order = EXCLUDED.sort_order, updated_at = NOW();

INSERT INTO consulting_templates (slug, name, name_pl, category, archetype, description, description_pl, tags_json, output_mapping_json, sort_order)
VALUES
  ('porter-generic-strategies', 'Porter Generic Strategies', 'Strategie generyczne Portera', 'strategy', 'B',
   'Choose between cost leadership, differentiation, or focus as the basis for competitive advantage.',
   'Wybór między przywództwem kosztowym, różnicowaniem lub koncentracją jako bazą przewagi.',
   '["porter","competitive-advantage","positioning"]',
   '{"reportSections":["Strategic Options","Fit Assessment","Recommended Strategy"],"deckSlides":["Strategy Matrix","Fit Analysis"],"initiativeCategories":["strategy","positioning"]}',
   9)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name, name_pl = EXCLUDED.name_pl, category = EXCLUDED.category,
  archetype = EXCLUDED.archetype, description = EXCLUDED.description, description_pl = EXCLUDED.description_pl,
  tags_json = EXCLUDED.tags_json, output_mapping_json = EXCLUDED.output_mapping_json,
  sort_order = EXCLUDED.sort_order, updated_at = NOW();

INSERT INTO consulting_templates (slug, name, name_pl, category, archetype, description, description_pl, tags_json, output_mapping_json, sort_order)
VALUES
  ('strategic-positioning', 'Strategic Positioning', 'Pozycjonowanie strategiczne', 'strategy', 'B',
   'Define where to play and how to win by mapping competitive position on key dimensions.',
   'Określenie „gdzie grać" i „jak wygrać" przez mapowanie pozycji konkurencyjnej.',
   '["positioning","where-to-play","how-to-win"]',
   '{"reportSections":["Positioning Dimensions","Current vs Target Position","Strategic Moves"],"deckSlides":["Positioning Map","Strategic Choices"],"initiativeCategories":["strategy","growth"]}',
   10)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name, name_pl = EXCLUDED.name_pl, category = EXCLUDED.category,
  archetype = EXCLUDED.archetype, description = EXCLUDED.description, description_pl = EXCLUDED.description_pl,
  tags_json = EXCLUDED.tags_json, output_mapping_json = EXCLUDED.output_mapping_json,
  sort_order = EXCLUDED.sort_order, updated_at = NOW();

INSERT INTO consulting_templates (slug, name, name_pl, category, archetype, description, description_pl, tags_json, output_mapping_json, sort_order)
VALUES
  ('vrio', 'VRIO Analysis', 'Analiza VRIO', 'strategy', 'E',
   'Evaluate resources for Value, Rarity, Imitability, and Organization to identify sustainable advantages.',
   'Ocena zasobów pod kątem wartości, rzadkości, imitowalności i organizacji — trwałe przewagi.',
   '["resources","competitive-advantage","capabilities"]',
   '{"reportSections":["Resource Inventory","VRIO Assessment","Advantage Map"],"deckSlides":["VRIO Scorecard","Key Resources"],"initiativeCategories":["strategy","capabilities"]}',
   11)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name, name_pl = EXCLUDED.name_pl, category = EXCLUDED.category,
  archetype = EXCLUDED.archetype, description = EXCLUDED.description, description_pl = EXCLUDED.description_pl,
  tags_json = EXCLUDED.tags_json, output_mapping_json = EXCLUDED.output_mapping_json,
  sort_order = EXCLUDED.sort_order, updated_at = NOW();

INSERT INTO consulting_templates (slug, name, name_pl, category, archetype, description, description_pl, tags_json, output_mapping_json, sort_order)
VALUES
  ('core-competencies', 'Core Competencies', 'Kluczowe kompetencje', 'strategy', 'A',
   'Identify and leverage core competencies that provide access to markets, customer benefits, and are hard to imitate.',
   'Identyfikacja kluczowych kompetencji dających dostęp do rynków, korzyści klientom i trudnych do imitacji.',
   '["competencies","capabilities","advantage"]',
   '{"reportSections":["Competency Identification","Leverage Assessment","Development Plan"],"deckSlides":["Core Competency Map","Leverage Opportunities"],"initiativeCategories":["capabilities","strategy"]}',
   12)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name, name_pl = EXCLUDED.name_pl, category = EXCLUDED.category,
  archetype = EXCLUDED.archetype, description = EXCLUDED.description, description_pl = EXCLUDED.description_pl,
  tags_json = EXCLUDED.tags_json, output_mapping_json = EXCLUDED.output_mapping_json,
  sort_order = EXCLUDED.sort_order, updated_at = NOW();

INSERT INTO consulting_templates (slug, name, name_pl, category, archetype, description, description_pl, tags_json, output_mapping_json, sort_order)
VALUES
  ('blue-ocean-strategy', 'Blue Ocean Strategy', 'Strategia błękitnego oceanu', 'strategy', 'A',
   'Create uncontested market space by simultaneously pursuing differentiation and low cost.',
   'Tworzenie niekwestionowanej przestrzeni rynkowej przez jednoczesne różnicowanie i niski koszt.',
   '["innovation","market-creation","differentiation"]',
   '{"reportSections":["Strategy Canvas","Value Innovation","New Market Space"],"deckSlides":["Strategy Canvas Comparison","Blue Ocean Moves"],"initiativeCategories":["innovation","growth"]}',
   13)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name, name_pl = EXCLUDED.name_pl, category = EXCLUDED.category,
  archetype = EXCLUDED.archetype, description = EXCLUDED.description, description_pl = EXCLUDED.description_pl,
  tags_json = EXCLUDED.tags_json, output_mapping_json = EXCLUDED.output_mapping_json,
  sort_order = EXCLUDED.sort_order, updated_at = NOW();

INSERT INTO consulting_templates (slug, name, name_pl, category, archetype, description, description_pl, tags_json, output_mapping_json, sort_order)
VALUES
  ('errc-grid', 'ERRC Grid', 'Siatka ERRC', 'strategy', 'A',
   'Eliminate, Reduce, Raise, Create — four actions framework to reshape value curves.',
   'Eliminuj, Redukuj, Podnieś, Stwórz — cztery akcje do przebudowy krzywej wartości.',
   '["blue-ocean","value-curve","innovation"]',
   '{"reportSections":["Current Value Curve","ERRC Actions","New Value Curve"],"deckSlides":["ERRC Grid","Before/After Value Curve"],"initiativeCategories":["innovation","strategy"]}',
   14)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name, name_pl = EXCLUDED.name_pl, category = EXCLUDED.category,
  archetype = EXCLUDED.archetype, description = EXCLUDED.description, description_pl = EXCLUDED.description_pl,
  tags_json = EXCLUDED.tags_json, output_mapping_json = EXCLUDED.output_mapping_json,
  sort_order = EXCLUDED.sort_order, updated_at = NOW();

INSERT INTO consulting_templates (slug, name, name_pl, category, archetype, description, description_pl, tags_json, output_mapping_json, sort_order)
VALUES
  ('ge-mckinsey-9-box', 'GE-McKinsey 9-Box Matrix', 'Macierz GE-McKinsey 9-Box', 'strategy', 'C',
   'Prioritize business units or products on industry attractiveness vs competitive strength.',
   'Priorytetyzacja jednostek biznesowych wg atrakcyjności branży vs siły konkurencyjnej.',
   '["portfolio","prioritization","matrix"]',
   '{"reportSections":["Scoring Criteria","Unit Placement","Investment Recommendations"],"deckSlides":["9-Box Matrix","Investment Priorities"],"initiativeCategories":["portfolio","investment"]}',
   15)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name, name_pl = EXCLUDED.name_pl, category = EXCLUDED.category,
  archetype = EXCLUDED.archetype, description = EXCLUDED.description, description_pl = EXCLUDED.description_pl,
  tags_json = EXCLUDED.tags_json, output_mapping_json = EXCLUDED.output_mapping_json,
  sort_order = EXCLUDED.sort_order, updated_at = NOW();

INSERT INTO consulting_templates (slug, name, name_pl, category, archetype, description, description_pl, tags_json, output_mapping_json, sort_order)
VALUES
  ('experience-curve', 'Experience Curve', 'Krzywa doświadczenia', 'strategy', 'H',
   'Model how unit costs decline predictably with cumulative production volume.',
   'Modelowanie spadku kosztów jednostkowych wraz ze skumulowanym wolumenem produkcji.',
   '["cost","scale","economics"]',
   '{"reportSections":["Cost Baseline","Experience Rate","Competitive Implications"],"deckSlides":["Experience Curve Chart","Cost Position"],"initiativeCategories":["cost-reduction","operations"]}',
   16)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name, name_pl = EXCLUDED.name_pl, category = EXCLUDED.category,
  archetype = EXCLUDED.archetype, description = EXCLUDED.description, description_pl = EXCLUDED.description_pl,
  tags_json = EXCLUDED.tags_json, output_mapping_json = EXCLUDED.output_mapping_json,
  sort_order = EXCLUDED.sort_order, updated_at = NOW();

INSERT INTO consulting_templates (slug, name, name_pl, category, archetype, description, description_pl, tags_json, output_mapping_json, sort_order)
VALUES
  ('bcg-advantage-matrix', 'BCG Advantage Matrix', 'Macierz przewag BCG', 'strategy', 'B',
   'Classify industries by size of advantage and number of approaches to achieve it.',
   'Klasyfikacja branż wg wielkości przewagi i liczby sposobów jej osiągnięcia.',
   '["bcg","industry","advantage"]',
   '{"reportSections":["Industry Classification","Advantage Analysis","Strategic Implications"],"deckSlides":["Advantage Matrix","Industry Position"],"initiativeCategories":["strategy","positioning"]}',
   17)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name, name_pl = EXCLUDED.name_pl, category = EXCLUDED.category,
  archetype = EXCLUDED.archetype, description = EXCLUDED.description, description_pl = EXCLUDED.description_pl,
  tags_json = EXCLUDED.tags_json, output_mapping_json = EXCLUDED.output_mapping_json,
  sort_order = EXCLUDED.sort_order, updated_at = NOW();

INSERT INTO consulting_templates (slug, name, name_pl, category, archetype, description, description_pl, tags_json, output_mapping_json, sort_order)
VALUES
  ('three-horizons', 'Three Horizons', 'Trzy horyzonty', 'strategy', 'G',
   'Balance investment across core business (H1), emerging opportunities (H2), and future bets (H3).',
   'Balansowanie inwestycji: core business (H1), nowe szanse (H2), przyszłe zakłady (H3).',
   '["horizons","innovation","portfolio"]',
   '{"reportSections":["Horizon Classification","Investment Balance","Migration Plan"],"deckSlides":["Three Horizons View","Portfolio Balance"],"initiativeCategories":["innovation","portfolio"]}',
   18)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name, name_pl = EXCLUDED.name_pl, category = EXCLUDED.category,
  archetype = EXCLUDED.archetype, description = EXCLUDED.description, description_pl = EXCLUDED.description_pl,
  tags_json = EXCLUDED.tags_json, output_mapping_json = EXCLUDED.output_mapping_json,
  sort_order = EXCLUDED.sort_order, updated_at = NOW();

INSERT INTO consulting_templates (slug, name, name_pl, category, archetype, description, description_pl, tags_json, output_mapping_json, sort_order)
VALUES
  ('business-model-canvas', 'Business Model Canvas', 'Business Model Canvas', 'strategy', 'A',
   'Map the nine building blocks of a business model on a single canvas.',
   'Mapowanie dziewięciu elementów modelu biznesowego na jednym kanvasie.',
   '["business-model","canvas","design"]',
   '{"reportSections":["Canvas Overview","Block Analysis","Model Viability"],"deckSlides":["Business Model Canvas","Key Insights"],"initiativeCategories":["business-model","innovation"]}',
   19)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name, name_pl = EXCLUDED.name_pl, category = EXCLUDED.category,
  archetype = EXCLUDED.archetype, description = EXCLUDED.description, description_pl = EXCLUDED.description_pl,
  tags_json = EXCLUDED.tags_json, output_mapping_json = EXCLUDED.output_mapping_json,
  sort_order = EXCLUDED.sort_order, updated_at = NOW();

INSERT INTO consulting_templates (slug, name, name_pl, category, archetype, description, description_pl, tags_json, output_mapping_json, sort_order)
VALUES
  ('balanced-scorecard', 'Balanced Scorecard', 'Zrównoważona karta wyników', 'strategy', 'E',
   'Translate strategy into objectives and measures across Financial, Customer, Process, and Learning perspectives.',
   'Przełożenie strategii na cele i mierniki w perspektywach: finansowej, klienta, procesów i rozwoju.',
   '["scorecard","kpi","strategy-execution"]',
   '{"reportSections":["Strategy Map","Perspective Objectives","KPI Definitions"],"deckSlides":["Balanced Scorecard","Strategy Map"],"initiativeCategories":["strategy-execution","measurement"]}',
   20)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name, name_pl = EXCLUDED.name_pl, category = EXCLUDED.category,
  archetype = EXCLUDED.archetype, description = EXCLUDED.description, description_pl = EXCLUDED.description_pl,
  tags_json = EXCLUDED.tags_json, output_mapping_json = EXCLUDED.output_mapping_json,
  sort_order = EXCLUDED.sort_order, updated_at = NOW();

-- ==========================================
-- SEED: Operations templates (20)
-- ==========================================

INSERT INTO consulting_templates (slug, name, name_pl, category, archetype, description, description_pl, tags_json, output_mapping_json, sort_order)
VALUES
  ('value-stream-mapping-vsm', 'Value Stream Mapping (VSM)', 'Mapowanie strumienia wartości (VSM)', 'operations', 'F',
   'Visualize end-to-end material and information flow to identify waste and improvement opportunities.',
   'Wizualizacja przepływu materiałów i informacji end-to-end — identyfikacja marnotrawstw.',
   '["lean","flow","waste"]',
   '{"reportSections":["Current State Map","Waste Identification","Future State Design"],"deckSlides":["VSM Current vs Future","Improvement Priorities"],"initiativeCategories":["lean","process-improvement"]}',
   21)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name, name_pl = EXCLUDED.name_pl, category = EXCLUDED.category,
  archetype = EXCLUDED.archetype, description = EXCLUDED.description, description_pl = EXCLUDED.description_pl,
  tags_json = EXCLUDED.tags_json, output_mapping_json = EXCLUDED.output_mapping_json,
  sort_order = EXCLUDED.sort_order, updated_at = NOW();

INSERT INTO consulting_templates (slug, name, name_pl, category, archetype, description, description_pl, tags_json, output_mapping_json, sort_order)
VALUES
  ('sipoc', 'SIPOC', 'SIPOC', 'operations', 'F',
   'Define process scope through Suppliers, Inputs, Process, Outputs, and Customers.',
   'Definicja zakresu procesu: Dostawcy, Wejścia, Proces, Wyjścia, Klienci.',
   '["process","scope","six-sigma"]',
   '{"reportSections":["SIPOC Diagram","Boundary Definition","Stakeholder Map"],"deckSlides":["SIPOC Overview","Process Boundaries"],"initiativeCategories":["process-improvement","quality"]}',
   22)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name, name_pl = EXCLUDED.name_pl, category = EXCLUDED.category,
  archetype = EXCLUDED.archetype, description = EXCLUDED.description, description_pl = EXCLUDED.description_pl,
  tags_json = EXCLUDED.tags_json, output_mapping_json = EXCLUDED.output_mapping_json,
  sort_order = EXCLUDED.sort_order, updated_at = NOW();

INSERT INTO consulting_templates (slug, name, name_pl, category, archetype, description, description_pl, tags_json, output_mapping_json, sort_order)
VALUES
  ('dmaic', 'DMAIC', 'DMAIC', 'operations', 'G',
   'Define-Measure-Analyze-Improve-Control cycle for data-driven process improvement.',
   'Cykl Define-Measure-Analyze-Improve-Control do doskonalenia procesów opartego na danych.',
   '["six-sigma","improvement","data-driven"]',
   '{"reportSections":["Problem Definition","Measurement Plan","Root Cause Analysis","Improvement Actions"],"deckSlides":["DMAIC Phases","Results Summary"],"initiativeCategories":["quality","process-improvement"]}',
   23)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name, name_pl = EXCLUDED.name_pl, category = EXCLUDED.category,
  archetype = EXCLUDED.archetype, description = EXCLUDED.description, description_pl = EXCLUDED.description_pl,
  tags_json = EXCLUDED.tags_json, output_mapping_json = EXCLUDED.output_mapping_json,
  sort_order = EXCLUDED.sort_order, updated_at = NOW();

INSERT INTO consulting_templates (slug, name, name_pl, category, archetype, description, description_pl, tags_json, output_mapping_json, sort_order)
VALUES
  ('kaizen-pdca', 'Kaizen / PDCA', 'Kaizen / PDCA', 'operations', 'G',
   'Plan-Do-Check-Act continuous improvement cycle for incremental operational gains.',
   'Cykl Plan-Do-Check-Act ciągłego doskonalenia dla przyrostowych usprawnień operacyjnych.',
   '["kaizen","continuous-improvement","pdca"]',
   '{"reportSections":["Current Condition","Target Condition","Action Plan"],"deckSlides":["PDCA Cycle","Improvement Results"],"initiativeCategories":["continuous-improvement","lean"]}',
   24)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name, name_pl = EXCLUDED.name_pl, category = EXCLUDED.category,
  archetype = EXCLUDED.archetype, description = EXCLUDED.description, description_pl = EXCLUDED.description_pl,
  tags_json = EXCLUDED.tags_json, output_mapping_json = EXCLUDED.output_mapping_json,
  sort_order = EXCLUDED.sort_order, updated_at = NOW();

INSERT INTO consulting_templates (slug, name, name_pl, category, archetype, description, description_pl, tags_json, output_mapping_json, sort_order)
VALUES
  ('gemba-walk', 'Gemba Walk', 'Gemba Walk', 'operations', 'F',
   'Structured observation at the place where work happens to identify waste and improvement ideas.',
   'Strukturyzowana obserwacja w miejscu pracy — identyfikacja marnotrawstw i pomysłów na usprawnienia.',
   '["lean","observation","gemba"]',
   '{"reportSections":["Observation Log","Findings Summary","Action Items"],"deckSlides":["Gemba Findings","Quick Wins"],"initiativeCategories":["lean","engagement"]}',
   25)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name, name_pl = EXCLUDED.name_pl, category = EXCLUDED.category,
  archetype = EXCLUDED.archetype, description = EXCLUDED.description, description_pl = EXCLUDED.description_pl,
  tags_json = EXCLUDED.tags_json, output_mapping_json = EXCLUDED.output_mapping_json,
  sort_order = EXCLUDED.sort_order, updated_at = NOW();

INSERT INTO consulting_templates (slug, name, name_pl, category, archetype, description, description_pl, tags_json, output_mapping_json, sort_order)
VALUES
  ('standard-work', 'Standard Work', 'Praca standardowa', 'operations', 'F',
   'Document the current best-known method for performing a task to ensure consistency and enable improvement.',
   'Dokumentacja najlepszej znanej metody wykonania zadania — powtarzalność i baza do usprawnień.',
   '["lean","standardization","sop"]',
   '{"reportSections":["Work Sequence","Takt Time Analysis","Standard Work Sheet"],"deckSlides":["Standard Work Overview","Cycle Time Comparison"],"initiativeCategories":["standardization","quality"]}',
   26)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name, name_pl = EXCLUDED.name_pl, category = EXCLUDED.category,
  archetype = EXCLUDED.archetype, description = EXCLUDED.description, description_pl = EXCLUDED.description_pl,
  tags_json = EXCLUDED.tags_json, output_mapping_json = EXCLUDED.output_mapping_json,
  sort_order = EXCLUDED.sort_order, updated_at = NOW();

INSERT INTO consulting_templates (slug, name, name_pl, category, archetype, description, description_pl, tags_json, output_mapping_json, sort_order)
VALUES
  ('5s', '5S Workplace Organization', '5S Organizacja stanowiska pracy', 'operations', 'A',
   'Sort, Set in Order, Shine, Standardize, Sustain — workplace organization methodology.',
   'Selekcja, Systematyka, Sprzątanie, Standaryzacja, Samodyscyplina — metodologia organizacji.',
   '["lean","5s","workplace"]',
   '{"reportSections":["Current State Audit","5S Action Plan","Sustain Checklist"],"deckSlides":["5S Assessment","Before/After"],"initiativeCategories":["lean","workplace"]}',
   27)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name, name_pl = EXCLUDED.name_pl, category = EXCLUDED.category,
  archetype = EXCLUDED.archetype, description = EXCLUDED.description, description_pl = EXCLUDED.description_pl,
  tags_json = EXCLUDED.tags_json, output_mapping_json = EXCLUDED.output_mapping_json,
  sort_order = EXCLUDED.sort_order, updated_at = NOW();

INSERT INTO consulting_templates (slug, name, name_pl, category, archetype, description, description_pl, tags_json, output_mapping_json, sort_order)
VALUES
  ('root-cause-5whys-fishbone', 'Root Cause (5 Whys / Fishbone)', 'Analiza przyczyn źródłowych (5 Why / Ishikawa)', 'operations', 'D',
   'Drill to root causes using 5 Whys and Ishikawa diagrams to prevent recurrence.',
   'Dotarcie do przyczyn źródłowych metodą 5 Why i diagramem Ishikawy — zapobieganie nawrotom.',
   '["root-cause","problem-solving","quality"]',
   '{"reportSections":["Problem Statement","Cause Analysis","Countermeasures"],"deckSlides":["Fishbone Diagram","Root Cause Summary"],"initiativeCategories":["quality","problem-solving"]}',
   28)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name, name_pl = EXCLUDED.name_pl, category = EXCLUDED.category,
  archetype = EXCLUDED.archetype, description = EXCLUDED.description, description_pl = EXCLUDED.description_pl,
  tags_json = EXCLUDED.tags_json, output_mapping_json = EXCLUDED.output_mapping_json,
  sort_order = EXCLUDED.sort_order, updated_at = NOW();

INSERT INTO consulting_templates (slug, name, name_pl, category, archetype, description, description_pl, tags_json, output_mapping_json, sort_order)
VALUES
  ('kanban-wip-limits', 'Kanban & WIP Limits', 'Kanban i limity WIP', 'operations', 'F',
   'Visualize workflow, limit work-in-progress, and manage flow to improve lead time.',
   'Wizualizacja przepływu pracy, limitowanie WIP i zarządzanie flow — poprawa lead time.',
   '["kanban","flow","wip"]',
   '{"reportSections":["Board Design","WIP Policy","Flow Metrics"],"deckSlides":["Kanban Board","Flow Improvement"],"initiativeCategories":["agile","flow"]}',
   29)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name, name_pl = EXCLUDED.name_pl, category = EXCLUDED.category,
  archetype = EXCLUDED.archetype, description = EXCLUDED.description, description_pl = EXCLUDED.description_pl,
  tags_json = EXCLUDED.tags_json, output_mapping_json = EXCLUDED.output_mapping_json,
  sort_order = EXCLUDED.sort_order, updated_at = NOW();

INSERT INTO consulting_templates (slug, name, name_pl, category, archetype, description, description_pl, tags_json, output_mapping_json, sort_order)
VALUES
  ('bottleneck-analysis-toc', 'Bottleneck Analysis (TOC)', 'Analiza wąskich gardeł (TOC)', 'operations', 'F',
   'Identify and exploit the system constraint using Theory of Constraints principles.',
   'Identyfikacja i eksploatacja ograniczenia systemowego wg Teorii Ograniczeń.',
   '["toc","bottleneck","throughput"]',
   '{"reportSections":["Constraint Identification","Exploitation Plan","Subordination Rules"],"deckSlides":["Constraint Map","Throughput Impact"],"initiativeCategories":["throughput","operations"]}',
   30)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name, name_pl = EXCLUDED.name_pl, category = EXCLUDED.category,
  archetype = EXCLUDED.archetype, description = EXCLUDED.description, description_pl = EXCLUDED.description_pl,
  tags_json = EXCLUDED.tags_json, output_mapping_json = EXCLUDED.output_mapping_json,
  sort_order = EXCLUDED.sort_order, updated_at = NOW();

INSERT INTO consulting_templates (slug, name, name_pl, category, archetype, description, description_pl, tags_json, output_mapping_json, sort_order)
VALUES
  ('smed', 'SMED (Single-Minute Exchange of Die)', 'SMED (przezbrojenie w jednocyfrowej liczbie minut)', 'operations', 'F',
   'Reduce changeover time by converting internal setup to external and streamlining steps.',
   'Redukcja czasu przezbrojenia przez konwersję czynności wewnętrznych na zewnętrzne.',
   '["smed","changeover","lean"]',
   '{"reportSections":["Step Classification","Conversion Plan","Time Reduction Estimate"],"deckSlides":["SMED Analysis","Before/After Timeline"],"initiativeCategories":["lean","efficiency"]}',
   31)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name, name_pl = EXCLUDED.name_pl, category = EXCLUDED.category,
  archetype = EXCLUDED.archetype, description = EXCLUDED.description, description_pl = EXCLUDED.description_pl,
  tags_json = EXCLUDED.tags_json, output_mapping_json = EXCLUDED.output_mapping_json,
  sort_order = EXCLUDED.sort_order, updated_at = NOW();

INSERT INTO consulting_templates (slug, name, name_pl, category, archetype, description, description_pl, tags_json, output_mapping_json, sort_order)
VALUES
  ('oee', 'OEE (Overall Equipment Effectiveness)', 'OEE (Całkowita efektywność wyposażenia)', 'operations', 'E',
   'Measure equipment effectiveness through Availability × Performance × Quality.',
   'Pomiar efektywności wyposażenia: Dostępność × Wydajność × Jakość.',
   '["oee","equipment","manufacturing"]',
   '{"reportSections":["OEE Breakdown","Loss Categories","Improvement Priorities"],"deckSlides":["OEE Dashboard","Loss Waterfall"],"initiativeCategories":["maintenance","efficiency"]}',
   32)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name, name_pl = EXCLUDED.name_pl, category = EXCLUDED.category,
  archetype = EXCLUDED.archetype, description = EXCLUDED.description, description_pl = EXCLUDED.description_pl,
  tags_json = EXCLUDED.tags_json, output_mapping_json = EXCLUDED.output_mapping_json,
  sort_order = EXCLUDED.sort_order, updated_at = NOW();

INSERT INTO consulting_templates (slug, name, name_pl, category, archetype, description, description_pl, tags_json, output_mapping_json, sort_order)
VALUES
  ('tpm', 'TPM (Total Productive Maintenance)', 'TPM (Totalne utrzymanie ruchu)', 'operations', 'A',
   'Engage all employees in proactive equipment maintenance to eliminate breakdowns and defects.',
   'Zaangażowanie wszystkich pracowników w proaktywne utrzymanie ruchu — eliminacja awarii i defektów.',
   '["tpm","maintenance","reliability"]',
   '{"reportSections":["Pillar Assessment","Loss Structure","Implementation Roadmap"],"deckSlides":["TPM Pillars","Loss Reduction Plan"],"initiativeCategories":["maintenance","reliability"]}',
   33)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name, name_pl = EXCLUDED.name_pl, category = EXCLUDED.category,
  archetype = EXCLUDED.archetype, description = EXCLUDED.description, description_pl = EXCLUDED.description_pl,
  tags_json = EXCLUDED.tags_json, output_mapping_json = EXCLUDED.output_mapping_json,
  sort_order = EXCLUDED.sort_order, updated_at = NOW();

INSERT INTO consulting_templates (slug, name, name_pl, category, archetype, description, description_pl, tags_json, output_mapping_json, sort_order)
VALUES
  ('spc-control-charts', 'SPC Control Charts', 'Karty kontrolne SPC', 'operations', 'E',
   'Monitor process stability using statistical control charts to distinguish common from special cause variation.',
   'Monitorowanie stabilności procesu kartami kontrolnymi — rozróżnienie przyczyn zwykłych od specjalnych.',
   '["spc","quality","statistics"]',
   '{"reportSections":["Control Chart Setup","Stability Analysis","Out-of-Control Actions"],"deckSlides":["Control Chart Summary","Process Stability"],"initiativeCategories":["quality","measurement"]}',
   34)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name, name_pl = EXCLUDED.name_pl, category = EXCLUDED.category,
  archetype = EXCLUDED.archetype, description = EXCLUDED.description, description_pl = EXCLUDED.description_pl,
  tags_json = EXCLUDED.tags_json, output_mapping_json = EXCLUDED.output_mapping_json,
  sort_order = EXCLUDED.sort_order, updated_at = NOW();

INSERT INTO consulting_templates (slug, name, name_pl, category, archetype, description, description_pl, tags_json, output_mapping_json, sort_order)
VALUES
  ('process-capability-cpk', 'Process Capability (Cpk)', 'Zdolność procesu (Cpk)', 'operations', 'E',
   'Quantify how well a process meets specification limits using Cp and Cpk indices.',
   'Kwantyfikacja zdolności procesu do spełnienia limitów specyfikacji wskaźnikami Cp i Cpk.',
   '["capability","quality","six-sigma"]',
   '{"reportSections":["Specification Limits","Capability Indices","Improvement Targets"],"deckSlides":["Capability Summary","Distribution Chart"],"initiativeCategories":["quality","process-improvement"]}',
   35)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name, name_pl = EXCLUDED.name_pl, category = EXCLUDED.category,
  archetype = EXCLUDED.archetype, description = EXCLUDED.description, description_pl = EXCLUDED.description_pl,
  tags_json = EXCLUDED.tags_json, output_mapping_json = EXCLUDED.output_mapping_json,
  sort_order = EXCLUDED.sort_order, updated_at = NOW();

INSERT INTO consulting_templates (slug, name, name_pl, category, archetype, description, description_pl, tags_json, output_mapping_json, sort_order)
VALUES
  ('fmea', 'FMEA (Failure Mode & Effects Analysis)', 'FMEA (Analiza przyczyn i skutków wad)', 'operations', 'E',
   'Systematically identify potential failure modes, assess risk, and prioritize preventive actions.',
   'Systematyczna identyfikacja potencjalnych wad, ocena ryzyka i priorytetyzacja działań zapobiegawczych.',
   '["fmea","risk","quality"]',
   '{"reportSections":["Failure Mode Inventory","RPN Scoring","Mitigation Plan"],"deckSlides":["FMEA Risk Matrix","Top Risks & Actions"],"initiativeCategories":["quality","risk"]}',
   36)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name, name_pl = EXCLUDED.name_pl, category = EXCLUDED.category,
  archetype = EXCLUDED.archetype, description = EXCLUDED.description, description_pl = EXCLUDED.description_pl,
  tags_json = EXCLUDED.tags_json, output_mapping_json = EXCLUDED.output_mapping_json,
  sort_order = EXCLUDED.sort_order, updated_at = NOW();

INSERT INTO consulting_templates (slug, name, name_pl, category, archetype, description, description_pl, tags_json, output_mapping_json, sort_order)
VALUES
  ('abc-xyz-inventory', 'ABC-XYZ Inventory Analysis', 'Analiza zapasów ABC-XYZ', 'operations', 'C',
   'Classify inventory by value (ABC) and demand variability (XYZ) to set differentiated policies.',
   'Klasyfikacja zapasów wg wartości (ABC) i zmienności popytu (XYZ) — zróżnicowane polityki.',
   '["inventory","classification","supply-chain"]',
   '{"reportSections":["Classification Matrix","Policy Recommendations","Financial Impact"],"deckSlides":["ABC-XYZ Grid","Policy Summary"],"initiativeCategories":["supply-chain","inventory"]}',
   37)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name, name_pl = EXCLUDED.name_pl, category = EXCLUDED.category,
  archetype = EXCLUDED.archetype, description = EXCLUDED.description, description_pl = EXCLUDED.description_pl,
  tags_json = EXCLUDED.tags_json, output_mapping_json = EXCLUDED.output_mapping_json,
  sort_order = EXCLUDED.sort_order, updated_at = NOW();

INSERT INTO consulting_templates (slug, name, name_pl, category, archetype, description, description_pl, tags_json, output_mapping_json, sort_order)
VALUES
  ('safety-stock-reorder-point', 'Safety Stock & Reorder Point', 'Zapas bezpieczeństwa i punkt zamawiania', 'operations', 'H',
   'Calculate optimal safety stock levels and reorder points balancing service level and inventory cost.',
   'Obliczanie optymalnych zapasów bezpieczeństwa i punktów zamawiania — balans poziomu obsługi i kosztów.',
   '["inventory","replenishment","optimization"]',
   '{"reportSections":["Demand Analysis","Safety Stock Calculation","Policy Parameters"],"deckSlides":["Inventory Policy","Service Level Trade-off"],"initiativeCategories":["supply-chain","cost-reduction"]}',
   38)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name, name_pl = EXCLUDED.name_pl, category = EXCLUDED.category,
  archetype = EXCLUDED.archetype, description = EXCLUDED.description, description_pl = EXCLUDED.description_pl,
  tags_json = EXCLUDED.tags_json, output_mapping_json = EXCLUDED.output_mapping_json,
  sort_order = EXCLUDED.sort_order, updated_at = NOW();

INSERT INTO consulting_templates (slug, name, name_pl, category, archetype, description, description_pl, tags_json, output_mapping_json, sort_order)
VALUES
  ('sales-and-operations-planning-sn-op', 'Sales & Operations Planning (S&OP)', 'Planowanie sprzedaży i operacji (S&OP)', 'operations', 'G',
   'Align demand, supply, and financial plans in a monthly cross-functional cadence.',
   'Wyrównanie planów popytu, podaży i finansów w miesięcznym cyklu cross-funkcyjnym.',
   '["s&op","planning","alignment"]',
   '{"reportSections":["Process Design","Cadence Definition","KPI Framework"],"deckSlides":["S&OP Process","Alignment Dashboard"],"initiativeCategories":["planning","operations"]}',
   39)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name, name_pl = EXCLUDED.name_pl, category = EXCLUDED.category,
  archetype = EXCLUDED.archetype, description = EXCLUDED.description, description_pl = EXCLUDED.description_pl,
  tags_json = EXCLUDED.tags_json, output_mapping_json = EXCLUDED.output_mapping_json,
  sort_order = EXCLUDED.sort_order, updated_at = NOW();

INSERT INTO consulting_templates (slug, name, name_pl, category, archetype, description, description_pl, tags_json, output_mapping_json, sort_order)
VALUES
  ('scor-model', 'SCOR Model', 'Model SCOR', 'operations', 'F',
   'Map supply chain processes using Plan-Source-Make-Deliver-Return-Enable framework.',
   'Mapowanie procesów łańcucha dostaw wg frameworka Plan-Source-Make-Deliver-Return-Enable.',
   '["scor","supply-chain","process"]',
   '{"reportSections":["Process Mapping","Performance Attributes","Best Practice Gaps"],"deckSlides":["SCOR Process Map","Performance Benchmarks"],"initiativeCategories":["supply-chain","process-improvement"]}',
   40)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name, name_pl = EXCLUDED.name_pl, category = EXCLUDED.category,
  archetype = EXCLUDED.archetype, description = EXCLUDED.description, description_pl = EXCLUDED.description_pl,
  tags_json = EXCLUDED.tags_json, output_mapping_json = EXCLUDED.output_mapping_json,
  sort_order = EXCLUDED.sort_order, updated_at = NOW();

-- ==========================================
-- SEED: Digital Transformation templates (20)
-- ==========================================

INSERT INTO consulting_templates (slug, name, name_pl, category, archetype, description, description_pl, tags_json, output_mapping_json, sort_order)
VALUES
  ('digital-transformation-assessment', 'Digital Transformation Assessment', 'Ocena transformacji cyfrowej', 'digital_transformation', 'E',
   'Assess organizational digital maturity across key dimensions to set transformation priorities.',
   'Ocena dojrzałości cyfrowej organizacji w kluczowych wymiarach — priorytetyzacja transformacji.',
   '["assessment","maturity","digital"]',
   '{"reportSections":["Maturity Scores","Gap Analysis","Priority Roadmap"],"deckSlides":["Maturity Radar","Transformation Priorities"],"initiativeCategories":["digital","transformation"]}',
   41)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name, name_pl = EXCLUDED.name_pl, category = EXCLUDED.category,
  archetype = EXCLUDED.archetype, description = EXCLUDED.description, description_pl = EXCLUDED.description_pl,
  tags_json = EXCLUDED.tags_json, output_mapping_json = EXCLUDED.output_mapping_json,
  sort_order = EXCLUDED.sort_order, updated_at = NOW();

INSERT INTO consulting_templates (slug, name, name_pl, category, archetype, description, description_pl, tags_json, output_mapping_json, sort_order)
VALUES
  ('target-operating-model-tom', 'Target Operating Model (TOM)', 'Docelowy model operacyjny (TOM)', 'digital_transformation', 'A',
   'Design the future-state operating model covering people, process, technology, and governance.',
   'Projektowanie docelowego modelu operacyjnego: ludzie, procesy, technologia, governance.',
   '["operating-model","design","transformation"]',
   '{"reportSections":["Current vs Target Model","Design Principles","Transition Plan"],"deckSlides":["TOM Blueprint","Transition Roadmap"],"initiativeCategories":["transformation","operating-model"]}',
   42)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name, name_pl = EXCLUDED.name_pl, category = EXCLUDED.category,
  archetype = EXCLUDED.archetype, description = EXCLUDED.description, description_pl = EXCLUDED.description_pl,
  tags_json = EXCLUDED.tags_json, output_mapping_json = EXCLUDED.output_mapping_json,
  sort_order = EXCLUDED.sort_order, updated_at = NOW();

INSERT INTO consulting_templates (slug, name, name_pl, category, archetype, description, description_pl, tags_json, output_mapping_json, sort_order)
VALUES
  ('transformation-roadmap', 'Transformation Roadmap', 'Roadmapa transformacji', 'digital_transformation', 'G',
   'Sequence transformation initiatives into waves with dependencies, milestones, and value checkpoints.',
   'Sekwencjonowanie inicjatyw transformacyjnych w fale z zależnościami, kamieniami milowymi i checkpointami wartości.',
   '["roadmap","sequencing","transformation"]',
   '{"reportSections":["Wave Design","Dependencies","Value Milestones"],"deckSlides":["Roadmap Timeline","Wave Summary"],"initiativeCategories":["transformation","planning"]}',
   43)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name, name_pl = EXCLUDED.name_pl, category = EXCLUDED.category,
  archetype = EXCLUDED.archetype, description = EXCLUDED.description, description_pl = EXCLUDED.description_pl,
  tags_json = EXCLUDED.tags_json, output_mapping_json = EXCLUDED.output_mapping_json,
  sort_order = EXCLUDED.sort_order, updated_at = NOW();

INSERT INTO consulting_templates (slug, name, name_pl, category, archetype, description, description_pl, tags_json, output_mapping_json, sort_order)
VALUES
  ('benefits-case-value-tracking', 'Benefits Case & Value Tracking', 'Business case korzyści i śledzenie wartości', 'digital_transformation', 'H',
   'Build benefits cases and track value realization throughout the transformation lifecycle.',
   'Budowanie business case korzyści i śledzenie realizacji wartości w cyklu transformacji.',
   '["benefits","value","tracking"]',
   '{"reportSections":["Benefits Register","Value Tracking Framework","Realization Report"],"deckSlides":["Benefits Overview","Value Realization"],"initiativeCategories":["value-management","governance"]}',
   44)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name, name_pl = EXCLUDED.name_pl, category = EXCLUDED.category,
  archetype = EXCLUDED.archetype, description = EXCLUDED.description, description_pl = EXCLUDED.description_pl,
  tags_json = EXCLUDED.tags_json, output_mapping_json = EXCLUDED.output_mapping_json,
  sort_order = EXCLUDED.sort_order, updated_at = NOW();

INSERT INTO consulting_templates (slug, name, name_pl, category, archetype, description, description_pl, tags_json, output_mapping_json, sort_order)
VALUES
  ('current-state-architecture-map', 'Current-State Architecture Map', 'Mapa architektury stanu obecnego', 'digital_transformation', 'F',
   'Document the current application, data, and technology landscape as a baseline for transformation.',
   'Dokumentacja obecnego krajobrazu aplikacji, danych i technologii jako bazy do transformacji.',
   '["architecture","current-state","mapping"]',
   '{"reportSections":["Application Landscape","Integration Map","Technical Debt Assessment"],"deckSlides":["Architecture Overview","Debt Hotspots"],"initiativeCategories":["architecture","modernization"]}',
   45)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name, name_pl = EXCLUDED.name_pl, category = EXCLUDED.category,
  archetype = EXCLUDED.archetype, description = EXCLUDED.description, description_pl = EXCLUDED.description_pl,
  tags_json = EXCLUDED.tags_json, output_mapping_json = EXCLUDED.output_mapping_json,
  sort_order = EXCLUDED.sort_order, updated_at = NOW();

INSERT INTO consulting_templates (slug, name, name_pl, category, archetype, description, description_pl, tags_json, output_mapping_json, sort_order)
VALUES
  ('target-architecture-blueprint', 'Target Architecture Blueprint', 'Blueprint architektury docelowej', 'digital_transformation', 'F',
   'Design the target-state architecture aligned with business strategy and technology standards.',
   'Projektowanie architektury docelowej zgodnej ze strategią biznesową i standardami technologicznymi.',
   '["architecture","target-state","blueprint"]',
   '{"reportSections":["Architecture Principles","Target Blueprint","Migration Path"],"deckSlides":["Target Architecture","Migration Phases"],"initiativeCategories":["architecture","transformation"]}',
   46)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name, name_pl = EXCLUDED.name_pl, category = EXCLUDED.category,
  archetype = EXCLUDED.archetype, description = EXCLUDED.description, description_pl = EXCLUDED.description_pl,
  tags_json = EXCLUDED.tags_json, output_mapping_json = EXCLUDED.output_mapping_json,
  sort_order = EXCLUDED.sort_order, updated_at = NOW();

INSERT INTO consulting_templates (slug, name, name_pl, category, archetype, description, description_pl, tags_json, output_mapping_json, sort_order)
VALUES
  ('application-portfolio-rationalization', 'Application Portfolio Rationalization', 'Racjonalizacja portfela aplikacji', 'digital_transformation', 'C',
   'Assess and rationalize the application portfolio using TIME (Tolerate, Invest, Migrate, Eliminate).',
   'Ocena i racjonalizacja portfela aplikacji metodą TIME (Toleruj, Inwestuj, Migruj, Eliminuj).',
   '["applications","rationalization","portfolio"]',
   '{"reportSections":["Portfolio Inventory","TIME Classification","Rationalization Plan"],"deckSlides":["Portfolio Heat Map","Rationalization Roadmap"],"initiativeCategories":["architecture","cost-reduction"]}',
   47)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name, name_pl = EXCLUDED.name_pl, category = EXCLUDED.category,
  archetype = EXCLUDED.archetype, description = EXCLUDED.description, description_pl = EXCLUDED.description_pl,
  tags_json = EXCLUDED.tags_json, output_mapping_json = EXCLUDED.output_mapping_json,
  sort_order = EXCLUDED.sort_order, updated_at = NOW();

INSERT INTO consulting_templates (slug, name, name_pl, category, archetype, description, description_pl, tags_json, output_mapping_json, sort_order)
VALUES
  ('technology-standards-guardrails', 'Technology Standards & Guardrails', 'Standardy technologiczne i guardrails', 'digital_transformation', 'A',
   'Define technology standards, approved patterns, and guardrails to guide consistent technology decisions.',
   'Definicja standardów technologicznych, zatwierdzonych wzorców i guardrails dla spójnych decyzji.',
   '["standards","governance","technology"]',
   '{"reportSections":["Standards Catalog","Decision Framework","Compliance Checklist"],"deckSlides":["Standards Overview","Governance Model"],"initiativeCategories":["governance","standards"]}',
   48)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name, name_pl = EXCLUDED.name_pl, category = EXCLUDED.category,
  archetype = EXCLUDED.archetype, description = EXCLUDED.description, description_pl = EXCLUDED.description_pl,
  tags_json = EXCLUDED.tags_json, output_mapping_json = EXCLUDED.output_mapping_json,
  sort_order = EXCLUDED.sort_order, updated_at = NOW();

INSERT INTO consulting_templates (slug, name, name_pl, category, archetype, description, description_pl, tags_json, output_mapping_json, sort_order)
VALUES
  ('data-strategy-data-operating-model', 'Data Strategy & Data Operating Model', 'Strategia danych i model operacyjny danych', 'digital_transformation', 'A',
   'Define how the organization will collect, manage, and leverage data as a strategic asset.',
   'Określenie jak organizacja będzie zbierać, zarządzać i wykorzystywać dane jako zasób strategiczny.',
   '["data","strategy","operating-model"]',
   '{"reportSections":["Data Vision","Operating Model Design","Capability Roadmap"],"deckSlides":["Data Strategy Canvas","Operating Model"],"initiativeCategories":["data","strategy"]}',
   49)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name, name_pl = EXCLUDED.name_pl, category = EXCLUDED.category,
  archetype = EXCLUDED.archetype, description = EXCLUDED.description, description_pl = EXCLUDED.description_pl,
  tags_json = EXCLUDED.tags_json, output_mapping_json = EXCLUDED.output_mapping_json,
  sort_order = EXCLUDED.sort_order, updated_at = NOW();

INSERT INTO consulting_templates (slug, name, name_pl, category, archetype, description, description_pl, tags_json, output_mapping_json, sort_order)
VALUES
  ('data-governance', 'Data Governance', 'Zarządzanie danymi (Data Governance)', 'digital_transformation', 'A',
   'Establish roles, policies, and processes for managing data quality, access, and lifecycle.',
   'Ustanowienie ról, polityk i procesów zarządzania jakością, dostępem i cyklem życia danych.',
   '["data","governance","quality"]',
   '{"reportSections":["Governance Framework","Roles & Responsibilities","Policy Catalog"],"deckSlides":["Governance Model","Implementation Plan"],"initiativeCategories":["data","governance"]}',
   50)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name, name_pl = EXCLUDED.name_pl, category = EXCLUDED.category,
  archetype = EXCLUDED.archetype, description = EXCLUDED.description, description_pl = EXCLUDED.description_pl,
  tags_json = EXCLUDED.tags_json, output_mapping_json = EXCLUDED.output_mapping_json,
  sort_order = EXCLUDED.sort_order, updated_at = NOW();

INSERT INTO consulting_templates (slug, name, name_pl, category, archetype, description, description_pl, tags_json, output_mapping_json, sort_order)
VALUES
  ('data-quality-management', 'Data Quality Management', 'Zarządzanie jakością danych', 'digital_transformation', 'E',
   'Assess, measure, and improve data quality across critical data domains.',
   'Ocena, pomiar i poprawa jakości danych w krytycznych domenach danych.',
   '["data","quality","measurement"]',
   '{"reportSections":["Quality Dimensions","Assessment Results","Improvement Plan"],"deckSlides":["Data Quality Scorecard","Priority Domains"],"initiativeCategories":["data","quality"]}',
   51)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name, name_pl = EXCLUDED.name_pl, category = EXCLUDED.category,
  archetype = EXCLUDED.archetype, description = EXCLUDED.description, description_pl = EXCLUDED.description_pl,
  tags_json = EXCLUDED.tags_json, output_mapping_json = EXCLUDED.output_mapping_json,
  sort_order = EXCLUDED.sort_order, updated_at = NOW();

INSERT INTO consulting_templates (slug, name, name_pl, category, archetype, description, description_pl, tags_json, output_mapping_json, sort_order)
VALUES
  ('ai-use-case-factory', 'AI Use-Case Factory', 'Fabryka use-case''ów AI', 'digital_transformation', 'C',
   'Systematically identify, prioritize, and pipeline AI use cases from ideation to production.',
   'Systematyczna identyfikacja, priorytetyzacja i pipeline use-case''ów AI od idei do produkcji.',
   '["ai","use-cases","pipeline"]',
   '{"reportSections":["Use Case Inventory","Feasibility Scoring","Pipeline Design"],"deckSlides":["Use Case Portfolio","Pipeline Roadmap"],"initiativeCategories":["ai","innovation"]}',
   52)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name, name_pl = EXCLUDED.name_pl, category = EXCLUDED.category,
  archetype = EXCLUDED.archetype, description = EXCLUDED.description, description_pl = EXCLUDED.description_pl,
  tags_json = EXCLUDED.tags_json, output_mapping_json = EXCLUDED.output_mapping_json,
  sort_order = EXCLUDED.sort_order, updated_at = NOW();

INSERT INTO consulting_templates (slug, name, name_pl, category, archetype, description, description_pl, tags_json, output_mapping_json, sort_order)
VALUES
  ('process-mining', 'Process Mining', 'Process Mining', 'digital_transformation', 'F',
   'Discover actual process flows from event logs to identify deviations, bottlenecks, and automation opportunities.',
   'Odkrywanie rzeczywistych przepływów procesów z logów zdarzeń — odchylenia, wąskie gardła, automatyzacja.',
   '["process-mining","discovery","automation"]',
   '{"reportSections":["Process Discovery","Conformance Analysis","Optimization Opportunities"],"deckSlides":["Process Map","Deviation Analysis"],"initiativeCategories":["process-improvement","automation"]}',
   53)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name, name_pl = EXCLUDED.name_pl, category = EXCLUDED.category,
  archetype = EXCLUDED.archetype, description = EXCLUDED.description, description_pl = EXCLUDED.description_pl,
  tags_json = EXCLUDED.tags_json, output_mapping_json = EXCLUDED.output_mapping_json,
  sort_order = EXCLUDED.sort_order, updated_at = NOW();

INSERT INTO consulting_templates (slug, name, name_pl, category, archetype, description, description_pl, tags_json, output_mapping_json, sort_order)
VALUES
  ('automation-opportunity-assessment', 'Automation Opportunity Assessment', 'Ocena potencjału automatyzacji', 'digital_transformation', 'C',
   'Scan processes for automation potential, score feasibility, and build a prioritized automation backlog.',
   'Skanowanie procesów pod potencjał automatyzacji, scoring wykonalności i priorytetyzowany backlog.',
   '["automation","assessment","backlog"]',
   '{"reportSections":["Opportunity Scan","Feasibility Scoring","Automation Backlog"],"deckSlides":["Automation Heat Map","Priority Backlog"],"initiativeCategories":["automation","efficiency"]}',
   54)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name, name_pl = EXCLUDED.name_pl, category = EXCLUDED.category,
  archetype = EXCLUDED.archetype, description = EXCLUDED.description, description_pl = EXCLUDED.description_pl,
  tags_json = EXCLUDED.tags_json, output_mapping_json = EXCLUDED.output_mapping_json,
  sort_order = EXCLUDED.sort_order, updated_at = NOW();

INSERT INTO consulting_templates (slug, name, name_pl, category, archetype, description, description_pl, tags_json, output_mapping_json, sort_order)
VALUES
  ('customer-journey-digitization-map', 'Customer Journey Digitization Map', 'Mapa cyfryzacji ścieżki klienta', 'digital_transformation', 'F',
   'Map the customer journey and identify digitization opportunities at each touchpoint.',
   'Mapowanie ścieżki klienta i identyfikacja możliwości cyfryzacji w każdym punkcie styku.',
   '["customer-journey","digitization","experience"]',
   '{"reportSections":["Journey Map","Digital Opportunities","Experience Improvements"],"deckSlides":["Journey Overview","Digitization Priorities"],"initiativeCategories":["customer-experience","digital"]}',
   55)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name, name_pl = EXCLUDED.name_pl, category = EXCLUDED.category,
  archetype = EXCLUDED.archetype, description = EXCLUDED.description, description_pl = EXCLUDED.description_pl,
  tags_json = EXCLUDED.tags_json, output_mapping_json = EXCLUDED.output_mapping_json,
  sort_order = EXCLUDED.sort_order, updated_at = NOW();

INSERT INTO consulting_templates (slug, name, name_pl, category, archetype, description, description_pl, tags_json, output_mapping_json, sort_order)
VALUES
  ('product-operating-model', 'Product Operating Model', 'Produktowy model operacyjny', 'digital_transformation', 'A',
   'Shift from project to product mindset with persistent teams, backlogs, and outcome metrics.',
   'Przejście z myślenia projektowego na produktowe: stałe zespoły, backlogi i metryki wyników.',
   '["product","operating-model","agile"]',
   '{"reportSections":["Product Taxonomy","Team Topology","Metrics Framework"],"deckSlides":["Product Model","Team Design"],"initiativeCategories":["product","organization"]}',
   56)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name, name_pl = EXCLUDED.name_pl, category = EXCLUDED.category,
  archetype = EXCLUDED.archetype, description = EXCLUDED.description, description_pl = EXCLUDED.description_pl,
  tags_json = EXCLUDED.tags_json, output_mapping_json = EXCLUDED.output_mapping_json,
  sort_order = EXCLUDED.sort_order, updated_at = NOW();

INSERT INTO consulting_templates (slug, name, name_pl, category, archetype, description, description_pl, tags_json, output_mapping_json, sort_order)
VALUES
  ('agile-at-scale', 'Agile at Scale', 'Agile w skali', 'digital_transformation', 'G',
   'Scale agile practices across the organization with appropriate frameworks, cadences, and governance.',
   'Skalowanie praktyk agile w organizacji z odpowiednimi frameworkami, kadencjami i governance.',
   '["agile","scaling","organization"]',
   '{"reportSections":["Scaling Framework Selection","Implementation Plan","Governance Design"],"deckSlides":["Agile at Scale Blueprint","Implementation Waves"],"initiativeCategories":["agile","transformation"]}',
   57)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name, name_pl = EXCLUDED.name_pl, category = EXCLUDED.category,
  archetype = EXCLUDED.archetype, description = EXCLUDED.description, description_pl = EXCLUDED.description_pl,
  tags_json = EXCLUDED.tags_json, output_mapping_json = EXCLUDED.output_mapping_json,
  sort_order = EXCLUDED.sort_order, updated_at = NOW();

INSERT INTO consulting_templates (slug, name, name_pl, category, archetype, description, description_pl, tags_json, output_mapping_json, sort_order)
VALUES
  ('capability-skills-gap-analysis', 'Capability & Skills Gap Analysis', 'Analiza luk kompetencyjnych', 'digital_transformation', 'E',
   'Map current vs required capabilities and skills to build targeted development and hiring plans.',
   'Mapowanie obecnych vs wymaganych kompetencji i umiejętności — plany rozwoju i rekrutacji.',
   '["skills","capabilities","gap-analysis"]',
   '{"reportSections":["Capability Map","Gap Assessment","Development Plan"],"deckSlides":["Skills Gap Heat Map","Action Plan"],"initiativeCategories":["people","capabilities"]}',
   58)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name, name_pl = EXCLUDED.name_pl, category = EXCLUDED.category,
  archetype = EXCLUDED.archetype, description = EXCLUDED.description, description_pl = EXCLUDED.description_pl,
  tags_json = EXCLUDED.tags_json, output_mapping_json = EXCLUDED.output_mapping_json,
  sort_order = EXCLUDED.sort_order, updated_at = NOW();

INSERT INTO consulting_templates (slug, name, name_pl, category, archetype, description, description_pl, tags_json, output_mapping_json, sort_order)
VALUES
  ('change-management-plan-adkar', 'Change Management Plan (ADKAR)', 'Plan zarządzania zmianą (ADKAR)', 'digital_transformation', 'G',
   'Plan organizational change using ADKAR: Awareness, Desire, Knowledge, Ability, Reinforcement.',
   'Planowanie zmiany organizacyjnej wg ADKAR: Świadomość, Chęć, Wiedza, Umiejętność, Utrwalenie.',
   '["change-management","adkar","people"]',
   '{"reportSections":["Stakeholder Analysis","ADKAR Assessment","Change Plan"],"deckSlides":["ADKAR Dashboard","Change Roadmap"],"initiativeCategories":["change-management","people"]}',
   59)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name, name_pl = EXCLUDED.name_pl, category = EXCLUDED.category,
  archetype = EXCLUDED.archetype, description = EXCLUDED.description, description_pl = EXCLUDED.description_pl,
  tags_json = EXCLUDED.tags_json, output_mapping_json = EXCLUDED.output_mapping_json,
  sort_order = EXCLUDED.sort_order, updated_at = NOW();

INSERT INTO consulting_templates (slug, name, name_pl, category, archetype, description, description_pl, tags_json, output_mapping_json, sort_order)
VALUES
  ('digital-risk-assessment', 'Digital Risk Assessment', 'Ocena ryzyk cyfrowych', 'digital_transformation', 'E',
   'Identify and assess digital-specific risks across cyber, data, technology, and third-party domains.',
   'Identyfikacja i ocena ryzyk cyfrowych: cyber, dane, technologia, dostawcy zewnętrzni.',
   '["risk","digital","cybersecurity"]',
   '{"reportSections":["Risk Inventory","Impact Assessment","Mitigation Plan"],"deckSlides":["Risk Heat Map","Top Risks & Controls"],"initiativeCategories":["risk","security"]}',
   60)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name, name_pl = EXCLUDED.name_pl, category = EXCLUDED.category,
  archetype = EXCLUDED.archetype, description = EXCLUDED.description, description_pl = EXCLUDED.description_pl,
  tags_json = EXCLUDED.tags_json, output_mapping_json = EXCLUDED.output_mapping_json,
  sort_order = EXCLUDED.sort_order, updated_at = NOW();

-- ==========================================
-- MIGRATION COMPLETE
-- ==========================================
