# Help + Intro — Frontend Implementation Plan

> **Status:** PROPOSED (implementation plan)  
> **Ostatnia aktualizacja:** 2026-03-06  
> **Powiązane dokumenty:**  
> `02-components/help-intro-standard.md`  
> `02-components/help-sidepanel-intro-spec.md`

## Cel

Przełożyć standard i spec na **kolejność wdrożenia frontendowego 1:1**.

Ten dokument odpowiada na pytania:

- co dokładnie zmieniamy,
- w jakich plikach,
- w jakiej kolejności,
- co jest MVP,
- co jest etapem późniejszym,
- jak sprawdzamy, że UX jest naprawdę delikatny, a nie natarczywy.

---

## 1. Zakres wdrożenia

Docelowo wdrażamy 3 warstwy:

1. **Nowy `HelpSidePanel`**
2. **Nowy `Intro entry screen`**
3. **Spójne entry points do Help + Intro + AI**

### Poza zakresem tego etapu

- pełna produkcja video onboardingów,
- rozbudowany system telemetryczny / scoring usage helpa,
- przebudowa knowledge base jako osobnego produktu,
- eksperymenty AB na intro.

---

## 2. Priorytety wdrożenia

### Priorytet 1

- uporządkować `HelpSidePanel`
- ustawić `This Step` jako główną zakładkę roboczą
- dopiąć spójne sekcje per ekran

### Priorytet 2

- wdrożyć `Intro entry screen`
- połączyć go z `How it works` i pierwszym wejściem

### Priorytet 3

- dodać delikatne entry points i stany `empty / first-time / risky`

### Priorytet 4

- dopracować micro-help i video slots

---

## 3. Mapa plików

## 3.1 Pliki istniejące do refaktoru

- `src/components/Help/HelpSidePanel.tsx`
- `src/contexts/HelpContext.tsx`
- `src/config/helpExperience.ts`
- `src/config/viewToModuleMapping.ts`
- `src/components/Help/HelpToggleButton.tsx`
- `src/views/HowItWorksPage.tsx`
- `src/layouts/MainLayout.tsx`

## 3.2 Pliki prawdopodobnie do dodania

- `src/components/Help/IntroEntryScreen.tsx`
- `src/components/Help/HelpThisStepTab.tsx`
- `src/components/Help/HelpOverviewTab.tsx`
- `src/components/Help/HelpQuickGuidesTab.tsx`
- `src/components/Help/HelpIntroLauncher.tsx`
- `src/hooks/useHelpIntro.ts`

## 3.3 Pliki opcjonalne do dodania później

- `src/components/Help/HelpMicroHint.tsx`
- `src/components/Help/HelpRiskHint.tsx`
- `src/components/Help/HelpEmptyStateHint.tsx`
- `src/components/Help/HelpVideoCard.tsx`

---

## 4. Faza 1 — Uporządkowanie `HelpSidePanel`

## Cel

Zamienić panel helpa z „wieloźródłowego draweru” w **spójny panel kontekstowy**.

## 4.1 Zmiany w UX

### Docelowy efekt

Po otwarciu helpa user widzi:

- jasny header,
- czytelną nazwę bieżącego miejsca,
- `This Step` jako najważniejszą zakładkę,
- małe bloki z odpowiedzią:
  - po co jest ten ekran,
  - co tu robię,
  - na co uważać,
  - co dalej,
  - jak AI może pomóc.

### Zmiana priorytetu tabów

Obecny stan:

- `Overview` ma wysoką rolę orientacyjną

Docelowo:

- `This Step` staje się tabem domyślnym dla złożonych ekranów roboczych,
- `Overview` zostaje jako warstwa kontekstowa,
- `FAQ` i `Knowledge` schodzą na poziom warstwy głębszej.

## 4.2 Zmiany komponentowe

### `src/components/Help/HelpSidePanel.tsx`

Rozbić komponent na sekcje / subkomponenty:

- `HelpPanelHeader`
- `HelpOverviewTab`
- `HelpThisStepTab`
- `HelpQuickGuidesTab`
- `HelpFaqTab`
- `HelpKnowledgeTab`
- `HelpUpdatesTab`

### Dlaczego

Obecny komponent jest zbyt szeroki i miesza:

- render logiki,
- sterowanie panelu,
- nawigację,
- AI kickoff,
- rendering knowledge,
- rendering FAQ.

## 4.3 Kontrakt danych

### `src/contexts/HelpContext.tsx`

Utrzymać i doprecyzować:

- `document`
- `nextDocument`
- `promptAction`
- `mapping`

### Dodać warstwę pomocniczą

Wyliczane pola UI:

- `panelTitle`
- `panelSubtitle`
- `isStepFirst`
- `showIntroEntry`
- `showVideoSlot`

To ma odciążyć `HelpSidePanel.tsx` z logiki prezentacyjnej.

## 4.4 Zadania implementacyjne

1. Wyodrębnić subkomponenty zakładek z `HelpSidePanel.tsx`.
2. Ustawić regułę domyślnego taba:
   - `This Step` dla ekranów roboczych
   - `Overview` dla wejść ogólnych / entry surfaces
3. Znormalizować strukturę sekcji:
   - `What this is`
   - `What you do here`
   - `What to watch out for`
   - `What comes next`
   - `Ask AI now`
4. Usunąć nadmiar informacji z pierwszego poziomu.
5. Zostawić `Knowledge` i `FAQ` jako warstwy głębsze.

## 4.5 Definition of done

- panel jest czytelnie podzielony na sekcje,
- `This Step` wygląda jak główna zakładka robocza,
- user w 5–10 sekund rozumie sens ekranu,
- help nie wygląda jak dokumentacja techniczna.

---

## 5. Faza 2 — Wdrożenie `Intro entry screen`

## Cel

Wprowadzić spokojny ekran „Jak działa Consultify”, który zastąpi cięższy onboarding i stanie się głównym entrypointem orientacyjnym.

## 5.1 Komponent docelowy

### Nowy komponent

`src/components/Help/IntroEntryScreen.tsx`

Komponent powinien obsłużyć:

- hero / welcome
- mapę 5 etapów journey
- 4 moduły wspierające
- blok `Help explains / AI helps`
- CTA startowe

## 5.2 Źródło treści

Treści nie powinny być trzymane lokalnie w komponencie.

Preferowany model:

- `src/config/helpExperience.ts`
  - `HELP_SYSTEM_OVERVIEW`
  - `getOverviewCards()`
  - `getOverviewGuides()`

Jeśli potrzeba więcej danych:

- rozszerzyć `helpExperience.ts`
- nie tworzyć osobnego rozproszonego configu marketingowego dla intro aplikacyjnego

## 5.3 Integracja z istniejącym `HowItWorksPage`

### Obecny stan

`src/views/HowItWorksPage.tsx` jest bardziej landingowy / marketingowy.

### Docelowy kierunek

Rozdzielić 2 role:

- `HowItWorksPage` = public / marketing / explain product
- `IntroEntryScreen` = in-app / product orientation / start working

### Reguła

Nie mieszać tonu marketingowego z tonem operacyjnym intro w aplikacji.

## 5.4 Gdzie pokazać intro

### Wejścia obowiązkowe

- first-session welcome
- link `How it works` / `Jak działa system`
- opcjonalne wejście z `HelpSidePanel > Overview`

### Miejsce integracji

- `src/layouts/MainLayout.tsx`
- `src/components/Help/HelpIntroLauncher.tsx`
- `src/hooks/useHelpIntro.ts`

## 5.5 Zadania implementacyjne

1. Dodać `IntroEntryScreen.tsx`.
2. Oprzeć go na danych z `helpExperience.ts`.
3. Dodać lekki launcher / stan otwarcia intro.
4. Podpiąć intro do:
   - first-use condition
   - menu / linku `How it works`
   - help overview entry
5. Dodać `dismiss` i możliwość powrotu.

## 5.6 Definition of done

- intro da się zamknąć od razu,
- intro tłumaczy mapę pracy bez ciężkiego flow,
- intro prowadzi do pierwszego kroku,
- intro nie wygląda jak onboarding wizard.

---

## 6. Faza 3 — Entry points i flow użytkownika

## Cel

Sprawić, że `Help`, `Intro` i `AI` są łatwe do znalezienia, ale nie walczą o uwagę.

## 6.1 Entry points do `Help`

### Utrzymać

- globalny przycisk help
- help side panel toggle

### Dodać / dopracować

- link `Jak działa system?`
- wejście z pustych stanów
- wejście z pierwszego uruchomienia

## 6.2 Entry points do `AI`

Dodać spójną logikę labeli:

- `Ask AI about this screen`
- `Zapytaj AI o ten ekran`

Lub dla bardziej operacyjnych ekranów:

- `Ask AI what to check`
- `Ask AI to review this screen`

### Reguła

AI CTA ma być:

- widoczne,
- spokojne,
- kontekstowe,
- nigdy większe niż sama sekcja helpa.

## 6.3 Flow pierwszego użycia

Docelowy flow:

1. user wchodzi do aplikacji,
2. widzi lekką kartę / intro entry,
3. wybiera:
   - `Pokaż mi system`
   - `Zacznę sam`
   - `Zapytaj AI`
4. jeśli wejdzie do modułu, help jest już kontekstowy,
5. nie pojawiają się dalsze agresywne overlaye.

---

## 7. Faza 4 — Micro-help

## Cel

Dodać subtelne wsparcie tylko tam, gdzie naprawdę pomaga.

## 7.1 Typy micro-help

### `HelpEmptyStateHint`

Do użycia w pustych stanach:

- „co tu powstanie”
- „od czego zacząć”
- opcjonalne `Ask AI`

### `HelpRiskHint`

Do użycia przy ekranach wysokiego ryzyka:

- security
- billing
- routing AI
- bulk operations

### `HelpInlineHint`

Do użycia przy złożonych kontrolkach:

- gdy nazwa kontrolki nie tłumaczy jej działania,
- gdy istnieje wysokie ryzyko błędnej interpretacji.

## 7.2 Reguły użycia

- max 1 główny micro-help block na obszar,
- bez kaskad tooltipów,
- bez automatycznego przesuwania uwagi usera.

---

## 8. Faza 5 — Cleanup treści i źródeł

## Cel

Doprowadzić do sytuacji, w której help ma jedno dominujące źródło prawdy.

## 8.1 Główne źródło

Docelowo:

- `src/config/helpExperience.ts`

## 8.2 Źródła legacy do ograniczenia

- `src/config/cardDocumentation.ts`
- `src/config/helpContent.ts`
- `src/config/moduleHelpContent.ts`
- rozproszone lokalne opisy w widokach

## 8.3 Zadania cleanupowe

1. Zredukować duplikaty opisów.
2. Wyprowadzić ekranowe copy do `helpExperience.ts`.
3. Zostawić w legacy configach tylko fallback lub most migracyjny.

---

## 9. Kolejność realizacji sprintowej

## Sprint 1 — Core Help

- rozbicie `HelpSidePanel.tsx`
- `This Step` jako główna zakładka
- uporządkowanie sekcji
- cleanup pierwszego poziomu treści

## Sprint 2 — Intro

- `IntroEntryScreen`
- launcher
- integracja z first-use i `How it works`

## Sprint 3 — Entry points + micro-help

- entry points do helpa
- entry points do AI
- puste stany
- first-use hints
- risky-action hints

## Sprint 4 — Cleanup + consistency

- cleanup źródeł treści
- copy pass
- consistency pass po modułach

---

## 10. QA / Test plan

## 10.1 Testy UX

Sprawdzić:

- czy user rozumie ekran po otwarciu `This Step`,
- czy intro daje mental model systemu,
- czy AI CTA jest pomocne, ale nie agresywne,
- czy `FAQ` i `Knowledge` nie dominują pierwszego poziomu.

## 10.2 Testy zachowania

Sprawdzić:

- otwieranie i zamykanie panelu,
- domyślny tab dla różnych ekranów,
- powrót do intro,
- działanie `Ask AI now`,
- brak konfliktu z istniejącym side panel systemem.

## 10.3 Testy jakości treści

Sprawdzić:

- długość sekcji,
- brak ścian tekstu,
- brak marketingowego tonu,
- poprawne PL / EN,
- brak duplikacji opisów.

---

## 11. Definition of done — całość

Wdrożenie uznajemy za domknięte, jeśli:

- `HelpSidePanel` działa jak kontekstowy panel roboczy,
- `This Step` jest najważniejszym źródłem orientacji,
- `Intro entry screen` tłumaczy aplikację bez ciężkiego onboardingu,
- `AI` jest pomocnikiem, nie dominującą warstwą,
- wejścia do helpa i intro są łatwe do znalezienia, ale spokojne,
- treści są krótkie, spójne i niepowtarzalne.

---

## 12. Rekomendacja wdrożenia technicznego

Najbezpieczniejsza kolejność dla zespołu:

1. najpierw refaktor `HelpSidePanel` bez zmiany całej architektury aplikacji,
2. potem osobny `IntroEntryScreen`,
3. potem entry points i stany,
4. na końcu cleanup źródeł i copy pass.

To minimalizuje ryzyko i pozwala szybko uzyskać poprawę UX bez wielkiego big-bang rewrite.
