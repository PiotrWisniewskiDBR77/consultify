# ODPOWIEDZI FOUNDERA — CZĘŚĆ 3
## P61–P100: Marketing, sprzedaż, finanse, prawo, operacje, bezpieczeństwo i przyszła ewolucja

> Dokument roboczy dla Claude’a.  
> Źródło pytań: `PYTANIA_DO_ZALOZYCIELA.md`.
>
> **Zasada wykonawcza dla Claude’a**
>
> Każdą odpowiedź należy stosować zgodnie z oznaczonym statusem:
>
> - `ZATWIERDZONE` — decyzja wiążąca.
> - `ZATWIERDZONE WARUNKOWO` — decyzja obowiązuje w podanym zakresie.
> - `HIPOTEZA MVP` — decyzja tymczasowa, wymagająca kalibracji.
> - `ODŁOŻONE` — nie realizować teraz; zachować trigger powrotu.
> - `WYMAGA WERYFIKACJI` — nie przedstawiać jako fakt.
> - `WYMAGA DECYZJI FOUNDERA` — Claude nie może samodzielnie rozstrzygnąć.
> - `DO UPROSZCZENIA` — zachować cel, ograniczyć proces.
>
> Claude nie może zamieniać hipotez, rekomendacji ani otwartych pytań w trwałe decyzje bez wpisu do decision logu.

---

## P61 — Kolor akcentu marki

**Status:** WYMAGA DECYZJI FOUNDERA

### Odpowiedź foundera

Na tym etapie należy wybrać jeden kolor akcentu, ale nie powinien on być wymyślony przez agenta bez odniesienia do marki docelowej.

Do czasu finalnej decyzji obowiązuje placeholder funkcjonalny, nie publiczna decyzja brandingowa.

### Rekomendacja robocza

Claude może przygotować maksymalnie trzy propozycje koloru akcentu wraz z:

- kodem HEX,
- przykładem użycia w jasnym i ciemnym interfejsie,
- oceną dostępności,
- uzasadnieniem pozycjonowania,
- konfliktem lub zgodnością z FizzUp i DBR77.

### Instrukcja dla Claude’a

1. Nie wpisuj dowolnego koloru jako zaakceptowanego.
2. Przygotuj trzy warianty do decyzji foundera.
3. Każdy wariant musi spełniać minimum WCAG AA dla kluczowych komponentów.
4. Po wyborze utwórz jeden token design-systemowy, nie rozproszoną paletę.
5. Do czasu wyboru używaj neutralnego placeholdera.

---

## P62 — Weryfikacja wolumenów SEO

**Status:** ZATWIERDZONE

### Odpowiedź foundera

Nie inwestujemy w więcej niż 10 stron SEO bez potwierdzenia realnego popytu wyszukiwarkowego i intencji zakupowej.

Sama liczba wyszukiwań nie wystarczy. Musimy sprawdzić:

- wolumen,
- intencję,
- trudność,
- jakość konkurencji,
- możliwość konwersji,
- zgodność z ICP.

### Instrukcja dla Claude’a

1. Przygotuj krótki keyword research przed skalowaniem treści.
2. Ogranicz pierwszą serię do 5–10 stron o najwyższej wartości.
3. Nie twórz masowego contentu programmatic SEO bez dowodu.
4. Mierz leady i rozmowy, nie tylko ruch.
5. Po 8–12 tygodniach wykonaj review.

---

## P63 — „Ocieplanie” konta na Reddicie

**Status:** ZATWIERDZONE WARUNKOWO

### Odpowiedź foundera

Możemy rozpocząć budowanie wiarygodności na Reddicie, ale nie jako ukrytą kampanię promocyjną i nie przez automatyczne publikowanie treści przez agenta.

Zasada:

- najpierw realny udział w społeczności,
- zero podszywania się pod niezależnego użytkownika,
- zero masowej automatyzacji,
- zero promocji bez kontekstu i wartości,
- pełna odpowiedzialność za wypowiedzi publikowane z konta foundera lub marki.

### Instrukcja dla Claude’a

1. Przygotuj listę 5–10 właściwych społeczności.
2. Opracuj zasady udziału, nie kalendarz spamowania.
3. Drafty mogą być generowane przez AI, ale publikacja wymaga ręcznej akceptacji.
4. Nie używaj fałszywych person.
5. Mierz jakość rozmów i leadów, nie karmę.

---

## P64 — Umowa z design partnerami

**Status:** WYMAGA WERYFIKACJI PRAWNEJ

### Odpowiedź foundera

Szablon Common Paper może być punktem wyjścia, ale nie jest automatycznie zaakceptowany.

Przed użyciem należy zweryfikować co najmniej:

