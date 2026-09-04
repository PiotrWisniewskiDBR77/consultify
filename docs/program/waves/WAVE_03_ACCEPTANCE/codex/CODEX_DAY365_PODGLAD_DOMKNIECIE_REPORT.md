# CODEX DAY 365 — podgląd, domknięcie

Stan po R4: `PARTIAL`; R1 i R2 wykonane, R3 wykonane pomiarem i briefami dla
brakujących wejść. Raport końcowy uzupełnia R5.

## R0 — cztery zasady

Przeczytałem, że przyrząd jest przed produktem i wykonałem R1 przed R2.
Przeczytałem, że pytanie o pustą kartę pozostaje otwarte i naprawiłem wyłącznie
dublet 2 → 1. Przeczytałem, że para bajtowo identyczna jest zerem dowodu i
zapisałem trzy takie przypadki jako falsyfikację założenia. Przeczytałem, że
brakującą funkcję wolno dodać tylko do narzędzia jako opt-in; nie dodałem
czwartej zmiany ani własnego skryptu zrzutowego.

## R4 — pytanie o pustą kartę

SSOT zawiera wzajemnie wykluczające się wymagania:

- `docs/ui-standards/TRIADA_KANON.md:70`: „5. **Relations:** klikalne pigułki albo „No relations".”
- `docs/ui-standards/TRIADA_KANON.md:132`: „- [ ] 29. Relations albo „No relations"”
- `docs/ui-standards/03-modules/TABLE_AND_PREVIEW_CANON.md:337`: „2. **Relations** (blok 5 TRIADY, jeśli są): **2 wiersze stałej wysokości** (`min-h-[4.5rem]`), pills klikalne (kolor typu w tekście, nie tło), „+N more".”

Pierwsze dwa zapisy wymagają bloku także bez danych; trzeci ogranicza go do
przypadku, gdy relacje istnieją. Nie zmieniłem żadnego z tych dokumentów.

Pytanie rozstrzygalne: **czy pojedyncza karta „Brak powiązań” ma pozostać na
każdym ekranie, który nie przekazuje żadnych relacji — TAK czy NIE?**

Zmierzony koszt odpowiedzi:

- `TAK`: w 15 kontekstach mających wynik PO karta występuje 15/15 razy i zajmuje
  po 107 px; to 1605 px zsumowanej pionowej powierzchni na jeden motyw. Nie
  usuwa treści z DOM, ale odbiera miejsce w widocznym panelu i zwiększa
  przewijanie. Szesnasty kontekst (`audyt-findings`) nie ma poprawnego PO, więc
  jego koszt pozostaje `NIEZMIERZONY`.
- `NIE`: na zmierzonych ekranach bez danych odzyskujemy 107 px na podglądzie;
  tracimy jednak jawny komunikat, że relacji nie ma. Dokładnej liczby wszystkich
  ekranów produktu bez relacji nie wyprowadzam z 15 kadrów — pozostaje
  `NIEZWERYFIKOWANA`.
- Trzecia możliwość do decyzji: pokazywać blok tylko wtedy, gdy moduł deklaruje,
  że relacje są semantycznie właściwe dla tej encji, nawet jeśli lista jest
  pusta. Koszt implementacyjny wymaga nowego kontraktu propsów i osobnego
  inwentarza modułów; nie został zmierzony i niczego takiego nie wdrożyłem.

## Git po pozycjach

- R1: `725b13d963` — deklaracja trzech zmian narzędzia.
- R2: `3988cd683a` — dublet Finansów 2 → 1 wraz z dowodami.
- R3: `49051930ac` — ponowny pomiar trzech kontekstów i briefy brakujących wejść.

## Baza i marker

Wynik markera i sanity, dosłownie:

```text
MARKER OK
2a7273e087cbd3e44344725b524f6ddd79d5badc
```

Status worktree po utworzeniu był pusty. Tip `github-backup/grafika/m03-20260902`
był osiem commitów przed markerem; zgodnie z regułą rozejścia praca wystartowała
dokładnie z markera. Dysk: 13 GiB przy starcie, minimum zaobserwowane 8.3 GiB;
porty 6436 i 5576 były wolne. Bazy nie uruchamiano, bo dev-render używa
lokalnych fikstur, a ten dyżur nie dowodzi backendu.

## R1 — trzy zmiany narzędzia

