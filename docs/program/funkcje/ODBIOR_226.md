# ODBIOR — Dyżur 226 (Gamma: martwy edytor motywu)

Audytor: sesja adwersaryjna (nadzorca), 2026-09-01. Nie autor zmiany.
Worktree: `/private/tmp/cx-day226-gamma-edytor`, gałąź `codex/day226-gamma-edytor-20260901`,
commity `0aea4829e5` (fix) + `48fc9e1f28` (docs). Marker bazowy `9fb7942a01`.

## WERDYKT: **SCALIĆ**

Rdzeń naprawy (R1 SAVE + R2 READ, jedna flaga `ENABLE_PRESENTATION_TEMPLATE_CUSTOM_SAVE`,
wspólny walidator) jest zaimplementowany poprawnie. Zweryfikowany własnymi rękami audytora
(nie tylko raportem wykonawcy) na realnym Postgresie, przez realny `ApiGateway`, **łącznie
z bajtami wyeksportowanego pliku .pptx** — czyli ogniwo 3 bramki, które sam wykonawca uczciwie
zostawił jako `NIEZWERYFIKOWANE`, zostało domknięte w tym audycie i wypadło pozytywnie dla
`customTemplate`.

## Ocena: A-

Odjęte za: (a) zastany plik kontraktowy pozostaje 3/4 czerwony (poza licencją dyżuru,
pre-istniejący dług — patrz niżej); (b) `colorTemplateId` nie ma żadnego konsumenta wizualnego
w renderze PPTX — pole zapisuje się i wraca poprawnie, ale nic go jeszcze nie używa do
faktycznego rysowania koloru (uczciwie ujawnione przez wykonawcę, zakres dyżuru 227);
(c) nowo odkryty w tym audycie defekt w pre-istniejącej, współdzielonej funkcji
`getTemplateForOrgOrSystem` (patrz sekcja "Nowe znalezisko audytu" — nie wina 226, ale
podważa realistyczność bramki R3 pod wielokrotnym zapisem).

## Odpowiedź wprost: czy praca konsultanta w edytorze motywu PRZESTAŁA znikać?

**Mechanizm — TAK, potwierdzone do bajtów pliku.** Zapis `customTemplate` (kroje + kolory)
przez realny `PUT /api/presentations/templates/:id`, odczyt przez `buildTemplateRuntimeFromRow`
i `resolveApprovedPresentationTemplate`, aż po wygenerowany `.pptx` — parsowanie XML z
archiwum pokazuje niestandardowy `titleFont` i kolory motywu w rzeczywistych bajtach slajdów
(`<a:latin typeface="...">`, `<a:srgbClr val="...">`). Zmutowany kod (usunięcie przekazania
pola) zaczerwienia to natychmiast; przywrócenie — zielone; `git diff` po przywróceniu pusty.

**Zachowanie produkcyjne DZIŚ — NIE, wciąż znika, zgodnie z wymogiem instrukcji.** Flaga
`ENABLE_PRESENTATION_TEMPLATE_CUSTOM_SAVE` jest `default false` i nigdzie w repo nie jest
ustawiana na `true` (`.env*`, `docker-compose*`, CI — grep pusty). Front bezwarunkowo wysyła
`customTemplate` i dostaje `200 OK`; przy fladze OFF backend nadal go po cichu odrzuca. To jest
**zamierzony, wymagany wynik** (CLAUDE.md §7/§9 — nic nowego nie idzie na żywo bez akceptu
właściciela na zrzutach), ale trzeba nazwać wprost: naprawa istnieje w kodzie za flagą, nie w
dzisiejszym zachowaniu produktu, dopóki Piotr nie zobaczy zrzutów i nie zaakceptuje włączenia.

## Czy to naprawa, czy bramka-blokada ("gate" w nazwie commita)?

**NIE jest to zablokowanie działającej funkcji.** Sprawdzone bezpośrednio: kanał
`colorTemplateId`-only SAVE, który działał już PRZED tym dyżurem, pozostaje **poza** nową
flagą i działa identycznie jak przed zmianą (zweryfikowane realnym PUT z samym
`colorTemplateId` przy fladze wyłączonej — `200`, wartość zapisana bez regresji). Nowa flaga
gasi wyłącznie funkcjonalność, która miała 0% pokrycia (zapis `customTemplate` nigdy nie był
odczytywany z `req.body` przed tym dyżurem) — nazwa commita "gate" odnosi się do
Z10/Z11-zgodnego wprowadzenia nowej flagi domyślnie wyłączonej, nie do ukrycia już działającej
funkcji.

