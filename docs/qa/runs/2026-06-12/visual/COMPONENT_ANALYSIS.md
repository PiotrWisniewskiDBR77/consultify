# Analiza komponentów — Consultify Visual Audit 2026-06-12

**Podstawa:** Faza 1 (~35 ss) + Faza 1b component sweep (~35 ss)  
**Cel:** Inwentaryzacja wariantów + identyfikacja niespójności → wejście do VISUAL_STANDARD.md  
**Łączna liczba ss:** ~70  

---

## Podsumowanie wykonawcze

- **Łączna liczba przeanalizowanych kategorii komponentów:** 9 (BTN, BADGE, INPUT, CARD, TABLE, NAV, TYPE, OVERLAY, SPECIAL)
- **Wariantów komponentów skatalogowanych:** ~45 unikalnych
- **Komponenty spójne (jeden wariant, jeden styl):** 3 (Lucide ikony, Progress bar, Avatar tabeli)
- **Komponenty z niespójnościami:** 11
- **Komponenty wymagające decyzji właściciela:** 7

### Top 5 najpoważniejszych problemów

1. **Brak spójnego primary color** — "New Decision" (pomarańczowy), "Assign" (gradient czerwony), "New Notebook" (fioletowy), "Save Changes" (malinowy) to cztery różne kolory dla akcji "wykonaj główną operację modułu".
2. **Focus ring = Error ring** — `outline: rgb(200,50,74)` jest identyczny dla focus state i error state. Czerwony ring pojawia się na KAŻDYM skoncentrowanym polu — wygląda jak walidacja błędu.
3. **Modal bez backdrop** — Modal "Assign Interview" nie przyciemnia tła. Crash Error Modal ma backdrop. Dwa różne zachowania dla tej samej koncepcji.
4. **Status badges: tekst-only vs. colored bg** — Status "Open" w Filter Pills (pomarańczowe tło) vs. "Open" w tabeli (inne tło) vs. "Submitted"/"Assigned" (szare tło, tylko kropka). Trzy wzorce dla "status item".
5. **Input styles 3-wariantowe** — Settings input (bg 50% opacity, border-radius 6px, 16px), DocStudio input (bg solid, border-radius 8px, 14px), Modal dropdown (bg 4% opacity, border-radius 12px, 14px). Ta sama semantyczna funkcja — trzy różne implementacje CSS.

---

## Paleta kolorów — wyekstrahowana z całości

| Token (propozycja) | Wartość hex/rgba | Gdzie używany |
|--------------------|-----------------|---------------|
| accent-primary | `rgb(168,45,73)` = `#a82d49` | Export DOCX btn, Save Changes btn, Input focus gradient, sidebar active tab |
| accent-primary-dark | `rgb(133,24,47)` = `#85182f` | Gradient end w Assign btn, logo 77 |
| accent-primary-10 | `rgba(168,45,73,0.1)` | Approve bg-light, Teresa badge bg, active tab Interview |
| accent-danger | `rgb(232,5,56)` = `#e80538` | Notification bubble, Reject bg-light, stop button |
| accent-warning-orange | `rgb(232,125,30)` = `#e87d1e` | Escalate, New Decision btn, beta badge bg |
| accent-warning-amber | `rgb(234,155,32)` = `#ea9b20` | Beta badge text, amber status |
| accent-success | `rgb(82,165,46)` = `#52a52e` | Approve bg-light, "1 sources" green |
| accent-lime | `rgb(158,196,77)` = `#9ec44d` | Progress bar fill (100%) |
| accent-purple | `rgb(124,58,237)` = `#7C3AED` (estymacja) | New notebook btn, fioletowe btn-primary |
| bg-base | `rgb(10,15,30)` = `#0a0f1e` | Główne tło aplikacji |
| bg-card | `rgb(15,23,42)` = `#0f172a` | Modal tło, input bg, Document Studio |
| bg-card-light | `rgb(21,33,59)` = `#15213b` | Avatar tło, status badge tło, row hover |
| border-base | `rgb(42,54,85)` = `#2a3655` | Borders, input borders, dividers |
| border-subtle | `rgba(255,255,255,0.08)` | Subtelne bordery kart, ikony |
| text-primary | `rgb(255,255,255)` | Tytuły, headings, active states |
| text-secondary | `rgb(203,213,225)` | Nieaktywne taby, opisy |
| text-muted | `rgb(148,163,184)` | Placeholder, disabled, avatary |
| text-dim | `rgb(100,116,139)` | Bardzo muted — sekcje, ikony nieaktywne |

