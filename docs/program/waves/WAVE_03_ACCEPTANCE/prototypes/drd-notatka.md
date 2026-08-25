# Narzędzie DRD — prototyp trzech trybów do akceptu

**Dla:** Piotr · **Data:** 25.08.2026 · **Decyzje źródłowe:** DEC-02, DEC-37, DEC-38, DEC-39 · `ASM-THREE-AC-008`

Pliki: `drd-prototyp-interview.html` · `drd-prototyp-matrix.html` · `drd-prototyp-report.html`
Zrzuty: `drd-{interview,matrix,report}-{light,dark}.png` — po jednym w każdym motywie, obejrzane i poprawione przed oddaniem.

**To makieta. Kodu jeszcze nie ma i nie będzie przed Twoim akceptem** (reguła 7 — nie jesteś pierwszym testerem wizualnym).
Każdy plik otwiera się dwuklikiem, jest samodzielny (zero zależności), sam przełącza się na motyw jasny/ciemny systemu.

---

## 1. Co dostajesz i po co

Trzy ekrany jednego narzędzia, w kolejności pracy konsultanta:

| Plik | Ekran | Odpowiada na pytanie |
|---|---|---|
| `…-interview.html` | zbieranie stanu faktycznego | „Jak wygląda rozmowa z klientem, obszar po obszarze?" |
| `…-matrix.html` | mapa dojrzałości + warsztat celów (**+ otwarty Settings jako drugi kadr**) | „Co z tego wyszło i dokąd idziemy?" |
| `…-report.html` | siedem rozdziałów raportu | „Co klient dostaje na papierze?" |

Pod każdym ekranem jest **pasmo sekcji decyzyjnych** — co ekran rozstrzyga, co bierzemy z dawcy,
co świadomie wycinamy i co zostaje do Twojej decyzji.

**Treść jest realistyczna, nie „lorem ipsum".** Firma Metalpol Sp. z o.o. — producent komponentów metalowych,
diagnoza w toku: 6 z 9 obszarów osi 1 ocenionych, trzy obszary uczciwie nieocenione, jeden obszar z dziurą
w poziomach. Pytania, kryteria i przykłady dowodów są **dosłownie z QBanka DRD 2.0.0** (oś 1, obszar 1E).

---

## 2. Interview — nawigator dwustopniowy i karta poziomu

**Nawigacja.** Wąski pierwszy panel: 7 osi, zwiniętych, z prawdziwym postępem („6/9 obszarów ocenionych").
Drugi panel: **tylko** obszary wybranej osi. Wybór osi zmienia panel 2, wybór obszaru zmienia centrum.
Żadnej ściany pytań, żadnego pływającego menu skoków (to wraca dopiero, jeśli testy pokażą, że nawigator
jest za trudny), **żadnej stałej belki Teresy**.

**Karta poziomu** — jednostką osądu jest `obszar × poziom`, nie pojedyncze pytanie.
Sześć kart zwiniętych (numer, nazwa, jednozdaniowe kryterium, badge werdyktu, osobny badge stanu dowodu),
**jedna rozwinięta inline** na pełną szerokość. Rozwinięcie ma dziewięć bloków w stałej kolejności:
kryterium → pytania kanoniczne **po kolei** → oczekiwany dowód → notatka z odpowiedzi → dowody
(plik / link / referencja, każdy ze źródłem, właścicielem i datą) → technologie *(pomoc, nie kryterium)* →
trzy wymiary stanu → uzasadnienie → zapis.

**Przycisk to `Sprawdź kryteria`** (dla nietkniętego poziomu), `Kontynuuj ocenę`, `Edytuj ocenę`.
Nie ma „Tell me more" ani „Go deeper".

### Trzy wymiary stanu zamiast jednej listy

To jedyne miejsce, gdzie prototyp jest bogatszy od dawcy — i jest to celowe:

* **Werdykt merytoryczny** — co ustaliliśmy o firmie: *Nieoceniony · Osiągnięty · Częściowo · Nieosiągnięty · Nie dotyczy*
* **Wiedza respondenta** — czy rozmówca umiał odpowiedzieć: *Wiem / Nie wiem*
* **Stan dowodu** — ile to jest warte: *Brak · Zadeklarowany · Zweryfikowany · Sprzeczny · Odrzucony*

Gdyby to była jedna sześciopozycyjna lista, „nie wiem" wypychałoby werdykt, a „brak dowodu" udawałoby ocenę.
Przy rozdzieleniu raport potrafi napisać *„poziom 3 częściowo, dowód sprzeczny, rozmówca kompetentny"* —
i dokładnie z tego powstaje punkt „Ocena i wiarygodność" w komentarzu obszaru.

`Pomiń` jest **czwartą, osobną** rzeczą — decyzją workflow z kodem powodu, nigdy nie czytaną jako
„nie dotyczy", „nieosiągnięty" ani „brak danych".

---

## 3. Twoje trzy świeże decyzje — gdzie je widać

### DEC-37 — cel widoczny w Interview, edytowalny tylko w Matrix

Na karcie obszaru, po prawej stronie, jest ramka: **„Cel: poziom 6 — ERP"**, dystans (4 poziomy od poziomu
obecnego), które poziomy zostają do domknięcia, kto i kiedy ten cel ustalił. Ramka ma jeden link:
*„Cel zmieniasz w trybie Matrix › Ustaw TO-BE"*. **W całym Interview nie ma żadnej kontrolki zmieniającej cel.**

