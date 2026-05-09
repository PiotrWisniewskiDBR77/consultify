---
uiux_doc_id: UIUX_RAW_IDEA_NOTEBOOK_CONTEXT_ENGINE_2026_05_09
doc_kind: RAW_REFERENCE
version: 1.0
owner: user
status: raw
last_updated: 2026-05-09
---

# Raw input — Idea Notebook / AI Context Notebook Engine (2026-05-09)

Poniżej: surowe założenia autora (produkt + architektura) wklejone **verbatim**.  
Cel: materiał wejściowy do AUTHOR_CANON dla `Consultify Idea Notebook` (AI Context Notebook Engine).

---

## VERBATIM

Consultify Idea Notebook / AI Context Notebook Engine  
Dokument produktowo-architektoniczny dla modułu Idee / Inicjatywy

1. Executive summary  
Consultify Idea Notebook powinien być jednym z kluczowych silników Consultify, bo odpowiada za moment, w którym myśl jeszcze nie jest projektem, dokumentem, zadaniem ani inicjatywą — ale może się nimi stać.  
To nie ma być zwykły notatnik. To ma być AI Context Notebook Engine: system szybkiego przechwytywania, organizowania, wzbogacania i przekształcania myśli w kontekst, idee, inicjatywy, taski i artifacty Consultify.  
W klasycznych narzędziach notatka jest głównie tekstem. W Consultify notatka powinna być jednocześnie:  
osobistym zapisem myśli,  
źródłem kontekstu dla AI,  
zalążkiem idei,  
potencjalną inicjatywą,  
elementem pamięci projektu,  
wejściem do procesu decyzyjnego,  
surowym materiałem do dokumentów,  
surowym materiałem do prezentacji,  
surowym materiałem do tabel,  
triggerem dla zadań,  
elementem researchu,  
elementem discovery,  
elementem transformacji organizacji.  
Najważniejszy problem do rozwiązania jest bardzo praktyczny: użytkownik ma myśl, obserwację, problem, pomysł lub wniosek w przypadkowym momencie i nie może tego zgubić. System ma pozwolić zapisać tę myśl w kilka sekund, a potem samodzielnie pomóc ją zrozumieć, skategoryzować, połączyć z kontekstem i rozwinąć.  
To podejście jest spójne z logiką Digital Pathfinder, gdzie transformacja jest traktowana jako proces, a nie jednorazowy projekt. Digital Roadmap zakłada cykliczne ocenianie, aktualizowanie inicjatyw i dostosowywanie planu do zmian technologicznych, rynkowych i organizacyjnych; w książce podkreślasz, że transformacja „will now never truly end” i że plan może wymagać modyfikacji już po kilku miesiącach.  
W tym sensie Idea Notebook jest operacyjną pamięcią transformacji: ma łapać mikroobserwacje, które później mogą zmienić roadmapę, priorytet, inicjatywę, dokument, ofertę, workshop albo decyzję.

2. Benchmark rynku  
2.1. Główna obserwacja rynkowa  
Rynek idzie od:  
notes as text storage  
do  
notes as personal knowledge base  
dalej do  
notes as AI memory  
Consultify powinien pójść krok dalej:  
notes as idea-to-initiative context engine  
Obecne narzędzia robią fragmenty tej układanki bardzo dobrze. Notion rozwija workspace, bazy, AI, agentów, enterprise search i automatyczne uzupełnianie baz; Microsoft Loop buduje komponenty i workspace’y osadzone w Microsoft 365; Confluence wzmacnia wiedzę zespołową, whiteboardy i Rovo AI; Slack Canvas zamienia rozmowy w trwałe treści; Obsidian/Roam/Logseq/Tana rozwijają networked thinking; Mem.ai, Reflect i Capacities idą w stronę AI-native memory. Żadne z nich nie jest jednak naturalnie zaprojektowane jako silnik konsultingowy, który prowadzi myśl od szybkiego capture do inicjatywy, artifactu, zadania, memory candidate i governance.

2.2. A. Notion-like workspaces  
Narzędzia: Notion, Coda, Craft, Slite, Confluence, Microsoft Loop, Dropbox Paper, Slack Canvas  
Fakty z dokumentacji / rynku  
Notion pozycjonuje się jako AI workspace: obejmuje dokumenty, projekty, knowledge base, enterprise search, integracje, AI Meeting Notes, Notion Mail i agentów. Notion AI może korzystać z treści workspace’u, konektorów takich jak Slack czy Google Drive oraz z informacji z internetu; Notion rozwija też Custom Agents oraz AI Autofill dla baz danych.  
Microsoft Loop opiera się na workspace’ach i komponentach osadzonych w ekosystemie Microsoft 365; dokumentacja Microsoft opisuje permissioning Loop workspace’ów, właścicieli, workspaces oparte o Microsoft 365 groups oraz przechowywanie plików Loop w OneDrive, SharePoint lub SharePoint Embedded.  
Confluence jest workspace’em do tworzenia i dzielenia się wiedzą zespołową; Atlassian rozwija Rovo/AI do draftowania, podsumowywania, odpowiadania na pytania i pracy na whiteboardach, w tym grupowania podobnych treści i generowania pomysłów.  
Slack Canvas pozwala tworzyć dokumenty osadzone w Slacku, powiązane z kanałem albo niezależne; Slack AI może pomagać w tworzeniu project briefów, meeting notes i podsumowań z rozmów.  
monday workdocs oferuje wspólne dokumenty do planowania, brainstormingu i realizacji pracy, a monday Sidekick generuje tekst, rozwija treści, upraszcza je i podsumowuje.  
ClickUp Docs z Brain AI pozwala pracować na dokumentach, tworzyć executive summaries, generować action items i zadawać pytania do wiedzy z Docs, tasków, komentarzy i wiki w workspace.  
Linear documents są silnie powiązane z projektami, specs, PRD i status updates, a project overview pozwala trzymać opis, summary, linki i dokumenty w jednym miejscu projektu.  
Obserwacje produktowe  
Notion-like workspace’y są mocne w:  
stronach,  
dokumentach,  
blokach,  
bazach danych,  
współpracy,  
template’ach,  
wiki,  
projektach,  
AI writing,  
AI search,  
permissions na poziomie enterprise.  
Są słabsze w:  
ultralekkim capture bez struktury,  
autonomicznym przekształcaniu luźnej myśli w inicjatywę,  
domenowej interpretacji notatki jako elementu consulting execution,  
kontrolowanym memory candidate workflow,  
źródłowym śledzeniu, z której notatki powstała inicjatywa,  
odróżnianiu notatki prywatnej, projektowej, klientowej i organizacyjnej jako pierwszorzędnych obiektów systemu.  
Wniosek architektoniczny dla Consultify  
Consultify powinien inspirować się elastycznością Notion, ale nie kopiować go 1:1. Notion jest general-purpose workspace. Consultify ma być domain-aware consulting execution system. Dlatego pierwszym produktem nie powinien być pełny workspace/wiki, tylko notatka jako obiekt operacyjny: capture → enrichment → context linking → idea extraction → initiative conversion → artifact generation → governance.

2.3. B. Personal knowledge management tools  
Narzędzia: Obsidian, Roam Research, Logseq, Tana, Capacities, Heptabase, Reflect, Bear, Supernotes  
Fakty z dokumentacji / rynku  
Obsidian promuje linkowanie notatek, tworzenie własnej „personal Wikipedia”, graf połączeń, lokalne pliki i elastyczne zastosowania od journalingu po knowledge base i project management.  
Roam Research opisuje się jako narzędzie do networked thought, łączące prostotę dokumentu/bullet listy z mocą grafowej bazy do znajdowania i łączenia powiązanych idei.  
Logseq pozycjonuje się jako privacy-first, open-source knowledge base; repozytorium Logseq opisuje nacisk na privacy, longevity, user control, Markdown/Org-mode, PDF annotation, task management i collaboration.  
Tana rozwija model knowledge graph + outliner + supertags. Supertags zamieniają notatki w obiekty typu Project, Person, Task, Book lub Recipe; Tana AI obsługuje voice memos, automatyczne łączenie informacji z knowledge base i workflow od thought do webpage.  
Capacities organizuje wiedzę jako connected objects zamiast plików i folderów; AI Assistant może pracować na bogatszym kontekście z całej przestrzeni i pokazywać, które notatki zostały użyte do odpowiedzi.  
Reflect używa GPT-4 i Whisper do poprawy pisania, organizowania myśli i działania jako „intellectual thought partner”; aplikacja pozwala szybko notować idee, meeting notes i voice memos oraz rozmawiać z notatkami przez AI.  
Obserwacje produktowe  
PKM tools są mocne w:  
backlinkach,  
graph view,  
daily notes,  
atomic notes,  
markdown/local-first,  
networked thinking,  
prywatności,  
pracy indywidualnej,  
elastycznym modelu wiedzy.  
Są słabsze w:  
enterprise collaboration,  
permissions i audit trail,  
workflow biznesowym,  
powiązaniu z CRM, projektami, taskami i artifactami,  
formalnym przekształcaniu idei w inicjatywę,  
operacyjnym ownership, statusie, KPI i roadmapie,  
pracy consultingowej z klientem, zespołem i projektem.  
Wniosek dla Consultify  
Consultify powinien wziąć z PKM: backlinki, graph, daily/weekly notes, atomic capture, semantic search, object thinking. Ale musi dodać coś, czego PKM nie ma: business object lifecycle. Notatka nie tylko istnieje w grafie. Ona może dojrzeć do decyzji, taska, inicjatywy, dokumentu, tabeli lub prezentacji.

