# Inwentarz funkcjonalności E — OUTPUTS + DOKUMENTY + PREZENTACJE + TABELE STUDIO + MEETING

Część mapy modułów V2. Zweryfikowane w kodzie 2026-06-11, branch `feat/deliverables-light`.

**Gating wspólny:**
- Beta lock: wszystkie 5 modułów = `'closed'` w `betaAccess.ts` + `BETA_ADMINS_EXEMPT = false` → sidebar zablokowany **dla wszystkich, łącznie z adminami**. Blokada tylko nawigacyjna — **bezpośredni URL działa**.
- Brama V8: `GET /api/artifacts` (listy Outputs) i pipeline generacji KIMI (`/api/artifact-runs`) za `v8FeatureGate` — wymagają `ENABLE_V8_GLOBAL=true`, inaczej 404 (`Gateway.ts:746-747`).
- `StudioSidebar` NIE unifikuje tych modułów — to osobne legacy „Studio" na `/studio` [UKRYTE]. Faktyczny unifikujący shell = **ExecutiveModuleShell (MELS)**: Document Studio (zawsze), DeckBuilder (flaga default ON), Tabele (flaga default OFF).

---

## MODUŁ: OUTPUTS (Outputs Library)

**Trasy:** `/presentations` (+ alias `/reports` → tab documents) → `ReportsAndPresentationsHub`; deep-linki `?tab=` + `?artifactId=`.
**Opis:** Zunifikowana biblioteka artefaktów (dokumenty, prezentacje, sheets, wzorce) na rejestrze `GET /api/artifacts` z governance (trust-state, review, eksport za aprobatą).

1. **7 zakładek taksonomii** — All | Mine | Needs review | Documents | Presentations | Sheets | Templates. [ZA FLAGĄ — backend `ENABLE_V8_GLOBAL`]
2. **Filtry** — status per-tab, typ outputu, visibility, stan review, źródło; chipy z licznikami; kanon raportów R1–R4. [DZIAŁA]
3. **Widoki table/grid + search + otwarte dokumenty** — [DZIAŁA]
4. **Bramka eksportu za aprobatą** — blokada bez `isExportApproved`. [DZIAŁA] `useRapData.ts:1423+`
5. **Review/publish flow** — start-review + „Approve & publish". [DZIAŁA]
6. **Trust-state (P18)** — 5 filarów (source/run/stage/visibility/export_ledger) w preview. [DZIAŁA]
7. **Lineage/provenance panel** — [DZIAŁA]
8. **Akcje wierszowe** — Otwórz (natywny edytor przez `resolveArtifactOpenPath`), podgląd, Discuss (Teresa), Save as template, Eksport PDF/PPTX, Archiwizuj. [DZIAŁA]
9. **Sheets tab** — artefakty sheet z rejestru, otwarcie w Table Builderze; brak CTA „New". [DZIAŁA / zależny od rejestru V8]
10. **Templates tab** — statusy active/draft/deprecated/archived, „Nowy wzorzec" → `/reports/builder`. [DZIAŁA]
11. **Demo-data fallback** — tablice DEMO_* w `useRapData.ts:192+` **martwe**; demo tylko seed Atelier Toys przy jawnym toggle. [STUB/MARTWY KOD]
12. **Teresa→Outputs (chat deliverables)** — deck/doc z `metadata.deliverable` + event `deliverables:draft-ready`. [ZA FLAGĄ `ENABLE_DELIVERABLES_LIGHT` + `VITE_…`, default OFF]
13. **Work Canvas → Outputs** — `register-in-outputs` (provenance canvasu; test regresyjny **uncommitted**). [DZIAŁA — fix świeży]
14. **Kreator prezentacji** — `/presentations/wizard` (Source→Setup→Outline→Generate→Result). [DZIAŁA]
15. **„New AI document"** — skrót do `/document-studio`. [DZIAŁA]
16. **Public share viewer** — `/presentations/shared/:shareToken` (bez auth). [DZIAŁA]

## MODUŁ: DOKUMENTY (Document Studio)

**Trasy:** `/document-studio[/:artifactId]` → `DocumentStudioView`; **`/wordy` = redirect-only** (tożsamość rozstrzygnięta, `/api/report-builder` zdeprecjonowany). **Backend:** `document-studio.routes.ts` (4332 l.) + publiczne routy share-linków.
**Opis:** Generator dokumentów AI klasy governance: intake→outline→dokument, szablony z architektem, edytor proposalowy w shellu MELS.

