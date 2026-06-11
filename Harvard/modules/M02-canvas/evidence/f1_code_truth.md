# M02 Canvas — FAZA 1: Prawda kodu (weryfikacja czerwonych flag)

> Agent KOD · branch `feat/deliverables-light` · 2026-06-11
> Metoda: montaż→komponent→API→handler→SQL. Każda flaga = werdykt + dowód plik:linia.
> Podkłady traktowane jako HIPOTEZY. Wniosek nadrzędny: **podkłady (brief + inwentarz) są w kilku
> punktach STALE — opisują stan sprzed commitów P1 z 2026-06-10 (`d61f532f8d`, W2-E2). 4 z 6
> czerwonych flag OBALONE lub CZĘŚCIOWE. To zgodne z regułą „skany przeszacowują luki ~7:1".**

---

## 1. WERDYKTY 6 CZERWONYCH FLAG

### Flaga #1 — C4 provenance ledger NIE pisany na żywej ścieżce akceptu (poz.28 „dead-code path")
**WERDYKT: OBALONE.**

Ledger `provenance.materializedTo[]` jest realnie zapisywany na OBU żywych ścieżkach:
- **Akcept propozycji** (`POST /proposals/:id/approve`): `work-canvas.routes.ts:3632-3658` — po
  `createWorkspaceResource` dopisuje wpis `{target, entityId, url, title, at}` do
  `materializedTo[]` przez `updateDraftAfterOperation`.
- **Save-to-workspace** (`POST /drafts/:id/save-to-workspace`): `work-canvas.routes.ts:4027-4050` —
  ten sam wzorzec append-only.
- `updateDraftAfterOperation` (`work-canvas.routes.ts:1860-1892`) wykonuje REALNY
  `UPDATE work_canvas_drafts SET provenance_json = ? ... WHERE id = ? AND organization_id = ?` —
  to nie martwy kod, to persystentny zapis org-scoped.
- FE renderuje ledger: `WorkCanvasDocumentPanel.tsx:3208-3230` (`documentState.materializedTo`).

Inwentarzowa adnotacja „dead-code path" opisuje stan SPRZED domknięcia C4 (W2-E2 / f66a73f4).
`canvasMaterialize.ts` sam ledgera nie pisze (tylko tworzy encję) — pisze go warstwa route, co jest
poprawne architektonicznie.

### Flaga #2 — Deck: surowe `##` i `[Fact:…]` w slajdach (poz.12, P1)
**WERDYKT: OBALONE (z zastrzeżeniem regex-only).**

Istnieje sanityzer i jest stosowany na ŻYWEJ ścieżce generacji decka:
- `polishDeckText` (`presentationGeneratorService.ts:378-393`) usuwa: nagłówki markdown
  `^#{1,6}\s+` (l.380), tokeny `[Fact: <label>]` (l.381-386, drop dla id-labeli, zachowanie prozy),
  `**bold**`/`` `code` `` (l.387-388), prefiks `Data gap:` → fraza w języku decka (l.389-391).
- `sanitizeSlideContentValue` (l.395-406) rekurencyjnie czyści całą strukturę content.
- Stosowane w `buildSlideContent` (`:783` key_message, `:793` content) wołanym w głównej pętli
  `generateDeck` na `:1259`; ścieżka Narrative Engine też czyści: `:1327`.
- Commit `d61f532f8d` (2026-06-10 20:47) „fix(canvas): deck content hygiene" — POST-datuje
  inwentarz, stąd stale flaga.

Zastrzeżenie: to regex post-filtr, nie parser markdown — pojedyncze edge-case'y mogą prześliznąć się,
ale systemowy przeciek z inwentarza jest zamknięty.

### Flaga #3 — sourceRefs przyjmowane-nieużywane (poz.17, STUB)
**WERDYKT: OBALONE dla ścieżki doc/sheet; CZĘŚCIOWE globalnie.**

`sourceRefs` PŁYNIE end-to-end na ścieżce dokumentu z kontekstu encji:
- **UI WYSYŁA**: `UnifiedChatPanel.tsx:2481-2490` buduje `entitySourceRefs` z `workspaceContext`
  (typ+id+nazwa encji), przekazuje do `planDocGeneration({... sourceRefs})` na `:2500`.
