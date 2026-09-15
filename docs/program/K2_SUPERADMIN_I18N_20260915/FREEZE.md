# K2 — SuperAdmin i18n — freeze

**Werdykt v2: poprawki po HOLD są gotowe do ponownego niezależnego odbioru; semantyka PL została przejrzana i naprawiona, ekran Organizations jest rzeczywiście po polsku, a dług pozostaje K4en 1 / K7 0.**

## Tożsamość

- Baza: `f2628a0d36af85d97bcbe67b820d728c7c2f2f28`.
- Gałąź: `codex/b-k2-superadmin-i18n-20260915`.
- SHA kodu v2 po poprawkach semantycznych: `3d61bbfb93` (finalny SHA freeze jest SHA commita zawierającego ten dokument).
- Kopia: `origin/backup/codex/b-k2-superadmin-i18n-20260915` (po finalnym commicie dokumentacji wskazuje SHA freeze).
- Zakres produktu: wyłącznie `src/views/superadmin/**`, `src/components/SuperAdmin/**`, locale EN/PL i test kontraktowy.

## Wynik

- 532 pierwotne pary kluczy `superadmin.*`, 7 kluczy szablonu e-mail oraz 17 kluczy widocznej powierzchni Organizations mają zasoby EN/PL.
- Przejrzano semantycznie wszystkie 539 pierwotnych wartości i poprawiono 119 tłumaczeń, w tym grant/uprawnienie, reveal panel, target audience, secret rotation, stany Failed/Pending i terminologię domenową security, revenue, prompts oraz enterprise.
- Przykład składni pozostaje literalnie `SUM(revenue) / COUNT(users)`; zasób PL używa interpolacji `{{formula}}`, więc identyfikatory nie są tłumaczone.
- 538 wystąpień surowych napisów zastąpiono przez `tlumaczPozaHookiem()` bez zmiany przepływu i zachowania.
- Wszystkie wykryte formatery dat i liczb w zakresie używają `localeListy()`.
- Pomiar końcowy: K4en 1 i K7 0 w zakresie. K4en 1 to `InvoiceCenterView.tsx:383` i tekst skanera `pending:` — nazwa pola danych, bez widocznej treści UI.
- Zero nowych `as any` w diffie.

## Bramka

- `npm run check:jezyk:ci`: GREEN; delta repo K4en -600, K7 -168.
- `node scripts/i18n/pomiar-jezyka.mjs --report ...`: RC 0; wynik zakresu K4en 1 / K7 0.
- Test kontraktowy `superadminI18nDebt.w73.test.ts`: 3/3 GREEN; sprawdza kompletność EN/PL, semantykę terminów blokujących, literalną formułę i locale.
- Importery/delta v2: 100/101 GREEN, dokładna lista i log w `IMPORTER_DELTA_MANIFEST_V2.md`. Jedyny RED `settings-admin-superadmin.p31-33.test.ts` ma byte-identyczny test i badane źródło na exact base oraz v2. Historyczne 175/176 oznaczono jako EVIDENCE_MISSING i zastąpiono odtwarzalnym przebiegiem.
- Esbuild pierwszej dostawy: 180/180 GREEN; esbuild dwóch TSX zmienionych w v2: 2/2 GREEN.
- `tsc -p server/tsconfig.json --noEmit --pretty false`: RC 0.
- Front TSC: ostatni pełny pomiar na freeze v1 miał RC 1, **177 błędów = baseline W73 177**, zero błędów w ścieżkach K2. Po poprawkach v2 trzy pełne próby przekroczyły limit 120 s (RC 142) zanim TypeScript wypisał diagnostykę, więc pełny wynik TSC dla v2 pozostaje **NOT_PROVEN**. Zmienione w v2 pliki TSX przeszły osobny esbuild 2/2, a pełny build przeszedł RC 0 (10 754 moduły).
- `bash scripts/check-list-canon.sh`: 349.
- `bash scripts/check-artefakt.sh`: 8 / 0 / 117.
- `npm run build`: v2 RC 0, 10 754 moduły, 1m30s, bez pipe.

## Dowód przeglądarkowy

- `evidence/k2-superadmin-i18n-20260915/organizations-en-light.png`.
- `evidence/k2-superadmin-i18n-20260915/organizations-pl-light.png`.
- Zrzuty 1440×900, motyw jasny, bez chrome przyrządu. PL pokazuje przetłumaczone: tytuł, Pomoc/Odśwież, trzy zakładki, wyszukiwarkę, komunikat retencji, nagłówki tabeli i status Aktywna.
- Realny `OrganizationsView` zamontowany w produkcyjnej powłoce treści przez repozytoryjny dev-render; dane są fixture, bez backendu i logowania. Oba zrzuty obejrzano ręcznie.
- Trwałe logi `organizations-{en,pl}-light.console-network.log`: screenshot RC0, błędy konsoli 0, odpowiedzi 4xx/5xx 0; zawierają także odczyt widocznego tekstu DOM. Dev-render zatrzymano po dowodzie.

## Granice i znany remainder

- Dziesięć K4en i siedem K7 z raportowanego baseline modułu 14 leży poza dozwolonym zakresem K2 (`src/components/Admin/**`, `src/views/Admin/**`, `src/views/SystemHealthView.tsx`) i nie zostało dotkniętych.
- Nie zmieniano `scripts/i18n`, `MAPA_JEZYKA`, Execution, Settings ani MyWork.
- Poprzedni niezależny review `2a88b267ff` miał werdykt HOLD; wszystkie wskazane P1/P2 mają teraz kod, test lub trwały artefakt. Wymagany jest ponowny niezależny review v2.
