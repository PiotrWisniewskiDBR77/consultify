# Standard kart — 7 typów (2026-09-03)

Stan: pomiar i projekt kontraktu; prototyp ograniczony do jednego typu (`initiative`) i domyślnie wyłączony.

## R1. Macierz stanu zastanego

| Typ | Reprezentacja | Katalog/kompozycja | AI | Stan i błędy | Wspólny `KanonicznaKarta` |
|---|---|---|---|---|---|
| Task | `TaskCardV2` + detail | `taskCardContract.ts`, 10 kart | jawne role i prompty | loading/empty/error w widoku | tak |
| Decision | `DecisionCard` + detail | `decisionCardContract.ts`, 8 kart | jawne role i prompty | stany w widoku szczegółu | tak |
| Notification | `NotificationCard` + detail | `notificationCardContract.ts` | systemowa, bez generacji | read/unread + błędy akcji | tak |
| Initiative | `InitiativeDocumentView` | DB section types + `initiativeCardContract.ts` | prompt per sekcja | najbogatszy shell i sekcje | tak |
| Insight | `InsightViewer` | `insightCardContract.ts` | generacja i ocena jakości | walidacja jakości | tak |
| Interview | `InterviewWorkspace` | `interviewCardContract.ts`, 8 kart | asysta w pytaniach/podsumowaniu | assignment i brak odpowiedzi | tak |
| Tool | `KnownToolDetailView` | `toolCards.contract.ts`, 4 sekcje | jawny brak generacji | read-only | tak, bez runtime adaptera |

Wspólny mianownik już istnieje w `src/components/standard/cardContract.types.ts`: `id`, dwujęzyczna etykieta, grupa, ikona, próg, kompozycja, rola AI/prompt oraz jawny status kanonu. To jest kontrakt treści i kompozycji, nie wspólny komponent wizualny. Pomiar źródeł siedmiu typów dał 3263 linie; ze wspólnym kontraktem 3564. Rejestr ma dokładnie siedem typów, natomiast dev-render zawiera osiem ekranów `karta-*`, więc liczba ekranów nie może być użyta jako dowód 1:1.

## R2. Kontrakt wspólnego standardu

Standard zachowuje `KanonicznaKarta` jako SSOT danych. Warstwa widoku może przyjąć wyłącznie adapter z tego kontraktu i ma zapewnić:

1. nagłówek: typ, tytuł, status i menu działań;
2. pas metadanych: właściciel, daty, postęp oraz źródło;
3. centrum: sekcje specyficzne dla typu w kolejności z `kompozycja`;
4. stany jawne: loading, empty, error i unavailable — bez cichego fallbacku;
5. dostępność: widoczny focus, nazwy przycisków i kolejność klawiatury;
6. brak zmiany zachowania, gdy flaga jest wyłączona.

Prototypowy typ: **Initiative**, bo ma najbogatszy kontrakt (sekcje DB, kompozycja, AI, status/progress/owner) i najlepiej ujawnia braki standardu. Sześć pozostałych typów pozostaje nietkniętych. Flaga planowana: `VITE_VF1_STANDARD_CARD_INITIATIVE`, domyślnie OFF; dopuszczalny parametr deweloperski nie może zmieniać wartości produkcyjnej.

### Granice

- Bez migracji DB, zmian serwera i masowej migracji siedmiu typów.
- Bez uznawania wspólnego CSS za wspólny kontrakt semantyczny.
- Bez włączenia flagi domyślnie lub scalenia.
- Akceptacja wizualna wymaga par PRZED/PO w obu motywach; bez nich wynik pozostaje częściowy.

## R6. Plan wdrożenia po akceptacji

1. Initiative: adapter widoku z `KanonicznaKarta`, testy kontraktu i regresji flagi OFF.
2. Insight i Interview: wspólne stany oraz metadane, bez zacierania trybu wywiadu.
3. Task, Decision i Notification: adapter nagłówka/metadanych, zachowanie akcji domenowych.
4. Tool: decyzja właściciela, czy read-only katalog w ogóle potrzebuje managera kart.
5. Dopiero po osobnej akceptacji zrzutów: kolejno przełączać flagi per typ; żadnego big-bang.

