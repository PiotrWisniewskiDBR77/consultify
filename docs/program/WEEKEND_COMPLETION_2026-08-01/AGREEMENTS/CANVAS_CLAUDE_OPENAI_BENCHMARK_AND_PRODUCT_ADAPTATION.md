---
document_id: CANVAS-CLAUDE-OPENAI-BENCHMARK-ADAPTATION
surface: Canvas
status: DRAFT_FOR_OWNER_REVIEW
owner: piotr
prepared_by: codex
last_reviewed: 2026-07-31
sources_reviewed: 2026-07-31
---

# Canvas — Claude i OpenAI: benchmark oraz adaptacja Consultify

## 1. Cel

Celem nie jest wizualne skopiowanie konkurencji. Celem jest odwzorowanie
mechaniki, dzięki której jedno miejsce pracy może elastycznie zmieniać się z
dokumentu w analizę, diagram, prezentację albo interaktywne narzędzie, nie
tracąc rozmowy, historii i kontroli użytkownika.

Analiza opiera się na aktualnych materiałach producentów:

- [OpenAI — What is the canvas feature in ChatGPT?](https://help.openai.com/en/articles/9930697-what-is-the-canvas-feature-in-chatgpt-and-how-do-i-use-it)
- [OpenAI — Introducing canvas](https://openai.com/index/introducing-canvas/)
- [OpenAI Academy — Canvas](https://academy.openai.com/en/public/clubs/work-users-ynjqu/resources/canvas)
- [Anthropic — What are artifacts and how do I use them?](https://support.anthropic.com/en/articles/9487310-what-are-artifacts-and-how-do-i-use-them)
- [Anthropic — Discovering, publishing, customizing and sharing artifacts](https://support.anthropic.com/en/articles/9547008-discovering-publishing-customizing-and-sharing-artifacts)
- [Anthropic — AI-powered artifacts](https://support.anthropic.com/articles/11649427-use-artifacts-to-visualize-and-create-ai-apps-without-ever-writing-a-line-of-code)

## 2. OpenAI Canvas — istotne mechanizmy

### 2.1 Kontrolowana współedycja

Użytkownik edytuje tekst lub kod bezpośrednio, zaznacza dokładny fragment albo
cały blok i przekazuje instrukcję odnoszącą się do tego zakresu. AI może dodać
inline suggestion/comment, a użytkownik stosuje zmianę świadomie.

Adaptacja Consultify:

- selection jest obiektem pierwszej klasy z `artifactId`, `versionId`,
  `blockId/range` i snapshotem;
- Teresa otrzymuje selection wraz z kontekstem całego artefaktu, ale operacja
  zapisuje tylko wskazany zakres;
- każda odpowiedź edycyjna zwraca structured patch, preview oraz invalidation
  warunków, nie tylko nową pełną treść.

### 2.2 Skróty zależne od typu

OpenAI rozdziela akcje pisarskie i kodowe. Dla pisania udostępnia m.in.
suggestions, zmianę długości/poziomu i polish; dla kodu review, logs, comments,
fix bugs i portowanie.

Adaptacja Consultify: registry akcji jest zależne od `artifactType`, selection,
roli, lifecycle i capabilities. Dokument dostaje „Executive summary”, tabela
„Profile/Explain/Chart”, decision memo „Challenge assumptions”, prezentacja
„Improve slide narrative”, a inicjatywa „Completeness check”. Nie istnieje jeden
generyczny zestaw magicznych przycisków.

### 2.3 Wersje, zmiany i eksport

OpenAI udostępnia historię wersji, przywracanie i Show changes. Dokumenty można
eksportować m.in. do PDF, Markdown i Word, a kod do rozszerzenia właściwego dla
języka.

Adaptacja Consultify: wersja obejmuje content, typed blocks, references,
workflow state i evidence snapshot. Diff jest tekstowy, strukturalny albo
wizualny zależnie od typu. Eksport jest capability typu, nie statycznym menu.

### 2.4 Wykonanie i web preview

OpenAI pozwala wykonywać Python i pokazuje konsolę. Web preview może komunikować
się z zewnętrznymi podmiotami; produkt prosi użytkownika o potwierdzenie
nieznanej komunikacji.

Adaptacja Consultify: każdy executable/interactive artifact działa w sandboxie.
Network jest domyślnie wyłączony. Próba połączenia wychodzi przez host-mediated
request z nazwą domeny, metodą, klasą wysyłanych danych i jednorazową albo trwałą
zgodą administratora/użytkownika.

## 3. Claude Artifacts — istotne mechanizmy

### 3.1 Artefakt jako samodzielny obiekt

Claude wydziela znaczący, samodzielny rezultat do prawego okna. Oficjalnie
obsługuje dokumenty, kod, jednostronicowy HTML, SVG, diagramy/flowcharts i
interaktywne komponenty React. To najważniejsza lekcja: panel nie jest jednym
edytorem, lecz hostem wielu rendererów.

Adaptacja Consultify: Canvas hostuje pluginowe `artifact runtimes`. Każdy runtime
deklaruje schema, renderer, editor, actions, exportery, validator i sandbox
policy. Host odpowiada za identity, zapis, wersje, ACL, chat bridge i lineage.

### 3.2 Wiele artefaktów w rozmowie

Claude pozwala mieć kilka artefaktów w jednej rozmowie, przełączać je oraz
wskazać, który ma być modyfikowany.

Adaptacja Consultify: `conversation_artifact_links` jest relacją wiele-do-wielu.
Conversation ma `activeArtifactId`, ale Teresa może dostać jawnie wybrany zestaw
referencji. Switcher pokazuje typ, tytuł, wersję, status i nie zapisuje zmian do
przypadkowego artefaktu.

### 3.3 Iteracje, wersje i fork

Każda edycja tworzy wersję. Claude pozwala również wrócić do wcześniejszego
momentu rozmowy i stworzyć inną gałąź oraz użyć Customize/Remix, pozostawiając
oryginał nienaruszony.

Adaptacja Consultify:

- `restore` tworzy nowy head oparty na starej wersji;
- `fork` tworzy nowy artifact lineage z `forkedFrom`;
- `remix` kopiuje do nowego owner/scope po sprawdzeniu praw i źródeł;
- zmiana wcześniejszej wiadomości tworzy conversation branch, a nie przepisuje
  historię audytową.

### 3.4 Interaktywne i AI-powered artefakty

Claude pozwala generować działające aplikacje i interaktywne doświadczenia oraz
osadzić ograniczone wywołania AI. Oficjalne ograniczenia obejmują brak
zewnętrznych API i trwałego storage w tym trybie. To świadoma izolacja runtime.

Adaptacja Consultify: interactive artifact nie dostaje bezpośredniego dostępu do
bazy, connectorów, tokenów ani API modułów. Korzysta z ograniczonego `Host SDK`:
`requestAI`, `readBoundData`, `proposeAction`, `emitOutput`, `openEntity`.
Każde wywołanie ma manifest capabilities, ACL, rate limit, audit i approval
zależny od ryzyka.

### 3.5 Publish, share i customize

Claude rozdziela oglądanie, interakcję i utworzenie własnej kopii. W środowisku
Work udostępnienie jest ograniczone do organizacji i wymaga dostępu do projektu;
publiczne embedy używają allowlisty domen.

Adaptacja Consultify: `view`, `interact`, `comment`, `edit`, `review`, `fork` i
`publish` są oddzielnymi capabilities. Share konkretnej wersji nigdy nie daje
automatycznie praw do rozmowy, załączników ani Client Vault. Embed wymaga
allowlisty domen, CSP i możliwego odwołania.

## 4. Macierz decyzji

| Wzorzec | OpenAI | Claude | Consultify |
| --- | --- | --- | --- |
| chat + praca obok | tak | tak | jeden conversation context |
| ręczna edycja | mocna | zależna od typu | obowiązkowa per runtime |
| selection edit | mocna | targeted updates | structured patch + diff |
| wiele artefaktów | ograniczone doświadczeniem Canvas | mocne | artifact switcher + explicit target |
| typy interaktywne | HTML/React preview, code | HTML/SVG/React/apps | sandboxed artifact plugins |
| historia | versions/show changes | versions/branches | versions + structural diff + fork |
| executable | Python/web preview | interactive apps | governed compute + Host SDK |
| publish/remix | share | publish/customize/embed | share/interact/fork with ACL |
| business objects | brak natywnej domeny Consultify | brak | proposals + module read-back |
| evidence/governance | produktowe zabezpieczenia | workspace/project controls | claim/source lineage + approvals |

## 5. Co kopiujemy, czego nie kopiujemy

Kopiujemy jako zasadę:

- artefakt jako obiekt pierwszej klasy;
- jeden chat i dedykowany work surface;
- automatyczne oraz ręczne otwarcie;
- wielotypowy renderer;
- bezpośrednią i AI-assisted edycję;
- selection-aware patches;
- wersje, diff, restore, fork;
- multiple artifacts per conversation;
- preview/source/interact zależnie od typu;
- share/publish/remix jako rozdzielone operacje;
- sandbox i zgodę na komunikację zewnętrzną.

Nie kopiujemy:

- konsumenckiego public-by-link jako ustawienia domyślnego;
- możliwości ujawnienia załączników rozmowy razem z artefaktem;
- pełnego rewrite przy drobnej zmianie;
- traktowania artefaktu jako izolowanej zabawki bez obiektów biznesowych;
- dowolnego kodu z bezpośrednim dostępem do infrastruktury firmy.

## 6. Docelowa przewaga Consultify

Claude i OpenAI kończą najczęściej na użytecznym artefakcie. Consultify ma
kontynuować:

```text
artifact -> verified conclusion -> decision/initiative/task/KPI/material
         -> execution -> measured result -> backlink to original reasoning
```

Elastyczność konkurencji jest warstwą doświadczenia. Naszą przewagą jest
połączenie jej z pamięcią organizacji, źródłami, rolami, zatwierdzeniami i
realizacją transformacji.
