# Podgląd Pomysłów — kanon, sejfy, flaga env (05.09)

Gałąź `agent/idea-podglad-kanon-20260905` (baza `b3137c81e3`, linia m03).
Cztery commity: `b473391a7f`, `9bb08f7c96`, `022c3417e0`, `16ea5b335e`.

---

## 0. NAJPIERW SPROSTOWANIE ZLECENIA (pomiar przed zmianą, punkt 1)

Zlecenie mówiło: „podgląd Pomysłów to bespoke panel — przepnij go na TEN SAM
kanoniczny komponent, którego używają zatwierdzone listy (Zadania, Decyzje,
Skrzynka — `StandardPreview`/`PreviewPaneShell`)". **Zmierzyłem to i to
nieprawda w obie strony.** Nie przepinałem, bo przepięcie pogorszyłoby stan.

| Ekran (produkcja) | Powłoka | Bloki 2-6 |
|---|---|---|
| Pomysły — tabela (`IdeasTableContent.tsx:630`) | `TableWithPreviewLayout` → `PreviewPaneShell` | `IdeaPreviewBody`/`IdeaPreviewFooter` z prymitywów `PreviewPane` |
| Pomysły — karty (`MyIdeasListContent.tsx:1908`) | to samo | ten sam `IdeaPreview.tsx` |
| Zadania (`MyTasksListContent.tsx:2662`) | `TableWithPreviewLayout` → `PreviewPaneShell` | prymitywy `PreviewPane` |
| Decyzje (`DecisionPreviewPanel.tsx:264`) | `PreviewPaneShell` | prymitywy `PreviewPane` |
| Skrzynka (`InboxContent.tsx:1667`) | `PreviewPaneShell` | prymitywy `PreviewPane` |

**ŻADEN z czterech produkcyjnych podglądów nie montuje `StandardPreview`.**
Wszystkie cztery składają bloki 2-6 z tych samych prymitywów w tej samej
powłoce. Podgląd Pomysłów został zresztą 02.09 celowo zunifikowany w JEDNYM
pliku `src/components/MyWork/IdeaPreview.tsx` (nagłówek pliku opisuje tę
naprawę) i już dziś ma komplet kanonu: `PreviewMetaCard` → `PreviewDetailsSection`
(+`ArtifactPropertiesTable`) → `PreviewAIHintStrip` → `PreviewRelations` →
`PreviewActionBar` → `PreviewWhatsNextCard`. Przepięcie samych Pomysłów na
`StandardPreview` **rozjechałoby** je z pozostałymi trzema — czyli dałoby
dokładnie ten defekt, który zlecenie chciało usunąć.

### Skąd wzięła się teza o „bespoke"
Werdykt `ROZNI_SIE` dla id `idea-table` w pomiarze 05.09 porównuje **dwa różne
ekrany**:

* obraz zatwierdzony `evidence/grafika/144-runda-pelna/idea-table__PO__light.png`
  to **Tabela pomysłów** — ARTEFAKT (archetyp D Matryca), trasa
  `/my-work/ideas/<id>/workspace/table`, i jego prawy panel to `ArtifactRightPanel`
  (AKCJE / WŁAŚCIWOŚCI / POWIĄZANIA / ŹRÓDŁA I ZAŁOŻENIA / KOMENTARZE / HISTORIA)
  — dla artefaktu **zgodnie z SPEC-A**, nie wbrew kanonowi;
* zrzut na żywo `evidence/odbior-zywo-20260905/02-moja-praca/idea-table.png` to
  **lista Pomysłów w Mojej Pracy** (`/my-work`, klik `mywork-tab-ideas`, klik w wiersz),
  czyli ekran listowy, którego prawa strona to **preview pane** — i który słusznie
  ma sześć bloków, a nie akordeon artefaktu.

Właściwy obraz odniesienia dla tego podglądu to
`evidence/grafika/144-runda-pelna-b/preview-4-zakladki__PO__light.png`, kolumna
`Ideas`. **On też jest przyrządem, nie produktem** — plik `dev-render/screens/preview-4-zakladki.tsx`
montuje `StandardPreview` z ręcznie wpisaną treścią; nagłówek pliku mówi to wprost.

---

## 1. CO REALNIE BYŁO ZŁE (i jest naprawione)

### 1.1 Stopka zjadała 69 % panelu, blok „Szczegóły" był ucięty — NAPRAWIONE

Pomiar na żywo (własny vite `:3085`, kopia `.env.local`, sesja odbioru,
1440×900, jasny; `/my-work` → Pomysły → klik w wiersz), wysokości realnych
elementów DOM:

