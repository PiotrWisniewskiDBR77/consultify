# CODEX DAY 337 — Idee: enumeracja kontrolek

Data: 2026-09-04  
Baza: `1c4b5a5635bafd38ef375227824ada9b62be186e`  
Gałąź: `codex/day337-idee-enumeracja-20260904`

## Stan wejściowy

Instrukcja z vaulta została odczytana do EOF (1044 linie). Stan dokumentu: `WYDANY`.

Dosłowny wynik kontroli markera:

```text
MARKER OK
```

Dosłowny wynik sanity worktree:

```text
1c4b5a5635bafd38ef375227824ada9b62be186e
```

Tip `github-backup/grafika/m03-20260902` wyprzedza marker. Zgodnie z DEC-2026-08-26-95 praca zaczęła się dokładnie z markera; scalenie z tipem pozostaje zadaniem nadzorcy.

Zasoby: 50 GiB wolnego po materializacji worktree; porty 6373 i 5513 wolne; zero kontenerów `cx-day337`. Wariant C: baza nie była potrzebna i kontener `cx-day337-pg` nie został uruchomiony.

Pomiar wspólny przed pierwszym commitem: liście słowników `pl 35198`, `en 33065`; `focus-canon=0`, `list-canon=0`, `artefakt=0`.

## R0 — czystość linii

1. Kontrakt na `HEAD` jest nieskażony: ma cztery wpisy (`whiteboard-canvas`, `mindmap-canvas`, `processflow-canvas`, `idea-table`) i sumę `unique = 226`.
2. `2ac619e988` nie jest przodkiem `HEAD`: `CZYSTO: 2ac619e988 NIE jest na HEAD`.
3. Fałszywego dopisku nie ma w raporcie 295: grep bez trafień, `kod grepa=1`; historia pliku kończy się na `1dc4b60f54`.
4. Oba uratowane commity są przodkami `HEAD`: `85ca28cb28 PRZODEK` oraz `f3b8f89941 PRZODEK`; plik `day331.notebookConflict.gateway.pg.test.ts` istnieje. Dowodów serwerowych nie powtarzam.

Komendy dowodowe: obowiązkowe komendy (1), (2), (3) i (6) z §0.3 instrukcji, wykonane w `/private/tmp/cx-day337-idee-enumeracja`.

## Korekty wobec instrukcji

Na R0: brak rozbieżności pomiarowych. Tip linii integracyjnej wyprzedza marker o commity instrukcyjne; zgodnie z instrukcją nie jest to STOP.

## R1 — stabilizacja sondy

Krzywa własna: `200 ms → 1`, `400 ms → 1`, `800 ms → 86`, następnie 86 do 20 s. Szczegóły: `evidence/day337/sonda-krzywa.md`.

Sonda czeka na pięć identycznych próbek co 200 ms, wymaga jednocześnie progu kontraktu i odrzuca znaną jednokontrolkową powłokę startową. Sam pierwszy wariant okna 5 × 200 ms został sfalsyfikowany trzema wynikami `1`; został poprawiony przed commitem.

Dowód mutacyjny na pełnej nazwie `Idea tools — complete DOM control inventory idea-table-timeline-stuck: waits for a stable terminal control inventory`: stara sonda przeszła z `DAY337_STABLE_PROBE 1`; nowa na tym samym opóźnieniu poczekała i zwróciła `DAY337_STABLE_PROBE 86`. Po przywróceniu ekranu trzy przebiegi końcowe: `86 / 86 / 86`. Diff ekranu po przywróceniu pusty.

Bazowy skład przed zmianami: `numTotalTests=5`, 4 wykonane PASS, 0 FAIL, 1 pending; pełne nazwy w `/private/tmp/cx-day337-idee-enumeracja-artefakty/przed-nazwy.txt`.

## TWIERDZENIA NIEZWERYFIKOWANE

