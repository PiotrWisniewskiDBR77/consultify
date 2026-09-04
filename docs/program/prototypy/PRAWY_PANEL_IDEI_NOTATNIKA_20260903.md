# Prototyp wspólnego prawego panelu Idei i Notatnika

Status: projekt do akceptacji, za flagą domyślnie OFF. Nie jest projektem migracji obecnych paneli.

## R1 — pomiar rodziny

Na markerze `416432abaf` pliki mają odpowiednio 1289, 867 i 1037 linii. Ścisły pomiar `git grep -ln 'ArtifactRightPanel' -- src` daje 61 plików. Z badanej trójki tylko `NotebookRightRail.tsx` korzysta z kanonu; `IdeaContextPanel.tsx` i `NotebookContextPanel.tsx` budują własne powłoki i nagłówki.

| Sekcja | Idee — `IdeaContextPanel` | Notatnik — `NotebookContextPanel` | Rail — `NotebookRightRail` | SPEC-A §11.2 | Werdykt |
|---|---|---|---|---|---|
| Akcje | akcje rozproszone przy elementach | Wstaw/Otwórz przy wierszach | kanoniczna sekcja `actions` | Eksport, Udostępnij, Kopiuj link | ujednolicić powierzchnię, zachować kontekstowe akcje |
| Właściwości | wybrany węzeł, statystyki mapy, etap, narzędzie | brak zwartej sekcji właściwości | kanoniczna sekcja `properties` | owner, daty, flagi, parametry | prototyp pokazuje wspólny slot właściwości |
| Powiązania | backlinks, notes, evidence, artifacts, initiatives, gaps, insights, KPI, similar | used-in, linked outputs, ideas, initiatives, tasks, decisions, notes | kanoniczna sekcja `relations` | linki do artefaktów i `+ Powiąż` | jedna sekcja z grupami zależnymi od kontekstu |
| Komentarze | brak osobnej sekcji | brak osobnej sekcji | kanoniczna sekcja `comments` | wątek avatar + tekst + czas | stan pusty w prototypie; model nie dostarcza wątku |
| Historia / AI | brak trwałej historii; ostrzeżenia w osobnym bloku | brak trwałej historii | osobne `history` i `evidence` | timeline zmian + akcje AI | rozdział historia/AI wymaga decyzji i danych |
| Powłoka | `ToolsPanelShell`, lokalne akordeony | własny `div`, szer. `w-80` | potrafi deklarować `ArtifactRightPanelSection[]` | 360 px, zakres 320–420; <1280 drawer | tylko rail jest częściowo zbieżny z kanonem |
| Stany | loading/error/empty lokalnie | loading i błędy częściowych źródeł | sekcje deklaratywne | empty/loading/error oraz niezależny save state | wspólny kontrakt stanu bez ukrywania błędu |

### Dlaczego trzy panele nie są jednym kanonem

`IdeaContextPanel` jest kontekstowym panelem mapy z lokalną taksonomią 11 sekcji. `NotebookContextPanel` jest pickerem/panelem wstawiania relacji z pięcioma lokalnymi sekcjami. `NotebookRightRail` jest panelem właściwości aktywnej strony i jako jedyny potrafi przekazać dane do `ArtifactRightPanel`. Różne wejścia i modele danych wyjaśniają genezę, ale nie uzasadniają trzech powłok.

### Czego brakuje w modelu danych

- `changeHistory[]`: identyfikator zmiany, autor, czas, pole, wartość przed/po; źródło musiałoby powstać we wspólnym kontrakcie artefaktu;
- `comments[]`: id, author, body, createdAt, resolvedAt; brak wspólnego źródła dla Idei i Notatnika;
- `provenance`: sourceType, sourceId, capturedAt, hash/version; dziś dane są rozproszone między grafem i linked outputs;
- `version` oraz `conflictState`: potrzebne do uczciwego stanu konfliktu i historii; brak wspólnego odczytu dla obu kontekstów;
- `capabilities`: jawne uprawnienia do eksportu, udostępniania i wiązania, zamiast wyprowadzania ich z obecności callbacku.

## R2 — jeden układ przed kodem

Kanon §11.2 rozstrzyga panel 360 px w zakresie 320–420 px, tło `c.surface`, lewą krawędź `c.border-subtle`, nagłówki akordeonu h-44 oraz stałą kolejność: Akcje, Właściwości, Powiązania, Komentarze, Historia / AI. §10.2/§11.2 rozdziela powłokę od archetypu, a §13 wymaga, by szczegóły kontekstu nie tworzyły lokalnego wariantu powłoki.

Prototyp ma jeden komponent i prop `context='idea' | 'notebook'`. Kolejność pięciu sekcji jest stała; zmieniają się wyłącznie etykiety, wartości właściwości i grupy powiązań. Na szerokości co najmniej 1280 px panel ma 360 px; poniżej 1280 px jest drawerem o szerokości do 420 px, a na bardzo wąskim ekranie nie przekracza viewportu.

Stany są jawne: `loading` pokazuje opisany status ładowania, `empty` zachowuje pięć sekcji z uczciwymi pustymi komunikatami, `error` pokazuje komunikat i akcję ponowienia bez zastępowania go pustą listą. `Esc` zamyka jeden poziom (najpierw otwarty popover/drawer, potem panel); `Tab` przechodzi po nagłówkach i kontrolkach, a każda kontrolka ma `focus-visible` w `c-focus`.

Wszystkie powierzchnie używają tokenów `c-*`; crimson nie oznacza aktywności ani fokusu. Semantyczny `c-danger` jest zarezerwowany dla rzeczywistego błędu.

## Pytania do właściciela

1. Czy sekcja „Historia / AI” ma pozostać jedną sekcją? **TAK/NIE**
2. Czy „Akcje” mają być domyślnie rozwinięte w obu kontekstach? **TAK/NIE**
3. Czy poniżej 1280 px panel ma zawsze przechodzić w drawer? **TAK/NIE**
4. Czy powiązania Idei i Notatnika mają zachować lokalne podgrupy wewnątrz jednej sekcji? **TAK/NIE**
