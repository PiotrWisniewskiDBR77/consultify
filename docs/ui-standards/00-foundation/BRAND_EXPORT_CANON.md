# ★★★ BRAND EXPORT CANON — jeden standard eksportów dokumentów-do-klienta (PPTX · DOCX · XLSX · PDF)

> **Status: APPROVED_SPEC (bramka B-P5 zamknięta 2026-08-02).** Nie wdrożone jeszcze w pełni w kodzie — to jest
> zatwierdzone SSOT, tak jak `TRIADA_KANON.md` dla list i `ARTIFACT_ANATOMY_STANDARD.md` dla artefaktów,
> zanim je wdrożono. Kod generatorów (PptxPipelineService/DeckStyler/WorkbookStyler/documentDocxStyles/
> documentPdfRenderer/reportPdfService) **nie zmienia się w tym kroku** — konwergencja do tego kanonu to
> zadania VF3-2/3/4 (osobne kroki, osobne gałęzie).
>
> **Dlaczego ten dokument istnieje:** eksport = jedyny artefakt Consultify, który płacący klient **trzyma
> w ręku poza aplikacją** (wysyła dalej, drukuje, wkleja do swojego decku). Musi wyglądać McKinsey/BCG-grade
> i musi wyglądać **tak samo** niezależnie od tego, który z równoległych generatorów go wyprodukował. Dziś
> nie wygląda (patrz §0) — stąd priorytet Elkomtech 03.08.
>
> Analogiczne SSOT: `TRIADA_KANON.md` (listy) · `Harvard/wdrozenie-100/ARTIFACT_ANATOMY_STANDARD.md` (artefakty)
> · **ten plik (eksporty-do-klienta)**. Uzupełnia (nie zastępuje) `docs/product/DELIVERABLE_FORMATTING_SPEC.md`
> (biblioteka fontów/skala pt/punktowania — warstwa produktowa) — ten kanon dodaje warstwę **wizualnego
> DNA marki** (paleta/crimson-only-logo/siatka/wykresy) i **wiąże ją z tokenami UI** (`c-*`, `TEXT_L1..Q`),
> których `DELIVERABLE_FORMATTING_SPEC.md` w ogóle nie zna.

---

## §0. REALNY STAN GENERATORÓW (2026-07-19, zweryfikowane grepem + czytaniem kodu)

★ Złota reguła (CLAUDE.md): audyty starzeją się w 3 dni — poniższe to **żywy stan kodu na `origin/demo`**,
nie deklaracja z docs. Weryfikacja: `grep -rln "pptx\|docx\|xlsx\|PDFKit\|exceljs\|pptxgenjs" server/src/`
→ **151 plików**. Realnie dotyczy to **5 niezależnych systemów stylowania**, z których żaden nie czyta
tokenów UI (`src/index.css` `--c-*`, `src/styles/typography.ts`):