1. **Mode 1: Intake → Outline → Document** — formularz, plan konspektu (LLM on/off), generacja. [DZIAŁA]
2. **Mode 2: Template Architect** — plan/approve/deprecate szablonu + audit. [DZIAŁA]
3. **Mode 3: Generate z zatwierdzonego szablonu** — walidacja wymaganych źródeł z czytelnym błędem. [DZIAŁA]
4. **Persistencja — NAPRAWIONA vs 2026-06-02**: in-memory Mapy mają write-through DAO (`documentEditorStateRegistryDao`, migracja `20260603_document_studio_editor_state.sql`) + lazy hydration; resume przez URL. [DZIAŁA]
5. **Edytor proposalowy** — outline po lewej, canvas, prawa szyna Sources/Properties/QA/AI Editor; poziomy proposali: local/section/global/methodology/source/transformative; approve/reject. [DZIAŁA]
6. **QA report + bramka eksportu** — eksport markdown|docx|pdf z 403 + `qaOverride` dla uprawnionych. [DZIAŁA]
7. **Wersje/snapshoty + rollback** — [DZIAŁA]
8. **Komentarze, share-linki (+publiczny konsument), approvals, access history, audit trail, warianty, content blocks, brand voice** — pełne API wpięte w panel. [DZIAŁA]
9. **Lista zatwierdzonych szablonów w tabie Generate** — soft-fail. [DZIAŁA]

## MODUŁ: PREZENTACJE (Presentation Studio P20)

**Trasy:** `/prezentacje` → `PrezentacjeView`; **bramka kontaktowa (KimiModuleGate) USUNIĘTA** — dostępne dla każdego zalogowanego. Dodatkowo `/presentations/builder/:deckId` (DeckBuilder), `/presentations/wizard`, `/presentation-studio` (osobna powierzchnia S5).
**Opis:** Gamma-style generator decków: chat ↔ podgląd slajdów, potem pełny WYSIWYG DeckBuilder z governance.

1. **Home modułu** — Nowe/Ostatnie/Zapisane, grid szablonów, ostatnie artefakty. [DZIAŁA]
2. **Generacja decka (pipeline V8)** — create→preflight→accept→review→materialize przez `/api/artifact-runs`. [ZA FLAGĄ `ENABLE_V8_GLOBAL`; bez niej 404]
3. **Auto-trigger** — z pierwszej wiadomości czatu, `?templatePrompt=`, `?templateArtifactId=`. [DZIAŁA]
4. **Reopen z biblioteki** — `?artifactId=` + KPI + badge cyklu życia z trust-state. [DZIAŁA]
5. **Intent-routing po generacji** — komendy PL/EN: export PDF/PPTX, agent-edit, motyw/builder. [DZIAŁA]
6. **Quality gates przy eksporcie** — `canExport=false` blokuje download. [DZIAŁA]
7. **DeckBuilder (WYSIWYG)** — SlideSorter, CardCanvas, BlockToolbar, TipTap, undo/redo, autosave, Command Palette, media library, present mode. [DZIAŁA]
8. **MELS shell DeckBuildera** — default **ON** (`?ff_melsDeckBuilder`). [ZA FLAGĄ, domyślnie włączona]
9. **Motywy + brand kit** — [DZIAŁA]
10. **Historia wersji** — snapshoty serwerowe + restore + merge z lokalnymi. [DZIAŁA]
11. **Współpraca (collaborate)** — pole „Invite by email" i permisje **bez handlerów** — czysty UI. [STUB] `ShareModal.tsx:134+`
12. **Share + analityka** — token, publiczny viewer, ShareAnalyticsPanel. [DZIAŁA]
13. **Agent Teresa w deckach** — agent-edit + accept/reject, AgentActivityPanel, history + revert/bulk-revert. [DZIAŁA]
14. **Governance** — governance card, audit log, audit-integrity, watchlist/alert-subscriptions. [DZIAŁA]
15. **Eksporty** — PPTX, PDF, HTML, PNG, export-parity check. [DZIAŁA]
16. **Presentation Studio S5/S7** — `/presentation-studio`: read-only preview + generacja za dwustopniową bramką approval-ticket. [UKRYTE (tylko URL), DZIAŁA]

## MODUŁ: TABELE STUDIO

**Trasy:** `/tabele` → `TabeleView`; `/excele` = redirect; Builder: `/my-work/sheets/...` → redirect do Ideas Table z `?tpTable=`. **Backend:** `table-platform.routes.ts` (**193 endpointy**) + routery ai-editor/qa/conversion/form-intake/record-sources/relations/source-pack.
**Opis:** Operacyjna platforma tabel (Airtable-like): bazy/tabele/rekordy/widoki + lane generacyjny AI i 8-poziomowy AI Editor.

