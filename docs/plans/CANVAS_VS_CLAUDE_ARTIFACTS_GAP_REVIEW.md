# Canvas — pełny przegląd wdrożenia vs Claude Artifacts (2026-06-10)

Cel dokumentu: kompletna ocena obecnego Canvasa (split-view w czacie), porównanie z benchmarkiem
Claude.ai Artifacts / ChatGPT Canvas / Kimi, oraz plan domknięcia wdrożenia do pełnej realizacji funkcji.
Źródła: audyt kodu (branch `feat/deliverables-light`), briefy `docs/benchmarks/`, plany
`docs/plans/DELIVERABLES_LIGHT_TARGET.md` + `docs/product/V8_1_...`, research Claude Artifacts (stan 2025→2026).

---

## 1. Po co jest Canvas (cel w systemie)

Canvas = prawy panel czatu, w którym AI (Teresa) **tworzy i edytuje żywe artefakty** zamiast wyrzucać
tekst do transkryptu. Doktryna (V8.1 + DELIVERABLES_LIGHT_TARGET):

1. **Czat jest pierwszym wejściem** do tworzenia deliverables (nie formularze studiów).
2. **Artefakt rośnie na żywo** obok rozmowy (wzorzec Kimi: checklista zadań + live artifact).
3. **Outputs Library** to kanoniczny dom artefaktów (registry V8.1) — Canvas to warsztat, Library to magazyn.
4. Canvas docelowo **zastępuje ciężkie edytory** (/wordy, /excele, deck-builder → tryb "pro"/legacy).

Funkcjonalności, z którymi Canvas się łączy:
- Teresa (intercept intencji PL/EN, tool `generate_presentation`, streaming do edytora),
- kontrakt generacji `POST /api/deliverables/generations` (plan→generate→validate→draft, per format),
- artifact registry + `work_canvas_drafts` (persystencja),
- UnifiedExportService (PDF/DOCX/PPTX/XLSX, lazy),
- workspace targets: zapis treści Canvasa jako Idea / Note / Initiative / Decision / Task,
- task-progress checklista w czacie (Kimi pattern).

---

## 2. Co Canvas ma DZIŚ (zweryfikowane w kodzie)

### Silnik — w większości GOTOWY
| Funkcja | Status | Dowód |
|---|---|---|
| Split-view shell + startery (document/presentation/…) | DONE | `WorkCanvasDocumentPanel.tsx` |
| Edytor TipTap (WYSIWYG markdown, toolbar, autosave 300ms) | DONE | `CanvasEditor/CanvasRichEditor.tsx` |
| Streaming AI do Canvasa (append/replace/generate, SSE, Esc=stop) | DONE | `CanvasEditor/useCanvasAIStream.ts` |
| Floating menu na zaznaczeniu (improve/rewrite) | DONE | `CanvasAIFloatingMenu.tsx` |
| AI-diff accept/reject (marki aiAdded/aiRemoved) | DONE | `canvasDiffOps.ts` |
| Provenance log (prompt+oryginał+zamiana per span) | DONE | `canvasProvenanceLog.ts` |
| Detekcja intencji prezentacja/dokument PL/EN | DONE | `documentIntentDetector.ts` (fix 332cf6a06e) |
| L1 Deck E2E: intent → checklista → żywy deck w split-view | DONE (verified live 2026-06-10) | `CanvasPresentationView.tsx`, `deliverablesGenerationService.ts` |
| Eksport PDF/DOCX/PPTX/XLSX (markdown→AST, natywne style) | DONE | `UnifiedExportService.ts` |
| Persystencja draftów (`work_canvas_drafts`) + artifact registry | DONE | `work-canvas.routes.ts`, `artifactRegistryService.ts` |
| Renderery: code, HTML, diagram, tabela, matryca, timeline, PMO doc | DONE/PARTIAL (read-only poza tabelą) | `Artifacts/renderers/*` |

### Częściowe / atrapy
| Funkcja | Status | Luka |
|---|---|---|
| Historia wersji | PARTIAL | tabela `work_canvas_versions` istnieje, **brak UI** (restore/diff/krokowanie) |
| Share links | STUB | token generowany, **brak publicznego viewera** `/public/artifacts/:token` |
| Wiele artefaktów per rozmowa | PARTIAL | `useArtifactsStore` trzyma listę, brak przełącznika UI; `activeArtifactId` ginie po reloadzie |
| Workflow approvals | SCAFFOLD | schemat jest, gate nigdy nie egzekwowany |
| Edycja diagramów/tabel | PARTIAL | diagram read-only (tylko regenerate); tabela bez formuł (celowo, lekki runtime) |
| Quick actions na zaznaczeniu | PARTIAL | tylko "improve"; brak menu skrótów (długość, ton, poziom) |

