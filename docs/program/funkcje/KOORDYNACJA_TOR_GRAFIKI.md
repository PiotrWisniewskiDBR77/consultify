---
doc_id: funkcje-koordynacja-tor-grafiki
status: canonical
owner: piotr
truth_type: process
established: 2026-09-01
---

# Dwa tory rozjechały się o dwa dni — ustalenia z sesją Grafiki

## Co się stało
Robotnik toru funkcji odgałęził się przypadkiem od lokalnego katalogu zawierającego
**linię toru grafiki** i przy pushu **wypchnął ją w całości**. Wyszło to na jaw dopiero
przy scalaniu, po czterech nieoczekiwanych konfliktach.

**Skutek uboczny jest dobry: 288 commitów toru grafiki żyło WYŁĄCZNIE na dysku lokalnym
i nie było nigdzie zabezpieczonych. Teraz są w skarbcu** — gałąź
`fix/kreator-formularzy-zapis-20260901`, czubek `48121d5ccd`.

## Decyzja: NIE wciągam cudzej linii do integracji
Z gałęzi wybrano **wyłącznie dwa własne commity** naprawy i przeniesiono je pojedynczo.

**Powód nie jest formalny.** Trzy z czterech konfliktów miały po stronie toru grafiki
**starszą treść** (ekrany dev-render, konfiguracja uruchomień, komunikat w katalogu metodyk).
**Odruchowe „zachowaj obie strony" — które sprawdzało się dziś przy dopisywaniu obok siebie —
tutaj COFNĘŁOBY pracę.**

> **„Zachowaj oba" jest poprawne tylko wtedy, gdy obie strony DOPISUJĄ.
> Gdy jedna strona jest starszą wersją tej samej rzeczy, to samo posunięcie kasuje nowszą.**

Rozpoznanie różnicy wymaga **obejrzenia treści konfliktu**, nie samego faktu, że konflikt jest.

## Ustalenia zaproponowane torowi grafiki
1. **Wspólne pole minowe: `dev-render/main.tsx` i `.claude/launch.json`.** Obydwa tory
   dopisują tam swoje ekrany i wpisy. Zasada: **każdy dopisuje tylko swoje, nigdy nie kasuje
   cudzych**; przy scaleniu **tych dwóch plików** „zachowaj oba" jest poprawne, bo wpisy
   są rozłączne.
2. **Każdy inny plik**: konflikt oznacza, że któryś tor patrzy na starszy stan.
   **Nie rozstrzygamy automatem** — decyduje ten, kto ma nowszy commit dotykający tej linii.
3. **Zejście linii wcześniej niż później.** Rozjazd dwudniowy jest do ogarnięcia,
   tygodniowy nie będzie. Scalenie robi tor funkcji, **po kolei i z odbiorem, nie hurtem.**
4. Tor grafiki **nadaje własną nazwę** swojej gałęzi — dziś jego praca wisi pod nazwą
   cudzej naprawy, co jest mylące.

## Co przekazano torowi grafiki jako użyteczne dla jego pracy
- **Kształt 19** — para zrzutów jasny/ciemny może przejść kontrolę różnicy jasności
  z zapasem, **pokazując dwa różne stany programu**; kontrola mierzy „czy obrazy są różne",
  więc **im większy defekt, tym łatwiej przechodzi**. Wraz z gotowymi narzędziami:
  `scripts/dev/lib/checkScreenshotPairState.mjs`, `scripts/dev/lib/meanLuma.mjs`
  i wzorcem przechwytywania czekającego **na wynik, nie na czas**.
- **„Flaga OFF w kodzie" ≠ „wyłączone na demo"** — zmienna środowiskowa omija wartości
  domyślne wczesnym `return true` w **sześciu rodzinach flag**; dotyczy wprost zrzutów
  „co widzi użytkownik".

## Zasada na przyszłość
**Dwa tory pracujące na jednym repozytorium muszą znać nawzajem swój czubek.**
Rozjazd nie jest awarią — awarią jest **dowiedzenie się o nim przy scalaniu**.
Wykrycie kosztowało dziś jedno przerwane scalenie; przy tygodniu rozjazdu kosztowałoby dzień.

---

# Wymiana z torem grafiki — co dostaliśmy i co dostali (1.09, druga tura)

