---
INSTRUKCJA: Skopiuj ten plik do ChatGPT. To specyfikacja planu V2 Consultify (122 taski). Część 1 z 3: T001–T040.
---

# V2 — Task specs (task-by-task ledger)

Owner: CTO/PO (Piotr + AI)  
Status: living document

## Jak pracujemy (task-by-task)

Cel tego pliku: doprowadzić **każdy task** do stanu „można wdrożyć bez domysłów”.

**Stany specyfikacji:**
- `draft`: pierwsza wersja (z założeniami)
- `review`: gotowe do przeglądu (brak dużych niewiadomych)
- `locked`: scope i DoD zamknięte (to implementuje zespół/Codex)
- `implemented`: wdrożone i zweryfikowane

**Zasady:**
- Każdy task ma: **business goal**, **Scope (V2)** (IN + **Future enhancements (post‑V2)**), **DoD**, **risks**, **open questions/decisions**, **analytics**, **rollout**.
- Jeśli brakuje danych, wpisujemy **Assumptions** i jednocześnie **Open questions**.
- W momencie `locked` nie zmieniamy scope — nowe pomysły idą do osobnej sekcji „post‑V2”.

## Delegowanie do Codex (kiedy i jak)

Gdy spec jest w `locked`, możemy oddać implementację do Codex (częściowo lub w całości).

**Pakiet wejściowy dla Codex (zawsze wklejany 1:1):**
- Task ID + tytuł
- Scope (V2) (IN + Future enhancements (post‑V2))
- DoD
- Krytyczne edge cases
- Oczekiwane testy / acceptance
- Jak zmierzyć (eventy/metryki)

## Szablon taska (kopiuj)

### Txxx — [TAG] Tytuł
- Status spec: draft
- Link / ID (ClickUp):
- Epic: (np. E6)
- Priorytet / V2 scope: (P0/P1/… + V2/post‑V2)

**Business challenge (problem):**

**Cel (outcome, nie feature):**

**Użytkownicy i scenariusze:**

**Scope (V2)**
- IN:
- Future enhancements (post‑V2):

**UX / UI notes:**

**Data / integrations:**

**Security / compliance:**

**Analytics (events/metrics):**

**Risks:**

**Open questions:**

**Definition of Done (DoD):**

**Acceptance / test plan:**

**Rollout plan:**

# Task specs (startujemy od 1 → 122)

## T001 — 🟪 chat — Chat Title Suggestion System
- Status spec: review
- Link / ID (ClickUp): TBD
- Epic: E2 (Chat & research wow)
- Priorytet / V2 scope: TBD

**Business challenge (problem):**
Historia czatów bez sensownych tytułów nie skaluje się — użytkownik nie potrafi szybko wrócić do rozmowy i traci wartość „pamięci systemu”.

**Cel (outcome, nie feature):**
Użytkownik widzi w historii czatów krótkie, trafne tytuły i może w 2–3 sekundy znaleźć właściwą rozmowę.

**Użytkownicy i scenariusze:**
- Użytkownik zakłada nowy chat w projekcie.
- Po kilku pierwszych wiadomościach system proponuje tytuł.
- Użytkownik akceptuje lub edytuje tytuł ręcznie.

**Scope (V2)**
- IN:
  - Automatyczna propozycja tytułu na bazie konwersacji (minimum: pierwsze N wiadomości lub po 1. user message — do ustalenia).
  - UI do edycji tytułu w historii czatów i/lub headerze rozmowy.
  - Fallback: jeśli AI nie działa → tytuł typu `New chat (YYYY-MM-DD)` (lub podobny).
- Future enhancements (post‑V2):
  - Wielokrotne propozycje (np. „regeneruj 5 opcji”) w v1.
  - Automatyczne retitle po czasie (może powodować chaos w historii).

**UX / UI notes:**
- Tytuł ma być krótki (np. 4–8 słów).
- Nie może zawierać wrażliwych danych (PII); jeśli istnieje ryzyko, tytuł ma być generyczny.

**Data / integrations:**
- Potrzebne: chatId, projektId, lista wiadomości (bez załączników) + język konwersacji.

**Security / compliance:**
- Tytuł nie powinien wyciekać PII do listy czatów (widocznej szerzej) — ograniczamy prompt + redakcja.

**Analytics (events/metrics):**
- `chat_title_suggested` (chatId, length, lang)
- `chat_title_edited` (chatId, deltaLength)
- `chat_title_accepted` (chatId)

**Risks:**
- Hallucynacje / nietrafne tytuły → spadek zaufania.
- PII w tytule → ryzyko compliance.

**Open questions:**
- Kiedy generujemy tytuł: po 1. wiadomości usera czy po 3–5 wymianach?
- Czy tytuł ma być po EN zawsze, czy zgodnie z językiem rozmowy?

**Definition of Done (DoD):**
- System generuje tytuł dla nowego czatu i zapisuje go.
- Użytkownik może edytować tytuł w UI.
- Fallback działa, gdy AI niedostępne.

**Acceptance / test plan:**
- Test: nowy chat → tytuł pojawia się w historii.
- Test: edycja tytułu → zapis i odświeżenie listy.
- Test: AI error → fallback.

**Rollout plan:**
- Feature flag per org/user.
- Włączamy najpierw dla kont demo.

---

## T002 — 🟪 chat — Project Sidebar Collapse
- Status spec: review
- Link / ID (ClickUp): TBD
- Epic: E2 (Chat & research wow)
- Priorytet / V2 scope: TBD

**Business challenge (problem):**
Przy wielu projektach sidebar robi się nieczytelny, rośnie koszt nawigacji i frustracja.

**Cel (outcome, nie feature):**
Użytkownik może zwinąć grupy projektów i szybciej dotrzeć do właściwego miejsca (mniej scrolla, mniej szumu).

**Użytkownicy i scenariusze:**
- Użytkownik ma 10+ projektów / grup.
- Zamyka (collapse) grupy, których nie używa w danej sesji.

**Scope (V2)**
- IN:
  - Collapse/expand na poziomie **grupy projektów** (u Ciebie: 2 prywatne grupy).
  - Collapse/expand **historii chatów** (lista rozmów) w obrębie projektu / sekcji czatu.
  - Persist stanu (per user) między odświeżeniami (desktop-first).
- Future enhancements (post‑V2):
  - Zaawansowane “pinning”, custom sort, multi-level nesting (jeśli nie istnieje).

**UX / UI notes:**
- Klik w chevron/ikonę, nie w nazwę (żeby nie mylić z nawigacją).
- Stan ma być widoczny (ikonografia).
- Styl: „desktop chat / ChatGPT-like” — minimalny noise, bardzo eleganckie spacing/hover/active.

**Data / integrations:**
- Preferencje użytkownika:
  - lista zwiniętych groupId
  - (opcjonalnie) per projekt: czy historia chatów jest zwinięta

**Security / compliance:**
- N/A (ale pamiętać o projektach, do których user nie ma access — nie renderujemy).

**Analytics (events/metrics):**
- `sidebar_group_collapsed` / `sidebar_group_expanded` (groupId)

**Risks:**
- Regresje nawigacji / broken keyboard navigation.

**Open questions:**
- Default state: czy grupy / historia chatów mają być domyślnie rozwinięte, czy częściowo zwinięte?
- Czy dodajemy akcję „Collapse all / Expand all”?

**Definition of Done (DoD):**
- Użytkownik może zwinąć/rozwinąć grupy projektów oraz historię chatów.
- Stan jest zapamiętany per user.
- Nie psuje responsywności.

**Acceptance / test plan:**
- Test: collapse → refresh → stan zachowany.
- Test: uprawnienia → nie pokazujemy cudzych projektów.

**Rollout plan:**
- Stopniowo: tylko desktop, potem mobile.

---

## T003 — 🟪 chat — Cloud Data Integration
- Status spec: review
- Link / ID (ClickUp): TBD
- Epic: (Integrations/data) TBD
- Priorytet / V2 scope: P1 / VC meeting scope

**Business challenge (problem):**
Dane klientów są w chmurze; ręczne uploady lokalne są niewygodne i nie skalują się dla enterprise.

**Cel (outcome, nie feature):**
Admin może podłączyć źródło danych, a użytkownik wybrać dataset do projektu — dane są bezpiecznie dostępne w kontekście pracy.

**Użytkownicy i scenariusze:**
- Admin podłącza konto dostawcy storage.
- Użytkownik wybiera dataset/folder i synchronizuje do projektu.

**Scope (V2)**
- IN:
  - Jeden provider w v1: **Google Drive** + bezpieczny OAuth.
  - Wybór datasetu/folderu i **jednorazowy import (copy-in snapshot)** do projektu (sync cykliczny jako opcja post‑V2).
- Future enhancements (post‑V2):
  - Multi-provider od razu.
  - Pełny bidirectional sync.

**UX / UI notes:**
- Wyraźne rozdzielenie: admin config vs user selection.

**Data / integrations:**
- OAuth tokens (bezpieczne przechowywanie), job importu, storage warstwa projektu.

**Security / compliance:**
- Minimal scopes, rotacja tokenów, audyt importu.
- Zgodność z politykami klienta (TBD).

**Analytics (events/metrics):**
- `cloud_source_connected`, `dataset_import_started`, `dataset_import_succeeded`, `dataset_import_failed`

**Risks:**
- Wysoki koszt i ryzyko integracji (API limity, błędy, security).

**Open questions:**
- (post‑V2) Czy i kiedy dokładamy sync cykliczny?
- Jak duże pliki/datasety wspieramy w V2 (limity)?

**Definition of Done (DoD):**
- Admin może podłączyć provider.
- User może wybrać dataset i zaimportować do projektu.
- Jest audit log importu + obsługa błędów.

**Acceptance / test plan:**
- Test: connect → list datasets → import → dane widoczne w projekcie.
- Test: revoke token → import fails gracefully.

**Rollout plan:**
- Najpierw tylko dla kont demo i 1–2 organizacji.

---

## T004 — 🟪 chat — Deep Thinking Module
- Status spec: review
- Link / ID (ClickUp): TBD
- Epic: E2 (Chat & research wow)
- Priorytet / V2 scope: V2 (VC meeting scope)

**Business challenge (problem):**
Użytkownik potrzebuje trybu „research-grade”, który daje głębsze źródła + profesjonalny raport, a nie tylko odpowiedź w czacie.

**Cel (outcome, nie feature):**
Deep Thinking ma działać jak w ChatGPT: po prawej stronie widać wyszukiwanie/źródła, a w czacie pojawia się 2–3 stronicowy raport, który można wyeksportować do Notes/KB.

**Użytkownicy i scenariusze:**
- Konsultant/owner projektu robi research pod decyzję/strategię.
- Włącza Deep Thinking → przegląda źródła (prawy panel) → otrzymuje raport → eksportuje do Notes/KB.

**Scope (V2)**
- IN:
  - Osobny tryb w czacie: „Deep Thinking”.
  - UI „ChatGPT-like”: **prawy panel** pokazuje wyszukiwanie/źródła/referencje (browsing view).
  - Raport generowany w czacie: **2–3 strony** (ustandaryzowany format), np.:
    - Executive summary
    - Kluczowe tezy/wnioski
    - Evidence / źródła
    - Implikacje / rekomendacje
    - Założenia i ograniczenia
  - Export raportu do Notes/KB (linkowalny artefakt).
- Future enhancements (post‑V2):
  - Pełny web crawler / płatne bazy danych.
  - Zaawansowane wizualizacje (grafy, mapy zależności) w V2+ (jeśli potrzebne).

**UX / UI notes:**
- Prawy panel jest kluczowy: użytkownik ma widzieć „skąd to jest” i móc szybko skanować wyniki wyszukiwania.
- Raport ma być „business-grade” i czytelny (nagłówki, listy, krótkie akapity).

**Data / integrations:**
- Źródła: mechanizm wyszukiwania/browsingu (TBD jak obecnie rozwiązany) + możliwość cytowania linków.
- Export: Notes/KB (TBD gdzie jest source of truth).

**Security / compliance:**
- Cytowane źródła muszą być publiczne / zgodne z zasadami pobierania.
- Raport musi mieć obowiązkową sekcję „assumptions/limitations”.

**Analytics (events/metrics):**
- `deep_thinking_started`
- `deep_thinking_report_generated` (pagesApprox, sourcesCount)
- `deep_thinking_exported` (target: notes/kb)

**Risks:**
- Koszt/latency browsingu.
- Jakość źródeł i ryzyko „źle zacytowane”.
- Zbyt długi output → gorsza czytelność (dlatego twardo 2–3 strony).

**Open questions:**
- Czy prawy panel ma mieć też ręczne pole wyszukiwania (user query), czy tylko „auto research view”?
- Jak technicznie liczymy „2–3 strony” (limity znaków/sekcji) — implementacja TBD.

**Definition of Done (DoD):**
- Użytkownik uruchamia Deep Thinking i widzi prawy panel research.
- Generuje się raport w formacie 2–3 stron z sekcją źródeł i ograniczeń.
- Raport da się wyeksportować do Notes/KB.

**Acceptance / test plan:**
- Test: uruchomienie trybu pokazuje prawy panel i generuje raport.
- Test: raport ma sekcję źródeł i sekcję ograniczeń.
- Test: export tworzy artefakt w Notes/KB i da się do niego wrócić.

**Rollout plan:**
- Na start: włączone dla kont demo + wewnętrznie (feature flag).

---

## T005 — 🟪 chat — Market Research Module
- Status spec: review
- Link / ID (ClickUp): TBD
- Epic: E2 (Chat & research wow)
- Priorytet / V2 scope: V2 (VC meeting scope)

**Business challenge (problem):**
Potrzebny tryb AI stricte do market research, który daje profesjonalny output (strategiczne dyskusje), zamiast „ogólnego chatu”.

**Cel (outcome, nie feature):**
Użytkownik uruchamia Market Research i otrzymuje profesjonalny raport (2–3 strony) w standardowym formacie, z prawym panelem research jak w ChatGPT, gotowy do eksportu do Notes/KB.

**Użytkownicy i scenariusze:**
- Product/strategy bada rynek produktu lub firmy.
- Konsultant przygotowuje „market snapshot” do spotkania z klientem.

**Scope (V2)**
- IN:
  - Osobny tryb w czacie: „Market Research”.
  - UI jak T004: **prawy panel** (research view) + raport w czacie.
  - Raport: **2–3 strony**, business-grade, ze stałym szablonem, np.:
    - Executive summary
    - Market overview + segmenty
    - Competitive landscape (kategorie + top players)
    - Positioning options + differentiators
    - Risks / unknowns
    - Assumptions / limitations
    - (opcjonalnie) References — jeśli da się sensownie wskazać
  - Export do Notes/KB.
- Future enhancements (post‑V2):
  - Pełne due diligence, płatne bazy danych.
  - Wymuszanie twardych źródeł jako warunku poprawności (post‑V2, jeśli potrzebne).

**UX / UI notes:**
- „Profesjonalne” = mało lania wody, dużo struktury i jasnych hipotez.
- References są mile widziane, ale nie blokują raportu (często trudno jednoznacznie ustalić „źródło”).

**Data / integrations:**
- Research view: ten sam mechanizm co T004 (TBD implementacyjnie).
- Export: Notes/KB.

**Security / compliance:**
- Obowiązkowe: assumptions/limitations (żeby nie udawać pewności).

**Analytics (events/metrics):**
- `market_research_started`
- `market_research_report_generated` (pagesApprox)
- `market_research_exported`

**Risks:**
- Jakość danych wejściowych → jakość raportu.
- „Overconfidence” — mitigujemy sekcją limitations.

**Open questions:**
- Czy robimy 1 szablon, czy 2 warianty (produkt vs firma) — w V2: 1, dopiero potem warianty (post‑V2).

**Definition of Done (DoD):**
- Użytkownik uruchamia tryb Market Research i widzi prawy panel research.
- Generuje się raport 2–3 strony w standardowym formacie z assumptions/limitations.
- Raport da się wyeksportować do Notes/KB.

**Acceptance / test plan:**
- Test: start trybu → raport generuje się i ma wymagane sekcje.
- Test: export tworzy artefakt w Notes/KB.

**Rollout plan:**
- Feature flag + start na kontach demo.

---

## T006 — 🟪 chat — Co‑Thinker Business Mode
- Status spec: review
- Link / ID (ClickUp): TBD
- Epic: E2 (Chat & research wow)
- Priorytet / V2 scope: V2 (VC meeting scope)

**Business challenge (problem):**
Generyczny chat nie prowadzi do „konsultingowej” jakości myślenia. Potrzebne są role/frameworki, które wymuszają strukturę i domykają temat decyzjami.

**Cel (outcome, nie feature):**
Użytkownik wybiera tryb (przycisk), a AI odpowiada w przewidywalnym formacie: krótkie rozumowanie w ramach roli + jasne, ponumerowane wnioski + zawsze „Next actions”.

**Użytkownicy i scenariusze:**
- Founder/PM chce szybko „zasymulować” dyskusję konsultantów.
- Użytkownik chce przejść od pomysłu do decyzji i planu działań.

**Scope (V2)**
- IN:
  - 5 trybów (przyciski) w czacie, każdy z własnym frameworkiem i formatem outputu:
    1) **Multi‑Consultant Panel** (dialog ról → synteza)
    2) **Idea Maker** (warianty + kreatywne opcje)
    3) **Competitive Analyst** (konkurencja + pozycjonowanie)
    4) **Risk Challenger** (dziury w planie, ryzyka, „co może pójść źle”)
    5) **Executive Editor** (skrócenie i uporządkowanie: 1‑pager / memo)
  - W trybie **Multi‑Consultant Panel**: najpierw widoczna krótka rozmowa ról (np. Strategy Lead / CFO / Ops / Tech), a potem:
    - 1 synteza
    - osobne, ponumerowane wnioski (zdania odrębne)
  - We wszystkich trybach: sekcja **Next actions** jest obowiązkowa.
- Future enhancements (post‑V2):
  - Edytor ról przez użytkownika, marketplace ról.
  - Zaawansowane pamiętanie person ról między chatami (post‑V2).

**UX / UI notes:**
- Przyciski mają być „desktop ChatGPT-like”: proste, czytelna hierarchia, bez noise.
- Output ma być krótki i wykonawczy; wnioski w punktach.

**Data / integrations:**
- Bazuje na kontekście projektu/organizacji (jeśli dostępne) + wiadomości w czacie.

**Security / compliance:**
- Jeśli w kontekście są dane wrażliwe, tryby nie powinny ich eksponować w „wnioskach” bez potrzeby.

**Analytics (events/metrics):**
- `cothinker_mode_selected` (mode)
- `cothinker_response_generated` (mode)

**Risks:**
- Zbyt długie outputy → spadek użyteczności (trzymamy format).
- Rozjazd jakości między trybami → potrzeba prompt governance.

**Open questions:**
- Nazwy ról w panelu (CFO/COO/CTO vs Strategy/Ops/Finance) — do dopracowania pod docelowych userów.

**Definition of Done (DoD):**
- Użytkownik może wybrać jeden z 5 trybów i dostaje odpowiedź w zdefiniowanym formacie.
- Multi‑Consultant pokazuje dialog ról + syntezę + ponumerowane wnioski.
- Każdy tryb kończy się sekcją **Next actions**.

**Acceptance / test plan:**
- Test: wybór trybu zmienia format outputu (snapshot/regression).
- Test: Multi‑Consultant zawsze zawiera dialog + syntezę + wnioski + next actions.

**Rollout plan:**
- Feature flag; start na kontach demo.

---

## T007 — 🟡 my work — Individual Tasks (ClickUp-like)
- Status spec: review
- Link / ID (ClickUp): TBD
- Epic: (My Work / Daily execution) TBD
- Priorytet / V2 scope: V2

**Business challenge (problem):**
Codzienna praca użytkownika jest w ClickUp (taski, listy, statusy). Jeśli Consultify ma stać się „command center”, użytkownik musi móc przenieść codzienne taski do nas, bez utraty podstawowych nawyków pracy.

**Cel (outcome, nie feature):**
Użytkownik prowadzi dzienną pracę w Consultify „jak w ClickUp”: szybko dodaje taski, widzi je w listach, zmienia statusy, planuje terminy i ma to spięte z kalendarzem/workload.

**Użytkownicy i scenariusze:**
- Użytkownik tworzy task podczas rozmowy lub pracy w module (quick add).
- Planowanie dnia/tygodnia: lista „My tasks” + terminy.
- Praca operacyjna: zmiana statusu, priorytetu, terminu, notatki.

**Scope (V2)**
- IN:
  - Osobne źródło tasków: **Personal tasks** (nie-inicjatywowe), przypisane do usera.
  - Widok **List** (ClickUp-like): kolumny + sort/filter.
  - Statusy (minimum): `To do / In progress / Done` (+ opcjonalnie `Blocked`).
  - Pola minimalne:
    - Title (wymagane)
    - Due date (opcjonalne)
    - Priority (opcjonalne: Low/Med/High)
    - Description / notes (opcjonalne)
    - Tags (opcjonalne)
  - Quick actions: inline edit, change status, mark done.
  - Sekcja „Today / This week / Later” (może być filtr na due date).
  - Integracja wewnętrzna: personal tasks są widoczne w **Project Calendar / workload** (w ustalonym zakresie).
- Future enhancements (post‑V2):
  - Zaawansowane custom fields, automations, dependencies jak w pełnym ClickUp.
  - Kompletny replacement ClickUp spaces/folders/lists (future enhancement).

**UX / UI notes:**
- Najważniejszy jest „speed”: dodanie taska ma być szybkie (1 linia + enter).
- Widok listy powinien wspierać pracę „w tabeli”: focus, klawiatura (TBD), bulk actions (post‑V2).

**Data / integrations:**
- Model danych tasków personalnych (oddzielny od initiative tasks, ale kompatybilny z calendar/workload).

**Security / compliance:**
- Taski są prywatne per user (domyślnie), chyba że świadomie udostępnione (post‑V2).

**Analytics (events/metrics):**
- `personal_task_created`
- `personal_task_completed`
- `personal_task_due_date_set`

**Risks:**
- Za duży scope jeśli spróbujemy „pełnego ClickUp”.
- Dublowanie modelu tasków (initiative vs personal) → trzeba pilnować spójności widoków.

**Open questions:**
- Czy personal tasks mają być widoczne też w kontekście projektów (tag/relacja), czy tylko „My Work”?
- Czy potrzebujemy widoku Kanban, czy List wystarczy? (propozycja: List jako domyślny)

**Definition of Done (DoD):**
- Użytkownik może tworzyć, edytować i zamykać personal taski.
- Widok listy jest używalny (sort/filter) i wspiera dzienną pracę.
- Taski pojawiają się w kalendarzu/workload (jeśli moduły są włączone).

**Acceptance / test plan:**
- Test: quick add → task pojawia się na liście.
- Test: zmiana statusu i due date → zapis i odświeżenie.
- Test: task „Done” znika z „Today” (jeśli filtr).

**Rollout plan:**
- Włączone dla kont demo + beta dla wybranych userów.

---

## T008 — 🟡 my work — External System Synchronization (defer)
- Status spec: draft
- Link / ID (ClickUp): TBD
- Epic: (Integrations) TBD
- Priorytet / V2 scope: defer / post‑V2

