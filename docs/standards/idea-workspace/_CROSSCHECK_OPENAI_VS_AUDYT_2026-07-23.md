# Cross-check: standard OpenAI ↔ audyt kodu (stan przejściowy)

> **Status:** roboczy, przed pełnym opisem od OpenAI. Cel: mieć gotową listę zgodności / konfliktów / luk, żeby finalizacja poszła szybko i bez wpadek.
> **Wejście A:** `docs/idea-workspace-target-standard-2026-07-23/` (00–11, OpenAI) — szkielet funkcjonalny.
> **Wejście B:** `docs/audits/idea-workspace-completeness-2026-07-23/` (00–10, ten audyt) — realny stan kodu.

---

## 1. Co standard ROZSTRZYGA (moje decyzje otwarte → zamknięte)

| Moja decyzja (audyt 10) | Rozstrzygnięcie OpenAI | Komentarz |
|---|---|---|
| A1 Table legacy vs P15 | **P15 docelowy, legacy do wygaszenia** | zgodne z kierunkiem produktu; audyt potwierdza, że obiekty testowe renderują legacy → migracja realna, nie kosmetyczna |
| A2 Kanon prawego panelu | **Nowy: Przegląd · Inspektor · Powiązania · Komentarze · Historia** | ⚠ patrz konflikt K1 |
| A3 Jeden mechanizm Convert | Convert = akcja, tylko Menu 1 / menu zaznaczenia; **nie** zakładka panelu | dobre; wymaga scalenia 3 istniejących mechanizmów |
| A4 Scope Convert element/branch | Etykieta musi nazywać scope (`Convert branch` ≠ `Convert selected node`) | zgodne z defektem #9 audytu |
| A5 `promote` per-idea vs fragment | **Backend ma zapisywać wiele konwersji, nie pojedyncze `promoted_to`** | trafia w R2 (najpoważniejsze ryzyko danych) |

## 2. Zgodność ze stanem kodu — standard trafia w realne defekty

Jego „zakazy" pokrywają się z tym, co audyt znalazł niezależnie w kodzie:

| Zakaz/reguła OpenAI | Odpowiadający defekt z audytu | Zgodność |
|---|---|---|
| „Nie wolno wywoływać `mm_*` poza Mind Map" | root-cause #1 — martwe kliki w WB/PF/Table | ✅ 1:1 |
| „Akcja w UI nie może być cichym no-op" | ≥12 martwych pozycji (02, 08) | ✅ |
| „AI bez LLM nie może być etykietowane jako AI" | WB „AI Generators" wstawia puste elementy | ✅ |
| „Export nie tworzy trwałego artefaktu" | „Raport"/„Prezentacja" w Export = ukryty Convert | ✅ |
| „Import destrukcyjny wymaga confirm + snapshot" | draw.io/BPMN kasuje graf bez dialogu | ✅ (R3) |
| „`Create from map` zakazane" | dziś martwy klik pod domyślną flagą | ✅ |
| „Prawy panel: klik ikony przełącza treść" | renderer ignoruje `activeToolId` | ✅ |
| „Table nie dziedziczy canvasowego raila" | rail w Tabeli bez sensu + zasłania jej pasek | ✅ |
| „`Insert between` nie przy węźle, gdy wymaga krawędzi" | zawsze toast błędu | ✅ |
| „`Wklej` nie może duplikować zaznaczenia" | PF `Wklej` = `duplicateSelected()` | ✅ |
| „Walidacja: `Not validated` przed uruchomieniem" | badge „Brak ostrzeżeń" myli (pusty stan) | ✅ |
| „Płaski rząd 20 ikon zwinąć do More/Tools" | legacy pasek Tabeli | ✅ |

**Wniosek:** standard nie jest oderwany od rzeczywistości — niezależnie opisał te same problemy. To mocny sygnał, że kierunek jest trafny.

---

## 3. ⚠ KONFLIKTY do rozstrzygnięcia przez właściciela

