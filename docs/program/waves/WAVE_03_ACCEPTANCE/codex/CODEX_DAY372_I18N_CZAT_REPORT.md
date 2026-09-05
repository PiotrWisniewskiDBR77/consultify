# CODEX — dyżur 372 — i18n Czat AI

Data: 2026-09-05
Marker: `9715bab7eabe0a8489b24cf0f0aa3cbf0d97da6c`
Gałąź: `codex/day372-i18n-czat-20260905`

## Wynik

Stan: **PARTIAL, 13 z 250 pozycji naprawionych; 237 pozostaje jawnie opisanych.**

R1 dostarczył pełny, odtwarzalny mianownik. R3 naprawił komplet 13 kluczy menu AI edytora w obu słownikach i ma zielony dowód resolvera oraz renderu. R2, R4 i R5 nie zostały przedstawione jako wykonane.

| Rodzina | PRZED | PO | Wynik |
| --- | ---: | ---: | --- |
| R2 literały bez `t()` | 42 | 42 | NIEZROBIONE |
| R4 `window.confirm` | 1 | 1 | NIEZROBIONE |
| R3 menu AI | 13 | 0 | ZROBIONE 13/13 |
| R4 nagłówek/historia/SystemHealth | 58 | 58 | NIEZROBIONE |
| R5 MessageRenderer i karty | 136 | 136 | NIEZROBIONE |
| Razem | 250 | 237 | PARTIAL |

Dowody źródłowe: `evidence/i18n-czat/skan-przed.txt`, `mianownik-przed.json`, `header-historia-lista.txt`, `messagerenderer-karty-lista.txt`, `klasa-c-podejrzani.txt`.

## Start i rozjazd bazy

`df -h /`: 60 GiB wolne. Porty 6443 i 5583 bez listenerów. Postgres ani runtime nie zostały uruchomione.

Wynik markera, dosłownie:

```text
MARKER OK
```

Wynik sanity, dosłownie:

```text
9715bab7eabe0a8489b24cf0f0aa3cbf0d97da6c
```

Tip `github-backup/grafika/m03-20260902` uciekł do przodu. Zgodnie z DEC-2026-08-26-95 pracę wykonano dokładnie z markera; nadzorca scala nowszy tip.

## Korekty wobec instrukcji i audytu

- Liście słowników PRZED wyniosły `pl 35200 / en 33067`, nie `35204 / 33071`.
- `reachability` PRZED i PO zgłasza jeden zastany plik `src/components/Initiatives/__tests__/initiativeKartaRealnyRekord.test.ts`, nie trzy.
- Skan R4 potwierdził 58 wystąpień, a R5 136.
- `canvas.versionHistory.*` jest kompletne i nie zostało dotknięte.
- Audytowe „~40” zostało zastąpione mechanicznym mianownikiem 250.
- `grep -c "': '"` zwraca 20 przez komentarze; ręczna liczba wpisów obiektu `actionLabels` to 14.

## R3 — nowe klucze

Dodano 11 kluczy `canvas.aiMenu.quickAction.*` i 2 klucze `canvas.aiMenu.tone.*`. PL skopiowano 1:1 z istniejących `labelPl`, EN z `labelEn`. Nie zmieniono renderu, promptów ani kolejności.

Test `day372-canvasAiMenu.i18n.test.tsx`:

- `resolves all 13 labels without the English fallback` — PASS;
- `renders Polish quick actions and tone labels` — PASS.

Dowód zachowania: po otwarciu „Akcje” render zawiera `Rozwiń` i nie zawiera `Final polish`; po otwarciu „Ton” zawiera `Formalny` i nie zawiera `Simpler`. Resolver pracuje z `fallbackLng:false`.

Dowód mutacyjny RED dla R3: brak 13 kluczy na markerze zwracał klucz/angielski fallback, co zapisano w `skan-przed.txt`. GREEN: oba nazwane przypadki powyżej. Pełnej osobnej mutacji przez czasowe usunięcie wpisów PO nie wykonano — dlatego nie używam statusu VERIFIED dla całego dyżuru.

## R2, R4, R5 — jawna lista braków

