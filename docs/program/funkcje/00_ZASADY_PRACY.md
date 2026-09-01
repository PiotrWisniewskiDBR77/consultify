---
doc_id: funkcje-zasady-pracy
status: canonical
owner: piotr
truth_type: process
established: 2026-08-30
---

# Funkcje — zasady pracy (tor równoległy do grafiki)

Cel toru: **uruchomić wszystko, co już jest zbudowane, a nie jest aktywne**, i
domknąć łańcuch dostarczenia wg `docs/program/plany/PLAN_FUNKCJE.html`.

## ★★ REGUŁA NR 1 — zakaz budowania w ciemno (ta sama, co w grafice)

> **Żadna funkcja nie wchodzi do budowy, dopóki nie ma dowodu, że nie istnieje.**

Bardzo dużo kodu jest gotowe i wyłączone. Kolejność obowiązkowa:
1. znajdź trasę / serwis / komponent;
2. **czwarta warstwa** — czy jest realnie wołane i renderowane (wpis w rejestrze,
   `import`, obecność w mapie widoczności **nie są dowodem**);
3. jeśli za flagą — **włącz lokalnie i zmierz**;
4. dopiero teraz: podłączyć, naprawić czy zbudować.

**Podłączenie i włączenie są tańsze od budowy i mają pierwszeństwo.**

## ★★ REGUŁA NR 2 — klasyfikacja przed pokazaniem

| Ocena | Warunek | Czy właściciel widzi |
| --- | --- | --- |
| **A** | działa przez interfejs, dowód mutacyjny w obie strony, zero atrap | **TAK** |
| **B** | działa z **nazwanymi** ograniczeniami | **TAK** — ograniczenia podane pierwsze |
| **C** | nie działa albo dowód nie trzyma | **NIE** — naprawa i powrót |
| **D** | martwe · za flagą bez decyzji · poza rundą | **NIE** — do `ODLOZONE.md` |

## ★★ REGUŁA NR 3 — odbiór adwersaryjny przed każdym scaleniem

Bez wyjątku. W ostatnich dniach odrzucił dyżur 128 (czerwony test), 131
(test-tautologia + strażnik ominięty przez własną nową ścieżkę) i **oba plany
programu**. Raport wykonawcy **nie jest dowodem** — liczby przelicza odbiorca,
mutacje powtarza własnymi rękami.

## ★★ REGUŁA NR 4 — Codex dostaje duże klocki, nie dokończenia

Dokończenia, poprawki po odbiorze i FIX-y robi **wewnętrzny robotnik nadzorcy**,
na własnej gałęzi, równolegle. **Zakaz dokładania pozycji do biegnącego dyżuru** —
to jest ping-pong i właściciel go zakazał wprost.

## ★★ REGUŁA NR 5 — trwały zapis zamiast rozmowy

Kontekst się urywa, model bywa podmieniany. Wszystko ustalone, zmierzone albo
odebrane ląduje w pliku **w tej samej godzinie**. Rozmowa nie jest nośnikiem wiedzy.

## Higiena wykonania

Świeża gałąź per dyżur z markera · commit per krok · **push na `github-backup`
po pierwszym commicie**, nie na koniec · zakaz `git stash` (schowek współdzielony
między worktree — odkładanie przez `cp`) · maks. 3–4 tory równolegle · zakaz
połączeń do demo, stagingu, produkcji i Railway z poziomu dyżuru.

**Ekonomia modeli (potwierdzone przez właściciela 30.08):** nadzorca NIE mierzy sam,
gdy może zlecić — rekonesansy i weryfikacje tez robią **równoległe wewnętrzne Sonnety**
(do odczytu, każda teza z dowodem plik:linia); Opus tylko do trudnego kodu i eskalacji;
nadzorca zleca, scala i podpisuje. Wynik każdego rekonesansu ląduje w pliku repo,
nie w rozmowie — pliki są kanałem między agentami i między sesjami.

## Pliki tego toru

- `REJESTR_WDROZENIA.md` — stan per faza i moduł
- `../KOORDYNACJA.md` — styk z torem grafiki
- `../plany/PLAN_FUNKCJE.html` — plan, siedem faz
- `../system-pracy/02_SZKIELET_INSTRUKCJI.md` — szkielet instrukcji dyżuru, 41 bezpieczników

## ★★ REGUŁA NR 6 — katalog referencyjny, nie `/private/tmp/m03`

`/private/tmp/m03` jest **współdzielony z torem grafiki** i chodzi po własnej,
starszej gałęzi lokalnej. 31.08 był **205 commitów za linią integracyjną** —
robotnik wysłany tam po kartę odbioru zameldował, że pliku nie ma, i miał rację.

**Katalog do czytania stanu programu: `/private/tmp/mref`** (odłączony worktree na
tipie `codex/m03-admin-20260824`). Zlecając cokolwiek, podawaj TĘ ścieżkę. Przed
użyciem odśwież: `git -C /private/tmp/mref fetch github-backup -q && git -C /private/tmp/mref reset --hard github-backup/codex/m03-admin-20260824`.

Uogólnienie: **ścieżka do pliku nie jest adresem prawdy** — prawdą jest gałąź.
Ten sam plik pod tą samą ścieżką bywa w dwóch katalogach roboczych w dwóch
różnych wersjach albo nie istnieje wcale.

## ★★ REGUŁA NR 7 — zabezpieczenie musi mieć własną mutację

Test scenariusza, który tylko przechodzi przez zabezpieczenie, nie dowodzi, że
to zabezpieczenie jest nośne. Nazwa testu, obecność pliku i zielony happy path
nie wystarczają do uznania zasięgu, bramy stanu, idempotencji ani uprawnienia za
pokryte.

Odbiór wymaga pary na dokładnie tym warunku: po jego kontrolowanym usunięciu
test omijający jest czerwony, a po przywróceniu z kopii jest zielony; oba
przebiegi biegną z `--retry=0`, pełnymi nazwami przypadków i pustym `git diff`
po przywróceniu. Brak którejkolwiek strony oznacza `NIEUDOWODNIONE`, nie
`VERIFIED`.

To reguła z pomiaru, nie teoria: usunięcie filtra
`server/src/services/ai/embeddingService.ts:341` pozostawiło wcześniejszy
scenariusz dyżuru 210 zielony, dopóki FIX-210 nie dodał testu omijającego, który
na tej samej mutacji czerwienieje.
