# SUMY — DEC-461 R4 dowód pliku (narracja EN, gałąź `qoder/narracja-en-20260916`)

Ten katalog jest dowodem, że raport oceny dojrzałości w języku **EN nie zawiera
polskich diakrytyków**, a raport **PL jest bajtowo nietknięty** względem bazy.

## Co jest w repo, a co lokalnie

Zgodnie z Wpisem 9 (KANAL.md) do commita NIE wchodzą binaria dokumentów
(`*.docx`, `*.pptx`, `*.pdf` ≈ 2,9 MB) — repo nie może puchnąć. W repo zostają:

- 4 × PNG pierwszej strony (≤ 200 KB każdy) — `report-en-page1-01.png`,
  `report-pl-page1-01.png`, `deck-en-page1-01.png`, `deck-pl-page1-01.png`;
- ten plik `SUMY.md` (sumy treści + liczby — dowód, który ma żyć w repo);
- skrypt reprodukujący `scripts/dev/qoder-r4-render.mts`.

Binaria dokumentów i pliki `summary-*.json` / `pl-before-after.json`
(`*.json` wykluczone przez `evidence/.gitignore`) zostają **lokalnie**; ich
ścieżki i sha256 CAŁYCH plików są poniżej, żeby dało się je odtworzyć/werifykować.

Baza: `070296a26b` (linia po R0, przed R1–R3). Kandydat: R1 `b3984da0a7`,
R2 `955b6bde09`, R3 `726945502f`, R4 (ten commit).

## Reprodukcja

```bash
# z korzenia repo; jeden proces na jeden język
npx tsx scripts/dev/qoder-r4-render.mts en
npx tsx scripts/dev/qoder-r4-render.mts pl
```

Skrypt działa, bo `pdf-parse` jest w nim importowany LENIWIE (`await import(...)`),
dopiero po renderach DOCX i PPTX. Przyczyna padu jest zmierzona, nie domniemana:
`pdf-parse` ciągnie własną, zagnieżdżoną kopię natywnego `@napi-rs/canvas` (0.1.80),
a rasteryzator bloku `chart` w `renderDocumentSchemaToDocxBuffer` ładuje kopię
aplikacyjną (1.0.9). Dwa fizyczne buildy Skia w jednym procesie Node zabijają
proces przy pierwszym rysowaniu po imporcie — bez `pdf-parse` render DOCX daje
226 614 B i RC=0, z importem top-level RC=139 (dowody i raporty macOS `.ips`:
`evidence/qoder-vitest-render-20260917/DIAGNOZA.md`). Dawniejszy opis „renderer
segfaultuje w workerach, ZASTANE" był nietrafny: pada każdy proces (vitest i tsx),
w którym spotkają się obie kopie.

Sumy PPTX liczone są po POSORTOWANIU `slideNames` numerem slajdu — kolejność
wpisów w zip nie jest stabilna, więc bez sortowania `contentSha256` slajdów
mógłby się różnić między przebiegami tego samego renderu.

### Przebieg kontrolny 2026-09-17 (linia `00f2e0d83f`, ten sam skrypt)

- SUMY TEKSTU odtwarzają się bajt w bajt: DOCX EN `7d0ad7b3…`, DOCX PL
  `28b28b89…`, PPTX EN `5ebb7db9…`, PPTX PL `88d41130…` — identyczne z tabelami
  wyżej; sortowanie `slideNames` ich NIE zmienia (zmierzone).
- Diakrytyki: EN 0/0/0, PL 763/113/118 — jak w tabeli wyżej.
- Sumy CAŁYCH plików binarnych z tabeli niżej się NIE odtwarzają i nigdy nie
  miały: zipy niosą timestampy wpisów (dwa przebiegi `en` z 2026-09-17 dały
  `report-en.docx` o identycznym rozmiarze 226 614 B i różnych sha256).
- ★ ROZBIEŻNOŚĆ DO DECYZJI CTO: osadzony PNG wykresu w świeżo renderowanym DOCX
  różni się od osadzonego w binariach z 16.09 22:35 (213 723 B vs 195 799 B,
  oba 2100×1212, deterministycznie 3/3 w przebiegu kontrolnym; wizualnie świeży
  ma obrysy serii radaru, zapisany nie). Źródło serwera między commitami R4
  a linią `00f2e0d83f` nie zmieniało rendererów (`git diff a46892635f..00f2e0d83f
  -- server/src` = jeden plik testowy), wersja `@napi-rs/canvas` ta sama (1.0.9).
  Podejrzenie: binaria z 16.09 powstały z niezacommitowanego stanu rasteryzatora.
  NIE nadpisuję przyjętych sum — dowód DEC-461 stoi na sumach TEKSTU, te są
  identyczne.