- Pełne pokrycie efektu pozostaje niezweryfikowane: 295 z 308 sygnatur nie ma dowodu skutku w tym przyrządzie.
- Nie wykonano dowodu bazodanowego, ponieważ wiążący wariant C zabrania stawiania kontenera i dyżur nie dotyka bazy.

## §0.2e — pakiety uruchomione dotychczas

Pakiet enumeracji uruchamiano z `RUN_DB_TESTS=0 MOCK_DB=true`, jawnym `DAY295_IDEA_HARNESS_URL=http://127.0.0.1:5513` i `--retry=0`. JSON bazowy wykazał `numTotalTests=5`, 4 wykonane i 1 pending; po dodaniu przypadku sondy pełne przebiegi wykazały 5 wykonanych i 1 pending. Tym samym `describe.runIf` nie wyłączył pakietu. Test jest czysto przeglądarkowy i nie dowodzi bazy, uwierzytelnienia ani ścieżki ApiGateway.

## R2 — kontrakt właściwego ekranu

Trzy własne stabilne pomiary dały identycznie: `base 86`, `unique 82`, `menus 3`, bez nazwy `0`, SHA-256 `2ccdd150921460e4c625d469f7cc73bf1604a6b45f52bb62947b92a627f78db1`. Trzy JSON-y kontraktu: każdy `numTotalTests=7`, 6 wykonanych PASS, 0 FAIL, 1 pending.

Zachowano wpis `idea-table` dla listy i dodano piąty wpis `idea-table-timeline-stuck` dla narzędzia. Nowy mianownik `unique` wynosi `308`.

Mutacja a11y: pełny przypadek `Idea tools — complete DOM control inventory idea-table-timeline-stuck: accounts for the base and opened-menu passes` był RED dokładnie na `expect(base.every(({ name }) => name.length > 0)).toBe(true)` po dodaniu bezimiennego przycisku, a po cofnięciu GREEN z właściwym hashem. Diff produktu po przywróceniu pusty. Szczegóły: `evidence/day337/r2-pomiar-i-a11y.md`.

Pierwsze trzy próby polecenia pomiarowego były nieważne: `ReferenceError: sel is not defined`, a brak `pipefail` został zamaskowany przez `tee`. Nie są liczone jako pomiar. Poprawne przebiegi miały literał selektora i `set -o pipefail`.

## R3 — ślad po fałszywym twierdzeniu

Pozycja sprostowania jest bezprzedmiotowa. Specyficzny grep raportu 295 nie znalazł trafień (`kod grepa=1`), a historia pliku kończy się na `1dc4b60f54`. Fałszywe twierdzenie nigdy nie dotarło na mierzoną linię integracyjną, dlatego raportu 295 nie zmieniono.

Rodzinny `rg` w `docs/` i `evidence/` również zwrócił pustą listę (`kod rodziny=1`). Szczegóły komend: `evidence/day337/r3-rodzina-falszywego-twierdzenia.md`.

Do istniejącego rejestru znalezisk dopisano jeden wiersz N1: próg minimalny może zwolnić sondę w połowie renderu, a sama stabilność wymaga odrzucenia stabilnej powłoki startowej.

## R4 — dowód efektu

Przed dobudową bezpiecznika MUTACJA B (`setShowConnectorWizard(true)` → pusty handler) pozostawiała test enumeracji GREEN oraz niezmienione inventory 82 i hash `2ccdd150921460e4c625d469f7cc73bf1604a6b45f52bb62947b92a627f78db1`.

Dodano kontrakt efektu o pełnej nazwie `Idea tools — complete DOM control inventory idea-table-timeline-stuck: Importuj dane opens the connector wizard`. Sprawdza on realny skutek: po kliknięciu `Importuj dane` widoczny jest dialog `Nowy konektor danych`. Ta sama MUTACJA B po zmianie daje RED na `expect(await dialog.isVisible()).toBe(true)`; po przywróceniu przez `cp` pełny pakiet jest GREEN (7 wykonanych, 0 FAIL, 1 pending). Diff produktu po cofnięciu pusty.

