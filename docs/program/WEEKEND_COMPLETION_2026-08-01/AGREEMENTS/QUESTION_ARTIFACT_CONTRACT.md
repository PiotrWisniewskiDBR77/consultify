---
document_id: QUESTION-ARTIFACT-CONTRACT
scope: cross-application
primary_module: Interview
status: DRAFT_FOR_OWNER_REVIEW
owner: piotr
prepared_by: codex
last_reviewed: 2026-07-31
---

# Question Artifact — kanoniczny kontrakt pytania

## 1. Definicja

`Question Artifact` jest wersjonowanym obiektem służącym do pozyskania jednej
określonej informacji, decyzji, oceny albo dowodu od właściwej osoby. Nie jest
wyłącznie tekstem zakończonym znakiem zapytania.

Ten sam rdzeń obiektu obsługuje Interview, Assessment i Audits. Profile
metodologiczne rozszerzają go o własne reguły; nie tworzą niezgodnych modeli.

## 2. Anatomy pytania

### Tożsamość i governance

- `questionId`, stable key, version i lifecycle status;
- owner, author, reviewer i methodology/source reference;
- organization/global scope, language i translations;
- created/updated/published/superseded timestamps;
- licence, confidentiality i retention policy.

### Cel

- canonical wording;
- intent — jaką informację chcemy uzyskać;
- why it matters;
- decision/insight/score, który pytanie ma wspierać;
- audience i likely respondent roles;
- topic, category, competency/process/dimension tags.

### Sposób odpowiedzi

- answer type i jego schema;
- options/scale anchors/unit/format;
- required, optional, skippable lub conditional;
- validation oraz minimum/maximum;
- expected answer shape;
- dozwolone modality: text, voice, file, URL, artifact link, context note;
- states `I don't know`, `Not applicable`, `Need help` i ich wymagane reason.

### Help

- plain-language explanation;
- term/glossary references;
- neutral example odpowiedzi;
- common misunderstanding;
- expected evidence i evidence quality hint;
- dozwolone działania Teresy;
- escalation/assign-to-expert route.

### Routing

- sequence/order i section;
- display condition;
- branching/follow-up rules;
- prerequisite/dependency;
- stop/skip condition;
- question asked reason;
- return/edit policy.

### Jakość i pomiar

- hypothesis/coverage mapping;
- sensitivity i bias risk;
- scoring/attribute mapping tylko dla profilu, który go wymaga;
- estimated time i cognitive load;
- quality checks oraz acceptance criteria;
- analytics eligibility bez ujawniania prywatnej treści.

## 3. Profile pytania

| Profil | Cel | Obowiązkowe rozszerzenie |
| --- | --- | --- |
| Interview | pozyskanie doświadczenia, wiedzy lub perspektywy | hypothesis, topic, respondent role, insight objective |
| Assessment | ustalenie stanu względem metody | unit/level/attribute, evidence rule, scoring constraint |
| Audit | sprawdzenie zgodności/wymagania | clause/control, conformity rule, finding/evidence mapping |
| Meeting | pytanie facylitacyjne w rozmowie | agenda context, target participant, capture policy |
| Tools | pytanie prowadzące metodę | tool step/cell/node, method intent, output mapping |

`Question Artifact` nie może sam zmieniać profilu. Konwersja tworzy nową wersję
lub nowy obiekt z relation `derived_from`.

## 4. Typy odpowiedzi

Rdzeń wspiera co najmniej:

- open text i long text;
- single/multi select;
- boolean z trzecią opcją uncertainty, jeśli potrzebna;
- rating/scale z opisanymi anchorami;
- number, percentage, currency i unit;
- date/date range;
- person/team/process/object reference;
- ranking/prioritisation;
- evidence request;
- matrix/table tylko wtedy, gdy upraszcza serię spójnych pytań.

Typ odpowiedzi wynika z intentu. Nie używamy skali tam, gdzie potrzebny jest
fakt lub dowód, ani open text tam, gdzie użytkownik potrzebuje porównywalności.

## 5. Lifecycle i wersjonowanie

`Draft → In review → Published → In use → Retired → Superseded`

- opublikowane pytanie użyte w sesji jest immutable dla tej sesji;
- korekta tworzy nową wersję;
- Answer przechowuje exact question version;
- aktywna sesja nie otrzymuje cichej zmiany wording/options/branching;
- migration wymaga preview wpływu i jawnej decyzji;
- tłumaczenie ma status i review niezależne od wersji bazowej.

## 6. Question Card — standard UI

Karta runtime pokazuje najpierw:

1. numer/sekcję i progress;
2. canonical question;
3. krótkie wyjaśnienie, jeśli potrzebne;
4. kontrolkę odpowiedzi;
5. akcje voice/evidence/context/help;
6. zapis i stan walidacji;
7. previous/next oraz bezpieczne exit.

Głębszy help jest progresywny. Nie tworzymy ściany metodologii nad odpowiedzią.
Po powrocie zachowujemy odpowiedź, otwarty help, question ID i pozycję.

## 7. Rola Teresy

Teresa może wyjaśnić pytanie, podać neutralny przykład, rozbić je na prostsze
podpytania, poprosić o konkret, pomóc znaleźć evidence i podsumować odpowiedź
jako propozycję.

Nie może zmienić intentu, sugerować pożądanej odpowiedzi, uznać przykładu za
fakt, odpowiedzieć za człowieka ani przeliczyć niepewności na pozytywny score.

## 8. Quality Gate pytania

Pytanie jest publishable, jeśli:

- ma jeden jasny intent i jest odpowiednie dla audience;
- nie łączy kilku niezależnych pytań;
- jest neutralne, konkretne i możliwe do udzielenia odpowiedzi;
- answer type, options i validation pasują do intentu;
- help nie zdradza „prawidłowej” odpowiedzi;
- branching ma pełne ścieżki i nie tworzy dead end;
- required ma uzasadnienie;
- wymagane evidence i privacy są określone;
- nie jest niewyjaśnionym duplikatem;
- ma source/methodology reference i reviewer decision.

## 9. Antywzorce

- pytanie bez celu i downstream use;
- dwa lub więcej pytań w jednym;
- pytanie sugerujące odpowiedź albo używające oceniającego języka;
- skala bez opisanych anchorów;
- required wszystko „na wszelki wypadek”;
- przykład zawierający wymyślone dane organizacji;
- help będący powtórzeniem wording;
- branching oparty na wolnym tekście bez bezpiecznej reguły;
- zmiana opublikowanego pytania w trwającej sesji;
- AI answer zapisany jako wypowiedź respondenta.

## 10. Definition of Done

- jeden model rdzeniowy i jawne profile;
- renderer wszystkich wspieranych answer types;
- pełne loading/empty/error/permission/save states;
- keyboard, screen reader i mobile usability;
- version pinning i answer lineage;
- działające help, evidence, voice i return/edit;
- branching graph validation;
- test neutralności, required policy i privacy;
- brak utraty danych przy zmianie trybu runtime.
