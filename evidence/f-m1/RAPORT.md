# F-M1 — RAPORT (Koniec angielskiego i kodów enum w Finansach)

Gałąź: `fin/fm1-koniec-angielskiego` (worktree `/private/tmp/wt-fm1`), baza
`origin/staging` @ `fb6f73e5aedc14e49be2a53e1bb335d4ed7dccf1`. Zero push.

## PRZED / PO

Pełna lista PRZED z dowodem (plik:linia, realny caller) w `00_PRZED.md`.
Skrót:

| # | Znalezisko | PRZED | PO |
|---|---|---|---|
| A | `FinanceValuePanelsSurface.tsx` — 21 etykiet + aria-label + "Loading panel…" | 23 raw EN stringi poza `t()` | 0 — wszystko przez `t('finance.valuePanels.*', …)` |
| B | Klucze `t()` bez wpisu w `pl` | 5 (nie 7 z F1 §3 — 2 nakładały się) | 0 |
| C | Klucze z hybrydową/angielską treścią w `pl` | 3 (nie 17 z F0/F1 — reszta domniemanych była już poprawna, patrz niżej) | 0 |
| D1 | `statusChip.*` (BusinessVersionStatus + readiness) | 5/13 wartości bez wpisu | 0/13 |
| D2 | `statementReadinessCopy.ts` (14 realnych `reasonCodes`) | 5/14 bez wpisu (fallback ogólny, nie surowy kod) | 0/14 |
| E | `FinancePreviewPanel.tsx:583` — surowy `readinessStatus` w JSX | tak | nie — przez `statementReadinessLabel()` |
| F | `StatementValidationBadges.tsx` + `DistributionHistogram.tsx` aria-label | 3 raw EN | 0 |

**Rozbieżność z F0/F1 (Golden Rule 1, weryfikacja realnego runtime a nie
dokumentu):** F1 §3 szacował "7 brakujących kluczy" i "17 kluczy z
angielską/hybrydową treścią", zgadując też nazwy kodów stanu (9 kodów
`WITHDRAWN`/`REOPENED` — nie istnieją) i gotowości (`MISSING_PLAN` — kod w
kodzie nazywa się `MISSING_PL`). Zmierzony, zweryfikowany przez
`grep`+skrypt porównujący `t(klucz, default)` z realną wartością w `pl.json`
stan: 5 brakujących kluczy, 3 hybrydowe, `BusinessVersionStatus` ma
faktycznie 8 wartości (już w pełni obsłużone osobnym resolverem
`businessVersionStatusLabel`/`En` w `financeV2.types.ts` — NIE była to
dziura), readiness pakietu to 14 kodów `reasonCodes` (nie 6) plus osobno
4-wartościowy per-statement `readinessStatus` (`pending/recoverable/ready/
rejected`) — to właśnie ten drugi, mniejszy zbiór był realnie renderowany
surowo w `FinancePreviewPanel.tsx:583`.

## Słowniki (SSOT)

1. **`src/components/Finance/labels/financeEnums.ts`** (nowy) —
   `statementReadinessLabel(code, isPolish)`, 4 kody realnie potwierdzone w
   `financeTypes.ts#deriveStatementReadinessStatus`. Nagłówek wymienia
   wyjątki (DCF, FCFF, WACC, EBITDA, NPV, IRR, EV, P/E, EV/S, CAGR, DSO,
   DIO, DPO, CCC, DSCR, Altman Z).
2. **`src/components/Finance/statementReadinessCopy.ts`** (rozszerzony) —
   `REASON_COPY` z 9 → 14 wpisów (dodano 5 realnych kodów z
   `financialStatementPackService.ts`).
3. **`public/locales/{pl,en}/translation.json`** — `finance.valuePanels.*`
   (23 klucze), `finance.filters.status.*` (3, patrz niżej), `statusChip.*`
   (+5), `finance.statements.reason.*` (+5), `finance.pack.validation.
   ariaLabel`, `finance.m16.monteCarlo.histogram*AriaLabel`, plus 5
   brakujących i 3 poprawione klucze finansowe.
4. **Istniejący, nienaruszony resolver** `businessVersionStatusLabel`/`En`
   w `src/services/api/financeV2.types.ts` (8/8 wartości, pl+en) — sprawdzony,
   NIE wymagał zmian; potwierdza, że F1's "9 kodów stanu" było błędnym
   szacunkiem audytu F0, nie realną dziurą.

