# PLAN — sprzątanie bazy i jedna kompletna baza pokazowa po angielsku

**Data:** 2026-09-08 · **Autor:** Fable (CTO) · **Stan:** DO ZATWIERDZENIA PRZEZ WŁAŚCICIELA.
**Nic z tego dokumentu nie zostało wykonane.** Wszystkie liczby pochodzą z pomiaru
na **kopii** bazy stagingu — [`POMIAR.md`](POMIAR.md), zapytania w
[`POMIAR.sql`](POMIAR.sql), surowy odczyt w
[`pomiar-wiersze-per-tabela.txt`](pomiar-wiersze-per-tabela.txt).

Zlecenie właściciela (08.09): *„Musimy posprzątać bazę danych, wyrzucając większość
rzeczy… 1) usuń niepotrzebne rekordy, 2) stwórz wspólną, sensowną i KOMPLETNĄ bazę
danych po ANGIELSKU. Nie potrzebujemy wielu elementów, potrzebujemy dobrze
wypełnionej bazy po angielsku."*

---

## 0. Co pomiar zmienił w zleceniu — czytaj przed resztą

Trzy rzeczy w zleceniu okazały się nieścisłe. Poprawiam je tutaj, żeby nie weszły
do zleceń dla robotników.

1. **`ON_HOLD` nie jest statusem inicjatywy.** Kanoniczny słownik DEC-424
   (`server/src/constants/initiativeStatuses.ts:1-15`) ma siedem statusów:
   `PROPOSED`, `DRAFT`, `PENDING_APPROVAL`, `APPROVED`, `IN_EXECUTION`, `CLOSED`,
   `REJECTED`. `on_hold` i `archived` to **flagi** (`INITIATIVE_FLAGS`, tamże `:13`).
   Inicjatywa „wstrzymana" = status `IN_EXECUTION` **plus** `on_hold=true`.
2. **„Zadania bez inicjatywy 92/197" to liczba dla samego DBR77.** W całej bazie
   jest **251 z 453** (55 %). Q11.
3. **Tabel jest 1808, nie 1817**, a sprzątanie nie dotyczy tabel tylko wierszy:
   **1262 z 1808 tabel są puste**. Realny przedmiot pracy to **164 403 wiersze**.
   Kasowanie tabel jest poza zakresem — to migracja destrukcyjna, a demo jest święte.

---

## 1. POMIAR — pięć liczb, które decydują

| | Liczba | Znaczenie |
|---|---:|---|
| 1 | **331 organizacji, z tego 318 śmieciowych (96 %)** | 286 tenantów `E2E …`, 32 testowe po nazwie, 4 puste `My Company`. Zostaje **6 realnych**: DBR77, Atelier Toys, Nordwind, VTS, `dbr77`, `system` |
| 2 | **56 304 z 123 497 wierszy (46 %) należy do organizacji testowych** | Plus 14 352 w organizacji-worku `demo-org` (1061 członków z rejestracji E2E). **Razem 70 656 wierszy = 57 % do usunięcia bez straty wartości** |
| 3 | **149 z 173 inicjatyw (86 %) nie ma opisu; 0 wierszy w `initiative_stakeholders`** | Karta inicjatywy jest pusta na podglądzie w każdej organizacji. „Właściciel biznesowy" nie istnieje nigdzie w bazie |
| 4 | **1431 z 1434 użytkowników nie ma `job_title`; 4 mają stanowisko wpisane w `users.role`** | Zasoby i Obciążenie nie znają roli. `users.role` = `UX Designer`, `DevOps Engineer`, `Product Manager`, `Senior Data Engineer` — wartości spoza słownika ról |
| 5 | **Żadna organizacja nie ma kompletu przez 16 modułów** | DBR77 ma Wyniki (140 KPI, 1100 pomiarów) ale 0 kamieni milowych, 0 zespołów, 0 audytów, 0 raportów statusu. Atelier ma kamienie (39), zespoły (5), audyty (3) ale **0 KPI, 0 widoczności KPI, 0 pozycji skrzynki My Work, 0 sesji Assessment**. Nordwind ma 28 sprawozdań finansowych i **zero użytkowników**. VTS ma jednego członka i zero treści |

Pełna tabela 27 wierszy „moduł × organizacja" — [`POMIAR.md`](POMIAR.md) §3.

### 1.1 Największe pojedyncze wygrane na kasowaniu

| Tabela | Do kasacji | Z ilu |
|---|---:|---:|
| `organization_context_claims` | 34 617 | 36 836 |
| `v8_consumer_tool_policies` · `v8_tool_catalog` | 3 366 · 3 366 | 3 509 · 3 492 |
| `organization_context_items` · `_snapshots` | 1 907 · 1 499 | 5 069 · 1 503 |
| `v8_output_artifacts` · `v8_artifact_origin_links` | 1 360 · 1 341 | 2 223 · 2 081 |
| `users` | 335 | 1 434 |
| `organization_members` (sam `demo-org`) | 1 061 | 1 445 |

### 1.2 Tabele bez czytającego kodu — kandydaci bez ryzyka

Kopie zapasowe po naprawie z lipca 2026, nie dane produktu:
`_z139_repair_backup_20260710` (49), `z139_backup_919_work_canvas_versions` (23),
`z139_backup_919_tasks` (2), `_v8_flag_backup_20260710` (2), `_migration_518_done` (1),
a w pełnym odczycie także `z139_backup_919_initiatives`, `z139_backup_919_decisions`,
`z139_backup_t5_notebook_pages_title`. Do tego `finance_periods` (45, osierocona po
przejściu na `finance_stmt_periods`) i `finance_reason_codes` (14).

**Metoda była zgrubna** (grep po samej nazwie w `server/src` — nazwa bywa
w komentarzu, nie w zapytaniu). Ostrzejszy skan po czasownikach SQL nie zdążył
się skończyć. **D0 krok 2 ma go dokończyć, zanim ktokolwiek cokolwiek skasuje.**
Brak pomiaru nie jest wynikiem.

---

## 2. DECYZJA ARCHITEKTURY — rekomendacja CTO

### 2.1 (a) Organizacja docelowa dla pokazu

