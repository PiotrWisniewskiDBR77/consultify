QD15 — przebieg v1, ODRZUCONY (nie jest dowodem).

v1 mierzyl "powrot do baseline" WYLACZNIE bajtowym hashem znormalizowanego
`pg_dump -s`. Ta miara jest za ostra i zarazem za slaba:
  * za ostra — `pg_dump -s` wypisuje kolumny w kolejnosci attnum, wiec
    DROP COLUMN + ADD COLUMN zmienia tekst mimo identycznego schematu;
  * za slaba — v1 nie mierzyl osobno struktury (SEM) i kolejnosci kolumn (POS),
    a `pos_hash` w ogole nie istnial.
Efekt: v1 raportowal "powrot do baseline" dla cyklu 20262283 po tym, jak wczesniejsze
cykle juz sie rozjechaly — fizycznie niemozliwe przy niezaleznych cyklach. To byla
wskazowka, ze przyrzad jest zly, nie ze schemat wroci.

Odrzucone w calosci; v2/v3 (audyt-up-down-up.sh, TABELA.md, wyniki-runA/B/C) mierza
trzema miarami + atrybucja per obiekt katalogu + DOWN_zmienil_schemat.
Pliki tu zostaja jako slad bledu przyrzadu, zeby nie wygladalo, ze v1 "tez przeszedl".

  M1-wynik.log, M2-wynik.log  — mutacje v1 (na mierze bajtowej)
  pg_restore.log              — restore v1
  wyniki-v1-metryka-bajtowa-ODRZUCONA.txt — tabela v1
  M-podsumowanie-v1.txt       — podsumowanie mutacji v1
