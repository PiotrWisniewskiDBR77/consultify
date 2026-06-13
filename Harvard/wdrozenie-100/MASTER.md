# MASTER — Plan wdrożenia wszystkich modułów do stanu docelowego (100%)

**Data:** 2026-06-13 · **Branch:** `Londyn` · **Cel:** każdy moduł połączony przód z tyłem, w pełni gotowy (pełny szlif)
**Podstawa:** 27 kart audytu (`Harvard/modules/*/KARTA_AUDYTU.md`) · 16 uwag z testów żywych właściciela (`Harvard/UWAGI_TESTY_2026-06-13.md`) · 3 spece systemowe (`SPEC_ZADANIE_01/07/13`) · świeża inwentaryzacja luk (2026-06-13)
**Relacja do `MASTER_PLAN_DOKONCZENIA.md` (2026-06-11):** tamten dokument zamyka warstwę audytu (diagnoza + naprawy backendu, security). TEN dokument podnosi poprzeczkę z „Alpha/Beta-near" do **100% (front↔back spięte, zero fasad, pełne i18n, tokeny, §27, E2E w PR-gate)** i wplata 16 uwag z testów żywych, których audyt nie widział.

> **Czym jest ten plik:** SSOT planu DOKOŃCZENIA do stanu docelowego. Jeden master + 27 work-package'ów per moduł (`Harvard/wdrozenie-100/MXX-*.md`). Każdy work-package: stan obecny, luki FE/BE/integracja (z `plik:linia`), kroki, DoD, weryfikacja. Master spina sekwencję faz, zależności, bramki i kręgosłup.

---

## 0. Definicja „GOTOWE" (próg 100%, wspólny dla wszystkich modułów)

Moduł jest „w całości gotowy", gdy spełnia WSZYSTKIE 6 kryteriów (DoD globalny):

1. **Spięcie front↔back** — każdy przepływ działa E2E na realnych danych; zero fasad (in-memory zamiast DB), zero mocków w ścieżce produkcyjnej, zero martwych przycisków (404/401/no-op).
2. **Bezpieczeństwo** — zero żywych P0/P1 (cross-org IDOR, brak auth, RBAC bypass, data-loss); każda naprawa z testem regresji.
3. **i18n** — pełne PL/EN przez `t()`; koniec `isPolish`/inline/hardkodów EN.
4. **Tokeny kolorów** — koniec korupcji „rose" i hex; tokeny Visual Standard / `EntityStatusChip` / `c.*`.
5. **§27 (kanon tabel)** — wszystkie listy przez FilterableTable + Menu 1/2/3 (`docs/ui-standards/03-modules/TABLE_AND_PREVIEW_CANON.md`).
6. **E2E w PR-gate** — scenariusze S danego modułu zielone w CI na branchu `Londyn`.

Bramka modułu = 6/6. Bramka programu = wszystkie 27 modułów na 6/6 + smoke prod.

---

## 1. GDZIE JESTEŚMY (jednym ekranem)

- **Audyt Harvard:** zamknięty (27/27 kart, ~58 bugów PG/security naprawionych, schema staging+prod 0-drift, smoke renderu 27/27).
- **To NIE jest stan docelowy:** średnia kart ~52–63/100 (Alpha→Beta-near). Najwyżej M01 71, M10 69, M02/M16/M05/M06/M24 ~66.
- **Testy żywe 2026-06-13 (16 uwag):** ujawniły, że **wspólna warstwa sterująca (czat→canvas) pęka** — i wiele modułów ma fasady, martwe przyciski i niespięte przepływy, których smoke renderu nie złapał.
- **Kolejność realizacji:** **kręgosłup → klienci → reszta** (decyzja właściciela 2026-06-13).

---

## 2. ŻYWE BLOKERY (P0/P1 nienaprawione — odczyt z kart, NIE pamięć)

