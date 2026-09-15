# K4 / W73 — niezależny sceptyczny review

**Werdykt: HOLD.** Kandydat `14975a6cd00d217d77fc10a91543dd9c2d9876a0` nie dowodzi spłaty K8sen `3183 → 0`: miernik ukrywa potwierdzone realne ujścia, profil użytkownika nie dociera do nowego resolvera, a generator PDF nadal zapisuje stałe angielskie etykiety poza mianownikiem K8sen.

Review wykonano na gałęzi `codex/review-k4-k8sen-20260915`, z produktu `origin/backup/codex/c-k4-k8sen-20260915`. Zaakceptowany mianownik K1 jest obecny jako `775947993ef96b1fcbd4e96fa725a48bae9dc7b3`; implementacja K4 kończy się na `2f57ff95f9632c2b4be8fa64a27bb466ae2685ea`, a commit freeze na `14975a6cd00d217d77fc10a91543dd9c2d9876a0`.

## Blokery

### P1 — 1627 `throw new Error(...)` zostało wyłączonych składniowo, mimo że część trafia do użytkownika

`scripts/i18n/pomiar-jezyka.mjs` pomija każde dopasowanie zaczynające się od `throw new Error(`. Klasyfikator następnie przypisuje wszystkim 1627 pozycjom klasę `a:sanitized-throw` z jednym, niezweryfikowanym uzasadnieniem. To nie jest własność zachowania aplikacji.

Konkretny kontrprzykład:

1. `server/src/services/ai/AIPipeline.ts:297` rzuca `Model not allowed by policy: ${modelId}`.
2. `AIPipeline.handleError()` zachowuje surowe `error.message`.
3. `execute()` zwraca ten obiekt jako `error`, a ścieżka streamingowa przekazuje go w callbacku `type: 'error'`.
4. Tego komunikatu nie ma w wykonywalnym katalogu. Bezpośredni probe zwrócił dla locale PL niezmienione `Model not allowed by policy: gpt-x`.

Zerowanie miernika pochodzi więc z maski syntaktycznej, a nie z dowodu sanitacji na każdej granicy. Narusza to wprost warunek K4 „bez ukrywania real sinks wzorcem”. Naprawa wymaga klasyfikacji według rzeczywistego call path: tylko potwierdzone throw kończące w sanitującym boundary mogą zostać wyłączone; zwracane/callbackowe/SSE błędy muszą pozostać w mianowniku albo dostać lokalizację kodem.

### P1 — miernik uznaje za spłacone wpisy oznaczone `runtime: false`

`wczytajZlokalizowaneKomunikatyK8s()` dodaje do `K8S_ZLOKALIZOWANE` każde pole `en` z 13 partii, bez sprawdzenia `runtime`. Tymczasem runtime localizera jawnie odrzuca wpisy `runtime === false`. Katalog zawiera 9 takich wpisów.

Dwa z nich klasyfikacja uznaje za realne ujścia:

- `server/src/index.ts:852`, `b:api-message`, złożony komunikat alertu;
- `server/src/services/smsService.ts:354`, `b:api-error`, `Invalid code...` zwracany z wyniku weryfikacji OTP.

Oba znikają z K8sen, lecz nie mogą zostać przetłumaczone przez `COMPILED`. Warunek `K8sen=0` jest zatem fałszywym GREEN także niezależnie od problemu z `throw`.

### P1 — deklarowane `profil > Accept-Language > EN` nie działa na prawdziwym principalu

`resolveServerErrorLocale()` odczytuje `req.user.language`, `preferred_language` lub `locale`. Produkcyjny `verifyToken` tworzy jednak `AuthenticatedUser` bez tych pól, a sam interfejs `AuthenticatedUser` ich nie deklaruje. Nie ma też zmiany K4, która ładowałaby język profilu do requestu.

Testy budują sztuczny request `{ user: { language: 'pl' } }`, którego nie produkuje middleware uwierzytelniający. W rzeczywistej ścieżce profil nie może wygrać z nagłówkiem; lokalizacja opiera się na `Accept-Language` albo EN. Probe na kształcie principalu produkcyjnego bez sztucznego pola profilu rozstrzygnął `en`.

