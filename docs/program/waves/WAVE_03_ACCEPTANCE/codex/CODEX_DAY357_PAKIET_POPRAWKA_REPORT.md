# CODEX — DYŻUR 357 — PAKIET PRZELOTU: POPRAWKA

Data: 2026-09-04  
Marker: `29fcbd4de20ca26d2febc50d9455128cab47ffce`  
Gałąź: `codex/day357-pakiet-poprawka-20260904`  
Zakres: dokumentacyjny; zero zmian kodu, testów i `MODULE_ACCEPTANCE.md`.

## Wynik

Dyżur zakończony. Pakiet rozróżnia teraz sporny SHA stagingu od commita usuwającego martwe poddrzewo Czatu, uczciwie opisuje panel Idei/Notatnika jako ukryty za flagą default OFF i doprecyzowuje, że 6/24 sekcji Inicjatywy jest stanem po naprawie pozostającej za flagą OFF. Wszystkie 16 wpisów G16 pozostały bez zmian.

## Wejście — wynik dosłowny

`git log --oneline -25 github-backup/grafika/m03-20260902` oraz test markera:

```text
53a9e117a4 fix(szkielet): sprostuj uzasadnienie Z29 — konfiguracja NIE ponawia juz testow
4b38ed1562 Merge agent/instr-L — instrukcje 351, 352, 353, 354 (wznowione po awarii sieci)
4efe357648 Merge agent/instr-M — instrukcje 355, 356, 357, 358 (wznowione po awarii sieci poprzedniego autora)
92e1f08543 docs(instrukcje): dyzury 353 (G19 wznowienie od R3) i 354 (etykiety narzedzi — rodzina + bezpiecznik)
ecd209251b docs(instr): instrukcje dyzurow 357 (pakiet przelotu) i 358 (niestabilnosc Bloku 3)
fb67353702 docs(instr): uratuj instrukcje dyzurow 355 i 356 + zrodla (odduplikowana sekcja sprzecznosci)
87972cbb7d docs(instrukcje): dyzury 351 (licznik kompletnosci) i 352 (preview 20 ekranow) — uratowane po awarii sieci
29fcbd4de2 docs(day348): uratuj artefakty i punkt wznowienia do repo — CZWARTY raz dzis 'dowod poza repo wyparuje'
c0f690bae3 fix(day344): polskie etykiety kafli etapow SWOT — pieciu kafli i jednej podpowiedzi
af057876d0 Merge codex/day344-swot-kafle-20260904 (odbiór adwersaryjny 04.09)
e801876e80 Merge codex/day345-panel-idei-dod-20260904 (odbiór adwersaryjny 04.09)
6377bdd543 Merge codex/day350-g16-pakiet-20260904 (odbiór adwersaryjny 04.09)
b2f6527559 fix: uratuj zrzuty DEC-388 do repo — trzeci raz dzis 'dowod poza repo wyparuje'
906d3bea48 Merge codex/day343 (odbiór adwersaryjny: SCALIC Z ZASTRZEZENIEM; POKAZAC WLASCICIELOWI)
3f84abd809 Merge codex/day346 (odbiór adwersaryjny: SCALIC Z ZASTRZEZENIEM)
4f01d13012 Merge codex/day349 (odbiór adwersaryjny: SCALIC Z ZASTRZEZENIEM)
48a5a09bb7 Merge codex/day348 (odbiór adwersaryjny: SCALIC Z ZASTRZEZENIEM — R1+R2 realne, R3-R6 niewykonane)
5a2c2c24b6 Merge codex/day347 (odbiór adwersaryjny: SCALIC)
49e2cabec7 docs(day343): raport domkniecia DEC388 (343 R6)
c7199cad1e docs(day349): odroznij opis zakazu od wyciszenia
c339160e48 docs(day349): zakoncz raport bez falszywej naprawy
b7092f9913 test(day343): ustabilizuj render karty w pelnym pakiecie
d1b0655d29 docs(day347): usun biale znaki z raportu
a4c2e6cdda docs(day347): raportuj przyczyne i pozostaly dlug
e80150b50f docs(day343): para zrzutow OFF-ON karty inicjatywy (343 R5)
MARKER OK
```

Sanity po utworzeniu worktree:

```text
29fcbd4de20ca26d2febc50d9455128cab47ffce
```