**PROBLEM kolorystyczny:**  
`accent-primary (#a82d49)` jest używany semantycznie dla RÓŻNYCH znaczeń:
- Focus ring inputów (= neutralne UX)
- Primary action buttons (= wykonaj akcję)
- Aktywny tab w Interview (= current location)
- "TERESA" branding badge
- Tekst "PROMOTE" button

Jeden kolor pełni 5 ról semantycznych — to jest przeciążenie semantyczne.

---

## BTN — Przyciski

### Inwentarz wariantów

| Wariant | Kontekst | Tło | Tekst | Border-r | Border | Font-size |
|---------|----------|-----|-------|----------|--------|-----------|
| Primary-solid | Export DOCX, Save Changes | `#a82d49` | white | 8px | none | 14–16px |
| Primary-gradient | Assign modal btn | `linear-gradient(#a82d49→#85182f)` | white | 12px | none | 14px |
| Primary-orange | New Decision | `rgba(232,125,30,0.85)` | white | 9999px | subtle | 14px |
| Primary-purple | New Notebook, New Task (estymacja) | `~#7C3AED` | white | 8px | none | 14px |
| Approve | Decisions panel | `rgba(82,165,46,0.1)` | `rgb(199,230,159)` | 9999px | `rgba(82,165,46,0.3)` | 12px |
| Reject | Decisions panel | `rgba(232,5,56,0.1)` | `rgb(244,186,171)` | 9999px | `rgba(232,5,56,0.3)` | 12px |
| Escalate | Decisions panel | `rgba(232,125,30,0.1)` | `rgb(249,212,154)` | 9999px | `rgba(232,125,30,0.3)` | 12px |
| Neutral-ghost | More info, Delegate, Remind, Snooze | `rgba(255,255,255,0.04)` | `rgb(226,232,240)` | 9999px | `rgba(255,255,255,0.06)` | 12px |
| Secondary-outline | Markdown, DOCX, PDF, Sheets Builder | transparent | `rgb(226,232,240)` | 8px | `rgb(42,54,85)` | 14px |
| Ghost/Text | Cancel, Start over, History | transparent | `rgb(148–203,...)` | 8–12px | none | 12–14px |
| Talk to Teresa | Chat CTA voice | `rgb(168,45,73)` | white | 9999px | none | 14px |

### Niespójności

- [ ] **Primary button color niespójny** — 4 różne kolory dla "głównej akcji modułu": `#a82d49`, `#e87d1e`, `#7C3AED`, gradient. Nie istnieje jeden "primary action color".
- [ ] **Border-radius niespójny** — Primary buttons: 8px (Export DOCX) vs 12px (Assign modal) vs 9999px (New Decision, Approve). Brak jednej wartości dla primary.
- [ ] **Font-size niespójny** — Approve/Reject/Escalate = 12px, New Decision = 14px, Save Changes = 16px. Trzy rozmiary w obrębie tej samej klasy akcji.
- [ ] **Brak hover/disabled stanów w DOM** — Nie udało się uchwycić hover state buttonów przez automatyzację. Potrzebna ręczna weryfikacja.

### Do decyzji właściciela

- **Primary color** — Czy każdy moduł ma celowo własny kolor primary action (branding modułowy), czy ma być jeden globalny? Rekomendacja: jeden `#a82d49` + ewentualnie moduł-specific accent jako border/dot (nie jako btn fill).
- **Pill vs. Rectangle** — Decyzja panel Decisions używa pill (`border-radius: 9999px`), reszta aplikacji używa `8px`. Czy Decisions jest wyjątkiem, czy ma być standard?

