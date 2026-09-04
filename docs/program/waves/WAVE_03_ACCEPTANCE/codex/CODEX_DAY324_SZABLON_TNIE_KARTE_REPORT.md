# CODEX DAY 324 — SZABLON TNIE KARTĘ

Data: 2026-09-04  
Marker: `1c3d3da844ae03c87985a8f5dc74846a073c0220`  
Gałąź: `codex/day324-szablon-tnie-karte-20260904`

## Werdykt

- R1 `ZROBIONE`: uchwyt DOM potwierdził sufit szablonu: niepusty `quick_win` OFF/ON = `6 pozycji / 3 grupy`; brak szablonu OFF/ON = `24 / 5`.
- R2 `ZROBIONE`: Decyzja czyta wspólny `ff.cardContract`; flaga nadal domyślnie OFF; test mutacyjny czerwony→zielony.
- R3 `PARTIAL / NOT_PROVEN`: powstały i zostały obejrzane 4 kadry, lecz transport harnessu jest mockowany. Warunek „realny rekord z listy przez pełny runtime/ApiGateway/JWT/PG” nie został dowiedziony.
- R4 `ZROBIONE POMIAREM`: Task ma 10 w katalogu i 8 w renderze; Insight obala tezę 30/22 — marker ma 30 w deskryptorze i 32 w renderze.
- R5 `ZROBIONE`: 11 typów §13.1, 4 z kontraktem, 7 bez kontraktu.
- R6 `ZROBIONE`: pytanie do właściciela z obiema listami nazw znajduje się w rejestrze.

## Wejście i rozjazd bazy

Dosłowny wynik markera:

```text
MARKER OK
```

Dosłowny wynik sanity:

```text
1c3d3da844ae03c87985a8f5dc74846a073c0220
```

Tip `github-backup/grafika/m03-20260902` był 9 commitów przed markerem pracy; lista dotyczyła wyłącznie instrukcji 324–333 i ich źródeł. Pracę wykonano dokładnie z markera, bez rebase.

## R1 — cztery liczby

| Rekord | Szablon | Flaga / źródło | Stan localStorage przed wejściem | Pozycje | Grupy | JSON |
| --- | --- | --- | --- | ---: | ---: | --- |
| `init-smed-linia-pakowania` | `quick_win` | OFF / brak query | świeży kontekst; brak `ff.cardContract` i `v2-contract` | 6 | 3 | `/private/tmp/cx-day324-szablon-tnie-karte-artefakty/r1-off-niepusty.json` |
| jw. | `quick_win` | ON / `?cardContract=1` | świeży kontekst; brak kluczy przed wejściem | 6 | 3 | `.../r1-on-niepusty.json` |
| jw. | brak | OFF / brak query | świeży kontekst; brak kluczy | 24 | 5 | `.../r1-off-pusty.json` |
| jw. | brak | ON / `?cardContract=1` | świeży kontekst; brak kluczy przed wejściem | 24 | 5 | `.../r1-on-pusty.json` |

Selektory: `[data-nmode-section-item]`, `[data-nmode-section-group]`. Liczb nie brano z obrazu. Wynik potwierdza, że `enabledNModeSectionIds` tnie listę przed `uporzadkujSekcjeBoarduInicjatywy`.

## R2 — siedem wołaczy

| Artefakt | Wołacz na markerze | env | query | `ff.cardContract` | DEV-only? |
| --- | --- | --- | --- | --- | --- |
| Initiative | `initiativeCardContract.ts:941` | tak | tak | tak | nie |
| Task | `TaskDetailView.tsx:286` | tak | tak | tak | nie |
| Decision | `DecisionDetailView.tsx:502` | tak | tak | po zmianie: tak | nie po zmianie |
| Notification | `NotificationDetailView.tsx:258` | tak | tak | tak | nie |
| Insight | `InsightViewer.tsx:193` | tak | tak | tak | nie |
| Interview | `InterviewWorkspace.tsx:199` | tak | tak | tak | nie |
| Tool | `KnownToolDetailView.tsx:82` | tak | tak | tak | nie |

Domyślność pozostaje OFF: brak query, storage i env zwraca `false`.

### Dowód mutacyjny

1. Zielony: `RUN_DB_TESTS=0 MOCK_DB=true npx vitest run src/components/MyWork/__tests__/cardContractFlagFamily.day324.test.ts --retry=0` → `1 passed`.
2. Mutacja: odczyt w `DecisionDetailView.tsx` zamieniono na `const stored = null`.
3. Ta sama komenda → `1 failed`, `MUTATION_RED_EXIT=1`, wskazanie dokładnie `DecisionDetailView.tsx`.
4. Odtworzenie przez `cp` z `...-scratch/DecisionDetailView.r2.green.tsx`; `diff -u` względem kopii → pusty.
5. Ta sama komenda → `1 passed`.

Pułapki środowiska (a)–(e): test jest statycznym kontraktem plikowym; nie montuje ApiGateway, nie dotyka DB, auth, V8 ani results visibility. `RUN_DB_TESTS=0 MOCK_DB=true` wyklucza udawanie RealPG; test dowodzi wyłącznie obecności zabezpieczenia w komplecie siedmiu runtime callers.

