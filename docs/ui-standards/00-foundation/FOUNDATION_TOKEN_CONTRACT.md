---
doc_kind: UI_FOUNDATION_TOKEN_CONTRACT
spec_status: APPROVED_SPEC
runtime_status: PARTIAL
owner: Piotr Wisniewski
code_owner: Frontend Platform
last_updated: 2026-08-02
authority: docs/ui-standards/CANON.md
---

# Normatywny kontrakt tokenów UI Consultify

Ten dokument rozstrzyga wartości liczbowe. Dokumenty modułowe mogą wybierać wyłącznie spośród poniższych tokenów; nie mogą definiować konkurencyjnych wartości. Każda tabela oznaczona `CODE SSOT` jest transkrypcją kodu, nie propozycją. Zmiana wartości wymaga jednoczesnej zmiany kodu SSOT, tego dokumentu i testów.

## 1. Typografia

Font aplikacji: `Inter`, fallback `ui-sans-serif, system-ui, sans-serif`. Bazowe `font-size: 16px`.

### 1.1 Tekst produktu — CODE SSOT `src/styles/typography.ts`

| Token kodu | Rozmiar | Weight / line-height | Tracking | Rola |
|---|---:|---|---:|---|
| `TEXT_L1` | 11 px | 600 | .16em, uppercase | kicker sekcji/bloku |
| `TEXT_L2` | 13 px | 600 | 0 | tytuł elementu/wiersza |
| `TEXT_L3` | 13 px | 400 / 1.6 | 0 | główna treść |
| `TEXT_L4` | 12 px | 400 | 0 | szczegół drugorzędny |
| `TEXT_L5` | 11 px | 400 | 0 | timestamp/helper |
| `TEXT_N` | 22 px | 600, tabular nums | 0 | KPI/liczba |
| `TEXT_Q` | 13 px | 400 italic / 1.65 | 0 | cytat dosłowny |

Te siedem ról jest obowiązkowe dla zawartości kart, tabel, preview i bloków. Nie wolno ich zastępować lokalnym zestawem klas Tailwind.

### 1.2 Hierarchia strony i chrome

| Token | px/rem | Weight | Line-height | Tracking | Użycie |
|---|---:|---:|---:|---:|---|
| `type-display` | 32 / 2rem | 600 | 40 px | -0.02em | hero/empty onboarding, nie ekrany robocze |
| `type-page` | 24 / 1.5rem | 600 | 32 px | -0.015em | tytuł strony lub encji |
| `type-section` | 18 / 1.125rem | 600 | 26 px | -0.01em | tytuł sekcji/panelu |
| `type-body` | 13 / .8125rem | 400 | 21 px | 0 | mapuje do `TEXT_L3` |
| `type-body-medium` | 13 / .8125rem | 600 | 18 px | 0 | mapuje do `TEXT_L2` |
| `type-compact` | 12 / .75rem | 400 | 17 px | 0 | mapuje do `TEXT_L4` |
| `type-label` | 12 / .75rem | 500 | 16 px | .01em | label, chip, pomocnicza akcja |
| `type-micro` | 11 / .6875rem | 500 | 14 px | .04em | uppercase group label, timestamp |
| `type-code` | 13 / .8125rem | 400 | 20 px | 0 | kod, identyfikator, formuła |

Tekst jednoliniowy domyślnie `truncate` tylko w kolumnach z ustaloną szerokością i zawsze ma tooltip/accessible full name. Tytuł rekordu: maksymalnie 2 linie. Opis: maksymalnie 3 linie w preview; pełny tekst w detail. Nie stosujemy rozmiaru poniżej 11 px.

## 2. Spacing

Dozwolona skala: `space-1=4`, `2=8`, `3=12`, `4=16`, `5=20`, `6=24`, `8=32`, `10=40`, `12=48` px.

| Relacja | Token |
|---|---:|
| ikona–etykieta | 8 px |
| elementy w zwartej grupie | 4–8 px |
| kontrolki w toolbarze | 8 px |
| pola formularza | 16 px |
| grupy formularza | 24 px |
| sekcje panelu | 24 px |
| główne sekcje treści | 32 px |
| padding strony roboczej | 24 px; przy 1024–1279: 16 px |
| padding karty | 16 px compact, 24 px default |
| padding drawer/modal | 24 px |

