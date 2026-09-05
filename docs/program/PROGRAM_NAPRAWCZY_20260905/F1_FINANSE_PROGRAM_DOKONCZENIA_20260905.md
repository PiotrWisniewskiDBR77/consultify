# F1. Finanse — program dokończenia (paczki dla Codexa)

> **Baza.** Pomiar: `F0_FINANSE_AUDYT_LUKI_20260905.md` (HEAD `888e8a52b9`). Kontrakt produktu:
> `docs/program/grafika/FINANSE_ZALOZENIA_CTO_20260905.md`. Łańcuch backendu:
> `F_FINANSE_PELNA_TABELA.md` (ten dokument **nie zastępuje** programu F — porządkuje go
> w paczki wykonawcze, dokłada brakujące ogniwo Analizy i cały tor frontendu).
> **Status decyzyjny.** Finanse są **poza MVP** decyzją właściciela z 05.09
> (`MVP_BACKLOG_20260905.md` §K). Ten program czeka na słowo „start"; nie startuje sam.
> **Szablon.** Każda paczka ma §1–§11 wg `00_SZABLON_PACZKI.md`; §10 jest mechaniczne, §11 to
> jeden blok do skopiowania.
> **Jednostka wyceny.** 1 sesja Codexa ≈ 4–6 h pracy jednego wykonawcy w jednym worktree.

---

## 0. Dwa poziomy i co je odróżnia

| | MINIMUM MVP | PEŁNY |
| --- | --- | --- |
| **Obietnica dla właściciela** | „CFO importuje sprawozdanie DBR77 2025 z porównawczym 2024, otwiera je jako **pełny dokument** (RZiS · Bilans · CF), zatwierdza, i wszystko jest po polsku, bez czerwieni i bez uciętych kolumn." | „…dalej: tworzy analizę ze wskaźnikami, model bazowy z **jedną tabelą historia + horyzont**, scenariusz, wycenia firmę ze wskazanym źródłem i eksportuje." |
| **Zakres** | jedna lista L1 (Sprawozdania) w kanonie + jedna karta N (Sprawozdanie) na powłoce artefaktu + przewód import → pakiet `ready` → zatwierdzenie na realnych danych | + łańcuch 6 ogniw Baseline v3, producent wskaźników Analizy, prognoza, wycena ze źródłem, porównanie wersji, pięć narzędzi warsztatu |
| **Paczki** | F‑M1 … F‑M7 | + F‑P1 … F‑P11 |
| **Nakład** | **8 sesji** | **+16 sesji = 24 sesje łącznie** |
| **Ścieżka krytyczna** | F‑M1 → F‑M3 → F‑M4 → F‑M7 (5 sesji; F‑M2 i F‑M5/F‑M6 równolegle) | + F‑P1 → F‑P2 → F‑P3 → F‑P6 → F‑P11 (8,5 sesji od zakończenia MINIMUM) |

**Zasada nadrzędna dla obu poziomów:** żadna paczka nie chowa pracy za nową flagą. Flagi w tym
programie są **przełączane na ON albo usuwane**, nie dodawane (`00_SZABLON_PACZKI.md` §10, zakazy).

---

## 1. Kolejność, zależności, wycena

| Paczka | Poziom | Cel jednym zdaniem | Model | Sesje | Zależy od |
| --- | :-: | --- | :-: | :-: | --- |
| **F‑M1** | MIN | Zero angielskiego i zero kodów enum w Finansach (65 napisów + 12 słowników) | Sonnet | 1 | — |
| **F‑M2** | MIN | Zero crimsona (34 wystąpienia) i zero nieoznaczonych `<table>` (13) | Sonnet | 1 | — |
| **F‑M3** | MIN | Lista Sprawozdań: kolumna „Sprawozdanie źródłowe", nic się nie ucina, gotowość po polsku | Sonnet | 1 | F‑M1 |
| **F‑M4** | MIN | Karta N Sprawozdania na powłoce artefaktu (Menu 3 + `ArtifactRightPanel` z Rodowodem) | Opus | 1,5 | F‑M1, F‑M3 |
| **F‑M5** | MIN | Import zakłada kalendarz i okresy → pakiet `ready` (ogniwo 1) | Opus | 1,5 | — |
| **F‑M6** | MIN | Zatwierdzenie pakietu do `APPROVED` z UI (ogniwo 2) | Sonnet | 1 | F‑M5 |
| **F‑M7** | MIN | Dane DBR77 (kroki 1–4) + komplet zrzutów odbioru MINIMUM | Sonnet | 1 | F‑M1…F‑M6 |
| **F‑P1** | PEŁNY | Rejestr `finance_baseline_models` + trzy krawędzie przy tworzeniu modelu (ogniwo 4) | Opus | 2 | F‑M6 |
| **F‑P2** | PEŁNY | Generator miesięcznych okresów prognozy (ogniwo 5) | Opus | 1,5 | F‑M5 |
| **F‑P3** | PEŁNY | `PUT` kontekstu z kreatora + akcja „Skonfiguruj kontekst" (ogniwo 6) | Opus | 2 | F‑P1, F‑P2 |
| **F‑P4** | PEŁNY | Producent definicji analizy i wierszy selekcji KPI (**brak w programie F**) | Opus | 1,5 | F‑M6 |
| **F‑P5** | PEŁNY | Analiza: krawędź z kreatora warsztatu, flaga ON, koniec 404 (ogniwo 3) | Sonnet | 1 | F‑P4 |
| **F‑P6** | PEŁNY | Pełna tabela RZiS · Bilans · CF: historia + horyzont w jednej tabeli | Opus | 2 | F‑P3 |
| **F‑P7** | PEŁNY | Prognoza/scenariusze: flaga ON + rozstrzygnięcie białego ekranu | Opus | 1,5 | F‑P6 |
| **F‑P8** | PEŁNY | Wycena: krok „Wyniki" odblokowany, 23 napisy EN po polsku | Sonnet | 1 | F‑P1 |
| **F‑P9** | PEŁNY | Pięć narzędzi warsztatu na ON (Rodowód · Porównaj · Komentarze · Widoki · Excel) | Sonnet | 1 | F‑M4 |
| **F‑P10** | PEŁNY | Porównanie wersji: druga wersja biznesowa artefaktu | Opus | 1,5 | F‑P1 |
| **F‑P11** | PEŁNY | Dane DBR77 (kroki 5–9) + przepływ CFO klikany + komplet zrzutów | Sonnet | 1 | wszystkie |

**Czego nie wolno zrównoleglić:** F‑M5 → F‑M6 → F‑P1 → F‑P3 (każde ogniwo produkuje wiersz, którego
żąda następne); F‑P4 → F‑P5. **Co idzie równolegle od pierwszego dnia:** F‑M1, F‑M2, F‑M5.

---

# MINIMUM MVP

---

## F‑M1 — Koniec angielskiego i kodów enum w Finansach

**§1 Cel dla użytkownika.** W całym module Finanse nie ma ani jednego angielskiego napisu ani kodu
technicznego — stan pakietu mówi „Wymaga uzupełnienia: brak rachunku wyników, brak przepływów",
a nie `MISSING_PLAN, MISSING_CF`.

**§2 Zakres.** 136 plików `src/components/Finance/**` + `src/components/Economics/**` (bez testów),
5 ekranów listy L1, 5 kart N. Moduł Finanse **nie jest zamrożony** (`MVP_FINAL_ZAMROZONE.json`) —
marker `[ODMROZENIE …]` niepotrzebny.

**§3 Przyczyna źródłowa.**
- `src/components/Economics/FinanceValuePanelsSurface.tsx:79-101` — mapa `LABELS` z 21 nazwami
  narzędzi wpisanymi twardo po angielsku, poza `t()`; dodatkowo `:116` `aria-label="Valuation analysis panels"`
  i `:131` `Loading panel…`.
- 7 kluczy `t()` bez wpisu w `public/locales/pl/translation.json` (m.in. `finance.blocked`,
  `common.status.draft|review|approved`, `finance.model.manualBaselineHint`).
- 17 kluczy obecnych w `pl`, ale z angielską/hybrydową treścią (`finance.toast.statementConfirmed`
  → „Statement potwierdzony", `finance.m16.sensitivity.addDriver` → „+ driver").
- 20 twardych napisów EN w JSX (`StatementValidationBadges.tsx:41` „Validation results",
  `EvidencePanel.tsx:295` „Delete", `ExcelImportWizard.tsx:346` „Nazwa analysis").
- Kody enum renderowane wprost: `pack_readiness_status` (6 kodów) i `finance_business_versions.status`
  (3 kody) — widoczne na `evidence/audyt-award-20260905/finanse/02-sprawozdanie-detal.png`.

**§4 Projekt rozwiązania.** Jeden słownik SSOT `src/components/Finance/labels/financeEnums.ts`
(mapa kod → klucz i18n) + komplet kluczy w `pl` i `en`. Renderowanie stanu **zawsze** przez ten
resolver; surowy kod nigdy nie trafia do JSX. Nazwy własne metod (DCF, FCFF, WACC, EBITDA, NPV, IRR)
**zostają** — to terminy, nie angielszczyzna (`FINANSE_ZALOZENIA_CTO_20260905.md` §2).
Zakazy: nowe komponenty tabel, `primary-*`, flagi.

