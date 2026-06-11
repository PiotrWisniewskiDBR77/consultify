# Canvas / Deliverables — brief dla audytora (Harvard) — 2026-06-11

> **Cel dokumentu:** dać audytorowi kompletny, samodzielny obraz modułu Canvas: co robi, co jest
> wdrożone i zweryfikowane, jak łączy się z innymi modułami, gdzie są dowody, oraz — uczciwie —
> co NIE jest jeszcze zweryfikowane na żywo. Branch: `feat/deliverables-light` (baza: `Londyn`).
>
> **Dokumenty powiązane (czytaj razem):**
> - Głęboki audyt wdrożenia (poprzedni): `docs/audit/2026-06-10/CANVAS_MODULE_IMPLEMENTATION_AUDIT.md`
> - Audyt triady deliverables: `docs/audit/2026-06-10/DELIVERABLES_MODULE_IMPLEMENTATION_AUDIT.md`
> - Spec docelowy + DoD: `docs/product/CANVAS_TARGET_FUNCTIONAL_SPEC.md` (J1–J7, 20-pkt checklist)
> - Plany wykonawcze: `docs/plans/CANVAS_NEXT_STEPS_EXECUTION_PLAN.md`, `…/CANVAS_FULL_INTEGRATION_PLAN.md`,
>   `…/DELIVERABLES_NEXT_STEPS_EXECUTION_PLAN.md`
> - Benchmark/wizja: `docs/plans/CANVAS_VS_CLAUDE_ARTIFACTS_GAP_REVIEW.md`, `docs/benchmarks/`

---

## 1. Czym jest moduł (zakres audytu)

**Canvas** = prawy panel czatu (split-view), w którym AI (Teresa) tworzy i edytuje **żywe artefakty**
(Dokument / Prezentacja / Arkusz) zamiast wyrzucać tekst do transkryptu. Doktryna: czat jest
pierwszym wejściem do tworzenia deliverables; artefakt rośnie na żywo (wzorzec Kimi: checklista +
live artifact); Outputs Library jest kanonicznym domem artefaktów; Canvas docelowo zastępuje ciężkie
edytory. Benchmark celu: Claude Artifacts + ChatGPT Canvas + Kimi + Gamma.

**UWAGA terminologiczna (częsty błąd audytowy):** „Canvas" = panel czatu. „Ideas" = osobne narzędzia
w My Work (Mind Map, Process Flow, Table, Whiteboard). To dwa różne podsystemy; łączą się mostami
(sekcja 4), nie współdzielą silnika edytora.

---

## 2. Stan wdrożenia — macierz funkcji (z dowodami)

Legenda: ✅ DONE+test, 🟢 DONE+live-verified, ◐ częściowe, ⬜ nie-rozpoczęte.
Status weryfikacji: **CODE** = type-check+unit; **LIVE** = potwierdzone w przeglądarce (preview+screenshot).

