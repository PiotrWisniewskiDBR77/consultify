# AGENT 1 - Execution Plan

> Status: deprecated as canonical plan
> Manager note: keep only as source material
> Replaced by: `docs/product/work-packets/MANAGER_FALA_1_CANONICAL_EXECUTION_MAP_2026-03-28.md`

## 1. Scope
- Zakres roboczy tego dokumentu został zrekonstruowany z `V8_10_PHASE_REVIEW_REPORT_2026-03-28.md`, ponieważ prompt wejściowy zostawił nieuzupełnione placeholdery nazwy agenta, modułów, benchmarków i nazwy pliku wynikowego.
- `Landing / Anna`
- `MyWork / Radar`
- `Idea / Mindmap`
- `Whiteboard / Proces flow / Tabele`

## 2. Source of truth reviewed
- Źródła nadrzędne:
- `docs/product/work-packets/V8_EXECUTION_WAVES_NOW_LATER_2026-03-28.md`
- `docs/product/work-packets/V8_V81_GAP_ANALYSIS_AND_8_2_CUT_2026-03-28.md`
- `docs/product/work-packets/V8_10_PHASE_REVIEW_REPORT_2026-03-28.md`
- `docs/product/work-packets/Plan V8.1 Final.md`
- `docs/product/work-packets/POST_V81_BACKLOG_DEBT_REDUCTION_PROGRAM.md`
- `docs/product/SYSTEMATYKA_PRZEGLADU_V8.md`
- `docs/product/DOCUMENTATION_REGISTRY.md`
- Ryzyka dokumentacyjne potwierdzone podczas przeglądu:
- `Plan v8.pdf` jest cytowany jako źródło wizji, ale nie istnieje w repo.
- surowy korpus `Softs/tabele` jest cytowany w benchmarku tabel, ale nie istnieje w workspace.
- Źródła modułowe:
- `docs/product/LANDING_V8_SSOT.md`
- `docs/product/ANNA_LP_ASSISTANT_CONTRACT_V8.md`
- `docs/product/BUSINESS_POSITIONING_SSOT.md`
- `docs/product/MYWORK_RADAR_V8_READINESS_AUDIT.md`
- `docs/product/MYWORK_RADAR_V8_SSOT.md`
- `docs/product/MYWORK_HOME_V1_SSOT.md`
- `docs/product/IDEA_WORKSPACE_NAVIGATION_AND_CANVAS_ORCHESTRATION_V8.md`
- `docs/product/MINDMAP_V8_READINESS_AUDIT.md`
- `docs/product/WHITEBOARD_V8_READINESS_AUDIT.md`
- `docs/product/PROCESS_FLOW_V8_READINESS_AUDIT.md`
- `docs/strategy/TABELE_V8_SSOT.md`
- `docs/strategy/TABELE_V8_BENCHMARK.md`
- Główne komponenty i backend paths:
- `src/views/ProductEntryPage.tsx`
- `src/components/Landing/AnnaAssistantWidget.tsx`
- `server/src/routes/public-anna.routes.ts`
- `src/views/MyWorkView.tsx`
- `src/components/MyWork/MyWorkHub.tsx`
- `src/components/MyWork/Home/HomeView.tsx`
- `src/components/MyWork/Home/useRadarData.ts`
- `server/src/routes/my-work.routes.ts`
- `src/components/MyWork/IdeaMapWorkspace.tsx`
- `src/components/MyWork/IdeaRecommendationMap.tsx`
- `src/components/MyWork/IdeaWhiteboardTool.tsx`
- `src/components/MyWork/IdeaProcessFlowTool.tsx`
- `src/components/MyWork/IdeaTableTool.tsx`
- `server/src/routes/table-platform.routes.ts`
- Lista benchmarków konkurencji:
- `Perplexity`
- `Notion AI`
- `Feedly`
- `Miro`
- `Whimsical`
- `Lucidchart`
- `Airtable`
- `Coda`

## 3. Executive summary
- Ten zakres ma już dużo więcej niż atrapę: `Landing / Anna` jest realnie osadzony na publicznym wejściu, `Radar` ma żywy runtime, `Idea Workspace` ma jeden wspólny shell, a `Whiteboard / Process flow / Tabele` mają duży kawał kodu i własne ścieżki backendowe.
- Problem nie polega dziś na całkowitym braku funkcji. Problem polega na tym, że szerokość funkcji wyprzedziła klarowność produktu, a w kilku miejscach repo truth rozjeżdża się z prostą obietnicą dla usera.
- `Landing / Anna` jest najbliżej odbioru, ale nadal nie ma zamkniętego systemu narracji, proof contentu i mocnego osadzenia Anny jako przewodnika konwersji.
- `MyWork / Radar` ma najlepszy przykład rozjazdu między „mamy runtime” a „user rozumie produkt”: backend i roof summary są bogate, ale front bardziej wygląda jak eksperymentalny Home V2 niż jeden czytelny consulting radar.
- `Idea / Mindmap` jest strategicznie cenny i technicznie szeroki, ale nadal zbyt ciężki w interakcji. To nie jest problem braku canvasa, tylko braku spokojnej, przewidywalnej gramatyki pracy.
- `Whiteboard / Proces flow / Tabele` mają realny potencjał, ale to jest najbardziej ryzykowny fragment zakresu. Bardzo łatwo udawać tu „Miro / Lucid / Airtable-class” tylko dlatego, że istnieją toolbarey, endpointy i dużo kodu.
- Największe ryzyko produktowe w tej fali to dalsze mieszanie bounded finishu z ukrytym programem `8.2`. To szczególnie dotyczy `Whiteboard`, `Process Flow` i pełnej platformy tabel.
- Najszybszy efekt user-facing da kolejno: uporządkowanie `Landing / Anna`, unifikacja `MyWork / Radar`, a dopiero potem domknięcie głównego happy path w `Idea / Mindmap`.
- Najbezpieczniejsza strategia nie polega na dodawaniu nowej szerokości. Polega na zamrożeniu prawdy o module, usunięciu split-brainu na surface, i domknięciu jednego wiarygodnego flow end-to-end per moduł.
- Jeśli ten zakres ma wyglądać jak dobry produkt, nie wolno upraszczać dwóch rzeczy: `why this matters now` w `Radar` i `one idea = one workspace` w `Idea Workspace`. To są dwa najważniejsze nośniki wartości w tej fali.

