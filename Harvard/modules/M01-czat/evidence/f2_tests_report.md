# M01 Czat — FAZA 2: TESTY AUTOMATYCZNE (raport)

- Data: 2026-06-11
- Branch: `feat/deliverables-light` (drzewo czyste — wszystkie czerwienie poniżej są ZACOMMITOWANE, nie z lokalnych zmian)
- Runnery: FE/integration = **vitest** (root `vitest.config.ts`), E2E = **playwright**
- Log uruchomień: `Harvard/modules/M01-czat/evidence/f2_tests.log`
- Uwaga techniczna: `--reporter=basic` NIE działa w tej wersji vitest (`ERR_LOAD_URL`). Użyto domyślnego/`--reporter=dot`.

---

## 1. Inwentarz testów Czatu

### FE — unit/store/utils (`tests/unit`, `tests/store`, `src/**/__tests__`)
| Plik | Czego dotyczy | #it |
|---|---|---|
| tests/unit/hooks/useAIStream.test.ts | SSE stream hook, auto-retry | 18 |
| tests/unit/utils/chatPersistence.test.ts | trwałość wiadomości (localStorage) | 2 |
| tests/unit/services/chatNavigator.test.ts | nawigacja do rozmów | (kilka) |
| tests/unit/routes/appRoutes.chat-shell.test.ts | routing shell czatu | (kilka) |
| tests/unit/components/AIChat/deepThinkingRuntime.test.ts | deep-thinking runtime | — (SIEROTA, nie ładuje się) |
| tests/unit/detectMessageLanguage.test.ts | detekcja języka (S2 intencje) | (kilka) |
| tests/unit/voice/voice-server-config-boundary.test.ts | granica kluczy voice-config (S7) | (kilka) |
| tests/store/useConversationStore.chat-root-rehydrate.test.ts | rehydracja root rozmowy (S1) | 8 |
| tests/store/useConversationStore.p35-history.test.ts | historia/persistencja (S1) | 25 |
| tests/store/useConversationStore.displayMode.test.ts | tryb wyświetlania | (kilka) |
| src/components/AIChat/__tests__/composerCommands.test.ts | slash/komendy kompozytora (S2) | 14 |
| src/hooks/__tests__/useTeresaVoice.test.tsx | hook głosu Teresy (S7) | (kilka) |
| src/utils/__tests__/chatV9*, voiceFunnelTelemetry, buildRecentConversations… | flagi V9, telemetria głosu | wiele drobnych |

