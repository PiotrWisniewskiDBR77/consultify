# R1 — inwentarz etykiet dwujęzycznych

## Mianowniki własnego parsera

| Zakres | Pliki | Ternary warunku języka | Kształt A | Kształt B |
| --- | ---: | ---: | ---: | ---: |
| toolCompletion.ts | 1 | 119 | 2 | 34 |
| DiscoveryTools + toolPacks | 162 | 350 | 8 | 55 |
| całe src/ | 4814 | 4355 | 83 | 481 |

Licznik parsuje również ternary wielowierszowe oraz warianty: isPolish, isPL, lang === 'pl', language === 'pl', i18n.language === 'pl' i i18n.language?.startsWith('pl'). To wyjaśnia rozjazd względem liczb autora opartych na węższym kształcie jednowierszowym. Podejrzane w badanym pliku: 36 (2 A + 34 B), nie około 73 ani 30.

## Klasyfikacja całej rodziny

| plik:linia | kształt | PL | EN | kategoria | źródło nazwy |
| --- | --- | --- | --- | --- | --- |
| src/components/DiscoveryTools/ToolDocumentView.tsx:2321 | B | Źródła, założenia i materiał wejściowy użyty w tej sesji są widoczne w kroku Input & Exploration. | Sources, assumptions, and input material used in this session are available in Input & Exploration. | PROPOZYCJA | brak odpowiadającego title.pl w paczkach |
| src/components/DiscoveryTools/ToolDocumentView.tsx:2428 | B | Panel sesji narzędzia | Tool session panel | PROPOZYCJA | brak odpowiadającego title.pl w paczkach |
| src/components/DiscoveryTools/shared/StrategicCanvasVisuals.tsx:62 | B | Finalna macierz SWOT | Final SWOT matrix | UZASADNIONA IDENTYCZNOŚĆ | separator / marka / akronim z justification |
| src/components/DiscoveryTools/shared/StrategicCanvasVisuals.tsx:138 | B | status dowodu | evidence status | UZASADNIONA IDENTYCZNOŚĆ | separator / marka / akronim z justification |
| src/components/DiscoveryTools/steps/ContextStep.tsx:674 | A | ,  | ,  | UZASADNIONA IDENTYCZNOŚĆ | separator / marka / akronim z justification |
| src/components/DiscoveryTools/steps/SummaryStep.tsx:274 | B | Raport utworzony z zatwierdzonej sesji Dynamic SWOT. | Report created from an approved Dynamic SWOT session. | UZASADNIONA IDENTYCZNOŚĆ | separator / marka / akronim z justification |
| src/components/DiscoveryTools/steps/SummaryStep.tsx:282 | B | Raport zapisano w Report Builderze. | Report saved in Report Builder. | PROPOZYCJA | brak odpowiadającego title.pl w paczkach |
| src/components/DiscoveryTools/toolCompletion.ts:63 | B | Brak kart SWOT | Missing SWOT cards | UZASADNIONA IDENTYCZNOŚĆ | separator / marka / akronim z justification |
| src/components/DiscoveryTools/toolCompletion.ts:145 | B | Budowa SWOT | SWOT Build | UZASADNIONA IDENTYCZNOŚĆ | separator / marka / akronim z justification |
| src/components/DiscoveryTools/toolCompletion.ts:185 | B | Określ ścieżki outputów | Define the output routes | PROPOZYCJA | brak odpowiadającego title.pl w paczkach |
| src/components/DiscoveryTools/toolCompletion.ts:298 | B | Brak mission brief | Missing mission | DEFEKT | src/toolPacks/packs/dynamicSwot.pack.ts:101 |
| src/components/DiscoveryTools/toolCompletion.ts:317 | B | Brak final source summary | Missing final source summary | DEFEKT | src/toolPacks/packs/dynamicSwot.pack.ts:145 |
| src/components/DiscoveryTools/toolCompletion.ts:319 | B | Brak kandydatów outputów | Missing output candidates | PROPOZYCJA | brak odpowiadającego title.pl w paczkach |
| src/components/DiscoveryTools/toolCompletion.ts:349 | B | Brak final source summary | Missing final source summary | DEFEKT | src/toolPacks/packs/marketForces.pack.ts:144 |
| src/components/DiscoveryTools/toolCompletion.ts:351 | B | Brak kandydatów outputów | Missing output candidates | PROPOZYCJA | brak odpowiadającego title.pl w paczkach |
| src/components/DiscoveryTools/toolCompletion.ts:375 | B | Brak growth mission | Missing growth mission | DEFEKT | src/toolPacks/packs/growthPaths.pack.ts:96 |
| src/components/DiscoveryTools/toolCompletion.ts:387 | B | Brak final source summary | Missing final source summary | DEFEKT | src/toolPacks/packs/growthPaths.pack.ts:143 |
| src/components/DiscoveryTools/toolCompletion.ts:389 | B | Brak kandydatów outputów | Missing output candidates | PROPOZYCJA | brak odpowiadającego title.pl w paczkach |
| src/components/DiscoveryTools/toolCompletion.ts:410 | B | Brak portfolio mission | Missing portfolio mission | DEFEKT | src/toolPacks/packs/portfolioPriority.pack.ts:108 |
| src/components/DiscoveryTools/toolCompletion.ts:412 | B | Brak sygnałów portfolio | Missing portfolio signals | PROPOZYCJA | brak odpowiadającego title.pl w paczkach |
| src/components/DiscoveryTools/toolCompletion.ts:415 | B | Brak zaakceptowanych elementów portfolio | Missing accepted portfolio items | PROPOZYCJA | brak odpowiadającego title.pl w paczkach |
| src/components/DiscoveryTools/toolCompletion.ts:418 | B | Brak trade-offów portfolio | Missing portfolio trade-offs | PROPOZYCJA | brak odpowiadającego title.pl w paczkach |
| src/components/DiscoveryTools/toolCompletion.ts:422 | B | Brak final source summary | Missing final source summary | DEFEKT | src/toolPacks/packs/portfolioPriority.pack.ts:155 |
| src/components/DiscoveryTools/toolCompletion.ts:424 | B | Brak kandydatów outputów | Missing output candidates | PROPOZYCJA | brak odpowiadającego title.pl w paczkach |
| src/components/DiscoveryTools/toolCompletion.ts:448 | B | Brak risk mission | Missing risk mission | DEFEKT | src/toolPacks/packs/riskUncertainty.pack.ts:100 |
| src/components/DiscoveryTools/toolCompletion.ts:459 | B | Brak final source summary | Missing final source summary | DEFEKT | src/toolPacks/packs/riskUncertainty.pack.ts:149 |
| src/components/DiscoveryTools/toolCompletion.ts:461 | B | Brak kandydatów outputów | Missing output candidates | PROPOZYCJA | brak odpowiadającego title.pl w paczkach |
| src/components/DiscoveryTools/toolCompletion.ts:492 | B | Brak pomiaru baseline | Missing baseline measurement | PROPOZYCJA | brak odpowiadającego title.pl w paczkach |
| src/components/DiscoveryTools/toolCompletion.ts:495 | B | Brak re-estymacji target | Missing target re-estimation | PROPOZYCJA | brak odpowiadającego title.pl w paczkach |
| src/components/DiscoveryTools/toolCompletion.ts:519 | B | Mission zdefiniowana | Mission defined | DEFEKT | src/toolPacks/packs/dynamicSwot.pack.ts:101 |
| src/components/DiscoveryTools/toolCompletion.ts:552 | B | Final source summary gotowe | Final source summary ready | DEFEKT | src/toolPacks/packs/dynamicSwot.pack.ts:145 |
| src/components/DiscoveryTools/toolCompletion.ts:594 | B | Final source summary gotowe | Final source summary ready | DEFEKT | src/toolPacks/packs/marketForces.pack.ts:144 |
| src/components/DiscoveryTools/toolCompletion.ts:604 | B | Growth mission zdefiniowana | Growth mission defined | DEFEKT | src/toolPacks/packs/growthPaths.pack.ts:96 |
| src/components/DiscoveryTools/toolCompletion.ts:644 | B | Final source summary gotowe | Final source summary ready | DEFEKT | src/toolPacks/packs/growthPaths.pack.ts:143 |
| src/components/DiscoveryTools/toolCompletion.ts:654 | A | Portfolio mission | Portfolio mission | DEFEKT | src/toolPacks/packs/portfolioPriority.pack.ts:108 |
| src/components/DiscoveryTools/toolCompletion.ts:662 | B | Sygnały portfolio | Portfolio signals | PROPOZYCJA | brak odpowiadającego title.pl w paczkach |
| src/components/DiscoveryTools/toolCompletion.ts:667 | B | Elementy portfolio | Portfolio items | DEFEKT | src/toolPacks/packs/portfolioPriority.pack.ts:130 |
| src/components/DiscoveryTools/toolCompletion.ts:672 | B | Trade-offy alokacji | Allocation trade-offs | DEFEKT | src/toolPacks/packs/portfolioPriority.pack.ts:142 |
| src/components/DiscoveryTools/toolCompletion.ts:682 | B | Final source summary gotowe | Final source summary ready | DEFEKT | src/toolPacks/packs/portfolioPriority.pack.ts:155 |
| src/components/DiscoveryTools/toolCompletion.ts:692 | A | Risk mission | Risk mission | DEFEKT | src/toolPacks/packs/riskUncertainty.pack.ts:100 |
| src/components/DiscoveryTools/toolCompletion.ts:722 | B | Final source summary gotowe | Final source summary ready | DEFEKT | src/toolPacks/packs/riskUncertainty.pack.ts:149 |
| src/components/DiscoveryTools/toolCompletion.ts:764 | B | Pomiar baseline | Baseline measurement | DEFEKT | src/toolPacks/packs/processAutomation.pack.ts:139 |
| src/components/DiscoveryTools/toolCompletion.ts:769 | B | Re-estymacja target | Target re-estimation | DEFEKT | src/toolPacks/packs/processAutomation.pack.ts:150 |
| src/components/DiscoveryTools/toolSessionDetailsBuilder.ts:167 | A | Status | Status | UZASADNIONA IDENTYCZNOŚĆ | separator / marka / akronim z justification |
| src/components/DiscoveryTools/tools/DynamicSWOT/EvidenceEditor.tsx:172 | B | np. wywiad z klientem X, raport Q3, benchmark | e.g. interview with client X, Q3 report, benchmark | PROPOZYCJA | brak odpowiadającego title.pl w paczkach |
| src/components/DiscoveryTools/tools/DynamicSWOT/SWOTBuildPhase.tsx:534 | B | Kategorie macierzy SWOT | SWOT matrix categories | UZASADNIONA IDENTYCZNOŚĆ | separator / marka / akronim z justification |
| src/components/DiscoveryTools/tools/DynamicSWOT/SWOTCorrelationsStep.tsx:90 | A | Attack | Attack | PROPOZYCJA | brak odpowiadającego title.pl w paczkach |
| src/components/DiscoveryTools/tools/DynamicSWOT/SWOTCorrelationsStep.tsx:94 | A | Repair | Repair | PROPOZYCJA | brak odpowiadającego title.pl w paczkach |
| src/components/DiscoveryTools/tools/DynamicSWOT/SWOTCorrelationsStep.tsx:98 | A | Defend | Defend | PROPOZYCJA | brak odpowiadającego title.pl w paczkach |
| src/components/DiscoveryTools/tools/DynamicSWOT/SWOTCorrelationsStep.tsx:101 | A | Protect | Protect | PROPOZYCJA | brak odpowiadającego title.pl w paczkach |
| src/components/DiscoveryTools/tools/DynamicSWOT/SWOTInputExplorationPhase.tsx:866 | B | Teresa nie mogła przygotować propozycji. Spróbuj ponownie. | Teresa could not prepare proposals. Try again. | UZASADNIONA IDENTYCZNOŚĆ | separator / marka / akronim z justification |
| src/components/DiscoveryTools/tools/DynamicSWOT/SWOTInputExplorationPhase.tsx:929 | B | Teresa pracuje… | Teresa is working… | UZASADNIONA IDENTYCZNOŚĆ | separator / marka / akronim z justification |
| src/components/DiscoveryTools/tools/DynamicSWOT/SWOTInputExplorationPhase.tsx:947 | B | Strumienie analizy SWOT | SWOT analysis streams | UZASADNIONA IDENTYCZNOŚĆ | separator / marka / akronim z justification |
| src/components/DiscoveryTools/tools/DynamicSWOT/SWOTInputExplorationPhase.tsx:959 | B | Kategorie SWOT | SWOT categories | UZASADNIONA IDENTYCZNOŚĆ | separator / marka / akronim z justification |
| src/components/DiscoveryTools/tools/DynamicSWOT/SWOTInsightsPhase.tsx:259 | B | Rekomendacja: dla każdej szansy high-impact określ deadline i minimalne zasoby do wejścia. | Recommendation: for each high-impact opportunity, define a deadline and minimum resources to enter. | PROPOZYCJA | brak odpowiadającego title.pl w paczkach |
| src/components/DiscoveryTools/tools/DynamicSWOT/SWOTInsightsPhase.tsx:284 | B | Priorytet: dla każdego zagrożenia high-impact zdefiniuj trigger, plan B i właściciela. | Priority: for each high-impact threat, define a trigger, plan B, and owner. | PROPOZYCJA | brak odpowiadającego title.pl w paczkach |
| src/components/DiscoveryTools/tools/DynamicSWOT/SWOTInsightsPhase.tsx:945 | B | Wniosek: wykorzystaj korelacje wzmacniające jako mnożniki efektu, a konfliktowe traktuj jako punkty decyzyjne wymagające trade-offu. | Conclusion: use reinforcing correlations as effect multipliers, and treat conflicting ones as decision points requiring trade-offs. | PROPOZYCJA | brak odpowiadającego title.pl w paczkach |
| src/components/DiscoveryTools/tools/DynamicSWOT/TeresaSwotProposals.tsx:215 | B | Ta analiza SWOT zmieniła się od momentu, gdy Teresa złożyła tę propozycję. Odśwież, zanim zdecydujesz. | This SWOT changed since Teresa proposed this — refresh to see the latest before deciding. | UZASADNIONA IDENTYCZNOŚĆ | separator / marka / akronim z justification |
| src/components/DiscoveryTools/tools/DynamicSWOT/TeresaSwotProposals.tsx:227 | B | Odśwież listę | Refresh list | PROPOZYCJA | brak odpowiadającego title.pl w paczkach |
| src/components/DiscoveryTools/tools/DynamicSWOT/TeresaSwotProposals.tsx:373 | B | Teresa jest chwilowo niedostępna. | Teresa is temporarily unavailable. | UZASADNIONA IDENTYCZNOŚĆ | separator / marka / akronim z justification |
| src/components/DiscoveryTools/tools/DynamicSWOT/TeresaSwotProposals.tsx:546 | B | Teresa przeanalizuje wszystkie ćwiartki i zaproponuje zmiany. Nic nie zapisze się automatycznie — każdą propozycję akceptujesz lub odrzucasz osobno. | Teresa will analyze all four quadrants and propose changes. Nothing saves automatically — you accept or reject each proposal. | UZASADNIONA IDENTYCZNOŚĆ | separator / marka / akronim z justification |
| src/components/DiscoveryTools/tools/DynamicSWOT/TeresaSwotProposals.tsx:564 | B | Teresa myśli… | Teresa is thinking… | UZASADNIONA IDENTYCZNOŚĆ | separator / marka / akronim z justification |
| src/components/DiscoveryTools/tools/DynamicSWOT/TeresaSwotProposals.tsx:577 | B | Teresa przygotowuje propozycje… | Teresa is preparing proposals… | UZASADNIONA IDENTYCZNOŚĆ | separator / marka / akronim z justification |

Kategorie DEFEKT mają wskazane źródło w paczce. Gdy takiego źródła brak, trafienie pozostaje PROPOZYCJĄ i nie podlega cichej zmianie. Uzasadnione identyczności obejmują separatory, nazwy własne oraz akronimy rozpoznawane przez wspólny rejestr justification.