**Naprawione P0 (pula core, w audycie):** M01, M03, M10, M13, M14, M15, M16, M24, M27.

| Moduł | Bloker | Klasa | WP |
|---|---|---|---|
| M20 | cross-org IDOR na 4 ścieżkach (record-templates / form-submissions / row-policies / governed-models) — raw DB bez org-guard | **P0 security** | `M20-tabele-studio.md` |
| M05 | conflict-handler silent overwrite (409→podbicie baseVersion bez merge) + brak migracji `my_idea_map_snapshots` (wieczne 503) | **P0 struct** | `M05-ideas-zarzadzanie.md` |
| M07 | V8 mirror ID mismatch (serwer UUID ≠ klient) → DELETE/GET martwe | **P0 struct** | `M07-ideas-process-flow.md` |
| M09 | per-user dokument → multiplayer strukturalnie niemożliwy (2. uczestnik 404) | **P0 struct** | `M09-ideas-whiteboard.md` |
| M18 | wersje/komentarze/approvals = fasada in-memory (`Map`) → data-loss po restarcie | **P1 data-loss** | `M18-dokumenty.md` |
| M23 | `/api/competency/*` bez auth; `/organization-data/export` bez role-gate; Goals/Strategy w localStorage | **3×P1** | `M23-organizacja.md` |
| M06 | WS collab bez org-scope verify (Org B wchodzi do pokoju Org A po UUID) | **P1 security** | `M06-ideas-mind-map.md` |
| M10 | **PROD P0**: nagranie głosowe transkrybuje na ekranie, nie zapisuje (VTS wave 2 żywy) | **P0 prod** | `M10-wywiad.md` |
| M22 | `_actionDecisionRoutes` (1188 l. governance) importowane, nigdy nie mountowane | **P1 dead** | `M22-ai-os.md` |

---

## 3. KRĘGOSŁUP (warstwa systemowa — naprawić RAZ, podnosi N modułów)

Jeden fix tutaj odblokowuje wiele modułów. Spece: `SPEC_ZADANIE_01_chat_controller.md`, `_07_notebook_workspace.md`, `_13_interview_flow_approval.md`.

**Pliki wspólnej warstwy sterującej:**
`src/components/AIChat/UnifiedChatPanel.tsx`, `WorkCanvasDocumentPanel.tsx`, `documentIntentDetector.ts`, `canvasStreamIntentDetector.ts`, `CanvasArtifactSwitcher.tsx`; `src/store/slices/*` (useArtifactsStore); `src/utils/detectMessageLanguage.ts`; `src/components/MyWork/MyWorkHub.tsx`, `src/views/MyWorkHub` (organizer); backend `server/src/ai/persona.ts`, `server/src/services/ai/AIPipeline.ts`.

| ID | Temat | Promieniuje na | Stan |
|---|---|---|---|
| #1 | Czat steruje aplikacją (Tryb A/B/C) | M02, M18/M19/M20, M10/M13/M14/M15 | Tryb B ZROBIONY (commit Londyn 2026-06-13); Tryb A (function-calling) i Tryb C (konsolidacja artefaktów) do zrobienia |
| #4 | Język rozmowy PL→PL | każda rozmowa | ZROBIONE (recall detekcji PL) |
| #3 | Show reasoning realny (param modelu) | każda rozmowa | do zrobienia (`AIPipeline.ts:2052-2067`) |
| #6/#7/#10 | Trzeci panel + in-context open | M04, M03, M13 | #15 (CTA „Otwórz") ZROBIONE; #10 + workspace-rail = **P1-design, checkpoint projektowy** |

---

## 4. SEKWENCJA FAZ (kręgosłup → klienci → reszta)

> Każda faza = wykonanie na `Londyn` + testy + deploy staging na końcu fazy + **checkpoint do akceptacji**. Prod tylko za osobną zgodą.

