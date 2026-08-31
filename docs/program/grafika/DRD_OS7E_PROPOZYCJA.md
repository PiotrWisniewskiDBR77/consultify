---
doc_id: drd-os7e-propozycja
status: draft
truth_type: proposal
established: 2026-08-30
autor_tekstu: Claude (CTO) — NIE właściciel
mandat: >
  Właściciel na pytanie o dziurę w obszarze 7E odpowiedział: „A weź, napisz sobie;
  jestem przekonany, że zrobisz to bez problemu." To jest wykonanie tego polecenia.
wymaga: AKCEPTACJI WŁAŚCICIELA przed wejściem do kodu, banku pytań i raportów
zrodlo_nadrzedne: knowledge/DRD/extracted_content.txt (oś 7, linie 2759+)
---

# Obszar 7E — propozycja opisu (do zatwierdzenia)

> **★ TO NIE JEST TEKST WŁAŚCICIELA.** To propozycja napisana w jego stylu i w jego
> metodyce, na jego wyraźne polecenie. Dopóki nie zostanie zaakceptowana, nie wolno jej
> cytować jako „Digital Pathfinder / DBR77" ani wprowadzać do pakietów oznaczonych
> `verbatim: true`. Po akcepcie — patrz sekcja „Miejsca do aktualizacji".

## Dlaczego ten dokument istnieje

