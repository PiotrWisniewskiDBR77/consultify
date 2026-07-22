# WIDMA ODWOŁAŃ KART — mapa napraw (2026-07-22)

Bramka: „dokumentacja ma nie kłamać". Odwołanie w kodzie/skillu do nieistniejącego pliku
jest gorsze niż jego brak — agent czyta instrukcję, nie znajduje źródła, **zgaduje**.

Ten dokument to **MAPA NAPRAW, nie naprawa**. Kod produktu (`src/`, `server/`) NIE jest tu
edytowany. Każde twierdzenie ma dowód `plik:linia`. Decyzje produktowe (które karty domyślne,
progi) zostają jako **wejście do kontraktu** — nie rozstrzygam ich.

Baza: worktree `fix/prv-mywork-preview` (origin/demo). „GHOST z perspektywy demo" = plik,
którego agent pracujący na origin/demo nie zobaczy, bo nie ma go na tej gałęzi.

---

## 1. Wynik `node scripts/sprawdz-zrodla.mjs`

```
Plików instruktażowych: 98
Sprawdzonych odwołań:   822
❌ DOKUMENTY-WIDMA — cytowane, ale nie istnieją (36)
```

**Ważne ograniczenie skryptu:** `sprawdz-zrodla.mjs` skanuje TYLKO pliki instruktażowe —
`CLAUDE.md`, `.claude/skills/*/SKILL.md`, `docs/ui-standards/**` (funkcja `zbierzInstrukcje()`,
scripts/sprawdz-zrodla.mjs:27-55). **NIE skanuje kodu produktu** (`src/`, `server/`). Dlatego
trzy pliki-karty wskazane w audycie (`cardSets.ts`, `cardContentValidator.ts`,
`cardContentFormulaValidator.ts`) **nie pojawiają się** w jego liście 36 — trzeba je sprawdzić ręcznie.
To luka w zasięgu bramki (patrz §4).

Pełna lista 36 z biegu skryptu (grupami wg pliku instruktażowego) — te dotyczą skilli i kanonów UI,
nie kart; są poza zakresem tego zadania, wymienione dla kompletności:

- `.claude/skills/consultify-artefakt-fala/SKILL.md` → `_PRZEGLAD_PROMPTOW_ARTEFAKTY_N_2026-07-07.md`
- `.claude/skills/consultify-artefakty/SKILL.md` → `_WZORZEC_N_KARTY_DOKUMENTACJA_2026-07-07.md`, `_ARTEFAKTY_TRESC_KART_BCG_2026-07-06.md`, `_DOD_ARTEFAKTY_N_CHECKLIST_2026-07-07.md`
- `.claude/skills/consultify-finisz-modulu/SKILL.md` → `_PLANY_KONCOWE_2026-07-07/00_PLAN_DOKONCZENIA_FINAL.md` (+ `01_notatnik.md`, `08_word.md`, `00_PLAN_DOKONCZENIA_FINAL.md`)
- `.claude/skills/consultify-petla/SKILL.md` → `_PLANY_KONCOWE_2026-07-07/00_PLAN_DOKONCZENIA_FINAL.md`, `_SYSTEM_WERYFIKACJI_2.0.md`
- `.claude/skills/consultify-test/SKILL.md` → `_SYSTEM_WERYFIKACJI_2.0.md`, `_SYSTEM_PANEL_ADWERSARYJNY_RUNBOOK.md`
- `docs/ui-standards/**` (16 dalszych: `VEGAS_RESEARCH.md`, `.motion-baseline.json`, `NewSectionCanvas.tsx`, komponenty `Help/*`, `EnhancedDataTable.tsx`, `ResultsKpisTableV3.tsx`, `matrix-editor-standard.md`, `_AUDYT_NADMIAR_ELEMENTOW_2026-07-11.md`, `OPERATING_STANDARD.md`, `UI_UX_ACCESSIBILITY_CHECKLIST.md` …)

> Uwaga: `consultify-artefakty/SKILL.md` cytuje `_WZORZEC_N_KARTY_DOKUMENTACJA_2026-07-07.md`
> i `_ARTEFAKTY_TRESC_KART_BCG_2026-07-06.md` — te SAME widma, które kod-karta cytuje w §2 poniżej.
> Skrypt łapie je w skillu, ale nie w `cardSets.ts`/`cardContentValidator.ts`. To potwierdza lukę zasięgu.

---

## 2. Martwe odwołania w KODZIE KART (rdzeń zadania)

Trzy pliki produkcyjne cytują dokumenty jako SSOT w komentarzach-nagłówkach. Weryfikacja istnienia
(`find`, `git log --all`) rozdziela je na: **żywe** (zostawić), **widma-fantomy** (nigdy nie powstały)
i **widma-recoverable** (istnieją na innej gałęzi, brak na demo).

