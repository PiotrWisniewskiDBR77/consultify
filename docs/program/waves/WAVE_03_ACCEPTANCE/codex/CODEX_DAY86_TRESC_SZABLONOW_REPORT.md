# CODEX DAY 86 — DLACZEGO TRYB SZABLONOWY PRODUKUJE PLACEHOLDERY

Data pomiaru: 2026-08-29  
Marker: `4516ae944b14f5ae3cfd49cc5290a838a7a68e46`  
Gałąź: `codex/day86-tresc-szablonow-20260829`  
Zakres zmian: wyłącznie ten raport; kod produktu, testy i konfiguracja: **0 zmian**.

## Werdykt

**Bogaty szablon nie rozwiązuje pustej treści. Przyczyna jest inna w Wordzie i PPT.**

- **PPT `from-template` jest z definicji kopią struktury bez generowania treści.** Trasa jawnie pomija AI, kopiuje `outline_json`, nie przekazuje do mappera żadnego `brief`, a pola naszego bogatego szablonu `hint` i `archetype` nie stają się treścią. Potem projekcja decka tworzy fallback `Key point ${index + 1}` i layout pokazuje `Signal / Implication / Action` z powtórzonym tytułem.
- **Word ma osobną, wbudowaną warstwę generowania prozy, ale jest ona opt-in przez `useLlm`.** Przy `useLlm=false` deterministyczny builder celowo produkuje stuby. UI ustawia `useLlm=true` domyślnie, lecz dyżur nie wykonywał płatnego wywołania Word LLM; nie wolno więc twierdzić, że bieżąca konfiguracja dostawcy skutecznie wypełni te bloki.
- **Tryb „od zera” jest bogatszy strukturalnie, ale też nie jest dobrym wynikiem.** Word przeniósł jawny brief do `1 z 8` bloków; `7 z 8` bloków zostało stanami „Treść usunięta”. PPT utworzył zróżnicowany deck `10` slajdów modelu / `11` stron eksportu, bez `Key point 2`, ale część tabel pozostała pusta, a przebieg jawnie zgłosił brak `decision evidence or recommendation source`.

Wniosek właścicielski: mechanika eksportu nie jest problemem. **PPT template-mode nie ma ogniwa content-generation w ogóle; Word template-mode ma ogniwo, ale wynik zależy od `useLlm`, dostawcy i rzeczywistego source-packu.**

## H1–H4 — `4 z 4` rozstrzygnięte

| Hipoteza | Werdykt | Dowód |
| --- | --- | --- |
| H1 — puste szablony były przyczyną | **OBALONA** | Bogaty Word zachował `4 z 4` nagłówków i purpose, ale miał `0 z 4` merytorycznych bloków. Bogaty PPT miał `4 z 4` slajdów i tytułów, ale `0 z 4` opisów `hint` trafiło do widocznej treści; wszystkie `4 z 4` slajdy miały fallback `Key point 2` / `Signal…`. |
| H2 — tryb szablonowy wcale nie woła modelu | **OBALONA jako hipoteza wspólna dla obu formatów** | PPT: **potwierdzona lokalnie** — `0 z 1` żądań B.3 weszło do modelu, a komentarz kontraktowy trasy mówi `skips the AI pipeline entirely` (`presentations.routes.ts:2253-2274`). Word: **obalona kontraktem produkcyjnym** — UI default `useLlm=true` (`DocumentStudioIntakeForm.tsx:168-171`), a `materializeDocumentArtifact` woła `generateBlockProse` przy `useLlm` (`documentStudioService.ts:1009-1018`). B.3 z jawnym `useLlm=false` wykazał `0 z 1` wywołań, więc nie stanowi dowodu skutecznego LLM Word. |
| H3 — model jest wołany, lecz wejście jest puste | **OBALONA jako wspólna przyczyna obu generatorów** | PPT template-mode nie woła modelu, więc H3 nie może wyjaśniać jego pustki. Wordowy prompt ma jawny intake i listę `sourceRefs` (`documentBlockProseGenerator.ts:237-265`), a B.3 miał `1 z 1` automatyczny ref `organization_context`; problemem badanego przebiegu było `useLlm=false`, nie puste wejście modelu. Skuteczność Word z realnym dostawcą: **NOT_PROVEN**, bo płatnego wywołania nie uruchomiono. |
| H4 — template-mode tylko wypełnia pola, a treść ma pochodzić z osobnego kroku | **OBALONA jako kontrakt wspólny; POTWIERDZONA dla PPT, OBALONA dla Word** | PPT: mapper jest deterministyczny, route przekazuje tylko `resolved.outlineBlueprint`, mimo że mapper ma opcjonalny `brief` (`presentationTemplateRuntimeService.ts:1008-1028`, caller `presentations.routes.ts:2315-2318`). Word: generacja prozy nie jest osobnym ręcznym krokiem — jest w tym samym `materializeDocumentArtifact` i uruchamia się przez `useLlm=true` (`documentStudioService.ts:1009-1018`). |

