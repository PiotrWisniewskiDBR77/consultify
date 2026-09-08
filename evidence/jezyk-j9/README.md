# DOWÓD PACZKI J9 — moduł 09 FINANSE, spójność językowa

Program: `docs/program/JEZYK_EN_PL_20260908/PLAN.md`.
Baza gałęzi: `origin/demo` → `mvp/j9-finanse-0909`, punkt startu `d7c7f3e437`.

## 1. Pomiar narzędziem (`scripts/i18n/pomiar-jezyka.mjs --modul "09 Finance"`)

| Kategoria | PRZED | PO | Uwaga |
| --- | ---: | ---: | --- |
| K1 (PL w pliku EN) | 0 | 0 | |
| **K1def** (polski `defaultValue` w `t()`) | **176** | **0** | |
| **K1defWID** (z tego widoczny NA STAŁE) | **5** | **0** | |
| K2 (EN w pliku PL) | 2 | 2 | oba zastane, patrz STOP-y |
| **K3a** (klucz tylko w PL) | **520** | **175** | reszta = `billing.*`/`pricing.*`, STOP |
| **K3aKLUCZ** (EN widzi surowy klucz) | **54** | **33** | j.w. |
| **K4pl** (polski napis poza `t()`) | **183** | **15** | 13 = strony cennika (STOP), 2 = fałszywe trafienia na kodzie |
| **K4en** (angielski napis poza `t()`) | **22** | **7** | 6 = strony cennika (STOP), 1 = fałszywe trafienie |
| K5pl / K5en (zdania z serwera) | 6 / 158 | 6 / 158 | paczka J17, nie ta |
| **K7** (daty/liczby/waluty) | **49** | **0** | |

`baseline.json` obniżony w tym samym commicie co naprawa (etap 5).
Mutacja bramki: `09 Finance / K7` obniżone `0 → -1` daje
`BRAMKA JĘZYKOWA — LICZBA OBCOJĘZYCZNYCH MIEJSC WZROSŁA: 09 Finance / K7: -1 -> 0`
i **kod wyjścia 1**.

## 2. Dowód wizualny — `przed/` i `po/`

Stanowisko: API `4196`, Vite **`3215`**, baza `consultify_kopia_final`,
konto `audyt@dbr77.local`, 1440×900, motyw jasny.
**Port 3215, nie 3214**: 3214 trzymał w tym czasie worktree `j10-materialy`
(sprawdzone `lsof -d cwd`) — zrzut stamtąd fotografowałby cudzy kod.

16 ekranów × 2 języki = **32 zrzuty** w każdej fazie. Każdy plik `.png` ma
obok `.png.json` z listą podejrzanych linii i osobnym wiadrem `DANE`
(wartości pochodzące z bazy: nazwy sprawozdań, modeli, wycen, budżetów,
podmiotów, ludzi — to kategoria K6, nie interfejs).

| | PRZED | PO |
| --- | ---: | ---: |
| **obce słowa UI, konto EN** | **12** | **0** |
| **obce słowa UI, konto PL** | **14** | **0** |

Ekrany: lista sprawozdań · podgląd sprawozdania · kebab wiersza · lista modeli ·
podgląd modelu · lista budżetów · formularz budżetu · otwarty budżet ·
lista analiz · **kreator analizy** · **kreator modelu** · lista wycen ·
formularz wyceny · otwarta wycena · ROI/analiza inwestycji · panele wartości.

### Czego te zrzuty NIE pokrywają (uczciwie)

