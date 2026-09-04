# Dyżur 335 — pakiet przelotu właściciela dla kubełka C

Warunek wejścia: staging ma wskazywać dokładny odebrany kandydat SHA, a właściciel wybiera **realny rekord widoczny na liście**, utworzony w zwykłej pracy i rozpoznawalny po nazwie, dacie oraz właścicielu. Fikstura pokazowa nie liczy się.

## Procedura wspólna

1. Otwórz moduł z menu i wskaż SHA runtime z `/api/health`.
2. Wybierz realny rekord z listy; zanotuj jego nazwę/ID bez danych wrażliwych.
3. Otwórz preview/szczegóły, użyj nawigacji NModeLeftNav i HelpButton.
4. Otwórz co najmniej jeden formularz zawierający Select, MultiSelect, DatePicker lub PriorityPicker, jeśli moduł go udostępnia.
5. Powtórz PL i EN oraz jasny i ciemny motyw; wymuś legalny stan błędu/pusty bez kasowania danych.
6. Odpowiedz TAK/NIE dla sygnałów porażki z tabeli.

| Moduł | Realny rekord do rozpoznania | Co sprawdzić | Sygnał porażki TAK/NIE |
| --- | --- | --- | --- |
| 01 Organizacja | aktywna osoba lub jednostka z listy, nazwa i rola | preview, Help, etykiety PL/EN | cudza organizacja/dane albo niespójna etykieta? |
| 02 Interview | rozmowa z realnym respondentem i datą | NModeLeftNav, akcje preview, DatePicker | akcja dotyczy innej rozmowy albo fokus ginie? |
| 03 Tools | używane narzędzie z realnym wynikiem | wizard, Select/MultiSelect, ErrorState | krok/wybór znika lub błąd nie daje dalszej akcji? |
| 04 Assessment | realna ocena z odpowiedziami | wynik, szczegóły, PL/EN | wynik/odpowiedzi różnią się od listy? |
| 05 Initiatives | aktywna inicjatywa z właścicielem | preview, priorytet, termin | zapis/odczyt pokazuje inny rekord lub starą wartość? |
| 06 Execution | realny case wykonawczy z zadaniami | dropdown, relacje, statusy | lista rozwijana pokazuje obcy/nieistniejący element? |
| 07 My Work | realny wpis pracy/notatka | NModeLeftNav, akcje, stan błędu | zapis/preview traci kontekst rekordu? |
| 08 Meetings | realne spotkanie z datą i uczestnikami | DatePicker, preview, Help | uczestnicy/data zmieniają znaczenie lub organizację? |
| 09 Results | realny raport/KPI z okresem | preview, ErrorState, PL/EN | okres/wartość nie zgadza się z listą? |
| 10 Finance | realny rekord finansowy z okresem | tabela, preview, format liczb | waluta/okres/wartość jest inna lub niezrozumiała? |
| 11 Materials | realny deck/workbook/dokument | otwarcie, edycja kontrolna, readback | po odświeżeniu brak zapisanej kontrolnej zmiany? |
| 12 Audits | realny audyt z kryteriami | preview, formularze, fokus | kryterium/ocena należy do innego audytu? |
| 13 Chat | realna rozmowa powiązana z rekordem | NModeLeftNav, draft modal, kontekst | odpowiedź lub panel wskazuje inny rekord? |
| 14 Admin | realny użytkownik/usługa z listy | preview, Help, legalny ErrorState | odsłonięto dane innej organizacji lub surowy błąd? |
| 15 Settings | realna konfiguracja organizacji | formularze, PL/EN, readback | wartość po bezpiecznym zapisie/odczycie jest inna? |
| 16 Partner | realny partner z listy, nazwa i status | preview, relacje, PL/EN | widoczny cudzy partner albo status nie zgadza się z listą? |

## Trzy grupy mianowników

- 141 plików: moduły 01 i 08 — dodatkowo sprawdzić logowanie/membership i trasy zależne od middleware.
- 125 plików: 02, 03, 04, 05, 07, 12, 13, 14, 15 — nacisk na NModeLeftNav, formularze i zmienione trasy.
- 123 pliki: 06, 09, 10, 11, 16 — nacisk na HelpButton, ErrorState, formularze, treść dropdownów i odczyt realnego rekordu.

## Granica

Pakiet nie dowodzi izolacji wszystkich tras, poprawności wszystkich 104 plików ani kompletności tłumaczeń. Nie zastępuje automatycznych testów RealPG, audytu bezpieczeństwa, testu eksportów ani odbioru innego SHA. Wynik bez zanotowanego realnego rekordu i dokładnego SHA runtime pozostaje `OWNER_RETEST_PENDING`.
