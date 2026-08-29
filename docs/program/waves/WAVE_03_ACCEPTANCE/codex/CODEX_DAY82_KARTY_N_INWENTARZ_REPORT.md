# CODEX DAY 82 — inwentarz kart N

Data pomiaru: 2026-08-29  
Baza: `1e44994196505e0680ce2b1e24468c2300eba75c`  
Gałąź: `codex/day82-karty-n-20260829`  
Zakres zmian: wyłącznie ten raport; zero zmian w kodzie.

## Werdykt

**Mianownik nazw plików:** `97` plików `src/components/**/*Card*.tsx`.  
**Mianownik produktowy:** `7` kart N: Tool, Notification, Interview Session, Decision, Insight, Task i Initiative.

To nie są zbiory „97, z których wybrano 7”. Ich przecięcie wynosi **0**: żaden z siedmiu kanonicznych plików nie ma `Card` w nazwie. `97` mierzy konwencję nazewniczą (w tym testy, modale, prymitywy UI, scorecards i małe karty w hubach); `7` mierzy pełne obiekty pracy z zamkniętej listy SPEC-N §0A, hooka i `REJESTR_KART_N`. Szacunek właściciela `30–40` nie opisuje mianownika kart N w obecnym kanonie; potwierdzona liczba to **7**.

## §0.1 — baza i sanity (wynik dosłowny)

`df -h /`:

```text
Filesystem        Size    Used   Avail Capacity iused ifree %iused  Mounted on
/dev/disk3s1s1   1.8Ti    12Gi    76Gi    14%    459k  797M    0%   /
```

Marker:

```text
MARKER OK
```

Sanity §0.1(7):

```text
1e44994196505e0680ce2b1e24468c2300eba75c
```

`git status --short | head -3` nie wypisał żadnej linii. Krok (4) wykonany; plik worktree zawierał dosłownie:

```text
[core]
	bare = false
```

Tip gałęzi bazowej uciekł o jeden commit, co zgodnie z DEC-2026-08-26-95 nie jest STOP-em:

```text
65d0f265f7 docs(instrukcje): dyzur 82 (inwentarz kart N) i 83 (eksport PPTX 422)
```

Różniące pliki: wyłącznie dwie instrukcje dyżurów 82 i 83. Praca pozostała dokładnie na markerze.

## Weryfikacja wejścia W1–W4

```text
W1: 521 Harvard/wdrozenie-100/_SPEC_N_KARTY_2026-07-21.md
W3: 97
W4: R1 (ostrzeżeń) 1 · R2+R3 aktualnie 0 / baseline 0
```

W2 wykazało w hooku: zamkniętą listę „7 pełnych kart” (`scripts/check-artefakt.sh:180-191`), wykluczenie paneli bocznych i Tool Document (`:181`) oraz trzy reguły R1–R3 (`:203-267`). Stan wejściowy autora dla 97 plików i wyniku hooka został potwierdzony. Korekta: teza „14 obszarów” grupuje tylko obszary z co najmniej 2 plikami; pełne grupowanie po pierwszym segmencie ścieżki daje 31 grup, z czego 17 ma po jednym pliku.

## K1 — definicja operacyjna

Plik jest kartą N wtedy i tylko wtedy, gdy spełnia łącznie:

1. Jest pełnym widokiem obiektu pracy wzorca N, a nie małą kartą w hubie, panelem bocznym, modalem, prymitywem UI, testem ani wynikiem eksportowym (`SPEC-N:79-90`; hook `:180-181`).
2. Typ obiektu należy do zamkniętego zbioru: Tool, Initiative, Insight, Interview Session, Decision, Notification, Task (`SPEC-N:89-90`).
3. Ścieżka komponentu jest jedną z siedmiu ścieżek zapisanych w `karty_n_files()` (`check-artefakt.sh:182-191`) i odpowiada wpisowi w `REJESTR_KART_N` (`registry.ts:84-152`).

Warunek 3 jest maszynowym rozstrzygnięciem dzisiejszego zakresu. Samo wystąpienie słowa `Card`, użycie `NModeShell` albo podobieństwo wizualne nie kwalifikuje pliku. `Tool Document` jest wynikiem PPT/Word/Excel, nie kartą N (`SPEC-N:81-87`).

