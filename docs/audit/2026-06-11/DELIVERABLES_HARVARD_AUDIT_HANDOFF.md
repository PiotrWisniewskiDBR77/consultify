# Deliverables light — handoff dla audytu Harvard

> **Cel dokumentu:** kompletny, code-verified stan modułu generacji deliverables (dokument /
> prezentacja / arkusz) + **mapa jego integracji z pozostałymi modułami** — przygotowany pod
> gruntowny audyt zewnętrzny.
> **Stan:** branch `feat/deliverables-light` @ `0a5acc30` (origin) · 2026-06-11.
> **Weryfikacja:** twierdzenia sprawdzone w bieżącym kodzie / DB / przez API dziś — NIE z pamięci
> (branch był równolegle rozwijany przez dwie sesje: `[D]` deliverables i `[C]` canvas overhaul).
> **Cała powierzchnia za flagami** (`ENABLE_DELIVERABLES_LIGHT` domyślnie OFF) — produkcja nietknięta.

---

## 1. Czym jest moduł (doświadczenie)

Generacja deliverables w modelu **Kimi/Gamma**: użytkownik pisze zdanie w czacie do Teresy
(„napisz raport o…", „stwórz prezentację…", „przygotuj budżet…") albo klika „Zrób z tego dokument"
na karcie encji. Powstaje plan (checklista postępu w czacie) i **żywy artefakt w prawym panelu**,
ugruntowany w danych organizacji. Bez formularzy, bez nawigacji do osobnego modułu.

Doktryna i pełna spec: `docs/plans/DELIVERABLES_LIGHT_TARGET.md` (architektura) +
`docs/plans/DELIVERABLES_TARGET_EXPERIENCE_SPEC.md` (docelowe doświadczenie, metryki §8) +
`docs/plans/DELIVERABLES_NEXT_STEPS_EXECUTION_PLAN.md` (fazy A–E, statusy).

## 2. Inwentarz kodu (code-verified, 2596 LOC + 28 testów)

| Plik | LOC | Rola |
|---|---|---|
| `server/.../deliverables/deliverablesGenerationService.ts` | 390 | Dispatch kontraktu (deck/doc/sheet); gałąź deck (owija `presentationGeneratorService`) |
| `server/.../deliverables/docGenerationRuntime.ts` | 1068 | Gałąź doc+sheet: plan/start/status, grounding, auto-skan, B3 źródła, A3 streaming |
| `server/.../deliverables/deliverablesTelemetryService.ts` | 82 | Eventy generacji (tabela `deliverables_generation_events`) |
| `server/.../deliverables/deliverablesMetricsService.ts` | 148 | Agregaty §8 (completion rate, p50/p95, grounding share) |
| `server/.../deliverables/errors.ts` | 20 | Błędy domenowe (code → HTTP) |
| `server/.../routes/deliverablesGenerations.routes.ts` | 248 | REST: POST plan, POST /:id/generate, GET /:id, GET /metrics |
| `server/.../types/deliverablesGeneration.ts` | 127 | Kontrakt SSOT (DTO plan→generate→poll) |
| `src/services/deliverablesGeneration.ts` | 289 | Klient frontend (plan/start/poll dla 3 formatów) |
| `src/components/AIChat/CanvasPresentationView.tsx` | 224 | Prawy panel decka (read-mostly, self-poll) |

Testy: `docGenerationRuntime.test.ts` (25: kontrakt, anti-placeholder, restart, B2/B3/B4, A3 streaming),
`deliverablesMetricsService.test.ts` (3). **28/28 zielone.** Suita `documentStudio` (855) bez regresji.

## 3. Kontrakt API (za flagą; 404 gdy OFF)

```
POST /api/deliverables/generations            → PLAN  (202-style; 200 + {generationId, plan, sources, warnings})
POST /api/deliverables/generations/:id/generate → GENERATE (202; w tle)
GET  /api/deliverables/generations/:id        → POLL  ({state, plan?, artifact?, error?})
GET  /api/deliverables/generations/metrics     → §8 metryki (admin+org-scoped)
```
Stany: `requested → planning → plan_ready → generating → validating → draft | error`.
Mapowanie błędów: `not_implemented→501, not_found→404, invalid_state→409, invalid_setup→400`.

## 4. MAPA INTEGRACJI Z INNYMI MODUŁAMI (przedmiot audytu)

Moduł celowo **nie ma własnego silnika** — jest cienką warstwą orkiestracji nad istniejącymi
modułami. Każda zależność jest jawna (statyczny lub lazy import) i, gdzie dotyczy danych, org-scoped.

### 4.1 Zależności serwerowe (co deliverables KONSUMUJE)

| Moduł / serwis | Punkt styku | Kierunek | Uwaga audytowa |
|---|---|---|---|
| **Presentations** (`presentationGeneratorService`) | `generateOutline`, `generateDeck` | deck plan/start owija je 1:1 | zero przepisania silnika decka; deck rejestruje się sam |
| **Document Studio** (`documentStudioService`, `documentContentGenerator`, `documentSchemaRenderer`) | `planDocument`, `materializeDocumentArtifact(useLlm:true)`, `renderSchemaToMarkdown` | doc one-shot używa silnika prozy D11 | **kluczowe:** D11 był martwy (nikt nie włączał `useLlm`) — obudzony w L2 |
| **Canvas / Work Canvas** (`workCanvasService`) | `createDraft`, `getDraft`, `updateDraft` (8× `AND organization_id`) | artefakt doc/sheet = wiersz `work_canvas_drafts` (kind=document/table) | dzięki temu dziedziczy edytor, wersje, share, eksport — bez duplikacji |
| **Outputs Library** (`v8/artifactRegistryService`) | `registerArtifactOrigin` | każdy gotowy artefakt rejestruje origin | doc→outputType report, sheet→sheet, deck→presentation; best-effort (błąd nie psuje generacji) |
| **Org knowledge — grounding** (`contextPackBuilder`) | `buildContextPack` [lazy] | sourceRefs encji → fakty do promptu | wspólny ContextPack z modułem prezentacji |
| **AI core** (`aiService.generateChatResponse`) | LLM dla sheet + streaming doc [lazy] | tier `standard` (ModelRouter) | jeden punkt wywołań LLM |
| **Teresa retrieval** (`ai/tools/searchInsights`, `searchOrgNotes`) | auto-skan B4 [lazy, za `ENABLE_TERESA_RETRIEVAL`] | intencja → top-N encji jako źródła | współdzielone z workstreamem canvas (C6) |
| **AI rate limiting** (`rateLimiting.middleware.aiRateLimiter`) | oba POST | 30/min prod, 200/min dev | reuse istniejącego limitera |
| **RBAC** (`presentationAccessPolicyService`, `rbac.middleware`) | `presentation_create` gate + `requireOrgAccess` | VIEWER bez prawa tworzenia | macierz uprawnień współdzielona z Presentations |

### 4.2 Zależności frontend (gdzie deliverables WCHODZI w UI)

| Moduł / komponent | Punkt styku | Rola |
|---|---|---|
| **Chat / Teresa** (`UnifiedChatPanel`) | intercepty `detectDocumentIntent`/`detectExceleIntent`/`detectPresentationIntent` + checklista | główne wejście; routuje intencję do generacji zamiast nawigacji |
| **Canvas split-view** (`WorkCanvasDocumentPanel`, `CanvasArtifactSwitcher`, `CanvasPresentationView`) | mount artefaktu w prawym panelu + event `deliverables:draft-ready` | współdzielone z workstreamem `[C]` (switcher, wersje, share) |
| **ConversationStore** | `appendLocalMessage`/`updateMessageContent`/`removeLocalMessage` | ephemeral checklista + trwały wpis końcowy |
| **Initiatives** (`InitiativePreviewV3`, `InitiativesHub`) | akcja „Zrób z tego dokument" (B1) → `openChatWithContext` + sourceRefs | wejście z encji; linkage `sourceInitiativeId` → panel „Artefakty" inicjatywy |
| **Table Studio** | bridge „Send to Table Studio" (odziedziczony z canvas draftu kind=table) | arkusz może przejść w platformę tabel |

### 4.3 Granice (czego moduł NIE robi — istotne dla zakresu audytu)
- Nie renderuje własnych eksportów — przepuszcza przez istniejący `work-canvas/drafts/:id/export`
  (DOCX/PDF/XLSX/CSV/MD — wszystkie zweryfikowane 200, §7).
- Nie ma własnego edytora — to canvas TipTap (workstream `[C]`).
- Nie zarządza wersjami/share — to canvas (workstream `[C]`).

## 5. Status realizacji (fazy planu wykonawczego)

| Faza | Zakres | Status | Commit / dowód |
|---|---|---|---|
| L1 | Deck E2E (chat→plan→żywy deck) | ✅ live | 731b30c6…332cf6a0 |
| L2 | Doc E2E (realna proza, D11 obudzony) | ✅ live | e04e3c42…eb99be8d |
| L3 | Sheet E2E (tabela GFM, kind=table) | ✅ live | f2d3a73e…9a0eb5e3 |
| A1 | Refresh szkielet→treść | ✅ | root-cause: stale autosave (nie edytor); f7271408 |
| A3 | Streaming sekcji doc (TTFC ~3s) | ✅ live | 744283a5 — za flagą `…DOC_STREAMING` |
| B1 | Wejście z encji (inicjatywa) | ✅ API-proof | 6ddca907 |
| B2 | Grounding sourceRefs przez ContextPack | ✅ | eef8ca1d |
| B3 | Sekcja „Źródła" w artefakcie | ✅ live | c8c57a7e |
| B4 | Auto-skan org (Teresa szuka źródeł) | ✅ | e4c92767 |
| D1 | QA charter (bezpieczeństwo/RBAC/izolacja) | ✅ GO | 2ea4798f |
| D2 | Telemetria + endpoint metryk §8 | ✅ live | 53bbf776 |
| **D3** | **Włączenie flag (decyzja ownera)** | **OCZEKUJE** | zależne od promocji Londyn→prod |
| C1–C2 | Edit-light (per-sekcja akcje, outline gate) | OTWARTE | kolizja z aktywnymi plikami canvas — świadomie wstrzymane |
| C3 | Per-karta regen decka | OTWARTE/re-scoped | `regenerateSlide` to STUB — wymaga chirurgii silnika decka |

## 6. Audyt wdrożeniowy (wcześniejszy, code-verified)
`docs/audit/2026-06-10/DELIVERABLES_MODULE_IMPLEMENTATION_AUDIT.md` — ocena 71/100 „dev-complete",
0×P0. **Wszystkie 4 P1 zamknięte** (walidacja zod, rate-limit, rejestracja sheet, refresh)
i 6 P2 (ewikcja map, abort polla, orphany, conversationId, i18n decyzja, tytuły) — patrz commit `f7271408`.

## 7. Dowody weryfikacji (live, 2026-06-11)

- **QA charter D1** (`docs/qa/runs/2026-06-11/DELIVERABLES_D1_QA_CHARTER.md`): 401/400×3/404/409 ✓;
  **realna izolacja cross-tenant** (draft `dbr77` → 404 dla tokenu `demo-org`) ✓; eksporty md/docx/pdf/xlsx/csv → 200 ✓.
- **Metryki §8 (live):** completion rate 100% (7/7), p50 doc 19s (one-shot) / **3s TTFC ze streamingiem**,
  sheet 4.8s, deck 13.7s; grounding 43% (jedyna metryka pod celem >50% — wzrośnie z adopcją B1).
- **A3 streaming (live, API-mierzone):** sekcje 1→5 w oknie 3→18s, realna proza, zero stubów.

## 8. Postawa bezpieczeństwa
- Auth (`verifyToken`) + org-scope (`requireOrgAccess`) + capability (`presentation_create`) + flaga na całej powierzchni.
- Multi-tenant isolation: każdy odczyt/zapis draftu `AND organization_id = ?` — potwierdzone live na realnym drugim tenancie.
- Walidacja wejścia: zod-whitelist setupu (deck/doc/sheet) — user-JSON nie płynie do silników.
- Uczciwość: bramka anty-placeholder (LLM-fail ⇒ stan `error`, nigdy wydmuszka); telemetria honest-failure coverage = 1.0.

## 9. Znane ograniczenia (uczciwie, do uwagi audytora)
1. **C1–C2 (edit-light) niezrobione** — świadomie wstrzymane: pliki (`UnifiedChatPanel`, `CanvasRichEditor`)
   aktywnie modyfikowane przez równoległą sesję canvas; wejście groziłoby nadpisaniem jej pracy.
2. **C3 per-karta regen** — `presentationGeneratorService.regenerateSlide` to stub (zwraca istniejący
   slajd); realna regeneracja wymaga przeróbki silnika decka + spójności `unified_json`/`deck_json`.
3. **RBAC VIEWER (403) i flag-OFF (404)** zweryfikowane code+unit, nie żywym tokenem viewera —
   konta `register-demo` są ADMIN-em w `demo-org`.
4. **Rate-limit** nie hammerowany live (zaśmieciłby bazę draftami) — middleware code-verified.
5. **Grounding share 43% < cel 50%** — naturalnie wzrośnie gdy użytkownicy zaczną tworzyć z kart encji (B1), nie z pustego promptu.
6. **Współdzielony branch z workstreamem canvas** — dotąd bezkolizyjnie (commity chirurgiczne), ale to
   dyscyplina, nie mechanizm; rekomendacja procesowa: osobne worktree + integracja przez PR.

## 10. Rollout / rollback
- Flagi: `ENABLE_DELIVERABLES_LIGHT` (master), `ENABLE_TERESA_RETRIEVAL` (auto-skan B4),
  `ENABLE_DELIVERABLES_DOC_STREAMING` (A3) — wszystkie default OFF.
- Sekwencja D3: staging ON → prod DBR77/demo → prod klienci.
- **Rollback = flagi OFF.** Bez migracji DB, bez utraty danych (drafty zostają w `work_canvas_drafts`,
  decki w `presentation_decks`). Nowa tabela `deliverables_generation_events` jest addytywna (lazy schema).

---

**Punkt kontaktowy dla audytora:** cała historia decyzji w `project_deliverables_light_l1`
(auto-memory) + commity `feat(deliverables)`/`docs(deliverables)` na branchu. Raport dnia:
`docs/reports/2026-06-10-DELIVERABLES-DAY-REPORT.md`.
