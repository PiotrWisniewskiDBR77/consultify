# CODEX DAY 136 — sekcje Inicjatywy

Data: 2026-08-30  
Marker: `4378136c7d`  
Gałąź: `codex/day136-sekcje-inicjatywy-20260830`  
Commit R1/R2: `e3f0939a58070ea01a8299639ca63bdffd87c373`

## Stan wejściowy

```text
$ git merge-base --is-ancestor 4378136c7d HEAD && echo "BAZA OK" || echo "MARKER BRAK — STOP"
BAZA OK
$ git status --short
[brak wyjścia]
$ git branch --show-current
codex/day136-sekcje-inicjatywy-20260830
$ ls -la node_modules
lrwxr-xr-x@ 1 piotrwisniewski wheel 56 Aug 30 07:45 node_modules -> /Users/piotrwisniewski/Developer/Consultify/node_modules
$ df -h /
Filesystem        Size Used Avail Capacity Mounted on
/dev/disk3s1s1   1.8Ti 12Gi  30Gi    28% /
$ git rev-parse HEAD
4378136c7dcbb37adeed1e41fb104c29314e34fd
```

Kontrola zasobów: `cx-day136-pg` działał jako `pgvector/pgvector:pg16` na
`127.0.0.1:6020`; port należał do przydzielonego kontenera. Porty `4938` i
`4939` były wolne.

Obowiązkowe T1–T4:

```text
$ grep -nE "'/:id/(stakeholders|raid|comments|linked-items)'" server/src/routes/pmo/initiatives.routes.ts
3673:router.get('/:id/stakeholders', InitiativeController.getStakeholders);
3675:  '/:id/stakeholders',
3697:router.get('/:id/raid', InitiativeController.getRaid);
3699:  '/:id/raid',
3720:router.get('/:id/comments', InitiativeController.getInitiativeComments);
3722:  '/:id/comments',
3960:router.get('/:id/linked-items', InitiativeController.getLinkedItems);
3962:  '/:id/linked-items',

$ grep -nE "case '(comments|stakeholders|raid|linked)" src/components/Initiatives/InitiativeDocumentView.tsx
9488:      case 'comments':
9561:        case 'comments':
10766:  // w `case 'comments'` ...

$ ls src/components/Initiatives/sections/*.tsx | wc -l
36

$ ls src/components/MyWork/shared/*.tsx | wc -l
35
```

Pełne migracje, dwa przebiegi:

```text
Applying migrations: 0
✅ Postgres migrations complete
Applying migrations: 0
✅ Postgres migrations complete
```

## Korekty wobec instrukcji

1. T2: dwa trafienia `case 'comments'` były dispatcherami AI, nie kluczem
   renderu. Komentarze były osiągalne przez prawy panel (`id: 'comments'`), a
   pozostałe trzy sekcje nie montowały swoich istniejących konsumentów w
   aktywnych gałęziach.
2. T3: katalog ma 36 plików, nie tylko nieokreślone „kilkanaście”.
3. T4: `MyWork/shared` ma 35 plików, nie trzy. Wszystkie pozostały tylko do
   odczytu; żaden nie znalazł się w diffie.
4. `DB_TYPE=postgres` w tej samej linii nie wygrywa z konfiguracją Vitest:
   pierwszy przebieg dostał efektywne `sqlite` i fail w jawnej asercji. Także
   `server/vitest.config.ts` przybił `sqlite`. Pakiet przywraca efektywne
   `process.env.DB_TYPE='postgres'` przed importem DB/Gateway, a potem asertuje
   `postgres` i uruchamia bezargumentowy `assertRealPostgresTestEnvironment()`.
5. Teza „backend gotowy” została obalona dla zapisu RAID: realny
   `POST /api/initiatives/:id/raid` przez Gateway zwraca `409` z kodem
   `EXECUTION_RUNTIME_V1_WRITE_REQUIRED` i wskazuje writer
   `/api/initiatives/runtime-v1`. Trasa istnieje, lecz legacy writer jest
   celowo zablokowany.

## R1 — pomiar czterowarstwowy