## K2–K3 — pełny inwentarz kart N

Wszystkie `7/7` pozycji z hooka i kanonu sklasyfikowano. „Zamontowana” oznacza statyczny, nie-testowy konsument widoku w realnym hubie; nie jest to twierdzenie o działaniu runtime ani wdrożeniu.

| Karta | Narzędzie / moduł | Plik | N wg kanonu | Archetyp / klasa | Zamontowana | Flaga kontraktu |
|---|---|---|---|---|---|---|
| Tool | Discovery Tools | `src/components/DiscoveryTools/KnownToolDetailView.tsx:142` | TAK — SPEC-N §0A i hook | A Canvas / S | TAK — `Discovery/DiscoveryToolsHub.tsx:92,3724` | `VITE_VF1_TOOL_CARD_CONTRACT`, default OFF (`:109-110`); widok istnieje także przy OFF |
| Notification | My Work | `src/components/MyWork/NotificationDetailView.tsx:293` | TAK | C Rekord / S | TAK — `MyWork/MyWorkHub.tsx:175-176,3901` | `VITE_VF1_NOTIFICATION_CARD_CONTRACT`, default OFF (`:281-282`) |
| Interview Session | Interview | `src/components/Interview/InterviewWorkspace.tsx:235` | TAK | C Rekord-konwersacja / L | TAK — `Interview/InterviewHub.tsx:162,5971` | `VITE_VF1_INTERVIEW_CARD_CONTRACT`, default OFF (`:226-227`) |
| Decision | My Work | `src/components/MyWork/DecisionDetailView.tsx:849` | TAK | C Rekord / L | TAK — `MyWork/MyWorkHub.tsx:172-173,3891` | `VITE_VF1_DECISION_CARD_CONTRACT`, default OFF (`:225-235`) |
| Insight | Interview | `src/components/Interview/InsightViewer.tsx:1213` | TAK | C Rekord / L | TAK — `Interview/InterviewHub.tsx:138,5983` | `VITE_VF1_INSIGHT_CARD_CONTRACT`, default OFF (`:170-178,216-221`) |
| Task | My Work | `src/components/MyWork/TaskDetailView.tsx:365` | TAK | C Rekord / L | TAK — `MyWork/MyWorkHub.tsx:166-167,3857` | `VITE_VF1_TASK_CARD_CONTRACT`, default OFF (`:217-218`) |
| Initiative | Initiatives | `src/components/Initiatives/InitiativeDocumentView.tsx:456` | TAK | C Rekord / L | TAK — `Initiatives/InitiativesHub.tsx:119,1663` (także inne huby) | `VITE_VF1_INITIATIVE_CARD_CONTRACT`, default OFF (`initiativeCardContract.ts:821-878`) |

Klasy S/L pochodzą z aktualnego rejestru (`registry.ts:84-152`), który koryguje historyczne S→L dla Decision i Task. Archetypy pochodzą z mapy kanonu (`ARTIFACT_ANATOMY_STANDARD.md:145-155,182-202`); Tool jest A, pozostałe C.

Pełna lista 97 kandydatów nazewniczych z `plik:linia` leży poza repo w `/private/tmp/cx-day82-karty-n-artefakty/card-filename-candidates.txt` (SHA-256 `67af75cf8016f8f3884d0a36c5268ec505c8ee42e9040f4188cce734a5a6408f`). Wszystkie 97 mają werdykt **NIE**: nie występują w zamkniętej liście hooka/rejestru. Nie nadawano im sztucznie statusu montażu karty N ani flagi karty N.

## K4–K5 — zgodność z SPEC-N

### Wynik strażnika

| Reguła | Znaczenie | Wynik |
|---|---|---|
| R1 | heurystyczne ostrzeżenie: solid/filled CTA poza jedynym slotem primary; nie blokuje, bo regex nie rozpoznaje sankcjonowanego primary | 1: Task `TaskDetailView.tsx:7405` |
| R2 | blokada `createPortal` wynoszącego chrome poza powłokę | 0 |
| R3 | blokada `comments` / `history` / `activity-log` w lewej nawigacji zamiast prawego panelu | 0 |

