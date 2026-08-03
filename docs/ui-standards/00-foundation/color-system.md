# DBR77 Color System Standard

> **Wersja**: 3.2 — "Crimson Canon" Edition (usunięty fantom `--color-*` w §1)  
> **Data**: 2026-08-02  
> **Autor**: Consultify Design System  
> **Lokalizacja:** `docs/ui-standards/00-foundation/color-system.md`
>
> **Changelog v3.2 (2026-08-02, trzecia rewizja — fantomowe `--color-*` z §1):** Poprzednia
> rewizja (v3.1, K-14) naprawiła fabrykowaną tabelę `--neutral-*` i przy okazji zgłosiła, bez
> ruszania, że cztery główne bloki §1 (`--color-primary/-secondary/-danger/-success` + warianty
> `-hover/-light/-surface`) to CSS custom properties tej samej fantomowej klasy — zero deklaracji
> w `src/`. Niezależna weryfikacja to potwierdza: `grep -rn -- "--color-primary:\|--color-secondary:\|
> --color-danger:\|--color-success:" src/` → **zero wyników**. Jedyne wystąpienia stringów
> `--color-*` w `src/` to fallbacki pod **innymi** nazwami (z numerem odcienia, nie te z dokumentu):
> `--color-primary-600` (`WizardModal.tsx`, `ReportGeneratorWizard.tsx`), `--color-primary-500`
> (`AuditOrchestratorWizard.tsx`), `--color-danger-500` (`mindmap-effects.css`) — też nigdzie nie
> zadeklarowane, więc te fallbacki renderują zawsze wartość domyślną z `var(..., domyślna)`, nigdy
> zmienną.
>
> Sekcja przepisana na dwie realne warstwy: (1) tokeny semantyczne `--c-accent`/`--c-danger`/
> `--c-success` (`src/index.css`, dark-adaptive, SSOT, zalecana droga dla nowego kodu) i (2)
> osobno istniejąca, starsza rodzina klas Tailwind `primary`/`secondary`/`danger`/`success`
> (`tailwind.config.js`, statyczne hexy, BEZ adaptacji dark mode) — ta ostatnia ma numerycznie **te
> same** wartości, które ten dokument wcześniej błędnie podpisywał jako CSS custom properties
> (poza blokiem `success`, gdzie stare liczby okazały się mieszanką SSOT `--c-success` i podskali
> Tailwind `success.700/800/DEFAULT` — dowód, że oryginał był rekonstrukcją z pamięci, nie
> odczytem jednego pliku). Realne użycie tej rodziny w `src/` jest znikome i policzone per klasa
> (patrz sekcje niżej); warianty `-hover/-light/-surface` mają zero wystąpień poza samym configiem.
>
> **Changelog v3.1 (2026-08-02, panel adwersaryjny — naprawa naprawy):** Przepisanie v3.0
> (poniżej) samo wprowadziło nowe fałsze, złapane przez recenzenta. Naprawione tym patchem —
> pełne `było → jest` w raporcie sesji, skrót:
> - **K-14 (P0):** §1 NEUTRAL miał fabrykowaną tabelę `--neutral-950…--neutral-0` (custom property,
>   której `grep -rn "\-\-neutral-[0-9]" src/` **nie znajduje** — zero wystąpień), z wartościami
>   przesuniętymi o jeden stopień względem realnej skali. Zastąpiona realną skalą `navy-*` z
>   `tailwind.config.js` + tokenami `--c-bg`/`--c-surface`/`--c-surface-raised` z `src/index.css`.
> - **K-15 (P0):** Twierdzenie „fiolet `#7C3AED` nie istnieje w produkcie" było fałszywe —
>   `grep -rin "7C3AED" src/` daje **8 wystąpień** w 5 plikach. Poprawione na: usunięty jako token
>   CTA/primary, ale pozostaje jako otwarty dług w konkretnych miejscach (wymienione niżej).
> - **K-17 (P0):** Hex najgłębszej warstwy tła w §1/§2.5 (`#020617`) był niezgodny z
>   `visual-language.md` §3.1 i z realnym `tailwind.config.js` (`navy-950 = #0A0F1E`). Poprawiony
>   na `#0A0F1E` wszędzie w tym pliku.
> - **K-19 (P0):** §2.6b „Row hover" (`hover:bg-slate-100/80`) był sprzeczny z
>   `light-mode-readability.md` §6 (`bg-slate-50`). Realny kod (`FilterableTable.tsx`, którego
>   `StandardTable` używa pod spodem) ma **trzecią wartość**: `hover:bg-state-hover`
>   (`--state-hover: color-mix(in srgb, var(--c-text) 6%, transparent)`) — ani jeden, ani drugi
>   dokument nie miał racji; oba mają teraz udokumentowany dług.
> - **K-20 (P0):** §2.2 przypisywał wskaźnik aktywnego taba do `--c-focus-solid`, podczas gdy
>   §2.6c/§10/§9 (i realny kod `InitiativeDetailModal.tsx:595`, `text-c-info border-c-info`)
>   zgodnie mówią `--c-info`. §2.2 poprawiony na `--c-info`, trzy role rozdzielone: stan
>   aktywny/zaznaczony = neutralny `--state-selected`; wskaźnik informacyjny/pasek akcentu =
>   `--c-info`; fokus klawiaturowy = `--c-focus`/`--c-focus-solid`.
> - **K-P1-06/K-P1-08:** §2.6b „Violet status" fałszywie twierdził, że stoi na „standardowej
>   palecie Tailwind" — realnie `tailwind.config.js` ma blok CENTRAL REMAP, który przepina
>   `violet`/`indigo`/`purple` na HBS Purple (`violet-500 = #80408D`), więc nadal jest fioletem na
>   ekranie. Dodatkowo kolidował z zamkniętym modelem 5 kubełków w §2.6c i nie ma pokrycia w
>   realnym użyciu jako App Table status chip (`grep` nie znajduje `border-violet-300/80
>   bg-violet-50 text-violet-900` nigdzie w `src/`). Wiersz usunięty z §2.6b, model 5 kubełków
>   §2.6c pozostaje jedynym kanonem statusów.
> - **K-P3-11:** §9 miał nieistniejący `var(--token-focus)` (zero wystąpień w `src/`) — zamieniony
>   na realny `var(--c-focus)`.
> - Dodatkowo (znalezione samodzielnie przy przeglądzie całego pliku): §5/§6 używały nieistniejących
>   `var(--neutral-300)`/`var(--text-primary)`/`var(--text-secondary)`/`var(--text-muted)`/
>   `var(--text-disabled)` (zero deklaracji w `src/`, tylko fallbacki w dwóch niepowiązanych plikach
>   `superadmin/*.css`) — zamienione na realne `--c-border`/`--c-text`/`--c-text-secondary`/
>   `--c-text-muted`. §2.5 miało też `#0B1121` dla navy-900 zamiast realnego `#0F172A`.
>
> **Changelog v3.0 (przepisanie chirurgiczne — martwa teza usunięta):** Fiolet `#7C3AED` (dawny
> "Primary") był tokenem CTA/primary, który **przestał nim być w produkcie** — `tailwind.config.js`
> re-punktuje `primary` na Harvard Crimson jawnym komentarzem "CENTRAL RECOLOR LEVER... Was violet
> (#7C3AED)". Konsekwencje dla tego dokumentu: `primary`/crimson jest odtąd wyłącznie **znakiem
> marki** (Talk-to-Teresa, świadome momenty brandowe) i **semantyką destrukcyjną** — NIE jest już
> "głównym CTA", "aktywnym tabem" ani "focus state". Zwykłe CTA modułu (Submit/Save/Create) =
> neutralny/navy (§3). Fokus = dedykowany token `--c-focus` / `--c-focus-solid` (niebieski), nigdy
> crimson. Zaznaczenie wiersza/karty = neutralne (`--state-selected` / `bg-slate-100` + `--c-info`
> accent bar), nie fiolet ani crimson. §2.6b (Row State Grid) przepisana z `rgba(124,58,237,…)` na
> neutral + `--c-info`, zgodnie z realnym kodem (`src/components/shared/selectionTokens.ts`). §9
> (Migration Guide) przepisana całkowicie — stara wersja kazała migrować `blue-*`/`amber-*`/
> `indigo-*` → `primary-*`, co dziś oznaczałoby zamalowanie aplikacji crimsonem; to była aktywnie
> szkodliwa instrukcja. §7 (Zakaz użycia) odkłamana — amber/warning jest dozwolonym kolorem
> sygnałowym (§1, §2.6c), więc już nie jest "zabroniony". Wszystkie hexy zsynchronizowane z SSOT
> (`src/index.css` `--c-*`, `tailwind.config.js`). Naprawiono podwójną numerację sekcji "10" (Quick
> Reference i Paleta DANYCH → §10 i §11).
>
> **Changelog v2.0:** Doprecyzowanie neutralnych kolorów (nigdy pure black/white), dodanie zasady monochromatycznego UI chrome, refinement tekstu w dark mode.

## Zasada nadrzędna

> **Minimalizm kolorystyczny**: Używamy tylko 4 kolorów semantycznych + neutralne szarości + crimson
> jako wyłączny akcent marki. Każdy kolor ma JEDNĄ jasno określoną funkcję. Nie ma wyjątków.
>
> **Zasada monochromatycznego chrome:** Cały UI chrome (sidebar, nawigacja, toolbary, headery) jest
> **monochromatyczny** (skala szarości/navy). Crimson (`--c-accent`) pojawia się **rzadko i świadomie**
> — jako znak marki (Talk-to-Teresa, kluczowy brandowy moment) lub akcja destrukcyjna — NIGDY jako
> domyślny kolor zwykłego CTA modułu (Submit/Save/Create — patrz §3). Kolory semantyczne
> (success/danger/warning/info) pojawiają się TYLKO przy danych/statusach, nigdy jako dekoracja chrome.

---

## 1. Paleta kolorów DBR77

### 🟥 PRIMARY / BRAND (Harvard Crimson) — znak marki, NIE ogólne CTA

Fiolet `#7C3AED` (dawny "Primary") **przestał być tokenem CTA/primary w produkcie**.
`tailwind.config.js` re-punktuje `primary` na Harvard Crimson wprost w komentarzu: "PRIMARY —
Harvard Crimson (CENTRAL RECOLOR LEVER). Was violet (#7C3AED)."

> **Uwaga (K-15, panel adwersaryjny 2026-08-02):** to NIE znaczy, że hex `#7C3AED` zniknął z
> repo. `grep -rin "7C3AED" src/` daje **8 wystąpień** — otwarty dług, nie martwy kod:
> `src/components/settings/APIAccessSettings.tsx:671` (fallback `var(--color-brand, #7C3AED)`),
> `src/components/MyWork/Calendar/calendar-theme.css:179,187,196,201` (4×, style zaznaczenia
> kalendarza), `src/components/AIChat/ChatHistorySidebar.tsx:107` (paleta kolorów wątków),
> `src/components/AIChat/ChatToggleButton.tsx:12` (gradient przycisku czatu),
> `src/components/Economics/charts/GoldenThreadSankey.tsx:39` (kolor węzła KPI na Sankeyu).
> Żadne z tych miejsc nie jest tokenem `primary`/CTA — to lokalne, niezmigrowane hexy. Traktuj je
> jako listę do posprzątania, nie jako potwierdzenie że fiolet wrócił jako marka.

**Realny token (SSOT, dark-adaptive):** `--c-accent` w `src/index.css`.

```css
/* src/index.css — :root (light) */
--c-accent: #85182f; /* Harvard Crimson — SOLE brand accent */
--c-accent-soft: rgba(133, 24, 47, 0.08); /* tło/tint zaznaczenia */

/* src/index.css — .dark */
--c-accent: #c8324a; /* podniesiony dla kontrastu na navy */
--c-accent-soft: rgba(200, 50, 74, 0.14);
```

Klasy Tailwind (namespace `c.*`, `tailwind.config.js` ok. linii 77–129): `bg-c-accent` /
`text-c-accent` / `border-c-accent` / `bg-c-accent-soft`. To jest droga dla nowego kodu — realnie
używana w **252 plikach** (`text-c-accent`) / **45 plikach** (`bg-c-accent`).

> **Poprawka (fantom, trzecia rewizja 2026-08-02):** ta sekcja wcześniej podawała blok
> `--color-primary` / `-hover` / `-light` / `-surface` jako CSS custom properties.
> `grep -rn -- "--color-primary:" src/` → **zero deklaracji**, token nigdy nie istniał jako CSS
> variable. Te same liczby (`#85182F` / `#6D1427` / `#A82D49` / `rgba(133,24,47,0.1)`) istnieją
> naprawdę, ale gdzie indziej: jako statyczny obiekt kolorów Tailwind `primary` w
> `tailwind.config.js` (ok. linii 204–220, komentarz "PRIMARY — Harvard Crimson (CENTRAL RECOLOR
> LEVER)"). To generuje realne klasy `bg-primary` / `text-primary` / `border-primary` /
> `bg-primary-hover` / `bg-primary-light` / `bg-primary-surface`, ale:
> - to statyczne hexy, BEZ automatycznej adaptacji dark mode (w przeciwieństwie do `--c-accent`,
>   które zmienia wartość w bloku `.dark`),
> - `bg-primary` / `text-primary` (DEFAULT) mają realne, ale nieliczne użycie — głównie prymitywy
>   shadcn (`src/components/ui/slider.tsx`, `src/components/ui/progress.tsx`) i spinner w
>   `src/App.tsx`: **7 plików** (`bg-primary`) / **9 plików** (`text-primary`); `border-primary` —
>   **1 plik** (`ui/slider.tsx`),
> - warianty `bg-primary-hover` / `bg-primary-light` / `bg-primary-surface` istnieją w configu, ale
>   mają **zero wystąpień** w `src/` poza samym plikiem konfiguracyjnym — zdefiniowane, ale martwe.
>
> Dla nowego kodu: `--c-accent` / `bg-c-accent` / `text-c-accent`, NIE rodzina `primary-*` — ta
> ostatnia jest legacy/dług, nie SSOT.

**Zastosowanie:**

- ✅ Znak marki: logo-adjacent akcenty, Talk-to-Teresa
- ✅ Jeden, świadomie wybrany, brandowy moment na doświadczenie — nie na każdej stronie
- ✅ Semantyka destrukcyjna razem z `danger` (usuwanie, akcje nieodwracalne)
- ❌ NIE jest głównym przyciskiem akcji Submit/Save/Create — to robi neutralny/navy (§3)
- ❌ NIE jest kolorem aktywnego taba/linku/itemu — to `info` (niebieski) lub neutral (§2.2)
- ❌ NIE jest focus state — fokus ma własny token: `--c-focus` / `--c-focus-solid`
  (`#2563eb` light / `#5b8def` dark)
- ❌ NIE jest kolorem zaznaczenia wiersza/karty — zaznaczenie jest neutralne: `--state-selected`
  + `--c-info` accent bar (§2.6b)
- ❌ NIGDY dla alertów lub błędów (to `danger`)

**Co jest CTA, skoro nie crimson?** Zwykły przycisk akcji modułu (Submit/Save/Create/Next) jest
**neutralny/navy** (`secondary`, niżej) — nie crimson. Crimson jest zarezerwowany dla świadomych
momentów marki, nie dla każdego przycisku na ekranie.

---

### 🔵 SECONDARY (Granatowy/Navy) - Akcja drugorzędna i domyślne CTA modułu

**Realna reprezentacja:** DBR77 nie ma osobnego tokenu semantycznego `--c-secondary` (CSS custom
property) — "secondary" w tym dokumencie to domyślne, neutralne UI, pokryte przez `--c-text` /
`--c-border` / `--c-surface` (SSOT, `src/index.css`) i skalę Tailwind `navy-*`
(`tailwind.config.js` ok. linii 183–196, opisaną w §1 NEUTRAL niżej).

Istnieje natomiast osobna, realna rodzina klas Tailwind `secondary` (`tailwind.config.js` ok.
linii 223–238) z DOKŁADNIE tymi liczbami, które ta sekcja wcześniej błędnie podawała jako CSS
custom properties `--color-secondary*`:

```js
// tailwind.config.js — statyczny obiekt kolorów, NIE CSS custom property
secondary: {
  DEFAULT: '#1E3A5F',
  hover: '#0F2744',
  light: '#2E4A6F',
  surface: 'rgba(30, 58, 95, 0.1)',
  // + skala 50–900
}
```

Generuje klasy `bg-secondary` / `text-secondary` / `border-secondary` — statyczne hexy, bez
adaptacji dark mode. Użycie: `bg-secondary` w **7 plikach**, głównie prymitywy shadcn
(`ui/slider.tsx`, `ui/progress.tsx`, `ui/badge.tsx`, `ui/toast.tsx`); warianty `bg-secondary-hover`
/ `bg-secondary-light` / `bg-secondary-surface` mają **zero wystąpień** w `src/`.

> **Poprawka (fantom, trzecia rewizja 2026-08-02):** poprzednia wersja podawała powyższe liczby
> jako `--color-secondary` / `-hover` / `-light` / `-surface` — CSS custom properties, których
> `grep -rn -- "--color-secondary:" src/` **nie znajduje**. Numery są prawdziwe, tylko nośnik był
> fikcyjny (var() zamiast klasy Tailwind).

Dla nowego domyślnego CTA modułu: neutralny przycisk (navy/slate) + tokeny
`--c-text`/`--c-border`/`--c-surface`, nie rodzina `secondary-*` — ta ostatnia jest legacy/dług.

**Zastosowanie:**

- ✅ Przyciski drugorzędne (Cancel, Back, Close)
- ✅ **Domyślne CTA modułu** (Submit, Save, Create) — patrz §3
- ✅ Nawigacja i sidebar
- ✅ Nagłówki i tekst główny (light mode)
- ✅ Informacyjne elementy UI
- ❌ NIGDY dla akcji destrukcyjnych

---

### 🔴 DANGER (Czerwień) - ZAWSZE alarm

**Realny token (SSOT, dark-adaptive):** `--c-danger` w `src/index.css`.

```css
/* src/index.css — :root (light) */
--c-danger: #e80538;

/* src/index.css — .dark */
--c-danger: #ed5565;
```

Klasy Tailwind: `bg-c-danger` (namespace `c.*`) — realnie używane w **95 plikach**; `text-c-danger`
— **161 plikach**. To jest droga dla nowego kodu.

> **Poprawka (fantom, trzecia rewizja 2026-08-02):** ta sekcja wcześniej podawała blok
> `--color-danger` / `-hover` / `-light` / `-surface` jako CSS custom properties —
> `grep -rn -- "--color-danger:" src/` → zero deklaracji. Te same liczby istnieją jako statyczny
> obiekt kolorów Tailwind `danger` w `tailwind.config.js` (ok. linii 243–258): DEFAULT `#E80538`,
> hover `#C1042F`, light `#ED5541`, surface `rgba(232,5,56,0.1)` (+ skala 50–900) — generuje
> `bg-danger` / `text-danger` / `border-danger`, statyczne, bez adaptacji dark mode. Różnica wobec
> `primary`/`secondary`: ta rodzina jest w praktyce **całkowicie nieużywana** — dokładne
> dopasowanie (`bg-danger`, `text-danger`, `border-danger`, bez sufiksu) daje **zero wystąpień**
> w `src/`. Realny kod koloruje błędy wyłącznie przez `--c-danger` / `text-c-danger` / `bg-c-danger`.

**Zastosowanie:**

- ✅ Usuwanie/kasowanie danych
- ✅ Błędy i walidacja
- ✅ Statusy krytyczne (Unhealthy, Failed, Error)
- ✅ Alerty wymagające natychmiastowej uwagi
- ❌ NIGDY dla zwykłych przycisków
- ❌ NIGDY dla elementów dekoracyjnych

> **Uwaga:** `danger` (`#e80538`/`#ed5565`) i brand `crimson` (`#85182f`/`#c8324a`) są celowo
> odrębnymi kolorami, żeby błąd nigdy nie czytał się jako marka.

---

### 🟢 SUCCESS (Zieleń) - Potwierdzenie sukcesu

**Realny token (SSOT, dark-adaptive):** `--c-success` w `src/index.css`.

```css
/* src/index.css — :root (light) */
--c-success: #026833;

/* src/index.css — .dark */
--c-success: #3fb950;
```

Klasy Tailwind: `bg-c-success` — realnie używane w **115 plikach**; `text-c-success` —
**146 plikach**. To jest droga dla nowego kodu.

> **Poprawka (fantom, trzecia rewizja 2026-08-02):** ta sekcja wcześniej podawała blok
> `--color-success` / `-hover` / `-light` / `-surface` jako CSS custom properties —
> `grep -rn -- "--color-success:" src/` → zero deklaracji. Tu fantom jest podwójny: liczby
> (`#026833` / `#024f26` / `#52a52e` / `rgba(2,104,51,0.1)`) NIE odpowiadają nawet realnej,
> równoległej rodzinie Tailwind `success` (`tailwind.config.js` ok. linii 262–277), która ma INNE
> wartości: DEFAULT `#52A52E` (nie `#026833`!), hover `#388A22`, light `#9EC44D`, surface
> `rgba(82,165,46,0.1)`. Stare liczby w tym dokumencie okazują się mieszanką SSOT `--c-success`
> (`#026833`) z podskalą numeryczną Tailwinda (`success.800` = `#024F26`, `success.DEFAULT` =
> `#52A52E`) — dowód, że oryginalny wpis był rekonstrukcją z pamięci, nie odczytem jednego pliku.
> Klasy `bg-success` / `text-success` (DEFAULT, rodzina Tailwind) mają w `src/` odpowiednio
> **1 i 0** wystąpień (`bg-success/10` w `src/components/demo/DemoWelcomeTour.tsx:344`); warianty
> `-hover` / `-light` / `-surface` — zero. Realny kod koloruje sukces wyłącznie przez
> `--c-success` / `text-c-success` / `bg-c-success`.

**Zastosowanie:**

- ✅ Status "Healthy", "Active", "UP"
- ✅ Komunikaty sukcesu (Saved, Created, Completed)
- ✅ Pozytywne zmiany (trend ↑)
- ❌ NIGDY dla przycisków akcji
- ❌ NIGDY jako kolor dominujący

---

### 🟡 SIGNAL COLORS (Amber/Blue) — dozwolone jako sygnały (KANON)

DBR77 zakłada 4 kolory semantyczne + crimson jako marka. W praktyce UI potrzebuje jeszcze dwóch
**kolorów sygnałowych**, opisanych tokenami `--c-warning` i `--c-info`. Ich użycie jest ściśle
ograniczone.

**Dozwolone:**

- **WARNING / AT RISK**: `amber/*` = `--c-warning` (`#ae6429` light / `#e8a33d` dark)
- **INFO**: `blue/*` = `--c-info` (`#3b2883` light / `#58a6ff` dark)

**MUST:**

- używamy ich tylko jako: **badge/dot/callout**, ewentualnie subtelny background (`*/surface`)
- nie budujemy na nich "brand identity" modułu/ekranu

**MUST NOT:**

- nie używamy ich dla głównych CTA (CTA zawsze neutralny/navy — §3)
- nie używamy ich jako stałych kolorów nawigacji/ramek całego panelu

---

### ⚪ NEUTRAL (Szarości Navy) — "Warm darks, soft lights"

**MUST (Dark mode):**

- **Nigdy pure black (`#000000`)** — zawsze warm navy-dark (`#0A0F1E` i cieplejsze)
- **Nigdy pure white (`#ffffff`) jako tekst** — najjaśniejszy tekst = `#f1f5f9` (slate-100)
- Te subtelne "ciepłe" odcienie są kluczowe dla premium feel — ekran nie męczy oczu

> **Poprawka (K-14, panel adwersaryjny 2026-08-02):** ta sekcja wcześniej podawała tabelę
> `--neutral-950…--neutral-0` jako CSS custom properties. `grep -rn "\-\-neutral-[0-9]" src/`
> daje **zero wyników** — token nigdy nie istniał w kodzie, a wartości były dodatkowo przesunięte
> o jeden stopień względem realnej skali (np. dawne „neutral-500" = `#64748B` to w rzeczywistości
> `navy-400`). Poniżej realna skala Tailwinda `navy-*` z `tailwind.config.js` (ok. linii 183–196) —
> to klasy Tailwind (`bg-navy-950`, `dark:border-navy-700`…), NIE CSS custom properties.

```
navy-950  #0A0F1E   Deepest background — Main App BG
navy-900  #0F172A   Panel background — Secondary BG
navy-850  #111827   Lighter panels
navy-800  #151E32   Card background
navy-700  #2A3655   Borders / Separators
navy-600  #374151   Hover states
navy-500  #475569   Muted text
navy-400  #64748B   Labels, placeholders
navy-300  #94A3B8   Hints, disabled
navy-200  #CBD5E1   Light borders
navy-100  #E2E8F0   Hover bg
navy-50   #F1F5F9   Subtle bg
```

**Realne powierzchnie aplikacji (SSOT — nie odczytuj `navy-*` wprost dla bg/surface):**
tokeny `--c-bg` / `--c-surface` / `--c-surface-raised` w `src/index.css` (`:root` = light,
`.dark` = dark). Dark: `--c-bg: #0a0f1e` (= `navy-950`), `--c-surface: #0f172a` (= `navy-900`),
`--c-surface-raised: #15213b`. Light: `--c-bg: #fafaf9`, `--c-surface: #ffffff`,
`--c-surface-raised: #f8fafc`.

**Hierarchia tekstu w dark mode (refinement):**

| Rola           | Wartość   | Klasa Tailwind   | Uwaga             |
| -------------- | --------- | ---------------- | ----------------- |
| Primary text   | `#f1f5f9` | `text-slate-100` | NIE `#ffffff`     |
| Secondary text | `#94a3b8` | `text-slate-400` | Opisy, etykiety   |
| Muted/tertiary | `#64748b` | `text-slate-500` | Hinty, timestamps |
| Disabled       | `#475569` | `text-slate-600` | Nieaktywne        |

---

## 2. 📝 ZASADY KOLOROWANIA TEKSTU (Typography)

### 2.1 Hierarchia kolorów tekstu

| Poziom        | Dark Mode | Light Mode | Użycie                                             |
| ------------- | --------- | ---------- | -------------------------------------------------- |
| **Primary**   | `#F1F5F9` | `#0F172A`  | Nagłówki, główna treść (**NIE** `#FFFFFF` w dark!) |
| **Secondary** | `#94A3B8` | `#475569`  | Opisy, etykiety                                    |
| **Muted**     | `#64748B` | `#64748B`  | Hinty, placeholdery                                |
| **Disabled**  | `#475569` | `#94A3B8`  | Nieaktywne elementy                                |

> **v2.0 ZMIANA:** Primary text w dark mode zmieniony z `#FFFFFF` na `#F1F5F9` (slate-100). Pure white jest zbyt ostry i nie pasuje do premium "warm dark" aesthetic. Różnica jest subtelna, ale kluczowa dla premium feel.

### 2.2 Kiedy WOLNO kolorować tekst

| Sytuacja             | Kolor                                          | Przykład                    |
| --------------------- | ----------------------------------------------- | ---------------------------- |
| **Status pozytywny** | Success `#026833` / `#3FB950`                  | "Active", "Healthy", "+12%" |
| **Status negatywny** | Danger `#E80538` / `#ED5565`                   | "Error", "Failed", "-5%"    |
| **Link/akcja**       | Info `#3B2883` / `#58A6FF` (niebieski)         | "View details", "Edit"      |
| **Aktywny tab/item** | Neutralny tekst (bold) + wskaźnik `--c-info` (patrz uwaga niżej) | Aktywna pozycja menu |

> **v3.0 ZMIANA:** Wiersze "Link/akcja" i "Aktywny tab/item" wcześniej wskazywały Primary
> `#7C3AED`/`#8B5CF6` — fiolet, który nie istnieje w kodzie. Crimson jest zarezerwowany dla marki
> i destrukcji (§1), więc link/akcja i aktywny tab dostają `info` (niebieski). Crimson w tej roli
> czytałby się jak alarm lub przypadkowy brand-moment na każdym ekranie.
>
> **Poprawka (K-20, panel adwersaryjny 2026-08-02):** wiersz "Aktywny tab/item" wcześniej
> wskazywał `--c-focus-solid`, sprzecznie z §2.6c/§9/§10 tego samego pliku i z realnym kodem
> (`InitiativeDetailModal.tsx:595`: `activeTab === tab.id ? 'text-c-info border-c-info' : ...`).
> `--c-info` (`#3B2883`/`#58A6FF`) i `--c-focus-solid` (`#2563EB`/`#5B8DEF`) to RÓŻNE hexy — nie są
> "tym samym tokenem". Trzy role, żadna nie dzieli koloru z inną:
> - **stan aktywny/zaznaczony** (np. tło wybranego wiersza) = neutralny `--state-selected`,
> - **wskaźnik informacyjny / pasek akcentu** (np. underline aktywnego taba, accent bar
>   zaznaczonego wiersza w §2.6b) = `--c-info`,
> - **fokus klawiaturowy** (ring/border po Tab) = `--c-focus` / `--c-focus-solid`.

### 2.3 Kiedy NIE WOLNO kolorować tekstu

❌ **ZABRONIONE:**

- Kolorowanie zwykłego tekstu treści
- Używanie wielu kolorów w jednym akapicie
- Kolor tekstu bez znaczenia semantycznego
- Czerwony tekst dla zwykłych informacji
- Zielony tekst dla zwykłych danych

### 2.4 Zasady kontrastu tekstu

```
MINIMALNE WYMAGANIA (WCAG 2.1 AA):
├── Tekst normalny (<18px): kontrast ≥ 4.5:1
├── Tekst duży (≥18px lub ≥14px bold): kontrast ≥ 3.0:1
└── Elementy UI (ikony, bordery): kontrast ≥ 3.0:1
```

### 2.5 Sprawdzone kombinacje tekst/tło

| Tło               | Tekst Primary | Tekst Secondary | Kontrast        |
| ----------------- | ------------- | ---------------- | ---------------- |
| `#0A0F1E` (dark, navy-950) | `#F1F5F9` | `#94A3B8` | ~18:1 / 7.5:1 ✅ |
| `#0F172A` (dark, navy-900) | `#F1F5F9` | `#94A3B8` | ~16:1 / 6.7:1 ✅ |
| `#FFFFFF` (light) | `#0F172A`     | `#475569`         | 16:1 / 7.2:1 ✅  |
| `#F8FAFC` (light) | `#0F172A`     | `#475569`         | 15:1 / 6.9:1 ✅  |

> **v3.0 POPRAWKA:** Ta tabela wcześniej podawała `#FFFFFF` (pure white) jako "Tekst Primary" w
> dark mode — sprzeczne z zakazem pure white z §1 NEUTRAL i z poprawną wartością w §2.1
> (`#F1F5F9`). Wartości i kontrasty przeliczone dla `#F1F5F9`.
>
> **Poprawka (K-17 + dodatkowe znalezisko, panel adwersaryjny 2026-08-02):** wiersze tła dark
> podawały `#020617`/`#0B1121` — niezgodne z realną skalą `tailwind.config.js` (`navy-950 =
> #0A0F1E`, `navy-900 = #0F172A`) i ze skorygowanym §3.1 `visual-language.md`. Poprawione na
> realne hexy; kontrast dla `#0F172A` przeliczony w przybliżeniu (był podany dla błędnego,
> ciemniejszego `#0B1121`).

### 2.6 Kolorowy tekst - dodatkowe zasady

1. **Kolorowy tekst musi być krótki** - max 3-4 słowa
2. **Zawsze z kontekstem** - ikona lub etykieta obok
3. **Nie tylko kolor** - dla dostępności dodaj ikony (✓, ✕, ⚠️)
4. **Spójność** - ten sam status = ten sam kolor wszędzie

### 2.6a Table Chip Color Usage

Chipy w tabelach są częścią warstwy danych, nie chrome ani CTA. Kolor w chipie służy do szybkiego skanowania znaczenia.

Typy chipów:

- `StatusChip` - status / etap / stan workflow. Kolor dozwolony, ale jako subtelny sygnał. Ikona lub dot może nieść kolor; tekst musi mieć wysoki kontrast.
- `PriorityChip` - priorytet. Jeden wzorzec per moduł: dot/ikona + label. Nie mieszamy dot-only, text-only i pill-only w jednej rodzinie tabel.
- `MetaChip` - tagi, typy, źródła, skróty właścicieli. Zawsze neutralny: `slate/navy`, bez `primary`, `success`, `warning` ani `danger`.
- `ToolChip` - narzędzie / artefakt / tryb pracy. Prawie neutralny; ikona może użyć delikatnego `primary` lub `info`, ale tło nie może wyglądać jak CTA.
- `SlaChip` / `DueChip` - termin, SLA, overdue. Kolor tylko dla ryzyka, overdue i breach. Normalna data jest neutralna.

MUST:

- text contrast: minimum WCAG AA; praktycznie `text-slate-700/800` w light i `text-slate-200/300` w dark,
- light mode: zero “jasne tło + jasny tekst tego samego koloru”,
- dark mode: zero neonowych dużych plam; preferuj `bg-*/10` albo neutralne tło + kolorowa ikona,
- `crimson` (marka) nie dominuje stale w kolumnie tabeli jako dekoracja; dozwolony tylko jako
  świadomy akcent marki lub semantyka destrukcyjna — NIE jako aktywny stan / focus / link
  (te używają neutral + `--c-info`/`--c-focus`, patrz §2.2, §2.6b),
- kolor chipów jest spójny między table, preview i list/card wariantem tego samego modułu.

MUST NOT:

- nie używamy `primary`/crimson jako dekoracyjnego koloru metadata,
- nie robimy tagów kolorowych bez semantyki,
- nie używamy wielu lokalnych map kolorów dla tej samej encji w jednym module.

### 2.6b Accepted App Table Color Grid

Status: `APPROVED / ENFORCED`

Ta siatka kolorów została zaakceptowana jako docelowy standard dla referencyjnych tabel App Table. Stosuj ją przy nowych tabelach i przy migracji istniejących tabel po zakończeniu odbioru pozostałych aspektów UI/UX.

Kierunek: ClickUp High Contrast + DBR77 Tech Sexy 2027. Stan ma być widoczny natychmiast, ale nadal premium: mocny kontrast, brandowy akcent, bez neonów i bez szarych legacy belek.

#### Table Surface

| Element | Light mode | Dark mode |
|---|---|---|
| Table scroll surface | `bg-slate-50/40` | `dark:bg-navy-950` |
| Default row | `bg-white` | `dark:bg-navy-950` |
| Row hover | `hover:bg-state-hover` | `hover:bg-state-hover` (sama klasa, auto-adapt) |
| Header | `bg-slate-100/95` + `shadow-[0_1px_0_rgba(15,23,42,0.08)]` | `dark:bg-navy-900` + `dark:shadow-[0_1px_0_rgba(255,255,255,0.10)]` |
| Row separator | `border-slate-200/95` | `dark:border-white/[0.085]` |
| Header separator | `border-slate-300/70` | `dark:border-white/[0.10]` |

> **Poprawka (K-19, panel adwersaryjny 2026-08-02):** "Row hover" wcześniej podawało
> `hover:bg-slate-100/80` (light) / `dark:hover:bg-white/[0.04]` (dark) — oznaczone
> "APPROVED/ENFORCED", ale sprzeczne z `light-mode-readability.md` §6, który wprost argumentuje
> przeciw `bg-slate-100` jako "zbyt mocnemu przy szybkim mouse-over" i wskazuje `bg-slate-50`.
> Realny kod (`src/components/shared/ModuleHub/FilterableTable.tsx:799`, silnik pod
> `StandardTable`) ma **trzecią wartość**: `hover:bg-state-hover`, gdzie
> `--state-hover: color-mix(in srgb, var(--c-text) 6%, transparent)` (`src/index.css`) —
> jedna klasa, sama dostosowuje się do light/dark przez `--c-text`. Ani `bg-slate-100/80`, ani
> `bg-slate-50` nie odpowiadają temu, co faktycznie renderuje się na ekranie — **oba dokumenty
> mają tu udokumentowany dług**, rozstrzyga kod.

#### Row State Grid

> **v3.0 PRZEPISANE:** Ta siatka używała `rgba(124,58,237,…)` — fiolet, który nie istnieje w
> kodzie — dla selected/focused/checked row. Podwójnie źle: fiolet nie istnieje, a zaznaczenie ma
> być NEUTRALNE, nie brandowe/crimson (crimson w zaznaczeniu czyta się jak alarm). Poniżej realne
> klasy z SSOT: `src/components/shared/selectionTokens.ts`
> (`SELECTED_ROW_CLASS`, `PREVIEW_SELECTED_ROW_CLASS`, `FOCUSED_ROW_CLASS`), zgodne z
> `light-mode-readability.md` §3/§16 (`surface-selected` = neutralna powierzchnia + niebieski
> `--c-info` accent bar, NIGDY crimson/primary).

| State | Light mode | Dark mode | Accent |
|---|---|---|---|
| Selected (checkbox / single-click) | `bg-slate-100 shadow-[inset_4px_0_0_var(--c-info)] ring-1 ring-slate-300/60 ring-inset` | `dark:bg-white/[0.08] dark:shadow-[inset_4px_0_0_var(--c-info)] dark:ring-white/[0.10]` | `var(--c-info)` (niebieski) |
| Preview-open (softer) | `bg-slate-50 shadow-[inset_4px_0_0_var(--c-info)] ring-1 ring-slate-200/70 ring-inset` | `dark:bg-white/[0.06] dark:shadow-[inset_4px_0_0_var(--c-info)] dark:ring-white/[0.08]` | `var(--c-info)` (niebieski, słabszy) |
| Focused (keyboard) | `bg-slate-50/80 ring-1 ring-inset ring-slate-200/80` | `dark:bg-white/[0.04] dark:ring-white/[0.07]` | brak accent-bara — tylko ring |

MUST:

- Selected/preview row używa neutralnej powierzchni (`slate`) + `--c-info` accent bar (`4px`),
  nigdy crimson/primary i nigdy losowego cyan/amber/gray.
- Focused (keyboard) row ma tylko ring, bez accent-bara — nie miesza się z selected/preview.
- A state that is only technically present but invisible on a screenshot is not accepted.
- Do not replace this grid with local module colors. If a table needs a new state, document it here first.

#### Table Text

| Element | Light mode | Dark mode |
|---|---|---|
| Row primary title | `text-slate-950` | `dark:text-slate-100` |
| Row secondary text | `text-slate-600` | `dark:text-slate-400` |
| Row secondary hover | `group-hover:text-slate-700` | `dark:group-hover:text-slate-300` |
| Header label | `text-slate-600` | `dark:text-slate-300` |
| Date / quiet metadata | `text-slate-600` | `dark:text-slate-400` |

#### Table Chip Grid

| Chip type | Light mode | Dark mode |
|---|---|---|
| Tool / neutral chip | `border-slate-300/80 bg-slate-100 text-slate-800` | `dark:border-white/[0.11] dark:bg-white/[0.075] dark:text-slate-100` |
| Meta tag chip | `border-slate-300/80 bg-slate-100 text-slate-800` | `dark:border-white/[0.10] dark:bg-white/[0.065] dark:text-slate-200` |
| Amber status | `border-amber-300/80 bg-amber-50 text-amber-900` | `dark:border-amber-300/[0.25] dark:bg-amber-300/[0.12] dark:text-amber-100` |
| Emerald status | `border-emerald-300/80 bg-emerald-50 text-emerald-900` | `dark:border-emerald-300/[0.25] dark:bg-emerald-300/[0.12] dark:text-emerald-100` |
| Blue status | `border-blue-300/80 bg-blue-50 text-blue-900` | `dark:border-blue-300/[0.25] dark:bg-blue-300/[0.12] dark:text-blue-100` |
| Rose status | `border-rose-300/80 bg-rose-50 text-rose-900` | `dark:border-rose-300/[0.25] dark:bg-rose-300/[0.12] dark:text-rose-100` |

> **Poprawka (K-P1-06 + K-P1-08, panel adwersaryjny 2026-08-02):** wiersz "Violet status" usunięty.
> Był podwójnie problematyczny:
> 1. **Fałszywa nota (K-P1-06):** twierdziła, że violet stoi na "standardowej palecie Tailwind" i
>    nie ma związku z martwym fioletem-primary `#7C3AED`. Realnie `tailwind.config.js` ma blok
>    CENTRAL REMAP (ok. linii 418–465), który przepina `indigo`/`violet`/`purple` na HBS Purple
>    (`violet-500 = #80408D`) — więc `bg-violet-500` w tym projekcie renderuje HBS Purple, nadal
>    fiolet na ekranie, tylko inny odcień niż martwy `#7C3AED`. Pełny opis remapu:
>    `docs/ui-standards/00-foundation/FOUNDATION_TOKEN_CONTRACT.md` §7 (nie duplikowany tu).
> 2. **Szósty kubełek (K-P1-08):** §2.6c definiuje zamknięty model 5 kubełków statusu ("This is
>    the only allowed semantic status map") — "Violet status" był w praktyce 6. kubełkiem bez
>    miejsca w tym modelu.
>    Rozstrzygnięcie: usunięty, nie dodany jako 6. bucket — `grep` po `src/` nie znajduje ani
>    jednego App Table status chipa z dokładnie tym wzorcem (`border-violet-300/80 bg-violet-50
>    text-violet-900`); violet jako HBS Purple istnieje w produkcie gdzie indziej (dekoracyjnie,
>    np. kategorie w Mind Map), ale nie jako status App Table. Jeśli status nie mieści się w 5
>    kubełkach §2.6c, nie wprowadzaj tu nowego bez udokumentowania (patrz MUST NOT §2.6c).

MUST NOT:

- Do not use unstable shorthand opacity when it is not generated reliably by Tailwind. Prefer explicit arbitrary opacity like `dark:bg-primary-500/[0.20]`.
- Do not use bright full-row fills for non-selected states.
- Do not use `primary`/crimson as decorative metadata chip background.

### 2.6c DBR77 2027 canonical semantic status map (global)

Status: `APPROVED / ENFORCED`

This is the only allowed semantic status map for Consultify App Tables.

| Semantic bucket | Palette | Examples |
|---|---|---|
| Neutral state | `slate` | `draft`, `paused`, `archived`, neutral informational statuses |
| Active execution | `blue` | `assigned`, `in_progress`, `working`, `started` |
| Pending attention/review | `amber` | `submitted`, `in_review`, `pending_review`, `generating`, near due |
| Positive completion | `emerald` | `approved`, `completed`, `accepted`, `promoted` |
| Risk/failure | `rose` | `failed`, `rejected`, `sent_back`, `blocked`, overdue |
| Neutral selection/focus | `slate` surface + `--c-info` accent bar / `--c-focus` ring | selected/focused/checked row state, focus ring, active tab underline — **crimson NIE jest tu używany**, patrz §2.6b |

MUST:

- Map every table status to one of the buckets above.
- Keep the same mapping for table rows, preview pane, and list/card variants in the same module.
- Keep `MetaChip` and `ToolChip` neutral by default.

MUST NOT:

- Do not create module-local seventh/eighth status palettes.
- Do not use `primary`/crimson as decorative status or metadata fill.
- Do not keep conflicting old color maps after migration.

If any older section in this file conflicts with this map for App Tables, this section wins.

> **v3.0 ZMIANA:** Bucket "Selection/focus only" wcześniej wskazywał `primary/violet` — fiolet
> nie istnieje w kodzie, a crimson (dzisiejszy `primary`) jest zarezerwowany dla marki/destrukcji,
> nie dla zaznaczenia. Zaznaczenie/focus jest neutralne + niebieski `--c-info`/`--c-focus`.

### 2.7 Przykłady poprawnego użycia

```jsx
// ✅ DOBRZE - Status z ikoną
<span className="text-success flex items-center gap-1">
  <CheckIcon /> Active
</span>

// ✅ DOBRZE - Trend z kontekstem
<span className="text-success">↑ 12%</span>
<span className="text-danger">↓ 5%</span>

// ✅ DOBRZE - Link/akcja (info, NIE crimson — patrz §2.2)
<button className="text-c-info hover:underline">
  View details →
</button>

// ❌ ŹLE - Kolorowy tekst bez znaczenia
<p className="text-c-accent">This is regular paragraph text</p>

// ❌ ŹLE - Wiele kolorów
<p>
  <span className="text-success">Green</span> and
  <span className="text-danger">red</span> and
  <span className="text-c-accent">crimson</span>
</p>
```

---

## 3. Hierarchia przycisków

| Wariant                  | Kolor                  | Użycie                                          | Przykład                    |
| ------------------------- | ------------------------ | ------------------------------------------------- | ---------------------------- |
| **Primary (moduł)**      | Navy/neutralny (`secondary`) | Główna akcja na stronie                    | "Save", "Create", "Submit" |
| **Brand / Signature CTA** | Crimson (`--c-accent`) | Rzadki, świadomy brandowy moment — NIE każdy Submit | Talk-to-Teresa             |
| **Secondary**             | Navy/Outline            | Akcja drugorzędna                                | "Cancel", "Back", "Close"   |
| **Ghost**                 | Transparentny            | Akcja trzeciorzędna                              | "Edit", "View", linki       |
| **Danger**                | Czerwony                 | TYLKO destrukcyjne                               | "Delete", "Remove"          |

### Zasady:

1. **Jedna strona = jeden dominujący przycisk akcji** (neutralny/navy); crimson brand-CTA pojawia się co najwyżej raz na doświadczenie, nie na każdym ekranie
2. **Danger button wymaga potwierdzenia** (modal/dialog)
3. **Ghost buttons** nie mają tła, tylko tekst + ikona
4. **Brak przycisków Success** - używamy neutralnego Primary z ikoną ✓
5. **Fokus na dowolnym przycisku** = `--c-focus` / `--c-focus-solid` (niebieski), NIGDY crimson

> **v3.0 ZMIANA:** Wcześniej "Primary = Fiolet" był domyślnym przyciskiem głównej akcji. Dziś
> zwykłe CTA modułu jest neutralne/navy; crimson jest osobnym, rzadkim wariantem "Brand / Signature
> CTA" — patrz §1.

---

## 4. Statusy i badges

| Status                  | Semantyka | Tekst Dark | Tekst Light | Tło Surface                                          |
| ------------------------- | ---------- | ----------- | ------------- | ------------------------------------------------------ |
| Active/Healthy            | Success    | `#3FB950`   | `#026833`     | `rgba(2,104,51,0.1)` light / `rgba(63,185,80,0.1)` dark |
| Processing/In progress    | Info       | `#58A6FF`   | `#3B2883`     | `rgba(59,40,131,0.1)` light / `rgba(88,166,255,0.1)` dark |
| Pending/Awaiting review   | Warning    | `#E8A33D`   | `#AE6429`     | `rgba(174,100,41,0.1)` light / `rgba(232,163,61,0.1)` dark |
| Inactive/Disabled         | Neutral    | `#64748B`   | `#94A3B8`     | `rgba(100,116,139,0.1)`                                |
| Error/Failed              | Danger     | `#ED5565`   | `#E80538`     | `rgba(232,5,56,0.1)` light / `rgba(237,85,101,0.1)` dark |

### Uwaga (v3.0)

Warning (`amber`) i Info (`blue`) są dozwolonymi kolorami sygnałowymi (§1 SIGNAL COLORS) i częścią
kanonicznej mapy statusów (§2.6c) — **nie są "usunięte"**. Wcześniejsza wersja tej sekcji mówiła
"~~Warning/Orange~~ usunięte" i "~~Info/Blue~~ usunięte", co jest sprzeczne z resztą dokumentu.
Wiersz "Pending/Processing" ze starej wersji (przypisany do Primary/fiolet `#7C3AED`) został
rozdzielony na dwa realne stany zgodnie z mapą §2.6c: `Processing` = Active execution (blue/info),
`Pending` = Pending attention/review (amber/warning).

---

## 5. Formularze - kolorowanie

```css
/* Normal state */
border-color: var(--c-border);
color: var(--c-text);

/* Focus state */
border-color: var(--c-focus-solid); /* niebieski — NIGDY --c-accent/crimson */
box-shadow: 0 0 0 3px var(--c-focus);

/* Error state */
border-color: var(--c-danger);
color: var(--c-text); /* Tekst pozostaje normalny! */
/* Komunikat błędu pod inputem */
.error-message {
  color: var(--c-danger);
}

/* Success state (po walidacji) */
border-color: var(--c-success);
```

**Ważne:** Sam tekst w input pozostaje w normalnym kolorze. Kolorujemy tylko:

- Border inputa
- Ikonę walidacji
- Komunikat błędu/sukcesu POD inputem

> **v3.0 ZMIANA:** Focus state wcześniej używał `var(--color-primary)` (fiolet). Fokus ma własny
> token, niezależny od marki: `--c-focus` / `--c-focus-solid` (niebieski). Error/Success zapisane
> wprost przez `--c-danger`/`--c-success` (SSOT `src/index.css`).
>
> **Poprawka (dodatkowe znalezisko, panel adwersaryjny 2026-08-02):** ten blok używał
> `var(--neutral-300)` i `var(--text-primary)` — żaden z nich nie jest nigdzie deklarowany w
> `src/` (`grep -rn -- "--neutral-300:\|--text-primary:" src/` → zero). Zamienione na realne
> tokeny `--c-border`/`--c-text` z `src/index.css`.

---

## 6. Implementacja CSS Classes

### Klasy tekstowe

```css
/* Primary text colors */
.text-primary {
  color: var(--c-text);
} /* Main content */
.text-secondary {
  color: var(--c-text-secondary);
} /* Descriptions */
.text-muted {
  color: var(--c-text-muted);
} /* Hints */
.text-disabled {
  color: var(--c-text-muted);
} /* Disabled — brak osobnego tokenu; użyj --c-text-muted lub klasy text-slate-600/400 (§2.1) */

/* Semantic text colors - USE SPARINGLY */
.text-brand {
  color: var(--c-accent);
} /* Brand accent ONLY — Teresa, kluczowe momenty marki. NIE zwykłe linki/akcje (te = --c-info). */
.text-success {
  color: var(--c-success);
} /* Positive status */
.text-danger {
  color: var(--c-danger);
} /* Errors, negative */
```

> **Poprawka (dodatkowe znalezisko, panel adwersaryjny 2026-08-02):** `--text-primary`,
> `--text-secondary`, `--text-muted`, `--text-disabled` nie są nigdzie deklarowane w `src/`
> (`grep -rn -- "--text-primary:\|--text-secondary:\|--text-muted:\|--text-disabled:" src/` →
> zero; jedyne wystąpienia to fallbacki `var(--text-secondary, #666)` w dwóch niepowiązanych
> plikach `src/views/superadmin/*.css`, które zawsze renderują fallback bo zmienna nigdy nie jest
> ustawiona). Zamienione na realne tokeny `--c-text`/`--c-text-secondary`/`--c-text-muted`
> (`src/index.css`). Dla "Disabled" nie ma dedykowanego CSS var w kodzie — §2.1 rozstrzyga to
> wprost klasami Tailwind (`text-slate-600` dark / `text-slate-400` light), nie custom property.

---

## 7. Zakaz użycia

### ❌ ZABRONIONE kolory (poza zdefiniowaną paletą)

- Różowy (#EC4899) - spoza palety
- Cyan (#06B6D4) - spoza palety jako element chrome/CTA (dozwolony wyłącznie jako `c-tag`/`c-chart` w palecie danych, §11)
- Dowolne inne kolory spoza zdefiniowanej palety (crimson/danger/success/warning/info/neutral + `c-tag`/`c-chart` do danych)

> **v3.0 ZMIANA:** Wcześniej ta lista zabraniała też Pomarańczowego i Żółtego. To było sprzeczne z
> resztą dokumentu — `amber` jest kanonicznym kolorem WARNING (`--c-warning`, §1 SIGNAL COLORS) i
> częścią mapy statusów §2.6c ("Pending attention/review"). Zakaz dotyczy wyłącznie dowolnych,
> niezdefiniowanych odcieni pomarańczu/żółci spoza tokenów `--c-warning`/`c-tag`/`c-chart` — nie
> samego amber/warning jako takiego.

### ❌ ZABRONIONE kombinacje tekstu:

- Czerwony tekst na zielonym tle (i odwrotnie)
- Jasny tekst na jasnym tle
- Kolorowy tekst bez znaczenia semantycznego
- Więcej niż 2 kolory tekstu w jednym komponencie

---

## 8. Checklist przed merge

- [ ] Czy używam tylko 4 kolorów semantycznych + crimson (marka) + amber/blue (sygnały)?
- [ ] Czy czerwień jest TYLKO dla błędów/destrukcji?
- [ ] **Czy crimson NIE jest użyty jako fokus / stan aktywny / zaznaczenie?**
- [ ] **Czy fokus używa `--c-focus` / `--c-focus-solid` (niebieski), a nie crimson?**
- [ ] **Czy CTA modułu (Submit/Save/Create) jest neutralny/navy, a nie crimson?**
- [ ] Czy kolorowy tekst ma znaczenie semantyczne?
- [ ] Czy kolorowy tekst jest krótki (max 3-4 słowa)?
- [ ] Czy jest ikona/kontekst przy kolorowym tekście?
- [ ] Czy kontrast tekstu spełnia WCAG AA (≥4.5:1)?
- [ ] Czy dominujący przycisk akcji jest jeden na stronę?

---

## 9. Migration Guide

> **v3.0 PRZEPISANE CAŁKOWICIE.** Poprzednia wersja (v2.1) kazała migrować `blue-*`, `amber-*`,
> `indigo-*` → `primary-*`. Ponieważ `primary` dziś = crimson, wykonanie tej instrukcji dosłownie
> zamalowałoby całą aplikację crimsonem — **to była aktywnie szkodliwa instrukcja**. Tabela i
> skrypt poniżej są przepisane pod kanoniczną mapę semantyczną (§2.6c) i realne tokeny `--c-*`.

### Zamiana starych kolorów na DBR77 (v3.0)

| Stary kolor                                                 | Nowy kolor DBR77                                                                              | Klasa Tailwind                                       |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------ |
| `blue-500/600` (info, aktywny stan)                          | Info                                                                                             | `c-info` (`text-c-info`, `bg-c-info`, `border-c-info`) |
| `orange-500` / `amber-500` (warning)                          | Warning                                                                                           | `c-warning`                                            |
| `yellow-*`                                                    | Warning lub Neutral                                                                              | `c-warning` lub `slate-*`                              |
| `cyan-*` (chrome/dekoracja)                                   | Neutral                                                                                           | `slate-*` / `navy-*`                                   |
| `cyan-*` (dana/seria wykresu)                                 | Paleta danych (§11)                                                                               | `c-tag-*` / `c-chart-*`                                |
| `indigo-*` / `violet-*` (dawny fiolet-primary)                | Brand (crimson) **tylko** jeśli to faktycznie marka/CTA-brand/destrukcja; inaczej Neutral lub Info | `c-accent` (rzadko) / `slate-*` / `c-info`             |
| `green-*`                                                      | Success                                                                                           | `c-success` / `success-*`                              |
| `red-*`                                                        | Danger                                                                                            | `c-danger` / `danger-*`                                |
| `primary-*` odziedziczone po fiolecie, użyte jako CTA/aktywny stan/focus/selected | Neutral (CTA) / `--c-info` (link, aktywny tab) / `--c-focus`-`--c-focus-solid` (focus) / neutral + `--c-info` (selected — §2.6b) | `secondary-*` / `slate-*` / `c-info` / `c-focus-solid` |

### Skrypt migracji (find & replace) — v3.0

```bash
# W komponentach TSX/JSX:
# UWAGA: primary-* dziś = crimson (marka/destrukcja). NIE migrujemy do niego
# zwykłych CTA, aktywnych stanów, focusów ani zaznaczeń — to był błąd v2.1.

# Info (dawne "aktywne"/linki na blue):
bg-blue-500 → bg-c-info
text-blue-500 → text-c-info
border-blue-500 → border-c-info

# Warning (dawne orange/amber/yellow):
bg-orange-500 → bg-c-warning
bg-amber-500 → bg-c-warning
text-amber-400 → text-c-warning

# Success:
bg-green-500 → bg-success-500
text-green-400 → text-success-400

# Danger:
bg-red-500 → bg-danger-500
text-red-400 → text-danger-400

# Focus — NIGDY primary/crimson:
ring-primary-500 (gdy oznacza focus) → shadow-[0_0_0_3px_var(--c-focus)]
outline-primary-500 (gdy oznacza focus) → outline-[var(--c-focus-solid)]

# Selected/aktywny wiersz — NIGDY primary/crimson:
bg-primary-100/200 (selected row) → bg-slate-100 + shadow-[inset_4px_0_0_var(--c-info)] (patrz §2.6b)
```

### Checklist migracji komponentu — v3.0

1. [ ] Zamień `blue-*` (info) na `c-info`
2. [ ] Zamień `orange/amber/yellow-*` (warning) na `c-warning`
3. [ ] Zamień `green-*` na `success-*`/`c-success`
4. [ ] Zamień `red-*` na `danger-*`/`c-danger`
5. [ ] Sprawdź KAŻDE użycie `primary-*`/crimson: czy to faktycznie marka/CTA-brand/destrukcja? Jeśli
      to był zwykły CTA modułu, focus, aktywny tab lub zaznaczenie — zamień na neutral/`c-info`/`c-focus`,
      NIE zostawiaj crimson
6. [ ] Sprawdź czy kolorowy tekst ma znaczenie semantyczne
7. [ ] Sprawdź kontrast (min 4.5:1 dla tekstu)
8. [ ] Przetestuj w light i dark mode

---

## 10. Quick Reference Card

```
╔══════════════════════════════════════════════════════════════╗
║               DBR77 COLOR QUICK REF (v3.0)                    ║
╠══════════════════════════════════════════════════════════════╣
║  🟥 CRIMSON   #85182F   TYLKO: marka, Talk-to-Teresa,          ║
║               (brand)   destrukcja — NIE CTA/focus/aktywne     ║
║  🔵 SECONDARY #1E3A5F   Domyślne CTA, cancel/back, nawigacja   ║
║  🔷 INFO      #3B2883   Link/akcja, aktywny tab, badge info    ║
║  🟠 WARNING   #AE6429   Pending/at-risk, badge warning         ║
║  🔴 DANGER    #E80538   TYLKO: delete, error, failed           ║
║  🟢 SUCCESS   #026833   TYLKO: active, healthy, done           ║
╠══════════════════════════════════════════════════════════════╣
║  FOCUS: zawsze --c-focus / --c-focus-solid (#2563EB).          ║
║         NIGDY crimson.                                         ║
║  ZAZNACZENIE: zawsze neutralne + niebieski accent bar.         ║
║               NIGDY crimson.                                   ║
║  TEKST: Nie koloruj bez powodu!                                ║
║  • Kolorowy = status/akcja                                     ║
║  • Max 3-4 słowa                                                ║
║  • Zawsze z ikoną                                               ║
╚══════════════════════════════════════════════════════════════╝
```

(Hexy powyżej to wartości light mode; SSOT dark mode = `src/index.css` `.dark`.)

---

## 11. Paleta DANYCH — `c-tag` vs `c-chart` vs `c-accent` (VA1)

SSOT tokenów: `--c-*` CSS variables w `src/index.css` (`:root` light + `.dark`),
zmapowane w Tailwind pod namespace `c.*` (np. `bg-c-tag-1`, `text-c-chart-2`).
**Reguła nadrzędna: crimson (brand) NIGDY nie jest daną.**

| Token | Zakres | Rola | Kiedy używać |
|-------|--------|------|--------------|
| `c-accent` (crimson) | 1 | Brand / CTA / selected | Nigdy jako dana, seria ani kategoria. Crimson w danych = dług. |
| `c-success/warning/danger/info` | 4 | SYGNAŁ (status/alarm/kierunek) | Wynik/stan/trend (done, failed, blocked). Nie kategoria. |
| `c-tag-1..12` | 12 | KATEGORIA / TYP / ŹRÓDŁO — równoważne, bezkolejnościowe „kropki" | Chipy typu/tagu/źródła, kategorie osi. ≤5 serii widocznych (§15.1). |
| `c-chart-1..8` | 8 | SERIA WYKRESU — kolejność MA znaczenie (seria 1,2,3…) | Line/bar/area/pie N-serii. Blue-first, **nigdy red-first**. |
| `c-tag-foreground` | 1 | Biały tekst/ikona NA wypełnionym swatchu | `text-c-tag-foreground` na `bg-c-tag-*`/`bg-c-chart-*` (AA oba tryby). |

**Różnica c-tag vs c-chart:** `c-tag` = równoważne kropki kategorii (dowolna
kolejność, np. chipy typu). `c-chart` = uporządkowany ramp serii czytany po kolei
(seria 1 zawsze ten sam blue), dobrany pod czytelność linii/słupków i colorblind.

**Recharts / inline SVG:** `var()` NIE rozwiązuje się w `fill`/`stroke`. Rozwiązuj
hex w read-time przez `financeChartTokens.ts` / `assessmentChartTokens.ts` (wzorzec:
`readCssToken('--c-chart-N', fallback)`), re-read na flip dark/light.

**Wzorce referencyjne (VA1):**
- `src/components/MyWork/IdeaNodeDetailDrawer.tsx` — `TAG_COLORS` (crimson+alarm-red
  jako kategorie → `bg-c-tag-* text-c-tag-foreground`).
- `src/components/AIAnalyticsDashboard.tsx` — `COLORS` (crimson-first ramp →
  read-time `--c-chart-1..8`, blue-first).
