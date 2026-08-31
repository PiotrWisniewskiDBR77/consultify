# PAKIET WERDYKTOWY — PARTNER (moduł 16_PARTNER)

Przygotowano na posiedzenie D-17, wieczór 2026-08-31. Źródło: repo `/private/tmp/m03`,
dokładny tip `github-backup/codex/m03-admin-20260824` (SHA `c50847c25974d9a38783ab02362c8078716dab53`).
Karta źródłowa: `docs/program/waves/WAVE_03_ACCEPTANCE/modules/16_PARTNER/MODULE_ACCEPTANCE.md`.

**UWAGA WSTĘPNA O ŚWIEŻOŚCI KARTY:** karta `MODULE_ACCEPTANCE.md` na dokładnym tipie
kończy się na wpisie „Day177 — wznowienie i realny przejazd G08” (2026-08-30, godz. wieczorne).
Dyżury 188 i 189 (naprawy backendu rozliczeń/projektów oraz i18n) **są już scalone w
historii gita** (`git log`: `odbiory 188+193: OBA SCALONE`, `odbior 189: SCALONO po FIX-189`),
ale karta modułu nie ma jeszcze osobnego wpisu je opisującego. Ten pakiet czyta więc
kartę + raporty dyżurowe + realne commity, nie tylko kartę.

---

## 1. STAN MODUŁU (jednym akapitem)

Bramka: `TECHNICAL_BROWSER_PASS / OWNER_PENDING / ECONOMICS_OFF`. Ekonomia (prowizje,
wypłaty) jest **świadomie wyłączona w MVP** — to nie defekt, to decyzja zakresu
(`AMD-PRT-ECONOMICS-002`). Dyżur 177 (30.08, wznowiony po zasadnym STOP-ie) przejechał
realnym, zalogowanym kontem właściciela **25/25 sekcji w Light i Dark = 50/50 zrzutów**:
17 sekcji renderuje się poprawnie, 7 kończyło się błędem (HTTP 500 na wspólnej ścieżce
`earnings-summary` + cichy błąd SQL `uuid = text` na Organizations/Projects), 1 sekcja
(„Users”) pokazywała fałszywe „0” mimo danych w fixture. Lokalizacja PL była wtedy
rozlana na `23/25` ekranów (głównie breadcrumby i nazwy zasobów). Dyżur 188 naprawił
**mutacyjnie** oba defekty backendowe (500→200 z jawnym `POLICY_NOT_APPROVED`; błąd
projektów przestał się maskować jako pustka) — ale **nie ma dowodu przeglądarkowego**
tej naprawy, a adwersarski odbiór (`odbiory 188+193: OBA SCALONE`) wprost zostawił
zdanie „**baner earnings do decyzji właściciela**” — czyli wizualny skutek naprawy jest
dziś dla Ciebie otwartym pytaniem, nie faktem. Dyżur 189 naprawił i18n na czterech
najgorszych ekranach (learning-path, metrics, earnings, organizations) i **to jest
potwierdzone wzrokiem** (patrz sekcja 2). Pozostałe ~19 ekranów i tak miały tylko
kosmetyczne braki (breadcrumb/nazwa zasobu po angielsku), nie błędy funkcjonalne.

---

## 2. TABELA EKRANÓW — klikaj werdykt tutaj

Baza: pełny przejazd Day177 (25 sekcji × Light/Dark), katalog
`/private/tmp/cx-day177-partner-artefakty/177-<id>--<light|dark>.png`
(zweryfikowano `ls` — katalog istnieje, 79 plików, w tym 50 zrzutów + hashe
`177-ALL-SHA256SUMS.txt`). Cztery ekrany mają nowszy, poprawiony zrzut z Day189
w `/private/tmp/cx-day189-partner-i18n-artefakty/` — dla nich w tabeli jest ścieżka Day189.

**Zrzuty faktycznie obejrzane (Read) w tym pakiecie, min. 4 wymagane:**
`day189-learning-path-pl-final-5065acfe32.png`, `day189-metrics-pl-final-5065acfe32.png`,
`day189-earnings-pl-final-5065acfe32.png`, `day189-organizations-pl-final-5065acfe32.png`,
`177-dashboard--light.png`, `177-users--light.png` (6 obejrzanych).

