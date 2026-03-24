# Dynamic SWOT — Methodology Pack (v1, PL)

## Pack meta

- **tool_slug**: `dynamic-swot`
- **pack_type**: `methodology`
- **pack_version**: `1.0.0`
- **language**: `pl`
- **source_kind**: `tool_pack`

## Provenance (sources)

- Product SSOT: `docs/product/DYNAMIC_SWOT_TOOL_SPEC_V1.md`
- Product SSOT: `docs/product/DYNAMIC_SWOT_MVP_V1.md`
- Product SSOT: `docs/product/DYNAMIC_SWOT_IMPLEMENTATION_BACKLOG_V1.md`
- Product copy and asset assumptions: `docs/product/DYNAMIC_SWOT_CONTENT_PACK_V1.md`
- Knowledge Bank SSOT: `docs/product/TOOLS_KNOWLEDGE_BANK_V3.md`
- Sources ladder: `docs/product/TOOLS_SSOT_SOURCES_V3.md`
- Help Center contract: `docs/product/KB_ARTICLE_TEMPLATE_FOR_TOOLS_V1.md`
- Runtime contract: `src/store/useToolStore.ts`
- Runtime surfaces: `src/components/DiscoveryTools/ToolDocumentView.tsx`
- Runtime surfaces: `src/components/DiscoveryTools/ToolContextPanel.tsx`
- Runtime surfaces: `src/components/DiscoveryTools/tools/DynamicSWOT/SWOTInputExplorationPhase.tsx`
- Runtime surfaces: `src/components/DiscoveryTools/tools/DynamicSWOT/SWOTBuildPhase.tsx`
- Runtime surfaces: `src/components/DiscoveryTools/tools/DynamicSWOT/SWOTInsightsPhase.tsx`
- Runtime surfaces: `src/components/DiscoveryTools/steps/SummaryStep.tsx`
- Existing product fallback copy: `server/src/services/KnownToolsService.ts`
- Method source: `knowledge/Strategie /Creately.zip :: Creately/creately.com/guides/how-to-use-swot-analysis-effectively/index.html`
- Method source: `knowledge/Strategie /Creately.zip :: Creately/creately.com/guides/tows-matrix-guide/index.html`
- Comparison source: `knowledge/Strategie /Creately.zip :: Creately/creately.com/guides/pest-and-swot-analysis/index.html`
- Comparison source: `knowledge/Strategie /Creately.zip :: Creately/creately.com/guides/soar-vs-swot/index.html`
- Method source: `knowledge/Strategie /visual-paradigm..zip :: visual-paradigm./ai.visual-paradigm.com/tools/swot-tows-business-analysis/swot-tows-business-analysis-tool-how-it-works/index.html`
- Comparison source: `knowledge/Strategie /visual-paradigm..zip :: visual-paradigm./ai.visual-paradigm.com/blog/five-forces-vs-swot-key-differences-synergies-and-when-to-use-each/index.html`
- Example source: `knowledge/Strategie /nibusinessinfo.zip :: nibusinessinfo/www.nibusinessinfo.co.uk/content/swot-pestle-and-other-models-strategic-analysis.html`
- Example source: `knowledge/Strategie /nibusinessinfo.zip :: nibusinessinfo/www.nibusinessinfo.co.uk/content/swot-analysis-example.html`
- Example source: `knowledge/Strategie /Busines to you.zip :: Busines to you/www.business-to-you.com/swot-analysis/index.html`
- Execution bridge: `knowledge/Strategie /Bscdisine.zip :: Bscdisine/bscdesigner.com/swots-framework.htm`
- Visual reference: `knowledge/Strategie /mural.zip :: mural/www.mural.co/templates/swot-analysis.html`

## Audience + use

- **Used by**: UI + AI + Help + Reports
- **Do not use for**: automatycznego potwierdzania insightów bez evidence albo tworzenia outputów bez akceptacji użytkownika

---

## Sections (chunk-friendly)

