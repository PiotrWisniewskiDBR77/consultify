# Karta wieczorna 08.09 — co jest na stagingu i co dalej

Staging: `996d914591` (druga paczka, punkt cofnięcia `c36dc94359`; pierwsza `c36dc94359` z punktem `94b57ed9ad`). Dzień: 22 scalenia na gałęzi `mvp/inicjatywy-lancuch-20260907`, każde z zieloną bramką (tsc serwera 0, tsc frontu 192 = baza, build, bramka językowa).

## Co zobaczysz na stagingu (Twoje dane DBR77)
- **Paski Menu 1/2/3 w 8 zakładkach** Inicjatyw i Realizacji: jeden ciemny przycisk na zakładkę po prawej, filtr obok, liczniki tylko w chipach, komunikaty o danych nad tabelą. Zero zawijania w 1440 i 1920.
- **Raporty**: zwykła tabela przy zerze raportów, „Dodaj raport” w Menu 2 z czterema raportami startowymi i „Własny raport…”.
- **Podgląd inicjatywy**: powód wyszarzonego przycisku jest widoczny (stopka go nie zasłania). Generator planu pokazuje uzasadnienia po polsku zamiast kodów solvera.
- **Kolumna Właściciel** pokazuje nazwiska także dla zarejestrowanych inicjatyw (był polski literał).
- **Szybciej**: weryfikacja tokenu raz na żądanie zamiast 8, zapytania SQL na żądanie o 63–81 % mniej.
- **Wersja angielska**: serwer wysyła kody błędów, front je tłumaczy; enumy przez słownik („Unknown” zamiast surowego UNKNOWN); moduł Inicjatywy w EN bez polskich słów w interfejsie; moduł Realizacja w EN bez polskich słów w interfejsie (17 ekranów, 653 → 0), daty i liczby przez locale, belka Zasobów po angielsku.
- **Sygnały opóźnień** nie pokazują zadań ukończonych; **podaż ról** w analizie obciążenia liczy się (była zawsze pusta).
- **Sesja**: po resecie hasła ekran logowania z komunikatem; wygaśnięcie sesji też, bez pustych ekranów.
- **Mail resetu hasła** po polsku/angielsku z nadawcą „Consultify”.

## Baza pokazowa Northwind (po angielsku) — gotowa do Twojego odbioru na kopii
Seed idempotentny `server/scripts/seed/demo-en/` (D1–D6 + D4b): organizacja z UUID, 9 osób ze stanowiskami, 13 inicjatyw w 7 statusach, 4 realizacje kanoniczne z pełnym łańcuchem przekazania, 36 zadań, 7 RAID, 9 decyzji, 8 KPI z pomiarami, OKR, ROI, 4 sprawozdania, budżet, 4 dokumenty, 2 talie, skoroszyt, 2 spotkania, 3 wątki czatu, wywiady, narzędzia, ocena. Galeria 16 modułów: `evidence/dane-pokazowe-en/d7-galeria/GALERIA.md` (14 pełnych na galerii; Audyty zasiane po galerii — pakiet, program z 6 kryteriami, 3 ustalenia; Partnerzy puste celowo). **Nic z tego nie jest jeszcze na stagingu ani demo** — to D8 po Twoim „tak” na galerię i na raport dry-run usuwania 325 organizacji śmieciowych (30 659 wierszy) plus decyzja o 38 715 sierotach.

## Decyzje, których potrzebuję (tak/nie)
1. Galeria Northwind wygląda dobrze → wgrywamy seed na staging (D8)?
2. Usuwamy 325 organizacji śmieciowych na stagingu wg raportu dry-run (dump zrobiony)?
3. Atelier Toys i Nordwind Components — usunąć po dumpie?
4. VTS Group S.A. — usunąć?
5. Sieroty (38 715 wierszy bez organizacji) — osobny dry-run i usunięcie?
6. Język: nazwy własne bez tłumaczenia, PL w tej samej paczce co EN, język AI = język UI — przyjąłem domyślnie „tak”.

## Dług zapisany dziś (nie blokuje przejścia)
Bezpieczeństwo edycji cudzych zadań (tryb shadow); ~75 wywołań API na wejście na ekran; dwie skale ekspozycji RAID; „Escalated” z samego terminu; decyzja wstrzymująca inicjatywę domyślnie; uuid kontra text organizacji w schemacie; Wyniki/Finanse tylko dla OWNER/ADMIN; raport Assessment/DRD po polsku na sztywno; Organizacja po polsku (J13); globalny ekran ładowania po polsku; sanitizer escapuje `&` w danych. Pełna lista w rejestrze `01_INDEKS_I_HARMONOGRAM.md` (wiersze 08.09).