`git status --short | head -3` nie zwrócił żadnej linii. Dysk: 38 GiB wolne. Porty 6416 i 5556: brak listenerów. Tip uciekł do przodu o 7 commitów/35 plików; surowe listy: `/private/tmp/cx-day357-pakiet-poprawka-artefakty/tip-drift-log.txt` i `tip-drift-files.txt`.

## Poprawki

1. Panel Idei/Notatnika: pakiet mówi teraz w obu miejscach, że kod jest po `660482d485`, ale `ff_idea_notebook_right_panel_prototype` ma default OFF (`src/utils/ideaNotebookRightPanelPrototypeFlag.ts:1,27`), a bramka zwraca stary panel (`src/components/MyWork/prototypes/IdeaNotebookRightPanelPrototype.tsx:97`).
2. SHA `1c4b5a5635`: wiersz wersji nazywa go spornym znacznikiem stagingu; dwa pozostałe wystąpienia nazywają go commitem usuwającym martwe poddrzewo Czatu. `fb6547b7d0`, zdanie o braku weryfikacji i pytanie o rozbieżność pozostają.
3. Stan Inicjatyw: dopisano, że 6/24 jest stanem naprawionym, lecz poprawka pozostaje za `ff_initiative_sections_complete` default OFF (`src/utils/initiativeSectionsCompleteFlag.ts:1,13-15,39`).

## H1–H5

| Hipoteza | Werdykt | Komenda / wynik |
| --- | --- | --- |
| H1 — panel bez redeployu+flagi nie jest widoczny | POTWIERDZONA | `sed -n '1,3p;25,31p' ...Flag.ts` pokazał klucz i `?? false`; grep bramki pokazał `97: if (!...) return <>{legacy}</>;`; obaj konsumenci renderują przez Gate. |
| H2 — tylko My Work z nieopisanych wierszy ma defekt OFF | POTWIERDZONA | Audyt 6/6 w `evidence/day357/r1-flagi-wierszy.md`: Chat/menu, Chat/panel, Interview bez flagi tej zmiany; Tools i Initiatives miały OFF; My Work wymagał korekty. |
| H3 — trzy trafienia SHA, dwa znaczenia | POTWIERDZONA | grep na markerze: wiersze 16, 65, 389; dwa znaczenia. |
| H4 — 9 trafień na markerze, część bez kotwicy | POTWIERDZONA | `grep -c` na markerze = 9. Po R1 = 10, bo dodano drugie uczciwe ostrzeżenie. Bez kotwicy pozostały dwa zdania; patrz `r2-kotwice.md`. |
| H5 — dryf 11/17 od odświeżenia | POTWIERDZONA | Od `2d74ea1d75`: 11 scaleń/17 plików; od `c950ede121`: 102/337. Przegląd 17/17: `r3-dryf.md`. |

## Rodzina sześciu wierszy

| Wiersz wejściowy | Flaga | Default | Wynik |
| ---: | --- | --- | --- |
| 388 Chat/menu | brak flagi tej zmiany | — | bez korekty |
| 389 Chat/panel | brak flagi; usunięcie martwego kodu | — | doprecyzowano znaczenie SHA |
| 390 My Work | `ff_idea_notebook_right_panel_prototype` | OFF | poprawiono |
| 391 Interview | brak flagi tej zmiany | — | bez korekty |
| 392 Tools | `VITE_VF1_DYNAMIC_SWOT_SEVEN_STAGES` | OFF | już opisane |
| 393 Initiatives | `ff_initiative_sections_complete` | OFF | już opisane; R4 rozszerzył kontekst |

Pełne kotwice: `evidence/day357/r1-flagi-wierszy.md`.

## Zdania „zobaczysz/widoczne”

Pełna lista 10 trafień po R1 wraz z oceną TAK/NIE jest w `evidence/day357/r2-kotwice.md`. Kotwicy nie mają dwa twierdzenia: widoczność OKR/ROI niezależnie od przełącznika oraz możliwa niewidoczność flag Wyników/Finansów/Organizacji/kreatora. Zapisano je w rejestrze jako R1; nie zostały uznane za fałszywe bez dowodu.

## Dryf produktu

Przejrzano 17/17 plików od `2d74ea1d75`. Trzy wspólne pliki zmieniają fokus wierszy, fallback fokusu oraz obowiązkowy pusty blok relacji; nie przeczą krokom pakietu. Pozostałe zmiany dotyczą raportowego licznika kompletności, kafli SWOT, kontraktów Inicjatyw i panelu My Work. Żadna nie wymaga dodatkowej korekty poza R1/R4. Ocena każdego pliku: `evidence/day357/r3-dryf.md`.

