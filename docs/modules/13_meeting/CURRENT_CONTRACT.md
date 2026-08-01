---
module_id: MODULE_MEETING
truth_type: product-target
status: canonical
owner: product
last_reviewed: 2026-07-30
---

# Meeting — aktualny kontrakt funkcjonalny

## Cel i stan

Meeting jest docelowo wieloosobowym środowiskiem pracy, w którym Teresa działa
jako aktywny konsultant i facilitator: przygotowuje, prowadzi i domyka
spotkanie, zadaje pytania, proponuje metody, uruchamia wspólne narzędzia
wizualne oraz zamienia rozmowę w zatwierdzone rezultaty. Działa na wspólnym
ekranie w sali oraz, docelowo, jako jawny uczestnik Teams/Zoom/Google Meet, bez
budowania własnego silnika audio-video.

Pozycja jest nadal oznaczona „Wkrótce”, lecz aktualny kod montuje realny
`MeetingHub` i backend. Status menu jest więc niespójny z runtime i wymaga
odbioru produktowego. Aktywna facylitacja jest zatwierdzonym kierunkiem
rozwojowym po domknięciu podstawowego golden flow.

## Funkcje docelowe

| ID | Funkcja | Stan |
| --- | --- | --- |
| `MET-F-001` | Lista spotkań | AS-IS |
| `MET-F-002` | Agenda, uczestnicy i materiały | AS-IS / needs runtime acceptance |
| `MET-F-003` | Notatki spotkania | AS-IS / partial |
| `MET-F-004` | Synteza AI i Operator Brief | AS-IS / partial |
| `MET-F-005` | Decyzje i follow-up | AS-IS / partial |
| `MET-F-006` | Protokół i publikacja w Materials | gap |
| `MET-F-007` | Teresa jako aktywny facilitator spotkania | TARGET / future |
| `MET-F-008` | Narzędzia live: mind map, whiteboard, flow, Canvas, Notebook | TARGET / future |
| `MET-F-009` | Tryb sali na wspólnym ekranie | TARGET / future |
| `MET-F-010` | Aktywny udział w Teams/Zoom/Google Meet | TARGET / future |

## Docelowy przepływ, dane i role

Organizator tworzy spotkanie, zaprasza uczestników, ustala agendę i źródła.
Podczas spotkania powstają notatki; po nim Teresa proponuje podsumowanie,
decyzje i zadania. Człowiek zatwierdza wynik, a obiekty trafiają do My Work,
Initiatives i Materials z lineage do spotkania. Nagrywanie i transkrypcja
wymagają zgody, retencji oraz kontroli dostępu.

## AS-IS zweryfikowany 2026-07-30

- `/meeting` montuje `MeetingHub`;
- frontend wywołuje API spotkań i AI Operator Brief;
- Gateway montuje `/api/meeting` pod `betaGate`;
- istnieją testy komponentu i tras backendu;
- nie potwierdzono pełnego handoffu decyzji/zadań/materiałów ani polityki
  consent/transcript.

## Luki i bramka

- zatwierdzić minimalny zakres MVP i model danych;
- wykonać odbiór istniejącego runtime zamiast traktować moduł jako placeholder;
- określić zgodę na nagranie, retencję i udział osób zewnętrznych;
- zbudować approval podsumowania, decyzji i zadań;
- dodać E2E i dopiero wtedy zmienić status z `soon`.

Ocena: `B / real-partial`, przy niespójnym badge `soon`. Dowody AS-IS:
`MeetingHub.tsx`, `meeting.routes.ts`, Gateway, testy i routing.
