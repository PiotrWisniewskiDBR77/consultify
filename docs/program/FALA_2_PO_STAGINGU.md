---
doc_id: program-fala-2-po-stagingu
status: rejestr-aktywny
data: 2026-09-03 (wieczór)
---

# Fala 2 — po przelocie właściciela po stagingu

> Słowa właściciela, rozmowa 03.09 wieczór: „Te wszystkie rzeczy, które teraz zgłosiliśmy jako
> później, musisz koniecznie odnotować. Zaraz po przejściu pierwszej fali na staging będziemy się
> za to zabierali.”

**Zasada startu**: fala 2 rusza **po** przelocie właściciela po stagingu (bramka `G16`) **i po**
zamknięciu bramek pierwszej fali (`G14`/`G20` pierwszej partii modułów). Nie wcześniej — to jest
warunek, nie sugestia; wynika wprost z reguły 9 kodeksu (zakaz masowego włączania) i z decyzji
`DEC-2026-09-03-384` (trzymanie terminu 10–12.09 kosztem przesunięcia pięciu pozycji do fali 2).

Wszystkie pozycje poniżej mają numer `DEC` w `OWNER_DECISION_LEDGER_2026-08-24.md` — nie są
długiem bez adresata, są rozstrzygnięte jako ODŁOŻONE i nie blokują bramek pierwszej fali
(reguła `E1` / `DEC-2026-09-03-362`).

## Kolejność startu (rekomendacja CTO, przyjęta 03.09)

1. **Pięć pozycji, które właściciel wybrał „TERAZ” w pierwszym odruchu, a przy pytaniu o skutek
   terminowy sam przeniósł do fali 2** — patrz `DEC-2026-09-03-384`. To najświeższe zamiary
   właściciela, więc idą pierwsze: **B3, B6, historia Czatu (część R-14), R-18, R-20**.
2. **Przebudowa narzędzia Oceny** — R-1 i R-2 razem (13 pozycji, wzajemnie zależne, największa
   rodzina pakietu P0/P1).
3. **Reszta** — pozostałe pozycje ODŁOŻONE bez wskazanej pilności, w kolejności modułów.

## Rejestr pozycji

| DEC | Co to jest (jedno zdanie) | Źródłowe ID | Koszt z pakietu | Kolejność startu |
| --- | --- | --- | --- | --- |
| `DEC-2026-09-03-354` | Nowy prawy panel Idei/Notatnika (MW-4) | `UW-07-14`, `UW-07-17`, `UW-07-18` | DUŻE projektowo | 1 — wybrane TERAZ, przeniesione |
| `DEC-2026-09-03-357` | Nowa funkcja preferencji Czatu (zgłoszona za nieodtworzonym crashem) | B6 | DUŻE (nowa funkcja) | 1 — wybrane TERAZ, przeniesione |
| `DEC-2026-09-03-377` (część) | Przebudowa historii Czatu: rozdzielenie architekturą rozmów prywatnych i organizacyjnych | `CHAT-OWN-013` | DUŻE — przebudowa `ChatHistorySidebar.tsx` (1 365 linii) + model widoczności | 1 — wybrane TERAZ, przeniesione |
| `DEC-2026-09-03-381` | Jeden wspólny standard kart dla 7 typów obiektów (Zadanie/Decyzja/Powiadomienie/Inicjatywa/Wniosek/Wywiad/Narzędzie) | `XMOD-CARD-REC-001` | DUŻE — 7 osobnych kontraktów kart + `cardContract.types.ts` | 1 — wybrane TERAZ, przeniesione |
| `DEC-2026-09-03-383` | Dwa brakujące etapy modelu sesji SWOT (5→7 etapów) | `TLS-SWOT-OWN-001` | ŚREDNIE — 3 dni | 1 — wybrane TERAZ, przeniesione |
| `DEC-2026-09-03-364` | Przebudowa całego narzędzia sesji Oceny (menu, wywiad, warsztat, formularz/lista/macierz jako osobne tryby) | `ASM-OWN-003/007/008/009/010/011/012/014/015/016` (10 pozycji) | DUŻE, wzajemnie zależne (7 z 10 zależy od pozycji 4 i 6); moduł 47 127 linii | 2 — przebudowa Oceny |
| `DEC-2026-09-03-365` | Karty pytań z kolorem poziomu, stopniowym rozwijaniem i licznikiem odpowiedzi/pytań | `ASM-OWN-017/018/019` (3 pozycje) | DUŻE (prototyp) + ŚREDNIE, zależne od R-1 | 2 — przebudowa Oceny (razem z R-1) |
| `DEC-2026-09-03-368` | Trzy karty Wnioski/Raporty/Inicjatywy pod Oceną, wzorem Narzędzi | `ASM-OWN-006` | DUŻE — kopiuje wzorzec z modułu zamrożonego `DEC-238` | 3 — reszta |
| `DEC-2026-09-03-369` | Uprawnienia zespołu z etapowymi zatwierdzeniami; model kredytów raportu; komentarze ludzkie i doradca AI przy Macierzy/Raporcie | `ASM-OWN-023/027/028` (3 pozycje) | DUŻE (023 — nowy model uprawnień); 027/028 — 0 linii dopóki nie ma modelu komercyjnego/kontraktu AI | 3 — reszta |
| `DEC-2026-09-03-355` | „Tworzy raport” w doradcy obciążenia zespołu (migawka zespołu) — funkcji nie ma w kodzie | B4 / `INIT-2(b)` | DUŻE (nowa funkcja) | 3 — reszta |
| `DEC-2026-09-03-356` | Restrukturyzacja współdzielonego menu kanw Czatu (kebab) | B5 | DUŻE, szeroki promień | 3 — reszta |
| `DEC-2026-09-03-359` | Przemalowanie crimsona poza semantyką krytyczną, moduł po module zaczynając od Czatu | C | 5 325 wystąpień w 609 plikach (Czat 69, Administracja 102, Moja Praca 53, Finanse 6, Ustawienia 17); 193 wystąpienia pierścienia fokusu idą już torem Codex 287, poza tą pozycją | 3 — reszta (pierwszy moduł: Czat) |
| `DEC-2026-09-03-372` (część) | Kanoniczny status licznika konwersji Idei widoczny wszędzie w aplikacji | `MYW-IDEAS-009` | DUŻE (nowy status w modelu) | 3 — reszta |
| `DEC-2026-09-03-372` (część) | Zmiana nazwy, zakresu i archiwizacja folderów Idei | `MYW-IDEA-REC-002` | ŚREDNIE + migracja bazy | 3 — reszta |
| `DEC-2026-09-03-373` | Konwersja Idei do Notatki i do Notatnika (front + serwer + baza) | `MYW-IDEAS-012`, `MYW-IDEAS-014` | ŚREDNIE (2–3 dni), zależne pozycje | 3 — reszta |
| `DEC-2026-09-03-373` | Zakres przycisku „AI Advice” w panelu Idei | `MYW-IDEAS-CORE-001` | nie do wyceny przed decyzją zakresu | 3 — reszta |
| `DEC-2026-09-03-374` (część) | Historia i pochodzenie treści w Notatniku, rozstrzyganie konfliktów wersji | `MYW-NBK-003` | DUŻE (nowy model danych; `NotebookContextPanel.tsx` 867 linii bez tej mechaniki) | 3 — reszta |
| `DEC-2026-09-03-374` (część) | Zawężanie wyszukiwania w Notatniku po cechach | `MYW-NBK-004` | ŚREDNIE | 3 — reszta |
| `DEC-2026-09-03-376` | Pulpit Menedżera liczony z realnej aktywności zespołu zamiast danych zmyślonych | `MYW-MGR-REC-001` | DUŻE — `ExecutiveDashboard.tsx` 885 linii + nowe liczenie po stronie serwera + prototyp | 3 — reszta |
| `DEC-2026-09-03-378` (część) | Kreator inicjatyw od jednego zdania założenia, z propozycją AI do poprawienia | `INI-OWN-006` | DUŻE (nowa funkcja, prototyp) | 3 — reszta |
| `DEC-2026-09-03-382` | Wspólny kreator inicjatyw z Narzędzi (rozszerzenie zakazu `DEC-238`) | `TLS-INIT-OWN-001` | DUŻE; poza MVP z mocy rozszerzonego `DEC-238` | 3 — reszta |