## B.1 — pochodzenie tekstów

### Word

- `server/src/services/documentStudio/documentContentGenerator.ts:497` — stała deterministycznego buildera: `This section is awaiting content — key message...`.
- `server/src/services/documentStudio/documentContentGenerator.ts:583` — stały prefiks `SECTION_STUB_PREFIX`.
- W badanym Mode 3 `buildDocumentSchemaPremium` przy standardowym/off tierze wraca do deterministycznego buildera; dopiero `generateBlockProse` może podmienić prose blocks (`documentStudioService.ts:943-954`, `:1009-1018`).

Klasyfikacja: **stała/fallback deterministyczny**, nie wartość szablonu i nie dowód nieudanego wywołania. W B.3 wywołania nie było (`useLlm=false`).

### PPT

- `server/src/services/presentationDeckDocumentService.ts:1103-1113` — fallback tytułu bloku: `Key point ${index + 1}`.
- `server/src/services/presentationDeckDocumentService.ts:1116-1164` — budowa `messages` z bloków.
- `server/src/services/presentationDeckDocumentService.ts:1191-1228` — spłaszczenie kart do `key_messages`; `Internal decision team` jest domyślnym audience-facing client na `:1222`.
- `Signal / Implication / Action` jest prezentacyjną formą layoutu `key_messages` dla opisu, nie treścią szablonu i nie fallbackiem po błędzie modelu.

Klasyfikacja: **stałe/fallback projekcji render modelu**, uruchomione po deterministycznym kopiowaniu struktury; nie wartość szablonu i nie skutek nieudanego LLM.

## B.2 — ścieżka treści od końca

### Word

`DOCX` ← schema renderer ← `provisionalSchema` ← grounding boundary ← opcjonalne `generateBlockProse` ← `buildDocumentSchemaPremium`/deterministyczny builder ← `outlineFromTemplate`.

W B.3:

- `4 z 4` sekcji miało źródło struktury: tytuł i `purpose` z szablonu;
- `0 z 4` sekcji miało merytoryczny blok treści;
- `3 z 4` miało literalny `awaiting content`, `1 z 4` został zamieniony przez grounding na „Treść usunięta”;
- `0 z 1` żądań generacji wołało model (`useLlm=false`).

### PPT

`PPTX` ← `deckDocumentToUnifiedJson` ← `flattenCardToUnifiedSlide` ← `buildDeckDocumentFromStructuredSlides` ← `mapOutlineBlueprintToDeckSlides(resolved.outlineBlueprint)` ← `presentation_templates.outline_json`.

W B.3:

- `4 z 4` slajdów miało źródło struktury (tytuł szablonu);
- `0 z 4` slajdów przeniosło `hint` jako widoczną treść;
- `4 z 4` slajdów miało fallback `Key point 2` oraz powtórzenie tytułu jako `Signal / Implication / Action`;
- `0 z 1` żądań generacji wołało model.

## B.3 — najtańszy eksperyment: bogaty szablon

Temat obu formatów: odbudowa retencji B2B; cztery jawne części z liczbami `91% → 84%`, przyczynami, planem 90 dni i KPI.

Realny przebieg przez `ApiGateway`, podpisany JWT i lokalny PostgreSQL `127.0.0.1:5958/cx_day86`:

```text
DOC_TEMPLATE_CREATE_STATUS 201
DOC_GENERATE_STATUS 200
DOC_EXPORT_STATUS 200
DECK_TEMPLATE_CREATE_STATUS 201
DECK_PROMOTION_STATUS 201
DECK_GENERATE_STATUS 201
DECK_EXPORT_STATUS 200
```

