# DEC-450 — scalenie dwóch organizacji DBR77 na stagingu

Data: 07.09.2026 · baza: staging (`thomas.proxy.rlwy.net:52567/railway`, zmienna
`DATABASE_PUBLIC_URL` środowiska staging) · produkcja `consultify.ai` i baza
`127.0.0.1:54400`: **żadnego kontaktu**.

Skrypt: `server/scripts/scal-organizacje.ts`
(rozszerzenie `server/scripts/przenies-raid-miedzy-organizacjami.ts`).

- źródło (legacy): `dbr77` — „DBR77 Digital Consulting"
- cel (kanoniczna): `a3e05d4a-5397-419d-b486-8e44366c0063` — „DBR77"

---

## FAZA 1 — PLAN

### 1.1 Wszystkie tabele z `organization_id = 'dbr77'`

**99 tabel · 11 686 wierszy** (pełna lista z liczbami:
`logi/0-skan-99-tabel-legacy.tsv`; skanowano 1 274 tabele mające kolumnę
`organization_id`). Podział:

| grupa | tabel | wierszy |
|---|---|---|
| dane merytoryczne | 85 | 1 549 |
| dane techniczne (`api_logs`, `activity_logs`, `audit_log`) | 3 | 10 113 |
| tożsamość (`users`, `organization_members`) | 2 | 16 |
| słowniki / konfiguracja per organizacja | 3 | 16 |
| blok OKR (fikstura odbiorowa 13.08) | 8 | 8 |

Największe pozycje merytoryczne: 185 artefaktów v8 · 178 linków pochodzenia
artefaktów · 121 sesji kolaboracji · 73 pokwitowania rodowodu · 56 zadań ·
31 artefaktów wave5 · 20 prezentacji · 20 „moich pomysłów" · 19 map myśli ·
12 decyzji · 7 inicjatyw · 7 pozycji RAID · 6 pytań wywiadu · 5 spotkań.

**Uzupełnienie skanu — organizacja trzymana w kolumnie INNEJ niż
`organization_id`** (`logi/0-skan-innych-kolumn-organizacyjnych.txt`,
przeskanowano 75 kolumn kandydujących):

| miejsce | wierszy legacy | decyzja |
|---|---|---|
| `audit_events.org_id` | 497 | zostaje — dziennik audytowy |
| `organization_switch_log.from_organization_id` | 2 | zostaje — zapis faktu historycznego |
| `organization_switch_log.to_organization_id` | 3 | zostaje — jw. |

### 1.2 Kolejność wymuszona kluczami obcymi

W bazie jest **840 kluczy obcych, w których obie strony mają
`organization_id`**. Kolejność UPDATE-ów zaczyna mieć znaczenie **tylko** dla
kluczy ZŁOŻONYCH, zawierających `organization_id` (nieodraczalnych: wszystkie
mają `condeferrable=false`) — te wiążą klucz dziecka z organizacją rodzica.

Zmierzone: klucze złożone dotykające przenoszonych tabel to **1** —
`fk_budget_initiative_links_initiative_org` (`budget_initiative_links` →
`initiatives(id, organization_id)`), i ma **0 wierszy w organizacji legacy**
(potwierdzone też dla `finance_budget_initiative_link_receipts`,
`finance_budget_initiative_unlink_receipts`, `finance_post_investment_reviews`,
`rvn_kpi_recovery_actions`, `rvn_kpi_recovery_checkpoints`,
`finance_prediction_initiatives` — wszędzie 0).

**Wniosek: kolejność nie jest wymuszona.** Pozostałe klucze wiążą dziecko z
rodzicem po `id`, a `id` nie zmienia się przy przeniesieniu — więc żaden UPDATE
nie może chwilowo zerwać klucza. Skrypt i tak ma bramkę: gdyby klucz złożony
z `organization_id` miał wiersze w źródle, **zatrzymuje się** zamiast zgadywać
kolejność (`BRAMKA FK ZŁOŻONEGO`).

### 1.3 Kolizje z organizacją kanoniczną i ich rozstrzygnięcia

