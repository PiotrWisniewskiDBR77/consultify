# BRIEFY DECYZYJNE #1–#9 — do podjęcia przez Piotra

**Data:** 2026-06-12 · **Podstawa:** MASTER_PLAN §6 + weryfikacja kodu (3 agenty research, file:line przy każdym fakcie)
**Cel:** wszystkie 9 decyzji podejmowalne w ~15 minut. Każdy brief: stan faktyczny → opcje → rekomendacja → koszt.
**Format odpowiedzi:** wystarczy lista „#n: A/B/C" + ewentualne uwagi.

---

## #1 — A1 Affiliate/Ecosystem: budować czy wyciąć?

**Stan (zweryfikowany):** FE kompletny i ładny (`AffiliateDashboardView.tsx`, 373 linie, Bento-grid) — ale zasilany mockami z `api.ts:12919` (zwracają puste tablice). Backend `referrals.routes.ts` = 22 linie, wszystko zwraca **503 „Feature not configured"**. Migracje DB istnieją (`022_phase_g_referrals.sql`) — tabele puste. Wpięty w menu i routing; nikt inny tego nie importuje.
**To klasyczny W6 fake-feature:** klient widzi dashboard, który zawsze pokazuje zera.

- **Opcja A — Budować:** realna logika kodów, tracking użyć, konwersje → ~10–15 dni.
- **Opcja B — Wyciąć z UI, zostawić fundamenty:** usunąć route+menu+widok (~390 linii), zostawić migracje. Odwracalne w 1 dzień, gdy ecosystem wróci do strategii. ~2 h.
- **Opcja C — Zostawić jak jest:** łamie bramkę B (zero kłamliwych elementów UI).

**Rekomendacja: B.** Ecosystem nie jest w D1–D22 na ścieżce GA; fundamenty zostają.

---

## #2 — M01 pamięć AI (memory/project): zdjąć guard czy wyciąć?

**Stan (zweryfikowany — premisa audytu była częściowo błędna):** endpointy `/ai/memory/*` w `ai.routes.ts:5743–5901` **NIE są** za `internalToolsGuard` — mają `verifyToken` + właściwe checki (org-ownership dla project, `edit_organization_settings` dla org). Za guardem jest OSOBNY router `/api/ai-memory` (15 linii, wewnętrzny). Metody FE w `api.ts:14118–14156` istnieją, ale **żaden komponent UI ich nie woła** (0 referencji) — martwy kod po stronie klienta.

- **Opcja A — Usunąć martwą fasadę FE** (39 linii w api.ts), backend zostaje jak jest (guardy poprawne). ~30 min.
- **Opcja B — Zbudować UI pamięci dla klienta** na istniejących endpointach (feature produktowy, nie naprawa). Osobny projekt.

**Rekomendacja: A** teraz; B jako świadoma pozycja roadmapy, nie dług audytowy.

---

## #3 — M25 billing: wpiąć `BillingSettings` czy usunąć route?

**Stan (zweryfikowany):** komponent `BillingSettings.tsx` (88 linii) jest **kompletny** — renderuje subskrypcję, dokumenty, liczniki przez gotowy `BillingCore`. Backend gotowy. Jedyny brak: sekcja `billing` nie jest dodana do union-type w `SettingsSidebar.tsx:55` ani do switcha w `SettingsView.tsx:316–448` → default „Section not found".

- **Opcja A — Wpiąć:** 5 plików, ~10 linii zmian, ~2 h z testem.
- **Opcja B — Usunąć route.**