```
PRZED: panel 728 px = nagłówek 64 + TREŚĆ 138 + STOPKA 500     (stopka = 69 %)
PO:    panel 728 px = nagłówek 64 + TREŚĆ 322 + STOPKA 316
```

Blok „Szczegóły" ma własną wysokość **264 px**. W 138-pikselowym okienku (minus
karta meta 50 px i padding) zostawał z niego pasek ~70 px — na zrzucie 05.09
widać nagłówek tabeli właściwości („Właściwość | Wartość") ucięty w połowie,
**bez ani jednego wiersza danych**. `CANON_PREVIEW_BLOCK_HEIGHT.detailsMin`
= 200 px jest twardą dolną granicą tego bloku: 70 < 200, więc naruszenie jest
arytmetyczne, nie estetyczne. To jest treść zgłoszenia „preview nie jest zgodny
ze wzorem" — wzór ma blok Szczegóły, produkt miał w tym miejscu pustkę.

**Mechanizm.** `PreviewPaneShell` układa panel jako `header(shrink-0)` ·
`body(flex-1)` · `footer(shrink-0)`. Przy `shrink-0` stopka bierze tyle, ile
chce, a `flex-1` oddaje resztę. Im więcej kart w stopce (blok 4 AI + blok 5
Powiązania + blok 6 Akcje + „Co dalej" z siedmioma pigułkami), tym mniej zostaje
na TREŚĆ.

**Naprawa w powłoce, nie w ekranie.** Ta sama powłoka niesie podglądy Zadań,
Decyzji, Skrzynki i Pomysłów — łatanie „stopki Pomysłów" dałoby „poprawne
w 1 z 4" i odrosłoby przy pierwszej nowej karcie stopki gdziekolwiek indziej.
Sufit stoi w `previewGeometry.ts` i jest **złożony z kanonu**, nie wpisany liczbą:

```
PREVIEW_BODY_MIN_PX      = meta 88 + detailsMin 200 + 2×wrapperPadding 12 + cardGap 10 = 322
PREVIEW_FOOTER_MAX_HEIGHT = calc(100% − (64 + 322)px)
```

Stopka dostaje własne `overflow-y-auto`, więc akcje pozostają osiągalne.
**Brak zmiany dla paneli, które się mieszczą** — sufit jest maksimum.

Pliki: `src/components/shared/PreviewPane/previewGeometry.ts`,
`src/components/ui/ResizableTable/PreviewPaneShell.tsx`.
Test: `src/components/shared/__tests__/previewFooterCeiling.20260905.test.tsx`
(4 asercje). **Dowód mutacyjny wykonany**: usunięcie `style={{ maxHeight }}` ze
stopki → 1 failed / 3 passed; przywrócenie → 4 passed.

### 1.2 Blok AI Pomysłów miał chipy skopiowane z Zadań — NAPRAWIONE

Produkcja pokazywała „Dlaczego pilne? / Plan działania / Kto może pomóc?" — te
trzy stringi to **co do znaku** komplet z `MyTasksListContent.tsx:2680`. Kanon
§7.3 pkt 4 wymaga chipów dopasowanych do ENCJI; pomysł na etapie „Iskra" nie ma
pilności ani planu działania. Obraz zatwierdzony (kolumna Ideas) ma „Rozwiń
pomysł / Znajdź ryzyka / Zaproponuj następny krok" — i to jest wstawiony zestaw.
Poprawka trafia w jeden wspólny `IdeaPreview.tsx`, więc obejmuje oba widoki Idei
naraz (tabela + karty).

Test: `src/components/MyWork/__tests__/IdeaPreview.aiChipsEntity.20260905.test.tsx`
(2 asercje: nowe chipy są, zadaniowe znikły).

### 1.3 Flaga env NIE działała w ŻADNEJ ze 109 flag — NAPRAWIONE

Zgłoszenie: „Case finansowy" pojawiał się wyłącznie z `?ff_ideaFinancialCase=1`,
mimo `VITE_IDEA_FINANCIAL_CASE=true` w `.env.local`.

**Przyczyna zmierzona na transformacie Vite, nie z lektury kodu.** `readEnvFlag()`
we wszystkich 109 plikach flag pisał:

```ts
const meta = import.meta as unknown as { env?: Record<string, string | undefined> };
parseFlag(meta?.env?.[ENV_KEY]);
```

Vite podstawia obiekt środowiska **tylko tam, gdzie w module stoi dosłowny token
`import.meta.env`**. Tu stał sam `import.meta`. Dowód — moduł pobrany z serwera dev:

```
$ curl -s http://localhost:3085/src/utils/ideaFinancialCaseFlag.ts
    const meta = import.meta;                    ← BEZ prologu `import.meta.env = {…}`
```

Dla porównania moduł sondujący, który zawiera dosłowny token, dostaje w prologu
pełny obiekt z `"VITE_IDEA_FINANCIAL_CASE": "true"`. W przeglądarce `import.meta`
ma tylko `url`, więc `meta.env === undefined` → env nie działał **nigdzie**: ani
w dev, ani w buildzie (`vite build` też podstawia wyłącznie dosłowny token).

**Naprawa** — jedna linia × 109 plików, wszystkie odczyty niżej bez zmiany:

```ts
const meta = { env: import.meta.env } as unknown as { env?: Record<string, string | undefined> };
```

**Dowód na żywo:** `isIdeaFinancialCaseEnabled()` `false` → `true`, bez parametru URL,
z samego `.env.local`.

**⚠ DO DECYZJI NADZORCY.** Naprawa obejmuje rodzinę (fix 1/109 gwarantowałby
odrost), ale przez to **trzy flagi zmienią zachowanie na stanowisku z tym
`.env.local`** — dopiero teraz ich `=false` jest widziane, a domyślka w kodzie
to `true`:

* `VITE_BACK_TO_CHAT_BUTTON=false`
* `VITE_BACK_TO_CHAT_SHORTCUT=false`
* `VITE_WORKSPACE_BREADCRUMB=false`

To jest zgodne z treścią `.env.local` (plik jest w `.gitignore`, więc nie wpływa
na demo/staging inaczej niż przez zmienne w Railway), ale jest to zmiana
**widoczna** — jeśli te trzy mają zostać włączone, poprawka jest w `.env.local`,
nie w kodzie.

Bezpiecznik przeciw odrostowi:
`src/utils/__tests__/envFlagReadsViteEnv.20260905.test.ts` skanuje całe `src/`
i pada, gdy którykolwiek plik wróci do starego kształtu. **Dowód mutacyjny
wykonany** (przywrócenie starej linii w `ideaFinancialCaseFlag.ts` → 1 failed).

---

## 2. CZEGO NIE ODTWORZYŁEM — tabela sejfów

Zgłoszenie z pomiaru 05.09: „po otwarciu podglądu tabela się zwęża i tekst
kolumny NAZWA nachodzi na wartość kolumny ZAKRES".

**Zmierzyłem na żywo na tej gałęzi i defektu nie ma.** `/my-work` → „Sejf
klienta" → klik w wiersz, 1440×900:

```
kontener 920 px · tabela 920 px  (bez nadmiaru, bez okluzji)
Nazwa 180 · Zakres 112 · Dokumenty 112 · Rozmiar 100 · W wiedzy AI 112 ·
Błędy indeksowania 112 · Ostatnia zmiana 112 · akcje 80   = 920
```

Komórki ciała mierzone w t+200 / t+500 / t+1500 ms po kliknięciu (na wypadek
przejściowego stanu w animacji `framer-motion`): wewnętrzny span każdej z trzech
pierwszych kolumn kończy się **16 px PRZED** krawędzią swojej komórki
(`over = −16`), czyli nic nie wychodzi poza kolumnę.

Dodatkowo: zrzut dowodowy `vault-safes-table.png` z pomiaru 05.09 pokazuje stan
**przed** kliknięciem w wiersz (podgląd zamknięty, UI po angielsku) — opisanego
nachodzenia na nim nie widać. Zgłoszenie było robione na serwerze `:3000`, czyli
na **innym kodzie** niż ta gałąź; `FilterableTable.columnFit` ma naprawy
szerokości z 01.09 (`budget < floorTotal` → zjazd do podłóg, kolumna pierwotna
`name`/`title` nie schodzi do podłogi).

**Nie zmieniałem szerokości kolumn.** Naprawianie defektu, którego pomiar nie
potwierdza, to wpisanie tezy nadzorcy w kod. Jeśli defekt jest realny, potrzebny
jest zrzut ze stanem PO kliknięciu i SHA serwera, na którym powstał.

---

## 3. RÓŻNICE WOBEC OBRAZU ZATWIERDZONEGO, KTÓRYCH ŚWIADOMIE NIE RUSZAŁEM

Obraz `preview-4-zakladki__PO__light.png` (kolumna Ideas) vs produkcja:

1. **`Konwertuj` (primary) w bloku 6.** Obraz ma dwa przyciski akcji
   (`Konwertuj` + `Otwórz Flow`), produkcja ma sam `Otwórz Flow`, bo konwersje
   żyją w „Co dalej" (`ConvertToOutputMenu`). Kanon §7.3a mówi wprost, że
   create-targety idą do „Co dalej" — czyli **produkcja jest tu bliżej kanonu
   niż obraz**. Wymaga rozstrzygnięcia właściciela, nie decyzji robotnika.
2. **Dopisek „Najpierw tworzy sesję MyWork".** Obraz stawia go POD pigułkami,
   produkcja NAD. Pozycja NAD jest **udokumentowaną decyzją**
   (`ConvertToOutputMenu.tsx:219-227`, ANEKS #4 / `_PRZEGLAD_DOMOWY_WYNIKI_2026-07-10` #4/#254
   — dubel dwóch renderów zlikwidowany właśnie przez ujednolicenie na górze).
   Nie cofam rozstrzygniętej sprawy bez decyzji.
3. **Pigułki meta bez etykiet.** Obraz ma „Etap: Rośnie", „Narzędzie: Mind Map",
   „Właściciel: …"; produkcja ma same wartości („Rośnie", „Mapa myśli"). To
   **cecha przyrządu, nie defekt Pomysłów**: Zadania (`MyTasksListContent.tsx:2614`)
   też podają `MetaPill` bez pola `value`. Zmiana samych Pomysłów rozjechałaby
   rodzinę; zmiana całej rodziny to osobne zlecenie.
4. **Zestaw pigułek „Co dalej"**: obraz 5 (Raport·Prezentacja·Tabela·Notatka·Inicjatywa),
   produkcja 7 (dochodzą Model finansowy·Budżet·Wycena·Analiza finansowa).
   To dane/konfiguracja `ConvertToOutputMenu`, nie układ.

---

## 4. DOWODY

* Zrzuty: `evidence/idea-podglad-20260905/`
  * `podglad-pomyslu__PRZED__light.png` — blok „Szczegóły" znika całkowicie
  * `podglad-pomyslu__PO__light.png` — „Szczegóły" z licznikiem `~18 słów`, kebabem, prozą i tabelą właściwości
  * `podglad-pomyslu__PO__dark.png` — to samo w ciemnym
  * kontrola par: `mean_luma` 246.5 (jasny) / 24.3 (ciemny), cztery różne sumy md5 — para nie jest duplikatem
* Ekran przyrządu: `dev-render/screens/podglad-pomyslu-sufit-stopki.tsx`
  (`?screen=podglad-pomyslu-sufit-stopki`, `&sufit=0` = stan PRZED). **Nie jest
  re-implementacją**: montuje realny `PreviewPaneShell` + realny `IdeaPreviewBody`
  + realny `IdeaPreviewFooter`, tak jak składa je `TableWithPreviewLayout:611-619`;
  `?sufit=0` zdejmuje sufit z TEGO SAMEGO elementu stopki.
* `bash scripts/check-list-canon.sh <7 plików>` → **EXIT 0**, „naruszeń 0, baseline 0".
* Testy (6 plików, 57 asercji, wszystkie zielone): nowe trzy + zastane
  `tablePreviewGeometry.r03-2`, `standardPreview.r03`, `demoAcceptanceFlags`.

### Ograniczenia dowodu (zgłaszam, nie ukrywam)

1. **Sesja odbioru wygasła w trakcie pracy.** Pierwsze pomiary (wysokości bloków
   podglądu, szerokości kolumn sejfów) zrobiłem na ŻYWYM produkcie zalogowaną
   sesją; potem `/auth/refresh` zaczął zwracać 401 i `zrzut.mjs` lądował na
   `/login`. Odnowienia nie mogę zrobić — `zaloguj.mjs` z założenia wymaga, żeby
   właściciel zalogował się sam. Dlatego zrzuty są z harnessu dev-render (ścieżka
   z CLAUDE.md #7), a nie z zalogowanej aplikacji, i **nie ma zrzutu tabeli
   sejfów po naprawie** (naprawy nie było — patrz §2 — ale zrzutu stanu też nie ma).
2. `zrzut.mjs` **na tej gałęzi** jest starą kopią z portem 3009 wpisanym na stałe;
   wersja z `--port` leży niecommitowana w `/private/tmp/m03`. Użyłem tej drugiej
   z kopii poza repo; nie commitowałem jej, bo to plik innego wątku.
3. Pigułki harnessu „Lista"/„Uwagi" nie mają `data-dev-render-chrome`, więc
   `--bez-chrome` ich nie chowa. Stoją w prawym dolnym rogu i nie zasłaniają panelu.

---

## 5. PROCESY

Uruchomione przeze mnie i **zatrzymane po PID**: vite aplikacji `:3085`
(`/private/tmp/ag-idea-preview-vite.pid`), vite harnessu `:3086`
(`/private/tmp/ag-idea-devrender.pid`). Żadnego `pkill`.
Zapisów do baz stagingu/demo nie było. `git push` nie było.