To likwiduje realny błąd dawcy: tam przyciski `Achieved`, `Target` i `Skip` wykluczały się wzajemnie, więc
kliknięcie „Target" na poziomie już osiągniętym **kasowało ocenę stanu faktycznego**. Rozdzielenie trybów
usuwa całą tę klasę pomyłek, a nie pojedynczy przypadek.

### DEC-38 — poziomy niezależne, zero kumulacji

Pasek nad kartami pokazuje siedem osobnych segmentów, każdy z własnym kształtem i podpisem:
`1 osiągnięty · 2 osiągnięty · 3 częściowo · 4 pominięty · 5 osiągnięty · 6 nieoceniony·CEL · 7 nieoceniony`.
Pod nim, wprost: *„Każdy poziom niezależnie — brak kumulacji. Osiągnięcie 5 nie zalicza 3 ani 4."*

W dawcy było odwrotnie — warunek `achievedLevel >= poziom` zaliczał wszystko poniżej.
Uzasadnienie metodyczne jest mocne: QBank opisuje na niższych poziomach stany **jakościowo różne**
(w osi 5 wręcz negatywne), więc naiwna kumulacja potrafi być po prostu fałszywa.

**„Poziom obecny" jest jawną decyzją konsultanta**, nie maksimum. W Matrixie: system proponuje 2
(najwyższy ciągły), najwyższy osiągnięty to 5 — pokazany jako opcja przerywana, nie jako domyślna.
Wybór wymaga uzasadnienia i zapisuje się z autorem, czasem i rewizją. Tylko ta wartość wchodzi do raportu.

### DEC-39 — realistyczna firma z dziurami

Kolumna 1E w macierzy pokazuje dokładnie wzorzec, o który prosiłeś: **poziomy 1, 2 i 5 osiągnięte,
3 częściowy, 4 pominięty**. Nagłówek kolumny nosi znacznik `luka 3–4`. Trzy kolumny osi 1 mają taki znacznik.
Trzy obszary (1C, 1H, 1I) nie były badane i w całym prototypie są opisane jako **nieocenione, nie jako zero**.

---

## 4. Matrix — mapa dojrzałości i warsztat transformacji

Macierz 7 poziomów × 9 obszarów na pełnej szerokości sceny, poziomy od 7 na górze do 1 na dole.
Pod nią trzy wiersze podsumowań: **Poziom obecny (AS-IS) · Cel (TO-BE) · Luka i kroki w zakresie**.

