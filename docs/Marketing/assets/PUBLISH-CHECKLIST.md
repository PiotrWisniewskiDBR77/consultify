# Checklist publikacji materiałów (przed wysyłką na zewnątrz)

Źródła Markdown leżą w tym katalogu. Ten plik jest **operacyjną listą kontrolną** przed wysłaniem treści do klienta, partnera lub inwestora — nie zastępuje review prawnego ani produktowego.

---

## Przed wysyłką do klienta (deal room, ROI, security, pilot)

- [ ] Usunięto lub zastąpiono **przykładowe liczby** w case (np. [`client/05-case-study-template-anonymous.md`](./client/05-case-study-template-anonymous.md)), jeśli nie są zatwierdzone.
- [ ] Uzupełniono pola *wpisz* / tabele w [`client/02-roi-measurement-template.md`](./client/02-roi-measurement-template.md) danymi z konta (baseline, koszt, KPI).
- [ ] [`client/03-security-architecture-faq.md`](./client/03-security-architecture-faq.md) — dopasowano do **realnej architektury** wdrożenia (region, subprocessorzy, DPA); bez obietnic compliance bez pokrycia.
- [ ] [`client/04-pilot-rollout-plan.md`](./client/04-pilot-rollout-plan.md) — daty, role RACI i zakres zgodne z ofertą.
- [ ] Zgody na cytaty / logotypy / referencje (jeśli używane).
- [ ] Opcjonalnie: eksport wybranych plików do **PDF lub deck** (Google Slides, Keynote); wtedy link zewnętrzny można dodać w [`../asset-gap-map.md`](../asset-gap-map.md) (status **Gotowe (materiał zewnętrzny)**) i w [`../client-touchpoint-sequences.md`](../client-touchpoint-sequences.md).

---

## Przed rundą VC / deep dive z inwestorem

- [ ] Uzupełniono pola **TBD** w [`investor/01-investment-memo-outline.md`](./investor/01-investment-memo-outline.md) (tylko realne dane).
- [ ] [`investor/02-data-room-checklist.md`](./investor/02-data-room-checklist.md) — statusy folderów i dokumentów w data room.
- [ ] [`investor/03-moat-appendix-template.md`](./investor/03-moat-appendix-template.md) — dowody przy warstwach moatu (case, metryki, partnerzy).
- [ ] Tabela traction w [`../investor-narrative.md`](../investor-narrative.md) — **wyłącznie** liczby i fakty z zespołu (patrz ten sam katalog [`investor/`](./investor/)).

---

## Po publikacji pliku zewnętrznego

- [ ] Link do PDF/deck zapisany w mapie lub w touchpointach (jeśli dotyczy).
- [ ] Wersja datowana w nazwie pliku lub changelogu (żeby nie mylić z repo).
