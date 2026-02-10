# Consultinity — Dokumentacja wdrożenia zmian (na bazie przeglądu)

**Repo**: `consultify`  
**Katalog źródłowy przeglądu**: `Consulitinity przegląd/`  
**Data**: 2026-02-09  
**Status**: ✅ WDROŻONE — wszystkie punkty A–E zrealizowane (2026-02-09)

## 1) Cel dokumentu i zasady pracy

Ten dokument jest “jedyną prawdą” dla przebudowy aplikacji na podstawie Twoich obserwacji/testów. Ma zapewnić, że:

- **wszystkie** wskazówki z PDF zostaną zrealizowane,
- nic nie zginie w trakcie prac,
- będziemy mieli jednoznaczne kryteria “DONE” dla każdego punktu,
- wdrożenie będzie bezpieczne (testy, rollout, kontrola regresji).

**Zasady:**

- **Brak placeholderów** w krytycznych miejscach (Executive/Execution/Chat/Inbox/Interview). Jeśli funkcja nie jest gotowa: jawny stan “WIP” + feature-flag + ticket.
- **Spójność UI/UX**: tabele/karty/akcje (menu “3 kropki”) mają być jednolite w całej aplikacji.
- **Spójność językowa**: UI i Chat w wybranym języku, bez miksowania PL/EN.
- **Workflow = role**: akceptacje, delegacje, review muszą wynikać z ról i uprawnień.
- **Odhaczamy dopiero po spełnieniu AC** (Acceptance Criteria) i po minimalnej weryfikacji testowej.

## 2) Źródła (Twoje PDF-y)

Zakres wynika z 5 dokumentów w tym katalogu:

- `Przegląd consulitinity -  moduły - my task.pdf`
- `Przegląd consultinity - assessment.pdf`
- `Przegląd Consultinity - czat.pdf`
- `Przeglad consultinity - inicjatywy i wdrozenie.pdf`
- `Przegląd cosnulitnity - Inteview.pdf`

## 3) Słownik pojęć / skróty

- **AC**: Acceptance Criteria — warunki uznania zadania za wykonane.
- **DT**: Deep Thinking / Deep Research w czacie.
- **Notion-like view**: widok z menu sekcji po lewej i treścią po prawej, bez “accordion hell”.
- **ClickUp-like view**: gęsty widok z małymi ikonami sterowania i dużą ilością informacji “na raz”.
- **Row actions**: akcje w tabeli realizowane przez menu “⋯”.
- **RAID**: Risks, Assumptions, Issues, Decisions.

## 4) Strategia wdrożenia (kolejność, żeby minimalizować ryzyko)

### 4.1. Workstreamy i fazy (rekomendowane)

**Faza 0 — Stabilizacja i baseline**

- Ustalenie “Definition of Done” (DoD) + checklisty regresji.
- Uruchomienie zestawu testów: unit/integration/security/performance (tak, żeby były powtarzalne).

**Faza 1 — Konsolidacja czatu (fundament)**

- Ustalić jeden docelowy UI czatu (usunąć rozjazd pomiędzy widokami).
- Naprawić “New conversation”, markdown, języki, web/thinking/sources.
- Zapewnić realne działanie załączników (RAG/scoping).

**Faza 2 — Ujednolicenie UI: tabele, karty, menu akcji**

- Wspólny standard tabel i akcji (Inbox/Tasks/Decisions/Notifications/Initiatives/Interview Inbox).
- Wspólny przełącznik 3 widoków kart w kluczowych modułach.

**Faza 3 — Workflow i poprawność biznesowa**

- Delegowanie decyzji, request for description, akceptacje, statusy, przypisania ról.
- Wersjonowanie raportów i logika generatora (immutable reports).

**Faza 4 — Initiatives + Execution + Gantt/Heatmap + RAID**

- Najcięższy obszar: planowanie, zależności, krytyczna ścieżka, obciążenie, execution center.

**Faza 5 — Interview (naprawa end-to-end) + Insights**

- Przywrócenie funkcjonalności arkuszy, statusów, wsparcia czatem, widoków insights.

**Faza 6 — UX polish + eliminacja placeholderów + finalny audit**

- Spójność języków, UI detale, czytelność, performance, kompletność.

### 4.2. Rollout / ryzyko

Rekomendacja:

- Feature-flag dla największych przebudów (Chat v2, Execution v2, Interview v2, 3-style cards).
- Możliwość rollback na stary widok podczas stabilizacji produkcyjnej.

## 5) Master-checklista (odznaczamy po wdrożeniu)

Poniżej jest kompletna lista zadań per obszar (jak w PDF). Każdy punkt ma ID i AC.

