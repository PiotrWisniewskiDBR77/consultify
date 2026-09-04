# Rejestr komunikatów PL — 2026-09-04

| Kod błędu | Trasa | Z językiem polskim | Bez nagłówka | `errorCode` przed/po | Commit |
| --- | --- | --- | --- | --- | --- |
| `PROGRAM_NOT_ACTIVE` | `POST /api/vnext/results/okr/cycles` | 409, tekst angielski — czerwony kontrakt | 409, tekst angielski | bez zmiany | R2 |

## Dług tras z `undefined`

Na markerze zmierzono 106 wywołań `mapAppErrorResponse(..., undefined, ...)`. Żadnego nie zmieniono,
ponieważ helpery dwóch wskazanych tras nie przyjmują `req`, a licencja nie obejmuje zmiany ich
sygnatur ani call-site'ów. Trasy bez pełnych par dowodowych pozostają niezmienione.