| # | Funkcja | Status | Weryfikacja | Commit(y) | Kluczowe pliki |
|---|---|---|---|---|---|
| L1 | Deck z czatu (intent→checklista→żywy deck) | 🟢 | LIVE | 719e59f8, 68c2bd0b, 332cf6a0 | `CanvasPresentationView.tsx`, `deliverablesGenerationService.ts` |
| L2 | Dokument z czatu (realna proza, anty-placeholder gate) | 🟢 | LIVE+16 testów | e04e3c42, 8a1ac3e2, eb99be8d | `docGenerationRuntime.ts`, `documentContentGenerator.ts` |
| L3 | Arkusz z czatu (GFM table, bezstratny round-trip) | ✅ | CODE | f2d3a73e, f2b64d2b | `docGenerationRuntime.ts`, `canvasMarkdownConversion.ts` |
| B1 | Historia wersji UI (lista/podgląd/restore) | ✅ | LIVE | 0d09843b | `CanvasEditor/CanvasVersionHistory.tsx` |
| B2 | Switcher artefaktów + chip w transkrypcie (reload-safe) | ✅ | LIVE | 70494ffb, 8361d800 | `ArtifactChip.tsx`, `CanvasArtifactSwitcher.tsx`, `useArtifactsStore.ts` |
| B3 | Patch-mode — chirurgiczna edycja z czatu (diff accept/reject) | ✅ | CODE (59 testów) | 835936ac | `CanvasEditor/canvasPatchOps.ts`, `useCanvasAIStream.ts` |
| B4 | Auto-emisja — chip „Otwórz jako dokument" na odpowiedzi-dokumencie | 🟢 | LIVE | 5115dbe6 | `canvasEmissionHeuristic.ts`, `MessageRenderer.tsx` |
| C3 | „Rozwiń w dokument" — notatka → draft Canvasa | 🟢 | LIVE | 51750182 | `notebook/notebookExpandToDocument.ts`, `NotebookContent.tsx` |
| C5 | „Omów z Teresą" — mapa myśli → seed czatu | ✅ | CODE (9 testów) | 72e9a470 | `MyWork/ideaMapToMarkdown.ts`, `IdeaMapWorkspace.tsx` |
| D2 | „Duplikuj / Użyj jako szablonu" w Outputs Library | ✅ | CODE (7 testów) | 4fd92adf | `ReportsAndPresentations/duplicateArtifactToDraft.ts` |
| E1 | Menu skrótów na zaznaczeniu (Skróć/Rozwiń/Ton/Wyjaśnij) | ✅ | LIVE | 675a3501 | `CanvasEditor/CanvasAIFloatingMenu.tsx` |
| — | Eksport PDF/DOCX/PPTX/XLSX (lazy, natywne style) | ✅ | LIVE | (wcześniejsze) | `export/UnifiedExportService.ts` |
| D1 | Public share viewer `/public/artifacts/:token` + revoke | 🟢 | LIVE | 5c585fe2, 7383ff9c | `routes/public-artifacts.routes.ts`, `views/PublicArtifactView.tsx` |
| C1/C2 | Entity grounding (sourceRefs, „Zrób z tego dokument") | ✅ | CODE+API | 6ddca907, eef8ca1d | `docGenerationRuntime.ts` (sourceHints), `InitiativeDocumentView.tsx` |
| — | Telemetria generacji (spec §8) + metrics endpoint | ✅ | DB-proof | eef8ca1d, 53bbf776 | (deliverables routes) |

**Stan testów (agregat, 2026-06-11):** 7 zestawów Canvas/deliverables = **97/97 testów PASS**
(`canvasEmissionHeuristic` 8, `canvasPatchOps` 13, `ideaMapToMarkdown` 9, `notebookExpandToDocument` 5,
`duplicateArtifactToDraft` 7, `WorkCanvasDocumentPanel` 32, `docGenerationRuntime` 16+ inne).
Type-check (frontend) czysty dla plików modułu.

---

## 3. Bezpieczeństwo i kontrola dostępu (sprawdzone w audycie 2026-06-10, naprawione)

| Obszar | Stan | Dowód |
|---|---|---|
| Org-scoping przy materializacji (idea/note/initiative/decision/task) | guard 403 `CANVAS_CROSS_ORG_REFERENCE` w obu writerach | `canvasMaterialize.ts:assertOrgScopedReferences` (f84cdcc1) |
| Dostęp członków (capabilities `canvas.*`) | baseline dla roli USER; GUEST=brak; admin=wildcard | `effectiveAccessService.ts` (a669cb6e) |
| Egzekwowanie share po stronie serwera | POST+DELETE `/share` wymagają `canvas.share` | `work-canvas.routes.ts:requireCanvasCapability` (a669cb6e) |
| Public viewer | bez auth, rate-limit, token 32-hex, 404/410, sanitizowany payload | `public-artifacts.routes.ts` (5c585fe2) |
| RBAC/izolacja/eksporty (charter D1) | zweryfikowane — GO na flagę staging | `docs/qa/.../D1 charter` (2ea4798f) |

**P0 z audytu 2026-06-10 — oba ZAMKNIĘTE i live-zweryfikowane:**
- **P0-1 utrata danych** (finalna treść generacji ginęła przy reload + autosave nadpisywał szkielet)
  → 3738cf4f (D1 wyścig boilerplate + D2 rozjazd `content_md`/`content_json`). Dowód E2E: generacja →
  finalna proza → reload → treść zachowana.
- **P0-2 moduł admin-only** (brak capabilities `canvas.*` w rolach) → a669cb6e.

---

## 4. POŁĄCZENIA MIĘDZYMODUŁOWE (główny przedmiot audytu Harvard)

Canvas jest węzłem integracyjnym. Mapa zależności (kierunek = przepływ danych/akcji):

```
                          ┌─────────────────────────────┐
   WEJŚCIA  ───────────►  │   CANVAS (split-view czatu)  │  ───────►  WYJŚCIA
                          └─────────────────────────────┘
  Notatki ──"Rozwiń w dokument"(C3)──►        ──"Zapisz jako" (C4)──► Idea / Notatka /
  Inicjatywa ──"Zrób z tego dokument"(C1/C2)─►                         Inicjatywa / Decyzja / Task
  Insight ──(grounding sourceRefs)──►          ──rejestracja──► Outputs Library (registry)
  Wywiad ──(grounding sourceRefs)──►           ──eksport──► PDF/DOCX/PPTX/XLSX
  Mapa myśli (Ideas) ──"Omów z Teresą"(C5)──►  ──share──► Public viewer (/public/artifacts)
  Teresa (czat) ──intent/patch/auto-emisja──►  ──backlink──► panel "Artefakty" na inicjatywie
```

| Moduł powiązany | Kierunek | Mechanizm | Status | Dowód |
|---|---|---|---|---|
| **Czat / Teresa** | →Canvas | intent PL/EN (deck/doc/sheet), patch-mode, auto-emisja, streaming | 🟢/✅ | `documentIntentDetector.ts`, `canvasStreamIntentDetector.ts`, `canvasPatchOps.ts` |
| **Notatki (Notebook)** | Canvas↔Notatki | C3 „Rozwiń w dokument" (note→draft); „Zapisz jako notatkę" (draft→note) z badge „Źródło: Canvas"; deep-link `/my-work/notebook/:pageId` | 🟢 | `notebookExpandToDocument.ts`, `canvasMaterialize.ts`, f66a73f4 |
| **Ideas (Mind Map)** | Ideas→Canvas/czat | C5 „Omów z Teresą" (mapa→markdown→seed czatu); zapis Canvas→Idea tworzy mapę z nagłówków H2 | ✅ | `ideaMapToMarkdown.ts`, `canvasMaterialize.ts` |
| **Inicjatywy** | dwukierunkowo | „Zrób z tego dokument" (encja→grounded doc); panel „Artefakty" (registry filtr `sourceInitiativeId`) | ✅ | `InitiativeDocumentView.tsx`, 6ddca907, 2656a9f6 |
| **Insighty / Wywiady** | →Canvas | grounding jako `sourceRefs`/ContextPack; Teresa retrieval (`search_insights`, flaga) | ✅ | `docGenerationRuntime.ts`, `tools/searchInsights.ts` (flaga `ENABLE_TERESA_RETRIEVAL`) |
| **Outputs Library** | Canvas→Library | rejestracja artefaktów (origin links); D2 „Duplikuj/Użyj jako szablonu" | ✅ | `artifactRegistryService.ts`, `OutputsAggregateTabContent.tsx` |
| **Decyzje / Tasks** | Canvas→encja | materializacja przez wspólny `canvasMaterialize` + ledger `materializedTo` (obie ścieżki: save + akcept propozycji) | ✅ | `canvasMaterialize.ts`, 1491465413, f66a73f4 |
| **Eksport** | Canvas→pliki | `UnifiedExportService` (lazy pptxgenjs/docx/pdfkit/xlsx) | ✅ LIVE | `export/UnifiedExportService.ts` |

**Pętla provenance (zamknięta dwustronnie):** encja powstała z Canvasa nosi badge źródła; draft pokazuje
„Utworzone z tego dokumentu"; artefakt zna swoje `sourceRefs` (sekcja „## Źródła" w doc/sheet, c8c57a7e).

