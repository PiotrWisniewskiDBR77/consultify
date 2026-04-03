# Jak powinna wygladac polityka ludzkiej akceptacji dla AI w fabryce

Target persona: Menedzer systemow jakosci / Kierownik zakladu / Partner prawny i zgodnosci  
Funnel stage: Decision  
Core problem: zespoly opieraja sie na nieformalnych nawykach co do momentu ludzkiego podpisu, co peka przy zmianie zmian, urlopach i pytaniach audytowych  
Main promise: szkielet polityki do publikacji: zakres, progi, dowody, eskalacja, zapisy i szkolenia powiazane z workflow, a nie z nazwami modeli

Polityka ludzkiej akceptacji dla AI w fabryce powinna okreslac, ktore stany workflow wymagaja podpisu konkretnego czlowieka, jaki dowod musi byc widoczny przy akceptacji, jak dlugo akceptacja moze czekac przed eskalacja, kto pokrywa noc i weekend oraz jak zapisywane sa override. Powinna odwolywac sie do klas ryzyka i cofalnosci, ale zawsze konczyc na konkretnych polach workflow i rolach. Jesli mowi tylko o "AI", nie przejdzie audytu ani hali. Polityka jest nudna celowo. Nuda buduje przewidywalnosc operacji.

## Sekcja 1: zakres i definicje

Opublikuj: ktore workflow i lokalizacje obejmuje polityka; definicje trybow obserwuj, doradzaj, dzialaj w jezyku zakladu; ktore systemy sa systemem prawdy dla akceptacji. Unikaj nazw marketingowych modeli w rdzeniu polityki. Uzywaj jezyka workflow i aktywow, ktory audytorzy rozpoznaja.

## Sekcja 2: macierz akceptacji wg stanu workflow

Przykladowy ksztalt (dostosuj do zakladu):

| Stan workflow | Dozwolony tryb AI | Brama ludzka | Rola akceptujaca |
|---|---|---|---|
| triaz intake | doradzaj | potwierdz przed utworzeniem zadania | nadzor linii |
| wydanie zlecenia utrzymania | doradzaj | podpis przed wyslaniem | lider utrzymania |
| dysponowanie blokady jakosci | doradzaj lub dzialaj w regule | podpis zwolnienia | menedzer jakosci |
| override wysylki do klienta | tylko doradzaj | podwojny podpis | jakosc plus logistyka |

Puste komorki aprobanta to droga do incydentow.

## Sekcja 3: pakiet dowodu w momencie akceptacji

Wymagaj widocznych dowodow, nie atmosfery: sygnaly lub pola uzyte w sugestii; flagi niepewnosci, gdy wystepuja; podobne przypadki z przeszlosci jako odniesienie, nie jako autorytet; jawna informacja o cofalnosci i kroku rollback. Aprobant powinien moc powiedziec: "Widzialem X, dlatego podpisalem."

## Sekcja 4: eskalacja czasowa

Zdefiniuj: maksymalny czas oczekiwania na akceptacje wg pasma istotnosci; kto eskaluje automatycznie po przekroczeniu timera; co dzieje sie z zachowaniem trybu dzialaj przy zaleglosciach. Ciche timeouty to sposob, jak "system zadecydowal" staje sie plotka.

## Sekcja 5: pokrycie i delegacja

Uwzglednij: nazwanych zastepcow na noc; reguly delegacji na urlopy; awaryjne zejscie do tylko-doradzaj z informacja kto moze to wlaczyc.

Jesli pokrycia nie ma na pismie, ludzie obchodza przez prywatne loginy. To niszczy sledzalnosc.

## Reality check: polityka akceptacji zwykle pada w weekendy, lukach pokrycia i backlogu

Wiekszosc zakladow potrafi napisac rozsadna regule akceptacji na warsztacie. Test brzmi, czy nadal dziala:

- na nocnej zmianie, gdy glowny aprobant jest nieobecny
- podczas backlogu, gdy nadzorcy szybko czyszcza kolejki
- po incydencie, gdy audytorzy chca jednego czystego rekordu zamiast szesciu wyjasnien

Jesli polityka nie przechodzi przez te momenty, nadal jest wskazowka, nie kontrola.

## Sekcja 6: szkolenie i recertyfikacja

Okresl: kto musi ukonczyc szkolenie z polityki przed prawami akceptacji; coroczne lub po incydencie wyzwalacze recertyfikacji; jak traktowani sa kontraktorzy. Zapisy szkolen sa czescia polityki, nie ozdoba HR.

## Checklist: czy polityka jest operacyjna?

- czy nowy nadzor znajdzie swoje bramy ponizej pieciu minut?  
- czy jakosc wyjasni polityke bez wymieniania dostawcy?  
- czy IT wygeneruje slad audytu akceptacji dla losowego tygodnia?

Trzy razy "tak" oznacza, ze jestes blisko.

## Dlaczego IRIS czyni polityke akceptacji egzekwowalna

DBR77 IRIS to AI-native plant operating system z ujednolicona warstwa wykonania dla produkcji, magazynu, jakosci, utrzymania i zlecania.

Polityki trzymaja sie, gdy akceptacje, dowody i zadania dziela jeden rekord operacyjny.

## Podsumowanie

Pisz akceptacje w jezyku workflow z nazwanymi rolami, timerami i dowodem. Jesli nie da sie tego egzekwowac na hali, to nie jest polityka.

---

*Chcesz zobaczyć, jak to działa w praktyce? [Rozpocznij 14-dniowy trial](https://dbr77.com/iris) lub [Obejrzyj prezentację](https://dbr77.com/demo).*
