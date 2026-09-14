---
doc_id: pmo-metodyka-ssot
truth_type: product-target
scope: projekty, role, odpowiedzialnosci, komunikacja, ryzyko, statusy, bramki i zatwierdzenia
status: canonical
owner: product-engineering
last_reviewed: 2026-09-13
canonical_entry: docs/SOURCE_OF_TRUTH.md
supersedes: []
superseded_by: null
runtime_evidence:
  - evidence/f2-3-pmo/e1/STATUS_MEASUREMENT.txt
  - evidence/f2-3-pmo/e1/SOURCE_REACHABILITY_AUDIT.txt
---

# PMO — metodyka i stan docelowy

**Werdykt E1:** Consultify ma znaczną część modelu danych i API PMO, lecz nie ma osiągalnego produktu PMO. Adaptujemy **PMI/PMBOK-lite z bramkami etapowymi i tygodniowym rytmem** (DEC-488), opierając się na istniejących projektach, rolach, sześciu bramkach i jednym magazynie decyzji.

## 1. Przegląd stanu

Ocena dotyczy używalnej całości. Kod lub komponent bez osiągalnego montowania ma status **BRAK**, nawet gdy może przyspieszyć domknięcie.

| Element PMO | Stan | Dowód w bazie/kodzie i luka produktu | Domknięcie |
|---|---|---|---|
| Zadania | **ISTNIEJE** | My Work wystawia osiągalną zakładkę Tasks (`src/components/MyWork/MyWorkHub.tsx:1924-1931,4683-4733`), a Gateway montuje bogaty router pod `/api/pmo/tasks` (`server/src/Gateway.ts:1174`). Zadanie dziedziczy projekt z inicjatywy albo strumienia (`server/src/controllers/TaskController.ts:1210-1225`), więc ten rejestr reużywamy. | S |
| Decyzje | **ISTNIEJE** | My Work wystawia osiągalną zakładkę Decisions (`src/components/MyWork/MyWorkHub.tsx:1932-1939,4739-4782`), a Gateway montuje jeden router `/api/decisions` (`server/src/Gateway.ts:1145`). Tworzenie waliduje powiązany projekt w organizacji (`server/src/controllers/DecisionController.ts:687-704`); nie budujemy drugiego rejestru. | S |
| Inicjatywy | **CZĘŚCIOWO** | Kanoniczna trasa montuje `InitiativesHub` (`src/routes/AppRoutes.tsx:2420-2435`), a API jest pod `/api/pmo/initiatives` (`server/src/Gateway.ts:1173`). Interaktywne tworzenie wymaga projektu tylko przy fladze (`server/src/controllers/InitiativeController.ts:658-673`), a zastane rekordy bez projektu pozostają zgodnie z DEC-469. | S |
| Projekt | **BRAK** | Tworzenie i readback (`server/src/controllers/ProjectController.ts:239-289`) oraz aktualizacja (`:402-436`) istnieją, a Gateway montuje router pod `/api/pmo/projects` (`server/src/Gateway.ts:1171-1173`). Użytkownik nie może wejść do produktu: `/projects` i `/my-work/projects/*` przekierowują do `/my-work` (`src/routes/AppRoutes.tsx:1719-1725`). | M |
| Zespół | **BRAK** | `project_members` przechowuje rolę, przydział, uprawnienia i strumień (`server/src/database/DatabaseInitializer.ts:739-763`), a API członków jest pod `projects/:id/members` (`server/src/routes/pmo/projects.routes.ts:166-210`). `ProjectTeamBoard` ma 0 importerów, a `MyProjects` jest dostępny tylko z nieużywanego `WorkCenter` (`src/components/MyWork/WorkCenter.tsx:216-226`; pomiar: `evidence/f2-3-pmo/e1/SOURCE_REACHABILITY_AUDIT.txt`). | M |
| Role | **BRAK** | Normalizator zna m.in. sponsora, kierownika, PMO, właściciela strumienia, członka i `STEERING_COMMITTEE` (`server/src/utils/roleNormalization.ts:13-26,83-115`); `/api/pmo-roles` jest zamontowane (`server/src/Gateway.ts:1186-1188`). Brakuje osiągalnego ekranu słownika ról i przypisań. | M |
| Odpowiedzialności | **BRAK** | Istnieją role, uprawnienia i `initiative_stakeholders.raci_type`, ale sam kod `MyProjects` stwierdza brak backendu macierzy RACI i pokazuje tylko grupy przypisań (`src/components/MyWork/MyProjects.tsx:451-462`). `RACIMatrix` jest wyłącznie zdefiniowany i wyeksportowany, bez konsumenta (`src/components/PMO/RACIMatrix.tsx:61`; `src/components/PMO/index.ts:4`; pomiar w evidence). | M |
| Komunikacja | **BRAK** | Backend ustawień powiadomień projektu ma zdarzenia, eskalację, e-mail i in-app (`server/src/controllers/ProjectController.ts:507-588`; trasy `server/src/routes/pmo/projects.routes.ts:262-283`), lecz w `src/` ma 0 klientów; osiągalny `NotificationSettings` używa innego, globalnego `/notification-settings` (pomiar w evidence). Brakuje konfiguracji projektu, właścicieli komunikatu i rytmu tygodniowego z DEC-488. | M |
| Ryzyko | **CZĘŚCIOWO** | Kanoniczne `raid_items` przechowuje ryzyko/założenie/problem/zależność, właściciela i termin (`server/migrations/063_raid_items.sql:4-30`), a `/api/raid-governance` jest zamontowane (`server/src/Gateway.ts:1142`). Brakuje oprawy projektu: odpowiedzialność z roli i eskalacja według poziomów decyzji; ekran/generator pozostaje zakresem F2-2. | S |
| Statusy | **CZĘŚCIOWO** | Runtime ma 12 etapów i przejścia (`src/contracts/initiatives-execution/foundation.ts:1-33`), warstwa publiczna 7 etykiet (`packages/shared/src/constants/initiativeStatuses.generated.ts:3-16`). Mapowanie jest stratne i nie spełnia DEC-490; szczegóły w §2. | M |
| Bramki | **CZĘŚCIOWO** | Gateway montuje stage gates (`server/src/Gateway.ts:1155`); polityka zna 6 bramek i trzy poziomy bazowe z quorum, rolami, separation i SLA (`server/src/domain/initiatives-execution/organizationGovernance.ts:2-24`). Istnieją dwa mechanizmy bramek, ale nie tworzą jeszcze jednego osiągalnego przepływu projektu. | M |
| Zatwierdzenia | **CZĘŚCIOWO** | Resolver ma łańcuch PRODUCT→ORGANIZATION→PROJECT→INITIATIVE (`server/src/domain/initiatives-execution/postgresGovernancePolicyResolver.ts:43-67`), a decyzje są append-only (`server/migrations/20260810_t01_initiative_lifecycle_gate_decisions.sql:9-65`). Bindingi są czytane z `ie_governance_role_bindings`, ale nigdzie nie są automatycznie wyprowadzane z `project_members` (`postgresGovernancePolicyResolver.ts:68-98`). `DefinitionDecisionQueue` ma 0 produkcyjnych importerów, a test właścicielski pilnuje jego nieobecności (`src/components/MyWork/__tests__/MyWorkHub.decisionsOwnerFeedback.test.ts:14`; pomiar w evidence). | L |

