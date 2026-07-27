# PLAN „NA 100%" — MATERIAŁY · przydział modeli · start rano 2026-07-27

> Zlecenie Piotra (noc 26/27.07): „zrób plan na 100%, żeby już serio było dobrze, bo ten projekt
> ciągnie się miesiącami. Z opisem, jaki model zajmuje się którym zadaniem. Rano startujemy."
> Bazuje na: `_PLAN_DOKONCZENIA_MATERIALOW_2026-07-26.md` (fazy P0-P3, 3 audyty źródłowe),
> kanon `MATERIALS_TARGET_STATE_AND_TEMPLATE_CANON_2026-07-24.md`, dyrektywa Gamma+Airtable.

## DLACZEGO TO CIĄGNIE SIĘ MIESIĄCAMI — diagnoza szczera (żeby nie powtórzyć)
1. **Dwa silniki dokumentów bez decyzji, który jest kanoniczny** (report_builder vs document-studio)
   — każda fala łatała jeden, psując szwy z drugim. Bez rozstrzygnięcia P3.3 problem będzie wracał.
2. **Naprawy per-objaw zamiast per-ścieżka-użytkownika** — testy funkcji przechodziły, klikanie
   Piotra nie. Od teraz: bramka = test E2E ścieżką klienta, nie unit.
3. **Flagi i dokumentacja rozjechane z kodem** (17 flag z kłamiącym opisem, phantom-SSOT) —
   każdy kolejny agent wchodził z fałszywą mapą i dokładał entropii.
4. **Brak jednej poprzeczki jakości** — „zgodne z kanonem" ≠ „ładne". Teraz poprzeczka jest
   nazwana: Gamma (tworzenie) + Airtable (biblioteka), odbiór side-by-side.

## DEFINICJA 100% (bramka końcowa — wszystkie naraz)
- [ ] DoD kanonu §8: 8/8 punktów SPEŁNIONE (dziś 2/8).
- [ ] Ścieżka Piotra bez zgrzytu: wejście → lista → klik → treść → edycja → eksport, każdy format.
- [ ] Każdy ekran ścieżki: PL, tokeny, side-by-side z Gamma/Airtable zaakceptowany przez Piotra.
- [ ] Zero znanych bugów P0/P1 w rejestrze; strażnicy zieloni; testy E2E ścieżek klienta w CI.
- [ ] Jeden kanoniczny silnik dokumentów (albo jawnie udokumentowany podział — decyzja P3.3).

## PRZYDZIAŁ MODELI — zasada
- **Fable 5** (nadzorca, ta sesja): planowanie, sesje architektoniczne, pigułki dla robotników,
  integracja, render-verify, push, odbiór. ZERO kodu produkcyjnego własnymi rękami.
- **Opus 4.8**: trudny kod i praca wymagająca smaku — prototypy ekranów Gamma/Airtable,
  unifikacja silników, praca w rdzeniu generacji. Drogi — tylko tam, gdzie Sonnet ryzykuje
  drugą iterację.
- **Sonnet 5**: cała mechanika standardowa — naprawy tras, i18n z kluczami, testy, rolloutы
  po zaakceptowanych prototypach. Koń roboczy (~80% zadań).
- **Haiku 4.5**: czysto mechaniczne przebiegi bez decyzji — poprawki docstringów, masowe
  podmiany tokenów wg gotowej listy, sprzątanie martwych plików po gotowym spisie z dowodami.

## HARMONOGRAM

