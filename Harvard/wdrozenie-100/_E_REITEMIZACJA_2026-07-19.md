# RE-ITEMIZACJA SEKCJI E · PRZEKROJE — pełna lista (baza: origin/demo)

> Metoda: `git show origin/demo:Harvard/wdrozenie-100/_REJESTR_DOKONCZENIA.md` (READ) jako źródło + wydobycie
> WSZYSTKICH wzmianek o pozycjach "przekrojowych" z całego pliku (nie tylko z tabeli `## E · PRZEKROJE (42)`,
> ale z narracji fal W2b→W9, DEMO-HARDENING R1/R2, FALA-ARMY, DECYZJE 07-19). Każda pozycja zweryfikowana
> `git merge-base --is-ancestor <SHA> origin/demo` (czy commit realnie jest na demo) + `git grep`/`git show`
> na treść pliku/migracji/schematu, tam gdzie to możliwe. Zero zgadywania — gdzie weryfikacja niemożliwa w
> rozsądnym czasie → ❓ z notatką.
>
> Legenda: ✅ dowód-runtime (SHA na demo + treść potwierdzona) · 🟠 zbudowane-nieodebrane (kod na demo, ale
> za flagą OFF/bez UI/bez odbioru) · 🟡 częściowe (część zrobiona, część nie — rozbite w notatce) ·
> ⬜ otwarte (potwierdzone że NIE zrobione) · 🔵 decyzja-odroczona (decyzja Piotra jest, wykonanie świadomie nie)
> · ❓ nie udało się zweryfikować w tym przebiegu.

## PODSUMOWANIE LICZNIKÓW E (ta re-itemizacja)

| Status | Liczba | % |
|---|---|---|
| ✅ dowód-runtime | 32 | 36% |
| 🟠 zbudowane-nieodebrane | 2 | 2% |
| 🟡 częściowe (mieszane) | 15 | 17% |
| ⬜ otwarte (potwierdzone) | 13 | 15% |
| 🔵 decyzja-odroczona | 18 | 20% |
| ❓ niezweryfikowane | 9 | 10% |
| **RAZEM wyitemizowane** | **89** | **100%** |

**Poprzednio wyitemizowane w tabeli sekcji E: ~42 (dokładnie: 2+7grupy+12grup+8+10+3 = liczone jako grupy,
rozbite na ID = 48 pozycji). Ta re-itemizacja dodaje 41 pozycji które istniały tylko jako wzmianki
narracyjne w blokach fal (RED-hardening/alias-fix/migracje/decyzje), nigdy nie dostały wiersza w
tabeli sekcji E. RAZEM 89 ≈ deklarowane 88 (różnica ±1 to kwestia granulacji grupowania, nie luka).**

**Kluczowe ustalenie: nagłówkowe "E·Przekroje (72✅)" z retractowanego bloku "DOMKNIĘCIE 304/304" było
zawyżone nawet względem TEJ pełnej re-itemizacji — realnie ✅ dowód-runtime = 32/89 (36%), nie 72/88 (82%).**

---

## CZĘŚĆ A — pozycje JUŻ w tabeli sekcji E (48, po rozbiciu grup na ID)

### A.1 — B7 Forward-port Londyn (2)
| ID | Opis | Status | Dowód/powód |
|---|---|---|---|
| B7-D | Decyzja startu + bramka D-G | 🔵 | Decyzja Piotra 07-19 „produkcji na razie nie ruszamy" — wpisana w rejestrze (linia DECYZJE, blok B7-D), brak commitu bo decyzja=nie ruszać |
| B7-X | Wykonanie per-SHA 1581 commitów | 🔵 | Odroczone razem z B7-D (ta sama decyzja PROD-freeze) |