Trasy PMO używają `verifyToken` z `auth.middleware.ts`, natomiast wymagania organizacji/capability biorą z `rbac.middleware.ts` i `effectiveCapability.middleware.ts` (`server/src/routes/pmo/projects.routes.ts:14-23,35-43`). Nie dokładamy trzeciego strażnika `requireRole`.

## 2. Pomiar rozjazdu statusów

| Warstwa | Liczba | Strata |
|---|---:|---|
| Kanoniczny runtime | 12 | Pełny liniowy cykl `REGISTERED_DRAFT` → `ARCHIVED`; `DELIVERED` i `CLOSED` są osobnymi etapami. |
| Publiczne etykiety legacy | 7 | Nie odróżniają kilku etapów runtime; `CLOSED` skupia pięć etapów. |
| Rozpoznawane wejścia legacy | 19 | Aliasowanie zaciera pochodzenie i semantykę. |

`statusToRuntime.PROPOSED=[]` i `statusToRuntime.REJECTED=[]` (`src/contracts/initiatives-execution/statusMapping.ts:30-38`). W drugą stronę `DONE→CLOSED`, `CANCELLED→CLOSED` i `REJECTED→CLOSED` (`statusMapping.ts:40-49`), więc kod nie zachowuje ani różnicy Done/Closed wymaganej przez DEC-490, ani przyczyny odrzucenia wymaganej przez DEC-479.