2.4. C. Quick capture note apps  
Narzędzia: Apple Notes, Google Keep, Evernote, OneNote  
Fakty z dokumentacji / rynku  
Google Keep pozwala szybko tworzyć notatki, listy, zdjęcia, rysunki i audio, organizować je etykietami i kolorami, współdzielić na urządzeniach oraz automatycznie transkrybować voice memos; wyszukiwanie może filtrować po tekście, kolorach, etykietach i typach notatek.  
Apple Notes obsługuje nagrywanie audio bezpośrednio w notatce, live transcripts i searchable transcripts, co wzmacnia capture spotkań i myśli głosowych.  
Evernote rozwija AI Assistant, AI Meeting Notes, Semantic Search, document scanning, tasks, calendar i integracje; AI Meeting Notes może nagrywać, transkrybować i podsumowywać.  
OneNote z Copilotem pomaga rozumieć, tworzyć i przywoływać informacje na podstawie notatek i promptu; Microsoft opisuje też transkrypcję nagrań z rozdzieleniem mówców i możliwością zapisania transkryptu jako dokumentu Word.  
Obserwacje produktowe  
Quick capture apps są mocne w:  
szybkości,  
prostocie,  
mobile UX,  
voice capture,  
OCR/scanning,  
krótkich listach,  
synchronizacji urządzeń,  
prostym przypominaniu.  
Są słabsze w:  
pracy projektowej,  
lifecycle od notatki do inicjatywy,  
linkowaniu z klientem/projektem/artifactami,  
enterprise governance,  
semantycznej deduplikacji idei,  
strategicznym wzbogacaniu notatki,  
pracy zespołowej w procesie konsultingowym.  
Wniosek dla Consultify  
Consultify musi być szybki jak Google Keep, ale inteligentny i kontekstowy jak enterprise AI system. Quick capture nie może wymagać kategorii, formularza ani decyzji. Najpierw zapis. Potem porządkowanie.

2.5. D. AI-native note and memory tools  
Narzędzia: Mem.ai, Notion AI, Reflect AI, Tana AI, Capacities AI, Obsidian AI plugins, Readwise Reader, AI meeting note tools  
Fakty z dokumentacji / rynku  
Mem.ai pozycjonuje się jako AI thought partner i notes app, która pomaga organizować pracę zespołu od meeting notes po projects i knowledge bases, a treści są searchable and discoverable. Mem umożliwia capture przez voice, meetings, web clipping i mobile messages.  
Readwise Reader rozwija AI Ghostreader, który działa jako asystent czytania, pomagając uzyskać kontekst i pracować z treścią bez przełączania aplikacji. Reader mocno akcentuje highlights i annotations jako pierwszorzędne elementy workflow czytelniczego.  
Capacities AI wzmacnia rozmowę z własną wiedzą i pokazuje źródła/notatki użyte do odpowiedzi, co jest ważnym wzorcem dla traceability AI.  
Tana AI idzie w stronę „copilot to coworker”: voice memos, automatyczne follow-upy, automatyczne łączenie informacji z knowledge base i praca na grafie wiedzy.  
Obserwacje produktowe  
AI-native tools są mocne w:  
auto-tagging,  
summarization,  
semantic search,  
chat with notes,  
resurfacing,  
voice-to-note,  
auto-linking,  
AI writing.  
Są słabsze w:  
enterprise audit,  
approval workflow,  
memory governance,  
rozdzieleniu faktów i hipotez,  
transparentnym confidence score,  
convert-to-initiative,  
convert-to-artifact,  
powiązaniu z modelem konsultingowym,  
odporności na produkowanie sztucznych inicjatyw.  
Wniosek dla Consultify  
Consultify powinien przejąć AI-native capture i resurfacing, ale musi mieć twardszą warstwę: source references, confidence score, approval status, permissioning, memory candidate workflow i audit trail. AI ma być operatorem notatnika, ale nie właścicielem prawdy.

2.6. E. Enterprise knowledge and project tools  
Narzędzia: Confluence, ClickUp Docs, Asana project briefs, monday workdocs, Linear docs, Slack canvas, Jira/Confluence  
Fakty z dokumentacji / rynku  
Asana rozwija AI Teammates i opisuje ich jako narzędzia do praktycznych zadań w pracy, od szybkich działań po power-user workflows; Asana opisuje także project brief jako krótki dokument streszczający goals, scope, timeline i target audience projektu.  
ClickUp Brain AI może odpowiadać na pytania na podstawie Docs, wikis, tasks i comments w workspace, co pokazuje kierunek „AI over work graph”.  
Linear documents i project overview pokazują silny wzorzec: dokumenty muszą żyć blisko projektów, issues, milestones i status updates, a nie w oderwanym repozytorium.  
Obserwacje produktowe  
Enterprise project tools są mocne w:  
ownership,  
statusach,  
task conversion,  
project briefs,  
współpracy,  
permissions,  
integracji z procesami projektowymi,  
alignment zespołu.  
Są słabsze w:  
indywidualnym szybkim capture,  
prywatnej pamięci użytkownika,  
elastycznym notowaniu myśli,  
autonomicznym enrichmencie,  
rozpoznawaniu idei przed powstaniem projektu,  
wykorzystaniu notatki jako surowca do wielu typów artifactów.  
Wniosek dla Consultify  
Consultify musi połączyć prywatny, szybki notebook z enterprise project discipline. Notatka może zacząć jako prywatna myśl, ale później może zostać przekazana do projektu, klienta, taska, inicjatywy albo dokumentu — z kontrolą użytkownika.

2.7. F. Idea and innovation management tools  
Narzędzia: Productboard, Aha!, Jira Product Discovery, Miro, FigJam, Mural, customer research repositories, innovation platforms  
Obserwacje produktowe  
Idea management tools są mocne w:  
zbieraniu pomysłów,  
voting,  
scoring,  
priorytetyzacji,  
roadmapie,  
customer feedback,  
product discovery,  
warsztatach,  
brainstorming boards.  
Są słabsze w:  
codziennym osobistym notowaniu,  
natychmiastowym capture,  
prywatnych myślach,  
transkrypcji i luźnych obserwacjach,  
memory governance,  
linkowaniu do dokumentów, tabel, prezentacji i klienta jako jednego systemu,  
pracy konsultingowej, gdzie insight może dotyczyć procesu, kultury, KPI, ryzyka, sales, marketingu, finansów lub technologii.  
Wniosek dla Consultify  
Consultify nie powinien zaczynać od „tablicy pomysłów”. Powinien zaczynać od notatki jako źródła idei. Idea board jest późniejszym widokiem. Źródłem prawdy jest capture i kontekst.

2.8. Luki rynku  
Najważniejsze luki rynkowe:  
Pytanie    Obecne narzędzia    Szansa dla Consultify  
Czy da się zapisać myśl w kilka sekund?    Tak: Keep, Apple Notes, Mem, Reflect    Tak, ale z późniejszym AI enrichment i powiązaniem z pracą konsultingową  
Czy notatka sama rozumie kontekst projektu?    Częściowo: Notion AI, ClickUp Brain, Tana, Capacities    Tak, przez Context Linking Engine  
Czy system rozpoznaje zalążek inicjatywy?    Rzadko i bez pełnej domenowej struktury    Tak, przez Idea Extraction i Initiative Candidate Engine  
Czy notatka może być źródłem artifactów?    Częściowo w Notion/ClickUp/Slack Canvas    Tak, jako formalny source object dla docs, tables, slides, tasks  
Czy AI ma governance i approval?    Częściowo w enterprise suites    Tak, memory candidates, audit trail, confidence, approval  
Czy notatnik rozróżnia prywatne/projektowe/klientowe/organizacyjne?    Częściowo    Tak, jako core scope model  
Czy działa jako pamięć konsultingowa?    Nie wprost    Tak, to powinno być główne założenie Consultify

3. Kluczowy insight produktowy  
Apple Notes pomaga szybko zapisać myśl.  
Google Keep pomaga zapisać krótką notatkę.  
Evernote pomaga gromadzić informacje.  
OneNote pomaga organizować notatniki.  
Notion pomaga budować strony i bazy wiedzy.  
Obsidian/Roam/Logseq pomagają linkować myśli.  
Mem.ai pomaga używać AI do pamięci.  
Confluence pomaga tworzyć wiedzę zespołową.  
ClickUp/Asana/Linear pomagają wiązać dokumentację z pracą.  
Consultify powinien połączyć:  
szybki capture,  
AI enrichment,  
kontekst projektu,  
pamięć organizacyjną,  
semantic search,  
semantyczne linkowanie,  
idee,  
inicjatywy,  
taski,  
dokumenty,  
tabele,  
prezentacje,  
governance.  
Najważniejszy insight:  
Consultify nie powinien budować tylko notatnika. Consultify powinien zbudować system, w którym każda myśl może zostać zachowana, zrozumiana przez AI, połączona z kontekstem i rozwinięta do inicjatywy, zadania, dokumentu, prezentacji, tabeli albo decyzji.

