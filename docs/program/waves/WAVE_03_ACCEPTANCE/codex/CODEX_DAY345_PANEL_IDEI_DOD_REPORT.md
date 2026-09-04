# CODEX DAY 345 — PANEL IDEI I NOTATNIKA: DOMKNIĘCIE DoD

Stan: **R1–R6 ZROBIONE lokalnie; OWNER_REVIEW_REQUIRED; release/deploy NOT_PROVEN**.
Baza pracy: `6a4919f72db338e7f49a2cacb3787d20cc649883`.
Gałąź: `codex/day345-panel-idei-dod-20260904`.

## Start, marker i rozjazd tipa

Przed materializacją `df -h /` pokazał `30Gi` wolne; po materializacji i przed
pomiarami pozostawało `14Gi`. Porty `6392` i `5532` były wolne, a kontener
`cx-day345-pg` nie istniał.

Wynik markera i sanity, dosłownie:

```text
MARKER OK
6a4919f72db338e7f49a2cacb3787d20cc649883
```

`git status --short | head -3` nie wypisał nic. Tip
`github-backup/grafika/m03-20260902` był nowszy; zakres `6a4919f72d..tip`
obejmował instrukcje 343–350, korekty G20 i uratowane artefakty dyżuru 335.
Worktree zgodnie z `DEC-2026-08-26-95` pozostał dokładnie na markerze.

Lokalny `pgvector/pgvector:pg16` na `127.0.0.1:6392`: pierwszy przebieg
migracji zastosował `894`, drugi `0`; oba zakończyły się
`Postgres migrations complete`. Logi: `/private/tmp/cx-day345-panel-idei-dod-artefakty/migracje-{1,2}.log`.

## R1 — sześć wartości wejściowych z DOM

Ekran: `mywork-notebook-rail-speca`, realny `NotebookRightRail`. W obu
przebiegach `ff_artifact_right_rail=0`, `ff_notebookSpecAShell=1`; zmieniał się
wyłącznie `ff_idea_notebook_right_panel_prototype`.

| Pomiar | OFF (`prototype=0`) | ON (`prototype=1`) |
| --- | --- | --- |
| szerokość `getBoundingClientRect().width` | `320 px` | `360 px` |
| `aside` w poddrzewie | `1` | `2` |
| `aria-label` landmarku | `Szczegóły i kontekst dokumentu` | `Warsztat 3: migracja danych` |

Dowody: `/private/tmp/cx-day345-panel-idei-dod-artefakty/r1-{off,on}.json`.
Oba przebiegi: `0` błędów konsoli. R1 potwierdził trzy zastrzeżenia instrukcji.

## R2 — jeden landmark, token szerokości, stabilna nazwa

Powłoka prototypu jest teraz dekoracyjnym `div`, a jedyny landmark `aside`
pozostaje własnością `ArtifactRightPanel`. Wrapper korzysta z
`--ntype-right-panel-width`; border zastąpił inset ring, ponieważ pierwszy
pomiar po zmianie ujawnił `318 px` landmarku (2 px zużyte przez border).
Hosty przekazują dotychczasową produkcyjną nazwę dostępną.
`ArtifactRightPanel.tsx` nie został zmieniony.

Po naprawie, na tym samym ekranie i stanie flag:

| Pomiar | OFF | ON |
| --- | --- | --- |
| szerokość | `320 px` | `320 px` |
| `aside` | `1` | `1` |
| `aria-label` | `Szczegóły i kontekst dokumentu` | `Szczegóły i kontekst dokumentu` |

Dowód DOM: `/private/tmp/cx-day345-panel-idei-dod-artefakty/r2-on-final.json`.

Dowody mutacyjne dosłownie (`--retry=0`):

```text
przywrócenie w-[min(360px,100vw)] -> mutation_exit=1; 1 test FAILED
przywrócenie własnego <aside>      -> mutation_exit=1; 1 test FAILED
przywrócenie aria-label={title}    -> mutation_exit=1; 2 testy FAILED
```

Po każdym `cp` test wrócił do zieleni. Końcowe porównanie pliku z kopią zieloną:
`cmp_green_copy_exit=0`. `git diff` wobec HEAD nie był pusty, bo poprawnie
zawierał zamierzoną naprawę R2; nie przedstawiam go jako dowodu cofnięcia mutacji.
Pełny `tests/unit/mywork` przeszedł.

Pułapki Z33(a–d) nie leżą na ścieżce: pakiet jest czysto DOM/jednostkowy,
`RUN_DB_TESTS=0 MOCK_DB=true`, nie montuje Gateway, auth ani bazy. Pułapkę (e)
wyłączono przez montaż produkcyjnego `IdeaRightPanel` w teście oraz realnego
`NotebookRightRail` w pomiarze DOM.

