# Help Side Panel + Intro Entry Screen — Product Spec

> **Status:** PROPOSED (implementation spec)  
> **Ostatnia aktualizacja:** 2026-03-06  
> **Powiązany standard:** `02-components/help-intro-standard.md`  
> **Referencyjna implementacja dziś:** `src/components/Help/HelpSidePanel.tsx`

## Cel

Przełożyć standard `Help + Intro` na **konkretny układ komponentów, sekcji, stanów i zachowań**.

Ten dokument opisuje:

- docelowy `HelpSidePanel`,
- docelowy `Intro entry screen`,
- relację między `Help`, `Intro`, `Knowledge`, `FAQ` i `Ask AI`,
- zasady kiedy co pokazujemy,
- minimalny kontrakt implementacyjny.

---

## 1. Rola obu powierzchni

### `Intro entry screen`

To jest **lekki ekran wejściowy**, który wyjaśnia:

- jak czytać Consultify,
- jak wygląda mapa pracy,
- od czego zacząć.

To nie jest onboarding wizard.

### `HelpSidePanel`

To jest **kontekstowy panel roboczy**, który odpowiada na pytanie:

- po co jest ten ekran,
- co mam tu zrobić,
- na co uważać,
- co zrobić dalej,
- czy AI może mi pomóc teraz.

---

## 2. Architektura doświadczenia

Kolejność warstw jest stała:

1. `Intro entry screen` — orientacja globalna
2. `HelpSidePanel > This Step` — orientacja lokalna
3. `HelpSidePanel > Quick Guides / FAQ / Knowledge` — wejście w szczegóły
4. `Ask AI` — wsparcie interpretacji i następnego kroku

### Reguła

- `Intro` tłumaczy **system**
- `Help` tłumaczy **miejsce pracy**
- `AI` pomaga wykonać **następny krok**

---

## 3. Help Side Panel — układ docelowy

## 3.1 Anatomia panelu

Panel boczny ma 4 warstwy:

1. **Header**
2. **Tab bar**
3. **Scrollable content**
4. **Sticky footer / action area** (opcjonalnie)

### Header

Header zawsze zawiera:

- ikonę / symbol obszaru,
- nazwę bieżącego miejsca,
- krótki subtitle typu:
  - `This screen`
  - `Current step`
  - `Help`
- przycisk zamknięcia.

### Tab bar

Docelowa kolejność tabów:

1. `Overview`
2. `This Step`
3. `Quick Guides`
4. `FAQ`
5. `Knowledge`
6. `Updates`

**MUST:** ta kolejność jest stała.

### Content

Content jest scrollowalny i zbudowany z małych bloków typu:

- `SectionCard`
- `GuideCard`
- `Quiet callout`
- `FAQ accordion`
- `Knowledge list`

### Footer

Footer pokazujemy tylko, jeśli ma sens:

- `Ask AI`
- `Open full article`
- `Go to next step`

**MUST NOT:** footer nie może być ciężkim panelem CTA.

---

## 3.2 Tab `Overview`

### Cel

Tab `Overview` służy do zrozumienia:

- gdzie jestem w systemie,
- jak ten ekran wpisuje się w większy flow,
- jaki jest jego związek z mapą pracy.

### Zawartość

Kolejność sekcji:

1. **Current place summary**
2. **Where this sits in the journey**
3. **Related modules / cards**
4. **Optional short video**
5. **Ask AI**

### Copy scope

- 1 krótki lead
- maks. 3 małe karty kontekstowe
- 1 delikatny blok `What comes next`

### Kiedy używać

- przy wejściu do nowego modułu,
- gdy user chce zrozumieć kontekst,
- jako spokojny punkt orientacyjny.

---

## 3.3 Tab `This Step`

### Cel

To jest **najważniejszy tab** panelu help.

Ma odpowiadać na bieżącą pracę usera tu i teraz.

### Zawartość obowiązkowa

Kolejność sekcji:

1. **Po co jest ten ekran**
2. **Co tu robisz**
3. **Na co uważać**
4. **Co dalej**
5. **Ask AI now**

### Docelowy układ bloków

#### Block 1: `What this is`

- 1 krótki akapit
- bez żargonu technicznego

#### Block 2: `What you do here`

- 2–4 punkty
- każdy punkt = 1 konkretna czynność / decyzja

#### Block 3: `What to watch out for`

