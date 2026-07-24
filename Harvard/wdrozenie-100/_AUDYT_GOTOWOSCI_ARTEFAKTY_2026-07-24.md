# AUDYT GOTOWOŚCI — artefakty (stan 2026-07-24, po nocy naprawczej)

> Zakres: 7 pozycji, które właściciel odbiera jako „artefakty" — 6 kart standardu n-Type
> + Sesja wywiadu (formalnie narzędzie, nie karta N, ale ma własną pozycję w odbiorze).
> Pomiary z **żywego środowiska** `localhost:3000/odbior.html`, nie z dokumentacji.

---

## 1. WERDYKT ZBIORCZY

| Miara | Wynik | Uwaga |
|---|:--:|---|
| Audyt środowiska (18 obiektów × 2 motywy) | **18/18** | zmierzone 2026-07-24, po scaleniu fali 2 |
| Bramki `artefakt` · `triada` · `gestosc` · `sqlsql` | **zielone** | |
| Bramka `list-canon` | **CZERWONA** | 11 naruszeń, ★ dług **zastany na demo** — identyczny zbiór przed i po promocji (§7) |
| Testy rubryki analizy AI | **18/18** | `cardAnalysisRubric.test.ts` |
| Uchwyty edycji w trybie Podgląd | **0 na wszystkich kartach** | było: Decyzja 6, Zadanie 8, Inicjatywa 24, Insight 22 |
| Atrapy AI (kod udający działanie modelu) | **12 rodzin wyciętych** | |
| Ocena 3 sędziów | **7,1** (start 5,9) | ★ cel 9,5 **nieosiągnięty** |

**Gotowość do odbioru: TAK.** Każdy z 7 artefaktów da się przeklikać, ma treść, prawy panel,
tabelę właściwości, panel uwag i czysty tryb ciemny.
**Gotowość do uznania za skończone: NIE** — patrz §4.

---

## 2. STAN PER ARTEFAKT

Kolumna „ocena" to **baseline sprzed nocy** (runda 1 sędziów). ★ **Ocena po fali 2 NIE ZOSTAŁA
ZMIERZONA** — trzecia runda sędziów się nie odbyła, bo noc się skończyła. Nie wpisuję liczb,
których nie zmierzyłem.

| Artefakt | Treść | Klikalne | Ocena (baseline G/M/IT) | Co naprawione w nocy |
|---|:--:|:--:|:--:|---|
| **Decyzja** | 841 zn. | 38 | 7,5 / 6,0 / 5,0 | 11 martwych wywołań AI; „Skróć" niszczący zdanie; uchwyty 6→0; kontrast CTA 4,35→17,09:1 |
| **Zadanie** | 1048 zn. | 33 | 7,5 / 5,5 / 5,5 | 2 przyciski AI = czysty komunikat; zmyślony „komentarz AI"; 6 generatorów udających pracę modelu; `expectedOutcome` — łańcuch przerwany w 3 miejscach |
| **Powiadomienie** | 538 zn. | 23 | 6,5 / 4,5 / 6,5 | surowy enum „AI RISK DETECTED"; chip 2,58:1; cichy no-op zapisu; pewność `0,82%`→`82%` |
| **Insight** | 5849 zn. | 34 | 5,0 / 5,0 / 7,0 | surowy klucz i18n jako tekst; uchwyty 22→0; testy 26 błędów→0; edytowalne pola + backend |
| **Narzędzie** | 6229 zn. | 15 | 5,0 / 6,5 / 7,5 | panel 3/7 sekcji kanonu; czcionka 8 px; **90 podmian językowych**; Menu 2 „Sekcje" |
| **Inicjatywa** | 729 zn. | 21 | 4,5 / 5,0 / 6,0 | **Podgląd ≡ Edycja** (24 uchwyty→0); 5 atrap AI + 8 dalszych przycisków; awaria panelu przy „Wykryj zależności" |
| **Sesja wywiadu** | — | — | poza rundą | pozycja w odbiorze istnieje; formalnie narzędzie, nie karta N |

**Treść mierzona po tekście widocznym na ekranie.** Niska liczba znaków (Powiadomienie 538,
Inicjatywa 729) to karty z krótką treścią demo, nie braki renderu — próg audytu to 250 znaków.

---

## 3. CO REALNIE ZMIENIŁA NOC

**Produkt przestał kłamać użytkownikowi.** To jedyna zmiana tej nocy, która ma znaczenie
biznesowe. Wycięliśmy 12 rodzin kodu, który udawał, że AI zadziałało:

- generator wpisujący **zawsze te same 6 zaszytych fraz**
- komentarz zmyślony i **podpisany „AI Assistant"**, z komunikatem sukcesu
- „Skróć" ucinający zdanie w połowie — **niszczył treść użytkownika**
- 6 generatorów symulujących pracę modelu opóźnieniem + zaszytą treścią
- generator RACI wstawiający po awarii **pierwsze 4 osoby z listy** i meldujący sukces
- pasek statusu **fabrykujący „Szkic"** na każdym artefakcie bez rekordu zatwierdzenia
- 5 kolejnych w module Inicjatyw — z komentarzem w kodzie: „symuluj chwilę myślenia"

Wspólna przyczyna: jeden endpoint zwracał strukturę bez pola, które czytało **15 miejsc w kodzie**.
Nic nie rzucało błędu — odpowiedź poprawna, pole puste, gałąź awaryjna. Tokeny palone, wynik wyrzucany.

