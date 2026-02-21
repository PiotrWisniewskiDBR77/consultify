# V2 — Manual QA Checklist (T001–T122)

Cel: szybkie, powtarzalne testy manualne per task (do ClickUp + dla zespołu QA).

Zasady ogólne (stosuj do każdego taska, jeśli dotyczy):
- Sprawdź **happy path**, **error states**, **permissions/role**, **i18n** (min. EN+PL; gdzie public/marketing → 6 języków), **mobile** (jeśli UI), **audit/analytics** (jeśli w spec).
- Nie akceptujemy “stubów/placeholderów” w produkcyjnym flow (jeśli coś jest wyłączone — musi mieć jasny komunikat i reason).

---

## T001 — Chat Title Suggestion System
- [ ] Nowy chat dostaje sensowny tytuł automatycznie; tytuł jest widoczny w historii.
- [ ] User może ręcznie zmienić tytuł; zapis jest trwały po odświeżeniu.
- [ ] Tytuł nie ujawnia PII/sekretów (np. emaili, numerów).
- [ ] Działa dla wielu projektów/workspaces (brak mieszania tytułów).
- [ ] Edge: bardzo krótkie rozmowy → tytuł nadal czytelny (bez “Untitled” spam).

## T002 — Project Sidebar Collapse
- [ ] Sidebar można zwinąć/rozwinąć; stan jest zapamiętany (per user / per device).
- [ ] W trybie zwiniętym ikony/tooltipy są czytelne i dostępne.
- [ ] Klawiatura: focus/skrót (jeśli jest) działa; brak “focus trap”.
- [ ] Mobile: sidebar działa jako drawer i nie psuje layoutu.
- [ ] Edge: bardzo długa lista projektów — scroll i wydajność OK.

## T003 — Cloud Data Integration
- [ ] Można podłączyć źródło danych (autoryzacja/poświadczenia) i zobaczyć status połączenia.
- [ ] Pobranie danych działa i jest ograniczone uprawnieniami org/projektu.
- [ ] Błędy połączenia (invalid token / timeout) są czytelnie komunikowane i nie crashują UI.
- [ ] Dane nie “przeciekają” między organizacjami (tenant isolation).
- [ ] Audit/Log: widać kto dodał/zmienił integrację.

## T004 — Deep Thinking Module
- [ ] Toggle Deep Thinking działa; bez “confirm” system wymusza właściwy krok (jasny komunikat).
- [ ] Wynik jest w formacie deep-thinking (Executive summary/Options/Recommendation/Risks/Next actions).
- [ ] Jeśli web research włączony — odpowiedź cytuje źródła [1], [2] i nie udaje dodatkowego researchu.
- [ ] Limity kosztów/timeouty: UI dostaje sensowną odpowiedź “degraded” zamiast wisieć.
- [ ] Security: prompt injection próby są blokowane (lub redagowane) zgodnie z polityką.

## T005 — Market Research Module
- [ ] Research odpala się dla zapytań wymagających “aktualności” (lub po toggle), a nie dla każdego tekstu.
- [ ] Wynik zawiera sekcję źródeł + cytowania [n] (gdy użyte źródła).
- [ ] Edge: brak TAVILY_API_KEY → system komunikuje brak, nie udaje wyników.
- [ ] Output jest “boardroom-grade” (konkret: rekomendacje + założenia + ryzyka).
- [ ] Można zapisać/wyeksportować wynik jako artefakt (jeśli przewidziane w spec).

## T006 — Co‑Thinker Business Mode
- [ ] W czacie dostępny jest tryb/akcje “Business/Actions” (3. przycisk) i jest zrozumiały.
- [ ] AI sugeruje konkretne akcje (drafty) zamiast wykonywać je “na dziko”.
- [ ] Każda akcja wymaga jawnej zgody usera; brak nieautoryzowanych zapisów.
- [ ] Audit: decyzje/akcje są logowane i możliwe do prześledzenia.
- [ ] Edge: brak uprawnień → UI pokazuje blokadę i reason.

## T007 — Individual Tasks (ClickUp-like)
- [ ] CRUD zadań działa (create/edit/status/due date/assignee) + lista/filtry.
- [ ] Przypisania i widoczność zadań respektują role i organization/project boundaries.
- [ ] UI: szybkie operacje (keyboard/inline edit) nie gubią danych.
- [ ] Edge: duża liczba zadań → paginacja/scroll działa bez freezów.
- [ ] Audit/Activity: zmiany statusu są logowane.

## T008 — External System Synchronization (defer)
- [ ] Synchronizacja jest jawnie oznaczona jako “defer/post‑V2” w UI/dokumentacji (bez udawania).
- [ ] Jeśli są elementy stub — w prod wyłączone lub z wyraźnym komunikatem.
- [ ] Nie ma side‑effectów bez integracji (brak błędów w konsoli / brak dead links).
- [ ] Edge: włączenie feature flag (jeśli istnieje) nie psuje reszty modułu.

## T009 — My Ideas (Private Idea Repository)
- [ ] Można zapisać pomysł z czatu i znaleźć go później (search + tagi).
- [ ] Pomysły są prywatne per user (nie widzi ich inny user bez udostępnienia).
- [ ] Można powiązać pomysł z projektem/inicjatywą (jeśli przewidziane).
- [ ] Edge: eksport/usunięcie danych działa (GDPR).
- [ ] UI: Notion-like czytelność (brak “ciężkich” form).

## T010 — Project Calendar
- [ ] Widok kalendarza pokazuje kluczowe elementy (milestones/reporting/deadlines).
- [ ] Strefy czasowe: daty nie “przesuwają się” między userami.
- [ ] Filtry per projekt/typ zdarzeń działają.
- [ ] Mobile: kalendarz jest używalny (touch, brak overflow).
- [ ] Edge: brak danych → sensowny empty state.

## T011 — Intelligent Active Notebook (Notion-like)
- [ ] Tworzenie notatek, struktura (sekcje/bloki), szybkie zapisywanie.
- [ ] Notatki mogą być “aktywne” (linkowane do projektów/idei) i łatwo odnajdywalne.
- [ ] Wyszukiwarka działa (title + treść) i jest szybka.
- [ ] Uprawnienia: prywatne vs współdzielone (jeśli przewidziane) działają poprawnie.
- [ ] Edge: duża nota/dużo bloków → brak lagów.

## T012 — Contextual Intelligence Feed (Chat-active)
- [ ] Feed pokazuje rzeczy “ważne” kontekstowo (zrozumiały priorytet).
- [ ] Można odrzucić/wyciszyć elementy; nie wracają nachalnie.
- [ ] Feed nie pokazuje wrażliwych danych bez uprawnień.
- [ ] Mobile: feed jest czytelny i klikalny.
- [ ] Analytics: eventy typu “opened/dismissed” są rejestrowane (jeśli w spec).

