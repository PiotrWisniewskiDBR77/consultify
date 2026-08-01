---
document_id: ASSESSMENT-EVIDENCE-SCORING-CONTRACT
module: Assessment
status: DRAFT_FOR_OWNER_REVIEW
owner: piotr
prepared_by: codex
last_reviewed: 2026-07-31
---

# Assessment — evidence, scoring i walidacja

## 1. Łańcuch prawdy

`approved score → score decision → rationale → attributes → responses →
evidence → source`

Każde ogniwo jest dostępne z macierzy i z raportu. Brak dowodu nie jest ukryty
przez confidence ani narrację AI.

## 2. Evidence Item

Zachowuje type, title, source, owner, observed_at, valid_for_scope, freshness,
confidentiality, file/material relation, excerpt/locator, reviewer, status i
powiązania do pytań/atrybutów/poziomów.

Typy: document, system record, metric/dashboard, demonstration, observation,
interview statement, photo/video, external source. Interview statement sam w
sobie jest słabszy niż artefakt i nie może być automatycznie traktowany jako
potwierdzenie.

Status: `proposed → received → under_review → accepted / rejected / expired /
conflicting`.

## 3. Score Proposal

Zawiera proposed level, satisfied/unsatisfied attributes, evidence coverage,
missing evidence, contradictions, rule evaluation, confidence i autora
human/AI. Proposal nigdy nie koloruje macierzy jak final decision bez legendy.

## 4. Score Decision

Assessor/Reviewer zatwierdza, obniża, odrzuca albo zwraca proposal. Decyzja
zachowuje rationale oraz różnicę względem propozycji AI/respondenta.

Scoring engine jest deterministyczny i pochodzi z wersji Method Pack. LLM nie
liczy score ani agregacji.

## 5. Reguły ogólne

- brak dowodu = `needs evidence`, nie automatyczne zero;
- `N/A` wymaga uzasadnienia i reguły wpływu na agregację;
- prerequisites nie mogą zostać pominięte;
- rounding i aggregation są jawne;
- current i target są oddzielnymi decyzjami;
- target nie naprawia brakującego current;
- confidence nie zastępuje completeness;
- zmiana zaakceptowanego dowodu uruchamia impact analysis.

## 6. Rozbieżność

`Detected → Clarification → Evidence review → Assessor proposal → Reviewer
decision → Resolved`

System tworzy ją przy sprzecznych odpowiedziach, dowodach, naruszeniu
prerequisites, niewystarczającym coverage albo różnicy z poprzednim baseline.

## 7. Freeze

Freeze zapisuje Method Pack version, scope, wszystkie decisions, evidence
references, missing evidence, limitations, aggregation result i hash/snapshot.
Reopen tworzy revision; nie zmienia zatwierdzonego snapshotu w miejscu.