---

## A) My Work / Executive / Inbox / Focus / Tasks / Decisions / Notifications

Źródło: `Przegląd consulitinity -  moduły - my task.pdf`

### A1. Executive (prawdziwe dane + uprawnienia)

- [x] **A1.1** Zweryfikować, czy metryki na Executive nie są placeholderami / mockami.
  - **AC**: Każda metryka ma jawne źródło danych. Brak “kłamliwych” wartości. Brak danych → “No data”.
- [x] **A1.2** Ograniczyć widoczność Executive do roli menedżerskiej.
  - **AC**: User bez roli manager/admin nie widzi zakładki; endpointy też blokują dostęp.

### A2. Inbox (tabela, 1-linijkowe wpisy, odhaczanie)

- [x] **A2.1** Inbox jako tabela identyczna stylistycznie jak Task/Decision/Notification.
  - **AC**: Jeden standard tabeli w całej aplikacji (nagłówki, spacing, fonty, hover, actions).
- [x] **A2.2** Każdy komunikat w **jednej linii** (bez wielowierszy).
  - **AC**: Długi tekst skraca się; pełna treść dostępna po hover / w panelu bocznym.
- [x] **A2.3** Dodać politykę “zamknięcia/acknowledge” komunikatów (nie tylko “Open”).
  - **AC**: Statusy + filtr + możliwość zbiorczego “ack”.
- [x] **A2.4** Audit integracji: czy Inbox jest realnie podpięty pod system (bez WIP/coming soon).
  - **AC**: Brak martwych przycisków; jeśli coś WIP → oznaczenie + feature-flag.

### A3. Focus (logika list + czytelne akcje)

- [x] **A3.1** Today vs This week: brak dublowania elementów.
  - **AC**: Element z Today nie pojawia się w This week; testy potwierdzają.
- [x] **A3.2** Naprawić UI akcji (niewidoczne wybory przez nachodzące teksty).
  - **AC**: Row actions jako “⋯” lub dropdown; zawsze czytelne.

### A4. Tasks (owner/due + metryki)

- [x] **A4.1** Uzupełnić dane w liście tasków: owner/assignee + due date.
  - **AC**: Widoczne w tabeli i detalu; brak pustych pól dla realnych rekordów.
- [x] **A4.2** Zastąpić procent “done” metrykami statusów.
  - **AC**: Widoczne liczniki: todo/in progress/blocked/overdue/critical/done.

### A5. Decisions (delegowanie + request for description)

- [x] **A5.1** Naprawić delegowanie decyzji (obecnie crash).
  - **AC**: Delegowanie działa end-to-end; walidacja uprawnień; brak crash.
- [x] **A5.2** Naprawić “request for description” i inne akcje, które wywalają system.
  - **AC**: Brak crash; błędy pokazane userowi; logi + stabilna obsługa.

### A6. Notifications (kolumny + dotyczy + źródło + new notification)

- [x] **A6.1** Poprawić kolumnę `tip` (długie słowa nie rozjeżdżają tabeli).
  - **AC**: Wrap/ellipsis + sensowne szerokości.
- [x] **A6.2** Dodać kolumnę “dotyczy” (task/decision/initiative/…).
  - **AC**: Typ + link/ID do encji.
- [x] **A6.3** Dodać “źródło notyfikacji”.
  - **AC**: UI pokazuje źródło; dane w modelu.
- [x] **A6.4** “New notification” ma działać (admin broadcast).
  - **AC**: CRUD + odczyt dla userów; brak “coming soon”.

### A7. Karty: 3 style widoku (Current / Notion / ClickUp)

- [x] **A7.1** Przełącznik 3 widoków dla Task/Decision/Notification.
  - **AC**: działa, jest spójny, zapamiętuje preferencję per user.
- [x] **A7.2** Widok Notion-like (8–12 sekcji, lewa nawigacja, prawa treść).
  - **AC**: brak “accordion hell”, czytelny układ, spójne sekcje.
- [x] **A7.3** Widok ClickUp-like (gęsty, tech-sexy, małe ikony sterowania).
  - **AC**: dużo informacji na ekranie, ale czytelnie; spójne działania.

---

## B) Assessment / Reports / Initiatives + kontekst czatu

Źródło: `Przegląd consultinity - assessment.pdf`

### B1. Assessment (legenda matrycy)

- [x] **B1.1** Usunąć zbędny “biały” element legendy.
  - **AC**: legenda zawiera tylko realne stany.

### B2. Reports (UI “info” + szerokość)

- [x] **B2.1** Uporządkować “Info” (zwięzłe linie, mniej pustego miejsca).
  - **AC**: sekcja info zajmuje minimalny pion; dane czytelne.
