---
doc_id: znaleziska-z-zrzutow-20260901
status: working
truth_type: observation
established: 2026-09-01
metoda: oględziny zrzutów przez nadzorcę (nie raport robotnika)
---

# Znaleziska z oględzin zrzutów — nadzorca, 01.09 popołudnie

**Jak powstały.** Robotnik naprawiał 4 linie odwróconej semantyki crimson i dołączył 8 zrzutów.
Nadzorca obejrzał je **własnymi oczami przed pokazaniem właścicielowi** (reguła 3). Naprawa
potwierdzona. Ale **na tych samych obrazach widać defekty, których nikt nie zgłosił** — ani
robotnik w raporcie, ani karty ekranów w `status.json`.

To jest dowód wartości oglądania zrzutu zamiast czytania raportu: raport opisuje to, czego
szukano; obraz pokazuje wszystko, co jest.

---

## POTWIERDZENIE NAPRAWY (oba ekrany, motyw jasny, oglądnięte)

**`admin-security-api-access`** — PRZED: trzy kwadraciki z kluczem w kolorze różowo-karmazynowym,
w tym dwa przy kluczach ZDROWYCH („Zapier — Initiatives sync", „DRD export cron") i jeden przy
odwołanym („Legacy webhook (revoked)" z plakietkami *Expired*/*Revoked*). Trzy czerwienie obok
siebie, nie do rozróżnienia. PO: dwa aktywne klucze **zielone na bladozielonym tle**, odwołany
pozostał czerwony na różowym. Opozycja czytelna od razu. **Naprawa działa.**

**`admin-ai-ai-operations`** — PRZED: trójkąt ostrzegawczy przy kaflu „WSKAŹNIK BŁĘDÓW / 1.2% /
221 nieudanych żądań" karmazynowy na różowym tle, mimo że 1,2% jest poniżej progu alarmu. PO:
trójkąt **szary na neutralnym tle**; czerwień w kadrze zostaje wyłącznie tam, gdzie coś naprawdę
znaczy. **Naprawa działa.**

Kontrola przyrządu: 8 różnych sum MD5 — żadnej pary „ten sam obraz pod dwiema nazwami"
(znany kształt: *duplikat zamiast motywu*). Zero pastylek harnessu w kadrze.

---

## ★ NOWE, NIEZGŁOSZONE — `admin-ai-ai-operations`

### 1. Surowy błąd zmiennoprzecinkowy wprost na ekranie (najostrzejsze)

Karty dostawców LLM pokazują: **`Priorytet: 1 | $0.015000000000000001/1k`** — przy DWÓCH z trzech
dostawców (OpenAI, Anthropic). To klasyczny artefakt arytmetyki zmiennoprzecinkowej pokazany
klientowi bez zaokrąglenia. Trzeci dostawca (DeepSeek) ma poprawne `$0.0015/1k`, więc defekt
dotyczy konkretnego działania na liczbie, nie formatowania w ogóle.

Osobno, ten sam rodzaj: kafel „SZAC. KOSZT" pokazuje **`$12.4137`** — cztery miejsca po przecinku
przy kwocie pieniężnej.

**To nie jest defekt wyglądu — to defekt zaufania.** Ekran mówiący o pieniądzach, pokazujący
`0.015000000000000001`, wygląda na niedokończony niezależnie od kolorów. Zgłoszenie do toru funkcji.

### 2. Waluta USD, format godziny amerykański

Kwoty w dolarach (`$12.4137`, `$0.0015/1k`) — do rozstrzygnięcia, czy zamierzone (koszty API
dostawców faktycznie są w USD) czy do przewalutowania. **Nie rozstrzygam sam.**
Godzina: `Ostatnie sprawdzenie: 8:00:00 AM(820ms)` — format AM/PM zamiast 24-godzinnego,
dodatkowo brak spacji przed nawiasem. To rodzina R6 (format PL), potwierdzona wzrokiem.

### 3. Trzeci poziom nawigacji w całości po angielsku — potwierdzone wzrokiem

Belka: `LLM Config · Access & Limits · Policy & Governance · Models & Providers · Features &
Privacy · Audit & Compliance · AI Health · Help Analytics` — osiem pozycji, wszystkie angielskie,
podczas gdy belka wyżej („Ustawienia zarządzania", „Operacje AI") i cała treść niżej są polskie.
Nagłówek sekcji też: `AI / LLM configuration, access governance, model providers, and token
management`. **Dwa języki na jednym ekranie, w pionie, kilka centymetrów od siebie.**

To potwierdza wzrokiem karty `admin-ai-*` z rodziny R2a — wcześniej znane tylko z greppa.

### 4. Surowe wartości systemowe w polskich zdaniach

Górny rząd kart: `Poziom zarządzania: **ADVISORY**` · `Stan przeglądu: **approved**` ·
`Kontrole kontekstu: **internal**`. Trzy surowe wartości z bazy w polskim zdaniu. Rodzina R2c.

### 5. Gwiazdka w produkcie

Plakietka `★ Domyślny` przy dostawcy OpenAI, w kolorze crimson. `CLAUDE.md` reguła nadrzędna 7
mówi wprost o zrzutach „zero gwiazdek/ozdób" — tu gwiazdka jest w samym produkcie, nie w przyrządzie.
Do przesiania razem z rodziną R3 (crimson dekoracyjny).

### 6. Cztery kafle stanu w obcym stylu

Kafle `ZDROWE / OBNIŻONE / NIESPRAWNE / ŁĄCZNIE` mają **ciemne gradienty** i stoją na jasnym
ekranie jak wklejka z innego produktu — reszta ekranu to płaskie białe karty z cienką ramką.
Do oceny właściciela: czy to zamierzony akcent, czy pozostałość po innym stylu.

---

## ★ NOWE, NIEZGŁOSZONE — `admin-security-api-access`

**Cały ekran roboczy jest po angielsku, poza belką nawigacji.** Po polsku: „Bezpieczeństwo
i tożsamość", „Polityka bezpieczeństwa", „Dostęp API", „Delegowane IAM", „SCIM i cykl życia",
„Podsumowanie ryzyka". Po angielsku **wszystko poniżej**: `API Keys` · `Create and manage API keys
for external integrations` · `Create API Key` · `Keep your API keys secure` · `API keys provide
access to your organization's data...` · `Expired` · `Revoked` · `read:projects` · `webhooks:manage`.

Karta ekranu w `status.json` mówiła „cały ekran po angielsku (zero t())" — **potwierdzone wzrokiem,
ocena D była trafna.**

Dodatkowo, niezgłoszone: **`Last used: 1 days ago`** — błąd gramatyczny w samym angielskim
(`1 days` zamiast `1 day`), czyli liczba mnoga bez obsługi przypadku pojedynczego. Ten sam wzorzec
wystąpi po polsku przy retrofitcie tłumaczeń („1 dni temu"), więc **naprawiając ten ekran trzeba
od razu zrobić liczbę mnogą, nie sam przekład.**
Daty w formacie US: `Expires: Jan 15, 2027`, `Expires: Jun 1, 2026`.

---

## CO Z TEGO WYNIKA DLA METODY

**Raport robotnika opisuje to, czego szukano. Zrzut pokazuje wszystko, co jest.** Robotnik wykonał
zadanie wzorowo — naprawił 4 linie, opisał każdą, sam zauważył granice swojej pracy. Nie zgłosił
żadnego z powyższych, bo **nie były w zleceniu**, a zlecenie było wąskie celowo.

Wniosek: **każdy zrzut robiony przy okazji naprawy ma być obejrzany pod kątem CAŁEGO ekranu**,
nie tylko naprawianego elementu. Koszt: jedno spojrzenie. Zysk tutaj: sześć nowych defektów
i dwa potwierdzenia kart, których dotąd nie widziano na obrazie.

**Do dopisania do zleceń przeglądowych:** „obejrzyj zrzut także pod kątem rzeczy spoza zlecenia
i wypisz je osobno jako znaleziska uboczne — nie naprawiaj ich".
