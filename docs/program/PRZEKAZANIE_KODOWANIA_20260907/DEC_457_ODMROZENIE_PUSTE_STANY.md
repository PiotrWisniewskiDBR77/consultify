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

---

# DEC-459 — odmrożenie: przewodnik „jak zacząć" (mapa pracy)

**Moduł:** `15_SETTINGS` · **Pliki:** `src/views/AppIntroView.tsx`, `src/components/Onboarding/FirstRunOnboarding.tsx`
**Zakres koszyka 2:** pozycja 2.7, kryterium 7, lista S2.11

Ekran `/app-intro` istnieje i jest podpięty z Pomocy. Zamrożony 05.09. Robotnik P6 zmierzył na nim
dwie rzeczy, które trzeba naprawić przed jutrzejszym pilotażem:
1. **Naruszenie kanonu crimson** — odznaka, ikony kroków i akcent używały `primary-*`, czyli #85182F.
   To jest złamanie `CLAUDE.md` §3: czerwień wyłącznie dla semantyki krytycznej. Przewodnik nią nie jest.
2. **Brakował krok „kontekst organizacji"** — mapa pokazywała 5 etapów zamiast 6, a kroki nie miały
   linków, czasu ani wymagania wejścia.

Nadzorca obejrzał zrzut `evidence/p6-przewodnik-20260910/01-pl-light.png` i znalazł **trzeci defekt,
którego robotnik nie zgłosił**: w polskim interfejsie sześć nazw jest po angielsku — „Przejdź do
Interview", „My Work", „Ideas / Workplace / Notes", „Finance", „Reports / Presentations", „Help
wyjaśnia pracę", „Jak działa Help". To dokładnie ekran, który jutro rano zobaczy czworo polskich
testerów jako pierwszy.

**Odmrażam te dwa pliki** w zakresie: struktura mapy pracy, tokeny kolorów, tłumaczenia nazw modułów,
odsyłacz z kreatora. Znacznik: `[ODMROZENIE 15_SETTINGS DEC-459]`.

**Dodatkowo:** z listy modułów wspierających znika **Finanse** — moduł nie ma pozycji w menu głównym,
więc przewodnik nie może go obiecywać.

Warunek ten sam co przy DEC-457: zrzut PRZED i PO, akcept właściciela przed promocją na demo.

---

# DEC-460 — odmrożenie: przycisk eksportu danych organizacji

**Moduł:** `14_ADMIN` (`src/views/superadmin/OrganizationsView.tsx`) · **Kryterium:** koszyk 2 nr 12, lista S2.7

Kryterium mówi wprost: eksport organizacji **działa z interfejsu**. Robotnik P5 zbudował i przetestował
warstwę serwera (eksport JSON i CSV, odkrywanie tabel dynamiczne, dowód w `evidence/p5-eksport-20260910/`),
ale nie mógł dodać przycisku — to nowy element w zamrożonym module, a DEC-457 obejmuje tylko podpięcie
**istniejącego** handlera.

Przy okazji zmierzył, że **usuwanie organizacji było martwe w stu procentach**: interfejs nie wysyłał
wymaganego potwierdzenia, więc każde kliknięcie kończyło się odmową. Naprawa usuwania weszła pod DEC-457
(istniejący przewód). Zostaje sam przycisk eksportu.

**Odmrażam** `OrganizationsView.tsx` w zakresie: dodanie jednego przycisku eksportu wołającego gotowego
klienta `Api.exportOrganizationData` i zapisującego plik. Zero zmian układu tabeli organizacji, zero
zmian innych akcji. Znacznik: `[ODMROZENIE 14_ADMIN DEC-460]`.

Warunek ten sam: zrzut PRZED i PO, akcept właściciela przed promocją na demo.

---

# Uwaga wykonawcza do wszystkich odmrożeń — język pustych stanów

Odbiór 10.09 wykazał, że część naprawionych pustych stanów mówi żargonem inżynierskim, np.
„Nadzorowane skoroszyty i eksporty pojawią się tutaj poprzez ten sam **kanoniczny rejestr artefaktów**".

Adresatem jest konsultant pierwszej linii kontaktu z klientem, nie programista. Obowiązuje słownik:
**dokument** zamiast „artefakt", **rozmowa** zamiast „sesja", **wynik** zamiast „output", i żadnego
„kanonicznego", „rejestru", „projekcji", „runtime". Zdanie ma mówić, co tu będzie i co zrobić.
