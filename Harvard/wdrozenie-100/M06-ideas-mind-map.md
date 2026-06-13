# WP M06 — Ideas — Mind Map · dokończenie do 100%

**Pula:** ideas · **Karta:** `Harvard/modules/M06-ideas-mind-map/KARTA_AUDYTU.md` (ocena 60/100) · **Rozmiar:** M (1–3 dni) · **Żywy bloker:** P1 WS
**Faza programu:** FAZA 1 (blokery) → FAZA 3 (szlif) → FAZA 4 (sweepy) · **Master:** `Harvard/wdrozenie-100/MASTER.md`

## 1. Stan obecny (jednym akapitem)
Rdzeń realny i solidny: persystencja wersjonowana przez wspólny łańcuch (`useMindMapPersistence.ts:590–754` → `workspaceGraphRuntime.ts` → `useIdeaMapSync.ts:232–314` → `POST /map/sync` `my-work.routes.ts:3874`) z baseVersion/409/empty-reset-guard i org-scope; pełna gramatyka klawiaturowa edycji (`IdeaRecommendationMap.tsx:3086–3411`), undo/redo 50 kroków, drag-to-reparent, 4 layouty, import FreeMind/XMind/OPML, eksport MD/JSON/CSV/SVG/PNG/Mermaid, collab WS (`ideaCollabWs.gateway.ts`, JWT przy upgrade), realny LLM (expand/suggestions/gap), 64 testy FE PASS, i18n OK. Karta zgłasza re-audit (`fd8707c5b2`) twierdzący, że WS org-scope i stringi „rose" naprawione — **prompt programu klasyfikuje WS org-scope jako żywy P1 i korupcję codemodu jako żywą; zweryfikować w kodzie.** Blokuje tier: WS org-scope verify, wspólne migracje snapshots/activity, korupcja „rose", testy BE/WS.

## 2. Luki do DoD

### (a) BEZPIECZEŃSTWO / WS — **P1 bloker (FAZA 1)**
- **[P1] WS collab bez org-scope verify.** `ideaCollabWs.gateway.ts:258–283` — po JWT verify przy upgrade użytkownik dołącza do room kluczowanego tylko `ideaId`, bez `SELECT ... WHERE id=? AND organization_id=?` na `my_ideas`. Exploit: user z Org B znający UUID idei Org A odbiera `graph_patch` z treścią cudzej mapy. **Karta:** re-audit twierdzi naprawione (`fd8707c5b2`, sprawdzanie `ideaId` vs org z JWT @ `:235–252`) — **zweryfikować, czy DB-check faktycznie istnieje przed `room.set(ws,user)`.** Fix (jeśli żywy): DB org-membership check przed join, zamknięcie socketu przy braku. **WSPÓLNE z M07/M09** (ten sam gateway).

### (b) BACKEND / INTEGRACJA — P0/P1 (FAZA 1)
- **[P0] Brak migracji `my_idea_map_snapshots` + `my_idea_activity`.** `GET/POST/DELETE /map/snapshots` (`my-work.routes.ts:4515,4563,4626`) + activity insert (`:4818,4867`) → 503/error na nieprzygotowanej DB; klient połyka cicho. **Karta M05** twierdzi migracja `20260611_my_idea_map_snapshots_and_activity.sql` istnieje — **WSPÓLNA z M05; zweryfikować plik + status staging.** Fix (jeśli brak): `CREATE TABLE IF NOT EXISTS` obu tabel, smoke 200.

### (c) FRONTEND / UI — P1 (FAZA 1/3)
- **[P1] Korupcja codemodu „red"→"rose".** Widoczne dla użytkownika stringi `'Cost roseuction'` (`IdeaRecommendationMap.tsx:1001`), `'Recoverose previous debug session'` (`:1824`) + identyfikatory `roseoStackRef`/`focusFilteroseNodes`/`roseo` (`:2077,2129–2173`); analogicznie `notebook/AIChatInlinePanel.tsx`. **Karta:** re-audit twierdzi naprawione (`fd8707c5b2`) — **zweryfikować `grep -r "roseo\|roseuction\|Recoverose"` = 0.** Fix (jeśli żywy): przywrócić poprawne identyfikatory/stringi.
- **[INTEGRACJA] ExportPowerPoint pobiera HTML, nie .pptx** (`ExportPowerPoint.tsx:91–95`) — etykieta myli. Fix: uczciwa etykieta „HTML Presentation" ALBO realny `pptxgenjs`. (Karta: etykieta naprawiona `fd8707c5b2` — zweryfikować.)
- **[INTEGRACJA] Teresa sidekick event w próżnię** — `idea-mindmap-sidekick-context` wysyłany (`IdeaRecommendationMap.tsx:2534`), `useOpenChatWithContext.ts` go nie konsumuje. Fix: handler przekazujący kontekst węzłów do czatu.
- **[P2] WebhookSettings** w localStorage, fire-and-forget z klienta (`WebhookSettings.tsx:44–67`) — usunąć/przenieść na serwer. (Karta: STUB usunięty `fd8707c5b2` — zweryfikować.)