**Decision (session note):**
Najpierw dopinamy **pracę na taskach wewnątrz platformy** (ClickUp-like). Synchronizacje/integracje omawiamy później jako osobne taski/epiki.

**Open questions (na później):**
- Które integracje są P0 sprzedażowo (ClickUp? GCal? Slack/Teams? Email?)
- Czy sync ma być import-only czy bidirectional (per vendor)?
- Jak rozwiązujemy konflikty i źródło prawdy?

---

## T009 — 🟡 my work — My Ideas (Private Idea Repository)
- Status spec: review
- Link / ID (ClickUp): TBD
- Epic: (My Work / Knowledge) TBD
- Priorytet / V2 scope: V2

**Business challenge (problem):**
Pomysły powstają w czacie i giną w historii. Bez „prywatnego repo” użytkownik traci długoterminowy asset i nie wraca do wartościowych idei.

**Cel (outcome, nie feature):**
Użytkownik może łatwo zapisać ideę z czatu, uporządkować ją (title/body/tags) i otrzymywać kontekstowe przypomnienia podczas pracy na taskach i inicjatywach.

**Użytkownicy i scenariusze:**
- Użytkownik w czacie klika „Save to My Ideas” przy wiadomości/fragmencie.
- Potem w „My Work” przegląda idee, edytuje tytuł/treść, dodaje tagi.
- Podczas tworzenia taska lub inicjatywy system proponuje relewantne idee (2 miejsca: task + initiative).

**Scope (V2)**
- IN:
  - Repo idei **zawsze prywatne**.
  - Zapis idei z czatu (clip) + możliwość edycji w strukturze:
    - Title
    - Body (treść/nota)
    - Tags
    - (opcjonalnie) Link back do czatu/wiadomości źródłowej
  - Widok listy idei: search + filtry po tagach + sort (np. newest).
  - Kontekstowe „przypominanie” idei w 2 miejscach:
    1) podczas tworzenia/edycji **personal taska** (T007)
    2) podczas tworzenia/edycji **inicjatywy** (T032+ / TBD dokładnie gdzie w UI)
- Future enhancements (post‑V2):
  - Share do projektu/zespołu.
  - Zaawansowane rekomendacje „w całej aplikacji” (wiele surface’ów).

**UX / UI notes:**
- „Save idea” musi być szybkie (1 klik), a dopiero potem user może dopracować title/tags.
- Sugestie idei nie mogą przeszkadzać: mały, dyskretny panel (dismiss + “show more”).

**Data / integrations:**
- My Ideas storage per user.
- Relacja do źródła (chatId/messageId) — jeśli dostępna.

**Security / compliance:**
- Prywatne = niewidoczne dla innych userów/domyslnie niewysyłane do org context.

**Analytics (events/metrics):**
- `my_idea_saved` (source: chat)
- `my_idea_edited` (fieldsChanged)
- `my_idea_suggested` (surface: task|initiative)
- `my_idea_used` (surface, ideaId) — np. kliknięcie/insert

**Risks:**
- Niska trafność sugestii → user przestanie ufać.
- Zbyt agresywne podpowiedzi → irytacja (dlatego dyskretnie).

**Open questions:**
- Jaki minimalny algorytm sugestii na V2: relacje → tag-match → recency (embeddings jako ulepszenie)?

**Definition of Done (DoD):**
- Użytkownik zapisuje ideę z czatu i widzi ją w My Ideas.
- Użytkownik może edytować title/body/tags.
- System potrafi zasugerować ideę w taskach i inicjatywach (2 surface’y).

**Acceptance / test plan:**
- Test: save from chat → idea pojawia się na liście.
- Test: edycja title/tags → zapis.
- Test: w edycji taska/inicjatywy pojawia się sugestia idei i da się ją otworzyć/wykorzystać.

**Rollout plan:**
- Feature flag; start na kontach demo.

---

## T010 — 🟡 my work — Project Calendar
- Status spec: review
- Link / ID (ClickUp): TBD
- Epic: (My Work / Daily execution) TBD
- Priorytet / V2 scope: V2

**Business challenge (problem):**
Użytkownik potrzebuje planowania wykonania (dzień/tydzień) w jednym miejscu. Bez kalendarza taski „żyją w listach” i trudniej zarządzać terminami.

**Cel (outcome, nie feature):**
Użytkownik widzi w Consultify kalendarz z taskami z projektów (Consultify), a rzeczy bez terminu trafiają do Backlogu.

**Użytkownicy i scenariusze:**
- Użytkownik przegląda tydzień i widzi taski z projektów.
- Użytkownik planuje co robi dziś/this week.
- Task bez due date jest w Backlogu i może dostać termin później.

**Scope (V2)**
- IN:
  - Kalendarz wewnątrz Consultify (week/month — TBD).
  - Źródło danych: **taski z projektów w Consultify** (inicjatywowe / projektowe).
  - **Backlog** dla tasków bez due date.
  - Podstawowe akcje: zmiana due date (drag/drop TBD), otwarcie taska.
- Future enhancements (post‑V2):
  - Synchronizacja z zewnętrznymi kalendarzami (to jest później w osobnych taskach).
  - Zaawansowane planowanie zasobów całej organizacji.

**UX / UI notes:**
- Backlog powinien być widoczny obok kalendarza (np. lewy panel/lista) albo jako filtr/widok.
- Kalendarz ma być prosty i szybki, nie „przeładowany”.

**Data / integrations:**
- Wewnętrzny model tasków projektowych + due dates.

**Security / compliance:**
- Widoczność tasków zgodna z uprawnieniami projektu.

**Analytics (events/metrics):**
- `project_calendar_viewed`
- `task_due_date_changed` (source: calendar)

**Risks:**
- Niespójności modelu tasków (personal vs project) — na V2 trzymamy się „project tasks”.

**Open questions:**
- Czy w V2 pokazujemy tylko zadania przypisane do usera, czy też „all tasks w projekcie”?

**Definition of Done (DoD):**
- Użytkownik widzi kalendarz z taskami projektowymi z Consultify.
- Taski bez terminu są dostępne w Backlogu.
- Użytkownik może wejść w task i ustawić/zmienić termin.

**Acceptance / test plan:**
- Test: task z due date pojawia się w kalendarzu.
- Test: task bez due date pojawia się w backlogu.
- Test: zmiana due date aktualizuje widok.

**Rollout plan:**
- Feature flag; start na kontach demo.

---

## T011 — 🟡 my work — Intelligent Active Notebook (Notion-like)
- Status spec: review
- Link / ID (ClickUp): TBD
- Epic: (My Work / Knowledge) TBD
- Priorytet / V2 scope: V2

**Business challenge (problem):**
Notatki dziś są rozproszone (projekty, czat, „My Ideas”, wywiady). Użytkownik chce pracować „jak w Notion”: jeden notebook, gdzie wiedza się układa, a system aktywnie przypomina to, co ważne w kontekście bieżącej pracy.

**Cel (outcome, nie feature):**
Notebook działa Notion‑owo (pages + blocks + drzewo + search) oraz ma funkcję **Active Notes**: podczas pracy na taskach/inicjatywach/czacie pokazuje relewantne notatki i pomysły, które użytkownik może szybko wstawić/otworzyć.

**Użytkownicy i scenariusze:**
- Użytkownik robi notatki w trakcie pracy w projekcie i chce je łatwo odnaleźć.
- Użytkownik eksportuje raport (np. Deep Thinking / Market Research) do notebooka.
- Podczas tworzenia taska lub inicjatywy dostaje sugestię „Relevant notes / ideas”.

**Scope (V2) — Notion-like (final)**
- IN:
  - **Pages + tree**: notebook ma drzewo stron (sidebar) + widok strony.
  - **Block-based editor (subset)**:
    - Paragraph
    - Heading (H1/H2/H3)
    - Bulleted list / numbered list
    - Todo checkbox list
    - Toggle / collapsible section (na bazie istniejących wzorców UI)
    - Callout (info/warning) — spójne z UI standards
    - Divider
    - Simple table (opcjonalnie, jeśli macie gotowy building block)
  - **Search**: wyszukiwanie po tytułach i treści stron (full‑text + filtry po projektach/tagach).
  - **Tagowanie i relacje**:
    - tagi na stronach
    - relacja do `projectId` (note „z projektu”)
    - relacja do artefaktów (task/initiative/chat) jako linki (referencje; embed jako ulepszenie)
  - **Zbieranie wiedzy (agregacja)**:
    - „Notatki z projektów” → strony przypisane do projektu są widoczne w notebooku i w projekcie.
    - „My Ideas” (T009) → idee mogą być linkowane/wyświetlane w notebooku (bez utraty prywatności).
    - Export raportów (T004/T005) → tworzy nową stronę w notebooku (format report page).
  - **Active Notes (resurfacing)**:
    - Na ekranie taska (T007) i inicjatywy: panel „Relevant notes/ideas” (top 3–5).
    - W czacie: opcja „Insert from notebook” lub „Show relevant notes” (1 entrypoint).
    - Algorytm na V2: (1) linki/relacje (project/task/initiative) → (2) tag-match → (3) recency. (Embeddings jako ulepszenie).
- Future enhancements (post‑V2):
  - Pełny Notion database system (relations/rollups/views/kanban w notebooku).
  - Współdzielone, wieloosobowe edycje w czasie rzeczywistym (real‑time collab).
  - Zaawansowane embed views wszystkich artefaktów na stronie.

**UX / UI notes:**
- Ma być „jak Notion”: szybkie tworzenie strony, czysty edytor, zero rozpraszaczy.
- Klucz: klawiatura + slash menu (minimum: `/h1`, `/todo`, `/toggle`, `/callout`).
- UI musi być zgodne z `docs/ui-standards/` (nie wymyślamy nowych standardów komponentów).

**Data / integrations:**
- W kodzie już istnieją „notes” w niektórych modułach (Interview `NotesPanel`, MyWork textareas) — w V2 notebook jest **kanonicznym miejscem** na notatki, a artefakty mogą linkować do notebook pages.
- AI context już ma warstwę `knowledge` (`AIContextBuilder`) — notebook powinien móc wejść jako część tej warstwy (kontrolowane).

**Security / compliance:**
- Notebook pages mają poziomy widoczności:
  - `private` (default) — tylko user
  - `project` — widoczne dla członków projektu (ustawiane per strona)
  - `org` (future enhancement)

**Analytics (events/metrics):**
- `notebook_page_created`
- `notebook_page_edited`
- `notebook_search_used`
- `active_notes_suggested` (surface)
- `active_notes_opened` / `active_notes_inserted`

**Risks:**
- „Notion-like” może eskalować scope → trzymamy się subsetu blocków.
- Active Notes bez dobrej trafności irytują → zaczynamy od relacji/tagów i bardzo dyskretnego UI.

**Decisions (ustalone):**
- Entry point: **oba** (My Work → Notebook oraz Project → Notebook).
- Podejście: **Notion-like final** (block‑based editor + pages/tree + search).

**Definition of Done (DoD):**
- Użytkownik może tworzyć i edytować strony w notebooku (Notion-like UX).
- Strony można przypiąć do projektu + wyszukiwać po treści.
- Export z T004/T005 tworzy stronę w notebooku.
- Active Notes pokazuje relewantne strony/idee na tasku i inicjatywie + 1 entrypoint w czacie.

**Acceptance / test plan:**
- Test: create page → edit → search finds it.
- Test: link page to project → widoczne w kontekście projektu.
- Test: export report → powstaje strona w notebooku.
- Test: na tasku/inicjatywie pojawiają się 3–5 sugestii (relacje/tagi) i da się je otworzyć.

**Rollout plan:**
- Feature flag; start na kontach demo.

---

## T012 — 🟡 my work — Contextual Intelligence Feed (Chat-active)
- Status spec: review
- Link / ID (ClickUp): TBD
- Epic: (Chat / My Work / Personalization) TBD
- Priorytet / V2 scope: V2

**Business challenge (problem):**
Użytkownik nie chce osobnego „portalu newsów”. Chce, żeby **chat aktywnie podsuw﻿ał rzeczy ważne** w trakcie pracy i uczył się, co dla danej osoby jest istotne oraz jak często należy to pokazywać.

**Cel (outcome, nie feature):**
W czacie istnieje dyskretny mechanizm „Important signals”, który:
- pokazuje ważne informacje wtedy, gdy mają sens (kontekst użytkownika/projektu),
- uczy się preferencji użytkownika (tematy + częstotliwość),
- daje kontrolę (ustawienia / mute / snooze) bez zabijania proaktywności.

**Użytkownicy i scenariusze:**
- Użytkownik pracuje w czacie nad inicjatywą → dostaje podpowiedź: trend/ryzyko/benchmark związany z tematem.
- Użytkownik ignoruje dany typ sygnałów → system pokazuje rzadziej.
- Użytkownik zapisuje sygnał do notebooka (T011) lub My Ideas (T009).

**Scope (V2)**
- IN:
  - Feed jest **osadzony w czacie** (np. prawy panel / side panel, spójny z „ChatGPT-like” prawą kolumną).
  - Każdy sygnał ma:
    - tytuł
    - 2–3 zdania „dlaczego to ma znaczenie”
    - kontekst (tagi/projekt)
    - akcje: `Save to Notebook`, `Save to My Ideas`, `Mute topic`, `Snooze`
  - Personalizacja per user:
    - model „what matters” (tematy, kategorie)
    - model „how often” (częstotliwość, throttling)
    - uczenie na podstawie zachowań: open/save/mute/snooze/ignore
  - Ustawienia (w Settings):
    - poziom proaktywności (np. Low/Normal/High)
    - cisza nocna / godziny pracy (opcjonalnie)
    - lista wyciszonych tematów
- Future enhancements (post‑V2):
  - Rozszerzenie źródeł (więcej kanałów, integracje) i lepsze rankingi (embeddings).
  - Automatyczne tworzenie tasków/inicjatyw z sygnału (po governance).

**UX / UI notes:**
- To musi być „helpful, nie spam”: dyskretne, łatwe do zignorowania, ale łatwe do zapisania.
- Prawy panel w czacie ma być spójny wizualnie z T004/T005 (research view).

**Data / integrations:**
- Wejścia: kontekst user/project (AIContextBuilder), aktywność użytkownika, ewentualnie internet (jeśli enabled).
- Wyjścia: notebook pages / ideas (linkowanie).

**Security / compliance:**
- Jeśli internet disabled w org policies → feed tylko na bazie danych wewnętrznych i KB.
- Kontrola prywatności: preferencje są per user.

**Analytics (events/metrics):**
- `intelligence_signal_shown`
- `intelligence_signal_opened`
- `intelligence_signal_saved` (target: notebook|ideas)
- `intelligence_signal_muted`
- `intelligence_signal_snoozed`

**Risks:**
- Spam/noise → szybkie wyciszenie i throttling.
- Zaufanie: sygnały muszą być jasno opisane („why this matters”).

**Definition of Done (DoD):**
- W czacie istnieje panel/sekcja proaktywnych sygnałów.
- System uczy się preferencji użytkownika (na podstawie interakcji) i dostosowuje częstotliwość.
- Użytkownik ma kontrolę (mute/snooze + settings).
- Da się zapisać sygnał do Notebook lub My Ideas.

**Acceptance / test plan:**
- Test: sygnał pojawia się w czacie i ma akcje.
- Test: mute/snooze zmienia zachowanie (mniej/nie pokazuje).
- Test: save tworzy link/artefakt w notebook/ideas.

**Rollout plan:**
- Feature flag + start na kontach demo.

---

## T013 — 🟠 wywiad — Conversational Control Questions (AI interview conductor)
- Status spec: draft
- Link / ID (ClickUp): TBD
- Epic: (Interview / Data capture quality) TBD
- Priorytet / V2 scope: V2

**Business challenge (problem):**
Wywiad ma dawać **spójne, porównywalne dane** (struktura pytań, statusy, confidence), ale wypełnianie „formularza” jest wolne i sztuczne. Użytkownicy wolą rozmowę (tekst/voice), a dopiero potem ustrukturyzowanie odpowiedzi.

**Cel (outcome, nie feature):**
W ramach sesji wywiadu istnieje tryb rozmowy, w którym AI prowadzi respondenta przez pytania kontrolne, a system **automatycznie mapuje transkrypt → odpowiedzi** w `interview_questions` (facts-only), pokazuje luki i wymusza szybki review/akceptację przez użytkownika.

**Użytkownicy i scenariusze:**
- Konsultant/PM prowadzi discovery (sam lub z respondentem na callu) → odpowiada rozmową, a system uzupełnia Q&A.
- Respondent odpowiada w tekście (lub dyktuje) → AI dopytuje o braki i oznacza `needs_follow_up`.
- Po sesji: użytkownik generuje `Summary (facts only)` i eksportuje kontekst do narzędzi/assessment.

**Scope (V2)**
- IN:
  - Tryb „Conversational” w obrębie sesji wywiadu:
    - panel rozmowy (transkrypt) + panel listy pytań (task-list) z kategoriami: `strategy/operations/digital/people/finance`
    - widoczny progress (answered/total) i status sesji
  - AI jako „conductor”:
    - kolejność pytań może być dowolna (byle domknąć komplet), z możliwością `skip / back / add custom question`
    - gdy odpowiedź jest niepełna / niepewna → proponuje 1 krótkie pytanie doprecyzowujące oraz ustawia `needs_follow_up`
  - Automatyczne mapowanie rozmowy do odpowiedzi:
    - UI wysyła transkrypt (całość lub wybrane fragmenty) do `POST /interview/sessions/:sessionId/ai-parse`
    - wynik jest podglądem (draft) → użytkownik jednym kliknięciem akceptuje i zapisuje do `PATCH /interview/questions/:questionId` (`answerText`, `status=answered`, `confidenceScore`, `tags`)
  - AI draft pojedynczej odpowiedzi:
    - per pytanie: `POST /interview/questions/:questionId/ai-suggest` (facts-only + missing-data sentence) jako opcjonalny „starter”
  - Voice-ready:
    - wejście: dyktowanie (speech-to-text) do transkryptu
    - wyjście: odczyt pytania przez TTS (opcjonalnie)
    - w V2 przechowujemy **tekst transkryptu** (audio jako post‑V2, jeśli potrzebne)
  - 6 języków aplikacji:
    - zarówno UI jak i tryb conversational muszą wspierać: `en`, `pl`, `de`, `ar`, `jp`, `es`
    - język rozmowy/odpowiedzi: auto-detect + możliwość ręcznego override w UI (spójne z app language)
  - „Facts only” jako zasada:
    - rekomendacje / plany nie są zapisywane do odpowiedzi ani do summary; mogą powstać później w osobnych narzędziach
- Future enhancements (post‑V2):
  - Wieloosobowa sesja (współdzielony live transcript + role).
  - Przechowywanie audio + cytaty (timecodes) jako evidence.
  - Automatyczne tworzenie `Notes/Evidence` z fragmentów transkryptu.

**UX / UI notes:**
- „Jak chat”: AI pyta, user odpowiada; po prawej zawsze widać listę pytań i co już jest uzupełnione.
- Szybkie kontrolki przy odpowiedzi: `Mark answered`, `Needs follow‑up`, `Confidence 1–5`, `Tag: risk/constraint/opportunity/priority`.
- Niech system preferuje **krótkie doprecyzowania** zamiast długich monologów AI.

**Data / integrations:**
- Dane docelowe: `interview_questions` (answer_text, status, confidence_score, tags) + `interview_sessions` (progress, summary_*).
- Transkrypt: zapis jako lista wiadomości powiązana z sesją (własna tabela lub JSON w session) — wymagane dla audytu i ponownego mapowania.

**Security / compliance:**
- Transkrypt może zawierać PII → stosujemy te same zasady jak w czacie (redakcja/retencja wg polityk org).
- Dostęp:
  - owner sesji (pełny dostęp)
  - respondent (dostęp „oba”) — ale z ograniczonym widokiem (minimum potrzebne do odpowiedzi), bez ekspozycji danych projektu poza sesją

**Analytics (events/metrics):**
- `interview_conversational_started`
- `interview_transcript_message_added` (role=user|ai)
- `interview_ai_parse_requested` / `interview_ai_parse_applied`
- `interview_question_marked_answered`
- `interview_question_needs_follow_up`
- KPI: completion ratio, time-to-first-answer, %low-confidence, #follow-ups.

**Risks:**
- Over‑automation (błędne mapowanie) → zawsze etap review przed zapisem do pytań.
- „AI spam” w rozmowie → limit 1 follow-up na odpowiedź + łatwy skip.

**Decisions (ustalone):**
- Dostęp: owner + respondent („oba”).
- Kolejność: dowolna (byle domknąć komplet pytań).
- Język: wszystkie 6 języków aplikacji (`en`, `pl`, `de`, `ar`, `jp`, `es`) + auto-detect.

**Definition of Done (DoD):**
- W sesji wywiadu działa tryb rozmowy z panelem pytań (task-list) i postępem.
- Da się dodać transkrypt (tekst) i zmapować go do odpowiedzi przez `ai-parse`, a następnie zatwierdzić i zapisać do `interview_questions`.
- Da się oznaczać pytania `answered/needs_follow_up` + `confidenceScore`.
- Da się wygenerować `Summary (facts only)` oraz wykonać export kontekstu.

**Acceptance / test plan:**
- Test: sesja z template → conversational flow → minimum 5 pytań oznaczonych `answered`.
- Test: ai-parse nie uzupełnia pytań bez wsparcia w transkrypcie (puste/bez zmian).
- Test: summary nie zawiera rekomendacji (tylko fakty + gaps/constraints/pain points).

**Rollout plan:**
- Feature flag + start na kontach demo i wewnętrznych (dogfooding).

---

## T014 — 🟠 survey — Modern Survey Experience (N‑mode first, C‑mode later)
- Status spec: draft
- Link / ID (ClickUp): TBD
- Epic: (Survey / Completion / Data quality) TBD
- Priorytet / V2 scope: V2

**Business challenge (problem):**
Jeśli ankieta/assessment jest „ciężki” (słaba czytelność, brak poczucia postępu, zbyt dużo tarcia), użytkownicy **odpadają** albo odpowiadają byle jak. To obniża jakość danych i psuje konwersję w całym lejku (trial → paid, partner referrals, sponsor reports).

**Cel (outcome, nie feature):**
Survey/assessment w Consultify jest **nowoczesny jak najlepsze SaaS-y**: szybki, czytelny, z autosave i jasnym poczuciem postępu, działa świetnie na desktop i mobile, wspiera 6 języków (w tym RTL dla `ar`), a completion rate i jakość odpowiedzi rosną.

**Użytkownicy i scenariusze:**
- Respondent wypełnia ankietę na telefonie → widzi progress, może przerwać i wrócić (resume).
- Konsultant wypełnia razem z klientem na callu → szybka nawigacja po sekcjach, brak lagów, czytelne pytania.
- Użytkownik wraca po czasie → system kontynuuje od miejsca przerwania + pokazuje co zostało.

