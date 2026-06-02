---
uiux_doc_id: UIUX_RAW_CALENDAR_AI_WORKDAY_PROJECT_ENGINE_2026_05_09
doc_kind: RAW_REFERENCE
version: 1.0
owner: user
status: raw
last_updated: 2026-05-09
---

# Raw input — Calendar / AI Workday & Project Calendar Engine (2026-05-09)

Poniżej: surowe założenia autora (produkt + architektura) wklejone **verbatim**.

---

## VERBATIM

Consultify Calendar / AI Workday & Project Calendar Engine
1. Executive Summary
Consultify Calendar powinien być czymś większym niż kalendarz miesięczny i czymś innym niż kopia Google Calendar. Jego właściwa rola to warstwa orkiestracji czasu pracy: osobistego dnia użytkownika, rytmu zespołu, rytmu projektu, decyzji, zadań, spotkań, deadline’ów, review i follow-upów.
Klasyczny kalendarz odpowiada na pytanie: „Kiedy mam spotkanie?”
Consultify Calendar ma odpowiadać na pytanie: „Co realnie powinienem zrobić dzisiaj, kiedy mam na to czas, co jest ryzykiem i co musi powstać po spotkaniu?”
Najważniejsza decyzja architektoniczna:
Consultify Calendar = AI-native Workday & Project Calendar Engine.
To oznacza, że moduł łączy:
zewnętrzne kalendarze użytkownika: Google Calendar, Outlook, Apple Calendar / CalDAV, ICS,
wewnętrzne obiekty Consultify: Zadania, Decyzje, Inicjatywy, Realizacja, Dokumenty, Outputs, Inbox,
planowanie dnia i tygodnia,
time blocking,
przygotowanie do spotkań,
follow-upy po spotkaniach,
wykrywanie konfliktów,
scoring przeciążenia,
rytm projektowy i organizacyjny.
Kalendarz nie powinien zastępować modułu Zadania, Decyzje, Inicjatywy, Realizacja ani Manager. Powinien pokazywać ich obiekty w czasie i pomagać zdecydować, co ma się wydarzyć teraz, dzisiaj, w tym tygodniu i przed kolejnym review.
Ta logika jest spójna z Digital Roadmap: transformacja wymaga analizy stanu obecnego, stworzenia inicjatyw i zbudowania spójnego planu wdrożenia, ale działa tylko wtedy, kiedy jest zarządzana jako proces, a nie jednorazowy projekt. Digital Roadmap zakłada również sześć osi transformacji — procesy, produkty cyfrowe, modele biznesowe, dane, kulturę oraz cyberbezpieczeństwo — i podkreśla, że chaos transformacyjny można ograniczać przez uporządkowanie działań, zależności i kompetencji.
2. Benchmark rynku z cytowaniami
2.1. Klasyczne kalendarze
Google Calendar jest dobrym wzorcem dla podstawowej warstwy wydarzeń: event, attendee, recurrence, reminders, calendar list, Google Meet, external IDs i synchronizacja. W Google Calendar wydarzenia powtarzalne są opisywane przez start/end oraz pole recurrence, które zawiera reguły zgodne z RFC 5545, takie jak RRULE, RDATE i EXDATE.
Microsoft Outlook / Microsoft Graph Calendar jest kluczowym wzorcem dla enterprise. Microsoft Graph obsługuje synchronizację przyrostową wydarzeń przez delta query, dzięki czemu aplikacja może utrzymywać lokalny stan wydarzeń bez pobierania całego kalendarza za każdym razem. Microsoft dokumentuje również least-privileged permissions dla kalendarzy, w tym Calendars.Read i Calendars.ReadWrite, co jest istotne dla architektury uprawnień Consultify.
Proton Calendar jest ważnym benchmarkiem prywatności. Proton podkreśla end-to-end encryption, zero-knowledge encryption dla szczegółów wydarzeń, prywatne udostępnianie dostępności oraz kontrolę nad tym, czy inni widzą pełne szczegóły kalendarza, czy tylko availability. Dla Consultify to oznacza, że prywatność wydarzeń nie może być dodatkiem. Musi być częścią modelu danych i widoczności.
Apple Calendar / CalDAV powinien być traktowany jako integracja drugiego etapu: ważna dla użytkowników indywidualnych i Apple ecosystem, ale trudniejsza do wdrożenia niż Google i Microsoft, bo wymaga obsługi CalDAV, app-specific passwords, ograniczeń writebacku i złożonej obsługi recurring events.
Wniosek: klasyczne kalendarze są dobre w obsłudze wydarzeń, zaproszeń, dostępności, powtarzalności i synchronizacji, ale nie rozwiązują problemu: „czy mój dzień ma pojemność na wykonanie pracy wynikającej z projektów, decyzji i inicjatyw?”.
2.2. AI scheduling / smart calendar
Reclaim AI rozróżnia trzy klasy bloków: Habits, Tasks i Focus Time. Habits służą do elastycznego planowania powtarzalnych rytuałów, Tasks do deadline-driven work, a Focus Time do ochrony czasu głębokiej pracy bez przypisania do konkretnego zadania. Reclaim automatycznie broni Focus Time, planuje Tasks przed deadline’em i dostosowuje kalendarz, gdy plany się zmieniają.
SkedPal jest dobrym benchmarkiem dla time blockingu i automatycznego układania zadań. SkedPal rozróżnia Time Blocks i Bundles; zadania time-blocked są traktowane jak ważne spotkania z samym sobą, a drobne zadania mogą być grupowane. SkedPal bardzo mocno komunikuje zasadę: „jeżeli czegoś nie ma w kalendarzu, prawdopodobnie nie zostanie wykonane”.
Clockwise jest benchmarkiem dla zespołowej optymalizacji kalendarza. Jego logika polega na ochronie długich bloków skupienia i przesuwaniu spotkań zespołowych tak, aby poprawić dostępność focus time.
Wniosek: smart calendars dobrze planują czas i chronią focus, ale nie rozumieją konsultingowej struktury pracy: inicjatyw, decyzji, gate’ów, rezultatów, business case’ów, dokumentów i rytmu transformacji.
2.3. Task + calendar productivity systems
Todoist rozwija calendar layout i time blocking. Zadania z datą, godziną i duration pojawiają się w slotach kalendarza, można je przeciągać, zmieniać duration i synchronizować time-blocked tasks z Google lub Outlook Calendar. Integracja Todoist pokazuje wydarzenia Google/Outlook obok tasków w Today i Upcoming, ale same wydarzenia są read-only i widoczne tylko dla użytkownika.
Sunsama jest silnym benchmarkiem rytuałów produktywności. Ma guided daily planning, który prowadzi użytkownika przez refleksję nad poprzednim dniem, wybór zadań, przewidywane obciążenie i finalizację planu. Ma też weekly planning ritual do ustawiania celów tygodnia i przenoszenia celów z poprzedniego tygodnia.
Notion Calendar dobrze pokazuje, jak kalendarz może łączyć wydarzenia z bazami danych i dokumentami. Notion Calendar pozwala podłączyć kalendarze osobiste i firmowe, bazy Notion, linkować strony Notion do wydarzeń oraz przeciągać dated database items do konkretnych slotów czasu, aktualizując przy tym bazę.
Wniosek: systemy produktywności dobrze obsługują dzień jednostki, ale zwykle nie są wystarczająco mocne jako enterprise execution layer dla projektów konsultingowych, decyzji, inicjatyw i rezultatów.
2.4. Project management calendars
Asana Calendar pokazuje zadania i milestone’y z terminami w widoku kalendarza projektu. Asana pozwala tworzyć taski w calendar view, zmieniać due date przez drag & drop, filtrować widoki i zapisywać view.
ClickUp oferuje wiele widoków: List, Board, Calendar, Gantt, Timeline, Workload i Box. Workload view pokazuje obciążenie zespołu, capacity, availability oraz rozkład pracy w czasie. ClickUp Calendar pokazuje zadania tylko wtedy, gdy mają start date, due date lub aktywne date custom field; pozwala też pokazywać assignee, priority, time estimate, sprint points, subtasks i custom fields.
ClickUp Brain idzie w stronę work operating system z AI: łączy tasks, docs i people, umożliwia generowanie action items z dokumentów, tworzenie tasków z treści oraz AI Notetaker generujący meeting summaries i action items.
Wniosek: narzędzia PM pokazują terminy, due dates, milestones i workload, ale nie mają wystarczająco mocnej warstwy osobistego planowania dnia i meeting outcome engine połączonego z konsultingową logiką decyzji i inicjatyw.
2.5. Meeting intelligence
Microsoft Teams + Copilot potrafi podsumowywać spotkania, wskazywać action items, odpowiadać na pytania w czasie rzeczywistym i po spotkaniu oraz korzystać z transcriptu, chatu i Recap tab. Copilot w Outlook/Calendar potrafi przygotować użytkownika do spotkania, podsumowując kontekst, zadania, dokumenty i zasoby powiązane z meeting event.
Zoom AI Companion w Smart Recording generuje structured summary, highlights, key moments, action items, searchable timestamped highlights i speaker insights.
Fireflies integruje się z ponad 100 aplikacjami, w tym Google Meet, Teams, Zoom, Slack, HubSpot, Salesforce, Notion, Linear i Microsoft To Do. Fireflies automatycznie wykrywa action items w czasie rzeczywistym, udostępnia je w Notes tab oraz pozwala używać AskFred do generowania notatek i podsumowań.
Google Meet + Gemini rozwija AI note-taking, a według aktualnych doniesień rozszerza „Take notes for me” również na spotkania stacjonarne, Zoom i Microsoft Teams, zapisując podsumowania oraz action items do Google Docs.
Wniosek: meeting intelligence tools świetnie zbierają notatki i action items, ale zwykle nie zamieniają spotkania w zarządzany obiekt konsultingowy: decyzje, zadania, dokumenty, następne review, status projektu, wpływ na KPI i ryzyko wykonania.
2.6. Enterprise work operating systems
Microsoft 365 Copilot przesuwa się w stronę przygotowania spotkań, kontekstu z poczty i kalendarza oraz pracy na danych z Microsoft 365. Copilot w Outlook jest wbudowany w email i calendar, pomagając użytkownikowi zobaczyć, co jest ważne, rozumieć długie wątki i rekonstruować kontekst pracy.
Notion Calendar pokazuje bardzo ważną zasadę: kalendarz nie może być samotną aplikacją. Powinien być połączony z miejscem, gdzie są zadania, notatki, wiedza i projekty.
ClickUp Brain pokazuje kierunek AI work operating system: AI ma działać na zadaniach, dokumentach, ludziach, notatkach, automatyzacjach i meeting outputs, a nie tylko odpowiadać w czacie.
Wniosek: Consultify powinien iść dalej niż kalendarz. Powinien mieć warstwę „czas + praca + AI + governance”, bo consulting execution wymaga przygotowania, wykonania, decyzji, dokumentów, follow-upów i kontroli rytmu.
3. Kluczowy insight produktu
Rynek jest pocięty na osobne klasy narzędzi:
Klasa narzędzia	Co robi dobrze	Czego nie robi wystarczająco dobrze
Google / Outlook Calendar	wydarzenia, zaproszenia, dostępność, powtarzalność	nie rozumie projektów, inicjatyw, decyzji i rezultatów
Reclaim / Motion / SkedPal / Clockwise	AI scheduling, focus time, time blocking	nie rozumie konsultingowej architektury pracy
Sunsama / Akiflow / Todoist / Morgen	planowanie dnia, task + calendar	słabe enterprise governance, słaby PMO context
ClickUp / Asana / Monday / Jira	due dates, milestones, workload, project views	nie są osobistym plannerem dnia z meeting outcome engine
Teams / Zoom / Meet / Fireflies	meeting notes, transcript, action items	nie zamykają pełnego cyklu: event → decyzja → task → output → review
Microsoft 365 / Notion / ClickUp Brain	kontekst pracy i AI	nie są wyspecjalizowane w consulting execution i Digital Roadmap
Consultify Calendar ma zająć lukę:
Oto twój dzień pracy w kontekście projektów, inicjatyw, decyzji, zadań, spotkań, deadline’ów i priorytetów. Oto co jest naprawdę ważne dzisiaj. Oto kiedy masz czas. Oto co powinieneś zrobić przed spotkaniem. Oto co powinno powstać po spotkaniu. Oto co trzeba przeplanować, bo dzień nie ma już pojemności.
To jest różnica między kalendarzem jako widokiem zajętości a kalendarzem jako silnikiem wykonania.
4. Definicja Consultify Calendar
Consultify Calendar to AI-native kalendarz pracy, który integruje zewnętrzne kalendarze użytkownika z wewnętrznymi obiektami Consultify — zadaniami, decyzjami, inicjatywami, projektami, spotkaniami, deadline’ami i review — aby pomagać użytkownikowi planować dzień, chronić czas, przygotowywać spotkania, zarządzać zadaniami dnia i utrzymywać rytm realizacji.
Kalendarz nie jest
tylko miesięczną siatką dat,
tylko Google Calendar embed,
tylko listą spotkań,
tylko task managerem,
tylko PMO timeline,
tylko przypominajką,
tylko widokiem deadline’ów,
tylko narzędziem do rezerwacji spotkań,
tylko agregatorem zewnętrznych kalendarzy.
Kalendarz jest
dziennym centrum pracy,
widokiem czasu,
warstwą orkiestracji dnia,
miejscem planowania zadań dnia,
miejscem przygotowania spotkań,
miejscem follow-upów,
miejscem łączenia czasu z pracą,
miejscem pilnowania rytmu projektów,
osobistym AI plannerem,
organizacyjnym kalendarzem pracy,
execution layer dla czasu.
5. Nazwa modułu i uzasadnienie
Rekomendacja:
Nazwa w UI: Kalendarz
Nazwa architektoniczna: Consultify Calendar / AI Workday & Project Calendar Engine
Nazwa komponentu AI: AI Workday Planner
Nazwa funkcji dziennej: My Day / Plan dnia
Nazwa funkcji projektowej: Project Calendar
Nazwa funkcji zespołowej: Team Calendar
Dlaczego:
Kalendarz jest prosty, zrozumiały i natychmiast rozpoznawalny dla użytkownika. Nie należy nazywać zakładki „AI Workday & Project Calendar Engine”, bo to brzmi jak techniczny moduł, nie jak miejsce pracy. W dokumentacji i architekturze trzeba jednak jasno zapisać, że to nie jest zwykły kalendarz. To engine odpowiedzialny za połączenie czasu, pracy, projektów, decyzji i AI.
6. Rola Kalendarza w architekturze Consultify
6.1. Kalendarz → Czat / Teresa
Teresa powinna mieć dostęp do Calendar Context API i móc odpowiadać na pytania:
„Co mam dzisiaj najważniejszego?”
„Przygotuj mi plan dnia.”
„Czy mam dziś realnie czas na raport?”
„Jakie decyzje mam podjąć?”
„Przełóż mniej ważne zadania.”
„Zaplanuj mi 90 minut pracy głębokiej.”
„Przygotuj mnie do spotkania o 14:00.”
„Co jest zagrożone w tym tygodniu?”
Teresa nie powinna sama przesuwać ważnych spotkań zewnętrznych bez zgody użytkownika. Dla działań wpływających na innych uczestników wymagana jest akcja typu propose → approve → execute.
6.2. Kalendarz → Zadania
Kalendarz pokazuje zadania w czasie:
zadania na dziś,
zadania zaległe,
zadania z deadline’em,
zadania zaplanowane jako time block,
zadania bez czasu wykonania,
zadania konfliktujące ze spotkaniami.
Kalendarz może:
zaplanować zadanie w konkretnym oknie,
zasugerować priorytety,
podzielić zadanie na bloki,
ostrzec, że zadanie nie ma czasu wykonania,
oznaczyć blok pracy jako completed.
Nie zastępuje modułu Zadania. Zadania są systemem zarządzania pracą. Kalendarz jest systemem osadzania pracy w czasie.
6.3. Kalendarz → Decyzje
Kalendarz pokazuje:
decyzje oczekujące,
decyzje przeterminowane,
decyzje wymagające spotkania,
decision review,
decyzje powiązane z inicjatywami.
Kalendarz może:
utworzyć slot „Decision Review”,
przygotować decision briefing,
ostrzec: „decyzja ma deadline, ale nie ma slotu”.
Nie zastępuje logu decyzji. Log decyzji pozostaje źródłem prawdy.
6.4. Kalendarz → Inicjatywy
Kalendarz pokazuje:
review inicjatyw,
zatwierdzenia,
warsztaty,
milestone’y,
gate’y,
zależności czasowe.
Nie ocenia portfolio inicjatyw. Pokazuje ich rytm w czasie.
6.5. Kalendarz → Realizacja / Implementation
Kalendarz pokazuje:
terminy projektowe,
kamienie milowe,
steering committees,
sprint reviews,
gate’y,
ryzyko przeciążenia zespołu.
Nie jest PMO boardem. Realizacja zarządza projektem, Kalendarz pokazuje czas, rytm i zdolność wykonania.
6.6. Kalendarz → Inbox
Inbox może wrzucać do Kalendarza:
zaproszenia,
sugestie spotkań,
follow-upy,
deadline reminders,
alerty o braku reakcji,
zadania wymagające zaplanowania.
6.7. Kalendarz → Notatnik / Pomysły / Outputs
Z wydarzenia można wygenerować:
meeting note,
preparation note,
follow-up note,
pomysł,
insight,
agenda,
minutes,
status note,
decision briefing,
weekly review.
6.8. Kalendarz → Manager
Manager widzi:
obciążenie zespołu,
krytyczne terminy,
przeciążenia,
brak slotów na decyzje,
ryzyko braku czasu na realizację.
Manager nie powinien widzieć prywatnych szczegółów wydarzeń użytkownika, chyba że użytkownik lub polityka organizacji jednoznacznie to dopuszcza.
7. Granice modułu — co robi / czego nie robi
Kalendarz robi
Obszar	Co robi
Czas	pokazuje pracę w czasie
Plan dnia	układa plan dnia i tygodnia
Zadania	pokazuje taski jako time blocks
Decyzje	pokazuje decyzje jako deadlines/review slots
Spotkania	przygotowuje agendy i briefingi
Follow-up	tworzy zadania, decyzje, notatki po spotkaniu
Konflikty	wykrywa przeciążenie i double booking
Focus	chroni czas głębokiej pracy
Projekty	pokazuje milestone’y, gate’y, review
Zespół	pokazuje workload i capacity
Integracje	synchronizuje Google, Outlook, Apple/CalDAV, ICS
AI	rekomenduje, ale krytyczne akcje wykonuje po zgodzie
Kalendarz nie robi
Obszar	Czego nie robi
Zadania	nie zastępuje task managera
PMO	nie zastępuje modułu Realizacja
Decyzje	nie zastępuje logu decyzji
Inicjatywy	nie ocenia portfela inicjatyw
Manager	nie jest panelem rozliczania ludzi
Finanse	nie liczy ROI ani business case
Dokumenty	nie jest repozytorium dokumentów
Meeting notes	nie zastępuje pełnej dokumentacji spotkań
Kalendarz zewnętrzny	nie jest tylko kopią Google Calendar
Automatyzacja	nie przesuwa ważnych wydarzeń bez zgody
8. Integracja z Digital Pathfinder / Digital Roadmap
Digital Roadmap zakłada trzy praktyczne kroki: analizę stanu obecnego, stworzenie listy inicjatyw transformacyjnych oraz budowę spójnego planu wdrożenia wraz z efektami ekonomicznymi. Ten plan ma być zarządzany jako proces, ponieważ transformacja nigdy się nie kończy i wymaga korekt w odpowiedzi na zmiany technologiczne i biznesowe.
Dlatego Consultify Calendar powinien pilnować, aby transformacja nie była tylko listą inicjatyw. Musi zamieniać roadmapę w rytm pracy.
8.1. Sześć osi transformacji w Kalendarzu
Oś Digital Roadmap	Co pokazuje Kalendarz
Digital Processes	przeglądy procesów, warsztaty VSM, spotkania optymalizacyjne, deadline’y usprawnień
Digital Products	roadmap reviews, sprint reviews, product demos, release dates, customer feedback sessions
Digital Business Models	business model workshops, pricing reviews, partner meetings, platform reviews
Data Management / Big Data	data quality meetings, integration deadlines, analytics reviews, AI model reviews
Digital Culture & Competence	szkolenia, coaching, change management sessions, adoption reviews
Cybersecurity	audyty, security reviews, access reviews, incident drills, compliance deadlines
W Digital Roadmap ważne jest również zachowanie równowagi między planowaniem i działaniem, technologią i człowiekiem, teraźniejszością i przyszłością. Kalendarz jest praktycznym narzędziem do utrzymania tej równowagi, bo pokazuje, czy organizacja naprawdę ma czas, ludzi i rytm na realizację transformacji.
9. Personalizacja według użytkownika, organizacji, projektu i roli
9.1. Kontekst użytkownika
Model personalizacji powinien uwzględniać:
rolę,
dział,
seniority,
lokalizację,
strefę czasową,
preferowane godziny pracy,
preferowane pory spotkań,
preferowany czas deep work,
limit spotkań dziennie,
aktualne zadania,
aktualne projekty,
zaległości,
aktywne decyzje,
poziom obciążenia,
prywatność wydarzeń,
język interfejsu,
styl planowania: manualny, półautomatyczny, automatyczny po akceptacji.
9.2. Kontekst organizacji
System powinien uwzględniać:
dni wolne,
kalendarze firmowe,
cykle raportowania,
rytm zarządczy,
cykle sprintów,
komitety sterujące,
review miesięczne,
review tygodniowe,
rytuały transformacji,
globalne time zones,
polityki prywatności i dostępu.
9.3. Kontekst projektu
Dla projektu kalendarz powinien widzieć:
milestone’y,
gate’y,
review,
warsztaty,
zależności,
decyzje,
ryzyka,
deliverables,
deadline’y,
status meetings,
steering committees.
9.4. Kontekst energii i produktywności
Wersja zaawansowana powinna obsługiwać:
najlepsze pory na deep work,
fatigue po spotkaniach,
lunch,
buffer time,
travel time,
recovery blocks,
dni bez spotkań,
maksymalną liczbę context switches.
9.5. Personalizacja według roli
Rola	Co powinien widzieć użytkownik
CEO	board meetings, investor meetings, decyzje, strategic reviews, przeciążenie decyzyjne
CFO	cash flow meetings, budget reviews, ROI reviews, approvals, reporting deadlines
COO	production reviews, implementation milestones, operational risks, cross-functional meetings
Project Manager	milestones, dependency reviews, sprint reviews, overdue tasks, workload
Consultant	customer workshops, preparation blocks, delivery deadlines, follow-upy, dokumenty
Manager zespołu	1:1, team meetings, workload, przeciążenia ludzi, konflikty zasobów
10. Model danych i przykłady JSON
10.1. CalendarEvent
Reprezentuje każde wydarzenie widoczne w kalendarzu: spotkanie, deadline, review, blok pracy, milestone, external event.
Relacje:
może być powiązane z Task, Decision, Initiative, Project, Document, MeetingOutcome,
może pochodzić ze źródła wewnętrznego lub zewnętrznego,
może mieć recurrence rule.
{
  "event_id": "evt_001",
  "title": "Cloud Migration Phase 2 Review",
  "description": "Monthly review of implementation progress and risks.",
  "start_time": "2026-05-12T10:00:00+02:00",
  "end_time": "2026-05-12T11:00:00+02:00",
  "timezone": "Europe/Warsaw",
  "all_day": false,
  "event_type": "review",
  "source": "implementation",
  "source_calendar_id": "cal_project_001",
  "external_event_id": null,
  "status": "confirmed",
  "visibility": "team",
  "location": "Teams",
  "video_link": "https://teams.microsoft.com/...",
  "attendees": [
    {
      "user_id": "usr_001",
      "email": "anna@example.com",
      "role": "organizer",
      "rsvp": "accepted"
    }
  ],
  "organizer_id": "usr_001",
  "related_objects": [
    {
      "type": "project",
      "id": "proj_001"
    },
    {
      "type": "initiative",
      "id": "init_007"
    }
  ],
  "created_at": "2026-05-09T12:00:00+02:00",
  "updated_at": "2026-05-09T12:30:00+02:00"
}
10.2. ExternalCalendarConnection
{
  "connection_id": "conn_google_001",
  "user_id": "usr_001",
  "provider": "google_calendar",
  "account_email": "user@example.com",
  "status": "connected",
  "scopes": [
    "calendar.events.readonly",
    "calendar.calendarlist.readonly"
  ],
  "sync_direction": "read_only",
  "last_sync_at": "2026-05-09T11:58:00+02:00",
  "token_status": "valid",
  "error_message": null,
  "created_at": "2026-05-01T09:00:00+02:00",
  "updated_at": "2026-05-09T11:58:00+02:00"
}
10.3. CalendarSource
{
  "source_id": "src_tasks",
  "name": "Zadania",
  "source_type": "task_module",
  "color": "#4F46E5",
  "enabled": true,
  "owner_type": "user",
  "owner_id": "usr_001",
  "permissions": {
    "read": true,
    "write": false,
    "share": false
  },
  "sync_status": "internal"
}
10.4. WorkdayPlan
{
  "plan_id": "wdp_2026_05_12_usr001",
  "user_id": "usr_001",
  "date": "2026-05-12",
  "timezone": "Europe/Warsaw",
  "day_summary": "Dzień obciążony: 5h spotkań, 2 decyzje, 3 zadania wysokiego priorytetu.",
  "top_priorities": [
    "Prepare investor update",
    "Approve project decision DEC-44",
    "Review Cloud Migration risks"
  ],
  "scheduled_blocks": [
    "blk_001",
    "blk_002"
  ],
  "unscheduled_tasks": [
    "task_009"
  ],
  "meetings": [
    "evt_001"
  ],
  "decisions_due": [
    "dec_044"
  ],
  "risks": [
    "No preparation block before 14:00 client meeting"
  ],
  "ai_recommendations": [
    "rec_001"
  ],
  "created_at": "2026-05-12T06:00:00+02:00",
  "updated_at": "2026-05-12T07:15:00+02:00"
}
10.5. TimeBlock
{
  "block_id": "blk_001",
  "user_id": "usr_001",
  "title": "Prepare board presentation",
  "block_type": "focus_time",
  "start_time": "2026-05-12T08:30:00+02:00",
  "end_time": "2026-05-12T10:00:00+02:00",
  "source": "ai_generated",
  "related_task_id": "task_101",
  "related_project_id": "proj_009",
  "focus_level": "deep",
  "flexibility": "movable_same_day",
  "reschedule_policy": "requires_user_approval",
  "status": "scheduled"
}
10.6. ScheduledTask
{
  "scheduled_task_id": "st_001",
  "task_id": "task_101",
  "user_id": "usr_001",
  "estimated_duration": 90,
  "scheduled_start": "2026-05-12T08:30:00+02:00",
  "scheduled_end": "2026-05-12T10:00:00+02:00",
  "priority": "high",
  "energy_required": "high",
  "deadline": "2026-05-13T17:00:00+02:00",
  "scheduling_reason": "High priority task with deadline tomorrow and available morning focus slot.",
  "conflict_status": "none",
  "status": "scheduled"
}
10.7. MeetingPreparation
{
  "prep_id": "prep_001",
  "event_id": "evt_001",
  "user_id": "usr_001",
  "meeting_goal": "Decide if phase 2 is ready for steering committee approval.",
  "agenda": [
    "Review implementation progress",
    "Discuss open risks",
    "Confirm required decision",
    "Define next steps"
  ],
  "related_documents": [
    "doc_001",
    "doc_002"
  ],
  "related_tasks": [
    "task_101"
  ],
  "related_decisions": [
    "dec_044"
  ],
  "related_initiatives": [
    "init_007"
  ],
  "suggested_questions": [
    "What is blocking the migration?",
    "Which dependencies are not under control?"
  ],
  "risks_to_raise": [
    "No confirmed owner for integration testing"
  ],
  "context_summary": "Last review identified risk in data migration and missing test owner.",
  "preparation_status": "ready"
}
10.8. MeetingOutcome
{
  "outcome_id": "out_001",
  "event_id": "evt_001",
  "summary": "Team confirmed readiness for limited phase 2 rollout with two open risks.",
  "decisions": [
    {
      "decision_id": "dec_045",
      "title": "Approve limited phase 2 rollout",
      "status": "approved"
    }
  ],
  "action_items": [
    {
      "task_id": "task_201",
      "title": "Assign integration testing owner",
      "owner_id": "usr_004",
      "deadline": "2026-05-14"
    }
  ],
  "follow_ups": [
    {
      "type": "email",
      "target": "project_team",
      "status": "drafted"
    }
  ],
  "documents_created": [
    "doc_minutes_001"
  ],
  "ideas_created": [],
  "next_meeting_suggestion": "2026-05-19T10:00:00+02:00",
  "transcript_id": "tr_001",
  "confidence_score": 0.87,
  "created_at": "2026-05-12T11:15:00+02:00"
}
10.9. CalendarConflict
{
  "conflict_id": "conf_001",
  "user_id": "usr_001",
  "conflict_type": "missing_preparation_time",
  "affected_events": [
    "evt_001"
  ],
  "affected_tasks": [
    "task_101"
  ],
  "severity": "high",
  "reason": "Client meeting has no preparation block and requires review of 3 documents.",
  "ai_recommendation": "Add 45-minute preparation block before the meeting.",
  "resolution_status": "pending_user_approval"
}
10.10. AvailabilityWindow
{
  "window_id": "win_001",
  "user_id": "usr_001",
  "start_time": "2026-05-12T13:00:00+02:00",
  "end_time": "2026-05-12T14:30:00+02:00",
  "duration_minutes": 90,
  "quality_score": 82,
  "recommended_use": "deep_work",
  "constraints": [
    "before_client_meeting",
    "no_travel_required"
  ],
  "source": "computed"
}
10.11. CalendarRecommendation
{
  "recommendation_id": "rec_001",
  "user_id": "usr_001",
  "date": "2026-05-12",
  "recommendation_type": "protect_focus_time",
  "title": "Protect 90 minutes for board presentation",
  "explanation": "The task is high priority, requires deep work, and has a deadline tomorrow.",
  "suggested_action": {
    "action": "create_time_block",
    "start_time": "2026-05-12T08:30:00+02:00",
    "end_time": "2026-05-12T10:00:00+02:00"
  },
  "target_object": {
    "type": "task",
    "id": "task_101"
  },
  "confidence": 0.91,
  "urgency": "high",
  "status": "pending"
}
10.12. CalendarSyncLog
{
  "sync_log_id": "sync_001",
  "connection_id": "conn_google_001",
  "sync_started_at": "2026-05-09T11:58:00+02:00",
  "sync_finished_at": "2026-05-09T11:58:12+02:00",
  "status": "success",
  "events_created": 12,
  "events_updated": 3,
  "events_deleted": 0,
  "errors": [],
  "next_sync_at": "2026-05-09T12:13:00+02:00"
}
10.13. WorkloadSnapshot
{
  "snapshot_id": "load_001",
  "owner_type": "user",
  "owner_id": "usr_001",
  "date_range": {
    "start": "2026-05-12",
    "end": "2026-05-16"
  },
  "total_meeting_hours": 19.5,
  "focus_time_hours": 7,
  "scheduled_task_hours": 12,
  "unscheduled_task_hours": 9,
  "overdue_items": 4,
  "load_score": 78,
  "overload_risk": "high",
  "recommendations": [
    "Move low-priority meeting",
    "Protect 2 additional focus blocks",
    "Convert overdue decision into review slot"
  ]
}
10.14. RecurrenceRule
{
  "recurrence_id": "rr_001",
  "object_id": "evt_001",
  "frequency": "weekly",
  "interval": 1,
  "days_of_week": [
    "tuesday"
  ],
  "day_of_month": null,
  "until": "2026-12-31",
  "exceptions": [
    "2026-06-02"
  ],
  "timezone": "Europe/Warsaw"
}
11. Kluczowe komponenty modułu
11.1. Calendar Home
Cel: szybki obraz dnia i najbliższych ryzyk.
Pokazuje:
dzisiejszy plan,
top 3 priorytety,
następne spotkanie,
zadania dnia,
decyzje do podjęcia,
konflikty,
unscheduled priority tasks,
status integracji Google/Outlook/Apple,
rekomendacje AI.
Nie pokazuje wszystkiego naraz. To nie jest śmietnik terminów.
11.2. Month View
Cel: szeroki obraz miesiąca.
Pokazuje:
wydarzenia,
deadline’y,
inicjatywy,
milestone’y,
decyzje,
dni przeciążone,
dni wolne,
źródła wydarzeń.
11.3. Week View
Cel: realne planowanie tygodnia.
Pokazuje:
spotkania,
focus time,
task blocks,
preparation blocks,
project reviews,
weekly load score,
deadline’y,
konflikty.
11.4. Day View
Najważniejszy widok.
Pokazuje:
timeline dnia,
spotkania,
task blocks,
top 3 priorytety,
decyzje,
preparation blocks,
focus blocks,
unscheduled tasks,
overload warning,
end-of-day review.
Day View powinien być najważniejszą przestrzenią operacyjną, bo to tutaj użytkownik odzyskuje kontrolę nad dniem.
11.5. List / Agenda View
Cel: szybka chronologia.
Pola:
czas,
tytuł,
typ,
źródło,
status,
właściciel,
powiązane obiekty,
akcje.
11.6. External Calendar Integrations
Obsługa:
Google Calendar,
Microsoft Outlook / Graph,
Apple Calendar / CalDAV,
ICS feeds,
shared calendars,
team calendars.
Funkcje:
connect,
reconnect,
revoke,
sync status,
read-only sync,
write mode,
two-way sync,
deduplication,
token refresh,
calendar selection,
privacy mapping.
11.7. AI Daily Planner
AI analizuje:
wydarzenia,
zadania,
decyzje,
priorytety,
deadline’y,
szacowany czas,
energię,
focus windows,
preparation gaps,
conflicts.
Output:
plan dnia,
top priorities,
suggested schedule,
overload warning,
ryzyka,
rekomendacje zmian.
11.8. Task Scheduling Engine
Funkcje:
drag task into calendar,
AI schedule task,
split long task,
protect high priority task,
schedule before deadline,
estimate duration,
detect unrealistic workload,
auto-reschedule only after user approval.
11.9. Meeting Preparation Engine
Dla spotkania przygotowuje:
cel,
agendę,
kontekst,
poprzednie ustalenia,
dokumenty,
zadania,
decyzje,
pytania,
ryzyka,
expected output.
11.10. Meeting Outcome Engine
Po spotkaniu tworzy:
summary,
action items,
decisions,
follow-up tasks,
notes,
documents,
next meeting suggestion,
project update,
optional CRM update.
11.11. Calendar Conflict Engine
Wykrywa:
double booking,
meeting overlap,
no time for priority task,
missing preparation time,
no decision slot,
deadline without work block,
too many meetings,
no focus time,
unrealistic day load,
travel time missing.
11.12. Workload & Capacity Engine
Pokazuje:
meeting hours,
focus time,
scheduled task hours,
unscheduled task hours,
free capacity,
overload risk,
context switches,
team capacity.
11.13. Calendar Source Manager
Źródła:
Tasks,
Initiatives,
Decisions,
Implementation,
Consultify Events,
Google Calendar,
Outlook,
Apple Calendar,
Team Calendar,
Holidays.
Funkcje:
enable/disable,
colors,
permissions,
connection status,
source health.
11.14. Smart Notifications & Reminders
Typy:
upcoming meeting,
preparation needed,
decision overdue,
task not scheduled,
deadline risk,
conflict detected,
weekly review,
end-of-day review,
integration disconnected.
11.15. Calendar AI Chat Actions
Przykładowe komendy:
„Zaplanuj mi dzień.”
„Znajdź czas na przygotowanie oferty.”
„Przełóż mniej ważne taski.”
„Pokaż konflikty.”
„Przygotuj mnie do spotkania o 14:00.”
„Co muszę zrobić przed piątkiem?”
„Zrób weekly review.”
12. Widoki systemu
Widok	Cel	Kluczowe elementy
Calendar Overview	szybki obraz pracy w czasie	today summary, next meeting, conflicts, AI recommendations
Month View	szeroki obraz miesiąca	wydarzenia, deadline’y, milestone’y, dni przeciążone
Week View	planowanie tygodnia	meetings, focus, tasks, weekly load
Day View	zarządzanie dniem	timeline, priorities, tasks, decisions, AI plan
Agenda View	lista chronologiczna	typ, źródło, status, powiązania
Event Detail	karta wydarzenia	attendees, agenda, docs, tasks, decisions, outcome
Meeting Preparation	przygotowanie do spotkania	context, agenda, risks, questions
Workday Planner	projektowanie dnia	open slots, unscheduled tasks, AI schedule
Team Calendar	rytm zespołu	absences, team meetings, overload
Project Calendar	rytm projektu	milestones, gates, reviews, decision points
Integration Settings	zarządzanie połączeniami	provider, scopes, sync status, errors
13. Workflow użytkownika
Poniżej 40 kluczowych workflow. Format jest skrócony, ale wystarczający do rozpisania user stories i testów QA.
ID	Workflow	Trigger	Rola	AI role	Output	Ryzyko	Acceptance criteria
WF-01	User opens Calendar for daily plan	wejście w Kalendarz	każdy	generuje day summary	plan dnia	przeładowanie widoku	widoczne top 3, spotkania, taski, ryzyka
WF-02	Connect Google Calendar	klik Connect	user	brak / walidacja scopes	połączenie	złe scopes	status connected, eventy widoczne
WF-03	Connect Outlook Calendar	klik Connect	user	brak / walidacja tenant	połączenie	admin consent	status connected albo jasny błąd
WF-04	Select visible sources	panel źródeł	user	sugeruje źródła	filtrowany widok	ukrycie ważnych eventów	źródła on/off działają
WF-05	Create manual event	add event	user	sugeruje typ/powiązania	event	brak źródła	event zapisany z source=manual
WF-06	Create event from task	task action	user	proponuje slot	time block	mylenie due date z pracą	task ma scheduled block
WF-07	Create event from decision	decision action	manager	proponuje review	decision slot	brak ownera	event powiązany z decyzją
WF-08	Create initiative review	initiative action	sponsor	proponuje rytm	review event	chaos portfolio	event ma initiative_id
WF-09	Create event from milestone	implementation	PM	proponuje review	milestone event	dublowanie PMO	event linkuje milestone
WF-10	Drag task into calendar	drag & drop	user	waliduje slot	scheduled task	konflikt	blok ma start/end
WF-11	AI schedules task	request	user	wybiera slot	recommendation	nierealny plan	wymaga approval
WF-12	AI splits long task	long task	user	dzieli pracę	kilka bloków	fragmentacja	suma bloków = duration
WF-13	Detect no time for priority	daily plan	System/AI	calculates risk	overdue alert	false positive	pokazuje affected task
WF-14	Suggest moving low-priority work	overload	AI	rekomenduje	reschedule proposal	utrata zaufania	bez automatycznego przesunięcia
WF-15	Protect focus time	weekly plan	AI	blokuje focus	focus blocks	blokuje spotkania	tylko zgodnie z policy
WF-16	Create prep block	meeting without prep	AI	rekomenduje	preparation block	za dużo bloków	prep przed spotkaniem
WF-17	Prepare meeting briefing	przed meetingiem	user	summary	briefing	halucynacje	źródła pokazane
WF-18	Generate agenda	event detail	user	draft	agenda	ogólniki	agenda edytowalna
WF-19	Link event to documents	event detail	user/AI	sugeruje docs	links	błędne linki	user akceptuje
WF-20	Link event to initiative	event detail	user/AI	sugeruje	relation	złe powiązanie	relation widoczne
WF-21	Link event to decision	event detail	user/AI	sugeruje	relation	brak traceability	relation widoczne
WF-22	Link event to task	event detail	user/AI	sugeruje	relation	chaos tasków	relation widoczne
WF-23	Join meeting	meeting time	user	pokazuje context	open link	brak linku	link działa
WF-24	Capture meeting outcome	after meeting	AI/user	summary	outcome	błędne action items	user review
WF-25	Create follow-up tasks	outcome	AI	proponuje tasks	tasks	spam tasków	approval required
WF-26	Create decision from meeting	outcome	AI	extracts decision	decision object	fałszywa decyzja	human confirmation
WF-27	Create note from meeting	outcome	AI	creates note	meeting note	brak źródeł	note linked
WF-28	Suggest next meeting	outcome	AI	proposes slot	event draft	calendar conflict	slot available
WF-29	Detect double booking	sync/planning	AI	conflict	warning	fałszywy konflikt	events listed
WF-30	Detect overloaded day	daily plan	AI	score	overload warning	niejasny score	explainability
WF-31	End-of-day review	koniec dnia	AI	summary	EOD review	zbyt długie	completed/moved/risks
WF-32	Weekly review	piątek/poniedziałek	AI	summary	weekly review	ogólniki	projects/tasks/decisions
WF-33	Manager views team calendar	manager view	manager	workload summary	team rhythm	prywatność	private masked
WF-34	PM views project calendar	project page	PM	rhythm risks	project calendar	PMO duplicate	only time/events
WF-35	Chat plans tomorrow	chat command	user	planner	tomorrow plan	brak zgody	proposal only
WF-36	Find deep work	chat command	user	availability	best slots	ignoruje preferencje	quality score
WF-37	What is at risk this week	chat command	manager	risk scan	risk list	false positives	sources shown
WF-38	Sync error	token expired	system	monitor	alert	brak zaufania	clear reconnect CTA
WF-39	Change privacy	event action	user	validates	privacy update	wyciek danych	visibility changed
WF-40	Handle time zone conflict	invite/sync	AI	detects	warning	błędna godzina	timezone displayed
14. Rola AI w Kalendarzu
AI w tym module to:
AI Workday & Calendar Planner
Nie jest:
pełnym PMO Analyst,
pełnym Project Managerem,
właścicielem decyzji,
task managerem,
autonomicznym sekretarzem bez kontroli użytkownika,
tylko UI assistantem.
Role AI
Rola AI	Opis
Day Planner	planuje dzień użytkownika
Task Scheduler	umieszcza zadania w dostępnych slotach
Focus Protector	chroni czas głębokiej pracy
Meeting Assistant	przygotowuje spotkania i follow-upy
Conflict Detector	wykrywa konflikty
Workload Analyst	ocenia obciążenie
Rhythm Keeper	pilnuje review, decyzji, follow-upów i deadline’ów
Integration Monitor	monitoruje sync i błędy integracji
AI musi odróżniać
event,
meeting,
task,
time block,
deadline,
decision due date,
initiative review,
milestone,
reminder,
focus time,
preparation,
follow-up,
recurring ritual,
project calendar item,
external calendar item.
To jest krytyczne. Bez tej ontologii system zacznie mieszać deadline z pracą, task z meetingiem i PMO z kalendarzem.
15. Wymagania funkcjonalne
Poniżej 130 wymagań funkcjonalnych w formie product backlogu. Priorytet: P0 krytyczne, P1 ważne, P2 późniejsze.
ID	Nazwa	Opis	Priorytet	Acceptance criterion
FR-001	Calendar Home	System pokazuje główny widok kalendarza	P0	Użytkownik widzi plan dnia i źródła
FR-002	Month View	Widok miesięczny wydarzeń	P0	Można przełączyć na miesiąc
FR-003	Week View	Widok tygodniowy	P0	Pokazuje dni tygodnia i eventy
FR-004	Day View	Widok dnia	P0	Pokazuje timeline dnia
FR-005	List View	Chronologiczna lista wydarzeń	P0	Eventy sortowane po czasie
FR-006	Add Event	Tworzenie wydarzenia manualnego	P0	Event zapisany i widoczny
FR-007	Edit Event	Edycja wydarzenia	P0	Zmiany zapisane
FR-008	Delete/Cancel Event	Usuwanie/anulowanie	P0	Event znika lub status cancelled
FR-009	All-day Event	Obsługa eventów całodniowych	P0	Event widoczny w sekcji all-day
FR-010	Recurring Event	Obsługa powtarzalności	P1	RRULE zapisany
FR-011	Recurrence Exceptions	Wyjątki powtarzalności	P1	Pojedyncza instancja może być zmieniona
FR-012	Attendees	Dodawanie uczestników	P1	Lista uczestników widoczna
FR-013	RSVP	Status odpowiedzi	P1	RSVP zapisany
FR-014	Organizer	Organizator wydarzenia	P0	organizer_id zapisany
FR-015	Location	Lokalizacja	P0	location widoczna
FR-016	Video Link	Link Teams/Meet/Zoom	P0	Link otwiera spotkanie
FR-017	Reminders	Przypomnienia	P1	Reminder uruchamia powiadomienie
FR-018	Time Zones	Obsługa stref czasowych	P0	Event pokazuje właściwą godzinę
FR-019	DST Handling	Obsługa zmiany czasu	P0	Recurring event nie przesuwa się błędnie
FR-020	Source Panel	Lewy panel źródeł	P0	Źródła widoczne i przełączalne
FR-021	Source Enable/Disable	Włącz/wyłącz źródło	P0	Widok filtruje eventy
FR-022	Source Color	Kolory źródeł	P1	Kolor widoczny na eventach
FR-023	Source Health	Status źródła	P1	Connected/error/expired
FR-024	Internal Tasks Source	Źródło Zadania	P0	Taski z datą widoczne
FR-025	Internal Decisions Source	Źródło Decyzje	P0	Decyzje z terminem widoczne
FR-026	Internal Initiatives Source	Źródło Inicjatywy	P0	Review widoczne
FR-027	Implementation Source	Źródło Realizacja	P1	Milestone’y widoczne
FR-028	Results Source	Źródło Rezultaty	P2	KPI/ROI review widoczne
FR-029	Finance Source	Źródło Finanse	P2	Budget/ROI deadlines widoczne
FR-030	Google Connect	Połączenie Google Calendar	P0	OAuth działa
FR-031	Google Calendar List	Pobranie listy kalendarzy	P0	Użytkownik wybiera kalendarze
FR-032	Google Read Events	Odczyt eventów Google	P0	Eventy widoczne
FR-033	Google Write Events	Zapis eventów Google	P1	Event tworzy się w Google
FR-034	Google Update Events	Aktualizacja Google event	P1	Zmiana synchronizowana
FR-035	Google Delete/Cancel	Anulowanie Google event	P1	Status zsynchronizowany
FR-036	Google Recurrence	Recurring events Google	P1	Seria widoczna
FR-037	Google Meet Link	Obsługa Meet link	P1	Link zapisany
FR-038	Google Sync Token	Przyrostowa synchronizacja	P1	Nie pobiera pełnego kalendarza
FR-039	Google Sync Error	Obsługa błędu sync	P0	Użytkownik widzi komunikat
FR-040	Outlook Connect	Połączenie Outlook	P0	OAuth działa
FR-041	Outlook Calendar List	Lista kalendarzy Outlook	P0	Kalendarze widoczne
FR-042	Outlook Read Events	Odczyt Outlook events	P0	Eventy widoczne
FR-043	Outlook Write Events	Zapis Outlook events	P1	Event zapisany
FR-044	Outlook Update Events	Aktualizacja Outlook	P1	Zmiana zsynchronizowana
FR-045	Outlook Delta Sync	Delta sync	P1	Przyrostowe zmiany działają
FR-046	Teams Link	Obsługa Teams meeting	P1	Link widoczny
FR-047	Admin Consent State	Obsługa admin consent	P1	Błąd jasno pokazany
FR-048	Apple/CalDAV Connect	Połączenie CalDAV	P2	Użytkownik może dodać konto
FR-049	CalDAV Read	Odczyt CalDAV	P2	Eventy widoczne
FR-050	CalDAV Write	Zapis CalDAV	P2	Event zapisany, jeśli provider pozwala
FR-051	ICS Import	Import ICS	P1	Read-only feed widoczny
FR-052	ICS Refresh	Odświeżanie ICS	P1	Feed aktualizuje się okresowo
FR-053	Deduplication	Usuwanie duplikatów	P0	Ten sam event nie pojawia się 2 razy
FR-054	External Event Mapping	Mapowanie pól eventu	P0	External ID zapisany
FR-055	Privacy Mapping	Mapowanie prywatności	P0	Private event maskowany
FR-056	Busy/Free	Status availability	P1	Busy blokuje slot
FR-057	Read-only Mode	Tryb tylko odczyt	P0	Nie można edytować external event
FR-058	Write Mode	Tryb zapisu	P1	Edycja działa po zgodzie
FR-059	Token Expiry	Wykrycie expiry	P0	Status expired
FR-060	Reconnect Flow	Ponowne połączenie	P0	User może odnowić token
FR-061	Revoke Access	Odłączenie integracji	P0	Token usunięty
FR-062	Calendar Audit	Audyt zmian	P0	Zmiany zapisane w logu
FR-063	Event Detail View	Karta wydarzenia	P0	Widoczne dane i relacje
FR-064	Related Objects	Powiązane obiekty	P0	Event linkuje task/decision/init
FR-065	Link Task	Link taska do eventu	P0	Relacja zapisana
FR-066	Link Decision	Link decyzji do eventu	P0	Relacja zapisana
FR-067	Link Initiative	Link inicjatywy	P0	Relacja zapisana
FR-068	Link Project	Link projektu	P0	Relacja zapisana
FR-069	Link Document	Link dokumentu	P1	Dokument widoczny
FR-070	Create Note from Event	Notatka z wydarzenia	P1	Note linked
FR-071	Create Task from Event	Task z wydarzenia	P1	Task linked
FR-072	Create Decision from Event	Decyzja z wydarzenia	P1	Decision draft
FR-073	Create Follow-up	Follow-up po wydarzeniu	P1	Follow-up task/email
FR-074	Daily Plan	AI plan dnia	P1	Plan generowany
FR-075	Top 3 Priorities	Priorytety dnia	P1	Widoczne top 3
FR-076	Unscheduled Tasks	Lista niezaplanowanych tasków	P1	Taski bez slotu widoczne
FR-077	Open Slots	Dostępne sloty	P1	Sloty liczone
FR-078	Availability Quality	Score slotu	P1	Slot ma quality score
FR-079	AI Schedule Task	AI planuje task	P1	Powstaje proposal
FR-080	Task Duration Estimate	Estymacja czasu	P1	Duration zapisany
FR-081	Split Task	Dzielenie taska	P1	Kilka bloków
FR-082	Move Task Block	Przesunięcie bloku	P0	Blok zmienia czas
FR-083	Complete Block	Oznacz blok jako wykonany	P0	Status completed
FR-084	Partial Completion	Częściowe wykonanie	P2	Pozostały czas przeliczony
FR-085	Focus Time	Blok focus	P1	Focus widoczny
FR-086	Protect Focus	Ochrona focus	P1	AI rekomenduje blok
FR-087	Preparation Block	Blok przygotowania	P1	Prep przed spotkaniem
FR-088	Buffer Time	Bufor	P1	Buffer widoczny
FR-089	Travel Time	Czas dojazdu	P2	Travel block widoczny
FR-090	Breaks	Przerwy	P2	Break block widoczny
FR-091	Meeting Briefing	Briefing spotkania	P1	Agenda/context/questions
FR-092	Agenda Generation	Generowanie agendy	P1	Agenda edytowalna
FR-093	Related Context	Kontekst spotkania	P1	Docs/tasks/decisions
FR-094	Previous Notes	Poprzednie notatki	P1	Last summary widoczne
FR-095	Risks to Raise	Ryzyka do poruszenia	P1	Lista ryzyk
FR-096	Meeting Outcome	Wynik spotkania	P1	Summary/action/decision
FR-097	Transcript Link	Link do transcriptu	P2	Transcript_id zapisany
FR-098	Action Items	Action items	P1	Task drafts
FR-099	Decision Extraction	Decyzje ze spotkania	P1	Decision drafts
FR-100	Follow-up Email Draft	Mail follow-up	P1	Draft utworzony
FR-101	Next Meeting Suggestion	Kolejne spotkanie	P1	Propozycja slotu
FR-102	Conflict Detection	Detekcja konfliktów	P0	Konflikt widoczny
FR-103	Double Booking	Double booking	P0	Ostrzeżenie
FR-104	Missing Prep	Brak przygotowania	P1	Ostrzeżenie
FR-105	No Time for Priority	Brak czasu na priorytet	P1	Ostrzeżenie
FR-106	Decision Without Slot	Decyzja bez slotu	P1	Ostrzeżenie
FR-107	Deadline Without Work	Deadline bez pracy	P1	Ostrzeżenie
FR-108	Overload Warning	Przeciążenie dnia	P1	Load score
FR-109	Workload Snapshot	Snapshot obciążenia	P1	Score i godziny
FR-110	Team Calendar	Widok zespołu	P2	Team events visible
FR-111	Team Capacity	Capacity zespołu	P2	Workload per user
FR-112	Private Masking	Maskowanie prywatnych	P0	Manager nie widzi details
FR-113	Project Calendar	Widok projektu	P1	Milestones/reviews/gates
FR-114	Project Review Rhythm	Rytm review	P1	Recurring reviews
FR-115	Weekly Review	Weekly review	P1	Summary tygodnia
FR-116	End-of-Day Review	EOD review	P1	Completed/moved/risks
FR-117	Notifications	Powiadomienia	P1	Trigger działa
FR-118	Reminder Settings	Ustawienia przypomnień	P1	User config
FR-119	Integration Alert	Alert rozłączenia	P0	Alert + CTA
FR-120	AI Recommendation Queue	Kolejka rekomendacji	P1	Accept/reject
FR-121	Approval Required	Zgoda na akcje AI	P0	Bez zgody brak write
FR-122	Explain AI Recommendation	Wyjaśnienie AI	P0	Explanation visible
FR-123	Source Attribution	Źródła rekomendacji	P0	Linked evidence
FR-124	Chat Plan Day	Teresa planuje dzień	P1	Chat returns plan
FR-125	Chat Find Time	Teresa znajduje slot	P1	Slot proposal
FR-126	Chat Reschedule	Teresa proponuje zmiany	P1	Approval flow
FR-127	Chat Prepare Meeting	Teresa generuje briefing	P1	Briefing saved
FR-128	PL/EN UI	Interfejs PL/EN	P1	Language switch
FR-129	Mobile Calendar	Widok mobile	P2	Responsive view
FR-130	Offline/Error State	Stany błędów	P0	Clear empty/error state
16. Wymagania niefunkcjonalne
ID	Obszar	Wymaganie	Acceptance criterion
NFR-001	Performance	Month view ładuje się szybko	initial render < 2s dla 1000 eventów
NFR-002	Performance	Day view ładuje się bardzo szybko	render < 1s dla 200 eventów
NFR-003	Sync	Sync odporny na błędy API	retry + backoff
NFR-004	Sync	Idempotencja synchronizacji	brak duplikatów po retry
NFR-005	Security	Tokeny OAuth szyfrowane	encryption at rest
NFR-006	Security	Tokeny nigdy nie idą do LLM	blocked by architecture
NFR-007	Privacy	Private event masked	title/details ukryte
NFR-008	Tenant isolation	Dane tenantów odseparowane	test cross-tenant fails
NFR-009	RBAC	Role-based access	manager nie widzi prywatnych eventów
NFR-010	Audit	Każda zmiana zapisana	audit log dostępny
NFR-011	AI Safety	AI nie wykonuje write bez approval	approval gate
NFR-012	AI Explainability	Rekomendacja ma wyjaśnienie	explanation required
NFR-013	Hallucination prevention	AI korzysta z linked context	no unsupported claims
NFR-014	Time zones	Obsługa globalnych stref	test Europe/US/Asia
NFR-015	DST	Obsługa zmiany czasu	recurring event stable
NFR-016	Accessibility	WCAG baseline	keyboard + screen reader
NFR-017	Observability	Sync logs i error logs	dashboard/log stream
NFR-018	Availability	Graceful degradation	external sync fail nie psuje UI
NFR-019	Scalability	Wielu użytkowników i kalendarzy	load test
NFR-020	Localization	PL/EN	pełne tłumaczenia
NFR-021	Data minimization	Pobieramy tylko potrzebne pola	scope review
NFR-022	Compliance	Enterprise policy ready	DPA/security docs
NFR-023	Mobile	Responsive day/list	mobile usable
NFR-024	QA	Testowalność sync i AI	mocks + fixtures
NFR-025	Disaster recovery	Backup i restore	recovery tested
Security powinien być traktowany jako część architektury, nie późniejszy dodatek. Digital Pathfinder opisuje cyberbezpieczeństwo jako fundament zaufania, prywatności i odporności operacyjnej, obejmujący strategię, ochronę systemów, data security, edukację i emergency planning. Dla Kalendarza szczególnie ważne są szyfrowanie, access controls, monitoring, identity verification i minimalizacja danych.
17. Modele scoringu
17.1. Day Load Score
Cel: ocena przeciążenia dnia.
Składniki:
total meeting hours,
scheduled task hours,
unscheduled priority tasks,
context switches,
missing breaks,
overdue work,
preparation gaps.
Interpretacja:
Score	Znaczenie
0–30	dzień lekki
31–60	dzień normalny
61–80	dzień obciążony
81–100	dzień przeciążony
Przykładowa formuła:
Day Load Score =
meeting_hours_score * 0.25 +
scheduled_work_score * 0.20 +
unscheduled_priority_score * 0.20 +
context_switch_score * 0.10 +
missing_breaks_score * 0.10 +
overdue_score * 0.10 +
preparation_gap_score * 0.05
17.2. Focus Availability Score
Mierzy realny czas na deep work.
Składniki:
continuous free blocks,
meeting fragmentation,
protected focus blocks,
interruptions,
energy preference fit.
17.3. Meeting Preparedness Score
Mierzy gotowość do spotkania.
Składniki:
agenda exists,
objective exists,
documents linked,
previous notes linked,
decisions identified,
questions prepared,
preparation block scheduled.
17.4. Scheduling Risk Score
Mierzy ryzyko rozsypania dnia lub tygodnia.
Składniki:
overload,
double bookings,
no buffer,
too many deadlines,
overdue tasks,
missing owners,
external calendar conflicts.
17.5. Task Scheduling Fit Score
Mierzy, czy task pasuje do slotu.
Składniki:
duration fit,
deadline urgency,
energy requirement,
context similarity,
priority,
dependency readiness,
interruption risk.
17.6. Weekly Rhythm Score
Mierzy zdrowie rytmu tygodnia.
Składniki:
balance meetings/focus,
review rituals,
planning rituals,
follow-up completion,
decision slots,
project cadence,
overload distribution.
18. Statusy i klasyfikacje
18.1. Event types
meeting,
task_block,
focus_time,
preparation,
review,
workshop,
decision_session,
milestone,
deadline,
reminder,
travel,
break,
out_of_office,
personal,
external_event,
project_event,
team_event.
18.2. Source types
internal_consultify,
external_calendar,
task_module,
decision_module,
initiative_module,
implementation_module,
results_module,
finance_module,
inbox,
manual,
ai_generated.
18.3. Event statuses
scheduled,
tentative,
confirmed,
cancelled,
completed,
missed,
needs_preparation,
waiting_for_rsvp,
conflict,
reschedule_suggested.
18.4. Task scheduling statuses
unscheduled,
scheduled,
partially_scheduled,
overdue,
at_risk,
completed,
moved,
blocked.
18.5. Sync statuses
connected,
disconnected,
expired,
error,
syncing,
read_only,
write_enabled,
permission_limited.
18.6. AI recommendation types
schedule,
reschedule,
prepare,
protect_focus,
add_buffer,
reduce_meetings,
create_follow_up,
create_decision,
create_task,
create_note,
reconnect_calendar,
resolve_conflict.
19. Integracje zewnętrzne
19.1. Google Calendar
Zakres MVP:
OAuth,
calendar list,
read events,
event mapping,
recurring events read,
source selection,
read-only sync,
sync errors,
reconnect.
Zakres rozszerzony:
write events,
update events,
delete/cancel,
attendees,
reminders,
Google Meet link,
sync tokens,
webhook/watch channels,
deduplication.
W Google Calendar recurring events są oparte o reguły RFC 5545, więc Consultify musi mieć wewnętrzny model RecurrenceRule, który potrafi mapować RRULE, RDATE, EXDATE i exceptions.
19.2. Microsoft Outlook / Microsoft Graph
Zakres MVP:
OAuth,
read events,
calendars,
calendarView,
read-only sync,
token refresh,
reconnect,
admin consent handling.
Zakres rozszerzony:
write events,
update,
delta sync,
Teams link,
attendees,
shared calendars,
enterprise tenant permissions.
Microsoft Graph delta query jest ważny, bo pozwala synchronizować zmiany przyrostowo, zamiast pobierać cały zakres wydarzeń za każdym razem.
19.3. Apple Calendar / CalDAV
Zakres:
CalDAV,
app-specific passwords,
read/write limitations,
recurring events,
sync complexity,
private calendar handling.
Rekomendacja: dopiero po Google i Outlook.
19.4. ICS feeds
Zakres:
read-only import,
refresh frequency,
no writeback,
source labeling,
duplicate handling.
19.5. Meeting platforms
Integracje docelowe:
Microsoft Teams,
Google Meet,
Zoom,
Fireflies,
Fathom,
Otter,
Read.ai.
Zakres:
link spotkania,
transcript reference,
summary import,
action item import,
meeting outcome creation.
20. Integracje wewnętrzne Consultify
Moduł	Integracja
Tasks	task due date, scheduled task, time block, completion
Decisions	decision due date, decision review, decision briefing
Initiatives	initiative review, approval event, milestone
Implementation	project milestones, gates, steering committees
Results	KPI review, ROI review, benefits realization review
Finance	budget review, financial model deadline, approval
Inbox	incoming invite, suggested follow-up, alert
Documents	agenda, minutes, briefing, source docs
Outputs	daily plan, weekly review, follow-up email
Workbench	otwarcie artifactu obok eventu
Manager	team workload, overload, critical reviews
Teresa Chat	natural-language calendar actions
21. Rekomendacje wdrożeniowe
21.1. Zasada główna
Nie zaczynać od „magicznego AI”. Zacząć od poprawnej ontologii czasu.
Najpierw muszą istnieć:
event,
source,
relation,
time block,
task schedule,
decision due date,
meeting preparation,
meeting outcome,
conflict,
recommendation,
sync log.
Dopiero potem AI powinno planować dzień.
21.2. AI Daily Planner nie może robić wszystkiego
AI Daily Planner powinien:
analizować realną pojemność dnia,
wskazywać top 3,
proponować sloty,
ostrzegać przed przeciążeniem,
tworzyć rekomendacje,
wymagać akceptacji przy zmianach.
Nie powinien:
automatycznie przesuwać ważnych spotkań,
tworzyć wielu tasków bez zgody,
planować dnia bez duration i priority,
ignorować prywatnych wydarzeń,
ignorować working hours,
mieszać deadline’u z blokiem pracy.
21.3. Każda funkcja powinna mieć DoD
Przykład dla AI Daily Planner:
DoD:
plan uwzględnia spotkania zewnętrzne,
plan uwzględnia zadania high priority,
plan pokazuje unscheduled work,
plan pokazuje overload warning,
plan ma wyjaśnienie,
plan nie wykonuje zmian bez approval,
plan działa dla PL/EN,
plan ma testy na konflikty i time zones.
22. Roadmapa MVP
MVP 1 — Calendar Foundation
Zakres:
month/week/day/list views,
manual events,
source filters,
Tasks/Decisions/Initiatives as sources,
simple event detail,
add event,
source colors,
empty states.
DoD:
Użytkownik widzi wewnętrzne obiekty Consultify w kalendarzu i może tworzyć wydarzenia.
MVP 2 — External Calendar Sync
Zakres:
Google Calendar read-only,
Outlook read-only,
connection status,
source panel,
sync errors,
reconnect,
token expiry handling,
private event masking.
DoD:
Użytkownik widzi spotkania z Google/Outlook w Consultify.
MVP 3 — Two-Way Calendar
Zakres:
create/update events in external calendars,
attendees,
reminders,
video links,
recurring events,
conflict handling,
deduplication.
DoD:
Użytkownik może zarządzać wydarzeniami z Consultify i synchronizować je z kalendarzem zewnętrznym.
MVP 4 — AI Day Planner
Zakres:
daily plan,
top priorities,
unscheduled tasks,
time blocking,
focus time,
overload warning,
recommendation queue.
DoD:
AI potrafi zaproponować realistyczny plan dnia z wyjaśnieniem i bez automatycznych zmian bez zgody.
MVP 5 — Meeting Preparation
Zakres:
event context,
agenda,
related docs,
related tasks,
related decisions,
meeting briefing,
preparation block.
DoD:
Każde ważne spotkanie może mieć przygotowanie AI.
MVP 6 — Meeting Outcomes
Zakres:
meeting summary,
action items,
follow-up tasks,
decisions,
notes,
next meeting suggestion.
DoD:
Po spotkaniu system tworzy konkretne obiekty pracy po akceptacji użytkownika.
MVP 7 — Project & Team Calendar
Zakres:
project calendar,
team calendar,
milestones,
gates,
workload,
manager view,
private masking.
DoD:
Manager widzi rytm pracy zespołu i projektów bez naruszania prywatności.
MVP 8 — Advanced Scheduling Intelligence
Zakres:
auto-reschedule proposals,
task splitting,
smart buffers,
meeting optimization,
weekly rhythm,
capacity prediction,
energy-aware planning.
DoD:
Kalendarz działa jak inteligentny planner pracy, ale z governance i approval flow.
23. Ryzyka produktowe i techniczne
Ryzyko	Wpływ	Prawdopodobieństwo	Mitigacja	Decyzja architektoniczna
Kopia Google Calendar	wysokie	średnie	mocna rola workday engine	nie budować tylko siatki dat
Drugi task manager	wysokie	wysokie	task jako time block	źródłem prawdy zostaje Zadania
Drugi PMO	wysokie	średnie	tylko rytm i czas	źródłem prawdy zostaje Realizacja
Przeładowanie widoku	wysokie	wysokie	progressive disclosure	Day View selektywny
Nierealny plan AI	wysokie	średnie	scoring + explanation	AI tworzy proposal
AI przesuwa bez zgody	bardzo wysokie	średnie	approval gate	write actions wymagają akceptacji
Zawodny sync	wysokie	wysokie	retry, logs, status	sync jako osobny subsystem
Duplikaty eventów	średnie	wysokie	external_event_id + hash	dedup engine
Ujawnienie private event	bardzo wysokie	średnie	privacy masking	private by design
Błędy timezone/DST	wysokie	średnie	timezone library + tests	każdy event ma timezone
Brak zaufania do AI	wysokie	wysokie	explainability	każda rekomendacja ma reason
API limits	średnie	średnie	batching, delta sync	provider abstraction
Deadline mylony z blokiem pracy	wysokie	wysokie	oddzielne typy	Deadline ≠ TimeBlock
Task mylony z eventem	wysokie	wysokie	ScheduledTask jako relacja	Task ≠ CalendarEvent
Brak source truth	wysokie	średnie	każde event ma source	source required
Manager widzi za dużo	bardzo wysokie	średnie	RBAC + masking	private details hidden
Wolny kalendarz	wysokie	średnie	caching, pagination	precomputed views
Chaos follow-upów	średnie	wysokie	approval + grouping	no auto-spam
Brak governance AI-generated events	wysokie	średnie	audit + approval	ai_generated source
Brak powiązania z priorytetami	wysokie	średnie	priority model	AI uses tasks/decisions/projects
24. Decyzja architektoniczna
Consultify Calendar nie powinien być:
zwykłym kalendarzem miesięcznym,
samą integracją Google/Outlook,
samym task plannerem,
samym PMO timeline,
samym meeting notes hub,
samym personal productivity system.
Powinien być:
AI Workday & Project Calendar Engine.
Czyli:
częściowo kalendarz,
częściowo planner dnia,
częściowo task scheduler,
częściowo meeting assistant,
częściowo project calendar,
częściowo team rhythm engine,
częściowo integration hub.
Ale granice są twarde:
Zadania pozostają źródłem prawdy dla tasków.
Decyzje pozostają źródłem prawdy dla decyzji.
Inicjatywy pozostają źródłem prawdy dla portfolio.
Realizacja pozostaje źródłem prawdy dla PMO.
Manager pozostaje źródłem prawdy dla zarządzania zespołem.
Kalendarz pokazuje te obiekty w czasie i pomaga nimi operować w rytmie dnia, tygodnia i projektu.
25. Finalna definicja produktu
Consultify Calendar to osobiste i projektowe centrum czasu pracy w Consultify, które integruje zewnętrzne kalendarze użytkownika z zadaniami, decyzjami, inicjatywami, projektami, spotkaniami i dokumentami, aby pomagać planować dzień, wskazywać priorytety, zarządzać zadaniami przez time blocking, przygotowywać użytkownika do spotkań, tworzyć follow-upy po spotkaniach, wykrywać konflikty, chronić focus time, pokazywać przeciążenie i utrzymywać rytm projektowy. Nie jest kopią Google Calendar, nie jest task managerem, nie jest PMO i nie zastępuje modułów Zadania, Decyzje, Inicjatywy ani Realizacja. Jest warstwą orkiestracji czasu i pracy, której celem jest zamiana kalendarza z widoku zajętości w system wykonania.
26. Najważniejsze zasady projektowe dla Consultify Calendar
Kalendarz nie jest tylko siatką dat.
Kalendarz nie jest kopią Google Calendar.
Kalendarz nie jest task managerem.
Kalendarz nie jest PMO boardem.
Kalendarz pokazuje pracę w czasie.
Kalendarz integruje kalendarze zewnętrzne i wewnętrzne obiekty Consultify.
Każde wydarzenie musi mieć źródło.
Każdy task w kalendarzu musi być time blockiem, nie tylko zadaniem.
Deadline nie jest tym samym co blok pracy.
Spotkanie bez przygotowania jest ryzykiem.
Decyzja bez slotu czasowego jest ryzykiem.
Zadanie bez czasu wykonania jest tylko intencją.
AI plan dnia musi być realistyczny.
AI nie może przesuwać ważnych wydarzeń bez zgody użytkownika.
Prywatne wydarzenia muszą być chronione.
Integracje z Google/Outlook muszą mieć jasny status.
Synchronizacja musi obsługiwać błędy i duplikaty.
Kalendarz musi obsługiwać time zones.
Kalendarz musi obsługiwać DST.
Kalendarz musi pokazywać przeciążenie.
Kalendarz musi chronić focus time.
Kalendarz musi pomagać przygotować spotkania.
Kalendarz musi tworzyć follow-upy po spotkaniach.
Kalendarz musi łączyć wydarzenia z zadaniami, decyzjami, inicjatywami i dokumentami.
Kalendarz musi wspierać daily planning.
Kalendarz musi wspierać weekly review.
Kalendarz powinien pokazywać najważniejsze sprawy dnia, nie wszystko naraz.
Kalendarz powinien zmniejszać chaos, a nie go wizualizować.
Kalendarz powinien być spokojny, selektywny i decyzyjny.
Kalendarz powinien pomagać użytkownikowi odzyskać kontrolę nad dniem.
Kalendarz ma zamieniać czas w wykonanie, a nie tylko pokazywać zajętość.
27. Finalna mantra projektowa
Consultify Calendar nie pokazuje, że jesteś zajęty. Consultify Calendar pomaga zdecydować, co realnie trzeba zrobić i kiedy.
