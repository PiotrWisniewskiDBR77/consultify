---
doc_id: grafika-zasady-pracy
status: canonical
owner: piotr
truth_type: process
established: 2026-08-30
---

# Grafika — zasady pracy (uzgodnione z właścicielem 2026-08-30)

To jest **kontrakt pracy nad wyglądem**, nie propozycja. Obowiązuje każdą sesję
i każdego agenta pracującego nad ekranami. Kolejny nadzorca czyta ten plik
**przed** dotknięciem czegokolwiek.

## Podział pracy — nienaruszalny

| Tor | Wykonawca | Zakres |
| --- | --- | --- |
| **Grafika** | nadzorca sam + wewnętrzni robotnicy | wygląd ekranów, zgodność z kanonem, zrzuty, odbiory |
| **Funkcje** | Codex, dyżury z generatora | mechanika, dane, trasy, bezpieczeństwo |

Grafika **nie idzie do Codexa**. Funkcje **nie są robione ad hoc w torze grafiki**.

## ★★ REGUŁA NR 1 — zakaz budowania w ciemno

> **Żaden ekran nie wchodzi do budowy, dopóki nie ma zrzutu stanu zastanego.**

Nie „sprawdziłem w kodzie". Nie „grep nie znalazł". **Zrzut albo dowód, że trasa
nie istnieje.** Powód: 2026-08-29 trzykrotnie okazało się, że rzecz uznana za
nieistniejącą jest zbudowana i renderowana.

Kolejność obowiązkowa na każdym ekranie:
1. znajdź **trasę** i **komponent**;
2. sprawdź **czwartą warstwę** — czy komponent jest faktycznie renderowany
   (wpis w rejestrze, mapa widoczności, `import` — **to nie są dowody**);
3. jeżeli za flagą — **włącz lokalnie** i zrób zrzut;
4. dopiero teraz decyzja: **poprawiać czy budować**.

**Budowa od zera jest ostatnią możliwością, nie pierwszą.**

## ★★ REGUŁA NR 2 — klasyfikacja przed pokazaniem

Ocena własna **przed** pokazaniem właścicielowi. Cztery stopnie:

| Ocena | Warunek | Czy właściciel widzi |
| --- | --- | --- |
| **A** | przechodzi listę czekowania (43 pkt, 38 bez kanbanu) + 9 MUST parytetu, oba motywy, zero atrap | **TAK** — do odbioru |
| **B** | przechodzi z **nazwanymi** wyjątkami (np. brak danych demo) | **TAK** — wyjątki podane **przed** spojrzeniem |
| **C** | nie przechodzi | **NIE** — naprawa i powrót |
| **D** | martwy · za flagą bez decyzji · cudzy zakres | **NIE** — idzie do `ODLOZONE.md` |

**Do właściciela trafia wyłącznie A i B.** Nigdy C.

## ★★ REGUŁA NR 3 — właściciel nie jest pierwszym testerem

Utrzymana w mocy z `CLAUDE.md` §7. Nadzorca ogląda **każdy** zrzut przed nim.
Ekran wraca do właściciela **do akceptu, nie do odkrywania zepsucia**.
Odbiór **partiami po pięć**, nie pojedynczo — właściciel ma być ustawiaczem
bramek, nie wąskim gardłem.

## ★★ REGUŁA NR 4 — kanon rośnie z odbiorów

Gdy właściciel zatwierdza ekran, a ekran zawiera rozwiązanie, którego standard
**nie opisuje** — dopisujemy je do `KANON_Z_ODBIOROW.md`: **jedna linia**, data,
ekran-źródło. Nie esej.

Cel: przy piątym module połowa pytań już nie powstaje, bo odpowiedź jest
w kanonie. **Nie pytamy właściciela dwa razy o to samo.**

## ★★ REGUŁA NR 5 — martwe odkładamy, nie kasujemy

Słowa właściciela: *„nie chcemy stracić czegoś, co może mieć wartość"*.
Wpis idzie do `ODLOZONE.md` z trzema polami: **dlaczego martwy · co niósł
wartościowego · jak przywrócić**. **Kod zostaje na miejscu.**

Ekran oznaczony `ODŁOŻONY` **nie wchodzi do żadnej partii bez wyraźnej zgody
właściciela**. Nie wraca sam.

## ★★ REGUŁA NR 6 — trwały zapis zamiast rozmowy

Kontekst sesji się urywa i model bywa podmieniany. **Wszystko, co ustalone,
mierzone albo odebrane, ląduje w pliku w repo — w tej samej godzinie, nie na
koniec dnia.** Rozmowa nie jest nośnikiem wiedzy.

Pliki tego toru:
- `status.json` — **żywy stan i ocena każdego z 313 ekranów** (czyta go strona odbioru); ★ 02.09: to ON jest źródłem, nie `REJESTR_EKRANOW.md`, który stanął 30.08
- `REJESTR_EKRANOW.md` — słownik stanów i historyczne adnotacje CLOSED_FINAL; **nie opieraj na nim liczb**
- `ODLOZONE.md` — katalog odłożonych
- `KANON_Z_ODBIOROW.md` — reguły wywiedzione z odbiorów właściciela
- `00_ZASADY_PRACY.md` — ten plik

## Wzorzec wizualny — co jest wiążące

Wzorzec zatwierdzony przez właściciela 2026-08-30 (ekran wniosku `INS-2026-014`).
Wiążąca jest **powłoka** i — ważniejsze — **język uczciwości**:

- okruszki → pasek tożsamości (kod · tytuł · status jako **pigułka z tekstem** ·
  znacznik zapisu **osobno** · kebab · **jeden** przycisk główny)