`baseline 0` oznacza **brak zamrożonego długu R2+R3**, nie „pełną zgodność SPEC-N”. Baseline celowo nie obejmuje R1 (`check-artefakt.sh:269-283`) ani pozostałych wymogów §5B: obowiązkowego panelu, kontraktu AI, limitu klasy S i pełnej bramki runtime.

### Stan per karta

| Karta | Menu 1 | R1 | R2+R3 | Pełna zgodność SPEC-N |
|---|---:|---:|---:|---|
| Tool | PASS wg warstwy aktualnej SPEC-N | 0 | 0 | **NIEUDOWODNIONA** |
| Notification | PASS | 0 | 0 | **NIEUDOWODNIONA** |
| Interview Session | PASS | 0 | 0 | **NIEUDOWODNIONA** |
| Decision | PASS | 0 | 0 | **NIEUDOWODNIONA** |
| Insight | PASS | 0 | 0 | **NIEUDOWODNIONA** |
| Task | PASS | 1 (`:7405`) | 0 | **NIEUDOWODNIONA** |
| Initiative | PASS | 0 | 0 | **NIEUDOWODNIONA** |

Powody wspólne, zgrupowane jako porcje pracy:

1. **Jedna robota rejestrowo-migracyjna dla 7 kart:** `statusMigracji: 'przed'` dla 7/7 (`registry.ts:84-152`), czyli według definicji rejestru karty nadal działają na surowej powłoce i nie podlegają kompletowi bramek §5.1–5.3 (`registry.ts:48-53`). Żadna z siedmiu nie renderuje `StandardArtifactShell`; dwa trafienia tekstowe są tylko komentarzami.
2. **Jedna robota harness/runtime dla 7 kart:** `node scripts/karty-n-smoke.mjs` wykazał brak ekranów harnessu `7/7`; nie da się wykonać wymaganej parametryzowanej bramki runtime ani uczciwego odbioru zrzutów. To brak wspólnej infrastruktury dowodowej, nie siedem dowodów zgodności.
3. **Jedna ocena wizualna Task:** R1 na `TaskDetailView.tsx:7405`; ostrzeżenie wymaga oceny okiem, nie automatycznej naprawy.
4. **Wymogi niewłączone do obecnego hooka:** hook implementuje tylko R1–R3, choć SPEC-N §5B wymienia 7 kontroli (`SPEC-N:396-406`). Zatem pozytywny hook nie dowodzi panelu, kompletności `aiContract`, limitu S, antyduplikacji ani zachowania runtime.

Stan uczciwy: **Menu 1 ma historyczne 7/7 PASS (`SPEC-N:25-52`), R2/R3 są 0/0, ale 0/7 kart ma dowód pełnej zgodności z całym SPEC-N na tym markerze.** Nie uruchamiano przeglądarki ani nie tworzono nowych zrzutów, ponieważ smoke najpierw wykazał brak wszystkich wymaganych ekranów harnessu.

## K6 — rekomendacja porcji odbiorowych

Rekomenduję **4 porcje graficzne** i osobną, równoległą ścieżkę merytoryczną:

| Porcja graficzna | Karty | Liczba | Dlaczego razem |
|---|---|---:|---|
| G1 — lekkie / S | Tool, Notification | 2 | krótkie powierzchnie; szybkie porównanie hierarchii, primary i panelu |
| G2 — My Work / L | Decision, Task | 2 | wspólny hub, podobna anatomia; zawiera jedyny R1 do obejrzenia |
| G3 — Interview | Interview Session, Insight | 2 | wspólny hub, ale dwa centra: konwersacja i rekord |
| G4 — ciężka Initiative | Initiative | 1 | 26 sekcji i największy promień wizualny; nie mieszać z szybką porcją |

Łącznie: **4 porcje / 7 kart (2+2+2+1)**. Warunek wejścia do G1–G4: najpierw jedna porcja techniczna T0 dla wszystkich 7 — ekrany harnessu, zrzuty light/dark przy wspólnych viewportach i pełna bramka runtime. Bez T0 właściciel byłby pierwszym testerem wizualnym.