> **REKOMENDACJA: jedna NOWA fikcyjna organizacja `northwind` —
> „Northwind Manufacturing Ltd." — zbudowana od zera idempotentnym seedem.
> DBR77 zostaje jako druga organizacja z prawdziwymi ludźmi, zredukowana do
> ~8 realnych kont. Wszystko inne znika.**

**Dlaczego nowa, a nie rozbudowa Atelier Toys** (kuszące, bo Atelier jest już po
angielsku i ma pełny rozkład statusów DEC-424 na 24 inicjatywach):

- Atelier niesie **289 wierszy o nieznanym rodowodzie**, w tym 3 konta-śmieci
  (`audit-m07-1783274894@local.test`, `cleanup-1783274965@local.test`,
  `codex.qa.20260807.0400@example.com`) i **klon w organizacji sesyjnej**
  `demo-org-session-d1538cccff-msarpqu3` (185 wierszy, ta sama nazwa „Atelier Toys").
- Nie da się napisać uczciwego `--verify` liczącego wiersze, gdy w organizacji
  leży nieznana zaszłość. `--verify` musi mówić „ma być dokładnie N", nie „ma być
  co najmniej N".
- Atelier ma i tak **0 KPI, 0 wierszy widoczności KPI, 0 pozycji skrzynki
  My Work, 0 sesji Assessment, 0 agregatów runtime-v1** — połowa modułów wymaga
  budowy od zera mimo wszystko.
- DEC-401/DEC-402 (runbook `docs/program/demo-pilotaz/`) już przyjął zasadę
  **świeżej organizacji pilotażowej**. Ta rekomendacja jest z nią zgodna.

**Dlaczego nazwa `northwind`, skoro istnieje `Nordwind Components GmbH`:**
`nordwind` (37 wierszy: 28 sprawozdań finansowych, 9 inicjatyw bez opisów,
**zero użytkowników** — nikt się tam nie zaloguje) idzie do dumpu i usunięcia
w D0. Po jego usunięciu identyfikator `northwind` nie jest mylący. **Jeśli
właściciel chce zachować Nordwind — trzeba zmienić nazwę organizacji pokazowej**
(pytanie P3 w §5), bo dwie podobne nazwy na jednej liście to pułapka na każdym
przyszłym pomiarze.

**Alternatywy i ich wady** (odrzucone, podane żeby właściciel widział, co odrzucam):

| Wariant | Zaleta | Dlaczego odrzucam |
|---|---|---|
| Rozbudować Atelier Toys | Najtańszy start, dane już po angielsku | Nieznana zaszłość → `--verify` nie może być twarde; klon sesyjny o tej samej nazwie; i tak brak połowy modułów |
| Przetłumaczyć DBR77 na angielski | Najbogatsza organizacja (1564 wiersze) | DBR77 to **prawdziwi ludzie i prawdziwa firma właściciela**. Tłumaczenie na angielski niszczy jej realną wartość. Do tego 86 % inicjatyw bez opisu — tłumaczenie pustki daje pustkę |
| Dwie organizacje pokazowe (produkcyjna + usługowa) | Pokazuje wielobranżowość | Podwaja koszt seedu i galerii odbioru, a właściciel prosił wprost o „jedną wspólną bazę". Druga firma po MVP |
| Zostawić wszystko, tylko dosypać dane | Zero ryzyka kasowania | Nie realizuje zlecenia. 96 % organizacji to śmieć widoczny w panelu administratora |

### 2.2 (b) Co z pozostałymi organizacjami

| Organizacja | Wierszy | Decyzja | Uzasadnienie |
|---|---:|---|---|
| **DBR77** (`a3e05d4a-…`) | 1564 | **ZOSTAJE**, wyczyszczona | Prawdziwi ludzie, prawdziwa firma. Usunąć: `acceptance.owner@consultify.local`, duplikat `piotr@dbr77.com`, naprawić 4 `users.role` będące stanowiskami i `R&amp;amp;amp;D Specjalist` |
| **`dbr77`** („DBR77 Digital Consulting", 2 członków) | ~2 | **DUMP + USUŃ** | Druga, pusta organizacja o mylącej nazwie |
| **Atelier Toys** (`atelier`) | 289 | **DUMP + USUŃ** | Zastąpiona przez `northwind`. Dump zachowuje wzór treści angielskiej do wykorzystania w D3 |
| **`demo-org-session-d1538cccff-msarpqu3`** | 185 | **USUŃ** | Klon sesyjny Atelier, śmieć z testu |
| **Nordwind Components GmbH** (`nordwind`) | 37 | **DUMP + USUŃ** | Zero użytkowników → ekran finansów tam nieosiągalny. Dump zachowuje 28 sprawozdań jako materiał dla D5 |
| **VTS Group S.A.** (`vts`) | 1 | **USUŃ** *(pytanie P4)* | 1 członek, zero treści. Ale nazwa sugeruje realnego klienta — pytam właściciela |
| **Demo Organization** (`demo-org`) | 14 352 | **USUŃ** | Worek po rejestracjach E2E: 1061 członków, 1278 pomysłów. Zero wartości pokazowej |
| **`system`** | — | **ZOSTAJE** | Organizacja techniczna, wymagana przez runtime |
| **325 organizacji testowych** | 56 304 | **USUŃ** | 286 `E2E …`, 32 testowe, 4 `My Company`, 3 pozostałe |

### 2.3 (c) Mechanizm — co budujemy, a czego NIE budujemy od nowa

**Wzór mechanizmu już jest w repo: `scripts/demo/seed-organizacja-pilotaz.ts`.**
Ma dokładnie to, o co prosi zlecenie: `--dry-run` / `--apply` / `--rollback`,
`--oczekiwany-host` (guard: odmawia, jeśli baza to nie ta, którą podano),
deterministyczne UUIDv5 z e-maila, twardą idempotencję („drugi `--apply` musi dać
`utworzono=0 zmieniono=0`"), hasła wyłącznie poza repo, zakaz ustawiania
`SUPERADMIN`. **Robotnicy mają go reużyć, nie napisać własnego.**

Uzupełniające składniki, też już w repo:

| Potrzeba | Skąd wziąć |
|---|---|
| Tryby CLI + manifest z `before`-snapshotem + CSV do `evidence/` | `server/scripts/higiena-wlasciciela/wspolne.ts` (wymusza `--org=` + dokładnie jeden z `--dry-run\|--apply\|--rollback=<manifest.json>`) |
| Referencyjny konsument tej biblioteki | `server/scripts/usun-rekordy-aco.ts` |
| Guard kasowania organizacji + **topologia 164 kluczy obcych na `organizations.id` (129 CASCADE, 8 SET NULL, 27 NO ACTION)** | `server/scripts/cleanup-orphan-demo-orgs.ts` — `--apply` wymaga dodatkowo `FORCE_PURGE=true`, odmawia na hoście produkcyjnym bez `ALLOW_PROD=true` |
| Kolejność `DELETE` przy kasowaniu tenanta (20+ tabel) | `server/scripts/seedLegolexDemoOrg.js:159-221` |
| Wzór `--verify` z asercjami progowymi | `server/scripts/seed-demo-dataset-contract.ts:547-590` (`validateContract()`) |
| Precedens SQL-owego seedu agregatów runtime-v1 z guardem hosta | `server/scripts/seed-wave3-initiatives-owner-review.ts:422,640` |

**Czego nie ma i trzeba zbudować:** ogólnego `purge-tenant --org=<dowolna>`.
Buduje go D0 ze składników powyżej.

**Docelowa struktura:**

```
server/scripts/seed/demo-en/
  00-wspolne.ts          # UUIDv5, guard hosta, tryby CLI, licznik utworzono/zmieniono
  01-rdzen.ts            # organizacja, 9 osób, profil, zespoły, projekt
  02-odkrycie.ts         # Interview, Tools, Assessment
  03-inicjatywy.ts       # Initiatives + rejestracja agregatów przez API
  04-realizacja.ts       # Execution: zadania, kamienie, RAID, decyzje, raporty
  05-wyniki-finanse.ts   # Results (KPI przez API!) + Finance
  06-materialy.ts        # Materials, Meetings, Chat, My Work
  99-verify.ts           # liczy wiersze, asercje twarde (== N, nie >= N)
scripts/dane/
  usun-organizacje.ts    # skrypt sprzątający: --lista-id, --dry-run, --apply, --rollback
```

Każdy podskrypt: `--dry-run` (domyślny brak trybu = błąd, tak jak w pilotażu),
`--apply`, `--reset` (kasuje **wyłącznie** `organization_id='northwind'`),
`--verify`. Wspólny `--oczekiwany-host`.

### 2.4 (d) Kolejność środowisk — nienaruszalna

```
1. kopia lokalna (consultify_staging_kopia)   → seed + --verify
2. galeria zrzutów: 16 modułów, każdy po angielsku, dark+light
3. AKCEPT WŁAŚCICIELA na zrzutach             ← BRAMKA, bez niej nic dalej
4. staging (thomas)                            → dump PRZED, seed, --verify
5. demo (trolley)                              → dump PRZED, seed, --verify
```

**Reguły:** demo jest święte — merge, nigdy force-push. Migracje wyłącznie
addytywne. Przed każdym krokiem 4 i 5 obowiązkowy `pg_dump` z kontenera PG18
(`scripts/demo/kopia-bazy.sh` już to robi; `przywroc-baze.sh` to odwraca).
Właściciel **nigdy nie jest pierwszym testerem wizualnym** — punkt 7 CLAUDE.md.

---

## 3. PROJEKT DANYCH — „Northwind Manufacturing Ltd." po angielsku

Jedna spójna historia klienta, przechodząca przez 16 pozycji menu w kolejności
z `docs/FUNCTIONAL_DOCUMENTATION.md`.

**Firma:** Northwind Manufacturing Ltd. — brytyjski producent komponentów
przemysłowych, 2 zakłady (Leeds, Rotherham), 340 pracowników, przychód 48 mln GBP.
**Historia:** program transformacji operacyjnej „Northwind 2027" — od wywiadów
i oceny dojrzałości, przez portfel inicjatyw, po realizację i pomiar korzyści.
**Domena e-mail:** `@northwind.example` (RFC 2606 — domena zarezerwowana, nigdy
nie zadziała jako prawdziwy adres).
**Identyfikatory:** deterministyczne, `nw--<obiekt>--<slug>`, np.
`nw--initiative--warehouse-automation`. UUID gdzie kolumna tego wymaga: UUIDv5
z tagu `northwind-demo-2026` + slug.

### 3.0 Pułapki wspólne dla wszystkich paczek

| Pułapka | Fakt z pomiaru | Skutek dla seedu |
|---|---|---|
| Fail-closed realizacji | 3 miejsca: `initiativesExecutionRuntime.routes.ts:4844-4860`, `:1446-1455`, `executionBvpService.ts:198-201` | **Każda** inicjatywa `IN_EXECUTION` MUSI mieć `project_id`. Bez niego realizacja jest niewidoczna i `GET …/work` daje 404 |
| Widoczność KPI | `kpiRepository.ts:127-128` — `INNER JOIN rvn_visible_resources` | KPI bez wiersza w `rvn_platform_resource_visibility` **nie pojawi się na liście**, mimo że jest w `rvn_kpi_definitions`. Atelier ma 0 takich wierszy — dlatego jego Wyniki są puste |
| Skrzynka My Work | `my-work.routes.ts:86-95` — brak tabeli ⇒ 503 | Ekran czyta `canonical_inbox_items` (materializacja z `tasks`/`decisions`/`notifications`/`action_cards`, `inboxService.ts:199-228`), nie `tasks` wprost. Atelier ma tam 0 |
| Audyty | `auditsStrictMembership.middleware.ts:109-118` | Wymaga wiersza `organization_members` ze `status='ACTIVE'`. **Fail-closed: błąd odczytu tabeli ⇒ 503** |
| Portal partnerski | `partners.routes.ts:225-243` | Wymaga wiersza w `partner_users`; bez niego 403 „Partner organization required" |
| Katalog narzędzi | `tools` **nie ma** `organization_id`, 31 wierszy globalnie | **Nie seedować.** Moduł Tools działa z katalogu globalnego |
| `initiatives` ma `name` **i** `title` | `name` jest NOT NULL bez wartości domyślnej | Wypełnić OBA, tą samą treścią (`createInitiativeService.ts` robi to normalizacją — SQL nie) |
| Portfel systemowy | partial unique `uq_projects_org_system_portfolio` (migracja 912) | `projects.is_system` zakładać przez `initiativeProjectPolicyService.ts:71`, nie ręcznym INSERT |
| Bramki cyklu życia | 17 kolumn NOT NULL, FK do `v8_agent_proposal_versions` i `v8_agent_proposal_scope_reviews`, trigger `…_immutable`, wartości tylko `approved`/`rejected` | **Poza zakresem seedu.** Zbudowanie łańcucha A05 to osobna praca. Bez bramek inicjatywy i tak przechodzą (bramka jest opcjonalna dla listy) |

### 3.1 Rozpiska per moduł

| # | Moduł | Co seedujemy | Tabele | Droga |
|---|---|---|---|---|
| — | **Rdzeń** | 1 organizacja **`organization_type='PAID'`** (nie `plan` — to osobna kolumna z wartościami `enterprise`/`trial`/`free`/`demo`; `DEFAULT_TRIAL_LIMITS.max_users=4` i `DEFAULT_DEMO_LIMITS.max_users=1` w `server/src/services/access/AccessTypes.ts:15,25` nie pomieszczą 9 osób, `DEFAULT_PAID_LIMITS` ma 10000 — `:35`), **9 osób** z `first_name`/`last_name`/`job_title`/`weekly_capacity_hours`/`department`, role systemowe **wyłącznie** ze słownika (`OWNER` ×1, `ADMIN` ×1, `MANAGER` ×3, `USER` ×4), członkostwa `status='ACTIVE'`, 2 zespoły, 1 projekt niesystemowy + portfel systemowy | `organizations`, `users`, `organization_members`, `teams`, `team_members`, `projects`, `organization_context_store` | SQL; portfel przez serwis |
| 1 | **Chat** | 3 wątki: „Operations maturity — where do we start?", „Warehouse automation business case", „Q3 benefits review"; po 6–10 wiadomości; 1 projekt czatu | `conversations`, `conversation_messages`, `chat_projects` | SQL |
| 2 | **My Work** | 6 zadań osobistych (`task_type='personal'`), 4 pomysły, **materializacja skrzynki** | `tasks`, `my_ideas`, **`canonical_inbox_items`** | SQL + `inboxService` |
| 3 | **Interview** | 2 wywiady („Plant operations — Leeds", „Supply chain & procurement") z 12–15 pytaniami i odpowiedziami, 4 wnioski (`interview_insights`) | `interview_sessions`, `interview_questions`, `interview_answers`, `interview_insights` | SQL |
| 4 | **Tools** | 3 sesje narzędzi z katalogu globalnego (SWOT, Value Stream Map, Stakeholder Map) z wynikami; **katalogu `tools` NIE ruszamy** | `tool_sessions`, `tool_assets` | SQL |
| 5 | **Assessment** | 1 ocena dojrzałości operacyjnej z wynikiem i raportem, 1 sesja Method Core (DRD) | `assessments`, `assessment_reports`, `method_sessions`, `method_outputs` | SQL |
| 6 | **Initiatives** | **12 inicjatyw, pełny rozkład DEC-424** — patrz §3.2. Każda z `name`+`title`+`description` (3–5 zdań)+`category`+`priority`+ autorem (`created_by`)+ interesariuszami RACI | `initiatives`, `initiative_stakeholders`, `initiative_kpis`, `initiative_benefits`, `ie_aggregate_state` | SQL **+ `POST /runtime-v1/planning/initiatives/:id/register`** |
| 7 | **Execution** | **36 zadań** z osobami i terminami (**8 po terminie**), 8 kamieni milowych z planem bazowym, **7 RAID** z terminami i p×w, **9 decyzji** z decydentem i terminem (**3 po terminie**), 2 raporty statusu, sygnały | `tasks`, `initiative_milestones`, `raid_items`, `decisions`, `status_reports`, `plan_baselines` | SQL; RAID przez API |
| 8 | **Results** | 8 definicji KPI + 6 pomiarów każda (48 pomiarów), 3 cele OKR z kluczowymi wynikami, 1 przypadek ROI. **Obowiązkowo wiersze widoczności** | `rvn_kpi_definitions`, `rvn_kpi_definition_versions`, `rvn_kpi_measurements`, **`rvn_platform_resource_visibility`**, `okr_vnext_*`, `rvn_roi_*` | **API** `POST /api/vnext/results/kpi` — obowiązkowo |
| 9 | **Finance** | Minimum wg zakresu MVP: 1 paczka sprawozdań (P&L + bilans, 4 kwartały), 1 budżet z pozycjami, 3 wskaźniki | `financial_statement_packs`, `financial_statements`, `financial_statement_values`, `budgets`, `budget_lines` | SQL |
| 10 | **Materials** | 4 dokumenty (Charter, Business Case, Status Report, Playbook), 2 talie prezentacji, 1 skoroszyt; **wpisy w rejestrze artefaktów** | `knowledge_docs`, `presentation_decks`, `generated_workbooks`, **`v8_output_artifacts`**, `v8_artifact_origin_links` | SQL |
| 11 | **Audits** | 1 pakiet audytowy, 1 program z 6 kryteriami, 3 ustalenia. **Wymaga `organization_members.status='ACTIVE'`** | `audit_packs`, `audit_programs`, `audit_program_criteria`, `audit_findings` | SQL |
| 12 | **Meeting** | 2 spotkania z uczestnikami i notatkami. **Moduł za flagą `VITE_MODULE_MEETINGS`, domyślnie OFF** (`src/utils/meetingsModuleFlag.ts:47-53`) — dane seedujemy, flagę włącza właściciel osobno | `meetings`, `meeting_participants`, `meeting_notes` | SQL |
| 13 | **Organization** | Profil organizacji (opis, branża, wielkość, lokalizacje), branding, magazyn kontekstu | `organization_profiles`, `organization_branding`, `organization_settings`, `organization_context_store` | SQL |
| 14 | **Admin Panel** | 2 zaproszenia oczekujące, przypisania ról. Ekran czyta `organization_members`+`users` — wypełniony przez rdzeń | `invitations`, `admin_role_assignments` | SQL |
| 15 | **Settings** | Preferencje 9 użytkowników (język **`en`**, strefa `Europe/London`), rozszerzony profil | `user_preferences`, `user_profiles`, `user_profile_extended` | SQL |
| 16 | **Partner Portal** | 1 organizacja partnerska + wiersz `partner_users` (bez niego 403), 2 atrybucje, 1 prowizja | `partner_organizations`, `partner_users`, `partner_attributions`, `partner_commission_transactions` | SQL |

### 3.2 Dwanaście inicjatyw — pełny rozkład DEC-424

| # | Tytuł (EN) | Status | Flaga | Wymagane pola |
|---|---|---|---|---|
| 1 | Warehouse Automation Wave 1 | `IN_EXECUTION` | — | **`project_id`**, daty planu, właściciel wykonania, 6 zadań, 2 kamienie, 2 RAID |
| 2 | Predictive Maintenance Rollout | `IN_EXECUTION` | — | jw., 5 zadań, 2 kamienie |
| 3 | Supplier Risk War Room | `IN_EXECUTION` | — | jw., 4 zadania, 2 RAID |
| 4 | Frontline Skills Passport | `IN_EXECUTION` | **`on_hold=true`** | jw., 3 zadania — pokazuje wstrzymanie jako FLAGĘ, nie status |
| 5 | Energy Efficiency Programme | `APPROVED` | — | zakres, korzyść, budżet, brak jeszcze zadań |
| 6 | Quality Gate Redesign | `APPROVED` | — | jw. |
| 7 | Digital Work Instructions | `PENDING_APPROVAL` | — | wniosek, uzasadnienie, szacunek, autor |
| 8 | Rotherham Line 3 Digital Twin | `PENDING_APPROVAL` | — | jw. |
| 9 | Customer Portal Refresh | `DRAFT` | — | **opis i zakres** (bo 86 % zastanych szkiców ich nie ma) |
| 10 | Scrap Reduction Sprint | `DRAFT` | — | jw. |
| 11 | Legacy ERP Retirement | `CLOSED` | — | wynik, korzyść zrealizowana, data zamknięcia |
| 12 | Robotic Palletiser Pilot | `REJECTED` | — | powód odrzucenia, decydent, data |

**Brakuje `PROPOSED`** — zastana baza ma tam 0 wierszy. Dokładam **inicjatywę 13:
Shopfloor IoT Sensors** ze statusem `PROPOSED`, żeby galeria pokazała komplet
siedmiu statusów. **13 inicjatyw, nie 12.**

Plan i analiza obciążenia: każda inicjatywa `IN_EXECUTION` dostaje
`required_capacity_fte` i `allocated_capacity_fte`; suma alokacji na osobę nie
może przekroczyć jej `weekly_capacity_hours` — **to jest asercja w `--verify`**,
nie deklaracja.

### 3.3 Co SQL-em, a co przez API — rozstrzygnięcie

Podstawa: kontrakty zapisu zmierzone w kodzie ([`POMIAR.md`](POMIAR.md) §8).

**MUSI przez API** (czysty INSERT gubi efekty, których ekran wymaga):
- **KPI (Wyniki)** — `POST /api/vnext/results/kpi`. SQL gubi event-log i outbox
  platformy (`20260809_rvn_platform_events_outbox.sql`), CAS `row_version`,
  `state_hash`, idempotencję i wersjonowanie `rvn_kpi_definition_versions`.
- **Agregaty runtime-v1** — `POST /runtime-v1/planning/initiatives/:id/register`
  (`initiativesExecutionRuntime.routes.ts:3599`). SQL gubi `ie_aggregate_state`
  (wersja CAS), `ie_audit_events`, `ie_outbox_events`, `ie_command_receipts`,
  `ie_aggregate_relations`.
  **Uwaga:** `register` przyjmuje wyłącznie `APPROVED` (lub `PENDING_APPROVAL`
  warunkowo) i **odrzuca** `IN_EXECUTION` → `400 INITIATIVE_NOT_PLANNABLE`
  (`registerModuleInitiativeForPlanning.ts:28-34`). **Kolejność jest wymuszona:**
  utwórz inicjatywę jako `APPROVED` → zarejestruj → dopiero potem przestaw na
  `IN_EXECUTION`. To jest STOP w paczce D3.

**Można SQL-em** (droga kanoniczna nie robi nic ponad INSERT):
projekty, zadania (`tasks.routes.ts:61-80` mówi wprost, że
`postgresMaterialCommandUnitOfWork.ts` nie ma ani jednego `INSERT/UPDATE`
na `tasks`), spotkania (`legacyCutover/registry/meetings.ts`: „No canonical
meeting-creation route exists"), kamienie milowe legacy, dokumenty, sprawozdania
finansowe, preferencje.

**SQL degraduje bezpiecznie, ale API lepsze:** RAID (dual-write; `raid.routes.ts:70-83`
robi `LEFT JOIN`, `aggregateVersion: null` → writer adoptuje wiersz),
decyzje (gubisz `decision_history` i CAS), inicjatywy legacy (gubisz normalizację
`name`+`title`, auto-anchor projektu, `assertCardMeetsFormula`, audyt).

**Ekran Inicjatyw czyta z DWÓCH źródeł jednocześnie**
(`InitiativesHub.tsx:522-575`, `Promise.all` + `mergeLegacyInitiativesIntoRegister`,
**bez flagi**, DEC-397). Skutek: inicjatywa wstawiona SQL-em **będzie widoczna na
liście**, ale nie w planowaniu ani realizacji, dopóki nie przejdzie przez `register`.
To jest dokładnie ta pułapka, przez którą „widać na liście" myli się z „działa".

---

## 4. PACZKI DLA ROBOTNIKÓW

**Wspólne dla każdej paczki — wkleić do każdego zlecenia:**

> **KROK 0 — ZMIERZ PREMISĘ.** Zanim cokolwiek napiszesz, sprawdź własnym
> zapytaniem, czy liczby podane w tej paczce zgadzają się z bazą. Jeśli nie —
> **zatrzymaj się i zamelduj rozjazd**, nie „popraw po cichu". Premisa
> z rejestru bywa fałszywa.
>
> **Baza:** wyłącznie `postgresql://postgres:postgres@127.0.0.1:54418/consultify_staging_kopia`.
> **NIGDY** staging (thomas), demo (trolley) ani produkcja (centerbeam).
> Każdy skrypt musi mieć `--oczekiwany-host` i odmawiać, gdy host się nie zgadza.
>
> **Gałąź:** świeża z `origin/demo`, worktree, commit-per-krok, **NIE push**.
> Nowe pliki w `tests/` wymagają `git add -f`.
>
> **Dowód:** liczby PRZED i PO z zapytania (nie z pamięci), wynik `--verify`,
> a dla paczek z ekranem — **zrzut ekranu modułu po angielsku** (dev-render
> harness, bez logowania właściciela). „Testy przeszły" ≠ „działa".
>
> **Idempotencja jest mierzona, nie deklarowana:** drugi `--apply` musi wypisać
> `utworzono=0 zmieniono=0`. Jeśli wypisuje cokolwiek innego — paczka nie jest gotowa.

---

### D0 — dump + skrypt sprzątający (dry-run) · Opus · 1 dzień

**Cel:** bezpiecznie usunąć 318 organizacji śmieciowych i `demo-org`.

**Kroki:**
1. `pg_dump` całej kopii do `evidence/dane-pokazowe-en/dump-przed-<data>.dump`
   (z kontenera PG18). **Wykonaj `ls -la` na pliku i podaj rozmiar** — dowód poza
   repo wyparowuje.
2. **Dokończ skan martwych tabel** metodą B (grep po `FROM|JOIN|INTO|UPDATE|DELETE FROM
   <tabela>` w `server/src`) dla wszystkich 546 niepustych tabel. Wynik do
   `docs/program/DANE_POKAZOWE_EN_20260908/martwe-tabele.md`. Bez tego kroku nikt
   nic nie kasuje.
3. Zbuduj `scripts/dane/usun-organizacje.ts` na bazie `higiena-wlasciciela/wspolne.ts`:
   - `--lista-id <plik.txt>` — jawna lista identyfikatorów, **żadnego dopasowania
     po wzorcu nazwy** (nazwa „Consultify" i „Test Corp" wyglądają podobnie do skryptu),
   - `--dry-run` domyślny; brak trybu = błąd,
   - `--apply` wymaga `FORCE_PURGE=true` (wzór `cleanup-orphan-demo-orgs.ts`),
   - raport: **ile wierszy z ilu tabel, per organizacja i per tabela**,
   - manifest `before` + CSV do `evidence/`, `--rollback=<manifest>`.
4. Obsłuż **27 kluczy obcych `NO ACTION`** (z 164 na `organizations.id`) — kasowanie
   ręczne przed organizacją, kolejność wzoruj na `seedLegolexDemoOrg.js:159-221`.
5. Uruchom `--dry-run` na liście 325 organizacji + `demo-org`. **STOP — nie robisz
   `--apply`.** Raport idzie do właściciela.

**Pliki:** `scripts/dane/usun-organizacje.ts`, `scripts/dane/lista-do-usuniecia.txt`,
`docs/program/DANE_POKAZOWE_EN_20260908/martwe-tabele.md`, `evidence/dane-pokazowe-en/`.
**Zależności:** brak. **Ryzyko:** dopasowanie po wzorcu zamiast po liście ID →
skasowanie DBR77. Dlatego lista jest jawna i sprawdzana oczami.
**Gotowe gdy:** dry-run raportuje ≥ 70 000 wierszy do usunięcia, `--rollback`
przećwiczony na 1 organizacji, dump istnieje i ma rozmiar > 0.

---

### D1 — seed rdzenia · Sonnet · 1 dzień

**Cel:** organizacja `northwind`, 9 osób, profil, zespoły, projekty.

**Kroki:** reużyj `scripts/demo/seed-organizacja-pilotaz.ts` jako szkieletu
(skopiuj tryby CLI, UUIDv5, guard hosta, licznik). Utwórz
`server/scripts/seed/demo-en/00-wspolne.ts` i `01-rdzen.ts`.
`organization_type='PAID'` (TRIAL ma limit 4 użytkowników, DEMO — 1;
`AccessTypes.ts:15,25,35`). **Uwaga:** `plan` to inna kolumna, o wartościach
małymi literami (`enterprise`/`trial`/`free`/`demo`) — nie mylić.
Każdy użytkownik: `first_name`, `last_name`, `job_title`, `weekly_capacity_hours`,
`department`, `timezone='Europe/London'`. `users.role` **wyłącznie** ze słownika —
nigdy stanowisko (to defekt zastany, nie wzór). Hasła losowane, wyłącznie do pliku
poza repo, `chmod 600`. **Nigdy `SUPERADMIN`.**

**Pliki:** `server/scripts/seed/demo-en/{00-wspolne,01-rdzen,99-verify}.ts`.
**Zależności:** D0 (żeby `northwind` nie kolidował z `nordwind`).
**Ryzyko:** e-mail jest globalnie unikalny (`users_email_key`) — kolizja zatrzymuje seed.
**Gotowe gdy:** `--verify` daje dokładnie 1 organizację, 9 użytkowników,
9 członkostw `ACTIVE`, 2 zespoły, 2 projekty; drugi `--apply` daje `0/0`;
zrzut ekranu Organizacja + Admin po angielsku.

---

### D2 — Interview + Tools + Assessment · Sonnet · 1 dzień

**Kroki:** `02-odkrycie.ts`. 2 wywiady z pytaniami i odpowiedziami, 4 wnioski,
3 sesje narzędzi z katalogu globalnego (**`tools` NIE ruszamy** — nie ma
`organization_id`, 31 wierszy wspólnych), 1 ocena z raportem, 1 sesja Method Core.
**Zależności:** D1. **Ryzyko:** Assessment wymaga `organizationId` w żądaniu
(`method-core.routes.ts:786-787`), inaczej błąd zamiast listy.
**Gotowe gdy:** `--verify` + 3 zrzuty (Interview, Tools, Assessment) po angielsku.

---

### D3 — Initiatives · Opus · 1 dzień

**Kroki:** `03-inicjatywy.ts`. 13 inicjatyw wg §3.2. Każda: `name` **i** `title`
(oba NOT NULL/wymagane), opis 3–5 zdań, kategoria, priorytet, autor, interesariusze
RACI w `initiative_stakeholders` (dziś 0 wierszy w całej bazie).

> **STOP 1 — kolejność jest wymuszona przez kod.**
> `register` odrzuca `IN_EXECUTION` (`registerModuleInitiativeForPlanning.ts:28-34`).
> Sekwencja: utwórz jako `APPROVED` → `POST /runtime-v1/planning/initiatives/:id/register`
> → dopiero wtedy `IN_EXECUTION`. Zapisz w meldunku, ile agregatów powstało.
>
> **STOP 2 — fail-closed.** Każda inicjatywa `IN_EXECUTION` MUSI mieć `project_id`.
> `--verify` sprawdza to zapytaniem, nie założeniem.

**Zależności:** D1. **Ryzyko:** flaga `REQUIRE_INITIATIVE_PROJECT` domyślnie ON
(`initiativeProjectPolicyService.ts:33-35`) → `400 INITIATIVE_PROJECT_REQUIRED`.
**Gotowe gdy:** `--verify` = 13 inicjatyw, 7 różnych statusów, 1 z `on_hold=true`,
0 z `IN_EXECUTION` bez `project_id`, ≥ 4 agregaty `ie_aggregate_state`;
zrzut Inicjatyw pokazuje wszystkie 7 statusów po angielsku.

---

### D4 — Execution · Opus · 1 dzień

**Kroki:** `04-realizacja.ts`. 36 zadań (osoby, terminy, **8 po terminie**),
8 kamieni z planem bazowym, 7 RAID (typ, p×w, termin, właściciel, plan zaradczy),
9 decyzji (decydent, termin, **3 po terminie**, opcje, uzasadnienie), 2 raporty statusu.
**Zależności:** D3. **Ryzyko:** RAID przez API (dual-write) — SQL zadziała, ale
bez CAS/outboxu; użyj API i zmierz, czy `ie_aggregate_state` urosło.
**Gotowe gdy:** `--verify` + zrzuty Realizacji: lista, kanban, RAID, decyzje;
0 zadań bez `initiative_id`, 0 zadań bez `assignee_id`.

---

### D5 — Results + Finance · Opus · 1 dzień

> **STOP — KPI wyłącznie przez API.** `POST /api/vnext/results/kpi`. SQL gubi
> event-log, outbox, CAS, `state_hash` i wersjonowanie.
>
> **STOP 2 — widoczność.** Po utworzeniu każdego KPI sprawdź, że powstał wiersz
> w `rvn_platform_resource_visibility`. `kpiRepository.ts:127-128` robi
> `INNER JOIN` — **KPI bez widoczności nie pojawi się na liście**. Atelier ma
> 0 takich wierszy i dlatego jego Wyniki są puste mimo danych.

**Kroki:** `05-wyniki-finanse.ts`. 8 KPI × 6 pomiarów, 3 cele OKR, 1 przypadek ROI,
1 paczka sprawozdań (4 kwartały), 1 budżet z pozycjami.
**Zależności:** D3 (KPI wiążą się z inicjatywami). **Ryzyko:** Finance jest za
`BetaGate` zamkniętym dla zwykłego użytkownika (`betaMenuStatus.ts:51`, wyjątek dla
ADMIN/OWNER) — zrzut rób z konta administratora i **napisz to w meldunku**.
**Gotowe gdy:** lista KPI **niepusta dla konta MANAGER** (nie tylko admina) — to jest
prawdziwy test widoczności; zrzuty Wyniki + Finanse.

---

### D6 — Materials + Meetings + Chat + My Work · Sonnet · 1 dzień

**Kroki:** `06-materialy.ts`. 4 dokumenty, 2 talie, 1 skoroszyt + **wpisy
w `v8_output_artifacts`** (ekran Materiałów czyta rejestr artefaktów, nie tabele
źródłowe — `artifactRegistryService.ts:3052`). 2 spotkania. 3 wątki czatu.
6 zadań osobistych + **materializacja `canonical_inbox_items`** (ekran My Work
czyta skrzynkę, nie `tasks`; brak tabeli ⇒ 503).
**Zależności:** D1. **Ryzyko:** Meeting jest za flagą `VITE_MODULE_MEETINGS`
domyślnie OFF — dane seedujemy, ale zrzut wymaga włączenia flagi lokalnie;
**flagi na stagingu/demo nie dotykamy bez decyzji właściciela.**
**Gotowe gdy:** `--verify` + zrzuty Materiały, Chat, My Work (skrzynka niepusta).

---

### D7 — galeria 16 modułów · Sonnet · 1 dzień · **ODBIÓR**

**Kroki:** dla każdej z 16 pozycji menu w kolejności `FUNCTIONAL_DOCUMENTATION.md`
zrób zrzut realnego ekranu (dev-render harness na kopii lokalnej, konto
`MANAGER` **i** konto administratora tam, gdzie moduł jest za `BetaGate`),
w wariancie jasnym i ciemnym. Złóż jedną stronę galerii.

> **Bezpiecznik przeciw czterem znanym pułapkom:**
> · para light/dark musi być dwoma RÓŻNYMI obrazami (sprawdź `mean_luma`),
> · kontrolki harnessu nie mogą zasłaniać produktu,
> · rozwinięcie sekcji nie może zamknąć podglądu,
> · **każdy widoczny napis po angielsku** — jeśli gdziekolwiek wyskoczy polskie
>   słowo, to defekt do zgłoszenia, nie do przemilczenia.

**Zależności:** D1–D6. **Gotowe gdy:** 16 modułów × 2 motywy, zero polskich napisów,
galeria wysłana właścicielowi. **To jest bramka — bez akceptu nie ma D8.**

---

### D8 — promocja staging → demo · Fable (nadzorca) · 0,5 dnia

**Kroki:** wyłącznie po akcepcie z D7.
1. `pg_dump` stagingu (thomas) → `evidence/`, `ls -la` jako dowód.
2. D0 `--apply` na stagingu, potem D1–D6 `--apply` na stagingu, `--verify`.
3. Zrzuty kontrolne 3 modułów na stagingu (nie 16 — to była bramka D7).
4. `pg_dump` demo (trolley) → `evidence/`.
5. D0 + D1–D6 `--apply` na demo, `--verify`.
6. `LISTA_KONTROLNA_PROMOCJI.md` — przejść literalnie.

**Ryzyko:** demo i staging to **osobne bazy** (potwierdzone w
`docs/program/demo-pilotaz/RUNBOOK_ROZDZIAL_DEMO.md` §0 — te same nazwy hostów
prywatnych, różne hasła). Nie zakładać, że seed na jednej trafia na drugą.
**Gotowe gdy:** `--verify` przechodzi na obu bazach; punkt cofania
(`demo-safe-<data>`) przetagowany.

---

### Podsumowanie kolejki

| Paczka | Model | Dni | Zależy od |
|---|---|---:|---|
| D0 dump + sprzątanie (dry-run) | Opus | 1 | — |
| D1 rdzeń | Sonnet | 1 | D0 |
| D2 Interview + Tools + Assessment | Sonnet | 1 | D1 |
| D3 Initiatives | Opus | 1 | D1 |
| D4 Execution | Opus | 1 | D3 |
| D5 Results + Finance | Opus | 1 | D3 |
| D6 Materials + Meetings + Chat + My Work | Sonnet | 1 | D1 |
| D7 galeria 16 modułów (**odbiór**) | Sonnet | 1 | D1–D6 |
| D8 promocja staging → demo | Fable | 0,5 | D7 + akcept |

**Razem 8,5 dnia roboczego.** D2/D3/D6 mogą iść równolegle po D1 (różne pliki),
co skraca ścieżkę krytyczną do **~5 dni**: D0 → D1 → {D3 → D4, D3 → D5, D2, D6} → D7 → D8.

---

## 5. RYZYKA I PYTANIA DO WŁAŚCICIELA

Pięć pytań. Każde na tak/nie. **Bez odpowiedzi na P1 i P2 nie ruszamy.**

| # | Pytanie | Rekomendacja CTO | Co się stanie przy „nie" |
|---|---|---|---|
| **P1** | Czy dane pokazowe mają być **jedną fikcyjną firmą po angielsku** („Northwind Manufacturing Ltd.", 9 osób, 13 inicjatyw, 36 zadań), zbudowaną od zera? | **TAK** | Wracamy do rozbudowy Atelier Toys — taniej o ~1 dzień, ale `--verify` nie może być twarde i zostaje klon sesyjny o tej samej nazwie |
| **P2** | Czy **DBR77 zostaje** jako druga organizacja z prawdziwymi ludźmi (po usunięciu konta `acceptance.owner@…`, duplikatu `piotr@dbr77.com` i naprawie 4 stanowisk wpisanych w `users.role`)? | **TAK** | Jeśli nie — usuwamy 1564 wiersze, w tym 140 KPI i 1100 pomiarów, jedyny materiał Wyników w bazie |
| **P3** | Czy usuwamy **Atelier Toys i Nordwind Components** (po zrobieniu dumpu)? | **TAK** — Atelier ma klon i 3 konta-śmieci, Nordwind ma **zero użytkowników**, więc nikt tam nie wejdzie | Jeśli Nordwind zostaje, organizacja pokazowa **musi dostać inną nazwę** niż Northwind — dwie podobne nazwy na jednej liście to pułapka |
| **P4** | Czy usuwamy **VTS Group S.A.** (1 członek, zero treści)? | **TAK**, ale pytam, bo nazwa wygląda na realnego klienta | Zostaje jako pusta pozycja na liście organizacji |
| **P5** | Czy **demo (trolley) dostaje dokładnie to samo co staging**? | **TAK** — jedna baza pokazowa, jedna prawda | Rozjazd środowisk; każdy przyszły pomiar trzeba robić dwa razy |

### Ryzyka, które biorę na siebie (nie wymagają decyzji)

1. **Skrypt kasujący pomyli organizację.** Zabezpieczenie: jawna lista ID w pliku,
   zero dopasowania po wzorcu nazwy, `--dry-run` domyślny, `--apply` wymaga
   `FORCE_PURGE=true`, manifest `before` + `--rollback`, dump przed każdym środowiskiem.
2. **27 kluczy obcych `NO ACTION`** (z 164 na `organizations.id`) wywróci kasowanie
   w połowie. Zabezpieczenie: kolejność DELETE wzorowana na `seedLegolexDemoOrg.js`,
   przećwiczona na jednej organizacji przed resztą.
3. **Seed przejdzie, a ekran zostanie pusty** — bo dane trafiły do tabeli źródłowej,
   a ekran czyta projekcję (`canonical_inbox_items`, `v8_output_artifacts`,
   `rvn_platform_resource_visibility`, `ie_aggregate_state`). Zabezpieczenie:
   `--verify` liczy wiersze **w tabelach, z których czyta ekran**, a D7 patrzy okiem.
4. **Galeria pokaże polskie słowo z interfejsu, nie z danych.** To osobny dług
   (klucz i18n istnieje, ale trzyma polskie słowo). D7 ma to zgłosić jako defekt
   interfejsu, nie „poprawić dane".

---

## 6. Czego ten plan NIE robi — powiedziane wprost

- **Nie kasuje tabel.** 1262 puste tabele zostają. Usunięcie tabeli to migracja
  destrukcyjna; demo jest święte, migracje addytywne.
- **Nie tłumaczy zastanych danych.** Pomiar języka daje tylko dolną granicę
  (heurystyka po znakach diakrytycznych; „Wdrozenie RPA" przechodzi jako
  angielskie). Tłumaczenie 173 inicjatyw i 453 zadań bez przeczytania każdego
  tekstu byłoby zgadywaniem. Zamiast tego: nowe dane po angielsku, stare śmieci
  usunięte, DBR77 zostaje po polsku jako organizacja prawdziwych ludzi.
- **Nie buduje bramek cyklu życia** (`initiative_lifecycle_gate_decisions`).
  17 kolumn NOT NULL z FK do łańcucha A05 (`v8_agent_proposal_versions`,
  `v8_agent_proposal_scope_reviews`) — to osobna praca, nie warunek działania listy.
- **Nie dotyka produkcji** (centerbeam). Ani razu, na żadnym etapie.
- **Nie włącza żadnej flagi na stagingu ani demo.** `VITE_MODULE_MEETINGS` jest
  domyślnie OFF i tak zostaje do decyzji właściciela.
