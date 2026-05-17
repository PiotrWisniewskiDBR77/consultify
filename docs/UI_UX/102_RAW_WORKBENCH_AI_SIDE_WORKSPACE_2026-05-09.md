---
uiux_doc_id: UIUX_RAW_WORKBENCH_AI_SIDE_WORKSPACE_2026_05_09
doc_kind: RAW_REFERENCE
version: 1.0
owner: user
status: raw
last_updated: 2026-05-09
---

# Raw input — Workbench / AI Side Workspace & Artifact Canvas Engine (2026-05-09)

Poniżej: surowe założenia autora (produkt + architektura) wklejone **verbatim**.

---

## VERBATIM

Consultify Workbench / AI Side Workspace & Artifact Canvas Engine  
Dokument produktowo-architektoniczny v1

1. Executive summary  
Consultify Workbench powinien być centralnym trybem pracy z AI w Consultify: dwupanelowym środowiskiem, w którym po lewej stronie użytkownik rozmawia z Teresą / Consultify AI, a po prawej powstaje żywy artifact: dokument, notatka, tabela, prezentacja, analiza, checklist, prompt, process flow, whiteboard, mindmap, dashboard, specyfikacja albo inny obiekt roboczy.  
To nie jest zwykły chat. To nie jest tylko edytor. To nie jest tylko canvas. To jest AI Operating Workspace: przestrzeń, w której rozmowa, źródła, wersje, zmiany, zatwierdzenia i wynik pracy żyją razem.  
Problem klasycznego AI chatu jest prosty: użytkownik dostaje odpowiedź i musi ją kopiować do Worda, PowerPointa, Notion, Excela, Miro albo systemu tasków. W tym momencie traci się kontekst, źródła, historię zmian, odpowiedzialność, status i governance. Consultify musi ten model przeciąć. Praca powinna wyglądać tak:  
rozmowa → artifact → edycja → diff → approval → export → execution  
Ten moduł bardzo dobrze pasuje do filozofii Digital Roadmap: transformacja nie jest jednorazowym dokumentem, tylko procesem planowania, tworzenia inicjatyw, układania ich w sekwencje i ciągłego dostosowywania do zmian. W Digital Pathfinder podkreślasz, że skuteczna transformacja wymaga uporządkowania działań, kompetencji i zasobów, a nie chaotycznego wdrażania technologii. Workbench powinien być właśnie takim operacyjnym miejscem porządkowania myślenia i zamieniania go w działania.

2. Benchmark rynku  
2.1. Claude Artifacts / Claude Projects  
Claude Artifacts pozwalają tworzyć znaczące, samodzielne treści w dedykowanym oknie obok rozmowy — dokumenty, kod, diagramy, wizualizacje, aplikacje i inne obiekty, które można dalej modyfikować lub wykorzystywać później. Anthropic opisuje artifacts jako sposób na przekształcanie pomysłów w shareable apps, tools lub content, umieszczane w osobnym oknie od głównej rozmowy.  
Claude Projects tworzą osobne workspace’y z własną historią rozmów i bazą wiedzy. Użytkownik może uploadować dokumenty, tekst, kod i inne pliki do Project Knowledge, a Claude wykorzystuje je jako kontekst dla rozmów w projekcie.  
Co jest mocne:  
bardzo naturalny model chat + artifact;  
artifact pojawia się obok rozmowy, nie jako długa odpowiedź tekstowa;  
dobre wsparcie dla dokumentów, kodu, diagramów i prostych aplikacji;  
Project Knowledge daje kontekst projektowy;  
artifacts mogą być rozwijane iteracyjnie;  
w nowszym modelu Claude artifacts mogą integrować się z zewnętrznymi usługami przez MCP na wybranych planach.  
Czego brakuje dla Consultify:  
pełnego lifecycle: draft → review → approved → client-ready → published;  
enterprise audit trail;  
źródłowania na poziomie bloku, tezy, liczby i rekomendacji;  
artifact graph między dokumentem, tabelą, prezentacją, taskami i inicjatywami;  
workflow konsultingowego: discovery → diagnosis → recommendation → implementation;  
mocnego diff / accept / reject jak w środowiskach programistycznych;  
jasnego podziału internal/client-ready.

