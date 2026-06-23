# M13 — PLAN TESTÓW WYKONAWCZYCH · 5 artefaktów × 30 scenariuszy (150)

> **Data:** 2026-06-22 · **Branch:** `feat/deliverables-w1` (lokalnie, bez push) · **Autor:** CTO (Claude) na zlecenie CEO
> **Cel:** wykonywalny plan testów dla 5 artefaktów M13 — **Inicjatywy, Decyzje, Notyfikacje, Kalendarz, Taski** — po **30 zróżnicowanych scenariuszy** każdy. Każdy scenariusz: dokładny oczekiwany wynik (osobno **jakość** treści/zachowania i **grafika** wyglądu), nazwa pliku-zdjęcia (dowód), kryteria oceny PASS, werdykt automatyzowalności headless.
> **Przebieg wykonania (faza testowania, osobny krok):** dla każdego scenariusza → przeprowadź → zrób screen → oceń czy screen doprowadził tam gdzie miał, w obu ujęciach (jakość odpowiedzi + grafika).

---

## 1. Jak czytać i wykonywać

### Szablon scenariusza
Każda pozycja ma: **Powierzchnia** (komponent/route) · **Typ** (kategoria różnorodności) · **Precondition/seed** · **Kroki** · **Oczekiwany wynik — JAKOŚĆ** (treść/zachowanie/API) · **Oczekiwany wynik — GRAFIKA** (wygląd) · **Screenshot** (dowód) · **Kryteria OCENY** (a) jakość PASS gdy… (b) grafika PASS gdy… · **Wykonanie** (headless ✅/🟡/❌ + auto-status).

### Legenda „Wykonanie"
- **✅ headless** — w pełni automatyzowalny (Playwright render/API lub component/integration vitest); deterministyczne zdjęcie.
- **🟡 częściowo** — render/API headless + zdjęcie, ale pełny dowód funkcji wymaga realnych danych/interakcji.
- **❌ real-browser/człowiek** — modale/portale, drag real-mouse, AI live, persist round-trip, a11y focus → realna przeglądarka (Piotr / computer-use).

### Ocena zdjęcia (faza testowania)
Każdy screen oceniamy **dwukryterialnie**:
1. **Jakość odpowiedzi** — czy treść/zachowanie/dane/statusy są dokładnie takie jak w „Oczekiwany wynik — JAKOŚĆ".
2. **Ujęcie graficzne** — czy wygląd zgodny z „Oczekiwany wynik — GRAFIKA" + kanon (§7/§9/§17/§27, brak danger-fill poza statusami BLOCKED/CRITICAL, dark/light, czytelność, brak crimson-leak/overflow).
Scenariusz = PASS tylko gdy **OBA** kryteria PASS.

### Zdjęcia
Katalog: `docs/qa/screens/m13-exec/<artefakt>/` (initiatives · decisions · notifications · calendar · tasks). Nazwa = `<id>-<slug>.png`.

### Stan debugowania (bramka wejścia do testowania) — ✅ DOMKNIĘTY 2026-06-22
- **Unit/integration/component M13:** 261/261 zielonych (45 plików).
- **E2E m13 headless:** katalog 14/14 + manual 20/20 + acceptance 3/3; `m13-demo.spec.ts` zabezpieczony (skip gdy brak plików demo).
- **tsc:** `InitiativeController` 0 błędów; `notificationService.ts:811` naprawiony (`row` może być null). Pozostały drift (jsonwebtoken/socket.io/teresaCopilot) = pre-existing, runtime-fine, poza zakresem M13.
- **Harness:** `tests/e2e/m13/_m13.ts` (seedInitiative, seedTasks, openDoc, forceTheme, sectionNav, shot, readTestSupportState).

### Rozkład automatyzowalności (orientacyjnie)
~połowa scenariuszy = ✅/🟡 headless (render/API/component/integration → zdjęcia automatyczne), reszta = ❌ real-browser (modale, drag, persist round-trip, a11y, in-app center z zalogowaną sesją). Per artefakt szczegóły w kolumnie „Wykonanie".

---

# ARTEFAKT 1 — INICJATYWY (INI-01…30)

> Powierzchnie: hub portfolio (kanban/lista/timeline/grid), dokument 26-sekcji, maszyna 13 statusów, tworzenie, bramki AI/hard. Status danger-fill: TYLKO BLOCKED.

### INI-01 — Hub ładuje portfolio (Kanban, scope „active")
- **Powierzchnia:** `InitiativesHub.tsx` (fetchData, PortfolioKanbanView) · **Typ:** happy-path
- **Precondition/seed:** Org non-demo z ≥6 inicjatywami w DRAFT/PENDING_REVIEW/REVIEW/PROMOTED/PLANNING; token write-access; `gotoHub`.
- **Kroki:** 1. Otwórz `/portfolio`. 2. Zaczekaj aż zniknie `HubWorkAreaLoading`. 3. Odczytaj kolumny i liczniki.
- **JAKOŚĆ:** GET portfolio (`statuses=ACTIVE_STATUSES`) 200; 7 kolumn ACTIVE_STATUSES; karty wg `status`; suma kart = długość listy; EXECUTING/DONE/ARCHIVED NIE w scope active.
- **GRAFIKA:** Nagłówki z dotColor wg STATUS_METADATA (slate/amber/blue/indigo/emerald/primary); zero danger-fill poza BLOCKED; karty z badge pastelowym, kanon §7.
- **Screenshot:** `docs/qa/screens/m13-exec/initiatives/ini-01-hub-kanban-active.png`
- **OCENA:** (a) 7 kolumn=ACTIVE_STATUSES + suma zgodna; (b) dot-colory wg metadanych, zero danger-fill.
- **Wykonanie:** Headless 🟡 · do-build

### INI-02 — Przełącznik scope active↔all odsłania pełen cykl
- **Powierzchnia:** `InitiativesHub.tsx` (scope, ALL_STATUSES) · **Typ:** edge
- **Precondition/seed:** + inicjatywy EXECUTING/BLOCKED/DONE/TRACKING/ARCHIVED/CANCELLED.
- **Kroki:** 1. Scope „active". 2. Toggle „Wszystkie". 3. Porównaj kolumny + refetch.
- **JAKOŚĆ:** „all" → `getPortfolio` bez `statuses`; 13 kolumn ALL_STATUSES w kolejności cyklu; powrót do active zwęża do 7.
- **GRAFIKA:** Tylko BLOCKED z danger-dot; CANCELLED/ARCHIVED slate/gray wyciszone; scroll-x bez ucięcia.
- **Screenshot:** `docs/qa/screens/m13-exec/initiatives/ini-02-scope-all-13cols.png`
- **OCENA:** (a) 13 kolumn w getLifecycleOrder; (b) tylko BLOCKED danger-token.
- **Wykonanie:** Headless 🟡 · do-build

### INI-03 — Pusty stan portfolio (zero inicjatyw)
- **Powierzchnia:** `InitiativesHub.tsx` (empty branch) · **Typ:** pusty-stan
- **Precondition/seed:** Świeża org non-demo bez inicjatyw; rola consultant.
- **Kroki:** 1. `/portfolio`. 2. Odczytaj empty.
- **JAKOŚĆ:** GET 200 pusta lista; ikona Lightbulb + `initiatives.empty.*`; CTA „Nowa inicjatywa" (non-pilot) otwiera modal.
- **GRAFIKA:** Centrowany empty, ikona primary-400/50; czytelny dark+light; CTA wg motywu; bez danger.
- **Screenshot:** `docs/qa/screens/m13-exec/initiatives/ini-03-empty-state.png`
- **OCENA:** (a) empty-copy + działający CTA; (b) centrowanie + kontrast w obu motywach.
- **Wykonanie:** Headless ✅ · do-build

### INI-04 — Błąd ładowania → banner retry + kod
- **Powierzchnia:** `InitiativesHub.tsx` (loadError/retry) · **Typ:** błąd/fallback
- **Precondition/seed:** Wymuś błąd 500 z `data.code`.
- **Kroki:** 1. `/portfolio`. 2. Po retry sieciowych. 3. Odczytaj banner.
- **JAKOŚĆ:** `role="alert"` `initiatives.hub.failedToLoad` + `errors.loadFailed`; gdy `error.data.code` → linia `code:`; Retry/Dismiss; do 3 retry (2s→8s) dla network.
- **GRAFIKA:** Banner `border-danger-500/20 bg-danger-900/10` (jedyne dozwolone danger = stan błędu); danger ograniczony do karty.
- **Screenshot:** `docs/qa/screens/m13-exec/initiatives/ini-04-load-error-banner.png`
- **OCENA:** (a) banner+code+retry; (b) danger tylko w karcie błędu.
- **Wykonanie:** Headless 🟡 · do-build

### INI-05 — V8 Planning degraded → banner fallback do legacy
- **Powierzchnia:** `InitiativesHub.tsx` (v8PlanningDegraded) · **Typ:** błąd/fallback
- **Precondition/seed:** Org bez V8; legacy `getInitiatives` zwraca dane.
- **Kroki:** 1. `/portfolio`. 2. Lista i tak się ładuje. 3. Odczytaj banner degraded.
- **JAKOŚĆ:** `getPortfolio` rzuca → fallback `getInitiatives` 200; lista NIE pusta; honest degraded banner; filtr do ALLOWED_STATUSES.
- **GRAFIKA:** Banner informacyjny (amber/neutral, nie danger-fill); reszta hubu normalna.
- **Screenshot:** `docs/qa/screens/m13-exec/initiatives/ini-05-v8-degraded-banner.png`
- **OCENA:** (a) dane z legacy + banner; (b) banner neutralny bez czerwieni.
- **Wykonanie:** Headless 🟡 · do-build

### INI-06 — Tworzenie z Hub CTA (modal minimalny)
- **Powierzchnia:** `InitiativesHub.tsx` (showNewModal, createInitiativeWriteTruth) · **Typ:** happy-path
- **Precondition/seed:** Non-pilot consultant; hub załadowany.
- **Kroki:** 1. „Nowa inicjatywa". 2. Tytuł/axis/level/summary. 3. Zapisz.
- **JAKOŚĆ:** POST `/api/initiatives` 200/201; status DRAFT; `upsertPortfolioInitiative`; reveal-state pokazuje kartę DRAFT; toast sukcesu.
- **GRAFIKA:** Modal kanon §9; nowa karta DRAFT w lewej kolumnie z badge slate; reveal nie zostawia pustego boardu.
- **Screenshot:** `docs/qa/screens/m13-exec/initiatives/ini-06-create-modal.png`
- **OCENA:** (a) DRAFT utworzony+widoczny po reveal; (b) modal kanon + karta slate.
- **Wykonanie:** Headless ✅ · do-build

### INI-07 — Walidacja pustego tytułu w modalu tworzenia
- **Powierzchnia:** `InitiativesHub.tsx` (form, isCreating) · **Typ:** walidacja
- **Precondition/seed:** Modal tworzenia otwarty.
- **Kroki:** 1. Pusty tytuł. 2. Zapisz. 3. Obserwuj blokadę.
- **JAKOŚĆ:** Submit zablokowany/odrzucony — brak POST z pustym title; disabled/komunikat; po wpisaniu odblokowanie.
- **GRAFIKA:** Pole z focus-ring niebieskim; komunikat neutralny/amber nie danger; przycisk disabled wyciszony.
- **Screenshot:** `docs/qa/screens/m13-exec/initiatives/ini-07-create-validation.png`
- **OCENA:** (a) brak POST + jasny komunikat/disabled; (b) walidacja bez crimson-leak.
- **Wykonanie:** Headless ✅ · do-build

### INI-08 — Deep-link `?new=1` otwiera modal (i blokuje pilota)
- **Powierzchnia:** `InitiativesHub.tsx` (deep-link new, dispatchPilotAccessBlocked) · **Typ:** rola/uprawnienia
- **Precondition/seed:** (A) consultant, (B) pilot participant.
- **Kroki:** 1. `/portfolio?new=1`. 2. Zachowanie wg roli. 3. Sprawdź wyczyszczenie `new`.
- **JAKOŚĆ:** (A) modal+param usunięty; (B) pilot: brak modalu, `dispatchPilotAccessBlocked({href:'/initiatives'})`, param usunięty; `handledDeepLinkNew` chroni przed re-triggerem.
- **GRAFIKA:** (A) modal; (B) blokada pilota neutralna, bez modalu.
- **Screenshot:** `docs/qa/screens/m13-exec/initiatives/ini-08-deeplink-new-pilot.png`
- **OCENA:** (a) modal wg roli + URL czysty; (b) blokada pilota wg kanonu.
- **Wykonanie:** Headless ✅ · do-build

### INI-09 — Deep-link `?open=<id>&mode=doc` otwiera dokument
- **Powierzchnia:** `InitiativesHub.tsx` (deep-link open) · **Typ:** happy-path
- **Precondition/seed:** `seedInitiative` → id; `openDoc(page,id,title)`.
- **Kroki:** 1. `/portfolio?open=<id>&mode=doc`. 2. Czekaj na section-nav. 3. Sprawdź params/tab.
- **JAKOŚĆ:** Inicjatywa pobrana (lista→V8→legacy→interview fallback); `InitiativeDocumentView` aktywny; reveal scope/filter; params usunięte; section-nav widoczny.
- **GRAFIKA:** Lewy section-nav + panel treści, czytelny light/dark; brak ERROR_BOUNDARY_RE.
- **Screenshot:** `docs/qa/screens/m13-exec/initiatives/ini-09-deeplink-doc.png`
- **OCENA:** (a) section-nav obecny + URL czysty; (b) dokument-shell kanon bez błędu.
- **Wykonanie:** Headless ✅ · istniejący (m13 harness openDoc)

### INI-10 — Dokument: nawigacja po wszystkich 26 sekcjach
- **Powierzchnia:** `InitiativeDocumentView.tsx` (SECTION_REGISTRY) · **Typ:** happy-path
- **Precondition/seed:** Seeded inicjatywa z bogatym payloadem; openDoc.
- **Kroki:** 1. `sectionNavButtons` → przejdź po kolei. 2. Render każdej. 3. Screen co kilka.
- **JAKOŚĆ:** Komplet sekcji wg DEFAULT_SECTION_ORDER (≥26); żadna nie wywala error-boundary; nieobecny komponent pomijany (guard).
- **GRAFIKA:** Aktywna sekcja podświetlona; treść spójna typograficznie; puste sekcje = kulturalny placeholder.
- **Screenshot:** `docs/qa/screens/m13-exec/initiatives/ini-10-26-sections-nav.png`
- **OCENA:** (a) wszystkie zarejestrowane bez crash; (b) aktywny stat nav + placeholdery kanon.
- **Wykonanie:** Headless ✅ · do-build

### INI-11 — Dokument: edycja pola + autosave (debounce)
- **Powierzchnia:** `InitiativeDocumentView.tsx` (autosaveTimerRef) · **Typ:** persist-po-reload
- **Precondition/seed:** Seeded inicjatywa; openDoc; sekcja initiative-definition.
- **Kroki:** 1. Edytuj summary/problem. 2. Odczekaj autosave. 3. Reload doc.
- **JAKOŚĆ:** Po debounce PATCH/PUT; zmiana persystuje; jeśli reload przed autosave — local-draft (localStorage) odtwarza; brak utraty.
- **GRAFIKA:** Wskaźnik zapisu neutralny; pole zachowuje wartość; brak remount-flicker.
- **Screenshot:** `docs/qa/screens/m13-exec/initiatives/ini-11-autosave-persist.png`
- **OCENA:** (a) edycja przetrwa reload (server/draft); (b) wskaźnik neutralny + brak flicker.
- **Wykonanie:** Headless ✅ · do-build

### INI-12 — Dokument: drag-reorder sekcji persystuje
- **Powierzchnia:** `InitiativeDocumentView.tsx` (onSectionReorder, SortableNavItem) · **Typ:** persist-po-reload
- **Precondition/seed:** Seeded inicjatywa; ≥3 sekcje.
- **Kroki:** 1. Przeciągnij sekcję wyżej. 2. Nowa kolejność. 3. Reload.
- **JAKOŚĆ:** Reorder zapisany (PATCH order); po reloadzie kolejność zachowana; brak duplikacji/utraty.
- **GRAFIKA:** Drag-handle na hover, podgląd przesunięcia, nav w nowej kolejności bez glitchy.
- **Screenshot:** `docs/qa/screens/m13-exec/initiatives/ini-12-section-reorder.png`
- **OCENA:** (a) kolejność przetrwa reload; (b) DnD płynny bez utraty.
- **Wykonanie:** Headless 🟡 · real-browser

### INI-13 — Dokument: AI-fill pustej sekcji (financial)
- **Powierzchnia:** `InitiativeDocumentView.tsx` (financial AI-fill, K4 fill-empty) · **Typ:** happy-path
- **Precondition/seed:** Pusta financial-analysis; org z kluczem AI lub mock SSE.
- **Kroki:** 1. Sekcja financial. 2. „Wypełnij AI". 3. Wynik + quality-check.
- **JAKOŚĆ:** AI-fill generuje draft; PASS≥90 zielone; no-op sekcje (SECTION_AI_NOOP) disabled, brak żądania; autosave utrwala.
- **GRAFIKA:** Loading podczas generacji; quality-badge zielony/amber wg progu; no-op disabled.
- **Screenshot:** `docs/qa/screens/m13-exec/initiatives/ini-13-ai-fill-financial.png`
- **OCENA:** (a) treść + autosave; (b) badge zielony/amber wg progu.
- **Wykonanie:** Headless 🟡 · do-build

### INI-14 — Submit for Review (DRAFT→PENDING_REVIEW) z uprawnieniem
- **Powierzchnia:** `updateInitiativeStatus`, handleStatusChange · **Typ:** happy-path
- **Precondition/seed:** DRAFT; rola CONSULTANT/INITIATIVE_OWNER.
- **Kroki:** 1. Dokument. 2. „Wyślij do przeglądu". 3. Status+historia.
- **JAKOŚĆ:** Preflight `canCurrentUserExecute=true`, brak blockingItems → PATCH 200; DRAFT→PENDING_REVIEW; toast; fetchData; wpis historii.
- **GRAFIKA:** Badge slate→amber; akcje aktualizują się do PENDING_REVIEW; bez danger.
- **Screenshot:** `docs/qa/screens/m13-exec/initiatives/ini-14-submit-review.png`
- **OCENA:** (a) status + toast sukcesu; (b) badge amber + nowe akcje.
- **Wykonanie:** Headless ✅ · do-build

