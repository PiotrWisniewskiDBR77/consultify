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
  [4] SAMOPOPRAWA     → każdy dyżur domyka własne PARTIAL-e, zanim odda
  [5] ODBIÓR          → 6 sceptyków, jeden na dyżur, ZAWSZE inny agent niż autor
  [6] FIX             → poprawki po odbiorze, wykonywane przez autora dyżuru
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

**Sceptyk nigdy nie jest autorem dyżuru.** To jedyna reguła bez wyjątku. Nikt nie potrafi
być własnym sceptykiem — nie z braku uczciwości, tylko dlatego, że sprawdza to, o czym pomyślał.

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
