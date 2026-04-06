# Co powinna zawierać — a czego ignorować — executiveska karta wyników operacji AI

Docelowa persona: COO / właściciel P&L zakładu / wiceprezes łańcucha dostaw  
Etap lejka: Evaluation  
Główny problem: kierownictwo widzi dema modeli i procenty adopcji, podczas gdy zakład wciąż traci godziny na niejasną odpowiedzialność i wolnym domknięciu  
Główna obietnica: krótka karta wyników wiążąca asystę AI z reakcją, ochroną przepustowości, gotowością do audytu i ludzkim domykaniem działań, przy odfiltrowaniu metryk pozorów

Executive nie potrzebują więcej wykresów. Potrzebują mniej liczb, które wciąż przewidują zachowanie. Executiveska karta wyników operacji AI powinna dać się złożyć z eksportów w poniżej trzydziestu minut — bo jeśli w złym tygodniu nie da się jej uczciwie wyprodukować, nie przetrwa prawdziwych operacji. Ujmij medianowy czas do właściciela dla pozycji wspomaganych, wskaźnik domknięcia w SLA przy obecnych wymaganych polach, powtarzające się wzorce incydentów po tym, jak asysta zmieniła kierowanie zgłoszeń, wskaźnik override’ów ze skategoryzowanymi powodami oraz pokrycie szkoleniami według ról. Te metryki łączą widok kierownictwa z mechaniką hali.

Ignoruj tory pozorów, które ukrywają ryzyko: surowy wolumen sugestii bez dyscypliny akceptacji, metryki dokładności odłączone od blokad bezpieczeństwa i jakości, „wskaźnik automatyzacji” liczący kliknięcia UI zamiast stanów operacyjnych, ankiety satysfakcji bez powiązania z rekordami incydentów oraz tokenowe metryki IT w pakiecie przeglądu operacji. Nowoczesne metryki dobrze się czują. Nie prowadzą linii.

Używaj widoku tygodniowego dla przełożonych: wcześnie wychwytuj dryf czasu do właściciela i SLA domknięcia, zauważaj motywy override’ów sugerujące szkolenie lub edycję progów, reaguj natychmiast na powtarzające się incydenty. Używaj widoku miesięcznego dla kapitału i polityki: trenduj wpływ na obsadę, uruchamiaj przeprojektowanie procesu, gdy SLA chronicznie pada, aktualizuj nadzór, gdy wzorce override’ów stabilizują się w lukach politycznych.

Integralność karty wymaga dyscypliny: każda metryka nazywa pole systemu prawdy, linie bazowe są datowane i zamrożone, wyłączenia jawne, czerwone progi mają właściciela działania, a executive slice mieści się na jednej stronie ze szczegółami w aneksie.

Porównaj karty demo z kartami operacyjnymi. Demo używa dobranych zrzutów i najlepszych momentów. Operacyjna używa eksportów, median i zachowania w ogonie oraz rozliczalności u liderów linii i funkcji. Nabywcy i operatorzy szybko uczą się rozróżniać.

Karta działa, gdy cotygodniowe przeglądy operacji już istnieją, asysta wiąże się z zadaniami z właścicielami, a finanse akceptuje operacyjne definicje miary przepustowości. Wprowadza w błąd, gdy asysta działa poza rekordem wykonania, definicje SLA różnią się między zmianami albo incydenty zamykają się werbalnie bez powiązania w systemie.

IRIS utrzymuje wiarygodność metryk executive, gdy wspomagane zadania, akceptacje, domknięcia i override’y pochodzą z tej samej warstwy wykonania, której używa hala — więc kierownictwo widzi pola, nie opowieści.

Do sąsiedniego rytmu i kontroli zobacz [Jak przeglądać operacje wspomagane AI po pierwszych 90 dniach](../40_how_to_review_ai_assisted_operations_after_the_first_90_days/article_PL.md) oraz [Jak skalować wsparcie AI bez utraty kontroli operacyjnej](../38_how_to_scale_ai_assistance_without_losing_operational_control/article_PL.md).

Karta pomaga też kierownictwu uniknąć dwóch klasycznych trybów awarii programów AI: świętowania aktywności, gdy domknięcie się pogarsza, albo karania hali za błędy modelu, które w rzeczywistości były złą konfiguracją progów. Gdy metryki są powiązane z polami — czas do właściciela, domknięcie SLA, skategoryzowane override’y — te tryby wcześnie się uwidaczniają. Bez pól organizacja spiera się o narracje, dopóki incydent nie wymusi uczciwości.

Na koniec celowo utrzymuj executive slice mały. Chodzi nie o olśnienie szerokością, lecz o cotygodniowy rytm, w którym krótki zestaw liczb napędza krótki zestaw decyzji: zacieśnij próg, dołóż szkolenie, przesuń obsadę, wstrzymaj tryb działania albo poszerzaj dopiero wtedy, gdy karta mówi, że zakład na to zapracował. Tak karty stają się narzędziami zarządzania zamiast tapety.

Jeśli kierownictwo nie potrafi wyjaśnić, jak dana metryka zmienia próg, plan szkolenia lub wzorzec obsady — usuń ją. Trzymaj widok krótki, eksportowalny i z rozliczalnym właścicielem.

## Podsumowanie operacyjne

Obietnica tego artykułu — krótka karta wyników wiążąca asystę AI z reakcją, ochroną przepustowości, gotowością do audytu i ludzkim domykaniem działań, przy odfiltrowaniu metryk pozorów — staje się operacyjna dopiero wtedy, gdy zmienia się sposób przepływu pracy: wyraźniejsze przypisanie odpowiedzialności, szybsze pierwsze przydzielenie i domknięcie możliwe do prześledzenia bez archeologii skrzynek. Dla „Co powinna zawierać — a czego ignorować — executiveska karta wyników operacji AI” traktuj to jako test akceptacji: następna zmiana powinna móc odczytać, co się stało, co zostało zatwierdzone i co pozostaje otwarte — bez polegania na werbalnej rekonstrukcji.

Ten standard nie chodzi o perfekcję oprogramowania; chodzi o operacyjną uczciwość: mniej tajemniczych przekazań, mniej prawd godzonych tylko na spotkaniach i więcej dni, w których zapis systemu zgadza się z tym, co powiedziałaby hala, gdybyś zatrzymał ludzi w połowie zadania.

---

*DBR77 IRIS trzyma wspomagane sygnały, zadania, akceptacje i domknięcia w jednej warstwie wykonania, więc metryki executive mapują na pola, nie na opowieści. [Uruchom interaktywne demo](https://dbr77.com/iris) lub [Rozpocznij 14-dniowy trial](https://dbr77.com/demo).*
