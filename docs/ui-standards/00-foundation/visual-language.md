# DBR77 Visual Language Standard (KANON)

> **Wersja:** 3.0 — "Crimson = marka, nie interakcja" Edition  
> **Data:** 2026-08-02  
> **Status:** OBOWIĄZUJĄCY  
> **Cel:** Jedna, spójna "warstwa wizualna" dla całej aplikacji (kolory, tła, ramki, typografia, spacing, depth, motion) – niezależnie od modułu i niezależnie od trybu prezentacji detail view.  
> **Lokalizacja:** `docs/ui-standards/00-foundation/visual-language.md`
>
> **Changelog v3.0 (naprawa po zmianie palety):** Po re-poincie `primary/*` na Harvard Crimson (`#85182F`) ten dokument w kilku miejscach nadal kazał używać `primary/*` jako koloru CTA/aktywnego stanu/focusa/selekcji — co dziś oznacza crimson tam, gdzie crimson jest zakazany (§2.1, §8.2, §8.3, §9.3, §10.2, §11.2). Naprawione: `primary/*` = wyłącznie akcent marki (Talk-to-Teresa) + destrukcja; CTA modułu = navy; **focus ma własny token `--c-focus`/`--c-focus-solid` (niebieski)**, nigdy crimson; stan aktywny/zaznaczony = neutralny (`bg-state-selected` / `selectionTokens.ts`), nigdy crimson. Motion §9.1 ujednolicone do ≤220ms (`slow` był 240–320ms — przekraczał twardy limit `FOUNDATION_TOKEN_CONTRACT.md` §9). Dopisano `FOUNDATION_TOKEN_CONTRACT.md` i `src/index.css` `--c-*` do §1 jako źródła prawdy. Skorygowano hex `navy-950` w §3.1 (był nieaktualny).
>
> **Changelog v2.1:** Konsolidacja kierunku "DBR77 Tech Sexy 2027" z Golden Standard: calm AI SaaS, mocniejsza dyscyplina Menu 2/3, pill controls, no-gradient operational chrome, segmented view controls, compact density for heavy work screens.
>
> **Changelog v3.1 (2026-08-02, panel adwersaryjny — K-18, K-P1-06):** Panel adwersaryjny wykrył sprzeczność między tym dokumentem a `light-mode-readability.md` co do tła sidebaru — oba podawały zły hex. Zweryfikowano realny kod (`src/components/navigation/Sidebar/Sidebar.tsx:489`): `bg-slate-50 dark:bg-navy-950`, zero `border-r`, separacja przez `boxShadow: '0 10px 40px rgba(0,0,0,0.08)'`. Naprawiono §3.1 (tabela warstw, Layer 0 light) i §3.2 (Sidebar/system chrome, light) z `bg-slate-100` na `bg-slate-50` — reguła „brak border-right" (§3.1, §4.2) była już zgodna z kodem i zostaje bez zmian. Dopisano do §2.2 ostrzeżenie o `tailwind.config.js` CENTRAL REMAP (K-P1-06) — rodziny `amber`/`blue` użyte niżej nie renderują domyślnych kolorów Tailwinda w tym repo.

---

## 0) Zasady nadrzędne (MUST)

- **Jedna aplikacja, jeden język wizualny.** Moduły i tryby widoku nie wprowadzają własnej palety, ramek, typografii ani "stylu kart".
- **Minimalizm DBR77.** UI ma być "enterprise clean": mniej ramek, więcej rytmu spacing + hierarchii typograficznej + subtelnych separatorów.
- **Semantyka kolorów jest święta.** Kolory oznaczają znaczenie (CTA / info / warning / danger / success), nie "ład".
- **Dark mode jest pierwszoplanowy.** Każdy komponent musi wyglądać równie dobrze w `dark`.
- **Powściągliwość (restraint).** Na ekranie jest **jeden** kolorowy element (CTA). Reszta jest monochromatyczna. Elegancja przez brak.
- **Przestrzeń to element designu.** Pusta przestrzeń to nie "brak contentu" — to celowa cisza, która podnosi premium feel.
- **Separacja przez tło i przestrzeń, nie linie.** Bordery są ostatecznością. Preferuj zmianę tła, cień lub whitespace.

### 0.1) "DBR77 Tech Sexy 2027" — definicja premium feel (KANON)

Współczesne produkty top-tier (OpenAI/ChatGPT, Claude, Notion, ClickUp, Linear, Google Material, Apple HIG) stosują te same wzorce. Consultify MUSI je adoptować:

1. **Monochromatyczna hierarchia** — prawie zero koloru w chrome, hierarchia przez jasność/ciemność odcieni szarości
2. **Invisible borders** — elementy separowane zmianą tła, cieniem lub spacingiem, nie `border`
3. **Confidence in emptiness** — duży oddech w content area; sidebar tight, content spacious
4. **Micro-consistency** — identyczne radiusy, stroke-width ikon, spacing tokeny, easing curves wszędzie
5. **Depth without decoration** — głębia z warstw tła + shadow, zero gradientów/tekstur/dekoracji
6. **Motion that breathes** — 120-220ms ease-out, zero bounce/spring jako default
7. **Operational calm** — ciężkie ekrany robocze mają więcej logiki, ale mniej chrome; akcje AI i workflow żyją w ustalonych slotach, nie w nowych paskach
8. **Visible controls, not hidden surprises** — przełączniki widoków są segmented/icon controls, a dropdown służy filtrom lub overflow, nie ukrywaniu podstawowego trybu pracy

---

## 1) Źródła prawdy (MUST)

To są jedyne kanoniczne źródła tokenów i reguł:

- **DBR77 colors & Apple HIG tokens:** `tailwind.config.js`
- **Globalne style, wzorce kontenerów i tokeny semantyczne `--c-*`:** `src/index.css` — SSOT dla `--c-bg`/`--c-surface`/`--c-accent`/`--c-focus`/`--c-info`/`--state-selected`/`--motion-*` i ich wartości light/dark.
- **Semantyka DBR77 color usage:** `docs/ui-standards/00-foundation/color-system.md`
- **Twarde wartości liczbowe (kontrakt tokenów, rozstrzyga spory o hexy/ms):** `docs/ui-standards/00-foundation/FOUNDATION_TOKEN_CONTRACT.md`
- **Uwaga (legacy):** `packages/shared/src/ui/theme.ts` nie jest źródłem prawdy dla DBR77 (nie jest używany przez core UI) i nie może nadpisywać tokenów z Tailwinda.

> Jeśli standard mówi X, a komponent robi Y — komponent jest do poprawy (albo aktualizujemy standardy centralnie).

---

## 2) Kolory (KANON)

### 2.1 DBR77: 4 kolory semantyczne + neutral (MUST)

- **PRIMARY (`primary/*` = Harvard Crimson `#85182F`, tożsamy z `--c-accent`)**: **WYŁĄCZNIE** znak marki (Talk-to-Teresa) i semantyka destrukcyjna (razem z `danger/*`). **NIGDY** jako CTA zwykłego modułu, aktywny stan, focus ani selekcja — to jest reguła nadrzędna po re-poincie palety (§0, `TRIADA_KANON.md` pkt 38/39/43).
  - **CTA modułu** = navy (`secondary/*` / `bg-navy-*`), nie `primary/*` (patrz `light-mode-readability.md` §18.3, VIS-006).
  - **Focus** ma własny, niezależny token: `--c-focus` / `--c-focus-solid` (niebieski `#2563eb` light / `#5b8def` dark), klasa `focus-visible:ring-c-focus`. Nigdy `primary/*`/crimson.
  - **Stan aktywny / zaznaczony (selection)** jest **neutralny**: token `--state-selected` (`bg-state-selected`) lub wzorzec `src/components/shared/selectionTokens.ts` (neutralne tło + akcent `--c-info`, niebieski). Nigdy `primary/*`/crimson.
- **SECONDARY (`secondary/*`) / NEUTRAL NAVY (`navy/*`)**: nawigacja, UI chrome, neutralne tła i tekst, oraz **CTA modułu**.
- **DANGER (`danger/*`)**: błędy, destrukcja, alarm.
- **SUCCESS (`success/*`)**: potwierdzenie, "healthy/up".
- **NEUTRAL (`navy/*`, `slate/*`)**: tła, bordery, tekst, separatory.

### 2.2 Kolory sygnałowe (MUST/SHOULD)

DBR77 dopuszcza dwa kolory sygnałowe (nie‑brandowe), **wyłącznie** dla sygnalizacji:

- **WARNING / AT RISK:** `amber/*`
- **INFO:** `blue/*`

**MUST:** ich użycie ograniczamy do `badge/dot/callout` (i ewentualnie tła typu surface).  
**MUST NOT:** nie używamy ich dla CTA ani jako stałego koloru nawigacji/ramek paneli.

