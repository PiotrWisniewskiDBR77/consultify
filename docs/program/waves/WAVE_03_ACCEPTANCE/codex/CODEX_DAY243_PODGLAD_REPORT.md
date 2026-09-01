# CODEX DAY 243 — PODGLĄD — RAPORT

Data: 2026-09-01  
Gałąź: `codex/day243-podglad-20260901`  
Baza pracy: marker `df7f13056f`

## Streszczenie

Rdzeń R1–R4 wykonano. Mechaniczny pomiar potwierdził, że kanoniczny `StandardPreview` nie ma pozycjonowania nakładkowego. W próbce 15 desktopowych ekranów wszystkie faktycznie montują `StandardPreview` albo `TableWithPreviewLayout` w domyślnym trybie bocznym. Kontrola dodatnia istnieje: `TableWithPreviewLayout` ma mobilną nakładkę `fixed inset-0 z-[70]` oraz opcjonalną desktopową nakładkę `absolute ... z-40`.

Do części B kanonu dopisano addytywny protokół B.11. Powstał wielokrotnego użytku skrypt `scripts/dev/click-then-shoot.mjs` i test kontraktu. Skrypt uruchomiono na realnych komponentach `StandardModuleBar` + `StandardTable` + `StandardPreview` w istniejącym harnessie `drd-library-entry`; przed kliknięciem podglądu nie ma, po kliknięciu tabela i otwarty panel są widoczne razem w light i dark.

Nie oceniano poprawności merytorycznej danych w panelu i nie wykonywano backfillu istniejących zrzutów.

## Stan wejściowy

Wynik markera, dosłownie:

```text
MARKER OK
```

Sanity worktree, dosłownie:

```text
df7f13056fa24995be07f64b0e8c877b3faeab45
```

`git status --short | head -3` nie zwrócił żadnej linii.

Tip bazowej gałęzi był o dwa commity przed markerem:

```text
818e9cec0b SCIEZKA WYJSCIA v2: zamykanie modulow staje sie torem ROWNOLEGLYM, nie ostatnim krokiem; rozdzielenie BLOKUJE/NIE BLOKUJE/CZEKA; 3 dyzury blokujace zamiast 56-91; brak daty konca do pierwszej partii werdyktow
fdac443d4d 242/243/244: marker podniesiony
```

Zmiana nazw plików w rozjeździe:

```text
docs/program/SCIEZKA_WYJSCIA_V2.md
docs/program/waves/WAVE_03_ACCEPTANCE/codex/INSTRUKCJA_DYZUR_242_UPRAWNIENIA.md
docs/program/waves/WAVE_03_ACCEPTANCE/codex/INSTRUKCJA_DYZUR_242_UPRAWNIENIA.wklejka.txt
docs/program/waves/WAVE_03_ACCEPTANCE/codex/INSTRUKCJA_DYZUR_243_PODGLAD.md
docs/program/waves/WAVE_03_ACCEPTANCE/codex/INSTRUKCJA_DYZUR_243_PODGLAD.wklejka.txt
docs/program/waves/WAVE_03_ACCEPTANCE/codex/INSTRUKCJA_DYZUR_244_ORGANIZACJA_USTAWIENIA.md
docs/program/waves/WAVE_03_ACCEPTANCE/codex/INSTRUKCJA_DYZUR_244_ORGANIZACJA_USTAWIENIA.wklejka.txt
```

Pracę rozpoczęto dokładnie z markera, bez rebase. Porty 6223, 5198 i 5199 były wolne. Przed startem było 10 GiB wolnego miejsca; po migracjach 5,9 GiB, nadal powyżej progu STOP 5 GiB.

Lokalny kontener `cx-day243-pg` na `127.0.0.1:6223` otrzymał pełne migracje; pierwszy przebieg zakończył się `✅ Postgres migrations complete`, drugi wykazał `Applying migrations: 0` i również zakończył się poprawnie.

Dowód Z30:

```text
BRAK ZMIENNYCH POCZTY
 key | left
-----+------
(0 rows)
```

