# CODEX DAY220 — Audyty: rejestr odbioru

Data pomiaru: 2026-09-01  
Gałąź: `codex/day220-audyty-rejestr-20260901`  
Marker: `9fb7942a01`  
Commit produktu i testów: `64f106187f`

## Werdykt

`AUD-OR-20260829-001`, `-002` i `-005`: `RESOLVED` w zakresie dyżuru. Każda pozycja ma zielony test i osobną mutację RED. `-003` oraz `-004` pozostały nietknięte.

## Wejście i rozjazd bazy

Wynik markera, dosłownie:

```text
MARKER OK
```

Wynik sanity, dosłownie:

```text
9fb7942a0117aaf4001836f00bf8bbdc4e717669
```

`git status --short | head -3` nie wypisał nic. Tip `github-backup/codex/m03-admin-20260824` był sześć commitów przed markerem; zgodnie z `DEC-2026-08-26-95` praca wystartowała dokładnie z markera. Lista plików rozjazdu zawierała wyłącznie dokumenty/instrukcje późniejszych dyżurów i pomiary programu.

Porty `6163`, `5114`, `5115` były wolne. Wolne miejsce: `11GiB` (>5GiB). Kontener: `cx-day220-pg`, obraz `pgvector/pgvector:pg16`, port `127.0.0.1:6163`. Pierwszy łańcuch zastosował 876 migracji; replay: `Applying migrations: 0`, `Postgres migrations complete`.

## Pomiary wejściowe W1–W8

- W1: pięć pozycji `001..005`; zakres tego dyżuru: `001/002/005`.
- W2: trzy stałe treści, dwie nazwy organizacji oraz tytuł/odbiorca/poufność raportu były angielskie.
- W3: `userNameById` działał już w Sesjach, Ustaleniach i Wynikach; Raporty i Inicjatywy nie renderują żadnego pola osoby, więc nie potrzebują resolvera.
- W4: siedem trafień, nie sześć. Sześć dotyczyło wskazanych kolumn; dodatkowe `AuditProcessesTab.tsx:559` jest pomocniczą etykietą w przeglądarce kryteriów i pozostało poza zakresem.
- W5: backend zwraca liczby. Realny HTTP fixture zwrócił `criteriaTotal=1`, `criteriaConcluded=1`; komponent renderuje `1/1`. Defekt „goły `/`” jest nieaktualny.
- W6: kod ma sześć zakładek. DAY109 jawnie pominął `Wyniki`, aby zachować mianownik pięciu; rozbieżność pozostaje dowodem brakującym `-003`, bez zmiany w tym dyżurze.
- W7: i18n to `AUD-OR-20260829-001` w obu rejestrach.
- W8: zero importów produkcyjnych seeda; znaleziono wyłącznie użycie proceduralne/dokumentacyjne.

## R1 — i18n seeda (`AUD-OR-20260829-001`)

Zmieniono wyłącznie enumerowane pola fixture: `PACK_TITLE`, `REQUIREMENT`, `EVIDENCE_TEXT`, dwie nazwy organizacji oraz tytuł, odbiorcę i poufność raportu. `language='en'` pozostało bez zmiany jako kod języka. Struktura INSERT, `IDS.*`, SoD i procedury lifecycle seeda nie zostały zmienione.

Dowód GREEN (`--retry=0`): `day220-audyty-rejestr.r1.test.tsx` — realny Postgres, realny `ApiGateway`, podpisany JWT, `verifyToken`, `GET /api/audits/programs` = `200`, `GET /api/audits/reports` = `200`, SQL readback i brak wskazanych angielskich literalów.

Mutacja: `PACK_TITLE` przywrócony do `Transformation Audit Pack — internal operations`. Ten sam przypadek testowy RED: `1 failed`; artefakt `/private/tmp/cx-day220-audyty-rejestr-artefakty/mutacja-r1-red.json`. Kopia została przywrócona przez `cp`; `cmp` zwrócił `R1_RESTORED`.

## R2 — surowe identyfikatory (`AUD-OR-20260829-002` i część `-005`)

Pomiar wykazał, że karta Sesji była już częściowo naprawiona przed dyżurem: resolver `userNameById` pokazuje nazwę, a brak mapowania daje `—`, nie surowy identyfikator. Raporty i Inicjatywy nie mają pola osoby. Nie dodano fikcyjnego resolvera ani zmiany poza licencją.

Dowód GREEN: `day220-audyty-rejestr.r2.test.tsx` renderuje fixture ID `w3-aud-lead-user-v1`, widzi `Alicja Audytorka`, a `queryByText(/^w3-aud-.*-v1$/)` zwraca `null`.

Mutacja: `userNameById={new Map()}`. Ten sam przypadek RED: `1 failed`; artefakt `/private/tmp/cx-day220-audyty-rejestr-artefakty/mutacja-r2-red.json`. Kopia przywrócona przez `cp`; `R2_RESTORED`.

## R3 — pełne wartości (`AUD-OR-20260829-005`)

Pełna wartość jest dostępna przez `title=` dla: tytułu pakietu, nazwy audytora, odbiorcy raportu, poufności, treści ustalenia i rozwiązanej nazwy kryterium. Zwarty layout tabel pozostał bez zmian. Realny postęp fixture to `1/1`, więc nie wprowadzono pozornej naprawy `/`.

Dowód GREEN: trzy przypadki w `day220-audyty-rejestr.r3.test.tsx` używają wartości >20/>40 znaków i `getByTitle` na Sesjach, Raportach i Ustaleniach.

