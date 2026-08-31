# Dyżur 76 — Materiały — macierz odbioru właściciela

Data: 2026-08-29  
Marker: `8d254e6baebc6f26ea508771f07a0c250a0e5857`  
Gałąź: `codex/day76-materials-owner-20260829`  
Worktree: `/private/tmp/cx-day76-materials`  
Artefakty: `/private/tmp/cx-day76-artefakty`  
Werdykt: `EVIDENCE_COMPLETE / OWNER_ACCEPTANCE_BLOCKED`

Najważniejszy wynik: karta prezentacji w pełnym stanie nadal wizualnie renderuje niemal pusty ekran. DOM zawiera cztery slajdy, lecz zrzut pokazuje pustą powierzchnię. `MAT-D76-004` pozostaje blokadą odbioru modułu. Nie zmieniono kodu produktu.

## §0.1 — baza, marker i sanity

`df -h /` pokazało `96Gi` wolnego miejsca, czyli więcej niż wymagane `5 GB`.

Wynik komendy (2), dosłownie:

```text
d0d08b3e5a docs(instrukcje): dyzur 76 Materialy — macierz 20/20 + rozstrzygniecie 8 znanych defektow
8d254e6bae docs(instrukcje): dyzur 74 (Finanse — dowod merytoryczny) i 75 (naprawa licznikow migracji)
...
MARKER OK
```

Wynik komendy (7), dosłownie:

```text
8d254e6baebc6f26ea508771f07a0c250a0e5857
```

`git status --short | head -3` nie wypisał żadnej linii. Krok §0.1(4) wypisał dosłownie:

```text
[core]
	bare = false
```

Tip gałęzi bazowej uciekł o jeden commit. Zgodnie z `DEC-2026-08-26-95` praca pozostała dokładnie na markerze:

```text
d0d08b3e5a docs(instrukcje): dyzur 76 Materialy — macierz 20/20 + rozstrzygniecie 8 znanych defektow
docs/program/waves/WAVE_03_ACCEPTANCE/codex/INSTRUKCJA_DYZUR_76_MATERIALY_ODBIOR.md
```

## W1–W3

- W1: seeder liczy `schema_migrations` o statusie `applied` lub `success` i odrzuca wyłącznie wynik `< 800`.
- W2: nazwa bazy nie ma stałego prefiksu; dopuszczalny wzorzec to `^[a-zA-Z0-9_]+$`.
- W3 przed dyżurem: G07 `READY_FOR_OWNER_REVIEW`; G08 i G10 `EVIDENCE_PACKAGE_READY`; G09 `PASS_TECHNICAL_OWNER_REPLAY_READY`.
- Porty `5948` i `4700`: `0 z 2` zajętych.

## B.1 — fixture, migracje i readback

PostgreSQL: `pgvector/pgvector:pg16`, kontener `cx-day76-pg`, wyłącznie `127.0.0.1:5948/cx_day76_materials`.

Pierwszy migrator:

```text
✅ Postgres migrations complete
```

Drugi migrator:

```text
Applying migrations: 0
✅ Postgres migrations complete
```

Ledger po migracji: `863 z 863` wierszy ze statusem `applied` albo `success`.

Seeder/readback, dosłownie:

```json
{"fixture":"wave3-materials-owner-review-v1","seeded":true,"readback":{"doc_versions":2,"decks":1,"deck_versions":1,"workbook_revisions":1,"document_registry_projections":1,"presentation_registry_projections":1,"workbook_registry_projections":1,"approved_templates":1,"unknown_templates":1,"non_draft_registry_rows":3},"manifestPath":"/private/tmp/cx-day76-artefakty/materials-day76-manifest.json"}
```

Manifest ma tryb `0600`; SHA-256: `f64011317f931b75113bd9f6c8eaf45f37214c4a5705ec3c7697357904a6f547`.

Po pustym przebiegu odtworzono własny dump i wykonano niezależny końcowy readback:

```text
doc_versions=2; decks=1; deck_versions=1; workbook_revisions=1;
document_registry_projections=1; presentation_registry_projections=1;
workbook_registry_projections=1; approved_templates=1; unknown_templates=1;
non_draft_registry_rows=3
```

Wynik: `10 z 10` oczekiwanych pól.

### Z30 — zero wysyłki

