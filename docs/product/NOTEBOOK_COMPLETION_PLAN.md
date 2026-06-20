# M04 Living Notebook — PLAN DOKOŃCZENIA (5 równoległych agentów)

> Cel: domknąć notes do poziomu „3 najlepszych na świecie" **dla naszego use-case** —
> *zbierać · być codziennym aktywem · aktualizować się wg tematów · wspierany AI* —
> przy zachowaniu moatu: **notatka zamienia się w pracę i karmi Teresę**.
>
> **Wymogi już istnieją — ten plan je OPERACJONALIZUJE, nie wymyśla.** Źródła:
> - `docs/modules/LIVING_NOTEBOOK_MODULE.md` (wizja: living growth, smart surfaces, pamięć robocza, tematy)
> - `docs/benchmarks/notes-notebooks.md` (model danych Notion, role, IA)
> - `docs/product/NOTEBOOK_STRUCTURE_SSOT.md` (L0-L3), `NOTEBOOK_V3.md`, `docs/flows/core/NOTEBOOK_UX_SPEC.md`
> - `docs/UI_UX/97_RAW_IDEA_NOTEBOOK_CONTEXT_ENGINE` (silnik kontekstu/tematów)
> - `docs/product/NOTEBOOK_WORLD_CLASS_PLAN.md` (fazy techniczne) · `Harvard/wdrozenie-100/M04-notatnik.md` (luki)
> - `Harvard/Testy manualne/TESTY_M04_NOTATNIK.md` (54 scenariusze) · `docs/ui-standards/CANON.md` (kanon UI)
>
> **Werdykt bazowy (analiza 2026-06-20):** ~55-60% drogi; mocny edytor + unikalny convert-to-work;
> CZERWONE na 3 filarach: **daily ~25%, tematy ~30%, AI ciągłe ~55%, search ZEPSUTY na staging**.

