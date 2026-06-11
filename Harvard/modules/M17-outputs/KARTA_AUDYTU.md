# M17 — Outputs (Outputs Library) — Karta audytu (Protokół V1)

**Data:** 2026-06-11 · **Branch:** `feat/deliverables-light` (commit `03175ed065`) · **Audytor:** Claude + agenci (KOD/TESTY/KANON+SEC)
**Wejścia:** _MODULE_MAP_V2 wpis M17 · inwentarz `Harvard/podzial/inventory/INV_E_outputs_studia_meeting.md` (sekcja OUTPUTS, poz.1-16) · poprzednia karta `docs/audit/2026-06-02/MODULE_09_outputs.md` (49/100) · finding v8-404 (`[[finding_staging_schema_drift_v8_404]]`)
**Evidence:** `Harvard/modules/M17-outputs/evidence/` (f1_code_truth.md, f2_tests_report.md, f2_tests.log, f56_kanon_sec.md)

## OCENA: 51/100 — Tier: Alpha · status 🟦 NIEPEŁNY (Fazy 3+4 do wykonania)

| Wymiar | Waga | Punkty | Uzasadnienie (1 zdanie) |
|---|---|---|---|
| A. Realność funkcji | 25 | 21 | 14/16 REALNE (większość za flagami, ale realne); 1 MARTWE (DEMO_*), register-in-outputs realny+skommitowany; czerwone flagi w większości obalone. |
| B. Wiring i dane | 15 | 12 | Rejestr org-scoped, export ledger, review/publish role-gated serwerowo, podwójna bramka v8 (global+org); czysto. |
| C. Testy automatyczne | 15 | 7 | 330 PASS/30 FAIL, ale FAIL-e to harness (i18n mock, 25 stale testów middleware vs cofnięta impl, fixture gap); **bramka aprobaty eksportu bez testu serwerowego**; nic w PR-gate. |
| D. Żywa użyteczność | 15 | 0 | Faza 4 niewykonana. |
| E. Kanony/UI | 10 | 6 | §27 wysoka zgodność (kanoniczne `FilterableTable`+`TableWithPreviewLayout`), ale brak persistKey, brak `EntityStatusChip`, hardkody kolorów, i18n 18× `isPolish?` inline. |
| F. Bezpieczeństwo/dostęp | 10 | 5 | Rejestr CZYSTY (brak IDOR), review/publish role-gated, ale **P1 public viewer wycieka org_id/confidentiality** + bramka eksportu governance tylko UI + beta-lock tylko nawigacyjny. |
| G. Środowiska (Railway) | 10 | 0 | Faza 3 niewykonana. |
| **Hard cap zastosowany?** | — | — | **Faza 4 niewykonana → max 70 + „NIEPEŁNY".** BRAK cap cross-org (rejestr org-scoped, zweryfikowane). Public-viewer leak to over-disclosure za tokenem (P1), nie IDOR. Suma 51 < 70. |

**Werdykt jednym akapitem:** Trzeci z rzędu moduł BEZ systemowego cross-org IDOR (po M02/M25) — rejestr artefaktów konsekwentnie org-scoped: `getArtifactForUser`/`getArtifactListItemRow` filtrują `WHERE a.organization_id=? AND a.artifact_id=?` (`artifactRegistryService.ts:1891`), lista `WHERE a.organization_id=?` (`:1944`), orgId zawsze z tokena — artefakt org B → 404. **Czerwona flaga v8-404 „cicha pustka" OBALONA**: przy `ENABLE_V8_GLOBAL` OFF API zwraca 404 JSON, ale FE go łapie i pokazuje panel błędu z retry (`useRapData.ts:807`→`OutputsAggregateTabContent.tsx:702`) — to baner błędu, nie niema pustka (lepiej niż finding twierdził; odstępstwo łagodne: komunikat generyczny „failed to load" zamiast dedykowanego „moduł wyłączony", P3). 14/16 pozycji REALNE (governance: trust-state 5 filarów, lineage, review/publish role-gated ADMIN/OWNER serwerowo, bramka eksportu z quality-gate serwerowym), DEMO_* potwierdzone martwe, register-in-outputs realny ze skommitowanym testem (teza „uncommitted" nieaktualna). **Najpoważniejszy finding: P1 over-disclosure w publicznym viewerze** — `GET /presentations/shared/:token` zwraca `normalizeDeckRow(row) = {...row}` (`presentations.routes.ts:412,621`), czyli CAŁY wiersz `presentation_decks` (`organization_id`, `created_by`, `confidentiality`, wewnętrzne ID, sam share_token) nieuwierzytelnionemu klientowi — kontrast z `/api/public/artifacts/:token`, który jawnie sanitizuje. Zweryfikowane osobiście. Drugorzędne: bramka APROBATY eksportu (publish-state) egzekwowana tylko w UI — serwer pilnuje quality-gate, ale nie publish-approval, więc obejście bezpośrednim API (P2); beta-lock tylko nawigacyjny (direct URL omija plate, P2); brak rate-limit/revoke na share decku (P2). Sufit oceny: niewykonane Fazy 3+4 (D=0, G=0).