## T013 — Conversational Control Questions (AI interview conductor)
- [ ] AI zadaje pytania kontrolne w logicznej kolejności i nie dubluje ich bez powodu.
- [ ] Można przerwać/wrócić do wywiadu; stan jest zachowany.
- [ ] Raport/wnioski powstają na bazie odpowiedzi (bez halucynacji “faktów”).
- [ ] i18n: PL/EN co najmniej; style pytań naturalny.
- [ ] Edge: brak odpowiedzi/“nie wiem” → AI proponuje alternatywę.

## T014 — Modern Survey Experience (N‑mode first, C‑mode later)
- [ ] Ankieta jest nowoczesna, szybka i “premium” (N‑mode layout).
- [ ] Walidacje (required/range) są czytelne i nie frustrują.
- [ ] Zapis postępu działa; powrót do ankiety przywraca stan.
- [ ] Mobile: ergonomia touch + brak overflow.
- [ ] Edge: wolne łącze → brak utraty danych.

## T015 — External AI Self‑Assessment Link (public mini‑assessment)
- [ ] Publiczny link działa bez logowania i prowadzi do mini-oceny.
- [ ] Anty‑spam: rate limiting / captcha (jeśli przewidziane) lub minimum zabezpieczeń.
- [ ] Wynik jest jasny, a CTA do trial jest spójne i mierzalne.
- [ ] i18n: 6 języków + RTL dla ar (jeśli to public web).
- [ ] Privacy: user wie co jest zbierane i gdzie trafia.

## T016 — Advanced Insight Inference Engine (sponsor‑ready, structured)
- [ ] AI generuje wnioski strukturalne (nie “blog”), z założeniami i ryzykami.
- [ ] Wnioski są spójne z danymi wejściowymi (wywiad/kontekst).
- [ ] Można wygenerować “evidence”/uzasadnienia (bez PII).
- [ ] Edge: sprzeczne dane → AI to zaznacza.
- [ ] Output można zapisać jako artefakt do kontekstu.

## T017 — Sponsor‑Level Analysis Report (N‑mode first, PPTX export)
- [ ] Raport sponsor‑ready ma spójny układ, executive summary i rekomendacje.
- [ ] Eksport (PDF/PPTX jeśli jest) jest poprawny wizualnie i treściowo.
- [ ] i18n: język raportu zgodny z językiem projektu/użytkownika.
- [ ] Edge: brak danych → raport jasno wskazuje “gaps” zamiast halucynować.
- [ ] Raport jest dostępny w historii i linkowalny.

## T018 — Known Tools Module (library + education, N‑mode)
- [ ] Lista narzędzi ma wyszukiwarkę/filtry; każde narzędzie ma kartę.
- [ ] Karta narzędzia: opis + wideo + link do edukacji działają.
- [ ] Można wybrać narzędzie do pracy i przejść do właściwego flow.
- [ ] i18n: treści podstawowe EN/PL.
- [ ] Edge: brak wideo/zasobu → fallback bez dead ends.

## T019 — Development of First 10 Consulting Tools (action‑driven output)
- [ ] Każde z 10 narzędzi ma kompletne flow: input → przetworzenie → wynik.
- [ ] Wynik jest używalny (do raportu/presentacji/inicjatywy), nie “symboliczny”.
- [ ] Walidacje inputu + sensowne komunikaty błędów.
- [ ] Uprawnienia: kto może tworzyć/edytować wyniki.
- [ ] Edge: puste dane → narzędzie prowadzi usera krokami.

## T020 — Tool‑Linked Knowledge Base (how‑to + best practices + video)
- [ ] Dla narzędzia dostępne są materiały “jak używać” + best practices.
- [ ] AI potrafi wskazać właściwy materiał z kontekstu narzędzia.
- [ ] Linki są kanoniczne i nie prowadzą do 404.
- [ ] i18n: min EN/PL; reszta jeśli publiczna.
- [ ] Edge: brak materiału → UI proponuje alternatywę (np. “request content”).

## T021 — Visual Tool Library Interface (module hub + education-in-moment)
- [ ] “Tools hub” ma spójny UI (N‑style) i szybkie wejście do narzędzi.
- [ ] Wybór obszaru + narzędzia jest szybki; brak zbędnych kroków.
- [ ] Każde narzędzie ma widoczną wartość i CTA “Start”.
- [ ] Mobile: tabela/lista działa jako wygodna lista/karty.
- [ ] Edge: uprawnienia/licencje → narzędzia zablokowane z powodem.

## T022 — Development of 10 Operational Improvement Tools (measurable impact)
- [ ] 10 narzędzi działa end‑to‑end z realnymi wynikami (metryki, rekomendacje).
- [ ] Wyniki można zapisać jako artefakt i wykorzystać dalej.
- [ ] Walidacje i komunikaty są spójne w całym module.
- [ ] Edge: dane wejściowe niepełne → narzędzie prosi o brakujące informacje.
- [ ] Export/share działa zgodnie ze spec.

## T023 — Development of 10 Digital Transformation Tools (execution‑ready)
- [ ] 10 narzędzi cyfrowej transformacji ma kompletne flow i spójny UI.
- [ ] Rezultaty prowadzą do inicjatyw/zadań (jako drafty) i są audytowalne.
- [ ] i18n: nazwy/CTA przetłumaczone min EN/PL.
- [ ] Edge: konflikty danych → jasne ostrzeżenia i next steps.
- [ ] Performance: narzędzia nie robią ciężkich operacji bez progress/timeout.

## T024 — Speed Tool – Process Automation Framework (canonical automation method)
- [ ] Tool prowadzi przez krok po kroku (diagnoza → automatyzacja → wdrożenie).
- [ ] Output zawiera plan działań + ryzyka + zależności.
- [ ] Można wygenerować “implementation-ready” artefakt (do T060/T058).
- [ ] Edge: brak danych procesowych → tool proponuje minimalny zestaw pytań.
- [ ] UI jest spójne z resztą narzędzi (N‑style).

## T025 — Rename Module: Assessment → Licensed Tools (UI + i18n + nav)
- [ ] Nazwa modułu zmieniona w UI, nawigacji, breadcrumbs i tytułach.
- [ ] i18n: EN/PL (i reszta jeśli włączona) bez brakujących kluczy.
- [ ] Stare linki/route’y mają poprawne przekierowanie lub alias.
- [ ] Uprawnienia i dostęp do licencjonowanych narzędzi bez zmian/regresji.
- [ ] Edge: deep link do starego miejsca nie daje 404.

## T026 — Finalize SIRI and ADMA Tools (Content + UI parity z DRD)
- [ ] SIRI/ADMA mają jakość UX/UI analogiczną do DRD (czytelność, flow).
- [ ] Wyniki są sensowne, spójne i gotowe do raportowania.
- [ ] Export/artefakty działają (PDF/PPTX/Report jeśli dotyczy).
- [ ] i18n: min EN/PL.
- [ ] Edge: skrajne odpowiedzi (min/max) → wyniki nadal logiczne.

