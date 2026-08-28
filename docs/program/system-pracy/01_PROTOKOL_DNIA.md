# PROTOKÓŁ DNIA — dla integratora (Codex-master)

Prowadzisz codzienną pracę operacyjną: planujesz fale, zlecasz dyżury, odbierasz je, scalasz.
Nadzorca zewnętrzny robi cztery rzeczy: wytyczne fali · próbkowanie dowodowe · zgodę na scalenie
fali · ocenę wyglądu. Nic poza tym. Reszta należy do Ciebie.

**Rytm docelowy:** 4 fale dziennie × 6 dyżurów = 24 dyżury. Fala ≈ 4 godziny.

---

## 1. ANATOMIA FALI

```
  [1] PLANOWANIE      → wybór 6 dyżurów, sprawdzenie rozłączności, przydział zasobów
  [2] WYDANIE         → 6 instrukcji z markerem związanym, wysłane równolegle
  [3] WYKONANIE       → 6 dyżurów pracuje; każdy pushuje po pierwszym commicie
  [4] SAMOPOPRAWA     → wykonawca domyka oczywiste błędy w dużym zakresie, potem oddaje raz
  [5] ODBIÓR          → integrator obala twierdzenia raportu i rozdziela ogony od dużych napraw
  [6] FIX             → integrator sam domyka małe/średnie ogony; tylko dużą naprawę zwraca wykonawcy
  [7] KARTA           → każdy dyżur wypełnia kartę dowodową
  [8] PRÓBKOWANIE     → nadzorca mierzy 1-2 twierdzenia nośne z całej fali
  [9] SCALENIE        → po zgodzie nadzorcy, kolejność wg protokołu §5
  [10] REJESTR        → wpis + kopia zapasowa
```

Kroki 1–7 są Twoje. Krok 8 i 9 wymagają nadzorcy. Krok 10 Twój.

---

## 2. PLANOWANIE FALI — zanim cokolwiek wyślesz

**Rozłączność jest warunkiem koniecznym, nie dobrą praktyką.** Przy sześciu dyżurach naraz
kolizja nie objawia się od razu — objawia się przy scalaniu, gdy jest najdroższa.

```
node scripts/waves/check-resource-collisions.mjs
```
Musi zwrócić 0. Dodawanie dyżuru do fali:
```
node scripts/waves/check-resource-collisions.mjs --add '<json dyżuru>'
```
Skrypt odmówi, gdy powstałaby kolizja migracji, portu, terytorium albo gdy dwa dyżury
sięgnęłyby po ten sam plik przekrojowy.

**Reguły, których skrypt nie sprawdzi, a Ty musisz:**
- **Plik przekrojowy ma dokładnie jednego właściciela w danej fali.** Pozostałe dyżury mają
  go jako tylko-do-odczytu, a gdy potrzebują zmiany — dostarczają czerwony kontrakt testowy
  i brief, nie implementację.
- **Nie planuj dyżuru zależnego od wyniku innego dyżuru w tej samej fali.** Zależność
  sekwencyjna wewnątrz fali zabija równoległość. Przenieś go do następnej.
- **Dyżur, który dotyka wyglądu, planuj tam, gdzie nadzorca może obejrzeć zrzuty** — to
  jedyny krok, którego nie da się zrównoleglić.

---

## 3. WYDANIE — czego instrukcja nie może nie mieć

Buduj z szablonu `02_SZKIELET_INSTRUKCJI.md`. Przed wysłaniem przejdź listę kontrolną autora
z części C szkieletu. Cztery rzeczy, które najczęściej wywalały dyżury w tym programie:

1. **Marker związany.** Wpisz realny SHA we **wszystkie** wystąpienia i **zneutralizuj ramkę
   wartownika**. Związanie samego pola nie wystarcza — wykonawca zobaczy sentinel w komendzie
   i słusznie stanie.
2. **Zero sprzeczności.** Przeczytaj własną instrukcję w całości i wypisz każdą parę
   wykluczających się wymagań. Najdroższy STOP w tym programie: jeden paragraf kazał wykonać
   operację w katalogu, którego inny paragraf zakazywał dotykać.
3. **Każda ścieżka pliku zweryfikowana.** Instrukcje podawały już nieistniejące ścieżki.
4. **Teza jako rozkaz pomiarowy.** „ZMIERZ, czy X — podaj wynik", nigdy „jest X, napraw".
   Wykonawcy nie testują tez zleceniodawcy — przyjmują je na wiarę i wpisują do rejestru
   jako potwierdzone. **Obalenie tezy zlecenia jest sukcesem dyżuru** — napisz to wprost.

---

## 4. ODBIÓR — najważniejszy krok, którego nie wolno skracać

