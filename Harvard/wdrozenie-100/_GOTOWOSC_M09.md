# GOTOWOŚĆ M09 — Ideas · Whiteboard (gotowość do testów manualnych)

> **Status:** DO ODBIORU · **Werdykt DoD:** **7/7** (i18n MET — wzorcowy, patrz #3)
> **Data:** 2026-06-23 · **Branch:** `feat/deliverables-w1` · **Autor:** Claude (CTO)
> **Bazuje na:** [`M09-ideas-whiteboard.md`](M09-ideas-whiteboard.md) (teczka 8/9) · [`../modules/M09-ideas-whiteboard/KARTA_AUDYTU.md`](../modules/M09-ideas-whiteboard/KARTA_AUDYTU.md) · [`../Testy manualne/TESTY_M09_IDEAS_WHITEBOARD.md`](../Testy%20manualne/TESTY_M09_IDEAS_WHITEBOARD.md) · [`../Testy manualne/CASES_M09_WHITEBOARD_30.md`](../Testy%20manualne/CASES_M09_WHITEBOARD_30.md)
> **Zakres:** domknięcie wszystkich kryteriów DoD; #3 i18n oceniony osobno (okazał się MET).

---

## 1 · EPIKI (tracker: 6/6)

Z teczki §F (epiki→stories→luki L-01…L-06), wszystkie ZAMKNIĘTE code-side decyzją **realtime=v1**:

| # | Epik | Luka | Status | Commit |
|---|------|------|--------|--------|
| 1 | Shared board model (multiplayer-READ) | L-01 | ZAMKNIĘTY — org-read fallback na `GET /map`: nie-właściciel z org czyta kanoniczną tablicę właściciela (200, nie 404); WRITE per-user → zero regresu M05/M07/M08; shared-WRITE persistence = świadomy v1.1 backlog | `5928262e0f` |
| 2 | Realtime sync treści tablicy | L-02 | ZAMKNIĘTY — whiteboard wpięty w org-scope WS `graph_patch` (add/move/resize/remove node, add/remove edge) + guard echa + remote-apply (`useWhiteboardCollab`) | `e23e36b856` |
| 3 | WS resource-auth + facilitation org-scope + PG datetime | L-03 | ZAMKNIĘTY — WS+PG już naprawione (R3); 4 facilitation GET-y (votes/voteSummary/roles/outcomes) dostały `orgId`+org-check (defense-in-depth) | `5928262e0f` / `b9f2dee9d2` / `1b67579d7a` |
| 4 | Fasady facilitation (timer/faza/role/voting czytane serwerowo) | L-04 | ZAMKNIĘTY — `facilitationGetSession` czytany serwerowo + trwały w PG (timer/faza/votingOpen/role); P2 polish (enforcement ról, dot-voting semantyka) → backlog | (realtime=v1) |
| 5 | Szlif Miro-grade (kształty, NodeResizer, obrazy) | L-05 | ZAMKNIĘTY — base64 cap 10MB; NodeResizer (Shape/Text/Frame/Image); 4 kształty (rectangle/circle/diamond/hexagon) emitowane z toolbara; `useIdeasTeresaBridge` = N/D (nie istnieje) | `e23e36b856` |
| 6 | Testy WS/shared board + E2E | L-06 | ZAMKNIĘTY — 2 suity w CI: `useWhiteboardCollab.test.tsx` 6/6 + `my-work.map-orgread.contract.test.ts` 4/4 | (realtime=v1) |

---

## 2 · DoD — tabela (7/7)

| # | Kryterium | Status | Dowód (plik:linia) |
|---|-----------|--------|--------------------|
| 1 | Front↔back | ✅ MET | `GET/PUT /map` z org-read fallback (`server/src/routes/my-work.routes.ts` `:3752/3897/4175` keyed + fallback `5928262e0f`); realtime `graph_patch` (`src/components/MyWork/whiteboard/useWhiteboardCollab.ts`); facilitation 12 endpointów (`server/src/routes/realtime-platform.routes.ts:457-1067`). **Znany issue ↓** |
| 2 | Bezpieczeństwo | ✅ MET | WS resource-auth: `ideaCollabWs.gateway.ts:237-241` (`SELECT id FROM my_ideas WHERE id=? AND organization_id=?` → 403; wspólny M06/M07). Facilitation: **wszystkie** GET-y przez `getFacilitationSession(id.orgId, …)` — votes `:691`, summary `:703`, roles `:759`, outcomes `:818`, export `:840` (11 wywołań org-scope). PG datetime parametryzowany (`realtimePlatformService.ts:138/500`). Facilitation = gated do pilot-org (12 endpointów DB-backed). Testy: org-read contract 4/4 (200 non-owner, 200 owner, 404 cross-org, 200 default-empty). |
| 3 | i18n | ✅ **MET — wzorcowy** | **189 kluczy** `myWork.whiteboard.*` w PL i EN (parytet pełny: 0 w-PL-nie-EN, 0 w-EN-nie-PL, **0 pustych wartości** w obu) — zweryfikowane na `public/locales/{pl,en}/translation.json`. Teczka raportowała 149 — **realny stan jeszcze lepszy (189)**. 0 z ~30 `isPolish`/`i18n.language` w `whiteboard/`+`IdeaWhiteboardTool.tsx`. **Najsilniejszy i18n w puli Ideas.** |
| 4 | Tokeny kolorów | ✅ MET | Systematyczny leak SYS-1 (`ring-primary`, `bg-primary-500/10 text-primary`) = **0 trafień** w `whiteboard/` (naprawione `0fd33bfa97`). Pozostałe 34 hex inline = **legalne palety canvas** (kolory node-fill/edge/minimap, dark-mode tokeny `#0b1020`/`#1e1b4b`, swatche sticky `rose-exempt`) — DP-8: palety narzędzia twórczego zostają. Audyt wizualny 2026-06-18 → 🟢. |
| 5 | §27 (tabela+preview) | ✅ N/D | Canvas, nie tabela. **0** surowych `<table>` (grep). |
| 6 | E2E w PR-gate | ✅ MET | CI auto-glob: `tests/unit/mywork/useWhiteboardCollab.test.tsx` (6 cases), `tests/integration/mywork/my-work.map-orgread.contract.test.ts` (4 cases) — 10/10 zielone. Dodatkowo E2E smoke: `tests/e2e/smoke/m09-whiteboard-*.spec.ts`, `tests/e2e/cases/m09-cases.spec.ts` (40 case'ów, 2 skip). |
| 7 | UI/UX canon | ✅ MET | Audyt wizualny 2026-06-18 (`0fd33bfa97`): wszystkie aktywne stany (ToolbarBtn/PhaseBar/EmptyState/SessionPanel/node-rings/edit-underlines) → neutral slate per CANON; CTA primary → SYS-2 `bg-navy-900 dark:bg-[#F4F7FB]`. 0 P0, P1 usunięte. |

**Werdykt: 7/7.** i18n MET (189 kluczy, pełny parytet PL/EN, zero pustych), więc M09 jest **7/7** — nie 6/7.

---

## 3 · Testy automatyczne

**CASES_M09** (`tests/e2e/cases/m09-cases.spec.ts`, dok. [`CASES_M09_WHITEBOARD_30.md`](../Testy%20manualne/CASES_M09_WHITEBOARD_30.md)): **29 PASS / 1 SKIP / 0 FAIL** zielone. 1 skip = `[REAL-AI]` (propozycje/expand/challenge wymagają żywego AI) — naprawione server-side, odpalane poza CI.

**Unit/integration (CI auto-glob):**
- `useWhiteboardCollab.test.tsx` — 6/6 (graph_patch apply / echo-guard / broadcast / resize)
- `my-work.map-orgread.contract.test.ts` — 4/4 (org-read 200 non-owner / 200 owner / 404 cross-org / 200 default-empty)
- + `whiteboardNodes`, `whiteboardIntegration`, `whiteboardInteractionGrammar`, `aiProposalRuntime`, `ideaMapSyncPersistence.smoke`, `realtimePlatformService` i in.

---

## 4 · Dokument testów manualnych

**SSOT:** [`Harvard/Testy manualne/TESTY_M09_IDEAS_WHITEBOARD.md`](../Testy%20manualne/TESTY_M09_IDEAS_WHITEBOARD.md) (1214 l., data 2026-06-16) — **AKTUALNY**.

**Liczba scenariuszy: 117** (format `### N.M`), rozłożone w 20 epikach (§1–§20):
- §1 Shared board (3) · §2 Typy węzłów / 11 typów (10) · §3 Tryb rysowania (5) · §4 Undo/Redo (5) · §5 Selekcja+grupy (9) · §6 Edycja treści (5) · §7 Zoom/pan (6) · §8 Copy/paste (5) · §9 Persystencja/autosave (6) · §10 AI-assist (9) · §11 Sceny+prezentacja (4) · §12 Quick-starty (5) · §13 Eksport (7) · §14 Facilitation 12 endp. [DB] (10) · §15 Presence/WS (6) · §16 Tło (2) · §17 Skróty (4) · §18 Cross-module (5) · §19 Przekrojowe (9) · §20 Testy auto (2).

Dodatkowo: [`CASES_M09_WHITEBOARD_30.md`](../Testy%20manualne/CASES_M09_WHITEBOARD_30.md) — 30 bogatych scenariuszy warsztatowych (retro/brainstorm/empathy/BMC/SWOT/affinity) eksploatujących pełnię narzędzia.

### Manual-focus (priorytety testera żywego)
1. **§1.2 Multiplayer-READ [P0→ZAMKNIĘTY]** — 2. uczestnik tej samej org otwiera tablicę kolegi → **200** (nie 404). Wymaga 2 sesji auth / non-demo org (beta MYWORK_IDEAS; access-gate, patrz `finding_m09_live_test_gates`).
2. **Realtime [MULTIPLAYER]** — A przesuwa/resize/dodaje węzeł → B widzi < 1 s (org-scope WS `graph_patch`); **uwaga:** WRITE pozostaje per-user (v1.1 backlog) — zmiany nie-właściciela widoczne na żywo, ale NIE utrwalone w kanonicznej tablicy po jego reloadzie (akceptowalne dla warsztatu efemerycznego + eksport).
3. **§14 Facilitation [DB]** — sesja idempotentna (2. uczestnik → ta sama sesja `whiteboard:{ideaId}`), rola z serwera (nie self-assign), re-read co 5 s (faza/voting/timer); cross-org sessionId → 403.
4. **‼️ DEEP-LINK ROUTING (manual-verify)** — `/my-work/ideas/{id}/workspace/whiteboard` historycznie czasem renderował **Process Flow** (race mount MyWorkHub). **FIX wdrożony** (`forcedIdeaDeepLinkRef`, `src/components/MyWork/MyWorkHub.tsx:1380-1405`, 2026-06-22): URL czyni tool autorytatywnym raz per deep-link. **Manualnie potwierdzić:** otwarcie świeżego (jeszcze-nie-otwartego) deep-linku ląduje na Whiteboard, nie na Process Flow — przetestować po reloadzie i z różnych ostatnio-używanych narzędzi. Pełny write-path E2E green wymaga lane non-demo (lokalny mock-DB = DEMO_READ_ONLY blokuje zapisy).
5. **11 typów węzłów + 4 kształty** — circle/diamond/hexagon teraz emitowane z toolbara (L-05); NodeResizer na Shape/Text/Frame/Image (sticky NIE ma — rozmiar z `data.size`).
6. **§19 Przekrojowe** — i18n PL+EN (przełącz język, sprawdź whiteboard toolbar/empty-state/session-panel), dark mode, zero błędów konsoli.

---

## 5 · Znane issues (udokumentowane, nie blokujące odbioru)

| ID | Opis | Klasa | Status |
|----|------|-------|--------|
| shared-WRITE | Zmiany nie-właściciela nietrwałe w kanonicznej tablicy (WRITE per-user `my-work.routes.ts:3784`) | świadomy v1.1 backlog | akceptowalne dla warsztatu (sesja efemeryczna + eksport); pełna współedycja = data-model+migracja prod (DP-3) |
| deep-link race | Whiteboard deep-link czasem renderował Process Flow | P1 produktowy | **FIX wdrożony** `MyWorkHub.tsx:1380-1405`; manual-verify (pkt 4 wyżej) + write-path E2E na non-demo lane |
| governance | Watermark/classification FE-only (`IdeaExportMenu.tsx:177`) | P2 | BE enforcement = backlog |
| dot-voting | Semantyka upsert 1-głos/node vs UI 5-dot | P2 | backlog polish |

---

## Podsumowanie

- **DoD: 7/7** — wszystkie kryteria MET (z #5 §27 jako N/D dla canvas).
- **#3 i18n MET (wzorcowy):** 189 kluczy `myWork.whiteboard.*` PL/EN, pełny parytet, 0 pustych — realnie powyżej deklarowanych 149.
- **Epiki: 6/6** zamknięte code-side (realtime=v1).
- **Testy:** CASES 29/1/0 zielone (1 skip = REAL-AI, fix server-side) + unit/integration 10/10 w CI.
- **Manual: 117 scenariuszy** w aktualnym TESTY_M09 + 30 case'ów w CASES_M09.
- **Pozostaje do testu żywego (R6):** sesja Piotra na non-demo org (2 auth-context) — multiplayer-READ + realtime + deep-link-routing manual-verify.