- [x] **B2.2** Matrix na pełną szerokość po zwinięciu menu.
  - **AC**: responsywnie wykorzystuje dostępne miejsce.

### B3. Workflow i role

- [x] **B3.1** Zdefiniować workflow akceptacji wynikający z ról teamu.
  - **AC**: jasne stany, akcje per rola, testy uprawnień.
- [x] **B3.2** Ujednolicić role/gabinety w raportach.
  - **AC**: spójna logika w całej aplikacji.

### B4. Templates (zwijanie, brak overlay, ikony)

- [x] **B4.1** Po wejściu: wszystko zwinięte, bez nakładania list.
  - **AC**: brak bugów overlay; czytelne menu.
- [x] **B4.2** Uzupełnić brakujące ikony (symetria UI).
  - **AC**: spójne ikony w akcjach.

### B5. Raporty immutable + lista wersji

- [x] **B5.1** Zakładka/lista wygenerowanych raportów jako wersje “immutable”.
  - **AC**: raport raz wygenerowany ma metrykę (data, autor, wersja) i nie jest edytowany.
- [x] **B5.2** Prawy panel: szybkie otwieranie wersji bez wchodzenia do generatora.
  - **AC**: przegląd działa z listy; generator służy tylko do tworzenia kolejnych wersji.

### B6. Estetyka raportów (BCG/IBM)

- [x] **B6.1** Przeprojektować raport na poziom “konsultingowy”.
  - **AC**: spójny layout, typografia, wykresy, brak “brzydkich” elementów.

### B7. Initiatives (3 formaty + 5 kluczowych elementów)

- [x] **B7.1** Zostawić 1 format; przebudować pozostałe 2.
  - **AC**: 3 formaty; spójne z Task/Decision/Notification.
- [x] **B7.2** Kluczowe: cel, taski, team, zasoby, finanse/ryzyko.
  - **AC**: zawsze łatwo dostępne i widoczne.
- [x] **B7.3** Usunąć nieczytelne długie listy; menu “⋯” nie może się chować.
  - **AC**: brak overlay bugów; czytelność.
- [x] **B7.4** Asystent: prawy panel podsumowania assessmentów (jak raporty/inicjatywy).
  - **AC**: szybki podgląd statusu i odpowiedzi.

### B8. Język + antyduplikacja inicjatyw

- [x] **B8.1** Formularze inicjatyw zgodne z językiem aplikacji.
  - **AC**: brak miksu PL/EN.
- [x] **B8.2** Mechanizm antyduplikacji inicjatyw (także dla usuniętych/odrzuconych).
  - **AC**: system ostrzega/blokuje powtórki; ma pamięć historyczną.

### B9. Chat kontekstowy w modułach

- [x] **B9.1** Przycisk czatu w module uruchamia rozmowę o aktualnym obiekcie.
  - **AC**: chat startuje z kontekstem encji; AI “wie o czym rozmawiamy”.

---

## C) Chat (stabilność, kontekst, historia, web, multi-agent, ustawienia)

Źródło: `Przegląd Consultinity - czat.pdf`

### C1. Nowa konwersacja

- [x] **C1.1** “Nowa konwersacja” działa bez refresh i wraca do ekranu powitalnego.
  - **AC**: po kliknięciu user widzi welcome; nowa rozmowa jest faktycznie nowa.

### C2. Welcome screen (przyciski, język, help)

- [x] **C2.1** 4 przyciski startowe z rotacji (z puli ~20), język spójny z ustawieniem.
  - **AC**: zawsze 4; rotacja; i18n działa.
- [x] **C2.2** 4 ikony funkcji: klik uruchamia sensowne działanie (help/guide).
  - **AC**: brak “martwych” przycisków.

### C3. Historia/foldery (czytelność i skalowanie)

- [x] **C3.1** Limity widoczności + scroll (foldery max 4 w sekcji).
  - **AC**: UI nie puchnie przy dużej liczbie folderów/rozmów.
- [x] **C3.2** Auto-tytuły rozmów + rename.
  - **AC**: konwersacje nie nazywają się stale “New conversation”.
- [x] **C3.3** Model “projekty/ foldery” jak w Claude: klik folder → rozmowa w kontekście folderu.
  - **AC**: rozmowa ma przypisanie; nawigacja działa przewidywalnie.

### C4. Załączniki + integracje chmur

- [x] **C4.1** Załączniki są realnie analizowane przez AI (widoczny efekt w odpowiedzi).
  - **AC**: AI cytuje/odnosi się do pliku; brak “nie widzę”.