---

## 0. Zakres i scenariusze krytyczne (FAZA 0)
**Checklist:** INV_E sekcja OUTPUTS, poz.1-16.
**Scenariusze krytyczne (7):**
1. **S1** — Lista artefaktów z rejestru `GET /api/artifacts` (za flagą V8).
2. **S2** — Filtry + liczniki per tab (7 zakładek taksonomii).
3. **S3** — Bramka eksportu za aprobatą (blokada bez `isExportApproved`).
4. **S4** — Review/publish flow (start-review + Approve&publish).
5. **S5** — Trust-state P18 (5 filarów) w preview.
6. **S6** — Akcje wierszowe (open `resolveArtifactOpenPath` / export / archive / template).
7. **S7** — Public share viewer (`/presentations/shared/:token`).
**Obowiązujące kanony:** **§27 — TAK** (główna tabela artefaktów + Templates) · CARD_CONTENT_FORMULA: **N/D** (biblioteka, nie produkuje kart) · wzorzec hubowy: `ReportsAndPresentationsHub` (ModuleHub) · gating: **beta-closed + backend `ENABLE_V8_GLOBAL`**.

## 1. Prawda kodu (FAZA 1)
> Raport: `evidence/f1_code_truth.md`. Werdykty 16/16: **REALNE 14 · MARTWE 1 (DEMO_*) · za flagami 4 (realne).**

### 1a. REALNE
- 7 zakładek (za flagą, `Hub.tsx:143`), filtry+liczniki z raw (`useRapData.ts:755`), table/grid+search, bramka eksportu **serwerowa** (`report-builder.routes.ts:180`, `presentations.routes.ts:1444`), review/publish (`artifacts.routes.ts:717,1002`), trust-state 5 filarów (`:226-297`), lineage (`:256`), akcje wierszowe (`buildActionTargetPayload:73`), Sheets tab (brak New CTA potwierdzony), Templates (active/draft/deprecated), Teresa→Outputs (za `ENABLE_DELIVERABLES_LIGHT`), Canvas register-in-outputs (`work-canvas.routes.ts:4424`, test skommitowany `2bb18aae0c`), wizard prezentacji, „New AI document", public viewer.

### 1b. MOCK / STUB
- Brak fabrykacji danych na żywej ścieżce.

### 1c. ZEPSUTE / WIDOCZNE-ALE-ZEPSUTE
- **[P2] Bramka aprobaty eksportu tylko UI** — serwer pilnuje quality-gate (`REPORT_NOT_READY_FOR_EXPORT` 409, `QUALITY_GATE_BLOCKED` 422), ale publish-approval (`publishState`/`validationState`) sprawdzany tylko w `OutputsAggregateTabContent.tsx:1000` (disable przycisku) → obejście API.
- **[P3] v8 OFF → komunikat generyczny** „failed to load" zamiast „moduł wyłączony".

### 1d. UKRYTE / MARTWY KOD
- **[MARTWY] DEMO_* w `useRapData.ts:187-389`** — blok komentarza, 0 konsumentów runtime → wytnij (demo idzie przez seed Atelier Toys za toggle).

### 1e. Wiring FE↔BE↔DB
| Funkcja | Endpoint/serwis | Tabela DB | Status |
|---|---|---|---|
| Lista/by-id artefaktów | `GET /api/artifacts` (`artifactRegistryService`) | artifact_registry | DZIAŁA (org-scoped; za v8) |
| Trust-state / lineage | `artifacts.routes.ts:226-297` | export_ledger, origin links | DZIAŁA |
| Review/publish | `artifacts.routes.ts:717,1002` | artifact_registry | DZIAŁA (role-gated ADMIN/OWNER) |
| Bramka eksportu | report-builder/presentations routes | quality state | DZIAŁA (quality serwerowo; approval tylko UI) |
| Canvas → Outputs | `work-canvas.routes.ts:4424` | artifact_registry + origin | DZIAŁA |
| Public deck share | `presentations.routes.ts:606` | presentation_decks | DZIAŁA (**over-disclosure P1**) |