## T027 — Report and Presentation Templates for DRD, SIRI, and ADMA
- [ ] Szablony raportów i prezentacji są dostępne i auto‑wypełniają dane.
- [ ] Wygląd jest “executive-ready” (typografia, hierarchy, brand).
- [ ] Działa dla DRD/SIRI/ADMA bez brakujących sekcji.
- [ ] i18n: język raportu zgodny z wyborem.
- [ ] Edge: brak części danych → szablon pokazuje placeholder “missing data” jawnie.

## T028 — Lean 4.0 Audit and Implementation Framework
- [ ] Flow audytu Lean działa end‑to‑end (zbieranie → analiza → plan).
- [ ] AI działa jak audytor/trener/lean expert (konkret, bez lania wody).
- [ ] Wyniki są powiązane z inicjatywami i nadają się do wdrożenia.
- [ ] Mobile/web: zbieranie danych jest szybkie i nie psuje layoutu.
- [ ] Edge: przerwanie audytu → resume działa.

## T029 — Mobile Application for Lean 4.0 Data Collection (floor-only capture)
- [ ] UX jest “field capture”: minimal steps, szybkie notatki/zdjęcia (jeśli są).
- [ ] Offline/poor network: brak utraty danych (kolejka / retry).
- [ ] Dane trafiają do właściwego projektu/obszaru (bez pomyłek).
- [ ] Uprawnienia: tylko właściwi userzy mogą wysyłać/oglądać dane.
- [ ] Edge: duże pliki → limity i komunikaty.

## T030 — External PDF Import and Mapping
- [ ] Import PDF działa; mapping do wewnętrznego modelu jest poprawny.
- [ ] User może poprawić mapping ręcznie (bez “czarnej skrzynki”).
- [ ] Edge: słabe PDF (skan) → jasny komunikat i fallback.
- [ ] Dane po imporcie można wykorzystać w raportach/inicjatywach.
- [ ] Audit: widać kto importował i z jakiego pliku.

## T031 — Integration of Additional Paid Assessments
- [ ] Można dodać nowy assessment w formacie integracyjnym bez zmian w wielu miejscach.
- [ ] UI i flow są spójne z istniejącymi assessmentami.
- [ ] Licencje/uprawnienia są respektowane.
- [ ] i18n: nazwy/CTA dostępne min EN/PL.
- [ ] Edge: brak licencji → gating z jasnym powodem.

## T032 — AI Support for Initiative, Task, and Decision Authoring
- [ ] AI potrafi uzupełniać pola (summary/risks/benefits) i całe karty jako draft.
- [ ] Zawsze wymaga akceptacji usera przed zapisem.
- [ ] Jakość tekstu: DRD-level (konkret, struktura, wnioski).
- [ ] Edge: brak danych → AI zadaje max 3 pytania doprecyzowujące.
- [ ] Audit: zapis draftów i akceptacji jest śledzalny.

## T033 — AI Readiness and Stage‑Gate Validation for Initiatives
- [ ] Gate readiness check działa i pokazuje realne blokery.
- [ ] AI tłumaczy “dlaczego blokuje” + proponuje next steps.
- [ ] Uprawnienia: tylko role z prawem mogą przechodzić gate.
- [ ] Edge: inicjatywa w różnych statusach → check adekwatny.
- [ ] UI: N‑style (czytelne sekcje, brak chaosu).

## T034 — AI Correlation and Optimization Across Initiatives
- [ ] AI wskazuje zależności/konflikty między inicjatywami i podaje uzasadnienie.
- [ ] Proponowane zmiany są “safe”: jako sugestie/drafty, nie auto‑zmiany.
- [ ] Edge: brak danych → AI zaznacza assumptions.
- [ ] Performance: analiza nie wiesza UI; jest progress/limit.
- [ ] Audit/analytics: log “optimization suggested” (jeśli przewidziane).

## T035 — Cross‑Initiative Time Optimization Engine
- [ ] System potrafi zasugerować sekwencję i wąskie gardła.
- [ ] Scenariusze (co jeśli) są czytelne i porównywalne.
- [ ] Edge: sprzeczne terminy/constraints → wykryte i pokazane.
- [ ] Export do raportu/prezentacji działa.
- [ ] Uprawnienia: tylko właściwe role mogą edytować plan.

## T036 — AI Workload Forecasting and Intelligent Task Allocation
- [ ] Forecast obciążenia jest spójny z liczbą zadań i terminami.
- [ ] Sugestie przydziału uwzględniają kompetencje (jeśli dostępne).
- [ ] Edge: brak danych o zasobach → AI prosi o minimalne dane.
- [ ] UI pokazuje “why” (explainability).
- [ ] Audit: zmiany przydziałów wymagają zgody.

## T037 — Non‑Human Resource Allocation for Parallel Initiatives
- [ ] System pozwala planować budżety/narzędzia/infra jako zasoby “non‑human”.
- [ ] Konflikty zasobów są wykrywane i wizualizowane.
- [ ] Edge: brak kosztów → jasne “missing data”.
- [ ] Integracja z budżetowaniem/finansami (jeśli dotyczy) nie rozjeżdża się.
- [ ] Uprawnienia: dostęp do finansowych danych jest ograniczony.

## T038 — Scenario‑Based Timeline and Budget Optimization
- [ ] Można porównać scenariusze (czas vs koszt) i wybrać rekomendowany.
- [ ] Założenia są jawne i edytowalne.
- [ ] Edge: skrajne parametry → brak błędów obliczeń.
- [ ] Export do raportu/prezentacji działa i jest czytelny.
- [ ] Audit: wybór scenariusza zapisany.

## T039 — Timeline Management (Execution Module)
- [ ] Harmonogram pokazuje plan vs actual i jest edytowalny.
- [ ] Zmiany timeline nie psują innych modułów (inicjatywy/zadania).
- [ ] Edge: brak dat → system prowadzi usera do uzupełnienia.
- [ ] Mobile: podstawowe akcje wykonalne.
- [ ] Audit/Activity: zmiany timeline logowane.

## T040 — Risk Signaling and Mitigation Management
- [ ] Rejestr RAID działa (create/edit/status/owner).
- [ ] System sygnalizuje ryzyka (alerty) i proponuje mitigacje.
- [ ] Edge: duża liczba ryzyk → filtry i wydajność OK.
- [ ] Uprawnienia: kto może edytować vs tylko oglądać.
- [ ] Report/export ryzyk działa.

## T041 — Delay Detection and Schedule Control
- [ ] System wykrywa opóźnienia na podstawie plan vs actual.
- [ ] Alerty są sensowne (bez spamu) i mają actionable next steps.
- [ ] Edge: brak baseline planu → system to komunikuje.
- [ ] UI pokazuje przyczynę (dependency/resource/unknown).
- [ ] Audit: alerty i decyzje “acknowledged” logowane.