### FE — komponenty (`tests/components/AIChat`, `src/components/AIChat/**`)
Bogaty zestaw: UnifiedChatPanel (29), MessageBubble (2), MessageRenderer.{context-save,direction,policy}, ConversationList, ConversationItem.rename, ConversationRouteSync (4), AddFilesMenu, ToolsMenu, ThinkingBlock, ArtifactBadge/ArtifactsPanel/ArtifactModuleHome, CanvasRichEditor/CanvasMarkdownRenderer, WorkCanvasShell/WorkCanvasDocumentPanel, CoThinkerMenu/ModeSelector, FocusModeSelector, TeresaProposalCard, EnhancedChatInput.teresaVoice, TeresaTTSPlayer, TrustBadge, V8ContextIndicator/V8ArtifactRunControl, KimiWorkspace/* (Tabele…). Plus `tests/contexts/TeresaVoiceContext`, `tests/hooks/TeresaVoiceContext.lifecycle`.

### FE — canvas/intent unit (`tests/unit/AIChat`, `tests/unit/canvas`)
canvasDiffOps, canvasPatchOps, canvasStreamIntentDetector, canvasEmissionHeuristic, canvasViewMode, useCanvasAIStream, canvasMutationRisk, workCanvasActionErrorMessage.

### BE — integration (`tests/integration/...`, `tests/backend/...`)
| Plik | Dotyczy | #it |
|---|---|---|
| tests/backend/routes/conversations.routes.test.ts | CRUD rozmów (REAL) | 28 |
| tests/integration/routes/conversations.p35-history.test.ts | historia/persistencja (REAL) | 28 |
| tests/integration/routes/conversations.context-os.test.ts | capture do Context OS (S4) | 2 |
| tests/integration/routes/conversations.fail-closed.contract.test.ts | fail-closed kontrakt | 4 |
| tests/integration/chat/streaming.test.ts | streaming SSE (S1) | 5 |
| tests/integration/chat/artifacts.test.ts | artefakty czatu (S6) | 8 |
| tests/integration/chat/thinking-steps.test.ts | kroki myślenia | 5 |
| tests/integration/ai/ai-chat.routes.test.ts | trasy /chat | 3 |
| tests/integration/ai/ai-chat-stream-e2e-mode.test.ts | stream w trybie E2E | 1 |
| tests/integration/ai/ai-chat-confirm-stream.validation.test.ts | walidacja confirm/stream | 2 |
| tests/integration/ai/ai-chat-quick.routes.test.ts | /chat/quick | 5 |
| tests/integration/chat-projects/* (13 plików) | projekty czatu (personal/team scope) | ~64 |

### BE — serwisy/trasy (`server/src/**/__tests__`)
chatPolicyGateway.{contract,retrieval} (10), chatToSchema.{intentParser,mutationExecutor,safetyGuardrails} (S2→Tabele), virtualWorkerConversationLogger, v8/chat-routes, v8/chatExecutionService + integration flow, teresa.voice-config (5, S7), notebookAttachmentService (3, S3), documentStudioChatSourcePack. Plus FE-side: tests/unit/backend/services/messageService, conversationCollaboration.visibility, chatPermissionService/* (4), chatPolicyGateway.contract, ai-chat-stabilization-policy, ai-chat-artifact-contract.

### E2E (`tests/e2e`)
runtime/ai-chat-runtime-smoke (1), ai/ai-chat (5), unified-chat (13), table-platform/chat-to-schema (4), smoke/chat-refresh-persistence (1), smoke/ai-os-route-matrix (1), smoke/wave-1-chat-trust (1), smoke/wave-2-anna-teresa-voice (2), smoke/work-canvas-* (core 2, split 3, deeplink 1, editor 1, research-lineage 1).

---

## 2. Wyniki URUCHOMIENIA (rzeczywiste, nie z cudzych raportów)

| Zestaw | Komenda (skrót) | Wynik |
|---|---|---|
| FE unit/store/utils | `vitest run` (11 plików) | **104: 103 PASS / 1 FAIL**; +1 suite-collect FAIL (sierota) |
| FE komponenty AIChat | `vitest run UnifiedChatPanel + 10` | **CZERWONE**: UnifiedChatPanel 14 FAIL / 15 PASS; MessageRenderer.context-save FAIL; AddFilesMenu + ConversationItem.rename suite FAIL |
| FE voice/nav/composer | `vitest run` (10 plików) | **116 PASS / 0 FAIL** ✅ |
| BE service/policy/voice | `vitest run` (13 plików) | **78 PASS / 0 FAIL** ✅ |
| Integration chat/ai/conv (bez DB) | `vitest run` | **NIE-URUCHAMIALNE** lokalnie — wymaga Postgres (MOCK_DB=false) |
| Integration chat/ai/conv (efemeryczny Postgres) | `docker postgres:15` + `db:migrate --safe` + `vitest run` | **94: 93 PASS / 1 FAIL** |
| chat-projects pełny + p35 + streaming (DB) | `vitest run` | **64: 62 PASS / 2 FAIL** |
| E2E | (nie odpalane — wymaga app+browser) | inwentarz + analiza CI poniżej |

### Wykryte realne czerwienie (na zacommitowanym branchu)
1. **`CanvasArtifactSwitcher.tsx:84` — `(conversationArtifacts || []) is not iterable`** → przewraca 14 testów `UnifiedChatPanel`. Guard `|| []` nie chroni przed wartością nie-iterowalną. Kandydat na realny bug runtime (S6 — artefakty/Canvas).
2. **`chat-projects.list.filters` x2 (DB)** — `scope=team` i brak-scope zwracają zduplikowany/wyciekający wiersz (`['org-2','u-2']` zamiast `['org-2']`). Realny błąd logiki filtra lub izolacji danych testowych.
3. **`MessageRenderer.context-save`** FAIL (handler save-to-context z feedback action row) — S4.
4. **`AddFilesMenu`, `ConversationItem.rename`** — suite FAIL (do diagnozy: mock/render).
5. **`conversations.context-os` capture → 500 zamiast 201** — prawdopodobnie środowiskowe (pominięta migracja Context OS w lokalnym schemacie); do potwierdzenia na pełnym schemacie.

### Testy zepsute/brittle (anty-wzorce)
- **`tests/unit/components/AIChat/deepThinkingRuntime.test.ts`** — importuje nieistniejące źródło `src/components/AIChat/deepThinkingRuntime`. **Test-SIEROTA** (źródło usunięte/przeniesione) — fałszywa czerwień, do usunięcia lub przepięcia.
- **`tests/unit/voice/voice-server-config-boundary.test.ts`** — asercja **grepuje tekst źródła** tras voice-config (`toContain('clientToken')`). Po refaktorze trasy nie zawierają literału → FAIL. Brittle source-grep, testuje implementację a nie zachowanie.

### Skip/warunkowe
- `tests/integration/ai/ollama.integration.test.ts` + `l6-context-builder` — `describe.skipIf`/`it.skipIf` zależne od flag (Ollama/mapper). OK (świadome).

---

## 3. Mapa pokrycia 7 scenariuszy krytycznych

| # | Scenariusz | FE | BE/integration | E2E | W CI PR-gating? | Realne pokrycie? |
|---|---|---|---|---|---|---|
| **S1** | nowa rozmowa → SSE → reload → trwałość | useAIStream(18), useConversationStore.p35-history(25)+rehydrate(8), chatPersistence | conversations.routes(28), conversations.p35-history(28), chat/streaming(5) | runtime/ai-chat-runtime-smoke(1) **PR**; smoke/chat-refresh-persistence(1) nightly | **TAK** (unit+integ na PR; integ przez postgres-service; runtime smoke PR) | **MOCNE** |
| **S2** | slash/intercept intencji → cel | composerCommands(14), detectMessageLanguage | chatToSchema/intentParser, safetyGuardrails | smoke/ai-os-route-matrix(1) nightly; table/chat-to-schema(4) weekly | Częściowo (unit na PR; E2E tylko cron) | **DOBRE** (unit), E2E nie-gating |
| **S3** | załącznik pliku (ingest serwerowy) → odpowiedź | AddFilesMenu (**FAIL**) | notebookAttachmentService(3), documentStudioChatSourcePack | brak dedykowanego E2E | Słabo (FE suite czerwony; brak E2E) | **SŁABE** |
| **S4** | split-view → workspaceContext zasila czat | UnifiedChatPanel (**14 FAIL**), MessageRenderer.context-save (**FAIL**) | conversations.context-os(2, **1 FAIL**) | smoke/work-canvas-split(3), core-flow(2) nightly | Nie-gating + czerwone | **SŁABE/RYZYKO** |
| **S5** | share `/share/:token` → read-only → revoke | tests/components/Reports/ShareModal; (Tabele)TabeleSharePanel | document-studio-share-links.routes, documentShareLinkService/Dao, report-builder.share.routes | brak dedykowanego E2E share-czatu | Częściowo (share to głównie deliverables, nie rdzeń rozmowy czatu) | **CZĘŚCIOWE / luka dla share *rozmowy*** |
| **S6** | handoff intencji → Canvas chip artefaktu reload-safe | UnifiedChatPanel (FAIL), ArtifactBadge/ArtifactsPanel/ArtifactModuleHome, canvasStreamIntentDetector, WorkCanvasShell | chat/artifacts(8), ai-chat-artifact-contract | smoke/work-canvas-deeplink(1), editor-flow(1), research-lineage(1) nightly | Nie-gating; FE rdzeń czerwony (CanvasArtifactSwitcher) | **RYZYKO** |
| **S7** | głos Teresy (Gemini Live) → transkrypt | useTeresaVoice, TeresaTTSPlayer, TeresaVoiceContext(.lifecycle), EnhancedChatInput.teresaVoice, voice-server-config-boundary (**FAIL brittle**) | teresa.voice-config(5), voice/voice.tts-unavailable | smoke/wave-2-anna-teresa-voice(2) nightly | Częściowo (unit na PR; E2E cron) | **DOBRE** (unit), 1 test brittle |

### Pułapki potwierdzone
- **E2E istnieje, ale NIE chroni PR.** `e2e-nightly.yml` i `e2e-weekly.yml` są **cron/manual-only** (brak `push`/`pull_request`). Jedyny E2E czatu blokujący PR = `tests/e2e/runtime` (1 test, `runtime-smoke` job w `test-suite.yml`). Cała otoczka `smoke/*` (canvas split/deeplink, wave-1/2, refresh-persistence) i `ai/unified/table` **nie liczy się jako ochrona PR**.
- **Testy grepujące źródło** (`voice-server-config-boundary`) — testują implementację/tekst, nie zachowanie; łamią się po refaktorze bez regresji funkcjonalnej.
- **Integration „REAL" wymaga DB** — lokalnie bez `postgres-service` cały blok integ jest martwy (samoskip lub błąd połączenia). Ochrona istnieje wyłącznie w CI z `services.postgres:15`.

### CI — co realnie chroni czat na push/PR (main, develop)
- `test-suite.yml`: `tests/unit` (4 shardy), `tests/component` (8 shardów), `tests/integration` (3 shardy, postgres:15), L1–L3 coverage gates (L2 obejmuje `tests/components/AIChat/**` + per-plik progi dla UnifiedChatPanel/CoThinkerModeSelector/ToolsMenu/ConversationList), e2e:tier0 (BEZ czatu), `runtime-smoke` (AI Chat, 1 E2E).
- `e2e-nightly` (cron 03:00) → smoke (testDir `tests/e2e/smoke`). `e2e-weekly` (cron nd 03:30) → pełny playwright.

> UWAGA: `tests/component` shardy w CI uruchamiają m.in. `UnifiedChatPanel.test.tsx`, który u mnie ma 14 czerwonych. Jeśli to nie jest artefakt środowiska, **shard komponentów na PR powinien być czerwony** — wymaga weryfikacji w CI (możliwe że CI ma inny mock/setup dla `conversationArtifacts`).

---

## 4. Backlog testowy (braki)

| ID | Typ | Plik docelowy | Scenariusz | Priorytet |
|---|---|---|---|---|
| T-01 | fix (test+prod) | `src/components/AIChat/CanvasArtifactSwitcher.tsx` + `UnifiedChatPanel.test.tsx` | S6/S4 — `conversationArtifacts` nie-iterowalne; utwardzić guard `Array.isArray(...)` i naprawić mock | **P0** |
| T-02 | fix | `tests/integration/chat-projects/chat-projects.list.filters.test.ts` lub serwis list filtrów | S4/projekty — duplikat wiersza w scope=team | **P0** |
| T-03 | cleanup | usunąć/przepiąć `tests/unit/components/AIChat/deepThinkingRuntime.test.ts` (źródło nie istnieje) | S2 deep-think | **P1** |
| T-04 | refactor | `tests/unit/voice/voice-server-config-boundary.test.ts` → testować RESPONSE z trasy `/voice-config` (że nie ma surowego klucza), nie tekst źródła | S7 | **P1** |
| T-05 | E2E (PR-gating) | dodać kluczowe smoke czatu (`chat-refresh-persistence`, `wave-1-chat-trust`) do `tests/e2e/runtime` lub osobnego joba na push/PR | S1/S7 | **P1** |
| T-06 | E2E | `tests/e2e/smoke/chat-attachment-ingest.spec.ts` (NOWY) — załącznik → odpowiedź uwzględnia treść | S3 | **P1** |
| T-07 | integration | `tests/integration/chat/attachments-ingest.routes.test.ts` (NOWY) — serwerowy ingest pliku w kontekście rozmowy | S3 | **P1** |
| T-08 | fix | `tests/components/AIChat/AddFilesMenu.test.tsx`, `ConversationItem.rename.test.tsx` — naprawić suite-FAIL | S3/UX | **P2** |
| T-09 | integration/E2E | share *rozmowy czatu* `/share/:token` read-only + revoke (osobny od deliverables share) | S5 | **P2** |
| T-10 | integration | potwierdzić `conversations.context-os` capture na PEŁNYM schemacie (czy 500 to dryf migracji czy realny bug) | S4 | **P2** |
| T-11 | CI | przenieść kluczowe `tests/e2e/smoke/work-canvas-*` (deeplink/editor reload-safe) do triggera push/PR | S6 | **P2** |
| T-12 | unit | jawny test transkrypt-append po sesji głosu (Gemini Live) — obecnie pośrednio | S7 | **P3** |

---

## 5. Środowisko (powtarzalność)
- Efemeryczny Postgres: `docker run -d --name m01_test_pg -e POSTGRES_USER=iris -e POSTGRES_PASSWORD=iris_test -e POSTGRES_DB=iris_test -p 5544:5432 postgres:15`
- Migracja: `NODE_ENV=test DB_TYPE=postgres DATABASE_URL=postgres://iris:iris_test@localhost:5544/iris_test npm run db:migrate` (`--safe`; `--strict` pada na migracji 422 `initiative_kpis` — znany dryf).
- Uruchomienie integ: dołożyć `MOCK_DB=false`.
- Sprzątanie: `docker rm -f m01_test_pg`.
