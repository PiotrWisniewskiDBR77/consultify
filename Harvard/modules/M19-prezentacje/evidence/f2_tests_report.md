# M19 — Prezentacje — FAZA 2 (Testy automatyczne) — Raport

**Branch:** `feat/deliverables-light` · **Commit:** `7e081c090c` · **Data:** 2026-06-11
**Log uruchomień:** `Harvard/modules/M19-prezentacje/evidence/f2_tests.log`
**Komendy:** `npx vitest run <pliki>` (server/ dla Grupy A+B; root dla C+D)

---

## 1. INWENTARZ TESTÓW (rdzeń M19)

> Uwaga: grep „presentation*" zwraca ~130 plików, ale większość to infra governance/alerting/benchmark/operations-health (osobne podsystemy, nie rdzeń DeckBuilder/Studio P20). Poniżej wyselekcjonowany rdzeń modułu.

### Grupa A — BE serwisy (server/src/services/__tests__/)
| Plik | Czego dotyczy | Liczba |
|---|---|---|
| presentationDeckDocumentService.test.ts | normalizacja/serializacja deck document | 5 |
| presentationDeckDocumentService.normalizeDeckDocument.test.ts | normalizeDeckDocument edge | 1 |
| presentationDeckRevertService.test.ts | **eligibility** rewertu (czysta funkcja `evaluateRevertEligibility`) | 8 |
| presentationDeckBulkRevertService.test.ts | bulk-revert do bazowego snapshotu (czysta logika) | 10 |
| presentationDeckDiffSummary.test.ts | diff podsumowanie zmian | 3 |
| presentationExportParityService.test.ts | **export-parity** PPTX/PDF/HTML — parytet treści | 21 |
| presentationQualityGatesService.test.ts | quality gate `checkDeckQualityGates` (DB zamockowane) | 2 |
| presentationAgentEditService.test.ts | agent Teresa: parse intent + apply plan (in-memory) | 6 |
| presentationAccessPolicyService.test.ts | polityka dostępu (share/role) | 3 |
| presentationGeneratorGolden.test.ts | golden generacji deck | 5 |
| presentationNarrativePlannerService.test.ts | planer narracji (pipeline gen) | 2 |

### Grupa B — BE route/pipeline
| Plik | Czego dotyczy | Liczba |
|---|---|---|
| server/src/routes/__tests__/presentationStudio.routes.test.ts | **RBAC/permission + tenant-scope** Studio (supertest, realny router) | 71 |
| server/src/routes/__tests__/presentationPngExport.test.ts | eksport PNG | 4 |
| server/src/services/v8/__tests__/reportsPresModelService.test.ts | model danych prezentacji V8 (registry, export records) | 90 |
| server/src/services/report/pptx/__tests__/pptxPipelineGenerateDownload.test.ts | pipeline PPTX generate→download | 2 |

### Grupa C — FE component + unit
| Plik | Czego dotyczy | Liczba |
|---|---|---|
| tests/components/Presentations/DeckBuilder.test.tsx | DeckBuilder UI (render, MELS) | 7 |
| tests/components/ReportsAndPresentations/PresentationsTabContent.deeplink.test.tsx | zakładka Prezentacje w hubie + deep-link | 2 |
| tests/unit/reports/pptx-layouts.test.ts | layouty PPTX | 13 |
| tests/unit/backend/v4-smoke/r1-presentation.test.ts | smoke r1 prezentacja | 9 |
| tests/unit/backend/routes/presentations.routes.org-guard.test.ts | 403 RBAC gdy brak org (supertest) | 1 |

### Grupa D — Integration (tests/integration/presentations/)
| Plik | Czego dotyczy | Liczba | Charakter |
|---|---|---|---|
| p20-lifecycle.test.ts | pełny cykl deck (create→autosave→409→review→export→restore) | 10 | **LIVE-server fetch** (fasada) |
| p20-lifecycle-payload.test.ts | derywacja badge'ów lifecycle (`deriveDeckLifecycleBadge`) | 6 | **REALNY** czysty test |
| p20-export-resilience.test.ts | limit slajdów 422, brak ghost-deck | 2 | **LIVE-server fetch** (fasada) |
| confidentiality-controls.test.ts | blokada eksportu/share deck poufny (403) | 3 | **LIVE-server fetch** (fasada) |

### E2E (tests/e2e/) — istnieją, ale NIE w CI, NIE uruchomione (brak żywej apki)
| Plik | Liczba | W CI? |
|---|---|---|
| presentations-artifact-engine-smoke.spec.ts | 1 | NIE |
| presentations-export-contract.spec.ts | 2 | NIE |
| presentations-governance-loop.spec.ts | 4 | NIE |
| presentations-confidentiality-contract.spec.ts | 3 | NIE |

