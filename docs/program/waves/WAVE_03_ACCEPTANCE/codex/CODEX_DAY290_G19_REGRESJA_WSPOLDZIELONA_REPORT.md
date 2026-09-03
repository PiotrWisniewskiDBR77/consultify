# CODEX — dyżur 290 — G19 regresja współdzielona

Data pomiaru: `2026-09-03`  
Marker produktu: `67d235cfa0`  
Gałąź dowodowa: `codex/day290-g19-regresja-wspoldzielona-20260903`  
Werdykt: **`NOT_PROVEN / OWNER_RETEST_PENDING`**. Nie ma podstaw do wpisania `TECHNICAL_REGRESSION_PASS`: blok 3 ma 7 czerwonych przypadków bez pary bazowej, a pomiar `AIConsultantPanel` jest `PARTIAL` mimo 8 wykonanych kadrów i 0 naruszeń axe.

## Wejście i marker — wynik dosłowny

```text
67d235cfa0 Merge agent/p0p1-rozliczenie-20260903: rozliczenie 121 pozycji P0/P1 (33 naprawione, 43 otwarte, 8 nieweryfikowalne, 1 zdezaktualizowana, 36 z rejestrow poza licznikiem)
MARKER OK
67d235cfa079d663ea87ddb46a167c0aa9d7ecab
```

`git status --short | head -3` po utworzeniu worktree nie zwrócił żadnej linii.

Tip `github-backup/grafika/m03-20260902` uciekł do przodu. Zgodnie z `DEC-2026-08-26-95` pomiar pozostał na markerze. Lista commitów i zmienionych ścieżek została pobrana komendami z §0.1; tip zawiera m.in. późniejszy pomiar G06 i naprawę kontrastu `canvas-new-doc`, więc scalenie należy do nadzorcy.

## Korekty wobec instrukcji

1. Walidacja wejścia dała `24` pliki pod `src/components/{standard,shared,ui}`, nie 23. Różnica jest wyjaśniona: 23 komponenty produktu + `src/components/shared/ModuleHub/__tests__/FilterableTable.cellWordBreak.test.tsx`.
2. Walidacja dała `21` plików pod `server/src/{middleware,routes}`, nie „rzędu 15”: 3 middleware + 12 tras produktu + 6 testów tras.
3. `git grep -ln 'initiativesExecutionRuntime' -- tests server/src/**/__tests__ | wc -l` dał `20`, nie `0`. To trafienia po symbolu/tekście, nie plik testowy nazwany jak trasa. Istniał m.in. test jednostkowy na gołym routerze, który nie spełnia Z22; dyżur dodał kontrakt przez realny `ApiGateway` i PostgreSQL.
4. Wszystkie sześć plików bloku 3 jest nieobecnych na bazie `316bce9dd9`. Siedmiu czerwieni markera nie wolno więc oznaczyć `ZASTANA` bez pary. Stan: `NOT_PROVEN`, nie naprawiono produktu.
5. Instrukcja oczekiwała dla obcej organizacji `403/404`. Jedenaście sond list/kontekstu zwróciło `200`, ponieważ JWT obcego OWNER-a kieruje je do jego własnej organizacji. Treść każdej odpowiedzi została sprawdzona na identyfikator org, user i e-mail właściciela: 12/12 bez wycieku. Szczegóły: `evidence/g19/przelot-http.md`.
6. Pierwsza próba Vite uruchomiona jako proces tła nie przeżyła powłoki; 8 × `ERR_CONNECTION_REFUSED` uznano za błąd komendy i nadpisano powtórką na trwałej sesji `5259`. Pierwsza rozgrzewka PL/1440 przekroczyła 60 s; po skompilowaniu powtórka wykonała oba kadry.
7. Kanoniczne narzędzie wykonało 8/8 PNG i axe znalazł 0 naruszeń, ale pętla `--rozwin-sekcje=1` raportowała nadal zwinięte elementy, a ekran nie ma wiersza tabeli dla `--klik-po-rozwinieciu=1`. Dlatego wynik R5 to `PARTIAL`, nie `PASS`.

