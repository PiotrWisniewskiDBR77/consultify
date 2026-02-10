# 📋 Definition of Done (DoD) — Consultinity Przegląd

**Data przygotowania**: 2026-02-09  
**Źródło**: 5 dokumentów PDF z katalogu `Consulitinity przegląd/`  
**Cel**: Kompletna checklista do audytu wdrożenia zmian przez Cursor  
**Status**: 🔲 OCZEKUJE NA AUDYT

---

## Jak korzystać z tego dokumentu

- `[ ]` — nie zweryfikowane
- `[?]` — wymaga sprawdzenia (wątpliwości)
- `[x]` — zweryfikowane i zgodne z wymaganiami
- `[!]` — niezgodne / brak implementacji

Każdy punkt zawiera:

- **ID** — unikalny identyfikator
- **Wymaganie** — co ma być zrobione (z PDF źródłowego)
- **AC** — Acceptance Criteria (kryteria akceptacji)
- **Źródło** — z którego PDF pochodzi

---

## A) MY WORK / EXECUTIVE / INBOX / FOCUS / TASKS / DECISIONS / NOTIFICATIONS

> Źródło: `Przegląd consulitinity - moduły - my task.pdf`

### A1. Executive Dashboard

- [ ] **A1.1** — Metryki na Executive nie są placeholderami/mockami
  - AC: Każda metryka ma jawne źródło danych. Brak "kłamliwych" wartości. Brak danych → "No data"
  - Weryfikacja: Sprawdzić komponenty Executive, czy dane pochodzą z API, a nie z hardcoded values

- [ ] **A1.2** — Executive widoczny tylko dla roli menedżerskiej
  - AC: User bez roli manager/admin nie widzi zakładki; endpointy też blokują dostęp
  - Weryfikacja: Sprawdzić routing guard + middleware API

### A2. Inbox

- [ ] **A2.1** — Inbox jako tabela identyczna stylistycznie jak Task/Decision/Notification
  - AC: Jeden standard tabeli w całej aplikacji (nagłówki, spacing, fonty, hover, actions)
  - Weryfikacja: Porównać wizualnie Inbox vs Tasks vs Decisions vs Notifications

- [ ] **A2.2** — Każdy komunikat mieści się w jednej linii (bez wielowierszy)
  - AC: Długi tekst skraca się ellipsis; pełna treść po hover / w panelu bocznym
  - Weryfikacja: Sprawdzić CSS truncation i tooltip/side panel

- [ ] **A2.3** — Polityka "zamknięcia/acknowledge" komunikatów
  - AC: Statusy (Open/Acknowledged/Closed) + filtr + możliwość zbiorczego "ack"
  - Weryfikacja: Sprawdzić czy nie ma samych "Open" przycisków

- [ ] **A2.4** — Audit integracji inbox: realnie podpięty pod system
  - AC: Brak martwych przycisków; jeśli coś WIP → oznaczenie + feature-flag
  - Weryfikacja: Kliknąć każdy przycisk, sprawdzić czy działa

### A3. Focus

- [ ] **A3.1** — Today vs This week: brak dublowania elementów
  - AC: Element z Today nie pojawia się w This week; logika warunków filtrowania
  - Weryfikacja: Sprawdzić logikę filtrowania dat

- [ ] **A3.2** — UI akcji czytelne (nie nachodzą na siebie teksty)
  - AC: Row actions jako "⋯" menu lub dropdown; zawsze czytelne
  - Weryfikacja: Sprawdzić komponenty Focus pod kątem overlapping text

### A4. Tasks

- [ ] **A4.1** — Owner/assignee + due date widoczne w liście tasków
  - AC: Widoczne w tabeli i detalu; brak pustych pól dla realnych rekordów
  - Weryfikacja: Sprawdzić kolumny tabeli Tasks