### 1f. Flagi (realne defaulty RUNTIME)
| Flaga | Default | Runtime | OFF → | Kto włącza |
|---|---|---|---|---|
| `ENABLE_V8_GLOBAL` | OFF | `=== 'true'` | **404** (pre-auth `Gateway.ts:747` + post-auth `v8OutputsGate` `:40`); FE pokazuje panel błędu (nie niema pustka) | env Railway |
| `ENABLE_DELIVERABLES_LIGHT` + `VITE_` | OFF | `=== 'true'` | Teresa→Outputs nieaktywne; legacy | env |

### 1g. Połączenia międzymodułowe
| Kierunek | Moduł | Mechanizm | Status |
|---|---|---|---|
| WEJŚCIE ← | M02 Canvas | register-in-outputs (provenance) | DZIAŁA |
| WEJŚCIE ← | M01 Czat/Teresa | deliverables (`metadata.deliverable` + event) | DZIAŁA (za flagą) |
| WEJŚCIE ← | M18/M19/M20 studia | artefakty do rejestru | DZIAŁA |
| WYJŚCIE → | edytory natywne | `resolveArtifactOpenPath` (open) | DZIAŁA |
| WYJŚCIE → | pliki | eksport PDF/PPTX (za quality-gate) | DZIAŁA |
| WYJŚCIE → | public | `/presentations/shared/:token` | DZIAŁA (P1 over-disclosure) |

## 2. Testy automatyczne (FAZA 2)
> Raport: `evidence/f2_tests_report.md` · log: `f2_tests.log`.
**Uruchomienie (lokalnie @ `03175ed065`):** **330 PASS / 30 FAIL / 0 SKIP.**
| Grupa | PASS | FAIL |
|---|---|---|
| FE RAP component+unit+hooks (15) | 68 | 1 |
| BE registry+publish+runtime+gate (7) | 227 | 25 |
| BE integration routes+sqlite (3) | 35 | 4 |

**Root-cause 30 FAIL (wszystkie = defekt harnessu, nie produktu):**
- **mock-drift react-i18next** (1) — `ReportsAndPresentationsHub.canonicalDataPath`: `t(key,{defaultValue})` renderuje obiekt → crash (wzorzec M13/M14/M25).
- **stale testy middleware** (25) — `v8FeatureGate.middleware.test.ts` pisane pod utwardzony middleware **cofnięty w `9b794bb7f0`**; impl nie ma tych zachowań → `res.status is not a function`. **Decyzja: skasować lub przywrócić hardening.**
- **fixture gap `tp_tables`** (4) — testy podają nieseedowane `tableId` → serwis poprawnie fail-closed 409.

**Pokrycie scenariuszy:**
| Scenariusz | FE | BE | E2E | CI (PR-gate) | Luka |
|---|---|---|---|---|---|
| S1 lista z rejestru | ✓ | ✓ | ✓ | ✗ | tylko ścieżka ON |
| S2 filtry+liczniki | częśc. | częśc. | ✗ | ✗ | liczniki |
| S3 bramka eksportu | klient-only | ⚠️ tylko quality | ✗ | ✗ | **brak testu approval serwerowo** |
| S4 review/publish | częśc. | ✓ | ✗ | ✗ | — |
| S5 trust-state | częśc. | ✓ | ✗ | ✗ | — |
| S6 akcje wierszowe | ✓ | częśc. | ✗ | ✗ | — |
| S7 public viewer | ✗ | ⚠️ (`public-artifacts`=canvas, nie RAP) | ✗ | ✗ | **brak testu RAP share** |

**Pułapki:** cały moduł za flagą — testy wymuszają `v8OutputsGate→next()` (ON), nikt nie testuje OFF→404; S3 serwer pilnuje quality, NIE approval (luka bezpieczeństwa bez testu); `public-artifacts.routes.ts` to work-canvas, nie outputy RAP. **CI:** `test-suite.yml` tylko `[main,develop]`; default `Londyn` → **żaden test M17 nie gate'uje PR**.