## R1 — mianownik

Pełna lista: `evidence/g19/mianownik.md`.

- 49 plików w pełnym zbiorze dla najstarszego SHA: 28 UI/lokalizacje/CSS/config + 21 serwer (w tym testy).
- 23 zmienione komponenty produktu UI, 1 zmieniony test UI.
- 3 middleware produktu.
- 12 tras produktu, 6 testów tras.
- Worktree pary bazowej: `/private/tmp/cx-day290-baza`, dokładny SHA `316bce9dd9aeff1bde71e368968b851467e93411`.
- Strażnik `initiativeRecordCanon`: 6/6 PASS na starcie i 6/6 PASS na końcu (`evidence/g19/initiativeRecordCanon-{start,end}.json`).

## R2 — blok 1, podgląd i tabela

| Para | Pliki uruchomione | PASS | FAIL | Werdykt |
| --- | ---: | ---: | ---: | --- |
| baza `316bce9dd9` | 17 | 123 | 4 | 4 czerwienie bazowe |
| marker `67d235cfa0` | 18 | 127 | 4 | te same 4 czerwienie = `ZASTANA` |

Czerwienie `ZASTANA` z pełnymi nazwami:

- `filterableTable.r04-2a.test.tsx` — `R04-2A · interakcja wiersza Shift+F10 na wierszu otwiera ten sam kontekst co kebab`;
- `standardPreview.r03.test.tsx` — `R03-1 · Relations jest blokiem obowiązkowym renderuje empty state, gdy ekran NIE poda propa relations`;
- `standardPreview.r03.test.tsx` — `R03-1 · Relations jest blokiem obowiązkowym respektuje własną etykietę pustego stanu`;
- `tablePreviewGeometry.r03-2.test.tsx` — `R03-2 · zamykanie i focus return gdy element otwierający zniknął, focus wraca na kontener — skróty żyją dalej`.

Pułapki Z33: pakiet nie dowodzi DB ani HTTP; uruchomiono go z `RUN_DB_TESTS=0 MOCK_DB=true`. Nie używa `ENABLE_V8_GLOBAL`, `resultsInternalBetaVisibility` ani testowego bypassu auth jako podstawy werdyktu. Klasyfikacja czerwieni pochodzi wyłącznie z pary identycznych nazw baza/marker. Logi: `evidence/g19/blok1-{baza,marker}.{json,log}`.

## R3 — blok 2 i `mfaEnrollmentToken`

- baza, 6 plików: 218/218 PASS;
- marker, 6 plików + nowy test MFA: 225/225 PASS;
- nowy test MFA: 7/7 PASS;
- mutacja `if (!claims)` → wyłączona walidacja: 4 PASS / 3 FAIL; po przywróceniu 7/7 PASS; diff produktu pusty.

Pułapki Z33 wyłączone jawnie w tej samej linii: `ENABLE_TEST_AUTH_BYPASS=false`, `ENABLE_V8_GLOBAL=true`, `RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce`, `RUN_DB_TESTS=1`, `MOCK_DB=false`, `DB_TYPE=postgres`, lokalny `DATABASE_URL`, `--retry=0`. Pierwszy test nowego pakietu asertuje `DB_TYPE=postgres`. Logi: `evidence/g19/blok2-*` i `evidence/g19/mfa-mutation-*`.

## R4 — realny PostgreSQL, dropdown i HTTP

Migracje wykonano dwa razy na `pgvector/pgvector:pg16`, `127.0.0.1:6294/cx290`: pierwszy pełny przebieg zakończył się `Postgres migrations complete`, drugi podał `Applying migrations: 0` i zakończył się poprawnie.