Grep drenaży w `server/src/Gateway.ts` zwrócił zero trafień. Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Baza tego dyżuru nie zawiera wierszy konfiguracji SMTP. Nie uruchomiłem `server/src/index.ts` ani żadnego drenażu outboxu. Żaden e-mail ani zaproszenie kalendarzowe nie zostało wysłane.

Pełny log wejściowy: `/private/tmp/cx-day243-podglad-artefakty/stan-wejsciowy.log`.

## R1 — klasyfikacja panel boczny / nakładka

### Metoda i kontrole

- Kontrola ujemna: grep `fixed|absolute|inset-0|z-50|z-[` w `src/components/standard/StandardPreview.tsx` dał zero trafień.
- Kontrola dodatnia nr 1: `src/components/shared/TableWithPreviewLayout.tsx:479` i `:518` montują mobilny `fixed inset-0 z-[70]` z `data-preview-pane`.
- Kontrola dodatnia nr 2: `src/components/shared/TableWithPreviewLayout.tsx:431` montuje opcjonalny desktopowy wrapper `absolute inset-y-0 right-0 z-40`, gdy `desktopPreviewOverlay=true`.
- Domyślny desktopowy `TableWithPreviewLayout` ma `desktopPreviewOverlay=false` (`src/components/shared/TableWithPreviewLayout.tsx:116-129`), więc bez jawnego propu podgląd jest rodzeństwem flex, nie nakładką.
- Kanoniczny wrapper boczny renderuje semantyczne `<aside data-preview-pane>` bez klas pozycjonowania (`src/components/shared/PreviewPane/PreviewPaneAside.tsx:49-55`).
- Własny pomiar `rg -l "StandardPreview|PreviewPane" src --glob '!**/__tests__/**'` dał 144 pliki, nie liczbę 86 z instrukcji.

Klasyfikacja dotyczy desktopu, czyli formatu zrzutów 1440×900. Mobile w `TableWithPreviewLayout` jest mechanicznie nakładką i według B.11 wymaga czterech kadrów.

| Ekran/moduł | Faktyczny komponent | Klasyfikacja desktop | Dowód montażu |
|---|---|---|---|
| Report Builder — Templates | `StandardPreview` | panel boczny | `src/components/ReportBuilder/TemplatesManager.tsx:692` |
| My Work — Projects | `StandardPreview` | panel boczny | `src/components/MyWork/MyProjects.tsx:885` |
| Case Workspace — Realizacja | `StandardPreview` | panel boczny | `src/components/CaseWorkspace/RealizacjaView.tsx:1531` |
| Assessment Hub | `PreviewPaneAside` + `StandardPreview` | panel boczny | `src/components/assessment/AssessmentHub.tsx:2207-2208` |
| Audit Hub | `StandardPreview` | panel boczny | `src/components/Audit/AuditsHub.tsx:856` |
| Finance — Statements | `TableWithPreviewLayout` + `StandardPreview` | panel boczny, domyślny desktop | `src/components/Economics/FinanceHub.tsx:2823,2850` |
| Reports — Outputs | `StandardPreview` | panel boczny | `src/components/ReportsAndPresentations/OutputsAggregateTabContent.tsx:1256` |
| Initiatives — register | `TableWithPreviewLayout` + `StandardPreview` | panel boczny, domyślny desktop | `src/components/Initiatives/CanonicalInitiativeRegister.tsx:351` |
| Results Hub | `StandardPreview` | panel boczny | `src/components/Results/ResultsHub.tsx:1801` |
| Meetings Hub | `StandardPreview` | panel boczny | `src/components/Meeting/MeetingHub.tsx:964` |
| Execution Management | `StandardPreview` | panel boczny | `src/components/Execution/ExecutionManagementTable.tsx:165` |
| Interview — Sessions | `TableWithPreviewLayout` | panel boczny, domyślny desktop | `src/components/Interview/InterviewHub.tsx:6994` |
| SuperAdmin — Model Catalog | `StandardPreview` | panel boczny | `src/components/SuperAdmin/ModelRegistry/ModelCatalogTable.tsx:851` |
| Vault — Documents | `StandardPreview` | panel boczny | `src/views/vault/VaultDocumentsView.tsx:1262` |
| SuperAdmin — Partner Settlements | `StandardPreview` | panel boczny | `src/views/superadmin/revenue/PartnerSettlementsView.tsx:914` |

