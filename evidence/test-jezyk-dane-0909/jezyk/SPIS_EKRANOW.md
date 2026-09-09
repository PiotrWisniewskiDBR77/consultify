# Spis ekranów — test „język" (część A), 09.09.2026

Stanowisko: `https://staging.consultify.ai` (kod `0d79170f2a`), konto `james.whitfield@northwind.example`
(OWNER, Northwind Manufacturing Ltd.), tylko nawigacja/odczyt. Zrzuty 1440×900, jasny motyw.
Spis zrobiony PRZED pomiarem (zbiór, nie próbka) — zmierzony żywą eksploracją 09.09 przed uruchomieniem
przebiegu głównego (`scripts/dev/test-jezyk-master-zrzuty.mjs`).

Mapa 16 modułów wg `scripts/i18n/pomiar-jezyka-ekrany.mjs` / `docs/FUNCTIONAL_DOCUMENTATION.md`.

| # | Moduł | Menu 1 (trasa) | Menu 2 (zakładki zmierzone live) | Podgląd rekordu | Formularz tworzenia | Stan pusty |
|---|---|---|---|---|---|---|
| 01 | Chat | `/chat` | brak (Documents/Tables/Presentations to tryby wyjścia w polu czatu, nie osobne ekrany) | N/A (brak listy) | N/A (pole czatu, nie modal) | N/A |
| 02 | My Work | `/my-work` | Ideas · Notebook · Inbox · Calendar · Tasks · Decisions · Vaults | próba: pierwszy wiersz tabeli | próba: przycisk New/Add/Create | nie osiągany w tym przebiegu (wymagałby filtra per-zakładka — poza budżetem paczki) |
| 03 | Interview | `/interview` | Inbox · Sessions · Assigned · Templates · Insights · Initiatives | próba | próba | j.w. |
| 04 | Tools | `/discovery-tools` | Library · Sessions · Insights · Reports · Initiatives | próba | próba | j.w. |
| 05 | Assessment | `/assessment/overview` | Library · Processes · Insights · Reports · Initiatives | próba | próba | j.w. |
| 06 | Initiatives | `/initiatives` | Plan · Load (start = lista Initiatives) | próba | próba | j.w. |
| 07 | Execution | `/execution` | Dashboard · Deliveries · Work · Resources · Decisions & risks · Reports | próba | próba | j.w. |
| 08 | Results | `/results/kpi` | OKR · ROI · Management reports (start = KPI) | próba | próba | j.w. |
| 09 | Finance | `/finance` | Analysis · Models · Prediction · Enterprise valuation (start = Statements) | próba | próba | j.w. — **ZNALEZISKO: brak pozycji „Finance" w Menu 1 (sidebar); moduł osiągalny wyłącznie bezpośrednim URL `/finance`** |
| 10 | Materials | `/presentations` | Documents · Presentations · Sheets · Template Library (start = All) | próba | próba | j.w. |
| 11 | Audits | `/audit-programs` | Library · Sessions · Conclusions · Reports · Initiatives | próba | próba | j.w. |
| 12 | Meeting | `/meetings` | brak — **ZNALEZISKO: ekran zastępczy „Meetings — planned for Wave 2. This module isn't part of the MVP yet." Moduł NIE jest zaimplementowany.** | N/A | N/A | N/A |
| 13 | Organization | `/organization/profile` | Scale · Markets & systems (start = Identity) | próba | próba | j.w. |
| 14 | Admin Panel | `/admin` | boczna nawigacja z grupami (TEAM & ACCESS domyślnie rozwinięta: Members · Invitations · Roles & Permissions · Teams · Guests & External Access · Access Requests · Access Reviews · Ownership; zwinięte: BILLING & PLANS, AI CONTROL, SECURITY & IDENTITY, AUDIT LOG, ADMIN COMMAND CENTER, SYSTEM HEALTH). Próbka zmierzona: Members (start) + Invitations + Roles & Permissions — **NIE jest to pełny zbiór (~30 podekranów), zaznaczone jako próbka celowo, nie przez przeoczenie** | N/A (tabela członków — traktowana jak Menu2, nie preview) | N/A | nie osiągany |
| 15 | Settings | `/settings/profile` | boczna nawigacja z 10 grupami (My settings, Work preferences, AI & automation, Notifications, Security, Integrations, Data & privacy, Billing, Appearance, Advanced). Próbka zmierzona: Profile (start) + Security + Language (`/settings/language`, użyty do przełączenia A7) | N/A | N/A | nie osiągany |
| 16 | Partner Portal | `/partner` | **ZNALEZISKO: konto OWNER bez `partner_users` widzi WYŁĄCZNIE ekran „connect" (PartnerOrientationPanel); pozycje Menu 2 (Referrals/Earnings/Client management/Academy/Profile/Resources) są disabled. Nie klikamy „Connect this organization as a partner" — to zmiana stanu organizacji, poza zakresem odczytu.** | N/A | N/A | N/A |

## Uwagi metodyczne
- Podgląd/formularz/stan pusty są mierzone **generycznie** (pierwszy wiersz tabeli / pierwszy przycisk
  `New|Add|Create|Import`) dla modułów 02–11 i 13, NIE dla 01/12/14/15/16 (Chat i placeholdery bez listy,
  Admin/Settings mają własną, dedykowaną boczną nawigację zamiast StandardTable, Partner ma UI disabled).
  Skuteczność próby jest zależna od tego, czy dany ekran akurat ma dane/przycisk widoczny na starcie —
  nieudana próba = N/A z powodem w `captures-manifest.json`, NIE pomijana milcząco.
- Stan pusty (filtr bez wyników) nie był osiągany generycznie w tym przebiegu — wymagałby dedykowanej
  interakcji z filtrem per moduł (różne UI). Zaznaczone jako N/A z powodem "poza budżetem tej paczki",
  zgodnie z zasadą: nieosiągnięte = N/A, nie PASS.
- Admin/Settings mają dziesiątki podekranów (grupy boczne) — zmierzona próbka (2-3 reprezentatywne na
  moduł) jest jawnie oznaczona jako próbka, nie zbiór wyczerpujący, żeby nie powtórzyć pułapki
  „próbka zamiast zbioru" z korpusu uwag.
