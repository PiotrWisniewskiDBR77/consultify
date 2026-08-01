# Rejestr uzgodnień źródeł prawdy

Data pierwszego audytu: 2026-07-29

Ten dokument nie jest kolejnym SSOT produktu. Jest kontrolowaną kolejką miejsc,
w których istniejące materiały trzeba przeczytać, porównać i świadomie
zredukować do jednego kanonu oraz jawnej historii.

## Obraz skali

- 51 plików Markdown ma `SSOT` w nazwie.
- 29 z nich znajduje się bezpośrednio w `docs/product/`.
- 19 kontraktów modułów jest podłączonych do centralnego rejestru.
- około 957 plików Markdown ma techniczną końcówkę ` 2`, ` 3` lub ` 4`
  poza kwarantanną i aktywnymi worktree.

Liczby są migawką z dnia audytu, nie trwałą metryką jakości.

## P0 — rozstrzygnięcia wpływające na codzienną pracę

### P0.1 — aktualność metryk jakości

`docs/README.md` deklaruje m.in. 96% coverage i 100% pass rate. Bieżący test
`test:smoke:hubs` ma na czystym `origin/demo` wynik 4/7 z trzema nieaktualnymi
oczekiwaniami `data-testid="module-hub"`.

Do zrobienia:

1. ustalić generator metryk i datę ostatniego wiarygodnego pomiaru,
2. zastąpić liczby bez daty linkiem do CI lub datowanym raportem,
3. nie używać README jako dowodu bieżącego stanu testów.

### P0.2 — status prac: `rejestr` kontra Harvard

`rejestr/` prowadzi zadania do odbioru, a `Harvard/wdrozenie-100/` zawiera
równoległe trackery, handoffy i plany. Trzeba ustalić:

- `rejestr/` jako jedyny status pojedynczych prac,
- Harvard jako program, decyzje właściciela i evidence,
- regułę linkowania identyfikatora zadania z dokumentem programu.

Do czasu rozstrzygnięcia status wdrożenia musi być weryfikowany w kodzie,
commicie oraz dowodzie odbioru, nie tylko w jednym trackerze.

## P1 — równoległe kanony produktowe

### P1.1 — Idea Workspace

Występują co najmniej:

- `docs/product/IDEA_WORKSPACE_V3_SSOT.md`
- `docs/product/IDEA_WORKSPACE_V5_SSOT.md`
- `docs/product/IDEA_WORKSPACE_V5_FINAL_SSOT.md`
- pakiet `docs/standards/idea-workspace/`
- kontrakty modułów i czterech narzędzi Idea

Wymagane rozstrzygnięcie: jeden dokument nadrzędny dla produktu, jeden standard
wspólnej powłoki i osobne kontrakty narzędzi. Pozostałe wersje powinny otrzymać
`superseded_by`.

### P1.2 — Tabele

Występują równolegle:

- `docs/product/TABLE_V8_SSOT.md`
- `docs/modules/11_tabele/SSOT.md`
- `docs/strategy/TABELE_V8_SSOT.md`
- duży pakiet planów i work-packets table platform

Docelowy podział:

- kontrakt modułu — punkt wejścia,
- produkt — zachowanie docelowe,
- strategia — kierunek i program transformacji,
- kod/migracje — stan aktualny.

Trzeba wpisać w każdym dokumencie jawny zakres i link do pozostałych warstw.

### P1.3 — My Work Calendar

Występują:

- `docs/product/MYWORK_CALENDAR_V1_SSOT.md`
- `docs/product/MYWORK_CALENDAR_V8_SSOT.md`

Należy potwierdzić, czy V8 w pełni zastępuje V1, czy dokumenty opisują różne
zakresy. Do tego czasu kontrakt `docs/modules/02_moja-praca/SSOT.md` jest
punktem nawigacyjnym, nie automatycznym rozstrzygnięciem treści.

### P1.4 — Document Studio i materiały

Równolegle rozwijają się:

- produktowe SSOT Document Studio,
- kontrakty Dokumentów, Tabel i Prezentacji,
- kanony oraz decyzje w `Harvard/wdrozenie-100/`,
- nowe specyfikacje i odbiory z 27–29 lipca.

Należy wypromować zaakceptowane decyzje właściciela z Harvardu do kontraktów
modułów i dokumentów produktowych. Handoff pozostaje historią sesji.

## P2 — higiena historyczna

### P2.1 — kopie numerowane

Kopie ` 2`, ` 3`, ` 4` nie mogą być linkowane z rejestru kanonicznego.
Ich usuwanie wymaga porównania treści z plikiem bez suffixu. Bezpieczny proces:

1. porównaj hash i treść,
2. identyczne przenieś do kwarantanny,
3. różniące się oznacz jako `needs-merge`,
4. przenieś unikalne ustalenia do kanonu,
5. dopiero potem archiwizuj kopię.

### P2.2 — słowa `FINAL`, `MASTER`, `KANON`

Nazwa pliku nie określa autorytetu. Dokument otrzymuje autorytet wyłącznie
przez rejestr domeny, status i zakres.

### P2.3 — raporty bez daty aktualności

Raport readiness/audit powinien wskazywać commit, środowisko i datę. Bez nich
jest materiałem historycznym, nie dowodem obecnego działania.

## Definicja zakończenia pojedynczego uzgodnienia

- wybrano jeden dokument kanoniczny dla konkretnego zakresu,
- dokumenty przegrywające mają `superseded_by` albo jawnie inny zakres,
- kontrakt modułu linkuje do rozstrzygnięcia,
- rejestr maszynowy nadal przechodzi,
- zmiana nie deklaruje wdrożenia bez dowodu runtime.
