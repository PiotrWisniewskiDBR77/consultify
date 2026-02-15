# DBR77 Visual Language Standard (KANON)

> **Wersja:** 2.0 — "Tech Sexy" Edition  
> **Data:** 2026-02-15  
> **Status:** OBOWIĄZUJĄCY  
> **Cel:** Jedna, spójna "warstwa wizualna" dla całej aplikacji (kolory, tła, ramki, typografia, spacing, depth, motion) – niezależnie od modułu i niezależnie od trybu prezentacji detail view.  
> **Lokalizacja:** `docs/ui-standards/00-foundation/visual-language.md`
>
> **Changelog v2.0:** Ewolucja standardu na podstawie analizy wzorców UI 2025-2026 (ChatGPT, Notion, ClickUp, Gemini, NotebookLM). Nie rewolucja — refinement w kierunku "quiet luxury UI".

---

## 0) Zasady nadrzędne (MUST)

- **Jedna aplikacja, jeden język wizualny.** Moduły i tryby widoku nie wprowadzają własnej palety, ramek, typografii ani "stylu kart".
- **Minimalizm DBR77.** UI ma być "enterprise clean": mniej ramek, więcej rytmu spacing + hierarchii typograficznej + subtelnych separatorów.
- **Semantyka kolorów jest święta.** Kolory oznaczają znaczenie (CTA / info / warning / danger / success), nie "ład".
- **Dark mode jest pierwszoplanowy.** Każdy komponent musi wyglądać równie dobrze w `dark`.
- **Powściągliwość (restraint).** Na ekranie jest **jeden** kolorowy element (CTA). Reszta jest monochromatyczna. Elegancja przez brak.
- **Przestrzeń to element designu.** Pusta przestrzeń to nie "brak contentu" — to celowa cisza, która podnosi premium feel.
- **Separacja przez tło i przestrzeń, nie linie.** Bordery są ostatecznością. Preferuj zmianę tła, cień lub whitespace.

### 0.1) "Tech Sexy" — definicja premium feel (KANON)

Współczesne produkty top-tier (ChatGPT, Notion, ClickUp, Gemini, NotebookLM) stosują te same wzorce. Consultify MUSI je adoptować:

1. **Monochromatyczna hierarchia** — prawie zero koloru w chrome, hierarchia przez jasność/ciemność odcieni szarości
2. **Invisible borders** — elementy separowane zmianą tła, cieniem lub spacingiem, nie `border`
3. **Confidence in emptiness** — duży oddech w content area; sidebar tight, content spacious
4. **Micro-consistency** — identyczne radiusy, stroke-width ikon, spacing tokeny, easing curves wszędzie
5. **Depth without decoration** — głębia z warstw tła + shadow, zero gradientów/tekstur/dekoracji
6. **Motion that breathes** — 120-220ms ease-out, zero bounce/spring jako default

---

## 1) Źródła prawdy (MUST)

To są jedyne kanoniczne źródła tokenów i reguł:

- **DBR77 colors & Apple HIG tokens:** `tailwind.config.js`
- **Globalne style i wzorce kontenerów:** `src/index.css`
- **Semantyka DBR77 color usage:** `docs/ui-standards/00-foundation/color-system.md`
- **Uwaga (legacy):** `packages/shared/src/ui/theme.ts` nie jest źródłem prawdy dla DBR77 (nie jest używany przez core UI) i nie może nadpisywać tokenów z Tailwinda.

> Jeśli standard mówi X, a komponent robi Y — komponent jest do poprawy (albo aktualizujemy standardy centralnie).

---

## 2) Kolory (KANON)

### 2.1 DBR77: 4 kolory semantyczne + neutral (MUST)

- **PRIMARY (`primary/*`)**: CTA, aktywny stan, focus, linki.
- **SECONDARY (`secondary/*`) / NEUTRAL NAVY (`navy/*`)**: nawigacja, UI chrome, neutralne tła i tekst.
- **DANGER (`danger/*`)**: błędy, destrukcja, alarm.
- **SUCCESS (`success/*`)**: potwierdzenie, "healthy/up".
- **NEUTRAL (`navy/*`, `slate/*`)**: tła, bordery, tekst, separatory.

### 2.2 Kolory sygnałowe (MUST/SHOULD)

DBR77 dopuszcza dwa kolory sygnałowe (nie‑brandowe), **wyłącznie** dla sygnalizacji:

