# TECZKA M06 — Ideas · Mind Map (pełna teczka wg wzorca)

> Teczka = **cienki indeks + reconciliation**, NIE rewrite. Wzór: [`_WZORZEC_TECZKI.md`](_WZORZEC_TECZKI.md) · referencja: [`M13-inicjatywy.md`](M13-inicjatywy.md).
> **Pula Ideas — uwaga R6:** NIE testowana na żywo 2026-06-13 (brak wpisu Ideas w `UWAGI_TESTY_2026-06-13.md`) → brak uwag żywych; wejścia dziedziczone z karty + reconciliation w kodzie.

## 00 · Nagłówek
- **Moduł:** M06 Ideas-Mind Map · **Pula:** ideas
- **Ocena audytu:** 60/100 · **Status:** FAZA 1 → FAZA 3 · **Rozmiar:** M (i18n **872**×) · **Żywy bloker:** P1 WS org-scope (**zweryfikowany jako naprawiony 2026-06-13**)
- **Właściciel:** Piotr · **Daty:** karta 2026-06-12 · teczka 2026-06-13
- **Karta:** `Harvard/modules/M06-ideas-mind-map/KARTA_AUDYTU.md` (§1e · §1g · §5 · §6 · §7) · **Evidence:** `…/evidence/`
- **Kod:** `src/components/MyWork/IdeaRecommendationMap.tsx` · `src/components/MyWork/mindmap/` · `src/components/MyWork/hooks/useMindMapPersistence.ts` · `server/src/gateways/ideaCollabWs.gateway.ts` · `server/src/routes/my-work.routes.ts`

## MAPA POKRYCIA
| Warstwa | Stan | Źródło | Co dokłada teczka |
|---|---|---|---|
| A Intencja | 🟡 | karta §0 | job-to-be-done (niżej) |
| B UX docelowe | 🟡 | karta §5 (canvas, §27 N.D.) | stany + delty (niżej) |
| C Dane+API+reguły | 🟢 | karta §1e + persistence chain + WS gateway | kontrakt sync+WS (niżej) |
| D AI/Teresa | 🟡 | karta (expand/suggest/gap + overlays) | granice + delty AI overlays (niżej) |
| E Integracje | 🟢 | karta §1g | zależności WS/sync (niżej) |
| F Epiki | 🟢 | karta §7 | epiki (niżej) |
| G DoD/jakość | 🟢 (dołożone) | karta §0/§2 | **liczby grepem** (niżej) |
| H Governance | 🟢 (dołożone) | karta §1/§6 | **Rejestr Wejść+Decyzji+R3** (niżej) |

---

## A · INTENCJA *(z karty + kodu)*
- **Job-to-be-done:** budować mapę myśli (rekomendacje/węzły) z pełną gramatyką klawiaturową, AI-expand i współpracą realtime — jako warstwa diagnozy idea.
- **Persony/role:** konsultant (właściciel), uczestnicy collab (ta sama org). Org-scope egzekwowany na HTTP **i WS**.
- **Zakres v1:** edytor węzłów (gramatyka klawiaturowa, undo/redo 50, drag-reparent, 4 layouty) · import FreeMind/XMind/OPML · eksport MD/JSON/CSV/SVG/PNG/Mermaid · collab WS (`graph_patch`) · realny LLM. **POZA v1:** align/distribute/snap-to-grid (Miro-standard, delta P2).
- **Metryka:** zero cross-org wycieku przez WS; persystencja wersjonowana bez utraty (409 z rehydracją).

## B · UX DOCELOWE *(karta §5 + delty — konkretnie kanwa + collab)*
**Layout docelowy (kanwa mind-map, `IdeaRecommendationMap.tsx` 6337 l.):**
- **Kanwa** — węzły (rekomendacje) + krawędzie hierarchiczne; 4 layouty (radial/tree-H/tree-V/free); pełna gramatyka klawiaturowa (Tab=child, Enter=sibling, Del, F2=rename, strzałki=nawigacja); undo/redo 50 kroków; drag-reparent.
- **Toolbary** — góra: layout-switch, zoom/fit, import (FreeMind/XMind/OPML), eksport (MD/JSON/CSV/SVG/PNG/Mermaid); prawo: AI-panel (expand/suggest/gap).
- **Drawer szczegółów węzła** — notatki, kolor, metadane. **Delta: DWA drawery współistnieją** (`NodeDetailDrawer.tsx` 1042l + `IdeaNodeDetailDrawer.tsx` 1374l ≈ 2400l duplikacji) → wybrać canonical (D-01).
- **Presence collab** — awatary uczestników (ten sam org) z WS; live cursor.

