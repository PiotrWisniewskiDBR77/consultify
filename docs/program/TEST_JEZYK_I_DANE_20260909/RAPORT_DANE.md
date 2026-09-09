# RAPORT — część B (DANE), test 09.09.2026

**Zlecenie właściciela:** „przetestuj, czy wszystkie dane są wysyłane poprawnie oraz wystarczające
do pełnego testowania". Kryteria: [`KRYTERIA.md`](KRYTERIA.md) sekcja B (B1–B7).

## 0. Stanowisko pomiaru (co dokładnie zmierzono)

| Element | Wartość |
|---|---|
| Baza | `consultify_kopia_d30` — kopia szablonu `consultify_staging_czysta` (zrzut stagingu po czystce 09.09), Postgres 18, kontener `consultify-pg18`, `127.0.0.1:54418` |
| Kod | worktree `~/Developer/wt/test-dane`, gałąź `mvp/test-dane-0909` (baza `origin/demo`) |
| API | port 4209, `NODE_ENV=test`, `DB_MANAGED_SCHEMA=off`, env ze stagingowego `server.env` |
| Vite | port 3227, `--mode test`, 34 flagi `VITE_*` ze stagingowego `server.env` |
| Organizacja | Northwind Manufacturing Ltd. `468b234c-66c4-54e1-b626-5e0fb3a92f6a` |
| Konto | `james.whitfield@northwind.example` (OWNER), EN, 1440×900, jasny motyw |
| Zrzuty | `evidence/test-jezyk-dane-0909/dane/` — **70 ekranów** (przebieg 2) + 9 kont + 18 zrzutów ścieżki zapisu |
| Surowe wyniki | `b1b2b5-wynik.json`, `b3-progi.txt`, `b3-tabele-northwind.txt`, `konta/b7-konta.json` |

### ★ SPROSTOWANIE WŁASNEGO POMIARU (przebieg 1 był fałszywy)
Pierwszy przebieg (`dane/przebieg-1-bez-v8/`) pokazał **22 unikalne odpowiedzi 404** na
`/api/v8/*` (Moja Praca, Wywiad, Realizacja, Finanse, Inicjatywy, Ocena, Partnerzy).
**To NIE był defekt produktu — to była luka mojego stanowiska.** `v8FeatureGate.middleware.ts:15`
zwraca 404 `V8_DISABLED` przed autoryzacją, gdy `ENABLE_V8_GLOBAL !== 'true'`; mój minimalny
zestaw env tej zmiennej nie miał. Po dołożeniu `ENABLE_V8_GLOBAL=true` (jak na stagingu)
wszystkie 22 ścieżki zwracają 200. **Przebieg 2 (miarodajny) ma 0 błędów konsoli i 1 odpowiedź 4xx
na 70 ekranów.** Liczby z przebiegu 1 są w repo tylko jako ślad błędu metody.

Drugie sprostowanie: w trakcie testu B4 zameldowałem sobie „edycja inicjatywy nie zapisuje się".
**Nieprawda** — wysłałem pole `name`, którego walidator nie przyjmuje; z polem `title` edycja
zapisuje się poprawnie (potwierdzone odczytem z bazy). Poniżej jest wersja poprawiona.

---

## 1. B3 — wystarczalność danych (SQL, `b3-progi.txt`)