Warsztaty budżetu i wyceny na tej bazie otwierają się przez **bramkę mostu
legacy** („rekord nie ma jeszcze odpowiednika w nowym systemie") — kroki
wyceny, widok Założeń i Wyliczeń nie renderują się z tych danych. Dla nich
dowodem jest **test źródłowy**, który czyta 100 % plików modułu, a nie zrzut.

## 3. Bezpiecznik źródłowy — `src/components/Finance/__tests__/jezykFinansow.source.test.ts`

Cztery testy: kontrola negatywna zasięgu (>100 plików), brak polskiego
`defaultValue`, brak polskiego napisu poza `t()`, brak locale przybitego
na sztywno. Detektor stoi na **tym samym słowniku**, co `pomiar-jezyka.mjs`
(plus 25 słów domierzonych w J9), bo same diakrytyki nie wystarczają:
„Brak danych", „Wybierz plik", „Zastosowano: dodane {{n}}" to zdania w pełni
polskie **bez ani jednego ogonka**.

**Mutacja — wykonana, nie zapowiedziana** (`FinanceWorkspaceUtilities.tsx`):

| # | Wstawka | Wynik |
| --- | --- | --- |
| 1 | `ft('finance.utilities.title', 'Narzędzia finansowe')` | **RED** (test 2) |
| 2 | `<p>Brak danych</p>` w JSX | **RED** (test 3) |
| 3 | `(1234).toLocaleString('pl-PL')` | **RED** (test 4) |

Po przywróceniu pliku: **4/4 zielone**.

## 4. Co znalazło OKO, czego nie znalazł żaden przyrząd

To jest najważniejsza część tego dowodu.

1. **`FinancePreviewPanel.tsx` używał funkcji bez importu.** Podgląd modelu
   wywalał się na globalny ErrorBoundary. `esbuild` przeszedł, `tsc --noEmit`
   dał 0 błędów, testy modułu zostały na baseline — **trzy zielone bramki
   i zepsuty ekran**. Zobaczył to dopiero licznik obcych słów na zrzucie,
   bo komunikat awarii jest po polsku.
2. **Bramka mostu legacy** mówiła po polsku do konta EN pięcioma zdaniami.
   Skaner nie liczy atrybutu `message=` na komponencie.
3. **Surowy enum `Comprehensive`** w kolumnie „Rodzaj analizy" — wartość
   z bazy wstrzykiwana w runtime, więc statyczny grep nie ma czego znaleźć.
4. **Cała tabela sprawozdania po angielsku dla Polaka** (30 nazw linii
   w `useFinanceSelection.ts`), przy jednoczesnym istnieniu drugiego,
   polskiego słownika linii w tym samym module.
5. **`const numberLocale = i18n.language?.startsWith('pl') ? 'pl-PL' : 'en-US'`**
   — K7, którego wzorzec skanera nie łapie, bo locale stoi w zmiennej,
   nie w wywołaniu. Konto EN dostawało format amerykański.

## 5. Przyrząd też kłamał — i to trzy razy

1. **Zrzuty `-en` z polskim ekranem.** Ustawienie `users.language='en'`
   przy otwartej sesji nie trzyma: `App.tsx` woła `syncLanguageFromAccount`
   dwa razy, raz dla użytkownika z `localStorage`. Zrzuty 01–05 wyszły
   angielskie, 09–14 z tą samą etykietą — polskie.
2. **Trzy inne paczki na tej samej bazie i tym samym koncie.**
   `zrzuty-j2.mjs`, `jezyk-j10-zrzuty.mjs`, `zrzuty-jmale.mjs` (sprawdzone
   `ps`) przestawiały `users.language` w trakcie mojego pomiaru.
   Stąd **kotwica tekstowa** zamiast wiary w bazę: zrzut zapada tylko, gdy
   w menu modułu stoi słowo z docelowego języka i **nie ma** słowa z drugiego.
3. **`re()` z `^…$` nie klikało w żaden modal.** Przycisk niesie prefiks `+`,
   więc pełne dopasowanie nigdy nie wchodziło; skrypt meldował „nie kliknięto"
   i szedł dalej, a plik „formularz" pokazywał tę samą listę co ekran obok —
   dwa pliki, jeden obraz.

Sprzątanie: skrypt przywraca `users.language='pl'` (stan zastany), żeby nie
zepsuć dowodu sąsiednim paczkom.
