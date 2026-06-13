# TECZKA M09 — Ideas · Whiteboard (pełna teczka wg wzorca)

> Teczka = **cienki indeks + reconciliation**. Wzór: [`_WZORZEC_TECZKI.md`](_WZORZEC_TECZKI.md) · referencja: [`M13-inicjatywy.md`](M13-inicjatywy.md).
> **Pula Ideas — uwaga R6:** NIE testowana na żywo 2026-06-13 (brak wpisu Ideas w `UWAGI_TESTY_2026-06-13.md`) → wejścia dziedziczone z karty + reconciliation w kodzie.

## 00 · Nagłówek
- **Moduł:** M09 Ideas-Whiteboard · **Pula:** ideas (najlepiej wykonane narzędzie canvas, najgłębszy bloker strukturalny)
- **Ocena audytu:** 49/100 (najniższa w puli) · **Status:** FAZA 1 → FAZA 3 · **Rozmiar:** **L (3-5 dni — najcięższy)** · **Żywy bloker:** P0-struct (per-user dokument → multiplayer niemożliwy)
- **Właściciel:** Piotr · **Daty:** karta 2026-06-12 · teczka 2026-06-13
- **Karta:** `Harvard/modules/M09-ideas-whiteboard/KARTA_AUDYTU.md` (§1e · §1g · §5 · §6 · §7) · **Evidence:** `…/evidence/`
- **Kod:** `src/components/MyWork/IdeaWhiteboardTool.tsx` · `src/components/MyWork/whiteboard/` · `src/components/MyWork/IdeaDrawingLayer.tsx` · `server/src/routes/realtime-platform.routes.ts` · `server/src/services/realtimePlatformService.ts` · `server/src/gateways/ideaCollabWs.gateway.ts`

## MAPA POKRYCIA
| Warstwa | Stan | Źródło | Co dokłada teczka |
|---|---|---|---|
| A Intencja | 🟡 | karta §0 | job-to-be-done + shared-board (niżej) |
| B UX docelowe | 🟡 | karta §5 | stany + delty (kształty, resize) |
| C Dane+API+reguły | 🟢 | karta §1e + facilitation API + WS | shared-board P0 + PG datetime (niżej) |
| D AI/Teresa | 🟡 | karta (5+ generatorów) | granice + delty (niżej) |
| E Integracje | 🟢 | karta §1g | WS + presence (niżej) |
| F Epiki | 🟢 | karta §7 | epiki (niżej) |
| G DoD | 🟢 (dołożone) | karta §0/§2 | **liczby grepem** (niżej) |
| H Governance | 🟢 (dołożone) | karta §1/§6 | **Rejestr Wejść+Decyzji+R3** (niżej) |

---

## A · INTENCJA *(z karty + kodu)*
- **Job-to-be-done:** prowadzić warsztaty na wspólnej tablicy (11 typów node, rysowanie, frames, sceny+tryb prezentacji, facilitation: głosowanie/role/outcomes) jako narzędzie idea — **wielo-uczestnik, realtime.**
- **Persony/role:** facilitator + uczestnicy (ta sama org). **Kluczowe: shared-board (per-resource), nie per-user.**
- **Zakres v1:** edytor whiteboardu (single-player solidny) · facilitation API (12 endpointów DB-backed) · realny LLM (5+ generatorów, propose→accept/reject) · eksport PNG/SVG/MD/JSON · i18n wzorcowy (149 kluczy). **POZA v1:** object storage obrazów (delta P2), enforcement ról serwerowy (delta).
- **Metryka:** 2. uczestnik ładuje tę samą tablicę (nie 404); zmiana u A widoczna u B (realtime).

## B · UX DOCELOWE *(karta §5 + delty)*
- **§27 N.D.** (canvas). i18n wzorcowy (najlepszy w puli — 149 kluczy PL/EN).
- **Delty:** kształty circle/diamond/hexagon — handlery istnieją (`useWhiteboardQuickActions.ts:45-47`), UI emituje tylko rectangle (`WhiteboardToolbar.tsx:127-129`) → odblokować; resize node'ów (NodeResizer); auto-parentowanie do frames.