### [section_id:overview] Czym jest Dynamic SWOT w Consultify

- Dynamic SWOT nie jest statyczną macierzą 2x2.
- To narzędzie konsultingowe typu `conversation-first, structure-backed`.
- Główny cel: zamienić rozproszone obserwacje w decyzję, ruch strategiczny i traceable output.
- Kanoniczna obietnica produktu:
  - użytkownik wchodzi z pytaniem strategicznym,
  - wychodzi z napięciami strategicznymi,
  - ma rekomendowane ruchy,
  - może z tego samego źródła utworzyć inicjatywę, raport, prezentację lub pomysł.

### [section_id:application_mapping] Jak narzędzie ma być pokazane w aplikacji

- **Library preview should show**:
  - kiedy użyć narzędzia,
  - jakie outputy daje,
  - że nie kończy się na samej macierzy,
  - 3-4 typowe błędy.
- **Main work surface should show**:
  - postęp sesji,
  - aktualny etap,
  - zmaterializowane obiekty pracy: sygnały, karty SWOT, napięcia, ruchy, output candidates,
  - prostą drogę od rozmowy do akcji.
- **Help / AI surface should show**:
  - krótkie pytania prowadzące,
  - wyjaśnienie po co AI pyta,
  - guidance evidence-first,
  - propozycje, a nie niejawne decyzje.
- **Outputs surface should show**:
  - final source summary,
  - co najmniej kandydatów na outputy,
  - traceability do sesji,
  - jasne kryterium: kiedy tworzyć initiative, report, presentation, idea.

### [section_id:evidence] Zasady evidence i akceptacji

- **Evidence principle**:
  - każdy mocny wpis SWOT powinien dać się powiązać z konkretnym sygnałem, źródłem lub obserwacją.
  - jeśli materiału brak, wpis pozostaje hipotezą albo `needs evidence`.
- **Unknown / needs evidence rule**:
  - brak danych nie może być maskowany pewnym stwierdzeniem.
  - jeśli użytkownik nie wie, AI ma oznaczyć lukę, a nie “uzupełnić prawdę”.
- **Propose -> accept rule**:
  - AI może proponować sygnały, karty SWOT, napięcia, ruchy i output candidates.
  - AI nie może bezgłośnie nadpisywać zaakceptowanej treści.
- **Traceability note**:
  - output ma prowadzić z powrotem do sesji,
  - sesja ma prowadzić do sygnałów i uzasadnienia,
  - insight bez pochodzenia jest słaby.

### [section_id:object_chain] Kanoniczny łańcuch obiektów

- `Signal`
  - pojedyncza obserwacja, fakt, sygnał z rozmowy, linku, pliku, benchmarku albo AI context.
- `SWOT Card`
  - ustrukturyzowany element przypisany do jednej z czterech ćwiartek.
- `Strategic Tension`
  - ważne powiązanie między co najmniej dwoma kartami, które tworzy decyzję lub dylemat.
- `Recommended Move`
  - rekomendowana odpowiedź strategiczna na napięcie.
- `Output Candidate`
  - propozycja inicjatywy, raportu, prezentacji albo pomysłu.
- `Created Output`
  - utrwalony artefakt z metadanymi źródła.

### [section_id:when_to_use] Kiedy używać Dynamic SWOT

- gdy trzeba szybko zsyntetyzować sytuację strategiczną firmy, obszaru, produktu lub programu,
- gdy są rozproszone dane wewnętrzne i zewnętrzne, ale brak jednego obrazu,
- gdy potrzebna jest diagnoza zakończona decyzją, a nie tylko analizą,
- gdy zespół chce przejść od rozmowy do uporządkowanych ruchów i outputów,
- gdy inne narzędzia dostarczyły kontekst, ale trzeba zrobić syntezę i wybrać kierunek.

### [section_id:when_not_to_use] Kiedy nie używać Dynamic SWOT jako narzędzia głównego

