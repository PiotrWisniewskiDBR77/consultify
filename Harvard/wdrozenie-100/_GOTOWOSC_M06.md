# GOTOWOŚĆ M06 — Ideas · Mind Map (do testów manualnych)

> **Status:** BLISKO ODBIORU — DoD domknięte 6/7 (#3 i18n ODROCZONE decyzją puli Ideas → Faza 4).
> **Data:** 2026-06-23 · **Branch:** `feat/deliverables-w1`
> **Teczka SSOT:** [`M06-ideas-mind-map.md`](M06-ideas-mind-map.md) · **Karta:** `Harvard/modules/M06-ideas-mind-map/KARTA_AUDYTU.md`
> **Kod:** `src/components/MyWork/IdeaRecommendationMap.tsx` (~6.4k l.) · `src/components/MyWork/mindmap/` (~50 plików) · `server/src/gateways/ideaCollabWs.gateway.ts` · `server/src/routes/my-work.routes.ts`

---

## 1 · EPIKI (7/7 — zmapowane do zamkniętych luk L-01…L-07)

| EPIK | Tytuł | Luka | Status |
|------|-------|------|--------|
| 1 | WS org-scope szczelny (P1, bezpieczeństwo) | L-01 | ✅ ZAMKNIĘTA — org-scope DB-check realny `ideaCollabWs.gateway.ts:236-244` + test 6/6 |
| 2 | Persystencja snapshots/activity (P0, wspólna M05) | L-02 | ✅ ZAMKNIĘTA na STAGING (`to_regclass` → tabele istnieją); PROD = verify-at-deploy |
| 3 | Korupcja „rose" zamknięta (P1) | L-03 | ✅ ZAMKNIĘTA — grep `roseo\|roseuction\|Recoverose\|focusFiltrose` = **0** |
| 4 | Uczciwe afordancje (INTEGR/P2) | L-04 | ✅ ZAMKNIĘTA — martwe webhooki usunięte; sidekick/etykieta PPT/overlays = false-positive (uczciwe) |
| 5 | Flush keepalive/sendBeacon (P1, wspólny pula) | L-05 | ✅ ZAMKNIĘTA `8c3285480d` — `keepalive` w `Api.syncMyIdeaMap` + teardown handlery |
| 6 | Szlif (drawer D-01, align/snap, dup-key) | L-06 | ⚠ CZĘŚCIOWO — dup-key NAPRAWIONY (dedup `new Set`); D-01 + align/snap = ODROCZONY enhancement (nie correctness-bug) |
| 7 | Testy (BE map/sync + WS + snapshot + E2E + CI) | L-07 | ✅ ZAMKNIĘTA — WS 6/6 + map-sync contract + smoke; CI `Londyn` skonfigurowane |

EPIK 6 = jedyny niepełny, ale jego reszta to świadomie odroczony enhancement (konsolidacja ~2400 l. drawerów spanning M05+M06 + funkcje Miro-standard align/distribute/snap), nie blokuje odbioru.

---

## 2 · DoD (6/7 domknięte; #3 ODROCZONE)

| # | Kryterium | Status | Dowód `plik:linia` |
|---|-----------|--------|--------------------|
| 1 | Front↔back | ✅ | snapshots/activity 200 (tabele istnieją staging); sidekick KONSUMOWANY `AIActionsPopover.tsx:91` + `FloatingAIPopover.tsx:54`; ExportPPT etykieta uczciwa „Pobierz HTML (do PDF/PPTX)" `ExportPowerPoint.tsx:161`; martwe CTA webhook USUNIĘTE; 0 martwych przepływów |
| 2 | Bezpieczeństwo (regresja) | ✅ | WS org-scope DB-check `ideaCollabWs.gateway.ts:236-244` (403 + `socket.destroy()` **przed** `room.set`); HTTP org+user-scope na `/map/sync`. **Test regresji ISTNIEJE** `tests/integration/gateways/ideaCollabWs.orgscope.test.ts` (6 case'ów: 401 brak/malformed/wrong-secret token, **403 cross-org IDOR**, same-org pass, non-collab path ignored) |
| 3 | i18n | ⏸ **ODROCZONE** — Faza 4 (decyzja puli Ideas) | ~881 `isPolish`/`isPl` w 64 plikach: funkcjonalnie dwujęzyczne, ale nie przez `t()`. Świadomy dług, poza zakresem tego odbioru. |
| 4 | Tokeny koloru | ✅ | korupcja „rose" = **0** (EPIK3); ColorPicker dedup hex (`new Set` `floating-toolbar/ColorPickerPopover.tsx:20,32`, test `colorPickerPaletteUnique.test.ts`). Pozostałe ~274 inline hex = osobny dług Visual Standard, odroczony decyzją puli (nie regresja). |
| 5 | §27 (audyt tabeli) | **N/D** | Canvas mind-map, nie lista/tabela → §27 nie ma zastosowania. (1 surowy `<table>` w obrębie modułu — kosmetyczny, do sprawdzenia w szlifie, nie blokuje.) |
| 6 | E2E w PR-gate | ✅ | Testy M06 pod `tests/` (CI je odpala): WS `tests/integration/gateways/ideaCollabWs.orgscope.test.ts`, map-sync `tests/integration/mywork/my-work.map-sync.contract.test.ts`, hook smoke `tests/hooks/useIdeaMapSync.deferred-payload.test.ts` + `tests/components/MyWork/ideaMapSyncPersistence.smoke.test.ts`, unit `tests/unit/mindmap/`. CI `test-suite.yml` triggeruje na `Londyn`. |
| 7 | UI/UX canon | ✅ | Canonical drawer mindmap `mindmap/NodeDetailDrawer.tsx`; floating toolbar + command palette wg wzorca; dup-key warning usunięty. Wizualny odbiór (light/dark) = w manualu §25. |

---

## 3 · DOKUMENT TESTÓW MANUALNYCH

- **SSOT manual:** [`Harvard/Testy manualne/TESTY_M06_IDEAS_MIND_MAP.md`](../Testy%20manualne/TESTY_M06_IDEAS_MIND_MAP.md) — AKTUALNY (data 2026-06-16, mapa komponent↔plik↔stan zgodna z kodem), **~121 scenariuszy** (sekcje §1–§27).
- **Paczka case'ów:** `Harvard/Testy manualne/CASES_M06_MIND_MAP_30.md` — 30 bogatych przepływów konsultanta.
- **Automatyzacja (CASES_M06_MIND_MAP_30):** **23 PASS / 7 SKIP / 0 FAIL** zielone. SKIP = honest-skip dla `[MANUAL]`/`[REAL-AI]`/`[MULTIPLAYER]`/focus-headless (np. Cmd+K wired `IRM:3779`, undo `IRM:3124` — działają w kodzie, nie odpalają się pod headless keyboard-focus → NIE defekt).

### Fokus testów manualnych (czego automaty NIE pokryły — wymaga człowieka)

1. **Gramatyka klawiaturowa pod realnym focusem** — Tab=child, Enter=sibling, Del, F2=rename, strzałki, Cmd+K paleta, undo/redo 50 (headless gubi focus → tylko manual potwierdzi).
2. **[MULTIPLAYER] collab WS** — 2 okna/sesje: presence (awatary, live cursor), broadcast `graph_patch` realtime; **negatywny: użytkownik Org B → 403 przy join** (regresja jest w teście, ale żywy odbiór warto potwierdzić w przeglądarce).
3. **[REAL-AI]** — expand / ai-suggestions / gap-analysis: realność i zmienność odpowiedzi LLM (nie tylko 200).
4. **AI overlays** sentiment/clustering/priority — uczciwa etykieta, brak crash (D-02 = ukryte za flagą + „wkrótce").
5. **Import** FreeMind/XMind/OPML + scalenie z istniejącą mapą; **Eksport** MD/JSON/CSV/SVG/PNG/Mermaid + artefakt pobrany.
6. **Konflikt 409 + rehydracja** — równoległa edycja, baseVersion, brak silent-overwrite; **stan przeżywa reload**.
7. **Wizualny odbiór** light + dark, EN locale, 4 layouty (radial/tree-H/tree-V/free), zero console errors (§25).

---

## 4 · TESTY DODANE W TEJ SESJI

**Brak nowych testów — DoD #2 był już pokryty.** Teczka G·DoD zalecała „dodać test" do WS org-scope, ale regresja **już istnieje i jest kompletna**: `tests/integration/gateways/ideaCollabWs.orgscope.test.ts` (zamknięta jako L-01/L-07 w Harvard 2, 2026-06-17). Pokrywa dokładnie wymagany wzorzec **Org B → 403** (case „returns 403 when idea belongs to a different org (cross-org IDOR attempt)", `:136-146`) plus 401-warianty, same-org pass i ignorowanie ścieżek non-collab. Test jest pod `tests/` → odpala się w CI PR-gate.

Wzorzec (do reużycia dla innych gatewayów): real `http.Server` + raw TCP upgrade → odczyt linii statusu HTTP/1.1 zwróconej PRZED handshake WS; `getDatabase()` zamockowany (`mockDbGet`) by sterować wynikiem org-check bez żywej DB.

---

## 5 · POZOSTAJE (poza zakresem odbioru technicznego)

- **#3 i18n** — Faza 4 (decyzja puli Ideas), ~881 `isPolish`.
- **Inline hex ~274** — osobny dług Visual Standard (nie regresja).
- **EPIK 6 enhancement** — konsolidacja drawerów D-01 (ryzykowny refaktor M05+M06) + align/distribute/snap (Miro-standard).
- **PROD verify** migracji `20260611` snapshots/activity — przy deploy `Londyn→prod` (zgoda Piotra).
- **Bramki Piotra:** deploy demo, →F (odbiór funkcjonalny), →UI (audytor wizualny).