### INI-15 — Reject (REVIEW→DRAFT) wymaga powodu
- **Powierzchnia:** getStatusActions REJECT (requiresReason) · **Typ:** walidacja
- **Precondition/seed:** REVIEW; rola PROJECT_SPONSOR/STEERING_COMMITTEE.
- **Kroki:** 1. „Odrzuć". 2. Bez powodu, potem z powodem.
- **JAKOŚĆ:** Reject `requiresReason:true variant:'danger'`; bez powodu blokada; z powodem PATCH 200; powód w historii; rola spoza ACCEPT/REJECT→403.
- **GRAFIKA:** „Odrzuć" danger (akcja destrukcyjna OK); modal powodu, confirm disabled gdy pole puste; status slate.
- **Screenshot:** `docs/qa/screens/m13-exec/initiatives/ini-15-reject-reason.png`
- **OCENA:** (a) brak powodu blokuje, powód zapisany; (b) danger tylko na akcji Reject.
- **Wykonanie:** Headless ✅ · do-build

### INI-16 — Brak uprawnień do bramki → 403 + toast
- **Powierzchnia:** handleStatusChange (canExecute false), 403 · **Typ:** rola/uprawnienia
- **Precondition/seed:** PROMOTED; user bez roli START_PLANNING.
- **Kroki:** 1. Dokument. 2. „Rozpocznij planowanie". 3. Komunikat.
- **JAKOŚĆ:** Preflight `canExecute=false` → toast `statusNotAllowed`, brak PATCH; wymuszony PATCH → 403 z required roles; status PROMOTED.
- **GRAFIKA:** Akcja `variant:'disabled'` (wyszarzona) lub toast; bez czerwieni alarmowej; badge bez zmian.
- **Screenshot:** `docs/qa/screens/m13-exec/initiatives/ini-16-gate-rbac-403.png`
- **OCENA:** (a) brak zmiany + komunikat uprawnień; (b) akcja disabled bez danger-fill.
- **Wykonanie:** Headless ✅ · do-build

### INI-17 — Gate soft-block (AI advisory) wymaga overrideReason
- **Powierzchnia:** `gateAiSoftBlocks` · **Typ:** edge
- **Precondition/seed:** Flaga AI ON; readiness poniżej progu/blocking timeline; rola OK.
- **Kroki:** 1. Przejście bez overrideReason. 2. Odpowiedź. 3. Z overrideReason.
- **JAKOŚĆ:** Bez override → 422 SOFT_BLOCK „provide overrideReason"; z override → przejście + telemetria `overridden:true`+reason; AI fail-open → soft-block pominięty.
- **GRAFIKA:** Modal/inline prośby o uzasadnienie (amber, nie danger-fill); lista braków; po override toast.
- **Screenshot:** `docs/qa/screens/m13-exec/initiatives/ini-17-soft-block-override.png`
- **OCENA:** (a) override wymagany+akceptowany, telemetria; (b) advisory amber nie alarm.
- **Wykonanie:** Headless 🟡 · do-build

### INI-18 — Gate hard-block (blocking readiness) zatrzymuje przejście
- **Powierzchnia:** `getBlockingReadinessItems` · **Typ:** błąd/walidacja
- **Precondition/seed:** Bramka z niespełnionymi blocking items; rola OK.
- **Kroki:** 1. Przejście. 2. Lista blokad. 3. Status bez zmian.
- **JAKOŚĆ:** Preflight `blockingItems>0` → toast `gateBlockedHub` (max 5); brak PATCH; wymuszony → „Gate readiness check failed" + missing[]; status bez zmian.
- **GRAFIKA:** Lista missing z markerem blocking (amber/severity); punktowana; bez stack-trace.
- **Screenshot:** `docs/qa/screens/m13-exec/initiatives/ini-18-hard-block.png`
- **OCENA:** (a) transition zablokowany + lista missing; (b) lista wg severity.
- **Wykonanie:** Headless ✅ · do-build

### INI-19 — Mark Blocked → Unblock (EXECUTING↔BLOCKED) z powodem
- **Powierzchnia:** getStatusActions BLOCK/UNBLOCK · **Typ:** happy-path
- **Precondition/seed:** EXECUTING; rola INITIATIVE_OWNER/PMO (BLOCK), SPONSOR (UNBLOCK).
- **Kroki:** 1. „Oznacz zablokowane"+powód. 2. BLOCKED. 3. „Odblokuj"→EXECUTING.
- **JAKOŚĆ:** BLOCK PATCH 200 + CRITICAL escalation (pojedyncza notyfikacja, nie dubel); UNBLOCK PATCH 200; obie w historii.
- **GRAFIKA:** BLOCKED badge danger (jedyny danger-fill); health RAG red; po unblock blue EXECUTING; bez podwójnych toastów.
- **Screenshot:** `docs/qa/screens/m13-exec/initiatives/ini-19-block-unblock.png`
- **OCENA:** (a) oba przejścia + pojedyncza CRITICAL; (b) danger tylko na BLOCKED.
- **Wykonanie:** Headless ✅ · do-build

### INI-20 — Complete → Tracking → Archive (ścieżka końcowa)
- **Powierzchnia:** lifecycle DONE→TRACKING→ARCHIVED · **Typ:** happy-path
- **Precondition/seed:** EXECUTING bez blocking; role COMPLETE/START_TRACKING.
- **Kroki:** 1. →DONE. 2. →TRACKING. 3. →ARCHIVED.
- **JAKOŚĆ:** 3 PATCH 200 wg VALID_TRANSITIONS; DONE→tylko TRACKING; TRACKING→tylko ARCHIVED; ARCHIVED terminalny; progress 90→100.
- **GRAFIKA:** Badge green→blue→slate-600; progress rośnie; ARCHIVED bez forward; bez danger.
- **Screenshot:** `docs/qa/screens/m13-exec/initiatives/ini-20-done-tracking-archive.png`
- **OCENA:** (a) 3 przejścia zgodne + ARCHIVED terminalny; (b) progresja kolorów wg metadanych.
- **Wykonanie:** Headless ✅ · do-build

### INI-21 — Cancel z dowolnego aktywnego stanu (terminalny)
- **Powierzchnia:** lifecycle CANCEL gate · **Typ:** edge
- **Precondition/seed:** PLANNING/EXECUTING/SCHEDULED; rola PMO/STEERING.
- **Kroki:** 1. „Anuluj"+powód. 2. CANCELLED. 3. Moduł initiatives.
- **JAKOŚĆ:** Cancel PATCH 200 z dowolnego z 9 stanów; →CANCELLED; `getModuleForStatus(CANCELLED)='initiatives'`; CANCELLED→tylko ARCHIVED; powód w historii.
- **GRAFIKA:** „Anuluj" danger (OK); badge CANCELLED gray wyciszony (nie czerwony); karta przygaszona.
- **Screenshot:** `docs/qa/screens/m13-exec/initiatives/ini-21-cancel-terminal.png`
- **OCENA:** (a) cancel z aktywnych + tylko →ARCHIVED; (b) CANCELLED gray, nie danger-fill.
- **Wykonanie:** Headless ✅ · do-build

### INI-22 — Niedozwolone przejście odrzucone (DRAFT→EXECUTING)
- **Powierzchnia:** isValidTransition, transition guard · **Typ:** błąd/walidacja
- **Precondition/seed:** DRAFT; admin (omija RBAC nie mapę).
- **Kroki:** 1. PATCH `status=EXECUTING`. 2. Odpowiedź. 3. Brak zmiany.
- **JAKOŚĆ:** 403/400 bo `isValidTransition(DRAFT,EXECUTING)=false`; status DRAFT; ADMIN nie przeskakuje mapy.
- **GRAFIKA:** UI nie oferuje przycisku (tylko valid next); wymuszenie → toast neutralny; badge bez zmian.
- **Screenshot:** `docs/qa/screens/m13-exec/initiatives/ini-22-invalid-transition.png`
- **OCENA:** (a) 4xx + status niezmieniony; (b) UI nie eksponuje skoku.
- **Wykonanie:** Headless ✅ · do-build

### INI-23 — Lista §27: kolumny, next-step, health, sortowanie
- **Powierzchnia:** PortfolioListView, getNextStep/getHealthInfo · **Typ:** happy-path
- **Precondition/seed:** ≥8 inicjatyw: BLOCKED, overdue, riskScore≥7, terminalna.
- **Kroki:** 1. viewMode „table". 2. Kolumny+wskaźniki. 3. Sortuj.
- **JAKOŚĆ:** Tabela §27 (checkbox/name/status/priority/owner/next-step/health/updated); health RAG (BLOCKED/overdue→red, ≤7dni/risk≥7→amber, terminal→grey, reszta green); sort stabilny.
- **GRAFIKA:** Kropki health emerald/amber/danger/slate; danger-dot tylko red; zebra/hover §27; dark/light.
- **Screenshot:** `docs/qa/screens/m13-exec/initiatives/ini-23-list-section27.png`
- **OCENA:** (a) next-step/health wg helperów; (b) RAG-dot wg poziomu, danger tylko red.
- **Wykonanie:** Headless ✅ · do-build

### INI-24 — Kanban DnD zmienia status między kolumnami
- **Powierzchnia:** PortfolioKanbanView, handleStatusChange · **Typ:** współbieżność/race
- **Precondition/seed:** PROMOTED→PLANNING; rola START_PLANNING.
- **Kroki:** 1. Kanban active. 2. Drag PROMOTED→PLANNING. 3. Reload+persist.
- **JAKOŚĆ:** Drop → handleStatusChange + preflight + PATCH; niedozwolona kolumna → karta wraca + toast; brak uprawnień → odrzucony; po reload karta w nowej kolumnie.
- **GRAFIKA:** Ghost karty + podświetlenie docelowej; po dropie nowy status; bez migotania/duplikatu; bez danger poza BLOCKED.
- **Screenshot:** `docs/qa/screens/m13-exec/initiatives/ini-24-kanban-dnd.png`
- **OCENA:** (a) valid persystuje, invalid odrzucony; (b) DnD afordancje czytelne.
- **Wykonanie:** Headless ❌ · real-browser

### INI-25 — Timeline/Gantt renderuje zadania z datami
- **Powierzchnia:** InitiativesTimelineView, seedTasks · **Typ:** duże dane
- **Precondition/seed:** + seedTasks (3 zadania lipiec 2026) lub ≥20.
- **Kroki:** 1. viewMode „timeline". 2. Paski Gantt. 3. Skala+scroll.
- **JAKOŚĆ:** Timeline bound po initiativeId; paski wg start/due; brak dat nie wywala; ≥20 bez zawieszenia.
- **GRAFIKA:** Oś miesięcy, paski wg statusu/priorytetu (nie danger domyślnie), etykiety czytelne, scroll-x; dark/light.
- **Screenshot:** `docs/qa/screens/m13-exec/initiatives/ini-25-timeline-gantt.png`
- **OCENA:** (a) paski wg dat + brak crash; (b) oś+paski czytelne.
- **Wykonanie:** Headless 🟡 · do-build

### INI-26 — Widok Grid: karty z metrykami i kebab §9
- **Powierzchnia:** InitiativeGridCard, handleOpenDocument · **Typ:** happy-path
- **Precondition/seed:** ≥6 inicjatyw zróżnicowanych.
- **Kroki:** 1. viewMode „grid". 2. Karty. 3. Kebab → Open/Archive/Delete.
- **JAKOŚĆ:** Karty: tytuł/status/priorytet/owner/next-step/health; kebab §9: Open full, Archive (tylko DONE/CANCELLED), Delete (confirm→DELETE); Archive na niekwalifikującym → błąd/disabled.
- **GRAFIKA:** Siatka responsywna; karty równej wysokości; kebab §9 z Delete w danger; badge bez danger-fill.
- **Screenshot:** `docs/qa/screens/m13-exec/initiatives/ini-26-grid-kebab.png`
- **OCENA:** (a) kebab działa + Archive respektuje status; (b) siatka równa + kebab §9.
- **Wykonanie:** Headless ✅ · do-build

### INI-27 — Analysis tab: portfolio quality gate
- **Powierzchnia:** PortfolioAnalysisView · **Typ:** happy-path
- **Precondition/seed:** ≥8 inicjatyw mix wypełnienia.
- **Kroki:** 1. „Analysis". 2. Subview. 3. Open z analizy.
- **JAKOŚĆ:** Analysis ukrywa viewMody; metryki portfela; chipsy subview Menu 3; onOpenInitiative→preview; quick-update undefined dla pilota; zmiana tab czyści activeDocumentId.
- **GRAFIKA:** Wykresy czytelne; chipy active/inactive (Menu 3); tokeny, bez danger; dark/light.
- **Screenshot:** `docs/qa/screens/m13-exec/initiatives/ini-27-analysis-tab.png`
- **OCENA:** (a) metryki+subview+open; (b) chipy/wykresy kanon.
- **Wykonanie:** Headless ✅ · do-build

### INI-28 — i18n PL/EN spójne w hubie i dokumencie
- **Powierzchnia:** Hub+dokument (labelPl/label) · **Typ:** i18n
- **Precondition/seed:** Seeded inicjatywa; PL i EN.
- **Kroki:** 1. Hub PL→EN. 2. Dokument+akcje. 3. Porównaj etykiety.
- **JAKOŚĆ:** Akcje statusu labelPl/label; kolumny/taby/empty/toasty z kluczy (zero gołych `initiatives.*`); daty/liczby wg locale.
- **GRAFIKA:** Brak ucięć w PL; layout stabilny; przyciski nie łamią się.
- **Screenshot:** `docs/qa/screens/m13-exec/initiatives/ini-28-i18n-pl-en.png`
- **OCENA:** (a) zero gołych kluczy + poprawne akcje; (b) brak overflow PL/EN.
- **Wykonanie:** Headless ✅ · do-build

### INI-29 — Pilot participant: read-only
- **Powierzchnia:** Hub (isPilotParticipant, dispatchPilotAccessBlocked) · **Typ:** rola/uprawnienia
- **Precondition/seed:** Pilot-participant; org z inicjatywami.
- **Kroki:** 1. `/portfolio`. 2. Brak CTA/bulk. 3. Próba status/quick-update.
- **JAKOŚĆ:** Brak bulk-edit; modale closed; handleStatusChange/QuickUpdate/BulkApply → dispatchPilotAccessBlocked, brak PATCH; deep-link new blokowany; tylko podgląd.
- **GRAFIKA:** Brak przycisków tworzenia/edycji; blokada neutralna; brak martwych CTA.
- **Screenshot:** `docs/qa/screens/m13-exec/initiatives/ini-29-pilot-readonly.png`
- **OCENA:** (a) żadna mutacja + CTA ukryte; (b) blokada kanon, brak martwych CTA.
- **Wykonanie:** Headless ✅ · do-build

### INI-30 — Org-scope izolacja + a11y/responsywność/konsola
- **Powierzchnia:** Controller orgId scoping (403), Hub responsywność · **Typ:** org-scope+a11y+responsive+konsola
- **Precondition/seed:** Orgi A/B; inicjatywa w A; viewporty 1680/1024/390.
- **Kroki:** 1. User B otwiera `?open=<idA>`. 2. User A hub→doc 3 viewporty. 3. Konsola+a11y.
- **JAKOŚĆ:** Cross-org → 403/404; w org A 200; zero błędów konsoli; banner `role="alert"`; section-nav klawiaturą.
- **GRAFIKA:** 1680 split, 1024 zwężony, 390 mobile (scroll-x kanban, single-column doc); focus-ring; kontrast AA dark/light; bez overflow 390.
- **Screenshot:** `docs/qa/screens/m13-exec/initiatives/ini-30-orgscope-a11y-responsive.png`
- **OCENA:** (a) cross-org zablokowany + konsola czysta; (b) 3 viewporty bez overflow + focus-ring.
- **Wykonanie:** Headless 🟡 · real-browser

---

# ARTEFAKT 2 — DECYZJE (DEC-01…30)

> Powierzchnie: `DecisionsSection.tsx` (rejestr, GO_NO_GO, banner gate-blocking, sort), `DecisionController` (guard decision_impacts), korelacja z maszyną stanów (`hasApprovedGateDecision` na `pmo_domain`). KLUCZOWE: banner FE keyuje po `type='GO_NO_GO'`, gate serwerowy po `pmo_domain` — seed musi ustawić oba.

### DEC-01 — Happy: utworzenie decyzji ogólnej (CRUD create)
- **Powierzchnia:** DecisionsSection (modal create) → `POST /api/decisions` · **Typ:** happy CRUD
- **Precondition/seed:** User z `approve_changes`, inicjatywa REVIEW, zakładka Decyzje.
- **Kroki:** 1. „Nowa". 2. Tytuł/opis/typ GENERAL/priorytet/owner. 3. Zatwierdź.
- **JAKOŚĆ:** POST `relatedObjectId=initiativeId`, `relatedObjectType='initiative'`, `status:'PENDING'`, `decisionType:'GENERAL'`; 201; wiersz dopisany; toast; `decision_history` action='created'; org-scope z tokena.
- **GRAFIKA:** Modal zamknięty; wiersz z dot amber-pulse (PENDING); kolumny wypełnione; brak badge GATE; kanon.
- **Screenshot:** `docs/qa/screens/m13-exec/decisions/dec-01-create-happy.png`
- **OCENA:** (a) 201 + persist + PENDING + history; (b) wiersz czytelny, dot amber-pulse.
- **Wykonanie:** Headless 🟡 · real-browser

### DEC-02 — Utworzenie decyzji GO_NO_GO (badge GATE)
- **Powierzchnia:** DecisionsSection (create GO_NO_GO) · **Typ:** typ GO_NO_GO
- **Precondition/seed:** Inicjatywa REVIEW; brak innych GO_NO_GO.
- **Kroki:** 1. Modal. 2. Typ „Go/No-Go". 3. Tytuł/owner/due, zatwierdź.
- **JAKOŚĆ:** POST `type='GO_NO_GO'`; `GATE_TYPES.has('GO_NO_GO')`; wiersz na górę (gate-first); PENDING GO_NO_GO → gateBlockingDecisions.
- **GRAFIKA:** Wiersz na górze z badge GATE (primary-500/20); banner bramki nad tabelą (amber, ikona Scale).
- **Screenshot:** `docs/qa/screens/m13-exec/decisions/dec-02-gonogo-create.png`
- **OCENA:** (a) GO_NO_GO + sort góra + w gateBlocking; (b) badge GATE primary, nie danger.
- **Wykonanie:** Headless 🟡 · real-browser

