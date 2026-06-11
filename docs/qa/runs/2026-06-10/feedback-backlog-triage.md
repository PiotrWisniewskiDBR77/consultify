# Triage backlogu zgłoszeń (SuperAdmin → Customers → Feedback) — 2026-06-10

Źródło: tabela `feedback_items` na **prodzie** (Railway Postgres, centerbeam). Stan na 2026-06-10:
**100 zgłoszeń** (98 BUG, 2 IDEA) — **52 NEW, 47 IN_PROGRESS, 1 REVIEWED**. Zero CLOSED/RESOLVED —
statusy nie są domykane, więc "IN_PROGRESS" ≠ realny stan prac (większość z kwietnia).

Kontekst kluczowy: **prod = deploy 2026-05-18, gałąź Londyn ma ~1 miesiąc niezdeployowanych prac**
(w tym Chat Phase 0, canvas, interview to-100%). Część zgłoszeń sprzed 05-18 może być już
naprawiona na Londynie — każdy stary klaster wymaga re-weryfikacji na Londynie PRZED kodowaniem
(patrz pamięć: "gap reports overstate" — ~1/7 zgłaszanych luk jest realna po weryfikacji).

## Kohorty czasowe (kto i kiedy)

| Kohorta | Okres | Ile | Zgłaszający | Charakter |
|---|---|---|---|---|
| K1 stara | 03-26 → 04-02 | 19 | AtelierToys Demo, DBR77 | trial/demo: i18n, pasek Limitations, obcięte przyciski |
| K2 kwietniowa fala | 04-14 → 04-17 | 28 | VTS, APLIX, DBR77 | chat (język, pliki), superadmin User Management |
| K3 QA post-fix run | 04-18 | 17 | "System" (staging) | regresje chatu: foldery, kosz, cytaty, context bleed |
| K4 tester EN | 04-30 | 15 | "My Company" | Interview UX, język Teresy (DE!), insights creator |
| K5 demo mode | 05-26 | 4 | sesje ateliertoys-demo | demo: nie można otworzyć odpowiedzi, submit w demo |
| K6 świeża APLIX | 06-08 | 7 | APLIX | My Work: ucięty ekran, New Idea, i18n, **opis złej firmy** |
| K7 NAJNOWSZA | 06-10 | 4 (+1 test) | **Elkomtech** (nowy klient!) | chat core: język EN zamiast PL, nowa konwersacja, brak odpowiedzi, puste konwersacje |

## Klastry tematyczne → kolejność realizacji

### P0 — Elkomtech onboarding (zgłoszone DZIŚ, prod, nowy klient)
1. **T2 Chat core**: nowa konwersacja wraca do starej (`79802ad8`), chat nie odpowiada w kolejnych
   konwersacjach (`5d27c9be`), puste konwersacje + samowolne tytuły (`f9fba1e0`).
2. **T1 Język odpowiedzi**: PL UI + pytania PL → odpowiedzi EN (`f2c9f146`). Ten sam defekt
   zgłaszany od 04-14 (VTS/APLIX: na odwrót — EN UI → PL; tester K4: → DE). ~10 zgłoszeń łącznie.
   Najstarszy, wciąż żywy defekt systemu.

### P1 — izolacja kontekstu organizacji (security-adjacent)
3. **T3 Context bleed**: "opisz moją firmę" → opisuje APLIX zamiast DBR77 (`45f9e56c`, 06-08);
   Quick savings miesza wątki między konwersacjami (04-18, CRITICAL); Dzienny brief pokazuje
   zadania VTS w innym orgu (04-18). Trzy niezależne objawy tego samego ryzyka: przeciek
   danych między organizacjami/konwersacjami.

### P2 — My Work / Ideas (świeże, APLIX 06-08; pokrywa się z aktywnym priorytetem Ideas overhaul)
4. **T6**: ucięty ekran bez scrolla (`8e10a415`), New Idea obszar martwy (`6601c426`), nie można
   zamknąć podsumowania / przyciski w prawym dolnym rogu martwe (`1fdb9e7c`), mieszany PL/EN +
   ucięte zdania (`c913ee47`, `610d3016`), tarcie z płytą beta (`218be3ef` — by design? zweryfikować UX).

