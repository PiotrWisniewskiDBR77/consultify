---
doc_id: przekazanie-grafika-20260902
status: canonical
truth_type: handover
established: 2026-09-02
od: nadzorca toru grafiki (sesja 02.09)
dla: następcy — czytaj PRZED dotknięciem czegokolwiek
---

# PRZEKAZANIE — tor Grafika, 02.09.2026

Liczby poniżej są **zmierzone w tej samej sesji, w której powstał ten plik**, nie przepisane
z pamięci ani z wczorajszego przekazania. Gdzie liczba różni się od wczorajszej — piszę, dlaczego.

---

## 1. ZACZNIJ TU

**Kolejność czytania:** ten plik → §4 „CZEGO NIE POWTARZAĆ" → `RESZTA_ODBIORU_20260902.md`
(co zostało właścicielowi) → `DZIENNIK_GRAFIKA.md` wpisy Z-42…Z-47 → `00_ZASADY_PRACY.md` reguły 0–21.

**★ GAŁĄŹ — najważniejsza rzecz w tym dokumencie.** Pracujesz lokalnie w `/private/tmp/m03`
na `codex/m03-admin-20260824`. Ale **na `github-backup` gałąź o tej samej nazwie NIE JEST twoją
pracą** — pushuje tam tor funkcji i była dziś rano **545 commitów przed** naszym stanem. Mój push
został odrzucony jako non-fast-forward, a scalanie miałem zakazane. Dlatego:

> **Linia grafiki na `github-backup` to `grafika/m03-20260902`. Tylko ona.**

Kto weźmie ze zdalnego `codex/m03-admin-20260824`, dostanie linię toru funkcji **bez ani jednej
naprawy grafiki**. Sprawdź to sam, zanim cokolwiek scalisz:
```
git rev-list --count HEAD..github-backup/codex/m03-admin-20260824
```

**Podnieś stanowisko:** `node scripts/dev/stanowisko.mjs start` (harness :3020, strona odbioru :3030).
**Nie rób `restart`, gdy obie usługi odpowiadają** — dziś zrobiłem to niepotrzebnie i harness
wstawał kilka minut, w czasie których właściciel mógł otworzyć stronę.

**Budowa:** `npm run build` **PADA na tym repozytorium** — `Abort trap: 6`, wyczerpanie pamięci V8,
**nie błąd kodu**. Przechodzi z `NODE_OPTIONS="--max-old-space-size=8192" npx vite build`
(dziś: `✓ built in 37.10s`). Bramka budowy wołająca gołe `npm run build` zamelduje fałszywą porażkę.

---

## 2. STAN LICZBOWY (zmierzone 2026-09-02)

| Miara | Wartość | Zmiana wobec 01.09 | Źródło |
| --- | --- | --- | --- |
| Ekranów w rejestrze | 313 | bez zmian | `status.json` |
| — ocena A | 179 | **−2** (dwie uczciwe obniżki, patrz niżej) | policzone |
| — ocena B | 74 | +2 | policzone |
| — ocena C | 27 | bez zmian | policzone |
| — ocena D | 33 | bez zmian | policzone |
| Kart A/B do odbioru | 253 | bez zmian | policzone |
| **Kart A/B bez decyzji właściciela** | **0** | — | `odbior.sqlite` |
| Kart czekających na jego ponowne spojrzenie | **7 — KOMPLET, wszystkie ze świeżym zrzutem obejrzanym przeze mnie** | — | `reszta-odbioru.json` |
| Kart czekających na budowę (nie do oceny) | 11 | — | j.w. |
| Commitów w tej sesji | 40+ | — | `git log --since` |
| Scaleń rodzin | 7 | — | `git log --merges` |
| Plików produktu zmienionych | 42 (+1175 / −617) | — | `git diff --stat` |
| Zrzutów dołożonych | 605 | — | `git diff --name-only -- evidence/` |
| Bramka parytetu: R1 | 32 ekrany (było 41) | **−9** | `check-dev-render-parytet.mjs` |
| Bramka parytetu: linia bazowa | 103 pozycje (było 112) | −9 | j.w. |
| Bramka odbioru | CZYSTO, 253 karty / 506 zdjęć | — | `odbior-kontrola.mjs` |

