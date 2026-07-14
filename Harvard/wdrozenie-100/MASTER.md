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
7. **Zgodność komponentów ze standardem UI/UX** — każdy komponent modułu audytowany vs SSOT i bez odstępstw P0/P1: `docs/ui-standards/CONSULTIFY_UI_UX_GOLDEN_STANDARD.md` + `UI_UX_CANON_V3.md` · `00-foundation` (kolory/tokeny/dark-mode) · `01-shell-layout` (MELS/`ExecutiveModuleShell`) · `02-components` (prymitywy: `EntityStatusChip`, `FilterableTable`, chipy/menu) · `03-modules` (§27) · `docs/standards/VISUAL_STANDARD.md` + `CARD_CONTENT_FORMULA.md`.

Bramka modułu = 7/7. Bramka programu = wszystkie 27 modułów na 7/7 + smoke prod.

---

## 0a. Procedura pracy per moduł (build → zgodność → test → odbiór) — pętla autonomiczna

Każdy moduł przechodzi pełną pętlę; pętla chodzi samodzielnie, pauzuje tylko na twardy bloker lub nieodwracalną decyzję (drobne → wg `_DECYZJE.md`, logowane).

1. **Buduj** (Londyn) — luki z teczki (rejestr luk + epiki F).
2. **Analiza zgodności komponentów ze standardem** *(osobny krok PRZED testem — łapie inną klasę problemów niż test funkcjonalny)*: przejdź komponenty modułu, każdy oceń vs SSOT (kryt. 7) → **tabela per-komponent: zgodny / odstępstwo (`plik:linia` + który standard)** → napraw odstępstwa P0/P1. Obejmuje: tokeny vs hex/„rose", `EntityStatusChip` na statusy, `FilterableTable`+§27 na listy, MELS/`ExecutiveModuleShell` jako powłoka, `t()` i18n, dark-mode/a11y, `CARD_CONTENT_FORMULA` na kartach.
3. **Test lokalny** (trolley, świeży kod): scenariusze S z teczki w przeglądarce — przód (DOM/konsola/network) + tył (logi). Dowód = screenshot.
4. **Fix w pętli** aż zielone (funkcja + zgodność).
5. **Raport odbioru**: co działa, screenshoty, **wynik zgodności komponentów**, decyzje (logowane), pozostałe luki.
6. **Deploy na staging** → odbiór właściciela (async, gdy ma zasięg).

> Auto/zasięg: gdy maszyna działa — lecę modułami i zostawiam raporty; gdy padnie (brak prądu/sieci) — pauza bez utraty stanu, wznowienie od ostatniego modułu.

---

## 1. GDZIE JESTEŚMY (jednym ekranem)

- **Audyt Harvard:** zamknięty (27/27 kart, ~58 bugów PG/security naprawionych, schema staging+prod 0-drift, smoke renderu 27/27).
- **To NIE jest stan docelowy:** średnia kart ~52–63/100 (Alpha→Beta-near). Najwyżej M01 71, M10 69, M02/M16/M05/M06/M24 ~66.
- **Testy żywe 2026-06-13 (16 uwag):** ujawniły, że **wspólna warstwa sterująca (czat→canvas) pęka** — i wiele modułów ma fasady, martwe przyciski i niespięte przepływy, których smoke renderu nie złapał.
- **Kolejność realizacji:** **kręgosłup → klienci → reszta** (decyzja właściciela 2026-06-13).

---

## 2. ŻYWE BLOKERY — po weryfikacji R3 w kodzie (2026-06-13)

> **AKTUALNOŚĆ (stan 2026-06-19):** ta sekcja opisuje stan z 2026-06-13. Po ponownej weryfikacji dokumentacji przeciw kodowi — patrz [`_WERYFIKACJA_DOKUMENTACJI_2026-06-19.md`](_WERYFIKACJA_DOKUMENTACJI_2026-06-19.md) — żywe blokery §2a **M07 i M09 są ZAMKNIĘTE** (M07: L-01 V8 mirror = DP-7 CUT 2026-06-17; M09: L-01 multiplayer = `5928262e0f`/`org-read fallback`, decyzja realtime=v1, shared-WRITE → v1.1). Pozycje §2b (M05/M06/M20) są zweryfikowane jako naprawione w kodzie (pozostaje cold-start/test regresji). Jedyny realnie otwarty żywy bloker = **M10 głos/STT (PROD/VTS), wymaga `OPENAI_API_KEY` na Railway centerbeam + zgody Piotra.** Statusy poniżej zachowane jako rekord 2026-06-13.
>
> **Kluczowa korekta (2026-06-13):** teczki zweryfikowały każdy „bloker" w kodzie (R3: dowód > dziedziczenie). **Większość była już naprawiona albo nieaktualna.** Realnie żywe = **3** (nie 9). Faza 1 znacząco mniejsza, niż sugerowały karty.