## T042 — Budget Planning and Financial Control (AI‑supported)
- [ ] Budżet można planować i porównywać z wykonaniem.
- [ ] AI rozróżnia założenia vs fakty (nie miesza).
- [ ] Edge: brak danych finansowych → jasny komunikat + co trzeba dodać.
- [ ] Uprawnienia: dane finansowe tylko dla uprawnionych.
- [ ] Export do raportu działa.

## T043 — Human Resource Management and Capability Alignment
- [ ] Można przypisać zasoby ludzkie + kompetencje do inicjatyw/zadań.
- [ ] System wykrywa braki kompetencyjne i sugeruje działania.
- [ ] Edge: niepełne profile userów → brak crash, sensowny fallback.
- [ ] Uprawnienia: dane HR widoczne zgodnie z rolą.
- [ ] UI jest czytelne i szybkie (inline edit).

## T044 — Change Emotion and Sentiment Management
- [ ] Zbieranie sygnałów sentimentu jest privacy‑first (brak PII w logach).
- [ ] AI nie robi “nadinterpretacji”; pokazuje niepewność i evidence.
- [ ] Edge: mało danych → system to zaznacza.
- [ ] Uprawnienia: dostęp ograniczony (np. tylko sponsor/PM).
- [ ] Audit: konfiguracja i użycie logowane.

## T045 — Stakeholder Communication and Change Communication Management
- [ ] Można planować komunikację (cadence, segmenty) i logować wysyłki.
- [ ] Treści mają jakość enterprise (krótkie, konkretne, role-aware).
- [ ] Edge: brak odbiorców → system prowadzi do konfiguracji.
- [ ] i18n: język komunikacji zgodny z odbiorcą (jeśli dotyczy).
- [ ] Audit: kto wysłał/co wysłał.

## T046 — Initiative ROI Tracking and Validation
- [ ] ROI ma założenia + tracking “realized vs projected”.
- [ ] Można wprowadzać aktualizacje okresowe i zobaczyć trend.
- [ ] Edge: brak baseline → system wymusza/komunikuje.
- [ ] Export do raportu działa.
- [ ] Uprawnienia: kto może edytować finanse.

## T047 — Initiative‑to‑KPI Mapping and Performance Tracking
- [ ] Mapowanie KPI ↔ initiative działa i jest widoczne w obu kierunkach.
- [ ] Time series KPI działa (import/manual) i jest czytelny.
- [ ] Edge: KPI bez jednostki/targetu → walidacja.
- [ ] UI: wykresy/summary bez chaosu.
- [ ] Export do raportu działa.

## T048 — KPI Impact Attribution Analysis
- [ ] Attribution pokazuje wkład inicjatyw + niepewność (nie “pewne” liczby).
- [ ] Wynik jest sponsor‑grade (explainability + assumptions).
- [ ] Edge: mało danych → wynik “low confidence” z powodem.
- [ ] Export/report działa.
- [ ] Uprawnienia: dostęp do metryk zgodnie z rolą.

## T049 — KPI to Financial Statement Mapping
- [ ] Mapowanie KPI → BS/P&L/CF jest transparentne i edytowalne.
- [ ] Zmiana mapowania wpływa na wyliczenia w sposób przewidywalny.
- [ ] Edge: KPI w wielu miejscach → konflikt rozwiązywalny.
- [ ] Audit: zmiany mappingu logowane.
- [ ] Export/report działa.

## T050 — Automated Financial Statement Ingestion and Standardization
- [ ] Import statements (BS/P&L/CF) działa; model jest spójny.
- [ ] Walidacje: aktywa = pasywa (tam gdzie wymagane) i komunikaty są jasne.
- [ ] Edge: brak pozycji/niestandardowy format → mapping UI/fallback.
- [ ] Uprawnienia: tylko uprawnieni widzą surowe dane.
- [ ] Audit: kto importował, kiedy, z jakiego pliku.

## T051 — Comprehensive Financial Ratio Analysis
- [ ] Ratio analysis liczy poprawnie (liquidity/profitability/leverage/efficiency/growth).
- [ ] Benchmarki (jeśli dostępne) są oznaczone źródłem/zakresem.
- [ ] Edge: dzielenie przez zero/brak danych → brak błędu, sensowny wynik.
- [ ] Wynik jest czytelny i exportowalny.
- [ ] i18n: nazwy wskaźników w EN/PL.

## T052 — Full Financial Analysis and Interpretation
- [ ] Analiza (vertical/horizontal/historical) jest spójna z danymi.
- [ ] AI/insights rozróżnia fakty vs interpretacje (jawne).
- [ ] Edge: dane sprzeczne → wykryte i opisane.
- [ ] Export (report/presentation) wygląda profesjonalnie.
- [ ] Uprawnienia: wrażliwe dane tylko dla uprawnionych.

## T053 — Fundamental Budgeting
- [ ] Driver-based budgeting działa i jest spójny z statements/KPI.
- [ ] User może edytować założenia i widzi wpływ na wynik.
- [ ] Edge: brak driverów → system prowadzi przez minimalny setup.
- [ ] Export/report działa.
- [ ] Audit: zmiany założeń logowane.

## T054 — Financial Modeling of Initiatives (P&L+BS+CF connected)
- [ ] Model inicjatywy spina P&L/BS/CF i bilansuje się (aktywa=pasywa).
- [ ] Economic events wpływają poprawnie na wszystkie trzy sprawozdania.
- [ ] Edge: parametry skrajne → brak “NaN”/błędów.
- [ ] Explainability: widać skąd liczby (assumptions).
- [ ] Export (deck/report) sponsor‑ready.

## T055 — Enterprise Valuation Module (professional DCF + comps)
- [ ] DCF (discount rate, terminal value) działa i jest spójny liczbowo.
- [ ] Comps (jeśli użyte) mają źródła/założenia (bez halucynacji).
- [ ] Edge: brak danych wejściowych → system wymusza minimum.
- [ ] Wynik jest “VC‑deck grade” i exportowalny.
- [ ] Audit: zmiany parametrów wyceny logowane.

## T056 — Valuation Improvement Advisory Module
- [ ] Rekomendacje poprawy wyceny są konkretne i mapują się na inicjatywy.
- [ ] AI zaznacza założenia i ryzyka; nie obiecuje gwarantowanych efektów.
- [ ] Edge: brak danych → rekomendacje ograniczone + lista braków.
- [ ] Draft inicjatyw/zadań wymaga akceptacji usera.
- [ ] Export/report działa.