Oględziny renderów LibreOffice:

- Word: 2 strony. Sekcje i ich purpose są widoczne, ale właściwa treść to `3 z 4` angielskie stuby i `1 z 4` stan grounding.
- PPT: 4 strony. Wszystkie zachowują tytuły, ale każda pokazuje `Key point 2` i generyczne `Signal / Implication / Action`; stopka `Internal decision team`.

Artefakty:

| Plik | SHA-256 |
| --- | --- |
| `/private/tmp/cx-day86-artefakty/day86-rich-template-decoded.docx` | `1cf8bb61d37092a52588a9a86e1e81cc5da8fdd27db87620f4e8c8b3f61b6654` |
| `/private/tmp/cx-day86-artefakty/day86-rich-template.pptx` | `e96e8d7ae806815420f513bab3c630bed9db9f4fcdd8fe8c9d4cc62189ba2918` |
| `/private/tmp/cx-day86-artefakty/day86-rich-template-decoded.pdf` | `4950b06a2cbed7bdc7fa5a77a8f3953851e820a97dceb56ca8cc3497daff33b6` |
| `/private/tmp/cx-day86-artefakty/day86-rich-template.pdf` | `eb16b019e6574292afffaa89407183a87e757c38ec791bb0978e28aeb4bcc553` |
| `/private/tmp/cx-day86-artefakty/day86-rich-harness-attempt2.log` | `dd4fb3bf261366d5faf8d1c5d8a1070bac56615535bc12f56d479f9888a00e77` |

## B.4 — tryb „od zera”

Realny przebieg, ten sam temat i ta sama baza:

```text
ZERO_DOC_GENERATE_STATUS 200
ZERO_DOC_EXPORT_STATUS 200
ZERO_DECK_OUTLINE_STATUS 200
ZERO_DECK_GENERATE_STATUS 200
ZERO_DECK_EXPORT_STATUS 200
```

Word od zera: 3 strony, `7` sekcji / `8` bloków; `1 z 8` bloków zawiera pełny jawny brief, `7 z 8` to „Treść usunięta”. Jest nieco lepiej niż Mode 3 (`1 z 8` vs `0 z 4` merytorycznych bloków), ale nadal nie jest to dobry dokument.

PPT od zera: model danych ma `10` slajdów, eksport ma `11` stron (dodatkowy closing). Ma różne intencje/layouty i realne zdania, nie ma `Key point 2`. Jednocześnie część slajdów ma puste tabele lub generyczne fallbacki; odpowiedź zawiera dwa warningi o braku `decision evidence or recommendation source`. To **bogatszy, lecz nadal nieakceptowalny** wynik.

Przebieg PPT wszedł do Narrative Engine/ModelRouter, ale dostawca nie był skonfigurowany; log zawiera `23` łączne trafienia czterech wzorców diagnostycznych (`Selecting model`, `LLM call failed`, `LLMServiceMetrics failed`, `DeckConclusion LLM error`). Nie nastąpiło płatne ani zdalne wywołanie; kod użył deterministycznych fallbacków. Przebiegu nie powtarzano.

Artefakty:

| Plik | SHA-256 |
| --- | --- |
| `/private/tmp/cx-day86-artefakty/day86-from-zero.docx` | `0dc99ae21c2b1b0a872174a96cc55f109453438b9826402e01548687987fb155` |
| `/private/tmp/cx-day86-artefakty/day86-from-zero.pptx` | `94f4f1f0fe424e77127a3a40cc694c59dc74bcaff6f1eee7066492da12b2f564` |
| `/private/tmp/cx-day86-artefakty/from-zero-doc/day86-from-zero.pdf` | `1e988fadccdf9fe5e0713f1ef46d410f59f010d53f203a1c59320932025f5707` |
| `/private/tmp/cx-day86-artefakty/day86-from-zero.pdf` (PPT) | `4c7e8d48dcefacb4d94cdf95f60a9e6ab2dec6e55a9e69c0c1b41e6aba5b2daf` |
| `/private/tmp/cx-day86-artefakty/day86-from-zero-harness.log` | `90826eb0ecde1bd80cd79d36391604ac08a53a20b713d41ccf022e175d999584` |

