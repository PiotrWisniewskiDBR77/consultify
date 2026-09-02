# CODEX DAY 261 — Moja Praca

## Streszczenie

Dyżur wykonano na gałęzi `codex/day261-mojapraca-kontrakty-20260901`, bazie
`df7f13056f`. Bramka modułu pozostaje `NOT_ACCEPTED`. Pomiar obalił T4:
`Api.createVaultFolder` nie ma zera konsumentów — wywołuje go
`src/views/vault/VaultFoldersTable.tsx:140`, montowany przez
`ClientDocumentsVault.tsx:273`. Nie wybrałem wariantu produktowego za
właściciela. Dopisałem aktualny koszt dwóch wariantów i domknąłem osobnym
atomem zweryfikowaną naprawę kreatora formularzy.

## Wejście i marker — wyjście dosłowne

```text
MARKER OK
df7f13056fa24995be07f64b0e8c877b3faeab45
```

`git status --short | head -3` po utworzeniu worktree: brak wyjścia.
Przed utworzeniem worktree było 12 GiB wolne, po utworzeniu 9.4 GiB; porty
`6262`, `5242`, `5243` nie miały nasłuchu. Tip gałęzi bazowej jest przed
markerem o dziewięć commitów dotyczących instrukcji i dokumentów; pełne
wyjście oraz lista plików są w `r1-static.txt`.

## Lokalna baza i bezpieczeństwo wysyłki

Uruchomiono wyłącznie `cx-day261-pg` (`pgvector/pgvector:pg16`) na
`127.0.0.1:6262`, baza `cx261`. Pierwszy przebieg zastosował 880 migracji i
zakończył się `✅ Postgres migrations complete`; drugi zastosował 0 i zakończył
się tym samym komunikatem.

```text
BRAK ZMIENNYCH POCZTY
 key | left
-----+------
(0 rows)
```

Grep drenów w `server/src/Gateway.ts` zwrócił zero trafień. Nie ustawiłem
żadnej zmiennej SMTP ani flagi wysyłki. Baza tego dyżuru nie zawiera wierszy
konfiguracji SMTP. Nie uruchomiłem `server/src/index.ts` ani żadnego drenażu
outboxu. Żaden e-mail ani zaproszenie kalendarzowe nie zostało wysłane.
Nie uruchomiono modelu językowego ani żadnej trasy AI.

## R1 — osiem tez wejściowych

| Teza | Wynik własnego pomiaru |
| --- | --- |
| T1 | Potwierdzona: linia 5 karty zawiera `DAY100_PARTIAL_OWNER_PACKET / 3_OF_5_SURFACES_HAVE_FULL_STATE / CORE_DESIGN_TASKS_REQUIRED / NOT_ACCEPTED`. |
| T2 | Potwierdzona: `MYW-CV-REC-005` jest `NIEZROBIONE` w linii 167, a `MYW-CV-REC-008` jest `ZROBIONE_W_KODZIE` / `CLOSED` w linii 170. Dosłowne cytaty: `Need an "add folder" button at this level.` oraz `Is the "Refresh" button needed here? Also, no folder creation at this level either.` |
| T3 | Potwierdzona: cztery pełne przypadki `VaultDocumentsView.openedToolbar.ownerFeedback.test.ts` przeszły z `--retry=0`. |
| T4 | **Obalona:** `src/views/vault/VaultFoldersTable.tsx:140: await Api.createVaultFolder(input);`. Komponent jest montowany na poziomie listy w `ClientDocumentsVault.tsx:273`. |
| T5 | Potwierdzona: `ANCESTOR OK`; grep starego `showFormBuilder` / literału konfiguracji pusty. |
| T6 | Potwierdzona z korektą liczby: kontrakt istnieje i przechodzi, ale ma 3, nie oczekiwane 2 przypadki. |
| T7 | Potwierdzona przed dopiskiem: grep `Dzień 261`, `formBuilderWiring`, `d0ef02897b` był pusty. |
| T8 | Potwierdzona: 9.4 GiB wolnego po utworzeniu worktree. |

Dodatkowy pomiar endpointu: `POST /vault-folders` wymaga `name` i `scope`, dla
`scope=project` wymaga `projectId`, a `parentFolderId` jest opcjonalny i jest
przekazywany do `KnowledgeService.createFolder`. Historia zwróciła
`d3160e86c2 feat(menu-dlugi): D4 wspólny FolderCreateDialog zastępuje
window.prompt`; nie znaleziono commitu gotowego wiringu w
`VaultDocumentsView.tsx`.

## R2a / R3a — koszt wariantów

Do karty dopisano dokładnie dwa warianty bez wyboru za właściciela:

- wariant (a), mały koszt dokumentacyjny: zachować brak tworzenia w otwartym
  sejfie i uznać istniejący `VaultFoldersTable` za realizację prośby na
  poziomie listy; nowy endpoint ani migracja nie są potrzebne dla obecnego
  działania;
- wariant (b), średni koszt: po jawnej decyzji właściciela rozluźnić zamkniętą
  regresję `008` i ponownie wpiąć wspólny dialog w otwartym sejfie; obecny
  endpoint obsługuje opcjonalny `parentFolderId`, więc nowy endpoint ani
  migracja nie wyglądają na potrzebne.

Status quo zapisano jawnie: obecne tworzenie na liście folderów plus brak
tworzenia wewnątrz otwartego sejfu, bez udawania rozstrzygnięcia znaczenia
„this level”.

## R2b / R3b — własny dowód mutacyjny