Sześć zastanych plików bloku 3 na markerze: **11/18 PASS, 7/18 FAIL**:

- `day274-ocena-dociera-do-listy.pg.test.ts`: obcy tenant — oczekiwano 404, otrzymano 403;
- `day276-deck-autosave-persist.pg.test.ts`: autosave — oczekiwano 200, otrzymano 403; stale version — oczekiwano 409, otrzymano 403;
- `day276-workbook-cell-persist.pg.test.ts`: zapis ownera — oczekiwano 200, otrzymano 500; foreign tenant — oczekiwano 403/404, otrzymano 500;
- `day277-decyzje-zapis.pg.test.ts`: zapis ownera — oczekiwano 200, otrzymano 400 (`escalation` undefined); foreign tenant — oczekiwano 404, otrzymano 400.

Klasa: `NOT_PROVEN` — pliki nie istnieją na bazie `316bce9dd9`, więc nie ma pary wymaganej do `ZASTANA/NOWA`. Surowy JSON: `evidence/g19/blok3-marker.json`.

Nowy `initiativesExecutionRuntime.dropdown.pg.test.ts` przeszedł 2/2 przez realny `ApiGateway`, podpisany JWT, realny wiersz `ie_aggregate_state` i PostgreSQL. Dowodzi, że `GET /api/initiatives/runtime-v1/execution-cases` zwraca `initiativeTitle`, a nie tylko surowy `executionCaseId`. Mutacja usuwająca `initiativeTitle`: 1/2 FAIL; po przywróceniu diff produktu pusty.

Przelot HTTP: 12/12 plików tras osiągniętych na listenerze `127.0.0.1:5258`, dwa podpisane JWT, dwa tenanty, 0/12 odpowiedzi obcej organizacji zawierających identyfikatory właściciela. Jedenaście par kodów `200/200`, jedna `404/404`; pełna tabela i ograniczenie semantyki kodów: `evidence/g19/przelot-http.md`.

Pułapki Z33: realny `ApiGateway`, nie goły router; `RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres`; log potwierdza `DB_IDENTITY ... 127.0.0.1:6294/cx290`; `ENABLE_V8_GLOBAL=true`; `ENABLE_TEST_AUTH_BYPASS=false`; `RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce`; `--retry=0`. Żądania HTTP używały realnego `fetch`, nie mocka z `tests/setup.ts` (config serwera, `setupFiles: []`).

## Z30 — brak wysyłki

Przed pierwszym zapisem: `BRAK ZMIENNYCH POCZTY`; tabela `settings` zwróciła 0 wierszy `smtp%`; grep drenaży w `Gateway.ts` zwrócił 0 trafień. Dowód: `evidence/g19/z30-przed-zapisem.log`.

**Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Baza tego dyżuru nie zawiera wierszy konfiguracji SMTP. Nie uruchomiłem `server/src/index.ts` ani żadnego drenażu outboxu. Żaden e-mail ani zaproszenie kalendarzowe nie zostało wysłane.**

## R5 — `AIConsultantPanel`

Ekran `teresa-chipy-panel-artefaktu` dodano do modułu `13_CHAT` w `scripts/dev/g06-macierz-ekrany.json`; JSON parsuje się poprawnie. Produkcyjny caller komponentu nie został znaleziony: występuje jako realny import w dedykowanym ekranie harnessu, a dawne callery w Initiative/Interview są opisane jako usunięte. To ograniczenie osiągalności pozostaje jawne.

Wynik: 8/8 PNG, PL/EN × light/dark × 1440/1024, 0 naruszeń axe, wizualnie panel i rozmowa są obecne, dawne chipy sugestii nie występują. Stan narzędzia: `PARTIAL` z powodów opisanych w korekcie 7. Maszynowy agregat: `evidence/g19/aiconsultantpanel/wynik.json`. PNG leżą poza repo w `/private/tmp/cx-day290-g19-regresja-artefakty/aiconsultantpanel/`; pełne ścieżki i SHA-256: `evidence/g19/aiconsultantpanel/png-sha256.log`.

