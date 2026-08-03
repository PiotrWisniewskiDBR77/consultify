# ★★★ TRIADA — ABSOLUTNY KANON (Menu · Tabela · Preview · Kanban)
> **Ustanowiony przez właściciela 2026-07-04 na żywych ekranach My Work (Tasks/Decisions/Inbox).**
> To jest OSTATECZNY opis. Nie projektujemy tego ponownie. Każdy ekran listowy w aplikacji wygląda DOKŁADNIE tak — różni się wyłącznie treścią kontekstową (nazwy encji, akcje domenowe).
> Implementacja: `src/components/standard/` (StandardModuleBar · StandardTable · StandardPreview [· StandardKanban]). Moduł DEKLARUJE treść, komponent NARZUCA wygląd. Zmiana wyglądu poza tymi komponentami = błąd.
> Odbiór każdego ekranu: LISTA CZEKOWANIA (część B) — literalnie, punkt po punkcie, za każdym razem.
> Dokumenty źródłowe (uzupełniające, NIE konkurencyjne): TABLE_AND_PREVIEW_CANON.md (mechanika, §14.7, §27), ARTIFACT_ANATOMY_STANDARD.md (§9 tokeny), _STANDARD_TRIADA_NOTATKA.md (słowa właściciela).

---
# CZĘŚĆ A — KANON OPISOWY

## A1. MENU 1 (pasek górny)
Lewa: breadcrumb „Moduł › Zakładka". Prawa: Data · Model · ikony systemowe · profil. Nie ruszamy — tylko nie psuć.

## A2. MENU 2 (środkowe, funkcjonalne)
- Od LEWEJ: lupa (ikona w kółku), potem przyciski funkcjonalne modułu: **pigułka h-9, rounded-full, WIDOCZNA ramka, płaskie tło, ikona 16 + etykieta text-sm**.
- **Aktywna pigułka = wypełniona wyraźnie innym, NEUTRALNYM kolorem** (nigdy crimson).
- Od PRAWEJ (do środka): **primary CTA** (ciemny wypełniony; w dark — jasny inwers) → **segment przełącznika widoków** (ikony: lista / kanban / kalendarz w jednej grupie) → dodatkowe filtry, jeśli potrzebne.
- Bez liczników w Menu 2 (liczniki mieszkają w Menu 3).

