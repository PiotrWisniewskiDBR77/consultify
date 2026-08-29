# Dyżur 125 — neutralny pstryczek „Model”

Data: `2026-08-29`  
Marker produktu: `714faf5f8b0d9cda8204fec9495893c9fe97bed7`  
Gałąź: `codex/day125-crimson-20260829`  
Commit rdzenia: `dbccc2aa1c`  
Stan: `FIXED_LOCAL_BROWSER / MUTATION_PROOF_PASS / OWNER_RETEST_PENDING`

## 0. Wejście i korekty wobec instrukcji

Wynik markera i sanity, dosłownie:

```text
6144dae333 docs(day125-129): FALA PRZEKROJOWA — jedna wada, wszystkie moduly naraz
714faf5f8b merge: dyzur 121 — karta zbudowana za flaga OFF; endpoint nie propaguje checklisty
MARKER OK
714faf5f8b0d9cda8204fec9495893c9fe97bed7
```

Tip uciekł o jeden commit `6144dae333`, zawierający wyłącznie pięć instrukcji
dyżurów 125–129. Worktree powstał dokładnie z markera; bez rebase i bez merge.
Dysk: `71 GiB` wolne. Porty `6008`, `4916`, `4917`: `3/3` wolne przed startem.

Korekta proceduralna: przed poznaniem Z5 równoległa komenda wykonała
`git status --short --branch` w katalogu właściciela. Nie zapisano tam żadnego
pliku. Po odczycie instrukcji nie było dalszego kontaktu poza dozwolonym
symlinkiem `node_modules`. §0.5 nie klasyfikuje Z5 jako przesłanki zatrzymania
całego dyżuru, dlatego praca była kontynuowana i naruszenie nie jest ukryte.

Instrukcja odwołuje się do `§0.4a`, którego wydany dokument nie zawiera.
Zastosowano bezpieczniejszą komendę pełnego `tests/unit` wskazaną w §0.2c(C).

## 1. Własny pomiar przed zmianą

- Komponent: `src/components/LLMSelector.tsx` — ten plik został imiennie
  zakwalifikowany do zapisu przed zmianą na podstawie §D.
- Źródło crimson: gałąź `isUnavailable` w klasach przycisku, tokeny
  `bg-danger-*` i `border-danger-*`; nie `primary-*`.
- Zasięg statyczny: `65/65` miejsc osadzenia wspólnej powłoki `MainLayout`
  (`64` w `src/routes/AppRoutes.tsx` i `1` w
  `src/components/CaseWorkspace/CaseWorkspaceRoute.tsx`) dziedziczy jedno
  osadzenie `LLMSelector` z `MainLayout`. Dodatkowe `1/1` osadzenie selektora
  istnieje w `ChatOverlay`.
- To jest mianownik miejsc kompozycji powłoki, nie liczba unikalnych URL-i:
  część miejsc obsługuje trasy dynamiczne. Nie przepisano liczby `53` ze
  zlecenia i nie odtworzono korpusu `53` źródłowych zrzutów recenzentów.
- W realnym runtime tytuł selektora brzmiał `AI currently unavailable`, a jego
  klasa obejmowała crimson całej powierzchni. Zrzuty przed potwierdzają defekt
  w `2/2` motywach.
- Czerwone ikony Partnera i znak zapytania nie pochodzą z klasy powierzchni
  `LLMSelector`; zgodnie z §A zgłoszono je osobno i nie zmieniono.

Weryfikacja wejściowa: seeder Results wymaga co najmniej `800` migracji;
lokalna baza miała `863`. G00–G20 Results przed dyżurem: G14–G20 były
`NOT_STARTED`, G06 `PARTIAL_DESKTOP_LOCAL`.

## 2. Zmiana

Zmiana jest jednoliniowa: niedostępność nie maluje już całej powierzchni
przycisku na czerwono. Powierzchnia używa neutralnych klas slate/navy.
Semantyka krytyczna pozostała bez zmian:

- czerwona kropka `bg-danger-500` nadal sygnalizuje niedostępność;
- czerwony komunikat `text-danger-*` nadal pojawia się po otwarciu selektora;
- tytuł `AI currently unavailable` pozostał prawdziwy;
- stan aktywny/otwarty nadal ma osobne neutralne tło i niebieski `c-info`.

Nie zmieniono tokenów globalnych, flag, bramek, kart N ani backendu.

## 3. Dowód mutacyjny w obie strony

Komenda zielona po naprawie:

```bash
RUN_DB_TESTS=0 MOCK_DB=true npx vitest run \
  tests/unit/components/LLMSelectorCrimson.contract.test.ts --retry=0
```

Wynik: `1/1 PASS`.

Mutacja przywróciła dokładnie zastane klasy crimson powierzchni. Ta sama
komenda dała:

```text
1 failed (1)
expected ... to contain 'bg-slate-50 ... border-slate-300 ...'
MUTATION_EXIT=1
```

Kod produkcyjny przywrócono przez `cp` z kopii w
`/private/tmp/cx-day125-crimson-scratch`. Ponowny przebieg: `1/1 PASS`.
Porównanie przywróconego pliku z kopią zieloną: `RESTORE_DIFF_EXIT=0`.

Test nie jest tautologią: przy dokładnym powrocie klasy crimson przechodzi z
zielonego na czerwony, a jednocześnie wymaga zachowania czerwonej kropki i
czerwonego komunikatu awarii.

Pułapki §0.2d(a)–(e): pakiet jest czysto źródłowym kontraktem jednostkowym;
nie montuje Gateway, nie uruchamia DB, nie dotyka bramek V8/beta/auth i nie
mierzy propa z CardFloatingToolbar. `RUN_DB_TESTS=0 MOCK_DB=true` wyklucza
fałszywy dowód egzekucji; dowodem egzekucji UI są osobno realny runtime i
zrzuty.

## 4. Regresja po pełnych nazwach

Pięć istniejących pakietów powłoki przed i po: `16/16 PASS`; pliki TSV z
`fullName + status` mają identyczny SHA-256
`79e465dec2a3b75453cf953c53bcea19bcd74f41c0e21df8d6f2205713e18cef`.
Delta nazw: `0/16`.

Pełny `tests/unit --retry=0`: `17 091/17 306 PASS`, `19 FAIL`, `185 pending`,
`11 todo`; `6423` suit, z czego `6403 PASS`, `20 FAIL`. Nie jest to zielony
pakiet. Wszystkie `19/19` nazwanych porażek leżą poza zmienionym komponentem;
nowy kontrakt jest PASS. Czerwone grupy: no-dotenv `1`, PPTX layout `2`,
runtime guards `8`, discovery gate `1` (13 zastanych niesklasyfikowanych
plików), Gateway stub routes `4`, settings/SUPERADMIN `3`.

`prettier --check` dla `2/2` zmienionych plików: PASS. `git diff --check`:
PASS. Hooki commita: list-canon, artefakt, triada i gęstość bez nowych
naruszeń; kart N nie zmieniono.

## 5. Runtime, baza i zero wysyłki

Lokalny `pgvector/pgvector:pg16`, kontener `cx-day125-pg`, baza
`consultify_w3_results_owner_day125`, port `6008`. Pierwszy przebieg migracji:
`Postgres migrations complete`; drugi: `Applying migrations: 0`; odczyt:
`863` udanych migracji.

Kanoniczny runtime przez `scripts/dev/start-wave3-owner-runtime.mjs` w trybie
`adopt-existing`: backend `4916`, frontend `4917`, health/readiness/frontend
`200/200/200`, oba stany migracji `ok`, marker klienta i SQL zweryfikowane,
auth bypass `false`, zakazane klucze nieobecne w `5/5` procesów.

Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Baza tego dyżuru nie
zawiera wierszy konfiguracji SMTP. Uruchomiłem `server/src/index.ts` wyłącznie
przez kanoniczny `scripts/dev/start-wave3-owner-runtime.mjs`, na lokalnej bazie
dyżuru, tylko w celu wykonania zrzutów. Zweryfikowałem środowisko procesu i log
serwera zgodnie z `§0.2b` (4). Żaden e-mail, zaproszenie kalendarzowe ani
powiadomienie zewnętrzne nie zostało wysłane.