```text
BRAK ZMIENNYCH POCZTY
settings WHERE key LIKE 'smtp%': (0 rows)
Gateway.ts grep drenów: 0 trafień
```

Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Baza tego dyżuru nie zawiera wierszy konfiguracji SMTP. Nie uruchomiłem `server/src/index.ts` ani żadnego drenażu outboxu. Żaden e-mail ani zaproszenie kalendarzowe nie zostało wysłane.

### Pułapki §0.2d/Z33

- (a) `ENABLE_V8_GLOBAL=true`; trasy nie zostały odcięte fałszywym `404`.
- (b) `RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce`; strażnik testowy nie przepuszczał automatycznie.
- (c) `MOCK_DB=false DB_TYPE=postgres RUN_DB_TESTS=1`; log Gateway potwierdził `DB_TYPE: postgres` i `DB_IDENTITY ... 127.0.0.1:5948/cx_day76_materials`.
- (d) `ENABLE_TEST_AUTH_BYPASS=false`; prawdziwe logowanie persony OWNER przeszło endpoint `/api/auth` i weryfikację hasła.
- (e) seeder nie migrował bazy; migrator wykonano dwukrotnie przed seedem.
- Nie uruchamiano Vitest; `--retry=0` nie dotyczy. Nie wykonano żadnego wywołania LLM.

## B.2 — macierz 20 z 20

Mianownik: `5 powierzchni × 2 motywy × 2 stany = 20 z 20`. Dodatkowe dwa zrzuty kart służą rozstrzygnięciu defektów #4 i #8. Na dysku jest `22 z 22` raportowanych plików PNG.

Stan pełny pochodzi z fixture. Stan pusty uzyskano na tej samej własnej bazie po dumpie przez usunięcie projekcji rejestru oraz źródeł Materiałów; po zrzutach dump odtworzono i potwierdzono readbackiem `10 z 10`. Nie relabelowano stanu nieosiągalnego.

| # | Zrzut | Inspekcja wizualna |
| ---: | --- | --- |
| 1 | `day76-all-light-full.png` | Nagłówki PL; wartości `Unknown`, `Organization`, `Tool` EN; data `21 sie 2026`; brak kwot/liczb dziesiętnych; bez ucięć; brak surowych ID; crimson także dla zwykłych akcji, nie tylko krytycznych. |
| 2 | `day76-all-dark-full.png` | Jak #1; ciemny motyw czytelny, bez nachodzenia. |
| 3 | `day76-all-light-empty.png` | Zamierzona karta pustego stanu; PL; brak liczb/ID; CTA crimson ma semantykę tworzenia, nie krytyczną. |
| 4 | `day76-all-dark-empty.png` | Jak #3 w motywie ciemnym; kontrast czytelny. |
| 5 | `day76-documents-light-full.png` | Nagłówki PL, CTA `New document`; `Unknown` i `Organization`; data PL; bez ucięć i ID. |
| 6 | `day76-documents-dark-full.png` | Jak #5 w motywie ciemnym. |
| 7 | `day76-documents-light-empty.png` | Karta pustego stanu jak „Wszystkie”; CTA główne PL, górne CTA EN; brak ID/formatów liczbowych. |
| 8 | `day76-documents-dark-empty.png` | Jak #7 w motywie ciemnym. |
| 9 | `day76-presentations-light-full.png` | Nagłówki i wartości PL; `Briefing` pozostaje nieprzetłumaczone; data PL; 4 slajdy; bez ucięć/ID. |
| 10 | `day76-presentations-dark-full.png` | Jak #9 w motywie ciemnym. |
| 11 | `day76-presentations-light-empty.png` | Pusty stan jest dużym panelem tabeli z samym „Brak prezentacji”; inny wzorzec niż #3/#7. |
| 12 | `day76-presentations-dark-empty.png` | Jak #11 w motywie ciemnym. |
| 13 | `day76-sheets-light-full.png` | Nagłówki PL, CTA `New sheet`; `Unknown`, `Organization`; data PL; bez ucięć/ID. |
| 14 | `day76-sheets-dark-full.png` | Jak #13 w motywie ciemnym. |
| 15 | `day76-sheets-light-empty.png` | Techniczny opis „kanonicznego rejestru artefaktów”; osobny wygląd; CTA `New sheet`; brak ID. |
| 16 | `day76-sheets-dark-empty.png` | Jak #15 w motywie ciemnym. |
| 17 | `day76-templates-light-full.png` | Nagłówki PL; tytuły i `LEGACY` mieszane EN; daty PL; górny prawy CTA ucięty do białego fragmentu; bez surowych ID. |
| 18 | `day76-templates-dark-full.png` | Jak #17 w motywie ciemnym; ucięcie CTA nadal widoczne. |
| 19 | `day76-templates-light-empty.png` | Onboarding z trzema kartami; surowe klucze `executive_update`, `assessment_results`; inny pusty wzorzec; CTA nadal ucięty. |
| 20 | `day76-templates-dark-empty.png` | Jak #19 w motywie ciemnym. |
| 21 | `day76-defect-04-presentation-full-dark.png` | `Karta 1 z 4` i tytuł są widoczne, lecz środek ekranu jest niemal całkowicie pusty; blokada odbioru. |
| 22 | `day76-defect-08-sheet-full-dark.png` | Widoczne `Zadanie ukończone 0/8` oraz `Workbook "Budżet pilotażu" — 1 sheets.`; mieszana lokalizacja. |

