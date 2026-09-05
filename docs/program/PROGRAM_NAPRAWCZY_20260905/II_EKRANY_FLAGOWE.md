# II. Ekrany flagowe — 16 modułów do poziomu sceny

Jedna paczka na moduł: ekran, który po naprawie ma dostać od właściciela „tak" na pierwszy rzut oka,
bez pytań. Wybory ekranów pochodzą z `docs/program/AUDYT_AWARD_20260905/{A,B,C,D}*.md` (kolumna
„Ekran flagowy"/„Rekomendacja flagowa"), tam gdzie audyt zastrzegł warunek — warunek jest tu
utrzymany dosłownie. Każda paczka trzyma się `00_SZABLON_PACZKI.md`; sekcje, które się nie stosują,
mają wprost „nie dotyczy".

## Jak czytać tę paczkę

- **HEAD zweryfikowane w tej sesji:** `259be4e35b28970af2bf93f1188b7feeac7eb7c1` (branch
  `codex/m03-admin-20260824`, ten sam kod, na którym audyt A/B/C/D był pisany tego samego dnia,
  HEAD tam cytowany `1deab43c18d0d6f4c2bc1b339c1a32f79164f427` — kod się nie ruszył, tylko
  narosły dwa dodatkowe commity dokumentacyjne między audytem a tą paczką).
- **Metoda cytowania plik:linia** — audyt A/B/C już wykonał `rg`/odczyt pliku na tym samym HEAD.
  W tej sesji ponownie zweryfikowano `rg`/`sed -n` na ośmiu z cytowanych miejsc, rozrzuconych po
  różnych modułach i różnych „przyczynach wzorcowych" (P1–P6): `FilterableTable.tsx:788-789`,
  `InitiativeFullView.tsx:438,503,860`, `MainLayout.tsx:428`, `SystemHealth.tsx:21-26`,
  `okrObjectiveCommands.ts:121` (nazwa funkcji `assertSetEditableForUpdate` dosłownie w kodzie),
  `megatrend.routes.ts:18-31`, `IdeaAINudgeStrip.tsx:108-135`, `InitiativeWizardModal.tsx:604-606`
  — wszystkie zgodne co do słowa z tym, co cytuje audyt. Pozostałe cytaty przyjęto z zaufaniem do tej
  samej metody; miejsca, w których sam audyt napisał „nie zidentyfikowano", zostają tak oznaczone
  tutaj — nie zgaduję linii, których audyt świadomie nie podał.