4. Rekomendowana nazwa funkcjonalności  
Rozważane nazwy:  
Nazwa    Ocena  
Consultify Notes    Za proste, brzmi jak zwykłe notatki  
Consultify Smart Notes    Lepsze, ale generyczne  
Consultify Idea Notebook    Bardzo dobre dla UX i komunikacji  
Consultify AI Notebook    Dobre, ale za szerokie  
Consultify Context Notebook    Bardzo dobre architektonicznie  
Consultify Thought Capture    Dobre dla funkcji capture  
Consultify Thought-to-Initiative Engine    Świetne technicznie, za ciężkie jako nazwa UI  
Consultify Initiative Notebook    Za mocno zawęża do inicjatyw  
Consultify Memory Notes    Za mocno sugeruje tylko pamięć  
Rekomendacja:  
Nazwa produktowa w UI: Consultify Idea Notebook  
Nazwa architektoniczna: AI Context Notebook Engine  
Nazwa funkcji wewnętrznej: Thought-to-Initiative Engine  
Uzasadnienie:  
„Idea Notebook” jest proste i zrozumiałe dla użytkownika. „AI Context Notebook Engine” dobrze opisuje, czym to jest technicznie. „Thought-to-Initiative Engine” dobrze komunikuje główną przewagę: myśl może dojrzeć do inicjatywy.

5. Osiem głównych trybów funkcjonalności  
5.1. Quick Capture  
Użytkownik zapisuje myśl w kilka sekund.  
Przykład:  
„Klient znowu mówił, że problemem nie jest brak danych, tylko brak odpowiedzialności za decyzje.”  
System:  
zapisuje notatkę natychmiast,  
nie wymaga struktury,  
oznacza datę i autora,  
zapisuje raw note,  
proponuje tagi,  
wykrywa klienta/projekt, jeżeli możliwe,  
może później autonomicznie ją wzbogacić.  
Zasada UX: najpierw zapisujemy, potem porządkujemy.

5.2. Structured Note  
Użytkownik tworzy bardziej uporządkowaną notatkę.  
Przykład:  
„Notatka po rozmowie z CFO klienta X.”  
System proponuje strukturę:  
kontekst,  
obserwacje,  
problemy,  
cytaty,  
decyzje,  
pytania,  
potencjalne inicjatywy,  
next steps,  
powiązane osoby,  
źródła.

5.3. Autonomous Enrichment  
AI po zapisaniu notatki samodzielnie dodaje kontekst.  
System generuje:  
tytuł,  
summary,  
tagi,  
kategorię,  
obszar biznesowy,  
klienta/projekt,  
potencjalne inicjatywy,  
ryzyka,  
pytania otwarte,  
powiązane artifacty,  
podobne notatki,  
confidence score.

5.4. Convert Note to Idea  
System rozpoznaje, że notatka zawiera pomysł.  
Przykład:  
„Możemy zrobić funkcję, która sama wyciąga inicjatywy z rozmów z klientem.”  
System:  
proponuje utworzenie Idei,  
nadaje nazwę,  
opisuje problem,  
opisuje potencjalną wartość,  
klasyfikuje kategorię,  
proponuje ownera,  
proponuje status,  
proponuje kolejne kroki.

5.5. Convert Idea to Initiative  
System pomaga przekształcić ideę w inicjatywę.  
System:  
doprecyzowuje cel,  
definiuje problem,  
opisuje spodziewany efekt,  
proponuje KPI,  
proponuje ownera,  
proponuje priorytet,  
proponuje effort,  
identyfikuje ryzyka,  
identyfikuje zależności,  
proponuje roadmapę,  
proponuje taski.

5.6. Link Note to Existing Context  
Notatka może zostać połączona z:  
klientem,  
projektem,  
inicjatywą,  
taskiem,  
dokumentem,  
prezentacją,  
tabelą,  
research session,  
meeting note,  
CRM deal,  
osobą,  
procesem,  
ryzykiem,  
decyzją,  
KPI,  
problemem,  
hipotezą.

5.7. Ask AI About Notes  
Użytkownik może rozmawiać z notatkami.  
Przykłady:  
„Jakie pomysły miałem ostatnio o module inicjatyw?”  
„Pokaż notatki, które mogą być inicjatywami produktowymi.”  
„Co notowałem o klientach z branży produkcyjnej?”  
„Które notatki są warte przekształcenia w taski?”  
„Zrób podsumowanie moich pomysłów z ostatniego tygodnia.”

5.8. Notes as Context for Consultify AI  
Notatki zasilają kontekst aplikacji, ale nie automatycznie i bezmyślnie.  
System:  
klasyfikuje notatkę,  
sprawdza prywatność,  
rozpoznaje scope,  
tworzy memory candidate,  
proponuje użytkownikowi zatwierdzenie,  
pozwala używać notatek jako kontekstu dla AI,  
pozwala wykluczyć notatkę z pamięci,  
pozwala ustawić notatkę jako prywatną.

6. Kluczowe komponenty aplikacji  
A. Quick Capture Interface  
Interfejs szybkiego zapisu.  
Powinien obsługiwać:  
tekst,  
skrót klawiaturowy,  
zapis z chatu,  
zapis z modułu Idee,  
zapis z projektu,  
zapis z klienta,  
zapis ze spotkania,  
mobile capture,  
voice capture,  
zdjęcie/screenshot,  
link,  
plik,  
cytat,  
fragment rozmowy,  
zapis bez kategorii.  
Wymaganie: użytkownik nie może być zmuszony do wybierania kategorii przed zapisaniem.

B. Rich Note Editor  
Edytor podobny do Notion, ale prostszy w MVP.  
Powinien obsługiwać:  
tekst,  
nagłówki,  
listy,  
checklisty,  
cytaty,  
callouty,  
proste tabele,  
załączniki,  
linki,  
obrazy,  
pliki,  
kod,  
embedowane artifacty,  
taski inline,  
mention osób,  
mention klientów,  
mention projektów,  
mention inicjatyw,  
slash commands,  
markdown shortcuts,  
drag & drop,  
bloki AI.

C. AI Note Parser  
Moduł rozumienia notatki.  
Wykrywa:  
temat,  
intencję,  
klienta,  
projekt,  
typ notatki,  
kategorię,  
osoby,  
daty,  
problemy,  
decyzje,  
pytania,  
zadania,  
ryzyka,  
pomysły,  
inicjatywy,  
zależności,  
źródła,  
braki informacyjne,  
poziom poufności.

D. AI Enrichment Engine  
Moduł autonomicznego wzbogacania.  
Generuje:  
tytuł,  
summary,  
tagi,  
kategorie,  
suggested links,  
suggested initiative,  
suggested tasks,  
suggested questions,  
suggested follow-up,  
related notes,  
related artifacts,  
source references,  
confidence score,  
actionability score,  
strategic relevance score.

E. Context Linking Engine  
Łączy notatkę z obiektami Consultify:  
client_id,  
project_id,  
initiative_id,  
idea_id,  
task_id,  
document_id,  
presentation_id,  
table_id,  
research_session_id,  
meeting_id,  
CRM object,  
user,  
team,  
process,  
KPI,  
risk,  
decision,  
source.  
Linkowanie powinno być:  
automatyczne,  
ręczne,  
sugerowane przez AI,  
zatwierdzane przez użytkownika dla krytycznych powiązań.

F. Idea Extraction Engine  
Rozpoznaje, czy notatka zawiera ideę.  
Analizuje:  
czy idea jest nowa,  
czy podobna idea już istnieje,  
czy idea jest potencjalną inicjatywą,  
jaki problem rozwiązuje,  
jaka jest szansa,  
jaka jest wartość,  
jakie są ryzyka,  
jakie dane są potrzebne,  
jaki jest kolejny krok.

G. Initiative Conversion Engine  
Tworzy z idei kandydat inicjatywy.  
Generuje:  
initiative name,  
problem statement,  
business rationale,  
expected impact,  
KPI,  
priority,  
effort,  
risk,  
owner,  
status,  
dependencies,  
next steps,  
roadmap position,  
source notes,  
confidence score.

H. Semantic Search Engine  
Obsługuje:  
full text search,  
semantic search,  
tag search,  
search by client,  
search by project,  
search by initiative,  
search by author,  
search by date,  
similar notes,  
contradictory notes,  
undeveloped ideas,  
notes without owner,  
notes that should become tasks.

I. Memory Candidate Engine  
Decyduje, czy notatka powinna zasilać pamięć Consultify.  
Ocenia:  
prywatność,  
scope,  
poufność,  
trwałość wiedzy,  
przydatność dla AI,  
potrzebę approvalu,  
okres retencji,  
ryzyko ujawnienia,  
konflikt z permissioningiem.  
Zasada: AI nie wrzuca wszystkiego do pamięci. AI proponuje. Użytkownik kontroluje.

J. Note Governance Engine  
Obsługuje:  
private note,  
team note,  
project note,  
client note,  
organization note,  
confidential note,  
restricted note,  
permissioning,  
audit trail,  
version history,  
edit history,  
access history,  
sharing rules,  
retention rules,  
deletion rules,  
restore,  
export control.  
Ten komponent jest bezpośrednio spójny z osią Cybersecurity i Data Security z Digital Pathfinder, gdzie podkreślane są access controls, data protection, audit, monitoring, backup i identity verification jako kluczowe elementy zaufania do systemów cyfrowych.

K. Note-to-Artifact Engine  
Przekształca notatkę w:  
ideę,  
inicjatywę,  
task,  
dokument,  
prezentację,  
tabelę,  
research question,  
meeting agenda,  
follow-up email,  
decision log entry,  
risk,  
KPI,  
workshop exercise,  
product requirement,  
SOP input,  
business case input.

L. Note Inbox / Review Queue  
Widok decyzji dla notatek wymagających uporządkowania.  
Pokazuje:  
notatki bez kategorii,  
notatki z wykrytymi ideami,  
notatki z możliwymi taskami,  
notatki z możliwymi inicjatywami,  
notatki z brakującym kontekstem,  
notatki wymagające approval do pamięci,  
potencjalne duplikaty,  
notatki z wysokim actionability score.