Pomiar danych wykonano na własnym PostgreSQL 18 po poprawnym odtworzeniu artefaktu staging schema `bf580f…`. Schemat ma 1809 tabel `public` i 121 tabel `v8`, ale jest bez danych: wszystkie badane tabele mają 0 rekordów. Dlatego liczba rekordów per przypadek jest **EVIDENCE_MISSING**, a nie „zero na stagingu”. Historyczny komentarz kodu podaje `REJECTED` ×16 i `PROPOSED` ×1 na kopii z 10.09 (`initiativeUnifiedReader.ts:36-39`); wymaga odświeżenia na kopii zawierającej dane przed E3.

Docelowo 12 statusów runtime pozostaje prawdą systemu, 7 etykiet jest wygaszane, a rozstrzygnięcie `IN / PARKING / ARCHIVE` z powodem i warunkiem powrotu jest osobnym polem (DEC-479, DEC-490). Lista statusów nie rośnie.

## 3. Rozważone metodyki

| Wariant | Co adaptujemy | Co pasuje bez zmian | Co dokładamy | Czego nie robimy | Koszt |
|---|---|---|---|---|---|
| **PMI/PMBOK-lite + stage-gate** | role, karta projektu, rejestry, kontrola zmian, bramki, tygodniowy rytm | projekty, członkowie, role/capabilities, workstreams, RAID, sześć bramek, governance baselines | osiągalny projekt, RACI, komunikacja, automatyczne bindingi i jawne odstępstwa | pełna biurokracja PMBOK, osobny rejestr pracy | **M** |
| PRINCE2-lite | business case, produkty zarządcze, board i tolerancje | steering committee, stage gates, decyzje | osobny słownik produktów/wyjątków i przebudowa ról | pełna certyfikacyjna ceremonia | **L** |
| Scrum/Agile | backlog, iteracje, review | zadania i część workstreams | role i zdarzenia Scrum oraz most do bramek inicjatyw | zastąpienie lifecycle samym sprintem | **L** i słabe dopasowanie |

## 4. Wybrana formuła pracy

DEC-488 wybiera **PMI/PMBOK-lite + stage-gate + tygodniowy rytm**. Role kanoniczne: sponsor, kierownik projektu, komitet sterujący, właściciel strumienia i członek. Istniejące role techniczne mapujemy do tych pięciu, zachowując wyspecjalizowane role potrzebne uprawnieniom. Pojemność i alokację liczymy **per człowiek** z deklarowanego procentu czasu tygodniowego; role służą tylko jako podsumowanie (DEC-480).

Projekt powstaje **najpóźniej razem z inicjatywą**; nowa inicjatywa nie może wejść do dalszej pracy bez projektu. Dalej przechodzi przez: utworzenie karty projektu → obsadzenie zespołu i ról → wygenerowanie odpowiedzialności, komunikacji i procedury zatwierdzeń → wykonanie pracy → kontrolę bramek → dostarczenie → pomiar efektów → zamknięcie → archiwizację. Tygodniowy rytm obejmuje aktualizację planu, przegląd pojemności osób i alokacji, przegląd RAID, decyzje zaległe, zmiany baz odniesienia i raport do komitetu.

Macierz DEC-485 ma trzy poziomy: zadanie, kierownik projektu, komitet. Każdy może zgłosić ryzyko. Naruszenie zatwierdzonej bazy odniesienia tworzy kartę ryzyka N i trafia do komitetu; AI może proponować, ale człowiek decyduje i pozostawia ślad.

## 5. Trzy decyzje właściciela — rozstrzygnięte

