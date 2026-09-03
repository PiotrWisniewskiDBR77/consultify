---
doc_id: program-przelot-wlasciciela-staging-20260904
status: gotowy-do-uzycia
data: 2026-09-04
---

# Przelot właściciela po stagingu — pakiet 16 modułów (bramka G16)

Ten dokument prowadzi Cię przez cały staging, moduł po module, w 60–90 minut. Cel: sprawdzić
**REALNE dane i REALNE rekordy**, nie przykłady pokazowe — bo właśnie na tym rozjeździe (ekran
zatwierdzony na fikstrurze ≠ ekran, który dostajesz z listy) straciliśmy tydzień przy Inicjatywach.

## Zanim zaczniesz

- **Adres**: `https://staging.consultify.ai`
- **Wersja**: kod wdrożony 03.09 o 21:15 (znacznik `58ef0771d7`). To najświeższy stan.
- **Logowanie**: konto odbiorowe jest w Twoim menedżerze haseł (szukaj „staging.consultify.ai”
  albo „Consultify staging”). Nie podaję tu hasła — wpisz je sam z menedżera.
- **Złota zasada**: w każdym module otwórz rekord z **prawdziwą nazwą** (klient, projekt,
  inicjatywa), nie rekord nazwany „Showcase”, „Przykład”, „Demo” czy podobnie. Jeśli lista jest
  pusta — zapisz to jako uwagę, nie improwizuj na rekordzie pokazowym.
- **Język i motyw**: przełącz PL↔EN raz i jasny↔ciemny raz — wystarczy zrobić to **jeden raz w
  całym przelocie**, nie w każdym module osobno (chyba że coś rzuci się w oczy).

## Jak zgłaszać uwagę

Jedna linia na uwagę, w tym formacie:

> **moduł · ekran · co widzę · co oczekiwałem · zrzut**

Zrzut robisz zwykłym skrótem klawiszowym systemu. Nie musisz nic więcej opisywać — resztę
znajdziemy po tym jednym zdaniu.

## Czego NIE zgłaszaj nigdy (dotyczy całego przelotu)

1. **Wyniki, Finanse, Organizacja, kreator wywiadu wyglądają „po staremu”.** Włączyłeś te flagi
   wieczorem 03.09 — robotnik jeszcze wdraża przełącznik. Jeśli ekran jest stary, flaga po
   prostu nie zdążyła na to wdrożenie. To nie defekt do zgłoszenia, zgłoś tylko jeśli po
   ODŚWIEŻENIU następnego dnia dalej tak jest.
2. **Dane wyglądają jak dane pokazowe (przykładowe firmy, wygenerowane nazwiska).** Staging
   dzieli bazę z demo — to jest normalne i zamierzone (nie jest to Twoja produkcyjna baza,
   której nikt nie rusza).
3. **Coś w tym dokumencie już jest wypisane niżej pod „Czego NIE zgłaszaj” przy danym module.**
   To są rzeczy świadomie odłożone do fali 2 — mamy je zapisane z numerem decyzji, nie zgubimy.

---

## 1. Chat

**Kroki**: otwórz Chat → napisz krótką wiadomość do Teresy → otwórz listę rozmów w panelu
bocznym → kliknij realną, starszą rozmowę (nie pustą) → z kebaba wiadomości wybierz jedną akcję
(np. „Utwórz zadanie” albo „Kopiuj”).

**Co się zmieniło od 22–23.08**: naprawiony błąd, który wywalał cały panel sygnałów Czatu
(„feed.signals is not iterable”); komunikat błędu od dostawcy AI jest teraz zrozumiały i nie
pokazuje technicznego żargonu; dostępność klawiaturowa i kontrast doprowadzone do zera błędów.

**Czego NIE zgłaszaj**: restrukturyzacja menu kanw (kebab) w Czacie, nowa funkcja preferencji
Czatu, rozdzielenie historii na rozmowy prywatne/organizacyjne, przemalowanie czerwieni Czatu na
neutralne kolory — wszystko to świadomie odłożone do fali 2.

**Pytania (TAK/NIE)**:
- Wiadomość wysłała się i dostałeś odpowiedź bez błędu?
- Komunikat błędu (jeśli go zobaczyłeś) był zrozumiały, nie techniczny?