### Znalezisko strukturalne (STOP częściowy, opisane zamiast obejścia)

`FinanceHub.tsx:1602-1606` wołało `t('common.status.draft'/'.review'/
'.approved', …)`. `common.status` w `translation.json` to już STRING
`"Status"`, używany w 5 innych modułach (Settings, Discovery, Benefits,
SuperAdmin) jako nagłówek kolumny. Nie da się dopisać `common.status.draft`
jako dziecka istniejącego liścia-stringa — i18next/JSON nie pozwala kluczowi
być jednocześnie stringiem i obiektem. To NIE był "brakujący wpis pl", tylko
kolizja nazw, która gwarantowała angielski default niezależnie od stanu
`pl.json`. Naprawa: przeniesiono te 3 klucze na `finance.filters.status.*`
(nowa, nie kolidująca przestrzeń, dotyczy WYŁĄCZNIE `FinanceHub.tsx` — jedyny
konsument tych 3 kluczy, potwierdzone grepem). Common namespace nietknięty.

## Dowód mutacyjny (RED → GREEN)

`src/components/Finance/labels/__tests__/financeEnums.test.ts`, 5 testów.

1. GREEN (stan naprawiony): `npx vitest run .../financeEnums.test.ts` → 5/5 PASS.
2. Mutacja: usunięto wpis `recoverable: { pl: 'Do poprawy', en: 'Recoverable' }`
   z mapy w `financeEnums.ts`.
3. RED: 2/5 testów spadło —
   `expected 'Nieznany stan' to be 'Do poprawy'` i lista kodów
   `["pending","ready","recoverable","rejected"]` → `["pending","ready",
   "rejected"]`. Komunikat wprost pokazuje, że usunięcie zabezpieczenia
   powoduje ucieczkę na fallback "Nieznany stan" zamiast realnej etykiety —
   mutacja celuje w zabezpieczenie "użytkownik nigdy nie widzi enumu", nie w
   mechanizm mapowania.
4. Przywrócono wpis → GREEN 5/5 ponownie.

## Samokontrola §10

- **esbuild** (7 dotkniętych plików `.tsx`/`.ts`, browser bundle) → **exit 0**
  na wszystkich.
- **vitest** `src/components/Finance src/components/Economics`:
  PRZED (bez nowego pliku testów, zmierzone osobno na HEAD i na moich
  zmianach — identyczne): **27 failed / 691 passed / 718 total**, wszystkie
  27 potwierdzone jako PRZEDISTNIEJĄCE (niezwiązane z żadnym plikiem
  dotkniętym w tej paczce — zweryfikowano przez `git checkout --` moich
  8 zmienionych plików do HEAD i ponowne uruchomienie: identyczne 27
  failed). PO (z nowym `financeEnums.test.ts`): **27 failed / 696 passed /
  723 total** — 0 nowych failures, +5 nowych zielonych testów.
- **Stop-lista EN** (`node scripts/dev/audyt-award-20260905/
  stoplista-en.mjs --zakres=src/components/Finance,src/components/
  Economics`, napisana od zera per §10, bo nie istniała): zwraca >300
  trafień, w ZDECYDOWANEJ większości fałszywych — słowo "Draft"/"Approved"/
  "Delete"/"Status" jako identyfikator zmiennej, nazwa funkcji, komentarz,
  albo poprawny angielski `default` w `t(klucz, 'English default')`
  wskazywanym w INNYM, dalekim od LABEL, miejscu w kodzie (np. obiekt
  danych przekazywany do `t()` osobno). Skrypt nie potrafi w 100% odróżnić
  tego od surowego renderu bez pełnego parsera AST — **nie osiąga 0
  automatycznie**. Zamiast obchodzić to twardym `replace`, zweryfikowano
  RĘCZNIE (patrz `00_PRZED.md` sekcja A) każde z 27 miejsc, gdzie fraza ze
  stop-listy faktycznie trafiała na ekran nieopakowana w `t()` — wszystkie
  27 naprawione. Pozostałe setki trafień to szum tego konkretnego skryptu,
  nie realne defekty; opisane wprost zamiast fałszywie zameldować "0
  trafień".
