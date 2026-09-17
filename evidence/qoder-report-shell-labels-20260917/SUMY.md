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
i użyć w obu miejscach. **Zrealizowane w Wpisie 28**: para `pageLabel`/`pageSeparator`
w zasięgu funkcji zastąpiła `defaultPageLabel` (jedno źródło prawdy).

## Wpis 28 — separator stopki per język (`pageLabel` / `pageSeparator`)

CTO oczami zobaczył na zrzucie PO stopkę „Page 2 **z** 19": literał `text: ' z '` (ówczesna
linia 2255) był poza listą słów testu. Naprawa: para stałych w zasięgu funkcji
(`documentDocxRenderer.ts:2116-2117`):

```ts
const pageLabel = schema.language.toLowerCase().startsWith('pl') ? 'Strona ' : 'Page ';
const pageSeparator = schema.language.toLowerCase().startsWith('pl') ? ' z ' : ' of ';
```

użyta w trzech miejscach: wariant domyślny numeracji (`:2165`, zamiast usuniętego lokalnego
`defaultPageLabel` — jedno źródło prawdy, patrz Wpis 27) oraz stopka DRD (`:2244` etykieta,
`:2256` separator). Diff renderera w tym commicie: 5 insertions / 4 deletions, wyłącznie
logika stopki.

### Test (cała stopka, nie lista słów)
Nowe asercje w `g1.reportShellLabels.test.ts`: EN po zdjęciu tagów z `word/footer*.xml`
matchuje `/Page\s+.*\s+of\s+/` i NIE matchuje `/\s+z\s+/`; PL matchuje `/Strona\s+.*\s+z\s+/`
i NIE matchuje `/\s+of\s+/`; snapshot powłoki PL bez zmian (`6d780e5d…`).

| przebieg | EXIT | wynik |
|---|---|---|
| PRZED (renderer ze `' z '`) | 1 | nowy test EN czerwony: stopka „Page … z …" nie matchuje `/Page\s+.*\s+of\s+/` |
| PO | 0 | 4 passed (4) |
| MUTACJA (`pageSeparator = ' z '`) | 1 | dokładnie ten sam test czerwony; test listy słów zostaje ZIELONY (pułapka udokumentowana) |

### Zrzut PO i stopka odczytana dosłownie
`report-en-page2-PO-w28.png` (168 587 B, sha `ea87785b5737b7f2f84b9c94f28c4d85f46178124277cf22e8515a38330cb0c8`).
Linia stopki strony 2 (pdftotext -layout):
`Confidential — Northwind Manufacturing Ltd.                Page 2 of 19                               ● Consultify`
PL (bez zmiany): `Poufne — Northwind Manufacturing Ltd.                     Strona 2 z 20                           ● Consultify`
Cały PDF EN: 0 wystąpień `\b(Tabela|Rysunek|Strona)\b`.

Binaria lokalnie: `/tmp/qoder-shell-w28/report-en-w28.docx` sha `f54a06463b673220c6dcb61c3d86a39b70b550b270407d0eb2ea67c90739ac8f`,
`/tmp/qoder-shell-w28/report-pl-w28.docx` sha `dacbd272bc968f76b4bf7273249eeeb10f3b22041dc2878ee704258f80e4fe86`.

### Inwentarz literałów tekstowych stopki/nagłówka (`rg -n "text: '"`, zakres 2150–2280)

| linia | literal / stała | zależny od języka? |
|---|---|---|
| 2116 | `pageLabel` (`'Strona '` / `'Page '`) | TAK — para stałych |
| 2117 | `pageSeparator` (`' z '` / `' of '`) | TAK — para stałych |
| 2163 | `'   \|   '` | nie — separator pól stopki domyślnej |
| 2176 | `' / '` | NIE — celowo bajtowo stabilny separator wariantu domyślnego (komentarz E15: „legacy `Page N / M` runs so existing schemas render byte-stable"); kandydat do decyzji, nie ruszany |
| 2206 | `'\tPage '` | twardo EN — wariant stopki client-final (profil zawsze angielski DEC-461); poza zakresem GO |
| 2213 | `' of '` | twardo EN — jw. |
| 2237 | fallback `` `Poufne — ${audience}` `` | twardo PL — OTWARTE poniżej |
| 2242 / 2267 | `'\t'` | nie — tabulatory układu |
| 2269 | `'● '` | nie — znak graficzny |
| 2275 | `'Consultify'` | nie — marka |

Nagłówek: etykiety (`NAWIGACJA`/`NAVIGATION`, `Spis treści`/`Table of Contents`) idą przez
ternar `isPolish` (`:1850-1861`) — zależne od języka, poprawne. Podpisy tabel/rysunków:
warunek `drdProfile && …startsWith('pl')` (`:1047`, `:1078`, `:1136`).

## OTWARTE (poza zakresem GO — decyzja CTO)

- Spójnik `' z '` (Wpis 28) — ZAMKNIĘTY w tym commicie.
- Fallback stopki DRD `` `Poufne — …` `` (linia 2237, gdy `formatting.footers.content` puste)
  jest twardo polski; w raporcie EN kontrakt podstawia angielską treść stopki, więc literał
  jest tylko fallbackiem — kandydat: `Confidential — …` po akcepcie.
- Wariant stopki client-final (`:2206`/`:2213`) jest twardo angielski (`\tPage ` / ` of `);
  profil client-final jest z definicji EN, ale dla symetrii mógłby czytać `pageLabel`/
  `pageSeparator` — poza zakresem GO.
- Separator `' / '` wariantu domyślnego (`:2176`) celowo bajtowo stabilny (E15) — nie ruszać
  bez osobnej decyzji.