**Backlog testowy:** [P0] T1 fix mock i18n; [P0] T2 decyzja o 25 stale testach middleware; [P0] T4 test serwerowej bramki eksportu (odrzuć export `draft`/`in_review`); [P1] T3 fixture `tp_tables`, T5 test OFF-path+IDOR; [P2] T6 viewer RAP, T7 liczniki, T8 E2E.

## 3. Środowiska / Railway (FAZA 3)
**Status: NIEWYKONANE (PENDING).** Smoke: `/api/artifacts` (ON), trust-state, review/publish, export-gate, `/presentations/shared/:token`. **Kluczowe:** wartość `ENABLE_V8_GLOBAL` na staging/prod (decyduje czy moduł żyje czy = panel błędu); migracje artifact_registry/export_ledger/presentation_decks.share_token. **Uwaga DB:** dev `.env` może wskazywać Railway PROD.
| Aspekt | Staging | Prod | Werdykt |
|---|---|---|---|
| Wdrożony commit / migracje / flagi / smoke / logi | — | — | PENDING |

## 4. Żywa weryfikacja frontu (FAZA 4 — Claude osobiście)
**Status: NIEWYKONANE (PENDING).** 7 scenariuszy; szczególnie: v8 OFF (czy user widzi błąd czy pustkę), S3 próba eksportu nieapprobowanego przez API (czy serwer odrzuca), S7 public viewer (czy w odpowiedzi sieciowej widać `organization_id`/`confidentiality` — P1), beta-lock direct URL.
| # | Scenariusz | Wynik | Dowód |
|---|---|---|---|
| S1–S7 | — | PENDING | evidence/f4_* |

## 5. Kanony i standardy (FAZA 5)
> Raport: `evidence/f56_kanon_sec.md`.
**§27 (tabela artefaktów, `OutputsAggregateTabContent.tsx:1020`):** kanoniczne `FilterableTable`+`TableWithPreviewLayout`. **Odstępstwa:**
- **[P3] H persistKey BRAK** — `FilterableTable` wspiera, wywołanie nie przekazuje → reset szerokości po reload.
- **[P2] J bulk/select** nieużyty (wsparcie jest).
- **[P2] O `EntityStatusChip`** — surowe kropki kolorów zamiast chipa.
- **[P2] P hardkody kolorów** (`blue-400`/`emerald-400`/`amber-400`, `:311-374`).
- **[P2] S i18n** — `useTranslation` + 18× `isPolish?` inline (mieszanka).
- **[P3] C** sort bez persistu.
**Wzorzec hubowy:** `ReportsAndPresentationsHub` ✅ zgodny (Menu 1/2/3, 7 zakładek, breadcrumbs, dynamic tabs). Kanon R1-R4: N/D (biblioteka linkuje do Report Buildera). CARD_CONTENT_FORMULA: N/D.
**Stany / cicha degradacja:** v8 OFF → panel błędu generyczny (nie niema pustka — lepiej niż finding); P3: brak dedykowanego baneru „moduł wyłączony".

## 6. Bezpieczeństwo i dostęp (FAZA 6)
> Raport: `evidence/f56_kanon_sec.md`. **Rejestr org-scoped czysty; główny finding = over-disclosure publicznego viewera.**
| Warstwa | Stan | Dowód |
|---|---|---|
| Org-scope rejestru | CZYSTY (brak IDOR) | `artifactRegistryService.ts:1891,1944` |
| Review/publish | role-gated serwerowo | `artifacts.routes.ts:1011` (ADMIN/OWNER) |
| Bramka eksportu | quality serwerowo / approval tylko UI | `OutputsAggregateTabContent.tsx:1000` |
| Public deck viewer | over-disclosure | `presentations.routes.ts:412,621` |
| Beta-lock | tylko nawigacyjny | `Sidebar.tsx:156` vs route bez beta-guarda |

