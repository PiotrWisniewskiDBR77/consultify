# D2 — Head-to-head RAPORT premium vs bar Kimi/Claude · Karta odbioru

**Test:** MQ-R11 (Head-to-head vs Claude/Kimi, ten sam temat DBR77) + MQ-R1 (raport audytowy)
**Data:** 2026-07-05 (aktualizacja G7: 2026-07-05, gałąź `feat/word-dok-D2-G7-lists`)
**Gałąź:** `feat/word-dok-D2-headtohead` → fix G7 na `feat/word-dok-D2-G7-lists` (bazuje na headtohead)
**Wejście:** golden-prompt „Raport z audytu procesów ICT i gotowości AI — Apator SA" (ai_audit_report, PL, executive, detailed, confidential)
**Silnik:** `buildDocumentSchemaPremium` (tier PREMIUM → `openrouter/z-ai/glm-4.6`, klucze z DB **trolley**) → `renderDocumentSchemaToDocxBuffer` / `...ToPdfBuffer` / `renderSchemaToMarkdown` (render bezpośrednio ze schematu — ZERO zapisu do DB)
**Dowód:** `apator-ict-ai-audit-D2.{docx,pdf,md,schema.json}` + `.genreport.json` (ten katalog) — oraz **`apator-ict-ai-audit-D2-G7fix.docx`** (re-render TEGO SAMEGO `schema.json` przez naprawiony `documentDocxRenderer.ts`, dowód G7)

Metryki z ostatniej (kanonicznej) generacji: 9 sekcji · 26 bloków · **5 tabel · 2 wykresy (1 z danymi→PNG, 1 pusty→pruned) · 2 KPI-stripy** · 14 290 znaków treści · **0 placeholderów · 0 chart_raster_failed** · docx 53,5 KB · pdf 70 KB.

**G7fix re-render:** ten sam schema.json → docx 52 441 B, 0 warnings. Strukturalnie: `word/numbering.xml` obecny z 2 zadeklarowanymi konfiguracjami (`abstractNumId=2` bullet `•`, `abstractNumId=3` decimal `%1.`); `word/document.xml` zawiera **23× `<w:numPr>`** (wszystkie 5 bloków `bullet_list` tego schematu, 0 `numbered_list` w tym konkretnym temacie — ale decimal-config i jego `numPr` potwierdzone osobno w golden teście `documentDocxGolden.test.ts`, patrz niżej). Tekst akapitów listy już NIE zawiera ręcznego „• "/„1. " — potwierdzone ekstrakcją `<w:t>` z każdego akapitu z `numPr`.

---

## KARTA ODBIORU — MQ-R11 · Raport audytowy AI (Apator ICT) · 2026-07-05

```
────────────────────────────────────────────────────────────
KOMPLETNOŚĆ   15/16   próg ≥90% · żaden wymiar=0            → PASS
MERYTORYKA     9/10   próg ≥80% · M1≠0 · M2≠0               → PASS
GRAFIKA       15/16   próg ≥80% · żaden wymiar=0            → PASS  (było 13/16, G7 0→2)
HEAD-TO-HEAD  nasz 15 vs Kimi/Claude ~15  (grafika)        → PASS  (G7 naprawiony)
────────────────────────────────────────────────────────────
WERDYKT:  ODEBRANY
powód: wszystkie bramki PASS; G7 (listy) naprawiony — numbering API (numPr +
       numbering.xml), zweryfikowany strukturalnie na realnym schemacie D2.
       Jedyny pozostały miękki minus: G6 branding (-1, brak logo per-org) —
       nie jest twardym zerem, nie blokuje odbioru.
```

### 3A. Kompletność — 15/16
| # | Wymiar | Ocena | Uzasadnienie |
|---|--------|:-----:|--------------|
| K1 | Okładka + tytuł | 2 | coverPage=true; tytuł + typ + data + confidentiality na okładce |
| K2 | Spis treści | 2 | toc=true; TOC obecny, 9 sekcji + Sources (21 Heading1 refs w docx) |
| K3 | Wszystkie sekcje | 2 | wszystkie 9 sekcji outline wypełnione realną treścią |
| K4 | Brak placeholderów | 2 | **0 wystąpień** „placeholder" w docx.xml i w PDF (po fixie prune) |
| K5 | Tabele zasilone | 2 | 5 tabel z danymi (zakres, maturity, opportunities MECE, RAID, portfel inicjatyw z budżetem/ROI) |
| K6 | Wykresy/KPI | 2 | 2 KPI-stripy (AI Readiness 3.2/5, budżet 8,2M PLN…) + 1 wykres renderuje jako PNG; pusty wykres pruned (nie placeholder) |
| K7 | Cytaty/źródła | 2 | sekcja Sources z 3 realnymi źródłami (document/interview/dataset), poprawnie sformatowana |
| K8 | Stopka/numeracja | 1 | footer + PAGE field obecne; confidentiality label; -1 bo brak twardej weryfikacji ciągłości numeracji przez Word (parytet OOXML potwierdzony, nie render Worda) |

