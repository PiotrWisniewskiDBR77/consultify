# Editor Shell Canon — wspólna powłoka 7 edytorów (D-I)

> **Status:** Autorytet (SSOT powłoki edytora) · **Data:** 2026-06-29 · **Rodzina:** obok [`CANON.md`](../CANON.md), [`navigation-permissions-canon.md`](navigation-permissions-canon.md), [`TABLE_AND_PREVIEW_CANON`](../03-modules/TABLE_AND_PREVIEW_CANON.md); tokeny/wizual = [`VISUAL_STANDARD`](../../standards/VISUAL_STANDARD.md).
> **Po co:** odbiory 2026-06-29 wykazały, że 16 problemów UI canvasu Ideas to NIE pojedyncze bugi, tylko **brak wspólnego systemu powłoki**. 4 edytory idea współdzielą chrome → te same problemy są we wszystkich; generatory dokumentów mają tę samą chorobę na wejściu. Ten kanon definiuje JEDNĄ powłokę, którą stosujemy 7×.
> **Decyzja Piotra (D-I):** priorytet #1, standard-first („posprzątać ZANIM serio budujemy"). Sekwencja: **ten Canon → wzorzec referencyjny na Mind Map → rozjazd na pozostałe 6**.

## 1. Zakres — 7 edytorów
- **4 idea (canvas):** Mind Map · Process Flow · Tabela (Ideas) · Whiteboard. Współdzielą realnie chrome (Piotr: „te same uwagi mamy") → jeden redesign naprawia wszystkie 4.
- **3 dokumentowe (generatory):** Raporty (M17-doc) · Prezentacje (M19) · Tabele Studio (M18). Ta sama choroba na wejściu (M17 step-1 „dramat nawigacyjny").
- **Poza zakresem:** edytor Notatnika (M04) — JUŻ jest wzorcem (hamburger ⋯, czyste menu); z niego czerpiemy wzorzec.

## 2. Trzy strefy powłoki (architektura)
Każdy edytor = **canvas/treść w centrum** + 3 strefy chrome. Reguły twarde:

### STREFA LEWA — narzędzia *floating na obszarze roboczym* (NIE w sidebarze aplikacji)
- Rail narzędzi (kursor/kształty/+/undo/redo/zoom) **pływa na krawędzi canvasu**, jak Miro/Figma — narzędzia należą do canvasu, nie do chrome aplikacji.
- **ZAKAZ:** rail w przestrzeni sidebara aplikacji (dziś przycina etykiety nawigacji: „nitiatives/xecution/esults…"). → naprawia **UI-L1**.
- Floating panel: półprzezroczyste tło, zaokrąglony, z marginesem od krawędzi; nie zasłania treści.

### STREFA GÓRNA — command row z HIERARCHIĄ (primary / secondary / overflow)
- **Jedna linia, trzy poziomy ważności** (nie 3 równorzędne warstwy):
  - **Primary** (1-4 akcje): najważniejsze dla tego edytora, zawsze widoczne, wyróżnione.
  - **Secondary**: zgrupowane, mniej wyróżnione (ghost).
  - **Overflow** (`⋯` hamburger — wzorzec z Notatnika): rzadkie/zaawansowane akcje pod jednym przyciskiem.
- **ZAKAZ:** trzy równorzędne warstwy w jednej linii (dziś: nawigacja-trybu + kształty/akcje + AI/Convert — wszystko płaskie). → naprawia **UI-L2, UI-L10**.
- **Przełączniki trybu:** max JEDEN segmented control z opisami; usunąć zdublowane/kryptyczne („Classic Flow / Map and classify / Kit classic" vs „Classic Flow / Automation / Value Stream"). → naprawia **UI-L13**.
- **Convert** = akcja kluczowa → czytelna etykieta („Utwórz z mapy"), ikony przy opcjach, krótki opis co się stanie; nie gubić w pasku. → naprawia **UI-L11**.
- **Bez duplikatów wejść AI:** „Discuss with Teresa" zostaje; „✦ AI Context" (duplikat) usunąć. → naprawia **UI-L12**.
- Usunąć zbędny pasek-kontekstu między command-row a canvasem (tytuł jest w breadcrumbie; „SEL"/hint mylące) — albo wyjaśnić, albo skasować. → naprawia **UI-L14**.

### STREFA PRAWA — inspector pogrupowany, **max 4-5 sekcji widocznych**, reszta collapse
- Prawy panel = pogrupowany inspector z jasną hierarchią: **primary sekcje widoczne (≤5), secondary zwinięte, zbędne usunięte**.
- **ZAKAZ:** 3 taby × ~8 sekcji = 24 sekcje naraz (dziś). Redakcja: co primary / co collapse / co usunąć. → naprawia **UI-L16**.
- Kategorie w panelu MUSZĄ być **pogrupowane z separatorami** (akcje robocze / generatory dokumentów / AI-artefakty z ceną tokenów — dziś zmieszane „wiele pomysłów bez większego pomysłu"). → naprawia **UI-L9**.
- Context menu węzła = bogate (styl/kolor, dodaj dziecko, połącz z, AI-expand, przenieś do folderu, convert-opcje), nie 6 pozycji. → naprawia **UI-L3**.

## 3. Reguły przekrojowe (cały shell)
- **Z-INDEX:** chrome aplikacji (dropdown profilu, modale) **zawsze nad** elementami canvasu; **context menu portaled do `body`** (z-index > wszystkiego). Dziś: command-row nad panelem profilu (**UI-L5**); context menu pod węzłem (**UI-L15**). → reguła warstw: `app-chrome > overlay-menu > canvas-nodes > canvas-bg`.
  - **KANONICZNA SKALA Z-INDEX** (SSOT: `tailwind.config.js → theme.extend.zIndex`; używaj tokenów, NIE surowych `z-[9999]`):
    | token | wartość | warstwa |
    |---|---|---|
    | `z-canvas` | 10 | węzły canvasu / raised in-flow |
    | `z-sticky` | 20 | sticky headers, command-row, chrome bars |
    | `z-dropdown` | 40 | dropdown / popover / select / tooltip (menu nad chrome) |
    | `z-overlay` | 50 | scrim (backdrop) modala/drawera |
    | `z-modal` | 60 | panel dialogu / drawera / sheeta (nad scrimem) |
    | `z-toast` | 100 | toasty (nad modalami) |
    | `z-context-menu` | 120 | context menu portaled do `body` (nad wszystkim) |
    - Zmigrowane prymitywy `ui/*` i `ui/primitives/*` (dialog, sheet, popover, tooltip, select, dropdown-menu, toast, Dropdown, Tooltip, Toast, Drawer, CommandPalette). Nowe overlaye MUSZĄ używać tych tokenów.
- **MOTYW: jeden, spójny.** Wszystkie edytory respektują ten sam motyw (ciemny domyślny wg [[VISUAL_STANDARD]]); **ZAKAZ wysp jasnych** (M15 renderuje się jasny vs reszta ciemna — i nawet wewnątrz M15 rozjazd). → naprawia **M15-UI1/UI6** (theming sweep).
- **Język ikon:** jeden zestaw (lucide outline), spójne rozmiary; ikona+tooltip dla akcji bez etykiety (wzorzec N4 Notatnika).
- **Klasa wizualna „2026":** monochrome chrome (slate/navy), budżet czerwieni ([[finding_ui_primary_is_crimson]] — `primary`=crimson, NIE nadużywać), flat surfaces, oddech. Koniec z „grafiką sprzed 10 lat / nie tech 2026 / 3 z minusem".
- **Modal/kreator:** NIE full-screen takeover bez nawigacji (M16-UI1 „wszystko zniknęło z menu") — zachować kontekst / czytelny back+breadcrumb, nie sam X. Nagłówek modala nie koliduje z logo/chrome (M16-UI2).
- **Empty-state:** kontekstowy (folder pusty ≠ „Plant an idea" gdy ALL=110); breadcrumb poziomu folderu z wyjściem (**UI-L7**).

## 4. Mapa: 16 problemów → reguła kanonu (dowód że to fix, nie łatka)
| Problem (z odbioru) | Strefa/reguła |
|---|---|
| UI-L1 rail w sidebarze | §2 LEWA — floating |
| UI-L2/L10 command-row 3 warstwy | §2 GÓRNA — hierarchia primary/secondary/overflow |
| UI-L3 context-menu ubogie | §2 PRAWA — bogaty kontekst węzła |
| UI-L4 routing narzędzia (zły tool) | bug Tor 2 (`idea_deeplink_tool_routing_race`) — poza shellem, ale w sekwencji |
| UI-L5 z-index command-row vs profil | §3 z-index |
| UI-L6 grafika modal New Idea | §3 klasa wizualna 2026 |
| UI-L7 pułapka folderu / empty-state | §3 empty-state + breadcrumb |
| UI-L8 foldery zapis | bug Tor 2 (M05-P1) |
| UI-L9 prawy panel kategorie zmieszane | §2 PRAWA — grupowanie+separatory |
| UI-L11 Convert nieczytelny | §2 GÓRNA — Convert |
| UI-L12 „AI Context" duplikat | §2 GÓRNA — bez duplikatów AI |
| UI-L13 przełączniki trybu kryptyczne | §2 GÓRNA — jeden segmented |
| UI-L14 pasek-kontekstu zbędny | §2 GÓRNA — usuń/wyjaśnij |
| UI-L15 context-menu pod węzłem | §3 z-index (portal) |
| UI-L16 prawy panel 24 sekcje | §2 PRAWA — ≤5 widocznych |
| OK1 panel właściwości węzła | ZOSTAJE (działa dobrze) |

## 5. Rozjazd (reference-first) + kryterium odbioru
1. **Mind Map = wzorzec referencyjny** (Piotr wskazał). Zbuduj shell wg tego kanonu na Mind Map → **Piotr akceptuje wzoriec** (sign-off wizualny na demo).
2. Po akcepcie: rozjazd 1:1 na **Process Flow / Tabela / Whiteboard** (współdzielony chrome → głównie zastosowanie shella), potem **3 generatory dokumentów** (IA wejścia + hierarchia).
3. **Kryterium „Shell ✅" (per edytor):** 3 strefy wg kanonu · z-index OK · jeden motyw · command-row z hierarchią · prawy panel ≤5 sekcji · context-menu portaled+bogate · zero rail-w-sidebarze · klasa wizualna 2026. Odhaczane w macierzy L1.

## 6. Pytania wzornicze do Piotra (sign-off przy wzorcu Mind Map — sekcja B tablicy)
- **D-I-1** Primary actions Mind Mapy (które 1-4 trafiają na primary command-row)? Rekomendacja: Add node · Auto-layout · Convert · Discuss with Teresa.
- **D-I-2** Prawy inspector — które ≤5 sekcji widoczne domyślnie? Rekomendacja: Properties · Idea Completeness · Convert · AI-suggestions · Backlinks; reszta collapse.
- **D-I-3** Tryby (Classic/Automation/Value Stream + Map/Kit) — scalić w 1 segmented z opisami, czy część usunąć?
*(Default po 72h: rekomendacje powyżej — wzorzec i tak idzie do Twojej akceptacji na demo.)*