M. Daily / Weekly Intelligence Digest  
Generuje podsumowania:  
dzienne,  
tygodniowe,  
projektowe,  
klientowe,  
zespołowe,  
produktowe.  
Przykłady:  
„Najważniejsze idee zapisane w tym tygodniu.”  
„Notatki, które warto przekształcić w inicjatywy.”  
„Ryzyka, które pojawiły się w notatkach.”  
„Pomysły produktowe z ostatnich rozmów.”  
„Otwarte pytania do klienta X.”  
„Notatki bez decyzji i ownera.”

7. Workflow użytkownika  
Workflow 1: Szybka notatka bez kontekstu  
Przykład:  
„Zrobić funkcję, która sama wyciąga inicjatywy z interview.”  
Proces:  
Użytkownik wpisuje notatkę w Quick Capture.  
System zapisuje ją natychmiast jako raw note.  
AI nadaje roboczy tytuł.  
AI proponuje tagi.  
AI rozpoznaje typ: Product Idea / Initiative Seed.  
AI proponuje powiązanie z modułem Interview i Idee.  
AI proponuje utworzenie Idei.  
Użytkownik zatwierdza teraz albo później.  
Notatka trafia do Review Queue.

Workflow 2: Notatka po spotkaniu z klientem  
Przykład:  
„Po rozmowie z CFO klienta X: problemem jest brak widoczności ROI inicjatyw.”  
Proces:  
Użytkownik zapisuje notatkę.  
System wykrywa klienta.  
System wykrywa osobę/funkcję: CFO.  
AI klasyfikuje notatkę jako Client Insight.  
AI proponuje powiązanie z projektem.  
AI wykrywa potencjalną inicjatywę: ROI Dashboard.  
AI proponuje task: przygotować pytania doprecyzowujące.  
AI zapisuje notatkę jako źródło insightu.  
Notatka może zasilić dokument, prezentację lub MAP.

Workflow 3: Notatka głosowa  
Przykład:  
Użytkownik mówi do telefonu:  
„Musimy zrobić w Consultify coś jak Notion, ale każda notatka ma sama szukać kontekstu.”  
Proces:  
System nagrywa audio.  
System transkrybuje.  
System czyści tekst.  
Zachowuje oryginalne audio.  
AI tworzy summary.  
AI proponuje tytuł.  
AI proponuje tagi.  
AI wykrywa ideę produktową.  
AI proponuje utworzenie inicjatywy.  
System zapisuje source reference do audio/transkrypcji.

Workflow 4: Notatka z linku lub artykułu  
Przykład:  
Użytkownik zapisuje link do artykułu o AI knowledge management.  
Proces:  
System zapisuje link.  
Pobiera metadane.  
Tworzy krótkie summary.  
Pyta albo wykrywa, dlaczego link jest ważny.  
Łączy z istniejącymi ideami.  
Proponuje notatkę researchową.  
Proponuje użycie jako źródła dla Research Session.  
Oznacza źródło jako external.

Workflow 5: Notatka przekształcona w ideę  
Przykład:  
„Możemy robić automatyczny weekly digest z notatek zespołu.”  
Proces:  
AI rozpoznaje ideę.  
Sprawdza podobne idee.  
Jeżeli podobna istnieje, proponuje merge/link.  
Jeżeli nie istnieje, proponuje nową Ideę.  
Tworzy nazwę.  
Tworzy opis problemu.  
Tworzy opis wartości.  
Proponuje ownera.  
Proponuje status „new”.  
Zachowuje notatkę jako źródło idei.

Workflow 6: Idea przekształcona w inicjatywę  
Przykład:  
„Z tej idei zrób inicjatywę produktową na Q2.”  
Proces:  
System pobiera źródłową notatkę.  
Pobiera powiązane notatki.  
Tworzy opis inicjatywy.  
Proponuje KPI.  
Proponuje effort.  
Proponuje business value.  
Proponuje ryzyka.  
Proponuje taski.  
Proponuje roadmap position.  
Tworzy initiative artifact.

Workflow 7: AI znajduje stare notatki jako kontekst  
Przykład:  
Użytkownik pracuje nad dokumentacją modułu Idee.  
Proces:  
System rozpoznaje aktualny kontekst pracy.  
Semantic Search Engine szuka powiązanych notatek.  
System pokazuje sugestie:  
podobne pomysły,  
wcześniejsze decyzje,  
nierozwinięte idee,  
powiązane ryzyka,  
pytania otwarte.  
Użytkownik wybiera, które dodać do kontekstu.  
AI używa ich do odpowiedzi, dokumentu lub prezentacji.

Workflow 8: Tygodniowy przegląd idei  
Przykład:  
„Pokaż mi najważniejsze pomysły z tego tygodnia.”  
Proces:  
System pobiera notatki z tygodnia.  
Grupuje je tematycznie.  
Wykrywa powtarzające się motywy.  
Wykrywa potencjalne inicjatywy.  
Wykrywa szybkie taski.  
Wykrywa ryzyka.  
Tworzy summary.  
Proponuje decyzje:  
utwórz ideę,  
połącz z inicjatywą,  
zamień w task,  
odłóż,  
usuń,  
oznacz jako prywatne.

8. AI jako operator notatnika  
Największa zmiana polega na tym, że AI nie tylko zapisuje notatki. AI staje się ich operatorem.  
A. AI zapisuje  
Pomaga szybko zachować myśl bez struktury.  
Przykład:  
„Zapisz mi to jako pomysł do Consultify.”  
B. AI porządkuje  
Nadaje tytuł, tagi, kategorię i summary.  
Przykład:  
„Uporządkuj moje luźne notatki z dzisiaj.”  
C. AI wzbogaca  
Dodaje kontekst, pytania, linki i powiązania.  
Przykład:  
„Dodaj kontekst do tej notatki na podstawie tego, co już mamy w projekcie.”  
D. AI łączy  
Wykrywa powiązane notatki, idee, inicjatywy i dokumenty.  
Przykład:  
„Z czym ta notatka jest powiązana?”  
E. AI wyciąga działania  
Rozpoznaje taski, decyzje, ryzyka i next steps.  
Przykład:  
„Wyciągnij z tych notatek zadania.”  
F. AI tworzy idee  
Przekształca luźną myśl w obiekt Idea.  
Przykład:  
„Zamień tę notatkę w ideę produktową.”  
G. AI tworzy inicjatywy  
Przekształca ideę w inicjatywę z celem, KPI, ownerem i statusem.  
Przykład:  
„Rozwiń to do inicjatywy strategicznej.”  
H. AI pamięta ostrożnie  
Proponuje, co ma trafić do pamięci, ale nie zapisuje wszystkiego bez kontroli.  
Przykład:  
„Czy ta notatka powinna zasilać kontekst projektu?”  
I. AI przypomina  
Wyciąga stare notatki w odpowiednim momencie.  
Przykład:  
„Przypominam: trzy tygodnie temu zapisałeś podobny pomysł dotyczący automatycznego wykrywania inicjatyw.”  
J. AI kwestionuje  
AI nie tylko potakuje. Potrafi powiedzieć, że pomysł jest niejasny, podobny do istniejącego albo wymaga danych.  
Przykład:  
„Ten pomysł wygląda podobnie do istniejącej inicjatywy X. Różnica nie jest jeszcze jasna.”  
To jest ważne: bez tej funkcji notatnik stanie się generatorem chaosu. Z tą funkcją staje się systemem dojrzewania myśli.

9. Modele danych  
9.1. Note  
{
  "id": "note_001",
  "title": "Automatyczne wykrywanie inicjatyw z interview",
  "raw_content": "Zrobić funkcję, która sama wyciąga inicjatywy z interview.",
  "rich_content": {
    "blocks": ["block_001"]
  },
  "summary": "Pomysł produktowy dotyczący automatycznego wykrywania inicjatyw na podstawie rozmów z klientami.",
  "author_id": "user_123",
  "owner_id": "user_123",
  "client_id": null,
  "project_id": "project_consultify",
  "scope": "project",
  "confidentiality": "internal",
  "note_type": "Product Idea",
  "tags": ["ideas", "interview", "automation", "initiatives"],
  "status": "needs_review",
  "source_type": "manual_text",
  "source_references": [],
  "linked_objects": [
    {
      "target_type": "module",
      "target_id": "module_interview",
      "link_type": "suggested"
    }
  ],
  "ai_metadata": {
    "confidence_score": 0.86,
    "actionability_score": 0.78,
    "strategic_relevance_score": 0.82
  },
  "created_at": "2026-05-09T10:12:00+02:00",
  "updated_at": "2026-05-09T10:12:30+02:00",
  "archived_at": null
}
Służy jako główny obiekt notatki. Przechowuje treść, metadane, scope, poufność, powiązania i AI metadata.

9.2. NoteBlock  
{
  "block_id": "block_001",
  "note_id": "note_001",
  "block_type": "paragraph",
  "content": "Zrobić funkcję, która sama wyciąga inicjatywy z interview.",
  "order": 1,
  "metadata": {
    "format": "plain_text"
  },
  "source_references": [],
  "ai_generated": false,
  "created_at": "2026-05-09T10:12:00+02:00",
  "updated_at": "2026-05-09T10:12:00+02:00"
}
Służy do budowy rich editor / block editor.