- **WARNING / AT RISK:** `amber/*`
- **INFO:** `blue/*`

**MUST:** ich użycie ograniczamy do `badge/dot/callout` (i ewentualnie tła typu surface).  
**MUST NOT:** nie używamy ich dla CTA ani jako stałego koloru nawigacji/ramek paneli.

---

## 3) Tła i surfaces (KANON)

### 3.1 System wielowarstwowych teł (MUST) — "Depth through background"

Interfejs MUSI mieć **minimum 3 warstwy głębi** poprzez odcienie tła. Różnica między warstwami jest **subtelna (2-5% jasności)** — mózg rejestruje ją podświadomie jako przestrzeń 3D bez skeuomorfizmu.

| Warstwa                | Rola                        | Dark mode        | Light mode                   |
| ---------------------- | --------------------------- | ---------------- | ---------------------------- |
| **Layer 0** (deepest)  | Sidebar, system chrome      | `bg-navy-950`    | `bg-slate-100`               |
| **Layer 1** (base)     | Główna content area         | `bg-navy-900`    | `bg-white`                   |
| **Layer 2** (elevated) | Karty, panele, sekcje       | `bg-navy-800/50` | `bg-slate-50`                |
| **Layer 3** (floating) | Modale, dropdowny, tooltipy | `bg-navy-800`    | `bg-white` + `shadow-hig-xl` |

**MUST:**

- Nigdy `#000000` jako tło — zawsze ciepły dark gray (navy-950 = `#020617`)
- Nigdy `#ffffff` jako tekst w dark mode — najjaśniejszy tekst = `text-slate-100` (`#f1f5f9`)
- Sidebar jest **ciemniejszy** od content area (Layer 0 vs Layer 1)
- Sidebar NIE MA `border-right` — separacja odbywa się wyłącznie przez zmianę tła

### 3.2 Standardowe powierzchnie (MUST)

- **Sidebar / system chrome:**
  - light: `bg-slate-100`
  - dark: `bg-navy-950`
- **Panel (header/rail/top chrome):**
  - light: `bg-white`
  - dark: `bg-navy-900`
- **Karty / kontenery treści:**
  - light: `bg-white rounded-xl` (bez borderu lub z `border-slate-200/50`)
  - dark: `dark:bg-navy-900/50 rounded-xl` (bez borderu lub z `dark:border-white/5`)

**MUST:** max 1 poziom kontenera (zakaz "cards in cards" jako default).

**Wzorzec:** Gemini, ChatGPT, NotebookLM — trzy odcienie tła tworzą strukturę bez żadnego borderu.

---

## 4) Ramki, rounding, separatory (KANON)

### 4.1 Filozofia borderów — "Invisible borders" (MUST)

**Zasada:** bordery są **ostatecznością**, nie domyślnym narzędziem separacji. Przed dodaniem borderu — sprawdź czy separację da się osiągnąć przez:

1. **Zmianę tła** (background shift) — np. sidebar ciemniejszy od content
2. **Cień** (shadow separation) — np. modal "unosi się" dzięki shadow-xl
3. **Przestrzeń** (spacing separation) — np. grupy menu oddzielone 16px space
4. **Typografię** (typography separation) — np. uppercase 11px label oddziela grupę

**Kiedy border JEST dozwolony:**

- Input fields — jedyne miejsce z wyraźnym borderem (i to subtelnym)
- Divider między logicznymi grupami w menu/settings — `1px`, `opacity 5-10%`
- Table rows — ultra-subtelny `border-bottom`

### 4.2 Tokeny borderów (gdy konieczne)

- Light:
  - granice: `border-slate-200/50` (subtelniejsze niż wcześniej)
  - subtelne separatory: `border-slate-100/50`
  - divider w menu: `border-slate-200/30`
- Dark:
  - granice: `dark:border-white/5` (domyślnie najsubtelniejszy)
  - separatory: `dark:border-white/[0.03]`
  - divider w menu: `dark:border-white/5`

**MUST NOT:**

- Sidebar NIE MA `border-right`
- Karty w content area DOMYŚLNIE bez borderu (border opcjonalny, nie domyślny)
- Nigdy `border-white/10` lub grubsze na dark mode jako domyślny border karty

### 4.3 Rounding — kontekstowe zaokrąglenia (MUST)

Zaokrąglenia są **kontekstowe**, nie jednolite:

| Element                      | Radius         | Token |
| ---------------------------- | -------------- | ----- |
| Modale / floating panels     | `rounded-2xl`  | 16px  |
| Karty / panele w content     | `rounded-xl`   | 12px  |
| Sidebar nav items (hover bg) | `rounded-lg`   | 8px   |
| Kontrolki (button/input)     | `rounded-lg`   | 8px   |
| CTA primary button           | `rounded-xl`   | 12px  |
| Badges / chips / pills       | `rounded-full` | pill  |
| Input fields                 | `rounded-lg`   | 8px   |

**Wzorzec:** ChatGPT = najbardziej zaokrąglony (pill shapes), ClickUp/Notion = bardziej geometryczne. Consultify celuje w złoty środek.

---

## 5) Typografia (KANON)

### 5.1 Font (MUST)

- Bazowy font aplikacji: **Inter** (`font-sans`) – zgodnie z `tailwind.config.js`.
- **Jeden font w całej aplikacji** — bez mieszania fontów.

### 5.2 Skala i hierarchia (MUST) — "Typography as architecture"

Typografia **buduje strukturę** strony. Hierarchia powstaje przez size + weight, nie przez kolor ani bordery.

| Rola                    | Size                    | Weight                                     | Uwagi                                                                               |
| ----------------------- | ----------------------- | ------------------------------------------ | ----------------------------------------------------------------------------------- |
| Nagłówek strony / encji | `text-lg` / `text-xl`   | `font-semibold`                            | Nigdy bold, nigdy ALL CAPS                                                          |
| Nagłówek sekcji         | `text-sm` / `text-base` | `font-semibold`                            |                                                                                     |
| Treść UI (body)         | `text-sm` (13-14px)     | `font-normal` / `font-medium`              |                                                                                     |
| Metadane / etykiety     | `text-xs` (11-12px)     | `font-medium` + `tracking-wide`            | Oszczędnie, tylko labels                                                            |
| Sekcja group label      | `text-[11px]`           | `font-medium` + `uppercase` + `text-muted` | Jedyny dopuszczalny separator typograficzny (patrz: sidebar grupy w ClickUp/Notion) |
| Caption / timestamp     | `text-xs`               | `font-normal` + `text-muted`               |                                                                                     |

**MUST:**

- Nigdy `font-bold` na nagłówkach — używaj `font-semibold` (delikatniej, premium)
- Nigdy ALL CAPS na dużych nagłówkach — ALL CAPS tylko na tiny labels (11px)
- Line-height luźny (`leading-relaxed` / 1.5-1.6) — daje oddech
- Spłaszczona hierarchia rozmiarów (mała rozpiętość) = spokojny interfejs

**SHOULD:** skala Apple HIG (`text-hig-*`) jest dozwolona, ale tylko konsekwentnie w całym ekranie/komponencie.

---

## 6) Spacing i gęstość (KANON) — "Pack nav, breathe content"

**MUST:**

- Preferuj spójny rytm spacing (grupy 8/12/16/20/24/32px).
- **Dwie strefy gęstości:**
  - **Sidebar / nawigacja:** tight (padding 8-12px vertical, 12-16px horizontal, gap 2-4px między items)
  - **Content area:** spacious (padding 24-32px, gap 16-24px między sekcjami)
- **Grupy elementów** oddzielaj spacingiem (16-24px), nie liniami
- **Sekcja label** w sidebarze (np. "SPACES", "MY SETTINGS"): `uppercase`, `11px`, `text-muted`, `mb-2`, `mt-6`

**Wzorzec:** ChatGPT, Notion — sidebar tight z dużą ilością items, content area ogromny oddech.

**SHOULD:** jeśli komponent jest premium/kluczowy, używaj tokenów `hig-*` z `tailwind.config.js`.

---

## 7) Depth / shadows (KANON) — "Shadow only on floating"

**MUST:**

- Cień WYŁĄCZNIE na elementach **floating** (modale, dropdowny, tooltipy, popovers)
- **Nigdy** shadow na kartach w content area — karty rozróżniamy zmianą tła (Layer 2), nie cieniem
- Shadow na floating elements: duży blur, niska opacity — "miękka mgła", nie ostry cień
- Dozwolone tokeny: `shadow-hig-lg`, `shadow-hig-xl` (floating), `shadow-hig-sm` (sticky elevation)

**Wyjątek — "Sticky elevation" (SHOULD):**

