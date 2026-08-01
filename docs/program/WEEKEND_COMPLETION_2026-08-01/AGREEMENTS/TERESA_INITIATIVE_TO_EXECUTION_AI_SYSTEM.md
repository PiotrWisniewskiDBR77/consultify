---
doc_id: teresa-initiative-to-execution-ai-system-2026-07-31
modules:
  - Initiatives
  - Execution
truth_type: product-target
status: DRAFT_FOR_OWNER_REVIEW
owner: piotr
prepared_by: codex
last_reviewed: 2026-07-31
---

# Teresa — wspólny system AI Initiatives i Execution

## 1. Cel

Teresa jest jednym ciągłym copilotem zarządczym od pierwszej hipotezy zmiany do
sprawdzenia, czy wykonanie doprowadziło do oczekiwanego rezultatu.

Nie powstają dwa niezależne mechanizmy AI:

- „AI od pomysłów” w Initiatives;
- „AI od projektów” w Execution.

Oba moduły używają wspólnego kontekstu, kontraktu rekomendacji, historii decyzji
i modelu governance:

`evidence → sense analysis → feasibility → decision → execution management →
intervention → verification → outcome learning`

## 2. Wnioski z benchmarku

### Jira Product Discovery/Rovo

- AI porządkuje feedback i insighty;
- brainstormuje oraz przekształca notatki w opis pomysłu;
- context pochodzi z grafu pracy organizacji;
- opis, insight i delivery pozostają połączone;
- wynik AI wymaga review z uwagi na zmienną jakość.

### ServiceNow Now Assist for SPM

- conversational demand creation;
- streszczanie feedbacku i dokumentów;
- project insights;
- generowanie elementów niższego poziomu z większego artefaktu;
- AI agents osadzone w workflow SPM.

### Planview Anvi

- AI działa na kontekście strategii, portfolio, capacity i finansowania;
- wspiera scenario planning oraz realokację;
- skupia managera na decyzji zamiast ręcznego składania danych;
- łączy investment z późniejszym outcome.

### Asana AI i dojrzałe work-management patterns

- automatyczne status drafts oraz podsumowania;
- rozpoznawanie ryzyka i blokad z aktualnego work graph;
- rekomendacje pozostają częścią istniejącego workflow;
- praca AI nie tworzy odrębnej prawdy obok danych projektu.

### Przewaga projektowana dla Consultify

Consultify łączy te mechanizmy w zamkniętą pętlę. Teresa nie tylko generuje
tekst, lecz:

1. ocenia sens Initiative;
2. challenge'uje dowody i assumptions;
3. bada wykonalność względem czasu, budżetu, capacity i kompetencji;
4. przedstawia warianty portfelowe oraz `do nothing`;
5. zachowuje argumenty decyzji;
6. przenosi je do Execution;
7. monitoruje odchylenia;
8. proponuje kontrolowane interwencje;
9. sprawdza ich skuteczność;
10. uczy kolejne decyzje na podstawie rzeczywistych efektów.

## 3. Jeden obiekt: `AI Management Case`

Dla każdej Initiative powstaje wersjonowany `AI Management Case`:

- source findings i evidence;
- problem/opportunity statement;
- assumptions oraz unknowns;
- options i `do nothing`;
- expected outcome i KPI;
- strategic alignment;
- financial anchors z Finance;
- feasibility evidence;
- resource/capacity context;
- risks, dependencies i constraints;
- AI assessments;
- human reviews i decisions;
- Execution baseline;
- signals, interventions i effectiveness;
- actual outcomes z Results;
- lessons learned.

AI Management Case nie zastępuje obiektów domenowych. Jest wersjonowaną kopertą
odnośników, analiz i historii rozumowania, która wskazuje ich kanoniczne wersje.

## 4. Funkcje Teresy w Initiatives

### 4.1. Evidence intake i synthesis

- grupuje findings oraz insighty;
- wskazuje źródła wspierające i podważające;
- oddziela fakt, opinię, założenie i wygenerowaną hipotezę;
- wykrywa braki, sprzeczności i nieaktualne dane;
- proponuje pytania uzupełniające i właścicieli odpowiedzi.

### 4.2. Sense Analysis

Teresa przygotowuje `Initiative Sense Review`:

- czy problem jest rzeczywisty i wystarczająco ważny;
- kto doświadcza problemu i jaka jest skala;
- dlaczego działanie jest potrzebne teraz;
- jaki jest koszt/brak korzyści przy `do nothing`;
- czy rozwiązanie odpowiada na przyczynę, czy jedynie objaw;
- czy istnieje prostszy lub tańszy wariant;
- czy Initiative jest zgodna ze strategią;
- jakie dowody mogą sfalsyfikować hipotezę;
- confidence oraz główne unknowns.

Wynik:

`Proceed to analysis`, `Request evidence`, `Merge`, `Reframe`, `Defer` albo
`Recommend stop`.

To rekomendacja, nie decyzja.

### 4.3. Options i solution challenge

