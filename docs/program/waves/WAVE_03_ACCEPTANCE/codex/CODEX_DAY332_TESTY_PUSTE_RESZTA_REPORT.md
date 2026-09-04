# CODEX — dyżur 332 — testy puste, reszta

Data: 2026-09-04

Marker: `1c3d3da844ae03c87985a8f5dc74846a073c0220`

Gałąź: `codex/day332-testy-puste-reszta-20260904`

Stan: **CZĘŚCIOWO — R0 i R1 kompletne, R2 częściowe, R3 kompletne jako pomiar, R4 kompletne**

## Wynik

- R0: potwierdzono stan po scaleniu dyżuru 318.
- R1: sklasyfikowano własnym pomiarem 64/64 pliki: 7 `REALNY DEFEKT`, 57 `UZASADNIONY WZORZEC`.
- R2: naprawiono potwierdzony `MessageBubble.test.tsx`; dowód mutacyjny PASS → FAIL → PASS. Pięć innych defektów pozostaje nienaprawionych, a `InboxTriage` jest poza zakresem zapisu B.4.3.
- R3: ponownie zmierzono 8/8 kandydatów; wszystkie pozostają `NOT_PROVEN` z własną przyczyną dowodową.
- R4: skaner uruchomiono na końcu; rejestr generowany został odświeżony.

## Wejście — wynik dosłowny

```text
1c3d3da844 Merge codex/day314 (odbiór adwersaryjny: SCALIC; POKAZAC WLASCICIELOWI — ale parami odbiorcy, nie z raportu)
MARKER OK
1c3d3da844ae03c87985a8f5dc74846a073c0220
```

Tip `github-backup/grafika/m03-20260902` uciekł o dziewięć commitów; zgodnie z DEC-2026-08-26-95 praca pozostała dokładnie na markerze. Diff tipa obejmował wyłącznie materiały instrukcji 324–333 i `_instr_src`.

## R0 — pomiary wejścia

| Kontrola | Wynik własny |
|---|---|
| Dysk | 66 GiB wolne po utworzeniu worktree, powyżej progu 5 GiB |
| Porty/kontener | 6358 wolny, 5498 wolny, `cx-day332` = 0 |
| Historia skanera | `6539f82a9a feat(testy-puste): detekcja podmiotu...` obecny |
| `api-extensions.test.ts` | nie istnieje |
| Baseline | `candidates: 17` |
| Skan przed | files 5414, blocks 42513, candidates 17, skipped 0, gatedFiles 37, selfDefinedSubjects 190, bez importu 64 |
| Rejestr ręczny | 8 wystąpień `NOT_PROVEN` w tabeli 318 |
| i18n | PL 44144 linii, EN 41539 linii |
| Migracje | pierwszy przebieg zakończony sukcesem; drugi `Applying migrations: 0` |

## R1 — triage

Pełna tabela 64 plików jest w `REJESTR_TESTY_PUSTE_DOWODY_20260904.md`. Wykryte realne defekty:

| Plik | Realny komponent | Stan |
|---|---|---|
| `tests/components/AIChat/ArtifactsPanel.test.tsx` | `src/components/AIChat/Artifacts/ArtifactsPanel.tsx` | nienaprawiony |
| `tests/components/AIChat/FocusModeSelector.test.tsx` | `src/components/AIChat/Input/FocusModeSelector.tsx` | nienaprawiony |
| `tests/components/AIChat/MessageBubble.test.tsx` | `src/components/AIChat/Messages/MessageBubble.tsx` | **naprawiony** |
| `tests/components/AIChat/ThinkingBlock.test.tsx` | `src/components/AIChat/Messages/ThinkingBlock.tsx` | nienaprawiony |
| `tests/components/Economics/FinancialMetricsPanel.test.tsx` | `src/components/Economics/FinancialMetricsPanel.tsx` | nienaprawiony |
| `tests/components/MyWork/InboxTriage.test.tsx` | `src/components/MyWork/Inbox/InboxTriage.tsx` | tylko brief; B.4.3 wyłącza zapis MyWork |
| `tests/components/Onboarding/OnboardingWizard.test.tsx` | `src/views/OnboardingWizard.tsx` | nienaprawiony |

## R2 — MessageBubble

Zielony kierunek:

```text
MessageBubble Component renders component — passed
MessageBubble Component renders without crashing — passed
```

Mutacja produktu: chwilowo usunięto wyświetlenie `message.content`.

```text
MessageBubble Component renders component — failed
MessageBubble Component renders without crashing — passed
mutation_exit=1
```

Plik produktu przywrócono przez `cp`; `git diff -- src/components/AIChat/Messages/MessageBubble.tsx` był pusty. Commit naprawy: `5868cd630a`.

## R3 — osiem kandydatów

| ID | Plik:linia | Klasa | Dowód własny |
|---|---|---|---|
| E0001 | `MeetingHub.smoke.test.tsx:120` | `NOT_PROVEN` | 11 PASS, 2 FAIL; badany baseline pada przez `querySelector` na `null` |
| E0003 | `table-platform.routes.test.ts:427` | `NOT_PROVEN` | właściwy cwd `server`; 25/25 FAIL przez `argument handler must be a function` |
| E0008 | `CandidatesTable.t28.test.tsx:49` | `NOT_PROVEN` | 0 testów; wskazany komponent produktu w ogóle nie istnieje, próba korekty ścieżki cofnięta |
| E0009 | `ollama.integration.test.ts:22` | `NOT_PROVEN` | SKIP przy `OLLAMA_TEST=false`; uruchomienie żywego LLM łamie Z15 |
| E0010 | `ollama.integration.test.ts:82` | `NOT_PROVEN` | jak E0009; brak funkcji produktu do mutacji |
| E0011 | `ollama.integration.test.ts:102` | `NOT_PROVEN` | jak E0009; brak funkcji produktu do mutacji |
| E0013 | `pmo-project-members.integration.test.ts:115` | `NOT_PROVEN` | importuje `server/src/index.js`; nie uruchomiono z powodu Z30 |
| E0014 | `workbook.p23ext.test.ts:374` | `NOT_PROVEN` | 14/14 PASS bez runtime, endpointy wracają przed asercją; brak celu mutacji produktu |