- [ ] **A4.2** — Zamiast procentu "done" — metryki statusów
  - AC: Widoczne liczniki: todo/in progress/blocked/overdue/critical/done
  - PDF: "ile tasków czeka, ile jest done, in progress, blocked, overdue, critical — takie przyciski zostawić, ale zmniejszyć"
  - Weryfikacja: Sprawdzić czy usunięto procent done i dodano statusy

### A5. Decisions

- [ ] **A5.1** — Delegowanie decyzji działa end-to-end (bez crashu)
  - AC: Delegowanie działa; walidacja uprawnień; brak crash
  - PDF: "w czasie delegowania decyzji system się rozwalił"
  - Weryfikacja: Przetestować flow delegowania decyzji

- [ ] **A5.2** — "Request for description" i inne akcje nie wywalają systemu
  - AC: Brak crash; błędy pokazane userowi; logi + stabilna obsługa
  - Weryfikacja: Przetestować wszystkie akcje w Decisions

### A6. Notifications

- [ ] **A6.1** — Kolumna `tip` nie rozjeżdża tabeli (długie słowa)
  - AC: Wrap/ellipsis + sensowne szerokości kolumn
  - Weryfikacja: Sprawdzić CSS tabeli Notifications

- [ ] **A6.2** — Kolumna "dotyczy" (task/decision/initiative/…)
  - AC: Typ + link/ID do encji źródłowej
  - Weryfikacja: Sprawdzić czy dodano kolumnę "dotyczy"

- [ ] **A6.3** — Źródło notyfikacji widoczne
  - AC: UI pokazuje źródło; dane w modelu
  - Weryfikacja: Sprawdzić tabelę i model danych

- [ ] **A6.4** — "New notification" działa (admin broadcast)
  - AC: CRUD + odczyt dla userów; brak "coming soon"
  - PDF: "przycisk new notification pojawia się komunikat feature coming soon — nie jest podłączony"
  - Weryfikacja: Kliknąć "New notification" — czy tworzy notyfikację

### A7. Karty: 3 style widoku

- [ ] **A7.1** — Przełącznik 3 widoków dla Task/Decision/Notification
  - AC: Działa, jest spójny, zapamiętuje preferencję per user
  - PDF: "dorobimy kolejny rodzaj kart... 3 formaty"
  - Weryfikacja: Sprawdzić czy są 3 ikony przełącznika i czy działają

- [ ] **A7.2** — Widok Notion-like
  - AC: 8–12 sekcji po lewej, treść po prawej; brak "accordion hell"; czytelny układ
  - PDF: "inspirowany notion — po lewej menu, po prawej treść, nie rozwijane"
  - Weryfikacja: Sprawdzić komponent Notion-like view

- [ ] **A7.3** — Widok ClickUp-like
  - AC: Dużo informacji na ekranie ale czytelnie; małe ikony sterowania; "tech-sexy"
  - PDF: "inspirowany ClickUp — minimalizm technologiczny, gęsty widok"
  - Weryfikacja: Sprawdzić komponent ClickUp-like view

---

## B) ASSESSMENT / REPORTS / INITIATIVES + KONTEKST CZATU

> Źródło: `Przegląd consultinity - assessment.pdf`

### B1. Assessment

- [ ] **B1.1** — Usunięto zbędny "biały" element legendy matrycy
  - AC: Legenda zawiera tylko realne stany
  - Weryfikacja: Sprawdzić legendę w widoku Assessment matrix

### B2. Reports UI

- [ ] **B2.1** — Sekcja "Info" uporządkowana (zwięzłe linie, mniej pustego miejsca)
  - AC: Sekcja info zajmuje minimalny pion; dane czytelne
  - PDF: "słabe wykorzystanie górnej części raportu — w jednej linii przyciski, progress level jako link/dropdown, search jako mała ikona"
  - Weryfikacja: Sprawdzić UI górnej części raportu

- [ ] **B2.2** — Matrix na pełną szerokość po zwinięciu menu
  - AC: Responsywnie wykorzystuje dostępne miejsce
  - Weryfikacja: Zwinąć menu i sprawdzić czy matrix się rozciąga