## C · DANE + API + REGUŁY *(link + P0-struct)*
- **P0-STRUKTURALNY (ŻYWY):** `my_idea_maps` keyed `WHERE idea_id=? AND user_id=? AND organization_id=?` (`my-work.routes.ts:3677,3656-3660`) → cudza idea = 404 → 2. uczestnik nie załaduje tablicy → **multiplayer = teatr jednoosobowy niezależnie od jakości API.** Fix: shared board model (per-resource + membership/share). **Zmienia kontrakt `my_idea_maps` dla CAŁEJ puli Ideas** (per-user→per-resource) → koordynacja z M05.
- **Brak realtime syncu treści (P1):** `graph_patch` z WS konsumowany wyłącznie przez mind-mapę (`IdeaRecommendationMap.tsx:2811`); whiteboard nie nadaje/odbiera patchy. Fix: podpiąć whiteboard pod `graph_patch`.
- **WS collab:** `ideaCollabWs.gateway.ts:237-242` org-scope DB-check + 403 (WSPÓLNY z M06/M07, **zweryfikowany jako naprawiony**).
- **PG datetime (P1):** `realtimePlatformService.ts:141 cleanStalePresence` + `:520 acquireEditLock` — **NAPRAWIONE** (`NOW() ± ($N * INTERVAL '1 minute')`, zweryfikowane w kodzie 2026-06-13).

## D · AI / TERESA *(link + delty)*
- **Co generuje:** 5+ generatorów (propose→accept/reject), realny LLM.
- **Delty:** governance/klasyfikacja+watermark FE-only (`IdeaExportMenu.tsx:177`) → BE enforcement classification_level przy `/map` PUT.

## E · INTEGRACJE *(karta §1g + zależności)*
- **←** lista idei. **→** eksport PNG/SVG/MD/JSON; `/api/realtime-v4/tool-sessions` presence (wspólne z facilitation).
- **Kręgosłup:** **WS gateway WSPÓLNY z M06 i M07** (jeden fix, zweryfikowany); blob-sync/`useIdeaMapSync` wspólny z M05/M06/M07/M08 — **shared board model zmienia kontrakt dla całej puli.**
- **Zależności blokujące:** shared-board (P0) → koordynacja z M05; ryzyko regresu single-player.

## F · EPIKI *(z karty §7)*
- **EPIK 1 — Shared board model (P0-struct, najcięższy L):** `my_idea_maps` per-resource + membership/share; `GET /map` dla każdego członka org (L-01).
- **EPIK 2 — Realtime sync treści (P1):** whiteboard pod `graph_patch` (L-02).
- **EPIK 3 — WS + facilitation + PG (FAZA 1):** WS org-scope (test); 5 facilitation endpointów org-scope; PG datetime smoke (L-03).
- **EPIK 4 — Fasady facilitation:** stan sesji czytany (polling); enforcement ról; governance BE; dot-voting spójny (L-04).
- **EPIK 5 — Szlif:** object storage obrazów; odblokowanie kształtów; NodeResizer; martwy kod (L-05).
- **EPIK 6 — Testy:** WS org-scope + facilitation DB + shared board + E2E + CI `Londyn` (L-06).

## G · JAKOŚĆ / DoD *(skwantyfikowane grepem 2026-06-13)*
| # | Kryterium | Miara M09 |
|---|-----------|-----------|
| 1 | Front↔back | shared board (2. uczestnik ładuje tablicę); realtime sync (A→B); stan sesji czytany; 0 fasad multiplayer |
| 2 | Bezpieczeństwo | WS org-scope (Org B→403) — **kod OK**; facilitation org-scope na 5 endpointach; PG lock/clean-stale bez crash — **kod OK**; governance BE enforced |
| 3 | i18n | **0 z 109** `isPolish`/inline (grep `whiteboard/`+`IdeaWhiteboardTool` — najmniejszy dług puli, i18n wzorcowy 149 kluczy) |
| 4 | Tokeny | **0 z 49** hex inline → Visual Standard |
| 5 | §27 | N.D. (canvas); **0** `<table>` |
| 6 | E2E w PR-gate | WS org-scope + facilitation DB + shared board zielone na `Londyn` |

## H · GOVERNANCE *(dołożone ogniwa)*

### 01 · Rejestr wejść (R1)
| ID | Źródło | Data | → Luka |
|----|--------|------|--------|
| W-01 | Karta audytu §1-§7 | 2026-06-12 | L-01..06 |
| W-02 | **Uwagi żywe 2026-06-13** | 2026-06-13 | **BRAK wpisu Ideas — pula nietestowana żywo; dziedzicz z karty (R6 do domknięcia)** |
| W-03 | Re-audit karty (`b9f2dee9d2`/`1b67579d7a`/`0b81310448`) | 2026-06-12 | L-03 (status — R3) |
| W-04 | Kod (`realtimePlatformService.ts`, `ideaCollabWs.gateway.ts`, `my-work.routes.ts`) | 2026-06-13 | weryfikacja R3 |