## 4. Module-by-module analysis

### Landing / Anna

#### 4.1 Intended product behavior
- `Landing` ma być publicznym wejściem do produktu z jasną narracją wartości: problem -> platform pattern -> produkt -> value layers -> consulting journey -> proof -> CTA.
- `Anna` ma działać jako publiczny, nienachalny przewodnik sprzedażowy i edukacyjny, bez dostępu do tenant data i bez udawania Teresy.
- Główny flow miał być prosty: visitor rozumie produkt, pyta Annę, wybiera `Demo` albo `Start Trial`, a po wejściu do platformy dostaje handoff do Teresy i onboarding do pierwszej wartości.
- Ten moduł miał sprzedawać nie „AI asystenta”, tylko `Consulting Intelligence Platform`.

#### 4.2 Current repo truth
- `src/views/ProductEntryPage.tsx` składa realny landing z wieloma sekcjami i osadza `AnnaAssistantWidget`, `DemoModeModal` oraz CTA do demo/trial.
- `server/src/routes/public-anna.routes.ts` ma realne endpointy publiczne, w tym rozmowę, `voice-config`, `voice-context`, `funnel-event` i `voice-event`, więc Anna nie jest tylko atrapą UI.
- `LANDING_V8_SSOT.md` i `ANNA_LP_ASSISTANT_CONTRACT_V8.md` dają już sensowny target-state, ale same dokumenty wprost przyznają brak `Landing Content Spec`, expert showcase modelu i planu assetów.
- Najbardziej używalna część już istnieje: user może wejść, zobaczyć narrację, odpalić demo/trial i skorzystać z Anny.
- Najbardziej niedomknięta część to nie mechanika, tylko siła komunikatu, proof content, spójność CTA i osadzenie Anny jako integralnej części scroll flow zamiast osobnego widgetu.

#### 4.3 Competitive standard
- Rynek nauczył usera, że publiczne wejście w produkt AI ma być szybkie, jednoznaczne i dowodowe, a nie opisowe.
- Standard z `Perplexity` i publicznych AI surfaces: direct answer first, niski próg wejścia, szybkie follow-upy, jasny benefit bez marketingowej mgły.
- Standard z dobrych SaaS landingów: silna value hierarchy, proof early, CTA stale widoczne, osobny przewodnik nie może rozbijać głównej historii.
- U nas mocne jest to, że Anna ma już kontrakt, ograniczenia i realny backend.
- Odstajemy tam, gdzie user oczekuje od razu: mocniejsze proof points, bardziej oczywista ścieżka „dla kogo / po co / co dalej” oraz głębsza integracja Anny z sekcjami landingu.

#### 4.4 Main gaps
- Ocena 7 wymiarów:
- `User value` — wartość jest czytelna, ale jeszcze nieostro sprzedana. Ocena: `średnia+`. Najważniejszy brak: zbyt słaby proof i zbyt mało konkretnego „co dostanę po wejściu”.
- `Flow completeness` — demo/trial istnieją, ale journey visitor -> demo -> onboarding nie jest jeszcze jednym silnym story. Ocena: `średnia`. Najważniejszy brak: słabe prowadzenie przez kolejne kroki wartości.
- `UX quality` — layout i sekcje są realne, ale narracja i embedding Anny nadal są nierówne. Ocena: `średnia`. Najważniejszy brak: Anna działa obok strony bardziej niż razem ze stroną.
- `Data / logic quality` — kontrakt public knowledge boundary i degraded states są dobre. Ocena: `mocna`. Najważniejszy brak: brak editorially hardened public content system.
- `Integration quality` — handoff Anna -> Teresa jest zdefiniowany, ale publiczna ścieżka do trial/onboardingu nie jest jeszcze wystarczająco domknięta productowo. Ocena: `średnia`. Najważniejszy brak: zbyt słabe osadzenie CTA moments w realnych punktach odkrycia wartości.
- `Trust / governance / error handling` — kontrakt ograniczeń i fallbacków jest sensowny. Ocena: `mocna`. Najważniejszy brak: brak user-facing proof, że Anna mówi tylko o publicznym zakresie.
- `Market standard fit` — to nie wygląda amatorsko, ale jeszcze nie wygląda jak top-tier public AI entry surface. Ocena: `średnia`. Najważniejszy brak: za mało mocnego, konkretnego conversion narrative.
- Konkretne braki:
- brak `Landing Content Spec`, który tłumaczy SSOT na sekcję po sekcji copy i hierarchy
- brak katalogu expert/proof content, który wzmacnia trust
- Anna nie jest jeszcze w pełni osadzona kontekstowo w landing IA
- CTA są obecne, ale nie wszystkie są zakotwiczone w punktach realnego odkrycia wartości
- first-run onboarding jest opisany, ale nie jest jeszcze jasno spięty z publicznym expectation setting