Runtime uruchomił zastane drenaże lokalne, ale wszystkie mierzone kolejki i log
dostaw były puste `0/4`: `notification_outbox`, `rvn_platform_outbox`,
`case_workspace_event_outbox`, `notification_delivery_log`. Nie wykonano akcji
tworzącej wiadomość ani powiadomienie.

## 6. Zrzuty 4/4

Ten sam ekran `/results/kpi`, ta sama persona i dane, menu profilu zamknięte:

| Stan | Motyw | Plik | SHA-256 |
|---|---|---|---|
| przed | light | `/private/tmp/cx-day125-crimson-artefakty/day125-before-light.png` | `c61bbe2c90a4f90c34b1503927866a53de55e8a12e27c1282205925515ba368b` |
| przed | dark | `/private/tmp/cx-day125-crimson-artefakty/day125-before-dark.png` | `1d2dccdbc8d9f2c7d9fdf1e20359ba375b835ab4d99361a3255ac38a7b296e47` |
| po | light | `/private/tmp/cx-day125-crimson-artefakty/day125-after-light.png` | `a7cdc0c17224391dca7dd07660269f494cea8fe439dd15da3cb8a96bffc24b80` |
| po | dark | `/private/tmp/cx-day125-crimson-artefakty/day125-after-dark.png` | `0916817809b23e4ed372ec7b0b28e006d76b5a80f059e637d9f44cc40e003f73` |

Manifest runtime:
`/private/tmp/consultify-wave3-runtime-manifest-day125.json`, SHA-256
`131bcb78ab2d5aff3e10a684196dc29f1fc654311a3b679ecaa5e2eb8db38440`.

## 7. Kryteria i pliki

K1 PASS; K2 PASS; K3 PASS; K4 PASS dla mierzonego pakietu powłoki; K5 PASS
`4/4`; K6 PASS; K7 PASS `0` zmian kart N.

Sprzątanie: kontener `cx-day125-pg` usunięto z wolumenem. Kanoniczny `stop`
odmówił po commitach: najpierw aktualny checkout nie odpowiadał startowemu SHA,
a po podaniu aktualnego SHA stan runtime nie odpowiadał kandydatowi. Po dwóch
odmowach zweryfikowano zapisane w należącym do dyżuru `state.json` PID/PGID i
linie komend, następnie wysłano `TERM` wyłącznie do grup `25679` (backend) i
`25699` (frontend). Porty `6008`, `4916`, `4917`: `3/3` wolne po sprzątaniu.

Pliki zmienione względem markera:

```text
src/components/LLMSelector.tsx
tests/unit/components/LLMSelectorCrimson.contract.test.ts
docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY125_CRIMSON_REPORT.md
docs/program/waves/WAVE_03_ACCEPTANCE/modules/09_RESULTS/MODULE_ACCEPTANCE.md
```

## TWIERDZENIA NIEZWERYFIKOWANE

- Nie zweryfikowano korpusu `53/53` zrzutów recenzentów; nie był dostępny jako
  wskazany artefakt. Zweryfikowano wspólne źródło i własny mianownik statyczny.
- Nie udowodniono pełnej regresji produktu: pełny `tests/unit` pozostaje
  czerwony na `19/17 306` nazwanych przypadków.
- Nie wykonano owner acceptance, tabletu, mobile ani wszystkich unikalnych
  tras dynamicznych.
- Nie udowodniono, że dekoracyjne czerwienie Partnera i prawy znak zapytania są
  poprawne produktowo; udowodniono tylko, że nie pochodzą z naprawionej klasy.
- Nie ma autoryzacji do demo, produkcji, release ani zmiany statusu G18.