### (d) FRONTEND / współdzielony bug (FAZA 1/3)
- **[P1] Flush przy zamknięciu karty bez keepalive/sendBeacon** (`useIdeaMapSync.ts:350–354`) — okno utraty danych. WSPÓLNE z M05/M07/M08/M09.
- **[P2] Dwa równoległe drawery** (`mindmap/NodeDetailDrawer.tsx` 1042 l. + `IdeaNodeDetailDrawer.tsx` 1374 l.) ~2400 l. duplikacji — wybrać canonical.
- **[P2] AI overlays fabrykowane klientem** (AISentimentOverlay/AIAutoClustering — przypisanie pozycyjne/substring) — dedykowane endpointy LLM albo oznaczyć jako heurystyki.
- **[P2] Brak align/distribute, snap-to-grid** vs Miro-standard.
- **[P2] React duplicate key w ColorPickerPopover.**

### (e) MARTWY KOD (FAZA 3)
- `mindmap/mindMapTemplates.ts` (0 importerów) → wytnij; `IdeasMindMap.tsx` shim → zostaw (kompatybilność URL).

### (f) TESTY / E2E (FAZA 1 + 4)
- **[P0]** brak BE integration `/map/sync` (409, empty-reset, merge) — `tests/integration/mywork-map-sync.contract.test.ts`.
- **[P1]** brak testu WS gateway (JWT + org-scope guard) + snapshot CRUD (po migracji) + exportFormats.
- E2E `qa-idea-mindmap-checklist.spec.ts` (361 l.) poza tier0 — dodać; CI gate dodać `Londyn` (FAZA 4).

## 3. Kroki realizacji
1. **(FAZA 1, P1 WS)** Zweryfikować/dodać org-scope DB-check w `ideaCollabWs.gateway.ts` przed join; test WS (Org B → 403). **Wspólny fix z M07/M09.**
2. **(FAZA 1, P0)** Zweryfikować/dodać migrację snapshots+activity (WSPÓLNA z M05); smoke 200.
3. **(FAZA 1, P1)** Zweryfikować/naprawić korupcję „rose" (grep=0) + uczciwa etykieta ExportPPT.
4. **(FAZA 1/3)** sendBeacon/keepalive w cleanup flush (wspólny).
5. **(FAZA 3)** Teresa sidekick handler; konsolidacja drawerów; align/distribute+snap; uczciwe AI overlays; usunięcie martwego kodu i WebhookSettings.
6. **(FAZA 4)** BE integration map/sync + WS test + snapshot test; E2E checklist do tier0; CI `Londyn`.

## 4. DoD (6 kryteriów — bramka 6/6)
1. **Front↔back:** snapshots/activity 200; sidekick event dociera do czatu; ExportPPT etykieta=zawartość; zero martwych przepływów.
2. **Bezpieczeństwo:** WS org-scope verify (Org B → 403, test); HTTP org-scope (już OK).
3. **i18n:** `t()` pełne; zero „roseuction"/„Recoverose" w UI.
4. **Tokeny:** Visual Standard; brak korupcji „rose" w identyfikatorach/stringach.
5. **§27:** N.D. (canvas, nie lista) — kanon hubowy `MyWorkHub` zachowany.
6. **E2E w PR-gate:** BE map/sync + WS + checklist zielone na `Londyn`.

## 5. Weryfikacja
- WS: token Org B na `ideaId` Org A → upgrade odrzucony 403 (test jednostkowy gateway).
- Snapshot: `POST /map/snapshots` → 200/201 po migracji; activity insert bez błędu.
- „rose": `grep -rE "roseoStack|roseuction|Recoverose|focusFiltrose"` = 0 + screenshot UI bez „Cost roseuction".
- Persist: węzły Cmd+S → reload → trwałe; konflikt 2 okna → toast 409 + rehydracja.
- Uwaga DB: prod = commit ~2026-05-18 — migracje 620+ mogą nie być na prod; dev `.env` → Railway zdalna.

## 6. Zależności
- **WS org-scope WSPÓLNY z M07 i M09** (`ideaCollabWs.gateway.ts`) — naprawić raz, zamyka 3 moduły.
- **Migracja snapshots/activity WSPÓLNA z M05** — jedna migracja zamyka oba.
- Korupcja „rose" dotyka też `notebook/AIChatInlinePanel.tsx` (M04) — sweep szerszy.
- `useIdeaMapSync` flush/cleanup współdzielony z całą pulą Ideas.