## Historyczne decki

Samodzielny pomiar: repo zawiera **23 pliki PPTX z mianownika 23** w `docs/qa/deliverables/runs/`.

`2026-06-28-DECK-FINAL.pptx` pojawił się w commitcie `d4409b3dd4` jako binarny artefakt M17 (`finalny deck 13 slajdów + screeny`). Poprzednik `2026-06-28-DECK-PERFEKCJA-W7.pptx` pojawił się w `168c7c86e2` równolegle ze zmianami 13 layoutów/composites i testami renderera. To dowodzi użycia silnika `PptxPipelineService`/kontrolowanego harnessu M17/W7, nie dzisiejszej trasy `POST /decks/from-template`.

Dokładnego źródłowego UnifiedJSON, golden promptu i source-packu dla `DECK-FINAL` w repo nie ma (zgodne także z raportem Day 79). Dlatego dokładna odpowiedź „którą trasą HTTP powstał ten konkretny binarny plik” ma stan **EVIDENCE_MISSING / NIE USTALONO**. Nie wolno utożsamiać ścieżki renderera z dzisiejszą ścieżką tworzenia treści.

## Środowisko, Z30 i pułapki Z33

- Porty `5958` i `4800`: wolne przed startem.
- Kontener: wyłącznie `cx-day86-pg`, `pgvector/pgvector:pg16`, `127.0.0.1:5958/cx_day86`.
- Pierwszy migrator: pełny łańcuch; readback `schema_migrations`: **863 z 863** wierszy obecnych. Drugi migrator: `Applying migrations: 0`, `Postgres migrations complete`.
- Każdy harness miał w tej samej linii: `RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres NODE_ENV=test ENABLE_V8_GLOBAL=true ENABLE_TEST_AUTH_BYPASS=false RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce DATABASE_URL=... JWT_SECRET=...`.
- Log potwierdził `ENV_DB_TYPE postgres`, `ENV_MOCK_DB false`, `DB_IDENTITY ... 127.0.0.1:5958/cx_day86`.
- Pułapki (a)–(d) wyłączone kompletem env i realnym JWT. Pułapka (e): B.3 nie wołał modelu; B.4 PPT wszedł do warstwy modelowej, ale brak dostawcy zakończył się lokalnym fallbackiem; nie ponawiano przebiegu.
- Nie uruchamiano `server/src/index.ts`, testów Vitest ani testowych retry. Harness był jednorazowym skryptem poza repo i montował realny `ApiGateway`.

**Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Baza tego dyżuru nie zawiera wierszy konfiguracji SMTP. Nie uruchomiłem `server/src/index.ts` ani żadnego drenażu outboxu. Żaden e-mail ani zaproszenie kalendarzowe nie zostało wysłane.**

Dowody Z30: `BRAK ZMIENNYCH POCZTY`; zapytanie `settings WHERE key LIKE 'smtp%'` zwróciło `(0 rows)`; grep drenów w `server/src/Gateway.ts` zwrócił `0` trafień.

## §0.1 — wynik komend (2) i (7) dosłownie

Komenda (2):

