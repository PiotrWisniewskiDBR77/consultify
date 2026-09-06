# Odbiór na żywo P1 / P5 / IV — 06.09.2026

Stanowisko: frontend `http://127.0.0.1:3090` → backend `127.0.0.1:4100`, org DBR77, worktree
`/private/tmp/m03` (HEAD `42dfd78b7b`, P1 `2134c9cffc`/P5 `50c0f16130`/IV `03955169f6` są
przodkami HEAD — kod na porcie 3090 zawiera wszystkie trzy scalenia). Sesja: kopia
`/private/tmp/stanowisko-noc/auth-p1.json`. Narzędzia: `scripts/dev/odbior-zywo/zrzut.mjs`,
`scripts/dev/odbior-zywo/luma-para.mjs`. Wszystkie zrzuty w `evidence/odbior-zywo-20260906/{P1,P5,IV}/`.

## Werdykt skrócony

| Paczka | Werdykt | Powód |
| --- | --- | --- |
| **P1** (jeden prawy panel zwijany) | **NIE SPEŁNIA** | Na 8 zapowiedzianych ekranów: 3 pełny PASS, 2 mają panel z zakładkami ale łamią „lepkie zamknięcie" (dokładnie ta uwaga właściciela, którą P1 miał naprawić), 2 w ogóle nie mają wzorca P1 mimo znacznika `[ODMROZENIE]` w commicie scalającym, 1 nie do zmierzenia (puste dane demo). |
| **P5** (szkielety/liczniki/404) | **CZĘŚCIOWO SPEŁNIA** | Szkielety (Narzędzia, płótno pomysłu) i obserwowalna dostępność (Megatrendy) działają poprawnie i zostały zaobserwowane. Liczniki Notatnika i 404 na `stream/partial` nie dały się zmierzyć (brak danych/nawigacji), nie oceniam ich jako FAIL — jako NIEZMIERZONE. |
| **IV** (tryb ciemny) | **CZĘŚCIOWO SPEŁNIA, z potwierdzeniem zgłoszonego problemu** | Potwierdzone: para „11-audyty" w poprzednim przebiegu była fałszywa — `/audits` to publiczny landing marketingowy, nie moduł Audytów, nawet dla zalogowanego użytkownika. Po poprawieniu trasy na `/audit-programs`: luma PASS, wizualnie czysto w ciemnym motywie. 15 innych par: 15/15 PASS na bezpieczniku luma, 6 zrzutów obejrzanych okiem — brak białych dziur, brak nadużycia crimson. Część ekranów zmierzona na poziomie listy modułu, nie dokładnie na podekranie z dokumentu II (patrz „Czego nie zmierzono"). |

## P1 — 8 ekranów × wynik

