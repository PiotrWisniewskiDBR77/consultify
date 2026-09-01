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

---

# Naprawa rodziny R5 (kontrast motywów) — wynik, oglądnięty przez nadzorcę

**Commit `4e1b31939b`**, 4 pliki, 14 linii. Dowód: `evidence/grafika/kontrast-motywow/` (16 PNG).

## Co widać na zrzutach (oglądnięte, nie przepisane z raportu)

**`admin-ai-data-privacy`, motyw ciemny — najmocniejszy dowód.**
PRZED: karta „Funkcje i prywatność" pokazuje **same opisy, bez ani jednej nazwy funkcji**.
Użytkownik widzi „Zezwól AI na generowanie ustrukturyzowanej treści (kod, dokumenty, diagramy)"
i nie wie, co ta opcja włącza — nazwa funkcji jest tam, tylko granatowa na granatowym.
Tytuł karty też nieobecny: przy ikonie stoi sam opis.
PO: **osiem nazw wróciło** — „Panel artefaktów", „Kroki rozumowania (Chain of Thought)",
„Tryby skupienia", „Wyszukiwanie w sieci", „Rozmowy głosowe", „Audytuj wszystkie żądania AI",
„Audytuj zmiany polityki" oraz tytuł karty „Funkcje AI". Każda biała, półgruba, nad swoim opisem.

To nie jest kosmetyka. **Ekran sterujący polityką AI organizacji był nieużywalny w ciemnym
motywie** — przełączniki bez nazw.

## ★ Bezpiecznik MD5 zadziałał i dał wynik odwrotny do oczekiwanego

Trzy pary `PRZED__light` / `PO__light` mają **identyczne sumy MD5** — bajt w bajt. Na pierwszy rzut
oka to sygnał fałszerstwa (znany kształt: *duplikat zamiast motywu*). Robotnik zgłosił to sam,
z wyjaśnieniem; nadzorca zweryfikował niezależnie:

`navy-900` = `#0F172A` (`tailwind.config.js:190`) · `--c-text` w motywie jasnym = `#0f172a`
(`src/index.css:62`). **To ten sam kolor.** Podmiana jest w jasnym motywie pikselowo
nieodróżnialna i działa wyłącznie w ciemnym — dokładnie jak mówiła diagnoza.

**Identyczne sumy są tu dowodem BRAKU REGRESJI w motywie jasnym — matematycznym, nie „na oko".**
Żadna para light/dark nie dzieli sumy, więc nie podstawiono jednego zrzutu pod dwie nazwy.
Wniosek do metody: bezpiecznik ma **wyjaśniać** anomalię, nie tylko ją zgłaszać — inaczej
poprawna praca zostanie odrzucona jako podejrzana.

## ★ Moja diagnoza nr 1 była BŁĘDNA — robotnik ją obalił i miał rację

Twierdziłem, że przyczyną jest `SettingsSection.tsx` (32 konsumentów) i że jedna poprawka tam
zdejmie defekt z kilkudziesięciu ekranów. **Nieprawda.** Robotnik otworzył cały plik (442 linie):
nie ma tam ani jednego `text-white` na tle motywowym; własne teksty komponentu już używają
tokenów. Dwa `text-white`, które są, leżą na tle o stałym kolorze ze sparowanym wariantem —
czyli poprawnie.

**Defekt jest w 32 konsumentach**, które wstrzykują `text-white` jako dzieci tej sekcji. Poprawka
w kontenerze tego nie zdejmuje. Mój „jeden ruch na 32 ekrany" nie istnieje — to 32 osobne miejsca.
**To nadal jest do zrobienia i jest największą pozostałą pozycją tej rodziny.**

Robotnik znalazł za to w tym pliku **inny** defekt tej samej klasy, którego nikt nie szukał:
wskaźnik „niezapisane zmiany" w kolorze `amber-400` na jasnym tle daje kontrast ~1.7:1
(nieczytelny). Naprawiony — ale **bez dowodu wzrokowego**, bo pokazuje się dopiero po realnej
edycji formularza, a harness tego stanu nie osiąga. Odnotowane jako naprawa niezweryfikowana.

## ★ Dwa komponenty o tej samej nazwie — liczba konsumentów w pomiarze była zawyżona

`AISettings/SettingsToggle` ma **4** realnych konsumentów, nie 18. Osiemnastka z `POMIAR_R5` to
policzone importy `SettingsToggle` z `settings/shared` — **inny komponent o identycznej nazwie**,
który jest już poprawny (używa `text-c-text`). Pułapka dla każdej dalszej pracy w tej rodzinie:
`grep` po nazwie komponentu miesza dwa różne pliki.

## Znaleziska uboczne z tych zrzutów (NIE naprawiane, do rejestru)

1. **`ProactivitySelector.tsx:179,240`** — ten sam defekt kontrastu, **potwierdzony wzrokowo**:
   tytuły „Balanced" i „Proactive" ciemnoszare na ciemnym, gdy wybrany „Reactive" jest biały.
   Pomiar R5 klasyfikował te linie „przez analogię, nieotwarte" — teraz jest obraz.
2. **Angielszczyzna w polskim ekranie**: „How should AI interact with you?", „Reactive/Balanced/
   Proactive", „AI waits for your questions", „Auto-suggestions", „Contextual hints",
   „Proactive nudges", „Start conversations".
3. **`AuditLogViewer` ma angielskie napisy zaszyte w kodzie, bez i18n**: „Settings Audit Log",
   „(N entries)" — na polskim ekranie audytu.
4. **Osierocona ikona** na `policy-autonomy` nad nagłówkiem — ikona bez etykiety.
