# Chat v8 - Benchmark

> Status: Draft v8
> Cel: Zmapowac benchmark funkcjonalny liderow rynku i przelozyc go na docelowy model `Chat v8` dla `consultify`.

---

## 1. Po co istnieje ten dokument

`CHAT_V8_SSOT.md` ustawia cel produktu.
Ten dokument ustawia benchmark:
- co musi byc co najmniej tak dobre jak u liderow,
- czego nie kopiujemy 1:1,
- gdzie `consultify` ma dodac wlasna przewage.

Punkt odniesienia:
- `ChatGPT` jako wzorzec core assistant flow,
- `Claude` jako wzorzec library, files i longer-context work,
- `Perplexity` jako wzorzec research, retrieval i source transparency.

---

## 2. Benchmark matrix

| Capability area | ChatGPT | Claude | Perplexity | Target for Consultify |
|---|---|---|---|---|
| Core ask -> stream -> stop | bardzo mocne | mocne | mocne | musi dorownac |
| Simplicity of main shell | bardzo mocna | mocna | mocna | ma byc prosta mimo bogatszego systemu |
| Conversation history | dobre | bardzo mocne | dobre | ma byc blizej Claude niz ChatGPT |
| Folder/project semantics | ograniczone | bardzo mocne | ograniczone | musi byc leader-grade |
| Message edit / regenerate / branch | mocne | mocne | umiarkowane | musi byc jawnie opisane i konkurencyjne lub oznaczone jako baseline non-goal |
| Cross-thread memory and personalization | mocne | mocne | ograniczone | musi miec jawny trust contract |
| File work | mocne | bardzo mocne | srednie | ma byc co najmniej Claude-lite |
| Web/research grounding | ograniczone / mode-based | ograniczone | bardzo mocne | ma byc blizej Perplexity |
| Source transparency | umiarkowana | umiarkowana | bardzo mocna | musi byc jawna i uczciwa |
| Sharing and permissions | umiarkowane | mocne | ograniczone | musi miec explicit B2B contract |
| Rich in-thread outputs | mocne | bardzo mocne | umiarkowane | musi miec rendering and artifact boundary contract |
| Voice | mocne | ograniczone | ograniczone | ma byc spojne i prawdziwe |
| Vision / broader multimodal | mocne | mocne | umiarkowane | jawny non-goal baseline lub osobny future contract |
| Workspace co-working | ograniczone | umiarkowane | ograniczone | ma byc przewaga Consultify |
| Action execution | ograniczone | ograniczone | ograniczone | ma byc wyrazna przewaga Consultify |
| Artifact handoff | umiarkowane | umiarkowane | ograniczone | ma byc przewaga Consultify |
| Governance / HITL | umiarkowane | umiarkowane | ograniczone | ma byc przewaga Consultify |
| Enterprise retention/compliance | mocne | mocne | umiarkowane | musi miec explicit baseline/extension boundary |

---

## 3. ChatGPT lessons

### 3.1 Co trzeba przejac

- jeden prosty mental model glownego czatu,
- szybki streaming i zawsze czytelny `stop`,
- minimal friction przy `new chat`,
- czytelny model wyboru trybow i modelu,
- solidny voice feeling.

### 3.2 Czego nie kopiujemy 1:1

- nie kopiujemy vendor layoutu,
- nie kopiujemy model listy produktow/marketplace,
- nie kopiujemy generic consumer-first positioning.

### 3.3 Wniosek dla Chat v8

`Chat v8` musi miec tak samo czytelny core flow jak `ChatGPT`, ale z bogatszym modelem pracy i bez chaosu wynikajacego z dodatkowych funkcji.

---

## 4. Claude lessons

### 4.1 Co trzeba przejac

- mocna semantyka rozmow i library,
- sensowne folder/project grouping,
- bardzo dobra praca na plikach i dlugim kontekscie,
- poczucie, ze rozmowa moze byc "workspace of thought", a nie tylko transient chatem.

### 4.2 Czego nie kopiujemy 1:1

- nie kopiujemy vendorowego artifact shell,
- nie kopiujemy ich calego modelu projects jako jedynej jednostki organizacji,
- nie kopiujemy ich nazewnictwa.

