# K2 — SuperAdmin i18n — freeze

**Werdykt: E1 gotowe do niezależnego odbioru; dług w powierzchni K2 spadł z K4en 533 / K7 167 do K4en 1 / K7 0, a jedyny pozostały K4en jest fałszywie dodatnim kluczem obiektu `pending:`.**

## Tożsamość

- Baza: `f2628a0d36af85d97bcbe67b820d728c7c2f2f28`.
- Gałąź: `codex/b-k2-superadmin-i18n-20260915`.
- SHA kodu po poprawkach typów: `2cfa04dd40d132257a8dd4859171a035dff655e8`.
- Kopia: `origin/backup/codex/b-k2-superadmin-i18n-20260915` (po finalnym commicie dokumentacji wskazuje SHA freeze).
- Zakres produktu: wyłącznie `src/views/superadmin/**`, `src/components/SuperAdmin/**`, locale EN/PL i test kontraktowy.

## Wynik

- 532 unikalne pary kluczy `superadmin.*` dodane do EN i PL oraz 7 kluczy szablonu wiadomości e-mail; angielski jest źródłem, polskie wartości są realnymi tłumaczeniami.
- 538 wystąpień surowych napisów zastąpiono przez `tlumaczPozaHookiem()` bez zmiany przepływu i zachowania.
- Wszystkie wykryte formatery dat i liczb w zakresie używają `localeListy()`.
- Pomiar końcowy: K4en 1 i K7 0 w zakresie. K4en 1 to `InvoiceCenterView.tsx:383` i tekst skanera `pending:` — nazwa pola danych, bez widocznej treści UI.
- Zero nowych `as any` w diffie.

## Bramka

- `npm run check:jezyk:ci`: GREEN; delta repo K4en -600, K7 -168.
- `node scripts/i18n/pomiar-jezyka.mjs --report ...`: RC 0; wynik zakresu K4en 1 / K7 0.
- Test kontraktowy `superadminI18nDebt.w73.test.ts`: 2/2 GREEN; sprawdza kompletność par EN/PL i brak niekanonicznego locale.
- Importery/delta: 175/176 GREEN. Jedyny RED `settings-admin-superadmin.p31-33.test.ts` odtworzono identycznie na exact base; test oczekuje tekstowego formatowania `c('platform-operations'`, a baza ma wywołanie wieloliniowe.
- Esbuild per zmieniony TSX: 180/180 GREEN.
- `tsc -p server/tsconfig.json --noEmit --pretty false`: RC 0.
- Front TSC: RC 1, **177 błędów = baseline W73 177**, zero błędów w ścieżkach K2. Pierwszy pomiar przed poprawką miał 179 i wskazał dokładnie dwa błędy K2 (`variant="error"` i `variant="spinner"` zostały omyłkowo przetłumaczone); oba naprawiono w `2cfa04dd40`. Finalny pomiar wykonano z `NODE_OPTIONS=--max-old-space-size=8192` i inkrementalnym plikiem wyłącznie w `/tmp`.
- `bash scripts/check-list-canon.sh`: 349.
- `bash scripts/check-artefakt.sh`: 8 / 0 / 117.
- `npm run build`: RC 0, 10 754 moduły, bez pipe.

## Dowód przeglądarkowy

- `evidence/k2-superadmin-i18n-20260915/organizations-en-light.png`.
- `evidence/k2-superadmin-i18n-20260915/organizations-pl-light.png`.
- Zrzuty 1440×900, motyw jasny, bez chrome przyrządu, 336 KB łącznie.
- Realny `OrganizationsView` zamontowany w produkcyjnej powłoce treści przez repozytoryjny dev-render; dane są fixture, bez backendu i logowania. Oba zrzuty obejrzano ręcznie. Brak błędów konsoli oraz 4xx/5xx w sesji zrzutowej.

## Granice i znany remainder

- Dziesięć K4en i siedem K7 z raportowanego baseline modułu 14 leży poza dozwolonym zakresem K2 (`src/components/Admin/**`, `src/views/Admin/**`, `src/views/SystemHealthView.tsx`) i nie zostało dotkniętych.
- Nie zmieniano `scripts/i18n`, `MAPA_JEZYKA`, Execution, Settings ani MyWork.
- Niezależny reviewer powinien potwierdzić semantykę reprezentatywnej próbki tłumaczeń i zaakceptować udowodniony baseline RED importera.