## 3. Wymiary kontrolek

| Element | Wysokość | Uwagi |
|---|---:|---|
| button/input/select default | 36 px | hit target 36×36 desktop |
| compact control | 32 px | tylko gęsty toolbar; minimum WCAG spacing |
| prominent CTA | 40 px | jedna na region |
| touch target | 44×44 px | tablet/touch |
| icon button default | 36×36 px | glyph 20 px |
| icon button compact | 32×32 px | glyph 16 px |
| chip/badge | 24 px | nie jest jedynym celem krytycznej akcji |
| tab | 36 px | underline/pill nie zmienia wysokości |
| menu item | 36 px | submenu i destructive tak samo |
| table header | 48 px | sticky dozwolony |
| table row default | 48 px | 40 px wyłącznie density compact |
| kanban card min | 96 px | padding 16 px |

## 4. Shell i regiony

| Region | Wymiar |
|---|---:|
| global App Topbar | 48 px |
| sidebar collapsed | 56 px |
| sidebar expanded | 240 px |
| module bar / Menu 2 | 48 px |
| artifact identity / Menu 1 | 60 px |
| contextual command / Menu 3 | 44 px — **DŁUG DOC↔KOD, otwarty.** Zmierzone w kodzie: `MENU_3_ROW_CLASS` (`src/components/shared/ModuleMenu3.tsx:53-54`, `px-4 py-2`) + `MENU_3_INNER_CLASS` (`min-h-8`) dają wysokość ≈48 px, nie 44 px. Rozbieżność nie jest tu rozstrzygana (ani doc→48, ani kod→44 nie jest wybrany w tym kroku); do decyzji. |
| preview listowy (SPEC-L, panel podglądu przy tabeli) | `clamp(340px, 28%, 480px)` |
| prawy panel właściwości / drawer artefaktu i formularza (SPEC-A) | 360 px domyślnie, zakres 320–420 px |
| form drawer wide | 420 px |
| modal small/medium/large | 480 / 640 / 800 px max-width |
| reading column | 760 px max-width |
| wide record workspace | 1152 px max-width |
| tooltip | 320 px max-width |
| popover/menu | 320 px max-width; menu min 200 px |
| overlay viewport clearance | 12 px |

**Preview listowy** i **prawy panel/drawer SPEC-A** są dwiema RÓŻNYMI powierzchniami i mają prawo mieć różne wymiary — dotychczasowe sklejenie tych wierszy w jeden był źródłem pozornej sprzeczności z `TRIADA_KANON.md` §C9. Preview listowy: `clamp(340px, 28%, 480px)` — CODE SSOT `src/components/shared/TableWithPreviewLayout.tsx:437,455` (kanoniczny orkiestrator, 28 referencji); zgodne z `TRIADA_KANON.md` §C9. Prawy panel/drawer SPEC-A: 360 px domyślnie / 320–420 px zakres, zmierzone w `src/components/Presentations/DeckBuilder/DeckBuilder.tsx:1483,1820` (`w-[360px] min-w-[320px] max-w-[420px]`) oraz w komponentach komentarzy/AI panelu (`w-[360px]` stały, np. `NodeCommentThread.tsx:228`, `AIConsultantPanel.tsx:268`); `ArtifactRightPanel.tsx` używa domyślnie 320 px przez `--ntype-right-panel-width` (`src/index.css:84`) — mieści się w zadeklarowanym zakresie 320–420 px, nie jest sprzecznością. **Dług osobny, nieobjęty tą rewizją:** `src/components/MyWork/MyProjects.tsx:864,1084` ma bespoke `<aside className="w-[420px]">` omijający oba SSOT — do migracji na `TableWithPreviewLayout`/`ArtifactRightPanel`.

## 5. Ikony

Lucide: `strokeWidth=1.75`; dla 12–16 px dopuszczalne `2`.