- zakres świadczenia,
- odpowiedzialność,
- prawa IP,
- użycie danych,
- poufność,
- prawo do case study,
- zgodę na referencję,
- zasady rozwiązania umowy,
- zakres supportu,
- limity odpowiedzialności.

### Instrukcja dla Claude’a

1. Przygotuj listę klauzul do decyzji.
2. Nie oznaczaj szablonu jako legal-approved.
3. Utwórz wersję business terms i osobną wersję do przeglądu prawnika.
4. Prawa do case study nie mogą być domniemane.
5. Umowa pilotażowa musi być gotowa przed pierwszym płatnym design partnerem.

---

## P65 — Trigger zatrudnienia pierwszego marketera

**Status:** HIPOTEZA MVP

### Odpowiedź foundera

Próg „ponad 5 godzin tygodniowo przeglądu draftów przez 2 miesiące” może pozostać jednym z sygnałów, ale nie może być jedynym triggerem.

Zatrudnienie pierwszego marketera ma sens, gdy występują łącznie:

- istnieje działający kanał lub wyraźna hipoteza kanału,
- founder staje się bottleneckiem,
- content lub kampanie mają mierzalny wpływ na pipeline,
- istnieje budżet i plan wykorzystania roli,
- praca nie polega wyłącznie na produkowaniu większej liczby treści.

### Instrukcja dla Claude’a

1. Zmień próg godzinowy na jeden z kilku sygnałów.
2. Dodaj wymóg mierzalnego wpływu na pipeline.
3. Nie rekomenduj zatrudnienia bez opisu roli i backlogu.
4. Rozważ najpierw fractional lub contractor.

---

## P66 — Osobiste prowadzenie wywiadów i rozmów design-partner

**Status:** ZATWIERDZONE WARUNKOWO

### Odpowiedź foundera

Founder osobiście prowadzi kluczowe wywiady walidacyjne i pierwsze rozmowy z design partnerami.

Nie oznacza to jednak, że musi wykonywać całą administrację i każdą rozmowę w pełnym zakresie.

Docelowy podział:

- founder: rozmowa, diagnoza, decyzja, zamknięcie,
- agent: research, przygotowanie, notatki, analiza, follow-up,
- później: wybrane rozmowy mogą być delegowane po zbudowaniu wzorca.

### Instrukcja dla Claude’a

1. Zautomatyzuj przygotowanie i follow-up.
2. Nie zamieniaj pierwszych wywiadów na formularz.
3. Zdefiniuj kryterium, kiedy część rozmów można delegować.
4. Mierz czas i wartość uzyskanych dowodów.

---

## P67 — Konto i głos agenta GTM na Reddicie i Discordzie

**Status:** ZATWIERDZONE

### Odpowiedź foundera

Agent GTM nie może samodzielnie publikować jako founder ani podszywać się pod człowieka.

Dopuszczalne modele:

1. draft dla konta foundera — publikacja po ręcznej akceptacji;
2. oficjalne konto marki — z jasną identyfikacją;
3. konto członka zespołu — tylko jeśli jest realnie przez tę osobę prowadzone.

Nie akceptujemy ukrytej automatyzacji ani masowego odpowiadania.

### Instrukcja dla Claude’a

1. Usuń założenie pełnej autonomii publikacji.
2. Dodaj human approval dla zewnętrznych wypowiedzi.
3. Opracuj disclosure policy.
4. Nie stosuj AI-generated replies bez ręcznego dostosowania kontekstu.

---

## P68 — Startowe widełki cenowe

**Status:** HIPOTEZA MVP

### Odpowiedź foundera

Widełki:

- audyt: 99 / 249 / 499 USD,
- pakiet: 990 / 2 500 / 5 000 USD,
- subskrypcja: 49 / 149 / 399 USD/mies.,

mogą być użyte jako hipoteza testowa, ale nie jako finalny cennik.

Należy sprawdzić, czy:

- poziom audytu nie jest zbyt niski względem wartości,
- pakiet obejmuje rzeczywisty zakres odpowiedzialności,
- subskrypcja pokrywa koszt modeli i supportu,
- pricing różnicuje self-service i managed service.

### Instrukcja dla Claude’a

1. Oznacz wszystkie ceny jako `TEST RANGE`.
2. Przygotuj 2–3 wersje landing page.
3. Testuj rozmowę cenową i gotowość do płatności.
4. Nie publikuj rabatów bez warunków.
5. Po pierwszych 10–15 rozmowach przygotuj rekomendację cenową.

---

## P69 — Warunki design partnerów

**Status:** ZATWIERDZONE WARUNKOWO

### Odpowiedź foundera

Pierwsza kohorta powinna mieć 5–8 design partnerów. Zakres 5–12 pozostaje górną granicą, ale nie chcemy nadmiernie rozciągać zdolności delivery.