### B3. Workflow i role

- [ ] **B3.1** — Workflow akceptacji wynikający z ról teamu
  - AC: Jasne stany, akcje per rola, testy uprawnień
  - PDF: "zarządzanie rolami i gabinetami musi być spójne"
  - Weryfikacja: Sprawdzić flow akceptacji raportów

- [ ] **B3.2** — Spójne role/gabinety w raportach
  - AC: Spójna logika w całej aplikacji
  - Weryfikacja: Porównać logikę ról across modules

### B4. Templates

- [ ] **B4.1** — Po wejściu: wszystko zwinięte, bez nakładania list
  - AC: Brak bugów overlay; czytelne menu
  - PDF: "jak widzi po rozwijaniu listy menu została na ekranie i schowała się — nakładają się na siebie"
  - Weryfikacja: Wejść w template, sprawdzić initial state

- [ ] **B4.2** — Brakujące ikony uzupełnione (symetria UI)
  - AC: Spójne ikony w akcjach (np. disable, copy, add)
  - PDF: "disable nie ma ikony, copy ma ikonę — dołóż ikonę"
  - Weryfikacja: Sprawdzić wszystkie akcje w menu template

### B5. Raporty immutable + lista wersji

- [ ] **B5.1** — Zakładka/lista wygenerowanych raportów jako wersje "immutable"
  - AC: Raport wygenerowany ma metrykę (data, autor, wersja) i nie jest edytowany
  - PDF: "każdy wygenerowany raport będzie się pokazywał w linii — chodzi o to, żebyśmy wygenerowane raporty później wywoływali... raport raz wygenerowany nie podlega dalszej edycji"
  - Weryfikacja: Zweryfikować czy raporty mają listę wersji + immutability

- [ ] **B5.2** — Prawy panel: szybkie otwieranie wersji bez wchodzenia do generatora
  - AC: Przegląd działa z listy; generator służy tylko do tworzenia kolejnych wersji
  - PDF: "w panelu powinniśmy mieć listę raportów które były wygenerowane — żebyśmy bez wchodzenia do generatora mogli sobie je otwierać"
  - Weryfikacja: Sprawdzić panel boczny raportów

### B6. Estetyka raportów

- [ ] **B6.1** — Raport na poziomie konsultingowym (BCG/IBM)
  - AC: Spójny layout, typografia, wykresy, brak "brzydkich" elementów
  - PDF: "uważam że jest nadzwyczaj brzydki... raporty na poziomie BCG albo lepsze — piękne, gustowne, eleganckie"
  - Weryfikacja: Sprawdzić wygenerowany raport wizualnie

### B7. Initiatives (3 formaty + 5 kluczowych elementów)

- [ ] **B7.1** — 3 formaty widoku inicjatyw (1 zostawiony + 2 przebudowane)
  - AC: 3 formaty; spójne z Task/Decision/Notification
  - PDF: "jeden który ma pozostaje, dwa przebudowane — inspirowane Notion i ClickUp"
  - Weryfikacja: Sprawdzić przełącznik i 3 widoki

- [ ] **B7.2** — 5 kluczowych elementów zawsze widocznych: cel, taski, team, zasoby, finanse/ryzyko
  - AC: Zawsze łatwo dostępne i widoczne w karcie inicjatywy
  - PDF: "cel, taski, team, niezbędne zasoby, analiza finansowa/ocena ryzyka — absolutnie kluczowe"
  - Weryfikacja: Sprawdzić wizualnie kartę inicjatywy

- [ ] **B7.3** — Brak nieczytelnych długich list; menu "⋯" nie chowa się pod elementami
  - AC: Brak overlay bugów; czytelność
  - PDF: "długie rozwijane listy — nieakceptowalne; 3 kropki rozwija się pod inne elementy"
  - Weryfikacja: Sprawdzić zachowanie menu kontekstowego