- gdy najpierw trzeba zrozumieć makrootoczenie i trendy zewnętrzne:
  - wtedy najpierw PEST / PESTLE,
  - potem SWOT.
- gdy główny problem dotyczy struktury branży i presji konkurencyjnej:
  - wtedy najpierw Five Forces,
  - potem SWOT.
- gdy celem jest wyłącznie pozytywna mobilizacja zespołu wokół aspiracji:
  - wtedy SOAR może być lepszym wejściem.
- gdy decyzja jest już podjęta i potrzebny jest tylko plan wykonawczy:
  - wtedy lepsze może być narzędzie operacyjne lub initiative planning.

### [section_id:swot_vs_tows] Różnica SWOT i TOWS w tym standardzie

- SWOT służy do ułożenia obrazu sytuacji:
  - strengths,
  - weaknesses,
  - opportunities,
  - threats.
- TOWS służy do zamiany macierzy na strategie działania przez łączenie elementów.
- W Dynamic SWOT oba kroki są częścią jednego flow:
  - najpierw zbieramy sygnały i budujemy macierz,
  - potem przechodzimy do napięć i rekomendowanych ruchów.
- Dlatego produktowo używamy nazwy `Dynamic SWOT`, ale metodologicznie obejmujemy też logikę TOWS.

### [section_id:evidence_types] Fakt, obserwacja, hipoteza

- **Fact**
  - stwierdzenie oparte o twarde źródło,
  - przykład: “72% pipeline przychodzi z jednego kanału partnerskiego”.
- **Observation**
  - wiarygodny wzorzec zauważony przez użytkownika lub zespół, ale jeszcze bez pełnej kwantyfikacji,
  - przykład: “sprzedaż enterprise trwa istotnie dłużej niż SMB”.
- **Hypothesis**
  - przypuszczenie wymagające sprawdzenia,
  - przykład: “utrata części leadów wynika z braku dedykowanego contentu dla partnerów”.

Reguła:

- high-impact claim bez typu i bez źródła powinien być podważony.
- AI ma pomagać rozdzielać te trzy klasy, a nie je mieszać.

### [section_id:signal_quality] Czym jest dobry sygnał

- jeden sygnał = jedna obserwacja lub jeden fakt,
- sygnał powinien być możliwie krótki i konkretny,
- sygnał powinien zawierać:
  - treść,
  - źródło,
  - poziom pewności,
  - opcjonalne tagi,
- sygnał nie powinien być już gotowym wnioskiem strategicznym,
- sygnał nie powinien mieszać kilku tematów naraz.

Przykład dobrego sygnału:

- “Segment premium B2B rośnie szybciej niż retail, ale firma nie ma dedykowanego lejka sprzedażowego dla partnerów.”

Przykład słabego sygnału:

- “Mamy duży potencjał i powinniśmy mocniej rosnąć.”

### [section_id:stage_model] Docelowy model etapów

Produkt ma dwa języki etapów:

- aktualny runtime MVP:
  - `Mission & Context`
  - `Input & Exploration`
  - `SWOT Build`
  - `Synthesis & Insights`
  - `Outputs & Actions`
- docelowy język biznesowy:
  - `Mission Brief`
  - `Internal Reality`
  - `Market Reality`
  - `Strategic Tensions`
  - `Recommended Moves`
  - `Outputs`

Reguła redakcyjna:

- w bazie wiedzy opisujemy oba poziomy,
- ale preferowany dla użytkownika końcowego jest język biznesowy,
- runtime techniczny ma pozostać z nim spójny semantycznie.

### [stage_id:mission] Mission Brief / Mission & Context

- **Goal**:
  - zdefiniować decyzję, zanim zaczniemy klasyfikować obserwacje.
- **What good looks like**:
  - pytanie strategiczne jest ostre,
  - zakres jest ograniczony,
  - horyzont czasu jest jawny,
  - sukces jest nazwany,
  - założenia / constraints są widoczne.
- **What weak looks like**:
  - temat jest zbyt szeroki,
  - nie wiadomo, czy chodzi o wzrost, obronę, transformację czy priorytetyzację,
  - brak definicji sukcesu.
