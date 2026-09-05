# Odbiór na żywo — pakiet 03-wywiad (moduł Wywiad)

Zgodne: 2 / Różnią się: 0 / Nie dotarłem: 4 (razem 6)

## Różnice
Brak.

## Nie dotarłem (powód)
- **interview-creator-shell** — ekran za flagą domyślnie wyłączoną (`ff.interview_creator_shell`), zgodnie z zasadą zakazu włączania flag wizualnych bez procedury akceptu nie włączono jej; "gdzie" samo mówi, że dziś w aplikacji jest starsza wersja formularza.
- **unified-create-launcher** — zbudowane, ale niepodłączone: komponent `UnifiedCreateLauncher` istnieje (flaga domyślnie ON), ale grep całego `src/` pokazuje zero miejsc, które go renderują. Przyciski "Nowa decyzja" i "New initiative" pomijają go i otwierają bezpośrednio własne formularze/moda... (skrót z powodu limitu znaków, pełny opis w wyniki.json).
- **drd-http-workspace** — ekran jawnie opisany w "gdzie" jako niedostępny dziś (flaga `drdHttpSourceOfTruthV1` domyślnie wyłączona).
- **karta-interview** — właściwy komponent (`InterviewWorkspace.tsx`) potwierdzony w kodzie, ale próba otwarcia najbliższego pasującego rekordu danych ("Ocena Dojrzałości Cyfrowej", szablon typu DRD) kończy się realnym błędem konsoli "Nie udało się wczytać sesji" (InterviewHub.tsx:6353), powtórzonym dwukrotnie. Inne sesje otwierają się, ale w uproszczonym trybie bez lewego menu z obrazu.

## Czas i trudności
- W trakcie pracy sesja logowania automatu (`ODBIOR_AUTH_STATE`) wygasła na około 5 minut (przekierowanie na `/login` przy każdej próbie nawigacji) — odczekano, plik auth.json odświeżył się samoczynnie (nowy zapis o 07:42), praca wznowiona bez logowania się samodzielnie.
- Duże obciążenie serwera równoległymi sesjami odbioru innych pakietów powodowało sporadyczne timeouty nawigacji i przełączanie języka UI PL/EN.
- Weryfikacja `unified-create-launcher` i `karta-interview` wymagała czytania kodu źródłowego (`grep`), bo same klikanie w UI nie dawało jednoznacznej odpowiedzi — zgodnie z zasadą "weryfikuj realny runtime, nie flagi/docy".
- Sesja zajęła około 45 minut.