Nowe uczciwe pokrycie efektu: **13/308 = 4,2%**. Pozostałych 295 sygnatur nadal nie ma dowodu efektu. Szczegóły: `evidence/day337/r4-dowod-efektu.md`.

Porównanie nazw PRZED/PO: dodano trzy pełne przypadki (sonda stabilności, kontrakt efektu Importuj dane, kontrakt enumeracji właściwego ekranu); nie zniknął żaden przypadek. Pliki: `/private/tmp/cx-day337-idee-enumeracja-artefakty/przed-nazwy.txt` i `po-nazwy.txt`.

## Z30

Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Dyżur nie ma bazy, zgodnie z wariantem C. Nie uruchomiłem `server/src/index.ts` ani żadnego drenażu outboxu. Żaden e-mail ani zaproszenie kalendarzowe nie zostało wysłane.

## R5 — wynik końcowy

Pomiar wspólny PO zmianach: liście słowników `pl 35198`, `en 33065` — bez spadku; `focus-canon=0`, `list-canon=0`, `artefakt=0`.

Pełny pakiet końcowy: `numTotalTests=8`, 7 wykonanych PASS, 0 FAIL, 1 pending. Pending to jawny przypadek ochronny uruchamiany wyłącznie bez `DAY295_IDEA_HARNESS_URL`; w każdym dowodowym przebiegu URL był ustawiony na `http://127.0.0.1:5513`.

Diff pełnych nazw PRZED/PO dodał dokładnie:

```text
Idea tools — complete DOM control inventory idea-table-timeline-stuck: waits for a stable terminal control inventory
Idea tools — complete DOM control inventory idea-table-timeline-stuck: Importuj dane opens the connector wizard
Idea tools — complete DOM control inventory idea-table-timeline-stuck: accounts for the base and opened-menu passes
```

Nie zniknął żaden przypadek.

Wybrane hashe artefaktów poza repo:

- trzy poprawne pomiary R2 mają identyczny SHA-256 pliku: `5d7d3a5da98bc2104c798efce10d471b320cf851cd36a841c9b1a79d25b7d8c9`;
- RED a11y: `49a74e923aedb848d356d04a39243b2c38a1a174a4b972134ca58c8c34ae2e00`;
- GREEN a11y: `98b51b26a8cefdf98c4b27f71102907e8fc34707d071e5749e4ade75531d0645`;
- RED mutacji efektu: `44cf0fbaa5582c981338d15a3791d3fd139f923f3e96e8ac9bb62c1a2b5d543a`;
- końcowy JSON GREEN: `6b277be970ba44e61b5792d22963d5bfce88452355a7137167870727052547fb`.

Dowód należy do bramki **G15 — Integrator self-QA and impacted regression** modułu `07_MY_WORK_AGENT`; przed wpisaniem go do macierzy brakuje niezależnego sceptycznego odtworzenia na kandydacie integracyjnym oraz domknięcia dowodu efektu dla pozostałych 295/308 sygnatur. Wiersza macierzy nie zmieniono.

## Korekty i błędy przyrządu wykryte podczas wykonania

- Zimny pomiar od `waitUntil: commit` dał spóźnione próbki po kompilacji Vite — odrzucony.
- Sama stabilność 5 × 200 ms bez readiness floor trzykrotnie zaakceptowała `1` — sfalsyfikowana i poprawiona przed commitem.
- Pierwsze trzy polecenia R2 miały `ReferenceError: sel is not defined`, a `tee` zamaskował kod bez `pipefail` — oznaczone INVALID i niepoliczone.
- Pierwszy kontrakt efektu użył nieobsługiwanego matchera Locator `toBeVisible()` — to RED przyrządu, nie produktu; zastąpiono go `await dialog.isVisible()`.

Te rozbieżności są wynikami procesu pomiarowego; żadnej nie ukryto ani nie zaliczono jako dowodu produktu.