9.3. NoteAIEnrichment  
{
  "enrichment_id": "enrich_001",
  "note_id": "note_001",
  "generated_title": "Automatyczne wykrywanie inicjatyw z interview",
  "generated_summary": "Notatka opisuje pomysł funkcji, która automatycznie identyfikuje potencjalne inicjatywy na podstawie rozmów z klientami.",
  "suggested_tags": ["interview", "AI", "initiative_detection", "product_idea"],
  "suggested_category": "Product Idea",
  "detected_entities": [
    {
      "type": "module",
      "value": "Interview"
    },
    {
      "type": "module",
      "value": "Ideas"
    }
  ],
  "detected_tasks": [],
  "detected_ideas": [
    {
      "name": "AI Initiative Extraction from Interviews",
      "confidence": 0.88
    }
  ],
  "detected_risks": [
    "False positives in initiative detection",
    "Need for user approval before creating initiatives"
  ],
  "detected_questions": [
    "Which interview signals should trigger initiative detection?",
    "Should this work in real time or after interview completion?"
  ],
  "suggested_links": [
    {
      "target_type": "module",
      "target_id": "module_interview",
      "confidence": 0.91
    }
  ],
  "confidence_score": 0.86,
  "actionability_score": 0.78,
  "strategic_relevance_score": 0.82,
  "approval_status": "pending",
  "created_at": "2026-05-09T10:12:30+02:00"
}
Służy do przechowywania wyników autonomicznego wzbogacenia AI.

9.4. Idea  
{
  "idea_id": "idea_001",
  "source_note_ids": ["note_001"],
  "name": "AI Initiative Extraction from Interviews",
  "description": "Funkcja automatycznie wykrywa potencjalne inicjatywy na podstawie notatek i transkryptów z interview.",
  "problem_statement": "Wnioski z rozmów z klientami często nie są przekształcane w konkretne inicjatywy.",
  "opportunity": "Zwiększenie skuteczności discovery i ograniczenie utraty wartościowych insightów.",
  "business_value": "Szybsze tworzenie roadmapy inicjatyw oraz lepsze wykorzystanie danych z rozmów.",
  "category": "Product Improvement",
  "status": "new",
  "owner": "user_123",
  "priority": "medium",
  "confidence_score": 0.84,
  "linked_initiatives": [],
  "linked_artifacts": [],
  "created_at": "2026-05-09T10:15:00+02:00",
  "updated_at": "2026-05-09T10:15:00+02:00"
}
Służy jako obiekt pośredni między notatką a inicjatywą.

9.5. InitiativeCandidate  
{
  "candidate_id": "candidate_001",
  "source_note_ids": ["note_001"],
  "source_idea_id": "idea_001",
  "name": "Interview-to-Initiative Automation",
  "problem_statement": "Organizacje tracą insighty z interview, ponieważ nie istnieje systemowe przejście od obserwacji do inicjatywy.",
  "proposed_solution": "AI analizuje transkrypty i notatki, wykrywa potencjalne inicjatywy oraz proponuje ich strukturę.",
  "expected_impact": "Skrócenie czasu analizy interview i zwiększenie liczby wdrażalnych inicjatyw.",
  "suggested_kpis": [
    "Number of initiative candidates detected",
    "Approval rate of AI-generated initiative candidates",
    "Time from interview to initiative creation"
  ],
  "effort_estimate": "medium",
  "risk_level": "medium",
  "dependencies": ["module_interview", "module_initiatives", "semantic_search"],
  "suggested_owner": "product_owner_consultify",
  "suggested_status": "candidate",
  "confidence_score": 0.81,
  "approval_status": "pending"
}
Służy do kontrolowanego przekształcenia idei w inicjatywę.

9.6. NoteLink  
{
  "link_id": "link_001",
  "note_id": "note_001",
  "target_type": "project",
  "target_id": "project_consultify",
  "link_type": "ai_suggested",
  "confidence_score": 0.91,
  "created_by": "ai",
  "approved_by": "user_123",
  "created_at": "2026-05-09T10:13:00+02:00"
}
Służy do zarządzania relacjami między notatką a innymi obiektami.

9.7. MemoryCandidate  
{
  "memory_candidate_id": "memory_001",
  "note_id": "note_001",
  "proposed_scope": "project",
  "proposed_memory_text": "Consultify should include a function that extracts initiative candidates from client interviews.",
  "reason": "This is a durable product direction relevant to the Interview and Ideas modules.",
  "sensitivity_level": "internal",
  "retention_period": "until_project_archived",
  "approval_status": "pending",
  "approved_by": null,
  "created_at": "2026-05-09T10:16:00+02:00"
}
Służy do ostrożnego zasilania pamięci AI.

9.8. NoteTaskExtraction  
{
  "extraction_id": "task_extract_001",
  "note_id": "note_001",
  "tasks": [
    {
      "title": "Define signals for detecting initiative candidates in interview notes",
      "suggested_owner": "product_owner_consultify",
      "priority": "medium"
    }
  ],
  "decisions": [
    "Do not create initiatives automatically without user approval."
  ],
  "risks": [
    "Too many false initiative candidates may pollute the system."
  ],
  "open_questions": [
    "Should candidate detection run immediately after each interview?"
  ],
  "next_steps": [
    "Create MVP specification for AI initiative extraction."
  ],
  "approval_status": "pending",
  "created_at": "2026-05-09T10:17:00+02:00"
}
Służy do ekstrakcji zadań, decyzji, ryzyk i pytań.

10. Wymagania funkcjonalne  
ID	Wymaganie	Opis	Priorytet	Acceptance criterion  
F01	Quick note creation	Użytkownik tworzy notatkę bez formularza	P0	Notatka zapisana w mniej niż 3 sekundy od submit  
F02	Rich text note	Edycja tekstu z formatowaniem	P0	Użytkownik tworzy nagłówki, listy i akapity  
F03	Voice note	Tworzenie notatki głosowej	P1	Audio zapisane i przypisane do notatki  
F04	Audio transcription	Transkrypcja notatki głosowej	P1	System tworzy transkrypt i pozwala go edytować  
F05	Link note	Tworzenie notatki z linku	P1	System zapisuje URL i metadane  
F06	File note	Tworzenie notatki z pliku	P1	Plik widoczny jako source reference  
F07	Meeting note	Notatka powiązana ze spotkaniem	P1	Notatka ma meeting_id  
F08	Chat-to-note	Zapis z poziomu chatu	P0	Użytkownik komendą zapisuje fragment rozmowy jako notatkę  
F09	Project-level note	Notatka z poziomu projektu	P0	Notatka automatycznie ma project_id  
F10	Client-level note	Notatka z poziomu klienta	P0	Notatka automatycznie ma client_id  
F11	Initiative-level note	Notatka z poziomu inicjatywy	P1	Notatka automatycznie ma initiative_id  
F12	Autosave	Automatyczny zapis edycji	P0	Brak utraty treści po refreshu  
F13	Offline draft	Draft offline	P1	Draft zapisuje się lokalnie i synchronizuje po powrocie online  
F14	Mobile capture	Capture na mobile	P1	Użytkownik zapisuje notatkę z telefonu  
F15	Slash commands	Komendy / w edytorze	P1	Użytkownik dodaje blok przez slash command  
F16	Markdown shortcuts	Skróty markdown	P1	#, -, [] tworzą odpowiednie formatowanie  
F17	Text blocks	Edytor blokowy	P1	Każdy akapit może być osobnym blokiem  
F18	Checklists	Checklisty w notatce	P1	Użytkownik tworzy i odhacza checklistę  
F19	Simple tables	Proste tabele	P2	Użytkownik wstawia prostą tabelę  
F20	Attachments	Załączniki	P1	Użytkownik dodaje plik do notatki  
F21	Links	Linki w treści	P0	Linki są klikalne i zapisane  
F22	Images	Obrazy w notatce	P1	Obraz wyświetla się inline  
F23	Person mentions	Mention osób	P1	@osoba linkuje do profilu  
F24	Project mentions	Mention projektów	P1	@projekt linkuje do projektu  
F25	Client mentions	Mention klientów	P1	@klient linkuje do klienta  
F26	Initiative mentions	Mention inicjatyw	P1	@inicjatywa linkuje do inicjatywy  
F27	AI title	AI generuje tytuł	P0	Tytuł sugerowany po zapisie  
F28	AI summary	AI generuje summary	P0	Summary widoczne w panelu AI  
F29	AI tags	AI proponuje tagi	P0	Tagi mają confidence score  
F30	AI classification	AI klasyfikuje notatkę	P0	Note type sugerowany automatycznie  
F31	Detect client	AI wykrywa klienta	P1	Client suggestion widoczny w enrichment  
F32	Detect project	AI wykrywa projekt	P1	Project suggestion widoczny w enrichment  
F33	Detect people	AI wykrywa osoby	P1	Osoby widoczne jako entities  
F34	Detect tasks	AI wykrywa taski	P0	Suggested tasks trafiają do Review Queue  
F35	Detect decisions	AI wykrywa decyzje	P1	Decisions są wyświetlane w extraction  
F36	Detect risks	AI wykrywa ryzyka	P1	Risks są zapisane jako suggested risks  
F37	Detect questions	AI wykrywa pytania	P1	Open questions są widoczne  
F38	Detect ideas	AI wykrywa idee	P0	Idea candidates powstają z confidence  
F39	Detect initiative candidates	AI wykrywa potencjalne inicjatywy	P0	Initiative candidate można zatwierdzić  
F40	Related notes	AI wykrywa podobne notatki	P1	Related notes pokazują uzasadnienie  
F41	Related documents	AI wykrywa powiązane dokumenty	P2	Dokumenty widoczne w suggested links  
F42	Related tables	AI wykrywa powiązane tabele	P2	Tabele widoczne w suggested links  
F43	Related presentations	AI wykrywa powiązane prezentacje	P2	Prezentacje widoczne w suggested links  
F44	Similar ideas	AI wykrywa podobne idee	P0	System pokazuje possible duplicates  
F45	Merge duplicates	AI proponuje merge	P1	Użytkownik może merge/link/ignore  
F46	Create idea	AI proponuje stworzenie idei	P0	Idea tworzona po approval  
F47	Create initiative	AI proponuje stworzenie inicjatywy	P0	Initiative candidate tworzony po approval  
F48	Create task	AI proponuje stworzenie taska	P0	Task tworzony po approval  
F49	Create document	AI proponuje dokument	P2	Draft document powstaje z note source  
F50	Create table	AI proponuje tabelę	P2	Table record lub table artifact powstaje z notatki  
F51	Create presentation	AI proponuje prezentację	P2	Presentation outline powstaje z notatki  
F52	Semantic search	Wyszukiwanie semantyczne	P1	Query natural language znajduje trafne notatki  
F53	Full text search	Wyszukiwanie tekstowe	P0	Wyniki po słowach kluczowych  
F54	Tag search	Wyszukiwanie po tagach	P0	Filtr tagów działa  
F55	Search by client	Filtr klienta	P0	Wyniki ograniczone do client_id  
F56	Search by project	Filtr projektu	P0	Wyniki ograniczone do project_id  
F57	Search by initiative	Filtr inicjatywy	P1	Wyniki ograniczone do initiative_id  
F58	Search by author	Filtr autora	P1	Wyniki ograniczone do author_id  
F59	Search by date	Filtr daty	P0	Zakres dat działa  
F60	Note graph	Widok relacji	P2	Użytkownik widzi graf powiązań  
F61	Review Queue	Kolejka przeglądu	P0	Notatki wymagające decyzji są w jednym widoku  
F62	Daily digest	Dzienny digest	P2	System generuje digest dzienny  
F63	Weekly digest	Tygodniowy digest	P1	System generuje digest tygodniowy  
F64	Privacy setting	Ustawienie prywatności	P0	Notatka może być private  
F65	Scope setting	Scope notatki	P0	Scope: private/team/project/client/org  
F66	Confidentiality labels	Etykiety poufności	P0	Confidential/restricted widoczne i egzekwowane  
F67	Permissions	Permissioning	P0	Użytkownik bez praw nie widzi notatki  
F68	Audit trail	Historia dostępu i zmian	P0	System zapisuje kto/co/kiedy  
F69	Version history	Historia wersji	P1	Można wrócić do poprzedniej wersji  
F70	Restore deleted note	Przywracanie	P1	Usunięta notatka możliwa do restore  
F71	Archive note	Archiwizacja	P1	Notatka znika z aktywnych widoków  
F72	Export note	Eksport	P1	Eksport do Markdown/PDF/DOCX  
F73	Import notes	Import	P2	Import z Markdown/CSV/HTML  
F74	Convert note to idea	Konwersja notatki do idei	P0	Idea ma source_note_ids  
F75	Convert idea to initiative	Konwersja idei do inicjatywy	P0	Inicjatywa ma source_idea_id  
F76	Convert note to task	Konwersja do taska	P0	Task ma link do notatki  
F77	Convert note to document	Konwersja do dokumentu	P2	Dokument ma source note  
F78	Convert note to presentation	Konwersja do prezentacji	P2	Prezentacja ma source note  
F79	Convert note to table	Konwersja do tabeli	P2	Rekord/tabela ma source note  
F80	Memory candidate approval	Approval pamięci	P0	Memory nie powstaje bez reguł approval