### DEC-03 — Inne typy (Budget/Scope/Risk) — etykiety i mapowanie
- **Powierzchnia:** DecisionsSection (DECISION_TYPE_LABELS) · **Typ:** inne typy
- **Precondition/seed:** 3 decyzje: BUDGET_APPROVAL/SCOPE_CHANGE/RISK_ACCEPTANCE.
- **Kroki:** 1. Zakładka. 2. Kolumna Typ. 3. PL/EN.
- **JAKOŚĆ:** Etykiety wg DECISION_TYPE_LABELS; te typy NIE w GATE_TYPES → bez badge GATE; brak bannera (nie GO_NO_GO).
- **GRAFIKA:** Kolumna Typ czytelna; brak GATE; dot wg configu; i18n bez raw keys.
- **Screenshot:** `docs/qa/screens/m13-exec/decisions/dec-03-other-types.png`
- **OCENA:** (a) etykiety zmapowane + brak GATE/banner; (b) czytelne, i18n bez raw keys.
- **Wykonanie:** Headless ✅ · do-build (seed-spec)

### DEC-04 — Status flow PENDING→APPROVED (decide approve)
- **Powierzchnia:** decision-panel → `POST /decisions/:id/decide` · **Typ:** status flow
- **Precondition/seed:** Decyzja PENDING, owner=zalogowany, due.
- **Kroki:** 1. Open. 2. Approve+rationale. 3. Reload.
- **JAKOŚĆ:** decide `status:'approved'`+rationale → 200; serwer wymaga rationale (400 bez); history action='approved'; approvedCount rośnie; blocker→odblokowanie.
- **GRAFIKA:** Dot emerald (APPROVED); wiersz niżej w sortowaniu.
- **Screenshot:** `docs/qa/screens/m13-exec/decisions/dec-04-approve.png`
- **OCENA:** (a) 200 APPROVED + history + persist; (b) dot emerald.
- **Wykonanie:** Headless 🟡 · real-browser

### DEC-05 — Banner gate-blocking gdy PENDING GO_NO_GO
- **Powierzchnia:** DecisionsSection banner (gateBlockingDecisions) · **Typ:** banner gate-blocking
- **Precondition/seed:** ≥1 decyzja GO_NO_GO PENDING.
- **Kroki:** 1. Zakładka. 2. Banner nad tabelą.
- **JAKOŚĆ:** gateBlockingDecisions = `type==='GO_NO_GO' && PENDING`; banner z klikalną listą tytułów (onOpenDecision); PL „Decyzja bramki — wymagana przed promocją".
- **GRAFIKA:** Ramka amber-300/60, tło amber-50/70 (nie danger), ikona Scale amber-600, dot amber-pulse.
- **Screenshot:** `docs/qa/screens/m13-exec/decisions/dec-05-banner-pending.png`
- **OCENA:** (a) banner tylko PENDING GO_NO_GO + tytuły klikalne; (b) amber nie czerwień.
- **Wykonanie:** Headless 🟡 · real-browser

### DEC-06 — Banner znika po APPROVED GO_NO_GO
- **Powierzchnia:** DecisionsSection banner · **Typ:** banner znika
- **Precondition/seed:** Jedyna GO_NO_GO PENDING; banner widoczny.
- **Kroki:** 1. Open GO_NO_GO. 2. Approve+rationale. 3. Lista.
- **JAKOŚĆ:** Po APPROVED wypada z gateBlockingDecisions; banner znika (`length===0`).
- **GRAFIKA:** Banner zniknięty; wiersz GO_NO_GO z badge GATE ale dot emerald.
- **Screenshot:** `docs/qa/screens/m13-exec/decisions/dec-06-banner-gone.png`
- **OCENA:** (a) banner znika gdy 0 PENDING GO_NO_GO; (b) brak amber bannera, badge GATE zostaje.
- **Wykonanie:** Headless 🟡 · real-browser

### DEC-07 — Sortowanie: decyzje GATE na górze
- **Powierzchnia:** sortedDecisions memo · **Typ:** sortowanie
- **Precondition/seed:** 2 GENERAL, 1 GO_NO_GO, 1 RESOURCE_RESPONSIBILITY, 1 SCHEDULE_MILESTONES; różne due.
- **Kroki:** 1. Zakładka. 2. Kolejność.
- **JAKOŚĆ:** GATE_TYPES na górze, potem nie-gate; PENDING przed APPROVED/REJECTED; potem due rosnąco.
- **GRAFIKA:** Górne wiersze z badge GATE; dot-pulse PENDING wyżej.
- **Screenshot:** `docs/qa/screens/m13-exec/decisions/dec-07-sort-gate-top.png`
- **OCENA:** (a) gate→pending→due; (b) GATE-badge wiersze na górze.
- **Wykonanie:** Headless ✅ · do-build

### DEC-08 — Sortowanie: PENDING przed APPROVED (nie-gate)
- **Powierzchnia:** sortedDecisions · **Typ:** sortowanie
- **Precondition/seed:** 4 GENERAL: 2 PENDING (różne due), 2 APPROVED.
- **Kroki:** 1. Lista. 2. Kolejność.
- **JAKOŚĆ:** PENDING/ESCALATED/DEFERRED przed APPROVED/REJECTED; due rosnąco (brak due=na końcu).
- **GRAFIKA:** Dwa pulse-dot przed emerald; bez due na końcu grupy.
- **Screenshot:** `docs/qa/screens/m13-exec/decisions/dec-08-sort-pending-first.png`
- **OCENA:** (a) PENDING przed APPROVED, due-asc; (b) dot-pulse wyżej.
- **Wykonanie:** Headless ✅ · do-build

### DEC-09 — REVIEW→PROMOTED zablokowane bez approved GO_NO_GO
- **Powierzchnia:** updateInitiativeStatus (`hasApprovedGateDecision('GOVERNANCE_DECISION_MAKING')`) · **Typ:** korelacja
- **Precondition/seed:** Inicjatywa REVIEW; GO_NO_GO PENDING (lub brak owner/due/pmo_domain).
- **Kroki:** 1. Promuj REVIEW→PROMOTED. 2. Odpowiedź.
- **JAKOŚĆ:** Gate filtruje po `pmo_domain='GOVERNANCE_DECISION_MAKING'` AND approved AND owner AND deadline; brak → odrzucone (gate w metadata); status REVIEW. UWAGA dekorelacja: seed musi mieć `pmo_domain`, inaczej gate nigdy nie przejdzie.
- **GRAFIKA:** Komunikat blokady przy CTA; banner gate amber nadal; status w nagłówku bez zmian.
- **Screenshot:** `docs/qa/screens/m13-exec/decisions/dec-09-review-promoted-blocked.png`
- **OCENA:** (a) zablokowane bez approved gate + status niezmieniony; (b) komunikat blokady widoczny.
- **Wykonanie:** Headless ✅ · do-build (integration)

### DEC-10 — REVIEW→PROMOTED dozwolone po approved GO_NO_GO+owner+due
- **Powierzchnia:** updateInitiativeStatus · **Typ:** korelacja happy
- **Precondition/seed:** REVIEW; decyzja `pmo_domain=GOVERNANCE_DECISION_MAKING` approved+owner+deadline.
- **Kroki:** 1. Promuj. 2. Status.
- **JAKOŚĆ:** hasApprovedGateDecision=true → PROMOTED; notyfikacja/audit.
- **GRAFIKA:** Nagłówek PROMOTED; banner zniknął; brak blokady.
- **Screenshot:** `docs/qa/screens/m13-exec/decisions/dec-10-review-promoted-ok.png`
- **OCENA:** (a) status→PROMOTED przy spełnionym gate; (b) nagłówek zaktualizowany.
- **Wykonanie:** Headless ✅ · do-build

### DEC-11 — PROMOTED→PLANNING zablokowane bez Resources Commit
- **Powierzchnia:** updateInitiativeStatus (`RESOURCE_RESPONSIBILITY`) · **Typ:** korelacja
- **Precondition/seed:** PROMOTED; brak approved RESOURCE_RESPONSIBILITY.
- **Kroki:** 1. Promuj. 2. Odpowiedź.
- **JAKOŚĆ:** Odrzucone (gate='RESOURCE_RESPONSIBILITY'); status PROMOTED; reason Resources Commit.
- **GRAFIKA:** Komunikat blokady; status bez zmian.
- **Screenshot:** `docs/qa/screens/m13-exec/decisions/dec-11-promoted-planning-blocked.png`
- **OCENA:** (a) blok bez RESOURCE approved; (b) komunikat czytelny.
- **Wykonanie:** Headless ✅ · do-build

### DEC-12 — PROMOTED→PLANNING dozwolone po Resources Commit
- **Powierzchnia:** updateInitiativeStatus · **Typ:** korelacja happy
- **Precondition/seed:** PROMOTED; RESOURCE_RESPONSIBILITY approved+owner+deadline.
- **Kroki:** 1. Promuj.
- **JAKOŚĆ:** Gate spełniony → PLANNING; persist+audit.
- **GRAFIKA:** Nagłówek PLANNING; decyzja Resources Commit badge GATE dot emerald.
- **Screenshot:** `docs/qa/screens/m13-exec/decisions/dec-12-promoted-planning-ok.png`
- **OCENA:** (a) status→PLANNING; (b) nagłówek + badge GATE emerald.
- **Wykonanie:** Headless ✅ · do-build

### DEC-13 — APPROVED→SCHEDULED zablokowane bez Schedule Lock
- **Powierzchnia:** updateInitiativeStatus (`SCHEDULE_MILESTONES`) · **Typ:** korelacja
- **Precondition/seed:** APPROVED; brak approved SCHEDULE_MILESTONES.
- **Kroki:** 1. Promuj. 2. Odpowiedź.
- **JAKOŚĆ:** Odrzucone (SCHEDULE_MILESTONES_REQUIRED); status APPROVED; dodatkowo wymóg dat start/koniec.
- **GRAFIKA:** Komunikat blokady „Blokada harmonogramu"; status bez zmian.
- **Screenshot:** `docs/qa/screens/m13-exec/decisions/dec-13-approved-scheduled-blocked.png`
- **OCENA:** (a) blok bez SCHEDULE approved; (b) komunikat czytelny.
- **Wykonanie:** Headless ✅ · do-build

### DEC-14 — Powiązanie decyzja↔inicjatywa: persist po reload
- **Powierzchnia:** DecisionsSection ↔ `GET /decisions?initiativeId=` · **Typ:** persist
- **Precondition/seed:** Świeżo utworzona decyzja.
- **Kroki:** 1. Utwórz. 2. F5. 3. Zakładka Decyzje.
- **JAKOŚĆ:** GET z filtrem initiativeId; decyzja z tym id, relatedObjectType/Id; getDecisions zwraca decisionType/status(uppercase)/ownerName.
- **GRAFIKA:** Identyczny wiersz; brak utraty/migotania.
- **Screenshot:** `docs/qa/screens/m13-exec/decisions/dec-14-persist-reload.png`
- **OCENA:** (a) decyzja wraca z GET po reload; (b) wiersz identyczny.
- **Wykonanie:** Headless 🟡 · real-browser

### DEC-15 — Org-scope / cross-org izolacja decyzji
- **Powierzchnia:** DecisionController.getDecisions/getById (organization_id) · **Typ:** org-scope
- **Precondition/seed:** Decyzja D w org A; user org B.
- **Kroki:** 1. Org B: list + getById(idD). 2. decide/update na idD.
- **JAKOŚĆ:** Lista B nie pokazuje D; getById 404 cross-org; decide/update scoped → 404; brak wycieku.
- **GRAFIKA:** Lista B bez D; deep-link → 404/empty zamiast cudzych danych.
- **Screenshot:** `docs/qa/screens/m13-exec/decisions/dec-15-org-scope.png`
- **OCENA:** (a) D niewidoczna + 404 cross-org; (b) brak obcych danych.
- **Wykonanie:** Headless ✅ · do-build (integration)

### DEC-16 — Guard decision_impacts: lista nie pusta przy braku tabeli
- **Powierzchnia:** DecisionController.getDecisions (getTableColumns) · **Typ:** guard schema-drift
- **Precondition/seed:** Decyzje istnieją, brak `decision_impacts`.
- **Kroki:** 1. GET decisions. 2. Długość + blockedItemsCount.
- **JAKOŚĆ:** `hasDecisionImpacts=false` → `blockedItemsCountSelect='0'`; subquery pominięty → lista NIE pusta; finding subquery-silent-empty obroniony.
- **GRAFIKA:** Tabela pełna; licznik blokerów=0; bez błędu.
- **Screenshot:** `docs/qa/screens/m13-exec/decisions/dec-16-impacts-guard.png`
- **OCENA:** (a) lista>0 + blockedItemsCount=0; (b) tabela renderuje wiersze.
- **Wykonanie:** Headless ✅ · `tests/integration/initiatives/decisions-crud.test.ts`

### DEC-17 — Walidacja: pusty tytuł blokuje utworzenie
- **Powierzchnia:** handleCreateDecision + createDecision (400) · **Typ:** walidacja
- **Precondition/seed:** Modal create.
- **Kroki:** 1. Pusty/whitespace tytuł. 2. Zatwierdź.
- **JAKOŚĆ:** FE `!trim() return` — brak POST; serwer `!title` → 400; brak wiersza/history.
- **GRAFIKA:** „Utwórz" bez efektu; modal otwarty; hint; brak fałszywego sukcesu.
- **Screenshot:** `docs/qa/screens/m13-exec/decisions/dec-17-empty-title.png`
- **OCENA:** (a) brak POST/400 + brak wiersza; (b) modal otwarty.
- **Wykonanie:** Headless 🟡 · real-browser

