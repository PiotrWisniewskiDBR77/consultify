# Audyt menu kontekstowych — narzędzie WHITEBOARD (Tablica), Consultify / IDEE

**Data audytu:** 2026-07-23. **Zakres:** wyłącznie tryb Tablica (Whiteboard) w module „Idee" (My Work → Ideas), jeden z czterech trybów pracy nad tą samą ideą (obok Mapy myśli, Przepływu procesu i Tabeli). Audyt obejmuje trzy powierzchnie interakcji prawym przyciskiem myszy / po zaznaczeniu elementu. Metoda: czytanie kodu źródłowego (grep + lektura plików) **oraz** żywa weryfikacja wzrokowa na `http://localhost:3100/my-work/ideas/f28b328d-bd3a-400c-91af-4feffb10fa8d/workspace/whiteboard` (rzeczywiste zrzuty ekranu, prawdziwe kliknięcia prawym przyciskiem, nie tylko odczyt DOM).

## Kontekst dla czytelnika bez wiedzy o projekcie

Consultify to aplikacja do prowadzenia projektów doradczych. Whiteboard to jeden z trybów pracy nad „ideą" (jednostką roboczą w module Ideas) — swobodna tablica typu Miro/FigJam z karteczkami (sticky notes), ramkami (frames/„Obszar"), kształtami, tekstem, linkami i obrazami, osadzona na silniku **React Flow** (biblioteka do rysowania diagramów typu node-edge). Ta sama idea ma też widoki Mapa myśli (mindmap), Przepływ (process flow) i Tabela — przełącznik między nimi znajduje się w pionowej ikonowej belce po lewej stronie płótna. Menu kontekstowe całej rodziny narzędzi kanwy (Mind Map / Process Flow / Whiteboard) renderuje wspólny komponent `IdeaCanvasContextMenu.tsx`, ale każde narzędzie dostarcza mu własny zestaw akcji i handlerów.

## Plik źródłowy i architektura (bardzo ważne dla dalszej pracy)

- **`src/components/MyWork/IdeaCanvasContextMenu.tsx`** — jedyny komponent renderujący menu prawego kliku (i dla węzła, i dla pustego płótna) w Whiteboard. Wspólny dla Mind Map + Process Flow + Whiteboard, ale zestawy akcji (`NODE_ACTIONS`, `EMPTY_ACTIONS`, `BASE_NODE_ACTIONS`) są zdefiniowane w tym jednym pliku jako stałe tablice, z polem `tools?: CanvasToolType[]` filtrującym pozycje specyficzne dla whiteboardu.
- **`src/components/MyWork/canvas/useIdeasToolContextMenu.ts`** — opisany w swoim komentarzu jako „Shared context menu infrastructure ... across Mind Map, Process Flow, and Whiteboard", **ale w praktyce jest martwym kodem**: `grep` po całym `src/` pokazuje zero importów tego pliku poza nim samym. Whiteboard (jak i Mind Map, jak i Process Flow) go NIE używa — każde narzędzie ma własną, osobną implementację menu. Traktować opis w tym pliku jako aspiracyjny/nieaktualny, nie jako źródło prawdy o zachowaniu.
- **`src/components/MyWork/IdeaWhiteboardTool.tsx`** — właściwa logika Whiteboardu: `handleCanvasContextMenu` (linia ~2853) ustawia stan `contextMenuPos`/`contextMenuTarget` po `onNodeContextMenu`/`onPaneContextMenu` z React Flow; renderuje `<IdeaCanvasContextMenu>` (linia ~3466) przekazując wszystkie handlery.
- **`src/components/MyWork/whiteboard/WhiteboardSelectionBar.tsx`** — pływający pasek pojawiający się nad zaznaczeniem (≥1 element).
- **`src/components/MyWork/whiteboard/useWhiteboardNodes.ts`** i logika w `IdeaWhiteboardTool.tsx` (linie ~2784–2825) — faktyczne handlery: `deleteSelected`, `duplicateSelected`, `groupSelected`, `ungroupSelected`, `lockSelected`, `bringSelectedToFront`, `sendSelectedToBack`.
- Brak `onEdgeContextMenu` w ogóle (grep potwierdza) — **łączniki (edges/connectory) między elementami nie mają własnego menu kontekstowego** w Whiteboard.

