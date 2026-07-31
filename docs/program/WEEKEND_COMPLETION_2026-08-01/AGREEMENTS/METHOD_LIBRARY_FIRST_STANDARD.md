---
document_id: METHOD-LIBRARY-FIRST-STANDARD
modules: Tools / Assessment / Audits
status: DRAFT_FOR_OWNER_REVIEW
owner: piotr
prepared_by: codex
last_reviewed: 2026-07-31
---

# Library First — wspólny standard modułów metodycznych

## 1. Decyzja

Pierwszą i domyślną zakładką w `Tools`, `Assessment` i `Audits` jest
**Library**. Druga zakładka pokazuje aktywne i historyczne instancje pracy:

| Moduł | Pierwsza zakładka | Druga zakładka |
| --- | --- | --- |
| Tools | Library narzędzi konsultingowych | Processes (Tool Sessions) |
| Assessment | Library metod oceny dojrzałości | Processes (Assessments) |
| Audits | Library standardów i programów audytowych | Processes (Audits) |

Library odpowiada „czego użyć i dlaczego?”, a druga zakładka „co już robimy lub
zrobiliśmy?”. Definicje metod i instancje procesów nie są mieszane w jednej
tabeli.

## 2. Wspólne funkcje Library

- wyszukiwanie, kategorie, branża, cel, problem i rola użytkownika;
- Recommended, Favorites, Recent, All i dostępność/licencja;
- karta metody: cel, kiedy używać/nie używać, inputs, uczestnicy, czas,
  trudność, proces, expected outputs i przykład;
- preview grafiki oraz opcjonalna mikrodemonstracja;
- porównanie metod side-by-side;
- Teresa `Help me choose` z uzasadnieniem, alternatywami i możliwością „żadna”;
- status: Production ready, Pilot, Beta, Unavailable/Coming later;
- start nowej instancji z dokładnej wersji template/methodology;
- permissions, licensing i wymagane kwalifikacje;
- źródła, właściciel, wersja i spodziewane downstream outputs.

## 3. Różnice domenowe

- **Tools Library** przechowuje ToolDefinition/Template dla elastycznej pracy
  konsultingowej w Guided Manual lub Teresa-led.
- **Assessment Library** przechowuje Methodology Pack: model dojrzałości,
  dimensions, scoring, evidence, respondent/assessor roles, licencję i report.
- **Audits Library** przechowuje Audit Standard/Program Template: standard,
  scope, audit type, competence/independence, sampling, evidence, findings,
  corrective process, recurrence i reports.

## 4. Teresa w Library

Teresa analizuje problem/cel, etap projektu, dane, wymagany poziom formalności,
licencję, czas, kompetencje, uczestników i expected outcome. Wynik zawiera do
trzech rekomendacji, trade-offs, required preparation i confidence. Może
zarekomendować przejście do innego modułu lub brak użycia metody.

## 5. Spójność UI

Wspólny shell: list/grid, search/filters, StandardPreview, compare, Help me
choose, wspólne status/licensing badges, Start CTA i deep link do version.
Treść oraz grafika preview pozostają domenowe.

## 6. Kryteria odbioru

- wejście z menu każdego modułu otwiera Library;
- użytkownik rozumie różnicę między metodą a procesem;
- druga zakładka nie zawiera definicji metod;
- start zachowuje version lineage;
- beta/unavailable nie udaje gotowej metody;
- Teresa odróżnia Tool, Assessment i Audit;
- compare, permissions, license i outputs działają spójnie;
- testy obejmują deep link, start, brak access/license i rekomendację do innego
  modułu.
