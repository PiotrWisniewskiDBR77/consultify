# A1 — Ecosystem / Affiliate Dashboard (aneks) — Karta audytu (Protokół V1)

**Data:** 2026-06-11 · **Branch:** `feat/deliverables-light` (commit `5607fb3c77`) · **Audytor:** Claude (osobiście — moduł trywialny, bez subagentów)
**Wejścia:** _MODULE_MAP_V2 wpis A1 · inwentarz `Harvard/podzial/inventory/INV_G_*.md` (sekcja ECOSYSTEM/AFFILIATE, poz.1)
**Evidence:** weryfikacja inline (poniżej, plik:linia).

## OCENA: 13/100 — Tier: Broken (świadomy STUB) · status 🟦 NIEPEŁNY (de facto: decyzja produktowa „budować albo wyciąć")

| Wymiar | Waga | Punkty | Uzasadnienie (1 zdanie) |
|---|---|---|---|
| A. Realność funkcji | 25 | 2 | 0% realne — pełny stub end-to-end (klient zwraca puste, serwer 503 na wszystko). |
| B. Wiring i dane | 15 | 1 | Brak realnego wiringu — `referrals.routes.ts` to catch-all 503; brak tabel/danych. |
| C. Testy automatyczne | 15 | 1 | Brak testów istotnych (nie ma czego testować). |
| D. Żywa użyteczność | 15 | 0 | Faza 4 niewykonana; widok zawsze pusty (nic do zweryfikowania poza pustką). |
| E. Kanony/UI | 10 | 2 | Widok renderuje pusty dashboard; minimalne. |
| F. Bezpieczeństwo/dostęp | 10 | 7 | 503 na wszystkich endpointach = zero powierzchni ataku; widok `requireAuth`. |
| G. Środowiska (Railway) | 10 | 0 | Faza 3 niewykonana (n/d — stub). |
| **Hard cap zastosowany?** | — | — | Faza 4 niewykonana → max 70; faktyczny sufit to 0% realności funkcji (świadomy stub), nie hard-cap bezpieczeństwa. |

**Werdykt jednym akapitem:** A1 to **świadomy stub end-to-end**, nie regresja — i jako taki wymaga **decyzji produktowej (budować albo wyciąć)**, nie naprawy. Zweryfikowane osobiście: serwer `referrals.routes.ts` to jeden catch-all `router.use((req,res) => res.status(503) {type:'not_configured'})` — **503 na KAŻDY endpoint** (czytelny komunikat „missing configuration", nie cichy fail); klient `api.ts` ma hardkodowane atrapy (`getUserReferrals: async () => ({ success:true, referrals: [] })`, `:12915`); `AffiliateDashboardView` jest zamontowany (`AppRoutes.tsx:2336`, `requireAuth`), ale pozycja sidebar „Ecosystem Impact" pojawia się tylko gdy `journeyState === 'ECOSYSTEM_NODE'`, więc dla większości userów moduł jest niewidoczny, a gdy widoczny — zawsze pusty. **Pozytyw:** to UCZCIWY stub — degraded-mode 503 z jasnym komunikatem zamiast fabrykowania fałszywych KPI poleceń (kontrast z localStorage-fasadą M23 czy „real call fake feature" M18/M20). Brak powierzchni ataku (wszystko 503, brak danych). **Jedyny dług:** moduł zajmuje miejsce w nawigacji i kodzie bez wartości — do rozstrzygnięcia.

---

## 0. Zakres i scenariusze krytyczne (FAZA 0)
**Checklist:** INV_G sekcja ECOSYSTEM/AFFILIATE, poz.1 (cały moduł = 1 pozycja STUB).
**Scenariusze krytyczne:** brak realnych (moduł nie ma działającej funkcjonalności). Hipotetyczne dla wersji zbudowanej: S1 lista poleceń, S2 kod referencyjny, S3 KPI ekosystemu.
**Obowiązujące kanony:** §27 — n/d · CARD_CONTENT_FORMULA — n/d · gating: `requireAuth` + warunek `journeyState`.

## 1. Prawda kodu (FAZA 1)
### 1a. REALNE
- Brak.
### 1b. MOCK / STUB
- **[STUB] Cały moduł** — klient `api.ts:12910-12915` hardkodowane atrapy (pusta lista, pusty kod); serwer `referrals.routes.ts:12-20` catch-all 503 `not_configured`.
### 1c. ZEPSUTE
- Brak (stub jest świadomy i uczciwy — 503 z komunikatem, nie cichy).
### 1d. MARTWY KOD
- `AffiliateDashboardView` — żywy montaż, ale zasilany wyłącznie atrapami → de facto martwa wartość.
### 1e. Wiring
| Funkcja | Endpoint | Tabela | Status |
|---|---|---|---|
| Referrals/KPI | `/api/referrals/*` | — | **503 na wszystko (stub)** |
### 1f. Flagi
| Flaga | Default | Wpływ |
|---|---|---|
| `journeyState === 'ECOSYSTEM_NODE'` | rzadki | warunek widoczności wpisu sidebar |
### 1g. Połączenia
- Brak realnych (moduł izolowany, nie zasila/nie czyta z innych).

## 2. Testy automatyczne (FAZA 2)
Brak istotnych testów (nic do pokrycia). Backlog: jeśli moduł budowany — testy dopiero przy implementacji.

## 3. Środowiska / Railway (FAZA 3)
**n/d (stub).** Na każdym środowisku zwróci 503. PENDING tylko formalnie.

## 4. Żywa weryfikacja frontu (FAZA 4)
**PENDING / n/d.** Widok zawsze pusty; jedyna „weryfikacja" = potwierdzenie pustki + 503 w sieci.

## 5. Kanony i standardy (FAZA 5)
n/d — brak funkcjonalności do oceny kanonowej.

## 6. Bezpieczeństwo i dostęp (FAZA 6)
- **Brak powierzchni ataku** — wszystkie endpointy 503; brak danych, brak zapisu, brak org-scope do złamania. Widok `requireAuth`. Zero findingów.

## 7. PLAN DOKOŃCZENIA (FAZA 8) — DECYZJA PRODUKTOWA
### Ścieżka A — WYCIĄĆ (rekomendowana jeśli brak roadmapy ekosystemu)
1. Usunąć `AffiliateDashboardView`, route `/affiliate`, `referrals.routes.ts`, atrapy `api.ts:12910-12915`, warunek sidebar `ECOSYSTEM_NODE` — Weryfikacja: 0 referencji, brak martwego route.
### Ścieżka B — ZBUDOWAĆ (jeśli ekosystem/affiliate w planie)
1. Realny `referrals.routes.ts` (CRUD poleceń + kody + KPI) na realnych tabelach — Weryfikacja: endpointy 200 z danymi.
2. Klient `api.ts` realny zamiast atrap — Weryfikacja: lista/kod z backendu.
3. Org-scope + auth na nowych endpointach (uniknąć wzorca side-router-weak-gate z M20/M24/M27) — Weryfikacja: testy cross-org/role.
4. Faza 4 żywa + testy.

### Definition of Done
- [ ] Decyzja właściciela: wyciąć czy budować (warunek wejścia do dalszych prac)
- [ ] (jeśli budować) pełny protokół V1 od nowa po implementacji

---
**Pozostałe do domknięcia audytu A1:** to nie audyt techniczny, lecz **decyzja produktowa**. Moduł jest uczciwym stubem (503 + jasny komunikat, bez fabrykacji). Rekomendacja: wyciąć, chyba że ekosystem/affiliate jest w roadmapie — wtedy budować od zera z org-scope od początku.