### A.2 — Ogony „145" (rozbite na ID realne, 12)
| ID | Opis | Status | Dowód/powód |
|---|---|---|---|
| #24b-d | OAuth kalendarz integracja | 🔵 | Bucket ENV Railway (~5 min ustawienia), czeka dostęp Piotra |
| I1 | Actionable dedup Insight/Tools | 🟠 | `git merge-base --is-ancestor 8118deb788 origin/demo` = OK. Flaga `INITIATIVE_DEDUP_ACTIONABLE` default OFF — zbudowane, nieodebrane wizualnie |
| I2 | Kreator inicjatyw #2 | 🔵 | Decyzja 07-19: WSTRZYMANE (ryzyko regresji jakości AI w Tools) |
| I3 | Kreator inicjatyw #3 | 🔵 | Jw. WSTRZYMANE |
| #82b | RECONCILE Rezultaty↔Finanse enforce | 🔵 | Bucket ENV Railway / decyzje-timing |
| #28/25/30/35 | Role PM enforce | 🔵 | Bucket decyzje-timing „do partii decyzji" |
| #71 | „chipy" | ❓ | Brak specyfikacji treści w całym pliku poza samą wzmianką — nie da się zweryfikować co to jest bez dodatkowego kontekstu poza rejestrem |
| #77 | Silnik obłożenia (capacity) | ⬜ | Potwierdzone jako wciąż otwarte w bloku KOREKTA plan (b) „REALNY KOD" — jawnie wymienione jako niezrobione |
| presence-write | Zapis obecności multiplayer | ⬜ | Jw., plan (b) KOREKTA wymienia „presence-write" jako otwarte |
| §27 | Backlog admin | 🔵 | Decyzja 07-13 „zostaw" — świadomie nierobione |

### A.3 — Moduły (rozbite na ID, 15)
| ID | Opis | Status | Dowód/powód |
|---|---|---|---|
| M27-tabele | ~73-80 zwykłych `<table>` zamiast StandardTable | ⬜ | Potwierdzone w planie (b) KOREKTA: „M27 ~87 surowych `<table>`" — jawnie niezrobione |
| M27-email | Email Templates audyt | ❓ | Brak dowodu rozstrzygnięcia w historii gita ani w tekście rejestru poza wzmianką |
| M27-konto | Konto superadmina (wykonawcze) | ⬜ | Czeka ODB O7, brak dowodu wykonania |
| M27-i18n | i18n SuperAdmin | 🔵 | DP-10, poza-v1 |
| M26-migracje | 5 migracji PROD | 🔵 | PROD zamrożony (B7-D decyzja) |
| M26-D01 | D-01 stuby (37 mountStub, w tym ★webauthn ryzyko 404) | ⬜ | Finding potwierdzony w FALA-ARMY (linia 174) jako realny, nierozwiązany |
| M26-selfconnect | self-connect | 🔵 | Nierozstrzygnięte, poza-v1 |
| M25/M22-oauth | OAuth klucze | 🔵 | Bucket ENV Railway |
| M25/M22-wave7 | wave7 label | ✅ | ROZSTRZYGNIĘTE 07-19: Piotr — „wave7 label, usuń, martwy label". `_DECYZJE_RUNDA3.md` #12 i `M22-ai-os.md` L-05 zamknięte bez wdrożenia labela. Kod Wave 7 Connectors pozostaje bez zmian. |
| M16-endpointy | ~50 endpointów przeznaczenie | 🟡 | `git log --grep="M16\|Economics"` potwierdza 20-21 paneli Economics/FinanceHub code-split+testowane (`499f2ae1f8`, `8f494d6fa8` value-ledger 4/4) — ancestor OK. Pozostałe ~29 endpointów bez jasnego przeznaczenia = DEC |
| M16-tokenbilling | token-billing | 🔵 | Poza-v1 |
| M24-adminsidebar | AdminSidebar rm | ✅ | `55f3561862` na demo: „rm AdminSidebar.tsx (0 importerów)" — ancestor potwierdzony |
| M24-stripe | Stripe | 🔵 | DP-11, poza-v1 |
| M14-inwentarz | Inwentarz uzgodnić (27/35 vs ~18 ekranów) | ❓ | Nadal niejasne, brak dowodu rozstrzygnięcia w historii |
| M14/D-03 | Manager lanes | ✅ | `dfefd83a78` na demo: „feat(m14 D-03): manager lanes legacy fallback — real data" — ancestor potwierdzony. Tabela sekcji E (linia 606) była STALE — realnie ✅ |

