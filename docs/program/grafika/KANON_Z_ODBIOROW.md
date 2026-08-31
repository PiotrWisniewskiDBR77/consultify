---
doc_id: grafika-kanon-z-odbiorow
status: canonical
truth_type: ui-standard-increment
established: 2026-08-30
---

# Kanon wywiedziony z odbiorów właściciela

**Po co ten plik.** Dokumentacja graficzna jest rozległa, ale niekompletna.
Za każdym razem, gdy właściciel **zatwierdza** ekran zawierający rozwiązanie,
którego standard nie opisuje — reguła ląduje tutaj. Dzięki temu przy kolejnych
modułach jest **coraz mniej pytań**, a każdy moduł ma większą autonomię.

**Format: jedna linia na regułę.** Data · reguła · ekran-źródło. Nie esej.
Reguła stąd ma **tę samą moc** co reguła z `docs/ui-standards/` — bo pochodzi
z bezpośredniego odbioru właściciela.

## Reguły

| Data | Reguła | Ekran-źródło |
| --- | --- | --- |
| 2026-08-30 | Status artefaktu to **pigułka z tekstem**, nigdy naga kropka — kropka zapada się do zera na wąskim ekranie | wzorzec `INS-2026-014` |
| 2026-08-30 | Znacznik zapisu („Zapisano 29.08, 14:07") stoi **osobno** od statusu cyklu życia i jest nieklikalny | wzorzec `INS-2026-014` |
| 2026-08-30 | Zakładki niosą **licznik postępu** (`3/6`, `2/4`), nie samą nazwę | wzorzec `INS-2026-014` |
| 2026-08-30 | Prawy panel ma **stałą kolejność**: Akcje · Właściwości · Powiązania · Źródła i założenia · Komentarze · Historia | wzorzec `INS-2026-014` |
| 2026-08-30 | Pewność wyniku nazywa się **wprost** („Niewystarczające · potrzebna walidacja"), nigdy nie jest ukrywana pod paskiem postępu | wzorzec `INS-2026-014` |
| 2026-08-30 | Teza modelu jest oznaczona jako **interpretacja, nie fakt**, i mówi, czego brakuje do rozstrzygnięcia | wzorzec `INS-2026-014` |
| 2026-08-30 | Braki są **wymienione z nazwy** — zakaz zbiorczego „brak danych" | wzorzec `INS-2026-014` |
| 2026-08-30 | Tam, gdzie widok jest ograniczony, ekran mówi wprost: **„liczba 0 nie oznacza braku działań"** | wzorzec `INS-2026-014` |
| 2026-08-30 | Uprawnienia pokazujemy jako **Możesz / Nie możesz** z zamkami, a nie przez ukrywanie kontrolek | wzorzec `INS-2026-014` |
| 2026-08-30 | Ograniczenie widoku podpisujemy jako **ograniczenie widoku**, nie jako stan danych | wzorzec `INS-2026-014` |
| 2026-08-30 | ★ **Nagie zero jest zakazane.** Licznik `0` wynikający z trybu widoku musi stać obok zdania, które mówi, że **liczba opisuje widok, nie obiekt**. Sekcja z takim zdaniem jest **rozwinięta** — zwinięta chowałaby dokładnie to, co miało przestać wprowadzać w błąd | karta Inicjatywy, sekcja „Akcje" w Podglądzie |
| 2026-08-30 | ★ **Ta reguła ZASTĘPUJE zakaz z 2026-07-24** („w Podglądzie sekcja zwinięta z licznikiem 0, bez komunikatu opisowego"). Zakaz dotyczył komunikatu o **trybie** po angielsku („Actions are hidden in preview mode"); nowa reguła wymaga komunikatu o **znaczeniu liczby**, po polsku | rozstrzygnięcie właściciela 2026-08-30 |

2026-08-30 | ★ **Ozdoba, która porusza się w czasie, kłamie na nieruchomym zrzucie.**
Krążąca crimsonowa smuga wokół pola pisania Teresy (`CHAT-OWN-012`) wygląda na
zrzucie jak rysa albo błąd renderowania — dwóch niezależnych robotników zgłosiło ją
jako defekt i żaden nie znalazł źródła, bo element **zmienia położenie między
zrzutami** i jest pseudo-elementem CSS, nie klasą w komponencie.
**Reguła:** zanim zgłosisz „linię nieznanego pochodzenia", zrób drugi zrzut z innym
czasem osiadania. Jeśli obiekt się przesunął — to animacja, nie defekt układu, i
szukaj go w `index.css`, nie w drzewie strony.

2026-08-30 | ★ **Ekran za flagą trzeba mierzyć Z flagą, inaczej mierzysz inny ekran.**
Robotnik ocenił „Tożsamość i model działania" bez `ff_org_redesign_v1=1` i zobaczył
**starą powierzchnię** — nie tę, która była przedmiotem oceny. Narzędzie zrzutów nie
miało sposobu przekazania parametru adresu, więc po cichu mierzyło niewłaściwą rzecz.
**Naprawione u źródła:** `grafika-zrzuty.mjs --parametry=ff_...=1`.
**Reguła:** zanim ocenisz ekran, sprawdź, czy ma wariant za flagą. Jeśli ma — zrób
zrzuty OBU i powiedz w raporcie, który z nich widzi dziś użytkownik.

2026-08-30 | ★ **Do harnessu prowadzą DWIE drogi, nie jedna.**
Wspólna to `?screen=X` (rejestr w `dev-render/main.tsx`). Ale **osiemnaście** ekranów
ma własny plik `dev-render/X.html` z osobnym punktem wejścia i przez `?screen=`
w ogóle ich nie widać — narzędzie odpowiada listą awaryjną, co wygląda **dokładnie
tak samo** jak „ekran się nie renderuje". Dwa ekrany SIRI dostały przez to
**fałszywą ocenę D**, a sześć ekranów Narzędzi opisałem jako „nigdy niepodłączone",
choć były osiągalne — innymi drzwiami.
**Naprawione u źródła:** `grafika-zrzuty.mjs --wejscie=html`.
**Reguła:** zanim napiszesz „ekran nie istnieje", sprawdź `ls dev-render/*.html`.

2026-08-30 | ★ **Dwa różne „AI" na jednym ekranie — nie mylić ich nigdy.**
Słowa właściciela z odbioru karty decyzji, dosłownie: *„mamy w górnym pasku przycisk
»AI«, a później w pasku dalszego arkusza mamy »Analizuj z AI«. Pamiętaj, że to są dwie
różne funkcjonalności. Górny pasek AI dotyczy wypełnienia całego narzędzia, a dolny
pasek dotyczy danej karty."*
**Górny pasek = całe narzędzie. Pasek arkusza = ta jedna karta.** Nie scalać ich,
nie ujednolicać etykiet i nie „porządkować" jednego przez usunięcie drugiego.

2026-08-30 | ★ **Liczniki podsumowania czyta się z góry na dół, nie w poprzek.**
Słowa właściciela z odbioru karty wniosku: *„W oknie centralnym mamy trzy kolumny (…).
Zróbmy to w trzech dużych wierszach z trzema kolorami, aby było czytelne od góry do
dołu."* Zrobione w `InsightViewer`. Przy okazji wyszło, że kolory były realnie **dwa,
nie trzy** — pierwszy kafel był szary. Dostał niebieski `c-info` (nie crimson: to nie
jest stan krytyczny).

2026-08-30 | ★ **Wyniki mają TRZY poziomy, nie dwa** (decyzja właściciela — pełny
zapis: `DECYZJA_WYNIKI_TRZY_POZIOMY.md`). Rejestr zestawień okresowych → tabela
zestawu (tu dodajesz wskaźniki, tu jest podsumowanie) → karta wskaźnika.
**Wskaźnik ma JEDNĄ tożsamość na wszystkie okresy** — sierpień i wrzesień to ten
sam wskaźnik, nie dwa. **Osoba przy OKR to kolumna, nie poziom.** **Analizy ROI
zostają na dwóch poziomach** — bo ROI robi się raz, a wskaźnik rozlicza cyklicznie.

2026-08-30 | ★ **Czerwona smuga wokół pola pisania Teresy ZOSTAJE czerwona — decyzja
właściciela.** `CHAT-OWN-012`, `src/index.css` (`.chat-composer-idle-pulse::before`,
`rgb(133 24 47 / 0.55)`). To jest **świadomy, zatwierdzony wyjątek** od zasady
„crimson tylko dla semantyki krytycznej". **Nie naprawiać.** Jeśli ktoś zgłosi to
jako defekt koloru — odesłać tutaj.

2026-08-30 | ★ **Ocena i Audyt to DWA OSOBNE MODUŁY — i nigdy nie był to spór
merytoryczny.** Słowa właściciela: *„Ocena to jest assessment, mamy cały moduł
assessment, a audyt to cały moduł Audyt. Pomieszaliśmy, bo w jednym miejscu
pokazywałeś mi ekrany z tych dwóch narzędzi."*
**Przyczyną był mój arkusz odbioru**, ułożony według torów roboczych zamiast według
modułów menu. Po przebudowie na 16 modułów problem znika sam. **Żadna zmiana
w produkcie nie jest potrzebna** — to była wada sposobu pokazywania, nie produktu.

---

## 2026-08-30 (wieczór) — reguły wywiedzione z rundy 20 ekranów

**Sekcja mieszka w jednym miejscu w całej aplikacji** — ekran `deck-artifact`.
Komentarze i Źródła przeniesione z lewej szyny prezentacji do prawego panelu,
mimo że właściciel pochwalił poprzedni układ. Jego decyzja: *„zostawić — jedno
miejsce na sekcję"*. Uzasadnienie właściciela przyjęte: prezentacja nie może być
jedynym artefaktem, w którym komentarzy szuka się gdzie indziej niż w notatniku
czy karcie. **Spójność między artefaktami wygrywa z lokalnym optimum pojedynczego
ekranu — także wtedy, gdy ten ekran był już zaakceptowany.**

**Macierz oceny to siedem osi** — decyzja z tego samego dnia. Skale poziomów
7/5/5/7/6/6/5 biorą się z metodyki właściciela, nie z kodu; źródło prawdy
`src/services/drdStructure.ts`. Zapis w `DRD_KSIAZKA_KONTRA_KOD.md`.

**Komórka macierzy wypełnia się do wysokości osiągniętego poziomu (schodki),
nie punktowo** — decyzja właściciela: *„poziom 4 znaczy, że niższe też są
osiągnięte"*. Poziomy w metodyce DRD są kumulatywne. **Uwaga: kierunek macierzy
został potem wstrzymany** — wzorcem jest ekran, który właściciel wskazał
w SIRI/DRD, a nie prezentacja raportowa. Patrz `DZIENNIK_GRAFIKA.md` Z-10 i Z-12.

**Partner AI zna wyłącznie poziomy z metodyki** — decyzja: usunąć opisy poziomów
6 i 7 dla osi pięciopoziomowych. Powód nie jest kosmetyczny: AI mogło zasugerować
konsultantowi u klienta poziom dojrzałości, który w metodyce nie istnieje.
**Treść nieautorska w warstwie merytorycznej jest defektem, nie brakiem polerki.**

**Ekranu nie zdejmuje się z drogi bez zbadania, co za nim stoi** — z czterech
generatorów szablonów, które właściciel kazał zdjąć, **trzy okazały się jedynym
żywym wejściem** do działającej mechaniki. Zdjęty został wyłącznie duplikat.
Reguła: polecenie „zdejmij" wykonuje się **po** dowodzie, że nie ma za tym drogi.

**Ekran wchodzi do odbioru z brakami wypisanymi PRZED spojrzeniem właściciela.**
Stosowane tego dnia przy macierzy (treść komórek kłamie), planie inicjatyw
(wiersz otwiera tabelę zamiast karty), doradcy mocy (brak przycisku raportu)
i prezentacji (zapis nieudowodniony bez backendu). **Ocena B z nazwanym wyjątkiem
jest uczciwa; ocena A z przemilczanym brakiem nie jest.**

**Opisy poziomów metodyki mogą iść do raportu dla klienta** — zgoda właściciela
metodyki (DBR77 / dr Piotr Wiśniewski) potwierdzona wprost 2026-08-30 wieczorem,
na pytanie zadane dosłownie o dokument wychodzący na zewnątrz.
**Objęte:** nazwa i opis osi, nazwa obszaru, tytuł i opis poziomu.
**Nieobjęte i niedomniemywane:** warstwa coachingowa QBank v2 (definicje kanoniczne,
przykłady, przykłady technologii, pułapki oceniania) — na nią zgody NIE udzielono.
Zapis w nagłówku `src/components/assessment/report/drdLabels.ts`.

---

## ★★ 2026-08-31 — DWIE DECYZJE WŁAŚCICIELA, KTÓRE UNIEWAŻNIAJĄ CZĘŚĆ WCZORAJSZYCH ZGŁOSZEŃ

Właściciel, dosłownie:
> „W 100% DRD jest moją licencją, możesz korzystać z niej dowolnie.
> A wiodącym językiem i tak jest język angielski."

### 1. Licencja DRD — bez ograniczeń

Wczorajsza zgoda dotyczyła **wyłącznie opisów poziomów w raporcie dla klienta**, z jawnie
wyłączoną warstwą coachingową QBank v2. **Ta decyzja ją poszerza: metodyka DRD jest w całości
własnością właściciela i wolno z niej korzystać bez ograniczeń** — także z definicji kanonicznych,
przykładów, przykładów technologii i pułapek oceniania.

**Nota licencyjna `usageRestriction: 'internal_only'` w `compileDrdPack.ts` jest wobec właściciela
bezprzedmiotowa.** Ograniczenie dotyczyło ochrony jego materiału przed wyciekiem — nie jego
własnego produktu.

### 2. ★ Wiodącym językiem metodyki jest ANGIELSKI — to NIE jest defekt

**To unieważnia serię zgłoszeń z 30.08.** Wczoraj wielokrotnie raportowano jako defekt:
- „43 angielskie etykiety poziomów w raporcie z oceny",
- „176 opisów poziomów i 7 opisów osi po angielsku",
- „macierz pokazuje AI Support / ERP / MES zamiast polskich nazw",
- „połowa metodyki jest po angielsku — praca redakcyjna właściciela".

**Żadne z tych nie jest defektem.** Książka „Digital Pathfinder" jest napisana po angielsku,
kod wiernie ją przepisał, a właściciel potwierdza, że **angielski jest językiem wiodącym metodyki**.
Osie 5 i 6, które mają polskie brzmienia, są wyjątkiem wpisanym ręcznie — nie wzorcem.

### ★ GRANICA, KTÓRĄ TRZEBA TRZYMAĆ

| warstwa | język | przykład |
| --- | --- | --- |
| **Metodyka DRD** — nazwy osi, obszarów, poziomów, opisy poziomów, technologie | **angielski, wiodący** | `Automation`, `MES`, `Basic Data Registration`, `AI-Native Business Offerings` |
| **Interfejs produktu** — przyciski, nagłówki ekranów, komunikaty, etykiety kolumn, statusy | **polski** | „Nowy raport", „Zatwierdzony", „Szukaj raportów…", „Wymagane" |

**Zgłoszenie „angielski tekst na ekranie" jest zasadne tylko wtedy, gdy dotyczy INTERFEJSU.**
Angielski w treści metodyki należy zostawić i **nie zgłaszać go jako defektu**.

Wątpliwy przypadek rozstrzygamy pytaniem: *czy to zdanie napisał właściciel jako autor metodyki,
czy programista jako etykietę kontrolki?* Pierwsze zostaje po angielsku, drugie idzie na polski.

### Co z tego wynika praktycznie

- **Obszar 7E** (`DRD_OS7E_PROPOZYCJA.md`) — propozycja pięciu poziomów napisana wczoraj **może
  wejść do produktu**; wersja angielska jest wersją wiodącą, polska pomocniczą.
- **Raport z oceny** przestaje wymagać pracy redakcyjnej właściciela nad 176 opisami —
  to była największa pozycja na liście blokerów i **znika**.
- **Macierz DRD** — angielskie nazwy poziomów w komórkach nie są powodem do naprawy.
  Nadal otwarte zostaje to, co realnie kłamie: **treść komórek** (23 z 63 fałszywych na osi 1,
  filtr szesnastu skrótów) i **zmyślone etykiety wierszy** — patrz `MACIERZ_TRESC_KOMOREK.md`.

## ★★ 2026-08-31 — LICENCJA SIRI: ograniczenie jest OPERACYJNE, nie treściowe

Właściciel, dosłownie:
> „Pozwala nam wykorzystywać materiały graficzne. Generalnie licencja wymaga tylko zgłoszenia
> dokonania audytu i opłatę przez nas, zanim przekażemy finalny raport. Metodyka jest tak
> powszechna jak DRD."

### Co to znaczy dla kodu

**SIRI nie jest własnością właściciela** (w odróżnieniu od DRD) — Consultify ma licencję
na autoryzację, zdane egzaminy asesorskie i umowę. **Ale ograniczenie nie dotyczy treści:**

| | wolno | nie wolno / wymaga działania |
| --- | --- | --- |
| treść metodyki, macierz oceny, pasma dojrzałości | **TAK** — powszechna jak DRD | — |
| materiały graficzne SIRI | **TAK** | — |
| **wydanie finalnego raportu klientowi** | dopiero **po** zgłoszeniu audytu licencjodawcy **i opłacie** | wydanie raportu bez zgłoszenia i opłaty |

**Znacznik `EVIDENCE_MISSING` w `src/method-core/methods/siri/compileSiriPack.ts:88`
przestaje obowiązywać** — mówi „Requires owner-approved licensing review before transcription".
Ta zgoda została udzielona. Transkrypcja treści SIRI jest dozwolona.

### ★ WYMÓG, KTÓRY MUSI STAĆ SIĘ FUNKCJĄ PRODUKTU — nie notatką w dokumentacji

„Zgłoszenie audytu i opłata **przed** przekazaniem finalnego raportu" to **warunek licencyjny
wpięty w przepływ pracy konsultanta**, nie formalność administracyjna. Produkt, który pozwala
wyeksportować finalny raport SIRI bez odnotowania zgłoszenia i opłaty, **naraża właściciela
na naruszenie umowy z licencjodawcą.**

Wymagania do zaprojektowania (tor funkcji, nie grafiki):
1. Sesja SIRI ma **stan zgłoszenia** do licencjodawcy (niezgłoszona · zgłoszona · opłacona).
2. **Bramka przed wydaniem finalnego raportu** — eksport/przekazanie klientowi możliwe dopiero
   po odnotowaniu obu kroków. Raport roboczy: bez ograniczeń.
3. Bramka mówi **językiem uczciwości**, dlaczego blokuje: to warunek licencji, nie usterka.
4. Ślad w historii sesji: kto, kiedy, jaka kwota — to dowód wobec licencjodawcy.

**Różnica wobec DRD jest jedna i istotna:** DRD wolno wydać klientowi kiedykolwiek, SIRI dopiero
po dopełnieniu obowiązku. To jedyne miejsce, w którym te dwie metodyki wymagają innego produktu.