- 1–3 punkty
- tylko realne ryzyka lub typowe błędy

#### Block 4: `What comes next`

- 1 krótkie zdanie
- powinno prowadzić do kolejnego miejsca lub działania

#### Block 5: `Ask AI now`

- 1 spokojny button
- 1 kontekstowy prompt

### Reguła

Jeżeli user ma przeczytać tylko jedną zakładkę helpa, ma to być `This Step`.

---

## 3.4 Tab `Quick Guides`

### Cel

Dać krótkie wejścia w temat bez otwierania pełnej wiedzy.

### Format

Każdy guide card zawiera:

- tytuł,
- 1–2 zdania opisu,
- opcjonalną ikonę,
- klik do:
  - knowledge article,
  - konkretnego modułu,
  - video,
  - flow pomocniczego.

### Reguły

- `Quick Guides` to nie artykuły
- maksimum 4–6 guide cards na ekran
- guide ma prowadzić do działania albo doczytania

---

## 3.5 Tab `FAQ`

### Cel

Obsłużyć pytania, które user zadaje dopiero wtedy, gdy czegoś nie rozumie lub coś go blokuje.

### Format

- accordion
- małe pytania
- krótkie odpowiedzi
- bez ścian tekstu

### Reguła

`FAQ` nie może być pierwszą warstwą helpa.

---

## 3.6 Tab `Knowledge`

### Cel

Dawać dostęp do głębszej wiedzy i pełniejszych artykułów.

### Struktura

Widok bazowy:

- title
- krótkie intro
- lista artykułów

Widok artykułu:

- back
- tytuł
- body
- opcjonalne linki powiązane

### Reguła

Knowledge jest warstwą `deep dive`, nie pierwszym punktem wejścia.

---

## 3.7 Tab `Updates`

### Cel

Komunikować zmiany produktu, ale bez mieszania tego z helpem operacyjnym.

### Reguła

- `Updates` są osobnym torem
- nie mogą zasłaniać `This Step`
- nie mogą być głośniejsze niż kontekstowa pomoc

---

## 4. Intro Entry Screen — spec

## 4.1 Rola

To jest ekran „Jak działa Consultify”.

Powinien być dostępny:

- przy pierwszym wejściu,
- z poziomu helpa,
- z poziomu osobnego entrypointa typu `How it works`.

---

## 4.2 Układ ekranu

Intro entry screen ma 5 sekcji:

1. **Hero / Welcome**
2. **Map of work**
3. **Support modules**
4. **How Help + AI work**
5. **Start CTA**

### Sekcja 1: Hero / Welcome

Zawiera:

- tytuł: `How Consultify works`
- 1 krótki lead
- 3 CTA:
  - `Show me the system`
  - `I’ll start on my own`
  - `Ask AI where to begin`

### Sekcja 2: Map of work

Pokazuje 5 etapów:

1. `Interview`
2. `Tools + Assessments`
3. `Initiatives`
4. `Execution`
5. `Results`

Każda karta:

- nazwa etapu
- 1 zdanie
- opcjonalna ikona

### Sekcja 3: Support modules

Pokazuje 4 moduły wspierające:

- `My Work`
- `Ideas / Workplace / Notes`
- `Finance`
- `Reports / Presentations`

Format:

- 4 lekkie karty
- bez ciężkiego opisu

### Sekcja 4: How Help + AI work

Krótki blok:

- `Help explains where you are`
- `AI helps you make the next move`

### Sekcja 5: Start CTA

Docelowo pokazujemy jeden z 3 kierunków:

- `Go to Interview`
- `Open My Work`
- `Ask AI where I should begin`

---

## 4.3 Zachowanie intro

### Kiedy pokazać automatycznie

Dozwolone:

- first login / first session
- po dużym przeprojektowaniu systemu
- gdy user sam kliknie `How it works`

### Kiedy nie pokazywać automatycznie

- po każdej zmianie modułu
- po każdym logowaniu
- po każdej aktualizacji produktu

### Dismiss behavior

User musi móc:

- zamknąć intro od razu,
- wrócić do niego później,
- nie być zmuszanym do przechodzenia kolejnych kroków.

---

## 5. Entry points — skąd user wchodzi

## 5.1 Intro entry points

Dozwolone wejścia:

- `How it works`
- first-session welcome card
- link z help overview

## 5.2 Help entry points