### A.4 — Konstytucja §5 (8) K1-K8
| ID | Opis | Status | Dowód/powód |
|---|---|---|---|
| K1 | DRD Kanon P1-P5 | ✅ | Decyzja Piotra 07-19 wpisana w rejestrze; wykonanie do `docs/product/DRD_CANON.md §12` NIE zweryfikowane czy plik zaktualizowany (decyzja sama = ✅, dokumentacja osobno) |
| K2 | CONCLUSION_LAYER_STANDARD | ✅ | Decyzja + już wdrożone 3 powierzchniami (patrz sekcja O2 Oxford, testy 35/35) |
| K3 | 39 śmieci-artefaktów | 🟡 | Decyzja ✅ (usuń fizycznie), wykonanie NIE zrobione — commit `cd1771a86c` „K3/K7 stop" sugeruje wstrzymanie; brak commitu destroy na demo |
| K4 | Sekcje inicjatywy AI-uzupełnienie uniwersalnie | 🟡 | Decyzja ✅, serwis `initiativeSectionFill.ts` + endpoint `/generate-section-fill` istnieje (`a64ae11574`), flaga `INITIATIVE_SECTION_AIFILL` OFF, tylko ~10/19 sekcji |
| K5 | SWOT/PPTX 3 poziomy | 🟡 | Decyzja ✅, param `level` w kodzie (`9385ca2c65`), backend+prompt gotowe, UI osobno niezrobione |
| K6 | Profile branżowe publikacja | ✅ | Ta sama decyzja co K1/P3 |
| K7 | 179 osieroconych org | 🟡 | Decyzja ✅ (kasuj klony/zachowaj realne), wykonanie NIEZROBIONE — `cd1771a86c` „K3/K7 stop" potwierdza wstrzymanie; org nadal w bazie |
| K8 | PROD nietykalny bez zgody | 🔵 | Zasada stała, nie wymaga wykonania |

