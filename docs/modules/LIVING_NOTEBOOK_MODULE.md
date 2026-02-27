# Living Notebook (T011+) — cele i sens modułu

> **Status:** Draft (wersja 0.1 — opis celu)  
> **Zakres:** Cel / sens / zasady produktu. Implementacja finalna będzie opisana osobno.  
> **Data:** 2026-02-24

---

## 1. Dlaczego ten moduł istnieje

W Consultify najcenniejsza wiedza użytkownika powstaje **zanim** zamieni się w inicjatywę, task lub decyzję:
- obserwacje z rynku i organizacji,
- hipotezy strategiczne,
- sygnały i ryzyka,
- wnioski z rozmów i analiz,
- notatki „operacyjne”, które nie są jeszcze działaniem, ale już są kierunkiem.

**Living Notebook** powstaje po to, aby ta wiedza nie ginęła ani nie była “martwą notką w szufladzie”.  
To ma być miejsce, gdzie pomysły mogą dojrzewać bez presji natychmiastowej egzekucji — ale jednocześnie **pozostają aktywne** w systemie.

---

## 2. Cel modułu (outcome, nie feature)

### Cel główny
Zbudować **żywą, stale aktualizowaną bazę wiedzy użytkownika**, która:
- wspiera myślenie strategiczne i operacyjne,
- **wraca do użytkownika** w odpowiednim momencie pracy,
- pomaga przekształcać wiedzę w działanie (gdy jest gotowa),
- nie jest odłączona od realnych zdarzeń w systemie.

### Cel praktyczny
Użytkownik ma mieć poczucie, że:
- „Notatki rosną razem ze mną”,
- „System pamięta za mnie i przypomina wtedy, gdy ma to sens”,
- „Wiedza, którą raz zapisałem, pracuje na mnie w każdym module”.

---

## 3. Co wyróżnia Living Notebook (standard rynkowy + nasza przewaga)

### Standard rynkowy (Notion / Obsidian / Tana / Mem / Reflect / Capacities)
Rynek dostarcza świetne komponenty:
- edytor blokowy i szybkie tworzenie stron (Notion),
- linkowanie i graf powiązań (Obsidian, Roam),
- strukturyzacja typów i live queries (Tana, Capacities),
- AI do auto-organizacji (Mem),
- AI do backlinków i prostoty pracy (Reflect).

### Nasza przewaga: Notebook “w treści”, nie obok treści
W Consultify notebook nie jest osobną aplikacją — jest **warstwą wiedzy** osadzoną w pracy:
- widzi kontekst projektów, inicjatyw, tasków, decyzji, KPI i ryzyk,
- widzi sygnały z Intelligence Feed,
- widzi raporty (np. Deep Thinking / Market Research) oraz rezultaty pracy AI,
- potrafi podpowiadać wiedzę **w miejscu**, gdzie użytkownik pracuje (task / initiative / chat).

To pozwala zbudować funkcję, której rynek realnie nie ma:
**notatkę, która żyje i rośnie dzięki zdarzeniom w systemie, a nie tylko dzięki ręcznej organizacji.**

---

## 4. Zasady produktu (pierwsza wersja)

### 4.1 Notebook jest dla tematów “przed-wdrożeniowych”
Living Notebook ma wspierać notatki o tematach strategicznych i operacyjnych, które:
- są ważne,
- są jeszcze niedojrzałe do wdrożenia,
- wymagają iteracji, zbierania danych, testowania hipotez,
- potrzebują “czasu” i kontekstu, aby stać się działaniem.

### 4.2 Notebook jest aktywny, ale nie agresywny
System może podpowiadać i wzbogacać, ale:
- **nie przepisywać** treści użytkownika,
- nie spamować,
- dawać pełną kontrolę: akceptuj / odrzuć / wycisz / później.

### 4.3 Notatka ma działać jak “pamięć robocza” użytkownika
Notebook ma pomagać w:
- przypominaniu kluczowych rzeczy “gdy są potrzebne”,
- łączeniu wątków między modułami,
- wykrywaniu wartościowych powiązań w systemie,
- budowaniu ciągłości myślenia (strategia ↔ operacje ↔ realizacja).

---

## 5. Jak notebook ma pracować (wizja interaktywności)

### 5.1 Smart surfaces — wiedza przychodzi do użytkownika
W momentach pracy system pokazuje “Relevant notes / ideas”, np.:
- podczas edycji taska / inicjatywy,
- w AI Chat (wstaw notatkę jako kontekst),
- przy przeglądzie sygnałów i ryzyk.

### 5.2 Living growth — notatka rośnie dzięki zdarzeniom
Jeśli w systemie pojawia się informacja, która może być cenna dla istniejącej notatki, system powinien:
- zasugerować powiązanie,
- zaproponować dopisanie kontekstu,
- wskazać, że w notatce jest luka lub pytanie warte doprecyzowania.

*(Mechanizm “Knowledge Pulse” zostanie opisany w osobnym dokumencie implementacyjnym.)*

---

## 6. Co nie jest celem (na teraz)

- budowanie pełnego “Notion databases” (rollups, views, kanban w notebooku) — to później,
- real-time collaborative editing — później,
- automatyczne modyfikowanie treści użytkownika bez kontroli — nigdy.

---

## 7. Kryterium sukcesu (proste i mierzalne)

Notebook jest sukcesem, jeśli:
- użytkownik **regularnie wraca** do notatek, bo system je sensownie podpowiada,
- notatki **realnie wpływają** na decyzje / inicjatywy / taski,
- użytkownik ma poczucie, że system “pamięta” i “łączy kropki” za niego,
- a notebook nie staje się kolejnym martwym archiwum.

