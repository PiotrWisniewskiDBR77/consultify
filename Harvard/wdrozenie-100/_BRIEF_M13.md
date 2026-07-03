# BRIEF AGENTA — M13 Inicjatywy · ODBIÓR 8/8

> Wklej jako pierwszą wiadomość do świeżego czata. Kontekst **tylko M13**. Cel: **MODUŁ ZAMKNIĘTY (8/8)** wg tabeli `_STAN_PRACY_ODBIORY.md`. Priorytet Piotra: **przepływ tworzenia + zatwierdzania + wnętrze inicjatywy** — to jest „ciągła masakra", tutaj skupiasz 80% energii.

---

## Rola i cel

Agent-wykonawca **M13 Inicjatywy** (`/workspace/initiatives`). Domykasz 8 bramek z `_STAN_PRACY_ODBIORY.md`:
**Kod → DoD 7/7 → Epiki 6/6 → Testy automaty → Manual (Playwright+png) → UI → →F → →UI**.
Dowód, nie deklaracja. Tylko M13.

---

## Kontekst i źródła prawdy

- Repo: `consultify/` · Branch **Londyn** · Tracker: `Harvard/wdrozenie-100/_STAN_PRACY_ODBIORY.md` (wiersz M13)
- Teczka: `Harvard/wdrozenie-100/M13-inicjatywy.md` (SSOT luk + epików + DoD)
- Spec manualna: `Harvard/Testy manualne/TESTY_M13_INICJATYWY.md`
- Kanon UI: `docs/ui-standards/CANON.md` + `docs/ui-standards/03-modules/TABLE_AND_PREVIEW_CANON.md` (§27)
- Product docs: `docs/product/INITIATIVE_STATUS_ROLE_CTA_MATRIX.md`, `docs/product/INITIATIVE_GOVERNANCE_MODEL.md`, `docs/initiatives/INITIATIVE_FORMULA.md`, `docs/standards/CARD_CONTENT_FORMULA.md`

---

## Stan wejściowy M13 (zweryfikowany 2026-06-20/21)

### ✅ ZAMKNIĘTE (nie ruszaj bez powodu)
| Luka | Dowód |
|------|-------|
| L-01 create-from-hub disabled | pilot→locked CTA + serwer guard (`requireInitiativeWriteAccess`) |
| L-02 bulk Tag/Due/Delete stub | `showBulkStubActions` OFF default |
| L-04 AI-fill wg formuły McKinsey | `initiativeGenerationService.ts` + chip `sectionReview`, test 5/5 |
| L-05 baner degradacji V8 | `v8PlanningDegraded` + Banner w `InitiativesHub.tsx:234` |
| L-06 gating pilota serwer | `requireInitiativeWriteAccess()` na POST/PUT/DELETE |
| L-07 in-context open | `InitiativeFullView` + `openItemRouting.ts` DP-2, test 6/6 |
| L-08 CTA „Otwórz" | `18ed3e44f7` |
| L-09 cross-org IDOR | `b9f2dee9d2` + test 10/10 |
| L-10 0 testów CRUD | `ea77dc678c` |
| L-11a i18n ~1820× | `9fdbbf82ce`+`f5f333c135` — 1297 kluczy `initiatives.*`, 0 brakujących |
| L-11b §27 tabele | sticky-thead + `CompetencyRequirements`→FilterableTable (`5ff719a12f`) |
| L-11c hex kolory | FALSE POSITIVE — legit data-viz + PDF export + wizard-accent violet |
| L-12 governance org-spoofable | FALSE ALARM (orgId z JWT) |

### 🔴 OTWARTE — to jest twoja lista roboty

**1. [P0-REAL] DELETE inicjatywy — BRAKUJĄCY endpoint**
- `DELETE /api/initiatives/:id` → 404 (zweryfikowane live 2026-06-20)
- Plik: `server/src/routes/pmo/initiatives.routes.ts`
- Serwer ma już guard `requireInitiativeWriteAccess` (reuse) + `requireOrgRole`
- Blokada UX: użytkownik nie może skasować DRAFT-a. UI pokazuje „Wkrótce (backend)"
- Scope: tylko DRAFT/CANCELLED → 400 dla aktywnych; org-scope WHERE; test regresji

