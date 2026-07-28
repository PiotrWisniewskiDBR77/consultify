# PROMPT DLA NASTĘPCY — wklej to jako pierwszą wiadomość nowej sesji

```
Jestem CTO/wykonawcą technicznym Consultify — AI-native systemu realizacji
doradztwa (nie generyczny SaaS). Właściciel to Piotr: CEO, strona
biznesowa/produktowa, nie-koder. Komunikuj się z nim po polsku, krótko,
obrazkami/zrzutami gdy to ekran — on woli klikać niż oglądać opisy. Decyzje
techniczne (migracje, flagi, architektura) podejmuję sam i raportuję z
uzasadnieniem, nie odsyłam ich do niego — chyba że dotyczą wyglądu na demo
(patrz zasady niżej) albo są świadomie poza moim mandatem.

═══════════════════════════════════════════════════════════════════════════
KONTEKST: gdzie jestem i co się właśnie stało (przeczytaj w całości, to nie
jest nowy temat — to kontynuacja zaawansowanej, częściowo wdrożonej pracy)
═══════════════════════════════════════════════════════════════════════════

Repo: consultify. Główny checkout lokalny bywa setki/tysiące commitów za
`origin/demo` (branch `oxford/oc2-merge` to stary punkt odniesienia) —
`origin/demo` na Railway (demo.consultify.ai) jest ŚWIĘTĄ, aktywną bazą do
której się wdraża, NIE lokalny checkout. Zawsze pracuj w świeżym
`git worktree` odgałęzionym od `origin/demo` (fetch najpierw), nigdy nie
force-pushuj, nigdy nie rebase'uj na demo. Demo jest ruchomym celem — inne
sesje pchają na nie równolegle w tym samym czasie co ty; rób
`git fetch origin demo` + `git merge-base --is-ancestor origin/demo HEAD`
TUŻ PRZED każdym pushem (pre-flight), nie tylko raz na początku.

Moduł, nad którym pracowałem: **Materiały** — trzy równorzędne formaty
(Dokument/Prezentacja/Arkusz), każdy może powstać Czysto / Z AI / Z szablonu.
Był w stanie „strasznego rozpierdziela": Piotr nawet nie mógł wejść testować,
Biblioteka szablonów pokazywała nie to co trzeba, wybór „Z szablonu" gubił
się po drodze i generator dostawał sam opis tekstowy zamiast struktury.

Praca poszła w TRZECH falach tego samego dnia (2026-07-24):

── FALA 1 (rano) — wejście do Materiałów ──────────────────────────────────
Zbudowałem wspólny launcher „Dodaj": KROK1 wybór formatu → KROK2 wybór trybu
(Czysto=ręczny pusty start bez AI / Z AI=brief→generacja / Z
szablonu=wybór+dostosowanie), wzorowany na już istniejącym analogicznym
komponencie w module ID. Doszedł most `document_studio_templates`→Biblioteka
i endpointy klonowania Word/Excel. **Wdrożone na demo, commit `876ca16679`.**
Fala 2 wykazała, że ten most karmił martwą, odpiętą ścieżkę
(`deliverableTemplateService`/`OutputsLauncherModal`) — realną widoczność
naprawiła dopiero Fala 3. Sam launcher (Czysto/Z AI) jest żywy i działa.

── FALA 2 — AUDYT R0 (wyłącznie czytanie, ZERO zmian kodu) ────────────────
Piotr zlecił: „najpierw prawda, nie kolejny generator". Wykonałem pełny
audyt: 5 równoległych agentów-czytelników kodu na worktree = HEAD demo +
bezpośrednie SELECT-only zapytania do żywej bazy demo (host trolley, NIGDY
prod centerbeam). Wynik istnieje TYLKO w transkrypcie tamtej sesji Claude
(nie zapisany jako plik w repo) — poniżej streszczenie wszystkiego co ma
znaczenie na przyszłość:

  DOKUMENT: rdzeń działa naprawdę (tabela `wave5_artifacts`, endpoint
  `POST /document-studio/generate/stream`, eksport .docx realny nie
  markdown-owy). Tryb `blank` to obejście przez `generate` z
  `useLlm:false`, nie osobny handler. `from_template` już wtedy działał
  realnie — ALE tylko przez własne wejście `/document-studio?entry=template`,
  nigdy przez wspólny czat/KIMI.

  PREZENTACJA: `blank` = prawdziwie pusty `POST /presentations/decks`.
  `from_template` NIE kopiuje `outline_json` do kart — tylko wrzuca opis do
  promptu AI. Istnieje osobny, równoległy silnik `/presentations/wizard`
  (realne ryzyko split-brain, dwie ścieżki generacji do tej samej tabeli).

  ARKUSZ: 7 „modeli parametrycznych" (`WORKBOOK_TEMPLATES`) to kod, NIE
  rekordy bazy — szablonów tworzonych przez użytkownika dla Excela NIE MA
  w ogóle. Zero realnej edycji komórek w aplikacji (tylko podgląd
  read-only). Przy braku znalezionego workbooka jest CICHY fallback
  przekierowujący do Table Studio — użytkownik nie wie, że wylądował w
  innym silniku.

  ★★★ NAJWAŻNIEJSZE Z CAŁEGO AUDYTU (Template Library, R0.2): widoczna
  zakładka Biblioteka w UI czyta z tabeli `v8_artifact_origin_links` przez
  `GET /api/artifacts?artifactFamily=template` (hook `useTemplates()` w
  `useRapData.ts`) — kompletnie INNA ścieżka niż
  `deliverableTemplateService`/`GET /api/deliverables/templates`, która
  karmi wyłącznie martwy, odpięty komponent `OutputsLauncherModal`.
  Backfill wypełniający ten widoczny indeks pokrywał TYLKO formaty
  report+presentation — `document_studio_templates` (44 zatwierdzone
  szablony Worda) i sheet były NIEWIDOCZNE mimo że istniały. Do tego:
  wybrany w Bibliotece `templateId` był PO CICHU PORZUCANY w handlerze
  `POST /api/artifact-runs/from-chat` — serwer w ogóle nie czytał tego pola
  z body żądania, więc generator dostawał wyłącznie tekstowy opis, nigdy
  strukturę szablonu (sekcje/bloki).

── FALA 3 — R1: kontrakt + naprawa „Z szablonu" (zawężona przez architekta) ─
Architekt (osobna sesja, model Codex — w tym programie rozdzielone role:
architekt projektuje i akceptuje, ja/wykonawca implementuje) przeczytał
audyt R0 i wydał dokument decyzji z sześcioma rozstrzygnięciami D1-D6 oraz,
po mojej propozycji kontraktu technicznego, sekcją „Odbiór propozycji R1.0"
z SIEDMIOMA obowiązkowymi korektami i SZEŚCIOMA punktami Definition-of-Done.
To jest kontrakt jakości którym mierzysz KAŻDĄ kolejną zmianę w tym
programie — treść poniżej, ale PRZECZYTAJ TEŻ oryginalny plik w repo (ścieżka
niżej), bo mogą tam być kolejne dopiski od tamtej pory.

  DECYZJE D1-D6:
  D1 — `document_studio_templates` jest kanonicznym źródłem szablonów
       dokumentu. `report_builder_templates` zostaje jako LEGACY (nie
       usuwamy nagle, może mieć nadal używane dane) — biblioteka pokazuje
       OBA źródła przez adapter, z jawnym origin i stanem legacy.
  D2 — `v8_artifact_origin_links` to INDEKS/read-model biblioteki, NIE
       źródło prawdy o szablonie. Kanoniczna treść blueprintu zawsze żyje
       w rejestrze konkretnego formatu. Indeks ma: wskazywać origin
       runtime+canonical id, odrzucać/oznaczać osierocone linki, nie
       maskować braków domyślnym statusem/scope bez oznaczenia.
       `deliverableTemplateService`+`OutputsLauncherModal` = legacy, NIE
       kasować w R1, ale nie są podstawą nowej biblioteki/launchera.
  D3 — ★ NAJWAŻNIEJSZY bug funkcjonalny i priorytet R1: przepływ musi
       przekazać `templateArtifactId`/canoniczne id do serwera; serwer
       sprawdza dostęp, rozwiązuje blueprint z rejestru kanonicznego,
       zasila nim generator. Sam opis szablonu NIE jest substytutem
       blueprintu. Typowany `CreationIntent` + adapter per format, nie
       jeden nieustrukturyzowany prompt na trzy formaty.
  D4 — 7 modeli Excela nazywamy „workbook models", NIE „szablony
       użytkownika". Nie pokazujemy „utwórz szablon arkusza"/„na bazie
       istniejącego" dla Excela dopóki nie istnieje trwały workbook
       template registry z prawdziwym blueprintem. Osobny pakiet po R1.
  D5 — `tp_base_templates` NIE są szablonami Excela, ZAKAZ backfillowania
       ich do Biblioteki jako arkuszy. W R1 zakładka Arkusze pokazuje co
       najwyżej systemowe modele workbooków (jeśli adapter da prawdziwy
       blueprint) albo uczciwy pusty stan.
  D6 — `deckArchitectFlag` ma domyślnie być OFF (był błędnie ON — bug
       kopiuj-wklej vs `workbookTemplatesFlag` który poprawnie miał
       `?false`). Zmiana WIDOCZNOŚCI (flaga, menu) to R2, PO R1 — w R1
       naprawiamy dane i kontrakt, bez zmiany głównego UX.

  SKORYGOWANA KOLEJNOŚĆ (§3 dokumentu architekta): R1.0=testy kontraktu
  najpierw (przed zmianami produkcyjnymi) → R1.1=solidny indeks (adapter
  document_studio_templates, walidacja istnienia źródła, oznaczanie
  source/legacy, naprawa osieroconych KONTROLOWANĄ migracją, zakaz
  tp_base_templates jako sheet) → R1.2=end-to-end „Z szablonu" zaczynając
  od DOKUMENTU jako formatu referencyjnego, deck i workbook jako KOLEJNE
  ADAPTERY nie równoległa implementacja → R1.3=uczciwe ograniczenie
  arkuszy (rename na Workbook models).

  7 OBOWIĄZKOWYCH KOREKT (§6 „Odbiór propozycji R1.0", dosłownie):
  1. Pierwszy pionowy slice R1.1/R1.2 obejmuje TYLKO dokument. Deck =
     adapter następnej iteracji. Workbook = unsupported do prawdziwego
     registry.
  2. `TemplateRef` NIE MOŻE być luźnym obiektem z dwoma opcjonalnymi
     identyfikatorami. Dla wejścia z biblioteki wymagany `templateArtifactId`.
     Bezpośredni `canonicalTemplateId` to osobny, WEWNĘTRZNY wariant,
     zawsze wymaga `originRuntime` i serwerowej walidacji dostępu.
  3. Indeks NIE przechowuje blueprintu jako źródła generacji. Przechowuje
     tylko identyfikatory i niewielkie summary do widoku; resolver zawsze
     czyta aktualny blueprint z rejestru.
  4. Scope: wspólny słownik `system|organization|personal|unknown`. Zakaz
     `application` bez uzgodnienia z istniejącym modelem uprawnień.
  5. R1 NIE usuwa osieroconych linków z bazy. Wykrywa, nie pokazuje jako
     gotowe do użycia, mierzy ich liczbę. Czyszczenie danych = osobna,
     późniejsza decyzja.
  6. Testy NIE mogą zależeć od żywej bazy demo — deterministyczne fixtures
     odpowiadające REALNEMU kształtowi rekordów. Opcjonalny test
     integracyjny stagingowy = dodatkowa bramka, nie substytut.
  7. Zmiana `artifact-runs/from-chat` NIE wchodzi do slice'u dokumentu —
     dokument ma bezpieczniejszą ścieżkę przez Mode 3. Zostaje osobnym,
     NIEZAIMPLEMENTOWANYM projektem adaptera deckowego.

  6 PUNKTÓW SKORYGOWANEGO DoD:
  1. W Bibliotece pojawia się zatwierdzony dokument z
     `document_studio_templates` z jawnym origin.
  2. Wpis osierocony nie jest dostępny do użycia, nie uruchamia cichego
     fallbacku.
  3. Kliknięcie „Użyj wzorca" dla dokumentu otwiera Document Studio Mode 3
     z KONKRETNYM szablonem.
  4. Wynikowy draft ma sekcje ZGODNE z `sectionBlueprint` tego rekordu.
  5. Legacy report pozostaje widoczny TYLKO z oznaczeniem legacy, bez
     zmiany jego generacji.
  6. Table Studio, generacja workbooka, sidebar, Menu 2 NIE są zmieniane.

  CO ZAIMPLEMENTOWAŁEM (14 non-merge commitów, chronologicznie — hashe
  mogą się przesunąć jeśli ktoś rebase'ował, sprawdź `git log` po
  wiadomościach commitów jeśli hash nie istnieje):
  19b8111629 — migracja CHECK constraint `origin_runtime` +
               `document_template` jako nowa dozwolona wartość, enum TS.
  21f1a34a50 — adapter backfillujący `document_studio_templates` do
               indeksu + funkcja pomiaru osieroconych linków
               (`countOrphanedTemplateLinks`, SELECT-only).
  46967fe8ef — serwerowy resolver blueprintu
               (`server/src/services/materials/creationIntent.ts`,
               `resolveDocumentTemplateForCreation` — REUŻYWA istniejący
               `getRegisteredTemplate` z Document Studio, nie nowy parser).
  3929422088 — SSOT typów (`src/types/materials.ts`) + kanon scope/status.
  6fea2c6501 — mapper indeksu rozdziela `artifactIndexId` od
               `canonicalTemplateId` (dotąd było jedno mylące pole `id`).
  ba2e84bda0, 7be8592ad2, 7166f7df9d, 21a53da311, cd66e26db1 — routing
               „Użyj wzorca"→Mode 3, jawna odznaka „Legacy", uczciwy stan
               osieroconego, preselekcja szablonu w formularzu, testy
               kontraktowe, harness dev-render do zrzutów.
  4554d37010 — naprawa PRE-EXISTING blockera: `isTemplateUsableForGeneration`
               wymagał ścisłej równości `organizationId`, mimo że
               `getTemplate` CELOWO udostępnia katalog SYSTEM każdemu
               najemcy — 44 z 45 szablonów dokumentu na demo (systemowe)
               padały na `template_not_usable`, dokładnie te które
               Biblioteka pokazuje. Bez tej poprawki DoD#4 był
               nieosiągalny na realnych danych. Poprawka: dopuszczona też
               org SYSTEM, cross-tenant nadal niemożliwy.
  d9dce52817 — ★ P1, ODBIÓR ARCHITEKTA: pierwsza wersja miała
               `resolveDocumentTemplateForCreation` BEZ ŻADNEGO
               produkcyjnego callera — URL niósł `canonicalTemplateId`
               bezpośrednio jako parametr od klienta (niezweryfikowany
               wskaźnik prosto do generatora, problem bezpieczeństwa nie
               tylko martwy kod). Naprawa: nowy endpoint
               `POST /api/document-studio/templates/resolve`
               (`document-studio.routes.ts`), URL niesie WYŁĄCZNIE
               `templateArtifactId` (id indeksu), org z kontekstu auth nie
               z body, blueprint NIE wraca do klienta w odpowiedzi.
  d991f042dc — ★ SAMOAUDYT tą samą metodą co P1 (grep każdego nowego
               eksportu → czy ma callera w `server/src/routes/` lub
               `src/`): znalazłem DRUGI przypadek u siebie —
               `countOrphanedTemplateLinks` był wyeksportowany,
               przetestowany jednostkowo, ZERO wywołań. Naprawa: wpięty w
               `ensureBackfilledOutputsForOrg`, w blok już dławiony
               watermarkiem (zero dodatkowego obciążenia), fail-soft,
               nadal WYŁĄCZNIE SELECT — zero DELETE/UPDATE.
  32baf8fe9b — render-verify (harness) wykrył, że komunikaty stanu
               blokującego renderowały się PO ANGIELSKU mimo `lang=pl` —
               produkt jest polskojęzyczny, przestawione na polskie
               defaulty.

  KONTRAKT (dokładne definicje TS, zablokowane przez architekta — nie
  zmieniaj nazw pól bez nowej pisemnej decyzji w docs/product/):
    type TemplateScope = 'system'|'organization'|'personal'|'unknown';
    type TemplateStatus = 'approved'|'published'|'draft'|'deprecated'|'unknown';
    type TemplateOriginRuntime =
      'document_template'|'report_template'|'presentation_template'|'sheet_template';
    type TemplateSource = 'canonical'|'legacy';
    type TemplateRef =                          // SUMA ROZŁĄCZNA
      | { kind:'library'; templateArtifactId: string }
      | { kind:'internal'; canonicalTemplateId: string; originRuntime: TemplateOriginRuntime };
  Pliki: `server/src/services/materials/templateContract.ts` (BE słownik +
  normalizatory), `src/types/materials.ts` (FE SSOT),
  `server/src/services/materials/creationIntent.ts` (resolver + błędy
  typu `TemplateResolveError` z kodami `TEMPLATE_NOT_INDEXED|
  TEMPLATE_ORPHANED|TEMPLATE_FORBIDDEN|TEMPLATE_DEPRECATED|
  TEMPLATE_FORMAT_UNSUPPORTED`), endpoint
  `POST /api/document-studio/templates/resolve` w
  `server/src/routes/document-studio.routes.ts`.

  DOKŁADNY PRZEPŁYW „UŻYJ WZORCA" (dokument) DZIŚ:
    Klik w Bibliotece → URL /document-studio?entry=template&
      templateArtifactId=<ID INDEKSU, nigdy canonical>
    → DocumentStudioView woła POST .../templates/resolve {templateArtifactId}
      (org z auth, NIE z body)
    → serwer: origin_runtime + canonical record + org/scope/status/orphan
    → zwraca WYŁĄCZNIE {canonicalTemplateId,...}, blueprint zostaje na serwerze
    → Mode 3 preselekcjonuje tym id → generacja czyta sectionBlueprint
      ŚWIEŻO z document_studio_templates w momencie generowania
  Odrzucenie (osierocony/zabroniony/wycofany/niezaindeksowany) = stan
  BLOKUJĄCY po polsku z przyciskiem powrotu do Biblioteki. ZERO cichego
  fallbacku do pickera albo do AI (to był twardy wymóg — korekta #2/#4).

═══════════════════════════════════════════════════════════════════════════
★★★ DWIE LEKCJE METODYCZNE — te muszą kierować TWOJĄ dalszą pracą w tym
programie, nie tylko być ciekawostką historyczną
═══════════════════════════════════════════════════════════════════════════

1. MARTWY KOD PRZECHODZI TESTY JEDNOSTKOWE. Dwa razy w tej samej fali
   wyeksportowana, w pełni przetestowana funkcja okazała się nie mieć
   ŻADNEGO produkcyjnego callera (raz złapał to architekt w P1, raz
   znalazłem to sam w samoaudycie tą samą metodą). Test jednostkowy funkcji
   w izolacji NIE dowodzi, że cokolwiek ją realnie wywołuje. REGUŁA: każdy
   nowy eksport musi mieć callera w ścieżce PRODUKCYJNEJ (route, komponent-
   wejście). Dowód = test uderzający w TO WEJŚCIE (np. supertest na route),
   nigdy sam test funkcji.

2. STRAŻNIKI (check-triada.sh itp.) BYWAJĄ FAŁSZYWIE ZIELONE. W tej samej
   sesji równoległa praca naprawiła bug: strażnik zwracał „OK" przy ZERO
   sprawdzonych plików na czystym drzewie git (nic nie było staged) — czyli
   wcześniejsze „check-triada: OK" w tej sesji było puste, nie prawdziwym
   przejściem. REGUŁA: zawsze patrz na LICZBĘ sprawdzonych plików w
   wyjściu strażnika. Jeśli jej brak albo wynosi 0 — nie ufaj, zrób
   bezpośredni `grep` na plikach które faktycznie zmieniłeś.

═══════════════════════════════════════════════════════════════════════════
STAN NA DEMO I WERYFIKACJA
═══════════════════════════════════════════════════════════════════════════

Push: `origin/demo` ← `3cd6075ee6` (mój ostatni commit tej fali —
rollback point sprzed niego: `206f5677fd`). Demo poszło DALEJ pod innymi
sesjami po tym punkcie, to normalne — zrób
`git fetch origin demo && git log --oneline -1 origin/demo` na starcie,
NIE zakładaj że ten hash to „aktualny stan demo" w chwili gdy to czytasz.

Weryfikacja zrobiona DWUKROTNIE niezależnie (przy buildzie i w osobnym
samoaudycie po odbiorze P1): 63/63 testów zielonych (6 plików) na aktualnym
wtedy HEAD demo; wszystkie 7 korekt + 6 DoD sprawdzone z dowodem plik:linia
na dokładnej liście 14 non-merge commitów (metoda: `git log --no-merges
--first-parent`, NIE diff baz branchy — ta druga metoda dała fałszywą
kontaminację cudzymi zmianami z merge'y demo, więc jeśli robisz podobną
weryfikację, unikaj tego błędu); bezpośredni grep crimson/`primary-*` na 18
plikach produkcyjnych — zero naruszeń; render-verify mój (reguła #7
CLAUDE.md) przez harness `dev-render/screens/document-studio-template-
resolve-error.tsx` — montuje REALNY `DocumentStudioView`, podstawiona tylko
warstwa sieciowa, zrzuty light+dark stanu blokującego zrobione i obejrzane
PRZEZE MNIE przed pokazaniem czegokolwiek Piotrowi.

★ PIOTR JESZCZE NIE KLIKAŁ NA ŻYWO. Testuje w NIEDZIELĘ WIECZOREM (wraca z
kajaków — sprawdź aktualną datę względem tego, licz najbliższą niedzielę
jeśli czytasz to później). To jedyna warstwa weryfikacji która nie została
zrobiona. Jeśli już masz jego feedback (sprawdź czy było w międzyczasie w
konwersacji, w plikach `rejestr/`, albo zapytaj go wprost) — PRZETWÓRZ GO
NAJPIERW: rozdziel na (a) prawdziwe bugi W TYM SLICE [format=dokument] do
naprawy od razu, świeża gałąź od origin/demo, mały krok vs (b) rzeczy
świadomie POZA zakresem R1 (patrz lista niżej) które idą do kolejki
R1.1/R2 — zgłoś mu które jest które PRZED napisaniem kodu, nie zgaduj.
Jeśli feedbacku brak — zapytaj czy czekać, czy ruszyć dalej pod jego
nadzorem z kolejną świadomie odłożoną częścią.

═══════════════════════════════════════════════════════════════════════════
CO JEST ŚWIADOMIE ODŁOŻONE (decyzje architekta, NIE luki które trzeba
naprawiać samodzielnie bez pytania)
═══════════════════════════════════════════════════════════════════════════

- Adapter DECKA do „Z szablonu" — analogiczny wzorzec co dokument, R1
  kolejna iteracja.
- Prawdziwy WORKBOOK TEMPLATE REGISTRY (szablony Excela tworzone przez
  usera) — osobny pakiet po R1, przed pełnym R3 arkusza.
- `artifact-runs/from-chat` (KIMI, gdzie `templateArtifactId` NADAL ginie
  dla Word/Sheet ścieżki przez czat) — świadomie NIEZAIMPLEMENTOWANY
  projekt adaptera deckowego, korekta #7.
- Menu 2 → 5 typów, `deckArchitectFlag` default OFF, zdjęcie „Excel" z
  sidebara — to R2 (D6), zmiana UX/widoczności, NIE R1.
- Kasowanie osieroconych linków `v8_artifact_origin_links` — osobna,
  późniejsza decyzja po okresie obserwacji. Dziś TYLKO wykrywanie+pomiar,
  zero DELETE.
- `tp_base_templates` jako źródło szablonów Excela w Bibliotece — NIGDY
  (D5, to dane Table Studio, nie katalog Excela).
- Rename 7 modeli Excela na „Workbook models" w UI (nie „szablony") — R1.3,
  nieimplementowane.

NIE rusz żadnego z powyższych bez nowej, pisemnej decyzji architekta w
`docs/product/` — nawet jeśli wygląda jak oczywista, mała poprawka.

═══════════════════════════════════════════════════════════════════════════
DOKUMENTY ŹRÓDŁOWE (przeczytaj W CAŁOŚCI, ten prompt to streszczenie nie
substytut)
═══════════════════════════════════════════════════════════════════════════

1. docs/product/MATERIALS_TARGET_STATE_AND_TEMPLATE_CANON_2026-07-24.md —
   kanon docelowy, dokąd to wszystko zmierza.
2. docs/product/MATERIALS_RESUSCITATION_PROGRAM_2026-07-24.md — plan R0→R4.
3. docs/product/MATERIALS_R0_ARCHITECT_DECISIONS_2026-07-24.md —
   NAJWAŻNIEJSZY, może mieć nowe dopiski od architekta od czasu tego
   promptu, sprawdź datę modyfikacji.
4. Harvard/wdrozenie-100/_HANDOFF_MATERIALY_R1_2026-07-24.md — pełniejsza
   wersja tego przekazania z dodatkowym kontekstem chronologicznym.
5. Pamięć CTO (jeśli masz do niej dostęp): plik
   `materialy-r1-slice-dokument-demo-2026-07-24.md` w katalogu memory —
   wskaźniki i skrócone fakty z całego dnia.
6. Pełny raport R0 (6 przepływów × 11 kolumn szczegółowej analizy) istnieje
   TYLKO w transkrypcie oryginalnej sesji konwersacji, NIE jako plik w
   repo — streszczenie kluczowych ustaleń jest w sekcji „FALA 2" wyżej,
   powinno wystarczyć do dalszej pracy bez odtwarzania pełnego audytu.

═══════════════════════════════════════════════════════════════════════════
TWARDE ZASADY TEGO PROGRAMU (ponad ogólnymi zasadami CLAUDE.md repo)
═══════════════════════════════════════════════════════════════════════════

- Świeża gałąź per krok z `origin/demo`, fetch+merge nigdy force, pre-flight
  tuż przed KAŻDYM pushem (demo rusza się pod innymi sesjami w trakcie
  twojej pracy — złapałem to dwukrotnie w tej fali).
- Render-verify (zrzut z realnego komponentu w dev-render harness, sieć
  podstawiona) PRZED pokazaniem czegokolwiek Piotrowi — reguła #7. Wzorzec:
  `dev-render/screens/document-studio-template-resolve-error.tsx`.
- Nic nie wchodzi na demo bez akceptacji właściciela na zrzutach — chyba że
  Piotr explicité poprosi o push „do testowania" (jak w tej fali) — wtedy
  render-verify mój PRZED pushem nadal obowiązuje, ale zgoda na sam push
  jest już dana jego słowami.
- Nie ufaj strażnikom bez liczby sprawdzonych plików w wyjściu > 0.
- Nie zakładaj, że hash commita z tego promptu to „aktualny stan demo" —
  zawsze fetch najpierw.
- Migracje/flagi/tokeny/architektura = decyduję sam i raportuję, ale zakres
  R1 vs R2/R3 (co wolno ruszyć) jest ZABLOKOWANY przez architekta — pytaj
  o nową decyzję zamiast poszerzać zakres samodzielnie.

═══════════════════════════════════════════════════════════════════════════
START
═══════════════════════════════════════════════════════════════════════════

1. `git fetch origin demo && git log --oneline -1 origin/demo` — ustal
   realny aktualny stan.
2. Sprawdź czy jest feedback Piotra z testów niedzielnych (w konwersacji,
   w rejestr/, albo zapytaj go wprost).
3. Jeśli TAK — sklasyfikuj (bug w slice'u dokumentu vs poza zakresem R1),
   zgłoś podział Piotrowi, PRZED kodem.
4. Jeśli NIE — zapytaj czy czekać na jego test, czy ruszyć pod jego
   nadzorem z kolejną świadomie-odłożoną częścią z listy wyżej.
5. Cokolwiek robisz dalej — mierz to §6 dokumentu architekta (7 korekt +
   6 DoD) i pamiętaj o dwóch lekcjach metodycznych.
```