### K1 — Kanon prawego panelu rozjeżdża się z własnym standardem produktu (WAŻNE)
- **OpenAI proponuje:** `Przegląd · Inspektor · Powiązania · Komentarze · Historia`.
- **Repo ma już kanon SPEC-A** (`Harvard/wdrozenie-100/ARTIFACT_ANATOMY_STANDARD.md §708`): `Akcje · Właściwości · Powiązania · Komentarze · Historia/AI` — zaimplementowany w `src/components/standard/ArtifactRightPanel.tsx` i **używany przez 7 kart N** (Task/Decision/Insight/Notification/Initiative/Interview/Tool).
- **Ryzyko:** jeśli Idea przyjmie inny zestaw 5 zakładek, to **Idea rozjedzie się z resztą produktu** — użytkownik dostanie dwa różne prawe panele w jednej aplikacji. Wcześniej sam ten rozjazd wskazałem jako defekt (brak Powiązań/Komentarzy w Idea).
- **Opcje:** (a) ujednolicić oba kanony (np. `Przegląd` ≈ `Akcje+Właściwości` — do uzgodnienia), (b) świadomie przyjąć dwa kanony: Canvas-artefakt vs Rekord-artefakt, z jawnym uzasadnieniem w standardzie, (c) przenieść karty N na nowy kanon (największy koszt).
- **Rekomendacja:** (b) z jawnym zapisem — ale to musi być ŚWIADOMA decyzja, nie przypadek. Idea faktycznie ma inną naturę (płótno) niż rekord.