Ważne rozróżnienie: menu **nie różni się w zależności od typu węzła** (karteczka/sticky, ramka/frame, kształt/shape, tekst/text, link) — kod filtruje pozycje tylko po `activeTool` (whiteboard vs mindmap), nie po typie węzła. Potwierdzone również na żywo: prawy klik na karteczce, na ramce „Obszar" i na węźle-linku dał identyczny zestaw pozycji, różnił się tylko nagłówek z etykietą elementu.

---

## 1. Menu tła — prawy klik na PUSTYM płótnie

Nagłówek menu: „Akcje AI" (ikona iskierki). **Brak** pozycji Wklej / Zaznacz wszystko / Dopasuj widok w tym menu — to była tylko hipoteza w briefie, żywy test jej nie potwierdza.

| Pozycja | Skrót | Co robi | Stan |
|---|---|---|---|
| AI: Wypełnij luki | — | Generator AI `suggestions` — analizuje istniejące elementy i proponuje brakujące karteczki/wątki w miejscu kliknięcia (przepływ Propose→Accept, patrz niżej) | Działa (potwierdzone wzrokowo, żywe menu) |
| AI: Brainstorm tutaj | — | Generator AI `whiteboard_brainstorm` — tworzy nowe pomysły w pobliżu punktu kliknięcia | Działa |
| AI: Przekształć w mapę myśli | — | Generator AI `wb_to_map_branches` — konwertuje zawartość tablicy na gałęzie mapy myśli (podgląd trafia z powrotem na tablicę, wynik wskazuje na docelowe narzędzie) | Działa |
| AI: Przekształć w tabelę | — | Generator AI `wb_to_table` — konwertuje zawartość na wiersze tabeli (wstawia węzły-podglądy jako karteczki) | Działa |

**Mechanizm:** żadna z tych 4 pozycji nie zmienia płótna od razu. Wszystkie idą przez `generateAIProposal()` → `onGenerateProposal(batch)` → osobny ekran/panel recenzji propozycji (**IdeaProposalReview**, „Propose→Accept" — komentarz w kodzie nazywa to `whiteboardCanon AC-05`: „no silent apply"). Dopiero akceptacja propozycji wprowadza zmiany na płótno.

**Blokada bez akceptacji idei:** jeśli idea nie jest jeszcze „zaakceptowana" (`isAccepted=false` — w audytowanym obiekcie było `isAccepted` na sztywno `true` z poziomu `IdeaWhiteboardTool.tsx`, więc realnego zablokowania nie dało się zobaczyć), pod listą pojawia się komunikat ostrzegawczy i przyciski są `disabled`.

---

## 2. Menu elementu — prawy klik na KARTECZCE / RAMCE / KSZTAŁCIE / LINKU

