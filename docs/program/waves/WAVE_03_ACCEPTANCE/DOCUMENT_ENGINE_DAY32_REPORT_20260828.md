# Dyżur 32 — silnik dokumentu: raport DRD z bazy — raport

## 0. Wiązanie i środowisko

- Historia: wcześniejszy zasadny raport STOP (`f0fbee94cc`) zastąpiono po naprawie wiązania przez nadzorcę.
- Marker `5cfa62470e`; ancestry wobec `codex/m03-admin-20260824` → `MARKER OK`. Tip bazy w pomiarze: `e048726ce8`; marker jest przodkiem. Rozejście obejmuje m.in. Gateway, stage gates, trasy konsultantów/tabel/webhooków, locale i `src/**`; nie scalano go.
- Gałąź/worktree: `codex/document-engine-day32-20260828`, `/private/tmp/consultify-docengine`. Baza diffu: `git diff --name-only 5cfa62470e...HEAD`. `git diff 5cfa62470e --name-only -- src` → pusty wynik.
- Złoty plik: `codex/golden-drd-report-20260827`, tip `c2a91d0258`; pakiet 9 plików, `GOLDEN NOT MERGED`; odczyt tylko przez `git show` do `/private/tmp/consultify-day32-wzorzec`.
- PG: `cx-day32-pg`, port hosta `5521`; `current_database = cx_day32`; `docker port` → `5432/tcp -> 0.0.0.0:5521` i `[::]:5521`.
- Migracje: rzeczywisty runner `server/scripts/migrate.postgres.ts` zastosował na pustej bazie `854`, błędów `0`. Migracje własne `20261210–19`: `0`.
- Sprzątanie: `docker rm -fv cx-day32-pg` — wykonane po pomiarach.

## 1. Weryfikacja stanu wejściowego (§0.1 pkt 5)

| Komenda/pomiar | Oczekiwane | Zmierzone | Zgodne? |
|---|---:|---:|---|
| renderer/style | istnieją | 1646/694 linii | tak |
| canvas/radar | canvas tak, radar nie | 8/0 trafień | tak |
| kontrakt/sessionLabel/version | istnieją | 182/1/1 | tak |
| `drdStructure` namePL/osie | 48/7 | 48/7 | tak |
| trasa kontraktu | jedna | `method-core.routes.ts:534` | tak |
| placeholder PL | literal | `translation.json:6979` | tak |
| ledger/DEC-151 | istnieją | 215 linii/1 | tak |
| konsumenci rendererera | 6 | 4 serwisy + 2 trasy, jedna publiczna | tak |

## 2. Pomiar PRZED (pełny zakres §0.4 pkt 3, bez zawężania)

- Jawny PG, pełna komenda: `1340` testów; `1286 PASS / 54 FAIL / 0 SKIPPED`. Pierwszy przebieg plików: `131 PASS / 21 FAIL`; powtórka JSON pokazała niestabilność zastanego zakresu.
- ZASTANE czerwone pliki: `adminP32.security-audit`, `document-studio.routes.leak-guard`, `h64-failsoft-batch6`, `interview.routes.org-guard`, `metricsOrgRoutes`, `partner-payouts-auth`, `pmo-decisions.routes.org-guard`, `pmo-initiatives.routes.org-guard`, `pmo-initiatives.routes.program-rollup`, `tools.routes.org-guard`, `documentAudienceProfileService`, `documentBrandVoiceService`, `documentChartRenderQa`, `documentContentBlockService`, `documentCoverLogoRender`, `documentPdfFigureEmbedding`, `documentPdfRenderer.polishFonts`, `documentPdfRendererParity`, `documentRendererE15FormattingRender`, `documentShareLinkService`, `documentStudioEditorStatePersistence`, `documentStudioExport`, `documentStudioExportQaGate`, `documentStudioGenerateExportHappyPath`.
- Dominujące przyczyny: fonty PDF oraz zastane mock/persistence/tenant harnessy; poza zakresem.

## 3. ★ TABELA POKRYCIA — co silnik wypełnia z danych, a czego nie (§D.1)