- [ ] **B7.4** — Asystent: prawy panel podsumowania assessmentów
  - AC: Szybki podgląd statusu i odpowiedzi w panelu bocznym
  - PDF: "chcę aby w asystencie rozwijał się z prawej strony ekran podsumowujący — jak w raportach i inicjatywach"
  - Weryfikacja: Sprawdzić prawy panel asystenta

### B8. Język + antyduplikacja

- [ ] **B8.1** — Formularze inicjatyw zgodne z językiem aplikacji
  - AC: Brak miksu PL/EN
  - PDF: "ekran do generowania inicjatywy jest po polsku mimo że aplikacja po angielsku"
  - Weryfikacja: Zmienić język na EN, sprawdzić formularz inicjatywy

- [ ] **B8.2** — Mechanizm antyduplikacji inicjatyw
  - AC: System ostrzega/blokuje powtórki; pamięć historyczna (również usunięte/odrzucone)
  - PDF: "uchronić system przed powtarzającymi się inicjatywami — także te które były i zostały usunięte"
  - Weryfikacja: Sprawdzić logikę deduplikacji

### B9. Chat kontekstowy

- [ ] **B9.1** — Przycisk czatu w module uruchamia rozmowę o aktualnym obiekcie
  - AC: Chat startuje z kontekstem encji; AI "wie o czym rozmawiamy"
  - PDF: "czat nie znał kontekstu — zadbaj aby zawsze rozumiał kontekst tego nad czym pracujemy"
  - Weryfikacja: Kliknąć chat z poziomu assessment/initiative — sprawdzić kontekst

---

## C) CHAT

> Źródło: `Przegląd Consultinity - czat.pdf`

### C1. Nowa konwersacja

- [ ] **C1.1** — "Nowa konwersacja" działa bez refresh i wraca do welcome
  - AC: Po kliknięciu user widzi welcome; nowa rozmowa jest faktycznie nowa
  - PDF: "wciśnięcie przycisku nowa konwersacja wcale nie otwiera nowej — przerzuca do ostatniej"
  - Weryfikacja: Kliknąć "New conversation" — czy tworzy się nowa

### C2. Welcome screen

- [ ] **C2.1** — 4 przyciski startowe z rotacji (~20 w puli), język spójny z ustawieniem
  - AC: Zawsze 4; rotacja; i18n działa
  - PDF: "4 duże prostokąty — deep thinking, scenario, model, quick actions — system pokazuje nowe elementy"
  - Weryfikacja: Sprawdzić welcome screen, zmienić język

- [ ] **C2.2** — 4 ikony funkcji — klik uruchamia sensowne działanie (help/guide)
  - AC: Brak "martwych" przycisków
  - PDF: "naciskając przycisk — w helpie otwiera się wyjaśnienie co to za funkcjonalność"
  - Weryfikacja: Kliknąć każdą ikonę na welcome screen

### C3. Historia/foldery

- [ ] **C3.1** — Limity widoczności + scroll (foldery max 4 na ekran)
  - AC: UI nie puchnie przy dużej liczbie folderów/rozmów
  - PDF: "jak będzie dużo folderów to tu się zacznie bałagan — ograniczenia do 4 folderów i reszta scroll"
  - Weryfikacja: Sprawdzić sidebar czatu z wieloma folderami

- [ ] **C3.2** — Auto-tytuły rozmów + rename
  - AC: Konwersacje nie nazywają się "New conversation" cały czas
  - Weryfikacja: Sprawdzić naming konwersacji

- [ ] **C3.3** — Model "projekty/foldery" jak w Claude
  - AC: Rozmowa ma przypisanie do folderu; nawigacja działa
  - Weryfikacja: Sprawdzić organizację rozmów w foldery

### C4. Załączniki + integracje

