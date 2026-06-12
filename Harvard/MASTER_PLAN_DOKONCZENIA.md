# MASTER PLAN DOKOŃCZENIA — Consultify (wynik Audytu Harvard V1)

**Data:** 2026-06-11 · **Branch:** `feat/deliverables-light` (commit `6e72cbf3cd`) · **Autor:** Claude (MacDuzy)
**Podstawa:** 28 kart audytu (`Harvard/modules/*/KARTA_AUDYTU.md`) · Protokół V1 · `KONTEKST.md` §5 (wątki systemowe) · `INTEGRACJE.md`
**Status dokumentu:** SSOT planu realizacji. Każda pozycja ma odnośnik do karty źródłowej. Aktualizuj przy zamknięciu fal.

> **Czym jest ten plik:** jeden plan pokrywający CAŁOŚĆ prac wynikających z audytu — od blokerów bezpieczeństwa po szlif GA. Łączy trzy rzeczy, których audyt nie scalił: (1) plany dokończenia z 28 kart, (2) wątki systemowe „naprawić RAZ", (3) fazowanie z bramkami do Beta i GA. Kolejność realizacji = sekcja „PLAN SPRINTÓW".

---

## 0. GDZIE JESTEŚMY (jednym ekranem)

- **Zaudytowano:** 27 modułów (M01–M10, M12–M27) + A1 = **28/28 kart**. ⚠️ **M11 Narzędzia descoped** — karta to pusty szablon; brak zidentyfikowanego realnego modułu/kodu. Wszystkie 27 modułów + A1: status **🟦 NIEPEŁNY** (Fazy 3 Railway + 4 żywa przeglądarka odłożone do dostępu do Railway/staging).
- **Średnia ocena (pre-sprint):** ~**49/100** (liczona z 27 modułów M01–M27, z wyłączeniem A1-stub 13/100). Najwyżej: M02 Canvas 57, M06 Mind Map 57, M19 55, M05 55. Najniżej: M14 42, M09 43, M07 44.
- **Średnia ocena (po Sprintach 1–5, 2026-06-11):** ~**52/100**. Najwyżej: M10 59, M02 58, M16/M01/M24/M27 57. Najniżej: M14 48, M07 44.
- **Tier:** cała platforma na poziomie **Alpha**. Zero modułów GA-ready, zero Beta-ready bez poprawek.
- **Co trzyma platformę w Alpha (3 zdania):** (1) ~~systemowy dług bezpieczeństwa — cross-org IDOR + side-router-weak-gate w ~12 modułach~~ → **NAPRAWIONE** przez W1/W2/W3/Bramka D; (2) „fake features" — funkcje, które kłamią użytkownikowi (toast „wysłano" bez zapisu, przyciski zawsze 404) → częściowo naprawione przez W6; (3) brak żywej weryfikacji (Faza 4) i niepewny stan migracji na prodzie (PROD = kod z 2026-05-18) → blokuje przejście do Beta.

**Ścieżka:** FAZA A (security) → FAZA B (fake features) → FAZA C (migracje+żywa weryfikacja) = **próg BETA**. Potem FAZA D (hardening) + FAZA E (szlif) = **próg GA**.

---

## 1. SNAPSHOT OCEN (28/28)

> **Re-audit 2026-06-11 po Sprintach 1–5 (W1–W15 + Bramka D):** Oceny zaktualizowane. Skróty w kolumnie Hard-cap: `✅` = naprawione przez sprint. Średnia 27 modułów: ~**52/100** (↑3 vs pre-sprint ~49). Najwyżej: M10 59, M02 58, M16/M01/M24/M27 57. Najniżej: M14 48, M07/M12 44/47.

