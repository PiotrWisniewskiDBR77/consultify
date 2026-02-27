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

**Definition of Done (DoD):**
- Scope V2 pozostaje jawnie odroczony (defer) i nie blokuje R0/R1.
- Istnieje lista P0 integracji do kolejnego etapu (min. 1 backlog item per integracja).
- Dla każdej integracji P0 zdefiniowano minimalny kontrakt: auth model, kierunek sync (import/bidirectional), ownership danych i obsługę konfliktów.
- Wymagania bezpieczeństwa i audytu (token handling + audit trail) są opisane jako warunek wejścia do implementacji.

**Acceptance / test plan:**
- Review checklist: decyzja defer jest odnotowana i zaakceptowana przez ownera programu.
- Review backlogu: co najmniej 3 kandydatów integracji ma opisany minimalny kontrakt.
- Review ryzyk: opisane są przynajmniej 2 scenariusze konfliktu danych i zasada rozstrzygania.

**Rollout plan:**
- Implementacja przeniesiona do post‑V2 jako osobny workstream integracyjny.
- Pierwsze wdrożenia tylko na feature flag i na ograniczonej grupie organizacji.

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

## T041 — 🟡 execution — Delay Detection and Schedule Control (plan vs actual, deviations → alerts)
- Status spec: draft
- Link / ID (ClickUp): TBD
- Epic: (Execution governance / Schedule control) TBD
- Priorytet / V2 scope: V2

**Business challenge (problem):**
Bez wczesnych sygnałów opóźnienia wychodzą za późno i psują timeline oraz zaufanie sponsora. Potrzebujemy stałej kontroli „plan vs wykonanie” dla inicjatyw i tasków, z progami odchyłek i czytelną odpowiedzią: **gdzie jest slip i dlaczego**.

**Cel (outcome, nie feature):**
System:
- automatycznie wykrywa odchylenia (deviations) w inicjatywach i taskach,
- wyzwala alerty wg progów,
- pokazuje listę opóźnień z kontekstem (zależności, blocked, capacity, RAID),
tak aby PMO mogło reagować wcześniej.

**Użytkownicy i scenariusze:**
- PMO: codziennie widzi „delay list” i najważniejsze przyczyny.
- Lider wykonania: dostaje alert „slip risk” 7 dni przed deadline i może skorygować plan.
- Sponsor (read‑only): widzi odchylenia i plan korekty.

**Scope (V2)**
- IN:
  - Plan vs actual comparison (MUST):
    - inicjatywy:
      - plan: `plannedStartDate`, `plannedEndDate`,
      - wykonanie: `execution_started_at` / `start_date` + `end_date` (jeśli istnieją) + status/progress,
    - taski:
      - plan: `due_date` + SLA (`sla_due_at`) + status,
    - definicja odchyłki (deviation):
      - „late start”: start po plannedStart,
      - „late finish risk”: dziś > plannedEnd i status != DONE,
      - „deadline risk”: N dni do plannedEnd, a progress/tempo wskazuje brak domknięcia (heurystycznie).
  - Deviation thresholds (MUST):
    - progi jako konfiguracja (V2 baseline):
      - warning: np. 3 dni slip risk,
      - critical: np. 7+ dni albo overdue,
    - różne progi dla priority (CRITICAL/HIGH/…).
  - Alerts & anti‑spam (MUST):
    - powiadomienia do: owner/PMO/sponsor (wg typu),
    - throttling (np. max 1/24h per initiative/task per deviation type),
    - link do konkretnego widoku (Execution Timeline / Initiative / My Work).
  - “Why slip” context (MUST):
    - dla każdej pozycji delay pokazujemy top‑reasons (max 3):
      - BLOCKED + czas blokady,
      - zależności (predecessor not done / conflict z T039),
      - overload/capacity (T036),
      - RAID high/critical items (T040),
      - brak ownera / brak planu tasks (T033/T032) (jeśli dotyczy).
  - UI integration (MUST):
    - w Execution module: panel/lista opóźnień + filtry (severity, status, owner),
    - w Timeline (T039): wizualne oznaczenie slip/overdue + tooltip „why”.
  - Ops job (MUST):
    - cron job lub scheduled worker, który liczy deviations i zapisuje „delay signals” (TBD storage) + wysyła alerty.
- OUT:
  - pełna predykcja opóźnień (ML) i integracje z zewn. PPM.
- Future enhancements (post‑V2):
  - Predykcja slip na danych historycznych + scenariusze korekty (sprzężenie z T035/T038).
  - Auto‑propose mitigations i resekwencja (z decyzją PMO).

**UX / UI notes:**
- Musi być “quiet but urgent”: mało alertów, wysokiej jakości sygnały.
- Lista opóźnień skanowalna: severity + days + reason chips.

**Data / integrations:**
- Inicjatywy: planned dates, status, progress, dependencies.
- Taski: due_date, SLA, status, assignee/owner.
- Wykorzystać istniejące joby/serwisy (SLA checks, auto‑start job) jako wzorce architektoniczne.

**Security / compliance:**
- Uprawnienia jak do inicjatyw/tasków; sponsor read‑only.

**Analytics (events/metrics):**
- `delay_signal_detected` (entity=initiative|task, severity, days)
- `delay_alert_sent` / `delay_alert_clicked`
- KPI: wcześniejsze wykrycia, redukcja “late escalations”, spadek overdue.

**Risks:**
- Noise (za dużo alertów) → potrzebne progi + throttling + możliwość dismiss.
- Brak danych (progress/estymaty) → heurystyki muszą być conservative i oznaczać unknowns.

**Open questions:**
- Czy deviation signals zapisujemy jako osobną tabelę (history) czy wyliczamy on‑the‑fly w V2?

**Definition of Done (DoD):**
- System wykrywa odchylenia i generuje alerty zgodnie z progami.
- Użytkownik widzi listę opóźnień + kontekst (inicjatywa/task, zależności).

**Acceptance / test plan:**
- Test: inicjatywa plannedEnd wczoraj + status EXECUTING → critical deviation + widoczna w liście.
- Test: throttling — ten sam alert nie wysyła się częściej niż 1/24h.

**Rollout plan:**
- Najpierw view‑only (lista deviations), potem alerty i automation.

---

## T042 — 🟡 execution — Budget Planning and Financial Control (AI‑supported, assumptions vs actual)
- Status spec: draft
- Link / ID (ClickUp): TBD
- Epic: (Finance governance / Execution control) TBD
- Priorytet / V2 scope: V2

**Business challenge (problem):**
Transformacja bez dyscypliny finansowej „rozjeżdża się”: budżety są wpisywane ad‑hoc, a overspending wychodzi dopiero po fakcie. Potrzebujemy jednego, spójnego mechanizmu:
- planowania budżetu (assumptions),
- monitoringu wykonania (actual),
- wczesnych sygnałów overspend risk,
- oraz sensownych korekt (nie tylko ostrzeżenie).

**Cel (outcome, nie feature):**
Finanse/PMO widzą na bieżąco:
- **plan vs actual** per inicjatywa / projekt / organizacja,
- forecast (prosty) do końca okresu,
- sygnały ryzyka przekroczenia,
z możliwością uruchomienia działań korygujących (task/decision) i raportowania sponsorowi.

**Użytkownicy i scenariusze:**
- Finanse: ustawia budżety i progi, przegląda wykonanie i forecast.
- PMO: widzi overspend risk powiązany z timeline i proponowane korekty.
- Sponsor (read‑only): widzi status budżetu i plan działań.

**Scope (V2)**
- IN:
  - Budget planning (MUST):
    - per inicjatywa: plan budżetu jako pozycje (CAPEX/OPEX) z walutą (już istnieje w `ResourcesSection` jako `BudgetItem`),
    - per projekt / user / org: limity budżetowe (wykorzystać istniejące endpointy `budgets.routes.ts` + `budgetManagementService.ts` tam, gdzie pasuje).
  - Actual tracking (V2 baseline = “good enough”):
    - AI spend: koszty tokenów (macie `ai_cost_usage` i monitoring),
    - pozostałe koszty: V2 minimum = manualne wprowadzanie „actual” (TBD model: rozszerzenie `BudgetItem` albo osobna tabela),
    - okres rozliczeniowy: miesięczny + (opcjonalnie) kwartalny.
  - Plan vs actual views (MUST):
    - dashboard per inicjatywa:
      - total planned, total actual, variance, burn rate,
      - CAPEX vs OPEX,
    - dashboard per projekt/portfolio: top overspend risks + największe wariancje.
  - Overspend risk detection (MUST):
    - heurystyki:
      - actual/planned > 80/90/100% (per inicjatywa i per okres),
      - burn rate wskazuje przekroczenie do końca okresu (prosty forecast),
      - duże nowe pozycje budżetowe bez uzasadnienia (TBD),
    - integracja z status reports: `budgetConsumedPercent` + `isOverBudget` (macie już sekcję BUDGET w `StatusReportService`).
  - AI‑supported recommendations (MUST, conservative):
    - rekomendacje korekt w 2–3 opcjach:
      - redukcja/etapowanie scope (linked do decyzji),
      - resekwencja inicjatyw (link do T035/T038),
      - renegocjacja vendorów/licencji (task),
      - ograniczenia AI spend (model/tier policy, limity),
    - explainability: skąd wniosek (dane + założenia).
  - Alerts (MUST):
    - powiadomienia przy progach (80/90/100) + throttling,
    - routing do: finanse/PMO/owner (wg typu budżetu).
- OUT:
  - Pełna księgowość/ERP i automatyczne księgowania.
- Future enhancements (post‑V2):
  - Integracje z ERP/PPM, faktury, cost allocation (chargeback).
  - Earned Value / baseline vs actual na timeline.

**UX / UI notes:**
- Jednoznaczne liczby + trend + „co robić” (actionable, nie tylko czerwony kolor).
- Spójne z Execution Hub: obok delay/risk ma być budget signal (ale bez spamu).

**Data / integrations:**
- `ResourcesSection` (`BudgetItem`) jako źródło planu per inicjatywa.
- AI usage: `AICostMonitoringService` / `ai_cost_usage` + istniejące alerty kosztowe.
- Backend: `budgets.routes.ts` / `budgetManagementService.ts` jako baza pod limity i alerting.

**Security / compliance:**
- Edycja budżetów: ADMIN/OWNER/Finance role (TBD mapping w RBAC).
- Sponsor read‑only.
- Audit log zmian planu budżetu i progów alertów.

**Analytics (events/metrics):**
- `budget_plan_updated` / `budget_actual_updated`
- `budget_overspend_signal_detected`
- `budget_recommendation_applied` (type)
- KPI: mniej overruns, szybsza reakcja, większa przewidywalność.

**Risks:**
- Źródła actual są niekompletne (na start manual) → komunikacja w UI: “coverage”.
- Niska wiarygodność AI rekomendacji → w V2 tylko conservative i explainable.

**Open questions:**
- Jak modelujemy „actual” kosztów poza AI: rozszerzenie `BudgetItem` czy osobna tabela historii?
- Czy default waluta jest per org, czy per initiative (dziś `BudgetItem` ma `currency`)?

**Definition of Done (DoD):**
- Budżet jest planowany i porównywalny z wykonaniem (per inicjatywa/projekt/org).
- System sygnalizuje overspending risk i proponuje działania (np. przesunięcia, resekwencja).

**Acceptance / test plan:**
- Test: planned 100k, actual 95k → AMBER + alert wg progów; po przekroczeniu 100k → RED + escalation.
- Test: AI spend rośnie szybciej niż plan → overspend risk + rekomendacja ograniczeń.

**Rollout plan:**
- Najpierw initiative‑level (plan + manual actual + signals), potem portfolio dashboard i AI rekomendacje.

---

## T043 — 🟡 execution — Human Resource Management and Capability Alignment (kompetencje → wymagania → assignment)
- Status spec: draft
- Link / ID (ClickUp): TBD
- Epic: (People / Delivery enablement) TBD
- Priorytet / V2 scope: V2

**Business challenge (problem):**
Delivery cierpi, gdy:
- role są przypisywane „na oko”,
- brakuje dopasowania kompetencyjnego do zadań,
- a luki kompetencyjne wychodzą dopiero po reworku i opóźnieniach.
Potrzebujemy struktury: **kto umie co** + **czego wymaga praca** + **jak domykamy luki**.

**Cel (outcome, nie feature):**
System pokazuje dopasowanie kompetencji do tasków/inicjatyw, wspiera przypisywanie ról (manual + AI sugestie) oraz ujawnia luki kompetencyjne z planem ich domknięcia (szkolenie, vendor, re‑scope).

**Użytkownicy i scenariusze:**
- Lider/PMO: widzi „capability fit” portfela i ryzyka kompetencyjne.
- HR/People Ops: utrzymuje katalog kompetencji i poziomy, wspiera plan szkoleń.
- Owner inicjatywy: wybiera zasoby z listy rekomendacji i uzasadnieniem.

**Scope (V2)**
- IN:
  - Capability model (MUST):
    - katalog kompetencji (taxonomia) + poziomy (np. 1–5) + tagi (domain/tech/soft),
    - profil użytkownika: kompetencje + poziom + (opcjonalnie) certyfikaty/notes,
    - wymagania:
      - per task: wymagane kompetencje + min level,
      - per initiative: agregacja wymagań (z tasków + manual add).
  - Matching & gap analysis (MUST):
    - match score dla task/initiative ↔ user/team,
    - gap view: braki kompetencji (krytyczne / nice‑to‑have),
    - rekomendacje „how to fill gap”:
      - przypisanie innej osoby,
      - szkolenie/certyfikacja,
      - vendor/consultant,
      - rozbicie taska / zmiana scope (decision).
  - UI integration (MUST):
    - w My Work / Execution / People:
      - widok zespołu + capability matrix (minimalny, skanowalny),
      - widok taska z wymaganiami + sugestie kandydatów,
    - w `ResourcesSection` (FTE):
      - opcjonalny link “capability fit” dla przypisanych osób (V2 baseline może być read‑only badge).
  - Assignment support (MUST, manual approval):
    - AI może proponować przypisania, ale nigdy nie przypisuje automatycznie,
    - zapis decyzji/uzasadnienia (audit trail) przy przypisaniu w krytycznych taskach (TBD).
- OUT:
  - Pełny HRIS / performance management / oceny okresowe.
- Future enhancements (post‑V2):
  - Integracje z HRIS (CV, stanowiska, ścieżki kompetencji).
  - Predictive skill demand i hiring plan (sprzężenie z T036).

**UX / UI notes:**
- Minimal friction: szybkie tagowanie kompetencji (autocomplete) zamiast rozbudowanych formularzy.
- Explainability dla sugestii: “wybrano, bo … (skills match + availability)”.

**Data / integrations:**
- Taski/inicjatywy: wymagania kompetencji (nowe pola / nowe tabele) (TBD).
- Workload/capacity: wykorzystać istniejące dane (T036) jako constraint (availability).

**Security / compliance:**
- Kompetencje użytkownika mogą być wrażliwe → widoczność kontrolowana (org‑only, ograniczenie dla sponsorów).

**Analytics (events/metrics):**
- `capability_profile_updated`
- `capability_match_viewed`
- `capability_assignment_suggestion_generated` / `capability_assignment_applied`
- KPI: mniej reworku, lepsza terminowość, krótszy lead time do assignment.

**Risks:**
- Niekompletne dane kompetencji → V2 musi działać przy częściowych danych (“unknown” zamiast fałszywej pewności).
- Akceptacja w organizacji: obawa przed „ocenianiem” → framing jako „fit do pracy”, nie performance.

**Open questions:**
- Jaka taxonomia kompetencji jest default w V2 (globalna vs per org)? (propozycja: global seed + per‑org custom).

**Definition of Done (DoD):**
- System pokazuje dopasowanie kompetencji do zadań i wspiera assignment.
- Widoczne luki kompetencyjne i rekomendacje ich domknięcia.

**Acceptance / test plan:**
- Test: task z wymaganiami (2 skills) → lista 5 kandydatów posortowana po match score + availability.
- Test: brak danych skills → UI pokazuje “unknown coverage” i nie generuje fałszywych rekomendacji.

**Rollout plan:**
- Najpierw manual capability profiles + requirements na kluczowych taskach; potem AI sugestie i gap automation.

---

## T044 — 🟡 execution — Change Emotion and Sentiment Management (privacy‑first, odporność na bias)
- Status spec: draft
- Link / ID (ClickUp): TBD
- Epic: (Change management / Early warning) TBD
- Priorytet / V2 scope: V2

**Business challenge (problem):**
Human side of change jest kluczowy. Bez wczesnych sygnałów spada engagement, rośnie opór i delivery „nagle” się psuje. Jednocześnie temat jest wrażliwy: ryzyko naruszeń prywatności, biasu i błędnej interpretacji.

**Cel (outcome, nie feature):**
W V2 chcemy mieć **bezpieczny (privacy‑first) system sygnałów** o nastroju i oporze w kontekście inicjatyw/projektów:
- zbieramy lekkie, jawne sygnały (pulse / feedback / check‑ins),
- agregujemy trendy i ryzyka (nie “monitorujemy ludzi”),
- proponujemy reakcje change‑management (coach actions).

**Użytkownicy i scenariusze:**
- Change manager/PMO: widzi spadek trendu w 2 tygodnie i odpala plan działań.
- Lider: dostaje alert „resistance risk rising” + 3 propozycje reakcji.
- Sponsor (read‑only): widzi agregaty i plan komunikacji (bez danych jednostkowych).

**Scope (V2)**
- IN:
  - Signal capture (MUST, explicit):
    - pulse check‑ins (1–3 pytania, skala + opcjonalny komentarz),
    - feedback otwarty (anonimowy / jawny — zależnie od polityki org),
    - możliwość przypięcia sygnału do inicjatywy/projektu (metadata),
    - cadence (np. tygodniowo / co 2 tygodnie) (TBD scheduler).
    - Wykorzystać istniejące mechanizmy feedback tam, gdzie możliwe (np. `feedback.routes.ts` + `feedbackAIService.ts`) — ale rozszerzyć o kontekst change (initiativeId/projectId).
  - Privacy & governance (MUST):
    - brak analizy prywatnych komunikatorów bez zgód,
    - agregacja z progami anonimowości (np. nie pokazuj wyników jeśli < N odpowiedzi),
    - możliwość wyłączenia modułu per org + polityki anonimizacji,
    - retention: sygnały nie powinny żyć wiecznie (TBD).
  - Sentiment & resistance analysis (MUST, conservative):
    - trend (improving/stable/declining),
    - top concerns (tematy) + przykłady z komentarzy (tylko gdy spełnione progi anonimizacji),
    - AI wspiera streszczenia i tematykę, ale:
      - oznacza niepewność,
      - nie wyciąga wniosków o konkretnych osobach.
  - Actionable recommendations (MUST):
    - biblioteka reakcji (coaching actions) powiązana z sygnałami:
      - komunikacja (częstotliwość/format),
      - warsztaty, Q&A, training,
      - wzmocnienie sponsor support,
      - usunięcie pain points (task/decision).
    - możliwość utworzenia taska/decision bezpośrednio z rekomendacji.
  - Dashboards & alerts (MUST):
    - widok per initiative/project:
      - wskaźnik nastroju (trend),
      - ryzyka oporu (chips),
      - top themes,
    - alerty z throttlingiem (np. trend spadkowy 2 okresy z rzędu).
- OUT:
  - Zaawansowane psychometry, profilowanie osób, “employee monitoring”.
- Future enhancements (post‑V2):
  - Integracje kanałów (Teams/Slack) wyłącznie jako opt‑in surveys (nie scraping).
  - Modele predykcyjne rotacji/attrition (tylko jeśli organizacja tego chce i prawnie może).

**UX / UI notes:**
- Język UI musi być “change‑friendly”: nie “monitorujemy ludzi”, tylko “zbieramy sygnały”.
- Sponsor view: tylko agregaty i actions, zero danych jednostkowych.

**Data / integrations:**
- Backend: rozszerzenie feedback/pulse o `initiativeId`/`projectId` + summary endpoints.
- AI: reuse `feedbackAIService` patterns (sentiment, trending, summary) z dodatkowymi guardrails.
- Notifications: reuse `NotificationService` (alerty).

**Security / compliance:**
- Zgodność z prywatnością: opt‑in, role‑based access, anonimizacja progowa.
- Audit log zmian polityk (anonimowość, retention, module enabled).

**Analytics (events/metrics):**
- `change_pulse_submitted` (anonymous=true|false, scope=initiative|project)
- `change_sentiment_trend_changed`
- `change_resistance_alert_sent` / `clicked`
- KPI: wcześniejsze wykrycia oporu, lepsza retencja zaangażowania, mniej “surprise delays”.

**Risks:**
- Prywatność/bias → w V2 mocne guardrails i conservative AI.
- Low response rate → potrzebne nudges i prosta forma (1–2 kliknięcia).

**Open questions:**
- Jakie są domyślne progi anonimizacji (N) i retention dla danych pulse?

**Definition of Done (DoD):**
- System pokazuje wskaźniki/alerty sentimentu i sugeruje reakcje.
- Zgodność z prywatnością i zasadami organizacji (anonimizacja + role).

**Acceptance / test plan:**
- Test: 20 pulse odpowiedzi → trend + top themes; przy < N brak szczegółów.
- Test: spadek trendu 2 tygodnie → alert do PMO z rekomendacjami.

**Rollout plan:**
- Najpierw pilot na 1–2 inicjatywach (PMO), potem rollout org‑wide.

---

## T045 — 🟡 execution — Stakeholder Communication and Change Communication Management (cadence + segmenty + log)
- Status spec: draft
- Link / ID (ClickUp): TBD
- Epic: (Change management / Communication governance) TBD
- Priorytet / V2 scope: V2

**Business challenge (problem):**
Zmiana wymaga rytmu i jakości komunikacji. Bez stałej, spójnej komunikacji do stakeholderów rośnie opór, chaos informacyjny i „plotki zamiast faktów”. Potrzebujemy narzędzia, które narzuca prostą dyscyplinę: **kto**, **co**, **kiedy**, **jakim kanałem** + potwierdzenie wykonania.

**Cel (outcome, nie feature):**
Dla inicjatyw można zdefiniować plan komunikacji i go egzekwować:
- segmenty odbiorców,
- cadence i typy komunikatów,
- spójne szablony,
- log wysyłek i follow‑ups,
tak aby sponsor i PMO mieli transparentny „communication runway”.

**Użytkownicy i scenariusze:**
- Change manager: tworzy plan komunikacji i wysyła komunikaty wg kalendarza.
- PMO: widzi zaległe komunikaty i ryzyko „silence gaps”.
- Sponsor: zatwierdza kluczowe komunikaty (opcjonalnie) i widzi historię.

**Scope (V2)**
- IN:
  - Stakeholder model (V2 baseline):
    - segmenty (np. frontline, middle management, union, IT, finance, leadership),
    - członkostwo segmentu:
      - wewnętrzni: org users / project members,
      - zewnętrzni: lista email (opcjonalnie, z opt‑in),
    - przypisanie segmentów do inicjatywy/projektu.
  - Communication plan (MUST):
    - plan per initiative:
      - cadence (weekly/biweekly/monthly) + wyjątki,
      - typy komunikatów (update, decyzja, FAQ, success story, risk notice),
      - owner komunikacji,
    - checklist egzekucji: “scheduled → sent → acknowledged (TBD)”.
  - Content & templates (MUST):
    - szablony (krótkie, skanowalne) z polami:
      - cel komunikatu, co się zmienia, impact, co dalej, gdzie pytać,
    - AI assist (opcjonalnie w V2):
      - dopasowanie tonu do segmentu,
      - skracanie/porządkowanie,
      - “3 bullet summary” dla sponsora,
      - guardrails: brak wrażliwych danych.
  - Sending & log (MUST):
    - kanały V2:
      - in‑app notifications (pewne),
      - email (jeśli macie skonfigurowane; inaczej „export + manual send”),
    - log komunikatów:
      - kiedy wysłano, do jakich segmentów, kto zatwierdził (jeśli włączone),
      - follow‑up tasks (np. Q&A meeting).
  - Alerts (MUST):
    - przypomnienia o zaległych komunikatach wg cadence,
    - throttling + możliwość snooze.
- OUT:
  - Pełny marketing automation (kampanie, A/B, journeys, scoring).
- Future enhancements (post‑V2):
  - Tracking delivery/open/click (po integracji z providerem email).
  - Integracje kanałów (Teams/Slack) jako wysyłka (nie scraping).
  - “Stakeholder map” (power/interest) + dynamiczne plany komunikacji.

**UX / UI notes:**
- Plan musi być ultra‑prosty: 1 ekran “cadence + next comm + backlog”.
- Dla sponsora: widok “what was communicated” + “what’s next”.

**Data / integrations:**
- Notifications: wykorzystać `notificationService` / istniejące eventy.
- Email: wykorzystać `emailService` / `AlertEmailService` jeśli dostępne.
- AI: można wykorzystać istniejące wzorce refine/summarize (jak w feedbackAI / refine-text).

**Security / compliance:**
- RBAC: edycja planu i wysyłki tylko dla ról change/PMO; sponsor zatwierdza (jeśli włączone).
- Audit log: edycje planu + wysyłki.

**Analytics (events/metrics):**
- `change_comm_plan_created` / `updated`
- `change_comm_sent` (channel, segmentsCount)
- `change_comm_overdue_detected`
- KPI: terminowość komunikacji, spadek „silence gaps”, feedback quality.

**Risks:**
- Brak dobrego modelu stakeholderów → V2 musi zacząć od segmentów + prostej listy.
- Integracje kanałów mogą być trudne → V2 zapewnia przynajmniej in‑app + export.

**Open questions:**
- Czy w V2 sponsor approval jest wymagany dla wybranych typów komunikatów, czy opcjonalny toggle per org?

**Definition of Done (DoD):**
- Dla inicjatyw można zdefiniować plan komunikacji i go egzekwować (cadence + log).
- System wspiera spójność treści i terminy (reminders/alerts).

**Acceptance / test plan:**
- Test: plan weekly → system generuje “next comm due” i przypomnienie po przekroczeniu.
- Test: wysyłka do segmentu → wpis w logu + link do treści.

**Rollout plan:**
- Najpierw in‑app + log, potem email i AI assist.

---

## T046 — 🟡 execution — Initiative ROI Tracking and Validation (assumptions → tracking → realized vs projected)
- Status spec: draft
- Link / ID (ClickUp): TBD
- Epic: (Benefits realization / Accountability) TBD
- Priorytet / V2 scope: V2

**Business challenge (problem):**
Bez walidacji wpływu transformacji nie ma accountability. ROI często jest deklaracją na starcie, a potem nikt nie wraca do porównania “projected vs realized”. Dla sponsora to kluczowe: które inicjatywy robią wynik, a które trzeba zatrzymać lub skorygować.

**Cel (outcome, nie feature):**
ROI inicjatyw jest policzalne na bazie założeń i widoczne w czasie, a system pokazuje różnicę między planem a wynikiem (tam gdzie mamy dane realized), z jasnymi założeniami i poziomem niepewności.

**Użytkownicy i scenariusze:**
- Sponsor: widzi ROI i confidence + decyzja “continue/stop/scale”.
- Finanse/PMO: utrzymuje założenia i śledzi realized.
- Owner: aktualizuje postęp i evidence (TBD).

**Scope (V2)**
- IN:
  - ROI assumptions model (MUST):
    - per initiative: CAPEX/OPEX, expected ROI/NPV/payback + horyzont,
    - założenia: jakie KPI/financial drivers, baseline, expected delta, start date efektu,
    - owner założeń + last updated.
    - Wykorzystać istniejące pola/UI tam gdzie już są (np. `FinancialAnalysisSection` pokazuje CAPEX/OPEX/ROI/NPV/payback).
  - Realized tracking (V2 baseline):
    - realized = z KPI tracking (T047) + manual overrides (jeśli brak danych),
    - oś czasu: miesięczna (minimum).
  - Projected vs realized comparison (MUST):
    - variance (wartość i %),
    - explainability: “dlaczego różnica” (manual notes + opcjonalnie AI summary),
    - gating: po statusie DONE/TRACKING inicjatywa przechodzi do “benefits tracking” (TBD).
  - Reporting (MUST):
    - sponsor‑ready widok ROI per initiative + portfolio summary,
    - eksport do raportów/presentacji (T027).
- OUT:
  - Pełna controllingowa księgowość w ERP, automatyczne księgowania.
- Future enhancements (post‑V2):
  - Advanced attribution (T048) i scenariusze “what‑if” na ROI.
  - Integracje danych realized z systemów źródłowych.

**UX / UI notes:**
- ROI musi być “decision‑grade”: liczby + założenia + confidence, bez marketingu.
- Pokazuj coverage danych: co jest policzone z danych, a co manual.

**Data / integrations:**
- Initiative financial fields + KPI mapping (T047).
- Integracja z Budżetami (T042) dla spójności kosztów.

**Security / compliance:**
- Edycja założeń ROI: ograniczona (finance/PMO/owner); sponsor read‑only.
- Audit log zmian założeń (dla zaufania).

**Analytics (events/metrics):**
- `roi_assumptions_updated`
- `roi_realized_value_updated`
- `roi_variance_viewed`
- KPI: % inicjatyw z ROI assumptions + % z realized tracking.

**Risks:**
- Realized data unavailable → V2 musi działać na manual + jasno oznaczać ograniczenia.
- Atrybucja wpływu może być myląca → w V2 “honest uncertainty”.

**Open questions:**
- Jaki jest minimalny zestaw pól ROI, żeby nie przeciążyć użytkownika (przy zachowaniu decision‑grade)?

**Definition of Done (DoD):**
- ROI jest policzalne na bazie założeń i widoczne w czasie.
- System pokazuje różnicę między planem a wynikiem (jeśli dane dostępne).

**Acceptance / test plan:**
- Test: inicjatywa z KPI baseline/target → system liczy projected i pokazuje realized po aktualizacji KPI.
- Test: zmiana założeń → audit log + przeliczenie widoków.

**Rollout plan:**
- Najpierw assumptions + widok, potem realized tracking i variance.

---

## T047 — 🟡 execution — Initiative‑to‑KPI Mapping and Performance Tracking (KPI ↔ initiatives, time series)
- Status spec: draft
- Link / ID (ClickUp): TBD
- Epic: (Benefits / KPI discipline) TBD
- Priorytet / V2 scope: V2

**Business challenge (problem):**
Bez mapowania inicjatywa → KPI nie ma accountability; trudno powiedzieć co „dowiozło wynik”. KPI bez inicjatyw jest “dashboard vanity”. Potrzebujemy powiązania i trackingu w czasie w kontekście delivery.

**Cel (outcome, nie feature):**
Inicjatywy mają przypisane KPI i widoczny tracking, a UI pozwala przejść:
- od inicjatywy do KPI (baseline/target/latest/trend),
- od KPI do listy inicjatyw, które na niego wpływają.

**Użytkownicy i scenariusze:**
- PMO: podczas przeglądu portfela widzi KPI health i mapę wpływu.
- Sponsor: widzi “KPI at risk” i które inicjatywy są odpowiedzialne.
- Analityk: aktualizuje wartości KPI i źródła.

**Scope (V2)**
- IN:
  - KPI model (MUST):
    - definicja KPI: nazwa, opis, unit, baseline, target, frequency, dataSource, owner (UI już istnieje w `KPICreateModal`),
    - latestValue + historia wartości (time series) (TBD storage),
    - status “on target / below target” z jasną regułą.
  - Initiative ↔ KPI mapping (MUST):
    - wiele KPI na inicjatywę,
    - (opcjonalnie) waga wpływu / typ wpływu (increase/decrease) (TBD),
    - nawigacja w obie strony.
  - Tracking workflow (MUST):
    - update KPI values wg częstotliwości (manual w V2),
    - reminders dla ownera KPI (opcjonalnie),
    - widoki: sparklines/trend + “last updated”.
  - UI (MUST):
    - Benefits module (`BenefitsHub`) jako centralny hub KPI/ROI,
    - widok inicjatywy: sekcja KPI (list + trend) + link do Benefits.
- OUT:
  - Zaawansowane causal inference i automatyczne pobieranie z systemów źródłowych (integracje).
- Future enhancements (post‑V2):
  - Automatyczne zasilanie KPI z integracji danych.
  - Attribution model (T048) i scenariusze (T038) wprost na KPI.

**UX / UI notes:**
- Minimal friction update: 1 pole “latest value” + auto wyliczenie on‑target.
- “Data freshness” badge: ile dni od ostatniej aktualizacji.

**Data / integrations:**
- Backend endpoints już istnieją (np. `POST /initiatives/:id/kpis`, `GET /initiatives/:id/kpis` używane w `BenefitsHub`).
- Dołożyć historyczne wartości KPI (time series) i query dla KPI‑centric view (TBD).

**Security / compliance:**
- Edycja KPI: owner/PMO/analyst role (TBD).
- Sponsor read‑only.

**Analytics (events/metrics):**
- `kpi_created` / `kpi_value_updated`
- `kpi_mapping_updated`
- `kpi_viewed`
- KPI: % inicjatyw z KPI mapping + “freshness” KPI.

**Risks:**
- Definicje KPI i częstotliwość aktualizacji → ryzyko chaosu, potrzebne standardy (naming, ownership).

**Open questions:**
- Czy KPI są globalne (org‑level) i linkowane do inicjatyw, czy KPI są per initiative (dziś wygląda na per initiative)? (propozycja V2: wspieramy oba, z prostą migracją).

**Definition of Done (DoD):**
- Inicjatywy mają przypisane KPI i widoczny tracking.
- UI pozwala przejść od KPI do listy inicjatyw i odwrotnie.

**Acceptance / test plan:**
- Test: KPI utworzone + 3 aktualizacje wartości → sparkline i trend.
- Test: KPI view → lista inicjatyw powiązanych; initiative view → lista KPI.

**Rollout plan:**
- Najpierw KPI per initiative + latest value, potem time series i KPI‑centric dashboards.

---

## T048 — 🟠 benefits — KPI Impact Attribution Analysis (contribution estimate + uncertainty, sponsor‑grade)
- Status spec: draft
- Link / ID (ClickUp): TBD
- Epic: (Benefits analytics / “who drives the result”) TBD
- Priorytet / V2 scope: V2

**Business challenge (problem):**
Sponsor i PMO muszą umieć odpowiedzieć: **“kto robi wynik”** — nawet jeśli atrybucja nie jest idealna. Bez ustrukturyzowanej estymacji wkładu inicjatyw do KPI:
- decyzje “continue/stop/scale” są polityczne,
- a portfolio nie uczy się na danych.
Jednocześnie musimy być uczciwi: w V2 to ma być **przybliżenie z niepewnością**, nie twardy model kauzalny.

**Cel (outcome, nie feature):**
System generuje sponsor‑ready **estymację wkładu inicjatyw do KPI** (contribution), pokazuje:
- ranking inicjatyw per KPI,
- “unexplained remainder” (czynnik zewnętrzny / brak danych),
- confidence + założenia,
oraz pozwala użyć tego w raportach (T027) i w ROI tracking (T046).

**Użytkownicy i scenariusze:**
- Sponsor: widzi KPI trend + top 5 “contributors” i podejmuje decyzję portfelową.
- PMO/analityk: weryfikuje założenia, poprawia mapping/weights i opisuje kontekst.
- Owner: dodaje evidence/notes, gdy wynik odbiega od projekcji.

**Scope (V2)**
- IN:
  - Attribution model (V2 = heurystyki + explainability) (MUST):
    - wejścia:
      - KPI time series + freshness (T047),
      - KPI ↔ initiative mapping (T047) (+ opcjonalna waga wpływu),
      - initiative timeline/status/progress (T039/T041),
      - ROI/assumptions drivers (T046),
    - wyjścia per KPI i okres (np. miesiąc):
      - lista inicjatyw z `contributionEstimate` (np. % lub wartość w unit KPI),
      - `confidence` (low/med/high) + `confidenceReason`,
      - “unexplained remainder” (część zmiany KPI nieprzypisana),
      - `assumptions` (tekst + parametry: lag window, weights).
    - algorytm (V2 baseline):
      - rozkłada obserwowaną zmianę KPI (\(\Delta KPI\)) na inicjatywy proporcjonalnie do:
        - mapping weight (jeśli jest),
        - expected delta / impact statement (jeśli jest),
        - progress + status (executing/tracking/done),
        - time window / lag (efekt nie zawsze “od razu”),
      - normalizacja + remainder jeśli brak danych/niska jakość.
    - MUST: język i UI nie mogą sugerować “dowodu kauzalności”.
  - Uncertainty & guardrails (MUST):
    - zawsze pokazuj:
      - quality signals: freshness KPI, coverage mapping, “unknowns”,
      - disclaimer: “contribution estimate”,
    - “confidence” spada gdy:
      - brak historii KPI,
      - brak mapping weights / brak assumptions,
      - wiele inicjatyw nakłada się w czasie,
      - duża wariancja danych KPI.
  - Explainability (MUST):
    - dla każdej estymacji: 1–3 zdania “dlaczego system tak uważa” + lista użytych sygnałów.
    - AI może streszczać i układać narrację, ale parametry i liczby muszą być deterministyczne/odtwarzalne.
  - UI (MUST):
    - w Benefits/KPI view:
      - “Attribution” panel: trend KPI + contributors + remainder + confidence,
      - drill‑down: inicjatywa → uzasadnienie wkładu + link do inicjatywy/ROI,
    - w portfolio:
      - KPI “at risk” → contributors i rekomendacje korekt (link do T035/T038).
  - Export / reporting (MUST):
    - sponsor‑ready sekcja do reportów (T027):
      - 1 slajd “KPI drivers” + confidence + assumptions.
- OUT:
  - Twardy causal model z eksperymentami (A/B), pełna statystyka ekonometryczna jako “prawda”.
- Future enhancements (post‑V2):
  - Modele statystyczne (regression / Bayesian) + obsługa seasonality i confounders.
  - Integracje danych zewnętrznych (rynek, ceny, wolumen) jako “external factors”.
  - Scenario simulation: jak zmiana inicjatyw wpływa na KPI (tight loop z T038).

**UX / UI notes:**
- “Decision grade”: pokaż ranking + remainder + confidence, nie wykresy dla wykresów.
- “Unexplained remainder” ma być normalne i akceptowalne (to buduje zaufanie).

**Data / integrations:**
- KPI: potrzebna historia wartości (time series) + metadata o częstotliwości.
- Mapping: preferowane wagi wpływu (opcjonalne w V2, ale zalecane).
- Uwaga naming: istnieje `attributionService.ts` (marketing/acquisition) — KPI attribution musi mieć inne nazewnictwo (np. `kpiAttributionService`).

**Security / compliance:**
- Sponsor read‑only; edycja założeń/weights tylko dla uprawnionych (PMO/finance/analyst).
- Audit trail zmian assumptions/weights (żeby wynik był “reproducible”).

**Analytics (events/metrics):**
- `kpi_attribution_viewed`
- `kpi_attribution_parameters_updated` (lagWindow, weights)
- `kpi_attribution_exported`
- KPI: użycie w raportach sponsor-level, feedback sponsorów.

**Risks:**
- Ryzyko błędnych wniosków → guardrails + remainder + confidence muszą być zawsze widoczne.
- Brak danych → model musi degradować do “low confidence” zamiast wymyślać.

**Open questions:**
- Jaki default lag window przyjmujemy w V2 (np. 0–30 dni) i czy jest per KPI/per initiative?

**Definition of Done (DoD):**
- System potrafi wygenerować estymację atrybucji (contribution) i wyjaśnić założenia.
- Wyniki da się użyć w raportach sponsor-level (T027) i w ROI tracking (T046).

**Acceptance / test plan:**
- Test: KPI ma 6 miesięcy historii + 3 inicjatywy z mapping weights → panel pokazuje contributors + remainder + confidence.
- Test: brak historii KPI → wynik “low confidence” + remainder ~100% + jasne powody.

**Rollout plan:**
- Najpierw proste heurystyki + widok, potem parametryzacja (weights/lag) i eksport do reportów.

---

## T049 — 🟠 benefits — KPI to Financial Statement Mapping (KPI ↔ BS/P&L/CF, transparent & editable)
- Status spec: draft
- Link / ID (ClickUp): TBD
- Epic: (Finance grounding for KPI/ROI) TBD
- Priorytet / V2 scope: V2

**Business challenge (problem):**
KPI bez “uziemienia” finansowego często nie przekładają się na decyzje sponsora. Potrzebujemy mechanizmu, który łączy:
- KPI (operacyjne/strategiczne),
- z pozycjami sprawozdań (P&L / Balance Sheet / Cash Flow),
żeby móc mówić: “zmiana KPI → co to znaczy dla wyniku i gotówki”.

**Cel (outcome, nie feature):**
Finanse i sponsor mogą:
- powiązać KPI z liniami BS/P&L/CF,
- zobaczyć wpływ (impact) zmian KPI na wynik finansowy (w granicach założeń),
- utrzymać mapowanie jako **transparentne i edytowalne** (różne branże = różne relacje),
oraz użyć tego w raportach i ROI.

**Użytkownicy i scenariusze:**
- Finanse/Strategy: tworzy mapowanie KPI → statement line i ustala formuły.
- Sponsor: widzi “KPI drivers → financial impact” na 1 ekranie/1 slajdzie.
- PMO: używa mapowania do lepszego ROI (T046) i priorytetyzacji portfela (T038).

**Scope (V2)**
- IN:
  - Canonical statement lines registry (V2 baseline) (MUST):
    - zdefiniować minimalny, standardowy katalog linii:
      - P&L: Revenue, COGS, Gross Margin, SG&A/OPEX, EBITDA (TBD minimal),
      - Balance Sheet: Inventory, AR/AP, Working Capital,
      - Cash Flow: Operating CF, Capex, Free Cash Flow (TBD),
    - możliwość rozszerzenia per org (custom lines) (optional in V2; baseline = system + notes).
  - KPI → statement mapping (MUST):
    - mapowanie:
      - KPI (z T047) → statement line,
      - direction (increase KPI improves/worsens line),
      - transformation / formula (V2 minimal = typ relacji + parametry),
      - assumptions text + owner,
    - przykłady relacji (template‑based, edytowalne):
      - productivity/OEE → COGS / Gross Margin,
      - lead time → Inventory / Working Capital,
      - scrap rate → COGS,
      - NPS → Revenue (lagged, low confidence),
    - MUST: pokazywać “confidence” i ograniczenia, bo relacje są przybliżone.
  - Financial impact view (MUST):
    - na KPI screen:
      - “Financial impact mapping” (line item + direction + params),
      - aktualny wpływ na bazie \(\Delta KPI\) (jeśli jest time series) + assumptions,
    - na sponsor dashboard/report:
      - 1–2 tabele: KPI → line items → estimated impact range.
  - Integration with ROI & reports (MUST):
    - ROI (T046): możliwość użycia mappingu jako “driver” w kalkulacjach/uzasadnieniu,
    - raporty/presentacje (T027): sekcja “KPI → Financial statement impact”.
- OUT:
  - Pełna symulacja finansowa enterprise (wiele lat, pełne zależności, automatyczny forecasting klasy ERP).
- Future enhancements (post‑V2):
  - Mapowanie dynamiczne (industry packs) + benchmarking.
  - Tight integration z T050 (standaryzowane sprawozdania → automatyczne wyliczenia).
  - Sensitivity analysis per KPI → line item (zakresy, scenariusze).

**UX / UI notes:**
- Mapowanie musi być “auditable”: user widzi formułę/parametry i może je edytować.
- Default: pokaż minimalną liczbę linii statement, ale pozwól drill‑down.

**Data / integrations:**
- KPI: definicja + time series (T047).
- Financial model: na start wystarczy registry “line items” + mapping definitions; później T050 zasili realnymi statementami.
- UI: można wykorzystać istniejące “economics” komponenty (cashflow/financial analysis) jako inspirację, ale mapping jest osobną warstwą.

**Security / compliance:**
- Edycja mappingu: finanse/strategy/PMO; sponsor read‑only.
- Audit log zmian mappingu (kto i kiedy zmienił parametry).

**Analytics (events/metrics):**
- `kpi_financial_mapping_created` / `updated`
- `kpi_financial_impact_viewed`
- KPI: użycie w ROI/raportach, adoption w finansach.

**Risks:**
- Różnice branżowe i standardy księgowe → w V2 stawiamy na transparentność i edytowalność, nie “one true model”.
- Ryzyko nadużycia liczb → zawsze pokazuj assumptions + confidence.

**Open questions:**
- Jak minimalny ma być katalog statement lines w V2, żeby był uniwersalny, ale użyteczny?

**Definition of Done (DoD):**
- KPI można powiązać z pozycjami finansowymi i zobaczyć relacje/impact.
- Mapowanie jest transparentne i edytowalne (z audit trail).

**Acceptance / test plan:**
- Test: KPI “scrap rate” mapped → COGS; zmiana KPI w czasie → impact view pokazuje kierunek i estymację.
- Test: mapping edytowany → audit log + re‑calc widoków.

**Rollout plan:**
- Najpierw templates + manual mapping, potem integracja z T050 i bardziej zaawansowane formuły.

---

## T050 — 🟣 finance — Automated Financial Statement Ingestion and Standardization (PDF → BS/P&L/CF model)
- Status spec: draft
- Link / ID (ClickUp): TBD
- Epic: (Finance data foundation) TBD
- Priorytet / V2 scope: V2

**Business challenge (problem):**
Bez standaryzacji sprawozdań finansowych praca finansowa jest ręczna i nieporównywalna (różne kraje, języki, formaty). To blokuje:
- analizy finansowe,
- mapowanie KPI → wynik (T049),
- lepsze ROI i controlling.
Potrzebujemy mechanizmu “upload → ustrukturyzuj → zweryfikuj → użyj w analizach”.

**Cel (outcome, nie feature):**
Użytkownik może wgrać sprawozdania finansowe (PDF) i otrzymać ustrukturyzowane dane w kanonicznym modelu:
- Balance Sheet (BS),
- Profit & Loss (P&L),
- Cash Flow (CF),
z możliwością korekty/mapowania i z informacją o confidence/provenance.

**Użytkownicy i scenariusze:**
- Finanse/analityk: importuje PDF roczny/kwartalny, mapuje linie, zapisuje do modelu.
- Konsultant: używa danych do rekomendacji i narracji w raporcie.
- Sponsor (read‑only): widzi wyniki analiz, nie musi dotykać importu.

**Scope (V2)**
- IN:
  - Import wizard (MUST):
    - UI w stylu istniejących wizardów (`PDFImportWizard`, `ExcelImportWizard`):
      - upload PDF (limit, walidacje),
      - auto-detekcja: typ dokumentu (BS/P&L/CF) + okres (rok/kwartał) + waluta + skala (tys./mln),
      - extraction preview: tabela linii z kwotami + confidence,
      - mapping & corrections: użytkownik mapuje wykryte linie do kanonicznych “statement lines”,
      - confirm & save.
  - OCR/parsing pipeline (MUST):
    - ekstrakcja tabel (tekst + liczby) z PDF:
      - prefer: embedded text extraction,
      - fallback: OCR (jeśli skan),
    - normalizacja liczb:
      - separatory (`,`/`.`), minusy w nawiasach, tys./mln,
      - multi-column (np. 2023 vs 2024),
    - wykrywanie waluty i jednostek.
  - Standardized financial model (MUST):
    - kanoniczny model przechowuje:
      - orgId, entity (company/subsidiary) (TBD),
      - statement type (BS/P&L/CF),
      - period (start/end),
      - currency + scaling,
      - lines: { canonicalLineId, originalLabel, value, confidence, sourceRef },
      - metadata: source file, parsedAt, mappingVersion.
    - model jest przygotowany pod porównywalność cross‑country (minimum: currency + period + scaling + mapping transparency).
  - Validation & reconciliation (MUST):
    - walidacje sum (jeśli możliwe):
      - assets = liabilities + equity,
      - subtotals vs totals (best‑effort),
    - flagi “needs review” gdy walidacje nie przechodzą,
    - możliwość ręcznej korekty wartości i mapowania.
  - Downstream usage (MUST):
    - feed do T049: KPI → statement line impact może bazować na realnych liniach,
    - feed do raportów (T027): “financial snapshot” + wskaźniki jakości danych (coverage/confidence),
    - (opcjonalnie) w Company Profile: załączenie dokumentów jako evidence.
- OUT:
  - Pełny audyt księgowy i gwarancja poprawności jak w narzędziach finansowych enterprise.
  - Obsługa “wszystkich formatów świata” od razu.
- Future enhancements (post‑V2):
  - Import wielu formatów: XLS/XBRL, API integracje.
  - Auto‑mapping “industry packs” + uczenie się na korektach użytkownika.
  - Multi‑entity consolidation (grupy kapitałowe).

**UX / UI notes:**
- Najważniejsze: user musi rozumieć *co system wyciągnął* i *dlaczego* (confidence + highlight).
- Mapping ekran: szybki autocomplete + “suggested canonical line” (AI) + ręczne override.

**Data / integrations:**
- Wykorzystać wzorce z importu PDF assessmentów (wizard + mapping) jako architektura UI.
- Nowe endpointy: upload + parse + mapping save + fetch statements (TBD).
- Storage: nowe tabele `financial_statements`, `financial_statement_lines`, `financial_statement_sources` (TBD).

**Security / compliance:**
- Dane finansowe są wrażliwe:
  - RBAC: finanse/analityk edycja; sponsor read‑only,
  - log dostępu (TBD),
  - retention/policies per org (TBD).

**Analytics (events/metrics):**
- `financial_statement_import_started` / `completed` / `failed`
- `financial_statement_mapping_corrected`
- KPI: time-to-import, % importów z “pass validation”, adoption w analizach.

**Risks:**
- Duża wariancja formatów PDF → V2 musi być “best effort” + mocny mapping UI.
- Koszt OCR i błędy → throttling, limity i “confidence” zawsze w UI.

**Open questions:**
- Czy w V2 wspieramy multi‑column (wiele lat) w jednym PDF jako jeden import, czy wymagamy 1 okres/import?
- Jakie języki/regiony są MUST dla V2 (PL/EN/DE na start)?

**Definition of Done (DoD):**
- PDF można zaimportować i uzyskać ustrukturyzowane dane w modelu (BS/P&L/CF).
- Użytkownik może zmapować/naprawić linie i zapisać wynik z walidacją i confidence.

**Acceptance / test plan:**
- Test: PDF z embedded text (P&L) → parse + mapping + zapis; walidacje i flags.
- Test: PDF skan (OCR) → parse + low confidence + wymuszone review; zapis działa.

**Rollout plan:**
- Najpierw 1–2 “known formats” + manual mapping, potem rozszerzanie formatów i auto‑suggest.

---

## T051 — 🟣 finance — Comprehensive Financial Ratio Analysis (liquidity/profitability/leverage/efficiency/growth + benchmarks)
- Status spec: draft
- Link / ID (ClickUp): TBD
- Epic: (Finance diagnostics foundation) TBD
- Priorytet / V2 scope: V2

**Business challenge (problem):**
Same dane BS/P&L/CF nie są użyteczne bez warstwy interpretacji ilościowej. Potrzebujemy zestawu standardowych wskaźników (ratios), które da się:
- policzyć w sposób powtarzalny,
- porównać w czasie (history),
- oraz odnieść do benchmarków branżowych (na start: manual/uzgodnione źródło).

**Cel (outcome, nie feature):**
System liczy i prezentuje wskaźniki finansowe w pełnym zestawie kategorii, pokazuje trendy i (tam gdzie dostępne) benchmark, z jasnymi definicjami formuł i “coverage” danych.

**Użytkownicy i scenariusze:**
- Finanse: szybka diagnoza kondycji i ryzyk (płynność, zadłużenie).
- Konsultant: wkłada ratio insights do raportu i łączy z inicjatywami.
- Management/sponsor: widzi “red flags” i priorytety działań.

**Scope (V2)**
- IN:
  - Ratio engine (MUST):
    - wejście: ustandaryzowane statementy z T050 (BS/P&L/CF) + okresy,
    - wyjście: wartości wskaźników per okres + trend + status (OK/WARN/CRIT),
    - MUST: przechowywać definicje formuł (dla audytu) i wersjonowanie (TBD).
  - Ratio catalog (MUST):
    - Płynność:
      - Current ratio, Quick ratio, Cash ratio,
    - Rentowność:
      - Gross margin, Operating margin, Net margin, EBITDA margin (TBD jeśli linie są),
      - ROA, ROE (jeśli equity/asset lines są),
    - Zadłużenie / leverage:
      - Debt-to-equity, Debt ratio, Interest coverage (jeśli mamy interest/EBIT),
    - Efektywność:
      - Inventory turnover, AR/AP days, Cash conversion cycle (CCC),
    - Wzrost:
      - YoY revenue growth, YoY margin change (jeśli mamy multi‑period),
    - MUST: każdy wskaźnik ma:
      - wzór (jak liczymy),
      - wymagane linie danych (dependencies),
      - fallback/NA jeśli brak danych.
  - Coverage-aware UX (MUST):
    - jeśli brakuje danych do wskaźnika:
      - pokaż “NA” + powód (missing lines),
      - nie wyciągaj wniosków AI z NA.
  - Benchmarks (V2 baseline = manual source) (MUST):
    - możliwość wprowadzenia benchmarków:
      - per industry/region/company size (TBD minimal),
      - jako zakresy (min/median/max) lub target bands,
    - w UI: overlay benchmark band + “where we stand”.
  - Reporting integration (MUST):
    - 1–2 strony/slajdy “financial health ratios” do T027,
    - linkowanie red flags → rekomendowane inicjatywy (T032/T046) (V2 baseline = manual link).
- OUT:
  - Automatyczne pobieranie benchmarków z płatnych baz jako requirement V2 (może być post‑V2).
- Future enhancements (post‑V2):
  - Benchmark providers (płatne bazy) + auto refresh.
  - Industry packs z definicjami wskaźników (np. retail vs manufacturing).

**UX / UI notes:**
- Widok musi być skanowalny: kategorie → 3–5 top ratios → drill‑down.
- Każdy ratio ma “definition drawer” (wzór + źródła linii) dla zaufania.

**Data / integrations:**
- Źródło: `financial_statements` (T050).
- Benchmark: nowa tabela `financial_ratio_benchmarks` lub manual JSON per org (TBD).

**Security / compliance:**
- Dostęp do danych finansowych ograniczony (jak T050).
- Benchmarki mogą być licencjonowane → metadane o źródle i prawach użycia (TBD).

**Analytics (events/metrics):**
- `financial_ratios_viewed`
- `financial_benchmark_updated`
- `financial_ratio_exported`
- KPI: liczba analiz, eksportów do raportów, użycie w decyzjach.

**Risks:**
- Różnice definicji wskaźników (np. EBITDA) → w V2 muszą być jawne definicje i wersjonowanie.
- Brak linii danych → coverage musi być widoczne.

**Open questions:**
- Jaki minimalny benchmark input przyjmujemy w V2: industry + 3 percentyle czy tylko target band?

**Definition of Done (DoD):**
- Wskaźniki są policzone i prezentowane w czytelny sposób (kategorie + trend + definicje).
- Benchmarking działa na uzgodnionym źródle danych lub ręcznym input.

**Acceptance / test plan:**
- Test: 2 okresy P&L+BS → ratios policzone + YoY growth; missing lines → NA z powodem.
- Test: benchmark band ustawiony → UI pokazuje pozycję firmy i status (OK/WARN/CRIT).

**Rollout plan:**
- Najpierw ratio catalog + engine, potem benchmark inputs i eksporty.

---

## T052 — 🟣 finance — Full Financial Analysis and Interpretation (vertical/horizontal/historical/industry + AI insights)
- Status spec: draft
- Link / ID (ClickUp): TBD
- Epic: (Sponsor-grade finance narrative) TBD
- Priorytet / V2 scope: V2

**Business challenge (problem):**
Wskaźniki i statementy to “data”. Sponsor i management potrzebują **interpretacji**: co jest driverem zmian, jakie są ryzyka, gdzie są “quick wins”, co jest strukturalnym problemem. Bez narracji finanse zostają w excelu, a transformacja nie dostaje priorytetów.

**Cel (outcome, nie feature):**
System generuje ustrukturyzowaną interpretację finansową (sponsor-ready) na bazie:
- danych BS/P&L/CF (T050),
- wskaźników (T051),
- (opcjonalnie) benchmarków,
z outputem w formie: drivers, risks, actions, i z możliwością użycia w raportach/presentacjach.

**Użytkownicy i scenariusze:**
- Sponsor: 5–10 minutowy “finance brief” przed komitetem sterującym.
- Finanse/strategy: szybkie drafty narracji + możliwość korekt i zatwierdzenia.
- Konsultant: tworzy rekomendacje i inicjatywy z insightów.

**Scope (V2)**
- IN:
  - Analyses (MUST):
    - vertical analysis (common-size): struktura kosztów/przychodów, udział pozycji,
    - horizontal analysis: zmiany okres-do-okresu (QoQ/YoY),
    - historical trend: 3–8 okresów (jeśli dostępne),
    - benchmark comparison: jeśli benchmark istnieje (T051), inaczej “no benchmark”.
  - Insight framework (MUST):
    - ustrukturyzowany output:
      - Top 5 drivers (co ciągnie wynik),
      - Top 5 risks (płynność, leverage, margin compression, working capital),
      - Top 5 actions (konkretne działania) + link do inicjatyw,
      - “data quality notes” (coverage/confidence).
  - AI-generated narrative (MUST, grounded):
    - AI może generować tekst i podsumowania, ale:
      - musi cytować podstawę (konkretne ratio/linie statement),
      - nie może “wymyślać danych”,
      - musi oznaczać niepewność i braki.
    - guardrails: brak regulowanych rekomendacji inwestycyjnych (“buy/sell”), tylko operacyjno-finansowe wnioski.
  - UI (MUST):
    - “Finance Analysis” workspace:
      - dane (statements) → ratios → insights → actions,
      - approve/publish flow (TBD): DRAFT → APPROVED (żeby raporty brały tylko approved).
  - Actions integration (MUST):
    - z insightów można utworzyć:
      - initiative (T032),
      - task / decision,
    - linkowanie do KPI/ROI (T046/T047/T049).
  - Export (MUST):
    - raport/presentacja (T027): sekcja “Financial interpretation” + “Key ratios” + “Key actions”.
- OUT:
  - Rekomendacje inwestycyjne / doradztwo regulowane (compliance).
- Future enhancements (post‑V2):
  - Industry packs: dedykowane heurystyki i narracje per branża.
  - Integracje danych zewnętrznych (makro, ceny surowców) jako “context”.

**UX / UI notes:**
- “Two-layer” reading:
  - warstwa 1: executive bullets,
  - warstwa 2: drill‑down do liczb i definicji.

**Data / integrations:**
- Statements: T050.
- Ratios + benchmarks: T051.
- AI: pipeline do generowania structured insights (może używać istniejących wzorców AIPipeline), ale z twardym grounding.

**Security / compliance:**
- Uprawnienia jak do danych finansowych.
- Audit: kto zatwierdził interpretację (żeby w raporcie było zaufanie).

**Analytics (events/metrics):**
- `finance_analysis_generated`
- `finance_analysis_approved`
- `finance_insight_converted_to_initiative`
- KPI: wykorzystanie w raportach + feedback sponsora.

**Risks:**
- Jakość insightów AI → wymagane “grounded citations” i human approval.
- Brak benchmarków → insighty muszą działać bez porównań branżowych.

**Open questions:**
- Czy V2 wprowadza formalny workflow APPROVED dla finance insights (rekomendowane), czy tylko “last saved”?

**Definition of Done (DoD):**
- System tworzy interpretację na bazie danych finansowych i porównań.
- Output da się użyć w raportach/presentations (T027) i tworzeniu inicjatyw.

**Acceptance / test plan:**
- Test: 3 okresy statementów + ratios → wygenerowane insights zawierają cytowane liczby i “data quality notes”.
- Test: approve → report generator pobiera tylko APPROVED.

**Rollout plan:**
- Najpierw manual (bez AI) struktura insights + eksport, potem AI drafting z approval.

---

## T053 — 🟣 finance — Fundamental Budgeting (driver‑based projections from statements + KPI, sponsor‑ready)
- Status spec: draft
- Link / ID (ClickUp): TBD
- Epic: (Finance planning foundation) TBD
- Priorytet / V2 scope: V2

**Business challenge (problem):**
Budżetowanie jest core dla planowania transformacji i oceny trade‑off. Bez prostego, spójnego budżetu:
- sponsor nie ma “financial runway” dla decyzji,
- PMO nie umie porównać opcji (timeline vs koszt vs efekt),
- a inicjatywy nie mają ekonomicznego kontekstu.
W V2 chcemy budżet “fundamentalny”: wystarczająco dobry, ustrukturyzowany i eksportowalny — bez ciężaru enterprise forecasting.

**Cel (outcome, nie feature):**
Da się stworzyć budżet na bazie modelu finansowego i KPI:
- projekcja przyszłych wyników (P&L + Cash Flow) na uzgodniony horyzont,
- scenariusze (base/optimistic/conservative),
- spójny output do raportu/presentacji,
z jasnymi założeniami i workflow zatwierdzania.

**Użytkownicy i scenariusze:**
- Finanse: buduje budżet bazowy + scenariusze, publikuje do management.
- Management/sponsor: akceptuje budżet i używa go do decyzji portfelowych.
- Konsultant/PMO: wiąże inicjatywy z driverami budżetu i ocenia trade‑offy.

**Scope (V2)**
- IN:
  - Budget artifact & workflow (MUST):
    - budżet jako artefakt z:
      - orgId + (opcjonalnie) projectId/business unit (TBD),
      - period: start/end,
      - currency + assumptions,
      - status: DRAFT → REVIEW → APPROVED (publikowalny),
      - versioning: snapshot wersji przy approve.
  - Baseline & inputs (MUST):
    - baseline: ostatni zaimportowany i zatwierdzony statement z T050 (lub manual start),
    - KPI drivers: z T047,
    - mapping KPI → finance lines: z T049,
    - cost assumptions: CAPEX/OPEX z inicjatyw (T046/T042) jako opcjonalne inputs.
  - Projection model (V2 baseline = driver‑based, transparent) (MUST):
    - projekcja miesięczna (minimum) na 12 miesięcy (TBD default),
    - mechanika:
      - growth rates / deltas per driver (KPI),
      - proste zależności:
        - Revenue = baseline + driver adjustments,
        - COGS/OPEX = baseline + efficiency drivers,
        - Working capital drivers (Inventory/AR/AP) jeśli dane są,
      - Cash Flow: operating CF + capex plan + free cash flow,
    - każda linia ma:
      - source (baseline / manual / driver formula),
      - assumptions.
  - Scenarios (MUST):
    - base + optimistic + conservative,
    - diff view: “co się zmienia” + wpływ na FCF/EBITDA (jeśli liczone),
    - możliwość zablokowania wybranych linii (manual override).
  - UI (MUST):
    - “Budget workspace”:
      - Inputs → Projections → Scenarios → Publish,
      - tabular view + proste wykresy (trend),
      - coverage/quality: które linie są oparte o dane vs manual.
    - integracja z economics UI (jeśli istnieje) przez spójne komponenty (cashflow chart etc.).
  - Export / reporting (MUST):
    - raport/presentation (T027):
      - 1–2 strony/slajdy budżetu (P&L i CF) + scenariusze + assumptions.
  - Governance & audit (MUST):
    - audit log zmian assumptions i manual overrides,
    - only APPROVED budgets mogą być “source of truth” dla dalszych analiz.
- OUT:
  - Rolling forecast, wielowalutowe scenariusze enterprise, advanced budget cards jako osobny moduł.
- Future enhancements (post‑V2):
  - Rolling forecast + driver calibration na danych historycznych.
  - Integracje ERP + automatyczne odchylenia budżet vs actual (full controlling).

**UX / UI notes:**
- Budżet ma być “board‑readable”: proste tabele + 2–3 wykresy, bez chaosu.
- Always show assumptions i możliwość “drill‑down to formula”.

**Data / integrations:**
- Statements: T050.
- KPI & mapping: T047/T049.
- Budżety/limity: T042 (spójność).
- Istniejące economics (routes/services/UI) może być bazą implementacyjną dla obliczeń i cashflow wykresów.

**Security / compliance:**
- Edycja: finance/owner; sponsor read‑only + approve rights (TBD role mapping).
- Audit trail i wersjonowanie approve.

**Analytics (events/metrics):**
- `budget_created` / `budget_scenario_updated`
- `budget_approved`
- `budget_exported`
- KPI: liczba budżetów, czas do approve, użycie w decyzjach.

**Risks:**
- Różnice definicji linii finansowych i driverów → w V2 transparentność i audyt są MUST.
- Brak danych bazowych → V2 musi mieć ścieżkę “manual baseline”.

**Open questions:**
- Domyślny horyzont i granularność: 12 miesięcy monthly czy 24 miesiące z agregacją?

**Definition of Done (DoD):**
- Da się stworzyć budżet na bazie modelu finansowego i KPI.
- Wynik jest spójny i nadaje się do raportu/presentacji (T027) oraz ma workflow approve.

**Acceptance / test plan:**
- Test: baseline z T050 + 3 KPI drivers → budżet generuje projekcję P&L i CF, z widocznymi assumptions.
- Test: approve → tworzy snapshot, export do reportu bierze tylko APPROVED.

**Rollout plan:**
- Najpierw base scenario + manual overrides, potem drivers + scenariusze i diff view.

---

## T054 — 🟣 finance — Financial Modeling of Initiatives (fully-connected P&L + Balance Sheet + Cash Flow, economic events)
- Status spec: draft
- Link / ID (ClickUp): TBD
- Epic: (Finance engine / Integrated model) TBD
- Priorytet / V2 scope: V2

**Business challenge (problem):**
To jest “hard mode” finansów: forward‑looking model inicjatyw musi być **spójny księgowo**, a nie tylko “P&L z marginesem”. W praktyce oznacza:
- P&L, Balance Sheet i Cash Flow **są połączone relacjami**,
- prognozy wynikają z **economic events** (zdarzeń gospodarczych),
- model przechodzi kontrolę tożsamości rachunkowej (bilans się domyka).
Masz już to wypracowane w Excelu, ale przeniesienie do systemu wymaga silnika relacji i walidacji.

**Cel (outcome, nie feature):**
System pozwala zbudować i uruchomić model finansowy inicjatywy (lub projektu/portfela), który:
- generuje prognozy P&L/BS/CF w czasie,
- jest “audit‑able” (widać założenia, relacje, źródła),
- ma twarde walidacje spójności (balance + cashflow tie‑outs),
oraz zasila ROI/budżety/raporty.

**Użytkownicy i scenariusze:**
- Finanse/strategy: definiuje model i założenia, uruchamia scenariusze.
- PMO/sponsor: widzi prognozy i decyzje (continue/stop/scale) w kontekście cash oraz bilansu.
- Konsultant: buduje uzasadnienie ekonomiczne inicjatyw i zamienia insighty na działania.

**Scope (V2)**
- IN:
  - Integrated financial model (MUST):
    - generacja prognoz dla:
      - P&L (wynik),
      - Balance Sheet (aktywa/pasywa/kapitał),
      - Cash Flow (operating/investing/financing),
    - spójne powiązania:
      - Net income → Equity (retained earnings),
      - Depreciation/Amortization → P&L oraz BS (PPE/Intangibles) oraz add‑back w CF,
      - CAPEX → PPE/Intangibles (BS) oraz Investing CF,
      - Debt schedule → Liabilities (BS) oraz Financing CF oraz interest w P&L,
      - Working capital changes (AR/AP/Inventory) → BS oraz Operating CF.
  - Economic events engine (MUST):
    - model oparty o zdarzenia gospodarcze (lista rozszerzalna):
      - revenue event (sprzedaż),
      - COGS / OPEX events,
      - capex purchase,
      - depreciation run,
      - debt drawdown / repayment,
      - interest accrual / payment,
      - tax accrual / payment,
      - working capital change events,
      - equity injection / dividends (TBD),
    - każde zdarzenie ma:
      - parametry (kwota, waluta, okres, lag),
      - klasyfikację do CF (O/I/F),
      - “posting” do modelu (księgowanie logiczne) + provenance.
    - Uwaga: w V2 nie musimy implementować pełnej podwójnej księgowości jak ERP, ale silnik musi być wystarczająco formalny, by walidacje przechodziły.
  - Consistency checks (MUST, hard gates):
    - bilans: **Assets = Liabilities + Equity** per okres,
    - cash tie‑out: **ΔCash = Operating CF + Investing CF + Financing CF** per okres,
    - retained earnings tie‑out: ΔEquity zgodne z net income + equity events,
    - flagi: jeśli walidacja nie przechodzi → model status “NEEDS_REVIEW” i blokada publikacji/eksportu jako “approved”.
  - Scenario support (MUST):
    - base/optimistic/conservative (jak w economics),
    - diff view (co zmieniło się w relacjach/założeniach i jaki ma to wpływ na CF i bilans).
  - UI/workspace (MUST):
    - “Financial Model workspace”:
      - Inputs/Assumptions,
      - Events timeline (edytowalne, tabelaryczne),
      - Outputs: P&L / BS / CF + charts,
      - Validation panel (balance & tie‑outs) + drill‑down do przyczyn.
    - Workflow: DRAFT → REVIEW → APPROVED (tylko APPROVED idzie do raportów/budżetów jako source of truth).
  - Excel bridge (V2 baseline):
    - możliwość importu/transferu Twojego modelu z Excela w trybie “template”:
      - minimum: upload + przechowanie jako evidence + ręczne mapowanie kluczowych parametrów,
      - preferowane: Excel import wizard (analogiczny do `ExcelImportWizard`) do wciągnięcia parametrów/assumptions do modelu (TBD format template).
  - Integrations (MUST):
    - zasila:
      - ROI i financial impact w inicjatywach (T046 + sekcje `FinancialAnalysisSection` / `FinancialImpactSection`),
      - budżetowanie (T053),
      - raporty/presentacje (T027).
- OUT:
  - Pełny controlling realizacji kosztów per faktura (ERP‑grade).
  - Wielowalutowe enterprise consolidation jako requirement V2 (może być post‑V2).
- Future enhancements (post‑V2):
  - Rolling forecasts, multi‑entity consolidation, advanced tax logic.
  - Automatyczna kalibracja driverów na danych historycznych + integracje ERP.

**UX / UI notes:**
- “Model health” musi być widoczne zawsze: green = balans i tie‑outs OK; amber/red = coś nie domyka się.
- Drill‑down z walidacji do eventów/assumptions (to jest killer feature vs Excel).

**Data / integrations:**
- Można wykorzystać istniejące “economics” patterns (`economics.routes.ts`, `economicsFinancials.ts`, scenariusze) jako inspirację, ale to jest osobny poziom: **zintegrowane statements**, nie tylko cashflow ROI.
- Storage (TBD): `financial_models`, `financial_model_events`, `financial_model_outputs`, `financial_model_validations`, `financial_model_versions`.

**Security / compliance:**
- Dane wrażliwe: role finance/owner edycja; sponsor read‑only.
- Audit trail zmian assumptions i eventów + approve signatures.

**Analytics (events/metrics):**
- `financial_model_created`
- `financial_model_event_added` / `updated`
- `financial_model_validation_failed` (reason)
- `financial_model_approved`

**Risks:**
- Złożoność relacji → bez twardych walidacji będziemy mieć “ładne liczby” bez zaufania.
- Mapping z Excela → ryzyko “garbage in”; potrzebne template + walidacje.

**Open questions:**
- Jaki minimalny zestaw statement lines i event types jest MUST w V2, żeby model był już “realny” (a nie demo)?
- Jak formalizujemy Excel template (named ranges? CSV exports? fixed sheet schema)?

**Definition of Done (DoD):**
- Model generuje prognozy P&L/BS/CF na horyzont.
- Dla każdego okresu przechodzą walidacje:
  - **Assets = Liabilities + Equity**,
  - **ΔCash = OCF + ICF + FCF**,
  - spójne tie‑outs kapitału (retained earnings / equity events).
- Wynik jest eksportowalny do raportu/presentacji i gotowy do użycia w decyzjach.

**Acceptance / test plan:**
- Test: zestaw economic events (revenue, capex, depreciation, debt drawdown/repayment, WC change) → model domyka bilans i cashflow w każdym miesiącu.
- Test: celowo błędny event → walidacja FAIL + drill‑down pokazuje przyczynę i rekomendację korekty.

**Rollout plan:**
- Najpierw minimalny event catalog + walidacje + outputs, potem Excel template import i bardziej złożone relacje.

---

## T055 — 🟣 finance — Enterprise Valuation Module (professional DCF + comps, sponsor/VC‑deck grade)
- Status spec: draft
- Link / ID (ClickUp): TBD
- Epic: (Valuation engine / Strategic decisioning) TBD
- Priorytet / V2 scope: V2

**Business challenge (problem):**
Wycena to centralny artefakt dla decyzji strategicznych, fundraising/VC i M&A. Żeby była wiarygodna, musi być:
- **profesjonalna** (metodologia, spójność, standardy),
- **audit‑able** (jawne założenia, wersje, źródła danych),
- **czytelna** (deck‑ready output),
oraz spójna z całym “finance engine” (T054/T053), a nie niezależną kalką w UI.

**Cel (outcome, nie feature):**
Użytkownik (Founder/Finance/Strategy) przechodzi guided flow i otrzymuje wycenę:
- DCF (baseline V2: unlevered FCFF / WACC) + terminal value,
- comparative valuation (multiples) (manual inputs w V2),
- sensitivity i scenariusze,
z możliwością eksportu do raportu/pitch decka (T027) wraz z disclaimers.

**Użytkownicy i scenariusze:**
- Founder/CEO: przygotowuje rundę — potrzebuje “valuation story” + sensitivity.
- CFO/Finance: buduje i zatwierdza założenia, wersjonuje model.
- Strategy/M&A: porównuje scenariusze i wpływ inicjatyw na wycenę (bridge do T054/T046).

**Scope (V2)**
- IN:
  - Data sources & grounding (MUST):
    - preferowane źródło prognoz:
      - APPROVED model finansowy (T054) albo APPROVED budżet (T053),
    - fallback: manual forecast inputs (jeśli brak modelu),
    - zawsze pokazuj “source of forecast” + coverage.
  - DCF valuation (MUST, professional baseline):
    - model:
      - FCFF (unlevered) na horyzont N lat (default 5),
      - dyskontowanie WACC,
      - terminal value:
        - Gordon growth (g) (z walidacją \(g < WACC\)),
        - oraz alternatywnie exit multiple (EV/EBITDA lub EV/Revenue) (TBD; V2 może wspierać oba),
      - enterprise value → equity value:
        - net debt adjustment (z BS z T054 jeśli dostępne),
        - opcjonalnie minority interest/cash adjustments (TBD baseline).
    - must-have inputs:
      - discount rate / WACC (z breakdown: rf, ERP, beta, cost of debt, tax rate, capital structure),
      - tax rate, reinvestment/capex assumptions (jeśli nie wynikają z T054),
      - terminal growth (g) i/lub exit multiple,
      - shares/outstanding (jeśli liczymy per share) (TBD V2).
    - output:
      - EV, equity value, per share (jeśli dane),
      - PV of explicit period vs terminal split,
      - bridge / reconciliation view (co tworzy wartość).
  - Multiples / comparative valuation (MUST, V2 manual data):
    - trading comps inputs:
      - peer set (manual list) + multiples ranges (min/median/max),
      - wybór metryki (EV/EBITDA, EV/Revenue, P/E) zależnie od dostępnych danych,
    - implied valuation: zastosowanie multiple do metryki firmy (z T054/T053),
    - “why peers” notes + confidence.
  - Sensitivity & scenarios (MUST):
    - 2D sensitivity table (np. WACC vs g; WACC vs exit multiple),
    - tornado chart (top drivers),
    - scenario comparison (base/optimistic/conservative) — źródło: scenariusze T054/T053.
  - Guided flow UX (MUST):
    - kroki:
      - Source & horizon → Assumptions (WACC, g, multiples) → Results → Sensitivity → Export,
    - inline validation:
      - g < WACC,
      - brakujące inputy,
      - “red flags” (np. ujemny FCF bez uzasadnienia),
    - “model quality” badge: coverage + last approved + who approved.
  - Governance (MUST):
    - workflow valuation: DRAFT → REVIEW → APPROVED,
    - versioning snapshot na APPROVED,
    - audit log zmian kluczowych parametrów (WACC, g, peers, multiples).
  - Export (MUST):
    - deck/raport (T027):
      - 1 slajd: valuation summary (range, method weights, assumptions highlights),
      - 1 slajd: DCF details (PV split + key drivers),
      - 1 slajd: comps table + implied range,
      - 1 slajd: sensitivity (heatmap) + disclaimer,
    - watermark / disclaimer block (compliance) zawsze w export.
- OUT:
  - Automatyczne pobieranie danych rynkowych i peer multiples z API jako requirement V2.
  - Doradztwo inwestycyjne regulowane; rekomendacje “kup/sprzedaj”.
- Future enhancements (post‑V2):
  - Market data connectors (multiples, rf rates) + auto refresh.
  - Levered DCF, APV, multi‑stage growth, detailed debt schedule.
  - Monte‑Carlo / probabilistic valuation.

**UX / UI notes:**
- Musi wyglądać jak “professional finance tool”, nie jak formularz:
  - prefilled defaults (ale jawne),
  - zero ukrytej magii: “click to see formula”.
- Wszystkie liczby muszą mieć źródło (T054/T053/manual) i timestamp.

**Data / integrations:**
- Integracja z:
  - T054 (integrated model outputs: FCF, net debt, cash, tax),
  - T053 (budget projections),
  - T052 (financial interpretation) jako narracja “valuation story” (opcjonalnie).
- Storage (TBD): `valuations`, `valuation_assumptions`, `valuation_peers`, `valuation_versions`.

**Security / compliance:**
- Disclaimers MUST:
  - “for informational purposes, not investment advice”,
  - “assumptions-driven; results may vary”,
  - “not audited”.
- RBAC: finance/strategy edycja; founder/management read‑only + approve (TBD).

**Analytics (events/metrics):**
- `valuation_created`
- `valuation_assumption_updated` (wacc|g|multiple|peer_set)
- `valuation_approved`
- `valuation_exported`

**Risks:**
- Odpowiedzialność prawna → mocne disclaimers + brak języka inwestycyjnego.
- Garbage assumptions → potrzebne walidacje + “quality/coverage” i approval.

**Open questions:**
- Czy w V2 liczymy “per share” (wymaga shares/outstanding + cap table baseline) czy tylko EV/Equity value?
- Czy default terminal to Gordon czy exit multiple (czy oba równolegle)?

**Definition of Done (DoD):**
- Użytkownik przechodzi guided flow i dostaje wynik DCF + comps + sensitivity.
- Wycena ma workflow i wersjonowanie (APPROVED snapshot) + audit log.
- Output jest **VC/sponsor‑deck grade** (czytelne slajdy + assumptions + sensitivity + disclaimers).
- Jakość obliczeń:
  - walidacje wejść (np. \(g < WACC\)) działają,
  - na referencyjnym workbooku Excel (Twoim) wynik DCF (EV) jest zgodny w granicy tolerancji (np. ≤ 1% różnicy) dla zestawu testowych założeń (TBD).

**Acceptance / test plan:**
- Test: prognoza z T054 + WACC/g → DCF EV + equity bridge + sensitivity heatmap.
- Test: comps — manual peer multiples → implied range; zmiana peer set aktualizuje wynik.
- Test: export do PPTX/PDF (T027) zawiera slajdy + disclaimers.

**Rollout plan:**
- Najpierw DCF + sensitivity + export, potem comps module i lepsze governance/approval UX.

---

## T056 — 🟣 finance — Valuation Improvement Advisory Module (compliant “how to improve valuation”, action‑to‑initiative)
- Status spec: draft
- Link / ID (ClickUp): TBD
- Epic: (Value creation playbooks) TBD
- Priorytet / V2 scope: V2

**Business challenge (problem):**
Wynik wyceny bez “co robić dalej” jest mało użyteczny. Użytkownik chce konkretnych, priorytetyzowanych działań, które poprawiają value drivers (margins, growth, risk, working capital, capital structure). Jednocześnie to obszar wrażliwy pod compliance: nie możemy generować porad prawnych/inwestycyjnych ani “obietnic”.

**Cel (outcome, nie feature):**
System generuje **compliant** listę działań poprawiających wycenę:
- powiązaną z driverami DCF/multiples,
- z uzasadnieniem opartym o liczby (grounded),
- z priorytetem (impact/effort/time‑to‑impact/risk),
oraz z możliwością konwersji w inicjatywy/tasks/decisions w platformie.

**Użytkownicy i scenariusze:**
- Founder/CEO: “Jak podnieść valuation w 6–12 miesięcy?” → plan działań.
- CFO/Strategy: przegląda rekomendacje, wybiera i zatwierdza te, które zamienia w inicjatywy.
- PMO: przekłada rekomendacje na portfolio (T035/T038).

**Scope (V2)**
- IN:
  - Inputs (MUST):
    - APPROVED valuation (T055) + assumptions,
    - APPROVED finance insights (T052) + ratios (T051),
    - integrated model outputs (T054) (jeśli istnieją),
    - KPI mapping/ROI (T046/T047/T049) (opcjonalnie).
  - Driver decomposition (MUST):
    - identyfikacja top driverów wyceny:
      - growth (revenue CAGR),
      - margins (gross/operating),
      - reinvestment intensity (capex/working capital),
      - risk (WACC components),
      - terminal assumptions (g / exit multiple),
    - “which lever matters” ranking (np. tornado from T055).
  - Advisory recommendations (MUST, structured):
    - 10–20 rekomendacji w kategoriach:
      - growth acceleration,
      - margin improvement,
      - working capital optimization,
      - risk reduction (operational + cybersecurity + compliance),
      - capital structure optimization (bez porad regulowanych),
      - governance & reporting quality (zwiększenie zaufania inwestora),
    - każda rekomendacja ma:
      - **hypothesis** (co zmieniamy),
      - **mechanism** (jak to wpływa na valuation driver),
      - **expected direction** (↑EV / ↓risk / ↑multiple) bez obiecywania liczb,
      - **evidence** (cytowane ratio/linia/assumption),
      - **estimated impact tier** (High/Med/Low) + confidence,
      - **effort** (S/M/L) + time‑to‑impact,
      - **risks/side‑effects**,
      - **next steps** (3–5 kroków).
  - Action → initiative conversion (MUST):
    - przycisk “Create initiative” (T032) z:
      - prefilled charter + KPI links + owner suggestions,
      - powiązanie z valuation driver,
    - alternatywnie: create task / decision (jeśli potrzebna zgoda).
  - UI (MUST):
    - panel “Valuation Advisory” przy wycenie (T055):
      - drivers summary → recommendations list → conversion actions,
    - filtry: category, impact tier, confidence, time‑to‑impact.
  - Compliance guardrails (MUST):
    - twarde zasady:
      - brak porad prawnych/podatkowych jako “porada”,
      - brak “kup/sprzedaj” i gwarancji wyników,
      - disclaimers widoczne zawsze,
    - content safety:
      - blokada niektórych kategorii promptów (TBD),
      - “human approval” przed eksportem do decka (REVIEW/APPROVE).
- OUT:
  - Personalizowane porady prawne, generowanie umów, automatyczne wdrożenia zmian w organizacji.
- Future enhancements (post‑V2):
  - “Value creation roadmap” automatycznie optymalizowany (sprzężenie z T035/T038).
  - Industry packs z benchmarkami i rekomendacjami specyficznymi dla branży.

**UX / UI notes:**
- Rekomendacje muszą być “board‑ready”: krótko, jasno, z dowodem i next steps.
- Użytkownik ma czuć, że to plan działania, nie “AI essay”.

**Data / integrations:**
- T055: drivers/sensitivity.
- T054: financial levers i constraints (cash, debt, WC).
- Initiative generator (T032) jako mechanizm konwersji.

**Security / compliance:**
- RBAC jak dla valuation/finance.
- Disclaimers i audit: kto zatwierdził rekomendacje do użycia na zewnątrz.

**Analytics (events/metrics):**
- `valuation_advisory_generated`
- `valuation_advisory_recommendation_converted` (initiative|task|decision)
- `valuation_advisory_exported`

**Risks:**
- Compliance: ryzyko zbyt mocnych stwierdzeń → guardrails + approvals.
- “Generic advice” → wymagane grounding w danych i driver decomposition.

**Open questions:**
- Czy w V2 rekomendacje mają mieć “range estimate” (np. impact band), czy tylko tier + confidence?

**Definition of Done (DoD):**
- System generuje listę działań wraz z uzasadnieniem i priorytetem.
- Rekomendacje są compliant (disclaimers + brak regulowanych porad) i konwertowalne do inicjatyw.

**Acceptance / test plan:**
- Test: valuation z wyraźnym driverem WACC → rekomendacje risk‑reduction + evidence + conversion do initiative.
- Test: próba wygenerowania porady prawnej → system odmawia / przeformułowuje compliant.

**Rollout plan:**
- Najpierw “structured recommendations” + conversion do initiatives, potem approvals i industry packs.

---

## T057 — 🟣 finance — Valuation Negotiation Argument Builder (pro/contra, objections & rebuttals, deck‑ready)
- Status spec: draft
- Link / ID (ClickUp): TBD
- Epic: (Fundraising/M&A negotiation prep) TBD
- Priorytet / V2 scope: V2

**Business challenge (problem):**
Negocjacje wyceny wymagają struktury, argumentów i kontrargumentów. Founderzy często mają tylko “number”, a nie:
- tezę i logiczny wywód,
- dowody (assumptions/metrics),
- przygotowane odpowiedzi na obiekcje (VC/M&A).

**Cel (outcome, nie feature):**
System buduje zestaw argumentów do negocjacji wyceny:
- **pro‑valuation** (dlaczego taka wycena jest uzasadniona),
- **contra‑valuation** (uczciwie: gdzie są słabe punkty i jak je adresować),
z gotowymi ripostami i “talk track”, który można wkleić do decka/briefu.

**Użytkownicy i scenariusze:**
- Founder: przygotowuje rozmowę z VC → 10 min “talk track” + Q&A.
- CFO: dba o zgodność argumentów z modelami i danymi.
- M&A: przygotowuje “seller narrative” i defensywną listę ryzyk.

**Scope (V2)**
- IN:
  - Inputs (MUST):
    - APPROVED valuation (T055) + sensitivity,
    - finance insights (T052) + ratios (T051),
    - (opcjonalnie) advisory actions (T056) jako “plan to de‑risk / improve”.
  - Argument structure (MUST):
    - teza → dane/założenia → logika → implikacja,
    - dla każdej tezy: “supporting evidence” (cytowane metryki),
    - jawne assumptions (WACC/g/multiples) i “what would change my mind”.
  - Pro/contra set (MUST):
    - pro‑valuation:
      - 5–10 key points + 1‑liners + supporting facts,
    - contra‑valuation:
      - top objections (np. ryzyko, churn, concentration, cash burn, execution risk) + riposty,
      - “concessions” (co można oddać bez utraty strategii) (TBD).
  - Q&A / objections playbook (MUST):
    - lista 15–25 typowych pytań VC/M&A + suggested answer,
    - “don’t say list” (compliance) + disclaimers.
  - Deck-ready export (MUST):
    - generator slajdów/sekcji:
      - valuation narrative,
      - sensitivity highlights,
      - mitigation plan (z T056) jako “risk response”.
- OUT:
  - Automatyczne drafty umów i poradnictwo prawne.
- Future enhancements (post‑V2):
  - Personalizacja pod profil inwestora (growth vs value) + strategia kotwiczenia.
  - Integracje market data do porównań (post‑V2).

**UX / UI notes:**
- Krótkie, “spoken language” + opcja “formal memo”.
- Każdy punkt ma “source” (z modelu), żeby nie było halucynacji.

**Security / compliance:**
- Disclaimers: informational, not legal/investment advice.
- “No hallucinations”: tylko grounded, inaczej oznacz jako TBD.

**Analytics (events/metrics):**
- `valuation_negotiation_pack_generated`
- `valuation_negotiation_pack_exported`

**Risks:**
- Jakość argumentów bez danych → system musi degradować do “missing evidence”.

**Open questions:**
- Czy w V2 wspieramy “two-sided memo” (pro/contra w jednym dokumencie) jako standard?

**Definition of Done (DoD):**
- System generuje argumenty w dwóch kierunkach na bazie założeń i danych.
- Output jest gotowy do użycia w decku/briefie (z disclaimers).

**Acceptance / test plan:**
- Test: valuation z sensitivity → pack zawiera argumenty + obiekcje + riposty + cytowane źródła.
- Test: export → generuje spójny dokument/sekcję do slajdów.

**Rollout plan:**
- Najpierw pro/contra + Q&A, potem lepsze szablony i integracja z presentation generator.

---

## T058 — 🟣 finance — Presentation Generator (Gamma.app‑level quality, BCG‑grade PPTX, platform artifacts → deck)
- Status spec: draft
- Link / ID (ClickUp): TBD
- Epic: (Outputs → sponsor/VC‑ready decks) TBD
- Priorytet / V2 scope: V2

**Business challenge (problem):**
Użytkownicy chcą szybko przełożyć pracę w platformie na deck sponsor‑ready **na poziomie Gamma.app** (czyli: “piękne slajdy bez dłubania”), ale:
- treści są rozproszone (research, inicjatywy, finanse, tools, KPI),
- jakość slajdów musi być “consulting‑grade” (layout, story, skanowalność),
- eksport musi być realnie używalny w PowerPoint/Google Slides (PPTX).

**Cel (outcome, nie feature):**
Użytkownik wybiera źródła (artefakty) i generuje **spójny deck** w stylu Consultify:
- z dobrą narracją (outline → story),
- z jasnymi key messages na slajdach,
- w wersji językowej (PL/EN) i z brandingiem/konfidentialnością,
oraz eksportuje do PPTX (i opcjonalnie PDF) bez ręcznego sklejania.

**Użytkownicy i scenariusze:**
- Konsultant: “Steering Committee deck” z portfolio inicjatyw + risks + next steps.
- Founder/CFO: “Valuation deck” (T055/T056/T057) + sensitivity + plan działań.
- PMO: “Program status deck” z execution timeline (T039/T041/T040) + budżet (T042/T053).

**Scope (V2)**
- IN:
  - Source selection (MUST):
    - user wybiera 1..N źródeł do decka:
      - initiatives/portfolio, execution status, RAID, KPI/ROI, valuation outputs, finance insights,
      - narzędzia/tools outputs (tool sessions) (T019–T021),
      - (opcjonalnie) reporty (T027) jako źródło slajdów,
    - możliwość ograniczenia: “only approved artifacts” (zalecane dla enterprise).
  - Guided deck setup (MUST):
    - audience: sponsor / exec / VC / internal,
    - goal: inform / decide / sell / align,
    - language: PL/EN (V2 baseline),
    - template: corporate/minimal/modern (spójne z pipeline),
    - confidentiality: confidential/internal/public,
    - brandColor/logo (TBD: org branding settings).
  - Outline → slides generation (MUST):
    - AI generuje:
      - outline (sekcje + slajdy) + key messages,
      - mapowanie treści do “slide intents”,
    - user może:
      - dodać/usunąć slajd,
      - zmienić kolejność,
      - edytować key message i 1–2 bullet points,
    - bez budowania pełnego edytora slajdów (OUT).
  - Gamma.app‑level quality bar (MUST, non‑negotiable):
    - story-first:
      - każdy slajd ma 1 key message (headline) + supporting evidence (max 3–5 bullets),
      - automatyczne “slide splitting”: jeśli treści za dużo → generator dzieli na 2 slajdy zamiast upychać,
      - automatyczne “sectioning”: cover → section intro → content → next steps/closing.
    - layout polish:
      - zero overflow / uciętych tekstów / nachodzących na siebie elementów,
      - auto-fit font sizing (kontrolowane) + twarde minima (np. body ≥ 14pt) (TBD),
      - stała hierarchia typograficzna (H1/H2/body/captions) i whitespace,
      - spójne gridy i marginesy (design tokens).
    - visuals-by-default:
      - preferować wizualizacje zamiast ścian tekstu:
        - KPI tiles/strips, heatmapy, macierze priorytetów, roadmap band, risk tables,
      - ikony/oznaczenia semantyczne (status/priority) tylko tam gdzie dodają czytelność,
      - chart styling spójny z template (kolory, legendy, źródło).
    - grounding:
      - liczby mają source tags; jeśli brak źródła → oznacz jako TBD, nie generuj “na czuja”.
    - “minimal manual fixes”:
      - deck po eksporcie ma być gotowy do użycia po kosmetycznych korektach (a nie “naprawianiu layoutu”).
  - Unified JSON as canonical format (MUST):
    - deck jest przechowywany jako “Unified Report JSON” (lub analogiczny “Unified Deck JSON”),
    - intents zgodne z istniejącym katalogiem (`cover`, `executive_summary`, `key_messages`, `initiative_portfolio`, `roadmap`, `risk_management`, `next_steps`, …),
    - quality gates: walidacje (RulesEngine) przed renderem.
  - Rendering & export (MUST):
    - render PPTX przez istniejący `PptxPipelineService` (primary),
    - fallback: legacy `PptxExportService` (jeśli potrzebne),
    - eksport:
      - PPTX (MUST),
      - PDF (V2 optional, jeśli macie już pipeline),
    - wynik przechowujemy jako artefakt z metadanymi (kto, kiedy, z czego powstał).
  - Preview & share (MUST):
    - podgląd deck outline + mini‑preview (np. thumbnails) (TBD),
    - “regenerate”:
      - 1‑klik: regeneruj cały deck,
      - 1‑klik: regeneruj pojedynczy slajd (z zachowaniem intentu) (TBD),
    - generowanie public link (jeśli polityka pozwala) (reuse report share patterns),
    - watermark + disclaimers (dla finance/valuation).
  - Content grounding & citations (MUST):
    - każdy slajd ma “source tags” (link do artefaktów i timestamp),
    - AI nie może “wymyślać liczb”: liczby muszą pochodzić ze źródeł (T054/T055/etc.) albo być oznaczone jako TBD.
  - Performance & limits (MUST):
    - limity: np. 5–25 slajdów w V2 (TBD),
    - timeout/async job dla generacji (jeśli dłużej trwa),
    - obsługa błędów: fallback error slide + warnings (pipeline już to robi).
- OUT:
  - Pełny edytor slajdów jak PowerPoint (drag‑resize, custom shapes) w V2.
  - “Design marketplace” z setkami motywów.
- Future enhancements (post‑V2):
  - Inline slide editor (ograniczony) + brand kits per klient.
  - Multi‑language decks (6 języków) + RTL layouts.
  - Auto‑refresh deck “live link” (deck regeneruje się gdy źródła się zmienią).

**UX / UI notes:**
- UX ma być **Gamma‑app‑level**: szybka konfiguracja, outline-first, natychmiastowy preview, a potem render.
- “Consulting‑grade” = “clean & confident”:
  - minimal noise, dużo whitespace,
  - 1 key message / slajd,
  - bullets krótkie, nie eseje,
  - wykresy/tabele zawsze z podpisem i źródłem.

**Data / integrations:**
- Backend: istniejący `server/src/services/report/pptx/*` (Unified JSON + intents + layouts + RulesEngine).
- Routes: można wykorzystać istniejące `/api/reports/*` patterns (generate/export/share) jako bazę, ale dla decków może być osobny `presentations.routes.ts` (TBD).

**Security / compliance:**
- RBAC: generowanie/export zależne od dostępu do źródeł.
- Public share tylko jeśli dozwolone; hasło/expiry.
- Finance/valuation: zawsze disclaimers + confidentiality banner.

**Analytics (events/metrics):**
- `presentation_generator_opened`
- `presentation_outline_generated`
- `presentation_exported` (pptx|pdf, slideCount)
- `presentation_shared`

**Risks:**
- Jakość layoutu/brand consistency → w V2 twarde quality gates + ograniczony katalog intents.
- Hallucination liczb → source tags + blokady na “uncited numbers”.

**Open questions:**
- Czy w V2 deck jest oddzielnym bytem od reportów (osobna tabela), czy reuse `reports` z nowym `sourceType`?
- Jakie są 3–5 “canonical deck types” (steering, valuation, program update, tool workshop) jako gotowe preset outlines?

**Definition of Done (DoD):**
- Użytkownik wybiera źródła i generuje deck w spójnym stylu (outline + key messages).
- Rendering przez pipeline daje poprawny PPTX (otwieralny w PowerPoint) z poprawnym brandingiem i konfidentialnością.
- Eksport jest gotowy do użycia **bez ręcznego “naprawiania” slajdów**:
  - brak overflow / overlapped elements,
  - brak “tiny fonts” poniżej ustalonego minimum,
  - deck ma spójną hierarchię typografii i grid.
- Quality gates:
  - RulesEngine blokuje generację, jeśli slajdy naruszają krytyczne zasady jakości (np. overflow),
  - generator potrafi auto-split treści na dodatkowe slajdy zamiast łamać layout.

**Acceptance / test plan:**
- Test: deck “Steering update” z portfolio+RAID+next steps → pipeline renderuje 12–18 slajdów bez błędów.
- Test: deck “Valuation” z T055 → zawiera summary + sensitivity + disclaimers.
- Test: “Gamma quality” — otwarcie PPTX w PowerPoint:
   - brak nachodzących elementów,
   - brak uciętych tekstów,
   - 0 krytycznych naruszeń jakości w walidacji,
   - tylko kosmetyczne poprawki (opcjonalne), nie naprawa układu.

**Rollout plan:**
- Najpierw 2–3 preset deck types + export PPTX, potem custom outlines i share links.

---

## T059 — 🟣 reports — Business Presentation Templates (brand kits + preset deck types + intent library)
- Status spec: draft
- Link / ID (ClickUp): TBD
- Epic: (Template system for reports & decks) TBD
- Priorytet / V2 scope: V2

**Business challenge (problem):**
Jeśli chcemy “Gamma.app‑level” decki (T058) i executive‑ready raporty (T027), to nie możemy generować wszystkiego “od zera” za każdym razem. Potrzebujemy **systemu szablonów**, który:
- zapewnia spójność brandu i jakości,
- daje preset “deck types” (steering / valuation / program update / tool workshop),
- pozwala organizacjom dopasować styl (logo, kolory, disclaimer, stopki),
bez ryzyka rozjechania layoutu.

**Cel (outcome, nie feature):**
Użytkownik wybiera szablon (template) i dostaje:
- spójny styl (brand kit),
- spójny “story spine” (outline preset),
- kompatybilność z PPTX pipeline (intents/layouty/quality gates),
tak aby generacja decków/raportów była szybka, powtarzalna i premium‑quality.

**Użytkownicy i scenariusze:**
- Konsultant: wybiera “Steering Committee Update” → deck powstaje w stylu klienta.
- CFO/Founder: wybiera “Valuation Pack” → deck ma właściwe disclaimers i sekcje.
- Admin org: ustawia brand kit (logo/kolory/stopki) i publikuje template dla zespołu.

**Scope (V2)**
- IN:
  - Template taxonomy (MUST):
    - rozdzielić:
      - **deck templates** (dla T058),
      - **report templates** (dla T027 / report builder),
      - **management report templates** (steering/team cadence) (jeśli używacie `management_report_templates`),
    - każdy template ma:
      - name, description, audience, goal,
      - language default,
      - confidentiality default,
      - “intent coverage” (jakie slide intents/sekcje są używane).
  - Brand Kits (MUST):
    - per org:
      - logo (opcjonalnie),
      - primary/secondary colors (override design tokens),
      - font policy (PowerPoint-safe fonts; V2 baseline = z `designTokens.ts`),
      - footer/header rules, page numbers, confidentiality banner,
    - guardrails: brand kit nie może zepsuć jakości (np. zbyt jasny primary → auto-contrast).
  - Preset deck types (MUST, 3–5 system templates):
    - minimum V2:
      - Steering Committee Update,
      - Program/Execution Update,
      - Valuation Pack (T055/T056/T057),
      - Tool Workshop Summary,
      - (opcjonalnie) Assessment Summary (DRD/SIRI/ADMA).
    - każdy preset definiuje:
      - outline (sekcje + intents),
      - limity slajdów,
      - “must-have slides” (cover, exec summary, key messages, next steps, disclaimer),
      - recommended visuals (KPI strip, roadmap, risk table, heatmap, sensitivity).
  - Intent / layout library alignment (MUST):
    - templates muszą mapować na istniejące `SlideIntent` i layouty (PPTX pipeline),
    - quality gates (RulesEngine) są obowiązkowe — template nie może ich omijać.
  - Customization workflow (MUST):
    - system templates (read‑only) → użytkownik może:
      - **clone** do org template,
      - edytować metadane (audience/goal),
      - w ograniczonym zakresie edytować outline (kolejność, on/off sekcje),
      - podmienić brand kit.
    - bez edycji “pixel‑level” layoutów w V2.
  - Preview & QA (MUST):
    - template preview:
      - mini deck (sample content) renderowany przez pipeline,
      - walidacja: brak overflow / tiny fonts / overlap,
    - “template health” status: OK/WARN/FAIL + wskazówki naprawy.
  - Storage & migration strategy (MUST):
    - reuse istniejących tabel tam gdzie pasują:
      - `report_builder_templates` (wysokiej jakości templates do reportów),
      - `management_report_templates` (cadence reports),
    - dla deck templates: nowa tabela `presentation_templates` (TBD) albo reuse `report_builder_templates` z `source_type='PRESENTATION'` (TBD decyzja),
    - seeding: dostarczyć system templates w migracji/seed script.
- OUT:
  - Marketplace stylów i pełny edytor layoutów (komponentowy builder) w V2.
- Future enhancements (post‑V2):
  - Template editor dla advanced użytkowników (guardrailed) + custom intents.
  - 6 języków + RTL deck layouts (ar).
  - Auto-learning: które deck types działają najlepiej (adoption + conversion).

**UX / UI notes:**
- Wybór template ma być tak prosty jak w Gamma: karta template + mini preview + “Use”.
- Dla admina: osobny panel “Brand & Templates” (settings).

**Data / integrations:**
- PPTX pipeline: `designTokens.ts`, `SlideIntent`, `layouts/*`, `RulesEngine`, `PptxPipelineService`.
- Report templates: `report_builder_templates` (już seedowane) + T027.

**Security / compliance:**
- Org templates: edycja tylko dla ADMIN/OWNER/Brand role (TBD), reszta read/use.
- Audit log zmian brand kit i template publish.

**Analytics (events/metrics):**
- `template_selected` (templateId, type=deck|report)
- `brand_kit_updated`
- `template_cloned` / `template_published`
- KPI: adoption, eksporty, redukcja czasu “deck production”.

**Risks:**
- Zbyt duża swoboda edycji → ryzyko popsucia jakości (dlatego V2 ogranicza do outline + brand kit).
- Rozjazd między template outline a pipeline intents → potrzebna walidacja i preview.

**Open questions:**
- Czy deck templates trzymamy jako osobny byt (`presentation_templates`) czy reuse `report_builder_templates` z nowym `source_type`?

**Definition of Done (DoD):**
- Istnieje system templates (3–5 preset deck types) + brand kit per org.
- Użytkownik może wybrać template i wygenerować deck/raport w spójnym stylu.
- Template preview + quality gates wykrywają i blokują krytyczne naruszenia jakości.

**Acceptance / test plan:**
- Test: sklonuj system template → zmień brandColor/logo → preview renderuje bez overflow/overlap.
- Test: każdy preset deck type generuje PPTX “Gamma quality” (brak napraw layoutu).

**Rollout plan:**
- Najpierw system templates + brand kit overrides, potem org cloning/publish i template health panel.

---

## T060 — 🟣 reports — Structured Report Generator (block builder, pro formatting, export‑ready, “first on market”)
- Status spec: draft
- Link / ID (ClickUp): TBD
- Epic: (Reporting deliverables / Report Builder v2) TBD
- Priorytet / V2 scope: V2

**Business challenge (problem):**
Na rynku nie ma “sprytnych generatorów raportów” w sensie consulting deliverable — są albo:
- proste eksporty, albo
- pełne WYSIWYG (Word‑like) bez AI i bez struktury, albo
- narzędzia do prezentacji (Gamma‑like) które nie rozwiązują problemu raportu.
U Was raporty już są generowane w systemie jako **strukturalne bloki**: dużo ustawień, dodajemy sekcje po kolei, ustawiamy kolejność, opisujemy “co ma być w środku”. T060 ma to **sfinalizować do standardu premium**.

Dodatkowo (super ważne): generator musi pozwolić, żeby w formie raportów dało się prezentować **wszystko, co tworzymy w aplikacji** — inicjatywy, execution (timeline/delays/RAID), finanse (budżet/model/wycena), KPI/ROI, narzędzia consultingowe, interview insights, rekomendacje i roadmapy — w jednym, spójnym deliverable.

**Cel (outcome, nie feature):**
Konsultant/PMO generuje raport jako deliverable sponsor‑ready:
- wybiera źródło (assessment/tool/interview/initiative),
- wybiera strukturę (sekcje/bloki) i kolejność,
- doprecyzowuje “prompt hints” per sekcja,
- generuje/regenruje sekcje iteracyjnie,
- robi review + wersje + komentarze,
- eksportuje do PDF/DOCX (i opcjonalnie PPTX, jeśli raport ma charakter decka),
bez ręcznego klejenia w Wordzie.

**Użytkownicy i scenariusze:**
- Konsultant: tworzy raport z narzędzia/assessmentu dla klienta (Executive + Appendix).
- PMO: składa status/steering report z inicjatyw + RAID + next steps.
- Sponsor (read‑only): przegląda finalny raport, dostaje public link/PDF.

**Scope (V2)**
- IN:
  - Source selection (MUST):
    - źródła raportu: ASSESSMENT / TOOL / INTERVIEW / INITIATIVE (zgodnie z istniejącym `ReportBuilder`),
    - filtrowanie: prefer “only approved sources” (np. APPROVED assessments) dla jakości.
  - “Everything-in-app → report” coverage (MUST):
    - raport może zawierać bloki z całej platformy, w szczególności:
      - initiatives/portfolio + roadmap + priorytety,
      - execution: timeline, delay signals, RAID risks/issues + mitigacje,
      - KPI/ROI + attribution + financial statement mapping,
      - finanse: budżet, analiza, model finansowy (P&L/BS/CF) i wycena (DCF/comps/sensitivity),
      - tools outputs (T019–T021) + wnioski + closure,
      - interview insights + evidence,
      - decyzje/tasks jako “next steps”.
    - Uwaga implementacyjna: nawet jeśli report ma jeden “primary sourceType”, musi pozwalać dodawać bloki odwołujące się do innych artefaktów (linked blocks), z czytelnym “source tag”.
  - Wizard / flow (MUST, jak w obecnym systemie):
    - kroki (V2 baseline):
      - Source select → Intent → Configure structure → Generate → Review/Edit → Export/Share,
    - invocation profiles (MUST):
      - profile per sourceType (macie `reportInvocationProfiles`),
      - profile steruje defaultami (sekcje, długość, styl, visuals).
  - Block/section builder (MUST):
    - sekcje/bloki:
      - dodawanie z palety (BlockPalette),
      - enable/disable,
      - reorder (drag),
      - chapter grouping (dla długich raportów),
    - per sekcja ustawienia (MUST):
      - title,
      - length (short/medium/long),
      - language style (technical/business/general),
      - customPrompt / “dodatkowe wskazówki dla AI”,
      - renderKind / blockTypeId (jeśli dotyczy),
    - nawigacja kolejnością:
      - “chapter navigation” + szybkie skoki,
      - “what’s missing” checklist (np. brak exec summary, brak next steps).
  - Agent mode (MUST, Gamma‑style “talk to agent → layout changes”):
    - wbudowany “report agent” (chat) potrafi na polecenie użytkownika:
      - zmieniać układ struktury: reorder, split chapters, włączać/wyłączać sekcje,
      - dodawać/usuwać bloki (z palety) i proponować sensowną kolejność,
      - modyfikować ustawienia sekcji: length, language style, customPrompt, visuals,
      - proponować “best practice structure” dla celu (steering/valuation/assessment/roadmap),
      - regenerować pojedynczy blok albo cały rozdział,
      - wskazywać luki jakości (np. brak next steps / brak danych / brak citations) i proponować poprawki.
    - model interakcji:
      - agent pokazuje preview zmian (diff: co się zmieni w strukturze) i dopiero potem stosuje,
      - wszystkie zmiany są audytowalne i wersjonowane (jak inne edycje).
    - guardrails:
      - agent nie może zmienić liczb “z powietrza”; liczby muszą pochodzić ze źródeł lub być oznaczone jako TBD.
  - Generation model (MUST):
    - generacja per blok:
      - generate / regenerate,
      - “needs regeneration” gdy zmieniono ustawienia/prompt,
    - quality gates:
      - blokada “publish/export” jeśli:
        - są enabled sekcje bez contentu,
        - są krytyczne naruszenia (np. brak źródeł liczb przy requireCitations),
      - minimalna struktura: cover + executive summary + key findings + recommendations + next steps (zależnie od preset/profile).
  - Review & collaboration (MUST):
    - komentarze (block‑level) + panel review (macie `ReportBuilderCommentsService` i UI),
    - status raportu (DRAFT/REVIEW/APPROVED) + auto‑versioning na zmianach statusu,
    - wersje:
      - create version (manual),
      - rollback (guardrailed).
  - Export/Share (MUST):
    - eksport:
      - PDF (MUST) — profesjonalne formatowanie, paginacja, cover/headers/footers,
      - DOCX (MUST) — do klienta, który “musi mieć Worda”,
      - PPTX (optional w V2) — tylko dla reportów “slide‑style” (spięcie z T058/T059/T027),
    - share:
      - public link + hasło + expiry (reuse istniejących mechanizmów),
      - branding on/off (enterprise policy).
  - Styling / templates (MUST):
    - spójność z report templates:
      - `report_builder_templates` jako baza sekcji i prompt hints,
    - theme + brand kit:
      - primary/accent colors, logo, footer mode (w UI macie `SettingsPanel`),
      - 6 języków ustawień/report intent (EN/PL/DE/ES/AR/JP) jak w obecnym panelu.
  - Premium graphics bar (MUST):
    - raport ma wyglądać jak consulting deliverable:
      - spójna typografia, nagłówki, whitespace,
      - tabele/wykresy/macierze/heatmapy w standardzie “prezentowalne”,
      - wykresy i liczby zawsze z podpisem i źródłem (source tag),
      - brak “ścian tekstu”: preferować wizualne bloki (KPI tiles, portfolio tables, roadmap bands, risk tables),
    - quality gates dla eksportu:
      - brak pustych enabled sekcji,
      - brak “TBD” w krytycznych miejscach (np. executive summary) jeśli raport ma status APPROVED (TBD policy).
- OUT:
  - Pełny WYSIWYG jak w Word (pixel-perfect edycja) w V2.
  - “Generowanie w ciemno” bez struktury i bez kontroli jakości.
- Future enhancements (post‑V2):
  - Inline WYSIWYG dla wybranych bloków (limited) + track changes.
  - Zaawansowane citations enforcement + evidence bundles (attachments).
  - Smart “consistency checker” (czy rekomendacje mają owners/KPI/ROI).

**UX / UI notes:**
- To ma być “kontrolowany generator”, nie “magic button”:
  - user zawsze widzi strukturę i kolejność,
  - user kontroluje prompt per sekcja,
  - user generuje iteracyjnie, sekcja po sekcji.
- “Premium readability”: czyste nagłówki, whitespace, spójne style tabel i calloutów.
 - Agent mode ma być “jak w Gamma”:
   - user mówi: “przestaw układ / skróć / dodaj rozdział finance / przenieś rekomendacje na górę”
   - agent pokazuje diff i stosuje zmiany.

**Data / integrations:**
- Backend: `report-builder.routes.ts`, `ReportBuilderService`, komentarze, wersje, export.
- Templates: `report_builder_templates` (seedowane, m.in. DRD/SIRI/ADMA/TOOL/INTERVIEW).
- Eksport PPTX: jeśli używamy — pipeline PPTX (T058/T059) lub report export service.

**Security / compliance:**
- RBAC: dostęp do raportu dziedziczy dostęp do źródła (assessment/tool/project).
- Public share tylko jeśli dozwolone; zawsze audyt.
- PII/finanse: redakcja/guardrails w promptach (TBD).

**Analytics (events/metrics):**
- `report_builder_opened`
- `report_section_added` / `report_section_reordered`
- `report_section_generated` / `regenerated`
- `report_exported` (pdf|docx|pptx)
- `report_shared`

**Risks:**
- Formatowanie i paginacja PDF → trzeba trzymać “business-grade” standard.
- Brakujące dane → generator musi oznaczać luki, nie halucynować.
- Długie raporty → performance + chapter navigation.

**Open questions:**
- Czy w V2 default export to PDF+DOCX zawsze, czy zależnie od template?
- Jak mocno egzekwujemy citations w V2 (requireCitations vs “soft guidance”)?

**Definition of Done (DoD):**
- Użytkownik generuje raport z wybranych sekcji/bloków, raport ma spójną strukturę (chapters + kolejność + preset).
- Użytkownik może iteracyjnie generować/regenrować sekcje i zrobić review z komentarzami i wersjami.
- Eksport PDF/DOCX działa i jest **akceptowalny jako deliverable** (bez ręcznego “składania”).
- Raport może prezentować treści z całej aplikacji (linked blocks) w sposób spójny i udokumentowany (source tags).
- Agent mode potrafi zmienić strukturę/ustawienia raportu na podstawie rozmowy i utrzymuje audyt/wersje.

**Acceptance / test plan:**
- Test: raport DRD board pack → wygenerowany, przechodzi review, export PDF ma paginację i spójne style.
- Test: edycja kolejności sekcji + customPrompt → sekcja oznaczona “needs regeneration” i poprawnie regeneruje.
- Test: report agent:
  - komenda: “Przenieś Recommendations przed Analysis, dodaj KPI Dashboard, skróć Executive Summary do short” → agent pokazuje diff i stosuje zmiany; bloki oznaczone “needs regeneration”.
- Test: “everything-in-app report”:
  - raport łączy: initiative portfolio + RAID + budżet + KPI + valuation summary + next steps → export PDF/DOCX działa i source tags prowadzą do artefaktów.

**Rollout plan:**
- Najpierw stabilizacja flow + export PDF/DOCX, potem mocniejsze quality gates i lepsze templates coverage.

---

## T061 — 🟣 reports — Standardized Business Report Templates (business-grade library, use-case presets)
- Status spec: draft
- Link / ID (ClickUp): TBD
- Epic: (Templates library for T060) TBD
- Priorytet / V2 scope: V2

**Business challenge (problem):**
Powtarzalna jakość dokumentów i szybkość generowania wymagają szablonów. Bez template’ów każdy raport jest “projektem”, co psuje skalowanie i premium UX.

**Cel (outcome, nie feature):**
Użytkownik wybiera template, a raport generuje się w spójnej strukturze:
- executive‑ready,
- kompatybilnej z danymi (assessment/tools/finance/roadmap),
- gotowej do eksportu (PDF/DOCX),
z minimalną liczbą ręcznych poprawek.

**Użytkownicy i scenariusze:**
- Konsultant: wybiera “Assessment Summary” → raport w 15 min.
- PMO: wybiera “Steering Committee Brief” → cykliczny deliverable.
- CFO: wybiera “Financial Analysis & Valuation Pack” → pakiet do board/VC.

**Scope (V2)**
- IN:
  - Library of standard templates (MUST):
    - 4–8 kanonicznych template’ów biznesowych, minimum:
      - Strategic Review / Executive Brief,
      - Assessment Summary (DRD/SIRI/ADMA),
      - Transformation Roadmap & Portfolio,
      - Financial Analysis (statements + ratios + insights),
      - Valuation Pack (summary + sensitivity + disclaimers),
      - Steering Committee / Program Update,
      - Tool Workshop Summary (T019–T021 outputs),
    - każdy template definiuje:
      - sekcje/bloki + kolejność + chapters,
      - default length/style per sekcja,
      - prompt hints (“co ma być w środku”),
      - quality rules (required blocks).
  - Template selection UX (MUST):
    - picker modal: karta template + opis + dla kogo + expected length,
    - “preview outline” przed startem,
    - “apply template” do ReportBuilder (T060).
  - Template governance (MUST):
    - system templates (read‑only) + możliwość klonowania do org (jak w T059),
    - template versioning (TBD) i audit zmian.
  - Compatibility & fallbacks (MUST):
    - jeśli brakuje danych do sekcji:
      - sekcja pokazuje “missing data” i sugestię (co dodać),
      - nie halucynuje.
- OUT:
  - Pełny WYSIWYG editor template’ów (pixel-level) w V2.
- Future enhancements (post‑V2):
  - Template editor dla advanced użytkowników (guardrailed) + marketplace.
  - Auto-learning: które template’y mają najlepszy feedback.

**UX / UI notes:**
- Template’y muszą być “business-grade”: czytelne, krótkie, z closure i next steps.

**Data / integrations:**
- Reuse `report_builder_templates` (już seedowane) jako system templates.
- Integracja z T060 (ReportBuilder) i T027 (report/presentation exports).

**Security / compliance:**
- Valuation/finance templates zawsze dodają disclaimers.

**Analytics (events/metrics):**
- `report_template_selected` (templateId)
- `report_template_applied`
- KPI: adoption template’ów, mniej ręcznych poprawek.

**Risks:**
- Zbyt wiele template’ów → chaos; V2 trzyma małą bibliotekę “canonical”.

**Open questions:**
- Które 4 template’y są MUST na start V2 (jeśli chcemy minimalny zestaw)?

**Definition of Done (DoD):**
- Użytkownik wybiera template i raport generuje się w spójnej strukturze.
- Template’y są business-grade i gotowe do eksportu (PDF/DOCX) bez naprawy układu.

**Acceptance / test plan:**
- Test: wybór template “Financial Analysis” → raport ma sekcje statements/ratios/insights/next steps; export PDF/DOCX działa.
- Test: template “Tool Workshop Summary” → raport zawiera closure + inicjatywy wygenerowane z tool outputs.

**Rollout plan:**
- Najpierw 4–5 canonical templates, potem rozbudowa biblioteki.

---

## T062 — 🟣 reports — Automated Recurring and Event‑Triggered Reporting (time‑based + triggers → report/deck + send)
- Status spec: draft
- Link / ID (ClickUp): TBD
- Epic: (Reporting automation / Stakeholder cadence) TBD
- Priorytet / V2 scope: V2

**Business challenge (problem):**
Stakeholder communication i governance wymagają rytmu. Jeśli raporty/prezentacje są robione ręcznie:
- powstają za późno,
- są niespójne,
- a kluczowe sygnały (delay/risk/budget) nie trafiają na czas do sponsora.
Potrzebujemy automatu, który **o określonym czasie** albo **po triggerze** tworzy i dystrybuuje deliverable.

**Cel (outcome, nie feature):**
System automatycznie:
- generuje raport (PDF/DOCX) lub prezentację (PPTX) z wybranego template,
- w oparciu o wskazany scope (projekt/portfolio/inicjatywa),
- i wysyła/udostępnia do zdefiniowanych odbiorców,
z historią wykonań, kontrolą uprawnień i anti‑spam.

**Użytkownicy i scenariusze:**
- PMO: weekly steering report dla sponsorów (time‑based).
- Sponsor: dostaje “exception report” gdy:
  - delay signal critical (T041),
  - risk spike high/critical (T040),
  - overspend risk threshold (T042),
  - stage‑gate transition / approval (T033) (TBD).
- Konsultant: po zakończeniu workshopu toolowego (T019–T021) system generuje “Workshop Summary” deck i wysyła do klienta.

**Scope (V2)**
- IN:
  - Schedule definitions (MUST):
    - time‑based:
      - daily/weekly/biweekly/monthly/quarterly + custom cron,
      - timezone,
    - event‑triggered:
      - definicja triggerów + warunków (rules):
        - delay threshold exceeded (np. plannedEnd overdue),
        - risk item created/high severity (RAID),
        - budget consumption threshold (80/90/100),
        - milestone reached / stage‑gate changed (TBD),
        - “new approved artifact” (np. assessment APPROVED → report).
      - throttling per trigger (np. max 1/24h per project per trigger type).
  - Deliverable type (MUST):
    - per schedule wybór:
      - **report**: PDF/DOCX generowany przez Report Builder (T060) + template (T061),
      - **presentation**: PPTX generowany przez Presentation Generator (T058) + template (T059),
    - możliwość generowania obu (np. PDF + PPTX) (TBD; V2 baseline = wybór 1 lub 2).
  - Template + scope binding (MUST):
    - schedule wskazuje:
      - templateId,
      - scope: org/portfolio/project/initiative,
      - source filters: “only approved artifacts” (rekomendowane).
  - Recipients & delivery (MUST):
    - recipients:
      - lista userIds i/lub emails (zależnie od polityki),
      - role-based groups (np. sponsors, PMO) (TBD minimal),
    - delivery channels:
      - in‑app notification (MUST),
      - email (MUST, jeśli skonfigurowany provider),
      - public share link (optional, z hasłem/expiry),
      - webhook/storage (optional; w kodzie jest `DeliveryMethod` — V2 może wspierać jako advanced).
  - Execution history & audit (MUST):
    - lista wykonań:
      - status (pending/running/success/failed),
      - timestamps,
      - link do wygenerowanego reportId/presentationId,
      - delivery results per kanał,
      - error details (bez sekretów).
    - pełny audit:
      - kto stworzył schedule,
      - kto zmienił config,
      - kto dodał recipients.
  - UI (MUST):
    - widok “Reporting Automation”:
      - lista schedule + status + next run + last run,
      - create/edit/pause/resume,
      - execution history,
      - test run (manual “Run now”).
  - Implementation baseline (grounded w istniejącym systemie) (MUST):
    - wykorzystać istniejące:
      - `scheduledReportService` + `scheduled-reports.routes.ts`,
      - Scheduler cron job (V2: realna implementacja `processScheduledReports`, nie no‑op),
    - dodać warstwę trigger evaluation:
      - V2 baseline: periodic evaluation job (np. co 15–60 min) skanujący sygnały i odpalający generację,
      - post‑V2: event bus/stream dla near‑real‑time.
- OUT:
  - Zaawansowane workflow automations i pełna personalizacja treści per odbiorca (V2).
- Future enhancements (post‑V2):
  - Per‑recipient personalization (język, rola, skrót vs szczegóły).
  - Smart batching: łączenie wielu triggerów w jeden “exception digest”.
  - Real‑time triggers (webhook/event bus) zamiast skanowania.

**UX / UI notes:**
- Użytkownik ma czuć kontrolę:
  - jasne “dlaczego raport został wysłany” (trigger reason),
  - łatwo wyciszyć (snooze/pause) i ustawić progi.

**Data / integrations:**
- Triggery wykorzystują sygnały z:
  - T041 (delay signals),
  - T040 (risk signals/RAID),
  - T042 (budget/overspend),
  - T033 (stage-gate) (TBD),
  - status reports / execution metrics (jeśli istnieją).
- Generator:
  - report = T060/T061,
  - deck = T058/T059.

**Security / compliance:**
- Permissions:
  - schedule może generować tylko z artefaktów, do których owner schedule ma dostęp,
  - recipients nie mogą dostać danych, do których nie mają uprawnień (MUST enforcement).
- Email deliverability + opt‑out polityki (TBD).

**Analytics (events/metrics):**
- `report_schedule_created` / `updated` / `paused`
- `report_schedule_trigger_fired` (type, scope)
- `report_schedule_run_completed` (success/fail, deliverableType)
- `report_schedule_delivery_sent` / `failed`

**Risks:**
- Noise (za dużo raportów) → throttling + batching + sensible defaults.
- Błędy eksportu → retry policy + fallback (np. public link zamiast attachment) (TBD).
- Uprawnienia i wycieki → twarde RBAC i audyt.

**Open questions:**
- Jakie triggery są MUST na start V2 (top 3): delay critical, risk high/critical, budget 90%?

**Definition of Done (DoD):**
- Można skonfigurować schedule time‑based oraz trigger‑based.
- System generuje raport lub prezentację z template i dostarcza do odbiorców (in‑app + email) z historią wykonań.
- Throttling działa (brak spamu), a “reason” triggera jest widoczny.

**Acceptance / test plan:**
- Test: weekly steering report (time‑based) → generacja + email + historia execution.
- Test: delay signal critical → trigger fires → exception report/deck → wysyłka tylko raz/24h.
- Test: brak uprawnień u recipient → system nie wysyła (lub wysyła wersję redacted) (TBD policy).

**Rollout plan:**
- Najpierw time‑based + manual “Run now”, potem trigger‑based (delay/risk/budget) z throttlingiem.

---

## T063 — 🔵 organization — Organization Module – UX and Visual Redesign (premium IA + visual consistency + conversion-ready)
- Status spec: draft
- Link / ID (ClickUp): TBD
- Epic: Organization experience (Context + Admin surfaces) TBD
- Priorytet / V2 scope: V2

**Business challenge (problem):**
Moduł Organization jest dziś rozproszony na kilka miejsc (context vs settings vs admin). Skutek:
- trudno “zrozumieć gdzie co jest” (niska nawigowalność),
- UX jest niespójny względem standardów platformy (spada wiarygodność),
- krytyczne obszary konwersji (billing/limits/domains) są trudniejsze w obsłudze.

**Cel (outcome, nie feature):**
Organization to jedno, spójne, premium doświadczenie:
- klarowna architektura informacji (IA) i nawigacja,
- spójny visual language zgodny z `docs/ui-standards/`,
- szybkie dojście do: profilu firmy, członków/rol, limitów, domen, billing/tokenów.

**Użytkownicy i scenariusze:**
- Owner/Admin: konfiguruje org (branding, domeny, limity, ownership), zaprasza ludzi, przechodzi trial → paid.
- Konsultant: uzupełnia “Company context” (profile/goals/challenges/strategy) jako podstawa pracy AI i deliverables.
- Member/Viewer: przegląda podstawowe informacje, bez dostępu do admin‑sekcji.

**Scope (V2)**
- IN:
  - Information architecture (MUST):
    - jeden logiczny “Organization workspace” z dwoma grupami:
      - **Context (business)**: profile/goals/challenges/megatrends/strategy (obecne `/organization/*`),
      - **Administration (operational)**: members/roles/invitations, billing & tokens, limits, approved domains, ownership, branding/regional (obecne `/settings/organization` i `/admin/organization`),
    - role-gated sekcje: admin widzi całość, member widzi tylko Context + ograniczone “Members (read-only)” (TBD).
  - Navigation redesign (MUST):
    - spójny left nav z grupami (Context / Admin),
    - stabilne deep linki (URL per sekcja),
    - mobile: drawer + sticky header, zgodnie z “Tech Sexy” (monochromatic chrome).
  - Presentation style: N‑style first (MUST):
    - **N‑style = page‑first, czytelny canvas, sekcje jako “blocks”, bez legacy accordion UX**,
    - organizacja treści ma prowadzić użytkownika “od sensu do detalu”:
      - summary/next steps above-the-fold,
      - dalej logiczne bloki (nie lista zwijanych nagłówków),
    - zakaz używania “starego D‑mode” wzorca w Organization (collapsible sections jako domyślny pattern) — V2 ma być czytelny i spokojny wizualnie.
  - Visual redesign (MUST):
    - pełna zgodność z `docs/ui-standards/README.md` (v2.0 Tech Sexy):
      - invisible borders, monochromatic chrome, outline icons,
      - typografia jako hierarchia (semibold, nie “border heavy”),
    - ujednolicenie kart/sekcji/empty states pod wspólne building blocks:
      - `Callout`, `ToggleBlock`, `EmptyStateInline`, `InlineTable`, `ChecklistBlock`, `EmbeddedView`.
  - “Conversion-ready” organization admin (MUST):
    - Billing/Trial/Tokens: czytelny status, limit/usage, klarowne CTA,
    - Limits: jasne powody ograniczeń + ścieżka upgrade,
    - Domains/Ownership: zrozumiałe flow, walidacje, komunikaty błędów.
  - i18n & content cleanup (MUST):
    - brak “hardcoded English” w UI; minimum PL+EN via `useTranslation` (V2),
    - przygotowanie pod 6 języków (postępowe uzupełnianie kluczy).
  - UX quality gates (MUST):
    - above-the-fold: zawsze 1–2 linie “co tu jest” + “next action” (jeśli admin),
    - brak “scroll jail”: logiczne sekcje, sticky tylko tam gdzie sensowne.
- OUT:
  - Rework modelu danych organizacji (V2).
  - Pełna przebudowa permissions/RBAC (tylko jeśli blokuje UX).
- Future enhancements (post‑V2):
  - “Org health” dashboard (adoption, security posture, spend insights).
  - Self-serve org setup checklist + guided tour.

**UX / UI notes (grounded w codebase):**
- Obecne powierzchnie do ujednolicenia:
  - `/organization/*` (`src/views/OrganizationView.tsx` + `OrganizationSidebar.tsx`) — Context,
  - `/settings/organization` (`src/components/settings/OrganizationSettings.tsx`) — Members/Billing/Tokens,
  - `/admin/organization` (m.in. `src/views/admin/OrganizationProfileView.tsx`) — Branding/Domain/Regional,
- V2 kończy z poczuciem “3 różnych ekranów o firmie”.
- Wymóg nadrzędny UX: **czytelność i przejrzystość** → N‑style layout + N blocks kit (spójne z UI standards), bez “D‑mode accordion feel”.

**Security / compliance:**
- Admin-only sekcje muszą mieć twarde bramki (UI + API).
- Wrażliwe akcje (ownership transfer, domains, billing) → dodatkowe potwierdzenia i audit (tam gdzie istnieje).

**Analytics (events/metrics):**
- `org_workspace_opened` (section)
- `org_admin_cta_clicked` (billing_activate/upgrade/limits_view)
- `org_member_invite_sent`
- KPI: time-to-find (self reported), spadek ticketów “where is X”, wzrost conversion trial→paid.

**Risks:**
- Rozsypanie routingu / linków → potrzebny redirect/compat layer (TBD).
- Zbyt szeroki zakres UI refactor → w V2 fokus na IA + top 5 ekrany.

**Open questions:**
- Które “Admin” sekcje są MUST w nowej nawigacji V2:
  - Billing/Tokens, Members, Limits, Domains, Branding? (proponuję te 5)

**Definition of Done (DoD):**
- Użytkownik ma jedno spójne miejsce “Organization”, z klarowną nawigacją i spójnym wyglądem.
- Najważniejsze ścieżki (Members, Billing/Tokens, Limits, Domains, Branding/Regional + Context) są premium, czytelne i zgodne z UI standards.
- PL+EN pokryte w tych ekranach (bez hardcoded copy).

**Acceptance / test plan:**
- Test: Owner wchodzi w Organization → w 10–20 sekund znajduje: Members, Billing/Tokens, Limits, Domains, Branding oraz Context.
- Test: Member nie widzi sekcji admin; link direct → Access blocked / read-only zgodnie z polityką.
- Test: Trial org → wyraźny status/usage + CTA upgrade; bez niespójnych komunikatów.

**Rollout plan:**
- Najpierw IA + nav + “top 5 admin screens”, potem dopieszczanie pozostałych sekcji i copy/i18n.

---

## T064 — 🔵 organization — Relocation of Megatrend Analysis (canonical: Tools → Strategy, zero feature loss)
- Status spec: draft
- Link / ID (ClickUp): TBD
- Epic: Strategy tools IA & navigation coherence TBD
- Priorytet / V2 scope: V2

**Business challenge (problem):**
Megatrendy są analizą strategiczną, ale gdy są “ukryte” w kontekście/organization, użytkownik nie znajduje ich tam, gdzie szuka narzędzi strategicznych. Dodatkowo istnieje ryzyko duplikacji (ContextBuilder vs Organization).

**Cel (outcome, nie feature):**
Megatrend Analysis ma **jedno kanoniczne miejsce** w aplikacji: **Tools → Strategy**, a:
- dotychczasowe wejścia (ContextBuilder/Organization) nadal działają (redirect/alias),
- funkcja nie traci możliwości ani danych,
- architektura produktu jest spójna i przewidywalna.

**Użytkownicy i scenariusze:**
- Strateg/consultant: “robię analizę megatrendów” → idzie do Tools → Strategy i widzi Megatrends.
- Owner: ma linki historyczne / zakładki → nadal działają.
- PMO: korzysta z wyników w reportach/presentations (T060/T058).

**Scope (V2)**
- IN:
  - Canonical placement (MUST):
    - dodać “Megatrends” jako element w **Discovery Tools → Strategic**:
      - jako osobny “workspace/tool card” albo osobny route wewnątrz strategic tools,
      - entry widoczny i opisany (dla czego, jaki output).
  - One implementation, many entrypoints (MUST):
    - wyodrębnić wspólny komponent “Megatrends workspace” (refactor-only),
    - reużywać go w:
      - Tools → Strategy (canonical),
      - Organization → Context (opcjonalnie jako embed lub link do canonical).
  - Routing & redirects (MUST):
    - nowy canonical URL (TBD w implementacji) np.:
      - `/discovery-tools/strategic/megatrends` **lub**
      - `/discovery-tools/strategic?tool=megatrends`,
    - stare URL-e:
      - `/context/megatrends`
      - `/organization/megatrends`
      obsłużone poprzez:
      - redirect (preferowane) albo wyraźny “moved” banner + przycisk “Open in Strategy Tools”.
  - Navigation updates (MUST):
    - aktualizacja sidebar/menu, żeby “Megatrends” było spójnie w Tools/Strategy,
    - usunięcie “dublowania” w miejscach, gdzie powoduje chaos (TBD: w Organization zostaje jako link/short-cut, nie drugi pełny moduł).
  - Documentation & references (MUST):
    - update docs i wszelkich linków wewnętrznych w aplikacji (help/tooltips) pod nową lokalizację.
  - UX standard (MUST):
    - wejście w megatrendy w Tools ma wyglądać jak reszta Tools (ModuleHub / N-style, zgodnie z `docs/ui-standards/`),
    - nie wprowadzać nowego “starego D” patternu.
- OUT:
  - Rozbudowa samej analizy megatrendów (feature expansion) — post‑V2.
- Future enhancements (post‑V2):
  - Megatrends → auto-linkowanie do inicjatyw/risks (semi‑auto suggestions).
  - Megatrends → eksport bezpośrednio do deck/report (one click).

**UX / UI notes (grounded w codebase):**
- Obecnie Megatrends używa `MegatrendScannerModule` i jest renderowane w:
  - `src/views/ContextBuilder/ContextBuilderView.tsx` (section `megatrends`)
  - `src/views/OrganizationView.tsx` (section `megatrends`)
- V2: “source of truth” w Tools/Strategy, bez kopiowania logiki i store.

**Analytics (events/metrics):**
- `megatrends_opened` (source: tools|organization|context_redirect)
- `megatrends_redirect_used` (fromRoute)
- KPI: wzrost użycia po relokacji + spadek “where is megatrends” feedback.

**Risks:**
- Broken links (bookmarki, raporty) → redirect + testy e2e.
- Rozjazd nawigacji → jasne “canonical location” + jeden entrypoint w menu.

**Open questions:**
- W Organization: megatrends ma być:
  - (A) embedded (ten sam workspace w ramce),
  - (B) link do Tools/Strategy (preferred dla spójności),
  - (C) oba (raczej nie, bo dubluje)?

**Definition of Done (DoD):**
- Megatrends są dostępne w Tools → Strategy (kanonicznie) bez utraty funkcji.
- Stare linki działają (redirect lub moved banner) i nie ma dead-endów.
- Nie ma duplikacji logiki: jeden workspace/component.

**Acceptance / test plan:**
- Test: user wchodzi na `/context/megatrends` → trafia do canonical megatrends w Tools (redirect) i widzi te same dane.
- Test: menu Tools → Strategy zawiera Megatrends i otwiera workspace.
- Test: brak regresji w Organization/Context (jeśli pozostaje shortcut).

**Rollout plan:**
- Najpierw canonical route + redirects, potem cleanup linków i docs.

---

## T065 — 🟢 team — Change Team Management – Competency Identification (taxonomy + requirements → initiatives)
- Status spec: draft
- Link / ID (ClickUp): TBD
- Epic: Capability model foundation (for T043/T066/T067) TBD
- Priorytet / V2 scope: V2

**Business challenge (problem):**
Nie da się realnie planować składu “change team” i dowożenia inicjatyw bez:
- zdefiniowania **jakie kompetencje** są potrzebne,
- powiązania ich z pracą (initiative/task),
- oraz późniejszej analizy luk (T066).

**Cel (outcome, nie feature):**
Organization ma spójną, edytowalną taksonomię kompetencji (skills/capabilities) oraz możliwość oznaczania inicjatyw wymaganiami kompetencyjnymi — jako fundament do dopasowania zasobów (T043) i gap analysis (T066/67).

**Użytkownicy i scenariusze:**
- PMO/HR/Admin: definiuje katalog kompetencji (kategorie, poziomy) i standardy.
- Initiative Owner/PMO: przypisuje wymagane kompetencje do inicjatywy (requirements).
- Konsultant: widzi “co jest potrzebne” i buduje realistyczny plan obsady.

**Scope (V2)**
- IN:
  - One canonical competency model (MUST):
    - jeden model danych używany przez:
      - T043 (capability alignment / matching),
      - T066 (skills gap),
      - T067 (matching/allocations),
    - brak “drugiego równoległego słownika” w innych modułach.
  - Competency taxonomy (MUST):
    - kategorie (np. Strategy, Operations, Digital, Change, Finance),
    - kompetencje w kategoriach,
    - poziomy/skalowanie (np. 1–5 lub novice→expert) + opis poziomów.
    - org‑specific extensions (dodawanie własnych kompetencji) + soft governance (kto może edytować).
  - Initiative requirements mapping (MUST):
    - możliwość dodania do inicjatywy listy wymaganych kompetencji:
      - kompetencja,
      - minimalny poziom,
      - liczba osób/FTE (opcjonalnie),
      - krytyczność (must‑have / nice‑to‑have),
      - uzasadnienie (krótko).
    - minimalny UX: “Add requirement” + tabela requirements (InlineTable).
  - Admin UX (N‑style, readability-first) (MUST):
    - ekran “Competency Catalog” w Admin/Team (lub analogicznym miejscu):
      - lista kategorii,
      - wyszukiwanie,
      - CRUD kompetencji,
      - definicja poziomów,
      - “usage” (w ilu inicjatywach kompetencja występuje) — jeśli proste.
    - UX bez legacy “D‑mode accordion”.
  - Permissions (MUST):
    - edycja katalogu tylko dla admin/HR/PMO (TBD role policy),
    - edycja requirements na inicjatywie zgodnie z permissions inicjatywy.
  - i18n (MUST):
    - nazwy systemowe kategorii/poziomów mają PL/EN,
    - org custom competencies: w V2 mogą być single-language (owner input) z opcją “EN label” (TBD).
- OUT:
  - Pełny “HR competency framework dla całej firmy” (performance review, learning paths, budżety szkoleń).
  - Automatyczne wnioskowanie kompetencji z CV (to T067).
- Future enhancements (post‑V2):
  - AI suggestions: proponuj kompetencje do inicjatywy na bazie opisu i historii.
  - Skill evidence (certyfikaty, projekty) i walidacja.

**Data / integrations (implementation-ready):**
- Nowe encje (nazwy robocze):
  - `competency_categories`
  - `competencies`
  - `competency_levels` (lub levels per org)
  - `initiative_competency_requirements`
  - (konsumowane dalej) `user_competencies` (T043/T067)
- Integracja:
  - Initiative UI: sekcja “Requirements / Competencies” (w Initiative detail, N‑style),
  - Admin UI: katalog i governance.

**UX / UI notes:**
- “Readability-first”:
  - above-the-fold: krótki opis + CTA “Add competency” / “Add requirement”
  - wymagania inicjatywy jako tabela + szybkie “missing” callout, gdy brak requirements.

**Analytics (events/metrics):**
- `competency_created` / `updated` / `deleted`
- `initiative_requirement_added` / `removed`
- KPI: % inicjatyw z wymaganiami kompetencji; spadek “missing skill surprises”.

**Risks:**
- Taksonomia: zbyt szczegółowa → chaos. V2: mały, kanoniczny katalog + org extensions.
- Spójność z CV/gap: musi używać tych samych kluczy kompetencji (ID-based, nie free-text).

**Open questions:**
- Skala poziomów: 1–5 vs novice/expert — w V2 proponuję 1–5 + opis.
- Minimalny zestaw kategorii systemowych (5–7) — do ustalenia.

**Definition of Done (DoD):**
- Da się zdefiniować katalog kompetencji (kategorie + kompetencje + poziomy) w org.
- Da się powiązać kompetencje jako requirements na inicjatywach.
- Te same dane są gotowe do wykorzystania w T043/T066/T067 (jeden model).

**Acceptance / test plan:**
- Test: Admin tworzy kategorię i 3 kompetencje + skala 1–5.
- Test: Initiative Owner dodaje 2 requirements do inicjatywy (must-have vs nice-to-have).
- Test: lista kompetencji pokazuje “usage count” (jeśli wdrożone) i nie ma duplikatów.

**Rollout plan:**
- Najpierw katalog + requirements na inicjatywach, potem integracja z matching/gap (T043/T066/67).

---

## T066 — 🟢 team — Skills Gap Analysis Module (requirements → availability → gaps → actions)
- Status spec: draft
- Link / ID (ClickUp): TBD
- Epic: Capability alignment (T043) + change team readiness TBD
- Priorytet / V2 scope: V2

**Business challenge (problem):**
Plan transformacji bez gap analizy kompetencji jest nierealistyczny: inicjatywy startują bez krytycznych kompetencji, a braki wychodzą dopiero w execution (koszt, opóźnienia, frustracja).

**Cel (outcome, nie feature):**
System pokazuje luki kompetencyjne dla:
- pojedynczej inicjatywy,
- projektu/portfolio,
i prowadzi użytkownika od “brak” → “co z tym zrobić” (rekrutacja, szkolenie, vendor, resekwencjonowanie).

**Wymagane powiązania (must be consistent):**
- Requirements pochodzą z T065 (initiative competency requirements).
- Availability bazuje na:
  - manualnie zdefiniowanych kompetencjach użytkowników (T043/T067),
  - roli/funkcji w projekcie (pomocniczo),
  - oraz “unknown coverage” (system musi uczciwie pokazać brak danych).

**Użytkownicy i scenariusze:**
- PMO: sprawdza readiness projektu → widzi top 10 gaps i ryzyko delivery.
- HR: dostaje listę kompetencji do pozyskania (rekrutacja/szkolenie) z priorytetem.
- Initiative Owner: widzi “must-have gaps” i może:
  - poprosić o alokację,
  - przesunąć start,
  - stworzyć initiative “Enablement/Training”.

**Scope (V2)**
- IN:
  - Gap computation (MUST):
    - dla każdej inicjatywy:
      - required competency + level (+ opcjonalnie headcount/FTE),
      - available supply w zespole (przypisani członkowie projektu + pool org) (TBD),
      - wynik: status (covered / partial / missing / unknown).
    - agregacja na projekt/portfolio: heatmap i ranking braków.
  - UX (N‑style, readability-first) (MUST):
    - widok “Skills Gap” z trzema perspektywami:
      - by initiative,
      - by competency,
      - by person (co mamy / czego brakuje),
    - “unknown coverage” jako 1. klasa (Callout): “Nie mamy danych o kompetencjach X osób”.
  - Actionability (MUST):
    - z luki można utworzyć:
      - task (np. “Find SME for X”),
      - initiative “Enablement/Training”,
      - request do HR (ticket) (TBD minimal = task + label).
    - rekomendacje (heurystyczne, nie halucynacje):
      - hire / train / outsource / resequence.
  - Permissions (MUST):
    - tylko uprawnieni widzą kompetencje osób (wrażliwe),
    - wyniki agregowane mogą być widoczne szerzej (TBD polityka).
  - i18n (MUST): PL+EN dla UI.
- OUT:
  - Pełne planowanie szkoleń (budżety, ścieżki, certyfikacje).
  - Automatyczne skanowanie prywatnych komunikacji w celu oceny skills (zakazane).
- Future enhancements (post‑V2):
  - AI co-pilot do zamykania luk (plan działania, timeline, koszty).
  - Integracja z zewnętrznym HRIS/ATS.

**Data / integrations:**
- Reads:
  - `initiative_competency_requirements` (T065),
  - `user_competencies` (T043/T067),
  - membership (kto jest w projekcie/initiative) (istniejące project roles).
- Writes:
  - (opcjonalnie) `skills_gap_snapshots` dla historii i trendu (TBD).

**Analytics (events/metrics):**
- `skills_gap_viewed` (scope)
- `skills_gap_action_created` (type: task|initiative)
- KPI: % inicjatyw z covered must-have; spadek opóźnień “z zaskoczenia”.

**Risks:**
- Jakość danych: jeśli user competencies puste → dużo “unknown”. V2 musi to pokazać i prowadzić do uzupełnienia profili.
- Prywatność: skills mogą być wrażliwe → minimalizacja i role gating.

**Open questions:**
- Co jest “pool” availability w V2:
  - tylko zespół projektu, czy cała org? (proponuję: oba, z przełącznikiem)

**Definition of Done (DoD):**
- System pokazuje gaps w kontekście inicjatyw i umożliwia przejście do działań (task/initiative).
- Wyniki są transparentne (skąd supply/demand) i pokazują “unknown coverage”.

**Acceptance / test plan:**
- Test: inicjatywa ma requirement “Lean SME level 4” i nikt w projekcie nie ma → status “missing”, CTA tworzy task “find SME”.
- Test: 30% osób bez profilu kompetencji → system pokazuje Callout “unknown coverage” i link do uzupełnienia.

**Rollout plan:**
- Najpierw gap by initiative + ranking, potem heatmapy i agregacje portfolio.

---

## T067 — 🟢 team — CV‑Based Role and Task Matching Engine (privacy‑safe CV ingestion → competency mapping → explainable ranking)
- Status spec: draft
- Link / ID (ClickUp): TBD
- Epic: Talent signals for capability model (T065/T066/T043) TBD
- Priorytet / V2 scope: V2

**Business challenge (problem):**
Dobór ludzi do ról i zadań w transformacji jest dziś ręczny i podatny na “gut feeling”. CV i opisy doświadczeń to cenne dane, ale bez standaryzacji nie da się ich używać do dopasowania kompetencji do wymagań inicjatyw.

**Cel (outcome, nie feature):**
Użytkownik może:
- wgrać CV (lub profil doświadczeń) kandydata/członka zespołu,
- automatycznie zamapować sygnały z CV na **taksonomię kompetencji** (T065),
- otrzymać **ranking dopasowania** do ról/tasków/initiative requirements z jasnym uzasadnieniem,
z pełną kontrolą prywatności i brakiem automatycznych decyzji (human approval).

**Użytkownicy i scenariusze:**
- HR: wgrywa CV 5 kandydatów → widzi ranking do roli “Workstream Owner – Digital”.
- PMO: ma lukę “Lean SME level 4” → engine proponuje 2 osoby z org + 1 vendor (jeśli dodany) (TBD).
- Initiative Owner: przypina kandydata do roli/tasków po review uzasadnienia.

**Scope (V2)**
- IN:
  - CV ingestion (MUST):
    - upload CV (PDF/DOCX/TXT) + metadane (candidate name/email optional),
    - przechowywanie w systemie z polityką retencji i możliwością usunięcia,
    - status pipeline: uploaded → extracted → mapped → ready.
  - Extraction & normalization (MUST):
    - ekstrakcja tekstu + podstawowa normalizacja (sekcje: experience, skills, education),
    - PII handling:
      - redakcja/ochrona wrażliwych danych w logach i promptach,
      - minimalizacja danych przekazywanych do AI (tylko potrzebne fragmenty).
  - Competency mapping (MUST):
    - mapowanie na `competencies` z T065:
      - competencyId,
      - inferredLevel (1–5) + confidence,
      - evidence snippets (cytaty z CV),
    - zawsze możliwość ręcznej korekty i zatwierdzenia.
  - Matching engine (MUST):
    - wejścia:
      - initiative requirements (T065),
      - role/task requirements (TBD; V2 baseline = initiative requirements),
    - wyjście:
      - ranking kandydatów + score,
      - explainability (dlaczego, na czym oparte),
      - “missing evidence” (co trzeba doprecyzować).
  - UX (N‑style, admin‑grade) (MUST):
    - “Candidates / CV Library” (upload, lista, statusy),
    - “Candidate detail”:
      - extracted summary,
      - mapped competencies table (InlineTable) + edit,
      - matches (top initiatives/roles) + reasoning,
    - akcje:
      - “Apply competencies to user profile” (jeśli to pracownik),
      - “Shortlist” / “Invite”.
  - Guardrails (MUST):
    - brak automatycznego przypisania do roli/tasku bez zatwierdzenia,
    - zakaz inferowania cech chronionych (wiek, płeć, etniczność, zdrowie, religia itp.),
    - jawne disclaimers: “assistive ranking, not a hiring decision”.
- OUT:
  - Pełny ATS i proces rekrutacyjny end‑to‑end.
  - Background checks / scoring behawioralny.
- Future enhancements (post‑V2):
  - Integracja z ATS/HRIS.
  - Interview notes → competency evidence (za zgodą).

**Data / integrations:**
- Nowe encje (nazwy robocze):
  - `candidate_profiles` (lub `talent_profiles`)
  - `candidate_documents` (CV files metadata)
  - `candidate_competency_signals` (mapped results + evidence)
  - `candidate_match_results` (optional cache)
- Integracja z:
  - T065 (competencies registry),
  - T066 (skills gap → suggested candidates),
  - T043 (capability alignment: user profiles).

**Security / compliance (MUST):**
- Consent & governance:
  - jasna informacja o przetwarzaniu CV,
  - możliwość usunięcia (right to be forgotten),
  - audit log dostępu do CV profili.
- Storage:
  - szyfrowanie at-rest, ograniczenie dostępu (RBAC),
  - CV nie może “wyciec” do prompt logs.

**Analytics (events/metrics):**
- `cv_uploaded`
- `cv_extracted`
- `cv_competencies_approved`
- `cv_match_viewed` / `cv_match_applied`
- KPI: skrócenie czasu alokacji; trafność (feedback loop) (TBD).

**Risks:**
- Bias / compliance → twarde guardrails + explainability + human approval.
- Jakość ekstrakcji (różne formaty CV) → fallback do ręcznej edycji.

**Open questions:**
- Czy V2 ma obsłużyć tylko CV osób “z organizacji”, czy też zewnętrznych kandydatów/vendorów? (proponuję: oba, ale z wyraźnym tagiem external)

**Definition of Done (DoD):**
- Można wgrać CV, system wyciąga treść i mapuje kompetencje do T065.
- Można zobaczyć ranking dopasowania do initiative requirements z uzasadnieniem i zastosować (po zatwierdzeniu).
- Privacy/guardrails działają: brak automatycznych decyzji, brak inferencji cech chronionych, audit dostępów.

**Acceptance / test plan:**
- Test: upload 1 CV (PDF) → extracted → mapped (min 5 kompetencji) → manual approve → pojawia się w rekomendacjach do inicjatywy z requirementem.
- Test: CV zawiera dane wrażliwe → nie są one pokazywane w “reasoning” ani logach; system używa tylko fragmentów dot. doświadczenia/skills.

**Rollout plan:**
- Najpierw ingestion + competency mapping, potem matching do initiative requirements, potem integracja z gap view (T066).

---

## T068 — 🟢 onboarding — Onboarding and Platform Introduction System (Help Module) (“first 30 minutes” path)
- Status spec: draft
- Link / ID (ClickUp): TBD
- Epic: Activation & retention foundation TBD
- Priorytet / V2 scope: V2

**Business challenge (problem):**
Platforma jest szeroka. Bez prowadzenia “pierwsze 30 minut” rośnie churn, support i poczucie chaosu (“nie wiem od czego zacząć”).

**Cel (outcome, nie feature):**
Nowy użytkownik ma jasno wytyczoną ścieżkę do pierwszej wartości (time‑to‑first‑value) i może wrócić do onboardingu w dowolnym momencie z poziomu Help.

**Użytkownicy i scenariusze:**
- Owner (trial): chce szybko zrozumieć “co to jest” i “jak to użyć” → przechodzi guided path.
- Konsultant: dostaje skrót “jak prowadzić pierwsze warsztaty / discovery tools”.
- PMO: widzi checklistę “jak uruchomić program transformacji”.

**Scope (V2)**
- IN:
  - Onboarding playbooks in Help (MUST):
    - 3–5 ścieżek (minimum):
      - “First 30 minutes (Owner/Trial)”,
      - “Consultant quickstart”,
      - “PMO quickstart”,
    - każda ścieżka ma:
      - kroki (checklist),
      - linki deep‑link do modułów,
      - krótkie “what you’ll get” + expected time per krok.
  - In‑app entrypoints (MUST):
    - stały entrypoint do Help/onboardingu (floating widget lub side panel),
    - CTA po pierwszym logowaniu: “Start onboarding” (dismissible).
  - Progress tracking (MUST):
    - status kroków per user (not started / in progress / done),
    - “resume where you left off”,
    - event logging (korzysta z istniejących `help_events`).
  - Content standard (MUST):
    - copy premium, krótko, bez “manuala”,
    - N‑style readability: małe bloki, jasne CTA, zero ścian tekstu.
  - i18n (MUST): PL + EN dla “First 30 minutes”; kolejne ścieżki mogą być stopniowo.
- OUT:
  - Pełne kursy/certyfikacje, academy portal.
- Future enhancements (post‑V2):
  - Personalizacja ścieżki na bazie roli i zachowań.
  - Micro‑video per krok (powiązane z T073).

**Data / integrations:**
- Reuse:
  - `help_playbooks` (treści onboardingowe),
  - `help_events` (tracking progress),
  - UI: `FloatingHelpWidget`, `HelpSidePanel`, `GlobalHelpSearch`.

**Analytics (events/metrics):**
- `onboarding_started` / `step_completed` / `onboarding_completed`
- KPI: activation rate, time‑to‑first‑value, spadek pytań support w 1. tygodniu.

**Risks:**
- Utrzymanie aktualności contentu → proces aktualizacji i owners.

**Open questions:**
- Czy “First 30 minutes” ma prowadzić użytkownika do:
  - (A) Tools (szybkie wow),
  - (B) Initiative + Report (wartość biznesowa),
  - (C) Billing upgrade path (konwersja)?
  (V2: rekomenduję A→B, z eleganckim CTA do upgrade, bez agresji.)

**Definition of Done (DoD):**
- Help ma sekcję onboarding, łatwo dostępną.
- Użytkownik ma ścieżkę “First 30 minutes” z checklistą i zapisem postępu.

**Acceptance / test plan:**
- Test: nowy user widzi CTA onboarding, kończy min. 5 kroków, progress zapisany, może wrócić.
- Test: help events logują start i ukończenie kroków.

**Rollout plan:**
- Najpierw 1 ścieżka (Owner/Trial), potem kolejne role.

---

## T069 — 🟢 onboarding — Automated Feature News and Update Communication System (release notes → in‑app + email)
- Status spec: draft
- Link / ID (ClickUp): TBD
- Epic: Product comms & adoption TBD
- Priorytet / V2 scope: V2

**Business challenge (problem):**
Użytkownicy nie wiedzą “co nowe”, więc nie adoptują funkcji. Potrzebujemy lekkiego systemu release notes/news z dystrybucją.

**Cel (outcome, nie feature):**
Admin może opublikować update (news/release note), a użytkownicy dostają go:
- in‑app (notifications + feed),
- opcjonalnie email,
z historią i statusem “seen”.

**Scope (V2)**
- IN:
  - Update publishing (MUST):
    - wpis: title, body (rich text lub markdown), tags (module), importance (low/normal/high),
    - status: draft → published,
    - scheduling (TBD minimal: publish now; post‑V2: scheduled).
  - Distribution (MUST):
    - in‑app notification + “Updates feed” (lista),
    - email (jeśli skonfigurowany provider),
    - throttling/noise: max N / tydzień (TBD).
  - Seen tracking (MUST):
    - “mark as read” per user,
    - analytics open/click.
  - UX (MUST):
    - jedno miejsce “What’s new” (Help/Knowledge/Settings) (TBD, ale jedno),
    - kontekstowe linki do funkcji (“Try it now”).
- OUT:
  - Zaawansowana segmentacja, A/B testing, personalizacja.
- Future enhancements (post‑V2):
  - segmentacja per rola/org plan,
  - “learning nudges” (łączenie z AI nudges).

**Data / integrations:**
- Reuse jeśli możliwe:
  - `help_articles` jako “updates” category lub dedykowana tabela (TBD w implementacji),
  - `notificationService` + email service.

**Analytics (events/metrics):**
- `update_published`
- `update_opened` / `update_clicked`
- KPI: open rate, adoption feature usage po publikacji.

**Definition of Done (DoD):**
- Można opublikować update i dotrze do użytkowników in‑app i/lub email.
- Historia update’ów jest dostępna i można oznaczać jako przeczytane.

**Acceptance / test plan:**
- Test: admin publikuje update → user widzi notification + wpis w “What’s new” i może mark as read.

---

## T070 — 🟡 help — Rewrite Platform Overview Content (Help + Website + Landing Page) (“AI transformation system” narrative)
- Status spec: draft
- Link / ID (ClickUp): TBD
- Epic: Positioning & conversion narrative TBD
- Priorytet / V2 scope: V2

**Business challenge (problem):**
Narracja produktu musi odzwierciedlać to, czym platforma jest naprawdę (system transformacji wspierany AI), a nie być odbierana jako “kolejne PMO narzędzie”. Bez tego spada konwersja na trial i rośnie rozjazd oczekiwań w onboardingu.

**Cel (outcome, nie feature):**
Jedna spójna, premium treść overview, gotowa do użycia w:
- Help,
- website,
- landing page,
bez rozjazdu przekazu i bez obiecywania rzeczy, których nie ma.

**Zakres (V2)**
- IN:
  - Message architecture (MUST):
    - one‑liner + 3 value props,
    - “how it works” (3–5 kroków),
    - “who it’s for” (3 persony),
    - “what you get” (deliverables: reports/decks/initiatives),
    - “why now” (AI + governance + execution),
    - proof points (tylko prawdziwe; jeśli brak → TBD).
  - Channelized variants (MUST):
    - Help version (bardziej instruktażowa),
    - Website/Landing version (bardziej sprzedażowa, ale nadal prawdziwa),
    - spójne słownictwo i claimy.
  - Review & governance (MUST):
    - checklist “no overpromise”,
    - wersjonowanie treści (TBD minimal: doc history w repo).
- OUT:
  - Pełny rebranding strony i design system marketingowy.
- Future enhancements (post‑V2):
  - Video overview (60–90s),
  - case studies library.

**Definition of Done (DoD):**
- Treść jest spójna, premium i opisuje realne capability platformy.
- Da się ją wkleić w 3 kanały bez zmiany sensu i bez sprzeczności.

**Acceptance / test plan:**
- Test: 3 kanały mają tę samą architekturę przekazu i nie zawierają funkcji, których brak w V2.

**Rollout plan:**
- Najpierw Help (onboarding), potem website/landing.

---

## T071 — 🟡 help — Connect Help Documentation to AI Context Engine (docs‑grounded answers + citations + update workflow)
- Status spec: draft
- Link / ID (ClickUp): TBD
- Epic: AI reliability & product truthfulness TBD
- Priorytet / V2 scope: V2

**Business challenge (problem):**
Jeśli AI odpowiada “z głowy” o produkcie, rośnie chaos, brak zaufania i support load. AI musi odpowiadać konsekwentnie **zgodnie z dokumentacją** i w razie braku coverage uczciwie to komunikować.

**Cel (outcome, nie feature):**
AI w Consultify:
- korzysta z Help/Knowledge Base jako źródła prawdy dla pytań “jak działa produkt”,
- cytuje odpowiednie artykuły,
- a gdy docs są niepełne/stare — sygnalizuje brak i proponuje next steps.

**Scope (V2)**
- IN:
  - Retrieval → AI context injection (MUST):
    - dla zapytań “product/how‑to” AI pobiera kontekst z KB i dołącza do promptu,
    - kontekst obejmuje:
      - snippets/excerpts (limitowane znakami),
      - listę citations (KB1/KB2/KB3),
      - “systemInstructionAddon” z regułami korzystania z docs.
    - (grounded w codebase) wykorzystać istniejące `buildHelpDocsContext` (`server/src/services/ai/helpDocsContext.ts`).
  - Citation policy (MUST):
    - jeśli AI odpowiada o workflow/UI zachowaniu:
      - powinno dołączyć cytowanie KB itemów (gdzie to możliwe),
    - jeśli brak dopasowania w docs:
      - AI mówi “docs do not cover this yet” + proponuje “where to look / what to confirm”.
  - Contextual routing (SHOULD, V2 minimal):
    - wsparcie `moduleId` w retrieval (contextual articles),
    - mapowanie aktualnego modułu UI → `moduleId` (foundation pod T072).
  - Quality & safety (MUST):
    - guardrails przeciw halucynacjom product claims,
    - ograniczenia długości snippets (token control),
    - caching (krótki TTL) żeby nie obciążać KB.
  - Docs update workflow (MUST):
    - jasny proces “update docs”:
      - owner doc/sekcji,
      - review (human),
      - publikacja,
    - AI może sugerować “doc gap”, ale nie publikuje automatycznie bez review.
- OUT:
  - Automatyczne pisanie docs przez AI bez review.
- Future enhancements (post‑V2):
  - Doc freshness monitoring + “stale docs” alerts.
  - Doc coverage dashboard (które moduły mają braki).

**Data / integrations:**
- Knowledge base jest źródłem:
  - `KnowledgeBaseService.searchArticles`, `getContextualArticles`, `getArticleBySlug`,
  - linkowanie do `/docs/:category/:slug`.
- AI pipeline:
  - injection do system prompt / tool context,
  - zwrot citations do UI (żeby user mógł kliknąć).

**Analytics (events/metrics):**
- `ai_help_docs_retrieved` (count, moduleId, lang)
- `ai_help_docs_cited` (kbIds)
- KPI: spadek “AI gave wrong product answer”, spadek ticketów support.

**Risks:**
- Stale docs → AI będzie powielać stare info (potrzebny workflow i monitoring).
- Retrieval quality → złe dopasowania; V2 ogranicza scope do top 3–5 artykułów i daje fallback.

**Open questions:**
- Czy citations mają być widoczne w UI jako “Sources” panel zawsze, czy tylko gdy user kliknie? (proponuję: kompaktowy “Sources” chip)

**Definition of Done (DoD):**
- AI odpowiadając o produkcie potrafi odwołać się do KB i cytować.
- Jeśli docs nie pokrywają pytania, AI komunikuje brak coverage zamiast zgadywać.
- Mamy proces aktualizacji docs (kto, jak, kiedy).

**Acceptance / test plan:**
- Test: pytanie “jak wygenerować raport w Report Builder?” → AI zwraca kroki + citations [KB1..KB3].
- Test: pytanie o nieudokumentowaną funkcję → AI mówi, że docs nie pokrywają i wskazuje gdzie sprawdzić / jak doprecyzować.

**Rollout plan:**
- Najpierw AI Chat + Help citations, potem rozszerzenie na inne entrypointy (np. onboarding).

---

## T072 — 🟡 help — Context‑Sensitive Help Navigation (module → docs mapping + deep links)
- Status spec: draft
- Link / ID (ClickUp): TBD
- Epic: Help UX + reduction of friction TBD
- Priorytet / V2 scope: V2

**Business challenge (problem):**
Nawet dobra dokumentacja nie pomaga, jeśli user nie trafia w odpowiednie miejsce. Potrzebujemy kontekstowego Help: “jestem w module X → pokazujesz docs X”.

**Cel (outcome, nie feature):**
Help otwiera się “na właściwej stronie” zależnie od aktualnego modułu, bez gubienia kontekstu pracy użytkownika.

**Scope (V2)**
- IN:
  - Module → docs mapping (MUST):
    - definicja mapowania:
      - route/moduleId → recommended category/article/playbook,
    - fallback: global search / getting started.
  - Entry points (MUST):
    - z każdego modułu szybki entrypoint “Help” (np. widget/panel),
    - “open help” przekazuje `moduleId`.
  - Deep links (MUST):
    - link do konkretnego artykułu/playbooka,
    - możliwość otwarcia w side panel bez zmiany route (preferowane).
  - Maintainability (MUST):
    - mapowanie jako config w repo (łatwo aktualizować),
    - testy (co najmniej sanity) na najważniejsze moduły.
- OUT:
  - Pełna personalizacja per rola i zachowania (post‑V2).

**Data / integrations:**
- Reuse:
  - istniejące komponenty Help (`FloatingHelpWidget`, `HelpSidePanel`, search),
  - `KnowledgeBaseService.getContextualArticles(moduleId, lang, ...)`,
  - T071: `moduleId` w retrieval.

**Analytics (events/metrics):**
- `help_opened` (moduleId)
- `help_contextual_article_opened`
- KPI: spadek global search, szybsze znalezienie odpowiedzi.

**Definition of Done (DoD):**
- Będąc w module X, Help otwiera rekomendowaną dokumentację X.
- Jeśli mapowania brak, user dostaje sensowny fallback (search/getting started).

**Acceptance / test plan:**
- Test: user wchodzi w Assessment/Initiatives/Reports → klik Help → otwiera się właściwa sekcja docs.

---

## T073 — 🟡 help — Contextual Micro‑Video Help System (30–45s micro-learning on first entry)
- Status spec: draft
- Link / ID (ClickUp): TBD
- Epic: Activation & adoption via micro-learning TBD
- Priorytet / V2 scope: V2

**Business challenge (problem):**
Użytkownicy uczą się szybciej z micro materiałów (30–45s) osadzonych w workflow niż z długich instrukcji. Bez tego onboarding jest ciężki.

**Cel (outcome, nie feature):**
Przy pierwszym wejściu do kluczowego modułu user dostaje krótkie wideo “co tu robisz i jakie są 2–3 kluczowe akcje” z opcją pominięcia, a stan “obejrzane” jest pamiętany.

**Scope (V2)**
- IN:
  - Trigger (MUST):
    - “first time in module” (per user),
    - możliwość wyłączenia w settings (TBD minimal: “don’t show again”).
  - Playback UX (MUST):
    - nienachalny modal/popover,
    - autoplay = OFF (żeby nie irytować),
    - CTA: “Watch”, “Skip”, “Don’t show again”.
  - Video registry (MUST):
    - mapowanie moduleId → video URL + title + duration,
    - hosting: zewnętrzny link (np. unlisted) lub internal storage (TBD).
  - Tracking (MUST):
    - view started/completed/skipped,
    - stan per user zapisany (reuse help events lub user prefs).
- OUT:
  - Pełne kursy wideo i learning portal.
- Future enhancements (post‑V2):
  - micro-videos per feature, per role.

**Security / compliance:**
- wideo nie może ujawniać danych klientów; tylko demo content.

**Analytics (events/metrics):**
- `microvideo_prompt_shown` / `started` / `completed` / `skipped`
- KPI: completion rate, activation module usage.

**Definition of Done (DoD):**
- System potrafi pokazać micro-video przy pierwszym wejściu do modułu i zapamiętać stan “seen”.

**Acceptance / test plan:**
- Test: pierwsze wejście do Initiatives → prompt wideo; user skip → nie pokazuje ponownie.

---

## T074 — 🟠 education — Education Module – Platform Fundamentals Series (short, contextual learning library)
- Status spec: draft
- Link / ID (ClickUp): TBD
- Epic: Education & self-serve adoption TBD
- Priorytet / V2 scope: V2

**Business challenge (problem):**
Onboarding (T068) pomaga wejść, ale użytkownicy potrzebują też stałej, łatwej do odkrycia biblioteki “fundamentals” — krótkich materiałów, które budują pewność i samodzielność w użyciu platformy.

**Cel (outcome, nie feature):**
Użytkownik może w każdej chwili:
- wejść do Education → Fundamentals,
- znaleźć 5–12 krótkich materiałów (wideo + “what to do next”),
- odpalić je kontekstowo z modułów (Help/Education entrypoints),
bez szukania po supportach.

**Użytkownicy i scenariusze:**
- Nowy user: “jak działa platforma i gdzie kliknąć” → Fundamentals playlist.
- Użytkownik wracający: “jak wygenerować raport/presentation” → szybki materiał + deep link do funkcji.
- Konsultant: “jak poprowadzić pracę: tools → initiative → report/deck” → struktura ścieżki.

**Scope (V2)**
- IN:
  - Fundamentals series content (MUST):
    - minimum 5 materiałów “platform fundamentals” (PL+EN), np.:
      - Navigation & modules map,
      - Tools → outputs → initiatives,
      - Initiatives & execution basics,
      - Reports (T060) + Presentations (T058) basics,
      - Organization/Admin basics (team/billing),
    - każdy materiał ma:
      - tytuł + opis + duration,
      - “what you will learn” (3 bullet),
      - “do it now” CTA (deep link),
      - tagi (module).
  - Delivery surface (MUST):
    - dostępne w jednym, kanonicznym miejscu:
      - **Knowledge Base / Docs portal** (istnieje `KnowledgeBaseView` / `/docs`),
      - oraz jako wejście “Education” w aplikacji (może otwierać KB na właściwej sekcji).
  - Contextual entrypoints (MUST):
    - integracja z Help widget/panel:
      - “Education: Fundamentals” jako szybki skrót,
    - w modułach: przycisk “Learn” kieruje do właściwego materiału (mapowanie moduleId → video/article).
  - Tracking (MUST):
    - started/completed per user,
    - “resume / continue”,
    - reuse `help_events` (lub analogiczny event store) żeby nie budować drugiego systemu.
  - UX (N‑style, readability-first) (MUST):
    - playlist jako czytelne karty + progress,
    - zero długich ścian tekstu.
  - Content governance (MUST):
    - owner materiałów,
    - zasada aktualizacji: “video must match current product”.
- OUT:
  - Certyfikacja, testy, odznaki.
- Future enhancements (post‑V2):
  - role-based learning paths (PMO/Consultant/CFO),
  - “recommended next video” na bazie zachowań,
  - powiązanie z T069 (news → “learn what changed”).

**Data / integrations (grounded in codebase):**
- Wykorzystać istniejące struktury:
  - `KnowledgeBaseView` ma sekcję “Videos” (`VIDEO_TUTORIALS` w `src/config/videoTutorialsContent.ts`),
  - Help komponenty: `FloatingHelpWidget`, `HelpSidePanel`,
  - T072 (module → docs mapping) do kontekstowych skrótów.
- V2 minimal: zapełnić `VIDEO_TUTORIALS` o Fundamentals oraz przypisać `moduleId` dla routingu.

**Analytics (events/metrics):**
- `education_fundamentals_opened`
- `education_video_started` / `completed`
- KPI: completion rate, spadek pytań onboardingowych, wzrost aktywacji kluczowych modułów.

**Risks:**
- Produkcja i aktualizacja wideo (time sink) → V2: krótka seria + prosty proces update.

**Open questions:**
- Czy Fundamentals w V2 hostujemy:
  - (A) zewnętrznie (unlisted) i embed,
  - (B) wewnętrznie w storage?
  (Proponuję A na V2 dla szybkości i stabilności.)

**Definition of Done (DoD):**
- Fundamentals series jest dostępna w aplikacji (Education entrypoint) i w KB, z kontekstowymi linkami.
- Co najmniej 5 materiałów (PL+EN) ma tracking progress.

**Acceptance / test plan:**
- Test: user otwiera Education → Fundamentals → startuje wideo → status “started” zapisany.
- Test: po ukończeniu 2 materiałów progress jest widoczny; “resume” działa.
- Test: z modułu Reports klik “Learn” → otwiera właściwy Fundamentals materiał.

**Rollout plan:**
- Najpierw 5 materiałów fundamentals + entrypointy, potem rozbudowa biblioteki.

---

## T075 — 🟠 education — Education Module – Change Management Foundations (methodology + best practices embedded in platform flow)
- Status spec: draft
- Link / ID (ClickUp): TBD
- Epic: Adoption quality & change discipline TBD
- Priorytet / V2 scope: V2

**Business challenge (problem):**
Sama platforma nie wystarczy — żeby transformacja dowiozła, użytkownicy muszą rozumieć change management: governance, komunikację, pracę ze stakeholderami, opór, rytm informacji. Bez tego rośnie chaos w execution i spada ROI.

**Cel (outcome, nie feature):**
Użytkownik przechodzi przez “Change Foundations” i:
- rozumie minimalny standard prowadzenia zmiany,
- potrafi przełożyć wiedzę na konkretne działania w platformie (inicjatywy/tasks/komunikacja/RAID),
- podnosi jakość realizacji inicjatyw (mniej niespodzianek i reworku).

**Użytkownicy i scenariusze:**
- PMO: “jak ustawić governance i rytm komunikacji” → lekcje + gotowe checklisty.
- Change manager: “jak pracować z oporem i sentymentem” → lekcje + powiązanie z T044/T045.
- Sponsor: “co jest moją rolą w zmianie” → executive mini-track (TBD).

**Scope (V2)**
- IN:
  - Change Foundations track (MUST):
    - 6–10 krótkich modułów (wideo + tekst), minimum tematy:
      - Change basics: roles, governance, cadence,
      - Stakeholders & comms plan,
      - Resistance & sentiment (privacy-first),
      - RAID discipline,
      - Execution rhythms (status, gates, escalation),
      - “Closure”: jak kończyć inicjatywy i utrwalać zmianę,
    - każdy moduł:
      - “what you learn” (3 bullets),
      - “do it now” (deep link do funkcji),
      - checklist / template (np. comms plan checklist).
  - Embedded learning in workflow (MUST):
    - kontekstowe entrypointy z modułów:
      - T044/T045 (sentiment/communications) → link do odpowiednich lekcji,
      - Initiatives/Execution → lekcje o governance/cadence,
    - po lekcji: “apply in platform” (np. utwórz comms plan, dodaj stakeholderów) (V2 minimal = deep link + checklist).
  - Surface (MUST):
    - kanonicznie w Education/KB (jak T074),
    - wspólna nawigacja i tracking progress.
  - Tracking (MUST):
    - started/completed,
    - resume,
    - reuse `help_events` / `VIDEO_TUTORIALS` (bez budowy osobnego systemu).
  - i18n (MUST):
    - minimum PL+EN dla całego tracka (bo to core).
- OUT:
  - Szkolenia na żywo, certyfikacja, egzamin.
- Future enhancements (post‑V2):
  - role-based variants (Sponsor track, HR track),
  - “practice mode”: mini-assignments z automatycznym sprawdzeniem artefaktów.

**Data / integrations (grounded in codebase):**
- Zasila `KnowledgeBaseView` → Videos/Docs:
  - wpisy w `src/config/videoTutorialsContent.ts` (Change Foundations),
  - mapowanie moduleId (T072) dla kontekstowych skrótów,
  - citations/AI grounding (T071): AI może odwołać się do tych materiałów przy pytaniach o change.

**Analytics (events/metrics):**
- `education_change_opened`
- `education_change_module_completed`
- KPI: completion rate + korelacja z jakością execution (mniej opóźnień/eskalacji) (TBD).

**Risks:**
- Jakość merytoryczna (musi być consulting-grade) + aktualizacja.

**Open questions:**
- Czy V2 traktuje Change Foundations jako:
  - (A) obowiązkowy “recommended first” dla PMO,
  - (B) opcjonalny?
  (Proponuję: recommended, nie blokujący.)

**Definition of Done (DoD):**
- Track Change Foundations jest dostępny w Education/KB, ma 6–10 modułów PL+EN, z deep linkami do platformy.
- Użytkownik widzi progress i może kontynuować.

**Acceptance / test plan:**
- Test: user kończy 3 moduły → progress zapisany; przy wejściu w T045 widzi link do “Stakeholders & comms” lekcji.
- Test: AI odpowiadając o comms plan (T045) potrafi zacytować właściwy materiał (T071 citations).

**Rollout plan:**
- Najpierw 6 modułów core, potem rozbudowa.

---

## T076 — 🟠 education — Education Module – Prompt Engineering and Advanced AI Usage (recipes for better outputs in Consultify)
- Status spec: draft
- Link / ID (ClickUp): TBD
- Epic: AI adoption quality (less frustration, better deliverables) TBD
- Priorytet / V2 scope: V2

**Business challenge (problem):**
Jakość outputów AI zależy od umiejętności użytkownika: jak zada pytanie, jak poda kontekst, jak iteruje. Bez edukacji rośnie rozczarowanie (“AI słabe”), koszty (więcej promptów) i chaos w pracy z artefaktami.

**Cel (outcome, nie feature):**
Użytkownik potrafi skutecznie pracować z AI w platformie:
- używa kontekstu i referencji,
- prowadzi iteracje,
- robi “quality gates” (sprawdza grounding, nie halucynuje),
co skutkuje krótszym czasem do premium deliverable (inicjatywy/raporty/decki).

**Użytkownicy i scenariusze:**
- Konsultant: chce uzyskać sponsor-grade rekomendacje bez “przepychania” — używa gotowych recipes.
- CFO/PMO: chce analizy finansowej/ROI bez halucynacji — uczy się promptowania z citations i walidacją.
- Owner: ustawia “custom instructions” dla organizacji (ton, styl, język) i rozumie konsekwencje.

**Scope (V2)**
- IN:
  - Prompt Engineering track (MUST):
    - 6–10 krótkich lekcji (PL+EN), minimum:
      - “Context first”: jak wkleić/odwołać się do artefaktów z platformy,
      - “Ask for structure”: JSON/listy/tabele vs narracja,
      - “Iterate”: jak robić 2–3 kroki doprecyzowania bez kosztu chaosu,
      - “Grounding & citations”: jak wymuszać źródła (T071) i jak reagować na brak coverage,
      - “DoD prompting”: jak prosić o output, który spełnia DoD (inicjatywa/report/deck),
      - “Safety”: czego nie robić (PII, tajemnice, dane klientów).
  - Platform‑specific recipes (MUST):
    - gotowe przykłady promptów dopasowane do realnych modułów:
      - Tools (T019–T021): closure + inicjatywy,
      - Initiatives: charter + KPI/ROI (T046–T049),
      - Reports/Presentations (T060/T058): “outline → regenerate section”,
      - Help grounded Q&A (T071),
    - każdy recipe:
      - “goal”,
      - “best prompt”,
      - “what to include (context checklist)”,
      - “expected output shape”.
  - Where to use (grounded in product) (MUST):
    - odwołania do istniejących ustawień AI:
      - `AIInstructionsSettings` (custom instructions),
      - behavior/personality/response style,
    - instrukcja “jak ustawić org/user instructions bez psucia quality”.
  - Surface (MUST):
    - kanonicznie w Education/KB (jak T074/T075),
    - kontekstowo: link “Learn prompting for this module” z AI paneli (TBD minimal: link z Help).
  - Tracking (MUST):
    - started/completed + resume (reuse help events / KB videos).
- OUT:
  - Zaawansowany multi-week kurs i certyfikacja.
  - Budowa nowego edytora promptów jako feature (to osobne inicjatywy, jeśli kiedyś).
- Future enhancements (post‑V2):
  - “Prompt library” z kopiuj-wklej w UI (guardrailed),
  - org-level curated recipes per industry.

**Security / compliance (MUST):**
- “Do not paste secrets/PII” jako twardy fragment edukacji.
- Recipes nie mogą instruować obchodzenia RBAC ani eksportu wrażliwych danych.

**Data / integrations (grounded in codebase):**
- Edukacja hostowana przez:
  - `KnowledgeBaseView` → Videos (zasilane z `src/config/videoTutorialsContent.ts`),
  - powiązania moduleId (T072),
  - citations/grounding (T071) jako przykład i standard.
- Odwołania do istniejących komponentów settings AI (UI nie musi się zmieniać w T076).

**Analytics (events/metrics):**
- `education_prompting_opened`
- `education_prompting_completed`
- KPI: wzrost pozytywnego feedbacku na AI, spadek retry loops, spadek kosztu na deliverable (TBD).

**Risks:**
- Szybko zmieniające się AI funkcje → treści muszą być modularne i łatwe do aktualizacji.

**Open questions:**
- Czy recipes mają być w V2 tylko do kopiowania (text), czy też jako “one-click apply” do instrukcji AI? (proponuję: text + link do settings; apply post‑V2)

**Definition of Done (DoD):**
- Materiały Prompt Engineering są dostępne (PL+EN) i zawierają platform-specific recipes.
- Użytkownik potrafi znaleźć “jak lepiej pracować z AI” bez supportu, a treści są spójne z realnymi modułami.

**Acceptance / test plan:**
- Test: user wchodzi w Education → Prompt Engineering → widzi 6+ lekcji, kończy 2 → progress zapisany.
- Test: recipe “Report Builder” prowadzi do lepszego outputu (struktura, grounding) i odwołuje się do citations z T071.

**Rollout plan:**
- Najpierw 6 lekcji core + 10 recipes, potem iteracyjne uzupełnianie.

---

## T077 — 🟠 education — Knowledge Module – Core Consulting Tools Library (single source: purpose → how to use → outcomes → start)
- Status spec: draft
- Link / ID (ClickUp): TBD
- Epic: Knowledge & credibility layer for Tools adoption TBD
- Priorytet / V2 scope: V2

**Business challenge (problem):**
Użytkownicy (i potencjalni klienci) potrzebują “single source of truth” o narzędziach konsultingowych: po co to jest, kiedy użyć, co dostanę, jak wygląda wynik. Bez tego spada adopcja, a platforma wygląda jak zbiór przypadkowych funkcji.

**Cel (outcome, nie feature):**
Dla każdego core narzędzia konsultingowego użytkownik może szybko zrozumieć:
- **purpose** (po co),
- **when** (kiedy użyć),
- **how** (jak przejść przez narzędzie),
- **what you get** (outcomes),
i ma jedno kliknięcie do uruchomienia narzędzia w platformie.

**Użytkownicy i scenariusze:**
- Użytkownik w Tools: widzi listę narzędzi → klika “Learn” → karta narzędzia + wideo + CTA “Start”.
- Partner/sales: pokazuje bibliotekę jako dowód metodologii.
- Nowy user: trafia z onboardingu do “tool card” zamiast długiej instrukcji.

**Scope (V2)**
- IN:
  - Tool cards (MUST):
    - dla każdej pozycji w “core tools” (min. 10 strategic / 10 operational / 10 digital / 1 automation — zgodnie z katalogiem Tools):
      - krótki opis (1–3 akapity),
      - kiedy użyć + typowe pytania,
      - expected outputs (3–6 bullet),
      - przykładowy “definition of done” wyniku (krótko),
      - linki: “Start tool” + “See example output” (TBD minimal).
  - Video integration (MUST):
    - teaser/walkthrough video per tool (może być placeholder w V2, ale struktura musi wspierać),
    - spójny odtwarzacz (reuse `ToolVideoModal` / video surface w KB).
  - Navigation & discoverability (MUST):
    - kanoniczne miejsce w produkcie: Knowledge Base / Docs (narzędzia jako kategoria),
    - entrypointy:
      - z Tools hub/Tool picker: przycisk “Learn”,
      - z Help: link do biblioteki narzędzi,
      - opcjonalnie publicznie: `/tools` showcase jako marketingowa wersja (już istnieje).
  - Search (MUST):
    - narzędzia są przeszukiwalne (po nazwie, tagach, use-case).
  - i18n (MUST):
    - PL + EN dla kart narzędzi (minimum dla core listy).
- OUT:
  - Paywall / kursy / marketplace treści.
- Future enhancements (post‑V2):
  - “example outputs” generowane z demo data,
  - “recommended tools” per kontekst firmy.

**Data / integrations (grounded in codebase):**
- Reuse / starting point:
  - public showcase: `src/views/ToolsShowcasePage.tsx` + `src/data/toolEducationData.ts`,
  - video modal: `src/components/Education/ToolVideoModal.tsx`,
  - docs portal: `src/views/KnowledgeBaseView.tsx` + “Videos”/cards/overview surfaces.
- V2 decision: utrzymać **jedno źródło treści** (preferowane: KB/docs), a showcase publiczny korzysta z tych samych ID i odnośników (bez duplikacji opisów).

**UX / UI notes:**
- N‑style, readability-first: karta narzędzia ma mieć “what you get” above-the-fold + CTA “Start”.
- Bez legacy “D-mode accordion”.

**Analytics (events/metrics):**
- `tool_knowledge_opened` (toolId, source)
- `tool_knowledge_video_started` / `completed`
- `tool_knowledge_start_clicked`
- KPI: wzrost adoption narzędzi, spadek pytań “co to robi”.

**Risks:**
- Utrzymanie spójności między platformą i publiczną stroną `/tools` → jedno źródło treści + linkowanie.

**Open questions:**
- Czy w V2 wszystkie tool cards mają mieć wideo, czy część może mieć “coming soon”? (proponuję: top 10 ma wideo, reszta placeholder)

**Definition of Done (DoD):**
- Biblioteka narzędzi jest przeszukiwalna, spójna i dostępna w platformie.
- Każde core narzędzie ma kartę “purpose/how/outcomes” + CTA “Start tool”.

**Acceptance / test plan:**
- Test: z Tools hub user otwiera “Learn” dla 3 narzędzi → widzi kartę + CTA start → przechodzi do właściwego narzędzia.
- Test: wyszukiwarka KB znajduje narzędzie po nazwie i tagach.

**Rollout plan:**
- Najpierw core strategic tools + najczęściej używane, potem reszta katalogu.

---

## T078 — 🟠 education — Knowledge Module – Licensed Assessment Tools Library (DRD/SIRI/ADMA: methodology + trust + integration)
- Status spec: draft
- Link / ID (ClickUp): TBD
- Epic: Licensed frameworks credibility & adoption TBD
- Priorytet / V2 scope: V2

**Business challenge (problem):**
Narzędzia licencjonowane (DRD/SIRI/ADMA) muszą być zrozumiałe metodologicznie, inaczej:
- użytkownik nie ufa wynikom (“skąd to się wzięło?”),
- źle interpretuje poziomy i scoring,
- nie umie przełożyć wyników na roadmapę/inicjatywy i raporty.
Potrzebujemy biblioteki wiedzy “why/how/what you get” dostępnej w kontekście pracy.

**Cel (outcome, nie feature):**
Użytkownik (enterprise/konsultant) ma komplet materiałów dla DRD/SIRI/ADMA:
- metodologia i interpretacja,
- wymagania dowodowe (evidence),
- typowe działania per poziom/luka,
- oraz integrację z flow platformy (assessment → report/deck → initiatives).

**Użytkownicy i scenariusze:**
- Konsultant: przed warsztatem otwiera “SIRI methodology” + “how to score” → prowadzi assessment spójnie.
- Klient enterprise: ogląda “what the result means” + “how to use in roadmap”.
- Reviewer: sprawdza czy evidence jest wystarczające dla danego poziomu.

**Scope (V2)**
- IN:
  - Licensed knowledge cards per framework (MUST):
    - DRD / SIRI / ADMA — każdy ma:
      - overview: cel frameworku, struktura (obszary/wymiary, skala),
      - scoring logic i interpretacja,
      - evidence standards (co jest dowodem, co nie),
      - common pitfalls (jak nie “przestrzelić” poziomu),
      - “what you get”: raporty, mapy, rekomendacje, inicjatywy.
  - Level/dimension guidance (MUST):
    - dla każdego poziomu/wymiaru:
      - pytania kontrolne,
      - przykłady,
      - sugerowane technologie/typowe praktyki,
    - (grounded in codebase) wykorzystać istniejące `src/services/assessmentKnowledge/*` jako bazę treści i zapewnić spójność z UI.
  - Contextual availability (MUST):
    - entrypointy z assessment UI:
      - “What does this level mean?” przy ocenie poziomu,
      - “Evidence examples” przy polu dowodów,
    - entrypointy z report builder / presentation generator:
      - “Methodology appendix” block dla raportu (T060) / deck (T058) (TBD minimal: linki, post‑V2: automatyczne wstawki).
  - Access control / licensing (MUST):
    - treści licencjonowane dostępne tylko dla uprawnionych planów/orgów,
    - jasne oznaczenia “Licensed content” + compliance note,
    - brak publicznej ekspozycji tych treści w `/docs` jeśli nie powinno być publiczne (policy: TBD, ale domyślnie “private in-app”).
  - i18n (MUST):
    - PL + EN dla overview i kluczowych fragmentów,
    - (jeśli treści licencjonowane mają ograniczenia językowe) — jawne w UI.
- OUT:
  - Akredytacje/certyfikacje, pełne szkolenia (academy).
- Future enhancements (post‑V2):
  - “Trainer mode” z prowadzeniem warsztatu krok-po-kroku,
  - więcej przykładów branżowych per sector.

**Data / integrations (grounded in codebase):**
- Reuse:
  - framework knowledge: `src/services/assessmentKnowledge/drdKnowledge.ts`, `siriKnowledge.ts`, `admaKnowledge.ts`,
  - framework structures: `src/services/drdStructure.ts`, `siriStructure.ts`, `admaStructure.ts`,
  - assessment forms: `src/components/assessment/tools/DRDForm.tsx`, `SIRIForm.tsx`, `ADMAForm.tsx`.
- Knowledge surfaces:
  - preferowane: in-app KnowledgeBaseView/Help panel w trybie “private KB” dla licensed content,
  - mapping moduleId (T072) dla kontekstowych linków.

**Security / compliance:**
- Licencje: twardy gating + audit dostępu.
- Disclaimers: “methodology guidance, not investment/legal advice”.

**Analytics (events/metrics):**
- `licensed_kb_opened` (framework, section)
- `licensed_kb_level_help_opened` (framework, dimension, level)
- KPI: completion materiałów, spadek pytań o metodologię, wyższa spójność scoringu (TBD).

**Risks:**
- Zależność od licencji/treści: co można publikować gdzie (public vs private) → wymaga decyzji policy.
- Aktualizacja treści przy zmianach w narzędziach → owner + proces.

**Open questions:**
- Czy licensed library ma być:
  - (A) wyłącznie in-app (private),
  - (B) częściowo public (overview) + gated detale?

**Definition of Done (DoD):**
- Każdy framework licencjonowany ma komplet “why/how/what you get” + interpretację scoringu + evidence standards.
- Treści są dostępne kontekstowo w assessment flow i zgodne z realnym UI.
- Gating licencyjny działa (brak ekspozycji nieuprawnionej).

**Acceptance / test plan:**
- Test: w SIRI assessment user klika “What does level 3 mean?” → widzi guidance + przykłady + suggested technologies.
- Test: user bez uprawnień → widzi informację o licencjonowaniu, brak dostępu do treści szczegółowych.
- Test: konsultant dodaje do raportu sekcję metodologii (min: link; target: block) i eksport działa.

**Rollout plan:**
- Najpierw DRD (najbardziej “kanoniczne”), potem SIRI, potem ADMA.

---

## T079 — 🟠 education — Education Module – Managing Initiatives in Transformation (lifecycle + governance + execution discipline)
- Status spec: draft
- Link / ID (ClickUp): TBD
- Epic: Initiative lifecycle clarity & execution quality TBD
- Priorytet / V2 scope: V2

**Business challenge (problem):**
Bez zrozumienia lifecycle’u inicjatyw i governance ludzie używają platformy chaotycznie:
- statusy są “klikane” bez znaczenia,
- brakuje właścicieli, decyzji, rytmu,
- raporty nie są sponsor‑grade,
co obniża skuteczność transformacji (opóźnienia, rework, brak closure).

**Cel (outcome, nie feature):**
Użytkownik rozumie i stosuje w praktyce:
- lifecycle inicjatywy (od pomysłu do closure),
- stage‑gates i readiness (T033),
- dyscyplinę wykonania (T041/T040/T042),
oraz umie pracować “jak PMO/consultant” w module Initiatives/Execution.

**Użytkownicy i scenariusze:**
- PMO: wdraża standard “jak prowadzimy inicjatywy” w organizacji i egzekwuje rytm.
- Initiative Owner: wie co musi mieć, żeby przejść gate i wystartować execution.
- Zespół: wie jak pracować w taskach/decisions i jak zamykać pracę z evidence.

**Scope (V2)**
- IN:
  - Initiative lifecycle track (MUST):
    - 6–10 krótkich lekcji (PL+EN), minimum:
      - “What is an initiative (in this platform)” + definicja sukcesu,
      - statuses & lifecycle (draft → review → approved → executing → done),
      - stage‑gates: jak przechodzić i co to znaczy (T033),
      - ownership & stakeholders (RACI lite),
      - plan vs execution: jak czytać timeline/delay signals (T041),
      - RAID discipline: ryzyka, issues, actions (T040),
      - budget & resources: plan vs actual + alerty (T042),
      - closure: jak zamknąć inicjatywę (lessons learned, outcomes, next steps).
  - “Do it now” integration (MUST):
    - każda lekcja ma deep link do:
      - Initiatives/Execution/Benefits,
      - oraz checklistę “apply in platform”.
    - V2 minimal: deep link + checklist; post‑V2: guided wizard.
  - Best practices pack (MUST):
    - “golden rules” 10–15 zasad (krótko) np.:
      - 1 owner, 1 next action,
      - evidence for claims,
      - decisions logged, not “in chat only”,
      - closure required,
    - “anti-patterns” (co psuje program).
  - Contextual entrypoints (MUST):
    - w Initiatives/Execution widoczny skrót “Learn: lifecycle & governance”,
    - z Help (T072) automatycznie podpowiada ten track, gdy user jest w Initiatives/Execution.
  - Tracking (MUST):
    - progress per user,
    - reuse `help_events` / KB videos.
- OUT:
  - Pełne szkolenie warsztatowe i certyfikacja.
- Future enhancements (post‑V2):
  - “PMO playbook mode” — checklisty compliance per initiative + auto‑flags.
  - Org policy: wymagane pola/gates per typ inicjatywy.

**Data / integrations (grounded in product):**
- Materiały hostowane jak T074/T075/T076:
  - `KnowledgeBaseView` + `VIDEO_TUTORIALS`,
  - mapowanie moduleId (T072),
  - citations/grounding (T071) dla pytań “jak przejść gate?”.
- Treści muszą być spójne z realnymi modułami:
  - Initiatives lifecycle, stage‑gate (T033),
  - execution timeline (T041),
  - RAID (T040),
  - budgets/resources (T042),
  - KPI/ROI mapping (T046–T049) jako “where to connect benefits”.

**Analytics (events/metrics):**
- `education_initiatives_opened`
- `education_initiatives_module_completed`
- KPI: mniej błędów w governance, wyższy completion inicjatyw, mniej “stuck in draft”.

**Risks:**
- Zmiany w workflow → wymagana aktualizacja contentu (owner + proces).

**Open questions:**
- Czy track ma mieć osobny wariant “Sponsor (10 min)” (executive brief)? (proponuję: post‑V2)

**Definition of Done (DoD):**
- Track “Managing Initiatives” jest dostępny (PL+EN), spójny z realnym flow i ma kontekstowe linki z Initiatives/Execution.
- Użytkownik rozumie statusy, gates i best practices oraz potrafi zastosować je w platformie.

**Acceptance / test plan:**
- Test: user wchodzi w Initiatives → klik “Learn” → otwiera track; kończy 2 lekcje → progress zapisany.
- Test: lekcja o stage‑gates linkuje do realnego widoku/obszaru i nie obiecuje feature’ów których nie ma.

**Rollout plan:**
- Najpierw 6 lekcji core, potem rozszerzenie best practices i warianty roli.

---

## T080 — 🟠 education — Education Module – Financial Analysis and Modeling (read outputs + assumptions correctly, sponsor‑grade)
- Status spec: draft
- Link / ID (ClickUp): TBD
- Epic: Finance adoption quality (interpretation + governance) TBD
- Priorytet / V2 scope: V2

**Business challenge (problem):**
Użytkownicy muszą rozumieć wyniki finansowe i założenia, inaczej moduły Finance nie dowiozą wartości:
- błędna interpretacja wskaźników,
- mylenie projekcji z faktami,
- brak rozumienia powiązań (P&L/BS/CF),
- ryzyko “regulowanych” claimów (investment advice).

**Cel (outcome, nie feature):**
Użytkownik potrafi:
- czytać i interpretować outputs Finance (statements/ratios/insights/models),
- rozumieć assumptions i ich wpływ,
- tworzyć sponsor‑grade narrację (grounded) bez nadinterpretacji,
bezpiecznie i zgodnie z guardrails.

**Użytkownicy i scenariusze:**
- CFO/management: przegląda analizy i wie “co to znaczy” + “jakie są ryzyka danych”.
- Konsultant: prowadzi klienta przez wyniki i zamienia je na inicjatywy (T056/T046).
- PMO: korzysta z finansów do priorytetyzacji i governance.

**Scope (V2)**
- IN:
  - Finance fundamentals track (MUST):
    - 8–12 krótkich lekcji (PL+EN), minimum:
      - P&L vs Balance Sheet vs Cash Flow: co mierzą i jak się łączą,
      - data quality: okresy, waluta, normalizacja, mapping (T050/T049),
      - ratio families: liquidity/profitability/leverage/efficiency/growth (T051),
      - vertical/horizontal/trend analysis (T052),
      - assumptions & scenarios (T053/T054),
      - model consistency checks (Assets=Liabilities+Equity, ΔCash tie‑out) (T054),
      - valuation basics (DCF, comps) i ograniczenia interpretacji (T055),
      - “from insight to action”: jak przejść do initiative/ROI/KPI (T046–T049/T056),
      - reporting: jak pokazać to w raporcie/decku (T060/T058).
  - Platform‑specific walkthroughs (MUST):
    - “how to” pod UI:
      - import statements (T050) + mapping,
      - gdzie zobaczyć ratios/insights,
      - jak używać scenariuszy,
      - jak czytać walidacje,
    - deep linki do właściwych ekranów.
  - Guardrails & disclaimers (MUST):
    - jasne zasady:
      - brak rekomendacji inwestycyjnych / doradztwa regulowanego,
      - rozdzielenie “facts” vs “assumptions” vs “interpretation”,
      - jak komunikować niepewność i braki danych.
  - Surface (MUST):
    - kanonicznie w Education/KB,
    - kontekstowo w Finance/Economics (skrót “Learn: how to interpret this”).
  - Tracking (MUST):
    - progress per user (reuse help events / KB videos).
- OUT:
  - Doradztwo inwestycyjne, “buy/sell” recommendations, regulatory opinions.
- Future enhancements (post‑V2):
  - branżowe benchmark playbooks,
  - interaktywne ćwiczenia “spot the mistake” na modelu.

**Data / integrations (grounded in product):**
- Treści muszą być spójne z inicjatywami Finance:
  - T050–T057 (ingestion, ratios, analysis, budgeting, modeling, valuation, advisory),
  - UI istniejące: `src/components/Economics/FinancialAnalysisPanel.tsx`, `ExcelImportWizard.tsx` jako referencje UX.
- Knowledge surfaces:
  - `KnowledgeBaseView` + `VIDEO_TUTORIALS`,
  - mapowanie moduleId (T072) + citations (T071) dla pytań “co oznacza ten wskaźnik?”.

**Analytics (events/metrics):**
- `education_finance_opened`
- `education_finance_module_completed`
- KPI: mniej błędnych interpretacji (feedback), większa adopcja Finance.

**Risks:**
- Odpowiedzialność / compliance → mocne disclaimers i język “assistive, grounded”.
- Zmiany w module Finance → update treści.

**Open questions:**
- Czy w V2 robimy 8 lekcji “core” + 2 walkthrough (import + valuation), czy pełne 12? (proponuję: 8 core + 2 walkthrough)

**Definition of Done (DoD):**
- Materiały Finance są dostępne w Education i kontekstowo w Finance.
- Użytkownik rozumie jak czytać outputs i assumptions, a treści mają disclaimers.

**Acceptance / test plan:**
- Test: user w Finance widzi skrót “Learn” → otwiera właściwą lekcję o danym obszarze (ratios/scenarios/valuation).
- Test: materiały wyraźnie rozdzielają facts/assumptions/interpretation i nie zawierają regulowanych rekomendacji.

**Rollout plan:**
- Najpierw 8 core lekcji + walkthrough import, potem rozszerzenie o valuation pack.

---

## T081 — 🟠 education — Education Module – Budgeting and Financial Planning (fundamental budgeting + forecasting assumptions discipline)
- Status spec: draft
- Link / ID (ClickUp): TBD
- Epic: Budgeting adoption quality (realistic plans, fewer mistakes) TBD
- Priorytet / V2 scope: V2

**Business challenge (problem):**
Bez edukacji użytkownicy budują nierealistyczne budżety i źle interpretują forecasty:
- mieszają “plan” z “actual”,
- nie rozumieją driverów i zależności,
- nie umieją komunikować niepewności i scenariuszy,
co psuje wiarygodność planowania i decyzji inwestycyjnych.

**Cel (outcome, nie feature):**
Użytkownik rozumie logikę budżetowania w platformie i potrafi:
- zbudować spójny budżet (driver-based),
- opisać assumptions i scenariusze,
- prowadzić dyscyplinę planowania (review/approval, zmiany, audit),
tak, aby output był sponsor‑grade i nie wymagał “ręcznej magii w Excelu”.

**Użytkownicy i scenariusze:**
- CFO/Controller: ocenia budżet, weryfikuje assumptions i spójność.
- PMO: łączy portfolio inicjatyw z budżetem i priorytetyzacją.
- Konsultant: tłumaczy klientowi “co oznaczają scenariusze” i jak ich używać w decyzjach.

**Scope (V2)**
- IN:
  - Budgeting & planning track (MUST):
    - 6–10 lekcji (PL+EN), minimum:
      - “Budget types”: baseline vs forecast vs plan vs scenario,
      - driver-based planning: jak działa i dlaczego,
      - assumptions: jak je pisać (testowalne, mierzalne),
      - scenario discipline: base/optimistic/conservative + kiedy użyć,
      - governance: DRAFT→REVIEW→APPROVED, versioning i audit (T053),
      - plan vs actual: jak czytać odchylenia i wyciągać wnioski (T042),
      - powiązanie z inicjatywami: koszty/ROI i konsekwencje (T046/T054).
  - Platform walkthroughs (MUST):
    - deep linki do:
      - Budgeting workspace (T053),
      - budżety/limity/plan vs actual (T042),
      - financial model events (T054) jako “skąd się bierze liczba”.
  - “Assumption quality checklist” (MUST):
    - krótka checklista (10–15 punktów) np.:
      - czy assumption ma ownera,
      - czy ma źródło (dane/benchmark/ekspert),
      - czy ma zakres czasu i jednostki,
      - czy widać wpływ na output.
  - Guardrails & disclaimers (MUST):
    - rozdzielenie facts/assumptions,
    - brak “investment advice” i regulowanych rekomendacji.
  - Surface + tracking (MUST):
    - Education/KB + kontekstowe skróty w Finance/Budgeting,
    - progress per user (reuse help events / KB videos).
- OUT:
  - Zaawansowane kursy controllingowe i branżowe standardy rachunkowości.
- Future enhancements (post‑V2):
  - interaktywne ćwiczenia “build a budget” na demo danych,
  - benchmark-driven assumption suggestions (guardrailed).

**Data / integrations (grounded in roadmap):**
- Treści muszą być spójne z:
  - T053 (budgeting artifact + workflow),
  - T042 (plan vs actual control),
  - T054 (model relacje i walidacje),
  - T050/T052 (wejścia: statements/insights).

**Analytics (events/metrics):**
- `education_budgeting_opened`
- `education_budgeting_module_completed`
- KPI: mniej błędów w budżetach, wyższa jakość assumptions (review feedback) (TBD).

**Risks:**
- Złożoność tematu → V2 stawia na fundamentals + checklisty, a nie podręcznik controllingu.

**Open questions:**
- Czy w V2 uczymy tylko “budżet roczny”, czy też rolling forecast? (proponuję: roczny + wzmianka o rolling jako post‑V2)

**Definition of Done (DoD):**
- Materiały “Budgeting & Planning” są dostępne w Education i/lub kontekstowo w Finance/Budgeting.
- Treść jest spójna z T053 i uczy dyscypliny assumptions/scenarios.

**Acceptance / test plan:**
- Test: user w Budgeting ma skrót “Learn” → trafia do właściwej lekcji o assumptions/scenarios.
- Test: checklist “assumption quality” jest dostępna i używalna (do wydruku / jako lista).

**Rollout plan:**
- Najpierw 6 lekcji core + checklisty, potem rozszerzenie o rolling forecast.

---

## T082 — 🟠 education — Education Module – ROI Analysis and Investment Evaluation (ROI literacy + decision discipline, grounded in platform)
- Status spec: draft
- Link / ID (ClickUp): TBD
- Epic: ROI quality & prioritization discipline TBD
- Priorytet / V2 scope: V2

**Business challenge (problem):**
ROI jest kluczowe dla priorytetyzacji inicjatyw, ale bez edukacji użytkownicy:
- wpisują “ładne liczby” bez założeń,
- mylą ROI z NPV/IRR/payback,
- nie rozumieją ryzyka i niepewności,
co psuje decyzje i wiarygodność programu transformacji.

**Cel (outcome, nie feature):**
Użytkownik rozumie metody oceny inwestycji i potrafi w platformie:
- zdefiniować ROI w sposób audytowalny (assumptions + źródła),
- czytać i interpretować wyniki (z niepewnością),
- używać ROI do decyzji i governance (approve/stop/resequence).

**Użytkownicy i scenariusze:**
- Sponsor: wybiera inicjatywy do finansowania na bazie spójnych kryteriów.
- CFO/Finance: weryfikuje założenia i spójność z finansami.
- PMO: zarządza portfelem i komunikuje “dlaczego to jest priorytet”.

**Scope (V2)**
- IN:
  - ROI & investment evaluation track (MUST):
    - 6–10 lekcji (PL+EN), minimum:
      - ROI vs NPV vs IRR vs payback: kiedy które,
      - baseline vs incremental impact (co liczymy),
      - CAPEX/OPEX i timing cash flows,
      - uncertainty: scenariusze, zakresy, confidence (bez udawania “prawdy”),
      - “assumption quality”: jak pisać i jak je testować,
      - interpretacja i komunikacja: jak opowiadać sponsorowi bez overclaim,
      - jak zamienić ROI na governance decyzje (approve/stop/iterate).
  - Platform grounding (MUST):
    - materiały odnoszą się do konkretnych flow:
      - ROI tracking & validation (T046),
      - initiative economics / CAPEX/OPEX (inicjatywy),
      - financial modeling events (T054) jako “skąd się bierze liczba”,
      - KPI mapping/attribution (T047/T048) jako “dowód realizacji”.
    - deep linki do tych ekranów.
  - ROI templates & checklists (MUST):
    - checklist “ROI assumptions” (10–15 punktów),
    - minimalny zestaw “ROI methods chooser” (kiedy ROI vs NPV vs payback),
    - przykłady (case) w formie krótkich kart (TBD minimal: 2 case).
  - Guardrails & disclaimers (MUST):
    - brak porad inwestycyjnych regulowanych,
    - komunikacja “assistive, assumptions-based”,
    - rozdzielenie facts vs assumptions.
  - Surface + tracking (MUST):
    - Education/KB + kontekstowe skróty w ROI/Benefits/Initiatives,
    - progress per user (reuse help events / KB videos).
- OUT:
  - Regulowane doradztwo inwestycyjne.
  - Pełne kursy controllingowe/finance academy.
- Future enhancements (post‑V2):
  - interaktywne ćwiczenia “build ROI” na demo danych,
  - AI coaching do poprawy assumptions (guardrailed) + review workflow.

**Data / integrations:**
- Spójność z modułami:
  - T046 (ROI tracking/validation),
  - T047–T049 (KPI mapping → finance mapping),
  - T054 (model events i spójność),
  - T060/T058 (jak pokazać ROI w raporcie/decku).

**Analytics (events/metrics):**
- `education_roi_opened`
- `education_roi_module_completed`
- KPI: lepsza jakość założeń ROI, mniej “magic numbers” (review feedback) (TBD).

**Risks:**
- Metody (NPV/IRR) mogą budzić oczekiwania “investment advice” → jasne disclaimers i framing “internal decision support”.

**Open questions:**
- Czy w V2 uczymy IRR i NPV “praktycznie” czy tylko konceptualnie? (proponuję: konceptualnie + 1 przykład, pełna praktyka post‑V2)

**Definition of Done (DoD):**
- Materiały ROI są dostępne i odnoszą się do realnych ekranów/flow w platformie.
- Użytkownik rozumie assumptions i interpretację wyników oraz różnice ROI/NPV/IRR/payback.

**Acceptance / test plan:**
- Test: user w ROI/Benefits klika “Learn” → trafia do właściwej lekcji (ROI vs NPV).
- Test: checklist assumptions jest dostępna (do wydruku / jako lista) i nie zawiera regulowanych rekomendacji.

**Rollout plan:**
- Najpierw 6 lekcji core + checklisty, potem case studies i więcej metod.

---

## T083 — 🟠 education — Education Module – KPI System Design and Performance Architecture (cause→effect + KPI↔initiatives↔finance)
- Status spec: draft
- Link / ID (ClickUp): TBD
- Epic: KPI discipline (less chaos, better benefits tracking) TBD
- Priorytet / V2 scope: V2

**Business challenge (problem):**
KPI bez architektury prowadzą do chaosu:
- za dużo wskaźników bez priorytetu,
- brak baseline/target i ownerów,
- brak spójnego powiązania z inicjatywami i finansami,
co uniemożliwia rzetelne mierzenie efektów transformacji.

**Cel (outcome, nie feature):**
Użytkownik potrafi zaprojektować sensowny system KPI i wdrożyć go w platformie:
- KPI mają definicje, częstotliwość, baseline/target,
- istnieje logiczny łańcuch cause→effect (KPI drivers),
- inicjatywy są mapowane do KPI (T047),
- KPI są mapowane do finansów (T049) i wspierają ROI (T046).

**Użytkownicy i scenariusze:**
- Management: chce 10–20 KPI “North Star + drivers” zamiast 200 metryk.
- PMO: mapuje inicjatywy do KPI i pilnuje aktualizacji.
- Analityk: buduje definicje KPI i dba o spójność jednostek/danych.

**Scope (V2)**
- IN:
  - KPI architecture track (MUST):
    - 6–10 lekcji (PL+EN), minimum:
      - KPI taxonomy: outcome vs driver vs activity,
      - definicja KPI: unit, cadence, owner, data source,
      - baseline/target i “measurement integrity”,
      - cause→effect (driver tree) i unikanie “proxy madness”,
      - mapping KPI↔initiatives (T047) i jak to robić dobrze,
      - KPI↔finance mapping (T049): kierunek wpływu, formuły, assumptions,
      - attribution vs causality (T048 guardrails): jak mówić uczciwie.
  - Platform grounding (MUST):
    - lekcje odnoszą się do realnych ekranów:
      - KPI create/edit (np. `KPICreateModal`),
      - Benefits/KPI hub (T047),
      - initiative KPI section (T047),
      - finance mapping (T049),
    - deep linki do właściwych miejsc.
  - Checklists & examples (MUST):
    - “KPI definition checklist” (10–15 punktów),
    - 2–3 przykłady KPI driver chains (np. On-time delivery → WIP → changeover time),
    - “anti-patterns” (np. KPI bez ownera, bez jednostki, bez baseline).
  - Surface + tracking (MUST):
    - Education/KB + skróty kontekstowe w Benefits/KPI/Initiatives,
    - progress per user (reuse help events / KB videos).
- OUT:
  - Pełne szkolenia OKR/BI i branżowe biblioteki KPI (post‑V2).
- Future enhancements (post‑V2):
  - KPI templates per industry,
  - KPI data integrations (ERP/BI) i automatyczne aktualizacje.

**Data / integrations:**
- Treści muszą być spójne z:
  - T047 (initiative↔KPI mapping i time series),
  - T048 (attribution guardrails),
  - T049 (KPI↔financial statement mapping),
  - T046 (ROI validation).

**Analytics (events/metrics):**
- `education_kpi_opened`
- `education_kpi_module_completed`
- KPI: więcej inicjatyw z poprawnym KPI mapping; mniej “dead KPIs” bez aktualizacji.

**Risks:**
- Zbyt akademickie treści → V2: krótkie, “do it now”, checklists.

**Open questions:**
- Czy w V2 dołączamy 1 “executive cheat sheet” (1 strona) dla sponsorów? (proponuję: tak, jako PDF/printable)

**Definition of Done (DoD):**
- Materiały wyjaśniają jak budować KPI system i jak to robić w platformie (T047/T049).
- Są przykłady i checklisty, a treści nie obiecują integracji danych jeśli jej nie ma.

**Acceptance / test plan:**
- Test: user w Benefits/KPI klika “Learn” → otwiera lekcję “Outcome vs driver KPI”.
- Test: checklist definicji KPI jest dostępna (printable) i prowadzi do poprawnie zdefiniowanego KPI.

**Rollout plan:**
- Najpierw 6 lekcji core + checklisty, potem templates branżowe (post‑V2).

---

## T084 — 🟠 education — Education Module – Building Presentations in the Platform (T058/T059 walkthroughs, Gamma‑style)
- Status spec: draft
- Link / ID (ClickUp): TBD
- Epic: Presentation adoption (less frustration, more deck exports) TBD
- Priorytet / V2 scope: V2

**Business challenge (problem):**
Generator prezentacji (T058) i templates (T059) mają wysoki potencjał, ale bez instrukcji użytkownicy:
- nie rozumieją “jak z artefaktów zrobić deck”,
- próbują używać generatora jak WYSIWYG,
- nie potrafią iterować outline i promptować zmian układu,
co kończy się frustracją i ręcznymi poprawkami.

**Cel (outcome, nie feature):**
Użytkownik potrafi krok po kroku:
- wybrać scope i źródła (artefakty w platformie),
- wygenerować outline, poprawić go i iterować,
- wygenerować deck sponsor‑grade,
- wyeksportować PPTX i rozumie “jak minimalizować manual fixes”.

**Użytkownicy i scenariusze:**
- Konsultant: robi deck “Assessment summary” dla klienta z DRD/SIRI/ADMA.
- Sales: robi “Research → pitch” na bazie kontekstu i narzędzi.
- PMO: robi “Steering committee update” z inicjatyw/execution/KPI.

**Scope (V2)**
- IN:
  - Presentation generator training track (MUST):
    - 6–10 krótkich lekcji (PL+EN), minimum:
      - “What makes a good deck” (1 key message/slide),
      - selection of sources (approved artifacts),
      - outline-first workflow (jak edytować outline),
      - iterations: “regenerate section/slide”, “split slide”, “change tone/audience”,
      - grounding & citations (jak wymuszać źródła i czego nie obiecywać),
      - export & QA (PPTX hygiene: overflow, fonts, visuals).
  - Platform walkthroughs (MUST):
    - 3 kompletne przykłady end‑to‑end:
      - research → deck,
      - finance → deck,
      - initiatives/execution → deck,
    - każdy przykład:
      - wybór template (T059),
      - outline,
      - 2 iteracje zmian,
      - export PPTX.
  - “Common fixes” playbook (MUST):
    - checklista: “co zrobić gdy deck jest za długi / za szczegółowy / brak wizualizacji / brak closure”.
  - Contextual entrypoints (MUST):
    - w miejscu generatora prezentacji: link “Learn: building decks”,
    - z Report Builder (T060) i z narzędzi/assessment: link “Turn this into a deck”.
  - Tracking (MUST):
    - progress per user (reuse help events / KB videos).
- OUT:
  - Zaawansowane szkolenia z designu prezentacji (typografia, brand design) — post‑V2.
- Future enhancements (post‑V2):
  - “deck review mode” (AI QA checklist + suggested fixes),
  - branżowe playbooki decków.

**Data / integrations (grounded in roadmap):**
- Treści muszą być spójne z:
  - T058 (Gamma.app‑level workflow: outline → iterate → export),
  - T059 (templates/brand kits),
  - T071 (citations/grounding),
  - export pipeline (`PptxPipelineService`) jako “jak działa jakość layoutu” (na poziomie konceptu).

**Analytics (events/metrics):**
- `education_presentations_opened`
- `education_presentations_module_completed`
- KPI: więcej wygenerowanych decków, mniej frustracji, mniej manualnych poprawek (self-report).

**Risks:**
- UI generatora będzie się zmieniać → treści muszą być modularne i łatwe do aktualizacji.

**Open questions:**
- Czy V2 ma mieć osobną lekcję “Deck types” (strategic review vs steering vs valuation) czy zostawić jako przykłady? (proponuję: jako przykłady)

**Definition of Done (DoD):**
- Materiały prowadzą przez typowy proces generowania decka w platformie.
- Treści są spójne z UI i aktualnymi funkcjami T058/T059.

**Acceptance / test plan:**
- Test: user przechodzi walkthrough “initiatives → deck” i jest w stanie wyeksportować PPTX bez ręcznego poprawiania layoutu (poza branding drobnymi).
- Test: materiały uczą iteracji outline i pracy z grounding/citations.

**Rollout plan:**
- Najpierw 1 walkthrough (initiatives→deck) + core lekcje, potem pozostałe 2 przykłady.

---

## T085 — 🟠 education — Education Module – Report Template Design and Usage (T060/T061: sponsor‑ready reports, step‑by‑step)
- Status spec: draft
- Link / ID (ClickUp): TBD
- Epic: Report adoption & quality (premium visuals, less rework) TBD
- Priorytet / V2 scope: V2

**Business challenge (problem):**
Żeby raporty były profesjonalne, user musi rozumieć:
- jak dobrać template do odbiorcy,
- jak ustawić scope i sekcje,
- jak iterować treść i układ (agent‑style) bez chaosu,
inaczej kończy się to ręcznym poprawianiem, długim czasem i niespójnymi deliverables.

**Cel (outcome, nie feature):**
Użytkownik potrafi wygenerować raport **sponsor‑ready** w platformie:
- dobiera template (T061),
- konfiguruje strukturę (T060),
- iteruje z agentem (T060 agent mode) i pilnuje grounding,
- eksportuje PDF/DOCX bez “naprawiania layoutu”.

**Użytkownicy i scenariusze:**
- Konsultant: “Assessment Summary” (DRD/SIRI/ADMA) → raport dla klienta.
- PMO: “Steering Committee Brief” → cykliczny status.
- CFO: “Financial Analysis” → raport z ratios/insights + next steps.

**Scope (V2)**
- IN:
  - Report Builder training track (MUST):
    - 6–10 krótkich lekcji (PL+EN), minimum:
      - source selection: co jest “approved source” i dlaczego,
      - template selection (T061): jak wybrać właściwy,
      - structure config: sekcje/bloki i kolejność,
      - agent mode: jak wydawać polecenia do zmiany układu/sekcji i jak czytać diff,
      - grounding/citations: jak unikać halucynacji i jak weryfikować,
      - export QA: PDF/DOCX hygiene (spisy treści, długość, closure).
  - Walkthroughs (MUST):
    - 2–3 przykłady end‑to‑end:
      - initiatives/execution → status report,
      - assessment → summary report,
      - finance → analysis report,
    - każdy przykład: template → configure → generate → 2 iteracje agentem → export.
  - Stakeholder best practices (MUST):
    - “Audience cards” (sponsor/PMO/CFO):
      - co musi być w raporcie,
      - jaki ton i długość,
      - jakie “next steps / closure”.
  - Contextual entrypoints (MUST):
    - w Report Builder UI: link “Learn: sponsor‑ready reports”,
    - z modułów (Assessment/Initiatives/Finance): link “Turn this into a report”.
  - Tracking (MUST):
    - progress per user (reuse help events / KB videos).
- OUT:
  - Pełny kurs technical writing i edycji redakcyjnej.
- Future enhancements (post‑V2):
  - “Report QA mode” (checklist + AI suggestions),
  - więcej szablonów branżowych.

**Data / integrations (grounded in roadmap/codebase):**
- Spójność z:
  - T060 (Structured Report Generator + agent mode),
  - T061 (Standardized Business Report Templates),
  - T071 (docs grounding/citations),
  - istniejący UI: `src/components/ReportBuilder/*` (wizard, template picker, editor).

**Analytics (events/metrics):**
- `education_reports_opened`
- `education_reports_module_completed`
- KPI: więcej eksportów PDF/DOCX, mniej ręcznych poprawek (self-report), szybszy time-to-export.

**Risks:**
- Zakres “customize” w generatorze będzie ewoluował → treści modularne i łatwe do aktualizacji.

**Open questions:**
- Czy V2 ma uczyć “jak projektować własny template” czy tylko “jak używać”? (proponuję: tylko używać; projektowanie post‑V2)

**Definition of Done (DoD):**
- Materiały są dostępne i powiązane z UI generatora raportów.
- Użytkownik potrafi wygenerować raport “sponsor‑ready” z template’ów i wyeksportować.

**Acceptance / test plan:**
- Test: user przechodzi walkthrough “assessment → report” i eksportuje PDF/DOCX bez ręcznego poprawiania układu.
- Test: lekcje uczą agent‑mode iteracji (dodaj sekcję, zmień kolejność, skróć rozdział) i weryfikacji grounding.

**Rollout plan:**
- Najpierw 1 walkthrough + core lekcje, potem pozostałe przykłady i audience cards.

---

## T086 — 🔵 admin — Build Unified Sync Hub for External Work Systems (integrations command center)
- Status spec: draft
- Link / ID (ClickUp): TBD
- Epic: Integrations & synchronization foundation TBD
- Priorytet / V2 scope: V2

**Business challenge (problem):**
Konsultanci i zespoły pracują równolegle w wielu narzędziach (komunikatory, kalendarze, email, storage, task managers). Bez jednego “sync hub”:
- admin nie widzi stanu połączeń i zdrowia synchronizacji,
- użytkownicy nie wiedzą “czy to działa”,
- rośnie chaos integracyjny i ryzyko bezpieczeństwa (tokeny, scope, webhooks).

**Cel (outcome, nie feature):**
Jest jedno, spójne miejsce w aplikacji do:
- konfiguracji i zarządzania integracjami,
- monitorowania health i historii sync runów,
- podstawowych akcji operacyjnych (connect / re‑auth / pause / run now / disconnect),
z jasną kontrolą uprawnień, scope’ów i audytem.

**Użytkownicy i scenariusze:**
- Admin org: łączy Slack + Google Workspace, widzi statusy, robi reauth, patrzy na błędy.
- PMO: chce wiedzieć czy import z Jira działa i kiedy był ostatni sync.
- Security/IT: chce wiedzieć jakie scope’y są nadane i móc odłączyć integrację.

**Scope (V2)**
- IN:
  - Unified “Integrations Hub” UI (MUST):
    - kanoniczny ekran w Admin/Settings (TBD routing) z sekcjami:
      - **Connected apps** (Slack/Teams/Jira/…): status, last sync, actions,
      - **Webhooks**: endpoints + subscriptions, signing secret, test event,
      - **Sync health**: ostatnie runy, błędy, retry,
      - **Permissions & scopes**: co integracja może czytać/pisać.
    - UX (Notion/ClickUp-level) (MUST):
      - lekkość i przejrzystość: **ClickUp-style table** jako domyślny widok (wyszukiwanie, filtry, sort, status chips),
      - akcje “inline” bez przeładowań (Connect / Re-auth / Pause / Run now / Disconnect),
      - czytelne stany: connected / pending / requires reauth / error + “what happened”,
      - szybkie “details drawer” z logami sync runów (jak w dużych SaaS),
      - **zero dummy danych** i “symbolicznych formułek” — wszystko z realnego API.
  - API & data model (grounded in codebase) (MUST):
    - wykorzystać istniejące endpointy i ujednolicić zachowanie:
      - `server/src/routes/integrations/integrations.routes.ts` (list/connect/disconnect/sync),
      - `server/src/routes/integrations/connectors.routes.ts` (connectors registry),
      - `server/src/services/integrationHubService.ts` (connector catalog + status model),
      - integracje webhooks: `server/src/routes/integrations/webhooks.routes.ts` + `webhookSubscriptions.routes.ts` (już są w repo).
    - zapewnić spójny status model:
      - connected / disconnected / error / requires_reauth / pending.
  - Sync runs + health monitoring (MUST):
    - dla każdej integracji:
      - last sync time,
      - ostatni wynik (success/failed + error summary),
      - przycisk “Run now”,
      - pause/resume (dla scheduled pulls/pushes),
    - historia runów min. 20–50 ostatnich (TBD retention).
  - Security & compliance (MUST):
    - least‑privilege: jasno pokazane scope’y,
    - bezpieczne przechowywanie sekretów/tokenów (encrypted at rest),
    - audit log: kto podłączył/odłączył, kto zrobił reauth, kto zmienił settings,
    - webhook security: signing secret + replay protection (TBD minimal).
  - “Minimal, but real” connector set (V2) (MUST):
    - V2 ma dostarczyć **realnie działające** integracje w kluczowych kategoriach (end‑to‑end, widoczne w hubie, bez stubów).
    - **Docelowa lista “Top 4” dostawców per kategoria (MUST target list):**
      - **Komunikatory (Top 4)**:
        - Slack
        - Microsoft Teams
        - WhatsApp
        - Google Chat
      - **Kalendarze (Top 4)**:
        - Google Calendar
        - Microsoft Outlook / Microsoft 365 Calendar
        - Apple Calendar (iCloud)
        - Generic CalDAV (dla pozostałych providerów enterprise)
      - **PMO / task managers (Top 4)**:
        - Jira
        - ClickUp
        - Asana
        - Monday.com
      - **Chmury / storage (Top 4)**:
        - Google Drive
        - Microsoft OneDrive / SharePoint
        - Dropbox
        - Box
      - **Maile (Top 4)**:
        - Gmail / Google Workspace
        - Microsoft Outlook / Microsoft 365
        - Zoho Mail
        - Generic IMAP/SMTP (dla pozostałych providerów)
    - **V2 minimal (twarde minimum jakości):**
      - co najmniej **1 integracja per kluczowa kategoria** powyżej ma działać end‑to‑end i być “demoable”,
      - reszta z listy Top 4 może być “coming soon”, ale tylko jeśli UI jasno to komunikuje (bez udawania działania).
    - V2 minimal (twarde minimum jakości): **co najmniej 1 integracja per kluczowa kategoria** powyżej ma działać end‑to‑end i być “demoable”.
    - pozostałe mogą być oznaczone jako “coming soon”, ale tylko jeśli UI nie sugeruje, że “działa”.
  - Error handling & UX (MUST):
    - czytelne komunikaty błędów (reauth required, invalid scopes, rate limit),
    - retry policy + manual retry.
- OUT:
  - Pełne wsparcie “wszystkich vendorów” i custom connectors w V2.
  - Zaawansowane, dwukierunkowe mapowania danych dla każdego systemu (post‑V2).
- Future enhancements (post‑V2):
  - “Sync policies” per project (co syncujemy i gdzie),
  - event‑driven sync (webhooks) vs polling,
  - data mapping UI (field mapping) dla zaawansowanych integracji.

**UX / UI notes (grounded in codebase):**
- Frontend ma już panel startowy: `src/components/Admin/IntegrationsManagementPanel.tsx` (webhooks + connected apps),
  - V2: podpiąć go do realnych endpointów (zamiast `SAMPLE_WEBHOOKS` i placeholderów).
 - UI ma trzymać standard “duże SaaS”:
   - app-table/module hub patterns z `docs/ui-standards/03-modules/app-table-standard.md`,
   - “Tech Sexy” (invisible borders, monochromatic chrome), bez ciężkich kart i bez przypadkowych kolorów.

**Analytics (events/metrics):**
- `integration_connected` / `disconnected`
- `integration_reauth_required` / `reauth_completed`
- `integration_sync_run_started` / `completed` (success/fail, provider)
- KPI: liczba aktywnych integracji, sync health, spadek “integration confusion”.

**Risks:**
- Złożoność + bezpieczeństwo → twarde scope, audit, encryption, rate limiting.
- Rate limits vendorów → backoff + throttling + caching.

**Open questions:**
- Które integracje z listy “Top 4” są MUST “end‑to‑end” w pierwszym releasie V2:
  - proponuję baseline demo: **Slack + Google Calendar + Jira + Google Drive + Gmail** (po 1 na kategorię), reszta “coming soon”.

**Definition of Done (DoD):**
- Jest jedno miejsce “Integrations Hub” z realnymi danymi: connected apps + webhooks + sync health.
- Admin może: connect, reauth, pause/resume, run now, disconnect.
- System przechowuje i pokazuje statusy + historię runów + audyt.
 - Nie ma żadnych “fake” integracji w UI: jeśli coś nie działa, jest oznaczone jako coming soon/disabled i nie udaje aktywnej funkcji.
 - Co najmniej 1 integracja per kluczowa kategoria (comms/calendar/PMO/cloud/email) działa end‑to‑end w V2 środowisku.

**Acceptance / test plan:**
- Test: admin podłącza Slack → wysyła test message → status “connected” + last action log.
- Test: admin uruchamia “Run now” dla integracji → widać sync run w historii (success/fail).
- Test: reauth required → UI pokazuje przyczynę i prowadzi do reautoryzacji.
 - Test: UI hubu ma tabelę z search/filter/sort i działa płynnie (bez “klocków” i bez dummy data).

**Rollout plan:**
- Najpierw hub + statusy + jedna integracja end‑to‑end, potem kolejne 2 i webhooks panel.

---

## T087 — 🩷 demo — Create Demo Company Story – Archilex (narrative backbone for demo)
- Status spec: draft
- Link / ID (ClickUp): TBD
- Epic: Demo readiness (Archilex) TBD
- Priorytet / V2 scope: V2

**Cel:**
Stworzyć spójną, fikcyjną historię firmy demo “Archilex”, która jest podstawą dla:
- scenariuszy demo,
- datasetu demo (T089),
- strony demo (T088),
tak aby demo było wiarygodne i “prowadziło” przez product flow.

**Zakres (V2):**
- IN (deliverables):
  - 1 dokument “Archilex story” (2–5 stron) zawierający:
    - profil firmy (branża, skala, geografie, kluczowe produkty/usługi),
    - 5–8 głównych problemów (strategia/operacje/digital/change/finanse),
    - cele transformacji (3–6) + KPI (10–20) (high-level),
    - roadmap “journey” (etapy 6–18 mies.) + kluczowe inicjatywy (8–15),
    - sponsor + PMO + change team (role i napięcia),
    - “demo storyline” (kolejność kroków w demie: tools/assessment → initiatives → execution → reports/decks),
  - 3 krótkie scenariusze demo (po 5–10 min):
    - “Executive overview”,
    - “Deep dive: initiatives & execution”,
    - “Deep dive: finance & ROI”.
- OUT:
  - Produkcja filmu.

**Zależności:**
- T088 (demo website) korzysta z tego story.
- T089 (demo dataset) ma być 1:1 spójny z narracją.
- T095 (visuals/screenshots) – jeśli występuje – ma wynikać ze scenariuszy.

**Definition of Done (DoD):**
- Dokument story istnieje i jest spójny (brak sprzeczności między problemami→celami→KPI→inicjatywami).
- Scenariusze demo są wykonalne w produkcie (bez “obietnic” feature’ów, których nie ma).

**Acceptance / test plan:**
- Test: osoba nieznająca produktu jest w stanie przeczytać story i przeprowadzić 10‑min demo według scenariusza.

---

## T088 — 🩷 demo — Develop Demo Website for Archilex Transformation (case context page)
- Status spec: draft
- Link / ID (ClickUp): TBD
- Epic: Demo credibility & narrative TBD
- Priorytet / V2 scope: V2

**Cel:**
Strona demo “Archilex” opisująca journey transformacji (challenge → solution → results) jako “case context” dla demo i VC.

**Zakres (V2):**
- IN (deliverables):
  - 1 strona (publiczna lub dostępna w demo env) z sekcjami:
    - **Challenges** (5–8 punktów),
    - **Solutions / Program** (etapy + inicjatywy high‑level),
    - **Results** (KPI + narracja “what improved”),
    - “See it in platform” CTA (linki do demo login / konkretnych modułów),
  - spójność języka i liczb z T087 (story) i T089 (dataset),
  - assets: 6–12 screenshotów/visuals (T095) (jeśli dostępne) lub placeholdery.
- OUT:
  - Publiczne SEO i pełny marketing site.

**Implementation notes (lightweight):**
- Prefer reuse istniejących public views/layout:
  - `src/views/PublicLandingPage.tsx` (style/sections)
  - `src/views/ToolsShowcasePage.tsx` (karty/CTA/video modal pattern)
- Route: TBD (np. `/demo/archilex`).

**Definition of Done (DoD):**
- Strona jest dostępna i wspiera scenariusze prezentacji (da się na niej “ustawić kontekst” w 2–3 min).
- Nie ma sprzeczności z datasetem demo i zachowaniem aplikacji.

**Acceptance / test plan:**
- Test: prowadzący demo otwiera stronę → w 2 min ustawia kontekst, potem przechodzi do aplikacji po CTA.

---

## T089 — 🩷 demo — Build Comprehensive Demo Dataset – Archilex (realistic, deterministic, 0 dead ends)
- Status spec: draft
- Link / ID (ClickUp): TBD
- Epic: Demo environment readiness TBD
- Priorytet / V2 scope: V2

**Cel:**
Kompletny, realistyczny dataset “Archilex” umożliwiający przejście przez kluczowe scenariusze demo bez pustych ekranów i bez “broken flows”.

**Zakres (V2):**
- IN (deliverables):
  - deterministyczny seed datasetu (idempotent):
    - stałe IDs (łatwe deep-linki i testy),
    - opcja `--clean` i `--verify` (jak w istniejącym `seedLegolexDemoOrg.js`),
    - blokada przed produkcją (PRODUCTION GUARD),
  - użytkownicy demo (MUST):
    - 3–4 konta (deterministyczne IDs) z różnymi rolami i “perspektywą”:
      - **Admin/Owner** (pełny dostęp, pokazuje konfigurację, integracje, billing/trial),
      - **PMO / Program Manager** (Initiatives/Execution/Benefits, governance),
      - **CFO/Finance** (Finance/ROI/valuation/reporting; read/write tam gdzie potrzebne),
      - (opcjonalnie) **Consultant** (Tools/workshops, report/deck generator),
    - każde konto ma:
      - przypisanie do tej samej organizacji Archilex,
      - prekonfigurowany “landing context” (np. pinned items / recent artifacts) (TBD minimal).
  - dane pokrywające kluczowe moduły (minimum):
    - Organization profile/context (T063 / context builder) – podstawowe informacje firmy,
    - Projects (2–4) + roles/members,
    - Initiatives (12–18) w różnych statusach (draft/planning/executing/done/cancelled), w tym:
      - 3 “hero initiatives” z pełnym powiązaniem (tasks+decisions+RAID+KPI+ROI),
      - 3 w execution (żeby było co monitorować),
      - 2 zakończone (benefits realized),
      - 2 zablokowane (risk/decision dependency),
      - reszta jako tło portfolio (różne osie: strategic/operational/digital/change/finance),
    - Execution:
      - tasks (45–70) (mix: overdue, blocked, done, w trakcie),
      - decisions (12–20) (mix: pending, approved, escalated),
      - RAID (12–20) (mix: risk/issue, różne severity),
    - Benefits/KPI:
      - KPI (14–22) + mapping do inicjatyw (T047) + kilka history points (jeśli model wspiera),
    - ROI/economics: CAPEX/OPEX/ROI assumptions na części inicjatyw (T046),
    - Reports/decks:
      - min. 3 gotowe artefakty (np. assessment summary report, steering brief, finance snapshot),
      - min. 2 decki (np. executive overview, initiatives update),
      - (mogą być pre-seeded jako “instances”),
    - Tools sessions:
      - 6–10 sesji narzędzi (T019–T021 / Discovery Tools) z wynikami i closure,
      - minimum 2 sesje “completed” z wygenerowanymi inicjatywami,
  - spójność 1:1 z T087 (story) i T088 (demo website):
    - te same nazwy, KPI, inicjatywy, “wyniki” (bez sprzeczności).
- OUT:
  - Import/export datasetów klientów (osobny temat).

**Implementation notes (lightweight but concrete):**
- Reuse wzorce z istniejących seedów:
  - `server/scripts/seedLegolexDemoOrg.js` (determinism, clean/verify, guards),
  - `server/scripts/seed-demo-initiatives.js` (inicjatywy),
  - `server/src/routes/demo.routes.ts` (demo mode / org info).
- Prefer 1 skrypt “seed-archilex-demo-org.(ts/js)” jako single entrypoint, który woła mniejsze seedery (modularnie).

**Definition of Done (DoD):**
- Dataset pozwala przejść przez główne demo ścieżki bez pustych widoków:
  - tools/assessment → initiatives → execution → benefits/ROI → report/deck.
- Seed jest idempotent (można uruchomić wielokrotnie bez dublowania).
- Jest check/verify mode, który raportuje brakujące elementy datasetu.

**Acceptance / test plan:**
- Test: “0 dead ends” checklist:
  - każdy moduł ma realne rekordy (nie tylko placeholder),
  - co najmniej 3 inicjatywy mają pełne powiązania (tasks + decisions + RAID + KPI + ROI),
  - co najmniej 1 report i 1 deck są dostępne do pokazania,
  - demo mode toggle działa i przełącza na Archilex org.
- Test: seed `--verify` zwraca OK (brak braków).

---

## T090 — 🩷 demo — Design Demo-to-Trial Conversion Flow (demo → sign-up → trial activation, measurable)
- Status spec: draft
- Link / ID (ClickUp): TBD
- Epic: Growth foundation (demo conversion) TBD
- Priorytet / V2 scope: V2

**Business challenge (problem):**
Demo bez ścieżki konwersji nie monetyzuje: użytkownik ogląda, ale nie wie co dalej / nie ma “next step” i odpada.

**Cel (outcome, nie feature):**
Demo user ma jasną, nieagresywną ścieżkę:
- zobacz wartość (value moments),
- zrób 1–2 konkretne akcje,
- zarejestruj się i aktywuj trial,
z minimalnym tarciem i pełną mierzalnością.

**Scope (V2)**
- IN:
  - Conversion journey design (MUST):
    - definicja 3–5 “value moments” w demie (np.):
      - “AI chat understands context”,
      - “tool → closure → initiatives generated”,
      - “initiative → execution signals”,
      - “report/deck generated”,
    - po każdym value moment: jedno CTA “Continue / Next step” (nie paywall).
  - Demo CTA surfaces (MUST):
    - persistent “Start trial” button (subtelny, nie spam),
    - kontekstowe CTA w kluczowych punktach:
      - po wygenerowaniu raportu/decku,
      - po utworzeniu inicjatywy,
      - po ukończeniu tool session,
    - CTA pamięta “gdzie user był” (po trial wraca do tego miejsca) (TBD minimal).
  - Friction control (MUST):
    - sign-up flow skrócony (minimum pól),
    - możliwość kontynuacji od razu po rejestracji (bez “empty org” — prefill z onboarding wizard),
    - jasne komunikaty co jest w trial, a co nie (spójne z T091).
  - Instrumentation / analytics (MUST):
    - eventy end-to-end:
      - `demo_started`, `demo_value_moment_reached` (type),
      - `demo_cta_clicked` (location),
      - `signup_started`, `signup_completed`,
      - `trial_activated`,
    - funnel report (minimum: query/report, post‑V2: UI dashboard).
  - Integration with demo mode (MUST):
    - wykorzystać istniejący demo mode toggle (`/api/demo/*`) jako wejście,
    - po trial activation: wyjście z demo org do trial org, bez utraty “storyline”.
- OUT:
  - Pełny growth experimentation platform (A/B, segmenty).
- Future enhancements (post‑V2):
  - personalizacja CTA per persona (CFO vs PMO),
  - guided tour overlay,
  - “send me report/deck” gated by email (lead capture) (TBD).

**Risks:**
- Zbyt agresywne CTA → spadek zaufania (V2: subtelne, value-first).
- Za duże tarcie w rejestracji → spadek konwersji.

**Open questions:**
- Czy trial activation ma być:
  - (A) self-serve natychmiast,
  - (B) wymaga “request access” (sales-led)?
  (V2: rekomenduję A dla product-led, z opcją kontaktu sales.)

**Definition of Done (DoD):**
- Użytkownik ma jasną ścieżkę demo → trial i może aktywować trial.
- Flow jest mierzalny eventami i da się policzyć demo→trial conversion.

**Acceptance / test plan:**
- Test: demo user przechodzi 2 value moments → klika “Start trial” → rejestracja → trial aktywny → wraca do kontekstu.
- Test: eventy funnel są emitowane dla każdego kroku.

---

## T091 — 🟣 trial — Define Technical Trial Architecture and Access Rules (entitlements + quotas + honest gating)
- Status spec: draft
- Link / ID (ClickUp): TBD
- Epic: Monetization foundation (trial rules & enforcement) TBD
- Priorytet / V2 scope: V2

**Business challenge (problem):**
Trial musi pokazywać wartość, ale nie może oddawać wszystkiego za darmo. Jednocześnie nie może tworzyć “mystery blocks” — user musi rozumieć co jest zablokowane, dlaczego i co zrobić dalej.

**Cel (outcome, nie feature):**
W V2 mamy spójną, technicznie egzekwowaną architekturę trial:
- limity i gating są centralnie zdefiniowane,
- egzekwowane w API (nie tylko w UI),
- komunikaty są jasne i mierzalne,
- trial ma czytelne stany: active → warning → critical → expired → (upgrade).

**Scope (V2)**
- IN:
  - Canonical policy model (MUST):
    - orgType: DEMO / TRIAL / PAID (kanonicznie),
    - trial timing: `trial_started_at`, `trial_expires_at` + warning levels (T-7 / T-3 / expired),
    - limits per org:
      - max projects / users / initiatives,
      - max storage,
      - AI usage: daily calls + total token budget,
      - allowed AI roles (np. “ADVISOR”).
  - Enforcement points (MUST, grounded in codebase):
    - central policy check w backendzie (preferred: `AccessPolicyService.checkAccess` / `AccessTrialService`),
    - quota enforcement dla AI i uploadów (`quota.middleware.ts`) — spójne z trial budget,
    - demo mode = read-only (już istnieje w AccessPolicyService).
  - Trial conversion plumbing (MUST):
    - `/api/trial/:trialId/convert` ma działać (obecnie TrialService jest placeholderem),
    - implementacja `trialService` dla:
      - `convertTrialToOrg`,
      - `sendTrialWarnings` (T-7, T-3),
      - `processExpiredTrials` (lockdown/expiry),
    - cron (`TrialCron`) przestaje być “skip” i realnie wykonuje zadania.
  - Honest UX gates (MUST):
    - gdy akcja zablokowana:
      - zawsze zwracamy `errorCode` + “reason” + recommended next step,
      - UI pokazuje “why” + CTA upgrade (bez frustracji).
    - zakaz “symbolicznych formułek”: jeśli feature jest coming soon lub nie ma integracji, UI nie udaje działania.
  - Trial entitlements matrix (MUST):
    - V2 definiuje jawnie co jest:
      - allowed,
      - limited,
      - blocked,
    - minimum: trial pozwala przejść 3–5 “value moments” (T090), ale limity wymuszają upgrade przy realnym użyciu.
  - Anti‑abuse (MUST):
    - ochrona przed obchodzeniem limitów (np. multi-org spam, resetowanie),
    - rate limiting (już jest) + audyt akcji trial.
- OUT:
  - Pełny pricing experimentation system i dynamiczny paywall (post‑V2).

**Data / integrations (grounded):**
- W repo już istnieją fundamenty:
  - `server/src/services/access/AccessTypes.ts` (DEFAULT_TRIAL_LIMITS, ORG_TYPES, TRIAL_DURATION_DAYS),
  - `AccessLimitService`, `AccessTrialService`, `AccessUsageService`, `AccessPolicyService`,
  - `TrialCron` i `trial.routes.ts`,
  - `quota.middleware.ts` + `usageService.ts`.
- V2: doprowadzić do spójności “trial token budget”:
  - jedna prawda dla “tokens used” i “token limit” (TBD implementacja, ale musi być spójna w API + UI).

**Analytics (events/metrics):**
- `trial_started` / `trial_warning_shown` / `trial_expired`
- `trial_blocked_action` (errorCode, feature)
- `trial_upgrade_cta_clicked`
- KPI: activation, conversion, churn w trial; spadek “mystery blocks”.

**Risks:**
- Zbyt restrykcyjne limity → user nie zobaczy wartości.
- Zbyt luźne limity → brak motywacji do upgrade.

**Open questions:**
- Jakie limity V2 są docelowe (projekty/użytkownicy/inicjatywy/tokens)? (mamy defaulty w kodzie, ale trzeba je zatwierdzić biznesowo)

**Definition of Done (DoD):**
- Trial ma zdefiniowane limity i jest egzekwowany technicznie (API-first).
- Użytkownik rozumie zasady (jasne komunikaty) i nie trafia na “mystery blocks”.
- Trial warnings i expiry processing działają (cron + notifications).

**Acceptance / test plan:**
- Test: TRIAL org przekracza limit (np. initiatives lub tokens) → API blokuje z `errorCode`, UI pokazuje “why” + CTA.
- Test: T-7 i T-3 warning jest wysyłany, a po expiry org przechodzi w lockdown.
- Test: `/api/trial/:trialId/convert` działa i tworzy właściwą org po potwierdzeniu.

---

## T092 — 🟣 trial — Design Trial-to-Paid Conversion Path (upgrade mechanics + messaging + smooth checkout)
- Status spec: draft
- Link / ID (ClickUp): TBD
- Epic: Monetization & conversion (trial → paid) TBD
- Priorytet / V2 scope: V2

**Business challenge (problem):**
Użytkownik w trial widzi wartość, ale bez precyzyjnej ścieżki upgrade (kiedy, gdzie, dlaczego, jak) odpada w najgorszym momencie: przy limicie albo po expiry. Drugi problem: “agresywny paywall” psuje zaufanie. Potrzebujemy conversion path, który jest value‑first i jednocześnie skuteczny.

**Cel (outcome, nie feature):**
Trial user rozumie:
- **co zyskuje na paid** (konkretne odblokowania i podniesienie limitów),
- **kiedy powinien upgrade’ować** (trigger-based, nie losowo),
- **jak to zrobić** (checkout/procurement bez tarcia),
a produkt mierzy pełny lejek trial → paid.

**Scope (V2)**
- IN:
  - Upgrade triggers (MUST):
    - Trial expiry (T091) → read-only + banner + CTA upgrade.
    - “Approaching limit” (np. 70–90% usage) → subtelne ostrzeżenia + link do planów.
    - “Blocked action” (AccessPolicy / AccessBlockedModal) → CTA kontekstowe (“Upgrade / Add payment method”).
    - Intent-based: user wchodzi do `/settings/billing` i widzi jasne “next step”.
  - Value messaging & progressive unlocking (MUST):
    - komunikaty w UI muszą mówić “dlaczego” (np. “AI token budget exceeded” → “dodaj payment method dla PAYG/hybrid” albo “upgrade planu”),
    - brak “mystery blocks”: każda blokada ma `errorCode`, copy i CTA (spójne z T091),
    - upgrade copy jest spójne z value moments z T090 (user pamięta co już osiągnął).
  - Plan selection UX (MUST):
    - ekran porównania planów z limitami i benefitami (czytelnie: AI tokens, storage, seats, integracje, eksport),
    - jasna informacja “co się zmieni od razu po upgrade” (odblokowania + nowe limity),
    - obsługa kuponów/discount code (jeśli dostępne) + VAT/Tax settings dla firm.
  - Checkout + subscription lifecycle (MUST, grounded in existing stack):
    - flow: wybierz plan → dodaj metodę płatności → potwierdź → natychmiastowe odblokowanie,
    - obsługa statusów: `trialing` / `active` / `past_due` / `cancelled` (czytelne komunikaty i “co dalej”),
    - “payment failed” (dunning) → komunikat + szybkie naprawienie metody płatności.
  - Product instrumentation (MUST):
    - eventy:
      - `upgrade_viewed` (location),
      - `upgrade_cta_clicked` (reason: expired/limit/intent),
      - `plan_selected` (planId),
      - `checkout_started` / `checkout_completed` / `checkout_failed`,
      - `subscription_activated` / `subscription_cancelled`,
    - metryki: trial→paid conversion, time-to-upgrade, drop-off w checkout, top reasons for upgrade.
  - Comms (MUST):
    - email / in-app dla:
      - T-7, T-3 (warning),
      - expiry,
      - payment failed,
    - wiadomości muszą być krótkie, konkretne, “what next”.
- OUT:
  - Kompleksowe eksperymenty paywall (segmenty, A/B), zaawansowany pricing lab (post‑V2).

**Implementation notes (grounded w repo, bez “z kosmosu”):**
- UI i entrypoints już istnieją i wymagają dopięcia do spójnego conversion path:
  - `src/components/access/AccessBlockedModal.tsx` (CTA m.in. na `/settings/billing`),
  - `src/contexts/AccessPolicyContext.tsx` + `/api/organization/policy-snapshot` (banner + upgradeCtas),
  - `src/components/shared/BillingCore.tsx` i `src/components/settings/modules/BillingSubscriptionModule.tsx`,
  - backend: `server/src/routes/billing/billing.routes.ts` + Stripe webhooks (`server/src/routes/webhooks/stripe.routes.ts`).
- V2: “single narrative”:
  - T090 prowadzi do trial,
  - T091 egzekwuje limity,
  - T092 daje najlepszą możliwą ścieżkę wyjścia (upgrade) dokładnie w momentach, gdy user ma motywację.

**Risks:**
- Zbyt nachalne CTA → spadek zaufania (V2: value-first + trigger-based, bez spamowania).
- Checkout friction (VAT, payment methods) → drop-off.
- Niespójność planów/limitów (UI vs backend) → support load.

**Open questions:**
- Jakie są docelowe plany V2 (nazwy, ceny, limity) i czy dopuszczamy model hybrid/PAYG w trial (w kodzie jest już “payment method unlock beyond free budget” dla tokenów)?

**Definition of Done (DoD):**
- Trial user ma spójną, powtarzalną ścieżkę upgrade (z każdego głównego triggera).
- Checkout jest “smooth” i po sukcesie natychmiast odblokowuje dostęp (policy snapshot + gating się aktualizuje).
- Lejek trial→paid jest mierzalny end‑to‑end.

**Acceptance / test plan:**
- Test: TRIAL user przekracza limit tokenów → widzi jasny komunikat + CTA → dodaje payment method / wybiera plan → po sukcesie AI działa dalej.
- Test: trial expired → org read‑only → “Upgrade Now” prowadzi do planów → aktywacja subskrypcji przywraca write access.
- Test: payment failed → status `past_due` → user widzi “fix payment” i wraca do `active`.

---

## T093 — 🟢 landing — Legal Agreements Update and User Acceptance Flow Optimization (versioning + acceptances + low friction)
- Status spec: draft
- Link / ID (ClickUp): TBD
- Epic: Trust & conversion foundation (legal + compliance UX) TBD
- Priorytet / V2 scope: V2

**Business challenge (problem):**
Bez poprawnych, łatwo dostępnych umów i poprawnie zapisanych akceptacji ryzykujemy: compliance (GDPR/ToS), spory w billing/trial oraz drop-off w rejestracji, jeśli flow jest zbyt ciężkie. Dodatkowo w kodzie już istnieją elementy UI pod akceptacje, ale API jest niespójne/niekompletne, co grozi “mystery blocks” i 503.

**Cel (outcome, nie feature):**
W V2 mamy Legal Center + akceptacje “enterprise-grade”:
- legal docs są wersjonowane i publikowane z jednego źródła prawdy,
- wymagane akceptacje są egzekwowane po loginie / przy zmianie wersji,
- user widzi krótkie, jasne summary + może rozwinąć pełny tekst,
- akceptacje są zapisywane z metadanymi (czas, IP, UA) i audytowalne.

**Scope (V2)**
- IN:
  - Canonical document set (MUST):
    - minimum wymagane do użycia platformy: `TOS`, `PRIVACY`,
    - polityki użytkowania: `AUP`, `AI_POLICY` (wymagane jeśli AI jest dostępne),
    - `COOKIES` (informacyjne, acceptance zależne od jurysdykcji / ustawień),
    - `DPA` (org-level, akceptuje admin/owner — jeśli org jest paid lub enterprise),
    - business docs dla billing (informacyjne, ale publikowane): `SUBSCRIPTION`, `SLA`, `REFUNDS`.
  - Versioning & publishing (MUST):
    - superadmin publikuje nową wersję (UI już istnieje: `SuperAdminLegalView`),
    - jedna aktywna wersja per `docType` (+ archiwum),
    - `effectiveFrom`, opcjonalnie `expiresAt`,
    - opcjonalnie “reacceptRequiredFrom” (data, od której trzeba re-zaakceptować).
  - Acceptance tracking (MUST, API-first):
    - API endpoints (spójne z UI w repo):
      - `GET /api/legal/active` → lista aktywnych dokumentów (docType, version, title, effectiveFrom),
      - `GET /api/legal/active/:docType` → pełny dokument (contentMd) + metadata,
      - `GET /api/legal/my-acceptances` → lista akceptacji usera (docType, version, acceptedAt),
      - `GET /api/legal/pending` → required/pending docs dla usera + (opcjonalnie) DPA dla org admin,
      - `POST /api/legal/accept` → zapis akceptacji (scope: USER / ORG_ADMIN).
    - akceptacje zapisują: acceptedAt, IP, userAgent.
  - Acceptance UX (MUST, low friction):
    - modal “Legal updates required” (komponent już istnieje: `LegalAcceptanceModal`),
    - checkbox per dokument + “Accept & continue” aktywne dopiero gdy wszystkie wymagane zaznaczone,
    - quick summary (3–7 bulletów “co się zmieniło / co ważne”), pełny tekst dopiero po expand,
    - user wraca dokładnie tam, gdzie był (brak utraty kontekstu w aplikacji).
  - Registration/onboarding integration (MUST):
    - flow nie dubluje się: onboarding `/api/onboarding/accept-terms` i legal acceptance muszą być spójne.
    - V2: jedno źródło prawdy dla “czy user zaakceptował wymagane dokumenty”.
  - Routing & link integrity (MUST):
    - Legal Center (`/legal`) jest publicznie dostępny i zawiera komplet dokumentów,
    - wszystkie linki w aplikacji prowadzą do poprawnych tras (np. Cookie banner nie może linkować do martwego `/cookies` jeśli canonical jest `/legal/cookies`).
- OUT:
  - Pełny multi‑locale legal docs dla wszystkich 6 języków (V2 minimum: EN+PL, reszta post‑V2),
  - skomplikowane jurysdykcyjne warianty umów (post‑V2).

**Data model (V2, canonical):**
- `legal_documents` (aktywna wersja per docType):
  - `id`, `doc_type`, `version`, `title`, `content_md`,
  - `effective_from`, `expires_at?`, `is_active`,
  - `created_by`, `previous_version_id?`, `change_summary?`,
  - `scope_type` (`global`/`org`), `scope_value?` (np. orgId).
- `legal_document_acceptances`:
  - `id`, `user_id`, `organization_id?`,
  - `document_id`, `doc_type`, `doc_version`,
  - `accepted_at`, `ip_address`, `user_agent`.

**Analytics / metrics:**
- `legal_acceptance_modal_shown` / `legal_doc_expanded` / `legal_accept_submitted`
- `legal_acceptance_completed` (time_to_accept)
- KPI: drop‑off w rejestracji po kroku legal, liczba support ticketów dot. “why blocked”.

**Risks:**
- Niespójność schematu DB (w repo są ślady różnych wariantów kolumn) → V2 musi wymusić jeden kontrakt API.
- Zbyt długie dokumenty w modalu → drop-off (V2: summary-first).

**Definition of Done (DoD):**
- Legal docs są publikowane i pobierane z jednego API, a akceptacje działają end‑to‑end.
- `pending`/`accept`/`my-acceptances` nie zwracają 503 w standardowym środowisku.
- Użytkownik rozumie “co akceptuje” i nie ma “mystery blocks”.

**Acceptance / test plan:**
- Test: nowy user → login → modal akceptacji TOS+PRIVACY → po akceptacji dostęp do aplikacji.
- Test: publikacja nowej wersji TOS → istniejący user dostaje wymaganie re-accept → po akceptacji znika blokada.
- Test: org admin widzi dodatkowo DPA (jeśli wymagane) i może zaakceptować dla org.

---

## T094 — 🟢 landing — Documentation Section – Landing Page Structure & Content (trust, clarity, deep links)
- Status spec: draft
- Link / ID (ClickUp): TBD
- Epic: Trust & conversion foundation (website) TBD
- Priorytet / V2 scope: V2

**Business challenge (problem):**
Na B2B SaaS landing bez “Docs / Security / API / Changelog” wygląda jak marketing‑only. Dla klientów i VC brak widocznej dokumentacji = niższy trust, trudniejszy sales cycle i gorsza konwersja.

**Cel (outcome, nie feature):**
Landing ma sekcję “Documentation” w standardzie nowoczesnych SaaS:
- pokazuje kluczowe obszary produktu w sposób klarowny,
- prowadzi użytkownika do realnych, działających zasobów (public docs),
- buduje zaufanie (security, legal, changelog),
- jest spójna językowo i wizualnie z produktem.

**Scope (V2)**
- IN:
  - Landing “Docs section” (MUST):
    - sekcja na głównej stronie wejściowej (`src/views/ProductEntryPage.tsx`) i (jeśli używana publicznie) na `src/views/PublicLandingPage.tsx`,
    - blok ma mieć nagłówek, krótki opis “co znajdziesz w docs”, oraz 4–6 kart/shortcutów.
  - Shortcut / deep links (MUST, real routes):
    - `Getting Started` → `/docs` + konkretny start link (np. `/docs/quick-guides/getting-started-consultinity`),
    - `Security` → `/docs/security`,
    - `API Reference` → `/docs/api`,
    - `Changelog` → `/docs/changelog`,
    - `Legal Center` → `/legal`,
    - opcjonalnie: `Integrations` → odpowiednia kategoria w `/docs/:categorySlug` (jeśli jest).
  - Search entrypoint (MUST):
    - mini search box lub “Search docs” CTA, które kieruje do `/docs/search?q=...` (ten route już istnieje),
    - klawiszologia nie jest wymagana na landing (docs portal już ma Cmd/Ctrl+K).
  - Copy & IA (MUST):
    - treść jest “professional SaaS”, bez nadmiernych claimów,
    - spójność messagingu z T070 (Platform Overview) i T095 (Full Website Content Replacement).
  - “Freshness” signals (MUST):
    - wyświetlenie “Last updated” (np. z changelog lub statycznie w V2), żeby nie wyglądało martwo,
    - link “See what’s new” → `/docs/changelog`.
  - i18n (MUST):
    - minimum EN+PL dla tej sekcji (reszta języków zgodnie z globalnym standardem aplikacji, post‑V2 jeśli brak treści),
    - unikać hardcoded brand names niezgodnych z produktem (w repo są ślady “IRIS Docs” — do ujednolicenia w T095).
  - Analytics (MUST):
    - `landing_docs_section_viewed`
    - `landing_docs_cta_clicked` (target: docs/security/api/changelog/legal, location)
    - `landing_docs_search_used` (query length, no raw query storage jeśli PII risk)
- OUT:
  - Pełny “developer portal” (SDK, keys onboarding, try‑it‑out) — to osobny temat, post‑V2.

**UX / UI requirements (V2 quality bar):**
- “Tech sexy” i czytelnie: mało szumu, dobre spacing, typografia hierarchy, subtelne bordery.
- Zero martwych linków: każdy kafel prowadzi do istniejącej trasy.
- Mobile-first: karty składają się w 1 kolumnę, CTA zawsze widoczne.

**Definition of Done (DoD):**
- Sekcja “Documentation” jest na landing i ma działające linki do `/docs/*` i `/legal`.
- Copy jest spójne i zrozumiałe (PL+EN).
- Emitowane są eventy dla kliknięć (minimum).
- Brak “dead ends” (404/route mismatch) dla wszystkich CTA.

**Acceptance / test plan:**
- Test: landing → klik “Security / API / Changelog / Legal” → poprawna strona ładuje się bez błędów.
- Test: wpisanie query w search (jeśli jest) → przejście na `/docs/search?q=...`.
- Test: w mobile (viewport) układ sekcji nie psuje się i CTA są dostępne.

---

## T095 — 🟢 landing — Full Website Content Replacement & Visual Update (market story + screenshots + brand consistency)
- Status spec: draft
- Link / ID (ClickUp): TBD
- Epic: Market-ready website (positioning + trust) TBD
- Priorytet / V2 scope: V2

**Business challenge (problem):**
Jeśli strona WWW ma niespójny przekaz, nazewnictwo i screeny niezgodne z produktem, to:
- obniża zaufanie (klient/VC widzi “prototype marketing”),
- utrudnia sprzedaż (brak klarownej narracji “co to jest” i “dlaczego teraz”),
- psuje konwersję demo/trial (CTA nie prowadzą do konkretnych value moments).

**Cel (outcome, nie feature):**
W V2 WWW ma być “ready to show the world”:
- jedna spójna narracja: **transformation AI consulting system** (human governance + AI acceleration),
- spójne nazwy i brand (brak miksu “IRIS / TechnoLex / Consultinify”),
- aktualne screeny/visuale zgodne z realnym UI V2,
- spójne CTA prowadzące do demo/trial (T090–T092),
- kompletna warstwa trust (docs, security, legal, changelog).

**Scope (V2)**
- IN:
  - Messaging & copy replacement (MUST):
    - update treści na public entry:
      - `src/views/ProductEntryPage.tsx` + sekcje `HeroSection`, `InfoSections`, `TrustStrip`, `KnowledgePreviewSection`, `EntryFooter`,
      - `src/views/BecomePartnerView.tsx` (partner pitch spójny z produktem),
      - `src/views/AppPricingView.tsx` (język, claimy i definicje: AI credits/BYOK/managed AI spójne z billing),
      - `src/views/ChangelogView.tsx` (subtitle i nazwy produktu),
      - docs portal headline (`DocsLayout`, `DocsHomeView`) — nazwa produktu i ton.
    - copy jest “trust-first”: konkret, bez marketingowego szumu, bez obiecywania funkcji których nie ma.
    - spójność z T070 (Platform Overview Content) i T094 (Docs section).
  - Visual update (MUST):
    - wymiana/uzupełnienie assetów w stylu “cinematic” (już używane na landing) tak, żeby odzwierciedlały realne moduły V2,
    - screeny muszą pokazać N‑style / C‑style tam gdzie to jest ważne (np. organization workspace, initiatives, report/deck builder, integrations hub, billing).
  - Screenshot capture & governance (MUST):
    - playbook do produkcji screenów:
      - demo org/dataset (T089),
      - stałe rozdzielczości (desktop + mobile),
      - stały theme (light/dark) + brand colors,
      - anonimizacja/PII policy (zero realnych danych),
      - “no dead ends” (każdy pokazany ekran jest osiągalny).
    - minimalny zestaw (V2): 8–12 screenów + 2–3 hero visuals.
  - IA / navigation polish (MUST):
    - top-level wejścia: Demo, Trial, Docs, Pricing, Partner program, Security/Legal, Changelog,
    - wszystkie linki działają i prowadzą do istniejących tras (Route integrity).
  - Consistency cleanup (MUST):
    - ujednolicenie brand name w UI publicznych stron (docs i changelog nie mogą używać innych nazw produktu),
    - usunięcie literówek w nazwie produktu (np. “Consultinify”),
    - ujednolicenie “Docs” tytułów (np. “Consultinity Docs”, nie “IRIS Docs”).
  - i18n (MUST):
    - core public pages w 6 językach aplikacji (`en`, `pl`, `de`, `ar`, `jp`, `es`) z poprawną obsługą RTL (`ar`),
    - V2 quality bar:
      - EN+PL: copy dopracowane manualnie,
      - pozostałe języki: poprawne semantycznie (minimum), bez “broken sentences” (polish post‑V2).
  - Minimal SEO & sharing (MUST):
    - meta title/description per główne public route (Landing, Docs, Pricing, Partner, Security, Legal),
    - OpenGraph (share image) spójny z nowymi visualami.
- OUT:
  - pełny redesign brand identity / rebranding (post‑V2),
  - kompleksowy developer portal (SDK, keys onboarding, “try it out” z realnym OpenAPI) — osobny epik (post‑V2).

**Analytics / metrics (V2):**
- `landing_viewed` + `landing_primary_cta_clicked` (trial/demo)
- `landing_docs_cta_clicked` (T094)
- `pricing_viewed` + `pricing_cta_clicked`
- KPI: conversion (landing → demo/trial), scroll depth, time on page, CTR do docs/security/legal/changelog.

**Risks:**
- Rozjazd “what we claim” vs “what product does” → ryzyko zaufania (V2: zero fikcyjnych funkcji).
- Brak świeżych screenów (czas) → WWW wygląda “stare”.
- i18n na 6 języków bez kontroli jakości → wizerunkowy risk (V2: guardrails jak wyżej).

**Definition of Done (DoD):**
- Public pages mają spójny przekaz i brand (jedna nazwa produktu w całym WWW).
- Screeny/visuale są aktualne i pokazują realne moduły V2 (brak “placeholder”).
- Wszystkie public linki działają (brak 404 / dead ends).
- Core content jest dostępny w 6 językach (RTL działa dla `ar`).

**Acceptance / test plan:**
- Test: wejście na `/` + nawigacja do Demo/Trial/Docs/Pricing/Partner/Security/Legal/Changelog bez błędów.
- Test: porównanie nazw: brak “IRIS/TechnoLex” na public stronach (o ile nie jest to świadoma nazwa produktu).
- Test: mobile viewport — hero i CTA są czytelne i nie “skaczą”.

---

## T096 — 🟢 partners — Partner Program Toolkit & Promotional Materials (downloadable pack + always current)
- Status spec: draft
- Link / ID (ClickUp): TBD
- Epic: Partner growth foundation (enablement) TBD
- Priorytet / V2 scope: V2

**Business challenge (problem):**
Partnerzy bez “gotowców” (deck/one-pager/email scripts/case studies) sprzedają niespójnie, wolniej i z większą liczbą błędów (claimy niezgodne z produktem). To zabija konwersję i zwiększa koszt wsparcia.

**Cel (outcome, nie feature):**
Partner ma w portalu partnera 1 miejsce, gdzie:
- pobiera zawsze aktualne materiały,
- widzi jasne “jak używać” (do jakiej persony / etapu sprzedaży),
- ma skrypty i template’y pod trial → paid (T090–T092),
- ma assety (logo/screens) zgodne z WWW V2 (T095).

**Scope (V2)**
- IN:
  - Partner Toolkit Pack (MUST, minimum deliverables):
    - **Product one‑pager (PDF)**:
      - “co to jest”, 3–5 value props, 3–5 differentiators, security/compliance short block, CTA (demo/trial),
      - wersje: PL + EN.
    - **Sales deck template (PPTX / Google Slides link)**:
      - 10–15 slajdów: problem → approach → platform modules → outcomes → pricing entrypoints → case snippet,
      - wersje: PL + EN,
      - “safe claims” (bez obietnic funkcji nieistniejących).
    - **Discovery call script + objection handling (DOCX/PDF)**:
      - 12–20 pytań (CFO/COO/PMO) + mapowanie na moduły platformy,
      - gotowe odpowiedzi na top 10 obiekcji (pricing, AI, security, data residency, “we already have PMO”).
    - **Email templates pack (TXT/HTML)**:
      - 3 sekwencje: cold outbound, follow‑up, post‑demo/trial nudge,
      - “no spam” compliance note + warianty tematu.
    - **Case study template + 1 przykładowy case (PDF)**:
      - format: context → baseline → interventions → metrics → ROI narrative,
      - jeden “hero” case z demo story (spójny z T087–T089).
    - **Logo/brand kit (ZIP)**:
      - logo w SVG/PNG (light/dark), partner badge, usage rules (“do/don’t”).
    - **Screenshots pack (ZIP)**:
      - 8–12 screenów z produktu V2 (z playbooka T095), opisane gdzie używać.
  - Partner Portal distribution (MUST):
    - materiały dostępne jako “Resources” w Partner Portal (`PartnerPortalView` → ResourcesSection),
    - backend endpoint `GET /api/partners/resources` zwraca realne zasoby (nie tylko hardcoded),
    - “Download” daje realny plik (nie symboliczny URL).
  - Versioning & freshness (MUST):
    - każdy resource ma `version`, `updatedAt`, `language`, `category` (marketing/docs/templates/case studies),
    - deprecated wersje są archiwizowane (nie znikają wstecznie z historii partnera, ale nie są domyślne).
  - Access control (MUST):
    - materiały “public partner” (dla Registered) vs “advanced enablement” (Certified/Premier) — gating po tierze,
    - audyt pobrań (kto, co, kiedy) dla compliance i poprawy programu.
  - i18n (MUST):
    - minimum V2: PL+EN dla całego toolkitu,
    - post‑V2: kolejne języki zgodnie z globalnym i18n (de/ar/jp/es) jeśli program rośnie globalnie.
- OUT:
  - automatyzacja affiliate end‑to‑end (to osobne taski w partners/growth),
  - pełny LMS / academy engine (T097).

**Implementation notes (grounded w repo):**
- UI już ma “Resources” w Partner Portal:
  - `src/views/partner/PartnerPortalView.tsx` ma ResourcesSection z download flow,
  - `src/views/partner/ResourcesView.tsx` istnieje jako placeholder “resource center”.
- Backend ma placeholder resources list:
  - `server/src/routes/partners.routes.ts` → `GET /api/partners/resources` zwraca hardcoded zasoby + `GET /download` zwraca `downloadUrl`,
  - V2: `downloadUrl` musi prowadzić do realnego pliku (np. `/api/partners/resources/:resourceId/file` z autoryzacją i streamem).
- Utrzymanie spójności claimów:
  - wszystkie materiały muszą być spójne z T095 (brand/nazwy) oraz z T090–T092 (conversion narrative).

**Data model (V2, minimal):**
- `partner_resources`:
  - `id`, `category`, `title`, `description`,
  - `language`, `version`, `status` (active/archived),
  - `file_key` (storage key) lub `url` (jeśli hosted), `mime_type`, `size_bytes`,
  - `min_partner_tier` (REGISTERED/BRONZE/SILVER/…),
  - `created_at`, `updated_at`.
- `partner_resource_downloads`:
  - `id`, `partner_org_id`, `user_id`, `resource_id`, `downloaded_at`, `ip_hash?`, `user_agent?`.

**Analytics / metrics:**
- `partner_resource_list_viewed`
- `partner_resource_download_clicked` (resourceId, category, language, tier)
- KPI: downloads per partner, usage by category, correlation z conversion.

**Risks:**
- Materiały szybko się dezaktualizują gdy produkt rośnie → V2 wymaga ownera procesu aktualizacji (release/changelog handshake).
- Niespójny branding/nazwy → spadek trust (V2: single source + review gate).

**Definition of Done (DoD):**
- Partner może wejść w “Resources” i pobrać komplet toolkitu (PL+EN).
- Każdy download jest realny (plik się ściąga), ma wersję i jest zgodny z V2 messagingiem.
- Materiały są podzielone na kategorie i gotowe do użycia w sprzedaży/onboardingu.

**Acceptance / test plan:**
- Test: Partner (Registered) widzi podstawowe materiały i może je pobrać.
- Test: Partner (wyższy tier) widzi dodatkowe “advanced enablement”.
- Test: download link działa (plik jest zwracany), a event download jest zapisany.

---

## T097 — 🟢 partners — Partner Sales Certification & Incentive Training System (academy + exams + commission unlock)
- Status spec: draft
- Link / ID (ClickUp): TBD
- Epic: Partner growth foundation (enablement + quality) TBD
- Priorytet / V2 scope: V2

**Business challenge (problem):**
Partner program bez standaryzacji (co mówić, komu, jak prowadzić discovery, jak prowadzić trial → paid) generuje:
- niespójny przekaz i ryzyko “over-claiming”,
- słabe wyniki sprzedażowe i długi time‑to‑first‑deal,
- większy koszt wsparcia po naszej stronie (pytania podstawowe, błędy w onboardingach),
- trudność w skalowaniu programu (nie wiemy “kto jest gotowy”).

**Cel (outcome, nie feature):**
W V2 partner ma **realny, przechodzony w produkcie** program:
- learning path (moduły) + egzaminy,
- certyfikaty do pobrania,
- jasno zdefiniowany mechanizm incentive: **ukończenie certyfikacji odblokowuje wyższe prowizje / tier**,
- mechanizmy anty‑fraud (retake, audit, revocation),
- spójne z PMO/ISO mappingiem w partner module i z messagingiem T095.

**Scope (V2)**
- IN:
  - Academy / Learning path (MUST):
    - zestaw modułów szkoleniowych w kategoriach (z `src/views/partner/types.ts` i UI `AcademyProgress`):
      - METHODOLOGY, SALES, TECHNICAL, COMPLIANCE,
    - moduły mają: opis, czas trwania, required/not required, status i score.
  - Exams (MUST):
    - egzamin na poziomie certyfikacji (min. 20 pytań, próg zaliczenia, limit czasu),
    - retake policy (cooldown + limit podejść / doba),
    - generowanie wyniku i zapis attemptów (audit).
  - Certificates (MUST):
    - po zaliczeniu: certyfikat dostępny do pobrania (PDF) + “share link” (opcjonalnie gated),
    - cert ma metadane: typ, earnedAt, expiresAt (jeśli wygasa), certificateId.
  - Incentive system (MUST):
    - ukończenie certyfikacji sprzedażowej odblokowuje wyższy tier i/lub wyższą stawkę prowizji,
    - incentive jest **egzekwowany** w naliczaniu prowizji (nie tylko “badge” w UI),
    - superadmin ma możliwość revoke/downgrade (compliance / fraud / quality).
  - Partner Portal UX (MUST):
    - widoki istniejące w `PartnerPortalView` (subsections: `learning-path`, `exams`, `certificates`) stają się w pełni funkcjonalne,
    - spójny flow: start → moduły → egzamin → certyfikat → “Unlocked benefits” panel (jak to wpływa na prowizję).
  - Content baseline (MUST, V2 “final and good”):
    - minimum: gotowy zestaw modułów dla Sales Certification (discovery + objection + trial→paid + security & legal),
    - języki: EN + PL.
- OUT:
  - pełny LMS enterprise (SCORM, roleplay grading, proctoring) — post‑V2.

**Open questions (do domknięcia w trakcie implementacji, ale spec wymaga decyzji):**
- Jaka jest **kanoniczna taksonomia tierów partnera**?
  - W repo są niespójności:
    - UI/config używa `REGISTERED/BRONZE/SILVER/GOLD/PLATINUM` (`partner_commission_rates`, `PartnerProgramConfig.tsx`, `usePartnerEcosystem`),
    - DB `partner_organizations.tier` w `215_partner_portal.sql` ma `registered/certified/premier/elite`.
  - V2 wymaga ujednolicenia (jedno źródło prawdy + mapowanie legacy).
- Czy tier jest funkcją (a) revenue, (b) certyfikacji, (c) obu?
  - Proponowane V2: tier = max(RevenueTier, CertificationTier) + admin override.
- Czy incentive dotyczy całej organizacji partnera (partner_org) czy pojedynczego usera?
  - Proponowane V2: **benefit prowizyjny jest na poziomie partner_org**, ale wymaga min. 1 aktywnego usera z ukończoną certyfikacją.

**Implementation notes (grounded w repo):**
- UI:
  - `src/views/partner/PartnerPortalView.tsx` ma gotowe pod‑sekcje “Certification” i pobiera `GET /api/partners/certifications`,
  - komponent `src/components/Partner/AcademyProgress.tsx` jest gotowym UI do progresu modułów i certów (może zostać użyty jako “overview”).
- Backend:
  - `server/src/routes/partners.routes.ts` ma placeholder endpoints:
    - `GET /api/partners/certifications`,
    - `GET /api/partners/certifications/:certId/modules`,
    - `POST /api/partners/certifications/:certId/modules/:moduleId/progress`,
  - migracje istniejące już definiują tabelki do “prawdziwego” LMS:
    - `partner_certifications`, `partner_learning_modules`, `partner_learning_progress` (w `215_partner_portal.sql`).
- Incentive:
  - prowizje są konfigurowane per tier w `partner_commission_rates` (migration `217_partner_discount_system.sql`) i zarządzane w UI `PartnerProgramConfig.tsx` przez `partnerConfigRouter` (w `partners.routes.ts`).

**API contract (V2, minimal):**
- `GET /api/partners/certifications`
  - zwraca listę certification tracks (status/progress, certificate metadata).
- `GET /api/partners/certifications/:certId/modules`
  - zwraca moduły learning path + progress.
- `POST /api/partners/certifications/:certId/modules/:moduleId/progress`
  - zapisuje progress, score, completedAt; waliduje uprawnienia partner usera.
- `POST /api/partners/certifications/:certId/exam/start`
  - tworzy attempt (czas startu, deadline).
- `POST /api/partners/certifications/:certId/exam/submit`
  - zapisuje odpowiedzi, wynik, pass/fail; przy pass: ustawia certification completed + generuje cert.
- `GET /api/partners/certificates/:certificateId/download`
  - zwraca PDF (stream) lub signed URL z krótkim TTL.

**Data model (V2, minimal – bazuje na istniejących migracjach):**
- `partner_certifications`:
  - per `partner_org_id` + `user_id` track certyfikacji (status, progress, started/completed/expires, certificateId/url),
  - V2: dodać (jeśli brak): `passed_exam_at`, `last_attempt_at`, `attempt_count`.
- `partner_learning_modules` + `partner_learning_progress`:
  - moduły i postęp per cert.
- `partner_certification_attempts` (nowa tabela w V2):
  - attemptId, certificationId, userId, startedAt, submittedAt, score, passed, ipHash?, userAgent?.
- `partner_organizations`:
  - `tier` (kanoniczne) + ewentualny `tier_override` + `certification_tier_floor`.

**Incentive logic (V2 – “egzekwowane”):**
- Gdy partner_org spełni warunek certyfikacji (min. 1 user ukończył “Sales Certification”):
  - system ustawia `certification_tier_floor` dla partner_org (np. co najmniej `SILVER`),
  - commission calculation używa `max(current_tier, certification_tier_floor)` do wyboru stawki z `partner_commission_rates`,
  - UI pokazuje “Unlocked benefits” (rate/discount changes) oraz datę przyznania.
- Revocation:
  - superadmin może cofnąć cert (fraud, quality) → zdejmuje floor i loguje event.

**Anti‑fraud / abuse (V2):**
- rate limiting attemptów (per user/per cert),
- losowanie pytań z banku (minimum), timeboxed exam,
- audyt attemptów + możliwość flagowania.

**Analytics / metrics:**
- `partner_academy_module_started` / `partner_academy_module_completed`
- `partner_cert_exam_started` / `partner_cert_exam_passed` / `partner_cert_exam_failed`
- `partner_cert_earned` + `partner_incentive_unlocked`
- KPI: completion rate, time-to-cert, correlation z deals won i conversion.

**Risks:**
- Niespójność tierów w repo → musi być domknięta, inaczej incentive nie będzie wiarygodne.
- “Paper certification” (bez realnej jakości) → w V2 minimum: egzamin + retake policy + audit.

**Definition of Done (DoD):**
- Partner ma pełny flow: learning path → egzamin → certyfikat → benefit (prowizyjny) widoczny i egzekwowany.
- Superadmin może zarządzić tier/rates oraz cofnąć cert w razie potrzeby.
- EN+PL content baseline dostępny i spójny z claimami produktu.

**Acceptance / test plan:**
- Test: partner user przechodzi moduły, zdaje egzamin, dostaje cert i może pobrać PDF.
- Test: partner org po certyfikacji ma wyższy tier floor i komisje naliczają się według nowej stawki.
- Test: revoke przez superadmin cofa benefit i jest audytowane.

---

## T098 — 🟢 partners — Automated Partner Outreach Campaign (compliant sequences + tracking + scaling BD)
- Status spec: draft
- Link / ID (ClickUp): TBD
- Epic: Partner growth foundation (acquisition engine) TBD
- Priorytet / V2 scope: V2

**Business challenge (problem):**
Pozyskiwanie partnerów “ręcznie” (ad‑hoc maile/LinkedIn) nie skaluje się, nie jest mierzalne i generuje ryzyko compliance (spam, brak opt‑out). Bez automatyzacji BD nie dowozi pipeline’u partnerów w tempie potrzebnym do V2.

**Cel (outcome, nie feature):**
W V2 BD/SuperAdmin może uruchomić i mierzyć kampanie outreach do potencjalnych partnerów, które:
- są zgodne z prawem i deliverability best‑practice (opt‑out, throttling, audit),
- prowadzą do jasnego CTA (Become Partner → onboarding → partner portal),
- mają tracking i raportowanie skuteczności (open/click/apply),
- używają spójnego messagingu i assetów z T095 + T096.

**Scope (V2)**
- IN:
  - Campaign builder (MUST):
    - sekwencje 2–5 kroków email (np. D0/D3/D7),
    - template per krok (subject + html/text) z variable substitution (np. `{{company}}`, `{{firstName}}`, `{{region}}`),
    - preview + test‑send na własny adres,
    - okna wysyłek (dni/godziny) + time‑zone (minimum: “EU business hours”).
  - Lead intake & segmentation (MUST):
    - import CSV (min. pola: email, company, name, country/region, source, “lawful basis”),
    - segmenty: region/industry/source + “exclude duplicates”,
    - suppression list (unsubscribed/bounced/do-not-contact).
  - Compliance (MUST):
    - każdy mail ma stopkę: dane nadawcy + **one‑click unsubscribe**,
    - trwały zapis opt‑out (nie wysyłamy więcej),
    - audyt: kto uruchomił kampanię, do kogo, kiedy, jaka treść (hash wersji template).
  - Deliverability & safety (MUST):
    - throttling / rate limits (per domena / per godzina) + retry/backoff,
    - obsługa bounce/complaint na poziomie minimum (manual import lub webhook post‑V2),
    - guardrails na treść: zakaz “over‑claiming” + szybki review gate.
  - Tracking & analytics (MUST):
    - eventy: sent, delivered(soft), opened(best‑effort), clicked, unsubscribed,
    - tracking linki (redirect) + UTM conventions,
    - dashboard per kampania (CTR, opt‑out rate, apply starts, conversions).
  - CTA + onboarding path (MUST):
    - kampanie kierują na publiczny landing partnera `src/views/BecomePartnerView.tsx`,
    - CTA: “Apply” (np. `/register`), “Book call” (link), “View partner kit” (T096),
    - jeśli używany partner/referral code — linki wspierają atrybucję (integracja z partner code flow).
  - Scheduling engine (MUST):
    - przetwarzanie wysyłek w tle jako job (batch),
    - użycie istniejącego cron framework (`server/src/cron/Scheduler.ts` ma slot “Scheduled Emails”).
  - i18n / content quality (V2):
    - minimum: EN + PL template’y outreach,
    - post‑V2: rozszerzenie na kolejne języki programu.
- OUT:
  - pełny CRM (pipeline stages, inbox, automatyczne reply classification) — post‑V2,
  - multi‑channel (LinkedIn, WhatsApp, SMS) — post‑V2 (email‑first w V2).

**Implementation notes (grounded w repo):**
- Email sending:
  - istnieje `server/src/services/emailService.ts` (SMTP settings z tabeli `settings`, nodemailer).
- Template management:
  - istnieje system `email_templates` (`server/src/routes/content/email-templates.routes.ts`) — można użyć jako “source of templates” lub zrobić dedykowane `partner_outreach_templates` (V2 decision).
- Scheduling:
  - `server/src/cron/Scheduler.ts` ma placeholder “Scheduled Emails” co 15 minut — naturalne miejsce na “process outreach queue”.
- Public CTA:
  - publiczna strona rekrutacji partnerów jest w `src/views/BecomePartnerView.tsx`.
- Consent:
  - GDPR endpointy mają flagę `marketing` dla userów (`/api/gdpr/consents`), ale outreach dotyczy leadów B2B (nie userów) → wymagamy osobnej ewidencji opt‑out (suppression list) i lawful basis per lead.

**Data model (V2, minimal):**
- `partner_outreach_campaigns`:
  - `id`, `name`, `status` (draft/running/paused/completed),
  - `created_by`, `created_at`, `started_at`, `completed_at`,
  - `from_name`, `from_email`, `reply_to`,
  - `sending_window` (json), `throttle_policy` (json),
  - `segment_query` (json) lub `segment_id`.
- `partner_outreach_steps`:
  - `id`, `campaign_id`, `step_order`, `delay_days`,
  - `subject`, `body_html`, `body_text`, `template_version_hash`.
- `partner_outreach_leads`:
  - `id`, `email`, `company`, `first_name`, `last_name`, `country`, `region`,
  - `source`, `lawful_basis`, `status` (active/suppressed/bounced),
  - `created_at`, `updated_at`.
- `partner_outreach_enrollments`:
  - `id`, `campaign_id`, `lead_id`, `enrolled_at`, `status` (active/completed/unsubscribed),
  - `current_step`, `next_send_at`.
- `partner_outreach_events`:
  - `id`, `campaign_id`, `lead_id`, `type` (sent/opened/clicked/unsubscribed/bounced),
  - `meta` (json), `created_at`.
- `partner_outreach_unsubscribes`:
  - `email`, `reason?`, `created_at`.

**API contract (V2, minimal — SuperAdmin/BD):**
- `POST /api/superadmin/partner-outreach/leads/import` (CSV)
- `GET /api/superadmin/partner-outreach/leads` (filters + suppression status)
- `POST /api/superadmin/partner-outreach/campaigns` (create/update)
- `POST /api/superadmin/partner-outreach/campaigns/:id/start|pause|resume`
- `GET /api/superadmin/partner-outreach/campaigns/:id/metrics`
- Public:
  - `GET /public/unsubscribe?token=...` (one‑click, no login)
  - `GET /public/track/click?token=...` (redirect + event)

**Analytics / metrics:**
- `partner_outreach_campaign_created/started/paused/completed`
- `partner_outreach_email_sent/opened/clicked/unsubscribed`
- KPI: opt‑out rate, CTR, apply-start rate, partner signups, “time to first partner portal login”.

**Risks:**
- Deliverability (domain reputation) → V2 musi mieć throttling, templates review, stopkę i opt‑out.
- Compliance (GDPR/anti‑spam) → V2 wymaga lawful basis + suppression list + audyt.

**Definition of Done (DoD):**
- BD/SuperAdmin może: zaimportować leady, stworzyć kampanię 3‑krokową (PL/EN), uruchomić ją i zobaczyć metryki.
- Każdy mail ma unsubscribe i po opt‑out nie ma dalszych wysyłek.
- Kliknięcia są trackowane, a CTA prowadzą do poprawnych publicznych ścieżek (Become Partner → register).

**Acceptance / test plan:**
- Test: kampania testowa do 10 leadów wysyła kroki zgodnie z harmonogramem i throttle.
- Test: unsubscribe działa one‑click i blokuje kolejne kroki.
- Test: kliknięcie CTA zapisuje event click i poprawnie redirectuje do docelowej strony.

---

## T099 — ⚫ ui/ux — Implement Alternative “C‑Type” Table View (ClickUp‑Style Layout) (N‑first system + optional C for speed)
- Status spec: draft
- Link / ID (ClickUp): TBD
- Epic: UI standards adoption (N/C everywhere it makes sense) TBD
- Priorytet / V2 scope: V2

**Kluczowy wymóg od Ciebie (MUST):**
- Cały system ma być konsekwentnie **w standardzie N** (page‑first) oraz mieć **C tam, gdzie da się wybrać rodzaj prezentacji**.
- Całość aplikacji ma mieć **super nowoczesny UI/UX** zgodny z “Tech Sexy” (invisible borders, monochromatic chrome, outline icons, typographic hierarchy) — kanon: `docs/ui-standards/`.

**Business challenge (problem):**
Duże, operacyjne produkty (ClickUp/Notion) wygrywają “speed to action”: tabela jest miejscem pracy, nie tylko listą. W Consultify wiele workflow odbywa się na listach (tasks/decisions/initiatives/tools), ale bez C‑type użytkownik traci czas na nawigację, a UI jest niespójny między modułami.

**Cel (outcome, nie feature):**
W V2 użytkownik może pracować z listami/tabelami w 2 spójnych wariantach:
- **N‑table**: spokojny, page‑first “golden standard” tabel (Decisions‑style) dla czytelności,
- **C‑table**: ClickUp‑like, action‑first “operacyjny” układ dla szybkości (command bar + selection + quick actions),
przy zachowaniu tych samych danych i funkcji (różny render), oraz z trwałą preferencją użytkownika.

**Scope (V2)**
- IN:
  - Global rules (MUST):
    - N/C to **presentation**, nie inne feature sety (te same dane, ta sama praca),
    - brak akordeonów jako “tryb” (D mode jest usunięte; final target: N+C) — kanon: `docs/ui-standards/01-shell-layout/presentation-modes.md`,
    - każdy ekran tabelaryczny i “hub modułu” trzyma **App Table Standard** (top bar `h-9`, search toggle, pełna szerokość, guardy na dane): `docs/ui-standards/03-modules/app-table-standard.md`.
  - N‑table (MUST):
    - utrzymujemy istniejący wzorzec tabel: resizable columns + header filters + toggle search,
    - “quiet luxury UI”: minimal chrome, hover = background change (nie border/tekst),
    - pełna spójność z DBR77 Visual Language (`docs/ui-standards/00-foundation/visual-language.md`).
  - C‑table (MUST):
    - ClickUp‑style “action‑first” dla list:
      - szybkie akcje (bulk + row actions) bez wchodzenia w oddzielne ekrany,
      - ergonomia klawiatury (up/down selection, enter open, cmd/ctrl+k search),
      - command bar / quick actions zgodne z “C-grade productivity” z `presentation-modes.md`,
      - row hover reveals secondary actions (pattern opisany w visual language).
    - zachowuje App Table Standard (te same filtry/kolumny), ale inaczej rozkłada priorytety UI (operacyjnie).
  - View toggle & persistence (MUST):
    - dla list/tabel dodajemy przełącznik **N / C** (analogiczny semantycznie do `PresentationModeSwitcher`),
    - preferencja zapisywana per użytkownik per obszar (np. `module.discovery.tableMode`, `mywork.tasks.tableMode`) — localStorage jako fallback, docelowo server‑side user settings,
    - opcjonalny URL override (np. `?view=n|c`) dla deep‑linków i debug.
  - Rollout scope (V2 minimal, ale “real”):
    - wdrożenie C‑table minimum na:
      - **My Work** (Tasks/Decisions/Notifications listy; bazuje na istniejących tabelach `ResizableTable`),
      - **1 module hub** (np. Discovery Tools/Assessment) w trybie `viewMode='table'`,
    - pozostałe moduły: adoptują mechanizm przełącznika i style w kolejnych taskach, ale architektura jest już wspólna.
  - i18n (MUST):
    - PL + EN dla labeli i tooltipów przełącznika i podstawowych komunikatów C‑table.
- OUT:
  - pełny “custom views builder” (jak ClickUp view presets z share, permissions) — post‑V2,
  - time‑tracking/worklog jako core C‑table feature — wyraźnie OUT w standardzie C mode.

**Implementation notes (grounded w repo):**
- Standardy:
  - N/C presentation jest kanoniczne i opisane implementation‑ready w `docs/ui-standards/01-shell-layout/presentation-modes.md`,
  - standard tabel/hubów jest kanoniczny: `docs/ui-standards/03-modules/app-table-standard.md` + `docs/ui-standards/03-modules/module-hub-standard.md`.
- Istniejące komponenty do użycia (nie duplikować):
  - `src/components/ui/ResizableTable/*` (Decisions‑style: resizers, filters, bulk actions),
  - `src/components/shared/ModuleHub/*` (hub: taby, view modes),
  - `src/hooks/usePresentationMode.ts` + `PresentationModeSwitcher` (logika N/C i a11y pattern).

**C‑table UX spec (V2 minimal, ale spójny):**
- Above the fold:
  - 1) top bar (search toggle + filtry + primary action),
  - 2) tabela z selekcją wiersza (clear selection),
  - 3) quick actions (inline / bulk) dostępne bez scrollowania.
- Keyboard:
  - strzałki: zmiana selekcji wiersza,
  - `Enter`: open (w tej samej zakładce),
  - `Esc`: clear selection / close menus,
  - `Cmd/Ctrl+K`: focus search.
- Visual:
  - “invisible borders” + hover background,
  - monochrome chrome; kolor tylko tam gdzie semantyka/status/primary CTA,
  - row actions ujawniane na hover (ClickUp pattern).

**Analytics / metrics:**
- `table_view_mode_changed` (context, from, to)
- `table_row_quick_action_used` (action, entityType)
- KPI: time-to-action (proxy: clicks per completed action), adoption C vs N, retention.

**Risks:**
- Rozjazd funkcjonalny między N‑table i C‑table → V2 wymaga “same data, different render”.
- Performance dla dużych tabel → V2: stabilne renderowanie (virtualization w post‑V2 jeśli potrzebne), brak layout shift.

**Definition of Done (DoD):**
- Użytkownik może przełączyć N/C w tabelach objętych rolloutem (MyWork + 1 module hub) bez utraty funkcji.
- Widoki są spójne z kanonicznym standardem UI (Tech Sexy + App Table Standard + presentation modes).
- Preferencja użytkownika jest zapamiętana i działa po odświeżeniu.

**Acceptance / test plan:**
- Test: przełącz N↔C na MyWork tasks/decisions/notifications; filtry/search/kolumny działają w obu.
- Test: przełącz N↔C w module hub table view; brak regresji layoutu i szerokości (pełna szerokość, brak max‑w).
- Test: a11y — toggle działa klawiaturą i ma tooltipy/aria.

---

## T100 — ⚫ ui/ux — Mobile Application Interface Design (mobile‑ready web + field capture UX, premium)
- Status spec: draft
- Link / ID (ClickUp): TBD
- Epic: Mobile readiness (web + future app) TBD
- Priorytet / V2 scope: V2

**Dlaczego to jest MUST (Twoja uwaga):**
To jest oczywiste, że i strona, i aplikacja będą otwierane na telefonie — w V2 musimy być na to gotowi: bez “połamanych” layoutów, z szybkim zbieraniem informacji i premium wrażeniem.

**Business challenge (problem):**
Jeśli mobile experience jest słaby, to:
- onboarding/demo/trial tracą konwersję (pierwszy kontakt często jest na telefonie),
- konsultanci w terenie nie zbiorą danych “w momencie” (wraca ręczne notowanie i chaos),
- UI/UX traci premium feel (co psuje zaufanie do całej platformy).

**Cel (outcome, nie feature):**
W V2 produkt jest **mobile‑ready**:
- web działa świetnie na telefonie (responsywność + touch ergonomia),
- kluczowe flow “field capture” (zbieranie informacji z hali/spotkania) jest zoptymalizowane pod 1 rękę,
- layouty i komponenty trzymają Tech Sexy + standardy N/C (bez nowych ad‑hoc wynalazków),
- przygotowujemy solidną bazę pod **dedykowaną aplikację mobilną** (jeśli zdecydujemy się na nią jako osobny epik).

**Scope (V2)**
- IN:
  - Mobile‑ready Web (MUST):
    - responsywność dla krytycznych ścieżek:
      - landing/docs/legal/pricing (T094–T095),
      - onboarding/register/login,
      - My Work (tasks/decisions/notifications),
      - szybkie wejście do initiatives + podstawowe akcje,
      - chat access (AI) bez zasłaniania pracy.
    - brak poziomego scrolla w content (poza kontrolowanym, wewnętrznym scroll w tabelach jeśli absolutnie konieczne),
    - touch ergonomia:
      - minimalny target 44×44px (`.touch-target`),
      - safe‑area obsłużone (notch) (`.safe-area-pb`),
      - bottom navigation jako primary nav na mobile.
  - Mobile navigation pattern (MUST):
    - bottom nav (5 pozycji) jako domyślna nawigacja w aplikacji na mobile,
    - sidebar otwierany jako drawer (zamiast stałej kolumny),
    - wszystkie krytyczne akcje dostępne bez “pixel hunting”.
  - Mobile “field capture” UX (MUST, kierunek funkcjonalny):
    - mobile ma być zoptymalizowany pod **zbieranie informacji** (teren/hala/rozmowa konsultanta):
      - szybkie notatki,
      - checklisty i krótkie formularze,
      - dodawanie zdjęć/załączników (jeśli wspierane),
      - minimalne “ciężkie tabele” (zastępujemy listą/kanbanem/compact cards).
    - C‑type (action‑first) na mobile:
      - domyślnie **N** (czytelność),
      - C może być dostępne tylko tam gdzie nie psuje ergonomii; jeśli jest, musi mieć touch‑friendly command bar i nie może wymagać “hover”.
  - Drawers / sheets (MUST):
    - używamy jednolitego komponentu drawer/sheet do bocznych paneli (help/docs/sidebar, itp.),
    - zachowanie: focus mgmt, ESC, overlay, drag‑to‑close (tam gdzie sensowne).
  - RTL + i18n (MUST):
    - mobile layout działa w RTL (`ar`) i nie rozjeżdża bottom nav / drawers.
  - Performance & perceived speed (MUST):
    - minimalizacja layout shift,
    - priorytet “fast first interaction” na mobile (zwłaszcza landing i My Work).
- OUT:
  - pełna implementacja natywnej aplikacji (iOS/Android) jako osobny epik — V2 przygotowuje UX i kontrakty, ale budowa może być etapowana.

**Implementation notes (grounded w repo):**
- Device detection:
  - jest `src/hooks/useDeviceType.ts` (mobile/tablet/desktop + orientation + safe area insets).
- Mobile navigation:
  - jest `src/components/navigation/BottomNavigation.tsx` (renderuje się tylko na mobile),
  - `src/layouts/MainLayout.tsx` ma `pb-16 md:pb-0` (miejsce na bottom nav).
- Touch & safe area:
  - utilities są w `index.css`: `.touch-target` i `.safe-area-pb`.
- Drawers:
  - jest `src/components/ui/primitives/Drawer.tsx` (sheet/drawer z overlay + drag + focus mgmt).

**Mobile UI rules (V2, “premium”):**
- Jeden kolorowy akcent na ekran (CTA/status) — reszta monochromatyczna (Tech Sexy).
- Brak “dense tables” na mobile:
  - tabela → compact list/card + drill‑down,
  - filtrowanie i search zawsze dostępne, ale nie dominujące.
- Sticky controls:
  - bottom nav zawsze widoczny,
  - krytyczne CTA (Save / Add / Submit) w zasięgu kciuka (bottom action bar albo floating action, zgodnie ze standardem ekranu).

**Definition of Done (DoD):**
- Kluczowe trasy publiczne i core app views działają poprawnie na mobile (iOS Safari + Chrome Android) bez połamanych layoutów.
- Bottom nav działa i jest spójny (safe area, touch targets, a11y).
- Field capture UX jest zaprojektowany i gotowy do wdrożenia etapami (nie tylko “responsive shrink”).
- RTL (`ar`) nie psuje nawigacji i podstawowych layoutów.

**Acceptance / test plan:**
- Test: viewporty 390×844 (iPhone), 360×800 (Android), tablet 768×1024 — brak overflow/h-scroll w content.
- Test: bottom nav nie zasłania treści i respektuje safe area.
- Test: w mobile da się wykonać 3 typowe akcje “w terenie”: dodać notatkę, zaznaczyć checklist item, dodać załącznik (jeśli włączone) — bez frustracji.
- Test: RTL (`ar`) — bottom nav i drawers działają poprawnie.

---

## T101 — ⚫ ui/ux — Icon System Standardization & Design Library (one icon language across the whole app)
- Status spec: draft
- Link / ID (ClickUp): TBD
- Epic: Tech Sexy UI consistency (micro-consistency) TBD
- Priorytet / V2 scope: V2

**Dlaczego to jest oczywiste i krytyczne:**
Spójne ikonki w całym sofcie to “micro‑consistency”, która robi premium feel. Bez tego nawet dobre ekrany wyglądają jak zlepki modułów.

**Business challenge (problem):**
W repo widać dużo ręcznych decyzji per ekran (`size={14|16|18|20}`, czasem kolorowe ikony, różne style). To powoduje:
- brak spójności wizualnej (szczególnie w nav + toolbary),
- większy koszt rozwoju (każdy nowy ekran “wymyśla” ikonki),
- ryzyko łamania standardu Tech Sexy (kolorowe ikony w nawigacji, mieszanie filled/outline).

**Cel (outcome, nie feature):**
W V2 mamy jeden, kanoniczny system ikon:
- jedna biblioteka (outline, mono‑weight),
- tokeny rozmiaru + stroke width,
- jasne reguły: gdzie ikona ma kolor semantyczny, a gdzie zawsze jest “text‑color”,
- biblioteka/mapping ikon do typów danych (statusy, moduły, actions),
- proste egzekwowanie w kodzie (wrapper + zakazane patterny).

**Kanon (SSOT) — już istnieje w standardach:**
- `docs/ui-standards/00-foundation/visual-language.md` → sekcja “Ikony (KANON) — Outline, mono‑weight, text‑color”
  - outline stroke, mono‑weight (1.5–2px),
  - kolor ikony = kolor tekstu obok (wyjątki: semantyka/status/badge),
  - rozmiary: nav 18–20, inline 16, toolbary 14–16,
  - MUST NOT: kolorowe ikony w nawigacji (poza aktywnym itemem), mieszanie filled+outline.

**Scope (V2)**
- IN:
  - Icon tokens (MUST):
    - definiujemy kanoniczne size tokens (np. `icon.xs/sm/md/lg/xl`) mapujące na 14/16/18/20/24/32/48,
    - definiujemy kanoniczny `strokeWidth` dla całej aplikacji (np. 1.75 lub 2) i NIE “pływa” per ekran.
  - Icon wrapper (MUST):
    - wprowadzamy wspólny komponent (np. `AppIcon`) który:
      - przyjmuje `name` lub komponent lucide,
      - ustawia default `size` i `strokeWidth`,
      - nie pozwala “na skróty” kolorować ikon w nawigacji (tylko przez kolor tekstu rodzica),
      - wspiera a11y (`aria-hidden` / `title` tam gdzie potrzebne).
    - integracja z dynamic icons:
      - w repo jest `src/components/shared/DynamicIcon.tsx` oraz kilka lokalnych kopii `DynamicIcon` w widokach — V2: ujednolicamy to do jednego miejsca + tych samych tokenów.
  - Mapping library (MUST):
    - jedna mapa ikon dla:
      - akcji (add/edit/delete/download/search/filter),
      - statusów (success/warn/danger/info),
      - modułów (MyWork, Assessment, Initiatives, Billing, Partner),
    - mapping jest używany w UI zamiast “random icon choice”.
  - Migration (MUST):
    - ograniczamy “manual size/color drift”:
      - stopniowo zamieniamy `size={...}` i `className="text-..."` na tokeny/wrapper,
      - priorytet: sidebar + top bars + module hubs + MyWork + public pages (T095/T100).
  - i18n & a11y (MUST):
    - ikony dekoracyjne zawsze `aria-hidden`,
    - ikony w buttonach mają label przez tekst obok lub `aria-label` na buttonie (nie polegamy na samej ikonie).
- OUT:
  - zmiana biblioteki ikon na inną (jeśli zostajemy na `lucide-react`) — post‑V2 tylko jeśli jest powód.

**Implementation notes (grounded w repo):**
- `lucide-react` jest już szeroko używane.
- `DynamicIcon` istnieje (`src/components/shared/DynamicIcon.tsx`), ale są też lokalne warianty w kilku plikach — V2 ujednolica.

**Definition of Done (DoD):**
- Jest 1 kanoniczny wrapper ikon + 1 kanoniczna mapa ikon.
- Sidebar, top bary, module hubs i główne ekrany używają tokenów ikon (rozmiar/stroke) i trzymają “text‑color”.
- Brak kolorowych ikon w nawigacji (poza aktywnym itemem) i brak mieszania stylów.

**Acceptance / test plan:**
- Test: przegląd kluczowych ekranów (Sidebar, MyWork, ModuleHub, Settings, Landing) — ikony mają spójne rozmiary i stroke, a kolorowanie jest zgodne z kanonem.
- Test: dark/light mode — kontrast i czytelność ikon ok.
- Test: mobile — ikony w bottom nav 18–22px, dotykalne, bez wizualnego chaosu.

---

## T102 — ⚫ ui/ux — Finalize Sidebar Design System (Buttons, Backgrounds & Expand Behavior) (ClickUp/Notion/Outlook-grade)
- Status spec: draft
- Link / ID (ClickUp): TBD
- Epic: “First impression” UI system (global navigation) TBD
- Priorytet / V2 scope: V2

**Twoje wymaganie (MUST):**
Wypracowujemy wygląd i zachowanie sidebaru, które stawia nas na równi z **ClickUp / Notion / Outlook** (plus “modern AI” feeling jak OpenAI/Google AI Studio), ale w naszej estetyce **Tech Sexy B2B SaaS enterprise**. To ma być **systemowe rozwiązanie**, nie “dopieszczenie jednego ekranu”.

**Business challenge (problem):**
Sidebar jest widoczny wszędzie i buduje “premium feel” w 2 sekundy. Jeśli jest niespójny (kolory, hover, spacing, ikony, expand/collapse), cała aplikacja wygląda jak zbiór modułów. Dodatkowo mobile wymaga innych mechanik (drawer + bottom nav) — bez systemu będzie chaos i regresje.

**Cel (outcome, nie feature):**
W V2 sidebar jest:
- **spójny wizualnie** (monochrome chrome + invisible borders + outline icons),
- **przewidywalny** (jedna logika active/hover/disabled/badges),
- **produktywny** (klawiatura, szybkie przełączanie, brak “pixel hunting”),
- **responsywny** (desktop/tablet: expand/collapse; mobile: drawer + bottom nav),
- **gotowy do skalowania** (kolejne moduły i role nie psują layoutu).

**Kanon / SSOT (już w repo):**
- “Tech Sexy” visual language: `docs/ui-standards/00-foundation/visual-language.md`
- Sidebar faza w planie migracji: `docs/ui-standards/TECH_SEXY_MIGRATION_PLAN.md` → **Faza 4 (Sidebar)**
- Ikony (T101): outline, mono-weight, kolor = kolor tekstu (bez kolorowych ikon w nawigacji poza active)

**Scope (V2)**
- IN:
  - Sidebar layout tokens (MUST):
    - dwa stabilne rozmiary:
      - **expanded**: ~256px (standard app sidebar),
      - **collapsed**: ~64px (icons-only),
    - item height i padding stałe (touch-friendly min 44px na urządzeniach dotykowych),
    - “one-line labels” + ellipsis + tooltip (bez łamania na 2 linie).
  - Background / layering (MUST):
    - sidebar bg = **Layer 0** (`bg-navy-950`),
    - content area bg = **Layer 1** (`bg-navy-900`) — separacja tłem, nie borderem,
    - brak `border-right` jako domyślnej separacji (invisible borders).
  - Nav item system (MUST):
    - stany: default / hover / active / parent-active / disabled(locked) / “badge” (new/beta/soon),
    - hover = zmiana tła (bg-only), bez border shift, zgodnie z Tech Sexy,
    - active indicator (subtelny accent) jest spójny na wszystkich itemach.
  - Expand/Collapse behavior (MUST):
    - expanded: ikona + label + prawa strona (badge/chevron/lock) jak w `NavItem`,
    - collapsed: icons-only + tooltip; jeśli item ma subItems → **floating submenu** (ClickUp-like) działa stabilnie,
    - preferencja collapsed/expanded jest persisted per user (server-side jeśli jest; fallback localStorage).
  - Floating submenu system (MUST):
    - działa tylko gdy ma sens (collapsed lub item ma children),
    - positioning bez wychodzenia poza viewport,
    - keyboard + a11y: focus trap w menu, ESC zamyka, enter wybiera.
  - Grouping / hierarchy (MUST):
    - sekcje/grupy nav (np. “MODULES”, “ADMIN”, “SETTINGS”) używają kanonicznego stylu:
      - `uppercase`, `text-[11px]`, `text-muted`, spacing (ClickUp/Notion pattern),
    - brak “miksu” stylów pomiędzy grupami.
  - Role-based visibility (MUST):
    - Admin / SuperAdmin / Partner / Org są widoczne wg roli,
    - stany “locked” są czytelne, ale nie frustrują (tooltip: “what to do to unlock”).
  - Mobile behavior (MUST, spójne z T100):
    - na mobile: sidebar nie jest stałą kolumną — otwiera się jako drawer,
    - primary nav na mobile: bottom nav (już istnieje),
    - drawer sidebar: szybkie zamknięcie, safe area, touch targets.
  - Icon consistency (MUST, zależność od T101):
    - nav icons: 18–20px, outline mono-weight,
    - kolor ikony = kolor tekstu (poza active).
- OUT:
  - pełna przebudowa architektury nawigacji (routing/rekompozycja modułów) — to osobny epik,
  - “spaces/workspaces builder” jak w Notion/ClickUp (może być post‑V2), ale sidebar ma być gotowy wizualnie na takie rozszerzenia.

**Implementation notes (grounded w repo):**
- Sidebar jest już komponentowo rozbita:
  - `src/components/navigation/Sidebar/Sidebar.tsx`
  - `NavItem.tsx`, `SidebarHeader.tsx`, `SidebarFooter.tsx`, `FloatingSubmenu.tsx`, `menuConfig.ts`
- Jest rozróżnienie mobile/tablet/desktop przez `useDeviceType`.
- W `NavItem` widać realne state’y (active/parent-active/locked/badges) i touch-friendly padding.
- `TECH_SEXY_MIGRATION_PLAN.md` ma konkret: layer0/layer1 + group labels + hover bg-only.

**UX polish requirements (V2 “enterprise-grade”):**
- Zero “debug noise”: brak `console.log` w podstawowych ścieżkach nawigacji (logi tylko za flagą debug).
- Motion: 160–220ms transitions, brak agresywnych animacji, respects reduced-motion.
- Contrast & readability: dark/light oba premium (bez czystej bieli/czerni).

**Analytics / metrics:**
- `sidebar_item_clicked` (itemId, viewId, deviceType, collapsed)
- `sidebar_collapsed_toggled` (from,to)
- `sidebar_flyout_opened` (itemId)
- KPI: time-to-navigation (proxy), misclick rate (proxy: immediate back), adoption collapsed mode.

**Risks:**
- Zbyt dużo “koloru” w nav → łamie Tech Sexy (monochrome chrome).
- Hover-only affordances na touch → musi mieć alternatywy (tap, long-press lub jawne CTA).
- Rozjazd między desktop i mobile — V2 musi mieć 1 system zachowań.

**Definition of Done (DoD):**
- Sidebar jest spójny wizualnie i behawioralnie na desktop/tablet/mobile (drawer + bottom nav).
- Expand/collapse jest przewidywalne, persisted i nie psuje nawigacji ani submenus.
- Ikony i stany hover/active/disabled spełniają Tech Sexy + T101.
- Brak regresji a11y (keyboard nav, focus, tooltips/aria).

**Acceptance / test plan:**
- Test: desktop — przełącz expanded/collapsed, nawiguj po wszystkich top-level modules, sprawdź flyout na itemach z subItems.
- Test: mobile — otwórz sidebar z bottom nav “More”, kliknij 3 różne moduły, sidebar się zamyka, safe-area ok.
- Test: role-based — admin vs user: widoczność itemów i locked tooltips.
- Test: dark/light — czytelność, brak “kolorowych ikon” w nav.

---

## T103 — ⚫ ui/ux — Typography Optimization for Light & Dark Mode (Premium Standard) (readability = enterprise)
- Status spec: draft
- Link / ID (ClickUp): TBD
- Epic: Tech Sexy UI consistency (readability polish) TBD
- Priorytet / V2 scope: V2

**Business challenge (problem):**
Consultify to aplikacja do długiej pracy (czytanie analiz, decyzji, raportów, list). Jeśli typografia i kontrast nie są “world‑class” w light/dark, użytkownik szybciej się męczy, popełnia błędy i UI traci premium feel (nawet gdy funkcje są świetne).

**Cel (outcome, nie feature):**
W V2 typografia ma być **enterprise‑grade readability** w light i dark:
- stabilna hierarchia (typography as architecture),
- spójne wagi (semibold zamiast bold),
- spójne odstępy (line-height, spacing),
- brak “pływania” kolorów tekstu i kontrastu między modułami.

**Kanon / SSOT (już istnieje):**
- `docs/ui-standards/00-foundation/visual-language.md` → “Typography as architecture” + zasada **no `font-bold` na nagłówkach**
- `docs/ui-standards/TECH_SEXY_MIGRATION_PLAN.md` → Faza 6 (Typography audit: `font-bold` → `font-semibold`, `text-white` → `text-slate-100`)

**Scope (V2)**
- IN:
  - Global hierarchy rules (MUST):
    - nagłówki i sekcje: `font-semibold` (nie bold),
    - uppercase tylko dla małych labeli (np. group labels `text-[11px]`), nigdy dla tytułów,
    - spójne skale: title / section title / label / helper / body / caption.
  - Light/Dark contrast refinement (MUST):
    - usuwamy czyste `text-white` jako domyślną warstwę tekstu w dark (zastępujemy `text-slate-100` / `text-slate-200`),
    - “muted” i “secondary” mają być czytelne (nie zbyt blade),
    - linki i CTA mają mieć spójny kontrast bez krzyku (monochrome chrome).
  - Spacing + line-height (MUST):
    - długie bloki tekstu (chat odpowiedzi, opisy, raporty) mają kontrolowany line-height i max width tam gdzie to poprawia czytelność,
    - listy i tabelki: density spójna, bez “skakania” między ekranami.
  - Targeted rollout (V2):
    - priorytet: Sidebar + Header + MyWork + N/C detail views + Chat (T104) + public pages (T095),
    - admin/superadmin: tylko jeśli są krytyczne regresje; inaczej po “core UX”.
- OUT:
  - zmiana font family (post‑V2) — w V2 tylko tuning hierarchii/kontrastu/spacing.

**Implementation notes (grounded w repo):**
- globalne tokeny typografii istnieją w `index.css` (`--hig-font-*`, `--hig-text-*`),
- w kodzie jest dużo “lokalnych” stylów (`font-bold`, `text-white`) — V2 to normalizuje wg kanonu.

**Definition of Done (DoD):**
- Najważniejsze ekrany mają spójną hierarchię i “quiet luxury” readability w light/dark.
- Nie ma masowych `font-bold` w headingach (poza edge cases: ceny/critical).
- Kontrast spełnia WCAG AA dla podstawowych tekstów.

**Acceptance / test plan:**
- Test: porównanie light vs dark na: Sidebar, MyWork, Detail view (N/C), Chat, Landing — czytelność bez “przepaleń” i bez “bladego” tekstu.
- Test: długie treści (raporty/AI) — czyta się komfortowo (line-height, spacing, brak ciasnoty).

---

## T104 — ⚫ ui/ux — GPT‑Level Chat UI/UX for DBR77 Chat Interface (minimal noise, maximum clarity)
- Status spec: draft
- Link / ID (ClickUp): TBD
- Epic: AI interface polish (core UX) TBD
- Priorytet / V2 scope: V2

**Business challenge (problem):**
Chat jest głównym interfejsem AI. Jeśli jest głośny wizualnie, niespójny albo “gubi” kontekst (split/full, history, artifacts), użytkownik nie ufa odpowiedziom i nie chce pracować długo. Benchmark jest brutalny: ChatGPT desktop.

**Cel (outcome, nie feature):**
W V2 chat ma być “GPT‑level”:
- **czytelny** jak dokument (typografia + spacing),
- **szybki** (perceived performance, brak lag),
- **operacyjny** (jasne akcje: edit/regenerate/copy/feedback; narzędzia i tool calls są zrozumiałe),
- **spójny** w split i full (ten sam język UI),
- **bez rozpraszaczy** (monochrome chrome, 1 akcent koloru).

**Scope (V2)**
- IN:
  - Message readability (MUST):
    - wyraźny podział role (user/ai) bez krzykliwych bąbelków,
    - lepsza typografia dla markdown (nagłówki, listy, code blocks) w light/dark,
    - “long answer ergonomics”: nagłówki sekcji, whitespace, anchors/TOC post‑V2 jeśli potrzebne.
  - Composer / input (MUST):
    - sticky input (na mobile w zasięgu kciuka),
    - attachment/tools/voice są dostępne, ale nie dominują UI,
    - jasny stan “AI typing/streaming” + możliwość Stop.
  - Actions & density (MUST):
    - akcje wiadomości (copy/edit/regenerate/feedback) pojawiają się na hover (desktop) i są dostępne przez menu (touch),
    - redukcja wizualnego szumu: ikony tylko tam gdzie mają funkcję (T101),
    - “tool calls” są czytelne jako karty (status, expand args/results) bez zalewania ekranu.
  - History / navigation (MUST):
    - historia rozmów jako panel boczny (trigger zawsze w znanym miejscu),
    - przełączanie rozmów bez utraty kontekstu split workspace (stabilny displayMode).
  - Artifacts integration (MUST):
    - artifact badges i “save/export artifact” są spójne i nie rozbijają layoutu,
    - citations (jeśli występują) są czytelne i kompaktowe.
  - Split vs Full (MUST):
    - jeden komponent “source of truth” dla obu trybów (unikamy driftu),
    - w split: respektujemy maxHeight i brak overflow bugów,
    - w full: wykorzystujemy przestrzeń i nie wyglądamy jak “rozciągnięty panel”.
  - Mobile (MUST, spójne z T100):
    - duże touch targets,
    - safe area,
    - brak hover-only krytycznych akcji.
- OUT:
  - pełna przebudowa architektury czatu i store — V2 skupia się na UI/UX polish i spójności.

**Implementation notes (grounded w repo):**
- Rdzeń czatu istnieje:
  - `src/components/AIChat/UnifiedChatPanel.tsx` (split/full, history, streaming, voice, artifacts),
  - `src/components/layout/ChatPanel.tsx` (message actions, tool call cards, voice),
  - `ChatSlidingPanel`, `MessageRenderer`, `ResponseActions`, `ConversationList`.
- V2: UI polish ma się oprzeć o Tech Sexy (visual-language) + typografię (T103).

**Analytics / metrics:**
- `chat_message_sent` / `chat_regenerate_clicked` / `chat_message_edited`
- `chat_tool_call_expanded` (czy ludzie rozumieją narzędzia)
- KPI: session length, drop-off, copy rate, regen rate, satisfaction feedback.

**Definition of Done (DoD):**
- Chat wygląda i działa premium w split i full, light i dark, desktop i mobile.
- Akcje są intuicyjne i nie wymagają “szukania”.
- Tool calls, artifacts i streaming nie psują czytelności.

**Acceptance / test plan:**
- Test: split mode — praca w module + chat równolegle (brak overflow/scroll bugów, input zawsze dostępny).
- Test: full mode — długie odpowiedzi, code blocks, citations, tool calls (czytelne, nie “rozjeżdżają” UI).
- Test: mobile — wysyłanie, stop streaming, copy/edit przez menu, safe area.

---

## T105 — ⚫ ui/ux — Chat Navigation & Button Design Refinement (add 3rd “Business” button + clear hierarchy)
- Status spec: draft
- Link / ID (ClickUp): TBD
- Epic: AI interface polish (navigation + actions) TBD
- Priorytet / V2 scope: V2

**Twoja myśl (MUST):**
Dokładamy **trzeci przycisk specjalistyczny** dla naszej aplikacji — “business functions” czatu. Ma to być szybki, przewidywalny entrypoint do operacyjnych akcji (enterprise B2B SaaS).

**Business challenge (problem):**
Chat bez jasnej nawigacji i bez “business command” zachowuje się jak zwykłe okno rozmowy. W Consultify chat ma prowadzić do pracy: drafty, decyzje, raporty, akcje do zatwierdzenia. Bez 3-ciego przycisku użytkownik nie ma pewnego “one place” do tych funkcji i gubi się między historią, rozmową i pending actions.

**Cel (outcome, nie feature):**
W V2 chat ma prostą, czytelną nawigację z jasną hierarchią:
- **New** (nowa rozmowa),
- **History** (panel historii),
- **Business / Actions** (specjalistyczny przycisk do funkcji biznesowych czatu),
plus istniejące kontrolki pomocnicze (np. auto-read) po prawej stronie — bez wizualnego szumu.

**Scope (V2)**
- IN:
  - 3rd specialist button: “Business / Actions” (MUST):
    - umieszczony w headerze czatu obok `New` i `History` (po lewej),
    - ikona mono (outline, text-color) zgodna z T101,
    - tooltip + a11y label (PL/EN),
    - opcjonalny badge/licznik (np. liczba pending actions) — bez krzykliwego koloru.
  - Behavior (MUST):
    - klik “Business” otwiera **Action Center** czatu:
      - minimalnie: widok `AI Actions` (`/ai-actions` → `ActionProposalView`),
      - spójne z istniejącym `PendingActionsIndicator` (onViewAll) i z `useAIActionsStore`.
    - zachowanie musi być spójne w split/full:
      - **split**: otwarcie Action Center nie może “gubić” kontekstu pracy (workspaceContext); preferowane jako drawer/panel lub nawigacja z łatwym powrotem,
      - **full**: może być nawigacja do `/ai-actions` w tej samej zakładce z jasnym “Back to chat”.
  - Visual hierarchy & density (MUST):
    - wszystkie przyciski w headerze mają identyczną geometrię (hit-area, radius, hover bg-only),
    - monochrome chrome: kolory tylko dla aktywnego stanu / semantyki; reszta “text-muted”,
    - brak “button soup”: jeśli rośnie liczba kontroli — konsolidujemy do menu, nie dokładamy kolejnych ikon.
  - Touch & mobile (MUST, spójne z T100):
    - brak hover-only affordances dla krytycznych akcji,
    - minimum 44×44px tap target,
    - na mobile “Business” jest dostępny zawsze (nie chowa się).
  - Keyboard (SHOULD):
    - skrót do Action Center (np. `Cmd/Ctrl+Shift+A`), z zachowaniem dostępności i bez konfliktów.
- OUT:
  - przebudowa całego menu aplikacji (to osobne epiki),
  - pełny CRM/pipeline w czacie (post‑V2).

**Implementation notes (grounded w repo):**
- Header czatu już ma 2 przyciski po lewej (New + History) w `src/components/AIChat/UnifiedChatPanel.tsx`.
- “Business functions” już istnieją jako system AI Actions:
  - `PendingActionsIndicator` w UnifiedChatPanel,
  - `ActionProposalView` dostępny pod `/ai-actions` (AppRoutes),
  - store: `useAIActionsStore`.
- V2: 3-ci przycisk ma być spójnym entrypointem do tego systemu (nie nowy byt obok).

**Analytics / metrics:**
- `chat_business_button_clicked` (mode split/full, deviceType, pendingCount)
- `ai_actions_view_opened` (source=chat_button vs indicator)
- KPI: % users who review/approve actions, time-to-approve, reduction w “where do I find pending actions?” friction.

**Definition of Done (DoD):**
- W headerze czatu istnieje 3-ci przycisk “Business/Actions” z poprawną hierarchią i a11y.
- Przycisk otwiera Action Center i działa spójnie w split/full/mobile.
- UI przycisków i nawigacji czatu jest spójne z Tech Sexy + T101.

**Acceptance / test plan:**
- Test: klik “Business” w split → Action Center otwiera się bez utraty workspace context i da się wrócić do czatu.
- Test: badge/pending count (jeśli włączone) zgadza się z pending actions.
- Test: mobile — tap targets i safe area; brak ukrytych akcji.

---

## T106 — 🩷 feedback — Advanced User Feedback System (Full Feedback Flow) (100% traceability, triage, learning)
- Status spec: draft
- Link / ID (ClickUp): TBD
- Epic: Product learning loop (enterprise feedback) TBD
- Priorytet / V2 scope: V2

**Business challenge (problem):**
Bez systemowego feedback loop:
- zgłoszenia giną (brak ownera, statusu, SLA),
- nie uczymy produktu z danych (brak kategorii, trendów, duplikatów, root-cause),
- rośnie frustracja użytkowników (“wysłałem i nic się nie dzieje”),
- a zespół ma chaos (brak priorytetyzacji i routing’u).

**Cel (outcome, nie feature):**
W V2 feedback jest “enterprise-grade”:
- **łatwy do wysłania** w 15–60 sekund (bug/idea/pulse/feature request),
- **w pełni śledzalny** (kto/co/gdzie/kiedy/jaki kontekst + status + odpowiedź),
- **triage-ready** (kategoryzacja, severity/impact, duplikaty, priorytet),
- **zamykany** (odpowiedź do użytkownika + statusy + audit),
- **uczący produkt** (trending topics + AI analysis + raporty).

**Scope (V2)**
- IN:
  - Capture UX (MUST):
    - 1 entrypoint w aplikacji (panel feedback) + szybka ścieżka “pulse”,
    - typy:
      - Bug report (z severity),
      - Idea (lekka),
      - Feature request (z impact + category),
      - Quick pulse (1–5 rating + optional comment).
    - potwierdzenie po wysyłce + ID zgłoszenia.
  - Context & metadata (MUST):
    - zapisujemy kontekst:
      - route/path (`window.location.pathname`),
      - device (mobile/tablet/desktop), screen size, user agent,
      - język UI + theme (light/dark),
      - workspace context (jeśli dostępne: viewId, projectId, entityId),
      - timestamp,
      - (opcjonalnie) screenshot / attachment (post‑V2 jeśli storage niegotowe).
  - Status system (MUST):
    - kanoniczne statusy (backend już je ma):
      - `NEW` → `PENDING` → `IN_PROGRESS` → `REVIEWED` → `RESOLVED` → `ARCHIVED`
    - UI admin/superadmin musi być spójny z tymi statusami (koniec legacy `READ`).
  - Admin/SuperAdmin triage (MUST):
    - lista feedbacku z filtrami (status/type/severity/organization) + search,
    - widok szczegółu zgłoszenia:
      - pełny message,
      - kontekst/metadata,
      - historia zmian statusu,
      - odpowiedź admina (i notyfikacja do usera jeśli możliwe),
    - możliwość oznaczenia duplikatu (link do “master”).
  - AI analysis (MUST, jeśli włączone):
    - sentiment + keywords + priority scoring + podobne zgłoszenia,
    - zapis analizy do tabeli `feedback_analysis`,
    - endpointy: insights/trending/ai-analysis są częścią V2 (już istnieją).
  - Feature requests + voting (MUST):
    - zapis do `feature_requests`,
    - możliwość głosowania (`feature_votes`) (minimum: per user unique),
    - admin może ustawić status/target release/notes.
  - Notifications & routing (MUST):
    - dla `CRITICAL`: natychmiastowa notyfikacja wewnętrzna (NotificationService) + (opcjonalnie) WhatsApp alert,
    - dla pozostałych: batch/digest (post‑V2) lub standardowa notyfikacja.
  - Privacy & compliance (MUST):
    - metadata nie może przechowywać PII ponad to co konieczne,
    - user ma możliwość wyłączenia notyfikacji dot. odpowiedzi (prefs).
- OUT:
  - publiczny “roadmap portal” dla użytkowników (post‑V2),
  - pełny, zewnętrzny CRM ticketing (Jira/Linear) jako SSOT (post‑V2; w V2 można dodać `related_ticket_url`).

**Implementation notes (grounded w repo):**
- Backend już ma szeroki zakres:
  - `server/src/routes/feedback.routes.ts`:
    - `POST /api/feedback`, listowanie, status update, admin response,
    - `POST /api/feedback/pulse`, `POST /api/feedback/feature`,
    - trending + pulse summary + AI analysis endpoints.
- Data model już istnieje w migracji:
  - `server/migrations/200_enterprise_feedback_system.sql`:
    - `feedback_pulse`, `feature_requests`, `feature_votes`, `feedback_analysis`, `feedback_trending_topics`,
    - prefs i admin settings.
- Frontend entrypoint istnieje:
  - `src/components/Feedback/FeedbackSidePanel.tsx` (report/pulse/feature),
  - triage view istnieje, ale jest legacy/simplified:
    - `src/views/superadmin/SuperAdminFeedbackView.tsx` (wymaga ujednolicenia statusów i rozszerzenia o detail).

**Data model (V2, canonical):**
- `system_feedback` (bug/idea) + `feedback_analysis` (AI)
- `feedback_pulse` (rating)
- `feature_requests` + `feature_votes`
- `feedback_notification_prefs` (user prefs)
- `feedback_admin_settings` (global toggles)

**API contract (V2, minimal):**
- `POST /api/feedback` (bug/idea)
- `POST /api/feedback/pulse`
- `POST /api/feedback/feature`
- `GET /api/feedback` (admin list)
- `PATCH /api/feedback/:id/status`
- `POST /api/feedback/:id/respond`
- `GET /api/feedback/stats/summary`
- `GET /api/feedback/trending`
- `GET /api/feedback/ai-analysis/:id`

**Analytics / metrics:**
- `feedback_opened` / `feedback_submitted` (type, severity, context)
- `feedback_status_changed` (from,to)
- `feature_request_submitted` / `feature_vote_cast`
- KPI: time-to-first-triage, time-to-resolve, top trending topics, opt-out rate, volume per org/module.

**Risks:**
- Noise (za dużo zgłoszeń) → V2 musi mieć kategorie, severity, duplikaty, i szybki triage.
- Status mismatch między UI i backend → V2 wymaga kanonicznych statusów wszędzie.

**Definition of Done (DoD):**
- Użytkownik może wysłać bug/idea/pulse/feature request z kontekstem i dostać potwierdzenie.
- Admin/SuperAdmin widzi listę + detail i może zmienić status oraz odpisać.
- AI analysis (jeśli włączone) generuje insights/trending i zapisuje do DB.
- Działa routing dla CRITICAL (internal notification).

**Acceptance / test plan:**
- Test: z 3 różnych modułów wysłać feedback (BUG + IDEA + FEATURE) — payload zawiera poprawny context i zapisuje się w DB.
- Test: admin zmienia status i dodaje response — status się aktualizuje, response jest widoczne i audytowalne.
- Test: pulse rating zapisuje się i pojawia w pulse-summary.

---

## T107 — 🩷 feedback — System Stability & Uptime Assurance Framework (SLO, observability, deploy gates, recovery)
- Status spec: draft
- Link / ID (ClickUp): TBD
- Epic: Platform reliability / “ready to show the world” operations
- Priorytet / V2 scope: V2 (blocking dla public launch)

**Business challenge (problem):**
Jeśli produkt ma być “ready to show the world”, to nie wystarczy feature set — potrzebujemy przewidywalnej stabilności:
- downtime, błędy 5xx, i degradacje AI/DB niszczą zaufanie,
- bez SLO i alertów nie wiemy, że coś się psuje,
- bez deploy gate’ów możemy wypchnąć regresję do production,
- bez backup/recovery planu ryzykujemy utratę danych.

**Cel (outcome):**
W V2 Consultify ma kompletny “uptime assurance framework”:
- szybkie wykrywanie degradacji + alerty,
- kontrolowane wdrożenia (gates) + rollback readiness,
- mierzalne SLO (API, DB, AI, background jobs),
- backup + recovery playbook + weryfikacja,
- minimalny “ops surface” do triage (SuperAdmin).

**Scope (V2)**
- IN (MUST):
  - **SLO + error budget** (MUST):
    - zdefiniowane SLO dla:
      - API uptime (np. 99.9%/30d),
      - p95 latency kluczowych endpointów,
      - 5xx rate,
      - AI service availability (LLM calls success rate / timeout rate),
      - cron jobs success rate (Backup, Dunning, Scheduler, HealthCheckJob).
    - zmapowane alert thresholds (np. 3x 5xx spike, readiness=503 > X min).
  - **Health endpoints & readiness/liveness** (MUST):
    - jeden “kanoniczny” zestaw endpointów do monitoringu:
      - `/ping`
      - `/api/ready` (gating DB init)
      - `/api/health/*` (DB pool health itp.)
      - `/api/system/*` (system health + encryption)
    - spójny kontrakt odpowiedzi (status, timestamp, komponenty, degraded vs down).
  - **Observability** (MUST):
    - error monitoring (Sentry) w prod/staging,
    - correlation/request id end‑to‑end w logach (RequestStore),
    - metryki Prometheus:
      - `/api/metrics` (stabilne, fail-open, bez PII),
      - kluczowe counters: requests_total, 5xx_total, latency buckets, rate-limit hits, AI timeouts, DB pool utilization.
  - **Alerting & escalation** (MUST):
    - krytyczne alerty (DB down, backup failures, readiness fails) idą co najmniej email + wewnętrzna notyfikacja; opcjonalnie WhatsApp.
    - anti-spam: dedupe, “recovered” event po powrocie (tak jak `HealthCheckJob`).
  - **Deploy gates (automatyczne checki przed/po deploy)** (MUST):
    - Playwright “smoke / deploy-gate” jest traktowany jako gate:
      - krytyczne ścieżki: login, pages render, API appcore/billing/interview/projects/org.
    - gate musi odpalić się na staging i/lub przed promocją do production.
  - **Recovery & backups** (MUST):
    - cron backup + retention działa i raportuje metryki (success/failure),
    - manual backup endpoint/tooling dla SuperAdmin (jeśli istnieje) lub procedura operacyjna,
    - test restore procedure (min. “table-level sanity check”).
  - **Stability hardening** (MUST):
    - produkcja nie wystawia stub routes (już jest mechanizm w `ApiGateway`, trzeba domknąć coverage),
    - timeouty + retry policy dla zewnętrznych zależności (LLM, Stripe, email),
    - graceful shutdown z cleanup (ShutdownManager) i brak utraty inflight requestów.
- OUT (post‑V2):
  - pełna, publiczna status page (external) + incident comms portal,
  - distributed tracing (pełne OTel) jeśli koszt/effort zbyt duży na V2.

**Implementation notes (grounded w repo):**
- Serwer ma już solidne fundamenty:
  - startup gating: `/api/ready` + 503 “SERVER_STARTING” gate w `server/src/index.ts`,
  - health/readiness/liveness: `HealthCheckController` + `server/src/routes/health.routes.ts`,
  - Prometheus endpoint: `server/src/routes/metrics.routes.ts`,
  - Sentry fail-open: `server/src/config/SentryConfig.ts`,
  - cron DB check + email alerts: `server/src/cron/HealthCheckJob.ts`,
  - backup cron + retention + failure thresholds: `server/src/cron/BackupCron.ts`,
  - stabilization endpoints for superadmin: `server/src/routes/stabilization.routes.ts`,
  - system health endpoints: `server/src/routes/systemHealth.routes.ts`.
- T107 w V2 to nie “dodaj endpoint” — to **ujednolicenie kontraktów, alertów, metryk i gate’ów** + minimalny runbook.

**Deliverables (V2):**
- SLO spec (w tym doc w `docs/ops/` lub sekcja w planie) + alert thresholds.
- Spójne health contracts + dashboard (SuperAdmin) agregujący:
  - readiness/health/system-health/backup status,
  - ostatnie 24h: error rate, 5xx, latency, AI timeouts, backup success.
- Deploy gate pipeline: “smoke suite” jako wymóg release.
- Recovery playbook + test restore checklist.

**Analytics / metrics:**
- `uptime_readiness_fail` (duration, component)
- `backup_job_failed` / `backup_job_recovered`
- `deploy_gate_failed` (suite, spec)
- `api_5xx_spike_detected`

**Definition of Done (DoD):**
- Jest zdefiniowane i wdrożone SLO + alerting (przynajmniej dla DB/backup/5xx spikes).
- Health/readiness/liveness mają spójne kontrakty i są wykorzystywane w monitoringu.
- `/api/metrics` działa stabilnie i zasila dashboard.
- Deploy gate (Playwright smoke) blokuje release przy regresji.
- Backup + retention działa; istnieje udokumentowany i zweryfikowany proces restore.

**Acceptance / test plan:**
- Test: symulacja “DB down” → alert idzie raz, potem “RECOVERED” po powrocie.
- Test: backup fail 3 razy → powstaje CRITICAL alert.
- Test: deploy gate wyłapuje break w krytycznej ścieżce (celowa zmiana) i blokuje deploy.
- Test: `/ping`, `/api/ready`, `/api/health/database`, `/api/system/detailed` działają zgodnie z kontraktem.

---

## T108 — 🩷 superadmin — Full Superadmin Control & System Testing Framework (control plane + guardrails + CI confidence)
- Status spec: draft
- Link / ID (ClickUp): TBD
- Epic: Operations / Control Plane / Quality Gate
- Priorytet / V2 scope: V2 (launch‑critical)

**Business challenge (problem):**
W V2 nie da się operować produktem “na czucie”. Potrzebujemy:
- kompletnego, bezpiecznego panelu SuperAdmin (obsługa klientów, billing, legal, AI, system),
- narzędzi do szybkiego triage (health, audit, metrics),
- oraz frameworku testów, który daje pewność deploy’a (gates, bootstrapping e2e, kontrakty).

**Cel (outcome):**
SuperAdmin jest **systemowym control plane** (bez ręcznych SQL / “grzebania na serwerze”), a testy są częścią release’ów:
- 1) wszystko, co krytyczne operacyjnie jest dostępne w SuperAdmin,
- 2) wszystkie akcje administracyjne są bezpieczne (guardrails) i audytowalne,
- 3) CI ma stabilne, powtarzalne testy (unit/integration/e2e) i “deploy gates” blokujące regresje.

**Scope (V2)**
- IN (MUST) — SuperAdmin Control Plane:
  - **AuthZ & security**:
    - superadmin guard jest nie do obejścia (`verifySuperAdmin` sprawdza token + DB),
    - rate limiting na superadmin endpoints,
    - wszystkie “high‑risk actions” wymagają:
      - explicit confirmation,
      - podania “reason”,
      - audytu (kto/kiedy/co/na czym).
  - **Customers / Users**:
    - zarządzanie organizacjami i użytkownikami (CRUD w zakresie V2),
    - access requests / access codes (approval workflow),
    - impersonation (tylko SuperAdmin, logowane, z jasnym UI indicator i “exit impersonation”).
  - **System**:
    - health monitoring (API/DB/AI), metrics, backup status, feature flags, audit log,
    - narzędzia “safely diagnose” (bez wycieku PII/secrets).
  - **Revenue / Billing ops**:
    - podgląd i podstawowe operacje billing (invoices, usage, settlements) zgodnie z istniejącymi route’ami.
  - **Legal / Compliance**:
    - zarządzanie dokumentami prawnymi + publikacja + audit acceptance events (spójne z T093).
  - **AI Platform ops**:
    - configuration/operations/analytics w jednym miejscu (nie “legacy chaos”), z jasnym podziałem na taby.
- IN (MUST) — System Testing Framework:
  - **Deploy gates**:
    - Playwright smoke suite jest gate’em release (patrz istniejące `tests/e2e/smoke/deploy-gate-*`).
  - **Test support API (E2E bootstrap/cleanup)**:
    - endpointy bootstrap/cleanup są dostępne wyłącznie w `NODE_ENV=test` + `ENABLE_TEST_SUPPORT=true` + secret header,
    - generują test tenant + token i czyszczą dane per runId (repeatable runs).
  - **Contract + integration tests (backend)**:
    - kluczowe middleware (auth, rbac/superadmin, validation, rate limiting, sanitization) mają testy kontraktowe (już są w `tests/unit/backend/...` — V2 domyka coverage dla superadmin/test-support).
  - **“No stubs in production”**:
    - produkcja nie wystawia 501 stub routes (wspierane przez gating w `ApiGateway`; V2 musi objąć krytyczne ścieżki).

**Implementation notes (grounded w repo):**
- SuperAdmin UI już istnieje jako modularny panel:
  - `src/views/superadmin/SuperAdminView.tsx` (Overview/Customers/AI Platform/System/Revenue/Security/Configuration/Analytics),
  - system tab ma Enterprise panele (`EnterpriseHealthMonitor`, `EnterpriseBackupPanel`, `EnterpriseAuditLog`, `EnterpriseFeatureFlags` itd.).
- Backend ma superadmin router:
  - `server/src/routes/superadmin.routes.ts` (wiele endpointów, część przez legacy controller wrapper).
- Guard:
  - `server/src/middleware/superAdmin.middleware.ts` (token + DB truth; ustawia `req.user.isSuperAdmin`).
- Test harness:
  - `server/src/routes/testSupport.routes.ts` (bootstrap/cleanup, hard‑gated i “looks like 404” gdy wyłączone),
  - montowane tylko w test (`Gateway.ts`).

**Guardrails (MUST, V2):**
- Każda destrukcyjna operacja w SuperAdmin:
  - wymaga reason + confirmation,
  - jest logowana (audit trail),
  - ma “dry‑run” / preview, gdy to ma sens (np. bulk ops).
- Impersonation:
  - zawsze logowane + wyświetlane w UI + łatwe wyjście.
- Sekrety i tokeny:
  - nigdy nie renderujemy w UI w formie “copy/paste” bez explicit intent + masking,
  - logi/metriki nie zawierają PII/secrets.

**Deliverables (V2):**
- “SuperAdmin completeness map”: lista kluczowych operacji i gdzie są w UI (bez martwych linków).
- Ujednolicone kontrakty API dla SuperAdmin (error codes, statusy, validation).
- Audyt działań administracyjnych (min. high‑risk actions).
- Test harness działa w CI i lokalnie:
  - bootstrap/cleanup,
  - smoke deploy gates,
  - kontrakty middleware.

**Analytics / metrics:**
- `superadmin_action_executed` (actionType, targetType, targetId, reason, success/failure)
- `superadmin_impersonation_started` / `superadmin_impersonation_ended`
- `test_support_bootstrap_called` / `test_support_cleanup_called` (env, runId)
- KPI: time-to-triage, time-to-fix, deploy gate failure rate, mean time to recover (z T107).

**Definition of Done (DoD):**
- SuperAdmin obejmuje krytyczne obszary operacyjne i jest spójny (brak “martwych” modułów).
- High‑risk actions mają guardrails + audyt.
- Test support API jest bezpieczne i działa w CI (nigdy w prod).
- Deploy gate (smoke) blokuje release przy regresji i jest stabilny.

**Acceptance / test plan:**
- Test: superadmin login → dostęp do Customers/System/Revenue/AI Platform bez błędów 403 (dla SUPERADMIN).
- Test: impersonation → widoczny banner + audit event + “exit impersonation”.
- Test: w trybie testowym:
  - `POST /api/test-support/bootstrap` tworzy tenant i token,
  - `POST /api/test-support/cleanup` czyści dane i usuwa tenant.
- Test: smoke deploy gate przechodzi na staging i blokuje deploy przy intencjonalnej regresji.

---

## T109 — 🩷 superadmin — Payment System Integration (Stripe subscriptions + token billing + webhooks + dunning + SuperAdmin ops)
- Status spec: draft
- Link / ID (ClickUp): TBD
- Epic: Monetization & Trust (trial → paid, billing ops, revenue integrity)
- Priorytet / V2 scope: V2 (monetyzacja, launch‑critical)

**Business challenge (problem):**
Monetyzacja w V2 nie może być “symboliczna”. Musi działać end‑to‑end:
- jasny zakup/upgrade/cancel,
- spójne statusy subskrypcji w aplikacji,
- niezawodne webhooks (bez fałszywych eventów),
- dunning i odzyskiwanie płatności,
- superadmin ops: faktury, metody płatności, plany, zmiany subskrypcji, spory/zwroty (w zakresie V2).

**Cel (outcome):**
W V2 użytkownik może przejść z trial do paid bez tarcia, a system jest audytowalny i “enterprise‑ready”:
- Stripe jest **SSOT dla płatności**, a DB jest **SSOT dla dostępu/stanów w aplikacji** (spójne mapowanie),
- webhooks są podpisane i idempotentne,
- billing w UI i SuperAdmin pokazuje prawdziwe dane (nie placeholdery),
- payment failure ma proces odzysku (dunning) i kontrolowane ograniczanie dostępu (zgodnie z T091–T092).

**Scope (V2)**
- IN (MUST):
  - **Stripe configuration & environments**:
    - spójny zestaw env:
      - `STRIPE_SECRET_KEY` (required w prod),
      - `STRIPE_WEBHOOK_SECRET` (required w prod),
      - `STRIPE_PUBLISHABLE_KEY` (frontend),
      - `FRONTEND_URL` (redirects),
    - tryb test/staging odseparowany (keys + webhook endpoints).
  - **Subscription billing**:
    - tworzenie subskrypcji / checkout flow:
      - start płatnej subskrypcji (trial→paid),
      - upgrade/downgrade z proration policy,
      - cancel (end of period lub natychmiast — zgodnie z polityką),
    - mapowanie planów w DB ↔ Stripe Price/Product:
      - plan ma `stripe_price_id` (lub mapping table),
      - subscription events zapisane w DB (audit).
  - **Payment methods (cards) — PCI‑safe**:
    - dodanie karty przez Stripe SetupIntent,
    - zapis tylko bezpiecznych metadanych (brand/last4/exp), nigdy PAN/CVC,
    - default payment method per organization.
  - **Invoices & credit notes**:
    - lista faktur w UI i SuperAdmin,
    - integracja z Stripe invoice PDF gdy dostępne,
    - obsługa manual invoice gaps (jeśli zostaje “GAP-INVOICE-*” to musi być świadomie OUT lub domknięte).
  - **Webhooks (Stripe) — secure & reliable**:
    - **jeden kanoniczny handler** z `express.raw({ type: 'application/json' })`,
    - w prod: **obowiązkowa weryfikacja podpisu** (`stripe.webhooks.constructEvent`),
    - idempotency:
      - zapis `event.id` i “processed_at” (dedupe),
      - retry queue na błędy (max retries, backoff),
    - obsługiwane eventy minimum:
      - `customer.subscription.created|updated|deleted`,
      - `invoice.paid`, `invoice.payment_failed`, `invoice.finalized`,
      - (opcjonalnie) `checkout.session.completed` dla token billing.
  - **Dunning & recovery**:
    - payment_failed → dunning stages + komunikacja (email),
    - recovered → odblokowanie / exit dunning,
    - final suspension → ograniczenie dostępu zgodnie z AccessPolicy (T091–T092).
  - **SuperAdmin billing operations**:
    - przegląd organizacji z billing status (trial/active/past_due/canceled),
    - podejrzenie subskrypcji, payment methods, invoices,
    - podpięcie/zmiana planu (guardrails + reason + audit),
    - “grace period” visibility (jeśli wspierane przez `BillingCommandService`).
  - **Token billing (AI credits)**:
    - zakup paczek tokenów przez Stripe Checkout (oddzielny produkt/price),
    - webhook potwierdzenia kredytuje saldo (idempotentnie),
    - analytics marży/zużycia w SuperAdmin.
- OUT (post‑V2):
  - pełna “self‑serve customer portal” (Stripe Billing Portal) jeśli nie ma jeszcze endpointów,
  - automatyczne podatki / pełne tax engine (jeśli obecne komponenty UI to doprecyzować w osobnym tasku).

**Implementation notes (grounded w repo):**
- Backend billing:
  - `server/src/routes/billing/billing.routes.ts` ma już:
    - invoices, payment methods, setup intent, analytics endpoints, `BillingCommandService` hooks.
- Token billing:
  - `server/src/routes/tokenBilling.routes.ts` ma checkout purchase + webhook z `express.raw` i signature.
- Webhooks:
  - aktualnie `/api/webhooks/stripe` (w `server/src/routes/webhooks.routes.ts`) przyjmuje eventy **bez signature verification** → V2 MUSI to zastąpić kanonicznym, podpisanym webhookiem.
  - istnieje lepsza implementacja w `server/src/routes/webhooks/stripe.routes.ts` (raw body, signature, retry queue) — to powinno stać się kanonem.
- Dunning:
  - `server/src/services/dunningService.ts` obsługuje payment_failed/succeeded i stages.
- Frontend:
  - istnieją komponenty billing w `src/components/billing/*` i SuperAdmin revenue/billing views.
  - `src/services/api.ts` ma metody: subscribe/change/cancel, invoices, setup intent, add/remove payment methods, token billing flows.

**Data model (V2, canonical):**
- Organizations:
  - przechowujemy `stripe_customer_id`, `stripe_subscription_id` (albo w osobnej tabeli billing),
  - statusy billing: active / past_due / trial / canceled + grace period.
- Billing tables (już istnieją lub są implied przez routes):
  - `subscriptions`, `subscription_events`, `invoices`, `payment_methods`, `payment_attempts`,
  - webhook deliveries / retries (dla idempotency i triage).

**Analytics / metrics:**
- `billing_checkout_started` / `billing_checkout_completed` (planId, source=trial_upgrade/settings)
- `billing_subscription_changed` (fromPlan,toPlan)
- `billing_payment_failed` / `billing_payment_recovered`
- `token_purchase_started` / `token_purchase_completed`
- KPI: trial→paid conversion, churn, recovery rate (dunning), failed payment rate.

**Definition of Done (DoD):**
- Stripe subskrypcje działają end‑to‑end (subscribe/change/cancel) i stan w aplikacji jest spójny.
- Webhook Stripe jest podpisany, idempotentny i ma retry strategy; nie ma niepodpisanych handlerów w prod.
- Dunning działa (payment_failed → stages → recover/suspend) i jest widoczny w SuperAdmin.
- Token billing purchase + webhook kredytuje saldo idempotentnie.
- SuperAdmin pozwala na podstawowe billing ops z guardrails + audytem.

**Acceptance / test plan:**
- Test: trial→paid:
  - start checkout → webhook → org ma `active` + dostęp odblokowany.
- Test: payment_failed:
  - event `invoice.payment_failed` → org wchodzi w dunning + wysyła email; po `invoice.paid` wychodzi.
- Test: webhook security:
  - zły podpis → 400; poprawny → 200; duplikat event.id → no-op.
- Test: token purchase:
  - checkout.session.completed → saldo tokenów rośnie dokładnie raz (idempotency).

---

## T110 — 🩷 superadmin — Google Login Integration (OAuth/OIDC login + account linking + security events)
- Status spec: draft
- Link / ID (ClickUp): TBD
- Epic: IAM / onboarding conversion / enterprise security
- Priorytet / V2 scope: V2 (launch‑critical)

**Business challenge (problem):**
Hasło jako jedyna ścieżka logowania zwiększa friction (szczególnie trial→paid) i obniża trust. Potrzebujemy “enterprise‑grade” logowania Google:
- szybkie login/signup,
- bezpieczny flow (state/PKCE, anti‑CSRF),
- spójne sesje i audyt bezpieczeństwa,
- możliwość powiązania konta (password ↔ Google) bez duplikatów.

**Cel (outcome):**
Użytkownik może zalogować się / założyć konto przez Google w 1–2 kliknięcia, a system:
- tworzy lub mapuje usera deterministycznie,
- zapisuje powiązanie w DB (`oauth_links`) i loguje security events,
- kończy flow redirectem do aplikacji z ważnym tokenem (jak obecny `OAuthCallback` oczekuje).

**Scope (V2)**
- IN (MUST):
  - **Backend endpoints (kanoniczne):**
    - `GET /api/auth/google` (start auth; redirect do Google),
    - `GET /api/auth/google/callback` (code → tokens → user → redirect do frontend).
  - **Flow i security (MUST):**
    - authorization code flow z **state** (+ PKCE jeśli realizowane w server‑side flow),
    - state przechowywany w httpOnly cookie lub server‑side store (TTL),
    - anti-replay: jednorazowe użycie state, TTL ~10 min,
    - weryfikacja `email_verified` (Google) jako warunek automatycznego provisioningu (jeśli niezweryfikowany → blok + komunikat).
  - **User mapping / provisioning (MUST):**
    - jeśli istnieje `oauth_links(provider='google', provider_user_id)` → logowanie do przypisanego usera,
    - jeśli nie ma linka:
      - jeśli istnieje user o tym samym email → linkujemy konto (z audytem),
      - jeśli nie ma usera → tworzymy usera (jeśli polityka organizacji na to pozwala; w przeciwnym razie “pending/blocked”).
    - zapis do `oauth_links`:
      - `provider='google'`,
      - `provider_user_id` (sub),
      - `provider_email`,
      - tokens (encrypted) opcjonalnie (jeśli potrzebne do późniejszych integracji),
      - `last_login_at`.
  - **Session + audit (MUST):**
    - tworzymy standardowy token jak w pozostałych flow (ten sam format i TTL),
    - zapis security event: `login_success` z `auth_method='sso'` lub `auth_method='oauth'` (kanoniczne nazewnictwo V2),
    - logujemy `login_failed` z reason code (bez leak secretów).
  - **Frontend integration (MUST):**
    - przycisk już istnieje w `src/views/AuthView.tsx` i kieruje na `${API_URL}/auth/google`,
    - potrzebujemy kanonicznego frontend callback route (MUST):
      - `GET /oauth/callback` (mount `src/views/OAuthCallback.tsx`) **albo** inny stabilny endpoint,
      - backend po sukcesie redirectuje do `${FRONTEND_URL}/oauth/callback?token=...&user=...`.
  - **Org security policies (MUST):**
    - respektujemy ustawienia security org (np. “SSO only” vs allow password) jeśli są w `security_settings` / `sso_configurations`.
- OUT (post‑V2):
  - pełna Google Workspace domain enforcement + group mapping (jeśli nie jest potrzebne na V2),
  - pełna obsługa Google jako IdP przez `sso_configurations` (OIDC) jeśli wybierzemy inną ścieżkę w V2.

**Implementation notes (grounded w repo):**
- Frontend:
  - `AuthView.tsx` ma `handleGoogleLogin()` → `${API_URL}/auth/google`.
  - `OAuthCallback.tsx` już obsługuje redirect z `token` + `user` w query string (ale wymaga routingu).
- Backend:
  - `server/src/config/Config.ts` ma `GOOGLE_CLIENT_ID/SECRET/CALLBACK_URL`.
  - `server/src/routes/oauthRoutes.routes.ts` ma tylko `/oauth/status` i stuby → V2 wymaga realnych `/api/auth/google*`.
- DB:
  - `server/migrations/055_security_module.sql.sql` ma tabelę `oauth_links` (idealna do linkowania provider to user).

**API contract (V2):**
- `GET /api/auth/google` → 302 do Google
- `GET /api/auth/google/callback` → 302 do frontend callback z `token` i (opcjonalnie) `user`
- `GET /api/auth/oauth/status` → {google.configured, loginUrl}

**Analytics / metrics:**
- `oauth_login_started` (provider=google, source=auth_view)
- `oauth_login_succeeded` / `oauth_login_failed` (provider, reason)
- KPI: login conversion, time-to-login, % users using social login, reduction in password reset.

**Definition of Done (DoD):**
- Google login działa end‑to‑end (start → callback → token → redirect → user zalogowany).
- Powiązanie konta zapisuje się w `oauth_links` i nie tworzy duplikatów userów.
- Security events są logowane dla success/failure.
- Frontend ma stabilny callback route dla OAuth.

**Acceptance / test plan:**
- Test: pierwsze logowanie nowym kontem Google → powstaje user + oauth_link.
- Test: logowanie istniejącym mailem (password user) → linkowanie konta (bez duplikatu).
- Test: zły `state` / timeout → odmowa + redirect z `auth_error`.

---

## T111 — 🩷 superadmin — LinkedIn Login Integration (OAuth login + email retrieval + future-proof for “connect LinkedIn”)
- Status spec: draft
- Link / ID (ClickUp): TBD
- Epic: IAM / trust / B2B credibility (LinkedIn identity)
- Priorytet / V2 scope: V2

**Business challenge (problem):**
LinkedIn login podnosi trust (B2B) i skraca wejście do aplikacji, ale jest trudniejszy technicznie (email scope / polityki). W V2 musimy go zrobić “bezpiecznie i prawdziwie”, bo T112 będzie opierać się o LinkedIn identity.

**Cel (outcome):**
Użytkownik może zalogować się przez LinkedIn, a system:
- ma jednoznaczny mapping do usera,
- zapisuje `oauth_links(provider='linkedin')`,
- jest gotowy na kolejny krok: “connect LinkedIn account” (T112) bez przebudowy fundamentów.

**Scope (V2)**
- IN (MUST):
  - **Backend endpoints:**
    - `GET /api/auth/linkedin` (start auth),
    - `GET /api/auth/linkedin/callback` (code → tokens → profile/email → user mapping → redirect).
  - **Email retrieval (MUST):**
    - LinkedIn flow musi dostarczyć email (jeśli provider nie daje email → fallback: poproś usera o email i wykonaj “link by verified email” w osobnym kroku; ale V2 preferuje pełny email z provider).
  - **User mapping / provisioning (MUST):**
    - identyczna polityka jak w Google:
      - match po `oauth_links` (provider_user_id),
      - albo link po email,
      - albo create user (jeśli dozwolone).
    - zapis do `oauth_links`:
      - `provider='linkedin'` (uwaga: tabela komentarzowo nie wspomina, ale pole jest TEXT — V2 dopuszcza nowy provider),
      - `provider_user_id`,
      - `provider_email`,
      - tokens (encrypted) — ważne dla T112 (min. refresh token jeśli dostępny).
  - **Security & anti-CSRF (MUST):**
    - state + TTL + jednorazowość,
    - rate limit,
    - logowanie success/failure do `security_events`.
  - **Frontend integration (MUST):**
    - przycisk jest w `AuthView.tsx` → `${API_URL}/auth/linkedin`,
    - callback jak w T110: redirect do `${FRONTEND_URL}/oauth/callback?...` obsługiwany przez `OAuthCallback`.
  - **Admin visibility (SHOULD):**
    - `/api/auth/oauth/status` pokazuje `linkedin.configured` na bazie env (`LINKEDIN_CLIENT_ID/SECRET/CALLBACK_URL`).
- OUT (post‑V2):
  - pełne scope’y LinkedIn do enrichment profilu (headline, company, network) — to jest T112/T113‑like,
  - “Sign in with LinkedIn” jako jedyny login per org (enforce) — to część większej polityki SSO.

**Implementation notes (grounded w repo):**
- Backend config:
  - `server/src/config/Config.ts` ma `LINKEDIN_CLIENT_ID/SECRET/CALLBACK_URL`.
- Status endpoint:
  - `server/src/routes/oauthRoutes.routes.ts` już zwraca `linkedin.configured` + loginUrl `/api/auth/linkedin`.
- Frontend:
  - `AuthView.tsx` ma `LinkedInIcon` i `handleLinkedInLogin()`.
  - `OAuthCallback.tsx` oczekuje `auth_error=linkedin_failed` w przypadku błędu.

**Analytics / metrics:**
- `oauth_login_started` (provider=linkedin)
- `oauth_login_succeeded` / `oauth_login_failed` (provider, reason)
- KPI: % B2B users choosing LinkedIn, completion rate, support tickets about login.

**Definition of Done (DoD):**
- LinkedIn login działa end‑to‑end i tworzy/linkuje usera bez duplikacji.
- `oauth_links` przechowuje mapping + last_login_at; security events są logowane.
- Flow jest kompatybilny z przyszłym “connect LinkedIn” (T112) — tzn. nie tworzy “shadow identities”.

**Acceptance / test plan:**
- Test: nowe konto LinkedIn → user created + oauth_link.
- Test: istniejący user email → konto linkowane, nie duplikowane.
- Test: provider nie zwraca email → flow wymusza bezpieczny fallback (bez tworzenia kont “unknown@”).

---

## T112 — 🩷 superadmin — LinkedIn Account Connection Encouragement System (connect flow + nudges + adoption tracking)
- Status spec: draft
- Link / ID (ClickUp): TBD
- Epic: IAM + onboarding conversion + B2B trust signals
- Priorytet / V2 scope: V2

**Business challenge (problem):**
Samo “Sign in with LinkedIn” (T111) nie wystarczy, bo:
- większość użytkowników wejdzie hasłem / Google i nie połączy LinkedIn,
- bez zachęty i jasnego benefitu adopcja będzie niska,
- brak spójnego “connect/disconnect/status” tworzy chaos UI (mamy już komponenty, ale placeholdery),
- a LinkedIn identity ma być fundamentem kolejnych funkcji (profil, credibility, rekomendacje, w przyszłości intelligence).

**Cel (outcome):**
W V2 użytkownik jest **inteligentnie i nienachalnie** prowadzony do połączenia LinkedIn:
- ma jasny CTA i wartość (“po co mi to?”),
- widzi status połączenia,
- może bezpiecznie rozłączyć konto,
- a org/admin może zobaczyć adopcję i ewentualnie włączyć/wyłączyć zachęty.

**Scope (V2)**
- IN (MUST) — “Connect LinkedIn” jako feature (dla już zalogowanego usera):
  - **Connect flow (MUST):**
    - osobny flow niż login:
      - `GET /api/auth/linkedin/connect` (start connect dla zalogowanego usera),
      - `GET /api/auth/linkedin/connect/callback` (zapis linka + redirect z powrotem do settings),
    - flow musi być **bezpieczny**:
      - wymaga aktywnej sesji usera (cookie auth preferowane; bez tokenów w URL),
      - state/nonce + TTL, jednorazowe użycie,
      - blokada podpięcia tej samej LinkedIn tożsamości do 2 userów (unikat w `oauth_links(provider, provider_user_id)`).
  - **Disconnect (MUST):**
    - endpoint `DELETE /api/settings/connected-accounts/linkedin` usuwa link (lub oznacza revoked) i loguje security event.
  - **Status API (MUST):**
    - `GET /api/settings/connected-accounts` zwraca listę podłączonych providerów (min. google/linkedin),
    - dane są mapowane z `oauth_links` (kanoniczne źródło) → frontend `LinkedAccounts`.
  - **UI: Settings → Connected Accounts (MUST):**
    - komponent już istnieje: `src/components/settings/ConnectedAccounts.tsx` (obecnie placeholder),
    - V2: przycisk “Connect LinkedIn” odpala realny connect flow,
    - status pokazuje: email/name, data podpięcia, opcja “Disconnect”.
  - **Profile Completeness (MUST):**
    - `ProfileCompleteness.tsx` już uwzględnia “Connected Account” jako item,
    - V2: endpoint “profile completeness” jest obecnie stub (503) — musi zwracać sensowne “suggestions”,
    - jeśli LinkedIn niepodłączony → sugestia HIGH: “Connect LinkedIn” z deep linkiem do zakładki “Connected Accounts”.
- IN (MUST) — “Encouragement” (nudges) bez spamu:
  - **Nudge entrypoints** (MUST):
    - onboarding / pierwsza sesja (1 raz): modal/callout “Connect LinkedIn (2 kliknięcia)”
    - Settings / Profile Completeness card: persistent suggestion
    - (opcjonalnie) SuperAdmin/Org admin: banner “X% zespołu ma podłączony LinkedIn”
  - **Nudge governance** (MUST):
    - user może “Dismiss” (zapis w `user_preferences`, TTL/expiry np. 30 dni),
    - rate limit: nie pokazujemy częściej niż 1x/7 dni jeśli odrzucone,
    - nie pokazujemy w DEMO (albo pokazujemy jako disabled “not in demo”) — spójnie z polityką produktu.
  - **Value proposition (MUST):**
    - komunikaty muszą być konkretne:
      - “Szybsze logowanie”
      - “Uzupełnienie profilu zawodowego”
      - “Wiarygodność B2B / lepsze dopasowanie rekomendacji”
    - bez obiecywania funkcji, których nie ma w V2 (np. “import całej kariery” jeśli nie wdrożone).
- OUT (post‑V2):
  - automatyczny import work history / edukacji (to osobny task),
  - “verification badge” public profile,
  - org-level enforcement “must connect LinkedIn” (może być enterprise policy później).

**Implementation notes (grounded w repo):**
- UI:
  - `ConnectedAccounts.tsx` ma już karty Google/LinkedIn, ale `handleConnect` i `handleDisconnect` są symulowane.
  - `AdvancedSettings.tsx` już woła:
    - `GET /settings/connected-accounts`
    - `DELETE /settings/connected-accounts/:provider`
    - backend obecnie tego nie ma → V2 musi dodać realne endpointy.
  - `ProfileCompleteness.tsx` liczy “connectedAccounts” i woła `/api/user/profile-completeness`, ale backend to stub (503).
- Backend/DB:
  - `oauth_links` (migration `055_security_module.sql.sql`) jest kanoniczną tabelą na “connected accounts”.
  - `security_events` istnieje — nadaje się na audyt connect/disconnect.
  - OAuth status endpoint istnieje: `GET /api/auth/oauth/status`.

**API contract (V2, minimal):**
- `GET /api/settings/connected-accounts` → `{ accounts: Array<{provider,email,connectedAt,status}> }`
- `DELETE /api/settings/connected-accounts/:provider` (min. linkedin) → `{ success: true }`
- `GET /api/auth/linkedin/connect` → 302 do LinkedIn authorize (mode=connect)
- `GET /api/auth/linkedin/connect/callback` → 302 do `${FRONTEND_URL}/settings/security?connected=linkedin`
- `GET /api/user/profile-completeness` → `{ success:true, data:{ percentage, items, suggestions } }`

**Data model:**
- `oauth_links`:
  - `provider='linkedin'`, `provider_user_id`, `provider_email`, `linked_at`, `last_login_at`
- `user_preferences` (już istnieje w `settings.routes.ts`):
  - `nudge:connect_linkedin:dismissed_until` (ISO timestamp)
  - `nudge:connect_linkedin:last_shown_at`
- `security_events`:
  - `event_type`: `oauth_linked`, `oauth_unlinked` (lub spójne nazwy w ramach security events)

**Analytics / metrics:**
- `linkedin_connect_cta_shown` (surface=onboarding|settings|profile_completeness)
- `linkedin_connect_started` / `linkedin_connect_completed` / `linkedin_connect_failed` (reason)
- `linkedin_disconnect_clicked` / `linkedin_disconnect_completed`
- KPI: % users with linkedin connected, connect conversion by surface, drop-off reasons.

**Definition of Done (DoD):**
- User widzi prawdziwy status LinkedIn connection w Settings.
- “Connect LinkedIn” działa (dla zalogowanego usera), zapisuje `oauth_links`, i wraca do aplikacji.
- “Disconnect” działa, loguje security event i aktualizuje UI.
- Nudge system jest kontrolowany (dismiss + rate limit) i ma tracking.
- `profile-completeness` endpoint przestaje być stubem i potrafi sugerować “connect LinkedIn”.

**Acceptance / test plan:**
- Test: user (password login) → Settings → Connect LinkedIn → po callbacku linkedAccounts pokazuje LinkedIn.
- Test: disconnect → wpis znika i nie da się “ghost login” (brak oauth link).
- Test: dismissal: po “Dismiss” nie pokazujemy nudga przez ustalony TTL.
- Test: conflict: próba podpięcia tej samej LinkedIn tożsamości do 2 userów → blok + czytelny błąd.

---

## T113 — 🩷 superadmin — User Behavioral Intelligence Tracking System (event stream + activation/adoption + churn signals)
- Status spec: draft
- Link / ID (ClickUp): TBD
- Epic: Growth & Retention Intelligence (trial → paid, churn prevention, product learning)
- Priorytet / V2 scope: V2

**Business challenge (problem):**
Bez systemowego “behavior intelligence” działamy na opinii, nie na danych:
- nie wiemy gdzie ludzie odpadają (onboarding, trial, billing, tool adoption),
- nie umiemy mierzyć TTV (time‑to‑value) i activation,
- nie umiemy wcześnie wykryć churn risk (spadek usage, brak loginów, porzucone flow),
- a SuperAdmin nie ma “prawdy” o aktywności i jakości doświadczenia.

**Cel (outcome):**
W V2 mamy spójny, prywatnościowo bezpieczny system:
- zbieramy zdarzenia (journey/events) i logi (API/AI) do DB,
- przeliczamy metryki (activation/adoption/retention) per user i per org,
- generujemy wczesne sygnały (churn warnings),
- udostępniamy to w SuperAdmin (dashboards + user/org timelines),
- i używamy danych do zwiększania konwersji trial→paid.

**Scope (V2)**
- IN (MUST) — Event collection (kanoniczne):
  - **Journey events (MUST):**
    - endpoint ingest:
      - `POST /api/analytics/journey/track` (single event),
      - (SHOULD) `POST /api/analytics/journey/track/batch` (array) dla wydajności.
    - event schema zgodna z DB (`journey_events`):
      - `event_type`: `phase_entry` | `milestone` | `feature_use` | `tour_event`,
      - `event_name`: string (np. `auth_login_success`, `trial_org_setup_completed`, `tour_completed`),
      - `phase` (opcjonalnie),
      - `metadata` (JSON, bez PII).
    - server uzupełnia: `user_id`, `organization_id`, `created_at`.
  - **Conversion funnel events (MUST):**
    - zapis do `conversion_events` (VISIT/LEAD/DEMO/TRIAL_START/PAID/CHURN),
    - źródła + UTM + referrer + partner_id (jeśli istnieje),
    - wymagamy “source of truth”: który event jest generowany gdzie (landing vs app vs webhook Stripe).
  - **API & performance logs (MUST):**
    - request logging middleware zapisuje do `api_logs`:
      - endpoint/method/status_code/response_time_ms,
      - user_id/organization_id (jeśli dostępne),
      - correlation id,
      - error_message (sanitized).
  - **AI usage logs (MUST):**
    - spójne metryki AI z `ai_usage_logs`/`ai_request_logs` (w zależności od tabel w środowisku),
    - kluczowe pola: provider/model/action/tokens/cost/latency/status.

- IN (MUST) — Behavioral intelligence (processing):
  - **Activation & TTV (MUST):**
    - utrzymujemy `user_activation_status`:
      - `current_phase`, per‑phase flags, `first_event_at`, `last_event_at`, `total_ttv_ms`,
    - reguły activation (V2 minimal):
      - A: konto + pierwszy login,
      - B: ukończony onboarding / “first project” / “first tool started”,
      - C: pierwsza wartość (np. report generated / initiative created / assessment completed) — definicje do doprecyzowania w metrykach.
  - **Adoption metrics (MUST):**
    - per user:
      - WAU/DAU proxy, sessions (z login_history), liczba kluczowych feature_use,
      - usage AI (calls/tokens), engagement score,
    - per organization:
      - aktywni użytkownicy, aktywne moduły, trendy (7/30 dni).
  - **Churn warning signals (MUST):**
    - generujemy `churn_warnings` na podstawie heurystyk:
      - `NO_LOGIN` (np. brak logowania X dni),
      - `USAGE_DROP` (spadek aktywności 7d vs 30d),
      - `PAYMENT_RISK` (past_due/dunning z T109),
      - `FEATURE_ABANDON` (rozpoczęty flow bez domknięcia).
    - status lifecycle: ACTIVE → ACKNOWLEDGED → RESOLVED/DISMISSED.

- IN (MUST) — SuperAdmin visibility:
  - **User timeline**:
    - endpointy pokazujące oś czasu:
      - loginy (login_history),
      - journey_events,
      - AI usage (agregacje),
      - churn warnings.
  - **Org insights**:
    - dashboard: activation funnel, retention snapshot, top adopted features, risk list,
    - integracja z istniejącymi endpointami:
      - `GET /api/superadmin/users/:id/adoption-metrics` (już jest route — V2 musi być realny, nie placeholder),
      - `GET /api/superadmin/organizations/:id/churn-prediction` (V2 minimal: heurystyka + explainability).

- Privacy & compliance (MUST):
  - **No PII in metadata**: email, full names, treści inputów użytkownika nie trafiają do metadata eventów.
  - **Opt-out**:
    - user/org ustawienie: “behavior analytics enabled” (default ON dla V2, ale z wyłączeniem jeśli wymagane),
    - opt-out respektowany w ingest.
  - **Retention**:
    - polityki retencji dla eventów i logów (np. 90 dni raw, 12 miesięcy agregaty),
    - zgodność z istniejącym SuperAdmin “retention policies”.

- OUT (post‑V2):
  - pełny produktowy CDP / segmentacja marketingowa,
  - zaawansowane ML churn (to wchodzi w T114/T115).

**Implementation notes (grounded w repo):**
- Frontend już wysyła journey track:
  - `src/hooks/useJourneyTracking.ts` robi `Api.post('/analytics/journey/track', ...)` i ma batching/queue,
  - obecnie backend **nie ma** `/api/analytics/journey/track` → V2 musi dodać.
- Tabele już istnieją:
  - `journey_events`, `user_activation_status` (`server/migrations/029_journey_analytics.sql.sql`)
  - `conversion_events`, `churn_warnings`, `api_logs`, `login_history`, `ai_usage_logs` (`server/migrations/230_superadmin_overview_production.sql`)
- SuperAdmin ma już punkty integracji:
  - `SuperAdminSignalCenter` pobiera `/api/superadmin/signals`,
  - w `server/src/routes/superadmin.routes.ts` istnieje `GET /users/:id/adoption-metrics`.
- `trackFunnelEvent` istnieje w `src/services/funnelAnalytics.ts` (gtag + journeyAnalytics global).

**API contract (V2, minimal):**
- `POST /api/analytics/journey/track`
- (SHOULD) `POST /api/analytics/journey/track/batch`
- `GET /api/superadmin/users/:id/adoption-metrics`
- `GET /api/superadmin/organizations/:id/churn-prediction`
- (SHOULD) `GET /api/superadmin/organizations/:id/behavior-summary` (funnel + adoption + warnings)

**Analytics / metrics:**
- `journey_event_tracked` (event_type, event_name, module, orgId)
- `activation_phase_changed` (from,to)
- `churn_warning_created` (type,severity)
- KPI: activation rate, TTV median, retention D7/D30 proxy, trial→paid conversion lift.

**Definition of Done (DoD):**
- `POST /api/analytics/journey/track` działa i zapisuje `journey_events`.
- `user_activation_status` aktualizuje się na podstawie eventów.
- Request logging zapisuje `api_logs` (bez PII).
- SuperAdmin widzi realne adoption metrics i churn signals (nie placeholder).
- Jest opt‑out + retention rules.

**Acceptance / test plan:**
- Test: frontend `useJourneyTracking.trackMilestone('auth_login_success')` → w DB powstaje `journey_events` z user_id i org_id.
- Test: batch flush (20 eventów) → endpoint przyjmuje bez timeoutów; brak duplikacji.
- Test: api_logs zapisuje status_code i latency dla wybranych endpointów.
- Test: churn warning “NO_LOGIN” tworzy się po przekroczeniu progu (symulacja dat).

---

## T114 — 🩷 superadmin — Transaction Readiness Scoring Algorithm (explainable score 0–100 + factor breakdown)
- Status spec: draft
- Link / ID (ClickUp): TBD
- Epic: Monetization & Sales Intelligence (qualification, upgrade timing, risk reduction)
- Priorytet / V2 scope: V2

**Business challenge (problem):**
W V2 chcemy maksymalizować konwersję (trial→paid) i minimalizować churn, ale bez “przepychania” userów w ciemno:
- potrzebujemy obiektywnego sygnału: *czy ta organizacja jest gotowa na transakcję / upgrade?*
- SuperAdmin/Sales/CS musi widzieć *dlaczego* (explainability), a nie tylko numer,
- scoring musi być audytowalny, stabilny i odporny na “noise”.

**Cel (outcome):**
W V2 istnieje kanoniczny algorytm **Transaction Readiness Score**:
- wynik \(0–100\) + **tier** (np. LOW/MEDIUM/HIGH/READY),
- breakdown na czynniki + evidence (z jakich danych),
- aktualizowany automatycznie (cron + trigger na kluczowe eventy),
- wykorzystywany w:
  - SuperAdmin (qualification + priorytety),
  - in‑app nudge/upgrade UX (tylko gdy READY),
  - integracji T115 (Sellix) jako input do automatyzacji transakcji.

**Scope (V2)**
- IN (MUST):
  - **Score model (MUST):** wynik per organization (+ opcjonalnie per user jako “primary buyer”).
  - **Explainability (MUST):**
    - breakdown: lista faktorów z wagą, wartością, statusem (met/missing), i evidence,
    - decyzja końcowa: tier + “top 3 blockers” + rekomendowane next steps.
  - **Stability (MUST):**
    - smoothing/anti-spike: score nie skacze o > X pkt/dzień bez “major event”,
    - idempotent computation, zapisy snapshotów.
  - **Audit & compliance (MUST):**
    - brak PII w breakdown metadata,
    - retencja: raw evidence max 90 dni (agregaty dłużej),
    - możliwość wyłączenia score per org (compliance).
  - **SuperAdmin view (MUST):**
    - ranking orgów po readiness (top READY + top AT_RISK),
    - drill‑down: org → readiness timeline (snapshots) + breakdown + blockers.
- OUT (post‑V2):
  - pełny ML model (to będzie “predictive readiness” w osobnym story),
  - indywidualny scoring per persona/role (buyer vs champion) jeśli nie potrzebne na V2.

**Algorithm (V2, canonical v1)**
Wynik = suma wag “dimension scores” minus penalties.

- **D1: Identity & Security readiness (max 20)**
  - email verified / verified login (jeśli istnieje),
  - MFA enabled (z `users.mfaEnabled` / security tables),
  - connected account exists (Google/LinkedIn; `oauth_links` + UI `linkedAccounts`),
  - brak wysokich security red flags (np. wiele failed logins z `login_history`).

- **D2: Product activation & adoption (max 25)**
  - `journey_events` milestones (A/B/C z T113),
  - `user_adoption_metrics.engagement_score` (rolling 7d/30d),
  - real “value events”: np. report generated / initiative created / assessment completed (event_name canonical).

- **D3: Governance & execution readiness (max 20)**
  - inicjatywy mają “gate readiness” (backend contract):
    - `GET /api/initiatives/:id/gate-readiness-check` ma blocking checks,
  - decyzje mają readiness (wzorzec scoringu już jest w `DecisionReadinessBar`),
  - obecność owner/sponsor/target date w inicjatywach (z readiness check).

- **D4: Billing readiness (max 20)**
  - payment method added (`billing/setup-intent` + `payment_methods`),
  - brak overdue invoices / brak dunning (T109),
  - org ma sensowny “plan intent” (wybrany plan lub checkout started).

- **D5: Compliance readiness (max 15)**
  - legal acceptance current (T093 system),
  - org security settings sensowne (np. session policy) jeśli wymagane.

- **Penalties (max -20)**
  - aktywne `churn_warnings` HIGH/CRITICAL,
  - “NO_LOGIN” > X dni,
  - payment_failed/past_due (z billing/dunning) dopóki nie recovered.

**Tiers (V2):**
- 0–39: `LOW`
- 40–59: `MEDIUM`
- 60–79: `HIGH`
- 80–100: `READY`
oraz flagi:
- `BLOCKED_BY_BILLING` (past_due/dunning)
- `BLOCKED_BY_COMPLIANCE` (missing legal acceptance)

**Data model (V2):**
- `transaction_readiness_scores` (snapshots)
  - `id`, `organization_id`, `score` (0–100), `tier`,
  - `dimensions_json` (breakdown per D1–D5),
  - `penalties_json`,
  - `blockers_json` (top blockers),
  - `computed_at`, `computed_by` (`system`/`superadmin`), `algorithm_version` (v1),
  - `source_evidence_hash` (hash do dedupe).
- (SHOULD) `transaction_readiness_events` (optional lightweight event log)
  - “score changed”, “blocker resolved”, “tier changed”.

**API contract (V2, minimal):**
- `GET /api/superadmin/organizations/:id/transaction-readiness` → `{ score, tier, breakdown, blockers, updatedAt }`
- `GET /api/superadmin/transaction-readiness/ranking?days=30` → list orgs sorted
- `POST /api/superadmin/organizations/:id/transaction-readiness/recompute` (guardrails + reason) → forces recompute

**Computation strategy (V2):**
- Cron job (daily + optional hourly for paid/trial orgs):
  - recompute dla orgów aktywnych + trial,
  - recompute natychmiast po eventach:
    - `billing_payment_method_added`,
    - `trial_org_setup_completed`,
    - `oauth_linked` (LinkedIn connect),
    - `invoice.paid` / `invoice.payment_failed`,
    - “value event” (first report/initiative).

**Implementation notes (grounded w repo):**
- Dane wejściowe są już w DB/migracjach:
  - `conversion_events` (`server/migrations/230_superadmin_overview_production.sql`)
  - `churn_warnings`, `login_history`, `api_logs`, `ai_usage_logs` (tamże)
  - `journey_events` + `user_activation_status` (`server/migrations/029_journey_analytics.sql.sql`)
  - `user_adoption_metrics` (`server/migrations/015_enterprise_customers_module.sql`) + `server/src/services/userAdoptionService.ts`
- Readiness check inicjatyw już istnieje w backend:
  - `GET /api/initiatives/:id/gate-readiness-check` (`InitiativeController.getGateReadinessCheck`)
- Wzorzec scoring UI istnieje (do explainability):
  - `src/components/MyWork/shared/DecisionReadinessBar.tsx`.

**Analytics / metrics:**
- `transaction_readiness_computed` (orgId, score, tier, version)
- `transaction_readiness_tier_changed` (from,to, blockersResolvedCount)
- KPI: trial→paid conversion lift, % upgrades at READY, reduction w refunds/churn po upgrade.

**Definition of Done (DoD):**
- System liczy score dla orgów i zapisuje snapshoty z breakdown i blockers.
- SuperAdmin ma ranking + drill‑down.
- Algorytm jest explainable i stabilny (bez losowych skoków).
- Jest gotowy jako input do T115 (Sellix) — czyli ma API i eventy.

**Acceptance / test plan:**
- Test: org z payment method + ukończone milestone + brak warnings → tier `READY`.
- Test: org z `invoice.payment_failed` / dunning → penalty i flag `BLOCKED_BY_BILLING`.
- Test: brak legal acceptance (T093) → `BLOCKED_BY_COMPLIANCE`.
- Test: recompute endpoint zmienia score deterministycznie (idempotent) i zapisuje snapshot.

---

## T115 — 🩷 superadmin — Transaction Readiness Integration with Sellix (automated conversion activation)
- Status spec: draft
- Link / ID (ClickUp): TBD
- Epic: Monetization automation (trial→paid conversion) + Sales/CS control plane
- Priorytet / V2 scope: V2

**Business challenge (problem):**
Nawet idealny readiness score (T114) nie zwiększy konwersji, jeśli nie zamienimy sygnału na działanie:
- brak automatycznej aktywacji ścieżek upgrade (CTA/komunikacja/offering),
- brak spójnego “handoff” do systemu sprzedaży (Sellix) → chaos i ręczne działania,
- brak pętli zwrotnej (czy komunikacja zadziałała?) → nie uczymy się konwersji.

**Cel (outcome):**
W V2 system po osiągnięciu progu readiness **automatycznie** uruchamia działania sprzedażowe w Sellix (nasz system sprzedaży automatycznej), a następnie zbiera feedback:
- outbound: “org is READY → start conversion pathway”,
- inbound: “pathway started / CTA clicked / checkout started / paid” → zapis w analytics (T113) i billing funnel.

**Zakres (V2)**
- IN (MUST):
  - **Outbound readiness signals → Sellix (MUST):**
    - kiedy org przekracza próg (np. tier `READY` lub score ≥ threshold) i nie ma flag BLOCKED:
      - emitujemy event do Sellix,
      - dokładnie raz per crossing (idempotency + cooldown).
    - payload musi zawierać:
      - `organizationId`,
      - `readinessScore`, `readinessTier`, `algorithmVersion`,
      - `topBlockers` (jeśli nie READY),
      - `recommendedNextSteps` (krótkie, bez PII),
      - kontekst billing: `organizationType` (TRIAL/PAID), `billingStatus` (ok/past_due) — bez sekretów.
  - **Inbound events z Sellix (MUST):**
    - Sellix odsyła eventy konwersji, które zapisujemy do:
      - `conversion_events` (VISIT/LEAD/TRIAL_START/PAID/CHURN) tam gdzie ma sens,
      - `journey_events` (np. `upgrade_cta_clicked`, `sellix_pathway_started`),
      - (opcjonalnie) `transaction_readiness_events` jako audit pętli.
  - **Config & governance (MUST):**
    - SuperAdmin może:
      - włączyć/wyłączyć Sellix integration,
      - ustawić threshold + cooldown,
      - wybrać “pathway” (np. `TRIAL_UPGRADE_EMAIL_1`, `IN_APP_UPGRADE_PROMPT`, `SCHEDULE_CALL`),
      - uruchomić test event “dry-run”.
    - DEMO org: brak realnych outbound actions (albo “disabled with reason”).
  - **Security (MUST):**
    - outbound podpisany HMAC (shared secret) + timestamp + replay protection,
    - inbound webhook weryfikuje podpis i jest idempotentny (dedupe po `eventId`),
    - rate limiting + audit (SuperAdmin).
  - **Reliability (MUST):**
    - delivery log + retry policy (max attempts + backoff),
    - obserwowalność: success/fail counters, last_error.

- OUT (post‑V2):
  - pełna orkiestracja kampanii w aplikacji (visual builder),
  - personalizacja per persona (buyer/champion) jeśli okaże się potrzebne.

**Canonical event taxonomy (V2):**
- Outbound (Consultify → Sellix):
  - `transaction_readiness.ready` (tier becomes READY)
  - `transaction_readiness.tier_changed` (HIGH→READY etc.)
  - `transaction_readiness.blocked` (np. BLOCKED_BY_BILLING / COMPLIANCE)
- Inbound (Sellix → Consultify):
  - `sellix.pathway_started`
  - `sellix.cta_clicked`
  - `sellix.checkout_started`
  - `sellix.purchase_completed` (jeśli Sellix jest po stronie checkout)
  - `sellix.pathway_failed`

**Data model (V2, minimal):**
- (MUST) idempotency registry:
  - `transaction_readiness_events` (jeśli z T114) albo dedupe w `webhook_deliveries`:
    - `event_type`, `organization_id`, `dedupe_key`, `created_at`
- (SHOULD) `sellix_events`:
  - przechowuje surowe inbound eventy (bez PII payloadów poza tym co konieczne) + processing_status.

**API contract (V2):**
- `POST /api/webhooks/sellix` (inbound)
  - wymagane: `X-Sellix-Signature`, `X-Sellix-Event`, `X-Sellix-Timestamp`, `eventId`
  - odpowiedź: 200 na sukces; 400/401 na invalid signature; idempotent 200 na duplikat.
- `POST /api/superadmin/sellix/test-event` (guardrails + reason) → wymusza outbound test
- (opcjonalnie) `GET /api/superadmin/sellix/status` → last deliveries/health

**Integration strategy (grounded w repo):**
- W repo istnieje “system webhook” infrastruktura:
  - tabela `webhooks` + `webhook_deliveries` (`server/migrations/000_initdb_core_tables.sql`, `160_configuration_enhancements.sql` / legacy),
  - `server/src/services/WebhookService.ts`:
    - HMAC signature (`X-Consultinity-Signature`) + `X-Consultinity-Event`,
    - delivery listing (`getDeliveries`) i retry (`retryDelivery`) — V2 domyka użycie delivery log przy trigger.
  - SuperAdmin ma endpoints do webhooks/integrations:
    - `server/src/routes/superadmin.routes.ts` → `/integrations` + `/webhooks`.
- W repo istnieje też nowy integrations system (FLOW-INTEGRATION-001):
  - `server/migrations/256_integrations_system.sql` (`integration_providers`, `integrations`, `integration_webhooks`…)
  - `server/src/routes/integrations/integrations.routes.ts` automatycznie dopasowuje się do schematu tabel.
- V2 wybiera **jedno kanoniczne źródło konfiguracji** dla Sellix:
  - preferowane: `integration_providers + integration_webhooks` (outbound),
  - fallback: legacy `webhooks` (system orgId=`system`) jeśli środowisko nie ma 256.

**How it works (V2, end-to-end):**
1. T114 wylicza snapshot readiness (cron/trigger).
2. Jeśli tier crossing spełnia warunki (READY, not blocked, cooldown ok) → emit outbound event.
3. Outbound delivery zapisuje się do `webhook_deliveries` i jest wysyłana do Sellix.
4. Sellix startuje pathway (email/CTA/offer) i odsyła eventy do `/api/webhooks/sellix`.
5. Inbound eventy aktualizują `conversion_events` / `journey_events` (T113) i umożliwiają optymalizację progów.

**Anti-spam / governance (MUST):**
- cooldown per org: minimum 7 dni między “READY activation” jeśli brak success,
- idempotency:
  - klucz: `orgId:tier:YYYY-MM-DD` lub `orgId:tierChange:from-to`,
  - duplikaty → no-op.
- “Stop rules”:
  - jeśli org jest `PAID` lub ma aktywne dunning/past_due → nie uruchamiamy upgrade pathway, tylko `blocked`.

**Analytics / metrics:**
- `sellix_signal_sent` / `sellix_signal_failed` (eventType, orgId, statusCode)
- `sellix_pathway_started` / `sellix_cta_clicked` / `sellix_checkout_started`
- KPI: conversion lift READY→PAID, time-to-upgrade po READY, false positives rate (READY bez konwersji).

**Definition of Done (DoD):**
- Po przekroczeniu progu READY system wysyła event do Sellix dokładnie raz (idempotent + cooldown).
- Inbound webhook odbiera eventy z Sellix bezpiecznie (signature + dedupe) i zapisuje je do analytics.
- SuperAdmin ma konfigurację + test event + podgląd delivery success/fail.
- Integracja nie działa “na niby” w prod (brak placeholderów), a w DEMO jest jawnie wyłączona.

**Acceptance / test plan:**
- Test: org zmienia tier HIGH→READY → outbound `transaction_readiness.ready` wysłany, delivery logged.
- Test: ponowny recompute tego samego dnia → brak duplikatu (idempotency).
- Test: Sellix inbound `sellix.cta_clicked` → powstaje `journey_event` + (opcjonalnie) `conversion_event`.
- Test: zły podpis inbound → 401; duplikat `eventId` → 200 no-op.

---

## T116 — 🟣 ai — Centralized AI Prompt Management & Learning System (SSOT prompts + versioning + A/B + learning loop)
- Status spec: draft
- Link / ID (ClickUp): TBD
- Epic: AI Platform (quality, governance, maintainability, enterprise control)
- Priorytet / V2 scope: V2 (launch‑critical dla “AI quality + trust”)

**Business challenge (problem):**
Obecnie “prompty” i nauka AI są rozproszone i częściowo niespójne:
- istnieje kilka równoległych systemów promptów/versioning/AB (różne tabele i endpointy),
- runtime prompt composition ma luki (np. `promptAssembler` jest jawnie “unavailable”),
- learning loop istnieje (feedback → patterns → instruction suggestions), ale jest zdublowany (min. 2 implementacje) i nie jest kanonicznie spięty z promptami,
- bez SSOT promptów i kontroli wersji nie da się bezpiecznie podnosić jakości w V2 (“ready to show the world”).

**Cel (outcome):**
W V2 mamy **jeden kanoniczny system**:
- **SSOT promptów** (klucze, kategorie, i18n policy, variables),
- **versioning + rollback + publish/activate** (auditowalne),
- **A/B testing** (kontrolowany i mierzalny),
- **learning loop** (feedback → wzorce → sugestie instrukcji → zatwierdzenie → stosowanie w runtime),
- i **prompt compilation pipeline** (assembler), który faktycznie jest używany przez AI endpoints.

**Scope (V2)**
- IN (MUST) — Prompt SSOT:
  - kanoniczna tabela + kontrakt:
    - `ai_system_prompts` jako SSOT (SQLite-first; istnieje w `server/migrations/210_ai_system_prompts.sql`)
    - klucz (`key`) jest *jedynym* stabilnym identyfikatorem w kodzie (np. `chat.default`, `initiative.raid`, `report.exec_summary`).
  - kanoniczne API (SuperAdmin/Admin):
    - list/filter/search/categories,
    - create/update/deactivate,
    - version history + rollback.
  - kanoniczne UI:
    - SuperAdmin “AI Intelligence” (`src/views/superadmin/AIIntelligenceView.tsx`) używa jednego zestawu endpointów (koniec duplikatów).

- IN (MUST) — Versioning & audit:
  - każda zmiana promptu tworzy rekord w historii (`ai_prompt_versions`),
  - statusy: `draft` → `active` / `inactive` + rollback,
  - audit: kto/kiedy/why (`change_reason`) + powiązanie z ticketem (opcjonalne pole).

- IN (MUST) — Prompt blocks & assembly:
  - utrzymujemy `ai_prompt_blocks` jako bibliotekę “klocków” (persona, behavior, output constraints, context injection).
  - Implementujemy **Prompt Assembler** jako realny komponent runtime:
    - kompiluje `ai_system_prompts` + opcjonalne blocks + org learning instructions,
    - wykonuje variable interpolation (bez eval; bezpiecznie),
    - respektuje language policy (6 języków) i output constraints (JSON-only gdy wymagane).
  - “Block Builder” i “Preview” w `prompt-assistant.routes.ts` są spójne z assemblerem (ten sam wynik).

- IN (MUST) — Learning system (closed loop):
  - zbieramy feedback do `ai_feedback` (już istnieje, m.in. `server/migrations/052_ab_testing.sql`),
  - generujemy wzorce:
    - `ai_learning_patterns` (używane przez `server/src/services/ai/learningSystem.ts` i `aiLearningService.ts`),
  - generujemy sugestie instrukcji:
    - `ai_instruction_suggestions` (schema istnieje w `server/migrations/520_ai_enterprise_tables.sql`),
  - workflow zarządczy:
    - `pending` → `approved` → `applied` / `rejected`,
    - stosowanie w runtime: assembler dopina “Learned Instructions” dla organizationId (bez PII).
  - usuwamy duplikację implementacji:
    - jedna kanoniczna implementacja jobów (scheduler) i jedna kanoniczna implementacja usług (API).

- IN (MUST) — A/B testing:
  - A/B testy działają na wersjach promptów:
    - `ai_ab_experiments`, `ai_ab_assignments`, `ai_ab_outcomes` (istnieją w `server/migrations/052_ab_testing.sql`)
  - AB jest w pełni kontrolowane przez SuperAdmin i ma guardrails:
    - min sample size, czas trwania, auto-stop, “winner promote”.

- IN (MUST) — Metrics (quality + cost + regression):
  - dla każdego requestu AI logujemy:
    - prompt key + version (który wygenerował odpowiedź),
    - podstawowe metryki jakości i kosztu (wykorzystując istniejące tabele `ai_quality_metrics`, `ai_cost_usage` / `ai_cost_log` zależnie od środowiska),
    - korelacja po request_id / conversation_id.
  - “prompt regression guard”:
    - jeśli nowa wersja powoduje spadek quality score / wzrost hallucination flags → alert + możliwość rollback.

- OUT (post‑V2):
  - pełny, Postgres-native “semantic template system” (`ai_prompt_templates` / `ai_prompt_blocks` JSONB z `080_prompt_templates.sql.sql`) jako nowa generacja,
  - pełny “prompt linting” i automatyczne eval sety per feature w CI.

**Canonical model (V2)**
- **Prompt key naming (MUST):**
  - `domain.capability.intent[.variant]` (np. `initiative.section.raid.v1`, `chat.cothinker.default`)
  - zakaz “magic strings” w kodzie bez `key` (wszystko odnosi się do promptów po key).

- **Prompt payload (MUST):**
  - `content` (główna instrukcja),
  - opcjonalnie: `system_prompt` + `user_prompt_template`,
  - `variables[]` (schema) + `context_config` (jakie konteksty wolno wstrzyknąć).

**Repo grounding (obecny stan / długi ogon)**
- Istnieje realne UI i API dla promptów, ale są zduplikowane:
  - `/api/prompt-assistant/*` (`server/src/routes/prompt-assistant.routes.ts`) obsługuje Templates/Blocks/Test bench.
  - `/api/ai-prompts/*` (`server/src/routes/ai-prompts.routes.ts`) robi CRUD na `ai_system_prompts`.
  - `/api/ai/ai-prompts/*` (`server/src/routes/ai/ai-prompts.routes.ts`) używa legacy `AIPromptsController`.
  - `/api/ai-development/prompts/*` (`server/src/routes/ai-development.routes.ts`) ma kolejne CRUD.
  - V2 wymaga **jednego kanonicznego API** + deprecacji reszty (bez breaking changes — aliasy i redirects w warstwie routing).
- Prompt assembler jest brakujący:
  - `server/src/services/ai/promptAssembler.ts` oznaczony jako `__unavailable__`.
- Learning loop istnieje w dwóch implementacjach:
  - `server/src/services/ai/learningSystem.ts` (jobs w `server/src/cron/Scheduler.ts`)
  - `server/src/services/ai/aiLearningService.ts` + `server/src/jobs/aiLearningJob.ts`
  - V2 musi to skonsolidować.
- Inicjatywy mają własne prompt templates w DB:
  - `initiative_section_types.ai_prompt_template` wypełniane przez `server/migrations/530_initiative_section_ai_prompts.sql` — V2 mapuje to do centralnego registry (przez key/ref) albo utrzymuje jako “legacy source”, ale w jednym UI i z versioning.

**Deliverables (V2):**
- Kanoniczny “Prompt Registry”:
  - stable key space + schema + admin UI.
- Prompt Assembler (runtime) + wspólny engine do:
  - prompt-assistant preview,
  - test bench,
  - produkcyjne generowanie odpowiedzi.
- Learning loop:
  - feedback capture + patterns + instruction suggestions + approval + apply.
- AB testing:
  - eksperymenty na prompt versions + metryki i winner promotion.
- Observability:
  - metryki per prompt key/version (quality/cost/latency) + alerting regresji.

**API contract (V2, minimal):**
- `GET /api/ai-prompts` + filters (canonical)
- `GET /api/ai-prompts/categories`
- `GET /api/ai-prompts/:id` (incl. versions)
- `POST /api/ai-prompts` (superadmin)
- `PUT /api/ai-prompts/:id` (superadmin; creates version)
- `POST /api/ai-prompts/:id/rollback` (superadmin; explicit reason)
- `POST /api/prompt-assistant/blocks/preview` (uses assembler)
- `POST /api/prompt-assistant/test` (uses assembler + records metrics)
- `POST /api/ai-feedback` (feedback capture; already exists, V2 aligns schema)
- `GET /api/superadmin/ai-learning/report` + `POST /api/superadmin/ai-learning/suggestions/:id/(approve|reject|apply)`

**Analytics / metrics:**
- `prompt_version_published` / `prompt_version_rolled_back`
- `prompt_ab_experiment_started` / `prompt_ab_experiment_winner_promoted`
- `ai_feedback_submitted` (type, category, promptKey)
- `ai_learning_instruction_applied` (orgId, suggestionId)
- KPI: quality score trend per key, % regressions caught, time-to-rollback, reduction w negative feedback.

**Risks (V2):**
- Schema drift (`ai_system_prompts` ma różne kolumny w różnych migracjach/endpointach) → V2 musi ujednolicić i dodać “compat layer” (np. `getTableColumns`) zanim zrobimy twarde migracje.
- Nadmierna automatyzacja learningu → V2 wymaga approval workflow (SuperAdmin), a auto-apply tylko dla wysokiego confidence i bezpiecznych kategorii.

**Definition of Done (DoD):**
- Jest **jeden kanoniczny** registry promptów (key/version/history) i jest używany przez UI + produkcyjne endpointy AI.
- Prompt assembler działa (nie `__unavailable__`) i jest używany w test bench + runtime.
- Learning loop działa end-to-end (feedback → pattern → suggestion → approval → applied in runtime).
- A/B testing działa i ma metryki/winner promotion.
- Mamy metryki jakości/kosztu per prompt version oraz szybki rollback.

**Acceptance / test plan:**
- Test: edycja promptu w SuperAdmin → powstaje nowy version + można rollback.
- Test: prompt-assistant preview i produkcyjny endpoint używają tego samego assemblera (ten sam compiled prompt).
- Test: feedback “correction” tworzy pattern → suggestion → po apply assembler dopina instrukcję tylko dla tej organizacji.
- Test: AB experiment rozdziela ruch i zapisuje outcomes; można wybrać winner.

---

## T117 — 🟣 ai — System-Level AI Context Governance (Core Documentation Layer) (canonical “system brain” + citations + drift control)
- Status spec: draft
- Link / ID (ClickUp): TBD
- Epic: AI Platform Governance (trust, groundedness, deterministic behavior across modules)
- Priorytet / V2 scope: V2 (launch‑critical)

**Business challenge (problem):**
AI w Consultify ma być “Harvard-level” i *enterprise-trustworthy*, ale bez kanonicznej warstwy dokumentacji systemowej:
- AI będzie odpowiadać niespójnie (różne moduły → różne zasady),
- rośnie ryzyko halucynacji w obszarach governance (role, gates, economics, artefacts),
- nie mamy jednego źródła prawdy, które AI może cytować i które jest kontrolowane wersjami,
- zmiany w produkcie nie propagują się do AI (drift między kodem a “wiedzą”).

**Cel (outcome):**
W V2 istnieje **Core Documentation Layer** jako kanoniczny “system brain”:
- spójna, wersjonowana biblioteka dokumentów systemowych (policy, architecture, flows),
- deterministyczne wstrzykiwanie tej warstwy do kontekstu AI (z budżetem tokenów),
- odpowiedzi governance‑level są **grounded** i **cytowane** (z weryfikacją),
- kontrola driftu: gdy canonical docs się zmieniają → reindex + audyt wpływu.

**Scope (V2)**
- IN (MUST) — Canonical document set:
  - Core docs pochodzą z repo (kanoniczne) i są określone przez:
    - `docs/product/DOCUMENTATION_REGISTRY.md` (source-of-truth: co jest canonical),
    - dokumenty north‑star jak `docs/product/SYSTEM_ARCHITECTURE_BRIEF.md`.
  - Minimalny zestaw (MUST) jako warstwa systemowa:
    - governance: roles model, initiative governance, gate DoD, change/unblock policy,
    - artefacts list + traceability (no initiative without source),
    - reporting canonical templates (jak AI ma raportować),
    - economics policy (kiedy finanse blokują gates).

- IN (MUST) — Storage & indexing (SSOT):
  - Kanoniczne przechowywanie w DB jako “system scope” docs:
    - `knowledge_documents` + `knowledge_chunks` (schema `server/migrations/266_knowledge_rag.sql`),
    - `organization_id = NULL`, `scope='system'`, `source_type='generated'|'upload'` (dla core docs: `generated`),
    - dedupe po `file_hash` + version.
  - Compatibility layer (MUST):
    - repo ma legacy RAG (`knowledge_docs` + `knowledge_chunks` z `doc_id`) używany przez `ragService.ts` i `KnowledgeIndexer`.
    - V2 ustala kanon: **`knowledge_documents`** (266) i dopina adapter (read/write) dla legacy tylko jako fallback.

- IN (MUST) — Context injection policy:
  - Kanoniczny builder kontekstu już istnieje:
    - `server/src/services/aiContextBuilder.ts` buduje wielowarstwowy kontekst (platform/org/project/execution/knowledge/external + enrichments) z `focusMode`.
  - V2 dodaje governance rules:
    - “System docs layer” jest wstrzykiwana zawsze w minimalnej formie (np. top 3–7 snippetów zależnie od query i screenContext),
    - “focusMode” nie może wyłączyć system layer dla pytań o governance/policy (fail-safe).
  - Token budgeting (MUST):
    - ustalone budżety per warstwa (system/org/project/execution/external) + trimming,
    - logowanie `contextHash` i `contextSizeEstimate` (już istnieje) + dodatkowo: “what got trimmed”.

- IN (MUST) — Citations & verification (trust layer):
  - AI może cytować core docs jako `[DOC1]`, `[DOC2]` (id/slug + title).
  - Weryfikacja cytowań jest wspierana przez:
    - `server/src/services/ai/citationVerifier.ts` + tabela `citation_verification_logs` (`server/migrations/520_ai_enterprise_tables.sql`).
  - Policy:
    - odpowiedzi typu “policy/governance/permissions/why UI behaves this way” wymagają cytowań (min. 1),
    - brak cytowań → AI musi powiedzieć “nie mam źródła w core docs” i zaproponować dopisanie dokumentu / doprecyzowanie.

- IN (MUST) — SuperAdmin control plane:
  - Widok “Core Docs” (w module AI Platform/System):
    - lista core docs: status (indexed/needs_reindex), version, last indexed at, hash,
    - przycisk “Reindex now” + “Preview snippets”,
    - drift alerts: “canonical doc changed but index is stale”.

- OUT (post‑V2):
  - pełna integracja z Internet context (T118),
  - pełna organizacyjna i indywidualna warstwa governance (T119–T121) — w V2 tylko “system core”.

**Implementation notes (grounded w repo):**
- Canonical docs registry istnieje i ma reguły autorytetu:
  - `docs/product/DOCUMENTATION_REGISTRY.md`.
- System architecture north-star jest canonical:
  - `docs/product/SYSTEM_ARCHITECTURE_BRIEF.md`.
- AI context pipeline jest już wielowarstwowy i ma focus modes + trimming:
  - `server/src/services/aiContextBuilder.ts`.
- RAG i metryki RAG istnieją:
  - schema `knowledge_documents`/`knowledge_chunks` (`server/migrations/266_knowledge_rag.sql`)
  - metryki: `server/src/services/ai/ragMetricsService.ts` + tabela `rag_metrics` (`server/migrations/520_ai_enterprise_tables.sql`)
  - legacy indexer i legacy schema: `server/src/services/ai/knowledgeIndexer.ts`, `server/src/services/ragService.ts`.
- Weryfikacja cytowań istnieje (DB fail‑open):
  - `server/src/services/ai/citationVerifier.ts`.

**Deliverables (V2):**
- Core docs ingestion + indexing:
  - job/command, który importuje canonical docs (md) do `knowledge_documents` (scope=system) i tworzy chunks/embeddings,
  - dedupe po hash + version bump gdy treść się zmienia,
  - reindex automation (daily) + manual reindex (SuperAdmin).
- Governance policy w AI runtime:
  - system docs są zawsze dostępne i preferowane jako źródło,
  - enforce citations dla governance answers.
- Observability:
  - dashboard: groundedness (RAG metrics), citation verification score, top missing docs.

**API contract (V2, minimal):**
- `GET /api/superadmin/ai/core-docs` → list (status, version, hash, indexedAt)
- `POST /api/superadmin/ai/core-docs/reindex` (guardrails + reason)
- `GET /api/superadmin/ai/core-docs/:id/snippets` → preview chunks
- (opcjonalnie) `GET /api/superadmin/ai/core-docs/drift` → stale vs canonical

**Analytics / metrics:**
- `core_docs_reindexed` (count, duration)
- `core_docs_drift_detected` (docId, oldHash, newHash)
- `ai_citation_verification_score` (overall_score)
- KPI: spadek “unverified/broken citations”, wzrost groundedness, mniej konfliktów w policy answers.

**Definition of Done (DoD):**
- Canonical docs (system layer) są zasilone do DB i indeksowane do RAG.
- AIContextBuilder zawsze może dostarczyć core doc snippets (token budgeted).
- Governance odpowiedzi mają cytowania i przechodzą weryfikację (logi w DB).
- SuperAdmin może sprawdzić status core docs i uruchomić reindex / zobaczyć drift.

**Acceptance / test plan:**
- Test: zmiana treści w core doc → drift wykryty → reindex → nowy hash/version.
- Test: pytanie o role/gates/economics → AI odpowiada z min. 1 cytowaniem `[DOCx]` i weryfikacja loguje score.
- Test: brak core doc dla pytania → AI komunikuje brak źródła i proponuje aktualizację dokumentacji.

---

## T118 — 🟣 ai — External Knowledge & Internet Context Management for AI (safe web research + governance + audit)
- Status spec: draft
- Link / ID (ClickUp): TBD
- Epic: AI Platform (groundedness, current info, enterprise safety)
- Priorytet / V2 scope: V2

**Business challenge (problem):**
AI musi umieć korzystać z internetu (trendy, benchmarki, konkurencja, standardy), ale:
- bez governance ryzykujemy halucynacje, nieaktualne dane i brak audytu,
- bez bezpieczeństwa ryzykujemy SSRF/niechciane domeny/treści oraz wyciek danych,
- bez retencji i idempotency nie umiemy odtworzyć “skąd była odpowiedź” (trust/regulatory),
- bez spójnych cytowań odpowiedzi są nie weryfikowalne (T117 wymaga citations).

**Cel (outcome):**
W V2 internet context jest:
- **bezpieczny** (policy gating + allowlist/denylist + sanitization),
- **deterministyczny** (ten sam query → podobny wynik, cache),
- **audytowalny** (log źródeł + eventy),
- **cytowany** (źródła jako [1], [2] + zapis w logach),
- oraz działa w 2 trybach:
  - **Web Search (light)**: szybkie wsparcie odpowiedzi w czacie,
  - **Deep Research (heavy)**: iteracyjne research rounds z syntezą.

**Scope (V2)**
- IN (MUST) — Policy gating (“internetEnabled”):
  - internet może być użyty tylko gdy:
    - `AIPolicyEngine.getEffectivePolicy(...).internetEnabled = true` (org policy),
    - i nie ma override typu Regulatory Mode (wtedy `internetEnabled=false` i ADVISORY only).
  - Web search / deep research muszą to respektować:
    - UI pokazuje “Web Search disabled by policy” zamiast silent failure.

- IN (MUST) — Web Search (light mode) governance:
  - Kanoniczna implementacja już istnieje w stream chat:
    - `server/src/routes/ai.routes.ts` robi auto-intent (`webSearchIntentDetector`) i wyszukiwanie (Tavily).
  - V2 domyka:
    - **domain policy**:
      - allowlist/denylist per org (default: allow all public domains, deny: adult/malware/link shorteners),
      - block private network / localhost style URLs (SSRF safety).
    - **content policy**:
      - never include user secrets/PII in query,
      - truncate raw content, strip scripts/HTML, enforce max chars,
      - label: “facts vs assumptions”.
    - **cooldown + caching**:
      - cache per (orgId, normalizedQuery, language, depth) min. 10 min,
      - cap sources to prevent token explosion (np. max 8 citations).

- IN (MUST) — Deep Research (heavy mode) governance:
  - W repo już istnieje:
    - `server/src/services/ai/deepResearchService.ts` + `tavilyWebSearchService.ts`,
    - `server/src/services/ai/deepThinkingOrchestrator.ts` buduje “WEB RESEARCH” addon i source list.
  - V2 domyka:
    - “deep research” ma własny budget + guardrails (max queries, max sources, max content chars),
    - zawsze cytuje [n] i nigdy nie “udaje” dodatkowego researchu poza dostarczonym source blockiem,
    - zapisuje audit: researchType, queries, domains, timestamps.

- IN (MUST) — Unified citations (external sources):
  - Dla web sources cytowania są canonical:
    - marker `[1]`, `[2]` w treści,
    - `citations[]` jako meta (już jest emit w SSE oraz `context.external.citations` w `ai.routes.ts`).
  - V2 ujednolica weryfikację:
    - `citationVerifier.ts` traktuje external URL jako “partial” tylko po regex — V2 dodaje lepszy “verification tier”:
      - URL valid + domain allowed + retrievedBySystem = “verified_external”,
      - URL valid but not retrieved = “partial”.

- IN (MUST) — Persistence & audit (trust & reproducibility):
  - zapisujemy “external context snapshot” per chat run / message:
    - queries, results metadata (url/title/domain/score/date), *bez pełnych raw_content jeśli nie trzeba*,
    - link do `chatRunId` (jest już `chatTraceService.addEvent(... 'web_search' ...)`).
  - retencja:
    - raw snippets max 30–90 dni (config), agregaty dłużej,
    - możliwość wyłączenia persistence per org (compliance).

- IN (MUST) — Tooling (function calling):
  - AI tool `search_web` istnieje (`server/src/services/ai/toolDefinitions.ts`) i używa Tavily.
  - V2 wymaga:
    - gating tool availability przez policy (`internetEnabled`) + env (`TAVILY_API_KEY`),
    - ten sam domain policy i cache co “light web search”,
    - spójny output format (title/url/snippet + answer).

- OUT (post‑V2):
  - pełny “browser-based retrieval” (rendering JS pages) — tylko jeśli potrzebne,
  - rozszerzony “internet governance per project” (np. allowlist per industry/regulatory).

**Implementation notes (grounded w repo):**
- Light web search już działa w chat stream:
  - `server/src/routes/ai.routes.ts`:
    - heurystyka `webSearchIntentDetector.ts`,
    - Tavily adapter `tavilyWebSearchService.ts`,
    - inject do `pipelineRequest.options.systemInstruction` + `context.external.webSearch`.
- Deep Research istnieje:
  - `deepResearchService.ts` (iterative deepening, orgContext injection),
  - `deepThinkingOrchestrator.ts` (format + sources block).
- Policy model istnieje:
  - `server/src/services/aiPolicyEngine.ts` (ma `internetEnabled`, Regulatory Mode → internet off).
- External context layer w `AIContextBuilder` jest stub:
  - `server/src/services/aiContextBuilder.ts` `_buildExternalContext` zwraca tylko `internetEnabled` + empty sources → V2 to domyka.

**Data model (V2, minimal):**
- (SHOULD) `ai_web_sources_log`:
  - `id`, `chat_run_id`, `organization_id`, `user_id`,
  - `mode` (`web_search` | `deep_research`),
  - `queries_json`, `sources_json` (url/title/domain/score/publishedDate),
  - `created_at`, `policy_snapshot` (internetEnabled, allowlist hash),
  - `dedupe_key`.

**API contract (V2, minimal):**
- `GET /api/ai/policy` (już istnieją podobne; V2 zapewnia `internetEnabled` w payload)
- `POST /api/ai/web-search/test` (superadmin/admin) — dry-run i pokaz sources + policy reason
- (opcjonalnie) `GET /api/superadmin/ai/web-sources?orgId=...` — audit list + filters

**Analytics / metrics:**
- `ai_web_search_used` (mode, queriesCount, citationsCount, domainsCount)
- `ai_web_search_blocked` (reason=policy|no_key|domain_blocked)
- KPI: citation verification score, groundedness ↑, time‑to‑answer ↓, spadek “unverified claims”.

**Definition of Done (DoD):**
- Web Search i Deep Research respektują `internetEnabled` i Regulatory Mode.
- Jest domain policy + SSRF safety + cache.
- Każde użycie internetu ma citations i audit trail (min. w chat trace; preferowane w DB log).
- AIContextBuilder pokazuje w `externalSourcesUsed` realne źródła, gdy użyte.

**Acceptance / test plan:**
- Test: org z `internetEnabled=0` → web search nie odpala; UI dostaje jasny reason.
- Test: org z internet ON → auto-intent odpala search, a odpowiedź ma cytowania [1], [2].
- Test: deepResearch ON → research addon zawiera sources block + citations; brak “udawania” dodatkowych źródeł.
- Test: domena na denylist → wynik odfiltrowany; audit event `domain_blocked`.

---

## T119 — 🟣 ai — Organizational Context Governance for AI (what AI may know + data controls + audit)
- Status spec: draft
- Link / ID (ClickUp): TBD
- Epic: AI Platform Governance (enterprise trust, privacy, predictable behavior)
- Priorytet / V2 scope: V2

**Business challenge (problem):**
AI w Consultify ma działać jak “enterprise consultant”, więc musi korzystać z kontekstu organizacji (industry, dojrzałość PMO, strategie, patterny), ale:
- organizacje różnią się tolerancją na “AI seeing data” (privacy, compliance),
- bez jasnych kontroli i audytu nie ma enterprise trust (a w regulated — to blocker),
- bez klasyfikacji danych AI może “przypadkiem” użyć rzeczy zbyt wrażliwych,
- bez polityki retencji i redakcji PII ryzykujemy naruszenia.

**Cel (outcome):**
W V2 organizacja ma kanoniczny “AI Context Governance”:
- jasno zdefiniowane **kategorie danych** dostępne dla AI,
- konfigurowalne **polityki dostępu** (org + project override),
- wbudowaną **redakcję PII** i politykę retencji,
- pełny **audit trail**: co zostało wstrzyknięte do kontekstu i dlaczego.

**Scope (V2)**
- IN (MUST) — Canonical context categories (organization scope):
  - `ORG_PROFILE` (nazwa, branża, region, high-level settings),
  - `ORG_TERMINOLOGY` (glossary / słownik pojęć organizacji),
  - `ORG_PATTERNS` (best practices / lessons learned z `organization_memory`),
  - `ORG_STRATEGY` (strategic directions z KnowledgeService),
  - `ORG_SECURITY_POSTURE` (tylko agregaty/metryki, bez logów wrażliwych),
  - `ORG_FINANCIAL_SUMMARY` (tylko high-level, jeśli włączone; bez danych wrażliwych),
  - `ORG_DOCUMENTS` (RAG: dokumenty organizacji, wg statusu/zgód).

- IN (MUST) — Policy model (SSOT + merging):
  - V2 definiuje merge kolejności:
    1) SuperAdmin global (guardrails),
    2) Organization policy (admin),
    3) Project governance override (jeśli dozwolone),
    4) User preferences (tylko w dół — nie eskalują dostępu).
  - W repo istnieją już klocki:
    - `ai_policies` + `AIPolicyEngine` (policyLevel, `internetEnabled`, auditRequired),
    - `AISettingsService` (`organization_ai_settings`: m.in. `web_search_enabled`, `audit_all_requests`, `pii_detection_sensitivity` w global).
  - V2 konsoliduje: “context governance” musi mieć jedno kanoniczne miejsce konfiguracji (preferowane: `organization_ai_settings` + dodatkowe kolumny JSON “context_policy_json”).

- IN (MUST) — Enforcement w runtime (AIContextBuilder):
  - Kanoniczny builder kontekstu już istnieje:
    - `server/src/services/aiContextBuilder.ts` buduje warstwy: platform / organization / project / execution / knowledge / external.
  - V2 dopina filtrowanie per category:
    - `_buildOrganizationContext` respektuje `context_policy_json`,
    - `_buildKnowledgeContext` respektuje politykę “documents allowed” (np. tylko `status='approved'|published'`).
  - “Fail-safe”:
    - jeśli nie da się odczytać polityki → default jest **bardziej restrykcyjny** (np. brak orgPatterns / brak docs), ale chat nadal działa (fail-soft).

- IN (MUST) — PII & sensitive data handling:
  - istnieje `enterpriseSecurity.scanAndSanitize` (PII redaction + injection defense) i audit do `ai_security_audit_log`.
  - V2 wymaga:
    - redakcja PII w kontekście organizacji (terminology/patterns/docs excerpts) wg sensitivity ustawionej globalnie + user opt-in,
    - zakaz wstrzykiwania surowych identyfikatorów osób (email/phone/PESEL/etc.) do promptu,
    - jasne zasady: AI może referować role (“CFO”, “sponsor”), ale nie personal data, chyba że user jawnie poda w rozmowie.

- IN (MUST) — Auditability (“why AI knew this”):
  - jeżeli `audit_all_requests` jest włączone:
    - logujemy “context manifest”: które kategorie były użyte, ile elementów, hash kontekstu (`contextHash` już jest).
  - minimalnie:
    - `chatTraceService` eventy: `org_context_injected` + counts + policy snapshot hash.

- IN (MUST) — Admin UX (Org settings):
  - w panelu Admin/SuperAdmin istnieje “AI settings” → V2 dodaje sekcję “Context Governance”:
    - toggles per category (ORG_PROFILE, ORG_TERMINOLOGY, ORG_PATTERNS, ORG_STRATEGY, ORG_DOCUMENTS),
    - retention (standard/strict) + “no persistence”,
    - “preview what AI sees” (read-only).

- OUT (post‑V2):
  - granular per-document ACL i labelowanie (DLP) na poziomie chunków,
  - automatyczne wykrywanie wrażliwych treści w dokumentach i auto-classification.

**Implementation notes (grounded w repo):**
- Organization context już jest wstrzykiwany:
  - `AIContextBuilder._buildOrganizationContext` używa:
    - `organizations` (name/industry),
    - `ai_organization_memory` (pmo_maturity),
    - `organization_memory` (top patterns),
    - `ai_organization_memory` (`terminology_*`).
- Knowledge/strategy już istnieje jako warstwa:
  - `AIContextBuilder._buildKnowledgeContext` przez `KnowledgeService.getActiveStrategies(...)`.
- AI Settings istnieją i mają audit:
  - `server/src/services/aiSettingsService.ts` (organization_ai_settings + audit log).
- PII redaction + injection defense istnieje:
  - `server/src/services/ai/enterpriseSecurity.ts`.

**Data model (V2, minimal):**
- (MUST) `organization_ai_settings.context_policy_json` (JSON):
  - `{ categories: { ORG_PROFILE: true, ORG_TERMINOLOGY: true, ORG_PATTERNS: false, ORG_STRATEGY: true, ORG_DOCUMENTS: true }, piiRedaction: 'inherit'|'off'|'on', retention: 'standard'|'strict' }`
- (SHOULD) `ai_context_audit_log`:
  - `id`, `chat_run_id`, `organization_id`, `user_id`,
  - `context_hash`, `categories_used_json`, `sizes_json`, `policy_hash`, `created_at`.

**API contract (V2, minimal):**
- `GET /api/admin/ai/context-policy` → current org policy + effective merge preview
- `PUT /api/admin/ai/context-policy` (guardrails + audit) → update
- `GET /api/admin/ai/context-policy/preview` → “what AI sees” snapshot (redacted)

**Analytics / metrics:**
- `ai_context_category_used` (category, count)
- `ai_context_blocked` (category, reason=policy|compliance)
- KPI: fewer “AI used wrong data”, improved trust score, reduced compliance escalations.

**Definition of Done (DoD):**
- Organizacja może skonfigurować dostęp AI do kategorii kontekstu.
- Runtime enforcement działa (AIContextBuilder respektuje policy).
- PII jest redagowane wg polityki.
- Jest audit trail (min. contextHash + categories_used).

**Acceptance / test plan:**
- Test: ORG_PATTERNS disabled → AIContextBuilder nie zwraca `orgPatterns`.
- Test: ORG_DOCUMENTS disabled → RAG nie dodaje org docs do promptu.
- Test: PII w org memory → redacted w kontekście + audit log event.
- Test: audit_all_requests ON → powstaje rekord context manifest dla chat run.

---

## T120 — 🟣 ai — Individual Context Governance for AI (user privacy + personalization controls + “private mode”)
- Status spec: draft
- Link / ID (ClickUp): TBD
- Epic: AI Platform Governance (privacy-by-design, user trust)
- Priorytet / V2 scope: V2

**Business challenge (problem):**
Żeby AI było naprawdę pomocne, musi personalizować styl i pamiętać preferencje usera. Ale:
- część userów chce “AI bez pamięci” (privacy, zaufanie),
- musimy wspierać GDPR: eksport/usuń dane, retencja, purpose limitation,
- bez jasnych przełączników user nie wie “co AI pamięta” i skąd to ma.

**Cel (outcome):**
W V2 każdy user ma czytelne, egzekwowane ustawienia:
- co może być zapisywane jako **user memory**,
- czy AI może używać **personalizacji**,
- jaki jest **czas retencji** kontekstu i logów,
- tryb **Private Chat** (no persistence, no memory updates),
- oraz narzędzia: **preview / export / delete**.

**Scope (V2)**
- IN (MUST) — Canonical user context categories:
  - `USER_PREFERENCES` (język, styl, “detail level”),
  - `USER_EXPERTISE` (lista obszarów kompetencji),
  - `USER_RECENT_TOPICS` (rolling topics),
  - `USER_ACTIVITY_SIGNALS` (agregaty: interactionCount, lastInteractionAt),
  - `USER_CUSTOM_INSTRUCTIONS` (tekst użytkownika, ograniczony długością).

- IN (MUST) — Existing foundation (grounded in repo):
  - user memory istnieje:
    - `server/src/services/ai/aiMemoryService.ts` (`ai_user_memory`),
    - `AIPipeline` wstrzykuje `userMemory` do kontekstu gdy dostępne.
  - user settings istnieją:
    - `server/src/services/aiSettingsService.ts` ma defaulty: `enable_pii_redaction`, `share_usage_analytics`, `context_retention`.
  - prompt security istnieje:
    - `enterpriseSecurity.scanAndSanitize` zapisuje `ai_security_audit_log`.

- IN (MUST) — Private mode (per conversation/session):
  - UI toggle “Private chat” (session-scoped):
    - nie zapisuje user memory (`aiMemoryService.updateUserMemoryAfterInteraction` nie wywołuje się),
    - nie zapisuje web sources snapshotów (T118),
    - ogranicza audit trail do minimum technicznego (np. error logs bez payload).
  - Private mode nie może wyłączać legal/compliance wymaganych logów bezpieczeństwa (np. injection_blocked).

- IN (MUST) — User-controlled personalization:
  - user może wyłączyć:
    - zapisywanie user memory,
    - użycie user memory w kontekście,
    - share usage analytics (jeśli nie wymagane do billing/abuse prevention).
  - “Fail-safe”: gdy user wyłączy pamięć → AI nadal działa, ale z neutralnym stylem i bez odwołań do historii poza conversation history.

- IN (MUST) — Retention & GDPR controls:
  - `context_retention` (już istnieje jako ustawienie user) ma znaczenie egzekwowane:
    - `session` (default): pamięć długoterminowa tylko preferencje; brak historii tematów jeśli user wyłączy,
    - `extended`: pozwala na recentTopics/expertise,
    - `none`: brak memory persistence.
  - user może:
    - podejrzeć co AI pamięta (“preview”),
    - wyeksportować memory (JSON),
    - usunąć memory (soft delete + audit).

- IN (MUST) — Guardrails for personal data:
  - zakaz zapisu do `ai_user_memory` danych typu PII/sekrety:
    - przy update memory przechodzimy przez PII redaction (sensitivity z global settings).
  - UI copy jasno mówi: “Nie zapisujemy danych wrażliwych; jeśli podasz je w czacie, mogą zostać użyte w tej sesji.”

- OUT (post‑V2):
  - per-feature consent (np. osobne zgody na “behavioral intelligence” T113),
  - “on-device memory” (jeśli będzie mobile-native).

**Data model (V2, minimal):**
- (MUST) `ai_user_preferences` / `ai_user_memory` jako SSOT dla user-level (bez dublowania):
  - V2 wybiera jeden kanon i zapewnia compat-layer, bo repo używa obu ścieżek (policy engine vs memory service).
- (SHOULD) `ai_user_privacy_settings` (jeśli nie da się dołożyć do existing settings):
  - `user_id`, `memory_enabled`, `memory_write_enabled`, `private_mode_default`, `retention_mode`, `updated_at`.

**API contract (V2, minimal):**
- `GET /api/settings/ai/privacy` → effective user privacy config
- `PUT /api/settings/ai/privacy` → update (audit)
- `GET /api/settings/ai/memory/preview`
- `GET /api/settings/ai/memory/export`
- `DELETE /api/settings/ai/memory` (requires confirmation)

**Analytics / metrics:**
- `ai_private_mode_enabled` / `ai_private_mode_disabled`
- `ai_memory_write_blocked` (reason=user_setting|policy)
- KPI: wzrost opt-in rate, spadek “privacy concerns” feedback.

**Definition of Done (DoD):**
- Private mode działa i realnie wyłącza persistence/memory updates.
- User może preview/export/delete pamięć.
- Retention jest egzekwowane w kodzie (nie tylko UI).
- Memory writes są PII-safe (redaction + blocklist).

**Acceptance / test plan:**
- Test: private mode ON → `ai_user_memory.interaction_count` nie rośnie, recentTopics nie aktualizuje się.
- Test: retention `none` → brak zapisów memory w DB.
- Test: export → zwraca tylko dozwolone kategorie (bez sekretów/PII).
- Test: delete → usuwa/zeruje memory i jest event w audit.

---

## T121 — 🟣 ai — Organizational Context Governance for AI (Extended Controls: per-project, per-document, DLP-lite)
- Status spec: draft
- Link / ID (ClickUp): TBD
- Epic: AI Platform Governance (enterprise / regulated readiness)
- Priorytet / V2 scope: V2

**Business challenge (problem):**
T119 daje bazowe kontrolki “czy AI może widzieć X”, ale enterprise oczekuje precyzji:
- różne projekty mogą mieć różne restrykcje (np. M&A, bezpieczeństwo),
- dokumenty muszą mieć “AI visibility” oraz poziom wrażliwości,
- potrzebujemy kontrolowanego wyjątku (allowlist) bez rozszczelniania całej organizacji,
- potrzebujemy dowodu dla audytu: “AI nie używało wrażliwych dokumentów”.

**Cel (outcome):**
W V2 mamy rozszerzone, ale nadal lekkie (DLP-lite) kontrole:
- per-project override (bardziej restrykcyjny niż org),
- per-document visibility + sensitivity,
- narzędzie do weryfikacji i audytu użycia dokumentów przez AI (manifest + query logs),
- spójne działanie na obu schematach RAG (nowy `knowledge_documents` i legacy `knowledge_docs`).

**Scope (V2)**
- IN (MUST) — Per-project overrides:
  - Project może “zaostrzyć” politykę z T119 (nigdy poluzować):
    - wyłączyć `ORG_DOCUMENTS` dla projektu,
    - wyłączyć web search w projekcie (nawet jeśli org ma internetEnabled),
    - ograniczyć do allowlist kategorii dokumentów (np. tylko `procedure`, `policy`).
  - Grounding:
    - `projects.governance_settings` już istnieje i jest parsowane w `AIContextBuilder._buildProjectContext`.

- IN (MUST) — Per-document “AI visibility”:
  - Kanoniczne atrybuty dokumentu (dla `knowledge_documents`):
    - `ai_visibility`: `allowed` | `blocked` | `requires_approval`,
    - `sensitivity`: `public` | `internal` | `confidential`,
    - `retention_class`: `standard` | `strict`.
  - Dla legacy `knowledge_docs`:
    - compat-layer przez `tags`/`category` lub side-table mapping (bez przebudowy całego legacy).

- IN (MUST) — Enforcement in retrieval:
  - `KnowledgeService.getDocuments(...)` i RAG retrieval muszą filtrować:
    - tylko `ai_visibility='allowed'` (oraz zgodne z project override),
    - `confidential` nigdy nie idzie do AI bez jawnego user approval (HITL).
  - “No surprises”: UI pokazuje, że dany dokument nie będzie użyty przez AI (badge).

- IN (MUST) — HITL approval (minimal):
  - jeśli dokument ma `requires_approval`:
    - AI może poprosić usera o zgodę na użycie tej klasy dokumentów w rozmowie,
    - zgoda jest zapisywana (scope: conversation / project / org; domyślnie conversation).

- IN (MUST) — Audit & verification:
  - dla każdej odpowiedzi opartej o dokumenty:
    - logujemy listę docIds użytych w retrieval (top N),
    - logujemy “blocked docs attempted” (jeśli query próbowało, ale policy odcięła).
  - SuperAdmin ma widok: “AI document usage audit” (org/project filter).

- OUT (post‑V2):
  - pełne DLP (automatyczne klasyfikowanie chunków, regex PII na chunkach, watermarking),
  - integracja z zewnętrznym DLP/Key Management.

**Implementation notes (grounded w repo):**
- Repo ma już dual-schema knowledge:
  - `KnowledgeService.getDocuments` próbuje `knowledge_documents`, fallback `knowledge_docs`.
- AIContextBuilder buduje knowledge layer przez KnowledgeService.
- Posiadamy mechanizmy HITL w AI (pending approvals context) — można je wykorzystać jako “approval record” dla `requires_approval`.

**Data model (V2, minimal):**
- (SHOULD) kolumny w `knowledge_documents` (migration V2):
  - `ai_visibility TEXT DEFAULT 'allowed'`,
  - `sensitivity TEXT DEFAULT 'internal'`,
  - `retention_class TEXT DEFAULT 'standard'`.
- (SHOULD) `ai_doc_access_approvals`:
  - `id`, `organization_id`, `project_id`, `user_id`, `document_id`, `scope`, `approved_at`, `expires_at`.
- (SHOULD) `ai_doc_usage_log`:
  - `id`, `chat_run_id`, `organization_id`, `project_id`, `user_id`,
  - `used_document_ids_json`, `blocked_document_ids_json`, `created_at`.

**API contract (V2, minimal):**
- `PUT /api/admin/knowledge-documents/:id/ai-visibility` (allowed/blocked/requires_approval)
- `PUT /api/admin/knowledge-documents/:id/sensitivity` (public/internal/confidential)
- `GET /api/superadmin/ai/doc-usage-audit?orgId=&projectId=&days=30`

**Analytics / metrics:**
- `ai_doc_used` (docId, sensitivity)
- `ai_doc_blocked` (docId, reason)
- KPI: fewer compliance escalations, faster approvals, higher trust.

**Definition of Done (DoD):**
- Dokumenty mają AI visibility i sensitivity (dla nowego schema; legacy ma compat).
- Retrieval filtruje dokumenty zgodnie z org/project policy.
- Jest minimalny HITL dla `requires_approval`.
- Jest audit trail doc usage per chat run.

**Acceptance / test plan:**
- Test: doc `blocked` → nigdy nie jest użyty w RAG, nawet jeśli jest najbardziej podobny.
- Test: project override wyłącza ORG_DOCUMENTS → brak docs w kontekście.
- Test: doc `requires_approval` → bez zgody nie użyty; po zgodzie użyty tylko w scope conversation.

---

## T122 — 🟣 ai — System Architecture Consolidation & Dependency Review (remove duplicates, unify SSOT, reduce risk)
- Status spec: draft
- Link / ID (ClickUp): TBD
- Epic: Platform Architecture (stability, maintainability, deterministic behavior)
- Priorytet / V2 scope: V2 (launch-hardening)

**Business challenge (problem):**
Po wielu iteracjach system urósł i ma oznaki “multi‑route / multi‑service drift”:
- duplikaty routerów i endpointów (szczególnie AI: prompts/learning/settings/analytics),
- mieszanina legacy schematów DB (knowledge docs, prompts) + nowe schematy (RAG 266, ai_system_prompts),
- importy `.js` vs `.ts` oraz lazy-load obejścia circular deps zwiększają ryzyko 503 “feature unavailable”,
- brak jednej mapy zależności → ciężko przewidzieć skutki zmian (V2 wymaga stabilności i trust).

**Cel (outcome):**
W V2 architektura jest “clean enough”:
- jeden kanoniczny router / SSOT per capability (prompts, learning, context, web research),
- zredukowane duplikaty w `Gateway.ts`,
- udokumentowane granice modułów + dependency review (cykle, hot paths),
- automatyczne guardrails w CI (wykrywanie import drift / duplicate mounts / missing modules).

**Scope (V2)**
- IN (MUST) — Route consolidation (API gateway hygiene):
  - przegląd `server/src/Gateway.ts` i:
    - identyfikacja zduplikowanych importów i mountów (np. podobne AI analytics/routes),
    - wybór kanonicznego path + aliasy dla legacy (bez breaking changes),
    - zakaz montowania “stub routers” w prod (spójne z T107/T108).

- IN (MUST) — SSOT consolidation for AI platform:
  - Prompts/learning/context:
    - zgodnie z T116/T117: jeden kanon prompt registry + jeden kanon context builder,
    - usunięcie/oznaczenie deprecated ścieżek (np. legacy `server/src/ai/*` jeśli dubluje `server/src/services/*`).
  - Knowledge/RAG:
    - kanon: `knowledge_documents` (266), legacy tylko jako fallback przez compat-layer.

- IN (MUST) — Dependency review (circular deps + lazy-load discipline):
  - katalog “AI platform” ma jasne zasady:
    - gdzie wolno lazy-load, a gdzie nie (tylko w “integration boundaries”),
    - zakaz silent swallowing dla krytycznych braków (np. jeśli guardy policy missing → musi być metryka + health check).
  - dodajemy raport:
    - największe cykle importów,
    - “hot path” dla `/api/ai/chat/stream`,
    - lista modułów o najwyższym ryzyku (db access, network calls, embeddings).

- IN (MUST) — Health checks for critical AI deps:
  - endpoint / check agregujący:
    - DB schema availability (ai tables, knowledge tables),
    - web search key presence (jeśli feature ON),
    - promptAssembler availability (T116),
    - citation verifier availability (T117).
  - fail-open tylko tam gdzie to świadoma decyzja i jest log/metryka.

- IN (MUST) — CI guardrails (minimal):
  - skrypt “arch sanity”:
    - wykrywa duplikaty mountów na ten sam base path,
    - wykrywa importy do nieistniejących modułów / złą końcówkę `.js`,
    - wykrywa “new schema used without fallback” tam gdzie wymagany compat.

- OUT (post‑V2):
  - pełna refaktoryzacja modułowa (monorepo packages / clean architecture),
  - automatyczne “architecture tests” (enforced boundaries).

**Implementation notes (grounded w repo):**
- `server/src/Gateway.ts` montuje bardzo wiele routerów; jest też mechanika “enableStubRoutes”.
- Repo ma jawne duplikacje w AI warstwie (T116) i legacy vs services (T117).
- W wielu miejscach stosowane jest lazy-load `import('./x.js')` jako workaround na cykle.

**Deliverables (V2):**
- “Canonical API map” (krótka tabela: capability → canonical route → legacy aliases).
- Zredukowany gateway + jasno określone deprecations.
- Dependency report + lista cykli + rekomendacje.
- CI sanity check + health checks.

**Definition of Done (DoD):**
- Nie ma duplikatów kanonicznych endpointów dla tych samych capability (prompts/learning/context/web search).
- Gateway jest uporządkowany: stub routes nie wychodzą w prod.
- Jest raport zależności + sanity checks w CI.
- AI krytyczne zależności mają health checks i obserwowalność.

**Acceptance / test plan:**
- Test: uruchomienie sanity check wykrywa duplicate mount i failuje build.
- Test: prod config bez `ENABLE_STUB_ROUTES` nie wystawia stub endpoints.
- Test: AI health check raportuje brakujące tabele/keys jako “degraded” (nie silent).

---