#### 4.5 Minimal acceptance state now
- User w ciągu pierwszych 30-60 sekund rozumie, że to jest `Consulting Intelligence Platform`, dla kogo jest i czym różni się od „samego AI”.
- Na każdej głównej części scrolla ma jasny ruch dalej: `Demo`, `Trial` albo kontakt.
- Anna odpowiada wyłącznie w granicach publicznej wiedzy, jasno prowadzi do kolejnego kroku i nie udaje Teresy.
- Visitor może przejść `landing -> demo/trial -> onboarding start` bez ślepych zaułków i bez zmiany języka narracji.
- Błędy dopuszczalne: czasowa niedostępność Anny z czytelnym fallbackiem, rate limit z łagodnym komunikatem, brak bardziej zaawansowanych assetów wizualnych.
- Czego nadal może nie być bez blokowania odbioru: pełny program nowego visual systemu, szeroki redesign marketing site, rozbudowany katalog ekspertów.

#### 4.6 Top missing functions
- sekcja po sekcji content framework dla landingu
- silniejszy hero z jednym jasnym promise i jednym głównym ruchem
- proof stack: use cases, outcomes, moduły, trust cues
- głębsze osadzenie Anny w kontekście sekcji i intentów usera
- lepsze przejście `ask Anna -> demo/trial`
- domknięcie V8 narrative w bannerach, CTA i onboarding expectations
- bardziej czytelne use-case mapping dla różnych person
- spójniejsza polityka językowa i komunikaty degraded state

#### 4.7 Proposed bounded delivery packets
- `Landing Narrative Pass`
- Cel: zamienić istniejący landing z „jest dużo sekcji” na jeden czytelny funnel wartości.
- Zakres: hero, kolejność sekcji, messaging anchors, CTA hierarchy, proof placement.
- Co dokładnie dowozimy: jedną spójną narrację public entry, bez zmiany całej architektury strony.
- Czego świadomie nie ruszamy: nowego visual systemu, osobnego marketing program, szerokich asset pipelines.
- Proof odbioru: user po 1 scrollu rozumie produkt, kategorię, wartość i kolejny krok.
- Ryzyka: łatwo zamienić to w redesign copywritingu bez rzeczywistego uproszczenia flow.
- `Anna LP Contextual Embedding`
- Cel: sprawić, żeby Anna była częścią publicznego experience, a nie dodatkiem.
- Zakres: context-aware prompts, CTA handoff, section-aware entry points, clearer boundary language.
- Co dokładnie dowozimy: lepsze połączenie pytań usera z demo/trial/contact i jaśniejszą publiczną rolę Anny.
- Czego świadomie nie ruszamy: tenant memory, głębszej agentowości, szerokiego voice-product redesign.
- Proof odbioru: pytanie do Anny naturalnie prowadzi do właściwego CTA bez utraty zaufania.
- Ryzyka: zbyt agresywne CTA obniżą wiarygodność asystenta.
- `Demo / Trial Story Coherence`
- Cel: domknąć jedną handlowo-produktową ścieżkę z landingu do pierwszej wartości.
- Zakres: strategic CTA moments, demo framing, trial start expectations, onboarding start.
- Co dokładnie dowozimy: continuity języka i ruchu dalej od publicznego wejścia do pierwszego in-app kroku.
- Czego świadomie nie ruszamy: pełnego przebudowania trial lifecycle lub nowego pricing programu.
- Proof odbioru: user nie ma poczucia, że po kliknięciu `Trial` trafia do innego produktu.
- Ryzyka: część zależności leży poza samym landingiem i wymaga koordynacji z onboardingiem.

#### 4.8 Risks and dependencies
- Krytyczna zależność: brak `Plan v8.pdf` utrudnia weryfikację oryginalnej szerokiej wizji ponad obecne SSOT-y.
- Zależność produktowa: handoff do Teresy i first-run onboarding muszą zachować spójny język z landingiem.
- Ryzyko scope drift: bardzo łatwo przykryć prawdziwe braki „ładniejszym hero”.
- Ryzyko dowodowe: bez proof contentu landing pozostanie bardziej obietnicą niż wiarygodnym wejściem.

### MyWork / Radar

#### 4.1 Intended product behavior
- `Radar` miał być pierwszym mocnym filarem `MyWork`: AI executive radar, który zamienia szum w interpretację, decyzję i następny ruch.
- Miał nie być feedem, RSS readerem ani ogólną tablicą. Miał odpowiadać na sześć pytań: co się zmieniło, dlaczego to ważne, dlaczego to widzisz, co to znaczy dla Ciebie, co zrobić dalej i czego warto się douczyć.
- Główny flow miał być odpowiedź-first, action-first: user otwiera `MyWork`, dostaje ranked signals, rozumie sens i może przejść do notatki, zadania, chatu albo watchlisty.
- `Radar` miał być strategicznym ekranem pracy, a nie ciekawostką na home.

#### 4.2 Current repo truth
- `server/src/routes/my-work.routes.ts` ma realne endpointy `my-work/radar`, `radar/actions`, `radar/metrics` oraz mocny runtime wokół sygnałów.
- `HomeView.tsx` renderuje bogaty `Home V2` z blokami typu `AI Pulse Core`, `Momentum`, `Industry Lens`, `Execution Current` i dodatkowo pokazuje `roof truth`.
- `useRadarData.ts` nadal odpytuje `/my-work/radar`, ale w repo wygląda na sierotę runtime-ową, bo główna powierzchnia frontu jest już bardziej `Home V2` niż prostym ekranem `Radar`.
- `MyWorkHub.tsx` nazywa pierwszy tab `Radar`, ale w praktyce to wejście do szerokiego home surface, co zwiększa ryzyko produktowego split-brainu.
- To oznacza, że backend i dokumentacja mówią o `Radar`, a user-facing surface mówi bardziej o agregowanym home cockpit.

