# Dyżur 320 — licznik P0/P1 jako bramka G20

Marker: `bc18bc7acac2ec825ebb3db2f1309738ab034d58`  
Gałąź: `codex/day320-licznik-g20-20260904`  
Stan: **W TOKU — R1 zmierzony; R2–R7 jeszcze nie są dowodem**

## Start z vaulta

```text
df -h /
/dev/disk3s1s1   1.8Ti    12Gi    82Gi    13%    459k  861M    0%   /

git -C "$VAULT" merge-base --is-ancestor "$MARKER" github-backup/grafika/m03-20260902
MARKER OK

git -C "$WT" rev-parse HEAD
bc18bc7acac2ec825ebb3db2f1309738ab034d58

git -C "$WT" status --short | head -3
<pusto>
```

Tip `github-backup/grafika/m03-20260902` uciekł do przodu o sześć commitów; zgodnie z §0.1 pracuję dokładnie z markera. Zakres różnicy obejmuje wyłącznie `_instr_src/*` i instrukcje dyżurów 314–323; pełny wynik `git log`/`git diff --name-only` został zmierzony przed R1.

Porty `5476` i `6336`: brak procesu `LISTEN`. `docker ps --format "{{.Names}}" | grep -c cx-day320 || true` zwróciło `0`. Baza nie została utworzona: narzędzie jest czysto plikowe i zgodnie z wiążącym rozstrzygnięciem użyto wariantu (C), nie przedstawiam fikcyjnego dowodu DB.

## R1 — pomiar wejścia i zgodność z regułą E1

### Wyniki dosłowne

```text
node scripts/dev/p0p1-licznik-e1.mjs > /dev/null 2>&1; echo "kod wyjscia = $?"
kod wyjscia = 0

grep -n "BLOKUJE:" docs/program/waves/WAVE_03_ACCEPTANCE/REJESTR_P0P1_BLOKUJACE_G20.md | head -2
9:**BLOKUJE: 25**

git diff --stat -- docs/program/waves/WAVE_03_ACCEPTANCE/REJESTR_P0P1_BLOKUJACE_G20.md
<pusto — produkt skryptu bajtowo zgodny z repo>

rozkład wszystkich werdyktów:
WERDYKT BLOKUJE 25
WERDYKT NAPRAWIONE 26
WERDYKT ODLOZONE_DEC 58
WERDYKT ZAMKNIETE_DEC 12
WERDYKT W_BUDOWIE 0

rozkład powodów BLOKUJE:
POWOD_BLOKUJE BRAK_SHA_DLA_NAPRAWIONE 12
POWOD_BLOKUJE NIEROZSTRZYGNIETE 13

mianownik:
121

grep wołaczy po .github/, scripts/, package.json po wyłączeniu samego pliku i testów:
0
```

```text
RUN_DB_TESTS=0 MOCK_DB=true node --test --test-reporter=spec scripts/dev/__tests__/p0p1-licznik-e1.test.mjs
✔ mutacja: kolizja ASM z owner-feedback zachowuje dwa obiekty
✔ mutacja: nieistniejący DEC czerwieni pozycję
✔ mutacja: nieistniejący SHA czerwieni pozycję
✔ mutacja: mianownik poniżej podłogi zatrzymuje parser
✔ mutacja: pozycja bez werdyktu ląduje w BLOKUJE
ℹ tests 5
ℹ pass 5
ℹ fail 0
kod wyjscia testow = 0
```

Pułapki §0.2d/Z33 dla tego pakietu: (a)–(d) nie leżą na ścieżce, bo test importuje wyłącznie czysto plikowe `evaluateCorpus()` i nie montuje Gateway, auth, V8 ani DB. Pułapka (e)(1) została wyłączona przez właściwy runner `node --test`; (e)(7) jest pilnowana przez test podłogi mianownika. Ten przebieg dowodzi zachowania parsera/klasyfikatora w pięciu mutacjach, nie ścieżki produktu, HTTP ani bazy.

### Tabela zgodności

