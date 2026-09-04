# Rejestr komunikatów PL — 2026-09-04

| Kod błędu | Trasa | Z językiem polskim | Bez nagłówka | `errorCode` przed/po | Commit |
| --- | --- | --- | --- | --- | --- |
| `PROGRAM_NOT_ACTIVE` | `POST /api/vnext/results/okr/cycles` | 409, tekst angielski — czerwony kontrakt | 409, tekst angielski | bez zmiany | R2 |
| `COMMAND_CAPABILITY_DENIED` | warstwa prezentacji koperty błędu | komunikat serwera o braku uprawnień, nie awaria systemu | angielski fallback tylko przy braku tekstu serwera | bez zmiany w kopercie | R3 |

## Dług tras z `undefined`

Na markerze zmierzono 106 wywołań `mapAppErrorResponse(..., undefined, ...)`. Żadnego nie zmieniono,
ponieważ helpery dwóch wskazanych tras nie przyjmują `req`, a licencja nie obejmuje zmiany ich
sygnatur ani call-site'ów. Trasy bez pełnych par dowodowych pozostają niezmienione.

## Dług `AppError`

203 konstrukcje poza testami: 1 ze statycznie rozpoznanym kodem obecnym w słowniku operacyjnym,
202 bez takiego kodu. Największa rodzina: 138 bez jawnego trzeciego argumentu, następnie 34
przypadki rodziny `FEATURE_UNAVAILABLE` (29 literałów + 5 przez stałą).

## Dług `defaultError`

1003 linie wołają `handleResponse(res, ...)`; 1002 mają literał jako początek drugiego argumentu
w tej samej linii. R3 centralnie zachowuje niepusty tekst serwera; fallback pozostaje dla kopert
bez tekstu i odpowiedzi nieparsowalnych.
