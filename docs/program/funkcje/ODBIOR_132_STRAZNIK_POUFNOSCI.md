---
doc_id: funkcje-odbior-132
status: evidence
truth_type: work-status
established: 2026-08-30
---

# Odbiór adwersaryjny — dyżur 132 (strażnik poufności)

**Werdykt: `B` — działa z nazwanymi ograniczeniami. SCALONY.**
Merge `9e81bd473c`. Odbierał nadzorca toru funkcji, 2026-08-30.

Reguła nr 3 zasad pracy: raport wykonawcy nie jest dowodem. **Wszystkie cztery
mutacje powtórzone własnymi rękami**, w tym jedna na realnym Postgresie
postawionym na potrzeby odbioru (`cx-odbior132-pg`, port 6019, pełne migracje,
kontener usunięty po odbiorze).

## Co zostało potwierdzone niezależnie

| Bramka | Wynik pomiaru nadzorcy |
| --- | --- |
| `B1` mutacje | **cofnięcie `aiContextBuilder.ts` → `R4` czerwony · cofnięcie `ai.routes.ts` → `R2` i `R3` czerwone · cofnięcie `ContextRetrievalService.ts` → `R1` czerwony na realnym Postgresie**, z asercją `expected [ { …(11) } ] to deeply equal []` — czyli dokument poufny **realnie wracał** przed naprawą |
| `B2` brak asercji na tekście źródła | `grep readFileSync` w trzech plikach testów → zero |
| `B3` jawna poufność | test wstawia dokument z `sensitivity='confidential'` wprost; kolumny istnieją z wartościami domyślnymi `allowed`/`internal` |
| `B4` przeliczenie wołaczy | **2 → 3**, przeliczone własną komendą; nowa droga do promptu **nie powstała** |
| `B5` inwentarz `R5` | pełny, z uczciwym wskazaniem ścieżki sąsiedniej |
| `B6` zero flag | `ENABLE_ORG_KNOWLEDGE_RETRIEVAL` **nietknięta**; zero migracji; zero nowych flag |
| `B7`/`B8` | obie sekcje obecne i niepuste |
| licencja plikowa | **zero plików spoza tabeli** — sprawdzone `git diff --name-only` |

## Ocena konstrukcji — dlaczego przechodzi

Wykonawca **nie powielił polityki poufności w SQL-u** (co było zakazane).
Zamiast tego wyprowadził `governedAttachmentDocIds` z wyniku strażnika i tym
zbiorem bramkuje wszystkie trzy dalsze wejścia. Skutek uboczny jest lepszy niż
zamówienie: **przy błędzie strażnika zbiór jest pusty, więc `E1`, `E2` i `E3`
milkną razem** — całość jest fail-closed. Objęta została też czwarta droga
(`ragService`), której instrukcja nie wymieniała.

## ★ Regresja złapana na odbiorze — jedyna, naprawiona

`server/src/services/v8/__tests__/contextRetrievalServiceAgent.test.ts`
— na markerze **4/4 zielone**, po zmianie **1 czerwony**. Test istniał wcześniej
i **nie należy do 220 „zastanych" porażek** wymienionych w raporcie.

Przyczyna: atrapa `dbAll` zwracała **jedną** odpowiedź, a strażnik dokłada własne
zapytanie do `knowledge_docs`. Bez drugiej atrapy strażnik dostaje `undefined`,
jest fail-closed i blokuje dokument — test mierzył brak atrapy, nie produkt.

**To nie jest defekt produktu** — na realnej bazie kolumny istnieją z wartościami
domyślnymi. Naprawione przez nadzorcę (`b87b5af3b5`), test wraca na `4/4`.

**Dlaczego wykonawca tego nie mógł naprawić:** plik leży w
`server/src/services/v8/__tests__/`, **poza jego tabelą licencji**. Zachował się
zgodnie z zasadami. **Luka jest w mojej instrukcji** — nie przewidziałem, że
uszczelnienie `fetchAccessibleDocuments` dotknie ścieżki agenta.

## Ograniczenia nazwane — to jest powód oceny `B`, nie `A`

1. **Pełny łańcuch HTTP przez `ApiGateway` nie został dowiedziony.** Wykonawca
   oznaczył to uczciwie jako `NOT PROVEN`. Dowód sięga warstwy serwisu i trasy,
   nie realnego żądania z przeglądarki.
2. **Liczba „220 zastanych `FAIL`" nie została zweryfikowana różnicowo.**
   Pomiar różnicowy wykryłby regresję opisaną wyżej. Do czasu takiego pomiaru
   **tej liczby nie wolno cytować jako stanu zastanego.**
3. **Pozostaje ścieżka sąsiednia, nieobjęta strażnikiem** — `AIPipeline` dokłada
   do promptu teksty z `project_knowledge(kind='text')`. Strażnik działa na
   `knowledge_docs`, więc **wpisy tekstowe projektu go omijają**. Zgłoszone przez
   wykonawcę samodzielnie. To jest kandydat na osobny dyżur, nie rozszerzenie tego.

## Wnioski metodyczne — do szkieletu instrukcji

**★ `§0.2c` szkieletu kłamie.** Twierdzi, że `DB_TYPE=postgres` w linii komendy
nadpisze konfigurację. **Nie nadpisze** — `server/vitest.config.ts:17` przybija
`DB_TYPE: 'sqlite'` w bloku `test.env`, a ten wygrywa ze środowiskiem. Zmierzone
niezależnie przez wykonawcę i przez nadzorcę, ta sama asercja
`expected 'sqlite' to be 'postgres'`. **Do poprawienia u źródła.**

**★ Tabela licencji musi obejmować testy modułów zależnych.** Instrukcja licencjonuje
testy dotykanego pliku, ale nie testy **innych** modułów, które przez niego przechodzą.
Wzorzec do dopisania: przed wydaniem policz `grep -rl <zmieniany-symbol> --include='*.test.ts'`
i wpisz znalezione pliki do licencji albo jawnie do pozycji pomiarowej.

**★ „Zastane porażki" wymagają pomiaru różnicowego.** Sam mianownik nie wystarczy —
liczba porażek na markerze i na HEAD musi pochodzić z **dwóch przebiegów tej samej
komendy**. Inaczej porażka spowodowana chowa się w wiadrze zastanych.