| Rola | Glyph | Hit target |
|---|---:|---:|
| micro/status | 12 px | nieinteraktywna |
| table/menu/input | 16 px | 32–36 px |
| toolbar/default | 20 px | 36 px |
| prominent/empty | 24 px | 44 px lub nieinteraktywna |
| illustrative | 32–48 px | nieinteraktywna |

## 6. Radius, border, elevation

| Token | Wartość | Użycie |
|---|---:|---|
| `radius-hig-xs` / `radius-token-xs` | 6 px | mały chip/inline |
| `radius-hig-sm` / `radius-token-sm` | 8 px | input, button, menu item |
| `radius-hig-md` / `radius-token-md` | 12 px | karta/panel/preview; global `--radius` |
| `radius-hig-lg` / `radius-token-lg` | 16 px | modal/floating panel |
| `radius-hig-xl` / `radius-token-xl` | 20 px | duża powierzchnia |
| `radius-hig-2xl` | 24 px | wyjątkowa duża powierzchnia |
| `radius-hig-3xl` | 28 px | wyłącznie hero/marketing |
| `radius-full` / `radius-token-pill` | 9999 px | badge/segmented pill |
| `border-subtle` | 1 px | table row/divider/input |
| `elevation-0` | none | content card |
| `elevation-1` light | `0 4px 6px rgba(0,0,0,.04), 0 2px 4px rgba(0,0,0,.06)` | sticky/selected |
| `elevation-2` light | `0 8px 16px rgba(0,0,0,.08), 0 4px 8px rgba(0,0,0,.06)` | menu/popover |
| `elevation-3` light | `0 25px 50px rgba(0,0,0,.08), 0 12px 24px rgba(0,0,0,.06)` | modal/drawer |
| `elevation-1` dark | `0 4px 6px rgba(0,0,0,.25), 0 2px 4px rgba(0,0,0,.30)` | sticky/selected |
| `elevation-2` dark | `0 8px 16px rgba(0,0,0,.40), 0 4px 8px rgba(0,0,0,.30)` | menu/popover |
| `elevation-3` dark | `0 20px 25px rgba(0,0,0,.35), 0 10px 10px rgba(0,0,0,.25)` | modal/drawer |

Content card: surface + spacing; border tylko gdy powierzchnia nie zapewnia kontrastu. Overlay: border-subtle + elevation jest dozwolony. Zakaz dotyczy dekoracyjnego łączenia mocnego borderu z cieniem, nie technicznego hairline na overlayu.

## 7. Kolor i kontrast

SSOT wartości: `src/index.css`, `tailwind.config.js`, `color-system.md`. Zatwierdzone wartości bazowe:

| Semantyka | Light | Dark |
|---|---|---|
| background / surface / raised | `#fafaf9` / `#ffffff` / `#f8fafc` | `#0a0f1e` / `#0f172a` / `#15213b` |
| text / secondary / muted | `#0f172a` / `#475569` / `#64748b` | `#f4f7fb` / `#b8c4d6` / `#8a99b0` |
| border subtle / default / strong | `#e6e9ed` / `#cbd2da` / `#9aa6b5` | `rgba(148,163,184,.12)` / `.22` / `.36` |
| accent (`primary`) | `#85182f` | `#c8324a` |
| focus (`--c-focus` / `--c-focus-solid`) | `#2563eb` | `#5b8def` |
| success / warning / danger | `#026833` / `#ae6429` / `#e80538` | `#3fb950` / `#e8a33d` / `#ed5565` |
| info (`--c-info`) | `#3b2883` | `#58a6ff` |
| AI (`--c-ai`) | `#6d28d9` | `#a78bfa` |

### 7.1 CENTRAL REMAP — rodziny Tailwinda przepięte na paletę HBS

