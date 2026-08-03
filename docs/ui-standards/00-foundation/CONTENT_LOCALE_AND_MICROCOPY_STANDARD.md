---
doc_kind: CONTENT_LOCALE_MICROCOPY_STANDARD
spec_status: APPROVED_SPEC
runtime_status: PARTIAL
authority: docs/ui-standards/CANON.md
---

# Standard treści, lokalizacji i microcopy

## 1. Język i ton

UI używa jednego języka w obrębie widoku. MVP wspiera `pl-PL` i `en-US`; fallback klucza nie może pojawić się użytkownikowi. Ton: kompetentny, krótki, spokojny, bez marketingowych superlatyw i antropomorfizacji systemu. Przyciski zaczynają się czasownikiem. Nazwy domenowe są rzeczownikami. Sentence case, poza nazwami własnymi.

## 2. Taksonomia komunikatów

| Stan | Wzór |
|---|---|
| empty-first-use | co tu będzie + wartość + jedno CTA |
| empty-filtered | „Brak wyników dla…” + wyczyść filtry |
| loading | nazwa ładowanej rzeczy; po 10 s recovery |
| success | wykonany skutek, nie „Sukces!” |
| validation | co poprawić + format/ograniczenie |
| recoverable error | co się nie udało + co zachowano + retry |
| permission | czego nie można zrobić + jak uzyskać dostęp; bez wycieku danych |
| destructive confirm | czasownik + nazwa obiektu + nieodwracalny skutek |
| AI proposal | zakres, źródła, co się zmieni po akceptacji |

Zakazane: „Something went wrong”, „Invalid input”, raw enum/error/stack, blame użytkownika, fałszywa pewność AI, „Gotowe” przed read-back.

## 3. Daty, liczby i jednostki

Formatowanie wyłącznie przez `Intl`. `pl-PL`: `2 sie 2026`, przecinek dziesiętny, spacja tysięcy, `12 345,67 zł`; `en-US`: `Aug 2, 2026`, `12,345.67`, currency zgodna z danymi. Czas względny tylko dla świeżych zdarzeń i z absolutnym tooltipem. Strefa czasowa widoczna przy harmonogramach i kolizjach. Procent ma określoną precyzję; zero, brak danych i nie dotyczy są rozróżniane.

## 4. Długość i overflow

- label kontrolki: preferowane ≤24 znaki, bez skrótu zmieniającego sens;
- tytuł rekordu: do 2 linii na liście/preview, pełny accessible name;
- opis preview: do 3 linii, pełny w detail;
- toast: jedno zdanie + opcjonalna jedna akcja;
- tooltip nie zastępuje labelu i nie zawiera krytycznej procedury;
- niemiecka ekspansja 30% i polskie długie wyrazy muszą przejść pseudo-localization.

## 5. Klucze i ownership

Klucze: `surface.component.action/state`, bez pełnych zdań jako kluczy. Tekst domenowy ma ownera produktowego; systemowy — Design System. Dynamiczna nazwa obiektu jest parametrem, nigdy konkatenacją. ICU plural rules są obowiązkowe. Screen reader label może być pełniejszy niż etykieta wizualna, lecz musi oznaczać tę samą akcję.

## 6. AI

„Teresa” może być nazwą interfejsu, ale komunikat zawsze odróżnia propozycję od faktu. Pokazujemy źródła, ograniczenia i stan generowania. Przyciski: `Wygeneruj propozycję`, `Porównaj zmiany`, `Zastosuj`; nie `Napraw automatycznie`, jeśli wymagana jest decyzja. Odrzucenie nie sugeruje kary ani uczenia na prywatnej treści.

## 7. Odbiór

Każdy krytyczny flow przechodzi PL/EN, pseudo-locale, długie nazwy, plural 0/1/2/5, brak danych, 403, 409, 422, timeout i offline. Visual QA bez tego nie odbiera treści.

