# R2 — pomiar właściwego ekranu i bramka a11y

Trzy ważne przebiegi pomiaru (błędne wcześniejsze logi bez `pipefail` oznaczono `INVALID`):

| Przebieg | base | unique | menus | bez nazwy | sha256 |
| --- | ---: | ---: | ---: | ---: | --- |
| 1 | 86 | 82 | 3 | 0 | `2ccdd150921460e4c625d469f7cc73bf1604a6b45f52bb62947b92a627f78db1` |
| 2 | 86 | 82 | 3 | 0 | `2ccdd150921460e4c625d469f7cc73bf1604a6b45f52bb62947b92a627f78db1` |
| 3 | 86 | 82 | 3 | 0 | `2ccdd150921460e4c625d469f7cc73bf1604a6b45f52bb62947b92a627f78db1` |

Źródła: `/private/tmp/cx-day337-idee-enumeracja-artefakty/r2-measure-valid-{1,2,3}.log` oraz JSON-y kontraktu `r2-contract-{1,2,3}.json`. Każdy JSON: `numTotalTests=7`, `numPassedTests=6`, `numFailedTests=0`, `numPendingTests=1`.

Decyzja: zachowano poprawny wpis `idea-table` dla listy Idei i dodano osobny, piąty wpis `idea-table-timeline-stuck` dla realnego narzędzia. Nowy mianownik `unique` = `53 + 65 + 81 + 27 + 82 = 308`.

## Mutacja a11y

Do realnego `IdeaTableTool` dodano tymczasowo widoczny przycisk bez tekstu, `aria-label` ani `title`.

Pełna nazwa czerwonego przypadku:

`Idea tools — complete DOM control inventory idea-table-timeline-stuck: accounts for the base and opened-menu passes`

RED: `expect(base.every(({ name }) => name.length > 0)).toBe(true)` otrzymało `false`; 1 failed, 6 skipped. Log: `/private/tmp/cx-day337-idee-enumeracja-artefakty/r2-a11y-red.log`.

GREEN po przywróceniu przez `cp`: 1 passed, 6 skipped; inventory `82`, hash `2ccdd150921460e4c625d469f7cc73bf1604a6b45f52bb62947b92a627f78db1`. Log: `/private/tmp/cx-day337-idee-enumeracja-artefakty/r2-a11y-green.log`.

`git diff -- src/components/MyWork/IdeaTableTool.tsx` po przywróceniu: pusty.
