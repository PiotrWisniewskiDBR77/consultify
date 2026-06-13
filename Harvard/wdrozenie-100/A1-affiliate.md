# WP A1 — Ecosystem / Affiliate Dashboard (aneks, STUB) · decyzja zakresu

**Pula:** aneks · **Karta:** `Harvard/modules/A1-affiliate/KARTA_AUDYTU.md` (ocena 13/100 — świadomy STUB) · **Rozmiar:** — (decyzja produktowa, nie naprawa) · **Żywy bloker:** brak (zero powierzchni ataku)
**Faza programu:** poza fazami implementacyjnymi do czasu decyzji właściciela · **Master:** `Harvard/wdrozenie-100/MASTER.md`

## 1. Stan obecny (jednym akapitem)
A1 to **świadomy stub end-to-end / descoped** — nie regresja, nie dług do naprawy, lecz **decyzja produktowa: budować albo wyciąć** (do potwierdzenia z właścicielem). Serwer `referrals.routes.ts:12-20` to jeden catch-all `res.status(503){type:'not_configured'}` — 503 na KAŻDY endpoint z czytelnym komunikatem; klient `api.ts:12910-12915` ma hardkodowane atrapy (pusta lista, pusty kod). `AffiliateDashboardView` zamontowany (`AppRoutes.tsx:2336`, `requireAuth`), ale wpis sidebar „Ecosystem Impact" pojawia się tylko gdy `journeyState === 'ECOSYSTEM_NODE'` — dla większości userów niewidoczny, a gdy widoczny — zawsze pusty. Pozytyw: to UCZCIWY stub (503 + jasny komunikat, bez fabrykacji KPI — kontrast z localStorage-fasadą M23 czy „real call fake feature" M18/M20). Zero powierzchni ataku.

## 2. Luki do DoD
Brak luk technicznych do domknięcia w obecnym kształcie — moduł nie ma działającej funkcjonalności do „dokończenia do 100%". Jedyny dług: zajmuje miejsce w nawigacji i kodzie bez wartości.

- (a) FRONTEND: `AffiliateDashboardView` zasilany wyłącznie atrapami → de facto martwa wartość.
- (b) BACKEND: `referrals.routes.ts` catch-all 503; brak tabel/danych.
- (c) INTEGRACJA/TESTY: brak istotnych testów (nic do pokrycia).

## 3. Kroki realizacji — DECYZJA PRODUKTOWA (warunek wejścia)
**Ścieżka A — WYCIĄĆ** (rekomendowana, jeśli brak roadmapy ekosystemu/affiliate):
1. Usunąć `AffiliateDashboardView`, route `/affiliate` (`AppRoutes.tsx:2336`), `referrals.routes.ts`, atrapy `api.ts:12910-12915`, warunek sidebar `ECOSYSTEM_NODE`. Weryfikacja: 0 referencji, brak martwego route.

**Ścieżka B — ZBUDOWAĆ** (jeśli ekosystem/affiliate w planie):
1. Realny `referrals.routes.ts` (CRUD poleceń + kody + KPI) na realnych tabelach.
2. Klient `api.ts` realny zamiast atrap.
3. Org-scope + auth + role na nowych endpointach OD POCZĄTKU (uniknąć wzorca side-router-weak-gate z M20/M24/M27).
4. Pełny protokół V1 od nowa + Faza 4 żywa + testy.

## 4. DoD (6 kryteriów — bramka 6/6)
Bramka NIE aplikuje się do czasu decyzji zakresu. Po decyzji:
1. **Front↔back:** (Ścieżka A) 0 referencji do martwego modułu; (Ścieżka B) endpointy 200 z realnymi danymi, zero atrap.
2. **Bezpieczeństwo:** (A) brak — wycięte; (B) org-scope + auth + role od początku, testy cross-org/role.
3. **i18n:** (B) `t()` PL/EN.
4. **Tokeny:** (B) Visual Standard.
5. **§27:** (B) listy poleceń/KPI przez FilterableTable.
6. **E2E w PR-gate:** (B) S1 lista poleceń / S2 kod / S3 KPI zielone na `Londyn`.

## 5. Weryfikacja
- (A) `grep` brak importów `AffiliateDashboardView`/`referrals.routes`; route `/affiliate` nieistniejący.
- (B) endpointy 200 z danymi; testy cross-org/role zielone.

## 6. Zależności
- Brak realnych połączeń międzymodułowych (moduł izolowany).
- **Warunek wejścia:** decyzja właściciela (wyciąć / budować) — bez niej WP pozostaje wstrzymany.
- Ryzyko jednym zdaniem: bez decyzji zakresu moduł trwa jako uczciwy, ale bezwartościowy stub zajmujący nawigację i kod — rekomendacja audytu: wyciąć, chyba że ekosystem/affiliate jest w roadmapie, wtedy budować od zera z org-scope od początku.