### 02 · Stan obecny (prawda kodu, R3 zweryfikowane 2026-06-13)
- **WS resource-auth = REALNY:** `ideaCollabWs.gateway.ts:237-242` (wspólny z M06/M07) — **POTWIERDZONY** (claim `b9f2dee9d2`).
- **PG datetime = NAPRAWIONE:** `realtimePlatformService.ts:141` `NOW() - ($1 * INTERVAL '1 minute')` + `:520` `NOW() + ($6 * INTERVAL '1 minute')` — **POTWIERDZONE w kodzie** (claim `1b67579d7a`). [Smoke na PG do domknięcia.]
- **Per-user dokument = ŻYWY P0-struct:** `my-work.routes.ts:3677` keyed user_id — niezmieniony; **najcięższy żywy bloker puli, żaden commit go nie adresuje** (to zmiana data-modelu, nie patch). [5 facilitation endpointów org-scope — do weryfikacji w kodzie czy `getFacilitationSession(orgId,...)` na wszystkich.]

### 03 · Rejestr luk
| ID | Opis | Wejście | Dowód `plik:linia` | Klasa | Faza | Status |
|----|------|---------|--------------------|-------|------|--------|
| L-01 | Per-user dokument blokuje multiplayer | W-01,W-04 | `my-work.routes.ts:3677,3656-3660` | P0-struct | 1 | **otwarta (żywa) — D-01**; brak commitu adresującego |
| L-02 | Brak realtime syncu treści whiteboardu | W-01 | `IdeaRecommendationMap.tsx:2811` (tylko mindmap) | P1 | 1 | otwarta |
| L-03 | WS resource-auth + facilitation org-scope + PG datetime | W-01,W-03 | `ideaCollabWs.gateway.ts:237-242`, `realtimePlatformService.ts:141,520` | P0/P1 | 1 | **WS+PG NAPRAWIONE (zweryf. 2026-06-13)**; 5 facilitation endpointów [do weryfikacji]; smoke PG do domknięcia |
| L-04 | Stan sesji nieczytany; role samonadawane; governance FE-only; emoji/voting lokalne; obrazy base64 (limit 10MB); voting niespójny | W-01 | `api.ts:18483`, `:1101`, `IdeaExportMenu.tsx:177`, `index.ts:923`, `realtimePlatformService.ts:293` | P1/P2 | 3 | otwarta |
| L-05 | Martwy kod (`useIdeasTeresaBridge.ts`); kształty zablokowane; brak NodeResizer | W-01 | `useWhiteboardQuickActions.ts:45`, `WhiteboardToolbar.tsx:127` | P2 | 3 | otwarta |
| L-06 | Brak testów WS/facilitation DB/shared board + E2E + CI bez `Londyn` | W-01 | `tests/*` (73 = spec+mock+smoke) | P0-test | 1+4 | otwarta |

### 04 · Rejestr decyzji (R5)
| ID | Pytanie | Opcje | Właściciel | Termin | Status |
|----|---------|-------|------------|--------|--------|
| D-01 | Shared board model (zmienia kontrakt `my_idea_maps` dla CAŁEJ puli) | per-resource + membership/share (multiplayer) / zostaw single-player (zamknij facilitation jako solo) | Piotr | TBD | otwarta — **kluczowa, koordynacja z M05** |
| D-02 | Obrazy base64 (limit body 10MB) | object storage / cap rozmiaru | Piotr | TBD | otwarta |

### 05 · Flagi/rollout — beta Ideas; facilitation aktywne w UI (ale multiplayer zablokowany P0-struct).
### 06 · Ryzyka — **shared board model = zmiana klucza dostępu `my_idea_maps` per-user→per-resource → ryzyko regresu single-player dla CAŁEJ puli Ideas (M05/M06/M07/M08)**; migracja danych ostrożna. Placeholder `?` w WS gateway — potwierdzić PG-adapter. PG datetime smoke na staging do domknięcia. Dev `.env` → Railway PROD; prod ~2026-05-18.
### 07 · Log — 2026-06-13: zweryfikowano L-03 (WS org-scope + PG datetime naprawione w kodzie). Audyt 2026-06-12: 49/100. Re-ocena po FAZA 1 (shared board — najcięższy) + sesji żywej (R6).

---

## Bramka teczki: 8/9 dokumentacyjnie
R1 ✅ · R2 ✅ · R3 statusy z dowodem (L-03 WS+PG zweryfikowane; L-01 żywy bez commitu — jawnie) ✅ · R4 DoD z liczbami (109/49/0) ✅ · R5 decyzje z właścicielem ✅ · A-E ✅ · F epiki↔luki ✅ · G DoD+S+sec ✅ · **R6 sesja żywa NIEZALICZONA (pula nietestowana żywo) — W-02 puste.** **8/9.**
