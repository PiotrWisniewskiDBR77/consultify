---
doc_id: funkcje-znalezisko-41-blizniakow
status: canonical
owner: piotr
truth_type: runtime
established: 2026-09-01
---

# 41 martwych plików tras, każdy o TEJ SAMEJ NAZWIE co plik żywy

## Jak do tego doszliśmy — trzy kroki, żaden zaplanowany
1. Spór o zakres naprawy ustawień AI. **Trzy niezależne osoby** oparły wnioski na
   **martwym pliku** `ai-settings.routes.ts`, nie widząc, że żywy leży w podkatalogu `ai/`.
2. Odbiór dyżuru 239. Audytor **z własnej inicjatywy** sprawdził, do którego pliku rozwiązuje
   się cytat w raporcie — i **znalazł drugi taki przypadek**: `tasks.routes.ts` martwy,
   `pmo/tasks.routes.ts` żywy. Zrobił to **bo znał pierwszy przypadek**, nie bo kazała
   instrukcja.
3. Przemiatanie całego katalogu tras. **Wynik poniżej.**

## Pomiar — ścisły, z kontrolą dodatnią
Kryterium życia: plik płaski jest **żywy** tylko wtedy, gdy importuje go brama jako
`'./routes/NAZWA.js'` albo `routes/index.ts` jako `'./NAZWA.js'`.

```
plaskich plikow tras majacych BLIZNIAKA o tej samej nazwie w podkatalogu:  54
z tego ZYWYCH:                                                            13
z tego MARTWYCH:                                                          41

KONTROLA DODATNIA: 347 importow './routes/' w Gateway.ts  ← polecenie dziala
```

**Czterdzieści jeden martwych plików tras. Każdy o tej samej nazwie co plik działający.**

## ★ Dlaczego pierwszy pomiar był zły i dlaczego to jest częścią wyniku
Pierwsze przemiatanie dało **48 martwych**. Sprawdziłem własne polecenie i **wykryłem
w nim błąd**: nie łapało importów **względnych** (`from './nazwa.js'` z wnętrza podkatalogu),
więc **zaliczało do martwych także te, które są wołane z sąsiedztwa**.

**Zgodnie z dzisiejszą regułą uruchomiłem kontrolę dodatnią** — wzorzec, o którym wiadomo,
że istnieje (`347` importów w bramie). Dopiero po niej podaję liczbę.

**Bez tego kroku podałbym właścicielowi 48 zamiast 41 — i nikt by tego nie sprawdził.**

## Skala pułapki
Każdy z tych 41 plików:
- **ma tę samą nazwę** co plik żywy,
- **wygląda jak poprawny kod** — bo nim jest, tylko nikt go nie uruchamia,
- **jest znajdowany przez wyszukiwanie po nazwie równie chętnie** jak żywy,
- **nie ma na sobie żadnego oznaczenia**.

> **Trzy osoby wpadły w jeden z nich w ciągu jednego dnia. Zostało czterdzieści.**

## To nie jest zaniedbanie — to wzorzec organizacji kodu
Stary plik zostaje **na płasko**, nowy powstaje **w podkatalogu tematycznym**
(`pmo/`, `ai/`, `organization/`, `billing/`, `integrations/`, `user/`, `audits/`, `v8/`…),
a **stary nie dostaje żadnego znaku**. Powtarza się to **41 razy**, więc jest to praktyka,
nie pomyłka.

## Rekomendacja — NIE kasować hurtem
**Skasowaliśmy dwa** (ustawienia AI, zadania) — oba po potwierdzeniu zera importerów
osobnym poleceniem, oba pojedynczo. **Pozostałych 39 nie ruszam masowo** i nie polecam tego:
jedna pomyłka w takim przemiataniu **wyłącza trasę produkcyjną**, a zysk jest porządkowy,
nie funkcjonalny.

**Proponuję jeden dyżur pomiarowy**, który:
1. **potwierdza martwotę każdego z 39 osobno**, z kontrolą dodatnią przy każdym;
2. **usuwa je pojedynczo, commit per plik** — żeby cofnięcie kosztowało jedno polecenie;
3. **sprawdza po każdym usunięciu, czy brama nadal się składa.**

**Do tego czasu obowiązuje reguła z kształtu 22:** *zanim zacytujesz `plik:linia` jako dowód,
sprawdź, czy ten plik ktoś importuje.* **Przy 41 pułapkach w jednym katalogu to nie jest
przesadna ostrożność.**
