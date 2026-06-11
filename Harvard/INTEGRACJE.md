# INTEGRACJE — mapa połączeń międzymodułowych (wynik Kroku 6)

**Status: SZKIELET — wypełniany w Kroku 6 sekwencji** (po komplecie audytów). Źródło danych: sekcje **1g** wszystkich 28 kart + weryfikacja każdego przepływu end-to-end (FE i BE).

## Jak wypełniać (instrukcja Kroku 6)
1. Zbierz wszystkie wiersze 1g z 28 kart do tabeli zbiorczej (poniżej, sekcja A).
2. Sparuj WYJŚCIA z WEJŚCIAMI (każde wyjście modułu X musi mieć odbiorcę w module Y — wiersz bez pary = przepływ urwany).
3. Dla każdego przepływu: zweryfikuj OBYDWA końce w kodzie (nadawca wysyła to, co odbiorca czyta — kontrakt!) + przejdź żywo, jeśli przepływ ma UI.
4. Braki/zepsucia → dopisz do planu dokończenia WŁAŚCIWEGO modułu (sekcja 7 karty) z tagiem `[INTEGRACJA]`.
5. Wynik: sekcja B (przepływy kanoniczne) kompletna ze statusami; to jest też lista scenariuszy dla systemu testów w Kroku 8.

## A. Tabela zbiorcza połączeń (z kart 1g)
| Z modułu | Do modułu | Mechanizm | Kontrakt (co przechodzi) | Status FE | Status BE | Dowód |
|---|---|---|---|---|---|---|
| *(wypełnić w Kroku 6)* | | | | | | |

## B. Przepływy kanoniczne do zweryfikowania (lista startowa — uzupełnić z 1g)
Znane z Mapy V2 i inwentarzy; każdy dostaje werdykt PEŁNY / URWANY / STUB:

1. **Czat → intent → Canvas (deck/doc/sheet) → chip w transkrypcie → registry → Outputs** (M01→M02→M17)
2. **Czat → intercepty → Ideas tools (mindmap/flow/whiteboard) / Tabele / Studia** (M01→M06/M07/M09/M20/M18/M19)
3. **Canvas → promote → Pomysł / Notatka / Inicjatywa / Decyzja / Zadanie** (M02→M05/M04/M13/M03)
4. **Wywiad → wnioski → generator inicjatyw → Inicjatywy → Wdrożenie → Rezultaty (KPI/ROI)** (M10→M13→M14→M15)
5. **Narzędzia/Assessment → outputs/inicjatywy** (M11→M17/M13)
6. **Audyty → fan-out przydziałów wywiadów → Inbox wykonawców** (M12→M10→M03)
7. **Notatnik → konwersje (inicjatywa/raport/prezentacja; checklista→zadania; strona→Canvas)** (M04→M13/M17/M19/M03/M02)
8. **Ideas → convert (6 targetów) + ekspansje → Outputs/Inicjatywy/Czat zespołowy** (M05→M13/M17/M01)
9. **Tabele Studio ↔ governed models → publish-to-Results / sync-to-Finance / execution** (M20→M15/M16/M14)
10. **Outputs ↔ studia (open path, save-as-template, eksporty za aprobatą)** (M17↔M18/M19/M20)
11. **Meeting → decyzje/akcje → Decyzje/Zadania w My Work** (M21→M03)
12. **Kalendarz ← źródła: zadania/inicjatywy/decyzje/Google/Outlook** (M03← M13/M14 + integracje)
13. **Organizacja (profil/kontekst) → kontekst Teresy we wszystkich modułach** (M23→M01/M02/generatory)
14. **Finanse ↔ Inicjatywy (financial impact, ROI `/roi`)** (M16↔M13)
15. **Beta/uprawnienia: betaAccess + ProtectedRoute + API-gating — spójność trzech warstw w całej aplikacji** (przekrojowe)
16. **Konwersacje: kontekst encji (useOpenChatWithContext) z każdego modułu → czat split** (wszystkie→M01)

## C. Werdykt końcowy Kroku 6
*(po wypełnieniu: ile przepływów PEŁNYCH / URWANYCH / STUB; lista poprawek dopisanych do planów; potwierdzenie „dokumentacja idealnie kompletna")*
