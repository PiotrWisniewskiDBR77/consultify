# Analiza: wkład merytoryczny + wielowątkowy biznesplan — czy umiemy? · 2026-06-23

> Pytanie Piotra: jak powstają założenia/wkład merytoryczny do naszych dokumentów i czy poradzą sobie z trudnym wyzwaniem — kompletny biznesplan: analiza finansowa → raport Word → deck inwestorski reużywający założeń z raportu + tabelę finansową + ładne grafiki produktu. Odpowiedź oparta na recon kodu + ŻYWYM dowodzie (DBR77).

## 1. Jak DZIŚ powstaje wkład merytoryczny (recon kodu)

- **Każdy generator bierze własny `intent` + opcjonalne dane org i LLM produkuje treść.** B1 (deck `presentationLayoutDirectorService`), B3+content (`documentStructureGenerator`+`documentBlockContentGenerator`), B4 (`tableSchemaGeneratorService`).
- **Generatory NIE współdzielą kontekstu** — potwierdzone: żaden nie czyta wspólnego „snapshotu założeń". Deck nie wie, co napisał raport; tabela nie wie, jakie liczby przyjął deck. Spójność = przypadek, nie architektura.
- **Mamy realny stack finansowy** (`financialAnalysisService`, `financeStatementAnalyticsService`, `llmFinancialPipelineService` — 3-fazowy z **CFO-review**: bilans/P&L/CF reconciliation), ale **zorientowany na ANALIZĘ wgranych sprawozdań**, nie GENEROWANIE projekcji z założeń. Nie ma generatora „założenia → model 3-letni P&L/ARR/EBITDA".

**Wniosek:** wkład merytoryczny pojedynczego artefaktu jest mocny (LLM premium + reguły domenowe), ale **nie istnieje warstwa, która z jednego briefu policzyłaby wspólny kręgosłup (założenia+finanse) i nakarmiła nim wszystkie 3 generatory.**

## 2. Czy umiemy trudne wyzwanie? — ŻYWY DOWÓD (DBR77)

Zbudowałem wspólny kręgosłup DBR77 (założenia + model finansowy 3-letni, ręcznie autorowany = wkład merytoryczny) i wpuściłem go we **wszystkie 3 generatory** (`scripts/deliverables/_dbr77-bizplan.mts`, premium Sonnet). Wynik: [`runs/2026-06-23-DBR77-bizplan.md`](runs/2026-06-23-DBR77-bizplan.md).

| Artefakt | Wynik | Jakość |
|---|---|---|
| **Tabela finansowa (B4)** | 11 pól · 3 lata · 2 reguły CF · PREMIUM | Currency/percent/number, EBITDA z colorScale, marża dataBar |
| **Raport Word (B3+content)** | 7 sekcji · kpi/text/callout/bulletList/table/chart · 3 cytowania | **Klasy inwestorskiej**: problem (rynek 300 mld), break-even R2, 2 ryzyka krytyczne z mitygacją <30 dni, rekomendacja LTV/CAC 4,5 |
| **Deck inwestorski (B1)** | 11 slajdów · **10 layoutów** · 11 kompozycji · **11 briefów grafik produktu** | centered/kpi_grid_2x2/smart_diagram/split_lr/big_number/timeline_strip; briefy kontekstowe (np. „revenue bars + EBITDA margin line", „Chinese models via OpenRouter") |

**SPÓJNOŚĆ (kluczowy test wielowątkowości):** liczby przechodzą **identycznie** przez 3 artefakty — przychód 2390/4760/8800, EBITDA -20/800/2700, ARR 650→7200, ask 1,2 mln EUR. Deck reużywa założeń raportu, raport zawiera tabelę finansową, tabela = ten sam model. ✅

**Odpowiedź: TAK — to ćwiczenie jesteśmy w stanie przeprowadzić i dowiedliśmy tego.** Z jednym zastrzeżeniem (niżej).

## 3. Czego brakuje, by to był PRODUKT (a nie ręcznie zszyte)

Dowód powstał, bo **JA** policzyłem kręgosłup i przepiąłem go w 3 intenty. Żeby user napisał „zrób biznesplan DBR77" i dostał spójną wiązkę jednym kliknięciem, brakuje 3 rzeczy:

1. **Generator założeń + modelu finansowego** (`assumptions → 3-letni P&L/ARR/EBITDA/unit-economics`). Dziś autorowane ręcznie; stack finansowy analizuje wgrane sprawozdania, nie generuje projekcji. **To największa luka merytoryczna.**
2. **Orkiestrator wiązki (bundle)** — jeden serwis: policz kręgosłup RAZ → nakarm B4+B3+B1 tym samym → zapewnij spójność (numery, terminologia, paleta). Dziś generatory są ślepe na siebie.
3. **Auto-render grafik produktu** — briefy są (11), rendering nano-banana/Qwen-Image udowodniony osobno; w wiązce nie spięty automatycznie z briefami decka.

**Pomniejsze:** deck na Qwen (prod-default) timeoutuje przy 11 slajdach (121s, jeden ciężki call → fallback); na Sonnecie OK. Do prod-default decka: albo batch planera, albo wyższy timeout, albo szybszy model na deck.

## 4. Werdykt

- **Silnik merytoryczny pojedynczego artefaktu:** mocny, inwestorski (dowód: raport DBR77). ✅
- **Wielowątkowa spójna wiązka (deck+doc+table z jednych założeń + grafiki):** **wykonalna i zademonstrowana** — ale dziś wymaga ręcznie zszytego kręgosłupa. 🟡
- **Brakujący kawałek = warstwa orkiestracji + generator modelu finansowego** (3 punkty §3). To dobrze zdefiniowany, buildowalny następny krok — zamienia „możliwe z człowiekiem w pętli" w „jeden brief → spójny komplet".

## 5. Następny krok (propozycja)
Zbudować **BundleOrchestrator + AssumptionsModel**: (a) z briefu LLM generuje założenia+model finansowy (walidowany jak CFO-review), (b) orkiestrator karmi nim B4/B3/B1 i wymusza spójność, (c) auto-render grafik z briefów. Plus opcjonalnie: wyeksportować ten komplet DBR77 do realnych plików .docx/.xlsx/.pptx (pipeline eksportu gotowy) — żeby Piotr kliknął gotowe pliki.