**Dwie obniżki oceny A→B są celowe i uczciwe:** `ntype-analizuj-ai` (kadr pokazuje sam panel
analizy, nie całą kartę — własność przyrządu, nazwana wprost) oraz `fab-rail-kebab` i
`admin-command-attention-queue` (defekty widziane przeze mnie i wypisane przed spojrzeniem
właściciela). Ocena, która spada, bo zaczęliśmy patrzeć uczciwiej, jest lepsza niż ocena, która stoi.

---

## 3. CO ZROBIONO — dziewięć rodzin

Każda naprawiona **u przyczyny, nie per ekran**, każda z parą zrzutów PRZED/PO w obu motywach.

| Rodzina | Co było | Gdzie naprawione |
| --- | --- | --- |
| **Pastylka trybu kanwy** | „SEL"/„LNK"/„DRW" po angielsku na 6 ekranach; „PAN" nie miał nawet klucza tłumaczenia | `CanvasLeftToolbar.tsx` + oba pliki tłumaczeń |
| **Czerwień na treści neutralnej** | baner GDPR, ryzyka/szanse, scenariusze, karta firmy w ciemnym motywie, „Wygasło/Cofnięto", waga DLP | 8 plików; wspólna mapa statusów zamiast wywołań |
| **Ucięcia tekstu** | `parsePx('26%')` zwracał `26` → kolumna dostawała 26 px zamiast 26% | **u źródła** w `FilterableTable.tsx` + 12 plików + wielokropek w kalendarzu |
| **Angielskie resztki** | 7 różnych przyczyn, nie jedna mapa | 13 plików |
| **Parytet 6 ekranów** | harness pokazywał własną kompozycję zamiast produktu | 6 plików `dev-render/screens/` |
| **Bramka parytetu** | oskarżała uczciwe ekrany | `check-dev-render-parytet.mjs` |
| **Podgląd Idei + szerokość Admina** | brak bloku „Szczegóły"; zwężenie 1200 px było wklejką przyrządu | `IdeaPreview.tsx` (dwie kopie scalone) + 8 harnessów Admina |

| **Odmiana liczebnika po polsku** | „1 dni", „1 testów nieudanych" — kod pisany pod angielski wzorzec daje zły wynik akurat dla liczby 1 | `src/utils/liczebnik.ts` + test (11 przypadków) + 2 ekrany; ~68 wystąpień w ~46 plikach i 156 kluczy **nazwane liczbowo** w `ODLOZONE.md` |
| **Język menu kanwy i surowe wartości techniczne** | menu mieszało języki w jednej grupie; `monthly`, `quarterly`, `CASH`, `LONG_TERM_DEBT`, `OPEN_ORG` wychodziły na ekran | 19 kluczy kanwy + słownik OKR + etykiety ROI + linie finansowe; dwa punkty świadomie zostawione z namiarem plik:linia |

**Domknięte po drodze, poza rodzinami:** polska nazwa modułu w ścieżce nawigacji (jeden klucz
naprawił **sześć ekranów**); kafle KPI i tabela dokumentu przełączają się wreszcie na ciemny motyw
(malowały własne białe tło w stylach inline — komentarz w bliźniaczym `DocChartBlock.tsx:149`
**wymieniał oba te pliki jako nienaprawione**, czyli rodzeństwo czekało opisane od tygodni);
przegląd 09-Finanse i 10-Materiały wiersz po wierszu (98 obrazów, moduły oglądane pierwszy raz);
partia werdyktowa 1 dla właściciela.

**Zaciśnięte bezpieczniki (dług nie może wrócić):** parytet 112 → 103 pozycji;
fokus 128 → 114 plików / 259 → 232 wystąpienia.

---

## 4. ★ CZEGO NIE POWTARZAĆ

### Naprawiliśmy KOPIĘ dokumentu, który jest ładowany skądinąd (Z-47)