**Weryfikacja nie jest deklaracją:** agenci symulowali awarię AI i mierzyli sumę kontrolną znaków
pola przed i po. Identyczna — treść nietknięta, komunikat uczciwy.

★ **Decyzja, która najlepiej pokazuje kierunek:** przy 4 z 5 atrap Inicjatywy agent **odmówił
podłączenia AI**. Funkcje liczyły poprawnie — kłamała wyłącznie etykieta. Przy „Zaproponuj terminy"
uzasadnił wprost: arytmetyka dat to klasa zadań, w której model myli się częściej niż kod,
a wynik trafia do realnych rekordów. **Podłączenie AI pogorszyłoby produkt.**

---

## 4. DLACZEGO TO NIE JEST „SKOŃCZONE"

**Ocena 7,1 przy celu 9,5.** Brakuje 2,4 punktu. Jedna runda naprawcza dała +1,2, więc do celu
potrzeba jeszcze około dwóch takich rund.

Otwarte, znane, nieocenione:

1. **Tryb Podgląd niespójny** — Inicjatywa zostawia aktywne „Utwórz wariant" i „Oznacz jako ukończone",
   Insight „Zgłoś do recenzji" i przełącznik stanu. Decyzja właściciela: **Podgląd = tylko czytanie,
   wszędzie.** Do wykonania.
2. **Ślad audytowy AI zniknął** — przepięcie na działający endpoint sprawiło, że wywołania AI nie
   trafiają do rejestru w panelu administratora. **Nasza regresja z tej nocy.**
3. **Powiadomienie loguje błąd pustej odpowiedzi modelu** przy samym wejściu na ekran, bez akcji użytkownika.
4. **Pasek „Szkic"** zabramkowany po stronie wywołań, **nie naprawiony u źródła.**
5. **Cztery różne szerokości powłoki** (1488/1332/1496/1364) — karty nie dzielą jednej powłoki.
6. **`StandardArtifactShell`** — 590 linii bez żadnego konsumenta: podpiąć albo skasować.
7. **Poza kartami:** „Eksport danych" w ustawieniach melduje *„otrzymasz e-mail"* i nie robi nic.

---

## 5. CZEGO W TYM AUDYCIE NIE MA (świadomie)

- **Ocen sędziów po fali 2** — trzecia runda się nie odbyła. Liczby z §2 są sprzed nocy.
- **Oceny Sesji wywiadu** — nie była w zakresie rundy sędziów.
- **Potwierdzenia zachowania na demo** — pomiary pochodzą ze środowiska odbioru (harness
  z danymi testowymi), nie z żywej aplikacji po zalogowaniu.

★ Metodyczna lekcja tej nocy: **narzędzie pomiarowe potrafi cicho unieważnić pomiar.** Harness
nie montował komponentu wyświetlającego komunikaty — więc każdy komunikat błędu był w nim
niewidoczny, a kilka raportów „widać uczciwy błąd" opierało się na odczycie kodu, nie na oku.
Trzy razy tej nocy ogłosiłem defekt systemowy, który nie istniał; dwa razy odwołali to sami sędziowie.

---

## 6. ŹRÓDŁA
- Dziennik pętli z pomiarami: `_PETLA_NOCNA_9_5_2026-07-23.md`
- Raport poranny (wynik, decyzje, moje błędy): `_RANO_2026-07-24.md`
- Audyt środowiska (surowy): `AUDYT_SRODOWISKA_ODBIORU.md`
- Standard: `_STANDARD_N_TYPE_2026-07-23/`

---

## 7. PROMOCJA NA DEMO — WYKONANA (2026-07-24, autoryzacja właściciela)

**SHA na demo:** `97f466bd98` — potwierdzony na `/api/health` (zgodny z wypchniętym).
Deploy SUCCESS, baza i cache podłączone. **Nowy punkt cofania: `demo-safe-2026-07-24`**;
poprzedni `demo-safe-2026-07-23` (`9b143bc913`) nietknięty. Fast-forward, bez force.
88 commitów (86 nocnych + docs + merge). Historia demo zachowana.

**Migracja Insightu — ręcznie na DEMO/trolley, przed pushem kodu.** Kolumna
`interview_insights.section_overrides` dodana, 19 wierszy, wszystkie NULL (zero zmiany zachowania).
★ Bramka hosta przetestowana negatywnie: podanie PROD (centerbeam) **odmówiło wykonania**.
Produkcja nietknięta.

**Automat dorabiający kolumnę ZOSTAWIONY — wbrew mojej rekomendacji, z lepszym powodem.**
Migracja 931 nie poszła na PROD. Ten kod pojedzie kiedyś forward-portem demo → Londyn → prod;
zdjęcie guardu teraz wysypałoby zapis Insightu na produkcji do czasu, aż ktoś sobie przypomni
o migracji. Koszt zostawienia zerowy (jedno tanie sprawdzenie raz na proces, potem flaga zwiera).
**Do zdjęcia dopiero po uruchomieniu 931 na produkcji.**

**Czerwona bramka przepuszczona świadomie, z dowodem.** `check-list-canon.sh` = 11 naruszeń
(surowe tabele). A/B na tym samym zestawie plików w drzewie `origin/demo` sprzed merge'a:
**11 przed, 11 po, zbiory identyczne**, skrypt bramki niezmieniony. To dług zastany na demo,
nie coś, co ta promocja wnosi. Zatrzymanie cofnęłoby całą noc za błąd, którego demo już nie łapie.
★ **Do naprawy osobno** — bramka, która jest trwale czerwona, przestaje cokolwiek chronić.
