# M19 — Prezentacje (Presentation Studio P20 / DeckBuilder) — Karta audytu (Protokół V1)

**Data:** 2026-06-11 · **Branch:** `feat/deliverables-light` (commit `7e081c090c`) · **Audytor:** Claude + agenci (KOD/TESTY/KANON+SEC)
**Wejścia:** _MODULE_MAP_V2 wpis M19 · inwentarz `Harvard/podzial/inventory/INV_E_outputs_studia_meeting.md` (sekcja PREZENTACJE, poz.1-16) · poprzednia karta `docs/audit/2026-06-02/MODULE_12_prezentacje.md` (58/100)
**Evidence:** `Harvard/modules/M19-prezentacje/evidence/` (f1_code_truth.md, f2_tests_report.md, f2_tests.log, f56_kanon_sec.md)

## OCENA: 55/100 — Tier: Alpha (górny — kandydat na Beta) · status 🟦 NIEPEŁNY (Fazy 3+4 do wykonania)

| Wymiar | Waga | Punkty | Uzasadnienie (1 zdanie) |
|---|---|---|---|
| A. Realność funkcji | 25 | 22 | 15/16 REALNE, **persistencja realna** (snapshoty→`presentation_deck_versions` migr.752, przeżywają restart — przeciwieństwo M18); jedyny STUB = collaborate (no-op UI). |
| B. Wiring i dane | 15 | 13 | Wersje/agent-history/analytics na realnych tabelach (migr.752/641/610), quality gate serwerowy; czysto. |
| C. Testy automatyczne | 15 | 8 | 293 PASS/0 FAIL, ale **15/21 testów integracyjnych = fałszywa zieleń** (`fetch localhost:3001` z `if(status!==201)return` bez serwera); S4/S5 niezweryfikowane; nic w PR-gate. |
| D. Żywa użyteczność | 15 | 0 | Faza 4 niewykonana. |
| E. Kanony/UI | 10 | 7 | **PresentationsHub §27 w pełni zgodny** (`TableWithPreviewLayout`+`EntityStatusChip` — najlepszy dotąd), MELS adapter OK, ale DeckBuilder 25× `isPolish`. |
| F. Bezpieczeństwo/dostęp | 10 | 5 | Org-scope CZYSTY (5. moduł), quality gate serwerowy, approval-ticket wzorcowy; ale P1 public viewer leak (wspólny z M17) + P2 `?overrideQualityGate` bez roli. |
| G. Środowiska (Railway) | 10 | 0 | Faza 3 niewykonana. |
| **Hard cap zastosowany?** | — | — | **Faza 4 niewykonana → max 70 + „NIEPEŁNY".** BRAK cap cross-org (org-scope czysty, zweryfikowane). Public viewer leak liczony w M17 (P1, zasięg potwierdzony na M19). Suma 55 < 70. |