| # | System | Plik(i) SSOT | Paleta | Fonty | Kto woła (routing) |
|---|---|---|---|---|---|
| 1 | **Deliverables (Materiały/M17)** — PPTX/DOCX/XLSX | `deliverables/themeRegistry.ts` (5 motywów: executive/modern/corporate/classic/clean) + `deliverables/DeckStyler.ts` (pptx) + `workbook/WorkbookStyler.ts` (xlsx) + `documentStudio/documentDocxStyles.ts` (docx) | 5 wybieralnych palet 60-30-10, domyślny **executive** = navy `#0C447C` + teal `#1D9E75` | 5 par (Merriweather+Inter / Inter+Inter / Calibri+Calibri / EB Garamond+Georgia / Lato+Source Sans 3) z `FORMATTING_FONT_LIBRARY` | `bundleExportRuntime.ts`, `spineToUnifiedReport.ts`, `initiativeMaterializeService.ts` |
| 2 | **Report Builder (starszy pipeline)** — PPTX | `report/pptx/designTokens.ts` (3 motywy: corporate/minimal/modern — **inne nazwy, inne hexy** niż #1) | corporate=navy `#0A2A4E`+emerald `#0E9F6E`; minimal=`#111827`+indigo `#4F46E5`; modern=blue `#1D4ED8`+violet `#7C3AED` | zawsze **Inter** (jeden font, nie 5 par) | `report-builder.routes.ts`, `presentations.routes.ts`, `PptxPipelineService.ts` — **i jednocześnie** `bundleExportRuntime.ts`/`spineToUnifiedReport.ts` (czyli #1 i #2 żyją w TYM SAMYM runtime exportu, nie są rozdzielone na różne moduły) |
| 3 | **Document Studio PDF** | `documentStudio/documentPdfRenderer.ts` | dziedziczy `DOCX_PALETTE` z #1 (navy/teal) — **jedyna para, która jest spójna** | dziedziczy fonty ze schematu dokumentu (`resolveDocxFonts`, domyślnie para „Aptos" — Office 365 default, **nie** z `FORMATTING_FONT_LIBRARY`) | `document-studio.routes.ts` |
| 4 | **Status Report PDF (M14/ExecutionHub)** | `reportPdfService.ts` | własna, 4. paleta: ink `#111827`, muted `#6B7280`, RAG `#16A34A`/`#D97706`/`#DC2626`/`#6B7280` — **zero navy/teal, zero związku z #1-3** | brak deklaracji (pdfkit default Helvetica) | wołany z tras M14 status-report (poza `deliverables/`) |
| 5 | **Chart series ad-hoc** | `report/pptx/composites/SingleInsightChart.ts:58` (`chartColors: … ?? tokens.colors.primary`) i `deliverables/bundlePptxRuntime.ts:225` (`hex(s.color ?? palette[i] ?? ctx.accent)`) | brak wspólnej listy serii — każdy wykres bierze `primary`/`accent` motywu **jako jedyny kolor** (nie ma odpowiednika `c-tag-1..12`) | — | oba pipeline'y #1 i #2 |

**Co JUŻ jest dobre (nie psuć przy konwergencji):**
- Doktryna „crimson NIGDY chrome" jest już wpisana świadomie w #1: `DeckStyler.ts`, `WorkbookStyler.ts`,
  `documentDocxStyles.ts` mają identyczny komentarz *„Crimson is NEVER chrome… ZERO crimson in the data
  path here"*. To dokładnie kierunek, jakiego chcemy — zero roboty do cofnięcia.
- `brandIngestion.ts` (F8.1) czyta `theme1.xml` z uploadu klienta (.pptx/.docx) i nadpisuje motyw —
  mechanizm brand-klienta > motyw > default już istnieje i jest bezpieczny (fail-soft → null).
- `docs/product/DELIVERABLE_FORMATTING_SPEC.md` już zdefiniował kuratorowaną bibliotekę 10 fontów +
  skalę pt per format (Word/PPT/Excel) + punktowania. Ten kanon się z nim WIĄŻE, nie duplikuje.

**Co jest realną luką (to zamyka VF3-1 jako dokument; VF3-2/3/4 zamykają w kodzie):**
1. **Dwa równoległe pipeline'y PPTX (#1 i #2) w tym samym runtime** — klient może dostać deck navy/teal
   albo deck innej navy/innego emerald w zależności od tego, KTÓRA trasa wygenerowała plik. To jest
   dokładnie „nie jeden standard".
2. **Status Report PDF (#4) nie ma NIC wspólnego z resztą** — inna paleta, inny font stack, nie czyta
   `themeRegistry`.
3. **Fonty z kuratorowanej biblioteki (§1 DELIVERABLE_FORMATTING_SPEC) to w większości Google Fonts
   (Inter, Lato, Merriweather, EB Garamond, Source Sans/Serif) referencjonowane PO NAZWIE** — grep
   `embedFont|embedTrueTypeFonts` w `server/src/services/` → **zero wyników**. Żaden generator nie
   osadza fontów w pliku. Na maszynie klienta bez tych fontów Word/PowerPoint podstawi zamiennik
   (zwykle Calibri/Times) — deck/dokument NIE wygląda tak, jak zaprojektowano. To pułapka z zadania
   („kroje systemowo dostępne w eksporcie — nie CDN") — patrz §2 i §11 decyzja D1.
4. **Brak wspólnej palety serii wykresu** (odpowiednik `--c-tag-1..12`) — dziś każdy wykres = jeden
   kolor motywu powtórzony dla wszystkich serii, albo `s.color` ad-hoc bez reguły.
5. **Zero formalnego mapowania `TEXT_L1..Q` (UI) → style dokumentowe** — pt-skale istnieją (`PPT_TYPE_SCALE`
   w `themeRegistry.ts`, `SIZING_BY_CLASS` w `documentDocxStyles.ts`) ale NIE są importowane z/powiązane
   z `src/styles/typography.ts`. Dwa światy (UI i eksport) ewoluują niezależnie — dokładnie ryzyko, które
   ten kanon ma zamknąć pisemnie, żeby VF3-2/3/4 miały jedno źródło prawdy do zaimplementowania.

---

## §1. Zasada nadrzędna

> **Eksport = artefakt SPEC-A archetyp E (Deck) / D (Dokument) widziany OKIEM KLIENTA, poza appką.**
> Nie wolno mu wyglądać jak „export z SaaS-a" — ma wyglądać jak slajd/dokument, który wyszedł z Bain/BCG/
> McKinsey. Jeden system reguł (ten plik), nie ustalenia per generator. Crimson = WYŁĄCZNIE logo/marka
> Consultify (stopka „Prepared with Consultify", cover watermark, metadane pliku) — **nigdy** wykres, tło,
> fill tabeli, akcent motywu klienta. To jest odwrotność reguły „primary=crimson" z UI (§Pułapka nr 1
> CLAUDE.md): w UI crimson=semantyka krytyczna; w eksporcie crimson=WYŁĄCZNIE marka-autor, bo klient
> dostaje SWÓJ motyw (executive/modern/corporate/classic/clean albo brand ingestion), a Consultify jako
> narzędzie zostawia tylko dyskretny podpis.

Hierarchia (analogiczna do CANON.md §2):
1. **Ten plik** — wygląd/DNA marki eksportu.
2. **`docs/product/DELIVERABLE_FORMATTING_SPEC.md`** — fonty/skala pt/punktowania/tabele (szczegół produktowy).
3. **Kod SSOT per powierzchnię** (§9 tabela binding) — egzekwuje w runtime.
4. **`00-foundation/color-system.md` + `src/styles/typography.ts`** — źródło tokenów UI, z których ten
   kanon WYPROWADZA mapowanie (§2, §3), ale eksport ma WŁASNĄ, drukowaną wersję (pt nie px, CMYK-safe hex).

---

## §2. Typografia — mapowanie skali UI L1-Q → style dokumentowe

Skala UI (`src/styles/typography.ts`, SSOT) ma 7 poziomów. Eksport nie może 1:1 skopiować px (ekran ≠
druk ≠ projekcja — `DELIVERABLE_FORMATTING_SPEC.md` §3 to już rozstrzygnął słusznie), ale **rola/hierarchia
każdego poziomu MUSI być ta sama powierzchnia-do-powierzchni**. Mapowanie:

| UI token | Rola UI | Rola w dokumencie | Word (pt) | PPT (pt) | Excel (pt) | Uwaga |
|---|---|---|---|---|---|---|
| `TEXT_L1` (11px, semibold, UPPERCASE, tracking 0.16em) | kicker sekcji/karty | **eyebrow nad tytułem** (kicker slajdu, nadtytuł sekcji Word) | 9pt, uppercase, tracking | 12pt (`PPT_TYPE_SCALE.kicker`), uppercase | nagłówek zakładki Info-sheet | Jedyne miejsce gdzie tracking-uppercase jest OK — reszta bez capsów |
| `TEXT_L2` (13px, semibold) | tytuł elementu/karty | **H2/H3** — podsekcja Word, tytuł bloku slajdu | 14-16pt / 600 | mieści się w `slideTitle` 28pt gdy = tytuł slajdu, albo `lead` 24pt gdy = tytuł bloku wewnątrz slajdu | nagłówek kolumny bold | |
| `TEXT_L3` (13px, normal, 1.6 line-height) | body główny | **treść główna** (akapit Word, bullet PPT, komórka Excel) | 11pt / 400 / interlinia 1.4-1.5 | 18pt min (projekcja) | 10-11pt | Zgodne 1:1 z `DELIVERABLE_FORMATTING_SPEC.md` §3 |
| `TEXT_L4` (12px, normal, secondary) | wspierający detal | **caption/źródło**, sekcja "Notes"/footnote inline | 9pt, kolor secondary | 11-12pt (`caption`) | komentarz komórki | |
| `TEXT_L5` (11px, normal, micro) | mikro/caption, timestamp | **etykiety osi wykresu, mikro-nota, numer strony** | 8-9pt | 9pt (`micro`) | etykieta osi wbudowanego wykresu | Patrz §7 — to jest dosłownie skala osi wykresu z zadania |
| `TEXT_N` (22px, semibold, tabular-nums) | metryka/KPI headline | **KPI hero** (cover „liczba tygodnia", KPI-card w tabeli/decku) | 28-32pt (cover), tabular | `kpiValue` — dziś 36pt w systemie #2, brak odpowiednika nazwanego w #1 → ujednolicić na 32pt | suma/total row bold, tabular | Liczby ZAWSZE tabular (tabular-nums / Excel prawy align) — już przestrzegane w WorkbookStyler |
| `TEXT_Q` (13px, italic, quote) | cytat uczestnika | **pull-quote / callout „insight"** (blockquote Word, quote-slide PPT) | 13-14pt italic, lewy pasek koloru (§ callout DELIVERABLE_FORMATTING_SPEC §4) | dedykowany quote-layout, cudzysłów + atrybucja | (rzadko w Excel — komentarz komórki italic) | |

**Reguła egzekwowalna:** żaden nowy styl dokumentowy nie powstaje bez przypisania do jednego z 7 wierszy
powyżej. Jeśli coś nie pasuje do żadnego — to sygnał do rozszerzenia skali UI najpierw (nie do wymyślenia
ósmego stylu tylko dla eksportu).

**Fonty (decyzja wymagana — patrz §11 D1):** dopóki żaden generator nie osadza fontów w pliku, jedyne
BEZPIECZNE (gwarantowane u klienta) kroje to Office-native: **Calibri, Arial, Georgia, Times New Roman**,
Aptos (Office 365 default). Reszta kuratorowanej biblioteki (Inter/Lato/Merriweather/EB Garamond/Source
Sans+Serif) wygląda świetnie na maszynie, na której renderujemy podgląd, ale **nie jest gwarantowana u
klienta** — to jest różnica między „system fonts" a „CDN fonts" z zadania VF3-1, przeniesiona 1:1 na desktop
Office. Do czasu decyzji Piotra: traktować 5 par z `FORMATTING_FONT_LIBRARY` jako **best-effort z fallbackiem
Office wbudowanym przez samo Word/PowerPoint** (nie ryzyko blokujące), ale NIE dodawać kolejnych
niebezpiecznych fontów bez świadomej zgody.

---

## §3. Paleta — semantyka jak w UI, crimson TYLKO logo/brand

Ten kanon **nie unieważnia** 5 motywów klienckich z `themeRegistry.ts` (executive/modern/corporate/classic/
clean) — to jest poprawny, zamierzony mechanizm (klient/branding > jeden sztywny kolor). Kanon dodaje trzy
twarde zasady, które MUSZĄ obowiązywać NIEZALEŻNIE od wybranego motywu:

1. **Crimson (`#85182F` / `--accent` UI) nigdy nie jest częścią palety motywu klienta.** Jedyne dozwolone
   miejsca crimson w eksporcie: (a) mikro-znak marki Consultify w stopce/metadanych pliku (np. mała kropka
   lub wordmark przy „Wygenerowano w Consultify"), (b) nigdy fill tabeli/nagłówka/tła slajdu, (c) nigdy
   seria wykresu, (d) nigdy status w treści klienta (status/RAG ma WŁASNĄ semantykę — patrz pkt 3).
   Weryfikacja: dokładnie to, co już deklarują komentarze w `DeckStyler.ts`/`WorkbookStyler.ts`/
   `documentDocxStyles.ts` — ten kanon to formalizuje jako regułę wiążącą WSZYSTKIE 5 systemów z §0,
   włącznie z #2 (report/pptx) i #4 (reportPdfService), które dziś NIE mają tego komentarza wpisanego.
2. **Semantyka statusu (`--c-success`/`--c-warning`/`--c-danger`/`--c-info`) ma jeden zestaw znaczeń
   niezależnie od palety motywu** — RAG/status w eksporcie zawsze zielony=dobrze, bursztyn=uwaga,
   czerwony=krytyczne, niebieski=informacyjne. Dziś `reportPdfService.ts` ma WŁASNY zestaw RAG-hex
   (`#16A34A`/`#D97706`/`#DC2626`) rozjeżdżający się z resztą — kierunek: te same 4 hexy wszędzie
   (dokładna wartość do ustalenia w VF3-2, nie tu — ale zasada „jeden zestaw" jest kanonem już teraz).
3. **Motyw klienta = 60-30-10** (`dominant`/`supporting`/`accent`/`neutralText` z `ThemePalette`) — to
   już poprawnie zaimplementowane w #1, kanon je przyjmuje bez zmian jako wzorcowy kontrakt danych motywu.

### Seria wykresu = odpowiednik `--c-tag-1..12`
UI ma 12 kolorów kategorii (`--c-tag-1`…`--c-tag-12`, patrz `src/index.css`) — świadomie NIE crimson, 12
odcieni rozróżnialnych bez powtórzenia. Eksport dziś **nie ma tego odpowiednika** (§0 pkt 4: wykres = jeden
kolor motywu powtórzony). Kanon: każdy wykres wieloseriowy w eksporcie używa sekwencji 12 kolorów
wyprowadzonej z `--c-tag-1..12` (te same hexy, bo już są WCAG-bezpieczne i przetestowane w UI — nie
wymyślać nowej palety), **z wyjątkiem** wykresów jednoseriowych/KPI, które używają `accent` motywu klienta
(zachowanie marki). Implementacja tej sekwencji w `bundlePptxRuntime.ts`/`SingleInsightChart.ts` to zadanie
VF3-3, nie ten dokument.

---

## §4. Okładka / stopka / paginacja / metadane pliku

**Okładka (cover, strona/slajd 1):**
- Pełne tło `dominant` motywu (albo białe dla motywów jasnych typu `clean`) — nigdy crimson.
- Tytuł deliverable = `TEXT_N`-rola (największy rozmiar w dokumencie, §2).
- Kicker nad tytułem (`TEXT_L1`-rola): nazwa klienta / typ dokumentu / data.
- Logo klienta (jeśli brand ingestion dostarczył) górny-lewy róg; logo Consultify (crimson, małe, dyskretne)
  dolny-prawy róg lub stopka — nigdy dominujące, nigdy większe niż logo klienta.
- Confidentiality label (jeśli `formattingSchema` je niesie — już wspierane w `documentPdfRenderer.ts`).

**Stopka (każda strona/slajd poza okładką):**
- Lewo: nazwa dokumentu/projektu (skrócona). Środek: (opcjonalnie) confidentiality. Prawo: numer strony/slajdu.
- Styl `TEXT_L5`-rola (micro) — nigdy konkuruje wizualnie z treścią.
- Cienka linia (`hairline`, kolor `supporting` motywu przygaszony) oddziela stopkę od treści — nie pełny bar.

**Paginacja:**
- Word/PDF: „Strona X z Y" — pole automatyczne (Word field), nie statyczny tekst (już zrobione poprawnie
  w `documentPdfRenderer.ts` wg komentarza w nagłówku pliku — utrzymać przy konwergencji).
- PPT: numer slajdu w rogu, format „N / total" na życzenie (dziś niespójne między pipeline #1 i #2).

**Metadane pliku (OOXML core properties — `docProps/core.xml`):**
- `title` = tytuł deliverable (nie nazwa pliku/uploadu).
- `creator`/`lastModifiedBy` = „Consultify" (nie nazwisko konsultanta indywidualnego — spójne z brandem
  vendor, nie osoby).
- `company` = nazwa organizacji klienta (jeśli znana z kontekstu projektu).
- `subject`/`keywords` = typ deliverable + projekt (do wyszukiwania po stronie klienta w jego DMS-ie).
- **Dziś nieweryfikowane w żadnym z 5 systemów** (grep nie pokazał `docProps`/`core.xml` w żadnym generatorze)
  — to jest cichy detal, który odróżnia „profesjonalny plik" od „raw export"; kandydat do VF3-2/3/4.

---

## §5. Siatka slajdu (PPT) — marginesy, strefa tytułu, 1 idea/slajd

Bazując na już-istniejących stałych (`report/pptx/designTokens.ts` `GRID`/`SPACING` — 16:9, cale):

```
┌────────────────────────────────────────────────────────┐  ← slideH 5.625"
│ margines 0.5"                                            │
│  ┌──────────────────────────────────────────────────┐    │
│  │ STREFA TYTUŁU (headerH 0.8")                      │    │
│  │  kicker L1 (opcjonalny) + tytuł slajdu TEXT_L2/N   │    │
│  ├──────────────────────────────────────────────────┤    │
│  │                                                    │    │
│  │  STREFA TREŚCI (contentY 1.0" → footerY 5.2")      │    │
│  │  = 1 IDEA/SLAJD: jeden wykres LUB jedna tabela      │    │
│  │  LUB max 6 bulletów (≤8 słów/bullet) LUB 1 macierz  │    │
│  │  2×2/waterfall/RAG-grid. Nigdy dwa niezależne        │    │
│  │  komunikaty na jednym slajdzie.                     │    │
│  │                                                    │    │
│  ├──────────────────────────────────────────────────┤    │
│  │ STOPKA (footerY 5.2" → 5.625")                     │    │
│  │  nazwa · confidentiality · numer slajdu             │    │
│  └──────────────────────────────────────────────────┘    │
│ margines 0.5"                                             │
└────────────────────────────────────────────────────────┘
      contentX 0.5"          contentW 9.0"
```

- **Marginesy:** 0.5" wszystkie strony (`GRID.contentX`/`margin` — już egzekwowane w #2, przyjąć jako
  standard dla #1 też, gdzie dziś nie ma jednego nazwanego stałej GRID).
- **1 idea/slajd** — reguła z zadania i z `DELIVERABLE_FORMATTING_SPEC.md` §3 („≤6 bulletów"); kanon
  rozszerza na WSZYSTKIE typy contentu (wykres/tabela/macierz), nie tylko bullet listy.
- **≥8 distinct layoutów** (już w spec) — kanon potwierdza, dodaje: layout dobierany wg typu contentu
  (`deckLayoutDecision.ts` już istnieje jako silnik decyzji — do wpięcia w konwergencję VF3-2).

---

## §6. Styl tabel — hairline, zebra-off, liczby tabular

Zgodnie z density-paradox z `VEGAS_RESEARCH.md` (§B.1/B.2: dane ciasne, chrome przestronny) i z regułą
TRIADA dla list UI („oddzielone WYŁĄCZNIE delikatną linią włoskową… nigdy zebra") — **przenosimy tę samą
doktrynę do eksportu**, mimo że `DELIVERABLE_FORMATTING_SPEC.md` §5 dziś dopuszcza zebra „gdy gęsto/szeroko":

- **Hairline, nie pełna siatka:** poziome linie 0.5-0.75pt między wierszami, kolor `gridline`/`border`
  motywu (nigdy czarny pełny). Pionowe linie WYŁĄCZONE domyślnie (Tufte/Few — już cytowane w spec §5).
- **Zebra OFF domyślnie** — spójnie z TRIADA UI. Odstępstwo: arkusz Excel z >30 wierszami i brakiem innego
  sposobu śledzenia wiersza wzrokiem może włączyć bardzo subtelny tint (4-6%, jak dziś `ZEBRA_HEX`
  `#F3F7FB` w `WorkbookStyler.ts`) — ale to WYJĄTEK per-arkusz, nie domyślne zachowanie każdej tabeli.
- **Nagłówek:** bold, tło `dominant`/12% tint (spec §5), dolny border 1pt, powtarzany na kolejnych
  stronach Word (już wspierane przez named styles w `documentDocxStyles.ts`).
- **Liczby = tabular, prawo-wyrównane, wyrównane dziesiętne** — identyczna reguła jak `TEXT_N` w UI
  (tabular-nums). Tekst/daty = lewo. Już poprawnie zaimplementowane w `WorkbookStyler.ts` (`currencyFormat`)
  i `documentDocxStyles.ts` (number formats) — kanon to tylko formalizuje jako regułę wiążącą, nie zmianę.

---

## §7. Wykresy — osie L5, legenda-chips, serie c-tag-1..12, zero gradientów/3D

- **Osie:** etykiety osi = `TEXT_L5`-rola (mikro, 9pt PPT / 8pt Word — patrz §2 tabela). Tytuł osi (jeśli
  potrzebny) = `TEXT_L4`-rola. Nigdy większe niż treść wykresu.
- **Legenda = chips, nie linia kolorowych kwadracików w rogu.** Odpowiednik `c-tag` chipów z UI (kolorowa
  kropka/pigułka + etykieta tekstowa), poziomo pod/nad wykresem, zawijana gdy >4 serie. Zero legendy
  „pływającej" nachodzącej na dane.
- **Serie = sekwencja `--c-tag-1..12`** (§3) — deterministyczna kolejność (seria 1 zawsze `c-tag-1` itd.),
  żeby ta sama kategoria danych miała ten sam kolor w każdym wykresie tego samego deliverable.
- **Zero gradientów, zero efektów 3D, zero cieni na słupkach/wycinkach** — płaskie wypełnienia, hairline
  obrys tam gdzie potrzebny kontrast (spójne z „zero gradientów blue→purple" z anty-wzorców
  `VEGAS_RESEARCH.md` §D.1 — AI-slop-look, śmierć wiarygodności u odbiorcy McKinsey/BCG).
- **Archetypy specjalne** (`chartSpecEngine.ts` — waterfall/bridge, macierz 2×2, RAG) już istnieją jako
  czyste specyfikacje danych (nie renderują pikseli) — kanon: kolory tych archetypów też z `c-tag`/semantyki
  statusu, nie z osobnej palety per-archetyp.
- **Zero pie/donut z >5 wycinkami** (czytelność) — jeśli nie ma to explicite w obecnym kodzie, to reguła
  do wpięcia przy VF3-3 jako walidacja `bundleDeckQa.ts`.

---

## §8. Trzy makiety opisowe (do akceptu na zrzutach — bramka B-P5)

★ Zgodnie z Zasadą #7 CLAUDE.md: to są makiety OPISOWE (tekst/ASCII), nie renderowane zrzuty — Piotr NIE
jest pierwszym testerem wizualnym. Prawdziwy render z mock-danymi (harness, bez logowania) i zrzut robi
robotnik VF3-2/3/4 PO akcepcie tego dokumentu tekstowego. Tu zatwierdzamy **strukturę i regułę**, nie piksele.

### Makieta 1 — Okładka (PPT/Word, motyw `executive`)
```
┌──────────────────────────────────────────────────────────┐
│ [logo klienta]                                            │
│                                                            │
│         PROJEKT ELKOMTECH · DIAGNOZA CYFRYZACJI            │  ← kicker L1, navy tint
│                                                            │
│         Rekomendacje strategiczne                          │  ← TEXT_N-rola, navy dominant,
│         Q3 2026                                             │     serif Merriweather (executive)
│                                                            │
│         ─── teal accent rule ───                          │
│                                                            │
│                                                            │
│                                          Confidential       │  ← L5, muted
│                                          [• Consultify]     │  ← crimson, mikro, stopka
└──────────────────────────────────────────────────────────┘
```
Reguła: navy dominant tło ALBO biały + navy tekst (zależnie od motywu); crimson WYŁĄCZNIE w mikro-znaku
Consultify dolny-prawy róg. Zero fioletu/gradientu.

### Makieta 2 — Slajd treści, 1 idea (macierz rekomendacji)
```
┌──────────────────────────────────────────────────────────┐
│ REKOMENDACJE · PRIORYTETYZACJA          [kicker L1]        │
│ Trzy inicjatywy o najwyższym ROI                [L2 tytuł]│
│ ────────────────────────────────────── (hairline teal)     │
│                                                            │
│   WYSOKI WPŁYW  ┌───────────┬───────────┐                 │
│                 │  Q2       │  Q1 ★     │  ← c-tag-1..4    │
│                 │  (rozważ) │  (rób teraz)│    per punkt   │
│                 ├───────────┼───────────┤                 │
│                 │  Q3       │  Q4       │                 │
│   NISKI WPŁYW   │  (odrzuć) │  (planuj) │                 │
│                 └───────────┴───────────┘                 │
│                 NISKI WYSIŁEK → WYSOKI WYSIŁEK              │
│                                                            │
│ Projekt Elkomtech         Confidential            12 / 24 │  ← stopka L5
└──────────────────────────────────────────────────────────┘
```
Reguła: JEDEN komunikat (priorytetyzacja), zero drugiego bloku obok. Osie L5. Legenda = 4 chipy nad
macierzą jeśli punkty mają kategorie (`c-tag-1..4`).

### Makieta 3 — Wykres wieloseriowy (waterfall wartości)
```
┌──────────────────────────────────────────────────────────┐
│ MOSTEK WARTOŚCI · FY26                    [kicker L1]      │
│ Od bazowego EBITDA do celu programu           [L2 tytuł]  │
│                                                            │
│  █████                                          ███████   │
│  █████    ▓▓▓▓▓         ░░░░░                   ███████   │
│  █████    ▓▓▓▓▓  ▒▒▒▒▒  ░░░░░   ▓▓▓▓▓           ███████   │
│  Bazowy   Init.1 Init.2 Init.3  Init.4          Cel       │
│  (total)  (c-tag-1)(c-tag-2)(c-tag-3)(c-tag-4)  (total)    │
│                                                            │
│  ⬤ Wzrost  ⬤ Spadek  ⬤ Suma total      ← legenda-chips     │
│                                                            │
│ Źródło: Model finansowy v3               [L5 caption]     │
└──────────────────────────────────────────────────────────┘
```
Reguła: słupki `total` = kolor `dominant`/navy (nie crimson, nie szary), słupki delta = sekwencja
`c-tag-1..N`, oś Y i etykiety = `TEXT_L5`-rola, zero 3D/gradientu, legenda pozioma jako chips pod tytułem
lub nad wykresem (nie w rogu nachodząc na słupki).

---

## §9. Doc ↔ Kod binding (do wypełnienia przy VF3-2/3/4 — dziś PUSTE, świadomie)

| Reguła kanonu | Kod SSOT docelowy | Dziś (realny stan) | Zadanie konwergencji |
|---|---|---|---|
| Paleta motywu 60-30-10 | `deliverables/themeRegistry.ts` | ✅ już zgodne | — |
| Crimson-only-logo | (brak wspólnego guarda) | częściowo (#1 tak, #2/#4 nie) | VF3-2 |
| Fonty z biblioteki | `docs/product/DELIVERABLE_FORMATTING_SPEC.md` §1 + `FORMATTING_FONT_LIBRARY` | ✅ zdefiniowane, embedding brak | VF3-2 (decyzja D1) |
| Skala typograficzna L1-Q↔pt | brak — dziś 2 równoległe skale (`PPT_TYPE_SCALE` vs `SIZING_BY_CLASS`) nie importują `src/styles/typography.ts` | ❌ | VF3-2 |
| Seria wykresu `c-tag-1..12` | brak | ❌ (§0 pkt 4) | VF3-3 |
| Cover/stopka/paginacja/metadane | częściowo (`documentPdfRenderer.ts`) | częściowe | VF3-2/4 |
| Siatka slajdu 1-idea | częściowe (`deckLayoutDecision.ts` istnieje) | częściowe | VF3-3 |
| Tabele hairline/zebra-off | ✅ już w większości zgodne | ✅ | — |
| Jeden pipeline PPTX (scalić #1+#2) | — | ❌ dwa żywe systemy | VF3-4 (decyzja D2, patrz §11) |
| Status Report PDF wciągnięty do wspólnego motywu | `reportPdfService.ts` | ❌ całkiem osobny | VF3-4 |

---

## §10. CZĘŚĆ B — lista czekowania (odbiór KAŻDEGO eksportu, literalnie, za każdym razem)

1. Okładka: brak crimson poza mikro-znakiem marki; kicker+tytuł+data widoczne; logo klienta (jeśli jest)
   nie mniejsze niż logo Consultify.
2. Stopka na KAŻDEJ stronie/slajdzie poza okładką: nazwa + numer + (confidentiality jeśli dotyczy).
3. Zero crimson w: tle slajdu, fill nagłówka tabeli, serii wykresu, statusie/RAG.
4. Każdy slajd = 1 idea (zero dwóch niezależnych komunikatów obok siebie).
5. Tabele: hairline poziomy, zero pełnej siatki, zero zebry (poza wyjątkiem Excel >30 wierszy), liczby
   prawo+tabular, tekst lewo.
6. Wykresy: zero gradientu, zero 3D/cienia, legenda jako chips (nie kwadraciki w rogu), osie = mikro-rola,
   serie kolorowo rozróżnialne i spójne z innymi wykresami tego samego pliku.
7. Fonty: para z `FORMATTING_FONT_LIBRARY`, max 2 kroje w całym dokumencie (nagłówek+treść), zero
   przypadkowego trzeciego fontu z wklejki.
8. Metadane pliku: `creator`=Consultify, `title`=nazwa deliverable (gdy zaimplementowane wg §4).
9. Motyw spójny między WSZYSTKIMI plikami tego samego deliverable (jeśli klient dostaje PPTX+DOCX+XLSX
   razem — ten sam navy/teal/inny motyw we wszystkich trzech, nie navy w jednym i indigo w drugim).
10. Weryfikacja WZROKIEM na renderze realnym (LibreOffice headless / eksport PDF podglądowy), nigdy
    „testy jednostkowe przeszły" jako jedyny dowód (Złota Reguła #1 CLAUDE.md).

---

## §11. Decyzje MVP — zatwierdzone 2026-08-02

- **D1 — Fonty:** MVP używa par Office-native, w pierwszej kolejności Aptos/Arial/Georgia. Nie uzależniamy
  poprawnego renderu od embeddingu Google Fonts. Rozbudowane fonty marki mogą wrócić po MVP.
- **D2 — Pipeline PPTX:** oba pipeline'y konwergują do jednego generatora i jednego systemu motywów.
  Starsza ścieżka może istnieć wyłącznie jako adapter migracyjny, nie drugi produkt wizualny.
- **D3 — Status Report PDF:** dołącza do wspólnego motywu Consultify/DBR77. Różnica operacyjna może zmienić
  gęstość i układ, ale nie markę, typografię ani semantykę statusów.
- **D4 — Status/RAG:** używamy wspólnej semantyki tokenów UI oraz zatwierdzonych wariantów print-safe
  wyprowadzonych z tych tokenów. Nie utrzymujemy niezależnych znaczeń kolorów w generatorach.
- **D5 — Metadane:** `creator=Consultify`; bez nazwiska konsultanta i innych danych osobowych w metadanych.
- **D6 — Branding:** w MVP wyłącznie Consultify/DBR77. Branding klienta i white-label pozostają poza MVP.

---

## Changelog

| Data | Zmiana |
|---|---|
| 2026-08-02 | Bramka B-P5 zamknięta. Zatwierdzono branding Consultify/DBR77, fonty Office-native, jeden pipeline PPTX, wspólny motyw PDF, wspólną semantykę RAG i metadane bez danych osobowych. |
| 2026-07-19 | Utworzony (VF3-1, worker-vf3-brand). Status: DRAFT do akceptu Piotra (bramka B-P5). Realny stan §0 zweryfikowany grepem 151 plików + czytaniem 5 systemów stylowania. |