- generuje kilka realnych wariantów;
- zawsze uwzględnia `do nothing`;
- porównuje koszt, czas, ryzyko, wartość i odwracalność;
- identyfikuje pre-mortem failure modes;
- wskazuje pilotaż lub eksperyment, jeśli niepewność jest wysoka;
- nie promuje jednego rozwiązania bez pokazania alternatyw.

### 4.4. Feasibility Analysis

Teresa bada:

- dostępność czasu i budżetu;
- rough-order capacity;
- kompetencje, technologię i dostawców;
- zależności i critical constraints;
- zgodność prawną, bezpieczeństwo i change impact;
- gotowość danych i operacji;
- wykonalność KPI;
- realistyczny time to value;
- porównanie z podobnymi Initiative i lessons learned.

Wynik zawiera feasibility level, evidence, confidence, warunki oraz zadania
analityczne do wykonania przez ludzi.

### 4.5. Portfolio recommendation

- scoring z wyjaśnieniem;
- sensitivity na zmianę wag i assumptions;
- marginal value względem zużytej capacity;
- cost of delay;
- overlap oraz cannibalization;
- wpływ na inne Initiative;
- rekomendowane rank/defer/merge/stop;
- kilka scenariuszy budżetu i capacity.

### 4.6. Decision Brief

Przed gate Teresa tworzy niezmienny draft:

- decyzja potrzebna;
- recommendation;
- evidence for/against;
- options i trade-offs;
- financial/KPI anchors;
- feasibility i readiness;
- risks i unknowns;
- conditions;
- termin i approver.

## 5. Handoff Initiatives → Execution

Zatwierdzenie tworzy `AI Handoff Snapshot`, przypięty do approved Initiative:

- obietnica i oczekiwany wynik;
- wybrany wariant oraz odrzucone alternatywy;
- decyzja i conditions;
- krytyczne assumptions;
- ryzyka i zależności;
- financial anchors;
- KPI contract;
- feasibility findings;
- capacity assumptions;
- unresolved unknowns;
- rekomendowany Execution mode i blueprint.

Teresa w Execution nie zaczyna analizy od zera. Pokazuje, co zostało
zatwierdzone, na jakiej podstawie i które assumptions należy monitorować.

## 6. Funkcje Teresy w Execution

### 6.1. Plan challenge

- sprawdza pokrycie scope i closure criteria;
- wykrywa brak ownera, DoD, milestone lub dependency;
- porównuje estymacje z podobnymi realizacjami;
- wykrywa nierealistyczny harmonogram i resource loading;
- wskazuje critical assumptions;
- proponuje Lite/Standard/Complex blueprint;
- tworzy pre-mortem i contingency recommendations.

### 6.2. Continuous management sensing

Teresa monitoruje zdarzenia, nie zachowanie pracowników:

- milestone, dependency i blocker;
- schedule/budget/capacity variance;
- brak decyzji;
- zmianę assumptions;
- jakość i świeżość danych;
- ryzyko niedowiezienia KPI;
- niezgodność deklarowanego statusu z evidence;
- narastający cost of delay.

### 6.3. Forecast i explanation

Każda prognoza wskazuje:

- przewidywany wynik;
- horyzont;
- confidence;
- dane i wersje źródłowe;
- najważniejsze drivery;
- porównanie z baseline;
- scenariusze upside/base/downside;
- warunki, które zmienią prognozę.

### 6.4. Intervention Recommendation

Teresa może proponować:

- remove blocker;
- clarify decision;
- reassign;
- smooth capacity;
- split scope;
- defer non-critical work;
- add resources;
- change sequence;
- pilot;
- rebaseline;
- escalate;
- stop.

Każda propozycja zawiera:

- problem i root-cause hypothesis;
- warianty;
- wpływ na czas, koszt, scope, capacity, ryzyko i outcome;
- odwracalność;
- required approver;
- preview zmian;
- plan weryfikacji skuteczności.

### 6.5. Management communication

Teresa przygotowuje różne drafty z tej samej prawdy:

- owner update;
- manager review;
- sponsor decision brief;
- executive portfolio summary;
- team next-actions;
- stakeholder communication.

Różni się poziom szczegółu i widoczność, nie dane bazowe.

### 6.6. Effectiveness i learning

Po interwencji Teresa:

- porównuje oczekiwany i rzeczywisty wpływ;
- sprawdza kolejny pomiar;
- proponuje close/continue/escalate;
- aktualizuje confidence;
- zapisuje lesson learned;
- wiąże wykonanie z Results i Finance;
- wykorzystuje zatwierdzone lesson w przyszłych rekomendacjach.

## 7. Standard każdej rekomendacji AI

Każda rekomendacja ma jeden kontrakt:

| Pole | Znaczenie |
| --- | --- |
| Recommendation | konkretna proponowana decyzja lub działanie |
| Why now | dlaczego wymaga uwagi obecnie |
| Evidence | źródła wspierające |
| Counter-evidence | źródła podważające |
| Assumptions | przyjęte założenia |
| Unknowns | istotne braki |
| Options | realne alternatywy |
| Impact | czas, koszt, scope, resources, risk, KPI |
| Confidence | poziom i uzasadnienie |
| Approval | kto musi potwierdzić |
| Preview | dokładna zmiana przed wykonaniem |
| Verification | jak sprawdzimy skuteczność |
| Expiry | kiedy rekomendacja traci aktualność |

Rekomendacja bez źródła, confidence i verification nie może być prezentowana
jako gotowa porada zarządcza.

## 8. Poziomy autonomii

| Poziom | Teresa może |
| --- | --- |
| `L0 Observe` | czytać, grupować i podsumowywać |
| `L1 Recommend` | przedstawiać analizę i warianty |
| `L2 Draft` | przygotowywać draft karty, briefu, planu lub komunikatu |
| `L3 Confirmed action` | wykonać odwracalną akcję po preview i potwierdzeniu |
| `L4 Policy automation` | wykonywać wcześniej zatwierdzone, niskoryzykowne reguły |

W MVP używamy L0–L3. L4 wymaga osobnej polityki organizacji, allowlisty akcji,
limitów, kill switcha i audytu.

Teresa nigdy autonomicznie nie:

- zatwierdza lub odrzuca Initiative;
- przyznaje budżetu;
- zmienia approved baseline;
- zmienia ownera bez potwierdzenia;
- akceptuje materialnego ryzyka;
- wykonuje nieodwracalnej zmiany;
- zamyka Initiative lub Execution;
- tworzy actual KPI albo actual cost;
- ukrywa counter-evidence.

## 9. Grounding, bezpieczeństwo i jakość

Każda analiza:

- działa w tenant/org scope;
- respektuje item-level permissions;
- wskazuje źródła i ich wersje;
- odróżnia dane aktualne, stale i brakujące;
- nie pobiera poufnego kontekstu poza uprawnieniem użytkownika;
- zapisuje model/prompt/policy version oraz czas;
- posiada trace rekomendacji i działań;
- może zostać zakwestionowana, odrzucona lub oznaczona jako błędna;
- nie uczy się automatycznie z niezatwierdzonych danych organizacji;
- ma fallback polegający na jawnym braku rekomendacji, nie na zmyślaniu.

## 10. UI

AI nie jest osobną zakładką. Teresa pojawia się w kontekście:

- candidate;
- Initiative card;
- scoring/portfolio scenario;
- decision gate;
- Execution Brief;
- plan;
- Control Tower signal;
- intervention;
- status report;
- closure/outcome review.

Stały panel pokazuje:

- `What changed`;
- `Why it matters`;
- `Recommendation`;
- `Evidence`;
- `Confidence`;
- `Decision/action required`;
- `Verify by`.

## 11. Golden flow AI

`finding → evidence synthesis → Sense Review → options → feasibility tasks →
portfolio recommendation → Decision Brief → human approval → AI Handoff
Snapshot → plan challenge → continuous sensing → intervention recommendation →
human confirmation → execution → effectiveness review → Results/Finance
outcome → lesson learned`

## 12. Kryteria odbioru

1. Teresa zachowuje źródło i wersję każdej tezy.
2. Fakt, assumption, hypothesis i recommendation są rozróżnione.
3. Sense Review zawiera `do nothing` i counter-evidence.
4. Feasibility używa Finance, Results, capacity i kompetencji bez kopiowania.
5. Human decision zachowuje immutable snapshot.
6. Execution otrzymuje pełny AI Handoff Snapshot.
7. Teresa nie zaczyna ponownie od pustego promptu.
8. Forecast ma confidence i drivery.
9. Interwencja ma preview, impact, approval i verification.
10. Odrzucenie rekomendacji ma opcjonalny reason i audit.
11. Niedostępne lub stare dane obniżają confidence.
12. Brak wystarczających danych daje `insufficient evidence`.
13. Rekomendacja wygasa po zmianie krytycznego source/assumption.
14. AI nie ujawnia danych spoza uprawnień.
15. L3 nie działa bez jawnego potwierdzenia.
16. Outcome review wraca do lessons learned.
17. Golden flow przechodzi E2E na stagingu.

## 13. Źródła benchmarku

- [Jira Product Discovery — AI/Rovo](https://support.atlassian.com/jira-product-discovery/docs/explore-atlassian-intelligence-in-jira-product-discovery/)
- [Jira Product Discovery — ideas and insights](https://www.atlassian.com/software/jira-product-discovery/guides/ideas/overview)
- [ServiceNow Now Assist for SPM](https://www.servicenow.com/docs/r/it-business-management/now-assist-for-strategic-portfolio-management-spm/now-assist-spm.html)
- [Planview Strategic Portfolio Management](https://www.planview.com/products-solutions/solutions/strategic-portfolio-management/)
- [Asana portfolio/workload patterns](https://help.asana.com/s/article/monitor-initiatives-and-manage-resources-with-portfolios?language=en_US)