| # | Moduł | Ocena | Tier | Hard-cap | Najcięższy bloker |
|---|-------|-------|------|----------|-------------------|
| M01 | Czat | **57** | Alpha | ✅ cross-org IDOR (W1) | brak Fazy 4 + testy |
| M02 | Canvas | **58** | Alpha↑ | — | brak Fazy 4 + testy S6/S7 |
| M03 | My Work — organizer | **50** | Alpha | ✅ cross-org write (W1) | conflict silent overwrite + inbox IDOR |
| M04 | Notatnik | **50** | Alpha | — (P1 cross-user) | v8 handoff bez owner-check |
| M05 | Ideas — Zarządzanie | **56** | Alpha | — | conflict silent overwrite + brak migracji snapshots |
| M06 | Ideas — Mind Map | 57 | Alpha | — | brak migracji snapshots/activity + WS bez org |
| M07 | Ideas — Process Flow | 44 | Alpha | — | connectMode OFF + V8 mirror garbage + 5 hooków 401 |
| M08 | Ideas — Table | **52** ✓ | Alpha | — | fałszywy streaming + generate_table stub |
| M09 | Ideas — Whiteboard | **45** | Alpha | ✅ cross-org write (W1) | per-user board blokuje multiplayer + WS bez org |
| M10 | Wywiad | **59** | Alpha górny | ✅ cross-org IDOR (W1) | brak Fazy 4 + testy |
| M11 | Narzędzia/Assessment | **N/D** | — | — | **Descoped** — pusty szablon karty; brak zidentyfikowanego realnego kodu |
| M12 | Audyty | 47 | Alpha | — | ZERO testów + P1 assignment injection cross-org |
| M13 | Inicjatywy | **52** | Alpha | ✅ cross-org write (W1) | fasada inicjatyw + brak Fazy 4 |
| M14 | Wdrożenie | **48** | Alpha | ✅ cross-org write (W1+W2) | brak Fazy 4 + testy |
| M15 | Rezultaty | **54** | Alpha | ✅ cross-org write + RBAC bypass (W1+W3) | brak Fazy 4 + testy |
| M16 | Finanse | **57** | Alpha górny | ✅ cross-org R/W/DELETE (W1+W2) | brak Fazy 4 |
| M17 | Outputs | **53** | Alpha | ✅ public viewer (W9) + ✅ beta-lock (W7) | overrideQualityGate bez roli (P2) |
| M18 | Dokumenty | **54** | Alpha | — | fasada wersji/komentarzy naprawiona (W5); Mode3 placeholder P2 |
| M19 | Prezentacje | **56** | Alpha↑ | ✅ public viewer (W9) | overrideQualityGate bez roli (P2) |
| M20 | Tabele Studio | **47** | Alpha | ✅ cross-org WRITE (W2) | SSO plaintext + share_password nieweryfikowane |
| M21 | Meeting | 52 | Alpha↑ | — | handoff pół-martwy + transkrypt prompt-injection |
| M22 | AI OS | **54** | Alpha | — | Artifacts 404 UX + brak CI |
| M23 | Organizacja | **52** | Alpha | ✅ competency/export (W2) + ✅ kontekst (W11) | podwójna implementacja admin (P2) |
| M24 | Panel Admina | **57** | Alpha górny | ✅ cross-org IDOR (W2) | brak Fazy 4 |
| M25 | Ustawienia | **53** | Alpha | ✅ cross-user IDOR (W1) + ✅ sekrety AES (Bramka D) | brak Fazy 4 |
| M26 | Portal Partnerski | 52 | Alpha | — | silent earnings fallback 15% + brak E2E happy-path |
| M27 | SuperAdmin | **57** | Alpha górny | ✅ llm-tiers auth (W2) | brak Fazy 4 |
| A1 | Affiliate/Ecosystem | 13 | Broken | — (świadomy stub) | DECYZJA: budować albo wyciąć |

> ¹ **Kolumna Hard-cap:** `✅` = P0 naprawiony przez sprint (hard cap zdjęty); „—" = brak aktywnego hard-capu poza ograniczeniem Faz 3+4. Kolumna pokazuje DOMINUJĄCY czynnik blokujący, nie pełny profil ryzyka modułu.

---

## 2. WĄTKI SYSTEMOWE — NAPRAWIAĆ RAZ (nie per-moduł)

To rdzeń planu. Większość P0/P1 z kart to instancje ~15 wzorców. Naprawiamy wzorzec jako jeden workstream, weryfikujemy we wszystkich miejscach naraz. **Kolejność = priorytet.**