## Diakrytyki (polskie znaki) w warstwie tekstowej

| język | DOCX (`word/document.xml`) | PPTX (sklejone `ppt/slides/slideN.xml`) | PDF (tekst) |
|---|---|---|---|
| **EN** | **0** | **0** | **0** |
| PL | 763 | 113 | 118 |

Liczby PL to polska treść raportu (oczekiwana), nie defekt. Oczekiwane EN = 0 — spełnione.

## PL przed/po — TREŚĆ identyczna (bajt w bajt)

Całe zipy NIE są porównywalne między przebiegami (timestampy wpisów zip),
dlaczego porównujemy sha256 TREŚCI: `word/document.xml` oraz sklejonych
`ppt/slides/slideN.xml`.

| | DOCX contentSha256 | PPTX contentSha256 |
|---|---|---|
| PL **przed** (baza `070296a26b`) | `28b28b89e7412df7b47c9255ba285c47256686f3d07b1203c161966a75b184c0` | `88d41130f3e875034378642536ece06e78ab574559a0c1ed7e2c31d7c6225109` |
| PL **po** (kandydat) | `28b28b89e7412df7b47c9255ba285c47256686f3d07b1203c161966a75b184c0` | `88d41130f3e875034378642536ece06e78ab574559a0c1ed7e2c31d7c6225109` |
| | **identyczne** | **identyczne** |

## EN contentSha256 (treść)

- DOCX: `7d0ad7b3f43c9e83cdc9d5a2eb85f8c4a38d902a297c930d7b23b4bddbebea79`
- PPTX: `5ebb7db9d36b6daeb7dab3b01a3645cfe10791e2eebcf053253ccd1b8d606329`

## Binaria lokalnie — sha256 CAŁYCH plików + rozmiar + ścieżka

Katalog lokalny: `evidence/qoder-narracja-en-20260916/`

| plik | bajty | sha256 całego pliku |
|---|---|---|
| `report-en.docx` | 207493 | `5ee1ffee97501726fc0ecb4403609d516d8efd9bf78a94d6128a67d6a097cf00` |
| `report-en.pdf`  | 521174 | `c1536d1ea91b2de7367b922dfd6aed6768f9fbb6d0f94e1e335db9e6bc1c0b6e` |
| `deck-en.pptx`   | 410276 | `cdb907128747dc9df803198230abccf9c563139a9d1f55a3492508bdc76cceb4` |
| `deck-en.pdf`    | 52252  | `38c08c567bda20d3214a86eb98067c56685ee9ca32172b83a4b0af9659721d2a` |
| `report-pl.docx` | 212546 | `3260a811931d456809637d538781250a94115766e43ca5aedde7880f8995a210` |
| `report-pl.pdf`  | 537006 | `26ed803ce011e781a17033959604d2d665f3d8dbe482e3a5d3da6880656094f8` |
| `deck-pl.pptx`   | 410370 | `d08eed9a9c4c21f5c5aabf87c2826b821ec9f01c9d849b19c831d435ed7f42b7` |
| `deck-pl.pdf`    | 53803  | `d72efd58a6e65993c4935db53b06fb91f32835bf7446444f93459fa4c8852f06` |
| `report-pl-base.docx` (baza) | 212545 | `da39eb2b0e230c4b3efccd621984cd0bfdc0325f0d487942e65690680e6941b4` |
| `deck-pl-base.pptx` (baza)   | 410370 | `25b2facea4566a77b096de6c0e43401518f4348b9c534f71af2bfb627b92a1eb` |
| `deck-pl-base.pdf` (baza)    | 53803  | `a56288df386e9904fd200db157b5e4396eccf5f445ef92b2bb70decb6e836265` |

## Angielskie zdanie ograniczenia w finalConclusions (EN)

> Limitations of the recorded assessment: “The result comes from an assessment
> run in the DRD workshop (legacy store), not from a frozen method-core Output —
> the levels are declared, without attached evidence.”

To zdanie (slot `reportI18n('en').legacyLimitation`) zastąpiło zaszyty wcześniej
PO POLSKU literał, który wyciekał do `finalConclusions` każdego raportu legacy EN.