### NOC 26/27 — ✅ WYKONANA (wynik, 2026-07-27 ~22:45)
| Zadanie | Model | Wynik |
|---|---|---|
| P0.1+P0.2 klik→treść + widoczność native_artifact | Sonnet | ✅ UWAGA: P0.1 (report→/reports/builder) naprawiła już równoległa sesja `fa6ce19a77` — robotnik zweryfikował runtime i NIE zdublował; realny fix = widoczność native_artifact + blokujący błąd PL zamiast intake (test red→green) |
| P0.3 język konta→UI | Sonnet | ✅ kolumna users.language (migracja auto-run), konto>localStorage>navigator, write-through z ustawień, 25 testów |
| P0.4+P1.2+P1.3 flagi/wejścia/tytuł | Sonnet | ✅ + pełny audyt 83 flag (15 kolejnych kłamało) + 2 znaleziska (czat→prezentacje, Execution export — patrz dopiski planu dokończenia) |
| P0.4b 15 docstringów flag | **Haiku** | ✅ diff = wyłącznie komentarze (zweryfikowane filtrem), 15/15 |
| PROTOTYP P2.1 ekran startu Gamma (dev-render) | **Opus** | ✅ gałąź `proto/gamma-start-screen`, ekran `?screen=proto-gamma-start` — render-verify nadzorcy light+dark PASS; czeka na akcept Piotra rano; NIE na demo |
| Integracja → strażnicy → testy → render-verify → push demo + tag | Fable | ✅ demo `b4cc519307`, deploy SUCCESS, health 200 (gitSha zgodny), **tag `demo-safe-2026-07-27-p0-hydraulika`**; 93 testy zielone, 0 nowych porażek |

★ DO ZBADANIA RANO (przed startem dnia 1): **8 czerwonych testów Hub/artifacts na tipie demo**
(pre-existing — wprowadzone nocną integracją menu-unifikacji INNEJ sesji `2085e38534`, potwierdzone
identycznym przebiegiem na czystym tipie). Wśród nich testy deep-linków ?tab=template_architect
i „5 tabów Menu 1" — trzeba rozstrzygnąć: zepsute tylko selektory testów czy REALNIE zepsute
deep-linki/menu po adopcji StandardModuleBar. To pierwsza robota poranka (Sonnet, S).

### RANO (start z Piotrem — 15 minut jego czasu)
1. **Piotr klika demo**: dokument otwiera się z treścią (P0 na żywo). 5 min.
2. **Piotr ogląda prototyp P2.1** (ekran startu Gamma) — akcept / korekty. 5 min.
3. **3 decyzje** (nie blokują startu, ale odblokowują P3): raport=typ dokumentu? ·
   /presentation-studio żywe? · stary Report Builder UI deprecate? 5 min.