Skill `consultify-preview` poprawiono 01.09 na gałęzi roboczej. **Poprawka nie działa** — sesje
ładują skille z `/Users/piotrwisniewski/Developer/Consultify/.claude/skills/`, czyli z katalogu
głównego repozytorium, stojącego na **innej gałęzi**, gdzie leży wersja sprzed poprawki. Robotnik
dostał dziś nieaktualny kanon i zameldował rozbieżność. Zbudował wg normy, więc skończyło się dobrze.

**Reguła:** zanim uznasz dokument-instrukcję za poprawiony, sprawdź, **z którego miejsca narzędzie
go czyta**. Sprawa czeka na decyzję w `KOORDYNACJA.md` — nie ruszałem katalogu głównego, bo stoi
na gałęzi drugiego toru.

### Popełniłem dokładnie ten błąd, który godzinę wcześniej wytknąłem bramce (Z-45)

Zgłosiłem 12 ekranów jako „zbudowane, ale niepodłączone", szukając wołaczy wzorcem `<Nazwa`.
Dwa z nich **są** renderowane — przez otoczki `lazy()` wewnątrz `FinanceHub.tsx`. Czyli przegapiłem
to samo, co w tym samym dokumencie zarzuciłem bramce.

Złapał to robotnik, bo zlecenie kazało mu **sprawdzić moją liczbę, zamiast przyjąć ją na wiarę**.
To trzeci raz w tym programie, gdy jedno takie zdanie w instrukcji zwraca się natychmiast.
Koszt: zero. **Pisz je w każdym zleceniu pomiarowym.**

Narzędzie liczące poprawnie: `scripts/dev/grafika-wolacze.mjs`. Dwie wcześniejsze wersje, pisane
przez `grep` w `execSync`, meldowały „BRAK WOŁACZA" nawet dla komponentu ręcznie potwierdzonego —
cytowanie w `zsh` zjadało wzorce. **Narzędzie pomiarowe napisane w pośpiechu kłamie tak samo jak to,
które krytykujesz.**

### Uczciwy kadr natychmiast odsłania defekty, które rysunek ukrywał (Z-46)

Sześć ekranów przerobiono, żeby montowały realny produkt. W tej samej godzinie wyszły **trzy defekty
produktu**, których wcześniej nie było widać: menu kanwy miesza języki w jednym menu; podgląd OKR
pokazuje surowe wartości techniczne; jeden ekran renderował wyłącznie komunikat „jeszcze nie włączone"
— właściciel ocenił kadr, w którym nie było czego oceniać.

**Nie meldować „naprawiliśmy 6 ekranów" bez dopisania, ile defektów to odsłoniło.** I nie pokazywać
właścicielowi świeżo uczciwego kadru, zanim się go nie obejrzy — **pierwszy uczciwy obraz bywa gorszy
niż ostatni nieuczciwy.**

### Bramka rozpoznaje wzorzec zapisu, nie rzecz — sześć ślepot w jeden dzień

