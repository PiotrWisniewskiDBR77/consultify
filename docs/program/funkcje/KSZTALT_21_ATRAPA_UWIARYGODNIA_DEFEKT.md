---
doc_id: funkcje-ksztalt-21
status: canonical
owner: piotr
truth_type: runtime
established: 2026-09-01
---

# DWUDZIESTY PIERWSZY kształt: atrapa nie ukryła defektu — ona go UWIARYGODNIŁA

## Co się stało — najostrzejszy przypadek dnia

Ekran Audytów, zakładka „Sesje". W realnym produkcie kolumna **„Postęp" pokazuje literalny
ukośnik** na każdym wierszu, bo ekran pyta o `concludedCriteria`, a serwer odpowiada
`criteriaConcluded`.

**Właściciel ten ekran OGLĄDAŁ. Dwukrotnie, w dwóch turach dowodowych.**
I na obu zrzutach kolumna „Postęp" pokazywała **wiarygodne liczby: `0/42`, `12/42`, `27/27`.**

**Bo atrapa w ekranie dowodowym miała te same błędne nazwy pól, co front.**

Potwierdzone w kodzie:
- test jednostkowy (`AuditProcessesTab.test.tsx:23-25`) fabrykuje dane z nazwami
  `applicableCriteria` / `concludedCriteria` / `openFindings` — **kształt frontu**,
  więc test jest **konstrukcyjnie niezdolny** do złapania tej wady;
- ekran dowodowy ma **we własnym opisie** zdanie, że jego atrapy „ściśle odpowiadają
  kontraktowi `auditsMethodApi.ts`" — czyli **został świadomie zbudowany tak, żeby
  odzwierciedlać BŁĘDNY typ frontu**, a nie realny serwer;
- w **tym samym pliku** atrapa pokrycia **została poprawiona do kształtu serwera 26.08**
  (jest o tym komentarz w kodzie, po innym błędzie) — **a sąsiednia atrapa listy nigdy
  nie dostała tej samej poprawki.**

## Dlaczego to jest nowy kształt, a nie powtórka
Znane nam kształty mówią: **narzędzie kłamie** (14), **para zrzutów przechodzi mimo defektu**
(19), **flaga OFF w kodzie nie znaczy wyłączone** (20).

**Tutaj jest coś gorszego: atrapa nie zasłoniła defektu — ona wyprodukowała OBRAZ, na którym
defekt wygląda jak poprawnie działająca funkcja.** Liczby `12/42` są **bardziej przekonujące
niż prawda**. Nie da się ich odróżnić od działającego produktu **niczym poza porównaniem
z serwerem**.

> **Zrzut nie był pusty. Zrzut był PRZEKONUJĄCY. To jest gorsze niż brak zrzutu —
> bo brak zrzutu widać, a fałszywą wiarygodność potwierdza się podpisem.**

## ★ Sprostowanie — ważniejsze niż wygodniejsza wersja
Tor grafiki zgłosił, że **feralnej zakładki nigdy nie sfotografowano**, i ja to powtórzyłem.
**Nasz przemiatacz to obalił: zakładka BYŁA fotografowana, dwukrotnie**, i podał ścieżki
obu zrzutów oraz odczytane z nich liczby.

**To jest mocniejsze znalezisko, nie słabsze** — i wykonawca **świadomie wybrał wersję
trudniejszą dla nas**, zamiast przyjąć wygodną. Odnotowuję to jako zachowanie wzorcowe.

**Różnica jest zasadnicza dla winy:** gdyby nie sfotografowano, akcept właściciela byłby
**niepełny**. Skoro sfotografowano, a obraz **kłamał** — akcept był **wprowadzony w błąd
przez nasze narzędzie**. **To nie jest jego przeoczenie. To jest nasz fałszywy dowód.**

Istnieje już precedens rozstrzygający tę sprawę: decyzja z 29.08 mówi wprost, że
**akcept właściciela dowodzi WYGLĄDU, nie zachowania realnego produktu.**

## Trzy pary „poprawne obok zepsutego" — zmierzone
Krok 0 (wypisz rodzinę) zadziałał od razu:

| Poprawne | Zepsute obok |
| --- | --- |
| `getProgramCoverage` — jawne przemapowanie **z komentarzem ostrzegającym przed tym błędem** | `listPrograms` — brak przemapowania |
| ustawienia AI: pomocnicze przekształcenia superadministratora | piętro organizacji — surowe przekazanie |
| atrapa pokrycia w ekranie dowodowym (poprawiona 26.08) | atrapa listy w **tym samym pliku** |

**Trzy razy ten sam plik albo sąsiedztwo. Trzy razy ktoś wiedział.**

## Co z tego wynika — reguły
1. **Atrapa danych ma mieć kształt SERWERA, nie kształt oczekiwany przez front.**
   Atrapa zgodna z frontem **testuje, czy front zgadza się sam ze sobą**.
2. **Naprawiając tę klasę: NAJPIERW popraw atrapę**, pokaż że ekran **zaczyna się psuć
   widocznie**, dopiero potem popraw kod. Inaczej naprawa jest deklaracją.
3. **Akcept właściciela na zrzucie z atrapy nie jest dowodem działania.**
   Do zamknięcia modułu potrzebny jest zrzut **z realnego łańcucha**.
4. **Przy każdej wadzie nazw pól sprawdź, czy istnieje zrzut, który ją UWIARYGODNIŁ** —
   i jeśli tak, **odwołaj tamten akcept jawnie**, zamiast zostawiać go w rejestrze.

## Pozycja do wchłonięcia
Tor grafiki łata ten ekran **punktowo**, bo ma ocenę A. **To jest naprawa tymczasowa** —
ma zostać zastąpiona warstwą systemową, nie stać obok. W przeciwnym razie za osiem tygodni
będzie tu dwanaście plików z własnym mapowaniem, **tak jak już raz w tym produkcie było.**

## Sprostowanie 2026-09-01 (dyżur 251) — reguła zastosowana, defekt naprawiony

Commit `8510fcb01d`, przodek markera `df7f13056f`, zastosował dokładnie opisaną tu
sekwencję: najpierw mock `/audits/programs` otrzymał kształt serwera, następnie powstał
dowód wizualny PRZED/PO, a `mapProgramSummaryRow()` dostał jawne mapowanie i błąd
`AUDITS_API_CONTRACT_ERROR`. Negatywny test chroni brak liczników przed cichym renderem.
Commit tego dokumentu `bacbf4081c` nie jest potomkiem `8510fcb01d`
(`git merge-base --is-ancestor` zwraca kod 1), mimo późniejszego czasu ściennego: oba
powstały równolegle. `status.json` jawnie ogranicza dawną ocenę A do Biblioteki i kieruje
Sesje do ponownego odbioru; historyczny opis odkrycia pozostaje zachowany.