| Moduł | Próg z KRYTERIA B3 | Stan zmierzony | Wynik |
|---|---|---|---|
| Inicjatywy | ≥10 i każdy status ≥1 | **13**; DRAFT 1 · PROPOSED 1 · PENDING_APPROVAL 1 · APPROVED 4 · IN_EXECUTION 4 · CLOSED 1 · REJECTED 1; „wstrzymana" = `on_hold=true` **1** (UI pokazuje „On hold") | **PASS** |
| Realizacja | ≥3 sprawy z zadaniami, RAID, decyzjami, kamieniami, raportem | 4 inicjatywy w realizacji · zadania **42** · RAID **7** · decyzje **9** · kamienie **16** · raporty statusu **2** | **PASS** |
| Moja Praca | ≥5 zadań zalogowanego + skrzynka niepusta | zadania Whitfielda **7** · skrzynka **8** | **PASS** |
| Spotkania | ≥2 z notatką/decyzją | spotkania **2** · notatki **2** — **ale moduł wyłączony w UI (DEC-425)** | **PASS w bazie / N/A w UI** |
| Wywiad | ≥1 sesja z odpowiedziami | sesje **2** · pytania odpowiedziane **22** · wnioski **4**; `interview_assignments` **0** | **PASS (z zastrzeżeniem, p. D-04)** |
| Ocena | ≥1 ukończona z raportem | ocena APPROVED **1** (7 osi, wynik 3/5) · raport **1** | **PASS** |
| Narzędzia | ≥3 artefakty w ≥2 typach | sesje **3**, typy **3** (vsm-builder, dynamic-swot, capability-mapper) | **PASS** |
| Wyniki (KPI) | ≥5 KPI z wartościami | definicje **8** · pomiary **48** · karta wyników **1** · OKR cele **3**; migawek przeglądu **0** | **PASS (p. D-05)** |
| Finanse | ≥1 budżet i ≥1 ROI | budżet **1** (15 pozycji) · sprawa ROI **1** · sprawozdania **4** | **PASS** |
| Materiały | ≥3 dokumenty/prezentacje | **7** (4 dokumenty · 2 prezentacje · 1 arkusz) | **PASS** |
| Audyty | ≥1 | program **1** · ustalenia **3** | **PASS** |
| Organizacja | profil kompletny (nazwa, branża, wielkość, strategia) + ≥8 członków | członkowie **9** ✔; profil: `profile_completeness=0`, `strategic_priorities=[]`, `industry_code` puste, opis pusty; UI liczy **8/13 pól** | **FAIL** |
| Admin | lista użytkowników i ról | **9** użytkowników, role OWNER 1 / ADMIN 2 / MEMBER 6 | **PASS** |
| Ustawienia | profil, bezpieczeństwo | profil w pełni wypełniony, sekcja Security dostępna | **PASS** |
| Partnerzy | ekran ładuje się | ładuje się, uczciwy stan pusty | **PASS** |
| Czat | ≥1 rozmowa z historią | rozmowy **3** · wiadomości **11** | **PASS** |

**B3: 15 PASS / 1 FAIL (Organizacja).**

---

## 2. Tabela zbiorcza 16 modułów × B1–B7

Legenda: PASS = zmierzone i spełnione · FAIL = zmierzone i niespełnione · N/A = nie dało się zmierzyć (powód podany).

