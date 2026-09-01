---
doc_id: funkcje-ksztalt-23
status: canonical
owner: piotr
truth_type: runtime
established: 2026-09-01
---

# DWUDZIESTY TRZECI kształt: sygnatura zabezpieczenia bez zabezpieczenia

## Zmierzony przypadek
Funkcja odczytu dokumentu w Studio **przyjmowała identyfikator użytkownika jako parametr —
i nigdy nie używała go w zapytaniu do bazy.**

Skutek: obca organizacja **odczytała, nadpisała i skasowała** cudzy dokument. Sześć z ośmiu
tras rodziny nie miało żadnej kontroli.

## Dlaczego to jest osobny kształt, sformułowane przez tor grafiki
> **Brak wygląda na brak. Nieużyty parametr wygląda na obecność.**

Funkcja z parametrem `userId` w sygnaturze wygląda **dokładnie jak kod, który sprawdza
uprawnienia** — dla czytającego człowieka, dla przeglądu kodu, **i dla każdego narzędzia
przesiewającego**, bo narzędzie zwykle szuka **obecności** identyfikatora użytkownika
albo organizacji w okolicy.

**Nasz własny audyt rodzin tras szukał między innymi tak. Ten przypadek złapał wyłącznie
dlatego, że wykonawca zszedł do samego zapytania SQL.**

## Reguła
> **Obecność parametru uprawnień w sygnaturze nie jest dowodem kontroli.
> Dowodem jest jego użycie w warunku zapytania — sprawdzane do samego SQL.**

Praktycznie: przy przesiewie uprawnień **nie licz wystąpień `organizationId`/`userId`
w pliku**. To jest miara, którą ten kształt oszukuje z definicji. **Czytaj zapytanie.**

## Rodzina, do której to należy
Ten sam mechanizm co inne kształty tego programu, o piętro niżej:
- **wołacz istnieje ≠ komponent się renderuje**
- **plik istnieje ≠ ktoś go uruchamia** (kształt 22 — dwa pliki o tej samej nazwie)
- **parametr istnieje ≠ jest używany** ← ten

**We wszystkich trzech obecność struktury jest brana za dowód działania.**

## Druga rzecz z tej samej wymiany — pusta lista NIE jest wynikiem
Po naprawie eskalacji obca organizacja dostaje **`200` z pustą listą**, nie `403` —
**celowo, żeby nie ujawniać istnienia cudzych danych.**

Tor grafiki nazwał to **odwrotnością pułapki „zamknięte przez wygaszenie"**: tam funkcja
wyglądała na działającą, bo nikt niczego nie widział; **tu to samo wrażenie wzrokowe
towarzyszy zachowaniu POPRAWNEMU.**

> **Pusta lista na zrzucie nigdy nie jest wynikiem sama z siebie. Trzeba wiedzieć,
> czyim kontem zrobiono zdjęcie.**

To dotyczy każdego zrzutu robionego z realnego serwera — dziś jeszcze nie boli, bo oba tory
fotografują z danych podstawionych, **ale zaboli natychmiast po przejściu na realny łańcuch,
i będzie wyglądać jak defekt.**
