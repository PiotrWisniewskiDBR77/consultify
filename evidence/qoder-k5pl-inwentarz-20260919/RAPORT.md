# K5pl — paczka-inwentarz (Wpis 227, DEC-689)

Linia: `origin/integracja/20260911` = okno 17 `236320b143`. HEAD pomiaru: `869603ee94`
(gałąź `qoder/c-k5pl-assessment-20260919`). Pomiar wyłącznie odczytowy — ZERO edycji kodu.
K5pl PRZED = **237** (bez zmian; to paczka pomiarowa).

## 1. Werdykt — premisa Wpisu 227 fałszywa

Wpis 227: „NAJPIERW ~36 odpowiedzi **BEZ kodu** (tylko te tester widzi po polsku)".

**Zmierzono: 0 (zero) z 237 trafień K5pl jest bez kodu.** Każde z 237 polskich zdań
serwera siedzi w obiekcie odpowiedzi, który MA siostrzany klucz `code:` albo
`errorCode:` o wartości UPPER_SNAKE. Zbiór „~36 bez kodu" na tej linii NIE ISTNIEJE.

Klasyfikacja 237 (dowód: `INWENTARZ.tsv`, skrypt `/tmp/k5pl-classify.mjs` +
`/tmp/k5pl-validate.cjs`, brace-matching obiektu odpowiedzi z wycinaniem stringów
i strażą „trafienie musi być wewnątrz dopasowanego bloku" → BLOCK_MISMATCH = 0):

| klasa | ile | co to znaczy dla użytkownika |
|---|---|---|
| **LOKALIZOWANY** | **229** | kod jest w `apiErrorFallbacks.ts` ORAZ ma parę `errors.*` EN+PL → `translateKnownCode` zwraca EN → polskie zdanie serwera NIGDY nie renderowane (martwy ciężar; mechanizm B = kosmetyka kontraktu) |
| **MUTE** | **8** | kodUpper_SNAKE istnieje, ale NIE MA go w `apiErrorFallbacks.ts` ani w `errors.*` → `translateKnownCode` zwraca `null` → helperzy spadają na surowe polskie `message`/`error` → **TESTER WIDZI POLSKI** |
| **BEZ_KODA** | **0** | (premisa Wpisu 227) — puste |

Czyli realny defekt „tester widzi po polsku" to **8 MUTE**, nie „~36 bez kodu".

## 2. Dowód mechanizmu (plik:linia)

Klient nie używa `translateApiError.ts` (patrz §4). Używana ścieżka to `apiError.ts`:

- `src/utils/apiError.ts:29-34` — `translateKnownCode(code)`: `const fallback = API_ERROR_FALLBACKS_EN[code]; if (!fallback) return null;` → **nieznany kod = null**.
- `src/utils/apiError.ts:129-136` — `normalizeApiError`: `message = cleanMessage(input.message) || cleanMessage(input.error) || …` → message = **surowe polskie zdanie** serwera.
- `src/utils/apiError.ts:168` — `normalizeApiErrorMessage = translateKnownCode(code) ?? normalized.message`.
- `src/utils/apiError.ts:175` — `createApiError = new Error(translateKnownCode(code) ?? normalized.message)`.

Wniosek: kod w fallbackach → EN; kod **bez** fallbacku (8 MUTE) → `?? normalized.message`
= surowy polski. Potwierdzone greppem: dla wszystkich 8 `apiErrorFallbacks.ts=0`,
`en/translation.json errors.*=0`, `pl/translation.json errors.*=0`.

Konkretny przykład: `server/src/routes/ai/pinned-insights.routes.ts:99-101`
`return res.status(500).json({ error: 'Nie udało się przypiąć insightu', code: 'PINNED_INSIGHTS_PIN_FAILED' });`
— kod UPPER_SNAKE, brak w fallbackach → MUTE → polski renderowany.

## 3. Osiem MUTE (realny defekt, priorytet) — lista plik:linia

| plik:linia | moduł | kod | polskie zdanie (→ wartość PL) |
|---|---|---|---|
| `server/src/routes/ai/pinned-insights.routes.ts:101` | ZZ wspólne | `PINNED_INSIGHTS_PIN_FAILED` | Nie udało się przypiąć insightu |
| `server/src/routes/ai/pinned-insights.routes.ts:175` | ZZ wspólne | `PINNED_INSIGHTS_UPDATE_FAILED` | Nie udało się zaktualizować insightu |
| `server/src/routes/ai/pinned-insights.routes.ts:202` | ZZ wspólne | `PINNED_INSIGHTS_UNPIN_FAILED` | Nie udało się odpiąć insightu |
| `server/src/routes/ai.routes.ts:7189` | ZZ wspólne | `AI_CHAT_FAILED` | Nie udało się wygenerować odpowiedzi asystenta |
| `server/src/routes/assessment/assessment-ai.routes.ts:44` | 05 Assessment | `ASSESSMENT_SOURCE_UNAVAILABLE` | Źródło danych oceny jest chwilowo niedostępne. |
| `server/src/routes/assessment-reports.routes.ts:1363` | 05 Assessment | `ASSESSMENT_CONCLUSION_LINEAGE_MISSING` | Wniosek zapisany bez rodowodu do oceny — przerwane |
| `server/src/routes/assessment-workflow-v2.routes.ts:1126` | 05 Assessment | `ASSESSMENT_WORKFLOW_V2_CREATE_RUN_FAILED` | Nie udało się utworzyć przebiegu |
| `server/src/routes/settings.routes.ts:520` | 15 Settings | `SETTINGS_REGIONAL_UPDATE_FAILED` | Nie udało się zapisać preferencji regionalnych |

Uwaga: `apiErrorFallbacks.ts` MA `AUDIT_CONCLUSION_LINEAGE_MISSING`, ale NIE
`ASSESSMENT_CONCLUSION_LINEAGE_MISSING` — wariant oceny nigdy nie dopisany. To
potwierdza, że MUTE = realna luka rejestru, nie zamierzona generyczność.

Koncentracja MUTE per moduł: ZZ wspólne 4, 05 Assessment 3, 15 Settings 1.
Najmniejszy plik z największą liczbą MUTE = `pinned-insights.routes.ts` (3 w jednym
pliku, plik dedykowany, mały) → naturalna pierwsza paczka per-plik.

## 4. Znalezione przy okazji (JEDNO zdanie, ZERO naprawy — DEC-607)

`src/utils/translateApiError.ts` (`resolveApiError`/`translateApiError`) ma **0 importerów**
poza własnym plikiem (grep `translateApiError|resolveApiError` w `src/**` = 4 trafienia,
wszystkie w definicji) — jego branch-2 „generyczny EN dla nieznanego kodu" nigdy się nie
wykonuje; używana jest ścieżka `apiError.ts` (`normalizeApiErrorMessage`/`createApiError`),
która dla nieznanego kodu zwraca SUROWY POLSKI, nie generyk. To jest kontekst długu D-141
(brak `tests/unit/i18n/serverErrorCodeRatchet.test.mjs` powołanego w `translateApiError.ts:19`).

Rezydualne ryzyko (też bez naprawy teraz): nawet 229 LOKALIZOWANY pokaże polski na każdej
ścieżce klienta, która czyta `data.error` / `normalizeApiError().message` bezpośrednio
zamiast `normalizeApiErrorMessage`/`createApiError` — audyt wołaczy klienta to osobny zakres.

## 5. Rekomendacja kolejności (do ratyfikacji CTO — zmiana wobec Wpisu 227)

1. **PRIORYTET 1 = 8 MUTE** (realny defekt tester-facing). Kształt mechanizm B z Wpisu 226:
   dopisz EN fallback w `apiErrorFallbacks.ts` + parę `errors.<KOD>` EN/PL w
   `translation.json` (PL = dotychczasowe zdanie z tabeli §3, EN = tłumaczenie), usuń
   redundantne polskie `error:`/`message:` z serwera (zostaw `code:`), test parzystości +
   supertest na realnej trasie (ciało MA stabilny `code`, NIE MA polskich diakrytyków) +
   mutacja RED (przywróć polskie `error:` → RED; usuń klucz `en` → parzystość RED).
   Jeden plik = jedna paczka, od `pinned-insights.routes.ts` (3 MUTE, mały plik).
   server/** → etap 2 CTO.
2. **PRIORYTET 2 = 229 LOKALIZOWANY** (kosmetyka kontraktu, ZERO zmiany widocznej dla
   użytkownika — polskie zdanie i tak nie renderowane): usuń redundantne polskie
   `error:`/`message:`, zostaw `code:`. K5pl 237 → 0. Per plik, najmniejszy najpierw;
   `assessment-hub.routes.ts` (6, wszystkie LOKALIZOWANY) wchodzi TU, nie do priorytetu 1.
3. **D-141 (S, po pierwszym module MUTE):** odbudować `serverErrorCodeRatchet.test.mjs`
   jako ratchet „każdy 4xx/5xx ma `code:`" + strażnik „kod nie jest niemy" (każdy kod
   emitowany przez trasę istnieje w `apiErrorFallbacks.ts` I ma parę `errors.*` EN/PL).

## 6. Pliki dowodowe

- `INWENTARZ.tsv` — 237 wierszy: `plik:linia | modul | kod | klasa | tekst_pl`
  (posortowane: klasa, moduł, plik, linia).
- Skrypty pomiarowe (niecommitowane, w `/tmp`): `k5pl-classify.mjs` (klasyfikator
  brace-matching), `k5pl-validate.cjs` (cross-check kodów z rejestrami), `k5pl-emit.cjs`
  (generator TSV). Źródło listy: `pomiar-jezyka.mjs --report` sekcja K5pl (237).