**Scope (V2)**
- IN:
  - Spójny „survey shell” dla wszystkich ankiet/assessmentów:
    - stały pasek postępu (sekcje + %)
    - jasne CTA i przewidywalny flow (Next/Back/Skip gdzie ma sens)
    - „resume” (kontynuuj od ostatniego miejsca) + autosave
    - zgodne z `docs/ui-standards/01-shell-layout/presentation-modes.md`:
      - **N‑mode** jako domyślny render (page-first: left nav + page canvas + properties strip)
      - architektura gotowa pod **C‑mode** później (action-first: command bar + taby)
  - Redesign UI elementów:
    - typography i spacing nastawione na czytelność
    - warianty pytań: single choice, multi choice, skala/poziom, free-text
    - inline validation (bez karania usera)
  - „Quality helpers” (bez spamu):
    - mikrocopy co oznacza skala / jak odpowiadać (tam gdzie potrzebne)
    - dla długich formularzy: „estimated time” + podział na sekcje
  - Performance:
    - szybkie renderowanie, brak przeładowań widoku przy każdej odpowiedzi
  - i18n:
    - pełne wsparcie 6 języków aplikacji: `en`, `pl`, `de`, `ar`, `jp`, `es`
    - obsługa RTL dla `ar` (layout + komponenty)
- Future enhancements (post‑V2):
  - A/B testy (microcopy / układ / progress) i optymalizacja na dużej skali.
  - Offline-first / słabe łącza (kolejka autosave).
  - Bardziej zaawansowane typy pytań (np. ranking, matrix) jeśli realnie potrzebne.

**UX / UI notes:**
- **Wymóg kluczowy:** wygląda i zachowuje się jak artefakt w N‑mode (spójny shell + visual language DBR77), a później ma naturalny upgrade do C‑mode.
- „Less noise”: hybryda:
  - **Section list view** (N‑mode) jako domyślny — pozwala skakać po sekcjach i szybko uzupełniać,
  - opcjonalny **focus flow** (single question / small block) tam gdzie zwiększa completion (szczególnie mobile i public link w T015).
- Mobile: duże targety kliknięć, brak „hover UX”, sensowne przewijanie.
- A11y: focus states, klawiatura, kontrasty, SR-friendly etykiety.

**Data / integrations:**
- Odpowiedzi zapisują się jako draft w tle (autosave) + finalizacja na submit.
- „Resume” opiera się o zapis pozycji/nawigacji użytkownika (podobnie jak istniejący `userState/navigation` w editorach assessment).

**Security / compliance:**
- Ankiety mogą być w trybie internal (po loginie) i przygotowane pod zewnętrzny link (guest) w T015.
- Rate limiting / abuse protection dla publicznych wejść (gdy wejdzie T015).
- PII: jasna polityka retencji i redakcji tam, gdzie to wymagane.

**Analytics (events/metrics):**
- `survey_started`
- `survey_resumed`
- `survey_question_answered` (type, timeSinceStart)
- `survey_section_completed`
- `survey_completed`
- `survey_abandoned` (lastSection, elapsed)
- KPI: completion rate, drop-off per section, avg time, %incomplete, %edited answers.

**Risks:**
- Zbyt duży redesign naraz → ryzyko regresji w istniejących frameworkach (DRD/SIRI/…); potrzebny stopniowy rollout (feature flag per view).
- Niespójne treści tłumaczeń → trzeba dopiąć copy i klucze i18n.

**Decisions (ustalone):**
- UI: **N‑mode** jako standard wizualny i układowy (C‑mode później).
- Domyślny flow: **hybryda** (section list view + opcjonalny focus flow).
- Progress: pokazujemy **„X z Y sekcji”** + opcjonalnie % w mikro-tekście (bez presji).

**Definition of Done (DoD):**
- Ankiety/assessment mają spójny, nowoczesny UX (progress + autosave + resume).
- Mobile i a11y nie są „po fakcie” — działają w standardowych scenariuszach.
- 6 języków działa poprawnie (w tym RTL dla `ar`).
- Mierzymy completion + drop-off i widzimy poprawę vs baseline (choćby na kontach demo/seed).

**Acceptance / test plan:**
- Test: rozpoczęcie ankiety → odpowiedź → refresh → stan jest zachowany (autosave).
- Test: przerwanie → resume działa (wraca do ostatniej sekcji).
- Test: mobile viewport (np. iPhone) — brak krytycznych problemów.
- Test: `ar` — layout RTL nie psuje nawigacji i pól.

**Rollout plan:**
- Feature flag + włączenie najpierw dla jednego typu ankiety/assessment (np. Wizard), potem kolejne widoki.

---

## T015 — 🟢 acquisition — External AI Self‑Assessment Link (public mini‑assessment)
- Status spec: draft
- Link / ID (ClickUp): TBD
- Epic: (Acquisition / Trial conversion) TBD
- Priorytet / V2 scope: V2 (monetyzacja/konwersja)

**Business challenge (problem):**
Potrzebujemy wejścia „bez tarcia”: potencjalny klient/partner ma dostać wartość w 2–3 minuty bez onboardingu, a my mamy zebrać sygnał o potrzebie i doprowadzić do konwersji (rejestracja/trial/booking).

**Cel (outcome, nie feature):**
Istnieje publiczny link do mini‑assessmentu, który:
- działa świetnie na mobile (T014 survey shell),
- generuje krótki, wiarygodny AI wynik (facts + interpretacja),
- kończy się jasnym CTA (start trial / umów demo / zostaw kontakt),
- zapisuje wynik w systemie jako lead artefakt (do późniejszej pracy w aplikacji).

**Użytkownicy i scenariusze:**
- Partner wysyła link do klienta → klient wypełnia 6–12 pytań → dostaje wynik → zostawia e‑mail → rejestruje trial.
- Sales wysyła link przed spotkaniem → wynik trafia do organizacji (lub do „lead inbox”) i jest bazą rozmowy.

**Scope (V2)**
- IN:
  - Publiczny URL (shareable) do mini‑assessmentu:
    - 6 języków aplikacji: `en`, `pl`, `de`, `ar` (RTL), `jp`, `es`
    - UX: focus flow (single-question / small blocks) + jasny progress (X/Y)
    - autosave/resume opcjonalnie (jeśli user poda e‑mail lub ma „magic link”)
  - Minimalny zestaw pytań:
    - predefiniowany template (1–2 warianty max w V2), bez edytora dla usera
    - pytania tak dobrane, by AI mogło wygenerować sensowny wynik bez „halucynacji”
  - AI wynik po submit:
    - krótki „executive snapshot” (1 ekran) + 3–5 bullet insightów
    - jawne założenia + ograniczenia („based on your answers”)
    - CTA do kolejnego kroku (trial / demo / contact)
  - Zapis wyniku:
    - zapis rekordu „external assessment” z odpowiedziami + AI wynikiem + metadanymi (source, partner code, language)
    - widok wewnętrzny w aplikacji (dla zespołu) w standardzie **N‑mode** (czytelny artefakt)
    - przygotowane pod późniejszy **C‑mode**: możliwość dopytania rozmową i doprecyzowania odpowiedzi (post‑V2)
- Future enhancements (post‑V2):
  - Edytor szablonów dla partnerów/sales.
  - Magic link resume bez e‑maila.
  - C‑mode follow‑up interview (AI zadaje pytania uzupełniające).

**UX / UI notes:**
- Publiczny widok ma być „clean landing‑survey”: minimalny chrome, zero rozpraszaczy.
- Wynik musi wyglądać „enterprise‑credible” (bez marketingowej waty).
- Wewnętrzny widok wyniku (po zalogowaniu) ma być N‑mode: left nav + canvas + properties.

**Data / integrations:**
- Backend: nowy publiczny endpoint do submitu (guest) + wewnętrzny endpoint do listowania wyników.
- Wykorzystujemy istniejący kierunek `external_assessments` (server ma już routes do zapisu/listy po auth).
- Atrybucja: `utm_*`, `partnerCode`, `sourceCampaign`.

**Security / compliance:**
- Abuse protection: rate limiting + opcjonalnie CAPTCHA na publicznym submit.
- PII: e‑mail/imię opcjonalne, jasno komunikowane; retencja wg polityk.
- Multi‑tenant: wynik przypisany do org lub „lead inbox” (jeśli bez org).

**Analytics (events/metrics):**
- `external_assessment_opened`
- `external_assessment_started`
- `external_assessment_completed`
- `external_assessment_result_viewed`
- `external_assessment_cta_clicked` (trial|demo|contact)
- KPI: completion rate, CTA conversion, lead→trial, partner attribution.

**Risks:**
- Zbyt mało pytań → słaby wynik; zbyt dużo → spadek completion. Musi być precyzyjny balans.
- Public abuse/spam → potrzebne limity i monitoring.

**Open questions (do decyzji):**
- Czy wynik ma być dostępny bez podania e‑maila, czy e‑mail jest wymagany do zobaczenia pełnego wyniku?
- Gdzie trafia lead, jeśli nie ma organizacji: osobna „Lead Inbox” w SuperAdmin/Sales, czy tworzymy tymczasową org?

**Definition of Done (DoD):**
- Istnieje publiczny link do mini‑assessmentu (6 języków, mobile‑ready, RTL dla `ar`).
- Po submit user dostaje AI wynik + CTA.
- Wynik zapisuje się w systemie i da się go zobaczyć w aplikacji jako artefakt N‑mode.

**Acceptance / test plan:**
- Test: wypełnienie na mobile → completion bez błędów, wynik się generuje.
- Test: `ar` (RTL) → układ poprawny.
- Test: rate limiting działa (brak masowego spamu).
- Test: wynik jest widoczny po zalogowaniu w aplikacji.

**Rollout plan:**
- Feature flag + rollout najpierw na linkach partnerów/sales wewnętrznych.

---

## T016 — 🟠 interview — Advanced Insight Inference Engine (sponsor‑ready, structured)
- Status spec: draft
- Link / ID (ClickUp): TBD
- Epic: (Interview → Insights → Reporting) TBD
- Priorytet / V2 scope: V2

**Business challenge (problem):**
Samo „zbieranie danych” (ankieta/wywiad) nie sprzedaje wartości. Sponsor/zarząd oczekuje **wniosków, które da się obronić**: co z tego wynika, na jakich dowodach, z jaką pewnością i co to znaczy dla decyzji/priorytetów. Bez tego raport jest „ładnym tekstem” i traci zaufanie.

**Cel (outcome, nie feature):**
System potrafi wygenerować **ustrukturyzowane insighty** z danych (wywiady/ankiety/kontekst), w formacie:
\(insight → evidence → implication/recommendation + confidence\),
które:
- są renderowane w aplikacji w czytelnej formie (N‑mode),
- mają traceability do źródeł,
- mogą być eksportowane do narzędzi/assessment oraz stanowią bazę pod T017 (Sponsor‑Level Report).
- są **sensowne i wyważone** (bez skrajności): pokazują niepewność, alternatywne interpretacje i przeciw‑argumenty tam, gdzie dane są mieszane.

**Użytkownicy i scenariusze:**
- Konsultant kończy wywiady (T013) / ma dane z assessment (T014/T015) → uruchamia inference → dostaje listę insightów z evidence i confidence.
- Sponsor przegląda insight pack w N‑mode → klika „Export to report”.
- Zespół iteruje: mark „needs review”, dopina evidence, regeneruje tylko wybrane insighty.

**Scope (V2)**
- IN:
  - „Inference run” generujący **structured output** (JSON), nie tylko markdown.
  - Wejścia (minimum):
    - `interview_sessions` + `interview_questions` (answers/status/confidence/tags)
    - (opcjonalnie) wyniki assessment / external assessments
    - organization context (company facts) jako tło
  - Wyjście:
    - lista insightów w standaryzowanym schemacie, np.:
      - `category` (risk/opportunity/constraint/priority/trend/gap)
      - `statement` (1–2 zdania)
      - `why_it_matters` (implication)
      - `recommendation` (jeśli włączone; wyraźnie oznaczone jako rekomendacja, nie fakt)
      - `confidenceScore` (1–5)
      - `evidence[]` (odwołania do: sessionId + questionId + cytat/fragment answerText)
      - `assumptions[]` / `unknowns[]`
  - Traceability & governance:
    - każdy insight ma „Evidence” i jawny confidence (bez „magii”)
    - status insightu: `draft|reviewed|approved` (lub mapowanie na istniejące statusy)
  - Jakość i „wyważenie” analizy (MUST):
    - insighty muszą zawierać `unknowns[]` + (jeśli dotyczy) **counterpoints** / „what could be wrong”
    - przy mieszanych danych (różne odpowiedzi respondentów / niska pewność) engine ma:
      - obniżyć confidence,
      - wskazać sprzeczności,
      - zaproponować minimalny follow‑up (1–3 pytania) zamiast „twardych” wniosków
  - Storage:
    - wykorzystujemy istniejące magazyny insightów (preferencja: `project_intelligence_insights.content` jako JSON) albo `interview_insights` rozszerzone o structured content
    - zachowujemy kompatybilność z istniejącym `InterviewInsightService` (markdown) — inference engine to osobny typ/tryb
  - UI:
    - N‑mode „Insight pack” (page-first): left nav (kategorie) + canvas (lista + detail) + properties (status, confidence, export)
    - akcje: `Approve`, `Needs review`, `Regenerate`, `Export`
  - Export:
    - `Export to Tools/Assessment` (re‑use istniejących mechanizmów eksportu insightów),
    - przygotowanie danych pod T017 (report templates).
  - Kontekst AI konsultanta (MUST):
    - zatwierdzone insighty + raporty (T017) stają się częścią „pamięci” projektu/organizacji:
      - są dołączane do kontekstu AI (chat, deep thinking, co‑thinker) jako źródło prawdy,
      - są wyszukiwalne i linkowalne (ID, projekt/inicjatywa, źródła, data, status),
      - AI ma obowiązek cytować/odwoływać się do tych insightów, gdy są relewantne dla inicjatyw/wykonania.
    - integracja ma działać szczególnie w module **Inicjatywy**: AI ma używać zatwierdzonych insightów do wyważonej analizy ryzyk/korzyści, priorytetów i narracji sponsor‑ready.
- Future enhancements (post‑V2):
  - Causal inference / stat modeling.
  - Automatyczne wykrywanie sprzeczności między respondentami.
  - C‑mode do „live interrogation” insightu (dopytaj AI o dowody i alternatywne interpretacje).

**UX / UI notes:**
- W N‑mode insighty mają być „skanowalne”: tytuł + 2 linie + confidence badge.
- Evidence zawsze widoczne (nie jako ukryty detal), choćby w formie „top 1–2 sources” + „show all”.
- Rekomendacje są wyraźnie oznaczone i oddzielone od faktów (żeby nie mieszać z „facts only” w danych wejściowych).

**Data / integrations:**
- Engine powinien preferować dane o wyższej jakości:
  - answered + confidence >= 3 jako primary signals,
  - `needs_follow_up` i low confidence jako „gaps/unknowns”.

**Security / compliance:**
- Insighty nie mogą ujawniać PII z transkryptów/odpowiedzi — redakcja jak w czacie.
- Multi‑tenant: scope per org/project.

**Analytics (events/metrics):**
- `inference_run_started` / `inference_run_completed` / `inference_run_failed`
- `insight_generated` (category, confidence)
- `insight_approved` / `insight_regenerated` / `insight_exported`
- `insight_used_in_ai_context` (surface: chat|initiative|report|tool)
- KPI: % insightów użytych w raportach, time-to-first-sponsor-pack, feedback jakości.

**Risks:**
- „Brzmi mądrze, ale nie do obrony” → twardy wymóg evidence + confidence + unknowns.
- Halucynacje → schema + ograniczenie do danych wejściowych + review gate.

**Open questions (do decyzji):**
- Czy rekomendacje są częścią V2 inference, czy w V2 generujemy tylko „implications” i zostawiamy rekomendacje na T017?
- Czy inference run jest per project, per org, czy per zestaw sesji/assessmentów?

**Definition of Done (DoD):**
- Da się uruchomić inference na danych z wywiadów/assessment i dostać structured insighty z evidence+confidence.
- Insight pack jest renderowany w N‑mode i ma workflow review/approve.
- Insighty da się eksportować (Tools/Assessment) i są gotowe jako input pod T017.

**Acceptance / test plan:**
- Test: inference na 2 completed interview sessions → generuje min. 5 insightów w JSON schemacie.
- Test: każdy insight ma >=1 evidence link do źródła.
- Test: low-confidence/needs-follow-up trafiają do gaps/unknowns.
- Test: export działa i tworzy downstream artefakt.

**Rollout plan:**
- Feature flag + start na kontach demo, potem wybrane org (współpraca z konsultantami).

---

## T017 — 🟣 reporting — Sponsor‑Level Analysis Report (N‑mode first, PPTX export)
- Status spec: draft
- Link / ID (ClickUp): TBD
- Epic: (Reporting / Sponsor narrative) TBD
- Priorytet / V2 scope: V2

**Business challenge (problem):**
Sponsor/zarząd potrzebuje krótkiego, klarownego i **obronionego** raportu („board‑ready”), bez przekopywania się przez surowe odpowiedzi. Jednocześnie raport musi być spójny z danymi i wyważony (counterpoints, niepewność), inaczej traci wiarygodność i nie działa sprzedażowo.

**Cel (outcome, nie feature):**
Z danych z wywiadów/assessmentów system generuje **Sponsor‑Level report** wg profesjonalnego szablonu, który:
- jest przeglądany i edytowany w aplikacji jako artefakt **N‑mode**,
- wykorzystuje **zatwierdzone insighty** z T016 (evidence + confidence),
- ma workflow review/approve,
- eksportuje się do formatów używalnych na spotkaniu (minimum: **PPTX**, opcjonalnie PDF/DOCX),
- zasila kontekst AI konsultanta (kolejne rozmowy i inicjatywy odwołują się do raportu).

**Użytkownicy i scenariusze:**
- Konsultant wybiera projekt/assessment + zestaw insightów → generuje raport → dopina korekty → eksportuje PPTX na spotkanie.
- Sponsor dostaje deck → po spotkaniu zespół oznacza raport jako „UTILIZED” i loguje outcome/feedback.

**Scope (V2)**
- IN:
  - Report templates (sponsor‑level):
    - 1–2 kanoniczne template’y w V2 (żeby dowieźć jakość), np. „Executive Board” i „Owner/PM”.
    - sekcje mapowane do istniejącego lifecycle (`assessment_reports` + `assessment_report_sections`) i/lub Report Builder.
  - Dane wejściowe:
    - assessment / external assessment (T014/T015),
    - interview sessions + summary facts (T013),
    - **approved insights** z T016 (wymagane źródło wniosków).
  - Wymóg jakości (MUST):
    - każdy kluczowy wniosek w raporcie ma odwołanie do evidence (źródło/insight),
    - raport jest **wyważony**: zawiera `assumptions`, `unknowns`, oraz (jeśli dotyczy) „counterpoints”.
  - UI (N‑mode first):
    - raport jako artefakt N‑mode (page-first): left nav po sekcjach, canvas z treścią, properties strip (status, owner, language, export).
    - sekcje edytowalne (human-in-the-loop): AI generuje draft, user może poprawić (z historią wersji).
    - przygotowane pod C‑mode later: „command bar + taby” do throughput (post‑V2).
  - Workflow:
    - statusy zgodne z istniejącymi (`DRAFT/GENERATING/PENDING_APPROVAL/APPROVED/FINAL/UTILIZED/ARCHIVED`),
    - approve/reject z reason + audit trail,
    - „utilization notes” po użyciu na spotkaniu.
  - Export:
    - **PPTX** jako primary (preferencja: pipeline v2 `?version=2`),
    - opcjonalnie PDF/DOCX (jeśli już wspierane w module reportów),
    - eksport zachowuje spójność narracji (kolejność slajdów = kolejność sekcji).
  - i18n:
    - raport generowany i eksportowany w 6 językach aplikacji: `en`, `pl`, `de`, `ar` (RTL w UI; PPTX może być LTR fallback), `jp`, `es`.
- Future enhancements (post‑V2):
  - Custom branding per klient + full deck builder.
  - C‑mode operacyjny do „rapid edit” i „rapid export”.
  - Automatyczne tworzenie „meeting minutes / outcomes” powiązane z raportem.

**UX / UI notes:**
- N‑mode: czytelność jak dokument — bez „dashboardu z kartami”.
- Above-the-fold: executive snapshot + 3–5 key messages + CTA „Export PPTX”.
- Każda sekcja ma małe „sources” (insight IDs) i szybkie „jump to evidence”.

**Data / integrations:**
- Reuse: istniejące tabele `assessment_reports` + `assessment_report_sections` + historia wersji sekcji.
- Reuse: **generator raportów** (AI content generation + sekcje) jako źródło draftów.
- Reuse: **generator prezentacji / eksportów**:
  - PPTX: pipeline v2 (optymalnie `?version=2`) jako primary,
  - PDF/DOCX: jeśli włączone w module eksportów.
- To wszystko jest rozwijane/utwardzane w dalszych taskach dot. „report generator” i „presentation generator” — T017 ma z tego korzystać, nie duplikować logiki.

**Security / compliance:**
- Dostęp wg org/project permissions + audit log eksportów.
- PII redaction: raport nie może cytować PII; sources muszą być zredagowane/anonimizowane.

**Analytics (events/metrics):**
- `sponsor_report_created`
- `sponsor_report_generated`
- `sponsor_report_section_edited`
- `sponsor_report_approved` / `sponsor_report_rejected`
- `sponsor_report_exported` (format: pptx|pdf|docx, version: v1|v2)
- `sponsor_report_utilized`
- KPI: time-to-deck, % approved without heavy edits, feedback sponsor.

**Risks:**
- Zbyt „marketingowy” ton → utrata zaufania: twarde evidence + counterpoints.
- Zbyt długi deck → nudzi sponsorów: limity sekcji/slajdów + rules engine w PPTX pipeline.

**Open questions (do decyzji):**
- Primary output: czy w V2 traktujemy PDF/DOCX jako „nice to have”, a PPTX jako must?
- Minimalny zestaw sekcji w V2 (ile slajdów max na board deck)?

**Definition of Done (DoD):**
- Da się wygenerować sponsor‑level raport z danych + approved insights (T016).
- Raport jest przeglądany w N‑mode, ma workflow approve i wersjonowanie sekcji.
- Export PPTX działa i jest „sponsor‑ready”.
- Raport zasila kontekst AI konsultanta (można go przywołać w czacie/inicjatywach jako źródło).

**Acceptance / test plan:**
- Test: raport z 1 assessment + 2 interview sessions + insight pack → generuje 1 deck i 1 widok N‑mode.
- Test: export PPTX (v2) przechodzi quality gates (max bullets/slide, długości tytułów).
- Test: approve/reject i historia sekcji działa.

**Rollout plan:**
- Feature flag; start na demo org + wewnętrzne case’y consultingowe.

---

## T018 — 🟦 tools — Known Tools Module (library + education, N‑mode)
- Status spec: draft
- Link / ID (ClickUp): TBD
- Epic: (Tools library / Trust & adoption) TBD
- Priorytet / V2 scope: V2

**Business challenge (problem):**
Żeby Consultify było wiarygodne dla enterprise i konsultantów, musi mieć „wspólny język metod”: znane, darmowe narzędzia konsultingowe opisane i osadzone w pracy. Bez tego narzędzia wyglądają jak „autorskie” i trudniej je sprzedać / wdrożyć.