Pułapki Z33: użyto literalnie `--rozwin-sekcje=1 --klik-po-rozwinieciu=1 --osiad-po-rozwinieciu=1500 --a11y=1 --motywy=light,dark`; cztery osobne przebiegi dla PL/EN i 1440/1024. Ekran sam przechwytuje `/api/*`; nie jest dowodem serwera ani realnych danych.

## §0.4a — zasięg po pełnych nazwach

- PRZED: 367 unikalnych pełnych nazw;
- PO: 378 unikalnych pełnych nazw;
- dodano 11 nazw: 7 MFA, 2 dropdown PostgreSQL, 2 przelot HTTP;
- zniknięte nazwy: 0.

Artefakty poza repo i SHA-256:

```text
4747319b24b014fcfcd40de249994f5835f41766c1fde100c587f8ee0d7c93f5  przed-nazwy.txt
da46147f8c459b00376f0bf9c646969eb5625b9222694e606b6649e712b435e2  po-nazwy.txt
0e004c9aa67addff3d261ccc8bc36607b72f2af8acd639534a9f8e8d3866348e  nazwy.diff
```

## Otwarte pliki z nazwy

Wspólny dług bez własnego testu komponentu (macierz wizualna nie zastępuje testu):

`src/components/shared/ExecutiveModuleShell/TopBar.tsx`, `src/components/shared/NModeLayout/AIConsultantPanel.tsx`, `src/components/shared/NModeLayout/NModeLeftNav.tsx`, `src/components/shared/NModeSections/AttachmentsLinksCanvas.tsx`, `src/components/shared/NModeSections/CommentsCanvas.tsx`, `src/components/shared/PreviewPane/PreviewAIHintStrip.tsx`, `src/components/shared/PreviewPane/PreviewActivityStrip.tsx`, `src/components/shared/PreviewPane/PreviewDetailsSection.tsx`, `src/components/shared/PreviewPane/PreviewMetaCard.tsx`, `src/components/shared/PreviewPane/PreviewWhatsNextCard.tsx`, `src/components/shared/WizardModal/WizardStepper.tsx`, `src/components/shared/states/EmptyState.tsx`, `src/components/standard/EvidencePanelSection.tsx`, `src/components/ui/ResizableTable/ColumnResizer.tsx`, `src/components/ui/primitives/cells/ProgressCell.tsx`.

Otwarte przez czerwienie bloku 3: `server/src/routes/__tests__/day274-ocena-dociera-do-listy.pg.test.ts`, `server/src/routes/__tests__/day276-deck-autosave-persist.pg.test.ts`, `server/src/routes/__tests__/day276-workbook-cell-persist.pg.test.ts`, `server/src/routes/__tests__/day277-decyzje-zapis.pg.test.ts` oraz odpowiadające im ścieżki produktu wymagające osobnej diagnozy: `server/src/routes/assessmentWorkflowV2.routes.ts`, `server/src/routes/presentations.routes.ts`, `server/src/routes/workbook.routes.ts`, `server/src/routes/pmo/decisions.routes.ts`.

Otwarte semantycznie mimo technicznego pomiaru: `public/locales/en/translation.json`, `public/locales/pl/translation.json` (macierz nie dowodzi poprawności tłumaczeń) oraz warunkowo renderowane ścieżki wszystkich komponentów (osiągalność importu nie dowodzi renderu na danych właściciela).

## R6 — tabela 16 modułów i gotowe zdanie do G19

Dowód wizualny wspólny: G06 `fee24bddb0`, pomiar #3, plus R5 `AIConsultantPanel` `PARTIAL`. Dowód testowy wspólny: blok 1 `127/131` z 4 × `ZASTANA`; blok 2 `225/225`; blok 3 `11/18` z 7 × `NOT_PROVEN`; HTTP 12/12 osiągnięte, brak wykrytego wycieku identyfikatorów. `OTWARTE` oznacza pełną listę w sekcji wyżej.

