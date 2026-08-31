# CODEX DAY 84 — KARTY N — RAPORT ODBIORU GRAFICZNEGO

Data pomiaru: 2026-08-29  
Gałąź: `codex/day84-karty-n-zrzuty-20260829`  
Baza: `062a26fe4a0380de7e87d691df8d4dbf05012a46`  
Werdykt: **PARTIAL / EVIDENCE_MISSING — mianownik ustalony, zrzuty zablokowane sprzecznością bezpieczeństwa instrukcji**

## 1. Tożsamość wejścia i reguła rozejścia

Wynik §0.1(2), dosłownie:

```text
MARKER OK
```

Wynik §0.1(7), dosłownie:

```text
062a26fe4a0380de7e87d691df8d4dbf05012a46
```

`git status --short | head -3` nie wypisał żadnej linii. Na `/` było `89Gi`
wolnego. Tip `github-backup/codex/m03-admin-20260824` był 10 commitów przed
markerem; zgodnie z `DEC-2026-08-26-95` rozpocząłem dokładnie z markera i nie
scalałem nowszego tipa.

## 2. Weryfikacja W1–W3

W1:

```text
src/components/DiscoveryTools/toolCards.contract.ts                         221
src/components/MyWork/notificationCardContract.ts                           281
src/components/Interview/interviewCardContract.ts                           346
src/components/MyWork/decisionCardContract.ts                               299
src/components/Intelligence/InsightDetectionCard.tsx                        121
src/components/TaskCard.tsx                                                 135
src/components/InitiativeCard.tsx                                           524
```

W2: `R1=1`, `R2+R3=0 / baseline 0`. Ostrzeżenie R1 nie dotyczy
`src/components/TaskCard.tsx`, tylko solid/filled CTA poza slotem primary w
`src/components/MyWork/TaskDetailView.tsx:7405`. Bez zrzutu nie twierdzę, czy
jest widoczne dla użytkownika.

W3 znalazło renderowanie m.in. w `TaskInbox`, `TaskDetailView`, `FocusBoard`,
`FocusCockpit`, `ExecutiveDashboard`, `InsightDetectionCard`,
`SmartBlockRenderer` i `InitiativeCards`. Ten grep dowodzi wyłącznie istnienia
łańcucha, nie działania (§Z34).

## 3. §B.0 — prawdziwy mianownik

### 3.1. Pozycje katalogowe na artefakt

Pomiar wykonałem przez import siedmiu `ArtifactCardSpec` na tym samym SHA i
odczyt `spec.catalog.length`.

| Artefakt | Pozycji katalogowych | Źródło |
| --- | ---: | --- |
| insight | 18 | `src/components/shared/NModeLayout/cardSets.ts:88-191` |
| initiative | 25 | `src/components/shared/NModeLayout/cardSets.ts:245-360` |
| decision | 8 | `src/components/shared/NModeLayout/cardSets.ts:433-485` |
| task | 10 | `src/components/shared/NModeLayout/cardSets.ts:511-570` |
| notification | 3 | `src/components/MyWork/notificationCardContract.ts:245-275` |
| tool | 4 | `src/components/DiscoveryTools/toolCards.contract.ts:187-215` |
| interview | 8 | `src/components/Interview/interviewCardContract.ts:313-340` |
| **RAZEM — użycia katalogowe** | **76** | pomiar wykonawcy |

**Korekta tezy instrukcji:** `61` jest prawidłową liczbą wpisów katalogowych
tylko w `cardSets.ts`, czyli dla czterech artefaktów. Nie jest mianownikiem
siedmiu artefaktów wymaganych w §B.0. Trzy osobne kontrakty dodają 15 pozycji.

### 3.2. Dziesięć `id:` bez `group`

W `cardSets.ts` jest 73, a nie 71, tekstowych wystąpień `id:`: 61 wpisów
katalogowych, 10 identyfikatorów zestawów w tablicach `sets` oraz 2 pola typu
`id` w interfejsach (`CardCatalogEntry` i `CardSet`, linie 51-75). Te 10 pozycji
to zestawy `default` / `full` / `minimal`, nie karty. Dowód semantyczny:
`ArtifactCardSpec` rozdziela `catalog` i `sets` w liniach 77-83, a komentarz
modułu wyjaśnia oba zbiory w liniach 2-18.

### 3.3. Unikalność i powtórzenia

Po deduplikacji po samym `id` jest **67 identyfikatorów**. Powtórzenia:

- `comments`: insight, initiative, decision, task;
- `activity-log`: insight, decision, task;
- `overview`: initiative, interview;
- `stakeholders`: initiative, interview;
- `dependencies`: initiative, task;
- `evidence`: task, interview.

Nie wolno jednak uznać wszystkich wspólnych `id` za tę samą kartę graficzną.
`overview` ma inne etykiety, ikonę i grupę; `evidence` także ma inne etykiety,
ikonę i grupę. `activity-log` różni polską etykietę. Dlatego:

- mianownik użyć do odbioru w siedmiu artefaktach: **76**;
- mianownik identyfikatorów technicznych: **67**;
- mianownik udowodnionych, graficznie identycznych kart: **NIEZWERYFIKOWANY**
  bez realnego renderu. Sam wspólny identyfikator nie jest dowodem identycznego
  komponentu ani wyglądu.

### 3.4. Osiągalność

Statyczne spięcie katalogu z ekranem istnieje dla siedmiu rodzin:

- Decision: `DecisionDetailView.tsx:1409-1414`;
- Task: `TaskDetailView.tsx:4595-4600`;
- Notification: `NotificationDetailView.tsx:2479-2494`;
- Tool: `KnownToolDetailView.tsx:1893-1921`;
- Interview: `InterviewWorkspace.tsx:1962-1965,3218-3225`;
- Insight: `InsightViewer.tsx:1441-1446,8077-8083`;
- Initiative: `InitiativeDocumentView.tsx:5234-5506,8975-8983`.

