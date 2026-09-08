# J7b — dowód wizualny modułu 07 REALIZACJA (EN i PL)

Stanowisko: API `127.0.0.1:4189` / Vite `127.0.0.1:3209` / baza
`consultify_kopia_final` (`NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false
DB_TYPE=postgres DB_MANAGED_SCHEMA=off`, Vite `--mode test`), konto
`audyt@dbr77.local`, 1440×900, motyw jasny. Skrypt: `scripts/dev/jezyk-j7/zrzuty-j7.mjs`.

## Wynik

| | EN (polskie słowa w interfejsie) | PL (angielskie słowa w interfejsie) |
| --- | --: | --: |
| PRZED | **653** | **1** |
| PO | **0** | **0** |

Liczby PRZED w `przed/_podsumowanie.json` pochodzą z pierwszej wersji przyrządu.
Po pomiarze poprawiono trzy fałszywe trafienia (patrz `przed/_podsumowanie_skorygowane.json`);
tabela wyżej i porównanie PRZED↔PO stoją na TYM SAMYM, poprawionym przyrządzie.

## Co liczy przyrząd

Cały `document.body.innerText` — pasek modułu, tabela, PODGLĄD (`aside`) i modale.
Wiersz, którego treść pokrywa się z wartością z bazy (tytuł inicjatywy, zadania,
decyzji, pozycji RAID, nazwisko — również z `ie_aggregate_state.payload_json`),
trafia do wiadra **DANE** i NIE liczy się jako interfejs. Język danych to osobna
kategoria (K6) i osobna paczka — dlatego polskie tytuły zadań DBR77 widać na
zrzutach EN i to jest poprawne.

## Ekrany (każdy w EN i PL)

01 Kokpit · 02 Realizacje (lista) · 03 Realizacje (podgląd) · 04 Praca (tabela) ·
05 Praca (podgląd) · 06 Praca („Nowe zadanie") · 07 Zasoby (tabela) ·
08 Zasoby (podgląd osoby) · 09 Decyzje (lista) · 10 Decyzje („Nowa decyzja") ·
11 Ryzyka (lista) · 12 Ryzyka („Nowa pozycja RAID") · 13 Ryzyka (kebab wiersza) ·
14 Sygnały · 15 Raporty (lista) · 16 Raporty (menu „Dodaj raport") · 17 `?view=kanban`

Kokpit i generator raportów wymagają flag `ff_summaryOneLook=1` i
`ff_execReportsIntel=1` (default OFF, reguła #7 CLAUDE.md) — skrypt podaje je
w adresie.