## Rzeczy, które BIERZEMY od nich — każda oszczędza nam rundę
1. **Angielski jest językiem WIODĄCYM metodyki DRD i SIRI** (nazwy osi i poziomów);
   polski obowiązuje **wyłącznie w interfejsie**. U nich unieważniło to **całą serię zgłoszeń
   „angielskie etykiety" — to nie były defekty.** Sprawdziliśmy dzisiejszą ocenę dokumentu
   pod tym kątem: liczone jako wada zdania *„ta sekcja czeka na treść"* i *„plan zaradczy
   do ustalenia"* to **treść dla klienta, nie nazwy metodyki — ocena się broni.**
   Ale bez tego zapisu **zgłaszalibyśmy w przyszłości rzeczy poprawne.**
2. **Wybór po czasie modyfikacji, nigdy po nazwie.** Ich indeks wybierał katalog **ostatni
   alfabetycznie**, a katalogi numerowane są rosnąco — więc `99-` wygrywało z `144-`.
   **120 z 229 kart pokazywało właścicielowi obraz sprzed napraw, a każda pojedyncza karta
   wyglądała wiarygodnie.** Do tego bramka meldująca kartę ze zrzutem **starszym niż ostatnia
   zmiana kodu ekranu**.
   ★ **My tej dziury nie mamy — ale nie z odporności, tylko z braku mechanizmu.** Nasze raporty
   cytują ścieżkę zrzutu wprost, więc **żaden wybór się nie odbywa**. Gdy zbudujemy rejestr
   kart, wpadniemy w to samo — **regułę bierzemy zawczasu.**
3. **Commit wyłącznie z jawną listą plików** (`git commit -- <pliki>`), nigdy `git add -A`,
   nigdy `git stash` (wspólny stos), **nigdy `--amend`**. U nich **ośmiokrotnie jednego dnia**
   równoległa praca kasowała niezacommitowane zmiany robotników. Dwie pierwsze mieliśmy,
   **`--amend` dopisujemy.**
4. **„Licz, pod iloma nazwami istnieje rzecz, której pilnujesz."** U nich reguła koloru
   krytycznego miała **cztery nazwy**, a bramka widziała **jedną**. U nas dziś: kontrola
   dostępu istniała pod jedną nazwą i była nałożona na **dwie z pięciu tras rodziny**.
   **Ta sama choroba, inny objaw.**
5. **Ich bramka parytetu DZIŚ KŁAMIE** — zachłanne parowanie komentarzy zjada fragment pliku
   tras, więc melduje „komponent bez wołacza" tam, gdzie wołacz **jest**; co najmniej dwie
   pozycje ich linii bazowej to duchy. **Ostrzegli PRZED tym, jak ją wzięliśmy.**
   Nie bierzemy jej do ich sygnału o stabilnym punkcie.
   Ich zdanie, które zapisujemy jako regułę: **bezpiecznik, który myli się w jedną stronę,
   każe podejrzewać, że myli się i w drugą.**

## Rzeczy, które ODDALIŚMY
- `scripts/dev/check-devrender-main.sh` — u nich rzecz, która **dwa razy wyglądała jak
  „ekran się nie renderuje"**.
- `scripts/dev/lib/checkScreenshotPairState.mjs` + `meanLuma.mjs` — **kształt 19 był u nich
  nazwany, ale NIEZATKANY**; mieli zapisane, że ich próg jasności „nagradza defekt tym łatwiej,
  im defekt większy", i zostawili to jako dług. Dostali gotowe rozwiązanie.
- Wzorzec przechwytywania **czekającego na wynik, nie na czas**. U nich ten sam błąd wystąpił
  inaczej: zrzut robiony **bez kliknięcia otwierającego panel**, więc raport brzmiał
  „panelu nie ma".

## Zobowiązanie, które wzięliśmy na siebie
**Panel administracyjny jest w ich rejestrze odbioru i właściciel go już ocenił.**
Jeśli audyt rodzin tras dotknie kolejki spraw, dziennika audytu, śladu agenta, kondycji
usług, operacji platformy albo rozliczeń — **piszemy do nich PRZED jakąkolwiek naprawą,
nie po**. Powód jest mocny: **zmiana kształtu odpowiedzi serwera cicho unieważnia ocenę
właściciela**, a dowiedzieliby się o tym dopiero z jego ust.

## Ustalenie proceduralne obowiązujące OBIE strony
**Liczba bez polecenia, które ją odtwarza, nie jest pomiarem — i wolno jej żądać w obie strony.**
Zadziałało od razu: podaliśmy **288** commitów ich linii, oni przeliczyli i podali **286**,
z diagnozą (nasze dwa commity siedziały na wierzchu gałęzi). **Przeliczyliśmy u siebie —
mieli rację.** Tego samego dnia **trzy razy** raport podał nam jako fakt coś, czego nie było.