## T057 — Valuation Negotiation Argument Builder
- [ ] Generator argumentów tworzy pro/contra, objections & rebuttals.
- [ ] Output jest “deck‑ready” (czytelne, krótkie, konkretne).
- [ ] Edge: brak kontekstu transakcji → AI prosi o kluczowe dane.
- [ ] i18n: język zgodny z userem.
- [ ] Audit: zapis artefaktu negocjacyjnego.

## T058 — Presentation Generator (Gamma-level quality)
- [ ] Generator tworzy slajdy o jakości “BCG‑grade” (layout, hierarchy, spójność).
- [ ] Można edytować układ/sekcje (agent‑like) bez psucia całości.
- [ ] Dane z platformy są poprawnie wstrzyknięte (bez mixu projektów).
- [ ] Export PPTX działa (fonty, układ, grafiki).
- [ ] Edge: brak danych → slajdy pokazują “gaps” jawnie.

## T059 — Business Presentation Templates
- [ ] Biblioteka template’ów działa; wybór typu decku jest prosty.
- [ ] Template’y są spójne z brand kit (kolory/typografia).
- [ ] Auto‑populate działa z danych platformy.
- [ ] i18n: EN/PL (gdzie dotyczy).
- [ ] Edge: template brak zasobu → fallback bez dead end.

## T060 — Structured Report Generator
- [ ] Generator raportów ma block builder i czytelny N‑style układ.
- [ ] Raporty są “pro formatting” i gotowe do eksportu.
- [ ] Walidacje: brak danych/sekcji → komunikat i propozycja uzupełnienia.
- [ ] Export PDF działa (spójne paginacje).
- [ ] Uprawnienia: raporty widoczne zgodnie z rolą.

## T061 — Standardized Business Report Templates
- [ ] Biblioteka szablonów raportów działa (use-case presets).
- [ ] Auto‑populate i edycja działa bez psucia layoutu.
- [ ] Edge: duży raport → performance OK.
- [ ] i18n: język raportu działa.
- [ ] Export działa.

## T062 — Automated Recurring and Event‑Triggered Reporting
- [ ] Można ustawić harmonogram (czas) i triggery (eventy).
- [ ] Raport/deck generuje się i wysyła do właściwych odbiorców.
- [ ] Edge: trigger spam → cooldown/guardrails działają.
- [ ] Audit: widać historię wysyłek i błędy.
- [ ] Uprawnienia: tylko uprawnieni mogą konfigurować wysyłki.

## T063 — Organization Module – UX and Visual Redesign
- [ ] UI organizacji jest spójne z “Tech Sexy” i resztą aplikacji.
- [ ] Najważniejsze akcje są łatwe do znalezienia (IA).
- [ ] Mobile: brak broken layoutów.
- [ ] i18n: EN/PL, brak missing keys.
- [ ] Edge: org bez danych → premium empty state.

## T064 — Relocation of Megatrend Analysis
- [ ] Megatrends przeniesione bez utraty funkcji (stare linki działają).
- [ ] UI/nawigacja wskazuje nowe miejsce jednoznacznie.
- [ ] Edge: deep link do starego route → redirect/alias.
- [ ] Uprawnienia bez regresji.
- [ ] Smoke: megatrends render bez błędów.

## T065 — Change Team Management – Competency Identification
- [ ] Taxonomy kompetencji jest dostępna i spójna w UI.
- [ ] Można przypisać kompetencje do ról i inicjatyw.
- [ ] Edge: duża liczba kompetencji → search/filtry.
- [ ] Uprawnienia: HR dane ograniczone.
- [ ] Export/report działa (jeśli przewidziane).

## T066 — Skills Gap Analysis Module
- [ ] System liczy “gaps” (requirements vs availability) i pokazuje priorytety.
- [ ] Rekomendacje działań (szkolenia/rekrutacja) są konkretne.
- [ ] Edge: brak danych wejściowych → onboarding/guide.
- [ ] Audit: zmiany wymagań i wyników są logowane.
- [ ] UI: czytelne wykresy/summary.

## T067 — CV‑Based Role and Task Matching Engine
- [ ] CV ingestion działa (privacy-safe) i mapuje kompetencje.
- [ ] Ranking dopasowania jest explainable (“dlaczego ten kandydat”).
- [ ] Edge: CV w różnych formatach → sensowny fallback.
- [ ] GDPR: export/delete CV danych działa.
- [ ] Uprawnienia: dostęp do CV tylko dla uprawnionych.

## T068 — Onboarding and Platform Introduction System
- [ ] “First 30 minutes” ścieżka prowadzi usera przez kluczowe moduły.
- [ ] Onboarding nie blokuje pracy; można pominąć i wrócić.
- [ ] i18n: EN/PL (i reszta jeśli włączona).
- [ ] Edge: user już onboarded → brak powtarzania.
- [ ] Analytics: completion milestones są logowane.

## T069 — Automated Feature News and Update Communication System
- [ ] Release notes pokazują się w app w odpowiednim momencie.
- [ ] Można oznaczyć jako przeczytane; nie spamuje.
- [ ] Email (jeśli włączony) trafia do właściwych userów.
- [ ] i18n: treść w języku usera.
- [ ] Audit/analytics: “seen/clicked” logowane.

## T070 — Rewrite Platform Overview Content (Help + Website + Landing Page)
- [ ] Nowa narracja jest spójna między Help/WWW/Landing.
- [ ] i18n: 6 języków (public) + RTL ar.
- [ ] Linki do docs i deep links działają (brak 404).
- [ ] SEO: title/description/og tags poprawne.
- [ ] Mobile: sekcje czytelne.

## T071 — Connect Help Documentation to AI Context Engine
- [ ] AI odpowiedzi o “jak coś zrobić” cytują help docs (jeśli dostępne).
- [ ] Aktualizacja docs → AI ma świeże cytowania po reindex.
- [ ] Edge: brak artykułu → AI mówi “brak źródła” i proponuje co dodać.
- [ ] Security: injection w treści docs nie psuje system promptu.
- [ ] Analytics: usage help docs logged.

## T072 — Context‑Sensitive Help Navigation
- [ ] W danym ekranie help prowadzi do właściwego artykułu (mapping działa).
- [ ] Deep links otwierają właściwą sekcję (anchor/slug).
- [ ] i18n: język help zgodny z userem.
- [ ] Edge: brak mapowania → sensowny fallback (search).
- [ ] Mobile: help dostępny i nie zasłania UI.

## T073 — Contextual Micro‑Video Help System
- [ ] Micro‑video pokazuje się we właściwym kontekście i da się zamknąć.
- [ ] Nie pokazuje się w kółko (dismiss/seen działa).
- [ ] Wideo ładuje się szybko; fallback bez wideo działa.
- [ ] i18n: napisy/tytuły min EN/PL.
- [ ] Analytics: play/complete logged.

