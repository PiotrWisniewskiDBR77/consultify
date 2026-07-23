# Kontrakt redakcyjny standardu Idea Workspace (OBOWIĄZKOWY dla każdego rozdziału)

> Ten plik nie jest częścią standardu — to zasady pisania standardu. Każdy rozdział MUSI go przestrzegać, żeby dokument był spójny.

## Słownik obowiązujący (używać DOKŁADNIE tych terminów)

| Termin | Znaczenie | NIE pisać |
|---|---|---|
| **Idea** | jeden obiekt danych: graf (elementy + relacje + rozszerzenia) + metadane | „workspace" jako obiekt, „projekt" |
| **Reprezentacja** | jeden z 4 sposobów oglądania Idei: Mind Map · Whiteboard · Process Flow · Table | „narzędzie" gdy mowa o widoku, „tryb" |
| **Narzędzie** | wymiennie z reprezentacją, gdy mowa o funkcjach specyficznych | — |
| **Menu 1** | pierwszy pasek — tożsamość całej Idei | „top bar", „header" |
| **Menu 3** | drugi pasek — akcje aktualnej reprezentacji | „second bar", „toolbar" |
| **Lewy rail** | pionowy pasek narzędzi edycji | „sidebar", „lewy panel" |
| **Prawy panel** | panel informacji: Przegląd·Właściwości·Powiązania·Komentarze·Historia | „inspektor" jako nazwa panelu, „sidebar" |
| **Pasek zaznaczenia** | pływający pasek nad zaznaczonym elementem | „floating toolbar" w tekście PL |
| **Menu kontekstowe** | menu prawego przycisku myszy | „context menu" w tekście PL |
| **Zakres (scope)** | na czym akcja działa — jedna z 10 wartości (§01) | „poziom", „kontekst" |
| **Rejestr akcji** | `ActionRegistry` — jedno miejsce deklaracji wszystkich akcji | „katalog", „lista akcji" |
| **Teresa** | asystent AI sterujący całym systemem | „AI" jako nazwa własna asystenta |
| **Propozycja** | wynik AI przed akceptacją (preview → akceptuj/odrzuć) | „draft", „sugestia" gdy mowa o mechanizmie |
| **Konwersja** | utworzenie trwałego artefaktu z Idei lub jej części | „export" dla tej operacji |
| **Eksport** | utworzenie PLIKU poza systemem | „convert" dla tej operacji |

## Zasady pisania
1. **Po polsku**, rzeczowo, bez lania wody. Zdania krótkie. Zero marketingu.
2. **Każdy rozdział zaczyna się** od: `# NN — Tytuł`, potem 2-3 zdania „Po co ten rozdział".
3. **Tabele > prozy** wszędzie, gdzie się da (akcje, stany, zakresy).
4. **Każda akcja opisana kolumnami:** `id akcji · etykieta PL · ikona · zakres · reprezentacje · handler · efekt · undo`.
5. **Rozróżniaj stan docelowy od obecnego.** Standard opisuje DOCELOWY. Jeśli odnosisz się do dzisiejszego kodu, pisz wprost: „dziś: … → docelowo: …".
6. **Nie wymyślaj funkcji.** Opieraj się na: standardzie OpenAI (`docs/idea-workspace-target-standard-2026-07-23/`) + audycie (`docs/audits/idea-workspace-completeness-2026-07-23/`). Gdy czegoś brak w obu — oznacz `⟦DO USTALENIA⟧`, nie zgaduj.
7. **Każdy rozdział kończy się** sekcją `## Kryteria odbioru` — lista checkbox, sprawdzalna okiem bez zaglądania w kod.

## Cztery zasady nadrzędne (każdy rozdział musi je respektować)
- **Z1 — Analogiczność:** 4 reprezentacje działają tak samo, poza różnicami JAWNIE wymienionymi w tabeli „specyficzne" (§01). Jeśli rozdział wprowadza różnicę — musi ją tam dopisać i uzasadnić.
- **Z2 — Wygląd:** prawy panel wg zaakceptowanego prototypu (`prototyp.html`); reszta powierzchni spójna z nim.
- **Z3 — Zero placeholderów:** żadnej akcji bez handlera, żadnego „wkrótce" bez `disabledReason`, żadnego martwego eventu/endpointu.
- **Z4 — Teresa steruje wszystkim:** każda akcja opisana w rozdziale MUSI mieć wpis `teresa: {description, parameters}` w rejestrze. Jeśli akcja nie da się wywołać rozmową — to błąd projektu, nie wyjątek.

## Decyzje właściciela (wiążące, nie podważać w rozdziałach)
| # | Decyzja |
|---|---|
| D1 | **Jeden wspólny kanon prawego panelu** dla Idea i kart N: Przegląd · Właściwości · Powiązania · Komentarze · Historia. Zakładka „Akcje" znika (→ Menu 1/kebab). |
| D2 | **Przełącznik reprezentacji w prawym dolnym rogu** (obok zoom/fit/minimapa). Znika z lewego railа. |
| D3 | **Mapowanie semantyczne między reprezentacjami** = osobny projekt, poza tym standardem. Zapisać jako cel kierunkowy. |
| D4 | **Kolejność:** P0 (integralność danych) równolegle z pisaniem standardu. |
| D5 | **Table: kierunek P15**, legacy wygaszany. |
| D6 | **Convert ≠ Export.** Convert tworzy artefakt, Export tworzy plik. „Create from map" zakazane. |

## Źródła (cytuj plik:linia, gdy odnosisz się do kodu)
- Standard OpenAI: `docs/idea-workspace-target-standard-2026-07-23/00_MASTER_DEEP_STANDARD.md` + 01–11.
- Audyt kodu: `docs/audits/idea-workspace-completeness-2026-07-23/00`–`10`.
- Powierzchnie (zweryfikowane): `Harvard/wdrozenie-100/_RAIL_LEWY_*`, `_KONTEKST_*`, `_MENU3_*`, `_PRAWY_PANEL_IDEE_*`.
- Rdzeń: `docs/standards/idea-workspace/_RDZEN_STANDARDU_4_ZASADY_2026-07-23.md`.