| Ekran | Trasa użyta | Zakładki Rekord\|Teresa | Jeden korzeń panelu | Zwijanie (X) | Lepkość (klik po X nie otwiera) | Werdykt | Dowód |
| --- | --- | :-: | :-: | :-: | :-: | --- | --- |
| Skrzynka | `/my-work` | **NIE** | **NIE** — `InboxContent.tsx` renderuje własny `PreviewPane` w `<div data-preview-pane>` (linia ~4320), nigdy nie wchodzi przez `TableWithPreviewLayout`/`JedenPrawyPanel` | n/d | n/d | **FAIL** — mimo `[ODMROZENIE 07_MY_WORK_AGENT]` w commicie P1, ten konkretny ekran (dokładnie ten, o który skarżył się właściciel) nie ma nowego wzorca | `P1/skrzynka-1280.png` |
| Pomysły | `/my-work/ideas` | TAK | TAK (`[data-right-panel]`=1) | TAK | TAK (ale przez własną flagę `previewDismissed`/`persistIdeaPreviewDismissed` w `IdeasTableContent.tsx:670-683`, nie przez oficjalny mechanizm P1) | **PASS** (wizualnie) | `P1/pomysly-*.png`, `pomysly-lepkosc.png` |
| Zadania | `/my-work/tasks` | TAK | TAK | TAK (samo zamknięcie działa) | **NIE** — klik w wiersz po zamknięciu panelu OTWIERA GO PONOWNIE | **FAIL — regresja dokładnie tej uwagi właściciela, którą P1 miał naprawić** | `P1/zadania-lepkosc.png` (panel=1 po X→klik) |
| Wywiad Skrzynka | `/interview` | **NIE** | `<aside>` istnieje, ale to ręcznie pisany panel `InterviewHub.tsx:8620` (`<aside>` + `StandardPreview` wprost), nie `JedenPrawyPanel` | n/d | n/d | **FAIL** — Interview nie było w liście 6 modułów `[ODMROZENIE]` P1, więc nigdy nie dostało wzorca, ale to jeden z 8 ekranów, które P1 §10 każe zmierzyć | `P1/wywiad-1280.png` |
| Ocena lista | `/assessment/overview\|/assessment/drd` | TAK | TAK | TAK | TAK | **PASS** | `P1/ocena-*.png`, `ocena-lepkosc.png` |
| Audyty program | `/audit-programs` | — | — | — | — | **NIE ZMIERZONE** — biblioteka pusta („Brak pakietów audytowych", 0 wierszy) w org DBR77, klik w `tbody tr:first-child` nie miał czego trafić | `P1/audyty-1280.png` |
| Materiały biblioteka | `/presentations` | TAK | TAK | TAK | TAK | **PASS** | `P1/materialy-*.png`, `materialy-lepkosc.png` |
| Realizacja praca | `/execution?tab=work` | TAK | TAK | TAK (samo zamknięcie działa) | **NIE** — ten sam błąd co Zadania | **FAIL — ta sama regresja** | `P1/realizacja-lepkosc.png` |

**Wynik: 3/8 pełny PASS, 2/8 FAIL (brak wzorca), 2/8 FAIL (regresja lepkości), 1/8 niezmierzone.**

### Przyczyna źródłowa (zweryfikowana w kodzie, nie hipoteza)

`src/components/shared/TableWithPreviewLayout.tsx` (~linie 193-197):

```js
useEffect(() => {
  if (controlledPreviewOpen === true && poprzednieKontrolowaneOtwarcie.current === false) {
    jedenPanel.pokazPanel();
  }
  poprzednieKontrolowaneOtwarcie.current = controlledPreviewOpen;
}, [controlledPreviewOpen, jedenPanel]);
```

Efekt wywołuje `jedenPanel.pokazPanel()` (czyli kasuje `zamkniety`) na KAŻDE przejście
`previewOpen` false→true, bez sprawdzenia, czy panel został świadomie zamknięty. Konsumenci,
którzy przekazują kontrolowany `previewOpen={Boolean(selectedId)}` i po zamknięciu czyszczą swój
lokalny stan (`setPreviewTaskId(null)` itp.), przy KOLEJNYM kliknięciu wiersza automatycznie
odpalają ten efekt i panel wraca — dokładnie uwaga właściciela „nie mogę go zamknąć".

- **Dotknięte:** `src/components/MyWork/MyTasksListContent.tsx:2598` (`previewOpen={Boolean(previewTaskId)}`),
  `src/components/Execution/ExecutionHub.tsx:5229,5687` (`onRowClick={(row) => setReportPreviewId(...)}` / `setSummaryPreviewInitiativeId`).
- **Niedotknięte przez przypadek, nie przez naprawę:** `src/components/MyWork/IdeasTableContent.tsx:670-694` ma
  WŁASNĄ, dodatkową flagę `previewDismissed` (linia 675, komentarz „świadome zamknięcie… żeby kolejny
  klik w wiersz nie otwierał panelu z powrotem") — czyli Pomysły działają, bo ktoś już wcześniej
  załatał ten sam problem lokalnie, nie dlatego że P1 rozwiązał go u źródła.
  `src/components/assessment/library/AssessmentLibraryTab.tsx` nie używa `TableWithPreviewLayout` w
  ogóle (idzie przez `JedenPrawyPanel` bezpośrednio z gołym `selectedId`), więc nie wchodzi w ten kod.

### Skrzynka @1280 bez zaznaczenia (twierdzenie P1 o szerokości)

Bez klikniętego wiersza tabela Skrzynki przy 1280 px pokazuje WSZYSTKIE kolumny (Tytuł/Status/
Pilność/Typ/Sekcja) bez ucięcia — **PASS** dla tej konkretnej obietnicy (`P1/skrzynka-1280-brak-klikniecia.png`).
Przy zaznaczonym wierszu ten sam ekran pokazuje stary panel bez zakładek (patrz tabela wyżej).

## P5 — szkielety, liczniki, 404

| Sprawdzenie | Wynik | Dowód |
| --- | --- | --- |
| Narzędzia (`/discovery-tools`) @300ms | **PASS** — realny szkielet (szare belki placeholder), nie pusty prostokąt | `P5/narzedzia-skeleton.png` |
| Płótno pomysłu (Pomysły → „Otwórz Flow") @300ms | **PASS** — realny szkielet | `P5/plotno-pomyslu-skeleton.png` |
| Płótno pomysłu, pełne załadowanie @2500ms | PASS — canvas renderuje się poprawnie, 0 błędów konsoli, 0 odpowiedzi ≥400 | `P5/plotno-pomyslu-zaladowane.png` |
| Realizacja Praca @300ms | **NIEZMIERZONE** — dane załadowane już przy 300ms (lokalna baza za szybka, żadnej klatki szkieletu nie udało się złapać tym opóźnieniem) | `P5/realizacja-praca-skeleton.png` |
| Realizacja Zasoby @300ms | **NIEZMIERZONE** — jw. | `P5/realizacja-zasoby-skeleton.png` |
| Notatnik liczniki „—"→liczba | **NIEZMIERZONE** — org DBR77 ma 0 notatników („Nie masz jeszcze żadnego notatnika"), licznik od razu pokazuje `0`, nie da się zaobserwować przejścia z „—" na realną liczbę bez danych | `P5/notatnik-liczniki-100ms.png`, `notatnik-liczniki-2000ms.png` |
| 404 na `/api/ai/stream/partial/:id` | **NIEZMIERZONE** — nie znaleziono selektora do otwarcia historycznej rozmowy z ekranu powitalnego w dostępnym czasie; zmierzony tylko wariant powitalny | `P5/czat-otwarta-rozmowa.png` |
| 404 na `map/candidate` | **PASS (pośrednio)** — otwarcie płótna pomysłu (jedyna dostępna ścieżka do tego kontraktu) dało zero odpowiedzi ≥400 w ogóle | `P5/plotno-pomyslu-zaladowane.png.json` |
| Bonus: Megatrendy „obserwowalna dostępność" | **PASS** — backend zwraca 503 na `/api/megatrends/baseline?industry=automotive` (osobny problem danych/backendu, poza zakresem P5), ale ekran pokazuje czytelny stan błędu „Nie udało się wczytać megatrendów" + przycisk „Spróbuj ponownie" zamiast wisieć w ciszy | `P5/megatrendy.png` |

## IV — tryb ciemny

**Potwierdzenie zgłoszonego problemu.** `/audits` (link z `HeroSection.tsx:105`, trasa
`AppRoutes.tsx:1445`, oznaczona w kodzie komentarzem „Audits Showcase — Industrial Excellence
(Public)") renderuje publiczny landing marketingowy z przyciskami „Zaloguj się"/„Rozpocznij trial"
**nawet dla zalogowanego użytkownika** — to nie jest moduł Audytów. Realny moduł żyje pod
`/audit-programs` (potwierdzone też w `routeConfig.ts:432`: `[AppView.ASSESSMENT_AUDITS]: '/audit-programs'`).
Dowód: `IV/11-audyty-slash-audits.png` (landing) vs `IV/11-audyty-realny__dark.png` (realny moduł,
ciemny, poprawny).

### Bezpiecznik luma (progi 150/110/40) — 15 par zmierzonych ponownie

| Ekran | Jasny | Ciemny | Różnica | PASS |
| --- | --: | --: | --: | :-: |
| Czat | 248.6 | 19.6 | 229.0 | ✓ |
| Moja Praca (Skrzynka) | 246.4 | 29.3 | 217.0 | ✓ |
| Wywiad | 248.2 | 21.3 | 226.9 | ✓ |
| Narzędzia | 247.6 | 26.4 | 221.2 | ✓ |
| Ocena | 248.0 | 24.9 | 223.1 | ✓ |
| Inicjatywy | 245.2 | 29.2 | 216.0 | ✓ |
| Realizacja | 248.0 | 25.7 | 222.3 | ✓ |
| Wyniki | 248.2 | 20.4 | 227.8 | ✓ |
| Materiały | 248.5 | 31.4 | 217.1 | ✓ |
| Spotkania | 248.6 | 24.1 | 224.6 | ✓ |
| Organizacja | 246.0 | 29.3 | 216.7 | ✓ |
| Panel Administratora | 244.6 | 37.0 | 207.7 | ✓ |
| Ustawienia | 244.3 | 33.5 | 210.8 | ✓ |
| Partnerzy | 248.2 | 23.8 | 224.4 | ✓ |
| **Audyty (trasa poprawiona na `/audit-programs`)** | 248.9 | 23.5 | 225.4 | ✓ |

**15/15 PASS, zero duplikatów.** (Finanse pominięte celowo — poza MVP w tej fali, zgodnie z
`IV_TRYB_CIEMNY_I_LUKI_POMIAROWE.md` §4.3 poz. 16.)

### Ocena okiem (6 zrzutów ciemnych + Audyty)

Obejrzane: `czat__dark`, `moja-praca__dark`, `ocena__dark`, `wyniki__dark`, `panel-admin__dark`,
`ustawienia__dark`, `11-audyty-realny__dark`. Brak białych „dziur", brak nadużycia crimson (jedyne
użycie czerwieni/bordo — karta „0% Wymaga poprawy" w Ustawieniach — to legalna semantyka
krytyczna wg kanonu, nie dekoracja). Kontrast czytelny wszędzie.

### Czego NIE zmierzono w IV (uczciwie, nie zgadywane)

- **Audyty — treść ekranu.** Zmierzono pustą bibliotekę (0 pakietów), nie „podgląd programu
  audytowego" z dokumentu II — brak danych demo w org DBR77 dla tego modułu.
- **Wyniki, Ocena, Materiały, Spotkania, Inicjatywy** — zmierzono ekran główny/listę modułu, NIE
  dokładny podekran z dokumentu II („Cel — pełna karta OKR", „DRD → Macierz → Pełny ekran",
  „Document Studio — wybór trybu nowego dokumentu", „Lista i podgląd spotkania" z otwartym
  obiektem, „panel podglądu" z realną treścią) — wymagałoby to głębszej nawigacji z realnymi ID,
  której nie wykonano w dostępnym czasie. Luma/kontrast na zmierzonych ekranach i tak PASS, ale to
  nie jest 1:1 z ekranem flagowym z dokumentu II.
- **Czat — otwarta konwersacja.** Zmierzony tylko ekran powitalny (dopuszczalny wariant zapasowy
  wg dokumentu II), nie „otwarta konwersacja @1920".

## Bonus (poza zakresem P1/P5/IV, zaobserwowane przy okazji)

1. **P3 (i18n) — Ocena, pusty stan.** `/assessment/drd?tab=processes`: nagłówek „Brak
   assessmentów" po polsku, treść w 100% po angielsku: „No assessments found. Create your first
   assessment to get started.” Plik: `src/components/assessment/AssessmentHub.tsx:1611`.
   Dowód: `IV/ocena__dark.png`.
2. **P4 (surowe ID w UI) — Materiały, panel podglądu.** Pole „Źródło" pokazuje surowy identyfikator
   `05189ab2766442c9b2c9116352a8fb5a` zamiast nazwy/etykiety. Dowód: `P1/materialy-1280.png`.

## Podsumowanie liczb dla nadzorcy

- P1: 8/8 ekranów zmierzonych × 3 szerokości (24 zrzuty) + 10 zrzutów zwijania/lepkości.
  3 PASS, 4 FAIL (2 brak wzorca, 2 regresja lepkości), 1 niezmierzone.
- P5: 8 sprawdzeń, 3 PASS, 1 PASS pośredni, 4 niezmierzone (brak danych/nawigacji, nie FAIL).
- IV: 15/15 par PASS na luma, 1 potwierdzony fałszywy pomiar sprzed naprawy (`/audits`→landing),
  teraz poprawiony i zmierzony ponownie. 7 zrzutów ciemnych ocenionych okiem — czysto.
