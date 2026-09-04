# Dyżur 360 — R4: 05_INITIATIVES

- Trasa: `GET /api/decisions/:id/detail`; strażnik `decision.organization_id !== orgId` w `server/src/controllers/DecisionController.ts:2598`.
- Pełna nazwa: `Day 360 G19 05 Initiatives decision isolation through ApiGateway denies a foreign organization while the owner reads the same seeded decision detail`.
- Istniejący `day360-decision-owner`; obcy 404/30 B, właściciel 200/684 B.
- GREEN 1/1, realny ApiGateway/JWT/PG, `--retry=0`.
- Pierwsza mutacja chybiła podobny warunek przy linii 2421: zastana suita day277 pozostała 2/2; nie uznano jej za dowód.
- Właściwa mutacja w `getDecisionDetail` usunęła porównanie organizacji: nowy kontrakt RED 0/1, obcy dostał 500 zamiast 404 (`expected 500 to be 404`). Zmiana odblokowała obcy rekord, a 500 powstało dopiero w dalszym agregowaniu; to jest czerwień izolacji, nie walidacji kształtu.
- Po przywróceniu przez `cp`: GREEN 1/1; diff kontrolera pusty. `numTotalTests=1`.

Brak auth bypass, globalnych mocków i SMTP/drenaży; niczego nie wysłano.