| Moduł | SHA G18 | Mianownik UI/serwer/razem | Gotowe zdanie do wiersza G19 |
| --- | --- | ---: | --- |
| `01_ORGANIZATION` | `316bce9dd9` | 28/21/49 | `NOT_PROVEN / OWNER_RETEST_PENDING` — pomiar na `67d235cfa0`; G06 #3 + R5 PARTIAL; bloki 1/2/3 = 127/131, 225/225, 11/18; HTTP 12/12 bez wykrytego wycieku; OTWARTE: lista raportu; techniczna regresja nie zastępuje G16. |
| `02_INTERVIEW` | `08775ced65` | 21/9/30 | `NOT_PROVEN / OWNER_RETEST_PENDING` — pomiar na `67d235cfa0`; G06 #3 + R5 PARTIAL; bloki 1/2/3 = 127/131, 225/225, 11/18; HTTP 12/12 bez wykrytego wycieku; OTWARTE: lista raportu; techniczna regresja nie zastępuje G16. |
| `03_TOOLS` | `08775ced65` | 21/9/30 | `NOT_PROVEN / OWNER_RETEST_PENDING` — pomiar na `67d235cfa0`; G06 #3 + R5 PARTIAL; bloki 1/2/3 = 127/131, 225/225, 11/18; HTTP 12/12 bez wykrytego wycieku; OTWARTE: lista raportu; techniczna regresja nie zastępuje G16. |
| `04_ASSESSMENT` | `08775ced65` | 21/9/30 | `NOT_PROVEN / OWNER_RETEST_PENDING` — pomiar na `67d235cfa0`; G06 #3 + R5 PARTIAL; blok 3 obejmuje czerwony day274; OTWARTE: lista raportu; techniczna regresja nie zastępuje G16. |
| `05_INITIATIVES` | `08775ced65` | 21/9/30 | `NOT_PROVEN / OWNER_RETEST_PENDING` — dropdown 2/2 i mutacja RED→GREEN, ale blok 3 pozostaje 11/18; G06 #3 + R5 PARTIAL; OTWARTE: lista raportu; techniczna regresja nie zastępuje G16. |
| `06_EXECUTION` | `85dfe6c3e2` | 21/7/28 | `NOT_PROVEN / OWNER_RETEST_PENDING` — dropdown 2/2 przez ApiGateway/PG i mutacja RED→GREEN; R5 PARTIAL i blok 3 11/18 pozostają otwarte; techniczna regresja nie zastępuje G16. |
| `07_MY_WORK_AGENT` | `08775ced65` | 21/9/30 | `NOT_PROVEN / OWNER_RETEST_PENDING` — pomiar na `67d235cfa0`; G06 #3 + R5 PARTIAL; bloki 1/2/3 = 127/131, 225/225, 11/18; OTWARTE: lista raportu; techniczna regresja nie zastępuje G16. |
| `08_MEETINGS` | `316bce9dd9` | 28/21/49 | `NOT_PROVEN / OWNER_RETEST_PENDING` — pomiar na `67d235cfa0`; HTTP objął meeting, auth i middleware, ale blok 3 11/18 i R5 PARTIAL blokują wariant 1; OTWARTE: lista raportu; techniczna regresja nie zastępuje G16. |
| `09_RESULTS` | `4d402fcfc8` | 21/7/28 | `NOT_PROVEN / OWNER_RETEST_PENDING` — pomiar na `67d235cfa0`; G06 #3 + R5 PARTIAL; bloki 1/2/3 = 127/131, 225/225, 11/18; OTWARTE: lista raportu; techniczna regresja nie zastępuje G16. |
| `10_FINANCE` | `97c8293786` | 21/7/28 | `NOT_PROVEN / OWNER_RETEST_PENDING` — pomiar na `67d235cfa0`; G06 #3 + R5 PARTIAL; bloki 1/2/3 = 127/131, 225/225, 11/18; OTWARTE: lista raportu; techniczna regresja nie zastępuje G16. |
| `11_MATERIALS` | `4d402fcfc8` | 21/7/28 | `NOT_PROVEN / OWNER_RETEST_PENDING` — blok 3 ma czerwienie deck/workbook; G06 #3 + R5 PARTIAL; OTWARTE: lista raportu; techniczna regresja nie zastępuje G16. |
| `12_AUDITS` | `08775ced65` | 21/9/30 | `NOT_PROVEN / OWNER_RETEST_PENDING` — pomiar na `67d235cfa0`; G06 #3 + R5 PARTIAL; bloki 1/2/3 = 127/131, 225/225, 11/18; OTWARTE: lista raportu; techniczna regresja nie zastępuje G16. |
| `13_CHAT` | `08775ced65` | 21/9/30 | `NOT_PROVEN / OWNER_RETEST_PENDING` — AIConsultantPanel dodany do macierzy, 8/8 PNG i 0 axe, lecz narzędzie PARTIAL; blok 3 11/18; OTWARTE: lista raportu; techniczna regresja nie zastępuje G16. |
| `14_ADMIN` | `08775ced65` | 21/9/30 | `NOT_PROVEN / OWNER_RETEST_PENDING` — HTTP objął adminP32 i security bez wykrytego wycieku, ale R5 PARTIAL i blok 3 11/18 blokują wariant 1; OTWARTE: lista raportu; techniczna regresja nie zastępuje G16. |
| `15_SETTINGS` | `08775ced65` | 21/9/30 | `NOT_PROVEN / OWNER_RETEST_PENDING` — pomiar na `67d235cfa0`; G06 #3 + R5 PARTIAL; bloki 1/2/3 = 127/131, 225/225, 11/18; OTWARTE: lista raportu; techniczna regresja nie zastępuje G16. |
| `16_PARTNER` | `075735c395` | 21/7/28 | `NOT_PROVEN / OWNER_RETEST_PENDING` — pomiar na `67d235cfa0`; G06 #3 + R5 PARTIAL; bloki 1/2/3 = 127/131, 225/225, 11/18; OTWARTE: lista raportu; techniczna regresja nie zastępuje G16. |

