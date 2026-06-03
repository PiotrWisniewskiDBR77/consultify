# Consultify — Wave 1 Master Plan (do 98/100)

**Data:** 2026-06-02 · **Tryb:** ⚠️ DEADLINE „niedziela" SKASOWANY (decyzja właściciela) — **jedziemy każdy moduł do pełnego 98/100, bez taryfy ulgowej** (P0+P1+P2 łącznie), quality‑first, sekwencjonowane zależnościami. Etykiety „Sunday/Week‑2" w planach modułów traktujemy tylko jako kolejność wewnątrz modułu, nie jako cięcie zakresu. · **Definicja gotowości:** D20 (98/100)
**Decyzje bazowe:** `docs/plans/CONSULTIFY_PRODUCT_DECISIONS_2026-06-02.md` · **Pricing:** `CONSULTIFY_PRICING_STRATEGY_2026-06-02.md` · **Audyt:** `docs/audit/2026-06-02/`
**Plany szczegółowe:** `docs/plans/modules/PLAN_*.md` + `docs/plans/cross-cutting/PLAN_X*.md`

---

## 1. Zakres Wave 1
**Moduły rdzenia:** 01 Czat/Teresa · 02 Moja Praca · 03 Wywiad · 04 Narzędzia (+Assessment) · 05 Inicjatywy · 06 Realizacja · 09 Outputs · 16 Organizacja · 08b Model finansowy (tylko modelowanie, nie billing) · 19 Partner (MVP — promowany w D10).
**Strumienie przekrojowe:** X1 Design System · X2 Demo Gate + Atelier · X3 Realtime + Voice · X4 Onboarding/i18n/Settings-min · X5 Hygiene/P0 + Spine/Nav.
**Wave 2 (po niedzieli):** 10 Dokumenty · 11 Tabele · 12 Prezentacje (studia deliverabli → Gamma/Canva) + dociągnięcie 07/08/17/18. **Później:** 13 Meeting. **Ukryte:** 14/15.

---

## 2. Twarda ocena realności (uczciwie)

| | Eng-godziny |
|---|---|
| „Sunday‑critical" (suma P0 z 15 planów) | **~144 h** |
| Pełny Wave 1 do 98/100 (P0+P1+P2) | **~315 h** |
| Dostępne solo @18h/dobę × 6 dni | ~108 h |

**Wniosek:** 144 h pracy „na niedzielę" **nie zmieści się** w 108 h jednego człowieka. Dwa wyjścia, używamy OBU:
1. **Równoległa implementacja przez AI** — moduły są w większości niezależne; agenci budują kilka naraz (tak jak powstał ten plan). To kompresuje *wall‑clock*, bo 144 h to godziny‑inżyniera, nie godziny‑zegarowe.
2. **Zawężony „Sunday Demo Golden Flow"** (sekcja 4) — nieredukowalne minimum, które MUSI olśnić pierwszych klientów. Reszta P0 dociągana Week‑2.

To nie jest „nie zdążymy" — to „priorytetyzujemy brutalnie i zrównoleglamy".

---

## 3. Kolejność wykonania (zależności)

```
DZIEŃ 0 (fundamenty — odblokowują wszystko, robić NAJPIERW):
  X5 Hygiene/P0  → testy zielone, --noCheck off, P0 security, ukryć IRIS/Marketplace, fix spine-nav (PORTFOLIO_ROADMAP→INITIATIVES)
  X1 Design tokens (Sunday subset) → crimson+rounded+navy, prymitywy Button/Card, EmptyState/Loading/Error
  X2 Demo gate + Atelier seed → twarda bramka, seed org-context Atelier (backbone demo)
  X3 Realtime/Voice (Sunday subset) → GEMINI_LIVE_API_KEY na Railway, odsłonić voice button, usunąć martwy duplikat
  X4 i18n PL gaps (22 klucze) + onboarding + demo toggle w first-run
       │
       ▼
DZIEŃ 1–4 (moduły — RÓWNOLEGLE, każdy na swoim planie):
  16 Organizacja (Atelier org-context) ──┐  ← backbone, wcześnie
  01 Czat/Teresa + voice  ───────────────┤
  03 Wywiad / 04 Tools+Assessment ───────┤  entry doors (≥2 dopracowane)
  08b Model finansowy ───────────────────┤
  05 Inicjatywy (+ROI view) ─────────────┤  spine center
  06 Realizacja (rollout→ExecutionHub) ──┤
  02 Moja Praca (migracje + Radar) ──────┤
  09 Outputs (Teresa→artifact, no demo leak) ─┘  ← koniec spine
  19 Partner MVP (równolegle, niezależny)
       │
       ▼
DZIEŃ 5–6 (integracja + demo):
  E2E przejście golden flow na Atelier Toys · smoke-test per moduł · i18n PL sweep ·
  spójność wizualna (jeden shell, crimson) · onboarding · polish · cut-lines
```