---

## 2. My Work (Moja Praca)

**Kroki**: otwórz Skrzynkę → kliknij realne powiadomienie → otwórz Idee → kliknij realną ideę →
otwórz Notatnik → sprawdź czy otwiera się w nowym układzie (dwie kolumny: Praca/Kontekst) →
sprawdź pasek zakładek Menu 2 przy węższym oknie (czy chowające się pozycje mają widoczny cień/
strzałkę zamiast być po prostu ucięte).

**Co się zmieniło od 22–23.08**: błąd dostępu do Skrzynki (401/403) ma teraz osobny, jasny
komunikat „Nie masz dostępu do tej skrzynki” — nie miesza się z pustą skrzynką ani ze zwykłym
błędem sieci; Notatnik domyślnie otwiera zaakceptowany widok Praca/Kontekst zamiast starych
trzech zakładek; status „eskalacja” przy decyzjach zapisuje się trwale do bazy (wcześniej znikał
po odświeżeniu strony); dane pokazowe Skrzynki i Kalendarza pokrywają teraz wszystkie stany
(pusty/pełny/błąd).

**Czego NIE zgłaszaj**: nowy prawy panel Idei/Notatnika, konwersja Idei na Notatkę, zakres
przycisku „AI Advice”, historia wersji w Notatniku, zawężanie wyszukiwania w Notatniku po
cechach, Pulpit Menedżera liczony z realnej aktywności zespołu, funkcja „Tworzy raport” w
doradcy obciążenia — wszystko odłożone do fali 2.

**Pytania (TAK/NIE)**:
- Komunikat braku dostępu do Skrzynki różni się od pustej skrzynki?
- Notatnik otworzył się w układzie dwukolumnowym, nie w starych trzech zakładkach?

---

## 3. Interview (Wywiad)

**Kroki**: otwórz Wywiad → wejdź na realny, wcześniej zaczęty wywiad z listy → sprawdź kreator
wywiadu (nowo włączony na Twoje słowo) → rozwiń jedną oś pytań → wróć do listy.

**Co się zmieniło od 22–23.08**: kreator wywiadu włączony domyślnie na Twoją decyzję z 03.09
wieczór — to jest właśnie ekran, który masz dziś ocenić na żywym stagingu; dostępność
klawiaturowa i kontrast doprowadzone do zera błędów. Nawigacja osi pytań (jedna oś rozwinięta na
raz) jest zamierzonym zachowaniem drzewa, nie usterką.

**Czego NIE zgłaszaj**: —

**Pytania (TAK/NIE)**:
- Kreator wywiadu widoczny i otwiera się bez błędu?
- Osie pytań rozwijają się i pokazują treść?

---

## 4. Tools (Narzędzia)

**Kroki**: otwórz Narzędzia → kliknij realne, wcześniej użyte narzędzie z listy (np. SWOT) →
otwórz podgląd → uruchom narzędzie z realnym kontekstem inicjatywy.

**Co się zmieniło od 22–23.08**: dostępność klawiaturowa i kontrast doprowadzone do zera błędów.

**Czego NIE zgłaszaj**: rozszerzenie modelu sesji SWOT (5→7 etapów), wspólny kreator inicjatyw
z Narzędzi — oba odłożone do fali 2.

**Pytania (TAK/NIE)**:
- Narzędzie otworzyło się z realnym kontekstem, nie pustym?

---

## 5. Assessment (Ocena)

**Kroki**: otwórz Ocenę → lista sesji → kliknij realną sesję klienta → otwórz zakładkę
Raportów → sprawdź kolumnę Status przy realnym raporcie → otwórz jeden raport → z kebaba wybierz
jedną akcję.

**Co się zmieniło od 22–23.08**: kolumna Status w Raportach Oceny była **pusta dla każdego
realnego raportu** (harness pokazywał martwy komponent) — teraz pokazuje prawdziwy status;
podobny martwy komponent usunięty z zakładki Inicjatyw Oceny; dostępność klawiaturowa i kontrast
doprowadzone do zera błędów.