`knowledge/DRD/7. Os AI opis.pdf` opisuje obszary 7A, 7B, 7C i 7D — i urywa się na
poziomie 5 obszaru 7D. Obszar **7E jest zapowiedziany we wstępie osi, ale nigdy nie
opisany**. Tymczasem produkt ocenia 7E, generuje z niego inicjatywy i wypisuje jego
poziomy w raporcie dla klienta — na treści, która powstała w dokumencie operacyjnym
`wdrozenia/modules/assessment/11-DRD-METHOD.md:596-602`, nie u autora metodyki.
Szczegóły ustaleń: `docs/program/grafika/DRD_KSIAZKA_KONTRA_KOD.md` (sekcja
„★ DZIURA W ŹRÓDLE").

## Jedyne zdanie autora o 7E — kotwica całej propozycji

To zdanie ze wstępu osi 7 jest jedynym autorskim materiałem o tym obszarze
(`knowledge/DRD/extracted_content.txt:2761`):

> 7E – AI Empowerment of Employees. Examines whether employees possess the **skills**,
> **tools** and **routines** to work effectively with AI in daily operations.

Trzy słowa autora — **kompetencje, narzędzia, rutyny** — są osią całej pięciostopniowej
skali poniżej. Każdy poziom pokazuje wszystkie trzy naraz, bo dopiero razem opisują
człowieka gotowego do pracy z AI. Do tych trzech dokładam czwarty, cichy wymiar:
**zaufanie** — uzasadnienie w sekcji „ZGŁASZAM".

## Granice obszaru (pilnowane w każdym zdaniu)

| pytanie | obszar |
| --- | --- |
| Czy dane nadają się dla modeli? | 7A |
| Czy **proces** jest wspierany lub prowadzony przez AI? | 7B |
| Czy **produkt** zawiera AI? | 7C |
| Czy istnieją **zasady, nadzór i etyka**? | 7D |
| **Czy człowiek potrafi, ma czym i robi to codziennie?** | **7E** |

Rym z osią 5, bez powtórzenia: oś 5 (obszary 5C i 5E) mierzy uczenie się i dostęp do
zasobów **w ogóle** — szkolenia, mentoring, dostęp do narzędzi i ekspertów. 7E mierzy
**wyłącznie zdolność do pracy z AI** i tylko na skali AI. Firma może mieć wzorową
kulturę uczenia się (5C = 6) i zerowe kompetencje AI (7E = 1); to nie jest sprzeczność,
tylko dokładnie ta informacja, po którą sięga się do osi 7.

---

# WERSJA POLSKA

## Obszar 7E — Kompetencje i kultura AI

### Wprowadzenie (dlaczego to ważne)

Sztuczna inteligencja nie wdraża się sama. Nawet przygotowane dane (7A), przemyślane
procesy (7B), produkty z AI (7C) i porządny nadzór (7D) nie dadzą efektu, jeśli ludzie
nie potrafią, nie mają czym albo nie chcą z AI pracować. Ten obszar bada trzy rzeczy:
**kompetencje** (czy pracownik umie), **narzędzia** (czy ma czym) i **rutyny** (czy robi
to codziennie, czy od święta). Czwarta, rzadziej nazywana, jest **kwestia zaufania**:
pracownik, który boi się o swoje miejsce pracy albo nie wierzy w wynik modelu, nie
użyje AI, choćby dostał najlepsze narzędzie na rynku. Doświadczenie z wdrożeń pokazuje,
że transformacje AI zatrzymują się najczęściej właśnie tutaj, a nie na technologii —
i że jest to obszar, w którym postęp jest najtańszy, bo nie wymaga inwestycji
kapitałowych, tylko konsekwencji.

Poniżej przedstawiono pięciopoziomową skalę umożliwiającą precyzyjną samoocenę.

---

### LEVEL 1 — Brak kompetencji AI, dominuje nieufność
*(EN: No AI Competencies, Distrust Prevails)*

**Jak to rozumieć.** Pracownicy nie mają żadnego przygotowania do pracy z AI i nie
potrafią wskazać zastosowania AI we własnej roli. Firma nie prowadzi szkoleń i nie
przewiduje ich w budżecie. Kontakt z AI jest przypadkowy i prywatny — ktoś raz o coś
zapytał czata w domu. Dominującą reakcją na słowo „AI" jest obawa o miejsce pracy albo
lekceważenie („to zabawka").

**Typowe praktyki / brak praktyk**
- Brak pozycji „AI" w planie szkoleń i w budżecie rozwoju
- Brak jakiejkolwiek roli odpowiedzialnej za kompetencje AI
- Jedyne narzędzia to darmowe wersje publicznych czatów, używane prywatnie
- Wiedza o AI pochodzi z mediów, nie z pracy

**Jak rozpoznać, że jesteś na tym poziomie**
- Mniej niż co piąty pracownik potrafi wskazać choć jedno zastosowanie AI w swoim dziale
- Nikt w firmie nie ma AI w zakresie obowiązków
- Na pytanie „kto u nas zna się na AI?" nie pada żadne nazwisko
- Rozmowa o AI kończy się pytaniem „to kogo zwolnią?"

**Przykład.** W 200-osobowej firmie produkcyjnej HR pyta w ankiecie: „czy używasz AI
w pracy?". Twierdząco odpowiada czternaście osób, w tym jedenaście z marketingu.
W rocznym planie szkoleń nie ma ani jednej pozycji z AI, a brygadziści na hali słyszeli
o AI wyłącznie z telewizji.

---

### LEVEL 2 — Pojedynczy entuzjaści, wiedza plemienna
*(EN: Individual Enthusiasts, Tribal Knowledge)*

**Jak to rozumieć.** Kilka osób używa AI z własnej inicjatywy i robi to nieźle, ale nikt
ich tego nie nauczył i nikt dokładnie nie wie, co robią. Wiedza jest plemienna — krąży
w kuluarach i znika razem z entuzjastą. Jakość efektu zależy od osoby, nie od firmy: ta
sama praca wykonana przez dwóch pracowników wygląda zupełnie inaczej. Nikt nie uczy,
kiedy AI się myli, więc wyniki bywają brane na wiarę.

**Typowe praktyki**
- Prywatne i darmowe konta w publicznych narzędziach
- Pojedyncze licencje kupione „na próbę" przez jeden dział
- Nieformalny kanał na czacie firmowym, gdzie entuzjaści wrzucają swoje sztuczki
- Zero standardu, zero zapisu, zero szkolenia

**Jak rozpoznać, że jesteś na tym poziomie**
- Da się wskazać po nazwisku dwie–pięć osób „od AI", ale żadna nie ma tego w roli
- Ktoś zaoszczędził czas dzięki AI, ale nikt nie potrafi tego powtórzyć
- Użycie AI rośnie samo, bez decyzji zarządu
- Kiedy entuzjasta idzie na urlop, jego usprawnienie przestaje działać

**Przykład.** Specjalistka z działu ofertowania sama nauczyła się przygotowywać wstępne
wersje ofert z pomocą czata i skróciła swoją pracę z trzech godzin do czterdziestu
minut. Nikt inny w dziale tego nie umie, przełożony wie o tym z korytarza, a sposób
pracy nie jest nigdzie zapisany. Po jej odejściu dział wraca do trzech godzin.

---

### LEVEL 3 — Przeszkolona załoga i zespołowe rutyny AI
*(EN: Trained Workforce & Team AI Routines)*

**Jak to rozumieć.** Firma przestaje liczyć na entuzjastów i zaczyna uczyć. Istnieje
program szkoleń z określonym zakresem (podstawy → jak pytać → AI w mojej roli),
harmonogram i wyznaczone osoby wspierające zespoły. Zespoły wypracowują własne rutyny:
sprawdzone polecenia, wzorce pracy, zasadę weryfikacji wyniku przed użyciem. Pracownik
potrafi powiedzieć nie tylko, do czego AI użyć, ale też kiedy jej nie ufać.

**Typowe praktyki**
- Firmowe licencje asystenta AI dla ról biurowych
- Wspólna biblioteka poleceń i wzorców pracy
- Rola wspierająca („AI champion") w każdym większym dziale
- Szkolenie z AI wpisane we wdrożenie nowego pracownika
- Wewnętrznie opisane i opowiedziane pierwsze udane zastosowania

**Jak rozpoznać, że jesteś na tym poziomie**
- Da się pokazać program szkoleń i listę uczestników, nie tylko intencję
- W kilku zespołach istnieje wspólny, zapisany sposób pracy z AI
- Pracownicy sprawdzają i poprawiają wynik AI, zamiast go kopiować
- Pierwsze oszczędności czasu są policzone i znane w firmie

**Przykład.** Dział obsługi klienta ma jedną wspólną bibliotekę poleceń do streszczania
zgłoszeń i przygotowywania odpowiedzi; nowy pracownik dostaje ją pierwszego dnia razem
z zasadą, że odpowiedź do klienta zawsze czyta człowiek. Czas przygotowania odpowiedzi
spada o jedną trzecią, a jakość jest porównywalna między pracownikami — bo sposób pracy
jest wspólny, a nie osobisty.

---

### LEVEL 4 — Biegłość AI w codziennej pracy
*(EN: Everyday AI Fluency)*

**Jak to rozumieć.** Praca z AI przestaje być tematem szkolenia i staje się sposobem
wykonywania obowiązków. Większość pracowników biurowych i znaczna część produkcyjnych
używa AI codziennie, we własnych zadaniach, bez asysty IT. Ludzie sami składają proste
automatyzacje i asystentów dla swojego zespołu, a kompetencja AI jest opisana
w profilach ról i sprawdzana przy rekrutacji. O AI rozmawia się konkretnie — co się
sprawdziło, a co nie — zamiast w kategoriach entuzjazmu albo strachu.

**Typowe praktyki**
- Platformy niskokodowe z AI udostępnione pracownikom, nie tylko IT
- Wewnętrzni asystenci działający na firmowej wiedzy
- Kompetencje AI w opisach stanowisk i ścieżkach rozwoju
- Stały rytm uczenia się: cykliczna wymiana rozwiązań między zespołami
- Pomiar realnego użycia, a nie liczby przeszkolonych

**Jak rozpoznać, że jesteś na tym poziomie**
- Użycie AI widać w danych z narzędzi, nie tylko w deklaracjach z ankiety
- Pracownicy pokazują automatyzacje, których nie zamawiał dział IT
- Rezygnacja z AI w danym zadaniu jest świadomą decyzją, a nie brakiem umiejętności
- Nowo zatrudniony musi umieć pracować z AI, żeby nadążyć za zespołem

**Przykład.** Planista produkcji sam zbudował sobie przepływ, który co rano zbiera
odchylenia z poprzedniej zmiany, streszcza je i przygotowuje projekt notatki na
odprawę. Nie zamawiał tego w IT, nie napisał linijki kodu i nie prosił o budżet —
a pozostali dwaj planiści przejęli to rozwiązanie w tydzień.

---

### LEVEL 5 — Załoga AI-native
*(EN: AI-Native Workforce)*

**Jak to rozumieć.** Podział pracy między człowieka a AI jest zaprojektowany, a nie
przypadkowy: pracownik wie, co oddaje maszynie, co zostawia sobie i po czym pozna, że
maszyna się pomyliła. Ludzie nie tylko używają AI — potrafią zlecać jej zadania,
nadzorować efekt i przeprojektować własną pracę, gdy narzędzie się zmienia. Kompetencja
AI jest elementem każdej roli, ścieżki awansu i pierwszego dnia w firmie, a nie osobnym
szkoleniem. Firma uczy już nie tylko siebie: przekazuje swój sposób pracy dostawcom,
klientom i nowym spółkom w grupie.

**Uwaga graniczna.** Ten poziom mierzy **zdolność ludzi**, a nie stopień automatyzacji
procesu — o tym mówi 7B. Firma może mieć procesy dopiero półautonomiczne i załogę
AI-native (ludzie są gotowi szybciej niż systemy) albo odwrotnie (kupione systemy
autonomiczne obsługiwane przez ludzi, którzy ich nie rozumieją). Oba przypadki są
realne i oba niosą inną rekomendację.

**Typowe praktyki**
- Role opisane przez podział zadań między człowieka a AI
- Nadzór nad agentami jako stały obowiązek, nie projekt
- Wewnętrzna akademia AI z własnymi materiałami i własnymi przypadkami
- Awans i wynagradzanie uwzględniają biegłość AI
- Firma dzieli się metodą na zewnątrz — z dostawcami, klientami, grupą kapitałową

**Jak rozpoznać, że jesteś na tym poziomie**
- Opis stanowiska mówi wprost, które zadania wykonuje AI pod nadzorem człowieka
- Pracownik potrafi wskazać, po czym pozna błąd swojego asystenta — i robi to rutynowo
- Zmiana narzędzia AI nie zatrzymuje pracy, bo ludzie umieją się przenieść
- Klienci i partnerzy pytają firmę o jej sposób pracy z AI

**Przykład.** W dziale zakupów każdy kupiec nadzoruje asystenta, który samodzielnie
zbiera zapytania ofertowe, porównuje warunki i przygotowuje rekomendację; kupiec
zatwierdza, negocjuje i odpowiada za wynik. Jest to zapisane wprost w opisie
stanowiska, nowy kupiec uczy się tego w pierwszym tygodniu, a firma prowadzi ten sam
kurs dla swoich dostawców.

---

# ENGLISH VERSION

## Area 7E — AI Empowerment of Employees

### Introduction (why it matters)

Artificial Intelligence does not deploy itself. Even prepared data (7A), well-designed
processes (7B), AI-enabled products (7C) and solid governance (7D) will produce nothing
if people cannot, do not have the means, or do not want to work with AI. This area
examines three things: **skills** (can the employee do it), **tools** (do they have the
means) and **routines** (is it daily practice or an occasional novelty). A fourth, less
often named, is **trust**: an employee who fears for their job or does not believe the
model's output will not use AI, however good the tool they are given. Experience from
transformation projects shows that AI programmes most often stall here rather than on
technology — and that this is the area where progress is cheapest, because it requires
consistency rather than capital.

The following five-level scale allows for a precise self-assessment.

---

### LEVEL 1 — No AI Competencies, Distrust Prevails

**How to understand it.** Employees have no preparation for working with AI and cannot
name a use for it in their own role. The company runs no training and has no budget line
for it. Contact with AI is accidental and private — someone once asked a chatbot
something at home. The dominant reaction to the word "AI" is fear for one's job or
dismissal ("it's a toy").

**Typical practices / absence of practices**
- No "AI" item in the training plan or development budget
- No role of any kind responsible for AI competencies
- The only tools are free versions of public chatbots, used privately
- Knowledge about AI comes from the media, not from work

**How to recognize this level**
- Fewer than one in five employees can name a single AI use case in their department
- Nobody in the company has AI in their job description
- "Who here knows about AI?" produces no name
- Conversations about AI end with the question "so who gets laid off?"

**Example.** In a 200-person manufacturing company, HR asks in a survey: "do you use AI
at work?". Fourteen people answer yes, eleven of them from marketing. The annual
training plan contains no AI item, and the shop-floor supervisors have heard of AI only
from television.

---

### LEVEL 2 — Individual Enthusiasts, Tribal Knowledge

**How to understand it.** A few people use AI on their own initiative and do it rather
well, but nobody taught them and nobody knows exactly what they do. The knowledge is
tribal — it circulates in corridors and leaves with the enthusiast. Output quality
depends on the person, not the company: the same task done by two employees looks
entirely different. Nobody teaches when AI is wrong, so results are sometimes taken on
faith.

**Typical practices**
- Private, free accounts on public tools
- A handful of licences bought "to try" by a single department
- An informal chat channel where enthusiasts post their tricks
- No standard, no record, no training

**How to recognize this level**
- You can name two to five "AI people", but none of them has it in their role
- Someone saved time using AI, but nobody can reproduce it
- AI usage grows on its own, without a management decision
- When the enthusiast goes on holiday, their improvement stops working

**Example.** A specialist in the bid department taught herself to draft initial
proposals with a chatbot and cut her work from three hours to forty minutes. Nobody else
in the department can do it, her manager knows about it from corridor talk, and the
method is written down nowhere. After she leaves, the department goes back to three
hours.

---

### LEVEL 3 — Trained Workforce & Team AI Routines

**How to understand it.** The company stops relying on enthusiasts and starts teaching.
A training programme exists with a defined scope (basics → how to ask → AI in my role),
a schedule and designated people supporting the teams. Teams develop their own routines:
proven prompts, working patterns, a rule that output is verified before use. Employees
can say not only what to use AI for, but also when not to trust it.

**Typical practices**
- Company licences for an AI assistant for office roles
- A shared library of prompts and working patterns
- A supporting role ("AI champion") in every larger department
- AI training built into new-employee onboarding
- First successful use cases documented and told internally

**How to recognize this level**
- You can show a training programme and an attendance list, not just an intention
- Several teams have a shared, written way of working with AI
- Employees verify and correct AI output instead of copying it
- The first time savings have been counted and are known across the company

**Example.** The customer service department has one shared library of prompts for
summarizing tickets and drafting replies; a new employee receives it on day one,
together with the rule that a human always reads the reply before it goes out. Reply
preparation time drops by a third, and quality is comparable between employees — because
the method is shared rather than personal.

---

### LEVEL 4 — Everyday AI Fluency

**How to understand it.** Working with AI stops being a training topic and becomes the
way the job is done. Most office staff and a significant share of production staff use
AI daily, on their own tasks, without IT assistance. People assemble simple automations
and assistants for their own teams, and AI competence is described in role profiles and
tested in recruitment. AI is discussed concretely — what worked and what did not —
rather than in terms of enthusiasm or fear.

**Typical practices**
- Low-code AI platforms made available to employees, not only to IT
- Internal assistants running on company knowledge
- AI competencies in job descriptions and development paths
- A steady learning rhythm: regular exchange of solutions between teams
- Measurement of actual usage, not of the number of people trained

**How to recognize this level**
- AI usage is visible in tool data, not only in survey declarations
- Employees demonstrate automations that IT never commissioned
- Choosing not to use AI for a task is a deliberate decision, not a lack of skill
- A new hire has to be able to work with AI to keep up with the team

**Example.** A production planner built himself a flow that every morning collects the
previous shift's deviations, summarizes them and drafts the note for the stand-up
meeting. He did not commission it from IT, wrote no code and asked for no budget — and
the other two planners adopted it within a week.

---

### LEVEL 5 — AI-Native Workforce

**How to understand it.** The division of labour between people and AI is designed, not
accidental: the employee knows what is handed to the machine, what stays with them, and
how they will recognize that the machine got it wrong. People do not merely use AI —
they can delegate tasks to it, supervise the outcome and redesign their own work when
the tool changes. AI competence is part of every role, of promotion paths and of the
first day at work, rather than a separate training course. The company now teaches more
than itself: it passes its way of working to suppliers, customers and newly acquired
companies.

**Boundary note.** This level measures **the capability of people**, not the degree of
process automation — that is 7B. A company may have merely semi-autonomous processes and
an AI-native workforce (people ready ahead of the systems), or the reverse (purchased
autonomous systems operated by people who do not understand them). Both cases are real
and each carries a different recommendation.

**Typical practices**
- Roles defined by the split of tasks between human and AI
- Supervision of agents as a standing duty, not a project
- An internal AI academy with its own materials and its own cases
- Promotion and pay take AI fluency into account
- The company shares its method externally — with suppliers, customers, the group

**How to recognize this level**
- The job description states outright which tasks AI performs under human supervision
- Employees can say how they will spot their assistant's error — and do so routinely
- Changing the AI tool does not stop the work, because people can move across
- Customers and partners ask the company about its way of working with AI

**Example.** In the procurement department each buyer supervises an assistant that
independently gathers quotations, compares terms and prepares a recommendation; the
buyer approves, negotiates and remains accountable for the result. This is stated
explicitly in the job description, a new buyer learns it in the first week, and the
company runs the same course for its suppliers.

---

# UZASADNIENIE — jedno zdanie na poziom

| poziom | nazwa | dlaczego tak |
| --- | --- | --- |
| 1 | Brak kompetencji AI, dominuje nieufność | Autor buduje poziomy 1 jako uczciwe „nie ma nic" z nazwaną przyczyną („Fragmented Data, **No AI Readiness**", „**No** AI Governance, **Uncontrolled Use**"), a realnym stanem większości firm nie jest neutralne zero, tylko zero plus lęk — dlatego nieufność jest w nazwie, nie w przypisie. |
| 2 | Pojedynczy entuzjaści, wiedza plemienna | Odpowiednik autorskiego „Isolated AI Experiments" przełożony na ludzi: użycie już jest, ale należy do osoby, nie do firmy — i to jest cała różnica między poziomem 2 a 3. |
| 3 | Przeszkolona załoga i zespołowe rutyny AI | Autor stawia na poziomie 3 pierwszą **organizacyjną** strukturę („Centralized Data", „Organization-Wide AI Governance Framework"), więc tutaj firma po raz pierwszy uczy systemowo i zespół ma wspólny sposób pracy zamiast osobistego. |
| 4 | Biegłość AI w codziennej pracy | Poziomy 4 u autora oznaczają, że rzecz działa powtarzalnie i na skalę, ale wciąż z człowiekiem w środku — po stronie ludzi odpowiednikiem jest codzienna biegłość i samodzielne budowanie własnych usprawnień. |
| 5 | Załoga AI-native | Autor rezerwuje poziom 5 dla stanu, w którym rzecz jest wbudowana w istotę organizacji („AI-**Native** Business Offerings", „data as a product"), więc odpowiednikiem po stronie ludzi jest zaprojektowany podział pracy człowiek–AI wpisany w role, awanse i pierwszy dzień w firmie. |

---

# CO WZIĘLIŚMY, A CO NAPISALIŚMY OD NOWA

## Ocena istniejących, nieautorskich opisów

Istnieją **dwa różne** nieautorskie zestawy treści 7E i mają różną jakość.

**(A) Opisy poziomów w strukturze — SŁABE, do wymiany.**
`src/services/drdStructure.ts:1719-1758` i bliźniaczy `server/src/data/drdStructure.ts:1730-1769`
(„No Competencies" / „Ad-hoc Usage" / „Organized Development" / „AI Fluency" /
„AI-Native Workforce"). Trzy wady:
1. **Jedno zdanie na poziom**, podczas gdy 7A–7D dostają akapit, listę technologii
   i listę „jak rozpoznać". Na ekranie i w raporcie 7E widać jako obszar-kikut obok
   czterech pełnych.
2. **Nazwy są rodzajowe** — „Ad-hoc Usage", „Organized Development" mogłyby opisywać
   dowolny obszar dowolnej osi. Autor nazywa konkretnie i branżowo („Structured Data
   in Silos", „Semi-Autonomous Processes").
3. **Brak przykładu, technologii i kryteriów rozpoznania** — czyli brak wszystkiego,
   czym konsultant faktycznie ocenia. Opis, po którym nie da się postawić oceny,
   nie robi swojej roboty.

**(B) Bank pytań i dowodów — DOBRY, do zachowania z poprawkami.**
`src/services/assessmentKnowledge/drdKnowledgeOverridesAxis5To7.ts:1199-1274` (+ `.en.ts`,
+ `qbank/v2/*.md:1099-1164`). Pytania są **dowodowe, nie ankietowe** — pytają o raport
z LMS, o pozycję w planie HR, o galerię automatyzacji, o checklistę onboardingu. To jest
dokładnie ten poziom konkretu, którego wymaga metodyka wywiedziona z VDA 6.3, i tego
**nie należy wyrzucać**. Cztery usterki do naprawienia przy okazji:
- **Progi 1 i 2 się nakładają:** poziom 1 ma dowód „< 20% odpowiedzi «tak»", poziom 2
  „co najmniej 10–20% pracowników używa AI". Firma z wynikiem 15% pasuje do obu.
- **Wartości progowe (70%, 40%, 60%, 20%) nie mają podanego źródła** — nie wiadomo,
  czy to pomiar, benchmark, czy wyczucie autora dokumentu operacyjnego.
- **Zaszyte daty** („plan HR 2025", „AI ROI 2025", „raport za 2024/2025") zestarzeją
  dokument w produkcie.
- **Literówki:** `7E#1` „skeptycyzm" (poprawnie: sceptycyzm); przy okazji w 7D
  „data approvalem" (`7D#3`) i „przed deploym" (`7D#5`).

**Wniosek:** progresja 1→5 zaproponowana w dokumencie operacyjnym jest **trafna** i jest
zgodna z jedynym zdaniem autora (kompetencje → narzędzia → rutyny). Zła jest tylko
**warstwa prozy**. Dlatego progresję zachowujemy, a prozę piszemy od nowa.

## Tabela: co skąd

| element | źródło | decyzja |
| --- | --- | --- |
| Trzy filary obszaru (kompetencje, narzędzia, rutyny) | **autor**, `extracted_content.txt:2761` | wzięte dosłownie jako oś skali |
| Kierunek progresji 1→5 (brak → entuzjaści → szkolenia → codzienność → agenci) | dokument operacyjny `11-DRD-METHOD.md:596-602` | **zachowane** — jest trafne |
| Nazwa poziomu 5 „AI-Native Workforce" | istniejący kod `drdStructure.ts` | **zachowana** — jedyna nazwa w tym zestawie w rejestrze autora („AI-Native Business Offerings") |
| Nazwy poziomów 1–4 | — | **napisane od nowa**; stare były rodzajowe i nie odróżniały 7E od dowolnego innego obszaru |
| Opisy „Jak to rozumieć" (wszystkie 5) | — | **napisane od nowa**; stare miały po jednym zdaniu przy akapicie u sąsiadów |
| Sekcje „Typowe praktyki" i „Jak rozpoznać" | forma autorska z 7A–7D | **dopisane**, bo 7E bez nich stoi niżej niż cała reszta osi |
| Przykłady per poziom | forma autorska z osi 5 (Kodak, Jobs, firma kosmetyczna) | **napisane od nowa**, fikcyjne-typowe, bez nazw firm |
| Pytania dowodowe i dowody | bank pytań (nieautorski) | **do zachowania po poprawieniu progów, dat i literówek** |
| Wątek zaufania / lęku o pracę | — | **moja interpretacja** — patrz ZGŁASZAM |

---

# MIEJSCA DO AKTUALIZACJI PO AKCEPCIE

**Nic z tego nie zostało dotknięte w tej sesji.** Lista jest kompletna na dzień
2026-08-30; przed edycją zweryfikuj numery linii, bo pliki żyją.

| # | plik:linia | co zmienić |
| --- | --- | --- |
| 1 | `src/services/drdStructure.ts:1718-1754` | pięć `title` + `description` obszaru 7E (pole `name` — patrz uwaga o nazwie obszaru niżej) |
| 2 | `server/src/data/drdStructure.ts:1729-1765` | **druga kopia tej samej prawdy** — musi zostać zmieniona identycznie, inaczej front i backend rozjadą się w treści raportu |
| 3 | `src/services/assessmentKnowledge/drdKnowledgeOverridesAxis5To7.ts:1199-1274` | poprawka progów 1/2, usunięcie zaszytych dat, literówka „skeptycyzm" |
| 4 | `src/services/assessmentKnowledge/drdKnowledgeOverridesAxis5To7.en.ts:1199-1274` | to samo w EN (plik jest lustrem PL, trzeba trzymać parzystość) |
| 5 | `knowledge/tool-kb/drd/qbank/v2/drd-qbank-axis5-7.pl.md:1099-1164` | przepakowanie banku pytań pod wyszukiwanie — musi zgadzać się z #3 |
| 6 | `knowledge/tool-kb/drd/qbank/v2/drd-qbank-axis5-7.en.md:1099-1164` | to samo w EN — musi zgadzać się z #4 |
| 7 | `knowledge/tool-kb/drd/methodology/v1/drd-methodology-axis7-ai.en.md` (koniec pliku, po sekcji `axis7-ai-p13`) | **★ decyzja właściciela wymagana:** pakiet deklaruje w nagłówku `verbatim: true` i `source_author: Piotr Wisniewski, PhD`. Dopisanie 7E albo złamie tę deklarację, albo wymaga oznaczenia sekcji 7E osobnym znacznikiem (np. `verbatim: false`, `source: proposal-approved`). Nie wolno wkleić tego tekstu pod istniejący nagłówek bez rozstrzygnięcia. |
| 8 | `wdrozenia/modules/assessment/11-DRD-METHOD.md:596-602` | źródło dzisiejszej treści — pięć skrótów jednolinijkowych do zsynchronizowania z zatwierdzoną wersją |
| 9 | `tests/unit/services/drdStructure.test.ts:216-241` | **testy przybijają dzisiejsze nazwy**: `'No Competencies'` (l. 229), `'AI-Native Workforce'` (l. 234), `'AI Fluency'` (l. 239) i `toContain('upskilling')` (l. 240). Bez zmiany testów akceptowana treść nie przejdzie CI. |
| 10 | `tests/unit/assessment/drdKnowledgeAxis5To7.test.ts:236-240` | asercja na `7E#5` (`/agent\|roi\|agentic\|autonomi/`) — propozycja ją spełnia, ale sprawdź po przepisaniu pytań |
| 11 | `docs/product/DRD_CANON.md:84` | nazwa obszaru 7E, jeśli właściciel zdecyduje o zmianie nazwy (niżej) |
| 12 | `docs/program/grafika/DRD_KSIAZKA_KONTRA_KOD.md:183-193` | sekcja „★ DZIURA W ŹRÓDLE" — po akcepcie zamknąć i wskazać ten dokument jako rozstrzygnięcie |

**Nie ruszać:** `docs/qa/deliverables/runs/DRD-REPORT-SAMPLE.html` i pliki w
`docs/program/waves/.../evidence/` — to zamrożone dowody z przebiegów, nie źródła.

## ★ Osobna decyzja: nazwa obszaru 7E rozjeżdża się z autorem

| źródło | nazwa |
| --- | --- |
| **autor**, wstęp osi 7 | **AI Empowerment of Employees** |
| kod (`drdStructure.ts`, oba pliki) | AI Competencies and Culture / Kompetencje i Kultura AI |
| `DRD_CANON.md:84`, raporty | Kompetencje i kultura AI |

Kod przemianował obszar autora. Polska nazwa „Kompetencje i kultura AI" jest dobra
i **szersza** niż angielski oryginał (obejmuje kulturę, o którą tu też chodzi), ale
angielska nazwa autora zniknęła bez decyzji. Do rozstrzygnięcia przez właściciela —
**nie zmieniam samodzielnie**, bo to jest nazwa w jego metodyce, a nie usterka
implementacji.

---

# ★ ZGŁASZAM

Miejsca, w których interpretowałem albo zgadywałem. Ten obszar wejdzie do produktu pod
nazwiskiem właściciela, więc każde takie miejsce ma tu być wskazane palcem.

1. **Wątek zaufania i lęku o pracę to moja interpretacja, nie wywód ze źródła.**
   Autor mówi o „skills, tools and routines" — trzech rzeczach. Czwartą, zaufanie,
   dołożyłem sam. Uzasadnienie: polska nazwa obszaru w kodzie zawiera słowo „kultura",
   a wstęp osi 5 mówi wprost, że porażki transformacji biorą się z zaniedbania kultury
   organizacyjnej. To jest rym, nie cytat. **Gdyby właściciel uznał, że 7E ma być
   wyłącznie o umiejętnościach, poziom 1 traci nazwę i pół akapitu.**

2. **Nie znalazłem żadnego autorskiego zdania o poziomach 7E — ani jednego.**
   Sprawdzone trzema drogami: ekstrakcja PDF (`extracted_content.txt`, oś 7 kończy się
   na 7D poziom 5), przepakowanie `tool-kb/methodology/v1` (13 sekcji, ostatnia to
   nadzór), oraz starsza książka drukowana w `uploads/` (nie zawiera osi 7 w ogóle).
   Cała skala poniżej jednego zdania wstępu jest **wnioskowaniem z rytmu 7A–7D**,
   nie odtworzeniem tekstu.

3. **Nie wiem, czy autor chciałby tu przykładów z nazwiskami i markami.**
   W osi 5 używa realnych (Kodak, Jobs, Branson, Musk, Buffett), w osi 7 — nie używa
   ich wcale (przykłady są rodzajowe: „Przykład (fabryka)"). Poszedłem za osią 7:
   przykłady typowe, bez nazw firm. **Jeśli 7E ma mieć markę jak oś 5 — to jest
   świadoma zmiana, nie poprawka.**

4. **Progi liczbowe świadomie wyrzuciłem z opisów poziomów.**
   Dokument operacyjny podaje „>70%", „40%", „60%". Nie umiałem ich uzasadnić żadnym
   źródłem, a w opisie poziomu wyglądałyby na pomiar. Zostawiłem je wyłącznie w banku
   pytań (gdzie pełnią rolę pomocniczą dla konsultanta) i zgłaszam nakładanie się
   progów 1 i 2 jako usterkę. **Jeśli te liczby mają jakieś źródło u właściciela —
   wracają do opisów i całą sprawę zamyka jedno zdanie od niego.**

5. **Granica z 7B na poziomie 5 jest cienka i wiem o tym.**
   „Pracownik nadzoruje agenta" da się przeczytać i jako kompetencję (7E), i jako
   stopień autonomii procesu (7B poziom 4–5). Rozstrzygnąłem to na korzyść
   kompetencji i dopisałem jawną „Uwagę graniczną" w treści poziomu, żeby konsultant
   nie ocenił dwa razy tego samego. **To jest moje rozstrzygnięcie projektowe, nie
   ustalenie z autorem.**

6. **Podział na czystą wersję PL i czystą EN jest moim porządkiem, nie autora.**
   Autor pisze oś 7 z przeplotem: wstępy 7A i 7C po angielsku, 7B i 7D po polsku,
   poziomy po polsku z angielskimi nazwami. Odtworzyłem tę konwencję tylko w nazwach
   poziomów (angielskie, jak u niego), ale treść rozdzieliłem na dwa pełne języki,
   bo tego wymaga produkt (pliki `.pl.md`/`.en.md`, pola `name`/`namePL`).
   **Jeśli do książki ma trafić wersja z przeplotem — trzeba ją złożyć osobno.**

7. **Poziom 5 może być za wysoki dla polskiego MŚP produkcyjnego i nie umiem tego
   zweryfikować.** Wymaganie „firma uczy dostawców i klientów" jest osiągalne dla
   grupy kapitałowej, a dla stuosobowej firmy z Podkarpacia może być poza zasięgiem
   na lata. Utrzymałem je, bo poziom 5 u autora zawsze jest stanem elitarnym
   („własne modele", „firma sama wyznacza standardy rynku") — ale to jest kalibracja
   ambicji, którą powinien potwierdzić ktoś, kto tę bazę klientów zna. Ja jej nie znam.

8. **Nie zweryfikowałem, czy poza wymienionymi 12 miejscami nie ma trzeciej kopii
   treści 7E.** Sprawdziłem `grep` po `7E` w `src/`, `server/src/`, `knowledge/`,
   `docs/`, `wdrozenia/`, `tests/`. Nie sprawdzałem żywej bazy demo — jeśli opisy
   poziomów są gdziekolwiek zeseedowane do bazy, akcept wymaga też migracji, a tego
   **nie zmierzyłem**.