11. Wymagania niefunkcjonalne  
Wymaganie	Dlaczego ważne dla enterprise  
Szybkość zapisu	Capture musi być szybszy niż utrata myśli; każde opóźnienie zabija użycie  
Brak tarcia UX	Notatnik nie może wymuszać struktury przed zapisem  
Autosave	Utrata notatki niszczy zaufanie do systemu  
Niezawodność	Notatnik będzie jednym z najczęściej używanych modułów  
Brak utraty danych	Notatki mogą być źródłem decyzji i materiałem dowodowym  
Mobile readiness	Wiele myśli powstaje poza biurkiem  
Stabilność edytora	Edytor nie może „rozjeżdżać” treści ani bloków  
Szybkość wyszukiwania	Użytkownik musi znaleźć starą myśl natychmiast  
Jakość semantic search	System musi rozumieć znaczenie, nie tylko słowa  
Jakość transkrypcji	Voice capture bez dobrej transkrypcji będzie frustrujący  
Bezpieczeństwo danych	Notatki mogą zawierać informacje klienta, strategię, ryzyka i dane poufne  
Permissioning	Nie każda notatka ma być dostępna dla każdego  
Privacy by design	Prywatność musi być core, nie dodatkiem  
Kontrola pamięci AI	AI nie może niekontrolowanie zapamiętywać poufnych danych  
Odporność na halucynacje	AI musi rozróżniać treść notatki od interpretacji  
Audytowalność	Enterprise potrzebuje dowodu kto zmienił, przeczytał i użył notatkę  
Skalowalność	System musi obsłużyć tysiące lub miliony notatek  
Obsługa załączników	W consulting workflow źródła bywają w plikach, screenach, audio i linkach  
Integralność linków	Zerwane linki niszczą graf kontekstu  
Jakość API	Notebook musi integrować się z resztą Consultify  
Eksport danych	Klient enterprise wymaga przenoszalności i compliance  
Usuwanie danych	Prawo do usunięcia i retencja są krytyczne  
Enterprise compliance	System musi pasować do wymagań klienta korporacyjnego  
Kontrola kosztów AI	Enrichment i semantic search mogą generować koszty przy skali  
Retencja danych	Nie każda notatka powinna żyć wiecznie  
Odporność na błędne klasyfikacje AI	Błędy klasyfikacji nie mogą automatycznie tworzyć chaosu

12. MVP i roadmapa  
MVP 1 — Quick Capture & Basic Notes  
Cel:  
Zbudować podstawowy, szybki i niezawodny notatnik w module Idee.  
Zakres:  
szybkie tworzenie notatki,  
podstawowy rich text editor,  
autosave,  
tagi,  
ręczne przypisanie do projektu/klienta,  
podstawowe wyszukiwanie,  
lista notatek,  
notatka jako obiekt w module Idee.  
Poza zakresem:  
semantic search,  
AI enrichment,  
voice capture,  
note graph,  
konwersja do inicjatyw,  
memory candidates.  
Ryzyka:  
zbyt ciężki UX,  
edytor niestabilny,  
zbyt wiele pól na starcie,  
brak realnego poczucia „quick capture”.  
Definition of Done:  
użytkownik może zapisać notatkę w kilka sekund,  
notatka nie ginie po refreshu,  
notatkę można edytować,  
notatkę można przypisać do projektu/klienta,  
notatkę można wyszukać,  
notatka ma author, date, scope, status.

MVP 2 — AI Enrichment & Classification  
Cel:  
Dodać pierwszą warstwę AI, która porządkuje notatki bez obciążania użytkownika.  
Zakres:  
AI title,  
AI summary,  
AI tags,  
klasyfikacja notatki,  
wykrywanie klientów/projektów,  
wykrywanie tasków,  
wykrywanie idei,  
suggested links,  
Review Queue.  
Poza zakresem:  
automatyczne tworzenie inicjatyw,  
pełny graph,  
memory engine,  
zaawansowany duplicate merge.  
Ryzyka:  
AI generuje zbyt dużo sugestii,  
błędne tagi,  
zbyt wiele false positives,  
użytkownik ignoruje Review Queue.  
Definition of Done:  
AI enrichment działa po zapisie notatki,  
każda sugestia ma confidence score,  
użytkownik może accept/reject/ignore,  
Review Queue pokazuje notatki wymagające decyzji.

MVP 3 — Idea & Initiative Conversion  
Cel:  
Przekształcić notebook z miejsca zapisu w silnik dojrzewania idei.  
Zakres:  
convert note to idea,  
detect idea candidates,  
detect initiative candidates,  
convert idea to initiative,  
source note linking,  
duplicate detection,  
priority suggestions,  
owner suggestions.  
Poza zakresem:  
pełny workflow approval enterprise,  
automatyczna roadmapa,  
zaawansowany scoring finansowy.  
Ryzyka:  
AI produkuje zbyt wiele inicjatyw,  
duplikaty,  
brak ownerów,  
inicjatywy bez business value.  
Definition of Done:  
każda idea ma source_note_ids,  
każda inicjatywa z notatki ma source_idea_id albo source_note_ids,  
użytkownik zatwierdza konwersję,  
system wykrywa podobne idee przed utworzeniem nowej.

MVP 4 — Semantic Memory & Context Engine  
Cel:  
Uczynić z notatek realny kontekst dla AI i pracy projektowej.  
Zakres:  
semantic search,  
context linking,  
memory candidates,  
scope management,  
Ask AI about notes,  
project context injection,  
privacy controls,  
note graph.  
Poza zakresem:  
pełna automatyczna pamięć bez approval,  
zaawansowana analiza sprzeczności,  
integracje ze wszystkimi zewnętrznymi systemami.  
Ryzyka:  
prywatne notatki trafiają do kontekstu,  
AI używa złych źródeł,  
brak zaufania do wyników,  
wysokie koszty embeddingów i zapytań.  
Definition of Done:  
użytkownik może pytać AI o notatki,  
odpowiedź pokazuje źródła,  
memory candidate wymaga approval według reguł,  
private notes nie są używane poza dozwolonym scope.

