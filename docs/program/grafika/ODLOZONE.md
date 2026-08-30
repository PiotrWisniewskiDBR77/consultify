---
doc_id: grafika-odlozone
status: canonical
truth_type: work-register
established: 2026-08-30
---

# Katalog odłożonych — ekrany, których dziś nie ruszamy

**Zasada właściciela, dosłownie:** *„nie chcemy stracić czegoś, co może mieć
wartość"*. Dlatego tu **nic nie jest kasowane**. Kod zostaje na miejscu; ten plik
jest wyłącznie **oznaczeniem i pogrupowaniem**.

## ★ Bezpiecznik

Ekran wpisany do tego katalogu **nie wchodzi do żadnej partii roboczej bez
wyraźnej zgody właściciela**. Nie wraca sam, nie wraca „przy okazji", nie wraca
dlatego, że agent go znalazł greppem.

## Format wpisu — trzy pola obowiązkowe

| Ekran / plik | Dlaczego odłożony | Co niósł wartościowego | Jak przywrócić |
| --- | --- | --- | --- |
| _pusto — katalog zakładany 2026-08-30_ | | | |

## Grupy

Wpisy grupujemy według powodu, nie według katalogu w kodzie:
- **martwy** — nie jest renderowany z żadnego punktu wejścia
- **za flagą bez decyzji** — zbudowany, czeka na rozstrzygnięcie właściciela
- **poza zakresem rundy** — świadomie odłożony decyzją
- **duplikat** — istnieje nowsza powierzchnia pełniąca tę rolę

---

## Grupa: dowody z zakończonych fal napraw (21 pozycji, wpis 2026-08-30)

**To nie są ekrany produktu.** To jednorazowe stanowiska dowodowe zbudowane po to,
żeby zrobić zrzut PRZED/PO przy konkretnej naprawie i pokazać, że naprawa zadziałała.
Sprawdziłem to czytając nagłówek każdego pliku, nie zgadując po nazwie — każdy z nich
sam się do tego przyznaje w pierwszych liniach („Screenshot-only PRZED/PO gallery",
„render-verify jednorazowy", „measurement harness", „smoke").

**Dlaczego odłożone:** właściciel ogląda produkt, a nie dokumentację naszych własnych
napraw. Postawienie tych 21 pozycji obok realnych ekranów rozmyłoby odbiór — 21 z 209
pozycji harnessu to nie ekrany do zaakceptowania, tylko archiwum dowodów.

**Co niosły wartościowego:** są zapisem, że fala napraw naprawdę się wydarzyła i jak
wyglądał stan sprzed niej. To jedyne miejsce w repo, gdzie widać „przed". Kasowanie
ich zniszczyłoby możliwość sprawdzenia, czy naprawa nie cofnęła się po miesiącach.

**Jak przywrócić:** nic nie trzeba przywracać — pliki stoją nietknięte w
`dev-render/screens/`, otwierają się tym samym adresem co zawsze. Wracają do partii
roboczej wtedy i tylko wtedy, gdy podejrzewamy cofnięcie się którejś naprawy i chcemy
porównać dzisiejszy stan z zapisanym „przed".

| Ekran | Czego dowodził |
| --- | --- |
| `crimson-mywork-wave2` | usunięcie ~36 crimsonowych przycisków w Mojej pracy |
| `crimson-wave-chrome-2026-07-26` | fala czyszczenia crimsonu w obudowie aplikacji |
| `wave3-creators-crimson` | ~250 nadużyć crimsonu w kreatorach, czacie i spotkaniach |
| `wave4-choices-crimson` | crimson na wyborach i przełącznikach |
| `wave5-internal-crimson` | crimson w Studiu, panelu nadzorcy i logowaniu |
| `settings-crimson-neutralized` | neutralizacja crimsonu w Ustawieniach |
| `accent-soft-token-fix` | błąd przezroczystości tokenu akcentu |
| `rose-danger-token-parity` | dowód, że dwie palety to ta sama paleta |
| `ui-foundation-focus-01-evidence` | niebieski fokus zamiast crimsonowego |
| `tabele-fala2-przed-po` | fala poprawek tabel z 28.07 |
| `i18n-fala1-smoke` | pierwsza fala tłumaczeń, trzy moduły naraz |
| `mindmap-i18n-smoke` | tłumaczenia modali mapy myśli |
| `staging-fixes-execution-i18n` | naprawa mieszanki językowej w Realizacji |
| `staging-fixes-initiatives-i18n` | naprawa mieszanki językowej w Inicjatywach |
| `menu-canon-sidebar-check` | potwierdzenie, że z menu bocznego znikł Excel |
| `menu-dlugi-domkniecie` | domknięcie czterech długów Menu |
| `navdeclutter-sidebar` | menu boczne z flagą odchudzenia i bez niej |
| `exe-002-004-ui-audit` | audyt kręgosłupa zarządzania realizacją |
| `mm-ppm-measure` | pomiar, czy menu kontekstowe mieści się bez przewijania |
| `capability-gate-demo` | te same przyciski w trzech trybach uprawnień |
| `odbior` | stary panel odbioru z lipca, zastąpiony przez `odbior-grafika.html` |
