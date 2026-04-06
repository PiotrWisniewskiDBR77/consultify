# Jak powinna wyglądać ludzka polityka zatwierdzeń w fabrycznym AI

Docelowa persona: menedżer systemów jakości / plant manager / partner prawny i zgodności  
Etap lejka: Decision  
Główny problem: zespoły polegają na nieformalnych nawykach co do momentu ludzkiego podpisu, co pęka przy zmianie zmiany, urlopach i pytaniach audytowych  
Główna obietnica: szkielet polityki do publikacji: zakres, progi, dowód, eskalacja, zapisy i szkolenie powiązane z przepływu pracy, a nie z nazwami modeli

Ludzka polityka zatwierdzeń dla fabrycznego AI powinna być celowo nudna. Nuda to to, co czyni operacje przewidywalnymi. Powinna określać, które stany przepływ pracy wymagają nazwanego ludzkiego podpisu, jaki dowód musi być widoczny przy podpisie, jak długo akceptacje mogą czekać przed eskalacją, kto pokrywa noce i weekendy oraz jak rejestruje się nadpisania. Powinna odnosić się do ryzyka i odwracalności, ale musi lądować w konkretnych polach przepływ pracy i rolach. Jeśli mówi tylko o „AI”, nie przejdzie audytów ani hali.

Zacznij od zakresu i definicji: które przepływ pracy i lokalizacje są objęte; co w języku zakładu znaczy obserwacja, doradztwo i działanie; które systemy są źródłem prawdy dla zatwierdzeń. Unikaj nazw marketingowych dostawcy w rdzeniu tekstu. Używaj języka przepływ pracy i aktywów, który audytorzy rozpoznają.

Zbuduj macierz zatwierdzeń według stanu przepływu pracy. Puste komórki akceptora to droga do incydentów. Każdy wiersz powinien odpowiadać: jaki tryb jest dozwolony, która ludzka bramka ma zastosowanie i która rola podpisuje.

Wymagaj pakietu dowodowego w momencie akceptacji: użyte pola, flagi niepewności, powiązane przypadki referencyjne jako kontekst (nie jako autorytet), kroki odwracalności i wycofania. Zatwierdzający powinni móc prostym językiem: „Widziałem X, dlatego podpisałem.”

Zdefiniuj eskalację czasową. Ciche timeouty to sposób, w jaki „system zdecydował” staje się plotką. Określ maksymalne oczekiwanie według ważności, kto eskaluje przy przekroczeniu timera i co dzieje się z zachowaniem trybu działania przy zaległości w kolejce.

Uwzględnij delegację: zastępcy nocni, zasady urlopowe, awaryjne zejście tylko do doradztwa z jawnym upoważnieniem. Jeśli pokrycie nie jest zapisane, ludzie obchodzą to wspólnymi loginami — a możliwość śledzenia ginie.

Polityki zwykle padają w weekendy, lukach pokrycia i zaległościach — nie na warsztatach. Testem jest, czy reguła przetrwa nieobecność nocnej zmiany, szybkie opróżnianie kolejki po szczycie i analizę po incydencie bez sześciu sprzecznych historii.

Szkolenie i ponowna certyfikacja należą do polityki: kto musi ukończyć szkolenie przed prawami akceptacji, wyzwalacze corocznego lub po incydencie odświeżenia, jak traktować wykonawców zewnętrznych. Zapisy szkoleń są częścią kontroli, nie ozdobą HR.

**Operacyjny test polityki:** Czy nowy nadzorca znajdzie swoje bramki w poniżej pięciu minutach? Czy jakość wyjaśni politykę bez nazwy dostawcy? Czy IT wygeneruje ślad audytu akceptacji dla losowego tygodnia? Trzy razy tak — jesteś blisko.

IRIS czyni politykę zatwierdzeń egzekwowalną, gdy dowód, timery, podpisy i wynikowe zadania dzielą jeden zapis operacyjny — zamieniając politykę w mechanizm na poziomie hali.

Logikę praw decyzyjnych znajdziesz w [Kiedy AI powinno rekomendować, a kiedy ludzie decydować w operacjach](../26_when_ai_should_recommend_and_when_humans_should_decide_in_operations/article_PL.md), [Kiedy AI powinno obserwować, doradzać czy działać w fabryce](../36_when_ai_should_watch_advise_or_act_in_the_factory/article_PL.md) oraz [Jak rządzić decyzjami AI między zmianami i funkcjami](../37_how_to_govern_ai_decisions_across_shifts_and_functions/article_PL.md).

Pisz akceptacje w języku przepływ pracy z nazwanymi rolami, timerami i dowodem. Jeśli nie da się tego egzekwować na hali, to nie jest polityka.

## Podsumowanie operacyjne

Obietnica tego artykułu — szkielet polityki do publikacji: zakres, progi, dowód, eskalacja, zapisy i szkolenie powiązane z przepływu pracy, a nie z nazwami modeli — staje się operacyjna dopiero wtedy, gdy zmienia się sposób przepływu pracy: wyraźniejsze przypisanie odpowiedzialności, szybsze pierwsze przydzielenie i domknięcie, które da się prześledzić bez archeologii skrzynek. Dla „Jak powinna wyglądać ludzka polityka zatwierdzeń w fabrycznym AI” traktuj to jako test akceptacji: następna zmiana powinna móc odczytać, co się stało, co zatwierdzono i co pozostaje otwarte — bez polegania na werbalnej rekonstrukcji.

Ten standard nie chodzi o idealne oprogramowanie; chodzi o uczciwość operacyjną: mniej tajemniczych przekazań, mniej prawd uzgadnianych tylko na spotkaniach i więcej dni, w których zapis systemu zgadza się z tym, co powiedziałaby hala, gdybyś zatrzymał ludzi w połowie zadania.

Trzymaj zespoły przy prostej zasadzie: jeśli usprawnienia nie widać w eksportach z zapisu wykonania, to jeszcze nie jest usprawnienie operacyjne — tylko narracyjne. Ta zasada utrzymuje programy przy zdrowych zmysłach, gdy demo wygląda dobrze, a przekazania wciąż są kruche.

Jeśli zapis jest chudy, napraw zapis, zanim poszerzysz ambicję.

---

*DBR77 IRIS przechowuje zatwierdzenia, dowód i zadania razem, tak by ludzkie bramki pozostawały możliwe do prześledzenia między zmianami i funkcjami. [Rozpocznij 14-dniowy trial](https://dbr77.com/iris) lub [Obejrzyj walkthrough](https://dbr77.com/demo).*