| Pytanie E1 | Odpowiedź wiążąca | Skutek wyboru / skutek alternatywy |
|---|---|---|
| Którą metodykę adaptujemy? | **PMBOK-lite + stage-gate + tygodniowy rytm** (DEC-488). | E2–E5 dopinają istniejące bramki. PRINCE2 lub Scrum wymagałyby nowych ról/produktów albo mostu do lifecycle, koszt L. |
| Jak zamykamy przewód decyzji? | **Rozszerzamy addytywnie istniejący silnik; role PMO są źródłem** (DEC-489). | Jeden magazyn decyzji, bez ręcznego JSON-a. Pełny A05/Case na każdym wejściu wymuszałby fabrykowanie śladu albo osłabienie więzów. |
| Jak nazywamy statusy? | **12 runtime jest prawdą, legacy wygaszamy, Done ≠ Closed, Rejected trafia do rozstrzygnięcia** (DEC-490). | E3 utrzymuje oba mapowania do osobnego przełączenia UI. Pozostawienie 7 jako prawdy nadal gubi odrzucenie i etap pomiaru efektów. |

STOP na literę po E1 jest zdjęty wpisem CTO z DEC-485/488/489/490. E2 może rozpocząć się dopiero po niezależnym przeglądzie tego dokumentu i meldunku E1.

## 6. Kanon zatwierdzeń dla produktów korzystających z PMO

1. Projekt powstaje najpóźniej przy utworzeniu inicjatywy i zawsze przed procedurą zatwierdzeń.
2. Zespół dostaje jawne role; z `(role, metodyka, wielkość)` powstają `roleBindings`, reguły sześciu bramek, quorum, separation of duties i SLA.
3. Domyślna ceremonia zachowuje dzisiejsze działanie (DEC-474). Organizacja lub projekt może ją zmienić; odstępstwo ma wersję, autora, powód i widoczne porównanie z domyślną procedurą.
4. Trzy poziomy decyzji z DEC-485 kierują sprawę do właściwej roli. AI wyłącznie proponuje procedurę i opis roli; człowiek akceptuje z `expectedVersion`, a konflikt migawki daje 409.
5. Decyzja bramkowa trafia do istniejącego, append-only `initiative_lifecycle_gate_decisions`; nie powstaje druga tabela decyzji. Aktywny ekran analizy merytorycznej odsyła do tego dokumentu.

## 7. Granice i pokrycie E1

E1 nie zmienia kodu produkcyjnego, migracji, flag ani zachowania aplikacji. Nie montuje `ProjectTeamBoard`, `RACIMatrix`, `DefinitionDecisionQueue`, `InitiativeManagementView`, `UserDashboardView` ani `WorkCenter` tylko dlatego, że istnieją w drzewie.

| Myśl właściciela | Wymagania | Dowód w tym SSOT | Etap wykonania |
|---|---|---|---|
| 131 — pełna koncepcja projektów | PMO1.1, PMO1.2 | §1 Projekt; §4 zasada „projekt najpóźniej z inicjatywą” | E2 |
| 132 — adaptacja jednej wiodącej metodyki | PMO0.2, PMO0.3 | §3 porównuje 3 warianty; §4 wybiera jeden | E1 |
| 132a — pełny przegląd stanu | PMO0.1, PMO0.4 | §1: 12/12 elementów ze stanem, dowodem i kosztem | E1 |
| 133 — role, odpowiedzialność, komunikacja i ryzyko | PMO1.2, PMO2.1–PMO2.4 | §1 osobny wiersz każdego elementu; §4 rytm i DEC-480 | E2, oprawa ryzyka w E2; ekran w F2-2 |
| 134 — pełne i zrozumiałe statusy | PMO3.1–PMO3.4 | §2: 12/7/19, każda nazwana strata i EVIDENCE_MISSING danych | E3 |
| 135 — role projektu tworzą zmienialne zatwierdzenia | PMO4.1–PMO4.3, PMO4.5 | §1 Zatwierdzenia; §6 kroki 1–4 | E4 |
| 31 — jasny opis zarządzania zatwierdzeniami | PMO4.4 | §6: 5 reguł kanonicznego przewodu | E1/E5 |
| 109 — owner/admin/komitet wynika z ról projektu | PMO2.5 | §4 role kanoniczne; §6 rola jako źródło bindingu | E2/E4 |

Pokrycie E1: **8/8 myśli, 26/26 wymagań przypisanych do sekcji i etapu**. Numery commitów pozostają puste do dostawy etapów; E1 nie może twierdzić, że E2–E5 są wdrożone.

Przed E3 potrzebna jest kopia stagingu zawierająca dane do rozkładu `status/current_stage/stage/archived`. Przed każdą migracją obowiązuje osobny meldunek i jawna zgoda CTO; na E1 migracja nie jest potrzebna.