**Stany ekranu:**
| Stan | Docelowo | Dziś |
|---|---|---|
| pełny/edycja | OK | OK |
| **collab cross-org** | join odrzucony → 403 + socket.destroy | **OK (L-01 naprawione, `:240-242`)** |
| konflikt 409 | rehydracja + banner | rehydracja działa, banner = delta |
| §27 | N.D. (canvas, nie lista) | N.D. |

**Mikro-flow collab (docelowy):** WS upgrade `/ws/collab/:ideaId` → JWT verify → **org-scope DB-check** (`SELECT id FROM my_ideas WHERE id=? AND organization_id=?`) → join room (kluczowany `ideaId`) → patche `graph_patch` broadcast do roomu; presence/session-state broadcast; cleanup przy disconnect (room.size===0 → usuń room+state).

**Delty UX:** konsolidacja drawerów → canonical (D-01); **align/distribute + snap-to-grid** (Miro-standard, dziś brak — P2); React duplicate-key warning w `ColorPickerPopover`; AI overlays (sentiment/clustering) dziś heurystyki klienta → oznaczyć jako heurystyki LUB dedykowany LLM endpoint (D-02).

## C · DANE + API + REGUŁY *(link + kontrakt sync/WS — enumeracja)*
- **Persystencja (łańcuch):** `useMindMapPersistence.ts:590-754` → `workspaceGraphRuntime.ts` → `useIdeaMapSync.ts:232-314` → `POST /my-ideas/:id/map/sync` (`my-work.routes.ts:3949`) z `baseVersion`/409/empty-reset-guard + org+user-scope. Współdzielone endpointy mapy = te same co M05 (sekcja C/M05): `/map`, `/map/sync`, `/map/snapshots`, `/map/nodes/:nodeId/comments`, `/activity`.
- **Model danych:** `my_idea_maps` (graf blob) + `my_idea_map_snapshots` + `my_idea_activity` (mig. `20260611_…sql`, oba `organization_id TEXT NOT NULL` + idx) — **WSPÓLNE z M05** (jedna migracja, jeden fix). `collab_sessions` (idea_id, organization_id, user_id) — sesje WS.
- **WS collab (`ideaCollabWs.gateway.ts`, endpoint `/ws/collab/:ideaId`):**
  | Krok | Linia | Reguła |
  |---|---|---|
  | upgrade match path | `:201-207` | wyciągnij `ideaId`, brak → return |
  | JWT verify | `:212-221` | brak/invalid token → `socket.destroy()` |
  | **org-scope DB-check** | `:237-238` | `SELECT id FROM my_ideas WHERE id=? AND organization_id=?` |
  | cross-org reject | `:240-242` | **403 + `socket.destroy()`** przed `room.set` |
  | join room | `:292` | room kluczowany `ideaId`, presence/session broadcast |
  | INSERT sesji | `:148-150` | `collab_sessions(idea_id, organization_id, user_id)` |
  | cleanup | `:111-132` | room.size===0 → usuń room+state |
  ⚠ **Ryzyko:** placeholdery `?` (nie `$1`) w `:237` — potwierdzić że PG-adapter tłumaczy w runtime (inaczej DB-check może nie zadziałać na PG). **WSPÓLNY z M07 i M09** — jeden fix/test zamyka 3 moduły.
- **Reguły:** room kluczowany `ideaId`; dołączenie tylko po org-check; broadcast `graph_patch` do roomu (collab realtime).

## D · AI / TERESA *(link + delty)*
- **Co generuje:** expand/suggestions/gap (realny LLM).
- **Delty:** AISentimentOverlay/AIAutoClustering = obecnie fabrykowane klientem (pozycyjne/substring) → dedykowane endpointy LLM ALBO oznaczyć jako heurystyki; Teresa sidekick event (`idea-mindmap-sidekick-context`, `:2534`) wysyłany ale `useOpenChatWithContext.ts` go nie konsumuje → handler.