**Czego NIE zgłaszaj**: nowa struktura raportu końcowego (wstęp→osie→wnioski→podsumowanie) — w
budowie osobnym torem, jeszcze nie na stagingu; nowy zestaw kolumn biblioteki DRD — przyjęty
kierunek, jeszcze nie zbudowany; przebudowa całego narzędzia sesji (menu/wywiad/warsztat/
macierz jako osobne tryby); karty pytań z kolorem poziomu; trzy karty Wnioski/Raporty/
Inicjatywy pod Oceną; uprawnienia zespołu i komentarze przy Macierzy — wszystko odłożone.

**Pytania (TAK/NIE)**:
- Kolumna Status przy realnym raporcie pokazuje wartość (nie jest pusta)?

---

## 6. Initiatives (Inicjatywy)

**Kroki**: otwórz Inicjatywy → kliknij REALNĄ inicjatywę z listy (nie „Showcase”) → sprawdź czy
otwiera się karta robocza inicjatywy z zadaniami/kamieniami milowymi, nie sam dokument → z
kebaba wybierz jedną akcję.

**Co się zmieniło od 22–23.08 — to jest najważniejsza zmiana w całym pakiecie**: dokładnie tu
był problem, który uruchomił cały ten przelot. Realna inicjatywa otwierała inny komponent niż
ten, który zaakceptowałeś na zrzutach (dostawałeś dokument zamiast roboczej karty). Naprawione:
otwarcie realnej inicjatywy z listy pokazuje teraz dokładnie tę kartę, którą zaakceptowałeś.
Dodano też bezpiecznik w testach, żeby to się nie cofnęło. Dostępność doprowadzona do zera
błędów.

**Czego NIE zgłaszaj**: kreator inicjatywy od jednego zdania z propozycją AI — odłożony do fali 2.

**Pytania (TAK/NIE)**:
- Po kliknięciu w realną inicjatywę zobaczyłeś kartę roboczą (zadania, kamienie milowe), a nie
  goły dokument?

---

## 7. Execution (Realizacja)

**Kroki**: otwórz Realizację → z rozwijanego pola „Wybierz realizację” wybierz pozycję → sprawdź
czy nazwa jest czytelna (nazwa inicjatywy, nie ciąg znaków) → otwórz realny przypadek → z kebaba
wybierz jedną akcję.

**Co się zmieniło od 22–23.08**: rozwijane pole „Wybierz realizację” pokazywało surowy
identyfikator techniczny — teraz pokazuje nazwę inicjatywy; dostępność doprowadzona do zera
błędów.

**Czego NIE zgłaszaj**: —

**Pytania (TAK/NIE)**:
- Pole „Wybierz realizację” pokazuje czytelne nazwy, nie ciągi liter/cyfr?

---

## 8. Results (Wyniki)

**Kroki**: otwórz Wyniki → sprawdź czy widzisz zakładki KPI/OKR/ROI → otwórz realny KPI z listy
→ sprawdź kartę szczegółów.

**Co się zmieniło od 22–23.08**: włączyłeś 03.09 wieczorem 14 ekranów tej rodziny (KPI, OKR,
ROI, wyszukiwarka, uwaga) — robotnik jeszcze kończy wdrożenie przełącznika (patrz „Czego NIE
zgłaszaj” na górze dokumentu); wcześniejsza korekta z 1.09: OKR i ROI SĄ już widoczne w profilu
odbiorowym niezależnie od tego przełącznika.

**Czego NIE zgłaszaj**: zakładka „Archiwum” (`resultsLegacyArchive`) zostaje wyłączona na stałe,
także dla Ciebie — to celowe, nie błąd.

**Pytania (TAK/NIE)**:
- Widzisz zakładki KPI/OKR/ROI z realnymi danymi (nie pustym ekranem)?

---

## 9. Finance (Finanse)

**Kroki**: otwórz Finanse → otwórz realny projekt/case z listy → sprawdź czy widzisz panele:
komentarze, porównanie, eksport/import, nawigator pochodzenia danych, zapisane widoki → otwórz
pakiet sprawozdań.

