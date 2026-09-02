---
doc_id: funkcje-wspolna-przyczyna-204-210
status: canonical
owner: piotr
truth_type: process
established: 2026-08-31
---

# Cztery odbiory, jedna przyczyna: testy pilnują szczęśliwej drogi, nie pilnują zabezpieczeń

31.08.2026 wróciły cztery dyżury (204, 207, 209, 210). Każdy odebrany
adwersaryjnie, każdy z werdyktem **SCALIĆ PO FIX**. W trzech z czterech
niezależni audytorzy zmierzyli **ten sam** defekt.

## Pomiar

| Dyżur | Zabezpieczenie | Testy przed mutacją | Po zepsuciu zabezpieczenia |
| --- | --- | --- | --- |
| 204 | idempotencja migracji (dwa strażniki naraz) | 11/11 zielonych | **11/11 zielonych** ✗ |
| 207 | brama zatwierdzenia zapisu | 4/4 zielone | **4/4 zielone** ✗ |
| 210 | filtr zasięgu, ścieżka zapasowa | 4/4 zielone | **4/4 zielone** ✗ |
| 210 | filtr zasięgu, ścieżka główna | 4/4 zielone | 3/1 czerwony ✓ |
| 209 | ochrona zasięgu przy indeksacji | 6/6 zielonych | 1/5 czerwonych ✓ |

## Przyczyna

Testy pisane są wzdłuż **scenariusza użycia**: „utwórz zadanie i sprawdź, że
powstało", „wyszukaj i sprawdź, że znajduje". Taki test przechodzi przez
zabezpieczenie po drodze, ale **nigdy nie sprawdza, co się dzieje, gdy
zabezpieczenia nie ma** — bo nigdy nie próbuje go ominąć. 207 jest wzorcowy:
żaden test nie woła wykonania **bez** zatwierdzenia, więc skasowanie bramy
niczego nie psuje w oczach zestawu.

Mechanizm w kodzie **działał** we wszystkich czterech przypadkach. Nie broni go
nic przed jutrzejszą regresją.

## Reguła (obowiązuje od teraz w każdej instrukcji dyżuru)

> **Zabezpieczenie bez testu, który czerwienieje po jego usunięciu, jest
> nieudowodnione.** Test scenariusza użycia nie liczy się jako dowód
> zabezpieczenia. Wymagany jest osobny przypadek próbujący je **ominąć**.

Konsekwencje operacyjne:
1. Każdy dyżur dotykający zabezpieczenia (zasięg, brama, idempotencja,
   uprawnienia) **wymienia w raporcie mutację i jej czerwień** — inaczej punkt jest
   niezrobiony. To już było w instrukcjach; nowe jest to, że mutacja musi celować
   w **zabezpieczenie**, nie w mechanizm.
2. Gdy zabezpieczenie ma dwie ścieżki (główną i zapasową), wymagane są **dwie
   mutacje**. 210 pokazał, że atrapa w teście potrafi ominąć dyspozytor i całą
   drugą ścieżkę zostawić bez pokrycia.
3. Odbiór adwersaryjny **powtarza mutację własnymi rękami**. We wszystkich
   czterech przypadkach logi mutacji wykonawcy były autentyczne (audytor 209
   zweryfikował 7 hashy SHA-256) — i mimo to niepełne, bo celowały w niewłaściwe
   miejsce.

## Uczciwy bilans tych czterech odbiorów

Żaden wykonawca nie zawyżył. 204 sam napisał `STOP MERYTORYCZNY` i `NOT_PROVEN`,
209 sam oznaczył brak dowodu HTTP, 210 zostawił pracę niezacommitowaną, ale
kompletną. Defekt jest **metodyczny, nie ludzki** — instrukcja nie żądała
mutacji celującej w zabezpieczenie, więc jej nie dostała.
