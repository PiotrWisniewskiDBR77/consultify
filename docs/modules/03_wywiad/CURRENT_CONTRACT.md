---
module_id: MODULE_INTERVIEW
truth_type: product-target
status: canonical
owner: product
last_reviewed: 2026-07-30
---

# Interview — aktualny kontrakt funkcjonalny

## Cel i granica

Interview prowadzi kontrolowane zbieranie wiedzy od respondentów: od
przygotowania pytań i zaproszeń, przez sesję i odpowiedzi, do insightów oraz
przekazania wyniku. Nie jest właścicielem assessmentu ani inicjatywy powstałej
na podstawie wywiadu.

## Mapa funkcji

Poniższe sześć pozycji opisuje powierzchnie wysokiego poziomu. Szczegółowy
katalog 26 zdolności, ich stany, reguły AI i kryteria odbioru znajduje się w
pakiecie uzgodnienia Interview wskazanym na końcu dokumentu.

| ID | Funkcja | Stan |
| --- | --- | --- |
| `INT-F-001` | Hub i lista wywiadów | AS-IS |
| `INT-F-002` | Kreator wywiadu | AS-IS / partial evidence |
| `INT-F-003` | Respondenci, przypisania i zaproszenia | AS-IS / partial |
| `INT-F-004` | Sesja, odpowiedzi i zapis | AS-IS |
| `INT-F-005` | Analiza AI i insights | AS-IS / partial |
| `INT-F-006` | Review, approval i handoff | partial |

## Przepływ

Autor tworzy strukturę, wskazuje respondentów i zakres dostępu, publikuje lub
przypisuje wywiad, respondent odpowiada, a system zapisuje postęp. Po
zakończeniu wynik może zostać przeanalizowany, zatwierdzony i przekazany do
Tools, Assessment, Initiatives lub Materials.

## Dane, role, AI i integracje

Właścicielem są definicje wywiadów, sesje, respondenci, odpowiedzi i insights.
Autor zarządza treścią i dystrybucją; respondent widzi tylko swój zakres;
reviewer zatwierdza wynik. AI może proponować pytania i syntetyzować odpowiedzi,
ale musi wskazać źródła i nie może dopisywać odpowiedzi respondenta.

## AS-IS

`/interview` i zgodnościowe `/discovery` montują `InterviewHub`. Backend V8 ma
szeroki kontrakt, natomiast brak pełnego zestawu testów podróży frontendowych.
Istnienie wszystkich głównych powierzchni nie dowodzi jeszcze kompletnego
lifecycle publikacji i approval.

## TO-BE

Powtarzalny, audytowalny proces badawczy z wersjonowaniem pytań, bezpiecznymi
zaproszeniami, autosave, kontrolą zgód, cytowalnymi insightami i jednoznacznym
handoffem.

## Luki i bramka

- potwierdzić creator → publish → assignment → response → approval;
- sprawdzić wygaśnięcie i unieważnienie zaproszeń;
- zweryfikować autosave, wznowienie i konflikt edycji;
- dodać testy izolacji organizacji oraz respondentów zewnętrznych;
- udowodnić lineage insightu do konkretnych odpowiedzi.

Ocena: `B`. Dowody: `STATUS.md`, `CODEMAP.md`,
`INTERVIEW_CREATORS_VERIFICATION_REPORT.md`, API V8 i trasy aplikacji.

## Pakiet uzgodnienia produktu

- [`12_INTERVIEW_REVIEW.md`](../../program/WEEKEND_COMPLETION_2026-08-01/AGREEMENTS/12_INTERVIEW_REVIEW.md)
  — pełny kontrakt modułu, lifecycle, powierzchnie, role, AI, prywatność oraz
  golden flows;
- [`INTERVIEW_FUNCTION_CATALOG.md`](../../program/WEEKEND_COMPLETION_2026-08-01/AGREEMENTS/INTERVIEW_FUNCTION_CATALOG.md)
  — szczegółowy katalog 26 funkcji do późniejszego rozpisania backlogu.
- [`INSIGHT_GENERATOR_CONTRACT.md`](../../program/WEEKEND_COMPLETION_2026-08-01/AGREEMENTS/INSIGHT_GENERATOR_CONTRACT.md)
  oraz
  [`INITIATIVE_PROPOSAL_GENERATOR_CONTRACT.md`](../../program/WEEKEND_COMPLETION_2026-08-01/AGREEMENTS/INITIATIVE_PROPOSAL_GENERATOR_CONTRACT.md)
  — kontrakty dwóch krytycznych generatorów modułu.
- [`QUESTION_ARTIFACT_CONTRACT.md`](../../program/WEEKEND_COMPLETION_2026-08-01/AGREEMENTS/QUESTION_ARTIFACT_CONTRACT.md)
  oraz
  [`QUESTION_GENERATOR_CONTRACT.md`](../../program/WEEKEND_COMPLETION_2026-08-01/AGREEMENTS/QUESTION_GENERATOR_CONTRACT.md)
  — wspólny model pytania i kontrolowany proces budowy question setu.
- [`INTERVIEW_ANSWER_ASSISTANCE_AND_VERIFICATION_CONTRACT.md`](../../program/WEEKEND_COMPLETION_2026-08-01/AGREEMENTS/INTERVIEW_ANSWER_ASSISTANCE_AND_VERIFICATION_CONTRACT.md)
  — pomoc Teresy, readiness przed wysyłką oraz review managera.

Pakiet rozwija ten kontrakt, ale go nie zastępuje, dopóki owner nie zatwierdzi
karty uzgodnienia.