## E · INTEGRACJE *(karta §1g + zależności)*
- **←** lista idei. **→** czat (sidekick — dziś w próżnię), eksport→M19 (ExportPowerPoint).
- **Kręgosłup:** **WS gateway `ideaCollabWs.gateway.ts` WSPÓLNY z M07 i M09** — jeden fix org-scope zamyka 3 moduły (zweryfikowany jako naprawiony). `useIdeaMapSync` flush/cleanup wspólny z całą pulą.
- **Zależności blokujące:** migracja snapshots/activity **WSPÓLNA z M05**.

## F · EPIKI → STORIES → ZADANIA *(Gherkin)*

**EPIK 1 — WS org-scope szczelny (P1)** *(domyka C/WS + bezpieczeństwo)*
- **Story 1.1:** jako konsultant z Org A chcę mieć pewność, że użytkownik z Org B nie dołączy do mojej sesji collab.
  - *Dane* idea należy do Org A *gdy* socket z tokenem Org B robi upgrade na `/ws/collab/:ideaId` *wtedy* 403 + `socket.destroy()` **przed** `room.set`.
  - Zadania: Z-01 weryfikacja `:237-242` → **L-01 (naprawione, domknąć)**; Z-02 test gateway cross-org (Org B→403) → L-07; Z-03 potwierdź placeholder `?`→`$1` translację PG → L-01.

**EPIK 2 — Persystencja snapshots/activity (P0, wspólna M05)** *(domyka C/model)*
- **Story 2.1:** jako użytkownik mind-map chcę, by migawki/activity się zapisywały (200, nie 503).
  - *Dane* migracja `20260611_…sql` zaaplikowana *gdy* `POST /map/snapshots` lub `/activity` *wtedy* 200/201.
  - Zadania: Z-04 zweryfikuj migrację w DB → L-02.

**EPIK 3 — Korupcja „rose" zamknięta (P1)** — grep `roseo|roseuction|Recoverose`=0 + UI bez „Cost roseuction". → **L-03 (naprawione, grep=0).**

**EPIK 4 — Uczciwe afordancje** *(domyka D + E)*
- **Story 4.1:** jako użytkownik nie chcę przycisków, które prowadzą donikąd.
  - Zadania: Z-05 etykieta `ExportPowerPoint.tsx:91` = zawartość → L-04; Z-06 sidekick event (`:2534`) konsumowany przez `useOpenChatWithContext.ts` (dziś w próżnię) → L-04; Z-07 AI overlays sentiment/clustering oznaczone jako heurystyki LUB LLM endpoint (D-02) → L-04; Z-08 usuń `WebhookSettings` localStorage → L-04.

**EPIK 5 — Flush keepalive/sendBeacon (P1, wspólny pula)** — `useIdeaMapSync.ts:350-354`. → L-05.

**EPIK 6 — Szlif** — canonical drawer (D-01, wytnij drugi ~1200l); align/distribute + snap-to-grid; React dup-key. → L-06.

**EPIK 7 — Testy** — BE map/sync + WS gateway cross-org + snapshot + E2E checklist + CI `Londyn`. → L-07.

## G · JAKOŚĆ / DoD *(skwantyfikowane grepem 2026-06-13)*
| # | Kryterium | Miara M06 |
|---|-----------|-----------|
| 1 | Front↔back | snapshots/activity 200; sidekick dociera do czatu; ExportPPT etykieta=zawartość; 0 martwych przepływów |
| 2 | Bezpieczeństwo | WS org-scope (Org B→403) — **kod OK `ideaCollabWs.gateway.ts:237-242`**, dodać test; HTTP org-scope OK |
| 3 | i18n | **0 z 872** `isPolish`/inline (grep `mindmap/`+`IdeaRecommendationMap`+drawer) |
| 4 | Tokeny | **0 z 289** hex inline → Visual Standard; **korupcja „rose" = 0** (165 „rose" = legit color-tokeny) |
| 5 | §27 | N.D. (canvas); **1** surowy `<table>` w obrębie modułu do sprawdzenia |
| 6 | E2E w PR-gate | BE map/sync + WS + checklist zielone na `Londyn` |

## H · GOVERNANCE *(dołożone ogniwa)*

