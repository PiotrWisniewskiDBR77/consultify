# Teresa — pomiar 16 modułów

| # | Moduł | Trasa | Wejście | Język | used_sources | UnifiedChatPanel DOM | Błędy konsoli | Stan | Odpowiedź / blokada |
|---:|---|---|---|---:|---:|---:|---:|---|---|
| 1 | Czat | `/chat` | Czat główny | pl | 12 | 1 | 0 | PASS | Widzimy, Å¼e Novatek Manufacturing Sp. z o.o. dziaÅ‚a w branÅ¼y produkcji dyskretnej, ma 620 pracownikÃ³w oraz przychÃ³d wynoszÄ…cy â‚¬120M. Firma jest na podstawowym poziomie dojrzaÅ‚oÅ›ci PMO. Obecn |
| 2 | Moja Praca | `/my-work` | Teresa | pl | 12 | 1 | 0 | PASS | Novatek Manufacturing Sp. z o.o. to firma z branÅ¼y produkcyjnej, dziaÅ‚ajÄ…ca na rynku mid-market z przychodem â‚¬120M i zatrudniajÄ…ca 620 pracownikÃ³w. Organizacja ma dojrzaÅ‚oÅ›Ä‡ PMO na poziomie  |
| 3 | Wywiad | `/interview` | Teresa | pl | 12 | 1 | 0 | PASS | WidzÄ™, Å¼e organizacja Novatek Manufacturing Sp. z o.o. ma kilka aktywnych projektÃ³w, w tym trzy inicjatywy w fazie realizacji: robotyzacja gniazda spawalniczego, system wizyjny kontroli jakoÅ›ci i  |
| 4 | Narzędzia | `/discovery-tools` | Teresa | pl | 12 | 1 | 0 | PASS | Na podstawie dostÄ™pnych danych, Novatek Manufacturing Sp. z o.o. to firma z branÅ¼y produkcyjnej, dziaÅ‚ajÄ…ca w segmencie mid-market, z przychodem w wysokoÅ›ci 120 milionÃ³w euro i zatrudniajÄ…ca 62 |
| 5 | Ocena | `/assessment?tab=library` | Teresa | pl | 12 | 1 | 0 | PASS | WidzÄ™, Å¼e Novatek Manufacturing Sp. z o.o. to firma dziaÅ‚ajÄ…ca w branÅ¼y produkcji dyskretnej, zatrudniajÄ…ca 620 pracownikÃ³w z przychodem na poziomie 120 milionÃ³w euro. Firma realizuje obecnie  |
| 6 | Inicjatywy | `/initiatives` | Teresa | pl | 12 | 1 | 0 | PASS | Oto kluczowe informacje dotyczÄ…ce organizacji Novatek Manufacturing Sp. z o.o.: 1. **BranÅ¼a**: PrzemysÅ‚ wytwÃ³rczy (Manufacturing, Discrete). 2. **Skala**: Åšrednia firma z 620 pracownikami i rocz |
| 7 | Realizacja | `/execution?tab=list&view=table` | Teresa | pl | 12 | 1 | 0 | PASS | W kontekÅ›cie organizacji Novatek Manufacturing Sp. z o.o., oto kluczowe informacje: 1. **Inicjatywy:** - Organizacja prowadzi kilka aktywnych inicjatyw takich jak: Robotyzacja gniazda spawalnicz |
| 8 | Wyniki | `/results/kpi` | /^(Teresa\|Zapytaj Teresę)/ | — | 0 | 0 | 3 | FAIL | brak wejścia Teresy |
| 9 | Finanse | `/finance?tab=statements` | AI | — | 0 | 0 | 0 | FAIL | [2mexpect([22m[31mlocator[39m[2m).[22mtoBeVisible[2m([22m[2m)[22m failed |
| 10 | Materiały | `/presentations` | Teresa | pl | 12 | 1 | 0 | PASS | Obecnie pracujesz nad kilkoma zadaniami zwiÄ…zanymi z projektem DBR77, w tym przeglÄ…dem wydajnoÅ›ci oraz mapowaniem zaleÅ¼noÅ›ci i ryzyk wdroÅ¼enia. Masz rÃ³wnieÅ¼ kilka inicjatyw w fazie realizacji, |
| 11 | Audyty | `/audit-programs?tab=library` | Teresa | pl | 12 | 1 | 0 | PASS | Aktualnie Novatek Manufacturing Sp. z o.o. realizuje kilka inicjatyw, z ktÃ³rych trzy sÄ… w trakcie wykonania: **Robotyzacja gniazda spawalniczego**, **System wizyjny kontroli jakoÅ›ci** oraz **Automa |
| 12 | Spotkania | `/meetings` | Teresa | pl | 12 | 1 | 0 | PASS | Novatek Manufacturing Sp. z o.o. to firma z branÅ¼y produkcji dyskretnej o Å›redniej wielkoÅ›ci z przychodami wynoszÄ…cymi â‚¬120M i zatrudnieniu 620 pracownikÃ³w. Obecnie trwajÄ… dwie aktywne inicjat |
| 13 | Administracja | `/admin/team/members` | /^(Teresa\|Zapytaj Teresę)/ | — | 0 | 0 | 0 | FAIL | brak wejścia, poza MVP |
| 14 | Ustawienia | `/settings/profile` | /^(Teresa\|Zapytaj Teresę)/ | — | 0 | 0 | 0 | FAIL | brak wejścia, poza MVP |
| 15 | Organizacja | `/organization/profile/identity-scale` | Zapytaj Teresę o kontekst organizacji | pl | 12 | 1 | 0 | PASS | Novatek Manufacturing Sp. z o.o. jest Å›redniej wielkoÅ›ci firmÄ… produkcyjnÄ… z 620 pracownikami i przychodem â‚¬120M. Obecnie prowadzi kilka inicjatyw w fazie realizacji, w tym robotyzacjÄ™ gniazda  |
| 16 | Partner | `/partner?tab=partner-home` | /^(Teresa\|Zapytaj Teresę)/ | — | 0 | 0 | 0 | FAIL | brak wejścia, poza MVP |