**Fakt nieznany dotąd żadnemu dokumentowi fundamentu.** `tailwind.config.js:418-663` zawiera blok oznaczony w kodzie komentarzem **„CENTRAL REMAP"** (nagłówek: „arbitrary Tailwind accent families → Harvard hues. Re-points Tailwind defaults so existing class-sites recolor with ZERO call-site edits"). Blok nadpisuje domyślne (stockowe) skale ośmiu rodzin kolorów Tailwinda customową paletą HBS (Harvard). Struktura neutralna (`slate/gray/zinc/neutral/stone`) i marka (`crimson`, `primary`, `navy`) NIE są objęte — komentarz w kodzie to potwierdza wprost („NOT remapped").

**Konsekwencja:** w tym projekcie klasa `bg-violet-500`, `text-blue-800`, `border-emerald-200` itd. **nie renderuje standardowego koloru Tailwinda** — renderuje odpowiednik z palety HBS poniżej. Każda tabela w innych dokumentach (`color-system.md`, `light-mode-readability.md`, `TABLE_AND_PREVIEW_CANON.md`), która posługuje się nazwami rodzin Tailwinda, jest bez tej wiedzy nieczytelna poprawnie. Narracja „fiolet jest martwy" jest częściowo myląca: fiolet zniknął jako `primary` (`tailwind.config.js:198-199`, „Was violet #7C3AED"), ale nadal renderuje się na ekranie pod zremapowanymi nazwami `violet`/`indigo`/`purple`.

CODE SSOT: `tailwind.config.js:418-663`.

| Rodzina Tailwinda (klasa) | Cel remapu (komentarz w kodzie) | `-500` w tym projekcie | `-700` w tym projekcie |
|---|---|---:|---:|
| `indigo` | HBS Purple | `#80408D` | `#57116A` |
| `violet` | HBS Purple | `#80408D` | `#57116A` |
| `purple` | HBS Purple | `#80408D` | `#57116A` |
| `fuchsia` | HBS Magenta | `#C9006B` | `#78244C` |
| `pink` | HBS Magenta | `#C9006B` | `#78244C` |
| `blue` | HBS Blue | `#6578B4` | `#3B2883` |
| `sky` | HBS Blue | `#6578B4` | `#3B2883` |
| `emerald` | HBS Green | `#52A52E` | `#026833` |
| `green` | HBS Green | `#52A52E` | `#026833` |
| `lime` | HBS Green | `#52A52E` | `#026833` |
| `teal` | HBS Teal | `#00979D` | `#006085` |
| `cyan` | HBS Teal | `#00979D` | `#006085` |
| `amber` | HBS Orange | `#E87D1E` | `#AE6429` |
| `orange` | HBS Orange | `#E87D1E` | `#AE6429` |
| `yellow` | HBS Gold | `#EBCD00` | `#C29D00` |
| `rose` | HBS Red | `#E80538` | `#910A28` |
| `red` | HBS Red | `#E80538` | `#910A28` |

Pełna skala `50`–`950` per rodzina jest w `tailwind.config.js:418-663`; powyżej wypisane `-500`/`-700` jako reprezentatywne stopnie (najczęściej używane w `bg-*-500`, `text-*-700`). Rodziny współdzielące jeden cel remapu (np. `indigo`/`violet`/`purple`) mają identyczną skalę — to nie błąd, to zamierzone przekierowanie trzech nazw Tailwinda na jedną paletę HBS.

**Jawna reguła interpretacji.** Wszędzie, gdzie dokumentacja UI Consultify (w tym ten dokument, `color-system.md`, `light-mode-readability.md`, `TABLE_AND_PREVIEW_CANON.md`) używa nazwy rodziny Tailwinda (`blue-500`, `emerald-100`, `violet-700`...), odczytuje to jako **wartość po CENTRAL REMAP z tabeli powyżej**, NIE jako wartość ze standardowej, publicznej palety Tailwinda. Interpretacja „to jest zwykły niebieski/fiolet/zieleń Tailwinda" jest błędna dla każdej z ośmiu zremapowanych rodzin.

**Zalecenie dla nowego kodu:** unikać nazw rodzin Tailwinda (`bg-blue-500`, `text-violet-700`...) jako źródła prawdy o kolorze — w tym projekcie te nazwy są mylące (nazwa sugeruje jeden kolor, ekran pokazuje inny). Preferować tokeny `--c-*` (`bg-c-info`, `text-c-success`...) lub jawnie nazwane skale marki (`crimson`, `primary`), których znaczenie nie jest przesłonięte remapem.