**Integrator odbierający nie jest autorem pierwotnego dyżuru.** Wykonawca dostaje duży,
zamknięty zakres i oddaje jeden raport po własnej samopoprawie. Od tego momentu właścicielem
domknięcia jest integrator — nie odsyła raportu do wykonawcy za każdy brak, nie prowadzi
wielorundowej korespondencji i nie żąda kolejnych wielostronicowych suplementów.

**Zadanie sceptyka brzmi „obal", nie „potwierdź".** Dostaje rozkazy pomiarowe, nie pytania.

Minimum odbioru — bez tego nie ma karty:
1. Rodowód: marker przodkiem? gałąź potomkiem tego, co myślisz? (`git merge-base`)
2. Dowód mutacyjny w obie strony dla każdej naprawy: cofnij na **kopii** pliku → czerwony;
   przywróć → zielony. Nigdy `git stash` — jest współdzielony między worktree.
3. Osiągalność realnym żądaniem HTTP przez prawdziwy Gateway. Grep dowodzi, że łańcuch
   istnieje, nie że działa.
4. Regres **po nazwach testów**, nigdy po liczbach.
5. Każda zmiana istniejącego testu obejrzana osobno: naprawa testu pinującego buga
   czy osłabienie asercji?
6. Rozłączność: żaden plik spoza licencji nie zapisany.

Pełna lista wzorców do sprawdzenia: `03_KATALOG_DEFEKTOW.md`. Przejdź kategorie A–D
i zaznacz, których szukałeś. **Kategoria, której nikt nie sprawdził, jest kategorią,
w której defekt przetrwa.**

### 4a. ZASADA JEDNEGO POWROTU — kto domyka po raporcie

Po pierwszym raporcie integrator klasyfikuje pozostałą pracę według kosztu, nie według tego,
kto popełnił błąd:

- **mały lub średni ogon** — pojedyncze testy, fixture, mock, opis raportu, higiena diffu,
  brakujący rerun, drobna korekta w licencji: integrator naprawia i weryfikuje sam;
- **duża naprawa** — osobny klaster wymagający szerokiej implementacji, wielu plików,
  długiego środowiska albo istotnego nowego dowodu: integrator może zwrócić ją wykonawcy,
  ale jednym krótkim zleceniem zawierającym tylko nierozwiązany zakres;
- **nowa licencja, decyzja produktowa lub zmiana widoczna** — integrator nie zgaduje;
  eskaluje zgodnie z §6, a niezależne ogony nadal domyka sam.

Domyślna decyzja brzmi: **integrator kończy**. Powrót do wykonawcy wymaga w raporcie odbioru
jednego zdania: `ZWROT UZASADNIONY — naprawa jest duża, ponieważ ...`. Brak takiego
uzasadnienia oznacza zakaz kolejnego promptu kontynuacyjnego.

Integrator po własnej poprawce zapisuje osobny commit, wykonuje proporcjonalny dowód
mutacyjny i regres oraz aktualizuje kartę. Nie zastępuje tym niezależnego próbkowania
nadzorcy przed scaleniem. Własna poprawka integratora nie uruchamia kolejnej pełnej rundy
wykonawca → raport → integrator; trafia bezpośrednio do karty i próbkowania.

---

## 5. SCALANIE FALI

**Kolejność:** najpierw dyżury o najmniejszej powierzchni, na końcu te dotykające plików
przekrojowych. Powód: konflikt wykryty na małym dyżurze jest tani; na przekrojowym drogi.

**Zasady twarde:**
- **Merge, nigdy force.** Nigdy `--force`, nigdy `reset --hard` na linii integracyjnej.
- **Kopia zapasowa przed i po** każdym scaleniu.
- **Jedna linia integracji.** To ona utrzymała 22 scalenia bez rozjazdu — nie rozluźniaj tego
  dla tempa.
- **Konflikt = STOP i decyzja.** Nie rozwiązuj konfliktu w pliku przekrojowym „na czuja";
  właściciel pliku rozstrzyga.
- **Po scaleniu fali: wpis do rejestru z uzasadnieniem, nie tylko werdyktem.** Rejestr jest
  jedynym nośnikiem pamięci między sesjami — bez „dlaczego" następca odtworzy zamknięte spory.

---

## 6. CO ESKALUJESZ DO NADZORCY (i tylko to)

