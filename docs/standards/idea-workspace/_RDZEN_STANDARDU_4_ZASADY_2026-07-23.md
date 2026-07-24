# Rdzeń standardu — cztery zasady właściciela i jeden mechanizm, który je spełnia

**Data:** 2026-07-23 · **Status:** rdzeń finalnego standardu (nadrzędny nad rozdziałami szczegółowymi).

## Cztery zasady (wymagania właściciela, 2026-07-23)

| # | Zasada | Co to znaczy operacyjnie |
|---|---|---|
| **Z1** | **Cztery narzędzia działają ANALOGICZNIE** — poza fragmentami jawnie przypisanymi do narzędzia. Podział musi być klarowny. | Ta sama akcja = ta sama nazwa, ikona, miejsce, skrót i zachowanie we wszystkich 4 widokach. Różnice tylko tam, gdzie standard je JAWNIE wymienia. |
| **Z2** | **Prawy panel nie może wyglądać „wsiowo"** — nawet przy tych samych funkcjach potrzebne nowe elementy graficzne. | Przebudowa warstwy wizualnej panelu: hierarchia, karty, typografia, stany, mikro-interakcje. Patrz `_PROTOTYP_PRAWY_PANEL_*`. |
| **Z3** | **Zero niepodłączonych endpointów i placeholderów.** | Żadnego martwego kliku, „wkrótce", martwego eventu ani endpointu bez callera. Egzekwowane maszynowo, nie obietnicą. |
| **Z4** | **Wszystko sterowalne przez Teresę.** | Każda akcja dostępna w UI musi dać się wywołać rozmową z Teresą — bez wyjątków. |

---

## Mechanizm: JEDEN REJESTR AKCJI (`ActionRegistry`)

Z1, Z3 i Z4 to nie trzy osobne projekty. To trzy skutki jednego braku: **dziś nie ma jednego miejsca, które wie, jakie akcje istnieją.** Akcje są rozsypane po komponentach, hookach i stringach (`mm_*`, `wb_*`, `pf_*`, `tbl_*`), więc nic nie może ich ani ujednolicić, ani zweryfikować, ani udostępnić Teresie.

Rozwiązanie: **każda akcja deklarowana RAZ, w jednym rejestrze.**

### Kontrakt deklaracji akcji

```ts
type ActionScope =
  | 'workspace' | 'current_view' | 'selected_items' | 'single_item'
  | 'edge' | 'lane_frame' | 'table_row' | 'table_column' | 'table_cell'
  | 'external_artifact';

interface ActionDef {
  id: string;                       // 'idea.node.add_child' — namespace, nie 'mm_add_child'
  label: Record<Lang, string>;      // etykieta widoczna
  icon: IconName;                   // jedna ikona dla WSZYSTKICH powierzchni
  scope: ActionScope;               // dokładnie jeden
  tools: Tool[] | 'all';            // w których z 4 narzędzi działa
  surfaces: Surface[];              // gdzie się pokazuje (menu1|menu3|rail|panel|context|floating)
  shortcut?: string;                // jeden skrót dla wszystkich wejść
  handler: (ctx: ActionContext) => Promise<ActionResult>;  // WYMAGANY — brak = błąd builda
  mutates: boolean;                 // czy zmienia dane
  requiresPreview: boolean;         // wymuszane, gdy mutates && AI
  undo?: UndoDescriptor;            // wymagany, gdy mutates
  teresa: {                         // Z4 — opis dla asystenta
    description: string;            // co robi, językiem użytkownika
    parameters?: JSONSchema;        // czego potrzebuje
    confirmBeforeRun?: boolean;     // dla destrukcyjnych
  };
  disabledReason?: (ctx) => string | null;  // zamiast cichego no-op
}
```

### Jak to spełnia cztery zasady

**Z1 — analogiczność.** Powierzchnie UI (Menu 1, Menu 3, rail, panel, menu kontekstowe, floating) **renderują się Z REJESTRU**, filtrując po `tools` i `surfaces`. Ta sama akcja nie może mieć innej nazwy w Whiteboardzie niż w Procesie, bo jest zadeklarowana raz. Różnice per narzędzie są **jawne w polu `tools`** — czyli klarowne, wymagane przez Z1.

**Z3 — zero placeholderów.** `handler` jest polem **wymaganym**. Akcja bez handlera nie kompiluje się. Do tego strażnik CI (`scripts/check-actions.sh`):
- każdy `ActionDef` ma handler i przynajmniej jedną powierzchnię,
- każdy endpoint wołany z handlera istnieje w routerze,
- każdy `CustomEvent` nadawany ma listener,
- żadna powierzchnia nie renderuje akcji spoza rejestru,
- akcja bez `disabledReason` nie może być pokazana jako disabled.
Efekt: martwe kliki stają się **niemożliwe do wprowadzenia**, nie tylko „naprawione raz".