### K2 — Przełącznik reprezentacji przenoszony z lewego raila do prawego dolnego rogu
- Standard: przełącznik 4 widoków → prawy dolny róg (obok zoom/minimap); rail „nie służy do przełączania".
- Stan: dziś 4 przełączniki są **na górze lewego raila** (udokumentowane w `_RAIL_LEWY_*`).
- **Uwagi:** to duża zmiana nawyku + trzeba zaktualizować dokumentację railа. Dodatkowo standard mówi „Minimap osobną ikoną, nie tekst `Mindmap`" — dziś w rogu jest tekst „Mini mapa".
- **Ryzyko:** przeniesienie przełącznika w róg obniża jego widoczność — w Miro/Figma przełącznik trybu bywa eksponowany. Warto potwierdzić na prototypie przed wdrożeniem (reguła #7).

### K3 — „Convert" znika z prawego panelu, ale musi mieć jedno źródło
- Standard: Convert w Menu 1 (całość) + menu zaznaczenia (fragment).
- Stan: **trzy niezależne mechanizmy** Convert (workspace `Api.convertMyIdea`, lista M05 `conversionService`, martwy `shared/ConvertToMenu`) z rozjazdem targetów (te same cele „soon" w workspace, działające w liście).
- **Do domknięcia:** standard powinien wskazać JEDEN serwis konwersji i co zrobić z M05.

---

## 4. LUKI — czego standard (jeszcze) nie pokrywa, a audyt mówi że trzeba

| # | Luka | Dlaczego istotne | Źródło |
|---|---|---|---|
| L1 | **Duplikacja treści przy przełączaniu narzędzia** (9 kroków → 18 wierszy) | ŻYWY bug danych; standard mówi „przełączenie widoku nie zmienia danych" — a dziś zmienia | audyt + repro w tej sesji |
| L2 | **Rozjazd persystencji: Whiteboard poza wspólnym runtime** | ryzyko desync historii/extensions; standard zakłada jeden model danych | 06_CHAINS |
| L3 | **Trzy kanały realtime** (WebSocket / Socket.IO / REST-polling) | standard mówi „przełączenie widoku nie przełącza ekranu innym" — dziś realtime potrafi przełączać | 03_ENDPOINTS |
| L4 | **Polityka feature flags** | brak w standardzie; dziś flagi sterują dwoma niezwiązanymi narzędziami | 09_FLAGS |
| L5 | **Martwy kod / endpointy / eventy — decyzje** | ≥6 funkcji bez UI, ≥5 martwych eventów, ≥10 martwych endpointów | 08, 03 |
| L6 | **`useIdeasToolContextMenu.ts`** — wspólne menu ze skrótami, martwe | standard wymaga skrótów w tooltipach; ten plik miał to realizować | 08 |
| L7 | **Model uprawnień** (read-only, permission denied) | standard wymienia stan `permission denied`, ale nie definiuje ról | 02_SCREEN_ARCH |
| L8 | **Migracja legacy→P15 dla istniejących danych** | standard mówi „wygasić legacy", nie mówi JAK zmigrować istniejące tabele | 10_TOOL_SPEC |

---

## 5. Punkty, gdzie standard zakłada coś, czego kod dziś NIE robi (do jawnego zapisania jako „do naprawy")

1. „Przełączenie widoku nie zmienia danych" → **dziś zmienia** (duplikacja, L1).
2. „Przełączenie widoku nie przełącza ekranu innym użytkownikom" → **dziś potrafi** (realtime, L3).
3. „Stan aktywnego widoku = preferencja lokalna" → dziś persystowany per idea-tab i synchronizowany.
4. „Każdy przycisk ikonowy ma tooltip ze skrótem" → dziś część bez `title` (np. filtr zaawansowany w Tabeli).
5. „Nie ma pozycji `soon` bez jasnego disabled state" → dziś część targetów Convert to „soon" bez wyjaśnienia.

---

## 6. Co jest gotowe do finalizacji od razu (nie czeka na nic)

Te sekcje standardu można spisać na czysto natychmiast, bo nie zależą ani od pełnego opisu, ani od decyzji:
- Model produktu i scope akcji (§01) — zgodny z audytem, tylko dopisać mapowanie na realne handlery.
- Kanon akcji powłoki / naprawa root-cause (§04 + P1 backlogu) — czysty bug-fix.
- Convert/Export/Import/Templates — definicje i guard-raile (§09).
- Standard AI proposal-first (§08).
- Kryteria akceptacji globalne (§11).

## 7. Co czeka
- Pełny opis od OpenAI (zapowiedziany).
- Decyzja K1 (kanon prawego panelu vs SPEC-A kart N) — **to jedyny konflikt architektoniczny na poziomie produktu**.
- Potwierdzenie K2 na prototypie (przełącznik widoku w rogu).
- Rozstrzygnięcie K3 (jeden serwis Convert, co z M05).

---

## 8. Uzupełnienie po `00_MASTER_DEEP_STANDARD.md` (pełny opis, 927 linii)

Master jest spójny z 12 plikami szkieletu — nie znalazłem sprzeczności wewnętrznych. Dokłada natomiast kilka rzeczy o realnym ciężarze implementacyjnym:

### 8.1. Nowe/mocniejsze wymagania (nie było w szkielecie)
| # | Wymaganie mastera | Ciężar | Stan w kodzie |
|---|---|---|---|
| M1 | §1: „element dodany w Mind Map system powinien pokazać w Table jako rekord, w Whiteboard jako obiekt, w Process Flow jako krok lub kandydata" | **DUŻY** — semantyczne mapowanie między reprezentacjami | Graf JEST wspólny (te same `nodes`), więc częściowo działa. Ale mapowanie semantyczne (węzeł→krok procesu z `shape`, →wiersz z kolumnami) NIE jest automatyczne. To osobny projekt, nie fix. |
| M2 | §5.2: klik aktywnej ikony zamyka panel; stan zakładki lokalny, „nie wolno synchronizować jako globalnego stanu Idea" | średni | dziś stan panelu lokalny w powłoce — OK; ale aktywne narzędzie JEST synchronizowane (patrz L3) |
| M3 | §8.2: „Draw nie powinien mieszkać jako osobny lokalny pasek nad canvasem, jeśli rail już jest narzędziem edycji" | mały | dziś `Draw` jest w Menu 3 Whiteboardu → przenieść do railа |
| M4 | §8.3: „Nie może być sytuacji, że `Start/End` dodaje tylko Start" | mały | audyt potwierdza ten defekt 1:1 |
| M5 | §6.2 + §4.1: pełny standard konfliktu zapisu (porównanie wersji lokalnej i serwerowej, zachowanie kopii) | **średni-duży** | dziś jest optimistic-lock `baseVersion` + 409, ale BRAK UI porównania/scalania — to nowa funkcja, nie fix |
| M6 | §11.5: proposal review = diff + apply/reject + historia + undo dla KAŻDEJ mutującej AI | duży | dziś tylko WB/PF mają proposal; Table wcale |
| M7 | Fazy warsztatu nazwane `capture, organize, converge, handoff` | kosmetyka | dziś PL: Start/Organizacja/Konwergencja/Przekazanie — do uzgodnienia nazewnictwa |

### 8.2. Co master potwierdza z audytu (dodatkowo)
- §9.1: „Whiteboard powinien mieć więcej niż tylko AI. Brak `Paste`, `Select all`, `Fit view` to luka" — dokładnie to znalazł audyt menu tła WB.
- §9.4: „Brak menu komórki to luka" — potwierdza.
- §13.2: „Tryb warsztatowy nie może stale zasłaniać canvasu jako wielki panel" — zgodne z obserwacją, że panel sesji zasłaniał treść.

### 8.3. Czego master nadal NIE pokrywa (luki z §4 zostają)
L1 (duplikacja przy przełączaniu widoku), L2 (persystencja Whiteboard osobno), L3 (3 kanały realtime), L4 (polityka flag), L5 (martwy kod/endpointy), L6 (`useIdeasToolContextMenu`), L7 (model uprawnień), L8 (migracja danych legacy→P15).

**Uwaga:** L1 i L3 są szczególnie istotne, bo master stawia je jako ZASADY („przełączenie widoku nie zmienia danych", „nie przełącza ekranu innym"), a kod dziś je łamie. W finalnym standardzie muszą trafić do backlogu P0/P1 jako jawne naprawy, inaczej standard opisze stan, którego nie ma.
