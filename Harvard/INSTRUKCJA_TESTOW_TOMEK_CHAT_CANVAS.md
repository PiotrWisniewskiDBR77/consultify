# Instrukcja testów dla Tomka — Czat (M01) + Canvas (M02)

> Środowisko: **demo.consultify.ai** (staging), zaloguj się swoim kontem. Jeśli coś nie działa — zrób screen + napisz krok, na którym to było.
> Legenda: ✅ = ma działać, ⚠️ = znane ograniczenie (nie zgłaszaj jako bug), 🆕 = świeżo dodane/naprawione.

---

## CZĘŚĆ A — CZAT (Teresa)

### A1. Podstawowa rozmowa
1. Wejdź w **Czat** (lewy sidebar, ikona dymka).
2. Wpisz dowolne pytanie biznesowe (np. „Wymień 3 ryzyka wdrożenia ERP") → Wyślij (czerwona strzałka).
- ✅ Teresa odpowiada po **polsku**, merytorycznie, z oznaczeniem źródeł („sources").

### A2. Tryby AI (przycisk ołówka ✎ w polu wpisywania)
Kliknij ✎ — zobaczysz 5 trybów:
- **Deep analysis** — ✅ przed odpowiedzią pojawia się krok „Confirm Understanding" (Teresa streszcza zadanie: Goal/Context/Output).
- **Show reasoning** — ✅ 🆕 po włączeniu i wysłaniu pytania panel **„Tok rozumowania" pokazuje myślenie modelu NA ŻYWO** (rozwija się w trakcie, zwija po odpowiedzi). Najlepiej widać na **złożonym** pytaniu (model myśli dłużej).
- **Multi-agent analysis** — ✅ kieruje przez „Decision Room" (analiza wielu perspektyw).
- **Private mode** — ✅ rozmowa nie jest zapisywana do pamięci.
- **Read responses** — ✅ czyta odpowiedź głosem (TTS).
- **Response style** — ✅ 8 stylów (Standard/Concise/Detailed/Executive/…); zmienia ton odpowiedzi.

### A3. Co-Thinker (przycisk 👥)
- Kliknij 👥 → wybierz personę (Consultant / Idea Creator / Analyst / Auditor / Editor / Market Researcher).
- ✅ Odpowiedzi dostosowują się do roli.

### A4. Załączniki i głos
- **+** → dołącz plik (PDF/DOCX) lub źródło.
- **mikrofon** → dyktowanie (wypełnia pole, sam wysyłasz) / **„Talk to Teresa"** → rozmowa głosowa.

### A5. Zarządzanie rozmowami
- „+" (nowa rozmowa), historia (zegar), wyszukiwanie rozmów.

---

## CZĘŚĆ B — CANVAS (dokument obok czatu)

### B1. Wygenerowanie dokumentu z czatu
1. W czacie napisz np. **„Przygotuj raport o korzyściach z CRM. 3 sekcje."** → Wyślij.
- ✅ Po prawej **otwiera się panel Canvas** z dokumentem (Teresa pisze sekcje).
- ✅ Treść i **nagłówki po polsku** (Streszczenie wykonawcze, Kontekst, Rekomendacje…).
- ✅ W czacie pojawia się chip „… · Document · Open".

### B2. 🆕 Tabele w raporcie
1. Napisz: **„Przygotuj raport porównujący 3 scenariusze wdrożenia AI: koszty, czas, ROI. Użyj tabel."**
- ✅ W dokumencie powinna pojawić się **tabela** (kolumny: scenariusz, koszt, czas, ROI).
- ⚠️ Tabele nie zawsze wychodzą za pierwszym razem (zależne od modelu) — jeśli wyszła proza, poproś „przedstaw to jako tabelę".

### B3. Edycja AI w dokumencie (zaznacz tekst)
1. Zaznacz akapit w dokumencie → pojawia się pasek **Ask AI / Condense / Expand / Tone / Explain / Actions**.
2. Kliknij **Condense** (skróć) → pojawia się **diff** (stare przekreślone / nowe podświetlone) + **Accept / Reject**.
- ✅ 🆕 Accept **zastępuje** fragment skróconą wersją (nie dokleja, nie gubi reszty).

### B4. 🆕 Czat steruje otwartym dokumentem
1. Mając otwarty dokument, w czacie napisz: **„Dodaj do tego dokumentu sekcję 'Wnioski końcowe' z 3 punktami."**
- ✅ Nowa sekcja **dopisuje się jako prawdziwy nagłówek + lista**, a istniejąca treść **zostaje** (nic nie znika).

### B5. Górny pasek Canvas
- **Pasek formatowania**: B/I/U, nagłówki H1-H3, listy, cytat, tabela, link.
- **PROMOTE** (5 ikon): zamień dokument w → Pomysł / Notatkę / Inicjatywę / Decyzję / Zadanie. ✅ powstaje realna encja w odpowiednim module.
- **Historia wersji** (zegar) → podgląd wersji + **Przywróć**. ✅
- **Eksport** (menu „…"): Pobierz Markdown / PDF / Word / Excel / PowerPoint. ✅ (plik się pobiera).
- **Share** → publiczny link do dokumentu.

---

## Na co zwrócić uwagę (świeże zmiany do potwierdzenia)
- 🆕 **Show reasoning na żywo** (A2) — czy myślenie faktycznie „płynie" w trakcie, a nie pojawia się gotowym blokiem po fakcie.
- 🆕 **Tabele w dokumencie** (B2) — czy się generują.
- 🆕 **Edycja AI = zastępuje, nie dokleja** (B3).
- 🆕 **Czat dopisuje sekcję bez gubienia treści** (B4).

## Znane ograniczenia (NIE zgłaszaj)
- ⚠️ Pierwsza odpowiedź po dłuższej przerwie bywa wolniejsza (rozgrzewka).
- ⚠️ OUTPUT „prezentacja/raport" z Canvas może wymagać dosynchronizowania schematu (w toku).
- ⚠️ Integracje Google/Outlook Calendar: „w przygotowaniu" (celowo).