Design partner powinien:

- wnieść płatność,
- udostępnić czas i dane potrzebne do wdrożenia,
- zgodzić się na regularny feedback,
- zaakceptować ograniczenia wersji pilotażowej,
- ustalić zakres case study i referencji przy podpisaniu umowy.

### Płatność

Minimalna wpłata powinna mieć znaczenie ekonomiczne. Docelowo 10–30% ceny finalnej lub uzgodniona opłata pilotażowa. Nie należy stosować automatycznie 50% bez sprawdzenia ceny i zakresu.

### Instrukcja dla Claude’a

1. Ustal kohortę docelową 5–8.
2. Przygotuj kryteria wejścia i wyjścia.
3. Płatność musi być elementem commitment.
4. Case study i referencja wymagają osobnych zgód.
5. Nie rekrutuj więcej partnerów niż system potrafi obsłużyć.

---

## P70 — Brak CRM i forecastów przed Fazą 10

**Status:** DO KOREKTY

### Odpowiedź foundera

Nie akceptuję zasady całkowitego braku CRM i prognoz do Fazy 10.

Na wczesnym etapie nie potrzebujemy rozbudowanego systemu, ale potrzebujemy minimalnej dyscypliny sprzedażowej od pierwszych rozmów.

Minimum:

- lista leadów,
- status rozmowy,
- następny krok,
- wartość potencjalna,
- źródło,
- data decyzji,
- poziom prawdopodobieństwa jako zakres, nie fałszywa precyzja.

### Instrukcja dla Claude’a

1. Wprowadź prosty CRM lub pipeline tracker od Fazy 1.
2. Nie twórz skomplikowanego forecastingu.
3. Przygotuj scenariusz pipeline: low/base/high.
4. Nie wymyślaj targetów bez danych, ale mierz fakty.
5. Zachowaj historię zobowiązań i next steps.

---

## P71 — Kategorie wykluczone

**Status:** ZATWIERDZONE WARUNKOWO

### Odpowiedź foundera

Standardowa ścieżka MVP wyklucza:

- zdrowie i diagnostykę,
- doradztwo finansowe,
- hazard,
- aplikacje dla dzieci,
- inne kategorie regulowane lub wysokiego ryzyka.

Nie oznacza to trwałego zakazu. Oznacza to brak obsługi bez osobnego programu legal, safety i compliance.

### Instrukcja dla Claude’a

1. Zmień „excluded forever” na `outside standard MVP scope`.
2. Dodaj exception review.
3. Nie przyjmuj klienta z kategorii regulowanej bez zgody foundera i prawnika.
4. Umieść ograniczenia w materiałach sprzedażowych.

---

## P72 — FizzUp jako publiczne case study

**Status:** ZATWIERDZONE WARUNKOWO

### Odpowiedź foundera

FizzUp ma być referencyjnym Startup Zero i może być używany jako publiczne case study.

Nie oznacza to publikacji wszystkiego.

Możemy publikować:

- proces,
- wybrane artefakty,
- przed/po,
- metryki techniczne i produktowe po anonimizacji,
- lessons learned,
- decyzje bez poufnych danych.

Nie publikujemy:

- sekretów,
- wrażliwych danych użytkowników,
- pełnej architektury bezpieczeństwa,
- niezweryfikowanych wyników,
- poufnych kosztów bez decyzji.

### Instrukcja dla Claude’a

1. Utwórz public/private boundary.
2. Przy każdym artefakcie dodaj status publikacji.
3. Nie traktuj „build in public” jako pełnej transparentności.
4. Wymagaj review przed publikacją.

---

## P73 — Budżety miesięczne CC-1..CC-7

**Status:** WYMAGA DECYZJI FOUNDERA

### Odpowiedź foundera

Claude nie może samodzielnie ustalić faktycznych kopert budżetowych bez danych o:

- dostępnej gotówce,
- runway,
- źródle finansowania,
- planie zatrudnienia,
- zakresie narzędzi,
- budżecie prawnym,
- budżecie testów i marketingu.

### Działanie teraz

Należy przygotować tabelę do decyzji z trzema scenariuszami:

- lean,
- base,
- accelerated.

Każda koperta musi wskazywać:

- miesięczny limit,
- wydatki jednorazowe,
- ownera,
- kill-switch,
- uzasadnienie.

### Instrukcja dla Claude’a

1. Nie wpisuj fikcyjnych liczb jako decyzji.
2. Przygotuj propozycję budżetu w trzech scenariuszach.
3. Wskaż minimalny cash need na 6 i 12 miesięcy.
4. Zostaw pola do zatwierdzenia przez foundera.
5. Po decyzji zaktualizuj Budgeting i Financial KPIs.

---

## P74 — Forma prawna, jurysdykcja i VAT