## A3. MENU 3 (dynamiczne)
- Chipy MNIEJSZE niż Menu 2: h-7, text-[11px], rounded-full.
- **Trzy wymienne tryby w tym samym pasku:** ① filtry z licznikami (licznik zawsze, także „0"; aktywny chip wypełniony) · ② pasek akcji bulk, gdy zaznaczono ≥1 wiersz · ③ dynamiczne karty otwartych pozycji (tab + ×).
- Od PRAWEJ: przyciski funkcjonalne AI (np. „✦ AI Priorities").

## A4. TABELA
- **Nagłówek:** text-[11px] uppercase, sticky; sort klikiem (strzałki), lejek-filtr per kolumna; hairline pod nagłówkiem.
- **Wiersze:** oddzielone WYŁĄCZNIE delikatną linią włoskową (light i dark). Nigdy gruby/biały pas, nigdy zebra.
- **Wiersz = tytuł semibold + (opcjonalnie) szary podtytuł** — podtytuły włącza/wyłącza „Show row description" w pstryczku.
- **Kolumny:** ręczny resize (grip, zero-sum, zapamiętywany), zmiana kolejności, filtrowanie, sortowanie — mechanika 1:1 z My Work (działa idealnie — przenosić, nie reimplementować).
- **Checkbox po lewej każdego wiersza** → zaznaczenie przełącza Menu 3 w tryb bulk (akcje zależne od encji).
- **Statusy:** cichy chip z kropką (To Do / In progress…). **Priorytety:** kropka + tonowany tekst (Critical czerwonawy TEKST, nie pigułka).
- Pusta komórka = „—". Liczby wyrównane do prawej (tabular-nums). Kebab na końcu wiersza.

## A5. PSTRYCZEK TABELI (prawy górny róg) — OBOWIĄZKOWY
Ikona Settings2 → popover „VISIBLE COLUMNS": checkboxy kolumn (Task/Actions = LOCKED z dopiskiem), na dole wiersz **„Show row description"** z przełącznikiem. Jeden i ten sam popover w każdej tabeli aplikacji. To niezbędny element sterowania — sprawdzany przy KAŻDYM odbiorze.

## A6. KEBAB WIERSZA — 5 bloków w niezmiennej kolejności (3 strefy wizualne = 2 separatory; każda pozycja z ikoną)
1. **Wejście+domknięcie** (zawsze): View/Open + Complete/Done/Approve.
2. **Przejścia stanu** (wg encji): Task = To do/In progress/Blocked · Decyzja = Approve/Reject · Inbox = Focus → Today/This week/Later.
3. **Czas** (encje z terminami): Delay › / Snooze-presety (2h · jutro rano · 3 dni · pon.).
4. **Uniwersalny** (ZAWSZE, identyczny app-wide): Open preview · Edit · Archive — niegotowe pokazujemy disabled z dopiskiem, nigdy nie ukrywamy.
5. **Destrukcyjny** (zawsze ostatni, oddzielony): Delete/Reject — czerwony; jedyna czerwień menu.

**Moduł deklaruje WSZYSTKIE 5 bloków, we właściwej kolejności — komponent nic z tego nie egzekwuje ani
nie dokłada automatycznie.** Zweryfikowano w `src/components/shared/RowActionsMenu.tsx`: `visibleSections`
renderuje dokładnie to, co dostanie w propie `sections` (i `actions` w trybie legacy), **w kolejności
podanej przez wołający ekran** — komponent nie sortuje po `kind` (typ `RowActionSectionKind`, 7 wartości,
jest czysto opisową etykietą bez żadnej logiki rozmieszczenia). Jedyne, co komponent robi sam: filtruje
`hidden` i atrapy (`czyAtrapa()`) i usuwa sekcję, jeśli po filtrze jest pusta. Jeśli ekran poda bloki
4–5 w złej kolejności albo w ogóle je pominie, komponent to wyrenderuje bez ostrzeżenia — to jest
**odwrotność** zasady „moduł deklaruje treść, komponent narzuca wygląd" obowiązującej w tym projekcie,
i jest **znanym długiem** (kandydat do `_DOC_CODE_DELTA_REGISTER.md`), nie stanem docelowym.
`03-modules/TABLE_AND_PREVIEW_CANON.md` §9.1a opisuje to samo zjawisko od strony mechaniki komponentu
(3 strefy GÓRA/DÓŁ/DANGER) i już wcześniej to poprawnie przyznawał — ta sekcja była tym, co się
z nim rozjeżdżało.

**Separatory — realnie 2, nie 4.** Komponent renderuje separator (`border-t`) między KOLEJNYMI
elementami tablicy `sections`, nie między każdą parą bloków TRIADY z osobna. W standardowym mapowaniu
§9.1a bloki 1+2 („Wejście+domknięcie" + „Przejścia stanu") żyją w jednej sekcji GÓRA — bez separatora
między nimi; bloki 3+4 („Czas" + „Uniwersalny") żyją razem w sekcji DÓŁ — też bez separatora między
nimi. Separator jest więc TYLKO między GÓRA/DÓŁ i między DÓŁ/DANGER — czyli 2 separatory, 3 strefy.
Odbiór wzrokowy (Część B, pkt 19) ma to sprawdzać jako „separator między strefami", nie szukać
separatora między każdym z 5 bloków.

## A7. PREVIEW — 6 bloków od góry do dołu
1. **Nagłówek:** tytuł (truncate) · pinezka · **Open** (jedyne w preview) · ×.
2. **Karta meta:** chipy Status/Priorytet/Ważność + termin po prawej + linia rekomendacji.
3. **DETAILS:** etykieta + „~N words" + ⋮ (Copy / Export / Pobierz — eksporty TYLKO tutaj); treść przewijalna.
4. **AI:** ramka z chipami akcji AI dopasowanymi do encji.
5. **Relations:** klikalne pigułki albo „No relations".
6. **AKCJE:** siatka 2 kolumny — rząd 1: rozstrzygnięcia · rząd 2: informacyjne · rząd 3: czas/eskalacja.

## A8. PRZYCISK AKCJI (preview i wszędzie) — JEDEN komponent, 4 warianty
Pigułka h-9 rounded-full, **widoczna ramka**, ikona + etykieta + (opcjonalnie) szary badge skrótu `[A]`.
Warianty (ustabilizowane, niepodmienialne): **pozytywny** zielony tint · **destrukcyjny** czerwony tint · **uwaga** bursztynowy tint · **neutralny** ghost z ramką · **główny** granatowo-biały kontrast (`primary`, **maks. jeden na preview**, nigdy crimson). Moduł wybiera wariant+etykietę+handler — nic więcej.

**Wariant wybiera SKUTEK akcji, nie ekran.** Ta sama akcja wygląda identycznie w każdym module — pełna tabela skutek→wariant i lista wariantów wycofanych (`purple`/`green`/`blue`): `TABLE_AND_PREVIEW_CANON.md` §7.3b.
> **D21 (Piotr, 2026-07-12):** przyciski akcji w preview = pill (`rounded-full`) — „taki jak Google i Apple". `rounded-lg` na przyciskach akcji w preview = naruszenie kanonu (SSOT tokenów: `PREVIEW_PILL_BASE` w `src/components/shared/PreviewPane/previewStyles.ts`).

## A9. KANBAN
- **Kolumny = strefy, nie pudełka**: bez tła i obrysu; nagłówek = kropka stanu + nazwa + goły licznik; „+" tylko gdzie wolno tworzyć; puste kolumny ZAWSZE widoczne (placeholder: ikona + „No …" wyszarzone).
- **Karta:** pionowy ~3px pasek akcentu na lewej krawędzi (bursztyn=oczekujące, czerwony=krytyczne; karta CRITICAL + delikatny tint tła — JEDYNY kolor powierzchni) · uchwyt ⠿ · tytuł semibold 2 linie · szary opis 2 linie · ciche chipy priorytet+typ · chip projektu · stopka: termin („Nd waiting" szare / „Nd overdue" czerwonawe) + awatar. Hairline ramka, cień minimalny, hover raised.
- Drag za uchwyt; pusta kolumna przyjmuje drop; klik karty = preview (A7); nad deską pełna triada Menu 1/2/3, filtry Menu 3 działają na deskę.
- ZAKAZY: kolumny-pudełka · pełne czerwone pigułki priorytetów · chowanie pustych kolumn.

## A10. KOLORY I FOKUS (obowiązuje wszystko powyżej)
Czerwień = wyłącznie semantyka krytyczna (overdue/error/blocked/delete). Aktywne stany UI = neutralne. Focus = niebieski (nigdy akcent/crimson); edytory tekstu bez obwódki fokusa. `primary` w tailwind = crimson #85182F — zakazany jako kolor UI.

---
# CZĘŚĆ B — LISTA CZEKOWANIA (odbiór ekranu; literalnie, ZA KAŻDYM RAZEM)
> Werdykt: ekran przechodzi wyłącznie przy 100% ✓ (albo „n/d" z powodem). Wynik listy dołączany do raportu odbioru razem ze zrzutami.

**MENU (7)**
- [ ] 1. Menu 2: pigułki h-9 z ramką, ikona+etykieta; aktywna wypełniona neutralnie
- [ ] 2. Menu 2: od prawej — CTA ciemny/inwers → segment widoków → filtry
- [ ] 3. Menu 2: bez liczników
- [ ] 4. Menu 3: chipy h-7 z licznikami (0 widoczne), aktywny wypełniony
- [ ] 5. Menu 3: zaznaczenie wierszy przełącza pasek w tryb bulk
- [ ] 6. Menu 3: otwarcie pozycji pokazuje kartę-tab z ×
- [ ] 7. Menu 3: przyciski AI po prawej

**TABELA (8)**
- [ ] 8. Nagłówek uppercase 11px, sticky przy scrollu
- [ ] 9. Sort klikiem nagłówka + lejki filtrów per kolumna
- [ ] 10. Wiersze oddzielone hairline (nie pas, nie zebra) — sprawdzić w dark I light
- [ ] 11. Podtytuły wierszy istnieją i reagują na „Show row description"
- [ ] 12. Resize kolumn gripem działa i jest zapamiętany po odświeżeniu
- [ ] 13. Checkbox po lewej każdego wiersza
- [ ] 14. Statusy = cichy chip z kropką; priorytety = kropka+tekst (zero czerwonych pigułek)
- [ ] 15. Puste komórki = „—"; liczby do prawej

**PSTRYCZEK (3)**
- [ ] 16. Settings2 w prawym górnym rogu tabeli — jest i otwiera popover
- [ ] 17. Popover: „VISIBLE COLUMNS", locked na Task/Actions, checkboxy działają
- [ ] 18. Popover: „Show row description" na dole, działa

**KEBAB (5)**
- [ ] 19. Otwiera się przy każdym wierszu; separator między GÓRA/DÓŁ i między DÓŁ/DANGER (2 separatory,
      3 strefy — NIE między każdym z 5 bloków, patrz A6); ikony przy pozycjach
- [ ] 20. Blok 1: View/Open + akcja domykająca
- [ ] 21. Blok 2: przejścia stanu właściwe dla encji
- [ ] 22. Blok 4: Open preview · Edit · Archive (niegotowe = disabled z dopiskiem, nie ukryte)
- [ ] 23. Blok 5: Delete/Reject czerwony, ostatni, oddzielony
&nbsp;&nbsp;&nbsp;&nbsp;*(blok 3 Czas — tylko encje z terminami: sprawdzić jeśli dotyczy)*

**PREVIEW (7)**
- [ ] 24. Single-click wiersza otwiera preview; Esc zamyka; „Open" przechodzi do pełnego widoku
- [ ] 25. Nagłówek: tytuł+pin+Open+× (Open jedyne w preview)
- [ ] 26. Karta meta: chipy statusu/priorytetu + termin
- [ ] 27. DETAILS z ⋮ (Copy/Export/Pobierz tylko tam)
- [ ] 28. Ramka AI z chipami per encja
- [ ] 29. Relations albo „No relations"
- [ ] 30. Akcje: 2 kolumny, rzędy wg logiki (rozstrzygnięcia → informacyjne → czas)

**PRZYCISKI (2)**
- [ ] 31. Wszystkie akcje preview = pigułki h-9 z ramką, ikona+etykieta(+skrót)
- [ ] 32. Kolory tylko z 4 wariantów (zielony/czerwony/bursztyn/neutral) — zero innych

**KANBAN (5 — jeśli ekran ma widok kanban)**
- [ ] 33. Kolumny bez tła/obrysu, z kropką+licznikiem; puste widoczne z placeholderem
- [ ] 34. Karty: pasek akcentu ~3px po lewej; CRITICAL = tint tła; zero czerwonych pigułek
- [ ] 35. Karta: tytuł 2l + opis 2l + ciche chipy + stopka termin/awatar
- [ ] 36. Drag&drop działa; pusta kolumna przyjmuje drop
- [ ] 37. Klik karty = preview (ten sam standard A7)

**KOLOR/FOKUS (3)**
- [ ] 38. Zero crimson jako stan UI/CTA/fokus na całym ekranie
- [ ] 39. Fokus klawiaturowy niebieski; edytory tekstu bez obwódki
- [ ] 40. Light mode: przejść pkt 10, 14, 31-32 ponownie w light

**KLAWIATURA / A11Y (3)** — analogicznie do `ARTIFACT_ANATOMY_STANDARD.md` §18.1
- [ ] 41. Pełny cykl Tab/Shift+Tab przez WSZYSTKIE interaktywne elementy ekranu
      (menu → tabela/karty → pstryczek → kebab → preview → akcje), bez pułapki
      fokusa (focus nigdy nie ginie ani nie zapętla się w martwym miejscu);
      każdy element klikalny (w tym karty grid/kanban z `onClick` na `<div>`)
      musi być osiągalny klawiaturą (`tabIndex=0` + `role="button"` +
      Enter/Space), nie tylko myszą
- [ ] 42. Esc zamyka aktywny warstwowy element — w kolejności najbardziej
      lokalny wygrywa: otwarty kebab/dropdown → preview → modal/drawer
      (jedno wciśnięcie = jedno zamknięcie, nie wszystko naraz)
- [ ] 43. Fokus WIDOCZNY (`focus-visible:ring-2 ring-[color:var(--c-focus)]`,
      nigdy `primary-*`/crimson) na KAŻDYM interaktywnym elemencie ekranu —
      przycisk, link, checkbox, wiersz/karta klikalna, chip, input; zero
      `focus:outline-none` bez widocznego zamiennika (edytory tekstu: dopuszczalna
      zmiana koloru ramki/podkreślenia zamiast pełnego ringu — pkt 39)

> **Streaming Teresy — wymóg `aria-live="polite"`.** Każdy region, w którym
> odpowiedź AI dopisuje się na bieżąco (czat/panel Teresy, „AI pisze…", karty
> `generating`), MUSI mieć kontener z `role="log"` (lub `role="status"` dla
> krótkich wskaźników) + `aria-live="polite"` + `aria-relevant="additions text"`,
> żeby czytnik ekranu ogłaszał przyrost treści bez re-czytania całej historii.
> Referencyjna implementacja: `src/components/AIChat/UnifiedChatPanel.tsx`
> (kontener wiadomości, `role="log" aria-live="polite"`).

---
# CZĘŚĆ C — SPECYFIKACJA TECHNICZNA (wartości mierzalne, z kodu My Work)
> Twarde liczby: kolory, rozmiary, ramki, odstępy. Źródło: `src/index.css` (tokeny), `tailwind.config.js` (radius/cień), `ModuleMenu3.tsx` + `MyTasksListContent.tsx` (klasy). To jest kontrakt — implementacja MUSI dać te wartości.

## C1. TOKENY KOLORÓW (SSOT `src/index.css`)
| token | DARK (baza) | LIGHT |
|---|---|---|
| `--c-bg` (tło aplikacji) | `#0a0f1e` | biel/jasny |
| `--c-surface` (karty/wiersze) | `#0f172a` | `#ffffff` |
| `--c-surface-raised` (popover/chip) | `#15213b` | `#f8fafc` |
| `--c-border-subtle` (**hairline wierszy**) | `rgba(148,163,184,0.12)` | `#e6e9ed` |
| `--c-border` (domyślne ramki) | `rgba(148,163,184,0.22)` | `#cbd2da` |
| `--c-border-strong` (hover/active) | `rgba(148,163,184,0.36)` | `#9aa6b5` |
| `--c-focus` / `--c-focus-solid` (**niebieski, nigdy crimson**) | `rgba(91,141,239,.45)` / `#5b8def` | `rgba(37,99,235,.4)` / `#2563eb` |
| semantyka | `--c-success` zielony · `--c-warning` bursztyn · `--c-danger` czerwień · `--c-info` niebieski | jw. |
| `--c-accent` = **crimson `#85182F`** | TYLKO marka/nic-UI | jw. |

Mapowanie statusów (SSOT `statusChipTone()`): **info** = in_progress/draft/open/scheduled/promoted · **warning** = pending/in_review · **success** = approved/completed/published · **danger** = rejected/blocked/failed/overdue.
Priorytet (cichy chip): Critical → kropka `bg-danger-500` + `text-danger-700 dark:text-danger-300`, tło transparent · High → bursztyn · Medium → niebieski · Low → slate. **Zero wypełnionych pigułek.**

## C2. RADIUS (tailwind `token-*`)
`xs 6px` (badge/chip) · `sm 8px` (input/mała karta) · `md 12px` (karta/modal) · `lg 16px` (panel/drawer) · `xl 20px` (hero) · `pill 9999px` (pigułki/toggle).

## C3. ODSTĘPY I SIATKA
Wszystko w wielokrotnościach **4px**: 4·8·12·16·20·24·32·40·48. Padding wiersza tabeli: komórki `px-3 py-2.5` (tytuł `py-3`), checkbox `px-2 py-2.5`. Pasek Menu 3: `px-4 py-2`.

**Odstęp Menu 3 → nagłówek tabeli: `mb-2` (8px).** _(uzupełnione 2026-07-28, uwaga P-6)_
Kanon opisywał dotąd wyłącznie padding WEWNĄTRZ paska, więc pasek stykał się z nagłówkiem
kolumn i obie warstwy sterowania — filtry oraz nazwy kolumn — czytały się jako jedna.
Wartość jest świadomie skromna: większa odsuwałaby filtry od tego, co filtrują.
Wymuszane w `MENU_3_ROW_CLASS` (`components/shared/ModuleMenu3.tsx`), nie per ekran.

**Licznik słów w bloku DETAILS podglądu** opisuje PROZĘ („ile tu jest czytania").
Gdy blok niesie listę plików albo tabelę właściwości — `showWordCount={false}`.
_(Podgląd Sejfu pokazywał `~30 words` nad pięcioma nazwami dokumentów — PILNE-8.)_

**Właściwości encji (klucz–wartość) nie idą do pola na prozę.** `StandardPreview.details`
przyjmuje `properties: ArtifactPropertyRow[]` i renderuje je przez `ArtifactPropertiesTable`
(SPEC-A §11.2). Sklejanie ich w akapit przez `join('\n\n')` dało w przeglądzie 128 zrzutów
cztery podglądy będące zrzutem pól (Interview→Sessions, Tools×3) — N-52.

**Menu wiersza (kebab) nie pokazuje ATRAP.** Pozycja wyłączona dlatego, że funkcji jeszcze
nie zbudowano („Coming soon"/„Wkrótce"), jest ukrywana — filtruje ją `czyAtrapa`
w `RowActionsMenu`. Pozycja wyłączona przez REGUŁĘ produktu zostaje widoczna z powodem
(„AI-generated — read-only", „Archive first", „Safes are automatic — cannot be deleted"),
bo uczy zasady zamiast obiecywać. Gdy po odsianiu nie zostaje nic — kebaba nie ma wcale.

## C4. MENU 2 — pigułka (`MENU_2_TAB_*`)
`h-9` (36px) · `rounded-full` · `border` · `px-3` · `text-sm` · `font-medium` · `gap-2` · transition 150ms.
- nieaktywna: `border-slate-200/70 bg-white/70 text-slate-700` (dark `border-white/[0.06] bg-white/[0.04] text-slate-300`)
- **aktywna (neutralna)**: `border-slate-300 bg-slate-900/[0.07] text-slate-900` (dark `border-white/25 bg-white/10 text-slate-100`)

## C5. MENU 3 — chip (`MENU_3_CHIP_*`)
`h-7` (28px) · `rounded-full` · `border` · `px-2.5` · `text-[11px]` · `gap-1.5`.
- nieaktywny: `border-slate-200 bg-transparent text-c-text-muted` (dark `border-white/10`)
- aktywny: `border-slate-300 bg-slate-900/[0.07] text-slate-900` (dark `border-white/30 bg-white/10 text-white`)

## C6. TABELA
- Nagłówek: `text-[11px] uppercase font-semibold text-slate-500 dark:text-slate-400`, `sticky top-0 z-10`.
- **Hairline między wierszami**: `border-b border-slate-200/60 dark:border-white/[0.03]` (rodzic NIGDY `overflow-hidden` — sticky by się zepsuł).
- Tytuł wiersza: `text-sm font-semibold text-slate-900 dark:text-slate-100`; podtytuł: `text-[11px] leading-4 text-slate-500 dark:text-slate-400`; pusta komórka `—`.
- Wysokość wiersza stała (bez zmiany na hover), bez zebry.

## C7. TYPOGRAFIA (SSOT `typography.ts`; font **Inter**)
`L1` 11px semibold UPPERCASE tracking .16em (kicker) · `L2` 13px semibold (tytuł) · `L3` 13px/1.6 (treść) · `L4` 12px (wspierająca) · `L5` 11px (caption/timestamp) · `N` 22px semibold tabular-nums (KPI) · `Q` 13px italic 1.65 (cytat).

## C8. IKONY / CIEŃ / RUCH
Ikony lucide: `12` micro · `16` domyślna (wiersz, przycisk) · `20` topbar · `24` duże.
Cienie (`hig`): karta `token-card`, hover `token-card-hover`, focus `token-focus = 0 0 0 3px var(--c-focus)`.
Ruch: hover/przycisk 100ms · panel/modal 200ms · ease `cubic-bezier(.4,0,.2,1)` · **nigdy >220ms** · `prefers-reduced-motion` respektowane.

## C9. PREVIEW
Szerokość `clamp(340px, 28%, 480px)`; separacja od tabeli `gap-1.5` (bez `border-l`); wrapper `bg-slate-50 dark:bg-navy-950 p-3`; karta `rounded-xl bg-white/70 dark:bg-navy-900/70 border border-slate-200/70 dark:border-white/[0.06] backdrop-blur`; stopka akcji `space-y-2.5`, **bez dividerów** między kartami.
Przycisk akcji: `h-9 rounded-full border` + ikona + etykieta + badge skrótu; warianty positive/destructive/warning/neutral.

## C10. KANBAN
Kolumna: bez tła/obrysu, stała szerokość, przewijanie poziome deski. Karta: `bg-c-surface` `rounded-lg/xl` + hairline + cień minimalny; **lewy pasek akcentu ~3px** (bursztyn=oczekujące, czerwony=krytyczne); CRITICAL + delikatny tint tła.

---
# CZĘŚĆ D — REFERENCJE WIZUALNE — **BRAK PLIKÓW W REPO** (zweryfikowano 2026-08-02)
> **Stan faktyczny:** katalog `docs/ui-standards/assets/triada/` **nie istnieje**, i żaden z czterech
> plików niżej nie istnieje nigdzie w repo. Zweryfikowano: `find docs/ui-standards/assets -maxdepth 3`
> (katalog `triada/` brak) oraz `find . -name "01-tabela-dark.png"` (i analogicznie dla pozostałych
> trzech nazw) → zero trafień w całym drzewie. Poprzednia wersja tej sekcji osadzała `![...]` na te
> ścieżki i twierdziła „każdy nowy ekran musi być NIEODRÓŻNIALNY od tych obrazów" — to była referencja
> do niczego, gorsza niż brak sekcji, bo dawała złudzenie posiadanego wzorca odbioru. Panel adwersaryjny
> 2026-08-02, pozycja K-02 (`_KOREKTY_PO_PANELU_ADWERSARYJNYM_2026-08-02.md`).
>
> Obrazy MIAŁY pochodzić z produkcji: **demo.consultify.ai, commit `de37ea03e2`** — cztery zrzuty:
> tabela (dark), tabela (light), preview (dark), kanban (dark). To jest wskazówka do odtworzenia, nie
> dowód, że coś istnieje dziś.
>
> **Do uzupełnienia:** nowe zrzuty z żywego demo, ten sam kadr co opis niżej, zapisane do
> `docs/ui-standards/assets/triada/` pod tymi samymi nazwami, dopiero wtedy osadzić `![...]`. Do tego
> czasu odbiór wzrokowy (Część B) opiera się WYŁĄCZNIE na opisie słownym w Części A — nie ma obrazu do
> porównania 1:1.

**Tabela (dark) — Menu 1/2/3 + wiersze + statusy/priorytety + pstryczek:**
`assets/triada/01-tabela-dark.png` — **BRAK PLIKU**

**Tabela (light) — te same reguły w jasnym trybie:**
`assets/triada/04-tabela-light.png` — **BRAK PLIKU**

**Preview (dark) — 6 bloków + przyciski akcji (4 warianty, skróty):**
`assets/triada/02-preview-dark.png` — **BRAK PLIKU**

**Kanban (dark) — kolumny-strefy, puste widoczne, karty z paskiem akcentu:**
`assets/triada/03-kanban-dark.png` — **BRAK PLIKU**

---
# CHANGELOG

| Data | Zmiana |
|---|---|
| 2026-08-02 | **Korekta po panelu adwersaryjnym** (`_KOREKTY_PO_PANELU_ADWERSARYJNYM_2026-08-02.md`, pozycje K-02/K-03/K-03b): (a) Część D — 4 obrazy referencyjne `assets/triada/*.png` NIE istnieją w repo (katalog `assets/triada/` brak, zero trafień w całym drzewie); zastąpiono osadzenia jawnym `BRAK PLIKU` + notą o źródle (demo.consultify.ai, commit `de37ea03e2`) do odtworzenia. (b) §A6 — zdanie „bloki 4–5 dokłada komponent automatycznie" było fałszywe: `RowActionsMenu.tsx` renderuje dokładnie to, co dostanie w propie `sections`, w kolejności wołającego, bez sortowania po `kind`; poprawiono na „moduł deklaruje wszystkie 5 bloków, komponent nic nie egzekwuje" + oznaczono jako znany dług. (c) §A6/pkt 19 — „separatory między blokami" (sugerujące 4) poprawiono na realny model: 3 strefy (GÓRA/DÓŁ/DANGER) = 2 separatory; bloki 1+2 i bloki 3+4 żyją parami bez separatora wewnątrz strefy. Zero podniesionych statusów; korekta czysto faktograficzna. |