### P1 — generator PDF pozostaje angielski i nie jest objęty mianownikiem

Pięć pozycji oznaczonych w klasyfikacji jako `b:pdf-text` pochodzi w rzeczywistości z wywołań PPTX `addText`; poprawiono je w kandydacie. `writePdfReport()` używa innego API (`doc.text`) i nadal bezwarunkowo zapisuje m.in. `Decisions Required`, `None`, `Decision`, `Owner`, `TBD`, `Key Highlights` i `No highlights available.`. Nie ma ich w wejściowym raporcie 3183. `generateExport(..., language)` przekazuje język tylko do `writePptxReport`; `writePdfReport` nie przyjmuje locale.

Kandydat może więc wykazać `K8sen=0`, gdy realny eksport PDF w profilu PL nadal ma angielskie nagłówki. To jest luka czułości miernika oraz niespełniony jawny warunek K4 „PDF/PPTX locale”.

## Pozostałe ustalenia

- Plik klasyfikacji ma formalnie 3183/3183 pozycji: `a=2333`, `b=850`, bez pustej klasy; to dowodzi kompletności tabeli, ale nie poprawności klasyfikacji.
- Katalog ma 13 partii: 12 × 60 oraz 1 × 43, razem 763 unikalne wpisy. Klasa `b` ma 758 unikalnych tekstów; pięć dodatkowych wpisów pochodzi ze wspólnego słownika.
- Automatyczny audyt wszystkich parsowalnych par EN/PL potwierdził tę samą liczbę i kolejność placeholderów. Jeden wpis powtarza `${MAX_KPI_DASHBOARD}`; bieżący matcher mapuje token przez `Map`, lecz dla prawdziwego źródła obie wartości są tym samym stałym wyrażeniem.
- Testy potwierdzają, że JSON localizer nie zmienia pól `status` i `code`, oraz że e-mail wybiera PL z `users.language`. Nie kompensuje to powyższych braków innych ścieżek.
- Sceptyczna próbka tłumaczeń wykazała także jakość wymagającą korekty, np. `Invalid status transition` → `Nieprawidłowa transakcja statusu`, `lease ... held by worker` → `Wynajem zadania ... trzymany przez worker`, a wpis Gross Profit gubi znaczenie „partial COGS detected (multi-segment)”. To P2 po usunięciu blockerów miernika i runtime.
- Zakazane pliki niezmienione; migracji brak. Dwa tekstowe wystąpienia `as any` są wyłącznie zawartością komunikatu w katalogu; nowego operatora `as any` w kodzie K4 nie ma.
- Freeze inventory: 38/38 niesamorekurencyjnych wpisów ma zgodny SHA-256, Git blob i rozmiar; manifest poprawnie wyłącza własny hash.

## Powtórzone bramki

- focused K1/localizer/error tests: 87/87 PASS, `--retry=0`;
- e-mail recipient locale: 1/1 PASS, `--retry=0`; pełny plik zachowuje 2 znane czerwienie formatu pola `from` (90 PASS, 2 FAIL w zbiorczym przebiegu);
- server TypeScript: 0;
- frontend TypeScript: 177, `--listFilesOnly` RC 0 i 7424 pliki;
- `check:jezyk:ci`: PASS, ale wynik nie jest wiarygodnym dowodem K8sen z powodów P1 powyżej;
- `check:list-canon`: 349/349;
- `check:artefakt`: 8/8, R2+R3 0/0, danger 117/117;
- build: PASS przy `NODE_OPTIONS=--max-old-space-size=8192`, 10754 moduły. Pierwszy równoległy przebieg bez podniesionego limitu pamięci zakończył się OOM po transformacji, nie błędem produktu.

## Warunek ponownego odbioru

Usunąć globalne wyłączenie `throw new Error`, wykluczać wyłącznie dowiedzione bezpieczne call paths, nie maskować wpisów `runtime:false`, doprowadzić język profilu do prawdziwego principalu oraz wygenerować PDF w locale raportu/użytkownika. Następnie przeliczyć uczciwy mianownik, przebudować klasyfikację i freeze, dodać regresje dla powyższych kontrprzykładów i przekazać do ponownego niezależnego review.