**Status:** WYMAGA DECYZJI FOUNDERA + OPINII PRAWNO-PODATKOWEJ

### Odpowiedź foundera

Nie należy wpisywać automatycznie spółki amerykańskiej ani polskiej jako finalnej decyzji bez analizy.

Decyzja musi uwzględniać:

- miejsce faktycznego zarządzania,
- rezydencję podatkową,
- strukturę właścicielską,
- inwestorów,
- rynek docelowy,
- VAT/sales tax,
- koszty obsługi,
- IP,
- relację z istniejącymi spółkami foundera.

### Instrukcja dla Claude’a

1. Przygotuj decision brief porównujący co najmniej:
   - spółkę polską,
   - spółkę amerykańską Delaware C-Corp,
   - model dwuetapowy lub holdingowy, jeśli uzasadniony.
2. Nie wydawaj porady prawno-podatkowej jako faktu.
3. Wskaż pytania do prawnika i doradcy podatkowego.
4. Ustaw tę decyzję jako blocker przed pierwszą fakturą.
5. Po decyzji utwórz ADR biznesowo-prawny.

---

## P75 — Progi runway 12/9/6 miesięcy

**Status:** HIPOTEZA MVP

### Odpowiedź foundera

Progi 12/9/6 miesięcy mogą pozostać jako domyślna sygnalizacja:

- 12 miesięcy: normalny tryb, kontrola wydatków,
- 9 miesięcy: zamrożenie wydatków opcjonalnych i rewizja planu,
- 6 miesięcy: tryb ochrony gotówki i priorytet finansowania/przychodu.

Muszą jednak zostać dostosowane do faktycznej sytuacji finansowej i modelu finansowania.

### Instrukcja dla Claude’a

1. Oznacz progi jako domyślne.
2. Nie wpisuj ich jako faktu bez danych.
3. Przygotuj dashboard runway po ustaleniu budżetu.
4. Dodaj działania przypisane do każdego progu.

---

## P76 — Korytarze cenowe O1–O4b

**Status:** HIPOTEZA MVP

### Odpowiedź foundera

Korytarze cenowe mogą być użyte do testów, ale przed publikacją należy sprawdzić ich spójność z:

- zakresem odpowiedzialności,
- kosztem delivery,
- kosztem AI,
- rynkiem docelowym,
- wartością dla klienta,
- ryzykiem prawnym.

### Instrukcja dla Claude’a

1. Utrzymaj korytarze jako testowe.
2. Nie przedstawiaj ich jako finalnego cennika.
3. Przygotuj trzy-tier landing page.
4. Po testach zaproponuj uproszczenie oferty.
5. Nie utrzymuj zbyt wielu wariantów równolegle.

---

## P77 — Polityka rabatu design partnerów

**Status:** ZATWIERDZONE WARUNKOWO

### Odpowiedź foundera

Design partner może otrzymać znaczący rabat w zamian za realny wkład, ale nie stosujemy automatycznej zasady 50% dla każdego.

Rabat powinien zależeć od:

- zakresu feedbacku,
- udostępnienia danych,
- zgody na case study,
- szybkości decyzji,
- referencji,
- poziomu ryzyka projektu.

Zasada „nigdy darmowy pakiet wdrożeniowy O3” zostaje zatwierdzona.

### Instrukcja dla Claude’a

1. Wprowadź widełki rabatowe, nie jedną wartość.
2. Każdy rabat musi mieć świadczenie wzajemne.
3. O3 nie może mieć ceny zero.
4. Rabat i prawa marketingowe zapisuj oddzielnie.
5. Founder zatwierdza wyjątki.

---

## P78 — Zachęta pieniężna za wywiady

**Status:** WYMAGA DECYZJI FOUNDERA

### Odpowiedź foundera

Claude nie powinien ustalać jednej kwoty bez informacji o rynku, profilu respondenta i długości rozmowy.

### Rekomendacja robocza

Przygotować propozycję:

- 25–50 USD dla indywidualnych founderów przy 30–45 minutach,
- wyższa stawka dla specjalistycznych respondentów,
- możliwość alternatywy: darmowy audyt lub early access.

Nie należy płacić osobom, które są już aktywnymi leadami sprzedażowymi, jeżeli zaburza to jakość deklaracji zakupowych.

### Instrukcja dla Claude’a

1. Przygotuj warianty zachęty.
2. Rozdziel research participant od sales prospect.
3. Zostaw finalną kwotę do zatwierdzenia.
4. Zapisz koszt w budżecie CC-5.

---

## P79 — Konta deweloperskie klientów

**Status:** ZATWIERDZONE

### Odpowiedź foundera

Platforma ani jej agenci nie opłacają kont deweloperskich Apple, Google ani innych dostawców za klienta.