### FAZA 0 — Kręgosłup
Cel: czat realnie steruje canvasem; PL→PL; reasoning widoczny; nawigacja in-context. → odblokowuje M02/M18/M19/M20 + globalny UX czatu.
**Bramka:** scenariusze S-A/S-B/S-C/S-D z `SPEC_ZADANIE_01` zielone na staging.

### FAZA 1 — Żywe blokery P0/P1
Cel: tabela z §2 wyczyszczona do zera. Każdy fix + test cross-org/regresji w PR-gate. M10-głos (PROD/VTS) = najwyższy priorytet.
**Bramka:** zero żywych P0/P1; staging smoke per moduł.

### FAZA 2 — Moduły klienckie do 100% (VTS / Apator / Elkomtech)
Zakres: **M10, M13, M15, M14, M01, M16**. Feature-completion + spięcie + szlif. SPEC_13 (wywiad flow), UWAGA #14/#16 (system inicjatyw).
**Bramka:** każdy z 6 na 6/6 DoD; staging smoke.

### FAZA 3 — Pozostałe moduły do 100%
Zakres: beta-reszta (**M02, M04, M12, M17, M19, M21**), Ideas (**M05, M06, M07, M08, M09**), internal (**M22, M23, M24, M26, M27**). M27 wymaga konta superadmin do pełnej weryfikacji (🟦).
**Bramka:** wszystkie 27 na 6/6 DoD.

### FAZA 4 — Przekrojowe sweepy (batchem, efektywniej niż 27×)
i18n (`isPolish`→`t()`, ~141 kluczy PL M14, hardkody EN), tokeny (korupcja rose, ~2237 hex), §27 (surowe tabele→FilterableTable), E2E w PR-gate (trigger CI na `Londyn` + włączyć istniejące suity: M08 137 testów, M06 spec).
**Bramka:** zero `isPolish`/rose/surowych tabel; E2E zielone w PR-gate.

### FAZA 5 — Domknięcie audytu + cutover
Żywa weryfikacja S3/S5/S6/S7 per moduł na staging → re-ocena wymiaru D w `_TRACKER.md`; `db:verify:schema:staging` (0 drift) → backup prod → **cutover Londyn→prod TYLKO za osobną zgodą**. Smoke prod; klienci nienaruszeni.

---

## 5. ZALEŻNOŚCI (co blokuje co)

- FAZA 0 (Tryb A/B) **przed** M02/M18/M19/M20 feature-work (deliverables idą przez kręgosłup).
- M18 persistence (P1) **przed** szlifem M17 Outputs (approval-gate czyta wersje).
- M05/M06 wspólna migracja `my_idea_map_snapshots`/`my_idea_activity` **przed** szlifem Ideas.
- M04 handoff (pół-martwy) **z** M21 (wspólna ścieżka handoff) — naprawiać razem.
- M14→M15 deep-link celuje w beta-closed Rezultaty — domknąć po otwarciu bety.
- E2E w PR-gate (Faza 4) — trigger CI dziś `main`/`develop`; dodać `Londyn` PRZED poleganiem na bramce E2E.

---

## 6. INDEKS WORK-PACKAGE'ÓW (27 modułów)

Każdy plik w `Harvard/wdrozenie-100/`. Format: stan obecny → luki FE/BE/integracja (`plik:linia`) → kroki → DoD (6 kryteriów) → weryfikacja → rozmiar.

