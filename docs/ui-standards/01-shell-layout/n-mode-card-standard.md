# N-mode Card Standard

> Status: SSOT / KANON dla kart roboczych `N-mode`  
> Data: 2026-05-01  
> Zakres: wszystkie artefakty i narzędzia używające `NModeLayout`, w szczególności Task, Decision, Initiative, Notification, Tools, Interview, Ideas i Notebook.  
> Powiązane dokumenty: `artifact-shell.md`, `presentation-modes.md`, `shared-nmode-sections-standard.md`, `CONSULTIFY_UI_UX_OPERATING_STANDARD.md`

---

## 1. Cel dokumentu

Ten dokument jest źródłem prawdy dla kart w `N-mode`.

`N-mode` jest formatem pracy typu document/page-first:

- po lewej stronie istnieje pionowa kolumna nazw kart/sekcji,
- centralnie istnieje główny canvas roboczy artefaktu albo narzędzia,
- karty w lewym railu reprezentują logiczne obszary pracy,
- user może widzieć domyślny zestaw kart podpowiedziany przez system,
- user lub AI mogą sugerować dodatkowe karty, ale zmiana widoku musi być jawna i odwracalna.

Ten standard nie opisuje pełnego `C-mode`. `C-mode` będzie osobnym formatem graficznym i operacyjnym.

Notatka rozwojowa:

- `C-mode` jest planowany jako minimalistyczny widok inspirowany ClickUp,
- będzie miał więcej powietrza po bokach, poziomy układ górnych elementów i mniej dokumentowy charakter,
- do czasu wdrożenia `C-mode` przełącznik `N/C` pozostaje domyślnie na `N`,
- wybór `C` przed wdrożeniem pokazuje komunikat `C-mode wkrótce` i nie przełącza do niedokończonego widoku.

---

## 2. Podstawowa definicja karty N-mode

Karta `N-mode` to logiczny blok pracy, który:

1. ma nazwę w lewym railu,
2. ma odpowiadający obszar w centralnym canvasie,
3. posiada stabilny `cardId`,
4. ma opisany zakres danych,
5. ma określoną rolę AI,
6. może być domyślna, opcjonalna albo wymagana,
7. może być pokazana/ukryta przez ustawienia widoku, jeśli nie jest wymagana.

Karta nie jest dekoracyjną ramką. Karta jest kontraktem pracy: mówi użytkownikowi, jaki rodzaj pracy wykonuje w danym miejscu.

---

## 2.1 Properties strip jako warstwa workflow

Properties strip w `N-mode` jest zatwierdzonym kierunkiem wizualnym.

Przykład pól:

- `Status`,
- `Priorytet`,
- `Data utworzenia`,
- `Termin`,
- `Wnioskodawca`,
- `Decydent`,
- owner/assignee/sponsor zależnie od artefaktu,
- relacja do inicjatywy/projektu/narzędzia.

To nie jest tylko pasek metadanych. Properties strip jest warstwą workflow.

Zasady:

- zmiana statusu wpływa na dostępne akcje workflow,
- priorytet i termin wpływają na ryzyka, alerty, sortowanie, rekomendacje i AI context,
- właściciel/assignee/decydent wpływa na permissions, odpowiedzialność i eskalacje,
- wymagane pola blokujące workflow muszą mieć walidację inline,
- puste wartości są czytelne jako empty state, nie jako błąd techniczny,
- properties strip musi być zsynchronizowany z `Menu 3`, lifecycle actions i audit log,
- zmiana pola musi mieć read-back albo widoczny stan dirty/save,
- wartości workflow nie mogą być tylko wizualnymi chipami bez skutku produktowego.

Przykład dla decyzji:

- `Status = Eskalowana` powinien wpływać na dostępne akcje, widoczność eskalacji i AI context,
- `Priorytet = Krytyczny` powinien wpływać na risk/impact, kolejność pracy i alerty,
- `Termin` powinien wpływać na overdue/aging i przypomnienia,
- `Decydent` powinien wpływać na możliwość zatwierdzenia lub odrzucenia decyzji.

Jeśli pole nie ma wpływu na workflow, powinno być świadomie sklasyfikowane jako informacyjne.

---

## 2.2 Workflow action row

Workflow action row w `N-mode` zawiera przyciski dotyczące aktywnego artefaktu/narzędzia.

Przykłady:

- `Zatwierdź`,
- `Odrzuć`,
- `Więcej info`,
- `Deleguj`,
- `Wyślij do review`,
- inne akcje lifecycle/governance zależne od typu artefaktu.

Kierunek obecnego ekranu jest dobry funkcjonalnie, ale wymaga docelowego stylu `DBR77 Tech Sexy 2027`.

Zasady układu:

- preferowany układ to jedna linia,
- row nie powinien zabierać nadmiernej wysokości canvasu,
- jeśli akcji jest za dużo, mniej ważne akcje trafiają do `More` / overflow menu,
- akcje krytyczne pozostają widoczne, jeśli są aktualnie najważniejsze dla workflow,
- przyciski nie powinny zawijać się w przypadkowy drugi rząd na desktopie,
- drugi rząd jest dopuszczalny tylko w wąskich viewportach albo przy świadomym wariancie expanded.

Zasady stylu 2027:

- przyciski workflow nie mogą wyglądać jak stare prostokątne controls,
- default height: `h-8` lub zwarte `h-9`, zależnie od gęstości paska,
- radius: `rounded-hig-full` albo `rounded-hig-xl`,
- tło neutralne Layer 2/3,
- hover to subtelna zmiana tła,
- bez gradientów i bez mocnego shadow,
- danger action (`Odrzuć`) używa semantic danger text/border/surface, nie dużego czerwonego fill,
- positive action (`Zatwierdź`) używa semantic success treatment, ale nie konkuruje z globalnym Primary CTA,
- wszystkie przyciski w row mają tę samą rodzinę wysokości, radiusu i border logic.

Hierarchia:

1. Lifecycle primary action for current state, np. `Zatwierdź`.
2. Lifecycle negative/danger, np. `Odrzuć`.
3. Information/request action, np. `Więcej info`.
4. Assignment/governance action, np. `Deleguj`.
5. Pozostałe akcje w overflow.

Workflow row musi być spięty z properties strip: status, priorytet, termin i decydent wpływają na to, które akcje są widoczne, disabled albo wymagają confirm.

---

## 2.3 Vertical budget górnej części N-mode

Górna część `N-mode` nie może zjadać połowy ekranu roboczego.

Do górnej części należą:

1. title/header line,
2. properties/status strip,
3. workflow action row,
4. ewentualny krótki context/status strip.

Kierunek:

- zachowujemy jakość graficzną i czytelność,
- odzyskujemy przestrzeń pionową przez gęstszy rytm,
- nie upychamy wszystkiego na siłę,
- nie zmniejszamy tekstu poniżej czytelności,
- redukujemy puste marginesy, duplikaty i nadmiarowe kontenery.

Zasady kompaktowania:

- title/header line ma być stabilna i niska, bez dużych paddingów góra/dół,
- properties strip preferuje jeden rząd na desktopie, jeśli mieści 5-6 pól,
- workflow row preferuje jeden rząd i overflow dla akcji drugorzędnych,
- odstęp między properties strip i workflow row powinien być mniejszy niż odstęp między dużymi sekcjami canvasu,
- górne kontenery mogą mieć subtelne Layer 2/3 tło, ale nie potrzebują ciężkiego card spacingu,
- `ActionBar` i `PropertiesStrip` nie powinny mieć osobnych dużych ramek z dużym paddingiem, jeśli razem tworzą jeden blok sterowania,
- sticky behavior nie może dodawać dodatkowej wysokości,
- cały obszar header + properties + workflow powinien zostawić widoczny początek pierwszej karty w standardowym desktop viewport.

Docelowy rytm desktop:

