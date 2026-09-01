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

### ★★★ SPROSTOWANIE I DOPRECYZOWANIE — 2026-08-31, słowa właściciela

> „Musimy mieć zbudowany inny system — system, w którym informujemy, że to jest licencjonowane
> i na jakimś etapie pracy nie można zapisać efektów pracy po prostu. Aby móc zapisać efekty
> pracy, trzeba mieć tę formułę opłaconą **dla nas**. Gdy będzie opłacona, będzie podpięta karta;
> wówczas automatycznie się generujemy. My będziemy się oczywiście rozliczać. Jeśli nie, powstanie
> dług, ale **nie powinno to już zatrzymywać pracy klienta**."

**Mój poprzedni zapis był błędny co do kierunku bramki.** Napisałem, że blokadą jest zgłoszenie
audytu licencjodawcy i opłata przez Consultify. **Nie tak.** Są to dwie NIEZALEŻNE relacje:

| relacja | kto komu płaci | czy blokuje |
| --- | --- | --- |
| **klient → Consultify** | klient opłaca formułę licencjonowaną | **TAK — to jest bramka zapisu** |
| **Consultify → licencjodawca** | rozliczenie okresowe | **NIE — nieopłacone tworzy DŁUG po naszej stronie, praca klienta idzie dalej** |

### Jak ma działać system

1. **Informujemy, że metoda jest licencjonowana** — jawnie, zanim klient zacznie, nie po fakcie.
2. **Praca jest wolna** — ocenianie, klikanie macierzy, robocze wyniki: bez ograniczeń.
3. **Bramka stoi na ZAPISIE EFEKTÓW** — na pewnym etapie nie da się zapisać rezultatu pracy,
   dopóki formuła nie jest opłacona **na rzecz Consultify**.
4. **Opłata = podpięta karta.** Po opłaceniu **generowanie odbywa się automatycznie** — bez
   ręcznego odblokowywania, bez czekania na kogokolwiek.
5. **Nasze rozliczenie z licencjodawcą jest osobne i NIGDY nie dotyka klienta.** Brak rozliczenia
   z naszej strony tworzy **dług po stronie Consultify** — do windykacji między nami a licencjodawcą,
   nie do zatrzymywania pracy klienta.

### Dlaczego kierunek jest krytyczny

Odwrotna implementacja — blokowanie klienta, bo **my** nie rozliczyliśmy się z licencjodawcą —
byłaby **karaniem klienta za cudzy dług**. Klient, który zapłacił, ma dostać swój rezultat
niezależnie od stanu naszych rozliczeń.

### Zakres — to nie jest funkcja jednej metody

System dotyczy **każdej metody licencjonowanej**, nie tylko SIRI. DRD jest własnością właściciela
i bramce **nie podlega**. Mechanizm ma być wspólny: metoda deklaruje, czy jest licencjonowana
i jaka jest jej formuła płatności; reszta dzieje się tak samo.

**To jest zadanie dla toru funkcji i modelu rozliczeń — nie dla toru grafiki.** Tor grafiki
odpowiada wyłącznie za to, żeby komunikat o licencji i o bramce zapisu był **uczciwy i zrozumiały**:
mówił wprost, dlaczego zapis jest wstrzymany, czego brakuje i co odblokuje wynik.

---

### 2026-08-31 — Zakres pełnej rundy odbioru i wyjątek dla AI OS

- **Decyzja właściciela 2026-08-31:** pełna runda odbioru obejmuje **WSZYSTKO** — 16 modułów +
  narzędzia + kreatory + panel Administracji (7 domen) + Internal Tools/AI OS. Nic nie zostaje
  poza rejestrem z powodu „to wewnętrzne" albo „to nie jest moduł menu".
- **AI OS / Internal Tools to konsola wewnętrzna** (dostęp tylko `dbr77.com`) — kanon list
  `StandardTable` jej **nie obowiązuje** w tej rundzie odbioru. Obowiązuje za to zakaz
  dekoracyjnego crimson (Pułapka nr 1 dotyczy jej tak samo jak reszty produktu) i docelowo
  polski interfejs (dziś część ekranów jest po angielsku — nazwane jako wyjątki, nie
  zaakceptowane jako stan końcowy). Źródło: rejestracja modułu `17-aios`.

