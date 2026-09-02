# Bramka parytetu — odbiór 31 naruszeń (2026-09-02)

Gałąź: `grafika/bramka-parytetu-20260902` (z `github-backup/grafika/m03-20260902`,
commit bazowy `971f26a3ca`, po rebase na `e96db40b70`).
Naprawa: commit `f69651817b` na tej samej gałęzi.

## Streszczenie

`node scripts/check-dev-render-parytet.mjs --report` był **CZERWONY: 31 nowych
naruszeń R1/R2** (21×R1, 10×R2, 9 ekranów). Każda pozycja rozstrzygnięta
CZYTAJĄC KOD (nie ufając bramce), z dowodem. Wynik:

| Kategoria | Liczba pozycji | Co zrobiono |
|---|---|---|
| **FALSZYWY_ALARM** | 29 z 31 | Naprawiono BRAMKĘ (5 rodzin ślepoty) |
| **REALNE_NARUSZENIE** | 1 z 31 | Naprawiono EKRAN harnessu (`day238-ustawienia.tsx`) |
| **EKRAN_DO_WYCOFANIA** | 1 z 31 | Wpisano do baseline z dowodem, do wycofania z rejestru |

**Bramka: ZIELONA** (`exit 0`, „Wynik: CZYSTO"). Kontrola ujemna (mutacja)
potwierdza, że bramka nadal wykrywa realne rozbieżności — patrz §5.

★ 29 z 31 to fałszywe alarmy — bramka miała rację, że coś jest nie tak
strukturalnie w JEJ WŁASNYM rozpoznawaniu wzorców, nie w produkcie. To
zgodne z ostrzeżeniem zlecenia: bramka ma za sobą siedem udowodnionych
ślepot; ten przebieg dodaje piątą, szóstą, siódmą, ósmą i dziewiątą — patrz
§2 poniżej.

## 1. Tabela 31 pozycji

| # | Ekran | Reguła | Szczegół | Rozstrzygnięcie | Dowód (skrót) |
|---|---|---|---|---|---|
| 1-13 | `day200-finance-panels` | R1 | `BankingValuePanel`, `CashForecastPanel`, `DriverTreePanel`, `ExtendedRatiosPanel`, `HeadcountPlannerPanel`, `InvestmentAppraisalPanel`, `RollingForecastPanel`, `ValuationVisualsPanel`, `ValueAttributionPanel`, `ValueCapturePipelinePanel`, `ValueLedgerPanel`, `VarianceBridgePanel`, `VarianceNarrationPanel` | **FALSZYWY_ALARM** | `src/components/Economics/FinanceValuePanelsSurface.tsx:5-71` — obiekt `PANELS = { bankingValue: lazy(() => import('./panels/BankingValuePanel')...), … }`, montowany dynamicznie: `const Panel = PANELS[active]; <Panel />` (L105,133). Realny wołacz: `FinanceHub.tsx:4065` → `<FinanceValuePanelsSurface />`. Bramka widziała TYLKO `const X = lazy(...)` (zmienna) i literalne `<Nazwa`; obiekt-mapa + `<Panel/>` (nazwa zmiennej NIGDY nie jest nazwą komponentu) to nie pasowało do żadnego wzorca. |
| 14 | `day221-audyty-warsztat` | R1 | `(brak montażu)` | **EKRAN_DO_WYCOFANIA** | Plik (58 linii) to w całości ręcznie pisany markup, zero importów z `src/` (tylko `lucide-react`). Realny moduł Audytów istnieje (`AuditsHub.tsx`, `AuditsMethodHub.tsx`, `AuditOrchestratorWizard.tsx`) i ma już poprawnie zmontowane harnessy (`audyty-piec-powierzchni.tsx`, `day220-audyty-rejestr.tsx`) — ale ŻADEN nie ma widoku „mapa warsztatu 18 kroków/4 fazy", który ten ekran wymyśla. `AuditOrchestratorWizard` to 4-krokowy kreator PROGRAMU (objective/templates/assignees/review), nie mapa WYKONANIA audytu z dowodami. Zero komponentu produkcyjnego odpowiada tej kompozycji — nie ma czego zamontować bez najpierw budowania nieistniejącej funkcji. |
| 15 | `day233-finanse-rejestry` | R1 | `(brak montażu)` | **FALSZYWY_ALARM** | Plik = `import FinanceHubScreen from './finance-hub'; return <FinanceHubScreen />;` — deleguje do INNEGO ekranu harnessu (`finance-hub.tsx`), który sam montuje realny `<FinanceHub>` (`const FinanceHubLazy = React.lazy(() => import('../../src/components/Economics/FinanceHub')...)`, już rozpoznawane przez bramkę jako „Wzorzec 1"). Bramka `importyProdukcyjne` widziała tylko `@/`/`../src/` — import SĄSIADA w `dev-render/screens/` (nie produkcji) nie pasował do żadnego wzorca. |
| 16 | `day234-wyniki-narzedzia` | R1 | `(brak montażu)` | **FALSZYWY_ALARM** | Ten sam wzorzec co #15: importuje 3 sąsiednie ekrany (`results-vnext-kpi-tool`, `-okr-workspace`, `-roi-full-tool`) i wybiera JEDEN wg `?domain=`. |
| 17 | `day234-wyniki-rejestry` | R1 | `(brak montażu)` | **FALSZYWY_ALARM** | Jak #16, dla 3 rejestrów (`results-vnext-kpi-registry`/`-okr-registry`/`-roi-registry`). |
| 18 | `day235-materialy-dokumenty` | R1 | `(brak montażu)` | **FALSZYWY_ALARM** | Importuje `document-artifact`/`materials-registry` (sąsiednie ekrany), wybór wg `?view=`. |
| 19 | `day235-materialy-excele` | R1 | `(brak montażu)` | **FALSZYWY_ALARM** | `export { default } from './excele-prawy-panel-standard'` — czysty re-eksport sąsiedniego ekranu, wzorzec składniowy bez `import`, osobny od #15-18. |
| 20 | `day236-organizacja` | R1 | `(brak montażu)` | **FALSZYWY_ALARM** | Importuje `org-identity-operating` (montuje realny `OrganizationView`). |
| 21 | `day238-ustawienia` | R1 | `BillingSettings` | **REALNE_NARUSZENIE** | Harness montował `<BillingSettings currentUser={owner} />`. Produkcja (`src/views/SettingsView.tsx:474-478`, `case 'billing':`) świadomie zwraca `null` — komentarz w kodzie: „Organization billing is owned by Admin. The route-level resolver immediately hands authorized users off there; do not mount the legacy personal BillingSettings editor". `BillingSettings` nie ma ŻADNEGO realnego wołacza w `src/` poza własną definicją — bramka miała rację. Naprawiono ekran (patrz §3). |
| 22-31 | `day238-ustawienia` | R2 | `RouterSync`+`AIBehaviorSettings`, `+ConnectedAppsSettings`, `+DataControlsSettings`, `+NotificationSettings`, `+ProfileSettings`, `+RegionalSettings`, `+SecurityOverviewPage`, `+SettingsHistory`, `+SettingsSidebar`, `+ThemeSettings` | **FALSZYWY_ALARM** | `RouterSync.tsx` kończy `return null; // Logic only component` — zweryfikowane: WSZYSTKIE `return` w ciele to gołe `return;` (early-exit w efektach), poza tym jednym końcowym. Komponent nigdy niczego nie stawia na ekranie — strukturalnie identyczny do `Provider`/`Context` (już wykluczonych z R2), tylko z nazwą niekończącą się na `Router` (kończy się na `Sync`). Sito nazwy (`czyRusztowanie`) nie łapało tego, bo patrzy WYŁĄCZNIE na sufiks nazwy. |

## 2. Naprawy w BRAMCE (`scripts/check-dev-render-parytet.mjs`)

Pięć rodzin ślepoty, każda mierzona i naprawiona osobno (kolejne po 7
udokumentowanych w pliku wcześniej — to ósma, dziewiąta… policzone niżej):

1. **Mapa komponentów** (`{klucz: lazy(() => import(...))}` + `<Panel/>` z
   indeksowania obiektu) — nowy blok budujący indeks `wołacze` rozpoznaje
   właściwości obiektu jako cele `lazy`, warunkowane obecnością zmiennej
   przypisanej z indeksowania i wyrenderowanej w JSX (sito przeciw
   kredytowaniu martwych rejestrów). Naprawia pozycje #1-13.
2. **Ekran-agregator** — nowa funkcja `montowaneProduktowePrzezEkran`
   rozwiązuje TRANSYTYWNIE (rekurencyjnie, ze stróżem cyklu) import
   sąsiedniego pliku w `dev-render/screens/` zamiast tylko `@/`/`../src/`.
   Obsługuje zarówno `import X from './y'` jak i `export { default } from
   './y'`. Naprawia #15-20.
3. **Komponent bez JSX jako rusztowanie** — `czyRusztowanie` dostało DRUGIE,
   strukturalne sito: `KOMPONENTY_BEZ_JSX`, zbiór nazw, których ŻADNA
   deklaracja nigdzie w `src/` nie zwraca JSX (sprawdzone na CIELE funkcji, z
   dedykowaną funkcją `znajdzZasiegCialaKomponentu`, patrz §4 — pomija listę
   parametrów, nawet zdestrukturyzowaną). Naprawia #22-31.
4. **Parametry wariantujące `panel`/`domain`** — dopisane do
   `PARAMY_WARIANTUJACE` (allowlist R2 sieve „a"). Odsłonięte DOPIERO przez
   naprawę #2 (ekrany-agregatory zaczęły mieć realne komponenty do parowania,
   a wcześniej miały zero). Zweryfikowane osobno dla obu nazw, że w
   POZOSTAŁYCH ekranach, które ich używają, NIE wybierają komponentu (tylko
   dane/wokabularz) — nie ukrywa niczego innego.
5. **Regres regexu w naprawie #2** — pierwsza wersja naprawy #2 użyła regexu
   z wymogiem `\.` NA POCZĄTKU grupy przechwytującej specyfikator ścieżki;
   to psuło leniwe dopasowanie `[\s\S]*?`, gdy PIERWSZY import w pliku (np.
   `import React from 'react'`) miał specyfikator bez kropki — silnik
   sklejał dwie linie importu w jedno dopasowanie. Złapane przez
   `--ekran=day233-finanse-rejestry` (nadal 0 montażu po naprawie #2).
   Naprawione: bezwarunkowy wzorzec identyczny z `importyProdukcyjne`,
   filtr „zaczyna się kropką" osobno, PO dopasowaniu.

Pełne komentarze z uzasadnieniem i numeracją ślepot są w samym pliku
`scripts/check-dev-render-parytet.mjs` (przy każdym bloku).

## 3. Naprawa w HARNESSIE

**`dev-render/screens/day238-ustawienia.tsx`** (pozycja #21): usunięto import
i montaż `<BillingSettings>` z gałęzi `case 'billing':`, zastąpiono `return
null;` z komentarzem cytującym `SettingsView.tsx`. Usunięto też
nieużywany już import `AccessPolicyProvider` (był tylko wrapperem dla
`BillingSettings`).

**Zrzut PO**: `evidence/grafika/219-bramka-parytetu/day238-ustawienia__PO__light.png`
(`?screen=day238-ustawienia&section=billing`) — panel treści jest teraz PUSTY,
identycznie jak w produkcji; boczne menu (nawigacja, nie treść tej reguły)
bez zmian.

## 4. Do wycofania z rejestru

**`day221-audyty-warsztat`** (pozycja #14) — wpisany do
`scripts/check-dev-render-parytet.baseline.txt` z pełnym dowodem
(EKRAN_DO_WYCOFANIA). NIE naprawiony — nie ma czego zamontować, budowa
realnej funkcji „mapa wykonania audytu" to osobna decyzja produktowa, poza
zakresem tego dyżuru. Do usunięcia z rejestru odbioru (nie pokazywać
właścicielowi jako istniejący ekran produktu).

## 5. Kontrola dodatnia i ujemna

**Dodatnia** — `day200-finance-panels` (13 naruszeń R1 na starcie) teraz:

```
node scripts/check-dev-render-parytet.mjs --ekran=day200-finance-panels --report
  R1  ekranów: 0   nowych: 0
  R2  ekranów: 0   nowych: 0
  R2 pominięte jako WARIANTOWE: 1 ekranów (day200-finance-panels ?panel=)
Wynik: CZYSTO
```

**Ujemna (dowód mutacyjny)** — do `dev-render/screens/day238-ustawienia.tsx`
dopisano tymczasowo `import { AdminAuditLogPanel } from
'../../src/components/Admin/AdminAuditLogPanel'` i wyrenderowano go obok
`<ProfileSettings>` (komponent bez związku z Ustawieniami, realny wołacz
gdzie indziej w `src/`, więc R1 by nie złapał — celowo test pod R2):

```
node scripts/check-dev-render-parytet.mjs
  R2  nowych: 10   (AdminAuditLogPanel + 10 istniejących komponentów sekcji)
Wynik: 10 NOWYCH naruszeń R1/R2 …
exit code: 1
```

Mutacja cofnięta (`git checkout --`), naprawa `BillingSettings` odtworzona
ręcznie (checkout cofnął też ją — przez to samo polecenie), zweryfikowane
`grep` że w pliku nie ma już ani `AdminAuditLogPanel` ani `BillingSettings`.
Bramka po cofnięciu:

```
node scripts/check-dev-render-parytet.mjs
Wynik: CZYSTO — dług na poziomie linii bazowej, brak nowych rozbieżności.
exit code: 0
```

## 6. Baseline — zmiany poza samymi 31 pozycjami

Przy pisaniu kontroli dodatniej/ujemnej znaleziono (nie szukane celowo, efekt
uboczny naprawy #1 w §2) jedną WIĘCEJ pozycję baseline, którą naprawa
faktycznie rozwiązała: `angielskie-resztki-i18n R1 MonteCarloNpvPanel` —
ten sam komponent-mapa co `day200-finance-panels`, ten sam realny wołacz
(`FinanceValuePanelsSurface.tsx`). Usunięta z baseline z dowodem (patrz nagłówek
pliku) — dług świadomie spadł: **112 → 111 pozycji**.

★ ODKRYCIE UBOCZNE (do wiadomości, NIE naprawiane tym dyżurem — poza
zakresem 31 pozycji): kontrola krzyżowa `baseline → CAŁY DŁUG` ujawniła
**5 pozycji baseline nieaktualnych już PRZED tym dyżurem** (niezwiązanych z
żadną z 31 naprawionych pozycji, zweryfikowane na niezmodyfikowanej wersji
bramki z `git stash`): `canvas-kebab-restructure R1`,
`canvas-toolbar-md-history R1`, `ntype-analizuj-ai R2` (×2),
`teresa-confirm-chip R1`. Ekrany/komponenty referowane tam już nie
odtwarzają naruszenia (zmienione/usunięte od czasu wpisu do baseline) — to
martwe zapisy w rejestrze długu, nieszkodliwe dla bramki (nie maskują
niczego BIEŻĄCEGO), ale warte osobnego sprzątnięcia `--update` po
weryfikacji każdej pozycji z osobna.

## 7. Meldunek

- **31/31 rozstrzygnięte**, każde z dowodem plik:linia lub cytatem kodu.
- **29 fałszywych alarmów** (5 rodzin ślepoty bramki, naprawione W BRAMCE).
- **1 realne naruszenie** (naprawione W HARNESSIE, zrzut PO załączony).
- **1 do wycofania z rejestru** (baseline z dowodem, nie naprawiane —
  funkcja nie istnieje w produkcie).
- **Bramka ZIELONA**: `exit 0`, „Wynik: CZYSTO — dług na poziomie linii
  bazowej, brak nowych rozbieżności."
- **Bramka NADAL wykrywa realne rozbieżności**: dowód mutacyjny (§5) —
  wstrzyknięty obcy komponent dał `exit 1` / 10 nowych R2 w kilka sekund;
  po cofnięciu z powrotem `exit 0`.
- Baseline: 112 → 111 (jedna pozycja rozwiązana efektem ubocznym naprawy
  #1) + 2 nowe z dowodem dla `day221-audyty-warsztat` (R1 i PODPIS).
- Odkryto (nie naprawiono, poza zakresem) 5 nieaktualnych pozycji baseline
  sprzed tego dyżuru — do osobnego sprzątnięcia.