- **Evidence to ask for**:
  - aktualna sytuacja biznesowa,
  - sponsor decyzji,
  - podstawowe KPI lub sygnały sukcesu,
  - kluczowe ograniczenia.
- **AI guidance**:
  - ma zadawać 3-5 krótkich pytań,
  - ma zawężać cel,
  - ma wykrywać brakujące informacje.

### [stage_id:input] Input & Exploration

- **Goal**:
  - zebrać materiał wejściowy, zanim zostanie “usztywniony” przez ćwiartki.
- **What good looks like**:
  - widać sygnały z rozmowy, materiałów i benchmarków,
  - sygnały są krótkie i pojedyncze,
  - użytkownik rozumie, że to warstwa źródłowa.
- **What weak looks like**:
  - wpisy są za długie i mieszają kilka idei,
  - linki i pliki nie są zamieniane w sygnały,
  - AI dopisuje własny kontekst bez oznaczenia.
- **Evidence to ask for**:
  - notatki z rozmów,
  - pliki wewnętrzne,
  - linki do źródeł zewnętrznych,
  - benchmarki lub porównania.
- **AI guidance**:
  - ma porządkować materiał do `signals`,
  - ma oznaczać typ źródła,
  - ma proponować brakujące obszary eksploracji.

### [stage_id:swot_build] SWOT Build

- **Goal**:
  - zamienić sygnały na użyteczne karty SWOT.
- **What good looks like**:
  - każda ćwiartka zawiera konkretne karty,
  - wpis ma jasny sens i typ źródła,
  - confidence nie jest przypadkowe,
  - elementy nie dublują się.
- **What weak looks like**:
  - ogólniki typu “mamy dobrą markę” bez kontekstu,
  - mylenie zewnętrznych szans z wewnętrznymi przewagami,
  - te same wpisy w kilku ćwiartkach.
- **Evidence to ask for**:
  - źródło karty,
  - typ wpisu: fakt / obserwacja / hipoteza,
  - skąd wynika wpływ.
- **AI guidance**:
  - klasyfikuj, ale nie nadpisuj,
  - proponuj deduplikację,
  - challenge’uj słabe sformułowania,
  - oddzielaj symptom od przyczyny.

### [stage_id:insights] Strategic Tensions / Synthesis & Insights

- **Goal**:
  - zamienić macierz na realną wartość decyzyjną.
- **What good looks like**:
  - napięcia mają sens biznesowy,
  - wiadomo “dlaczego teraz”,
  - widać źródła i implikacje,
  - ruch strategiczny nie jest przypadkowy.
- **What weak looks like**:
  - korelacje są tylko mechanicznym połączeniem kart,
  - brak priorytetu,
  - wnioski są zbyt opisowe i bez decyzji.
- **Evidence to ask for**:
  - które karty tworzą napięcie,
  - jaki jest wpływ czasowy i biznesowy,
  - czy są kontrargumenty lub słabości w rozumowaniu.
- **AI guidance**:
  - generuj napięcia typu `attack`, `repair`, `defend`, `protect`,
  - wyjaśniaj, dlaczego są ważne,
  - pokazuj możliwy ruch lub konsekwencję.

### [stage_id:moves] Recommended Moves

- **Goal**:
  - zamienić napięcia na działania strategiczne.
- **What good looks like**:
  - każdy ruch ma uzasadnienie,
  - wiadomo, jaki problem rozwiązuje albo jaką przewagę wykorzystuje,
  - ruch daje się przełożyć na output.
- **What weak looks like**:
  - ruch jest tylko hasłem bez pierwszego kroku,
  - ruch nie ma związku z napięciami,
  - wszystkie ruchy są na jednym poziomie ogólności.
- **Evidence to ask for**:
  - linked tensions,
  - expected impact,
  - effort,
  - risk,
  - first step.