### DEC-18 — Walidacja: brak kontekstu (initiativeId)
- **Powierzchnia:** handleCreateDecision / createDecision (400 „Missing decision context") · **Typ:** walidacja
- **Precondition/seed:** Brak initiative.id lub POST bez project/initiative/task.
- **Kroki:** 1. Create bez initiativeId. 2. Obserwuj.
- **JAKOŚĆ:** FE toast missingInitiativeId, brak POST; serwer 400 „Missing decision context"; brak wiersza.
- **GRAFIKA:** Toast danger; modal nie zamyka się; brak wiersza.
- **Screenshot:** `docs/qa/screens/m13-exec/decisions/dec-18-missing-context.png`
- **OCENA:** (a) toast/400 + brak persistu; (b) toast danger czytelny.
- **Wykonanie:** Headless ✅ · do-build

### DEC-19 — Edycja decyzji (tytuł/owner/due/priority)
- **Powierzchnia:** decision-panel → updateDecision · **Typ:** edycja
- **Precondition/seed:** PENDING, created_by=zalogowany/ADMIN.
- **Kroki:** 1. Open. 2. Zmień pola. 3. Zapisz+reload.
- **JAKOŚĆ:** Dynamiczny SET tylko przekazane pola; history='updated'; permission created_by/ADMIN (else 403); brak pól → „No changes applied".
- **GRAFIKA:** Po reloadzie nowe wartości; priorytet HIGH→amber-500; dot bez zmiany jeśli status nietknięty.
- **Screenshot:** `docs/qa/screens/m13-exec/decisions/dec-19-edit.png`
- **OCENA:** (a) pola persist + history + 403 nie-autor; (b) zmiany widoczne.
- **Wykonanie:** Headless 🟡 · real-browser

### DEC-20 — Usuwanie decyzji
- **Powierzchnia:** DecisionsSection row menu „Usuń" → handleRemove · **Typ:** usuwanie
- **Precondition/seed:** ≥2 decyzje; nie readonly.
- **Kroki:** 1. Menu. 2. „Usuń". 3. Reload.
- **JAKOŚĆ:** handleRemoveDecision; wiersz znika; po reload nieobecna; org-scope DELETE; bloker→odblokowanie.
- **GRAFIKA:** Menu zamyka się; AnimatePresence wygasza wiersz; „Usuń" tylko `!readonly`, danger-500.
- **Screenshot:** `docs/qa/screens/m13-exec/decisions/dec-20-delete.png`
- **OCENA:** (a) usunięty + nieobecny po reload; (b) animacja + opcja danger.
- **Wykonanie:** Headless 🟡 · real-browser

### DEC-21 — Pusty stan rejestru decyzji
- **Powierzchnia:** DecisionsSection (sortedDecisions.length===0) · **Typ:** pusty stan
- **Precondition/seed:** Inicjatywa bez decyzji.
- **Kroki:** 1. Zakładka.
- **JAKOŚĆ:** `decisions.length===0` → nagłówek bez licznika/inline-add; EmptyStateInline z CTA; brak bannera.
- **GRAFIKA:** Pusty stan ikona+komunikat+CTA; brak tabeli-sieroty; kanon.
- **Screenshot:** `docs/qa/screens/m13-exec/decisions/dec-21-empty.png`
- **OCENA:** (a) empty-state zamiast pustej tabeli + CTA; (b) ikona+tekst+CTA kanon.
- **Wykonanie:** Headless ✅ · do-build

### DEC-22 — Błąd/fallback przy create (POST 500/network)
- **Powierzchnia:** handleCreateDecision catch · **Typ:** błąd/fallback
- **Precondition/seed:** Backend 500/timeout na POST.
- **Kroki:** 1. Wypełnij modal. 2. Zatwierdź przy błędzie.
- **JAKOŚĆ:** catch → toast.error(failedToCreateDecision); isCreatingDecision reset w finally; brak fałszywego wiersza; modal otwarty.
- **GRAFIKA:** Toast danger; Loader2 znika; brak wiersza-ducha.
- **Screenshot:** `docs/qa/screens/m13-exec/decisions/dec-22-create-error.png`
- **OCENA:** (a) brak wiersza + toast + isCreating=false; (b) toast danger, spinner zatrzymany.
- **Wykonanie:** Headless 🟡 · real-browser

### DEC-23 — i18n PL/EN: nagłówki/statusy/typy/banner
- **Powierzchnia:** DecisionsSection (label.pl/en) · **Typ:** i18n
- **Precondition/seed:** Mix decyzji + PENDING GO_NO_GO.
- **Kroki:** 1. PL. 2. EN.
- **JAKOŚĆ:** Wszystkie etykiety z t()/label; brak gołych `initiatives.decisionsSection.*`; banner PL/EN poprawny.
- **GRAFIKA:** Spójne tłumaczenia; brak ucięć/overflow w PL; layout stabilny.
- **Screenshot:** `docs/qa/screens/m13-exec/decisions/dec-23-i18n-pl-en.png`
- **OCENA:** (a) zero raw keys + przetłumaczone; (b) brak overflow, parność.
- **Wykonanie:** Headless 🟡 · real-browser

### DEC-24 — Dark/light: kolory statusów i banner
- **Powierzchnia:** DECISION_STATUS_CONFIG dark: · **Typ:** dark/light
- **Precondition/seed:** PENDING/APPROVED/REJECTED/ESCALATED/DEFERRED + PENDING GO_NO_GO.
- **Kroki:** 1. Light. 2. Dark.
- **JAKOŚĆ:** Dotcolory wg configu (PENDING amber-pulse, APPROVED emerald, REJECTED danger, ESCALATED amber, DEFERRED slate); banner amber w obu.
- **GRAFIKA:** Kontrast OK; status-pill neutral shell (§4.2 — kolor tylko w dot); banner nie danger-fill; brak crimson-leak light.
- **Screenshot:** `docs/qa/screens/m13-exec/decisions/dec-24-dark-light.png`
- **OCENA:** (a) dotcolory zgodne; (b) kontrast OK, neutral pill, amber banner.
- **Wykonanie:** Headless 🟡 · real-browser

### DEC-25 — Rola / readonly: brak CRUD dla widza
- **Powierzchnia:** DecisionsSection (readonly; createDecision wymaga approve_changes) · **Typ:** rola/readonly
- **Precondition/seed:** User bez approve_changes / readonly.
- **Kroki:** 1. Zakładka. 2. Sprawdź akcje.
- **JAKOŚĆ:** readonly ukrywa Add/Usuń/AI; handleStartCreate early-return; serwer createDecision bez approve_changes → 403; decide tylko owner/ADMIN.
- **GRAFIKA:** Brak akcji edycji; lista read czytelna; menu tylko Otwórz/Duplikuj; brak martwych kontrolek.
- **Screenshot:** `docs/qa/screens/m13-exec/decisions/dec-25-readonly.png`
- **OCENA:** (a) CRUD ukryty + 403; (b) read-only czytelny.
- **Wykonanie:** Headless 🟡 · real-browser

### DEC-26 — Termin (due) overdue → auto-eskalacja
- **Powierzchnia:** getDecisions (computeEscalationLevel) + wiersz Due · **Typ:** due
- **Precondition/seed:** PENDING z deadline w przeszłości; 1 CRITICAL >7 dni.
- **Kroki:** 1. GET. 2. Kolumna Due.
- **JAKOŚĆ:** PENDING+overdue → serwer status 'escalated' (persist gdy kolumna), isOverdue/daysOverdue; escalationLevel amber/red; FE renderuje znacznik.
- **GRAFIKA:** Due `text-danger-500` + badge „Overdue" (danger-500/20); status ESCALATED dot amber; ikona Calendar.
- **Screenshot:** `docs/qa/screens/m13-exec/decisions/dec-26-overdue.png`
- **OCENA:** (a) overdue→escalated + isOverdue; (b) due czerwone + badge overdue.
- **Wykonanie:** Headless ✅ · do-build (integration)

### DEC-27 — Duże listy: limit/offset + wydajność
- **Powierzchnia:** getDecisions (limit/offset) + tabela · **Typ:** duże listy
- **Precondition/seed:** ~80-120 decyzji mix.
- **Kroki:** 1. Załaduj. 2. Scroll. 3. ?limit=50&offset=50.
- **JAKOŚĆ:** limit/offset gdy finite; sort gate+pending stabilny; gateBlockingDecisions memo nie degraduje; ORDER BY created_at DESC + memo nadrzędny.
- **GRAFIKA:** Sticky thead; brak jankowania; GATE/PENDING na starcie.
- **Screenshot:** `docs/qa/screens/m13-exec/decisions/dec-27-large-list.png`
- **OCENA:** (a) limit/offset + sort stabilny; (b) sticky + płynny scroll.
- **Wykonanie:** Headless 🟡 · real-browser

### DEC-28 — A11y: klawiatura, etykiety, fokus modalu
- **Powierzchnia:** DecisionsSection (buttony/modal/menu) · **Typ:** a11y
- **Precondition/seed:** Decyzje + PENDING GO_NO_GO.
- **Kroki:** 1. Tab. 2. Enter na tytule. 3. Esc/outside menu.
- **JAKOŚĆ:** Buttony z title; modal auto-focus na input; outside-click zamyka menu; tytuły = button (Enter=onOpenDecision); banner klawiaturą.
- **GRAFIKA:** Focus-ring; kolejność tab logiczna; brak pułapek fokusa.
- **Screenshot:** `docs/qa/screens/m13-exec/decisions/dec-28-a11y.png`
- **OCENA:** (a) klawiatura open/close + auto-focus; (b) focus-ring + kolejność.
- **Wykonanie:** Headless 🟡 · real-browser

### DEC-29 — Responsywność: tabela przy wąskim viewport
- **Powierzchnia:** DecisionsSection (overflow-x-auto, truncate) · **Typ:** responsywność
- **Precondition/seed:** Długie tytuły + banner.
- **Kroki:** 1. 768px i 375px. 2. Tabela+banner.
- **JAKOŚĆ:** Tytuł `truncate max-w-[220px]`; `overflow-x-auto` scroll poziomy; banner truncate; brak przepełnienia body.
- **GRAFIKA:** Kolumny czytelne/scroll; badge/dot bez zawijania; banner nie pęka; sticky thead.
- **Screenshot:** `docs/qa/screens/m13-exec/decisions/dec-29-responsive.png`
- **OCENA:** (a) truncate + overflow-x bez przepełnienia; (b) czytelność na obu.
- **Wykonanie:** Headless 🟡 · real-browser

### DEC-30 — Konsola: brak błędów przy interakcjach
- **Powierzchnia:** DecisionsSection (pełny cykl) · **Typ:** konsola
- **Precondition/seed:** Mix decyzji + banner.
- **Kroki:** 1. Zakładka. 2. CRUD+approve+usuń. 3. Modal AI+menu. 4. Console+network.
- **JAKOŚĆ:** Brak uncaught/key-warning (klucze decision.id)/uncontrolled; XHR 2xx; brak zapętlonych re-renderów memo.
- **GRAFIKA:** Brak artefaktów; AnimatePresence bez „przyklejonych" wierszy.
- **Screenshot:** `docs/qa/screens/m13-exec/decisions/dec-30-console.png`
- **OCENA:** (a) console clean + 2xx; (b) brak artefaktów po cyklu.
- **Wykonanie:** Headless 🟡 · real-browser

---

# ARTEFAKT 3 — NOTYFIKACJE (NOT-01…30)

> Powierzchnie: `updateInitiativeStatus` (kanoniczny `initiative.status_changed`, severity BLOCKED→CRITICAL/CANCELLED→WARNING/else INFO, recipients≠actor, gate_action_required), `notificationService.send` (kanały/preferencje), centrum in-app MyWork. Po Wariant A: underscore typy R4 NIE strzelają. LUKI: notifyAssignment niewpięty, notifyDueBreach cron niezbudowany. Danger-fill: TYLKO CRITICAL.

### NOT-01 — Status-change emituje dokładnie 1 kanoniczną notyfikację/odbiorcę
- **Powierzchnia:** updateInitiativeStatus (~2069) + send · **Typ:** status-change → 1
- **Precondition/seed:** owner_business+execution+sponsor (3≠actor); DRAFT→PENDING_REVIEW.
- **Kroki:** 1. Seed+3 odbiorców. 2. PATCH jako 4-ty user. 3. COUNT `initiative.status_changed`/userId.
- **JAKOŚĆ:** Dokładnie 3 wiersze `initiative.status_changed` (1/odbiorca, ZERO underscore), severity INFO, priority normal, body „<name>: DRAFT → PENDING_REVIEW", actionUrl /initiatives; actor bez wiersza.
- **GRAFIKA:** Wpis z ikoną INFO (neutralny), bez danger-fill, actionUrl klikalny.
- **Screenshot:** `docs/qa/screens/m13-exec/notifications/not-01-status-change-single.png`
- **OCENA:** (a) COUNT=3, dotted, 0 dubli, INFO; (b) ikona INFO neutralna.
- **Wykonanie:** Headless ✅ · `tests/integration/initiatives/notifications.test.ts`

### NOT-02 — →BLOCKED eskalowane CRITICAL+reason
- **Powierzchnia:** statusSeverity branch · **Typ:** →BLOCKED CRITICAL
- **Precondition/seed:** EXECUTING, 2 odbiorcy; →BLOCKED reason="czekam na budżet".
- **Kroki:** 1. Seed. 2. PATCH→BLOCKED+reason. 3. Pobierz.
- **JAKOŚĆ:** `initiative.status_changed`, title „Initiative blocked", CRITICAL, priority high, body z `(czekam na budżet)`, metadata.reason; 2 odbiorców, actor pominięty; brak legacy underscore.
- **GRAFIKA:** Wpis CRITICAL — czerwona ikona/akcent, danger-fill DOZWOLONY (jedyny przypadek).
- **Screenshot:** `docs/qa/screens/m13-exec/notifications/not-02-blocked-critical.png`
- **OCENA:** (a) CRITICAL, reason w body, 0 underscore; (b) czerwony akcent.
- **Wykonanie:** Headless ✅ · `notifications.test.ts`

### NOT-03 — →CANCELLED jako WARNING
- **Powierzchnia:** statusSeverity ternary · **Typ:** →CANCELLED WARNING
- **Precondition/seed:** Aktywna, 2 odbiorcy; →CANCELLED.
- **Kroki:** 1. Seed. 2. PATCH→CANCELLED. 3. Pobierz.
- **JAKOŚĆ:** `initiative.status_changed`, WARNING, priority high, body „<from> → CANCELLED", 2 odbiorców; brak CRITICAL/dubla.
- **GRAFIKA:** Wpis WARNING — akcent bursztynowy, BRAK danger-fill (czerwień tylko CRITICAL).
- **Screenshot:** `docs/qa/screens/m13-exec/notifications/not-03-cancelled-warning.png`
- **OCENA:** (a) WARNING + priority high; (b) akcent bursztynowy, bez czerwieni.
- **Wykonanie:** Headless ✅ · do-build (sibling NOT-01)

### NOT-04 — Zwykła tranzycja = INFO
- **Powierzchnia:** statusSeverity else · **Typ:** INFO
- **Precondition/seed:** APPROVED→SCHEDULED, 1 odbiorca.
- **Kroki:** 1. Seed. 2. PATCH. 3. Pobierz.
- **JAKOŚĆ:** INFO, priority normal, title „Initiative status changed", 1 wiersz.
- **GRAFIKA:** Ikona INFO neutralna, kolor stonowany.
- **Screenshot:** `docs/qa/screens/m13-exec/notifications/not-04-info-default.png`
- **OCENA:** (a) INFO+normal; (b) ikona neutralna.
- **Wykonanie:** Headless ✅ · `notifications.test.ts`

### NOT-05 — Aktor nie dostaje własnej notyfikacji
- **Powierzchnia:** recipients.filter(uid!==actorId) · **Typ:** aktor wykluczony
- **Precondition/seed:** Actor=owner_business + 1 inny odbiorca.
- **Kroki:** 1. Seed actor∈recipients. 2. PATCH jako actor. 3. COUNT/userId.
- **JAKOŚĆ:** 0 dla actorId; 1 dla drugiego; filtr działa mimo że actor beneficjentem.
- **GRAFIKA:** Centrum actora bez wpisu o własnej zmianie.
- **Screenshot:** `docs/qa/screens/m13-exec/notifications/not-05-actor-excluded.png`
- **OCENA:** (a) COUNT(actor)=0; (b) centrum actora puste.
- **Wykonanie:** Headless ✅ · `notifications.test.ts`

### NOT-06 — Brak dubla: dokładnie 1/odbiorca (Wariant A)
- **Powierzchnia:** kanoniczny blok (usunięty emiter R4) · **Typ:** anty-dubel
- **Precondition/seed:** 1 odbiorca; →BLOCKED.
- **Kroki:** 1. Seed. 2. PATCH→BLOCKED. 3. COUNT initiative.* odbiorcy.
- **JAKOŚĆ:** Dokładnie 1 status-change (CRITICAL); ZERO underscore; brak dedup w serwisie więc liczba=emisje=1.
- **GRAFIKA:** Jeden wpis (nie dwa identyczne).
- **Screenshot:** `docs/qa/screens/m13-exec/notifications/not-06-no-duplicate.png`
- **OCENA:** (a) COUNT=1 i 0 underscore; (b) brak zdublowanego wpisu.
- **Wykonanie:** Headless ✅ · `notifications.test.ts`

### NOT-07 — Gate-role notify następnej bramki
- **Powierzchnia:** blok 2 (nextGateApprovers + `initiative.gate_action_required`) · **Typ:** gate-role
- **Precondition/seed:** initiative_gate_roles (PROJECT_SPONSOR=userB); tranzycja z oczekującą bramką.
- **Kroki:** 1. Seed gate-role. 2. PATCH do stanu z bramką. 3. Pobierz userB.
- **JAKOŚĆ:** userB: `initiative.gate_action_required`, title „Gate action required", priority high, isActionable=true, body z nextStatus+nextGateLabel; NIE do actora.
- **GRAFIKA:** Wpis actionable (badge/CTA), ikona gate, actionUrl /initiatives.
- **Screenshot:** `docs/qa/screens/m13-exec/notifications/not-07-gate-role-next.png`
- **OCENA:** (a) gate_action_required, isActionable, do approvera; (b) widoczny CTA.
- **Wykonanie:** Headless ✅ · `notifications-gate-role.test.ts`

### NOT-08 — Auto-derived gate roles (owner/sponsor) jako approverzy
- **Powierzchnia:** gateRoleUsers push z initiatives · **Typ:** gate-role auto-derive
- **Precondition/seed:** Bez initiative_gate_roles, ale owner_business_id+sponsor_id.
- **Kroki:** 1. Seed bez gate_roles. 2. PATCH do stanu z bramką BUSINESS_OWNER/SPONSOR. 3. Pobierz.
- **JAKOŚĆ:** Approverzy z kolumn inicjatywy dostają gate_action_required mimo braku tabeli; tabela nieobecna nie wysadza (catch).
- **GRAFIKA:** Wpis actionable w centrum sponsora/ownera.
- **Screenshot:** `docs/qa/screens/m13-exec/notifications/not-08-auto-derived-roles.png`
- **OCENA:** (a) auto-derived dostają gate_action_required; (b) wpis widoczny.
- **Wykonanie:** Headless ✅ · do-build (`notifications-gate-role.test.ts`)

### NOT-09 — gate_blocked notyfikacja na zablokowanej tranzycji
- **Powierzchnia:** wczesne returny gate_blocked · **Typ:** gate_blocked
- **Precondition/seed:** Inicjatywa niespełniająca bramki.
- **Kroki:** 1. Seed. 2. PATCH (odrzucony). 3. Response+notyfikacje.
- **JAKOŚĆ:** Tranzycja zablokowana (status niezmieniony), gate_blocked do odbiorców na wczesnym return; brak status_changed.
- **GRAFIKA:** Wpis ostrzegawczy WARNING, actionUrl /initiatives.
- **Screenshot:** `docs/qa/screens/m13-exec/notifications/not-09-gate-blocked.png`
- **OCENA:** (a) status niezmieniony + gate_blocked, brak status_changed; (b) akcent ostrzegawczy.
- **Wykonanie:** Headless 🟡 · do-build (`notifications-gate-blocked.test.ts`)

### NOT-10 — Owner-change: nowy owner + watchers
- **Powierzchnia:** updateInitiative (~1099) owner_changed · **Typ:** owner-change
- **Precondition/seed:** ownerA→ownerB (owner_business); watcherC.
- **Kroki:** 1. Seed. 2. PATCH ownerBusinessId=ownerB. 3. Pobierz.
- **JAKOŚĆ:** ownerB: `initiative.owner_changed` „You were assigned as initiative owner", priority high; watcherC: ten typ „Initiative ownership changed", priority normal; actor+nowy owner wykluczeni z watcherów.
- **GRAFIKA:** Dwa różne wpisy (assign vs ogólny), ikona initiative, INFO/neutralny.
- **Screenshot:** `docs/qa/screens/m13-exec/notifications/not-10-owner-change.png`
- **OCENA:** (a) nowy owner high + watcher normal, brak dubla; (b) oba wpisy poprawne.
- **Wykonanie:** Headless ✅ · do-build (`notifications-owner-change.test.ts`)

### NOT-11 — Org-scope: brak wycieku do innej org
- **Powierzchnia:** getInitiativeNotificationRecipients (orgId) + send organizationId · **Typ:** org-scope
- **Precondition/seed:** OrgA inicjatywa+odbiorcy; userX OrgB.
- **Kroki:** 1. Seed A+B. 2. Zmień status A. 3. Pobierz userX.
- **JAKOŚĆ:** userX 0 notyfikacji; recipients `AND organization_id=?`; wszystkie wiersze organizationId=OrgA.
- **GRAFIKA:** Centrum userX puste dla eventu.
- **Screenshot:** `docs/qa/screens/m13-exec/notifications/not-11-org-scope-no-leak.png`
- **OCENA:** (a) 0 poza OrgA; (b) centrum OrgB czyste.
- **Wykonanie:** Headless ✅ · `notifications-org-scope.test.ts`

### NOT-12 — Pełna lista odbiorców bez nakładek (dedup)
- **Powierzchnia:** getInitiativeNotificationRecipients Set · **Typ:** odbiorcy/dedup
- **Precondition/seed:** owner_business=A, execution=B, sponsor=C, watcher=D, stakeholder=E; A też watcher.
- **Kroki:** 1. Seed 5+overlap. 2. Zmień status. 3. COUNT unikalnych.
- **JAKOŚĆ:** Dokładnie 5 unikalnych (Set dedup A), 1/odbiorca; stakeholdery user_id IS NOT NULL.
- **GRAFIKA:** Każdy z 5 widzi wpis; A bez dubla.
- **Screenshot:** `docs/qa/screens/m13-exec/notifications/not-12-recipients-dedup.png`
- **OCENA:** (a) unikalnych=5, A=1; (b) A bez dubla.
- **Wykonanie:** Headless ✅ · do-build (`notifications.test.ts`)

### NOT-13 — In-app: notyfikacja widoczna w centrum
- **Powierzchnia:** `NotificationsContent.tsx`/`NotificationsHub.tsx` · **Typ:** in-app render
- **Precondition/seed:** Odbiorca z ≥1 świeżą status_changed.
- **Kroki:** 1. Zaloguj odbiorcę. 2. Centrum MyWork. 3. Screen listy.
- **JAKOŚĆ:** GET zwraca wpis; isRead=false (flagOn(read)||is_read); tytuł/body/czas/badge unread w liczniku.
- **GRAFIKA:** Wpis z tytułem/body, ikoną wg severity, znacznikiem unread (kropka/bold); kanon listy.
- **Screenshot:** `docs/qa/screens/m13-exec/notifications/not-13-inapp-center.png`
- **OCENA:** (a) wpis w API + unread; (b) renderuje czytelnie kanon.
- **Wykonanie:** Headless 🟡 · real-browser (sesja MyWork)

### NOT-14 — Severity → ikona/kolor (CRITICAL/WARNING/INFO)
- **Powierzchnia:** NotificationsContent severity mapping · **Typ:** severity→ikona
- **Precondition/seed:** 3 notyfikacje CRITICAL/WARNING/INFO u jednego odbiorcy.
- **Kroki:** 1. Seed 3. 2. Centrum. 3. Screen trzech.
- **JAKOŚĆ:** Każdy wpis poprawna severity z API; grupowanie spójne.
- **GRAFIKA:** CRITICAL=czerwona (danger-fill OK), WARNING=bursztyn (bez danger-fill), INFO=neutralny; ikony jednoznaczne.
- **Screenshot:** `docs/qa/screens/m13-exec/notifications/not-14-severity-icons.png`
- **OCENA:** (a) severity per wpis; (b) 3 odrębne kolory/ikony, czerwień tylko CRITICAL.
- **Wykonanie:** Headless 🟡 · real-browser

### NOT-15 — Kanały: in-app zawsze, email/Slack wg preferencji
- **Powierzchnia:** send (channels + typeSettings) · **Typ:** kanały
- **Precondition/seed:** Odbiorca1 emailEnabled+typeSettings channels=[in-app,email]; odbiorca2 tylko in-app.
- **Kroki:** 1. Seed prefs. 2. Zmień status (mock email/Slack). 3. Sprawdź wywołania+wiersz.
- **JAKOŚĆ:** Odbiorca1: INSERT + sendEmail; odbiorca2: tylko INSERT, email NIE; channels wg typeSettings; globalEnabled=false skip.
- **GRAFIKA:** Centrum obu pokazuje in-app.
- **Screenshot:** `docs/qa/screens/m13-exec/notifications/not-15-channels-prefs.png`
- **OCENA:** (a) email tylko gdy pref on; (b) in-app u obu.
- **Wykonanie:** Headless ✅ · do-build (`notifications-channels.test.ts`)

### NOT-16 — Preferencje wyłączające typ
- **Powierzchnia:** send typePref.enabled · **Typ:** preferencje typu
- **Precondition/seed:** Odbiorca typeSettings[status_changed].enabled=false; drugi true.
- **Kroki:** 1. Seed prefs. 2. Zmień status. 3. COUNT obu.
- **JAKOŚĆ:** enabled=false: 0 (skip przed INSERT); drugi: 1; bypassPreferences=false honoruje pref.
- **GRAFIKA:** Centrum wyłączonego bez nowego wpisu.
- **Screenshot:** `docs/qa/screens/m13-exec/notifications/not-16-type-disabled.png`
- **OCENA:** (a) disabled→0, enabled→1; (b) lista pusta u disabled.
- **Wykonanie:** Headless ✅ · do-build (`notifications-channels.test.ts`)

### NOT-17 — globalEnabled=false → cała notyfikacja pominięta
- **Powierzchnia:** send (`!prefs?.globalEnabled` early return) · **Typ:** preferencje globalne
- **Precondition/seed:** Odbiorca globalEnabled=false.
- **Kroki:** 1. Seed. 2. Zmień status. 3. Notyfikacje+kanały.
- **JAKOŚĆ:** 0 INSERT, 0 email/Slack; send zwraca id ale nic nie zapisuje gdy bypass=false; reszta nietknięta.
- **GRAFIKA:** Centrum bez wpisu, licznik unread bez zmian.
- **Screenshot:** `docs/qa/screens/m13-exec/notifications/not-17-global-disabled.png`
- **OCENA:** (a) 0 INSERT/0 kanały; (b) licznik bez zmian.
- **Wykonanie:** Headless ✅ · do-build (`notifications-channels.test.ts`)

### NOT-18 — Quiet hours: in-app zapisana, zewnętrzne wstrzymane
- **Powierzchnia:** send quietHours (isInQuietHours) · **Typ:** kanały / quiet hours
- **Precondition/seed:** quietHoursEnabled=true w oknie ciszy.
- **Kroki:** 1. Seed. 2. Zmień status. 3. INSERT vs email/Slack.
- **JAKOŚĆ:** in-app zapisana; email/Slack wstrzymane w oknie; UI wpis dostępny.
- **GRAFIKA:** Wpis widoczny mimo quiet hours.
- **Screenshot:** `docs/qa/screens/m13-exec/notifications/not-18-quiet-hours.png`
- **OCENA:** (a) in-app zapisana, zewn. wstrzymane; (b) wpis w centrum.
- **Wykonanie:** Headless 🟡 · do-build (`notifications-channels.test.ts`)

### NOT-19 — Email digest wg preferencji
- **Powierzchnia:** emailDigestEnabled/Frequency + emailService · **Typ:** email digest
- **Precondition/seed:** emailDigestEnabled=true daily; kilka notyfikacji w ciągu dnia.
- **Kroki:** 1. Seed digest. 2. ≥3 status-change. 3. Czy per-event email NIE leci.
- **JAKOŚĆ:** Digest on → natychmiastowe maile per-event NIE wysyłane (agregacja); in-app normalnie; frequency honorowane. LUKA jeśli digest-runner niezbudowany — DOKUMENTUJ.
- **GRAFIKA:** Centrum in-app pokazuje wszystkie wpisy.
- **Screenshot:** `docs/qa/screens/m13-exec/notifications/not-19-email-digest.png`
- **OCENA:** (a) per-event email tłumiony; LUKA jeśli brak runnera; (b) in-app kompletne.
- **Wykonanie:** Headless 🟡 · do-build (możliwa LUKA digest-runner)

### NOT-20 — Brak tabeli notifications = fail-safe
- **Powierzchnia:** updateInitiativeStatus try/catch + getTableColumns · **Typ:** fail-safe
- **Precondition/seed:** Env bez tabeli notifications.
- **Kroki:** 1. Brak tabeli. 2. PATCH status. 3. Response+status.
- **JAKOŚĆ:** Status zmieniony (200 „Status updated"); błąd INSERT połknięty; tranzycja NIE zerwana; audit próbowany.
- **GRAFIKA:** Brak wpisów (oczekiwane); UI inicjatyw nowy status.
- **Screenshot:** `docs/qa/screens/m13-exec/notifications/not-20-no-table-failsafe.png`
- **OCENA:** (a) status zmieniony mimo braku tabeli; (b) status widoczny.
- **Wykonanie:** Headless ✅ · do-build (`notifications-failsafe.test.ts`)

### NOT-21 — Fail-safe: błąd send nie psuje tranzycji
- **Powierzchnia:** Promise.allSettled + outer catch · **Typ:** fail-safe
- **Precondition/seed:** send rzuca dla 1 z 3 odbiorców.
- **Kroki:** 1. Mock send rzucający dla odbiorcy2. 2. PATCH. 3. Response+pozostali.
- **JAKOŚĆ:** Status 200; allSettled izoluje błąd — odbiorca1/3 dostają, odbiorca2 nie; brak rzucenia w górę; audit zapisany.
- **GRAFIKA:** Centrum odbiorcy1/3 z wpisem; status zaktualizowany.
- **Screenshot:** `docs/qa/screens/m13-exec/notifications/not-21-send-error-isolated.png`
- **OCENA:** (a) 200 + 2/3 dostali; (b) status zaktualizowany.
- **Wykonanie:** Headless ✅ · do-build (`notifications-failsafe.test.ts`)

### NOT-22 — Assignment (LUKA: notifyAssignment NIEWPIĘTY) — dokumentujący
- **Powierzchnia:** initiativeNotificationService.notifyAssignment (niewywoływana) · **Typ:** assignment (LUKA)
- **Precondition/seed:** Przypisanie usera.
- **Kroki:** 1. Akcja przypisania. 2. Notyfikacje assignment. 3. Grep call-site.
- **JAKOŚĆ:** ŻADNA notyfikacja assignment (brak call-site); test ASSERTUJE 0 i FLAGUJE lukę; owner_changed (NOT-10) to osobny wpięty mechanizm.
- **GRAFIKA:** Centrum bez wpisu assignment (luka).
- **Screenshot:** `docs/qa/screens/m13-exec/notifications/not-22-assignment-gap.png`
- **OCENA:** (a) 0 + brak call-site (luka udokumentowana); (b) centrum bez assignment.
- **Wykonanie:** Headless ✅ · do-build (assert-gap)

### NOT-23 — Due-breach (LUKA: cron NIEZBUDOWANY) — dokumentujący
- **Powierzchnia:** notifyDueBreach + `due-breach.test.ts` · **Typ:** due-breach (LUKA)
- **Precondition/seed:** Inicjatywa/task due w przeszłości.
- **Kroki:** 1. Seed overdue. 2. Wywołaj scheduler. 3. Notyfikacje.
- **JAKOŚĆ:** notifyDueBreach DZIAŁA ręcznie (biblioteka emituje), ale BRAK crona → 0 automatycznych; test: funkcja-OK, automatyzacja-LUKA.
- **GRAFIKA:** Brak auto-wpisu due-breach (luka); ręczny → WARNING/CRITICAL wg daysOverdue.
- **Screenshot:** `docs/qa/screens/m13-exec/notifications/not-23-due-breach-gap.png`
- **OCENA:** (a) notifyDueBreach emituje ręcznie, brak crona udokumentowany; (b) wpis tylko po ręcznym triggerze.
- **Wykonanie:** Headless ✅ · `tests/integration/initiatives/due-breach.test.ts`

### NOT-24 — i18n treści notyfikacji (PL/EN)
- **Powierzchnia:** title/body w send (EN literały) + FE i18n · **Typ:** i18n treści
- **Precondition/seed:** Sesje PL/EN; ten sam event.
- **Kroki:** 1. Notyfikacja. 2. Centrum PL. 3. EN.
- **JAKOŚĆ:** Chrome UI (czas/akcje/badge/unread) tłumaczone; title/body emitowane EN serwerowo — jeśli brak warstwy tłumaczenia → DOKUMENTUJ lukę i18n treści.
- **GRAFIKA:** Brak gołych kluczy; chrome PL/EN; layout spójny.
- **Screenshot:** `docs/qa/screens/m13-exec/notifications/not-24-i18n.png`
- **OCENA:** (a) chrome przetłumaczony, treść-EN udokumentowana; (b) brak bare keys.
- **Wykonanie:** Headless 🟡 · real-browser

### NOT-25 — Dark/light: centrum w obu motywach
- **Powierzchnia:** NotificationsContent/Hub theming · **Typ:** dark/light
- **Precondition/seed:** Mix CRITICAL/WARNING/INFO.
- **Kroki:** 1. Light. 2. Dark.
- **JAKOŚĆ:** Te same dane w obu; brak utraty czytelności.
- **GRAFIKA:** Light: brak crimson-leak, badge bez danger-fill poza CRITICAL, kontrast OK; Dark: tła/akcenty wg tokenów, ikony czytelne; kanon obu.
- **Screenshot:** `docs/qa/screens/m13-exec/notifications/not-25-dark-light.png`
- **OCENA:** (a) dane spójne; (b) oba motywy kanon, kontrast AA.
- **Wykonanie:** Headless 🟡 · real-browser

### NOT-26 — Duże ilości: paginacja/wydajność 100+
- **Powierzchnia:** notificationService list + NotificationsContent · **Typ:** duże ilości
- **Precondition/seed:** Odbiorca 100+ notyfikacji.
- **Kroki:** 1. Seed 100+. 2. Centrum. 3. Scroll/paginate.
- **JAKOŚĆ:** List z limitem/paginacją (nie wszystkie naraz); licznik unread poprawny; brak N+1.
- **GRAFIKA:** Lista płynna, bez przeskoków; spójny rytm; ikony/kolory zachowane.
- **Screenshot:** `docs/qa/screens/m13-exec/notifications/not-26-bulk-100.png`
- **OCENA:** (a) paginacja + poprawny licznik; (b) render płynny.
- **Wykonanie:** Headless 🟡 · real-browser

### NOT-27 — A11y centrum (role/aria/focus/kontrast)
- **Powierzchnia:** NotificationsContent/Hub ARIA · **Typ:** a11y
- **Precondition/seed:** Centrum różnej severity.
- **Kroki:** 1. Centrum. 2. Klawiatura. 3. axe + focus.
- **JAKOŚĆ:** Lista role list/listitem, wpisy fokusowalne, mark-read klawiaturą, aria-label na ikonach severity, licznik aria-live; 0 krytycznych axe.
- **GRAFIKA:** Focus-ring niebieski; kontrast AA; severity nie tylko kolorem (ikona+tekst).
- **Screenshot:** `docs/qa/screens/m13-exec/notifications/not-27-a11y.png`
- **OCENA:** (a) 0 krytycznych axe + klawiatura; (b) focus-ring + kontrast AA.
- **Wykonanie:** Headless 🟡 · real-browser

### NOT-28 — Konsola: brak błędów przy renderze centrum
- **Powierzchnia:** FE notifications (console) · **Typ:** konsola
- **Precondition/seed:** Mix severity, read/scroll.
- **Kroki:** 1. Czysta konsola. 2. mark-read/scroll/actionUrl. 3. Logi.
- **JAKOŚĆ:** Brak uncaught/React-warning (klucze, controlled), brak 4xx/5xx GET/markRead, brak bare i18n warnów.
- **GRAFIKA:** Brak migotania/CLS przy akcjach.
- **Screenshot:** `docs/qa/screens/m13-exec/notifications/not-28-console.png`
- **OCENA:** (a) 0 error/warn + 0 błędnych network; (b) brak CLS.
- **Wykonanie:** Headless 🟡 · real-browser

### NOT-29 — Współbieżne tranzycje: brak utraty/dubla
- **Powierzchnia:** updateInitiativeStatus pod równoległymi PATCH · **Typ:** współbieżność
- **Precondition/seed:** Inicjatywa + 2 odbiorcy; 2 równoległe PATCH (jeden wygrywa, drugi gate_blocked).
- **Kroki:** 1. Seed. 2. 2 równoległe PATCH. 3. COUNT + końcowy status.
- **JAKOŚĆ:** Tylko zwycięska tranzycja → 1 status_changed/odbiorca; przegrany nie tworzy fałszywego status_changed; brak race-dubla; status spójny.
- **GRAFIKA:** Centrum 1 wpis (nie dwa konkurujące).
- **Screenshot:** `docs/qa/screens/m13-exec/notifications/not-29-concurrent.png`
- **OCENA:** (a) 1 status_changed/odbiorca + status spójny; (b) brak zdublowanego wpisu.
- **Wykonanie:** Headless 🟡 · do-build (`notifications-concurrent.test.ts`)

### NOT-30 — Mark-as-read: zmiana stanu + licznik
- **Powierzchnia:** markAsRead (~506) + FE akcja read · **Typ:** mark-as-read
- **Precondition/seed:** Odbiorca 3 nieprzeczytane.
- **Kroki:** 1. Centrum (licznik=3). 2. „oznacz przeczytane" na 1. 3. API+licznik+refetch.
- **JAKOŚĆ:** markAsRead(id,userId) ustawia is_read/read=1 scoped userId; unread 3→2; refetch isRead=true; brak zmiany cudzych.
- **GRAFIKA:** Wpis traci unread (bold/kropka znika); badge maleje; pozostałe bez zmian.
- **Screenshot:** `docs/qa/screens/m13-exec/notifications/not-30-mark-as-read.png`
- **OCENA:** (a) is_read=1 scoped + licznik 3→2; (b) unread-marker znika, badge maleje.
- **Wykonanie:** Headless 🟡 · real-browser / do-build (`notifications-mark-read.test.ts`)

---

# ARTEFAKT 4 — KALENDARZ (CAL-01…30)

> Powierzchnie: `InitiativeCalendar.tsx` (month=42-cell grid od poniedziałku, week=7, marker dziś, chip dots task=primary/milestone=amber/phase=emerald, status filter, undated bucket, optimistic+rollback PUT, read-only gdy brak onReschedule), `TimelineSection` toggle, `buildScheduleItems`/`toIsoDate`. Drag real-mouse → component-test.

### CAL-01 — Happy: kalendarz montuje się z toggla Kalendarz/Gantt
- **Powierzchnia:** TimelineSection → InitiativeCalendar · **Typ:** e2e render + smoke
- **Precondition/seed:** seedTasks 3 zadania czerwiec 2026: T1 due 15, T2 18, T3 22; PLANNING; system time 2026-06-15.
- **Kroki:** 1. openDoc, sectionNav('timeline'). 2. Toggle 'calendar'. 3. Render month.
- **JAKOŚĆ:** scheduleView none→calendar; buildScheduleItems 3 task:* (start=end=due); chipy na 15/18/22; brak PUT na render; onReschedule przekazany → draggable=true.
- **GRAFIKA:** Siatka 7×6, nagłówek dni Mon…Sun, „June 2026"; 3 chipy kropka primary-500; marker dziś 15 primary-600 bold; kanon, bez danger-fill.
- **Screenshot:** `docs/qa/screens/m13-exec/calendar/cal-01-happy-month-mount.png`
- **OCENA:** (a) 3 chipy 15/18/22, 0 PUT, draggable=true; (b) siatka 7×6 + marker + kropki primary.
- **Wykonanie:** Headless ✅ · do-build

### CAL-02 — Render miesiąca: 42 komórki, 6 rzędów od poniedziałku
- **Powierzchnia:** InitiativeCalendar (month) · **Typ:** component
- **Precondition/seed:** items=[T1 2026-06-01], system time 2026-06-15, view='month'.
- **Kroki:** 1. render. 2. Zlicz [data-day]. 3. Pierwsza/ostatnia komórka.
- **JAKOŚĆ:** 42 komórki; gridStart=startOfWeekMonday(06-01) → pierwsza 06-01 (pon), ostatnia 07-12; dni spoza czerwca bg-slate-50/60; chip T1 na 06-01.
- **GRAFIKA:** grid-cols-7 grid-rows-6, out-of-month wyszarzone, min-h-[84px]; numery align-right.
- **Screenshot:** `docs/qa/screens/m13-exec/calendar/cal-02-month-42-cells.png`
- **OCENA:** (a) count=42, first=06-01, last=07-12; (b) 6 rzędów + wyszarzenie sąsiednich.
- **Wykonanie:** Headless ✅ · `InitiativeCalendar.month-grid.test.tsx`

### CAL-03 — Render tygodnia: 7 komórek Mon→Sun
- **Powierzchnia:** InitiativeCalendar (week) · **Typ:** component
- **Precondition/seed:** items=[T1 2026-06-17], system time 2026-06-15.
- **Kroki:** 1. render. 2. Toggle week. 3. Zlicz [data-day]+zakres.
- **JAKOŚĆ:** week → startOfWeekMonday(06-15)=06-15; 7 komórek 06-15…06-21; chip T1 na 06-17; brak out-of-month.
- **GRAFIKA:** Jeden rząd 7 kolumn, brak wyszarzeń, marker dziś 15.
- **Screenshot:** `docs/qa/screens/m13-exec/calendar/cal-03-week-7-cells.png`
- **OCENA:** (a) count=7, zakres 15–21, chip 17; (b) pojedynczy rząd.
- **Wykonanie:** Headless ✅ · `InitiativeCalendar.week-grid.test.tsx`

### CAL-04 — Nawigacja miesięcy chevron
- **Powierzchnia:** InitiativeCalendar toolbar · **Typ:** component
- **Precondition/seed:** items=[T1 06-15], time 06-15, month.
- **Kroki:** 1. render. 2. prev. 3. next×2.
- **JAKOŚĆ:** prev → May 2026 (grid maj); 2× next → July; chevron month = pełny miesiąc; T1 znika z maj/lipiec.
- **GRAFIKA:** Label+siatka aktualizują się; marker dziś znika gdy nie czerwiec.
- **Screenshot:** `docs/qa/screens/m13-exec/calendar/cal-04-chevron-nav.png`
- **OCENA:** (a) May→July, skok pełnomiesięczny; (b) tytuł+siatka spójne.
- **Wykonanie:** Headless ✅ · `InitiativeCalendar.month-nav.test.tsx`

### CAL-05 — Nawigacja tygodnia chevron: skok o 7 dni
- **Powierzchnia:** InitiativeCalendar toolbar (week) · **Typ:** component
- **Precondition/seed:** items=[T1 06-24], time 06-15, week.
- **Kroki:** 1. week (15–21). 2. next. 3. Zakres+T1.
- **JAKOŚĆ:** week shift → addDays(7); zakres 06-22…06-28; T1 widoczny; poprzedni tydzień go nie zawierał.
- **GRAFIKA:** 7 komórek nowego zakresu; T1 na 24; brak markera dziś.
- **Screenshot:** `docs/qa/screens/m13-exec/calendar/cal-05-week-nav.png`
- **OCENA:** (a) zakres 22–28 + T1; (b) siatka przesunięta o tydzień.
- **Wykonanie:** Headless ✅ · `InitiativeCalendar.week-nav.test.tsx`

### CAL-06 — Przycisk „dziś" wraca do bieżącego miesiąca
- **Powierzchnia:** InitiativeCalendar toolbar · **Typ:** component
- **Precondition/seed:** items=[], time 06-15, month.
- **Kroki:** 1. next×3 (Sept). 2. „today". 3. Label.
- **JAKOŚĆ:** today → setCursor(new Date)=czerwiec; label „June 2026"; marker 06-15 font-bold primary-600.
- **GRAFIKA:** Komórka 15 primary; reszta numerów slate-400.
- **Screenshot:** `docs/qa/screens/m13-exec/calendar/cal-06-today-button.png`
- **OCENA:** (a) label = June 2026; (b) marker primary na 15.
- **Wykonanie:** Headless ✅ · `InitiativeCalendar.today-button.test.tsx`

### CAL-07 — Marker „dziś": jedna komórka primary-bold
- **Powierzchnia:** InitiativeCalendar (month) · **Typ:** component
- **Precondition/seed:** items=[], time 06-15, month.
- **Kroki:** 1. render. 2. Zlicz font-bold text-primary-600.
- **JAKOŚĆ:** Dokładnie 1 dzień (06-15) font-bold primary-600 dark:primary-400; reszta slate-400; marker niezależny od danych.
- **GRAFIKA:** Jeden wyróżniony numer 15; kontrast light; bez danger.
- **Screenshot:** `docs/qa/screens/m13-exec/calendar/cal-07-today-marker.png`
- **OCENA:** (a) dokładnie 1 primary-bold=15; (b) marker pojedynczy.
- **Wykonanie:** Headless ✅ · `InitiativeCalendar.today-marker.test.tsx`

### CAL-08 — Zadania renderują się po dacie start (byDay)
- **Powierzchnia:** InitiativeCalendar (month) · **Typ:** component
- **Precondition/seed:** A start 06-10, B start 06-10, C start 06-20; time 06-15.
- **Kroki:** 1. render. 2. Chipy na 06-10 i 06-20.
- **JAKOŚĆ:** byDay po it.start; 10=2 chipy (A,B), 20=1 (C); item bez start pomijany; chip po start nie end.
- **GRAFIKA:** 2 chipy stack space-y-1; kropka primary; truncate.
- **Screenshot:** `docs/qa/screens/m13-exec/calendar/cal-08-tasks-by-date.png`
- **OCENA:** (a) 10=2 / 20=1; (b) stacking + kropki primary.
- **Wykonanie:** Headless ✅ · `InitiativeCalendar.tasks-by-date.test.tsx`

### CAL-09 — Kamienie po dacie z bursztynową kropką
- **Powierzchnia:** InitiativeCalendar (month) · **Typ:** component
- **Precondition/seed:** M1 06-12, M2 06-25; time 06-15.
- **Kroki:** 1. render. 2. Chip na 12 i 25, kropka.
- **JAKOŚĆ:** Kamień punkt (start===end); M1 na 06-12, M2 06-25; type='milestone' → kropka amber-500.
- **GRAFIKA:** Kropki amber-500 odróżniają od zadań (primary); czytelne.
- **Screenshot:** `docs/qa/screens/m13-exec/calendar/cal-09-milestones.png`
- **OCENA:** (a) M1/M2 na 12/25 type=milestone; (b) kropka amber-500.
- **Wykonanie:** Headless ✅ · `InitiativeCalendar.milestones.test.tsx`

### CAL-10 — Fazy renderują się na dacie startu (zielona kropka)
- **Powierzchnia:** InitiativeCalendar (month) · **Typ:** component
- **Precondition/seed:** P1 start 06-05 end 06-19; time 06-15.
- **Kroki:** 1. render. 2. Komórka chipa fazy.
- **JAKOŚĆ:** Faza na start (5); kalendarz po it.start (nie pasek 5–19); type='phase' → emerald-500; end zachowany (dla drag snap).
- **GRAFIKA:** Chip fazy kropka emerald-500 na 5; brak rozciągniętego paska (to Gantt).
- **Screenshot:** `docs/qa/screens/m13-exec/calendar/cal-10-phases.png`
- **OCENA:** (a) chip na start=5 type=phase; (b) kropka emerald.
- **Wykonanie:** Headless ✅ · `InitiativeCalendar.phases.test.tsx`

### CAL-11 — Pusty stan: brak itemów → empty
- **Powierzchnia:** InitiativeCalendar · **Typ:** component + e2e render
- **Precondition/seed:** items=[], loading=false, time 06-15.
- **Kroki:** 1. render. 2. calendarView.empty + 0 chipów.
- **JAKOŚĆ:** !loading && length===0 → empty; siatka rysuje się (puste dni); brak undated; brak chipów.
- **GRAFIKA:** Empty wyśrodkowany slate-400; siatka pusta; marker dziś widoczny.
- **Screenshot:** `docs/qa/screens/m13-exec/calendar/cal-11-empty.png`
- **OCENA:** (a) empty + 0 chipów; (b) komunikat czytelny.
- **Wykonanie:** Headless ✅ · `InitiativeCalendar.empty.test.tsx`

### CAL-12 — Stan loading
- **Powierzchnia:** InitiativeCalendar · **Typ:** component
- **Precondition/seed:** items=[], loading=true, time 06-15.
- **Kroki:** 1. render loading. 2. calendarView.loading. 3. empty NIE.
- **JAKOŚĆ:** loading → loading-block; empty (!loading) niespełniony; toolbar+siatka obecne.
- **GRAFIKA:** Subtelny loading slate-400; brak migotania danger.
- **Screenshot:** `docs/qa/screens/m13-exec/calendar/cal-12-loading.png`
- **OCENA:** (a) loading widoczny, empty ukryty; (b) stan nienachalny.
- **Wykonanie:** Headless ✅ · `InitiativeCalendar.loading.test.tsx`

### CAL-13 — Drag zadania → PUT + optimistic + onReschedule
- **Powierzchnia:** InitiativeCalendar drop · **Typ:** component (DnD polyfill)
- **Precondition/seed:** T task:1 start 06-15 end 06-17, onReschedule spy, Api.put resolve, time 06-15.
- **Kroki:** 1. render. 2. dragstart (text/plain='task:1'). 3. drop na 06-18.
- **JAKOŚĆ:** dayDelta(15→18)=+3; newStart 06-18, newEnd shiftIso(17,+3)=06-20 (długość 2 zachowana); PUT('/api/pmo/tasks/1',{startedAt:06-18,dueDate:06-20}) 1×; optimistic przed await; onReschedule('task:1','task','1','06-18','06-20'); chip na 18.
- **GRAFIKA:** Chip 15→18; podczas zapisu opacity-60; kropka primary; bez danger.
- **Screenshot:** `docs/qa/screens/m13-exec/calendar/cal-13-drag-persist.png`
- **OCENA:** (a) PUT body dokładny, długość zachowana, onReschedule poprawne; (b) chip na 18 + saving.
- **Wykonanie:** Headless ✅ · `InitiativeCalendar.drag-reschedule.test.tsx` (nowy case)

### CAL-14 — Drag rollback przy błędzie PUT
- **Powierzchnia:** InitiativeCalendar drop · **Typ:** component
- **Precondition/seed:** T task:1 start/end 06-15, onReschedule spy, Api.put reject 500.
- **Kroki:** 1. render. 2. dragstart. 3. drop 06-20. 4. flush.
- **JAKOŚĆ:** override optimistic (saving); Api.put rzuca → catch usuwa override; onReschedule NIE; chip wraca na 15; brak duplikatu.
- **GRAFIKA:** Krótki opacity-60 na 20, po rollbacku chip na 15 pełna opacity; brak toastu danger w komponencie.
- **Screenshot:** `docs/qa/screens/m13-exec/calendar/cal-14-drag-rollback.png`
- **OCENA:** (a) po rejekcie chip na 15, onReschedule nie, 1 PUT; (b) brak osieroconego chipa na 20.
- **Wykonanie:** Headless ✅ · `InitiativeCalendar.drag-reschedule.test.tsx` (nowy case)

### CAL-15 — Drag kamienia → callback BEZ PUT na /tasks
- **Powierzchnia:** InitiativeCalendar drop · **Typ:** component
- **Precondition/seed:** M milestone:9 start/end 06-12, onReschedule spy, Api.put mock.
- **Kroki:** 1. render. 2. dragstart M. 3. drop 06-16.
- **JAKOŚĆ:** sourceKind='milestone' → PUT pominięty (if task); Api.put 0×; onReschedule('milestone:9','milestone','9','06-16','06-16'); override (chip na 16); persist u caller.
- **GRAFIKA:** Chip amber na 16; bez danger.
- **Screenshot:** `docs/qa/screens/m13-exec/calendar/cal-15-drag-milestone-callback.png`
- **OCENA:** (a) 0 PUT + callback sourceKind='milestone'; (b) chip amber na 16.
- **Wykonanie:** Headless ✅ · `InitiativeCalendar.drag-reschedule.test.tsx` (nowy case)

### CAL-16 — Read-only: brak onReschedule → nie-draggable, drop no-op
- **Powierzchnia:** InitiativeCalendar · **Typ:** component
- **Precondition/seed:** T task:1 06-15, bez onReschedule.
- **Kroki:** 1. render read-only. 2. draggable. 3. drop 18.
- **JAKOŚĆ:** draggable={!!onReschedule}=false; brak cursor-grab; drop bez PUT; chip na 15.
- **GRAFIKA:** Chipy bez kursora grab; statyczne; siatka+marker renderują.
- **Screenshot:** `docs/qa/screens/m13-exec/calendar/cal-16-read-only.png`
- **OCENA:** (a) draggable=false + 0 PUT; (b) brak cursor-grab.
- **Wykonanie:** Headless ✅ · `InitiativeCalendar.drag-reschedule.test.tsx`

### CAL-17 — Filtr statusu: select zawęża chipy
- **Powierzchnia:** InitiativeCalendar toolbar select · **Typ:** component
- **Precondition/seed:** T1 IN_PROGRESS 06-10, T2 DONE 06-12, T3 IN_PROGRESS 06-20.
- **Kroki:** 1. render. 2. select obecny. 3. DONE. 4. Zlicz chipy.
- **JAKOŚĆ:** statuses=['IN_PROGRESS','DONE'] unikalne; domyślnie all; DONE → tylko T2 (12); all → 3.
- **GRAFIKA:** Select w toolbarze; po filtrze 1 chip; bez danger.
- **Screenshot:** `docs/qa/screens/m13-exec/calendar/cal-17-status-filter.png`
- **OCENA:** (a) DONE→1(12), all→3; (b) select + filtr wizualny.
- **Wykonanie:** Headless ✅ · `InitiativeCalendar.status-filter.test.tsx`

### CAL-18 — Filtr ukryty gdy żaden item nie ma statusu
- **Powierzchnia:** InitiativeCalendar toolbar · **Typ:** component
- **Precondition/seed:** T1/T2 status=null.
- **Kroki:** 1. render. 2. Brak select.
- **JAKOŚĆ:** statuses puste → select nie renderowany; toggle month/week jest; wszystkie itemy widoczne.
- **GRAFIKA:** Toolbar bez selecta; layout nie rozjeżdża się (flex-1 spacer).
- **Screenshot:** `docs/qa/screens/m13-exec/calendar/cal-18-no-status-filter.png`
- **OCENA:** (a) 0 selectów, wszystkie chipy; (b) toolbar wyrównany.
- **Wykonanie:** Headless ✅ · `InitiativeCalendar.no-status-filter.test.tsx`

### CAL-19 — Spójność z Gantt: ten sam scheduleItems
- **Powierzchnia:** TimelineSection toggle · **Typ:** e2e render + component
- **Precondition/seed:** seedTasks T1 06-15, M1 06-18, P1 06-10..06-20; time 06-15.
- **Kroki:** 1. openDoc, timeline. 2. calendar—zrzut. 3. gantt—zrzut. 4. Porównaj id/start/end/type.
- **JAKOŚĆ:** Oba z JEDNEGO buildScheduleItems; identyczne id/start/end/type (task:1/milestone:1/phase:1); handleScheduleReschedule współdzielony; zmiana w jednym → w drugim po przełączeniu.
- **GRAFIKA:** Te same 3 byty (kalendarz chipy / Gantt paski) z paletą task/milestone/phase.
- **Screenshot:** `docs/qa/screens/m13-exec/calendar/cal-19-calendar-gantt-parity.png`
- **OCENA:** (a) id/start/end identyczne (zero dryfu); (b) te same byty/kolory.
- **Wykonanie:** Headless ✅ · do-build

### CAL-20 — Snap-to-day: drag zachowuje długość
- **Powierzchnia:** InitiativeCalendar drop · **Typ:** component
- **Precondition/seed:** T task:7 start 06-10 end 06-14 (4 dni), onReschedule spy, PUT mock.
- **Kroki:** 1. render. 2. dragstart. 3. drop 06-17.
- **JAKOŚĆ:** delta=+7; newStart 06-17, newEnd shiftIso(14,+7)=06-21 (długość 4); brak ułamków (Math.round); PUT 17/21.
- **GRAFIKA:** Chip równo na komórce 17 (snap), nie „pomiędzy".
- **Screenshot:** `docs/qa/screens/m13-exec/calendar/cal-20-snap-length.png`
- **OCENA:** (a) newStart/End=17/21, długość=4; (b) chip wyrównany do komórki.
- **Wykonanie:** Headless ✅ · `InitiativeCalendar.snap-length.test.tsx`

### CAL-21 — Itemy bez daty (undated) → osobny bucket
- **Powierzchnia:** InitiativeCalendar undated · **Typ:** component
- **Precondition/seed:** T1 06-15, T2 start=null, M2 start=null.
- **Kroki:** 1. render. 2. Siatka (1 chip) + bucket undated.
- **JAKOŚĆ:** byDay tylko T1; undated=[T2,M2]; bucket z licznikiem (2); chipy undated nie-draggable.
- **GRAFIKA:** Sekcja „undated (2)" pod siatką, kropki wg typu; flex-wrap; border-t.
- **Screenshot:** `docs/qa/screens/m13-exec/calendar/cal-21-undated.png`
- **OCENA:** (a) grid=1 + undated=2; (b) bucket z licznikiem+kolorami.
- **Wykonanie:** Headless ✅ · `InitiativeCalendar.undated.test.tsx`

### CAL-22 — i18n PL/EN: toolbar i miesiąc
- **Powierzchnia:** InitiativeCalendar (i18n) · **Typ:** e2e render PL+EN
- **Precondition/seed:** items=[T1 06-15]; PL i EN; time 06-15.
- **Kroki:** 1. PL—zrzut. 2. EN—zrzut. 3. month/week/today/allStatuses/empty/undated.
- **JAKOŚĆ:** Klucze calendarView.* rozwiązane; monthLabel toLocaleDateString wg locale (PL „czerwiec"/EN „June"); weekday lokalizowane.
- **GRAFIKA:** Brak bare-keys; capitalize spójny; brak ucięć w PL.
- **Screenshot:** `docs/qa/screens/m13-exec/calendar/cal-22-i18n-pl.png` (+ -en)
- **OCENA:** (a) 0 bare-keys PL/EN, miesiąc/weekday zlokalizowane; (b) brak overflow PL.
- **Wykonanie:** Headless 🟡 · do-build

### CAL-23 — Dark mode: kontrast siatki/chipów/markera
- **Powierzchnia:** InitiativeCalendar (dark) · **Typ:** e2e render + real
- **Precondition/seed:** task 06-10, milestone 06-15, phase 06-20, forceTheme dark.
- **Kroki:** 1. render. 2. dark. 3. zrzut.
- **JAKOŚĆ:** Klasy dark: dark:bg-navy-900, dark:border-navy-800, out-of-month dark:bg-navy-950/40, marker dark:text-primary-400; logika niezmienna.
- **GRAFIKA:** Tło navy, chipy dark:bg-navy-800 czytelny tekst; kropki primary/amber/emerald kontrast; marker primary-400; bez danger-fill.
- **Screenshot:** `docs/qa/screens/m13-exec/calendar/cal-23-dark.png`
- **OCENA:** (a) klasy dark, dane jak light; (b) kontrast WCAG, 3 kropki odróżnialne.
- **Wykonanie:** Headless ✅ · do-build

### CAL-24 — Light mode: kanon, brak crimson-leak/danger-fill
- **Powierzchnia:** InitiativeCalendar (light) · **Typ:** e2e render + real
- **Precondition/seed:** jak CAL-23, forceTheme light.
- **Kroki:** 1. render. 2. light. 3. zrzut. 4. Skan *-danger-*.
- **JAKOŚĆ:** Zero klas danger/crimson (paleta primary/amber/emerald/slate/navy); filter nie koloruje danger; dane jak dark.
- **GRAFIKA:** bg-white, slate bordery, chipy bg-slate-100; marker primary-600; zgodność CANON; brak czerwonych wypełnień.
- **Screenshot:** `docs/qa/screens/m13-exec/calendar/cal-24-light.png`
- **OCENA:** (a) zero danger/crimson w DOM; (b) paleta kanoniczna, czytelność.
- **Wykonanie:** Headless ✅ · do-build

### CAL-25 — Viewport wąski: 7-kolumnowa siatka nie łamie layoutu
- **Powierzchnia:** InitiativeCalendar (responsywność) · **Typ:** real-browser resize
- **Precondition/seed:** T1 długi tytuł 06-15, viewport ~375px.
- **Kroki:** 1. render real. 2. 375px. 3. zrzut. 4. Overflow toolbar/komórek.
- **JAKOŚĆ:** grid-cols-7 utrzymane; toolbar flex-wrap zawija; chip truncate zapobiega rozjazdowi.
- **GRAFIKA:** 7 wąskich kolumn; toolbar w 2 rzędy; brak horizontal-scroll; tytuł ellipsis.
- **Screenshot:** `docs/qa/screens/m13-exec/calendar/cal-25-narrow-viewport.png`
- **OCENA:** (a) 7 kolumn + flex-wrap bez h-scroll; (b) chip truncate, zwarty layout.
- **Wykonanie:** Headless 🟡 · real-browser

### CAL-26 — Duże dane: 50 itemów wydajność/czytelność
- **Powierzchnia:** InitiativeCalendar (skala) · **Typ:** component + e2e render
- **Precondition/seed:** 50 zadań po czerwcu, 6× na 06-15; time 06-15.
- **Kroki:** 1. render 50. 2. Czas mount. 3. Stacking 15. 4. zrzut.
- **JAKOŚĆ:** byDay grupuje 50; useMemo bez rekomputacji; 15=6 chipów stack; brak crashy; <200ms sanity jsdom.
- **GRAFIKA:** Gęsty dzień stos chipów space-y-1 w min-h-[84px]; numery czytelne; brak nakładania.
- **Screenshot:** `docs/qa/screens/m13-exec/calendar/cal-26-50-items.png`
- **OCENA:** (a) 50 rozłożone, 15=6 chipów; (b) stacking czytelny, brak overflow.
- **Wykonanie:** Headless ✅ · `InitiativeCalendar.scale-50.test.tsx`

### CAL-27 — Współbieżność: 2 sesje reschedule tego samego zadania
- **Powierzchnia:** TimelineSection drag (round-trip) · **Typ:** real-browser/integration (real DB)
- **Precondition/seed:** task:5 start 06-15; sesja A i B ta sama inicjatywa.
- **Kroki:** 1. A: drag na 18 (PUT). 2. B: drag na 22 (PUT). 3. Reload obu. 4. DB+UI.
- **JAKOŚĆ:** Każda sesja własny PUT; brak optimistic-lock → last-write-wins (22) udokumentowane; reload → oba czytają 22; brak utraty/duplikacji.
- **GRAFIKA:** Po reload oba pokazują chip na 22; brak osieroconego na 18.
- **Screenshot:** `docs/qa/screens/m13-exec/calendar/cal-27-concurrency-lww.png`
- **OCENA:** (a) DB+oba UI=22 (LWW, brak duplikatu); (b) jeden chip na 22.
- **Wykonanie:** Headless ❌ · real-browser

### CAL-28 — A11y: aria chevronów, fokus, semantyka selecta
- **Powierzchnia:** InitiativeCalendar (a11y) · **Typ:** component axe + real keyboard
- **Precondition/seed:** T1 06-15 IN_PROGRESS, onReschedule fn.
- **Kroki:** 1. render. 2. getByLabelText prev/next. 3. Tab. 4. axe.
- **JAKOŚĆ:** Chevrony aria-label (prev/next); przyciski natywne button; select natywny; znana luka: chipy DnD mouse-only (brak klawiaturowego reschedule) — zaraportuj.
- **GRAFIKA:** Focus-ring na przyciskach (niebieski); kolejność tab logiczna.
- **Screenshot:** `docs/qa/screens/m13-exec/calendar/cal-28-a11y-focus.png`
- **OCENA:** (a) aria-labels, axe bez critical, gap DnD odnotowany; (b) focus-ring + tab-order.
- **Wykonanie:** Headless 🟡 · `InitiativeCalendar.a11y.test.tsx`

### CAL-29 — Konsola bez błędów przy pełnym cyklu
- **Powierzchnia:** InitiativeCalendar (stabilność) · **Typ:** real-browser console
- **Precondition/seed:** Mix task+milestone+phase wokół 06-15; onReschedule fn; PUT OK.
- **Kroki:** 1. Console listener. 2. toggle/prev/next/today/filtr/drag task/drag kamień. 3. Logi.
- **JAKOŚĆ:** Zero console.error/React-warning (klucze it.id/dIso; select value zawsze string; brak setState-unmounted); 4xx tylko w teście rollback.
- **GRAFIKA:** Brak czerwonych overlayów dev; UI stabilne.
- **Screenshot:** `docs/qa/screens/m13-exec/calendar/cal-29-console-clean.png`
- **OCENA:** (a) 0 error/warn po cyklu; (b) brak overlayów, UI stabilne.
- **Wykonanie:** Headless 🟡 · real-browser

### CAL-30 — Strefa czasowa / granice doby + weekend/przełom
- **Powierzchnia:** InitiativeCalendar + initiativeSchedule (TZ) · **Typ:** component TZ + e2e render
- **Precondition/seed:** T_eom due 06-30T23:30+02:00, T_w 06-28 (niedziela); TZ=UTC i Europe/Warsaw; time 06-15.
- **Kroki:** 1. UTC—data-day T_eom. 2. Warsaw—data-day T_eom. 3. T_w niedziela + przełom 30↔1.
- **JAKOŚĆ:** toIsoDate=toISOString().slice(0,10) (UTC) — ryzyko shift-o-1-dzień; test DOKUMENTUJE który dzień + czy zgodny z Gantt (oba przez toIsoDate, więc spójne nawet jeśli przesunięte); T_w w 7. kolumnie; 30 w czerwcu, 1 lip wyszarzone.
- **GRAFIKA:** Chip granicy doby w tej samej komórce w kalendarzu i Gantt; weekend w kolumnach 6–7; 1 lip bg-slate-50/60.
- **Screenshot:** `docs/qa/screens/m13-exec/calendar/cal-30-tz-boundary-weekend.png`
- **OCENA:** (a) dzień T_eom identyczny w kalendarzu i Gantt (spójność toIsoDate) + udokumentowany; weekend/przełom poprawne; (b) granica doby spójna, 1 lip wyszarzony.
- **Wykonanie:** Headless ✅ · `InitiativeCalendar.tz-boundary.test.tsx`

---

# ARTEFAKT 5 — TASKI (TSK-01…30)

> Powierzchnie: `TasksMilestonesSection.tsx` (TABELA — nie karty; status neutral-shell + kolorowa kropka §4.2 bez danger-fill poza blocked; source manual/AI; due jako chip Calendar; modal create title-required; AI proposal add/remove/reorder; filtry/sort-by-due), `tasks.routes.ts`/`TaskController` (`PUT /:id {startedAt,dueDate}` org-scope + side-effecty), `buildScheduleItems` (wspólne źródło Kalendarz+Gantt).

### TSK-01 — Tworzenie zadania (happy, manual)
- **Powierzchnia:** TasksMilestonesSection modal + `POST /api/tasks` · **Typ:** happy CRUD create
- **Precondition/seed:** seedInitiative + 0 zadań; sekcja Tasks.
- **Kroki:** 1. „Add task". 2. Tytuł+Owner. 3. „Create task".
- **JAKOŚĆ:** POST `{title, status:'todo', priority:'medium', taskType:'execution', source:'manual', dueDate:null, assigneeId, initiativeId, projectId}`; 201+id; wiersz optymistyczny; licznik=1, stopka 0/1 done; status todo.
- **GRAFIKA:** Wiersz: status-shell neutralny (slate) + szara kropka „To Do", priorytet „Średni" niebieski, owner, Due „—", Source ikona User. Modal zamknięty. Bez danger-fill.
- **Screenshot:** `docs/qa/screens/m13-exec/tasks/tsk-01-create-happy.png`
- **OCENA:** (a) POST body + 201 + wiersz todo; (b) neutral-shell+szara kropka, zero danger-fill.
- **Wykonanie:** Headless 🟡 · real-browser

### TSK-02 — Walidacja: pusty tytuł blokuje
- **Powierzchnia:** modal create · **Typ:** walidacja
- **Precondition/seed:** 0 zadań; modal otwarty.
- **Kroki:** 1. Pusty tytuł. 2. Najedź „Create".
- **JAKOŚĆ:** „Create" disabled (!newTaskTitle.trim()); handleCreateInlineTask early-return — 0 POST; lista bez zmian.
- **GRAFIKA:** Przycisk opacity-50; modal otwarty; brak toastu (cicha blokada).
- **Screenshot:** `docs/qa/screens/m13-exec/tasks/tsk-02-empty-title-disabled.png`
- **OCENA:** (a) 0 POST + disabled; (b) przycisk wyłączony.
- **Wykonanie:** Headless ✅ · plik

### TSK-03 — Edycja zadania (otwarcie panelu via tytuł)
- **Powierzchnia:** wiersz → onOpenTask · **Typ:** happy CRUD edit-entry
- **Precondition/seed:** seedTasks 1 zadanie.
- **Kroki:** 1. Klik tytuł. 2. onOpenTask(id).
- **JAKOŚĆ:** Klik → onOpenTask?.(task.id) z poprawnym id; ta sama akcja z menu „Open task".
- **GRAFIKA:** Tytuł jako link, hover indigo; tooltip=tytuł; truncate 38% bez łamania.
- **Screenshot:** `docs/qa/screens/m13-exec/tasks/tsk-03-open-task.png`
- **OCENA:** (a) onOpenTask z poprawnym id; (b) hover-indigo + truncate.
- **Wykonanie:** Headless 🟡 · real-browser

### TSK-04 — Usunięcie zadania (delete z menu)
- **Powierzchnia:** menu kebab → `DELETE /api/tasks/:id` · **Typ:** happy CRUD delete
- **Precondition/seed:** seedTasks 2 zadania.
- **Kroki:** 1. Kebab #2. 2. „Delete".
- **JAKOŚĆ:** Api.delete('/tasks/<id>'); wiersz znika (filter), toast taskRemoved; licznik 2→1; stopka. Błąd → toast failedToRemove, wiersz zostaje.
- **GRAFIKA:** „Delete" text-danger-500 (jedyne czerwone w menu); menu zamyka się; AnimatePresence wyjścia.
- **Screenshot:** `docs/qa/screens/m13-exec/tasks/tsk-04-delete.png`
- **OCENA:** (a) DELETE + wiersz znika + toast; (b) „Delete" czerwone tylko jako akcja.
- **Wykonanie:** Headless 🟡 · real-browser

### TSK-05 — Kamień vs zadanie w harmonogramie
- **Powierzchnia:** buildScheduleItems + `POST /:id/milestone` · **Typ:** milestone vs task
- **Precondition/seed:** 1 zadanie z dueDate, 1 milestone (is_milestone, milestone_target_date).
- **Kroki:** 1. buildScheduleItems. 2. Porównaj typy.
- **JAKOŚĆ:** Zadanie → {id:'task:<id>', type:'task', end=start gdy tylko due}; milestone → {id:'milestone:<id>', type:'milestone', start===end}; sourceKind zgodny; milestone nie-draggable w Gantt.
- **GRAFIKA:** Gantt: zadanie pasek, milestone punkt; lista: milestone ikoną; bez danger-fill.
- **Screenshot:** `docs/qa/screens/m13-exec/tasks/tsk-05-milestone-vs-task.png`
- **OCENA:** (a) typy/ids/start=end; (b) pasek vs punkt.
- **Wykonanie:** Headless ✅ · plik

### TSK-06 — Status flow: todo → in_progress
- **Powierzchnia:** status + `PUT /api/pmo/tasks/:id` (status) · **Typ:** status flow
- **Precondition/seed:** 1 zadanie todo.
- **Kroki:** 1. → In Progress. 2. Reload.
- **JAKOŚĆ:** PUT status:'in_progress'; normalizeStatus→in_progress; po reload in_progress; side-effecty Activity/Audit.
- **GRAFIKA:** Kropka bg-blue-500 animate-pulse, „W trakcie"; shell neutralny; bez danger-fill.
- **Screenshot:** `docs/qa/screens/m13-exec/tasks/tsk-06-todo-to-inprogress.png`
- **OCENA:** (a) status persist=in_progress; (b) niebieska pulsująca kropka + neutralny shell.
- **Wykonanie:** Headless 🟡 · real-browser

### TSK-07 — Status flow: in_progress → done (stopka)
- **Powierzchnia:** status + stopka tasksDone/length · **Typ:** status flow
- **Precondition/seed:** 2 zadania: 1 done, 1 in_progress.
- **Kroki:** 1. Drugie → done. 2. Stopka.
- **JAKOŚĆ:** done persist; normalizeStatus('completed')&('done')→done; stopka 2/2 done.
- **GRAFIKA:** Kropka emerald-500 „Ukończone"; stopka „2/2 Ukończone".
- **Screenshot:** `docs/qa/screens/m13-exec/tasks/tsk-07-done-counter.png`
- **OCENA:** (a) done + licznik; (b) emerald dot + stopka.
- **Wykonanie:** Headless 🟡 · real-browser

### TSK-08 — Status flow: blocked (jedyny z czerwienią)
- **Powierzchnia:** status blocked · **Typ:** status flow / kolory
- **Precondition/seed:** 1 zadanie blocked.
- **Kroki:** 1. render blocked. 2. Kolory.
- **JAKOŚĆ:** normalizeStatus('blocked')→blocked; „Zablokowane"; filtr blocked pokazuje tylko ten.
- **GRAFIKA:** Kropka bg-danger-500 (czerwień DOZWOLONA jako sygnał) ale shell neutralny — czerwień TYLKO w kropce, nie tło wiersza.
- **Screenshot:** `docs/qa/screens/m13-exec/tasks/tsk-08-blocked.png`
- **OCENA:** (a) blocked + filtr; (b) czerwień tylko w kropce, brak danger-fill tła.
- **Wykonanie:** Headless ✅ · plik

### TSK-09 — AI-propozycja backlogu (generate, lista pusta)
- **Powierzchnia:** proposeTasksWithAI('generate') · **Typ:** AI add
- **Precondition/seed:** 0 zadań; AI ON; stub zwraca 10 w add.
- **Kroki:** 1. AI (generate bo length 0). 2. „Apply".
- **JAKOŚĆ:** generate: remove=[], reorder=undefined; add sort inferPhaseRank, max 25; Apply → sekwencyjne POST source:'ai' status:'todo'; toast appliedAiProposalsAdded.
- **GRAFIKA:** Modal: „To remove (0)" empty, „To add (10)" checkboxy zaznaczone; nowe wiersze Source Sparkles „AI".
- **Screenshot:** `docs/qa/screens/m13-exec/tasks/tsk-09-ai-generate.png`
- **OCENA:** (a) N×POST source=ai + toast; (b) modal + AI badge.
- **Wykonanie:** Headless 🟡 · real-browser

### TSK-10 — AI-propozycja review (add+remove+reorder)
- **Powierzchnia:** proposeTasksWithAI('review') · **Typ:** AI add/remove/reorder
- **Precondition/seed:** 5 zadań (1 placeholder); stub 2 add, 1 remove (istniejący), reorder.
- **Kroki:** 1. AI review. 2. Zaznacz remove + Apply order. 3. Apply (confirm).
- **JAKOŚĆ:** remove ⊆ existingTaskIds; reorder.order dedup tylko istniejące; Apply: POST add, DELETE remove (po confirm), setTaskOrderOverride; toast appliedAiProposalsAddedRemovedReordered.
- **GRAFIKA:** 3 sekcje; „To remove" amber-50 (nie danger); lista w nowej kolejności.
- **Screenshot:** `docs/qa/screens/m13-exec/tasks/tsk-10-ai-review.png`
- **OCENA:** (a) POST+DELETE+reorder + confirm; (b) remove amber, kolejność zastosowana.
- **Wykonanie:** Headless 🟡 · real-browser

### TSK-11 — AI „brak sugestii" (no-fake)
- **Powierzchnia:** proposeTasksWithAI no-change · **Typ:** AI brak fake
- **Precondition/seed:** 6 zadań; stub {add:[],remove:[],reorder:{order:[]}}.
- **Kroki:** 1. AI review.
- **JAKOŚĆ:** add=0,remove=0,brak reorder → modal NIE otwiera; setAiNoSuggestionsMessage; znika po 7000ms; 0 POST.
- **GRAFIKA:** Callout purple „AI" + akcja „aiAddTask"; brak modala; lista bez zmian.
- **Screenshot:** `docs/qa/screens/m13-exec/tasks/tsk-11-ai-no-suggestions.png`
- **OCENA:** (a) 0 POST + callout zamiast modala; (b) purple Callout, zero fake.
- **Wykonanie:** Headless 🟡 · real-browser

### TSK-12 — AI off / readonly — brak propozycji
- **Powierzchnia:** readonly guards · **Typ:** rola/readonly + AI off
- **Precondition/seed:** readonly=true, 3 zadania.
- **Kroki:** 1. Próba AI/add/delete.
- **JAKOŚĆ:** proposeTasksWithAI/proposeOne/handleStartInlineAdd early-return przy readonly (0 req); „Add task" ukryty; menu bez „Delete".
- **GRAFIKA:** Brak „Add task"; menu tylko „Open"/„Duplicate"; Callout AI bez akcji.
- **Screenshot:** `docs/qa/screens/m13-exec/tasks/tsk-12-readonly.png`
- **OCENA:** (a) 0 mutacji + brak Delete; (b) brak Add + menu okrojone.
- **Wykonanie:** Headless ✅ · plik

### TSK-13 — Edycja due → PUT (chip Due)
- **Powierzchnia:** panel → `PUT /api/pmo/tasks/:id` · **Typ:** edycja daty
- **Precondition/seed:** 1 zadanie bez dueDate.
- **Kroki:** 1. dueDate=2026-07-31. 2. Zapisz. 3. Lista.
- **JAKOŚĆ:** PUT z dueDate; updateTask org-scope (id AND organization_id), due_date=?, params[last]=taskId; po reload Due sformatowana (formatDueDate).
- **GRAFIKA:** Kolumna Due chip ikona Calendar+data; sort wg due.
- **Screenshot:** `docs/qa/screens/m13-exec/tasks/tsk-13-due-put.png`
- **OCENA:** (a) PUT org-scope persist due_date; (b) chip Due z kalendarzem.
- **Wykonanie:** Headless ✅ · plik (`tasks-update.test.ts`)

### TSK-14 — Edycja start+due → jeden UPDATE
- **Powierzchnia:** `PUT {startedAt,dueDate}` · **Typ:** API kontrakt
- **Precondition/seed:** 1 zadanie started_at=null due_date=null.
- **Kroki:** 1. PUT {startedAt:07-01, dueDate:07-31}.
- **JAKOŚĆ:** Jeden UPDATE z started_at=? ORAZ due_date=?; params obie+taskId last; 200 (wg „persists BOTH").
- **GRAFIKA:** Gantt pasek 07-01→07-31 (start≠end rozciągłość); lista Due=31.07.
- **Screenshot:** `docs/qa/screens/m13-exec/tasks/tsk-14-start-due-update.png`
- **OCENA:** (a) single UPDATE oba pola + org-scope; (b) pasek Gantt rozciągnięty.
- **Wykonanie:** Headless ✅ · plik (integration)

### TSK-15 — Zasilenie Kalendarza (data → chip)
- **Powierzchnia:** buildScheduleItems → Kalendarz · **Typ:** zasilenie Kalendarza
- **Precondition/seed:** zadanie due 2026-07-15, milestone 07-20.
- **Kroki:** 1. buildScheduleItems. 2. Render Kalendarz.
- **JAKOŚĆ:** Zadanie → ScheduleItem start=end='07-15' na 15.07; milestone 07-20 na 20.07; toIsoDate yyyy-mm-dd; Kalendarz+Gantt z TEGO źródła (no drift).
- **GRAFIKA:** Chip zadania 15.07, milestone 20.07; ikony różne; bez danger-fill.
- **Screenshot:** `docs/qa/screens/m13-exec/tasks/tsk-15-calendar-feed.png`
- **OCENA:** (a) ScheduleItem na właściwych dniach z jednego źródła; (b) chip+milestone na siatce.
- **Wykonanie:** Headless ✅ · plik

### TSK-16 — Zasilenie Gantt: zadanie draggable, milestone nie
- **Powierzchnia:** InitiativeGantt drag → PUT · **Typ:** zasilenie Gantt
- **Precondition/seed:** task 06-01→06-05, milestone 06-10.
- **Kroki:** 1. Drag pasek zadania. 2. Drag milestone.
- **JAKOŚĆ:** Pasek zadania cursor-grab+onPointerDown; drag → Api.put('/api/pmo/tasks/<sourceId>',{startedAt,dueDate}) + onReschedule; milestone/phase bez grab → 0 task PUT (wg Gantt.drag test).
- **GRAFIKA:** Pasek z uchwytem; milestone nieprzeciągalny punkt.
- **Screenshot:** `docs/qa/screens/m13-exec/tasks/tsk-16-gantt-drag.png`
- **OCENA:** (a) task→PUT, milestone→0 PUT; (b) task uchwyt, milestone nie.
- **Wykonanie:** Headless ✅ · plik

### TSK-17 — Walidacja daty: due < start
- **Powierzchnia:** panel daty + PUT · **Typ:** walidacja
- **Precondition/seed:** 1 zadanie started_at=07-31.
- **Kroki:** 1. dueDate=07-01 (< start). 2. Zapisz.
- **JAKOŚĆ:** Odwrócony zakres: pasek Gantt zdegenerowany/odwrócony; oczekiwane: walidacja FE (brak PUT) LUB PUT przechodzi + UI sygnalizuje; udokumentuj — `UpdateTaskSchema` może NIE wymuszać due≥start (LUKA do raportu).
- **GRAFIKA:** Walidacja → komunikat przy polu; brak → pasek odwrócony (dowód luki).
- **Screenshot:** `docs/qa/screens/m13-exec/tasks/tsk-17-due-before-start.png`
- **OCENA:** (a) due<start zablokowane LUB jawnie zaraportowane jako brak guardu; (b) stan spójny/komunikat.
- **Wykonanie:** Headless 🟡 · real-browser

### TSK-18 — Walidacja: zła data → „—" w Due
- **Powierzchnia:** formatDueDate + toIsoDate · **Typ:** walidacja/fallback
- **Precondition/seed:** dueDate='not-a-date' oraz ''.
- **Kroki:** 1. render.
- **JAKOŚĆ:** formatDueDate('not-a-date') NaN → „—"; toIsoDate('')/null → null (undated); brak crasha.
- **GRAFIKA:** Due „—" bez ikony; brak czerwonego błędu; wiersz na koniec sortowania (MAX_SAFE_INTEGER).
- **Screenshot:** `docs/qa/screens/m13-exec/tasks/tsk-18-bad-date.png`
- **OCENA:** (a) „—" + null + brak crasha; (b) Due „—" bez ikony.
- **Wykonanie:** Headless ✅ · plik

### TSK-19 — Org-scope / cross-org: 404
- **Powierzchnia:** `PUT /api/pmo/tasks/:id` · **Typ:** org-scope/security
- **Precondition/seed:** task-1 w org-1; żądanie org-2.
- **Kroki:** 1. PUT {startedAt} jako org-2.
- **JAKOŚĆ:** Load org-scoped [task-1, org-2] → brak → 404 „Task not found"; 0 UPDATE; cross-org niewidoczny (wg „404 cross-org").
- **GRAFIKA:** n/d (API).
- **Screenshot:** `docs/qa/screens/m13-exec/tasks/tsk-19-cross-org-404.png`
- **OCENA:** (a) 404 + 0 UPDATE + org-scoped load; (b) n/d.
- **Wykonanie:** Headless ✅ · plik

### TSK-20 — 401 bez organizacji
- **Powierzchnia:** `PUT /api/pmo/tasks/:id` · **Typ:** auth
- **Precondition/seed:** request bez organizationId.
- **Kroki:** 1. PUT {startedAt} bez org.
- **JAKOŚĆ:** 401 „Unauthorized"; 0 UPDATE (wg „401 no org").
- **GRAFIKA:** n/d.
- **Screenshot:** `docs/qa/screens/m13-exec/tasks/tsk-20-401.png`
- **OCENA:** (a) 401 + 0 UPDATE; (b) n/d.
- **Wykonanie:** Headless ✅ · plik

### TSK-21 — No-op PUT (brak rozpoznanych pól)
- **Powierzchnia:** `PUT /api/pmo/tasks/:id` · **Typ:** edge/no-op
- **Precondition/seed:** task-1 istnieje.
- **Kroki:** 1. PUT {unknownField:'x'}.
- **JAKOŚĆ:** Brak UPDATE (findUpdateCall===null); zwraca current row {id:'task-1'}; brak side-effectów statusu.
- **GRAFIKA:** n/d (lista bez zmian).
- **Screenshot:** `docs/qa/screens/m13-exec/tasks/tsk-21-noop.png`
- **OCENA:** (a) 0 UPDATE + current row; (b) n/d.
- **Wykonanie:** Headless ✅ · plik

### TSK-22 — Persist po reload (utworzone + data)
- **Powierzchnia:** create + PUT + reload · **Typ:** persistence
- **Precondition/seed:** świeża inicjatywa; 2 zadania, jednemu due.
- **Kroki:** 1. POST. 2. PUT due. 3. Reload. 4. Sekcja Tasks.
- **JAKOŚĆ:** Po reload GET 2 zadania z DB; due zachowane; licznik=2, stopka; legacy demo-task-* cleanup.
- **GRAFIKA:** Lista identyczna; due-chip; brak migotania/utraty.
- **Screenshot:** `docs/qa/screens/m13-exec/tasks/tsk-22-persist-reload.png`
- **OCENA:** (a) 2 zadania+due przetrwają reload; (b) lista stabilna.
- **Wykonanie:** Headless 🟡 · real-browser

### TSK-23 — Pusty stan (zero zadań)
- **Powierzchnia:** empty branch · **Typ:** empty state
- **Precondition/seed:** 0 zadań.
- **Kroki:** 1. Sekcja Tasks.
- **JAKOŚĆ:** filteredTasks=0 i tasks=0 → noTasksYet (colSpan=8); brak licznika; brak stopki; „Add task" gdy nie readonly.
- **GRAFIKA:** Wycentrowany szary tekst; tabela z nagłówkami pusta; bez danger-fill.
- **Screenshot:** `docs/qa/screens/m13-exec/tasks/tsk-23-empty.png`
- **OCENA:** (a) noTasksYet + brak stopki; (b) czysty pusty stan.
- **Wykonanie:** Headless ✅ · plik

### TSK-24 — Filtr bez wyników (vs pusta lista)
- **Powierzchnia:** filtry + empty branch · **Typ:** filtrowanie/empty
- **Precondition/seed:** 3 zadania todo; statusFilter='blocked'.
- **Kroki:** 1. Status „Zablokowane". 2. Tabela.
- **JAKOŚĆ:** filteredTasks=0 ale tasks>0 → noResultsForFilters (NIE noTasksYet); licznik=3; filtry kombinowalne.
- **GRAFIKA:** „brak wyników dla filtrów" wycentrowany; select „Zablokowane"; licznik 3.
- **Screenshot:** `docs/qa/screens/m13-exec/tasks/tsk-24-no-filter-results.png`
- **OCENA:** (a) noResultsForFilters + licznik niezmieniony; (b) poprawny komunikat.
- **Wykonanie:** Headless ✅ · plik

### TSK-25 — Błąd/fallback: PUT 500 → toast
- **Powierzchnia:** PUT błąd · **Typ:** błąd/fallback
- **Precondition/seed:** 1 zadanie; stub PUT → 500.
- **Kroki:** 1. Ustaw due, zapisz (500). 2. UI.
- **JAKOŚĆ:** Błąd do UI; toast; data NIE utrwalona (reload → poprzednia wartość); create error → toast failedToCreateTask; delete error → failedToRemove + wiersz zostaje.
- **GRAFIKA:** Czerwony toast (dozwolone danger=komunikat); wiersz/data sprzed próby.
- **Screenshot:** `docs/qa/screens/m13-exec/tasks/tsk-25-put-500-rollback.png`
- **OCENA:** (a) toast + brak utrwalenia; (b) stan nie „udaje" zapisu.
- **Wykonanie:** Headless 🟡 · real-browser

### TSK-26 — Side-effecty: status → notyfikacja/Activity/Audit/EventBus
- **Powierzchnia:** TaskController.updateTask side-effecty · **Typ:** side-effecty
- **Precondition/seed:** task-1 todo, assignee/owner.
- **Kroki:** 1. PUT status (→blocked). 2. Wywołania serwisów.
- **JAKOŚĆ:** Po UPDATE: ActivityService.log, AuditEventsService.log, EventBus.publish; przy istotnej (assignee/blocked) notificationService.send fire-and-forget; brak dubla (por. finding dubla); 200.
- **GRAFIKA:** n/d (serwisowa) — opcjonalnie in-app notyfikacja.
- **Screenshot:** `docs/qa/screens/m13-exec/tasks/tsk-26-side-effects.png`
- **OCENA:** (a) Activity+Audit+EventBus raz, notyfikacja bez dubla; (b) n/d.
- **Wykonanie:** Headless ✅ · plik (mock serwisów)

### TSK-27 — Sortowanie wg due (+ override AI)
- **Powierzchnia:** sortedTasks memo · **Typ:** sortowanie
- **Precondition/seed:** 3 zadania: due 30.07, brak due, due 10.07.
- **Kroki:** 1. render. 2. AI reorder override (opcj).
- **JAKOŚĆ:** Domyślnie sort rosnąco wg dueDate (10.07,30.07,undated MAX_SAFE_INTEGER); override → ranking wg order, niewymienione na końcu, tiebreak due; numeracja index+1.
- **GRAFIKA:** Kolejność 10.07→30.07→„—"; numery #; po override kolejność z modala.
- **Screenshot:** `docs/qa/screens/m13-exec/tasks/tsk-27-sort-due.png`
- **OCENA:** (a) sort wg due + undated last + override; (b) poprawna kolejność/numeracja.
- **Wykonanie:** Headless ✅ · plik

### TSK-28 — Duża lista (50): wydajność, scroll, konsola
- **Powierzchnia:** tabela + filtry · **Typ:** duże listy/wydajność/konsola
- **Precondition/seed:** seedTasks 50 (mix).
- **Kroki:** 1. Sekcja. 2. Scroll. 3. Filtruj. 4. Konsola.
- **JAKOŚĆ:** Licznik „50"; filtr natychmiast (memo); sticky thead; ZERO React-warningów (duplicate/missing key).
- **GRAFIKA:** Tabela czytelna; kolumny stałe (table-fixed+colgroup); nagłówek przyklejony; bez rozjazdu; bez danger-fill poza blocked.
- **Screenshot:** `docs/qa/screens/m13-exec/tasks/tsk-28-large-50.png`
- **OCENA:** (a) filtr+sticky + konsola czysta; (b) 50 wierszy bez rozjazdu, sticky.
- **Wykonanie:** Headless 🟡 · real-browser

### TSK-29 — i18n PL/EN + dark/light
- **Powierzchnia:** całość sekcji · **Typ:** i18n + dark/light
- **Precondition/seed:** 4 zadania (todo/in_progress/done/blocked); forceTheme + locale.
- **Kroki:** 1. PL/light. 2. EN/light. 3. PL/dark. 4. EN/dark.
- **JAKOŚĆ:** Etykiety z TASK_STATUS_CONFIG.label[pl|en], PRIORITY_CONFIG, źródło „Ręczny/Manual"/„AI"; wszystko z t() (brak gołych `initiatives.tasksMilestonesSection.*`); filtry/empty/modal tłumaczone.
- **GRAFIKA:** Dark bg-navy-*, kropki kontrastowe; light slate; kolory statusów spójne; brak crimson-leak; danger-fill tylko blocked-dot; kanon §27.
- **Screenshot:** `docs/qa/screens/m13-exec/tasks/tsk-29-i18n-theme.png`
- **OCENA:** (a) PL/EN poprawne, 0 surowych kluczy; (b) oba motywy czytelne, brak crimson-leak.
- **Wykonanie:** Headless 🟡 · real-browser

### TSK-30 — A11y + responsywność + undated/untitled
- **Powierzchnia:** tabela, modal, viewport · **Typ:** a11y/responsywność/edge
- **Precondition/seed:** 1 zadanie pusty tytuł bez due; viewport 1680 i ~768.
- **Kroki:** 1. Tab po przyciskach. 2. Modal focus na tytule. 3. Viewport. 4. Undated/untitled.
- **JAKOŚĆ:** Modal autofocus (createTitleInputRef); przyciski klawiaturą, Esc/X zamyka; kebab title="actions"; pusty tytuł → fallback „untitled" (nie crash); bez due → „—" i start=null (undated).
- **GRAFIKA:** Wąski viewport overflow-x-auto bez rozbicia; focus:border-primary-400; modal wycentrowany; „untitled" szary czytelny.
- **Screenshot:** `docs/qa/screens/m13-exec/tasks/tsk-30-a11y-responsive-undated.png`
- **OCENA:** (a) autofocus+Esc+fallback untitled/undated bez crasha; (b) responsywny scroll + focus-ring + modal.
- **Wykonanie:** Headless 🟡 · real-browser

---

## Podsumowanie + sygnały do wykonania

**150 scenariuszy gotowych** (5 × 30), każdy z dwukryterialnym oczekiwanym wynikiem i screenem-dowodem. Rozkład: ~połowa ✅/🟡 headless (component/integration/render → zdjęcia automatyczne), reszta ❌ real-browser (modale, drag, persist round-trip, in-app center, a11y).

**Sygnały-luki wykryte przy pisaniu (do potwierdzenia/decyzji w trakcie testowania):**
1. **Decyzje (DEC-09):** banner FE keyuje po `type='GO_NO_GO'`, gate serwerowy po `pmo_domain='GOVERNANCE_DECISION_MAKING'` — seed musi ustawić oba, inaczej promocja nigdy nie przejdzie mimo approved GO_NO_GO w UI.
2. **Taski (TSK-17):** `UpdateTaskSchema` może NIE wymuszać `due≥start` — potencjalny brak guardu.
3. **Notyfikacje (NOT-22/23):** `notifyAssignment` niewpięty (brak call-site), `notifyDueBreach` bez crona — udokumentowane jako luki.
4. **Notyfikacje (NOT-19/24):** możliwy brak digest-runnera + treści notyfikacji emitowane EN serwerowo (i18n treści).

**Następny krok = faza testowania** (osobny start od CEO): wykonać scenariusze → zdjęcia → ocena dwukryterialna (jakość + grafika) per screen.
