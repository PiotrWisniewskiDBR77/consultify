---
doc_id: funkcje-ksztalt-22
status: canonical
owner: piotr
truth_type: runtime
established: 2026-09-01
---

# DWUDZIESTY DRUGI kształt: dwa pliki o tej samej nazwie, jeden martwy — i obie strony sporu czytały ten martwy

## Co się stało
Spór o zakres naprawy ustawień AI. Tor grafiki twierdził, że **piętro superadministratora
jest zepsute tak samo jak organizacji**, i podał `plik:linia`. Nadzorca toru funkcji
twierdził wcześniej coś przeciwnego. **Obie strony podawały dowody. Obie się myliły co
do podstawy.**

W repozytorium są **dwa pliki o tej samej nazwie**:
```
server/src/routes/ai-settings.routes.ts        30763 B   ← MARTWY, ZERO importerów
server/src/routes/ai/ai-settings.routes.ts     31770 B   ← ŻYWY, montowany Gateway.ts:54,744
```

**Oboje trafiliśmy najpierw na płaski, martwy plik.** Wykonawca naprawy też — i sam o tym
napisał w raporcie.

W **żywym** pliku superadministrator **ma poprawne przekształcenie** (`:60`, `:82`,
wołane w `:139`, `:166`, `:185`), a obaj konsumenci we froncie czytają dokładnie te pola.

## Dlaczego to jest osobny kształt
Znane kształty mówią o **martwym kodzie** (biblioteka bez wywołania) i o **kłamiących
komentarzach**. Tutaj jest gorzej:

> **Martwy plik nie ma na sobie żadnego znaku, że jest martwy.** Ta sama nazwa, zbliżony
> rozmiar, bardzo podobna treść, poprawnie wyglądający kod. **Wygląda dokładnie jak żywy —
> i różni się wyłącznie tym, czy ktoś go importuje.**

I najgorsze: **wyszukiwanie po nazwie trafia w niego równie chętnie, a przy niektórych
sposobach sortowania — jako pierwszy.**

## Skutek zmierzony
- Tor grafiki wydał **sprostowanie oparte na martwym pliku** i poprosił o rozszerzenie
  zakresu naprawy.
- Nadzorca toru funkcji **przekazał to sprostowanie wykonawcy jako korektę zakresu w locie**.
- **Wykonawca to obalił** — sprawdził, który plik jest montowany, i naprawił wyłącznie
  realnie zepsute piętro.

**Pierwotna wersja nadzorcy („superadmin poprawny") okazała się trafna z BŁĘDNEGO POWODU** —
nie sprawdził, który plik żyje. **To nie jest zasługa, tylko szczęście.**

## Reguła
> **Zanim zacytujesz `plik:linia` jako dowód, sprawdź, czy ten plik jest w ogóle uruchamiany.**
> Jedno polecenie: czy coś go importuje. Jeżeli zero — **cytat nie jest dowodem, tylko
> ciekawostką.**

To rozszerza znaną regułę „weryfikuj realny runtime, nie kod": **nie wystarczy, że kod
istnieje i wygląda poprawnie. Musi być w łańcuchu wykonania.**

## Zadanie
**Usunąć albo jawnie oznaczyć martwy plik.** Dziś jest pułapką dla każdego, kto trafi na
niego pierwszy — a trafiły na niego **trzy niezależne osoby jednego dnia**.

## ★ Uwaga metodyczna o samym sporze
Ten spór **zakończył się dobrze wyłącznie dlatego, że wykonawca dostał pozwolenie
na zaprzeczenie zleceniu.** Korekta zakresu przyszła do niego jako polecenie od nadzorcy,
poparte pomiarem drugiego toru — **czyli z podwójnym autorytetem**. Mimo to sprawdził
i odmówił.

**Gdyby przyjął, naprawiłby piętro, które nie było zepsute, i zapisałby w rejestrze,
że je naprawił.**

To jest ta sama lekcja, którą tor grafiki zapisał u siebie tego samego dnia przy „czerwonej
ikonie": **teza nadzorcy wraca jako zweryfikowany fakt, jeśli wykonawca nie ma prawa jej
zaprzeczyć.**

---

# DOMKNIĘTE — martwy plik usunięty 1.09

## Weryfikacja przed usunięciem (nie skasowano „na oko")
```
grep -rn "routes/ai-settings.routes" .  | grep -v "routes/ai/ai-settings"
→ zero importerów w kodzie
→ trafienia wyłącznie w: historycznych raportach audytowych (maj), planie testów (luty),
  raporcie strukturalnym migracji oraz komentarzu nowego testu, który OPISUJE ten plik
  jako martwy

find tests -name "ai-settings.routes*"   → brak testu importującego
```
**Zero importerów w kodzie, zero testów. Pozostałe trafienia to dokumenty historyczne**,
które opisują stan z przeszłości i pozostają prawdziwe jako zapis.

Plik żyje w historii repozytorium — **usunięcie jest odwracalne**, a pułapka znika.

## ★ Drugie znalezisko przy tej samej okazji — zgłoszone, NIENAPRAWIONE
Tor grafiki, prostując własne sprostowanie, zauważył rzecz, której nikt nie szukał:
**przekształcenia nazw w ŻYWYM pliku obsługują wyłącznie PIERWSZĄ parę tras.**

Zmierzone: plik ma **18 tras**, a wywołania przekształcenia są przy **trzech miejscach**
(`:201`, `:228`, `:247`) — czyli przy jednej parze odczyt/zapis.

Wstępny przesiew wskazuje co najmniej **dwie dalsze trasy zwracające dane surowo**,
w tym **`/user`**. **To jest podejrzenie, nie pomiar** — wymaga sprawdzenia czterowarstwowego
przy każdej z osobna, bo część tras może zwracać dane, których front i tak nie czyta.

**To jest ten sam wzorzec „rodzina naprawiona w części", już czwarty raz tego dnia —
tym razem WEWNĄTRZ jednego pliku.**
