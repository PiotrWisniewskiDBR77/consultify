---
document_id: RUN-AGENT-BENCHMARK-PRODUCT-DOCTRINE
module: My Work / Run Agent
status: DRAFT_FOR_OWNER_REVIEW
owner: piotr
prepared_by: codex
last_reviewed: 2026-07-31
---

# Run Agent — benchmark rynku i doktryna produktu

## 1. Metoda

Benchmark rozdziela potwierdzone funkcje od naszej adaptacji. Harvey daje wzór
profesjonalnego workflow opartego na wiedzy i artifacts. n8n/Make/Zapier dają
wzór integracji, triggerów i niezawodności. Microsoft Copilot Studio daje wzór
łączenia agentów, flows, connectorów i human review. Consultify musi połączyć te
światy z metodyką konsultingową i lifecycle zmiany.

## 2. Harvey Agent Builder — potwierdzony wzorzec

Oficjalna dokumentacja Harvey potwierdza:

- tworzenie agent workflow z opisu naturalnym językiem (`Build with Harvey`);
- dalsze poprawianie procesu rozmową i manualną edycją bloków;
- modularne kroki: User Input, AI Action, Logic i Output;
- conditional branching i prompt chaining;
- output labels oraz użycie wartości przez `@` w kolejnych krokach;
- optional input z embedded default context;
- osobne knowledge sources per prompt step — nie dziedziczą się automatycznie;
- Deep Analysis, web i Vault/KB jako źródła;
- drafting/editing Word, PowerPoint i Excel, również na wcześniejszym output;
- tworzenie i użycie Review Tables;
- test mode, draft vs explicit publish i follow-ups;
- poziomy dostępu Run, View, Edit, Full access;
- automatyczne `Improve Workflow` oraz organizacyjny katalog/admin export.

Wnioski dla Consultify:

1. Teresa musi budować i modyfikować graf rozmową, nie tylko odpowiadać obok.
2. Manualny canvas i conversational builder muszą edytować ten sam model.
3. Każdy krok jawnie deklaruje context; automatyczne „cała pamięć wszędzie”
   obniża jakość, zwiększa koszt i ryzyko.
4. Save nie oznacza publish. Test i wersjonowanie są częścią produktu.
5. Files/material drafting musi być natywnym output block, nie obejściem.

## 3. n8n i Make — wzorzec silnika automatyzacji

Z tej klasy narzędzi przyjmujemy:

- event/manual/schedule/webhook triggers;
- graf węzłów, zależności, branche, merge, pętle i sub-workflows;
- jawne mapowanie danych między krokami;
- credential references bez tokenów w definition;
- retry/backoff, timeout, continue/stop oraz error handler route;
- execution history, per-node input/output i rerun od kontrolowanego miejsca;
- test data/pinning, environment separation i aktywacja opublikowanej wersji;
- limity współbieżności, kolejki i skalowanie workerów.

Nie kopiujemy „technicznego spaghetti”. Domyślny użytkownik Consultify nie jest
integration engineerem. Canvas pokazuje język biznesowy, a szczegóły schema,
mapping i policy otwierają się dopiero w konfiguracji kroku.

## 4. Zapier Agents — wzorzec dostępności

Zapier pozwala opisać trigger, działania i aplikacje językiem naturalnym,
następnie konfigurować tools, knowledge sources, testować i publikować. Rozróżnia
knowledge source (stale dostępny, indeksowany kontekst) od search action
(wyszukanie świeżego rekordu w aplikacji). Human approval może zatrzymać agenta
i wrócić przez wiadomość lub Human in the Loop step.

Adaptacja:

- Teresa pyta, czy dane są trwałą wiedzą, dynamicznym odczytem czy trigger input;
- external app action jest klockiem z capability manifest, connection binding
  i jawnie pokazanym side effect;
- approval jest pierwszoklasowym stanem runu, nie zdaniem w promptcie;
- templates nie zawierają credentials i po skopiowaniu wymagają bindingu.

## 5. Microsoft Copilot Studio — wzorzec agent + flow

Copilot Studio łączy natural-language/visual flows, triggers, connector actions,
prompts, wywołanie innych agents i human review. Agent node nadaje się do zadań
wymagających wieloetapowego reasoning, tools i knowledge; prompt node do
pojedynczej transformacji. Można żądać pomocy człowieka, gdy agent jest niepewny.

