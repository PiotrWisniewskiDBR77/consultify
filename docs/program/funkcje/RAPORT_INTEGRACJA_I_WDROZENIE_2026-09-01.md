---
doc_id: funkcje-raport-integracja-wdrozenie
status: canonical
owner: piotr
truth_type: runtime
established: 2026-09-01
---

# Raport: integracja gałęzi i program wdrożenia

Wszystkie liczby **zmierzone poleceniami** na czubku `8c806c77d4`, nie odtworzone z pamięci.

---

# CZĘŚĆ 1 — INTEGRACJA GAŁĘZI

## Gdzie stoi każda gałąź — pomiar

| Gałąź | Czubek | Data | Rola |
| --- | --- | --- | --- |
| **nasza linia integracyjna** | `8c806c77d4` | **1.09** | cała praca obu torów; **żyje TYLKO w prywatnym skarbcu** |
| `origin/develop` | `636cc8b237` | **31.08** | **źródło STAGINGU** — wdrożenie przy każdym pchnięciu |
| `origin/demo` | `f3237e9423` | 14.08 | demo |
| `origin/main` | `627b7d93ae` | 16.07 | **źródło PRODUKCJI** — wdrożenie ręczne, z potwierdzeniem |
| `origin/Londyn` | `f3a45b0c90` | 07.07 | gałąź domyślna repozytorium |
| `origin/staging` | `aa0032bb72` | **17.06** | **nieużywana od 2,5 miesiąca** |

## ★ Odległość do każdego środowiska — i to jest odpowiedź na pytanie „czy panujemy nad stagingiem"

| Cel | Naszych commitów poza nią | Ich commitów, których nie mamy |
| --- | ---: | ---: |
| **`develop` (staging)** | **667** | **10** |
| `demo` | **4 660** | — |
| `Londyn` | **8 969** | — |
| `main` (produkcja) | **12 505** | — |

**To jest najważniejsza liczba w tym raporcie: do stagingu mamy 667 commitów, do produkcji 12 505.**

Wspólny przodek z `develop` to **31.08 — wczoraj**. Z demo: 13.08. Z produkcją: **18 maja**.

## Odpowiedź: czy mamy integrację ze stagingiem pod kontrolą?

**Nie mamy jej wykonanej — ale mamy ją w zasięgu, i to jedyne środowisko, o którym można tak powiedzieć.**

Uczciwie, trzema zdaniami:
1. **Cała nasza praca żyje w prywatnym skarbcu, na gałęzi, z której NIE wdraża się żadne
   środowisko.** Sprawdzone: `git branch -r --contains HEAD` → wyłącznie
   `github-backup/codex/m03-admin-20260824`.
2. **Do stagingu dzieli nas 667 commitów w jedną stronę i 10 w drugą** — czyli rozjazd
   **jednodniowy**, nie miesięczny. **Te 10 cudzych commitów trzeba obejrzeć przed scaleniem**,
   bo są to zmiany, których nie znamy.
3. **Staging wdraża się AUTOMATYCZNIE przy każdym pchnięciu na `develop`.** To znaczy,
   że **moment scalenia JEST momentem wdrożenia** — nie ma kroku pośredniego, w którym
   można się rozmyślić.

## Co trzeba zrobić, żeby mieć pełną kontrolę — pięć rzeczy, w tej kolejności

1. **Obejrzeć 10 commitów `develop`, których nie mamy.** Nie scalać w ciemno — to jedyna
   rzecz na tej liście, która może nas czymś zaskoczyć.
2. **Postawić punkt bezpieczny na obecnym `develop`** (tag), żeby cofnięcie kosztowało
   jedno polecenie. Wzorzec sprawdzony dziś przy zejściu linii toru grafiki.
3. **Rozstrzygnąć, czy pchnięcie na `develop` ma nastąpić od razu, czy najpierw za flagami
   wyłączonymi.** Wdrożenie jest automatyczne, więc **to jest decyzja właściciela,
   nie techniczna.**
4. **Sprawdzić bazę stagingu.** Pomiar z 31.08: staging ma **własną, PUSTĄ bazę**, a demo
   i staging dzieliły jedną. Po wdrożeniu **migracje pójdą na pustą bazę od zera** —
   to jest test odtworzenia po awarii, którego jeszcze nie robiliśmy na tej skali.
5. **Dopiero po odbiorze na stagingu — droga na demo.** Rozjazd 4 660 commitów oznacza,
   że demo **nie da się doścignąć skokiem**; sensowna droga to
   **staging → odbiór → promocja**, nie „wszystko naraz".

## ★ Do produkcji NIE idziemy — i to jest osobna sprawa
`main` jest **12 505 commitów** za nami, z wspólnym przodkiem sprzed **trzech i pół miesiąca**.
**Ale to nie jest powód, dla którego o niej piszę.**

Dziś zmierzono, że **kod z trzema brakami kontroli dostępu JEST na `main`** — a `main` jest
źródłem produkcji. **Trasy istnieją tam od stycznia i nie ma tam poprawki, której my nie mamy.**

**Nieznane: czy produkcja jest dziś wdrożona i czy ma dane realnych klientów.**
Tego nie sprawdzam bez zgody właściciela. **To jest jedyne otwarte pytanie, które może
zmienić kolejność wszystkiego.**

---

# CZĘŚĆ 2 — PROGRAM WDROŻENIA W SZEŚCIU KROKACH

## Odpowiedź wprost: takiego programu w repozytorium NIE MA — i to jest wynik pomiaru, nie brak starania