#### 4.3 Competitive standard
- Standard z `Perplexity`: odpowiedź przed listą źródeł, mocne follow-upy, źródła i zakres widoczne, zero pustego scrollowania.
- Standard z `Notion AI`: kontekst pracy ma wpływać na interpretację, a nie być tylko dodatkiem do ogólnej odpowiedzi.
- Standard z `Feedly` i automation products: ingestion i ranking mają być niewidocznym silnikiem, a nie ciężarem dla usera.
- U nas mocny jest runtime i jasna doktryna produktu w SSOT-ach.
- Odstajemy w surface semantics: user nie dostaje jeszcze jednej, oczywistej obietnicy `Radar`, tylko raczej zaawansowany home mix bloków.

#### 4.4 Main gaps
- Ocena 7 wymiarów:
- `User value` — potencjał jest bardzo wysoki, ale value nie jest jeszcze wystarczająco uchwytna na pierwszym ekranie. Ocena: `średnia+`. Najważniejszy brak: za mało jednoznaczne `why this matters now`.
- `Flow completeness` — istnieje discovery i część handoffów, ale flow `signal -> move` nie jest jeszcze dominującą ścieżką UX. Ocena: `średnia`. Najważniejszy brak: action engine nie jest dość pierwszoplanowy.
- `UX quality` — ekran jest żywy i bogaty, ale nie dość prosty i konsultingowo czytelny. Ocena: `średnia`. Najważniejszy brak: split między `Radar` jako obietnicą a `Home V2` jako faktycznym surface.
- `Data / logic quality` — pipeline i runtime są solidne. Ocena: `mocna`. Najważniejszy brak: część logiki nie ma jeszcze równie silnego user-facing tłumaczenia.
- `Integration quality` — są mosty do chatu, notebooka i tasków, ale nie są jeszcze jednym oczywistym ruchem pracy. Ocena: `średnia`. Najważniejszy brak: zbyt lekka semantyka handoffu do realnych obiektów pracy.
- `Trust / governance / error handling` — source trust doctrine jest dobra dokumentacyjnie, ale na surface jeszcze za słabo czuć `why you see this` i siłę źródła. Ocena: `średnia+`. Najważniejszy brak: za mało jawnej przezroczystości rekomendacji.
- `Market standard fit` — to nie jest feed, co jest plusem, ale jeszcze nie jest tak klarowne jak liderzy answer-first intelligence. Ocena: `średnia`. Najważniejszy brak: zbyt mało mocnej interpretacji na pierwszym ekranie.
- Konkretne braki:
- brak jednego canonical surface truth dla `Radar` vs `Home V2`
- `useRadarData.ts` i osobne endpointy wskazują na nierozwiązany surface split
- za słaba ekspozycja `why you see this`, `what to do next`, `learn / revisit`
- za mało mocna promocja sygnału do notatki, zadania, idei lub czatu
- `MyWork` nadal nie ma jednego master package, więc `Radar` niesie zbyt dużo ciężaru interpretacyjnego za cały moduł

#### 4.5 Minimal acceptance state now
- User otwierając `MyWork / Radar` dostaje jeden spójny ekran strategiczny, nie dwa konkurujące koncepty.
- Dla najważniejszych sygnałów widzi: co się zmieniło, dlaczego to ważne, dlaczego to dotyczy jego pracy i jaki jest następny ruch.
- Z ekranu może wykonać co najmniej trzy realne przejścia bez chaosu: do notatki, do czatu kontekstowego i do obiektu pracy.
- Watchlist, brief i action layer są czytelne, nawet jeśli nie są jeszcze pełnym enterprise radar OS.
- Błędy dopuszczalne: ograniczona liczba źródeł, brak pełnej operator warstwy source governance, brak szerokiej ingest parity.
- Czego nadal może nie być bez blokowania odbioru: pełna szerokość connectorów, rozbudowany operator cockpit, duży program `MyWork OS`.

#### 4.6 Top missing functions
- unifikacja surface truth `Radar` vs `Home V2`
- silniejszy first-screen interpretation model
- czytelne `why you see this`
- mocniejszy `what to do next`
- lepszy handoff do note / task / idea / chat
- jasny trust state źródła i świeżości
- lepszy briefing / digest / re-engagement loop
- lepsze odróżnienie `Radar` od `Inbox`
- lepsze odróżnienie `Radar` od zwykłego dashboardu

