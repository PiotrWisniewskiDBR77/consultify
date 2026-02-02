# 🧩 Moduł: My Work – Overview

## Plan źródłowy

Brak osobnego `plan-mywork...` w `wdrozenia/` – My Work jest „centrum pracy” i integruje Task/Decision/Notifications.

## Cel

My Work jest **kokpitem zarządzania pracą**: agreguje to, co wymaga reakcji i pokazuje, czy organizacja faktycznie się zmienia.

Zasada: My Work nie jest “kolejną listą” — jest **centrum ruchu**:

- **Task** pokazuje, co robimy (i jaki efekt ma się wydarzyć),
- **Decision** mówi, co wolno i za co odpowiadamy (zamyka niepewność),
- **Notifications** pilnują, żeby organizacja się nie zatrzymała (presja i eskalacja).

W My Work nadrzędny jest **Inbox jako kolejka akcji**, nie feed informacji.

## Ryzyko P0/P1 (z trackera)

- Backend `/api/my-work` jest stubem (501) – blokuje realne dane.
- Zakazane mock fallbacki w UI dla Inbox/Executive.

## Standardy powiązane

- Task: `wdrozenia/standards/entities/01-TASK.md`
- Decision: `wdrozenia/standards/entities/02-DECISION.md`
- Notifications: `wdrozenia/standards/entities/06-NOTIFICATION.md`

## Wymóg systemowy (kontrakt)

My Work musi umożliwiać w 5 sekund odpowiedź:

- co blokuje ruch,
- kto ma zareagować,
- jaki jest koszt czekania (aging / cost of delay),
- jaki jest następny krok (Primary CTA).Minimalny UX:- Inbox pokazuje tylko elementy wymagające reakcji (Decisions/Blocked Tasks/Critical).- Każdy element ma 4-liniowy format (co/dlaczego/blokuje/akcja) + Primary CTA.