### W1 — Cross-org IDOR sweep (org-scope na warstwie serwisów) 🔴 P0
**Wzorzec:** `WHERE id=?` bez `organization_id` na endpoincie przyjmującym `:id`/encję z body → cross-org read+write po UUID.
**Miejsca (z kart):**
- M01 `ai.routes.ts:5744,5812` (memory/project) — L
- M03 `DecisionController.ts:985,1012` + `inboxService.ts:332,351` — M+M
- M10 `InterviewInsightService.ts:1618,1723` (read PII + hard delete) — M+M
- M13 `initiativeGovernanceService.ts:119,130` (+ link/get decyzja) — M+M
- M14 `executionBudgetService.ts:401-420` (recalc budżetu) + `v8/execution-control.routes.ts:1135-1148` (task_dependencies) — L+M
- M15 `benefits.routes.ts:468` (KPI write) — L
- M16 `financialModelingService.ts:1107` (getModel — legacy GET/PUT/DELETE/compute/approve) — XL
- M08 `my-work.routes.ts:6022,6097` (2 helpery my_idea_maps) — S
- M09 `realtimePlatformService.ts:686-849` (5 facilitation endpointów) — M
**Robota:** jeden skoordynowany przegląd warstwy serwisów; dodać `AND organization_id=?` + weryfikację org-membership PRZED write. Każda poprawka = test cross-org (oczekiwane 403/404).
**Reguła rozpoznawcza:** szukać legacy-routera wołającego serwis-getter bez org, gdy V8-bliźniak ma re-check (M16 wzorcowy przykład).

### W2 — side-router-weak-gate audit (wszystkie mounty Gateway.ts) 🔴 P0
**Wzorzec:** główny router modułu poprawny, ale „dosadzone" boczne routery biją w te same/globalne tabele ze słabszym gate (`verifyToken` zamiast org/superadmin check).
**Miejsca:** M20 (record-templates `4802,4823,4840`, form-submissions `2804`, row-policies `4407`, governed `3413-3469`); M24 (`admin-data.routes.ts:54,94,124`, `ai-settings.routes.ts:218,255`); M27 (`llm.routes.ts:793,799,805`, `virtual-workers.routes.ts`); M23 (`competency.routes.ts` bez auth, `organization-data.routes.ts:210,348` export bez role-gate).
**Robota:** przeskanować WSZYSTKIE mounty w `Gateway.ts` → dla każdego routera porównać middleware z jego „głównym"/V8-bliźniakiem → wyrównać gate w górę. To główny rdzeń długu bezpieczeństwa platformy.

### W3 — RBAC sterowane nagłówkiem klienta → rola z DB 🔴 P0
**Miejsce:** M15 `v8/results.routes.ts:108-113` (`x-kpi-role` z requestu → self-escalation do `kpi_owner`).
**Robota:** rola zawsze z realnej roli/membership usera, NIGDY z requestu. Sprawdzić inne v8-routery pod kątem podobnych `x-*-role` nagłówków.

### W4 — Migracje brakujące/kolidujące (Railway) 🔴 P0 → łączy się z FAZĄ C
- Ideas: `my_idea_map_snapshots` (M05,M06,M08 — wieczne 503) + `my_idea_activity` (M06) — brak w `.sql`.
- Process Flow: `20260603_v8_process_flow.sql` — w repo, runner manualny, prawdopodobnie nie na prodzie.
- M20: kolizja numeracji migracji **725×2/726×2** (realny bug) — L.
- M26: 4 migracje partner z 2026-03/04 prawdopodobnie niezastosowane na prod.
**Robota (dwa etapy):** (a) **Sprint 5 (bez Railway):** napisać brakujące pliki `.sql`, rozwiązać kolizję numerów 725/726; (b) **FAZA C (wymaga Railway):** zastosować migracje na staging/prod + zweryfikować przez `information_schema` — NIE tabelę migracji (runner oznacza wykonaną mimo błędu).

### W5 — Persistencja-fasada (Map in-memory udające DAO) 🔴 P0
**Miejsce:** M18 `documentVersionSnapshotService.ts:50,84-96` + `documentCommentsService.ts:61,65` — wersje/komentarze/approvals/audit znikają po deployu. Zielone testy MOCKUJĄ DAO → maskują.
**Kontrast:** M19 ma REALNĄ persystencję (`presentation_deck_versions` migr.752) — wzorzec do skopiowania.
**Robota:** migracja „wave5" + realny DAO; test cold-start na PG (nie mock).