---

## BADGE — Statusy i chips

### Inwentarz wariantów

| Etykieta | Kontekst | Tło | Tekst | Border-r | Rozmiar |
|----------|----------|-----|-------|----------|---------|
| Submitted | Interview table | `rgb(21,33,59)` | `rgb(148,163,184)` | 9999px | 11px, h:24px |
| Assigned | Interview table | `rgb(21,33,59)` | `rgb(148,163,184)` | 9999px | 11px, h:24px |
| Open | My Work (filter pill) | `rgba(168,45,73,0.3)` | `rgb(246,184,190)` | 9999px | 10px |
| Open | My Work (table badge) | `rgba(232,125,30,0.15)` | `rgb(247,199,107)` | 9999px | 11px |
| Critical | My Work (urgency) | `rgba(232,5,56,0.15)` | `rgb(224,178,167)` | 9999px | 11px |
| Beta | Sidebar expanded | `rgba(232,125,30,0.1)` | `rgb(234,155,32)` | 4px | 10px |
| 15 (notif) | Header global | `rgb(232,5,56)` | white | 9999px | 10px |
| Filter pills | My Work, Interview | `rgba(168,45,73,0.3)` / `rgb(42,54,85)` | różne | 9999px | 10px |

### Niespójności

- [ ] **"Open" ma dwie reprezentacje** — Filter pill (rgba(168,45,73,0.3)) vs. table badge (rgba(232,125,30,0.15)). To samo słowo, dwa różne kolory.
- [ ] **Submitted vs. Assigned nierozróżnialne** — Oba mają identyczny styl. Różnią się tylko kolorem kropki. Przy szybkim skanie tabeli trudno odróżnić.
- [ ] **Niespójny border-radius** — Beta badge: 4px. Wszystkie inne: 9999px. Beta wygląda jak "tag" a nie "pill".
- [ ] **Brak "Done"/"Approved"/"Completed" badge** — W tabeli Interview nie widać "Approved" status. Jeśli istnieje — nie sfotografowano.

### Do decyzji właściciela

- Czy `Submitted` i `Assigned` mają mieć ten sam kolor tła? Jeśli tak — tylko kropka różnicuje. Czy to wystarczy?
- Czy beta badge powinien mieć `border-radius: 4px` (tag) czy `border-radius: 9999px` (pill) jak reszta?

---

## INPUT — Pola formularzy

### Inwentarz wariantów

| Typ | Kontekst | Tło | Border | Border-r | Font-size | Focus |
|-----|----------|-----|--------|----------|-----------|-------|
| Text input | Settings Profile | `rgba(10,15,30,0.5)` | `1px solid #2a3655` | 6px | 16px | red ring `#c8324a` |
| Text input | Document Studio | `rgb(15,23,42)` | `1px solid #2a3655` | 8px | 14px | red ring `#c8324a` |
| Textarea | Document Studio | `rgb(15,23,42)` | `1px solid #2a3655` | 8px | 14px | red ring `#c8324a` |
| Native select | Document Studio | `rgb(15,23,42)` | `1px solid #2a3655` | 8px | 14px | red ring (error-like) |
| Custom dropdown | Modal Assign Interview | `rgba(255,255,255,0.04)` | `rgba(255,255,255,0.08)` | 12px | 14px | N/D |
| Custom dropdown | Settings Pronouns/Dept | custom styled | — | ~8px | 16px | N/D |
| Checkbox | Document Studio | natywny | — | — | — | systemowy |

### Niespójności