**Findingi:**
- **[P1] SEC-4a: public viewer wycieka org_id/confidentiality** — `GET /presentations/shared/:token` → `normalizeDeckRow(row)={...row}` (`presentations.routes.ts:412,621`) zwraca cały wiersz `presentation_decks` (`organization_id`, `created_by`/`generated_by`, `confidentiality`, wewnętrzne ID, share_token) nieuwierzytelnionemu klientowi (FE czyta `row.organization_id` w `SharedPresentationView.tsx:70`). **Zweryfikowane osobiście.** Bounded tokenem 122-bit (nie IDOR/enumeracja), ale ujawnia metadane tenanta ponad potrzebę. Fix: whitelist pól jak `/api/public/artifacts`.
- **[P2] SEC-3: bramka aprobaty eksportu tylko UI** — serwer pilnuje quality, nie publish-approval → eksport nieapprobowanego artefaktu bezpośrednim API (org-scope+quality nadal chronią).
- **[P2] SEC-1: beta-lock tylko nawigacyjny** — `/presentations` ma `ProductionModuleGate` bez beta-guarda; direct URL omija plate BETA_LOCKED (API org-gated → brak wycieku danych, defense-in-depth).
- **[P2] SEC-4b/c: share decku bez rate-limit i bez revoke** — `/shared/:token` brak limitu (vs 30/min na `/api/public/artifacts`), brak unshare (link żyje do expiry ~7 dni); expired → 404 zamiast 410.

**OK (nie powielać/zaliczone):** rejestr org-scoped (brak IDOR — jak M02/M25); review/publish role-gated serwerowo; token 32-hex 122-bit nieenumerowalny; sekrety/PII w logach czyste.

## 7. PLAN DOKOŃCZENIA (FAZA 8)
### Fala 1 — Integralność (P1)
1. **`[INTEGRACJA — INTEGRACJE.md §C poz.9 / Sprint 7+ / W9]`** Sanityzacja public viewera — `/presentations/shared/:token` zwraca whitelistę pól (bez `organization_id`/`confidentiality`/wewnętrznych ID/tokenu). **NAPRAWIĆ RAZ RAZEM Z M19** (wspólny leak `presentations.routes.ts:412`), wzór `/api/public/artifacts` — Weryfikacja: odpowiedź sieciowa nie zawiera org/confidentiality.
2. **Serwerowa bramka aprobaty eksportu** — handlery eksportu odrzucają artefakt nie-`approved`/`published` (nie tylko quality) — Weryfikacja: export `draft` przez API → 403; test serwerowy (T4).
3. **Fix testów** — mock i18n (T1) + decyzja o 25 stale testach middleware (T2: skasuj lub przywróć hardening) — Weryfikacja: zielono, intencja jasna.

### Fala 2 — Domknięcie wartości (P2)
1. **Beta-guard na route** `/presentations` (nie tylko sidebar) — Weryfikacja: direct URL → plate BETA_LOCKED.
2. **Rate-limit + revoke** dla share decku; expired → 410 — Weryfikacja: limit działa, unshare unieważnia.
3. **Dedykowany baner „moduł wyłączony"** przy v8 OFF (zamiast „failed to load") — Weryfikacja: jasny komunikat.
4. **Wytnij DEMO_*** (`useRapData.ts:187-389`) — Weryfikacja: 0 referencji.

### Fala 3 — Jakość i kanony (P2/P3)
1. **§27** — persistKey, `EntityStatusChip`, tokeny kolorów, ujednolicić i18n (usunąć 18× `isPolish?`), włączyć bulk lub usunąć — Weryfikacja: §27 A-S czyste.
2. **CI** — testy server/ + PR-gate dla `Londyn` (systemowe) — Weryfikacja: testy biegną na PR.

### Definition of Done (odhaczane przy realizacji)
- [ ] 1. Testy auto FE+BE scenariuszy krytycznych (zwł. S3 approval, S7 viewer) zielone w CI
- [ ] 2. Żywa weryfikacja Claude'a: pełny skrypt Fazy 4 PASS z dowodami
- [ ] 3. Railway: `ENABLE_V8_GLOBAL` ustawiona i udokumentowana, smoke 200, czyste logi
- [ ] 4. Kanony: §27 bez odstępstw P1/P2
- [ ] 5. Zero WIDOCZNE-ALE-ZEPSUTE (DEMO_*, generyczny błąd v8)
- [ ] 6. Public viewer bez over-disclosure + bramka eksportu serwerowo

---
**Pozostałe do domknięcia audytu M17:** Faza 3 (Railway — `ENABLE_V8_GLOBAL`) + Faza 4 (żywe 7 scenariuszy). Blocker bezpieczeństwa = P1 over-disclosure public viewera (do sanityzacji); rejestr czysty. Inwentarz w 2 punktach STALE (v8-404 nie jest niemą pustką; register-in-outputs test skommitowany) — zaktualizować INV_E.