Format kwot `1 250,00 €` nie występuje na żadnym z `20 z 20` ekranów, więc nie był możliwy do oceny. Format dat jest polski (`21 sie 2026`, `29 sie 2026`) na ekranach, które daty pokazują.

## B.3 — osiem defektów z dyżuru 61: 8 z 8

| # | Werdykt | Dowód ze zrzutu |
| ---: | --- | --- |
| 1 | `NADAL WYSTĘPUJE` | `day76-documents-light-full.png`: `New document`; `day76-sheets-light-full.png`: `New sheet`; obok polskie `Nowy output`/`Nowa prezentacja`. |
| 2 | `NADAL WYSTĘPUJE` | `day76-all-light-full.png`, `day76-documents-light-full.png`, `day76-sheets-light-full.png`: FORMAT = `Unknown`. |
| 3 | `NADAL WYSTĘPUJE` | `day76-all-light-full.png`: WIDOCZNOŚĆ = `Organization`, ŹRÓDŁO = `Tool`; `Organization` także w Dokumentach i Arkuszach. |
| 4 | `NADAL WYSTĘPUJE — BLOKADA` | `day76-defect-04-presentation-full-dark.png`: `Karta 1 z 4`, ale niemal pusta powierzchnia bez treści slajdu. |
| 5 | `NADAL WYSTĘPUJE` | `day76-all-light-empty.png`, `day76-presentations-light-empty.png`, `day76-sheets-light-empty.png`, `day76-templates-light-empty.png`: co najmniej cztery odmienne kompozycje pustego stanu. |
| 6 | `NADAL WYSTĘPUJE` | `day76-templates-light-full.png` i wariant ciemny: prawy CTA jest ucięty przez krawędź; widoczny tylko fragment. |
| 7 | `NADAL WYSTĘPUJE` | `day76-sheets-light-empty.png`: tekst mówi o „kanonicznym rejestrze artefaktów” i „aktywnych artefaktach arkuszy”. |
| 8 | `NADAL WYSTĘPUJE` | `day76-defect-08-sheet-full-dark.png`: oba wskazane ciągi występują literalnie. |

Wynik K4: `8 z 8` rozstrzygniętych; `8 z 8` nadal występuje; `0 z 8` naprawionych.

## Wznowienie — diagnoza przyczyny `MAT-D76-004` (bez naprawy)

Werdykt: dane nie urywają się ani w HTTP, ani w stanie React, ani w samym rendererze. Karty są renderowane, lecz właściwy obszar roboczy dostaje wysokość `0px` i zostaje przycięty. Przyczyną jest pełnowysokościowy dolny pasek użyty jako bezpośrednie, niekurczliwe dziecko pionowego kontenera w trybie innym niż Artifact Studio.

Łańcuch dowodowy:

1. `GET /api/presentations/decks/b1160000-0000-4000-8000-000000000001` zwrócił HTTP `200`. Odpowiedź miała kształt `{ success: true, data: { deck_json: string, slide_count: 4, declared_slide_count: 4, ... } }`; po parsowaniu `data.deck_json` zawierało `cards` o długości `4`, z tytułami `Transformacja operacyjna`, `Stan obecny`, `Plan 90 dni`, `Decyzja`.
2. `DeckBuilder` odbiera wrapper odpowiedzi w `src/components/Presentations/DeckBuilder/DeckBuilder.tsx:648-652`, parsuje `deck_json` w linii `662`, sprawdza `deckJson.cards` w linii `684` i zapisuje pełną talię do stanu w liniach `685-699`. Następnie przekazuje dokładnie `deck.cards` do `SlideSorter` w liniach `1643-1649` oraz do `CardCanvas` w liniach `1669-1673`.
3. Odczyt DOM potwierdził istnienie elementów wszystkich czterech kart. Renderer nie ma `display:none` ani `visibility:hidden`; dla właściwego `<main aria-label="Prezentacje canvas">` computed style wyniósł `display:block`, `visibility:visible`, `opacity:1`, `z-index:auto`, ale `height:0px` i rect `487×0` przy `x=344, y=48`. Nie jest to problem `z-index`.
4. Źródło zerowej wysokości: `DeckBuilderBottomBar` nadaje swojemu korzeniowi `h-full ... flex-shrink-0` w `src/components/Presentations/DeckBuilder/DeckBuilderBottomBar.tsx:25`. Gdy `artifactStudioMode` jest fałszywy, adapter wstawia ten pasek bezpośrednio jako rodzeństwo głównej części przez `src/components/Presentations/DeckBuilder/DeckBuilderMelsView.tsx:404-407`. Pomiar dzieci `deck-builder-mels-root` przy wysokości `672px` wykazał: główna część `flex-1 ... overflow-hidden` = `0px`, pasek `h-full ... flex-shrink-0` = `672px`.
5. Następnie `ExecutiveModuleShell` dziedziczy już `0px`: korzeń `h-full` w `src/components/shared/ExecutiveModuleShell/index.tsx:463`, środkowy flex w linii `485` i canvas `<main>` w liniach `587-595`. Przodek z `overflow-hidden` w `DeckBuilderMelsView.tsx:404` przycina wyrenderowaną treść. Dlatego na zrzucie zostaje praktycznie tylko pełnowysokościowy pasek `Karta 1 z 4`, mimo że cztery slajdy istnieją w DOM.

Klasyfikacja: `DIAGNOSED_OPEN_BLOCKER`. Nie zmieniono żadnego pliku produktu ani testu.

## Hashe zrzutów

```text
ba77a9d70d33381ab3011e10c293dd1a3268e5aa759d71cee4f7dea49f418e52  day76-all-dark-empty.png
eb7fff86c66ff9753502b9e9f600e6f42626979a93e0bf799bee76d964114873  day76-all-dark-full.png
e2377c2571226bf5c3f719c8b16db3e9ab861723233a85fc5011a2c1165b94be  day76-all-light-empty.png
5ddbf13a9d331e4d01900ebeede34eed40440565bcbeaa573f1f3278d9aeae29  day76-all-light-full.png
bec41f9c626993d6f8a67709a0c8eff0e3cae67ef62ba28b5cf534b712529878  day76-defect-04-presentation-full-dark.png
5d3e2b7c9b1af358c6b5851674667eae1e5a2b82c8ee20d19f0f691618c820e2  day76-defect-08-sheet-full-dark.png
1dd770491c90678f511fda95220d61a944e667a74eb9c2eb6c191cd133fcacd6  day76-documents-dark-empty.png
ddfba29a7f96d4ce6cbe89b1a30f450746f102acf18b174a807ef97df0d81b85  day76-documents-dark-full.png
8639f1cad5c4d7cedfd7fbb39cff8cbd7c74d5c313c70b5890f7feb9f8760ec5  day76-documents-light-empty.png
fb4ab884c203cd1c20a820f3b9e2a0d5ae512cd6e20c4c6149a2fb46cebec5af  day76-documents-light-full.png
045200efb1ce83f7dadc29473e54af7e2fee2e6528954868282a3ae2b87f231c  day76-presentations-dark-empty.png
bf8f71ebb0e96820f467ee6e968d62faf9077779b7588d223df44d9c0b6f239c  day76-presentations-dark-full.png
c0cd95b66d36e2caaf4265bce493ee1fb109548bb0dbe206b2e266fe8553d104  day76-presentations-light-empty.png
b9f5527fb2858e1dbca3b949df629ac4243986335d7869ede492547622be0dff  day76-presentations-light-full.png
11ec5105649aaa1be7e432a183418098f1728be216a0e66ae6f97852c1862e54  day76-sheets-dark-empty.png
23489c6223cbacbb5594eb2b11ef92ed8b70945a3ea9273a66d89e75c378f4bb  day76-sheets-dark-full.png
0becd65d90db0e57c153c9a69bb0b8391141c6fc67c72718e6ede542dae0283f  day76-sheets-light-empty.png
ec6ab5a00a8d90bb8d1505621d76651b5f96c0714922d77aacd882b2b645dfd9  day76-sheets-light-full.png
fcc36df6d622cebfdd97ff576a563e77317d913aaf690b3c716bbc664821477f  day76-templates-dark-empty.png
9567f6bb8ba23cc80436ab3f4c981a2a1e9b26eb38179cdb52c08714da42a675  day76-templates-dark-full.png
b9232dc676bb24f38d4975693d2745762dc5eb8cb97bc805c1c0228abc8ca40b  day76-templates-light-empty.png
5c3c8298b4cfd6aea647dafe59cdc538a7a0c02eeec83a173a43335297d254a0  day76-templates-light-full.png
```

