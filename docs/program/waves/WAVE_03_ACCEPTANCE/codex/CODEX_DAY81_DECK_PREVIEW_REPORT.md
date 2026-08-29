# Dyżur 81 — podgląd decku w Materiałach

Data: 2026-08-29  
Marker: `f6032bdaaa52469871e1010190c40d62261b8113`  
Gałąź: `codex/day81-deck-preview-20260829`  
Worktree: `/private/tmp/cx-day81-deck-preview`  
Artefakty: `/private/tmp/cx-day81-deck-preview-artefakty`  
Werdykt: `FIXED_SELF_QA / OWNER_RETEST_PENDING`

Jedyna zmiana produktu usuwa `h-full` z paska dolnego. Poza Artifact Studio canvas
zmienił się z `487×0` na `487×584`; w Artifact Studio ma `904×532`. Cztery slajdy
są widoczne w obu motywach. Pozostałych siedmiu defektów Materiałów nie ruszono.

## §0.1 — baza, marker i sanity

`df -h /` pokazało `84Gi` wolnego miejsca, powyżej wymaganego minimum `5 GB`.

Wynik komendy (2), dosłownie:

```text
972a68e723 docs(instrukcje): dyzury 79/80/81 — pierwsze NAPRAWCZE, na podstawie diagnoz z 76/77/78
f6032bdaaa docs(ledger): DEC-299..302 — petla Word dziala, grafika PPT 7/18, komplet przyczyn, defekt #4 zdiagnozowany
795b85dcc4 merge: dyzur 76 — diagnoza defektu #4: DeckBuilderBottomBar h-full, canvas 487x0px
149ebcab97 merge: dyzur 78 — rubryka PPT 7 z 18 przy minimum 15, przyczyny plik:linia
c58ce527cb merge: dyzur 77 — petla: Word DZIALA, PPT blokuje 403 TEMPLATE_FORBIDDEN
a5e3cefaa4 docs(day78): clarify push proof
d443a933a2 docs(day77): report template document loop
15eea05166 docs(day78): record final isolation proof
52daf0feea docs(day78): measure PPT decks with quality rubric
e00611d6ef docs(acceptance): diagnose day76 presentation blank canvas
37c6963032 docs(instrukcje): dyzur 77 (petla szablon->dokument) i 78 (pomiar rubryki PPT)
30db156575 docs(ledger): DEC-294..298 — EV UJEMNE dla CD Projekt, 4 seedery, Materialy 8/8 defektow, klasa A 418/418
c638b3dba4 merge: dyzur 76 — Materialy 20/20, 8/8 defektow nadal wystepuje
f926fa4455 merge: dyzur 75 — 4/4 seedery, max 2 linie na plik
fb0ad6c6f5 merge: dyzur 74 — DOWOD MERYTORYCZNY: liczby z wnetrz, EV ujemne
d502af3094 merge: dyzur 69 checkpoint — klasa A 418/418, klasa F 57/57
3d2cb04d79 docs(day76): record Materials owner evidence matrix
98bf02b2aa docs(day75): report migration counter repair
019a68a00d fix(i18n): domknij klucze obszarow C1
cdf73ad82e fix(assessment): retain migration floor
4bad64f3cd fix(initiatives): retain migration floor
a155dcc732 docs(finance): add day74 material proof
1e73b81a8f fix(my-work): accept current migration ledger
d222a05e68 fix(assessment): report current migration ledger
c89ef169cf fix(initiatives): report current migration ledger
MARKER OK
```

Wynik komendy (7), dosłownie:

```text
f6032bdaaa52469871e1010190c40d62261b8113
```

`git status --short | head -3` nie wypisał żadnej linii. Krok §0.1(4) wypisał:

```text
[core]
	bare = false
```

Tip gałęzi bazowej uciekł o jeden commit. Praca pozostała dokładnie na markerze:

```text
972a68e723 docs(instrukcje): dyzury 79/80/81 — pierwsze NAPRAWCZE, na podstawie diagnoz z 76/77/78
docs/program/waves/WAVE_03_ACCEPTANCE/codex/INSTRUKCJA_DYZUR_79_PPT_LAYOUT.md
docs/program/waves/WAVE_03_ACCEPTANCE/codex/INSTRUKCJA_DYZUR_80_CYKL_SZABLONU.md
docs/program/waves/WAVE_03_ACCEPTANCE/codex/INSTRUKCJA_DYZUR_81_PODGLAD_DECKU.md
```

