# M13 — PEŁNY KATALOG TESTÓW (manualne + automatyczne) · G1 → V1

> **Data:** 2026-06-22 · **Branch:** `feat/deliverables-w1` → demo · **Autor:** CTO (Claude)
> **Cel:** jeden wykonywalny katalog testów M13 ułożony **per sub-moduł** (16 sub-modułów, serie G/R/C/K/V), zaprojektowany jako **blueprint do Playwrighta** — każdy scenariusz ma werdykt automatyzowalności headless + nazwę pliku-zdjęcia (dowód) + status pokrycia automatycznego. Po uruchomieniu speca zdjęcia lądują w `docs/qa/screens/m13-full/` = artefakt „zdjęcia z prac wykonanych".
> **Powiązane SSOT:** [`M13-STAN-PRACY-ODBIORY.md`](M13-STAN-PRACY-ODBIORY.md) (dashboard odbiorów) · [`_PLAN_TESTOW_M13.md`](_PLAN_TESTOW_M13.md) (piramida + gaps) · [`../Testy manualne/TESTY_M13_INICJATYWY.md`](../Testy%20manualne/TESTY_M13_INICJATYWY.md) (121 scen. wg §powierzchni).

---

## 1. Jak czytać i uruchamiać

### Legenda werdyktów „Headless" (automatyzowalność w Playwright headless)
- **✅ headless** — w pełni automatyzowalny headless: render powierzchni (brak error-boundary) lub zachowanie serwera przez API. Daje deterministyczne zdjęcie.
- **🟡 częściowo** — render headless OK + zdjęcie, ale pełny dowód *funkcji* wymaga realnych danych/interakcji (MOCK_DB nie robi round-tripu create→list) lub przeniesienia do component/integration.
- **❌ real-browser/człowiek** — niewykonalny headless: modale wizardów/override (portal/session-effect nie montują się headless), drag real-mouse, AI live, pilot-role, kanały email, flaga ON + dane. Idzie przez realną przeglądarkę (computer-use / Piotr na demo) lub jako component/integration-test.

### Status pokrycia automatycznego
- **✅** — pokryte istniejącym plikiem (nazwa podana).
- **⬜ do-build** — luka, proponowana nazwa pliku podana.
- **⬜ blocked** — zablokowane decyzją (K2 ↔ Q6) lub brakiem implementacji (V1 gaps).

### Konwencja zdjęć
- Katalog: `docs/qa/screens/m13-full/` (nowy; istniejące przebiegi są w `m13-2026-06-21/`).
- Nazwa: `<id-scenariusza>.png` małymi literami, np. `g4-01-below-threshold-422.png`, `r3-01-calendar-month.png`.
- Helper: `shot(page, '<id>')` z `tests/e2e/m13/_m13.ts` (zmień `SHOTS_DIR` na `docs/qa/screens/m13-full` w nowym specu).

### Komendy
```bash
# Czyszczenie portów przed e2e (gotcha §7 planu):
pkill -f "playwright.*test"; pkill -f "vite preview"; pkill -f "tsx src/index"
for p in 3000 3001 3100 3101 4173; do lsof -ti:$p | xargs kill -9 2>/dev/null; done; rm -rf dist/assets dist

# E2E M13 (headless, MOCK_DB, write-access bootstrap, ~14 min build+run):
E2E_USE_WEB_SERVER=true NODE_OPTIONS=--max-old-space-size=8192 npx playwright test tests/e2e/m13/ --workers=2

# Component + integration (szybkie, CI je łapie):
npx vitest run tests/components/Initiatives/ tests/integration/initiatives/ tests/unit/initiatives/

# Tier0 PR-gate (zawiera M13 acceptance):
npm run test:e2e:tier0
```

### Harness (reużywalne helpery — `tests/e2e/m13/_m13.ts`)
`seedInitiative` · `seedTasks` · `openDoc(page,id,title)` (czeka na section-nav, nie na tytuł) · `gotoHub` · `forceTheme/setDark` · `suppressOnboarding/dismissOnboarding` · `sectionNavLocator/sectionNavButtons` · `shot(page,name)` · `readTestSupportState` (token write-access — NIE register-demo która jest read-only).

---

## 2. Tabela zbiorcza (per sub-moduł)

| Sub-moduł | Seria | Scen. manual | Auto ✅ istnieje | Auto ⬜ do-build | Headless ✅/🟡 | Real-browser ❌ |
|---|---|:--:|:--:|:--:|:--:|:--:|
| G1 flaga+próg | G | 4 | initiativeGateAi (12) | — | 3 | 1 |
| G2 readiness rollup | G | 6 | gateAiReadiness | gateAiReadinessCache | 3 | 3 |
| G3 timeline gate | G | 6 | gateTimeline | — | 4 | 2 |
| G4 endpoint+soft-block | G | 6 | gateAiCheck, gate-ai-soft-block, gateAiTelemetry | timeline-block case | 5 | 1 |
| G5 UI bramki | G | 10 | gateReadinessPayload | Pill/Panel/Modal component + e2e | 1 | 9 |
| R1 Taski | R | 8 | initiativeSchedule | TasksSection crud/ai-proposal, tasks.update | 5 | 3 |
| R2 Decyzje | R | 8 | — | DecisionsSection gate-banner/crud/sort, decisions.crud | 6 | 2 |
| R3 Kalendarz | R | 12 | InitiativeCalendar.drag (3) | views-filter, rollback, consistency | 9 | 3 |
| R4 Notyfikacje | R | 10 | notifications (4) | gate-role, org-scope, assignment, **due-breach (infra)** | 2 | 8 |
| C1 Generator dedup | C | 8 | initiativeSimilarity (7) | dedup component, similar-check route, client | 3 | 5 |
| C2 Teresa create | C | 6 | generateInitiativeTool (5) | registry, persona | 2 | 4 |
| K1 §B3 egzekwowanie | K | 6 | cardValidators (7), b3-hints (3) | validate-card endpoint, advisory-not-blocking | 5 | 1 |
| K2 CardContainer | K | 8 | — | **⬜ blocked Q6 (cały sub-moduł)** | (po build) | — |
| K3 linked-items | K | 6 | initiativeLinkedItems (6) | linkedItems endpoint, LinkedItemsSection component | 2 | 4 |
| K4 AI-fill | K | 7 | section-ai-noop (3) | ai-fill component, no-op component | 2 | 5 |
| V1 Gantt+drag | V | 13 (+4 portfolio) | Gantt.drag (3), Calendar.drag (3), m13-manual §5 | render/rollback/snap/toggle/consistency | 6 | 7 (z czego **4 = GAP brak implementacji**) |

**Suma:** ~128 scenariuszy manualnych · ~12 plików auto istnieje · ~24 plików auto do-build · K2 cały blocked Q6 · V1 ma 4 realne gapy w kodzie.

---

## 3. Katalog scenariuszy — sub-moduł po sub-module

> Każda sekcja: Cel · Epiki · Kod (FE/BE) · Testy automatyczne (tabela) · Scenariusze manual→Playwright (tabela z werdyktem headless + nazwą zdjęcia + auto-statusem).

<!-- ════════════════════════ SERIA G — BRAMKI AI ════════════════════════ -->
## SERIA G — bramki AI (G1–G5)

### G1 — Flaga + GATE_REQUIRED_SECTIONS + próg  · seria G (bramki AI)
**Cel:** Włączyć infrastrukturę bramki AI per-org (flaga + próg + kanon wymaganych sekcji per bramka), fail-safe OFF, bez zmiany zachowania żywych klientów.
**Epiki:** E1 flaga `initiativeGateAiEnabled` + próg (config, org-scope) · E2 `GATE_REQUIRED_SECTIONS` (mapa 9 bramek→sekcje, po Q1) · E3 odczyt progu per-org.
**Kod:** FE: — (N/A, backend/config) · BE: `server/src/constants/initiativeGateAi.ts`, `server/src/services/initiative/initiativeGateAiConfig.ts`, migracja `20260620_5000_*` (`initiative_feature_flags`)

**Testy automatyczne:**
| Poziom | Co weryfikuje | Plik | Status |
|---|---|---|---|
| unit | 9 bramek forward = AI gates; każda ma niepuste valid sekcje; regresywne/lateral puste; timeline tylko SCHEDULE/START; próg domyślny 75 | `tests/unit/initiatives/initiativeGateAi.test.ts` | ✅ |
| unit | config OFF gdy brak tabeli/wiersza; ON+threshold gdy enabled; coercion bigint-string; invalid→default; fail-safe OFF; `setInitiativeGateAiFlag` upsert | `tests/unit/initiatives/initiativeGateAi.test.ts` | ✅ |