Wynik próbki: 15/15 panel boczny na desktopie. Nie rozszerzam tego wyniku na wszystkie 144 pliki ani na mobile.

## R2 — protokół w kanonie

Commit: `f83323d7e0 docs(triada): require preview-open evidence screenshots`.

Do `docs/ui-standards/TRIADA_KANON.md` na końcu części B dodano wyłącznie podsekcję `B.11 — PROTOKÓŁ FOTOGRAFOWANIA PODGLĄDU`: dwa kadry po kliknięciu dla panelu bocznego, cztery tylko dla nakładki, mechaniczna klasyfikacja, reguła adnotacji starego archiwum i link do znaleziska. Numeracja i treść pozycji 1–43 nie zostały zmienione.

Dowód zakresu:

```text
git diff df7f13056f..f83323d7e0 -- docs/ui-standards/TRIADA_KANON.md
1 file changed, 7 insertions(+)
```

## R3 — klik → zrzut i dowód mutacyjny

Pliki:

- `scripts/dev/click-then-shoot.mjs`
- `scripts/dev/__tests__/click-then-shoot.test.mjs`

Commity: `867d8c332e` oraz czyszczenie kadru harnessu `f661f5c4be`.

Skrypt:

1. otwiera istniejący ekran `drd-library-entry` na portach 5198/5199;
2. czeka na pierwszy rzeczywisty wiersz `tbody tr`;
3. klika pierwszy wiersz;
4. czeka na widoczny selektor wyniku `[data-preview-pane]`, bez stałego sleep jako warunku gotowości;
5. odczytuje computed CSS `position`, `inset`, `zIndex` i klasyfikuje 2/4 kadry;
6. wykonuje light/dark, usuwa techniczny chrome harnessu i sprawdza light luma >150;
7. zapisuje manifest z obecnością podglądu i klasyfikacją.

Dowód mutacyjny:

| Tryb | Light | Dark | Werdykt |
|---|---:|---:|---|
| naiwny `before-click` | `previewVisible=false` | `previewVisible=false` | kadr nie zawiera podglądu |
| poprawny `after-click` | `previewVisible=true` | `previewVisible=true` | kadr zawiera tabelę i podgląd |

Computed CSS po kliknięciu w obu motywach: `position=static`, `inset=auto`, `zIndex=auto`; klasyfikacja `side-panel`; wymagane `captureCountRequired=2`. Luma po końcowym czystym przebiegu: light `249.2`, dark `21.0`.

Załącznik dowodowy R2/R3:

- `/private/tmp/cx-day243-podglad-artefakty/drd-library-entry-po-kliknieciu-light.png` — SHA-256 `7c35f5ff49ed6f494f89b352513fd03da0b51e5b051894e26fe8e70132be6cd9`
- `/private/tmp/cx-day243-podglad-artefakty/drd-library-entry-po-kliknieciu-dark.png` — SHA-256 `726c3e7b491c44dd3a1e1e4d3ba4855ab24ae2f05f39eb881c5a0953e6fb727d`
- manifest po kliknięciu — SHA-256 `e6aea0a09c77a373d1aff99f7c93f33e6614fa191d8cbf899290af279937b51b`

Oba obrazy zostały przejrzane wzrokowo przez wykonawcę: każdy pokazuje jednocześnie tabelę i otwarty prawy panel. Jest to dowód montażu realnych współdzielonych komponentów z fixture harnessu; nie jest to dowód realnego API, backendu ani poprawności danych domenowych.

### Testy i pełne nazwy

Rootowy Vitest nie odkrywa `scripts/dev/__tests__/*.mjs`; pierwszy przebieg dał `success:false`, 0 suit i 0 testów mimo kodu wyjścia 0, więc nie został uznany za PASS. Zgodnie z istniejącą konwencją repo użyto natywnego `node --test`.

Komenda:

```bash
RUN_DB_TESTS=0 MOCK_DB=true node --test --test-reporter=spec scripts/dev/__tests__/click-then-shoot.test.mjs
```