#### 4.7 Proposed bounded delivery packets
- `Radar Surface Truth Unification`
- Cel: usunąć split-brain między dokumentacyjnym `Radar` a frontowym `Home V2`.
- Zakres: nazewnictwo surface, payload emphasis, block priorities, canonical entry semantics.
- Co dokładnie dowozimy: jeden spójny ekran i jeden język produktu.
- Czego świadomie nie ruszamy: pełnego redesignu `MyWork`, inboxa, manager surfaces.
- Proof odbioru: user nie ma wątpliwości, czym jest `Radar` i co ma na nim zrobić.
- Ryzyka: łatwo skończyć na rebrandingu bez realnej zmiany informacji i akcji.
- `Signal-to-Action Handoff`
- Cel: zamienić radar z interpretacji w realny ruch pracy.
- Zakres: note/chat/task/idea handoff, CTA copy, minimal context carry-over.
- Co dokładnie dowozimy: jedna czytelna ścieżka od sygnału do działania.
- Czego świadomie nie ruszamy: pełnej przebudowy task runtime lub inbox enforcement.
- Proof odbioru: user po kliknięciu z sygnału trafia do sensownego następnego kroku z zachowanym kontekstem.
- Ryzyka: zależności w innych modułach mogą zaniżyć odczucie jakości.
- `Radar Trust and Relevance Pass`
- Cel: wzmocnić wiarygodność rekomendacji i poczucie personal relevance.
- Zakres: freshness, source visibility, why-you-see-this, learn/revisit triggers.
- Co dokładnie dowozimy: prostą i godną zaufania interpretację sygnału.
- Czego świadomie nie ruszamy: pełnej operator source-review warstwy.
- Proof odbioru: user rozumie, skąd rekomendacja się wzięła i dlaczego warto jej poświęcić uwagę.
- Ryzyka: nadmiar metadanych może zabić lekkość surface.

#### 4.8 Risks and dependencies
- Zależność: `Radar` wymaga dobrych handoffów do `Notes`, `Ideas`, `Tasks` i `Chat`, więc nie jest całkowicie samowystarczalny.
- Ryzyko: jeśli zostanie jako „home aggregation experiment”, user nie nauczy się traktować go jako realnego narzędzia decyzji.
- Ryzyko dokumentacyjne: brak pełnego `MyWork` master package utrudnia granicę modułu.

### Idea / Mindmap

#### 4.1 Intended product behavior
- `Idea Workspace` miał działać według zasady `one idea = one workspace`.
- User miał wybierać problem, a nie narzędzie. System miał podpowiadać najlepszy canvas na aktualnym etapie myślenia.
- `Mind Map` miał być szybkim, spokojnym i AI-aware sposobem rozwijania myśli, z płynnym przejściem do głębszej pracy i konwersji do artefaktów.
- Główny flow: utwórz ideę, rozwiń ją lekko, przejdź między canvasami bez utraty kontekstu, a potem promuj rezultat dalej.

#### 4.2 Current repo truth
- `IdeaMapWorkspace.tsx` jest realnym, dużym shell’em spinającym cztery work systems i prawy strip `Tools | Context | AI Suggestions`.
- `server/src/routes/my-work.routes.ts` ma realne API dla map, sync, expand, AI suggestions, gap-analysis, snapshots i comments.
- `MINDMAP_V8_READINESS_AUDIT.md` trafnie opisuje stan: dużo funkcji, dużo obietnicy, ale za mało spokoju i zaufania w interakcji.
- `IdeasMindMap.tsx` jest już tylko deprecated shimem, co potwierdza, że nowa prawda siedzi w `Idea Workspace`, nie w starym osobnym ekranie.
- To jest już realny produktowy fundament, ale jeszcze nie spokojny, leader-grade surface.

#### 4.3 Competitive standard
- Standard z `Whimsical` i podobnych mindmap tools: bardzo niski próg wejścia, szybki start, mało chrome, flow ponad konfiguracją.
- Standard z `Miro` i podobnych workspace canvases: użytkownik nie może czuć, że przełącza się między trzema niedokończonymi mini-apkami.
- U nas mocny jest wspólny shell, trwałość grafu i duża liczba zaawansowanych możliwości.
- Odstajemy tam, gdzie liderzy wygrywają najbardziej: prostota podstawowej gramatyki, spokój interakcji, branch-aware sidekick i czytelne menu/state.

#### 4.4 Main gaps
- Ocena 7 wymiarów:
- `User value` — user może realnie coś zbudować, ale czasem musi najpierw zrozumieć produkt zamiast problemu. Ocena: `średnia+`. Najważniejszy brak: zbyt wysoki koszt poznawczy na starcie.
- `Flow completeness` — create/open/edit/expand istnieje, ale idea -> map -> promotion nie jest jeszcze wystarczająco bezszwowa. Ocena: `średnia`. Najważniejszy brak: słaby founder-to-workspace happy path.
- `UX quality` — potężne, ale niespokojne. Ocena: `średnia`. Najważniejszy brak: brak jednej spokojnej gramatyki interakcji.
- `Data / logic quality` — graph runtime i persistence są mocne. Ocena: `mocna`. Najważniejszy brak: część zaawansowanych stanów jest trudna do zaufania z perspektywy usera.
- `Integration quality` — wspólny shell działa, ale przejścia i promotion flows nadal wymagają domknięcia. Ocena: `średnia+`. Najważniejszy brak: niedostatecznie oczywiste przejście do dalszej pracy i artefaktów.
- `Trust / governance / error handling` — proposal governance istnieje kierunkowo, ale nie wszystko czuć na powierzchni. Ocena: `średnia`. Najważniejszy brak: zbyt duża widoczna moc przy zbyt słabo zamrożonych zasadach.
- `Market standard fit` — moduł jest bardziej ambitny niż większość prostych mindmap, ale mniej wykończony w podstawowej ergonomii. Ocena: `średnia`. Najważniejszy brak: nie dość szybkie i oczywiste „zacznij myśleć”.
- Konkretne braki:
- brak dopiętego start path `founder -> workspace -> first useful structure`
- za ciężkie menu i state model w podstawowych akcjach
- chat/AI sidekick jest kierunkowo obecny, ale nie jest jeszcze kanonicznie pierwszoplanowy
- comments/review/collaboration są nierówne jako jedna historia produktu
- zbyt dużo mocy jest widoczne zanim user poczuje pełne zaufanie do podstaw

