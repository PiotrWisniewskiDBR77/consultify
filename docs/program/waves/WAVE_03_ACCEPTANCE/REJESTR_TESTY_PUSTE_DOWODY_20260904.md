---
doc_id: wave3-testy-puste-dowody-20260904
status: aktualny
data: 2026-09-04
---

# Testy puste — dowody mutacyjne z odbioru adwersaryjnego (04.09)

★ **Ten plik jest pisany ręcznie.** Sąsiedni `REJESTR_TESTY_PUSTE_20260903.md` jest
**generowany** przez `scripts/dev/testy-puste-skan.mjs` i każdy przebieg bezpiecznika
`tests/unit/config/noEmptyAssertions.test.ts` nadpisuje go w całości — ręczny dopisek tam
znika bez śladu (zdarzyło się 04.09, dopisek przeżył 12 minut). Wnioski, których skaner nie
umie wyprodukować, trzymamy tutaj.

## Dlaczego kolumna `PUSTY` w rejestrze stoi na 0

Skaner **nigdy** nie nadaje klasy `PUSTY` na podstawie tekstu — wymaga dowodu mutacyjnego,
którego sam wykonać nie może. Dyżur 309 odmówił zgadywania i to była decyzja uczciwa.
Odbiorca adwersaryjny (Opus, 04.09) wykonał 5 mutacji funkcji **produkcyjnych**:

| Kandydat | Mutacja produktu | Wynik | Klasa |
|---|---|---|---|
| `scimService.test.ts` | `SCIMService.ts` → `export default {}` | **12/12 PASS** | **PUSTY** |
| `contentService.test.ts` („should return dashboard data”) | funkcja zwraca `{-999,-999}` | **PASS** | **PUSTY** |
| `billingCron` | mutacja funkcji | test czerwieni | NIE pusty |
| `siemService` | mutacja funkcji | test czerwieni | NIE pusty |
| `chatPolicyGateway` | mutacja funkcji | test czerwieni | NIE pusty — ale broni **tylko literału**: produkcja bezwarunkowo dopisuje dwa napisy do listy, nie ma tam egzekucji do zmutowania |

**Ekstrapolacja odbiorcy: rzędu 8 pustych z 21 kandydatów.**

## Ślepa plama skanera — poza zasięgiem obecnej heurystyki

Skaner szuka sygnału sieci/bazy, więc nie widzi testów, które z produktem nie rozmawiają wcale:

- **267 plików / 1766 bloków** bez żadnego wiązania z produktem;
- **13 plików definiuje PODMIOT TESTU wewnątrz pliku testu** — np.
  `const MessageBubble = () => <div data-testid=... />`. Test renderuje własną atrapę
  i przechodzi niezależnie od tego, co robi produkt. To jest kształt „biblioteka bez
  wywołania” przeniesiony do testów;
- `tests/unit/services/api-extensions.test.ts` **testuje moduł, którego w repo nie ma** —
  `find` po `*api-extensions*` w `src/` i `server/` zwraca pustkę.

## Do następnego dyżuru
1. Rozszerzyć skaner o wykrywanie podmiotu testu zdefiniowanego w pliku testu.
2. Rozstrzygnąć mutacją pozostałe 16 kandydatów (2 z 21 już rozstrzygnięte jako `PUSTY`).
3. Usunąć albo naprawić `api-extensions.test.ts`.