> **Uwaga CENTRAL REMAP (K-P1-06):** `tailwind.config.js` (blok „CENTRAL REMAP", ok. l. 418–660) przepina domyślne rodziny Tailwinda — `blue`, `red`/`rose`, `emerald`/`green`, `amber`/`orange`, `violet`/`purple`/`indigo`, `yellow`, `pink`, `teal`/`cyan` — na paletę HBS (np. `amber-500 = #E87D1E`, `blue-700 = #3B2883`). Klasy typu `bg-amber-500`/`text-blue-800` w tym projekcie więc **nie** renderują standardowych kolorów Tailwinda. Kanoniczny opis remapu: `FOUNDATION_TOKEN_CONTRACT.md` §7.

---

## 3) Tła i surfaces (KANON)

### 3.1 System wielowarstwowych teł (MUST) — "Depth through background"

Interfejs MUSI mieć **minimum 3 warstwy głębi** poprzez odcienie tła. Różnica między warstwami jest **subtelna (2-5% jasności)** — mózg rejestruje ją podświadomie jako przestrzeń 3D bez skeuomorfizmu.

| Warstwa                | Rola                        | Dark mode        | Light mode                   |
| ---------------------- | --------------------------- | ---------------- | ---------------------------- |
| **Layer 0** (deepest)  | Sidebar, system chrome      | `bg-navy-950`    | `bg-slate-50` (zweryfikowane `Sidebar.tsx:489`; separacja od Layer 1 przez `boxShadow`, nie przez różnicę tła — hexy Layer 0/1 są dziś prawie identyczne, `#f8fafc` vs `--c-bg` `#fafaf9`) |
| **Layer 1** (base)     | Główna content area         | `bg-navy-900`    | `bg-slate-50`                |
| **Layer 2** (elevated) | Karty, panele, sekcje       | `bg-navy-800/50` | `bg-white`                   |
| **Layer 3** (floating) | Modale, dropdowny, tooltipy | `bg-navy-800`    | `bg-white` + `shadow-hig-xl` |

**MUST:**

- Nigdy `#000000` jako tło — zawsze ciepły dark gray (navy-950 = `#0A0F1E`, zweryfikowane w `tailwind.config.js`; ten sam odcień jak `--c-bg` dark w `src/index.css`. Uwaga: `navy-*` to skala Tailwinda dla chrome/warstw — dla **powierzchni aplikacji** (bg/surface/surface-raised) rozstrzygające są tokeny `--c-bg`/`--c-surface`/`--c-surface-raised` w `src/index.css`, nie odczyt hexów wprost z `navy-*`)
- Nigdy `#ffffff` jako tekst w dark mode — najjaśniejszy tekst = `text-slate-100` (`#f1f5f9`)
- Sidebar jest **ciemniejszy** od content area (Layer 0 vs Layer 1)
- Sidebar NIE MA `border-right` — separacja odbywa się wyłącznie przez zmianę tła

### 3.3 Light mode readability (v3 refinement)

W light mode “za białe” surfaces powodują spadek czytelności (mało separacji i “szary tekst na białym”).

**KANON v3:**

- Base content area (Layer 1) = `bg-slate-50` (nie `bg-white`)
- Elevated surfaces (Layer 2) = `bg-white` (karty/panele), separacja bez ciężkich ramek
- Primary text w light mode preferuje `text-slate-900` / `text-navy-900` (czytelność)
- Badge/chips: zakaz zestawienia “jasne tło + jasny tekst tego samego koloru” (przenieś sygnał na dot/ikonę/border albo przyciemnij tekst)

### 3.2 Standardowe powierzchnie (MUST)

- **Sidebar / system chrome:**
  - light: `bg-slate-50` (zweryfikowane `src/components/navigation/Sidebar/Sidebar.tsx:489`, bez `border-right`)
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

#### v3: “bardziej okrągłe” + system globalnej zmiany (MUST)

Żeby móc eksperymentować i zmieniać rounding **systemowo** (bez ręcznego szukania `rounded-*` po kodzie),
w v3 preferujemy użycie tokenów HIG:

- `rounded-hig-xs|sm|md|lg|xl|2xl|3xl|full` (SSOT: `tailwind.config.js` → `theme.extend.borderRadius`)

**Reguła migracji:**

- Nowy kod powinien używać `rounded-hig-*` zamiast gołych `rounded-lg/xl/2xl`.
- Zmiana “bardziej okrągłe / mniej okrągłe” odbywa się przez korektę tokenów w `tailwind.config.js`,
  a nie przez ad-hoc styling w komponentach.

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

### 6.1 Gęstość danych (dashboards / analytics) — "Structure beats emptiness" (KANON v3)

Duże “oddechy” działają tylko wtedy, gdy:
1) typografia jest czytelna, a
2) granice grup są jednoznaczne (warstwy tła / sekcje).