**Cel (outcome, nie feature):**
W aplikacji istnieje moduł **Known Tools** (biblioteka), który:
- prezentuje standardowe narzędzia (metodyki rynkowe) w spójnym UX,
- uczy „kiedy i jak używać” (krótko, praktycznie),
- pozwala w 1 klik przejść z narzędzia do pracy w platformie (inicjatywy/raporty/notatki),
- zasila kontekst AI konsultanta (AI wie „jak stosować” te narzędzia i cytuje je).

**Użytkownicy i scenariusze:**
- Konsultant wybiera narzędzie → widzi purpose/steps/output → uruchamia narzędzie w projekcie.
- Klient enterprise przegląda bibliotekę → widzi, że pracujecie na standardach, nie „magic AI”.

**Scope (V2)**
- IN:
  - Katalog narzędzi (minimum: lista + detail):
    - nazwa, krótki opis, kiedy używać, wejścia/wyjścia, kroki
    - tagi/kategorie (strategic/operational/transformation itd. — zgodnie z docelową biblioteką)
  - UI standard:
    - listing jako tabela/karty w standardzie aplikacji,
    - detail narzędzia jako artefakt **N‑mode** (page-first: sections + content), spójny z `docs/ui-standards/`.
  - Pozycjonowanie:
    - „uczymy jak używać”, nie „nasze autorskie”
    - language neutral: tool ma opis w 6 językach aplikacji (jeśli tłumaczenia gotowe; inaczej fallback EN).
  - Integracja z pracą:
    - link „Use in project” / „Start tool session” (wejście do istniejącego Tools engine),
    - możliwość zapisania do Notebook (T011) / cytowania w raporcie (T017).
  - AI context:
    - tool descriptions + „how to apply” są włączane do kontekstu AI konsultanta (jako źródło referencyjne), z cytowaniem nazwy narzędzia.
- Future enhancements (post‑V2):
  - Rekomendacje narzędzi przez AI per kontekst (personalizacja).
  - Wideo per narzędzie (to jest osobny task „tool-linked knowledge base”).

**UX / UI notes:**
- Biblioteka ma być szybka: search + filtry + jasne kategorie.
- Detail ma mieć „quick apply”: CTA do uruchomienia w projekcie.

**Data / integrations:**
- Źródło prawdy: Tools library (CMS/seed) — do ustalenia gdzie przechowywane.
- Powiązania: toolId ↔ tool session ↔ project/initiative/report.

**Security / compliance:**
- Dostęp wg planu/feature flags (jeśli część narzędzi jest premium później).

**Analytics (events/metrics):**
- `known_tools_opened`
- `known_tool_viewed` (toolId)
- `known_tool_started_in_project` (toolId, projectId)
- KPI: adoption (tool sessions/user), time-to-first-tool, wpływ na conversion.

**Risks:**
- Content quality: jeśli opisy są słabe → spadek zaufania. Musi być krótko, konkretnie, „consulting-grade”.

**Open questions (do decyzji):**
- Minimalny zestaw narzędzi w V2: 10? 20? (na VC: lepiej mniej, ale perfekcyjnie).
- Czy Known Tools to „read-only library”, czy od razu tworzy tool sessions?

**Definition of Done (DoD):**
- Jest biblioteka Known Tools (lista + detail) w spójnym UI.
- Każde narzędzie ma instrukcję użycia + CTA do rozpoczęcia pracy w projekcie.
- Treści są dostępne dla AI konsultanta jako kontekst referencyjny.

**Acceptance / test plan:**
- Test: wejście do biblioteki → wyszukanie narzędzia → detail w N‑mode.
- Test: start tool session z narzędzia w projekcie.

**Rollout plan:**
- Start na kontach demo + partner/consultant org (feature flag).

---

## T019 — 🟦 tools — Development of First 10 Consulting Tools (action‑driven output)
- Status spec: draft
- Link / ID (ClickUp): TBD
- Epic: (Tools engine / Initiative creation) TBD
- Priorytet / V2 scope: V2

**Business challenge (problem):**
Biblioteka narzędzi bez realnego outputu „do roboty” nie generuje wartości. Pierwsze 10 narzędzi musi dowozić **action-driven rezultat** i jednocześnie sprawić, że klient **zbuduje wiedzę + rozwiązania** (nie tylko „wypełni formularz”).
Kluczowe są 3 rzeczy:
1) **sensemaking** (sensowna, wyważona analiza),
2) **clarity by design** (świetny, graficznie czytelny układ),
3) **closure** (koniec pracy narzędzia = domknięty zestaw wniosków + koncepcje inicjatyw).

**Cel (outcome, nie feature):**
W Consultify istnieje 10 „pierwszych” narzędzi, które:
- działają end‑to‑end jako `tool_sessions` (zbierają odpowiedzi, liczą completion/confidence),
- generują **draft initiatives** przez istniejący workflow Tools → Initiatives,
- mają spójny UX (N‑mode) i przygotowanie do C‑mode później,
- ich output (answers + initiatives + decyzje) staje się częścią kontekstu AI konsultanta w całej aplikacji.
- zostawiają użytkownika z **konkretną wiedzą i planem**: „co wiemy / czego nie wiemy / co robimy dalej”.

**Użytkownicy i scenariusze:**
- Konsultant w projekcie uruchamia narzędzie → wypełnia pola → review → generuje 3–7 inicjatyw → dopina ownerów/priorytety.
- Zespół wraca do sesji narzędzia po tygodniu → widzi co zostało wykorzystane (linked initiatives) i co jest „blocked”.

**Scope (V2)**
- IN:
  - Poprawne wypełnianie narzędzia (MUST):
    - narzędzie prowadzi użytkownika przez inputy „we właściwej kolejności” (bez chaosu):
      - jasno opisane pola i skale,
      - walidacje i „what’s missing”,
      - możliwość przerwania i powrotu (autosave/resume w ramach `tool_sessions`).
    - czat jako wsparcie w trakcie wypełniania (patrz niżej).
  - Wybór i wdrożenie 10 narzędzi jako **realnych `tool_type`** (sesje), z kontraktem:
    - `answers_json` (schema per tool),
    - `completion_percent` + `confidence_avg`,
    - workflow: `DRAFT → IN_REVIEW → APPROVED` (lub mapowanie na istniejące statusy) + audit.
  - Proponowany zestaw startowy (dopasowany do istniejących `tool_type` w backendzie; finalny wybór do szybkiego zatwierdzenia):
    - `dynamic-swot`
    - `market-forces`
    - `growth-paths`
    - `value-chain`
    - `portfolio-priority`
    - `risk-uncertainty`
    - `capability-mapper`
    - `a3-problem-solving`
    - `vsm-builder`
    - `sop-builder`
  - Metodyki generowania inicjatyw:
    - reuse istniejącego `ToolInitiativeService` (`methodologyId`, `count`, `includeChatContext`),
    - standard jakości promptu: inicjatywy muszą być konkretne i wykonalne, z ryzykiem i priorytetem.
  - Governance jakości (MUST):
    - inicjatywy generujemy dopiero gdy sesja spełnia minimalny DoD (np. completion=100% i confidence>=3),
    - AI ma być **wyważone**: jeśli dane są niepełne/mieszane → tworzy „unknowns” i proponuje 1–3 follow‑up pytania zamiast mocnych tez.
  - UI:
    - tool session detail jako artefakt N‑mode (sections: Brief, Inputs, Analysis, Generated Initiatives, Decisions, Activity/Comments),
    - szybki przycisk „Generate initiatives” + podgląd batcha + linki do utworzonych inicjatyw.
    - „graphic clarity” (MUST): używać kanonicznych N‑mode building blocks zamiast ad‑hoc UI:
      - `InlineTable` dla wniosków/porównań,
      - `ChecklistBlock` dla kroków i completeness,
      - `Callout` dla kluczowych wniosków/ryzyk,
      - `EmbeddedView` dla list inicjatyw (z toolbar),
      - `ToggleBlock` tylko tam, gdzie to skraca skanowanie (nie jako główny layout).
  - Prezentacja rezultatu + wnioskowanie (MUST):
    - po wypełnieniu narzędzia użytkownik widzi „Results” jako czytelny, graficzny output:
      - key takeaways,
      - tabelę/scorecard (jeśli dotyczy),
      - evidence/sources z answers,
      - `unknowns` + rekomendowane follow‑up,
      - przygotowanie do wykorzystania dalej (linki do raportu/prezentacji/inicjatyw).
    - system pozwala „wnioskować na rezultacie”:
      - zaznacz insight → zapisz do Notebook (T011),
      - w 1 klik wygeneruj draft raportu/prezentacji (T017 + generatory) jako kolejny etap.
  - AI context (MUST):
    - `answers_json` + zatwierdzone inicjatywy/decisions z tool session są dołączane do kontekstu AI konsultanta (chat, inicjatywy, raporty),
    - AI w inicjatywach korzysta z tych danych do sensownej i wyważonej analizy (T016).
  - Closure / koniec pracy (MUST):
    - każda sesja narzędzia ma finalny ekran/sekcję „Conclusion”:
      - 3–7 **key takeaways** (wyważone),
      - `unknowns` + proponowane follow‑up (1–3 pytania),
      - wygenerowane **koncepcje inicjatyw** (preview),
      - ścieżka „dalej” (MUST): **najpierw** raport/prezentacja (T017 + generatory), a **na końcu** „Create initiatives” (batch) — żeby inicjatywy były oparte o domkniętą narrację,
      - „what to do next” (1–3 kroki).
  - Czat jako mocny support (MUST):
    - w tool session istnieje „copilot chat” (panel / zakładka), który:
      - pomaga uzupełniać brakujące pola („ask AI to propose missing inputs”),
      - tłumaczy metodę narzędzia „w momencie użycia” (z cytowaniem KB z T020),
      - przygotowuje wnioski i pomaga w redakcji executive takeaways,
      - potrafi wygenerować draft „Results/Conclusion” na podstawie `answers_json` (z wyważeniem i unknowns),
      - prowadzi do kolejnych etapów: `Generate report` → `Generate deck` → `Create initiatives`.
- Future enhancements (post‑V2):
  - Więcej niż 10 narzędzi (skalowanie biblioteki).
  - C‑mode „tool conductor” (rozmowa prowadząca przez tool inputs).
  - Benchmarking między projektami/org.

**UX / UI notes:**
- N‑mode = czytelność + przewidywalny układ; najważniejsze CTA: „Generate initiatives”.
- „Explainability”: pokazuj „dlaczego” dana inicjatywa powstała (sources z answers).
- „Elegancja” (MUST): minimalny noise, super czytelne typografie/tabele; nie budujemy „formularza z dodatkami”, tylko narzędzie pracy konsultanta.
- „Flow” (MUST): Fill → Results → Reasoning → Prepare → Report/Deck → Initiatives (wyraźne kroki i CTA).

**Data / integrations:**
- Reuse: `tool_sessions`, `tool_initiative_batches`, `tool_initiative_links`, audit log.
- Każda inicjatywa utworzona z narzędzia ma `source_type='tool'` i `source_id=tool_session_id`.

**Security / compliance:**
- Uprawnienia: dostęp do sesji narzędzia wg projektu/org; generowanie inicjatyw tylko dla uprawnionych.
- PII redaction: jeżeli inputy zawierają dane wrażliwe, muszą być traktowane jak chat (polityki org).

**Analytics (events/metrics):**
- `tool_session_created` (toolType)
- `tool_session_completed` (completion, confidenceAvg)
- `tool_initiatives_generated` (count, methodologyId, includeChatContext)
- `tool_initiative_opened`
- KPI: sessions→initiatives conversion, time-to-first-initiative, % initiatives utilized.

**Risks:**
- Zbyt ogólne inicjatywy → niska wartość: dlatego twardy kontrakt outputu + evidence links + review.
- Rozjazd między tool taxonomy a inicjatywami → potrzebna spójna mapa kategorii.

**Open questions (do decyzji):**
- Finalny wybór „top 10” z listy `tool_type` (czy zostajemy przy powyższym zestawie)?
- Domyślna liczba inicjatyw z toola: 3? 5? 7?

**Definition of Done (DoD):**
- Jest 10 narzędzi działających jako `tool_sessions` z uzupełnianiem answers + completion/confidence.
- Z sesji można wygenerować batch inicjatyw i widzieć linki do utworzonych inicjatyw.
- Output narzędzi zasila kontekst AI konsultanta i jest wykorzystywany w inicjatywach/raportach.

**Acceptance / test plan:**
- Test: uruchom 2 różne narzędzia → completion=100% → generuj inicjatywy → linki widoczne w sesji i w inicjatywach.
- Test: dla niekompletnej sesji generowanie jest blokowane i pokazuje „what’s missing”.

**Rollout plan:**
- Feature flag; start na demo org i 1–2 realnych projektach consultingowych (dogfooding).

---

## T020 — 🟦 tools — Tool‑Linked Knowledge Base (how‑to + best practices + video)
- Status spec: draft
- Link / ID (ClickUp): TBD
- Epic: (Education-in-product / Adoption) TBD
- Priorytet / V2 scope: V2

**Business challenge (problem):**
Narzędzia są skuteczne tylko wtedy, gdy użytkownik rozumie **jak** je poprawnie wypełnić i **jak** interpretować wynik. Bez edukacji „w momencie użycia” klient nie buduje wiedzy, a output (wnioski/inicjatywy) jest słaby i niespójny.

**Cel (outcome, nie feature):**
Każde narzędzie ma przypiętą warstwę edukacyjną (KB), która:
- uczy poprawnego wypełniania (kroki, przykłady, typowe błędy),
- wspiera interpretację i wnioskowanie,
- jest łatwa do cytowania przez AI konsultanta i używana jako kontekst w czacie narzędzia,
- ma krótki materiał wideo (teaser/quick guide), jeśli dostępny.

**Użytkownicy i scenariusze:**
- Użytkownik jest w połowie tool session i nie wie co wpisać → otwiera „How to” i widzi przykład + FAQ.
- W copilot chat pyta „jak interpretować ten wynik?” → AI cytuje KB i prowadzi do kolejnego kroku.

**Scope (V2)**
- IN:
  - KB per tool:
    - 1 artykuł „How to use” per narzędzie (minimum dla top 10 z T019),
    - struktura artykułu (kanoniczna):
      - Purpose / when to use
      - Inputs (co trzeba mieć)
      - Steps (jak wypełnić)
      - How to interpret results (wnioskowanie)
      - Common mistakes / anti‑patterns
      - Example (krótki, praktyczny)
      - Next steps w Consultify: Report/Deck → Initiatives
  - Video per tool (opcjonalnie w V2, ale wspierane technicznie):
    - 90–120s „quick guide” (link `video_url` / `video_teaser_url`),
    - UI: modal w stylu istniejącego `ToolVideoModal` + CTA „Try tool / Continue”.
  - Integracja w UI:
    - z poziomu tool session (T019) dostępny przycisk „Help / How to” otwierający `HelpSidePanel` z moduleId = toolId/toolType,
    - z poziomu Known Tools (T018) w detail narzędzia link do KB + (jeśli jest) video.
  - Integracja z AI:
    - KB artykuły są włączane do kontekstu AI (wykorzystanie istniejącego `helpDocsContext` + `KnowledgeBaseService`):
      - w copilot chat w tool session AI ma preferować KB zamiast zgadywania,
      - AI cytuje źródła jako [KB1], [KB2] gdy instruuje użytkownika.
  - Języki:
    - minimum w V2: EN/PL (zgodnie z aktualnym KB context pipeline),
    - pozostałe języki aplikacji: fallback do EN do czasu dodania tłumaczeń (post‑V2).
- Future enhancements (post‑V2):
  - Pełne tłumaczenia KB na 6 języków.
  - „Interactive examples” (mini‑dataset w toolu).
  - Certyfikacje / kursy e‑learningowe.

**UX / UI notes:**
- „In the moment”: help ma być dostępny bez opuszczania pracy (side panel).
- KB treści mają być krótkie i praktyczne; żadnych długich esejów.

**Data / integrations:**
- Reuse istniejącego `KnowledgeBaseService`:
  - kategorie + artykuły + tłumaczenia,
  - filtrowanie przez `related_modules` (`moduleId` = tool).
- Reuse `HelpSidePanel` (KB tab) + contextual articles.

**Security / compliance:**
- KB treści publiczne lub wewnętrzne (kontrolowane `is_public`).
- Brak danych klienta w KB (same wzorce i przykłady).

**Analytics (events/metrics):**
- `tool_kb_opened` (toolId)
- `tool_kb_article_viewed` (slug)
- `tool_video_opened` / `tool_video_watched` (toolId)
- KPI: spadek „abandon” w tool sessions, wzrost completion/confidence, wzrost initiatives utilization.

**Risks:**
- Jeśli KB będzie „marketingowe” lub zbyt ogólne → nie pomaga. Musi być consulting‑grade i operacyjne.

**Open questions (do decyzji):**
- Czy KB per tool ma być publiczne (dla akwizycji), czy tylko po zalogowaniu?
- Czy w V2 wymagamy video dla wszystkich 10 narzędzi, czy tylko 2–3 flagship?

**Definition of Done (DoD):**
- Dla top 10 narzędzi istnieją artykuły KB „How to use” i są podpięte w UI tool session.
- Copilot chat w tool session potrafi cytować KB i prowadzić usera przez poprawne wypełnianie i interpretację.
- (Jeśli video dostępne) można je otworzyć w modalu i przejść CTA do narzędzia.

**Acceptance / test plan:**
- Test: w tool session → open help → widzę właściwe artykuły (moduleId filter).
- Test: pytanie w copilot chat o „jak wypełnić” → AI cytuje KB i daje praktyczne kroki.

**Rollout plan:**
- Najpierw dla top 3 narzędzi (flagship), potem rozszerzenie na pełne top 10.

---

## T021 — 🟦 tools — Visual Tool Library Interface (module hub + education-in-moment)
- Status spec: draft
- Link / ID (ClickUp): TBD
- Epic: (Tools UX / Adoption / Trust) TBD
- Priorytet / V2 scope: V2

**Business challenge (problem):**
Przy 20–50 narzędziach użytkownik nie może „błądzić”. Potrzebuje:
- szybkiego wyboru właściwego narzędzia,
- zrozumienia „co to da” i „jak to wypełnić” zanim zacznie,
- spójnego, eleganckiego UI (ClickUp‑like hub) zamiast listy linków.

**Cel (outcome, nie feature):**
W głównym menu jest **jeden przycisk „Tools”**. Po wejściu otwiera się moduł **Tools** jako wizualna biblioteka narzędzi (domyślnie: elegancka tabela), która:
- pozwala znaleźć narzędzie w <30 sekund,
- daje kontekst edukacyjny (KB + krótki teaser video) „w momencie wyboru”,
- prowadzi 1 klik do rozpoczęcia pracy: tool session (T019) z flow: fill → results → report/deck → initiatives,
- zasila kontekst AI konsultanta (użytkownik może pytać „które narzędzie wybrać?” i dostaje odpowiedź opartą o bibliotekę).

**Użytkownicy i scenariusze:**
- Konsultant: filtruje po kategorii (strategic/operational/transformation/process automation) → wybiera narzędzie → odpala tool session w projekcie.
- Owner: nie zna metod → klika narzędzie → widzi „what you get” + quick guide → startuje bez obaw.

**Scope (V2)**
- IN:
  - Moduł hub zgodny z `docs/ui-standards/03-modules/module-hub-standard.md` + `app-table-standard.md`:
    - top bar: search toggle, taby, view toggle (Table/Grid), CTA,
    - dynamic tabs: `[≡ List]` + otwarte narzędzia/sesje,
    - tabela/siatka na pełnej szerokości (bez dodatkowych breadcrumbs wewnątrz).
    - domyślny widok: **Table** (szybkie skanowanie i wybór „obszar → narzędzie”)
  - Kategorie + filtry:
    - wybór „obszar” (minimum): strategic, operational, transformation/digital, process automation,
    - filtry: licensed vs free, coming soon, tagi.
  - Widok listy (Table) i siatki (Grid):
    - Table: szybkie skanowanie (kolumny: name, category, type, licensed, updated),
    - Grid: karty z ikoną + 1‑liner value + „what you get”.
  - Tool detail (preview przed startem):
    - każda pozycja (narzędzie) ma swoją „kartę”/preview (w panelu lub osobnym widoku detail):
      - opis: „What is this” + „When to use” + „What you get”
      - film (teaser 90–120s) — jeśli dostępny — w modalu (reuse `ToolVideoModal`)
      - link do bazy edukacji (T020) „How to / Knowledge base”
      - CTA: `Select / Start tool` → tworzy `tool_session` i przechodzi do T019 (praca dalej)
  - Video behavior (MUST):
    - brak agresywnego autoplay na mobile; preferowane click‑to‑play w modalu,
    - jeśli „auto‑play” jest w ogóle, to tylko w kontekście modala i z kontrolą usera.
  - i18n:
    - UI (nazwy, opisy, kategorie) w 6 językach: `en`, `pl`, `de`, `ar`, `jp`, `es` (fallback EN jeśli content nieprzetłumaczony).
  - AI support:
    - w module Tools dostępny „ask AI”/chat, który:
      - pomaga dobrać narzędzie do celu,
      - cytuje KB (T020) i „known tools” (T018),
      - kieruje do startu tool session.
- Future enhancements (post‑V2):
  - AI rekomendacje narzędzi per kontekst projektu (personalizacja),
  - „tool bundles” (sekwencje narzędzi jako playbook),
  - public preview biblioteki (akquisition).

**UX / UI notes:**
- Hub ma być „tech sexy”: monochromatic chrome, minimal noise, super szybka nawigacja.
- Zawsze widoczne „what you get” (3 output chips) — pomaga w wyborze.

**Data / integrations:**
- Źródło: tabela `tools` + biblioteka edukacyjna (KB/teasers).
- Start: tworzenie `tool_sessions` + przypięcie do projektu (context snapshot).

**Security / compliance:**
- Widoczność narzędzi wg planu (licensed vs free) + feature flags.

**Analytics (events/metrics):**
- `tools_hub_opened`
- `tool_filtered` (category/filter)
- `tool_preview_opened` (toolId)
- `tool_video_opened`
- `tool_session_started_from_library`
- KPI: time-to-tool-selection, start rate, completion rate tool sessions.

**Risks:**
- Zbyt „showcase” zamiast „workflow” → musi prowadzić do realnej pracy (T019) i edukacji (T020).

**Definition of Done (DoD):**
- Istnieje Tools Hub (Table + Grid) z kategoriami, search i preview tool detail.
- Z preview można uruchomić tool session w projekcie.
- KB/video są dostępne „in the moment” i wspierają start narzędzia.

**Acceptance / test plan:**
- Test: filtr → preview → start session → przejście do tool session detail (T019).
- Test: mobile → video otwiera się w modalu i nie robi autoplay bez akcji usera.

**Rollout plan:**
- Feature flag + rollout na kontach demo, potem partner/consultant org.

---

## T022 — 🟦 tools — Development of 10 Operational Improvement Tools (measurable impact)
- Status spec: draft
- Link / ID (ClickUp): TBD
- Epic: (Operational excellence tools) TBD
- Priorytet / V2 scope: V2

