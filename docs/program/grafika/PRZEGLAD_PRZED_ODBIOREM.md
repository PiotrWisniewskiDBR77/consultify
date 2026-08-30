---
doc_id: grafika-przeglad-przed-odbiorem
status: current
truth_type: review
established: 2026-08-30
zakres: 55 ekranów zapalonych właścicielowi (odbior.sqlite → poprawki, lp >= 29)
dowody: evidence/grafika/121-przeglad-calosci/ (110 zrzutów, oba motywy)
---

# Przegląd całości przed oddaniem właścicielowi

**Po co ten dokument.** Dziś naprawiono ~30 ekranów w ośmiu równoległych torach.
Każdy sprawdzano osobno. Nikt nie sprawdził ich razem. To jest to sprawdzenie:
jedno oko, wszystkie 55 ekranów, oba motywy, 110 zrzutów obejrzanych po kolei.

**Metoda.** Zrzuty świeże (`grafika-zrzuty.mjs --katalog=121-przeglad-calosci
--faza=PO`), parametry adresu odczytane z etykiet rejestru `dev-render/main.tsx`
i z kodu ekranów (`params.get(...)`), nie zgadywane. Ocena wzrokiem, nie z testów.

**Wynik jednym zdaniem: 25 ekranów na 55 nie powinno dziś iść do właściciela** —
w tym sześć dlatego, że naprawa zameldowana rano nie jest widoczna na zrzucie
zrobionym wieczorem, a pięć dlatego, że **jedna dzisiejsza zmiana we wspólnej
tabeli łamie nagłówki w środku wyrazu na całej aplikacji.**

---

## 1. NAJPOWAŻNIEJSZE — trzy rzeczy do przeczytania, nawet jeśli reszty nie

### Z-1. `break-words` we wspólnej tabeli łamie wyrazy w pół — na KAŻDYM ekranie listowym

