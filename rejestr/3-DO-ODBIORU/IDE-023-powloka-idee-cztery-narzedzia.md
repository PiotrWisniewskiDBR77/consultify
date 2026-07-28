---
id: IDE-023
tytul: POWŁOKA IDEE — jeden górny pasek, jeden dolny, prawy panel na sześć sekcji, pasek edycji obiektu
typ: zadanie
waga: wysoka
obszar: IDE
stan: do-odbioru
wlasciciel: wykonawca
blokuje: []
zablokowane_przez: []
zrodlo: "Odbiór przeklikany Piotra 2026-07-27 — 51 uwag; akcept układu panelu na prototypie 2026-07-28"
utworzone: 2026-07-28
ekran: mindmap-canvas
wysokosc: 900
klik: "Zaznacz węzeł → panel po prawej przełącza się z „CAŁA IDEA” na „ZAZNACZONY ELEMENT”, a w górnej linii pojawia się pasek edycji (czcionka, kolor tekstu, tło, ramka, kształt). Odznacz → wraca. Sprawdź, że u góry jest JEDNA linia, a na dole przełącznik narzędzi i zoom stoją OBOK siebie."
---

## 1. PO CO TO ISTNIEJE

Cztery narzędzia Idei (Mapa myśli · Tablica · Proces · Tabela) miały cztery różne powłoki: własny górny
pasek, własny dolny, własny panel właściwości, własne menu kontekstowe. Ta sama czynność wyglądała
inaczej w każdym z nich, a część funkcji istniała tylko w jednym.

Właściciel po przeklikaniu wszystkich czterech sformułował zasadę: **lewy pasek, prawy panel, górne menu
i dolny pasek mają być zbudowane identycznie we wszystkich czterech narzędziach — jedna implementacja,
nie cztery kopie.**

## 2. CO DZIAŁA PO ODEBRANIU

**Górny pasek — jedna linia.** Zniknął osobny rząd (Dodaj węzeł · Auto-układ · AI rozwiń · Szablony),
bo dublował lewy pasek ikon. Zniknął breadcrumb, bo powtarzał nazwę widoczną w pillu. Eksport przeniósł
się do kebaba. Odzyskane 100 pikseli wysokości płótna.

**Prawy panel — sześć sekcji zależnych od przedmiotu.** Panel zawsze mówi o jednej z dwóch rzeczy:
o całej Idei albo o zaznaczonym elemencie. Sekcje: Przegląd · Właściwości · Powiązania · AI · Aktywność
· Narzędzie. Komentarze i historia scalone w jedną oś czasu z filtrem — wcześniej „Comments" występowało
dwa razy w dwóch różnych systemach zakładek. Pasek ikon nie zwija się już do wąskiego słupka.

**Cztery pływające panele mają dom.** AI Blind Spots i Zdrowie mapy w sekcji AI; Sceny i Warstwa sesji
w sekcji Narzędzie. Płótno zostaje czyste. Wszystkie funkcje działają z nowego miejsca — sprawdzone
pojedynczo, nie założone.

**Dolny pasek — jeden rząd.** Przełącznik narzędzi i zoom obok siebie, ten sam zestaw ikon wszędzie.
Przy okazji: wskaźnik procentu zoomu **kłamał** (pokazywał 100% przy realnym 53%) — naprawione poza flagą,
bo to fałszywa liczba, nie zmiana wyglądu.

**Pasek edycji obiektu w górnej linii.** Zaznaczenie obiektu podmienia zawartość belki: czcionka, wielkość,
kolor tekstu, pogrubienie, podkreślenie, **kolor tła i kolor ramki osobno**, kształt z palety. W Mapie myśli
wielkość pisma i pogrubienie były zapisywane od miesięcy, ale **żaden komponent ich nie czytał** — dopiero
teraz działają. W Procesie nie było wcześniej ani jednej kontrolki stylu.

**Zdrowie mapy pokazuje konkretne braki**, nie wymyślony procent: „5 węzłów bez etykiety", „3 gałęzie bez
dowodów". Każdy klikalny — prowadzi do problemu na płótnie.

## 3. JAK ODEBRAĆ

Przeklikaj **każde z czterech narzędzi**:

1. **Górna linia** — czy jest jedna? Czy nic nie nachodzi przy wąskim oknie?
2. **Zaznacz obiekt** — czy pasek edycji pojawia się w tej samej linii (nie pływa, nie jest drugim rzędem)?
   Czy kolor tła i kolor ramki da się ustawić **osobno**?
3. **Prawy panel** — przełącz wszystkie sześć sekcji. Czy przy zaznaczeniu nagłówek mówi „ZAZNACZONY ELEMENT"?
   Czy po odznaczeniu wraca do „CAŁA IDEA"?
4. **Aktywność** — czy komentarz da się dodać? Czy filtry (Wszystko / Komentarze / Zmiany) działają?
5. **Płótno** — czy nic nad nim nie pływa poza dolnym paskiem i mini-mapą?
6. **Dolny pasek** — czy przełącznik i zoom są obok siebie? Czy procent zgadza się z realnym przybliżeniem?
7. **Ciemny motyw** — czy wszystko czytelne?

## 4. CZEGO ŚWIADOMIE NIE MA

- **Panel szczegółów wiersza Tabeli** nie wjechał jeszcze do sekcji „Właściwości" — to nadal osobny
  pełnoekranowy widok. Mapowanie zadeklarowane, wykonanie czeka.
- **Convert do dokumentów** (Word/PPT/Excel/Notatka) — decyzja właściciela: po domknięciu powłoki.
  Serwer nie zna dziś tych celów w ogóle.
- **Nawigacja na obiektach w Procesie** — zgłoszenie było zbyt ogólne, żeby je jednoznacznie zmapować;
  do doprecyzowania przy kolejnej rundzie.
- **55 kolorów gałęzi** czeka na uspokojenie.
- **Zawężanie historii do elementu jest przybliżone** — zdarzenia trzymają nazwę elementu, nie jego
  identyfikator, więc po zmianie nazwy element traci swoją historię w widoku zawężonym. Komentarze
  zawężają się dokładnie. Panel mówi o tym wprost, zamiast udawać precyzję.

## 5. DROGA ODWROTU

Każdą część da się wyłączyć osobno, bez ruszania reszty, dopisując do adresu:
`?ff_ideaTopBarOneLine=0` · `?ff_ideaPanel6Sections=0` · `?ff_ideaBottomBarUnified=0` ·
`?ff_canvasObjectEditBar=0` · `?ff_ideaTableGuidedBar=0` · `?ff_canvasUndoInRailOnly=0`

Cofnięcie całości: tag `demo-safe-2026-07-28-powloka`.