**Naprawione P0 (pula core, w audycie):** M01, M03, M10, M13, M14, M15, M16, M24, M27.

### 2a. REALNIE ŻYWE (do naprawy w Fazie 1)
| Moduł | Bloker | Klasa | WP |
|---|---|---|---|
| M07 | ~~V8 mirror ID mismatch → DELETE/GET martwe~~ **ZAMKNIĘTE 2026-06-19: DP-7 CUT (wycięto mirror, blob-sync działa)** | ~~P0 struct~~ | `M07-ideas-process-flow.md` |
| M09 | ~~per-user dokument → multiplayer niemożliwy (2. uczestnik 404)~~ **ZAMKNIĘTE 2026-06-19: `5928262e0f` org-read fallback (200), realtime=v1; shared-WRITE → v1.1** | ~~P0 struct~~ | `M09-ideas-whiteboard.md` |
| M10 | **PROD P0**: głos w wywiadzie nie zapisuje (VTS żywy); FE-fix **ZACOMMITOWANY `1522f3de32`**; **BLOKUJĄCE: server STT = OPENAI_API_KEY na Railway centerbeam (wymaga zgody Piotra)** | **P0 prod** | `M10-wywiad.md` |

### 2b. DO WERYFIKACJI ŻYWEJ (kod naprawiony — potwierdzić apply/runtime)
| Moduł | Stan | WP |
|---|---|---|
| M05 | conflict-handler naprawiony (`0b81310448`); migracja `my_idea_map_snapshots` — plik istnieje, **apply na prod (centerbeam ~2026-05-18) niepewny** → cold-start verify | `M05-ideas-zarzadzanie.md` |
| M06 | WS org-scope naprawiony w gateway (`ideaCollabWs.gateway.ts:237`); potwierdzić translację placeholderów `?`→PG w runtime | `M06-ideas-mind-map.md` |
| M20 | cross-org IDOR (4 ścieżki) **NAPRAWIONE `e9c6cb9c0a`** (ancestor HEAD) → zostaje tylko **test regresji** cross-org | `M20-tabele-studio.md` |

### 2c. ZDJĘTE z blokerów (R3 — naprawione/STALE, dowód w teczkach)
- **M18** „data-loss in-memory" → **NAPRAWIONE w kodzie (2026-06-13, ten program)**: 6/8 warstw przepisanych z Map na Postgres write-through — migracje `780` (approvals) + `781` (content-blocks/brand-voice/audience/source-packs/share-links, 10 tabel). Wszystkie 6 DAO: 0 `new Map`, INSERT+UPSERT, org-scope, eksporty 1:1 (swap mechaniczny, serwisy bez zmian), tsc documentStudio czysty. **Pozostaje cold-start proof na staging** (R6/Faza 4). Commity `953955bc2b`+`8d2b5d8cf4`.
- **M23** „3×P1" → **NAPRAWIONE**: competency `verifyToken+requireRole`, export `requireRole`, Goals backend per-org (`organization-context-store`).
- **M22** „`_actionDecisionRoutes` martwy/niemountowany" → **USUNIĘTY** (0 wystąpień w `Gateway.ts`; karta podwójnie nieaktualna).
- **M19** „override bez roli" → **STALE**: `presentations.routes.ts:1465` role-gated (`['ADMIN','OWNER','SUPERADMIN']`).
- **M21** „dead-path `notebook_entries`" → nieścisłe: INSERT do `notebook_pages` (istnieje, mig. `20260306`); zostaje cold-start proof.

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