**Werdykt jednym akapitem:** Piąty moduł z rzędu BEZ cross-org IDOR (`getOrgId` zawsze z tokena `:184`, 44× `AND organization_id=?`, 18/19 endpointów `:deckId` org-scoped) i — w przeciwieństwie do siostrzanego M18 — **z REALNĄ persystencją**: snapshoty wersji idą `dbRun(INSERT INTO presentation_deck_versions)` (`presentations.routes.ts:2161,2320`, migracja `752_p20_deck_version_and_history.sql` z FK+indeksami), GET/restore czytają realny `dbAll/dbGet`, agent-history (`presentation_ai_operations` migr.641) i analytics (`presentation_analytics` migr.610) też w DB — **przeżywają restart, brak fasady in-memory** (lokalne 5-min checkpointy są świadomie efemeryczne `persisted:false`, ale każdy autosave i tak pisze trwały wiersz). 15/16 pozycji REALNE: Home, pipeline V8 generacji (za `ENABLE_V8_GLOBAL`), DeckBuilder WYSIWYG (TipTap, undo/redo, autosave, Command Palette, present mode), MELS shell (default ON), motywy/brand kit, agent Teresa (accept/reject+revert), governance (audit-integrity, watchlist), eksporty PPTX/PDF/HTML/PNG z export-parity, Presentation Studio S5/S7 z **wzorcowym single-use approval-ticketem** (wiążącym org+user+fingerprint; `/generate` bez ticketu → 403). **Quality gate eksportu egzekwowany serwerowo** (`enforceQualityGateForExport`→422 na 4 ścieżkach + legal-hold + confidentiality — mocniej niż M17). Jedyny STUB: collaborate „Invite by email" (`ShareModal.tsx:134-171` — input bez `onChange`, przyciski bez `onClick`, czysty no-op). **Findingi bezpieczeństwa:** P1 public viewer `/presentations/shared/:token` zwraca `normalizeDeckRow={...row}` z `organization_id`/`confidentiality`/`created_by`/`share_token` nieuwierzytelnionemu klientowi — **TEN SAM endpoint/wada co M17** (własny dla prezentacji, liczony raz w M17, zasięg potwierdzony tu); **P2 `?overrideQualityGate=true` NIE jest role-gated** (zweryfikowane osobiście: `:1448` bierze flagę z query, `:366` omija blokadę bez sprawdzenia roli → każdy z `presentation_export` defeatuje governance jednym paramem); P2 beta-lock tylko nawigacyjny; P2 brak rate-limit/revoke na share; P3 analytics-beacon `/analytics/view` bez org. Sufit oceny: niewykonane Fazy 3+4 + częściowo iluzoryczna zieleń testów.

---

## 0. Zakres i scenariusze krytyczne (FAZA 0)
**Checklist:** INV_E sekcja PREZENTACJE, poz.1-16.
**Scenariusze krytyczne (8):**
1. **S1** — Home modułu (Nowe/Ostatnie/Zapisane, grid szablonów).
2. **S2** — Generacja decka pipeline V8 (`/api/artifact-runs`, za flagą).
3. **S3** — DeckBuilder WYSIWYG edycja + autosave.
4. **S4** — Historia wersji snapshot + restore (trwałość serwerowa).
5. **S5** — Quality gate eksportu (`canExport=false` blokada).
6. **S6** — Agent Teresa edit accept/reject + revert/bulk-revert.
7. **S7** — Share + publiczny viewer + analityka.
8. **S8** — Eksporty PPTX/PDF/HTML/PNG + export-parity.
**Obowiązujące kanony:** §27 — **TAK** (PresentationsHub) · CARD_CONTENT_FORMULA: **N/D** (edytor slajdów) · wzorzec: **MELS** (DeckBuilder, default ON) + KimiWorkspaceShell (PrezentacjeView) · gating: beta-closed; pipeline za `ENABLE_V8_GLOBAL`.

## 1. Prawda kodu (FAZA 1)
> Raport: `evidence/f1_code_truth.md`. Werdykty 16/16: **REALNE 15 · STUB 1 (collaborate).** Brak ZEPSUTE/MARTWE.

### 1a. REALNE (zweryfikowane)
- Home, pipeline V8 (za flagą), auto-trigger, reopen+trust badge, intent-routing, **quality gate serwerowy** (`:358-383,1586`→422), DeckBuilder WYSIWYG, MELS shell (default ON), motywy/brand, **historia wersji w realnej DB** (`:2161,2320`, migr.752), share+analityka, agent Teresa, governance, eksporty, Presentation Studio S5 (approval-ticket).

### 1b. MOCK / STUB
- **[P3] Collaborate „Invite by email" + permisje** — `ShareModal.tsx:134-171` czysty no-op UI (input bez `value/onChange`, przyciski bez `onClick`, brak API). Zakładki share/export/embed wpięte.

### 1c. ZEPSUTE / WIDOCZNE-ALE-ZEPSUTE
- Brak (persistencja realna, w odróżnieniu od M18).

### 1d. UKRYTE / MARTWY KOD
- Presentation Studio S5/S7 (`/presentation-studio`) — UKRYTE (tylko URL), DZIAŁA (świadome).

