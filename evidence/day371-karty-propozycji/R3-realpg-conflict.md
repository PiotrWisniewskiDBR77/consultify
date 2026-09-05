# R3 — ponowne wykonanie propozycji

## Zakres dowodu

- realny `ApiGateway.initializeRoutes(app)`
- podpisany JWT
- PostgreSQL `127.0.0.1:6442/cx371`
- rzeczywisty endpoint `POST /api/table-platform/schema/proposals/:id/execute`
- odczyt rekordu po każdym żądaniu

## RED przed poprawką

Pierwsze żądanie zwróciło `200` i zapisało `status=failed` oraz niepuste
`resolved_at`. Drugie żądanie zwróciło nieotypowane `500`; wartość
`resolved_at` nie zmieniła się. RED dowodził brakującego mapowania konfliktu.

## GREEN po poprawce

Przebieg verbose zakończył się `1 passed`:

- pierwsze żądanie: `200`, rekord `status=failed`,
  `resolved_at=2026-09-05T07:50:30.246Z`;
- drugie żądanie: `409`, `code=PROPOSAL_ALREADY_EXECUTED`,
  `details.status=failed`;
- drugi odczyt bazy: ten sam status i dokładnie to samo `resolved_at`.

Pierwsza odpowiedź ma `success=false`, ponieważ test celowo używa nieznanej
operacji i sprawdza semantykę jednokrotnego rozstrzygnięcia propozycji, bez
tworzenia dodatkowych danych domenowych.

## Mutacja i ograniczenie dowodu

Odtworzenie obu plików sprzed R3 ponownie usunęło typowany konflikt. Jeden
przebieg JSON zatrzymał się jednak podczas ciężkiej inicjalizacji całego
ApiGateway i oznaczył asercję jako `skipped`; nie jest liczony jako miarodajny
RED ani GREEN. Końcowy miarodajny przebieg verbose wykonał asercję i przeszedł.

Zmiana serwera jest wąska: domenowy `TablePlatformError` wyłącznie dla
ponownego wykonania oraz istniejący `handleRouteError` wyłącznie w catchu
endpointu execute.