W ekranach typu Executive / analytics łatwo wpaść w anty‑pattern: **dużo pustej przestrzeni + mały tekst + słabe separatory** ⇒ spadek czytelności.

**MUST (dashboard readability):**

- **Nie łącz `text-xs` z dużym paddingiem w tile’ach.** Jeśli tile ma “oddech”, tekst musi być większy (min `text-sm` 13–14px dla etykiet/treści UI).
- **Liczby/KPI muszą mieć jasną hierarchię:** wartości (np. 7 / 83% / 10) powinny być w skali “headline” (typowo `text-xl`–`text-2xl`), nie “body”.
- **Padding wewnątrz tile’ów** dla dashboardów jest gęstszy niż w content: typowo **12–16px**, nie 24–32px.
- **Separacja sekcji** przez warstwy tła (Layer 1 → Layer 2) i rytm spacing, a nie przez “niewidoczne” linie.
- **Sekcje dashboardu muszą mieć nagłówki** (np. `text-sm` + `font-semibold`) — to jest “mapa” dla oka, ważniejsze niż dodatkowe bordery.

**SHOULD (komfort skanowania):**

- **MUST:** Wprowadź **Density** (Compact / Comfortable) dla dashboardów w menu “View” (bez dodatkowych toolbarów na ekranie).
- Utrzymuj stały grid: równe gutters (12–16px) i wyrównania pionowe/poziome.

### 6.2 Table Chip Readability — ClickUp-style Calm Metadata

Tabele operacyjne są gęste, więc chipy muszą być czytelne z daleka i spokojne wizualnie.

Wzorzec: ClickUp / Linear / Notion — mały pill, jasny kontrast tekstu, kolor jako sygnał w ikonie/dot lub bardzo subtelnym tle. Metadata nie wygląda jak CTA.

MUST:

- `StatusChip`: status/etap może mieć kolor, ale tło jest subtelne, tekst kontrastowy, a ikona/dot wzmacnia znaczenie.
- `MetaChip`: tagi, typy, źródła i owner shorthand są neutralne.
- `ToolChip`: narzędzie/artefakt jest prawie neutralne; ikona może mieć delikatny kolor, ale cały pill nie jest brandowym CTA.
- `PriorityChip`: jeden wzorzec w rodzinie tabel, np. dot/ikona + label.
- `SlaChip` / `DueChip`: kolor tylko dla ryzyka i przekroczeń; normalne terminy są neutralne.
- Chipy muszą wyglądać dobrze w dark i light mode, bez pastelowego tekstu na pastelowym tle.

MUST NOT:

- nie używaj fioletowego/primary tła jako stałego koloru metadata,
- nie twórz lokalnych wariantów chipów w każdej tabeli, jeśli istnieje kanon,
- nie mieszaj w jednym module dot-only, pill-only i icon+label dla tego samego typu danych.

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
- Nie mieszaj mocnego dekoracyjnego borderu z cieniem. Overlay może łączyć `border-subtle` z kanonicznym elevation; content card domyślnie pozostaje bez cienia.

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

---

## 8.3 Przyciski (KANON) — 3 poziomy ważności (2025/2026)

Cel: jeden spójny system przycisków, który skaluje się od “top chrome” do gęstych toolbarów bez chaosu.

**MUST:** w obrębie jednego topbara/toolbara nie mieszamy więcej niż **2 poziomów** naraz (inaczej robi się “zupa guzików”).

### Poziom A — **Pill / Outline + Surface** (ważne, ale nie krzykliwe)

- **Kiedy:** główne przełączniki surface’ów (tabs w module), istotne “chipsy” kontekstowe (liczniki), selektory w topbarze.
- **Jak wygląda:** cienka ramka + subtelne tło (Layer‑2/neutral surface), **rounded‑full**.
- **Interakcja:** hover = tylko tło (bez border shift).

### Poziom B — **Pill / Soft (bez ramki)** (drugorzędne akcje)

- **Kiedy:** akcje pomocnicze, które muszą być widoczne, ale nie mają dominować (np. przełączniki widoku, quick tools).
- **Jak wygląda:** brak ramki, tylko subtelne tło; rounded‑full.
- **Interakcja:** hover = tylko tło.

### Poziom C — **Ghost / Text** (najlżejsze)

- **Kiedy:** linkopodobne akcje, menu, “więcej…”, akcje per‑wiersz.
- **Jak wygląda:** brak ramki i brak tła w stanie spoczynku.
- **Interakcja:** hover może dodać subtelne tło (ale nadal bez border shift).

### Reguły nadrzędne (MUST)

