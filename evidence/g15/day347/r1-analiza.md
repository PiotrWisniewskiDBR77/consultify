# R1 — odtworzenie czerwieni po pełnych nazwach

Źródło: 15 zastanych plików `evidence/g15/day336-artefakty/*-serwer.json`, z wyłączeniem wariantów `baza`. Lista `przed-nazwy.txt` zawiera 542 wiersze i 0 duplikatów po zastosowaniu prefiksu `moduł | plik | fullName`.

## Kubełki komunikatów

Klasyfikacja jest rozłączna, w kolejności z tabeli.

| Kubełek | Liczba |
| --- | ---: |
| `expected 403 to be X` | 415 |
| `expected 503 to be X` | 19 |
| `RESULTS_INTERNAL_BETA_VISIBILITY_DENIED` w asercji kodu | 12 |
| `createArtifactViaHttp failed` | 20 |
| `TypeError` / odczyt z `undefined` | 46 |
| `ENOENT` | 5 |
| Reszta | 25 |
| **Suma** | **542** |

## Kaskada w `10_FINANCE`

W module `10_FINANCE` 31 przypadków kończy się wtórnym `TypeError`, np. `Cannot read properties of undefined (reading 'artifactId')`: wcześniejsze żądanie tworzące artefakt nie dostarczyło oczekiwanego obiektu. Kolejne 20 przypadków kończy helper `createArtifactViaHttp` bezpośrednio po odpowiedzi `403`, z komunikatem `createArtifactViaHttp failed: 403 {"success":false,"code":"ORG_MEMBERSHIP_REVOKED"}`. Te 51 czerwieni to kaskada po nieudanym żądaniu przygotowującym dane, a nie 51 niezależnych zachowań produktu.

## Plik-świadek

`roiFinanceSeam.routes.test.ts` ma 25 czerwonych przypadków z 26. Jedyny zielony przypadek to:

`POST /visibility-policy maps RoiVisibilityGovernanceActorNotAuthorizedError to 403`

Różnica jest diagnostyczna: ten przypadek jako jedyny oczekuje statusu `403`. Koperta widoczności zwraca `403` przed dojściem do zamockowanego `mockPublishRoiGovernedVisibilityPolicy`, więc asercja statusu przechodzi z niewłaściwej przyczyny. Pozostałe przypadki oczekują `200`, `201`, `400`, `404` albo `409` i ujawniają ten sam wcześniejszy zwrot `403`.

## Pliki `09_RESULTS` czerwone w całości

| Plik | Czerwone / wszystkie |
| --- | ---: |
| `okr.routes.test.ts` | 118 / 118 |
| `kpi.routes.test.ts` | 33 / 33 |
| `roiForecastActual.routes.test.ts` | 27 / 27 |
| `okrReview.routes.test.ts` | 27 / 27 |
| `kpiScorecard.routes.test.ts` | 27 / 27 |
| `roiPir.routes.test.ts` | 26 / 26 |
| `roi.routes.test.ts` | 26 / 26 |
| `roiCaseApproval.routes.test.ts` | 22 / 22 |
| `kpiDeviation.routes.test.ts` | 21 / 21 |
| `roiBenefitsRealization.routes.test.ts` | 15 / 15 |
| `roiEconomicModel.routes.test.ts` | 14 / 14 |