Commit z dziś `2fc5e3321f` („tabele: ostatnia kolumna przestaje być ucinana —
jądro skaluje kolumny gdy suma przekracza kontener") dodał do
`src/components/shared/ModuleHub/FilterableTable.tsx` klasę `break-words`
w trzech miejscach nagłówka (linie 1122, 1143, 1147) i w komórce (linia 1447).

`break-words` w Tailwindzie to `overflow-wrap: break-word` — łamanie **wewnątrz
wyrazu**. Komentarz autora mówi: „łamanie odpala się dopiero, gdy słowo naprawdę
się nie mieści". Po zwężeniu kolumn przez tę samą zmianę **słowa przestały się
mieścić** i łamanie odpala się realnie:

| ekran | co widać |
| --- | --- |
| `results-vnext-okr-registry` | `ZAKTUALI ZOWANO`, pigułka `Złożony do akce…` |
| `results-vnext-roi-full-tool` | `ZAKTUALIZOWA NO` |
| `admin-command-center-panel` | `OPÓŹNIEN IE` |
| `finance-analysis-workspace` | `OGÓLNA INTERPRETAC JA`, `INTERPRETAC JA WYNIKU`, `PRZEZNACZE NIE` |
| `capacity-advisor-a3` | w KOMÓRKACH: `engineerin g team`, `Ograniczen ie`, `Potwierdzo ne` |

`StandardTable` jest fasadą nad `FilterableTable`, a `StandardTable` importuje
**228 plików**. To nie jest defekt pięciu ekranów — to defekt wspólnego jądra,
który dziś widać na pięciu, bo tylko tyle ekranów ma wąskie kolumny. Właściciel
odrzucił łamanie nagłówka w środku wyrazu przy `plan-scenario-d1` — reguła wróciła
u sąsiadów tego samego dnia, tylko innymi drzwiami.

### Z-2. Kanon prawego panelu jest realizowany na PIĘĆ różnych sposobów

Reguła z `KANON_Z_ODBIOROW.md`: *Akcje · Właściwości · Powiązania · Źródła
i założenia · Komentarze · Historia*. Stan faktyczny:

| ekran | co jest naprawdę |
| --- | --- |
| `deck-artifact` | Akcje · Właściwości · Powiązania · **Źródła i założenia** · Komentarze · Historia ← kanon |
| `karta-insight`, `karta-initiative`, `karta-tool` | jw. + wstawione **REZULTATY** między Źródła a Komentarze |
| `idea-table` | **BRAK Źródeł i założeń**, ostatnia sekcja nazwana `HISTORIA / AI` |
| `mywork-notebook-rail-speca` | **BRAK Źródeł i założeń**, ostatnia sekcja nazwana `HISTORIA I AI` |
| `ideas-teresa-panel` | **BRAK Źródeł i założeń**, ostatnia sekcja nazwana `HISTORIA` — i cała Teresa (Rozmawiaj / KOMENDY / SUGESTIE) siedzi **w środku Historii** |
| `tools-swot-session-workspace` | **BRAK HISTORII** (Akcje · Właściwości · Powiązania · Źródła · Rezultaty · Komentarze) |
| `finance-statement-pack-workspace-v2` | zupełnie inny zestaw: Rekoncyliacja · Powiązane artefakty · Sekcja raportu |

Poprawka 46 melduje: *„Prawy panel zostawiony bez zmian — sprawdziłem, jest zgodny
z kanonem SPEC-A"*. Nie jest: brakuje sekcji i nazwa ostatniej sekcji jest trzecia
w aplikacji. Poprawka 67 melduje *„pięć sekcji w kolejności kanonu"* — kolejność
tak, komplet nie, bo kanon ma sześć sekcji.

### Z-3. Reguła „nagie zero" działa na JEDNYM ekranie z trzech braci

`KANON_Z_ODBIOROW.md`, wpis oznaczony ★: *licznik `0` wynikający z trybu widoku
musi stać obok zdania, że liczba opisuje widok; sekcja z tym zdaniem jest
rozwinięta*.

- `karta-initiative` — **zrobione wzorowo**: sekcja AKCJE rozwinięta, zdanie
  „Liczba 0 opisuje ten widok, nie inicjatywę…" widoczne od razu.
- `karta-insight` — `AKCJE 0`, sekcja zwinięta, zero zdania.
- `karta-tool` — `AKCJE 0`, `KOMENTARZE 0`, `HISTORIA 0`, wszystko zwinięte, zero zdania.

Trzy karty tego samego archetypu, jedna reguła, jedno wykonanie. Właściciel
otworzy je po kolei i zobaczy to w dziesięć sekund.

---

## 2. Tabela: ekran · ocena · co jest nie tak

Legenda: **A** przechodzi · **B** przechodzi z nazwanym wyjątkiem · **C** wraca
do naprawy · **D** martwy/przyrząd pomiarowy/cudzy zakres.

### Finanse

| ekran | ocena | co jest nie tak |
| --- | --- | --- |
| `finance-valuation-workspace` | B | Pigułki kroków naprawione zgodnie z meldunkiem. W kadrze identyfikatory techniczne `bv-valuation-dbr77-1` i `(lineage)`, nazwa „Base Case". „Szczegóły techniczne" z surowym trójkątem `▶` (natywne `<details>`), gdy reszta aplikacji ma szewrony. |
| `finance-analysis-workspace` | **C** | Nagłówki łamane w środku wyrazu (Z-1). Kolumny `WZÓR` i `OGÓLNA INTERPRETACJA` mają **identyczną treść we wszystkich wierszach** — duplikat kolumny, dokładnie ten sam defekt, który usunięto z `plan-scenario-d1`. |
| `finance-prediction-workspace` | **C** | Siatka pól formularza **bez etykiet** — użytkownik widzi „70", „3", „150000", „p-2026-03" i nie wie, co to jest. W kadrze `COGS`, `RATIO`, `REVENUE`, „Uruchom preflight", Base/Bull/Bear. |
| `finance-statement-pack-workspace-v2` | B | W kadrze pasek deweloperski `state=populated (populated|empty|missing)`. Prawy panel z innym zestawem sekcji niż kanon (Z-2). `Misc Unmapped 9001`, `COGS`, `Baseline`. |
| `finance-comments-panel` | B | Karta o stałej wąskiej szerokości na pustym kadrze — ten sam układ, który właściciel odrzucił przy zapisanych widokach. „Nowa pozycja checklisty" obok nagłówka „Lista kontrolna przeglądu" — dwie nazwy tej samej rzeczy w jednej karcie. |
| `finance-compare-panel` | **C** | Etykiety wierszy to **surowe klucze techniczne**: `REVENUE`, `COGS`, `GROSS_MARGIN`, `OPEX`, `EBITDA`, `EBIT`, `NET_INCOME`. Ujemne różnice na czerwono (crimson) — różnica -2,6% nie jest stanem krytycznym. |
| `finance-lineage-navigator` | **C** | „**Świeżość ogniska: Aktualne**" — kalka maszynowa, po polsku to nie znaczy nic. Poza tym uczciwe puste stany („Brak bezpośrednich dzieci.") są dobre. |
| `finance-saved-views-panel` | B | Dane widać (meldunek 53 spełniony), ale **układ, o który była uwaga, został**: wąska karta na 85% pustego kadru. „Usuń" jako czerwony tekst w rzędzie linków, gdy w innych modułach usuwanie żyje w kebabie. |
| `finance-export-import-panel` | **C** | Natywna kontrolka pliku **„Choose File / No file chosen"** — po angielsku, w systemowym stylu, w środku polskiego panelu. |
| `finance-workspace-bar` | D | Przyrząd, nie ekran (świadomie). W kadrze `PRESENT_NONZERO`, `MISSING`, `NOT_APPLICABLE`, `formatFinanceValueForDisplay`. Nie pokazywać jako ekranu produktu. |

### Ocena i Audyty

