# K4 v4 — pełne polskie komunikaty realnych ujść serwera

**Werdykt E1: READY FOR INDEPENDENT REVIEW V4.** HOLD `7b5d27650f899a40c07f91fb62f3f3e539579572` został naprawiony: wszystkie 1577 wierszy klasy `(b)` mają pełny polski wynik, 630 fallbacków z angielską treścią zniknęło, a końcowy residual K8sen wynosi `0`.

## Mianownik i pokrycie zachowania

Pełna klasyfikacja v3 zachowuje mianownik `1577` realnych wierszy oraz `1317` unikalnych komunikatów. Katalog v4 jest podzielony na pliki `batch14`–`batch36`; każdy ma najwyżej 60 wpisów. Test zachowania wymaga dla każdego z 1317 unikalnych źródeł dokładnego wyniku PL z zatwierdzonego katalogu, braku prefiksu `Błąd operacji:` i braku znanych angielskich fraz po usunięciu placeholderów oraz identyfikatorów technicznych. Wynik: `1577/1577`, unikalne `1317/1317`, mixed fallback `0`, known-English prose `0`.

Parametry `${...}`, identyfikatory pól i stałe statusów pozostają niezmienione. Dopasowania szablonowe są sortowane według swoistości, dlatego ogólny wzorzec nie przechwytuje bardziej szczegółowego komunikatu.

## Ostatnie 35 pozycji

Pełna tabela per literał znajduje się w `K4_K8SEN_W73_V4_REMAINING_35.json`. Z 35 pozycji pozostających po pierwszym katalogu:

- 29 było realnymi ujściami propagacji i dostało pełne EN/PL w `batch36`;
- 6 to dokładnie wskazane techniczne kody lub diagnostyki crona/workera; dostały wpis per literał, bez szerokiego wyjątku pomiarowego;
- `unknown=0`, realne ujścia bez tłumaczenia `0`, końcowy K8sen `0`.

## Dowody zachowania

Realna ścieżka Superadmin prowadzi `AIPlaybookService.publishTemplate()` przez `AIPlaybooksController.publishTemplate()` i middleware `serverPayloadLocale`. Dla profilu PL źródło `Template is already published` daje `Szablon został już opublikowany`, bez angielskiej frazy, przy zachowaniu HTTP `500` oraz `code=PLAYBOOK_PUBLISHED`.

Zachowane zostały wcześniejsze dowody: MeetingExecutor → ActionExecutionAdapter → HTTP 400, AIPipeline execute/stream PL, canonical `users.language`, parser AST dla zagnieżdżonego `runtime:false` i PDF `doc.text`.

## Bramki

- właścicielski miernik K1: `72/72 PASS`, `--retry=0`;
- K4-owned focused: `43/43 PASS`, 7 plików;
- zbiorczy focused z e-mailem: `46/48`, jedyne dwa czerwone testy sendera są odziedziczone;
- exact-base `775947993ef96b1fcbd4e96fa725a48bae9dc7b3`: ten sam plik sendera daje `2 failed | 2 passed`; nazwy obu czerwieni są identyczne;
- kandydat dodaje tylko test locale subject do pliku e-mail i lookup locale/subject do usługi; nie zmienia `smtpConfig.from` ani dwóch starych asercji;
- server TypeScript: `0`;
- frontend TypeScript: `177` diagnostyk, próg W73 zachowany, brak delty frontendowej;
- `check:jezyk:ci`: PASS, K8sen `0`;
- list canon: `349/349` PASS;
- artefakt: `8/8`, R2+R3 `0/0`, danger `117/117` PASS;
- production build: PASS, `10754` modułów, 34.35 s (pojedynczo, heap 8192 MB).

Migracji, deployu i zmian w plikach zakazanych nie ma.