Ścieżkę merytoryczną rozdzielić od grafiki:

- M1 pełny kontrakt treści: Insight + Initiative — 2 karty (długa treść AI, dowody i progi).
- M2 lekki kontrakt treści: Decision + Task + Notification + Interview Session — 4 karty (pola obowiązkowe i antywzorce, bez sztucznych progów słownych).
- M3 Tool — 1 karta: read-only treść metody; walidacja poprawności katalogu/założeń, nie generowanej prozy.

Akceptacja graficzna nie zamyka M1–M3; akceptacja treści nie zatwierdza layoutu. Każda ścieżka ma własny werdykt właściciela.

## Brak bramek odbioru

Pomiar 16 plików `MODULE_ACCEPTANCE.md` dał `BRAK TRAFIEN` dla `karta N|karty N|SPEC-N`. Teza instrukcji została potwierdzona: istnieje kanon i hook, ale nie istnieje modułowa bramka odbioru kart N.

## BLOK 0 i Z30

Porty `5954` i `4760` były wolne. Lokalny `pgvector/pgvector:pg16` uruchomiono jako `cx-day82-pg`. Pierwszy przebieg zastosował 863 migracje i zakończył się `Postgres migrations complete`; drugi: `Applying migrations: 0`, również zakończony poprawnie.

Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Baza tego dyżuru nie zawiera wierszy konfiguracji SMTP. Nie uruchomiłem `server/src/index.ts` ani żadnego drenażu outboxu. Żaden e-mail ani zaproszenie kalendarzowe nie zostało wysłane.

Dowody: środowisko `BRAK ZMIENNYCH POCZTY`; zapytanie `settings WHERE key LIKE 'smtp%'` zwróciło `(0 rows)`; grep drenaży w `server/src/Gateway.ts` zwrócił 0 trafień.

## Korekty wobec instrukcji

1. „97 plików w 14 obszarach” jest skrótem grupowania, nie pełnym rozkładem pierwszego segmentu ścieżki: pomiar daje 31 grup; suma nadal wynosi 97.
2. Sformułowanie B.2 „ile z nich jest kartami N” sugeruje podzbiór 97. Faktycznie przecięcie wynosi 0, a kanoniczne 7 leży poza zbiorem nazw `*Card*.tsx`. Bezpieczna interpretacja: raport podaje oba niezależne mianowniki i przecięcie.
3. Z30 każe wykonać zapytanie do `settings` „po migracjach”, a zarazem wkleić trzy dowody „zanim uruchomisz cokolwiek zapisującego”. Migracje same zapisują. Zastosowano interpretację wykonalną i bezpieczną: wyłącznie lokalne migracje obowiązkowe z §0.2c, potem natychmiast trzy dowody Z30, przed jakimkolwiek innym przebiegiem zapisującym. Nie było wysyłki ani procesu drenażu.

## Artefakty poza repo

| Plik | SHA-256 |
|---|---|
| `/private/tmp/cx-day82-karty-n-artefakty/migrate-first.log` | `c8814857ba94e1767698b3694a2737e428cbaa0424111ed1fc737177db2cd871` |
| `/private/tmp/cx-day82-karty-n-artefakty/migrate-second.log` | `9b45b8f3697ce5983ece0a51d6d5bb50cab310b454f2ec440da391645f2b1942` |
| `/private/tmp/cx-day82-karty-n-artefakty/hook-report.log` | `0b07a43497602aae122125e3c6ab21dd2d701beeb405afd92bbd504438634ba4` |
| `/private/tmp/cx-day82-karty-n-artefakty/karty-n-smoke.log` | `834ea8a652bea76e00ecfc804ef206acffa46b1b3bb7eb32fe5ea62c350d3178` |
| `/private/tmp/cx-day82-karty-n-artefakty/card-filename-candidates.txt` | `67af75cf8016f8f3884d0a36c5268ec505c8ee42e9040f4188cce734a5a6408f` |

## K7 — zakres diffu

Oczekiwany i wymagany wynik: wyłącznie `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY82_KARTY_N_INWENTARZ_REPORT.md`. Zero zmian `src/`, `server/src/`, testów, kanonu i `MODULE_ACCEPTANCE.md`.