- **Klient forwarduje**: `src/services/deliverablesGeneration.ts:148` wkłada `sourceRefs` do setupu
  doc → `POST /deliverables/generations`.
- **Kontrakt waliduje**: `deliverablesGenerations.routes.ts:74-88` (`SourceRefSchema`, `DocSheetSetupSchema`).
- **Generator UŻYWA**: `docGenerationRuntime.ts:115-187` mapuje `sourceRefs`→`sourceHints` (grounding),
  `:232` ekstrahuje `sourceInitiativeId` (linkage C7), `:370-413` używa do groundingMode.

Zastrzeżenie (dlatego CZĘŚCIOWE): (a) nie ma dedykowanego UI-pickera źródeł — `sourceRefs` powstają
WYŁĄCZNIE implicytnie z `workspaceContext`, gdy czat otwarty z karty encji; (b) ścieżka **deck**
(`buildDeckSetup`, `deliverablesGeneration.ts:102`) NIE przekazuje `sourceRefs` (deck używa osobnego
`sourceArtifacts`). Inwentarzowe „żadne UI nie wysyła" jest jednak OBALONE.

### Flaga #4 — regenerateSlide STUB (brief §6 C3)
**WERDYKT: POTWIERDZONE (stub).**

`presentationGeneratorService.ts:1656-1672` — `regenerateSlide` czyta deck z DB, parsuje `unified_json`
i zwraca `{ slide: unifiedJson.slides[slideIndex] }` — czyli **ISTNIEJĄCY** slajd. Zero wywołania LLM,
zero regeneracji, zero zapisu. Czysty placeholder. Brief jest tu uczciwy (§6 oznacza re-scoped).

### Flaga #5 — POST /:id/generate defaultuje do 'deck' (P2) + endpoint M-5 500 (P3)
**WERDYKT 5a (default deck): POTWIERDZONE.**
`deliverablesGenerations.routes.ts:198`:
`const format = body.format && VALID_FORMATS.includes(body.format) ? body.format : 'deck';`
Gdy klient nie poda `format` na `/generate`, router wymusza gałąź deck. Niski realny wpływ (klienci FE
zawsze podają format — `deliverablesGeneration.ts:174/226/237`), ale kontrakt jest niespójny: poll po
deck-id bez formatu trafi w `start()` deck-branch, który dla doc/sheet-id da `not_found`.

**WERDYKT 5b (M-5 500): NIEZWERYFIKOWANE.** Audyt 2026-06-10 (`CANVAS_MODULE_IMPLEMENTATION_AUDIT.md:103`)
podaje tylko „M-5 endpoint 500 (chip task_51148b11)" bez adresu pliku/endpointu. „M-5" to etykieta
fali wewnętrznej, nie da się jej jednoznacznie zmapować na route bez kontekstu chipa. Wymaga osobnego
runtime-repro (FAZA live). Pozostawiam jako otwarte P3.

### Flaga #6 — Zapis-jako-notatka bez toasta/linku (poz.24, P1)
**WERDYKT: OBALONE dla linku; CZĘŚCIOWE dla „toasta".**

`runWorkspaceAction` (`WorkCanvasDocumentPanel.tsx:2095-2126`) obsługuje WSZYSTKIE cele włącznie z
`note` (`save-as-note`→`note`, mapa `:379`). Po sukcesie:
- `:2116-2120` ustawia `setStatusFeedback` z tytułem ORAZ klikalnym linkiem markdown
  `[Open →](${targetPath})`, gdzie `targetPath = linked.url` zwrócone z BE.
- Dla notatki BE zwraca działający deep-link: `canvasMaterialize.ts:234`
  `url: /my-work/notebook/${ingest.pageId}` (W2-E2 naprawił rozjazdy ścieżek).

Zastrzeżenie: feedback to inline status-strip (`setStatusFeedback`), nie dedykowany komponent toast.
Ale twierdzenie inwentarza „bez toasta/linku" jest OBALONE co do linku (jest, działa, notatko-specyficzny)
i CZĘŚCIOWE co do formy (strip zamiast toast). „No notebooks yet" na deep-linku z audytu — to oddzielny
problem renderu Notatnika (poza M02), nie brak feedbacku Canvasa.

---

