---
doc_id: audits-functional-contract
title: Audits — kontrakt funkcjonalny
menu_item: audits
truth_type: product-target
scope: programy audytowe
status: canonical-direction
owner: product
last_reviewed: 2026-07-31
runtime_commit: e62623cb99249e963eee5710946f5eb0e8286d79
---

# Audits

> Faza produktu: **poza MVP — druga fala rozwoju**. Obecny runtime jest
> fragmentem/prototypem i nie stanowi deklaracji gotowości modułu.

## Cel

Audits prowadzi formalne audyty branżowe, normatywne i wewnętrzne na podstawie
normy, instrukcji albo planu audytów organizacji. Z dostarczonego dokumentu
tworzy podlegający review Audit Blueprint, a następnie prowadzi program przez
wymagania, dowody i findingi do raportu poaudytowego, planu naprawczego,
inicjatyw wdrożeniowych oraz raportów z realizacji.

## Granice

- Assessment jest zamkniętym modułem płatnych postępowań rozwoju cyfrowego,
  w szczególności DRD i SIRI.
- Tools udostępnia elastyczne metody pracy konsultingowej.
- Audits bada spełnienie wymagań na podstawie dowodów.
- Interview może dostarczać odpowiedzi.
- Tools może dostarczać analizy.
- Initiatives przejmuje zatwierdzone działania naprawcze.
- Materials publikuje raport.

## Mapa funkcji

| ID | Funkcja | Stan dokumentacyjny |
| --- | --- | --- |
| AUD-F-001 | Lista programów audytowych | code-only |
| AUD-F-002 | Utworzenie/uruchomienie programu | unknown/partial |
| AUD-F-003 | Biblioteka Audit Blueprints | target |
| AUD-F-004 | Import normy/instrukcji i draft blueprintu z lineage | target |
| AUD-F-005 | Zbieranie dowodów | unknown |
| AUD-F-006 | Ustalenia i klasyfikacja | unknown |
| AUD-F-007 | Plan działań naprawczych | unknown |
| AUD-F-008 | Raport audytu | partial |
| AUD-F-009 | Promocja ustalenia do inicjatywy | target |
| AUD-F-010 | Historia, reviewer i akceptacja | unknown |
| AUD-F-011 | Plan audytów organizacji i cykliczność | target |
| AUD-F-012 | Raport poaudytowy → plan naprawczy → inicjatywy | target |
| AUD-F-013 | Raportowanie realizacji i skuteczności planu | target |

## Przepływ docelowy

`dokument źródłowy → blueprint → plan/program → wymagania → dowody → test →
findingi → raport poaudytowy → plan naprawczy → inicjatywy → raporty realizacji
→ weryfikacja skuteczności`

## Obiekty

- audit program,
- audit blueprint i source document version,
- organization audit plan,
- audit scope,
- requirement/control,
- evidence request,
- evidence item,
- finding,
- severity/status,
- corrective action,
- reviewer/approval,
- audit report.

Model techniczny wymaga weryfikacji w kodzie i bazie.

## AI

AI może:

- mapować dowody do wymagań,
- wskazywać brakujące dowody,
- proponować klasyfikację ustalenia,
- tworzyć draft rekomendacji i raportu.

AI nie powinno samodzielnie zamykać ustalenia ani potwierdzać zgodności bez
reviewera i dowodu.

## AS-IS

- pozycja menu `MODULE_AUDITS`,
- label `Audits`,
- status/badge `beta`,
- AppView `ASSESSMENT_AUDITS`,
- komentarz runtime wskazuje hub `/audit-programs`,
- realny hub `/audit-programs`, wizard, CRUD i generowanie Interview;
- statyczne presety nazwane ISO 27001 oraz New Company;
- testy UI, API i org scoping;
- brak pełnego modelu blueprint/evidence/test/finding/action;
- raport DRD widoczny w hubie pochodzi z Assessment i nie należy do Audits;
- historyczna karta audytu: `Harvard/modules/M12-audyty/KARTA_AUDYTU.md`.

## TO-BE

Audits ma być generatywnym, evidence-first silnikiem audytowym. Ekspert
dostarcza legalnie dostępny dokument, Teresa tworzy draft postępowania z
mapowaniem do źródła, a człowiek zatwierdza blueprint przed użyciem.

## UI/UX

Audits używa istniejącego kanonu aplikacji. Lista i detal korzystają z
`StandardModuleBar`, `StandardTable`, `StandardPreview`, Menu 3 i kebab menu.
Program oraz import blueprintu używają istniejącego wizarda. Pytania korzystają
z Interview, insighty z Insight Canon, arkusze z Table Platform, dokumenty i
raporty z Materials, a działania z My Work/Initiatives/Execution.

Nie wolno budować równoległego silnika formularzy, tabel, preview, kart,
edytorów ani raportów. Nowy komponent jest dopuszczalny dopiero po wykazaniu
braku odpowiedniego wzorca i musi zostać dodany do standardu wspólnego.

## GAP / NEXT

### Teraz — porządkowanie przed MVP

1. Usunąć DRD/SIRI i raporty Assessment z własności Audits.
2. Zamrozić równoległe modele oraz nie rozwijać kolejnych fragmentów.
3. Zachować istniejący kod jako oznaczony fundament/prototyp.

### Druga fala produktu

1. Przyjąć model Source → Blueprint → Program → Finding → Remediation.
2. Zbudować import instrukcji oraz review wygenerowanego blueprintu.
3. Dodać plan audytów organizacji.
4. Zbudować E2E aż do inicjatywy i raportu realizacji naprawy.
5. Zweryfikować uprawnienia, kompetencje, niezależność i approval.