Każdy plik w `Harvard/wdrozenie-100/` = pełna teczka 8 warstw (00 nagłówek · MAPA POKRYCIA · A intencja · B UX docelowe · C dane+API+reguły · D AI/Teresa · E integracje · F epiki→stories · G DoD/jakość · H governance) wg [`_WZORZEC_TECZKI.md`](_WZORZEC_TECZKI.md). Kolumna „Status blokera" odzwierciedla weryfikację R3 (✅=naprawione, STALE=nieaktualny finding karty, ŻYWY=do naprawy).

| # | Moduł | WP | Pula | Rozmiar | Status blokera (po R3) |
|---|---|---|---|---|---|
| M01 | Czat | `M01-czat.md` | core | M | — |
| M02 | Canvas | `M02-canvas.md` | beta | M | — |
| M03 | My Work — organizer | `M03-my-work-organizer.md` | core | M | — |
| M04 | Notatnik | `M04-notatnik.md` | beta | L | handoff pół-martwy (z M21) |
| M05 | Ideas — Zarządzanie | `M05-ideas-zarzadzanie.md` | ideas | M-L | do weryfikacji (kod `0b81310448`; apply migracji?) |
| M06 | Ideas — Mind Map | `M06-ideas-mind-map.md` | ideas | M | do weryfikacji (WS org-scope naprawiony) |
| M07 | Ideas — Process Flow | `M07-ideas-process-flow.md` | ideas | M | ✅ ZAMKNIĘTE 2026-06-19 (V8 mirror — DP-7 CUT) |
| M08 | Ideas — Table | `M08-ideas-table.md` | ideas | M | — |
| M09 | Ideas — Whiteboard | `M09-ideas-whiteboard.md` | ideas | L | ✅ ZAMKNIĘTE 2026-06-19 (multiplayer — `5928262e0f` org-read; shared-WRITE→v1.1) |
| M10 | Wywiad | `M10-wywiad.md` | core | M-L | **P0 prod (VTS)** |
| M12 | Audyty | `M12-audyty.md` | beta | M | — |
| M13 | Inicjatywy | `M13-inicjatywy.md` | core | M→L (i18n ~1820×) | — |
| M14 | Wdrożenie | `M14-wdrozenie.md` | core | L | — |
| M15 | Rezultaty | `M15-rezultaty.md` | beta | M | — |
| M16 | Finanse | `M16-finanse.md` | beta | M | — |
| M17 | Outputs | `M17-outputs.md` | beta | M | — |
| M18 | Dokumenty | `M18-dokumenty.md` | beta | M-L | ✅ naprawione kod (mig.780/781) — cold-start proof |
| M19 | Prezentacje | `M19-prezentacje.md` | beta | S-M | — |
| M20 | Tabele Studio | `M20-tabele-studio.md` | beta | L | ✅ IDOR naprawione (`e9c6cb9c0a`) — test regresji |
| M21 | Meeting | `M21-meeting.md` | beta | M | — |
| M22 | AI OS | `M22-ai-os.md` | internal | M | STALE (routy zamontowane; `_actionDecisionRoutes` usunięty) |
| M23 | Organizacja | `M23-organizacja.md` | internal | M | ✅ naprawione (3×P1 w kodzie) |
| M24 | Admin | `M24-admin.md` | internal | S-M | — |
| M25 | Ustawienia | `M25-ustawienia.md` | core | S | — |
| M26 | Portal Partnerski | `M26-portal-partnerski.md` | internal | S-M | — |
| M27 | SuperAdmin | `M27-superadmin.md` | internal | M | 🟦 wymaga konta superadmin |
| A1 | Affiliate (stub) | `A1-affiliate.md` | aneks | — | DESCOPED (Ścieżka A wykonana); pozostał orphan `AffiliateDashboardView.tsx` 373 l. do `rm` (skoryg. 2026-06-19) |

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

---

## AKTUALIZACJA 2026-07-14 — audyt 27 modułów vs żywy demo