## T074 — Education Module – Platform Fundamentals Series
- [ ] Biblioteka lekcji działa; można kontynuować progres.
- [ ] Lekcje są dostępne w kontekście modułów (“in moment”).
- [ ] i18n: EN/PL.
- [ ] Edge: brak treści → placeholdery niedozwolone (jasny komunikat).
- [ ] Mobile: UX czytelny.

## T075 — Education Module – Change Management Foundations
- [ ] Content jest spójny z flow platformy (inicjatywy/governance).
- [ ] Linki do narzędzi i praktyk działają.
- [ ] i18n: EN/PL.
- [ ] Edge: brak modułu → brak dead ends.
- [ ] Tracking progresu działa.

## T076 — Education Module – Prompt Engineering and Advanced AI Usage
- [ ] “Recipes” realnie poprawiają wyniki w Consultify (przykłady działają).
- [ ] UI pokazuje jak włączyć tryby AI (web search/deep thinking).
- [ ] i18n: EN/PL.
- [ ] Edge: brak dostępu do AI (quota) → edukacja nadal dostępna.
- [ ] Linki do prompt assistant działają.

## T077 — Knowledge Module – Core Consulting Tools Library
- [ ] Każde narzędzie ma: purpose → how to use → outcomes → start.
- [ ] Search/filters działają.
- [ ] i18n: EN/PL.
- [ ] Edge: brak materiału → jawny brak, brak placeholderów “lorem”.
- [ ] Link do startu narzędzia działa.

## T078 — Knowledge Module – Licensed Assessment Tools Library
- [ ] DRD/SIRI/ADMA mają opis metodologii + trust.
- [ ] Linki do uruchomienia assessmentu działają.
- [ ] i18n: EN/PL.
- [ ] Uprawnienia/licencje: gating z jasnym powodem.
- [ ] Edge: brak licencji → nie ma dead endów.

## T079 — Education Module – Managing Initiatives in Transformation
- [ ] Kurs uczy lifecycle + governance; linkuje do funkcji w app.
- [ ] i18n: EN/PL.
- [ ] Progres działa; resume działa.
- [ ] Edge: brak materiału video → fallback.
- [ ] Mobile: UX OK.

## T080 — Education Module – Financial Analysis and Modeling
- [ ] Treści spójne z modułami finansowymi (T050–T055).
- [ ] i18n: EN/PL.
- [ ] Linki do przykładów/artefaktów działają.
- [ ] Edge: brak danych demo → materiały nadal zrozumiałe.
- [ ] Progres tracking działa.

## T081 — Education Module – Budgeting and Financial Planning
- [ ] Lekcje odnoszą się do driver-based budgeting (T053).
- [ ] i18n: EN/PL.
- [ ] Checklisty/ćwiczenia są używalne.
- [ ] Edge: brak uprawnień do finansów → edukacja nadal dostępna.
- [ ] Progres tracking działa.

## T082 — Education Module – ROI Analysis and Investment Evaluation
- [ ] Materiał odnosi się do ROI tracking (T046) i inicjatyw.
- [ ] i18n: EN/PL.
- [ ] Przykłady są konkretne i poprawne merytorycznie.
- [ ] Edge: user bez danych → “how to start” działa.
- [ ] Progres działa.

## T083 — Education Module – KPI System Design and Performance Architecture
- [ ] Materiał pokrywa KPI↔initiatives↔finance (T047/T049).
- [ ] i18n: EN/PL.
- [ ] Mapy/przykłady są czytelne.
- [ ] Edge: brak KPI → guide do setupu.
- [ ] Progres działa.

## T084 — Education Module – Building Presentations in the Platform
- [ ] Walkthrough T058/T059 działa i linkuje do generatora.
- [ ] i18n: EN/PL.
- [ ] Przykłady decków są jakościowe (bez placeholderów).
- [ ] Edge: brak danych → pokazuje jak użyć demo danych.
- [ ] Progres działa.

## T085 — Education Module – Report Template Design and Usage
- [ ] Walkthrough T060/T061 prowadzi po krokach.
- [ ] i18n: EN/PL.
- [ ] Przykłady raportów są “sponsor‑ready”.
- [ ] Edge: brak template’ów → jasno komunikowane.
- [ ] Progres działa.

## T086 — Build Unified Sync Hub for External Work Systems
- [ ] Hub integracji pokazuje statusy connectorów i pozwala je konfigurować.
- [ ] Uprawnienia: tylko Admin/SuperAdmin może zarządzać integracjami.
- [ ] Edge: brak connectora → jasny komunikat (nie stub).
- [ ] Audit: zmiany integracji logowane.
- [ ] UI: spójne, enterprise-grade.

## T087 — Create Demo Company Story – Archilex
- [ ] Story jest spójne w UI (narracja, postacie, kontekst).
- [ ] Dane nie są “puste”: widoczne realne wartości i zależności.
- [ ] i18n: EN/PL (minimum).
- [ ] Edge: reset demo działa (powtarzalność).
- [ ] Flow: story wspiera demo→trial conversion.

## T088 — Develop Demo Website for Archilex Transformation
- [ ] Strona case działa (IA, sekcje, visuals) i jest spójna z brand.
- [ ] Linki do aplikacji/trial działają.
- [ ] i18n: 6 języków (public) + RTL ar.
- [ ] SEO/meta działają.
- [ ] Mobile: premium.

## T089 — Build Comprehensive Demo Dataset – Archilex
- [ ] Dataset ma 3–4 userów, wiele wariantów funkcji i brak dead ends.
- [ ] Dane są deterministyczne (reset przywraca stan).
- [ ] Edge: przejście przez kluczowe moduły działa bez 404/500.
- [ ] Uprawnienia w demo są realistyczne (admin/user roles).
- [ ] Performance: demo nie jest ciężkie.

## T090 — Design Demo-to-Trial Conversion Flow
- [ ] Demo ma jasne CTA do trial; eventy są mierzalne (analytics).
- [ ] Po konwersji user trafia do trial z właściwym stanem i komunikacją.
- [ ] Edge: user wraca do demo → jasne zasady i brak chaosu.
- [ ] Copy: transparentne zasady trial (czas/limity).
- [ ] Billing: brak niejawnych paywalli.

## T091 — Define Technical Trial Architecture and Access Rules
- [ ] DEMO/TRIAL/PAID działają jako polityka dostępu; gating jest “honest”.
- [ ] Limity trial (quota) są egzekwowane i komunikowane.
- [ ] Edge: przekroczenie limitu → CTA upgrade + brak crash.
- [ ] Admin/SuperAdmin widzi status org (trial days left, limits).
- [ ] Audit: trial policy changes logowane.

## T092 — Design Trial-to-Paid Conversion Path
- [ ] Upgrade flow działa (CTA → checkout → paid state) bez utraty danych.
- [ ] Edge: payment failed/past_due → dunning + blokady zgodnie z polityką.
- [ ] UI copy jest jasne i “conversion-friendly”.
- [ ] Webhooks: po płatności status w app aktualizuje się poprawnie.
- [ ] Downgrade/cancel path (jeśli w scope) działa przewidywalnie.