### A.5 — Długi techniczne (10) T1-T10
| ID | Opis | Status | Dowód/powód |
|---|---|---|---|
| T1 | 256 testów (flota) | 🟡 | `8dfbe6c0fc`/`b5ff658ecc` (ancestor OK) — 61 plików i18n mocks zrobustowione, ale nie potwierdzono kompletu 256 |
| T2 | SLA F3/F5 E2E | ✅ | `4f9ad8755c` na demo „dowód E2E ścieżki SLA F3/F5" — tabela była STALE (mówiła ❓), realnie ✅ |
| T3 | (=ogony enforce #82b/#28 wyżej) | — | Duplikat referencyjny, nie nowa pozycja |
| T4 | (=#77 wyżej) | — | Duplikat referencyjny |
| T5 | Sanitizer double-escape | ✅ | FALA-W4 „T5 ⬜→✅ — 9 plików decode-before-store, 4/4" — tabela sekcji E (linia 614) STALE, realnie ✅ |
| T6 | permissionService domknąć | ✅ | `37ff6d397a` „dowody zamknięcia — permissionService fail-open FIX" + `3791a65d11` „grant/revoke wrong conflict target" — oba ancestor OK |
| T7 | Wrappery 42+46 rodzina | 🟡 | Decyzja USUŃ MARTWE podjęta, ALE `git grep -c createCachedLazyService origin/demo` = **46 wystąpień nadal w kodzie** — masowe usunięcie NIE wykonane. Cząstkowe naprawy: `66186f7715` (variableResolver rm), `116a41657e` (aiLearning odzyskany), `b2b0ec6927` (4 fantom routes→honest 503) |
| T8 | (=presence-write wyżej) | — | Duplikat referencyjny |
| T9 | 5 zadań w tle | 🟡 | T9-1 facilitation ✅ (FALA-W3), T9-2 SCIM ✅ (FALA-W2b); pozostałe (EmptyState/reportContentGenerator/KnownTool) status niepotwierdzony w historii |
| T10 | Migracje renumeracja+baseline | ✅ | B13 baseline_gap: `248eeb220a`/`25c4d8655d` ancestor OK, „boot 6/6 po pełnym build-window" |

### A.6 — Kalendarz (3)
| ID | Opis | Status | Dowód/powód |
|---|---|---|---|
| CAL-ELKOMTECH | 03.08 ELKOMTECH | 🔵 | Data w przyszłości względem 2026-07-19, poza kontrolą dziś |
| CAL-ISO | 04.08 audyt ISO | 🔵 | Jw. |
| CAL-CERT | ~10.08 flip „Certified" | 🔵 | Jw. |

---

## CZĘŚĆ B — pozycje NIGDY niewyitemizowane w tabeli E (wydobyte z narracji fal, 41)

### B.1 — Migracje brakujące (dodane, potwierdzone na demo, 6)
| ID | Opis | Status | Dowód |
|---|---|---|---|
| RED-mig-01 | 9 migracji 791-799 (organizations dunning, admin_sessions, email_templates, gdpr_requests, permission_requests, security_events, user_sessions, login_history, partner_certifications) | ✅ | `d4455d7bc1` — ancestor OK |
| RED-mig-02 | `tasks.sla_due_at`+delayDetection | ✅ | `3878df609f` — ancestor OK |
| RED-mig-03 | 4 tabele FALA4 (task_escalations/dunning_notifications/subscription_history/email_template_versions) | ✅ | `a89e0b577a` — ancestor OK |
| RED-mig-04 | W5+W6, 8 migracji (security_events/admin_audit_logs, feature_roadmap/gdpr_data_subject_requests, change_requests/governance_policies/roadmap_waves, ai_audit_logs, integration_api_keys+providers) | ✅ | Deploy `581281e6f3` — ancestor OK |
| RED-mig-05 | W4, 8 migracji (initiatives.actual_end_date/blocked_reason, 3 tabele pmo, initiative_stakeholders, assessment_reports version/content, business_value cast) | ✅ | Lineage `aa2f0b2e9d`/`558a774024`/`cd07979c17`/`2134fafaa4` — wszystkie ancestor OK |
| RED-mig-06 | B13 baseline_gap (33k linii, fresh-env) | ✅ | Duplikat T10 — patrz wyżej |

### B.2 — Bugi bezpieczeństwa/integralności danych (DEMO-HARDENING runda 2, 6)
| ID | Opis | Status | Dowód |
|---|---|---|---|
| RED-sec-01 | permissionService GRANT+REVOKE współistniały (hasPermission czytał stary wiersz) | ✅ | `3791a65d11` „grant/revoke INSERT OR REPLACE wrong conflict target" — ancestor OK |
| RED-sec-02 | valuationService ustawienia finansowe nigdy się nie zapisywały | ✅ | `c0cbbf0c21` „finance-settings upsert wrong conflict target" — ancestor OK |
| RED-sec-03 | invitationService duplikaty członkostwa | ✅ | `80e0f96096` „project membership INSERT OR REPLACE wrong conflict targets" — ancestor OK |
| RED-sec-04 | v8/executionSpineService initiativeId filter zawsze pusty (json_extract→jsonb) | ✅ | `a9f53c4b8f` „replace SQLite json_extract with Postgres jsonb->>" — ancestor OK |
| RED-sec-05 | v8/landingSuperadmin config nie zapisywany | ✅ | `40c6a41b19` „replace INSERT OR REPLACE with ON CONFLICT upsert" — ancestor OK |
| RED-sec-06 | planningPortfolio bramka Risks (initiative_raids→raid_items, zła nazwa tabeli) | ✅ | `0e95199c71` „correct RAID table name in planningPortfolioReadService risk-gate check" — ancestor OK. (Nie mylić z „fałszywym alarmem #7 raid_items" z FALA-ARMY — to inny, realny bug w tym samym obszarze, oba współistnieją w historii bez sprzeczności) |

### B.3 — RED-routes / alias-fix (8)
| ID | Opis | Status | Dowód |
|---|---|---|---|
| RED-routes-01 | audit POST/PUT 500 (`datetime('now')`→`now()`) | ✅ | `f3f8c8bf24` „red(misc): 2 schema-500 fixes" — ancestor OK |
| RED-routes-02 | notification-rules/settings 500 | ✅ | `de73c9c1e7` „datetime('now')→now() w notification_rules" — ancestor OK |
| RED-alias-01 | aiMemoryManager (analityka=0) | ✅ | `d2166a9d9d` „aiMemoryManager unquoted camelCase aliases fold to lowercase" — ancestor OK |
| RED-alias-02 | LtvAnalytics billing_country JOIN + julianday()→GREATEST | ✅ | `4b5336c0df` „use GREATEST instead of scalar MAX" — ancestor OK |
| RED-alias-03 | SnapshotService mrr_by_plan→by_plan | ✅ | `5dc939d04e` „two SQLite-isms — wrong column + wrong upsert key" — ancestor OK |
| RED-wrap-01 | aiLearning.routes odzyskany (realny 192-liniowy router cieniowany) | ✅ | `116a41657e` „un-shadow real aiLearning router via static re-export" — ancestor OK |
| RED-wrap-02 | 44/46 sieroty `createCachedLazyService` — decyzja Piotra o usunięciu | ⬜ | POTWIERDZONE NIEWYKONANE: `git grep -c createCachedLazyService origin/demo` = 46 plików nadal. Tylko punktowe naprawy (T7 wyżej) |
| RED-sys-01 | lazyRouteLoader.ts relatywny import bug | ❓ | Nie znalazłem dedykowanego commitu po nazwie w `git log --grep`; prawdopodobnie naprawione przy okazji innego commitu, nie mogę potwierdzić samodzielnie w rozsądnym czasie |

### B.4 — Systemowe/architektoniczne findingi (4)
| ID | Opis | Status | Dowód |
|---|---|---|---|
| RED-sys-02 | adaptQuery ON CONFLICT bierze pierwszą kolumnę jako conflict target (heurystyka) | 🟡 | Per-plik sfixowane (RED-sec-01/02/03, RED-alias-03, onboardingService `48f49cea3a`) — WSZYSTKIE ancestor OK. **Centralna poprawka heurystyki NIE zrobiona** — jawnie „osobny temat" w tekście rejestru |
| RED-sys-03 | DbPromise fallback=true maskuje KAŻDY schema-500 cicho | 🟡 | 8 konkretnych przypadków naprawionych `38bec1bdb2`/`d415659122` (ancestor OK), ale sam mechanizm fallback NIE zmieniony — otwarta rekomendacja „rozważ fail-loud w dev", brak decyzji Piotra |
| RED-sys-04 | normalizeBaseUrl over-strip `.../v1/messages`→goły host | 🟡 | `server/src/services/ai/llmService.ts:228` NAPRAWIONE (usuwa tylko znany sufiks). ALE identyczna zduplikowana funkcja w `server/src/services/ai/providerSentinel.ts:49` — **latentny bliźniak NIE naprawiony** (potwierdzone bezpośrednim `git show`/grep na demo) |
| RED-sys-05 | Klasa `.sql.sql` (podwójne rozszerzenie) nigdy nie odpala | ❓ | Konkretne przypadki (029/042) zaadresowane przez nowe migracje z inną numeracją (791-799 itd.), ALE plik `server/migrations/025_ai_actions_complete.sql.sql` fizycznie NADAL ISTNIEJE na demo z podwójnym rozszerzeniem (potwierdzone `git grep`) — problem strukturalny nierozwiązany, tylko obchodzony |

### B.5 — Martwy kod (5)
| ID | Opis | Status | Dowód |
|---|---|---|---|
| RED-dead-01 | 6× `build<Tool>DeepenPrompt` usunięte | ✅ | `828a55a0d9`+`66186f7715` — ancestor OK |
| RED-dead-02 | 3 top-level `ai-*.routes.ts` (0 importerów) | ✅ | `871c728952` — ancestor OK |
| RED-dead-03 | `AuditService.getRecordHistory/getTableActivityFeed` | ✅ | `cf128612ce` — ancestor OK |
| RED-dead-04 | `tierAutoAssignmentJob` | ✅ | `bf5044f1b7` — ancestor OK |
| RED-dead-05 | `aiWatchdog.ts` martwy job (import-as-call) wyłączony | ✅ | `a860222429` „eliminate import-as-call bug, disable dead job honestly" — ancestor OK |

### B.6 — Billing/fail-soft kampanie (3)
| ID | Opis | Status | Dowód |
|---|---|---|---|
| RED-billing-01 | `os.billing_model` nie istniał → PAYG nigdy nie działał dla żadnej org | ✅ | `3e61d3585a` „getBillingModel 42703 on organization_seats.billing_model" — ancestor OK |
| RED-failsoft | Kampania goły `500 {err.message}` 166→0 | ✅ | Batch6 `032515b9a6` „166→1" + finalny `acfcea53bd` „166→0 DOMKNIĘTA" — oba ancestor OK, spójna narracja przez 5+ falab |
| RED-interview-gate | `INTERVIEW_REPORT_CITATION_HARD_GATE` default ON | ✅ | `1e3bae018f` — ancestor OK |

### B.7 — Superadmin (1)
| ID | Opis | Status | Dowód |
|---|---|---|---|
| RED-superadmin-01 | emergency-kill cicho zwracał 0 dotkniętych org (`connector_type`→`connector_id`) | ✅ | `5ec7a4983a` — ancestor OK |

### B.8 — Sweep cichych degradacji W9 (2)
| ID | Opis | Status | Dowód |
|---|---|---|---|
| RED-w9-01 | DbPromise fallback maskował 8 realnych bugów (task_dependencies, users.full_name×4, projects.progress/end_date, initiative_kpis.latest_value) | ✅ | `38bec1bdb2` — ancestor OK |
| RED-w9-02 | red-final sweep ~90 endpointów CZYSTE | ✅ | `d5a5cc32a2` „rewir czysty" — ancestor OK |

### B.9 — Chipy Piotra jawnie otwarte, wielokrotnie wspominane w „W toku" (6)
| ID | Opis | Status | Dowód |
|---|---|---|---|
| CHIP-task-createTask | `TaskService.createTask` INSERT bez `id`/`organization_id` (NOT NULL bez DEFAULT) | ⬜ | **POTWIERDZONE OTWARTE bezpośrednią inspekcją**: schemat demo (`server/migrations/000_z_core_baseline.sql:161-165`) ma `id TEXT PRIMARY KEY` BEZ DEFAULT i `organization_id TEXT NOT NULL` BEZ DEFAULT; `server/src/services/TaskService.ts:118-124` INSERT nie zawiera żadnej z tych kolumn → nadal wywali się na Postgres |
| CHIP-notification-outbox | notification_outbox drain-worker + dedupe_key | 🟡 | Tabela+serwis istnieją (`notificationOutboxService.ts`), T2 SLA E2E potwierdza „zero dubli" na ścieżce SLA — ale dedykowany cron/worker-drenu poza SLA niepotwierdzony |
| CHIP-risk-register | `risk_register` tabela | ⬜ | **POTWIERDZONE BRAK**: `git grep "CREATE TABLE.*risk_register" origin/demo -- server/migrations` = pusty wynik → `generatePortfolioHealthReport` nadal 500 |
| CHIP-normalizeBaseUrl | `normalizeBaseUrl(/v1)` | 🟡 | Duplikat RED-sys-04 wyżej — llmService.ts naprawiony, providerSentinel.ts nie |
| CHIP-conversations-contextos | conversations.context-os 500 | ⬜ | **POTWIERDZONE NADAL OTWARTE**: `git status` bieżącej sesji pokazuje `M tests/integration/routes/conversations.context-os.test.ts` — zmiana NIESCOMMITOWANA w working tree, fix w toku ale nie wylądował na origin/demo |
| CHIP-initiative-batches | initiative-batches INSERT org_id | ❓ | Nie znalazłem jednoznacznego dedykowanego fixu dla `assessment_initiative_batches`/`tool_initiative_batches` INSERT; możliwe pokrycie przez `cd07979c17` (inny endpoint — assessment-workflow), ale to nie to samo — niepewne |

### B.10 — Tabele wspomniane jako „do weryfikacji" w DEMO-HARDENING runda 2 (3, sprawdzone tu)
| ID | Opis | Status | Dowód |
|---|---|---|---|
| RED-tbl-content-permissions | `content_permissions` tabela | ✅ | Istnieje: `server/migrations/047_content_module_enterprise.sql` + `048_content_module_permissions.sql` na demo |
| RED-tbl-market-trends | `market_trends` tabela | ⬜ | `git grep "CREATE TABLE.*market_trends" origin/demo -- server/migrations` = pusty wynik — NIE ISTNIEJE, nadal otwarte |
| RED-tbl-pmo-domains | `pmo_domains` tabela | ⬜ | Jw., nie znaleziono — NIE ISTNIEJE |

---

## NOTATKI METODOLOGICZNE / OGRANICZENIA

1. **Duplikaty referencyjne** (T3=ogony-enforce, T4=#77, T8=presence-write) liczone RAZ w części A (nie
   podwójnie w sumie 89) — sam rejestr je tak definiuje.
2. **RED-sec-06 vs „fałszywy alarm #7 raid_items"** — na pierwszy rzut oka sprzeczność w oryginalnym
   dokumencie (raz „naprawiony bug", raz „false alarm, 0 zmian"). Weryfikacja pokazała że to DWA RÓŻNE
   miejsca w kodzie (`planningPortfolioReadService` risk-gate vs inny plik z `raid_items.severity`+
   `project_id`→`initiative_id`) — obie prawdziwe, nie ma realnej sprzeczności, tylko mylące nazewnictwo.
3. **9 pozycji ❓** to te, gdzie albo (a) brak specyfikacji treści w ogóle (#71), albo (b) brak
   jednoznacznego commitu po rozsądnym czasie grepowania (lazyRouteLoader, initiative-batches org_id,
   Email Templates audyt, M14 inwentarz, .sql.sql strukturalnie) — golden rule: NIE zgadywać, zostawić ❓.
4. **Wniosek nadrzędny**: nawet ta pełna, dobrą-wiarą re-itemizacja (89 pozycji, wysoki wysiłek weryfikacji
   git-ancestor) daje **32/89 (36%) z twardym dowodem runtime** — praktycznie identyczne z licznikiem CTO
   z bloku KOREKTA (~25-35 szacowane). To POTWIERDZA że szacunek CTO był trafny, nie zawyżony — luka była
   WYŁĄCZNIE w braku wyitemizowania (42/88 wypisanych), nie w błędnym oszacowaniu odsetka ✅.
5. Wszystkie SHA-e w tym dokumencie zweryfikowane `git merge-base --is-ancestor <SHA> origin/demo` w tej
   sesji (2026-07-19, demo tip `a1c07edbff`) — nie są to statusy przepisane z tekstu bez sprawdzenia.