**Scenariusze:**
| # | Scenariusz | Kroki | Oczekiwany wynik | Headless | Dowód | Auto-status |
|---|---|---|---|---|---|---|
| G1-01 | Flaga OFF → bramki bez zmian | Org bez wiersza flagi → przejście forward | Przejście jak dotąd; brak pigułki/soft-blocku; `enabled:false` | 🟡 | `g1-01-flag-off-no-change.png` | ✅ initiativeGateAi + gate-ai-soft-block |
| G1-02 | Flaga ON demo → infra aktywna | Org `enabled=1` → `POST /gate-ai-check` | `enabled:true`, readiness/timeline obecne | ❌ | `g1-02-flag-on-demo.png` | ✅ config; e2e ❌ real |
| G1-03 | Próg per-org | Org `threshold=85` → `getGateAiThreshold(org)` | Zwraca 85, nie 75 | ✅ | `g1-03-per-org-threshold.png` | ✅ initiativeGateAi |
| G1-04 | Fail-open gdy config brak | Brak tabeli/błąd DB → odczyt configu | OFF + próg 75; brak rzutu | ✅ | `g1-04-fail-open-no-config.png` | ✅ initiativeGateAi |

### G2 — `gateAiReadinessService` (rollup merytoryczny)  · seria G
**Cel:** Policzyć merytoryczną gotowość bramki jako ważony rollup ocen wymaganych sekcji (reuse reviewer §B4), z gaps/fixes, fail-open, cache per content-hash.
**Epiki:** E1 rollup `score/verdict/gaps/fixes` · E2 reuse reviewer (CARD_CONTENT_FORMULA §B4) · E3 cache per (initiativeId,gate,contentHash) + inwalidacja.
**Kod:** BE: `server/src/services/initiative/gateAiReadinessService.ts`, reuse `initiativeGenerationService.ts` (`reviewSectionContent`), `initiativeGateAi.ts`

**Testy automatyczne:**
| Poziom | Co weryfikuje | Plik | Status |
|---|---|---|---|
| unit | non-AI gate→ready; wszystkie pass→ready bez gaps; sekcja<próg→below+gap+fixes deduped; reviewer throws→null; próg respektowany; brak wiersza→null | `tests/unit/initiatives/gateAiReadiness.test.ts` | ✅ |
| unit | cache hit (2. call bez reviewera) + inwalidacja po zmianie contentHash | `tests/unit/initiatives/gateAiReadinessCache.test.ts` | ⬜ do-build |

**Scenariusze:**
| # | Scenariusz | Kroki | Oczekiwany wynik | Headless | Dowód | Auto-status |
|---|---|---|---|---|---|---|
| G2-01 | Rollup dla 9 bramek | Flaga ON → `gate-ai-check` per AI-bramka | Każda zwraca readiness score/verdict/gaps | ❌ | `g2-01-rollup-9-gates.png` | ✅ kanon; live ❌ |
| G2-02 | Pusta sekcja → gap | Pusty `problemDefinition` → check SUBMIT_FOR_REVIEW | Sekcja w `gaps[]`, score<próg | ❌ | `g2-02-empty-section-gap.png` | ✅ gateAiReadiness (mock) |
| G2-03 | Komplet → ready | Pełne sekcje → check | verdict `ready`, brak gaps | ❌ | `g2-03-complete-ready.png` | ✅ gateAiReadiness |
| G2-04 | LLM down → fail-open | Reviewer rzuca → check | `null` → `enabled:false` | ✅ | `g2-04-llm-down-failopen.png` | ✅ gateAiReadiness |
| G2-05 | Cache hit | 2 checki bez edycji | reviewer nie wołany ponownie | ✅ | `g2-05-cache-hit.png` | ⬜ do-build |
| G2-06 | Inwalidacja po edycji | check → edytuj sekcję → check | świeży rollup (nie cache) | 🟡 | `g2-06-cache-invalidation.png` | ⬜ do-build |

### G3 — `gateTimelineService` (na linii czasu)  · seria G
**Cel:** Wykryć flagi czasowe (niegotowe zależności=block, kolizja dat=warn) dla bramek SCHEDULE/START; resource-conflict świadomie pominięty; fail-open.
**Epiki:** E1 zależność<SCHEDULED→block · E2 nakładanie dat→warn · E3 konflikt zasobów (skip udok.).
**Kod:** BE: `server/src/services/initiative/gateTimelineService.ts`, `initiativeGateAi.ts` (`GATE_AI_TIMELINE_GATES`)

**Testy automatyczne:**
| Poziom | Co weryfikuje | Plik | Status |
|---|---|---|---|
| unit | null dla non-planning; analiza dla SCHEDULE/START; niegotowa zależność→block; ready predecessor→brak flag; nakładanie dat→warn; brak nakładania→brak warn; nigdy resource_conflict; fail-open→null; subject nieobecny→puste flags | `tests/unit/initiatives/gateTimeline.test.ts` | ✅ |

**Scenariusze:**
| # | Scenariusz | Kroki | Oczekiwany wynik | Headless | Dowód | Auto-status |
|---|---|---|---|---|---|---|
| G3-01 | Zależność niegotowa blokuje | B zależne od A (DRAFT) → check SCHEDULE na B | Flaga `block` kind=dependency | ❌ | `g3-01-dependency-block.png` | ✅ gateTimeline |
| G3-02 | Daty kolidują → warn | Dwie SCHEDULED tego samego ownera, nakładające | Flaga `warn` date_conflict | ❌ | `g3-02-date-conflict-warn.png` | ✅ gateTimeline |
| G3-03 | Zasób koliduje → skip | (świadomy skip — brak schematu) | Brak flagi resource + log | ✅ | `g3-03-resource-skip.png` | ✅ gateTimeline |
| G3-04 | Brak zależności → czysto | Bez predecessorów, daty OK → check | `flags: []` | ✅ | `g3-04-clean-no-flags.png` | ✅ gateTimeline |
| G3-05 | Tylko SCHEDULE/START | Check APPROVE | `null` (brak timeline) | ✅ | `g3-05-only-planning-gates.png` | ✅ gateTimeline |
| G3-06 | Pozostałe bramki timeline=null | AI-bramka spoza {SCHEDULE,START} | `timeline: null` | ✅ | `g3-06-non-planning-null.png` | ✅ gateTimeline + gateAiCheck |

### G4 — Endpoint + soft-block/override + telemetria  · seria G
**Cel:** `POST /:id/gate-ai-check` (lazy readiness) + soft-block w PATCH/transition: 422 poniżej progu bez `overrideReason`, przejście+log z override, telemetria do `initiative_gate_ai_events`.
**Epiki:** E1 endpoint lazy · E2 transition 422/override · E3 tabela events.
**Kod:** FE: `src/services/api/gateAi.ts` · BE: `InitiativeController.ts` (`getGateAiCheck`, soft-block w `updateInitiativeStatus` ~1294), `gateAiTelemetryService.ts`, `types/gateAi.ts` (`gateAiSoftBlocks`), migracja `initiative_gate_ai_events`

**Testy automatyczne:**
| Poziom | Co weryfikuje | Plik | Status |
|---|---|---|---|
| unit (controller) | 401 bez org; 400 unknown gate; derive z targetStatus; 404 cross-org; `enabled:false` flaga OFF; `enabled:true` ON+AI-gate | `tests/unit/server/controllers/InitiativeController.gateAiCheck.test.ts` | ✅ |
| unit | `gateAiSoftBlocks`: disabled→nie; below→tak; timeline block→tak; warn-only+ready→nie | (j.w.) | ✅ |
| unit | telemetria: insert+coercja; defaulty; brak tabeli→no-op; swallow błędu; skip blank org | `tests/unit/initiatives/gateAiTelemetry.test.ts` | ✅ |
| integration | below bez override→422+blocked; below+override→przejście+overridden; above→clean; flaga OFF→brak check | `tests/integration/initiatives/gate-ai-soft-block.test.ts` | ✅ |
| integration | timeline `block` jako jedyna przyczyna 422 | (rozszerzyć gate-ai-soft-block) | ⬜ do-build |

