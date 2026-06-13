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

## B · UX DOCELOWE *(karta §5 + delty)*
- **Layout:** kanwa mind-map + toolbary + drawer szczegółów węzła.
- **Stany:** pełny/edycja OK; **§27 N.D.** (canvas, nie lista) — kanon hubowy `MyWorkHub`.
- **Delty:** konsolidacja dwóch drawerów (`NodeDetailDrawer.tsx` 1042l + `IdeaNodeDetailDrawer.tsx` 1374l ≈ 2400l duplikacji → wybrać canonical); align/distribute + snap-to-grid; React duplicate-key w ColorPickerPopover.

## C · DANE + API + REGUŁY *(link + kontrakt)*
- **Persystencja:** łańcuch `useMindMapPersistence.ts:590-754` → `workspaceGraphRuntime.ts` → `useIdeaMapSync.ts:232-314` → `POST /map/sync` (`my-work.routes.ts:3874`) z baseVersion/409/empty-reset-guard + org-scope.
- **WS collab:** `ideaCollabWs.gateway.ts` — JWT verify przy upgrade **+ org-scope DB-check** `SELECT id FROM my_ideas WHERE id=? AND organization_id=?` (`:237-238`) → cross-org idea = **403 + socket.destroy** (`:240-242`). Tabela snapshots/activity = WSPÓLNA z M05.
- **Reguły:** room kluczowany `ideaId`, dołączenie tylko po przejściu org-check.

## D · AI / TERESA *(link + delty)*
- **Co generuje:** expand/suggestions/gap (realny LLM).
- **Delty:** AISentimentOverlay/AIAutoClustering = obecnie fabrykowane klientem (pozycyjne/substring) → dedykowane endpointy LLM ALBO oznaczyć jako heurystyki; Teresa sidekick event (`idea-mindmap-sidekick-context`, `:2534`) wysyłany ale `useOpenChatWithContext.ts` go nie konsumuje → handler.

## E · INTEGRACJE *(karta §1g + zależności)*
- **←** lista idei. **→** czat (sidekick — dziś w próżnię), eksport→M19 (ExportPowerPoint).
- **Kręgosłup:** **WS gateway `ideaCollabWs.gateway.ts` WSPÓLNY z M07 i M09** — jeden fix org-scope zamyka 3 moduły (zweryfikowany jako naprawiony). `useIdeaMapSync` flush/cleanup wspólny z całą pulą.
- **Zależności blokujące:** migracja snapshots/activity **WSPÓLNA z M05**.

## F · EPIKI *(z karty §7)*
- **EPIK 1 — WS org-scope (P1):** cross-org → 403, test gateway (L-01) — **kod naprawiony, brak testu.**
- **EPIK 2 — Persystencja snapshots/activity (P0):** migracja (wspólna M05) + smoke 200 (L-02).
- **EPIK 3 — Korupcja „rose" (P1):** grep=0 + UI bez „Cost roseuction" (L-03) — **zweryfikowane = 0.**
- **EPIK 4 — Uczciwe afordancje:** etykieta ExportPPT, sidekick handler, AI overlays uczciwe, WebhookSettings usunięte (L-04).
- **EPIK 5 — Flush keepalive/sendBeacon (P1, wspólny):** (L-05).
- **EPIK 6 — Szlif:** konsolidacja drawerów, align/distribute/snap, martwy kod (L-06).
- **EPIK 7 — Testy:** BE map/sync + WS gateway + snapshot + E2E checklist + CI `Londyn` (L-07).

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
| L-01 | WS collab bez org-scope verify | W-01,W-03 | `ideaCollabWs.gateway.ts:237-242` | P1 | 1 | **NAPRAWIONA `fd8707c5b2` (zweryf. w kodzie 2026-06-13)** — domknąć testem |
| L-02 | snapshots/activity brak migracji→503 (wspólne M05) | W-01 | `my-work.routes.ts:4515,4818` + mig. `20260611_…sql` | P0 | 1 | **migracja ISTNIEJE; status DB do weryfikacji** [do weryfikacji w DB] |
| L-03 | Korupcja codemodu „red"→"rose" | W-01,W-03 | (historycznie `IdeaRecommendationMap.tsx:1001,1824`) | P1 | 1 | **NAPRAWIONA `fd8707c5b2` (grep=0, zweryf. 2026-06-13)** |
| L-04 | ExportPPT myląca etykieta; sidekick w próżnię; AI overlays fabrykowane; WebhookSettings localStorage | W-01,W-03 | `ExportPowerPoint.tsx:91`, `IdeaRecommendationMap.tsx:2534`, `WebhookSettings.tsx:44` | INTEGR/P2 | 3 | etykieta+webhook **claim naprawione `fd8707c5b2` [do weryfikacji]**; sidekick+overlays otwarte |
| L-05 | Flush bez keepalive/sendBeacon (wspólny pula) | W-01 | `useIdeaMapSync.ts:350-354` | P1 | 1/3 | otwarta |
| L-06 | Dwa drawery ~2400l; brak align/distribute/snap; React dup-key | W-01 | `mindmap/NodeDetailDrawer.tsx`, `IdeaNodeDetailDrawer.tsx` | P2 | 3 | **D-01** (canonical drawer) |
| L-07 | Brak BE map/sync + WS test + snapshot test; E2E poza tier0; CI bez `Londyn` | W-01 | `tests/integration/*` (brak) | P0-test | 1+4 | otwarta |

### 04 · Rejestr decyzji (R5)
| ID | Pytanie | Opcje | Właściciel | Termin | Status |
|----|---------|-------|------------|--------|--------|
| D-01 | Canonical drawer szczegółów węzła | `NodeDetailDrawer` / `IdeaNodeDetailDrawer` (wytnij drugi) | Piotr | TBD | otwarta |
| D-02 | AI overlays (sentiment/clustering) | dedykowany endpoint LLM / oznaczyć jako heurystyki | Piotr | TBD | otwarta |

### 05 · Flagi/rollout — beta Ideas; collab WS aktywny dla org.
### 06 · Ryzyka — placeholder `?` w gateway: potwierdzić tłumaczenie przez PG-adapter (inaczej DB-check może nie działać na PG); migracja 20260611 może nie być na prod; korupcja „rose" dotykała też M04 (`notebook/AIChatInlinePanel.tsx`) — sweep szerszy do potwierdzenia.
### 07 · Log — 2026-06-13: zweryfikowano L-01 (WS org-scope realny), L-03 (rose=0). Audyt 2026-06-12: 60/100. Re-ocena po FAZA 1 + sesji żywej (R6).

---

## Bramka teczki: 8/9 dokumentacyjnie
R1 ✅ · R2 ✅ · R3 statusy z dowodem (L-01/L-03 zweryfikowane w kodzie — silne) ✅ · R4 DoD z liczbami (872/289/1, rose=0) ✅ · R5 decyzje z właścicielem ✅ · A-E ✅ · F epiki↔luki ✅ · G DoD+S+sec ✅ · **R6 sesja żywa NIEZALICZONA (pula nietestowana żywo) — W-02 puste.** **8/9.**