## Korekty wobec instrukcji

1. §A wymaga bazy `cx_day76_materials`, natomiast `scripts/dev/start-wave3-owner-runtime.mjs` w trybie `adopt-existing` dopuszcza Materiały wyłącznie przy nazwie pasującej do `^consultify_w3_materials_owner_[a-z0-9_]+$`. Nie zmieniono nazwy ani kodu. Użyto istniejącego wzorca z raportu Day 61: minimalny proces poza repo montujący prawdziwy `ApiGateway.getInstance().initializeRoutes(app)` na 4700 oraz Vite na 4701.
2. §B.2 wskazuje ten skrypt runtime, lecz §0.2b bezwarunkowo zabrania `server/src/index.ts`; wskazany skrypt uruchamia właśnie `server/src/index.ts`. Wybrano bezpieczniejszą interpretację: bez `index.ts`, schedulerów i drenów.
3. Pierwsze pięć plików nazwanych `light-full` powstało przy aktywnym motywie ciemnym. Zostało to wykryte wizualnie; pliki nadpisano po odtworzeniu fixture prawdziwymi zrzutami jasnymi. Końcowe klasy HTML nie zawierały `dark`, a hashe powyżej dotyczą wyłącznie poprawionych plików.
4. DOM karty prezentacji zawierał treści czterech slajdów, ale zrzut był pusty. Wiążący jest zrzut, dlatego defekt #4 ma werdykt `NADAL WYSTĘPUJE`, nie `NAPRAWIONE`.

## K1–K5

| Kryterium | Wynik |
| --- | --- |
| K1 | `PASS — 10 z 10` pól readbacku po końcowym odtworzeniu. |
| K2 | `PASS — 22 z 22` raportowanych PNG istnieje; macierz `20 z 20` plus `2 z 2` dowody kart; każdy ma SHA-256. |
| K3 | `PASS — 22 z 22` obejrzane wizualnie i opisane; sekcja NIEZWERYFIKOWANE poniżej. |
| K4 | `PASS POMIAROWY — 8 z 8` rozstrzygniętych; wszystkie nadal występują. |
| K5 | Oczekiwane po commicie: wyłącznie ten raport i `MODULE_ACCEPTANCE.md`; sprawdzane ponownie przed push. |

## NIEZWERYFIKOWANE

- `NOT_PROVEN`: tablet, mobile, czytnik ekranu, pełna obsługa klawiaturą i formalny pomiar kontrastu.
- `NOT_PROVEN`: kwoty i liczby dziesiętne, ponieważ nie wystąpiły na `20 z 20` ekranów.
- `NOT_PROVEN`: realne share/export/provider; zgodnie z zakazami nie klikano działań wysyłkowych ani AI.
- `NOT_PROVEN`: akceptacja właściciela oraz G11–G20.
- Przyczyna techniczna pustego renderu prezentacji została zdiagnozowana w sekcji wznowienia; naprawa pozostaje poza zakresem i nie została wykonana.

## Rozłączność

Nie zmieniono żadnego pliku w `src/`, `server/src/`, `server/scripts/`, migracjach, lokalizacjach ani globalnej infrastrukturze testowej. Nie dotknięto 35 zastanych zrzutów Day 61. Helper harnessu i wszystkie binarne/logowe artefakty pozostały poza repo.