- **AI guidance**:
  - proponuj kategorię ruchu:
    - `Quick Win`
    - `Big Bet`
    - `Defensive Move`
    - `Capability Build`
  - nie twórz outputów automatycznie.

### [stage_id:outputs] Outputs

- **Goal**:
  - zakończyć analizę jednym source-grade summary i mostem do działań.
- **What good looks like**:
  - istnieje `final source summary`,
  - użytkownik widzi kandydatów na outputy,
  - wiadomo, który output jest właściwy dla sytuacji.
- **What weak looks like**:
  - sesja kończy się tylko listą insightów,
  - outputy są tylko dekoracją,
  - brak traceability.
- **Evidence to ask for**:
  - czy summary domyka misję,
  - które ruchy są gotowe do wdrożenia,
  - czy potrzebny jest dokument, prezentacja czy parking pomysłów.
- **AI guidance**:
  - pokazuj output candidates,
  - proponuj następny krok,
  - nie twórz outputu bez wyraźnego wyboru użytkownika.

### [section_id:application_surfaces] Co powinno być w poszczególnych elementach narzędzia

#### [surface_id:library_preview] Library preview

- Ma odpowiedzieć w kilka sekund:
  - do czego służy narzędzie,
  - kiedy je uruchomić,
  - co dostaniesz na końcu,
  - jakie błędy popełnia się najczęściej.
- Wiedza pokazana w tym miejscu:
  - skrót celu,
  - skrót procesu,
  - skrót outputów,
  - jedna krótka sytuacja użycia.
- Nie pokazywać:
  - rozbudowanej metodologii,
  - długich definicji SWOT.

#### [surface_id:library_detail] Library detail / pre-session

- Ma pokazać:
  - `Goal`
  - `Process`
  - `Expected Results`
  - `Example`
- Wiedza pokazana w tym miejscu:
  - pełniejszy onboarding,
  - jak wygląda droga użytkownika,
  - co odróżnia Dynamic SWOT od szkolnej macierzy.

#### [surface_id:mission_surface] Mission surface

- Ma pokazać:
  - strategic question,
  - scope,
  - time horizon,
  - success signal,
  - constraints / assumptions.
- Wiedza pokazana w tym miejscu:
  - framing questions,
  - jak zawężać temat,
  - jak rozpoznać zbyt szeroki brief.

#### [surface_id:input_surface] Input & Exploration

- Ma pokazać:
  - typ sygnału,
  - źródło,
  - treść,
  - confidence,
  - grupowanie po typie.
- Wiedza pokazana w tym miejscu:
  - czym jest dobry sygnał,
  - różnica między materiałem a wnioskiem,
  - jak z normalizacji sygnałów korzysta AI.

#### [surface_id:swot_surface] SWOT Build

- Ma pokazać:
  - cztery ćwiartki,
  - karty z impact, confidence, source,
  - guidance co odróżnia mocny wpis od słabego.
- Wiedza pokazana w tym miejscu:
  - definicje ćwiartek,
  - przykłady wpisów,
  - checklistę jakości,
  - hinty deduplikacji.

#### [surface_id:insight_surface] Synthesis & Insights

- Ma pokazać:
  - napięcia,
  - korelacje,
  - applied conclusions,
  - ruchy strategiczne.
- Wiedza pokazana w tym miejscu:
  - jak czytać napięcia,
  - co oznacza `attack / repair / defend / protect`,
  - kiedy insight jest wystarczająco mocny, by sugerować ruch.

#### [surface_id:outputs_surface] Outputs & Actions

- Ma pokazać:
  - final source summary,
  - key insights,
  - applied conclusions,
  - recommended moves,
  - output candidates,
  - generated outputs.
- Wiedza pokazana w tym miejscu:
  - kiedy wybrać initiative,
  - kiedy wybrać report,
  - kiedy wybrać presentation,
  - kiedy wybrać idea.

#### [surface_id:right_panel] Right panel / AI co-strategist

