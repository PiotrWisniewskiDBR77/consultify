# F-M3 — raport wykonania §11

Data: 2026-09-05  
Gałąź: `codex/f-m3-m4`  
Baza: `origin/staging` (`59e282df885161467102ceb0c23a14c8717b2bec`)

## Werdykt

**STOP — EVIDENCE_MISSING / brak wymaganej pracy backendowej.**

Nie wdrożono kolumny „SPRAWOZDANIE ŹRÓDŁOWE”. §11 zabrania zapytania lineage per wiersz i nakazuje zatrzymanie, jeżeli serwer nie udostępnia zbiorczego odczytu dla wielu `business_version_id`.

## Pomiar bramki KROK 1

Skan tras serwera i klientów wykazał wyłącznie odczyty jednostkowe:

- `GET /api/v8/finance-v2/versions/:businessVersionId/lineage`,
- `GET /api/v8/finance-v2/versions/:businessVersionId/lineage-navigator`,
- `POST /api/v8/finance-v2/versions/lineage-edges` jest zapisem pojedynczej krawędzi, nie zbiorczym odczytem.

Nie znaleziono trasy ani klienta przyjmującego `businessVersionIds` / `business_version_ids`. Lista pakietów używana przez `useFinanceData` nie zawiera nazw źródeł ani projekcji lineage. Istniejący klient `getFinanceVersionLineage(businessVersionId)` również jest jednostkowy.

Wniosek: pobranie źródła dla 14 wierszy wymagałoby N+1 żądań. To jest wprost zabronione przez F-M3 §8 i §11.

## §10 — samokontrola

| Bramka | Wynik | Dowód / powód |
| --- | --- | --- |
| Testy `src/components/Economics/__tests__` | NOT_RUN | STOP nastąpił przed zmianą kodu i przed testem nowej kolumny. |
| `scripts/check-list-canon.sh` | NOT_RUN | Brak zmiany produktu do walidacji. |
| Zrzut `M3-lista.png` | NOT_RUN | Kolumna nie została zaimplementowana; obraz nie mógłby spełnić progu. Plik sesji `/private/tmp/odbior-auth/auth.json` jest czytelny. |
| Mutacja fallbacku na pusty string | NOT_RUN | Nie wolno tworzyć testu/implementacji opartej na zakazanym N+1. |
| Zakazy | PASS | Bez push, stash, `--no-verify`, nowych flag, nowych komponentów tabel i zmian migracji. |

## Brakujący kontrakt umożliwiający wznowienie

Potrzebny jest jeden org-scoped odczyt zbiorczy dla listy wersji biznesowych, zwracający co najmniej: docelowy `businessVersionId`, źródłowy `businessVersionId`, nazwę źródłowego artefaktu/pakietu i typ krawędzi. Alternatywnie te pola mogą wejść do odpowiedzi listy pakietów. Dopiero po scaleniu takiego kontraktu F-M3 można wykonać bez N+1.

## Nieosiągnięte

- KROKI 1–5 F-M3: nie rozpoczęte po obowiązkowym STOP w KROKU 1.
- Kryteria obrazu i mutacji: nieudowodnione.
- F-M3: **NOT_COMPLETE**.