#### 4.5 Minimal acceptance state now
- User może utworzyć ideę lub wejść do istniejącej, rozpocząć od lekkiego startu i bez tarcia przejść do aktywnej pracy.
- `Mind Map` daje szybkie rozgałęzianie, czytelną edycję, proste AI assistance i spokojne menu bez poczucia „laboratorium”.
- Z jednej idei user może przejść dalej do innych canvasów i zachować kontekst.
- Przynajmniej jedna ścieżka promotion jest naprawdę czytelna: do notatki, zadania, inicjatywy albo innego artefaktu.
- Błędy dopuszczalne: brak pełnej realtime collaboration, ograniczony zakres facilitation, brak pełnej `Miro-class` dojrzałości.
- Czego nadal może nie być bez blokowania odbioru: pełna multiplayer warstwa, szeroka biblioteka template-driven workflows, głęboki workshop OS.

#### 4.6 Top missing functions
- founder-to-workspace happy path
- uproszczona interaction grammar dla mapy
- spokojniejsze menu i wyraźniejsze mode state
- branch-aware AI sidekick
- selection-aware chat handoff
- lepsze comments/review expectations
- czytelniejsze conversion flows do artefaktów
- mniejsze accidental complexity na starcie

#### 4.7 Proposed bounded delivery packets
- `Idea Start Path Closure`
- Cel: sprawić, żeby start pracy od pomysłu był lekki i zrozumiały.
- Zakres: new idea entry, preferred start, first structure, first CTA.
- Co dokładnie dowozimy: jeden silny happy path od pomysłu do aktywnej pracy.
- Czego świadomie nie ruszamy: pełnej przebudowy idea library lub template marketplace.
- Proof odbioru: nowy user wchodzi do idei i w mniej niż kilka minut ma sensowną strukturę roboczą.
- Ryzyka: zbyt dużo opcji startowych znowu podbije chaos.
- `Mindmap Interaction Grammar Pass`
- Cel: uspokoić podstawowe interakcje i zamrozić główny model pracy.
- Zakres: add/edit/branch/select/menu/state clarity.
- Co dokładnie dowozimy: calmer UX bez dokładania nowej szerokości.
- Czego świadomie nie ruszamy: pełnej broad feature expansion.
- Proof odbioru: podstawowe operacje są przewidywalne i nie wymagają „uczenia się produktu”.
- Ryzyka: łatwo zatrzymać się na kosmetycznych mikro-poprawkach.
- `Contextual AI Sidekick`
- Cel: uczynić AI częścią pracy nad ideą, a nie osobnym panelem bez świadomości kontekstu.
- Zakres: branch-aware suggestions, selection-aware chat handoff, proposal review discipline.
- Co dokładnie dowozimy: jeden czytelny model AI dla idei.
- Czego świadomie nie ruszamy: pełnego agentic runtime i szerokiej autonomii.
- Proof odbioru: AI pomaga na poziomie gałęzi i selekcji, a nie tylko całego dokumentu.
- Ryzyka: jeśli kontekst nie będzie spójny, sidekick będzie wyglądał na losowy.

#### 4.8 Risks and dependencies
- Krytyczna zależność: `Idea Workspace` musi pozostać jednym kontenerem, inaczej każdy kolejny canvas otworzy nowy split-brain.
- Ryzyko: dodawanie nowych capabilities przed zamrożeniem interaction grammar dalej obniży zaufanie.
- Zależność: promotion flows i artifact traceability wykraczają poza samą mapę i wymagają spójnych downstream contracts.

### Whiteboard / Proces flow / Tabele

#### 4.1 Intended product behavior
- Ta grupa miała być trzema natywnymi systemami pracy w jednym `Idea Workspace`, a nie trzema oddzielnymi mini-produktami.
- `Whiteboard` miał służyć do szybkiej, warsztatowej pracy sticky-first, klastrowania i syntezy.
- `Process Flow` miał przejmować moment, w którym luźny canvas nie wystarcza i potrzebna jest semantyka procesu, walidacja i interoperacyjność.
- `Tabele` miały być metadata-first table platform with workspace projections, osadzoną w architekturze produktu, a nie klonem Airtable obok aplikacji.

#### 4.2 Current repo truth
- `IdeaWhiteboardTool.tsx`, `IdeaProcessFlowTool.tsx` i `IdeaTableTool.tsx` są duże, realne i aktywnie wpięte do wspólnego shell’a.
- `Process Flow` ma lane-based editor, semantic kits, AI-assisted entry points, walidacje i auto-layout, ale dokumentacja sama wprost mówi, że nie jest to jeszcze pełny enterprise process system.
- `Whiteboard` ma sporo primitives, grouping, draw mode, timer/voting/follow-me seams i aktywne runtime state, ale nadal nie ma final whiteboard-grade interaction contract.
- `Tabele` mają zarówno bardzo szeroki frontend, jak i pełny backend `table-platform.routes.ts` z bazami, tabelami, polami, views, records, comments, automations i query semantics.
- Jednocześnie `Tabele` są najbardziej narażone na fałszywe poczucie kompletności: dużo kodu nie równa się jeszcze jednemu czytelnemu product operating model.