- R2: wszystkie 42 pozycje wymienione w `skan-przed.txt` pozostają.
- R4: pełne 58 pozycji pozostaje w `header-historia-lista.txt`, plus twardy `window.confirm` w `ChatHistorySidebar.tsx:641`.
- R5: pełne 136 pozycji pozostaje w `messagerenderer-karty-lista.txt`.

Pierwsza próba zbiorczego patcha R2 została odrzucona przez walidację kontekstu w całości; żaden fragment nie wszedł do worktree. Nie improwizowano propagacji `TFunction` ani dużych komponentów.

## Bezpieczniki PRZED/PO

- słowniki PRZED: `pl 35200 / en 33067`; PO: `pl 35213 / en 33080` — dokładnie +13/+13;
- `focus=0`, `list=0`, `artefakt=0` w pomiarze PRZED; końcowe wyniki powtórzono przed commitem R6;
- `reach=1` PRZED i PO, z tym samym jednym cudzym plikiem; własny test dopisano ręcznie do `testOnlyFiles`;
- eksperymentalne rozszerzenie `check-etykiety-dwujezyczne` zmierzyło `455 plików / 786 ternary / 5 nieuzasadnionych`, wobec `162/350/4` PRZED. Nowy wykryty dług: `src/components/AIChat/TransformationCasesPanel.tsx:114` — `Rebaseline`. Ponieważ licencja nie pozwala podnieść `maxUnjustifiedIdentical`, a komponent jest poza licencją, rozszerzenie wycofano zamiast łamać hook.

## Pułapki dowodowe

Testy są czysto jednostkowe (`RUN_DB_TESTS=0 MOCK_DB=true`). Dotyczy pułapka `t(klucz, fallback)`: wyłączona przez realną instancję i18next, realny JSON PL i `fallbackLng:false`. Nie użyto mocka `react-i18next`; użyto `vi.unmock`. Pułapki DB/auth nie leżą na ścieżce tych testów.

Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Nie uruchomiłem `server/src/index.ts` ani żadnego drenażu outboxu. Żaden e-mail ani zaproszenie kalendarzowe nie zostało wysłane. Bazy nie uruchamiano, więc nie składam nieprawdziwego twierdzenia o zapytaniu do tabeli `settings`.

## Co nadal wymaga osobnego zlecenia

- `src/components/AIChat/TransformationCasesPanel.tsx:114` — identyczne PL/EN `Rebaseline`, ujawnione dopiero po rozszerzeniu strażnika; plik poza licencją dyżuru.
- `aiChat.homeCards.finance.m16.monteCarlo.addDriver` i `aiChat.homeCards.finance.m16.sensitivity.addDriver` mają PL `+ driver`, ale skan rodziny nie znalazł konsumenta; wymagany dowód osiągalności/renderu przed zmianą.
- Wszystkie 237 nierozwiązanych pozycji R2/R4/R5 wymagają wznowienia tej gałęzi albo osobnego zlecenia; pełne `plik:linia` są w evidence.

## Pytania do właściciela

Czy panel „workflow ledger” (`WorkCanvasDocumentPanel.tsx:4692-4906`, `VITE_DEV_DIAGNOSTICS` domyślnie OFF) ma być kiedykolwiek tłumaczony, czy ma pozostać wyłącznie angielską diagnostyką deweloperską — tak/nie?

## Twierdzenia niezweryfikowane

- Nie zweryfikowano renderem produkcyjnym `/chat`, przeglądarką ani urządzeniem.
- Nie wykonano R2, R4 ani R5.
- Nie wykonano pełnych dowodów mutacyjnych RED→GREEN dla każdej pozycji R2–R5.
- Nie potwierdzono, że dwa klucze `+ driver` są osiągalne w bieżącym UI.
- Nie twierdzę, że gałąź jest gotowa do scalenia bez dokończenia 237 pozycji i niezależnego odbioru.

## R0 — deklaracja

Test broni zachowania prawdziwego resolvera i renderu, nie tekstu źródła. Nowe wartości PL nie są kopiami EN. Nie rozszerzono napraw poza licencjonowaną rodzinę.
