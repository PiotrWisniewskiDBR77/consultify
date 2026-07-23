# DRAFT — Standard „Jak ma działać Idea Workspace" + plan naprawczy

> **STATUS: SZKIELET (v0.1, 2026-07-23).** To jest STRUKTURA draftu, nie finał.
> **Ewolucja:** finalna wersja powstanie po włączeniu założeń drugiego AI (OpenAI). Miejsca do wypełnienia oznaczone `⟦CZEKA NA OpenAI⟧`. Decyzje właściciela oznaczone `⟦DECYZJA: …⟧`. Treść oparta na audycie `docs/audits/idea-workspace-completeness-2026-07-23/` (pliki 00–10).
> **Jak czytać:** każda sekcja ma **Cel** (po co ta sekcja) + **Zawartość docelowa** (bullet-placeholdery) + **Źródło z audytu** (skąd wiemy). Nie ma jeszcze finalnej prozy — to rusztowanie.

---

## 0. Meta-dokumentu (jak używać standardu)
- **Cel:** ustalić jeden, spójny model działania Idea Workspace dla 4 narzędzi + powłoki, oraz plan doprowadzenia kodu do tego modelu.
- **Zawartość docelowa:**
  - zakres i nie-zakres standardu
  - słowniczek (workspace / idea / graf / węzeł / krawędź / widok / narzędzie / powłoka / artefakt / scope)
  - zasada nadrzędna: *jedna akcja = jeden jednoznaczny scope + jeden handler per narzędzie* (koniec reużycia `mm_*` wszędzie)
  - status wersji, właściciel, tryb aktualizacji
- `⟦CZEKA NA OpenAI⟧` — jego zasady redakcyjne / priorytety / format standardu (jeśli narzuci szablon, dostosowujemy sekcje niżej).

## 1. Model pojęciowy (fundament)
- **Cel:** wspólny język, żeby reszta standardu była jednoznaczna.
- **Zawartość docelowa:**
  - Idea = jeden graf (`nodes`/`edges`/`extensions`) + metadane (`stage`, `area`, `priority`, `promoted_to`).
  - 4 narzędzia = 4 **widoki** tego samego grafu (nie 4 osobne dokumenty). Definicja co jest wspólne, a co per-widok (`extensions.<tool>`).
  - **Scope akcji** (kanon 11 wartości z audytu 02): workspace · current_view · selected_items · single_item · edge · lane/frame · table_row · table_cell · table_column · external_artifact · unknown → **standard zabrania `unknown` w finalnym UI**.
  - Cykl życia idei (SPARK→…→Promoted) i co go zmienia.
- **Źródło:** 01_UI_SURFACES, 02_ACTION_MATRIX.

## 2. Architektura powierzchni (gdzie żyją akcje)
- **Cel:** ustalić, która powierzchnia do czego służy — koniec dublowania i rozjazdu.
- **Zawartość docelowa (per powierzchnia: rola · scope dozwolony · co NIE może tu być):**
  - Menu 1 (tożsamość + akcje na całej idei)
  - Menu 3 (akcje bieżącego widoku)
  - Lewy rail (przełącznik narzędzi + narzędzia płótna per-tool)
  - Prawy rail + panel (inspektor — patrz §5)
  - Pływający pasek zaznaczenia (akcje na zaznaczeniu)
  - Menu kontekstowe (tło / element / krawędź / lane)
  - Table: menu wiersza / komórki / nagłówka (osobny rozdział §6)
  - Skróty klawiszowe + command palette
- **Zasada rozdziału:** tabela „która akcja gdzie" — jedna akcja ma JEDNO kanoniczne miejsce (duplikaty tylko świadome, z tym samym scope).
- **Źródło:** 01, 07_DUPLICATES.

## 3. Kanon akcji powłoki (naprawa root-cause #1)
- **Cel:** zlikwidować martwe kliki w Whiteboard/Process/Table.
- **Zawartość docelowa:**
  - Zasada: **każda akcja powłoki (Menu 3, rail popovery, prawy panel) MUSI rozgałęziać po `activeTool`** i wołać handler danego narzędzia (`wb_*`/`pf_*`/`tbl_*`), nie `mm_*`.
  - Kontrakt deskryptorów: `buildIdeaMenu3Actions` / rail popovers dostają per-tool mapowanie akcji.
  - Lista akcji wspólnych i ich odpowiedników per narzędzie (add / ai-expand / auto-layout / templates / export).