Konto pozostaje własnością klienta, a opłata jest jego kosztem.

Platforma może:

- prowadzić klienta przez proces,
- przypominać,
- przygotowywać instrukcje,
- wspierać konfigurację,
- weryfikować status.

### Instrukcja dla Claude’a

1. Dodaj tę zasadę do oferty i onboardingu.
2. Nie ujmuj opłat klienta jako własnego COGS.
3. Nie twórz kont na dane platformy.
4. Wyjątki wymagają osobnej decyzji i analizy prawnej.

---

## P80 — Forma prawna i jurysdykcja jako blocker

**Status:** WYMAGA DECYZJI FOUNDERA

### Odpowiedź foundera

To jest ta sama decyzja co P74 i nie należy prowadzić dwóch niezależnych wątków.

Forma prawna, jurysdykcja oraz model podatkowy muszą zostać zamknięte przed:

- pierwszą fakturą,
- podpisaniem umowy komercyjnej,
- przyjęciem płatności,
- zatrudnieniem lub kontraktowaniem ludzi przez nowy podmiot.

### Instrukcja dla Claude’a

1. Połącz P74 i P80 w jeden decision package.
2. Usuń duplikaty.
3. Oznacz jako `LEGAL ENTITY BLOCKER`.
4. Nie zakładaj rozwiązania bez opinii prawno-podatkowej.

---

## P81 — Brief o AI Act

**Status:** ZATWIERDZONE WARUNKOWO

### Odpowiedź foundera

Należy przygotować brief dotyczący unijnego AI Act, ale jego głębokość ma odpowiadać rzeczywistemu modelowi produktu.

Brief powinien ustalić:

- czy platforma jest providerem, deployerem lub innym podmiotem,
- czy funkcje wchodzą w kategorie high-risk,
- jakie obowiązki informacyjne dotyczą agentów,
- jak wpływa to na klientów z UE,
- jakie wymagania pojawiają się przed skalą enterprise.

### Instrukcja dla Claude’a

1. Przygotuj scope briefu.
2. Oprzyj analizę na aktualnych źródłach prawnych.
3. Nie traktuj wszystkich funkcji AI jako high-risk.
4. Zleć finalny review prawnikowi.
5. Ustaw deadline przed pierwszym komercyjnym klientem z UE.

---

## P82 — Brief o tech E&O/cyber

**Status:** ZATWIERDZONE WARUNKOWO

### Odpowiedź foundera

Należy zebrać informacje o ubezpieczeniu tech E&O i cyber przed finalnym ustaleniem cen dla klientów enterprise.

Nie kupujemy polisy automatycznie teraz, ale potrzebujemy znać:

- zakres ochrony,
- wyłączenia dla AI,
- limity,
- wymagane kontrole bezpieczeństwa,
- koszt,
- moment aktywacji.

### Instrukcja dla Claude’a

1. Przygotuj R6b.
2. Zbierz minimum 2–3 orientacyjne oferty.
3. Nie przedstawiaj dostępności ochrony jako pewnej bez potwierdzenia.
4. Powiąż zakup z triggerem enterprise/płatnych wdrożeń produkcyjnych.

---

## P83 — Narzędzie podpisu elektronicznego

**Status:** HIPOTEZA MVP

### Odpowiedź foundera

Na start wybieramy narzędzie o niskim koszcie, wystarczającej wiarygodności i prawidłowym DPA.

DocuSign może być benchmarkiem, ale nie jest automatycznie wybrany.

Kryteria:

- ważność podpisu,
- DPA,
- lista subprocesorów,
- koszt,
- integracja,
- obsługa klientów międzynarodowych,
- możliwość archiwizacji dowodów.

### Instrukcja dla Claude’a

1. Porównaj maksymalnie trzy narzędzia.
2. Nie wybieraj najdroższego rozwiązania bez potrzeby.
3. Dodaj wybranego dostawcę do Vendor Register.
4. Finalny wybór przed pierwszą umową pilotażową.

---

## P84 — Płatność za pilota

**Status:** ZATWIERDZONE

### Odpowiedź foundera

Pilot powinien być płatny, nawet jeśli cena jest symboliczna lub mocno obniżona.

Bezpłatny pilot jest dopuszczalny tylko jako świadomy wyjątek, gdy:

- partner wnosi wyjątkowo cenne dane lub dystrybucję,
- projekt ma znaczenie strategiczne,
- istnieje twardy limit zakresu i czasu,
- founder zatwierdzi wyjątek.

### Instrukcja dla Claude’a

1. Ustaw paid pilot jako domyślny.
2. Wymagaj opisu świadczenia wzajemnego.
3. Nie traktuj zainteresowania bez płatności jako willingness-to-pay.
4. Wyjątki wpisuj do decision logu.