| Sekcja | W1 komponent | W2 trasa | W3 realny wołacz | W4 twardy klucz renderu po zmianie |
| --- | --- | --- | --- | --- |
| Komentarze | `sections/CommentsSection.tsx` | `initiatives.routes.ts:3720–3724` | odczyt `InitiativeDocumentView.tsx:2741`; zapis ekranowy w `handleAddComment`; delete w `handleDeleteComment` | prawy panel `id: 'comments'` (`InitiativeDocumentView.tsx:10143`), osiągalny w obu gęstościach |
| Powiązania | `sections/LinkedItemsSection.tsx` | `initiatives.routes.ts:3960–3964` | `LinkedItemsSection.tsx:35,60,76` | `case 'attachments-links'` (`InitiativeDocumentView.tsx:8140`) montuje klucz `linkedItems` |
| RAID | `sections/RaidSection.tsx` | `initiatives.routes.ts:3697–3701` | `RaidSection.tsx:128,152,169,302`; write realnie blokowany 409 | `case 'risk-raid'` (`InitiativeDocumentView.tsx:7676`) montuje klucz `raid` |
| Interesariusze | `sections/StakeholdersSection.tsx` | `initiatives.routes.ts:3673–3677` | odczyt `InitiativeDocumentView.tsx:2680`; zapis `StakeholdersSection.tsx:50,80` | `case 'raci'` (`InitiativeDocumentView.tsx:7513`) zachowuje RACI i montuje klucz `stakeholders` |

Kontrakt `getInitiativePersistedSectionKey()` jest wykonywany przez ekran dla
trzech środkowych gałęzi oraz obejmuje komentarze w prawym panelu. Nie czyta
tekstu źródła.

## R2 — podłączenie i prawdziwość zapisu

- RAID, interesariusze i powiązania korzystają z istniejących komponentów z
  `SECTION_REGISTRY`; nie powstał nowy wygląd.
- Komentarz trafia do stanu lokalnego dopiero po odpowiedzi serwera zawierającej
  `id`. Błąd zachowuje draft i pokazuje błąd. Delete ma rollback.
- Powiązania i interesariusze przeszły `POST → SQL → GET → DELETE → SQL/GET`.
- RAID pokazuje błąd i rollback przewidziany w istniejącym komponencie, ale nie
  może spełnić B2 bez zmiany backendu poza licencją.

### STOP — R2 / RAID

Rodzaj: MERYTORYCZNY  
Powód: produkcyjny Gateway blokuje legacy writer RAID kodem 409 i wymaga
kanonicznego Runtime-v1, którego kontraktu dla tego widżetu instrukcja nie podała.  
Licencja, którą sprawdziłem: `server/src/routes/pmo/initiatives.routes.ts` —
**odczyt**, „trasy już istnieją — nie zmieniasz ich”; middleware/Gateway są
imiennie nietykalne.  
Dowód: test `RAID: legacy POST is blocked and leaves real PostgreSQL unchanged`;
status `passed`, ponieważ asertuje dokładne `409`, kod, canonical writer i
niezmieniony licznik SQL.  
Co dostarczyłem ZAMIAST zmiany: czerwony kontrakt HTTP + readback bez zmian oraz
gotowy montaż istniejącego `RaidSection`, który uczciwie pokazuje błąd i cofa
optymistyczny wpis.  
Co zrobiłbym, gdyby zapadła decyzja X: po wskazaniu konkretnej trasy Runtime-v1
i payloadu przepiąłbym wołacz `RaidSection`, bez zmiany wyglądu. Następnie
powtórzyłbym pełną mutację w obie strony.  
Rekomendacja dla nadzorcy: wydać osobną licencję na adapter RAID do Runtime-v1
albo jawnie zatwierdzić legacy wyjątek; promień rażenia obejmuje write/read
model RAID i nie powinien być improwizowany w ekranie.  
Stan: częściowo zacommitowano w `e3f0939a58`; backendu nie zmieniono.  
Czy kontynuowałem pozostałe pozycje: TAK — trzy inne sekcje oraz R3.

## R3 — załączniki

Wynik potwierdza raport 130 dla Inicjatywy:

- `AttachmentsSection.tsx:31` tworzy `URL.createObjectURL(f)`;
- `InitiativeDocumentView.tsx:3861` także tworzy blob URL;
- w routerze Inicjatyw nie ma trasy attachments;
- brak dedykowanej tabeli `initiative_attachments` w migracjach. Trafienia innych
  domen (`tp_attachments`, chat, meetings) nie są backendem Inicjatywy.

Nic nie zbudowano i nie zmieniono migracji.

## W-A / W-C — pary przebiegów i pełne nazwy

Ta sama komenda jednostkowa z `RUN_DB_TESTS=0 MOCK_DB=true`, `--retry=0`, JSON:

```text
MARKER 4378136c7d:
numTotalTests=1 numPassedTests=0 numFailedTests=1
Day 136 initiative persisted section render contract binds all four persisted sections to reachable InitiativeDocumentView branches — failed

PO ZMIANIE:
numTotalTests=1 numPassedTests=1 numFailedTests=0
Day 136 initiative persisted section render contract binds all four persisted sections to reachable InitiativeDocumentView branches — passed
```

Pakiet realdb, `--config server/vitest.config.ts --retry=0`:

```text
numTotalTests=4 numPassedTests=4 numFailedTests=0
comments: POST -> DB/read HTTP -> DELETE -> DB/read HTTP — passed
linked items: POST -> DB/read HTTP -> DELETE -> DB/read HTTP — passed
RAID: legacy POST is blocked and leaves real PostgreSQL unchanged — passed
stakeholders: POST -> DB/read HTTP -> DELETE -> DB/read HTTP — passed
```

W-C: kontrakt renderu zmienił dokładnie jeden pełny przypadek z failed na passed;
nie pojawiła się nowa porażka o innej nazwie. Realdb ma trzy pełne mutacje i
jeden nazwany czerwony kontrakt RAID.

## Pułapki (a)–(e)

- Jednostkowy kontrakt renderu nie otwiera DB ani HTTP; (a)–(d) nie leżą na jego
  ścieżce. Pułapkę (e) wyłącza wywołanie dispatchu runtime, bez `readFileSync`.
- Realdb: (a) `ENABLE_V8_GLOBAL=true`; (b)
  `RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce`; (c) efektywny
  `DB_TYPE=postgres` jest pierwszą asercją przed strażnikiem i log DB podał
  `127.0.0.1:6020/cx136`; (d) `ENABLE_TEST_AUTH_BYPASS=false`, a żądania użyły
  podpisanego JWT przez realny `verifyToken`; (e) jest dowodzona osobnym
  kontraktem renderu i liniami aktywnych branchy.

## Z30 — zero wysyłki

```text
$ env | grep -iE "^(SMTP_|RESEND|SENDGRID|MAIL|ENABLE_LIVE_EMAIL)" || echo "BRAK ZMIENNYCH POCZTY"
BRAK ZMIENNYCH POCZTY
$ SELECT key ... FROM settings WHERE key LIKE 'smtp%';
(0 rows)
$ grep -n "startNotificationOutboxDrainCron\|outboxWorker\|platformOutboxDrainCron" server/src/Gateway.ts
[0 trafień]
```

Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Baza tego dyżuru nie
zawiera wierszy konfiguracji SMTP. Nie uruchomiłem `server/src/index.ts` ani
żadnego drenażu outboxu. Żaden e-mail ani zaproszenie kalendarzowe nie zostało
wysłane.

## W-D — granica rozłączności

```text
$ git diff --name-only 4378136c7d..HEAD
src/components/Initiatives/InitiativeDocumentView.tsx
src/components/Initiatives/__tests__/initiativeSections.day136.pg.test.ts
src/components/Initiatives/__tests__/initiativeSections.day136.test.ts
```

Po dodaniu tego raportu dojdzie wyłącznie licencjonowana ścieżka raportu. Zero
`src/components/MyWork/**`.

## Artefakty

- `/private/tmp/cx-day136-sekcje-inicjatywy-artefakty/day136-unit-marker.json`
  — SHA-256 `302485705a41f593d4920f95b0e7922a56643472c3ac9e8b76700f7e3e84ca77`
- `/private/tmp/cx-day136-sekcje-inicjatywy-artefakty/day136-unit-final2.json`
  — SHA-256 `235d1f8d49a635106c6e35941867050876f78dffa5a53be23954e950d77c47f9`
- `/private/tmp/cx-day136-sekcje-inicjatywy-artefakty/day136-realdb-final2.json`
  — SHA-256 `e61f99e14e5c5bde30932ca492c5d617c8ad3640340dfb79347857e7e865389e`
- `/private/tmp/cx-day136-sekcje-inicjatywy-artefakty/migrate-1.log`
  — SHA-256 `31b506f9e4c76da71e8457b9afb35ae1c4173c0940d1015820ceacc56097b4b3`
- `/private/tmp/cx-day136-sekcje-inicjatywy-artefakty/migrate-2.log`
  — SHA-256 `eda85a0033d87f60f7c85afd88cec67dadaa1038907dd853935e5eb8c865f1b7`

## TWIERDZENIA NIEZWERYFIKOWANE

1. Nie wykonano zrzutów w pełnym runtime ani dowodu browserowego; osiągalność
   ekranu jest dowiedziona kontraktem renderu/branchy, nie kliknięciem w UI.
2. Nie udowodniono mutacji RAID, ponieważ realny Gateway ją blokuje. Nie wiadomo,
   jaki dokładnie endpoint/payload Runtime-v1 ma zastąpić legacy trasę dla tego
   widżetu.
3. Nie mierzono aktualizacji istniejącego interesariusza, bo backend udostępnia
   tylko GET/POST/DELETE, a `onUpdate` komponentu pozostaje lokalny.
4. Nie uruchomiono pełnego repozytoryjnego typecheck/lintu jako bramki akceptacji;
   plik ekranu ma liczne zastane ostrzeżenia i import-sort. Nowe dwa pliki testowe
   przeszły ESLint, `git diff --check` był czysty.
