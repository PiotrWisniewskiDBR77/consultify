# TECZKA A1 — Ecosystem / Affiliate Dashboard (aneks, DESCOPED — DP-4)

> **STATUS: DESCOPED.** Decyzja właściciela **DP-4 = WYCIĄĆ** (`_DECYZJE.md`, 2026-06-13, ROZSTRZYGNIĘTE): usunąć stub affiliate (brak roadmapy). Teczka NIE jest pogłębiana do „SUPER" — moduł nie wchodzi do wdrożenia-100; zachowana jako rekord decyzji + ścieżka egzekucji cięcia (Ścieżka A). Wzór: [`_WZORZEC_TECZKI.md`](_WZORZEC_TECZKI.md) · referencja: [`M13-inicjatywy.md`](M13-inicjatywy.md).

## 00 · Nagłówek
- **Moduł:** A1 Ecosystem/Affiliate Dashboard (aneks) · **Pula:** aneks
- **Ocena audytu:** 13/100 · **Tier:** Broken (świadomy STUB) · **Status:** 🟦 NIEPEŁNY (de facto: decyzja produktowa)
- **Żywy bloker:** brak (zero powierzchni ataku — wszystko 503). Pula nietestowana na żywo (nic do testowania poza pustką).
- **Właściciel:** Piotr · **Daty:** karta 2026-06-11 · teczka 2026-06-13
- **Karta:** `Harvard/modules/A1-affiliate/KARTA_AUDYTU.md` · **Evidence:** weryfikacja inline (plik:linia)
- **Kod (stan po Ścieżce A `b294bfb718`):** route/mount/atrapy/serwer `referrals.routes.ts` USUNIĘTE (grep = 0 ref). Pozostałość: `src/views/AffiliateDashboardView.tsx` (373 l.) — orphan na dysku, 0 importerów, niedostępny (do fizycznego usunięcia). *(skoryg. 2026-06-19: cytaty `AppRoutes.tsx:2336` / `referrals.routes.ts:12-20` / `api.ts:12910-12915` opisują stan SPRZED descope — już nieaktualne, kod usunięty.)*

## MAPA POKRYCIA (co już jest vs co dokłada teczka)
| Warstwa | Stan | Źródło (istnieje) | Co dokłada teczka |
|---|---|---|---|
| A Intencja | 🟡 | karta werdykt | hipotetyczny zakres (Ścieżka B) |
| B–E docelowe | 🔴 | — | N/D do czasu decyzji (stub) |
| F Epiki | 🟡 | karta §0 (hipotetyczne S1–S3) | epiki tylko Ścieżki B |
| G DoD | 🟢 | karta §0 | bramka NIE aplikuje do decyzji (niżej) |
| H Governance | 🟢 (dołożone) | karta werdykt | **Rejestr Wejść + Decyzja D-01** (niżej) |

---

## A · INTENCJA *(hipotetyczna — moduł nie działa)*
- **Job-to-be-done (zamierzony):** dashboard ekosystemu/affiliate — polecenia, kody referencyjne, KPI ekosystemu. **Realnie:** 0% funkcjonalności (klient zwraca puste, serwer 503 na wszystko).
- **Persony/role:** `requireAuth` + warunek sidebar `journeyState === 'ECOSYSTEM_NODE'` (dla większości userów niewidoczny, gdy widoczny — pusty).
- **Zakres v1:** brak (świadomy stub). **POZA v1:** całość — do rozstrzygnięcia D-01.
- **Metryka:** N/D — moduł nie dostarcza wartości w obecnym kształcie.