| ekran | ocena | co jest nie tak |
| --- | --- | --- |
| `assessment-reports-panel` | B | Po polsku, pełna szerokość, oba motywy dobre. Paleta pigułek (fiolet + bursztyn + niebieski + zieleń + szarość) jest szersza niż gdziekolwiek indziej — fiolet nie występuje w innych modułach. |
| `assessment-initiatives-table` | **C** | **Ciemny motyw: pigułka „Planowanie" traci tło** i zostaje gołym tekstem, podczas gdy „Szkic" w tym samym widoku tło zachowuje. Tytuły ucinane wielokropkiem, mimo ~150 px wolnego miejsca po prawej. Komponent i tak nie jest zamontowany w produkcie (status.json). |
| `assessment-five-surfaces` | **C** | **Wszystkie liczniki statusów pokazują 0** (Wszystkie 0, Szkic 0, W przeglądzie 0, …), a tabela pod nimi ma 5 wierszy. Licznik kłamie. Cała kolumna `OBSZAR` po angielsku (Digital transformation, Smart manufacturing, Process capability, Lean and automation) + pigułka „AI Triage". |
| `drd-library-entry` | **C** | **Baner deweloperski w kadrze**: „Flaga `drdMethodWorkspaceSliceV1` = ON — PODWÓJNE kliknięcie… `MethodWorkspaceShell` … `/assessment/drd/:id`". Sześć kolumn zgodnie z meldunkiem, ale bez kebaba i bez pstryczka kolumn, które mają sąsiednie tabele Oceny. |
| `drd-macierz-oceny` | **C** | **Cały ekran po angielsku** — „DIGITAL DEVELOPMENT MAP", „Process Digitalization Assessment Matrix", „Hover for preview · Click for details" ×7, „Avg. Current Level", „Areas Assessed", nazwy poziomów Manual→Autonomous, prawy panel „Survey / Axis". Do tego ekran **sam pisze** „2 more columns to the right — scroll to see them", a dziewiąta kolumna jest ucięta krawędzią — meldunek 44 mówił „wszystkie 9 kolumn w kadrze". |
| `audyty-drd-report` | **C** | **Zielony wypełniony przycisk „Prześlij"** — takiego CTA nie ma nigdzie indziej w aplikacji (kanon: CTA neutralne granatowo-białe). Data `7/21/2026` w formacie amerykańskim. Ikona kosza (nieodwracalne) wprost w nagłówku sekcji, nie w kebabie. |

### Moja praca i Idee