**Reguła:** X5 + X1 + X2 muszą być gotowe, zanim moduły ruszą na poważnie (inaczej budujemy na ruchomym piasku i powielamy niespójności).

---

## 4. 🎯 Sunday Demo Golden Flow (nieredukowalne minimum)

Jedna historia, opowiedziana bezbłędnie na **Atelier Toys** (transformacja 2015), z **Teresą rozmawiającą** i **spójną grafiką**:

1. **Logowanie → onboarding → włącz „Pokaż dane demo (Atelier Toys)"** (X4 + X2).
2. **Organizacja:** kontekst firmy Atelier zasila Teresę (16) — widać „Teresa używa tego kontekstu".
3. **Teresa/Czat (głos):** rozmowa z Teresą, streaming, voice button działa (01 + X3).
4. **Drzwi wejściowe (≥1 perfekcyjne, cel 2):** **Wywiad** (03) lub **Tools/Assessment** (04) → generują **Insighty**.
5. **Inicjatywy + ROI:** insighty → inicjatywy, realny **widok ROI** (05) wsparty **Modelem finansowym** Atelier (08b).
6. **Realizacja:** inicjatywy → wykonanie/rollout w ExecutionHub (06).
7. **Outputs:** Teresa generuje deliverable → ląduje w Outputs, eksport działa, **zero danych demo wyciekających poza toggle** (09).

Wszystko na **jednym shellu (ModuleHub), crimson+rounded, EN+PL**. Studia Doc/Deck/Table (Wave 2) — Outputs pokazuje i eksportuje istniejący pipeline, reszta schowana czysto (bez „coming soon").

**Cut-lines (jeśli czas ciśnie, w tej kolejności tniemy):** Partner MVP → 2 drzwi do 1 → voice do samego TTS → Realizacja persistence do read-only.

---

## 5. Efort per strumień (Sunday / pełny)

| Plan | Sunday h | Pełny Wave-1 h | Plik |
|---|---:|---:|---|
| X5 Hygiene/P0 + Spine-Nav | 3 | 6 | `cross-cutting/PLAN_X5_*` |
| X1 Design System | 6.5 | 17 | `cross-cutting/PLAN_X1_*` |
| X2 Demo Gate + Atelier | 13 | 23 | `cross-cutting/PLAN_X2_*` |
| X3 Realtime + Voice | 2 | 20 | `cross-cutting/PLAN_X3_*` |
| X4 Onboarding/i18n/Settings | 15 | 33 | `cross-cutting/PLAN_X4_*` |
| 16 Organizacja | 13 | 18 | `modules/PLAN_16_*` |
| 01 Czat/Teresa | 17 | 30 | `modules/PLAN_01_*` |
| 03 Wywiad | 10.5 | 18 | `modules/PLAN_03_*` |
| 04 Narzędzia | 11 | 23 | `modules/PLAN_04_*` |
| 08b Model finansowy | 7 | 16 | `modules/PLAN_08b_*` |
| 05 Inicjatywy | 11 | 19 | `modules/PLAN_05_*` |
| 06 Realizacja | 10 | 28 | `modules/PLAN_06_*` |
| 02 Moja Praca | 13 | 26 | `modules/PLAN_02_*` |
| 09 Outputs | 7 | 15 | `modules/PLAN_09_*` |
| 19 Partner MVP | 5 | 23 | `modules/PLAN_19_*` |
| **RAZEM** | **~144** | **~315** | |

---

## 6. Najczęstsze wzorce napraw (z 15 planów — rób je systemowo)
- **Migracje commit+run:** notebook containers (uncommitted), v8_process_flow (brak), Megatrends seed, rollout tables, mock-seed cleanup.
- **Kill silent fallback/503:** demo na 404/501/localhost → tylko toggle; `respondSchemaUnavailable`; `TABLE_MISSING`; `mountStub` (invitations, generator).
- **Un-stub w prod:** invitations (16), initiative-generator (05).
- **Usuń martwy kod/placeholder:** AIChatWelcomeView (01), Discovery/InterviewHub (03), PerformanceSection (19), legacy PartnerPortalView (19), FullRolloutView/SplitLayout (06), dup " 2" (X5/task).
- **Build/test higiena:** `--noCheck` off, 5 testów api.test.ts, P0 security ProtectedRoute.
- **Teresa touchpoint** w każdym module + spójny shell/tokeny + stany empty/loading/error + PL i18n.

---

## 7. Rekomendowany model wykonania
Zrównoleglić przez agentów‑builderów: **Dzień 0 = fundamenty (1 sesja, sekwencyjnie)**, potem **3–4 moduły naraz** w izolowanych worktree (żeby się nie biły o pliki), z X1/X2/X5 jako wspólną bazą. Po każdym module: smoke-test + zgodność z Design Canon. Dzień 5–6: integracja golden flow + polish.

> Gotowy do startu Dnia 0 na Twój sygnał. Mogę puścić pierwszą falę implementacji (fundamenty X5+X1+X2) od ręki.