---

## P85 — Wyzwalacze prawnika zewnętrznego

**Status:** ZATWIERDZONE WARUNKOWO

### Odpowiedź foundera

Lista triggerów konsultacji prawnej jest akceptowana, jeśli obejmuje minimum:

- pierwszą umowę komercyjną,
- przetwarzanie danych osobowych klientów,
- kategorię regulowaną,
- incydent bezpieczeństwa,
- transfer danych poza EOG,
- zmianę warunków dostawcy wpływającą na model biznesowy,
- spór lub roszczenie,
- publikację istotnej obietnicy prawnej lub bezpieczeństwa,
- zakup polisy E&O/cyber,
- decyzję o strukturze prawnej.

### Instrukcja dla Claude’a

1. Uporządkuj listę triggerów.
2. Usuń generyczne lub niejasne pozycje.
3. Dodaj ownera i oczekiwany artefakt po konsultacji.
4. Nie zastępuj prawnika agentem AI.

---

## P86 — Zdalne repozytorium i pierwszy push

**Status:** ZATWIERDZONE — PILNE

### Odpowiedź foundera

Repozytorium zdalne musi zostać skonfigurowane natychmiast. Lokalna kopia nie spełnia wymagań ciągłości działania.

Minimum:

- prywatne repozytorium,
- kontrola dostępu,
- MFA,
- branch protection dla głównej gałęzi,
- kopia dokumentacji,
- pierwszy push,
- potwierdzenie odtworzenia.

### Instrukcja dla Claude’a

1. Utwórz checklistę wdrożenia.
2. Nie uznawaj zadania za zakończone bez potwierdzonego push.
3. Dodaj repozytorium do continuity plan.
4. Nie przechowuj sekretów w repozytorium.
5. Wykonaj test clone/restore.

---

## P87 — Menedżer haseł i emergency access

**Status:** ZATWIERDZONE WARUNKOWO

### Odpowiedź foundera

Należy wdrożyć menedżer haseł klasy biznesowej z:

- MFA/FIDO2,
- współdzielonymi sejfami,
- kontrolą dostępu,
- historią zmian,
- emergency access lub równoważnym mechanizmem,
- eksportem awaryjnym.

Finalny wybór dostawcy wymaga porównania i oceny bezpieczeństwa.

### Instrukcja dla Claude’a

1. Porównaj maksymalnie trzy rozwiązania.
2. Nie zapisuj żadnych sekretów w dokumentacji.
3. Przygotuj procedurę emergency access.
4. Osobę kontaktową pozostaw do decyzji foundera.
5. Wdrożenie zakończ testem odzyskania dostępu.

---

## P88 — Sukcesja i pełnomocnictwo

**Status:** ZATWIERDZONE — WYMAGA PRAWNIKA

### Odpowiedź foundera

Należy przygotować formalną instrukcję sukcesji i ciągłości na wypadek czasowej lub trwałej niezdolności foundera do działania.

Zakres powinien obejmować:

- dostęp do kluczowych kont,
- prawa do kodu i IP,
- dane spółki,
- rachunki,
- umowy,
- kontakty do prawników i księgowych,
- osobę lub osoby uprawnione do działania,
- zasady ujawniania informacji.

### Instrukcja dla Claude’a

1. Przygotuj checklistę dla prawnika.
2. Nie zapisuj w repo danych wrażliwych.
3. Rozdziel instrukcję operacyjną od dokumentów prawnych.
4. Oznacz RO-3 jako aktywne do czasu zamknięcia.

---

## P89 — Fizyczna kopia kodów odzyskiwania

**Status:** ZATWIERDZONE

### Odpowiedź foundera

Należy przygotować fizyczną, zaszyfrowaną lub zapieczętowaną kopię najważniejszych kodów odzyskiwania i przechowywać ją poza głównym miejscem pracy i zamieszkania.

### Instrukcja dla Claude’a

1. Utwórz checklistę, bez wpisywania samych kodów.
2. Wskaż kategorie kont objętych procedurą.
3. Zapisz datę ostatniego testu odzyskania.
4. Nie przechowuj lokalizacji kopii w publicznym repozytorium.

---

## P90 — Rozszerzenie rejestru ryzyk

**Status:** ZATWIERDZONE

### Odpowiedź foundera

Rejestr ryzyk powinien zawierać minimum:

- Risk ID,
- opis,
- owner,
- prawdopodobieństwo,
- wpływ,
- status,
- mitigation,
- evidence,
- last reviewed,
- next review,
- trigger eskalacji.

### Instrukcja dla Claude’a

1. Rozszerz schemat.
2. Nie twórz pól bez właściciela.
3. Migruj istniejące ryzyka.
4. Oznacz brakujące dane jako `TBD`, nie wymyślaj ich.
5. Ustal różną częstotliwość review według poziomu ryzyka.