- [ ] **Trzy różne background colors** — `rgba(10,15,30,0.5)` (Settings), `rgb(15,23,42)` (DocStudio), `rgba(255,255,255,0.04)` (Modal). Wszystkie wyglądają ciemno na ekranie, ale są technicznie inne.
- [ ] **Trzy różne border-radius** — 6px (Settings), 8px (DocStudio), 12px (modal dropdown).
- [ ] **Focus ring = Error ring** — `rgb(200,50,74)` jest używany jako focus state. W większości design systemów czerwień = błąd. To powoduje niepotrzebne alarmy kognitywne przy normalnym używaniu formularzy.
- [ ] **Native select vs. custom dropdown** — DocStudio używa `<select>` z OS appearance. Modal używa custom dropdown. Niespójne UX.
- [ ] **Checkbox systemowy** — Uncustomized `accent-color: auto`. Na macOS = systemowy niebieski. Niezgodne z dark theme.

### Do decyzji właściciela

- Focus color: pozostawić czerwony (spójny z branding) czy zmienić na niebieski/biały (neutral, nie mylący)?
- Native `<select>` w DocStudio: zostaje (native scroll) czy wymienić na custom dropdown?

---

## CARD — Karty

### Inwentarz wariantów

| Typ karty | Moduł | Tło | Border-r | Border | Padding | Hover |
|-----------|-------|-----|----------|--------|---------|-------|
| Kanban card (Initiatives) | Initiatives | `~rgb(17,25,50)` | ~8px | `rgba(255,255,255,0.08)` | ~12px | subtelne rozjaśnienie |
| Context tile (Chat home) | Chat | ciemne | ~8px | subtelny | ~12px | N/D |
| Teresa panel | sidebar | ciemne | ~8px | brak widocznego | ~12px | N/D |

### Niespójności

- [ ] **Brak zestandaryzowanych kart treści** — Insight cards, Decision cards, Task cards nie były widoczne jako standalone karty (tylko w tabelach). Nie ma widoku kafelkowego dla tych danych.
- [ ] **Kanban card shadow** — Nie zbadano dokładnie shadow vs. flat.

### Do decyzji właściciela

- Czy planowane są widoki kafelkowe (grid) dla Tasks/Decisions/Insights? Jeśli tak — potrzebny standard karty.

---

## TABLE — Tabele

### Inwentarz wariantów

| Element | Wartość CSS |
|---------|-------------|
| Header row background | `rgba(15,23,42,0.4)` — bardzo subtelne |
| Header cell font | `font-size: 16px` / `font-weight: 700` / `padding: 8px 12px` |
| Data row background | `rgba(255,255,255,0.03)` — prawie przeźroczyste |
| Data cell font | `font-size: 16px` / `padding: 12px` |
| Data row hover | Niewidoczny lub bardzo subtelny — PROBLEM |

### Niespójności

- [ ] **Header font-size 16px = Data font-size 16px** — Nagłówek kolumny i zawartość mają ten sam rozmiar. Wyróżnienie jedynie przez `font-weight: 700`. To może być za mało przy dużych tabelach.
- [ ] **Brak widocznego hover state** — Przy hover nad wierszem tabeli nie widać wyraźnej zmiany. Użytkownik nie wie, który wiersz jest wskazany.
- [ ] **"APPR...", "STRA..." — ucięte badże Type** — Wcześniej zidentyfikowane (VIS-008). Brak tooltipa przy hover.

---

## NAV — Nawigacja i taby

### Inwentarz wariantów

| Element | Aktywny | Nieaktywny |
|---------|---------|-----------|
| Sidebar (narrow) | `rgba(255,255,255,0.08)` bg, `rgb(241,245,249)` color, `fw:500` | transparent bg, `rgb(203,213,225)` color, `fw:400` |
| Taby Interview | `rgba(168,45,73,0.1)` bg, bottom-border rgba(168,45,73,0.4) | transparent, bottom-border `rgb(42,54,85)` |
| OUTPUT pills (Chat) | `rgb(133,24,47)` (ciemny czerwony) | transparent |
| My Work tabs (górne) | Ciemnoszare tło (estymacja) | transparent |

### Niespójności

