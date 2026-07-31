---
document_id: INSIGHT-GENERATOR-CONTRACT
scope: cross-application
primary_module: Interview
status: DRAFT_FOR_OWNER_REVIEW
owner: piotr
prepared_by: codex
last_reviewed: 2026-07-31
---

# Insight Generator — kontrakt produktu

## 1. Zadanie

Insight Generator zamienia zbiór wypowiedzi, evidence i kontekstu w małą liczbę
wartościowych, cytowalnych `Insight Candidates`. Insight wyjaśnia znaczenie
danych: co obserwujemy, dlaczego jest to ważne, dla kogo, z jaką pewnością i
jakie są alternatywne interpretacje.

Generator nie tworzy automatycznie zatwierdzonej wiedzy organizacyjnej.

## 2. Dozwolone wejścia

W Interview:

- submitted/confirmed answers i ich dokładne wersje pytań;
- dozwolone cytaty i transkrypcje;
- evidence, notes i respondent context;
- hypothesis, topic i stakeholder coverage;
- segment/anonymity policy;
- wcześniejsze insighty do porównania i deduplikacji.

Draft odpowiedzi może zostać użyty tylko w roboczej analizie i musi być
oznaczony. Nie może zasilić approved insightu bez przejścia wymaganej bramki.

## 3. Typy analizy

- themes i recurring patterns;
- pain points, needs, opportunities i constraints;
- agreements oraz minority/dissent views;
- contradictions i competing explanations;
- hypothesis support/challenge;
- stakeholder/segment differences;
- evidence gaps i pytania wymagające dogrywki;
- change signals względem poprzedniej fali.

AI nie utożsamia częstotliwości wypowiedzi z ważnością ani prawdą.

## 4. Insight Candidate

Każdy kandydat zawiera:

- krótki claim;
- `so what` — znaczenie biznesowe lub decyzyjne;
- affected scope/stakeholders;
- supporting sources i dokładne excerpts;
- contradicting sources i dissent;
- evidence sufficiency oraz coverage;
- facts, interpretations i assumptions rozdzielone;
- confidence wraz z podstawą;
- alternative explanation;
- recommended next validation/action;
- privacy/anonymity classification;
- relationship do istniejących insightów: new/duplicate/update/conflict;
- freshness i generator provenance.

## 5. Workspace i akcje

Użytkownik może:

- filtrować według tematu, segmentu, hipotezy i confidence;
- otworzyć claim obok źródeł;
- odsłuchać dozwolony fragment audio lub zobaczyć transcript;
- połączyć duplikaty albo rozdzielić zbyt szeroki insight;
- poprawić claim i `so what` bez zerwania lineage;
- oznaczyć missing evidence i utworzyć follow-up question;
- wysłać do Client Readback;
- zaakceptować, odrzucić lub odesłać do ponownej analizy.

## 6. Quality Gate

Insight może zostać zatwierdzony, jeśli:

- claim jest konkretny i niesprzeczny z cytowanymi źródłami;
- znaczenie jest oddzielone od obserwacji;
- źródła są dostępne dla reviewerów i spełniają policy;
- sprzeczności i dissent nie zostały ukryte;
- coverage jest wystarczające albo ograniczenie jest jawne;
- confidence ma uzasadnienie;
- nie jest niewyjaśnionym duplikatem;
- reviewer ma właściwe uprawnienie;
- readback został wykonany, jeżeli wymaga go policy.

## 7. Wyniki i handoff

`Insight Candidate → Reviewed Insight → Approved Insight`

Approved Insight może zasilać:

- raport lub prezentację w Materials;
- scoped Knowledge;
- Tools jako evidence/input;
- Assessment jako evidence/input, nigdy automatyczny score;
- Initiative Proposal Generator;
- follow-up Interview albo Meeting.

Każdy handoff zachowuje source lineage, policy, wersję i status freshness.

## 8. Rola człowieka i Teresy

Teresa syntetyzuje, porównuje i challenge'uje. Reviewer odpowiada za zgodność
claimu ze źródłami. Właściciel badania odpowiada za promocję i wykorzystanie.
Respondent nie musi zatwierdzać insightu, chyba że wymaga tego readback/consent.

## 9. Antywzorce

- ogólne „pracownicy chcą lepszej komunikacji” bez source i scope;
- sentiment udający insight;
- jedna głośna wypowiedź przedstawiona jako konsensus;
- wygładzenie konfliktu między respondentami;
- cytat umożliwiający identyfikację w trybie anonimowym;
- action recommendation przedstawione jako obserwowany fakt;
- automatyczna promocja wszystkich kandydatów.

## 10. Test odbiorczy

Golden flow:

`confirmed answers → select scope → preview brief → generate → inspect sources
and contradictions → edit/merge → readback if required → approve selected →
create report/knowledge/input/initiative proposal with lineage`