MVP 5 — Enterprise Collaboration & Governance  
Cel:  
Przygotować notebook do pracy zespołowej i enterprise deployment.  
Zakres:  
permissions,  
comments,  
version history,  
audit trail,  
team notes,  
client notes,  
confidential notes,  
approval for memory,  
export/import,  
integracje z documents, tables, presentations, tasks i CRM.  
Poza zakresem:  
pełne zastąpienie Confluence/Notion,  
publiczne strony,  
template marketplace,  
pełny offline-first local storage.  
Ryzyka:  
złożony permissioning,  
konflikty dostępu,  
trudny UX sharingu,  
audyt generuje zbyt dużo danych.  
Definition of Done:  
notatki mają jasny scope,  
access control działa,  
audit trail rejestruje działania,  
wersje można porównać/przywrócić,  
notatkę można bezpiecznie użyć jako źródło artifactu.

13. Pierwsze typy notatek dla Consultify  
Typ notatki	Do czego służy	Kto używa	Metadane	AI enrichment	Linkowanie	Kiedy konwertować  
Quick Thought	Szybki zapis myśli	każdy	author, date, scope	title, tags	user/project	gdy ma actionability  
Product Idea	Pomysł produktowy	product, CEO	module, impact	problem, value	product/module	do Idea/Initiative  
Client Insight	Wniosek o kliencie	sales, consulting	client, person	pain, opportunity	CRM/project	do task/MAP  
Meeting Reflection	Refleksja po spotkaniu	każdy	meeting_id	summary, decisions	meeting/project	do follow-up  
Interview Observation	Obserwacja z interview	consultants	respondent, topic	pattern, quote	interview/client	do insight/initiative  
Workshop Note	Notatka z warsztatu	consulting	workshop_id	themes, actions	project/client	do document/task  
Risk Note	Ryzyko	PM, consulting	risk_level	mitigation	risk register	do risk/task  
Decision Note	Decyzja	management	decision_owner	rationale	decision log	do decision entry  
Open Question	Pytanie otwarte	każdy	owner, deadline	suggested answers	project/client	do task/research  
Task Note	Luźny task	każdy	due, owner	task extraction	task module	do task  
Initiative Seed	Zalążek inicjatywy	product, consulting	category, value	KPI, owner	initiatives	do initiative  
Improvement Idea	Usprawnienie	operations	process, area	effort, impact	process/KPI	do initiative  
AI Use Case Idea	Pomysł AI	product, consulting	model, data	feasibility	AI roadmap	do initiative  
Automation Idea	Pomysł automatyzacji	ops, product	process, trigger	ROI, effort	process/task	do initiative  
Sales Insight	Wniosek sprzedażowy	sales	deal, persona	objection, next step	CRM/MEDDPICC	do follow-up  
Marketing Idea	Pomysł marketingowy	marketing	channel, persona	content angle	campaign	do task/document  
Strategy Thought	Myśl strategiczna	CEO, strategy	horizon, theme	implications	strategy docs	do document  
Research Note	Notatka badawcza	research	source, URL	summary, claims	research session	do doc/table  
Competitor Observation	Obserwacja konkurencji	product, strategy	competitor	implications	competitor profile	do analysis  
Technology Observation	Obserwacja technologii	tech, product	tech, vendor	relevance	roadmap	do research/initiative  
Process Problem	Problem procesowy	consulting	process, symptom	root cause	process map	do initiative  
Organizational Problem	Problem organizacyjny	management	org area	causes, risks	org map	do initiative  
KPI Observation	Obserwacja KPI	PM, finance	KPI, value	trend, issue	dashboard	do task/risk  
Financial Hypothesis	Hipoteza finansowa	CFO, consulting	metric, assumption	test plan	business case	do analysis  
Customer Quote	Cytat klienta	sales, research	speaker, context	sentiment, theme	client/interview	do doc/presentation  
User Feedback Note	Feedback użytkownika	product	user, feature	severity, request	product backlog	do requirement  
Product Requirement Seed	Zalążek requirementu	product	module, need	acceptance idea	PRD	do document/task  
Roadmap Idea	Pomysł roadmapowy	product	quarter, module	priority	roadmap	do initiative  
SOP Input	Materiał do SOP	ops	process, role	structure	SOP doc	do document  
Training Idea	Pomysł szkoleniowy	HR, academy	audience	outline	training module	do document  
Governance Note	Governance	legal, PMO	policy area	rule, risk	governance docs	do policy/task  
Compliance Concern	Obawa compliance	legal/security	regulation	sensitivity	risk/compliance	do risk/task  
Personal Reflection	Refleksja osobista	user	private flag	optional summary	private memory	rzadko  
Private Note	Prywatna notatka	user	private scope	minimal AI	none/private	tylko za zgodą  
Team Note	Notatka zespołowa	team	team_id	summary, actions	team/project	do task/doc

14. Najważniejsze ryzyka  
Ryzyko	Wpływ	Prawdopodobieństwo	Ograniczenie	Decyzja architektoniczna  
Zwykły notatnik zamiast context engine	Wysoki	Średnie	Od początku model Note → Idea → Initiative	Note jako obiekt z linkami i AI metadata  
Za dużo tarcia przy capture	Wysoki	Wysokie	Minimalny formularz	Najpierw raw note, potem enrichment  
UX zbyt ciężki	Wysoki	Średnie	Quick Capture jako osobny tryb	Brak wymaganych pól przy zapisie  
AI źle klasyfikuje	Średni	Wysokie	Confidence + approval	Sugestie, nie automatyczne prawdy  
AI tworzy fałszywe inicjatywy	Wysoki	Średnie	Review Queue	InitiativeCandidate zamiast automatycznej inicjatywy  
Chaos w tagach	Średni	Wysokie	Controlled taxonomy + AI suggestions	Tag governance  
Duplikaty notatek	Średni	Wysokie	Similarity detection	Duplicate detection przed konwersją  
Brak dobrego search	Wysoki	Średnie	Full text + semantic	Hybrid search  
Brak semantic search	Wysoki	Średnie	Embeddings od MVP 4	Vector index  
Utrata danych	Krytyczny	Niskie/średnie	Autosave, draft, backup	Event-sourced edit history  
Brak autosave	Wysoki	Średnie	Autosave P0	Local draft + server sync  
Zbyt agresywna pamięć AI	Krytyczny	Średnie	Memory approval	MemoryCandidate Engine  
Ryzyko prywatności	Krytyczny	Średnie	Scope/private default	Privacy by design  
Ujawnienie notatek poufnych	Krytyczny	Średnie	Permissions, audit	Governance Engine  
Brak permissioningu	Krytyczny	Niskie/średnie	RBAC/ABAC	Scope + confidentiality labels  
Brak audit trail	Wysoki	Średnie	Audit P0 enterprise	Immutable audit log  
Brak mobile capture	Średni	Średnie	Mobile MVP 1/2	Mobile quick capture  
Brak integracji z inicjatywami	Wysoki	Średnie	Note-to-Initiative flow	Idea/Initiative as native objects  
Brak Review Queue	Wysoki	Wysokie	Review Queue P0 w MVP 2	Central decision inbox  
Słaba konwersja do inicjatyw	Wysoki	Średnie	Structured candidate model	InitiativeCandidate schema  
AI halucynuje kontekst	Wysoki	Średnie	Source references	Grounded answers only  
Notatnik staje się śmietnikiem	Wysoki	Wysokie	Digest + review + archive	Lifecycle statuses  
Użytkownicy nie wracają	Średni	Wysokie	Weekly digest, resurfacing	Intelligence Digest  
Brak linku do artifactów	Wysoki	Średnie	Note-to-Artifact Engine	Source note references  
MVP za duże	Wysoki	Wysokie	Etapowanie	MVP 1 bez AI-heavy features  
Kopiowanie Notion 1:1	Wysoki	Średnie	Jasna decyzja produktowa	Context engine, nie workspace clone

15. Kopiować Notion czy budować własny silnik?  
15.1. Opcja 1: Integracja z Notion  
Plusy:  
szybki start,  
gotowy edytor,  
znany UX,  
bazy danych,  
współpraca,  
AI rozwijane przez Notion.  
Minusy:  
brak pełnej kontroli nad modelem danych,  
trudny permissioning zgodny z Consultify,  
ograniczona kontrola memory candidates,  
trudne source references,  
trudne artifact governance,  
zależność od zewnętrznego produktu,  
brak natywnego lifecycle Note → Idea → Initiative.  
Wniosek:  
Można rozważyć import/export lub connector, ale nie jako core notebook.

15.2. Opcja 2: Inspirować się Notion i użyć gotowego rich text editora  
Plusy:  
kontrola danych,  
szybsza budowa niż własny edytor od zera,  
możliwość budowy bloków,  
własne AI metadata,  
własne permissions,  
własny lifecycle.  
Minusy:  
trzeba dobrze zaprojektować UX,  
ryzyko długu technicznego w edytorze,  
wymaga mocnej architektury danych.  
Rekomendowane technologie:  
TipTap / ProseMirror — bardzo dobre dla block/rich editor,  
Lexical — mocny wybór dla nowoczesnego edytora,  
Slate — elastyczny, ale może wymagać więcej pracy.  
Wniosek:  
To jest najlepsza ścieżka krótkoterminowa.

15.3. Opcja 3: Budować własny block editor od zera  
Plusy:  
pełna kontrola,  
idealne dopasowanie do Consultify.  
Minusy:  
bardzo drogie,  
wysokie ryzyko,  
odciąga zespół od wartości biznesowej,  
edytory są trudniejsze niż wyglądają.  
Wniosek:  
Nie robić w pierwszych MVP.

