# SUMY — etykiety powłoki raportu DRD idą za `contract.language` (gałąź `qoder/report-shell-labels-20260917`)

Baza gałęzi: `b1ab38d4d6` (linia `origin/integracja/20260911`).
Zakres GO (Wpis 23/24): DOKŁADNIE 4 miejsca w
`server/src/services/documentStudio/documentDocxRenderer.ts`.

## Pomiar PRZED (EN, fixture z findingami)

Warstwa tekstowa powłoki DOCX (`word/document.xml` + `word/header*.xml` + `word/footer*.xml`):

| język | `\b(Tabela|Rysunek|Strona)\b` | sha256 TREŚCI powłoki |
|---|---|---|
| EN przed | **12** (`Rysunek` ×1, `Tabela` ×10, `Strona` ×1) | `4efb9e92ccd5a05bb62309a2444feca15f061833d7bf1f4ca346121e414effbb` |
| EN po | **0** | `9ac707f403676c9cf06b80edb0a60ff4fb9271178ff845b20792a36b9cbd8b65` |
| PL przed | 12 (polska treść — oczekiwana) | `6d780e5d2016d7f043ec153901353ff3dfaf1d5cbb3843f227adb4c67af35b0d` |
| PL po | 12 | `6d780e5d2016d7f043ec153901353ff3dfaf1d5cbb3843f227adb4c67af35b0d` |

PL **bajt w bajt identyczne przed/po** — ta sama suma. Snapshot przypięty w teście
`g1.reportShellLabels.test.ts`.

## Diff renderera

4 instrukcje (warunek `drdProfile && ctx.schema.language…startsWith('pl')` w podpisach
tabeli/rysunku/wykresu + językowa etykieta stopki zamiast literału `'Strona '`).
`git diff --stat`: `1 file changed, 13 insertions(+), 10 deletions(-)` — prettier łamie
przypisanie po `=` przy dłuższym warunku, więc 4 instrukcje = 13/10 linii; NIC poza tymi
4 instrukcjami nie jest dotknięte. `prettier --check` czysty (baza też była czysta).

## Test `g1.reportShellLabels.test.ts` (osobny plik)

| przebieg | EXIT | wynik |
|---|---|---|
| PRZED naprawą | 1 | EN czerwony: `[Rysunek, Tabela ×10, Strona]`; PL zielony (snapshot) |
| PO naprawie | 0 | 2 passed (2) |
| MUTACJA 1 (podpisy wrócone do `drdProfile`) | 1 | EN czerwony: 11 trafień (`Rysunek` ×1 + `Tabela` ×10), stopka już czysta |
| MUTACJA 2 (stopka wrócona do `'Strona '`) | 1 | EN czerwony: dokładnie `['Strona']` |

## Zrzuty (≤ 200 KB, w repo)

| plik | bajty | sha256 |
|---|---|---|
| `report-en-page2-PRZED.png` | 168808 | `8b5b42ce89f4407420c1c97bd86ee2945f6207a9008d1bedac301b4b9f0d7141` |
| `report-en-page2-PO.png` | 168502 | `9036c1dd5883ebededa97fdf6333c62257449d4bc2b43c21bbc7568a92e4ca80` |

Ścieżka: strona 2 raportu EN (LibreOffice → PDF → `pdftoppm -r 120`). PRZED:
`Rysunek 1.` / `Tabela 1.` / stopka `Strona 2 z 19`. PO: `Figure 1` / `Table 1` / `Page 2 z 19`.

## Binaria lokalnie (NIE w repo)

| plik | sha256 |
|---|---|
| `/tmp/qoder-shell-before/report-en-before.docx` | `7d6983d6f65e7cdade4837149a2849f723c4b9ccd067f72b5f8619fa4ec0d5ab` |
| `/tmp/qoder-shell-after/report-en-after.docx` | `9a3fd2681958bf66193b34554efe1eab97f5fc5b87aa03019a1321245a272a96` |
| `/tmp/qoder-shell-after/report-pl-after.docx` | `733e2c960dfc78899a3ca1f177ebe628ddc8ccff8a44af7c4fbf82e9081fcac9` |

Całe zipy nie są porównywalne między przebiegami (timestampy wpisów) — dowodem jest suma
TREŚCI powłoki wyżej.

## Sąsiedzi i klasyfikacja czerwieni

- `documentDocxRenderer.test.ts` 20/20, `documentDocxCaptionsFootnotes.test.ts` 10/10,
  `day191.footerPagination.test.ts` 1/1, `day32.polishTypography.test.ts` 2/2 — zielone PO.
- `documentRendererE15FormattingRender.test.ts`: 2 failed | 15 passed — **ZASTANA**:
  identyczne 2 czerwienie (TOC `1-3` / `1-2`) zmierzone na bazie `HEAD` bez mojej zmiany.
- `g1.reportLanguage.test.ts` na TEJ gałęzi: worker crash (`Worker exited unexpectedly`) —
  **ZASTANA**: podział g1 (osobny proces dla `pdf-parse`) żyje na gałęzi
  `qoder/vitest-render-20260917` i nie jest jeszcze w linii; zmierzono identyczny crash na bazie.
- `assessmentLegacyReport.engine` 8/8, `day32.drdSchema` 16/16, `s14b.reportFixes` 12/12 — zielone.

## Bramki (kandydat)

| bramka | wynik |
|---|---|
| `server && npx tsc --noEmit -p tsconfig.json` | 0 błędów |
| front `tsc --noEmit` (8 GB) | 169 = baza 169 |
| `scripts/check-list-canon.sh` | 346 = baseline 346 |
| `scripts/check-artefakt.sh` | 8 = baseline 8 |
| `npm run check:jezyk:ci` | EXIT 0 (spadki: K4en -13, K4obj -36, K5en -1, K7 -1) |
| `npm run build` (8 GB) | EXIT 0 |

## Wpis 27 — dlaczego stopka ma ternar, nie `defaultPageLabel`

CTO (Wpis 27) prosi o jedno źródło prawdy: użycie `defaultPageLabel` z linii 2160 zamiast
drugiego ternara. Sprawdzono zasięg: `const defaultPageLabel` jest zadeklarowane WEWNĄTRZ
bloku `} else {` (linia 2159–2183, gałąź „brak własnego formatu stopki"), a akapit stopki DRD
to gałąź równoległa wyrażenia `footerChildren` (linia 2185+) — **zmienna NIE jest w zasięgu**
w miejscu naprawy. Podniesienie deklaracji wyżej = dodatkowe linie poza 4 instrukcjami
GO (Wpis 24 pkt 1), więc zgodnie z klauzulą Wpisu 27 („jeśli nie w zasięgu — zostaw ternar
i napisz to w meldunku") zostaje ternar o IDENTYCZNYM wyrażeniu co `defaultPageLabel`.
Kandydat na follow-up (po akcepcie CTO): podnieść `defaultPageLabel` do zasięgu funkcji
i użyć w obu miejscach.

## OTWARTE (poza zakresem GO — decyzja CTO)

Stopka DRD EN po naprawie czyta się `Page 2 z 19`: separator `text: ' z '` (linia 2255)
i fallback `Poufne — …` (linia 2236, gdy `formatting.footers.content` puste) są nadal
polskie. GO obejmowało DOKŁADNIE 4 miejsca, więc ich NIE ruszyłem; test pilnuje tylko słów
`Tabela|Rysunek|Strona`. Kandydat na follow-up: `' z '` → `' of '`, `Poufne —` → `Confidential —`
(po akcepcie CTO, osobny wpis).
