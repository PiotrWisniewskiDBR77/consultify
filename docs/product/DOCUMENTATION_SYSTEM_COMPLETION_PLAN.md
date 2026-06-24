# Plan domknięcia systemu dokumentacji Consultify → klasy konsultanta · 2026-06-24

> Cel: z dzisiejszego stanu (szybki generator POJEDYNCZYCH dokumentów + zbudowana-ale-niewpięta warstwa koordynacji) do: **spójna, obronna, wielodokumentowa wiązka z jednego briefu, z pamięcią, w żywym produkcie, bijąca konkurencję, na poziomie konsultanta-juniora**. Bazuje na: [`SYSTEM_DOCUMENTATION_REPORT_2026-06-24.md`](../qa/deliverables/SYSTEM_DOCUMENTATION_REPORT_2026-06-24.md) (luki) + [`BUSINESS_PLAN_GENERATOR_SPEC.md`](BUSINESS_PLAN_GENERATOR_SPEC.md) (§4 status F1-F5).
>
> Legenda efortu: S ≈ pół dnia · M ≈ 1-2 dni · L ≈ 3-5 dni · XL ≈ tydzień+. ⛔ = wymaga decyzji/akcji Piotra. Wszystko za `ENABLE_DELIVERABLES_PREMIUM` OFF dopóki nie powiem inaczej; staging→odbiór→prod; PROD (centerbeam) nietknięty bez osobnej zgody.

---

## FAZA 0 — Aktywacja fundamentu (zbudowane → żywe) · NAJWYŻSZY LEWAR
*Zamienia odpowiedź „czy mamy koordynację+pamięć wiązki" z NIE na TAK w żywym produkcie. Kod gotowy, przetestowany (194/194).*

| # | Zadanie | Efort | Status wejścia | Co odblokowuje |
|---|---|---|---|---|
| 0.1 | Route `POST /deliverables/business-plan` → `generateBusinessPlan(brief)` → SPINE (za flagą, fail-open) | S | orchestrator gotowy | Backend wiązki dostępny |
| 0.2 | Orchestrator karmi B4/B3/B1 ze SPINE (hero-numbers identyczne) w jednym wywołaniu | M | `spineTo*` gotowe | Spójna wiązka end-to-end |
| 0.3 | Wejście FE: komenda Teresy / przycisk „Zbuduj biznesplan" w Canvasie → wywołuje route, montuje 3 artefakty | M | chat function-calling wzorzec istnieje | Użytkownik klika → wiązka |
| 0.4 | Wpiąć `FinancialEngine` jako źródło tabel/raportów finansowych (nie tylko biznesplan) | M | silnik 11/11 | Rygor finansowy żywy |
| 0.5 | Deploy na staging + flaga ON na staging (klienci OFF) | S ⛔ | — | ⛔ Piotr: mechanizm deployu + branch |

**Milestone F0:** na stagingu, za flagą, jeden brief → spójny komplet (deck+raport+tabela) z identycznymi liczbami i walidacją CFO-review. **To jest „mamy koordynację+pamięć wiązki".**

---

## FAZA 1 — Pełna wiązka jako realne pliki
*Dziś: XLSX renderuje się z pliku ✅; DOCX/PPTX treść policzona, ale render do pliku idzie przez live-route (niespięte z wiązką).*

| # | Zadanie | Efort | Co odblokowuje |
|---|---|---|---|
| 1.1 | SPINE → DOCX (realny plik) przez `documentDocxRenderer` w ścieżce wiązki | M | Raport jako .docx |
| 1.2 | SPINE → PPTX (realny plik) przez pptx pipeline w ścieżce wiązki | M | Deck jako .pptx |
| 1.3 | „Pobierz komplet" — 3 pliki (.docx/.xlsx/.pptx) z jednej wiązki + defensibility appendix | S | Klient dostaje teczkę |

**Milestone F1:** jeden brief → 3 edytowalne pliki Office, spójne, gotowe do wysłania inwestorowi.

---

## FAZA 2 — Dowód i jakość wizualna decka (Gamma-killer)
*Jedyna nieodpalona niewiadoma programu + przewaga nad Gammą (jej słabość = 6-7 powtarzalnych layoutów).*

| # | Zadanie | Efort | Status wejścia | Co odblokowuje |
|---|---|---|---|---|
| 2.1 | **Renderowany head-to-head**: VTS/DBR77 deck → zdjęcia → VisionQA → ten sam prompt w Gammie → porównanie 1:1 | M ⛔ | wymaga żywego FE+render | Dowód „85% na papierze"→na oczy |
| 2.2 | Krok 1b PPTX honor `composition` (FE już honoruje) | M | 1a/1b FE gotowe | Kompozycja w .pptx |
| 2.3 | Krok 2 — gramatyka układu (12-col grid + archetypy, jeden generyczny renderer) | L | zaprojektowane w spec | Realny Gamma-killer |
| 2.4 | Auto-render grafik produktu z briefów decka (nano-banana w wiązce) | M | nano-banana gotowy | Ładne grafiki w decku |

**Milestone F2:** deck obroniony dowodem wizualnym + kompozycja bijąca powtarzalność Gammy + grafiki produktu.

---

## FAZA 3 — Domknięcie merytoryczne i parytet narzędziowy
*Zamyka luki vs konsultant (narracja) i vs Office/Airtable (funkcje).*