- **Na ekranie max 1 kolorowy element** (Primary CTA). Reszta monochromatyczna. **Uwaga:** tym kolorowym elementem dla zwykłego CTA modułu jest **navy** (`secondary/*`), NIE crimson (`primary/*`) — crimson jest zarezerwowany dla marki/Talk-to-Teresa i destrukcji (§2.1).
- **Rounding:** preferuj tokeny `rounded-hig-*`, a dla pill `rounded-hig-full`.
- **Wysokość kontrolek w topbarze:** trzymaj `h-9` (spójność rytmu).

### 8.2 Inne interakcje

- Focus jest zawsze widoczny i spójny (ring/shadow w tokenie `--c-focus` / `--c-focus-solid`, klasa `focus-visible:ring-c-focus` — niebieski, NIGDY `primary/*`/crimson; patrz §2.1).
- Active/press: krótki "press" (`active:scale-[0.98]`) tylko na buttonach, nie na tabelach.
- Destrukcja zawsze `danger/*` + confirm.
- Empty/loading/error są "quiet" i spójne (bez udawania danych).

---

## 9) Motion (SHOULD)

- Animacje są krótkie (typowo 150–220ms) i wspierają orientację.
- Zakaz "ciężkich" animacji jako dekoracji w ekranach enterprise.

> **Egzekwowanie (MUST):** `npm run lint:motion` raportuje dług; `npm run lint:motion:ci` to bramka ratchet względem `.motion-baseline.json` — liczby naruszeń mogą **tylko maleć**. Trzy twarde naruszenia: `transition-all` (nie scoped → jank na layout-triggerach), `duration-500/700/1000` (>320ms), `animate-bounce/ping`. Po każdej naprawie aktualizuj baseline W DÓŁ. Metoda bezpiecznej naprawy: jeśli element ma `hover:scale`/`translate` lub animuje layout (max-height itp.) → użyj `transition-transform`/`transition-[…]`, NIE `transition-colors`; pure kolor/border/tło → `transition-colors`. Wzorzec referencyjny: `src/views/AuthView.tsx` (czysty, 0 naruszeń).

### 9.1 Motion tokens (KANON)

**MUST:**

- Czas trwania (tokeny `--motion-*` w `src/index.css`; twardy limit `FOUNDATION_TOKEN_CONTRACT.md` §9 — `slow` max 220ms, nigdy 240–320ms jak w starszej wersji tego dokumentu):
  - `fast` (`--motion-fast: 120ms`): hover/active, focus transitions
  - `base` (`--motion-base: 180ms`): otwieranie dropdown/tooltip/tab underline
  - `slow` (`--motion-slow: 220ms`, max): drawer/panel/rail, layout shift
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
- Focus: ring/spójny z tokenem `--c-focus` (niebieski, `focus-visible:ring-c-focus`) + brak "jumpingu" layoutu. NIGDY `primary/*`/crimson (§2.1).
- Skeleton: płynny shimmer (Apple HIG) dla loading; bez migotania.

**SHOULD (dla kluczowych ekranów: C mode, N mode, ModuleHub):**

- "Sticky elevation": gdy sticky header/command bar zaczyna nachodzić na treść, pojawia się subtelny cień (`shadow-hig-sm`).
- "Selection clarity": zaznaczony element listy ma:
  - neutralne tło (`bg-state-selected` / `bg-slate-100` dark:`bg-white/[0.08]`) + ring (`ring-slate-300/60`) + 4px akcent-pasek w kolorze info (`shadow-[inset_4px_0_0_var(--c-info)]`) — wzorzec i SSOT klas: `src/components/shared/selectionTokens.ts`. **NIGDY** `primary`/crimson jako border ani tło selekcji (to jest wprost zakazane — crimson czyta się jako alarm, nie jako "aktywny"; patrz `light-mode-readability.md` §16 „surface-selected"),
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
| Nawigacja aktywny item         | neutralny: `text-white`/`text-slate-900` (wyższy kontrast) na neutralnym tle aktywnego stanu — **NIGDY** `text-primary`/crimson (§2.1) | MUST       |
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
- Aktywny/wybrany: intensywniejsze neutralne tło (`bg-state-selected` / `bg-white/[0.08]`) — **NIE** primary/crimson accent (§2.1)
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
- [ ] **Focus:** Czy fokus używa `--c-focus` (niebieski, `ring-c-focus`), nie `primary`/crimson?
- [ ] **Selekcja:** Czy stan aktywny/zaznaczenie jest neutralny (`bg-state-selected` / `selectionTokens.ts`), nie crimson?