---

## 2026-08-31 — decyzja właściciela: dane demo NorthStar zostają po angielsku

Na pytanie nadzorcy (rekomendacja: przetłumaczyć), właściciel odpowiedział: **„NorthStar — zostaje."**

Dataset demo modułu Wywiad (`src/components/Interview/interviewDemoData.ts`, ~3600 linii, wnioski „NorthStar Digital Readiness`) **pozostaje po angielsku**. Rozszerza to granicę językową z 31.08: obok metodyki także **treść danych demonstracyjnych** nie podlega tłumaczeniu. Zgłoszenie „treść wniosku/sesji demo po angielsku" NIE jest defektem — defektem pozostaje wyłącznie angielski INTERFEJS (przyciski, etykiety, komunikaty). Ekrany `insight-artifact` i pokrewne oceniamy z tym wyjątkiem nazwanym, nie obniżamy im oceny za język treści demo.

---

## 2026-09-01 — macierz DRD w raporcie z oceny ZAAKCEPTOWANA

Właściciel na pytanie o slajd macierzy: **„tak to jest super"**.

**Co zostało przyjęte:** macierz z edytora oceny (`DRDMatrixGrid` wyeksportowany z `DRDAssessmentEditor.tsx`, opakowany w `DRDMatrixReadOnly.tsx`) jako jedyne źródło macierzy w prezentacji raportu i w rozdziałach osi dokumentu. Poprzedni komponent (`AreaMatrixTable`) — odrzucony przez właściciela 30.08 — został z tej ścieżki usunięty.

**★ Powtarzalna treść w wierszu poziomu NIE JEST defektem.** Zapytany wprost, czy `ERP` we wszystkich dziewięciu obszarach na poziomie 6 i `MES` w sześciu z dziewięciu na poziomie 5 to błąd filtra skrótów, właściciel potwierdził, że tak ma być. To systemy obejmujące całą firmę, więc powtarzają się w obszarach — w odróżnieniu od poziomów niższych i wyższych, gdzie treści są zróżnicowane (`CMMS`, `WMS`, `Machine Vision`, `RPA`, `NLP`). **Nie zgłaszać tego jako defektu i nie „naprawiać".**

**Utrzymane cechy macierzy:** wiersze = poziomy (najwyższy u góry), kolumny = obszary, dolny pasek `AREA` z chipami `AS`/`TO`, wypełnienie kumulatywne (schodkowe — poziom 4 oznacza wypełnione 1–4), liczba poziomów per oś z metodyki (7/5/5/7/6/6/5), nieujednolicona. Angielskie nazwy poziomów i technologii zostają (metodyka).

---

## 2026-09-01 — ★ „JEDNA TERESA, W SWOIM OKNIE" — czat znika z paneli narzędzi

Właściciel, dosłownie, przy odbiorze wariantów `-idea-teresa` i `-notatka-teresa` prawego pasa
(dwa oddzielne odrzucenia tego samego dnia):

> „tutaj zobacz jest okno teresy w panelu tego okna ale przecież teresa ma okno swoje"

> „nie wiem dlaczego teresa jest w oknie narzędzia skoro jest osobna teresa"

**Reguła:** czat Teresy mieszka **wyłącznie w swoim głównym oknie** — jedno miejsce rozmowy
w całej aplikacji. Panel artefaktu (prawy pas dowolnego narzędzia/ekranu-obiektu) **nie może
osadzać czatu**. Wolno mu dać wyłącznie **wejście** — jeden przycisk w sekcji „Akcje"
(„Zapytaj Teresę o ten/tę/to <obiekt>"), który otwiera GŁÓWNE okno Teresy z kontekstem tego
obiektu. Zero pola pisania, zero strumienia wiadomości, zero trybu „Teresa" na szynie prawego
pasa — jeśli szyna ma ikonę, ta ikona przenosi do głównego okna, nie renderuje drugiego czatu.

**To jest zasada dla WSZYSTKICH przyszłych artefaktów, nie poprawka dwóch ekranów** (notatka,
idea). Każdy kolejny archetyp (Rekord/Dokument/Canvas/Matryca/Deck) i każde narzędzie z własnym
prawym panelem podlegają tej regule tak samo.

**Wzorzec (prototyp, zaakceptowany na czystym zrzucie — dowód `evidence/grafika/167-jedna-teresa/`):**
`dev-render/screens/prawy-pas-jedna-formula.tsx`, commit `125e3ff82c` — usunięty tryb pasa
„Teresa" (`TeresaRailPanel`, zostaje w pliku jako martwy eksport, bez konsumenta), usunięta
ikona „Teresa" z szyny 56px, dodany `TeresaEntryButton` w sekcji Akcje panelu artefaktu.
Zweryfikowane zrzutami: warianty `-notatka-teresa`/`-idea-teresa` renderują dziś **bajt-identycznie**
to samo co `-notatka-artefakt`/`-idea-artefakt` — dowód, że drugi czat faktycznie zniknął, nie
tylko ze zmienionej etykiety.

### ★ Ta decyzja ZASTĘPUJE decyzję z 2026-08-30 („Teresa jako ikona na szynie")

**Uwaga o lokalizacji:** wpis z 30.08 („Teresa staje się jedną z ikon na stałej szynie prawego
pasa — tak jak jest już w Wordzie. Rozciągamy wzorzec z Worda na całą strukturę") **nie jest
zapisany w tym pliku** — nie ma go w kanonie z odbiorów. Żyje w nagłówkach kodu:
`src/utils/artifactRightRailFlag.ts` i `src/components/standard/ArtifactRightRail.tsx`
(mechanizm „tryb Teresa" szyny, flaga `ff_artifact_right_rail`, domyślnie OFF). Oba pliki
zostały opatrzone adnotacją „ZASTĄPIONE 2026-09-01" przy tym cytacie — nowa decyzja wygrywa,
stara zostaje widoczna, nie skasowana.

### Zasięg do posprzątania (dyżur 167, NIE wykonane w tym kroku — do zaplanowania osobną falą)

Sweep `UnifiedChatPanel`/`AIChat*`/`Teresa` w `src/components/**` znalazł **co najmniej pięć**
miejsc, gdzie czat Teresy (`UnifiedChatPanel`) jest dziś osadzony wewnątrz prawego panelu
narzędzia — nie tylko dwa ekrany dev-render:
1. `src/components/standard/ArtifactRightRail.tsx` + `IdeaRightPanel.tsx` — tryb „Teresa" szyny
   (Idee), za flagą `ff_artifact_right_rail` (OFF domyślnie).
2. `src/components/MyWork/notebook/NotebookRightRail.tsx` — to samo dla Notatnika, ta sama flaga.
3. `src/components/Initiatives/InitiativeDocumentView.tsx` — legacy „Slot 9 AI Consultant"
   (`AIConsultantPanel` → `UnifiedChatPanel`), **żywe, BEZ flagi**, toolbar-toggle.
4. `src/components/Presentations/DeckBuilder/DeckBuilder.tsx` — aside/`aiEntrySlot` „Teresa"
   (`UnifiedChatPanel`), **żywy, BEZ flagi**, domyślnie otwarty gdy tor `artifactStudio` OFF.
5. `src/components/DocumentStudio/DocumentStudioAiEntryPanel.tsx` — kolumna „Teresa z boku"
   przy tworzeniu dokumentu, za flagą `ff_zai_teresa` (OFF domyślnie).

`src/components/Interview/InsightViewer.tsx` już to zrobił poprawnie wcześniej (#56/D17) —
własny `AIConsultantPanel` przestał się renderować, zastąpiony wejściem do jednego dokowanego
okna Teresy. To wzorzec do skopiowania na pozostałe pięć.