| Werdykt | Deklarowana reguła E1 | Faktyczna implementacja | Ocena |
|---|---|---|---|
| `NAPRAWIONE` | Raport 301 pokazuje 26 w nieblokującym rozkładzie (`:32-39`), lecz nie zawiera deklaratywnego zdania „NAPRAWIONE bez SHA nie blokuje”. Teza instrukcji, że §R3 raportu 301 tak mówi, nie ma odpowiednika w pliku. | `p0p1-licznik-e1.mjs:135-141`: status naprawy bez SHA albo bez SHA będącego przodkiem HEAD daje `BLOKUJE`; dopiero poprawny SHA daje `NAPRAWIONE`. | `EVIDENCE_MISSING`: nie można uczciwie oznaczyć `SKRYPT_OSTRZEJSZY` wobec nieistniejącego cytatu deklaracji; faktyczny skrypt jest ostrzejszy od tezy instrukcji. |
| `ZAMKNIETE_DEC` | Raport 301 `:54`: „Pozycje oznaczone decyzją nie blokują wyłącznie według przyjętej reguły E1”. | `:144-146`: istniejący DEC bez wzorca odłożenia daje `ZAMKNIETE_DEC`. | `ZGODNE`. |
| `ODLOZONE_DEC` | Ten sam cytat raportu 301 `:54`; decyzja jest podstawą nieblokowania, nie dowodem implementacji. | `:144-146`: istniejący DEC i wzorzec odłożenia dają `ODLOZONE_DEC`. | `ZGODNE`. |
| `W_BUDOWIE` | Raport 301 `:53`: zero oznacza wyłącznie brak pozycji z jednoznacznym numerem dyżuru w wymaganym formacie. | `:130-133`: status budowy i numer dyżuru dają `W_BUDOWIE`. | `ZGODNE` dla rozpoznawania; raport nie deklaruje osobno polityki blokowania. |
| `BLOKUJE` | Raport 301 `:45` deklaruje 25 pozycji `BLOKUJE`; `:52` ogranicza kompletność do pięciu źródeł. | `:128`, `:137-141`, `:148`: nieistniejący DEC, brak/niepoprawny SHA dla naprawionego lub brak rozstrzygnięcia daje `BLOKUJE`. | `ZGODNE` z raportowanym wynikiem; spór o 12 `BRAK_SHA` pozostaje decyzją reguły do R6. |

### Artefakty R1

- `/private/tmp/cx-day320-licznik-g20-artefakty/r1-przed-rejestr.txt` — SHA-256 `5dbd8f1a2db81b3b71bbb9d83859bf314dcae85ead4962687136e0334c59e2b4`.
- `/private/tmp/cx-day320-licznik-g20-artefakty/r1-przed-testy-spec.txt` — SHA-256 `e4e10194bde66007df5cf30969382172a141a4496ecb455277777a0069a16c60`.
- `/private/tmp/cx-day320-licznik-g20-artefakty/przed-nazwy.txt` — pięć pełnych nazw, SHA-256 `4f645276c5d6e955ff3c272088e676e9f687fb48b692a2fe828d2400372930f9`.

## R2 — kod wyjścia bramki

Domyślny przebieg jest fail-closed. Kod wynika z liczby wierszy o werdykcie `BLOKUJE`; jawny argument `--informational` generuje rejestr i zachowuje kod 0. `stderr` podaje liczbę oraz pełną ścieżkę rejestru.

```text
korpus BLOKUJE=0, kod wyjscia = 0
korpus BLOKUJE=1, kod wyjscia = 1

node scripts/dev/p0p1-licznik-e1.mjs
BLOKUJE: 25. Rejestr: /private/tmp/cx-day320-licznik-g20/docs/program/waves/WAVE_03_ACCEPTANCE/REJESTR_P0P1_BLOKUJACE_G20.md
kod wyjscia = 1

node scripts/dev/p0p1-licznik-e1.mjs --informational
BLOKUJE: 25. Rejestr: /private/tmp/cx-day320-licznik-g20/docs/program/waves/WAVE_03_ACCEPTANCE/REJESTR_P0P1_BLOKUJACE_G20.md
kod wyjscia = 0
```

Nowy test: `bramka: kod wyjścia wynika z rzeczywistej liczby BLOKUJE, a tryb informacyjny nie czerwieni`. Zielony przebieg: 6 testów, 6 pass, 0 fail, kod 0.

Dowód mutacyjny warunku bramki, dosłownie:

```text
mutacja: exitCode ustawione bezwarunkowo na 0
✖ bramka: kod wyjścia wynika z rzeczywistej liczby BLOKUJE, a tryb informacyjny nie czerwieni
AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:
0 !== 1
ℹ tests 6
ℹ pass 5
ℹ fail 1
mutacja bez warunku, kod wyjscia testow = 1

cp /private/tmp/cx-day320-licznik-g20-scratch/p0p1-licznik-e1.r2-green.mjs scripts/dev/p0p1-licznik-e1.mjs
po cofnieciu mutacji, kod wyjscia testow = 0
```

Mutacja była lokalna, cofnięta przez `cp` zgodnie z Z27; nie weszła do commita.

## R3 — wołacz npm i CI

Dodany wpis (jedyny wpis zmieniony w `package.json`):

```json
"check:p0p1-e1": "node scripts/dev/p0p1-licznik-e1.mjs"
```

Dodany krok (jedyny krok zmieniony w `.github/workflows/test-suite.yml`):

```yaml
- name: P0/P1 E1 zero-blockers gate (G20)
  run: npm run check:p0p1-e1
```

Lokalny przebieg dokładnie tej samej komendy:

```text
npm run check:p0p1-e1
BLOKUJE: 25. Rejestr: /private/tmp/cx-day320-licznik-g20/docs/program/waves/WAVE_03_ACCEPTANCE/REJESTR_P0P1_BLOKUJACE_G20.md
kod wyjscia = 1
```

To zamierzona czerwień: brak progu, `if:` i `continue-on-error`. Artefakty: `r3-ci-command-out.txt` SHA-256 `a0d38da9743ae4d92cba508e32a5ffe013126af022ece18e382e2ca6272dd58c`; `r3-ci-command-err.txt` SHA-256 `e2cdff8113edbef299abd6229b6891ef38a58ec0f7a189a6677c1b38dcec7781`.

Wyzwalacze workflow: `push` oraz `pull_request` wyłącznie dla `main`, `develop`, `Londyn`, `demo`, plus ręczny `workflow_dispatch`. Nie ma filtra `paths`, więc dla wymienionych gałęzi zmiana dokumentów/skryptu nie jest pomijana przez filtr ścieżek. Gałąź `codex/day320-licznik-g20-20260904` nie znajduje się w filtrze `push`, dlatego bieżący push nie uruchomi tej bramki. Z39 zabrania ręcznego realnego workflow; dowód tej pozycji jest statyczny plus lokalne wykonanie identycznej komendy. Dodatkowo job może nie dojść do nowego kroku, jeżeli wcześniejszy lint/typecheck lub bramka zapadkowa zakończy się czerwono — to ograniczenie kolejności joba, nie fałszywa zieleń samego licznika.

## Korekty wobec instrukcji

1. Instrukcja twierdzi, że „§R3 raportu 301 mówi, że `NAPRAWIONE` nie blokują”. Raport 301 nie ma samodzielnej sekcji §R3: ma zbiorczą sekcję `R2–R4`, a jedyne deklaratywne zdanie o nieblokowaniu (`:54`) dotyczy pozycji oznaczonych decyzją. Dlatego konflikt skrypt–deklaracja dla 12 pozycji ma stan `EVIDENCE_MISSING`, dopóki R6 nie zapisze jawnej decyzji reguły.
2. Pierwsza próba zapisania kodu wyjścia przez potok zakończyła się błędem powłoki `zsh: read-only variable: status`. Nie użyłem tego jako pomiaru. Powtórzona obowiązkowa komenda bez potoku zwróciła `kod wyjscia = 0`; to ona jest wynikiem R1.

## TWIERDZENIA NIEZWERYFIKOWANE

- R4–R7 nie zostały jeszcze wykonane ani zweryfikowane.
- Nie zweryfikowano produktu, UI, HTTP, bazy ani środowiska zewnętrznego; nie leżą w zakresie czysto plikowej bramki.
- Nie ustalono jeszcze rozstrzygnięcia 12 pozycji `BRAK_SHA_DLA_NAPRAWIONE` ani liczby pozycji faktycznie zależnych od dziedziczenia rodzinnego DEC.
- Nie uruchomiono GitHub Actions; zgodnie z Z39 dowód CI będzie lokalny i statyczny.