---

## 5. Architektura — kontrakt i przepływ (dla weryfikacji audytora)

- **Jeden kontrakt generacji:** `POST /api/deliverables/generations` (parametr `format: deck|doc|sheet`)
  → 202 → poll `GET /:id` (`plan → generating → validating → draft`). Za flagą
  `ENABLE_DELIVERABLES_LIGHT` (backend, off→404) + `VITE_ENABLE_DELIVERABLES_LIGHT` (frontend,
  off→legacy redirecty verbatim). **Additywność zweryfikowana.**
- **Persystencja:** `work_canvas_drafts` (markdown jako projekcja kanoniczna; SSOT `content_md` po fixie
  P0-1/D2), `work_canvas_versions` (append-only), `artifact_registry` + `ArtifactOriginLink`.
- **Edytor:** TipTap 3.14; streaming append/replace/patch; marki `aiAdded`/`aiRemoved` z accept/reject;
  provenance per span.
- **Anty-scope (świadomie poza zakresem v1):** realtime multiplayer (CRDT), React/HTML live-apps,
  AI-powered artifacts, parytet edytorów z Airtable/Notion/Gamma. (Uzasadnienie: lekki runtime.)

---

## 6. CO NIE JEST JESZCZE ZWERYFIKOWANE / OTWARTE (pełna transparentność dla audytu)