| ekran | ocena | co jest nie tak |
| --- | --- | --- |
| `vault-safes-table` | B | Pełna szerokość i jeden wiersz na linię — zgodnie z meldunkiem. Kolumna `ZAKRES` ucinana, choć tabela kończy się ~150 px przed krawędzią. Zakładki „Sejfy / Foldery" jako goły tekst, gdy inne moduły mają pigułki. |
| `idea-table` | B | Brak „Źródeł i założeń", sekcja `HISTORIA / AI` (Z-2). Wewnątrz sekcji `POWIĄZANIA` jest **druga ramka też podpisana `POWIĄZANIA`**. Data `15/07/2026`. |
| `idea-table-record-templates` | **C** | **Dwa czerwone dymki „Nie udało się załadować szablonów" nadal wchodzą razem z ekranem.** Meldunek 70 rozpoznał to jako powód odrzucenia — i nie naprawił. Funkcja wita użytkownika błędem. |
| `idea-confidentiality-control` | **C** | **Na zrzucie nie widać kontrolki poufności w ogóle.** Meldunek 69 opisuje pigułkę „Poufna" w rzędzie metadanych — w kadrze jest Problem / Status / Model dojrzałości. Zrzut nie dowodzi tego, co ma dowodzić; nie da się tego odebrać. |
| `ideas-teresa-panel` | **C** | Brak „Źródeł i założeń", a **cała Teresa jest zagnieżdżona w sekcji HISTORIA** (Z-2). Notatnik trzyma to jako osobną sekcję „HISTORIA I AI" — dwa panele, które miały „rządzić się tymi samymi zasadami", nazywają tę samą rzecz inaczej. |
| `mywork-notebook-rail-speca` | B | Uczciwe puste stany („Brak — dodaj przez «Wszystkie»") — wzorowe. Brak „Źródeł i założeń". W kadrze „Użyte w (backlinks)", „Brak powiązanych outputów", tagi `active`/`growing`, „Źródło: manual". |
| `zwornik-projects` | B | Czysty, po polsku, zakładka Projekty realnie w Mojej Pracy. Data `2026-06-11` — format, którego nie używa żaden inny ekran. |

### Karty i artefakty

| ekran | ocena | co jest nie tak |
| --- | --- | --- |
| `karta-insight` | B | Trzy duże wiersze w trzech kolorach — zrobione tak, jak właściciel prosił. `AKCJE 0` zwinięte bez zdania (Z-3). Przycisk „Analizuj z AI" fioletowy w pasku arkusza, gdy na `karta-tool` ta sama funkcja jest szarym tekstem w pasku górnym. |
| `karta-initiative` | B | **Jedyny ekran, który wykonał regułę nagiego zera w całości.** Ale „Wypełnij z AI" i „Analizuj z AI" stoją **w tym samym pasku** — a `KANON_Z_ODBIOROW.md` cytuje właściciela: „górny pasek AI dotyczy wypełnienia całego narzędzia, a dolny pasek dotyczy danej karty". To do rozstrzygnięcia przez właściciela, nie do naprawy w biegu. |
| `karta-tool` | B | Przykład na pełną szerokość i biały CTA naprawione. Trzy nagie zera (Z-3). |
| `deck-artifact` | B | Prawy panel dokładnie w kanonie, 300 px, sekcje we właściwej kolejności — najlepszy prawy panel z całej rundy. Ale Menu 2 to **gołe linki tekstowe** („Nowy slajd · Pole tekstowe · … · Usuń slajd"), gdy każde inne Menu 2 ma pigułki; „Usuń slajd" jako link, nie w kebabie. Nagłówek slajdu „Problem" crimsonem. |
| `preview-4-zakladki` | D | Przyrząd pomiarowy, uczciwie się tak podpisuje. W kadrze **ścieżki plików z numerami linii** (`IdeasTableContent.tsx:634` itd.) i legenda `emerald / red / amber / neutral / primary`. Merytorycznie potwierdza meldunek 45: cztery podglądy są strukturalnie identyczne. Nie pokazywać jako ekranu. |
| `prawy-panel-szyna-ikon` | D | Harness porównawczy ze ścieżką `src/components/shared/ExecutiveModuleShell/RightRail.tsx` w kadrze. **Znalezisko realne: crimsonowa plakietka „3" przy ikonie komentarzy na wspólnej szynie** — licznik nieprzeczytanych nie jest stanem krytycznym, a ta szyna renderuje się w Deck Builderze, Document Studio, Tabelach, Excelu i Ideach. |

### Materiały

| ekran | ocena | co jest nie tak |
| --- | --- | --- |
| `materialy-launcher` | **A** | Zwarte, trzy kafle równej wagi, zero ozdobników, zero czerwieni. Bez zastrzeżeń. |
| `word-intake-uselm-default` | B | Dwie sekcje i neutralne „(wymagane)" — zrobione. Ale nagłówek pierwszej sekcji to **„BRIEF"**, po angielsku; w treści „Document Studio". |
| `gen-word-content-hints` | **C** | **Czerwona gwiazdka „Cel *"** — dokładnie to, co tego samego dnia usunięto z `word-intake`. Ikona pstryczka kolumn inna (▯▯) niż suwaki w `StandardTable`. W kolumnie `SEKCJE` wartość `v0.1.0 · 6`. |
| `gen-deck-content-hints` | **C** | Ta sama czerwona gwiazdka. W kadrze „**SuperAdmin**", motyw „Corporate", szablon „Steering Committee Deck Template". Checkbox pomocy AI **domyślnie wyłączony**, gdy bliźniaczy formularz Worda ma go włączony (DEC-317) — dwa kreatory, dwa domyślne ustawienia. |
| `gen-excel-templates-tab` | D | Zdjęte z odbioru przez właściciela, flaga OFF, duplikat. Nie pokazywać. |
| `document-studio-resume-error` | B | Wyśrodkowane, z ikoną, tytułem i wyjaśnieniem — dokładnie jak proszono. W górnym pasku żargon „Tryby 1, 2, 3 · Środowisko artefaktów Word/PDF". |
| `document-studio-template-resolve-error` | B | To samo, w obu motywach poprawnie. |
| `prezentacje-template-states` | **C** | **Parametr `?variant=` nie zadziałał** — zamiast trzech stanów blokujących wyrenderowała się galeria wzorców. Nie da się odebrać tego, co miało być odebrane. Sama galeria: „Deck dla Komitetu Sterującego", „Pitch Deck", „Status update projektu", „Deck warsztatowy", „Deck case inwestycyjnego", „Metryki QBR i roadmapa" — anglicyzm na anglicyzmie. Kafelek modułu różowy (blisko crimsona), gdy bliźniaczy Excel ma zielony. |
| `excele-engine-reveal` | B | Ta sama powłoka co Prezentacje — to akurat spójność i dobrze. Meldunek 75 opisuje „uczciwy stan pusty (Brak ostatnich dokumentów)", a domyślnie otwiera się zakładka Wzorce z ośmioma kaflami — opis i ekran się rozjeżdżają. |
| `template-library-new-entry` | D | Świadomy dowód wpięcia, ale w kadrze „flaga templateBuilder: ON" i „powinien otworzyć się wizard→builder (overlay)". 95% pustego ekranu. Nie pokazywać jako ekranu. |

### Wyniki

| ekran | ocena | co jest nie tak |
| --- | --- | --- |
| `results-vnext-okr-registry` | **C** | `ZAKTUALI ZOWANO` łamane w pół (Z-1). Kolumna `WŁAŚCICIEL` pokazuje **surowe identyfikatory** `user-pio…`, `user-tom…`, `user-ann…` zamiast nazwisk. Pigułka statusu ucięta w pół wyrazu. Ostatnia kolumna faktycznie już nie wypada — ta część meldunku 35 jest prawdziwa. |
| `results-vnext-roi-full-tool` | **C** | Rejestr, nie karta (wejście w narzędzie wymaga kliknięcia — to nie wada). `ZAKTUALIZOWA NO` łamane w pół, `user-piotr-demo` w kolumnie właściciela. |
| `results-vnext-roi-model` | **C** | **Kolumna `PEWNOŚĆ` ucięta krawędzią tabeli** (`PEW`, wartości `Wys…`, `Śred…`), przy ~28% wolnej szerokości strony obok. To jest ta sama „ostatnia kolumna", którą dziś naprawiano. Scalenie do jednej karty ROI faktycznie zrobione — trzy paski menu zniknęły. |
| `results-vnext-roi-pir-outcomes` | B | Czysty, po polsku, uczciwe „—" przy braku danych. Brak kebaba i pstryczka, które ma rejestr ROI dwa kliknięcia wcześniej. Pojedyncza samotna pigułka „Wyniki PIR" jako całe menu. |
| `results-vnext-teresa-okr-reflection` | B | Przyciski w kanonie, czerwień tylko na „Zamknij zestaw" (nieodwracalne — zgodnie z rejestrem). Ekran **nie ma żadnego paska tożsamości ani Menu 1** — zaczyna się od karty „Samoocena". „Ocena managera" → po polsku „menedżera". |

### Inicjatywy

| ekran | ocena | co jest nie tak |
| --- | --- | --- |
| `plan-scenario-d1` | B | 10 kolumn, zero ucinania, **zero nagłówków łamanych w środku wyrazu** — naprawa trzyma. Nazwy inicjatyw ucinane wielokropkiem mimo wolnego miejsca. |
| `capacity-advisor-a3` | **C** | Nagłówki OK, ale **treść komórek łamie się w środku wyrazu**: `engineerin g team`, `Ograniczen ie`, `Potwierdzo ne`, `ograniczeni a`. Meldunek 37 mówi „zero ucinania" — ucinania nie ma, jest łamanie. W kadrze `engineering team`, `FTE-week`, `Resource Manager`. |

### Czat, Agent, Wywiad, Narzędzia

| ekran | ocena | co jest nie tak |
| --- | --- | --- |
| `teresa-confirm-chip` | A | Lekka kartka wtopiona w rozmowę, wąska, przyciski jako małe pigułki — dokładnie jak proszono. Jedyne zastrzeżenie: podpis harnessu „F1-A · … (realny MessageRenderer)" w kadrze. |
| `teresa-chipy-sugestii` | D | To ekran diagnostyczny, nie produktowy: „warunek `artifactMentioned = true`", „oczekiwane PO naprawie:", angielskie „Open Outputs Library" / „Review pending artifacts" jako materiał dowodowy. Przełącznika z meldunku 42 („Tryby AI") na zrzucie nie widać. Nie pokazywać. |
| `agent-plan-canvas` | **C** | **Dwa warianty nachodzą na siebie** — karta ścieżki ② zasłania paletę ścieżki ①, tekst „Przeciągnij, że[by]" jest ucięty przez nakładkę, szewrony drugiej palety pływają nad pierwszą. Widoczne w obu motywach. Grupy palety zwinięte tylko po prawej stronie. „Uruchom proces" na zielono. |
| `agent-warsztat` | **C** | Wielkości tekstu realnie poprawione. Ale treść klocków jest po angielsku: „Business case", „Assessment", „Assessment data", „Finance", „Financial calculation", „My Work", „Create task", „Create task (approval)", „Vault-kontekst · Vault". Kosz na każdym klocku (nieodwracalne bez kebaba). „Uruchom proces" zielony. |
| `interview-creator-shell` | B | Kolory typów analizy realnie działają. Ale ikona „Odkrywanie Problemów" jest **crimsonowa** — odkrywanie problemów nie jest stanem krytycznym. Wymagalność oznaczona `*`, nie „(wymagane)". Tytuły w Title Case („Podsumowanie Wykonawcze"), po polsku się tak nie pisze. |
| `interview-preview-canon` | **C** | **Tytuł nadal ucięty** — „Odbiór właścicielski …" — a meldunek 47 mówi „pełny tytuł zamiast uciętego". Do tego zestaw bloków **różni się** od czterech podglądów kanonu: zamiast „SZCZEGÓŁY ~N słów" jest tabela „PRZEBIEG", zamiast siatki pigułek akcji jeden CTA „Generuj wnioski". Meldunek 45 mówi, że podglądy są identyczne poza treścią — te dwa nie są. W kadrze „Assignee: Ala Kowalska", „Organizacja: W3 Interview Owner Review". |
| `tools-swot-session-workspace` | **C** | Polska wersja realnie się montuje — to prawda i to duża naprawa. Ale: nagłówek lewej szyny **„OUTPUTS"** po angielsku (obok SESJA i ANALIZA), status **„DRAFT"** w czterech miejscach, przyciski „AI Frame" i „AI Draft", we właściwościach `dynamic-swot` i `strategic`. Prawy panel **bez sekcji HISTORIA**. Chip „MISJA I KONTEKST" i tło karty w odcieniu crimsona. |

### Administracja i Spotkania

| ekran | ocena | co jest nie tak |
| --- | --- | --- |
| `admin-command-center-panel` | **C** | `OPÓŹNIEN IE` łamane w pół (Z-1). Kolumna opisu ściśnięta do ~170 px — opis rozlewa się na 8 linii, obok pustka. Koszty w **USD** (`$0.1842`), gdy reszta aplikacji liczy w PLN. Daty `31/07/2026`. |
| `calendar-sync-settings` | **A** | Trzy identyczne neutralne ikony kalendarza — jabłuszko i emoji zniknęły. Czysto, po polsku, oba motywy. Bez zastrzeżeń. |

---

## 3. Niespójności między ekranami — pary „tu tak, tam inaczej"

1. **Nagie zero.** `karta-initiative` ma rozwiniętą sekcję ze zdaniem wyjaśniającym ·
   `karta-insight` i `karta-tool` mają zwinięte `0` bez słowa. Ta sama reguła, trzy bracia.
2. **Prawy panel.** `deck-artifact` ma „Źródła i założenia" · `idea-table`,
   `ideas-teresa-panel`, `mywork-notebook-rail-speca` nie mają jej wcale.
3. **Nazwa ostatniej sekcji panelu.** `HISTORIA` (Idee) · `HISTORIA / AI` (Tabela idei) ·
   `HISTORIA I AI` (Notatnik). Trzy nazwy jednej rzeczy.
4. **Oznaczenie pola wymaganego.** `word-intake-uselm-default`: neutralne „(wymagane)" ·
   `interview-creator-shell`: szara `*` · `gen-word-content-hints` i
   `gen-deck-content-hints`: **czerwona** `*`. Trzy konwencje, wszystkie dotknięte dziś.
5. **Format daty — pięć wariantów w jednej aplikacji.**
   `10 sie 2026` (ROI) · `13.08.2026` (DRD) · `15/07/2026` (Idee) · `2026-06-11` (Projekty) ·
   `7/21/2026` (Raport DRD, format amerykański).
6. **Kolor przycisku wykonania.** Neutralny granatowy CTA w większości aplikacji ·
   **zielony** „Prześlij" (`audyty-drd-report`) i **zielony** „Uruchom proces"
   (`agent-plan-canvas`, `agent-warsztat`).
7. **Menu 2.** Pigułki z obrysem (`karta-tool`, `karta-insight`) · gołe linki tekstowe
   (`deck-artifact`, z „Usuń slajd" włącznie).
8. **Zakładki modułu.** Pigułki (`assessment-five-surfaces`, `drd-library-entry`,
   `zwornik-projects`) · goły tekst (`vault-safes-table`) · pierwsza pigułka + reszta
   tekstem (`prezentacje-template-states`, `excele-engine-reveal`).
9. **Pstryczek kolumn i kebab.** Ma je `idea-table`, `results-vnext-roi-full-tool`,
   `assessment-five-surfaces` · nie ma ich `drd-library-entry`,
   `results-vnext-roi-pir-outcomes`, `admin-command-center-panel`. Dwie tabele w tym
   samym module, dwa różne zestawy narzędzi wiersza.
10. **Ikona pstryczka.** Suwaki (`StandardTable`) · ikona kolumn ▯▯ (`gen-word-content-hints`).
11. **Kolor kafla modułu.** Prezentacje różowy (blisko crimsona) · Excel zielony ·
    Raporty Oceny fioletowy. Trzy akcenty, których nie ma w tokenach reszty aplikacji.
12. **Kolumna właściciela.** Nazwiska z awatarem (`plan-scenario-d1`, `drd-library-entry`) ·
    surowe `user-piotr-demo` (`results-vnext-okr-registry`, `results-vnext-roi-*`).
13. **Domyślna pomoc AI w kreatorze.** Word włączona (DEC-317) · Deck wyłączona.
14. **Podgląd.** Cztery zakładki My Work: `SZCZEGÓŁY ~N słów` + siatka pigułek ·
    Wywiad: tabela `PRZEBIEG` + jeden CTA.
15. **Waluta.** PLN w Finansach i ROI · USD w Centrum administracyjnym.

---

## 4. Podejrzenia o regresję — wspólny komponent i jego promień rażenia

| podejrzenie | wspólny komponent | promień |
| --- | --- | --- |
| **Nagłówki i komórki łamią się w środku wyrazu** | `src/components/shared/ModuleHub/FilterableTable.tsx` (`break-words`, linie 1122/1143/1147/1447, wprowadzone dziś w `2fc5e3321f`) | `StandardTable` jest fasadą nad tym plikiem; `StandardTable` importuje **228 plików**. Zmierzone objawy na 5 ekranach z 55. |
| **Ostatnia kolumna nadal ucinana** mimo naprawy skalowania | ten sam commit `2fc5e3321f` | `results-vnext-roi-model` (`PEWNOŚĆ`). Naprawa działa tam, gdzie ją mierzono (8 ekranów), nie działa u nieprzemierzonych sąsiadów. |
| **Prawy panel rozjechany między rodzinami artefaktów** | `ArtifactRightPanel` vs `IdeaRightPanel` (dwa źródła w `src/components/standard/`) | Idee + Notatnik + Tabela idei mają inną liczbę i inne nazwy sekcji niż Deck/Insight/Initiative/Tool. |
| **Crimsonowa plakietka licznika na wspólnej szynie ikon** | `src/components/shared/ExecutiveModuleShell/RightRail.tsx` | Deck Builder, Document Studio, Tabele, Excel, Idee — wszędzie, gdzie szyna się renderuje. |
| **Nakładanie się kolumn w kanwie agenta** | powłoka porównawcza ekranu `agent-plan-canvas` przy 1440 px | Widoczne w obu motywach; wymaga sprawdzenia, czy to defekt harnessu czy realnej siatki. |

---

## 5. Werdykt: co NIE powinno iść do właściciela

### Nie pokazywać w ogóle (D — to nie są ekrany produktu, 6 pozycji)
`preview-4-zakladki`, `prawy-panel-szyna-ikon`, `finance-workspace-bar`,
`teresa-chipy-sugestii`, `template-library-new-entry`, `gen-excel-templates-tab`.
Wszystkie mają w kadrze ścieżki plików, nazwy flag albo angielskie stałe kodu.
Wartość mają jako dowody dla nas, nie jako obraz produktu.

### Wraca do naprawy przed pokazaniem (C — 25 pozycji)
Kolejność od najpilniejszego:

**Grupa 1 — naprawa nie jest widoczna, meldunek rozjeżdża się ze zrzutem (6):**
`interview-preview-canon` (tytuł nadal ucięty) · `idea-table-record-templates`
(dwa czerwone błędy nadal wchodzą razem z ekranem) · `idea-confidentiality-control`
(kontrolki nie widać w kadrze) · `drd-macierz-oceny` (ekran sam pisze „2 more columns
to the right") · `prezentacje-template-states` (parametr nie zadziałał, widać inny
ekran) · `capacity-advisor-a3` („zero ucinania" zamienione na łamanie w pół wyrazu).

**Grupa 2 — łamanie wyrazów ze wspólnej tabeli (5):**
`results-vnext-okr-registry` · `results-vnext-roi-full-tool` ·
`admin-command-center-panel` · `finance-analysis-workspace` · (`capacity-advisor-a3` wyżej).
Naprawiać **u źródła**, w `FilterableTable`, nie per ekran — inaczej odrośnie.

**Grupa 3 — angielszczyzna w kadrze produktu (6):**
`drd-macierz-oceny` (cały ekran) · `assessment-five-surfaces` (kolumna OBSZAR) ·
`tools-swot-session-workspace` (OUTPUTS, DRAFT, AI Frame/Draft) · `agent-warsztat`
(treść klocków) · `finance-compare-panel` (klucze REVENUE/COGS/EBITDA) ·
`finance-export-import-panel` (Choose File / No file chosen).

**Grupa 4 — czerwień poza semantyką krytyczną i obcy kolor CTA (4):**
`gen-word-content-hints` i `gen-deck-content-hints` (czerwona gwiazdka wymagalności) ·
`audyty-drd-report` (zielony CTA) · `agent-plan-canvas` (zielony CTA + nakładanie się kolumn).

**Grupa 5 — reszta C (4):**
`assessment-initiatives-table` (rozbita pigułka w ciemnym) · `drd-library-entry`
(baner deweloperski w kadrze) · `finance-prediction-workspace` (pola bez etykiet) ·
`finance-lineage-navigator` („Świeżość ogniska") · `results-vnext-roi-model`
(ucięta kolumna PEWNOŚĆ) · `ideas-teresa-panel` (Teresa w środku Historii).

### Można pokazać (A — 3, B — 21)
**A:** `materialy-launcher`, `calendar-sync-settings`, `teresa-confirm-chip`.
**B:** pozostałe 21 — z wyjątkiem wypisanym w tabeli, zgodnie z regułą
„ocena B z nazwanym wyjątkiem jest uczciwa; ocena A z przemilczanym brakiem nie jest".

---

## 6. Osobno: angielszczyzna w kadrze

Ekrany, na których po angielsku jest **interfejs** (nie dane demo, nie nazwy własne):

- `drd-macierz-oceny` — cały ekran, łącznie z podpowiedziami i nazwami poziomów.
- `assessment-five-surfaces` — kolumna OBSZAR + pigułka „AI Triage".
- `tools-swot-session-workspace` — „OUTPUTS" jako nagłówek szyny, „DRAFT" ×4,
  „AI Frame", „AI Draft", „dynamic-swot", „strategic".
- `agent-warsztat` — nazwy klocków („Business case", „Create task (approval)", „My Work").
- `finance-compare-panel` — etykiety wierszy jako klucze `SCREAMING_SNAKE`.
- `finance-export-import-panel` — natywne „Choose File / No file chosen".
- `finance-workspace-bar` — `PRESENT_NONZERO`, `MISSING`, `NOT_APPLICABLE`.
- `word-intake-uselm-default` — nagłówek sekcji „BRIEF".
- `gen-deck-content-hints` — „SuperAdmin", „Corporate", „Steering Committee Deck Template".
- `prezentacje-template-states` — „Deck", „pitch", „status update", „QBR", „roadmapa".
- `mywork-notebook-rail-speca` — „backlinks", „outputów", „Źródło: manual".
- `interview-preview-canon` — „Assignee:", „W3 Interview Owner Review".
- `document-studio-*` — „Document Studio" w okruszkach.
- `preview-4-zakladki`, `prawy-panel-szyna-ikon`, `teresa-chipy-sugestii` — przyrządy (D).

## 7. Osobno: ozdobniki

Właściciel nie znosi ozdobników. Realnie znalezione:

- **Nie znalazłem ani jednej gwiazdki dekoracyjnej ani emoji w produkcie.** Emoji
  z ikon kalendarza faktycznie zniknęły (`calendar-sync-settings` — sprawdzone wzrokiem).
- Amber-owa gwiazdka „ulubione" w `idea-table` — pełni funkcję (przełącznik), nie jest ozdobą.
- Ikony iskierek AI (`✧`) przy przyciskach AI — funkcjonalne, konsekwentne w całej aplikacji.
- Jedyna prawdziwa ozdoba: **crimsonowa plakietka „3"** na wspólnej szynie ikon
  (`prawy-panel-szyna-ikon`) — nie jest ozdobą, ale kolor jest nieuzasadniony.

## 8. Osobno: ciemny motyw

Sprawdzone oba motywy dla wszystkich 55 ekranów. Ciemny jest w **zdecydowanie
lepszym stanie, niż sugerowały wcześniejsze rundy** — jedno realne znalezisko:

- **`assessment-initiatives-table`** — pigułka „Planowanie" traci tło i zostaje
  gołym tekstem z kropką, podczas gdy „Szkic" w tym samym widoku tło zachowuje.
- `gen-deck-content-hints` — niezaznaczony checkbox ma wypełnienie w kolorze
  piaskowo-brązowym, spoza palety ciemnego motywu.
- `deck-artifact` — płótno slajdu zostaje białe na ciemnej powłoce. **To wygląda
  na świadome** (slajd = kartka), nie zgłaszam jako defektu, ale warto potwierdzić.
- `agent-plan-canvas` — nakładanie się kolumn występuje w obu motywach jednakowo.

Poza tym: kontrast tekstu, ramki pól, pigułki i tabele w ciemnym są poprawne
na wszystkich pozostałych 51 ekranach.

---

## 9. Uwaga o przyrządzie pomiarowym (dotyczy WSZYSTKICH dzisiejszych zrzutów)

`scripts/dev/grafika-zrzuty.mjs` deklaruje, że chowa chrom harnessu:

```js
await page.addStyleTag({ content: '[data-dev-render-chrome], .dev-render-chrome { display: none !important; }' });
```

**Żaden z tych selektorów nie istnieje w `dev-render/PanelUwag.tsx`.** Ta linia
jest martwa. W efekcie na **każdym** zrzucie z tego narzędzia — także na tych,
które właściciel oglądał dziś — siedzą dwie pływające czarne pastylki „← Lista"
i „Uwagi" w prawym dolnym rogu. Zasłaniają realną treść: nagłówek `POWIĄZANIA`
w `preview-4-zakladki`, rząd przycisków „Opublikuj / Dołącz do raportu"
w `finance-statement-pack-workspace-v2`, ostatni wiersz tabeli
w `results-vnext-okr-registry`.

Właściwy wyłącznik to `&uwagi=0` (`dev-render/main.tsx:1696-1699`), nie
`addStyleTag`. **Nie zmieniam kodu** (to przegląd, nie naprawa) — zgłaszam.

Przy okazji: błędy konsoli policzone przez narzędzie (8 na
`assessment-initiatives-table`, 1 na `assessment-five-surfaces`) są **błędami
harnessu, nie produktu** — sprawdzone: to `Failed to fetch transitions: … "<!doctype"`
i `[OrgContext] Error fetching orgs: … "<!doctype"`, czyli brak backendu w stanowisku
pomiarowym. Nie zgłaszać jako defektów produktu.