|#|Element|Wynik|Ocena instrukcji|
|---:|---|---|---|
|1|tytuł|stała|potwierdzone|
|2|klient|`projects.name`, fallback placeholder|doprecyzowane|
|3|site|brak|potwierdzone|
|4|industry|brak|potwierdzone|
|5|headcount|brak|potwierdzone|
|6|okres|brak; generatedAt to wydanie|potwierdzone|
|7|assessor|brak|potwierdzone|
|8|sponsor|brak|potwierdzone|
|9|metodyka|methodVersion|potwierdzone|
|10|sygnatura|techniczny sessionId|doprecyzowane|
|11|data wydania|generatedAt|potwierdzone|
|12|rewizja|revision/outputId/version|potwierdzone|
|13|poufność|stała + klient|potwierdzone|
|14|TOC wpisy|struktura/pole Word|potwierdzone|
|15|TOC strony|brak na serwerze|potwierdzone|
|16|radar wartości|średnie ocenionych/maxLevel|potwierdzone|
|17|radar etykiety|7 × axisNamePL|potwierdzone|
|18|tabela osi|dane + krytyczne|potwierdzone|
|19|osie PL|7/7|potwierdzone|
|20|obszary PL|39/39|potwierdzone|
|21|ID obszaru|kontrakt|potwierdzone|
|22|current/target/gap|kontrakt, null zachowany|potwierdzone|
|23|maxLevel|kontrakt|potwierdzone|
|24|wypełnienia matrycy|deterministyczne|potwierdzone|
|25|priorytet|mapa gap|potwierdzone|
|26|poziomy PL|A1/A2; A3–A7 fallback EN|doprecyzowane|
|27|dowody PL|nazwana mapa|potwierdzone|
|28|pominięcia|pełne/częściowe + kody|potwierdzone|
|29|wstęp osi|null + 120–180|potwierdzone|
|30|podpis matrycy|null + 30–60|potwierdzone|
|31|komentarz|null + 110–170 + mikrostruktura|potwierdzone|
|32|wnioski osi|null + 180–260|potwierdzone|
|33|linia osi|4 × null|potwierdzone|
|34|streszczenie|brak slotu i limitu|doprecyzowane|
|35|wnioski końcowe|brak slotu i limitu|doprecyzowane|
|36|rejestr luk|wyliczalny|potwierdzone|
|37|stopka/numeracja|renderer|potwierdzone|

Podsumowanie: 24/37 DANE lub STAŁA, 3 CZĘŚCIOWO, 10 BRAK. Kontrakt v1 nie niesie limitów dla 34–35. Implementacja użyła `180–260` jako jawnej stałej technicznej; nie jest ona potwierdzona kontraktem, więc §D/§G są `CZĘŚCIOWO` i wymagają decyzji o kontrakcie v2 lub limitach.

## 4. Pozycje

### §A — `ZROBIONE_WG_DoD`

Profil `drd-report`, paleta/geometria i 9 stylów: `documentDocxStyles.ts:95–125,251,591`; zmiany renderera wyłącznie opt-in. `day32.rendererParity.test.ts` porównuje legacy XML bit w bit. Po pełnym pomiarze style DRD oddzielono od wspólnego enumu; istniejące renderer/style `35/35 PASS`.

### §B — `ZROBIONE_WG_DoD`

Jedno wejście `TextRun`, tylko język PL + profil DRD. `day32.polishTypography.test.ts` `2/2 PASS`: `A teraz i dalej, w procesie oraz z 4 dowodami`, brak po wyrazie dwuliterowym, EN zero NBSP, `Zażółć gęślą jaźń` bez uszkodzeń.

### §C — `ZROBIONE_WG_DoD`

Radar w `documentChartRasterizer.ts:40,174,197,236`: dwie serie, 0–100, krok 20, legenda dół, łamanie wyrazów. Test konfiguracji i realnego PNG `2/2 PASS`; trasa dodatkowo asertuje `word/media/*`. Produkcyjny grep zakazanych narzędzi: `0`.

### §D — `CZĘŚCIOWO`

Czysty mapper `assessmentDrdReportSchemaService.ts:1–407`: bez I/O/zegara/losowości/LLM; pełna struktura, pułapki null/pusta oś/full/partial skip, dane i placeholdery. Natywny TOC `documentDocxRenderer.ts:1382`, updateFields. `day32.drdSchema.test.ts` `7/7 PASS`. Brak DoD: niepotwierdzone limity rozdziałów 0/8. `assessmentReportContractService.ts` i contractVersion bez diffu.