### P3 — chat: organizacja i źródła (kohorta 04-18, staging; re-weryfikacja na Londynie)
5. **T5 Foldery/kosz**: move-to-folder nie działa (×2), usuwanie folderów, kosz "Loading…" (CRITICAL),
   historyczne konwersacje nie otwierają się, modal folderów zamyka się od kliknięcia w search.
6. **T4 Załączniki/źródła**: chat nie widzi plików (×3 zgłoszenia od 04-14), nie widzi podpiętego URL,
   Add link gubi focus po każdej literze, cytaty `[2]` nieklikalne, źródła z linkami zewnętrznymi (pytanie produktowe).

### P4 — superadmin / User Management (kohorta 04-15, prod)
7. **T8**: usuwanie kont — błąd (CRITICAL), edycja statusu usera, Impersonate i Block martwe dla
   konkretnego konta, liczba userów w organizacji zaniżona, Edit Provider nie zapisuje aktywacji modelu.

### P5 — Interview UX (kohorty 04-30 + 05-26; moduł przeszedł to-100% 06-06 → większość pewnie nieaktualna)
8. **T9**: przyciski Start nie działają (×2), Sessions vs Inbox niezrozumiałe, Insights Creator nic nie robi,
   assignment bez daty/Unknown assignee, demo mode: nie można otworzyć odpowiedzi / submit blokowany.
   → najpierw re-test na Londynie, dopiero potem ewentualne fixy.

### P6 — i18n / layout (przekrojowe, ~20 zgłoszeń, większość stara)
9. **T7 Tłumaczenia**: kilkanaście zgłoszeń braków tłumaczeń (Limitations, hints, opinie, Details,
   templates, mieszany PL/EN). Zrobić jeden przekrojowy audyt kluczy i18n zamiast 14 punktowych fixów.
10. **T11 Layout**: obcięte przyciski, brak scrolla na małych rozdzielczościach, RTL (arabski) zasłania menu,
    pasek Tenant&User Operations wychodzi poza ekran, przycisk Report Bug zasłania UI.

### P7 — sam system feedbacku (połączyć z audytem feedback-system-audit.md)
11. **T10**: pulse/feature → 500 (B1, brak tabel), eskalacja in-app do superadminów martwa (B2,
    is_active TEXT), "Improve with AI" w formularzu bugów nie działa (04-30), wolna wysyłka
    HIGH/CRITICAL (04-15), screenshot do zgłoszenia (03-31, IN_PROGRESS).

## Higiena backlogu (do zrobienia przy okazji)
- 47×IN_PROGRESS z kwietnia — przejrzeć i domknąć statusy (REVIEWED/CLOSED) po re-weryfikacji na Londynie;
  endpoint zmiany statusu istnieje (`PATCH /api/feedback/:id/status` + history).
- Zarchiwizować wiersze testowe: prod `cc7308b0…` ("[TEST] Przegląd systemu…"), staging `f551b4f1…`.
- 2×IDEA (głośnik-ikona, TERESA napis) → przenieść do backlogu produktowego, nie bugfixów.

## Plan wykonania (propozycja)
1. **Wave 1 (teraz)**: P0 — reprodukcja 4 bugów Elkomtech na prodzie/Londynie, fix języka odpowiedzi
   + new-conversation + puste konwersacje. To blokuje onboarding nowego klienta.
2. **Wave 2**: P1 context bleed — audyt org-scoping w chat pipeline (retrieval, daily brief, quick savings).
3. **Wave 3**: P2 My Work/Ideas — wpiąć w trwający Ideas workspace overhaul.
4. **Wave 4**: re-weryfikacja P3/P4/P5 na Londynie → lista realnych pozostałości → fixy + masowe domknięcie statusów.
5. **Wave 5**: P6 audyt i18n + P7 fixy systemu feedbacku (migracja 200 + is_active).