## 2. TABELA 1f — FLAGI (realne defaulty RUNTIME, nie komentarz)

| Flaga | Default (schema) | Warunek RUNTIME (plik:linia) | Kto włącza | Gdy OFF |
|---|---|---|---|---|
| `ENABLE_DELIVERABLES_LIGHT` (BE) | `false` (`FeatureFlags.ts:33`) | `process.env.ENABLE_DELIVERABLES_LIGHT === 'true'` (`FeatureFlags.ts:121`) | env serwera (D3, decyzja ownera) | **404** na całym `/api/deliverables/generations` — gate per-request `deliverablesGenerations.routes.ts:39-44` |
| `VITE_ENABLE_DELIVERABLES_LIGHT` (FE) | brak=OFF | `import.meta.env.VITE_ENABLE_DELIVERABLES_LIGHT === 'true'` (`deliverablesGeneration.ts:46`) | build env frontu | **Legacy redirect**: intencje czatu idą do `/wordy`/`/excele`/`/prezentacje` (`UnifiedChatPanel.tsx:2037-2040, 2584, 2773`), brak in-place Canvas |
| `ENABLE_TERESA_RETRIEVAL` (BE) | `false` (`FeatureFlags.ts:34`) | `process.env.ENABLE_TERESA_RETRIEVAL === 'true'` (`persona.ts:328`, `ai.routes.ts:3116`, `mcpServer.ts:104`) | env serwera | **Cicha pustka**: narzędzia READ org (search_insights/org_notes/get_initiative) nie rejestrują się; Teresa nie ma retrievalu tematycznego, auto-skan B4 nieaktywny. Bez 404/redirectu. |