### Tabela: odwołanie | plik:linia | status | cel żywy

| # | Odwołanie | plik:linia | Do czego miało odsyłać | Status | Cel żywy / propozycja |
|---|-----------|-----------|------------------------|--------|------------------------|
| 1 | `_WZORZEC_N_KARTY_DOKUMENTACJA_2026-07-07.md §3.5` | `src/components/shared/NModeLayout/cardSets.ts:26` | SSOT systemu zarządzania kartami wzorca N (§3.5) | **WIDMO-FANTOM** (nigdy nie istniał na ŻADNEJ gałęzi — `git log --all --diff-filter=A` = 0 trafień) | **Przepiąć → `_KONTRAKT_KARTY_SSOT`** (docelowy SSOT kart, w pisaniu w równoległej fali). Do czasu jego powstania: **uśmiercić** cytat (usunąć `@see`), bo odsyła w próżnię. Treść „katalog+sety per typ" i tak żyje w KODZIE tego pliku (DEFAULT_CARD_SETS) — kod jest samowystarczalny. |
| 2 | `_ARTEFAKTY_MENU_STRUKTURA_2026-07-06.md` | `src/components/shared/NModeLayout/cardSets.ts:27` | Struktura menu artefaktów (picker „+ Nowa karta") | **WIDMO-FANTOM** (0 trafień w `git log --all`) | **Uśmiercić** — nigdy nie napisany, brak odbiorcy treści. Ewentualnie przepiąć → `_KONTRAKT_KARTY_SSOT` jeśli kontrakt obejmie strukturę pickera (wejście do kontraktu). |
| 3 | `_ARTEFAKTY_TRESC_KART_BCG_2026-07-06.md §0` (BCG anti-patterns) | `server/src/services/cardContentValidator.ts:4` | Doktryna BCG — anty-wzorce treści | **WIDMO-FANTOM** (0 trafień w `git log --all`) | **Przepiąć → `docs/standards/CARD_CONTENT_FORMULA.md §A6` (Anty-wzorce)** — TEN plik **istnieje** (docs/standards/CARD_CONTENT_FORMULA.md:78 „A6. Anty-wzorce (automatyczny FAIL)") i już jest drugim SSOT-em cytowanym w tej samej linii. Anty-wzorce BCG = §A6. Widmo jest zbędnym dubletem. |
| 4 | `docs/standards/CARD_CONTENT_FORMULA.md §A6` | `server/src/services/cardContentValidator.ts:4` | Formuła treści (§A6) | **ŻYWY** (istnieje, docs/standards/CARD_CONTENT_FORMULA.md) | **ZOSTAWIĆ** — poprawne odwołanie. |
| 5 | `docs/standards/CARD_CONTENT_FORMULA.md` (§A/§B3) | `server/src/services/cardContentFormulaValidator.ts:3-6` | Kanon jakości McKinsey-grade | **ŻYWY** (istnieje) | **ZOSTAWIĆ** — poprawne. |
| 6 | `_FORMULA_TRESCI_INSIGHT §3 / §5` (62 odwołania inline: §3, §3.1–§3.15, §5, §5.1, §5.2) | `server/src/services/cardContentFormulaValidator.ts:251` + 61 dalszych | 13-typowa formuła treści Insight: §3 „Formuła per typ", §5 „Kryteria jakości per typ (walidator)" | **WIDMO-RECOVERABLE** — pełna nazwa `_FORMULA_TRESCI_INSIGHT_2026-07-13.md`; **istnieje na gałęzi `oxford/oc2-merge`** (commit 86d12cbe91, 615 linii/42 KB), **BRAK na origin/demo** (`git merge-base --is-ancestor` = NO) | **PORTOWAĆ dokument na demo** — to jedyne martwe odwołanie, gdzie treść istnieje i pasuje 1:1 (doc ma §3.1 Executive Summary … §3.15 Quote Comparison; §5.1 `title_is_thesis` — dokładnie jak predykaty w kodzie). Forward-port pliku do `Harvard/wdrozenie-100/` na demo lub scalenie treści do `_KONTRAKT_KARTY_SSOT`. **NIE uśmiercać** — kod (§3/§5 predykaty) to jedyna działająca kopia checklisty; bez doc agent nie ma źródła. |

Liczba martwych odwołań w kodzie kart: **4 unikalne dokumenty-widma** (poz. 1,2,3,6), z czego
1 recoverable (poz. 6). Odwołań-instancji do widma-recoverable w `cardContentFormulaValidator.ts`:
**62** (`grep -oE "§[35](\.[0-9]+)?"`).

---

## 3. Dowody (plik:linia → komenda)

- Lokalizacja plików: `find` → `src/components/shared/NModeLayout/cardSets.ts`,
  `server/src/services/cardContentValidator.ts`, `server/src/services/cardContentFormulaValidator.ts`.
- cardSets.ts:26-27 — `@see _WZORZEC_N_KARTY_DOKUMENTACJA_2026-07-07.md §3.5` / `@see _ARTEFAKTY_MENU_STRUKTURA_2026-07-06.md`.
- cardContentValidator.ts:4 — `SSOT: _ARTEFAKTY_TRESC_KART_BCG_2026-07-06.md §0 … i docs/standards/CARD_CONTENT_FORMULA.md §A6`.
- cardContentFormulaValidator.ts:3 — `SSOT: docs/standards/CARD_CONTENT_FORMULA.md` (żywy); :251-252 — komentarz `§3/§5 … mirrors an anti-pattern from _FORMULA_TRESCI_INSIGHT §3`.
- Istnienie: `docs/standards/CARD_CONTENT_FORMULA.md` EXISTS; trzy `_ARTEFAKTY_*`/`_WZORZEC_N_*` = GHOST (find + `git log --all --diff-filter=A` = 0).
- Recoverable: `git log --all` → 86d12cbe91 „formuła treści kart Insight #57 — 13 typów" dodaje
  `Harvard/wdrozenie-100/_FORMULA_TRESCI_INSIGHT_2026-07-13.md`; `git branch --contains` = `oxford/oc2-merge`;
  `git merge-base --is-ancestor 86d12cbe91 origin/demo` = NO. Plik fizycznie obecny w głównym checkoucie (42081 B).
- Struktura żywego SSOT: `grep '^#'` docs/standards/CARD_CONTENT_FORMULA.md → §A2/§A3/§A6/§B3 (NIE §3/§5 —
  to inna numeracja niż 13-typowy `_FORMULA_TRESCI_INSIGHT`; potwierdza, że §3/§5 to inny dokument, nie ten żywy).
- Kod jest LIVE (nie tknąć): callerzy `cardContentFormulaValidator`/`cardContentValidator` →
  InitiativeController.ts, InterviewInsightService.ts, taskSectionGenerationService.ts, insightMaterializationService.ts,
  evidenceEnvelopeService.ts i in. Konsumenci `cardSets` → NModeCardManager.tsx, useCardLayout.ts, index.ts.

---

## 4. Luka bramki (rekomendacja narzędziowa — do kontraktu)

`sprawdz-zrodla.mjs` NIE skanuje kodu produktu, więc martwe `@see`/`SSOT:` w komentarzach
`src/`+`server/` przechodzą niezauważone. Rekomendacja (nie wykonuję — to zmiana narzędzia,
poza „mapą napraw"): rozszerzyć `zbierzInstrukcje()` o skan komentarzy w
`src/**/*.{ts,tsx}` i `server/src/**/*.ts` — łapać wzorce `@see …`, `SSOT: …`, `_FORMULA…`, `_WZORZEC…`.
Wtedy poz. 1,2,3,6 z §2 zapalają się automatycznie przy każdym commicie.

---

## 5. Wejście do kontraktu `_KONTRAKT_KARTY_SSOT` (decyzje Piotra — NIE rozstrzygam)

1. **Czy `_KONTRAKT_KARTY_SSOT` przejmuje treść widm-fantomów** (poz. 1 §3.5 katalog kart,
   poz. 2 struktura pickera) — czy zostają uśmiercone jako nigdy-niepotrzebne? Kod `cardSets.ts`
   jest samowystarczalny; pytanie czy kontrakt ma je udokumentować z zewnątrz.
2. **Poz. 6 — port `_FORMULA_TRESCI_INSIGHT_2026-07-13.md` na demo osobno, czy wchłonięcie do
   `_KONTRAKT_KARTY_SSOT`?** Doc ma 615 linii, 13 typów + progi walidatora (§5). Jeśli kontrakt
   wchłania — 62 inline-odwołania §3/§5 w kodzie trzeba będzie przemapować na numerację kontraktu
   (osobny blok, dotyka kodu produktu → poza tą falą).
3. **Poz. 3 — czy anty-wzorce BCG to na pewno `CARD_CONTENT_FORMULA.md §A6`**, czy kontrakt ma
   osobną sekcję anty-wzorców? Jeśli §A6 wystarcza — widmo `_ARTEFAKTY_TRESC_KART_BCG` czyste do uśmiercenia.

---

*Wygenerowano na origin/demo (worktree fix/prv-mywork-preview). Zero edycji kodu produktu.
Naprawy (przepięcie/port) = osobny blok po decyzjach z §5.*