- [ ] **C4.1** — Załączniki realnie analizowane przez AI
  - AC: AI cytuje/odnosi się do pliku; brak "nie widzę"
  - PDF: "jak dodaję załącznik to czat go nie rozumie — nie jest w stanie go zinterpretować — mam wrażenie że go nie widzi"
  - Weryfikacja: Wysłać PDF do czatu, sprawdzić odpowiedź

- [ ] **C4.2** — Integracje (Google Drive/inne) lub admin integration check
  - AC: Widoczny status integracji; brak "zawieszek"
  - Weryfikacja: Sprawdzić panel integracji w adminie

### C5. Markdown

- [ ] **C5.1** — Odpowiedzi czyste markdown (bez surowych gwiazdek/hashy)
  - AC: Odpowiedź wygląda profesjonalnie
  - PDF: "gwiazdki które są wszędzie — strasznie brudzą wygląd tekstu"
  - Weryfikacja: Zadać pytanie do czatu, sprawdzić renderowanie

### C6. Web search / thinking / status

- [ ] **C6.1** — Widoczny tok pracy: postęp, źródła, co się dzieje w oczekiwaniu
  - AC: User zawsze widzi że system pracuje; brak "ciszy 3 min"
  - PDF: "mały ekranik który przesuwa sposób myślenia + jakie strony są przeszukiwane"
  - Weryfikacja: Włączyć deep thinking, sprawdzić czy widać postęp

- [ ] **C6.2** — Web search działa LUB jest jasno wyłączony z komunikatem
  - AC: Brak fałszywych przełączników
  - PDF: "mimo że w menu tools był włączony web search — brak dostępu do internetu"
  - Weryfikacja: Włączyć web search, zapytać o aktualne info

### C7. Multi-agent + ustawienia stylu/głosu/języka

- [ ] **C7.1** — Multi-agent: UI pokazuje współpracę agentów
  - AC: User rozumie co robią agenci i jaki jest status
  - PDF: "oddzielne toki rozumowania widoczne w pod-oknach"
  - Weryfikacja: Sprawdzić UI multi-agent

- [ ] **C7.2** — Ustawienia jakości/tonu/głosu (min. 3–4 style)
  - AC: Ustawienia wpływają na odpowiedzi i TTS
  - PDF: "gdzieś musimy te ustawienia zrobić — głos męski/żeński, formalny/normalny/wesoły"
  - Weryfikacja: Sprawdzić panel ustawień głosu/stylu

- [ ] **C7.3** — Dopasowanie języka do rozmówcy
  - AC: Chat rozumie i odpowiada bez "blokady językowej"
  - PDF: "jeśli zacznę mówić po angielsku a ustawiony po polsku — nie zrozumie"
  - Weryfikacja: Zmienić język w trakcie rozmowy

### C8. Chat jako konsultant i nawigator

- [ ] **C8.1** — Chat potrafi przejść do modułu/ekranu i znaleźć inicjatywę
  - AC: Akcje nawigacyjne działają (przenosi do execution/initiatives)
  - Weryfikacja: Poprosić czat o nawigację do modułu

- [ ] **C8.2** — Chat zna dokumentację (help) i wskazuje rozwiązanie
  - AC: Odpowiedź wskazuje gdzie jest dana funkcja w aplikacji
  - Weryfikacja: Zapytać "jak stworzyć inicjatywę?"

- [ ] **C8.3** — Chat wspiera/generuje notyfikacje ale NIE tworzy inicjatyw sam z siebie
  - AC: Reguły zachowania egzekwowane
  - Weryfikacja: Sprawdzić ograniczenia akcji czatu

### C9. Feedback (dodatkowe z PDF)

- [ ] **C9.1** — Feedback negatywny dopytuje co było złe
  - AC: Po thumbs down → pytanie "co się nie spodobało?"
  - PDF: "feedback negatywny nie dopytuje co było dobre/złe"
  - Weryfikacja: Kliknąć thumbs down i sprawdzić dialog

