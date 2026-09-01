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


---

# ★ SPROSTOWANIE (1.09, wieczór) — 39, nie 41. Mój pomiar miał ślepy punkt.

Pisarz instrukcji 248 odtworzył populację **własną metodą** i obalił dwie pozycje z mojej listy:

| Plik | Dlaczego NIE jest martwy |
| --- | --- |
| `health.routes.ts` | **montowany przez `server/src/index.ts:117`, całkowicie POZA `Gateway.ts`** |
| `assessment-reports.routes.ts` | **import dynamiczny** w `healthProbeService.ts` |

**Ślepy punkt mojego pomiaru:** kryterium życia liczyło **wyłącznie importy w `Gateway.ts`
i `routes/index.ts`**. Nie obejmowało **drugiego punktu montowania** (`server/src/index.ts`)
ani **importów dynamicznych**.

**Zweryfikowane przeze mnie:** `grep -n "health.routes" server/src/index.ts` →
linia **117**, `import dbHealthRoutes`. **Plik jest żywy.**

## Dlaczego zapisuję to osobno, a nie poprawiam liczby po cichu
Podałem właścicielowi **41** jako liczbę zmierzoną, **z opisem kontroli dodatniej** —
i **kontrola dodatnia zadziałała poprawnie** (347 importów w bramie, polecenie działało).
**Narzędzie nie skłamało. Skłamało KRYTERIUM.**

> **Kontrola dodatnia sprawdza, czy polecenie się wykonało. Nie sprawdza, czy pytanie
> było dobrze postawione.**

To jest **nowa odmiana** dzisiejszej rodziny „brak pomiaru nie jest wynikiem": tam narzędzie
nie mierzyło; **tu mierzyło poprawnie coś innego, niż myślałem, że mierzy.**

**Praktycznie:** przy każdym pytaniu „czy X jest używany" **wypisz WSZYSTKIE drogi, którymi
X może być używany** (import statyczny · import dynamiczny · **drugi punkt wejścia aplikacji** ·
rejestr wtyczek), zanim uznasz brak trafień za dowód.

**Skorygowana liczba: 39 martwych bliźniaków.** Dwa skasowane wcześniej dziś
(`ai-settings.routes.ts`, `tasks.routes.ts`) były potwierdzone **osobnymi poleceniami**
i pozostają poprawnie usunięte.
