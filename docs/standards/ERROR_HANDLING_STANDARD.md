# ERROR HANDLING STANDARD (H6.4) — koniec gołych 500

SSOT obsługi błędów backendu Consultify. Cel: **żaden `res.status(500)` bez kodu błędu
i bez logu z correlation-id**; przewidywalne 4xx dla intencji klienta; fail-soft dla
wzbogaceń (enrichment) zamiast wywracania całej odpowiedzi.

Standard jest KODEM, nie opisem — wzorce niżej istnieją już w repo, cytujemy je jako kanon.

---

## 1. Taksonomia statusów

| Klasa | Kiedy | Wymogi |
|-------|-------|--------|
| **4xx — intencjonalne** | walidacja, brak zasobu, brak uprawnień, konflikt, rate-limit. Błąd wynika z żądania klienta. | ZAWSZE z `code` (maszynowy). Log poziom `warn`. Bezpieczny komunikat (bez wewnętrznych detali). |
| **5xx — nieoczekiwane** | wyłącznie realna awaria po stronie serwera (wyjątek, DB down, bug). | ZAWSZE z `code`. ZAWSZE zalogowane `logger.error` z `correlationId`, `path`, `method`. Klient NIGDY nie dostaje surowego `err.message` w produkcji. |
| **degraded (200)** | wzbogacenie (enrichment) nie-krytyczne dla operacji — badge, liczniki, podpowiedzi AI, panele boczne. | Zamiast 500 zwróć 200 z bezpiecznym defaultem + `degraded: true` (+ powód). Log `warn` z `correlationId`. |

### Reguły twarde
- **NIGDY fail-open na auth ani na zapisie (write).** Nieudany login/refresh/POST/PATCH/DELETE →
  prawdziwy błąd (401/403/5xx z kodem), NIGDY sfałszowane `{ success: true }` ani degraded-200.
  Fail-soft dotyczy WYŁĄCZNIE odczytów-wzbogaceń.
- **Zero wycieku wnętrza.** `res.status(500).json({ error: err.message })` jest zakazane — ujawnia
  ścieżki/SQL/stack klientowi i nie zostawia śladu w logach. Surowy `err` idzie do `logger.error`,
  klient dostaje stabilny komunikat + `code`.
- **Kontrakt odpowiedzi addytywnie.** Dodanie `code` obok istniejącego `error: string` nie łamie
  frontu (nieznane pola są ignorowane). Nie zmieniaj kształtu istniejących pól bez potrzeby.

---

## 2. Warstwa centralna (Gateway) — ISTNIEJE, używaj jej

- **Globalny middleware:** `server/src/utils/ErrorHandler.ts → errorHandlerMiddleware`
  (zarejestrowany w `server/src/index.ts:1696`, po Sentry). Klasyfikuje `AppError`/operacyjne vs
  nieznane, wstrzykuje `correlationId`, loguje 5xx z kontekstem, w produkcji chowa detale nieznanych błędów.
- **Correlation-id:** nadawany w `server/src/middleware/apiLogging.middleware.ts`
  (`resolveCorrelationId` → nagłówek `X-Correlation-ID` albo świeży UUID), zarejestrowany
  w `server/src/Gateway.ts:378` PRZED trasami, odsyłany w nagłówku odpowiedzi. Dostęp w handlerze:
  `(req as any).correlationId`.
- **Klasy błędów:** `server/src/utils/ErrorHandler.ts` — `AppError(message, statusCode, code, details)`,
  helpery `validationError()`, `notFoundError()`, oraz `asyncHandler()` (łapie rzucone błędy → `next`).
  Dodatkowe typy w `server/src/types/index.ts` (`ValidationError`, `AuthenticationError`,
  `AuthorizationError`, `NotFoundError`, `ConflictError`, `RateLimitError`).

**Preferowana droga w nowym kodzie:** rzucaj `AppError`/`throw notFoundError(...)` wewnątrz
`asyncHandler` — centralny middleware nada kod, zaloguje z correlation-id i ustandaryzuje kształt.
Handler nie musi sam robić `res.status(500)`.

---

## 3. Wzorce w handlerze (gdy zwracasz błąd lokalnie z `catch`)

Dojrzały wzorzec już w repo: `buildNotificationsFailClosedError` / `buildConversationFailClosedError`
(np. `notifications.routes.ts:30`, `conversations.routes.ts:44`) — zwracają
`{ status, error: { code, message, timestamp }, correlationId }`.

Minimalny, kontrakt-zachowawczy wzorzec dla istniejących `catch` (zachowuje `error: string`):

```ts
// 5xx nieoczekiwane — kod + log z correlation-id, bez wycieku err.message
} catch (err: any) {
  logger.error('[Module] <akcja> failed', { err, correlationId: (req as any).correlationId });
  return res.status(500).json({ error: 'Nie udało się <akcja>', code: 'MODULE_ACTION_FAILED' });
}

// enrichment (badge/licznik/podgląd) — fail-soft degraded zamiast 500
} catch (err: any) {
  logger.warn('[Module] <akcja> degraded', { err, correlationId: (req as any).correlationId });
  return res.json({ count: 0, degraded: true });   // 200 + bezpieczny default
}

// write / auth — NIGDY fail-soft: realny błąd z kodem
} catch (err: any) {
  logger.error('[Module] <write> failed', { err, correlationId: (req as any).correlationId });
  return res.status(500).json({ error: 'Zapis nie powiódł się', code: 'MODULE_WRITE_FAILED' });
}
```

---

## 4. Konwencja kodów błędów
`MODULE_ACTION_RESULT`, UPPER_SNAKE, stabilne (front/telemetria na nich polega). Przykłady w repo:
`VALIDATION_ERROR`, `NOT_FOUND`, `RATE_LIMIT`, `REQUEST_JSON_TOO_LARGE`, `LEGACY_SETTINGS_SCOPE_BLOCKED`.

## 5. Definition of Done (odbiór)
1. Brak `res.status(500).json({ error: err.message })` (wyciek + brak logu) na trafionej trasie.
2. Każdy 5xx ma `code` oraz `logger.error` z `correlationId`.
3. 4xx intencjonalne mają `code`; komunikat bezpieczny.
4. Wzbogacenia degradują do 200-degraded; zapisy/auth NIGDY nie degradują.
5. `X-Correlation-ID` widoczny w odpowiedzi i w logu (do korelacji zgłoszeń).