| # | Ekran | Zrzut (ścieżka) | Stan (z dowodu) | Rekomendacja |
|---:|---|---|---|---|
| 1 | partner-home | `177-partner-home--{light,dark}.png` | czysty, PL spójny | ACCEPT |
| 2 | dashboard | `177-dashboard--{light,dark}.png` | **obejrzano**: wizualnie czysty PL, ale w tle trafia na 500/006 (cichy błąd, niewidoczny na ekranie) | ACCEPT ekranu, ale świadomość cichego błędu w tle |
| 3 | metrics | `day189-metrics-pl-final-5065acfe32.png` | **obejrzano po fixie 189**: czysty PL, zero angielskich etykiet KPI | ACCEPT |
| 4 | referral-tools | `177-referral-tools--{light,dark}.png` | renderuje się; angielski breadcrumb | ACCEPT-OUT (kosmetyka) |
| 5 | referral-analytics | `177-referral-analytics--{light,dark}.png` | renderuje się; angielski breadcrumb | ACCEPT-OUT (kosmetyka) |
| 6 | referred-organizations | `177-referred-organizations--{light,dark}.png` | renderuje się; nazwa fixture `Wave 3 Referred Participant` (dane, nie defekt) + breadcrumb EN | ACCEPT-OUT (kosmetyka) |
| 7 | earnings | `day189-earnings-pl-final-5065acfe32.png` (i18n) + backend fix D188 | **obejrzano**: treść blokady w całości po polsku i uczciwa. Backend 500→200 naprawiony mutacyjnie (D188), **wizualny skutek NOT_PROVEN** | **DECYZJA WŁAŚCICIELA** — patrz sekcja 3 |
| 8 | statements | `177-statements--{light,dark}.png` (stary, sprzed D188) | dzieli ścieżkę z earnings; ten sam status | jak wyżej |
| 9 | payouts | `177-payouts--{light,dark}.png` (stary, sprzed D188) | dzieli ścieżkę z earnings | jak wyżej |
| 10 | payout-settings | `177-payout-settings--{light,dark}.png` (stary, sprzed D188) | dzieli ścieżkę z earnings | jak wyżej |
| 11 | client-access | `177-client-access--{light,dark}.png` | renderuje się; angielski breadcrumb | ACCEPT-OUT (kosmetyka) |
| 12 | organizations | `day189-organizations-pl-final-5065acfe32.png` | **obejrzano**: etykiety/statusy PL; nazwa organizacji `Wave 3 Referred Participant` to dane fixture; **tabela ucina prawą kolumnę** (kolumna „OCEN…” wychodzi poza kadr — widoczne na zrzucie) — PRT-D112-003, nienaprawione | FIX (obcięcie tabeli) przed pełnym ACCEPT tego ekranu |
| 13 | projects | `177-projects--{light,dark}.png` (stary, sprzed D188) | backend fix D188 zmienia cichy błąd (fałszywe „Brak aktywnych projektów”) na jawny stan błędu — **wizualnie NOT_PROVEN** | **DECYZJA WŁAŚCICIELA** — patrz sekcja 3 |
| 14 | users | `177-users--{light,dark}.png` | **obejrzano**: breadcrumb `Clients > Team Members` po angielsku; pokazuje „0 users” mimo że fixture ma partnerów-użytkowników — nierozstrzygnięte, czy to defekt czy brak kontraktu API | FIX/rozstrzygnąć przed ACCEPT tego ekranu |
| 15 | learning-path | `day189-learning-path-pl-final-5065acfe32.png` | **obejrzano po fixie 189**: statusy/etykiety PL (Zablokowano, Wymaga oceny…); nazwy kursów pozostają EN — to dane fixture, zgodnie z zasadą „dane nie są tłumaczone” | ACCEPT |
| 16 | exams | `177-exams--{light,dark}.png` | renderuje się; dane obecne, angielskie nazwy/statusy | ACCEPT-OUT (kosmetyka) |
| 17 | certificates | `177-certificates--{light,dark}.png` | renderuje się; angielska nazwa/breadcrumb | ACCEPT-OUT (kosmetyka) |
| 18 | company-info | `177-company-info--{light,dark}.png` | renderuje się; angielski breadcrumb/nazwa | ACCEPT-OUT (kosmetyka) |
| 19 | specializations | `177-specializations--{light,dark}.png` | renderuje się; angielski breadcrumb | ACCEPT-OUT (kosmetyka) |
| 20 | regions | `177-regions--{light,dark}.png` | renderuje się; angielski breadcrumb | ACCEPT-OUT (kosmetyka) |
| 21 | public-listing | `177-public-listing--{light,dark}.png` | renderuje się; angielski breadcrumb i cała karta preview | ACCEPT-OUT (kosmetyka) |
| 22 | documentation | `177-documentation--{light,dark}.png` | renderuje się; angielski breadcrumb, nagłówki, nazwy zasobów | ACCEPT-OUT (kosmetyka) |
| 23 | marketing | `177-marketing--{light,dark}.png` | renderuje się; angielski breadcrumb/nazwy zasobów | ACCEPT-OUT (kosmetyka) |
| 24 | case-studies | `177-case-studies--{light,dark}.png` | renderuje się; angielski breadcrumb/nazwy zasobów | ACCEPT-OUT (kosmetyka) |
| 25 | templates | `177-templates--{light,dark}.png` | renderuje się; angielski breadcrumb/nazwy zasobów | ACCEPT-OUT (kosmetyka) |

