---
doc_kind: UI_FOUNDATION_STANDARD
spec_status: APPROVED_SPEC
owner: Piotr Wisniewski
decision_authority: product_owner
last_updated: 2026-08-02
authority: docs/ui-standards/CANON.md
---

# Kanon ikonografii i akcji

## 1. Jedna biblioteka

Biblioteką kanoniczną jest `lucide-react`. W produkcie nie mieszamy Lucide z emoji, ikonami systemowymi, Font Awesome ani lokalnymi SVG bez zatwierdzonego wyjątku. Logo i znaki marek są aktywami, nie ikonami interfejsu.

## 2. Rozmiary i rysunek

| Rola | Rozmiar | Użycie |
|---|---:|---|
| micro | 12 px | status w chipie, metadane |
| compact | 16 px | tabela, menu, input, przycisk kompaktowy |
| default | 20 px | toolbar, nawigacja, zwykły przycisk ikonowy |
| prominent | 24 px | empty state, nagłówek panelu |
| illustrative | 32–48 px | wyłącznie ilustracyjny empty/error state |

Domyślny `strokeWidth` wynosi `1.75`; dla ikon 12–16 px dopuszczalne jest `2`. Ikona dziedziczy kolor tekstu. Kolor semantyczny sygnalizuje stan, a nie dekoruje.

Minimalny cel interakcji wynosi 36×36 px na desktopie i 44×44 px w widoku dotykowym. Sama ikona nie jest celem interakcji.

## 3. Stałe znaczenia

- pionowy kebab: akcje dotyczące rekordu;
- poziomy kebab: akcje dotyczące bieżącego dokumentu, canvasu lub nagłówka;
- suwaki: konfiguracja widoku, kolumn lub filtrów;
- oko: podgląd bez przejścia do pełnej edycji;
- ołówek: edycja;
- strzałka zewnętrzna: otwarcie pełnego widoku albo zasobu poza kontekstem;
- `x`: zamknięcie lub anulowanie, nigdy usunięcie;
- kosz: usunięcie;
- gwiazdki/iskry: działanie AI;
- łańcuch: kopiowanie lub zarządzanie powiązaniem;
- historia/zegar: historia i wersje;
- warstwy: narzędzia, widoki lub warstwy canvasu — znaczenie musi być podpisane w tooltipie.

Jedna ikona nie może znaczyć różnych rzeczy w dwóch modułach. Nowe mapowanie trafia najpierw do centralnego rejestru akcji.

## 4. Kontrakt akcji

Każda akcja ma stabilny identyfikator, etykietę PL/EN, ikonę, zakres, powierzchnie występowania, warunek dostępności, skutek, informację czy mutuje dane, wymaganie potwierdzenia, możliwość cofnięcia i komunikat błędu. Rejestrem referencyjnym jest wzorzec zastosowany w `src/actions/ideaActionRegistry.ts`.

Akcja niedostępna pozostaje widoczna tylko wtedy, gdy pomaga zrozumieć funkcję. Musi wtedy podać powód. Funkcji spoza MVP nie pokazujemy jako aktywnej atrapy.

## 5. Kebab, prawy klik i toolbar

- toolbar pokazuje akcje częste, odwracalne i bezpieczne;
- kebab pokazuje komplet akcji dla wskazanego obiektu;
- menu prawego kliknięcia optymalizuje pracę ekspercką i może zawierać dodatkowe akcje kontekstowe;
- ta sama akcja ma wszędzie tę samą nazwę, ikonę, skrót, warunki i rezultat;
- prawy klik nie może być jedynym sposobem dostępu do funkcji;
- akcje destrukcyjne są w ostatniej grupie, czerwone dopiero w stanie znaczącym, odseparowane separatorem;
- menu zamyka `Esc`, klik poza obszarem i wykonanie akcji; po zamknięciu focus wraca do triggera.

## 6. AI

AI proponuje, streszcza, generuje albo wykonuje dopiero po jawnym komunikacie o zakresie. Mutacja wykonywana przez AI wymaga podglądu różnicy albo jednoznacznego zatwierdzenia i mechanizmu cofnięcia. Ikona iskier bez etykiety jest dozwolona jedynie w znanym, podpisanym toolbarze i zawsze ma tooltip.

## 7. Test odbiorowy

Odbiór wymaga: identycznej semantyki we wszystkich powierzchniach, tooltipów dla ikon bez tekstu, obsługi klawiatury, widocznego focusu, poprawnej nazwy dostępności, dark/light oraz braku lokalnych ikon zastępczych.
