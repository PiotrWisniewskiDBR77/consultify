# Deck composition redesign — beat Gamma on layout (SSOT)

**Decyzja CTO (2026-06-23):** przejść z paradygmatu „AI wybiera szablon" → „AI komponuje slajd", inkrementalnie. Krok 1 teraz (na obecnym systemie), Krok 2 (gramatyka) gated na zysku wizualnym Kroku 1.

## Diagnoza (zmapowana w kodzie)
Dziś slajd = `intent` (1 z 17) → render decyduje o układzie: FE `LayoutEngine` (29 szablonów, wybór HEURYSTYKĄ: liczba bloków/obraz/wykres/anty-powtórka), PPTX `LAYOUT_REGISTRY` (sztywne 1 intent→1 layout, pozycje zahardkodowane). **B1 wybiera `{intent, paleta, image_brief}` i jest ŚLEPY na topologię układu** — nie wie ile regionów, czy treść się zmieści. To = Gamma z N=17. Stąd powtarzalność + deck 58-75% u każdego modelu (sztywność, nie model).

**Już mamy klocki:** region-model `CardBlock.position.area`, 14 prymitywów, `LayoutEngine` ze scoringiem 29 wariantów, krytyk `presentationVisionQAService` (VisionQA), nieużywane pole `DeckCard.layout_id`.

## Miernik (kluczowe)
FT-6 deck-score mierzy intent/paletę/briefy — **NIE kompozycję**. Zysk Kroku 1/2 mierzymy WIZUALNIE: render decka → screenshoty → VisionQA score (czytelność, hierarchia, balans, brak przepełnień, różnorodność) + ocena Piotra. To osobny rubric: `deck-visual` (do dopisania).

## KROK 1 — planer kompozycji (B1 przestaje strzelać w ciemno)
**1a — B1 → composition planner (additive, back-compatible):** rozszerz output B1 o opcjonalne `composition` per slajd: `{ layoutVariantId, regions: [{ area, blockTypes[] }], emphasis }`. Podaj LLM-owi TOPOLOGIĘ jako kontekst (warianty per intent z `LayoutEngine.LAYOUT_TEMPLATES` + pojemności regionów + 14 prymitywów), żeby rozumował „mam 4 metryki + wykres → wariant 2×2-KPI, wykres prawy-górny". Gdy LLM nie da composition → dziś­ejsze zachowanie (heurystyka). Zero zmian w renderze w 1a → bezpieczne, testowalne w izolacji.
**1b — renderer honoruje wybór AI:** `LayoutEngine.selectLayout` honoruje `composition.layoutVariantId` (przez nieużywane `layout_id`) zamiast czystej heurystyki; `assignBlocksToRegions` honoruje `composition.regions`. PPTX analogicznie (wariant per intent). Fallback do heurystyki gdy brak composition. **To slice z WIDOCZNYM efektem** — render+screenshot dowodzi.
**1c — pomiar:** VisionQA na wyrenderowanym decku (przed/po) + screenshoty dla Piotra.

## KROK 2 — gramatyka układu (Gamma-killer, gated)
Zastąp 17/29 sztywnych layoutów GRAMATYKĄ: siatka 12-kol + archetypy regionów (hero, split, grid-N, sidebar, full-bleed, band) + 14 prymitywów. AI emituje „kompozycję" (regiony+bloki+pozycje na siatce); JEDEN generyczny renderer (FE+PPTX) ją interpretuje. Nieskończona różnorodność, content-driven, czysta (siatka gwarantuje wyrównanie). Duża przebudowa renderu — osobny projekt po zielonym Kroku 1.

## KROK 3 — zasady + krytyk (wtopione w Krok 2)
Reguły designu (skala typografii, światło 50-75ch, kontrast ≥4.5, ≤6 punktów, wyrównanie do siatki) jako twarde ograniczenia kompozycji; pętla VisionQA ocenia → regeneruje slajd gdy łamie zasady.

## Kolejność realizacji
1a (B1 planer, additive) → 1b (renderer honoruje, FE najpierw) → 1c (VisionQA+screenshoty, decyzja Piotra) → [gate] → Krok 2 gramatyka → Krok 3 krytyk.