- Gdy sticky header/command bar zaczyna nachodzić na treść, pojawia się subtelny cień (`shadow-hig-sm`)
- To jedyny przypadek shadow na nie-floating elemencie

**MUST NOT:**

- Nie używaj `shadow-sm` / `shadow-md` jako domyślnego stylu kart
- Nie mieszaj shadow + border na tym samym elemencie — wybierz jedno

---

## 8) Interakcje i dostępność (MUST)

### 8.1 Hover — subtelna zmiana tła (MUST)

**Zasada:** hover to **zmiana tła**, nigdy zmiana koloru tekstu, borderu ani outline.

- Dark mode hover: `bg-white/[0.03]` → `bg-white/[0.06]` (subtelna zmiana jasności)
- Light mode hover: `bg-slate-50` / `bg-slate-100/50`
- Transition: `150ms ease-out`
- Sidebar items: hover = subtelne `rounded-lg` bg, active = nieco intensywniejsze bg

**MUST NOT:**

- Nigdy zmiana koloru tekstu na hover (wyjątek: link)
- Nigdy outline/border na hover
- Nigdy nagła zmiana — zawsze transition

### 8.2 Inne interakcje

- Focus jest zawsze widoczny i spójny (ring/shadow w semantyce `primary/*`).
- Active/press: krótki "press" (`active:scale-[0.98]`) tylko na buttonach, nie na tabelach.
- Destrukcja zawsze `danger/*` + confirm.
- Empty/loading/error są "quiet" i spójne (bez udawania danych).

---

## 9) Motion (SHOULD)

- Animacje są krótkie (typowo 150–220ms) i wspierają orientację.
- Zakaz "ciężkich" animacji jako dekoracji w ekranach enterprise.

### 9.1 Motion tokens (KANON)

**MUST:**

- Czas trwania:
  - `fast`: 120–160ms (hover/active, focus transitions)
  - `base`: 160–220ms (otwieranie dropdown/tooltip/tab underline)
  - `slow`: 240–320ms (drawer/panel/rail, layout shift)
- Easing:
  - preferuj „soft" (ease-out / standard UI easing),
  - unikaj bounce/spring jako default (spring tylko dla "delight", bardzo subtelnie).

**SHOULD:**

- Dla Framer Motion:
  - używaj `layout`/`layoutId` do płynnych przejść (np. underline taba),
  - preferuj małe przesunięcia (2–6px) zamiast dużych animacji.

### 9.2 Reduce motion (A11y) (MUST)

**MUST:**

- Wspieramy `prefers-reduced-motion`:
  - wyłączamy animacje przesunięć i skale,
  - zostawiamy tylko natychmiastowe stany (opacity 0/1 bez tween) lub minimalne.

### 9.3 Mikrointerakcje "tech‑sexy" (KANON, ale minimalistyczne)

To są dozwolone „smaczki", które podnoszą premium feel bez krzykliwości.

**MUST (zalecane wszędzie):**

- Hover: delikatna zmiana tła (`bg-white/[0.03]` → `bg-white/[0.06]` w dark; `bg-slate-50` w light). **Bez border shift** — hover to TYLKO zmiana tła.
- Active/press: krótki "press" (np. `active:scale-[0.98]`) tylko na buttonach/tiles, nie na tabelach.
- Focus: ring/spójny z `primary/*` + brak "jumpingu" layoutu.
- Skeleton: płynny shimmer (Apple HIG) dla loading; bez migotania.

**SHOULD (dla kluczowych ekranów: C mode, N mode, ModuleHub):**

- "Sticky elevation": gdy sticky header/command bar zaczyna nachodzić na treść, pojawia się subtelny cień (`shadow-hig-sm`).
- "Selection clarity": zaznaczony element listy ma:
  - 1px border accent (`primary`) + bardzo subtelne tło (`primary/surface`),
  - animacja przejścia 160–220ms.
- "Tab underline glide": underline taba przesuwa się płynnie (layoutId), bez skakania.

**MUST NOT:**

- nie robimy neonów, intensywnych glow jako domyślnego UI,
- nie robimy "parade animations" (duże fly-in),
- nie animujemy wszystkiego naraz (tylko 1–2 elementy w danym komponencie).

---

## 10) Ikony (KANON) — "Outline, mono-weight, text-color"

### 10.1 Styl ikon (MUST)

