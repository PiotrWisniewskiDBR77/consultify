1.1-D1 (DEC-415) — dowody

Zrzuty: REALNA trasa /assessment/drd/<sesja>, lokalne stanowisko vite:3149 -> API 127.0.0.1:4100,
motyw light, 1440. Sesja DRD 2d1fc7a8-8145-48f1-aaf5-24fd86f1dfd7 — UTWORZONA PRZEZE MNIE przez
realne API (POST /api/method/sessions, pack 2.0.0-methodpack.1), bo w lokalnej bazie NIE BYLO ANI
JEDNEJ sesji method-core (dowod: odpowiedzi-baza.txt, "PRZED": total=0). Zadna zastana sesja nie
zostala dotknieta.

01-warsztat.png                     — warsztat po wejsciu, przed odpowiedzia (karta neutralna)
a-potwierdzone-zielona-karta.png    — po "Potwierdzone": licznik 1/39, ZIELONA kropka w drzewie;
                                      UWAGA: ekran natychmiast przechodzi na kolejny poziom
                                      (zachowanie zastane, patrz ZNALEZISKA w meldunku), wiec
                                      zielonej KARTY na tym zrzucie nie widac
a-kropka-drzewo-zoom.png            — powiekszenie: zielona kropka odpowiedzi przy "Procesy Sprzedazy"
b-czesciowo-pomaranczowa-karta.png  — po "Czesciowo": POMARANCZOWA lewa krawedz calej karty
                                      + wypelniony pomaranczowy przycisk
c-zapytaj-terese-dok.png            — po "Zapytaj Terese": globalny dok Teresy otwarty, prompt niesie
                                      metode, os, jednostke, poziom, tresc pytania i obecna odpowiedz
d-podyktuj-silnik.png(.json)        — pomiar: przycisk ma data-stt-provider="web" (droga przegladarki),
                                      zero "whisper", zero stanu zdegradowanego
d-podyktuj-slucham.png / -zoom.png  — po kliknieciu "Podyktuj": stan "Slucham…" (isListening)

testy-baza.txt / testy-po.txt       — zastane 11 FAIL / 111 PASS (122)  ->  po zmianie 11 FAIL / 128 PASS (139), +17 nowych
mutacja-A/B/C.txt                   — trzy dowody mutacyjne (kazdy RED)
odpowiedzi-baza.txt                 — stan bazy przed/po