**Scenariusze:**
| # | Scenariusz | Kroki | Oczekiwany wynik | Headless | Dowód | Auto-status |
|---|---|---|---|---|---|---|
| G4-01 | Poniżej progu → 422 | Flaga ON, below → PATCH bez override | 422 `INITIATIVE_GATE_AI_SOFT_BLOCK`+`{aiReadiness,timeline}`; telemetry blocked:true | 🟡 | `g4-01-below-threshold-422.png` | ✅ gate-ai-soft-block |
| G4-02 | Override+powód → przejście | PATCH z `overrideReason` | Przejście; telemetry overridden:true | 🟡 | `g4-02-override-proceeds.png` | ✅ gate-ai-soft-block |
| G4-03 | Powyżej progu → bez tarcia | ready → PATCH forward | Bez 422; telemetry blocked:false | 🟡 | `g4-03-above-threshold-clean.png` | ✅ gate-ai-soft-block |
| G4-04 | Timeline block → 422 | SCHEDULE z niegotową zależnością (readiness OK) | 422 z `timelineBlock` | 🟡 | `g4-04-timeline-block-422.png` | ⬜ do-build |
| G4-05 | Flaga OFF → stare zachowanie | Org bez flagi → PATCH below | Przejście; brak 422/telemetrii | ✅ | `g4-05-flag-off-legacy.png` | ✅ gate-ai-soft-block |
| G4-06 | Event zapisany | soft-block/override → sprawdź `initiative_gate_ai_events` | Wiersz z polami | ✅ | `g4-06-telemetry-event.png` | ✅ gateAiTelemetry |

### G5 — UI bramki (pigułka + panel + modal override)  · seria G · 3 ekrany
**Cel:** Pigułka score (zielony≥próg/bursztyn<próg, NIE czerwień), rozwijany panel gaps/fixes/timelineFlags, modal override z obowiązkowym uzasadnieniem; PL+EN, dark+light.
**Epiki:** E1 pigułka · E2 panel braków · E3 modal override.
**Kod:** FE: `src/components/Initiatives/gate-ai/GateReadinessPill.tsx`, `GateReadinessPanel.tsx`, `GateOverrideModal.tsx`, `sections/GateReadinessSection.tsx`, `InitiativeDocumentView.tsx` (modal+`handleStatusAction`), `gateReadinessPayload.ts`

**Testy automatyczne:**
| Poziom | Co weryfikuje | Plik | Status |
|---|---|---|---|
| unit | `normalizeGateReadinessPayload`: pełne obiekty + legacy arrays bez utraty | `tests/unit/initiatives/gateReadinessPayload.test.ts` | ✅ |
| component | Pill ready→zielony/below→bursztyn(nie danger)/loading; aria; score | `tests/components/initiatives/GateReadinessPill.test.tsx` | ⬜ do-build |
| component | Panel gaps/fixes/timelineFlags (block vs warn); pusty/ready | `tests/components/initiatives/GateReadinessPanel.test.tsx` | ⬜ do-build |
| component | Modal: confirm disabled gdy reason pusty; onConfirm(reason)/onCancel; reset przy reopen | `tests/components/initiatives/GateOverrideModal.test.tsx` | ⬜ do-build |
| e2e | soft-block flow render bez error boundary | `tests/e2e/m13/m13-manual.spec.ts` (G5) | ⬜ do-build (render 🟡; modal ❌) |

**Scenariusze:**
| # | Scenariusz | Kroki | Oczekiwany wynik | Headless | Dowód | Auto-status |
|---|---|---|---|---|---|---|
| G5-01 | Pigułka ≥próg zielona | Flaga ON, ready → otwórz sekcję bramki | Pigułka zielona+score+%; aria „ready" | ❌ | `g5-01-pill-green.png` | ⬜ component; live ❌ |
| G5-02 | Pigułka <próg bursztyn | below → sekcja | Pigułka bursztynowa, NIE czerwona | ❌ | `g5-02-pill-amber.png` | ⬜ component |
| G5-03 | Klik pigułki → panel | Kliknij pigułkę | Panel rozwinięty | ❌ | `g5-03-panel-open.png` | ⬜ component |
| G5-04 | Gaps poprawne | Panel z below | Lista gaps (sekcja+score+issues)+fixes | ❌ | `g5-04-panel-gaps.png` | ⬜ component |
| G5-05 | timelineFlags na SCHEDULE | SCHEDULE z flagą → panel | block (amber-strong)/warn (amber-soft) | ❌ | `g5-05-panel-timeline.png` | ⬜ component |
| G5-06 | Przejście <próg → modal | CTA forward gdy soft-block | Otwiera `GateOverrideModal` | ❌ | `g5-06-override-modal.png` | ⬜ ❌ real-browser |
| G5-07 | Override bez powodu → disabled | Modal, pole puste | „Proceed anyway" disabled | ❌ | `g5-07-confirm-disabled.png` | ⬜ component; live ❌ |
| G5-08 | Override+powód → przejście | Wpisz powód → confirm | PATCH z `overrideReason` → przejście | ❌ | `g5-08-override-proceeds.png` | ⬜ component + integration G4-02 ✅ |
| G5-09 | Flaga OFF → brak pigułki | Org bez flagi → sekcja | Pigułka nie renderowana | 🟡 | `g5-09-flag-off-no-pill.png` | ⬜ render assert; BE ✅ |
| G5-10 | Dark + light | Wymuś dark/light → pigułka/panel/modal | Czytelne; bursztyn nie czerwień; tokeny | ❌ | `g5-10-dark.png`, `g5-10-light.png` | ⬜ component snapshoty |

<!-- ════════════════════════ SERIA R — ARTEFAKTY ════════════════════════ -->
## SERIA R — artefakty (R1–R4)

### R1 — M13a Taski (stabilizacja)  · seria R (artefakty)
**Cel:** Daty zadań = jedno współdzielone źródło prawdy zasilające Kalendarz (R3) i Gantt (V1) bez dryfu; AI-fill propozycji zadań bez fake-success.
**Epiki:** E1 korelacja z Kalendarzem/Gantt · E2 polish AI-fill + testy.
**Kod:** FE: `sections/TasksMilestonesSection.tsx`, `src/services/initiativeSchedule.ts` (`buildScheduleItems`), `src/types/initiativeSchedule.ts` · BE: `server/src/routes/pmo/tasks.routes.ts` (`PUT /:id` org-scope, `startedAt`/`dueDate`)

**Testy automatyczne:**
| Poziom | Co weryfikuje | Plik | Status |
|---|---|---|---|
| unit | `buildScheduleItems` normalizuje task→ScheduleItem; `toIsoDate` granice | `tests/unit/initiatives/initiativeSchedule.*` (8/8) | ✅ |
| component | CRUD karta-zadanie + render statusów | `tests/components/Initiatives/TasksMilestonesSection.crud.test.tsx` | ⬜ do-build |
| component | AI-propozycja add/remove/reorder; brak fake gdy AI off | `tests/components/Initiatives/TasksMilestonesSection.ai-proposal.test.tsx` | ⬜ do-build |
| integration | `PUT /api/pmo/tasks/:id` org-scope; 403 cudza org | `tests/integration/initiatives/tasks.update.test.ts` | ⬜ do-build |

**Scenariusze:**
| # | Scenariusz | Kroki | Oczekiwany wynik | Headless | Dowód | Auto-status |
|---|---|---|---|---|---|---|
| R1-01 | CRUD task — dodanie | openDoc→Tasks→Plus→tytuł→zapis | Karta `todo` na liście | 🟡 | `r1-01-task-create.png` | ⬜ |
| R1-02 | Zmiana statusu | Karta→`todo→in_progress→done` | Kolor/etykieta zmienia | ✅ | `r1-02-task-status.png` | ⬜ |
| R1-03 | AI-propozycja | Sparkles→AITaskProposal | Panel add/remove/reorder; brak fake gdy off | 🟡 | `r1-03-task-ai-proposal.png` | ⬜ |
| R1-04 | Zasilenie Kalendarza | Zadanie z datą→Timeline→Kalendarz | Chip na dniu startu | ✅ | `r1-04-task-feeds-calendar.png` | ✅ pośrednio (Calendar.drag) |
| R1-05 | Zasilenie Gantt | To samo→Gantt | Bar w kolumnie tygodnia | ✅ | `r1-05-task-feeds-gantt.png` | ✅ pośrednio (Gantt.drag) |
| R1-06 | Edycja daty | Karta→edytuj due/start→zapis | Data zaktualizowana; Kalendarz/Gantt przesuwa | 🟡 | `r1-06-task-edit-date.png` | ⬜ tasks.update |
| R1-07 | Usuwanie | Karta→kebab→Trash→potwierdź | Karta znika z listy+schedule | 🟡 | `r1-07-task-delete.png` | ⬜ |
| R1-08 | Back/nawigacja | Tasks→inna sekcja→powrót | Stan zachowany, brak crasha | ✅ | `r1-08-task-back.png` | ⬜ |