Pełne nazwy po zmianie:

```text
click-then-shoot protocol > classifies the canonical static preview as a side panel
click-then-shoot protocol > uses a positive control to classify a fixed high-stack preview as an overlay
click-then-shoot protocol > rejects the naive before-click mutation when it accidentally contains preview
click-then-shoot protocol > rejects capture when preview is absent after row click
click-then-shoot protocol > accepts capture only after the preview selector is visible
```

Wynik: 5 pass, 0 fail, 0 skipped. Pakiet jest czysto jednostkowy; nie otwiera bazy, nie montuje `ApiGateway`, nie dotyka auth ani wyników. Pułapki Z33 (a)–(d) nie leżą na jego ścieżce; pułapka (e) jest przedmiotem testu (klasyfikacja i obecność właściwego stanu). `przed-nazwy.txt` jest pusty, bo plik testowy nie istniał na markerze; diff dodaje dokładnie pięć nazw i nie usuwa żadnej.

## Zakres zmian

```text
docs/ui-standards/TRIADA_KANON.md
scripts/dev/__tests__/click-then-shoot.test.mjs
scripts/dev/click-then-shoot.mjs
docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY243_PODGLAD_REPORT.md
```

## TWIERDZENIA NIEZWERYFIKOWANE

- Nie zweryfikowano wszystkich 144 plików rodziny ani wszystkich ekranów produktu; R1 to wymagana próbka 15 ekranów.
- Nie zweryfikowano, czy historyczne 12 z 12 obrazów rzeczywiście nie zawierało podglądu; to cytowany pomiar toru grafiki.
- Nie odtworzono pomiaru 0 z 20; potwierdzono jedynie obecność cytatu w źródle repo.
- Nie zweryfikowano realnego API/backendu ani treści domenowej przykładu; harness montuje realne komponenty z lokalną fixture.
- Nie wykonano mobile screenshots; kod mechanicznie klasyfikuje mobilny `TableWithPreviewLayout` jako overlay, ale realny komplet mobile nie był celem jednego przykładu R3.

## Korekty wobec instrukcji

1. Instrukcja podawała 86 plików importujących rodzinę `StandardPreview`/`PreviewPane`; własny pomiar w `src`, bez testów, dał 144 pliki. Nie przepisano liczby 86.
2. Komenda wejściowa `grep -rln "mean_luma\|mean-luma" scripts/dev/*.mjs` dała zero, choć istnieje działający wzorzec `scripts/dev/day233-finanse-panele-zrzuty-jasne.mjs`, który importuje funkcję camelCase `meanLuma`. Wzorzec znaleziono szerszym pomiarem `rg "meanLuma|screenshot"`.
3. Instrukcja sugerowała Vitest dla `scripts/dev/__tests__/click-then-shoot.test.mjs`, ale rootowy config nie odkrył pliku: JSON `success:false`, 0 testów. Użyto istniejącej konwencji `node --test` bez zmiany globalnego configu.
4. `CLAUDE.md` wymaga skilla `consultify-triada`, lecz skill nie był dostępny w liście skills sesji. Przeczytano bezpośrednio `docs/SOURCE_OF_TRUTH.md` i cały `TRIADA_KANON.md`; brak skilla nie był powodem proceduralnego STOP.
5. W `Z13` występuje niejednoznaczne zdanie „zrzuty ... NIE wchodzą do repo poza JEDNYM załącznikiem”, podczas gdy tabela licencji nie pozwala zapisać obrazu w repo, a wcześniej `Z13` kieruje wszystkie zrzuty do `/private/tmp`. Wybrano bezpieczniejszą interpretację: zero obrazów w repo, komplet w przydzielonym katalogu artefaktów z hashami.

## Commity i push

```text
f83323d7e0 docs(triada): require preview-open evidence screenshots
867d8c332e test(dev): add click-then-shoot preview evidence tool
f661f5c4be fix(dev): keep harness chrome out of preview evidence
```

Każda pozycja została wypchnięta wyłącznie na `github-backup/codex/day243-podglad-20260901`.
