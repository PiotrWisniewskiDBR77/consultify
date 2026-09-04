# CODEX DAY 330 — Wywiad: menu akcji

Data: 2026-09-04
Marker: `1c3d3da844ae03c87985a8f5dc74846a073c0220`

## Werdykt

`PARTIAL`. R2 (szósty konsument + efekt pięciu dedykowanych footerów), R3 (literał kroku 2) i R4 (niezależne 43×2) wykonano. R1 zastano w kodzie z dyżuru 292 i nie duplikowano. R5 nie spełnia DoD sześciu typów; R6 raportuje ten brak bez zawyżenia.

## R0 — baza i sanity

Wynik markera, dosłownie:

```text
MARKER OK
```

Wynik sanity nowego worktree, dosłownie:

```text
1c3d3da844ae03c87985a8f5dc74846a073c0220
```

`status --short` był pusty. Dysk: 43 GiB wolne. Porty `6356` i `5496` oraz kontener `cx-day330*` były wolne. Tip `github-backup/grafika/m03-20260902` wyprzedza marker o 9 commitów; nie wykonano rebase.

Worktree 292 był czysty, na gałęzi `codex/day292-wywiad-menu-akcji-20260903`, HEAD `73c03f41a221d3187fb45e8d94437592c9ff8c89`, z dokładnie dwoma commitami nad `58ef0771d7`:

```text
73c03f41a2 feat(interview): unify action matrix across row and preview
aa8fdcc8bd docs(interview): zmierz macierz akcji przed zmianami
```

Potwierdzono: 0 trafień `InsightViewer` w kontrakcie, 5 plików na starej liście, realny import `interviewActionMeta` w `InterviewInsightPreview.tsx`, surowe ` *` w kroku 2. Rejestr 43×2 nie istnieje na bazie 292, ale istnieje na markerze 330 i ma starszy marker `bc18bc7a...`.

## R1 — Sesje i Szablony

`VERIFIED_EXISTING / PARTIAL DoD`. Commit 292 `73c03f41a2` już zawiera macierz oraz realne callbacki hosta przekazywane do footerów Sesji i Szablonów przez `additionalActions`. Nie dodano duplikatów, nowych tras ani kluczy i18n. Pełny wizualny DoD tych typów nie został osiągnięty w R5.

## R2 — Skrzynka, Wnioski, Inicjatywy i szósty konsument

Commit `01e9c84e18` na kontynuowanej gałęzi 292:

- dopisano `InterviewInsightPreview.tsx` jako szóstego konsumenta;
- dodano test runtime klikający akcję z SSOT w pięciu dedykowanych footerach i sprawdzający wywołanie callbacku;
- GREEN przed mutacją: 5/5;
- mutacja `InterviewInsightPreview.onFork → no-op`: 4/5, exit 1;
- przywrócenie przez `cp`: 5/5, exit 0; diff produkcyjnego pliku pusty;
- `initiativeRecordCanon`: 6/6; `PreviewActionBar.ownerBehavior`: 2/2.

Host kebaba jest nadal sprawdzany statycznie jako konsument SSOT, nie klikowym testem efektu. Dlatego dowód całej szóstki powierzchni jest `PARTIAL`, mimo pełnego efektu pięciu footerów.

## R3 — literał wymagania

Commit `f5ed589aa9` na gałęzi 292. Wyłącznie linia kroku 2 została zmieniona z surowego ` *` na `requiredMarker` w neutralnym `<span>`. Grep surowego wzorca: 0. Esbuild pliku: PASS.

Istniejący `InsightCreatorModal.a11y.test.tsx` nie ma asercji pola sesji źródłowych. Ujawnił za to zastaną czerwień 8/12: cztery asercje nadal oczekują `Insight Title *` / `Tytuł wniosków *`, podczas gdy wcześniejsza zmiana produktu już renderuje `(required)` / `(wymagane)`. Testu nie zmieniono — nie był objęty licencją plikową R3.

## R4 — niezależne 43×2

Commit dokumentacyjny `101b167a37` na gałęzi 330. Przejrzano 43/43 punkty i 86 rozstrzygnięć na markerze 330: kod obu kreatorów, wspólną powłokę i 16 PNG. Pełny zapis: `/private/tmp/cx-day330-wywiad-menu-akcji-artefakty/rejestr-weryfikacja.md`.

Korekta: tabela oznacza `✗` także punkt 39. Czerwonych numerów jest 6 (`31,32,39,40,41,43`), nie 5 z Werdyktu. Punkt 39 potwierdza `InitiativeWizardModal.tsx:2575` (`#8b5cf6`).

## R5 — dowód wizualny