---

## 2. WYNIKI URUCHOMIENIA (@ 7e081c090c)

| Grupa | PASS | FAIL | SKIP | Czas |
|---|---|---|---|---|
| A — BE serwisy | 66 | 0 | 0 | 0,33 s |
| B — BE route/pipeline | 167 | 0 | 0 | 1,32 s |
| C — FE comp+unit | 39 | 0 | 0 | 1,39 s |
| D — Integration p20 | 21 | 0 | 0 | 0,68 s |
| **RAZEM** | **293** | **0** | **0** | — |
| E2E (4 spec / 10 test) | — | — | NIE URUCHOMIONE | — |

**Root-cause FAIL:** brak — zero failów. Żaden ze znanych wzorców (mock-drift react-i18next `t(key,{defaultValue})`, stale import, brak `<Router>`, schema-drift PG, rola „iris", stale middleware jak M17) **nie wystąpił** w rdzeniu M19.

**ALE — krytyczny haczyk Grupy D:** 21/21 PASS w 0,68 s **bez działającego serwera**. 15 z tych 21 testów (p20-lifecycle 10, export-resilience 2, confidentiality 3) to `fetch(http://localhost:3001)` z bramkami `if (status !== 201) return;` / `if (!deckId) return;` → **gdy serwera brak, asercje się nie wykonują, a test przechodzi pusto (vacuous pass)**. Tylko 6/21 (p20-lifecycle-payload) to realne testy czystej funkcji `deriveDeckLifecycleBadge`. To ten sam typ fałszywej zieleni co fasady w M18 — tu na poziomie testów integracyjnych, nie persystencji.

---

## 3. MAPA POKRYCIA SCENARIUSZY S1–S8

| # | Scenariusz | FE | BE | E2E | PR-gate (feat/*)? | Luka |
|---|---|---|---|---|---|---|
| S1 | Home modułu | częśc. (PresentationsTabContent.deeplink, DeckBuilder render) | — | spec istnieje, nie w CI | **NIE** | brak testu stanów pusty/loading/błąd huba |
| S2 | Generacja pipeline V8 (artifact-runs) | — | TAK (narrativePlanner, generatorGolden, studio.routes generate/preview, request-approval) | spec (artifact-engine-smoke) nie w CI | **NIE** | pipeline za flagą — brak testu ścieżki flag OFF |
| S3 | DeckBuilder WYSIWYG edycja + autosave | render-only (DeckBuilder.test) | autosave endpoint istnieje (routes:2116), brak testu jednostk. | tylko vacuous p20-lifecycle | **NIE** | **autosave + conflict 409 nietestowane realnie** |
| S4 | Historia wersji snapshot + restore | — | rewert: tylko **czysta eligibility** (revert/bulkRevert); realny INSERT/restore (routes:2161/2320) **bez testu DB** | tylko vacuous p20-lifecycle | **NIE** | **round-trip snapshotu nietestowany na realnej DB** |
| S5 | Quality gate eksportu (canExport blokada serwerowa) | — | gate-logika (qualityGates, DB mock); enforcement serwerowy `enforceQualityGateForExport`→422 (routes:358,1444…) **bez testu route** | export-contract spec nie w CI | **NIE** | **brak testu że route faktycznie zwraca 422 przy canExport=false** |
| S6 | Agent Teresa edit accept/reject + revert | — | TAK (agentEdit parse+apply, revert eligibility) — wszystko in-memory | — | **NIE** | brak testu pełnej pętli accept→persist→revert na DB |
| S7 | Share + publiczny viewer | — | accessPolicy (3), confidentiality share 403 (vacuous) | confidentiality-contract spec nie w CI | **NIE** | **publiczny viewer + token share bez realnego testu** |
| S8 | Eksporty PPTX/PDF/HTML/PNG export-parity | pptx-layouts (13) | **TAK, mocne** (exportParity 21, pptxPipeline, pngExport, reportsPresModel 90, studio.routes export-warnings) | export-contract spec nie w CI | **NIE** | parytet OK; brak realnego pliku-PDF/PPTX w teście integr. |

**PR-gate na feat/\*:** test-suite.yml odpala się tylko na `[main, develop]` (default = Londyn). Jobs **Levels Coverage (L1–L3)** i **Integration Tests** mają jawny krok „Deferred outside main/develop" → **na `feat/deliverables-light` NIE biegną wcale**. Dodatkowo testy `server/` (Grupy A+B) nie są wpięte w shardy root test-suite (osobny `server/package.json`), a E2E prezentacji nie są w żadnym workflow ani w `playwright.smoke.config.ts`. **Efektywne pokrycie PR-gate dla M19 na tym branchu ≈ 0.**

---

## 4. PUŁAPKI (zweryfikowane)

1. **S4 — snapshoty: persystencja REALNA, ale test jej NIE dotyka.** W odróżnieniu od M18 (fasada in-memory Map), tu snapshoty idą do realnej tabeli `presentation_deck_versions` (kolumna `deck_json_snapshot`), autosave `routes:2161`, restore `routes:2320`. **Architektura nie jest fasadą.** Problem odwrotny: `presentationDeckRevertService.test.ts` / `presentationDeckBulkRevertService.test.ts` testują **wyłącznie czystą funkcję `evaluateRevertEligibility`** (decyzja TAK/NIE), nie dotykają DB ani INSERT/SELECT. Realny round-trip autosave→snapshot→restore pokrywa **tylko** vacuous live-server `p20-lifecycle.test.ts`, który bez serwera nic nie asercjuje. **Wniosek: trwałość snapshotów jest realna w kodzie, ale niezweryfikowana żadnym uruchamianym testem.**

2. **S5 — quality gate: enforcement serwerowy ISTNIEJE, ale bez testu route.** `enforceQualityGateForExport` (presentations.routes.ts:358) wywoływane na każdej ścieżce eksportu (PDF/PPTX/HTML, linie 1444/1586/1904/5758), zwraca **422 `quality_gate_blocked`** gdy `!report.canExport && !allowOverride`. Test `presentationQualityGatesService.test.ts` sprawdza tylko logikę gate'u (z mockiem DB i `normalizeDeckDocument`) — **nie ma testu że endpoint eksportu realnie odrzuca z 422**. Override `?overrideQualityGate=true` także nietestowany.

3. **Testy ścieżki za flagą OFF (S2 pipeline V8):** generacja idzie przez studio.routes + narrativePlanner za flagą; testy pokrywają tylko ścieżkę „ON/preview". Brak testu zachowania gdy flaga pipeline OFF.

4. **Fasada testowa (nie persystencji):** 15 testów integracyjnych p20 przechodzi pusto bez serwera — fałszywa zieleń maskująca brak realnej weryfikacji lifecycle/eksportu/poufności.

---

## 5. BACKLOG TESTOWY (typ · plik · scenariusz · priorytet)

1. **[P0] integration (realna DB/sqlite)** — `tests/integration/routes/presentation-deck-versions.sqlite.integration.test.ts` (nowy) — **S4: round-trip autosave→snapshot do `presentation_deck_versions`→restore; asercja że przywrócony `deck_json_snapshot` == oryginał i version++.** (trwałość snapshotów — kluczowe)
2. **[P0] route test (supertest+mock DB)** — `server/src/routes/__tests__/presentationExportQualityGate.routes.test.ts` (nowy) — **S5: eksport deck z canExport=false → HTTP 422 `quality_gate_blocked`; z `?overrideQualityGate=true` → przechodzi; bez ghost-artifactu w ledger.** (bezpieczeństwo eksportu)
3. **[P0] naprawa fasady** — `tests/integration/presentations/p20-lifecycle.test.ts`, `p20-export-resilience.test.ts`, `confidentiality-controls.test.ts` — **zastąpić bramki `if(status!==201)return` realnym setupem serwera (webServer/beforeAll) ALBO przepisać na supertest in-process; inaczej skreślić jako fałszywą zieleń.** (15 vacuous testów)
4. **[P1] integration** — `tests/integration/.../presentation-autosave-conflict.test.ts` — **S3: autosave z nieaktualną wersją → 409 version-conflict.**
5. **[P1] route test** — confidentiality share — **S7: share deck non-public dla project_manager → 403 `CONFIDENTIALITY_SHARE_REQUIRES_ADMIN`; share public → 200 + shareToken; publiczny viewer renderuje read-only.** (realny, nie vacuous)
6. **[P1] integration** — agent Teresa — **S6: pełna pętla propose→accept→persist→revert na realnej DB (`presentation_ai_operations`).**
7. **[P2] CI** — `.github/workflows/` — **wpiąć `server/` test (Grupy A+B) i E2E prezentacji do gate'u; rozważyć smoke prezentacji w `playwright.smoke.config.ts`; potwierdzić, że Integration job biegnie po merge do Londyn.**
8. **[P2] FE component** — `DeckBuilder.test.tsx` — **S1/S3: stany pusty/loading/błąd + edycja inline + accept/reject propozycji AI w UI.**
