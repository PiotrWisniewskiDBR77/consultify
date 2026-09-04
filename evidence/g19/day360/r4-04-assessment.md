# Dyżur 360 — R4: 04_ASSESSMENT

- Trasa: `GET /api/v8/assessment/:assessmentId`, handler `server/src/routes/v8/assessment.routes.ts:424`.
- Strażnik: `SELECT * FROM assessments WHERE id = ? AND organization_id = ?`, `server/src/routes/v8/assessment.routes.ts:437`.
- Istniejący obiekt: `day360-assessment-owner` w `day307-org-owner`.
- Pełna nazwa przypadku: `Day 360 G19 04 Assessment cross-org record isolation through ApiGateway denies a foreign organization while the owner reads the same seeded assessment`.
- Para: obcy 404/62 B; właściciel 200/1176 B, niepuste ciało z tym samym ID.
- GREEN: 1/1, `--retry=0`, realny ApiGateway/JWT/PostgreSQL.
- Mutacja: usunięcie `AND organization_id = ?` oraz parametru organizacji; RED 0/1, `expected 200 to be 404`.
- Po `cp`: GREEN 1/1; `git diff -- server/src/routes/v8/assessment.routes.ts` pusty.
- `numTotalTests=1`.

Pułapki: jawny komplet env, brak auth bypass, V8 włączone, acceptance bez globalnych mocków, właściciel ma niepuste 200. Brak SMTP/wpisów SMTP/drenaży; niczego nie wysłano.