## G16 — wynik dosłowny

`diff evidence/day357/g16-przed.txt evidence/day357/g16-po.txt`:

```text
```

`git diff --name-only 29fcbd4de20ca26d2febc50d9455128cab47ffce..HEAD -- docs/program/waves/WAVE_03_ACCEPTANCE/modules/`:

```text
```

Oba wyniki są puste. 16/16 wpisów przed i po: `TECHNICAL_PACKET_READY / OWNER_RETEST_PENDING`.

## Pomiary przed / po

| Pomiar | Przed | Po |
| --- | ---: | ---: |
| liście PL | 35199 | 35199 |
| liście EN | 33066 | 33066 |
| focus-canon | 0 | 0 |
| list-canon | 0 | 0 |
| artefakt | 0 | 0 |
| reach | 0 | 0 |
| `tests/unit/flags/` pełne nazwy | 28 | 28 |

`diff przed-nazwy.txt po-nazwy.txt` jest pusty; żadna nazwa nie doszła ani nie zniknęła. Pakiet jest czysto jednostkowy (`RUN_DB_TESTS=0 MOCK_DB=true`), więc nie dowodzi runtime, HTTP, JWT ani PostgreSQL. Pułapki testowe a–d nie leżą na tej ścieżce; pułapka e dotyczy pakietu dokumentacyjnego i została obsłużona audytem kotwic, nie testem.

Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Baza tego dyżuru nie zawiera wierszy konfiguracji SMTP. Nie uruchomiłem `server/src/index.ts` ani żadnego drenażu outboxu. Żaden e-mail ani zaproszenie kalendarzowe nie zostało wysłane.

## Artefakty poza repo

- `przed.json`: `e09c8d1dad7a46326f7c7e2a3a103fbad87f6a06e61be6b110c7e182252d9a1d`
- `po.json`: `eb3ec4b82ae44b37a99477c6309e01229c3677881bba8ef768b87b79bbb42308`
- `przed-nazwy.txt` i `po-nazwy.txt`: `c326282895b707644ececc02c79dddc769f60541fe1e6c9dbc6748ef81b8d2cd`
- `test-names.diff` i `g16-diff-final.txt` (puste): `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`
- `tip-drift-log.txt`: `efdc51259a3c5740b15ef4be4997536cf3538af736daba8d94e28d3cf3da3889`
- `tip-drift-files.txt`: `f2c0b5b8728f7086f4c27de6a7d36eda1638cddc1cb39da6daab7e541b61ac64`

## Korekty wobec instrukcji

1. Słowniki na markerze mają PL **35199** i EN **33066**, a nie 35198/33065. Wiążący jest pomiar wykonawcy; wartości przed i po są identyczne.
2. Po R1 licznik `zobaczysz|widoczne` wynosi 10, nie 9, ponieważ prawdziwe ostrzeżenie o starym panelu zostało dodane w sekcji modułu i tabeli. Mianownik wejściowy na markerze wynosił 9.
3. Instrukcja w nagłówku mówi „`1c4b5a5635` występuje dwa razy”, lecz jej dalsza H3 i pomiar poprawnie mówią o trzech trafieniach. Pomiar: trzy trafienia w dwóch znaczeniach.
4. Generator check `grep -rl 'PRZELOT_WLASCICIELA_STAGING_20260904' scripts/` nie zwrócił trafień; pakiet nie jest oznaczony jako generowany.

## TWIERDZENIA NIEZWERYFIKOWANE

- Nie sprawdzono stagingu, demo ani produkcji, ponieważ `Z28` bezwzględnie zakazuje połączenia.
- Nie rozstrzygnięto, który SHA faktycznie opisuje staging.
- Nie potwierdzono w runtime dwóch zdań bez kotwicy wymienionych w rejestrze R1.
- Nie uruchamiano bazy 6416 ani harnessu 5556; były wyłącznie zarezerwowane.

## PYTANIA DO NADZORCY

1. Który SHA opisuje wersję stagingu: **A — `1c4b5a5635`**, czy **B — `fb6547b7d0`**?
2. Czy dwa zdania bez kotwicy mają zostać: **A — uzupełnione o wskazane przez nadzorcę SHA/plik:linia**, czy **B — usunięte przed przelotem**?

## Commity pozycji

- R1: `edf460a867`
- R2: `a267d9df58`
- R3: `2b77207ee4`
- R4: `18b7a9dee7`
- R5: ten commit