- **Zamrożenie MVP** — `docs/program/MVP_FINAL_ZAMROZONE.json` (`_zaktualizowano: 2026-09-05`) ma
  dziś **14 wpisów** zamrożonych: `13_CHAT`, `01_ORGANIZATION`, `02_INTERVIEW`, `03_TOOLS`,
  `04_ASSESSMENT`, `05_INITIATIVES`, `06_EXECUTION`, `07_MY_WORK_AGENT`, `08_MEETINGS`,
  `11_MATERIALS`, `12_AUDITS`, `14_ADMIN`, `15_SETTINGS`, `16_PARTNER`. **Uwaga na rozjazd
  liczników** (wzorzec z pamięci nadzorcy „Dwa rejestry — licznik mierzy rozjazd"): prozaiczne
  podsumowanie w `D_SYNTEZA_I_PLAN.md` §4 mówi „trzynaście modułów zamrożonych" — plik JSON,
  który jest generowany wyłącznie skryptem `scripts/mvp-final/zamroz.mjs` po realnym „tak"
  właściciela, liczy **14**. Ta paczka traktuje JSON jako źródło prawdy (rejestr generowany
  automatycznie > podsumowanie prozą) i **nie** rozstrzyga, który moduł D_SYNTEZA pominęła w
  liczeniu — to osobne pytanie do właściciela, nie do zgadnięcia tutaj. Nie zamrożone: **Wyniki**,
  **Finanse** (oba jawnie „otwarte" wg §4 audytu D).
  → Każdy krok wykonania, który dotyka pliku należącego do modułu na liście zamrożonych, wymaga
  w komunikacie commita znacznika `[ODMROZENIE <MODUL> DEC-<nr>]` (bezpiecznik
  `scripts/mvp-final/check-freeze.sh`, `.husky/commit-msg`). Numer DEC nie istnieje jeszcze dla
  żadnej z poniższych 14 odmrożeń — najwyższy przydzielony w repo na dziś to `DEC-396`
  (`docs/program/PLAN_NAPRAW_MVP_20260905.md`), więc kolejny wolny to `DEC-397` i dalej w kolejności
  zgłaszania właścicielowi. **Żaden numer DEC poniżej nie jest zatwierdzoną decyzją** — to
  proponowana pula do zarezerwowania w rozmowie z właścicielem, nie fakt.
- **Wzorce „złota"** (referencje 1:1, nie do przerysowywania — do porównania piksel-w-piksel):
  `evidence/odbior-cto-20260905/moja-praca/polish/a-table-no-selection.png` (tabela bez zaznaczenia —
  wzorzec StandardTable), `evidence/odbior-zywo-20260905/08-wyniki/okr-cel/proof-okr-L2.png` (karta
  celu OKR — wzorzec ekranu-rekordu, dokładnie ekran flagowy Wyników niżej), `evidence/odbior-zywo-20260905/02-moja-praca/mapa-jeden-panel/02-element.png`
  (jeden prawy panel z zakładkami Element/Teresa — wzorzec, do którego sprowadzamy P1).
- **Viewporty** — każdy ekran flagowy ma być bez zastrzeżeń przy **1280 / 1440 / 1920 px**, jasny
  **i** ciemny motyw. Audyt A/B/C zmierzył jasny motyw wszędzie i 1280/1920 tylko dla ekranów
  oznaczonych „flagowy" w źródle — ciemny motyw **zero ekranów w całym audycie** (patrz dokument IV).
  Każda paczka niżej ma osobny wiersz w sekcji 6 „Testy" na brakujący pomiar ciemnego motywu —
  to nie jest opcjonalne dopięcie, to pełnoprawny dług pomiarowy.
- **Kryterium odbioru = jedno zdanie, bez pytań** — właściciel patrzy raz, na czystym zrzucie
  (harnessem, nie „włącz flagę i zobacz" — zasada nienaruszalna z `CLAUDE.md`), i mówi „tak".

Skróty przyczyn wspólnych (z `D_SYNTEZA_I_PLAN.md` §2-3, pełny opis tam):
**P1** jeden zwijany prawy panel · **P2** tabela nie ucina (dymek) · **P3** koniec angielskiego ·
**P4** żadnych kodów/UUID/nazw funkcji w UI · **P5** nic nie wisi w ciszy · **P6** czerwień tylko
krytyczna + przegląd 1440 px · **P7** nawigacja KPI (WYKONANE 05.09, scalone `dda794943e`) ·
**P8** sprzątanie danych demo.

---

## 1. Czat AI

**1. Cel dla użytkownika.** Otwarcie dowolnej wcześniejszej rozmowy wygląda i brzmi jak jeden,
dopracowany produkt — bez angielskiego słowa w plakietce zaufania i bez śladu testowych danych w
historii.

**2. Zakres.** Ekran: **otwarta konwersacja @1920 px** (`evidence/audyt-award-20260905/czat/08-flagowy-1920.png`,
`07-flagowy-1280.png`; audyt A §2, wiersze „Ekran flagowy 1280/1920 px"). Wariant zapasowy bez
żadnej poprawki: ekran startowy/powitanie (`czat/01-powitanie.png`). Moduł zamrożony:
`13_CHAT` w `MVP_FINAL_ZAMROZONE.json` (zamrożono 2026-09-05T10:33:27Z, decyzja „grafika
zatwierdzona, zamrażamy"). 1 ekran flagowy, dotyka też 1 komponentu globalnego (`SystemHealth`,
widoczny w Menu 1 każdego modułu, więc naprawa CZ6 nie jest lokalna dla Czatu, ale nie jest
częścią *tego* ekranu flagowego — pomijana tutaj, patrz P4/P5 w innych paczkach).

**3. Przyczyna źródłowa.**
- Brak klucza i18n `trust.badge.sources` w `public/locales/pl/translation.json` **ani**
  `en/translation.json` → renderuje się angielski fallback „{{count}} sources".
  Plik: `src/components/AIChat/TrustBadge.tsx:384`. (audyt CZ2, nie zweryfikowane ponownie w tej
  sesji — metoda: dwa odczyty plików JSON przez audytora).
- 404 na `/api/ai/stream/partial/:id` przy każdym otwarciu historycznej konwersacji — kontrakt
  zamierzony („brak partial do wznowienia"), ale realizowany jako HTTP 404 zamiast `200 {found:false}`.
  Wołacz: `src/hooks/useAIStream.ts:1479`. Handler: `server/src/routes/ai.routes.ts:6446` (CZ1).
- Dane testowe w koncie demo używanym do zrzutów: dwa foldery „TEST_PROJ_P2"/„QA folder
  1778037649725", przypięta rozmowa „test Tomek" — to dane w bazie stagingu, nie kod (CZ4).

**4. Projekt rozwiązania.** Żadna zmiana architektoniczna — trzy punktowe poprawki w istniejącym
kanonie: (a) dodać klucz i18n z formami liczby mnogiej w oba pliki `translation.json` (wzorzec:
sąsiednie klucze w tym samym pliku), (b) zmienić kontrakt odpowiedzi `ai.routes.ts:6446` z 404 na
200 z payloadem `{found:false}` — **to zmiana kontraktu API, wymaga koordynacji z każdym miejscem,
które dziś interpretuje 404 jako brak partiala** (grep przed zmianą), (c) operacja na danych: usunąć
z konta demo trzy testowe pozycje. Zakaz: nie tworzyć nowego komponentu plakietki — poprawka jest w
istniejącym `TrustBadge.tsx` i słownikach i18n.

**5. Kroki wykonania.**
1. `public/locales/pl/translation.json` + `en/translation.json`: dodać `trust.badge.sources_one` /
   `_few` / `_many` (S, Sonnet). **Dotyka modułu zamrożonego `13_CHAT` → wymaga
   `[ODMROZENIE 13_CHAT DEC-397]` w commicie** (numer do potwierdzenia z właścicielem, patrz uwaga
   o DEC wyżej).
2. `server/src/routes/ai.routes.ts:6446`: zmienić odpowiedź braku partiala z `res.status(404)` na
   `res.status(200).json({found:false})`; zweryfikować grepem `useAIStream.ts` i inne miejsca
   konsumujące ten endpoint, że nie zakładają 404 jako sygnału (S/M, Sonnet z jednym przeglądem
   Opusa — to zmiana kontraktu). Wymaga `[ODMROZENIE 13_CHAT DEC-397]`.
3. Operacja na danych stagingu: usunąć/zarchiwizować „TEST_PROJ_P2", „QA folder 1778037649725",
   rozmowę „test Tomek" z konta użytego do zrzutów (S, operacja ręczna, nie kod — nie wymaga
   znacznika odmrożenia, bo nie dotyka plików modułu).
4. Ponowny zrzut przy 1280/1440/1920, jasny **i** ciemny (krok nieistniejący dziś — patrz dokument IV
   dla `--theme=dark`).

**6. Testy.**
- Jednostkowe: rozszerzyć istniejący test `TrustBadge` (jeśli istnieje) o asercję, że dla
  `count=1` renderuje się polski tekst z klucza, nie fallback z kodu; dowód mutacyjny — usunięcie
  klucza z `pl/translation.json` musi zawalić test.
- Wizualne: `07-flagowy-1280.png`, `08-flagowy-1920.png` ponownie przy 1440; **brak pomiaru w
  ciemnym motywie dla całego modułu Czat — do wykonania (dokument IV)**.
- Przepływ klikany: patrz dokument III, Czat.

**7. Kryterium odbioru właściciela.** Otwarcie dowolnej starszej rozmowy na 1920 px pokazuje
polski tekst przy plakietce źródeł, zero angielskich fragmentów w kadrze, zero pozycji „test"/„QA"
w panelu historii — właściciel widzi to raz i mówi „tak".

**8. Ryzyka i cofanie.** Zmiana kontraktu 404→200 w kroku 2 jest jedynym ryzykownym elementem —
jeśli inny konsument API polega na kodzie 404, cofnięcie = rewert jednego commita (nie tag, bo to
punktowa zmiana w zamrożonym module — rewert commita z zachowaniem znacznika odmrożenia w wiadomości
cofającej). Usunięcie danych testowych jest nieodwracalne w sensie „dane znikają" — ale to dane
demo, nie klienta, zgodne z regułą „dane demo = twarz produktu, zero rekordów testowych".

**9. Nakład.** Krok 1: S (Sonnet, 0,5 dnia). Krok 2: M (Sonnet + przegląd Opusa, 1 dzień). Krok 3:
S (0,25 dnia, operacja ręczna). Razem: **~1,75 dnia**, w większości równoległe (krok 1 i 3 nie
zależą od siebie).

---

## 2. Moja Praca

**1. Cel dla użytkownika.** Skrzynka pokazuje wszystkie kolumny na laptopie (1280 px), nagłówki są
czytelne do końca, a panel Teresy da się zamknąć, żeby zobaczyć całą tabelę.

**2. Zakres.** Ekran: **Skrzynka — tabela z otwartym podglądem** (`evidence/audyt-award-20260905/moja-praca/01-skrzynka-lista.png`,
`02-skrzynka-preview.png`, ekrany flagowe `28-flagowy-skrzynka-1280.png`, `29-flagowy-skrzynka-1920.png`;
audyt A §1). Moduł zamrożony jako `07_MY_WORK_AGENT` (zamrożono 2026-09-05T14:59:11Z). To jest też
uwaga właściciela ze stagingu wprost: „mam nadzieję, że ten prawy panel można zwinąć, żeby mieć cały
ekran do pracy" oraz osobno (tabela Pomysłów) „mam wielki problem z prawym panelem, bo nie mogę go
zamknąć" — dwa zgłoszenia tego samego dnia (§4 audytu D).

**3. Przyczyna źródłowa.**
- **MP1** — dok Teresy jest trzecią stałą kolumną obok tabeli i podglądu (nie zakładką w jednym
  panelu), w Mojej Pracy współistnieją dwa różne komponenty prawego panelu; wzorzec docelowy już
  istnieje w tym samym module — `IdeaMapWorkspace.tsx:4650` (komentarz „(3) domyślnie → panel
  elementu z zakładkami Element | Teresa"), zaimplementowany w `src/components/standard/ArtifactRightPanel.tsx`
  (zweryfikowane: plik istnieje w drzewie `src/components/standard/`).
- **MP2/P2** — `src/components/shared/ModuleHub/FilterableTable.tsx:788-789` (zweryfikowane `sed -n`
  w tej sesji): `defaultColumnConfigs` ustawia `width: parsePx(..., 140)` i `minWidth: 90` dla
  wszystkich kolumn poza `title`/`name` — za wąsko na polskie nagłówki, tooltip tylko natywny `title`
  (wolny, bez stylu). Ten sam plik ma już własny komentarz przy linii ~907-917 przyznający, że
  `table-fixed` bez zmiany logiki dopasowania „niczego nie ratuje" — czyli to jest ta sama rodzina
  defektu, którą plik już raz próbował leczyć punktowo.
- **MP3** — trzecia kolumna (MP1) nie jest ujęta w budżecie szerokości, więc przy 1280 px tabela
  Skrzynki kurczy się do jednej kolumny (dowód: `28-flagowy-skrzynka-1280.png`).

**4. Projekt rozwiązania.** Jeden wzorzec: sprowadzić prawy dok Teresy na listach do tego samego
`ArtifactRightPanel` z zakładkami **Element | Teresa**, który już działa w Idea Workspace — panel
zamykany krzyżykiem, przywracany pigułką, chowany automatycznie poniżej pełnej szerokości (kanon
§19.1 „≥1280 = pełny układ" musi liczyć budżet szerokości WŁĄCZAJĄC panel, nie obok niego). Równolegle:
podnieść domyślną szerokość niekluczowych kolumn w `FilterableTable.tsx` (160–180 px) i **zawsze**
pokazywać dymek (nie tylko natywny `title`) gdy zmierzona szerokość tekstu przekracza kolumnę — to
poprawka u źródła współdzielonego komponentu, obowiązująca też Wywiad/Realizację/Inicjatywy/Narzędzia
(patrz ich paczki). Zakaz: żadna lokalna tabela/panel per ekran (kanon pkt 9 `CLAUDE.md`) — obie
poprawki żyją w komponentach współdzielonych.

**5. Kroki wykonania.**
1. Zidentyfikować oba komponenty prawego panelu współistniejące w Mojej Pracy (audyt: „nie
   zidentyfikowano jednego pliku" — pierwszy krok to `rg` po miejscach montujących dok Teresy w
   `MyWork*.tsx`/`*ListContent.tsx`) i zamienić na `ArtifactRightPanel` z zakładkami. **L, Opus**
   (zmiana dotyka współdzielonego wzorca UI, wysokie ryzyko regresji na 5 ekranach: Skrzynka,
   Pomysły, Zadania, Decyzje, Sejf). Wymaga `[ODMROZENIE 07_MY_WORK_AGENT DEC-398]`.
2. `FilterableTable.tsx:788-789` + logika dymka: podnieść domyślne szerokości, dodać komponent
   tooltip (nie natywny `title`) gdy zmierzona szerokość renderowanego tekstu > szerokość komórki.
   **M, Sonnet** — plik współdzielony przez wszystkie moduły z tabelą, więc to jest **P2** i naprawia
   ~25 ekranów naraz (patrz `D_SYNTEZA_I_PLAN.md` §2 wiersz 2). Nie wymaga znacznika odmrożenia per
   moduł, bo plik nie należy do listy plików żadnego zamrożonego modułu w `MVP_FINAL_ZAMROZONE.json`
   (`FilterableTable.tsx` nie występuje w tablicy `pliki` dla `07_MY_WORK_AGENT` — do potwierdzenia
   przed commitem, bo jeśli występuje w innym zamrożonym module, znacznik jest wymagany tam).
3. Budżet szerokości Skrzynki: po kroku 1 panel jest zakładką, nie osobną kolumną — MP3 znika jako
   efekt uboczny kroku 1, bez osobnej zmiany. **S, weryfikacja, nie kod.**

**6. Testy.**
- Jednostkowe: test na `ArtifactRightPanel` — otwarcie zakładki „Teresa" nie usuwa danych zakładki
  „Element" po przełączeniu (regresja stanu); dowód mutacyjny — usunięcie `key` na zawartości
  zakładki musi zawalić test przełączania. Test na `FilterableTable` — kolumna węższa niż
  zmierzony tekst renderuje dymek z pełną treścią (dowód mutacyjny: podmiana progu na `Infinity`
  musi zawalić test).
- Wizualne: `01-skrzynka-lista.png`, `28-flagowy-skrzynka-1280.png`, `29-flagowy-skrzynka-1920.png`
  ponownie po naprawie, dodatkowo **ciemny motyw — brak pomiaru dziś (dokument IV)**.
- Przepływ klikany: dokument III, Moja Praca (Skrzynka → otwórz rekord → zamknij panel → przywróć
  panel → filtr Menu 3 przeżywa przełączenie zakładki, MP16).

**7. Kryterium odbioru właściciela.** Na laptopie (1280 px) tabela Skrzynki pokazuje wszystkie
kolumny na raz, panel Teresy da się zamknąć krzyżykiem i wraca pigułką — właściciel widzi to raz i
mówi „tak", bez pytania „gdzie jest reszta tabeli".

**8. Ryzyka i cofanie.** Krok 1 (Opus, L) to największe ryzyko regresji w tej paczce — dotyka
wspólnego wzorca na 5 ekranach naraz. Bezpiecznik: wdrożenie za flagą OFF, zrzut własny nadzorcy
przed pokazaniem właścicielowi (zasada „Piotr nigdy nie jest pierwszym testerem wizualnym"), cofanie
= flaga OFF natychmiast, potem `git revert` na commit(y) kroku 1. Punkt bezpieczny do tagowania
przed startem: `demo-safe-<data>` bieżący.

**9. Nakład.** Krok 1: L (Opus, 3-4 dni + 1 dzień QA regresji na 5 ekranach). Krok 2: M (Sonnet,
1,5 dnia — plik współdzielony, testy w kilku miejscach). Krok 3: S (0 dodatkowego kodu). Razem:
**~5-6 dni**, kroki 1 i 2 częściowo równoległe (różne pliki, różni wykonawcy).

---

## 3. Wywiad

**1. Cel dla użytkownika.** Lista „Skrzynka" jest jednym, spójnym paskiem nawigacji (nie dwoma
rzędami zakładek), czytelna od 1280 px w górę, bez odniesień do DRD (właściciel: „DRD nie jest w
wywiadzie").

**2. Zakres.** Ekran: **lista główna „Skrzynka" @1920 px** (`evidence/audyt-award-20260905/wywiad/01c-lista-glowna-1920-full.png`;
audyt A §3). Moduł zamrożony jako `02_INTERVIEW` (2026-09-05T14:58:51Z). Warunek z audytu: **nie**
pokazywać wariantu 1280 px (W3), podglądu (W6) ani interakcji ze stepperem (W2) przed naprawą — ten
warunek jest twardszy niż zwykle, bo dotyczy trzech z czterech zmierzonych stanów tego samego ekranu.

**3. Przyczyna źródłowa.**
- **W1** — dwa rzędy zakładek dla tych samych 6 sekcji w RÓŻNEJ kolejności: Menu 2 vs
  `src/components/Interview/InterviewPipelineStepper.tsx`, montaż w
  `src/components/Interview/InterviewHub.tsx:9659-9660`; „Sesje" nie występuje w drugim rzędzie —
  nieudokumentowany trzeci poziom nawigacji poza architekturą Menu 1/2/3.
- **W2/W3** — siatka pigułek steppera nie kurczy się poniżej ~1920 px (zmierzona delta 247-407 px w
  sidecarach), klik w daleką pozycję przewija cały nagłówek i chowa breadcrumb; przy 1280 px prawy
  panel AI (ten sam mechanizm co MP1/P1) nie zwęża się i tabela nie ma scrolla poziomego — realna
  utrata dostępu do kolumn.
- Uwaga właściciela ze stagingu: „zatwierdzam grafikę, ale DRD nie jest w wywiadzie" — odniesienia
  do DRD do usunięcia z modułu (lokalizacja nie zweryfikowana w audycie A/B/C — do znalezienia
  grepem `DRD` w komponentach Wywiadu przed implementacją).

**4. Projekt rozwiązania.** (a) Scalić dwa rzędy nawigacji w jeden — albo Stepper znika jako osobny
pasek i staje się niekliknym wskaźnikiem postępu, albo Menu 2 przejmuje jego rolę; decyzja
architektoniczna do potwierdzenia z właścicielem, bo to zmiana widocznej struktury, nie tylko
kosmetyki. (b) Własny `overflow-x-auto` na samym rzędzie pigułek steppera, nie na wspólnym przodku
z breadcrumbem — usunięcie duplikatu z (a) rozwiązuje to przy okazji. (c) Przy 1280 px zastosować
ten sam wzorzec **P1** co w Mojej Pracy (panel chowany/zwężany poniżej 1440 px) — to nie jest osobna
implementacja, to ten sam komponent po naprawie w paczce Moja Praca. (d) Usunąć odniesienia do DRD z
modułu Wywiad (lokalizację ustalić grepem przed pracą).

**5. Kroki wykonania.**
1. Decyzja z właścicielem: Stepper znika czy Menu 2 się dostosowuje (nie-kodowy krok, ale blokujący
   — bez tego kroki 2-3 nie mają jednoznacznego celu). **S, właściciel + nadzorca.**
2. Scalić nawigację wg decyzji z kroku 1, naprawić `overflow-x-auto` na rzędzie pigułek.
   `src/components/Interview/InterviewPipelineStepper.tsx`, `InterviewHub.tsx:9659`. **M, Sonnet.**
   Wymaga `[ODMROZENIE 02_INTERVIEW DEC-399]`.
3. Zależność od **P1** (panel Moja Praca) — po ujednoliceniu `ArtifactRightPanel` w Mojej Pracy,
   zastosować ten sam komponent na liście Wywiadu. **S** (podłączenie, nie nowa implementacja) —
   **blokowane przez krok 1 paczki Moja Praca.**
4. Usunąć odniesienia do DRD z Wywiadu: `rg -i "DRD" src/components/Interview/` przed zmianą, potem
   punktowe usunięcie/przekierowanie. **S, Sonnet.**

**6. Testy.**
- Jednostkowe: test na steppera — kliknięcie pozycji poza widocznym obszarem nie przewija
  elementów nadrzędnych (dowód mutacyjny: usunięcie `overflow-x-auto` z testowanego elementu musi
  zawalić test na przesunięcie breadcrumbu).
- Wizualne: `01-lista-glowna.png`, `01c-lista-glowna-1920-full.png`, nowy zrzut przy 1280 po naprawie
  P1; **ciemny motyw — brak pomiaru (dokument IV)**.
- Przepływ klikany: dokument III, Wywiad (Skrzynka → sesja → macierz DRD w Ocenie, nie w Wywiadzie —
  potwierdzenie że DRD faktycznie zniknęło z tego modułu).

**7. Kryterium odbioru właściciela.** Lista „Skrzynka" ma jeden rząd nawigacji, czytelna przy 1280 i
1920 px, bez wzmianki o DRD — właściciel widzi to raz i mówi „tak", bez pytania „czemu są dwa rzędy
zakładek".

**8. Ryzyka i cofanie.** Krok 1 (decyzja architektoniczna) jest ryzykiem samym w sobie — bez niej
reszta postoi. Cofanie: rewert commitów kroku 2 do ostatniego `demo-safe-<data>`; krok 3 cofa się
automatycznie, jeśli P1 w Mojej Pracy zostanie cofnięte (zależność wprost).

**9. Nakład.** Krok 1: S (pół dnia rozmowy). Krok 2: M (Sonnet, 1,5 dnia). Krok 3: S (Sonnet, 0,5
dnia, **po** ukończeniu P1). Krok 4: S (Sonnet, 0,5 dnia). Razem: **~3 dni** kodu + decyzja
właściciela na starcie, kroki 2 i 4 równoległe.

---

## 4. Narzędzia

**1. Cel dla użytkownika.** Biblioteka narzędzi nie używa czerwieni dla stanów, które nie są
krytyczne, a nagłówek jedynego aktywnego narzędzia („Dynamic SWOT") nie ma nachodzących na siebie
napisów na laptopie.

**2. Zakres.** Ekran: **Biblioteka `/discovery-tools`** (`evidence/audyt-award-20260905/narzedzia/01-root.png`,
`01e-root-oceny.png`; audyt A §4). Moduł zamrożony jako `03_TOOLS` (2026-09-05T14:58:55Z). Uwaga z
audytu: „flagowy" znaczy tu „najbardziej reprezentatywny", **nie** „gotowy bez poprawek" — to
najsłabszy moduł całego audytu (A=1,83, B=1,17) i jedyny z oceną 0 (Megatrendy, ekran **inny** niż
ten flagowy).

**3. Przyczyna źródłowa.**
- **N2/P6** — crimson dla stanu niekrytycznego: `src/components/Discovery/DiscoveryToolsHub.tsx:318`
  (`licensed: { name:'Oceny', textClass:'text-danger-700…' }`) i
  `src/components/DiscoveryTools/KnownToolPreviewV3.tsx:287-293` (`bg-danger-50 text-danger-700` dla
  „Inactive") — dokładnie pułapka nr 1 z `CLAUDE.md` (`primary`/`danger` w tailwind = crimson,
  rezerwowane dla stanów krytycznych).
- **N7** — nakładające się teksty w nagłówku pełnego widoku „Dynamic SWOT" przy ~1440 px:
  `src/components/shared/NModeLayout/NModeHeader.tsx:354-450` (`statusLabel` przy L432, stan zapisu
  ~L440 — zweryfikowane w tej sesji: blok „Status lifecycle pill" i „Save-state indicator" sąsiadują
  w tym samym rzędzie flex bez rezerwy szerokości) w połączeniu z `inlineActions` z
  `src/components/DiscoveryTools/KnownToolDetailView.tsx:2521-2540`.
- **N1** — brak `selection` na `<StandardTable>` w `DiscoveryToolsHub.tsx:4066`, mimo że kontrakt
  `src/contracts/tableSurface/surfaceRegister.ts:369-388` (T15) deklaruje `bulkActions` i
  `selection:'bulk'` domyślnie.

**4. Projekt rozwiązania.** (a) Zamienić `textClass`/`bg-danger-*` na neutralny ton dla kategorii
„Oceny" i cichy chip z kropką (nie wypełnioną czerwoną pigułką) dla „Nieaktywny" — **P6**, dotyczy
też innych ekranów modułu (Operacyjne — patrz N2 w tabeli A §4). (b) W `NModeHeader.tsx` dodać
zawijanie/rezerwę szerokości między tytułem a akcjami zamiast sztywnego `lg:flex-nowrap` — to
komponent współdzielony (`NModeLayout`), więc poprawka obowiązuje każdy tor korzystający z tego
nagłówka, nie tylko Dynamic SWOT. (c) Podłączyć `selection` do `<StandardTable>` w Bibliotece i
zaimplementować akcję masową `add-to-process` zgodnie z kontraktem T15. Zakaz: nowy własny toolbar
zaznaczania — kanon wymaga `StandardTable`'owego mechanizmu selection.

**5. Kroki wykonania.**
1. `DiscoveryToolsHub.tsx:318`, `KnownToolPreviewV3.tsx:287-293`: zamiana klas koloru. **S, Sonnet.**
   Wymaga `[ODMROZENIE 03_TOOLS DEC-400]`.
2. `NModeHeader.tsx:354-450`: rezerwa szerokości / zawijanie. **M, Sonnet** — komponent
   współdzielony, testować też na innych konsumentach `NModeLayout` (np. Materiały Document Studio),
   żeby nie odrosło gdzie indziej. Wymaga odmrożenia `03_TOOLS`, jeśli plik jest listowany tam —
   `NModeHeader.tsx` leży w `src/components/shared/`, do potwierdzenia w JSON przed commitem.
3. `DiscoveryToolsHub.tsx:4066` + kontrakt T15: dodać `selection='bulk'`, akcję `add-to-process`.
   **M, Sonnet.** Wymaga `[ODMROZENIE 03_TOOLS DEC-400]`.

**6. Testy.**
- Jednostkowe: test koloru — snapshot/asercja klasy CSS na chipie „Nieaktywny" nie zawiera
  `danger`/`crimson` (dowód mutacyjny: przywrócenie starej klasy musi zawalić test). Test na
  `NModeHeader` — przy szerokości kontenera 1440 px oba bloki (`statusLabel`, save-state) nie mają
  nakładających się prostokątów (test na `getBoundingClientRect`, nie tylko snapshot).
- Wizualne: `01-root.png`, `01e-root-oceny.png`, `13-dynamicswot-fullopen.png` (1440),
  `14-dynamicswot-fullopen-1920.png` ponownie; **1280 px i ciemny motyw dla całego modułu — brak
  pomiaru (dokument IV)**.
- Przepływ klikany: dokument III, Narzędzia (uwaga: Megatrendy pozostają zablokowane niezależnie od
  tej naprawy — patrz sekcja „flows blocked").

**7. Kryterium odbioru właściciela.** Na ekranie Biblioteki nie ma czerwonych elementów tam, gdzie
nic złego się nie dzieje, a nagłówek narzędzia jest czytelny na laptopie — właściciel widzi to raz i
mówi „tak", bez pytania „co jest nie tak z tym narzędziem, że jest na czerwono".

**8. Ryzyka i cofanie.** Krok 2 dotyka komponentu współdzielonego poza samym modułem Narzędzia —
ryzyko regresji w innych torach korzystających z `NModeHeader`. Cofanie: rewert commita kroku 2 do
`demo-safe-<data>`, kroki 1 i 3 niezależne, można cofnąć osobno.

**9. Nakład.** Krok 1: S (Sonnet, 0,5 dnia). Krok 2: M (Sonnet + QA na min. 2 innych konsumentach
`NModeLayout`, 2 dni). Krok 3: M (Sonnet, 1,5 dnia). Razem: **~4 dni**, kroki 1 i 3 równoległe z 2.

---

## 5. Ocena

**1. Cel dla użytkownika.** Macierz DRD w trybie pełnoekranowym pozostaje wzorcowym ekranem —
zadanie tej paczki to potwierdzić parytet na 1280/1920 i w ciemnym motywie, nie zmieniać nic w
samym ekranie.

**2. Zakres.** Ekran: **DRD → Macierz → Pełny ekran** (`evidence/audyt-award-20260905/ocena/ocena-08-drd-macierz-fullscreen.png`;
audyt B §1, zbieżne z rekomendacją D_SYNTEZA „Macierz DRD na pełnym ekranie"). Moduł zamrożony jako
`04_ASSESSMENT` (2026-09-05T14:59:01Z). **Nie mylić z modułem Raportów tej samej sekcji** — raport
oznaczony „Finalne"/80% otwiera się jako całkowicie pusty dokument (TOP-1 znalezisko części B) — to
osobny ekran, celowo **nie** wybrany na flagowy i opisany w dokumencie III jako przepływ dziś
zablokowany, nie tutaj.

**3. Przyczyna źródłowa.** Audyt B ocenia ten ekran 3/3 na obu wymiarach bez żadnego odchylenia —
„pełne etykiety, `Esc, aby zamknąć`, `Wróć`, przełącznik AS-IS/TO-BE". Jedyny brak: pomiar zrobiono
tylko przy 1440 px jasnym; 1280/1920 i ciemny motyw nie zostały zmierzone dla *tego konkretnego*
ekranu (audyt B nie miał osobnego wiersza „flagowy 1280/1920" dla Oceny, w przeciwieństwie do części
A). **Nie dotyczy** — brak przyczyny źródłowej do naprawy, bo nie ma zidentyfikowanego defektu na
tym ekranie.

**4. Projekt rozwiązania.** **Nie dotyczy** (zero zmian w komponencie) — jedyna „praca" to pomiar.

**5. Kroki wykonania.**
1. Zrzut `DRD → Macierz → Pełny ekran` przy 1280 i 1920 px, jasny motyw (dopełnienie luki
   pomiarowej). **S, Sonnet/harness.**
2. Zrzut tego samego ekranu w ciemnym motywie na wszystkich trzech szerokościach — wymaga
   `--theme=dark` z dokumentu IV (dziś nieistniejące). **S, po dostarczeniu flagi z dokumentu IV.**
3. Jeśli krok 1 lub 2 ujawni odchylenie (np. przełącznik AS-IS/TO-BE nie mieści się przy 1280 px w
   ciemnym motywie) — dopiero wtedy powstaje krok naprawczy, nieznany dziś. **Nie dotyczy** dopóki
   pomiar nie wykaże defektu.

**6. Testy.**
- Jednostkowe: **nie dotyczy** (brak zmiany kodu w krokach 1-2).
- Wizualne: nowe zrzuty 1280/1920 jasny (krok 1) + 1280/1440/1920 ciemny (krok 2) — 5 nowych
  zrzutów wobec 1 istniejącego.
- Przepływ klikany: dokument III, Ocena — potwierdza, że wejście do trybu pełnoekranowego z
  poziomu zakładki Macierz działa identycznie z każdej z trzech szerokości.

**7. Kryterium odbioru właściciela.** Właściciel widzi ten sam ekran, który już zna i zaakceptował,
potwierdzony teraz na trzech szerokościach i w obu motywach — „tak" bez nowych pytań, bo nic się nie
zmieniło poza dowodem.

**8. Ryzyka i cofanie.** Brak ryzyka kodowego (zero zmian). Jedyne ryzyko: pomiar ujawni defekt w
ciemnym motywie, którego dziś nie widać — wtedy ta paczka wraca do kroku 4/5 z pełną treścią
naprawczą, obecnie nieznaną.

**9. Nakład.** Krok 1: S (0,25 dnia). Krok 2: S (0,25 dnia, zależne od dokumentu IV). Razem:
**~0,5 dnia**, czysto pomiarowe.

---

## 6. Inicjatywy

**1. Cel dla użytkownika.** Panel podglądu po jednym kliknięciu w wiersz pozostaje wzorcowym
ekranem modułu — reszta widoków (tabela, Kanban, Siatka, Plan, Obciążenie) zostaje **wyłączona z
demo**, dopóki angielskie etykiety nie znikną (osobna praca, poza tą paczką — patrz P3).

**2. Zakres.** Ekran: **panel podglądu (single-click) na liście tabelarycznej**
(`evidence/audyt-award-20260905/inicjatywy/inicjatywy-07-karta-open.png`; audyt B §2). Moduł
zamrożony jako `05_INITIATIVES` (2026-09-05T14:59:03Z).

**3. Przyczyna źródłowa.** Audyt B ocenia ten ekran 3/3 na obu wymiarach: „nagłówek+pin+Otwórz+×,
meta z rekomendacją, DETAILS z licznikiem słów, tabela właściwości, POWIĄZANIA. Najlepszy ekran
modułu." **Nie dotyczy** — brak zidentyfikowanego defektu na *tym* ekranie; wszystkie defekty
modułu (angielskie statusy w Kanban/Siatce, Menu 3 w 100% po angielsku w Plan/Obciążenie, diakrytyki
w kreatorze) leżą na **innych** ekranach tego samego modułu i są zakresem **P3**, nie tej paczki.

**4. Projekt rozwiązania.** **Nie dotyczy** dla samego ekranu flagowego. Warunek pokazania modułu na
scenie poza tym jednym ekranem: naprawić P3 (i18n Kanban/Siatka/Plan/Obciążenie/kreator) — to osobna,
większa paczka poza zakresem „jeden ekran flagowy" (patrz `D_SYNTEZA_I_PLAN.md` P3, moduły:
Inicjatywy, Wyniki, Organizacja, Audyty, Moja Praca, Czat).

**5. Kroki wykonania.**
1. Zrzut panelu podglądu przy 1280/1920 (audyt B mierzył tylko 1440) + ciemny motyw (dokument IV).
   **S, harness.**
2. **Poza zakresem tej paczki, ale blokujące pokazanie CAŁEGO modułu poza tym jednym panelem:** P3
   dla Inicjatyw — literalne stringi w `InitiativeFullView.tsx:438,503,860,964,1003,1013,1056,1218,1240,1258`
   (zweryfikowane w tej sesji: `label: 'Approve'`, `label: 'Cancel'`, `<p>No tasks yet</p>` —
   dokładnie jak cytuje audyt), diakrytyki w
   `src/components/Initiatives/Wizard/InitiativeWizardModal.tsx:604-606` (zweryfikowane: „Marza",
   „Jakosc", „Terminowosc" dosłownie w kodzie). **L, Opus** (sweep i18n całego archetypu, wysokie
   ryzyko przeoczenia stringów). Wymaga `[ODMROZENIE 05_INITIATIVES DEC-401]`.

**6. Testy.**
- Jednostkowe: **nie dotyczy** dla kroku 1. Dla kroku 2 (P3): test na `InitiativeWizardModal` —
  renderowane etykiety priorytetów biznesowych zawierają polskie znaki diakrytyczne (dowód
  mutacyjny: przywrócenie `'Marza'` bez ogonka musi zawalić test porównujący z listą oczekiwanych
  stringów z `ą/ę/ś/ć/ż/ź/ó/ł/ń`).
- Wizualne: nowy zrzut panelu podglądu 1280/1920/ciemny; dla P3 — pełny przegląt Kanban/Siatka/Plan/
  Obciążenie po tłumaczeniu, wszystkie trzy szerokości.
- Przepływ klikany: dokument III, Inicjatywy — zaznacza wprost, które kroki scenariusza dziś
  przechodzą przez ekrany zablokowane (Kanban, Plan) i czekają na P3.

**7. Kryterium odbioru właściciela.** Panel podglądu inicjatywy po jednym kliknięciu wygląda i działa
tak samo na 1280/1440/1920, w obu motywach — „tak" na tym jednym ekranie. Reszta modułu zostaje poza
scenografią demo do czasu P3 (osobne „tak" po tamtej naprawie).

**8. Ryzyka i cofanie.** Krok 2 (P3) to duży sweep tekstu w gęsto używanym komponencie — ryzyko
przeoczenia lub złamania testów istniejących na angielskie stringi (jeśli jakiś test asercjonuje
`'Approve'` dosłownie, trzeba go zaktualizować równolegle). Cofanie: `git revert` całego sweep-a
naraz, nie punktowo (żeby nie zostawić modułu w stanie pół-polskim, gorszym niż dziś).

**9. Nakład.** Krok 1: S (0,25 dnia). Krok 2 (P3 dla Inicjatyw, poza tą paczką sensu stricto, ale
warunkujące pełny odbiór modułu): L (Opus, 3-4 dni + 1 dzień QA). Razem paczka flagowa: **0,25 dnia**;
pełny odbiór modułu: **+3-5 dni** poza tą paczką.

---

## 7. Realizacja

**1. Cel dla użytkownika.** Kokpit menedżera pozostaje gotowym ekranem zarządczym — do potwierdzenia
tylko na 1280/1920 i w ciemnym motywie; ryzykiem jest wyłącznie to, co widz zobaczy, jeśli klikanie
pójdzie dalej (Praca/Zasoby wiszą 15-22 s) — poza zakresem tej konkretnej paczki, ale odnotowane jako
warunek pokazu na żywo.

**2. Zakres.** Ekran: **Kokpit menedżera** (`evidence/audyt-award-20260905/realizacja/realizacja-01-kokpit.png`;
audyt B §3). Moduł zamrożony jako `06_EXECUTION` (2026-09-05T14:59:07Z).

**3. Przyczyna źródłowa.** Audyt B ocenia 3/3 na obu wymiarach: „5 kafli KPI, „Co nam grozi"/„Co
muszę rozstrzygnąć", uczciwy pusty stan". **Nie dotyczy** dla samego ekranu — brak zidentyfikowanego
defektu. Zagrożenie leży **obok**: zakładki Praca i Zasoby tego samego modułu wiszą realnie 15-22 s
(zmierzone `realizacja-03b-praca-wait.png` → `realizacja-03d-praca-22s.png`), mimo zaprojektowanego
mechanizmu odporności `src/components/Execution/executionCaseFanOut.ts:26`
(`EXECUTION_CASE_FANOUT_TIMEOUT_MS = 12_000`, pokryte testem `ExecutionSurfaces.hangingCase.test.tsx`)
— realny czas przekracza deklarowany limit i przez cały ten czas brak jakiejkolwiek informacji
zwrotnej.

**4. Projekt rozwiązania.** Dla samego Kokpitu: **nie dotyczy**. Dla ryzyka sąsiedniego (poza tą
paczką, ale w tym samym module i blokujące „przepływ klikany" z dokumentu III): dodać natychmiastowy
szkielet/spinner z komunikatem „Wczytuję..." od pierwszej sekundy zamiast ciszy, i zbadać czemu
realny czas (15,5-22 s) przekracza `EXECUTION_CASE_FANOUT_TIMEOUT_MS` (12 s) — deklarowany limit
i zmierzona rzeczywistość się rozjeżdżają, więc albo limit jest źle skonfigurowany, albo mechanizm
przekroczenia nie jest respektowany w ścieżce renderowania. To dokładnie wzorzec **P5** z
`D_SYNTEZA_I_PLAN.md`.

**5. Kroki wykonania.**
1. Zrzut Kokpitu przy 1280/1920 (audyt mierzył tylko 1440) + ciemny motyw. **S, harness.**
2. **Poza tą paczką, warunek pokazu modułu poza samym Kokpitem (P5):** dodać skeleton/spinner od
   pierwszej sekundy w zakładkach Praca i Zasoby; zbadać rozjazd między `EXECUTION_CASE_FANOUT_TIMEOUT_MS`
   a realnym czasem (`src/components/Execution/executionCaseFanOut.ts:26`). **M, Sonnet z jednym
   przeglądem Opusa** (dotyka mechanizmu odporności, nie tylko UI). Wymaga
   `[ODMROZENIE 06_EXECUTION DEC-402]`.

**6. Testy.**
- Jednostkowe: **nie dotyczy** dla kroku 1. Dla kroku 2: rozszerzyć
  `ExecutionSurfaces.hangingCase.test.tsx` o asercję, że skeleton renderuje się **przed** upływem
  100 ms (nie po timeout backendu) — dowód mutacyjny: usunięcie wczesnego renderu skeletonu musi
  zawalić test.
- Wizualne: nowy zrzut Kokpitu 1280/1920/ciemny; dla kroku 2 — zrzut zakładki Praca w sekundzie 0,
  1, 5, 15 (seria czasowa, nie jeden zrzut).
- Przepływ klikany: dokument III, Realizacja — scenariusz „Kokpit → Praca → Zasoby" z jawnym
  zaznaczeniem, że dziś to przejście wisi 15-22 s bez informacji.

**7. Kryterium odbioru właściciela.** Kokpit menedżera wygląda tak samo dobrze na 1280/1440/1920 w
obu motywach — „tak" na tym ekranie natychmiast. Osobne „tak" potrzebne po naprawie P5 dla
Praca/Zasoby, zanim moduł zostanie pokazany w pełnym przepływie na żywo.

**8. Ryzyka i cofanie.** Krok 2 dotyka mechanizmu fan-out używanego przez więcej niż jeden ekran —
zmiana progu czasowego może ujawnić inne, dziś ukryte wolne zapytania. Cofanie: rewert do
`demo-safe-<data>`, mechanizm fan-out ma już test regresyjny, więc cofnięcie jest bezpieczne
(czerwony test = sygnał, że coś się popsuło).

**9. Nakład.** Krok 1: S (0,25 dnia). Krok 2: M (Sonnet + Opus review, 2 dni, w tym badanie
przyczyny rozjazdu czasowego). Razem: **~2,25 dnia**, przy czym krok 1 nie zależy od kroku 2.

---

## 8. Wyniki

**1. Cel dla użytkownika.** Pełna karta celu OKR pozostaje ekranem, który właściciel już raz
zaakceptował na referencji — ta paczka to potwierdzenie parytetu 1:1 na dodatkowych szerokościach i
w ciemnym motywie, plus usunięcie hybrydowego „Resultaty" z nagłówka, które dotyka też tego ekranu.

**2. Zakres.** Ekran: **Cel — pełna karta OKR** (`/results/okr/:objectiveId`,
`evidence/audyt-award-20260905/wyniki/wyniki-16-cel-karta-pelna.png`, potwierdzone 1:1 z
`evidence/odbior-zywo-20260905/08-wyniki/okr-cel/proof-okr-L2.png`; audyt B §4). Moduł **NIE
zamrożony** — jedyny z dwóch otwartych obok Finansów (`MVP_FINAL_ZAMROZONE.json` nie ma wpisu dla
Wyników; potwierdzone też w §4 audytu D: „Dwa otwarte: Wyniki i Finanse"). **Nie wymaga znacznika
`[ODMROZENIE]`** — moduł nie jest zamrożony, ale każda zmiana tu i tak wymaga osobnego „tak"
właściciela przed zamrożeniem (kanon pkt 9 `CLAUDE.md`: „NIGDY nie włączaj wielu flag naraz").
Wyniki mają już wykonaną **P7** (nawigacja KPI, scalone `dda794943e` 05.09 17:30) — to odblokowało
moduł do zatwierdzenia, ale zatwierdzenie samo w sobie jeszcze nie nastąpiło (moduł wciąż otwarty w
rejestrze zamrożenia).

**3. Przyczyna źródłowa.**
- Nagłówek Menu 1/breadcrumb pokazuje **„Resultaty"** na KAŻDYM ekranie modułu — hybrydowe słowo,
  ani polskie „Wyniki", ani angielskie „Results" (audyt B, nota na początku §4: „Traktuję to jako
  JEDNO odchylenie cross-cutting"). Plik nie zidentyfikowany precyzyjnie w audycie — pierwszy krok
  to `rg -i "Resultaty"` w konfiguracji nawigacji/breadcrumbów Wyników.
- Pole wyszukiwania Menu 2 pokazuje angielski placeholder „Search" zamiast „Szukaj" — ten sam
  cross-cutting zakres.
- Dla samej **pełnej karty celu**: audyt B ocenia ją 3/3, „identyczna z zatwierdzonym wzorcem
  referencyjnym właściciela… łącznie z poprawnym „Średnia"". Pytanie otwarte: czy pełna karta (widok
  dokumentu, bez standardowego Menu 1/2 może być poza zasięgiem nagłówka „Resultaty") pokazuje ten
  sam breadcrumb, czy jest wolna od niego — **nie zweryfikowane w audycie, do potwierdzenia przed
  uznaniem ekranu za w pełni wolny od P3**.

**4. Projekt rozwiązania.** Znaleźć i poprawić źródło literału „Resultaty"/„Search" w
konfiguracji nawigacji modułu Wyniki (prawdopodobnie klucz i18n z literówką lub fallback
niezlokalizowany) — jedna poprawka w warstwie i18n/nawigacji, nie w komponencie karty. To jest część
zakresu **P3** (`D_SYNTEZA_I_PLAN.md` listuje Wyniki wprost w P3).

**5. Kroki wykonania.**
1. `rg -i "resultaty|Resultaty" src/` żeby zlokalizować literał (prawdopodobnie
   `src/components/navigation/Sidebar/menuConfig.ts` lub breadcrumb Wyników — do potwierdzenia).
   **S, Sonnet.**
2. Poprawić na „Wyniki" po polsku i dodać/poprawić klucz i18n placeholdera wyszukiwania („Szukaj").
   **S, Sonnet.**
3. Zweryfikować wzrokiem, czy pełna karta celu (`/results/okr/:objectiveId`) w ogóle renderuje ten
   breadcrumb — jeśli tak, potwierdzić że poprawka z kroku 2 go obejmuje; jeśli nie, odnotować że
   ekran flagowy nigdy nie miał tego defektu. **S, weryfikacja.**
4. Zrzut pełnej karty przy 1280/1920 (audyt mierzył 1440) + ciemny motyw. **S, harness.**

**6. Testy.**
- Jednostkowe: test na komponencie nawigacji Wyników — nagłówek renderuje „Wyniki", nie „Resultaty"
  (dowód mutacyjny: przywrócenie literału musi zawalić test porównania stringów).
- Wizualne: `wyniki-16-cel-karta-pelna.png` ponownie przy 1280/1920/ciemny, porównanie piksel-w-piksel
  z `proof-okr-L2.png`.
- Przepływ klikany: dokument III, Wyniki — „rejestr → zestawienie → wskaźnik → pomiar" (ten sam
  scenariusz, dla którego P7 już otworzyła nawigację).

**7. Kryterium odbioru właściciela.** Pełna karta celu wygląda identycznie z referencją, którą
właściciel już zaakceptował, teraz też na 1280/1920 i w ciemnym motywie, bez „Resultaty" nigdzie w
kadrze modułu — „tak", z otwarciem drogi do zamrożenia całego modułu Wyniki.

**8. Ryzyka i cofanie.** Niskie ryzyko — poprawka literału w jednym miejscu nawigacji. Cofanie:
rewert pojedynczego commita, bez wpływu na P7 (już scalone, osobny commit).

**9. Nakład.** Kroki 1-3: S łącznie (Sonnet, 1 dzień). Krok 4: S (0,25 dnia). Razem: **~1,25 dnia**.

---

## 9. Finanse

**1. Cel dla użytkownika.** **Nie dotyczy w obecnej fali MVP** — właściciel wycofał moduł z zakresu
05.09 („wyrzucamy z MVP, to co pokazałeś jest gorsze niż to, co było", §4 audytu D). Ta sekcja
istnieje w paczce, bo szablon wymaga „nie dotyczy" zamiast pominięcia, i bo audyt zmierzył ekran
mimo decyzji o wyjęciu z MVP — dokumentacja zostaje na wypadek fali 2.

**2. Zakres.** Ekran: **Sprawozdania — lista** (`evidence/audyt-award-20260905/finanse/01-lista.png`;
audyt C, rekomendacja flagowa „najbardziej stabilny i spójny ekran modułu"). Moduł **nie jest** w
`MVP_FINAL_ZAMROZONE.json` (spójne z decyzją „poza MVP" — nie ma sensu zamrażać czegoś, co nie
wchodzi na demo).

**3. Przyczyna źródłowa.** **Nie dotyczy dla decyzji o zakresie** (decyzja właściciela, nie defekt
techniczny). Dla ekranu samego w sobie, jeśli/gdy wróci w fali 2: kolumny STATUS/Waluta obcięte przez
stały panel Teresy (ten sam mechanizm **P1**+**P2** co w innych modułach), chip zakładki „finance
2025" miesza EN+PL. Najpoważniejszy defekt modułu (22 nazwy narzędzi po angielsku na ekranie Wyceny)
dotyczy **innego** ekranu niż flagowy — nie jest częścią tej paczki.

**4. Projekt rozwiązania.** **Nie dotyczy w tej fali.** Gdyby moduł wrócił: zastosować gotowe już
wtedy **P1**/**P2** (współdzielone komponenty naprawione przy okazji Mojej Pracy/Wywiadu) — Finanse
nie potrzebowałyby osobnej pracy architektonicznej, tylko odziedziczyłyby naprawę.

**5. Kroki wykonania.** **Nie dotyczy — brak kroków w tej fali.** Do rejestru na przyszłość: jeśli
właściciel zdecyduje o powrocie Finansów, pierwszy krok to ponowny pomiar na kodzie z naprawionym
P1/P2/P3, nie od zera.

**6. Testy.** **Nie dotyczy.**

**7. Kryterium odbioru właściciela.** **Nie dotyczy** — moduł poza zakresem obecnej fali; decyzja
już podjęta i nie wymaga ponownego potwierdzenia na ekranie.

**8. Ryzyka i cofanie.** **Nie dotyczy.**

**9. Nakład.** **0 dni w tej fali.**

---

## 10. Materiały

**1. Cel dla użytkownika.** Wybór trybu nowego dokumentu w Document Studio pozostaje czystym,
dobrze zaprojektowanym ekranem — do wyjaśnienia jest tylko, dlaczego stabilność (A) jest oceniona na
2, nie 3, zanim ekran zostanie ogłoszony w pełni gotowym.

**2. Zakres.** Ekran: **Document Studio — wybór trybu nowego dokumentu („Od zera"/„Z AI")**
(audyt C, rekomendacja flagowa „czysty, dobrze zaprojektowany, zero zastrzeżeń"; brak numeru zrzutu
podanego wprost w tabeli C, ekran opisany jako „Document Studio — nowy dokument (flagowy)" w wierszu
tabeli). Moduł zamrożony jako `11_MATERIALS` (2026-09-05T14:59:17Z).

**3. Przyczyna źródłowa.** Audyt C daje temu ekranowi **A=2, B=3** — tekst mówi „brak zastrzeżeń", co
pasuje do B=3, ale **nie tłumaczy, czemu A nie jest 3**. To jest luka w samym audycie, nie ukryty w
kodzie defekt ze znaną lokalizacją — **uczciwie nieznane**, zamiast zgadywać przyczynę. Możliwe
wyjaśnienia (do zweryfikowania, nie do przyjęcia bez dowodu): (a) generyczny błąd konsoli
cross-cutting wspólny dla modułu (kolumna formatu „Unknown" w Dokumentach/Arkuszach, zimny start
Arkuszy ~6,4 s — oba jednak dotyczą **innych** ekranów tej samej sekcji, nie tego), (b) domyślna
ocena A=2 mogła być przyznana z ostrożności bez zapisanego konkretnego zastrzeżenia.

**4. Projekt rozwiązania.** Pierwszy krok nie jest naprawą — jest **dopomiarem**: ponownie otworzyć
ten ekran, patrzeć na konsolę i sieć przez pełny cykl (otwarcie modalu → wybór trybu → anulowanie),
zapisać czy istnieje realny błąd konsoli/wolne zapytanie. Dopiero wynik tego kroku decyduje, czy
potrzebna jest naprawa, i jaka.

**5. Kroki wykonania.**
1. Dopomiar: otworzyć Document Studio → nowy dokument, zarejestrować konsolę/sieć przez cały cykl
   wyboru trybu, sidecar `.json` jak w reszcie audytu. **S, harness + odczyt.**
2. **Warunkowe** — jeśli krok 1 ujawni realny defekt: krok naprawczy nieznany dziś, do zdefiniowania
   po wyniku. Jeśli krok 1 nie ujawni niczego: podnieść ocenę do A=3 w rejestrze i **nie dotyczy**
   dla kodu.

**6. Testy.**
- Jednostkowe: **nie dotyczy** dopóki krok 1 nie wskaże konkretnego mechanizmu do pokrycia testem.
- Wizualne: zrzut Document Studio przy 1280/1920 (audyt mierzył jedną szerokość niepodaną wprost w
  tabeli — do potwierdzenia, że to było 1440) + ciemny motyw.
- Przepływ klikany: dokument III, Materiały — „Biblioteka → nowy dokument → Od zera/Z AI → zapis" —
  ten sam cykl co krok 1 tutaj, więc oba pomiary mogą być wykonane razem.

**7. Kryterium odbioru właściciela.** Wybór trybu nowego dokumentu wygląda i działa bez zastrzeżeń
na 1280/1440/1920, w obu motywach, z jawnie znaną przyczyną oceny A (3, albo nazwany defekt z planem
naprawy) — „tak" dopiero po domknięciu tej niewiadomej, nie przed.

**8. Ryzyka i cofanie.** Brak ryzyka kodowego w kroku 1 (czysty pomiar). Ryzyko całej paczki: ogłoszenie
„gotowe" bez wyjaśnienia A=2 byłoby dokładnie wzorcem „gotowe nie znaczy skończone" z pamięci
nadzorcy — stąd krok 1 jest obowiązkowy, nie opcjonalny.

**9. Nakład.** Krok 1: S (Sonnet, 0,5 dnia). Krok 2: nieznany dziś (0 dni, jeśli pomiar czysty; S-M,
jeśli ujawni defekt). Razem: **~0,5 dnia + rezerwa warunkowa**.

---

## 11. Audyty

**1. Cel dla użytkownika.** Podgląd programu audytowego ma przycisk „Otwórz" w nagłówku, tak jak
każdy inny podgląd w aplikacji, i nie pokazuje angielskiego słowa „Audits" w pasku modułu.

**2. Zakres.** Ekran: **Biblioteka — podgląd programu audytowego**
(`evidence/audyt-award-20260905/audyty/04-program-detal.png`; audyt C). Moduł zamrożony jako
`12_AUDITS` (2026-09-05T14:59:20Z).

**3. Przyczyna źródłowa.**
- Brak przycisku „Otwórz" w nagłówku podglądu — niezgodnie z kanonem Preview (tytuł+pin+Otwórz+×).
  Plik nie zidentyfikowany precyzyjnie w audycie C (deduction 3) — do namierzenia w komponencie
  podglądu programu audytowego przed implementacją.
- Breadcrumb Menu 1 „Audits" po angielsku na WSZYSTKICH siedmiu zakładkach modułu, w tym na tym
  podglądzie (ten sam nagłówek jest współdzielony między zakładkami) — część zakresu **P3**
  (Audyty jest jednym z sześciu modułów wprost wymienionych w `D_SYNTEZA_I_PLAN.md` P3).

**4. Projekt rozwiązania.** (a) Dodać przycisk „Otwórz" do nagłówka podglądu programu audytowego,
zgodnie z kanonem Preview (ten sam wzorzec co w każdym innym module — nie nowy komponent). (b)
Naprawić literał „Audits"→„Audyty" w breadcrumbie Menu 1 — razem z resztą **P3** dla pozostałych
pięciu modułów wymienionych w tej samej paczce fundamentów.

**5. Kroki wykonania.**
1. Namierzyć komponent podglądu programu audytowego (`rg` po „program audytowy"/„audit-programs" w
   `src/components/Audits/` lub odpowiedniku), dodać przycisk „Otwórz" zgodny z kanonem Preview.
   **S, Sonnet.** Wymaga `[ODMROZENIE 12_AUDITS DEC-403]`.
2. `rg -i "Audits" src/` w kontekście nawigacji modułu Audyty, poprawić na „Audyty" — część **P3**,
   robić razem z Organizacją/Wynikami/Inicjatywami (ta sama rodzina literału nagłówka Menu 1
   niezlokalizowanego). **S, Sonnet.**

**6. Testy.**
- Jednostkowe: test na komponencie podglądu — nagłówek renderuje trzy akcje (pin, Otwórz, ×), nie
  dwie (dowód mutacyjny: usunięcie propa `onOpen` musi zawalić test obecności przycisku).
- Wizualne: `04-program-detal.png` ponownie po naprawie, plus 1280/1920/ciemny (audyt C mierzył tylko
  jedną szerokość dla tego ekranu).
- Przepływ klikany: dokument III, Audyty — „Biblioteka → podgląd programu → Otwórz → pełny widok
  programu" (dziś krok „Otwórz" nie istnieje z tego miejsca — scenariusz musi to odnotować jako
  blokadę do naprawy w tym samym kroku).

**7. Kryterium odbioru właściciela.** Podgląd programu audytowego ma przycisk „Otwórz" w nagłówku i
napis „Audyty", nie „Audits", w pasku modułu — „tak" bez pytania „czemu nie mogę otworzyć tego z
podglądu".

**8. Ryzyka i cofanie.** Niskie ryzyko, dwie punktowe poprawki. Cofanie: rewert commitów do
`demo-safe-<data>`.

**9. Nakład.** Krok 1: S (Sonnet, 0,5 dnia). Krok 2: S (Sonnet, 0,5 dnia, częściowo dzielone z pracą
P3 dla innych modułów). Razem: **~1 dzień**.

---

## 12. Spotkania

**1. Cel dla użytkownika.** Lista i podgląd spotkania mają w pełni polski blok sugestii AI — dziś
jest to jedyny fragment ekranu w obcym języku na inaczej w pełni polskim widoku.

**2. Zakres.** Ekran: **Lista i podgląd spotkania**
(`evidence/audyt-award-20260905/spotkania/01-lista.png`, `02-obiekt.png`; audyt C). Moduł zamrożony
jako `08_MEETINGS` (2026-09-05T14:59:14Z).

**3. Przyczyna źródłowa.** Blok sugestii AI w podglądzie renderuje treść w 100% po angielsku
(„Focus the meeting on delivery status…") mimo że wszystkie etykiety wokół (SZCZEGÓŁY, Uczestnicy,
Follow-up, Agenda, Decyzje, POWIĄZANIA) są po polsku. Audyt C **nie rozstrzyga**, czy to dane seed
(w bazie) czy generowany na sztywno prompt (w kodzie) — „do zbadania przed przypisaniem effortu
naprawy". To rozstrzygnięcie jest pierwszym krokiem, nie założeniem.

**4. Projekt rozwiązania.** Jeśli źródłem jest prompt/szablon po stronie serwera generujący
sugestie AI po angielsku — poprawka to zmiana promptu/instrukcji językowej (S/M, zależnie od tego,
czy prompt jest scentralizowany). Jeśli źródłem są dane seed w bazie stagingu — to operacja na
danych, nie na kodzie (S, jak CZ4 w Czacie). Decyzja architektoniczna nie jest potrzebna — to
rozstrzygnięcie faktu, nie wyboru wzorca.

**5. Kroki wykonania.**
1. Ustalić źródło treści bloku AI: `rg` po fragmencie tekstu „Focus the meeting on" w
   `server/src/` (prompt) i sprawdzić czy ten sam tekst występuje w danych stagingu (zapytanie do
   bazy demo, nie zmiana). **S, Sonnet.**
2. **Warunkowo:** jeśli prompt — dodać instrukcję językową PL do promptu generującego sugestie
   (S/M). Jeśli dane seed — wyczyścić/przeregenerować dane demo (S, operacja na danych, jak w Czacie
   CZ4).

**6. Testy.**
- Jednostkowe: **warunkowo** — jeśli poprawka jest w prompcie, test na warstwie wywołania AI
  (mock odpowiedzi), asercja że parametr językowy `pl` jest zawsze przekazywany.
- Wizualne: `02-obiekt.png` ponownie po naprawie, plus 1280/1920/ciemny (audyt C mierzył tylko jedną
  szerokość — moduł opisany jako „zmierzony powierzchownie" w D_SYNTEZA).
- Przepływ klikany: dokument III, Spotkania.

**7. Kryterium odbioru właściciela.** Podgląd spotkania nie ma ani jednego angielskiego zdania w
bloku sugestii AI — „tak" bez pytania „dlaczego AI pisze po angielsku, skoro reszta jest po polsku".

**8. Ryzyka i cofanie.** Niskie — punktowa poprawka promptu lub danych. Cofanie: rewert commita lub
przywrócenie poprzednich danych demo z kopii.

**9. Nakład.** Krok 1: S (Sonnet, 0,5 dnia). Krok 2: S/M zależnie od wyniku (0,5-1,5 dnia). Razem:
**~1-2 dni**.

---

## 13. Organizacja

**1. Cel dla użytkownika.** Nagłówek Menu 1 modułu mówi „Organizacja", nie „Organization" — reszta
ekranu Tożsamości jest już dobrej jakości i zostaje bez zmian.

**2. Zakres.** Ekran: **Profil organizacji › Tożsamość i model działania**
(`evidence/audyt-award-20260905/organizacja/01-profile.png`; audyt C). Moduł zamrożony jako
`01_ORGANIZATION` (2026-09-05T14:58:46Z).

**3. Przyczyna źródłowa.** Górny nagłówek strony w Menu 1 brzmi „Organization" po angielsku, podczas
gdy breadcrumb bezpośrednio pod nim i cała reszta ekranu są w pełni po polsku (audyt C, deduction 1).
Ten sam wzorzec nagłówka Menu 1 występuje w Panelu Administratora — audyt C sam odnotowuje, że w
**Ustawieniach** ten sam mechanizm nagłówka działa poprawnie po polsku, co „potwierdza, że mechanizm
i18n działa, więc defekt w Organizacji jest lokalny, nie systemowy" (deduction 2 w sekcji
Ustawienia). To ważna informacja dla naprawy: **nie** szukać wspólnej przyczyny w jednym pliku
nagłówka — przyczyna jest per-moduł.

**4. Projekt rozwiązania.** Znaleźć lokalny literał/brakujący klucz i18n dla nazwy modułu
„Organizacja" w konfiguracji Menu 1 (prawdopodobnie `menuConfig.ts` lub odpowiadający breadcrumb
tego konkretnego modułu) i poprawić punktowo — **nie** refaktoryzować mechanizmu nagłówka jako
całości, bo Ustawienia dowodzą, że mechanizm działa poprawnie gdzie indziej. Część zakresu **P3**
(Organizacja jest wymieniona wprost w `D_SYNTEZA_I_PLAN.md` P3).

**5. Kroki wykonania.**
1. `rg -i "'Organization'" src/components/navigation/ src/routes/` żeby znaleźć literał per-moduł.
   **S, Sonnet.**
2. Zamienić na klucz i18n zwracający „Organizacja" w PL i „Organization" w EN (nie hardkodować
   jednego języka). **S, Sonnet.** Wymaga `[ODMROZENIE 01_ORGANIZATION DEC-404]`.

**6. Testy.**
- Jednostkowe: test na komponencie nagłówka Menu 1 dla trasy Organizacji — renderuje „Organizacja"
  przy locale `pl` (dowód mutacyjny: przywrócenie literału `'Organization'` musi zawalić test).
- Wizualne: `01-profile.png` ponownie po naprawie, plus 1280/1920/ciemny (audyt C mierzył tylko
  jedną szerokość).
- Przepływ klikany: dokument III, Organizacja.

**7. Kryterium odbioru właściciela.** Nagłówek Menu 1 mówi „Organizacja" na ekranie Tożsamości —
„tak" natychmiast, reszta ekranu jest już zaakceptowanej jakości.

**8. Ryzyka i cofanie.** Bardzo niskie — jeden literał. Cofanie: rewert pojedynczego commita.

**9. Nakład.** S (Sonnet, 0,5 dnia).

---

## 14. Panel Administratora

**1. Cel dla użytkownika.** Ekran Polityki bezpieczeństwa pozostaje gotowy do pokazania bez zmian —
ta paczka to potwierdzenie na dodatkowych szerokościach i w ciemnym motywie.

**2. Zakres.** Ekran: **Bezpieczeństwo i tożsamość › Polityka bezpieczeństwa**
(audyt C, rekomendacja flagowa „gotowy do pokazania bez zastrzeżeń"; brak numeru zrzutu w tabeli C —
do potwierdzenia w `evidence/audyt-award-20260905/admin/` przed pomiarem). Moduł zamrożony jako
`14_ADMIN` (2026-09-05T14:59:23Z). **Nie mylić** z ekranem „Przegląd" tego samego modułu, który ma
udokumentowaną desynchronizację breadcrumbu (deduction 1 w C) — to inny ekran, poza zakresem tej
paczki.

**3. Przyczyna źródłowa.** Audyt C: „sub-taby (Polityka współpracy/Dostęp API/Delegowane IAM/SCIM i
cykl życia/Podsumowanie ryzyka), trzy karty (Wymuszanie MFA/Postawa SSO/Sesja i hasło) w pełni po
polsku, spójne z resztą aplikacji" — B=3 bez zastrzeżeń. **Nie dotyczy** — brak zidentyfikowanego
defektu na tym konkretnym ekranie.

**4. Projekt rozwiązania.** **Nie dotyczy** — zero zmian kodu.

**5. Kroki wykonania.**
1. Ustalić dokładną ścieżkę zrzutu w `evidence/audyt-award-20260905/admin/` odpowiadającą temu
   ekranowi (audyt C nie podał nazwy pliku wprost w tabeli). **S, weryfikacja.**
2. Zrzut przy 1280/1920 (audyt mierzył jedną szerokość) + ciemny motyw na wszystkich trzech. **S,
   harness, po dostarczeniu `--theme=dark` z dokumentu IV.**

**6. Testy.**
- Jednostkowe: **nie dotyczy**.
- Wizualne: nowe zrzuty 1280/1920/ciemny.
- Przepływ klikany: dokument III, Panel Administratora.

**7. Kryterium odbioru właściciela.** Ekran Polityki bezpieczeństwa wygląda tak samo dobrze na
wszystkich trzech szerokościach i w obu motywach — „tak" bez nowych pytań.

**8. Ryzyka i cofanie.** **Nie dotyczy** (brak zmian kodu).

**9. Nakład.** S (0,5 dnia, czysto pomiarowe, zależne od dokumentu IV dla ciemnego motywu).

---

## 15. Ustawienia

**1. Cel dla użytkownika.** Ekran Przeglądu bezpieczeństwa pozostaje gotowy do pokazania bez zmian —
potwierdzenie na dodatkowych szerokościach i w ciemnym motywie.

**2. Zakres.** Ekran: **Bezpieczeństwo › Przegląd bezpieczeństwa**
(`evidence/audyt-award-20260905/ustawienia/`; audyt C, rekomendacja flagowa „gotowy bez zastrzeżeń").
Moduł zamrożony jako `15_SETTINGS` (2026-09-05T14:59:26Z).

**3. Przyczyna źródłowa.** Audyt C: „poprawne semantyczne użycie czerwieni (karta ostrzegawcza „0%
Wymaga poprawy" — to jest dokładnie dozwolony przypadek krytycznej semantyki, nie CTA), uczciwa
etykieta „Odroczone / Nieuwzględnione w demo MVP" przy 2FA zamiast ukrywania braku funkcji" — B=3.
**Nie dotyczy** — brak zidentyfikowanego defektu.

**4. Projekt rozwiązania.** **Nie dotyczy.**

**5. Kroki wykonania.**
1. Zrzut przy 1280/1920 (audyt mierzył jedną szerokość) + ciemny motyw. **S, harness.**

**6. Testy.**
- Jednostkowe: **nie dotyczy**.
- Wizualne: nowe zrzuty 1280/1920/ciemny.
- Przepływ klikany: dokument III, Ustawienia.

**7. Kryterium odbioru właściciela.** Ekran Przeglądu bezpieczeństwa wygląda tak samo dobrze na
wszystkich trzech szerokościach i w obu motywach — „tak" bez nowych pytań.

**8. Ryzyka i cofanie.** **Nie dotyczy.**

**9. Nakład.** S (0,25 dnia).

---

## 16. Partnerzy

**1. Cel dla użytkownika.** Pusty stan portalu partnerskiego (i alternatywnie ekran logowania)
pozostają gotowe bez zmian — potwierdzenie na dodatkowych szerokościach i w ciemnym motywie.

**2. Zakres.** Ekran: **Portal partnerski — pusty stan „Profil partnera nie jest jeszcze
podłączony"** (podstawowy wybór) lub **ekran logowania `/auth`** (wzorzec ogólny)
(`evidence/audyt-award-20260905/partner/`; audyt C, rekomendacja flagowa dwuwariantowa). Moduł
zamrożony jako `16_PARTNER` (2026-09-05T14:59:28Z).

**3. Przyczyna źródłowa.** Audyt C: portal partnerski „uczciwy, dobrze zaprojektowany pusty stan…
zgodny z kanonem pustych stanów", logowanie „najczystszy ekran całego pakietu C". **Nie dotyczy** —
brak zidentyfikowanego defektu na *tych* dwóch ekranach. Crimson jako kolor CTA (deduction 1 w C)
dotyczy **innego** ekranu tej samej sekcji — strony marketingowej `/become-partner/apply`, jawnie
odnotowanej w audycie jako „poza Standardem/SPEC-A wprost, do ustalenia z właścicielem" — nie jest
częścią tej paczki i nie powinna być naprawiana pod tym samym wzorcem bez osobnej decyzji, bo to
strona marketingowa z odrębnym systemem wizualnym, nie ekran aplikacji.

**4. Projekt rozwiązania.** **Nie dotyczy** dla wybranych dwóch ekranów flagowych.

**5. Kroki wykonania.**
1. Zrzut obu kandydatów (pusty stan portalu, ekran logowania) przy 1280/1920 + ciemny motyw. **S,
   harness.**
2. **Poza tą paczką, do decyzji właściciela osobno:** czy zasada „crimson tylko krytyczne" obowiązuje
   też stronę marketingową `/become-partner/apply` — pytanie otwarte z audytu C, nie rozstrzygnięte
   tutaj.

**6. Testy.**
- Jednostkowe: **nie dotyczy**.
- Wizualne: nowe zrzuty obu kandydatów, 1280/1920/ciemny.
- Przepływ klikany: dokument III, Partnerzy.

**7. Kryterium odbioru właściciela.** Wybrany ekran (pusty stan portalu lub logowanie) wygląda
dobrze na wszystkich trzech szerokościach i w obu motywach — „tak" bez nowych pytań.

**8. Ryzyka i cofanie.** **Nie dotyczy.**

**9. Nakład.** S (0,25 dnia).

---

## Zbiorczo — nakład programu ekranów flagowych

| # | Moduł | Ekran flagowy | Zależność P1–P6 | Nakład |
| :-: | --- | --- | --- | :-: |
| 1 | Czat | Otwarta konwersacja @1920 | P3 (i18n klucz), P5 (404 cichy), P8 (dane demo) | ~1,75 dnia |
| 2 | Moja Praca | Skrzynka z podglądem | P1, P2 | ~5-6 dni |
| 3 | Wywiad | Skrzynka @1920 | P1 (po Mojej Pracy) | ~3 dni |
| 4 | Narzędzia | Biblioteka | P2, P5, P6 | ~4 dni |
| 5 | Ocena | DRD Macierz pełny ekran | brak | ~0,5 dnia |
| 6 | Inicjatywy | Panel podglądu | brak (P3 warunkuje resztę modułu, nie ten ekran) | 0,25 dnia (+3-5 dni P3) |
| 7 | Realizacja | Kokpit menedżera | brak (P5 warunkuje resztę modułu) | ~2,25 dnia |
| 8 | Wyniki | Cel — pełna karta OKR | P3, P7 (już wykonane) | ~1,25 dnia |
| 9 | Finanse | Sprawozdania — lista | nie dotyczy (poza MVP) | 0 dni |
| 10 | Materiały | Document Studio — nowy dokument | brak (dopomiar) | ~0,5 dnia |
| 11 | Audyty | Podgląd programu audytowego | P3 | ~1 dzień |
| 12 | Spotkania | Lista i podgląd | brak | ~1-2 dni |
| 13 | Organizacja | Tożsamość i model działania | P3 | ~0,5 dnia |
| 14 | Panel Administratora | Polityka bezpieczeństwa | brak (dopomiar) | ~0,5 dnia |
| 15 | Ustawienia | Przegląd bezpieczeństwa | brak (dopomiar) | ~0,25 dnia |
| 16 | Partnerzy | Pusty stan portalu / logowanie | brak (dopomiar) | ~0,25 dnia |

**Razem (bez Finansów, bez rezerwy warunkowej Materiałów, bez pełnego P3 poza flagowymi
ekranami):** ok. **22-24 dni** wykonawcze, w większości równoległe między modułami (różne pliki,
różni wykonawcy) — sekwencyjna jest tylko zależność Wywiadu od ukończenia P1 w Mojej Pracy.

**Moduły wymagające `[ODMROZENIE]` z powodu tej paczki:** Czat, Moja Praca, Wywiad, Narzędzia,
Inicjatywy, Realizacja, Audyty, Organizacja — **8 z 14 zamrożonych modułów**, wszystkie z numerami
DEC do zarezerwowania (`DEC-397`…`DEC-404`, patrz nota na początku dokumentu — **propozycja, nie
zatwierdzona decyzja**).

---

## 10. Cel osiągnięty = samokontrola Codexa (dla KAŻDEGO ekranu flagowego z tej paczki)

Cel ekranu flagowego = **A = 3 i B = 3** w metodzie audytu (`docs/program/AUDYT_AWARD_20260905/README.md`) na **1280 / 1440 / 1920 px, jasny i ciemny**, potwierdzone mechanicznie, a potem jednym „tak” właściciela.

| Komenda | Oczekiwany wynik |
| --- | --- |
| `npx esbuild <każdy zmieniony plik> --bundle --platform=browser --outdir=/tmp/esb --log-level=error --loader:.png=file --loader:.svg=file` | exit 0 |
| `npx vitest run <testy komponentów ekranu>` | PASS; każda zmiana kompozycji ma test z dowodem mutacyjnym |
| `bash scripts/check-list-canon.sh && bash scripts/check-artefakt.sh` | `OK`, dług nie rośnie |
| `node scripts/dev/audyt-award-20260905/audyt.mjs --ekran=<url> --port=<p> --host=127.0.0.1 --szerokosc=1280,1440,1920 --motyw=jasny,ciemny --out=ev/<modul>-flagowy/` (rozszerzenie harnessu o `--motyw`/`--szerokosc` = paczka IV; do czasu jej wdrożenia: `zrzut.mjs` × 6 wariantów + ręczne zliczenie z `.json`) | 6 zrzutów + `.json` |
| `git log --format=%s origin/staging..HEAD` | pliki modułów zamrożonych tylko z `[ODMROZENIE <MODUL> DEC-397]` |

Progi (z `.json` każdego z 6 wariantów):
- `bledyKonsoli` = 0; żądania `status ≥ 400` = 0 (poza jawnie udokumentowanymi w sekcji modułu);
- `przepelnieniaPoziome` = 0; `dom.aside.count` ≤ 1; zero par nakładających się prostokątów tekstu;
- stop-lista EN (P3) = 0 trafień w `tekst`; regex UUID/SCREAMING_CASE (P4) = 0;
- para jasny/ciemny: `mean_luma` różne o ≥ 40 (bezpiecznik przeciw bliźniaczej parze);
- porównanie z wzorcem złota wskazanym w sekcji modułu: identyczna powłoka (Menu 1/2/3, panel, typografia) — kontrola wzrokiem PO obok wzorca;
- wszystkie dedukcje z tabeli „dzisiejsze dedukcje” sekcji modułu zamknięte (każda ma w raporcie: co zmieniono, którym zrzutem to widać).

**STOP:** 6 wariantów spełnia progi → commit `evidence/flagowy-<modul>/` + raport → nadzorca ogląda i dopiero wtedy ekran trafia na 3100/final do jednego „tak” właściciela. Dedukcja wymagająca decyzji produktowej (zmiana treści, nie formy) → STOP i opis, nie zgadywanie. Zakazy: `--no-verify`, `git stash`, flagi, nowy język wizualny (tylko komponenty standardowe).

## 11. Wklejka dla Codexa (szablon — wstaw moduł i sekcję)

```
ZADANIE II-<nr> — Ekran flagowy modułu <MODUŁ>: <NAZWA EKRANU> do poziomu sceny (A=3, B=3). Praca do celu.

Katalog: świeży worktree z origin/staging (git worktree add -b codex/flagowy-<modul> <dir> origin/staging). Commit per krok, bez push, autor Piotr <piotr.wisniewski@dbr77.com>.
Specyfikacja: docs/program/PROGRAM_NAPRAWCZY_20260905/II_EKRANY_FLAGOWE.md — sekcja „<nr>. <MODUŁ>” (przeczytaj też „Jak czytać tę paczkę” i §10). Zależności P1–P6 z tabeli zbiorczej muszą być scalone przed startem — sprawdź git log origin/staging.

CEL: ten jeden ekran wygląda i działa jak wzorzec złota (ścieżki w sekcji): jeden panel, lekkie centrum, komponenty standardowe, tokeny c-*, polszczyzna bez wyjątku, zero surowych kodów, zero ucięć, zero błędów konsoli i ≥400 — na 1280/1440/1920 w jasnym i ciemnym motywie. Lista dedukcji do zamknięcia: tabela w sekcji modułu.

KROKI: zamknij dedukcje w kolejności z sekcji; każda zmiana kompozycji = test z dowodem mutacyjnym; moduł zamrożony → marker [ODMROZENIE <MODUL> DEC-397].
CEL OSIĄGNIĘTY = §10: 6 wariantów zrzutów z .json spełnia progi (0 błędów, 0 ≥400, 0 przepełnień, ≤1 aside, 0 EN, 0 UUID, luma jasny/ciemny różna), każda dedukcja zamknięta i pokazana zrzutem, canon i artefakt OK. Raport: tabela dedukcja → zmiana → zrzut, SHA. Decyzja produktowa → STOP i opis. Zakazy: --no-verify, git stash, flagi, własny język wizualny.
```
