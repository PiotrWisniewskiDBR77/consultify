# Raport: system dokumentacji Consultify — pamięć, koordynacja, vs konkurencja, vs konsultant · 2026-06-24

> Pytanie Piotra: (1) czy system MA już wspólną pamięć dla wszystkich projektów i koordynację między typami dokumentów; (2) jak działamy vs konkurencja; (3) czy jesteśmy już tak dobrzy jak fizyczny konsultant robiący te dokumenty. Odpowiedź oparta na recon żywego kodu 2026-06-24 — rozróżnienie **ŻYWE** (wpięte, klienci używają) vs **ZBUDOWANE** (kod gotowy, za flagą/niewpięte) vs **BRAK**.

## 1. Wspólna pamięć + koordynacja — TRZY znaczenia, uczciwie

| Znaczenie | Stan | Prawda |
|---|---|---|
| **A. Spójność w JEDNEJ wiązce** (deck+doc+table z jednego briefu dzielą założenia/liczby) | 🟡 ZBUDOWANE, niewpięte | `BundleOrchestrator`+`BusinessPlanSpine` zbudowane i dowiedzione E2E (DBR77 z briefu, hero-numbers identyczne), ale **NIE wpięte w żaden route** — w żywym produkcie jeszcze nie działa |
| **B. Koordynacja między typami w ŻYWYM produkcie** | ❌ BRAK | Generatory B1/B3/B4 są **ślepe na siebie** — każdy z własnego intentu, zero wspólnego kontekstu. Deck=jedna encja; doc ma most draft↔committed (`unifiedDocEntityService`, opt-in/niewpięte); tabela osobno |
| **C. Wspólna pamięć dla WSZYSTKICH projektów** (trwała wiedza org używana przez każdy dokument) | ❌ BRAK | Brak trwałej cross-project pamięci dokumentów. Grounding na danych org jest per-generacja i **nawet 3 generatory go nie współdzielą**. M17/M20 Outputs = indeks link-by-ref + governance, NIE wspólny mózg |

**Bezpośrednia odpowiedź:** **Jeszcze NIE.** Zbudowałem warstwę koordynacji (wspólny SPINE) i udowodniłem ją E2E, ale jest za flagą i niewpięta. Żywy produkt nadal generuje każdy typ dokumentu niezależnie. Wspólnej pamięci „dla wszystkich projektów" (sens C) nie ma w ogóle — to inna, większa warstwa.

## 2. Architektura systemu dokumentacji (warstwy)

```
ŻYWE (klienci):   Chat/Canvas ─► B1 deck │ B3+content doc │ B4 table   (NIEZALEŻNE)
                          │             └─ eksport: PPTX/PDF · DOCX/PDF · XLSX (realne pliki)
                          └─ M17/M20 Outputs = indeks link-by-ref + governance (nie magazyn, nie mózg)
                  unifiedDocEntityService = most draft↔committed DLA DOC (opt-in, niewpięte)

ZBUDOWANE (flaga OFF / niewpięte):
  BusinessPlanSpine (SoT) ─► AssumptionsModel ─► FinancialEngine(CFO-review) ─► BundleOrchestrator
       └─ jeden brief → spójna wiązka, hero-numbers identyczne, walidacja inwestycyjna [DOWÓD: DBR77]
  Premium brain (Qwen/Sonnet) + kompozycja decka (1a/1b) + AI grafiki (nano-banana) — za ENABLE_DELIVERABLES_PREMIUM
```

## 3. Jak działamy vs konkurencja

Legenda: ✅ mamy żywe · 🟡 zbudowane/niepełne · ❌ brak. Lider: PPT/Word/Excel + Gamma/Airtable/Kimi.

### 3A. Prezentacja vs Gamma/PowerPoint
| Zdolność | MY | Lider |
|---|---|---|
| Generacja AI z treści | ✅ | ✅ Gamma |
| **Edytowalny natywny PPTX** (nie raster) | ✅ | 🟡 Gamma (słabszy eksport) / ✅ PPT |
| Kompozycja slajdu (nie 1 z N szablonów) | 🟡 1a+1b (FE) | ❌ Gamma (6-7 powtarzalnych) ← **nasza szansa** |
| Biblioteka layoutów / archetypy | ✅ 17 intent + 29 templates | ✅ |
| AI grafiki z promptu | 🟡 zbudowane, niespięte w wiązce | ✅ Gamma |
| Wykresy natywne ≤6 serii | ✅ | ✅ |
| **Dowód wizualny head-to-head** | ❌ nigdy nie odpalony | — |

### 3B. Tabela vs Airtable/Excel
| Zdolność | MY | Lider |
|---|---|---|
| Typowany schemat z intentu | ✅ | 🟡 (ręcznie) |
| Conditional formatting (dataBar/colorScale/iconSet) | ✅ | ✅ |
| **Eksport .xlsx ze stylami+CF (round-trip)** | ✅ dowód | ✅ Excel / 🟡 Airtable |
| Formuły/computed/relacje/lookup | 🟡 schema, nie żywe formuły | ✅ |
| PivotTable / widoki (kanban/calendar) | ❌ | ✅ Airtable/Excel |
| **Model finansowy 3-statement liczony** | 🟡 FinancialEngine (niewpięty) | ✅ Excel (ręcznie) |

