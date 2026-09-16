# M1 krok 0 — pomiar `getUserForecast` na Northwind

**Werdykt: NIE liczy poprawnie obciążenia per osoba per tydzień.** Funkcja działa na realnym
PostgreSQL i zwraca cztery tygodnie, ale jej fallback nie rozkłada godzin zadania między początek
i termin. Sumuje cały kwalifikujący się backlog, dzieli go przez stałe `4.0` i powtarza wynik w
każdym tygodniu, w którym termin zadania jeszcze nie minął.

Status paczki: **POMIAR ZAKOŃCZONY / BEZ KODU PRODUKCYJNEGO**. To jest przygotowanie M1 zgodnie
z KANAL.md Wpis 117. Nie rozpoczyna M1a i nie omija zależności `PLAN-1 → M1`.

## Środowisko i denominator

- baza kodu: `cbad80887ce5969f37a38f9ce79e67c6f33844fd`;
- dump: `staging-thomas-przed-wdrozeniem-linii-20260911-2036.dump`;
- SHA-256 dumpu: `85f0d5aafcd479b1b89b25b7fad3e46e3a147937f4f68ea47bbdd1a5c2f61531`;
- lokalny, prywatny PostgreSQL 18: `127.0.0.1:6460/consultify_m1_audit`;
- tabele publiczne po restore: **1808**;
- organizacja: Northwind Manufacturing Ltd.,
  `468b234c-66c4-54e1-b626-5e0fb3a92f6a`;
- `task_allocations` Northwind: **0 wierszy**, więc wykonany został dokładnie fallback z
  `workloadCapacityService.ts:345-356`;
- zero zapisów do stagingu, Railway i baz zewnętrznych.

Denominator audytu to cztery inicjatywy należące do planu:

| Inicjatywa | Zadania | Godziny | Komplet osoba+godziny+termin |
|---|---:|---:|---:|
| MES Rollout Line 3 | 10 | 688 | 10/10 |
| Predictive Maintenance for CNC Line | 10 | 466 | 10/10 |
| Warehouse Automation Pilot | 9 | 452 | 9/9 |
| Skills Matrix and Upskilling | 7 | 254 | 7/7 |
| **Razem** | **36** | **1860** | **36/36** |

W całej organizacji jest 46 zadań. Dziesięć poza tym denominatoriem obejmuje m.in. osobiste zadania
Jamesa oraz trzy zadania wywiadowe. To ważne, bo `getUserForecast` filtruje wyłącznie po
`organization_id` i `assignee_id`, bez planu, inicjatywy ani projektu.

Pięć z 36 zadań ma stan `done` i łącznie 340 godzin. Funkcja świadomie wyklucza je z prognozy.
Pozostały denominator prognozy to 31 otwartych zadań / 1520 godzin.

## Uruchomiona funkcja

Uruchomiono produkcyjne `getUserForecast(orgId, userId)` z
`server/src/services/workloadCapacityService.ts:297-367` dla wszystkich dziewięciu osób
przypisanych do 36 zadań. Połączenie zostało potwierdzone readbackiem:

```text
DB_IDENTITY role=app identity=127.0.0.1:6460/consultify_m1_audit
DB_PROBE current_database=consultify_m1_audit tasks=46
```

Okno funkcji, wynikające z zegara przebiegu 16.09.2026, to tygodnie rozpoczynające się
14.09, 21.09, 28.09 i 05.10.

## Wynik: formuła funkcji vs rozłożenie zadania na tygodnie

Kolumna „funkcja” poniżej odtwarza dokładnie fallback produkcyjny, ale ograniczony do 36 zadań
planu, aby mianownik był ten sam. Kolumna „zadanie→tygodnie” dzieli godziny każdego otwartego
zadania przez liczbę tygodni od `started_at`, a przy jego braku od `created_at`, do `due_date`,
i przypisuje udział wyłącznie do tygodni przecinających ten zakres.

| Tydzień | Funkcja: godziny planu | Zadanie→tygodnie | Zawyżenie |
|---|---:|---:|---:|
| 2026-09-14 | 240,0 | 189,1 | +26,9% |
| 2026-09-21 | 175,0 | 131,4 | +33,2% |
| 2026-09-28 | 99,0 | 69,4 | +42,7% |
| 2026-10-05 | 88,0 | 58,4 | +50,7% |

Różnica per osoba pokazuje charakter błędu:

| Osoba | 14.09 funkcja / poprawne | 21.09 | 28.09 | 05.10 |
|---|---:|---:|---:|---:|
| Daniel Osei | 63,0 / 61,0 | 63,0 / 61,0 | 0 / 0 | 0 / 0 |
| Emily Carter | 51,0 / 40,4 | 5,0 / 0 | 5,0 / 0 | 5,0 / 0 |
| James Whitfield | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 |
| Laura Novak | 48,0 / 34,1 | 38,0 / 20,8 | 38,0 / 32,8 | 38,0 / 32,8 |
| Michael Grant | 24,0 / 24,0 | 24,0 / 24,0 | 11,0 / 11,0 | 0 / 0 |
| Priya Sharma | 22,0 / 17,6 | 22,0 / 17,6 | 22,0 / 17,6 | 22,0 / 17,6 |
| Robert Chen | 9,0 / 12,0 | 0 / 0 | 0 / 0 | 0 / 0 |
| Sarah Mitchell | 6,0 / 0 | 6,0 / 0 | 6,0 / 0 | 6,0 / 0 |
| Thomas Baker | 17,0 / 0 | 17,0 / 8,0 | 17,0 / 8,0 | 17,0 / 8,0 |

Faktyczne wywołanie funkcji dla Jamesa zwróciło dodatkowo 2,8 h / 2,0 h / 2,0 h / 0 h,
ponieważ wciągnęło trzy jego osobiste zadania spoza czterech inicjatyw planu. To potwierdza
przeciek zakresu organizacja→plan.

## Przyczyny w kodzie

1. `workloadCapacityService.ts:347` dzieli sumę przez stałe `4.0`, niezależnie od długości
   każdego zadania.
2. `:351` sprawdza tylko `due_date >= początek tygodnia`; nie ma górnej granicy terminu dla
   tygodnia. Zadanie z terminem za miesiąc obciąża wcześniejsze tygodnie.
3. `:352` używa `started_at`, ale dane Northwind mają w tym polu pusty tekst. M1 wymaga jawnego
   fallbacku do daty startu, a tymczasowo do `created_at`.
4. `:348-350` filtruje całą organizację i osobę. Nie przyjmuje zakresu planu/projektu/inicjatywy,
   dlatego do wyniku wchodzą zadania osobiste i inne prace tej samej osoby.
5. Horyzont to zawsze cztery tygodnie od `new Date()` (`:316-320`), a nie horyzont planu.
   Zadania Northwind sięgają do 26.03.2027.

## Drugi niezależny błąd: moc osoby

Funkcja nie używa `users.weekly_capacity_hours`. Jeśli osoba ma członkostwa projektowe, sumuje
`allocation_percent` ze wszystkich projektów i mnoży każde przez 40 godzin (`:298-313`).

| Osoba | Moc w `users` | Wynik funkcji |
|---|---:|---:|
| Emily Carter | 37 h | 40 h |
| James Whitfield | 40 h | **80 h** (dwa członkostwa × 100%) |
| Laura Novak | 36 h | 40 h |
| Michael Grant | 35 h | 40 h |
| Priya Sharma | 32 h | 40 h |
| Robert Chen | 38 h | 40 h |

Tylko Daniel Osei, Sarah Mitchell i Thomas Baker mają przypadkowo zgodne 40 h. Wynik per tydzień
nie może być uznany za poprawny, nawet gdy popyt dla pojedynczej komórki wygląda wiarygodnie.

## Wniosek wykonawczy dla M1a

Istniejący serwis jest użytecznym punktem wejścia i potwierdza dostępność danych, ale nie może być
podłączony do Load bez zmiany kontraktu. M1a potrzebuje czytnika przyjmującego jawny zakres planu
oraz horyzont, który:

1. pobiera zadania należące do inicjatyw planu;
2. rozkłada `estimated_hours` po tygodniach zakresu zadania;
3. zachowuje listę źródłowych `task_id` dla każdej komórki;
4. liczy moc z `weekly_capacity_hours` i dostępności osoby, bez sumowania tej samej osoby ponad
   100% wskutek wielu członkostw;
5. raportuje brak estymaty lub terminu jako `UNKNOWN`, nie zero;
6. pozostawia ręczny popyt jako jawne, audytowalne nadpisanie.

To zgadza się z `audyt-plan-20260916/SYNTEZA.md` §4 M1 i
`audyt-plan-20260916/C-mechanika/AUDYT.md` pkt 3. Implementacja pozostaje za bramką `PLAN-1`.