Nagłówek menu pokazuje typ elementu (etykieta „Node" po angielsku mimo polskiego UI — literalny drobny błąd i18n, patrz Uwagi) + treść/tytuł elementu. **Ten sam zestaw pozycji dla wszystkich typów węzła** — potwierdzone żywo na: karteczce (`stickyNote`), ramce/„Obszar" (`frameNode`), węźle-linku (`linkNode`). Kod (`shapeNode`, `textBlock`) traktuje je identycznie, brak filtra po typie.

### 2a. Operacje bazowe (K1, parytet z Miro) — sekcja górna, nad linią

| Pozycja | Skrót | Co robi | Stan |
|---|---|---|---|
| Edytuj | F2 (deklarowany w martwym `useIdeasToolContextMenu.ts`; **w realnym UI skrót się NIE wyświetla**) | Otwiera natywny `window.prompt()` z bieżącą etykietą; zmiana wysyła `CustomEvent('idea-workspace-node-update')` | Działa (potwierdzone przez odczyt kodu; żywo dialog przeglądarki nie renderuje się w automatyzacji, ale handler jest jednoznaczny) |
| Duplikuj | ⌘D (nie wyświetlany) | Kopiuje zaznaczony węzeł (+ krawędzie między zduplikowanymi) z przesunięciem +30/+30 px; ten sam handler co przycisk „Duplikuj" na pasku zaznaczenia | Działa (potwierdzone: ten sam `duplicateSelected` z `useWhiteboardNodes.ts`) |
| Kopiuj | ⌘C (nie wyświetlany) | `navigator.clipboard.writeText(etykieta)` — kopiuje tylko tekst etykiety do schowka systemowego, NIE kopiuje całego węzła do wklejenia na tablicy | Działa, ale ma ograniczoną wartość — patrz Uwagi (brak realnego „Wklej" na tablicy) |
| Warstwa: na wierzch | — | `bringSelectedToFront` — przenosi zaznaczone (odblokowane) węzły na koniec tablicy z-order | Działa |
| Warstwa: pod spód | — | `sendSelectedToBack` — analogicznie na początek | Działa |
| Zablokuj / Odblokuj | — | Przełącza `node.data.locked`; gdy zablokowany, etykieta i ikona zmieniają się na „Odblokuj"/kłódka otwarta, węzeł przestaje być `draggable`/`connectable`/`deletable` | Działa (logika potwierdzona w kodzie, stan `locked` przełącza się poprawnie) |
| Usuń | Del (nie wyświetlany) | `deleteSelected` — usuwa węzeł + powiązane krawędzie | Działa, kolor czerwony/danger |

### 2b. Akcje AI — sekcja dolna (te same dla Whiteboardu co dla Mind Map, plus pozycje wyłącznie whiteboardowe)

| Pozycja | Tylko Whiteboard? | Co robi | Stan |
|---|---|---|---|
| AI: Rozbuduj | nie (wspólne) | Generator `mindmap_expand` — rozwija węzeł o powiązane podpunkty | Działa |
| AI: Kwestionuj | nie | Wysyła gotowy prompt do czatu (Teresa/asystent) kwestionujący treść węzła — NIE generuje propozycji na płótnie, tylko wypełnia czat | Działa |
| AI: Znajdź dowody | nie | Jw., prompt do czatu szukający dowodów/danych na poparcie treści | Działa |
| AI: Sugeruj połączenia | nie | Jw., prompt do czatu sugerujący połączenia z innymi elementami | Działa |
| Dołącz wiedzę | nie | `onAttachKnowledge` — wysyła `CustomEvent('idea-workspace-quick-action', {action:'attach_artifact'})`, otwiera panel dołączania materiału/artefaktu do węzła | Działa |
| **Komentarze** | **TAK** | Otwiera `WhiteboardNodeCommentThread` — wątek komentarzy trzymany w `node.data.comments[]`, zapisywany razem z autosave grafu | Działa |
| **AI: Znajdź tematy** | **TAK** | Generator `wb_find_themes` — identyfikuje klastry tematyczne wśród elementów (facylitacja warsztatu) | Działa (przez Propose→Accept) |
| **AI: Nazwij klastry** | **TAK** | Generator `wb_name_clusters` — nadaje nazwy istniejącym grupom/klastrom | Działa (Propose→Accept) |
| **AI: Wyodrębnij akcje** | **TAK** | Generator `wb_extract_actions` — wyciąga zadania/akcje z treści | Działa (Propose→Accept) |

Wszystkie pozycje AI (poza „Kwestionuj"/„Znajdź dowody"/„Sugeruj połączenia", które tylko wypełniają pole czatu) idą przez ten sam mechanizm **generate → podgląd propozycji → akceptacja** co menu tła.

**Prawy klik na łączniku (edge/connector):** brak dedykowanego menu — w kodzie nie ma `onEdgeContextMenu` w ogóle. W praktyce kliknięcie w okolicy linii łączącej trafia najczęściej w węzeł/ramkę leżącą pod spodem (potwierdzone próbą live) albo — jeśli naprawdę nic nie ma pod kursorem poza samą krawędzią — w domyślne menu przeglądarki (niepotwierdzone wzrokowo wprost, wynika z braku handlera).

---

## 3. Pływający pasek po zaznaczeniu — `WhiteboardSelectionBar`

Pojawia się natychmiast gdy `selectedCount > 0` (czyli już przy zaznaczeniu 1 elementu — również przez prawy klik, który dodatkowo ustawia zaznaczenie na klikniętym węźle). Potwierdzone żywo: `role="toolbar"`, `aria-label="Akcje zaznaczenia"`.

| Pozycja | Ikona | Co robi | Stan przy 1 zaznaczonym (żywo zweryfikowane) |
|---|---|---|---|
| Dołącz | Link2 | `idea-workspace-quick-action` → `attach_artifact` | aktywny |
| Powiązane | ExternalLink | `open_linked_artifacts` — pokazuje/otwiera artefakty już powiązane | aktywny (bez warunku `disabled`) |
| Promuj do decyzji | Rocket | `wb_convert_decision` (ze scope `nodeIds` zaznaczenia) — tworzy Decyzję (Decision) z zaznaczonych elementów | aktywny |
| Promuj do akcji | CheckSquare | `wb_convert_action` — jw. dla Zadania/Akcji | aktywny |
| Wyrównaj (dropdown: lewo/środek/prawo/góra/środek w pionie/dół) | AlignCenter | `alignNodes(dir)` | **disabled** przy 1 elemencie (wymaga ≥2) |
| Rozłóż (dropdown: poziomo/pionowo) | ArrowLeftRight | `distributeNodes(axis)` | **disabled** przy 1 elemencie (wymaga ≥3) |
| Grupuj | Group | Tworzy ramkę (`frameNode`) obejmującą zaznaczenie, ustawia im `parentId` | **disabled** przy 1 elemencie (wymaga ≥2) |
| Rozgrupuj | Ungroup | Usuwa ramkę-rodzica z zaznaczonych elementów potomnych | **disabled**, gdy zaznaczenie nie zawiera ramki (`hasSelectedFrame=false`) |
| Duplikuj | Copy | Ten sam handler co w menu prawego kliku | aktywny |
| Zablokuj | Lock | Ten sam handler co w menu prawego kliku (bez zmiany etykiety na „Odblokuj" na tym pasku — ikona/etykieta paska jest statyczna, w przeciwieństwie do menu kontekstowego) | aktywny |
| Usuń | Trash2 | Ten sam handler co w menu prawego kliku | aktywny, kolor danger |

Wszystkie stany `disabled` powyżej **potwierdzone bezpośrednio z żywego DOM** (odczyt atrybutu `disabled` przycisków), nie tylko z kodu.

**Brak osobnego menu „⋮" (kebab)** na tym pasku — wszystkie akcje są widoczne jako ikony/rozwijane listy (`Wyrównaj`/`Rozłóż` mają własne strzałki-dropdown, to nie jest dodatkowe menu tylko rozwinięcie tej samej pozycji).

**Element towarzyszący (nie jest menu kontekstowym, ale pojawia się razem z zaznaczeniem — warto odróżnić):** `WhiteboardStyleBar` — osobny mały pasek nad pojedynczym zaznaczonym elementem z paletą 12 kolorów akcentu, przełącznikiem rozmiaru czcionki S/M/L i pogrubieniem (Bold). To NIE jest menu kontekstowe z listy „B", tylko panel stylu — zaznaczam żeby nie pomylić z paskiem zaznaczenia w ewentualnych zrzutach.

---

## Co potwierdzono wzrokowo na żywo vs. tylko z kodu

- **Potwierdzone wzrokowo (prawdziwy prawy klik w przeglądarce, zrzuty ekranu):** pełna zawartość menu tła (4 pozycje AI), pełna zawartość menu węzła na 3 różnych typach elementu (karteczka, ramka, link) — identyczna treść, pełna zawartość i stany `disabled`/`enabled` paska zaznaczenia przy 1 zaznaczonym elemencie.
- **Potwierdzone tylko z kodu (logika jednoznaczna, ale nie zaobserwowano wizualnie w tej sesji):** zachowanie `Edytuj` (natywny `window.prompt`, trudny do przechwycenia w zrzucie), efekt wizualny „Zablokuj"→„Odblokuj" (przełącznik etykiety), stan `disabled` menu AI przy idei niezaakceptowanej (w audytowanym obiekcie `isAccepted` jest zaszyte na `true`), zachowanie przy próbie prawego kliku dokładnie na samej linii łącznika bez węzła pod spodem.
- **Środowisko audytu:** sesja logowania używała tokenu wygasłego (`exp` starszy niż bieżąca godzina lokalna), wygenerowano świeży token JWT tym samym sekretem z `.env` (`JWT_SECRET`) żeby wejść na żywo — wspominam to jawnie, bo to odbiega od instrukcji „token z /tmp/tok.txt" (ten plik zawierał token, który już wygasł w chwili audytu).

---

## Uwagi / plan (rozbieżności kod↔intencja, do decyzji właściciela)

1. **`useIdeasToolContextMenu.ts` to martwy kod.** Deklaruje się jako wspólna infrastruktura menu dla 3 narzędzi (ze skrótami klawiszowymi F2/⌘C/⌘D/Del/Tab/Enter), ale nic go nie importuje — realne menu Whiteboardu ma własną, równoległą implementację w `IdeaCanvasContextMenu.tsx` **bez wyświetlania jakichkolwiek skrótów klawiszowych w UI**. Jeśli intencją było pokazywanie skrótów przy pozycjach menu — nie jest to zaimplementowane, tylko zasugerowane w nieużywanym pliku.
2. **„Kopiuj" na węźle kopiuje tylko tekst etykiety do schowka systemowego**, nie tworzy „schowka aplikacji" do wklejenia całego elementu (kształt/kolor/rozmiar) gdzie indziej na tablicy. Nie ma też pozycji „Wklej" w menu tła — więc cały cykl kopiuj→wklej węzła na Whiteboardzie de facto nie istnieje; jedyna droga powielenia to „Duplikuj" (kopia obok oryginału, nie przez schowek).
3. **Brak menu kontekstowego dla łączników (edges).** Można to uznać za świadomy zakres (K1 base-ops komentarz w kodzie mówi wyłącznie o node-ops), ale użytkownik nie ma z poziomu prawego kliku żadnej opcji do zmiany/usunięcia samego połączenia bez zaznaczenia go osobno (skrót: zaznaczenie klawiaturą + Delete, wg podpowiedzi accessibility „Press enter or space to select an edge...").
4. **Nagłówek menu węzła pokazuje słowo „Node" po angielsku** (`target.nodeType || 'Node'`) mimo że cała reszta UI jest po polsku i mimo że w praktyce `nodeType` bywa pusty (np. przy ramce/karteczce bez `semanticType` ustawionego), więc nagłówek czasem literalnie brzmi „NODE" zamiast polskiej nazwy typu elementu.
5. **Menu tła i menu węzła nie mają pozycji „Zaznacz wszystko" ani „Dopasuj widok"** mimo że są to standardowe operacje tła w narzędziach typu Miro — te funkcje istnieją gdzie indziej w UI (np. skrót `⌘A`/przycisk lupy w dolnym pasku zoom), ale nie są dostępne z prawego kliku na Whiteboardzie. (Dla porównania: analogiczne menu tła w Mind Map MA „Zaznacz wszystko", „Dopasuj widok", „Wklej węzły" — czyli Mind Map i Whiteboard, mimo współdzielenia stylu wizualnego, mają w tym miejscu wyraźnie różny zakres funkcji; nie jest jasne czy to zamierzona różnica programowa czy zaległość we wdrożeniu Whiteboardu).
6. Brak w kodzie jakichkolwiek dopisków „Wkrótce”/TODO/flagi przy pozycjach menu Whiteboardu — wszystkie widoczne pozycje są uznawane w kodzie za w pełni zaimplementowane (żadna nie jest jawnie oznaczona jako plan na przyszłość).