15.4. Opcja 4: Własny note engine + zewnętrzny editor  
To rekomendowane podejście.  
Consultify powinien kontrolować:  
Note object,  
NoteBlock,  
AI enrichment,  
NoteLink,  
Idea,  
InitiativeCandidate,  
MemoryCandidate,  
scope,  
permissions,  
audit,  
semantic index,  
source references,  
artifact conversion.  
Editor może być gotowy. Engine musi być własny.

15.5. Vector search: zewnętrzny czy wewnętrzny?  
Krótkoterminowo:  
Użyć sprawdzonej bazy wektorowej / managed vector search, aby szybko dostarczyć semantic search.  
Długoterminowo:  
Zbudować własną warstwę Context Engine nad wektorami, która kontroluje:  
chunking,  
permissions-aware retrieval,  
source references,  
note scope,  
memory candidates,  
cross-object retrieval,  
ranking,  
confidence,  
audit.  
Wniosek:  
Nie chodzi o samą bazę wektorową. Przewagą Consultify będzie permissions-aware context retrieval.  
Rekomendacja praktyczna  
Consultify nie powinien kopiować Notion 1:1. Powinien zbudować własny AI Context Notebook inspirowany prostotą i elastycznością Notion, ale podporządkowany przechwytywaniu idei, budowaniu kontekstu, generowaniu inicjatyw i pracy konsultingowej.

16. Rekomendowana architektura logiczna  
16.1. Przepływ logiczny  
User thought  
  ↓  
Quick Capture Interface  
  ↓  
Note object creation  
  ↓  
Rich Note Editor  
  ↓  
AI Note Parser  
  ↓  
AI Enrichment Engine  
  ↓  
Context Linking Engine  
  ↓  
Idea Extraction Engine  
  ↓  
Initiative Conversion Engine  
  ↓  
Semantic Search Engine  
  ↓  
Memory Candidate Engine  
  ↓  
Review Queue  
  ↓  
Governance Engine  
  ↓  
Note-to-Artifact Engine  
  ↓  
Integration with Ideas / Initiatives / Tasks / Documents / Tables / Presentations / CRM  
  ↓  
Audit trail

16.2. Core Consultify  
Te komponenty powinny być częścią Consultify core:  
Note object model,  
NoteBlock model,  
AI metadata model,  
Context Linking Engine,  
Idea Extraction Engine,  
Initiative Conversion Engine,  
Memory Candidate Engine,  
Governance Engine,  
Audit Trail,  
Review Queue,  
Note-to-Artifact Engine,  
permission-aware semantic retrieval.

16.3. Możliwe integracje zewnętrzne  
Te elementy mogą być częściowo zewnętrzne:  
transkrypcja audio,  
OCR,  
vector database,  
file storage,  
calendar connector,  
CRM connector,  
meeting transcript import,  
browser clipping,  
mobile push capture,  
external note import.  
Zasada: integracje mogą dostarczać dane, ale Consultify musi kontrolować kontekst, governance i lifecycle.

17. Relacje z innymi modułami Consultify  
A. Chat  
Chat może:  
zapisać notatkę,  
przywołać notatkę,  
utworzyć ideę,  
utworzyć task,  
utworzyć inicjatywę,  
wyjaśnić powiązania,  
zaproponować memory candidate.  
Przykład:  
„Zapisz tę myśl jako notatkę prywatną w projekcie VTS.”  
B. Idee  
Notatka może być zalążkiem idei. AI może rozpoznać pomysł i zaproponować stworzenie obiektu Idea.  
C. Inicjatywy  
Idea może zostać rozwinięta do inicjatywy z celem, KPI, ownerem, ryzykami, statusem i taskami.  
D. Research Sessions  
Notatki mogą być:  
wejściem do researchu,  
pytaniem researchowym,  
źródłem hipotez,  
wynikiem researchu,  
materiałem do raportu.  
E. Documents  
Notatki mogą zasilać:  
raporty,  
memo,  
oferty,  
business case’y,  
podsumowania interview,  
dokumenty strategiczne,  
SOP.  
F. Presentations  
Notatki mogą zasilać:  
executive summaries,  
decki zarządcze,  
prezentacje ofertowe,  
prezentacje z warsztatów,  
roadmap decks.  
G. Tables  
Notatki mogą tworzyć rekordy w tabelach:  
issue log,  
risk register,  
action plan,  
initiative register,  
interview insights table,  
decision log,  
assumptions table.  
H. Tasks  
AI może wyciągać taski z notatek i proponować ich utworzenie.  
I. CRM / Sales  
Notatki z rozmów z klientem mogą zasilać:  
client discovery,  
MEDDPICC,  
MAP,  
stakeholder map,  
sales follow-up,  
objection handling,  
next meeting agenda.  
J. Governance  
Notatki muszą mieć:  
scope,  
confidentiality,  
permissioning,  
audit trail,  
version history,  
access history.  
K. Memory  
Nie każda notatka powinna trafiać do pamięci. System powinien proponować memory candidates i wymagać zatwierdzenia przy treściach wrażliwych.

18. Najważniejsza decyzja produktowa  
Czy Consultify powinien próbować skopiować Notion 1:1?  
Nie.  
Consultify nie powinien kopiować Notion 1:1. Consultify powinien zbudować AI-native Idea Notebook inspirowany Notion, ale podporządkowany szybkiemu capture, kontekstowi, inicjatywom i consulting execution.  
Notion jest general-purpose workspace. Consultify ma być domain-aware consulting execution system.  
Dlatego nie trzeba od razu budować:  
rozbudowanych baz danych jak Notion,  
publicznych stron,  
pełnej wiki,  
marketplace template’ów,  
wszystkich typów bloków,  
pełnego systemu dokumentowego.  
Najpierw trzeba zbudować:  
quick capture,  
note object,  
rich editor,  
AI enrichment,  
semantic search,  
context linking,  
idea extraction,  
initiative conversion,  
memory candidate approval,  
governance,  
integrację z resztą Consultify.  
Dopiero później można rozwijać pełną warstwę Notion-like.

19. Finalny opis produktu  
Consultify Idea Notebook to AI-native system notatek i przechwytywania idei działający w module Idee/Inicjatywy, którego celem jest szybkie zapisywanie myśli, obserwacji, problemów, inspiracji i zalążków inicjatyw oraz ich autonomiczne wzbogacanie, klasyfikowanie i łączenie z kontekstem całej aplikacji Consultify.  
System pozwala użytkownikowi zapisać myśl w kilka sekund, bez konieczności natychmiastowego wybierania kategorii, projektu czy struktury. Po zapisaniu notatki AI może zaproponować tytuł, summary, tagi, typ notatki, powiązane projekty, klientów, inicjatywy, taski, dokumenty, tabele i prezentacje. Notatka może zostać przekształcona w ideę, inicjatywę, task, dokument, tabelę, prezentację, research question, decision log entry albo risk item.  
Consultify Idea Notebook zawiera semantic search, context linking, Review Queue, Memory Candidate Engine, permissioning, privacy controls, audit trail i version history. System rozróżnia notatki prywatne, zespołowe, projektowe, klientowe i organizacyjne. Nie każda notatka automatycznie trafia do pamięci AI; system proponuje memory candidates i wymaga kontroli użytkownika dla treści wrażliwych.  
Consultify Idea Notebook inspiruje się prostotą Notion, szybkością Google Keep, networked thinking Obsidian/Roam/Tana oraz AI memory tools typu Mem.ai i Reflect, ale nie kopiuje żadnego z tych narzędzi 1:1. Jego główną rolą jest consulting execution: przechwycić myśl, zachować kontekst, rozpoznać wartość, połączyć z pracą projektową i pomóc przekształcić ją w działanie.

20. Najważniejsze zasady projektowe dla Consultify Idea Notebook  
Notatka jest zalążkiem kontekstu, nie tylko tekstem.  
Najpierw zapisujemy, potem porządkujemy.  
Quick capture musi być szybszy niż myśl użytkownika.  
AI może proponować klasyfikację, ale użytkownik kontroluje krytyczne powiązania.  
Nie każda notatka powinna trafiać do pamięci AI.  
Prywatność jest częścią core, nie dodatkiem.  
Każda idea powinna mieć źródłową notatkę.  
Notatnik musi prowadzić do inicjatyw, nie do chaosu.  
Semantic search jest ważniejsze niż foldery.  
Review Queue chroni system przed śmietnikiem.  
AI ma pomagać w dojrzewaniu myśli, nie produkować sztuczne inicjatywy.  
Notatka powinna być możliwa do przekształcenia w task, dokument, tabelę, prezentację albo inicjatywę.  
System musi rozróżniać notatki prywatne, projektowe, klientowe i organizacyjne.  
Każde automatyczne wzbogacenie AI powinno mieć confidence score.  
Nie kopiujemy Notion 1:1 — budujemy context engine dla consulting execution.

21. Najkrótsza decyzja dla zespołu product/dev  
Budujemy Consultify Idea Notebook jako własny core module, nie jako integrację z Notion.  
W MVP nie budujemy pełnego Notion. Budujemy:  
szybki zapis,  
stabilny note object,  
prosty rich editor,  
autosave,  
tagi i scope,  
AI title/summary/tags,  
Review Queue,  
konwersję Note → Idea,  
konwersję Idea → Initiative,  
semantic search,  
memory candidates,  
permissioning i audit trail.  
To ma być nie „ładny notatnik”, tylko system dojrzewania myśli do działania.