**Co się zmieniło od 22–23.08**: włączyłeś 03.09 wieczorem sześć paneli tej rodziny — robotnik
jeszcze kończy wdrożenie przełącznika (patrz „Czego NIE zgłaszaj” na górze dokumentu);
dostępność doprowadzona do zera błędów.

**Czego NIE zgłaszaj**: —

**Pytania (TAK/NIE)**:
- Widzisz przynajmniej część z sześciu paneli (komentarze/porównanie/eksport/nawigator/zapisane
  widoki/pakiet sprawozdań)?

---

## 10. Materials (Materiały)

**Kroki**: otwórz Materiały → otwórz bibliotekę → kliknij realny dokument/arkusz/prezentację z
listy → otwórz podgląd → z kebaba wybierz jedną akcję.

**Co się zmieniło od 22–23.08**: dostępność doprowadzona do zera błędów; naprawiony język w
kreatorze szablonów i powłoce warsztatów metodyk (wcześniej po angielsku mimo ustawienia PL).

**Czego NIE zgłaszaj**: —

**Pytania (TAK/NIE)**:
- Podgląd realnego materiału otwiera się poprawnie, treść czytelna?

---

## 11. Audits (Audyty)

**Kroki**: otwórz Audyty → kliknij realny program audytowy z listy → otwórz zakładkę Raportów
DRD → otwórz jeden raport.

**Co się zmieniło od 22–23.08**: zakładka „Raporty DRD” pokazywała wycofany, martwy komponent —
teraz pokazuje realny moduł Audytów, ten sam, który zaakceptowałeś; dostępność doprowadzona do
zera błędów.

**Czego NIE zgłaszaj**: —

**Pytania (TAK/NIE)**:
- Zakładka Raportów DRD pokazuje treść zgodną z tym, co widziałeś na zrzutach akceptu?

---

## 12. Meeting (Spotkania)

**Kroki**: otwórz Spotkania → otwórz realne, zaplanowane spotkanie z listy → sprawdź kartę
spotkania → z kebaba wybierz jedną akcję.

**Co się zmieniło od 22–23.08**: dostępność doprowadzona do zera błędów (moduł ma tylko 2
zatwierdzone ekrany, więc zakres tej naprawy jest mały).

**Czego NIE zgłaszaj**: —

**Pytania (TAK/NIE)**:
- Karta spotkania otwiera się i pokazuje realne dane?

---

## 13. Organization (Organizacja)

**Kroki**: otwórz Organizację → sprawdź czy widzisz nowy, przeprojektowany układ (nie stary) →
otwórz realnego członka/dział z listy → z kebaba wybierz jedną akcję.

**Co się zmieniło od 22–23.08**: włączyłeś 03.09 wieczorem przeprojektowany moduł Organizacji —
robotnik jeszcze kończy wdrożenie przełącznika (patrz „Czego NIE zgłaszaj” na górze dokumentu);
kolor pierścienia fokusu poprawiony w 14 miejscach; dostępność doprowadzona do zera błędów. Ten
moduł już raz obejrzałeś 02.09 na zrzutach bez uwag — dzisiejszy przelot to potwierdzenie na
żywym stagingu, z realnym rekordem.

**Czego NIE zgłaszaj**: —

**Pytania (TAK/NIE)**:
- Widzisz nowy układ Organizacji (nie stary, sprzed przeprojektowania)?

---

## 14. Admin Panel (Panel administratora)

**Kroki**: (wymaga konta administratora — to samo konto odbiorowe powinno mieć te uprawnienia)
otwórz Panel administratora → otwórz realną sekcję (np. użytkownicy albo audyt) → kliknij realny
wiersz → z kebaba wybierz jedną akcję.

**Co się zmieniło od 22–23.08**: usunięty martwy plik-fantom jednej z flag (nazwa w kodzie nie
zgadzała się z niczym realnym); kolor pierścienia fokusu poprawiony w 26 miejscach; dostępność
doprowadzona do zera błędów.

**Czego NIE zgłaszaj**: —

**Pytania (TAK/NIE)**:
- Sekcja administracyjna otwiera się i pokazuje realne dane bez błędu?

---

## 15. Settings (Ustawienia)