**2. [P1] Status pipeline w UI — NIEDOPIĘTY (#14, L-03)**
- `InitiativeStatusPipeline.tsx` istnieje (`src/components/Initiatives/sections/`) ale NIE jest wpięty w `InitiativesHub.tsx` (grep 0 wyników)
- Decision D-02 = PEŁNY pipeline. Slice C zamknięty (`dd597dce0b`): G3 next-gate accuracy + G5 AI gating
- Do domknięcia: wpięcie paska statusu w hub/preview + CTA per status×rola (wg `INITIATIVE_STATUS_ROLE_CTA_MATRIX.md`) + informacja o następnej bramce. Odroczone Slice A/G2/G4 = NIE ruszaj (behavior-change na żywych klientach VTS/Apator/Elkomtech — wymaga per-org rollout + telemetria)
- Weryfikacja: `GET /api/initiatives/:id/gate-readiness-check` → pipeline bar + next-gate label

**3. [P1] Wnętrze inicjatywy — audyt UX (Piotr: „ciągła masakra")**
- `InitiativeDocumentView.tsx` ma **10 380 linii** — największy plik FE
- Zadanie: **najpierw AUDYT live** (Chrome MCP, zalogowany OWNER, otwórz inicjatywę):
  - Które CTA działają → które rzucają błędem / są martwe?
  - Czy sekcje ładują się bez crash?
  - Czy AI-fill (przycisk „Generuj") faktycznie działa i zwraca treść?
  - Czy submit-review / approve widoczne i działają?
  - Czy delete jest dostępny w UI (kebab)?
- Na podstawie audytu: lista realnych bugów → napraw w kolejności P0→P1

**4. [P1] Przepływ tworzenia — audyt + naprawa**
- Ścieżki tworzenia: `New` (quick) · `Charter Wizard` (`InitiativeCharterWizard.tsx:740l`) · `Generator z M10` (`InitiativeGeneratorModal.tsx`)
- Audyt live każdej ścieżki:
  - Czy form waliduje poprawnie?
  - Czy DRAFT trafia do bazy i pojawia się na liście?
  - Czy Charter Wizard przechodzi przez 3 kroki bez błędu?
  - Czy Generator z M10 przyjmuje insight i tworzy propozycje?
- Napraw wszystko co nie działa

**5. [P1] Przepływ zatwierdzania (submit → review → approve → PLANNING)**
- Endpoint: `POST /api/initiatives/:id/submit-review` + `POST /api/initiatives/:id/approve`
- Weryfikacja live (2 role: OWNER zatwierdza, ADMIN zatwierdza):
  - Czy przycisk submit-review pojawia się dla właściwej roli + statusu?
  - Czy po submit status zmienia się na PENDING_REVIEW → REVIEW → PROMOTED → PLANNING?
  - Czy bramka (`GET /api/initiatives/:id/gate-readiness-check`) blokuje jeśli sekcje puste?
- Napraw braki w UI (brak CTA, brak potwierdzenia, brak feedbacku)

**6. [P2] Martwy kod — usuń `InitiativeConflictsPanel.tsx`**
- 0 importerów (grep czysty, zweryfikowane 2026-06-19)
- Usunięty w `2dbebfdd74`, przypadkowo przywrócony przez git-race `8c3d290ab9`
- Prosta operacja: `rm src/components/Initiatives/InitiativeConflictsPanel.tsx`

**7. [P3] DoD formalne — sprawdź każde kryterium**

| # | Kryterium | Miara / dowód |
|---|-----------|---------------|
| 1 | Front↔back | New/Charter/Wizard tworzą DRAFT; bulk ukryte (`showBulkStubActions=false`); DELETE działa; statusy sterowalne wg matrix |
| 2 | Bezpieczeństwo | Gating pilota 403 (test); governance org-scope 10/10; DELETE org-scoped |
| 3 | i18n | 0 brakujących kluczy `initiatives.*` — uruchom `node scripts/i18n/check-bare-missing.cjs` |
| 4 | Tokeny CSS | 0 nowych hardkodów; graf + PDF-export = legit wyjątki (udokumentowane) |
| 5 | §27 tabele | Sticky-thead wszędzie; `CompetencyRequirements` = FilterableTable; brak surowych `<table>` bez stylu |
| 6 | E2E w CI | S2 (create via Charter), S4 (submit-review → approve), S5 (delete DRAFT) zielone na Londyn |
| **7** | **DELETE inicjatywy** | **`DELETE /api/initiatives/:id` działa dla DRAFT/CANCELLED; 403 dla aktywnych (EXECUTING/APPROVED); org-scope; test regresji** |

---

## Procedura → 8/8

### Etap 1 — Audyt live (zanim cokolwiek napiszesz)
```
preview_start frontend-dev   # :3000
preview_start backend-dev    # :3001 (staging DB trolley — safe)
```
Chrome MCP (zalogowany OWNER, `piotr.wisniewski@dbr77.com`):
1. `/workspace/initiatives` — hub, widok tabeli/kanban, czy ładuje bez błędu
2. `New` → quick create → sprawdź czy DRAFT trafia do listy
3. `Charter` → przejdź 3 kroki → sprawdź czy inicjatywa stworzona
4. Otwórz inicjatywę → pełny dokument → sprawdź sekcje, AI-fill, submit-review
5. `console.log` błędów → zapisz jako listę bugów

### Etap 2 — Kod (fixes w kolejności P0→P1→P2)
1. DELETE endpoint (trivial, backend)
2. Bugi z audytu live (priorytet Piotra)
3. StatusPipeline wpięcie w hub
4. `InitiativeConflictsPanel.tsx` usunięcie

### Etap 3 — DoD 7/7
Sprawdź każde z 7 kryteriów kodem/grepem. Oznacz ✅/❌ z dowodem.

### Etap 4 — Epiki 6/6
Dla każdego epiku: stan wejściowy → co zrobiłeś → dowód (commit lub „już done").

### Etap 5 — Testy automaty
```bash
npx vitest run tests/unit/initiatives tests/integration/initiatives --reporter=verbose
```
Cel: 0 failujących. Dopisz testy dla DELETE endpoint + StatusPipeline (jeśli brak).
Pamiętaj: `/tests/` jest gitignored — nowe pliki: `git add -f`.

### Etap 6 — Testy manualne (Playwright + screenshoty)
Spec: `Harvard/Testy manualne/TESTY_M13_INICJATYWY.md` — **68 scenariuszy** (tracker: `0/68`). Ekranów = 30 (to liczba powierzchni, nie scenariuszy).

Każdy scenariusz jako Playwright spec `tests/e2e/m13/`, każdy ze:
```ts
await page.screenshot({ path: 'tests/e2e/screenshots/m13/<id>-<nazwa>.png' });
```
**Bramka „Manual" w trackerze = tylko z zapisanym `.png`. Live-klik bez artefaktu = NIE zaliczony.**

Sekcje spec (68 scenariuszy łącznie, podziel na pliki per sekcja):
- §1 Hub + nawigacja
- §2 Dokument inicjatywy (sekcje, autosave, AI-fill)
- §3 Tworzenie: Charter Wizard + AI Wizard + walidacje
- §4 Maszyna stanów (submit-review, approve, reject, execute, block, complete, cancel, archive)
- §5 Portfolio (lista, kanban, timeline, grid, programy)
- §6 ROI  
- §7 Analiza (AnalysisWorkspace, graf zależności)
- §8 Integracje cross-module (M10→M13, M13→M14/15/16)
- §9 Bezpieczeństwo (pilot VTS, cross-org, role)
- §10 Preview + Drawer
- §11 Edge cases (kombinacje statusów, dark/light, i18n, a11y, 0 błędów konsoli)

**Priorytet startowy** (jeśli czas nie pozwoli na 68 — minimum to):
- S1 (hub lista), S2 (create Charter), S4.1 (submit-review), S4.2 (approve), nowe S-DELETE (delete DRAFT), S11.5 (dark mode), S11.4 (i18n PL/EN)

### Etap 7 — UI/UX
Sprawdź live w obu motywach (dark/light) na `:3000`:
- Kanon §7 (topbar), §9 (sidebar), §17 (typography), §27 (tabele)
- 0 `danger-fill` na normalnych statusach
- Tokeny CSS vars — 0 hardkodów koloru (poza PDF-export + data-viz = legit)
Screenshot dla każdego ekranu hub+wizard+dokument.

### Etap 8 — Aktualizacja trackera (po KAŻDYM etapie, nie na końcu)

**Aktualizuj `_STAN_PRACY_ODBIORY.md` po zakończeniu każdego etapu** — nie czekaj do końca.

**Format wiersza M13** (linia 68 w pliku — zmieniasz TYLKO tę linię):
```
Przed: | M13 | Inicjatywy | 2 | 0/6 | 0/7 | ⬜ | 0/68 | ⬜ | ⬜ | ⬜ | 30 | ⬜ NIE ROZP. |
Po:    | M13 | Inicjatywy | 2 | 6/6 | 7/7 | ✅ | 68/68 | ✅ | ⬜ | ⬜ | 30 | 🟢 DO ODBIORU |
```

Kolumny: `Moduł | Nazwa | Faza | Epiki | DoD | Kod | Manual | UI | →F | →UI | Ekr. | Status`

Aktualizuj **inkrementalnie** po każdym etapie:
- Po etapie 2 (Kod): zmień `⬜ NIE ROZP.` → `🟡 W TOKU`
- Po etapie 3 (DoD): zaktualizuj `0/7` → `X/7`
- Po etapie 4 (Epiki): zaktualizuj `0/6` → `X/6`
- Po etapie 5 (Testy automaty): zaktualizuj `⬜` (kolumna Kod) → `✅` lub liczba
- Po etapie 6 (Manual): zaktualizuj `0/68` → `X/68`
- Po etapie 7 (UI): zaktualizuj `⬜` (kolumna UI) → `✅`
- Etap →F i →UI = **zostaw ⬜** (czeka Piotr na demo)
- Finalny status: `🟢 DO ODBIORU` gdy Kod+DoD+Epiki+Manual+UI = ✅

**Sekcję szczegółową M13** (blok `### M13 — Inicjatywy...`) aktualizuj podobnie:
- Każdy z 8 etapów zaznacz `✅` z krótką notą dowodową w kolumnie „Odbiór"

---

## ⚡ Równoległość — ODPALAJ SUB-AGENTÓW

Rozdaj na izolowane strefy plików:
- **Agent A**: DELETE endpoint + testy (`initiatives.routes.ts` + `initiativeController`)  
- **Agent B**: StatusPipeline wpięcie + hub CTA per status (`InitiativesHub.tsx` + `InitiativeStatusPipeline.tsx`)
- **Agent C**: audyt wnętrza (`InitiativeDocumentView.tsx`) — tylko czyta + raportuje, NIE edytuje
- **Agent D**: przepływ tworzenia (`Wizard/`) — audyt + naprawa
- **Agent E**: Playwright specs (`tests/e2e/m13/`) + screenshoty

Agenci B i C/D muszą być ROZŁĄCZNI plikowo. Jeśli Agent C znajdzie bugi w `InitiativeDocumentView.tsx` — TY (lider) implementujesz fix (nie Agent C — Agent C to tylko oczy).

---

## Twarde zasady

- NIGDY `git add -A` / `git add .` — zawsze konkretne pliki po nazwie
- **prod=centerbeam** — zero zmian bez jawnej zgody Piotra
- Staging DB = `trolley.proxy.rlwy.net:28146` (pgvector demo, ~10 271 userów) — safe do testów
- `rm` martwego kodu tylko po potwierdzeniu 0 importerów (`grep -rn FileName src/` — match po *resolwowanym* imporcie, nie podciągu)
- Sekrety/env = Piotr. Nie wpisuj kluczy, nie zmieniaj `.env.*` bez pytania
- Weryfikuj live (Chrome MCP) zanim ogłosisz „done" — screenshot = dowód
- Testy pisz do `tests/unit|integration|components/` (nigdy `src/__tests__/` — CI ich nie widzi)
- Nowe pliki testów w `/tests/` → `git add -f` (gitignored)

---

## Co zwracasz

```
M13 RAPORT AGENTA
=================
Etap 1 — Audyt live: [lista bugów znalezionych]
Etap 2 — Kod: [co naprawiono, linki do plików:linia]
Etap 3 — DoD: 7/7 [każde kryterium z dowodem]
Etap 4 — Epiki: 6/6 [każdy z dowodem]
Etap 5 — Testy: X/Y zielone [co nowe, co naprawione]
Etap 6 — Manual: X/30 png [lista plików w tests/e2e/screenshots/m13/]
Etap 7 — UI: [co sprawdzono, screenshot path]
Wiersz tracker: M13 | Inicjatywy | ✅/⬜ per bramka | Status
```

Jeśli napotkasz decyzję produktową (np. który CTA pokazać dla PROJECT_MANAGER w statusie REVIEW) — **nie zgaduj, opisz opcje i poczekaj na decyzję Piotra**.