| Warstwa | Kierunek |
|---|---|
| Header line | compact, ok. 44-52px |
| Properties strip | compact controls, ok. 44-56px |
| Workflow row | compact buttons, ok. 36-44px |
| Gap między warstwami | 8-12px, nie 16-24px |

Jeśli górny obszar przekracza sensowny budżet:

1. usuń duplikaty informacji,
2. przenieś akcje drugorzędne do overflow,
3. zmniejsz vertical padding,
4. połącz properties/workflow w jeden spokojny control surface,
5. dopiero na końcu rozważ ukrywanie mniej ważnych pól.

Nie wolno odzyskiwać miejsca przez:

- obniżenie kontrastu tekstu,
- zmniejszenie fontów do nieczytelnego poziomu,
- usunięcie wymaganych informacji workflow,
- przeniesienie krytycznych akcji w losowe miejsce,
- łamanie `N-mode` w chaotyczny dashboard.

---

## 3. Anatomia karty w centralnym canvasie

Każda karta musi mieć ten sam makro-układ.

### 3.1 Header karty

Na górze każdej karty znajduje się header.

Header zawiera:

1. ikonę karty, jeśli karta ma kanoniczną ikonę,
2. tytuł karty,
3. krótki opis pomocniczy, jeśli tytuł sam nie wystarcza,
4. lokalne controls karty po prawej stronie,
5. AI affordance, jeśli karta ma zatwierdzoną rolę AI.

Wymogi:

- tytuł jest zawsze widoczny,
- tytuł nie może być zastąpiony samą ikoną,
- tytuł używa spójnej hierarchii typografii `N-mode`,
- header nie może skakać przy rozwijaniu menu AI,
- header nie może zawierać losowych przycisków nieopisanych w roli karty.

### 3.2 Body karty

Body zawiera właściwą treść.

Dozwolone typy treści:

- pola tekstowe,
- opis i kontekst,
- tabele inline,
- checklisty,
- callouty,
- embedded views,
- listy powiązań,
- karty ryzyka,
- komentarze,
- activity feed,
- sekcje AI insight,
- grafiki/diagramy narzędzi, jeśli są częścią narzędzia.

Body nie może tworzyć własnego page shellu. Nie wolno budować lokalnego mini-layoutu, który konkuruje z `NModeShell`.

### 3.3 Sekcje wewnątrz karty

Jeśli karta ma kilka obszarów, dzieli się na sekcje.

Sekcja wewnątrz karty ma:

1. nagłówek sekcji,
2. opcjonalny opis,
3. treść,
4. opcjonalne lokalne actions,
5. opcjonalny AI affordance dla tej sekcji.

Przykład:

- karta `Risk & Impact` może mieć sekcje `Risks`, `Impact`, `Mitigation`, `Contingency`,
- karta `Options & Trade-offs` może mieć sekcje `Options`, `Pros`, `Cons`, `Recommendation`,
- karta `Governance` może mieć sekcje `RACI`, `Reminders`, `Escalation`.

Zasada:

- jeżeli karta ma kilka różnych typów pracy, używa sekcji,
- jeżeli karta ma jeden spójny typ pracy, nie dodajemy pustych sekcji tylko dla symetrii,
- sekcje mają stabilną kolejność,
- sekcje mogą mieć własne puste stany.

### 3.4 Zakaz dublowania kart w stopkach innych kart

Jeśli dany obszar ma własną kartę `N-mode`, nie dublujemy go jako blok na dole innej karty.

Dotyczy szczególnie:

- `Powiązany kontekst`,
- `Related Context`,
- `Wykryte powiązania AI`,
- `AI-detected links`,
- `Linked items`.

Zasada:

- jeżeli istnieje karta `related-context`, to powiązania żyją w tej karcie,
- inne karty mogą mieć co najwyżej krótki inline reference albo badge liczby powiązań,
- nie renderujemy pełnego bloku `Powiązany kontekst` na dole kart typu `Opcje i trade-offy`, `Zakres`, `Ryzyko` itd.,
- `Wykryte powiązania AI` są częścią karty `Related Context`, a nie powtarzalnym footerem każdej karty,
- wyjątek wymaga uzasadnienia: powiązanie jest niezbędne do zrozumienia konkretnego pola i ma postać krótkiego inline reference.

Cel: `N-mode` ma być czytelny i modułowy. Karta odpowiada za swój obszar pracy; stopki innych kart nie mogą zamieniać się w powtarzający się mini-dashboard.

---

## 4. Rozwijanie, zwijanie i resizing

Karty i ich sekcje mogą mieć różną gęstość pracy.

### 4.1 Rozwijanie

Każdy blok, który może mieć więcej treści niż mieści się w stanie podstawowym, powinien mieć affordance rozwijania.

Dozwolone wzorce:

- `More / Less`,
- chevron expand/collapse,
- drag handle dla powierzchni edycyjnych,
- controlled height dla textarea / rich text,
- show more dla list.

Nie wolno ukrywać ważnych danych bez sygnału, że treści jest więcej.

### 4.2 Resizing

Jeśli karta lub sekcja zawiera większe pole robocze, może być rozsuwana/resize.

Dotyczy szczególnie:

- text area,
- rich text editor,
- risk/mitigation field,
- notes field,
- evidence field,
- long context block,
- embedded document area.

Zasady resizingu:

- resize handle musi być subtelny i spójny,
- resize nie może przesuwać headera karty,
- minimalna wysokość musi zachować czytelność,
- maksymalna wysokość nie może zniszczyć scrollowania canvasu,
- preferencja wysokości może być zapamiętana per user/per artifact, jeśli implementacja to wspiera,
- resize zmienia prezentację, nie dane.

---

## 5. AI w kartach N-mode

AI jest częścią kart, ale nie jest dekoracją.

Każda karta ma jawnie przypisaną rolę AI:

- `none` - brak AI, bo karta nie potrzebuje AI,
- `explain` - AI wyjaśnia dane i kontekst,
- `summarize` - AI streszcza treść,
- `improve` - AI poprawia istniejący tekst,
- `generate` - AI generuje propozycję treści,
- `analyze` - AI analizuje ryzyka, opcje, skutki albo braki,
- `proposal` - AI proponuje zmianę workflow, wymagającą zatwierdzenia,
- `linking` - AI proponuje powiązania z innymi artefaktami.

### 5.1 AI affordance

Jeśli karta albo sekcja ma rolę AI, musi mieć widoczny, ale spokojny AI affordance.

Standard:

- AI control jest mały i kontekstowy,
- ikona AI nie może konkurować z głównym CTA ekranu,
- AI control siedzi przy bloku, którego dotyczy,
- menu AI otwiera się bez layout shift,
- AI control jest zawsze semantycznie związany z danym blokiem.

Obserwacja z obecnego ekranu:

- małe przyciski `AI` przy polach i sekcjach są dobrym kierunkiem,
- ich rola musi być jednak opisana per karta/sekcja,
- AI nie może występować jako przypadkowa ikonka bez nazwy działania.

### 5.2 Menu AI

Menu AI dla pola/sekcji może zawierać:

1. `Wygeneruj`
2. `Popraw`
3. `Skróć`
4. `Rozwiń`
5. `Formalny ton`
6. akcje domenowe, np. `Wygeneruj ryzyka`, `Zaproponuj RACI`, `Znajdź powiązania`

Zasady:

- akcje w menu muszą dotyczyć aktualnego pola/sekcji,
- akcje nie mogą wykonywać mutacji bez podglądu albo zatwierdzenia,
- wynik AI powinien być propozycją, którą użytkownik może przyjąć, edytować albo odrzucić,
- dla działań governance obowiązuje flow `proposal -> approval -> execution -> audit`,
- AI output musi być oznaczony jako AI, jeśli zostaje zapisany w artefakcie.

### 5.3 AI na poziomie karty vs sekcji

AI może działać na trzech poziomach:

| Poziom | Przykład | Zasada |
|---|---|---|
| Pole | popraw opis decyzji | inline assist, szybka modyfikacja |
| Sekcja | wygeneruj ryzyka dla tej decyzji | działa na jednym obszarze karty |
| Karta | przygotuj pełny decision brief | większa akcja, często wymaga review |

AI workflow action nie powinna być dublowana w wielu miejscach. Jeśli globalne `Menu 3` ma akcję `Generate risks`, lokalny przycisk w sekcji nie może robić tej samej rzeczy bez jasnego rozróżnienia.

### 5.4 AI funkcjonalne w Menu 3

Funkcjonalne akcje AI nie są tym samym co małe lokalne AI przy polu.

Funkcjonalne AI to akcje typu:

- `Napisz kartę`,
- `Wygeneruj kartę`,
- `Napisz cały artefakt`,
- `Wygeneruj scope`,
- `Wygeneruj ryzyka`,
- `Zaproponuj RACI`,
- `Uzupełnij brakujące sekcje`,
- `Przygotuj cały brief`.

Te akcje należą do `Menu 3 / Command Row`, po prawej stronie.

Zasady umiejscowienia:

- kontekstowe przyciski AI dla aktywnego dokumentu/narzędzia/karty są zawsze w prawym górnym obszarze `Menu 3`,
- znajdują się po prawej stronie rzędu, w sąsiedztwie innych context actions,
- wizualnie są pod głównym CTA ekranu z `Menu 2` / Module Topbar, np. pod `Dodaj`,
- nie są renderowane jako osobny pasek pod properties strip,
- nie są dokładane przypadkowo w środku canvasu,
- nie dublują lokalnych inline AI przy polach.

Podział odpowiedzialności:

| Typ AI | Miejsce | Przykład |
|---|---|---|
| Inline field AI | przy polu / sekcji | `Popraw`, `Skróć`, `Formalny ton` |
| Section AI assist | header sekcji albo lokalny blok | `Rozwiń ten opis`, `Podsumuj tę sekcję` |
| Functional AI action | prawa strona `Menu 3` | `Napisz kartę`, `Wygeneruj cały artefakt` |

Funkcjonalna akcja AI zawsze działa przez propozycję i zatwierdzenie, jeśli jej wynik zmienia strukturę karty, widoczność kart, workflow albo dane biznesowe.

---

## 6. Ustawienia widoku kart

`N-mode` musi mieć kontrolkę ustawień widoku kart.

Mentalny model: tak jak ustawianie widoczności kolumn w tabeli.

### 6.0 Umiejscowienie w headerze

Linia tytułu artefaktu w `N-mode` jest zatwierdzonym kierunkiem.

Kontrolka ustawień widoku kart powinna znajdować się w prawym klastrze tej linii, obok stanu zapisu i przełącznika `N/C`.

Docelowy porządek prawego klastra:

1. artifact id / permalink / link controls,
2. save state, np. `Zapisano`,
3. `Card View Settings` - ustawienie widocznych kart,
4. view mode switcher `N/C`.

Zasady:

- kontrolka nie może siedzieć w lewym railu, bo rail jest nawigacją po kartach, nie miejscem konfiguracji,
- kontrolka nie może być w `Menu 3`, bo dotyczy kompozycji widoku, a nie akcji na artefakcie,
- kontrolka powinna być blisko `Zapisano`, bo zmiana widoczności kart jest zmianą ustawienia widoku, a nie treści biznesowej,
- w stylu `DBR77 Tech Sexy 2027` kontrolka może mieć bardziej wyrazisty affordance niż zwykły icon button, ale nadal ma pozostać neutralna i nie konkurować z CTA,
- ikona powinna komunikować układ/karty/kolumny, nie AI ani edycję treści,
- tooltip/aria label musi mówić wprost: `Ustaw widoczne karty` / `Configure visible cards`.

### 6.1 Co robi kontrolka

Kontrolka pokazuje listę kart możliwych dla danego artefaktu/narzędzia.

Dla każdej karty pokazuje:

- nazwę,
- ikonę,
- krótki opis,
- status: `default`, `optional`, `required`, `AI suggested`,
- checkmark/checkbox widoczności,
- informację, jeśli karta jest ukryta z powodu permissions.

### 6.2 Zachowanie

- zaznaczenie pokazuje kartę,
- odznaczenie ukrywa kartę,
- karta wraca w kanonicznej kolejności, nie na koniec listy,
- ukrycie karty nie usuwa danych,
- wymagane karty są locked/disabled,
- AI może zasugerować dodanie karty, ale użytkownik zatwierdza widoczność,
- zmiana widoczności może być zapisana per user/per artifact albo per template.

### 6.3 Mechanizm techniczny

Preferowany mechanizm: `visibleSections`.

Kontrakt:

```ts
type NModeCardVisibility = Record<string, boolean>;
```

Zasady:

- `visibleSections[cardId] = true` oznacza karta widoczna,
- `visibleSections[cardId] = false` oznacza karta ukryta,
- brak klucza oznacza fallback do defaultu danego artefaktu,
- explicit template/user setting ma pierwszeństwo nad automatycznym defaultem,
- permissions mogą nadpisać widoczność, ale UI musi to uczciwie komunikować.

---

## 7. Katalog potencjalnych kart N-mode

Poniżej jest katalog kandydatów. Nie każdy artefakt ma używać wszystkiego.

### 7.1 Karty uniwersalne

| `cardId` | Label PL | Label EN | Rola | AI |
|---|---|---|---|---|
| `scope` | Zakres / Brief | Scope / Brief | opis celu, problemu, kontekstu | improve, generate, summarize |
| `properties` | Właściwości | Properties | status, owner, priority, dates, tags | explain, suggest missing |
| `related-context` | Powiązany kontekst | Related Context | powiązane artefakty, źródła, kontekst | linking, summarize |
| `attachments-evidence` | Załączniki i dowody | Attachments & Evidence | pliki, linki, źródła, dowody | summarize, classify |
| `comments` | Komentarze | Comments | współpraca i dyskusja | improve, summarize |
| `activity-log` | Log aktywności | Activity Log | audit trail, historia zmian | summarize, explain |
| `ai-insight` | AI Insight | AI Insight | syntetyczny insight i confidence | summarize, analyze |
| `governance` | RACI i eskalacja | Governance | RACI, reminders, escalation | generate, analyze, proposal |
| `risks` | Ryzyka / RAID | Risks / RAID | ryzyka, assumptions, issues, dependencies | generate, analyze |
| `checklist` | Checklist | Checklist | kroki, acceptance, postęp | generate, improve |
| `dependencies` | Zależności | Dependencies | blokuje/blokowane przez, zależności | analyze, linking |
| `quality-readiness` | Jakość i gotowość | Quality & Readiness | kompletność, braki, readiness | analyze, proposal |

### 7.2 Karty operacyjne

| `cardId` | Label PL | Zastosowanie | AI |
|---|---|---|---|
| `outcome` | Oczekiwany rezultat | Task, Initiative, Tool | generate, improve |
| `acceptance` | Kryteria akceptacji | Task, Initiative, Interview | generate, analyze gaps |
| `plan` | Plan / Implementacja | Task, Initiative | generate, improve |
| `options-tradeoffs` | Opcje i trade-offy | Decision, Tool, Initiative | generate, compare |
| `recommendation` | Rekomendacja | Decision, Tool output | generate, explain |
| `consequences` | Konsekwencje | Decision, Risk, Initiative | analyze, generate |
| `timeline` | Timeline | Initiative, Task, Project | analyze critical path |
| `milestones` | Kamienie milowe | Initiative, Project | generate, analyze |
| `resources` | Zasoby | Initiative, Project | analyze capacity |
| `team` | Zespół | Initiative, Project | suggest staffing |
| `financial-analysis` | Analiza finansowa | Initiative, Assessment | estimate, explain |
| `kpi` | KPI | Initiative, Benefits | generate, validate |
| `benefits` | Benefits realization | Initiative, Benefits | analyze value tracking |
| `technical-spec` | Specyfikacja techniczna | Initiative, Tool, Implementation | improve, analyze |