### 4.3 Wniosek dla Chat v8

Historia `Chat v8` ma byc projektowana blizej `Claude` niz obecny standard zwyklej listy chatow:
- folders personal/team,
- revisit,
- search,
- lepszy lifecycle rozmowy,
- mocniejsze grounded file work.

---

## 5. Perplexity lessons

### 5.1 Co trzeba przejac

- jawne research mode semantics,
- uczciwe rozdzielenie odpowiedzi ogolnej od sourced answer,
- wyrazne source grounding,
- transparentnosc retrieval i citations.

### 5.2 Czego nie kopiujemy 1:1

- nie robimy z `consultify` pure web answer engine,
- nie redukujemy chatu do research-only UX,
- nie uzalezniamy calego produktu od web search.

### 5.3 Wniosek dla Chat v8

`Chat v8` musi jasno komunikowac:
- kiedy AI odpowiada z wiedzy ogolnej,
- kiedy uzywa `attachments`,
- kiedy uzywa `workspace context`,
- kiedy uzywa `web/research`,
- jaki jest stopien pewnosci i traceability.

---

## 6A. Explicit parity or non-goal decisions

For `Chat v8` each competitor-shaped area must be classified as one of:
- `parity`
- `consultify-plus`
- `explicit non-goal for baseline`

Current intended classification:
- core chat flow: `parity`
- history and folders: `parity`
- retrieval transparency: `parity`
- workspace co-working: `consultify-plus`
- governed actions: `consultify-plus`
- cross-thread memory: `parity target`
- message/thread operations: `parity target`
- sharing/permissions: `parity target`
- rich in-thread rendering: `parity target`
- broad vision multimodality: `explicit non-goal for baseline unless separately promoted`
- full enterprise compliance suite: `baseline + future extension split`

---

## 7. Direct comparison matrix

| Product concern | Best benchmark | Why | Chat v8 target |
|---|---|---|---|
| Main conversation clarity | ChatGPT | najmniej tarcia w core flow | jeden kanoniczny shell i route model |
| Library and revisit | Claude | najmocniejsza semantyka pracy na rozmowach | pelny history/library system |
| Files and grounded dialogue | Claude | naturalne file-centric work | local + URL + honest cloud story |
| Research transparency | Perplexity | zrodla i retrieval sa czescia UX | sourced answer contract i citations policy |
| Voice user confidence | ChatGPT | user wie, co robi voice | jeden spojny model voice |
| Contextual co-working | Consultify target | przewaga lokalna produktu | split mode + workspace context |
| Governed action execution | Consultify target | przewaga lokalna produktu | `propose -> review -> approve/reject -> audit` |

---

## 8. Gdzie obecny produkt odstaje od liderow

- dwa rownolegle shelle czatu zamiast jednej glownej surface,
- niespojny full vs split chat story,
- historia jest mocniejsza niz sugeruja stare dokumenty, ale nadal nie ma jednego kanonicznego modelu,
- retrieval i attachments sa realne, ale source transparency i scope semantics nie sa jeszcze domkniete,
- cloud UX overpromise'uje wzgledem runtime,
- voice ma czesciowy runtime, ale nie ma jednego user-facing contract,
- AI actions sa obiecujace, ale execution i governance wymagaja mocniejszego domkniecia.
- memory/personalization, message/thread operations i sharing nie byly jeszcze dospecyfikowane na poziomie leader-grade,
- rich output i enterprise/compliance potrzebuja explicit contracts, zeby nie zostaly domyslone przez zespoly.

---

## 9. Benchmark conclusions for v8

### 8.1 Must-have

- jeden canonical shell,
- leader-grade ask -> stream -> stop,
- mocny conversation lifecycle,
- grounded file and URL work,
- honest source and scope semantics,
- one coherent voice model.

### 8.2 Must-have unique to Consultify

- split mode with real workspace context,
- reviewable AI actions,
- artifact handoff,
- organizational and PMO-aware conversation support.

### 8.3 Must-not-do

- nie kopiowac UI vendorow 1:1,
- nie obiecywac capabilities bez realnego runtime,
- nie utrzymywac rownoleglej prawdy produktu pomiedzy starym i nowym shellem.