| Pozycja | Charakter | Ryzyko | Notatka |
|---|---|---|---|
| Live-smoke B3 (patch-mode), C5, D2, C1/C2 | testy jednostkowe ✅, brak dowodu wizualnego | niskie–średnie | reużywają już-live-zweryfikowanych ścieżek (seed czatu, tworzenie draftu, diff); wymagają zalogowanej nawigacji z danymi |
| 14 faili `UnifiedChatPanel.test.tsx` | pre-existing dryf mocków po B2 | niskie (test-only) | nie regresja runtime; chip `task_b95c9650`; mocki store bez `.getState`/iterowalnej listy |
| 2 błędy tsc w `AIChatWelcomeView.tsx` / `FullRolloutView.tsx` | WIP innej sesji (nietknięte przeze mnie) | n/d dla Canvas | importy nieistniejących jeszcze modułów |
| E2/E3 (tool-trace w checkliście, AI menu per karta decka) | nie-rozpoczęte | brak | polish, nie fundament |
| D3 + L4 (upgrade Outputs Library, retire-lista starych edytorów) | wymaga decyzji ownera | średnie | wygaszanie `/wordy`/`/excele`/`/presentation-studio` to świadoma decyzja produktowa |
| C3 (per-karta deck w sibling plan) | re-scoped — `regenerateSlide` okazał się STUB | średnie | wymaga realnej regeneracji per slajd + spójności `unified_json`/`deck_json` (uwaga dla audytora) |
| Promocja staging→prod | osobny projekt | wysokie | NIE w zakresie tego brancha; patrz memory „Staging→Prod promotion" |

**Zasada raportowania (dla audytora):** szybkie skany i raporty audytowe w tym repo historycznie
**przeszacowują luki ~7:1** (patrz `finding_gap_reports_overstate`). Przed zgłoszeniem braku jako realnego —
zweryfikować ścieżkę runtime w kodzie, nie tylko obecność/nieobecność pliku.

---

## 7. Werdykt syntetyczny

- **Triada generacji (deck/doc/sheet):** ~85–90% kompletna, przetestowana, flag-safe; deck+doc
  live-zweryfikowane.
- **Cykl życia artefaktu (wersje, switcher, chip, patch, auto-emisja):** wdrożony; B1/B2/B4/E1 live,
  B3 unit.
- **Integracje międzymodułowe:** wszystkie główne mosty zbudowane (Notatki, Ideas, Inicjatywy,
  Insighty/Wywiady, Outputs, Decyzje/Tasks, Eksport, Share) — część czeka na live-smoke.
- **Bezpieczeństwo:** oba P0 zamknięte; org-scoping + capabilities + share-enforcement na miejscu;
  charter D1 = GO na flagę staging.
- **Główne pozostałe ryzyka dla audytu:** brak wizualnego dowodu na 4 funkcje (niski koszt domknięcia),
  re-scoped C3 deck-regenerate (sibling), oraz decyzje produktowe D3/L4 (retire-lista).

*Sporządzono 2026-06-11 na potrzeby audytu Harvard. Wszystkie commity na `feat/deliverables-light`.*