### R2 — M13b Decyzje (stabilizacja)  · seria R
**Cel:** Rejestr decyzji jako tabela task-like; korelacja GO_NO_GO ze ścieżką bramek — PENDING Go/No-Go blokuje promocję, pokazane bannerem.
**Epiki:** E1 korelacja GO_NO_GO↔bramki · E2 testy+screeny.
**Kod:** FE: `sections/DecisionsSection.tsx` (`DECISION_STATUS_CONFIG`, `GATE_TYPES`, `gateBlockingDecisions` memo, banner Callout) · BE: `InitiativeController` (CRUD, `decision_impacts`; patrz finding subquery-on-optional-table)

**Testy automatyczne:**
| Poziom | Co weryfikuje | Plik | Status |
|---|---|---|---|
| component | Banner gate-blocking dla PENDING GO_NO_GO; znika gdy APPROVED | `tests/components/Initiatives/DecisionsSection.gate-banner.test.tsx` | ⬜ do-build |
| component | CRUD + render konfiguracji statusów; sort gate+PENDING na górze | `DecisionsSection.crud/sort.test.tsx` | ⬜ do-build |
| integration | CRUD org-scope; list nie zwraca [] przy braku `decision_impacts` | `tests/integration/initiatives/decisions.crud.test.ts` | ⬜ do-build |

**Scenariusze:**
| # | Scenariusz | Kroki | Oczekiwany wynik | Headless | Dowód | Auto-status |
|---|---|---|---|---|---|---|
| R2-01 | CRUD decyzja — dodanie | openDoc→Decisions→Plus→typ/owner/due→zapis | Wiersz `PENDING` (amber, pulse) | 🟡 | `r2-01-decision-create.png` | ⬜ |
| R2-02 | Typ GO_NO_GO | Dodaj Go/No-Go | Oznaczony, sortuje na górę | ✅ | `r2-02-decision-gonogo.png` | ⬜ |
| R2-03 | Flow statusu | PENDING→APPROVED→REJECTED/ESCALATED/DEFERRED | Kolory wg config | ✅ | `r2-03-decision-status-flow.png` | ⬜ |
| R2-04 | Banner przy bramce | Dodaj PENDING GO_NO_GO | Banner „Gate-blocking" widoczny | ✅ | `r2-04-decision-gate-banner.png` | ⬜ gate-banner |
| R2-05 | Banner znika po Approve | GO_NO_GO→APPROVED | Banner znika | ✅ | `r2-05-decision-banner-clears.png` | ⬜ |
| R2-06 | Powiązanie z inicjatywą | Decyzja→reload | Przypięta (org+initiative scope) | 🟡 | `r2-06-decision-scope.png` | ⬜ integration |
| R2-07 | Edycja/usuwanie | Edit; kebab→Trash | Zapisane/znika | 🟡 | `r2-07-decision-edit-delete.png` | ⬜ |
| R2-08 | Back/nawigacja | Decisions→inna→powrót | Stan zachowany | ✅ | `r2-08-decision-back.png` | ⬜ |

### R3 — M13c Kalendarz (build)  · seria R · 2 ekrany
**Cel:** Kalendarz miesiąc/tydzień zasilony wspólnym `ScheduleItem[]`; drag-to-reschedule zadań persystuje `PUT /api/pmo/tasks/:id` (optymistyczny+rollback, zachowuje długość); filtry/dark/light.
**Epiki:** E1 miesiąc/tydzień · E2 wspólny serwis czasu · E3 drag-reschedule · E4 filtry+dark/light.
**Kod:** FE: `calendar/InitiativeCalendar.tsx` (month/week, native DnD, dla zadań PUT+rollback; phases/milestones→`onReschedule`), `sections/TimelineSection.tsx` · BE: `PUT /api/pmo/tasks/:id`

**Testy automatyczne:**
| Poziom | Co weryfikuje | Plik | Status |
|---|---|---|---|
| component | chip `cursor-grab` gdy `onReschedule`; read-only bez; drop→PUT+onReschedule | `tests/components/Initiatives/InitiativeCalendar.drag-reschedule.test.tsx` (3) | ✅ |
| component | toggle month/week; filtr status; pusty stan | `InitiativeCalendar.views-filter.test.tsx` | ⬜ do-build |
| component | rollback chipa gdy PUT odrzucony | `InitiativeCalendar.rollback.test.tsx` | ⬜ do-build |
| component | spójność Kalendarz↔Gantt (ten sam ScheduleItem[]) | `InitiativeSchedule.consistency.test.tsx` | ⬜ do-build |

**Scenariusze:**
| # | Scenariusz | Kroki | Oczekiwany wynik | Headless | Dowód | Auto-status |
|---|---|---|---|---|---|---|
| R3-01 | Render miesiąc | seedTasks→Timeline→Kalendarz | Siatka miesięczna, „dziś" | ✅ | `r3-01-calendar-month.png` | ⬜ views-filter |
| R3-02 | Render tydzień | ViewMode→week | Siatka tygodnia (Mon) | ✅ | `r3-02-calendar-week.png` | ⬜ |
| R3-03 | Zadania po dacie | seedTasks z datami | Chip `bg-primary-500` na dniu | ✅ | `r3-03-calendar-tasks.png` | ✅ Calendar.drag render |
| R3-04 | Kamienie po dacie | Seed milestone | Chip `bg-amber-500`; fazy `bg-emerald-500` | ✅ | `r3-04-calendar-milestones.png` | ⬜ |
| R3-05 | Drag → persist | Przeciągnij chip na inny dzień | `PUT /tasks/:id`; długość zachowana | ❌→**component** | `r3-05-calendar-drag-persist.png` | ✅ Calendar.drag (component) |
| R3-06 | Drag rollback | Symuluj błąd PUT | Chip wraca na pierwotny dzień | ❌→component | `r3-06-calendar-rollback.png` | ⬜ rollback |
| R3-07 | Filtr status | Ukryj done | Tylko wybrane itemy | ✅ | `r3-07-calendar-filter.png` | ⬜ |
| R3-08 | Pusty stan | Bez dat | Pusta siatka bez crasha | ✅ | `r3-08-calendar-empty.png` | ⬜ |
| R3-09 | Nawigacja miesięcy | Chevron L/R | Zmiana miesiąca, przeliczone | ✅ | `r3-09-calendar-nav.png` | ⬜ |
| R3-10 | Spójność z Gantt | Toggle Kalendarz↔Gantt | Te same daty/itemy (zero dryfu) | ✅ | `r3-10-calendar-gantt-consistency.png` | ⬜ consistency |
| R3-11 | Dark | forceTheme('dark') | Tokeny dark OK | ✅ | `r3-11-calendar-dark.png` | ⬜ |
| R3-12 | Light | forceTheme('light') | Tokeny light OK | ✅ | `r3-12-calendar-light.png` | ⬜ |

