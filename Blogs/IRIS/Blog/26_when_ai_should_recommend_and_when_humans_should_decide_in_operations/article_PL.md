# Kiedy AI powinno rekomendować, a kiedy ludzie powinni decydować w operacjach

Docelowa persona: Dyrektor jakości / Dyrektor operacji / Menedżer inżynierii  
Etap lejka: Decision  
Główny problem: zakłady albo nadmiernie ufają modelom, albo całkiem banują AI, bo brakuje prostej mapy praw decyzyjnych powiązanej z ryzykiem, identyfikowalnością i rozliczalnością  
Główna obietnica: jasny framework praw decyzyjnych oparty na klasie ryzyka, odwracalności i ekspozycji regulacyjnej oraz sposób wdrożenia go jako progów akceptacji w przepływie pracy

AI powinno domyślnie rekomendować, gdy kontekst jest dwuznaczny, kompromisy przecinają funkcje albo ekspozycja na bezpieczeństwo i jakość jest istotna. Ludzie powinni decydować, gdy działanie jest trudne do cofnięcia, wywołuje obowiązek dokumentacji regulacyjnej lub przekracza uzgodniony próg ryzyka — nawet jeśli model wygląda na pewnego. To nie brak zaufania do AI. To dopasowanie praw decyzyjnych do rozliczalności w środowiskach, gdzie „działaj szybko i przepraszaj” nie jest akceptowalną zasadą operacyjną.

W zdrowych programach przemysłowych AI zachowuje się jak silna funkcja sztabowa: przygotowuje opcje, podświetla ograniczenia, wyciąga historię. Ludzie zachowują autorytet tam, gdzie organizacja ponosi odpowiedzialność. Ten podział pozwala adopcji przetrwać pierwszy kontakt z audytami, klientami i presją nocnej zmiany.

Klasa ryzyka to tępy, ale użyteczny obiektyw. Praca niskiego ryzyka — kategoryzacja szumu, szkice notatek wewnętrznych — często może być swobodnie wspomagana. Praca średniego ryzyka — sugerowane pasma priorytetu, proponowany przydział zadań — zwykle należy do wzorca rekomenduj-i-potwierdź. Praca wysokiego ryzyka — zwolnienia zmieniające stan jakości widoczny dla klienta, działania zbliżające się do intencji blokady — zwykle wymaga jawnego decydowania ludzkiego z dowodem. Działania krytyczne — nadpisania bezpieczeństwa, podpisy wysyłki do klienta — powinny pozostać prowadzone przez ludzi z formalnymi zapisami, przy AI wspierającym dowód, nie posiadającym „stempla”.

Odwracalność ostrzy ten sam obraz. Łatwo odwracalne ruchy — przestawianie zadań nienaruszających chronionych stanów, przepisywanie pozycji pracy — mogą tolerować szybsze pętle. Powolne lub kosztowne cofnięcia — dysponowanie scrapu, duże zmiany prędkości linii, działania uruchamiające zobowiązania kapitałowe lub wobec klienta — powinny zaciskać bramki ludzkie nawet wtedy, gdy model brzmi pewnie.

Filozofia staje się operacyjna dopiero, gdy staje się progami. Opublikuj reguły, które operator rozpozna: wyniki ciężkości wymuszające potwierdzenie przełożonego, chronione pola wymagające akceptacji opartej na roli, obiekty regulowane wymagające audytowalnych kroków ludzkich. Progi powinny być widoczne na hali — nie chowane w kodzie modelu, którego nikt nie potrafi wyjaśnić przy presji.

Modele mieszane pękają, gdy AI rekomenduje w jednym narzędziu, ludzie decydują w drugim, a ślad audytu się rozdziela. Rekord decyzji powinien żyć z pozycją pracy, bo to pozycja pracy jest tym, czym zakład będzie się bronił jutro.

Szkolenie powinno obejmować odmowę, nie tylko akceptację. Zespoły powinny ćwiczyć szybką akceptację dobrej rekomendacji, odrzucenie z kodem przyczyny i eskalację, gdy brakuje kontekstu. Kody przyczyn to sposób, by zakład się uczył bez zamieniania nadpisań w wstyd — ani w niewidzialny bunt.

IRIS ma znaczenie, bo rekomendacja, akceptacja, odrzucenie i ślad audytu powinny żyć w jednej nadzorowanej historii przepływu pracy. To czyni prawa decyzyjne możliwymi do inspekcji na poziomie operatora zamiast rozpuszczać się w tekście polityki, którego nikt nie stosuje, gdy linia jest rozgrzana.

O zakresie agenta zobacz [Co agent AI może dziś zrobić w fabryce](../22_what_an_ai_agent_can_do_in_a_factory_today/article_PL.md). O kryteriach zaufania dla liderów zobacz [Co sprawia, że fabryczne AI jest godne zaufania dla liderów operacji](../29_what_makes_factory_ai_trustworthy_for_operations_leaders/article_PL.md).

Właściwy podział to nie „AI kontra ludzie”. To „rekomendacja kontra decyzja”, zmapowane na ryzyko, odwracalność i nadzór. Zrób to mapowanie jawnie — albo zakład zrobi je nieformalnie na korytarzu, gdzie nikt nie zaudytuje wyniku.

## Podsumowanie operacyjne

Obietnica tego artykułu — jasny framework praw decyzyjnych z klasy ryzyka, odwracalności i ekspozycji regulacyjnej plus wdrożenie jako progi akceptacji w przepływie pracy — staje się operacyjna dopiero wtedy, gdy zmienia się sposób przepływu pracy: wyraźniejsze przypisanie odpowiedzialności, szybsze pierwsze przydzielenie i domknięcie możliwe do prześledzenia bez archeologii skrzynek. Dla „Kiedy AI powinno rekomendować, a kiedy ludzie powinni decydować w operacjach” traktuj to jako test akceptacji: następna zmiana powinna móc odczytać, co się stało, co zostało zatwierdzone i co pozostaje otwarte — bez polegania na werbalnej rekonstrukcji.

Trzymaj zespoły przy prostej regule: jeśli usprawnienia nie da się pokazać w eksportach z rekordu wykonania, to jeszcze nie usprawnienie operacyjne — tylko narracyjne. Ta regula utrzymuje programy w rzetelności, gdy demo wygląda dobrze, a przekazania wciąż są kruche.

Jeśli rekord jest ubogi, napraw rekord, zanim poszerzysz ambicję.

---

*DBR77 IRIS utrzymuje rekomendacje, decyzje ludzkie i ślady audytu przy tych samych pozycjach pracy przez produkcję, magazyn, jakość, utrzymanie ruchu i tasking. [Uruchom interaktywne demo](https://dbr77.com/iris) lub [Obejrzyj walkthrough](https://dbr77.com/demo).*