**Rekomendacja: A — bez dyskusji.** Wszystko gotowe, to 2 godziny. (Mogę zrobić od ręki po Twoim „tak".)

---

## #4 — M26 `PARTNER_SELF_CONNECT_ENABLED`: otwarty czy zamknięty na prod?

**Stan (zweryfikowany):** flaga czytana w `partners.routes.ts:244,382`; sprawdzenie ścisłe `=== 'true'`; **nieobecna w żadnym .env.example → domyślnie ZAMKNIĘTE** na prod (403 `PARTNER_SELF_CONNECT_DISABLED`, FE chowa formularz). Gdy otwarta: każdy zalogowany użytkownik tworzy partner-org bez approvalu + dostaje kod referencyjny.

- **Opcja A — Zamknięty (status quo):** onboarding partnerów ręczny; zero ryzyka spamu orgów.
- **Opcja B — Otwarty:** samoobsługa partnerów; ryzyko niekontrolowanego tworzenia orgów.

**Rekomendacja: A** do czasu zdefiniowania procesu partnerskiego (tiery, approval). Niezależnie: dopisać flagę do `.env.example` z komentarzem (15 min).

---

## #5 — M08 dual-stack: ścieżka B metadata-first czy wyciąć?

**Stan (zweryfikowany):** `useTablePlatformBridge.ts` (536 linii) jest **funkcjonalny, nie pół-martwy** — pełny CRUD na tp_* przez `TablePlatformApi`, ale za flagą `tablePlatformMetadataFirst` (domyślnie OFF → noop). Path A (legacy hooki) jest primary. Wycięcie: ~2–3 h, brak ryzyka danych (flaga off = brak danych produkcyjnych w tp_*).

- **Opcja A — Zostawić za flagą:** ścieżka migracji Ideas-Table → platforma tp_* (strategiczny kierunek M20) zostaje żywa. Koszt: ~1100 linii utrzymywanego kodu dual-stack.
- **Opcja B — Wyciąć:** prostszy kod na GA; jeśli platforma tp_* wygra, trzeba będzie odbudować.

**Rekomendacja: A** — to jedyny pomost Ideas→TablePlatform; flagowane, więc nie szkodzi. Decyzję ostateczną podjąć po FAZIE C, gdy zobaczymy tp_* na żywo.

---

## #6 — M20 governed sync→Results/Finance: dokończyć czy odłożyć?

**Stan (zweryfikowany):** `ModuleSyncService.syncToModule()` **zapisuje tylko metadane** do `tp_module_sync_results` (log syncu) — żadne dane NIE trafiają do Results/Finance. FE (`ConsultifyLinkPanel.tsx:142–165`) pokazuje toast „Sync completed" → **przycisk kłamie** (naruszenie bramki B). Realny sync = transform tp_records→KPI/transakcje + bulk-ingest endpointy: ~10–15 h.

- **Opcja A — Dokończyć teraz:** 10–15 h, ale weryfikacja wymaga żywej bazy (Railway) — ślepe budowanie.
- **Opcja B — Schować/oznaczyć przyciski teraz (~1 h), realny sync po FAZIE C** jako Beta-feature.

**Rekomendacja: B** (spójna z wcześniejszym deferem ze Sprint 5). Przyciski przestają kłamać od razu; budujemy z żywą weryfikacją.

---

## #7 — M07 V8 mirror Process Flow: naprawić kontrakt ID czy wyciąć mirror?

**Stan (zweryfikowany — lepszy niż w karcie):** migracja `20260603_v8_process_flow.sql` poszła, `processFlowService.ts` ma pełny CRUD + walidację + semantic readback na tabelach `v8_process_flow_nodes/edges` (z graceful fallback). „Garbage" = historyczne flow zapisane jako JSON-blob w `my_idea_maps` zanim tabele istniały; **nie ma konsumentów** czytających mirror, więc nic się nie psuje.

- **Opcja A — Pełna migracja blob→V8:** 2–3 dni, ryzyko przy nieprzewidywalnej strukturze blobów.
- **Opcja B — Dual-write forward:** nowe flow tylko do V8, stare bloby read-only. ~1 dzień, niskie ryzyko.
- **Opcja C — Wyciąć mirror, wrócić do bloba:** traci walidację/readback. ~4 h.

**Rekomendacja: B.** Czysty kontrakt od dziś, zero ryzyka na starych danych.

---

## #8 — M21 Meeting→My Work: globalizować follow-upy/decyzje czy lokalnie?

**Stan (zweryfikowany):** decyzje spotkania = JSON w `meetings.decisions_json`, follow-upy = tabela `meeting_follow_ups` (`meetingService.ts:326–375`); generate-notes z AI też pisze tylko lokalnie. **Żadna ścieżka nie pcha ich do globalnych `tasks`/`decisions`**; inbox M03 (`canonical_inbox_items`) jest zbudowany, ale niepodłączony do spotkań. Komentarze w kodzie sugerują intencję zunifikowanego inboxu.

- **Opcja A — Globalizować:** push do globalnych tabel przy utworzeniu (z kluczem idempotencji), inbox M03 pokazuje follow-upy ze spotkań. 2–3 dni. Spina łańcuch Meeting→Execution.
- **Opcja B — Lokalnie (status quo):** dane spotkań w silosie; użytkownik musi wejść w spotkanie.

**Rekomendacja: A** — to jest sedno wartości My Work jako jednego inboxu; zgodne z intencją architektury. Realizacja po FAZIE C (albo wcześniej, jeśli priorytetyzujesz).

---

## #9 — M05 eksport serwerowy Ideas: dokończyć worker czy wyciąć przycisk?

**Stan (zweryfikowany):** `requestExport()` (`finalBatchService.ts:19`) wstawia wiersz `idea_exports` ze status='pending' i… koniec. **Nie istnieje** worker, generator PDF/PNG/Markdown ani storage. `completeExport()` jest, ale nikt go nie woła automatycznie. Użytkownik klika „Export" → sukces → plik nigdy nie powstaje (**user-visible lie**, bramka B).

- **Opcja A — Dokończyć:** worker + generator + storage + polling FE = 4–5 dni (fazowane: Markdown → PDF → PNG).
- **Opcja B — Wyciąć przycisk:** ~4 h, kłamstwo znika natychmiast; tabela zostaje na przyszłość.

**Rekomendacja: B teraz** (uczciwość UI), A jako pozycja roadmapy gdy Ideas dostanie falę Miro-grade (i tak planowaną).

---

## ZBIORCZO — rekomendowany pakiet

| # | Decyzja | Rekomendacja | Koszt realizacji |
|---|---------|--------------|------------------|
| 1 | A1 Affiliate | **B** — wyciąć z UI, zostawić fundamenty | ~2 h |
| 2 | M01 pamięć AI | **A** — usunąć martwą fasadę FE | ~30 min |
| 3 | M25 billing | **A** — wpiąć | ~2 h |
| 4 | M26 self-connect | **A** — zamknięty + dokumentacja flagi | ~15 min |
| 5 | M08 dual-stack | **A** — zostawić za flagą, re-decyzja po FAZIE C | 0 |
| 6 | M20 governed sync | **B** — schować przyciski, sync po FAZIE C | ~1 h |
| 7 | M07 V8 mirror | **B** — dual-write forward | ~1 dzień |
| 8 | M21 Meeting→MyWork | **A** — globalizować (po FAZIE C) | 2–3 dni |
| 9 | M05 eksport | **B** — wyciąć przycisk, worker w fali Miro-grade | ~4 h |

**Pakiet „szybkie TAK":** #1B+#2A+#3A+#4A+#6B+#9B = ~1 dzień roboczy łącznie, zamyka 6 z 9 decyzji i czyści wszystkie kłamliwe elementy UI z tej listy.
