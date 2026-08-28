# KARTA DOWODOWA DYŻURU — jedna strona, którą podpisuje nadzorca

**Po co:** przy 24 dyżurach dziennie nikt nie przeczyta 24 raportów po 2000 linii. Karta jest
**streszczeniem dowodów, nie streszczeniem pracy**. Nadzorca podpisuje kartę; raport zostaje
w repozytorium jako materiał źródłowy.

**Zasada twarda: brak karty = brak scalenia.** Bez dyskusji, bez wyjątków.
Karta wypełniona częściowo jest kartą odrzuconą — pole „nie dotyczy" musi mieć uzasadnienie.

---

## SZABLON — skopiuj i wypełnij

```
KARTA DOWODOWA — DYŻUR <<NR>> (<<MODUŁ>>)
Gałąź: <<nazwa>>   Tip: <<SHA>>   Marker: <<SHA>>   Data: <<RRRR-MM-DD>>

── 1. RODOWÓD ──────────────────────────────────────────────────────────
Marker jest przodkiem tipa:            TAK / NIE      <<wynik komendy>>
Kopia zapasowa po pierwszym commicie:  TAK / NIE      <<SHA pierwszego commitu>>
Commitów ponad marker: <<n>>    Plików zmienionych: <<n>>

── 2. ROZŁĄCZNOŚĆ ──────────────────────────────────────────────────────
Pliki spoza licencji zapisane:         ŻADNE / <<lista>>
Pliki przekrojowe dotknięte:           ŻADNE / <<lista + kto ma licencję>>
Przedział migracji użyty:              <<zakres>>  (przydzielony: <<zakres>>)
Port PG / harness:                     <<n>> / <<n>>

── 3. OSIĄGALNOŚĆ (Z34) ────────────────────────────────────────────────
Dla każdej naprawionej/zbudowanej ścieżki — realne żądanie HTTP przez
ApiGateway.getInstance().initializeRoutes(app), podpisany token, realna baza:

  ścieżka                  | metoda | kod | readback z bazy      | plik testu
  <<trasa>>                | POST   | 201 | 1 wiersz, id=<<..>>  | <<ścieżka>>

Grep NIE jest dowodem osiągalności. Test na własnym express() z atrapą auth NIE jest dowodem.

── 4. DOWÓD MUTACYJNY W OBIE STRONY ────────────────────────────────────
Dla KAŻDEJ naprawy osobno. Kopia pliku przez `cp` (NIGDY git stash).

  naprawa        | cofnięcie → | przywrócenie → | dosłowny błąd asercji
  <<opis>>       | CZERWONY n  | ZIELONY        | <<cytat>>

Naprawa bez wiersza w tej tabeli = naprawa NIEUDOWODNIONA. Wpisz ją jawnie jako taką.

── 5. REGRES (po NAZWACH, nigdy po liczbach) ───────────────────────────
Zakres: <<które pakiety, komenda>>       Przebieg z --retry=0: TAK / NIE
Zielony przed → czerwony po:  <<n>>   <<nazwy>>
Czerwony przed → zielony po:  <<n>>   <<nazwy>>
Zastane czerwone (identyczne po obu stronach): <<n>>

── 6. ZMIANY ISTNIEJĄCYCH TESTÓW ───────────────────────────────────────
  plik:linia | było | jest | werdykt: NAPRAWA TESTU PINUJĄCEGO BUGA / OSŁABIENIE
Każdy wiersz wymaga uzasadnienia. Osłabienie = odrzucenie karty.
Jeśli żaden istniejący test nie był zmieniany — napisz ŻADNE.

── 7. MIANOWNIKI ───────────────────────────────────────────────────────
  liczba | co mierzy | komenda, którą policzono
Każda liczba w karcie musi mieć tu wiersz. Liczba bez komendy jest nieważna.

── 8. WYGLĄD (jeśli dyżur dotyka czegokolwiek widocznego) ──────────────
Zrzuty wykonane: TAK / NIE DOTYCZY    Ścieżki: <<..>>
Obejrzane oczami przez wykonawcę: TAK       Stany: jasny / ciemny / pusty / błąd
Język treści (nie nagłówków) oceniony wzrokiem: PL / mieszany / EN
Zmiany widoczne dla użytkownika wprowadzone poza zakresem dyżuru: ŻADNE / <<lista>>

── 9. STATUS PER POZYCJA ───────────────────────────────────────────────
  pozycja | ZROBIONE / CZĘŚCIOWO / NIE ZACZĘTE / STOP | czego brakuje do ZROBIONE
„CZĘŚCIOWO" bez trzeciej kolumny jest nieważne.

── 10. TWIERDZENIA NIEZWERYFIKOWANE ────────────────────────────────────
<<lista — NIE MOŻE BYĆ PUSTA>>
Pusta sekcja oznacza, że wykonawca nie szukał granic własnej wiedzy. Odrzuć kartę.

── 11. STOP-y ──────────────────────────────────────────────────────────
  powód | licencja, którą sprawdziłem | czego potrzebuję od nadzorcy
```

---

## JAK NADZORCA CZYTA KARTĘ

**Odrzuć od razu, bez czytania reszty, gdy:**
- sekcja 10 jest pusta,
- sekcja 4 nie ma wiersza dla którejkolwiek deklarowanej naprawy,
- sekcja 6 zawiera osłabienie asercji,
- sekcja 5 pokazuje zielony→czerwony bez wyjaśnienia,
- sekcja 2 wykazuje zapis pliku spoza licencji,
- jakakolwiek liczba nie ma wiersza w sekcji 7.

**Przy karcie bez czerwonych flag: wybierz jedno–dwa twierdzenia nośne i zmierz je sam,
od zera, nie zaglądając do raportu.** Zgadza się — podpisujesz. Nie zgadza — cała fala wraca.

**Twierdzenie nośne** to takie, na którym opiera się decyzja o scaleniu: „dziura zamknięta",
„zero regresji", „osiągalne z produktu", „X zapisów zabezpieczonych". Twierdzenia ozdobne
(„poprawiono komentarze") nie wymagają próbkowania.

---

## DLACZEGO KAŻDA SEKCJA TU JEST

Każda powstała po realnej wpadce w tym projekcie:

| sekcja | wpadka, która ją wymusiła |
|---|---|
| 1 rodowód | marker okazał się nie być bazą badanej gałęzi; wszystkie porównania mieszały dwie rzeczy |
| 2 rozłączność | trzy instrukcje wzięły ten sam przedział migracji; dwie ekipy weszły na jeden moduł |
| 3 osiągalność | eksport pliku bez ani jednego wołacza w produkcie — działał tylko w teście |
| 4 mutacja | naprawa bezpieczeństwa z testem, który przechodził identycznie z nią i bez niej |
| 5 regres po nazwach | odjęcie liczb dało raport przeczący sam sobie; „regresja" była artefaktem kolejności plików |
| 6 zmiany testów | cztery testy kanonizowały dziurę jako zamierzone zachowanie |
| 7 mianowniki | liczba policzona zawężonym wzorcem wycięła z pomiaru główną trasę badanego modułu |
| 8 wygląd | nagłówki po polsku, cała treść po angielsku — dwa razy w jeden dzień |
| 9 status | rejestr pokazywał „naprawione i zweryfikowane" przy żywym defekcie |
| 10 niezweryfikowane | raport ogłaszał mechanizm, którego w kodzie nie było |
