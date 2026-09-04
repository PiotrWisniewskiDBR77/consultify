# Dyżur 353 — R5: podniesienie wierszy i pytanie o kotwicę

## Część A — wynik podniesienia

Podniesiono **0 wierszy** i załączono **0 dowodów do zmiany macierzy**; liczby są równe. Żaden plik `MODULE_ACCEPTANCE.md` nie został zmieniony.

- Kubełek A po R3: siedem wierszy ma konkretną lukę. Dla `01` day307 rozlicza tylko workload, nie cały mianownik; `08` wymaga własnej trasy Meetings; `04`, `05`, `06`, `11`, `13` mają czerwone briefy brakujących kontraktów mutacyjnych.
- Kubełek B: pusty.
- Kubełek C: dziewięć wierszy ma wskazany konkretny przelot właściciela, ale jego trwały zakres zależy od decyzji o kotwicy. Nie wolno mi zastąpić tej decyzji synonimem PASS.

Tabela wiersz → dowód zmieniający macierz jest pusta. Commity R1–R4 dodają dowody pomiarowe, lecz żaden nie daje podstawy do zmiany stanu całego wiersza G19.

## Część B — pytanie o kotwicę

### Fakt wymagający decyzji

Wiersz G19 mówi o 49 plikach od `316bce9dd9` do `fee24bddb0`. Dzisiejszy zachowany pomiar mówi o 106 plikach, w tym 90 bez testów. Dystans od tej samej kotwicy do markera `29fcbd4de2` wynosi 1216 commitów, 1015 bez merge albo 315 po first-parent; liczba 615 nie jest odtwarzalna z zapisanej kotwicy. Każdy kolejny merge zmienia mianownik, więc dowód pozbawiony reguły ważności starzeje się natychmiast.

### Wariant A — kotwica zamrożona na SHA odbioru

Każdy dowód G19 wiąże się z jednym wskazanym SHA i dotyczy dokładnie zmian do tego SHA. Bramka może zostać opisana jako zamknięta tylko dla tej wersji; przy następnym odbiorze lub merge wygasa i wymaga ponownego przeliczenia oraz przelotu. Koszt: najwyższy i rosnący, potencjalnie pełne 16 modułów przy każdym cyklu. Zaleta: najprostsza, jednoznaczna granica audytowa.

### Wariant B — kotwica krocząca z progiem N

Dowód obowiązuje od ostatniego zaakceptowanego SHA dopóty, dopóki dryf w zdefiniowanych ścieżkach współdzielonych nie przekroczy N plików albo nie dotknie listy zmian krytycznych (auth, tenant scope, schema, wspólna nawigacja). Po przekroczeniu progu bramka wraca do NOT_PROVEN. Koszt: niski dla małego dryfu, okresowo wysoki; wymaga wyboru N oraz listy krytycznej. Ryzyko: sam licznik plików może nie oddawać znaczenia jednej zmiany bezpieczeństwa.

### Wariant C — kotwica per warstwa

Osobno utrzymujemy dowód dla warstwy współdzielonej (middleware, wspólne UI, słowniki) i osobno dowód modułowy (własne trasy, zapis/readback, wizualny odbiór). Zmiana warstwy wspólnej wygasza tylko dowód wspólny; zmiana modułu tylko jego wiersz. Koszt początkowy: średnio-wysoki, bo trzeba zdefiniować zbiory i właścicieli; koszt kolejnych odbiorów: niższy i proporcjonalny do promienia zmiany. Zaleta: bramka przestaje karać wszystkie 16 modułów za zmianę lokalną.

### Wariant D — kotwica zdarzeniowa według promienia zmiany

Każdy merge deklaruje dotknięte obowiązki G19 z automatycznym mapowaniem plik → warstwa/moduł; ponawia się tylko odpowiadające im kontrakty. Bramka jest sumą aktualnych, wersjonowanych dowodów. Koszt wdrożenia: najwyższy (manifest, walidator i governance), późniejszy koszt marginalny najniższy. Ryzyko: błędna klasyfikacja pliku może pominąć obowiązek, więc potrzebny fail-closed dla plików nieznanych.

### Pytanie rozstrzygalne do właściciela

Którą regułę ważności G19 przyjmujemy dla programu: **A — ZAMROŻONA**, **B — PRÓG**, **C — WARSTWY**, czy **D — ZDARZENIOWA**? Odpowiedź jednym z czterech słów ustala, kiedy dowód wygasa i jaki zakres należy ponowić; do czasu odpowiedzi nie zmieniam definicji bramki ani żadnego wiersza.
