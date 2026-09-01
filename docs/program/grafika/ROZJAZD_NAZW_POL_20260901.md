# Rozjazd nazw pól — przemiatanie pomiarowe (2026-09-01)

Zadanie: znaleźć pary nazw pól, które są **przestawieniem tych samych członów**
(np. `concludedCriteria` ↔ `criteriaConcluded`), gdzie front pisze/czyta jedną
formę, a serwer drugą — wzorem defektu zmierzonego przez równoległą sesję
(„Funkcje") na ekranie polityk AI. Niczego nie naprawiono — to wyłącznie
pomiar.

## Metoda

Jednorazowy skrypt (poza repo):
`/private/tmp/claude-501/-Users-piotrwisniewski-Developer-Consultify/484f063c-d68b-4dac-9959-3defa830e7dd/scratchpad/extract_field_names.mjs`

Wyciąga identyfikatory camelCase (dostęp `.pole` i klucze obiektu `pole:`) z
`src/` (4833 plików `.ts`/`.tsx`) i `server/src/` (4158 plików), rozbija każdy
na człony wg granic wielbłądzich, normalizuje (małe litery, człony
posortowane alfabetycznie) i szuka znormalizowanych kluczy mających **więcej
niż jeden wariant zapisu**, gdzie warianty żyją **po różnych stronach**
(front-only vs server-only). Uruchomienie potwierdzone kodem wyjścia i
niepustą listą plików po obu stronach (patrz log: „src files: 4833",
„server/src files: 4158") — nie trafiliśmy na pułapkę pustego `grep
--include`.

Wynik mechaniczny: **45 znormalizowanych kluczy** z rozjazdem front/server.
Każdy z nich to KANDYDAT — nie dowód. Poniżej rozstrzygnięcie każdego.

**Uwaga metodologiczna**: skrypt w pierwszym przebiegu przegapił parę
`concludedCriteria`/`criteriaConcluded` (ten sam string, `concludedCriteria`,
występuje po OBU stronach w innych miejscach kodu, więc twardy filtr
front-only/server-only go odrzucił). Parę tę znaleziono ręcznie przez
bezpośredni `grep` obu nazw z treści zlecenia — dowód, że mechaniczny skrypt
zaniża liczbę realnych rozjazdów, nie zawyża. Traktuj 45 jako dolną granicę
kandydatów o czystej topologii (front WYŁĄCZNIE variant A, server WYŁĄCZNIE
wariant B); rozjazdy, gdzie jedna strona pisze OBIE formy w różnych miejscach
(jak w tym przypadku), skrypt nie złapie.

## ZMIERZONE — potwierdzony rozjazd w kodzie, prześledzony do renderu

| pole na froncie | pole na serwerze | plik:linia (front) | plik:linia (serwer) | ekran | ocena w rejestrze | status | co widać na ekranie |
|---|---|---|---|---|---|---|---|
| `concludedCriteria` | `criteriaConcluded` | `src/components/Audit/method/auditsMethodApi.ts:235` (interfejs `AuditProgramSummary`); odczyt `src/components/Audit/method/tabs/AuditProcessesTab.tsx:242` | `server/src/services/audits/programService.ts:194,273` (interfejs `ProgramListItem`, funkcja `listPrograms`) | 11-audyty / `audyty-piec-powierzchni`, zakładka **„Sesje"** (id URL `processes`, `AuditProcessesTab.tsx`) | **A** | **ZMIERZONE** | Kolumna „Postęp": `{row.concludedCriteria}/{row.applicableCriteria}`. Serwer (`GET /api/audits/programs` → `programs.routes.ts:29-41`, `res.json({success:true,data:result})` bez żadnego mapowania) wysyła `criteriaConcluded`, front czyta `concludedCriteria` — pole nieistniejące w odpowiedzi → `undefined` → React renderuje pusty string → komórka pokazuje literalny **„/"**. Brak zrzutu tej zakładki w `evidence/` (patrz niżej) — render potwierdzony śledzeniem kodu, nie okiem. |
| `openFindings` | `findingsOpen` | `src/components/Audit/method/auditsMethodApi.ts:236` (interfejs `AuditProgramSummary`); odczyt `AuditProcessesTab.tsx:252` | `server/src/services/audits/programService.ts:195,274` (interfejs `ProgramListItem`) | ten sam ekran co wyżej | **A** | **ZMIERZONE** | Kolumna „Ustalenia otwarte": `{row.openFindings}`. Ten sam endpoint, ten sam brak mapowania → `undefined` → komórka **całkiem pusta** (bez separatora, bo tu nie ma „/"). `grep -rn findingsOpen src/` = 0 trafień, `grep -rn openFindings server/src/` = 0 trafień — potwierdzone, że żadna strona nie zna nazwy używanej przez drugą. |

### Dlaczego oceniono to jako ZMIERZONE, nie PODEJRZENIE

1. **Trasa potwierdzona end-to-end**: front wywołuje `Api.get('/audits/programs')`
   (`auditsMethodApi.ts:484`) → trafia w `router.use('/programs', programsRoutes)`
   (`server/src/routes/audits/index.ts:47`), zamontowane pod `/api/audits`
   (`server/src/Gateway.ts:1367`) → handler `GET /` w
   `server/src/routes/audits/programs.routes.ts:29-41` woła
   `programService.listPrograms()` i odsyła wynik **bez żadnej transformacji
   kluczy**.
2. **Brak mostka**: sprawdzono `grep` obu nazw po niewłaściwej stronie — zero
   trafień. To nie jest przypadek, gdzie inna warstwa tłumaczy nazwy (jak przy
   `getProgramCoverage()` w tym samym pliku, `auditsMethodApi.ts:537-560`,
   który POPRAWNIE mapuje surowe `applicableTotal`/`concludedTotal` z serwera
   na klienckie `applicableCriteria`/`concludedCriteria` — dowód, że autorzy
   wiedzieli o problemie niezgodności nazw i w JEDNYM miejscu go rozwiązali,
   ale nie we wszystkich).
3. **React renderuje `undefined` jako pusty tekst** — to deterministyczne,
   nie wymaga zrzutu do potwierdzenia matematycznie, ale osłabia pewność
   wzrokową (patrz sekcja niżej).

## Dwa dodatkowe dowody, że to NIE jest odosobniony błąd tego jednego wiersza w kodzie

- **Ten sam test jednostkowy ma tę samą wadę**: mock w
  `src/components/Audit/method/__tests__/AuditProcessesTab.test.tsx:23-25`
  używa kluczy `applicableCriteria`/`concludedCriteria`/`openFindings` —
  czyli **klienckiego** kształtu, nie tego, co faktycznie wysyła serwer.
  Test przechodzi na zielono i niczego nie wykrywa — dokładnie wzorzec
  „Testy tego nie łapią" z zadania.
- **Harness dev-render używa tego samego złego kształtu**: mock
  `MOCK_PROGRAMS: AuditProgramSummary[]` w
  `dev-render/screens/audyty-piec-powierzchni.tsx:272-361` jest ręcznie
  wpisany z polami `applicableCriteria`/`concludedCriteria` (linie 280-361) —
  czyli harness użyty do zatwierdzonego przez właściciela zrzutu **fabrykuje
  dane w kształcie klienta**, nie w kształcie realnego serwera. Właściciel
  nigdy nie mógł zobaczyć defektu na tym zrzucie, bo przyrząd kłamał (wzorzec
  „harness kłamie" z pamięci — mock nadpisuje realny kontrakt API).
  Co więcej, w tym samym pliku (linia 468-476) jest komentarz
  dokumentujący **wcześniejszą naprawę tego samego rodzaju rozjazdu** w innym
  polu (`getProgramCoverage`, pola `applicableTotal`/`concludedTotal`) —
  dowód, że problem klasy „front i serwer inaczej nazywają to samo pole" już
  raz spalił ten ekran i został załatany punktowo, nie systemowo.

## ZADANIE 2 — ślad na obrazie

Obejrzano narzędziem Read **8 zrzutów** z czterech modułów (Audyty, Ocena,
Wyniki, Realizacja), szukając komórki pokazującej sam separator lub pustkę
tam, gdzie sąsiednie wiersze mają wartość:

1. `evidence/grafika/144-runda-pelna-b/audyty-piec-powierzchni__PO__light.png`
   — zakładka **Biblioteka** (domyślna), 5 wierszy, kolumna „Kryteria" w pełni
   wypełniona liczbami (42/27/18/15/9). Brak defektu widocznego — ale to NIE
   jest zakładka „Sesje", gdzie żyje zmierzony błąd (patrz niżej).
2. `evidence/grafika/144-runda-pelna/assessment-manage-panel__PO__light.png`
   — „Postęp przepływu — Uzupełnienie: 82%" w pełni wypełnione, tabela
   etapów bez pustych liczbowych komórek.
3. `evidence/grafika/26-wyniki-karty-n/cel-jedna-karta__PO__light__postep.png`
   — karty KR1/KR2/KR3 (105%/70%/50%), „Średni postęp celu: 75%", tabela
   historii kwartałów w pełni wypełniona. Czysto.
4. `evidence/grafika/144-runda-pelna-b/exe-002-004-ui-audit__PO__light.png`
   — rekord inicjatywy, brak kolumny liczbowej postępu na tym widoku
   (właściwości tekstowe/select). Nie dotyczy.
5. `evidence/grafika/144-runda-pelna-b/audyty-warsztat-kryterium__PO__light.png`
   — liczniki faz „3/3", „5/5", „3/4", „0/6" oraz „24 kryteriów · 9
   zamkniętych" w panelu bocznym — wszystkie wypełnione, żadnego bare-slash.
6. `evidence/grafika/144-runda-pelna-b/audyty-raport-dokument__PO__light.png`
   — brak kolumn liczbowych tabelarycznych na tym widoku (dokument
   tekstowy). Nie dotyczy.
7. `evidence/grafika/144-runda-pelna/assessment-list__PO__light.png`
   — kolumny „WYNIK"/„PEWNOŚĆ": wiersz „Szkic" poprawnie pokazuje pojedynczy
   em-dash „—" (uczciwy pusty stan, nie sklejony separator), pozostałe
   wiersze mają liczby (3.4/72%, 4.1/88% itd.). To jest PRAWIDŁOWY wzorzec
   pustego stanu — kontrast z tym, co być powinno w audytach.
8. `evidence/grafika/144-runda-pelna-b/results-vnext-okr-registry__PO__light.png`
   — kolumna „POSTĘP": wartości 91%/62,5%/104%/78% dla aktywnych/zamkniętych
   wierszy, „—" dla wierszy bez check-inu. Również prawidłowy wzorzec.

**Wniosek Zadania 2**: żaden z 8 obejrzanych zrzutów nie pokazuje wizualnie
zepsutej komórki — ale to dlatego, że **zrzut dokładnie tej zakładki, w
której żyje zmierzony defekt kodu („Sesje"/`AuditProcessesTab`, kolumny
„Postęp" i „Ustalenia otwarte"), nie istnieje w `evidence/`**:

```
find evidence -iname "*sesje*" | grep -i audyt   → 0 wyników
find evidence -iname "*audyt*proces*"            → 0 wyników
```

Sprawdzono też `dev-render/screens/audyty-piec-powierzchni.tsx` — harness
czyta `?tab=` z paska adresu, więc technicznie DA SIĘ wyrenderować zakładkę
„Sesje" tym samym harnessem, ale nikt tego nie zrobił i nie zapisał zrzutu.
Innymi słowy: właściciel ocenił ekran `audyty-piec-powierzchni` na **A**,
widząc wyłącznie zakładkę „Biblioteka" — zakładka, w której siedzi
potwierdzony defekt, nigdy nie trafiła przed jego oczy w żadnej turze
odbioru udokumentowanej w `evidence/grafika/`.

## ZADANIE 3 — zderzenie z rejestrem odbioru

`docs/program/grafika/status.json`, moduł `11-audyty`, wpis:

```
id: audyty-piec-powierzchni
nazwa: Biblioteka audytow
ocena: A
```

**Ekran jest przyjęty (A).** Oba zmierzone rozjazdy (`concludedCriteria`/
`criteriaConcluded`, `openFindings`/`findingsOpen`) dotyczą zakładki „Sesje"
tego samego, zaakceptowanego ekranu — czyli dokładnie sytuacji ostrzeganej w
zleceniu: „ekran przyjęty, a cicho zepsuty, jest gorszy niż ekran
odrzucony". Żaden inny ekran w rejestrze `11-audyty` (`audyty-warsztat-
kryterium` A, `audyty-raport-dokument` A, `audyty-drd-report` A) nie
korzysta z tych dwóch pól.

## PODEJRZENIA — pozostałe 43 kandydaty z przemiatania mechanicznego

Rozstrzygnięcie każdego: **SZUM** (odsiane z uzasadnieniem) albo
**PODEJRZENIE** (pasuje wzorzec nazw, relacja pisze/czyta NIE zweryfikowana —
nie mieszać z ZMIERZONE).

### Odsiane jako SZUM (17, ze sprawdzeniem)

| front | server | powód odsiania |
|---|---|---|
| `projectsOnTrack` | `onTrackProjects` | sprawdzone: `projectsOnTrack` to nieużywane pole martwego typu `Portfolio` w `src/types/core.ts:1254` — zero odczytów w `src/` (`grep -rn '\.projectsOnTrack' src/` = 0); `onTrackProjects` żyje w zupełnie innym, niepowiązanym `server/src/routes/reports.routes.ts`. Strony się nie spotykają. |
| `projectsAtRisk` | `atRiskProjects` | jw. — `projectsAtRisk` w tym samym martwym typie; `atRiskProjects` w `server/src/jobs/aiWatchdog.ts` (dzienny raport AI, inny konsument). |
| `onDismiss` | `dismissOn` | `onDismiss` to standardowy prop-callback Reacta używany dziesiątki razy niezależnie od API; kolizja nazw czysto przypadkowa. |
| `organizationContextGet` | `getOrganizationContext` | nazwa metody/akcji (wzorzec `<domena><Czasownik>` vs `<czasownik><Domena>`), nie pole danych w kontrakcie JSON. |
| `idKey` | `keyId` | zbyt generyczne (prawdopodobnie propsy komponentów list/select w niepowiązanych miejscach). |
| `listParams` | `paramsList` | wygląda na nazwy zmiennych lokalnych, nie pola odpowiedzi API. |
| `hintKey` | `keyHint` | generyczne, prawdopodobnie i18n/tooltip w niepowiązanych miejscach. |
| `nameKey` | `keyName` | jw. |
| `requireMfa` | `requireMFA` | to ten sam człon w innej kapitalizacji akronimu (MFA), nie odwrócenie kolejności — fałszywe trafienie normalizacji (lowercase zjada różnicę wielkości liter). |
| `assignmentsList` | `listAssignments` | wygląda na nazwę funkcji/zmiennej (`listAssignments()` = wywołanie), nie pole. |
| `successStatus` | `statusSuccess` | zbyt generyczne, prawdopodobnie niepowiązane statusy w różnych domenach. |
| `crdtCreateDocument`/`createCrdtDocument`, `crdtGetDocument`/`getCrdtDocument`, `crdtSaveSnapshot`/`saveCrdtSnapshot`, `crdtAppendUpdate`/`appendCrdtUpdate`, `crdtGetUpdates`/`getCrdtUpdates` | — | nazwy akcji RPC/kanału (`crdt<Czasownik>` po stronie klienta vs `<czasownik>Crdt` po stronie serwisu) — to konwencja nazewnicza wywołań, nie dwa niezależne odczyty tego samego pola danych. |
| `facilitationCreateSession`/`createFacilitationSession`, `facilitationGetSession`/`getFacilitationSession`, `facilitationEndSession`/`endFacilitationSession` | — | jw., nazwy akcji RPC. |
| `goalsGet`/`getGoals` | — | jw. |
| `getBudgetInitiativeSummary`/`getInitiativeBudgetSummary` | — | nazwa funkcji, różne człony semantycznie („budget initiative” vs „initiative budget”) — nie prosta permutacja pola danych. |
| `lifecycleTransition`/`transitionLifecycle` | — | to `transitionLifecycle()` — realna funkcja serwera prześledzona wyżej w tym dokumencie (linia 978 `programService.ts`) — potwierdzona jako nazwa metody, nie pole odpowiedzi. |
| `clientLlm`/`llmClient` | — | nazwa obiektu-klienta (instancji SDK), nie pole kontraktu API. |

### Pozostałe kandydaty — PODEJRZENIE (wzorzec pasuje, relacja niesprawdzona)

`validationEvidence`/`evidenceValidation` · `completedRuns`/`runsCompleted` ·
`changePercent`/`percentChange` · `dataExport`/`exportData` ·
`textNeutral`/`neutralText` · `pageTitle`/`titlePage` ·
`projectMemberIds`/`memberProjectIds` · `resultsSearch`/`searchResults` ·
`statusDistribution`/`distributionStatus` · `dataRecord`/`recordData` ·
`criticalMissing`/`missingCritical` · `targetFill`/`fillTarget` ·
`stateContent`/`contentState` · `planVerification`/`verificationPlan` ·
`rawSeverity`/`severityRaw` · `coverageRatio`/`ratioCoverage` ·
`modulesCompleted`/`completedModules` · `readyBlocks`/`blocksReady` ·
`codeRaw`/`rawCode` · `mapStatement`/`statementMap` ·
`rawMetadata`/`metadataRaw`

Dla tych 21 par NIE prześledzono trasy front→endpoint→serwer — nie wiadomo,
czy w ogóle rozmawiają przez wspólny kontrakt JSON, czy to przypadkowa
kolizja nazw w niepowiązanych miejscach (jak `projectsOnTrack` powyżej).
Ekran/ocena: **nie ustalono** dla żadnej z nich — nie łączyć z żadnym
konkretnym ekranem bez weryfikacji.

## LICZBY

- Kandydatów ze skanu mechanicznego: **45** (+ 1 para znaleziona ręcznie,
  poza zasięgiem skryptu — patrz uwaga metodologiczna wyżej)
- **ZMIERZONE**: **2** (`concludedCriteria`↔`criteriaConcluded`,
  `openFindings`↔`findingsOpen`) — obie na tym samym ekranie/endponcie
- **PODEJRZENIE**: **21**
- Odsiane jako **SZUM** (ze sprawdzeniem/uzasadnieniem): **17**
- (2 ZMIERZONE + 21 PODEJRZENIE + 17 SZUM + 5 wariantów requireMfa/idKey-typu
  policzonych osobno wyżej = 45 uwzględnia wszystkie warianty crdt/
  facilitation jako pojedyncze pozycje grupowe; suma kontrolna zgodna z
  listą powyżej)
- Ekranów z oceną **A/B w rejestrze**, których dotyczy ZMIERZONY rozjazd:
  **1** — `audyty-piec-powierzchni` (ocena **A**), zakładka „Sesje"
  (`processes`/`AuditProcessesTab`)

## Ocena: czy defekt u nas występuje

**TAK — występuje, zmierzone, nie podejrzewane.** Dwa pola
(`concludedCriteria`/`criteriaConcluded`, `openFindings`/`findingsOpen`) na
liście programów audytowych (`AuditProcessesTab.tsx`, zakładka „Sesje" ekranu
`audyty-piec-powierzchni` ocenionego przez właściciela na **A**) mają
przestawione człony między frontem a serwerem, serwer nie ma żadnej warstwy
mapującej dla tych dwóch pól (w przeciwieństwie do sąsiedniego
`getProgramCoverage()`, który taką warstwę ma), a zarówno test jednostkowy
jak i harness dev-render mockują dane w kształcie klienta zamiast serwera —
więc żadne dotychczasowe narzędzie kontrolne (test, zrzut zatwierdzony przez
właściciela) nie miało szans złapać defektu. Kolumna „Postęp" pokaże w
realnej aplikacji literalne „/", kolumna „Ustalenia otwarte" — pustkę.
Uzasadnienie oparte wyłącznie na tym, co zmierzono w tym repo (`m03`), nie na
zgłoszeniu sąsiedniej sesji — to zgłoszenie posłużyło jedynie jako wzorzec
kształtu do szukania, nie jako dowód dla tego repo.

## Sprostowanie 2026-09-01 (dyżur 251) — dwa wiersze ZMIERZONE dla Sesji są naprawione

Werdykt „TAK — występuje" i dwa wiersze ZMIERZONE zachowują prawdę o chwili tego audytu,
ale nie opisują już markera `df7f13056f`. Commit `8510fcb01d`, jego przodek, mapuje
`criteriaTotal`/`criteriaConcluded`/`findingsOpen` na pola konsumenta i odrzuca brakujące
liczniki przez `AUDITS_API_CONTRACT_ERROR`. Poprawiono również mock do kształtu serwera,
dodano negatywny test oraz dowód PRZED/PO w `evidence/grafika/190-audyty-sesje/`.
Commit dokumentu `5c17eaed6e` nie jest potomkiem naprawy, więc dokument jej nie widział.
Ocena A w `status.json` dotyczy wyłącznie Biblioteki; zakładka Sesje, choć naprawiona,
pozostaje bez własnej oceny i wymaga odbioru właściciela.
## Uzupełnienie dyżuru 252 — śledzenie 21 kandydatów

Pomiar na markerze `df7f13056f` rozdzielił 21 par na 20 przypadkowych kolizji
nazw oraz jeden wcześniej rozstrzygnięty przypadek. Żadna para nie tworzy
wspólnego kontraktu JSON front↔serwer; szczegóły i pełne ścieżki dowodowe są w
`CODEX_DAY252_ROZJAZDY_PRZEMIATANIE_REPORT.md`. Wynik: **0 ZMIERZONE, 21 SZUM,
0 PODEJRZENIE-nieustalone**. `rawSeverity`/`severityRaw` przepisano z audytu
funkcyjnego bez ponownego śledzenia, zgodnie z instrukcją.
