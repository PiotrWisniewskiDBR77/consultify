---
id: NTB-003
tytul: Usunięty „Mini outline" z Notatnika
typ: sprzatanie
waga: niska
obszar: NTB
stan: do-odbioru
wlasciciel: piotr
blokuje: []
zablokowane_przez: []
zrodlo: "_RAPORT.md PEŁNY INWENTARZ / _REJESTR_ZYWY.md, 20-21.07"
stare_id: D8a
utworzone: 2026-07-21
---

## 1. PROBLEM

Element „Mini outline" dublował istniejący konspekt i zaśmiecał ekran.

## 2. PRZYCZYNA

Nie dotyczy — sprzątanie.

## 3. ROZWIĄZANIE

Usunąć „Mini outline", nie ruszając `headingOutline`.

## 4. KRYTERIUM ODBIORU

Otwórz Notatnik → nie ma „Mini outline". Konspekt nagłówków działa jak wcześniej.

## 5. DOWODY

- Gałąź `chore/d8a-notebook-remove-mini-outline`, commit `d1f14e8656`
- esbuild 0 błędów, eslint 0 błędów
- `headingOutline` nietknięte

⚠️ **Brak zrzutu ekranu.** To zmiana widoczna w interfejsie, więc zgodnie z regułą odbioru **Master ma zrobić zrzut przed pokazaniem Piotrowi.**

## 6. DZIENNIK

**2026-07-21** — zmigrowane ze źródła D8a. ⚠️ Oznaczone w źródle jako gotowe do odbioru, ale **bez zrzutu ekranu** — a to zmiana wizualna. Master robi zrzut, zanim Piotr to zobaczy (reguła: Piotr nigdy nie jest pierwszym testerem wizualnym).