- [ ] **Taby Interview (underline) vs. My Work tabs (pill)** — Dwa różne wzorce wizualne dla "tabów" w tej samej aplikacji.
- [ ] **Active sidebar = prawie niewidoczny indicator** — `rgba(255,255,255,0.08)` jako tło aktywnej pozycji jest bardzo subtelne. W wąskim sidebar bez etykiet bardzo trudno dostrzec.
- [ ] **Sidebar 3 stany** — narrow icons | expanded labels | hidden. Ukryty stan (third state) może być mylący dla użytkowników.

---

## TYPE — Typografia

### Skala typograficzna znaleziona w aplikacji

| Element | Font-size | Line-height | Font-weight | Kolor | Gdzie |
|---------|-----------|-------------|-------------|-------|-------|
| Display/Hero | 48px | 48px | 600 | `rgb(228,88,104)` | Chat greeting ("Piotr") |
| Logo | 20px | 28px | 600 | `rgb(168,45,73)` | Sidebar "77" |
| Body Large | 18px | 28px | 400 | `rgb(203,213,225)` | Chat subtitle |
| Body Default | 16px | 24px | 400 | `rgb(255,255,255)` | Table data, body text |
| Table Header | 16px | 24px | 700 | `rgb(255,255,255)` | Table column headers |
| Label / Tab | 14px | 20px | 400–500 | `rgb(255,255,255)` / `rgb(203,213,225)` | Taby, etykiety |
| Small | 12px | 16px | 500–600 | mix | Pills, small labels |
| XSmall | 11px | 16.5px | 400–600 | mix | Section headers, small labels |
| Micro | 10px | 15px | 400–700 | mix | Badges, notification count |

**Font family:** `Inter, sans-serif` (cała aplikacja — spójne)

### Niespójności

- [ ] **Brak H1, H2, H3 w DOM** — Aplikacja nie używa semantycznych heading tagów (`<h1>` etc.). Rozmiary wizualne nie są mapowane na HTML semantykę. Jedyne znalezione `<h3>` = 48px na /chat.
- [ ] **Body Default = Table Header** — Oba 16px. Jedyna różnica: font-weight 400 vs. 700.
- [ ] **Section headers ALL CAPS + letter-spacing** — MY SETTINGS etc. = 11px/600/`letter-spacing: 0.55px`. To dobry wzorzec, ale nie aplikowany globalnie.
- [ ] **Brak monospace** — W aplikacji doradczej może być potrzebne (kod, cytaty techniczne). Nie znaleziono monospace.
- [ ] **Line-height 48px/48px dla hero** — line-height = font-size (1.0). Standard to minimum 1.2. Dla wieloliniowych nagłówków może być zbyt ciasno.

---

## OVERLAY — Modale, toasty, dropdowny

### Inwentarz wariantów

| Element | Tło | Backdrop | Border-r | Shadow |
|---------|-----|----------|----------|--------|
| Assign Interview modal | `rgb(15,23,42)` | transparent (brak!) | 16px | `rgba(0,0,0,0.25)` |
| Crash Error modal | ciemne + red icon | prawdopodobnie `rgba(0,0,0,0.5)` | N/D | N/D |
| Tooltip (sidebar) | ciemnoszary | brak | ~4px | brak |
| Custom dropdown (otwarty) | nie zbadano otwarty stan | — | — | — |
| Toast | nieosiągalne w teście | — | — | — |

### Niespójności

- [ ] **Modal bez backdrop dimming** — "Assign Interview" nie przyciemnia tła. Użytkownik widzi aktywną aplikację za modalem. Dezorientujące.
- [ ] **Crash modal vs. feature modal** — Rozbieżność: error modal ma backdrop, funkcjonalny modal nie ma. Prawdopodobnie błąd implementacji.
- [ ] **Toast niedostępny** — Nie można potwierdzić istnienia i stylu.

### Do decyzji właściciela

- Czy backdrop dla "Assign Interview" ma być dodany? (Rekomendacja: TAK, `rgba(0,0,0,0.5)`)

---

## SPECIAL — Komponenty specjalne

### Progress bar

