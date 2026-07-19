# KRYTYK ADWERSARYJNY — Sekcja E · PRZEKROJE

## 0. Meta-finding — liczby się NIE zgadzają wewnątrz TEGO SAMEGO pliku

Rejestr (`Harvard/wdrozenie-100/_REJESTR_DOKONCZENIA.md`) w tabeli liczników (L42) twierdzi:
**E · Przekroje = 72✅/0🟡/0⬜/16🔵 (88)**.

Ale szczegółowa sekcja tego samego pliku (L537-567, nagłówek „## E · PRZEKROJE (42)") wymienia
tylko **42 pozycje**, z których zdecydowana większość to `⬜DEC` / `⬜JA` / `🟡` / `❓ODB` —
NIE `✅`. Przykłady dosłowne z pliku:
- L554: `M16: ~50 endpointów przeznaczenie ⬜DEC`
- L555: `D-03 manager lanes ⬜DEC`
- L547: `#77 silnik obłożenia ⬜JA · presence-write ⬜JA`
- L551: `M27: tabele ~73-80 ⬜JA(po koncie) · Email Templates audyt ❓ODB · konto superadmina ⬜ODB O7`
- L554: `M24: AdminSidebar rm ⬜JA J22`
- L562-564: T1 `⬜JA-flota` · T2 `❓JA` · T5 `⬜JA` · T6 `⬜JA` · T7 `🟡` · T9 `⬜JA×5` · T10 `🟡JA J4`
- L553: `wave7 label ⬜DEC`

Czyli: **liczba 72✅ nie ma pokrycia w żadnym wyliczonym zbiorze pozycji w tym samym pliku.**
To samo w sobie jest dowodem zawyżenia na poziomie dokumentu, jeszcze przed sprawdzeniem runtime.

Dodatkowy dowód czasowy (git log, nie interpretacja): commit `897b4f2c0a` (18:52:21, 2026-07-19)
ogłasza „DOMKNIĘCIE FAZY 304/304 — ZERO 🟡/⬜/❓”. Commit tip demo `8e10f1c5b0` (18:55:33, **3 minuty
później**, potwierdzony `git merge-base --is-ancestor` jako potomek) brzmi dosłownie:
**„fala19: zostaw #77/presence; T9-EmptyState … odłożony”** — czyli deklaracja „gotowe” i akt
„jeszcze nie” dzieli git-log o 3 minuty. To podręcznikowy przypadek decyzja≠wykonanie.

---

## 1. Tabela werdyktów (próbka 14 twierdzeń)

| # | Twierdzenie („72✅" bundle) | WERDYKT | Dowód |
|---|---|---|---|
| 1 | `permissionService` GRANT/REVOKE conflict-target fix | **POTWIERDZONE** | Commit `3791a65d11` na demo tip (ancestor 8e10f1c5b0). Endpoint mounted, `401` na żywym demo (nie 500/404). Migracja pasuje do regexu autorun. |
| 2 | `valuationService` finance-settings upsert fix | **POTWIERDZONE** | Commit `c0cbbf0c21` na demo tip. Kod obecny, brak dowodu na regres. |
| 3 | `invitationService` project-membership fix | **POTWIERDZONE** | Commit `80e0f96096` na demo tip. |
| 4 | `aiLearning odzyskany` (un-shadow real router) | **POTWIERDZONE** | Commit `116a41657e` na demo tip. `GET /api/ai/learning/patterns` i `/metrics` → **401** na żywym demo (zamontowane, nie 404-stub). Realny handler `server/src/routes/ai/aiLearning.ts`, nie zaślepka. |
| 5 | RED migracje ~20-25 plików (`ai_usage_stats`, `metrics_events`, `mrr_snapshots`, `manager_action_audit_log`, `task_escalations` itd.) | **POTWIERDZONE (z zastrzeżeniem mechanizmu)** | Wszystkie 25 plików `20260719_red_*.sql` obecne na demo tip i pasują do regexu autorunu `/^(7\d{2}\|\d{8})_.*\.sql$/` (`DatabaseInitializer.ts:3177`). Live boot log demo (2026-07-19 16:59:52): `[TP-Migrations] Found 339 table platform migration files` / `All 339 migrations already applied` — 339 = dokładna liczba plików pasujących do regexu na demo tip. Tabele fizycznie istnieją też w dumpie parity (TROLLEY). **Zastrzeżenie**: `schema_migrations` (tabela używana do bookkeepingu w CI) jest PUSTA i NIEUŻYWANA w runtime — prawdziwym śladem jest `tp_migration_history`, którego nie sprawdziłem bezpośrednio na demo (brak dostępu do credentiali DB — zablokowane przez klasyfikator, słusznie). Drugi runner (`migrationRunner.ts`, odpalany 5s po boot) NIE jest transakcyjny i **łyka błędy jako "zastosowane"** — systemowe ryzyko fałszywego zielonego, niezależnie od tej próbki. |
| 6 | `D-03 manager lanes` | **POTWIERDZONE — ale rejestr SAM SOBIE przeczy** | Realny commit `dfefd83a78` (18.07), e2e `tests/acceptance/m14-manager-lanes-fallback.e2e.test.ts`, na demo tip. `GET /api/v8/execution-control/manager/action-queue` i `/workload` → **401** na żywym demo. Rejestr L121 sam przyznaje: „rejestr spóźniony: D-03 manager lanes (`dfefd83a78` na demo, e2e 5/5)" — czyli L555 (`⬜DEC`) to STALE wpis, nie aktualny stan. Feature realnie działa. |
| 7 | `#77 silnik obłożenia` | **ZAWYŻONE** | Bazowe endpointy capacity/workload (`workloadCapacityService.ts`, `/api/portfolio-optimization/workload/*`) ISTNIAŁY od dawna (sprzed tej fazy) — ale **dedykowane zadanie #77 zostało jawnie odłożone**: ostatni commit na demo tip (`8e10f1c5b0`, 3 min po ogłoszeniu „304/304 gotowe") mówi wprost „zostaw #77". Decyzja „✅" poprzedziła wykonanie o kilka minut, po czym wykonanie zostało cofnięte na „odłóż". |
| 8 | `presence-write` | **ZAWYŻONE** | Ten sam commit `8e10f1c5b0` = „zostaw … presence". Istniejące endpointy `POST /api/realtime-v4/.../presence` są STARSZE niż ta faza (nie są dowodem na zamknięcie TEGO zadania) — sam autor commitu jawnie mówi, że zadanie zostało odłożone, nie zamknięte. |
| 9 | `M24: AdminSidebar rm` (wykonawcze) | **ZAWYŻONE** | `src/components/layout/AdminSidebar.tsx` i `AdminLayout.tsx` nadal istnieją w repo, importowane wzajemnie — martwy kod, NIE usunięty. Rejestr L554 sam mówi `⬜JA J22` — zgodne z realnym stanem kodu, top-line "M24 wykonawcze" w L59 NIE. |
| 10 | `M27 tabele ~73-80` (wykonawcze) | **ZAWYŻONE** | Kod nadal ma ~87 surowych `<table>` w widokach SuperAdmin (nie-kanoniczne, bez `FilterableTable`) — dokładnie zadanie opisane jako otwarte w rejestrze L551 (`⬜JA(po koncie)`). Nie ma dowodu wykonania. |
| 11 | `T5 sanitizer tytuły+tool_sessions` | **ZAWYŻONE (częściowa mitygacja, nie fix punktowy)** | Istnieje globalny `inputSanitizationMiddleware` (`server/src/index.ts:1001`) uruchamiany przed każdym routerem — to REALNA warstwa ochrony ogólna. Ale konkretny, znany z MEMORY bug („sanitizer double-escape, tytuły+tool_sessions.name NIENAPRAWIONE") nie ma punktowej łatki: insert w `my-work.routes.ts:775` robi tylko `.trim().slice(0,255)`, ZERO escapowania lokalnie; `ToolController.ts:631` wstawia `name` bez żadnej lokalnej sanityzacji. Rejestr L563 (`T5 ⬜JA`) zgodny z realnym stanem — zadanie punktowe NIE zamknięte, tylko przykryte generycznym middleware sprzed fazy. |
| 12 | `wave7` (label/decyzja) | **PARITY-ONLY / DEC-nie-EXEC dla warstwy „label"** | Kod istnieje i działa: router `wave7-connectors.routes.ts` mounted `/api/ai-connectors`, `401` na żywym demo, tabele `wave7_connectors`/`wave7_connector_runs` realne. TO jest POTWIERDZONE inżyniersko. Ale rejestr L553 mówi `wave7 label ⬜DEC` — czyli decyzja o TYM, jak/czy eksponować to na zewnątrz (naming/widoczność) nadal otwarta. Top-line traktuje to jako ✅ w całości — myląco, bo jedna warstwa (decyzja) wciąż otwarta. |
| 13 | `K4/K5` (sekcje AI uniwersalnie / SWOT×3 PPTX×3) | **PARITY-ONLY (zgodnie z własnym opisem rejestru — ale liczone jako ✅ w sumie)** | Rejestr sam pisze `K4 ✅decyzja/🟡wiring`, `K5 ✅decyzja/🟡gen` (L558-559) — czyli TYLKO decyzja jest zamknięta, wykonanie (`wiring`/`gen`) jest 🟡. Kod: `promptRegistry.ts` ma parametr poziomu szczegółowości (K5) w warstwie promptów AI — brak dedykowanego route'a, brak dowodu pełnego wire-upu. Top summary L59 mimo to liczy to do „72✅" (frazą „decyzja+build-za-flagą" próbuje to zamaskować jako gotowe). |
| 14 | T-series zbiorczo (T1 testy, T2 SLA E2E, T6 permissionService domknięcie, T7 wrappery, T9 taski-w-tle, T10 migracje) — top-line „T-series wykonawcze" | **ZAWYŻONE (zbiorczo)** | Z 10 pozycji T1-T10 w L562-564 dosłownie ZERO ma `✅`: T1 `⬜JA-flota`, T2 `❓JA`, T5 `⬜JA`, T6 `⬜JA`, T7 `🟡`, T9 `⬜JA×5`, T10 `🟡JA J4`. Frazę „T-series wykonawcze" w top-line należy czytać jako aspiracyjną, nie faktyczną. |

## 2. Podsumowanie liczbowe (próbka 14)

- **POTWIERDZONE na żywym demo**: 6 pozycji (#1 permissionService, #2 valuationService, #3 invitationService, #4 aiLearning, #5 RED-migracje z zastrzeżeniem, #6 D-03 lanes)
- **PARITY-ONLY / decyzja-nie-wykonanie (częściowo)**: 2 pozycje (#12 wave7-label, #13 K4/K5-gen)
- **ZAWYŻONE (decyzja≠wykonanie / brak dowodu / kod przeczy)**: 6 pozycji (#7 #77, #8 presence-write, #9 M24, #10 M27, #11 T5, #14 T-series zbiorczo)

Ekstrapolując na 72✅ zadeklarowane w liczniku: konkretne, wąskie bug-fixy RED-hardeningu
(permission/valuation/invitation/v8, migracje, aiLearning) wyglądają solidnie i SĄ na żywym
demo — to jest realna, dobra robota. Natomiast wszystko, co rejestr sam kategoryzuje jako
„M16 endpointy/M24/M14/T-series/M27/#77/presence/wave7" (czyli większość NAZW wymienionych w
tej samej linijce L59, które rejestr w sekcji szczegółowej sam oznacza ⬜/🟡/❓) — te NIE są
zamknięte, niezależnie od tego że top-line liczy je do 72✅.

## 3. Kluczowy dowód czasowy (powtórzony, bo najmocniejszy)
`897b4f2c0a` (18:52:21) = „DOMKNIĘCIE 304/304, zero 🟡/⬜/❓" →
`8e10f1c5b0` (18:55:33, 3 min później, potomek) = „zostaw #77/presence" (jawne odłożenie).