Adaptacja:

- rozróżniamy deterministic transform, AI task i agent/sub-agent;
- złożoną zdolność promujemy do wersjonowanego reusable sub-process;
- uncertainty threshold może skierować do human input/decision;
- approval automatyczne działa wyłącznie dla rutynowych, niskiego ryzyka reguł,
  a wyjątki i działania krytyczne pozostają człowiekowi.

## 6. Doktryna Consultify

### 6.1 Proces przed agentem

Najpierw projektujemy dobry proces, potem decydujemy, które kroki wykonuje AI.
Automatyzacja złego procesu tylko szybciej produkuje zły wynik.

### 6.2 Deterministyczność tam, gdzie możliwa

Routing, permissions, calculations, writes, state transitions i validation są
deterministyczne. AI służy do interpretacji, syntezy, generacji i planowania.
Output AI przechodzi schema validation i quality gate.

### 6.3 Evidence before action

Agent pokazuje, na jakich danych i wiedzy opiera rekomendację. Brak evidence lub
sprzeczność może zmienić path na research/human review, a nie zostać ukryta.

### 6.4 Closed-loop transformation

Proces nie kończy się na raporcie. Powinien opcjonalnie tworzyć propozycje
inicjatyw, decyzji i tasków, monitorować Execution/KPI/Results, zbierać feedback
i porównywać osiągnięty efekt z założeniem.

### 6.5 Bounded agency

Każdy agent ma purpose, scope, tools, knowledge, role, owner, budget, deadline,
approval policy, error policy i measurable success. Brak któregoś elementu
blokuje publikację albo wymaga jawnego wyjątku.

## 7. Czego nie kopiujemy

- nie ograniczamy się do czterech linearnych bloków Harvey;
- nie budujemy wyłącznie technicznego automation canvas;
- nie ukrywamy approvals w promptach;
- nie przekazujemy całego kontekstu do każdego kroku;
- nie pozwalamy agentowi samemu uznać biznesowego rezultatu za osiągnięty;
- nie wiążemy template z kontem i credentials jego autora;
- nie traktujemy zielonego statusu technicznego jako dowodu jakości outputu.

## 8. Oficjalne źródła

- [Harvey — Getting Started with Agent Builder](https://help.harvey.ai/articles/workflow-builder)
- [Harvey — Build with Harvey](https://help.harvey.ai/release-notes/magic-builder-in-workflow-builder)
- [Harvey — Knowledge Sources in workflows](https://eu.help.harvey.ai/release-notes/knowledge-sources-in-words-to-workflows)
- [Harvey — PowerPoint and Excel blocks](https://help.harvey.ai/release-notes/create-edit-powerpoint-excel-files-in-custom-workflow-agents)
- [Harvey — Improve Workflow](https://help.harvey.ai/release-notes/optimize-workflows)
- [Zapier — Build an agent](https://help.zapier.com/hc/en-us/articles/24393442652557-Build-an-agent-in-Zapier-Agents)
- [Zapier — Knowledge sources](https://help.zapier.com/hc/en-us/articles/24569690575117-Add-your-own-data-to-an-agent)
- [Zapier — Approval steps](https://help.zapier.com/hc/en-us/articles/41776074420493-Add-approval-steps-to-your-agent-s-instructions)
- [Microsoft — Copilot Studio overview](https://learn.microsoft.com/en-us/microsoft-copilot-studio/fundamentals-what-is-copilot-studio)
- [Microsoft — Agent node in flow](https://learn.microsoft.com/en-in/microsoft-copilot-studio/agent-node-workflow)

## 9. Pytania do odbioru

1. Czy użytkownik biznesowy widzi pełny DAG, czy domyślnie uproszczone fazy?
2. Czy pozwalamy tworzyć własne reusable sub-processes w MVP?
3. Czy `Improve process` może automatycznie zmieniać draft, czy tylko proponuje diff?
4. Czy automatyczne AI approvals są w ogóle dopuszczone w pierwszej wersji?
5. Jakie trzy gotowe procesy konsultingowe mają być flagowymi templates?