#### 4.3 Competitive standard
- `Miro` wygrywa szybkością wejścia, facilitation toolkit, template workflows i workshop confidence.
- `Lucidchart` i klasa BPMN/process tools wygrywają semantyką, properties, routing clarity, import/export oraz czytelnością dużych diagramów.
- `Airtable` wygrywa modelem `base -> tables -> fields -> views -> interfaces -> automations`.
- `Coda` wygrywa komponowaniem workflow ponad danymi i łączeniem tables z working context.
- U nas mocne jest jedno: te trzy surfaces nie są puste i nie są tylko mockami.
- Odstajemy tam, gdzie rynek stawia próg wiarygodności: zerowe tarcie w whiteboardzie, process-grade semantics w flow i spójny operating model w tabelach.

#### 4.4 Main gaps
- Ocena 7 wymiarów:
- `User value` — wartość jest realna, ale nierówna między trzema surface’ami. Ocena: `średnia`. Najważniejszy brak: brak jednego prostego, odbieralnego happy path per narzędzie.
- `Flow completeness` — można wejść i robić rzeczy, ale za rzadko czuć domknięcie od startu do użytecznego wyniku. Ocena: `średnia-`. Najważniejszy brak: zbyt wiele możliwości, zbyt mało jasno zdefiniowanych wyników pracy.
- `UX quality` — szerokość i moc są duże, spokój i przewidywalność mniejsze. Ocena: `średnia-`. Najważniejszy brak: tool-state i podstawowa ergonomia nie są jeszcze wystarczająco zamrożone.
- `Data / logic quality` — backend tabel i część graph persistence są mocne, ale process i whiteboard nadal mają podobszary słabiej zakontraktowane. Ocena: `średnia+`. Najważniejszy brak: niedomknięte product contracts dla properties, export, paste, traceability.
- `Integration quality` — wspólny shell jest poprawnym kierunkiem. Ocena: `mocna`. Najważniejszy brak: przełączanie narzędzi jest mocniejsze niż finalne cross-tool outcome model.
- `Trust / governance / error handling` — proposal governance istnieje kierunkowo, ale szczególnie w whiteboard/table łatwo przekroczyć granicę „to jest demo ogromu”. Ocena: `średnia`. Najważniejszy brak: za mało zamrożonych zasad, co jest production-grade, a co dojrzewa.
- `Market standard fit` — każdy z trzech modułów ma silne elementy, ale jako całość nadal odstajemy od liderów dokładnie tam, gdzie user robi główny flow. Ocena: `średnia-`. Najważniejszy brak: brak jednej wiarygodnej, bounded wersji każdego surface’u.
- Konkretne braki:
- `Whiteboard`: tool-state machine, paste/image pipeline, clustering flow, export, performance guardrails
- `Process Flow`: properties strip, rules engine + problems panel, routing clarity, BPMN round-trip, search/jump, artifact traceability
- `Tabele`: mocniejszy base-first UX, role views vs interfaces, schema governance UX, discovery/retrieval, bounded story dla forms/interfaces/automations bez udawania pełnego office platform
- brak surowego `Softs/tabele` w repo osłabia możliwość weryfikacji benchmarków przy najgłębszych decyzjach

#### 4.5 Minimal acceptance state now
- User w ramach jednej idei może przełączać się między `Whiteboard`, `Process Flow` i `Tabele` bez utraty kontekstu i bez wrażenia osobnych produktów.
- `Whiteboard` pozwala realnie przeprowadzić prosty warsztat: szybki capture, grupowanie, podstawowa synteza i czytelny zapis wyniku.
- `Process Flow` pozwala zamodelować czytelny proces z lanes, sensownymi połączeniami i podstawową walidacją oraz przygotować wynik do dalszej pracy.
- `Tabele` pozwalają pracować na jednej wiarygodnej ścieżce metadata-first z zapisem, view semantics i co najmniej jednym sensownym use case’em biznesowym.
- Wynik pracy może zostać zachowany, wrócić do wspólnej idei i zostać wypromowany dalej do artefaktu albo kolejnego kroku.
- Błędy dopuszczalne: brak pełnej realtime collaboration, brak pełnego BPMN parity, brak szerokiej Airtable/Coda breadth, ograniczony export.
- Czego nadal może nie być bez blokowania odbioru: pełny `Miro-class` facilitation OS, pełny enterprise BPMN suite, pełny spreadsheet/table platform program.

#### 4.6 Top missing functions
- cross-tool continuity i lepsza semantyka przełączania
- whiteboard interaction grammar
- whiteboard paste/image/export/performance contract
- affinity clustering i AI synthesis dla boardów
- process properties strip
- process problems panel i rules engine
- process routing + BPMN round-trip
- table base-first UX i schema governance UX
- jaśniejsza rola views / interfaces / forms / automations
- artifact traceability między canvases a downstream work