Mutacja: usunięto `title={row.statement}`. Dokładnie przypadek Ustaleń RED, dwa pozostałe PASS; artefakt `/private/tmp/cx-day220-audyty-rejestr-artefakty/mutacja-r3-red.json`. Kopia przywrócona przez `cp`; `R3_RESTORED`.

## Zasięg testów po pełnych nazwach

Przed: 139 unikalnych pełnych nazw, `139/139 PASS`. Po: 146 pełnych nazw (139 zastanych + 7 Day220), zero nazw znikniętych. Pliki:

- `/private/tmp/cx-day220-audyty-rejestr-artefakty/przed-nazwy.txt`
- `/private/tmp/cx-day220-audyty-rejestr-artefakty/po-nazwy.txt`
- `/private/tmp/cx-day220-audyty-rejestr-artefakty/po.json`

Nowe pełne nazwy obejmują 3×R1, 1×R2 i 3×R3. Wszystkie komendy dowodowe miały `--retry=0` oraz komplet env w tej samej linii. Pułapki Z33: `ENABLE_V8_GLOBAL=true`, `ENABLE_TEST_AUTH_BYPASS=false`, `RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce`, `DB_TYPE=postgres`, `MOCK_DB=false`, `RUN_DB_TESTS=1`; test R1 asercyjnie potwierdza `DB_TYPE=postgres` i nazwę dedykowanej bazy.

## R4 — zrzuty dev-render przed właścicielem

Dane na zrzutach pochodzą z realistycznych mock-props w dev-render, nie z realnego API. Są dowodem wizualnym, nie dowodem osiągalności produkcyjnej. Osiągalność API dowodzi osobno R1.

| Ekran | Motyw | SHA-256 | mean_luma |
|---|---|---|---:|
| Sesje | light | `af6a5529b26579e27c091c7dc603ba0682de23a256406610e457daaa6a67d4a3` | 247.512 |
| Sesje | dark | `39fc4f5d58e28f86bbe806965eee90d3a8c8b4766d13e189057f8ed6a5ddb48e` | 21.043 |
| Raporty | light | `58e9d0ce6ea2e3a63a306da2817239a0be209784e4fede60ecfd270135269777` | 249.087 |
| Raporty | dark | `4e854024f64ad65ae44c2c6ba7ce7f621f3ed87c84fd9d3087e233dc94e74a09` | 22.018 |
| Ustalenia | light | `501fd8a4dd5b66d74ccfa32771ffb74eb039a96196401741bd8e51ef83fe3f58` | 246.892 |
| Ustalenia | dark | `dc0f418bcd1c924c66df233b45b478721d3cacac32a077d8ef1acfea330db4e7` | 23.016 |

Różnice light–dark: Sesje `226.469`, Raporty `227.069`, Ustalenia `223.876` — wszystkie >150.

## Korekty wobec instrukcji

1. Instrukcja nazywa enumerację raz „siedmioma literalami”, ale wylicza 3 stałe + 2 nazwy organizacji + 3 pola raportu = 8 wartości. Bezpieczna interpretacja: zmieniono wszystkie imiennie wyliczone wartości i nic więcej.
2. W4 znalazł siedem trafień; siódme nie jest jedną z sześciu kolumn zakresu.
3. Literalny grep W6 nie znalazł frazy bez polskich znaków. `rg` znalazł DAY109: „pięć realnych powierzchni” oraz wyjaśnienie, że `Wyniki` pominięto.
4. Odpowiedź HTTP używa pól `criteriaTotal/criteriaConcluded`, nie nazw `applicableCriteria/concludedCriteria` z modelu frontowego. Wartości wyniosły `1/1`.

## TWIERDZENIA NIEZWERYFIKOWANE

- Nie zweryfikowano sześciu pełnych/pustych powierzchni; to pozostaje `AUD-OR-20260829-003`.
- Nie rozstrzygano decyzji warsztatowej D-5; to pozostaje `AUD-OR-20260829-004` / dyżur 221.
- Zrzuty nie dowodzą produkcyjnego renderu na realnym API; są mock-props. Realny HTTP zweryfikował dane programów i raportów, nie automatyczny screenshot zalogowanego produktu.
- „Karta programu” `-002` została zmierzona jako wiersz Sesji i istniejący resolver; nie znaleziono osobnego komponentu karty z żywym surowym ID.
- Naprawiono sześć wskazanych miejsc dostępu do pełnych wartości. Siódme trafienie W4 (`:559`) świadomie pozostawiono jako pomocniczą etykietę poza zakresem.

## Z30 — brak wysyłki

Przed zapisem: `BRAK ZMIENNYCH POCZTY`; zapytanie `settings WHERE key LIKE 'smtp%'` zwróciło 0 wierszy; `Gateway.ts` nie zawiera uruchomienia drenaży.

Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Baza tego dyżuru nie zawiera wierszy konfiguracji SMTP. Nie uruchomiłem `server/src/index.ts` ani żadnego drenażu outboxu. Żaden e-mail ani zaproszenie kalendarzowe nie zostało wysłane.

## Pliki i kopia zapasowa

Pierwszy commit `64f106187f` został natychmiast wypchnięty na `github-backup/codex/day220-audyty-rejestr-20260901`. Nie wykonano pushu na `origin`, rebase, stash, reset ani połączenia z Railway/demo/staging/produkcją.