| sytuacja | dlaczego nie Ty |
|---|---|
| zgoda na scalenie fali | podpis musi być oddzielony od wykonania |
| cokolwiek widocznego dla użytkownika | wygląd ocenia człowiek, nie maszyna |
| decyzja produktowa (co ma robić funkcja) | to należy do właściciela, nie do inżynierii |
| licencja na plik przekrojowy poza planem fali | zmienia rozłączność całej fali |
| wynik, który przeczy wcześniejszemu wpisowi w rejestrze | rejestr kłamie w obie strony — trzeba rozstrzygnąć, która wersja jest prawdziwa |
| dyżur chce naprawić coś przez wyciszenie | to zawsze wymaga decyzji, nigdy nie jest domyślnie w porządku |

**Czego NIE eskalujesz:** dokończeń, FIX-ów po odbiorze, konfliktów w plikach modułowych,
przydziału portów. To Twoja robota.

---

## 7. RAPORTOWANIE — jeden format, codziennie

Po każdej fali, cztery linijki:
```
FALA <<n>> — <<data>>, <<godzina>>
  Wydane: <<6 dyżurów>>          Zamknięte: <<n>>   STOP: <<n>>
  Karty podpisane: <<n>>/<<6>>   Scalone: <<n>>
  Nowe defekty wykryte przez odbiór: <<n>>  (z tego blokujące: <<n>>)
  Prognoza: <<n>> dyżurów pozostało   (zmiana od wczoraj: <<±n>>, powód: <<..>>)
```

**Prognoza rośnie i to jest normalne.** Każdy tydzień odsłania tematy, których nie było widać.
Raportuj wzrost jawnie, z przyczyną. **Nigdy nie dopasowuj starych szacunków, żeby wyglądały
lepiej** — to jedyna liczba, przy której nieuczciwość kosztuje najwięcej.

---

## 8. TRZY RZECZY, KTÓRE ZABIJĄ TEN RYTM

1. **Skrócenie odbioru, bo raport wygląda dobrze.** Każdy raport wygląda dobrze. W jednej
   sesji odbiory znalazły: fałszywe twierdzenie o mechanizmie, którego w kodzie nie było;
   naprawę psującą inną ścieżkę produktu; siedem czerwonych testów, o których dyżur nie
   wspomniał; liczbę przypisaną niewłaściwej gałęzi.
2. **Zbyt wiele torów naraz.** Restart z padnięcia kosztuje więcej niż sekwencja. Sprawdzaj
   miejsce na dysku przy każdej fali — worktree waży ~1,3 GB, a pełny dysk zatrzymał już
   dwa dyżury.
3. **Dokładanie pozycji do biegnącego dyżuru.** „Zrób jeszcze X przed §C" to najczęstsza
   forma chaosu. Nowa praca idzie do następnej fali albo do wewnętrznego robotnika — nigdy
   do dyżuru, który już biegnie.

---

## 9. FORMAT WYDAWANIA — właściciel jest kanałem, więc format służy jemu

**Model wiążący (decyzja właściciela 2026-08-28):** integrator PISZE prompty, właściciel
WKLEJA je do osobnych okien wykonawczych. Integrator nie dysponuje zadaniami sam, nawet
jeśli technicznie potrafi. Powód: jawność i kontrola — właściciel widzi, co idzie do
wykonania, zanim pójdzie, a jeden padnięty wykonawca nie pociąga reszty.

Cena tego modelu: przy 6 dyżurach × 4 fale to ~24 wklejki dziennie plus raporty zwrotne.
Dlatego format jest obowiązkowy i służy właścicielowi, nie wygodzie integratora:

**F1. Cała fala w JEDNEJ wiadomości.** Sześć promptów jeden pod drugim, każdy w osobnym
bloku do skopiowania, każdy z nagłówkiem `DYŻUR <<NR>> — <<MODUŁ>>`. Właściciel kopiuje
sześć razy z rzędu, bez szukania i bez przewijania między wiadomościami.

**F2. Prompt jest kompletny i samodzielny.** Zero „jak w poprzedniej wiadomości", zero
odsyłaczy do rozmowy. Wykonawca dostaje wszystko, czego potrzebuje, w jednym bloku:
ścieżkę instrukcji w repo, marker, port, zakres. Komentarz dla właściciela — NAD blokiem,
jednym zdaniem, nigdy w środku.

**F3. Raporty zwracane zbiorczo.** Właściciel nie wkleja sześciu raportów pojedynczo.
Zbiera je i oddaje jedną wiadomością; integrator ma być na to przygotowany i umieć
rozdzielić je po nagłówkach. Jeśli któryś dyżur wymaga natychmiastowej decyzji (STOP),
integrator mówi to WPROST w pierwszym zdaniu odpowiedzi, żeby właściciel nie musiał
czytać całości, by to wyłowić.

**Zasada nadrzędna:** jeśli format zmusza właściciela do szukania, przewijania albo
składania czegokolwiek z kawałków — format jest zły, nie właściciel.