### 1e. Wiring FE↔BE↔DB
| Funkcja | Endpoint/serwis | Tabela DB | Migracja | Status |
|---|---|---|---|---|
| Snapshoty wersji | `presentations.routes.ts:2161,2320` | presentation_deck_versions | `752_*` | DZIAŁA (real, przeżywa restart) |
| Agent-history | agent-edit ops | presentation_ai_operations | 641 | DZIAŁA (real) |
| Analytics | share analytics | presentation_analytics | 610 | DZIAŁA (real) |
| Generacja | `/api/artifact-runs` | artifact runs | — | DZIAŁA (za `ENABLE_V8_GLOBAL`) |
| Quality gate eksportu | `enforceQualityGateForExport:358` | quality state | — | DZIAŁA (serwerowo 422; **override bez roli P2**) |
| Public share | `/presentations/shared/:token` | presentation_decks | — | DZIAŁA (**over-disclosure P1, wspólny z M17**) |

### 1f. Flagi
| Flaga | Default | OFF → | Uwaga |
|---|---|---|---|
| `ENABLE_V8_GLOBAL` | OFF | **404** `V8_DISABLED` (`v8FeatureGate:15`) | tylko pipeline generacji; reszta modułu nie-za-flagą |
| `melsDeckBuilder` (`?ff_`) | **ON** | UI-swap shell | `DeckBuilderMelsView` = adapter `ExecutiveModuleShell` |

### 1g. Połączenia międzymodułowe
| Kierunek | Moduł | Mechanizm | Status |
|---|---|---|---|
| WYJŚCIE → | M17 Outputs | rejestracja decka + reopen `?artifactId=` | DZIAŁA |
| przekrój | M01 Czat/Teresa | agent-edit w deckach + auto-trigger z czatu | DZIAŁA |
| WYJŚCIE → | pliki | eksport PPTX/PDF/HTML/PNG (za quality gate) | DZIAŁA |
| WYJŚCIE → | public | `/presentations/shared/:token` viewer | DZIAŁA (P1 over-disclosure) |

## 2. Testy automatyczne (FAZA 2)
> Raport: `evidence/f2_tests_report.md` · log: `f2_tests.log`.
**Uruchomienie (lokalnie @ `7e081c090c`):** **293 PASS / 0 FAIL / 0 SKIP.**
| Grupa | PASS | FAIL |
|---|---|---|
| BE serwisy (11) | 66 | 0 |
| BE route/pipeline (4) | 167 | 0 |
| FE comp+unit (5) | 39 | 0 |
| Integration p20 (4) | 21 | 0 |

**Krytyczny haczyk — fałszywa zieleń:** Grupa D przeszła 21/21 w 0,68 s **bez serwera**; **15/21 testów** (p20-lifecycle, export-resilience, confidentiality) to `fetch(localhost:3001)` z bramkami `if(status!==201)return` → bez serwera asercje nie wykonują się, test przechodzi pusto. Tylko 6/21 to realne testy czystych funkcji. **Trwałość snapshotów (S4) jest realna w kodzie, ale niezweryfikowana żadnym uruchamianym testem** (rewert testuje tylko `evaluateRevertEligibility`, nie dotyka DB).

**Pokrycie scenariuszy:**
| Scenariusz | FE | BE | E2E | PR-gate | Luka |
|---|---|---|---|---|---|
| S1 home | częśc. | — | spec/nie-CI | ✗ | — |
| S2 pipeline V8 | — | ✓ | spec/nie-CI | ✗ | ścieżka flag OFF |
| S3 DeckBuilder autosave | render | endpoint bez testu | vacuous | ✗ | **autosave+409 nietestowane** |
| S4 snapshot+restore | — | tylko eligibility | vacuous | ✗ | **round-trip DB nietestowany** |
| S5 quality gate | — | logika (DB mock) | spec/nie-CI | ✗ | **brak testu route 422** |
| S6 agent Teresa | — | in-memory | — | ✗ | brak pętli na DB |
| S7 share+viewer | — | vacuous 403 | spec/nie-CI | ✗ | **viewer/token bez testu** |
| S8 eksporty | pptx-layouts | **mocne** (parity 21, presModel 90) | spec/nie-CI | ✗ | brak realnego pliku |

**CI:** `test-suite.yml` tylko `[main,develop]`; default `Londyn`; joby „Deferred" + testy `server/` nie w shardach root → **PR-gate M19 ≈ 0**.