- **Źródło:** 00 (ustalenie #1), 02 sekcja B, 07.
- `⟦DECYZJA: nie wymaga — to bug-fix, nie wybór⟧`

## 4. Model AI (proposal-first)
- **Cel:** ujednolicić 3 silniki AI w jeden przewidywalny model z akcept/odrzuć/undo.
- **Zawartość docelowa:**
  - Kanon: **każda akcja AI zmieniająca dane = proposal** (preview → akceptuj/odrzuć), przez wspólny `IdeaProposalReview`. Auto-apply zabroniony bez preview (dziś: table autofill, convert).
  - Kategorie AI (z audytu 04): workspace / widok / zaznaczenie / element / edge / tabela / tworzące artefakt / propozycje.
  - Wymóg: każda AI ma prompt-builder + jawny kontekst + log/historię + undo.
  - Zakaz „AI" na przyciskach, które nie wołają LLM (dziś WB „AI Generators").
  - Który silnik jest docelowy (mm/wb-pf/tbl) i jak je scalić.
- **Źródło:** 04_AI_ACTIONS, 00 (#4, #5).
- `⟦CZEKA NA OpenAI⟧` — możliwe jego zdanie o modelu AI / promptach.

## 5. Prawy panel (inspektor) — kanon sekcji
- **Cel:** ustalić, co jest pod każdą ikoną i naprawić brak przełączania.
- **Zawartość docelowa:**
  - Naprawa: `renderRightRailPanel(activeToolId)` przełącza sekcję; host przekazuje `activeRightToolId`/`onSelectRightTool`.
  - Zestaw sekcji — `⟦DECYZJA A2: SPEC-A (Akcje·Właściwości·Powiązania·Komentarze·Historia/AI) vs własny (Problem·Status·Inspektor·Convert·Zdrowie)⟧`
  - Jeśli SPEC-A: dodać Powiązania (dane: `link-graph`) + Komentarze (`NodeCommentThread`) + Historię w panelu.
  - Per-tool inspektor (właściwości zaznaczenia).
- **Źródło:** `_PRAWY_PANEL_IDEE`, `docs/audits/.../` + wcześniejszy spec `Harvard/.../_PRAWY_PANEL_*`.

## 6. Table jako osobny archetyp (Rekord/Matryca)
- **Cel:** rozstrzygnąć legacy vs P15 i opisać docelowy pasek/menu.
- **Zawartość docelowa:**
  - `⟦DECYZJA A1: legacy czy platform P15 docelowy⟧` — standard opisuje JEDEN.
  - Docelowy pasek (widoki / rząd ikon / moduły Data-Forms-Interfaces-Models-Workflow / Tools).
  - Menu: wiersz / komórka (dziś brak!) / nagłówek kolumny.
  - Integracja z resztą (przełączanie widoku bez duplikacji treści — patrz §8 bug).
- **Źródło:** `_MENU3_TABELA`, `_KONTEKST_TABELA`, 08.

## 7. Convert / Create / Export / Import / Templates (jednoznaczność)
- **Cel:** skończyć z myleniem tych operacji.
- **Zawartość docelowa (kanon nazewnictwa + scope + guard-rail):**
  - Przełączenie widoku ≠ generowanie reprezentacji ≠ nowy obiekt ≠ konwersja do artefaktu ≠ export pliku ≠ import.
  - Convert: `⟦DECYZJA A3: jeden mechanizm⟧` + `⟦DECYZJA A4: scope element/branch/selection⟧` + `⟦DECYZJA A5: promote per-idea czy per-fragment⟧`.
  - Export: rozdzielić „pobierz plik" od „utwórz artefakt" (dziś zmieszane: „Raport"/„Prezentacja" w Export).
  - Import + Templates: **wymóg confirm-dialog przed destrukcyjnym nadpisaniem** (dziś tylko Templates ma).
  - Reguła: każda operacja tworząca/nadpisująca = preview + undo + zachowany link do źródła (jeśli ma sens).
- **Źródło:** 05_CONVERT..., 00 (#6–#11).

## 8. Dane, persystencja, realtime, historia
- **Cel:** jeden model zapisu i współpracy.
- **Zawartość docelowa:**
  - `⟦DECYZJA A7: Whiteboard migrować na wspólny `useWorkspaceGraphRuntime`⟧`
  - `⟦DECYZJA A6: ujednolicić 3 kanały realtime⟧` (WebSocket / Socket.IO / REST-polling presence)
  - Autosave (optimistic-lock `baseVersion`), snapshot/historia (4 narzędzia, z extensions), undo.
  - **BUG do naprawy:** przełączanie narzędzia duplikuje treść (2 bazy / podwójna migracja) — patrz plan §11.
- **Źródło:** 03_ENDPOINTS, 06_CHAINS, pamięć sesji (duplikacja narzędzi).

## 9. Feature flags — polityka
- **Cel:** flagi nie mogą rozjeżdżać UX.
- **Zawartość docelowa:**
  - Inwentarz flag wpływających na Idea (z 09).
  - Zasada: jedna flaga = jeden efekt; zakaz sterowania dwoma niezwiązanymi narzędziami jedną flagą.
  - Domknięcie: które flagi promować do default-ON i usunąć martwe ścieżki (legacy-drawer ~2400 LOC, `tablePlatformRecordsApi` bez callerów).
- **Źródło:** 09_FEATURE_FLAGS.

## 10. Martwy kod i ukryte funkcje — decyzje
- **Cel:** czysta baza pod standard.
- **Zawartość docelowa (per pozycja: zachować / podłączyć / usunąć):**
  - Kod bez UI: `tbl_autofill/refresh/link`, `wb_group/distribute`, `IdeaCanvasDiscovery`, typy `kpi_badge/score/progress/summary`, `handleGenerateCanvasAI`.
  - Martwe eventy: `idea-workspace-add-edge`/`-link-artifact` itd.
  - Martwe endpointy: cluster/outcome, `v8/mindmap/*`, facilitacja end/outcomes.
- **Źródło:** 08_DEAD_UI, 03.

## 11. Plan naprawczy (fazowany, priorytet wg ryzyka)
- **Cel:** kolejność wdrożenia standardu.
- **Zawartość docelowa (fazy — szkielet):**
  - **F0 — Integralność danych (najpilniejsze):** `promote()` nie nadpisuje całej idei bezwarunkowo (R2); import destrukcyjny dostaje confirm (R3); fix duplikacji przy przełączaniu narzędzia.
  - **F1 — Root-cause #1:** rozgałęzienie akcji powłoki per `activeTool` (jedna zmiana, trzy powierzchnie).
  - **F2 — Prawy panel:** przełączanie zakładek + `⟦DECYZJA A2⟧` sekcje.
  - **F3 — AI proposal-first:** ujednolicenie, koniec auto-apply bez preview, koniec „AI bez LLM".
  - **F4 — Convert/Export/Import:** jednoznaczność + guard-raile.
  - **F5 — Table docelowy** (`⟦DECYZJA A1⟧`) + persystencja/realtime (`⟦DECYZJA A6/A7⟧`).
  - **F6 — Sprzątanie:** martwy kod/eventy/endpointy, flagi, tłumaczenia PL.
  - Każda faza: bramka (DoD), weryfikacja wzrokiem (reguła #7 — właściciel nie pierwszym testerem).
- **Źródło:** 00 (ryzyka R1–R10), 10_OPEN_QUESTIONS.
- `⟦CZEKA NA OpenAI⟧` — jego priorytetyzacja / dodatkowe fazy.

## 12. Kryteria odbioru standardu (DoD całości)
- **Cel:** kiedy uznajemy, że Idea Workspace spełnia standard.
- **Zawartość docelowa:**
  - zero martwych klików w 4 narzędziach
  - każda akcja: jednoznaczny scope + feedback + undo (gdzie zmienia dane)
  - prawy panel przełącza sekcje; kanon sekcji spójny
  - AI = proposal-first wszędzie
  - jedna implementacja Table; jeden model persystencji/realtime
  - zero „AI bez LLM", zero destrukcyjnych operacji bez confirm
  - weryfikacja wzrokiem, oba motywy, per narzędzie
- **Źródło:** 00, 10.

---

## Załącznik: mapa decyzji do podjęcia PRZED finalizacją
| ID | Decyzja | Sekcja | Blokuje |
|---|---|---|---|
| A1 | Table legacy vs P15 | §6, §11-F5 | opis paska/menu tabeli |
| A2 | Kanon prawego panelu (SPEC-A vs własny) | §5 | co pod ikonami |
| A3 | Jeden mechanizm Convert | §7 | rozdział Convert |
| A4 | Scope Convert element/branch/selection | §7 | zachowanie konwersji |
| A5 | `promote` per-idea vs per-fragment | §7, §11-F0 | integralność danych |
| A6 | Ujednolicenie realtime | §8 | model współpracy |
| A7 | Migracja persystencji Whiteboard | §8 | spójność zapisu |

## Załącznik: co CZEKA NA OpenAI (sloty)
- §0 zasady redakcyjne / format standardu
- §4 model AI / prompty
- §11 priorytetyzacja i ewentualne dodatkowe fazy
- (miejsce na dodatkowe sekcje, jeśli OpenAI je zaproponuje)