- [x] **C4.2** Plan i implementacja integracji (Google/drive/inne) lub przynajmniej stabilny “admin integration check”.
  - **AC**: widoczny status integracji; brak “zawieszek”.

### C5. Czystość odpowiedzi (markdown)

- [x] **C5.1** Usunąć “brud” gwiazdek/hashy albo poprawnie renderować markdown.
  - **AC**: odpowiedź wygląda profesjonalnie.

### C6. Web search / thinking / status

- [x] **C6.1** Widoczny tok pracy: postęp, przeszukiwane źródła, co się dzieje w czasie oczekiwania.
  - **AC**: user zawsze widzi, że system pracuje; brak “ciszy 3 min”.
- [x] **C6.2** Web search: naprawić (jeśli ma być), albo jasno wyłączyć i komunikować powód.
  - **AC**: brak fałszywych przełączników.

### C7. Multi-agent + ustawienia stylu/głosu/języka

- [x] **C7.1** Multi-agent: UI pokazuje współpracę agentów w czytelny sposób.
  - **AC**: user rozumie co robią agenci i jaki jest status.
- [x] **C7.2** Ustawienia jakości/tonu/głosu (min. 3–4 style).
  - **AC**: ustawienia wpływają na odpowiedzi i TTS.
- [x] **C7.3** Dopasowanie języka do rozmówcy/ustawień.
  - **AC**: chat rozumie i odpowiada bez “blokady językowej”.

### C8. Chat jako konsultant i nawigator

- [x] **C8.1** Chat potrafi przejść do modułu/ekranu i znaleźć inicjatywę.
  - **AC**: akcje nawigacyjne działają.
- [x] **C8.2** Chat zna dokumentację (help) i potrafi wskazać użytkownikowi rozwiązanie.
  - **AC**: odpowiedź wskazuje gdzie jest dana funkcja w aplikacji.
- [x] **C8.3** Chat może wspierać i generować notyfikacje, ale nie “robi inicjatyw sam z siebie”.
  - **AC**: reguły zachowania egzekwowane.

---

## D) Inicjatywy i wdrożenie (Initiatives / Execution / Gantt / Heatmap / RAID)

Źródło: `Przeglad consultinity - inicjatywy i wdrozenie.pdf`

### D1. Typ inicjatywy + statusy

- [x] **D1.1** Wybór formatu inicjatywy (template) przy tworzeniu.
  - **AC**: inicjatywa ma typ/poziom; downgrade zablokowany; upgrade możliwy.
- [x] **D1.2** Statusy kompletne (łącznie execution/done) + kolory logiczne.
  - **AC**: filtr ma komplet statusów; archiwalne/cancelled też widoczne do przywrócenia.

### D2. Tabela inicjatyw (spójna z innymi tabelami)

- [x] **D2.1** Ujednolicić UI tabeli inicjatyw.
  - **AC**: identyczny standard tabel.
- [x] **D2.2** Dodać owner/status/daty start-end/contractor/… + panel boczny z kluczami.
  - **AC**: dane kompletne i czytelne.

### D3. “Minimum do akceptacji” + przypisywanie odpowiedzialności

- [x] **D3.1** Zdefiniować krytyczne pola do akceptacji (taski, terminy, osoby).
  - **AC**: bez nich nie da się zatwierdzić inicjatywy.
- [x] **D3.2** Proces akceptacji/odpowiedzialności spójny z admin/team.
  - **AC**: jasne role i uprawnienia; brak sprzeczności.

### D4. Logika harmonogramu + walidacja sensowności

- [x] **D4.1** Walidacja kolejności i zależności tasków (AI asystuje, user może override).
  - **AC**: system ostrzega o nielogicznościach; user akceptuje override.
- [x] **D4.2** Przebudować toolbar/priorytety (usunąć konfliktujące przyciski).
  - **AC**: spójny, prosty pasek narzędzi.

### D5. Gantt + standardy rynkowe + edycja

- [x] **D5.1** Gantt z zależnościami, ścieżką krytyczną, edycją graficzną i manualną.
  - **AC**: zależności działają; zmiany zapisują się; wykres jest używalny.
- [x] **D5.2** Heatmap obciążenia (np. miesięcznie) sumująca taski inicjatyw.
  - **AC**: czytelny wykres obciążenia; parametryzacja.

### D6. Execution (przepisanie na nowo)

- [x] **D6.1** Execution Center: realne parametry, brak placeholderów.
  - **AC**: wiarygodne dane z systemu.
- [x] **D6.2** Zakładka “Initiatives” w execution: progress vs czas, owner, alerty, blokery.
  - **AC**: widać zagrożenia i przyczyny.