Suma Day177: **17 renderuje się / 7 błąd / 1 pusty/nierozstrzygnięty**, 50/50 zrzutów zrobionych.
Po Day188+189: 2 z 7 „błędów” (i18n na earnings/organizations) potwierdzone naprawione
wzrokiem; sam mechanizm błędu (500, uuid=text) naprawiony mutacyjnie, ale bez nowego
zrzutu weryfikującego widok na żywo.

---

## 3. OTWARTE POZYCJE — do świadomej decyzji właściciela (accept-out / deferred)

1. **Ekonomia OFF (prowizje, wypłaty, accrual)** — świadoma decyzja zakresu MVP,
   `AMD-PRT-ECONOMICS-002`. Rekomendacja: ACCEPT-OUT bez dyskusji, to nie defekt.
2. **Baner „Rozliczenia partnera są niedostępne” na earnings/statements/payouts/
   payout-settings** — kod backendu już nie rzuca 500 (dyżur 188, dowód mutacyjny,
   `odbiór 188+193 SCALONE B+`), ale nikt nie sprawdził w przeglądarce, czy po naprawie
   ten sam bursztynowy baner nadal się pokazuje sensownie, czy trzeba dopiąć osobną
   licencję na `EarningsSection.tsx` (raport dnia 188, punkt „Korekty… 5”). Recenzenci
   sami zapisali: „**baner earnings do decyzji właściciela**”. Rekomendacja: pokazać ten
   ekran na żywo PRZED podpisaniem, albo świadomie odłożyć jako `DEFERRED_VISUAL_CHECK`.
3. **Organizations — obcięta prawa kolumna tabeli** (PRT-D112-003) — potwierdzone na
   zrzucie Day189, nienaprawione. Kosmetyczny, ale realny defekt tabeli.
4. **Users — „0 users” mimo danych w fixture** — nierozstrzygnięte, czy defekt czy brak
   kontraktu. Wymaga jednej decyzji: FIX teraz czy accept-out z jasnym ticketem.
5. **19/25 ekranów ma wyłącznie kosmetyczne resztki angielskiego** (breadcrumb, nazwy
   zasobów) — świadomie nie objęte fixem 189 (fix 189 celował w 4 najgorsze ekrany).
   Rekomendacja: accept-out jako backlog i18n, analogicznie do Organization/Settings
   (tam też zaakceptowano z listą kosmetycznych braków w backlogu).
6. **`PRT-D62-006` projekty (`uuid = text`)** — backend naprawiony mutacyjnie (dyżur
   188), brak nowego zrzutu potwierdzającego działanie na żywo.

---

## 4. CZEGO NIE POKAZUJEMY DZIŚ I DLACZEGO

- **Nie pokazujemy kwot/prowizji/wypłat jako realnych liczb** — ekonomia jest OFF,
  wszystkie wartości to zera/`null` z definicji, nie dowód działania silnika rozliczeń.