## R3 — trzy flagi i inwentarz rodziny

Trzy licencjonowane flagi używają statycznych odwołań:
`import.meta.env.VITE_IDEA_NOTEBOOK_RIGHT_PANEL_PROTOTYPE`,
`VITE_ARTIFACT_RIGHT_RAIL_ENABLED`, `VITE_ENABLE_NOTEBOOK_SPEC_A_SHELL`.
Defaulty pozostały `OFF / OFF / ON`.

Każdy default odwrócono osobno: prototype, artifact i SPEC-A dały
`mutation_exit=1`, po `cp` pełny `tests/unit/flags` wrócił do zieleni,
`all_restored_cmp_exit=0`. Dowody: `r3-mutacja-default-*-red.json` i
`r3-flags-green.json`.

Mianownik tekstowy komendy z instrukcji wyniósł `112` przed zmianą i `109` po.
Lista bazowa zawiera także literal wzorca w komentarzu pliku referencyjnego,
więc to inwentarz trafień tekstowych, nie wyłącznie wykonywalnych odczytów.
Pełna lista po: `/private/tmp/cx-day345-panel-idei-dod-artefakty/flagi-rodzina-po.txt`,
SHA-256 `93a9a387e68608371529c92ec308e72ff380c28069a4c2b95cd6b49700337e89`.
Szacunek dla 109 trafień: 3–5 dyżurów po 20–35 flag z testem defaultu i bundla;
najpierw flagi na aktywnych ścieżkach właściciela, następnie harness-only,
na końcu martwe/nieosiągalne. Ten dyżur nie zmienił pozostałych plików.

Komenda po zmianie dla trzech plików dała `0` trafień. Komenda
`grep -rn` po `.env*`, `docker-compose*`, `railway*` dla trzech nazw env również
dała `0` trafień. Pomiar czytelników `isArtifactRightRailEnabled` dał `12`
plików, nie `11` z instrukcji.

Pułapki Z33(a–e) nie dotyczą testów flag: brak HTTP/DB/auth/renderu; env jest
stubowany jawnie, a query/localStorage czyszczone przed przypadkami.

## R4 — para Notatnika

Pierwszy właściwy przelot odtworzył zastane `9` błędów 404 w każdym motywie.
Były to dokładnie: suggest ideas (2), initiatives (1), tasks (1), decisions (1)
i backlinks dla dwóch typów (4). Wąski mock odczytów w harnessie wyzerował je.
Pierwsza para po tym kroku nadal była odrzucona: pusty filler centrum. Druga
ujawniła przewinięty nagłówek. Dopiero finalna para spełnia wszystkie warunki.

Finalny ekran `mywork-notebook-rail-speca`: realny `NotebookRightRail`, centrum
z treścią notatki, nagłówek pełny, scroll `0`, 6/6 sekcji rozwiniętych,
`aside=1`, szerokość `320 px`, błędy konsoli `0/0`, HTTP `0/0`, axe `0/0`,
długość tekstu `1463/1463`.

| Motyw | SHA-256 | Średnia jasność |
| --- | --- | ---: |
| light | `6d9f3f69fa5ab95131207678b94cfb5d397656d379a226adf9ed140bc89188ca` | `250.3713` |
| dark | `57d5656c6a097301c0159125209ed09b71a793db72fd86505f0de4b3be9529fa` | `26.9008` |

Ścieżka: `/private/tmp/cx-day345-panel-idei-dod-artefakty/r4-notatnik-final2/`;
JSON: `r4-notatnik-final2.json`. Sumy są różne. Kontrolki harnessu nie są w kadrze.

## R5 — para Idei

Ekran `ideas-teresa-panel` montuje realny `IdeaRightPanel`; canvas zawiera
czytelną mapę idei. Nagłówek pełny, scroll `0`, 6/6 sekcji rozwiniętych,
`aside=1`, błędy konsoli `0/0`, HTTP `0/0`, axe `0/0`, długość tekstu `783/783`.

| Motyw | SHA-256 | Średnia jasność |
| --- | --- | ---: |
| light | `8b8c8ae2cd49c527369a2088b9c47306c7574ea5b7e91560b76e2bcaf9222764` | `249.1259` |
| dark | `03f20c42722937a23888bbebe12892b101940c75229042454eedfdb0612a7d11` | `31.8435` |