Uwaga: wszystkie 3 defaultują OFF i runtime używa `=== 'true'`, więc **brak env = OFF** (nie „default true w komentarzu, false w runtime" — komentarz i runtime są zgodne). Produkcja nietknięta.

---

## 3. TABELA 1d — MARTWY KOD (realny status)

| Element | Twierdzenie inwentarza | Realny status (dowód) |
|---|---|---|
| `/ai/work-canvas` standalone shell | poz.31 „[UKRYTE — internal tools]" | **NIE-martwy, NIE internal — to REDIRECT.** `AppRoutes.tsx:1267-1270` montuje `<WorkCanvasRedirect>` (`WorkCanvasRedirect.tsx:13-29`), który robi `<Navigate>` na `/chat?workPanel=1&canvasDraftId=…`. Legacy deep-link → kanoniczny split UI. Adnotacja „internal tools" jest STALE. |
| `ArtifactsPanel`/`ArtifactViewer`/`ArtifactEditor` | poz.33 „[DZIAŁA, częściowo równoległy]" | **ŻYWY RÓWNOLEGŁY system, nie martwy duplikat.** `ArtifactsPanel` importowany i renderowany w `SplitLayout.tsx:21,403`; sterowany `useArtifactsStore` w `UnifiedChatPanel.tsx:737,4234,4948`; `SplitLayout` montowany w ~10 widokach (MyWorkView, ExecutiveView, AssessmentView…). To starszy silnik artefaktów czatu (kod/structured), działa OBOK `WorkCanvasDocumentPanel` (deliverables). Dwa systemy współistnieją — kandydat do konsolidacji, ale oba live. |
| `commitProposalToDomain` (`workCanvasService.ts`) | audyt: „dead code, mylące podwójne impl." | Realnie martwy/zduplikowany względem `materializeWorkspaceTarget` — żywa ścieżka akceptu używa `createWorkspaceResource`→materializer (`work-canvas.routes.ts:3611`). Kandydat do usunięcia. |

---

## 4. TABELA 1g — POŁĄCZENIA bez dowodu live w briefie (zweryfikowane w kodzie)

| Most | Status | Dowód |
|---|---|---|
| Canvas → **Decyzja** (materializacja) | ŻYWY | `canvasMaterialize.ts:240-258` — `decisionService.createDecision`, zwraca `/my-work/decisions/:id` |
| Canvas → **Task** (materializacja) | ŻYWY | `canvasMaterialize.ts:261-286` — `new TaskService().createTask`, zwraca `/my-work?taskId=…` |
| Panel „Artefakty" na **Inicjatywie** | ŻYWY | `InitiativeDocumentView.tsx:2688` `GET /api/artifacts?sourceInitiativeId=…` → BE `artifacts.routes.ts:329-331`; render sekcji `:8090` (C7), badge liczności `:4914` |
| Linkage `sourceInitiativeId` z draftu | ŻYWY | `work-canvas.routes.ts:2261-2315` ekstrahuje initiativeId z refów i wpina przy rejestracji outputu |

---

## 5. SYGNAŁY CROSS-ORG dla agenta SEC (próbka 6 endpointów work-canvas)

**Werdykt SEC: Canvas POZYTYWNIE odbiega od wzorca IDOR z M01/M03/M10/M13/M14. Org-scoping
egzekwowany centralnie. Brak gołego `WHERE id=?` na :id z URL.**

Centralny gate `ownedDraft` (`work-canvas.routes.ts:2064-2078`):
```
SELECT * FROM work_canvas_drafts WHERE id = ? AND organization_id = ?   (l.2068)
+ check: visibility==='project' || createdBy===userId || ownerId===userId
```
Każdy `/drafts/:draftId/*` najpierw woła `ownedDraft` i przy braku zwraca 404. Próbka:

| Endpoint | Linia | org-scope | Werdykt |
|---|---|---|---|
| `GET /drafts/:draftId` | `:2767` | ownedDraft (`AND organization_id`) | OK |
| `PUT /drafts/:draftId` | `:3283` | ownedDraft | OK |
| `GET /drafts/:draftId/export` | `:3242-3244` | ownedDraft | OK |
| `GET /drafts/:draftId/versions` | `:3728,3732` | ownedDraft → potem `WHERE draft_id=?` (draft.id już org-zwalidowany) | OK (bezpieczne — draft.id pochodzi z org-scoped SELECT, nie z URL) |
| `POST /drafts/:draftId/versions/:versionId/restore` | `:3848,3855-3857,3891` | ownedDraft + `WHERE id=? AND draft_id=?` na wersji + UPDATE `AND organization_id=?` | OK |
| `POST /drafts/:draftId/save-to-workspace` | `:3993` + materializer | ownedDraft + `assertOrgScopedReferences` (`canvasMaterialize.ts:87-114`, 403 `CANVAS_CROSS_ORG_REFERENCE`) | OK |

Dodatkowy guard C8 w materializerze (`canvasMaterialize.ts:87-114`) sprawdza org-membership
referencji wstecznych (`projectId`, `ownerId`, `taskAssigneeId`) bo serwisy downstream nie egzekwują —
to świadoma defensywa. Guard `CANVAS_CROSS_ORG_REFERENCE` z briefu **POTWIERDZONY**.

Subtelność do odnotowania (nie luka): zapytania na sub-zasobach (`work_canvas_versions`) bindują
`draft_id = ?` zamiast `organization_id`, ale `draft.id` jest zawsze produktem org-scoped `ownedDraft`,
więc cross-org niemożliwy. Wzorzec poprawny.

---

## 6. PODSUMOWANIE FAZY 1

| # | Flaga | Werdykt |
|---|---|---|
| 1 | C4 ledger martwy | **OBALONE** (pisany na obu żywych ścieżkach) |
| 2 | Deck `##`/`[Fact:]` przeciek | **OBALONE** (sanityzer `d61f532f8d`, regex-only caveat) |
| 3 | sourceRefs nieużywane | **OBALONE** doc/sheet · CZĘŚCIOWE (brak pickera, deck pomija) |
| 4 | regenerateSlide stub | **POTWIERDZONE** |
| 5a | /generate default deck | **POTWIERDZONE** (P2, niski wpływ) |
| 5b | M-5 endpoint 500 | **NIEZWERYFIKOWANE** (brak adresu, wymaga live-repro) |
| 6 | note bez toasta/linku | **OBALONE** dla linku · CZĘŚCIOWE dla formy (strip≠toast) |

Realne otwarte luki kodu po FAZIE 1: **regenerateSlide (stub), /generate default-deck (P2),
M-5 500 (do repro), commitProposalToDomain (martwy duplikat do usunięcia).** Reszta czerwonych flag
to dryf dokumentacji względem commitów z 2026-06-10.