## Zasada twarda — rozłączne posiadanie plików (anti-clobber)
`NotebookContent.tsx` = 2986-l. monolit. 5 agentów NIE może go edytować równolegle (git-race). Dlatego:
- **Każdy agent ma WYŁĄCZNY zestaw plików** (niżej). NIE dotyka plików spoza zestawu.
- **Nikt nie edytuje współdzielonych rejestrów:** route-index (`server/src/routes/*index*`), `src/types/myWork.ts`, ani `NotebookContent.tsx` (poza Agentem 4). Zamiast tego agent **zwraca snippet integracyjny** (rejestracja route'a, 1-liniowy hook) — **orchestrator (CTO) wpina centralnie**.
- **Migracje:** każdy agent nadaje plik z UNIKALNYM prefiksem timestamp (podany niżej), żeby nie kolidowały.
- **Testy:** tylko **unit/vitest** w swoim zakresie. **NIE uruchamiać Playwright/dev-serwerów** (kolizja portów :3000/:3001 + restart backendu psuje innych). Orchestrator robi E2E + live + screeny + commity centralnie.
- **Bez `git add`/commit/push** w agencie. Bez `git add -A`. Orchestrator commituje.

---

## AGENT 1 — Tematy jako żywa warstwa (Topics engine) 🧠
*Filar „aktualizacja wg tematów" — najsłabsze ogniwo. Dziś `suggest-topics` = sugestia per-notatka; brak encji agregującej.*

**Buduje:** Tematy = pierwszoklasowa encja. Notatka auto-przypina się do tematów; temat agreguje notatki + linked outputs + inicjatywy; „ten temat ma 7 notatek, 2 raporty, 1 inicjatywę".

**WYŁĄCZNE pliki:**
- `server/migrations/20260620_1000_notebook_topics.ts` — tabele `notebook_topics` (org-scope) + `notebook_page_topics` (join page↔topic, score, source: 'ai'|'manual').
- `server/src/services/notebookTopicService.ts` — CRUD tematów + `deriveTopicsForPage(pageId)` (heurystyka+opcjonalnie LLM) + `aggregateTopic(topicId)` (notatki/outputs/inicjatywy).
- `server/src/routes/v8/notebookTopics.routes.ts` — `GET /api/v8/notebook/topics`, `GET /topics/:id` (agregat), `POST /topics`, `POST /pages/:id/topics` (przypnij), `DELETE`.
- `src/components/MyWork/notebook/NotebookTopicView.tsx` — widok tematu (agregat: notatki, outputs, inicjatywy, „ostatnio aktywne").
- `src/components/MyWork/notebook/NotebookTopicChips.tsx` — chipy tematów na notatce (klik → TopicView).
- `tests/unit/backend/notebookTopicService.test.ts` (vitest).

**DoD:** migracja idempotentna; `aggregateTopic` zwraca powiązane encje; przypięcie page→topic trwałe; unit zielony. **Zwróć:** snippet rejestracji route + jak wpiąć TopicChips w rail.

---

## AGENT 2 — Daily „Dziś" kokpit + Smart surfaces ☀️
*Filar „codzienne aktywo" — dziś ~25%. Notes otwiera się w tabelę-segregator, nie dzienny kokpit.*

**Buduje:** Dzienny sterownik — notes otwiera się (opcjonalnie) w „Dziś": dzisiejsza notatka, przypięte, ostatnie, **do przeglądu (Stale)**, świeże captures, **quick-capture** (szybkie wrzucenie myśli/linku z każdego miejsca).

**WYŁĄCZNE pliki:**
- `src/components/MyWork/notebook/NotebookTodayView.tsx` — kokpit „Dziś".
- `src/components/MyWork/notebook/NotebookQuickCapture.tsx` — szybkie wrzucenie (tekst/URL) → tworzy stronę z `capture_source`.
- `server/src/routes/v8/notebookToday.routes.ts` — `GET /api/v8/notebook/today` (agregat: pinned, recent, stale-to-review, fresh-captures).
- `tests/unit/backend/notebookToday.routes.test.ts` (vitest, MOCK_DB).

**DoD:** `GET /today` zwraca 4 sekcje; quick-capture tworzy stronę (reuse istniejącego POST pages); unit zielony. **Zwróć:** snippet rejestracji route + 1-liniowy hook wejścia „Dziś" do wpięcia w `NotebookContent`/`MyWorkHub`.

---

## AGENT 3 — Search/RAG fix + AI ciągłe wzbogacanie 🔎🤖
*Filar „zbierać→odzyskać" + „AI-owo". Dziś: search/RAG 500 na staging (`search_vector`); classify=heurystyka; brak AI ciągłego.*

**Buduje:** (a) naprawa FTS — search + RAG „zapytaj swoje notatki" działają; (b) AI auto-enrich po zapisie: auto-tagi + propozycje powiązań tematycznych (kontrakt do TopicService Agenta 1).

**WYŁĄCZNE pliki:**
- `server/migrations/20260620_2000_notebook_fts_repair.ts` — idempotentna naprawa kolumny/triggera `search_vector` (potwierdź wobec `627_notebook_fts_v4_note03.ts`; nie duplikuj — tylko guard `ADD COLUMN IF NOT EXISTS` + backfill).
- `server/src/routes/my-work/notebook.routes.ts` — **WYŁĄCZNY edytor tego pliku** — utwardź `search`, `rag-context`, `classify`, `suggest-topics` (degraded zamiast 500; classify deklaruje `method`; RAG zwraca cytaty do źródeł).
- `server/src/services/notebookAIEnrichService.ts` — `enrichPage(pageId)`: auto-tagi + `suggestTopicLinks` (wywoła interfejs `notebookTopicService.deriveTopicsForPage` — zakładaj kontrakt Agenta 1, jeśli brak to TODO-stub).
- `tests/unit/backend/notebookAIEnrich.test.ts`, `tests/e2e/m04-notebook/07-search-rag.spec.ts` (NOWY spec — ale **nie uruchamiaj**, tylko napisz; orchestrator odpali).

**DoD:** po naprawie `GET /api/notebook/search` i `POST /rag-context` nie 500 (lokalnie/po migracji); enrich-service ma unit; classify `method` zalockowany. **Zwróć:** czy migracja wymaga ręcznej aplikacji na staging (flaga dla CTO).

---

## AGENT 4 — Edytor PRO + wizual (SOLE owner monolitu) ✍️🎨
*Filar edytor/wizual. JEDYNY agent edytujący `NotebookContent.tsx` + pliki edytora.*

**Buduje:** obrazy w treści, code-highlight, bogatszy slash, cover image + icon picker, empty/skeleton/error states, uspokojenie palety (czerwień→akcent neutralny).

**WYŁĄCZNE pliki:**
- `src/components/MyWork/NotebookContent.tsx` — cover image w nagłówku, icon picker, empty/skeleton/error, paleta. (Typografia 0.1 JUŻ zrobiona — nie cofać: `max-w-3xl`, font 1rem, tytuł text-3xl.)
- `src/components/MyWork/notebook/extensions.ts` — +`@tiptap/extension-image`, code-block-lowlight.
- `src/components/MyWork/notebook/SlashMenu.tsx` — +image, quote, /date, columns.
- `src/components/MyWork/notebook/NoteCoverPicker.tsx` (NOWY), `NotebookLibraryContent.tsx` (skeleton/empty biblioteki).
- `server/migrations/20260620_3000_notebook_cover.ts` — kol. `cover_url` na `notebook_pages`.
- `server/src/routes/v8/notebookCover.routes.ts` — `PUT /pages/:id/cover`.
- pakiety: `npm i @tiptap/extension-image @tiptap/extension-code-block-lowlight lowlight` (zgłoś w raporcie).

**DoD:** obraz wklejony/uploadowany trwa po reload; cover trwa; skeleton zamiast „białego"; paleta — czerwień tylko destrukcja; tsc czysty; notebook unit (73) zielone. **Zwróć:** miejsca-sloty integracyjne (gdzie wpiąć TopicChips/Today/RAG-panel — komentarze `{/* SLOT: ... */}`).

---

## AGENT 5 — Graf powiązań + Eksport + Historia wersji 🕸️📤🕗
*Wyróżniki wiedzy + przenośność.*

**Buduje:** wizualny graf tematów/backlinków; eksport PDF/Markdown/DOCX; historia wersji z diff/restore.

**WYŁĄCZNE pliki:**
- `src/components/MyWork/notebook/NotebookGraphView.tsx` (NOWY, react-flow — konsumuje `/topics` Agenta 1 + istniejący link-graph).
- `src/utils/notebookExport.ts` (NOWY — reuse `notebookContentToMarkdown` z `notebookExpandToDocument.ts`; +PDF (jsPDF) +DOCX (reuse pipeline raportów jeśli dostępny)).
- `src/components/MyWork/notebook/NotebookExportMenu.tsx` (NOWY).
- `server/migrations/20260620_4000_notebook_versions.ts` — `notebook_page_versions`.
- `server/src/routes/v8/notebookVersions.routes.ts` — `GET /pages/:id/versions`, `POST /pages/:id/versions/:vid/restore`.
- `src/components/MyWork/notebook/NotebookVersionHistory.tsx` (NOWY).
- `tests/unit/...` per moduł.

**DoD:** eksport każdego formatu z treścią notatki; graf renderuje powiązania; restore wersji działa (unit); tsc czysty. **Zwróć:** snippety rejestracji route + slot wpięcia menu eksportu/historii.

---

## Integracja (robi CTO po powrocie agentów)
1. Rejestracja wszystkich nowych route'ów w indexie (centralnie, ze snippetów agentów).
2. Wpięcie komponentów w sloty Agenta 4 (TopicChips, Today entry, RAG panel, GraphView, Export/History menu).
3. Wpięcie hooka enrich (Agent 3) w save-path (`NotebookContent` scheduleSave → po zapisie wywołaj enrich).
4. Aplikacja migracji: staging auto (restart backendu); **prod = jawna zgoda Piotra**.
5. Pełny E2E (`tests/e2e/m04-notebook`) + nowy `07-search-rag` + regen 12 screenów (light/dark) + commity per workstream.

## Kolejność dostarczania wartości (po integracji)
Tematy (A1) + Daily (A2) + Search-fix (A3) = **rdzeń wizji** → najpierw. Edytor/wizual (A4) + Graf/Eksport/Wersje (A5) = wzmocnienie. MVP „living, daily, topic, AI" odczuwalne po A1+A2+A3 zintegrowanych.

## Decyzje Piotra (domyślne przyjęte „do końca")
- Real-time współpraca/komentarze (Faza 2 world-class) — **odroczone za ten plan** (XL; osobny strumień v1.1).
- Eksport: **PDF+MD najpierw**, DOCX best-effort (A5).
- i18n `t()` (L-11) — osobna fala i18n programu (nie blokuje).