**Kroki**: otwórz Ustawienia → przejdź przez 2–3 realne sekcje (np. Profil, Bezpieczeństwo) →
zmień jedno ustawienie i sprawdź czy się zapisało → wróć.

**Co się zmieniło od 22–23.08**: dostępność doprowadzona do zera błędów.

**Czego NIE zgłaszaj**: zakładka „Obserwowane” — jeśli jej nie widzisz albo wygląda na
niedokończoną, to zamierzone; leżący za nią kod idzie do usunięcia, nie do naprawy teraz.

**Pytania (TAK/NIE)**:
- Zmiana ustawienia zapisała się i została po powrocie na ekran?

---

## 16. Partner Portal (Portal partnerski)

**Kroki**: otwórz Portal partnerski → otwórz realnego partnera/umowę z listy → sprawdź podgląd →
z kebaba wybierz jedną akcję.

**Co się zmieniło od 22–23.08**: dostępność doprowadzona do zera błędów (12/12 na jednym z
kryteriów); ten moduł przyjąłeś już w całości 02.09 wraz z warunkiem kolorystycznym — dzisiejszy
przelot to potwierdzenie na żywym stagingu.

**Czego NIE zgłaszaj**: —

**Pytania (TAK/NIE)**:
- Podgląd realnego partnera/umowy otwiera się poprawnie?

---

## Znane ograniczenia stagingu (żeby nic z tego nie zgłaszać jako defekt)

- **Backend 404 na części tras w przyrządzie deweloperskim (harness) NIE dotyczy stagingu.**
  Przyrząd, którym my mierzymy ekrany offline, czasem nie ma podłączonego backendu — to nasz
  wewnętrzny warsztat, nie produkt, który dostajesz Ty.
- **Wspólna baza z demo.** staging.consultify.ai i demo.consultify.ai dzielą jedną bazę danych z
  danymi pokazowymi/testowymi. Jeśli coś wygląda jak dane demo — to dlatego, że to są dane demo.
  Twoja produkcyjna baza (consultify.ai) jest osobna i nietykalna.
- **Flagi Wyników/Finansów/Organizacji/kreatora wywiadu mogą jeszcze nie być widoczne.** Włączyłeś
  je 03.09 wieczorem, robotnik kończy wdrożenie — dopiero brak zmiany następnego dnia jest
  powodem do zgłoszenia.
- **Rzeczy z fali 2 nie są defektami.** Pełna lista tego, co świadomie odłożyliśmy (z numerem
  Twojej decyzji przy każdej pozycji): `docs/program/FALA_2_PO_STAGINGU.md`.

## Tabela do wypełnienia

| # | Moduł | PASS / uwagi | Data |
| ---: | --- | --- | --- |
| 1 | Chat | | |
| 2 | My Work | | |
| 3 | Interview | | |
| 4 | Tools | | |
| 5 | Assessment | | |
| 6 | Initiatives | | |
| 7 | Execution | | |
| 8 | Results | | |
| 9 | Finance | | |
| 10 | Materials | | |
| 11 | Audits | | |
| 12 | Meeting | | |
| 13 | Organization | | |
| 14 | Admin Panel | | |
| 15 | Settings | | |
| 16 | Partner Portal | | |

## Źródła tego pakietu

- `docs/program/waves/WAVE_03_ACCEPTANCE/modules/*/MODULE_ACCEPTANCE.md` (wiersz `G16` — pakiet
  przed/po per moduł, wiersz `G14` — decyzje)
- `docs/program/FALA_2_PO_STAGINGU.md` (co świadomie NIE jest zrobione)
- `docs/program/REJESTR_ZNALEZISK_20260903.md` (co naprawiono dziś, znaleziska A1–F15)
- `evidence/grafika/*-20260903.md` (dowody z dnia)
- `docs/program/waves/WAVE_03_ACCEPTANCE/AUDYT_PRZEWODOW_ODBIORU_20260903.md` (przewody
  lista→rekord, 22 pozycje warunkowe)
- `docs/program/DECYZJE_WLASCICIELA_DO_PODJECIA_20260904.md` (Twoje decyzje 03.09 wieczór:
  A1–A5, `DEC-2026-09-03-347`…`-351`)