Plik bieżący skopiowano poza repo. Wersja
`d0ef02897b~1:src/components/MyWork/IdeaTableTool.tsx` dała z `--retry=0`:

```text
3 testy: 1 passed, 2 failed
FAILED: Idea Table Form Builder wiring contract does not reintroduce the hardcoded-literal FormBuilder modal
FAILED: Idea Table Form Builder wiring contract routes every "Form Builder" trigger to the already-wired Forms tab
PASSED: Idea Table Form Builder wiring contract FormsIndex only announces success after the real API call resolves
```

Po przywróceniu kopii bieżącej:

```text
3 testy: 3 passed, 0 failed
git diff -- src/components/MyWork/IdeaTableTool.tsx: brak wyjścia
```

Grep wykazał pięć wywołań `setPlatformTab('forms')` (linie 2506, 2545, 3297,
3353, 3438). Do karty dopisano `MYW-FORMBUILDER-001` ze statusem
`ZROBIONE_W_KODZIE`; bramki modułu nie zmieniono.

## Zasięg testów po pełnych nazwach

Przed i po zmianie dokumentacji zmierzono te same 7 pełnych nazw: 4 z
kontraktu toolbaru sejfu i 3 z kontraktu kreatora formularzy. Pliki
`przed-nazwy.txt` i `po-nazwy.txt` mają po 7 wierszy i identyczny SHA-256
`34f726132c5505ddbbc3bbd1eb7c7065f0258a3be477125c6cfe98f0ae9e5bf0`.
`nazwy.diff` jest pusty: zero nazw dodanych i zero znikniętych.

Pułapki Z33: oba pakiety są statycznymi kontraktami plikowymi uruchomionymi
z `RUN_DB_TESTS=0 MOCK_DB=true`; nie przechodzą przez `ApiGateway`, auth,
`ENABLE_V8_GLOBAL`, strażnik wyników ani PostgreSQL, więc (a)–(d) nie dotyczą
ich twierdzeń. Pułapka (e) dotyczyła kontraktu kreatora i została wyłączona
własną mutacją RED→GREEN oraz pustym diffem po przywróceniu. To dowód wiringu
statycznego, nie dowód realnego HTTP ani bazy.

## Artefakty i SHA-256

Katalog: `/private/tmp/cx-day261-mojapraca-kontrakty-artefakty`.

```text
f98564ba2b8bc31cd73bd320bb4bbd5504ccdab7f7d7e92c499063b5bfef7097  migrate-1.log
bcf43e98eeff39ca1ef19cf88b48463fc3324245ade063af5f31cca4fba1f93f  migrate-2.log
5c43b32c119ce181db42b3d66168cd78ce79a7850f9b6d3077be05e98ee6f8a1  email-safety.txt
fc4a7b9076b25ddf07911f99b6fe0185dc45de919cac4dc6b6a4d5e3ba5009e5  r1-static.txt
cf1f146aa2b922231b5b79d63bd33a9b3ab5274ac59bce1d27d4b6d7f520c043  r1-followup.txt
e3afb2455f1a9c5203c7d830dec5fa849d9ee375fe8766baeb061cd3da6383d2  day261-formbuilder-red.json
7fafeee1f6fff43d6ce3602e558631030d0cbcca286c5a573a9cb4b73376af72  day261-formbuilder-po.json
ae38b86e2ff0627c81d4cdbb12c671a4ba1511bc45c7122b44edd04c526f77a6  day261-vault-przed.json
cfdd8db06f9ff5f5006f58515aa905bd462a8fc9749000c762b3608960639461  day261-vault-po.json
34f726132c5505ddbbc3bbd1eb7c7065f0258a3be477125c6cfe98f0ae9e5bf0  przed-nazwy.txt
34f726132c5505ddbbc3bbd1eb7c7065f0258a3be477125c6cfe98f0ae9e5bf0  po-nazwy.txt
e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855  nazwy.diff
```

## Korekty wobec instrukcji

1. T4 oczekiwała pustego wyniku grepu, lecz wynik zawiera
   `VaultFoldersTable.tsx:140`. To wynik pomiaru, nie powód do STOP-u. Wariant
   (a) jest już technicznie obecny na liście folderów; nierozstrzygnięta jest
   semantyka uwagi właściciela i historyczny status wiersza.
2. R2b oczekiwał `2 passed`; własny JSON wykazał 3 pełne przypadki. Wszystkie
   trzy przeszły po przywróceniu, a dwa zależne od poprawki były czerwone na
   wersji sprzed poprawki.
3. Instrukcja raz nazywa `VaultDocumentsView.openedToolbar.ownerFeedback.test.ts`
   plikiem dozwolonym do relaksacji po decyzji, a tabela licencji i Z40
   zakazują jego zapisu w tym dyżurze. Wybrałem bezpieczniejszą interpretację:
   plik pozostawiłem tylko do odczytu i opisałem koszt wariantu (b).

## TWIERDZENIA NIEZWERYFIKOWANE

- Nie zweryfikowano, czy właściciel przez „this level” rozumiał listę sejfów,
  listę folderów, czy toolbar wnętrza sejfu; tylko właściciel może to wybrać.
- Nie wykonano realnej ścieżki HTTP/JWT/PostgreSQL dla tworzenia folderu,
  ponieważ zakres nakazywał wyłącznie odczyt kodu i dokumentację wariantów.
- Nie udowodniono wizualnie zachowania `VaultFoldersTable`; dyżur nie miał
  licencji ani potrzeby uruchamiania runtime'u lub wykonywania zrzutów.
- Nie zmierzono innych 54 atomów modułu i nie wysunięto wniosku o akceptacji
  całego modułu.