Dwie naprawione (`React.lazy`, wołacz w pliku definicji), cztery zgłoszone (#39 i meldunek robotnika):
szerokość podana w `style` zamiast w klasie; komponent montowany przez alias; brak `page` na liście
parametrów wariantujących; nierozwijane `<Routes>`. **Bramka, która karze uczciwe ekrany, uczy
ignorować własne ostrzeżenia — a wtedy przepuści też te prawdziwe.**

Każda naprawa bezpiecznika ma mieć **obie kontrole**: dodatnią (przestaje oskarżać to, co uczciwe)
i ujemną (nadal łapie to, co realnie zepsute) plus **dowód mutacyjny**. Dzisiejsza naprawa je miała
i dlatego jej ufam.

### Zgłoszenie punktowe to zawsze hipoteza o zasięgu

Potwierdzone dziś czterokrotnie. Trzy zgłoszone ucięcia → **trzy różne mechanizmy**, z czego jedno
w ogóle nie było ucięciem (zasłonięcie przez przypiętą kolumnę), a jedno dotyczyło ekranu, którego
w produkcie nie ma. Dwa zgłoszone mieszania języków → **siedem różnych przyczyn**. Jeden zgłoszony
„SEL" → cztery tryby, z których jeden nie miał nawet klucza. Jedna zgłoszona zła szerokość → **osiem
harnessów Admina** z tą samą wklejką.

**Zlecenie ma zawsze zawierać KROK 0: wypisz całe rodzeństwo, przy każdym powiedz, czy ma poprawkę.**

### Pułapki narzędziowe, w które wpadłem osobiście dzisiaj

| Pułapka | Objaw | Lekarstwo |
| --- | --- | --- |
| Polski cudzysłów zamykający w skrypcie Pythona | `SyntaxError` w połowie literału | pisz skrypt do pliku, nie przez heredoc |
| `grep --include=*.tsx` bez cudzysłowów w `zsh` | **pustka zamiast wyników** | `--include="*.tsx"` i sprawdź, czy polecenie się wykonało |
| `grep` milczy na `check-dev-render-parytet.mjs` | plik wykryty jako binarny | `grep -a` |
| `npm run build` | `Abort trap: 6` | `NODE_OPTIONS=--max-old-space-size=8192` |
| Pełny katalog roboczy = 2,8 GB | dysk pada przy czterech robotnikach | `scripts/dev/grafika-worktree.sh` — wąski wycinek, 200 MB |

---

## 5. CO JEST OTWARTE

### Dla właściciela — 7 kart do obejrzenia, 11 czekających na budowę

Strona `:3030` otwiera się na filtrze **„★ Zostało do obejrzenia"**. Nie wystawia mu 253 kart od nowa:
przekliknął już wszystkie. Karty „czeka na budowę" **nie mają przycisków oceny** — ich gotowość nie
zależy od wyglądu, więc nie ma czego oceniać; każda niesie numer zgłoszenia.

### Dla toru funkcji — 41 spraw w `ZGLOSZENIA_DO_TORU_FUNKCJI.md`

Dziś dołożone: **10 ekranów zbudowanych i niepodłączonych** (#24–#33, po sprostowaniu), 710 kluczy
polskich z angielską wartością (#38), cztery dalsze ślepoty bramki (#39), surowy identyfikator zamiast
nazwy na czterech ekranach Wyników (#40), ubogi panel uwagi (#41). **Dopisuj na końcu — tor funkcji
startuje z tego pliku i edytowanie istniejących wpisów zerwie mu punkt odniesienia.**

### Świadomie odłożone (`ODLOZONE.md`, wpisy z 02.09)

Zasłonięcie ostatniej kolumny przez przypiętą kolumnę akcji (wymaga pojęcia priorytetu kolumn, którego
produkt nie ma); luka we wspólnym mechanizmie klamrowania tekstu (naprawa dotyka dziesiątek już
odebranych ekranów); `results-zestawienia` istniejący wyłącznie w przyrządzie; odmiana liczebnika
po polsku (w toku).

### Decyzja czekająca na drugi tor

Skille żyją w dwóch miejscach — `KOORDYNACJA.md`, wpis z 02.09. Albo katalog główny dostaje poprawkę
osobnym commitem, albo skille przestają być duplikowane.

---

## 6. PROTOKÓŁ Z WŁAŚCICIELEM — bez zmian, ale z jednym wzmocnieniem

Właściciel mówi po polsku, krótko, obrazkami; żargon go blokuje („nie wiem, o czym mówisz").
Ceni surową szczerość i sprostowania cudzych **oraz własnych** błędów bardziej niż dobre wiadomości.
Pytamy go wyłącznie o to, co widzi oczami, i o decyzje biznesowe.

**Wzmocnienie z dzisiaj:** przy każdej karcie, która wraca do niego po naprawie, piszemy nie tylko
CO naprawiliśmy, ale też **CO ZOSTAJE NIE TAK** — zanim spojrzy. Karta `admin-command-attention-queue`
wraca z trzema wypisanymi brakami mimo naprawy szerokości. To jest różnica między „do akceptu"
a „do odkrywania zepsucia".