- **Zawsze outline (stroke)** — nigdy filled jako default
- **Mono-weight** — identyczna grubość linii na wszystkich ikonach (1.5-2px stroke)
- **Kolor ikony = kolor tekstu obok** — ikony przejmują `text-muted` / `text-secondary`, nigdy nie mają własnego koloru
- **Rozmiary:**
  - Sidebar nav: 18-20px
  - Inline / akcje w content: 16px
  - Toolbary / small controls: 14-16px

### 10.2 Kolorowanie ikon (MUST)

| Kontekst                       | Kolor ikony                     | Dozwolone? |
| ------------------------------ | ------------------------------- | ---------- |
| Nawigacja sidebar              | `text-muted` (szary jak tekst)  | MUST       |
| Nawigacja aktywny item         | `text-primary` lub `text-white` | MUST       |
| Menu/dropdown                  | `text-muted` (jak tekst obok)   | MUST       |
| Kolorowe badge/awatar          | Własny kolor (dane użytkownika) | Dozwolone  |
| Ikona statusu (success/danger) | Kolor semantyczny               | Dozwolone  |

**MUST NOT:**

- Nigdy kolorowe ikony w nawigacji (wyjątek: aktywny item)
- Nigdy mieszanie filled + outline ikon na jednym ekranie
- Nigdy ikony dekoracyjne (ikona musi mieć funkcję)

### 10.3 Akcje on hover (SHOULD)

- Ikony akcji w tabelach/listach pojawiają się **on hover** (nie permanentnie widoczne)
- Wyjątek: krytyczne akcje (delete) mogą być permanentne z subtle opacity

**Wzorzec:** ClickUp table rows — ikony "Edit tags", delete pojawiają się on hover row.

---

## 11) Modale, dropdowny, menus (KANON) — "Floating card aesthetic"

### 11.1 Wspólny wzorzec (MUST)

Wszystkie floating elementy (modale, dropdowny, popovers, tooltips) stosują tę samą estetykę:

- Tło: Layer 3 (patrz: sekcja 3.1)
- `rounded-xl` / `rounded-2xl` (modale większe zaokrąglenie)
- `shadow-hig-xl` — duży blur, niska opacity ("miękka mgła")
- **Brak borderu zewnętrznego** (separacja wyłącznie przez shadow)
- Items wewnątrz: `ikona 16px + tekst 14px`, padding `8-12px`
- Grupy wewnątrz oddzielone dividerem `1px border-white/5` LUB spacingiem 12-16px

### 11.2 Menu items (MUST)

- Ikona + label, wyrównane do lewej
- Hover: `bg-white/[0.05]` + `rounded-md`
- Aktywny/wybrany: intensywniejsze tło + primary accent (opcjonalnie)
- Chevron `>` po prawej dla sub-menus
- Nigdy bold na menu items — regular weight

**Wzorzec:** ChatGPT Settings, ClickUp user menu, Notion sidebar — identyczny pattern.

---

## 12) Zastosowanie do 3 trybów detail view (MUST)

Ten standard obowiązuje **dla wszystkich 3 trybów prezentacji** detail view:

- `D` (D presentation mode: legacy / DBR77, 2/3 + 1/3)
- `N` (N presentation mode)
- `C` (C presentation mode)

Wszystkie trzy tryby muszą używać tych samych tokenów kolorów/tła/ramek/typografii – różni się wyłącznie układ treści.

---

## 13) Quick Reference — "Tech Sexy" checklist

Przed merge każdego UI PR, sprawdź:

- [ ] **Bordery:** Czy border jest konieczny? Czy można separować zmianą tła/spacingiem?
- [ ] **Tło:** Czy komponent respektuje system warstw (Layer 0-3)?
- [ ] **Kolor:** Czy na ekranie jest max 1 kolorowy element (CTA)? Reszta mono?
- [ ] **Ikony:** Outline, mono-weight, kolor = kolor tekstu?
- [ ] **Hover:** Subtelna zmiana tła, nie koloru tekstu/borderu?
- [ ] **Shadow:** Tylko na floating elements?
- [ ] **Spacing:** Sidebar tight, content spacious?
- [ ] **Typography:** Semibold (nie bold), spłaszczona hierarchia rozmiarów?
- [ ] **Pusta przestrzeń:** Czy jest celowy oddech, czy interfejs jest "upchany"?
- [ ] **Dark mode:** Nigdy pure black/white, zawsze warm grays?