**Business challenge (problem):**
Operacje potrzebują narzędzi, które prowadzą do **mierzalnych usprawnień** (czas, jakość, koszty, OEE, zapasy) — nie tylko diagnozy. Bez spójnego pakietu operacyjnego platforma traci „execution credibility”.

**Cel (outcome, nie feature):**
W platformie istnieje 10 narzędzi usprawnień operacyjnych, które:
- prowadzą użytkownika krok po kroku przez metodę (poprawne wypełnianie),
- kończą się klarownymi wynikami (results), wyważonym wnioskowaniem (unknowns/counterpoints),
- przygotowują materiał do raportu/deck (T017 + generatory),
- finalnie generują **koncepcje inicjatyw operacyjnych** (batch) z priorytetem i ryzykiem.

**Użytkownicy i scenariusze:**
- Kierownik operacji + konsultant: wypełniają narzędzie → dostają plan usprawnień → generują inicjatywy i przypisują ownerów.

**Scope (V2)**
- IN:
  - 10 narzędzi jako `tool_sessions` (spójnie z T019) — rekomendowany zestaw (już istnieje jako `tool_type` w backend):
    - `sop-builder`
    - `a3-problem-solving`
    - `smed-planner`
    - `dms-builder`
    - `inventory-autopilot`
    - `vsm-builder`
    - `constraint-control`
    - `decision-engine`
    - `control-tower`
    - `automation-pipeline` (operational automation pipeline)
  - Wspólny flow (MUST, identyczny jak T019):
    - Fill → Results → Reasoning → Prepare → Report/Deck → Initiatives
    - copilot chat jako mocny support (uzupełnia braki, tłumaczy metodę, draftuje wnioski)
  - Wspólny kontrakt outputu (MUST):
    - `answers_json` zawiera pola wejściowe + obliczone metryki (tam gdzie to ma sens),
    - `completion_percent` + `confidence_avg`,
    - „Results” zawiera: key takeaways + metrics + unknowns + follow-up.
  - Measurable impact (MUST):
    - każdy tool ma sekcję „Impact hypothesis” (baseline → target, z jednostkami),
    - inicjatywy generowane z toola mają w summary „expected impact” (tekst + metryki jeśli dostępne).
  - UI:
    - N‑mode (page-first), building blocks jak w T019 (InlineTable/Checklist/Callout/EmbeddedView).
  - KB:
    - T020: artykuł „How to use” + common mistakes dla każdego z 10 narzędzi.
- Future enhancements (post‑V2):
  - Integracje z danymi shopfloor/ERP/MES do automatycznego zasilania metryk.
  - Benchmarking między liniami/zakładami.

**UX / UI notes:**
- Najważniejsze: użytkownik ma rozumieć „co zmieniamy jutro rano” — bez przekopywania się przez długi tekst.

**Data / integrations:**
- Reuse: `tool_sessions` + ToolInitiativeService (batch initiatives).
- (opcjonalnie) integracja z module economics później; w V2 trzymamy impact jako struktura tekst+metryki.

**Security / compliance:**
- Uprawnienia per project/org.

**Analytics (events/metrics):**
- `operational_tool_started` / `operational_tool_completed`
- `operational_initiatives_generated`
- KPI: adoption, initiatives utilization, %tools with impact hypothesis filled.

**Risks:**
- „Za dużo narzędzi naraz” → utrzymujemy wspólny shell i kontrakt; różnice tylko w `answers_json` i KB.

**Open questions (do decyzji):**
- Czy wszystkie 10 ma być gotowe na VC, czy 3–5 flagship + reszta „coming soon”?

**Definition of Done (DoD):**
- 10 operational tools jest dostępnych w Tools Hub, można je wypełnić, zobaczyć results, wygenerować inicjatywy.
- Każdy tool ma KB (T020) i wspiera report/deck (T017).

**Acceptance / test plan:**
- Test: uruchom `a3-problem-solving` i `vsm-builder` → completion → results → report draft → initiatives batch.

**Rollout plan:**
- Feature flag + start na demo org; stopniowo dodawać kolejne tool types.

---

## T023 — 🟦 tools — Development of 10 Digital Transformation Tools (execution‑ready)
- Status spec: draft
- Link / ID (ClickUp): TBD
- Epic: (Digital transformation tools) TBD
- Priorytet / V2 scope: V2

**Business challenge (problem):**
Digital transformation często kończy się slajdami. Te narzędzia muszą wymuszać **structured execution**: decyzje, priorytety, plan i inicjatywy.

**Cel (outcome, nie feature):**
W platformie istnieje 10 narzędzi digital, które kończą się inicjatywami transformacyjnymi i materiałem sponsor‑ready (report/deck) — a AI prowadzi użytkownika przez poprawne wypełnienie i wyważone wnioskowanie.

**Scope (V2)**
- IN:
  - 10 narzędzi jako `tool_sessions` — rekomendowany zestaw (już istnieje jako `tool_type` w backend):
    - `robotics-feasibility`
    - `logistics-automation`
    - `rpa-scanner`
    - `ai-discovery`
    - `integration-diagnostic`
    - `digital-value-pool`
    - `legacy-analyzer`
    - `data-inventory`
    - `pain-to-solution`
    - `pain-explorer`
  - Wspólny flow + closure jak T019 (MUST).
  - Wynik (Results) ma zawierać „execution readiness” (MUST):
    - prerequisites (data/infra/people),
    - risks & constraints,
    - dependency map (jeśli dotyczy) jako tabela/lista,
    - quick wins vs strategic bets (wyważone).
  - Final: inicjatywy + priorytety + ryzyko.
  - KB per tool (T020).
- Future enhancements (post‑V2):
  - Integracje z systemami (CMDB, Jira/ClickUp) i automatyczne wykrywanie pain points.

**Definition of Done (DoD):**
- 10 digital tools dostępnych w Tools Hub; end‑to‑end flow działa i generuje inicjatywy.

---

## T024 — 🟦 tools — Speed Tool – Process Automation Framework (canonical automation method)
- Status spec: draft
- Link / ID (ClickUp): TBD
- Epic: (Automation framework / Ops + Finance) TBD
- Priorytet / V2 scope: V2

**Business challenge (problem):**
Automatyzacja procesów bez metodologii i ekonomiki kończy się „pomysłami”. Potrzebujemy kanonicznego frameworku: identyfikacja → mapowanie → pomiar → redesign → re‑estymacja → ekonomika → inicjatywy.

**Cel (outcome, nie feature):**
Jedno narzędzie (framework) prowadzi użytkownika krok po kroku przez proces automatyzacji i kończy się:
- ustrukturyzowanym zestawem inicjatyw automatyzacyjnych,
- finansowym uzasadnieniem (baseline/target, ROI assumptions),
- materiałem do raportu/deck.

**Scope (V2)**
- IN:
  - Tool type: `process-automation` jako kanoniczna sesja (multi‑step wizard w N‑mode).
  - Kroki (MUST):
    1) Identification (process candidates + scope)
    2) Process mapping (high-level VSM / steps)
    3) Decision mapping (where/why decisions happen)
    4) Time measurement (baseline)
    5) Redesign (improvements before automation)
    6) Re‑estimation (post‑improvement baseline)
    7) Economics (cost/benefit, payback assumptions)
    8) Initiatives (batch) + dependencies + risks
  - Outputy (MUST):
    - Results + Conclusion (wyważone, unknowns),
    - „automation initiatives pack” (3–7) z priorytetem i ryzykiem,
    - opcjonalny export do T017 (report/deck) jako „Automation case”.
  - Copilot chat (MUST):
    - pomaga w mapowaniu, normalizuje definicje, pilnuje kompletności danych,
    - cytuje KB (T020) „jak robić mapping i pomiary”.
  - KB:
    - osobny artykuł „Speed Tool framework” + przykłady (T020).
- Future enhancements (post‑V2):
  - Integracje BPMN/RPA, automatyczne discovery, import process maps.

**Risks:**
- Złożoność UX → dlatego krokowy wizard + wyraźne CTA i progres.

**Definition of Done (DoD):**
- Tool `process-automation` działa end‑to‑end i generuje inicjatywy + ekonomika w strukturze.

**Acceptance / test plan:**
- Test: wypełnij minimalny proces → economics → wygeneruj 3 inicjatywy → export report/deck.

**Rollout plan:**
- Feature flag; start jako flagship tool (pokaz na VC).

---

## T025 — 🟢 licensed tools — Rename Module: Assessment → Licensed Tools (UI + i18n + nav)
- Status spec: draft
- Link / ID (ClickUp): TBD
- Epic: (Monetyzacja / Premium positioning) TBD
- Priorytet / V2 scope: V2

**Business challenge (problem):**
Nazwa „Assessment” nie komunikuje wartości premium/licencjonowanych metodologii. W demo/sprzedaży chcemy, żeby użytkownik od razu rozumiał: to są **Licensed Tools** (SIRI/ADMA/DRD/Lean…) — a nie „kolejny assessment”.

**Cel (outcome, nie feature):**
W całej aplikacji moduł dotychczas nazywany „Assessment” jest prezentowany jako **Licensed Tools**, spójnie w:
- nawigacji (menu/side bar),
- nagłówkach i breadcrumbs,
- copy w hubach i ekranach wyboru frameworka,
- Help/Docs,
bez psucia istniejących linków i zachowań.

**Użytkownicy i scenariusze:**
- Nowy użytkownik widzi w menu „Licensed Tools” i rozumie premium value.
- Stare deep-linki typu `/assessment/...` nadal działają (kompatybilność).

**Scope (V2)**
- IN:
  - Rename w UI:
    - label w main menu: `Assessment` → **`Licensed Tools`**,
    - nagłówki ekranów: „Assessment Module” → „Licensed Tools”,
    - copy/tooltipy/empty states w module, które mówią o „module name” (nie o encji assessment jako danych).
  - i18n:
    - nowe klucze / aktualizacja istniejących (w 6 językach UI),
    - zachowujemy istniejący namespace `assessment-module` (to nie musi zmieniać się technicznie).
  - Implementation checklist (konkretne hotspoty w kodzie) (MUST):
    - Nav/menu label:
      - wyszukać i zamienić wszystkie etykiety „Assessment” w menu na **„Licensed Tools”**.
    - Ekran wyboru frameworka:
      - `src/views/AssessmentView.tsx` — teksty typu „Assessment Module / Moduł Assessment” → Licensed Tools.
    - Hub modułu:
      - `src/components/assessment/AssessmentModuleHub.tsx`:
        - nagłówki i opisy modułu → Licensed Tools,
        - UWAGA: artefakt „assessment” jako encja danych może zostać jako „Assessment/Assessments” w kontekście tabów (to jest nazwa typu pracy), ale copy ma jasno mówić, że to **licensed framework sessions**.
    - Routing:
      - `src/routes/AppRoutes.tsx` — nie zmieniać istniejących ścieżek `/assessment/...` (kompatybilność), ewentualnie dodać alias `/licensed-tools`.
    - Help / KB:
      - `src/config/helpContent.ts` — przewodniki/quick guides i etykiety, które mówią „assessment” jako moduł, mają mówić „Licensed Tools”.
      - `HelpSidePanel` ma podawać właściwy `moduleId` w KB dla tego modułu.
  - Routing / kompatybilność:
    - **nie zmieniamy** istniejących URL‑i jako breaking change:
      - `/assessment` zostaje jako canonical route (technicznie),
    - dodajemy alias `/licensed-tools` (opcjonalnie) jako „ładny link”:
      - redirect 301/SPA redirect do `/assessment` lub odwrotnie (jedno źródło prawdy),
      - wszystkie linki w UI kierują do „Licensed Tools” (nie muszą zmieniać ścieżek).
  - Dokumentacja:
    - aktualizacja Help/KB guide’ów, które nazywają moduł „Assessment”.
- Future enhancements (post‑V2):
  - Zmiana canonical URL (`/licensed-tools`) jeśli będzie potrzeba (wymaga migracji linków i e2e).

**UX / UI notes:**
- To jest „rename”, nie redesign: layouty i workflow zostają, zmienia się komunikacja i konsekwencja nazewnictwa.
- Musi być spójne z T021 (Tools) — dwa różne byty:
  - `Tools` = consulting tools / tool sessions,
  - `Licensed Tools` = licencjonowane frameworki (DRD/SIRI/ADMA/Lean).

**Data / integrations:**
- Brak zmian w DB modelach; tylko UI/copy.

**Security / compliance:**
- Brak zmian.

**Analytics (events/metrics):**
- `licensed_tools_module_opened` (source: nav)
- KPI: CTR wejścia do modułu, trial→paid correlation (jeśli mierzone).

**Risks:**
- Niespójność copy (część UI dalej „Assessment”) → obniża wiarygodność. Potrzebny audit stringów.
- Pomylenie z modułem `Tools` → dlatego twarde rozróżnienie w copy i nav.

**Definition of Done (DoD):**
- W menu i UI moduł jest konsekwentnie nazwany **Licensed Tools**.
- Deep-linki `/assessment/...` działają jak wcześniej.
- Jeśli dodamy `/licensed-tools`, działa i nie dubluje logiki (redirect).

**Acceptance / test plan:**
- Test: wejście z menu → widzę „Licensed Tools” w UI.
- Test: `/assessment` i `/assessment/:framework/...` działają.
- Test: jeśli `/licensed-tools` dodane → redirect działa i nie ma pętli.

**Rollout plan:**
- Deploy z krótkim QA smoke (nav + routes) + monitoring błędów nawigacji.

---

## T026 — 🟢 licensed tools — Finalize SIRI and ADMA Tools (Content + UI parity z DRD)
- Status spec: draft
- Link / ID (ClickUp): TBD
- Epic: (Licensed Tools quality / Enterprise readiness) TBD
- Priorytet / V2 scope: V2

**Business challenge (problem):**
Kluczem jest, żeby jakość pracy w SIRI/ADMA była **analogiczna** jak w DRD. Jeśli DRD jest „dopieszczone”, a SIRI/ADMA wyglądają jak „pół‑produkt” (płytki content, niespójny UX/grafika, inne flow), to cały moduł **Licensed Tools** traci wiarygodność enterprise — szczególnie na poziomie sponsorów.

**Cel (outcome, nie feature):**
SIRI i ADMA są doprowadzone do parytetu z DRD:
- kompletne contentowo (głębokość opisów + guidance „jak oceniać”),
- spójne UX‑owo i graficznie (czytelność, hierarchia, skanowalność),
- działają end‑to‑end (create → fill → review/approve → report → initiatives),
- podsumowania są czytelne i domykają pracę (conclusions/next steps),
- output jest sponsor‑ready i zasila kontekst AI konsultanta.

**Użytkownicy i scenariusze:**
- Konsultant prowadzi sesję SIRI/ADMA w projekcie → domyka ocenę → generuje raport → inicjatywy.
- Sponsor dostaje executive output (T027/T017) i widzi spójność metodologiczną.

**Scope (V2)**
- IN:
  - Dostępność w module **Licensed Tools**:
    - SIRI: `available` + dopięcie parytetu UX/UI z DRD,
    - ADMA: przejście z „coming soon” → **`available`** i **pełny** flow end‑to‑end (w V2 nie ma „draft‑only” wariantu).
  - Content (depth) (MUST):
    - dopracowane opisy block/dimension/pillar (minimum PL/EN),
    - jasne definicje skali i interpretacja odpowiedzi:
      - SIRI 0–5 (Not Started → Intelligent) + „co znaczy poziom” + jak zbierać evidence,
      - ADMA 1–5 (Newcomer → Expert) + „co znaczy poziom” + jak zbierać evidence,
    - guidance w trakcie pracy: typowe evidence, przykłady, common mistakes (krótkie i operacyjne).
  - UX/UI parity z DRD (MUST) (grafika + sposób pracy):
    - „where am I” i nawigacja (block/pillar/dimension) oraz szybkie przełączanie bez gubienia kontekstu,
    - spójny sposób odpowiedzi:
      - current level, opcjonalny target,
      - notes + evidence jako first‑class (nie „opcjonalny dodatek”),
      - brakujące dane są widoczne i wpływają na completion/confidence,
    - spójne podsumowania (Summary workspace) jak w DRD:
      - overall score + breakdown (SIRI: building blocks/dimensions; ADMA: pillars/dimensions),
      - top gaps + top strengths,
      - unknowns/gaps (braki danych) jako lista follow‑up,
      - rekomendowane priorytety/next steps jako czytelny, graficzny output (skanowalny),
      - jednoznaczne „closure” (co ustaliliśmy, czego nie wiemy, co robimy dalej).
  - Workflow parity (MUST):
    - stage‑gate spójny z `AssessmentModuleHub`:
      - draft → in review → awaiting approval → approved (z reject + reason),
    - generowanie raportów i inicjatyw dostępne dopiero po `approved`.
  - i18n (MUST):
    - UI w 6 językach aplikacji (`en/pl/de/ar/jp/es`) — z fallback EN,
    - content frameworków minimum PL/EN w V2; inne języki fallback EN (post‑V2 pełne tłumaczenia).
  - AI support & AI context (MUST):
    - w module (copilot chat) AI pomaga w ocenianiu poprzez pytania doprecyzowujące + checklistę braków evidence (bez „wciskania” poziomu),
    - po `approved` wyniki (scores + notes/evidence + summary outputs + raport) są dołączane do kontekstu AI konsultanta (dla inicjatyw/raportów/tools).
- Future enhancements (post‑V2):
  - Pełne tłumaczenia SIRI/ADMA na 6 języków.
  - Benchmarking / porównania między projektami/org.

**UX / UI notes:**
- To nie jest „nowy design” — to jest wyrównanie jakości i konsekwencji do DRD.
- Wykorzystujemy istniejące wzorce i komponenty modułu (bez duplikowania UI).

**Data / integrations:**
- Wykorzystać istniejące struktury: `siriStructure`, `admaStructure`, istniejące edytory i hub.
- Raporty i prezentacje: przez generatory + szablony (T027).

**Security / compliance:**
- Uprawnienia jak obecnie w module (permissions + demo guards).

**Analytics (events/metrics):**
- `licensed_tool_framework_opened` (framework: SIRI|ADMA)
- `licensed_tool_assessment_completed` (framework, completion, confidenceAvg)
- `licensed_tool_assessment_approved`
- KPI: completion rate, time-to-approve, feedback jakości.

**Risks:**
- „Depth” contentu bez kontroli → zbyt długie teksty; muszą być skanowalne i operacyjne.
- ADMA `available` bez pełnych podsumowań i gatingu (approve→reports/initiatives) → regresja wiarygodności.

**Open questions:**
- (Zamknięte): ADMA w V2 ma być **pełna** jak DRD (reports + initiatives po approve).

**Definition of Done (DoD):**
- SIRI i ADMA są w Licensed Tools jako `available`.
- ADMA ma pełne, analogiczne do DRD: grafika, sposób odpowiedzi, podsumowania i end‑to‑end output.
- Po `approved` można generować raporty i inicjatywy, a wyniki są użyteczne jako input do dalszej pracy.

**Acceptance / test plan:**
- Test: ADMA — create → wypełnij min. 3–4 dimensiony → completion/confidence rośnie → review → approve → Reports/Initiatives dostępne.
- Test: SIRI — fill dimensions + prioritisation → Summary jest spójne i czytelne → approve → Reports/Initiatives dostępne.

**Rollout plan:**
- Feature flag per framework; dogfooding na demo org przed „show the world”.

---

## T027 — 🟣 reporting — Report and Presentation Templates for DRD, SIRI, and ADMA (executive‑ready, auto‑populated)
- Status spec: draft
- Link / ID (ClickUp): TBD
- Epic: (Reporting / Sponsor-ready outputs) TBD
- Priorytet / V2 scope: V2

**Business challenge (problem):**
Nawet najlepszy assessment traci wartość sprzedażową/zarządczą, jeśli nie potrafi wygenerować **spójnego, executive‑ready** raportu i prezentacji. Sponsor potrzebuje materiału, który jest gotowy do pokazania „jutro” bez ręcznego formatowania.

**Cel (outcome, nie feature):**
Dla każdego z frameworków **DRD / SIRI / ADMA** z zatwierdzonego (`APPROVED`) assessmentu da się wygenerować:
- **Raport** (czytelny, spójny layout, auto‑populated),
- **Prezentację (deck)** (PPTX, sponsor‑ready),
z jasnym „closure” (wnioski i next steps) i spójnością między frameworkami.

**Użytkownicy i scenariusze:**
- Konsultant kończy assessment → approve → generuje raport + deck → przekazuje sponsorowi.
- Sales używa raportu/deck jako artefaktu premium (trial→paid).

**Scope (V2)**
- IN:
  - Raporty (MUST):
    - 3 standardowe template’y raportów: DRD, SIRI, ADMA.
    - Auto‑populate z danych assessmentu (scores, breakdowny, gap, evidence/notes summary, priorytety).
    - Raport jest dostępny w aplikacji jako artefakt + nadaje się do eksportu (PDF/print).
    - Spójny język i struktura sekcji (executive summary → results → gaps → priorities → roadmap outline → legal notice jeśli dotyczy).
  - Prezentacje (MUST):
    - 3 standardowe template’y decków: DRD, SIRI, ADMA.
    - Eksport do **PPTX** przez istniejący generator prezentacji (pipeline v2).
    - Slajdy zawierają tylko to, co sponsorowi potrzebne: 10–15 slajdów, zero szumu.
  - Spójność i jakość:
    - „Grafika” i czytelność muszą być analogiczne do DRD (hierarchia, spacing, tabele/wykresy, skanowalność).
    - Każdy dokument ma „closure”: kluczowe wnioski, unknowns, next steps + link do inicjatyw.
  - Workflow / gating:
    - Generowanie raportu i decka tylko z assessmentów `APPROVED`.
    - Raporty/decki są powiązane z konkretnym assessmentem i wersjonowane (minimum: timestamp + autor).
  - i18n:
    - Raport/deck generują się w języku projektu/użytkownika (fallback EN).
- Future enhancements (post‑V2):
  - Client branding per org (logo/kolory/typografia), advanced deck editing.
  - Wspólny WYSIWYG editor dla wszystkich frameworków (parytet DRD premium editor dla SIRI/ADMA).

**UX / UI notes:**
- „One‑click output”: użytkownik widzi wyraźne CTA „Generate report” / „Export deck” + status generowania.
- Dokumenty muszą wyglądać jak premium artefakty (bez „dev UI”).

**Data / integrations:**
- Źródła danych: wyniki licensed tools (DRD/SIRI/ADMA) + metadane org/projekt + decyzje (approve).
- Wykorzystać istniejące generatory: report generator + presentation generator (bez duplikowania logiki).

**Security / compliance:**
- Dostęp do raportów/decków zgodny z uprawnieniami do projektu i assessmentu.

**Analytics (events/metrics):**
- `licensed_tools_report_generated` (framework, reportType)
- `licensed_tools_deck_exported` (framework, format=pptx)
- KPI: liczba eksportów, konwersja trial→paid, czas od approve do eksportu.

**Risks:**
- Braki danych (np. mało evidence) → raport musi pokazać „unknowns” zamiast udawać pewność.
- Wydajność generowania PPTX (kolejki, timeouty) → potrzebny czytelny status w UI.

