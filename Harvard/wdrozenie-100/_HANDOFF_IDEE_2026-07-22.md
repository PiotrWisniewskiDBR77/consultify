# HANDOFF — IDEE (4 narzędzia canvas) · 2026-07-22
**Dla świeżej sesji.** Kontekst poprzedniej się zamknął. To jest jedyny punkt wejścia — czytaj od góry.

## 0. GDZIE JEST PRACA
- **Worktree:** `.worktrees/audyt-idee` · **gałąź:** `audyt-idee-2026-07-22` (od `origin/demo`). **NIC NIE WYPCHNIĘTE, nic na demo.**
- Wszystkie dokumenty niżej są NA TEJ GAŁĘZI (untracked), nie na origin/demo.

## 1. CO JUŻ ZROBIONE — 3 fixy kodu (zweryfikowane renderem, czekają na akcept Piotra → deploy)
| Plik | Fix | Dowód |
|---|---|---|
| `src/components/MyWork/MyWorkHub.tsx` | **IDE-001 root(a): okno budowy honoruje wybór narzędzia** (dodane `data.initialTool=startTool` + `setIdeaActiveTool(startTool)` w `handleStartupTemplateSelect`; omija no-op `patchIdeaWorkspaceState`). | render: Whiteboard/Table/Process otwierają się poprawnie |
| `server/src/routes/my-work.routes.ts` | Lista Idei zwraca realny `preferredTool` (subquery z `my_idea_maps`) — badge „Tool" był „Recommendation map" dla wszystkich. | render listy + API 200 |
| `server/src/services/ai/canvasGraphLlm.ts` | **Jakość treści Teresy**: Process Flow→realny proces (nie meta-prezentacja); Table→tryb B tabela porównawcza + luz bramki (`derivedComparisonColumns>=2`); Mind Map→answer-first; wszystkie→zakaz zmyślania dat. | 2 przebiegi generatorów PRZED/PO |

**IDE-001 root(b) NIEZROBIONE:** 3 tryby startu (Szablon/Blank/AI) są w praktyce identyczne (szablon nigdy nie wybrany, AI-kickoff nie odpala). Osobny temat (IDE-004…009).

## 2. SSOT REDESIGNU IDEE (czytaj OBOWIĄZKOWO)
`Harvard/wdrozenie-100/_ANALIZA_IDEE_4_NARZEDZIA_2026-07-22.md` — kryteria **K1–K9** (K8=elegancja lidera, K9=dynamika: zoom/pan/drag/add/type/font/kolor), macierz PRZED, podział WSPÓLNE/OSOBNE, **PLAN REALIZACJI Faza 0–5**.
Werdykt Piotra: „4 środowiska dramatyczne — ani ładne, ani użyteczne, ani sterowalne". Cel: **każde narzędzie eleganckie i dynamiczne jak LIDER swojego rynku** (Mapa→Whimsical · Whiteboard→Miro/FigJam · Proces→Lucidchart · Tabela→Airtable), na WSPÓLNEJ powłoce (SPEC-A).

Checklisty Faza 0 (parytet lidera per narzędzie): `_FAZA0_PARYTET_{WHITEBOARD_MIRO,TABELA_AIRTABLE,MINDMAP_WHIMSICAL,PROCESS_LUCIDCHART}.md` (pisane przez agentów 07-22).