### 7.2 `--c-info` — nota faktograficzna (nie „niebieski")

Dokumenty w całym zbiorze nazywają `--c-info` po prostu „niebieskim". To nieprecyzyjne. Fakty z kodu:

- **Pochodzenie:** `src/index.css:104` — `--c-info: #3b2883;` z komentarzem w kodzie **„was #2563eb — HBS Blue 1"**. Nazwa źródłowa to paleta HBS, nie standardowy niebieski. Dark: `src/index.css:304` — `--c-info: #58a6ff;` komentarz „was #aac8eb (powder blue)".
- **Percepcja koloru (light):** `#3b2883`, hue ≈252° — czyta się jako **ciemny indygo/fiolet**, blisko martwego tokenu `primary` sprzed CENTRAL RECOLOR (`#7C3AED`, hue ≈262°, `tailwind.config.js:199` „Was violet"). To NIE jest klasyczny niebieski.
- **Zbieżność ze §7.1:** `#3b2883` pokrywa się dokładnie (co do wielkości liter) z hexem zremapowanego `blue-700`/`sky-700` (HBS Blue) w tabeli §7.1 — prawdopodobne pochodzenie liczby.
- **Prawdziwy niebieski w tym systemie to inny, osobny token:** `--c-focus-solid` (`src/index.css:72`) `#2563eb`, hue ≈221° — dokładnie ten hex, który komentarz przy `--c-info` (light) podaje jako „was". `--c-info` **NIE jest** tym samym tokenem co `--c-focus-solid` i nie wolno ich mylić w opisie ani w kodzie (§7 wyżej: „Fokus NIGDY nie dziedziczy koloru akcentu" — analogicznie fokus nie dziedziczy koloru info).
- **Light vs dark niespójne w hue:** light `#3b2883` czyta się jako indygo/fiolet, dark `#58a6ff` czyta się jako jasny niebieski — te dwa tryby motywu dziś NIE reprezentują tego samego odcienia dla tej samej semantyki.

**PYTANIE OTWARTE DO DECYZJI PIOTRA:** czy `--c-info` (light `#3b2883`) ma pozostać ciemnym indygo, czy zostać skorygowany bliżej klasycznego niebieskiego (np. bliżej `--c-focus-solid` lub bliżej dark-mode `#58a6ff`) — to jest decyzja wizualna właściciela produktu, nie redakcyjna poprawka tego dokumentu. Wartość tokenu **nie jest tu zmieniana**; zgodnie z regułą #7 CLAUDE.md odbiór wizualny wymaga zrzutu, nie opisu.

`accent` i `focus` są osobnymi tokenami z osobnymi wierszami tabeli od tej rewizji — dawne sklejenie ich w jeden wiersz „accent / focus" i zdanie „aktywny focus/link" niżej były źródłem błędu opisanego poniżej. **Fokus NIGDY nie dziedziczy koloru akcentu.**

Użycie jest stałe:

- `primary`/accent: WYŁĄCZNIE znak marki (logo, kicker brandowy) i semantyka destrukcyjna wymagająca crimson; NIE fokus, NIE stan aktywny, NIE zaznaczenie, NIE link;
- fokus: WYŁĄCZNIE `--c-focus` / `--c-focus-solid` (niebieski, `#2563eb` light / `#5b8def` dark); kanoniczny wzorzec klas: `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus`;
- stan aktywny / zaznaczony: neutralny, `--state-selected` (`src/index.css:224`), nie kolor marki;
- `info`: zaznaczenie i neutralna informacja;
- `success`: wykonane/zdrowe;
- `warning`: ryzyko/oczekiwanie wymagające uwagi;
- `danger`: błąd/destrukcja/alarm;
- neutral: chrome, dane, inactive.