Dozwolone wejścia:

- globalny przycisk help
- contextual help button
- empty state CTA
- error recovery hint

## 5.3 Ask AI entry points

Dozwolone wejścia:

- `Ask AI now` w `This Step`
- `Ask AI where to begin` w `Intro`
- `Ask AI to review this screen` na screenach administracyjnych / analitycznych

---

## 6. Stany i zachowania

## 6.1 Empty state

Jeśli ekran jest pusty:

- help powinien wyjaśnić, co tu powstanie,
- intro nie powinno się otwierać automatycznie zamiast helpa,
- `Ask AI` może pomóc zacząć.

## 6.2 First-time state

Przy pierwszym wejściu:

- preferowane `Intro entry screen` albo lekka karta welcome,
- nie pełen guided tour.

## 6.3 Expert state

Jeśli user jest aktywny i wracający:

- help ma być obecny, ale cichy,
- bez auto-open, chyba że ekran jest nowy albo ryzykowny.

## 6.4 Risky action state

Jeśli ekran zawiera zmianę wysokiego ryzyka:

- `This Step` ma pokazać `Na co uważać`,
- micro-help może się pojawić inline,
- AI może pomóc przygotować checklistę, ale nie przejmuje decyzji.

---

## 7. Kontrakt komponentowy

## 7.1 `HelpSidePanel`

Powinien obsłużyć:

- `document`
- `nextDocument`
- `promptAction`
- `guides`
- `faqs`
- `knowledgeModule`
- `updates`

### Minimalny kontrakt sekcyjny

Każdy `document` musi mieć:

- `title`
- `summary`
- `whatThisIs`
- `whatYouDoHere`
- `howAiHelpsHere`
- `whatComesNext`
- `askAiNow`

---

## 7.2 `Intro entry screen`

Powinien obsłużyć:

- `system overview`
- `journey cards`
- `support modules`
- `AI entry`
- `primary start CTA`

---

## 8. Copy rules

### MUST

- krótkie zdania
- język operacyjny
- małe bloki
- jasny następny krok

### MUST NOT

- powtarzanie tej samej treści w 3 sekcjach
- duże akapity
- ton „sprzedażowy”
- przesadne „AI magic”

---

## 9. Wzorzec wireframe

### Help Side Panel

```text
┌──────────────────────────────┐
│ Icon  Current Place      [X] │
│ Quiet subtitle               │
├──────────────────────────────┤
│ Overview | This Step | ...   │
├──────────────────────────────┤
│ [Po co jest ten ekran]       │
│ krótki akapit                │
│                              │
│ [Co tu robisz]               │
│ • ...                        │
│ • ...                        │
│ • ...                        │
│                              │
│ [Na co uważać]               │
│ • ...                        │
│                              │
│ [Co dalej]                   │
│ jedno zdanie                 │
│                              │
│ [Ask AI now]                 │
└──────────────────────────────┘
```

### Intro Entry Screen

```text
┌──────────────────────────────────────────────┐
│ How Consultify works                         │
│ krótki lead                                 │
│ [Show me the system] [Start on my own] [AI] │
├──────────────────────────────────────────────┤
│ 5-step journey cards                        │
├──────────────────────────────────────────────┤
│ Support modules cards                       │
├──────────────────────────────────────────────┤
│ Help explains / AI helps                    │
├──────────────────────────────────────────────┤
│ Primary start CTA                           │
└──────────────────────────────────────────────┘
```

---

## 10. Checklist implementacyjny

- [ ] Czy `This Step` jest głównym tabem roboczym helpa?
- [ ] Czy każdy ekran ma dokładnie własny kontekstowy dokument?
- [ ] Czy `Intro` tłumaczy system, a nie pojedyncze funkcje?
- [ ] Czy `Ask AI` jest dyskretne i kontekstowe?
- [ ] Czy `Knowledge` i `FAQ` są warstwą głębszą, a nie pierwszą?
- [ ] Czy można zignorować intro/help bez szkody dla flow?
- [ ] Czy nic nie otwiera się agresywnie bez dobrego powodu?

---

## 11. Rekomendacja wdrożenia

Implementować w tej kolejności:

1. uporządkować `HelpSidePanel` według tej struktury,
2. dodać `Intro entry screen`,
3. podpiąć entry points z helpa i `How it works`,
4. dopiero potem dopracować micro-help i video moments.
