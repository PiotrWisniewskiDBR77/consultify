---
doc_id: funkcje-koordynacja-tor-grafiki
status: canonical
owner: piotr
truth_type: process
established: 2026-09-01
---

# Dwa tory rozjechały się o dwa dni — ustalenia z sesją Grafiki

## Co się stało
Robotnik toru funkcji odgałęził się przypadkiem od lokalnego katalogu zawierającego
**linię toru grafiki** i przy pushu **wypchnął ją w całości**. Wyszło to na jaw dopiero
przy scalaniu, po czterech nieoczekiwanych konfliktach.

**Skutek uboczny jest dobry: 288 commitów toru grafiki żyło WYŁĄCZNIE na dysku lokalnym
i nie było nigdzie zabezpieczonych. Teraz są w skarbcu** — gałąź
`fix/kreator-formularzy-zapis-20260901`, czubek `48121d5ccd`.

## Decyzja: NIE wciągam cudzej linii do integracji
Z gałęzi wybrano **wyłącznie dwa własne commity** naprawy i przeniesiono je pojedynczo.

**Powód nie jest formalny.** Trzy z czterech konfliktów miały po stronie toru grafiki
**starszą treść** (ekrany dev-render, konfiguracja uruchomień, komunikat w katalogu metodyk).
**Odruchowe „zachowaj obie strony" — które sprawdzało się dziś przy dopisywaniu obok siebie —
tutaj COFNĘŁOBY pracę.**

> **„Zachowaj oba" jest poprawne tylko wtedy, gdy obie strony DOPISUJĄ.
> Gdy jedna strona jest starszą wersją tej samej rzeczy, to samo posunięcie kasuje nowszą.**

Rozpoznanie różnicy wymaga **obejrzenia treści konfliktu**, nie samego faktu, że konflikt jest.

## Ustalenia zaproponowane torowi grafiki
1. **Wspólne pole minowe: `dev-render/main.tsx` i `.claude/launch.json`.** Obydwa tory
   dopisują tam swoje ekrany i wpisy. Zasada: **każdy dopisuje tylko swoje, nigdy nie kasuje
   cudzych**; przy scaleniu **tych dwóch plików** „zachowaj oba" jest poprawne, bo wpisy
   są rozłączne.
2. **Każdy inny plik**: konflikt oznacza, że któryś tor patrzy na starszy stan.
   **Nie rozstrzygamy automatem** — decyduje ten, kto ma nowszy commit dotykający tej linii.
3. **Zejście linii wcześniej niż później.** Rozjazd dwudniowy jest do ogarnięcia,
   tygodniowy nie będzie. Scalenie robi tor funkcji, **po kolei i z odbiorem, nie hurtem.**
4. Tor grafiki **nadaje własną nazwę** swojej gałęzi — dziś jego praca wisi pod nazwą
   cudzej naprawy, co jest mylące.

## Co przekazano torowi grafiki jako użyteczne dla jego pracy
- **Kształt 19** — para zrzutów jasny/ciemny może przejść kontrolę różnicy jasności
  z zapasem, **pokazując dwa różne stany programu**; kontrola mierzy „czy obrazy są różne",
  więc **im większy defekt, tym łatwiej przechodzi**. Wraz z gotowymi narzędziami:
  `scripts/dev/lib/checkScreenshotPairState.mjs`, `scripts/dev/lib/meanLuma.mjs`
  i wzorcem przechwytywania czekającego **na wynik, nie na czas**.
- **„Flaga OFF w kodzie" ≠ „wyłączone na demo"** — zmienna środowiskowa omija wartości
  domyślne wczesnym `return true` w **sześciu rodzinach flag**; dotyczy wprost zrzutów
  „co widzi użytkownik".

## Zasada na przyszłość
**Dwa tory pracujące na jednym repozytorium muszą znać nawzajem swój czubek.**
Rozjazd nie jest awarią — awarią jest **dowiedzenie się o nim przy scalaniu**.
Wykrycie kosztowało dziś jedno przerwane scalenie; przy tygodniu rozjazdu kosztowałoby dzień.