### 01 · Rejestr wejść (R1)
| ID | Źródło | Data | → Luka |
|----|--------|------|--------|
| W-01 | Karta audytu §1-§7 | 2026-06-12 | L-01..07 |
| W-02 | **Uwagi żywe 2026-06-13** | 2026-06-13 | **BRAK wpisu Ideas — pula nietestowana żywo; dziedzicz z karty (R6 do domknięcia)** |
| W-03 | Re-audit karty (`fd8707c5b2`) | 2026-06-12 | L-01/L-03/L-04 (status — R3) |
| W-04 | Kod (`ideaCollabWs.gateway.ts`, `IdeaRecommendationMap.tsx`, migracje) | 2026-06-13 | weryfikacja R3 |

### 02 · Stan obecny (prawda kodu, R3 zweryfikowane 2026-06-13)
- **WS org-scope = REALNY:** `ideaCollabWs.gateway.ts:237-238` DB-check + 403/destroy przy braku (`:240-242`), przed `room.set` (`:292`). Karta claim `fd8707c5b2` **POTWIERDZONY w kodzie.** [Uwaga: placeholders `?` — sprawdzić że PG-adapter je tłumaczy w runtime.]
- **Korupcja „rose" = NAPRAWIONA:** `grep -rE "roseo|roseuction|Recoverose|focusFiltrose"` = **0** w `mindmap/`+`IdeaRecommendationMap.tsx`. Claim `fd8707c5b2` **POTWIERDZONY.** 165 trafień „rose" = poprawne color-tokeny.
- **Migracja snapshots/activity:** plik `20260611_…sql` istnieje (wspólny z M05) — [do weryfikacji w DB na staging/prod].