---

## P91 — Cztery nowe ryzyka operacyjne RO-1..RO-4

**Status:** ZATWIERDZONE WARUNKOWO

### Odpowiedź foundera

Ryzyka należy dodać, jeśli są opisane jako realne scenariusze, mają ownera i konkretny plan mitigacji.

Nie akceptujemy ryzyk wpisanych wyłącznie dla kompletności dokumentacji.

### Instrukcja dla Claude’a

1. Dodaj RO-1..RO-4.
2. Wskaż dowód, że ryzyko jest realne.
3. Usuń duplikaty.
4. Przypisz ownerów.
5. Nadaj termin pierwszego review.

---

## P92 — Rejestr dostawców

**Status:** ZATWIERDZONE — PILNE

### Odpowiedź foundera

Vendor Register musi zostać uzupełniony rzeczywistymi danymi przed użyciem dostawców w produkcji.

Dla każdego dostawcy wymagane są:

- status konta,
- owner,
- cel,
- dane przetwarzane,
- DPA,
- subprocesorzy,
- region danych,
- koszt,
- status bezpieczeństwa,
- status decyzji.

### Instrukcja dla Claude’a

1. Zweryfikuj wszystkie wpisy `verify` i `decision-pending`.
2. Nie zgaduj brakujących danych.
3. Oznacz dostawcę jako `blocked`, jeśli brakuje krytycznych informacji.
4. Połącz rejestr z DPA register i architecture docs.

---

## P93 — Pierwsze SOP-y

**Status:** ODŁOŻONE WARUNKOWO

### Odpowiedź foundera

Nie piszemy SOP-ów dla procesów, które jeszcze nie wystąpiły lub nie są powtarzalne.

SOP powstaje, gdy:

- proces wykonano co najmniej 2–3 razy,
- ma ownera,
- niespójność powoduje ryzyko lub stratę czasu,
- istnieje realny użytkownik SOP-u.

Wyjątek: procedury awaryjne i bezpieczeństwa mogą powstać wcześniej.

### Instrukcja dla Claude’a

1. Usuń placeholdery bez procesu.
2. Zachowaj listę planowanych SOP-ów w backlogu.
3. Priorytet daj recovery, incident i access.
4. Nie generuj SOP dla spekulatywnych operacji.

---

## P94 — Checklista hardeningowa

**Status:** ZATWIERDZONE — DO WYKONANIA

### Odpowiedź foundera

Checklista hardeningowa jest obowiązkowym działaniem, nie tylko dokumentem.

Minimum:

- MFA oparte o FIDO2 tam, gdzie możliwe,
- wyłączenie SMS jako podstawowego 2FA,
- unikalne hasła,
- password manager,
- recovery codes,
- aktualizacja urządzeń,
- szyfrowanie dysków,
- ograniczenie admin access,
- przegląd aktywnych sesji i tokenów.

### Instrukcja dla Claude’a

1. Przekształć checklistę w task list.
2. Dodaj status per kontrola.
3. Nie oznaczaj wdrożenia bez dowodu.
4. Wskaż wyjątki i plan ich zamknięcia.
5. Zaplanuj kwartalny review dopiero po pierwszym wdrożeniu.

---

## P95 — Sprzeczność A3/Restricted

**Status:** ZATWIERDZONE TYMCZASOWO

### Odpowiedź foundera

Do czasu formalnej decyzji agent ma odmawiać wykonania działań klasy Restricted.

Podwójne potwierdzenie klienta nie jest wystarczające, jeżeli działanie narusza politykę platformy, prawo, bezpieczeństwo lub przekracza dozwolony zakres.

### Instrukcja dla Claude’a

1. Ustaw deny-by-default.
2. Usuń sugestię, że dwa potwierdzenia automatycznie legalizują działanie.
3. Dodaj exception process z udziałem foundera i odpowiedniego eksperta.
4. Zapisz decyzję jako temporary policy do Fazy 4.

---

## P96 — Obietnica zaufania w marketingu

**Status:** ZATWIERDZONE

### Odpowiedź foundera

Marketing ma komunikować kontrolowane, ograniczone i audytowalne przechowywanie danych oraz sekretów.

Dopuszczalny kierunek:

> Przechowujemy wyłącznie dane i poświadczenia niezbędne do wykonania zatwierdzonych zadań. Chronimy je przez izolację, szyfrowanie, kontrolę dostępu i pełny rejestr użycia.

Nie używamy absolutów:

- „nigdy nie przechowujemy danych”,
- „zero ryzyka”,
- „pełne bezpieczeństwo”,
- „100% prywatności”.

### Instrukcja dla Claude’a

