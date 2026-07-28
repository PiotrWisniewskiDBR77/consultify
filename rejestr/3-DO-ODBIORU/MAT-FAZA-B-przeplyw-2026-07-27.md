# MAT-FAZA-B — Przepływ i rama modułu: koniec z wypadaniem z Materiałów

- **Stan:** DO ODBIORU (2026-07-27, 22:05)
- **Demo:** `97f4470845`, tag `demo-safe-2026-07-27-faza-b`. Deploy SUCCESS, health 200, gitSha
  potwierdzony na żywo.
- **Podstawa:** wizja właściciela `_NAGRANIE_PIOTRA_WIZJA_MATERIALY_2026-07-27.md` (N10-N13)
  + plan `_MAPA_I_PLAN_MATERIALY_2026-07-27.md` (Faza B).

## Co klikać

**1. Breadcrumb — koniec z „Document Studio › Document Studio"** (widoczne od razu, bez flagi)
Materiały → Dodaj → Dokument. W nagłówku ma być: **`Materiały › Dokumenty › Nowy dokument`**.
- „Materiały" klikalne → wraca do huba.
- „Dokumenty" klikalne → wraca do właściwej zakładki huba.
- Ostatni segment to stan bieżący (nieklikalny).
To samo dla Prezentacji (`Materiały › Prezentacje › …`) i Arkuszy (`Materiały › Arkusze › …`).
Przyczyna starego dubla: brakujący klucz tłumaczenia + układ obsługiwał twardo tylko 2 poziomy.

**2. Powrót do Materiałów w Document Studio** — strzałka w pasku studia, wraca do zakładki Dokumenty.

**3. ★ NOWY PRZEPŁYW „Z AI" — BEZ FORMULARZA** (za flagą, DOMYŚLNIE WYŁĄCZONY)
Test: `/document-studio?entry=ai&ff_zai_teresa=1`
Oczekiwane: **dokument-placeholder po lewej + Teresa po prawej**, chip „Kontekst: <nazwa firmy>"
nad rozmową. **ZERO pól** Opis/Typ/Gęstość/Cel/Odbiorcy. Wpisujesz jednym zdaniem, co ma powstać —
Teresa planuje strukturę i pisze na Twoich oczach.
Bez flagi: stary formularz bez zmian (zero ryzyka dla dzisiejszych użytkowników).
**Flagę włączymy dopiero po Twoim akcepcie** (reguła #7).

## Weryfikacja wizualna (reguła #7 — nadzorca przed Piotrem)
Zrzuty light+dark zrobione osobiście PRZED tym wpisem. Przy okazji złapane i naprawione:
angielskie zdanie w panelu Teresy („Ask Teresa from this side panel…") — dodane tłumaczenie PL/EN
dopasowane do kontekstu tworzenia materiału. Harness render-verify wymagał opakowania w pełne
drzewo kontekstów aplikacji — naprawione, żeby następne weryfikacje tego ekranu były tanie.

## Powiązane, czeka osobno na akcept
**Prototyp galerii szablonów** — gałąź `proto/galeria-szablonow`, ekran dev-render
`proto-galeria-szablonow` (NIE na demo). Miniatury niosące strukturę wzorca, przełącznik
Galeria↔Tabela, filtry z licznikami. Zrzuty light+dark pokazane Piotrowi w rozmowie 27.07.
Jedno pytanie otwarte: czy sylwetka dokumentu ma zostać wyciszona (harmonia siatki), czy
w pełnym kontraście (maksymalna czytelność struktury).
