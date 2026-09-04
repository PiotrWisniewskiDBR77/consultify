# Dyżur 360 — R4: 13_CHAT

- Trasa: `GET /api/conversations/:id`, mount `server/src/Gateway.ts:710`.
- Strażnik: `findAccessibleConversation`, osobisty odczyt `id + user_id + organization_id`, `server/src/routes/conversations.routes.ts:96-113`.
- Pełna nazwa: `Day 360 G19 13 Chat private conversation isolation through ApiGateway denies a foreign organization while the owner reads the same seeded private conversation`.
- Ten sam istniejący UUID rozmowy: obcy 404/54 B, właściciel 200/1133 B z wiadomością `owner-only message`.
- Pierwsza fikstura miała tekstowe ID i dała 400/400 z walidatora; nie była dowodem. Po korekcie na UUID: GREEN 1/1, ApiGateway/JWT/PG, `--retry=0`.
- Mutacja usunęła warunki `user_id` i `organization_id` z osobistego odczytu: RED 0/1, obcy 200 zamiast 404, komunikat `expected 200 to be 404`.
- Po `cp`: GREEN 1/1; diff trasy pusty. `numTotalTests=1`.

Brak auth bypass, globalnych mocków, SMTP i drenaży; niczego nie wysłano.