Sposób pomiaru (nie z listy, tylko z bazy): dla **każdej** z 99 tabel wykonano
prawdziwy `UPDATE … SET organization_id = <kanoniczna>` w transakcji,
odczytano odpowiedź Postgresa i zrobiono `ROLLBACK`
(`logi/0-proba-kolizji-per-tabela.tsv`). **93 tabele przeszły czysto, 6 zgłosiło
kolizję.** Dodatkowo wypisano 27 indeksów unikalnych zawierających
`organization_id` — wszystkie sprawdzone tą próbą.

| # | tabela | indeks | skala | rozstrzygnięcie |
|---|---|---|---|---|
| 1 | `organization_members` | `UQ(organization_id, user_id)` | 2 z 9 | **przenoszę 7, zostawiam 2**. Kolidują `justyna.laskowska` i `piotr.wisniewski@dbr77.com` — obie osoby mają JUŻ członkostwo w organizacji docelowej. Ich wiersz legacy zostaje nietknięty: nikt nie traci dostępu i nikt nie dostaje wyższej roli (justyna jest MEMBER w docelowej, ADMIN w legacy — podniesienie roli to decyzja właściciela, nie skutek uboczny scalenia). |
| 2 | `v8_artifact_origin_links` | `UQ(organization_id, origin_runtime, origin_record_id)` | 99 ze 178 | **przenoszę 79, zostawiam 99**. Indeks znaczy „jeden artefakt na szablon w organizacji"; 99 linków wskazuje na szablony (`document_/report_/presentation_/sheet_template`), z których organizacja docelowa ma już swój artefakt. To wtórny indeks pochodzenia (`artifactRegistryService.getOriginLinkByOrigin`), a nie ścieżka wyświetlania — Materiały czytają `v8_output_artifacts`, które jadą w komplecie (185/185). |
| 3 | `project_role_templates` | `UQ(organization_id, role_key)` | 12 z 12 | **nie przenoszę**. Wszystkie 12 kluczy ról (OBSERVER, PMO, SME, PROJECT_LEADER, …) istnieją już w organizacji docelowej. To słownik ról projektowych, nie treść właściciela — nic nie ginie. |
| 4 | `rvn_platform_visibility_policies` | `UQ(organization_id, domain, policy_version)` | 3 z 3 | **nie przenoszę**. Organizacja docelowa ma własne polityki dla tych samych domen (kpi/roi/okr, wersja 1), a dla `roi` nowszą wersję 2 (`ROI_GOVERNED`). To konfiguracja per organizacja. |
| 5 | `okr_vnext_programs` | `UQ(organization_id) WHERE status='active'` | 1 z 1 | **nie przenoszę — i wraz z nim cały blok OKR** (8 tabel, 8 wierszy). Baza dopuszcza jeden aktywny program OKR na organizację; obie go mają. Przeniesienie wymagałoby zmiany `status` — to już nie przeniesienie, tylko edycja treści. Blok jedzie w całości albo wcale: gdyby zestaw/cel/kluczowy wynik pojechały bez programu, ekran pokazywałby nazwę, której nie da się otworzyć. |
| 6 | `organization_context_snapshots` | `PK(organization_id)` | 1 z 1 | **nie przenoszę**. Jeden wiersz na organizację, wyliczany cache kontekstu. Przeniesienie nadpisałoby cache organizacji docelowej opisem „DBR77 Digital Consulting". Cache jest odbudowywalny. |

**Kolizja rozstrzygnięta osobno — fail-closed widoczności.**
`rvn_platform_resource_visibility` (4 wiersze) wskazuje na polityki z punktu 4.
`visibilityScopedQuery.ts` jest **fail-closed**: zasób bez wiersza widoczności
w organizacji jest NIEWIDOCZNY. Gdyby przenieść KPI/scorecard/przypadek ROI bez
tych wierszy, jechałyby do organizacji docelowej po to, żeby tam zniknąć.
Dlatego **3 wiersze jadą** (kpi, kpi_scorecard, roi_case), a **1 zostaje**
(okr_set — bo zestaw OKR zostaje, punkt 5).

Stempel `policy_id` tych 3 wierszy dalej wskazuje politykę z organizacji
legacy. **Nie przepinam go** — ścieżka ODCZYTU nie dołącza tabeli polityk
(`visibilityScopedQuery.ts` filtruje po `rv.organization_id` +
`rv.visibility_mode`), a `getActiveVisibilityPolicy()` rozwiązuje politykę po
`(organizationId, domain)` dopiero przy ZAPISIE. Przepięcie stempla byłoby
przepisaniem faktu historycznego. Wskazanie jest **zadeklarowane i policzone**
w kontroli spójności, nie przemilczane.