- [ ] **C9.2** — Głośnik w prawym górnym rogu kontroluje TTS
  - AC: Klik → odczyt głosowy odpowiedzi ON/OFF
  - Weryfikacja: Sprawdzić funkcjonalność ikony głośnika

---

## D) INICJATYWY I WDROŻENIE (EXECUTION / GANTT / HEATMAP / RAID)

> Źródło: `Przeglad consultinity - inicjatywy i wdrozenie.pdf`

### D1. Typ inicjatywy + statusy

- [ ] **D1.1** — Wybór formatu inicjatywy (template) przy tworzeniu
  - AC: Inicjatywa ma typ/poziom; downgrade zablokowany; upgrade możliwy
  - Weryfikacja: Sprawdzić formularz tworzenia inicjatywy

- [ ] **D1.2** — Statusy kompletne: draft → approved → scheduled → execution → done + cancelled/archived
  - AC: Filtr ma komplet statusów; archiwalne/cancelled też widoczne do przywrócenia
  - PDF: "nie ma statusu scheduled... nie ma execution... nie ma done"
  - Weryfikacja: Sprawdzić dropdown/filtr statusów

### D2. Tabela inicjatyw

- [ ] **D2.1** — UI tabeli inicjatyw spójna z innymi tabelami
  - AC: Identyczny standard tabel (nagłówki, spacing, fonty, hover, actions)
  - Weryfikacja: Porównać tabelę inicjatyw z Tasks/Decisions

- [ ] **D2.2** — Kolumny: owner, status, daty start-end, contractor + panel boczny
  - AC: Dane kompletne i czytelne
  - Weryfikacja: Sprawdzić kolumny tabeli i prawy panel

### D3. Minimum do akceptacji

- [ ] **D3.1** — Krytyczne pola wymagane do akceptacji inicjatywy
  - AC: Bez tasków, terminów, osób nie da się zatwierdzić inicjatywy
  - PDF: "minimalne zakresie elementów potrzebnych do realizacji — taski, termin"
  - Weryfikacja: Sprawdzić walidację przy akceptacji

- [ ] **D3.2** — Akceptacja/odpowiedzialność spójna z admin/team (ręczna akceptacja scheduled)
  - AC: Jasne role i uprawnienia
  - PDF: "zatwierdzenie na poziomie scheduled musi być dokonane ręcznie"
  - Weryfikacja: Sprawdzić flow akceptacji

### D4. Logika harmonogramu

- [ ] **D4.1** — Walidacja kolejności i zależności tasków (AI asystuje, user override)
  - AC: System ostrzega o nielogicznościach; user akceptuje override
  - PDF: "taski muszą po sobie następować logicznie — system komunikuje i proponuje zmiany"
  - Weryfikacja: Sprawdzić walidację harmonogramu

- [ ] **D4.2** — Przebudowany toolbar/priorytety (usunięte konfliktujące przyciski)
  - AC: Spójny, prosty pasek narzędzi
  - PDF: "wyrzuć te przyciski górne które robią jakieś konflikty"
  - Weryfikacja: Sprawdzić toolbar inicjatyw

### D5. Gantt + Heatmap

- [ ] **D5.1** — Gantt z zależnościami, ścieżką krytyczną, edycją graficzną i manualną
  - AC: Zależności działają; zmiany zapisują się; wykres jest używalny
  - PDF: "ścieżka krytyczna, punkty współzależne, edycja graficzna i manualna — jak MS Dynamics"
  - Weryfikacja: Sprawdzić Gantt chart — zależności, edycja

- [ ] **D5.2** — Heatmap obciążenia (np. miesięcznie) sumująca taski inicjatyw
  - AC: Czytelny wykres obciążenia; parametryzacja
  - PDF: "przycisk heatmap — ilość tasków w okresach miesięcznych — sumujemy z wszystkich inicjatyw"
  - Weryfikacja: Kliknąć Heatmap, sprawdzić dane

### D6. Execution

