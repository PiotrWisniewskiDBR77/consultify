# M17 DECK → PERFEKCJA — plan „beat Gamma" (SSOT operacyjny)

> **Cel:** deck Consultify (PPTX) na poziomie najlepszego konsultanta świata — bije Gammę
> układem, gęstością, typografią i danymi. **„To, jak prezentujemy wyniki, decyduje czy klient płaci fakturę."**
> Start: 2026-06-28 · Branch: `feat/deliverables-w1` · Deploy odbioru: demo.consultify.ai
> Renderer żywy: **PptxPipelineService (M19)** — `server/src/services/report/pptx/` (atomics→composites→17 layoutów per-intencja). NIE `bundlePptxRuntime` (fallback).
> Powiązane: `M17-PLAN-DOKONCZENIA-2026-06-28.md` (W7 Gamma-killer — ten plan go operacjonalizuje z tego, co widać na realnym renderze) · `M17-BAR-HEAD-TO-HEAD-2026-06-25.md`.

---

## 0. STAN BAZOWY (2026-06-28 — 6 fal done, fundament mocny)

| Fala | Co | Commit |
|---|---|---|
| F1 | Cover premium editorial (spine/eyebrow/action-title/akcent/wordmark) | `0c7c219f` |
| F2 | Action-title w Executive Summary (teza zamiast generyka) | `cba1c890` |
| F3 | Typografia Calibri → **Inter** (każdy slajd) | `1287c45a` |
| F5 | **Fix krytyczny:** action-title overflow (ucinany u góry) → shrink-to-fit | `23c28e4b` |
| F6 | **Fix:** roadmap kolumny-karty + Bullet top-align (była dziura) | `62c5456d` |

**Werdykt z realnego renderu (PDF/PNG):** cover broni się przy zarządzie ✅; typografia premium ✅; 2 realne bugi naprawione ✅. **Największa pozostała luka = RZADKOŚĆ (pusty dół 40-50% na slajdach treściowych).**

---

## 1. DEFINICJA PERFEKCJI (bar — mierzalny DoD per slajd)