## T093 — Legal Agreements Update and User Acceptance Flow Optimization
- [ ] Legal docs są wersjonowane; akceptacje zapisują: wersja, timestamp, user, org.
- [ ] Onboarding/upgrade wymusza akceptacje tylko gdy potrzebne (low friction).
- [ ] Public `/legal` działa i ma komplet dokumentów.
- [ ] Edge: zmiana wersji terms → user widzi ponowną akceptację.
- [ ] Audit/export: można wyeksportować akceptacje (compliance).

## T094 — Documentation Section – Landing Page Structure & Content
- [ ] Sekcja docs na landing ma IA, deep links i jest spójna z app docs.
- [ ] i18n: 6 języków + RTL ar.
- [ ] Search entrypoint działa (jeśli przewidziane).
- [ ] SEO: poprawne meta + indeksowanie.
- [ ] Mobile: czytelne.

## T095 — Full Website Content Replacement & Visual Update
- [ ] Cała strona ma spójny brand/story i aktualne screenshoty.
- [ ] i18n: 6 języków + RTL ar; EN+PL jakościowo najlepsze.
- [ ] Link integrity: brak starych `/terms` itp. jeśli canonical jest `/legal/:slug`.
- [ ] Performance: obrazy zoptymalizowane, brak CLS.
- [ ] Trust signals (security, privacy, pricing) są jasne.

## T096 — Partner Program Toolkit & Promotional Materials
- [ ] Partner może pobrać aktualne materiały (wersjonowane, zawsze current).
- [ ] Uprawnienia: tylko partner role ma dostęp.
- [ ] Edge: brak materiału → jasne “not available yet”, bez placeholderów.
- [ ] Tracking: download events logowane.
- [ ] i18n: min EN/PL (public partner też jeśli dotyczy).

## T097 — Partner Sales Certification & Incentive Training System
- [ ] Ścieżka szkoleniowa działa: moduły → quiz/exam → wynik → certyfikat.
- [ ] Certyfikat jest generowany i weryfikowalny.
- [ ] Incentives/tiers działają zgodnie z polityką (unlock).
- [ ] Edge: niezdany egzamin → retry policy.
- [ ] Audit: zmiany tierów i wyniki egzaminów logowane.

## T098 — Automated Partner Outreach Campaign
- [ ] Kampanie da się tworzyć i uruchamiać; sekwencje wysyłek działają.
- [ ] Compliance: opt-out i wymagane metadane są respektowane.
- [ ] Deliverability: rate limits / backoff działają.
- [ ] Tracking: open/click/response eventy logowane.
- [ ] Edge: błędny email → nie blokuje całej kampanii.

## T099 — Implement Alternative “C‑Type” Table View (ClickUp‑Style Layout)
- [ ] Można przełączyć N‑view ↔ C‑view; stan zapamiętany.
- [ ] C‑view ma szybkie akcje (keyboard, inline edit) i 3‑panel layout działa.
- [ ] Performance: duże tabele → brak freezów; virtualization jeśli jest.
- [ ] Mobile: fallback do używalnego widoku (nie “mini ClickUp”).
- [ ] i18n + accessibility: labels, aria, focus.

## T100 — Mobile Application Interface Design (mobile‑ready web + field capture UX)
- [ ] Kluczowe ekrany nie są “broken” na telefonie (layout, scroll, inputs).
- [ ] Touch ergonomia: przyciski, bottom nav/drawer (jeśli użyte).
- [ ] Szybkie zbieranie danych w terenie działa (minimum kroków).
- [ ] Performance: szybkie ładowanie, brak ciężkich animacji.
- [ ] RTL (ar) nie psuje layoutu (public/marketing i kluczowe flows).

## T101 — Icon System Standardization & Design Library
- [ ] Jedna biblioteka ikon użyta w całej aplikacji (brak mixu stylów).
- [ ] Ikony skalują się poprawnie (16/20/24), align z typografią.
- [ ] Dark/light: kontrast OK.
- [ ] i18n: tooltipy/labels przetłumaczone.
- [ ] Edge: brak ikony → fallback standardowy.

## T102 — Finalize Sidebar Design System (ClickUp/Notion/Outlook-grade)
- [ ] Sidebar ma spójne expanded/collapsed stany i zachowanie.
- [ ] Hover/flyout submenu działa i nie zasłania/nie ucieka.
- [ ] Layered backgrounds/typografia zgodne z “Tech Sexy”.
- [ ] Mobile: sidebar jako drawer, bez regresji.
- [ ] Accessibility: keyboard + screen reader podstawy.

## T103 — Typography Optimization for Light & Dark Mode
- [ ] Hierarchia typografii jest czytelna w light i dark.
- [ ] Kontrast spełnia minimum (szczególnie tekst pomocniczy).
- [ ] Długie teksty (raporty/chat) są czytelne (line height, width).
- [ ] i18n: fonty wspierają ja/ar bez “tofu”.
- [ ] Regression: brak “skakania” layoutu po zmianie fontów.

## T104 — GPT‑Level Chat UI/UX for DBR77 Chat Interface
- [ ] Chat ma czytelność jak “desktop chat” (spacing, groups, history).
- [ ] Streaming/loader states są eleganckie i bez flicker.
- [ ] Actions przy odpowiedzi (copy/save/use) działają.
- [ ] Citations/attachments/web sources renderują się czytelnie.
- [ ] Mobile: composer i scroll zachowują się poprawnie.

## T105 — Chat Navigation & Button Design Refinement (3rd “Business” button)
- [ ] 3 przyciski/tryby są jasne (hierarchia i brak konfuzji).
- [ ] Akcje “Business” nie wykonują side-effectów bez zgody.
- [ ] i18n: etykiety/tooltipy.
- [ ] Keyboard: przełączanie trybów i focus.
- [ ] Analytics: kliknięcia przycisków logowane (jeśli w spec).

## T106 — Advanced User Feedback System (Full Feedback Flow)
- [ ] User może zgłosić bug/idea/feature request z kontekstem (screen/meta).
- [ ] Statusy feedbacku działają (NEW→…→RESOLVED/ARCHIVED).
- [ ] Admin triage działa + AI analysis (jeśli włączone) nie halucynuje.
- [ ] Privacy: brak PII w metadanych; opt-out działa.
- [ ] Notifications dla critical feedback działają (jeśli w spec).

## T107 — System Stability & Uptime Assurance Framework
- [ ] Health endpoints działają (`/ping`, `/api/ready`, `/api/health/*`).
- [ ] Sentry/correlation IDs/metriki są obecne (w logach/headers).
- [ ] Deploy gates (smoke tests) blokują deployment przy krytycznych błędach.
- [ ] Backup/restore procedura działa na testowym scenariuszu.
- [ ] Stub routes nie są wystawione w prod.