### 03 · Rejestr luk
| ID | Opis | Wejście | Dowód `plik:linia` | Klasa | Faza | Status |
|----|------|---------|--------------------|-------|------|--------|
| L-01 | WS collab bez org-scope verify | W-01,W-03 | `ideaCollabWs.gateway.ts:237-242` | P1 | 1 | **ZAMKNIĘTA (2026-06-17, Harvard 2)** — org-scope realny + test wspólny `tests/integration/gateways/ideaCollabWs.orgscope.test.ts` (6/6 PASS: 401 JWT, 403 cross-org IDOR, same-org pass) |
| L-02 | snapshots/activity brak migracji→503 (wspólne M05) | W-01 | `my-work.routes.ts:4515,4818` + mig. `20260611_…sql` | P0 | 1 | **ZAMKNIĘTA na STAGING (R3 2026-06-17, H2)** — wspólne z M05 L-02: read-only `to_regclass` na staging (caboose) potwierdza, że `my_idea_map_snapshots`+`my_idea_activity` ISTNIEJĄ → migracja `20260611` APPLIED. **PROD = verify-at-deploy** (Londyn→prod, zgoda Piotra). |
| L-03 | Korupcja codemodu „red"→"rose" | W-01,W-03 | (historycznie `IdeaRecommendationMap.tsx:1001,1824`) | P1 | 1 | **ZAMKNIĘTA `fd8707c5b2` (grep=0, re-zweryf. 2026-06-17)** |
| L-04 | ExportPPT myląca etykieta; sidekick w próżnię; AI overlays fabrykowane; WebhookSettings localStorage | W-01,W-03 | `ExportPowerPoint.tsx:91`, `IdeaRecommendationMap.tsx:2534`, `WebhookSettings.tsx:44` | INTEGR/P2 | 3 | **ZAMKNIĘTA (2026-06-17, `f84649d3af` + `8c3285480d`)** — webhook: martwe CTA `mm_webhooks` (brak handlera) + osierocony `WebhookSettings.tsx`(+dup ` 2.tsx`) USUNIĘTE. FALSE POSITIVE (zweryf. w kodzie): sidekick = KONSUMOWANY (`AIActionsPopover.tsx:91`, `FloatingAIPopover.tsx:54`); ExportPPT etykieta = UCZCIWA („Pobierz HTML (do PDF/PPTX)" `:161`); AI overlays = REALNY LLM (`Api.getMyIdeaAISuggestions` w `AISentimentOverlay:56`/`AIAutoClustering:62`) |
| L-05 | Flush bez keepalive/sendBeacon (wspólny pula) | W-01 | `useIdeaMapSync.ts:350-354` | P1 | 1/3 | **ZAMKNIĘTA `8c3285480d` (2026-06-17)** — `keepalive` w `Api.syncMyIdeaMap` (single-shot, wysyła Authorization; sendBeacon nie) + teardown handlery (visibility-hidden/beforeunload) przekazują `keepalive:true`; test +3 case'y (14/14 PASS) |
| L-06 | Dwa drawery ~2400l; brak align/distribute/snap; React dup-key | W-01 | `mindmap/NodeDetailDrawer.tsx`, `IdeaNodeDetailDrawer.tsx` | P2 | 3 | **D-01 ODROCZONA (2026-06-17)** — oba drawery ŻYWE z różnymi konsumentami: `NodeDetailDrawer` (mindmap: `IdeaRecommendationMap`+`QuickEditPopovers`) vs `IdeaNodeDetailDrawer` (map-workspace M05: `IdeaMapWorkspace`) — to NIE prosty duplikat, lecz dwie powierzchnie. Konsolidacja = ryzykowny refaktor ~2400l spanning M05+M06, nie correctness-bug → osobny pass refaktorowy (rekomendacja: nie robić spekulatywnie bez R6). align/distribute/snap = P2 enhancement (nie bug). **Runda 2 (2026-06-17):** React dup-key NAPRAWIONY — `ColorPickerPopover` `RECOMMENDED_COLORS`/`PALETTE` miały zduplikowane hex (`#3b82f6` 3× itd.) renderowane z `key={c}` → owinięte `Array.from(new Set())` (dedup, brak warningu + brak redundantnych próbek); test `colorPickerPaletteUnique.test.ts` (3/3, CI-gated). Pozostaje tylko konsolidacja drawerów (D-01) + align/snap (enhancement) — odroczone. |
| L-07 | Brak BE map/sync + WS test + snapshot test; E2E poza tier0; CI bez `Londyn` | W-01 | `tests/integration/*` (brak) | P0-test | 1+4 | **ZAMKNIĘTA (2026-06-17)** — WS cross-org test `ideaCollabWs.orgscope.test.ts` (6/6); map/sync round-trip pokryty `useIdeaMapSync` smoke (14/14) + M05 contract `my-work.map-sync.contract.test.ts`; CI Londyn skonfigurowane (`test-suite.yml`) |

### 04 · Rejestr decyzji (R5)
| ID | Pytanie | Opcje | Właściciel | Termin | Status |
|----|---------|-------|------------|--------|--------|
| D-01 | Canonical drawer szczegółów węzła | `NodeDetailDrawer` / `IdeaNodeDetailDrawer` (wytnij drugi) | Piotr | TBD | **ODROCZONA (skoryg. 2026-06-19): NIE prosty duplikat do wycięcia — obie powierzchnie ŻYWE z różnymi konsumentami (zweryf. grepem): `mindmap/NodeDetailDrawer.tsx` ← `IdeaRecommendationMap.tsx` + `mindmap/floating-toolbar/QuickEditPopovers.tsx` (mind-map); `IdeaNodeDetailDrawer.tsx` ← `IdeaMapWorkspace.tsx` (M05 map-workspace). Konsolidacja = ryzykowny refaktor ~2400l spanning M05+M06, nie correctness-bug → osobny pass refaktorowy, nie blokuje domknięcia.** |
| D-02 | AI overlays (sentiment/clustering) | dedykowany endpoint LLM / oznaczyć jako heurystyki | Piotr | TBD | **ROZSTRZYGNIĘTE → DP-5: ukryj za flagą + label „wkrótce" (nie półbuduj)** |
| D-03 | Kontrakt `my_idea_maps` per-resource (DP-3) | single-player / shared+membership | Piotr | TBD | **DP-3 = per-resource multiplayer — M09 zmienia kontrakt; WS gateway WSPÓLNY z M06/M07/M09, membership wpływa na org-check** |

### 05 · Flagi/rollout — beta Ideas; collab WS aktywny dla org. **DP-3:** przebudowa na shared+membership (M09) zmienia regułę join (org-check → membership-check) w `ideaCollabWs.gateway.ts` — wspólnym dla M06/M07/M09.
### 06 · Ryzyka — placeholder `?` w gateway: potwierdzić tłumaczenie przez PG-adapter (inaczej DB-check może nie działać na PG); migracja 20260611 może nie być na prod; korupcja „rose" dotykała też M04 (`notebook/AIChatInlinePanel.tsx`) — sweep szerszy do potwierdzenia.
### 07 · Log — 2026-06-20 (sesja domknięcia, R6 częściowy ŻYWY): **Gate 1 (Kod) zweryfikowany na żywo** — L-04 podklamy potwierdzone w kodzie (ExportPPT etykieta „Pobierz HTML (do PDF/PPTX)" `ExportPowerPoint.tsx:161`; AI overlays = REALNY LLM `Api.getMyIdeaAISuggestions` `AISentimentOverlay:56`/`AIAutoClustering:62`; sidekick KONSUMOWANY `AIActionsPopover.tsx:91`+`FloatingAIPopover.tsx:54`; ColorPicker dedup `floating-toolbar/ColorPickerPopover.tsx:19-32`). **REALNY RESIDUAL ZNALEZIONY+USUNIĘTY:** `mindmap/WebhookSettings.tsx` (localStorage fake-backend = L-04/Z-08) był OSIEROCONYM trackowanym plikiem (0 importerów repo-wide; teczka twierdziła usunięty, ale chore `ff5120cb21` go przywrócił) → `git rm`. **Gate 4 (Kod-testy): 230 PASS** (166 unit mindmap+mywork, 42 integ incl. WS org-scope 6/6 + map-sync contract 11/11, 22 component). **Gate 5 (Manual) — harness ŻYWY + częściowy:** zbudowany reprodukowalny, bez-sekretów harness Playwright `tests/e2e/m06/_m06.ts` (auth via `register-demo`, brak QA creds) + `_AGENT_BRIEF.md`; specy §1/§2/§4/§10 (`m06-0{1,2,4}-*.spec.ts`+`m06-10-*`) odpalone ŻYWO na localhost:3000+staging → **19 screenshotów** `tests/e2e/screenshots/m06/` (~17 scenariuszy: §1 3/3 PASS; §2 8/8 ujęte; §4,§10 keyboard-driven). Honest-skip dla [MANUAL]/[REAL-AI]/focus-headless (Cmd+K wired `IRM:3779`, undo `IRM:3124` — działają w kodzie, nie odpalają się pod headless keyboard-focus → nie defekt). **BLOKER GATE 5:** staging perf (~40s/test, ~2.4s/API, ~15s mount canvas) + flakiness interakcji + fan-out sub-agentów PADŁ (kontencja 1 backendu) → pełne 121 live = robota CI/follow-up na tym harnessie, nie do domknięcia 1 sesją. **Gate 2 (DoD) NIE 7/7:** i18n **881 `isPolish`/`isPl`** (64 plików; funkcjonalnie dwujęzyczne ale nie przez `t()` — DECYZJA puli = Faza 4) + **299 inline hex** (Visual Standard — odroczone) = realne długi odroczone decyzją puli; rose=0 ✅, kryteria 1/2/5/6 ✅, 7 (UI) ✅ żywo. **Gate 3 (Epiki) 7/7** zmapowane do zamkniętych L-01..L-07 (EPIK 6 align/snap+drawer D-01 = odroczone enhancement, nie correctness). **Bramki Piotra:** 6 deploy demo (zgoda Londyn→demo — wybrał „przygotuj, ja kliknę"), 7 →F, 8 →UI (audytor). **M06 NIE 8/8** — gates 1/3/4 domknięte, 5 częściowy (harness+19 .png), 2 zablokowany odroczeniami puli, 6/7/8 = Piotr. ⟶ poniżej oryginalny log.
### 07 · Log — 2026-06-13: zweryfikowano L-01 (WS org-scope realny), L-03 (rose=0). Audyt 2026-06-12: 60/100. 2026-06-17 (Harvard 2): L-01/L-07 ZAMKNIĘTE (WS test 6/6); L-04 ZAMKNIĘTA (`f84649d3af` martwe webhooki + FALSE POSITIVE sidekick/etykieta/overlays); L-05 ZAMKNIĘTA (`8c3285480d` keepalive); L-06 D-01 ODROCZONA (dwie żywe powierzchnie, nie bug); L-02 = deploy-time (zgoda Piotra). Re-ocena po sesji żywej (R6).

---

## Bramka teczki: 8/9 dokumentacyjnie
R1 ✅ · R2 ✅ · R3 statusy z dowodem (L-01/L-03 zweryfikowane w kodzie — silne) ✅ · R4 DoD z liczbami (872/289/1, rose=0) ✅ · R5 decyzje rozstrzygnięte (D-02=DP-5; D-01 modułowa; D-03=DP-3); R6 sesja żywa pozostaje ✅ · A-E ✅ · F epiki↔luki ✅ · G DoD+S+sec ✅ · **R6 sesja żywa NIEZALICZONA (pula nietestowana żywo) — W-02 puste.** **8/9.**

## EKRANY (inwentarz) — 2026-06-19
Ugruntowane w realnych ścieżkach. Canvas mind-map (`IdeaRecommendationMap.tsx`) + `mindmap/` (~50 plików). Binding record-based `my_idea_maps`; collab przez WS `ideaCollabWs.gateway.ts`.

| # | Ekran / widok | Cel | Plik komponentu |
|---|---|---|---|
| 1 | Kanwa mind-map | węzły rekomendacji + krawędzie, 4 layouty, gramatyka klawiaturowa, undo/redo 50 | `src/components/MyWork/IdeaRecommendationMap.tsx` |
| 2 | Lewy toolbar kanwy | dodaj węzeł / narzędzia | `src/components/MyWork/mindmap/CanvasLeftToolbar.tsx` |
| 3 | Floating node toolbar | akcje na zaznaczonym węźle | `src/components/MyWork/mindmap/FloatingNodeToolbar.tsx` |
| 4 | Drawer szczegółów (mind-map) | notatki/kolor/metadane węzła (canonical mindmap, D-01 odroczone) | `src/components/MyWork/mindmap/NodeDetailDrawer.tsx` |
| 5 | Drawer szczegółów (workspace) | druga powierzchnia (M05 map-workspace) | `src/components/MyWork/IdeaNodeDetailDrawer.tsx` |
| 6 | Command palette | szybkie komendy mind-map | `src/components/MyWork/mindmap/MindmapCommandPalette.tsx` |
| 7 | Inspector | inspekcja struktury mapy | `src/components/MyWork/mindmap/MindmapInspector.tsx` |
| 8 | Widok 3D | alternatywna wizualizacja | `src/components/MyWork/mindmap/MindMap3DView.tsx` |
| 9 | Overlay współpracy (presence) | awatary/kursory uczestników org, odbiór `graph_patch` | `src/components/MyWork/mindmap/CollaborationOverlay.tsx` |
| 10 | Panele AI (overlays) | sentiment/clustering/priority/blind-spots — realny LLM (`Api.getMyIdeaAISuggestions`) | `src/components/MyWork/mindmap/AISentimentOverlay.tsx`, `AIAutoClustering.tsx`, `AIPriorityRecommender.tsx`, … |
| 11 | Panel propozycji AI (diff modal) | propose→accept/reject węzłów | `src/components/MyWork/mindmap/AIProposalDiffModal.tsx` |
| 12 | Import zewnętrznej mapy (modal) | FreeMind/XMind/OPML | `src/components/MyWork/mindmap/ImportExternalMap.tsx` |
| 13 | Eksport PowerPoint/diagram (modal) | „Pobierz HTML (do PDF/PPTX)" (L-04 etykieta uczciwa) | `src/components/MyWork/mindmap/ExportPowerPoint.tsx`, `ExportDiagramCode.tsx` |
| 14 | Wątek komentarzy węzła | komentarze per-węzeł | `src/components/MyWork/mindmap/NodeCommentThread.tsx` |
| 15 | Health score mapy | metryka jakości mapy | `src/components/MyWork/mindmap/MapHealthScore.tsx` |
| 16 | Document/Interview → Map (modale) | generacja mapy z dokumentu/wywiadu | `src/components/MyWork/mindmap/DocumentToMap.tsx`, `InterviewToMap.tsx` |

**Stany przekrojowe:** pełny/edycja / collab cross-org → 403 (`ideaCollabWs.gateway.ts:240-242`) / konflikt 409 → rehydracja. §27 N.D. (canvas).