**Open questions:**
- Czy w V2 raporty mają być edytowalne (DRD premium editor) vs view‑only dla SIRI/ADMA? (Propozycja V2: DRD edytowalne, SIRI/ADMA view‑first + eksport, edytor post‑V2.)

**Definition of Done (DoD):**
- Dla DRD/SIRI/ADMA: z `APPROVED` assessmentu generuje się raport i deck.
- Output jest executive‑ready (spójny layout, język, sekcje) i ma closure.
- Eksport PPTX działa i jest powtarzalny (bez ręcznego formatowania po eksporcie).

**Acceptance / test plan:**
- Test: dla każdego frameworka przejdź do `APPROVED` → wygeneruj raport → eksport PDF/print.
- Test: eksport PPTX → otwarcie w PowerPoint/Keynote bez „rozjechania” layoutu.

**Rollout plan:**
- Najpierw DRD, potem SIRI, potem ADMA (ale docelowo wszystkie 3 w V2).

---

## T028 — 🟢 licensed tools — Lean 4.0 Audit and Implementation Framework (DBR77: Pomierz → Zoptymalizuj → Automatyzuj)
- Status spec: draft
- Link / ID (ClickUp): TBD
- Epic: (Licensed Tools flagship / Execution readiness) TBD
- Priorytet / V2 scope: V2

**Business challenge (problem):**
Lean 4.0 ma być flagshipowym, licencjonowanym narzędziem „z wyjściem do wykonania”. Kluczowe jest, żeby użytkownik mógł pracować **jak z audytorem, trenerem i ekspertem Lean** — nie tylko „wypełnić formularz”. Jeśli narzędzie kończy się na ocenie bez roadmapy i inicjatyw, to nie dowozi wartości (ani monetyzacji).

**Cel (outcome, nie feature):**
Narzędzie prowadzi użytkownika end‑to‑end:
assessment (Pomierz) → rekomendacje Lean (Zoptymalizuj) → potencjał automatyzacji/AI (Automatyzuj) → **roadmap transformacji** → inicjatywy z ekonomią i priorytetyzacją.

**Użytkownicy i scenariusze:**
- Operacje/produkcja (transformation office) wykonuje audyt na procesach i stanowiskach → dostaje roadmapę.
- Konsultant prowadzi warsztat/audyt → trenerowo uczy „jak patrzeć” i „jak dowodzić” → finalnie materializuje plan w inicjatywach + raport/deck.

**Scope (V2)**
- IN:
  - Spójna pozycja w module **Licensed Tools** jako framework `LEAN` (DBR77 Lean 4.0).
  - Praca „jak audytor / trener / ekspert” (MUST):
    - narzędzie prowadzi przez obserwację i diagnozę (gemba mindset), a nie tylko ankietę,
    - dla kluczowych pól pokazuje:
      - „na co patrzeć” (checklisty),
      - „jakie evidence jest wystarczające” (przykłady),
      - „pytania kontrolne” (coach questions),
      - krótkie mikro‑lekcje (1–3 zdania) w momencie decyzji (teach‑while‑doing),
    - AI copilot działa jako **audytor/trener**:
      - dopytuje o brakujące dane,
      - wykrywa niespójności,
      - oznacza assumptions i obniża confidence przy brakach,
      - NIE „wciska” poziomu — pomaga dojść do prawidłowej oceny.
  - Assessment (MUST):
    - 3 fazy: **Pomierz / Zoptymalizuj / Automatyzuj** (zgodnie z istniejącą strukturą DBR77),
    - 2 perspektywy: **Procesy** oraz **Stanowiska**,
    - Zbieranie danych wejściowych (minimum):
      - current state metryki procesu (cycle time, lead time, WIP, defect rate, OEE itd.),
      - TIMWOODS wastes + impact,
      - ocena dojrzałości Lean (np. 5S, visual management, continuous flow, TPM),
      - ocena potencjału automatyzacji + technologie + ROI/complexity/risk.
  - Output / „closure” (MUST):
    - Wynik i podsumowanie skanowalne (executive summary):
      - overall score + breakdown po fazach i perspektywach,
      - top wastes (gdzie boli najbardziej) + quick wins (Lean-first),
      - top automation opportunities + ich ekonomika (Automate-last, z ryzykiem i zależnościami),
      - unknowns/braki danych jako follow‑up checklist (audit backlog),
    - Roadmap transformacji:
      - plan kroków (Lean → automatyzacja), z etapami i zależnościami,
      - rekomendowane inicjatywy jako pipeline do wykonania.
  - Initiatives (MUST):
    - Roadmapa materializuje się w inicjatywach (opis, zakres, wysiłek, ryzyko, ekonomika, priorytet).
  - UX/UI quality (MUST):
    - jakość pracy analogiczna do DRD: czytelna grafika, hierarchia, skanowalność,
    - „where am I” i szybkie przełączanie faz/perspektyw,
    - zapis postępu + read‑only/locked przy stage‑gate.
  - Reports (V2 baseline):
    - raport „audit → roadmap” generowany z wyników (PDF/print),
    - układ reportu executive‑ready (bez „dev UI”), z jasnym closure i next steps.
- Future enhancements (post‑V2):
  - Mobilne zbieranie danych z hali (osobny task: Mobile Lean 4.0 data collection).
  - Integracje OT/IoT i automatyczne zasilanie metryk.

**UX / UI notes:**
- Jeśli mamy dwa tryby (szybki audit vs pełna obserwacja) — oba muszą kończyć się tym samym typem outputu (roadmap + inicjatywy).
- „Closure” na końcu: co ustaliliśmy, co rekomendujemy, czego nie wiemy i co zbieramy dalej + CTA do inicjatyw i raportu.

**Data / integrations:**
- Wykorzystać istniejący model DBR77 (struktury i obliczenia) + store/workflow modułu Licensed Tools.
- Inicjatywy: ten sam pipeline tworzenia inicjatyw jak w pozostałych frameworkach (po `APPROVED`).

**Security / compliance:**
- Uprawnienia jak Licensed Tools; wrażliwe dane operacyjne (metryki) w zakresie projektu/org.

**Analytics (events/metrics):**
- `licensed_tool_framework_opened` (framework=LEAN)
- `licensed_tool_assessment_completed` (framework=LEAN)
- `licensed_tool_roadmap_generated` (framework=LEAN)
- `licensed_tool_initiatives_created_from_roadmap` (count, totalSavingsRange)

**Risks:**
- „Za dużo pól” → potrzebna progresja i sensowne minimum wejścia, ale bez spadku jakości eksperckiej.
- Ekonomika/ROI bez danych → wymagane explicit unknowns + conservative assumptions.

**Open questions:**
- Czy w V2 roadmapa ma mieć stały, kanoniczny format etapów (np. 30/60/90 dni + 6–12 mies.), czy zależy od skali projektu?

**Definition of Done (DoD):**
- Narzędzie pozwala pracować jak audytor/trener/ekspert Lean i prowadzi przez audit.
- Generuje roadmapę transformacji.
- Roadmapa materializuje się w inicjatywach/planie wykonania.
- Output jest executive‑ready i domyka pracę (closure + next steps).

**Acceptance / test plan:**
- Test: utwórz LEAN assessment → wypełnij 1 proces i 1 stanowisko → zobacz checklisty/pytania kontrolne → wygeneruj podsumowanie → roadmapa → inicjatywy.
- Test: eksport raportu (PDF/print) i czytelność sekcji executive summary.

**Rollout plan:**
- Dogfooding na demo org + 1 prawdziwy projekt pilotażowy, potem pokaz na VC.

---

## T029 — 🟢 licensed tools — Mobile Application for Lean 4.0 Data Collection (floor-only capture)
- Status spec: draft
- Link / ID (ClickUp): TBD
- Epic: (Lean execution / Evidence capture) TBD
- Priorytet / V2 scope: post‑V2 / parked (nie budujemy teraz)

**Business challenge (problem):**
Na hali konsultant/audytor **rozmawia** i obserwuje (gemba). Potrzebuje narzędzia, które pozwala zbierać evidence (metryki, wastes, zdjęcia, krótkie notatki) **bez przełączania się w tryb „pisania raportu”**. Jeśli mobilka zacznie robić analizę/roadmapę, stanie się ciężka i przeszkadza w pracy terenowej.

**Cel (outcome, nie feature):**
Mobilka służy **wyłącznie do zbierania informacji z hali** (floor capture). Zebrane dane synchronizują się do projektu/assessmentu `LEAN` w Consultify, a analiza/roadmap/raport/inicjatywy dzieją się później w aplikacji web/desktop.

**Użytkownicy i scenariusze:**
- Konsultant jest na gemba, rozmawia z operacjami → jednym tapnięciem dodaje metryki/wastes/zdjęcia/voice note → sync → w biurze domyka roadmapę.
- Team lead dopisuje brakujące dane i zdjęcia do audytu (kontrolowany dostęp).

**Scope (V2)**
- Uwaga: ten element **wypada teraz z planu realizacji** — zostawiamy jako kierunek **post‑V2**, nie budujemy w tym cyklu.
- IN (post‑V2):
  - Aplikacja mobilna (lub PWA) tylko do capture dla frameworka `LEAN`:
    - wybór projektu / audytu,
    - wybór: proces vs stanowisko,
    - szybkie wprowadzanie metryk + wastes (TIMWOODS) + checklist,
    - zdjęcia jako evidence (kamera) + szybki opis,
    - notatki głosowe (MUST), opcjonalnie transkrypcja (TBD),
    - sync do backendu i powiązanie z assessmentem.
  - „Consultant is talking” mode (MUST):
    - minimal liczby ekranów, duże tap targets, maks. 1–2 kroki do dodania wpisu,
    - preferencja dla voice capture i krótkich tagów zamiast długiego tekstu.
  - Offline‑first (TBD, ale preferowane):
    - zapis lokalny i kolejka synchronizacji,
    - bezpieczne ponawianie uploadów mediów.
- OUT:
  - Generowanie roadmapy, inicjatyw, raportu/decka na mobile (to jest web/desktop).
- IN (V2 minimal fallback — jeśli potrzebne szybciej):
  - Mobile‑friendly web capture w istniejącym UI (responsywność + szybkie formularze) bez osobnej aplikacji.
- Future enhancements (post‑V2):
  - QR/Barcode skanowanie stanowiska/maszyny.
  - Multi‑auditor collaborative mode (sync w czasie rzeczywistym).
  - Integracje z OT/IoT (automatyczny import metryk).

**UX / UI notes:**
- Projektowane pod halę: szybkie akcje, minimal tekstu, czytelne CTA.
- Wbudowane „auditor/trainer” wskazówki mogą istnieć, ale tylko jako krótkie checklisty (bez rozbudowanej analizy na mobile).

**Data / integrations:**
- Model danych mapuje 1:1 na DBR77 Lean (proces/stanowisko, wastes, metryki, evidence).
- Sync z auth i kontekstem org/projektu.

**Security / compliance:**
- Zdjęcia mogą zawierać PII → ostrzeżenia + podstawowe zasady capture + opcjonalna redakcja PII (TBD).
- Jeśli offline: szyfrowanie storage + bezpieczne wylogowanie.

**Analytics (events/metrics):**
- `lean_mobile_capture_started`
- `lean_mobile_evidence_added` (type=photo|voice|metric|waste)
- `lean_mobile_sync_succeeded` / `lean_mobile_sync_failed`
- KPI: czas audytu, kompletność evidence, liczba wpisów per audyt.

**Risks:**
- Offline sync + media uploads → złożoność techniczna.
- Zbyt rozbudowany UI → przeszkadza w rozmowie na hali (dlatego twardy OUT na analizę).

**Open questions:**
- PWA vs natywna aplikacja (propozycja: PWA jako pierwsze).
- Offline: MUST czy NICE‑TO‑HAVE?

**Definition of Done (DoD):**
- Mobilka pozwala zebrać dane na hali i zsynchronizować do LEAN assessmentu.
- Zebrane evidence (zdjęcia/voice/metryki/wastes) jest widoczne w web/desktop i użyteczne w audycie oraz raporcie/roadmapie.

**Acceptance / test plan:**
- Test: na telefonie dodaj 3 zdjęcia + 1 voice note + wastes + 5 metryk → sync → widoczne w projekcie.
- Test: słaby internet → kolejka sync działa i nie gubi danych.

**Rollout plan:**
- Pilot na 1 zakładzie + dogfooding wewnętrzny.

---

## T030 — 🟢 licensed tools — External PDF Import and Mapping (third‑party assessments → internal models)
- Status spec: draft
- Link / ID (ClickUp): TBD
- Epic: (Data ingestion / Compatibility) TBD
- Priorytet / V2 scope: V2

**Business challenge (problem):**
Klienci często mają już istniejące oceny/raporty w PDF (third‑party lub historyczne). Bez importu muszą „przepisywać” dane ręcznie, co jest drogie i zniechęca. Import PDF zwiększa kompatybilność, skraca time‑to‑value i pozwala szybciej przejść do insightów, roadmapy i inicjatyw.

**Cel (outcome, nie feature):**
Użytkownik importuje PDF, a system:
- wyciąga kluczowe dane (OCR/parsing),
- pokazuje **mapowanie** do wewnętrznego modelu,
- pozwala skorygować błędy,
- zapisuje ustrukturyzowane dane jako wejście do insightów/raportu/inicjatyw.

**Użytkownicy i scenariusze:**
- Konsultant ma raport audytu klienta w PDF → importuje → dostaje „draft mapping” → poprawia → generuje insighty/roadmap.
- Klient w trialu wrzuca PDF → widzi wartość „od razu” (conversion driver).

**Scope (V2)**
- IN:
  - Import PDF do projektu (MUST):
    - upload pliku PDF + metadane (framework/źródło/data/organizacja/projekt),
    - bezpieczne przechowanie oryginału (audit trail).
  - Ekstrakcja danych (MUST):
    - OCR jeśli PDF nie jest tekstowy,
    - detekcja kluczowych pól: score/poziomy, osie/wymiary, komentarze/rekomendacje (o ile istnieją),
    - wyliczenie confidence per pole (niska pewność → wymaga review).
  - Mapowanie + korekty (MUST):
    - UI, które pokazuje: „co wykryliśmy” → „gdzie to trafia” (internal model),
    - możliwość ręcznej poprawy pól i ponownego przeliczenia (preview),
    - zapis finalnego mapowania jako wersji.
  - Konwersja do wewnętrznych modeli (V2 minimal):
    - wynik importu musi dać się użyć w aplikacji jak „źródło danych” do insightów/raportu,
    - jeśli framework nie jest rozpoznany, zapisujemy jako **generic assessment** z polami key‑value + załącznik PDF.
- OUT:
  - Pełna obsługa skanów bardzo niskiej jakości i wszystkich niestandardowych layoutów (to będzie iteracyjne).
- Future enhancements (post‑V2):
  - Biblioteka „parser templates” per dostawca (automatyzacja dla popularnych formatów).
  - Bulk import wielu PDF + deduplikacja.

**UX / UI notes:**
- Import ma być „guided”: krok 1 upload → krok 2 extraction preview → krok 3 mapping review → krok 4 confirm → gotowe.
- Zawsze pokazujemy „unknowns” i prosimy o uzupełnienie zamiast udawać kompletność.

**Data / integrations:**
- Pipeline: upload → text extraction/OCR → LLM extraction (jeśli użyte) → mapping → zapis.
- Wynik: structured payload + link do źródłowego PDF + confidence map.

**Security / compliance:**
- PDF może zawierać PII/sekrety:
  - dostęp tylko w obrębie projektu/org,
  - logujemy kto importował i kto zatwierdził mapping,
  - opcjonalnie redakcja PII w preview (TBD).

**Analytics (events/metrics):**
- `pdf_import_started`
- `pdf_import_extracted` (pages, ocrUsed, fieldsCount, avgConfidence)
- `pdf_import_mapping_confirmed`
- KPI: accuracy (manual corrections rate), czas od upload do confirm, liczba importów.

**Risks:**
- Zmienność layoutów PDF → potrzebne jasne ograniczenia + confidence + korekty.
- Koszty OCR/LLM → limity i rate limiting + komunikacja w UI.

**Open questions:**
- Jakie 2–3 formaty PDF wspieramy „na start” w V2 (najczęstsze u klientów)?
- Czy import ma zasilać konkretne frameworki (DRD/SIRI/ADMA) czy tylko generic w V2 baseline?

**Definition of Done (DoD):**
- PDF da się zaimportować i uzyskać ustrukturyzowane dane z confidence.
- System pokazuje mapowanie i pozwala skorygować błędy, a wynik jest zapisany i użyteczny dalej (insighty/raport).

**Acceptance / test plan:**
- Test: PDF tekstowy + PDF skan (OCR) → extraction → mapping → confirm → wynik widoczny w projekcie.
- Test: niska pewność pól → UI wymusza review przed confirm.

**Rollout plan:**
- Pilot na kilku realnych PDF od klientów + iteracja parserów na podstawie błędów.

---

## T031 — 🟢 licensed tools — Integration of Additional Paid Assessments (scalable integration format)
- Status spec: draft
- Link / ID (ClickUp): TBD
- Epic: (Licensed Tools scale / Monetization) TBD
- Priorytet / V2 scope: V2

**Business challenge (problem):**
Moduł **Licensed Tools** ma rosnąć o kolejne płatne/licencjonowane metodologie bez przebudowy core. Jeśli każde nowe narzędzie wymaga „ręcznego rzeźbienia” w hubie, routingu, raportach i danych, to:
- rośnie koszt i ryzyko regresji,
- spada tempo dostarczania,
- trudno egzekwować licencjonowanie (trial vs paid).

**Cel (outcome, nie feature):**
Wprowadzamy **kanoniczny integration format** dla nowego paid assessmentu:
- dodanie nowego frameworka wymaga minimalnych, przewidywalnych kroków,
- licencjonowanie/entitlement jest spójne (UI + API),
- nowy framework automatycznie wpina się w: hub → editor → workflow → reports → initiatives → help/KB → analytics.

**Użytkownicy i scenariusze:**
- Product/engineering dodaje nowy framework w tydzień (bez dotykania 30 miejsc).
- Sales uruchamia konkretny licensed tool tylko dla płacących org (bez „wycieku” w UI).

**Scope (V2)**
- IN:
  - Definicja „integration format” (MUST):
    - **Registry/config**: pojedynczy wpis w rejestrze frameworków (id, nazwy, skala, legal notice, importability).
    - **Data model contract**: zdefiniowany typ danych assessmentu + minimalny „normalized view” (overall score, breakdown, gaps, evidence).
    - **Editor/Map component**: komponent edytora (manual entry) zgodny z workflow hubu.
    - **Summary workspace**: spójny, skanowalny widok podsumowania + closure.
    - **Report template**: raport executive‑ready (PDF/print) + gotowość pod deck (T027 pipeline).
    - **Initiatives mapping**: standardowy mechanizm generowania inicjatyw z wyników (po `APPROVED`), z DRD‑scale mapping jeśli potrzebne.
    - **Help/KB hook**: powiązanie frameworka z KB/edukacją w UI.
    - **Analytics hooks**: standardowy zestaw eventów (open/fill/approve/report/export/initiatives).
  - Entitlements / paid gating (MUST):
    - Kanoniczny sposób określenia „czy org ma dostęp do frameworka X”:
      - źródło prawdy: plan/entitlements na org,
      - enforcement na API (backend) + spójne ukrycie/CTA w UI.
    - Zachowanie w UI:
      - jeśli brak dostępu: framework widoczny jako „locked” z jasnym CTA „Upgrade / Request access” (bez możliwości rozpoczęcia),
      - deep‑link do zablokowanego frameworka nie wyświetla danych, tylko ekran dostępu.
  - Standard dodania nowego frameworka (checklista) (MUST):
    - dodać config do rejestru,
    - dodać strukturę (dimensions/levels/categories) i obliczenia,
    - dodać editor + mapę (jeśli dotyczy),
    - dodać raport template,
    - dodać mapping do initiatives,
    - dodać i18n/strings (min EN/PL),
    - dodać legal notice (jeśli educational/proprietary),
    - dodać KB entries i link w UI,
    - dodać testy kontraktowe (minimal) + smoke e2e.
- OUT:
  - Wdrożenie konkretnej nowej metodologii (to będą osobne taski).
- Future enhancements (post‑V2):
  - Marketplace / self‑serve instalacja frameworków przez admina org.
  - Dynamiczne ładowanie definicji frameworków (bez deploy) — jeśli potrzebne.

**UX / UI notes:**
- „Licensed” oznacza premium jakość: każdy nowy framework musi spełniać standard czytelności jak DRD (grafika, closure, sponsor‑ready output).
- Locked/upgrade flow musi być elegancki i spójny z monetyzacją (trial→paid).

**Data / integrations:**
- Docelowo: jeden „normalized layer” do raportów/insightów, ale bez niszczenia różnic metodologii.
- Integracja z T030: jeśli framework `supportsImport`, powinien mieć minimalny mapping schema dla importu PDF.

**Security / compliance:**
- Entitlements enforce’owane po stronie backendu (nie ufamy tylko UI).
- Legal/licensing: jasne rozróżnienie `educational` vs `proprietary` + required notices.

**Analytics (events/metrics):**
- `licensed_tool_locked_viewed` (framework, reason)
- `licensed_tool_unlock_cta_clicked` (framework, source)
- KPI: czas dodania nowego frameworka, liczba uruchomień per framework, trial→paid po wejściu na locked.

**Risks:**
- Zbyt sztywny „format” może ograniczyć metodologie → format musi wspierać warianty (np. SIRI ma prioritisation, Lean ma procesy/stanowiska).
- Jeśli nie zrobimy backend enforcement, paid tools „wyciekną”.

**Open questions:**
- Jaki jest docelowy model entitlements: per‑plan (free/pro/enterprise) czy per‑module add‑on (np. „SIRI pack”)?

**Definition of Done (DoD):**
- Istnieje opisany i działający integration format + checklista.
- Można dodać nowy framework z minimalnymi zmianami w core.
- Entitlements działają end‑to‑end (UI + API) i blokują dostęp, jeśli brak licencji.

**Acceptance / test plan:**
- Test: dodanie „dummy framework” (feature flag) przechodzi checklistę i pojawia się w hubie.
- Test: org bez entitlements widzi locked + CTA, API odrzuca próby rozpoczęcia.

**Rollout plan:**
- Najpierw ustandaryzować istniejące frameworki (SIRI/ADMA/LEAN) pod format, potem dopiero dodawać nowe.

---

## T032 — 🟢 initiative — AI Support for Initiative, Task, and Decision Authoring (fields + whole cards)
- Status spec: draft
- Link / ID (ClickUp): TBD
- Epic: (Execution acceleration / Authoring quality) TBD
- Priorytet / V2 scope: V2

**Business challenge (problem):**
PMO/consulting praca ginie w „pisaniu”: opisy inicjatyw, tasków i decyzji są czasochłonne i często niespójne (ton, struktura, poziom szczegółu). To obniża jakość governance i spowalnia wykonanie. Potrzebujemy AI, które przyspiesza authoring, ale nie halucynuje i zostawia człowieka w pętli.