| Zmiana | Zasięg | Opt-in | Wynik dwóch przebiegów | Werdykt |
| --- | --- | --- | --- | --- |
| `grafika-zrzuty.mjs:56-58,671-680,712`, `--mierz-wysokosc` | nowe pomiary wysokości | TAK | bez opcji: PNG i DOM identyczne, exit 1/1 | `RÓWNOWAŻNA` |
| `grafika-zrzuty.mjs:575-592`, warunek otwartego podglądu + pętla `KLIK` | harness oraz 5 skryptów: `r1-slepa-plama-uruchom`, `r1-slepa-plama-agreguj`, `g06-macierz-uruchom`, `g06-macierz-rejestr`, `r4-dowod-uruchom` | NIE | light `9efc5926…`, dark `f5156987…` po obu stronach; merytoryczny DOM identyczny; exit 1/1 | `RÓWNOWAŻNA` w zmierzonym wywołaniu |
| `grafika-zrzuty.mjs:876-882`, filtr `Object.hasOwn` | wszystkie wywołania `--wynik-selektor`; 4 dokumenty zasad/pomiarów | NIE | ten sam JSON `pary`, drukowany mianownik `1/2 → 1/1`; exit pozostał 1 z innej bramki | `ZMIENIA WYNIK, PRZYJĘTA` |

Pełne JSON-y, PNG i wyjścia są w
`/private/tmp/cx-day365-podglad-domkniecie-artefakty/r1-przed` oraz `r1-po`.
Exit 1 wynikał z zastanych zwiniętych filtrów/menu; nie został nazwany PASS.

## POMIARY DO PRZEMIARU

Mianownik może być nieaktualny w: regule 19 `00_ZASADY_PRACY.md`,
`RAPORT_195_PRZELOT_A.md`, `PANELE_WYCENY_ZRZUTY_20260901.md`,
`PRZEGLAD_BEZPIECZNIKOW_20260901.md` i raporcie dyżuru 345 (jawne `1/2`
przy `ok:true`). Re-klik dotyczy pięciu skryptów z tabeli, w szczególności G06
i pomiaru ślepej plamy R1, choć wybrane wywołanie było równoważne.

## R2 — rodzina 16 wołaczy

W każdym wierszu sprawdzono dzieci i łańcuch wywołań. `TAK` oznacza własny
kanoniczny blok stopki AI/Relations/Actions, a nie dowolną treść dziecka.

| Wołacz | Dubluje blok stopki |
| --- | --- |
| `AuditOutputsTab.tsx:337` | NIE |
| `AuditProcessesTab.tsx:437` | NIE |
| `RezultatyView.tsx:1527` | NIE |
| `RezultatyView.tsx:1626` | NIE |
| `RezultatyView.tsx:1777` | NIE |
| `FinanceHub.tsx:3272` → `renderPreviewFooter` | TAK: AI, Relations i Actions; Relations naprawione |
| `ExecutionHub.tsx:5220` | NIE |
| `ExecutionHub.sourceRelation.render.test.tsx:8` | NIE, komentarz testu |
| `MyProjects.tsx:886` | NIE |
| `MyProjects.tsx:1115` | NIE |
| `OutputsAggregateTabContent.tsx:1256` | NIE |
| `ReportsTabContent.tsx:532` | NIE |
| `AssessmentHub.tsx:2398` | NIE |
| `AssessmentHub.tsx:2696` | NIE, komentarz |
| `VaultDocumentsView.tsx:20` | NIE, komentarz |
| `partner-settlements-view.tsx:5` | NIE, komentarz |

Liczba rzeczywistych dubletów Relations: 1/16. Kanoniczne wystąpienie to blok 5
powłoki `StandardPreview`, zgodnie z TRIADĄ. Stopka Finansów przestała renderować
własny `PreviewRelations`; przekazuje do powłoki te same items i emptyLabel.
Dowód: w istniejącym JSON dyżuru 352 oba motywy miały empty=2; po zmianie oba
mają empty=1, relations=1, wysokość 107 px. SHA różnią się PRZED/PO:
light `9efc5926… → bc135889…`, dark `f5156987… → efb51bbe…`.

## Testy podglądu i zasięg nazw

Pakiety `standardPreview.r03`, `tablePreviewGeometry.r03-2` i
`keyboardAccessCanon` uruchomiono przed i po przez rootowy config z
`RUN_DB_TESTS=0 MOCK_DB=true --retry=0 --reporter=json`. Wynik przed 48/48,
po 48/48, `numFailedTests=0`, `numPendingTests=0`; diff 48 pełnych nazw jest
pusty. Pliki: `/private/tmp/cx-day365-podglad-domkniecie-artefakty/{przed,po}-nazwy.txt`.

Pułapki §0.2e: (a)–(d) nie leżą na ścieżce tych czysto frontowych testów; nie
montują ApiGateway ani middleware. Dla (e): retry wymuszono na 0, wyniki
porównano po `fullName`, a zrzuty oceniono osobno od testów. Testy nie dowodzą
produkcji HTTP ani backendu.

Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Bazy tego dyżuru nie
uruchomiłem. Nie uruchomiłem `server/src/index.ts` ani żadnego drenażu outboxu.
Żaden e-mail ani zaproszenie kalendarzowe nie zostało wysłane.

## R3 — manifest i brakujące wejścia