### 3B. Merytoryka — 9/10
- **M1 grounding (kryt.) = 2** — sekcje niosą konkretne dane (65% gotowości, 42% kompletność danych, ROI 220/180/160%, budżet 8,2M PLN, zwrot 14,5M PLN), zakotwiczone w opisie źródeł; nie ogólniki.
- **M2 język PL/EN (kryt.) = 2** — spójny profesjonalny polski (nagłówki outline EN z template, treść PL — mieszany, patrz uwaga niżej).
- M3 struktura logiczna = 2 — answer-first (rekomendacja+budżet na wejściu), narracja audyt→stan→szanse→ryzyka→inicjatywy→roadmapa.
- M4 brak filler = 2 — treść gęsta, action-titles („Rekomendacja: Priorytetyzacja… z budżetem 8,2M PLN").
- M5 spójność rejestru = 1 — rejestr raportu/executive utrzymany; -1: **nagłówki sekcji EN (z outline template) + treść PL** — dwujęzyczny szew (do naprawy w outlineFromTemplate/planner dla PL intake).

### 3C. Grafika — 15/16 (po fixie G7; było 13/16)
| # | Wymiar | Ocena | Uzasadnienie |
|---|--------|:-----:|--------------|
| G1 | Hierarchia typografii | 2 | H1/H2/H3/body ze stylów nazwanych (16pt/13pt/11pt), 21 Heading1 |
| G2 | Odstępy/akapity | 2 | marginesy A4 2,0/2,3cm; spacing per blok; oddech zachowany |
| G3 | Styl tabel | 2 | **12 tblBorders + 56 w:shd** — realne ramki + traffic-light tło komórek (czerwony/bursztyn/zielony na Integration/Quality/Real-time) |
| G4 | Wykresy | 2 | wykres = **osadzony PNG 960×540 RGBA** w DOCX (`<w:drawing>`) i XObject/Image w PDF — NIE placeholder |
| G5 | Callouty/cytaty | 2 | callouty (NOTE) z akcentowym paskiem + tłem tonalnym, kursywa; wyróżnione |
| G6 | Okładka/branding | 1 | okładka + confidentiality; -1: brak logo klienta (nie podano assetu) i palety brandowej per-org |
| **G7** | **Listy** | **2** | **NAPRAWIONE (2026-07-05, `feat/word-dok-D2-G7-lists`).** `renderListBlocks` używa teraz natywnego `docx` numbering API: `Document({ numbering: { config: [...] } })` z dwoma abstract-configami (bullet `•`, decimal `%1.`), każdy list-`Paragraph` niesie `numbering: { reference, level: 0 }` zamiast ręcznego tekstu. Dowód strukturalny na re-renderze realnego D2 schema.json: `word/numbering.xml` obecny (abstractNumId 2=bullet/`•`, 3=decimal/`%1.`), `word/document.xml` ma **23× `<w:numPr>`** (wszystkie list-akapity tego runu), tekst akapitów bez „• "/„1. ". Golden test `documentDocxGolden.test.ts` dodatkowo dowodzi decimal-ścieżkę (fixture ma i bullet, i numbered list) — nowy test „renders bullet and numbered lists as real Word list paragraphs (G7)" zielony. PDF (pdfkit) świadomie NIE dotknięty — brak natywnego pojęcia listy w pdfkit, ręczny prefiks tam jest akceptowalną konwencją, poza zakresem G7. |
| G8 | Wierność export | 2 | DOCX i PDF NIE degradują do tekstu: tabele z ramkami+fillami, wykres jako obraz w OBU, 0 placeholderów w OBU; parytet potwierdzony parsowaniem plików |

**TWARDE BRAMKI:**
- ✅ Żaden wymiar Kompletności = 0 (min K8=1).
- ✅ Żaden wymiar Grafiki = 0? **TAK, po fixie G7 (0→2) — żaden wymiar Grafiki = 0.** Suma 15/16 ≥80% i bramka koniunkcyjna spełniona → GRAFIKA formalnie ODEBRANA.
- ✅ G8 wierność exportu — **potwierdzona**: tabele mają ramki/nagłówki/fille (nie pipe-text, nie surowy JSON), wykres to OBRAZ (PNG) nie placeholder w DOCX i PDF. **Bug C5 (chart→placeholder) potwierdzony jako naprawiony** + dodatkowo zabezpieczony fixem prune (pusty wykres nie leci placeholderem).

---

## Head-to-head vs bar Kimi/Claude (per wymiar graficzny G1–G8)

Ocena wg twardych parametrów rubryki + `DELIVERABLES_GRAPHIC_PARAMETERS.md` (brak dostępu do żywego Kimi/Claude — porównanie do opisanego bara).

| Wymiar | Nasz | Bar Kimi/Claude | Gdzie dorównujemy / przegrywamy |
|--------|:----:|:---------------:|----------------------------------|
| G1 typografia | 2 | 2 | **Dorównujemy** — spójna hierarchia H1-H3/body, styl nazwany |
| G2 odstępy | 2 | 2 | **Dorównujemy** — oddech, spójne marginesy |
| G3 tabele | 2 | 2 | **Dorównujemy/wygrywamy** — ramki + conditional cell fill (traffic-light) osadzone w OOXML; Kimi/Claude często dają tabele bez CF w komórkach |
| G4 wykresy | 2 | 2 | **Dorównujemy** — wykres jako rasteryzowany obraz (chart.js/napi-canvas), nie ASCII/placeholder |
| G5 callouty | 2 | 2 | **Dorównujemy** — akcentowy pasek + tło tonalne |
| G6 branding | 1 | 2 | **Przegrywamy** — brak logo/palety per-org (mechanika coverLogoAsset istnieje, asset nie podany) |
| **G7 listy** | **2** | **2** | **Dorównujemy (naprawione 2026-07-05)** — `numbering` API: `numPr`/`numbering.xml` realne, auto-renumeracja i wcięcie hanging edytowalne w Wordzie, tak jak referencja |
| G8 wierność export | 2 | 2 | **Dorównujemy** — parytet DOCX/PDF, brak degradacji do tekstu |

**Werdykt head-to-head:** **PASS.** Po naprawie G7 dorównujemy barowi Kimi/Claude na 7/8 wymiarów graficznych (G3 tabele z CF potencjalnie wygrywamy), przegrywamy jedynie miękko na **G6 (branding, -1)** — logo/paleta per-org nie jest twardym zerem i nie blokuje koniunkcji rubryki (sekcja 6: blokuje tylko wymiar=0).

**Pozostało do pełni (opcjonalne, nie blokujące):** G6 (logo klienta + paleta brandowa per-org) — mechanika `coverLogoAsset` już istnieje, brakuje tylko podanego assetu per organizację.

---

## Defekty jakości — naprawione vs udokumentowane

### NAPRAWIONE w tej sesji (commit w tym katalogu/gałęzi)
1. **Puste wykresy/tabele → placeholder w wygenerowanym exporcie (G4/K4/K5/K6).**
   Content-gen (LLM) sporadycznie emituje pustą powłokę wykresu (`series:[]`) lub tabelę bez wierszy → renderery wstawiały „[Figure N chart placeholder…]" / „[Table placeholder…]" do finalnego DOCX/PDF (defekt wierności G8/K4).
   **Fix:** `pruneUnrenderableBlocks(schema)` w `documentDocxStructure.ts` — render-time (NIE mutuje zapisanego schematu, edytor nadal pokazuje pustkę jako afordancję), wpięty na wejściu OBU rendererów (`renderDocumentSchemaToDocxBuffer`, `renderDocumentSchemaToPdfBuffer`). Konserwatywny: usuwa TYLKO bloki bez ŻADNYCH danych.
   Dowód: run kanoniczny ma 2 wykresy w schemacie (1 pusty, 1 z danymi) → **0 placeholderów, 0 chart_raster_failed, 1 PNG osadzony**.

2. **G7 — listy nie były prawdziwymi listami Word (jedyny twardy bloker odbioru D2 — NAPRAWIONE 2026-07-05, `feat/word-dok-D2-G7-lists`).**
   `renderListBlocks` (DOCX) sklejał ręczny prefix „• "/„1. " w `Paragraph` body — brak `numbering` na `Document` i `numPr`/`ilvl` w paragrafach (0 numPr w docx.xml).
   **Fix:** dwie abstract-numbering-konfiguracje zadeklarowane na `Document({ numbering: { config: [...] } })` (`DOCX_NUMBERING_CONFIG` w `documentDocxRenderer.ts`) — bullet (`LevelFormat.BULLET`, `text:'•'`) i decimal (`LevelFormat.DECIMAL`, `text:'%1.'`), każdy poziom 0, wcięcie hanging 720/360 twips. Każdy list-`Paragraph` referencje przez `numbering: { reference, level: 0 }` zamiast tekstowego prefiksu w `TextRun`.
   Model danych (`BlockListContent.items: string[]`) jest płaski (brak zagnieżdżenia w schemacie) → jeden poziom (0) per config wystarcza; gdyby zagnieżdżone listy pojawiły się później, trzeba dodać kolejne `levels` i przekazać `level` przez `renderListBlocks`.
   **Dowód:** (a) nowy test w golden `documentDocxGolden.test.ts` — unzipuje `word/numbering.xml` (potwierdza `w:numFmt=bullet` i `w:numFmt=decimal`), liczy `<w:numPr>` w `document.xml` (≥6, 3 bullet + 3 numbered z fixture), i sprawdza że stary ręczny prefiks zniknął z tekstu run. (b) re-render REALNEGO schema.json z D2 (`apator-ict-ai-audit-D2-G7fix.docx`) — `word/numbering.xml` obecny (abstractNumId 2=bullet/`•`, 3=decimal/`%1.`), `document.xml` ma 23× `<w:numPr>` (wszystkie 5 bloków bullet_list tego konkretnego tematu), tekst akapitów bez „• "/„1. ".
   PDF (pdfkit) świadomie **nie dotknięty** — brak natywnego pojęcia listy, ręczny prefiks tam pozostaje akceptowalną konwencją i jest poza zakresem rubryki G7 („Word outline").
   Testy dotknięte: `server/src/services/documentStudio/__tests__/documentDocxRenderer.test.ts` (11/11 zielone, bez zmian w asercjach) + `tests/unit/deliverables/documentDocxGolden.test.ts` (14→15 testów po dodaniu G7-assercji, wszystkie zielone, zero regresji w istniejących).

### UDOKUMENTOWANE — NIE ruszone (dla orkiestratora)
3. **M5 — dwujęzyczny szew: nagłówki sekcji EN (outline template) + treść PL** dla intake `language:'pl'`. `outlineFromTemplate`/`planDocumentOutline` nie lokalizują tytułów sekcji pod język intake. Kosmetyczne, ale widoczne w raporcie PL.
4. **KPI delta „0" zamiast pominięcia.** System-prompt content-genu każe POMIJAĆ delta gdy brak baseline („never output 0"), a normalizer KPI przepuszcza `delta:"0"` (widoczne w Executive Summary KPI jednego z runów). Niski priorytet.
5. **Nagłówki tabel bywają zdublowane / „Col1/Col2/Col3"** — LLM czasem wkłada nagłówki jako pierwszy wiersz danych LUB gubi klucze kolumn → renderer humanizuje klucze (Col1…) i pokazuje realny nagłówek w wierszu 1. Normalizer tabel mógłby deduplikować. Niski priorytet.
6. **Niestabilność strukturalna B3 (nie defekt renderera).** Structure-planner (LLM openrouter/glm-4.6) sporadycznie timeout'uje (241s abort) → fail-open do prozy heading+paragraph (0 tabel/wykresów). To latencja modelu, nie kod; ale oznacza, że bogactwo premium bywa niedeterministyczne. Rozważyć retry/wyższy timeout dla kroku struktury.
7. **G6 — brak logo klienta / palety brandowej per-org.** Mechanika `coverLogoAsset` istnieje w rendererze; brakuje tylko podanego assetu per organizację. Miękki minus (-1), nie blokuje odbioru.

---

## Bezpieczeństwo DB
- Serwer/skrypt użył **trolley** (`trolley.proxy.rlwy.net`), potwierdzone w logu `[Postgres] Config host=trolley`. **Nigdy** centerbeam, **nigdy** `.env.local`.
- **Zero rekordów testowych w trolley:** render szedł bezpośrednio ze schematu (bez `materializeDocumentArtifact`/wave5-persist). Weryfikacja: `SELECT count(*) FROM wave5_artifacts WHERE title ILIKE '%Apator%'` = **0**. Nic do sprzątnięcia.
