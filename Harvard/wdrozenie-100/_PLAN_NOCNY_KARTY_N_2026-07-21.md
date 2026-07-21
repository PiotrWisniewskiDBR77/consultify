# PLAN NOCNY — grafika kart N, praca w pętli

> **Zlecenie Piotra 2026-07-21 wieczorem:** plan na noc dla grafiki N-typu, system agentów
> z odbiorem wg wymogów, praca w pętli.
> **Zasada nadrzędna nocy:** agenci **NIE PUSHUJĄ NA DEMO**. Rano Piotr odbiera na zrzutach.

---

## 0. DLACZEGO NIE PUSHUJEMY NOCĄ — to nie ostrożność, to dane z dziś

| Fakt z dzisiejszej sesji | Wniosek |
|---|---|
| 7 agentów zgłosiło „zrobione"; wzrokiem znalazłem **13 wad** (surowe klucze i18n) | raport agenta ≠ dowód |
| **2 z 8** ekranów z zielonym esbuildem wywaliło się w przeglądarce | kompilacja ≠ działanie |
| Piotr znalazł na moim własnym zrzucie 2 rozjazdy, których nie widziałem | oko właściciela łapie to, czego nie łapię ja |
| Klasa „technicznie poprawne, wizualnie złe" | **niewykrywalna maszynowo** |

Nocny push bez odbioru = rano zepsute demo i dzień na szukanie przyczyny.
**Nocą powstaje materiał do odbioru. Decyzja jest rano.**

---

## 1. CO ROBIMY NOCĄ — zakres

**Wyłącznie GRAFIKA kart N** (7 kart: Tool · Notification · Interview · Decision · Insight ·
Task · Initiative). Zero zmian mechaniki, zero nowych funkcji.

### W zakresie
- **R1 z bramki: solid CTA poza slotem primary** — zostały 3 ostrzeżenia
  (`bash scripts/check-artefakt.sh --report`). Stonować do outline (SPEC-N §2.3)
