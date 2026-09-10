# DEC-457 — odmrożenie celowane: puste stany → pierwsza wartość

**Data:** 2026-09-10 · **Wydał:** nadzorca (CTO) w ramach mandatu z 31.08 · **Zakres:** koszyk 2, pozycja 2.1

## Problem
Wszystkie 14 modułów jest zamrożonych jako MVP final (`MVP_FINAL_ZAMROZONE.json`, zamrożone 05.09
słowem właściciela na odbiorze grafiki). Hook `scripts/mvp-final/check-freeze.sh` odrzuca każdy commit
dotykający ich plików. To zablokowało trzy paczki koszyka 2 naraz.

## Rozumowanie
Zamrożenie chroni **wygląd zatwierdzony przez właściciela na zrzutach**. Właściciel odbierał te ekrany
na organizacjach z danymi (Northwind, DBR77). **Ekranów pustych nie widział** — nie było ich na czym
zobaczyć. Zamrożenie nie miało chronić braku, którego odbiór nie objął.

Jutro rano cztery osoby wchodzą na świeże organizacje, gdzie każdy ekran jest pusty. To jedyny widok,
jaki zobaczą przez pierwszą godzinę.

## Decyzja
Odmrażam **wszystkie moduły** wyłącznie w tym zakresie:

**WOLNO:**
- dodać lub poprawić tekst pustego stanu (`public/locales/pl|en/translation.json`),
- podpiąć **istniejący** handler do przycisku w pustym stanie (przewód, nie nowa funkcja),
- użyć **istniejącego** komponentu pustego stanu tam, gdzie ekran pokazuje samą kreskę.

**NIE WOLNO** (zamrożenie obowiązuje dalej):
- zmieniać układu, kolorów, odstępów, typografii ekranu z danymi,
- zmieniać tabel, menu modułu, kebabów, preview,
- dodawać nowych funkcji, endpointów ani przepływów.

Znacznik commitu: `[ODMROZENIE <MODUL> DEC-457]`.

## Warunek — bez niego to nie wchodzi na demo
Każdy dotknięty ekran ma **zrzut PRZED i PO**. Właściciel ogląda je i mówi „Tak" przed promocją na demo.
To jest ta sama zasada co przy zamrożeniu: nic nie wchodzi na demo bez jego akceptu na zrzutach
(`CLAUDE.md` §5 i §7). Odmrożenie zdejmuje blokadę techniczną, nie zdejmuje odbioru.

## Powiązane
- DEC-458 (poniżej) — osobny, węższy przypadek.

---

# DEC-458 — odmrożenie: polski komunikat blokady dostępu

**Moduł:** `07_MY_WORK_AGENT` · **Plik:** `src/components/access/AccessBlockedModal.tsx`

Zmierzone przez robotnika P3: angielski komunikat z serwera zawsze wygrywa nad istniejącym polskim
tłumaczeniem dla `INSUFFICIENT_TOKENS`, `AI_LIMIT_REACHED`, `AI_TOKEN_BUDGET_EXCEEDED`, `TRIAL_EXPIRED`.
Skutek: użytkownik, któremu skończy się budżet AI, dostaje angielskie zdanie. Polskie tłumaczenie
istnieje w repo i jest martwe.

Odmrażam ten jeden plik w zakresie: **przywrócenie pierwszeństwa tłumaczenia nad tekstem z serwera**.
Zero zmian układu modala. Znacznik: `[ODMROZENIE 07_MY_WORK_AGENT DEC-458]`.

Warunek ten sam: zrzut PRZED i PO, akcept właściciela przed demo.