**Z4 — Teresa steruje wszystkim.** Rejestr jest **jednocześnie listą narzędzi Teresy**. Pole `teresa.description` + `parameters` generuje jej tool-manifest automatycznie. Konsekwencje:
- nowa akcja = automatycznie dostępna dla Teresy (nie trzeba pamiętać, żeby ją „dodać do AI"),
- Teresa nie może wywołać niczego, czego nie ma w UI (i odwrotnie) — jedno źródło prawdy,
- akcje `mutates: true` Teresa uruchamia przez ten sam proposal-review co UI (podgląd → akceptuj/odrzuć),
- `confirmBeforeRun` chroni destrukcyjne (import zastępujący graf, usunięcie).

**Z2 — wygląd.** Rejestr niesie `icon` i `label`, więc wszystkie powierzchnie mają spójną ikonografię. Sama warstwa wizualna panelu — osobny rozdział + prototyp.

---

## Z1 w praktyce: co jest WSPÓLNE, a co SPECYFICZNE

To jest wymagana przez Z1 „klarowność". Wszystko poniżej = wspólne dla 4 narzędzi. Cokolwiek nie jest tu wymienione jako specyficzne — musi działać tak samo.

### Wspólne (identyczne we wszystkich 4 narzędziach)
| Obszar | Zakres wspólności |
|---|---|
| Menu 1 | pełny układ: powrót, breadcrumb, nazwa, etap, stan zapisu, Teresa, Convert, kebab |
| Prawy panel | 5 zakładek: Przegląd · Właściwości · Powiązania · Komentarze · Historia |
| Prawy dolny róg | zoom · fit · minimapa · przełącznik reprezentacji |
| Menu 3 — szkielet | lewa: tryb→tworzenie→układ→AI→Szablony; prawa: Import→Export→More |
| Rail — szkielet | góra: zaznaczanie/przesuwanie · środek: tworzenie/relacje · niżej: komentarz/link/AI · dół: More/Undo/Redo |
| Menu kontekstowe — szkielet | tło · element · krawędź · kontener (lane/frame) |
| Floating toolbar | edit · duplicate · comment · link · AI · style · convert selected · delete |
| Stany | enabled · disabled-z-powodem · loading · success · error · empty · brak uprawnień · offline |
| Skróty | te same akcje = te same skróty |
| AI | proposal-first: podgląd → akceptuj/odrzuć → historia → undo |
| Teresa | dostęp do wszystkich akcji przez rejestr |

### Specyficzne (jawnie dozwolone różnice)
| Narzędzie | Co ma własnego | Dlaczego |
|---|---|---|
| Mind Map | poziomy (collapse/expand), gałąź jako jednostka, auto-układ drzewa | hierarchia to istota mapy |
| Whiteboard | tryb warsztatowy (rola, fazy, timer, głosowanie, follow-me), rysowanie odręczne, sceny | facylitacja to istota tablicy |
| Process Flow | typ przepływu (Classic/Automation/VSM), semantyka BPMN (Start/End/Activity/Decision/Lane/Split), walidacja | proces ma semantykę, nie tylko prostokąty |
| Table | widoki (Grid/Kanban/Timeline/Calendar/Matrix/Gallery), pola i typy, filtr/sort/grupowanie, menu wiersza/kolumny/komórki | dane to nie płótno; brak Hand/Connect/minimapy |

**Reguła rozstrzygająca spory:** jeśli funkcja nie jest w tabeli „specyficzne", musi zachowywać się identycznie. Dodanie nowej różnicy wymaga dopisania jej do tej tabeli wraz z uzasadnieniem.

---

## Z4 w praktyce: co znaczy „Teresa steruje wszystkim"

| Poziom | Przykład polecenia | Mechanizm |
|---|---|---|
| Cała Idea | „Skonwertuj to na inicjatywę" | akcja `idea.convert` scope `workspace`, `confirmBeforeRun`, preview |
| Aktualny widok | „Ułóż mi ten proces" | `flow.auto_layout` scope `current_view`, tool=process |
| Zaznaczenie | „Rozwiń zaznaczoną gałąź" | `map.expand_branch` scope `selected_items` |
| Element | „Zmień nazwę tego kroku na X" | `flow.rename_step` scope `single_item` |
| Dane | „Wypełnij puste komórki w kolumnie Koszt" | `table.ai_fill` scope `table_column`, `requiresPreview` |
| Nawigacja | „Pokaż mi to jako tabelę" | `view.switch` scope `current_view` — preferencja lokalna |

Zasady bezpieczeństwa:
- Teresa **nigdy** nie wykonuje `mutates: true` bez podglądu i potwierdzenia.
- Teresa **nie ma** akcji, których nie ma w UI (brak „ukrytych mocy").
- Każde wykonanie przez Teresę trafia do Historii z oznaczeniem „AI" i autorem polecenia.
- Teresa musi umieć powiedzieć, **czego nie potrafi** — zamiast udawać wykonanie.

---

## Kolejność wdrożenia rdzenia
1. Zbudować `ActionRegistry` + typy (bez migracji akcji).
2. Zmigrować akcje jednego narzędzia (Mind Map — ma najwięcej) jako wzorzec.
3. Powierzchnie renderowane z rejestru (Menu 3 → rail → panel → menu kontekstowe).
4. Strażnik CI `check-actions.sh` — od tego momentu martwy klik nie przejdzie.
5. Wygenerować tool-manifest Teresy z rejestru.
6. Domigrować pozostałe 3 narzędzia.

**Efekt uboczny, który warto nazwać:** ta sama zmiana likwiduje root-cause #1 z audytu (akcje `mm_*` w innych narzędziach) — bo `tools` w deklaracji fizycznie uniemożliwia pokazanie akcji tam, gdzie nie ma handlera.