- Ma pokazać:
  - mission pulse,
  - current AI hypothesis,
  - next best question,
  - unresolved gaps,
  - output shortcuts.
- Wiedza pokazana w tym miejscu:
  - guidance kontekstowe, nie długi artykuł,
  - krótkie pytania,
  - checki readiness,
  - informacje “what is missing”.

### [section_id:knowledge_base_design] Jaka wiedza ma być pokazana w bazie wiedzy

- **Methodology**
  - definicja i logika narzędzia,
  - kiedy używać / kiedy nie,
  - stage-by-stage guidance,
  - evidence discipline,
  - porównania frameworków.
- **QBank**
  - pytania dla AI i użytkownika na każdym etapie,
  - follow-up probes,
  - przykłady mocnych odpowiedzi,
  - sygnały ostrzegawcze.
- **Initiatives**
  - wzorce przejścia od napięcia do ruchu i do inicjatywy,
  - KPI, dependencies, first step.
- **Benchmarks**
  - zewnętrzne przykłady,
  - porównania SWOT z innymi frameworkami,
  - case patterns i visual references.
- **Help**
  - krótki artykuł użytkowy,
  - skrypty do AI i czatu,
  - checklisty,
  - guidance do outputów.
- **Assets**
  - briefy wizualne, legenda, caption, alt text.

### [section_id:framework_comparisons] SWOT vs inne frameworki

#### SWOT vs PEST / PESTLE

- PEST analizuje siły makro zewnętrzne.
- SWOT łączy czynniki wewnętrzne i zewnętrzne w jedną narrację decyzyjną.
- Najlepszy wzorzec:
  - najpierw PEST / PESTLE,
  - potem wynik zasila `External context` w Dynamic SWOT.

#### SWOT vs Five Forces

- Five Forces analizuje strukturę branży i przewagę konkurencyjną.
- SWOT jest szerszą syntezą i może wchłonąć wnioski z Five Forces do `Threats`, `Opportunities` oraz później do napięć.
- Najlepszy wzorzec:
  - najpierw Five Forces, gdy pytanie dotyczy presji branżowej,
  - potem Dynamic SWOT dla syntezy i decyzji.

#### SWOT vs SOAR

- SWOT lepiej nadaje się do diagnozy z barierami i ryzykami.
- SOAR lepiej nadaje się do pracy aspiracyjnej i pozytywnej mobilizacji.
- Dynamic SWOT powinien być wyborem domyślnym, gdy trzeba uwzględnić także ryzyka, ograniczenia i obronę.

### [section_id:anti_patterns] Najczęstsze antywzorce

- Traktowanie SWOT jak listy notatek, a nie narzędzia decyzji.
- Wrzucanie zbyt wielu słabych wpisów “dla kompletności”.
- Mieszanie faktów, opinii i hipotez.
- Przeskakiwanie od sygnału od razu do outputu bez warstwy napięć i ruchów.
- Brak rozróżnienia tego, co wewnętrzne, a co zewnętrzne.
- Duplikowanie tej samej obserwacji w kilku ćwiartkach.
- Używanie SWOT bez ostrego pytania strategicznego.
- Zatrzymanie się na summary zamiast przejścia do outputów.

### [section_id:quality_bar] Jak wygląda dobra sesja końcowa

- 6-12 zaakceptowanych kart SWOT,
- 3-6 napięć strategicznych,
- 2-4 rekomendowane ruchy,
- przynajmniej 1 output candidate gotowy do dalszej decyzji,
- final source summary, który da się wykorzystać w raporcie lub decku,
- wyraźny ślad: skąd wziął się każdy ważny wniosek.

### [section_id:redaction_rule] Reguła redakcyjna dla kolejnych narzędzi

- Dynamic SWOT jest pakietem referencyjnym.
- Każde kolejne narzędzie powinno:
  - używać tego samego podziału packów,
  - opisywać surface-by-surface, co użytkownik widzi,
  - rozdzielać metodologię od helpu i assetów,
  - zachowywać evidence-first i propose -> accept.