### W6 — „Fake features" — funkcje, które kłamią użytkownikowi 🔴 P0
- M03 `TaskDetailView.tsx:318-325` — `availableDecisions` = 4 zaszyte mocki.
- M04 `NotebookContent.tsx:1651,1667` + M21 `notebookHandoffService.ts:322` — toast „Wysłano do Radar/Inicjatyw" przy 0 INSERT.
- M08 — 4 przyciski (Import/ActivityFeed/AuditTrail/Snapshot) zawsze 404/401; `generate_table` promowany, nigdy nie zwracany.
- M07 — connectMode OFF (rysowanie połączeń wyłączone) + 5 hooków P14 bez auth (401).
- M13 `InitiativesHub.tsx:1943-1997` — 3 CTA (New/Charter/AI Wizard) disabled sztywno, komponenty gotowe.
- M21 `meeting.routes.ts:218-237` — `persistNote` INSERT do nieistniejącej tabeli `notebook_entries`.
**Robota:** każda — albo realnie podłączyć, albo usunąć kłamliwy element UI. Zero „WIDOCZNE-ALE-ZEPSUTE".

### W7 — Beta-lock tylko nawigacyjny (route-guard + API-gating) 🟠 P1
**Wzorzec:** `betaAccess.ts` blokuje tylko sidebar; direct URL omija; API dostępne bez flagi.
**Miejsca:** M05-M09, M12, M15, M16, M17, M18, M19, M20, M21. **Robota:** route-guard (ProtectedRoute) + API-gating spójne z `betaAccess.ts` — jedna decyzja, jeden helper, wszędzie.

### W8 — `ENABLE_V8_GLOBAL` = SPOF bez komunikatu 🟠 P1
**Wzorzec:** przy OFF moduły wyglądają na puste / przyciski zwracają 404 bez baneru „moduł wyłączony".
**Miejsca:** M17 Outputs, M19 Prezentacje, M20 Tabele, M22 AI-OS Artifacts, M14 Manager, M15 degraded, M16 (ma baner — wzorzec). **Robota:** spójny baner degradacji V8→legacy/„moduł wyłączony" wszędzie; audyt rozjazdu flag BE (komentarz „OFF" vs runtime `!== 'false'` = ON, min. 4 flagi Tabel).

### W9 — Public viewer over-disclosure (wspólny leak) 🟠 P1
**Miejsce:** M17 + M19 dzielą JEDEN leak — `/presentations/shared/:token` zwraca `{...row}` z `organization_id`/`confidentiality` (`presentations.routes.ts:412,606,621`). M18 — usunąć `organizationId` z public share. **Robota:** whitelist pól w jednym helperze; naprawić raz.

### W10 — SQLite-izmy padające na PG 🟠 P1
**Miejsce:** M01 `ai.routes.ts` (`datetime('now',…)`); M09 `realtimePlatformService.ts:141,511` (datetime + interval konkatenacja — realny crash acquireEditLock/cleanStalePresence). **Robota:** parametryzowane interwały; adapter pokrywa tylko literały.

### W11 — Dane localStorage udające serwerowe 🟠 P1
**Miejsce:** M23 `useContextBuilderStore.ts:414` (Goals/Challenges/Strategy — zustand persist, nie per-org, nie zasila Teresy); rename tabel Ideas. **Robota:** backendowa persystencja per-org + zasilanie kontekstu Teresy.