**Backlog testowy:** [P0] integracja sqlite round-trip autosave→snapshot→restore (S4); [P0] route test export `canExport=false`→422 + override (S5); [P0] naprawa 15 vacuous testów p20 (realny webServer lub skreślić); [P1] autosave 409, share token+viewer, pętla Teresa na DB; [P2] testy server/ + E2E do CI.

## 3. Środowiska / Railway (FAZA 3)
**Status: NIEWYKONANE (PENDING).** Smoke: generacja (ON), autosave→snapshot→restore (cold-start trwałość — oczekiwane TAK, real DB), export 422 bez quality, public viewer. **Kluczowe:** wartość `ENABLE_V8_GLOBAL` (decyduje o generacji); migracje 752/641/610 zastosowane?. **Uwaga DB:** dev `.env` może wskazywać Railway PROD.
| Aspekt | Staging | Prod | Werdykt |
|---|---|---|---|
| Wdrożony commit / migracje / flagi / smoke / logi | — | — | PENDING |

## 4. Żywa weryfikacja frontu (FAZA 4 — Claude osobiście)
**Status: NIEWYKONANE (PENDING).** 8 scenariuszy; szczególnie: S4 snapshot po reload+restart (potwierdzić realną trwałość), S5 export z `?overrideQualityGate=true` na koncie nie-admina (czy omija gate — P2), S7 odpowiedź sieciowa public viewera (czy `organization_id`/`confidentiality` widoczne — P1), collaborate (czy przyciski martwe).
| # | Scenariusz | Wynik | Dowód |
|---|---|---|---|
| S1–S8 | — | PENDING | evidence/f4_* |

## 5. Kanony i standardy (FAZA 5)
> Raport: `evidence/f56_kanon_sec.md`.
**§27 (PresentationsHub):** **W PEŁNI ZGODNY** — kanoniczny `TableWithPreviewLayout` (`:608`), `EntityStatusChip` (`:269`), `RowActionsMenu`, kolumny i18n, jawne odwołanie do canon §9.2 (`:303`). **Najlepsza zgodność §27 w audycie.** Pozostałe powierzchnie (DeckBuilder WYSIWYG, panele) — N/D uzasadnione.
**MELS:** `DeckBuilderMelsView` = adapter `ExecutiveModuleShell`, default ON — zgodny.
**i18n:** **[P2] `DeckBuilder.tsx` 25× `isPolish`** (ternary zamiast `t()`, gorszy wariant anti-patternu M17 ~18×); DeckBuilderTopBar/Hub czyste.
**UI-standards:** **[P3]** hardkody kolorów w 10/30 plików DeckBuilder.
**Stany:** pokryte; `GET /decks` bez schematu → `{data:[],unavailable:true}` (nie 500); M19 **NIE za `ENABLE_V8_GLOBAL`** (poza pipeline) → brak ryzyka niemej pustki.
**CARD_CONTENT_FORMULA:** N/D potwierdzone.

## 6. Bezpieczeństwo i dostęp (FAZA 6)
> Raport: `evidence/f56_kanon_sec.md`.
| Warstwa | Stan | Dowód |
|---|---|---|
| Org-scope (by-id) | CZYSTY (18/19) | `getOrgId:184`; autosave `:2171`, agent-edit `:2190`, share `:1816`, versions/restore |
| Quality gate eksportu | serwerowy | `enforceQualityGateForExport:358`→422 (4 ścieżki) |
| Approval-ticket S5/S7 | wzorcowy | single-use, org+user+fingerprint, `/generate` bez → 403 |
| Public viewer | over-disclosure | `presentations.routes.ts:412,606` (wspólny z M17) |

