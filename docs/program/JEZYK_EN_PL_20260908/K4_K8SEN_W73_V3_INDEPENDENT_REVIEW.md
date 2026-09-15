# K4 v3 — niezależny ponowny przegląd

**Werdykt: HOLD.** Kandydat `770db4631ec920ebeafcc065de3ec0ae86280812` naprawia cztery techniczne blokery v2, ale nie spełnia celu W73 dla realnych ujść użytkownika: 630 z 1577 pozycji klasy `(b)` dostaje tylko polski prefiks przed niezmienionym angielskim komunikatem, a dalsza część mapowana leksykalnie również bywa mieszana. Zmiana tekstu nie jest dowodem lokalizacji PL.

## Zakres i tożsamość

- kandydat: `origin/backup/codex/c-k4-k8sen-20260915` = `770db4631ec920ebeafcc065de3ec0ae86280812`;
- kod v3: `6424a54e3d0cdb6545006c65b7ee3ff198fadc81`;
- baza K1: `775947993ef96b1fcbd4e96fa725a48bae9dc7b3`;
- poprzedni HOLD: `0cc005de576095a1fb07f0c581f6f20f93993ed9`;
- kod produktu nie był edytowany w tym przeglądzie.

## Bloker P1 — 630 mieszanych komunikatów w realnej klasie użytkownika

`localizeUncataloguedError()` (`serverPayloadLocalizer.ts:120-133`) uznaje brak reguły słownikowej za lokalizację przez zwrot:

```text
Błąd operacji: <niezmieniony komunikat angielski>
```

Pomiar wszystkich 1577 wpisów klasy `(b)` potwierdza 630 takich wyników. Przykłady:

- `Błąd operacji: Template is already published`;
- `Błąd operacji: Can only restore versions of DRAFT templates`;
- `Błąd operacji: Email address does not match invitation`;
- `Błąd operacji: Code has expired`;
- `Błąd operacji: Only conversation owners can change roles`;
- `Błąd operacji: No scoped session data available for analysis`.

To nie są wyłącznie hipotetyczne napisy. Aktywny ekran `PlaybookTemplatesListView.tsx` wywołuje `POST /api/ai/playbooks/templates/:id/publish`. `AIPlaybookService.publishTemplate()` rzuca `Template is already published` (`aiPlaybookService.ts:338-350`), controller wystawia `err.message` jako `error` w HTTP 500 (`AIPlaybooksController.ts:700-730`), a globalny `serverPayloadLocale` obejmuje tę trasę (`Gateway.ts:539-543`). Dla principalu PL bezpośredni payload zachowuje `status` i `code`, ale zwraca:

```json
{"error":"Błąd operacji: Template is already published","status":500,"code":"PLAYBOOK_PUBLISHED"}
```

W73 wymaga lokalizacji realnych odpowiedzi API `message/error`. Polski prefiks nie lokalizuje angielskiej treści. Co więcej, część pozostałych 947 wyników jest tylko częściowo podmieniona, np. `Missing required decision fields: proposal_id` staje się `brak wymaganych decision fields: proposal_id`. Asercja testu `value.error !== source` i licznik `1577/1577 changed` mierzą dowolną zmianę bajtów, nie język wyniku.

Klasyfikacja nadal stosuje jeden ogólny powód dla niemal całej klasy b i ma `sourceSha: "WORKTREE"`; nie daje śladu per call path ani exact SHA. Residual `K8sen=1584` pozostaje uczciwym rejestrem długu, ale nie można opisać go jako pełnego PL coverage.

## Cztery blokery v2 — wynik

1. **Meeting chain: naprawiony.** Realny test prowadzi `MeetingExecutor → ActionExecutionAdapter → HTTP payload`; PL brzmi `Wykonanie spotkania wymaga organizationId`, a `status=400` i `code=BAD_REQUEST` pozostają bez zmian.
2. **`runtime:false`: naprawiony.** Loader używa AST TypeScript, widzi całe `ObjectLiteralExpression`, wyklucza zagnieżdżony wpis `Invalid code. ${remainingAttempts...}` i ma wykonywalne tłumaczenia obu rozwiniętych wariantów.
3. **Principal: naprawiony.** `verifyToken` czyta `SELECT language FROM users WHERE id = ?`, zgodnie z account-level SSOT, i test realnego middleware przechodzi.
4. **Miernik K1: naprawiony.** Pełny test ma `72/72`, `--retry=0`.

PDF `doc.text` pozostaje statycznie `36 → 0`; Management Reports ma test polskich etykiet. AIPipeline `process()` i `processStream()` przechodzą dla `request.options.language='pl'`.

## Powtórzone bramki

| Bramka | Wynik |
|---|---|
| miernik K1 | PASS `72/72` |
| focused K4, 7 plików | **FAIL `37/39`** — dwa testy envelope sender oczekują surowego adresu, runtime dodaje `"Consultify" <...>` |
| server TypeScript | PASS, `0` |
| frontend TypeScript | RC `2`, dokładnie `177` diagnostyk (próg W73 zachowany, brak delty frontendowej v3) |
| język | PASS ratchet, residual `K8sen=1584`, `K7 -11` |
| list canon | PASS `349/349` |
| artefakt | PASS `8-0-117` |
| production build | PASS, `10754` modułów, 35.13 s |
| freeze hash | PASS `51/51` |
| granice | brak migracji i zmian w trzech plikach zakazanych |

Dwa tekstowe trafienia `as any` są zawartością katalogu komunikatów, a nie nowymi wykonywalnymi rzutowaniami.

## Warunek zdjęcia HOLD

Realne wpisy klasy `(b)` muszą mieć pełne tłumaczenia EN/PL z zachowaniem parametrów i kodów. Test coverage powinien wykrywać obecność angielskiej prozy w wyniku PL, zamiast sprawdzać wyłącznie nierówność względem źródła. Wpisy bez potwierdzonego ujścia HTTP trzeba przeklasyfikować na podstawie rzeczywistych call paths. Zbiorczy focused musi być zgodny z manifestem i zielony na dokładnym kandydacie.