Porty `5953` i `4750`: `0 z 2` zajętych.

## Stan wejściowy i minimalna naprawa

Trzy obowiązkowe odczyty potwierdziły:

- `DeckBuilderBottomBar.tsx`: `h-full w-full ... flex-shrink-0`;
- `DeckBuilderMelsView.tsx`: pasek jako rodzeństwo głównej części wyłącznie poza Artifact Studio;
- `CardCanvas.tsx:91`: `flex-1 overflow-hidden`.

Realny DOM przed zmianą: root `1184×672`, `main[data-testid="mels-canvas"]`
`487×0`, cztery kontrolki slajdów. Zmieniono jedną linię:

```diff
-    <div className="h-full w-full bg-c-surface flex items-center gap-4 flex-shrink-0">
+    <div className="w-full bg-c-surface flex items-center gap-4 flex-shrink-0">
```

`git diff --numstat`: `1  1  src/components/Presentations/DeckBuilder/DeckBuilderBottomBar.tsx`.
Commit produktu: `7e7e160929`.

## Lokalny runtime, baza i auth

- kontener: `cx-day81-pg`, `pgvector/pgvector:pg16`, wyłącznie `127.0.0.1:5953`;
- pierwszy migrator: `✅ Postgres migrations complete`;
- drugi migrator: `Applying migrations: 0`, `✅ Postgres migrations complete`;
- runtime: server `4750`, client `4751`, health/ready/frontend `200/200/200`;
- SHA runtime i klienta: `f6032bdaaa52469871e1010190c40d62261b8113`;
- baza runtime: `consultify_w3_runtime_day81`, `863` migracje;
- `ENABLE_TEST_AUTH_BYPASS=false`, dotenv server/client odcięty, zabronione klucze nieobecne;
- seeder Materiałów: readback `10 z 10` oczekiwanych pól;
- persona OWNER zalogowała się prawdziwym formularzem i endpointem auth; deck otworzył się pod
  `/presentations/builder/b1160000-0000-4000-8000-000000000001`.

### Z30 — zero wysyłki

```text
BRAK ZMIENNYCH POCZTY
settings WHERE key LIKE 'smtp%': (0 rows)
Gateway.ts grep drenów: 0 trafień
```

Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Baza tego dyżuru nie
zawiera wierszy konfiguracji SMTP. Nie uruchomiłem ręcznie `server/src/index.ts`
ani żadnego drenażu outboxu; nakazany runtime uruchomił własny proces z
`DISABLE_SCHEDULER=true` i izolacją dotenv. Żaden e-mail ani zaproszenie
kalendarzowe nie zostało wysłane.

## Dowód wzrokowy i pomiary

Mianownik: `3 stany × 2 motywy = 6 z 6` zrzutów.

| Stan | Motyw | Canvas | Slajdy | Artefakt i SHA-256 |
| --- | --- | ---: | ---: | --- |
| PRZED, poza Artifact Studio | ciemny | `487×0` | `4` w DOM, niewidoczne | `day81-before-dark.png` — `81a2befe373ad994921703f6dc0a39751996503d96670bd4abc8b11696f7d5e3` |
| PRZED, poza Artifact Studio | jasny | `487×0` | `4` w DOM, niewidoczne | `day81-before-light.png` — `e529b9b1cc5e8414db59a7b277086a44f5f46e2657fd73574816d3722cab89de` |
| PO, poza Artifact Studio | ciemny | `487×584` | `4` widoczne | `day81-after-dark.png` — `671dd53baf010d32d53fdeda273b5ce5712d312681c25d998f10fd8e5ad7b2c1` |
| PO, poza Artifact Studio | jasny | `487×584` | `4` widoczne | `day81-after-light.png` — `b070b57321a9f02ec96da97a7c32252f229639547ca96b4042eacc439eae830b` |
| PO, Artifact Studio | ciemny | `904×532` | `4` widoczne | `day81-artifact-after-dark.png` — `62944a7533ee228b4145c8b0d6652af1e68ba137cfdc28c0f9ae7d56bf759237` |
| PO, Artifact Studio | jasny | `904×532` | `4` widoczne | `day81-artifact-after-light.png` — `e26eb4d7986263654bb57fcce899bdacb42fae035d7766fc34b203689145a5fe` |