**Kolizji nierozstrzygniętych: 0.** Emaile 7 przenoszonych użytkowników nie
kolidują z żadnym z 9 kont organizacji docelowej (`users_email_key` jest na
samym adresie i nie zmieniamy adresów).

### 1.4 Decyzja o danych technicznych

**Nie przenoszę** `api_logs` (9 113), `activity_logs` (570), `audit_log` (430),
`audit_events.org_id` (497), `organization_switch_log` (5). Razem 10 615
wierszy.

Uzasadnienie: to zapis „to zdarzenie zaszło w TAMTEJ organizacji". Przepisanie
`organization_id` w dzienniku audytowym fałszuje audyt — a dziennik przełączeń
organizacji fałszowałby wprost („przełączył się z / do"). Sprawdziłem też, że
to nie jest treść produktu: `activity_logs` czytają wyłącznie panele
administracyjne (`AdminDataController`, `SuperAdminController`,
`security.routes.ts`, `admin-bulk.routes.ts`), nie ekrany programu.

Skutek uboczny, zmierzony i zadeklarowany: dzienniki zostają, a konta
użytkowników jadą, więc 570 wierszy `activity_logs` i 9 111 `api_logs`
wskazuje teraz konto z organizacji docelowej. Klucz obcy jest cały czas
spełniony (konto istnieje), a ten kształt **istniał już przed scaleniem w obie
strony** (83 legacy→kanoniczna i 44 kanoniczna→legacy dla `activity_logs`;
601 i 37 dla `api_logs`) — scalenie go tylko ujednolica. `audit_log` ma
wszystkie 430 wierszy z `user_id = NULL`, więc go to nie dotyczy.

### 1.5 Decyzja o użytkownikach i członkostwach

- **7 użytkowników** (`users.organization_id`: `dbr77` → kanoniczna):
  `admin@dbr77.com`, `ewa.nowicka@`, `jan.kowalski@`, `jan.zielinski@`,
  `katarzyna.wojcik@`, `piotr@dbr77.com`, `tomasz.lewandowski@`.
- **7 z 9 członkostw** przeniesionych; **2 zostają** (punkt 1.3.1) — inaczej
  powstałby duplikat `(organization_id, user_id)`.
- Nikt nie traci dostępu: 2 osoby z duplikatem miały członkostwo w organizacji
  docelowej już wcześniej, a ich `users.organization_id` i tak wskazywał
  kanoniczną.
- Katalog członków organizacji docelowej: 9 → **16**. Konta z `organization_id`
  = kanoniczna: 9 → **16**.

**Dwie rzeczy do wiadomości właściciela (nie zmieniałem ich samodzielnie):**
1. `admin@dbr77.com` ma rolę globalną **SUPERADMIN** i wchodzi teraz do
   organizacji kanonicznej jako ADMIN katalogu.
2. W jednej organizacji są teraz **dwa konta „Piotr Wiśniewski"**:
   `piotr.wisniewski@dbr77.com` (ADMIN, OWNER katalogu) i `piotr@dbr77.com`
   (ADMIN, OWNER katalogu). Adresy są różne, więc nie ma kolizji technicznej —
   ale na ekranie członków będą dwa takie same nazwiska.

---

## FAZA 2 — ZAPIS

Wykonany: `--apply` z `server/scripts/scal-organizacje.ts`.

- **kopia bezpieczeństwa**: 85 plików CSV (pełne wiersze, `snapshot_json`),
  zapisane na dysk **przed** pierwszym UPDATE — `apply-OSTATECZNY/kopia-*.csv`;
- **jedna transakcja**: wszystkie 85 UPDATE-ów + wszystkie kontrole w jednym
  `BEGIN … COMMIT`. Każdy błąd i każda nieprzechodząca bramka = `ROLLBACK`
  całości (tak zadziałało za pierwszym podejściem, gdy bramka osierocenia
  zgłosiła niezadeklarowany wzrost);
- **manifest cofnięcia**: `apply-OSTATECZNY/manifest.json` (1 447 wpisów);
- **`--rollback` udowodniony na żywym zapisie, nie na opisie**: po pierwszym
  `--apply` uruchomiono cofnięcie — `COFNIĘTE: 1447 z 1447`, stan wrócił co do
  wiersza (7 RAID w legacy, 0 w kanonicznej, 7 inicjatyw, 7 użytkowników).
  Dopiero potem wykonano `--apply` nr 2, którego manifest jest operacyjnym
  punktem cofnięcia dla obecnego stanu. Dowód: `logi/3-rollback-DOWOD.txt`.
  Cofnięcie ma własną bramkę: przywrócenie mniejszej liczby wierszy niż
  w manifeście wywraca transakcję (częściowe cofnięcie jest gorsze niż żadne).

### Co przeniosłem — per tabela

Pełne liczby: `apply-OSTATECZNY/liczby-przed-po.csv` (99 wierszy).
**1 447 wierszy w 85 tabelach.** Najważniejsze:

| tabela | legacy przed → po | kanoniczna przed → po |
|---|---|---|
| `v8_output_artifacts` | 185 → 0 | 519 → 704 |
| `tasks` | 56 → 0 | 141 → 197 |
| `wave5_artifacts` | 31 → 0 | 206 → 237 |
| `my_ideas` | 20 → 0 | 17 → 37 |
| `presentation_decks` | 20 → 0 | 93 → 113 |
| `my_idea_maps` | 19 → 0 | 13 → 32 |
| `generated_workbooks` | 13 → 0 | 31 → 44 |
| `decisions` | 12 → 0 | 67 → 79 |
| `initiatives` | 7 → 0 | 97 → 104 |
| **`raid_items`** | **7 → 0** | **0 → 7** |
| `users` | 7 → 0 | 9 → 16 |
| `organization_members` | 9 → 2 | 9 → 16 |
| `meetings` | 5 → 0 | 10 → 15 |
| `interview_sessions` | 2 → 0 | 9 → 11 |
| `projects` | 1 → 0 | 15 → 16 |
| `assessments` | 1 → 0 | 10 → 11 |

Suma: źródło **11 686 → 10 239**, cel **112 680 → 114 127** (liczby liczone po
tych samych 99 tabelach planu).

---

## FAZA 3 — DOWÓD

### 3.1 Liczby przed i po

`apply-OSTATECZNY/liczby-przed-po.csv` — per tabela: ile było w legacy, ile
przeniesiono, ile zostało w legacy, ile było i jest w kanonicznej.

### 3.2 Kontrola spójności

`logi/6-dowod-koncowy-spojnosc.txt`:

- **klucze obce: 294 sprawdzone na wierszach organizacji kanonicznej, 0 zerwanych**
  (dziecko bez istniejącego rodzica);
- **duplikaty członkostwa `(organization_id, user_id)`: 0** (w całej tabeli, nie
  tylko w tych dwóch organizacjach);
- **wskazania „dziecko w jednej organizacji → rodzic w drugiej"**:
  przed scaleniem 164 wiersze w 8 miejscach, po scaleniu **575 wierszy w 3
  miejscach** — i wszystkie 3 są zadeklarowane, żadne nie jest niespodzianką:

  | miejsce | wierszy | dlaczego |
  |---|---|---|
  | `activity_logs.user_id` → `users` | 570 | dziennik zostaje, konto jedzie (punkt 1.4) |
  | `organization_members.user_id` → `users` | 2 | dwa członkostwa z duplikatu (punkt 1.3.1) — stan sprzed scalenia, bez zmiany |
  | `rvn_platform_resource_visibility.policy_id` → `rvn_platform_visibility_policies` | 3 | stempel polityki (punkt 1.3) |

  Bramka porównuje **liczby**, nie samą obecność krawędzi — krawędź, która
  przed zapisem miała 1 wiersz, a po zapisie 500, jest wzrostem i musi być
  rozstrzygnięta. Pierwsze podejście `--dry-run` **wywróciło transakcję**
  właśnie na tym (wzrost `activity_logs` 83 → 570), zanim wzrost został
  jawnie uzasadniony i zadeklarowany.

  Osobno zmierzono dwa powiązania, których **nie ma w bazie jako klucz obcy**,
  więc bramka oparta na `pg_constraint` byłaby tam ślepa:
  `v8_artifact_origin_links.artifact_id` → `v8_output_artifacts` (99 wierszy,
  punkt 1.3.2) i `api_logs.user_id` → `users` (9 111, punkt 1.4).

- **6 z 8 miejsc niespójnych sprzed scalenia ZNIKNĘŁO** (79 wierszy),
  potwierdzone osobnym zapytaniem po zapisie — każde zwraca teraz 0:
  `tasks.assignee_id` 15, `tasks.reporter_id` 13, `activity_logs.user_id`
  (kierunek kanoniczna→legacy) 44, `decisions.created_by` 4,
  `initiatives.owner_execution_id` 2, `access_requests.reviewed_by` 1.
  Zniknęło też 37 wierszy `api_logs.user_id` w kierunku kanoniczna→legacy.

### 3.3 Zapytania czytające produktu

`logi/7-zapytania-czytajace-produktu.txt` — uruchomione dla organizacji
kanonicznej:

| zapytanie produktu | wynik |
|---|---|
| `raid.routes.ts:62` — `GET /api/raid` | **7 pozycji** (było 0) |
| `raid.routes.ts:70` — filtr po projekcie „Transformacja Cyfrowa Q2 2026" | **7** |
| `ExecutionController.ts:436` — `risksSql` (RISK, OPEN/IN_PROGRESS) | **4** |
| `ExecutionController.ts:948` — RAID z `LEFT JOIN initiatives`: ryzyka bez nazwy inicjatywy | **0** |
| to samo: ryzyka z inicjatywą w INNEJ organizacji (ekran, który kłamie) | **0** |
| `ExecutionController.ts:243` — zadania projektu | **45** |
| `ExecutionController.ts:425` — decyzje projektu | **12** |
| inicjatywy projektu | **6** |
| właściciele RAID spoza organizacji docelowej | **0** |

Dwa ostatnie wiersze to dokładnie te dwa defekty, dla których poprzednie
zlecenie (DEC-448, samo RAID) zostało zatrzymane: 7 osierocen inicjatywy
i 4 osierocenia właściciela. **Oba są teraz zerowe.**

### 3.4 Drugi przebieg trybu próbnego

`logi/5-dry-run-PO-idempotencja.txt`:
`PLAN · tabel z danymi w źródle: 17 · wierszy w źródle: 10239 · **do przeniesienia: 0**`.

### 3.5 `tsc` serwera

`npx tsc -p server/tsconfig.json --noEmit` → **exit 0, 0 błędów**.

### 3.6 Zrzut ekranu — NIE MAM

**Nie zrobiłem zrzutu ekranu ze stagingu i nie twierdzę, że widziałem ekran.**
Nie dysponuję ważną sesją, konta nie zakładam i hasła nie podaję. Dowodem jest
stan danych i wynik zapytań czytających z punktu 3.3 — uruchomionych literalnie
tak, jak robią to kontrolery.

---

## CO ZOSTAŁO W ORGANIZACJI LEGACY

**10 239 wierszy w 17 tabelach** (z 11 686 w 99 tabelach). Nic nie zostało
skasowane — to nie jest pusta skorupa i nie miała nią być, bo część wierszy
fizycznie nie mogła pojechać:

| tabela | wierszy | dlaczego zostaje |
|---|---|---|
| `api_logs` | 9 113 | dziennik techniczny (1.4) |
| `activity_logs` | 570 | dziennik techniczny (1.4) |
| `audit_log` | 430 | dziennik audytowy (1.4) |
| `v8_artifact_origin_links` | 99 | kolizja UQ (1.3.2) |
| `project_role_templates` | 12 | słownik, duplikat (1.3.3) |
| `rvn_platform_visibility_policies` | 3 | konfiguracja, duplikat (1.3.4) |
| `organization_members` | 2 | duplikat członkostwa (1.3.1) |
| `okr_vnext_*` (8 tabel) | 8 | blok OKR, kolizja aktywnego programu (1.3.5) |
| `organization_context_snapshots` | 1 | cache per organizacja (1.3.6) |
| `rvn_platform_resource_visibility` | 1 | wiersz zestawu OKR, jedzie z blokiem OKR (1.3) |

Plus poza skanem `organization_id`: `audit_events.org_id` 497,
`organization_switch_log` 5.

Merytorycznie w legacy nie ma już **żadnej** inicjatywy, zadania, decyzji,
pozycji RAID, spotkania, artefaktu, oceny, projektu ani użytkownika.
Decyzję o usunięciu pustej organizacji właściciel podejmuje osobno —
**nic nie skasowałem**.