### DZIEŃ 1 (27.07) — po akceptach
| Zadanie | Model | Rozmiar |
|---|---|---|
| P1.1 breadcrumb N-poziomowy + rama „Materiały › …" + „← Materiały" w 3 studiach | Sonnet | M |
| P2.4 crimson w CTA kreatora prezentacji (wizard/*Step) | Sonnet | S |
| P2.2a tęcza filtrów → tokeny semantyczne (4 flyouty, jeden plik) + z-index dark | Sonnet | S/M |
| P2.5 i18n chrome Deck Buildera (4 pliki, ~32 stringi) | Sonnet | M |
| P2.1 rollout ekranu startu po akcepcie prototypu (za flagą OFF → zrzuty → flip za zgodą) | Sonnet (wg prototypu Opus) | M/L |
| PROTOTYP P2.2b: biblioteka Airtable (widoki, hover-akcje, tagi) — do akceptu wieczorem | **Opus** | M |
| PROTOTYP P2.3: galeria szablonów z miniaturami (reuse SlideSilhouette/DocumentStructurePreview) | **Opus** | M |

### DZIEŃ 2 (28.07)
| Zadanie | Model | Rozmiar |
|---|---|---|
| **P3.3 SESJA ARCHITEKTONICZNA: unifikacja silników dokumentów** — koncept+plan migracji (dokument decyzyjny, nie kod). To jest rdzeń „miesięcy" — bez tego reszta to kosmetyka. | **Fable** (koncept) → recenzja Piotra | pół dnia |
| P2.2b/P2.3 rollout po akceptach prototypów | Sonnet | M/L |
| P3.1a deck „Z szablonu" — weryfikacja żywa E2E na demo (adapter już scalony) | Sonnet | S |
| P3.6 czat→prezentacje (kickoff message konsumowany przez tryb Z AI) | Sonnet | M |
| P3.4 czystka martwych tras/plików (po decyzjach Piotra, spis z dowodami gotowy) | **Haiku** (wg spisu) | M |

### DZIEŃ 3+ (29.07→)
| Zadanie | Model | Rozmiar |
|---|---|---|
| P3.3 implementacja unifikacji wg zaakceptowanego konceptu (najcięższy kod programu) | **Opus** (rdzeń) + Sonnet (obrzeża) | L/XL |
| P3.1b workbook template registry (D4 architekta — szablony Excela userów) | Opus (model danych) + Sonnet | L |
| P3.2 tryby tworzenia SZABLONU per format — domknięcie luk | Sonnet | M |
| P3.5 raport jako typ dokumentu (po decyzji) — taksonomia+UI | Sonnet | M |
| Bramka końcowa: pełny przebieg DoD §8 + E2E wszystkich ścieżek + odbiór Piotra klikiem | Fable + Piotr | pół dnia |

## ŻELAZNE REGUŁY PROGRAMU (bez wyjątków, wszystkie modele)
1. Gałąź ZAWSZE z origin/demo, worktree, commit bez push; push tylko nadzorca po weryfikacji.
2. Bramka każdej naprawy = **test E2E ścieżką użytkownika** (klik→ekran), nie test funkcji.
3. Nowa powierzchnia wizualna = prototyp → akcept Piotra → rollout za flagą OFF → zrzuty
   light+dark side-by-side z benchmarkiem → flip za zgodą. Bez skrótów, nawet w nocy.
4. Każdy nowy eksport ma callera produkcyjnego (dowód = test z wejścia).
5. Zero cichych fallbacków — każdy błąd to jawny stan PL z drogą powrotu.
6. Po każdej fali: strażnicy 3× zieloni, wpis do `_SESJA_*`/rejestru, memory.
7. Fable NIE pisze kodu produkcyjnego; Opus tylko tam, gdzie wskazany; reszta Sonnet/Haiku.

## UZUPEŁNIENIA PO REWIZJI KOMPLETNOŚCI (2026-07-27 4:45, przed startem — 7 znalezionych dziur)

**D1 — Plan pokrywał TYLKO Materiały, a cel brzmi „Consultify is ready" (urodziny 49. Piotra
w tym tygodniu).** Łata: definiujemy „READY" jako zestaw ZŁOTYCH ŚCIEŻEK przez CAŁY produkt —
lista ścieżek do spisania z Piotrem dziś rano (propozycja startowa: onboarding→assessment→wywiad→
inicjatywy→Materiały pełny cykl→wyniki; + IDEE 4 narzędzia; + Agent/Vault). Materiały = największa
dziura, stąd ten plan; pozostałe moduły dostają w czwartek-piątek przebieg złotych ścieżek
i naprawy TYLKO blokerów (nie polish). Bez tej definicji tydzień rozpłynie się w perfekcjonizmie
jednego modułu.

**D2 — Rescope P3.3 (unifikacja silników) — chroni termin.** Implementacja L/XL w tym samym
tygodniu co cała reszta = nierealna bez ryzyka rozwałki na urodziny. Cel urodzinowy: shimy
P0.1/P0.2 (już na demo — dwa silniki ŻYJĄ obok siebie poprawnie) + KONCEPT zaakceptowany.
Implementacja = tydzień PO urodzinach. Jeśli koncept ujawni tanią ścieżkę (np. czysty adapter
odczytu) — decyzja o wcześniejszym wejściu należy do Piotra.

**D3 — Brak złotej suity E2E jako stałej bramki.** Każdy fix miał swój test, ale nie było JEDNEJ
suity „ścieżek Piotra" odpalanej przed KAŻDYM pushem. Nowe zadanie [M, Sonnet, dzień 1-2]:
`tests/e2e-golden/materials.golden.test.ts` — utwórz Z AI→widoczny na liście→otwórz→edytuj→
eksportuj, per format; „Użyj wzorca" per format; deep-linki. To jest automatyczny odpowiednik
„Piotr klika bez zgrzytu" i bezpiecznik przeciw regresjom równoległych sesji.

**D4 — Rytm dnia z Piotrem (2 punkty synchronizacji).** Akcepty nie mogą być wąskim gardłem ani
zasypywać go pojedynczo. Rytuał: RANO (kawa, 15 min) — klik-test poprzedniego dnia + akcepty
prototypów + decyzje; WIECZOREM (15 min) — akcept zrzutów rolloutów za flagami + flipy. Wszystko
inne jedzie autonomicznie między punktami.

**D5 — Codzienny „tip-health sweep".** Demo żyje pod wieloma sesjami (wczoraj 4 pushe cudze,
8 czerwonych testów z cudzej integracji). Co rano PIERWSZA robota Sonneta: strażnicy + złota
suita + kluczowe pliki testów na świeżym tipie — cudze regresje łapiemy o 5:00, nie o 22:00.

**D6 — Scena demo Materiałów [M, Sonnet, dzień 2-3].** „Ready" na urodziny wymaga, żeby demo
wyglądało jak produkt żywej firmy: 6-10 dopracowanych materiałów na koncie Piotra (2 raporty DRD,
2 decki zarządowe, 2 arkusze modelowe, 2 dokumenty) — realna treść konsultingowa PL, wzorzec
seedowania ze sceny IDEE (2026-07-24). Plus WERYFIKACJA EKSPORTÓW żywa: .docx/.pptx/.xlsx
otwierają się w Office bez błędów (DoD §8 pkt 6 — dotąd niezweryfikowany).

**D7 — Perf biblioteki [S, Sonnet, dzień 2].** `ensureBackfilledOutputsForOrg` odpala backfill
przy KAŻDYM `GET /api/artifacts` (odkryte przy race-condition). Przy 347+ artefaktach to
potencjalnie setki ms na każde otwarcie listy. Zmierzyć; jeśli wolne — guard TTL/once-per-session.
Airtable-feel wymaga natychmiastowej listy.

**Decyzje Piotra — z rekomendacjami do jednego „zgadzam się":**
1. Raport = **typ dokumentu** (rekomendacja; 4. kafelek odpada — mniej nawigacji, szablon niesie
   „raportowość").
2. `/presentation-studio` = **relikt, deprecate** (rekomendacja; zero linków od tygodni, 43 EN
   stringi — utrzymanie kosztuje, wartość zerowa; odwracalne).
3. Stary Report Builder: **ZOSTAJE jako edytor treści raportów** (`/reports/builder/:id` jest teraz
   celem otwierania dokumentów report_builder!) — deprecujemy tylko jego osierocone kawałki
   (BlockTypesManager UI itd.) po P3.3.
4. Flipy flag (ff_workbook_templates, ff_drd_report) — po klik-teście odpowiednich powierzchni
   w rytmie D4.

## RYZYKA I BEZPIECZNIKI
- **Demo żyje pod wieloma sesjami** (wczoraj tip uciekł 3×): każdy push poprzedza fetch +
  merge-base --is-ancestor; merge, nigdy force; tag po każdej partii.
- **P3.3 (unifikacja) może ujawnić dane-zależności** (rekordy w obu silnikach): koncept MUSI
  zawierać migrację danych z dry-run na trolley zanim powstanie kod.
- **Prototypy Opus mogą nie trafić w gust** — dlatego są w dev-render (tanie odrzucenie),
  nie w kodzie produkcyjnym.