### 7.3 Karty dla Task

Domyślny zestaw:

1. `task-brief`
2. `outcome`
3. `acceptance`
4. `plan`
5. `checklist`
6. `dependencies`
7. `risks`
8. `comments`
9. `activity-log`

Opcjonalne:

- `attachments-evidence`,
- `governance`,
- `related-context`,
- `ai-insight`,
- `decisions-blockers`.

### 7.4 Karty dla Decision

Domyślny zestaw:

1. `decision-scope`
2. `context-problem`
3. `options-tradeoffs`
4. `risk-impact`
5. `recommendation`
6. `consequences`
7. `governance`
8. `comments`
9. `attachments-evidence`
10. `activity-log`

Opcjonalne:

- `related-context`,
- `approval-history`,
- `ai-decision-brief`,
- `dependencies`.

### 7.5 Karty dla Initiative

Domyślny zestaw zależy od template/level inicjatywy.

Pełny katalog:

1. `initiative-scope`
2. `success-criteria`
3. `kpi`
4. `financial-analysis`
5. `financial-impact`
6. `team`
7. `governance`
8. `resources`
9. `dependencies`
10. `risk-raid`
11. `milestones`
12. `timeline`
13. `tasks`
14. `decisions`
15. `gates`
16. `technical-spec`
17. `benefits`
18. `quality-acceptance`
19. `communications`
20. `procurement-vendors`
21. `assumptions-constraints`
22. `closure-handover`
23. `attachments-evidence`
24. `comments`
25. `activity-log`

### 7.6 Karty dla Notification

Domyślny zestaw:

1. `signal-contract`
2. `expected-action`
3. `ai-insight`
4. `context-source`
5. `recipients-reason`
6. `triage-control`
7. `activity-log`

### 7.7 Karty dla Tools

Dla detail view narzędzia:

1. `goal`
2. `process`
3. `outcomes`
4. `example`

Dla aktywnej sesji narzędzia:

1. `input-context`
2. `evidence-signals`
3. `analysis-matrix`
4. `strategic-tensions`
5. `recommended-moves`
6. `outputs-deliverables`
7. `initiative-candidates`
8. `review-quality`
9. `activity-log`

### 7.8 Karty dla Interview

Dla session workspace:

1. `questions`
2. `notes`
3. `evidence`
4. `summary`
5. `organization-context`
6. `quality-gate`
7. `review-feedback`
8. `activity-log`

Dla insight/report:

1. `findings`
2. `gaps`
3. `risks`
4. `trends`
5. `evidence-confidence`
6. `exports`
7. `activity-log`

#### 7.8.1 Kanoniczny katalog kart `Interview Insight`

`Interview Insight` jest artefaktem źródłowym, z którego użytkownik może tworzyć dokumenty i działania w aplikacji. Dlatego jego rail `N-mode` może być bogatszy niż prosty `insight/report`, ale musi pozostać zgodny z zasadą: jedna karta = jeden kontrakt pracy.

Domyślny zestaw kart:

1. `artifact-actions`
2. `executive-summary`
3. `material-quality`
4. `consulting-readout`
5. `candidate-triage`
6. `people`
7. `source-pack`
8. `analysis-matrix`
9. `themes`
10. `issues-risks`
11. `opportunities`
12. `signals`
13. `evidence-map`
14. `traceability`
15. `full-analysis`
16. `source-sessions`
17. `comments`
18. `activity-log`

| `cardId` | Label PL | Label EN | Rola | AI |
|---|---|---|---|---|
| `artifact-actions` | Dalsze akcje | Next Actions | konwersja insightu do dokumentów i działań: raport, prezentacja, tabela, idea, notatka, inicjatywa | proposal, linking |
| `executive-summary` | Podsumowanie | Executive Summary | syntetyczny brief dla szybkiego zrozumienia insightu | summarize |
| `material-quality` | Jakość materiału | Material Quality | ocena jakości zaakceptowanych odpowiedzi, pokrycia, braków, sprzeczności i ograniczeń wnioskowania | analyze, classify |
| `consulting-readout` | Odczyt konsultingowy | Consulting Readout | interpretacja konsultingowa: fakty, issues/risks, opportunities i ukryte sygnały | analyze, summarize |
| `candidate-triage` | Triage kandydatów | Candidate Triage | przegląd kandydatów/findingów przed użyciem dalej | proposal, analyze |
| `people` | Perspektywy | People | analiza ról, osób, działów i perspektyw interesariuszy | analyze |
| `source-pack` | Pakiet źródeł | Source Pack | jawny pakiet źródeł: sesje, pytania, odpowiedzi, respondent/rola, wskaźniki dowodowe | summarize, classify |
| `analysis-matrix` | Macierz Analizy | Analysis Matrix | przecięcie findingów, ról, osób, tematów i pokrycia dowodowego | analyze |
| `themes` | Tematy | Themes | tematy/patterny z odpowiedzi i sesji | summarize, classify |
| `issues-risks` | Problemy i ryzyka | Issues & Risks | problemy, ryzyka, ograniczenia i napięcia wykryte w źródłach | analyze |
| `opportunities` | Szanse | Opportunities | opportunities i rekomendowane kierunki pracy | generate, analyze |
| `signals` | Sygnały | Signals | słabe sygnały, sprzeczności, anomalie i ukryte wzorce | analyze |
| `evidence-map` | Mapa dowodów | Evidence Map | połączenie odpowiedzi źródłowych z tematami, problemami i findingami | linking, explain |
| `traceability` | Traceability | Traceability | ścieżka audytowa od insightu do odpowiedzi źródłowych i downstream artefaktów | linking, explain |
| `full-analysis` | Pełna Analiza | Full Analysis | pełny wynik analizy bez skrótu executive | summarize, explain |
| `source-sessions` | Sesje Źródłowe | Source Sessions | lista sesji wejściowych i ich udział w insightcie | summarize |
| `comments` | Komentarze | Comments | współpraca i feedback wokół insightu | improve, summarize |
| `activity-log` | Aktywność | Activity Log | historia zmian i aktywności na insightcie | summarize, explain |

Wymagania dodatkowe:

- `artifact-actions` jest kartą specyficzną dla artefaktu źródłowego. Nie jest zwykłym CTA w środku canvasu; musi mieć własny `cardId`, opis celu, lineage i empty/error states dla tworzenia downstream artefaktów.
- `material-quality` jest kartą wymaganą. Nie blokuje wygenerowania insightu; pokazuje, jak mocny lub słaby jest zaakceptowany materiał, z którego insight powstał.
- `comments` i `activity-log` muszą używać współdzielonych komponentów z `src/components/shared/NModeSections/`.
- `source-pack`, `evidence-map` i `traceability` nie mogą dublować tej samej treści. `source-pack` pokazuje materiał wejściowy, `evidence-map` mapuje dowody do wniosków, a `traceability` pokazuje audytową ścieżkę połączeń.
- `themes`, `issues-risks`, `opportunities` i `signals` mogą być osobnymi kartami, jeśli mają odrębne dane i akcje. Jeśli są tylko statycznymi listami z tego samego źródła, preferowane jest scalenie ich w jedną kartę z sekcjami.
- Karty analityczne muszą mieć uczciwe stany degraded/empty. Brak dowodu nie może wyglądać jak `0` albo gotowy wynik.

#### 7.8.2 Źródła prawdy dla karty `Interview Insight`

Kontrakt zawartości karty `Interview Insight` wynika z trzech źródeł:

1. `server/src/services/v8/interviewInsightCanon.ts` - P10 canon: `finding / evidence / limits / next_action`, confidence semantics, evidence pointer rules, source-loss prevention, readback i handoff.
2. `docs/ui-standards/CONSULTIFY_UI_UX_GOLDEN_STANDARD.md` - najwyższy kanon wizualny DBR77 Tech Sexy 2027.
3. Ten dokument - katalog kart N-mode i szczegółowy kontrakt card-by-card.

Najważniejsza reguła P10:

- każdy publishable insight/finding musi mieć `finding_statement`,
- każdy finding musi mieć `confidence_level`,
- każdy finding musi mieć jawne `limits`,
- każdy finding musi mieć `next_action`,
- każdy finding musi mieć aktywne `evidence_pointers`,
- UI nie może renderować findingu jako faktu bez confidence + limits.

#### 7.8.2A Artifact Standard: `Interview Insight`

Ten blok jest skonsolidowanym standardem artefaktu. Obowiązuje przy dalszym budowaniu `Interview Insight` i ma pierwszeństwo przed lokalnymi interpretacjami ekranów.

##### Rola produktu

`Interview Insight` jest kanonicznym wynikiem modułu `Wywiad`.

Nie jest:

- nowym top-level modułem,
- dashboardem AI,
- listą luźnych rekomendacji,
- alternatywnym repozytorium odpowiedzi,
- alternatywnym modułem inicjatyw.

Jest:

- audytowalnym artefaktem źródłowym,
- mostem między rozmową a decyzją/dokumentem/działaniem,
- miejscem review i triage dla findingów,
- źródłem downstream actions: dokumenty oraz działania w aplikacji,
- artefaktem P10 opartym o `finding / evidence / limits / next_action`.

##### Insight Scope Builder

Tworzenie insightu zaczyna się od krótkiego briefu konsultanta.

Wymagane decyzje:

- tytuł insightu;
- tryb analizy;
- zakres sesji zaakceptowanych/zakończonych;
- filtry: osoba, rola, dział, template/arkusz, data;
- tematyka/focus: brak, jeden, wiele albo wszystkie sugerowane wątki;
- context mode: tylko wybrany materiał interview albo materiał interview + zatwierdzona wiedza organizacji;
- opcjonalna notatka konsultanta;
- opcjonalne pytanie przewodnie.

Reguły:

- insight powstaje tylko z materiału `approved/completed`;
- kreator nie wybiera pojedynczych pytań, odpowiedzi ani ręcznych fragmentów jako głównego modelu zakresu;
- jeśli użytkownik nie wybierze tematyki, AI wybiera najcenniejsze obserwacje konsultingowe;
- pytanie przewodnie jest opcjonalne;
- tryb `between_the_lines` jest dozwolony, ale musi być opisany jako interpretacyjny i pokazywać limits/confidence;
- `Material Quality` jest kartą po generowaniu, nie blokadą przed generowaniem.

##### Canonical lifecycle

Lifecycle artefaktu:

1. `draft` - insight roboczy, może mieć kandydatów i niepełne evidence.
2. `in_review` - insight/findingi są sprawdzane przez operatora/managera.
3. `published` - insight jest gotowy do kontrolowanego downstream use.
4. `draft` po cofnięciu - jeśli readback, evidence albo reviewer zakwestionuje claim.

Workflow nie może przeskakiwać review:

- candidate nie jest findingiem;
- theme/issue/opportunity nie jest findingiem;
- raw AI output nie jest findingiem;
- finding bez confidence, limits, next action i evidence pointers nie jest publishable;
- handoff do inicjatywy albo dokumentu nie może udawać zatwierdzonego insightu, jeśli źródło jest draft/degraded.

##### Artifact anatomy

Każdy `Interview Insight` składa się z warstw:

1. `Artifact Header` - tytuł, status, typ analizy, identity/permalink.
2. `Properties Strip` - status workflow, typ, data, czas generowania, sesje, readback, findingi, kandydaci, dowody.
3. `Workflow Action Row` - lifecycle actions i governance actions.
4. `N-mode Rail` - kanoniczne karty pracy.
5. `Canvas` - jedna aktywna karta naraz.
6. `Lineage` - źródła wejściowe i downstream artefakty.
7. `Activity` - audyt zmian i mutacji P10.

##### Properties strip contract

Properties strip dla `Interview Insight` musi rozdzielać metadane od workflow, ale oba typy pól mogą być w jednym stripie.

Wymagane pola:

- `Status` - lifecycle artefaktu;
- `Typ analizy` - prompt/analysis type;
- `Utworzono` - data utworzenia;
- `Czas gen.` - generation time albo `-` jako świadomy brak;
- `Sesje` - liczba sesji źródłowych;
- `Readback` - confirmed/total albo neutralny empty;
- `Findingi` - liczba persisted P10 findings;
- `Kandydaci` - liczba candidate findings;
- `Dowody` - liczba aktywnych evidence pointers.

Reguły:

- `0` jest dozwolone tylko jako świadoma odpowiedź danych, nie fallback po błędzie;
- jeśli source pack/findingi nie są załadowane, pokazać loading/degraded, nie `0`;
- wartości workflow wpływają na dostępne akcje;
- save state nie może być mieszany z lifecycle state.

##### Workflow actions contract

Wiersz akcji dla `Interview Insight` musi pozostać kompaktowy.

Primary lifecycle actions:

- `Wyślij do recenzji`;
- `Zatwierdź / Publish`;
- `Cofnij do szkicu`;
- `Odrzuć / zakwestionuj`, jeśli jest taki workflow.

Secondary/domain actions:

- `Regeneruj`;
- `Do Tools`;
- `Do Assessment`;
- `Do Notatnika`;
- `Markdown`;
- `Kopiuj`;
- pozostałe akcje w `More`.

Reguły:

- workflow row jest pod properties strip i preferuje jedną linię na desktopie;
- przyciski są `h-8/h-9`, rounded/pill, bez gradientów i ciężkich shadow;
- disabled action musi mieć powód;
- akcja, która mutuje P10, wymaga read-back/refetch i activity entry;
- AI funkcjonalne, które zmienia strukturę/findingi, nie siedzi jako losowy button w canvasie.

##### Downstream model

Insight daje sześć bezpośrednich działań:

Dokumenty:

1. raport,
2. prezentacja,
3. tabela.

Działania w aplikacji:

1. idea,
2. notatka,
3. inicjatywa.

Reguły downstream:

- downstream action zawsze zapisuje lineage;
- source type dla konwersji to `interview_insight`;
- target type/id musi być zapisany w `artifact_conversions`;
- inicjatywa z insightu zaczyna jako draft w lokalnym kontekście `Wywiad > Inicjatywy`;
- globalny moduł `Inicjatywy` jest etapem późniejszym, po zatwierdzeniu/promocji;
- dokumenty są sposobem dzielenia się insightem ze światem;
- idea/notatka/inicjatywa są sposobem działania w aplikacji;
- nie tworzymy osobnego modułu `Wnioski` dla tej warstwy.

##### P10 truth contract

Publishable truth w `Interview Insight` żyje w P10 findingach.

Minimalny finding:

```text
finding_statement
confidence_level
limits
next_action
evidence_pointers[]
readback_status
review_status
```

Confidence levels:

- `high`;
- `medium`;
- `low`;
- `insufficient`;
- `contradicted`.

Reguły confidence:

- `high` nadal musi pokazać limits;
- `medium` zawsze pokazuje assumptions/limits;
- `low` wygląda jak hypothesis i downstream tylko jako investigate/validate;
- `insufficient` blokuje publish/handoff;
- `contradicted` pokazuje sprzeczność i blokuje single narrative.

Evidence pointer types:

- `interview_session`;
- `question_answer`;
- `transcript_excerpt`;
- `survey_linkage`;
- `attachment`;
- `export_artifact`;
- `operator_note`.

Reguły evidence:

- evidence set jest append-only domyślnie;
- usunięcie pointera zostawia tombstone;
- pointer przechowuje `source_ref`, `captured_at`, `source_fingerprint`, opcjonalny excerpt;
- broken/redacted/permission-lost source pozostaje widoczny jako degraded pointer;
- duplicate pointers są deduplikowane;
- edycja finding statement nie usuwa pointerów.

##### Readback contract

Readback jest częścią governance, nie komentarzem.

Statusy:

- `draft_interpretation`;
- `shared_for_readback`;
- `confirmed_by_client`;
- `partially_confirmed`;
- `challenged_by_client`;
- `needs_more_evidence`.

Reguły:

- readback status jest widoczny w properties strip i w kartach finding/candidate;
- challenged albo needs_more_evidence nie może wyglądać jak published confidence;
- confirmed readback wzmacnia gotowość downstream, ale nie zastępuje evidence;
- każda zmiana readback tworzy activity entry.

##### Honest UI / degraded posture

`Interview Insight` musi uczciwie pokazywać degraded states.

Minimalne degraded scenarios:

- missing evidence;
- broken pointer;
- source drift;
- duplicate input;
- contradictory evidence;
- handoff denied;
- downstream creation/link failure;
- partial artifact state;
- redaction event;
- network transient during publish/handoff.

Reguły:

- brak danych nie jest sukcesem;
- `0` nie może maskować awarii loadu;
- brak permissions nie usuwa śladu źródła;
- failed handoff nie tworzy ghost initiative;
- source unavailable nie usuwa pointera;
- UI musi dać operatorowi następny krok.

##### AI contract

AI w `Interview Insight` ma trzy poziomy:

1. Field/section assist - poprawia lub streszcza konkretny fragment.
2. Card assist - pomaga z kartą, np. streszcza evidence albo analizuje contradiction.
3. Functional AI - generuje albo modyfikuje strukturę/findingi.

Reguły:

- field/section AI może być lokalne przy danej sekcji;
- functional AI należy do Menu 3 / action row, nie do przypadkowego miejsca w canvasie;
- AI output dla findingów jest propozycją, nie zapisem bez review;
- AI nie może publishować, handoffować ani usuwać evidence bez zatwierdzenia;
- AI-generated content musi być oznaczone, jeśli zostaje zapisane.

##### Card visibility and rail contract

Lewy rail:

- jest nawigacją, nie paskiem akcji;
- ma ok. `242px`;
- tytuły nie powinny się zawijać;
- badges pokazują liczbę elementów tylko wtedy, gdy liczba jest znacząca;
- kolejność kart jest kanoniczna.

`Card View Settings`:

- musi docelowo znajdować się w headerze przy save state i `N/C`;
- działa jak wybór kolumn w tabeli;
- karta wymagana jest locked;
- ukrycie karty nie usuwa danych;
- karta wraca w kanonicznej kolejności;
- settings mogą być per user/per artifact/per template.

Wymagane karty:

- `artifact-actions`;
- `executive-summary`;
- `material-quality`;
- `source-pack`;
- `candidate-triage`;
- `evidence-map`;
- `traceability`;
- `comments`;
- `activity-log`.

Opcjonalne/konfigurowalne:

- `consulting-readout`;
- `people`;
- `analysis-matrix`;
- `themes`;
- `issues-risks`;
- `opportunities`;
- `signals`;
- `full-analysis`;
- `source-sessions`.

##### Visual density and layout

Karta ma być dokumentowa, ale nie ciężka.

Zasady:

- top area ma być compact;
- pierwsza karta robocza powinna być widoczna wysoko w standardowym desktop viewport;
- stat cards są małe, spokojne i służą tylko orientacji;
- semantic color idzie w badge/dot/border, nie w całe agresywne powierzchnie;
- nie dodajemy drugiego page shellu w canvasie;
- duże tabele używają `InlineTable` albo embedded view pattern;
- długie raw content używa markdown/prose;
- każdy panel ma dark-mode parity.

##### Definition of Done dla `Interview Insight`

Artefakt jest zgodny ze standardem, gdy:

- używa `NModeShell`;
- ma compact properties strip;
- ma compact workflow action row;
- powstał z zapisanego `Insight Scope Builder` albo pokazuje migration debt dla starszego insightu;
- ma `Card View Settings` albo jawnie opisany brak jako migration debt;
- każda karta ma `cardId`, label PL/EN, zakres danych, AI role i empty/degraded states;
- karta `material-quality` pokazuje jakość odpowiedzi i pokrycia bez blokowania pracy;
- P10 findingi są jedyną publishable truth layer;
- candidate triage nie miesza się z published findings;
- source pack, evidence map i traceability mają rozdzielone odpowiedzialności;
- downstream actions zapisują lineage;
- inicjatywa z insightu trafia najpierw do lokalnej zakładki `Wywiad > Inicjatywy`;
- readback i activity log obejmują mutacje P10;
- brak danych i błędy loadu są uczciwie widoczne;
- nie istnieje top-level moduł `Wnioski`.

#### 7.8.3 Wygląd karty `Interview Insight`

Karta `Interview Insight` jest detail view typu `N-mode`, więc używa standardu:

- header artefaktu: tytuł, status zapisu, artifact identity, przełącznik `N/C`;
- properties strip: status, typ analizy, data utworzenia, czas generowania, sesje, readback, findingi, kandydaci, dowody;
- workflow action row: lifecycle/gov actions, maksymalnie jedna linia na desktopie, akcje drugorzędne w overflow;
- lewy rail: stabilne `cardId`, ikona, label PL/EN, badge count tylko gdy informuje o liczbie elementów;
- centralny canvas: jedna aktywna karta na raz;
- każda karta ma callout albo header opisujący, jak czytać daną warstwę;
- stat cards są dozwolone, ale tylko jako szybkie wskaźniki nad właściwą treścią;
- brak danych pokazujemy przez `EmptyStateInline` albo degraded callout, nigdy jako fałszywe `0`;
- długie treści używają markdown/prose albo tabel inline, nie tworzą własnego page shellu;
- actions w kartach muszą być domain-specific i zgodne z P10, nie dekoracyjne.

#### 7.8.4 Szczegółowy kontrakt kart `Interview Insight`

##### `artifact-actions` / Dalsze akcje

Cel: pokazać, co użytkownik może zrobić z zatwierdzonym albo roboczym insightem jako artefaktem źródłowym.

Zawartość:

- krótki callout: insight jest artefaktem źródłowym, z którego tworzy się dokumenty albo działania w aplikacji;
- metryki źródła: confidence, liczba aktywnych dowodów, liczba sesji;
- grupa `Dokumenty`: raport, prezentacja, tabela;
- grupa `Działania w aplikacji`: idea, notatka, inicjatywa;
- dla dokumentów: informacja, że kliknięcie otwiera właściwy generator z kontekstem insightu i wyborem template;
- dla inicjatywy: informacja, że draft powstaje w `Wywiad > Inicjatywy` i może korzystać z pełnej zatwierdzonej wiedzy organizacji;
- po utworzeniu artefaktu: stan created + link do utworzonego celu;
- lineage: każda akcja zapisuje relację `sourceArtifactType=interview_insight`, `sourceArtifactId`, target type/id.

Akcje:

- `Utwórz raport`;
- `Utwórz prezentację`;
- `Utwórz tabelę`;
- `Utwórz ideę`;
- `Utwórz notatkę`;
- `Utwórz inicjatywę`.

Reguły:

- raport/prezentacja/tabela nie powinny być tworzone jako ślepy one-click, jeśli generator docelowy wspiera template; akcja otwiera `Action Composer` albo generator z prefilled context;
- jeśli użytkownik nie wybierze template, AI tworzy strukturę od zera na podstawie kontekstu insightu;
- jeśli użytkownik wybierze template, AI wypełnia template kontekstem insightu;
- `Action Composer` pokazuje source insight, opcjonalny finding/candidate, context pack, confidence, limits, evidence count i target;
- inicjatywa z insightu najpierw trafia do lokalnego etapu `Wywiad > Inicjatywy` jako draft;
- draft inicjatywy korzysta z całej zatwierdzonej wiedzy organizacji, jeśli context mode i permissions na to pozwalają;
- akcje nie mogą tworzyć artefaktu bez zapisania lineage;
- jeśli backend zwraca błąd, karta pokazuje błąd/failed toast i nie udaje sukcesu;
- low/contradicted/insufficient confidence wymaga widocznych limits; automatyczny handoff może być ograniczony przez P10.

##### `executive-summary` / Podsumowanie

Cel: dać szybki consulting brief bez wchodzenia w pełną analizę.

Zawartość:

- callout `Czytaj jak brief konsultingowy`;
- 3-7 punktów streszczenia albo krótka narracja;
- stat cards: liczba official answers, liczba issues/risks, liczba signals/opportunities;
- 1-2 cytaty evidence jako szybki kontekst, jeśli są dostępne;
- brak summary: jasny empty state `Brak podsumowania`.

Reguły:

- nie dodaje nowych claims poza treścią insightu;
- nie zastępuje `source-pack` ani `evidence-map`;
- nie pokazuje confidence bez limits, jeśli przechodzi w claim/finding.

##### `material-quality` / Jakość materiału

Cel: pokazać, jak mocny jest zaakceptowany materiał, z którego powstał insight.

Zawartość:

- callout `Jak mocny jest materiał?`;
- `Material Fitness Score`: np. strong / usable / thin / poor;
- stat cards: zaakceptowane sesje, respondenci, role/działy, thin answers, evidence gaps, contradictions;
- `Coverage`: które role/działy są reprezentowane, których brakuje, czy materiał jest lokalny czy przekrojowy;
- `Answer Quality`: przykłady odpowiedzi mocnych, używalnych, zdawkowych i słabych;
- `Evidence Sufficiency`: claims z dowodami, claims bez dowodów, brakujące pointery;
- `Consultant Caution`: co może być prawdą tylko lokalnie, co wymaga ostrożności, czego nie wolno uogólnić;
- `Recommended Follow-ups`: pytania uzupełniające, brakujące role, dowody do zdobycia.

Akcje AI:

- oceń jakość materiału;
- wskaż brakujące role/głosy;
- zaproponuj follow-up questions;
- znajdź claims z za słabym evidence;
- wyjaśnij, jak szeroko wolno interpretować insight.

Reguły:

- karta powstaje po wygenerowaniu insightu i nie blokuje generowania;
- słaby materiał jest dopuszczalny, ale musi być widoczny;
- karta nie naprawia danych i nie usuwa limitations;
- `0` dla gaps/contradictions jest dozwolone tylko po udanym loadzie i faktycznej analizie;
- karta wpływa na confidence, candidate triage i downstream caution;
- jeśli materiał jest cienki, UI mówi konsultantowi, co mimo wszystko można bezpiecznie powiedzieć.

##### `consulting-readout` / Odczyt konsultingowy

Cel: pokazać interpretację konsultingową, czyli co z odpowiedzi wynika dla pracy konsultanta.

Zawartość:

- callout o zakresie interpretacji;
- jeśli są sprzeczności: critical callout z listą contradiction signals;
- kolumna `Official Answers`;
- kolumna `Issues / Risks`;
- kolumna `Signals / Opportunities`;
- każdy element jako spokojna karta/wiersz, bez przesadnego koloru;
- empty state per kolumna, jeśli brak danych.

Reguły:

- to nie jest automatyczny action plan;
- język ma być interpretacyjny, nie absolutny;
- issues i opportunities muszą odsyłać do evidence w innych kartach.

##### `candidate-triage` / Triage kandydatów

Cel: operator decyduje, które candidate findings przechodzą do P10 findingów.

Zawartość:

- warning callout: kandydaci nie są publishable truth;
- stat cards: kandydaci, ready, needs evidence, needs split;
- lista kandydatów;
- dla każdego kandydata: statement, triage status, confidence hint, follow-up type, source section, rationale;
- rekomendowany następny krok;
- jeśli kandydat jest powiązany z findingiem: readback block;
- jeśli kandydat ma divergence note: widoczny warning/tekst;
- linkowane stakeholder/session labels.

Statusy:

- `candidate`;
- `ready_for_review`;
- `needs_evidence`;
- `needs_split`;
- `rejected`;
- `promoted`.

Akcje:

- oznacz jako `needs evidence`;
- oznacz jako `needs split`;
- oznacz jako `ready for review`;
- odrzuć;
- promuj do findingu;
- dla powiązanego findingu: `share readback`, `confirmed`, `challenged`, `needs more evidence`.

Reguły:

- `promote_to_finding` tworzy albo linkuje do P10 finding;
- kandydat bez evidence nie może wyglądać jak finalny finding;
- `needs_split` wskazuje, że claim miesza kilka twierdzeń albo sprzeczności.

##### `people` / Perspektywy

Cel: pokazać insight przez role, osoby, działy i stakeholder lenses.

Zawartość:

- callout `Czytaj insight przez perspektywy ludzi`;
- przełącznik `Stakeholder lenses` / `Sesje / osoby`;
- filtry roli i działu;
- karty perspektyw;
- w każdej karcie: label, rola, dział, local summary, liczba wspieranych tematów;
- lista wspieranych tematów;
- badge tematu: `Wspólne`, `Lokalne`, `Sprzeczne`;
- local signals jako chips;
- contradiction callout dla tematów sprzecznych.

Reguły:

- karta nie tworzy nowych truth objects;
- pokazuje rozkład istniejących tematów/findingów po ludziach;
- perspektywy lokalne nie mogą być uogólniane na całą organizację.

##### `source-pack` / Pakiet źródeł

Cel: jawny pakiet źródeł dla insightu.

Zawartość:

- callout `Source / Evidence Pack`;
- stat cards: sesje, fragmenty, active pointers, degraded reasons;
- lista source entries;
- dla każdego entry: question text, answer snippet, respondent label, role/department, source session id;
- linked themes/issues/opportunities;
- captured pointers;
- degraded state: missing pointer, source unavailable;
- empty state, gdy pack nie jest jeszcze wygenerowany.

Reguły P10:

- source pack pokazuje materiał wejściowy, nie interpretację;
- pointer zostaje widoczny nawet jeśli źródło zniknie albo jest redacted;
- usunięcie pointera wymaga tombstone + removal reason;
- duplicate pointers są deduplikowane po `source_ref + source_fingerprint`.

##### `analysis-matrix` / Macierz Analizy

Cel: pokazać rozkład tematów/findingów względem osób, ról i pokrycia.

Zawartość:

- callout: `osoba x temat x zakres`;
- stat cards: posture, source sessions, lenses, consensus;
- coverage gaps jako warning callout;
- przełącznik lens mode: stakeholder/session;
- filtry roli i działu;
- sekcje: consensus topics, local-only signals, active lenses;
- macierz topic/lens/cell, jeśli dane są dostępne;
- cell states: supported, contradicted, local_only, not_observed.

Reguły:

- nie tworzy nowych claims;
- służy do sanity-checku reprezentatywności;
- `not_observed` nie oznacza braku problemu, tylko brak obserwacji w danych.

##### `themes` / Tematy

Cel: pokazać główne patterny/tematy z interview synthesis.

Zawartość:

- lista themes;
- dla każdego theme: title, description, strength, confidence, limits;
- evidence refs;
- cross-session pattern marker;
- perspective labels;
- linked P10 finding, jeśli istnieje;
- action/handoff tylko jeśli finding jest persisted i spełnia P10.

Reguły:

- theme jest patternem, nie zawsze publishable findingiem;
- jeśli ma być użyty downstream, musi zostać promowany/utrwalony jako P10 finding;
- confidence i limits muszą być widoczne przy claimach.

