# Jak zaprojektować model obsługi wyjątków dla operacji wspomaganych AI

Docelowa persona: architekt operacji / lider inżynierii zakładu / właściciel systemów jakości  
Etap lejka: Consideration  
Główny problem: asystencja AI zwiększa wolumen zdarzeń, ale zakłady wciąż kierują wyjątki przez nieformalne czaty, więc własność reakcji i pętle domknięcia pozostają niejasne  
Główna obietnica: zwarty model wyjątków z typowanymi ścieżkami, progami, zatwierdzeniami i polami audytu, które nadzorcy utrzymają pod obciążeniem

Operacje wspomagane zwykle nie padają dlatego, że model jest zły pierwszego dnia. Padają dlatego, że wyjątki stają się drugim, cieniem procesu — szybkie sygnały bez dopasowanej ścieżki wykonania, przypadki graniczne, które ludzie kiedyś po cichu absorbowali, oraz wolumen zamieniający się w telefony, bo oficjalny model nigdy nie przewidział piątego pasa. Projektuj wyjątki celowo — inaczej zaprojektuje je hala dla ciebie.

Gdy asystencja wchodzi na żywo, spodziewaj się więcej kandydatów do zadań, więcej sporów tuż przy progach i więcej tras „prawie automatycznych”, które potrzebują ludzkiej pieczęci. Jeśli nie zaprojektujesz warstwy wyjątków, nieformalne kanały staną się prawdziwym systemem.

Wykonalny model klasyfikuje wyniki asysty do małej liczby ścieżek. Auto-zadanie w opublikowanych progach tworzy zadanie z wersją reguły i znacznikiem czasu oraz zamyka się ukończoną pracą lub zweryfikowanym stanem. Sygnały tylko doradcze wymagają przejęcia przez człowieka, z jawnym odrzuceniem lub konwersją na zadanie także przy odrzuceniu. Ścieżki eskalacji stosują się, gdy pojawia się ryzyko SLA, BHP, blokady jakości lub konflikt międzyfunkcyjny — każda z właścicielem poziomu i terminem. Twarde stopery obowiązują przy blokadach regulacyjnych, ograniczeniach klienta lub niedojrzałych danych — wymagają ról akceptacji, powiązań dowodu i kryteriów zwolnienia. Jeśli w praktyce pojawia się piąta ścieżka („po prostu zapytaj inżyniera”), model jest niekompletny.

Przed startem zdefiniuj taksonomię wyjątków, macierz własności według zmiany, czasową drabinę eskalacji, reguły akceptacji z pokryciem zastępców, pola przekazania, które następna zmiana musi widzieć w systemie, hak wycofania, który wstrzymuje asystowane kierowanie zgłoszeń bez utraty historii audytu oraz pętlę po incydencie wymuszającą aktualizację progów lub szkoleń, gdy wzorce się powtarzają.

Kultura zgłoszeń loguje aktywność. Kultura domknięcia kończy stany operacyjne. Asystencja AI wzmacnia kulturę zgłoszeń, chyba że zadania wiążą się ze skutkami: czas do właściciela, czas do domknięcia oraz dowód, że linia jest bezpieczna, uporządkowana i udokumentowana.

Wdrażaj spokojnie: taguj wyjątki w cieniu bez automatycznego zamykania zgłoszeń, przeglądaj cotygodniowe tematy, publikuj wersję pierwszą tylko dla kilku przepływów pracy, mierz czas do właściciela i powtarzające się eskalacje, wersjonuj podręcznik reguł, gdy progi się przesuwają.

IRIS pasuje do warstwy wyjątków, gdy asystencja, zadania, zatwierdzenia i dowód domknięcia dzielą jeden zapis wykonania — zamieniając projekt wyjątków w kontrakt operacyjny zamiast archeologii czatu.

Sąsiednie utwardzenia: [Kiedy fabryka potrzebuje jednego operacyjnego arbitra przy sprzecznych sygnałach](../42_when_a_factory_needs_one_operational_arbiter_for_conflicting_signals/article_PL.md), [Jak tworzyć zapisy gotowe pod audyt dla fabrycznych decyzji wspomaganych AI](../46_how_to_create_audit_ready_records_for_ai_assisted_factory_decisions/article_PL.md) oraz [Jak powinno wyglądać pełne operacyjne domknięcie w fabryce AI-native](../50_what_full_operational_closure_should_look_like_in_an_ai_native_factory/article_PL.md).

Wolumen wyjątków to też diagnostyka. Jeśli wyjątki grupują się wokół brakujących pól, intake jest niedojrzały. Jeśli wokół konfliktów polityki, definicje są niewspółliniowe. Jeśli wokół pokrycia nocnej zmiany, model akceptacji jest nierealny. Dobry model wyjątków to nie tylko mechanizm eskalacji; to czujnik mówiący kierownictwu, gdzie system operacyjny wciąż jest kruchy — zanim kruchość stanie się przestojem.

Nadzorcy przyjmą ścieżki wyjątków tylko wtedy, gdy są szybsze niż nieformalna ścieżka. To znaczy, że ramy czasowe muszą być prawdziwe, właściciele osiągalni, a eskalacja musi przynosić ulgę — nie kolejną pętlę. Jeśli oficjalna ścieżka wyjątku jest wolniejsza niż telefon do ulubionego inżyniera, inżynier staje się systemem. Projektuj pod tę konkurencyjną rzeczywistość.

Projekt wyjątków to projekt własności. Nazwij responderów, ramy czasowe i pola domknięcia — wtedy zakład może wchłonąć wyższy wolumen asysty bez utraty kontroli.

## Podsumowanie operacyjne

Obietnica tego artykułu — zwarty model wyjątków z typowanymi ścieżkami, progami, zatwierdzeniami i polami audytu, które nadzorcy utrzymają pod obciążeniem — staje się operacyjna dopiero wtedy, gdy zmienia się sposób przepływu pracy: wyraźniejsze przypisanie odpowiedzialności, szybsze pierwsze przydzielenie i domknięcie, które da się prześledzić bez archeologii skrzynek. Dla „Jak zaprojektować model obsługi wyjątków dla operacji wspomaganych AI” traktuj to jako test akceptacji: następna zmiana powinna móc odczytać, co się stało, co zatwierdzono i co pozostaje otwarte — bez polegania na werbalnej rekonstrukcji.

Ten standard nie chodzi o idealne oprogramowanie; chodzi o uczciwość operacyjną: mniej tajemniczych przekazań, mniej prawd uzgadnianych tylko na spotkaniach i więcej dni, w których zapis systemu zgadza się z tym, co powiedziałaby hala, gdybyś zatrzymał ludzi w połowie zadania.

---

*DBR77 IRIS trzyma asystencję, zadania, zatwierdzenia i wyjątki na jednym zapisie wykonania, tak by ścieżki i własność pozostawały widoczne między zmianami. [Uruchom interaktywne demo](https://dbr77.com/iris) lub [Rozpocznij 14-dniowy trial](https://dbr77.com/demo).*