2.2. ChatGPT Canvas / ChatGPT Projects  
Canvas w ChatGPT jest interaktywną przestrzenią do współpisania, edycji i debugowania obok rozmowy. OpenAI opisuje Canvas jako workspace, gdzie użytkownik może bezpośrednio edytować tekst lub kod, korzystać ze skrótów do zmian długości tekstu, debugowania kodu i przywracania poprzednich wersji.  
ChatGPT Projects dodają kontekst projektowy, pliki, narzędzia i uporządkowane miejsce pracy. OpenAI wskazuje, że w projektach można korzystać między innymi z Canvas, file upload, web search, voice mode i innych narzędzi w ramach skupionego workspace’u.  
Co jest mocne:  
edycja tekstu i kodu bezpośrednio w canvasie;  
możliwość pracy na zaznaczonych fragmentach;  
wersjonowanie w prostym modelu;  
połączenie z projektem i plikami;  
lepszy model niż klasyczny chat.  
Czego brakuje dla Consultify:  
artifact nie jest pełnym obiektem biznesowym z własnym statusem, ownerem, approvalem i źródłami;  
canvas jest bardziej narzędziem edycji niż systemem execution;  
brakuje natywnego przejścia do inicjatyw, tasków, decyzji, tabel i prezentacji;  
brakuje modelu consulting-grade provenance.

2.3. Cursor / AI IDE pattern  
Cursor jest najważniejszym benchmarkiem koncepcyjnym, ale nie dlatego, że Consultify ma być IDE. Cursor pokazuje wzorzec pracy, w którym AI zna kontekst projektu, pracuje na plikach, proponuje zmiany, pokazuje diff, pozwala akceptować lub odrzucać zmiany i działa agentowo. Oficjalna dokumentacja Cursor obejmuje Agent mode, Rules, Skills, MCP, CLI, modele i setup dla zespołów oraz enterprise.  
Anthropic opisuje podobny agentic coding pattern w Claude Code: system czyta codebase, wykonuje zmiany w plikach, uruchamia testy i dostarcza gotowy kod.  
Najważniejsza analogia:  
Cursor jest dla kodu tym, czym Consultify Workbench powinien być dla konsultingu.  
Cursor:  
zna pliki;  
rozumie kontekst repozytorium;  
proponuje zmiany;  
pokazuje diff;  
pozwala accept/reject;  
działa agentowo.  
Consultify powinien:  
znać artifacty;  
rozumieć klienta, projekt, źródła i cele;  
proponować zmiany w dokumentach, tabelach, prezentacjach, analizach i rekomendacjach;  
pokazywać diff;  
pozwalać accept/reject;  
pilnować źródeł, wersji, statusów i approvali;  
zamieniać pracę intelektualną w execution.

2.4. Microsoft Copilot Pages  
Microsoft Copilot Pages jest bardzo istotnym wzorcem enterprise. Microsoft opisuje Pages jako interaktywny canvas, który przekształca odpowiedzi Copilot w edytowalne, shareable treści. Copilot Chat i Copilot Pages mogą działać obok siebie, a użytkownik może promptami aktualizować lub rozwijać treść strony i zadawać pytania o jej aktualną zawartość.  
The Verge opisywał Copilot Pages jako „multiplayer AI collaboration” — przestrzeń, w której zespół może wspólnie edytować treść z Copilotem, bazując na danych z pracy.  
Co Consultify powinien wziąć:  
multiplayer AI collaboration;  
przekształcenie odpowiedzi AI w edytowalną treść;  
praca w kontekście danych firmowych;  
real-time collaboration.  
Czego brakuje:  
głębokiej logiki consulting execution;  
artifactów wielotypowych;  
statusów konsultingowych;  
mapowania artifact → inicjatywa → task → decyzja;  
mocnego modelu źródeł i assumptions.

2.5. Google Workspace Gemini side panel  
Google opisuje Gemini side panel jako boczny panel AI działający w Docs, Sheets, Drive i Gmail. Użytkownik może podsumowywać wątki, tworzyć i poprawiać tekst na podstawie dokumentu, podsumowywać arkusze, tworzyć tabele i formuły, generować slajdy i zadawać pytania o pliki z Drive.  
Wniosek: Google robi AI asystenta w istniejących narzędziach. Consultify powinien zrobić odwrotnie: nie doklejać AI do dokumentu, tylko zbudować AI-native artifact model, w którym dokument, tabela, slajd, decyzja i task są różnymi widokami obiektu pracy.