### §E — `ZROBIONE_WG_DoD`

Jednorodność: A1/A2 po 1 wariancie; A3 ma 2; A4–A7 po 5. Etykiety dodano tylko A1/A2, reszta fallback EN. `day32.drdLevels.test.ts` `3/3 PASS`; istniejące pola nietknięte.

### §F — `ZROBIONE_WG_DoD`

Jeden handler `method-core.routes.ts:552–592`; org tylko JWT, ten sam helper błędów, MIME/length/sanityzowany ASCII + UTF-8 filename, zero zapisu (count przed/po). Test real PG/JWT/router: 6 scenariuszy F + drugi tenant, `7/7 PASS`.

Ścieżka Z20: `Gateway.ts:195` import → `Gateway.ts:957` mount `/api/method` → middleware `method-core.routes.ts:126` → handler `:552` → contract `:558` → mapper `:564` → renderer `:563` → raster `documentDocxRenderer.ts:338` → canvas `documentChartRasterizer.ts:40` → `res.send` `method-core.routes.ts:587`.

### §G — `CZĘŚCIOWO`

Dwa tenanty, inne dane/nazwy; null, pełny i częściowy skip, pusta oś i luka krytyczna widoczne w XML. Dwa DOCX powstały przez trasę z realnym PNG. Struktura/style/diakrytyki zmierzone; paginacja niemierzalna. Częściowo z powodu limitów 0/8 i braku dozwolonego renderu wizualnego.

### §R.1 — `CZĘŚCIOWO`

Tylko bounded update raportu/eksportu w `MODULE_ACCEPTANCE.md`; bez podniesienia gate, browsera, właściciela i release.

## 5. Parytet wobec złotego pliku (§G.3)

|Obszar|Werdykt|Uzasadnienie|
|---|---|---|
|Struktura|PARYTET|Okładka, TOC, summary, 7 osi, final, appendix; 17 tabel.|
|Style|RÓŻNICA ŚWIADOMA|Wzorzec 22 style/638 inline rFonts; A 35/0; B 35/0.|
|Paginacja|NIEMIERZALNE|Wymaga PDF/LibreOffice; Word aktualizuje TOC przy otwarciu.|
|Diakrytyki|PARYTET|PL w treści/nagłówkach/stopce/filename; NBSP PL, zero EN.|
|Uczciwość pustych sekcji|PARYTET Z OGRANICZENIEM|Po 102 placeholdery; limity 0/8 niepotwierdzone.|
|Widoczność pominięć|PARYTET/PRZEWAGA|Full/partial wraz z kodami w XML.|

## 6. Nazwane RÓŻNICE ŚWIADOME (nie luki)

1. Natywny TOC zamiast wpisanych numerów; konwerter bez aktualizacji pól pokaże brak numerów.
2. Radar przez `@napi-rs/canvas`/Chart.js zamiast LibreOffice.
3. Narracja bez danych to placeholder, nigdy proza syntetyczna.
4. 0 inline rFonts zamiast 638 — edycja przez style Worda.

## 7. Pomiar PO (pełny zakres, bez zawężania)

- Identyczna komenda: `1355` testów; `1299 PASS / 56 FAIL / 0 SKIPPED`; JSON: `570` suites, `515 pass / 55 fail / 0 skipped`.
- Delta: +15 testów, +13 PASS, +2 FAIL. Pakiet Day32 `22/22 PASS`; endpoint `7/7`; istniejące renderer/style + Day32 `55/55 PASS`.
- Dwa pozornie nowe FAIL w `documentSourcePackPersistence.pg.test.ts` wystąpiły tylko we współbieżnym pełnym biegu; niezależny rerun z tym samym PG: `4/4 PASS`. To niestabilność zastanego współdzielonego harnessu. Pozostałe czerwone pliki odpowiadają PRZED, z wymiennością share-link/source-pack.
- Nowe deterministyczne FAIL: `0`. Sześciu konsumentów rendererera bez nowych FAIL: TAK; legacy XML/style przypięte bit w bit.

## 8. Artefakty dowodowe

- `evidence/document-engine-day32-20260828/raport-drd-org-a.docx` — 75 299 B, przez trasę.
- `evidence/document-engine-day32-20260828/raport-drd-org-b.docx` — 74 953 B, przez trasę.
- `document.xml.txt` — 25 800 B; `parytet.md` — 786 B. Wszystkie <2 MB.