### Gotowe diffy nienałożone

Kolejność filtra Initiative — wymaga decyzji właściciela; dotyka jednego typu karty, ale zmienia znaczenie szablonów:

```diff
- const filtered = enabledNModeSectionIds
-   ? allSections.filter((section) => enabledNModeSectionIds.has(section.id))
-   : allSections;
- const ordered = uporzadkujSekcjeBoarduInicjatywy(filtered);
+ const ordered = uporzadkujSekcjeBoarduInicjatywy(allSections);
+ const filtered = templateMayLimitCompleteness
+   ? ordered.filter((section) => enabledNModeSectionIds?.has(section.id))
+   : ordered;
```

To nie jest rekomendacja wdrożenia bez decyzji: wariant „pełna karta” musi określić, czy szablon jest presetem startowym, czy trwałym filtrem.

Zastany layout `v2-contract` — nienałożony kierunek migracji danych przeglądarki:

```diff
+ const CARD_LAYOUT_SCHEMA = 'v3-complete';
- const key = `${artifact}:nmode:card-layout:v2-contract:${id}`;
+ const key = `${artifact}:nmode:card-layout:${CARD_LAYOUT_SCHEMA}:${id}`;
+ // nie kopiuj v2 automatycznie; pokaż jednorazową decyzję „Zachowaj mój układ / Przywróć komplet”.
```

Promień: Task, Decision, Notification oraz pozostałe artefakty używające namespacingu layoutu. Automatyczne kasowanie jest niedopuszczalne bez zgody.

## R3 — kadry pomocnicze, nie odbiór produkcyjny

Kadry: `evidence/kompletnosc-kart-20260904/r3-{pl,en}-{light,dark}-PARTIAL.png`. Wszystkie pokazują 6 pozycji w 3 grupach. Light i dark mają różne SHA. Oględziny: widoczne są `Zakres i plan`, `Rezultaty`, `Zapisy`; brakuje dwóch grup i 18 pozycji z pełnego katalogu. EN tłumaczy chrome, lecz treść rekordu pozostaje częściowo PL.

Nie uruchomiono `server/src/index.ts`. Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Baza tego dyżuru nie zawierała wierszy konfiguracji SMTP. Nie uruchomiłem żadnego drenażu outboxu. Żaden e-mail ani zaproszenie kalendarzowe nie zostało wysłane.

## R4–R6

Pełne tabele, nazwy braków i pytanie `DO DECYZJI WŁAŚCICIELA`: `docs/program/waves/WAVE_03_ACCEPTANCE/REJESTR_KOMPLETNOSCI_KART_20260904.md`.

## Zasięg testów po pełnych nazwach

- `przed-nazwy.txt`: 183 unikalne nazwy, SHA-256 `f2fcf29c8443f46283ed943307f53a05b058547a666887c781592f1994b88a7f`.
- `po-nazwy.txt`: 184, SHA-256 `78927e01c35040329a49ea1b8f273ebbff8f66736e8dbf8dd4f76e4b3acff316`.
- diff: jedna nazwa dodana (`Day 324 card-contract flag family ...`), zero znikniętych; SHA-256 `ae4b919c36996e21ef4078cca61c1a456ad8941a3093ef89c9e9034530ff7ea9`.
- Initiatives 21/21 i Standard 5/5 przed oraz po.
- Pełny `MyWork/__tests__`: przed 159 total / 142 passed / raport `success=false`; po 160 / 143 / `success=false`. Zestaw zastanych niezielonych nazw nie zmienił się. Nie ogłaszam pakietu PASS.

Artefakty: `/private/tmp/cx-day324-szablon-tnie-karte-artefakty/{przed,po}-nazwy.txt` i `nazwy.diff`.

## Korekty wobec instrukcji

1. Kontrola `find` oczekiwała 8 ścieżek, zmierzono 9: dodatkowo pasuje `src/components/MyWork/whiteboard/whiteboardContracts.ts`. Kontraktów siedmiu badanych artefaktów nadal jest 7.
2. Wariant komendy w §0.2c (C) jest składniowo uszkodzony (zagnieżdża opis i drugą komendę wewnątrz `npx vitest run`). Zastosowano bezpieczne, jawne komendy dla trzech wskazanych pakietów.
3. Teza Insight `30/22` nie opisuje markera: jest `30/32` (deskryptor/render), z dwoma jawnymi extras.

## TWIERDZENIA NIEZWERYFIKOWANE

- R3 przez realną listę → ApiGateway → JWT → Postgres → `InitiativeDocumentView` jest `NOT_PROVEN`; cztery kadry są tylko harnessowe.
- Nie zmierzono DOM Task i Insight ponownie w dyżurze 324; R4 opiera się na deklaracjach źródłowych markera i jawnej granicy dowodu.
- Nie udowodniono decyzją właściciela, że brak `comments` i `activity-log` w Task jest świadomym wyborem; klasyfikacja pozostaje długiem.
- Nie rozstrzygnięto docelowych nazw Menu 3 ani semantyki szablonu jako preset vs trwały filtr.