## Zasięg testów po pełnych nazwach

Pakiet siedmiu wykrytych defektów miał przed i po 17 pełnych nazw. `nazwy.diff` ma 0 bajtów: nic nie dodano i nic nie zniknęło. Oba przebiegi miały `success: true`.

Pułapki Z33: pakiet jest czysto komponentowy (`RUN_DB_TESTS=0 MOCK_DB=true`), nie przechodzi przez V8/auth/Postgres; pułapka (e) jest dokładnie badanym obiektem i została wyłączona dla `MessageBubble` przez import realnego komponentu oraz dowód mutacyjny. Pakiety R3 nie są dowodem realnej egzekucji HTTP/PG; raportuje się je wyłącznie jako baseline/blokadę.

## Skan końcowy

`files=5414`, `blocks=42513`, `candidates=17`, `skipped=0`, `gatedFiles=37`, `selfDefinedSubjects=189`, `selfDefinedSubjectsWithoutProductImports=63`. Spadek 190→189 i 64→63 pochodzi wyłącznie z usunięcia lokalnej atrapy `MessageBubble`; baseline candidates nie został zmieniony.

## Zero wysyłki

Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Baza tego dyżuru nie zawiera wierszy konfiguracji SMTP. Nie uruchomiłem `server/src/index.ts` ani żadnego drenażu outboxu. Żaden e-mail ani zaproszenie kalendarzowe nie zostało wysłane.

## Korekty wobec instrukcji

1. §0.1 komenda 4 zakłada, że `selfDefinedSubjectsWithoutProductImports` jest listą i woła `len(...)`; skaner zwraca liczbę `64`. Komenda dała `TypeError`. R1 nakazuje filtrować `selfDefinedSubjects` po `hasProductImport === false`; ta bezpieczna metoda dała dokładnie 64 rekordy i została użyta.
2. B.2 R1 wymaga `evidence/day332/triage.md`, lecz Z13 pozwala na dokładnie jeden nowy dokument raportowy i dopisek do istniejącego rejestru. Zastosowano bezpieczniejszy Z13: pełną tabelę zapisano w rejestrze ręcznym, bez nowego pliku evidence.
3. Dokument odwołuje się do struktury `§R.2`, ale sekcja `R.2` nie występuje w wydanej instrukcji. Raport zawiera wszystkie pola jawnie wymagane przez R4.
4. Sugestia R3, aby naprawić import `CandidatesTable`, jest niewykonalna: nie istnieje ani wskazany plik, ani realny odpowiednik znaleziony przez `rg`. Próba zmiany wyłącznie liczby `../` nadal dała 0 testów i została cofnięta.

## Artefakty i SHA-256

Katalog: `/private/tmp/cx-day332-testy-puste-reszta-artefakty`.

- `przed.json`: `76a9deb66bd0d644833d7cb0d082f5cdb2397741aa56bbd6fcbe74ed085ca328`
- `po.json`: `96ba8129d9c03fdae3ff3d50b329d4de3c7e6cce5b3b661df082ec7405d31ee8`
- `r2-przed.json`: `31b35220636455300e8628e2b87e6235c072d50a96c896da140645f0b9022cee`
- `r2-po.json`: `50179a5047f21fef58b2acadd71c0d9a0d151dd141504846f54d1879f0a5d7dc`
- `messagebubble-green.json`: `2db8d1b7b8ebcfc2ad145e6e9b95fb26681f79d6bae67ccba41ee2e359e71fd1`
- `messagebubble-mutacja.json`: `096108bc2e85d612be78e614604333e26ccc48cf6b0cf5aed232417abb3da38e`
- `przed-nazwy.txt` i `po-nazwy.txt`: `272285c774c1c808f3e954c64d979310ce3b65dd08e731af5d3f7057979ecb1f`
- `nazwy.diff`: `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`
- `migrate-first.log`: `85bbe79d5694d181d5e19184147c677a0185e8a4e60bd292fa482c671fc3e504`
- `migrate-second.log`: `6c5e25674cb3182ce578e8c44055e66b4ef64ee039754993026b511637b9b04f`

## TWIERDZENIA NIEZWERYFIKOWANE

- Nie wykonano adaptacji i mutacji pięciu pozostałych naprawialnych atrap z R1.
- `InboxTriage` nie został zmieniony z powodu jawnego wyłączenia B.4.3.
- Żaden z ośmiu kandydatów R3 nie uzyskał dwukierunkowego dowodu mutacyjnego; ich klasy pozostają `NOT_PROVEN`.
- Nie uruchomiono pełnego runtime, realnego HTTP przez `ApiGateway`, produkcji, stagingu ani Railway; ten dyżur nie dowodzi ścieżki wdrożeniowej.
- Nie wykonano CI ani testów urządzeniowych.