Pełne SHA, jasności i DOM sześciu nowych kadrów są w
`evidence/podglad-domkniecie-20260904/R3_POMIAR_I_BRIEF.md` oraz JSON-ie
`r3-potwierdzenie/_wynik-kontrola__PO.json`. Historyczne pary trzech kontekstów
były bajtowo identyczne i dlatego otrzymały `BEZ ZMIANY RUNTIME — POTWIERDZONE`,
nie `RÓŻNA PARA`. Ponowny pomiar: 3/3 par z markerem details, każdy motyw ma
relations=1, empty=1, 107 px; harness 2/6 `OK` z powodu zastanych zwiniętych
kontrolek, więc jego exit 1 pozostaje jawny.

Pozostałe 12 różnych par dyżuru 352 zachowują werdykt `RÓŻNA PARA` i ścieżki
w `evidence/podglad-relations-20260904/<kontekst>/`; `audyt-findings` oraz
`CasesListScreen`, `RealizacjaView`, `RezultatyView` mają `BRAK WEJŚCIA — BRIEF`.
Nie powstała pełna nowa para dla tych czterech pozycji. To utrzymuje R3 i cały
dyżur jako `PARTIAL`.

## OGLĘDZINY

- Finance analysis light: jedna karta „POWIĄZANIA / Brak powiązań”; tabela i panel są widoczne, karta nie jest zdublowana.
- Finance analysis dark: jedna karta „POWIĄZANIA / Brak powiązań”; akcje poniżej są czytelne.
- Finance core light: panel sprawozdania ma jedną kartę Relations i pełne szczegóły.
- Finance core dark: ten sam układ, bez dubletu i bez kontrolki harnessu na obrazie.
- Results registry light: panel KPI ma szczegóły, AI i jedną pustą kartę Relations.
- Results registry dark: ten sam układ; dolne akcje są częściowo poza kadrem, ale panel nie jest zasłonięty.
- Results attention light: panel DPMO-002 ma szczegóły, pustą kartę Relations i „Otwórz KPI”.
- Results attention dark: ten sam układ w dark, bez zasłonięcia produktu.

## Korekty wobec instrukcji

- Surowy skaner podał 86 tagów łącznie, bo obejmuje testy i komentarze; liczba
  16 wołaczy z dziećmi została potwierdzona, ale część z nich to komentarze.
- Katalog dowodów ma 16 kontekstów, nie 20; wynik 12 różnych / 3 identyczne /
  1 bez PO i 62 PNG potwierdzono.
- `check-dev-render-parytet` kończy się 1: 5 nowych względem jego baseline
  naruszeń R1 oraz 40 ostrzeżeń. Nie zmieniałem harnessu w dyżurze 365; nie mam
  pomiaru tej bramki sprzed zmian, więc nie przypisuję czerwieni swojej zmianie
  ani stanowi zastanemu.
- ESLint dwóch zmienionych plików wykazuje zastany błąd sortowania importów w
  `FinanceHub.tsx` i 64 ostrzeżenia; nie uruchomiono autofixu.

## Bramki końcowe

Słowniki: PL 35199, EN 33066 (bez zmiany). `focus-canon=0`, `list-canon=0`,
`artefakt=0`, `reach=0`, `parytet=1`. Dysk końcowo 8.5 GiB. Żadnego dokumentu
kanonu, słownika, serwera, globalnej konfiguracji testów ani dowodu 352 nie
zmieniono.

## TWIERDZENIA NIEZWERYFIKOWANE

- Nie zweryfikowano pełnej liczby wszystkich ekranów produktu, na których pusta
  karta ma koszt 107 px; pomiar obejmuje 15 dostępnych kontekstów PO.
- Nie wykonano poprawnych wejść i kadrów dla `audyt-findings` oraz trzech ekranów
  CaseWorkspace; zależności opisuje brief R3.
- Nie dowiedziono, czy specjalna etykieta `relationsInWorkspace` występuje w
  realnym rekordzie z oboma identyfikatorami; przepływ propsów zachowano statycznie.
- Nie wykonano produkcyjnego HTTP, urządzeń ani akceptacji właściciela.

## PYTANIA DO WŁAŚCICIELA

1. Czy pojedyncza karta „Brak powiązań” ma pozostać na ekranach bez relacji —
   TAK czy NIE? Koszt i trzecia możliwość są policzone w R4.
2. Czy przyjmujesz zmianę mianownika `--wynik-selektor` i jawnie deklarowaną
   logikę re-kliku, wraz z listą pomiarów do przemiaru?

## Stan końcowy

`PARTIAL`: R1 i R2 domknięte lokalnie; R3 ma uczciwe briefy zamiast czterech
brakujących wejść; R4 pozostawiono do decyzji. Gałąź:
`codex/day365-podglad-domkniecie-20260904`.