```text
07f87685b0 docs(instrukcje): dyzur 86 — dlaczego tryb szablonowy wstawia placeholdery zamiast tresci
4516ae944b docs(ledger): DEC-312 — korekta DeckBuildera, naprawa 81 zachowana, C.3 zmierzone
da0360865c merge: dyzur 69 korekta DeckBuildera — 35/35 plikow, naprawa 81 zachowana
c8883f4704 docs: DEC-311 — petla szablon->PPTX domknieta, GEN-4 FAIL -> PARTIAL
1b8040df22 merge: dyzur 83 PASS — petla szablon->PPTX domknieta, eksport 200
9cea4f8c4e docs: DEC-310 sprostowanie — kart jest 61 nie 7; instrukcja 84 poprawiona u zrodla
e251a13207 docs(day83): record first pushed commit
df3756b087 fix(pptx): persist template deck document before export
4546c7ec3e docs(instrukcje): dyzur 84 (karty N odbior graficzny) i 85 (Organizacja pakiet odbioru)
659afb1b90 fix(i18n): domknij polski DeckBuilder
062a26fe4a docs(ledger): DEC-309 — kart N jest 7, nie 40; przeciecie z *Card*.tsx = 0
4df2bb0b89 merge: dyzur 82 — inwentarz kart N: 7 kanonicznych, nie 40
fa3e42f1d1 docs(day82): inventory canonical N cards
65d0f265f7 docs(instrukcje): dyzur 82 (inwentarz kart N) i 83 (eksport PPTX 422)
1e44994196 docs(ledger): DEC-305..308 — Materialy odblokowane, cykl szablonu, grafika 12/18, C.2 domkniete
aa35f13464 merge: dyzur 79 — 6/6 przyczyn, rubryka 7/18 -> 12/18
34b103fc33 merge: dyzur 80 — promocja lifecycle, 403 nadal dla draft
958c09468a merge: dyzur 81 — canvas 487x0 -> 487x584, jedna linia
f3afccb171 merge: dyzur 69 C.2 domkniete — klasa A 1249/1249
2484941144 docs(ledger): DEC-304 — bramki sa wylacznie proceduralne, zadna nie dotyczy tresci
9b49c48ad2 fix(i18n): domknij materialy C2
53ce7de28a docs(materials): record day81 cleanup proof
39e51822d0 docs(day79): report PPT layout repair evidence
241f6c5d45 docs(day80): record lifecycle evidence and residual PPTX stop
f994cdf2d8 docs: DEC-303 — bramki GEN-1..GEN-5 w Materialach; plan nie rozroznial generatorow
MARKER OK
```

Krok (7):

```text
4516ae944b14f5ae3cfd49cc5290a838a7a68e46
```

`git status --short | head -3` nie wypisał żadnej linii.

Tip uciekł o jeden commit `07f87685b0`; różnica to wyłącznie `INSTRUKCJA_DYZUR_86_TRESC_SZABLONOW.md`. Praca zaczęła się dokładnie z markera.

## Korekty wobec instrukcji

1. Instrukcja mówi w §A o `23` plikach PPTX. Własny pomiar potwierdził `23 z 23` plików w mianowniku `find ... -name '*.pptx'`.
2. W3 z §A używa `head`, więc literalnie zwróciło dziesięć niepowiązanych trafień `Implication` z `my-work` i nie pokazało badanego placeholdera. Zastosowano precyzyjny grep bez obcięcia; `Key point` pochodzi z `presentationDeckDocumentService.ts:1113`.
3. Instrukcja odwołuje się do „BLOKU 0” i „tabeli licencji”, ale nie zawiera ani osobnej sekcji BLOK 0, ani tabeli licencji. Bezpieczna interpretacja: §0.2c jako blok bazy; zero zapisów w kodzie; jedyny plik repo to raport.
4. B.3 definiuje „bogatszy dokument” jako potwierdzenie H1. Wynik jest dwuwarstwowy: struktura jest bogatsza (`4 z 4` sekcji/slajdów), lecz właściwa treść pozostaje pusta (`0 z 4`). Dla hipotezy „puste szablony były przyczyną pustej treści” wiążący jest drugi mianownik, dlatego H1 jest obalona.
5. B.4 PPT wszedł do ModelRoutera mimo braku zamiaru wywołania modelu. Żaden provider/API key nie był dostępny i nie nastąpiło zdalne/płatne wywołanie; kod wykonał lokalne fallbacki. To wynik diagnostyczny, nie naprawa; przebiegu nie powtórzono.

## K1–K7

- K1: `4 z 4` hipotez rozstrzygnięte binarnie na poziomie wspólnej przyczyny; różnice formatowe zapisane jawnie.
- K2: `2 z 2` rodziny placeholderów zlokalizowane i sklasyfikowane.
- K3: `2 z 2` formatów B.3 wygenerowane, wyrenderowane i obejrzane; SHA-256 podane.
- K4: `2 z 2` formatów porównane z trybem od zera.
- K5: historyczne decki powiązano z rundą M17/W7 i rendererem; dokładna trasa HTTP: `EVIDENCE_MISSING`.
- K6: wszystkie liczby wynikowe mają mianownik.
- K7: końcowy `git diff --name-only 4516ae944b14f5ae3cfd49cc5290a838a7a68e46..HEAD` ma zawierać wyłącznie ten raport.

**ZERO NAPRAW.**