### R4 — M13d Notyfikacje (build wiring)  · seria R · 2 ekrany
**Cel:** Inicjatywa emituje notyfikacje org-scope bez duplikatów. Status-change WPIĘTY jako jedna kanoniczna `initiative.status_changed`; →BLOCKED eskalowane CRITICAL+reason (Wariant A, 2026-06-22); aktor nigdy nie dostaje własnej. Assignment/due/blocker emitery = biblioteka BEZ call-sites (luki).
**Epiki:** E1 status-change ✅ wpięty · E2 assignment ⬜ niewpięty · E3 due-breach ⬜ NIEZBUDOWANY (cron-job) · E4 blocker ✅ (przez eskalację statusu).
**Kod:** BE: `InitiativeController.ts` (`updateInitiativeStatus` ~2069 „Emit notifications": `initiative.status_changed`/`module_changed`, `statusSeverity` BLOCKED→CRITICAL/CANCELLED→WARNING/else INFO, `recipients.filter(uid!==actorId)`, gate-role notify dla następnej bramki), `initiativeNotificationService.ts` (emitery — **biblioteka, BEZ call-sites**)

> **WAŻNE:** dubel status-change naprawiony 2026-06-22 (Wariant A). Underscore'owe `initiative_status_change`/`initiative_blocked` już NIE strzelają. `notifyAssignment` niewpięty. `notifyDueBreach` NIEZBUDOWANY — wymaga cron-joba (infra).

**Testy automatyczne:**
| Poziom | Co weryfikuje | Plik | Status |
|---|---|---|---|
| integration | →BLOCKED=1× CRITICAL `initiative.status_changed`+reason; non-blocked=INFO; aktor nie notyfikowany; dokładnie 1 per odbiorca (brak dubla) | `tests/integration/initiatives/notifications.test.ts` (4/4) | ✅ |
| integration | gate-role notify dla NASTĘPNEJ bramki | `notifications.gate-role.test.ts` | ⬜ do-build |
| integration | org-scope: brak wycieku do innej org | `notifications.org-scope.test.ts` | ⬜ do-build |
| integration | assignment→`notifyAssignment` (call-site niewpięty) | `notifications.assignment.test.ts` | ⬜ do-build |
| integration | due-breach→`notifyDueBreach` | `notifications.due-breach.test.ts` | ⬜ **LUKA: emiter NIEZBUDOWANY (cron/scheduler) — infra-gap** |

**Scenariusze:**
| # | Scenariusz | Kroki | Oczekiwany wynik | Headless | Dowód | Auto-status |
|---|---|---|---|---|---|---|
| R4-01 | Status→notyfikacja | SCHEDULED→EXECUTING | 1× INFO `initiative.status_changed`; aktor nie | ❌→integration | `r4-01-status-notif.png` | ✅ notifications |
| R4-02 | Blocker→notyfikacja | →BLOCKED z reason | 1× CRITICAL „Initiative blocked"+reason | ❌→integration | `r4-02-blocker-notif.png` | ✅ notifications |
| R4-03 | Przypisanie→notyfikacja | Przypisz usera do roli | `notifyAssignment` do przypisanego | ❌→integration | `r4-03-assignment-notif.png` | ⬜ **LUKA call-site** |
| R4-04 | Termin→notyfikacja | Zadanie po `dueDate` | `notifyDueBreach` WARNING | ❌→integration | `r4-04-due-breach-notif.png` | ⬜ **LUKA: NIEZBUDOWANY (cron)** |
| R4-05 | In-app widoczna | Status-change→centrum notyfikacji | Wpis w dzwonku (severity, actionUrl) | 🟡 | `r4-05-inapp-visible.png` | ⬜ |
| R4-06 | Email wysłany | Status-change, email ON | E-mail wysłany | ❌→człowiek | `r4-06-email-sent.png` | ⬜ **LUKA: Q3/infra** |
| R4-07 | Org-scope | Status-change org A → user org B | User B NIE dostaje | ❌→integration | `r4-07-org-scope.png` | ⬜ org-scope |
| R4-08 | Brak duplikatów | →BLOCKED → policz per odbiorca | Dokładnie 1 `initiative.status_changed` | ❌→integration | `r4-08-no-dubel.png` | ✅ notifications |
| R4-09 | Gate-role notify | Transition otwierająca następną bramkę | Posiadacz roli dostaje „czeka decyzji" | ❌→integration | `r4-09-gate-role-notif.png` | ⬜ gate-role |
| R4-10 | Back/ustawienia kanałów | Centrum→ustawienia kanałów | Panel renderuje (in-app/email/Slack wg Q3) | 🟡 | `r4-10-channels-settings.png` | ⬜ **LUKA Q3** |

<!-- ════════════════════════ SERIA C — TWORZENIE ════════════════════════ -->
## SERIA C — tworzenie (C1–C2)

### C1 — Generator portfolio-aware (dedup)  · seria C (tworzenie)
**Cel:** Przy tworzeniu rozpoznać podobne inicjatywy org (Jaccard tytuł+streszczenie) i pokazać doradcze (advisory) amber-ostrzeżenie w Charter Wizard; pokrywa generację z dowodów (M10) i jakość wg formuły. Fail-safe: błąd→pusta lista, tworzenie nigdy nie zablokowane.
**Epiki:** E1 dedup-query (Jaccard, org-scope, exclude-self, fail-safe) · E2 amber-warning w UI (debounce, lista linkowalna) · E3 (Q5) model-select = N/A (stały tier).
**Kod:** FE: `Wizard/InitiativeCharterWizard.tsx` (debounce 500ms title+thesis, amber ~471-518), `src/services/api/initiativeSimilar.ts` · BE: `InitiativeController.ts:5692` (`checkSimilarInitiatives`), `routes/pmo/initiatives.routes.ts:2776` (`POST /similar-check`) + `:345` (`/similarity-check` batch), `initiativeSimilarityService.ts` + `similarityPrimitives.ts`

**Testy automatyczne:**
| Poziom | Co weryfikuje | Plik | Status |
|---|---|---|---|
| unit | tokenize/jaccard; pusty kandydat→[]; near-dup>próg; org-scope; exclude-self+limit; fail-safe | `tests/unit/initiatives/initiativeSimilarity.test.ts` (7) | ✅ |
| component | amber-blok gdy dopasowania; brak gdy []; debounce<4 znaki / przed 500ms; coalescing | `InitiativeCharterWizard.dedup.test.tsx` (wzorem b3-hints) | ⬜ do-build |
| integration | `POST /similar-check` 401 bez org; org-scope; body→`{similar}` | `tests/integration/initiatives/similar-check.test.ts` | ⬜ do-build |
| unit (client) | `checkSimilarInitiatives` mapuje data.similar; fail-open→[] | `initiativeSimilarClient.test.ts` | ⬜ do-build |

**Scenariusze:**
| # | Scenariusz | Kroki | Oczekiwany wynik | Headless | Dowód | Auto-status |
|---|---|---|---|---|---|---|
| C1-01 | Generacja z insightów M10 | `/discovery`→wywiad ≥3 insighty→„Generuj inicjatywy"→wizard→`POST /api/initiatives` | DRAFT-y na liście; `evidence_refs_json` z `interview_insight:<id>` | ❌ | `c1-01-generate-from-evidence.png` | — real |
| C1-02 | Dedup wykrywa duplikat | Org ma „Warehouse Robotic Automation" → wpisz „Robotic Automation for Warehouse" | `{similar:[{id,name,score}]}` score>0.25 | 🟡 | `c1-02-dedup-detects-duplicate.png` | ✅ unit / ⬜ component |
| C1-03 | Ostrzeżenie amber | Po debounce 500ms | Amber-box „Podobne inicjatywy już istnieją" + lista | 🟡 | `c1-03-amber-warning.png` | ⬜ component |
| C1-04 | Brak duplikatu → czysto | Unikalny tytuł | `{similar:[]}`; brak amber | 🟡 | `c1-04-no-duplicate-clean.png` | ⬜ component |
| C1-05 | Debounce/próg | Tytuł<4 znaki; szybkie edycje | <4→brak call; szybkie→1 call po 500ms | 🟡 | `c1-05-debounce-threshold.png` | ⬜ component |
| C1-06 | (Q5) model-select | N/A | Świadomie pominięte (stały tier) | N/A | — | N/A |
| C1-07 | Fallback LLM | Symuluj błąd dedup | `[]`; tworzenie niezablokowane | ✅ | `c1-07-llm-fallback.png` | ✅ unit / ⬜ client |
| C1-08 | Jakość wg formuły | Teza ≥8 znaków z fillerem → §B3 hinty | `validateCard(...)`; amber-hinty | 🟡 | `c1-08-quality-formula.png` | ✅ component (b3-hints) |

### C2 — Tworzenie przez Teresę (e2e)  · seria C
**Cel:** „Teresa stwórz inicjatywę X" → tool `generate_initiative` → rekord DRAFT (reversible, BEZ approval-gate), org-scope, Postgres-correct; DRAFT na liście, otwieralny, PL i EN.
**Epiki:** E1 `generate_initiative` (READ/auto, DRAFT, `source:'teresa_chat'`, org-guard, fail-safe ok:false) · E2 persona+montaż potwierdzenia.
**Kod:** BE: `server/src/services/ai/tools/generateInitiative.ts`, `mcpServer.ts:144` (def READ `{title,problem?}`), `tools/index.ts:32` (rejestracja), `ai.routes.ts:1810` (persona). Chain: persona→mcpServer→llmService.callStream→AIPipeline. FE: `useAIStream`/`UnifiedChatPanel`.

**Testy automatyczne:**
| Poziom | Co weryfikuje | Plik | Status |
|---|---|---|---|
| unit | brak org→ok:false; tworzy DRAFT→ok:true+id, `source:'teresa_chat'`; pusty title→default; create bez id→ok:false; throw→ok:false | `tests/unit/initiatives/generateInitiativeTool.test.ts` (5) | ✅ |
| unit | rejestracja w `mcpServer.tools` + handler (registry) | `generateInitiativeRegistry.test.ts` | ⬜ do-build („registry 2/2" z SSOT NIE istnieje jako plik) |
| unit | persona prompt zawiera instrukcję `generate_initiative` | `teresaPersonaInitiative.test.ts` | ⬜ do-build (opcjonalny) |

**Scenariusze:**
| # | Scenariusz | Kroki | Oczekiwany wynik | Headless | Dowód | Auto-status |
|---|---|---|---|---|---|---|
| C2-01 | Teresa stwórz → DRAFT | `/chat`→„Stwórz inicjatywę dot. automatyzacji HR" | tool ok:true+id; potwierdzenie 1 zdaniem; rekord DRAFT | ❌ | `c2-01-teresa-create-draft.png` | ✅ unit (handler) |
| C2-02 | DRAFT na liście | →`/initiatives`→odśwież | DRAFT z tytułem na liście | ❌ | `c2-02-draft-in-list.png` | — real |
| C2-03 | DRAFT otwieralny | Klik→dokument | Dokument otwiera się; title+description | ❌ | `c2-03-draft-openable.png` | — real |
| C2-04 | Język PL | Czat PL | Intent PL; potwierdzenie PL | ❌ | `c2-04-pl.png` | — real |
| C2-05 | Język EN | Czat EN | Tool wywołany; potwierdzenie EN | ❌ | `c2-05-en.png` | — real |
| C2-06 | Brak approval-gate | Sprawdź brak modala approval, status DRAFT | DRAFT od razu (READ tool, reversible) | 🟡 | `c2-06-no-approval-gate.png` | ✅ unit (handler) |

<!-- ════════════════════════ SERIA K — JAKOŚĆ KART ════════════════════════ -->
## SERIA K — jakość kart (K1–K4)

### K1 — Karty §B3 egzekwowanie  · seria K (jakość kart)
**Cel:** Wymusić jakość kart wg `CARD_CONTENT_FORMULA §B3` jako warstwę deterministycznych walidatorów (PL/no-filler/długość/format hipotezy), tryb **advisory/miękki** (Q7=miękkie — flaguje, nie blokuje). FE pokazuje podpowiedzi na żywo na polu tezy w Charter Wizardzie.
**Epiki:** E1 walidatory §B3 · E2 tryb miękki (Q7) + FE-podpowiedzi.
**Kod:** FE: `Wizard/InitiativeCharterWizard.tsx` (debounce 600ms→`validateCard(text,['lang_pl','no_filler','hypothesis_format'])`→amber hints), `src/services/api/cardValidators.ts` · BE: `initiativeCardValidators.ts` (`HYPOTHESIS_RE = /Jeśli .+ to .+ (bo|ponieważ) .+/i`, FILLER_PATTERNS, EN_STOPWORDS, ALLOWED_TOKENS) + `POST /api/initiatives/validate-card`

**Testy automatyczne:**
| Poziom | Co weryfikuje | Plik | Status |
|---|---|---|---|
| unit (BE) | lang_pl ≥2 EN-stopwords; no_filler; problem_len 120–250; hypothesis_format; ALLOWED_TOKENS; pusty=clean | `tests/unit/initiatives/initiativeCardValidators.test.ts` (7) | ✅ |
| component (FE) | debounce 600ms; ≥8 znaków triggeruje; amber hints; krótki nie woła; coalescing | `tests/components/Initiatives/InitiativeCharterWizard.b3-hints.test.tsx` (3) | ✅ |
| integration | `POST /validate-card` `issues[]`; 401 guard; advisory (200 nawet z issues) | `validateCard.endpoint.test.ts` | ⬜ do-build |
| component | hints ADVISORY — nie blokują „Dalej"/„Utwórz" (Q7) | (dopisać do b3-hints) | ⬜ do-build |

**Scenariusze:**
| # | Scenariusz | Kroki | Oczekiwany wynik | Headless | Dowód | Auto-status |
|---|---|---|---|---|---|---|
| K1-01 | Walidator łapie filler | Pole tezy→„Jeśli zrobimy TODO to placeholder"→>600ms | amber hint „placeholder/wypełniacz" | ✅ | `k1-01-filler-hint.png` | ✅ b3-hints; 🟡 live |
| K1-02 | Za krótka teza | „krótko" (<8 zn.)→>600ms | brak wywołania, brak hintów | ✅ | `k1-02-short-no-hint.png` | ✅ component |
| K1-03 | Tryb Q7 nie blokuje | Teza z hintami→„Dalej"/„Utwórz" | Przejście DZIAŁA mimo hintów | ✅ | `k1-03-soft-not-blocking.png` | ⬜ do-build |
| K1-04 | PL drift (lang_pl) | „The process will have value and this" | amber „proza angielska"; KPI/RACI nie liczone | ✅ | `k1-04-lang-pl-hint.png` | ✅ unit; 🟡 live |
| K1-05 | Przejście gdy OK | „Jeśli zautomatyzujemy onboarding to skrócimy czas bo usuniemy ręczne kroki" | zero hintów (HYPOTHESIS_RE OK) | ✅ | `k1-05-clean-no-hint.png` | ✅ unit+component |
| K1-06 | Log/dowód (Network) | Network→wpisz tezę→`POST /validate-card` | request `{text,rules}`→200 `{issues}` | 🟡 | `k1-06-network-validate.png` | ⬜ integration |

### K2 — Karty `CardContainer` (układ graficzny)  · seria K · **⬜ BLOCKED Q6**
**Cel:** Wspólny `CardContainer`/`CardHeader` (spójny nagłówek, ikona/kolor z `SectionTypeInfo`, dark/light, §27) + migracja sekcji. **STATUS: NIE ROZPOCZĘTY — czeka decyzji Q6.** Zakres migracji zależy od Q6. Wszystkie testy = ⬜ blocked, opisane „po decyzji/po zbudowaniu".
**Epiki:** E1 `CardContainer`/`CardHeader` · E2 migracja sekcji (zakres wg Q6).
**Kod:** FE: **NIEZBUDOWANY — czeka Q6** (docelowo nowy `CardContainer.tsx`; ikona/kolor z `SectionTypeInfo` w `registry.ts`).

**Testy automatyczne:** `CardContainer.test.tsx` + `CardContainer.migration.test.tsx` — ⬜ blocked Q6.

**Scenariusze (po zbudowaniu):**
| # | Scenariusz | Kroki | Oczekiwany wynik | Headless | Dowód | Auto-status |
|---|---|---|---|---|---|---|
| K2-01 | Spójny nagłówek | otwórz dokument→sekcje | Identyczna struktura `CardHeader` | ✅ (po build) | `k2-01-spojny-naglowek.png` | ⬜ blocked Q6 |
| K2-02 | Ikona/kolor z SectionTypeInfo | per sekcja vs registry | Zgodne z `SectionTypeInfo` | ✅ (po build) | `k2-02-ikona-kolor.png` | ⬜ blocked Q6 |
| K2-03 | Dark | forceTheme dark | Czytelny; brak crimson-leak | ✅ (po build) | `k2-03-dark.png` | ⬜ blocked Q6 |
| K2-04 | Light | forceTheme light | Czytelny; badge bez danger-fill | ✅ (po build) | `k2-04-light.png` | ⬜ blocked Q6 |
| K2-05 | Zgodność §27 | vs `TABLE_AND_PREVIEW_CANON §27`/`CANON §7/9/17` | Zero odstępstw P0/P1 | ❌ człowiek | `k2-05-kanon-27.png` | ⬜ blocked Q6 |
| K2-06 | Brak regresji renderu | wszystkie zmigrowane sekcje | Render jak przed migracją | ✅ (po build) | `k2-06-brak-regresji.png` | ⬜ blocked Q6 |
| K2-07 | Reorder sekcji | drag handle→zapis→reload | Kolejność zachowana | ❌ (DnD) | `k2-07-reorder.png` | ⬜ blocked Q6 |
| K2-08 | Back/nawigacja | wyjdź→wróć | Stan/scroll zachowany | ✅ (po build) | `k2-08-back.png` | ⬜ blocked Q6 |

### K3 — Karty korelacja artefaktów (linked-items, trwała)  · seria K
**Cel:** Trwałe (DB-backed) powiązania inicjatywy z artefaktami (task/decyzja), org-scoped, fail-safe; load-on-expand, persist add/remove z rollbackiem; pod graf zależności.
**Epiki:** E1 tabela `initiative_linked_items` · E2 CRUD+persist · E3 graf/query.
**Kod:** FE: `sections/LinkedItemsSection.tsx` (load-on-expand, optimistic add/remove, rollback, fail-open) · BE: `initiativeLinkedItemsService.ts` (org-scope, `ON CONFLICT DO UPDATE`, fail-safe) + `GET/POST /:id/linked-items`, `DELETE /:id/linked-items/:linkId`

**Testy automatyczne:**
| Poziom | Co weryfikuje | Plik | Status |
|---|---|---|---|
| unit (BE) | list/add/remove org-scope; fail-safe; upsert; walidacja pustych | `tests/unit/initiatives/initiativeLinkedItems.test.ts` (6) | ✅ |
| integration | endpointy JWT+org-scope (404/403 cudza org); round-trip add→list | `linkedItems.endpoint.test.ts` | ⬜ do-build (real DB) |
| component | load-on-expand, optimistic add/remove+rollback | `LinkedItemsSection.test.tsx` | ⬜ do-build |

**Scenariusze:**
| # | Scenariusz | Kroki | Oczekiwany wynik | Headless | Dowód | Auto-status |
|---|---|---|---|---|---|---|
| K3-01 | Link task | linkedItems→Dodaj→task | `POST` `{targetType:'task'}`→201; wiersz | 🟡 | `k3-01-link-task.png` | ⬜ component |
| K3-02 | Link decyzja | Dodaj→decision | `POST` `{targetType:'decision'}`→201 | 🟡 | `k3-02-link-decyzja.png` | ⬜ |
| K3-03 | Persist po reload | dodaj→reload→otwórz | `GET` → link nadal obecny | ❌ real DB | `k3-03-persist-reload.png` | ⬜ integration |
| K3-04 | Graf/query | Analysis→graf | Powiązany artefakt jako krawędź | ❌ | `k3-04-graf-query.png` | ⬜ |
| K3-05 | Usuwanie | →Usuń→potwierdź | `DELETE`→200; rollback gdy błąd | 🟡 | `k3-05-usuwanie.png` | ⬜ component |
| K3-06 | Org-scope | token innej org dla cudzej inicjatywy | 404/403; brak wycieku | ❌ | `k3-06-org-scope.png` | ⬜ integration |

### K4 — AI-fill domknięcie sekcji  · seria K
**Cel:** Realne handlery AI-fill (hipoteza/OKR/lessons-learned) zamiast atrap; świadomy OPISANY no-op dla 4 złożonych (raci/change-log/workstream-owners/suggested-changes) bez „fake success".
**Epiki:** E1 realne handlery (usunięte z `SECTION_AI_NOOP`, dispatch+persist) · E2 świadomy no-op+opis.
**Kod:** FE: `InitiativeDocumentView.tsx` — `SECTION_AI_NOOP`, `runActiveSectionAi` (`case 'okr'/'hypothesis'/'lessons-learned'`→`POST /api/initiatives/generate-section`+`persistInitiativeField`). Commit `80e5ef94ea`.

**Testy automatyczne:**
| Poziom | Co weryfikuje | Plik | Status |
|---|---|---|---|
| source-level | `SECTION_AI_NOOP` bez hypothesis/okr/lessons; nadal 4 no-op; te 3 mają `case` | `tests/unit/initiativeDocumentView.section-ai-noop.test.ts` (3) | ✅ |
| component | klik AI w hypothesis/okr/lessons→`POST /generate-section`+persist | `InitiativeDocumentView.ai-fill.test.tsx` | ⬜ do-build |
| component | AI dla 4 no-op = disabled/opis, brak request | (j.w.) | ⬜ do-build |

**Scenariusze:**
| # | Scenariusz | Kroki | Oczekiwany wynik | Headless | Dowód | Auto-status |
|---|---|---|---|---|---|---|
| K4-01 | AI-fill OKR | sekcja `okr`→„Generuj z AI" | `POST {sectionKey:'okr'}`→OKR-y+persist | ❌ | `k4-01-aifill-okr.png` | 🟡 source / ⬜ component |
| K4-02 | AI-fill hipoteza | sekcja `hypothesis`→AI | teza §B3+persist | ❌ | `k4-02-aifill-hipoteza.png` | 🟡 source / ⬜ component |
| K4-03 | No-op opisany | sekcja `raci`/`change-log`/...→najedź na AI | disabled+opis; zero requestu | ✅ | `k4-03-noop-opisany.png` | ⬜ component |
| K4-04 | Brak fake-success | klik AI w no-op | brak fałszywego sukcesu; treść niezmieniona | ✅ | `k4-04-brak-fake-success.png` | ⬜ component |
| K4-05 | PL | AI-fill | treść po polsku (lang_pl) | ❌ | `k4-05-pl-tresc.png` | ❌ real |
| K4-06 | Jakość wg formuły | AI-fill→walidator K1 | spełnia §B3 | ❌ | `k4-06-jakosc-formula.png` | ❌ real |
| K4-07 | Persist po reload | AI-fill OKR→reload→`okr` | treść przetrwała | ❌ real DB | `k4-07-persist-reload.png` | ⬜ integration |

<!-- ════════════════════════ SERIA V — WIDOKI ════════════════════════ -->
## SERIA V — widoki (V1)

### V1 — Gantt zadaniowy + drag-reschedule  · seria V (widoki) · 2 ekrany
**Cel:** Task-poziomowy Gantt: bary w kolumnach tygodni z markerem „dziś" + pula undated; toggle Kalendarz/Gantt nad jednym źródłem czasu (`buildScheduleItems`, brak driftu); W5 drag-reschedule barów zadań (snap-to-day, optymistyczny+rollback, `PUT /api/pmo/tasks/:id`); spójność z Kalendarzem, dark/light.
**Epiki:** E1 schedule-bar dni/tygodnie · E2 drag-reschedule · E3 ścieżka krytyczna z `TimelineAnalysis`.
> **⚠️ GAP ugruntowany w kodzie:** `InitiativeGantt.tsx` rysuje WYŁĄCZNIE bary per `ScheduleItem` — **NIE renderuje linii zależności, ścieżki krytycznej, kontrolki zoom ani filtra statusu.** Te 4 pozycje z „Manual (10)" są NIEZAIMPLEMENTOWANE (E3 critical-path żyje tylko w `computeDependencyPlan`, nie w widoku) → rozjazd „epiki 3/3 ✅" vs faktyczny render. **Sygnał do programu M13.**
**Kod:** FE: `gantt/InitiativeGantt.tsx` (bary, dziś-marker, `weekCols`, undated, `cursor-grab` tylko `task`, `handlePointerDown`→snap→persist, override-map+rollback, próg „pół dnia"), `sections/TimelineSection.tsx` (toggle `scheduleView`, `aria-pressed`, wspólny `scheduleItems`+`handleScheduleReschedule`) · BE: `PUT /api/pmo/tasks/:id` (tylko `sourceKind==='task'`)

**Testy automatyczne:**
| Poziom | Co weryfikuje | Plik | Status |
|---|---|---|---|
| component | bar `cursor-grab` (draggable); drag→`PUT`+`onReschedule`; milestone NIE-draggable | `tests/components/Initiatives/InitiativeGantt.drag-reschedule.test.tsx` (3) | ✅ |
| component (mirror) | Calendar drag (3) | `InitiativeCalendar.drag-reschedule.test.tsx` | ✅ |
| component | render bary+dziś-marker; pusty/loading | `InitiativeGantt.render.test.tsx` | ⬜ do-build |
| component | undated → sekcja undated; drag<½dnia→brak persist; rollback przy reject; snap-to-day zachowuje durMs | (rozszerzyć Gantt.drag) | ⬜ do-build |
| component | toggle Gantt `aria-pressed`; re-klik→none; wzajemna wyłączność; spójność źródła Kalendarz/Gantt | `TimelineSection.schedule-toggle.test.tsx` | ⬜ do-build |
| e2e (render) | toggle Kanban/Timeline/Gantt/Grid bez ErrorBoundary+screenshot | `tests/e2e/m13/m13-manual.spec.ts` (§5.2/5.3) | ✅ |
| e2e (acceptance) | S3 Timeline Calendar/Gantt bez crasha | `tests/e2e/m13/m13-acceptance.spec.ts` (S3) | ✅ |

**Scenariusze:**
| # | Scenariusz | Kroki | Oczekiwany wynik | Headless | Dowód | Auto-status |
|---|---|---|---|---|---|---|
| V1-01 | Render barów zadań | seedTasks z datami→Timeline→Gantt | Każdy task z `start`=bar (`bg-primary-500/80`)+tytuł | ✅/🟡 z danymi | `v1-01-gantt-task-bars.png` | ⬜ do-build |
| V1-02 | Skala tygodnie + „dziś" | nagłówek+linia dziś | Kolumny Mon-start `dd mmm`; linia `pct(today)` | ✅ | `v1-02-week-scale-today.png` | ⬜ component |
| V1-03 | Drag → persist | pointer-down→przeciągnij >½dnia→puść | snap; `PUT {startedAt,dueDate}`; `onReschedule`; po reload nowa data | ❌→**component** | `v1-03-drag-persist.png` | ✅ component |
| V1-04 | Milestone NIE-draggable | przeciągnij kamień/fazę | brak `cursor-grab`/PUT; reschedule tylko `onReschedule` rodzica | ❌→component | `v1-04-milestone-not-draggable.png` | ✅ component |
| V1-05 | Rollback przy błędzie PUT | wymuś 4xx/5xx→przeciągnij | Bar wraca; task niezmieniony | ❌→component | `v1-05-drag-rollback.png` | ⬜ do-build |
| V1-06 | Zależności widoczne | szukaj linii zależności | **GAP — niezaimplementowane** | ❌ | `v1-06-dependencies.png` | ⬜ blocked (brak impl.) |
| V1-07 | Ścieżka krytyczna | szukaj podświetlenia CP | **GAP — niezaimplementowane** | ❌ | `v1-07-critical-path.png` | ⬜ blocked (brak impl.) |
| V1-08 | Spójność z Kalendarzem | toggle Kalendarz↔Gantt; reschedule w jednym | Ten sam `scheduleItems`; po dragu drugi widok = nowa data | 🟡 | `v1-08-calendar-gantt-consistency.png` | ⬜ component toggle |
| V1-09 | Zoom | szukaj kontrolki zoom | **GAP — niezaimplementowane** (skala stała) | ❌ | `v1-09-zoom.png` | ⬜ blocked (brak impl.) |
| V1-10 | Filtr | szukaj filtra statusu | **GAP — niezaimplementowane** (Gantt bez filtra) | ❌ | `v1-10-filter.png` | ⬜ blocked (brak impl.) |
| V1-11 | Dark | forceTheme dark→Gantt | Bary/nagłówek/dziś/undated czytelne (`dark:bg-navy-900`) | ✅ | `v1-11-gantt-dark.png` | ⬜ do-build |
| V1-12 | Light | forceTheme light→Gantt | Czytelne; brak danger-fill | ✅ | `v1-12-gantt-light.png` | ⬜ do-build |
| V1-13 | Pusty/undated | bez dat / taski bez `start` | `!range`→pusty stan; bez start→sekcja undated | ✅ | `v1-13-empty-undated.png` | ⬜ do-build |

**Widoki portfolio (kontekst V — §5.1/5.2/5.4, hub view-toggle):**
| # | Widok | Oczekiwany wynik | Headless | Dowód | Auto-status |
|---|---|---|---|---|---|
| PV-01 | Lista (§5.1) | Wiersze tabeli §27; klik→preview | ✅ render | `pv-01-list.png` | ✅ m13-manual §5.1 |
| PV-02 | Kanban (§5.2) | Kolumny per status; DRAFT widoczny (P1 fix) | ✅ render | `pv-02-kanban.png` | ✅ render-only |
| PV-03 | Timeline portfolio (§5.3) | Inicjatywy-paski na osi; klik→preview | ✅ render | `pv-03-timeline.png` | ✅ render-only |
| PV-04 | Grid (§5.4) | Karty; klik→preview | ✅ render | `pv-04-grid.png` | ✅ render-only |
> Uwaga: §5.3 portfolio Timeline (`InitiativesTimelineView`, oś czasu *huba*) ≠ V1 `InitiativeGantt` (Gantt *wewnątrz dokumentu*). Nie mylić.

---

## 4. Plan implementacji Playwright (jak uzyskać zdjęcia)

Zdjęcia „z prac wykonanych" pozyskujemy uruchamiając headless spec, który wykonuje wszystkie scenariusze **✅/🟡** i zapisuje PNG per scenariusz. Scenariusze **❌** i **⬜ blocked** idą poza headless (component/integration/real-browser).

### 4.1 Nowy headless spec (zdjęcia ✅/🟡)  ✅ ZBUDOWANY + ODPALONY 2026-06-22
- **Status:** `tests/e2e/m13/m13-katalog.spec.ts` — **14/14 green (1.9 min), 46 zdjęć** w `docs/qa/screens/m13-full/` (zweryfikowane: Gantt z barami, Kalendarz miesiąc, Kanban z 12 draftami, 26 sekcji dokumentu, dark/light huba+dokumentu, endpointy bramek/dedup/validate-card/linked-items ZAMONTOWANE). Drobny gap: toggle „Lista" to ikona (bez tekstu) → `pv-01-list` niezłapany; pozostałe 3 widoki + reszta OK.
- **Plik:** `tests/e2e/m13/m13-katalog.spec.ts` (lub podział per-seria: `m13-katalog-g.spec.ts` … `-v.spec.ts` dla równoległości workers=2).
- **SHOTS_DIR:** `docs/qa/screens/m13-full/` (nowy; ustaw w specu lub dodaj wariant helpera).
- **Reuse:** `_m13.ts` (`seedInitiative`, `seedTasks`, `openDoc`, `forceTheme`, `sectionNavLocator`, `shot`, `readTestSupportState`).
- **Zakres:** wszystkie wiersze z werdyktem ✅ lub 🟡 (render/API). Każdy → `await shot(page, '<id>')`. Scenariusze API (G3-x, G1-03/04) → request + screenshot stanu/odpowiedzi (np. render JSON w prostym page lub screenshot huba po akcji).
- **Liczba:** ~45–50 headless-zdjęć (G ~10, R ~22, C ~4, K ~10, V ~6). Reszta (~78) = ❌/⬜.

### 4.2 Component-testy do dopisania (CI, szybkie) — priorytet
`tests/components/Initiatives/`: `GateReadinessPill/Panel`, `GateOverrideModal` (G5) · `TasksMilestonesSection.crud/ai-proposal` (R1) · `DecisionsSection.gate-banner/crud/sort` (R2) · `InitiativeCalendar.views-filter/rollback` + `InitiativeSchedule.consistency` (R3) · `InitiativeCharterWizard.dedup` (C1) · `LinkedItemsSection` (K3) · `InitiativeDocumentView.ai-fill` (K4) · `InitiativeGantt.render` + `TimelineSection.schedule-toggle` + rollback/snap (V1). Wzorzec: `b3-hints.test.tsx` (stub WizardModal/i18n) + `InitiativeGantt.drag-reschedule.test.tsx` (pointer polyfill).

### 4.3 Integration-testy do dopisania (część wymaga real DB)
`tests/integration/initiatives/`: `gate-ai-soft-block` (+timeline-block case) · `notifications.gate-role/org-scope/assignment` · `tasks.update` · `decisions.crud` · `similar-check` · `validateCard.endpoint` · `linkedItems.endpoint` (real DB round-trip). Wzorzec: `notifications.test.ts` / `gate-ai-soft-block.test.ts` (realny kontroler + mock leaf-deps).

### 4.4 Real-browser / człowiek (❌) — checklista dla Piotra na demo (lub computer-use)
Modale wizardów (G5 override, Charter/AI), AI-gen live (C1-01, C2-x, K4 treść), pilot-role, kanały email, linked-items persist (real DB), drag wizualny. Dowód = screenshot z realnej sesji → `docs/qa/screens/m13-full/`.

### 4.5 Tier0 PR-gate
M13 acceptance już w `test:e2e:tier0` (`tier0-initiative-acceptance.spec.ts`). Po dopisaniu component/integration-testów CI łapie je automatycznie (`tests/components|integration`).

---

## 5. Sygnały do programu M13 (luki wykryte przy budowie katalogu)

1. **V1 — 4 epiki „Manual (10)" niezaimplementowane w widoku:** zależności (V1-06), ścieżka krytyczna (V1-07), zoom (V1-09), filtr (V1-10). `InitiativeGantt` rysuje tylko bary. E3 (critical-path) formalnie „3/3" w STAN-PRACY, ale brak w renderze → **rozjazd status vs kod.** Decyzja: dobudować czy zawęzić zakres V1?
2. **R4 — emitery niewpięte:** `notifyAssignment` (call-site brak) i `notifyDueBreach` (NIEZBUDOWANY — wymaga cron-joba/schedulera, infra). Kanały email zależne od Q3.
3. **K2 — cały sub-moduł blocked Q6** (CardContainer). 8 scenariuszy czeka decyzji.
4. **„registry 2/2" dla `generate_initiative`** (C2) wymienione w STAN-PRACY, ale plik testu NIE istnieje — kod jest, test do dopisania.
5. **MOCK_DB no round-trip** ogranicza dowód *funkcji* CRUD (R1/R2/K3/K4 persist) — pełny dowód wymaga real DB (trolley) lub storageState z sesji Piotra.

---

> **TL;DR:** ~128 scenariuszy G1→V1, każdy z werdyktem headless + nazwą zdjęcia + statusem auto. ~45–50 zdjęć pozyskamy headless (nowy `m13-katalog.spec.ts` → `docs/qa/screens/m13-full/`); ~24 plików auto do dopisania (component/integration, CI je łapie); reszta = real-browser (Piotr/computer-use). 5 sygnałów-luk do decyzji programowych.