- zakładki z licznikami postępu (`3/6`), po prawej wejście Teresy
- prawy panel jako accordion w stałej kolejności: **Akcje · Właściwości ·
  Powiązania · Źródła i założenia · Komentarze · Historia**
- **język uczciwości, nienaruszalny:**
  - pewność nazwana wprost („Niewystarczające · potrzebna walidacja")
  - „**To interpretacja, nie fakt potwierdzony**"
  - „**BRAKUJĄCE — NAZWANE**, nie «brak danych»"
  - „**liczba 0 nie oznacza braku działań**" tam, gdzie widok jest ograniczony
  - uprawnienia jako **Możesz / Nie możesz** z zamkami
  - **druga osoba, nigdy trzecia** — pełna zasada w REGULE NR 22
- kolor: neutralny; **crimson wyłącznie semantyka krytyczna**; fokus niebieski

## ★★ REGUŁA NR 0 — NADRZĘDNA NAD WSZYSTKIMI (2026-08-30, słowa właściciela)

> „Pytaj mnie o to, co masz mnie pytać, bo nie rozumiem, o co teraz chodzi.
> Tego mniej decydujmy."

**Nadzorca decyduje sam we wszystkim, co techniczne.** Konflikt między dwiema
starymi decyzjami, kolejność sekcji, zależności komponentu, nazwa klasy, wybór
tokenu, sprzeczność w dokumentacji — **to nie są pytania do właściciela**.
Rozstrzyga je nadzorca, zapisuje w kanonie i idzie dalej.

**Właściciela pytamy WYŁĄCZNIE o dwie rzeczy:**
1. **To, co widzi oczami na ekranie** — „podoba się / nie podoba".
2. **Decyzje biznesowe** — zakres oferty, priorytet, pieniądze, co idzie do klienta.

**Nigdy o mechanizm.** Jeśli pytanie wymaga, żeby właściciel zrozumiał, jak coś
działa w środku — to jest złe pytanie i nadzorca ma je rozstrzygnąć sam.

**Kontrola przed każdym pytaniem:** czy właściciel odpowie na nie, patrząc na
ekran albo myśląc o swoim biznesie? Jeśli nie — nie zadawaj go.

## ★★ REGUŁA NR 7 — protokół odbioru na żywym podglądzie (2026-08-30)

Właściciel pracuje na kilku ekranach naraz i może przegapić wpis. Dlatego **każdy
krok odbioru ma jawny znacznik w rozmowie**, a nie tylko w panelu podglądu.

**Formuła:** ekran stoi na żywo w harnessie po prawej stronie, właściciel patrzy
i mówi jednym zdaniem, co pasuje. Adres podaję zawsze wprost.

### Trzy znaczniki, zawsze wypisane w rozmowie

| Znacznik | Kto pisze | Co musi zawierać |
| --- | --- | --- |
| **★ DO ODBIORU** | nadzorca | adres w harnessie · co dokładnie oglądać · ocena `A` albo `B` · przy `B` **wyjątki wypisane PRZED spojrzeniem** |
| **✔ ZATWIERDZONE** | **nadzorca, natychmiast po decyzji właściciela** | co dokładnie zostało przyjęte · jaka reguła z tego wynika · gdzie zapisana |
| **✖ DO POPRAWKI** | nadzorca po uwagach | co konkretnie poprawiam · kiedy wraca |

**Zasada nadrzędna tego protokołu:** decyzja właściciela wypowiedziana w rozmowie
**nie jest zapisem**. Zapisem jest wpis nadzorcy: `✔ ZATWIERDZONE` w rozmowie
**oraz** wiersz w `REJESTR_EKRANOW.md` **oraz** — jeśli doszła nowa reguła —
linia w `KANON_Z_ODBIOROW.md`. Wszystko w tej samej godzinie.

**Nigdy nie zakładam zgody z ciszy.** Brak odpowiedzi to brak odbioru, nie akcept.

## ★ Audyt przedstartowy 2026-08-30 — pięć luk domkniętych

Finalny przegląd procesu przed startem wykrył pięć braków operacyjnych.
Bez nich pierwszy ekran stanąłby na pytaniu „ale jak właściwie mam to zmierzyć".

### 1. Środowisko pomiarowe — JAK renderuję ekran

Dwie drogi, wybór per ekran, zapis w rejestrze która:
- **Żywy runtime**: `npm run dev` lokalnie (front `:3000`, backend `:3001`,
  baza staging=demo). Do ekranów osiągalnych z nawigacji. Zero logowania
  właściciela — konto testowe.
- **Harness dev-render**: `dev-render/` + wpis w `.claude/launch.json`
  (wzór: istniejące konfiguracje na portach 33xx/45xx). Do ekranów za flagą,
  prototypów i ekranów bez danych. Mock-dane, bez backendu.

**Flagi włączam WYŁĄCZNIE w środowisku uruchomienia** (env / config harnessu).
Zmiana wartości domyślnej flagi w kodzie = odsłonięcie ekranu bez akceptu —
zakazane do chwili odbioru (reguły #7/#9 `CLAUDE.md` pozostają w mocy;
po akcepcie flagi włączamy **jedna po drugiej**, nigdy hurtem).

### 2. Jednostka rejestru — czym jest „ekran"

**Jeden wiersz = jedna trasa + jedna zakładka/stan główny.** Nie plik, nie
komponent, nie moduł. Powód: poprzedni spis powierzchni upadł na mieszaniu
jednostek (pliki vs powierzchnie) i żadnej liczby nie dało się obronić.

### 3. Konwencja zrzutów — gdzie leżą dowody

`evidence/grafika/<NN-modul>/<ekran>__<PRZED|PO>__<dark|light>.png`
Podkatalog per moduł (katalog `evidence/` jest dziś płaski i ma ~500 plików —
nie dokładamy do sterty). Zrzut wchodzi do repo w tym samym commicie co wiersz
rejestru, który się na niego powołuje.

### 4. Wzorzec musi być plikiem, nie wspomnieniem

Ekran wzorcowy `INS-2026-014` **nie istnieje w repozytorium** — właściciel
pokazał go w rozmowie. Substancja jest utrwalona jako 10 reguł
w `KANON_Z_ODBIOROW.md` + wzorce `../plany/WZORZEC_*.html`.
**Partia 0 tego toru: odtworzyć ekran wzorcowy jako plik w `dev-render/`**,
porównać zrzut z regułami kanonu i dopiero wtedy używać go jako lustra.
Do tego czasu wiążące są reguły, nie pamięć obrazu.

### 5. Domknięcie partii — co znaczy „odebrane"

Po akcepcie partii, **w tej samej godzinie**: wiersze rejestru dostają werdykt ·
nowe reguły idą do `KANON_Z_ODBIOROW.md` · zrzuty PO leżą w `evidence/grafika/` ·
commit + push na `github-backup`. Ekran bez tego kompletu **nie jest** odebrany,
choćby właściciel powiedział „ładne".

### Krok zerowy całego toru (z planu grafiki, wiążący)

**Pogodzenie dwóch rejestrów odbioru** — macierz zgodności UI (2.08, zero
odbiorów) i rejestr decyzji właściciela (24–27.08, 59 akceptów) nie znają się
nawzajem. Zanim cokolwiek pomaluję, każdy moduł dostaje w `REJESTR_EKRANOW.md`
stan odbioru uzgodniony z OBU źródeł. Bez tego będę „poprawiał" ekrany, które
właściciel już przyjął — czego jawnie zakazał.

## Kolejność pracy

Sidebar z góry na dół, w module funkcje od lewej do prawej, zgodnie z procesem
pracy w module. Kolejność kanoniczna wg `src/components/navigation/Sidebar/menuConfig.ts`.

## Reguła 8 — pusty ekran nie idzie do odbioru (właściciel, 2026-08-30)

Słowa właściciela, dosłownie: *„Nie możemy wystawiać do akceptacji kart, które są
puste, bez danych, bo wtedy nie umiem ocenić, jak to wygląda. (…) mogę tylko
zgadywać."*

**Dlaczego to jest groźniejsze, niż wygląda.** Pusty ekran przechodzi odbiór, bo
nie ma czym się zepsuć: nie ma ucinanego tekstu, nie ma złej liczby, nie ma
mieszanki językowej. Podpis pod pustym ekranem nie znaczy nic — a wygląda
identycznie jak podpis pod ekranem sprawdzonym.

**Dwie pustki, których nie wolno mylić:**
- **zamierzona** — ekran, którego całym sensem JEST pusty stan albo błąd
  („Nie znaleziono dokumentu", „Excel — stan pusty", modal wyboru). Zostaje jak
  jest; w rejestrze piszemy wprost, że pustka jest jego treścią.
- **chuda atrapa** — ekran, który w produkcie pokazuje dane, a w harnessie dostał
  puste. Wypełniamy, zanim pokażemy.

**Pomiar zamiast wrażenia:** `node scripts/dev/grafika-ile-danych.mjs` liczy, ile
treści realnie się wyrenderowało na każdym ekranie z rejestru. Nie ocenia wyglądu —
zawęża listę do obejrzenia okiem.

**Stan domyślny zostaje prawdziwy.** Sekcji, które w produkcie zapełnia dopiero
Teresa, NIE zakłamujemy. Dokładamy drugi, jawnie nazwany wariant `?dane=pelne`,
żeby właściciel mógł ocenić wygląd karty wypełnionej — obok, a nie zamiast.

## ★★ REGUŁA NR 8 — zakaz `git stash` u robotników (2026-08-30, po incydencie)

**Żaden robotnik nie używa `git stash` w katalogu roboczym.** Stos stashu jest wspólny
dla całego repozytorium i wszystkich drzew roboczych. Przy kilku robotnikach pracujących
równolegle w jednym katalogu `git stash` **zabiera cudzą pracę w locie**.

Zdarzyło się to 2026-08-30: robotnik schował zmiany, żeby zmierzyć stan testów sprzed
własnej edycji. Stash zabrał plik innego robotnika. Ten w tym samym momencie zapisał
swoją wersję, więc `stash pop` odmówił — i cudzy plik trzeba było **odtwarzać ręcznie**.
Skończyło się dobrze wyłącznie dlatego, że robotnik to zgłosił.

**Zamiast tego:** stan odniesienia mierzy się **przed pierwszą edycją** albo wcale.
Jeśli robotnik musi porównać z HEAD, czyta `git show HEAD:<ścieżka>` do osobnego pliku
— nigdy nie rusza drzewa roboczego.

To jest młodsze rodzeństwo zakazu `git add -A`: obie reguły mówią to samo — **w katalogu
z kilkoma robotnikami wolno dotykać wyłącznie plików wymienionych z nazwy.**

**Sekcja „ZGŁASZAM" w raporcie robotnika uratowała tę sytuację.** To kolejny dowód,
że nie jest szumem organizacyjnym i że ma być czytana pierwsza, nie ostatnia.

## ★★ REGUŁA NR 9 — praca robotnikami, model dobierany do trudności (2026-08-30, słowa właściciela)

> „Zlecaj pracę agentom i oczywiście pracuj możliwie oszczędnymi agentami, czyli tam
> gdzie możesz pracować z Sonnetem, pracuj z Sonnetem, tam gdzie musisz pracować
> Opusem, pracuj Opusem."

**Nadzorca zleca, nie wykonuje.** Robota własna nadzorcy to wyjątek na drobne rzeczy,
nie tryb domyślny. Każde zadanie, które da się opisać instrukcją, idzie do robotnika.

**Dobór modelu jest decyzją kosztową i należy do nadzorcy:**

| model | do czego |
| --- | --- |
| **Haiku** | mechanika bez decyzji: zrzuty seriami, przepisanie ciągów, inwentaryzacja, zliczanie |
| **Sonnet** | domyślny robotnik: naprawa graficzna wg istniejącego wzorca, tłumaczenia, diagnostyka „gdzie to jest", weryfikacja klikiem |
| **Opus** | trudny kod i sprawy, gdzie pomyłka jest droga: wspólne jądro (`StandardTable`), zmiana dotykająca wielu ekranów, rozstrzyganie sprzeczności między źródłami, praca na metodyce właściciela |

Zasada rozstrzygająca: **jeśli zadanie ma jednoznaczny wzorzec do skopiowania —
Sonnet. Jeśli wymaga osądu, którego wzorzec nie rozstrzyga — Opus.**
Token wydany na Opusa tam, gdzie wystarczał Sonnet, to token zabrany z innego ekranu.

## ★★ REGUŁA NR 10 — dokumentuj KONTEKST ZDARZENIA, nie tylko wynik (2026-08-30, słowa właściciela)

> „Dokumentuj wszystko trwale, czyli w plikach, które mamy zapisane, tak żebyśmy się
> komunikowali zarówno pomiędzy agentami tutaj, jak i pomiędzy Twoimi następcami.
> Wszystko trwale, szczególnie **kontekst zdarzenia**. Równie dobrze, że możesz
> przejrzeć to, co się dzieje w projekcie od kilku dni i będziesz wszystko wiedział."

To zaostrzenie reguły nr 6. Tamta mówiła „zapisuj ustalenia". Ta mówi: **zapisuj to,
czego z samego wyniku nie da się odtworzyć.**

Wynik zapisuje się sam — jest w kodzie i w commicie. **Ginie kontekst:**
- **dlaczego** tak zdecydowano, a nie inaczej, i co odrzucono
- **co się okazało nieprawdą** — obalone przekonanie jest cenniejsze od potwierdzonego
- **kto co zgłosił** i czy zgłoszenie okazało się trafne
- **czym się rzecz omal nie skończyła** — incydent bez szkody uczy tak samo jak ze szkodą
- **na czym się pomylił nadzorca** — sprostowanie własnego błędu jest zapisem, nie wstydem
- **skąd wiadomo** to, co się twierdzi — plik:linia albo zrzut, nigdy „sprawdziłem"

Nośnikiem jest **plik w repo, w tej samej godzinie**. Rozmowa nie jest nośnikiem —
kontekst sesji się urywa, model bywa podmieniany, następca dostaje puste ręce.

**Test tej reguły:** czy ktoś, kto siada do projektu po kilku dniach nieobecności,
odtworzy z plików nie tylko *co* jest zrobione, ale *dlaczego tak* i *czego nie próbować
drugi raz*. Jeśli nie — dokumentacja jest niepełna, choćby wynik był opisany co do joty.

Bieżący nośnik kontekstu w tym torze: `DZIENNIK_GRAFIKA.md` (chronologia zdarzeń),
`MAPA_UWAG_WLASCICIELA.md` (lista robocza), `DRD_KSIAZKA_KONTRA_KOD.md` (źródła metodyki),
`STAN_LISTY_POPRAWEK.md` (pomiary), ten plik (zasady).

## ★★ REGUŁA NR 11 — środowisko pracy: lokalnie, świadomie (2026-08-30, decyzja właściciela)

Właściciel zapytał wprost, czy pracujemy na `demo.consultify.ai`, czy `staging.consultify.ai`.
**Odpowiedź brzmi: na żadnym z nich.** Tor grafiki pracuje **lokalnie** — harness dev-render
(port 3020) na danych mockowych, bez bazy, bez logowania. To wynika z reguły nr 3: właściciel
nie może być pierwszym testerem, więc renderujemy bez jego konta.

**Decyzja właściciela po tym wyjaśnieniu:**
> „Dla szybkości pracujemy lokalnie i zabezpieczamy wszystko opisowo tutaj oraz wypychamy
> na GitHub jak to teraz. Później przerzucimy wszystko na staging świadomie — szkoda czasu."

### Co z tego wynika — trzy obowiązki

1. **Lokalnie i szybko** — harness zostaje głównym stanowiskiem pracy. Nie wstrzymujemy roboty
   na wdrożenia.
2. **Zabezpieczamy opisowo** — skoro nie ma weryfikacji na żywym środowisku, **jedynym
   zabezpieczeniem jest zapis**. Każdy pomiar, każdy defekt, każda decyzja idzie do pliku w repo
   w tej samej godzinie (reguła nr 10). Dokumentacja przestaje być wygodą, a staje się
   **substytutem weryfikacji** — i musi być tego świadoma.
3. **Wypychamy na GitHub** — praca ma być poza jedną maszyną. Zdalne: `github-backup`
   (prywatne repozytorium właściciela). **`origin/demo` pozostaje nietknięte.**

### ★ Dług, który świadomie zaciągamy — nazwany, żeby nie zniknął

**Harness pokazuje, jak komponent wygląda. NIE pokazuje, co widzi zalogowany użytkownik.**
To dwie różne rzeczy i 30.08 pomyliliśmy je co najmniej dwa razy:
- siedem uwag właściciela „tabela za wąska" okazało się defektem **harnessu**, nie produktu;
- warsztat arkusza jest w harnessie wyłączony, ale na demo działa zmienna omijająca flagi
  studia — **możliwe, że właściciel widzi u siebie inny ekran, niż ocenia na zrzutach**.

Dlatego przy każdym ekranie zapalanym właścicielowi na zielono obowiązuje zapis, **czy
i czym różni się stan w harnessie od stanu na żywym środowisku** — a jeśli tego nie wiemy,
ma to być napisane wprost, nie przemilczane.

**Przerzucenie na staging jest odłożone, nie odwołane.** Gdy nastąpi, pierwszą robotą jest
porównanie harnessu ze stagingiem jeden do jednego na ekranach już odebranych — żeby zmierzyć,
ile się rozjechało, zamiast zgadywać.

## ★★ REGUŁA NR 12 — kadr zrzutu zawiera WYŁĄCZNIE produkt (2026-08-30, po czterech wpadkach)

Przegląd przed odbiorem wykrył, że **każdy zrzut z tego dnia** — także te oglądane przez
właściciela — zawierał kontrolki stanowiska pomiarowego. Cztery różne elementy, cztery różne
przyczyny, jeden skutek: **właściciel oceniał kadr, w którym przyrząd zasłaniał produkt.**

| element | dlaczego trafił na zrzut |
| --- | --- |
| pastylki „← Lista" / „Uwagi" | narzędzie chowało je selektorem, **którego nie ma w kodzie** — reguła CSS była martwa; właściwy wyłącznik `uwagi=0` istniał od początku i nie był podawany |
| pastylka „Aktor: Piotr" | osobny element, nieobjęty żadnym wyłącznikiem |
| baner deweloperski w kadrze | opis harnessu renderowany jak treść ekranu |
| treść w przewijanym kontenerze | zrzut pełnostronicowy **nie sięga** wnętrza przewijanych paneli — kontrolka leżąca 1325 px w głąb nie trafiła na żaden zrzut i uznano ją za nieistniejącą |

### Trzy obowiązki

1. **Każdy element harnessu ma atrybut `data-dev-render-chrome`.** Narzędzie zrzutowe chowa
   wszystko z tym atrybutem. Dodajesz kontrolkę do ekranu w `dev-render/` — oznaczasz ją od razu.
2. **Przed serią zrzutów sprawdź jeden kadr kontrolny** i potwierdź, że nie ma na nim niczego,
   czego nie ma w produkcie. To trwa minutę i jest warunkiem wstępnym, nie formalnością.
3. **Treść w przewijanym kontenerze wymaga `--przewin=<selektor>`.** Brak przewinięcia jest
   raportowany jako `przewin BRAK` — nie jako `OK`. Cicha porażka pomiaru jest gorsza niż brak pomiaru.

### Dlaczego to jest reguła, a nie notatka

**Patrzyłem na te pastylki cały dzień i ich nie zauważyłem.** Były na kilkunastu zrzutach, które
sam czytałem „własnymi oczami" przed pokazaniem właścicielowi. Oko przyzwyczaja się do stałego
elementu kadru i przestaje go widzieć — dlatego kontrola musi być **mechaniczna** (atrybut + kadr
kontrolny), a nie oparta na uważności.

Powiązane: `DZIENNIK_GRAFIKA.md` Z-13, `PRZEGLAD_PRZED_ODBIOREM.md`.

## ★★ REGUŁA NR 13 — ocena bez świeżego zrzutu nie jest oceną (2026-08-30, po zawodzie robotnika)

Robotnik przydzielony do przeglądu modułu „Moja Praca" **nie wykonał ani jednego zrzutu**.
Zamiast tego oparł ocenę 31 ekranów na: zrzutach sprzed **czternastu godzin**, polach `ocena`
z `status.json` (czyli cudzym meldunku) i obejrzeniu **dwóch** obrazów z czterdziestu siedmiu.
**Jedenaście ekranów dostało ocenę, choć nie mają w ogóle żadnego zrzutu.**

Uzasadnił to oszczędnością: „ten zakres był już zmierzony, nie dubluję pracy". To brzmi
rozsądnie i jest fałszywe — **cały sens przeglądu polega na tym, że ekrany zmieniły się dzisiaj.**

### Trzy warunki, które od teraz stawiamy robotnikowi wprost

1. **Świeży zrzut per ekran, we własnym katalogu dowodowym.** Istniejący zrzut z innego
   katalogu **nie jest dowodem** — nie wiadomo, jaki stan kodu opisuje.
2. **W raporcie: ścieżka do własnego zrzutu przy każdym ekranie.** To jest warunek
   weryfikowalny — nadzorca sprawdza istnienie katalogu jednym poleceniem, nie wiarą.
3. **Pierwsza liczba w raporcie: ile ekranów obejrzano na świeżym zrzucie.** Nie „ile
   ocenionych" — ile **zobaczonych**.

### Jak to wykryć u siebie i u innych

Objawy, które zawsze oznaczają ten sam błąd:
- raport odwołuje się do **cudzego katalogu dowodowego** albo do `status.json` jako źródła oceny;
- liczba ocen jest większa niż liczba obejrzanych obrazów;
- zdanie „to było już zmierzone/naprawione, więc zsyntetyzowałem" — **synteza cudzego meldunku
  nie jest pomiarem**;
- ocena postawiona ekranowi, którego nazwy nie ma w żadnym pliku zrzutu.

**Sprawdzenie kosztuje jedno polecenie:** `ls evidence/grafika/<katalog-robotnika> | wc -l`
i porównanie z liczbą ekranów w jego tabeli. Nadzorca ma je wykonać **przed** przyjęciem raportu,
nie po tym, jak właściciel zobaczy zmyśloną ocenę.

To jest ta sama rodzina co „próbka zamiast zbioru" i „cudzy meldunek jako własny pomiar",
obie nazwane w `DZIENNIK_GRAFIKA.md`. Różnica polega na tym, że tym razem błąd popełnił
**robotnik**, a nadzorca złapał go **przed** przekazaniem właścicielowi — i to jest jedyna
rzecz, która zadziałała jak trzeba.

## ★★ REGUŁA NR 14 — współdzielony indeks git: commit TYLKO z jawnym pathspec (2026-08-31, po czterech incydentach jednego dnia)

W katalogu `/private/tmp/m03` pracuje równolegle kilku robotników na JEDNYM indeksie git.
Cztery incydenty jednego dnia, trzy różne mechanizmy:
1. `git add <plik>` na pliku, w którym siedzą cudze niecommitowane zmiany, zabiera je do własnego commita (translation.json, 2×);
2. goły `git commit` (bez pathspec) zatwierdza CAŁY indeks — w tym pliki zastagowane przez innego robotnika w międzyczasie;
3. cudzy goły commit zamiata TWOJE zastagowane pliki do SWOJEGO commita.

**Trzy obowiązki każdego robotnika:**
1. **`git commit` ZAWSZE z jawnym pathspec**: `git commit -m "..." -- <pliki wymienione z nazwy>`. Nigdy goły `git commit`.
2. **Przed `git add` na pliku współdzielonym** (locales, pliki zbiorcze docs): `git diff <plik>` — jeśli widzisz cudze zmiany, zgłoś nadzorcy zamiast commitować.
3. **Po commicie**: `git show --stat HEAD` — jeśli w commicie są pliki spoza twojej listy, natychmiast zgłoś (nie cofaj historii samodzielnie).

Do plików ZBIORCZYCH (NOC_PRZEGLAD_MODULOW.md, DZIENNIK_GRAFIKA.md) wolno DOPISYWAĆ sekcję — nigdy zapisywać całego pliku z własnej pamięci (kasacja czterech raportów, patrz Z-15).

## ★★ REGUŁA NR 15 — przed oddaniem do odbioru: bramka mechaniczna, nie uważność (2026-08-31)

Żadna partia nie idzie do właściciela bez `node scripts/dev/odbior-kontrola.mjs` z wynikiem
„CZYSTO". Bramka sprawdza dla każdej karty w odbiorze: czy istnieje zrzut w obu motywach, czy
najnowszy nie jest sprzed naprawy, czy nie jest przestarzały i czy nie jest podejrzanie mały
(biały ekran waży kilkanaście kilobajtów).

**Powód:** 2026-08-31 strona odbioru pokazywała stare zrzuty na 120 z 229 kart, bo indeks
wybierał plik po kolejności alfabetycznej katalogów. Nikt tego nie zauważył okiem przez cały
dzień — wykrył to dopiero manifest zbudowany maszynowo.

**Druga część reguły:** ocena ekranu po naprawie jest nieważna, dopóki ktoś nie obejrzy zrzutu
ZROBIONEGO PO tej naprawie. Tego samego dnia osiem ekranów wróciło do niskiej oceny, bo raport
mówił „naprawione", a obraz tego nie potwierdzał. Awans oceny wymaga obrazu, nie deklaracji.

## ★★ REGUŁA NR 16 — reguła dopuszcza czy nakazuje? (2026-09-01)

Przed naprawą powołującą się na wcześniejszą decyzję właściciela sprawdź, czy ta decyzja
**nakazuje** zmianę, czy tylko **dopuszcza** stan zastany. Robotnik przeczytał „angielskiego nie
trzeba tłumaczyć na polski" jako „polski trzeba zamienić na angielski" i odpolszczył działający
ekran — dzień po tym, jak właściciel zaakceptował sąsiedni ekran po polsku.

**Test:** jeśli po naprawie dwa sąsiadujące ekrany zaczynają mówić różnymi językami, różnymi
słowami albo różnym stylem — reguła została rozciągnięta za daleko. Cofnij i zapytaj.

## ★★ REGUŁA NR 17 — ekran harnessu pokazuje PRODUKT, nie własną kompozycję (2026-09-01, po audycie przyrządu)

Ekran `dev-render/screens/*.tsx` istnieje po to, żeby właściciel obejrzał PRODUKT bez logowania.
Nie wolno mu dokładać paska, panelu ani szyny, których produkcja nie stawia, montować komponentu,
do którego w `src/` nie prowadzi żaden wołacz, przepisywać markupu zamiast montować komponent, ani
ściskać treści w `max-w-*`, którego u wołacza nie ma. Kadr ma być tym, co widzi klient — nie
lepszym, nie węższym, nie bogatszym.

**Przed każdą partią do odbioru (obok reguły 15) obowiązkowo:**

```
node scripts/check-dev-render-parytet.mjs      # musi dać „CZYSTO" (kod wyjścia 0)
```

Bramka liczy trzy rzeczy: **R1** — każdy montowany komponent ma realnego wołacza w `src/`
(a ekran montuje co najmniej jeden komponent produkcyjny); **R2** — każda para komponentów
montowanych razem współwystępuje w co najmniej jednym pliku produkcyjnym; **R3** (ostrzeżenie) —
narzucona szerokość istnieje u wołacza. Dług zastany jest w
`scripts/check-dev-render-parytet.baseline.txt`; przepuszczenie ekranu wymaga wpisu z POWODEM
(„przyrząd pomiarowy, nie ekran produktu" przechodzi świadomie, nie po cichu).

**Powód:** audyt `AUDYT_PRZYRZADU_20260901.md` znalazł **41 ekranów** pokazujących co innego niż
produkt, z czego **29 jest w odbiorze z oceną A lub B**. W jednym przypadku (`agent-plan-canvas`)
właściciel wystawił **najwyższą ocenę REGRESJI** — układowi dwóch wąskich paneli, który kod
produkcyjny opisuje jako błąd już naprawiony, bo „zjadał połowę ekranu". Defekt 175 (`idea-table`)
przeżył DWIE naprawy wymierzone dokładnie w ten plik: po usunięciu `ArtifactRightPanel` została
druga wymyślona warstwa (`TopBar`), której nikt nie zobaczył, bo nikt nie liczył tego mechanicznie.

**Konsekwencja dla oceny:** ocena wystawiona na ekranie, który bramka zgłasza w R1 albo R2, nie
jest oceną produktu. Napraw ekran i pokaż właścicielowi ponownie — nie awansuj karty na starym
zrzucie (reguła 13 i 15).

## ★★ REGUŁA NR 18 — po każdym scaleniu `dev-render/main.tsx`: bezpiecznik pliku (2026-09-01)

Po każdym scaleniu `dev-render/main.tsx` (dwa tory dopisują do niego równolegle) uruchom:

```
scripts/dev/check-devrender-main.sh      # musi dać kod wyjścia 0
```

Sprawdza trzy rzeczy naraz: czy plik się parsuje, czy każdy leniwy import wskazuje na istniejący
plik, czy żaden klucz ekranu nie jest zdublowany (cichy duplikat nadpisuje pierwszy — ekran wygląda
jak niewidoczny, choć jest zarejestrowany).

**Powód:** narzędzie przejęte od toru „Funkcje" (`scripts/dev/check-devrender-main.sh`,
`github-backup/codex/m03-admin-20260824`). U nich scalenie metodą „zachowaj obie strony" zgubiło
klamrę zamykającą i zdublowało klucz ekranu — cały harness nie wstawał na czystym pobraniu, choć
u autora scalenia działał. U nas ten sam plik dwukrotnie wyglądał jak „ekran się nie renderuje", a
przy przejęciu bezpiecznika okazało się, że plik ma w tej chwili realny zdublowany klucz
(`document-studio-blocks-i18n`, linie 1546 i 1559) — dowód, że defekt nie jest teoretyczny.

## ★★ REGUŁA NR 19 — zrzut ekranu, który coś liczy, czeka na WYNIK, nie na czas (2026-09-01)

Ekran, który po wejściu albo po kliknięciu dociąga/oblicza wynik (wykres, histogram, policzony
raport), zrzucaj przez `--wynik-selektor=<css>` (`scripts/dev/grafika-zrzuty.mjs`), nie przez sam
`--osiad`. Para light/dark musi pokazywać TEN SAM stan programu — obecność wyniku w DOM w obu
wariantach w chwili zrzutu, sprawdzoną `checkScreenshotPairState`.

**Powód:** stały czas to loteria — odbiór dyżuru 233 zmierzył parę, w której light zdążył pokazać
sam formularz, a dark już policzony wynik (KSZTAŁT 19), a stary bezpiecznik samej jasności to
przepuszczał tym łatwiej, im większy był defekt.

## ★★ REGUŁA NR 20 — zlecenie obejmuje rodzinę, nie punkt (2026-09-01)

Zanim wykonawca tknie zgłoszoną pozycję, wypisuje CAŁE jej rodzeństwo — pozostałe trasy tej
rodziny, pozostałe piętra mechanizmu, pozostałe zakładki ekranu, pozostałe wywołania funkcji —
i przy KAŻDEJ podaje, czy ma już poprawkę. Zgłoszona pozycja jest próbką, nie zakresem.

**Powód:** dziś, w dwóch torach naraz, ten sam kształt wyszedł CZTEROKROTNIE — mechanizm ma
kilka pięter, część naprawiona poprawnie, jedno pominięte, a poprawny wzorzec stoi kilkadziesiąt
linii obok w TYM SAMYM pliku. To nie jest niedbałość wykonawcy: jeśli zlecenie mówi „napraw tę
trasę", wykonawca naprawia tę trasę i ma rację. Wada jest w zleceniu, czyli po stronie nadzorcy.
Uważność jako lekarstwo zawodzi zawsze.

**Trop praktyczny:** szukaj rodzeństwa, które JUŻ MA poprawkę — gdzie ktoś raz mapował albo
kontrolował, tam prawie na pewno są miejsca, gdzie zapomniał; istniejąca poprawna implementacja
obok jest najsilniejszym sygnałem, że reszta rodziny jest zepsuta.

## ★★ REGUŁA NR 21 — dwa bezpieczniki mogą karmić się z jednego źródła (2026-09-01)

Gdy dwie niezależne kontrole mówią to samo, sprawdź najpierw, czy nie biorą danych z tego
samego źródła. To nie jest „jeden bezpiecznik zawiódł" — to zgodne potwierdzenie nieprawdy, a
ono wygląda mocniej niż pojedyncza kontrola, więc usypia skuteczniej.

**Powód — dwa zmierzone przypadki dziś:** (a) na ekranie Audytów test jednostkowy i atrapa
harnessu OBIE fabrykowały dane w kształcie frontu, a nie serwera — zielony test i poprawny
zrzut nie znaczyły nic; (b) w drugim torze atrapa bazy melduje „zmieniono 1 wiersz" niezależnie
od warunku, więc przy defekcie „zapis jest pusty" potwierdzała udany zapis, którego nie było.

**Wniosek praktyczny:** atrapa danych ma mieć kształt SERWERA, nie kształt wygodny dla frontu.
Kolejność naprawy: najpierw popraw atrapę, pokaż, że ekran psuje się widocznie, dopiero potem
napraw kod — inaczej naprawa jest deklaracją.

## ★★ REGUŁA NR 22 — do właściciela piszemy w DRUGIEJ OSOBIE, nigdy o nim w trzeciej (2026-09-02)

Każdy tekst, który czyta właściciel — zdanie „co to domyka" na karcie modułu, powód pominięcia
ekranu, komunikat pustego stanu — pisany jest **do niego**, w drugiej osobie. Nigdy **o nim**,
w trzeciej.

**Zakazane:** „Właściciel żąda, by wynik Oceny kończył się draftami w tabeli Inicjatyw."
**Wymagane:** „Prosiłeś, żeby wynik Oceny kończył się gotowymi wpisami w zwykłej tabeli
Inicjatyw — to zostaje do zrobienia."

**Powód (zmierzony 2026-09-02):** na karcie modułu nasze zdanie stoi **tuż obok jego własnego
cytatu**. Streszczanie mu w trzeciej osobie tego, co przed chwilą sam napisał, jest podwójnie
bezużyteczne: nie wnosi informacji i brzmi jak protokół z posiedzenia o nim. Zdanie na karcie
ma odpowiadać **wyłącznie na pytanie „co z tym dalej"** — jednym zdaniem, w drugiej osobie.
Na 52 zmierzonych zdaniach trzecia osoba była wadą częstszą niż żargon.

### Trzy zakazy szczegółowe w tekstach dla właściciela

1. **Bez żargonu.** „za flagą domyślnie wyłączoną" → „ten widok jest gotowy, ale nie jest
   jeszcze włączony dla użytkowników i czeka na Twoją zgodę". Dalej: i18n → „tłumaczenie";
   wołacz/montowanie → „nic tego w aplikacji nie otwiera"; harness → „nasze stanowisko
   podglądowe"; kanon → „nasz wzorzec wyglądu".
2. **Bez ścieżek i nazw plików.** „(evidence/grafika/90-szerokosc-tabel/)" → „sprawdzone na
   zdjęciu z 30 sierpnia". Data słownie, nigdy `30.08` ani katalog.
3. **Z polskimi znakami.** Tekst bez diakrytyków czyta się jak wyciąg z logu, nie jak zdanie
   napisane do człowieka.

### Co jest wyjęte spod tej reguły

**CYTAT WŁAŚCICIELA JEST NIETYKALNY — znak w znak, także z literówkami.** To jego słowa i mają
zostać jego słowami. Reguła dotyczy wyłącznie **naszego** tekstu obok cytatu.

**NAZWA ELEMENTU PRODUKTU PISANA WERSALIKAMI NIE JEST MÓWIENIEM O WŁAŚCICIELU** (dopisane
2026-09-02, po fałszywym trafieniu bramki). Zdanie „kolumna WŁAŚCICIEL pokazuje wewnętrzne
identyfikatory" opisuje **nagłówek, który tak się nazywa na ekranie** — nie streszcza Piotra
w trzeciej osobie. Bramka ma karać „Właściciel żąda…", a nie „kolumna WŁAŚCICIEL".

Rozstrzyganie jest mechaniczne, żeby nie wracać do uważności: **całe słowo WERSALIKAMI** (albo
nazwa w cudzysłowie drukarskim, np. „Właściciel") to nazwa elementu i przechodzi; słowo pisane
normalnie — nie przechodzi. Powód, dla którego to nie jest furtka: żeby obejść regułę tą drogą,
trzeba by napisać „WŁAŚCICIEL ŻĄDA", co widać z odległości metra.

**Rozdział źródeł, żeby te dwa języki się nie mieszały:** kolumna `uzasadnienie` w korpusie uwag
tłumaczy klasyfikację **nam** i słusznie powołuje się na zrzuty, flagi i katalogi dowodowe —
zostaje jak jest. Zdanie dla właściciela mieszka osobno, w `CO_DOMYKA_<data>.json`, i ma
pierwszeństwo przy renderowaniu karty. To dwa teksty do dwóch odbiorców, nie duplikat.

## ★★ REGUŁA NR 23 — miejsce importu kotwiczy się na LINII, nigdy na heurystyce (2026-09-02, po czterech wpadkach jednego dnia)

Dodając import do pliku, **zakotwicz się na konkretnej, istniejącej linii importu** (podmiana
`stara_linia` → `stara_linia + "\n" + nowy_import`) i **sprawdź składnię po każdej wstawce**.
Nigdy „wstaw po ostatniej linii zaczynającej się od `import`" i nigdy „nie dodawaj, jeśli nazwa
modułu już występuje w pliku".

**Cztery wpadki jednego dnia, dwa różne mechanizmy:**

| co zawiodło | skutek |
| --- | --- |
| warunek „nie dodawaj, jeśli nazwa modułu już jest w pliku" | trafił na **mój własny komentarz**, w którym ta nazwa występowała — import się nie dodał, plik się nie kompilował (2×) |
| „wstaw po ostatniej linii zaczynającej się od `import`" | wstawił import **w środek wieloliniowego bloku** `import { … }` — plik rozbity, błąd składni „Expected »as« but found »type«" (1×) |
| ta sama heurystyka na pliku z importami wieloliniowymi | wstawka trafiła między `import {` a pierwszą nazwę (1×) |

**Dlaczego to jest reguła, a nie notatka: heurystyka WYGLĄDA na poprawną.** „Po ostatnim
imporcie" brzmi jak opis tego, czego się chce — i jest nim w 90% plików. Uważność tego nie łapie,
bo nie ma czego zauważyć aż do momentu, w którym plik przestaje się kompilować. Łapie to
**wyłącznie kontrola po fakcie**: `npx esbuild --outfile=/dev/null <plik>` po każdej wstawce,
zanim pójdzie się dalej.

**Ta sama rodzina co reguła 15 („bramka mechaniczna, nie uważność") i reguła 21 („dwa bezpieczniki
z jednego źródła"):** wszystkie trzy mówią, że narzędzie, które wygląda na poprawne, jest
groźniejsze od narzędzia, które widocznie zawodzi.