1. **Home modułu** — szablony za `isTemplateLifecycleEnabled()` default OFF. [część ZA FLAGĄ]
2. **Generacja tabeli z czatu** — pipeline V8 → materializacja `tp_*`. [ZA FLAGĄ `ENABLE_V8_GLOBAL`]
3. **Records API (fundament)** — `ENABLE_TABLE_PLATFORM_RECORDS_API` default **ON**; runtime check schematu (503 SCHEMA_NOT_READY przed migracjami). [DZIAŁA]
4. **Workspaces/bazy/tabele** — CRUD, duplicate, search, CSV import, audit, attachments, display-names. [DZIAŁA]
5. **Widoki** — Grid/Kanban/Calendar/Matrix, kolumny per widok, share widoku + PublicViewPage. [DZIAŁA]
6. **Edytor komórek/pól** — CellEditor/Renderer, FieldManager, FormulaEditor + FormulaEngineV2, linked records, rollupy, conditional formatting, date dependencies, undo/redo, realtime + presence. [DZIAŁA]
7. **AI Editor (8 poziomów)** — propose → `tableAiEditorService.applyProposal` / reject + budżet tokenów; BE runtime **ON** (komentarz mówi OFF — rozjazd dokumentacji), FE default ON. [DZIAŁA]
8. **QA Engine (5 osi)** — BE runtime ON, **FE `tabeleQaFlag` default OFF**. [ZA FLAGĄ (klient)]
9. **Source Pack** — BE ON, FE OFF. [ZA FLAGĄ (klient)]
10. **Materializer konwersji Table→Doc/Deck** — realny, idempotentny, deep-link; BE ON, FE `tabeleConversionsFlag` OFF. [ZA FLAGĄ (klient)]
11. **Formularze/intake** — FormBuilder, publiczny slug router, submissions; wariant JWT per-odbiorca default OFF. [DZIAŁA (slug) / ZA FLAGĄ (JWT)]
12. **Automatyzacje** — toggle/delete/runs/run-now/validate-cron + ScheduledAutomationExecutor. [DZIAŁA]
13. **Konektory/integracje** — webhooks, relays, extensions marketplace, interfaces, governed models (KPI/publish-to-results/sync-to-finance), SCIM/SSO services. [DZIAŁA — szerokość do osobnego audytu]
14. **Eksporty + intenty czatowe** — CSV/XLSX/JSON, propose-schema, explain-relation. [DZIAŁA]
15. **MELS shell Tabele** — default **OFF**; fallback KimiWorkspaceShell. [ZA FLAGĄ]
16. **Record provenance / confidence** — `ENABLE_RECORD_PROVENANCE` default OFF. [ZA FLAGĄ]

## MODUŁ: MEETING

**Trasy:** `/meeting` → `MeetingHub` (1662 l.) za ProductionModuleGate. **Backend:** `/api/meeting`.
**Opis:** Hub spotkań: lista/kalendarz, agenda, decyzje, follow-upy i notatki AI z transkryptu. **Stan „coming soon" z 2026-06-02 NIE obowiązuje** — zamontowany i wpięty w realny backend.

1. **Lista spotkań + kalendarz** — ModuleHub, filtry, preview pane. [DZIAŁA]
2. **CRUD spotkania** — tytuł, start/end, lokalizacja, uczestnicy, pre-read, agenda. [DZIAŁA]
3. **Status spotkania** — scheduled/completed. [DZIAŁA]
4. **Decyzje spotkania** — [DZIAŁA]
5. **Follow-upy** — dodawanie + toggle open/done. [DZIAŁA]
6. **Notatki AI z transkryptu** — „wklej transkrypcję" → summary/key points/decyzje/action items (LLM z heurystycznym fallbackiem); ekstrahowane persystowane. **Brak nagrywania/żywej transkrypcji — tylko paste.** [DZIAŁA]
7. **Operator brief** — per spotkanie. [DZIAŁA]
8. **Otwarcie spotkania jako dokument** — [DZIAŁA]
9. **Braki funkcjonalne (nie bugi):** brak edytora agendy, brak integracji kalendarza zewn., brak transkrypcji audio.

## Powierzchnie pomocnicze

| Powierzchnia | Trasa | Status |
|---|---|---|
| Legacy Studio (canvas+chat, snapshoty) | `/studio`, `/api/studio` | UKRYTE (brak wpisu w nav) |
| Presentation Studio S5 (approval-ticket) | `/presentation-studio` | UKRYTE (tylko URL) |
| Report Builder (origin dokumentów) | `/reports/builder` | DZIAŁA (CTA z Outputs) |
| Public deck viewer | `/presentations/shared/:token` | DZIAŁA (bez auth) |
| Public table view/form | PublicViewPage, form-public | DZIAŁA |
| `/wordy`, `/excele` | redirecty | DZIAŁA (redirect-only) |
