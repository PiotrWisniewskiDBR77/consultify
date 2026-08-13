# MPQ — niezależny audyt wizualny Assessment (2026-08-13)

Zestaw **45 zrzutów** z niezależnego audytu MPQ powierzchni Assessment, renderowanych
z **realnych** komponentów (`AssessmentHub`, `DrdMethodWorkspaceScreen`) w izolowanym
harnessie `dev-render`, z mockowanymi wywołaniami `Api` — bez dotykania kodu produkcyjnego.

Ten plik powstał **po fakcie**, żeby uzupełnić opis, którego zabrakło w momencie
commitowania (patrz „Proweniencja" niżej). Zrzuty są **świadomym dorobkiem audytu**,
nie plikami tymczasowymi.

## Dlaczego to zostaje

Zrzuty są materiałem dowodowym dla ustaleń zapisanych w commitowanych dokumentach programu:

- `docs/program/METHOD_ASSESSMENT_CORE_2026-08-13/REMEDIATION_REPORT.md` — wiersz
  „Report/Presentation osierocone". Pliki `orphan-report-*.png` i `orphan-presentation-*.png`
  to bezpośredni dowód wizualny tego ustalenia.
- `docs/program/METHOD_ASSESSMENT_CORE_2026-08-13/EVIDENCE_LEDGER.md` — pozycje A5/A7/G8.1
  powołują się na „zrzuty obejrzane" i „odbiór wizualny zrzutu" jako podstawę werdyktu.

Skasowanie tego katalogu osierociłoby powyższe twierdzenia dowodowe.

## Zakres pokrycia

Zestaw jest systematyczny, nie przypadkowy — pokrywa:

- **powierzchnie**: Library, Sessions (Procesy), WorkView (interview / matrix / split /
  split-scrolled / teresa), LiveArtifact (initiative / output / report), orphan (report /
  presentation)
- **motywy**: light + dark
- **responsywność**: 768 / 1280 / 1440 px oraz `zoom200`
- **stany brzegowe**: `empty`, `loading`, `error`, `longtext`
- **dostępność**: `keyboard-focus`, `focus-navitem`, `focus-matrix-button`, `focus-stop-8/9`

## Proweniencja i incydent

Zrzuty trafiły do historii **rozbite na dwa niezwiązane commity testowe**, bez opisu:

| Commit | Temat commita | Zrzutów |
| --- | --- | ---: |
| `e40def0e98` | `fix(test): usun MIGOTANIE bramki serwera…` | 26 |
| `2d59192649` | `test(method-core): STRUMIEN 2+6…` | 19 |

**Przyczyna**: dwie sesje agentów pracowały równolegle w tym samym worktree
(`.codex/worktrees/mac-clean-integ`), wbrew zasadzie „jeden worktree = jeden agent".
Szerokie stage'owanie (`git add -A`) przez sesję testową wciągnęło dorobek renderujący
sesji audytowej.

Historia **nie została przepisana** — gałąź niesie 14 commitów ponad `2d59192649`, a zestaw
zrzutów jest i tak rozdzielony między dwa commity, więc żaden `amend`/rebase pojedynczego
commita nie dałby czystego rozdziału. Zamiast tego proweniencja jest udokumentowana tutaj.

## Harness — skasowany

Zrzuty powstały przy użyciu tymczasowego harnessu, który w tym samym incydencie
trafił do `2d59192649`:

- `dev-render/mpq-audit-hub.html`
- `dev-render/mpq-audit-hub-main.tsx`
- `dev-render/vite.mpq-audit.config.ts`

Wszystkie trzy **deklarowały w nagłówku „DELETE THIS FILE after the audit"** i zostały
usunięte osobnym commitem naprawczym. Nie miały żadnego callera poza sobą nawzajem,
a `vite.mpq-audit.config.ts` kodował na sztywno obejście przejściowego stanu
(niistniejący import `./screens/tools-sesja-wyjscie` w `dev-render/main.tsx`) — czyli
zgniłby przy pierwszej naprawie tamtego importu.

Harness montował **istniejący** `dev-render/screens/assessment-five-surfaces.tsx`,
który pozostaje w repo — odtworzenie renderu jest więc możliwe bez skasowanych plików.