| Element | Wartość |
|---------|---------|
| Container | `rgba(255,255,255,0.06)` bg, `4px` height, `9999px` border-r |
| Filled (100%) | `rgb(158,196,77)` — żółto-zielony |
| Width | ~101–115px (zależnie od kolumny) |

Spójny wzorzec. Dobra widoczność przy 100%.

---

### Avatar

| Wariant | Tło | Color | Border-r | Rozmiar |
|---------|-----|-------|----------|---------|
| Table "P" | `rgb(21,33,59)` | `rgb(148,163,184)` | 9999px | 24×24px |
| Header "PW" | transparent | `rgb(148,163,184)` | 9999px | 32×32px |

Dwa warianty rozmiaru i stylu tła. Poza rozmiarem — spójny kolor tekstu.

---

### Ikony

**Biblioteka:** Lucide Icons  
**Styl:** outline (kreskowy), nie filled  
**Rozmiar typowy:** 16–20px  
**Kolor:** dziedziczy color rodzica (biały/szary zależnie od stanu)  
**Spójność:** Wysoka — Lucide jest jedną biblioteką, styl ikon jest consistent

---

## Rekomendacje priorytetowe

### Krytyczne (naprawić przed wdrożeniem standardu)

1. **Modal backdrop** — Modal "Assign Interview" nie ma backdrop dimming. Dodać `background: rgba(0,0,0,0.5)` lub `backdrop-filter: blur`. Dotyczy wszystkich modalw w aplikacji.
2. **Focus ring != Error ring** — Zmienić kolor focus ring z czerwonego `rgb(200,50,74)` na neutralny. Propozycja: `rgba(255,255,255,0.4)` lub `rgb(100,149,237)` (niebieski). Dotyczy wszystkich inputów.

### Ważne (naprawić w sprint po wdrożeniu standardu)

1. **Zunifikowanie input styles** — Stworzyć jeden komponent TextInput z ustalonymi wartościami: `bg: rgba(15,23,42,0.8)`, `border: 1px solid #2a3655`, `border-radius: 8px`, `font-size: 14px`. Zastąpić wszystkie 3 warianty.
2. **Primary action button standard** — Wybrać jeden wariant primary button dla "głównych akcji modułu": solid `#a82d49`, `border-radius: 8px` (nie pill), spójny padding. Zunifikować przez wszystkie moduły.
3. **Hover state tabeli** — Dodać wyraźny `background: rgba(255,255,255,0.05)` przy hover nad wierszem tabeli. Ułatwia skan wzrokiem.
4. **Status badge semantics** — "Submitted" i "Assigned" mają identyczne wizualne style. Jeśli są semantycznie różne stany — powinny mieć różne kolory tła.
5. **Type badges w tabelach** — "APPR...", "STRA..." są ucięte. Rozszerzyć szerokość kolumny TYPE lub dodać tooltip.

### Do decyzji właściciela

1. **Primary color per moduł vs. globalny** — Czy "New Decision" (pomarańczowy), "Assign Interview" (czerwony), "New Notebook" (fioletowy) to celowe branding per moduł, czy przypadkowe rozbieżności?
2. **Focus ring color** — Czerwony (spójny z branding accent) vs. niebieski/biały (neutralny, mniej mylący). Oba są defensible.
3. **Native vs. custom select** — DocStudio używa `<select>` natywnego. Lepsze dostępność i mniejszy maintainence, ale niespójny wygląd z custom dropdownami w modalach.
4. **Modal backdrop** — Czy backdrop ma być przezroczysty (brak) czy przyciemniony? Przezroczysty = lżejszy feel, ale slabsza separacja kontekstu.
5. **Sidebar 3-state behavior** — Czy użytkownicy potrzebują "whole hidden" state? Może 2 stany (narrow/expanded) wystarczą?
6. **Table font size** — Header = Data = 16px. Czy zwiększyć header do innego rozmiaru, czy zostawić (only weight distinguishes)?
7. **Hero text line-height** — 48px/48px = 1.0. Czy zwiększyć do 1.2 (57.6px) dla lepszej czytelności długich nazw?