##### `issues-risks` / Problemy i ryzyka

Cel: pokazać problemy, ryzyka i napięcia wynikające ze źródeł.

Zawartość:

- lista issues/risks;
- dla każdego: title, description, severity, evidence refs, confidence, limits;
- marker cross-session lub local-only;
- divergence/contradiction note, jeśli istnieje;
- linked finding i jego readback/handoff status, jeśli istnieje.

Reguły:

- severity nie zastępuje confidence;
- causality wymaga wysokiego confidence i evidence;
- low confidence issue powinien wyglądać jak hypothesis/investigate, nie jak root cause.

##### `opportunities` / Szanse

Cel: pokazać opportunities i potencjalne kierunki działania.

Zawartość:

- lista opportunities;
- dla każdej: title, description, impact, evidence refs, confidence, limits;
- suggested move / next action, jeśli istnieje;
- linked finding albo candidate;
- downstream affordance tylko przez `artifact-actions` albo P10 handoff, nie przez lokalny bypass.

Reguły:

- opportunity nie jest jeszcze inicjatywą;
- feasibility, value i ownership muszą być walidowane przed handoff;
- low confidence opportunity trafia do validation/investigation.

##### `signals` / Sygnały

Cel: pokazać słabe sygnały, sprzeczności, anomalie i ukryte wzorce.

Zawartość:

- lista signals;
- type: contradiction, hidden signal, weak signal, anomaly lub podobny;
- title, description, supporting/contradicting evidence;
- confidence/limits, jeśli sygnał staje się claimem;
- recommended next action: validate, split, resolve contradiction, collect evidence.

Reguły:

- signal nie może automatycznie stać się findingiem;
- contradiction wymaga explicit UI i blokuje single narrative;
- karta może zasilać `candidate-triage`.

##### `evidence-map` / Mapa dowodów

Cel: mapować odpowiedzi źródłowe na tematy, problemy, opportunities i findingi.

Zawartość:

- callout wyjaśniający mapę;
- tabela inline;
- kolumny minimalne: answer/source, linked themes, linked issues, linked opportunities, evidence pointers;
- możliwość kliknięcia/otwarcia źródła, jeśli endpoint istnieje;
- empty state, gdy nie ma mapy;
- degraded marker dla missing/broken pointers.

Reguły:

- evidence map pokazuje relacje, nie pełny transcript;
- nie dubluje source pack;
- powinna być audytowalna i odporna na usunięte źródła.

##### `traceability` / Traceability

Cel: pokazać pełną ścieżkę audytową: source -> insight -> finding -> downstream artifact.

Zawartość:

- callout `Traceability to source answers`;
- lista source sessions i unavailable sessions;
- rows/cards dla źródeł z official answers, missing data i linked findings;
- downstream conversion links, jeśli istnieją;
- source unavailable/redacted/tombstone state;
- informacja, kiedy źródło nie jest dostępne z powodu permissions.

Reguły:

- traceability nie może znikać przy broken source;
- brak dostępu pokazuje degraded state, nie usuwa śladu;
- downstream artefakty muszą mieć back-link do source insight/finding.

##### `full-analysis` / Pełna Analiza

Cel: pokazać pełny raw AI output jako warstwę roboczą.

Zawartość:

- warning callout: raw AI narrative;
- stan `generating`, gdy analiza trwa;
- markdown/prose render pełnej treści;
- empty state `Brak treści`;
- brak lokalnych workflow actions poza nawigacją/scroll.

Reguły:

- raw analysis nie jest źródłem prawdy dla downstream;
- służy do audytu i debugowania interpretacji;
- downstream używa P10 findings, source pack i traceability.

##### `source-sessions` / Sesje Źródłowe

Cel: pokazać sesje, z których powstał insight.

Zawartość:

- lista source sessions;
- dla każdej: name, template name, link/open action;
- empty state `Brak sesji`;
- jeżeli sesja jest niedostępna: degraded/unavailable row.

Reguły:

- karta jest nawigacyjna i audytowa;
- nie dubluje Q&A; pełne answer snippets są w `source-pack`.

##### `comments` / Komentarze

Cel: współpraca wokół insightu.

Zawartość:

- `CommentsCanvas`;
- lista komentarzy;
- composer;
- priority low/normal/high;
- date filter i sort;
- delete hover action;
- AI enhance tylko jako propozycja tekstu, nie bezpośrednia mutacja truth.

Reguły:

- komentarze nie są evidence pointers, chyba że operator świadomie doda je jako `operator_note`;
- komentarze AI muszą być oznaczone jako AI, jeśli zostają zapisane.

##### `activity-log` / Aktywność

Cel: audit trail insightu.

Zawartość:

- `ActivityLogCanvas`;
- stat cards;
- chronologiczny feed;
- typy aktywności: created, status_change, candidate triage, finding promotion, readback, handoff, comment, conversion;
- old/new value dla zmian statusu albo readback;
- timestamp i actor.

Reguły:

- każda mutacja P10 powinna mieć activity entry;
- failed handoff/conversion nie może być ukryty;
- activity log jest read-only.

### 7.9 Karty dla Ideas i Notebook

Ideas:

1. `idea-brief`
2. `evidence`
3. `enrichment`
4. `related-knowledge`
5. `evaluation`
6. `promotion-path`
7. `mind-map`
8. `next-decision`

Notebook:

1. `note-content`
2. `related-context`
3. `knowledge-links`
4. `ai-summary`
5. `source-material`
6. `promotion-path`
7. `activity-log`

---

## 8. Wymagany format definicji karty

Każda nowa karta musi być opisana w tym formacie:

```md
### cardId

Label PL:
Label EN:
Type: universal | artifact-specific | tool-specific | optional
Default for:
Optional for:
Required:
Can user hide:
Can AI suggest:
Permissions:
Data source:
AI role:

Content:
- ...

Sections:
1. ...
2. ...

Actions:
- ...

Empty state:
- ...
```

Brak takiego opisu oznacza, że karta jest niezatwierdzona i nie może stać się nowym standardem.

---

## 9. Definition of Done dla karty N-mode

Karta jest gotowa tylko jeśli:

- ma stabilny `cardId`,
- ma label PL/EN,
- ma ikonę albo świadomą decyzję bez ikony,
- ma header z tytułem,
- ma opisane body,
- jeśli ma kilka obszarów, ma opisane sekcje,
- ma opisany empty state,
- ma opisane loading/error/degraded states, jeśli korzysta z danych,
- ma opisane actions,
- ma opisane AI role,
- ma określone czy user może ją ukryć,
- ma określone czy AI może ją zasugerować,
- ma zdefiniowane permissions,
- nie duplikuje istniejącej karty,
- używa shared komponentów, jeśli istnieją,
- nie tworzy lokalnego one-off UI.

---

## 10. Obserwacje zatwierdzone 2026-05-01

Na podstawie ekranów `My Work > Decyzje`:

- obecny `N-mode` jest dobrym kierunkiem jako format pracy,
- lewy rail z nazwami kart jest właściwym wzorcem,
- centralny canvas jest głównym obszarem roboczym,
- karty muszą mieć zawsze widoczny tytuł,
- jeżeli karta ma kilka logicznych części, dzieli się na sekcje,
- większe pola powinny mieć możliwość rozsunięcia / rozwinięcia,
- AI control przy blokach jest właściwym kierunkiem,
- AI menu typu `Wygeneruj`, `Popraw`, `Skróć`, `Rozwiń`, `Formalny ton` jest dobrym kierunkiem dla pola tekstowego,
- każda karta i sekcja musi jednak mieć opisaną rolę AI; bez tego AI button staje się przypadkowym ozdobnikiem,
- ustawienia widoku kart są wymagane, aby user mógł pokazywać/ukrywać karty jak kolumny w tabeli.