## 9. Korekty wobec instrukcji

1. Runner migracji: `server/scripts/migrate.postgres.ts`, nie wskazana ścieżka.
2. Pierwszy start bez `NODE_ENV=test` odmówił local host; poprawny bieg 854/854.
3. `git fetch --all --prune` trafił na martwy `icloud-source` do usuniętego worktree; wymagane refs były dostępne.
4. Tip bazy przesunął się po markerze; nie scalano obcych zmian.
5. Grep całego `documentStudio/**` ma zastane trafienia w teście `documentStudioGenerateExportHappyPath.test.ts:454–460`; produkcyjny kod ma 0.
6. Brak limitów 0/8 w kontrakcie/instrukcji; `180–260` pozostaje niepotwierdzone.

## 10. Znaleziska poza zakresem

- Potrzebny kontrakt v2 dla slotów/limitów rozdziałów 0 i 8.
- A3–A7: niejednorodne poziomy; około 233 opisów do ewentualnego tłumaczenia.
- Punktowy typecheck dochodzi do zastanego `assessmentSkipReasonService.ts(119,22): Expected 0 arguments, but got 1`; bundlowanie mappera przechodzi.
- Uwaga 1B właściciela z DEC-151 pozostaje otwarta.

## 11. Twierdzenia NIEZWERYFIKOWANE

- Paginacja wizualna i parytet stron Word/PDF.
- Limity summary/final.
- Railway/demo/produkcja, browser UI i akcept właściciela.
- Pełna polska skala A3–A7.

## 12. Kontrakt trasy dla dyżuru frontowego (§F.5)

`GET /api/method/sessions/:sessionId/assessment-report.docx?outputId=<opcjonalny>`, Bearer JWT. Org wyłącznie z JWT; `organizationId` w query ignorowany. `200`: MIME DOCX, length, `Raport_DRD_<projekt-lub-sessionId>_<YYYYMMDD>.docx` (ASCII fallback + RFC5987 UTF-8). Pusta sesja: `200` z pełną strukturą/placeholderami. Brak/cudzy tenant: identyczne `404 SESSION_NOT_FOUND`; obca rewizja: `404 REPORT_REVISION_NOT_FOUND`; brak/zły JWT: `401`. Front pobiera blob i tworzy tymczasowy object URL. Przycisk za flagą domyślnie OFF; demo dopiero po zrzucie i akcepcie właściciela.

## 13. Commity

- `8d32c70e2c` A; `be39f74c26` A.4; `3d6fa7c150` B; `4d296796a3` C; `63c0f60d7a` D; `c66c1336fc` E; `92f400ebf6` F; `dd718c11a2` G; `b589db3c61` R.1; `79c839e2d3` izolacja legacy po pełnym pomiarze.
- §R.2: commit zawierający ten raport.

## Brief wynikowy

```text
DYŻUR 32 — SILNIK DOKUMENTU (raport DRD z bazy)
Marker: 5cfa62470e — MARKER OK
Gałąź: codex/document-engine-day32-20260828
PG: cx-day32-pg, port 5521, migracje 854, posprzątane TAK
Migracje własne: 0
Pozycje: A/B/C/E/F ZROBIONE · D/G/R.1 CZĘŚCIOWO
Testy: PRZED 1286/54/0 → PO 1299/56/0; nowe deterministyczne FAIL 0
Sześciu konsumentów renderera: bez nowych FAIL TAK
DOWÓD: dwa tenanty, dwa DOCX przez trasę TAK
PARYTET: struktura TAK · style RÓŻNICA ŚWIADOMA · paginacja NIEMIERZALNE · diakrytyki TAK
inline rFonts: 638 → 0/0
POKRYCIE: dane/stałe 24/37 · częściowe 3 · brak 10
Zero LLM TAK · zero LibreOffice w produkcyjnym serwerze TAK · zero src TAK · contractVersion nietknięty TAK
STOP-y: brak; częściowo z powodu niepotwierdzonych limitów 0/8
Niezweryfikowane: paginacja, limity 0/8, runtime demo/owner
Do decyzji: jawne min/max 0/8 albo kontrakt v2
```