## T108 — Full Superadmin Control & System Testing Framework
- [ ] SuperAdmin control plane ma guardrails (confirm/reason/audit).
- [ ] Impersonation działa i jest logowana.
- [ ] System testing API (test-support) jest hard-guarded (tylko test env).
- [ ] E2E bootstrap/cleanup działa deterministycznie.
- [ ] High-risk akcje nie są możliwe bez 2-step confirm (jeśli w spec).

## T109 — Payment System Integration (Stripe)
- [ ] Subscription flow: create/upgrade/downgrade/cancel działa.
- [ ] SetupIntent/payment methods są PCI-safe i nie wyciekają.
- [ ] Webhooks: signature verification + idempotency + retry.
- [ ] Dunning: past_due blokuje właściwe akcje i pokazuje jasny komunikat.
- [ ] Token billing: zakup kredytów i naliczenie działa.

## T110 — Google Login Integration
- [ ] OAuth login działa end‑to‑end (start → callback → session).
- [ ] Linkowanie kont po emailu działa bez duplikacji userów.
- [ ] Security: state/PKCE/anti-CSRF działa; rate limit.
- [ ] Edge: user odrzuca consent → sensowny komunikat.
- [ ] Audit: security_events logowane.

## T111 — LinkedIn Login Integration
- [ ] OAuth login działa; email retrieval jest pewne (lub jasno obsłużone).
- [ ] Linkowanie kont działa; brak duplikacji.
- [ ] Security: state + rate limit + audit.
- [ ] Edge: brak email z LinkedIn → fallback flow (zgodnie ze spec).
- [ ] UI callback route działa i nie zostawia usera “na białej stronie”.

## T112 — LinkedIn Account Connection Encouragement System
- [ ] Logged-in user może podłączyć LinkedIn (connect flow) i zobaczyć status.
- [ ] Można odłączyć konto; zmiana jest trwała.
- [ ] Nudges są kontekstowe i nie nachalne (cooldown/dismiss).
- [ ] Analytics: connect CTA shown/clicked/connected logged.
- [ ] Edge: DEMO org → brak realnego connect (lub jawnie wyłączone).

## T113 — User Behavioral Intelligence Tracking System
- [ ] Event ingestion działa i nie zapisuje PII w metadata.
- [ ] Opt-out działa (zgodnie z polityką).
- [ ] WAU/DAU/activation metrics liczą się poprawnie.
- [ ] Churn warnings pojawiają się wg heurystyk i są explainable.
- [ ] Retencja danych i purge działa (GDPR/compliance).

## T114 — Transaction Readiness Scoring Algorithm
- [ ] Score 0–100 + tier wylicza się deterministycznie i ma breakdown + blockers.
- [ ] Blocked flags działają (billing/compliance).
- [ ] Cron + recompute endpoint działa; idempotent snapshoty zapisane.
- [ ] SuperAdmin ranking + drilldown działa.
- [ ] Edge: brak danych → score niższy z jasnymi “missing factors”.

## T115 — Transaction Readiness Integration with Sellix
- [ ] READY crossing wysyła outbound event dokładnie raz (idempotency + cooldown).
- [ ] Inbound webhook przyjmuje eventy z podpisem i dedupe po eventId.
- [ ] Delivery log + retry działa; failure widoczny w SuperAdmin.
- [ ] DEMO org: integration wyłączona z reason.
- [ ] Analytics: sellix events zapisane do conversion/journey.

## T116 — Centralized AI Prompt Management & Learning System
- [ ] SSOT promptów działa (CRUD, versioning, rollback).
- [ ] Prompt assembler działa w runtime i w preview (ten sam wynik).
- [ ] Learning loop: feedback → pattern → suggestion → approval → applied.
- [ ] AB testing działa (assignments/outcomes, winner promote).
- [ ] Metrics per prompt key/version są logowane (quality/cost).

## T117 — System-Level AI Context Governance (Core Docs Layer)
- [ ] Core docs ingest do `knowledge_documents` (scope=system) działa + chunks/embeddings.
- [ ] AIContextBuilder zawsze wstrzykuje system layer (token-budgeted).
- [ ] Governance odpowiedzi mają cytowania `[DOCx]` i przechodzą weryfikację.
- [ ] Drift detection + reindex działa.
- [ ] SuperAdmin “Core Docs” view pokazuje status i snippets.

## T118 — External Knowledge & Internet Context Management for AI
- [ ] Web search respektuje `internetEnabled` i Regulatory Mode (blokuje z reason).
- [ ] Allow/denylist domen działa + SSRF safety.
- [ ] Cache działa (ten sam query w krótkim oknie nie robi wielu requestów).
- [ ] Każde użycie internetu ma citations [n] + audit trail.
- [ ] Brak API key → jasny komunikat, brak “udawania”.

## T119 — Organizational Context Governance for AI
- [ ] Można skonfigurować kategorie kontekstu (ORG_PROFILE/TERMINOLOGY/PATTERNS/STRATEGY/DOCS).
- [ ] AIContextBuilder respektuje policy (wyłączone kategorie nie trafiają do promptu).
- [ ] PII redaction w org kontekście działa zgodnie z ustawieniami.
- [ ] Audit manifest (contextHash + categories used) jest dostępny gdy audit ON.
- [ ] Fail-safe: brak policy → bardziej restrykcyjny fallback, bez crash.

## T120 — Individual Context Governance for AI
- [ ] Private mode ON → brak zapisów memory i brak persistence web sources.
- [ ] Preview/export/delete memory działa (GDPR-ready).
- [ ] Retention `none` realnie wyłącza memory writes.
- [ ] Personalizacja ON/OFF działa i wpływa na odpowiedzi (bez side effects).
- [ ] Security audit (injection_blocked) działa nawet w private mode.

## T121 — Org Context Governance Extended Controls
- [ ] Per-project override zaostrza dostęp (nie poluzowuje).
- [ ] Dokument `blocked` nigdy nie trafia do RAG.
- [ ] Dokument `requires_approval` wymaga zgody i działa scope “conversation”.
- [ ] Audit doc-usage zapisuje used docIds i blocked attempts.
- [ ] UI jasno pokazuje visibility/sensitivity dokumentów.

## T122 — System Architecture Consolidation & Dependency Review
- [ ] Gateway nie montuje stub routes w prod (bez ENABLE_STUB_ROUTES).
- [ ] Nie ma duplikatów kanonicznych endpointów dla tej samej capability.
- [ ] Health check pokazuje “degraded” przy brakach tabel/kluczy (nie silent).
- [ ] CI sanity check failuje build na duplicate mounts / missing modules.
- [ ] Legacy aliasy działają bez 404 (jeśli utrzymane).

---

Koniec listy.