Artifact Studio potwierdzono przez `data-artifact-studio=true`; lokalnie użyto
istniejących parametrów rolloutowych `ff_artifactStudio=1` i
`ff_presentationStudioV2=1`, bez zmiany ich wartości domyślnych.

## Dowód mutacyjny Z32

Poprawioną wersję odłożono przez `cp` do
`/private/tmp/cx-day81-deck-preview-scratch/DeckBuilderBottomBar.fixed.tsx`.

1. Po przywróceniu `h-full`: `git diff --exit-code` był pusty (`MUTACJA: git diff PUSTY`),
   Artifact Studio `false`, canvas `487×0`, slajdy `4` w DOM.
2. Po odtworzeniu poprawki przez `cp`: `git diff --numstat` ponownie `1 1`,
   Artifact Studio `false`, canvas `487×584`, slajdy `4` widoczne.

To wiąże zmianę wysokości bezpośrednio z jedyną zmienioną klasą.

## Testy i build

Pakiet jednostkowy uruchomiono przed i po zmianie z
`RUN_DB_TESTS=0 MOCK_DB=true --retry=0`, reporter JSON poza repo. Pułapki
Z33 (a)–(d) nie leżą na ścieżce: pakiet renderuje adapter komponentu i nie
montuje Gateway, auth, visibility middleware ani bazy. Pułapka (e) jest
bezpośrednim przedmiotem pakietu: zawiera osobne przypadki rollout OFF i Artifact Studio.

Dokładne `fullName`, przed i po — wszystkie `passed`:

```text
DeckBuilderMelsView Artifact Studio adapter keeps the legacy Teresa chip and external bottom bar when the rollout is off
DeckBuilderMelsView Artifact Studio adapter merges QA and governance under one canonical Artifact Studio destination
DeckBuilderMelsView Artifact Studio adapter removes the fixed Teresa chip and mounts Teresa plus bottom bar in the shared shell
DeckBuilderMelsView Artifact Studio adapter uses one Present split button for audience and presenter modes
```

Lista „zielony przed / czerwony po": pusta. Pliki pełnych nazw mają identyczny SHA-256
`71ff879f2a79bcefb7f833b9327462006e996a6c618e581491e4b7584114d3e0`.

Frontend build: `PASS`, końcówka `✓ built in 1m 2s`. Ostrzeżenia Browserslist,
CSS oraz rozmiaru chunków nie są błędami i nie zostały naprawiane poza zakresem.

## Korekty wobec instrukcji

1. §0.2b zabrania uruchamiać pełny `server/src/index.ts`, natomiast §B.2 nakazuje
   `scripts/dev/start-wave3-owner-runtime.mjs`; skrypt w tej wersji uruchamia właśnie
   `server/src/index.ts`. Wybrano jawnie zamówiony runtime, który wymusza
   `DISABLE_SCHEDULER=true`, odcina dotenv i nie ma konfiguracji SMTP. Konfliktu nie
   rozwiązano zmianą produktu.
2. Z10 wskazuje jako jawny wyjątek URL tylko `ff_templateBuilder=1`, podczas gdy §B.1/B.2
   wymagają sprawdzenia Artifact Studio. Do samego lokalnego pomiaru użyto istniejących
   flag Artifact Studio w URL, bez zmiany kodu ani defaultów; inaczej K3 byłoby
   nieweryfikowalne.

## Zakres końcowy

Zmodyfikowane pliki:

- `src/components/Presentations/DeckBuilder/DeckBuilderBottomBar.tsx`;
- `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY81_DECK_PREVIEW_REPORT.md`;
- `docs/program/waves/WAVE_03_ACCEPTANCE/modules/11_MATERIALS/MODULE_ACCEPTANCE.md`.

Nie zmieniono tras, flag, lokalizacji, infrastruktury testowej, pozostałych siedmiu
defektów ani katalogu właściciela. Stan odbioru właściciela: `PENDING`.
