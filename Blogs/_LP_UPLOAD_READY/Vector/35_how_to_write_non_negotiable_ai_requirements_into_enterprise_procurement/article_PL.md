# Jak wpisac niepodlegajace negocjacji wymagania AI do zamowien korporacyjnych

Docelowa osoba: lider zamowien z partnerami IT i prawnymi  
Etap lejka: Decyzja  
Rdzen problem: RFP kopiuje ogolny jezyk bezpieczenstwa, ktory dostawcy moga zaspokoic odpowiedziami z checkboxow, z nieokreslonym treningiem, podprocesorami i sciezkami danych  
Glowna obietnica: scisle aneks wymagan czyni polityke treningu, granice wdrozenia, prawa audytu i obowiazki incydentowe egzekwowalne przed podpisem

Zamowienia to miejsce gdzie abstrakcyjna polityka staje sie rzeczywistoscia umowy.

Slaby jezyk daje slabe kontrole.

## Bezposrednia odpowiedz

Zapisz niepodlegajace negocjacji wymagania AI jako ponumerowany aneks obejmujacy ograniczenie celu przetwarzania danych, zakaz lub waskie pozwolenie na trening i przeglad ludzki, podprocesory i powiadomienia o zmianie, obowiazki trybu wdrozenia, logowanie i wspolprace forensic, wyjatki od limitow odpowiedzialnosci dla naruszen poufnosci oraz niszczenie danych przy wyjsciu z weryfikacja. Oznacz kazda klauzule jako zaliczona lub nie przez odpowiedz dostawcy, nie esej narracyjny.

Jesli nie ma tego w aneksie, nie ma tego w umowie.

## Aneks wymagan: dwanascie klauzul

1. **Ograniczenie celu**: AI przetwarza dane klienta tylko do wymienionych uslug.
2. **Wylaczenie treningu**: domyslnie brak treningu na tresci klienta; kazdy wyjatek wymaga opt-in zakresu i czasu.
3. **Granice dostrajania**: jesli dozwolone, okresl klasy danych zakazane w zbiorach tuningu.
4. **Przeglad ludzki**: jesli personel dostawcy moze widziec prompty lub wyjscia, okresl przypadki, regiony i retencje.
5. **Podprocesory**: lista zatwierdzonych stron lub wymog wstepnej zgody z minimalnymi dniami powiadomienia.
6. **Regiony**: stala lista dozwolona dla przechowywania, inferencji, dostepu wsparcia i kopii zapasowych.
7. **Zobowiazanie wdrozeniowe**: on-premise, prywatne API lub izolowany tenant jako umowne, nie opcjonalne przy starcie.
8. **Baza bezpieczenstwa**: odniesienie do ram kontroli przedsiebiorstwa po ID, nie tylko mgliste SOC.
9. **Logowanie**: minimalne zdarzenia, retencja, dostep klienta i format eksportu.
10. **Incydenty**: kategorie, zegar powiadomien, wspolpraca przy przyczynie i pomoc regulacyjna gdzie ma zastosowanie.
11. **Audyty**: czestotliwosc, zakres i terminy naprawy dla usterek krytycznych.
12. **Wyjscie**: zwrot danych, dowod kryptograficznego wymazania i usuniecie artefaktow modelu gdzie dane klienta mogly pozostac.

## Lista kontrolna: ocen odpowiedzi dostawcy

Dla kazdej klauzuli wymagaj:

- [ ] jawnego potwierdzenia lub udokumentowanego wyjatku
- [ ] odniesienia do kontroli technicznej lub diagramu zalacznika
- [ ] nazwanych podprocesorow jesli istotne

Zalaczniki marketingowe nie zaliczaja sie.

## Porownanie: miekki jezyk RFP kontra egzekwowalny

| Miekki | Egzekwowalny |
|---|---|
| "Dostawca utrzyma rozsadne bezpieczenstwo" | "Dostawca wdraza kontrole z Zalacznika A i dowodzi zgodnosci corocznie" |
| "Dane klienta sa chronione" | "Tresc klienta w zakresie X nie sluzy do treningu globalnych modelow wg par. 4.2" |
| "Dostepna prywatna chmura" | "Produkcyjna inferencja dziala tylko w regionie Y tenant Z bez krzyzowego admina" |

## Kiedy odejsc

Odejdz gdy dostawca odmawia wylaczen treningu dla najwyzszych klas danych lub gdy podprocesory moga sie zmienic z dnia na noc bez okresu naprawczego.

## Most produktowy

DBR77 Vector jest pozycjonowany jako bezpieczna warstwa inteligencji za ekosystemem DBR77: autorskie AI przemyslowe z granicami wdrozenia nadajacymi sie do umocowania umownego, z wykluczeniem danych klienta z treningu modelu i rozumowaniem przemyslowym zamiast ogolnego czatu.

Uzyj aneksu by zweryfikowac te pozycje lacznie w jezyku prawnym i technicznym.

## Podsumowanie

Wymagania niepodlegajace negocjacji to sposob by fabryki trzymaly dostawcow AI uczciwych po zakonczeniu demo.

Napisz aneks raz.

Stosuj ponownie miedzy kategoriami z nalozeniem klas danych.