1. Ujednolić security messaging.
2. Usunąć absolutne obietnice.
3. Powiązać claims z realnymi kontrolami.
4. Każdą publiczną obietnicę oznaczyć ownerem i źródłem.

---

## P97 — Zero wydatków compliance do triggera

**Status:** DO KOREKTY

### Odpowiedź foundera

Nie akceptuję zasady „zero wydatków na compliance” jako absolutu.

Nie wydajemy teraz dużych kwot na SOC 2, bug bounty ani rozbudowane pentesty bez triggera. Finansujemy jednak minimum konieczne do bezpiecznego i legalnego działania:

- konsultacje prawne,
- podstawowe hardening,
- przegląd architektury,
- DPA,
- podstawowe testy bezpieczeństwa,
- procedury incydentowe.

### Instrukcja dla Claude’a

1. Rozdziel foundational compliance od certification spend.
2. Usuń absolut „zero”.
3. Dodaj minimalny compliance baseline.
4. SOC 2 i duże audyty pozostają trigger-based.

---

## P98 — RODO i wzory powiadomień o incydentach

**Status:** ZATWIERDZONE — WYMAGA REVIEW PRAWNEGO

### Odpowiedź foundera

Robocze klauzule i wzory mogą pozostać jako drafty, ale nie mogą być używane produkcyjnie bez przeglądu prawnika.

### Instrukcja dla Claude’a

1. Oznacz wszystkie wzory jako `NOT LEGALLY APPROVED`.
2. Dodaj ownera prawnego.
3. Ustaw blocker przed pierwszym klientem z danymi osobowymi.
4. Nie publikuj wzoru jako finalnej polityki.

---

## P99 — Rytm czterech mechanizmów przeglądu

**Status:** DO UPROSZCZENIA

### Odpowiedź foundera

Nie utrzymujemy czterech niezależnych rytuałów.

Konsolidujemy je do:

- miesięcznego operacyjnego review repozytorium, kosztów i ryzyk,
- kwartalnego strategicznego review obejmującego roadmapę AI, technology radar i kierunek firmy,
- review na bramkach fazowych tylko wtedy, gdy realnie przechodzimy do kolejnej fazy.

### Instrukcja dla Claude’a

1. Połącz nakładające się spotkania.
2. Usuń oddzielne rytuały bez unikalnej wartości.
3. Każdy review ma mieć maksymalny czas i oczekiwany output.
4. Nie twórz spotkań dla samej zgodności z dokumentem.

---

## P100 — Poziom formalizmu future evolution

**Status:** ZATWIERDZONE: DOCUMENTATION-FIRST W WERSJI LEKKIEJ

### Odpowiedź foundera

Akceptuję strategiczną zasadę documentation-first, ale nie akceptuję budowy rozbudowanego systemu governance przed produktem i klientami.

Zachowujemy:

- roadmapę kierunkową,
- poziomy autonomii,
- technology radar,
- klasy zmian,
- phase gates.

Upraszczamy:

- liczbę formularzy,
- obowiązkowe rejestry,
- częstotliwość review,
- szczegółowość odległych faz,
- automatyczne mechanizmy promocji i klasyfikacji.

### Zasada nadrzędna

Dokumentacja ma zmniejszać ryzyko i przyspieszać decyzje. Jeżeli nie wspiera bieżącej decyzji, zostaje skrócona albo odłożona.

### Instrukcja dla Claude’a

1. Przygotuj lean governance model.
2. Wskaż elementy wymagane teraz i później.
3. Usuń duplikaty.
4. Nie implementuj mechanizmów L4/L5 przed realnym use case.
5. Mierz koszt utrzymania dokumentacji.

---

# Instrukcja końcowa dla Claude’a

Po zastosowaniu P61–P100:

1. Przygotuj listę decyzji, które nadal wymagają bezpośredniego wyboru foundera:
   - kolor marki,
   - budżety CC-1..CC-7,
   - jurysdykcja i forma prawna,
   - wysokość incentive,
   - osoba emergency access,
   - finalny dostawca e-sign i password manager.
2. Nie wpisuj rekomendacji roboczych jako decyzji finalnych.
3. Utwórz:
   - pricing test plan,
   - design partner criteria,
   - minimal CRM schema,
   - legal readiness backlog,
   - vendor verification backlog,
   - security hardening task list.
4. Skonsoliduj duplikaty P74/P80 i P96/P1.
5. Wstrzymaj automatyczne publikowanie treści przez agentów.
6. Rozdziel:
   - foundational compliance,
   - certification spend,
   - enterprise requirements.
7. Na końcu przedstaw:
   - listę zmienionych dokumentów,
   - nowe ADR-y,
   - otwarte decyzje founderskie,
   - zadania prawne,
   - działania pilne,
   - decyzje odłożone.