| # | Moduł | B1 ekran bez błędów | B2 liczby = SQL | B3 dane | B4 zapis | B5 podgląd ≥70 % | B6 treść EN/właściciele | B7 konta |
|---|---|---|---|---|---|---|---|---|
| 1 | Chat | PASS (0/0) | N/A (brak listy) | PASS (3 rozmowy) | N/A (poza zakresem B4) | N/A | PASS | PASS |
| 2 | My Work | PASS (0/0) | PASS (8 = 8) | PASS | **PASS** (API 201→200→200→404) | PASS (~90 %) | FAIL (D-06 UUID) | PASS |
| 3 | Interview | PASS (0/0) | PASS (sesje 2 = 2) | PASS | N/A | PASS | PASS | PASS |
| 4 | Tools | PASS (0/0) | PASS (36 = 10+10+10+1+5) | PASS | N/A | PASS (~95 %) | PASS | PASS |
| 5 | Assessment | PASS (0/0) | PASS (1 = 1) | PASS | N/A | PASS | **FAIL** (D-01, D-02) | PASS |
| 6 | Audits | PASS (0/0) | FAIL (D-11 chipy) | PASS | N/A | PASS | PASS | PASS |
| 7 | Initiatives | PASS (0/0) | PASS (11 aktywnych / 13 API) | **PASS** (API 200→200→200, baza potwierdza) | N/A (podgląd się nie otworzył) | PASS | PASS | PASS |
| 8 | Execution | PASS (0/0) | FAIL (D-08, D-09) | PASS | **PASS** (decyzje 201→200→200 soft-delete) | PASS | PASS | PASS |
| 9 | Results | **FAIL** (1×404, D-05) | PASS (1 = 1) | PASS | N/A | FAIL (ROI 4/7 pól) | PASS | PASS |
| 10 | Materials | PASS (0/0) | PASS (7 = 4+2+1) | PASS | **PASS częściowo** (POST 201; **brak „Delete" w kebabie**, tylko Archive) | FAIL (D-07 sklejony blok) | PASS | PASS |
| 11 | Finance | PASS (0/0) | PASS (1 = 1) | PASS | N/A | PASS | PASS (D-12 formatowanie) | PASS |
| 12 | Meeting | PASS (zaślepka) | N/A | PASS w bazie | **N/A — moduł wyłączony (DEC-425)** | N/A | N/A | PASS |
| 13 | Organization | PASS (0/0) | **FAIL** (D-03) | **FAIL** | N/A | FAIL (8/13) | PASS | PASS |
| 14 | Admin Panel | PASS (0/0) | PASS (9 = 9) | PASS | N/A | PASS | PASS (D-10 layout) | PASS |
| 15 | Settings | PASS (0/0) | N/A | PASS | N/A | PASS | PASS (D-13) | PASS |
| 16 | Partner Portal | PASS (0/0) | N/A (brak danych) | PASS | N/A | N/A | FAIL (D-14 obca nazwa) | PASS |

**B1: 15 PASS / 1 FAIL** — na 70 ekranach zero błędów konsoli i **jedna** odpowiedź 4xx.
**B7: 9/9 PASS** — wszystkie konta 200, poprawna rola, ekran startowy `/chat` ładuje się, 0 błędów.

### B4 — ścieżka zapisu, wynik per moduł (zmierzone)
| Moduł | Utwórz | Edytuj | Usuń | Uwaga |
|---|---|---|---|---|
| Inicjatywy | `POST /api/initiatives` **200** | `PUT` **200**, baza potwierdza nową nazwę i opis | `DELETE` **200**, wiersz znika | **W UI jedyną drogą jest „AI Initiative Wizard" — krok 3 to `Generate AI draft`, nie ma ścieżki ręcznej** (D-15) |
| Realizacja (decyzje) | `POST /api/decisions` **201** | `PUT` **200**, treść zmieniona | `DELETE` **200** — **miękkie**: wiersz zostaje ze statusem `cancelled` | zakładka „Deliveries" nie ma przycisku tworzenia (lista pochodna) |
| Moja Praca (zadania) | `POST /api/tasks` **201** | `PUT` **200**, `GET` pokazuje zmieniony tytuł (shadow **nie** zjadł zapisu) | `DELETE` **200**, `GET`→**404** | „New Task" w UI otwiera pełnoekranowy edytor-artefakt, nie modal |
| Spotkania | — | — | — | **N/A: moduł zastąpiony zaślepką „Meetings — planned for Wave 2"** |
| Materiały | `POST /api/presentations/decks` **201** + `PUT autosave` **200** | edytor otwiera się pod `/presentations/builder/:id` | **brak** — kebab ma Open/Discuss/Export PPTX/Share/Open preview/Edit/**Archive**, nie ma Delete | |

---

## 3. Defekty — uszeregowane

### BLOKUJĄCE (klient zobaczy rzecz zepsutą / danych nie da się przetestować)
| Id | Ekran | Co | Gdzie w kodzie / dowód |
|---|---|---|---|
| **D-01** | Assessment → Processes | Ukończona ocena nazywa się **„DRD · 614e5f28"** — surowy fragment UUID zamiast nazwy rekordu. API zwraca `name: "Northwind 2027 — Operational Maturity Assessment"`. Kolumny SCORE i CONFIDENCE puste („—") mimo `overall_score=3` w API. | `src/components/Assessment/AssessmentHub.tsx:283` — ``name: `DRD · ${session.id.slice(0, 8)}` ``; też `NewAssessmentModal.tsx:291`. Zrzut `05-assessment-03-tab-Processes.png` |
| **D-02** | Assessment → Library (podgląd) | **Pełne akapity po polsku w angielskim interfejsie**: „ADMA … jest narzędziem opracowanym przez European Commission … służy celom edukacyjnym". To samo dla SIRI, CMMI, Lean 4.0 oraz opis DRD („7-osiowa ocena dojrzałości cyfrowej…"). **5 polskich napisów** w module widocznym dla klienta EN. | `src/services/frameworkRegistry.ts:74,99,137,166,207` (napisy zaszyte w kodzie, poza i18n). Zrzut `05-assessment-90-podglad.png` |
| **D-03** | Organization → Identity | Pole **INDUSTRY = „—"**, choć baza ma `industry='Industrial Manufacturing'`. Profil raportuje 8/13 pól i `profile_completeness=0`; `strategic_priorities=[]`. Moduł „kontekstu organizacji", z którego korzysta Teresa, jest w praktyce pusty. | Zrzut `13-organization-01-root.png`; baza: `organization_profiles` |
| **D-04** | Interview → Inbox (ekran domyślny) | Moduł otwiera się na **pustym ekranie** („No assignments") — `interview_assignments = 0`. Dane (2 sesje, 22 odpowiedzi, 4 wnioski) są o jedną zakładkę dalej. Pierwsze wrażenie = moduł pusty. | Zrzut `03-interview-01-root.png` |
| **D-15** | Initiatives → New initiative | **Nie istnieje ręczna ścieżka tworzenia inicjatywy w UI** — jedyny przycisk otwiera „AI Initiative Wizard", którego krok 3 to `Generate AI draft`. Bez działającego LLM nie da się utworzyć inicjatywy z interfejsu (API działa). | Zrzut `zapis/inicjatywy-01-kreator.png` |

### WIDOCZNE (liczby się nie zgadzają / puste stany / czerwień nie na miejscu)
| Id | Ekran | Co |
|---|---|---|
| **D-05** | Results → KPI | Jedyne 4xx na 70 ekranach: `GET /api/vnext/results/kpi/scorecards/:id/review-snapshots/published` → **404** „No published review snapshot". `rvn_kpi_scorecard_review_snapshots = 0` — ścieżki przeglądu karty wyników nie da się przetestować. Dodatkowo API zwraca 404 zamiast 200+null dla „brak danych". |
| **D-06** | My Work → podgląd | W podglądzie widnieją **surowe UUID**: „Source task: 541eaaf3…", „Initiative: 4e7a8762-62e6-52b5-985b-536…" zamiast nazw. Pola „Recipient: Jam…", „Organization: Nort…" ucięte. |
| **D-07** | Materials → podgląd | Blok DETAILS renderuje się jako jedno zdanie bez separatorów: **„Owner: Daniel Osei Slides: 6 Updated: Sep 8, 2026"**. Plakietka **„Attention Required" na czerwono** przy talii ze statusem „Ready" (crimson poza semantyką krytyczną — CLAUDE.md §3). |
| **D-08** | Execution → Resources | Linia podsumowania mówi „backlog 73 h across 5 people", a **kolumna BACKLOG (H) ma „—" w każdym z 72 wierszy**. Chip „Overallocated 2" przy maks. wykorzystaniu 50 %. |
| **D-09** | Execution → Dashboard | Chipy „Risks 7 / **Decisions 7**", a zakładka Decisions & risks pokazuje **9** decyzji (baza: 9). Kafelek „VALUE VS PLAN: **No ROI computed**", mimo istniejącej sprawy ROI z kwotami (£628 500 CAPEX). |
| **D-10** | Admin → Members | Kolumna EMAIL **wychodzi poza swoją szerokość i wchodzi pod listę ROLE** („james.whitfield@northwind.example" pod polem „Owner"). |
| **D-11** | Audits → Library | Chipy: „All **1** · Verified **0** · Pending review **0**" — rozbicie nie sumuje się do całości. Kolumna CRITERIA pusta, choć `audit_pack_criteria = 7`. Przycisk „New audit" wygaszony. |
| **D-12** | Finance → Statements / Results → KPI | „COMPLETENESS: **P&L / —BS / —CF**" — myślnik sklejony z etykietą. W Results okres pokazany jako **„IX 2026"** (rzymski miesiąc, konwencja polska) na tym samym ekranie, gdzie data to poprawne „Sep 8, 2026". |
| **D-16** | My Work → panel „My Action Plan" | Priorytety renderowane jako **surowe wartości enum małą literą**: „high", „medium" (w tabeli obok poprawnie „High"/„Normal"). |
| **D-17** | wszystkie 70 ekranów | Stała plakietka **„3 V9 overrides"** w prawym dolnym rogu — element deweloperski widoczny na każdym ekranie produktu. |

### KOSMETYCZNE
| Id | Ekran | Co |
|---|---|---|
| **D-13** | Settings → Profile | Podpowiedź pola „LinkedIn Profile ID" brzmi **„e.g. piotr-wisniewski-123"** — nazwisko właściciela zaszyte jako przykład w produkcie klienckim. |
| **D-14** | Partner Portal | Nagłówek panelu bocznego mówi **„DBR77 Consultify"**, gdy zalogowana organizacja to Northwind Manufacturing Ltd. |
| **D-18** | Initiatives / Execution / Tools | Kolumny za wąskie: „Market F…", „Capabilit…", „Sarah Mit…", „James Wh…". Kolumny AREA/AXIS, LEVEL, VARIANCE, FORMAT, SOURCE pokazują „—" w każdym wierszu. |
| **D-19** | Initiatives → kreator | Ostrzeżenie „Portfolio is overloaded — create only 1–2 new initiatives" na **czerwonym (crimson) tle** — porada, nie stan krytyczny (CLAUDE.md §3). |
| **D-20** | Sidebar (kod) | `menuConfig.ts:134` — `label: t('sidebar.results', 'Wyniki')`: **polski napis jako domyślna wartość angielska**. |

### POZA B1–B7, ale istotne
| Id | Co |
|---|---|
| **D-21** | **Wspólne hasło do 9 kont Northwind stagingu jest zacommitowane w repo**: `scripts/dev/dane-pokazowe-en-d6-zrzuty.mjs` i `scripts/dev/dane-pokazowe-en-d6-pomiar-jezyka.mjs` (commit `e6d0b8173a`). Do usunięcia i rotacji. |

---

## 4. B6 — spójność treści (SQL, `b6-spojnosc.sql`)

Polskie znaki diakrytyczne w **danych** Northwind: **0** w każdej sprawdzonej tabeli
(initiatives, tasks, raid_items, decisions, meetings, conversations, presentation_decks,
tool_sessions, interview_questions + answers, interview_insights, status_reports, assessments,
audit_programs, KPI, report_builder_reports, canonical_inbox_items).

Właściciele i pola opisowe:
- inicjatywy 13/13 mają właściciela biznesowego i sponsora; **3 nie mają właściciela wykonawczego** (DRAFT, PROPOSED, REJECTED — dopuszczalne dla tych statusów);
- 0 inicjatyw bez `summary`, `problem_statement`, `description`, budżetu; 2 bez daty startu;
- zadania: 0/42 bez wykonawcy, bez opisu, bez terminu;
- RAID: 0/7 bez właściciela; nigdzie napisu „Przypisany właściciel".

**Wniosek B6: dane są czyste i po angielsku. Polszczyzna, którą zobaczy klient, siedzi w KODZIE
(D-02, D-20), nie w danych.**

---

## 5. WERDYKT

> **Czy dane są wysyłane poprawnie? — TAK.**
> Na 70 ekranach 16 modułów: **0 błędów konsoli, 0 odpowiedzi 5xx, 1 odpowiedź 4xx** (i to
> semantyczna: „brak opublikowanej migawki"). Liczby w interfejsie zgadzają się z bazą w 11 z 13
> mierzalnych list. Ścieżka zapisu (utwórz → edytuj → usuń) działa i **utrwala się w bazie** dla
> zadań, decyzji i inicjatyw.

> **Czy dane są wystarczające do pełnego testowania? — NIE, brakuje pięciu rzeczy.**

### Co dokładnie dosiać (moduł · ile · jakie statusy)
| # | Moduł | Czego brakuje | Ile | Dlaczego blokuje test |
|---|---|---|---|---|
| 1 | **Organizacja** | `organization_profiles`: `industry_code`, `strategic_priorities`, opis organizacji, `digital_maturity_overall`, `technology_stack`, `primary_markets` | 5 pól → 13/13 | Moduł kontekstu jest fundamentem odpowiedzi Teresy; z 8/13 pól i pustą strategią nie da się przetestować ani kontekstu, ani „Direction & Constraints" |
| 2 | **Wywiad** | `interview_assignments` (+ `interview_assignment_members`) | ≥3: 1 `pending`, 1 `answered`, 1 `approved` | Domyślna zakładka modułu (Inbox) jest pusta; ścieżka przydzielenia i zwrotu wywiadu nie ma ani jednego rekordu |
| 3 | **Wyniki** | `rvn_kpi_scorecard_review_snapshots` (opublikowana migawka przeglądu) | ≥1 `published` | Jedyne 4xx w całym teście; przeglądu karty wyników nie da się przejść |
| 4 | **Realizacja** | rozłożenie `due_date`/pracochłonności zadań na kolejne tygodnie oraz wypełnienie backlogu | 42 zadania na ≥8 tygodni | Zakładka Resources pokazuje 13 % wykorzystania i 7 z 8 tygodni z zerowym popytem — planowania zasobów nie ma na czym testować |
| 5 | **Materiały / Realizacja** | pola pochodne: FORMAT, SOURCE, LEVEL, VARIANCE, AREA/AXIS | dla wszystkich istniejących rekordów | Pięć kolumn ma „—" w każdym wierszu; nie da się przetestować sortowania, filtrów ani pstryczka kolumn na tych polach |

### Czego dane nie naprawią (to kod, nie zasiew)
D-01 (nazwa oceny z UUID), D-02 (5 polskich napisów w Ocenie), D-06 (UUID w podglądzie Mojej Pracy),
D-08/D-09 (sprzeczne liczniki w Realizacji), D-11 (chipy Audytów), D-15 (brak ręcznego tworzenia
inicjatywy), D-17 („3 V9 overrides" na każdym ekranie), D-21 (hasło w repo).

**Rekomendacja: przed pokazem klientowi zamknąć D-01, D-02 i D-17 — to trzy rzeczy, które widać
w pierwszych trzydziestu sekundach oglądania produktu po angielsku.**