### 3C. Raport vs Kimi/Word
| Zdolność | MY | Lider |
|---|---|---|
| Generacja AI bogatej struktury (kpi/callout/table/chart/cytaty) | ✅ dowód (31 bloków/7 typów) | 🟡 Kimi (markdown) / ✅ Word ręcznie |
| **Edytowalny natywny DOCX** | ✅ | 🟡 Kimi / ✅ Word |
| Answer-first / Minto / action-titles | 🟡 częściowo (mocny w prozie) | ✅ konsultant |
| Auto-TOC / cross-refs / bibliografia | 🟡 cytowania ✅, reszta częściowo | ✅ Word |
| Grounding na realnych danych org | 🟡 możliwe, niespięte | ❌ Gamma/Kimi |

**Nasz moat (gdzie wygrywamy):** edytowalne natywne eksporty (PPTX/XLSX/DOCX tam, gdzie konkurencja rasteryzuje/markdownuje) + strukturalne bogactwo + grounding na danych org + **zintegrowana wiązka z jednego briefu** (czego nie ma ani Gamma, ani Airtable, ani Kimi). To nie „lepszy Gamma" — to **wiązka deliverable konsultanta**.
**Nasze luki (gdzie przegrywamy):** dowód wizualny decka (nieodpalony), żywe formuły/Pivot tabeli, pełen answer-first w raporcie, a nade wszystko — **koordynacja i pamięć są zbudowane, nie wpięte** (sekcja 1).

## 4. Czy jesteśmy już tak dobrzy jak fizyczny konsultant? — wymiar po wymiarze

| Wymiar konsultanta | Nasz stan | Werdykt |
|---|---|---|
| **Szybkość** | minuty vs tygodnie | 🟢 **Miażdżymy** — to nasza decydująca przewaga |
| **Wierność pliku** (edytowalny PPTX/DOCX/XLSX) | ✅ żywe | 🟢 Na poziomie / lepiej niż przeciętny analityk |
| **Bogactwo strukturalne** (kpi/callout/wykres/CF/cytaty) | ✅ dowód | 🟢 Na poziomie dobrego analityka |
| **Obronne założenia** (driver-tree, TAM/SAM/SOM, source) | 🟡 zbudowane (Plan B), niewpięte | 🟡 Potencjalnie tak — gdy wpięte |
| **Rygor finansowy** (3-statement, CFO-review) | 🟡 silnik 11/11, niewpięty; żywy stack analizuje sprawozdania | 🟡 Potencjalnie tak — gdy wpięte |
| **Spójność wielodokumentowa** (jedna historia, hero-numbers) | 🟡 orchestrator zbudowany, niewpięty | 🟡 Potencjalnie tak — gdy wpięte |
| **Narracja** (Minto/SCQA/„so-what") | 🟡 mocna proza, częściowa doktryna | 🟡 Blisko analityka, nie partnera |
| **Dowód wizualny** (slajd obok slajdu top-decka) | ❌ nieodpalony | 🔴 Niewiadoma |
| **Osąd / kontekst klienta / odpowiedzialność** | brak (LLM) | 🔴 **Tu senior konsultant wygrywa** — relacja, osąd, accountability, niuans branżowy |

### Werdykt
- **vs JUNIOR analityk robiący pierwszą wersję wiązki deliverable:** zbliżamy się do parytetu, a po szybkości i wierności pliku przewyższamy — **gdy wpniemy koordynację+założenia+finanse** (dziś zbudowane, nie żywe). Bez wpięcia: jesteśmy szybkim, dobrym generatorem POJEDYNCZYCH dokumentów, nie spójnej wiązki.
- **vs SENIOR partner:** **jeszcze nie.** Osąd, kalibracja pod klienta, odpowiedzialność i niuans to ludzki moat, którego nie zbudowaliśmy (i którego LLM sam nie da).

## 5. Co zamyka lukę (priorytetowo)
1. **Wpiąć BundleOrchestrator+SPINE w route za flagą** → realizuje sens A+B (koordynacja+pamięć w wiązce) w żywym produkcie. To największy, najtańszy skok — kod gotowy.
2. **Renderowany head-to-head decka** (slajdy vs Gamma) — domyka jedyną niewiadomą wizualną (sekcja 3A).
3. **Wpiąć FinancialEngine** jako żywe źródło tabel/raportów finansowych (dziś niewpięty).
4. **Sens C (pamięć cross-project):** trwała warstwa wiedzy org czytana przez każdy generator — osobny, większy projekt (nierozpoczęty).
5. Żywe formuły/Pivot tabeli; pełen answer-first/auto-TOC raportu; auto-render grafik decka.

## 6. Podsumowanie jednym zdaniem
**Zdolność konsultanta-juniora (spójna, obronna, wielodokumentowa wiązka) jest ZBUDOWANA i dowiedziona, ale nie AKTYWNA** — żywy produkt to dziś szybki, wierny plikowo generator pojedynczych dokumentów, bijący konkurencję na eksporcie i integralności, lecz koordynację, pamięć i rygor finansowy ma w szufladzie za flagą, a osąd seniora pozostaje ludzki.