- [ ] **D6.1** — Execution Center: realne parametry, brak placeholderów
  - AC: Wiarygodne dane z systemu
  - PDF: "nie mieli żadnych placeholderów ani pustych kłamliwych informacji"
  - Weryfikacja: Sprawdzić Execution Center — czy dane są prawdziwe

- [ ] **D6.2** — Zakładka "Initiatives" w execution: progress vs czas, owner, alerty, blokery
  - AC: Widać zagrożenia i przyczyny opóźnień
  - PDF: "procent progresu, ile tasków zrealizowane, osoba odpowiedzialna, zagrożone taski, opóźnione decyzje"
  - Weryfikacja: Sprawdzić zakładkę Initiatives w Execution

- [ ] **D6.3** — RAID Log zaimplementowany
  - AC: CRUD + raport + linkowanie do inicjatyw
  - PDF: "RAID log musisz sam zaproponować"
  - Weryfikacja: Sprawdzić zakładkę RAID w Execution

- [ ] **D6.4** — Chat w execution: rozmowa o realizacji planu transformacji
  - AC: Chat ma kontekst execution i może doradzić
  - PDF: "przycisk czat — rozmawiał na temat analizy realizacji planu transformacji"
  - Weryfikacja: Kliknąć chat w Execution

- [ ] **D6.5** — Przycisk "Raport" w execution (podsumowanie realizacji)
  - AC: Generuje raport executive summary
  - PDF: "przycisk raport — podsumowuje zakres realizacji wszystkich inicjatyw"
  - Weryfikacja: Sprawdzić przycisk Raport w Execution

---

## E) INTERVIEW (INBOX / SESSIONS / TEMPLATES / INSIGHTS)

> Źródło: `Przegląd cosnulitnity - Inteview.pdf`

### E1. Inbox użytkownika

- [ ] **E1.1** — "Days to due" zamiast "due date" + kolory (≤3 żółte, overdue czerwone)
  - AC: Pilność widoczna od razu; sortowanie działa
  - PDF: "ilość dni do due date — ≤3 żółte, 0 i overdue czerwone"
  - Weryfikacja: Sprawdzić kolumnę terminów w Interview Inbox

### E2. Arkusze odpowiedzi

- [ ] **E2.1** — Wpisywanie odpowiedzi, zmiana ocen/punktacji, notatki DZIAŁAJĄ
  - AC: Zapis działa; refresh nie gubi; brak crash
  - PDF: "nie jestem w stanie wpisywać nic, zmieniać punktacji, dołączyć załącznika — arkusze w całości do naprawy"
  - Weryfikacja: Otworzyć arkusz → wpisać odpowiedź → zapisać → odświeżyć

- [ ] **E2.2** — Załączniki w interview
  - AC: Upload + powiązanie z rekordem
  - Weryfikacja: Dodać załącznik do odpowiedzi

- [ ] **E2.3** — Statusy: drafting → review → accepted/rejected
  - AC: Status widoczny i sterowany rolami
  - PDF: "drafting, przekazany do review, przyjęty/zaakceptowany, odrzucony"
  - Weryfikacja: Sprawdzić flow statusów

- [ ] **E2.4** — Chat-assist w kolumnie wsparcia DZIAŁA
  - AC: Czat uruchamia się kontekstowo do pytania/sekcji
  - PDF: "system wsparcia do uzupełniania — jak próbuję użyć czata — nie działa"
  - Weryfikacja: Kliknąć chat w kolumnie wsparcia

### E3. UI tabel/kolumn

- [ ] **E3.1** — Dopasowane szerokości kolumn + wyrównane "Actions"
  - AC: Brak "krzywości" w tabelach
  - PDF: "kolumny dopasowane szerokością — krzywo wygląda kolumna actions"
  - Weryfikacja: Sprawdzić wizualnie tabele Interview

### E4. Insights

- [ ] **E4.1** — 3 formaty widoku insights (spójne z innymi modułami)
  - AC: Przełącznik działa; formaty identyczne z decisions/tasks/notifications
  - Weryfikacja: Sprawdzić przełącznik widoków insights