- `grep -rnE "MISSING_|INVALID_|HAS_PENDING_" src/components/Finance
  src/components/Economics --include="*.tsx" | grep -v __tests__ | grep -v
  financeEnums` → 5 linii, wszystkie: (a) komentarze dokumentujące fix, albo
  (b) `FinanceHub.tsx:271 setError(... 'MISSING_BUSINESS_VERSION_ID')` —
  kod trafia WYŁĄCZNIE do budowy klucza `t(\`finance.resolver.errors.
  ${error}\`, …)`, oba warianty (`MISSING_BUSINESS_VERSION_ID`,
  `IDENTITY_MISMATCH`) już mają pełne wpisy pl+en — sprawdzono, nie jest
  to naruszenie.
- `node -e "JSON.parse(...)"` na obu plikach `translation.json` → OK.
  Sprawdzono parytet kluczy pl/en dla każdej dotkniętej gałęzi — identyczne,
  poza jednym PRZEDISTNIEJĄCYM rozjazdem w `statusChip.*` (pl ma więcej
  kluczy niż en — dług sprzed tej paczki, niepogorszony przeze mnie).
- `bash scripts/check-list-canon.sh` → **exit 0**, dług NIE rośnie (spadł
  o 3, przypadkowo, niezwiązane z tą paczką).

## Co NIE zostało zrobione z §7 (kryterium właściciela) i dlaczego

1. **`src/components/Economics/EvidencePanel.tsx`,
   `ExcelImportWizard.tsx`, `VersionHistoryPanel.tsx`** — F1 §11 wymieniał
   konkretne linie w tych plikach ("Delete", "Select category (optional)",
   "Nazwa analysis", "Historia version"). Zweryfikowano: **zero realnych
   importerów** poza własnym nieużywanym barrelem `Economics/index.ts` —
   martwy kod, nieosiągalny z żadnej trasy `/finance`. Naprawa dałaby zero
   efektu na ekranie, kosztem ~150+ linii zmian w kodzie widmo. Zgodnie z
   CLAUDE.md ("weryfikuj realny caller") — pominięte świadomie, opisane w
   `00_PRZED.md` sekcja E. Jeśli właściciel chce te pliki podłączone lub
   usunięte, to osobna decyzja produktowa, nie i18n.
2. **Zrzuty wizualne (§10 `zrzut.mjs`)** — NIEMOŻLIWE, sesja
   przeglądarkowa wygasła (zgodnie z instrukcją zlecenia: nie loguję się,
   nie wpisuję haseł). Weryfikacja ograniczona do kodu źródłowego + testów
   jednostkowych; brak dowodu "na żywo" że `/finance` w polskim locale nie
   pokazuje angielskiego słowa — tylko dowód, że wszystkie zidentyfikowane
   nieopakowane stringi zostały owinięte w `t()` z polską wartością.
3. **`statusChip.*` pl/en key-count mismatch** (pl ma dodatkowe klucze
   nieobecne w en, np. `applied`, `canary`, `completed_with_errors`) —
   przedistniejący dług spoza zakresu Finance/Economics (klucz współdzielony
   przez cały `EntityStatusChip`), nie tknięty, nie pogorszony.
4. **Pełne tłumaczenie 3 martwych plików** (patrz pkt 1) — świadomie
   pominięte, patrz uzasadnienie wyżej.

## Pliki zmienione

`public/locales/{pl,en}/translation.json`,
`src/components/Economics/FinanceHub.tsx`,
`src/components/Economics/FinancePreviewPanel.tsx`,
`src/components/Economics/FinanceValuePanelsSurface.tsx`,
`src/components/Economics/charts/DistributionHistogram.tsx`,
`src/components/Finance/StatementValidationBadges.tsx`,
`src/components/Finance/statementReadinessCopy.ts`,
`src/components/Finance/labels/financeEnums.ts` (nowy),
`src/components/Finance/labels/__tests__/financeEnums.test.ts` (nowy),
`scripts/dev/audyt-award-20260905/stoplista-en.mjs` (nowy, jednorazowy
licznik per §10).

Moduł Finanse nie jest zamrożony — brak markera `[ODMROZENIE]`. Wszystkie
dotknięte pliki leżą w `src/components/Finance/**` lub
`src/components/Economics/**`, poza `public/locales/*/translation.json`
(plik globalny i18n, edytowany tylko przez dopisanie/naprawę wartości pod
kluczami `finance.*`/`statusChip.*` — bez naruszenia innych modułów).