Przeszukano po **treści, nie po nazwach**, z kontrolą dodatnią przy każdym pomiarze
negatywnym. Znaleziono **dziewięć różnych dokumentów** mówiących o krokach albo fazach
wdrożenia — **żaden nie jest tym programem**:

| Dokument | Data | Ile kroków | Dlaczego to nie to |
| --- | --- | --- | --- |
| `wdrozenia/README-DEPLOYMENT-PLAN.md` | **27.01** | **6 faz** | **najbliższy tytułem — i MARTWY**, patrz niżej |
| `docs/program/grafika/ANALIZA_STAGING_DEMO.md` | **31.08** | **9** (KROK 0-8) | **najnowszy i merytorycznie właściwy** — ale dziewięć, nie sześć |
| `docs/operations/RUNBOOK_ROZJAZD_BAZ_RAILWAY_PL.md` | 27.08 | KROK 0-6 | wąski: bezpiecznik rozjazdu baz, nie wdrożenie |
| `Harvard/wdrozenie-100/_ANALIZA_UTRZYMANIA_STANDARDU...` | 21.07 | 6 (U1-U6) | wąski: utrzymanie kanonu UI |
| `.../OPS-SEC-001_RUNBOOK_WYSTAWIENIA_PUBLICZNEGO.md` | 06.08 | „sześć kroków" | bardzo wąski: rotacja hasła administratora |
| `Harvard/SEKWENCJA.md` | 11.06 | 8 | inna liczba |
| `Harvard/.../_HP27_PROGRAM_WDROZENIA_TRANSFORMACJI.md` | 15.07 | 4 fazy | **to produkt dla klienta**, nie nasz plan |
| `Harvard/MASTER_PLAN_DOKONCZENIA.md` | 11.06 | 5 faz | inna liczba |
| `docs/plans/CONSULTIFY_MASTER_CLOSURE_PLAN.md` | 03.06 | 5 faz | inna liczba |

## Sześć faz z dokumentu, który liczbą pasuje — i dlaczego nie wolno na nim polegać

`wdrozenia/README-DEPLOYMENT-PLAN.md:56-65`, cytat dosłowny:
```
Tydzień 1-2:   Faza 1 - Stabilizacja Podstawowa
Tydzień 3-4:   Faza 2 - Testy Integracyjne i Komponenty
Tydzień 5-6:   Faza 3 - E2E i Performance
Tydzień 7-8:   Faza 4 - Bezpieczeństwo i Audyty
Tydzień 9-10:  Faza 5 - Optymalizacja i Monitoring
Tydzień 11-12: Faza 6 - Dokumentacja i CI/CD
```

**Trzy powody, dla których to nie jest odpowiedź:**

1. **Dokument jest OSIEROCONY.** Wskazuje sześć dokumentów źródłowych. **Cztery z nich
   NIE ISTNIEJĄ nigdzie w repozytorium** — w tym `00-MASTER-PLAN-DEPLOYMENT.md`, czyli
   ten, który opisywał te fazy szczegółowo. **Mamy tylko spis treści planu, którego nie ma.**
   *(Kontrola dodatnia: dwa pozostałe dokumenty źródłowe istnieją, więc polecenie działało.)*
2. **Mapa źródeł prawdy sama go dyskwalifikuje.** `docs/SOURCE_OF_TRUTH.md:118` kieruje
   do `wdrozenia/README.md`, a ten mówi o sobie: *„zachowane jako **historyczny** program
   wdrożenia… **nie jest** długoterminowym kanonicznym drzewem dokumentacji"*.
3. **Nic do niego nie linkuje** — dokument jest odizolowany. I **nie mówi ani słowa
   o stagingu, demo ani produkcji.** Dotyczy pokrycia testami, typów, bezpieczeństwa i CI.

`CLAUDE.md` ostrzega o tym wprost: **sam napis `FINAL`, `MASTER` czy `KANON` w nazwie
starszego pliku nie daje mu pierwszeństwa.** Tu mamy przypadek podręcznikowy.

## ★ Co JEST aktualnym planem wyjścia — dziewięć kroków, nie sześć

`docs/program/grafika/ANALIZA_STAGING_DEMO.md` (**31.08, najnowszy z całej grupy**),
KROK 0-8:

| Krok | Treść |
| ---: | --- |
| **0** | zabezpieczenie i kopia zapasowa |
| **1** | rozstrzygnięcie **16 commitów `origin/develop`**, których nie mamy |
| **2** | ustawienie `develop` jako kandydata |
| **3** | zgodność zmiennych środowiskowych ze strażnikiem |
| **3b** | zamrożenie kandydata |
| **4** | pierwsze wdrożenie stagingu |
| **5** | odbiór na stagingu i zamrożenie SHA |
| **6** | droga promocji staging → demo |
| **7** | promocja na demo |
| **8** | opcjonalne domknięcia |

**Ten plan jest zgodny z moim pomiarem z części 1** — z jedną różnicą: mówi o **16 commitach
`develop`**, a dziś jest ich **10**. Plan powstał 31.08, więc **liczba się zmieniła
i wymaga przeliczenia przed użyciem.**

## Rozstrzygnięcie potrzebne od właściciela
**Czy „sześć kroków" to ten martwy plan ze stycznia, czy coś, czego nie znalazłem?**

Przeszukanie objęło treść, nie tylko nazwy, ale **nie objęło pojedynczo 27+ plików
`Harvard/wdrozenie-100/M*` per moduł**. Jeśli program siedzi w jednym z nich —
**podaj nazwę albo choćby jedno zdanie z niego, a znajdę go w minutę.**

**Nie zgaduję, który z dziewięciu dokumentów miałeś na myśli.** Wszystkie są prawdziwe
i wszystkie mówią o czym innym.