### Bugi krytyczne (z audytu UX 2026-06-10)
1. **`canvas-stream-request` silent no-op** — "dopisz w dokumencie o celach" w split-view: detektor łapie,
   strumień nie dociera do edytora, zero komunikatu. (P0, sparowane z L2)
2. **Placeholdery "MVP-1…"** w generatorze dokumentów — tekst deweloperski u użytkownika (D-L2-3, P0).
3. Ścieżki wejścia dokumentu (A–C) gubią kontekst: 8-polowy formularz, 2× przepisywanie promptu — naprawia D-L2-1.

---

## 3. Benchmark: co robi Claude Artifacts (stan 2026) i czym różni się od nas

Checklist zdolności Claude (z researchu, źródła w raporcie agenta):
1. **Auto-otwarcie panelu** gdy odpowiedź jest "significant & self-contained" (>~15 linii) + zwijanie do chipa w czacie.
2. Rejestr typów: markdown, code, **HTML-live, React-live**, SVG, Mermaid; toggle preview/source.
3. **Wiele artefaktów per czat + switcher** + biblioteka artefaktów cross-chat (Artifacts space).
4. **Liniowa historia wersji per artefakt** z krokowaniem wstecz/wprzód.
5. **Dwutorowa edycja: `update` (chirurgiczny old_str→new_str, ≤4 operacje) vs `rewrite`** — małe poprawki są
   natychmiastowe i tanie, bez regeneracji całości.
6. Highlight → Improve (scoped regen) / Explain.
7. Copy, download, **publish-to-link, org-share, remix/fork**.
8. AI-powered artifacts (`window.claude.complete`) — artefakt sam woła model.
9. Osobny pipeline prawdziwych plików (docx/pptx/xlsx/PDF) — u nas odpowiednik: UnifiedExportService.
10. Claude **NIE ma** bezpośredniej edycji przez użytkownika — to przewaga ChatGPT Canvas (typing, anchored
    comments z Apply, menu skrótów, widoczny diff) — **i nasza: mamy TipTap WYSIWYG**.

### Macierz: my vs Claude vs ChatGPT Canvas
| Zdolność | Claude | ChatGPT Canvas | Consultify dziś |
|---|---|---|---|
| Auto-emisja artefaktu z odpowiedzi | ✅ heurystyka | ✅ | ❌ tylko intencje deck/doc |
| Zwijanie do chipa + reotwarcie z wiadomości | ✅ | ✅ | ⚠️ częściowo |
| Wiele artefaktów + switcher | ✅ | ⚠️ | ⚠️ store tak, UI nie |
| Historia wersji z krokowaniem | ✅ | ✅ (+diff) | ❌ (schema bez UI) |
| Chirurgiczny update vs rewrite | ✅ | ✅ | ⚠️ diff na zaznaczeniu tak; update z polecenia w czacie = BUG (no-op) |
| Bezpośrednia edycja (typing) | ❌ | ✅ | ✅ **TipTap — przewaga nad Claude** |
| Accept/reject AI-diff | ❌ | ✅ | ✅ |
| Highlight → improve/explain | ✅ (kod) | ✅ | ✅ improve / ❌ explain |
| Menu skrótów (długość/ton/poziom) | ❌ | ✅ | ❌ |
| Publish/share link | ✅ | ❌ | ⚠️ STUB |
| Remix / use-as-template | ✅ | ❌ | ❌ |
| Biblioteka artefaktów | ✅ | ❌ | ✅ Outputs Library (registry) |
| Eksport do realnych plików | ✅ (skills) | ⚠️ | ✅ PDF/DOCX/PPTX/XLSX |
| Live deck generation + checklista (Kimi) | ❌ | ❌ | ✅ **przewaga** |
| React/HTML live apps | ✅ | ⚠️ kod | ❌ (anti-scope — słusznie) |

**Werdykt:** silnik edycyjno-generacyjny mamy na poziomie ~Claude+ChatGPT hybrid (TipTap + streaming + diff),
a w generacji decków z checklistą jesteśmy PRZED oboma. Luki są w **cyklu życia artefaktu**
(wersje, switcher, chip, share/remix) i w **moście czat→canvas** (update z polecenia = bug).

---

## 4. Czego brakuje do pełnej realizacji funkcji — plan domknięcia