Ścieżka: `/private/tmp/cx-day345-panel-idei-dod-artefakty/r5-idee-final/`;
JSON: `r5-idee-final.json`. Sumy są różne. Nie była potrzebna zmiana hosta R5.

## Zasięg testów

Komenda przed i po:
`RUN_DB_TESTS=0 MOCK_DB=true npx vitest run tests/unit/mywork tests/unit/flags --retry=0 --reporter=json`.

- przed: `395` pełnych nazw;
- po: `398` pełnych nazw;
- dodane: kontrakt R2 oraz dwa przypadki flag R3;
- zniknięte: `0`.

Dowody: `przed-nazwy.txt` SHA
`2b19e3c58237be907268a13c1e0959a9d6e39e7341400d9c71e9cf9658b47d56`,
`po-nazwy.txt` SHA
`790f1a30d0c25f4bac2af1053fe8aaff243585cba7fb2ce775fdab4f58949f04`,
`diff-nazwy.txt` SHA
`aea82520d953c529231a3d25f97b2043b42837b67a56821af5c7bdf7d4a7797c`.

Pułapki Z33(a–d) nie leżą na ścieżce tych czystych pakietów DOM/flag; (e) jest
wyłączona kontraktem na produkcyjnym komponencie i pomiarami realnych hostów.
Wiadomości `Not implemented: navigation to another Document` są zastanym
wyjściem testów i nie były traktowane jako błąd przeglądarki z R4/R5.

## I18n, poczta i granice dowodu

Liście bez zmian: PL `35198`, EN `33065`. Nie ustawiono wpisów w env/deploy.

`env` zwrócił `BRAK ZMIENNYCH POCZTY`; zapytanie do lokalnego `cx345` zwróciło
`0 rows` dla `settings.key LIKE 'smtp%'`; grep drenów w `Gateway.ts` zwrócił 0.

Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Baza tego dyżuru nie
zawiera wierszy konfiguracji SMTP. Nie uruchomiłem `server/src/index.ts` ani
żadnego drenażu outboxu. Żaden e-mail ani zaproszenie kalendarzowe nie zostało
wysłane.

Nie uruchamiałem pełnego runtime ani realnego HTTP przez ApiGateway: dyżur był
frontowy, a harness korzystał z licencjonowanych, lokalnych mocków odczytu.

## Korekty wobec instrukcji

1. Mianownik rodziny wyniósł `112`, nie około `124`; po usunięciu trzech
   literalnych trafień `109`. Liczba jest wynikiem własnej komendy.
2. Czytelników `isArtifactRightRailEnabled` jest `12`, nie `11`.
3. R6 odsyła do „struktury `§R.2`”, ale wydana instrukcja ma 1084 linie i nie
   zawiera sekcji definiującej tę strukturę. Zastosowano bezpieczny format:
   start, R1–R6, mutacje, testy, korekty, granice i twierdzenia niezweryfikowane.
4. W `§0.1` wymagany pusty `git diff` po cofnięciu mutacji jest niejednoznaczny:
   diff do HEAD zawiera naprawę. Użyto `cmp` wobec kopii zielonej (`exit 0`).
5. `--wynik-selektor` kanonicznego skryptu dodał do tablicy `pary` zarówno
   wynik kształtu, jak i wpis porównania pikseli; podsumowanie policzyło `1/2`
   mimo `ok:true`, obu markerów obecnych i `powod:null`. Finalny przebieg nie
   używał tego wadliwego licznika; obecność centrum potwierdzono `--zlicz` i
   oględzinami obu PNG.

## TWIERDZENIA NIEZWERYFIKOWANE

- Akceptacja właściciela dla obu par zrzutów — **NIEZWERYFIKOWANA**.
- Zachowanie na tablecie, urządzeniu fizycznym i z czytnikiem ekranu —
  **NIEZWERYFIKOWANE**; axe/desktop DOM nie zastępują tych prób.
- Produkcyjny build, deploy, Railway, realne API i produkcyjna baza —
  **NIEZWERYFIKOWANE / poza zakresem**.
- Pełna semantyczna klasyfikacja 109 pozostałych trafień env — **NIEZROBIONA**;
  dostarczono inwentarz tekstowy i rekomendację kolejności.
- Gotowość do zmiany defaultu flagi prototypu — **NIEUDOWODNIONA**; default
  pozostaje OFF.

## Commity

- `3765ec8680` — R1
- `4fc8012953` — R2
- `ee71a055ff` — R3
- `798a6b1155` — R4
- `eb59a054bd` — R5 (pusty commit werdyktowy; brak zmiany kodu)
- R6 — ten commit: raport i wąskie sprostowanie `MYW-NBK-CORE-001`
