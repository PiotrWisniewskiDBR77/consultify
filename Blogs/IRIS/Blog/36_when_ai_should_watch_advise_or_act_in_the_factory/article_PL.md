# Kiedy AI powinno obserwować, doradzać czy działać w fabryce

Docelowa persona: dyrektor operacji / architekt IT-OT / lider jakości i BHP  
Etap lejka: Decision  
Główny problem: zakłady skaczą między „AI nic nie robi” a „AI robi za dużo”, bo nigdy nie publikują trybów operacyjnych powiązanych z progami i rozliczalnością  
Główna obietnica: ramy trzech trybów (obserwacja, doradztwo, działanie) zmapowane na sygnały, odwracalność i ścieżki akceptacji — oddzielnie od ogólnych debat o autonomii

Wybór to nie filozofia. To projektowanie progów zgodne z odpowiedzialnością. AI powinno obserwować, gdy potrzebujesz spójnego wykrywania i logowania bez zmiany obowiązków przepływu pracy. Powinno doradzać, gdy ludzie muszą potwierdzić, zanim zadania, ścieżki eskalacji lub wiadomości staną się wiążące. Powinno działać tylko w wąskich, opublikowanych regułach — ze śladami audytu, ścieżkami wycofania i jawnymi właścicielami wyjątków. To uzupełnia prawa decyzyjne według klasy ryzyka; odpowiada na tryb wdrożenia, a nie tylko na to, kto podpisuje.

Tryb obserwacji oznacza, że AI monitoruje strumienie, taguje anomalie i zapisuje zdarzenia ustrukturyzowane bez tworzenia obowiązków dla innych, dopóki nie zadziała wyzwalacz ludzki lub regułowy. Stosuj go, gdy definicje się jeszcze stabilizują, gdy potrzebujesz bazowych wskaźników fałszywych alarmów albo gdy zaufanie kulturowe jest niskie, a pomiar pilny. Robisz dobrze, gdy katalog zdarzeń jest przeglądany co tydzień, nadzorcy mogą ignorować alerty bez psucia spójności metryk, a szum maleje wraz z dyscypliną kodów przyczyn.

Tryb doradczy oznacza, że AI proponuje uporządkowane działania, szkicuje zadania i sugeruje kierowanie zgłoszeń — nic nie staje się wiążące, dopóki człowiek nie potwierdzi lub druga bramka regułowa nie przejdzie. Stosuj go, gdy potrzeba osądu przy kompromisach międzyfunkcyjnych, gdy podobne przypadki z przeszłości pomagają, ale nie są prawem, albo gdy chcesz prędkości bez cichych zobowiązań. Dowód to mierzony czas od sugestii do akceptacji lub odrzucenia, skategoryzowane nadpisania traktowane jak sygnały uczenia oraz szkice, które skracają pisanie bez pomijania wymaganych pól.

Tryb działania oznacza, że system wykonuje dozwolone operacje automatycznie w ramach limitów: kolejkuje pracę, powiadamia role, eskaluje przy timerach, stosuje nieniszczące kierowanie zgłoszeń. Stosuj go, gdy reguły są częste, nudne, dobrze ograniczone, odwracalność jest szybka, a tryby awarii są zamknięte i widoczne. Zdrowy tryb działania cytuje wersje reguł, kolejkom wyjątków nadaje właścicieli i SLA oraz obejmuje przełączniki pauzy na okna konserwacji i incydenty.

Wybieraj tryby startowe z dyscypliną. Nowe linie lub nowe źródła zaczynają w obserwacji, dopóki definicje trzymają się przez zmiany. Spory o priorytety między zespołami zaczynają w doradztwie, dopóki wzorce akceptacji dają się wyjaśnić. Powtarzalny, powtarzalne kierowanie zgłoszeń przy czystych regułach może przejść w kierunku działania dopiero po tym, jak audyty pozostają czyste przez cykle przeglądu. Zakłady zawodzą, gdy skaczą z obserwacji do działania, bo demo dostawcy wyglądało dobrze.

Dryf trybu jest zwykle operacyjny, a nie techniczny. Zespoły wierzą, że wciąż doradzają, podczas gdy hala traktuje sugestie jako wiążące, bo przeciążenie usuwa uważny przegląd, kolejki wyjątków nie mają właścicieli albo szkic trasy zgłoszenia cicho zachowuje się jak automatyczne zamykanie zgłoszeń. Publikuj dyscyplinę trybu w regułach przepływu pracy — nie w dobrych intencjach.

IRIS nadaje trybom sens, gdy obserwacja, doradztwo i działanie przyczepiają się do zadań, zatwierdzeń, przełączników pauzy i kolejek wyjątków — tak by tryb wdrożenia był widoczny w systemie, a nie pogrzebany w ustawieniach.

Rządy między zmianami i funkcjami wokół trybów opisuje [Jak rządzić decyzjami AI między zmianami i funkcjami](../37_how_to_govern_ai_decisions_across_shifts_and_functions/article_PL.md). Bramki akceptacji — w [Jak powinna wyglądać ludzka polityka zatwierdzeń w fabrycznym AI](../39_what_a_human_approval_policy_should_look_like_in_factory_ai/article_PL.md).

Obserwacja mierzy, doradztwo potwierdza, działanie przestrzega reguł. Publikuj tryb osobno dla każdego przepływu pracy — nie „per” komunikat prasowy.

## Podsumowanie operacyjne

Obietnica tego artykułu — ramy trzech trybów (obserwacja, doradztwo, działanie) zmapowane na sygnały, odwracalność i ścieżki akceptacji, oddzielnie od ogólnych debat o autonomii — staje się operacyjna dopiero wtedy, gdy zmienia się sposób przepływu pracy: wyraźniejsze przypisanie odpowiedzialności, szybsze pierwsze przydzielenie i domknięcie, które da się prześledzić bez archeologii skrzynek. Dla „Kiedy AI powinno obserwować, doradzać czy działać w fabryce” traktuj to jako test akceptacji: następna zmiana powinna móc odczytać, co się stało, co zatwierdzono i co pozostaje otwarte — bez polegania na werbalnej rekonstrukcji.

Trzymaj zespoły przy prostej zasadzie: jeśli usprawnienia nie widać w eksportach z zapisu wykonania, to jeszcze nie jest usprawnienie operacyjne — tylko narracyjne. Ta zasada utrzymuje programy przy zdrowych zmysłach, gdy demo wygląda dobrze, a przekazania wciąż są kruche.

Jeśli zapis jest chudy, napraw zapis, zanim poszerzysz ambicję.

---

*DBR77 IRIS wiąże zachowania obserwacji, doradztwa i działania ze stanami przepływu pracy, zadaniami i zatwierdzeniami, tak by tryby były egzekwowalne, a nie retoryczne. [Rozpocznij 14-dniowy trial](https://dbr77.com/iris) lub [Uruchom interaktywne demo](https://dbr77.com/demo).*