**Sześć stanów komórki rozróżnialnych bez koloru** — wypełnienie, kreskowanie, obrys ciągły, obrys przerywany,
obrys kropkowany, obwódka. Każdy ma też glif (`✓ ½ ✕ – ◎`) i słowo. Czyta się to na wydruku czarno-białym
i przy daltonizmie. **Crimson (#85182F) nie występuje ani razu** — czerwień tylko przy „dowód sprzeczny".
Kolor dojrzałości to jeden odcień w siedmiu jasnościach i jest **ten sam** w karcie poziomu i w macierzy.

**Szczegóły komórki** (opis · przykład · technologie) otwierają się pod macierzą z **dwiema osobnymi akcjami**:
`Ustaw AS-IS` i `Ustaw TO-BE`. Nigdy nie kasują się nawzajem. Komentarze są zakotwiczone w konkretnej komórce,
a propozycja AI jest **szkicem** z pełnym uzasadnieniem i przyciskami Przyjmij / Edytuj / Odrzuć — nic nie
zmienia się samo.

**Zakres transformacji zapisujemy wprost:** „poziom 3 w zakresie · poziom 4 poza (pominięty) · poziom 5 już
osiągnięty · poziom 6 cel — **2 kroki**". Nie jako różnicę arytmetyczną „6 − 2 = 4".

### Settings — drugi kadr w tym samym pliku

Pięć kart, zawsze zaczynając od **„Informacje o dokumencie"**. Każda pozycja przetłumaczona na język produktu
i opatrzona jednym zdaniem wyjaśnienia: nie „Source of truth: SERVER", tylko *„Skąd pochodzą dane:
serwer Consultify (jedno źródło prawdy)"*. Surowe etykiety inżynierskie znikają z kanwy roboczej i nie
wracają nawet tutaj. Settings **nie jest czwartym trybem** — to osobna akcja, wizualnie oddzielona od
przełącznika Interview · Matrix · Report.

---

## 5. Report — siedem rozdziałów z limitami

Lewa kolumna: **7 osi → 7 rozdziałów**, każdy ze stanem (`szkic gotowy` / `częściowy` / `brak danych`).
Rozdział 1 jest rozpisany w całości:

* **Werdykt osi** (20 / ≤ 25 sł.)
* **Wstęp osi** (147 / 120–180 sł.) w sekwencji *co ustalono → co to znaczy dla firmy → gdzie napięcie*
* **Macierz osi** — tytuł figury jest **wnioskiem**, nie napisem „Matrix osi 1"; podpis 42 słowa
* **Komentarz per obszar** (110–170 sł.) w pięcioczęściowej mikrostrukturze: *Stan faktyczny · Ocena
  i wiarygodność · Znaczenie dla przedsiębiorstwa · Luka i sens targetu · Najbliższy krok*
* **Wnioski osi** (214 / 180–260 sł.)
* **Linia decyzyjna**: Rekomendowany kierunek | Priorytet | Horyzont | Warunek powodzenia

**Limity są widoczne przy każdej sekcji** i działają w obie strony — obszar 1F ma badge
`181 / 110–170 sł. — skróć` na pomarańczowo.

Dwie rzeczy warte spojrzenia, bo to one odróżniają raport ekspercki od generowanego wypełniacza:

1. **„Wyżej" nie znaczy automatycznie „lepiej".** Komentarz 1E mówi wprost: *„Cel 6 (ERP) jest uzasadniony,
   ale nie jako następny krok. Wdrożenie ERP nad niedomkniętym poziomem 3 odtworzy ręczne przepisywanie
   wewnątrz nowego systemu."* Poziom 4 jest opisany jako **słusznie** poza zakresem.
2. **Brak dowodu → krótszy uczciwy blok.** Obszar 1C ma 34 słowa: „nie był przedmiotem wywiadu, nie
   formułujemy oceny, luki ani rekomendacji, do uzupełnienia w kolejnej sesji". Zero ogólników typu
   „warto rozważyć rozwój obszaru".

Szkic ma **znak wodny** na całej powierzchni dokumentu i eksport szkicu zawsze go niesie.

---

## 6. Co bierzemy z dawcy, a co wycinamy

`src/components/assessment/drd/DRDAssessmentEditor.tsx` (2333 linie) jest **dziś martwy dla sesji DRD** —
flaga `drdMethodWorkspaceSliceV1` nie ma wpływu na runtime. Nie da się „włączyć i zobaczyć"; przepisanie
mechaniki to jedyna droga. Dobra wiadomość: dawca jest kompletny i zmapowany co do linii.

| Bierzemy | Wycinamy |
|---|---|
| karta poziomu jako jednostka pracy, rozwijana inline | przycisk `Target` w Interview (DEC-37) |
| panele `pytania / komentarz / załączniki / linki` | kumulatywna rampa poziomów (DEC-38) |
| `Poprzedni` / `Następny` bez utraty stanu | angielskie etykiety w interfejsie |
| kolor dojrzałości poziomu, wspólny z macierzą | stała belka Teresy, globalna legenda |
| pełny ekran macierzy, popup komórki z opisem/przykładem/technologiami | wzajemne wykluczanie się AS-IS i TO-BE |

Trzy okoliczności ułatwiające, sprawdzone w kodzie: backend jest **dalej niż front** (`target_level` już się
zapisuje osobno od current, tabela `method_approvals` istnieje, silnik propozycji AI z cyklem
preview→commit działa), dawca jest zmapowany co do linii, a powłoka trzech trybów **już jest domyślnym
runtime**. Prototyp dokłada zawartość do istniejącego szkieletu, nie buduje nowego.

---

## 7. Co zostaje do Twojej decyzji

Kształt trzech trybów jest **rozstrzygnięty** (DEC-02, DEC-37, DEC-38, DEC-39) — nie potrzebuję niczego więcej,
żeby zacząć. Zostają trzy rzeczy, które blokują wyłącznie Report i dowód końcowy:

### Decyzja 1 — siedem osi czy osiem wymiarów? *(blokuje Report i eksport)*

* **A (rekomendacja): 7 osi = 7 rozdziałów**, zgodnie z runtime (`drdStructure.ts`: 7 osi, 39 obszarów,
  233 definicje poziomów). Dokument `docs/product/DRD_REPORT_SPEC.md` dostaje wersjonowaną poprawkę,
  a mapowanie na 8 wymiarów zapisujemy jako historyczne — **nie kasujemy go po cichu**.
* **B:** zostaje 8 wymiarów. Wtedy trzeba powiedzieć, skąd bierze się ósmy rozdział, skoro nie odpowiada mu
  żadna oś w danych, i co pokazuje jego macierz.

Bez tej decyzji nie da się zrobić eksportu „wszystko" — spis treści i paginacja muszą znać liczbę rozdziałów.

### Decyzja 2 — jedna tożsamość raportu *(blokuje eksport i rejestr)*

* **A (rekomendacja): jeden obiekt Report na rewizję sesji.** Tryb Report jest jego widokiem, rejestr
  „Raporty" tylko go listuje, stary zamrożony „Output" oznaczamy jako historyczny, a PDF jest plikiem
  wygenerowanym z rewizji — nie osobnym bytem. Konsekwencja: zmiana zatwierdzonego stanu wyżej
  **unieważnia** raport, zamiast zostawiać nieaktualny dokument wyglądający na aktualny.
* **B:** Report jako osobny, niezależnie edytowalny dokument — wtedy potrzebna jest odpowiedź, co się dzieje,
  gdy ktoś zmieni ocenę w Interview po wygenerowaniu raportu.

### Decyzja 3 — na czym pokazujemy dowód końcowy *(blokuje odbiór, nie kod)*

* **A (rekomendacja): fixture wyłącznie na czas odbioru**, w osobnej organizacji demonstracyjnej, jawnie
  oznaczonej i kasowanej po akcepcie. Reguła `DO_NOT_SEED_BY_DEFAULT` zostaje nietknięta dla danych demo.
* **B:** zero danych testowych — wtedy Report i Matrix zobaczysz puste, czyli nie zobaczysz nic, co dałoby
  się ocenić.

> Treść w tym prototypie (Metalpol, 6 z 9 obszarów, luka 3–4) to **przykład realistycznej firmy**, nie dane
> z bazy. Nic nie zostało zapisane w żadnej bazie ani wysłane na demo.

---

## 8. Trzy rzeczy, które znalazłem przy okazji

1. **Poziomy nie mają polskich nazw w runtime.** Obszary mają `namePL`, ale **tytuły i opisy 233 poziomów
   istnieją wyłącznie po angielsku** (`drdStructure.ts`). Polskie są tylko pytania i przykłady dowodów
   (z QBanka). Nazwy poziomów na tych ekranach — „Rejestracja podstawowych danych", „Kontrola stanowiska",
   „Kontrola procesu" — przetłumaczyłem roboczo. Do zatwierdzenia albo do osobnego zadania tłumaczeniowego.
2. **Nie istnieje słownik powodów dla „Pomiń".** Prototyp pokazuje pole wyboru, ale lista jest pusta.
   Propozycja czterech kodów: *poza modelem operacyjnym · poza zakresem zlecenia · odroczone do kolejnej
   rewizji · zastąpione innym rozwiązaniem*.
3. **Model zapisu nie jest nigdzie zdefiniowany.** Ekran pokazuje i przycisk `Zapisz`, i stan
   „Szkic zapisany 10:12" — ale co się dzieje przy wyjściu z niezapisanymi zmianami, przy konflikcie dwóch
   osób i przy odzyskiwaniu sesji, nie jest opisane w żadnym dokumencie. Do ustalenia przed implementacją.

Do tego dwie rzeczy do wyboru, obie widoczne w sekcjach decyzyjnych pod Matrixem:
**legenda przy macierzy** (jest w prototypie — zakaz `ASM-OWN-013` dotyczył *globalnej* legendy w powłoce;
to co innego, ale rozstrzygasz Ty) i **nazwa karty 4 Settings** — „Akceptacje" czy „Zatwierdzenia".

---

## 9. Co dzieje się po Twoim „tak"

1. Kontrakty backendowe pod trzy wymiary stanu, kod powodu pominięcia i jawną decyzję „poziom obecny".
2. Interview → Matrix → Report, **jeden ekran po drugim**, każdy za flagą domyślnie wyłączoną.
3. Zrzuty jasny i ciemny robię **ja**, oglądam i poprawiam — dopiero potem oglądasz Ty, do akceptu,
   nie do wykrywania zepsucia.
4. Po akcepcie każdego ekranu: flaga domyślnie włączona + nowy punkt bezpieczny (`demo-safe-<data>`).

**Do rozstrzygnięcia teraz: decyzje 1, 2 i 3 z sekcji 7.** Reszta jest gotowa do wykonania.