2.6. Notion AI / Coda pattern  
Notion AI wspiera generowanie, podsumowywanie, tłumaczenie, zmianę tonu, wyciąganie action items i pracę z zaznaczonym tekstem przez Ask AI. Notion rozwija też workspace AI, meeting notes, enterprise search, bazy danych, automatyzacje i agentów.  
Co jest mocne:  
dokument jako workspace;  
strony, bazy danych i wiedza w jednym miejscu;  
prosty UX;  
AI w kontekście strony;  
bazy danych i właściwości.  
Czego brakuje dla Consultify:  
brakuje rygoru consulting deliverables;  
brakuje source-backed rekomendacji;  
brakuje diff/approval jako centralnego patternu;  
brakuje project execution logic;  
AI jest pomocnikiem, ale nie operatorem całego procesu konsultingowego.

2.7. Gamma / Miro / FigJam / Figma  
Gamma jest ważnym benchmarkiem dla generowania i edycji prezentacyjnych artifactów. Gamma komunikuje eksport do PPT, PDF, PNG i Google Slides, publikowanie jako link/website/social post oraz tracking engagement metrics.  
Miro, FigJam, Figma, Lucid, Whimsical i Excalidraw pokazują siłę visual workspace: canvas, współpraca, komentarze, mapping, diagramy, flow, warsztaty. Ich ograniczenie jest jednak podobne: świetnie obsługują wizualną współpracę, ale rzadko mają pełne połączenie z artifact governance, źródłami, approvalem i consulting execution.

3. Luki rynku  
Rynek idzie od:  
chat as answer interface — AI odpowiada tekstem;  
chat as co-writing assistant — AI pomaga pisać;  
chat + side artifact workspace — AI tworzy obiekt obok rozmowy;  
AI agent operating inside a project workspace — AI działa na plikach, dokumentach i kontekście;  
consulting execution workspace — tego jeszcze rynek nie ma w pełnej formie.  
Największe luki:  
brak jednego artifact model dla dokumentów, tabel, prezentacji, procesów, notatek i decyzji;  
brak źródeł na poziomie bloku i tezy;  
brak oznaczania fact / inferred / assumption / recommendation;  
brak lifecycle artifactu;  
brak pełnego diff/accept/reject dla pracy konsultingowej;  
brak przejścia z rozmowy do execution;  
brak relacji artifact → decision → initiative → task;  
brak client-ready package;  
brak cross-artifact consistency check;  
brak silnego governance dla pracy z klientem enterprise.

4. Kluczowy insight  
Consultify Workbench nie powinien być bocznym podglądem odpowiedzi AI. Powinien być głównym miejscem pracy, w którym AI i człowiek wspólnie budują artifacty prowadzące do decyzji i wykonania.  
Claude Artifacts pokazuje prostotę. ChatGPT Canvas pokazuje edytowalność. Cursor pokazuje kontrolę zmian. Copilot Pages pokazuje collaboration. Notion pokazuje workspace. Gamma pokazuje presentation artifact. Miro pokazuje visual thinking.  
Consultify musi to połączyć w jeden consulting-grade model:  
chat + artifact + sources + versions + diff + approval + governance + conversion + execution

5. Rekomendowana nazwa  
Rekomendowana nazwa: Consultify Workbench  
Dlaczego:  
jest krótsza i silniejsza niż „AI Side Workspace”;  
nie ogranicza produktu do bocznego panelu;  
brzmi operacyjnie, a nie tylko edytorsko;  
pasuje do pracy konsultanta: analysis bench, drafting bench, decision bench, execution bench;  
może obejmować chat, artifact, canvas, source inspector, diff, review, export i conversion.  
Nazwy pomocnicze w dokumentacji technicznej:  
Artifact Workspace Engine — nazwa komponentu logicznego;  
Dual Pane Workbench — nazwa wzorca UI;  
Teresa Workspace — nazwa doświadczenia użytkownika;  
Live Artifact Workspace — nazwa trybu pracy.