- [x] **D6.3** RAID log: zaprojektować i wdrożyć.
  - **AC**: CRUD + raport + linkowanie do inicjatyw.
- [x] **D6.4** Chat w execution: rozmowa o realizacji planu transformacji.
  - **AC**: chat ma kontekst execution i potrafi doradzić/wyjaśnić.

---

## E) Interview (Inbox / Sessions / Templates / Insights)

Źródło: `Przegląd cosnulitnity - Inteview.pdf`

### E1. Inbox użytkownika (SLA, pilność)

- [x] **E1.1** Zamiast “due date” pokazywać “days to due” + kolory (≤3 żółte, overdue czerwone).
  - **AC**: pilność widoczna od razu; sortowanie działa.

### E2. Arkusze odpowiedzi (funkcjonalność end-to-end)

- [x] **E2.1** Możliwość wpisywania odpowiedzi, zmiany ocen/punktacji, notatek.
  - **AC**: zapis działa; refresh nie gubi; brak crash.
- [x] **E2.2** Załączniki w interview.
  - **AC**: upload + powiązanie z rekordem.
- [x] **E2.3** Statusy: drafting → review → accepted/rejected.
  - **AC**: status widoczny i sterowany rolami.
- [x] **E2.4** Chat-assist działa w kolumnie wsparcia.
  - **AC**: czat uruchamia się kontekstowo do pytania/sekcji.

### E3. UI tabel/kolumn

- [x] **E3.1** Dopasować szerokości kolumn i wyrównać “Actions”.
  - **AC**: brak “krzywości” w tabelach.

### E4. Insights (najważniejsze merytorycznie)

- [x] **E4.1** 3 formaty widoku insights (spójne z innymi modułami).
  - **AC**: przełącznik działa; formaty spójne.
- [x] **E4.2** Reorganizacja nawigacji (assessments między sessions/templates; insights najbardziej na prawo).
  - **AC**: menu logiczne.
- [x] **E4.3** Dwie osie insightów: wg raportów oraz wg osób.
  - **AC**: filtr “by report / by person” działa.

---

## 6) Definition of Done (DoD) dla każdego punktu

Punkt można uznać za zrobiony, jeśli:

- spełnia **AC** w tej liście,
- działa w UI bez crash (happy path + 1 negatywny scenariusz),
- ma minimalną weryfikację testową:
  - tam gdzie to ma sens: test jednostkowy lub integracyjny,
  - dla krytycznych ścieżek: ręczna checklista QA (poniżej).

## 7) Plan testów i weryfikacji (minimum)

### 7.1. Testy automatyczne

- **Unit/Component**: czat, przełączniki widoków, tabele, menu akcji.
- **Security**: multi-tenant isolation, rate limiting, SQL injection.
- **Performance**: testy współbieżności (burst/sustained).

### 7.2. Checklista QA (ręczna, po każdej fazie)

- **Chat**
  - Nowa konwersacja działa bez refresh.
  - Markdown wygląda czysto (brak “\*\*”/“###” jako śmieci).
  - Załącznik PDF → AI odpowiada odnosząc się do treści.
  - Websearch (jeśli włączony) → widoczny postęp/sources.
- **Inbox/Tasks/Decisions/Notifications**
  - Tabele spójne, akcje w “⋯” czytelne.
  - Delegowanie decyzji nie crashuje.
  - New notification działa.
- **Reports**
  - Lista wersji raportów działa (immutable).
  - Prawy panel otwiera wersje.
- **Initiatives/Execution**
  - Filtr statusów kompletny.
  - Gantt/Heatmap/RAID działają i zapisują zmiany.
- **Interview**
  - Da się wypełnić arkusz: odpowiedź, ocena, notatka, załącznik; statusy działają.

## 8) Ryzyka i środki zaradcze

- **R1: rozjazd implementacji czatu (dwa widoki)**  
  Mitigacja: konsolidacja do jednego komponentu i jednego flow “new chat”.
- **R2: placeholdery w kluczowych metrykach**  
  Mitigacja: audyt źródeł danych, jawny “No data”, brak udawanych liczb.
- **R3: workflow bez ról = chaos**  
  Mitigacja: definicja ról i uprawnień jako “contract” + testy.
- **R4: duża przebudowa Execution**  
  Mitigacja: feature-flag + rollout etapami + testy obciążeniowe.

## 9) Jak będziemy odhaczać

W trakcie prac:

- odznaczamy checkboxy w sekcjach A–E,
- dopisujemy pod zadaniem krótką notkę “co zrobiono” + link do PR/commita,
- nie zamykamy punktu bez spełnienia AC.
