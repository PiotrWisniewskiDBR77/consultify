# Chat v8 - As is

> Status: Draft v8
> Cel: Opisac obecny stan modulu chat na poziomie produktu, runtime i UX, bez mylenia realnych capabilities z historycznymi aspiracjami.

---

## 1. Executive verdict

Obecny chat w `consultify` ma mocny fundament, ale nie jest jeszcze jednym leader-grade produktem.

Najwazniejsze fakty:
- istnieje mocny nowy shell oparty o `UnifiedChatPanel`,
- routing full chat nadal prowadzi przez `AIChatWelcomeView`,
- historia rozmow jest bardziej rozwinieta niz sugerowaly starsze dokumenty,
- attachments, URL ingest i research gates sa czesciowo realne,
- actions i voice istnieja, ale ich user-facing contract nie jest jeszcze spiety w jedna prawde.

Wniosek:
- produkt nie jest greenfieldem,
- produkt nie jest tez jeszcze domknietym `v8-ready` systemem.

---

## 2. Canonical surfaces today

### 2.1 Modern runtime spine

Najsilniejsza obecna sciezka opiera sie o:
- `src/components/AIChat/UnifiedChatPanel.tsx`
- `src/components/AIChat/EnhancedChatInput.tsx`
- `src/components/AIChat/ChatHistorySidebar.tsx`
- `src/hooks/useAIStream.ts`
- `src/store/useConversationStore.ts`

To jest najlepsza baza dla `Chat v8`.

### 2.2 Legacy but live full-chat surface

Pelny route chat nadal opiera sie o:
- `src/views/AIChatWelcomeView.tsx`
- `src/routes/AppRoutes.tsx`

To tworzy rozdwojenie produktu:
- canonical docs i nowsze komponenty wskazuja na unified path,
- najwazniejsza route usera nadal idzie przez welcome path.

### 2.3 Split mode reality

Split chat jest realna przewaga produktu, ale jej runtime truth jest rozproszona miedzy:
- `MainLayout`,
- `SplitLayout`,
- `UnifiedChatPanel`,
- `WorkspaceContext`.

Najwazniejszy fakt:
- split mode jest realny,
- ale jego model nie jest jeszcze opisany jako jedna kompletna formula produktu.

---

## 3. Co juz dziala dobrze

### 3.1 Core chat flow

Realne i mocne:
- send message,
- streaming response,
- stop generating,
- error and retry patterns,
- message persistence,
- conversation route synchronization.

### 3.2 History and library

Realne i mocniejsze niz wczesniej zakladano:
- new chat,
- search,
- folders personal/team,
- folder drill-in,
- star/pin,
- archive/unarchive,
- rename,
- delete,
- move conversation to folder,
- drag and drop.

### 3.3 Attachments and retrieval

Realne:
- local file ingest,
- URL ingest,
- conversation-scoped attachment retrieval,
- deep research confirm gate,
- partial source-aware answer behavior.

### 3.4 Modes and settings

Realne:
- deep research,
- show reasoning,
- private mode,
- text to speech toggle,
- custom instructions,
- model/tier selection,
- co-thinker config path.

### 3.5 AI actions and save flows

Realne lub mostly real:
- pending action indicator,
- approve flow,
- save as note / idea and related artifact actions,
- some response/action handlers in current stack.

---

## 4. Co jest partial albo niespojnie domkniete

### 4.1 Two-shell problem

Najwiekszy problem produktu:
- `UnifiedChatPanel` i `AIChatWelcomeView` nie sa tym samym produktem,
- obie sciezki maja czesciowo inne controls i contracts.

### 4.2 Focus and scope semantics

Problem:
- `focusMode` istnieje jako concept,
- ale unified path nie ma jednego wyraznego i stalego control contract dla focus/scope.

### 4.3 Cloud attachments

Problem:
- browse/download moze byc realne,
- connect/OAuth w samym czacie nie jest realnie domkniete.

### 4.4 Source transparency

Problem:
- retrieval dziala,
- ale user-visible source contract nie jest wystarczajaco jednoznaczny,
- citations sa czesto best-effort, nie fully guaranteed.

### 4.5 AI actions execution semantics

Problem:
- propose/approve UI istnieje,
- ale approve vs execute nie sa wystarczajaco jasno opisane,
- reject flow ma co najmniej czesc client-side placeholder semantics.

### 4.6 Voice

Problem:
- runtime ma kilka elementow voice,
- user-visible contract jest slabszy niz kodowe mozliwosci,
- nie ma jednego prostego voice story.

---

## 5. Co jest fake, misleading albo legacy

### 5.1 Legacy feedback/report paths

W legacy shellu czesc feedback/report behavior nie reprezentuje twardego, nowoczesnego runtime contract.

### 5.2 In-chat cloud connect promise

UI moze sugerowac wieksza kompletnosc cloud connect niz realnie daje runtime.

### 5.3 Old docs as SSOT

Stare dokumenty:
- sa cenne jako background,
- ale nie sa bezpieczna pojedyncza prawda dla dalszego rozwoju.

### 5.4 Orphan or transitional surfaces

W stacku istnieja tez surface'y lub propsy, ktore sugeruja pelniejszy model niz ten faktycznie uzywany w routingu.

---

## 6. Product strengths worth preserving

- `UnifiedChatPanel` jako baza nowego shellu,
- `ChatHistorySidebar` jako mocny start dla library system,
- `useConversationStore` jako sensowny state spine,
- grounded attachments i URL ingest,
- deep research confirm flow,
- split workspace assistance,
- action-aware chat,
- artifact handoff potential.

---

## 7. Product weaknesses that v8 must resolve

- usunac rozjazd miedzy full-chat route a canonical shell,
- sformalizowac jedna prawde dla historii i folderow,
- sformalizowac scope/focus and source model,
- domknac difference between partial and real cloud flows,
- uczynic action governance i execution semantics jednoznacznymi,
- zamienic voice z "possible in code" na "clear in product",
- przestac traktowac stare docs jako rownorzedne SSOT.

---

## 8. As-is maturity summary

| Layer | As-is maturity | Verdict |
|---|---|---|
| Core chat streaming | strong | ready to keep and harden |
| History and library | medium-high | strong base, needs formal product model |
| Retrieval and attachments | medium | real foundation, needs honesty and transparency |
| Scope and modes | medium | real toggles, incomplete product semantics |
| AI actions | medium | promising, needs canonical governance contract |
| Voice | low-medium | real components, incomplete product story |
| Full vs split shell coherence | low | biggest structural gap |
| Documentation coherence | low | requires full `Chat v8` package |