## Bramka trzyczłonowa (zapis ⇒ odczyt ⇒ plik) — wykonana własnymi rękami audytora

1. **Zapis.** Realny `PUT` przez `ApiGateway.getInstance().initializeRoutes(app)` (nie goły
   `express()`), z `customTemplate.theme.titleFont` i `colorTemplateId` różnymi od domyślnych.
   SQL readback: `layout_policy_json` zawiera oba pola z podanymi wartościami. PASS.
2. **Odczyt.** `resolveApprovedPresentationTemplate` (ten sam caller co produkcyjny
   `presentationGeneratorService.ts:1526/1715`) na świeżo pobranym wierszu zwraca
   `runtime.customTemplate.theme.titleFont` i `runtime.colorTemplateId` identyczne z zapisanymi.
   PASS.
3. **Plik.** `PptxPipelineService.generateFromUnifiedJson` (ten sam kod co produkcyjny wywołujący
   z `presentationGeneratorService.ts:2361`) wygenerował realny bufor `.pptx`; JSZip + parsowanie
   XML archiwum pokazuje niestandardowy `titleFont` (marker `AUDIT226-COVER-FONT-MARKER`, 3×) i
   kolory motywu (`accentColor` na slajdzie cover, `primaryColor` na slajdzie key_messages — różne
   layouty czytają różne pola tokenów, więc pojedynczy slajd cover nie wystarcza do pokazania
   wszystkich pól: to jest właściwość architektury renderera, nie defekt) w rzeczywistych bajtach
   pliku. **PASS dla `customTemplate`.**
   **`colorTemplateId` → NIE DOCIERA do renderu** — potwierdzone grepem: brak jakiegokolwiek
   odwołania w `PptxPipelineService.ts`/`presentationGeneratorService.ts` poza samym polem
   metadanych. To jest uczciwie ujawniony, świadomie odłożony trzeci kanał (zakres dyżuru 227,
   nie utrata danych — pole jest zapisywane i odczytywalne, po prostu nic go jeszcze wizualnie
   nie konsumuje).

Dowód mutacyjny (Z32) wykonany dwukrotnie niezależnie (audytor + tło): usunięcie scalania
`customTemplate` w handlerze PUT → test bramki i test kontraktowy **czerwone**; przywrócenie
przez `cp` (nie `git stash`) → **zielone**, `git diff --exit-code` = 0.

## Czerwony test kontraktowy — stan po zmianie

`presentationCustomTemplateContract.test.ts`: **1/4 zielony** (dokładnie przypadek
`merges custom contract updates without dropping color-template metadata`, jedyny dotyczący
licencjonowanego handlera PUT). Pozostałe 3 (`delete`, `create/plan`, `governance/transition`)
pozostają czerwone — **potwierdzone jako pre-istniejący dług, nie regresja 226**: `git diff
9fb7942a01..HEAD -- presentations.routes.ts` pokazuje wyłącznie 2 hunki (import + blok PUT
`:1563-1606`), zero zmian w kodzie DELETE/POST-plan/governance-transition. Te trzy endpointy
mierzą fragmenty produktu, których na tym markerze po prostu nie ma w oczekiwanym kształcie —
licencja dyżuru wyraźnie zabraniała ich dotykania. Wykonawca sam to uczciwie opisał w raporcie
(`Stan: PARTIAL`) zamiast ogłosić fałszywe „zielono".

## Nowe znalezisko audytu (poza licencją obu dyżurów, do osobnego zgłoszenia)