## B–E · STAN DOCELOWY
**N/D do czasu decyzji.** Pozytyw: to UCZCIWY stub — degraded-mode 503 z jasnym komunikatem (`type:'not_configured'`), bez fabrykacji KPI (kontrast z localStorage-fasadą M23 czy „real call fake feature" M18/M20). Brak danych, tabel, integracji. Jeśli Ścieżka B (budować): org-scope + auth + role OD POCZĄTKU na nowych endpointach (uniknąć side-router-weak-gate z M20/M24/M27).

## F · EPIKI *(tylko Ścieżka B — budować)*
- **EPIK B1:** realny `referrals.routes.ts` (CRUD poleceń + kody + KPI) na realnych tabelach + auth/role/org-scope od początku.
- **EPIK B2:** klient `api.ts` realny zamiast atrap; FE zasilane danymi.
- **EPIK B3:** pełny protokół V1 od nowa + Faza 4 żywa + testy cross-org/role.
*(Ścieżka A — wyciąć: usunąć view + route + `referrals.routes.ts` + atrapy + warunek sidebar; weryfikacja `grep` = 0 referencji.)*
*(skoryg. 2026-06-19: route/mount/atrapy usunięte (descope PRAWDA), ALE plik `src/views/AffiliateDashboardView.tsx` (373 l.) pozostał na dysku jako orphan, 0 importerów — do fizycznego usunięcia.)*

## G · JAKOŚĆ / DoD
**Bramka 6/6 NIE aplikuje się do czasu decyzji zakresu (D-01).** Po decyzji:
| # | Kryterium | Ścieżka A (wyciąć) | Ścieżka B (budować) |
|---|-----------|--------------------|--------------------|
| 1 | Front↔back | 0 referencji do martwego modułu | endpointy 200 z realnymi danymi, 0 atrap |
| 2 | Bezpieczeństwo | brak (wycięte) | org-scope+auth+role od początku, testy cross-org/role |
| 3 | i18n | — | `t()` PL/EN |
| 4 | Tokeny | — | Visual Standard |
| 5 | §27 | — | listy poleceń/KPI przez FilterableTable |
| 6 | E2E | — | S1 lista / S2 kod / S3 KPI zielone na `Londyn` |

## H · GOVERNANCE *(dołożone ogniwa)*

### 01 · Rejestr wejść (R1)
| ID | Źródło | Data | Treść (1 zd.) | → Luka/Decyzja |
|----|--------|------|----------------|----------------|
| W-01 | Karta audytu (werdykt) | 2026-06-11 | świadomy stub end-to-end, 503 na wszystko, atrapy klienckie; decyzja budować/wyciąć | D-01 |
| W-02 | **Uwagi żywe** | 2026-06-13 | **brak** — pula nietestowana na żywo; karta pusta funkcjonalnie | — |
| W-03 | Kod (weryfikacja inline) | 2026-06-11 | `referrals.routes.ts:12-20` catch-all 503; `api.ts:12910-12915` atrapy | D-01 |

### 02 · Stan obecny (prawda kodu) — karta §1
Serwer 503 catch-all (uczciwy, czytelny komunikat); klient hardkodowane atrapy (pusta lista/kod); view zamontowany ale zawsze pusty; sidebar warunkowy `ECOSYSTEM_NODE`. Zero powierzchni ataku.

### 03 · Rejestr luk
Brak luk technicznych do „dokończenia" — moduł nie ma funkcjonalności. **Jedyny pozostały dług (skoryg. 2026-06-19):** plik `src/views/AffiliateDashboardView.tsx` (373 l.) nie został fizycznie usunięty mimo descope — orphan na dysku, 0 importerów, niedostępny. Dług kosmetyczny (sweep porządkowy), nie luka funkcjonalna/security. Do fizycznego `rm`.

### 04 · Rejestr decyzji (R5)
| ID | Pytanie | Opcje | Właściciel | Termin | Status |
|----|---------|-------|------------|--------|--------|
| D-01 | A1 Ecosystem/Affiliate — co dalej? | **wyciąć** (rekomendacja audytu) / budować od zera | Piotr | 2026-06-13 | **WYKONANE Ścieżka A `b294bfb718` 2026-06-17** — usunięto referrals.routes.ts, referrals.validators.ts, Gateway import+mount, routes/index, AppRoutes redirect, ROUTES.AFFILIATE, AppView.AFFILIATE_DASHBOARD, useBreadcrumbs case, api.ts stubs, users.api.ts REFERRALS, TrialEntryView Ecosystem block, moduleHelpContent partner-referrals. grep = 0 referencji (pozostały: string 'AFFILIATE' w metrics = typ partnera M26, PartnerReferralService = live M26). **(skoryg. 2026-06-19: route/mount/atrapy usunięte = PRAWDA, ALE plik `src/views/AffiliateDashboardView.tsx` (373 l.) NIE został usunięty — istnieje na dysku jako orphan, 0 importerów, niedostępny; do fizycznego usunięcia. Pierwotna deklaracja „usunięto view" była fałszywa.)** |

### 05 · Flagi/rollout — brak; sidebar warunkowy `journeyState === 'ECOSYSTEM_NODE'`. Moduł poza fazami implementacyjnymi do czasu D-01.
### 06 · Ryzyka — Bez decyzji zakresu moduł trwa jako uczciwy, ale bezwartościowy stub zajmujący nawigację i kod; rekomendacja audytu: wyciąć, chyba że ekosystem/affiliate jest w roadmapie — wtedy budować od zera z org-scope/auth/role od początku.
### 07 · Log — 2026-06-13 (teczka): sformatowana do wzoru M13 jako krótka teczka stub; status czeka na D-01. Audyt 2026-06-11: 13/100 świadomy stub.

---

## Bramka teczki: stub — bramka 6/6 wstrzymana do D-01 (R5)
R1 wejścia pełne (karta + kod; uwagi żywe = brak, karta pusta funkcjonalnie) · R2 N/D (brak luk technicznych) · R3 stan zweryfikowany w kodzie (503 catch-all + atrapy) · R5 decyzja D-01 z właścicielem (termin TBD) · A–E = N/D (stub) · F epiki tylko Ścieżki B · G DoD warunkowe (per ścieżka). **Teczka kompletna jako stub-decyzja; egzekucja po D-01.**

**Ryzyko (1 zdanie):** Bez decyzji właściciela (D-01) A1 pozostaje uczciwym, ale bezwartościowym stubem zajmującym nawigację i kod — audyt rekomenduje wycięcie, chyba że ekosystem/affiliate wraca do roadmapy.

---

## EKRANY (inwentarz) — 2026-06-19

**Werdykt weryfikacji:** A1 = DESCOPED, Ścieżka A WYKONANA i potwierdzona w kodzie. Route/mount/atrapy/import usunięte (`grep` = 0 referencji live; jedyne trafienia w `server/dist/` = stale build artifacts, w `server/src/_backup/` = backup). KOREKTA do teczki: teczka twierdzi "usunięto view" — w rzeczywistości plik `src/views/AffiliateDashboardView.tsx` (373 l.) NADAL ISTNIEJE na dysku jako orphan (0 importerów, nigdzie nie zamontowany). Funkcjonalnie martwy (niedostępny), ale fizycznie nieusunięty. To kosmetyczny dług, nie luka funkcjonalna/security.

| Ekran | Cel | Plik komponentu | Stan |
|---|---|---|---|
| Affiliate Dashboard (orphan) | (był) dashboard ekosystemu/affiliate — KPI, kody, polecenia | `src/views/AffiliateDashboardView.tsx` | ORPHAN — 0 importerów, brak route, niedostępny; plik nieusunięty mimo deklaracji teczki |

**Liczba realnych (dostępnych) ekranów: 0.** Moduł wycięty z nawigacji. Pozostały plik źródłowy to martwy kod do fizycznego usunięcia (sweep porządkowy).