**Findingi:**
- **[P1] public viewer over-disclosure (wspólny z M17)** — `GET /presentations/shared/:token`→`normalizeDeckRow={...row}` (`:412,606`) wycieka `organization_id`/`confidentiality`/`created_by`/`share_token` nieuwierzytelnionemu; FE czyta `row.organization_id` (`SharedPresentationView.tsx:70`). DeckBuilder/P20 NIE ma osobnego viewera. **Liczony raz (M17), zasięg potwierdzony na M19.** Fix wspólny: whitelist pól.
- **[P2] `?overrideQualityGate=true` bez roli** — `:1448` flaga z query, `enforceQualityGateForExport:366` omija blokadę bez sprawdzenia roli (funkcja nie bierze `role`). **Zweryfikowane osobiście.** Każdy z `presentation_export` defeatuje governance jednym paramem. Fix: ogranicz override do ADMIN/OWNER.
- **[P2] beta-lock tylko nawigacyjny** — `/prezentacje`, `/builder`, `/presentation-studio` tylko `ProtectedRoute`/`ProductionModuleGate`; direct URL omija plate.
- **[P2] share bez rate-limit i revoke** — `/shared/:token` bez limitu, brak unshare (link żyje do expiry).
- **[P3] analytics-beacon cross-org** — `POST /decks/:deckId/analytics/view` (`:5923`) `WHERE id=?` bez org (auth-only write telemetrii; nie ujawnia treści).

**OK/czyste:** org-scope (brak IDOR — kohorta M02/M25/M17/M18); quality gate serwerowy; approval-ticket; persistencja realna; sekrety/PII w logach czyste.

## 7. PLAN DOKOŃCZENIA (FAZA 8)
### Fala 1 — Integralność (P1)
1. **`[INTEGRACJA — INTEGRACJE.md §C poz.9 / Sprint 7+ / W9]`** Sanityzacja public viewera (wspólne z M17) — **NAPRAWIĆ RAZ RAZEM Z M17** — whitelist pól w `/presentations/shared/:token` (`presentations.routes.ts:412,606`) — Weryfikacja: odpowiedź bez org/confidentiality/token.
2. **Role-gate `overrideQualityGate`** — override tylko ADMIN/OWNER (przekaż rolę do `enforceQualityGateForExport`) — Weryfikacja: nie-admin z `?overrideQualityGate=true` → 422/403.
3. **Naprawa fałszywej zieleni** — 15 vacuous testów p20 (realny webServer/supertest lub skreślić); test round-trip snapshotów na DB (S4) + route 422 (S5) — Weryfikacja: testy realnie asertują, dotykają DB.

### Fala 2 — Domknięcie wartości (P2)
1. **Collaborate** — wpiąć handlery „Invite by email"+permisje lub ukryć zakładkę — Weryfikacja: zaproszenie działa albo znika.
2. **Beta-guard na route** + rate-limit/revoke na share — Weryfikacja: direct URL → plate; revoke unieważnia.
3. **Org-scope na analytics-beacon** — Weryfikacja: cross-org view → odrzucony/scoped.

### Fala 3 — Jakość i kanony (P2/P3)
1. **i18n DeckBuilder** — `t()` zamiast 25× `isPolish` — Weryfikacja: PL/EN komplet.
2. **Tokeny kolorów** (10/30 plików DeckBuilder) — Weryfikacja: lint czysty.
3. **CI** — testy server/ + E2E prezentacji + `pull_request:[Londyn]` (systemowe) — Weryfikacja: biegnie na PR.

### Definition of Done (odhaczane przy realizacji)
- [ ] 1. Testy auto FE+BE scenariuszy krytycznych (zwł. S4 realny DB, S5 route 422) zielone w CI — bez fałszywej zieleni
- [ ] 2. Żywa weryfikacja Claude'a: pełny skrypt Fazy 4 PASS z dowodami
- [ ] 3. Railway: migracje 752/641/610 + flagi + smoke 200 + czyste logi
- [ ] 4. Kanony: i18n DeckBuilder, tokeny kolorów
- [ ] 5. Zero WIDOCZNE-ALE-ZEPSUTE (collaborate)
- [ ] 6. Public viewer bez over-disclosure + override role-gated

---
**Pozostałe do domknięcia audytu M19:** Faza 3 (Railway) + Faza 4 (żywe 8 scenariuszy). Blockery bezpieczeństwa: P1 public viewer (wspólny z M17 — naprawić raz dla obu) + P2 override-bez-roli. Persistencja realna (przeciwieństwo M18), §27 wzorcowy — moduł silny; po Fazach 3/4 realnie Beta.
