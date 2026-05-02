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