- **Nie prezentujemy earnings/statements/payouts/payout-settings jako „naprawione”** —
  backend jest naprawiony mutacyjnie, ale wizualny skutek jest jawnie `NOT_PROVEN`.
  Pokazanie zrzutu Day189 (który wygląda czysto) bez tego zastrzeżenia byłoby
  wprowadzeniem w błąd, bo ten zrzut mógł być zrobiony przed pełnym wejściem fixu
  do tej konkretnej gałęzi uruchomieniowej.
- **Reguła „nie pokazuj learning-path przed 189” — DEZAKTUALNA, sprawdzone.**
  Przed dyżurem 189 learning-path miał „rozległy angielski content” (raport 177).
  Zrzut `day189-learning-path-pl-final-5065acfe32.png` obejrzano osobiście w tym
  pakiecie: etykiety, statusy i przyciski produktu są po polsku; angielskie pozostają
  wyłącznie **nazwy kursów** (`Delivery Advanced Certification` itd.), a to jest dana
  z fixture, nie tekst produktu — zgodnie z zasadą „danych się nie tłumaczy”. **Można
  już pokazywać ten ekran.**
- **Nie pokazujemy `/superadmin` ani żadnej ścieżki backup/restore** — poza zakresem
  modułu Partner.
- **Nie twierdzimy „i18n zamknięte na 25/25”** — to twierdzenie było już raz fałszywie
  zamknięte i wychwycone adwersarsko (`odbior 189: SCALIC po FIX — fałszywie zamknięta
  pozycja R1 payout FAILED/CANCELLED surowo`, naprawione w `3fc89e1bd2`). Prawdziwy stan
  to: 4 najgorsze ekrany potwierdzone wzrokiem, reszta to kosmetyczny dług.

---

## 5. PROPONOWANY WERDYKT

**Rekomendacja: ACCEPT WARUNKOWY**, pod warunkiem że właściciel świadomie zaakceptuje-out
pozycje 1, 3, 4, 5 z sekcji 3 (wpisać do karty), a pozycję 2 (baner earnings) albo
zobaczy na żywo w trakcie posiedzenia, albo świadomie odłoży z jawnym ticketem
`PRT-DEFERRED-EARNINGS-BANNER`. Główna podróż z Contractu (profil → certyfikacja →
atrybucja → ledger, z zablokowaną ekonomią) jest udowodniona 25/25 sekcji, realnym
logowaniem, bez fałszywych stanów ekonomii.

- **Tag:** `final-16-partner`
- **Wpis do karty przy ACCEPT** (wzorem `final-01-organization` / `final-02-settings`):

```
## CLOSED_FINAL — 2026-08-31

Status: `CLOSED_FINAL` · Werdykt właściciela: DEC-2026-08-31-XX (accept warunkowy —
warunki: baner earnings zweryfikowany na żywo / świadomie odłożony jako
PRT-DEFERRED-EARNINGS-BANNER).
Final SHA: `c50847c25974d9a38783ab02362c8078716dab53` · Tag: `final-16-partner`.
Zakres zamknięcia: 25/25 sekcji Light+Dark (dyżur 177), naprawa backendu
earnings-summary 500→200 i projects error≠pustka (dyżur 188, mutacja), i18n na
4 najgorszych ekranach (dyżur 189, zrzuty obejrzane). Ekonomia (prowizje/wypłaty)
poza MVP — AMD-PRT-ECONOMICS-002.
Backlog po-MVP (nowe ID): i18n kosmetyczny na 19/25 ekranach (breadcrumb/nazwy
zasobów), obcięta prawa kolumna Organizations (PRT-D112-003), „Users: 0” do
rozstrzygnięcia, wizualna weryfikacja banera earnings po fixie 500→200.
Zamknięte znaczy zamknięte.
```

**Jeśli właściciel NIE zaakceptuje warunków** (np. chce zobaczyć naprawiony ekran
earnings na żywo przed podpisem) — werdykt na dziś: `EVIDENCE_STRONG /
OWNER_LIVE_CHECK_PENDING`, tag odłożony do najbliższego dyżuru z zrzutem na żywo
portu 5048/5049 (kanonicznym runtime, nie roboczą bazą `cx188`).