#### 4.7 Proposed bounded delivery packets
- `Cross-Canvas Continuity Baseline`
- Cel: upewnić usera, że nadal pracuje nad jedną ideą niezależnie od aktywnego narzędzia.
- Zakres: tool switching, context persistence, outcome visibility, cross-tool promotion cues.
- Co dokładnie dowozimy: jedną wiarygodną warstwę przejścia między trzema surfaces.
- Czego świadomie nie ruszamy: nowego workspace shell albo osobnych produktów per narzędzie.
- Proof odbioru: user przełącza narzędzia bez utraty sensu pracy i bez zgadywania, gdzie jest wynik.
- Ryzyka: jeśli outcome model pozostanie niejasny, przełączanie będzie tylko techniczne.
- `Whiteboard Workshop Baseline`
- Cel: zamienić whiteboard z „ma dużo feature’ów” na „da się nim poprowadzić sensowny warsztat”.
- Zakres: select/hand/draw grammar, sticky-first flow, clustering, paste/image basics, export minimum.
- Co dokładnie dowozimy: bounded whiteboard use pass user-facing.
- Czego świadomie nie ruszamy: pełnej collaborative Miro parity, broad design-tool ambitions.
- Proof odbioru: user jest w stanie przejść od chaosu do pogrupowanego wyniku na jednym boardzie.
- Ryzyka: zbyt duża chęć domknięcia wszystkiego naraz.
- `Process Flow Trust Baseline`
- Cel: zrobić z process flow narzędzie do realnego modelowania, a nie tylko ładny edytor diagramów.
- Zakres: properties strip, problem list, routing clarity, minimal import/export truth, traceability cues.
- Co dokładnie dowozimy: jeden process-grade happy path.
- Czego świadomie nie ruszamy: pełnego enterprise BPMN suite i całej szerokości interoperability programu.
- Proof odbioru: user modeluje proces, widzi problemy i potrafi wyprowadzić z niego sensowny kolejny krok.
- Ryzyka: bez mocnego priorytetu łatwo ugrzęznąć w bibliotekach shape’ów.
- `Table Platform Truth Elevation`
- Cel: pokazać userowi jedną wiarygodną, metadata-first ścieżkę pracy w tabelach.
- Zakres: base/table/view semantics, schema UX, one strong use case for forms/interfaces/automation adjacency, stronger bridge inside Idea Workspace.
- Co dokładnie dowozimy: spójny bounded table product slice.
- Czego świadomie nie ruszamy: pełnego office-style spreadsheet programu, całej szerokości Coda/Airtable parity.
- Proof odbioru: user rozumie strukturę bazy, potrafi na niej pracować i nie gubi się w tym, co jest kanoniczną prawdą danych.
- Ryzyka: zbyt łatwo ukryć brak operating modelu za samą ilością możliwości.

#### 4.8 Risks and dependencies
- Największe ryzyko: ukryte otwarcie `8.2` pod pretekstem „jeszcze tylko kilka braków”.
- Zależność: wszystkie trzy surfaces zależą od zachowania zasady `one idea = one workspace`.
- Ryzyko dokumentacyjne: `Softs/tabele` nie istnieje w workspace, więc najgłębsze benchmarkowe decyzje o tabelach trzeba opierać na istniejącym benchmark docu, nie na surowym korpusie.
- Ryzyko wykonawcze: to najbardziej kosztowna grupa zakresu, więc bez bounded packets bardzo szybko zabije tempo całej fali.

## 5. Cross-module dependencies
- `Landing / Anna` musi kończyć się spójnym wejściem do pierwszej wartości w produkcie, inaczej publiczna narracja i in-app doświadczenie będą mówiły dwoma różnymi językami.
- `MyWork / Radar` potrzebuje realnych handoffów do `Idea` i `Notes`, bo bez nich pozostanie ekranem interpretacji bez wykonania.
- `Idea / Mindmap` jest wspólnym kontenerem dla `Whiteboard / Process Flow / Tabele`, więc nie wolno wzmacniać narzędzi kosztem jedności workspace.
- `Whiteboard / Process Flow / Tabele` muszą oddawać wynik z powrotem do wspólnej idei i downstream artifacts, inaczej traceability rozpadnie się na lokalne pliki i stany.

## 6. Recommended execution order
- 1. `Landing / Anna`
- Uzasadnienie: najwyższa widoczność, najmniejsza głębokość technicznego ryzyka, najszybszy efekt w odbiorze produktu.
- 2. `MyWork / Radar`
- Uzasadnienie: drugi najsilniejszy efekt user-facing i najważniejszy kandydat na prawdziwy consulting home surface.
- 3. `Idea / Mindmap`
- Uzasadnienie: po uporządkowaniu wejścia i domknięciu strategicznego home’a można bezpiecznie poprawiać główny problem-solving workspace.
- 4. `Whiteboard / Process Flow / Tabele`
- Uzasadnienie: to najdroższy i najbardziej zdradliwy obszar; powinien wejść dopiero po zamrożeniu dwóch wyższych warstw produktu.
- Rekomendowana kolejność wewnątrz czwartego modułu:
- `Cross-Canvas Continuity Baseline`
- `Whiteboard Workshop Baseline`
- `Process Flow Trust Baseline`
- `Table Platform Truth Elevation`

## 7. Final recommendation
- Ten zakres da się doprowadzić do poziomu naprawdę dobrego produktu tylko wtedy, jeśli zespół przestanie mylić szerokość kodu z gotowością modułu.
- `Landing / Anna` należy potraktować jako warstwę zaufania i wejścia, nie jako kolejny ekran marketingowy do ozdobienia.
- `MyWork / Radar` należy potraktować jako pierwszy prawdziwy ekran decyzji, a nie agregator bloków z ciekawymi nazwami.
- `Idea / Mindmap` należy doprowadzić do stanu spokojnej, przewidywalnej pracy, zanim dołożona zostanie kolejna szerokość.
- `Whiteboard / Process Flow / Tabele` muszą być prowadzone brutalnie bounded, bo każdy z tych tematów ma naturalną skłonność do zamiany w osobny program `8.2`.
- Nie wolno uprościć ani zignorować trzech rzeczy:
- `public value clarity` na wejściu
- `signal -> action` w `Radar`
- `one idea = one workspace` jako nienaruszalnej zasady całego obszaru idei
- Jeśli te trzy zasady zostaną utrzymane, ten zakres można dowozić w małych pakietach bez chaosu. Jeśli nie, nawet duża liczba zmian będzie wyglądać jak niespójny zbiór półproduktów.