### Faza A — P0, pokrywa się z ratyfikowanym L2 Doc (D-L2-1..4)
1. **Fix `canvas-stream-request` no-op** — polecenie w czacie musi modyfikować otwarty dokument
   (to jest odpowiednik mechaniki `update` Claude; bez tego Canvas nie spełnia podstawowej obietnicy).
2. **D-L2-3: koniec placeholderów** — `docContentGenerator` emituje wyłącznie realną prozę; założenia inline.
3. **L2 Doc E2E** wg DELIVERABLES_LIGHT_TARGET §11.2: intercept dokumentu → checklista → markdown w TipTap.
4. Wszystkie komunikaty interceptów przez ConversationStore (wzorzec 332cf6a06e).

### Faza B — cykl życia artefaktu (parytet z Claude)
5. **Historia wersji UI**: krokowanie + restore na `work_canvas_versions` (backend gotowy; brakuje
   endpointu `/restore` i selektora wersji w panelu).
6. **Switcher artefaktów** per rozmowa + trwały `activeArtifactId` + **chip artefaktu w wiadomości czatu**
   (zwiń/rozwiń — wzorzec Claude "collapse to card").
7. **Chirurgiczny update z czatu**: tryb `patch` w `useCanvasAIStream` (scoped do sekcji/nagłówka), żeby
   "zmień tytuł sekcji 2" nie przepisywał całego dokumentu.

### Faza C — dystrybucja
8. **Public viewer dla share-linków** (`/public/artifacts/:token`) — token już generowany.
9. **Use-as-template / remix** w Outputs Library (odpowiednik Remix Claude; mapuje się na akcje
   "Duplicate / Use-as-template" z TARGET_DESIGN §3).
10. Upgrade Outputs Library (chipy filtrów, statusy, akcje) — L4 wg planu.

### Faza D — polish edycji (przewagi ChatGPT Canvas)
11. Menu skrótów na zaznaczeniu: skróć/rozwiń, zmień ton, uprość/sformalizuj, "wyjaśnij" (do czatu).
12. Auto-emisja artefaktu: heurystyka "długa, samodzielna odpowiedź → artefakt zamiast ściany tekstu"
    (kryterium Claude: self-contained, >15 linii).
13. (Później) anchored comments z Apply; edycja diagramów; L3 Sheet.

### Anti-scope (świadomie NIE robimy — zgodnie z doktryną lekkiego runtime)
- React/HTML live-apps w artefakcie, AI-powered artifacts (`window.claude.complete` analog),
- realtime multiplayer (CRDT/Liveblocks) w v1,
- parytet z Airtable/Notion/Gamma w edytorach.

---

## 5. Zasoby Softy (docs/benchmarks/) — co z nich wynika dla Canvasa

16 briefów + 44 screenshoty; najważniejsze dla Canvasa:
- **Kimi** (chat-and-ai.md): split-view + checklista + tool-trace — już skopiowane w L1; pozostaje
  tool-trace (rozwijane karty kroków) jako opcjonalny polish.
- **Gamma** (presentations.md): async kontrakt generacji (już wdrożony), per-slide AI menu
  (regenerate/layout/image) — częściowo w CardRenderer; create-from-template = przyszły killer feature
  ("szablon raportu DRD + dane klienta → branded deck").
- **Notion/Coda/Airtable**: model blokowy i rekordowy — potwierdza decyzję D-L1-3 (one block model).
- **Liveblocks/Yjs/Figma** (realtime-collab.md): gotowa ścieżka na multiplayer, gdy wyjdzie z anti-scope.
- Anty-wzorce z briefów: monolityczny JSON, spinner bez postępu, one-shot prompt→artifact bez outline,
  dwa rozjeżdżające się korpusy treści.

---

## 6. Rekomendowana kolejność (zgodna z istniejącym planem L2)

| # | Krok | Rozmiar | Zależność |
|---|---|---|---|
| 1 | Fix canvas-stream no-op | S | — |
| 2 | D-L2-3 placeholdery out | S | — |
| 3 | L2 Doc E2E (generator + intercept + checklista) | M | 1,2 |
| 4 | Wersje UI + restore | S/M | — |
| 5 | Switcher artefaktów + chip w czacie | M | — |
| 6 | Patch-mode (chirurgiczny update) | M | 1 |
| 7 | Public share viewer | S | — |
| 8 | Use-as-template / Library upgrade | M | L4 |
| 9 | Shortcuts menu + auto-emisja | M | 3 |

Punkty 1–3 to ratyfikowany L2. Punkty 4–6 to nowa propozycja: domykają parytet z Claude Artifacts
najmniejszym kosztem (backend w dużej mierze istnieje).