Przy próbie zmierzenia bramki pod **wielokrotnym zapisem** (dwa kolejne PUT na tym samym
szablonie — scenariusz normalny dla konsultanta wracającego do edycji) odkryto: funkcja
`getTemplateForOrgOrSystem` (współdzielona, pre-istniejąca, nietykalna dla obu dyżurów) filtruje
`WHERE ... provenance_status = 'approved'`. Kolumna `provenance_status` domyślnie ma wartość
`'unknown'` (potwierdzone w schemacie: `default 'unknown'::text`) — to pole dotyczy zaufania do
pochodzenia treści, NIE stanu cyklu życia szablonu (`lifecycle_state`, osobna kolumna). Efekt: dla
zwykłego, świeżo utworzonego szablonu draftowego `existing` w handlerze PUT jest zawsze `null`,
więc logika "zachowaj poprzednie pola przy scalaniu" nigdy się nie uruchamia — **drugi PUT z
samym `customTemplate` (bez powtórzenia `colorTemplateId`) nadpisuje `layout_policy_json` i
gubi `colorTemplateId` z pierwszego zapisu.** Zweryfikowane bezpośrednio (dwa sekwencyjne PUT na
realnym Postgresie): `colorTemplateId` z pierwszego zapisu znika po drugim.

**To nie jest defekt 226 ani 228** — plik i funkcja są poza licencją obu dyżurów, błąd
istniał już na markerze bazowym. **Nie jest to też dziś aktywnie osiągalne przez UI**: front
(`PresentationTemplateArchitectView.tsx:506-518`, `handleSave()`) zawsze wysyła OBA pola
(`colorTemplateId` i `customTemplate`) razem, z pełnego stanu edytora w pamięci — nie robi
zapisów częściowych. Ryzyko jest realne wyłącznie dla przyszłego klienta API robiącego zapis
częściowy (np. osobny endpoint/automatyzacja ustawiająca tylko jedno pole). **Rekomendacja:
osobny, krótki dyżur naprawiający filtr `provenance_status` w `getTemplateForOrgOrSystem` (albo
zamianę na `lifecycle_state`-owy odpowiednik) — nie blokuje scalenia 226, ale powinien wejść
przed jakimkolwiek przyszłym partial-update API na tym endpointzie.**

## Kolizja z dyżurem 228

Oba dyżury edytują ten sam blok (`presentations.routes.ts` PUT handler, destrukturyzacja +
warunek scalania `layoutPolicyJson`; `presentationTemplateRuntimeService.ts`
`buildTemplateRuntimeFromRow` + interfejs). Gałęzie **nie są wzajemnie scalone** (obie startują
z tego samego markera 9fb7942a01, każda zna tylko swoje pole). Wzorzec scalania obu autorów
używa spreadu `...currentLayoutPolicy` i warunkowych fragmentów — żadna strona nie robi pełnej
podmiany obiektu, więc przyszłe scalenie trzech pól (`colorTemplateId` + `customTemplate` +
`imageStylePrompt`) będzie zwykłym, bezpiecznym konfliktem tekstowym do ręcznego połączenia
trzech warunków w jeden, nie utratą danych. **228 znalazło i naprawiło we własnym zakresie
osobny defekt** (`JSON.parse` bez sprawdzenia typu `existing.layout_policy_json`) — przy
scalaniu gałęzi warto przenieść tę poprawkę (typeof-guard) do wspólnego kodu razem z trzecim
polem.

## FIX-y przed scaleniem: brak blokujących

Nic w zakresie R1/R2/R3 nie wymaga poprawki. Do zrobienia PO scaleniu, nie przed:
1. Zrzuty UI edytora (×2 motywy) do akceptu Piotra — dziś brak (`EVIDENCE_MISSING`, zgodne z
   §7 CLAUDE.md, poza zakresem backendowego audytu).
2. Osobny dyżur: `colorTemplateId` bez konsumenta w renderze PPTX (jeśli ma realnie wpływać na
   wygląd eksportu) — zakres dyżuru 227.
3. Osobny, krótki dyżur: filtr `provenance_status` w `getTemplateForOrgOrSystem` (patrz wyżej).

## Zasięg dowodu

Testy uruchomione osobiście przeciw realnemu Postgresowi (`pgvector/pgvector:pg16`, kontenery
własne poza zarezerwowanymi zakresami portów, posprzątane `docker rm -f -v`), przez realny
`ApiGateway`, z `--retry=0` i pełnym kompletem zmiennych env w jednej linii (`DB_TYPE=postgres`
nadpisane i zweryfikowane). Niezależny sub-agent audytorski powtórzył pomiar z tym samym
wynikiem (SCALIĆ, ocena A-, ta sama lista ustaleń) — dwie niezależne ścieżki dowodowe zbieżne.