6. Definicja funkcjonalna  
Consultify Workbench powinien mieć minimum 15 trybów.  
6.1. Chat + Artifact Mode  
Lewy panel: Teresa / Consultify Chat.  
Prawy panel: aktywny artifact.  
System utrzymuje wspólny kontekst: projekt, klient, źródła, zaznaczony fragment, historia decyzji, aktywny artifact, role użytkownika.  
6.2. Create Artifact from Prompt  
Użytkownik mówi:  
„Stwórz notatkę strategiczną dla zarządu na podstawie tej rozmowy.”  
System:  
rozpoznaje typ artifactu;  
proponuje strukturę;  
generuje draft;  
umieszcza go po prawej;  
zapisuje artifact jako obiekt.  
6.3. Create Artifact from Source Pack  
Artifact może powstać z:  
dokumentów;  
notatek;  
interview;  
meeting transcript;  
research sessions;  
whiteboardów;  
mindmap;  
process flow;  
tabel;  
CRM notes;  
uploaded files.  
6.4. Manual Artifact Editing  
Prawy panel musi być prawdziwie edytowalny. Użytkownik może ręcznie edytować markdown, rich text, tabele, checklisty, diagramy, slide outline, JSON, YAML, prompt, process flow.  
6.5. Selection-based AI Edit  
Użytkownik zaznacza fragment i mówi:  
„Skróć.”  
„Napisz bardziej executive.”  
„Dodaj argument CFO.”  
„Przepisz po angielsku.”  
„Dodaj źródła.”  
„Zamień to w tabelę.”  
„Zamień to w slajd.”  
System pokazuje propozycję i diff.  
6.6. AI Rewrite / Improve / Expand / Compress  
Tryby tonu:  
executive;  
board memo;  
legal;  
consulting;  
sales;  
investor;  
client-ready;  
internal draft;  
technical specification.  
6.7. AI Structural Editor  
AI może:  
dodać sekcje;  
zmienić kolejność;  
pogrupować;  
usunąć powtórzenia;  
dodać checklistę;  
dodać decision log;  
dodać action items;  
dodać risks / assumptions / next steps.  
6.8. Artifact Type Switcher  
Tryby:  
MD;  
document;  
table;  
slide outline;  
code;  
diagram;  
process;  
whiteboard;  
mindmap;  
checklist;  
dashboard.  
System musi odróżniać:  
widok tego samego artifactu;  
konwersję do nowego artifactu;  
eksport;  
promocję do innego modułu.  
6.9. Versioning & Diff Mode  
System pokazuje:  
wersje;  
zmiany AI;  
zmiany użytkownika;  
before/after;  
diff blokowy;  
diff semantyczny;  
rollback.  
6.10. Review / Approval Mode  
Statusy:  
draft;  
in review;  
approved;  
client-ready;  
published;  
archived.  
Funkcje:  
comments;  
suggestions;  
reviewer roles;  
approval notes;  
approval history.  
6.11. Source-backed Artifact Mode  
Każdy ważny fragment może mieć:  
źródło;  
cytat;  
link;  
dokument źródłowy;  
meeting transcript reference;  
confidence score;  
label: fact / inferred / assumption / recommendation.  
6.12. Artifact-to-Artifact Conversion  
Konwersje:  
document → presentation;  
note → decision table;  
whiteboard → structured table;  
mindmap → strategic memo;  
process flow → issue log;  
report → action plan;  
recommendation → initiative;  
action item → task.  
6.13. Multi-Artifact Workspace  
W jednej sesji:  
raport;  
tabela źródłowa;  
prezentacja;  
lista tasków;  
decision log;  
prompt dla kolejnego agenta.  
Wymagane:  
artifact tabs;  
aktywny artifact;  
relacje;  
dependency graph;  
linked sources.  
6.14. Agentic Work Mode  
AI działa krokowo:  
planuje zmianę;  
pokazuje plan;  
generuje propozycję;  
pokazuje diff;  
prosi o approval;  
stosuje zaakceptowane zmiany;  
zapisuje wersję;  
aktualizuje audit trail.  
6.15. Export / Publish Mode  
Eksport:  
MD;  
DOCX;  
PDF;  
PPTX;  
XLSX;  
CSV;  
HTML;  
client-facing link;  
internal package;  
artifact bundle.

