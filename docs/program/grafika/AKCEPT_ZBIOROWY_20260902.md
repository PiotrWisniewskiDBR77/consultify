---
doc_id: grafika-akcept-zbiorowy-20260902
status: canonical
owner: piotr
truth_type: decision
established: 2026-09-02
---

# Akcept zbiorowy właściciela — 2 września 2026

## Słowa właściciela (dosłownie)
1. „Dobra, obrazy wszystkie dostają ok. Możemy uznać za odhaczone."
2. „Wszystkie są ok."
Wcześniej tego samego dnia, na pytanie, czy jego przegląd 253 kart ma zastąpić osobny prowadzony
przegląd każdego z 16 modułów: **„Uznaj przegląd kart za odbyty przegląd modułów"**.

## Co ten akcept obejmuje — i czego NIE obejmuje

| | |
| --- | --- |
| Decyzji w rejestrze | **265** (262 „ok", 2 „nie", 1 „poprawka") |
| Obejrzanych przez właściciela pojedynczo | **260** — przeklikane na stronie odbioru, każda z własnym zrzutem |
| Objętych akceptem ZBIOROWYM, nieoglądanych pojedynczo | **5** — ekrany sprzed zalogowania (`auth-*`), powstały 02.09 przy naprawie języka i czerwieni; właściciel widział zrzut samego ekranu logowania |

**To rozróżnienie jest wiążące.** Zamknięcie modułu, które opiera się na pozycji z tej drugiej grupy,
ma to wymieniać wprost. Nie wolno pisać „właściciel obejrzał", gdy objął akceptem zbiorowym —
w tym programie zdarzyło się już zamknięcie oparte na akcepcie prototypu i na nierozpoczętym
przeglądzie, i oba trzeba było cofać.

## Trzy pozycje spoza „ok" — rozstrzygnięcia utrzymane
- `gen-excel-templates-tab` — „nie" („nie wiem, po co on jest"). Wycofanie: ocena D + wpis w `ODLOZONE.md`, kod zostaje.
- `results-three-pairs` — „nie" („jakiś historyczny ekran"). Jak wyżej.
- `finance-baseline-workspace` — „poprawka" („dalej nie mam przycisku dodawania założeń i możliwości
  usuwania"). Zmierzone 02.09: przyciski ISTNIEJĄ z pełnym łańcuchem zapisu, ekran jest za flagą
  `financeBaselineWorkspaceV1` domyślnie wyłączoną. Decyzja właściciela: włączyć domyślnie **po** naprawie
  surowej wartości „per-2025-12" w kolumnie Okres bazowy.

**Późniejsze „wszystkie są ok" tych trzech nie odwraca** — dwa pierwsze to jego własna decyzja
o wycofaniu ekranów, trzeci ma konkretny warunek, który sam postawił. Odwrócenie wymagałoby
jawnego polecenia, nie domysłu.

## Stan po tym akcepcie
Faza przeglądu ekranów **zamknięta**. Trwała kopia decyzji: `ODBIOR_DECYZJE.json` (eksport z bazy
`odbior.sqlite`, która jest lokalna i ulotna). Kolejny krok: formalne zamknięcie 16 modułów
(bramki G07-G12 i G17-G18) — `ZAMKNIECIE_MODULOW_20260902.md`.
