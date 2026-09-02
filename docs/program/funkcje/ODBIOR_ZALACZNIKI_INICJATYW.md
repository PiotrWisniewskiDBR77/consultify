---
doc_id: funkcje-odbior-zalaczniki-inicjatyw
status: canonical
owner: piotr
truth_type: runtime
established: 2026-09-01
---

# Załączniki Inicjatywy ginęły, a interfejs mówił „zapisano". Naprawione i udowodnione

## Defekt
Użytkownik dodawał plik do Inicjatywy, dostawał **komunikat sukcesu** — i plik **znikał
po odświeżeniu strony**. To najgorsza rodzina defektu, bo użytkownik **nie ma powodu
podejrzewać**, że coś stracił.

## Przewód był przerwany w TRZECH miejscach, nie w jednym
1. **Front** (`AttachmentsSection.tsx:25-33`) — dodanie pliku robiło wyłącznie odnośnik
   w pamięci przeglądarki i **bezwarunkowy komunikat sukcesu**. Zero wywołania API.
2. **Zaplecze** (`objectAttachmentService.ts:7,40` + więz sprawdzający w migracji dyżuru 147)
   — dopuszczało wyłącznie `task` i `decision`. **Nawet gdyby front wołał, zaplecze
   odrzuciłoby żądanie.**
3. **★ Znalezione dopiero w trakcie naprawy, nieopisane w zgłoszeniu:** widok Inicjatywy
   **nigdy nie wczytywał załączników z serwera** dla realnej inicjatywy — po każdym wejściu
   lista wracała do pustej.

**Bez punktu trzeciego zdanie „przeżywa przeładowanie" byłoby FAŁSZEM** — wysyłka by działała,
a ekran po odświeżeniu i tak pokazywałby pustkę. **Naprawa dwóch z trzech ogniw dałaby
zielone testy i dalej gubiła dane.**

> To jest ósmy raz w tym programie, kiedy „właściwa rzecz jest w kodzie, brakuje ostatniego
> przewodu" — i **pierwszy, w którym przewodów brakowało trzech naraz.**

## Dowód — para „ginie / przeżywa" na realnym Postgresie
**Przed naprawą — 4 na 4 czerwone.** Test nazwany wprost: *„upload, potem niezależne
przeładowanie — plik nadal jest"*. Padał, bo funkcji wysyłki **nie było**, a zaplecze
odpowiadało `Invalid object type`.

**Po naprawie — 4 na 4 zielone**, z niezależnym przeładowaniem z serwera.

**Para uprawnień, oba człony obowiązkowe:**
- **właściciel widzi** — kolega z **tej samej** organizacji (nie ten, kto wysłał) widzi plik;
- **obcy nie widzi** — użytkownik z **innej** organizacji dostaje `404`, zero wiersza w bazie.

Drugi człon bez pierwszego byłby spełniony także wtedy, gdyby funkcja **nie działała nikomu** —
a to zdarzyło się w tym programie **pięć razy**.

## Mutacja celująca w naprawę
Cofnięto cztery pliki, usunięto migrację, ręcznie cofnięto więz w bazie → **czerwono**.
Przywrócono przez kopiowanie (nie schowek — jest współdzielony) → potwierdzono
**identyczność bajt w bajt** pięciu plików → **zielono**. `git diff` czysty.

## Migracja
**Addytywna** — tylko poszerza więz, zero utraconych wierszy. Przeszła **pełny łańcuch
~700 migracji na bazie od zera**, powtórzenie nic nie zmienia. Kolejność sprawdzona:
prefiks `20260901` sortuje się **po** migracji tworzącej tabelę — **pułapka „kolumna
dodawana później alfabetycznie" nie występuje.**

## ★ Sprostowanie do raportu wykonawcy
Wykonawca napisał, że zależność `tesseract.js` jest **„nieobecna w `package.json`"**.
**Sprawdziłem — to nieprawda.** Jest zadeklarowana w `server/package.json:65` (`^7.0.0`).
Brakowało jej wyłącznie w katalogu pakietów **w korzeniu**, co utrudnia uruchamianie
testów stamtąd. **To jest kłopot lokalnego środowiska, nie defekt produktu** i nie należy
go zgłaszać jako braku zależności.

## Zgłoszone, świadomie nienaprawione
**Martwy duplikat tego samego wzorca** w `InitiativeDocumentView.tsx:~3851-3865` — para
funkcji wysyłki i usuwania podana dalej, ale **nigdy nieczytana** przez renderowany
komponent. Dziś bez wpływu na interfejs, ale to **ta sama fałszywa obietnica zapisu**.
Wydzielone jako osobne zadanie zamiast poszerzania zakresu naprawy — zgodnie z zasadą
zakazu dokładania pozycji do biegnącej pracy.