**Zmierzony dług runtime (2026-08-02):** `grep -rl "ring-primary-500" src/ | wc -l` → **119 plików** (246 wystąpień, `grep -ro`) używają crimson jako pierścienia fokusa — to jest dokładnie błąd, który `TRIADA_KANON.md` zakazuje jako naruszenie blokujące odbiór (pkt czekowania #38/#39/#43); `tailwind.config.js:204` dokumentuje `primary-*` jako „Harvard Crimson (CENTRAL RECOLOR LEVER)", więc każdy `ring-primary-500` renderuje dziś fokus jako crimson. Dla porównania `grep -rl "ring-c-focus" src/ | wc -l` → **259 plików** (690 wystąpień) już używają poprawnego tokenu — więcej niż plików z błędem, ale 119 plików pozostają niezgodne. (Nota: wcześniejszy szacunek „~3 pliki" dla `ring-c-focus` nie potwierdził się przy grepie i nie jest tu powielany — patrz §11.) Dokumentacja w tym paragrafie jest już poprawna; kod nie jest. To jest zmierzony dług do migracji, nie wariant do zaakceptowania.

Mapowanie lifecycle w runtime (`src/constants/statusColors.ts`, `STATUS_STYLES`) — poniżej realne klucze z pliku, nie przybliżenie: alarm czerwony wyłącznie `BLOCKED`, `REJECTED` (kompletna lista); success `DONE`, `COMPLETED`, `APPROVED`, `ACTIVE`, `UTILIZED`, `TRACKING`; info `IN_PROGRESS`, `EXECUTING`, `SCHEDULED`, `GENERATING`, `PROMOTED`; warning `PENDING`, `PENDING_REVIEW`, `PENDING_APPROVAL`, `AWAITING_APPROVAL`, `IN_REVIEW`, `REVIEW`, `PLANNING`, `ESCALATED`; neutral `DRAFT`, `CANCELLED`, `ARCHIVED`, `FINAL`, `DEFAULT`. **Poprawka doc↔kod (2026-08-02):** wcześniejsza rewizja podawała dla warning klucze `WAITING`/`AT_RISK` — te klucze **nie istnieją** w `statusColors.ts` (`grep -n "WAITING\|AT_RISK" src/constants/statusColors.ts` → brak wyników); realny klucz dla „oczekuje na akceptację" to `AWAITING_APPROVAL`. Priorytet jest cichym tekstem z kropką, nie wypełnionym alarmowym chipem. Nie wolno mapować statusów po lokalnym stringu koloru.

Tekst zwykły: kontrast minimum 4.5:1; tekst duży minimum 3:1; kontrolka, focus i znacząca grafika minimum 3:1. Informacja nigdy wyłącznie kolorem. Wszystkie zatwierdzone pary light/dark muszą mieć automatyczny test kontrastu.

## 8. Z-index i portale

| Token | z-index |
|---|---:|
| canvas/local content | 10 |
| sticky/app chrome | 20 |
| dropdown/popover/tooltip | 40 |
| overlay/drawer/sheet | 50 |
| modal/backdrop | 60 |
| toast | 100 |
| context menu | 120 |

Overlay renderuje przez portal do `body`. Nested overlay używa warstwy semantycznej, nigdy `z-[9999]`.

## 9. Motion

| Zdarzenie | Czas | Easing |
|---|---:|---|
| hover/focus/color | `--motion-fast: 120ms` | `--motion-ease: cubic-bezier(0.4,0,0.2,1)` |
| menu/popover | `--motion-base: 180ms` | `--motion-ease` |
| drawer/modal/layout | `--motion-slow: 220ms` max | `--motion-ease` |

Zero bounce/spring jako default. `prefers-reduced-motion`: bez przesunięcia i skalowania; opacity maksymalnie 80 ms albo natychmiast.

## 10. Viewport, zoom i reflow

- referencje desktop: 1920, 1600, 1440, 1280 px;
- 1024 px: compact shell, overflow kontrolowany, żadna krytyczna akcja nie znika;
- 125%: obowiązkowy visual regression;
- 200%: pełna obsługa bez nakładania i utraty funkcji;
- 400%/320 CSS px: treść liniowa ma reflow; złożone tabele/canvas mogą przewijać się w dwóch osiach, ale oferują alternatywny list/detail;
- mobile nie jest zakresem obecnego MVP, lecz semantyka i DOM nie mogą uniemożliwiać przyszłego fallbacku.

## 11. Reguła konfliktu i kontrola dryfu

Ten dokument wygrywa w sprawach wartości liczbowych. Jeśli starszy dokument podaje inną wartość, jest to dług do migracji, nie dozwolony wariant. Review sprawdza co najmniej `src/index.css`, `tailwind.config.js`, `src/styles/typography.ts` i `src/constants/statusColors.ts`. Każda rozbieżność doc↔kod blokuje akceptację; nie wolno arbitralnie uznać jednej wartości za „wystarczająco podobną”.

Rozbieżności zmierzone i nierozstrzygnięte (np. Menu 3 §4, `ring-primary-500` §7) trafiają do rejestru delt doc↔kod `docs/ui-standards/_DOC_CODE_DELTA_REGISTER.md` z liczbą naruszeń i wskazaniem pliku; nie wolno ich usuwać z tego dokumentu przez ciche wybranie „ładniejszej" wartości ani przez pominięcie w kolejnej rewizji.

---

**Nota rewizji 2026-08-02.** Audyt wykazał, że dokument sam łamał własne §11 w trzech miejscach: (1) §4 sklejał preview listowy (SPEC-L) i prawy panel/drawer SPEC-A w jeden wiersz, co dawało pozorny konflikt z `TRIADA_KANON.md` §C9 — rozdzielone na dwa wiersze, oba zweryfikowane greppem; (2) §4 Menu 3 podawał 44 px bez adnotacji o zmierzonych w kodzie ≈48 px (`MENU_3_ROW_CLASS`) — dodana jawna nota o otwartym długu, bez rozstrzygania w tym kroku; (3) §7 sklejał `accent`/`focus` w jeden wiersz i sugerował „primary = aktywny focus", co w praktyce (przez `tailwind.config.js` `primary-*` = crimson) uzasadniało błąd „focus = crimson" w 119 plikach (`ring-primary-500`) — `accent` i `focus` rozdzielone na osobne wiersze i osobne zasady użycia, z jawną notą o zmierzonej skali długu. §1.1 (siedem ról typografii) zweryfikowane wobec `src/styles/typography.ts` — zgodne, bez zmian. `runtime_status` pozostaje `PARTIAL`.

**Nota rewizji 2026-08-02 (panel adwersaryjny).** Panel adwersaryjny wykazał, że dokument nie znał bloku **CENTRAL REMAP** (`tailwind.config.js:418-663`), który przepina osiem rodzin kolorów Tailwinda (`indigo/violet/purple`, `fuchsia/pink`, `blue/sky`, `emerald/green/lime`, `teal/cyan`, `amber/orange`, `yellow`, `rose/red`) na paletę HBS — bez tej wiedzy dziesiątki tabel w `color-system.md`, `light-mode-readability.md` i `TABLE_AND_PREVIEW_CANON.md` operujących nazwami rodzin Tailwinda są nieczytelne poprawnie. Dodany §7.1 (tabela remapu, jawna reguła interpretacji, zalecenie preferowania tokenów `--c-*`). Dodany §7.2: `--c-info` opisany faktograficznie (pochodzenie HBS Blue 1, hue ≈252° = ciemny indygo, nie klasyczny niebieski; `--c-focus-solid` `#2563eb` to osobny, prawdziwie niebieski token) — korekta wizualna oznaczona jako **pytanie otwarte do decyzji Piotra**, wartość tokenu nie zmieniona. §7 (K-34): mapowanie statusów poprawione — klucze `WAITING`/`AT_RISK` nie istnieją w `src/constants/statusColors.ts` (zweryfikowano greppem), realny klucz to `AWAITING_APPROVAL`; wypisano pełne, realne listy kluczy dla wszystkich pięciu kubełków. Wiersz „info / AI" (sklejone dwa różne tokeny bez etykiety) rozbity na dwa osobne wiersze tabeli. Pełny przegląd §7 i §1.1 wobec `src/index.css`/`src/styles/typography.ts`: wszystkie pozostałe hexy i role typografii — zgodne, bez dalszych zmian. `runtime_status` pozostaje `PARTIAL`.