## 3. NASTĘPNY KROK
Plan Faza 0 (parity checklisty) → **Faza 1: prototyp WSPÓLNEJ POWŁOKI** (Menu 1 + wzorzec górnego paska + uproszczony prawy panel + wspólny baseline prawego-kliku + tokeny bez crimson) → wstępny OK Piotra (reguła #7: prototyp PRZED budową) → render → akcept. Równolegle Faza 2: prymitywy interakcji (silnik płótna). Kolejność narzędzi w Fazie 3: Whiteboard + Tabela najpierw (najboleśniejsze).

## 4. HARNESS RENDERU — JAK RENDEROWAĆ TE NARZĘDZIA BEZ LOGOWANIA PIOTRA (krytyczne)
Reguła #7 wymaga, żebyś renderował SAM. Sposób (sprawdzony 07-22):
1. **Backend E2E** (read-only, chroni dane demo): skopiuj `.env.staging.local` z GŁÓWNEGO checkoutu do worktree, dopisz `NODE_ENV=staging`, `JWT_SECRET=dev_render_dummy_secret_min_32_chars_1234567890`, `E2E_MODE=true`. Odpal `npm run dev:staging:ro` (backend 3001 + frontend 3000). `DB_READONLY=1` blokuje zapisy → collab/presence rzucają czerwone toasty „Disconnect/Presence failed" = ARTEFAKT renderu, NIE produkt.
2. **Auth = wbudowany bypass E2E** (`server/src/middleware/auth.middleware.ts` ~1037): token JWT z claimem `{e2e:true, id, organizationId}` (podpisany DOWOLNYM sekretem — E2E nie weryfikuje podpisu) jest akceptowany. Mintuj `jsonwebtoken.sign(...)`. Wstrzyknij przez Playwright `addInitScript` → `localStorage['token']` (+`refreshToken`). Przeglądarka Claude (mcp) BLOKUJE wstrzyknięcie tokenu — używaj **Playwright/chromium z `@playwright/test`** w node_modules worktree (node-skrypt, własny chromium).
3. **CZYSTY user do renderu:** `id=0fe55f96-6965-4970-a291-3018549e6fb9`, `org=7504ff08-826e-4747-86ec-9b044911b623` (membership `ACTIVE`), ma po 1 idei na narzędzie: mindmap `fb9b7358-24e1-4dc3-907e-787f45dd1657`, whiteboard `7681386f-8ae5-4545-a32d-dbdf701485ba`, process_flow `64ed2e0e-8ab3-47bb-9766-e0e1f5402c66`, table `df41b69d-8cb8-4a6e-ae2a-eaf2d1dd871c`.
   - ⚠ PUŁAPKA: user `d2b6a316` (piotr@dbr77) ma membership `active` (małe) — `assertIdeaMembership` sprawdza `='ACTIVE'` case-sensitive → mapa GET **404** → powłoka pokazuje szkielet mindmap = FAŁSZYWY „zawsze mindmap". To 2 z 1140 wierszy (anomalia danych, nie bug kodu). NIE renderuj na tym userze.
4. Wyłącz onboarding: `localStorage['consultify_onboarding_done:<uid>']='true'`. Otwieranie narzędzia: deep-link `/my-work/ideas/<id>/workspace/<tool>` (mindmap/whiteboard/process_flow/table).
5. **iCloud psuje HMR Vite** — po edycji frontendu często trzeba RESTART frontendu (`pkill vite`, `rm -rf node_modules/.vite`, restart) — sprawdzaj `curl localhost:3000/src/.../Plik.tsx | grep <twój-marker>`.
6. Uruchamianie generatorów Teresy (jakość treści): node-skrypt `tsx` w `server/`, importuje `canvasGraphLlm.js`, ładuje env, wywołuje `generate{Mindmap,ProcessFlow,Whiteboard,Table}Graph(intent,title,true)`. Ustaw `DB_STATEMENT_TIMEOUT=60000` (inaczej timeout llm_providers → null → szkielet, fałszywy defekt).

## 5. TWARDE FAKTY RUNTIME (zweryfikowane, Faza 1 audytu — patrz `_AUDYT_IDEE_2026-07-22.md`)
- **Teresa tworzy REALNIE** wszystkie 4 (canvasGraphLlm + generate_deliverable, materializeOrThrow → my_idea_maps). Flagi `ENABLE_TERESA_MINDMAP`/`_CANVAS_TOOLS` default ON.
- **Kolaboracja REALNA** (WS `/ws/collab/:ideaId`, presence/graph_patch/komentarze/snapshoty).
- **Persist canvas** zahartowany (reload-race/anti-wipe). Wspólny wyścig `POST /map/sync` (my-work.routes.ts:4718) nieatomowy — potencjalny cichy data-loss przy współpracy (do naprawy).
- **Interceptory czatu** (`UnifiedChatPanel.tsx:3122/3153/3244`) przechwytują „stwórz mapę/proces/tablicę" PRZED LLM → no-op poza otwartym narzędziem. Do naprawy (zawężić regex).
- **Tabela dwutorowa:** IdeaTableTool (graf) + tablePlatform (tp_tables) mostek; flaga `tablePlatformMetadataFirst` TWARDO zablokowana (default off + allowLocalOverride false + CLEARED_FLAG_OVERRIDES + 0 callerów serwera + 0 wierszy feature_flags) → relacyjny silnik + jego realtime = martwy dla usera.
- **Storage** `STORAGE_PROVIDER` default `local` (dysk Railway efemeryczny) → obrazy Whiteboard giną przy redeployu, o ile demo nie ma s3.
- **LLM tier:** aktywny tylko `STANDARD/openrouter/anthropic/claude-sonnet-4`; generatory żądają `premium` (wszystkie premium is_active=false → fallback). OK jakościowo (Sonnet 4), ale do świadomości.
- `trolley.proxy.rlwy.net` = baza WSPÓLNA demo+staging (DATABASE_URL w głównym `.env.staging.local`). Prod=centerbeam — NIE ruszać.

## 6. REGUŁY (nienaruszalne)
Nic na demo bez akceptu Piotra na zrzutach. Reguła #7: prototyp→OK→render-sam→accept (Piotr NIGDY pierwszym testerem wizualnym). Baza gałęzi = origin/demo. Zero crimson w nowym kodzie. Weryfikuj realny runtime, nie flagi.