Wariant 1 z inwentarza (`TECHNICAL_REGRESSION_PASS / OWNER_RETEST_PENDING`) **nie jest gotowy do użycia**. Powyższe zdania są gotowym, uczciwym wpisem zastępczym. Nadzorca może podnieść je do wariantu 1 dopiero po sklasyfikowaniu siedmiu czerwieni na prawidłowej parze i domknięciu/zaakceptowaniu ograniczeń R5.

## TWIERDZENIA NIEZWERYFIKOWANE

- Nie wykonano G16 na stagingu ani na realnych danych właściciela; zakaz Z28.
- Nie potwierdzono semantycznej poprawności tłumaczeń PL/EN.
- Nie potwierdzono faktycznego renderowania 22 komponentów tylko na podstawie grafu importów historycznego inwentarza.
- Nie potwierdzono klasy `ZASTANA/NOWA` dla 7 czerwieni bloku 3, bo testów nie ma na bazie.
- Nie wykonano żadnej naprawy produktu dla czerwieni.
- Nie zmieniono `MODULE_ACCEPTANCE.md`; wpis należy do nadzorcy.

## Testy PUSTE

Nie oznaczono żadnego uruchomionego testu jako `PUSTY`. Jednocześnie test jednostkowy `tests/unit/initiatives-execution/executionCasesInitiativeTitle.test.ts` nie jest dowodem produkcyjnej ścieżki, bo montuje goły router; dlatego nie został użyty do zamknięcia R4.