- [ ] **E4.2** — Reorganizacja nawigacji: assessments [sessions ↔ templates], insights na prawo
  - AC: Menu logiczne (kolejność: inbox, sessions, assessments, templates, insights)
  - PDF: "assessments między sessions i templates, insights najbardziej na prawo"
  - Weryfikacja: Sprawdzić kolejność zakładek

- [ ] **E4.3** — Dwie osie insightów: wg raportów ORAZ wg osób
  - AC: Filtr "by report / by person" działa
  - PDF: "drugie kryterium — osoby — podsumować daną osobę i jej wypowiedzi"
  - Weryfikacja: Sprawdzić filtry w insights

- [ ] **E4.4** — Przycisk "Propose questions" kieruje do czatu (dodawanie pytań do templates)
  - AC: Czat proponuje pytania / otwiera kreator
  - PDF: "przycisk który proponowałby kolejne pytania — albo czat"
  - Weryfikacja: Sprawdzić funkcjonalność

---

## F) ZASADY GLOBALNE (CROSS-CUTTING)

> Wynikające ze wszystkich PDF-ów

### F1. Spójność UI

- [ ] **F1.1** — Wszystkie tabele w aplikacji mają identyczny standard
  - AC: Inbox, Tasks, Decisions, Notifications, Initiatives, Interview — ten sam styl
  - Weryfikacja: Porównać wizualnie 6 tabel

- [ ] **F1.2** — Row actions jako menu "⋯" (3 kropki) we wszystkich tabelach
  - AC: Spójne, nie nakładają się na inne elementy
  - Weryfikacja: Sprawdzić menu akcji w każdej tabeli

- [ ] **F1.3** — Przełącznik 3 widoków (Current/Notion/ClickUp) w kluczowych modułach
  - AC: Widoczny, spójny graficznie, działa identycznie
  - Weryfikacja: Sprawdzić w Tasks, Decisions, Notifications, Initiatives, Insights

### F2. Spójność językowa

- [ ] **F2.1** — UI w jednym języku (zgodnie z ustawieniem), bez miksowania PL/EN
  - AC: Wszystkie formularze, etykiety, przyciski w wybranym języku
  - Weryfikacja: Przejść przez kluczowe moduły w wersji EN i PL

### F3. Brak placeholderów

- [ ] **F3.1** — Żadnych "coming soon", "feature coming soon", mock data w kritycznych ścieżkach
  - AC: Jeśli coś WIP → feature-flag + oznaczenie + ticket
  - Weryfikacja: Przeszukać kod pod kątem "coming soon", "placeholder", mock data

### F4. Feature flags

- [ ] **F4.1** — Feature-flag dla największych przebudów
  - AC: Chat v2, Execution v2, Interview v2, 3-style cards — z możliwością rollback
  - Weryfikacja: Sprawdzić konfigurację feature flags

---

## Podsumowanie ilościowe

| Sekcja                | Punktów | Opis                                                                             |
| --------------------- | ------- | -------------------------------------------------------------------------------- |
| A) My Work/Executive  | 15      | Inbox, Focus, Tasks, Decisions, Notifications, 3 karty                           |
| B) Assessment/Reports | 15      | Assessment, Reports, Workflow, Templates, Initiatives, Chat kontekstowy          |
| C) Chat               | 14      | Nowa konwersacja, Welcome, Historia, Załączniki, Markdown, Web/Agent, Ustawienia |
| D) Execution          | 12      | Statusy, Tabela, Akceptacja, Gantt, Heatmap, RAID, Execution Center              |
| E) Interview          | 10      | Inbox, Arkusze, Statusy, Chat-assist, Insights                                   |
| F) Cross-cutting      | 6       | Spójność UI, Język, Placeholders, Feature flags                                  |
| **RAZEM**             | **72**  | **Punktów audytowych do zweryfikowania**                                         |