- **Spójność sekcji AKCJE** — dziś Task/Insight mają tekst („actions live in the header"),
  Decision/Initiative przyciski. Zbadać i ujednolicić albo uzasadnić różnicę
- **„Presentation mode" jako AKCJA w Initiative** — wg SPEC-N §2.7 tryb ma mieć własny slot,
  nie być akcją na rekordzie
- **Jasny motyw** — dziś weryfikowałem głównie ciemny; przejść wszystkie 7 w jasnym
- **Wąski ekran** — panel jest w `hidden lg:block`, a poziomy pasek właściwości usunięty.
  Sprawdzić, czy poniżej 1024px właściwości są widoczne **gdziekolwiek**

### POZA zakresem — nie ruszać nocą
Martwy kod (~2500 linii) · kontrakty treści · Subtasks · taksonomia zakładek Initiative ·
**przepięcie na `StandardArtifactShell`** (to fala Z, dzień+, świeży kontekst) ·
cokolwiek w `src/components/standard/` i `NModeLayout/` (wspólne — konflikt między agentami).

---

## 2. PĘTLA — jak działa jeden obieg

```
1. ZMIERZ      bash scripts/check-artefakt.sh --report   -> lista naruszeń z liniami
               node scripts/karty-n-smoke.mjs            -> 7/7 zarejestrowanych
2. WEŹ         jedną kartę z listy (jeden agent = jeden plik, ZAWSZE)
3. NAPRAW      wyłącznie punkty ze swojej listy; zero refaktorów przy okazji
4. SKOMPILUJ   npx esbuild <plik> --loader:.tsx=tsx --jsx=automatic --outfile=/dev/null
5. OTWÓRZ      harness, jasny I ciemny — brak error-boundary, brak surowych kluczy
6. ZRZUT       do folderu odbioru (nazwa: karta-<nazwa>-<jasny|ciemny>.png)
7. COMMIT      commit-per-kartę, opis CO i CZEGO NIE zweryfikowano
8. WRÓĆ do 1   aż lista naruszeń pusta albo pozostałe wymagają decyzji Piotra
```

**Warunek wyjścia z pętli:** `check-artefakt.sh` bez naruszeń **i** 7/7 kart otwartych
w obu motywach bez błędu. Wtedy pętla się **zatrzymuje** i czeka na rano.

---

## 3. ODBIÓR — wymogi, wg których agent sprawdza samego siebie

Przed oznaczeniem karty jako gotowej, agent przechodzi **literalnie** (SPEC-N + DoD §18.1):

| # | Wymóg | Jak sprawdzić |
|---|---|---|
| 1 | Dokładnie **jeden** element wygląda na primary | policzyć solid/filled na całym ekranie |
| 2 | Prawy panel obecny, kolejność: Akcje·Właściwości·Powiązania·[evidence]·Komentarze·Historia | odczytać nagłówki sekcji |
| 3 | Panel: tabela **Właściwość/Wartość**, wartości **czytelne** (nie ciemne prostokąty) | `querySelectorAll('th')` + wygląd |
| 4 | Żadna akcja nie występuje dwa razy | policzyć przyciski po etykiecie |
| 5 | Zero `comments`/`history`/`activity-log` w lewej nawigacji | bramka R3 |
| 6 | Zero surowych kluczy i18n na ekranie | regex `\b(myWork\|interview\|initiatives\|discoveryTools)\.[a-z]` |
| 7 | Brak error-boundary | szukać „Coś poszło nie tak" / „Something went wrong" |
| 8 | **Jasny i ciemny** — oba czytelne | dwa zrzuty |
| 9 | Zero crimsona na fokus/status/badge/zaznaczenie | `check-artefakt.sh` |

**Punkt 3 i 8 to te, które dziś wychwycił Piotr, a nie automat.** Nie odpuszczać.

---

## 4. TWARDE ZAKAZY DLA AGENTA NOCNEGO

1. **NIE pushuje na demo.** Nigdy. Commit na gałęzi roboczej — koniec.
2. **NIE dotyka plików spoza swojej karty** (poza `public/locales/*` append-only).
3. **NIE usuwa martwego kodu.**
4. **NIE przepina na `StandardArtifactShell`.**
5. **NIE uruchamia pełnego `tsc`/`vitest`** (OOM na tym repo).
6. **NIE deklaruje „działa" bez otwarcia w przeglądarce.**
7. Widzi coś poza zakresem → **zapisuje w raporcie**, nie naprawia.

---

## 5. RANO — co Piotr zastaje

1. **Zrzuty** wszystkich dotkniętych kart, jasny i ciemny — do odbioru wzrokiem
2. **Raport z pętli:** ile obiegów, co naprawione, co zostało i dlaczego
3. **Wynik bramki przed i po** (liczba naruszeń — miara, nie opinia)
4. **Lista „do decyzji Piotra"** — rzeczy, których agent świadomie nie ruszył
5. Gałąź gotowa do pushu **jednym poleceniem**, po jego akcepcie

---

## 6. CZEGO TA PĘTLA NIE ZAŁATWI — uczciwie

- **„Dużo błędów" Piotra pozostaje nierozpisane.** Potwierdzone są dwa. Pętla naprawia to,
  co widzi bramka i harness — nie to, co Piotr zobaczył na demo i nie wymienił.
  **Rano trzeba o listę dopytać.**
- **Bramki nadal nie są wpięte** (`.husky` = `exit 0`, CI ich nie woła). Pętla ich używa,
  bo ja je wołam — nie dlatego, że system je wymusza.
- **Powłoka typowa nadal nieużywana** — najmocniejsza bramka wyłączona do fali Z.

---

*Plan przed wyczerpaniem kontekstu. Pętla ma produkować MATERIAŁ DO ODBIORU, nie decyzje.*