**Cel (outcome, nie feature):**
Użytkownik może:
- wygenerować/udoskonalić pojedyncze pola (cel, problem, zakres, ryzyka, acceptance criteria itd.),
- wygenerować „szkielet” całej karty (initiative/task/decision) w standardzie Consultify,
z pełną kontrolą: preview → apply, undo, audit trail.

**Użytkownicy i scenariusze:**
- Konsultant: po warsztacie uzupełnia inicjatywy i decyzje 3× szybciej.
- PM: dopina acceptance criteria, ryzyka i scope z zachowaniem spójnego tonu.
- Sponsor/Reviewer: widzi czytelne, executive‑ready opisy.

**Scope (V2)**
- IN:
  - Field‑level AI (MUST):
    - dla pól tekstowych w inicjatywach/taskach/decyzjach dostępne akcje typu:
      - Generate, Improve, Shorten, Expand, Formal tone,
    - formatowanie bez markdown, bez komentarzy; wynik gotowy do wklejenia.
    - język: domyślnie język projektu/użytkownika (z możliwością wyboru).
    - guardrails: „nie wymyślaj faktów” + jeśli brakuje danych → jedna krótka linia „requires confirmation”.
    - integracja z istniejącym UI komponentem (np. `AIFieldEnhancer`) i endpointem `/api/ai/refine-text`.
  - Whole‑card generation (MUST):
    - użytkownik podaje krótki brief (3–8 punktów) + opcjonalne źródła (wyniki assessmentów, insighty, kontekst projektu),
    - AI generuje draft karty w kanonicznej strukturze (pola + checklisty),
    - użytkownik zatwierdza pola per‑sekcja (apply selective), nie „jednym kliknięciem w ciemno”.
  - Templates / standardy treści (MUST):
    - inicjatywy: problem → cel → scope → risks → dependencies → KPI/metrics → milestones/tasks → owners (TBD),
    - taski: title/why → acceptance criteria → blockers/dependencies → estimate/priority,
    - decyzje: decision statement → options (min 2) → recommendation → rationale → risks → due date.
  - Audit + bezpieczeństwo (MUST):
    - logujemy akcje AI authoring (kto, kiedy, na jakim polu, jaki tryb),
    - ograniczenia dostępu jak dla artefaktu (project/org).
- OUT:
  - pełna automatyzacja workflow bez człowieka w pętli (auto‑approve / auto‑publish).
- Future enhancements (post‑V2):
  - „Spec → tasks” generator (dzielenie inicjatywy na backlog z zależnościami),
  - multi‑variant generation (3 opcje tonu/strategii) + compare,
  - style guide per org (brand voice).

**UX / UI notes:**
- „AI as copilot”: zawsze preview i wyraźne Apply/Undo.
- Działa również w locked/read‑only stanach jako „suggestion only” (bez zapisu).
- Minimal friction: skrót w polu + dropdown (nie osobny ekran).

**Data / integrations:**
- Artifact context do promptów: tytuł, status, priorytet, typ, projekt/org + (opcjonalnie) wyniki licensed tools (T026–T028), insighty (T016) i raporty (T027).
- Endpoint: istniejący `/api/ai/refine-text` (field AI). Whole‑card: nowy endpoint authoring (TBD) zwracający structured JSON draft.

**Security / compliance:**
- Polityka dostępu AI: respektuje limity/usage (`ai_call`) i rate limiting.
- PII: nie wciągamy do promptu danych wrażliwych, jeśli nie są konieczne; redakcja jeśli wykryta (TBD).

**Analytics (events/metrics):**
- `ai_authoring_used` (artifactType, fieldKey, mode)
- `ai_authoring_applied` / `ai_authoring_undone`
- `ai_card_generated` (artifactType)
- KPI: adoption rate, time saved (proxy), % undo, feedback quality.

**Risks:**
- Halucynacje → twarde guardrails + wymaganie „unknowns/assumptions”.
- Spójność tonu → template’y i „executive/PMO” style baseline.

**Open questions:**
- Czy domyślny output ma być w języku projektu, czy zawsze po EN (dla międzynarodowych teamów)? (Propozycja: default = język projektu, z przełącznikiem.)

**Definition of Done (DoD):**
- Field AI działa dla inicjatyw, tasków i decyzji (Generate/Improve/Shorten/Expand/Formal) z preview + apply + undo.
- Whole‑card generation generuje draft zgodny ze standardem i daje selective apply.
- Output jest spójny z szablonami i standardami platformy.

**Acceptance / test plan:**
- Test: w inicjatywie użyj AI na 3 polach → apply → undo → audit log istnieje.
- Test: wygeneruj draft decyzji z briefu → apply tylko 2 sekcje → zapis działa.

**Rollout plan:**
- Włączamy stopniowo: najpierw inicjatywy → potem taski → potem decyzje; feature flag + monitoring usage/cost.

---

## T033 — 🟢 initiative — AI Readiness and Stage‑Gate Validation for Initiatives (governance copilot)
- Status spec: draft
- Link / ID (ClickUp): TBD
- Epic: (Governance / Stage‑gate quality) TBD
- Priorytet / V2 scope: V2

**Business challenge (problem):**
Transformacja wymaga governance. Inicjatywy „utykają”, bo brakuje im podstaw: ownera, scope, KPI, decyzji gate’owych, zależności, planu i kryteriów akceptacji. Manualny review jest drogi i niespójny. AI ma wymuszać kompletność i jakość, ale bez automatycznego „zatwierdzania za człowieka”.

**Cel (outcome, nie feature):**
System w każdej fazie stage‑gate potrafi jasno powiedzieć:
- **czy inicjatywa jest gotowa** do przejścia do kolejnego etapu,
- **czego brakuje** (blocking vs warning),
- **co konkretnie zrobić** (rekomendowane akcje) i kto powinien to zrobić,
oraz mapuje to do istniejących statusów/gate’ów inicjatywy.

**Użytkownicy i scenariusze:**
- PMO: dostaje checklistę gotowości przed gate (mniej „wracania”).
- Owner: widzi konkretne braki i może je od razu uzupełnić.
- Sponsor/Steering: widzi, co jest zrobione vs czego brakuje, z uzasadnieniem.

**Scope (V2)**
- IN:
  - Readiness model (MUST):
    - kanoniczna lista wymagań per status/gate (np. `DRAFT`, `PENDING_REVIEW`, `REVIEW`, `PLANNING`, `APPROVED`, `SCHEDULED`…),
    - każdy requirement ma:
      - severity: `blocking` | `warning`,
      - pass/fail,
      - message (krótko i konkretnie),
      - suggested fix (link do sekcji/pola lub akcja).
    - requirement’y są w dużej mierze deterministyczne (rule‑based), AI dodaje „quality lens”.
  - AI readiness analysis (MUST):
    - AI ocenia jakość i kompletność opisów (scope, risks, KPIs, dependencies, gate decisions),
    - wykrywa niespójności (np. KPI nie wynika z celu, brak owners, daty sprzeczne),
    - generuje rekomendacje działań (np. dopisz acceptance criteria, dodaj decyzję typu X, uzupełnij RAID),
    - zwraca wynik w formie ustrukturyzowanej listy „blocking/warning” + krótkie rationale.
  - Stage‑gate mapping (MUST):
    - readiness odnosi się do istniejących gate’ów/statusów (np. `SUBMIT_FOR_REVIEW`, `APPROVE_TO_INITIATIVE`, `START_PLANNING`, `APPROVE`, `SCHEDULE`, `START`, …),
    - UI pokazuje „Next gate” + czy readiness przepuszcza (lub co blokuje).
  - UI integration (MUST):
    - w sekcji typu `GateReadinessSection` widoczna jest:
      - lista readiness checks (blocking/warning),
      - priorytety top‑blocking (max 5 na górze),
      - CTA do naprawy (focus na konkretną sekcję/pole),
      - opcjonalnie przycisk „Ask AI for readiness suggestions” (z preview i selektywnym zastosowaniem sugerowanych zmian).
  - Guardrails (MUST):
    - AI **nie** zmienia statusu i **nie** zatwierdza gate’a automatycznie.
    - decyzje gate’owe pozostają po stronie ról (PMO/Sponsor/Steering) wg uprawnień.
- OUT:
  - automatyczne przełączanie statusów/gate bez człowieka.
- Future enhancements (post‑V2):
  - „readiness score” z trendem w czasie + SLA (kiedy utknęło),
  - automatyczne przypomnienia i eskalacje na podstawie blockingów.

**UX / UI notes:**
- Wynik ma być „audit‑like”: krótko, konkretnie, z linkiem „napraw tutaj”.
- Zawsze rozróżniać: hard blockers vs soft warnings.

**Data / integrations:**
- Wejścia: initiative (pola), tasks, decisions, RAID, stakeholders, plan/dates + aktualny status.
- API/AI: wykorzystać politykę dostępu AI (limity, `ai_call`) oraz istniejące wzorce „AI propose changes” (preview + selective apply).

**Security / compliance:**
- Uprawnienia do oglądania readiness są takie jak do inicjatywy; edycje tylko wg capabilities/permissions.

**Analytics (events/metrics):**
- `initiative_gate_readiness_viewed` (status, gateType)
- `initiative_gate_readiness_ai_requested`
- `initiative_gate_readiness_blockers_count` (count)
- KPI: mniej inicjatyw „utkniętych”, mniej rejection/send‑back, krótszy time‑to‑gate.

**Risks:**
- Jeśli reguły gate’ów nie są dobrze zdefiniowane, AI będzie „zgadywać” → dlatego rule‑based core + AI jako warstwa jakości.
- Zaufanie do AI: musi być explainable i conservative.

**Open questions:**
- Czy readiness ma być wymagane (hard‑block) dla akcji gate, czy tylko advisory w V2? (Propozycja V2: hard‑block tylko dla wybranych krytycznych braków, reszta advisory.)

**Definition of Done (DoD):**
- System potrafi wskazać „czego brakuje” i co zrobić, by przejść dalej, dla co najmniej 3 kluczowych gate’ów (review → planning → approval) + faza Tools/Assessment submit.
- Wynik jest czytelny i zintegrowany z UI inicjatywy.

**Acceptance / test plan:**
- Test: inicjatywa bez ownera/KPI → readiness pokazuje blocking + CTA.
- Test: po uzupełnieniu pól blocking znika, next gate staje się dostępny.
- Test: AI sugestie → preview → apply selective.

**Rollout plan:**
- Feature flag na AI readiness; start w PMO/internal, potem rozszerzenie.

---

## T034 — 🟢 initiative — AI Correlation and Optimization Across Initiatives (portfolio coherence)
- Status spec: draft
- Link / ID (ClickUp): TBD
- Epic: (Portfolio coherence / PMO optimization) TBD
- Priorytet / V2 scope: V2

**Business challenge (problem):**
Portfel inicjatyw musi być spójny. Bez korelacji i optymalizacji powstają:
- duplikaty (2 inicjatywy „robią to samo”),
- overlap scope (nakładające się deliverables),
- konflikty czasowe i zależności,
- konflikty zasobów (ten sam owner/ekspert wszędzie),
co marnuje budżet i wydłuża timeline.

**Cel (outcome, nie feature):**
AI pomaga PMO/tranformation office:
- wykryć korelacje, redundancje, konflikty i okazje do konsolidacji,
- zaproponować konkretne korekty (priorytety, zależności, terminy, merge),
z **wyjaśnieniem “dlaczego”** i bez automatycznych zmian bez akceptacji.

**Użytkownicy i scenariusze:**
- PMO zaznacza 10–30 inicjatyw w widoku portfela → „Analyze portfolio” → dostaje listę konfliktów + rekomendacje.
- Owner widzi, że jego inicjatywa dubluje się z inną → dostaje propozycję konsolidacji.

**Scope (V2)**
- IN:
  - Portfolio AI analysis (MUST):
    - detekcja co najmniej kilku typów problemów:
      - **timeline overlaps** (kolizje terminów),
      - **dependency risks** (brakujące zależności / ryzyko blokady),
      - **resource conflicts** (owner/capacity),
      - **priority incoherence** (np. niskie priority przy wysokim ROI),
      - **duplication/overlap** (semantycznie podobne inicjatywy — “to samo innymi słowami”).
    - rekomendacje: co zmienić (konkretnie) + rationale.
  - Wykorzystanie istniejących endpointów AI (MUST):
    - `/api/ai/initiatives/conflicts` → konflikty timeline/resource/dependency,
    - `/api/ai/initiatives/priorities` → rekomendowane priorytety,
    - (V2) detekcja podobieństw/duplikacji: uzupełnić o warstwę “semantic overlap” (TBD implementacyjnie).
  - UI integration w portfelu (MUST):
    - w `PortfolioListView` (tabela) użytkownik może wybrać subset inicjatyw (checkboxy już istnieją),
    - akcja „AI: Analyze selection” uruchamia analizę i pokazuje wyniki w panelu:
      - Conflicts (z severity),
      - Priority suggestions,
      - Consolidation suggestions (merge/overlap),
      - Next actions (konkretne kroki).
  - Apply model (MUST):
    - żadnych automatycznych zmian bez akceptacji,
    - tam gdzie to możliwe: przycisk „Apply” na pojedynczej rekomendacji (np. ustaw priority) + audit log.
  - Explainability (MUST):
    - każda sugestia ma “dlaczego tak” i “jak to wpływa” (1–3 zdania).
- OUT:
  - Pełne portfolio simulation na danych historycznych i zaawansowane optymalizacje wielowymiarowe (to osobne taski).
- Future enhancements (post‑V2):
  - Konsolidacja inicjatyw “merge wizard” (łączenie scope, tasks, RAID, decisions).
  - Wykrywanie redundancji KPI/benefits i duplikacji w tasks.

**UX / UI notes:**
- Wyniki muszą być skanowalne: sortowanie po severity/impact, max 10–20 top items.
- „Nie spamujemy AI”: analiza on‑demand + cache per selection (TBD) żeby nie przepalać kosztów.

**Data / integrations:**
- Input minimalny: id, name, priority, owner, plannedStart/End, (opcjonalnie) ROI/capacity + dependencies.
- Idealnie: uzupełnić kontekst o status, module stage, health, gateReadiness top blocking (jeśli dostępne).

**Security / compliance:**
- Dostęp do analizy jak dostęp do portfela/projektu; AI usage podlega polityce `ai_call`.

**Analytics (events/metrics):**
- `portfolio_ai_analysis_requested` (countInitiatives, mode=conflicts|priorities|full)
- `portfolio_ai_suggestion_applied` (type, initiativeId)
- KPI: liczba wykrytych redundancji i zaakceptowanych zmian; spadek konfliktów/blocked.

**Risks:**
- Explainability i zaufanie: sugestie muszą być konserwatywne i oparte o dane; brak danych = “unknown”.
- Semantic overlap może dawać false positives — potrzebny próg i UI “dismiss”.

**Open questions:**
- Czy analiza ma działać per‑projekt czy cross‑project (cała organizacja) w V2?

**Definition of Done (DoD):**
- System wskazuje minimum kilka typów korelacji/redundancji i konfliktów na selekcji inicjatyw.
- Sugestie są wyjaśnialne (dlaczego tak) i użytkownik może je zaakceptować lub odrzucić.

**Acceptance / test plan:**
- Test: 5 inicjatyw z nakładającymi się datami i tym samym ownerem → conflicts wykryte.
- Test: 3 inicjatywy o podobnych nazwach/scope → overlap suggestion pojawia się i da się dismiss.

**Rollout plan:**
- Najpierw dla PMO/internal; potem dla klientów enterprise.

---

## T035 — 🟢 initiative — Cross‑Initiative Time Optimization Engine (sequence + bottlenecks + scenarios)
- Status spec: draft
- Link / ID (ClickUp): TBD
- Epic: (Execution optimization / Timeline) TBD
- Priorytet / V2 scope: V2

**Business challenge (problem):**
Bez optymalizacji sekwencji inicjatywy blokują się wzajemnie, tworzą bottlenecki i wydłużają timeline. PMO często nie ma narzędzia do szybkiego „co jeśli” (przesuń A przed B, podziel na fale, odblokuj dependency) i kończy na ręcznych arkuszach.

**Cel (outcome, nie feature):**
System potrafi:
- zidentyfikować bottlenecki i ryzyka sekwencjonowania,
- zaproponować 2–3 alternatywne scenariusze sekwencji (waves/quarters),
- pokazać „co się zmienia” (diff) i „dlaczego”,
oraz umożliwić zastosowanie wybranego scenariusza jako planu (plannedStart/plannedEnd / quarter allocation).

**Użytkownicy i scenariusze:**
- PMO wybiera 10–50 inicjatyw → generuje plan kwartalny (Year1..Year3) → widzi konflikty → wybiera scenariusz.
- Lider wykonania: widzi, że 3 inicjatywy są foundation i muszą iść wcześniej; reszta jest przesuwana.

**Scope (V2)**
- IN:
  - Inputs (MUST):
    - inicjatywy z minimalnym zestawem pól: id, name, priority, complexity, (opcjonalnie) ROI, owner, capacity, planned dates,
    - zależności między inicjatywami (finish‑to‑start jako baseline),
    - ograniczenia: max „major initiatives” per quarter/wave (konfigurowalne).
  - Optimization output (MUST):
    - plan w postaci roadmapy kwartalnej (Year1..Year3, Q1..Q4) — kompatybilny z istniejącym `roadmap` shape,
    - harmonogram z wyliczonym plannedStartDate/plannedEndDate (jak w `/api/ai/initiatives/schedule`),
    - lista bottlenecków i krytycznych zależności (top 10) z rekomendacją.
  - Scenarios (MUST):
    - minimum 2 scenariusze:
      - **Fast value** (quick wins first),
      - **Risk‑reduction** (foundation + compliance first),
      - (opcjonalnie) **Balanced capacity** (minimal resource conflicts).
    - Każdy scenariusz ma:
      - summary (2–4 zdania),
      - key changes vs current (diff list),
      - assumptions/unknowns.
  - Integracja z istniejącymi endpointami (MUST):
    - wykorzystać `/api/ai/roadmap` i/lub `/api/ai/initiatives/schedule` jako bazę generacji,
    - po wygenerowaniu: uruchomić `/api/ai/initiatives/conflicts` na wyniku, aby pokazać konflikty i iterować.
  - Apply model (MUST):
    - użytkownik może „Apply scenario” → zapis planowanych dat/kwartałów w inicjatywach (audit log),
    - bez auto‑apply w tle.
- OUT:
  - Optymalizacja wielowymiarowa enterprise (1000+ tasków, constraints solver) — post‑V2.
  - Automatyczne sterowanie wykonaniem bez akceptacji człowieka.
- Future enhancements (post‑V2):
  - Integracja z task dependencies i duration (task‑level scheduling).
  - Symulacje „czas vs budżet” (scenariusze kosztowe) + Monte‑Carlo.