| # | Zadanie | Efort | Co odblokowuje |
|---|---|---|---|
| 3.1 | Wzmocnić market sizing: TAM bottom-up triangulacja + twardy gate `tam_unsourced` (dziś miękka flaga) | M | Obrona rynku jak konsultant |
| 3.2 | Raport: pełen answer-first/SCQA na sekcję + auto-TOC + cross-refs (Word parity) | M | Narracja konsultanta |
| 3.3 | Tabela: żywe formuły/computed + relacje/lookup + widoki (Airtable parity) | L | Tabela jak Airtable/Excel |
| 3.4 | Sensitivity + base/bull/bear w defensibility appendix raportu (silnik już liczy) | S | Obrona jak CFO |

**Milestone F3:** wiązka merytorycznie nie do odróżnienia od pierwszej wersji analityka; tabela/raport na poziomie narzędzi-liderów.

---

## FAZA 4 — Pamięć cross-project (sens C) · NAJWIĘKSZA
*„Wspólna pamięć dla WSZYSTKICH projektów" — dziś nie istnieje. Trwała warstwa wiedzy org czytana przez każdy generator.*

| # | Zadanie | Efort | Co odblokowuje |
|---|---|---|---|
| 4.1 | Model `OrgKnowledgeContext` — trwała, wersjonowana wiedza org (dane, decyzje, deliverable history) | L | Fundament pamięci |
| 4.2 | Każdy generator (B1/B3/B4 + orchestrator) czyta `OrgKnowledgeContext` jako grounding | L | Wszystkie dokumenty spójne z org |
| 4.3 | Wpiąć `unifiedDocEntityService` (most draft↔committed) + rozszerzyć na deck/table | M | Jedna encja per dokument, zero dubli |
| 4.4 | M17/M20 Outputs jako żywy indeks wiązek z link-by-ref do SPINE | M | Governance + odnajdywanie |

**Milestone F4:** każdy nowy dokument w każdym projekcie zna kontekst org i poprzednie deliverable. **To jest „wspólna pamięć dla wszystkich projektów".**

---

## FAZA 5 — Aktywacja produkcyjna ⛔
| # | Zadanie | Efort | Decyzja |
|---|---|---|---|
| 5.1 | FT-7 + odbiory manualne na stagingu (pakiety TESTY_M17-M20 gotowe) | M ⛔ | ⛔ Piotr odbiera |
| 5.2 | Head-to-head outputs vs Gamma/Airtable/Kimi (nasza strona gotowa) | S ⛔ | ⛔ Piotr porównuje |
| 5.3 | Prod (centerbeam) go-live per-org, klienci OFF first | S ⛔ | ⛔ Piotr: osobna świadoma zgoda |

---

## Sekwencja rekomendowana (CTO)
**F0 → F1 → F2.1 (dowód) → F3 → F2.2-2.4 → F4 → F5.** Uzasadnienie: F0 daje natychmiast „mamy koordynację+pamięć wiązki" (największy lewar, kod gotowy). F1 daje pliki do ręki. F2.1 (sam dowód wizualny) tani i domyka credibility. F3 domyka merytorykę. Reszta F2 (gramatyka) i F4 (pamięć cross-project) to większe inwestycje — po walidacji wartości na żywo. F5 = bramki Twoje.

## Co potrzebuję od Ciebie (decyzje)
1. **Mechanizm deployu na staging** + który branch (feat/deliverables-w1 niesie pracę innych agentów — git races).
2. **Demo-org na stagingu** do testów (org/login).
3. **Zakres tej rundy:** F0-F1 (szybka aktywacja wiązki) czy od razu F0-F3 (pełna jakość)?
4. **Czy F4 (pamięć cross-project) w tym pchnięciu**, czy jako osobny duży projekt po walidacji F0-F3?
5. Prod go-live — osobno, po zielonym stagingu.

## Stałe ograniczenia
Flaga OFF=byte-identyczne (klienci nietknięci) · harnessy PROD-safe (staging only) · commity chirurgiczne na `deliverables/` (branch współdzielony) · PROD = osobna zgoda.

---

## STATUS realizacji — 2026-06-24 (build autonomiczny)
Zakres rundy: **F0–F3 pełna jakość** (decyzja Piotra); F4 osobno po walidacji.

| Zadanie | Status | Dowód |
|---|---|---|
| F0.1 Route `POST /deliverables/business-plan` (za flagą, fail-open) | ✅ | tsc; `deliverablesGenerations.routes.ts` |
| F0.2 `generateBundle` runtime (brief→SPINE→B4/B3/B1, fail-soft) | ✅ | live 3/3 artefakty; `bundleGenerationRuntime.ts` |
| F1.1 Bundle → realne **DOCX + XLSX** | ✅ | 4/4 testy (PK-zip >2KB); `bundleExportRuntime.ts` |
| F3.1 Twardy gate `tam_unsourced` + spójna triangulacja | ✅ | testy; `assumptionsModel.ts` |
| F3.4 Defensibility appendix (scenariusze + założenia ze źródłem) | ✅ | test; `spineToDocPlan` |
| **199/199 testów deliverables, tsc czysty, flaga OFF, PROD nietknięty** | ✅ | commity c3ec6e18ae→bc3cd15da1 |

**Pozostało (heavy / wymaga środowiska):**
- F0.3 FE entry (przycisk/komenda) — buildowalne, ale **weryfikacja wymaga żywego stagingu** (nie buduję „na ślepo").
- F1.2 **PPTX** render — wymaga pipeline'u składania decka z planów B1 (cięższe).
- F2.2 PPTX honor composition · F2.4 auto-render grafik (nano-banana — **brak GEMINI key w stagingu**, fallback Unsplash).
- F3.2 auto-TOC + cross-refs (feature renderera DOCX).
- F2.1 head-to-head wizualny + F0.5 deploy + F5 odbiory — **⛔ wymagają decyzji/akcji Piotra** (deploy, demo-org, klucze, prod).