**§5 Kroki.**
1. (S) `financeEnums.ts` + klucze `pl`/`en` dla 9 kodów stanu i 6 kodów gotowości.
2. (M) `FinanceValuePanelsSurface.tsx` — 21 etykiet + `aria-label` + fallback przez `t()`.
3. (M) 7 brakujących kluczy dopisać do `pl` i `en`.
4. (M) 17 kluczy z angielską treścią przetłumaczyć w `pl` (nie ruszać `en`).
5. (M) 20 twardych napisów JSX owinąć w `t()` z kluczem `finance.*`.
6. (S) Podpiąć resolver w `FinancePreviewPanel.tsx` (pole „Stan pakietu") i w kolumnie `STATUS`
   `FinanceHub.tsx`.

**§6 Testy.** Jednostkowe: `financeEnums.test.ts` — każdy z 15 kodów ma tłumaczenie ≠ kod;
**dowód mutacyjny**: usuń jeden wpis z mapy → test spada z komunikatem „kod X renderuje się surowo"
(celuje w zabezpieczenie „użytkownik nigdy nie widzi enumu", nie w mechanizm mapowania).
Wizualne: 5 zrzutów list + 2 karty N, 1440 px, jasny.

**§7 Kryterium odbioru właściciela.** Na `/finance` w żadnej z pięciu zakładek ani w podglądzie
nie ma angielskiego słowa poza nazwami metod finansowych.

**§8 Ryzyka i cofanie.** Ryzyko: nadgorliwe tłumaczenie nazw metod. Zabezpieczenie: lista wyjątków
w nagłówku `financeEnums.ts`. Cofanie: `git revert` — paczka nie dotyka danych.

**§9 Nakład.** Sonnet 1 sesja. Równolegle z F‑M2 i F‑M5.

**§10 Cel osiągnięty = samokontrola Codexa.**
- `npx esbuild --bundle --loader:.tsx=tsx --outfile=/dev/null <każdy dotknięty plik>` → exit 0.
- `npx vitest run src/components/Finance src/components/Economics` → 0 failed, liczba testów
  ≥ stan przed zmianą.
- `node scripts/dev/audyt-award-20260905/stoplista-en.mjs --zakres=src/components/Finance,src/components/Economics`
  (jeśli brak — napisać jednorazowy licznik w scratchpadzie wg wzoru z F0 §3.3) → **0 trafień**
  z listy: `Banking value, Cash forecast, Driver planner, Driver tree, Extended ratios, Headcount
  planner, Investment appraisal, Rolling forecast, Valuation visuals, Value attribution, Value
  capture pipeline, Value ledger, Value office, Variance bridge, Variance narration, EV basket,
  Monte Carlo NPV, Real options, Efficient frontier, What-if sensitivity, Scenario compute,
  Validation results, Delete, Loading panel, Draft, In Review, Approved`.
- `grep -rnE "MISSING_|INVALID_|HAS_PENDING_" src/components/Finance src/components/Economics --include="*.tsx" | grep -v __tests__ | grep -v financeEnums`
  → **0 linii**.
- Zrzuty (`ODBIOR_AUTH_STATE` ustawione, sesja odświeżona):
  `node scripts/dev/odbior-zywo/zrzut.mjs --url=/finance?tab=statements --out=evidence/finanse-f1/M1-statements.png --dom=aside --czekaj=3500`
  — w `.json` progi: `bledyKonsoli = 0`, `dom.aside.count ≤ 1`.
- **STOP:** wszystkie progi spełnione → commit + raport. Próg niespełnialny (np. napis przychodzi
  z serwera) → zatrzymać się i opisać, **nie obchodzić** twardym `replace` w komponencie.
- Zakazy: `--no-verify`, `git stash`, nowe flagi, nowe komponenty tabel.

**§11 Wklejka dla Codexa.**

```
ZADANIE F-M1 — Koniec angielskiego i kodów enum w module Finanse (Consultify).

KATALOG ROBOCZY: świeży worktree z origin/staging.
  git fetch origin && git worktree add /private/tmp/f-m1 -b codex/f-m1-finanse-pl origin/staging
  cd /private/tmp/f-m1
COMMIT PER KROK, BEZ PUSH. Nie pytaj właściciela o nic — niejasność rozstrzygnij i opisz w commicie.

CEL (§1): w całym module Finanse nie ma ani jednego angielskiego napisu ani kodu technicznego.
Stan pakietu ma brzmieć po polsku ("Wymaga uzupełnienia: brak rachunku wyników, brak przepływów"),
nie MISSING_PLAN, MISSING_CF.

PROJEKT (§4): jeden słownik SSOT src/components/Finance/labels/financeEnums.ts (kod -> klucz i18n)
plus komplet kluczy w public/locales/pl/translation.json i public/locales/en/translation.json.
Surowy kod nigdy nie trafia do JSX — zawsze przez resolver.
ZOSTAJĄ bez tłumaczenia nazwy własne metod: DCF, FCFF, WACC, EBITDA, NPV, IRR, EV, P/E, EV/S, CAGR,
DSO, DIO, DPO, CCC, DSCR, Altman Z. Wypisz tę listę w nagłówku financeEnums.ts.
ZAKAZY: nowe komponenty tabel, klasy primary-* (to crimson #85182F), nowe flagi.

KROKI (§5):
1. Utwórz financeEnums.ts z mapą dla 9 kodów stanu (DRAFT, READY_FOR_REVIEW, IN_REVIEW, APPROVED,
   CHANGES_REQUESTED, WITHDRAWN, INVALIDATED, REOPENED, SUPERSEDED — potwierdź listę
   grep-em po finance_business_versions w server/migrations) i 6 kodów gotowości pakietu
   (MISSING_PLAN, MISSING_CF, INVALID_PERIOD_COUNT, INVALID_MEMBER_COUNT, MISSING_PERIOD_STATEMENT,
   HAS_PENDING_STATEMENT).
2. src/components/Economics/FinanceValuePanelsSurface.tsx: 21 etykiet z mapy LABELS (linie ~79-101)
   przenieś na t('finance.valuePanels.<id>', '<PL>'); to samo z aria-label (~:116) i "Loading panel…" (~:131).
3. Dopisz do pl i en 7 brakujących kluczy: finance.blocked, common.status.draft, common.status.review,
   common.status.approved, finance.model.seededFromManualBaseline, finance.model.manualBaselineHint,
   finance.model.manualModeNotice.
4. Popraw w pl 17 kluczy trzymających angielski/hybrydę — m.in. finance.toast.statementConfirmed
   ("Statement potwierdzony" -> "Sprawozdanie potwierdzone"), finance.m16.sensitivity.addDriver
   ("+ driver" -> "+ czynnik"), finance.model.valuateModel ("Wycen model" -> "Wyceń model").
   Pełną listę wyprodukuj sam skryptem porównującym default z t(k,default) z wartością w pl.
5. Owiń w t() 20 twardych napisów JSX; zacznij od StatementValidationBadges.tsx (~:41
   "Validation results"), EvidencePanel.tsx (~:295 "Delete", ~:403 "Select category (optional)"),
   ExcelImportWizard.tsx (~:332 "Status", ~:346 "Nazwa analysis"), VersionHistoryPanel.tsx
   (~:193 "Historia version", ~:269 "Nazwa version (opcjonalnie)"),
   charts/DistributionHistogram.tsx (~:78, ~:93).
6. Podepnij resolver w FinancePreviewPanel.tsx (pole "Stan pakietu") i w kolumnie STATUS
   w FinanceHub.tsx.

TESTY (§6): dodaj src/components/Finance/labels/__tests__/financeEnums.test.ts — każdy z 15 kodów
ma tłumaczenie różne od samego kodu. DOWÓD MUTACYJNY: usuń jeden wpis z mapy, uruchom test, pokaż
w raporcie że spadł, przywróć wpis. Mutacja ma celować w zabezpieczenie "użytkownik nigdy nie widzi
enumu", nie w mechanizm mapowania.

SAMOKONTROLA (§10) — uruchom i wklej wyniki do raportu:
  npx esbuild --bundle --loader:.tsx=tsx --outfile=/dev/null <każdy dotknięty plik>   # exit 0
  npx vitest run src/components/Finance src/components/Economics                       # 0 failed
  grep -rnE "MISSING_|INVALID_|HAS_PENDING_" src/components/Finance src/components/Economics --include="*.tsx" | grep -v __tests__ | grep -v financeEnums
      # oczekiwane: 0 linii
  bash scripts/check-list-canon.sh        # exit 0, "dług nie rośnie"
Napisz w scratchpadzie licznik stop-listy EN i pokaż 0 trafień dla:
  Banking value, Cash forecast, Driver planner, Driver tree, Extended ratios, Headcount planner,
  Investment appraisal, Rolling forecast, Valuation visuals, Value attribution, Value capture pipeline,
  Value ledger, Value office, Variance bridge, Variance narration, EV basket, Monte Carlo NPV,
  Real options, Efficient frontier, What-if sensitivity, Scenario compute, Validation results,
  Delete, Loading panel, Draft, In Review, Approved

WARUNEK STOP: wszystkie progi spełnione -> commit + raport. Próg niespełnialny bez decyzji
właściciela (np. napis przychodzi z serwera) -> ZATRZYMAJ SIĘ i opisz; nie obchodź twardym replace.
ZAKAZY: --no-verify, git stash, push, nowe flagi, nowe komponenty tabel, pytania do właściciela.
```

---

## F‑M2 — Czerwień i kanon tabel w Finansach

**§1 Cel.** W Finansach czerwień pojawia się wyłącznie przy błędzie spójności (bilans się nie
domyka) lub odrzuceniu — nigdzie indziej; żadna lista rekordów nie ma własnej tabeli.

**§2 Zakres.** 9 plików z `primary-*` (34 wystąpienia) + 13 nieoznaczonych `<table>` w 9 plikach.

**§3 Przyczyna.** `primary` w tailwind = crimson `#85182F` (CLAUDE.md §3). Wystąpienia:
`ExportToOutputDialog.tsx` (12), `AIRecommendationsPanel.tsx` (7), `VersionHistoryPanel.tsx` (5),
`FinanceLanePanel.tsx` (3), `ExportButton.tsx` (2), `EvidencePanel.tsx` (2),
`StatementExplainPanel.tsx` (1), `FinancialModelWorkspace.tsx` (1), `FinanceVersionTimeline.tsx` (1).
Nieoznaczone `<table>`: `FinancialModelWorkspace.tsx:1768,1935`, `FinancialStatementMappingEditor.tsx:313`,
`FinancialStatementWorkspace.tsx:1021`, `InitiativeBusinessCaseCard.tsx:227`,
`ModelVersionHistory.tsx:98,222`, `BenefitsTrackingDashboard.tsx:377`, `FinancePreviewPanel.tsx:285,834`,
`FinanceModelDocumentView.tsx:228`, `ValueLedgerPanel.tsx:292`, `ValueCapturePipelinePanel.tsx:233,339`.

**§4 Projekt.** `primary-*` → tokeny `c-*` (`c-accent` dla stanu aktywnego, `c-focus` dla fokusu,
`c-danger` **tylko** dla błędu spójności/odrzucenia). Każdy `<table>`: albo rozstrzygnąć jako
archetyp Excel i oznaczyć `§27-exempt` z uzasadnieniem w komentarzu, albo — jeśli to lista rekordów
(kolumny = encje, jest kebab/preview) — **przepisać na `StandardTable`**. Zakaz tworzenia nowego
komponentu tabeli.

**§5 Kroki.** 1. (M) 34 zamiany `primary-*` → `c-*`. 2. (M) klasyfikacja 13 tabel: Excel czy lista.
3. (M) oznaczenie tabel Excel. 4. (L) przepisanie tabel-list na `StandardTable` (spodziewane 2–3:
`ModelVersionHistory`, `BenefitsTrackingDashboard`).

**§6 Testy.** `npx vitest run src/components/Finance src/components/Economics`.
Wizualne: 4 zrzuty (Sprawozdania, Modele, Wycena, karta modelu) jasny + ciemny, 1440 px.
**Dowód mutacyjny:** przywróć jedną klasę `primary-500` → `scripts/check-list-canon.sh` /
`check-artefakt.sh` musi to złapać; jeśli nie łapie, dopisz regułę zamiast obchodzić.

**§7 Odbiór.** Na czterech ekranach Finansów nie ma ani jednego czerwonego elementu poza realnym
błędem.

**§8 Ryzyka.** Ryzyko: `c-accent` nie istnieje w palecie danego miejsca → zamiana daje niewidoczny
przycisk. Zabezpieczenie: zrzut jasny **i** ciemny po każdym pliku. Cofanie: `git revert`.

**§9 Nakład.** Sonnet 1 sesja, równolegle z F‑M1.

**§10 Samokontrola.**
- `grep -rn "primary-" src/components/Finance src/components/Economics --include="*.tsx" | grep -v __tests__ | grep -vE "^\S+:[0-9]+:\s*(\*|//)"` → **0 linii**.
- `grep -rn "<table" src/components/Finance src/components/Economics --include="*.tsx" | grep -v __tests__ | grep -v "§27-exempt"` → **0 linii**.
- `bash scripts/check-list-canon.sh` → exit 0, „dług nie rośnie" (dopuszczalny **spadek**).
- `bash scripts/check-artefakt.sh` → exit 0.
- Zrzuty jasny+ciemny: `mean_luma` obu obrazów różni się o **> 40** (bezpiecznik pary
  light/dark — [[duplikat-zamiast-motywu]]), `bledyKonsoli = 0`.
- **STOP** jak w F‑M1.

**§11 Wklejka.**

```
ZADANIE F-M2 — Czerwień i kanon tabel w module Finanse (Consultify).

KATALOG: git worktree add /private/tmp/f-m2 -b codex/f-m2-finanse-kanon origin/staging ; cd /private/tmp/f-m2
COMMIT PER KROK, BEZ PUSH, bez pytań do właściciela.

CEL: czerwień w Finansach tylko przy błędzie spójności bilansu lub odrzuceniu; żadna LISTA REKORDÓW
nie ma własnej tabeli (tylko StandardTable).

TŁO KANONU: klasa primary-* w tailwind tego repo to crimson #85182F (semantyka krytyczna).
Stan aktywny i CTA = neutralne tokeny c-*, fokus = c-focus, błąd = c-danger.
Tabela wolno zostać surowym <table> TYLKO gdy to archetyp Excel/arkusz (komórki-liczby, zero kebaba,
zero preview, kolumny to okresy albo pola jednej edycji) — wtedy MUSI mieć znacznik §27-exempt
z uzasadnieniem w komentarzu na otwierającym tagu. Lista rekordów = StandardTable, bez wyjątków.
ZAKAZ tworzenia nowego komponentu tabeli.

KROK 1 — 34 wystąpienia primary-* w 9 plikach (zamień na c-*):
  ExportToOutputDialog.tsx (12), AIRecommendationsPanel.tsx (7), VersionHistoryPanel.tsx (5),
  FinanceLanePanel.tsx (3), ExportButton.tsx (2), EvidencePanel.tsx (2),
  StatementExplainPanel.tsx (1), FinancialModelWorkspace.tsx (1), FinanceVersionTimeline.tsx (1).
  Znajdź je: grep -rn "primary-" src/components/Finance src/components/Economics --include="*.tsx" | grep -v __tests__

KROK 2 — sklasyfikuj 13 nieoznaczonych <table> (Excel vs lista rekordów):
  FinancialModelWorkspace.tsx:1768,1935 ; FinancialStatementMappingEditor.tsx:313 ;
  FinancialStatementWorkspace.tsx:1021 ; InitiativeBusinessCaseCard.tsx:227 ;
  ModelVersionHistory.tsx:98,222 ; BenefitsTrackingDashboard.tsx:377 ;
  FinancePreviewPanel.tsx:285,834 ; FinanceModelDocumentView.tsx:228 ;
  ValueLedgerPanel.tsx:292 ; ValueCapturePipelinePanel.tsx:233,339
KROK 3 — Excel: dopisz §27-exempt + jedno zdanie uzasadnienia.
KROK 4 — lista rekordów: przepisz na StandardTable (spodziewane 2-3 pliki).

SAMOKONTROLA — uruchom i wklej wyniki:
  grep -rn "primary-" src/components/Finance src/components/Economics --include="*.tsx" | grep -v __tests__ | grep -vE "^\S+:[0-9]+:\s*(\*|//)"     # 0 linii
  grep -rn "<table" src/components/Finance src/components/Economics --include="*.tsx" | grep -v __tests__ | grep -v "§27-exempt"                    # 0 linii
  bash scripts/check-list-canon.sh     # exit 0, dług nie rośnie
  bash scripts/check-artefakt.sh       # exit 0
  npx vitest run src/components/Finance src/components/Economics   # 0 failed
ZRZUTY: cztery ekrany (Sprawozdania, Modele, Wycena, karta modelu) w jasnym i ciemnym, 1440 px.
  Próg: mean_luma pary jasny/ciemny różni się o WIĘCEJ NIŻ 40 (inaczej to ten sam obraz pod dwiema
  nazwami), bledyKonsoli = 0 w każdym .json.
DOWÓD MUTACYJNY: przywróć jedną klasę primary-500, pokaż że check-list-canon/check-artefakt ją
łapie, cofnij. Jeśli NIE łapie — dopisz regułę do bezpiecznika, nie obchodź go.

WARUNEK STOP i ZAKAZY: jak wyżej (--no-verify, git stash, push, nowe flagi — zabronione).
```

---

## F‑M3 — Lista Sprawozdań w kanonie: źródło, brak ucinania, gotowość po polsku

**§1 Cel.** Na liście Sprawozdań właściciel widzi, z jakiego dokumentu powstał każdy wiersz, żadna
kolumna nie jest ucięta bez dymka, a stan i gotowość są po polsku.

**§2 Zakres.** `FinanceHub.tsx` (definicja kolumn `:1657-1780`), `FinancePreviewPanel.tsx`,
`useFinanceData.ts`; 1 ekran listy + podgląd.

**§3 Przyczyna.**
- Brak kolumny „Sprawozdanie źródłowe" — wymóg właściciela z `FINANSE_ZALOZENIA_CTO_20260905.md`
  §6 pkt 2, niezrealizowany w żadnej z czterech list.
- `evidence/audyt-award-20260905/finanse/01-lista.png`: nagłówki `KOMPLETN…`, `WA…`, `STATU…`
  ucięte; wartości chipów „Sz…", „Pr…", „Za…"; przycisk „Importuj sprawozdanie" przykryty stałym
  prawym panelem (~380 px).
- Kolumna kompletności renderuje „—P&L / BS / —CF" (myślnik sklejony z nazwą sekcji zamiast
  osobnego znaku braku).

**§4 Projekt.** (a) Nowa kolumna `sourceStatement` zasilana z `GET /finance-v2/versions/:bv/lineage`
(endpoint istnieje) — jedna lub kilka nazw, każda klikalna do pakietu w zatwierdzonej wersji;
przy braku źródła stan uczciwy „bez sprawozdania źródłowego", nie pusta komórka.
(b) Ucinanie: **nie** dodawać własnego mechanizmu — wpiąć się w naprawę z paczki `P2_TABELA_NIE_UCINA.md`
(jedno źródło: `FilterableTable`); jeśli P2 jeszcze nie scalona, ustawić `min-width` kolumn
i poziomy scroll kontenera, nigdy `text-overflow` bez `title`.
(c) Renderowanie zakresu: `—` jako osobny znak braku sekcji, nie prefiks.
(d) Stan/gotowość: resolver z F‑M1.

**§5 Kroki.** 1. (M) kolumna źródła + klient lineage w `useFinanceData`. 2. (S) naprawa „—P&L".
3. (S) `min-width` + `title` na nagłówkach. 4. (S) podpięcie resolvera. 5. (S) prawy panel
domyślnie zwinięty na ekranach z tabelą (zgodnie z `P1_JEDEN_PANEL_ZWIJANY.md`).

**§6 Testy.** `FinanceHub.statements.columns.test.tsx` — kolumna źródła renderuje nazwę pakietu,
a przy braku krawędzi tekst „bez sprawozdania źródłowego" (**nie** pusty string).
**Dowód mutacyjny:** zamień fallback na `''` → test spada (celuje w zabezpieczenie „brak źródła jest
widoczny", §6 pkt 5 założeń CTO).

**§7 Odbiór.** Na liście Sprawozdań przy 1440 px widać całą kolumnę STATUS i kolumnę
„Sprawozdanie źródłowe", nic nie jest ucięte bez dymka.

**§8 Ryzyka.** Ryzyko: `GET /lineage` per wiersz = N+1 zapytań. Zabezpieczenie: jedno zapytanie
zbiorcze `POST /versions/lineage-edges` w trybie odczytu albo pole w odpowiedzi listy — jeśli
serwer nie ma zbiorczego odczytu, **zatrzymać się** i zgłosić (to praca backendowa, nie obejście
pętlą w kliencie).

**§9 Nakład.** Sonnet 1 sesja. Zależy od F‑M1.

**§10 Samokontrola.**
- `npx vitest run src/components/Economics/__tests__` → 0 failed.
- Zrzut `--url=/finance?tab=statements --dom=aside --dom=th --czekaj=3500`; progi w `.json`:
  `bledyKonsoli = 0`, `dom.aside.count ≤ 1`, **zero elementów `th` ze `scrollWidth > clientWidth`**
  (dopisz `--dom=th` i sprawdź prostokąty), liczba kolumn ≥ 10.
- `bash scripts/check-list-canon.sh` → exit 0.
- Porównanie z obrazem odniesienia `evidence/audyt-award-20260905/finanse/01-lista.png`:
  identyczna ma zostać liczba wierszy (14) i chipy stanu; **zmienić się ma** obecność kolumny źródła
  i brak wielokropków w nagłówkach.

**§11 Wklejka.**

```
ZADANIE F-M3 — Lista Sprawozdań w kanonie (Consultify, moduł Finanse).

KATALOG: git worktree add /private/tmp/f-m3 -b codex/f-m3-lista-sprawozdan origin/staging ; cd /private/tmp/f-m3
ZALEŻNOŚĆ: F-M1 (słownik financeEnums.ts) musi być scalona do origin/staging przed startem.
COMMIT PER KROK, BEZ PUSH, bez pytań do właściciela.

CEL: na liście Sprawozdań widać, z jakiego dokumentu powstał każdy wiersz; żadna kolumna nie jest
ucięta bez dymka; stan i gotowość po polsku.

KROK 1 — nowa kolumna "SPRAWOZDANIE ŹRÓDŁOWE" w src/components/Economics/FinanceHub.tsx
(definicje kolumn ok. linii 1657-1780). Dane: GET /api/v8/finance-v2/versions/:businessVersionId/lineage
(endpoint istnieje: server/src/routes/v8/finance-v2/crosscutting.routes.ts ~:39).
Jedna lub kilka nazw, każda klikalna do pakietu w zatwierdzonej wersji.
GDY BRAK KRAWĘDZI: renderuj tekst "bez sprawozdania źródłowego", NIGDY pusty string ani "—".
To wymóg właściciela (docs/program/grafika/FINANSE_ZALOZENIA_CTO_20260905.md §6 pkt 2 i pkt 5).
UWAGA WYDAJNOŚĆ: nie rób zapytania per wiersz. Jeśli serwer nie ma odczytu zbiorczego dla wielu
business_version_id naraz — ZATRZYMAJ SIĘ i zgłoś to jako brakującą pracę backendową. Nie obchodź
pętlą w kliencie.

KROK 2 — kolumna kompletności renderuje dziś "—P&L / BS / —CF" (myślnik sklejony z nazwą sekcji).
Ma być: obecna sekcja = jej nazwa, brakująca = osobny znak "—". Dowód stanu dzisiejszego:
evidence/audyt-award-20260905/finanse/01-lista.png

KROK 3 — nagłówki KOMPLETN…, WA…, STATU… są ucięte bez dymka. NIE buduj własnego mechanizmu:
najpierw sprawdź, czy scalona jest paczka P2_TABELA_NIE_UCINA.md (jedno źródło: FilterableTable).
Jeśli tak — wepnij się w nią. Jeśli nie — ustaw min-width kolumn i poziomy scroll kontenera,
plus atrybut title na nagłówku. Zakaz text-overflow bez title.

KROK 4 — pole "Stan pakietu" w FinancePreviewPanel.tsx i kolumna STATUS w liście: przez resolver
z financeEnums.ts (F-M1). Zero surowych kodów.

KROK 5 — prawy panel Teresy domyślnie zwinięty na ekranach z tabelą (patrz
docs/program/PROGRAM_NAPRAWCZY_20260905/P1_JEDEN_PANEL_ZWIJANY.md — jeśli scalona, użyj jej
mechanizmu; jeśli nie, pomiń ten krok i napisz o tym w raporcie).

TESTY: dodaj src/components/Economics/__tests__/FinanceHub.statements.columns.test.tsx —
kolumna źródła renderuje nazwę pakietu, a przy braku krawędzi tekst "bez sprawozdania źródłowego".
DOWÓD MUTACYJNY: zamień fallback na pusty string, pokaż że test spada, cofnij.

SAMOKONTROLA — uruchom i wklej:
  npx vitest run src/components/Economics/__tests__          # 0 failed
  bash scripts/check-list-canon.sh                            # exit 0
  node scripts/dev/odbior-zywo/zrzut.mjs --url="/finance?tab=statements" --out=evidence/finanse-f1/M3-lista.png --dom=aside --dom=th --czekaj=3500
Progi w evidence/finanse-f1/M3-lista.png.json:
  bledyKonsoli = 0 ; dom.aside.count <= 1 ; ZERO elementów th, których scrollWidth > clientWidth ;
  liczba kolumn >= 10 ; na obrazie widoczna kolumna "SPRAWOZDANIE ŹRÓDŁOWE".
OBRAZ ODNIESIENIA: evidence/audyt-award-20260905/finanse/01-lista.png — ta sama liczba wierszy (14)
i te same chipy stanu; RÓŻNICA ma być tylko taka: jest kolumna źródła, nie ma wielokropków w nagłówkach.

WARUNEK STOP: progi spełnione -> commit + raport. Nie da się bez decyzji -> zatrzymaj i opisz.
ZAKAZY: --no-verify, git stash, push, nowe flagi, nowe komponenty tabel, pytania do właściciela.
```

---

## F‑M4 — Karta N Sprawozdania na powłoce artefaktu

**§1 Cel.** Sprawozdanie otwiera się jako **dokument podstawowy**: trzy pełne tabele
RZiS · Bilans · CF (okres + porównawczy), z rodowodem i historią w jednym prawym panelu.

**§2 Zakres.** `src/components/Finance/statementPackWorkspaceV2/**` (7 komponentów),
`FinanceHub.tsx` (gałąź montażu `:3519`). 1 karta N.

**§3 Przyczyna.** `StatementPackWorkspaceV2` renderuje sekcje zwijane, ale **nie stoi na powłoce
artefaktu**: brak `ArtifactRightPanel` z akordeonem (Właściwości · Rodowód · Źródła · Komentarze ·
Historia · Teresa) i brak Menu 3 (Dane · Walidacja · Raporty). Sekcja „Powiązane" pokazuje
„Brak powiązań" (`evidence/audyt-award-20260905/finanse/02-sprawozdanie-detal.png`), bo krawędzi
nikt nie tworzy; sekcja Rodowód nie istnieje.

**§4 Projekt.** Archetyp **D — Matryca** wg `ARTIFACT_ANATOMY_STANDARD.md` §13.4 i §11.2:
powłoka wspólna (Menu 1 z okruszkiem `Finanse › Sprawozdania › DBR77 2025`, Menu 3 = Dane ·
Walidacja · Raporty, kebab pionowy, prawy panel accordion `ArtifactRightPanel`). Centrum zmienia
tylko treść: trzy tabele `<table §27-exempt>` (archetyp Excel), pozycje w wierszach z hierarchią
i roll-upem, okresy w kolumnach (okres + porównawczy), liczby do prawej, sumy pogrubione, waluta
i jednostka w nagłówku. Zakaz własnej powłoki i własnego prawego panelu.

**§5 Kroki.** 1. (M) osadzić `ArtifactRightPanel` z sześcioma sekcjami. 2. (M) Menu 3.
3. (L) `deriveStatementTable.ts` → trzy tabele z hierarchią zamiast płaskiej listy.
4. (S) sekcja Rodowód czytająca `/versions/:bv/lineage`. 5. (S) stan uczciwy, gdy brak linii:
„Sprawozdanie nie ma jeszcze zmapowanych linii — zmapuj je w kroku Dane", **nie** pusta tabela zer.

**§6 Testy.** `StatementPackWorkspaceV2.artifactShell.test.tsx`: dokładnie **jeden** `aside`,
sześć sekcji akordeonu, trzy tabele z `§27-exempt`. **Dowód mutacyjny:** usuń `ArtifactRightPanel`
→ test spada na liczbie `aside` (celuje w zabezpieczenie „jeden panel", nie w mechanizm renderu).

**§7 Odbiór.** Właściciel otwiera sprawozdanie DBR77 2025 i widzi trzy pełne tabele z okresem
porównawczym oraz jeden zwijany panel po prawej.

**§8 Ryzyka.** Ryzyko: przy braku `finance_stmt_lines` (przed F‑M5) tabele będą puste — to jest
**oczekiwane**, ma pokazać uczciwy stan, nie zera. Cofanie: flaga `financeStatementPackWorkspaceV2`
jest ON; awaryjny rollback = lokalny override OFF, nie zmiana domyślnej.

**§9 Nakład.** Opus 1,5 sesji. Zależy od F‑M1, F‑M3.

**§10 Samokontrola.**
- `npx vitest run src/components/Finance/statementPackWorkspaceV2` → 0 failed.
- `bash scripts/check-artefakt.sh` → exit 0.
- Zrzut karty z **rozwiniętymi wszystkimi sekcjami** (`--klik` na każdą; zwinięta sekcja nie jest
  dowodem — [[zwinieta-sekcja-nie-jest-dowodem]]), `--dom=aside --dom=table`; progi:
  `bledyKonsoli = 0`, `dom.aside.count = 1`, `dom.table.count = 3`.
- Zrzut jasny i ciemny, `mean_luma` różni się o > 40.

**§11 Wklejka.**

```
ZADANIE F-M4 — Karta N Sprawozdania na powłoce artefaktu (Consultify, Finanse).

KATALOG: git worktree add /private/tmp/f-m4 -b codex/f-m4-karta-sprawozdania origin/staging ; cd /private/tmp/f-m4
ZALEŻNOŚĆ: F-M1 i F-M3 scalone. COMMIT PER KROK, BEZ PUSH, bez pytań do właściciela.

CEL: sprawozdanie otwiera się jako dokument podstawowy — trzy pełne tabele RZiS / Bilans / CF
(okres + porównawczy), z rodowodem i historią w JEDNYM prawym panelu.

KANON (obowiązkowy, przeczytaj przed kodem):
  Harvard/wdrozenie-100/ARTIFACT_ANATOMY_STANDARD.md — §10.2 i §11.2 (powłoka wspólna A-E)
  oraz §13.4 (archetyp D — MATRYCA: Menu 3 = Dane / Mapa-Wizualizacja / Raporty).
  docs/ui-standards/TRIADA_KANON.md — tokeny c-*, zero primary-*.
Powłoka jest WSPÓLNA i nietykalna: Menu 1 z okruszkiem "Finanse › Sprawozdania › DBR77 2025",
Menu 3, kebab pionowy, prawy panel accordion ArtifactRightPanel z sekcjami:
Właściwości · Rodowód · Źródła · Komentarze · Historia · Teresa.
Archetyp zmienia TYLKO centrum. ZAKAZ własnej powłoki, własnego prawego panelu, drugiego <aside>.

PLIKI: src/components/Finance/statementPackWorkspaceV2/** (StatementPackWorkspaceV2.tsx,
CanonicalStatementTableV2.tsx, NamedCollapsibleSection.tsx, RelatedArtifactsSection.tsx,
SourceEvidencePanel.tsx, ReconciliationLedgerPanel.tsx, StatementReportActionsSection.tsx,
deriveStatementTable.ts) oraz gałąź montażu w src/components/Economics/FinanceHub.tsx (ok. :3519).

KROKI:
1. Osadź ArtifactRightPanel z sześcioma sekcjami (jeden panel, zwijany, Teresa jako zakładka).
2. Dodaj Menu 3: Dane · Walidacja · Raporty.
3. deriveStatementTable.ts: zamiast płaskiej listy zbuduj TRZY tabele (RZiS, Bilans, CF) z
   hierarchią pozycji i roll-upem sum. Każda jako <table> z komentarzem §27-exempt (archetyp Excel:
   komórki-liczby, kolumny to okresy, zero kebaba i preview). Okresy w kolumnach: okres + porównawczy.
   Liczby wyrównane do prawej, sumy pogrubione, waluta i jednostka w nagłówku tabeli.
4. Sekcja Rodowód czyta GET /api/v8/finance-v2/versions/:businessVersionId/lineage.
5. STAN UCZCIWY gdy brak zmapowanych linii: "Sprawozdanie nie ma jeszcze zmapowanych linii —
   zmapuj je w kroku Dane". NIGDY tabela wypełniona zerami. (Dziś podgląd pokazuje "Zmapowane
   linie 0 / 0" — dowód: evidence/audyt-award-20260905/finanse/02-sprawozdanie-detal.png.)
   Puste tabele na tym etapie są OCZEKIWANE — dane przychodzą dopiero z paczki F-M5.

TESTY: src/components/Finance/statementPackWorkspaceV2/__tests__/StatementPackWorkspaceV2.artifactShell.test.tsx
— dokładnie JEDEN element aside, sześć sekcji akordeonu, trzy tabele z §27-exempt.
DOWÓD MUTACYJNY: usuń ArtifactRightPanel z drzewa, pokaż że test spada na liczbie aside, cofnij.

SAMOKONTROLA — uruchom i wklej:
  npx vitest run src/components/Finance/statementPackWorkspaceV2      # 0 failed
  bash scripts/check-artefakt.sh                                       # exit 0
  bash scripts/check-list-canon.sh                                     # exit 0
ZRZUT (obowiązkowo z ROZWINIĘTYMI wszystkimi sekcjami — użyj --klik dla każdej; zwinięta sekcja
nie jest dowodem):
  node scripts/dev/odbior-zywo/zrzut.mjs --url="/finance/statements/<id>" --out=evidence/finanse-f1/M4-karta.png --klik="text=Rodowód" --klik="text=Źródła" --klik="text=Historia" --dom=aside --dom=table --pelna --czekaj=4000
Progi: bledyKonsoli = 0 ; dom.aside.count = 1 ; dom.table.count = 3.
Powtórz zrzut w ciemnym motywie — mean_luma pary musi różnić się o WIĘCEJ NIŻ 40.

WARUNEK STOP i ZAKAZY: jak w poprzednich paczkach.
```

---

## F‑M5 — Import zakłada kalendarz i okresy → pakiet `ready` (ogniwo 1)

**§1 Cel.** Po imporcie sprawozdania pakiet ma stan **Gotowy**, a nie „do poprawy", i ma w bazie
komplet okresów, na których stoi wszystko dalej.

**§2 Zakres.** Backend: `server/src/services/finance/canonical/financeImportService.ts`,
`statementMappingService.ts`, `financialStatementService.ts`; migracje **nie** są potrzebne
(tabele istnieją).

**§3 Przyczyna (pomiar F0 §2.3).** `finance_stmt_calendars` i `finance_stmt_periods` mają **zero**
`INSERT`-ów w kodzie produkcyjnym — jedyne są w `server/src/scripts/baselineContextOpeningPeriodRealDbProof.ts`
(`:105`, `:122`) i w testach. `statementMappingService.ts` wymaga, żeby `periodId` rozwiązał się do
istniejącego wiersza `finance_stmt_periods`, więc bez producenta mapowanie zapisuje 0 linii —
dokładnie to widać w podglądzie („Zmapowane linie 0 / 0").

**§4 Projekt.** Przy potwierdzeniu importu (`confirmAndRegisterStatementPack`) w **jednej
transakcji**: (1) załóż kalendarz organizacji, jeśli nie istnieje; (2) załóż okresy roczne/miesięczne
wynikające z rozpoznanego okresu i porównawczego, z poprawnym łańcuchem `previous_period_id`;
(3) dopiero potem rejestruj artefakt i BV. Idempotencja po kluczu (powtórny import tego samego
pliku nie tworzy drugiego kalendarza). Zero SQL ręcznego na żywej bazie.

**§5 Kroki.** 1. (M) `financeCalendarService.ts` — `ensureCalendar`, `ensurePeriods`.
2. (M) wpiąć w `confirmAndRegisterStatementPack` przed rejestracją artefaktu.
3. (M) `pack_readiness_status` → `ready`, gdy okresy i sekcje kompletne.
4. (S) mapowanie kodów gotowości na komunikat (współpraca z F‑M1).

**§6 Testy (realny Postgres, obowiązkowo).** `financeCalendarService.pg.test.ts`: po imporcie
w bazie jest dokładnie jeden kalendarz i N okresów o ciągłym `previous_period_id`; powtórny import
z tym samym kluczem nie tworzy drugiego kompletu. **Dowód mutacyjny:** usuń wywołanie `ensurePeriods`
→ test spada, mimo że artefakt dalej powstaje (celuje w zabezpieczenie „pakiet bez okresów jest
bezużyteczny", nie w mechanizm rejestracji).
**Kontrola negatywna obowiązkowa:** ta sama suita bez `RUN_DB_TESTS=1` musi zaraportować
`skipped`, nigdy `passed`.

**§7 Odbiór.** Właściciel importuje sprawozdanie DBR77 2025 i chip przy wierszu mówi **Gotowe**.

**§8 Ryzyka.** Ryzyko: okresy założone z błędnym typem (`period_type`) zablokują ogniwo 6
(`INVALID_CONTEXT_PERIOD` wymaga `MONTH`, `baselineContextService.ts:506`). Zabezpieczenie: test
sprawdzający `period_type` wprost. Cofanie: `git revert`; wiersze okresów są addytywne — bez
rollbacku danych, ale **nie kasować** okresów już użytych w krawędziach.

**§9 Nakład.** Opus 1,5 sesji. Bez zależności — startuje pierwszego dnia.

**§10 Samokontrola.**
- `cd server && tsc --build tsconfig.build.json` → exit 0.
- Świeża jednorazowa baza + migracje, potem suita z bramką (komendy w §11); próg: **0 failed**,
  liczba testów w `financeCalendarService.pg.test.ts` ≥ 6.
- Kontrola negatywna: ta sama suita bez bramki → `skipped`, **nie** `passed`.
- Odczyt na zimno osobnym klientem `pg`: po przebiegu importu
  `SELECT count(*) FROM finance_stmt_periods WHERE organization_id = $1` → **> 0**.
- **STOP:** gdy `pack_readiness_status` nie może dojść do `ready` z powodu brakującej sekcji
  w pliku źródłowym — to jest stan uczciwy, nie błąd; opisz i nie wymuszaj.

**§11 Wklejka.**

```
ZADANIE F-M5 — Import zakłada kalendarz i okresy, pakiet osiąga stan "ready" (Consultify, Finanse,
ogniwo 1 programu F).

KATALOG: git worktree add /private/tmp/f-m5 -b codex/f-m5-okresy origin/staging ; cd /private/tmp/f-m5
COMMIT PER KROK, BEZ PUSH, bez pytań do właściciela.

CEL: po imporcie sprawozdania pakiet ma stan "Gotowy" i ma w bazie komplet okresów, na których
stoi cały łańcuch (analiza -> model -> scenariusz -> wycena).

PRZYCZYNA (zmierzona, nie hipoteza): tabele finance_stmt_calendars i finance_stmt_periods nie mają
ANI JEDNEGO producenta w kodzie produkcyjnym. Sprawdź sam:
  grep -rn "INSERT INTO finance_stmt_periods" server/src | grep -v __tests__ | grep -v "/scripts/"
  grep -rn "INSERT INTO finance_stmt_calendars" server/src | grep -v __tests__ | grep -v "/scripts/"
Oczekiwany wynik dzisiaj: PUSTO. Jedyne INSERT-y są w server/src/scripts/baselineContextOpeningPeriodRealDbProof.ts
(~:105 i ~:122) oraz w testach. Skutek: statementMappingService.ts wymaga, żeby periodId rozwiązał
się do istniejącego wiersza finance_stmt_periods — bez producenta mapowanie zapisuje 0 linii.
ZWERYFIKUJ TĘ LICZBĘ SAM zanim ruszysz kod; jeśli wyjdzie inaczej, napisz to w raporcie.

PROJEKT: przy potwierdzeniu importu (confirmAndRegisterStatementPack w
server/src/services/finance/canonical/statementPackRegistrationService.ts) w JEDNEJ transakcji:
  1. ensureCalendar — kalendarz organizacji, jeśli nie istnieje (idempotentnie),
  2. ensurePeriods — okresy wynikające z rozpoznanego okresu i porównawczego, z poprawnym
     łańcuchem previous_period_id i poprawnym period_type,
  3. dopiero potem rejestracja artefaktu i wersji biznesowej.
UWAGA KRYTYCZNA: baselineContextService.ts (~:506) wymaga period_type = 'MONTH' dla okresów
prognozy. Ustal i udokumentuj w komentarzu, jaki typ zakładasz dla okresów historii, żeby ogniwo 6
się o to nie rozbiło.
Idempotencja: powtórny import tego samego pliku NIE tworzy drugiego kalendarza ani drugiego
kompletu okresów.
ZAKAZ: ręcznego SQL na żywej bazie stagingu/dema.

KROKI:
1. Nowy server/src/services/finance/canonical/financeCalendarService.ts (ensureCalendar, ensurePeriods).
2. Wpięcie w confirmAndRegisterStatementPack PRZED rejestracją artefaktu.
3. pack_readiness_status -> 'ready' gdy okresy i sekcje kompletne.
4. Kody gotowości -> komunikat (współgra z paczką F-M1; jeśli F-M1 niescalona, zostaw kody i napisz o tym).

TESTY — TYLKO NA REALNYM POSTGRESIE:
  # jednorazowo: świeża baza + migracje
  DATABASE_URL=$(/Users/piotrwisniewski/fv3-pg/newdb.sh f-m5-okresy)
  npx tsx server/scripts/migrate.postgres.ts
  # suita z bramką (z katalogu server/)
  cd server && RUN_DB_TESTS=1 MOCK_DB=false NODE_ENV=test DB_TYPE=postgres DATABASE_URL="$DATABASE_URL" \
    npx vitest run --config vitest.config.ts src/services/finance/canonical --no-file-parallelism
  # KONTROLA NEGATYWNA (obowiązkowa) — ta sama suita BEZ bramki:
  cd server && npx vitest run --config vitest.config.ts src/services/finance/canonical
  # MUSI zaraportować "skipped", nigdy "passed". Jeśli "passed" — zieleń nie pochodzi z realnej bazy.
Nowy plik: server/src/services/finance/canonical/__tests__/financeCalendarService.pg.test.ts
(min. 6 testów): po imporcie dokładnie jeden kalendarz; N okresów o ciągłym previous_period_id;
poprawny period_type; powtórny import nie tworzy drugiego kompletu.
DOWÓD MUTACYJNY: usuń wywołanie ensurePeriods z confirmAndRegisterStatementPack — test MUSI spaść,
mimo że artefakt dalej powstaje. Mutacja celuje w zabezpieczenie "pakiet bez okresów jest
bezużyteczny", nie w mechanizm rejestracji. Pokaż wynik przed i po, cofnij.

SAMOKONTROLA — uruchom i wklej:
  cd server && npx tsc --build tsconfig.build.json     # exit 0
  (obie komendy testowe wyżej + kontrola negatywna)
  # odczyt na zimno OSOBNYM klientem pg po przebiegu importu:
  #   SELECT count(*) FROM finance_stmt_periods WHERE organization_id = $1;   -> musi być > 0
WARUNEK STOP: gdy pack_readiness_status nie może dojść do 'ready', bo w pliku źródłowym naprawdę
brakuje sekcji — to jest stan UCZCIWY, nie błąd. Opisz i NIE wymuszaj 'ready'.
ZAKAZY: --no-verify, git stash, push, nowe flagi, SQL na żywej bazie, pytania do właściciela.
```

---

## F‑M6 — Zatwierdzenie pakietu do `APPROVED` z UI (ogniwo 2)

**§1 Cel.** Właściciel klika „Skieruj do przeglądu", potem „Zatwierdź", i plakietka **Zatwierdzony**
przeżywa odświeżenie strony.

**§2 Zakres.** `StatementPackWorkspaceV2.tsx`, `financeVersionLifecycle.ts`, `FinanceWorkspaceBar.tsx`.

**§3 Przyczyna.** Endpointy istnieją (`POST /finance-v2/versions/:bv/transitions`,
`versions.routes.ts:118`; `artifactVersionService.transition()`), klient też
(`transitionFinanceVersion` w `financeV2.api.ts`), a mimo to na wszystkich listach chip
„Zatwierdzone" pokazuje **0** (`evidence/audyt-award-20260905/finanse/06-modele-lista.png`).
Bramka: autor ≠ recenzent (`EDIT_ROLES`) — do zweryfikowania, czy blokuje właściciela.

**§4 Projekt.** Kontrolki cyklu życia w pasku karty N: „Skieruj do przeglądu" → „Zatwierdź" →
„Otwórz ponownie", z `expectedVersion` (optimistic locking) i komunikatem po polsku przy konflikcie.
Zero nowych endpointów.

**§5 Kroki.** 1. (S) potwierdzić `rg`-iem, że `StatementPackWorkspaceV2` woła `transitionFinanceVersion`
(9 trafień — sprawdzić, czy to ta ścieżka). 2. (M) rozstrzygnąć bramkę autor≠recenzent na realnej
bazie. 3. (M) komunikaty konfliktu wersji po polsku. 4. (S) odświeżenie chipów listy po przejściu.

**§6 Testy (realny PG).** `versions.routes.pg.test.ts`: `DRAFT → READY_FOR_REVIEW → APPROVED`
zmienia `finance_business_versions.status` (odczyt na zimno osobnym klientem `pg`, nie przez
warstwę aplikacji — [[dwa-dostepy-jedna-baza-rozne-odpowiedzi]]). **Dowód mutacyjny:** usuń
sprawdzenie `expectedVersion` → test wyścigu (dwa równoległe `approve`) musi wykryć podwójne
przejście.

**§7 Odbiór.** Pakiet DBR77 2025 ma plakietkę **Zatwierdzony** po odświeżeniu przeglądarki.

**§8 Ryzyka.** Ryzyko: zatwierdzenie jest **niezmienne** — zły pakiet zostaje. Zabezpieczenie:
potwierdzenie z nazwą pakietu w dialogu; pracujemy na **nowych** rekordach DBR77 (§F‑M7).

**§9 Nakład.** Sonnet 1 sesja. Zależy od F‑M5.

**§10 Samokontrola.** Suita `.pg` z bramką + kontrola negatywna (jak F‑M5); odczyt na zimno
`SELECT status FROM finance_business_versions WHERE business_version_id = $1` → `APPROVED`;
zrzut listy Sprawozdań z chipem „Zatwierdzone ≥ 1"; `bledyKonsoli = 0`.

**§11 Wklejka.**

```
ZADANIE F-M6 — Zatwierdzenie pakietu sprawozdań do APPROVED z UI (Consultify, Finanse, ogniwo 2).

KATALOG: git worktree add /private/tmp/f-m6 -b codex/f-m6-zatwierdzanie origin/staging ; cd /private/tmp/f-m6
ZALEŻNOŚĆ: F-M5 scalona (bez okresów pakiet nie dojdzie do ready). COMMIT PER KROK, BEZ PUSH.

CEL: właściciel klika "Skieruj do przeglądu", potem "Zatwierdź", i plakietka Zatwierdzony przeżywa
odświeżenie strony.

STAN DZISIEJSZY: endpointy i klient ISTNIEJĄ (POST /api/v8/finance-v2/versions/:businessVersionId/transitions,
server/src/routes/v8/finance-v2/versions.routes.ts ~:118 ; klient transitionFinanceVersion
w src/services/api/financeV2.api.ts), a mimo to chip "Zatwierdzone" pokazuje 0 na wszystkich listach
(dowód: evidence/audyt-award-20260905/finanse/06-modele-lista.png). Twoje zadanie to znaleźć POWÓD
i go usunąć, nie dodać nowy endpoint.

KROKI:
1. Potwierdź rg-iem, którą ścieżką woła StatementPackWorkspaceV2.tsx (9 trafień transitionFinanceVersion)
   i czy pasek FinanceWorkspaceBar w ogóle pokazuje akcje cyklu życia dla pakietu.
2. Rozstrzygnij na REALNEJ BAZIE bramkę autor != recenzent (EDIT_ROLES w warstwie kanonicznej):
   czy blokuje właściciela? Wymagana PARA dowodów: (a) obcy nie może zatwierdzić, (b) uprawniony
   MOŻE. Sam dowód (a) to "zamknięte przez wygaszenie" i nie wystarcza.
3. Komunikaty konfliktu wersji (expectedVersion / optimistic locking) po polsku.
4. Po przejściu odśwież chipy na liście.

TESTY — TYLKO REALNY POSTGRES (komendy i kontrola negatywna jak w paczce F-M5):
server/src/routes/v8/finance-v2/__tests__/versions.routes.pg.test.ts — przejście
DRAFT -> READY_FOR_REVIEW -> APPROVED zmienia finance_business_versions.status.
ODCZYT NA ZIMNO: sprawdź status OSOBNYM klientem pg, nie przez warstwę aplikacji.
DOWÓD MUTACYJNY: usuń sprawdzenie expectedVersion i pokaż, że test WYŚCIGU (dwa równoległe approve)
wykrywa podwójne przejście. Cofnij.

SAMOKONTROLA:
  cd server && npx tsc --build tsconfig.build.json          # exit 0
  suita .pg z bramką: 0 failed ; kontrola negatywna: "skipped", nigdy "passed"
  SELECT status FROM finance_business_versions WHERE business_version_id = '<bv>';   -> APPROVED
  node scripts/dev/odbior-zywo/zrzut.mjs --url="/finance?tab=statements" --out=evidence/finanse-f1/M6-zatwierdzony.png --dom=aside --czekaj=3500
  Progi: bledyKonsoli = 0 ; na obrazie chip "Zatwierdzone" z liczbą >= 1.

RYZYKO DO ZAPAMIĘTANIA: zatwierdzenie jest NIEZMIENNE — zły pakiet zostaje na zawsze. Dodaj do
dialogu potwierdzenia nazwę pakietu. Pracujemy na NOWYCH rekordach DBR77.
ZAKAZY: --no-verify, git stash, push, nowe flagi, pytania do właściciela.
```

---

## F‑M7 — Dane DBR77 i komplet zrzutów odbioru MINIMUM

**§1 Cel.** Właściciel dostaje jeden komplet obrazów pokazujących, że przepływ
import → pakiet Gotowy → Zatwierdzony działa na jego własnych danych.

**§2 Zakres.** Dane, nie kod. Kroki 1–4 planu danych z `F_FINANSE_PELNA_TABELA.md` §4.

**§3 Przyczyna.** Na stagingu leżą dwa pakiety DBR77 z Rundy 7
(`19ff7554-1e82-446b-b4d5-00981eba7c24`, `901581c8-0668-454e-98a1-ce316a6d9f10`) w stanie
`recoverable` i model `08b2fad8-…` bez kontekstu — nie do uratowania, bo krawędzie rodowodu są
append-only.

**§4 Projekt.** Komplet **od nowa**, wszystko przez UI, zero SQL. Starych rekordów **nie kasować**
bez decyzji właściciela.

**§5 Kroki.** 1. Import 2023 z por. 2022. 2. Import 2024 z por. 2023. 3. Import 2025 z por. 2024.
4. Zatwierdzenie pakietu 2025. 5. Komplet zrzutów.

**§6 Testy.** Nie dotyczy (dane). Weryfikacja = zrzuty + odczyt statusu.

**§7 Odbiór.** Właściciel widzi trzy lata historii DBR77 i plakietkę Zatwierdzony na 2025.

**§8 Ryzyka.** Dane demo są twarzą produktu — zero rekordów testowych, zero nazw typu „test".

**§9 Nakład.** Sonnet 1 sesja. Ostatnia w MINIMUM.

**§10 Samokontrola.** 6 zrzutów (lista, karta 2025 rozwinięta, podgląd, pasek po zatwierdzeniu,
1440 px jasny + ciemny) z `bledyKonsoli = 0` i `dom.aside.count ≤ 1`; w `.json` żadnego wpisu
o czasie ≥ 5000 ms.

**§11 Wklejka.**

```
ZADANIE F-M7 — Dane DBR77 i komplet zrzutów odbioru MINIMUM (Consultify, Finanse).

KATALOG: git worktree add /private/tmp/f-m7 -b codex/f-m7-dane-dbr77 origin/staging ; cd /private/tmp/f-m7
ZALEŻNOŚĆ: F-M1..F-M6 scalone do origin/staging. To paczka DANYCH, nie kodu — commituj tylko zrzuty
i raport.

ŚRODOWISKO: własny vite na wolnym porcie (cp /private/tmp/m03/.env.local .), backend = staging,
sesja właściciela w ODBIOR_AUTH_STATE. Jeśli sesja wygasła — ZATRZYMAJ SIĘ i zgłoś; nie loguj się
sam i nie wpisuj żadnych haseł.

CEL: jeden komplet obrazów pokazujący, że przepływ import -> pakiet Gotowy -> Zatwierdzony działa
na realnych danych DBR77.

KROKI (wszystko przez UI, ZERO SQL na żywej bazie, ZERO rekordów testowych — dane demo to twarz produktu):
1. Finanse -> Sprawozdania -> "Importuj sprawozdanie": sprawozdanie DBR77 2023 z porównawczym 2022.
   Warunek przejścia dalej: chip stanu = "Gotowe", nie "do poprawy".
2. To samo dla 2024 z porównawczym 2023.
3. To samo dla 2025 z porównawczym 2024 (trzy lata historii, o które prosił właściciel).
4. Podgląd pakietu 2025 -> "Skieruj do przeglądu" -> "Zatwierdź". Plakietka Zatwierdzony musi
   przeżyć odświeżenie strony (F5).
UWAGA: na stagingu leżą stare pakiety DBR77 z Rundy 7 (19ff7554-1e82-446b-b4d5-00981eba7c24 okres 2024,
901581c8-0668-454e-98a1-ce316a6d9f10 okres 2025) i model 08b2fad8-b072-4d02-8ec4-3ff6b948ce39 —
wszystkie nie do uratowania. NIE naprawiaj ich i NIE kasuj bez decyzji właściciela; twórz komplet od nowa.

ZRZUTY (6 sztuk, katalog evidence/finanse-f1/odbior-minimum/):
  1440-jasny: lista Sprawozdań ; karta 2025 z ROZWINIĘTYMI sekcjami ; podgląd 1-click ;
  pasek karty po zatwierdzeniu. Potem te same w ciemnym.
  node scripts/dev/odbior-zywo/zrzut.mjs --url=... --out=... --dom=aside --czekaj=3500 [--klik=...] [--pelna]
PROGI w każdym .json: bledyKonsoli = 0 ; dom.aside.count <= 1 ; czasMs < 5000.
Para jasny/ciemny: mean_luma musi różnić się o WIĘCEJ NIŻ 40.

RAPORT: tabela "co widać na każdym zrzucie" jednym zdaniem po polsku + wypisane wszystko, czego
NIE udało się osiągnąć, z powodem. Nie pisz "działa" bez obrazu.
ZAKAZY: --no-verify, git stash, push, SQL na żywej bazie, logowanie się jako właściciel, pytania
do właściciela.
```

---

# PEŁNY

---

## F‑P1 — Rejestr `finance_baseline_models` + trzy krawędzie (ogniwo 4)

**§1 Cel.** Utworzenie modelu bazowego zapisuje wiersz rejestru i podpina go do zatwierdzonego
pakietu i analizy — model przestaje być sierotą.

**§2 Zakres.** `server/src/services/financialModelingService.ts` (`createModel`, `:1393`),
nowy `baselineModelRegistrationService.ts`, `src/components/Economics/modals/CreateModelModal.tsx`.

**§3 Przyczyna.** `finance_baseline_models` — **zero** `INSERT`-ów produkcyjnych (F0 §6.3);
krawędzie `STATEMENT_TO_MODEL` i `ANALYSIS_TO_MODEL` — **zero** producentów, tylko odczyty.
`CreateModelModal.handleCreate` pisze wyłącznie legacy `financial_models`.

**§4 Projekt.** **Furtka, która skraca robotę:** ogólna trasa
`POST /api/v8/finance-v2/versions/lineage-edges` (`lineage-navigator.routes.ts:361`) przyjmuje
wszystkie osiem typów krawędzi z allowlisty — **nowego endpointu nie trzeba**, trzeba wołacza.
Po utworzeniu modelu: (1) `INSERT` do `finance_baseline_models` (horyzont, uzasadnienie,
parametry solvera); (2) dwie krawędzie przez istniejącą trasę; wszystko w jednej transakcji
z idempotencją.

**§5 Kroki.** 1. (M) `baselineModelRegistrationService.ts`. 2. (M) wpięcie w ścieżkę tworzenia
modelu. 3. (M) `CreateModelModal` — wybór zatwierdzonego pakietu **i** zatwierdzonej analizy
(dokładnie po jednej: bramki `BASELINE_SOURCE_AMBIGUOUS` / `BASELINE_ANALYSIS_AMBIGUOUS`).
4. (S) kolumny „Sprawozdanie źródłowe" i „Analiza źródłowa" w liście Modeli.

**§6 Testy (realny PG).** Po utworzeniu modelu: dokładnie jeden wiersz rejestru i dokładnie dwie
krawędzie o właściwych typach (odczyt na zimno). **Dowód mutacyjny:** usuń tworzenie krawędzi
`ANALYSIS_TO_MODEL` → test spada, mimo że model i rejestr powstają.

**§7 Odbiór.** Nowy model DBR77 pokazuje w liście nazwy swojego sprawozdania i swojej analizy.

**§8 Ryzyka.** Krawędzie są **append-only** (wyzwalacze `deny_update`/`deny_delete`,
`20260809_finance_v3_b03_lineage_freshness.sql:150-163`) — krawędź pod zły pakiet zostaje na zawsze.
Zabezpieczenie: dialog potwierdza nazwy przed zapisem. Wyzwalacz `prevent_cycle` może zwrócić surowy
`RAISE EXCEPTION` — sprawdzić, że użytkownik widzi polski komunikat (mapowanie istnieje
w `lineageService.ts`).

**§9 Nakład.** Opus 2 sesje. Zależy od F‑M6.

**§10 Samokontrola.** `tsc --build` exit 0; suita `.pg` + kontrola negatywna;
odczyt na zimno: `SELECT count(*) FROM finance_baseline_models WHERE business_version_id = $1` → 1,
`SELECT edge_type FROM finance_lineage_edges WHERE target_version_id = $1` → dokładnie
`{STATEMENT_TO_MODEL, ANALYSIS_TO_MODEL}`; zrzut listy Modeli z wypełnionymi kolumnami źródeł.

**§11 Wklejka.**

```
ZADANIE F-P1 — Rejestr finance_baseline_models i trzy krawędzie rodowodu (Consultify, Finanse,
ogniwo 4 programu F).

KATALOG: git worktree add /private/tmp/f-p1 -b codex/f-p1-rejestr-modelu origin/staging ; cd /private/tmp/f-p1
ZALEŻNOŚĆ: F-M6 scalona (musi istnieć zatwierdzony pakiet). COMMIT PER KROK, BEZ PUSH.

CEL: utworzenie modelu bazowego zapisuje wiersz rejestru i podpina go do zatwierdzonego pakietu
i zatwierdzonej analizy. Model przestaje być sierotą.

PRZYCZYNA (zweryfikuj sam przed startem):
  grep -rn "INSERT INTO finance_baseline_models" server/src | grep -v __tests__ | grep -v "/scripts/"
  -> dziś PUSTO. Krawędzie STATEMENT_TO_MODEL i ANALYSIS_TO_MODEL też nie mają producenta
  (tylko odczyty w baselineComputeService.ts i baselineContextService.ts).
  CreateModelModal.handleCreate pisze wyłącznie legacy financial_models
  (server/src/services/financialModelingService.ts createModel ~:1393).

FURTKA, KTÓRA SKRACA ROBOTĘ: ogólna trasa POST /api/v8/finance-v2/versions/lineage-edges
(server/src/routes/v8/finance-v2/lineage-navigator.routes.ts ~:361) przyjmuje WSZYSTKIE osiem typów
krawędzi z allowlisty, w tym STATEMENT_TO_MODEL i ANALYSIS_TO_MODEL. NIE twórz nowego endpointu —
dowieź wołacza.

KROKI:
1. Nowy server/src/services/finance/canonical/baselineModelRegistrationService.ts: w JEDNEJ
   transakcji INSERT do finance_baseline_models (horizon_months, horizon_rationale,
   circularity_max_iterations, circularity_tolerance_currency i pozostałe kolumny — przeczytaj
   schemat w server/migrations/20260809_finance_v3_d05_baseline_01_tables.sql) plus dwie krawędzie.
   Idempotencja po kluczu.
2. Wepnij w ścieżkę tworzenia modelu.
3. src/components/Economics/modals/CreateModelModal.tsx: wybór DOKŁADNIE JEDNEGO zatwierdzonego
   pakietu i DOKŁADNIE JEDNEJ zatwierdzonej analizy. Kontrakt baselineContextService.ts odrzuca
   zarówno brak (BASELINE_SOURCE_NOT_CONFIGURED), jak i wielokrotność (BASELINE_SOURCE_AMBIGUOUS).
4. Kolumny "SPRAWOZDANIE ŹRÓDŁOWE" i "ANALIZA ŹRÓDŁOWA" w liście Modeli (FinanceHub.tsx).

TESTY — REALNY POSTGRES (komendy i kontrola negatywna jak w F-M5):
po utworzeniu modelu w bazie jest DOKŁADNIE JEDEN wiersz finance_baseline_models i DOKŁADNIE DWIE
krawędzie o typach STATEMENT_TO_MODEL i ANALYSIS_TO_MODEL. Odczyt na zimno osobnym klientem pg.
DOWÓD MUTACYJNY: usuń tworzenie krawędzi ANALYSIS_TO_MODEL — test MUSI spaść, mimo że model
i wiersz rejestru dalej powstają. Cofnij.

RYZYKO — PRZECZYTAJ ZANIM ZAPISZESZ COKOLWIEK NA STAGINGU: krawędzie rodowodu są APPEND-ONLY
(wyzwalacze deny_update / deny_delete, server/migrations/20260809_finance_v3_b03_lineage_freshness.sql
~:150-163). Krawędź podpięta pod zły pakiet zostaje NA ZAWSZE. Dialog musi potwierdzać nazwy przed
zapisem. Wyzwalacz prevent_cycle zwraca surowy RAISE EXCEPTION — sprawdź, że użytkownik widzi
polski komunikat (mapowanie jest w lineageService.ts).

SAMOKONTROLA:
  cd server && npx tsc --build tsconfig.build.json     # exit 0
  suita .pg z bramką: 0 failed ; kontrola negatywna: "skipped"
  SELECT count(*) FROM finance_baseline_models WHERE business_version_id = '<bv>';   -> 1
  SELECT edge_type FROM finance_lineage_edges WHERE target_version_id = '<bv>';      -> dokładnie 2 typy
  zrzut listy Modeli: kolumny źródeł WYPEŁNIONE, bledyKonsoli = 0
ZAKAZY: --no-verify, git stash, push, nowe flagi, nowe endpointy, pytania do właściciela.
```

---

## F‑P2 — Generator miesięcznych okresów prognozy (ogniwo 5)

**§1 Cel.** Model ma horyzont prognozy wyrażony realnymi okresami, a nie liczbą w formularzu.

**§2 Zakres.** `financeCalendarService.ts` (z F‑M5) — rozszerzenie o `generateForecastPeriods`.

**§3 Przyczyna.** `baselineContextService.ts` żąda kompletu okresów w `finance_stmt_periods`
o `period_type='MONTH'` (`:506`) i ciągłego łańcucha `previous_period_id` (`:518`), przy czym
`horizon_months` musi być **równe** `forecastPeriodIds.length` (`BASELINE_CONTEXT_HORIZON_MISMATCH`).
Producenta okresów prognozy nie ma.

**§4 Projekt.** Generator: od okresu otwarcia, `horizon_months` okresów miesięcznych, ciągły łańcuch,
jeden kalendarz, idempotentnie po `(organization_id, calendar_id, period_start)`.

**§5 Kroki.** 1. (M) `generateForecastPeriods`. 2. (M) wywołanie przy rejestracji modelu (F‑P1).
3. (S) walidacja `horizon_months === length`.

**§6 Testy (realny PG).** 36 okresów dla horyzontu 36; łańcuch ciągły; powtórne wywołanie nie
duplikuje. **Dowód mutacyjny:** przerwij łańcuch (`previous_period_id = NULL` w środku) → test
spada na `INVALID_CONTEXT_PERIOD_ORDER`.

**§7 Odbiór.** Model DBR77 z horyzontem 36 miesięcy otwiera się bez karty błędu.

**§8 Ryzyka.** Ryzyko: kolizja z okresami historii z F‑M5 (ten sam kalendarz). Zabezpieczenie: test
sprawdzający, że okres otwarcia jest **poprzednikiem** pierwszego okresu prognozy, a nie duplikatem.

**§9 Nakład.** Opus 1,5 sesji. Zależy od F‑M5.

**§10 Samokontrola.** Suita `.pg` + kontrola negatywna; odczyt na zimno:
`SELECT count(*) FROM finance_stmt_periods WHERE calendar_id = $1 AND period_type = 'MONTH'` → 36;
`tsc --build` exit 0.

**§11 Wklejka.**

```
ZADANIE F-P2 — Generator miesięcznych okresów prognozy (Consultify, Finanse, ogniwo 5 programu F).

KATALOG: git worktree add /private/tmp/f-p2 -b codex/f-p2-okresy-prognozy origin/staging ; cd /private/tmp/f-p2
ZALEŻNOŚĆ: F-M5 scalona (financeCalendarService.ts istnieje). COMMIT PER KROK, BEZ PUSH.

CEL: model ma horyzont prognozy wyrażony REALNYMI okresami w bazie, a nie liczbą w formularzu.

KONTRAKT, KTÓRY TO WYMUSZA (przeczytaj server/src/services/finance/canonical/baselineContextService.ts):
  - okresy prognozy muszą istnieć w finance_stmt_periods i mieć period_type = 'MONTH' (~:506),
  - musi być ciągły łańcuch previous_period_id od okresu otwarcia (~:518,
    kod błędu INVALID_CONTEXT_PERIOD_ORDER),
  - horizon_months z finance_baseline_models musi być RÓWNE długości forecastPeriodIds
    (kod błędu BASELINE_CONTEXT_HORIZON_MISMATCH),
  - wszystkie okresy w JEDNYM kalendarzu.

KROKI:
1. Dodaj generateForecastPeriods do financeCalendarService.ts: od okresu otwarcia twórz
   horizon_months okresów miesięcznych, ciągły łańcuch previous_period_id.
   Idempotentnie po (organization_id, calendar_id, period_start).
2. Wywołaj przy rejestracji modelu (paczka F-P1).
3. Walidacja: horizon_months === forecastPeriodIds.length, z komunikatem po polsku.

TESTY — REALNY POSTGRES (komendy i kontrola negatywna jak w F-M5):
dla horyzontu 36 powstaje dokładnie 36 okresów; łańcuch ciągły; powtórne wywołanie nie duplikuje;
okres otwarcia jest POPRZEDNIKIEM pierwszego okresu prognozy, nie jego duplikatem.
DOWÓD MUTACYJNY: ustaw previous_period_id = NULL w środku łańcucha — test MUSI spaść na
INVALID_CONTEXT_PERIOD_ORDER. Cofnij.

SAMOKONTROLA:
  cd server && npx tsc --build tsconfig.build.json     # exit 0
  suita .pg z bramką: 0 failed ; kontrola negatywna: "skipped"
  SELECT count(*) FROM finance_stmt_periods WHERE calendar_id = '<cal>' AND period_type = 'MONTH';  -> 36
ZAKAZY: --no-verify, git stash, push, nowe flagi, SQL na żywej bazie, pytania do właściciela.
```

---

## F‑P3 — `PUT` kontekstu z kreatora + akcja „Skonfiguruj kontekst" (ogniwo 6)

**§1 Cel.** Model bazowy otwiera się **od razu na tabeli**, a gdy czegoś brakuje — ekran mówi
czego i daje przycisk, który to naprawia, zamiast „Spróbuj ponownie".

**§2 Zakres.** `src/services/api/financeV2.api.ts` (klient `configureBaselineWorkspaceContext:803`),
`CreateModelModal.tsx`, `BaselineWorkspace.tsx` (`:159-210`).

**§3 Przyczyna (pomiar F0 §4 wiersz 8).** Klient `configureBaselineWorkspaceContext` istnieje
i ma **zero wołaczy** w `src/**/*.tsx` — jedenasty kształt fałszywego „gotowe" (biblioteka bez
wywołania). `BaselineWorkspace` dostaje 409, nie sprawdza kodu błędu i renderuje jedną generyczną
kartę z akcją „Spróbuj ponownie", która powtarza to samo żądanie.

**§4 Projekt.** (a) `CreateModelModal` po utworzeniu modelu woła `PUT …/context` z `entityId`,
`openingBalanceSheetPeriodId`, `forecastPeriodIds`, `assumptionRowOrder` — wszystkie wyliczone
z pakietu i generatora (F‑P2), nie zgadywane. (b) `BaselineWorkspace` **rozróżnia kody błędu**:
`BASELINE_CONTEXT_NOT_CONFIGURED` → przycisk „Skonfiguruj kontekst";
`BASELINE_CONTEXT_SOURCE_STALE` → „Brakuje zatwierdzonego pakietu/analizy" z linkiem;
`BASELINE_CONTEXT_NOT_READY` → „Model nie ma jeszcze założeń" z akcją. Zero generycznego „Spróbuj
ponownie". (c) A31/A49: przyciski **„+ Dodaj założenie"** i **„Usuń linię"** w tabeli założeń.

**§5 Kroki.** 1. (M) wołacz `PUT` w kreatorze. 2. (M) mapa kodów → komunikat + akcja.
3. (M) akcja „Skonfiguruj kontekst" jako osobna ścieżka dla modeli już istniejących.
4. (M) przyciski dodawania/usuwania założeń (uwaga właściciela A31/A49).

**§6 Testy.** `BaselineWorkspace.honestErrors.test.tsx`: każdy z trzech kodów daje **inny** tekst
i **inną** akcję. **Dowód mutacyjny:** zwróć wszystkie trzy kody do jednej gałęzi → test spada
(celuje w zabezpieczenie „uczciwy stan mówi czego brakuje", nie w mechanizm obsługi błędu).
`.pg`: po `PUT` kontekst czyta się bez 409.

**§7 Odbiór.** Właściciel tworzy model „Oprzyj na sprawozdaniu" i model otwiera się **bez karty
błędu**; w tabeli założeń ma przycisk dodawania i usuwania linii.

**§8 Ryzyka.** Ryzyko wysłania złego `payload` i zepsucia raz utworzonego modelu — odbiór CTO
wprost o tym ostrzega (`ODBIOR_CTO_20260905/09-10-11.md:78-84`). Zabezpieczenie: `PUT` jest
idempotentny z `expectedVersion` i `BASELINE_CONTEXT_IMMUTABLE` przy statusie ≠ `DRAFT`; pracujemy
na nowych rekordach.

**§9 Nakład.** Opus 2 sesje. Zależy od F‑P1, F‑P2.

**§10 Samokontrola.** `npx vitest run src/components/Finance/baseline` → 0 failed;
suita `.pg` + kontrola negatywna; zrzut `/finance/models/<id>` — na obrazie **tabela**, nie karta
błędu; `bledyKonsoli = 0`, `dom.aside.count = 1`; zrzut stanu bez kontekstu pokazuje przycisk
„Skonfiguruj kontekst", nie „Spróbuj ponownie".

**§11 Wklejka.**

```
ZADANIE F-P3 — PUT kontekstu modelu bazowego z kreatora + uczciwe stany (Consultify, Finanse,
ogniwo 6 programu F).

KATALOG: git worktree add /private/tmp/f-p3 -b codex/f-p3-kontekst-baseline origin/staging ; cd /private/tmp/f-p3
ZALEŻNOŚĆ: F-P1 i F-P2 scalone. COMMIT PER KROK, BEZ PUSH.

CEL: model bazowy otwiera się OD RAZU NA TABELI, a gdy czegoś brakuje — ekran mówi CZEGO i daje
przycisk, który to naprawia. Koniec z "Spróbuj ponownie".

PRZYCZYNA (zweryfikuj sam):
  grep -rn "configureBaselineWorkspaceContext" src --include="*.tsx" | grep -v __tests__
  -> dziś PUSTO. Klient istnieje w src/services/api/financeV2.api.ts (~:803) i nie ma ANI JEDNEGO
  wołacza. BaselineWorkspace.tsx (~:159-210) dostaje 409, nie sprawdza kodu błędu i renderuje jedną
  generyczną kartę "Nie można otworzyć kontekstu modelu bazowego." z akcją "Spróbuj ponownie",
  która powtarza to samo failujące żądanie.

KROKI:
1. CreateModelModal.tsx: po utworzeniu modelu zawołaj PUT /api/v8/finance-v2/baseline/:bv/context
   z entityId, openingBalanceSheetPeriodId, forecastPeriodIds, assumptionRowOrder.
   WSZYSTKIE wyliczone z pakietu źródłowego i z generatora okresów (F-P2) — NIE zgadywane.
   Kształt payloadu: src/services/api/financeV2.api.ts ~:803-824.
2. BaselineWorkspace.tsx: rozróżnij kody błędu i dla każdego pokaż INNY tekst i INNĄ akcję:
   BASELINE_CONTEXT_NOT_CONFIGURED -> przycisk "Skonfiguruj kontekst"
   BASELINE_CONTEXT_SOURCE_STALE   -> "Brakuje zatwierdzonego pakietu lub analizy" + link do nich
   BASELINE_CONTEXT_NOT_READY      -> "Model nie ma jeszcze założeń" + akcja dodania
   ZAKAZ generycznego "Spróbuj ponownie" jako jedynej akcji.
3. Akcja "Skonfiguruj kontekst" jako osobna ścieżka dla modeli JUŻ ISTNIEJĄCYCH (nie tylko nowych).
4. UWAGA WŁAŚCICIELA A31/A49 (dwukrotnie zgłoszona): "dalej nie mam przycisku dodawania założeń
   i możliwości usuwania linii". Dodaj "+ Dodaj założenie" i "Usuń linię" w tabeli założeń
   (src/components/Finance/baseline/AssumptionsView.tsx). Endpointy istnieją:
   POST i DELETE /api/v8/finance-v2/baseline/:bv/assumptions[/:assumptionId].

TESTY:
  src/components/Finance/baseline/__tests__/BaselineWorkspace.honestErrors.test.tsx — każdy z trzech
  kodów daje INNY tekst i INNĄ akcję.
  DOWÓD MUTACYJNY: zwróć wszystkie trzy kody do jednej gałęzi obsługi — test MUSI spaść. Mutacja
  celuje w zabezpieczenie "uczciwy stan mówi czego brakuje", nie w mechanizm obsługi błędu. Cofnij.
  Realny Postgres: po PUT kontekst czyta się bez 409 (komendy i kontrola negatywna jak w F-M5).

RYZYKO: zły payload może zepsuć raz utworzony model — odbiór CTO wprost o tym ostrzega
(docs/program/ODBIOR_CTO_20260905/09-10-11.md ~:78-84). PUT jest idempotentny z expectedVersion
i odrzuca zmianę przy statusie != DRAFT (BASELINE_CONTEXT_IMMUTABLE). Pracuj na NOWYCH rekordach.

SAMOKONTROLA:
  npx vitest run src/components/Finance/baseline      # 0 failed
  cd server && npx tsc --build tsconfig.build.json    # exit 0
  suita .pg z bramką: 0 failed ; kontrola negatywna: "skipped"
  node scripts/dev/odbior-zywo/zrzut.mjs --url="/finance/models/<id>" --out=evidence/finanse-f1/P3-model.png --dom=aside --czekaj=4000
  Progi: na obrazie TABELA (nie karta błędu) ; bledyKonsoli = 0 ; dom.aside.count = 1.
  Drugi zrzut: model BEZ kontekstu -> na obrazie przycisk "Skonfiguruj kontekst", nie "Spróbuj ponownie".
ZAKAZY: --no-verify, git stash, push, nowe flagi, pytania do właściciela.
```

---

## F‑P4 — Producent definicji analizy i wierszy selekcji KPI (brak w programie F)

**§1 Cel.** Analiza historyczna pokazuje realne wskaźniki, a nie pustą tabelę.

**§2 Zakres.** Backend: nowy `analysisDefinitionService.ts`; `kpiComputeService.ts` (bez zmian
w logice liczenia); `lineage-navigator.routes.ts` (`derived-analysis`).

**§3 Przyczyna — znalezisko własne, spoza programu F.** `kpiComputeService.ts:19-21` mówi wprost:
„this module never inserts new selection rows, only computes into existing ones"; jedyna operacja
na tabeli to `UPDATE` (`:866`). `finance_analysis_kpi_values`, `finance_analysis_definitions`
i `finance_analysis_benchmarks` mają **zero** producentów produkcyjnych. Katalog wskaźników jest
zaseedowany migracją `20260809_finance_v3_d03_analysis_03_kpi_p0_catalog.sql`, więc brakuje tylko
**selekcji**: które wskaźniki × które okresy × która jednostka. Bez tego `POST /analysis/:bv/compute`
zawsze zwróci `resultsCount: 0`, a kryterium odbioru ogniwa 3 programu F („widzi wskaźniki 3 lat")
jest nieosiągalne.

**§4 Projekt.** Przy tworzeniu analizy (`derived-analysis`) w tej samej transakcji: (1) `INSERT`
definicji analizy z nazwą nadaną przez użytkownika (wymóg właściciela §6 pkt 3 założeń CTO);
(2) `INSERT` wierszy selekcji dla zestawu P0 z katalogu × okresy pakietu źródłowego × jednostka.
Zestaw domyślny = wskaźniki z §7 założeń CTO (rentowność, płynność, zadłużenie, efektywność,
wzrost, cash flow, sygnały ryzyka).

**§5 Kroki.** 1. (M) `analysisDefinitionService.ts`. 2. (M) wpięcie w `derived-analysis`.
3. (S) nazwa własna analizy w kreatorze. 4. (S) obsługa wielu sprawozdań źródłowych
(wiele-do-wielu, §6 pkt 4 założeń CTO).

**§6 Testy (realny PG).** Po `derived-analysis` liczba wierszy selekcji = |katalog P0| × |okresy|;
`POST /compute` zwraca `resultsCount > 0`. **Dowód mutacyjny:** usuń `INSERT` selekcji → `compute`
zwraca 0 i test spada (celuje w zabezpieczenie „analiza bez wskaźników jest bezużyteczna").

**§7 Odbiór.** Właściciel tworzy analizę z pakietu 2025 i widzi wypełnioną tabelę wskaźników.

**§8 Ryzyka.** Ryzyko: `CHECK` na `quality_flag` dopuszcza tylko 4 wartości
(`DIVISION_BY_ZERO`/`NEGATIVE_DENOMINATOR`/`INSUFFICIENT_HISTORY`/`ESTIMATED_ANNUALIZED`) —
zapis czegokolwiek innego wywraca się dopiero na realnym Postgresie. Zabezpieczenie: test `.pg`,
nigdy sqlite.

**§9 Nakład.** Opus 1,5 sesji. Zależy od F‑M6.

**§10 Samokontrola.** Suita `.pg` + kontrola negatywna; odczyt na zimno
`SELECT count(*) FROM finance_analysis_kpi_values WHERE business_version_id = $1` → > 0;
`tsc --build` exit 0.

**§11 Wklejka.**

```
ZADANIE F-P4 — Producent definicji analizy i wierszy selekcji wskaźników (Consultify, Finanse).
TO JEST OGNIWO, KTÓREGO NIE MA W PROGRAMIE F — bez niego kryterium odbioru ogniwa 3 ("widzi
wskaźniki 3 lat") jest nieosiągalne.

KATALOG: git worktree add /private/tmp/f-p4 -b codex/f-p4-selekcja-kpi origin/staging ; cd /private/tmp/f-p4
ZALEŻNOŚĆ: F-M6 scalona. COMMIT PER KROK, BEZ PUSH.

CEL: analiza historyczna pokazuje realne wskaźniki, a nie pustą tabelę.

PRZYCZYNA (zweryfikuj sam — to znalezisko, nie przepisana teza):
  sed -n '15,25p' server/src/services/finance/canonical/kpiComputeService.ts
  -> komentarz autora: "row PRESENCE is KPI/period SELECTION, this module never inserts new
     selection rows, only computes into existing ones".
  grep -n "INSERT\|UPDATE finance_analysis_kpi_values" server/src/services/finance/canonical/kpiComputeService.ts
  -> jedyna operacja to UPDATE (~:866).
  grep -rn "INSERT INTO finance_analysis_kpi_values\|INSERT INTO finance_analysis_definitions" server/src | grep -v __tests__ | grep -v "/scripts/"
  -> dziś PUSTO.
Katalog wskaźników JEST zaseedowany migracją server/migrations/20260809_finance_v3_d03_analysis_03_kpi_p0_catalog.sql,
więc brakuje wyłącznie SELEKCJI: które wskaźniki x które okresy x która jednostka.
Skutek dzisiaj: POST /api/v8/finance-v2/analysis/:bv/compute zawsze zwraca resultsCount: 0.

PROJEKT: przy tworzeniu analizy (POST /api/v8/finance-v2/versions/:sourceVersionId/derived-analysis,
lineage-navigator.routes.ts ~:227) w TEJ SAMEJ transakcji:
  1. INSERT definicji analizy z NAZWĄ WŁASNĄ nadaną przez użytkownika (wymóg właściciela:
     docs/program/grafika/FINANSE_ZALOZENIA_CTO_20260905.md §6 pkt 3 — "każda analiza ma własną
     nazwę"; system proponuje, użytkownik zmienia),
  2. INSERT wierszy selekcji dla zestawu P0 z katalogu x okresy pakietu źródłowego x jednostka.
Zestaw domyślny wskaźników = §7 założeń CTO: rentowność (marża brutto, EBITDA, EBIT, ROS, ROA, ROE,
DuPont), płynność (bieżąca, szybka, gotówkowa, KON), zadłużenie (dług/EBITDA, D/E, pokrycie odsetek,
DSCR), efektywność (DSO, DIO, DPO, CCC, rotacje), wzrost (r/r, CAGR 3-letni), cash flow
(FCF, konwersja, CFO/zysk netto), sygnały ryzyka (Altman Z).
Obsłuż też WIELE sprawozdań źródłowych (powiązanie wiele-do-wielu, §6 pkt 4 założeń CTO).

TESTY — REALNY POSTGRES (komendy i kontrola negatywna jak w F-M5):
po derived-analysis liczba wierszy selekcji = |katalog P0| x |okresy|; POST /compute zwraca
resultsCount > 0. Odczyt na zimno osobnym klientem pg.
DOWÓD MUTACYJNY: usuń INSERT selekcji — compute zwraca 0 i test MUSI spaść. Mutacja celuje
w zabezpieczenie "analiza bez wskaźników jest bezużyteczna". Cofnij.

RYZYKO: kolumna quality_flag ma CHECK dopuszczający TYLKO DIVISION_BY_ZERO, NEGATIVE_DENOMINATOR,
INSUFFICIENT_HISTORY, ESTIMATED_ANNUALIZED (server/migrations/20260809_finance_v3_d03_analysis_01_tables.sql).
Zapis czegokolwiek innego wywróci się dopiero na realnym Postgresie — dlatego testy TYLKO na PG,
nigdy na sqlite (DB_TYPE domyślnie sqlite w server/vitest.config.ts ~:17).

SAMOKONTROLA:
  cd server && npx tsc --build tsconfig.build.json     # exit 0
  suita .pg z bramką: 0 failed ; kontrola negatywna: "skipped"
  SELECT count(*) FROM finance_analysis_kpi_values WHERE business_version_id = '<bv>';   -> > 0
ZAKAZY: --no-verify, git stash, push, nowe flagi, SQL na żywej bazie, pytania do właściciela.
```

---

## F‑P5 — Analiza: krawędź z kreatora, flaga ON, koniec 404 (ogniwo 3)

**§1 Cel.** Analiza tworzona z warsztatu ma rodowód, otwiera się w nowym ekranie i nie sypie
błędami do konsoli.

**§2 Zakres.** `src/components/Finance/Analysis/AnalysisWorkspace.tsx` (`:446`),
`useFinanceAnalysisWorkspaceFlag.ts`, `useFinanceSelection.ts` (`:811`),
`Benefits/FinancialAnalysisWorkspace.tsx` (`:307`).

**§3 Przyczyna.** (a) `AnalysisWorkspace.handleWizardComplete:446` woła
`createFinanceArtifact({artifactType:'HISTORICAL_ANALYSIS'})` = `POST /artifacts`, który tworzy
artefakt **bez krawędzi** — komentarz w kodzie przyznaje: „żaden dzisiejszy endpoint nie przyjmuje
source/periods/KPI selection". Właściwa trasa (`derived-analysis`) jest już wołana z `FinanceHub`
(`:772`) — kreator warsztatu jej nie używa. (b) Flaga `financeAnalysisWorkspaceV1`
`defaultValue: false`. (c) 2× 404 przy otwarciu Analizy (`…/ratios`).

**§4 Projekt.** Kreator woła `derived-analysis` z wybranym pakietem (po F‑P4 dostaje też selekcję
KPI); flaga → `defaultValue: true`; 404 rozstrzygnięte (albo sub-zasób wymaga wcześniejszego
`compute`, albo id nie jest rozpoznawane — zmierzyć, nie zgadywać).

**§5 Kroki.** 1. (S) przepiąć kreator na `derived-analysis`. 2. (S) flaga ON.
3. (M) diagnoza i naprawa 404. 4. (S) fallback `—` zamiast pustej wartości przed dwukropkiem
(„Analiza finansowa: Waluta: Liczba okresów: 0").

**§6 Testy.** `AnalysisWorkspace.lineage.test.tsx` — kreator woła `derived-analysis`, nie
`/artifacts`. **Dowód mutacyjny:** przywróć `createFinanceArtifact` → test spada.

**§7 Odbiór.** Z ekranu pakietu jednym kliknięciem powstaje analiza z wypełnionymi wskaźnikami
i bez błędów w konsoli.

**§8 Ryzyka.** Krawędź append-only (jak F‑P1). Cofanie: flaga wraca na OFF lokalnym override.

**§9 Nakład.** Sonnet 1 sesja. Zależy od F‑P4.

**§10 Samokontrola.** `npx vitest run src/components/Finance/Analysis` → 0 failed;
zrzut `/finance/analyses/<id>` — `bledyKonsoli = 0` (**zero** wpisów 404), tabela wskaźników
niepusta, `dom.aside.count ≤ 1`.

**§11 Wklejka.**

```
ZADANIE F-P5 — Analiza historyczna: krawędź rodowodu z kreatora, flaga ON, koniec 404
(Consultify, Finanse, ogniwo 3 programu F).

KATALOG: git worktree add /private/tmp/f-p5 -b codex/f-p5-analiza origin/staging ; cd /private/tmp/f-p5
ZALEŻNOŚĆ: F-P4 scalona (bez selekcji KPI tabela będzie pusta). COMMIT PER KROK, BEZ PUSH.

CEL: analiza tworzona z warsztatu ma rodowód, otwiera się w nowym ekranie i nie sypie 404 do konsoli.

PRZYCZYNA (zweryfikuj sam):
  sed -n '441,452p' src/components/Finance/Analysis/AnalysisWorkspace.tsx
  -> handleWizardComplete woła createFinanceArtifact({artifactType:'HISTORICAL_ANALYSIS'})
     czyli POST /artifacts, który tworzy artefakt BEZ KRAWĘDZI. Komentarz w kodzie sam to przyznaje:
     "żaden dzisiejszy endpoint nie przyjmuje source/periods/KPI selection".
  Właściwa trasa (POST /versions/:sourceVersionId/derived-analysis) JEST już wołana z FinanceHub.tsx
  (~:772) — kreator warsztatu jej nie używa.

KROKI:
1. Przepnij kreator warsztatu na derived-analysis z wybranym pakietem źródłowym.
2. src/hooks/useFinanceAnalysisWorkspaceFlag.ts: defaultValue false -> true.
   NIE dodawaj nowej flagi, NIE chowaj pracy — przełącz istniejącą.
3. Rozstrzygnij 2x 404 przy otwarciu Analizy: GET /api/v8/finance/analyses/:id/ratios
   (src/components/Economics/hooks/useFinanceSelection.ts ~:811) i
   GET /api/economics/financial-analyses/:id/ratios
   (src/components/Benefits/FinancialAnalysisWorkspace.tsx ~:307 ; serwer
   server/src/routes/economics.routes.ts ~:2342). ZMIERZ, nie zgaduj: czy sub-zasób wymaga
   wcześniejszego compute, czy id nie jest rozpoznawane przez serwis. Napisz w raporcie co zmierzyłeś.
4. Fallback "—" zamiast pustej wartości przed dwukropkiem — dziś podgląd renderuje
   "Analiza finansowa: Waluta: Liczba okresów: 0"
   (dowód: evidence/audyt-award-20260905/finanse/08-analiza-detal.png).

TESTY: src/components/Finance/Analysis/__tests__/AnalysisWorkspace.lineage.test.tsx — kreator woła
derived-analysis, nie /artifacts.
DOWÓD MUTACYJNY: przywróć createFinanceArtifact — test MUSI spaść. Cofnij.

SAMOKONTROLA:
  npx vitest run src/components/Finance/Analysis      # 0 failed
  bash scripts/check-list-canon.sh                     # exit 0
  node scripts/dev/odbior-zywo/zrzut.mjs --url="/finance/analyses/<id>" --out=evidence/finanse-f1/P5-analiza.png --dom=aside --czekaj=4000
  Progi: bledyKonsoli = 0 (ZERO wpisów 404) ; tabela wskaźników NIEPUSTA ; dom.aside.count <= 1.
RYZYKO: krawędzie rodowodu są append-only — zła krawędź zostaje na zawsze. Potwierdzaj nazwę pakietu.
ZAKAZY: --no-verify, git stash, push, nowe flagi, pytania do właściciela.
```

---

## F‑P6 — Pełna tabela RZiS · Bilans · CF: historia + horyzont w jednej tabeli

**§1 Cel.** To, o co właściciel prosił wprost: **jedna tabela** z latami historii i horyzontem
prognozy obok siebie, z edytowalnymi tylko tymi komórkami, które są założeniem.

**§2 Zakres.** `src/components/Finance/baseline/CalculationsView.tsx`, `AssumptionsView.tsx`,
`useBaselineOutputs.ts`, `useBaselineCompute.ts`.

**§3 Przyczyna.** Dziś `CalculationsView` renderuje trzy osobne tabele wyłącznie dla horyzontu;
historia z pakietu nie wchodzi do tej samej siatki. Właściciel 05.09: „to nie jest nawet cień
rozwiązania dla finansistów, pracujemy nie na uproszczonych liczbach tylko na całej tabeli".

**§4 Projekt.** Jedna siatka na sekcję (RZiS · Bilans · CF): kolumny = **lata historii
(szarawe) + okresy prognozy (jaśniejsze)**, wiersze = pozycje kanoniczne z hierarchią i roll-upem,
pierwsze kolumny przypięte, poziomy scroll wewnątrz kontenera (nigdy scroll `body`), liczby do
prawej z jednostką i walutą w nagłówku, sumy pogrubione, kolumny pomocnicze Δ i %, komórki
edytowalne **tylko** tam, gdzie założenie (podświetlone), reszta liczona.
`<table §27-exempt>` — archetyp Excel, nie lista rekordów.

**§5 Kroki.** 1. (L) połączenie źródeł: `finance_stmt_lines` (historia) + `finance_baseline_outputs`
(prognoza) w jeden model widoku. 2. (M) przypięte kolumny + scroll w kontenerze.
3. (M) rozróżnienie komórek edytowalnych. 4. (S) Δ i %.

**§6 Testy.** `CalculationsView.fullTable.test.tsx`: dla 3 lat historii i horyzontu 36 mies. tabela
ma `3 + 36` kolumn danych; komórka liczona **nie** jest `input`. **Dowód mutacyjny:** ustaw
wszystkie komórki jako edytowalne → test spada (celuje w zabezpieczenie „liczone jest liczone",
nie w mechanizm renderu).

**§7 Odbiór.** Właściciel widzi jedną tabelę z trzema latami historii i horyzontem prognozy,
zmienia założenie, klika „Przelicz" i tabela się odświeża.

**§8 Ryzyka.** Ryzyko wydajności przy 39 kolumnach × setkach wierszy. Zabezpieczenie: pomiar
`czasMs` w zrzucie, próg < 5000 ms.

**§9 Nakład.** Opus 2 sesje. Zależy od F‑P3.

**§10 Samokontrola.** `npx vitest run src/components/Finance/baseline` → 0 failed;
`bash scripts/check-list-canon.sh` exit 0; zrzut `--pelna --dom=table --dom=input`; progi:
`bledyKonsoli = 0`, `czasMs < 5000`, **zero** przepełnień poziomych na `body`
(scroll tylko w kontenerze tabeli), liczba kolumn danych = `lata historii + horyzont`.

**§11 Wklejka.**

```
ZADANIE F-P6 — Pełna tabela RZiS / Bilans / CF: historia + horyzont w JEDNEJ tabeli
(Consultify, Finanse).

KATALOG: git worktree add /private/tmp/f-p6 -b codex/f-p6-pelna-tabela origin/staging ; cd /private/tmp/f-p6
ZALEŻNOŚĆ: F-P3 scalona (kontekst modelu musi się otwierać). COMMIT PER KROK, BEZ PUSH.

CEL — SŁOWA WŁAŚCICIELA (05.09): "to nie jest nawet cień rozwiązania dla finansistów. pracujemy
tutaj nie na uproszczonych liczbach tylko na całej tabeli". Ma być JEDNA tabela z latami historii
i horyzontem prognozy obok siebie.

STAN DZISIEJSZY: src/components/Finance/baseline/CalculationsView.tsx renderuje trzy osobne tabele
wyłącznie dla horyzontu; historia z pakietu nie wchodzi do tej samej siatki.

KANON (docs/program/grafika/FINANSE_ZALOZENIA_CTO_20260905.md §2):
  - jedna siatka na sekcję (RZiS, Bilans, CF),
  - kolumny = lata historii (szarawe) + okresy prognozy (jaśniejsze),
  - wiersze = pozycje kanoniczne z hierarchią (przychody › koszty › EBITDA ; aktywa › pasywa ;
    CF operacyjny › inwestycyjny › finansowy) i roll-upem sum,
  - pierwsze kolumny PRZYPIĘTE, poziomy scroll WEWNĄTRZ kontenera (nigdy scroll body),
  - liczby do prawej, jednostka i waluta w nagłówku, sumy pogrubione,
  - kolumny pomocnicze Δ i %,
  - komórki edytowalne TYLKO tam, gdzie założenie (podświetlone); reszta liczona i NIE jest inputem,
  - <table> z komentarzem §27-exempt (archetyp Excel, nie lista rekordów),
  - czerwień TYLKO gdy bilans się nie domyka; brak danych = "—", nigdy 0.

KROKI:
1. Połącz źródła w jeden model widoku: finance_stmt_lines (historia, przez
   GET /api/v8/finance-v2/statements/:bv/lines) + finance_baseline_outputs (prognoza, przez
   GET /api/v8/finance-v2/baseline/:bv/outputs).
2. Przypięte kolumny + scroll w kontenerze.
3. Rozróżnienie komórek edytowalnych i liczonych.
4. Kolumny Δ i %.

TESTY: src/components/Finance/baseline/__tests__/CalculationsView.fullTable.test.tsx —
dla 3 lat historii i horyzontu 36 miesięcy tabela ma 3 + 36 kolumn danych; komórka liczona NIE jest
elementem input.
DOWÓD MUTACYJNY: ustaw wszystkie komórki jako edytowalne — test MUSI spaść. Mutacja celuje
w zabezpieczenie "liczone jest liczone", nie w mechanizm renderu. Cofnij.

SAMOKONTROLA:
  npx vitest run src/components/Finance/baseline       # 0 failed
  bash scripts/check-list-canon.sh                      # exit 0
  node scripts/dev/odbior-zywo/zrzut.mjs --url="/finance/models/<id>" --out=evidence/finanse-f1/P6-tabela.png --pelna --dom=table --dom=input --czekaj=5000
Progi w .json: bledyKonsoli = 0 ; czasMs < 5000 ; liczba kolumn danych = lata historii + horyzont ;
ZERO przepełnień poziomych na body (scroll wyłącznie w kontenerze tabeli).
Powtórz w ciemnym motywie — mean_luma pary różni się o WIĘCEJ NIŻ 40.
ZAKAZY: --no-verify, git stash, push, nowe flagi, nowe komponenty tabel, pytania do właściciela.
```

---

## F‑P7 … F‑P11 — pozostałe paczki PEŁNEGO

Poniższe cztery paczki mają ten sam szkielet (§1–§11) i tę samą dyscyplinę §10/§11 co wyżej;
poniżej ich rdzeń, bo powtarzanie pełnych wklejek dla wariantów tego samego wzorca zwiększyłoby
objętość bez wartości. **Przed wydaniem każdej z nich nadzorca składa wklejkę wg wzoru F‑M1…F‑P6.**

| Paczka | Cel | Rdzeń zakresu | Progi §10 (najważniejsze) | Sesje |
| --- | --- | --- | --- | :-: |
| **F‑P7 — Prognoza** | scenariusze Base/Bull/Bear działają, biały ekran znika | `useFinancePredictionWorkspaceFlag` OFF→ON; rozstrzygnięcie białego ekranu (~6 %, wyścig `lazy()` vs routing do `fullView`, `FinanceHub.tsx` ~`:4019`) | 16 świeżych otwarć pod rząd, **0 białych ekranów**; `bledyKonsoli = 0`; test wyścigu w vitest | 1,5 |
| **F‑P8 — Wycena** | krok „Wyniki" odblokowany, 23 napisy EN po polsku | wskazanie źródła wymaga zatwierdzonego modelu (po F‑P1 jest); `NO_VALUATION_SOURCE_EDGE` znika; `FinanceValuePanelsSurface` po polsku (jeśli F‑M1 tego nie objęła); A32: przyciski nagłówka jako pigułki/ikony, nie słowa | chooser źródła **niepusty**; krok „Wyniki" = `ready`; 0 trafień stop-listy EN; `bledyKonsoli = 0` | 1 |
| **F‑P9 — Pięć narzędzi warsztatu** | Rodowód · Porównaj · Komentarze · Widoki · Excel dostępne z karty N | `useFinanceWorkspacePlatformFlag` `defaultValue: false` → `true`; osadzenie w `ArtifactRightPanel` zamiast osobnego `aside` (dziś `FinanceWorkspaceUtilities` renderuje własny `<aside>`) | `dom.aside.count = 1` po włączeniu (dowód, że narzędzia weszły do panelu, a nie obok); 5 zrzutów, po jednym na narzędzie; `bledyKonsoli = 0` | 1 |
| **F‑P10 — Porównanie wersji** | „Porównaj z…" działa, bo artefakt ma drugą wersję | endpoint tworzenia drugiej wersji biznesowej (`artifactVersionService`) + akcja w pasku; `FinanceComparePanel` przestaje być montowany warunkowo na martwym warunku | po utworzeniu drugiej wersji `listFinanceArtifactVersions` zwraca 2; panel renderuje kolumnę Δ; `.pg` + kontrola negatywna | 1,5 |
| **F‑P11 — Dane i przepływ CFO** | jeden klikany przepływ i komplet zrzutów odbioru PEŁNEGO | kroki 5–9 planu danych `F_FINANSE_PELNA_TABELA.md` §4 (analiza → model → przelicz → zatwierdź → wycena ze źródłem) + skrypt Playwright przepływu | przepływ przechodzi end-to-end bez ręcznej interwencji; 12 zrzutów jasny+ciemny; każdy `.json`: `bledyKonsoli = 0`, `czasMs < 5000` | 1 |

---

## Ryzyka i co może nie wyjść — uczciwie

1. **Największe: łańcuch jest szeregowy i każde ogniwo może odsłonić kolejnego brakującego
   producenta.** Program F zakładał pięć tabel bez producenta; ja przy jednym popołudniu pomiaru
   znalazłem **trzy kolejne** (`finance_analysis_definitions`, `finance_analysis_kpi_values`,
   `finance_analysis_benchmarks`). Nie mam podstaw twierdzić, że lista jest już zamknięta —
   `finance_prediction_*` (11 tabel) i `finance_valuation_*` nie były sprawdzone tabela po tabeli.
   **Konsekwencja:** wycena PEŁNEGO (24 sesje) może urosnąć o 2–4 sesje na każdą nową dziurę.
   **Co zrobić przed startem PEŁNEGO:** jedna sesja Sonneta na pełny audyt producentów wszystkich
   132 tabel `finance_*` — tanio, i zdejmuje najgorsze ryzyko planistyczne.

2. **Krawędzie rodowodu są nieodwracalne.** `finance_lineage_edges` ma wyzwalacze
   `deny_update`/`deny_delete`. Pomyłka w F‑P1 lub F‑P5 na danych DBR77 zostaje w bazie na zawsze
   i może zablokować kontrakt `BASELINE_SOURCE_AMBIGUOUS` (bo krawędzi będą dwie zamiast jednej).
   Dlatego F‑M7 buduje komplet **od nowa** i dlatego każda paczka pisząca krawędź ma w dialogu
   potwierdzenie nazwy. Jeśli mimo to dojdzie do pomyłki — jedynym wyjściem jest nowy komplet
   rekordów, nie naprawa.

3. **Nie wiem, czy backend liczy dobrze.** Zmierzyłem, że trasy są zamontowane, testy istnieją
   (89 plików `.pg`) i przewody prowadzą do ekranów. **Nie uruchomiłem ani jednego testu** i nie
   sprawdziłem, czy `baselineComputeService` daje liczby, które finansista uzna za poprawne.
   Cała wycena zakłada, że silniki liczą — jeśli nie, dochodzi nieoszacowany tor merytoryczny.

4. **Odbiór MINIMUM może nie usatysfakcjonować właściciela.** MINIMUM daje pełny dokument
   sprawozdania i zatwierdzenie, ale **nie** daje pełnej tabeli modelu — a właśnie ona padła
   w zdaniu „pracujemy na całej tabeli". Ryzyko: właściciel obejrzy MINIMUM i powie to samo co
   05.09. **Zabezpieczenie:** nie pokazywać MINIMUM jako „Finanse gotowe", tylko jako
   „dokument podstawowy gotowy, tabela modelu w kolejnym kroku" — i pokazać razem z planem F‑P.

5. **Sesja pomiarowa wygasa.** Cały odbiór wizualny stoi na `ODBIOR_AUTH_STATE`; podczas tego
   audytu plik sesji wygasł i nie dało się zrobić ani jednego świeżego zrzutu. Każda paczka, która
   kończy się zrzutami (F‑M3, F‑M4, F‑M7, F‑P3, F‑P5, F‑P6, F‑P11), może utknąć na tym samym.
   **Zabezpieczenie:** przed wydaniem paczki nadzorca sprawdza sesję jednym zrzutem testowym.

6. **Bramka `MODULE_ECONOMICS: 'closed'` zostaje.** Ten program **nie** otwiera Finansów klientom —
   moduł pozostaje widoczny wyłącznie dla OWNER/ADMIN/SUPERADMIN (`BETA_ADMINS_EXEMPT = true`).
   Otwarcie to osobna, jednolinijkowa decyzja właściciela po odbiorze, nie element żadnej paczki.

7. **Ryzyko regresji w modułach sąsiednich.** `src/components/Economics/**` zawiera także
   komponenty używane przez Wyniki (`BenefitsTrackingDashboard`, `InitiativeBusinessCaseCard`)
   i Inicjatywy (`InitiativeFinancialIntegration`) — a Wyniki i Inicjatywy są **zamrożone**
   (`MVP_FINAL_ZAMROZONE.json`). F‑M2 dotyka obu tych plików. **Zabezpieczenie:** w F‑M2 albo
   pominąć te dwa pliki, albo dodać marker `[ODMROZENIE <MODUL> DEC-<nr>]` w commicie po decyzji
   nadzorcy — wykonawca ma to zgłosić, nie rozstrzygać sam.

8. **Czego ten program świadomie NIE robi:** nie rusza budżetów (`/api/budgets` — martwe),
   `finance-v4`, przychodów SaaS, 21 paneli wartości poza tłumaczeniem etykiet, ani rozliczenia
   korzyści (Benefits Realization — §1 pkt 8 założeń CTO, po MVP). Każde z nich to osobny program.