**UX / UI notes:**
- Wyniki muszą być czytelne: roadmap grid + lista bottlenecków + diff.
- „Scenario compare”: proste porównanie 2–3 scenariuszy (czas, #conflicts, #foundation first).

**Data / integrations:**
- Wykorzystać istniejące modele inicjatyw + zależności (jeśli istnieją) oraz portfolio views.
- Jeśli brak danych (complexity/capacity), engine ma pracować na conservative defaults i jawnie pokazać unknowns.

**Security / compliance:**
- Dostęp jak do portfela/projektu; AI usage podlega polityce `ai_call`.

**Analytics (events/metrics):**
- `portfolio_timeline_optimization_requested` (countInitiatives, scenarios)
- `portfolio_timeline_scenario_applied` (scenarioType)
- KPI: skrócenie planowanego czasu (proxy), spadek konfliktów, mniej blocked.

**Risks:**
- Jakość estymat i zależności — bez danych scenariusze będą „z grubsza”; musimy to komunikować.
- Zaufanie: wynik musi być explainable i łatwy do odrzucenia.

**Open questions:**
- Czy w V2 optymalizujemy tylko na poziomie inicjatyw (quarter/wave), czy też na poziomie dat dziennych/tygodniowych?

**Definition of Done (DoD):**
- System identyfikuje bottlenecki i proponuje alternatywne sekwencje jako scenariusze.
- Użytkownik widzi „co się zmienia” i może zastosować wybrany scenariusz.

**Acceptance / test plan:**
- Test: zestaw 10 inicjatyw z zależnościami → scenariusz „Risk‑reduction” przesuwa foundation przed dependent.
- Test: apply scenariusza → plannedStart/plannedEnd zapisane + audit log.

**Rollout plan:**
- Pilot na PMO/internal, potem na enterprise klientów.

---

## T036 — 🟢 initiative — AI Workload Forecasting and Intelligent Task Allocation (capacity → assignment suggestions)
- Status spec: draft
- Link / ID (ClickUp): TBD
- Epic: (Resourcing / Delivery reliability) TBD
- Priorytet / V2 scope: V2

**Business challenge (problem):**
Brak inteligentnego dopasowania zasobów powoduje przeciążenia, opóźnienia i „ukryte ryzyka”. Nawet jeśli widać workload, nadal brakuje odpowiedzi: **kogo odciążyć, komu przypisać, co przesunąć**, i dlaczego.

**Cel (outcome, nie feature):**
System:
- prognozuje obciążenie (capacity forecast) dla zespołu,
- wykrywa przeciążenia i ryzyka (overload + bottlenecks),
- rekomenduje alokacje tasków (kto powinien wykonać / jak zbalansować),
z wyjaśnieniem podstawy (availability, SLA, rola, kompetencje jeśli dostępne).

**Użytkownicy i scenariusze:**
- Lider zespołu/PMO widzi, że 2 osoby są >110% i ma 1‑klik propozycje odciążenia.
- PMO wybiera projekt i prosi AI o rekomendacje przypisań na tydzień (SLA‑aware).

**Scope (V2)**
- IN:
  - Workload forecast (MUST):
    - prognoza 7‑dniowa (minimum) na bazie:
      - liczby i statusów tasków,
      - estimated hours (jeśli jest),
      - due_date / SLA due,
      - historycznej prędkości (proxy: tasksCompleted) (jeśli dostępne).
    - wynik: per osoba per dzień: capacity%, plannedTasks, estimatedHours, riskLevel, bottlenecks.
    - integracja w UI (wykorzystać istniejące `WorkloadView` + `CapacityForecast`).
  - Intelligent allocation suggestions (MUST):
    - AI proponuje rekomendacje dla:
      - reassignment (kogo odciążyć → komu przenieść),
      - due date adjustments (jeśli dozwolone) (TBD),
      - backlog split (podział taska) (TBD),
      - escalation/backup assignment (jeśli overdue/SLA breach).
    - sugestie są explainable (1–3 zdania) + pokazują trade‑offs/risks.
  - Apply model (MUST):
    - brak automatycznego przypisywania bez akceptacji,
    - UI: preview list → checkboxy → Apply selected,
    - apply wykonuje realne operacje przez istniejące serwisy przypisań (np. `TaskAssignmentService.assignTask`) + audit log.
  - Constraints / guardrails (MUST):
    - nie przypisujemy tasków osobom, które nie są członkami projektu / nie mają roli task‑assignee,
    - respektujemy permissions/capabilities (kto może reassign),
    - AI zawsze oznacza “unknown” gdy brak danych o kompetencjach/estymatach.
- OUT:
  - Automatyczne przypisywanie bez akceptacji człowieka.
- Future enhancements (post‑V2):
  - Model kompetencji/skills per osoba + dopasowanie do typów tasków.
  - Integracja z kalendarzami (PTO, spotkania) i realnym capacity.

**UX / UI notes:**
- „BCG/McKinsey style”: predictive + actionable (nie tylko wykres).
- Dwa widoki: (1) team heatmap (2) rekomendacje AI jako lista działań.

**Data / integrations:**
- Backend endpointy (TBD): `GET /my-work/team-workload` już istnieje dla „current”; potrzebny forecast source (lub wyliczany w backendzie).
- AI: nowy endpoint typu `/api/ai/tasks/allocation` (TBD) albo rozszerzenie istniejącego AI pipeline o „resourcing”.

**Security / compliance:**
- Uprawnienia: tylko role z prawem do reasign (PMO/PM/Lead) mogą apply.
- AI usage podlega polityce `ai_call` + rate limiting.

**Analytics (events/metrics):**
- `workload_forecast_viewed` (projectId?)
- `ai_allocation_requested` (countTasks, horizonDays)
- `ai_allocation_applied` (movedCount)
- KPI: mniej overdue, niższy overload%, wyższy throughput.

**Risks:**
- Brak estymat godzin → forecast mniej dokładny (potrzebne conservative heuristics).
- Zaufanie zespołu do “AI assigning” → dlatego preview + explainability + człowiek w pętli.

**Open questions:**
- Czy forecast liczymy per projekt czy cross‑project (dla użytkownika/org) w V2?

**Definition of Done (DoD):**
- System pokazuje forecast obciążenia i identyfikuje przeciążenia/ryzyka.
- AI rekomenduje alokacje, a użytkownik rozumie podstawę rekomendacji.
- Da się zastosować wybrane sugestie (reassign) z audit log.

**Acceptance / test plan:**
- Test: projekt z 20 taskami, 1 osoba overload → AI proponuje przeniesienie 3 tasków do dostępnej osoby.
- Test: apply → task assignee zmieniony, SLA przeliczony, aktywność i audit zapisane.

**Rollout plan:**
- Feature flag; najpierw internal PMO, potem enterprise.

---

## T037 — 🟢 initiative — Non‑Human Resource Allocation for Parallel Initiatives (budget/tools/infra/vendors)
- Status spec: draft
- Link / ID (ClickUp): TBD
- Epic: (Resourcing / Procurement & capacity) TBD
- Priorytet / V2 scope: V2

**Business challenge (problem):**
Bottlenecki często wynikają nie z ludzi, tylko z zasobów „nieludzkich”: budżet (CAPEX/OPEX), licencje, sprzęt, infrastruktura, usługi zewnętrzne i lead‑time zakupów. Bez modelowania tych zasobów inicjatywy wchodzą sobie w drogę: 2 zespoły kupują to samo, budżet kwartalny się nie spina, a terminy są nierealne względem procurement.

**Cel (outcome, nie feature):**
PMO może planować i kontrolować zasoby nieludzkie w portfelu:
- widzi agregaty budżetu i „hotspots” per wave/kwartał,
- wykrywa konflikty (np. wspólny vendor/tool, przekroczenie limitu, kolizje lead‑time),
- dostaje rekomendacje korekt (przesuń, skonsoliduj zakup, zmień wariant).

**Użytkownicy i scenariusze:**
- PMO zaznacza 10–30 inicjatyw → widzi agregat CAPEX/OPEX per kwartał + konflikty narzędzi/licencji.
- Procurement/Finance dostaje listę „resource requests” z priorytetem i terminami.

**Scope (V2)**
- IN:
  - Data capture (MUST):
    - wykorzystać istniejący model zasobów na inicjatywie (sekcja `ResourcesSection`):
      - Budget (line items CAPEX/OPEX),
      - Tools & Infrastructure (software/hardware/cloud),
      - Licenses/Training/Intangibles,
      - (opcjonalnie) consulting/vendors jako kategoria budżetu.
    - doprecyzować minimalne pola wymagane do analizy portfelowej:
      - kwartał/miesiąc wydatku (lub plannedStart/End inicjatywy jako fallback),
      - kwota + waluta,
      - vendor/tool name,
      - lead time (TBD, może być heurystyczny lub pole).
  - Portfolio‑level conflict detection (MUST):
    - wykrywanie co najmniej kilku typów konfliktów:
      - **Budget collision**: suma budżetów w okresie przekracza limit (TBD: limit per projekt/org),
      - **Duplicate purchase**: te same narzędzia/licencje w wielu inicjatywach (kandydat do konsolidacji),
      - **Infra bottleneck**: współdzielone zasoby (np. środowisko testowe, linia produkcyjna) oznaczone jako shared (TBD),
      - **Lead‑time risk**: zaplanowany start inicjatywy < lead time zasobu (ryzyko opóźnienia).
    - wynik ma severity + rekomendację.
  - Forecast / dashboard (MUST):
    - w portfelu (lub w inicjatywie) widok:
      - agregat budżetu CAPEX/OPEX per kwartał,
      - top 5 konfliktów zasobowych,
      - „what to do next” lista akcji (np. utwórz task procurement, decyzja budżetowa).
  - Apply model (MUST):
    - brak automatycznych zmian budżetu/zakupów,
    - rekomendacje mogą generować:
      - taski do procurement/finance,
      - decyzje (np. „approve budget increase”, „choose vendor option”),
      - sugestie przesunięcia inicjatywy (wejście do T035 scenariuszy).
- OUT:
  - Integracje z ERP / automatyczne zamówienia.
  - Zaawansowany, pełny „resource scheduling” solver dla setek zasobów.
- Future enhancements (post‑V2):
  - Katalog zasobów org (vendor contracts, licencje aktywne, sprzęt) + real availability.
  - Multi‑currency i rozliczenia per cost center.
  - Integracje procurement/ERP.

**UX / UI notes:**
- To ma być bardzo czytelne: „budget heatmap” + conflicts list (skanowalne).
- Dla każdej rekomendacji: co się stanie jeśli nic nie zrobimy + sugerowany owner (PMO/Finance/Procurement).

**Data / integrations:**
- Źródło: zasoby wpisane w inicjatywach (ResourcesSection) + planned dates/statusy inicjatyw.
- Integracja z T035: konflikty zasobowe powinny wpływać na scenariusze sekwencji (np. przesunięcie zakupów).

**Security / compliance:**
- Budżety mogą być wrażliwe: role‑based visibility (TBD) — w V2 minimum: jak inicjatywa/projekt.

**Analytics (events/metrics):**
- `portfolio_nonhuman_resources_viewed`
- `portfolio_nonhuman_conflict_detected` (type, severity)
- `portfolio_nonhuman_action_created` (task|decision)
- KPI: mniej konfliktów w execution, mniej opóźnień „procurement‑driven”.

**Risks:**
- Brak danych (kwartały, lead time) → trzeba mieć fallbacki i oznaczać unknowns.
- Duplikaty nazw vendorów/tools → potrzebna normalizacja (TBD).

**Open questions:**
- Czy w V2 mamy zdefiniowane limity budżetowe per projekt/org/kwartał, czy tylko pokazujemy agregaty i ostrzeżenia?

**Definition of Done (DoD):**
- System potrafi planować zasoby nieludzkie i wykrywa konflikty przy równoległych inicjatywach.
- Proponuje korekty (konsolidacja zakupów / przesunięcie / task/decision) i pokazuje uzasadnienie.

**Acceptance / test plan:**
- Test: 2 inicjatywy z tym samym tool/licencją w tym samym kwartale → wykryty duplicate purchase + rekomendacja konsolidacji.
- Test: suma budżetu w Q1 przekracza limit (jeśli limit jest ustawiony) → warning/high severity + sugerowana decyzja budżetowa.

**Rollout plan:**
- Start jako view‑only analytics; potem generowanie tasków/decyzji z rekomendacji.

---

## T038 — 🟢 initiative — Scenario‑Based Timeline and Budget Optimization (trade‑offs: time vs spend)
- Status spec: draft
- Link / ID (ClickUp): TBD
- Epic: (Scenario planning / Sponsor decisions) TBD
- Priorytet / V2 scope: V2

**Business challenge (problem):**
Na poziomie portfela potrzebujemy narzędzia trade‑off: **czas vs budżet**. Sponsor/PMO musi szybko odpowiedzieć na pytania:
- „Jeśli chcemy dowieźć w 6 miesięcy — ile to kosztuje i co wypada?”
- „Jeśli musimy zmieścić się w budżecie — co przesuwamy i jakie są ryzyka?”
Bez scenariuszy decyzje są intuicyjne i później wychodzą jako opóźnienia/koszty.

**Cel (outcome, nie feature):**
System generuje 2–3 scenariusze wykonania portfela pod zadane constraints (czas/budżet) i pokazuje różnice:
- timeline (waves/quarters),
- budżet (CAPEX/OPEX per kwartał + agregaty),
- ryzyka/konflikty (resource + dependencies),
tak aby sponsor mógł świadomie wybrać wariant i zatwierdzić plan.

**Użytkownicy i scenariusze:**
- Sponsor: ustawia constraint „max spend w Q1” lub „deadline do końca Q2” → porównuje scenariusze → wybiera.
- PMO: przygotowuje 2–3 warianty na steering committee.

**Scope (V2)**
- IN:
  - Constraints input (MUST):
    - czas: deadline (date) albo target horizon (np. 6/12/18 mies.),
    - budżet: limit per okres (kwartał) lub total cap,
    - workload limit: max initiatives per quarter/wave (re‑use z T035),
    - opcjonalnie: „must‑do initiatives” (nie wolno przesunąć) (TBD).
  - Scenario generation (MUST):
    - minimum 2–3 scenariusze:
      - **Time‑boxed** (dowiezienie na czas),
      - **Budget‑boxed** (zmieszczenie w budżecie),
      - **Balanced** (kompromis).
    - Każdy scenariusz zawiera:
      - roadmap grid (Year/Quarter) + plannedStart/End per initiative (re‑use T035),
      - budżet per kwartał (CAPEX/OPEX) + highlights przekroczeń/near‑miss,
      - konflikty (dependencies/resource/non‑human) + top risks,
      - co wypada/przesuwa się (diff).
  - Model danych i źródła (MUST):
    - timeline: z T035 (roadmap/schedule),
    - budżet/zasoby nieludzkie: z T037 (ResourcesSection line items),
    - konflikty: z T034 (conflicts) + T037 (non‑human conflicts).
  - Decision support (MUST):
    - scenariusz ma “executive summary” (5–8 linijek) i jawne assumptions/unknowns,
    - opcja wygenerowania decyzji sponsorskiej (Decision card) typu „Choose scenario X” z rationale i ryzykami (manual approve).
  - Apply model (MUST):
    - użytkownik może zastosować wybrany scenariusz jako plan (planned dates/quarters) + audit log,
    - bez automatycznych zmian bez akceptacji.
- OUT:
  - Pełna optymalizacja matematyczna z solverem enterprise (constraints solver).
  - Real‑time integracje budżetów/ERP.
- Future enhancements (post‑V2):
  - Solver + scenariusze probabilistyczne (Monte‑Carlo) dla ryzyk,
  - scenariusze „budżet vs ryzyko” i „czas vs ryzyko” (multi‑objective).

**UX / UI notes:**
- Ekran “Scenario compare”:
  - karta per scenariusz: deadline hit %, budget hit %, conflicts count, key risks,
  - klik → szczegóły: roadmap grid + budget heatmap + diff list.
- Zawsze pokazujemy „unknowns” (brak kwartału na wydatku, brak kwot itd.).

**Data / integrations:**
- Jeśli brak danych budżetowych, scenariusz nadal działa, ale oznacza budżet jako unknown i nie robi budget boxing.
- AI usage podlega polityce `ai_call` — scenariusze mogą być cache’owane dla tej samej selekcji/constraintów (TBD).

**Security / compliance:**
- Budżety są wrażliwe: role‑based visibility jak w T037.

**Analytics (events/metrics):**
- `portfolio_scenario_optimization_requested` (constraintsType, countInitiatives)
- `portfolio_scenario_selected` (scenarioType)
- `portfolio_scenario_applied`
- KPI: krótszy cykl decyzyjny, mniej overruns, lepsza przewidywalność.

**Risks:**
- Brak danych wejściowych (budżet/duration) → scenariusze muszą być conservative i explainable.
- Over‑trust w AI → dlatego decyzja sponsora i preview.

**Open questions:**
- Czy w V2 wprowadzamy “budget limits” jako ustawienia projektu/org, czy użytkownik wpisuje je ad‑hoc per analiza?

**Definition of Done (DoD):**
- System generuje min. 2–3 sensowne scenariusze oparte o constraints (czas/budżet) i pokazuje różnice.
- Użytkownik może wybrać i zastosować scenariusz jako plan (z audit log).

**Acceptance / test plan:**
- Test: ustaw limit budżetu w Q1 → scenariusz Budget‑boxed przesuwa wydatki lub inicjatywy na Q2/Q3.
- Test: ustaw deadline → scenariusz Time‑boxed przesuwa quick wins wcześniej i wskazuje co wypada.

**Rollout plan:**
- Pilot na PMO/internal + 1 steering committee deck (demo).

---

## T039 — 🟡 execution — Timeline Management (Execution Module) (operational control layer)
- Status spec: draft
- Link / ID (ClickUp): TBD
- Epic: (Execution control / Delivery) TBD
- Priorytet / V2 scope: V2

**Business challenge (problem):**
Po zatwierdzeniu i zaplanowaniu inicjatyw potrzebujemy warstwy „operational control”: jednej osi czasu, na której widać postęp, zależności i ryzyka opóźnień. Bez tego execution dzieje się w wielu miejscach, a problemy wychodzą za późno.

**Cel (outcome, nie feature):**
Moduł execution timeline pozwala PMO i liderom wykonania:
- zobaczyć portfel w czasie (plan vs wykonanie),
- wykryć konflikty/zależności/bottlenecki,
- aktualizować plan i statusy w kontrolowany sposób,
z minimalnym noise i wysoką czytelnością.

**Użytkownicy i scenariusze:**
- PMO: codziennie otwiera Timeline → widzi co jest krytyczne / blocked / overdue → reaguje.
- Lider wykonania: przesuwa daty inicjatywy o tydzień i widzi wpływ na zależne inicjatywy.
- Sponsor (read‑only): widzi “where we are” i co blokuje.

**Scope (V2)**
- IN:
  - Timeline views (MUST):
    - widok Gantt/timeline dla inicjatyw w execution (co najmniej: `SCHEDULED`, `EXECUTING`, `BLOCKED`, `DONE` + opcjonalnie `APPROVED`),
    - paski inicjatyw oparte o `plannedStartDate`/`plannedEndDate` + status‑based coloring,
    - krytyczne elementy wyróżnione (blocked/overdue/critical path heurystycznie).
  - Dependencies (MUST):
    - wizualizacja zależności (linie/strzałki) jeśli są dostępne,
    - walidacja nielogicznych sekwencji (start przed końcem poprzednika) + circular deps jako error,
    - możliwość dodania/usunięcia zależności (tylko role uprawnione) (TBD minimal: add dependency).
  - Updates & monitoring (MUST):
    - możliwość aktualizacji:
      - statusu (zgodnie z gate’ami/permissions),
      - planowanych dat start/end (z audit log),
      - progress (jeśli pole istnieje) (TBD),
    - monitoring:
      - top warnings (max 10): overdue, blocked, dependency risk,
      - “next gate / next action” per initiative (link do gate readiness / decyzji / tasków).
  - Filters & focus (MUST):
    - filtry: status, priority, owner, axis/obszar, krytyczne/blocked,
    - search po nazwie,
    - focus na projekcie lub widok cross‑project (TBD; V2 minimal = per projekt).
  - Refresh strategy (V2 baseline):
    - odświeżanie manual + polling (np. co 60–120s) zamiast pełnego real‑time (websocket) jeśli nie ma infrastruktury.
- OUT:
  - Pełny MS Project replacement: baseline/actual scheduling z solverem, zaawansowane resource leveling.
- Future enhancements (post‑V2):
  - Real‑time collaboration (websocket) + live cursors / locks.
  - Baseline vs actual (earned value) i automatyczne przewidywanie slip (osobny task).

**UX / UI notes:**
- “Tech Sexy” i skanowalność: minimal chroma, kolor tylko semantycznie (status/critical).
- Prawa edycji muszą być czytelne w UI (disabled + tooltip).

**Data / integrations:**
- Inicjatywy: status, priority, plannedStart/End, owner, dependencies, risk/health (jeśli dostępne).
- Wpięcie w istniejący Execution Hub (Timeline tab) i współpraca z T035/T038 (planowanie → execution monitoring).

**Security / compliance:**
- Edycje tylko dla ról uprawnionych; sponsor read‑only.
- Audit log dla zmian dat/statusów i zależności.

**Analytics (events/metrics):**
- `execution_timeline_viewed` (projectId?, scope)
- `execution_timeline_initiative_updated` (field=status|dates|dependency)
- KPI: adoption, redukcja „late escalations”, krótszy czas do reakcji na blocked.

**Risks:**
- Braki danych o zależnościach → timeline będzie „płaski” (dlatego V2 walidacja + minimalne dependency CRUD).
- Performance na dużych portfelach → potrzebne paginacje/virtualization (TBD).

**Open questions:**
- Czy V2 timeline działa per projekt czy cross‑project (cała organizacja) jako default?

**Definition of Done (DoD):**
- Timeline pokazuje zależności i postęp; da się aktualizować statusy i planowane daty (z uprawnieniami).
- Widok jest używalny dla portfela (filtry, focus) i nie gubi czytelności.

**Acceptance / test plan:**
- Test: 10 inicjatyw z 3 zależnościami → timeline pokazuje paski i linie; walidacja wykrywa konflikt sekwencji.
- Test: zmiana plannedEndDate inicjatywy → audit log; zależna inicjatywa pokazuje warning jeśli start < end poprzednika.

**Rollout plan:**
- Najpierw internal PMO; potem enterprise klienci.

---

## T040 — 🟡 execution — Risk Signaling and Mitigation Management (RAID + proactive alerts)
- Status spec: draft
- Link / ID (ClickUp): TBD
- Epic: (Execution governance / Early warning) TBD
- Priorytet / V2 scope: V2

**Business challenge (problem):**
W execution ryzyka powinny być wykrywane wcześnie, zanim zamienią się w issues i slip. Bez proaktywnej sygnalizacji PMO dowiaduje się o problemach „za późno”, a mitigation jest ad‑hoc. Potrzebujemy systemu, który:
- konsoliduje ryzyka w RAID,
- sygnalizuje “early warning”,
- proponuje sensowne mitigacje i śledzi ich status.

**Cel (outcome, nie feature):**
System identyfikuje i sygnalizuje ryzyka w trakcie wykonania oraz wspiera mitigację:
- wykrywa ryzyka na bazie danych (heurystyki) i AI,
- tworzy/aktualizuje wpisy RAID,
- wysyła alerty do właściwych osób,
- pozwala śledzić mitigacje (plan → owner → due date → status).

**Użytkownicy i scenariusze:**
- PMO widzi „risk spikes” w Execution Hub i dostaje listę top 5 ryzyk do działania.
- Owner dostaje powiadomienie: „task overdue + brak mitigacji” i ma gotową sugestię działań.
- Sponsor (read‑only) widzi heatmapę i status mitigacji.

**Scope (V2)**
- IN:
  - RAID as canonical register (MUST):
    - wykorzystać istniejący `RaidCanvas` jako centralny rejestr (risk/assumption/issue/dependency),
    - utrzymać workflow statusów (PMBOK) i heatmapę.
  - Risk signaling (MUST):
    - heurystyki wykrywania ryzyk na bazie danych:
      - initiatives/task overdue, SLA breach,
      - blocked state + długość blokady,
      - dependency conflicts (T039),
      - capacity overload (T036),
      - budget conflict / lead‑time risk (T037),
    - AI warstwa: generowanie propozycji ryzyk/mitigacji z explainability (1–3 zdania).
  - Mitigation management (MUST):
    - każde ryzyko ma:
      - mitigation plan (tekst),
      - owner,
      - due date,
      - response strategy (avoid/transfer/mitigate/accept/escalate),
      - status (open → mitigated/accepted/closed; materialized → issue).
    - z propozycji mitigacji można wygenerować:
      - task (do wykonania),
      - decision (wymaga akceptacji),
      - update w RAID (wpis/plan).
  - Proactive alerts (MUST):
    - alerty (notifications) dla:
      - high/critical risks bez ownera,
      - high/critical risks overdue,
      - materialized risks (risk → issue),
      - eskalacje (TBD: progi).
    - anti‑spam: throttling (np. max 1 alert / 24h per item).
  - UI integration (MUST):
    - w Execution module:
      - zakładka/sekcja RAID Log (jeśli istnieje) lub link z Timeline do RAID,
      - “Top risks” strip (liczniki + chips) w execution overview,
      - szybkie filtrowanie do: critical / overdue / unowned.
- OUT:
  - Pełny ERM/GRC enterprise (compliance workflows, audit evidence bundles).
- Future enhancements (post‑V2):
  - Predykcja ryzyk (ML) i scoring prawdopodobieństwa/impact na danych historycznych.
  - Integracje z ticketing/PPM.

**UX / UI notes:**
- Minimal noise: tylko najważniejsze alerty; reszta w dashboardzie.
- Explainability: każdy alert ma “dlaczego” i “co zrobić teraz”.

**Data / integrations:**
- RAID API: istniejące endpointy `raid.routes.ts` (CRUD + summary).
- AI: risk agent (jeśli istnieje) lub pipeline typu structured suggestions.
- Źródła sygnałów: initiatives/tasks/dependencies/capacity/budget.

**Security / compliance:**
- Dostęp do RAID i alertów zgodny z uprawnieniami projektu/org.
- Audit log zmian (owner, status, mitigation).

**Analytics (events/metrics):**
- `risk_signal_detected` (source=heuristic|ai, severity)
- `risk_mitigation_task_created`
- `risk_alert_sent` / `risk_alert_clicked`
- KPI: wcześniejsze wykrycia, mniej “late escalations”, krótszy czas do mitigacji.

**Risks:**
- False alarms → potrzebne progi i możliwość dismiss/feedback.
- Brak danych → AI musi oznaczać unknowns i być conservative.

**Open questions:**
- Jakie progi severity i jakie reguły alertów ustawiamy jako V2 default (PMO vs sponsor)?

**Definition of Done (DoD):**
- Ryzyka są wykrywane i prezentowane w kontekście inicjatyw (RAID + execution views).
- System proponuje realistyczne działania mitigujące i pozwala je śledzić.
- Alerty działają i są throttled (brak spamu).

**Acceptance / test plan:**
- Test: inicjatywa blocked 7 dni + task overdue → pojawia się risk signal + propozycja mitigacji.
- Test: ryzyko high bez ownera → alert do PMO; po przypisaniu ownera alert przestaje się pojawiać.

**Rollout plan:**
- Najpierw heurystyki + view; potem AI proposals i alerting.

---