| # | Moduł | WP | Pula | Rozmiar | Żywy bloker |
|---|---|---|---|---|---|
| M01 | Czat | `M01-czat.md` | core | M | — |
| M02 | Canvas | `M02-canvas.md` | beta | M | — |
| M03 | My Work — organizer | `M03-my-work-organizer.md` | core | M | — |
| M04 | Notatnik | `M04-notatnik.md` | beta | L | handoff pół-martwy (z M21) |
| M05 | Ideas — Zarządzanie | `M05-ideas-zarzadzanie.md` | ideas | M-L | **P0 struct** |
| M06 | Ideas — Mind Map | `M06-ideas-mind-map.md` | ideas | M | **P1 WS** |
| M07 | Ideas — Process Flow | `M07-ideas-process-flow.md` | ideas | M | **P0 struct** |
| M08 | Ideas — Table | `M08-ideas-table.md` | ideas | M | — |
| M09 | Ideas — Whiteboard | `M09-ideas-whiteboard.md` | ideas | L | **P0 struct** |
| M10 | Wywiad | `M10-wywiad.md` | core | M-L | **P0 prod (VTS)** |
| M12 | Audyty | `M12-audyty.md` | beta | M | — |
| M13 | Inicjatywy | `M13-inicjatywy.md` | core | M→L (i18n ~1820×) | — |
| M14 | Wdrożenie | `M14-wdrozenie.md` | core | L | — |
| M15 | Rezultaty | `M15-rezultaty.md` | beta | M | — |
| M16 | Finanse | `M16-finanse.md` | beta | M | — |
| M17 | Outputs | `M17-outputs.md` | beta | M | — |
| M18 | Dokumenty | `M18-dokumenty.md` | beta | M-L | **P1 data-loss** |
| M19 | Prezentacje | `M19-prezentacje.md` | beta | S-M | — |
| M20 | Tabele Studio | `M20-tabele-studio.md` | beta | L | **P0 security** |
| M21 | Meeting | `M21-meeting.md` | beta | M | — |
| M22 | AI OS | `M22-ai-os.md` | internal | M | **P1 dead** |
| M23 | Organizacja | `M23-organizacja.md` | internal | M | **3×P1** |
| M24 | Admin | `M24-admin.md` | internal | S-M | — |
| M25 | Ustawienia | `M25-ustawienia.md` | core | S | — |
| M26 | Portal Partnerski | `M26-portal-partnerski.md` | internal | S-M | — |
| M27 | SuperAdmin | `M27-superadmin.md` | internal | M | 🟦 wymaga konta superadmin |
| A1 | Affiliate (stub) | `A1-affiliate.md` | aneks | — | descoped/stub — do potwierdzenia |

> M11 Narzędzia — **descoped** (pusty szablon karty, brak realnego kodu). Nie planujemy.

---

## 7. Weryfikacja i bramki (jak udowadniamy „gotowe")

- Każda zmiana UI: preview (`preview_start`→`preview_snapshot`/`preview_screenshot`), dowód wizualny+logiczny. Nigdy „done" na tsc/eslint (per `rule_verify_before_claiming`).
- Każdy fix BE: test regresji/cross-org w PR-gate; `smoke:modules` 27/27 + statyczny kontrakt zielone.
- Per fala: deploy staging (`railway up`, branch Londyn) + smoke na `demo.consultify.ai`.
- Bramka prod: osobna zgoda, backup, `db:verify:schema`, smoke po cutover (per `feedback_prod_caution`).

## 8. Pułapki repo
- `.gitignore` łapie `FAZA*.md`, `/tests/`, `knowledge/` → `git add -f` gdy trzeba.
- `.railwayignore`: corpus-diry z wiodącym `/` (`/knowledge/`, `/Harvard/`) — inaczej wycina `src/views/knowledge/`.
- node-pg: bigint=string, jsonb=object → helpery `flagOn`/`parseMaybeJson` w `pgFlags.ts`.

---

## Postęp (aktualizuj przy zamykaniu fal)

| Faza | Status | Data | Dowód |
|---|---|---|---|
| 0 — Kręgosłup | W TOKU | — | Tryb B + język PL + #15 zrobione (commity Londyn 2026-06-13); reszta otwarta |
| 1 — Żywe blokery | OTWARTA | — | — |
| 2 — Klienci | OTWARTA | — | — |
| 3 — Reszta | OTWARTA | — | — |
| 4 — Sweepy | OTWARTA | — | — |
| 5 — Cutover | OTWARTA | — | — |