To daje **7 z 7 rodzin ze statycznym konsumentem**, ale **0 z 76 pozycji z
udowodnioną osiągalnością przez realne logowanie i runtime**. Flagi kontraktu
są domyślnie OFF (m.in. Decision `:226-232`, Task `:178-217`, Notification
`:242-281`, Tool `:70-109`, Interview `:187-226`, Insight `:172-216`). Nie
zmieniłem ich wartości domyślnej (§Z10/§Z11).

## 4. Lokalna baza i zakaz wysyłki

Porty `5956` i `4780` były wolne. Uruchomiłem wyłącznie kontener
`cx-day84-pg` (`pgvector/pgvector:pg16`) na `127.0.0.1:5956`. Pierwszy pełny
przebieg migracji zakończył się `✅ Postgres migrations complete`; drugi podał
`Applying migrations: 0` i zakończył się tym samym komunikatem.

Dowody §0.2b:

```text
BRAK ZMIENNYCH POCZTY

 key | left
-----+------
(0 rows)
```

Grep trzech drenów w `server/src/Gateway.ts` nie zwrócił trafień.

**Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Baza tego dyżuru nie
zawiera wierszy konfiguracji SMTP. Nie uruchomiłem `server/src/index.ts` ani
żadnego drenażu outboxu. Żaden e-mail ani zaproszenie kalendarzowe nie zostało
wysłane.**

## 5. Korekty wobec instrukcji i blokada zrzutów

### Konflikt 1 — mianownik

- §A / poprawka wydania: „W katalogu jest `61` kart”.
- §B.0: policzyć osobno siedem artefaktów, w tym notification, tool i interview.

Dowód: `cardSets.ts:599-604` rejestruje wyłącznie insight, initiative, decision
i task; osobne trzy kontrakty eksportują dalsze specy. Bezpieczna interpretacja
„mierz zamiast zgadywać” daje 76 użyć / 67 identyfikatorów.

### Konflikt 2 — wymagany runtime kontra bezwzględny Z30

- §B.2: „Runtime: `scripts/dev/start-wave3-owner-runtime.mjs`”.
- §0.2b(1): „nie uruchomić serwera pełnym `server/src/index.ts` — tam startują
  drenaże outboxów”.
- Narzucony runtime uruchamia dokładnie `server/src/index.ts` w
  `scripts/dev/start-wave3-owner-runtime.mjs:681-686`.

Wybrałem interpretację bezpieczniejszą zgodnie z końcową procedurą: niczego nie
wysłać na zewnątrz. Nie uruchomiłem skryptu i nie zbudowałem obejścia (§Z40).

### STOP — §B.2 zrzuty

Rodzaj: MERYTORYCZNY  
Powód: jedyny narzucony runtime uruchamia proces wprost zakazany przez §0.2b.  
Licencja, którą sprawdziłem: §D zezwala wyłącznie na raport; kod i harness są
tylko do odczytu, a §Z40 zakazuje budowania harnessu na siłę.  
Dowód: `scripts/dev/start-wave3-owner-runtime.mjs:681-686`.  
Co dostarczyłem ZAMIAST zmiany: prawdziwy mianownik, statyczna macierz spięcia,
lokalna baza po migracjach oraz brief konfliktu.  
Co zrobiłbym, gdyby zapadła decyzja X: po wydaniu bezpiecznego runtime, który nie
uruchamia `server/src/index.ts`, wykonałbym pierwszą porcję 6-8 kart w czterech
stanach każda i zapisał SHA-256 poza repo.  
Rekomendacja dla nadzorcy: wydać poprawkę wskazującą istniejący, zatwierdzony
runtime bez drenów albo jawnie rozstrzygnąć konflikt Z30/B.2.  
Stan: raport zacommitowany; zero zmian w kodzie.  
Czy kontynuowałem pozostałe pozycje: TAK — domknąłem mianownik i statyczną
osiągalność; B.3/B.4 pozostają nieweryfikowalne bez zrzutów.

## 6. Zrzuty, ocena graficzna i SPEC-N

- Porcja 1: **0 z planowanych 24-32 zrzutów**.
- SHA-256 zrzutów: brak plików, brak skrótów.
- Ocena graficzna §B.3: **0 z 6-8 kart**; nie relabelowano żadnego stanu.
- Zgodność SPEC-N porcji 1: **0 z 6-8, NIEZWERYFIKOWANE**.
- R1: źródłowo ustalone jako CTA `TaskDetailView.tsx:7405`, widoczność dla
  użytkownika **NIEZWERYFIKOWANA**.

## 7. Kryteria K1–K5

| Kryterium | Wynik |
| --- | --- |
| K1 | **PARTIAL:** 76 użyć / 67 identyfikatorów; 7/7 statycznych konsumentów, 0/76 runtime |
| K2 | **FAIL / EVIDENCE_MISSING:** 0 z 24-32 zrzutów porcji 1 |
| K3 | **FAIL / EVIDENCE_MISSING:** 0 ocen graficznych |
| K4 | **PARTIAL:** R1 zlokalizowane, widoczność i SPEC-N porcji nieweryfikowane |
| K5 | **PASS:** jedyną zmianą repo jest ten raport |

## 8. Stan końcowy

Nie zmieniono żadnego pliku w `src/`, `server/src/`, żadnej flagi, SPEC-N,
ledgera ani `MODULE_ACCEPTANCE.md`. Nie użyto Railway, zdalnej bazy, produkcji,
demo, stagingu, `git stash`, `rebase`, `fetch --all` ani pushu na `origin`.