**21 pozycji w rejestrze** (licząc części rodzin R-9, R-11, R-14, R-15 osobno — tyle, ile
osobnych „co to jest” wierszy w tabeli powyżej; jako rodziny pakietu P0/P1 to 13 pozycji
odłożonych z `DECYZJE_WLASCICIELA_P0P1_20260904.md` + 5 pozycji z listy A–E
`DECYZJE_WLASCICIELA_DO_PODJECIA_20260904.md` — łącznie 18 źródłowych rodzin/pozycji, rozbitych
tu do 21 wierszy tam, gdzie rodzina zawierała kilka niezależnie wycenionych elementów).

## Poza tym rejestrem — świadomie

- **`R-19` reguła `E1`, `A4` odbiór 40-punktowy** i inne pozycje z decyzjami `TERAZ`/`ZOSTAJE`/
  `USUNĄĆ`/`PODŁĄCZYĆ` nie są falą 2 — są w pierwszej fali, patrz
  `OWNER_DECISION_LEDGER_2026-08-24.md` `DEC-347`…`DEC-383`.
- Pozycje „ZAMKNĄĆ ROZMOWĄ” z pakietu P0/P1 (`ASM-OWN-027/028`, `MYW-PHOTO-004`,
  `MYW-IDEAS-012/014/CORE-001`, `CHAT-OWN-017`, `RES-OWN-005`, `TLS-INIT-OWN-001`) mają już
  rozstrzygnięcie w tym wieczorze (patrz DEC odpowiadające) — jeśli w tabeli powyżej wciąż
  wymagają linii kodu (np. `MYW-IDEAS-012/014`, `TLS-INIT-OWN-001`), to dlatego że rozmowa
  rozstrzygnęła ZAKRES, nie zwolniła z wykonania; wykonanie idzie do fali 2.

## Źródła

- `docs/program/DECYZJE_WLASCICIELA_DO_PODJECIA_20260904.md` (sekcje A–E)
- `docs/program/DECYZJE_WLASCICIELA_P0P1_20260904.md` (rodziny R-1…R-20)
- `docs/program/waves/WAVE_03_ACCEPTANCE/OWNER_DECISION_LEDGER_2026-08-24.md` (`DEC-2026-09-03-347`…`DEC-2026-09-03-384`)