`PARTIAL / NOT_ACCEPTED`. Kanoniczne narzędzie zapisało 8 PNG dla Sesji i Inicjatywy: PL 1440 + EN 1024, light/dark. Każdy zapis ma 0 błędów konsoli, 0 HTTP errors i pustą listę naruszeń axe. Narzędzie zwróciło jednak `exit 1`: overflow `Więcej akcji / More actions` pozostał zwinięty, a domyślny selektor nie znalazł wiersza. Status każdego pomiaru to `wynik BRAK`, więc obrazów nie zaliczono jako odbiorowych.

Nie wykonano kompletnego przelotu Przydziału, Skrzynki, Szablonu i Wniosku. G06 ma ogólne ekrany, lecz nie ma dedykowanej sześciotypowej macierzy wymaganej przez instrukcję. Nie improwizowano harnessu poza licencją.

## Zasięg testów po nazwach

PRZED: 4 pełne nazwy. PO: te same 4 oraz jedna dodana:

```text
Interview action matrix contract dispatches the matrix-backed action from every dedicated preview footer
```

Nazwy zniknięte: brak. Pliki: `/private/tmp/cx-day330-wywiad-menu-akcji-artefakty/przed-nazwy.txt` i `po-nazwy.txt`.

## Korekty wobec instrukcji

1. §0.1 nakazuje nowy worktree `/private/tmp/cx-day330-wywiad-menu-akcji` i nową gałąź, ale Z40/B.4 nakazuje reużyć worktree oraz gałąź 292. Bezpieczna interpretacja: kod R2/R3 i „Stan PO” kontynuowano na czystej gałęzi 292; raport i dopisek 43×2 powstały na własnej gałęzi 330. Żadnego rebase ani kopiowania WIP.
2. R4 wymaga dopisku do rejestru 43×2, który nie istnieje na bazie gałęzi 292. Weryfikację wykonano na markerze 330, gdzie dokument istnieje.
3. Werdykt rejestru mówi o 5 czerwonych punktach, ale tabela ma 6; pominięto punkt 39.
4. §0.2c zawiera syntaktycznie zagnieżdżoną, niewykonalną komendę `npx vitest run npx vitest run ...`. Użyto realnej komendy jednostkowej z `RUN_DB_TESTS=0 MOCK_DB=true` i `--retry=0`.
5. R5 odsyła do nieistniejącego w instrukcji `§0.2e`; użyto flag wymienionych w pułapce (5) §0.2d.

## Baza i bezpieczeństwo wysyłki

Obraz `pgvector/pgvector:pg16`, baza `cx330`, port `127.0.0.1:6356`. Pierwszy przebieg pełnych migracji: PASS; drugi: `Applying migrations: 0`, PASS. Tabela `settings`: 0 wierszy `smtp%`.

Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Baza tego dyżuru nie zawiera wierszy konfiguracji SMTP. Nie uruchomiłem `server/src/index.ts` ani żadnego drenażu outboxu. Żaden e-mail ani zaproszenie kalendarzowe nie zostało wysłane.

Uruchomiono tylko Vite dev-render na `127.0.0.1:5496` do lokalnych zrzutów.

## Artefakty i sumy

- `przed.json`: `a41b8057baecc13eeffa092dd200f1d8f79ee333c6847837bf544e1749f7da72`
- `po.json`: `96b4682c3abda0aa5e8443430ce2278ed643919e609e85cf90f65839d8f1c1a2`
- `r2-mutation-red.json`: `c06a3972af0b5441534d960192523842de6bac807ff9890027782d9d37ca1bd4`
- `r2-restored-green.json`: `29cce5096e76652eb896ad364fc47beb36ab9c82f84c5cac7e551ca7c7b559d4`
- `rejestr-weryfikacja.md`: `3adb0cbe34ace279a34ba7f92a9be1952d4601b70358a9a7b98aa7f1f2b2b1aa`
- `r4-contact-sheet.jpg`: `14e7b61cbd2825ee3267658a8ab115af48ec7b82cc96f06498409d22746a244a`

## Commity i gałęzie

- `codex/day292-wywiad-menu-akcji-20260903`: `f5ed589aa9` (R3), `01e9c84e18` (R2), `a08b4fc623` (Stan PO).
- `codex/day330-wywiad-menu-akcji-20260904`: `101b167a37` (R4) oraz commit tego raportu.

## TWIERDZENIA NIEZWERYFIKOWANE

- Nie udowodniono klikowego efektu kebaba hosta `InterviewHub` dla wszystkich sześciu typów.
- Nie uzyskano zaakceptowanego zestawu 24 kadrów sześciu typów ani pełnej listy czekowania części B per typ.
- Nie zmierzono działania na produkcyjnym HTTP ani wdrożeniu; dyżur był frontowy i lokalny.
- Nie potwierdzono akceptu właściciela ani integracji obu gałęzi przez nadzorcę.