### W12 — Mass dead-code removal 🟡 P2 (GA)
My Work ~15-25 komponentów (WorkCenter, WorkloadView, NotificationsHub), BenefitsHub/BenefitsRealizationView (M15), Economics/* (M16), Admin/* resztki (M24), `_actionDecisionRoutes` 1188 l. decyzja (M22), AIPlatformModule+IAMModuleView (M27), duplikacja drawerów Ideas ~2400 l. (M06), MessageFlowEdge (M07), KnowledgePulse/InsertMenu (M04), SettingsSidebar+VoiceSettingsPanel (M25).

### W13 — i18n (hardcody → `t()`) 🟡 P2 (GA)
M01 (63 pliki), M14 (~141 kluczy PL), M21 (78× `isPolish`), M19 (25× `isPolish`), M16 (19×), M22 (wszystkie Wave panele EN), M23, M24, M27 (114/124 plików), M04, M10.

### W14 — Korupcja codemodu „red"→„rose" 🟡 P2
M06 „Cost roseuction" + `roseoStackRef`; M10/M13/M04 „rose" (21×/...) → `EntityStatusChip`. **Robota:** grep `rose` = 0 wyników.

### W15 — Tokeny kolorów + §27 (TABLE_AND_PREVIEW_CANON) + CI 🟡 P2 (GA)
- Tokeny: M25 (2237 hardkodów), M18 (~150), M02 (~61), M27 (45 hex), M16, M21, M04.
- §27 (SSOT: `docs/ui-standards/03-modules/TABLE_AND_PREVIEW_CANON.md`): Portfolio (M13), Rollout 5 tabel (M14), Results grid (M15), Audyty listy (M12), Admin 4 tabele (M24), Settings listy (M25), Partner tabele (M26), AI-OS ActionCenter (M22), Organizacja tabele (M23).
- CI: **systemowy** — branch `Londyn` NIE jest w PR-gate (M02 zgłasza jako blocker L); promować E2E smoke modułów do PR-gate (M01,M03,M05,M06,M08,M12 testy poza CI).

---

## 3. FAZY REALIZACJI (z bramkami)

> **Definicja PRÓG BETA:** Fazy A+B+C ukończone; każdy moduł core (M01/M03/M10/M13/M14/M15/M25) re-oceniony ≥55/100 po naprawach lub jawnie descoped; zero aktywnych hard-capów bezpieczeństwa; backup DB przed promocją wykonany.
> **Definicja PRÓG GA:** Fazy D+E ukończone; CI gate'uje `Londyn`; moduły core ≥70/100.

### 🔴 FAZA A — Security blitz (PRÓG BETA, część 1)
Workstreamy **W1+W2+W3**. Zamyka WSZYSTKIE hard-capy bezpieczeństwa. Bez tego żaden moduł nie wyjdzie poza 50.
**Bramka A:** zero cross-org read/write na całej platformie; każdy fix ma test cross-org (403/404); side-router audit Gateway.ts kompletny.
**Moduły dotknięte:** M01, M03, M10, M13, M14, M15, M16, M20, M23, M24, M27, M08, M09.
**Szacunek:** ~25-30 poprawek, większość S/M; M16 getModel = XL (org-scope całego legacy routera).

### 🔴 FAZA B — Fake features + persistencja (PRÓG BETA, część 2)
Workstreamy **W5+W6**. Usuwa wszystko, co kłamie użytkownikowi.
**Bramka B:** zero „WIDOCZNE-ALE-ZEPSUTE"; każdy przycisk albo działa, albo go nie ma; persystencja M18 realna (cold-start PG test).
**Moduły:** M03, M04, M07, M08, M13, M18, M21, M22.

### 🔴 FAZA C — Migracje + żywa weryfikacja (PRÓG BETA, część 3 = domknięcie Faz 3+4 audytu)
Workstream **W4** + **Faza 3 (Railway)** + **Faza 4 (żywa przeglądarka)** dla wszystkich 28 modułów.
**Wymaga:** dostęp do Railway + konto staging (obecny blocker odłożenia). PROD = 2026-05-18 → **PRZED promocją `Londyn`→prod: backup/snapshot DB (twardy warunek, nieodwracalne)**; osobny workflow promocji.
**Bramka C:** ✅ backup/snapshot DB przed promocją · ✅ wszystkie migracje zastosowane+zweryfikowane przez `information_schema` · ✅ każdy moduł przeszedł żywo wg scenariuszy S z karty · ✅ karty 🟦→✅ + re-ocena rubryką V1 (D+G odblokowane) · ✅ system testów przekrojowych gotowy (Krok 8 — lista B `INTEGRACJE.md` §B jako scenariusze bazowe).
**To jest moment, w którym audyt staje się PEŁNY.**

### 🟠 FAZA D — Beta hardening (umocnienie BETA)
Workstreamy **W7+W8+W9+W10+W11** + Fale 2 z kart (degraded banners, beta-guardy, szyfrowanie sekretów, transparentność LLM, testy fundamentu M12/M26).
**Bramka D:** beta-lock szczelny (3 warstwy); sekrety szyfrowane (CalDAV/OAuth/SSO/connectors); LLM degradacja transparentna; M12 ma testy (obecnie ZERO).

### 🟡 FAZA E — Szlif GA
Workstreamy **W12+W13+W14+W15** + Fale 3 z kart (dead-code, i18n, tokeny, §27, CI, redesigny stepperów, Miro-grade Ideas).
**Bramka E (GA):** wszystkie moduły core ≥ próg GA wg rubryki; CI gate'uje `Londyn`; zero martwego kodu w ścieżkach krytycznych; pełna i18n PL/EN; §27 wszędzie.

---

## 4. PLAN SPRINTÓW (kolejność wykonania)

> Zasada: najpierw wątki systemowe (RAZ, szeroki efekt), potem domknięcia per-moduł. Każdy fix = osobny commit na `feat/deliverables-light`; `npx tsc --noEmit` zielony; po module wpis w `_TRACKER.md`.
> **Legenda nakładu:** XS = <30 min · S = 30 min–2 h · M = 2–6 h · L = 6–16 h (1–2 dni) · XL = 3–5 dni roboczych.

**Sprint 1 — Security XS/S (najwyższy stosunek efekt/nakład)** — FAZA A
W3 (`x-kpi-role`), W2 quick gates: M27 `llm.routes.ts` (verifySuperAdmin), M27 virtual-workers, M24 admin-data×3 + ai-settings×2, M23 competency-auth + org-export role-gate, M15 `benefits.routes.ts:468`, M08 2 helpery org. → ~12 poprawek, wszystkie S/XS.

**Sprint 2 — Security M/L (warstwa serwisów)** — FAZA A
W1: M01 memory, M03 DecisionController+inbox, M10 getInsight/deleteInsight, M13 governance, M14 recalc+task_deps, M09 facilitation+WS, M16 getModel (XL). → org-scope + test cross-org każda.

**Sprint 3 — Side-router pełny skan** — FAZA A (domknięcie)
Przeskanować WSZYSTKIE mounty `Gateway.ts`; wyrównać gate; zamknąć Bramkę A.

**Sprint 4 — Fake features** — FAZA B ✅ UKOŃCZONY 2026-06-11
W6: M03 zweryfikowany OK (false positive); M07 zweryfikowany OK; M08 AuditTrail getHeaders + Snapshot/Connector/generate_table usunięte; M13 AI Wizard CTA aktywowany; M04 Radar handoff usunięty; M21 zweryfikowany OK; M22 _actionDecisionRoutes dead import usunięty. Commit: `3aec45a` (f35aa8d via kontekst).

**Sprint 5 — Persistencja + migracje (pisanie plików SQL)** — FAZA B + W4-a ✅ UKOŃCZONY 2026-06-11
W5: M18 — DAO + migr.776 już istniały; naprawiono stale refs `persistedSnapshotStore`/`persistedCommentStore` (commit `18fd9ca`). W4-a: `20260611_my_idea_map_snapshots_and_activity.sql` OK; process-flow migr. czeka na Railway; M20 kolizja 725/726 rozwiązana (archive); M26 5 plików partner match MIGRATION_PATTERN. **[DECYZJA #6]** M20 governed sync → defer (STUB, W6 decyzja #6 = NIE dokańczać bez Railway).

**Sprint 6 — Railway + żywa weryfikacja** — FAZA C ⏳ BLOKUJE Railway
Promocja `Londyn`→prod → migracje → Faza 3 (schema verify) → Faza 4 (28× żywo wg scenariuszy S) → re-ocena. **= PRÓG BETA osiągnięty.**

**Sprint 7+ — Hardening (FAZA D)** → **Szlif (FAZA E)** — ✅ WIĘKSZOŚĆ UKOŃCZONA (wyprzedzono Sprint 6)
W7: beta-lock route-guard+API-gating — ✅ `bc5579918d`
W8: V8 degradation banners — ✅ `899f3a5018`
W9: public viewer over-disclosure — ✅ `1b67579d7a`
W10: SQLite-izmy — ✅ `1b67579d7a` + `7495c12ffb`
W11: localStorage → backend persistence (org context store) — ✅ `d013ab7c4c`
W12: dead-code removal (~3100 linii) — ✅ `42b070e4dc`
W13: i18n M22 Wave5-9 + M14 Wave8 — ✅ `b77fd87ae7` + `84757dc672`
W14: rose→red codemod + M17/M04 cleanup — ✅ `a1103f3b28` + `167b2757bf`
W15: CI branch gates (Londyn → test-suite) — ✅ `99bda16792`
Bramka D: AES-256-GCM secrets + M25/M21/M12 hardening — ✅ `9ef570ca1b` + `72d57e64a4` + `7df4b22d6d`
**Pozostałe Fala 2 (moduł-poziom):** do realizacji po FAZA C. **Kolejność:** core → studia → beta → Ideas → internal.

---

## 5. INTEGRACJE MIĘDZYMODUŁOWE (Krok 6 — do domknięcia)

> ⚠️ **STATUSY = ANALIZA STATYCZNA KODU (offline, bez Railway).** Runtime niezweryfikowany do FAZY C (Faza 3+4). Każde „DZIAŁA" może być fałszywe na żywym środowisku ze względu na schema drift, brakujące migracje lub flagę OFF.

**Pełna mapa z werdyktami weryfikowanymi w kodzie (file:line, oba końce) → `INTEGRACJE.md` §A (~70 połączeń), §B (20 przepływów), §C (9 poprawek `[INTEGRACJA]`).**

Skrócony snapshot 10 kluczowych przepływów:

| # | Przepływ | Status (statyczny, zweryf. w kodzie) |
|---|----------|--------------------------------------|
| 4 | Wywiad→Inicjatywy→Wdrożenie→Rezultaty | **CZĘŚCIOWY** — rdzeń M10→M13→M15 PEŁNY; ogniwo M14→M15 URWANE |
| 9 | Tabele→publish-to-Results / sync-to-Finance | **STUB** |
| 6 | Audyty→fan-out wywiadów→Inbox | PEŁNY (P1 assignee bez walidacji org) |
| 7 | Notatnik→konwersje | MIESZANY (convert DZIAŁA; handoff→Radar STUB) |
| 11 | Meeting→decyzje/akcje→My Work | LOKALNY **[DECYZJA #8]** |
| 13 | Organizacja→kontekst Teresy | CZĘŚCIOWY (Goals/Challenges/Strategy localStorage) |
| 1 | Czat→Canvas→registry→Outputs | PEŁNY |
| 8 | Ideas→convert (6 targetów) | CZĘŚCIOWY (eksport serwerowy STUB **[DECYZJA #9]**) |
| 17 | Mind Map sidekick→Teresa | CZĘŚCIOWY (toolbar only, nie cross-moduł do czatu) |
| 15 | Beta/uprawnienia (3 warstwy) | NIESPÓJNY (W7) |

**✅ Krok 6 UKOŃCZONY 2026-06-11 (`INTEGRACJE.md` wypełnione + kontrakty zweryfikowane w kodzie, oba końce).** Wynik: 20 przepływów kanonicznych — **11 PEŁNY/DZIAŁA, 5 CZĘŚCIOWY/URWANY/LOKALNY, 4 STUB/ZEPSUTE, 1 niespójny (beta)**. 9 poprawek `[INTEGRACJA]` dopisanych do planów modułów.

**🔴 NOWE ODKRYCIE KRĘGOSŁUPA (nie było w kartach):** łańcuch Wywiad→Inicjatywy→Wdrożenie→Rezultaty spina się przez M13→M15 (rdzeń), ale **ogniwo M14→M15 jest URWANE** — Wdrożenie liczy budżet/health/ryzyka, ale NIE eksportuje ROI do `v8_roi_realization_entries`; Rezultaty czytają własne tabele; brak deep-linku Execution→Results (`ExecutionHub.tsx:945`). To dziura w głównym przepływie wartości produktu → **dodać do planu M14 jako Fala 2 [INTEGRACJA], priorytet**.

**Pozostałe urwane przepływy → MASTER PLAN (już pokryte wątkami):** governed sync M20→Results/Finance STUB (W6/decyzja #6); handoff Notatnik→Radar STUB (W6); Ideas eksport serwerowy STUB (decyzja); Mind Map PPT→HTML (Fala 3); Mind Map sidekick→Teresa kontekst urwany (M06 Fala 2); Meeting→MyWork lokalny (decyzja produktowa: globalizować czy zostawić). Pełna lista: `INTEGRACJE.md` §C.

---

## 6. OTWARTE DECYZJE PRODUKTOWE (Piotr)

1. **A1 Affiliate/Ecosystem** — budować od zera (z org-scope od początku) czy wyciąć (`AffiliateDashboardView`, `/affiliate`, `referrals.routes.ts`)? Obecnie świadomy stub 13/100.
2. **Kliencka pamięć AI** (M01) — zdjąć `internalToolsGuard` z `memory/project` czy wyciąć funkcję?
3. **M25 billing** — wpiąć `BillingSettings` czy usunąć route `/settings/billing` („Section not found")?
4. **M26 `PARTNER_SELF_CONNECT_ENABLED`** — portal otwarty na prod czy zamknięty?
5. **M08 dual-stack** — ścieżka B metadata-first (`useTablePlatformBridge`) czy wyciąć?
6. **M20 governed sync** — dokończyć sync-to-results/finance (obecnie STUB) jako Beta-feature czy odłożyć?
7. **V8 mirror Process Flow** (M07) — naprawić kontrakt ID czy wyciąć mirror i zostać przy blob-sync?
8. **Meeting→My Work globalizacja** (M21) — czy `meeting_follow_ups`/`decisions_json` powinny trafiać do globalnych `tasks`/`decisions` (M03), czy lokalny widok spotkania to świadoma architektura? Blokuje: Sprint 4 (W6 fake-features dla M21).
9. **M05 eksport serwerowy Ideas** — dokończyć worker generacji pliku (`finalBatchService.ts:19` — wpis `pending`, plik nigdy nie powstaje) czy wyciąć przycisk eksportu? Blokuje: Sprint 7+ (M05 Fala 2).

---

## 7. DEFINITION OF DONE (per faza)

- **FAZA A:** ✅ test cross-org 403/404 dla każdego naprawionego endpointu · ✅ side-router skan Gateway.ts udokumentowany · ✅ zero hard-capów bezpieczeństwa w kartach.
- **FAZA B:** ✅ zero kłamliwych elementów UI · ✅ M18 persystencja przeżywa cold-start PG (test nie-mockowany).
- **FAZA C:** ✅ **backup/snapshot DB przed promocją** · ✅ migracje zweryfikowane `information_schema` (staging+prod) · ✅ 27 modułów × scenariusze S żywo w przeglądarce · ✅ karty 🟦→✅ + re-ocena rubryką V1 (D+G odblokowane) · ✅ Krok 8 — testy przekrojowe zainicjowane (lista B `INTEGRACJE.md` §B).
- **FAZA D:** ✅ beta-lock 3-warstwowy · ✅ sekrety szyfrowane · ✅ M12 ma testy · ✅ degradacje transparentne.
- **FAZA E (GA):** ✅ CI gate'uje `Londyn` · ✅ i18n PL/EN pełne · ✅ §27 wszędzie · ✅ martwy kod usunięty · ✅ moduły core ≥ próg GA.

### Protokół re-audytu (po zamknięciu Sprintów 1–5)

Po naprawach Fazy A+B, przed Sprint 6:
1. Dla każdego modułu z naprawionymi P0/P1: uruchom ponownie Fazy 1–2 (statyka+testy).
2. Zaktualizuj wymiary A/B/C/F w karcie modułu; D/G czekają na Fazę 4.
3. Nowy wynik → wiersz w `Harvard/_AUDIT_TRACKER.md` (nowa ocena + data).
4. Zaktualizuj §1 MASTER_PLAN (ocena, hard-cap).
5. Re-ocena pełna (D+G odblokowane) dopiero po Fazie 4 (Sprint 6).

---

## BLOKERY PO STRONIE WŁAŚCICIELA

| # | Blok | Potrzebne do | Pilność |
|---|------|-------------|---------|
| B1 | Decyzje §6 (#1–#9) | Sprint 4–5: każda pozycja `[DECYZJA #n]` blokuje jej sprint | Przed Sprint 4 |
| B2 | Dostęp Railway CLI + konto staging | Sprint 6 (FAZA C) | Przed Sprint 6 |
| B3 | Backup/snapshot prod DB | Promocja `Londyn`→prod (FAZA C) — nieodwracalne | Razem z B2 |
| B4 | Żywa weryfikacja (Faza 4) 27 modułów × scenariusze S | Zamknięcie FAZY C (próg BETA) | Po Sprint 6 |
| B5 | Decyzja A1 Affiliate (#1) | Nie blokuje Sprint 1–5; czyści backlog | Przed Sprint 7 |

---

## 8. POWIĄZANIA

- Wątki systemowe: `KONTEKST.md` §5, pamięć `[[project_system_unification]]`.
- Karty źródłowe: `Harvard/modules/*/KARTA_AUDYTU.md` (file:line dla każdej pozycji).
- Status: `Harvard/_TRACKER.md` (SSOT ocen) — aktualizować przy re-ocenie po Fazie C.
- Integracje: `Harvard/INTEGRACJE.md` (Krok 6).
- Sekwencja: `Harvard/SEKWENCJA.md`, `Harvard/PLAN_3_DNI.md` (ten plan = rozwinięcie Kroków 5-7).