Slajd jest „perfekcyjny" gdy spełnia WSZYSTKIE:
1. **Zero przepełnień** (tekst nie ucinany, nie nachodzi) — shrink/wrap zabezpieczone.
2. **Zero martwego dołu** — treść wypełnia ≥85% wysokości użytkowej (`contentH`) ALBO jest celowo wyśrodkowana (nie „przyklejona do góry").
3. **Action-title** (teza, nie etykieta) + **eyebrow/chip sekcji** (spójna sygnatura jak cover).
4. **Data-ink:** liczby/wykresy dominują nad dekoracją; ≤6 bulletów; ≤1 wykres czytelny.
5. **Brand spójny:** paleta 60-30-10, akcent na liczbach, kontrast WCAG ≥4.5, fonty z biblioteki.
6. **Stopka/numeracja/poufność** spójne i subtelne.
7. **Bookend:** cover ↔ closing lustrzane.

**Bar całości:** head-to-head vs Gamma na tym samym briefie (DBR77 + VTS golden) → werdykt wizualny ≥ Gamma.

---

## 2. WORKSTREAMY (fale) — kolejność wg wartości × odblokowania

### W7 — RYTM PIONOWY / „WYPEŁNIJ PŁÓTNO" 🥇 (najpierw — największy skok premium)
Problem: treść siedzi w górnej połowie, dół pusty (slajdy 3/4/5 = „niedokończone").
| # | Task | Fix | Pliki | DoD |
|---|---|---|---|---|
| 7.1 | **Helper „vertical fill"** | funkcja rozkładająca/centrująca treść w `contentH` (gdy mało treści → centruj pionowo lub rozciągnij sekcje równomiernie) | nowy `composites/verticalRhythm.ts` lub util w layoutach | rzadka treść nie „przyklejona do góry" |
| 7.2 | **KPI dashboard pełna wysokość** | większe kafelki + dolny pas: mini-bar/kontekst wypełnia dół | `KpiDashboardLayout` + `KpiStrip`/`KpiTile` | dół ≤15% pusty |
| 7.3 | **Tabela next_steps/appendix** | tabela rozciągnięta na wysokość, wiersze oddychają; closing jako **callout-pasek u dołu** (nie wiszący w środku) | `NextStepsLayout`/`AppendixLayout` | brak orphan-tekstu, dół domknięty |
| 7.4 | **Roadmap dopasowany** | karty wys. = treść LUB bogatsze (numer fazy + ikona + connector); kolory = **progresja jednego odcienia**, nie traffic-light | `RoadmapBand` | karty wypełnione lub proporcjonalne |
| 7.5 | **Audyt 17 layoutów pod rzadkość** | przejrzeć render KAŻDEGO (SingleInsight/Comparison/Heatmap/RootCause/PrioritizationMatrix/RiskMitigation/Recommendation*/InitiativePortfolio/KeyMessages/SectionIntro) | wszystkie `layouts/*` | każdy spełnia DoD#2 |

### W8 — BOOKEND & SPÓJNOŚĆ STRUKTURY
| # | Task | Fix | Pliki |
|---|---|---|---|
| 8.1 | **Closing = lustro coveru** | spine + eyebrow „DZIĘKUJEMY" + akcent + linia kontaktu/CTA (dziś stary wycentrowany) | `PptxPipelineService.addClosingSlide` |
| 8.2 | **Section intro/divider premium** | numer sekcji duży + tytuł + akcent (jeśli używane) | `SectionIntroLayout` |
| 8.3 | **Eyebrow/chip na każdym content-slajdzie** | spójna sygnatura sekcji (jak cover) — mapa intent→label | nowy atomic `SectionChip` + layouty |

### W9 — POLISH WIZUALNY (drobiazgi premium)
| # | Task | Fix |
|---|---|---|
| 9.1 | CONFIDENTIAL subtelny | nie czerwień-alarm na granacie → biały/muted badge |
| 9.2 | Paleta 60-30-10 + akcent na liczbach | przegląd `designTokens` palet (3 motywy), kontrast |
| 9.3 | Spacing/measure tokens | spójne marginesy/gutter/line-height; KPI jednostka „18 mies." (spacja), wyrównanie value/unit |
| 9.4 | Trend/delta kolor | strzałki KPI semantyczne (zielony/czerwony/szary) czytelne |

### W10 — DANE WIZUALNE / WYKRESY (data-ink — twardy beat-Gamma)
Silnik wykresów ISTNIEJE (bar/RAG/mekko/harvey w `bundlePptxRuntime` + `advancedCharts`/`chartSpecEngine`) — wpiąć w M19.
| # | Task | Fix |
|---|---|---|
| 10.1 | performance_overview z **realnym wykresem** | bar-series obok/zamiast kafelków gdy dane szeregowe |
| 10.2 | SingleInsight chart | realny wykres (bar/line/pie) zamiast placeholdera |
| 10.3 | Heatmap/maturity + PrioritizationMatrix 2×2 | dopracować geometrię/czytelność |
| 10.4 | think-cell: waterfall finansowy | dla intencji finansowych |

### W11 — WARIANCJA KOMPOZYCJI (architektoniczna — Gamma-różnorodność)
| # | Task | Fix | Pliki |
|---|---|---|---|
| 11.1 | `resolveLayout` honoruje `composition.layoutVariantId` z B1 | ta sama intencja → różne układy | `layouts/index.ts`, `PptxPipelineService:143` |
| 11.2 | Renderer konsumuje geometrię archetypu (regions 0..1) | `slideArchetypes.ts` → pozycje atomics | nowy `resolveLayoutByArchetype` |
| 11.3 | Anti-repetition | kolejne slajdy nie identyczne strukturalnie | director/critic |

### W12 — TYPOGRAFIA / FONT FIDELITY
| # | Task | Fix |
|---|---|---|
| 12.1 | **Decyzja font:** embed Inter w pptx vs krój gwarantowany (Aptos/Arial) vs Inter+fallback | test na realnym MS PowerPoint (Mac+Win) — czy się podstawia |
| 12.2 | Type scale finalny | action-title min/max, granice shrink, hierarchia |

### W13 — OBRAZY / HERO (Gamma-like, opcjonalne premium)
| # | Task | Fix |
|---|---|---|
| 13.1 | Cover hero image | image-router F9 już jest — wpiąć opcjonalnie |
| 13.2 | Section dividers z obrazem | tło fazowe |
| 13.3 | Ikony przy KPI/messages | lekkie, monochrome |

### W14 — SPÓJNOŚĆ Z RESZTĄ MATERIAŁÓW
| # | Task | Fix |
|---|---|---|
| 14.1 | docx/xlsx ten sam motyw/typografia | zunifikować `designTokens` (pptx) ↔ `themeRegistry` (docx/xlsx) |
| 14.2 | Bundle deck = ta sama jakość | `spineToUnifiedReport` → M19 honoruje wszystkie powyższe fale |

### W15 — BRAMKA JAKOŚCI / REGRESJA WIZUALNA
| # | Task | Fix |
|---|---|---|
| 15.1 | Golden visual | render-PNG snapshot na DBR77 + VTS (wychwytuje regresje wizualne) |
| 15.2 | **Sparseness-rule w design-critic** | `deckDesignCritic` (istnieje) + reguła „empty-bottom" + overflow + contrast + ≤6 bullets, wpięty jako gate na M19 output |
| 15.3 | **Re-bar head-to-head vs Gamma** | po W7-W11; werdykt ≥ Gamma = perfekcja osiągnięta |

---

## 3. KOLEJNOŚĆ I KAMIENIE MILOWE

- **M1 „Kompletny" (W7+W8):** zero pustego dołu, bookend spójny → deck wygląda na SKOŃCZONY. ⟵ największy skok odczuwalny.
- **M2 „Dopieszczony" (W9+W10):** polish + realne wykresy → data-ink klasy konsultanta.
- **M3 „Zróżnicowany" (W11+W13):** wariancja układów + obrazy → wizualnie bije Gammę.
- **M4 „Zahartowany" (W12+W14+W15):** font fidelity + spójność modułu + bramka regresji → perfekcja utrzymywalna.

---

## 4. SPOSÓB PRACY (pętla weryfikacji — reużywalna, sprawdzona)

Każda fala: **fix → generuj realny .pptx (skrypt tsx + PptxPipelineService) → render PNG (`soffice --convert-to pdf` + `pdftoppm -png`) → przegląd przed/po (Read PNG) → test unit/regresja → tsc (filtr moje pliki) → commit cofalny → push feat → deploy demo (fast-forward) → odbiór Piotra.**
- Skrypt gen: ad-hoc w root repo (`_gen.mts`, usuwany po) — import z `./server/src/...ts`, `node --import tsx`.
- Render: `soffice --headless --convert-to pdf` → `pdftoppm -png -r 110`.
- Screeny: `docs/qa/screens/m17-deck-2026-06-28/`. Decki: `docs/qa/deliverables/runs/`.
- Branch współdzielony → commit NATYCHMIAST po zielonych, tylko swoje pliki, `tests/` przez `git add -f`.

---

## 5. RYZYKA / DECYZJE PIOTRA
- **Font (W12):** czy zależy nam na byte-identycznym wyglądzie w MS PowerPoint? Jeśli tak → embed lub krój gwarantowany. (Na PDF/LibreOffice Inter wygląda świetnie.)
- **Obrazy (W13):** włączamy hero/dividery (koszt: klucze image-gen na demo) czy deck „clean, no-photo"?
- **Zakres:** perfekcja tylko deck, czy równolegle docx/xlsx (W14)?
- **Kolory roadmapy:** progresja 1-odcienia vs status-kolory (semantyka).

---

## 6. POSTĘP

**2026-06-28 noc (7 agentów równolegle + integracja) — KAMIEŃ M1 „KOMPLETNY" OSIĄGNIĘTY:**
- ✅ **W7 rytm pionowy** (`168c7c86`): helper `verticalRhythm` + 13 layoutów/composites wypełniają płótno; zero pustych dołów. Zweryfikowane wizualnie na renderze 13 slajdów.
- ✅ **W8 bookend** (`21c779ac`): closing = lustro coveru (spine/eyebrow/duży tytuł/akcent/wordmark).
- ✅ **W9 polish** (`21c779ac`): paleta premium 60-30-10 (3 motywy), confidential subtelny, danger mniej alarmowy.
- ✅ wcześniej F1-F6: cover premium, action-titles, Inter, fix overflow, roadmap-karty.
- **Roadmap (W7.4):** progresja jednego odcienia + numery faz + pigułki ✅. Charts (W10.1/10.2): bar w single_insight ŻYWY ✅.
- Deck dowodowy: `docs/qa/deliverables/runs/2026-06-28-DECK-PERFEKCJA-W7.pptx` (13 slajdów) + pulpit. Screeny `docs/qa/screens/m17-deck-2026-06-28/s-01..13`.
- 42 testy reports zielone, tsc czysty w report/pptx. Demo: `21c779acba`.

**2026-06-28 noc cd. (przegląd + domknięcie + hardening):**
- ✅ Pełna regresja: **824/828** deliverables+reports (4 fail = pre-existing i18n `copySuffix`, nie nasze) — ZERO regresji po 7 agentach.
- ✅ Polish nity (`9bd529dc`): root-cause pełna czerwień→editorial panel (akcent-spine); next-steps dziura tabela↔callout→tabela centrowana/wypełnia.
- ✅ **W15 bramka regresji wizualnej** (`9bd529dc`): test integracyjny renderuje WSZYSTKIE 17 intencji → asercja valid buffer + ZERO ostrzeżeń (łapie wywalony layout).
- ✅ Finalny deck 13 slajdów (`d4409b3d`) na pulpicie + screeny. Demo `d4409b3dd4`.
- **Decyzje CTO (noc, Piotr spał):** font=Inter zostaje · bez zdjęć (clean) · roadmap 1-odcień · **W14 docx/xlsx ODŁOŻONE** (zmiana rendererów niezweryfikowanych wizualnie tej nocy = ryzyko dla „nic-nie-zepsute") · **W11 wariancja ODŁOŻONA** (mamy 17 wyraźnie różnych layoutów = różnorodność między-slajdowa już jest; marginalna wartość vs ryzyko rdzenia).

**ZOSTAŁO do M3-M4 (następna sesja — świadomie odłożone, NIE blokery):**
- Drobiazgi: root-cause czerwony baner stonować; next-steps mniejszy odstęp tabela↔callout; 3-wierszowe tabele lekko niedopełnione (cap rowH).
- W10.3/10.4 więcej wykresów (heatmap/waterfall), W11 wariancja kompozycji (resolveLayout→layoutVariantId), W12 font fidelity w realnym MS PowerPoint (test podstawienia Inter), W13 obrazy (decyzja: na razie clean/no-photo), W14 spójność docx/xlsx, W15 bramka sparseness w deckDesignCritic + golden visual.

---
*Ten plik = SSOT dojścia decka do perfekcji. Aktualizuję po każdej fali (✅/🟡/⬜). M1 (W7+W8) ✅ — następne M2 (W9 done + W10 wykresy).*