> **Ten plik jest rekordem historycznym** (plan z 2026-06-13, branch `Londyn`). Sekcje 1-2 powyżej ("GDZIE JESTEŚMY", "ŻYWE BLOKERY") opisują stan sprzed miesiąca i **nie są aktualizowane wstecznie** — zostają jako zapis decyzji z tamtego okresu. Ta sekcja dopisuje **dzisiejszy** (2026-07-14) realny stan, zmierzony na żywym `demo`, nie na dokumentacji/flagach (zgodnie z regułą „Weryfikuj REALNY runtime, nie docy/flagi" z `CLAUDE.md`).

### Tabela 27 modułów — realne % (audyt 07-14)

| Moduł | % gotowości | Uwaga |
|---|---|---|
| M01 Czat | 72 | — |
| M02 Canvas | 70 | — |
| M03 My Work — organizer | 62 | — |
| M04 Notatnik | 55 | — |
| M05 Ideas — Zarządzanie | 75 | — |
| M06 Ideas — Mind Map | 70 | — |
| M07 Ideas — Process Flow | 70 | — |
| M08 Ideas — Table | 65 | — |
| M09 Ideas — Whiteboard | 75 | — |
| M10 Wywiad | 65 | bloker głosu z §2 **NIEAKTUALNY** — patrz korekta niżej (Gemini fallback) |
| M12 Audyty | 85 | — |
| M13 Inicjatywy | 68 | — |
| M14 Wdrożenie | 70 | — |
| M15 Rezultaty | 65 | — |
| M16 Finanse | 65 | — |
| M17 Outputs | 68 | — |
| M18 Dokumenty | 86 | — |
| M19 Prezentacje | 55 | — |
| M20 Tabele Studio | 72 | — |
| M21 Meeting | 78 | — |
| M22 AI OS | 70 | — |
| M23 Organizacja | 75 | — |
| M24 Admin | 70 | re-audyt 2026-07-14 (`M24-admin.md` §RE-AUDYT): 6 paneli (health doszedł), inwentarz 159 plików non-test/33 żywe, i18n/§27 dług doprecyzowany |
| M26 Portal Partnerski | 78 | — |
| M27 SuperAdmin | ~55 | zablokowany — bez konta superadmin, weryfikacja niepełna |
| A1 Affiliate (stub) | — | **ZAMKNIĘTE** (bez zmian vs 06-19: descoped, orphan view do `rm`) |
| M11 Narzędzia | — | **descoped** (bez zmian vs plan: pusty szablon karty, brak realnego kodu — nie planujemy) |

### Kluczowe korekty vs plan 2026-06-13 (§2 powyżej)

1. **Bloker M10 głosu — NIEAKTUALNY.** §2a opisywał "PROD P0: głos w wywiadzie nie zapisuje", blokowane na `OPENAI_API_KEY` na Railway centerbeam. Stan 07-14: obejście działa przez **Gemini fallback** — bloker z §2a już nie odpowiada rzeczywistości, M10 mierzy się dziś na 65% z innych przyczyn (nie głos).
2. **DP-3 multiplayer — ZAIMPLEMENTOWANE.** Wątek multiplayer (M09 Whiteboard/Ideas, opisany w §2a jako "ZAMKNIĘTE 2026-06-19: org-read fallback, realtime=v1, shared-WRITE→v1.1") ma dziś pełną implementację DP-3, nie tylko fallback odczytu.
3. **Plan celował w `Londyn`, ale praca poszła na `demo`.** Ten plik zakłada branch `Londyn` jako cel (nagłówek pliku). Od 07-08 cała mechanika ląduje na `origin/demo`, które jest dziś **658 commitów przed `Londyn`** (nie ~130, jak szacowano jeszcze 07-09 — patrz `_STATUS_3_FILARY.html`). Forward-port demo→Londyn per-SHA (blok B7 skilla `consultify-petla`) pozostaje otwarty.
4. **CI od dziś bramkuje demo.** Nowy gate CI (Postgres service + migracje w coverage job, commit `61c7c571ac`) chroni `demo` przed regresją na poziomie testów — czego plan z 06-13 (Faza 4 „E2E w PR-gate") jeszcze nie zakładał jako działającego mechanizmu.

**Metoda:** liczby % w tabeli wyżej pochodzą z dzisiejszego przelotu audytowego 27 modułów na żywym `demo` (nie z kart audytu Harvard z czerwca, które §1/§2 tego pliku cytują jako punkt wyjścia — te karty są dziś przestarzałe o ~1 miesiąc pracy).
