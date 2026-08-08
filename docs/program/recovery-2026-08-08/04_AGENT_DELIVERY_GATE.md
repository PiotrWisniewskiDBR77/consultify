# Agent Delivery Gate

Od tej chwili agent nie kończy pracy opisem w czacie. Kończy ją czystym i wypchniętym branchem.

## Obowiązkowy cykl

```bash
# kontrola zakresu w trakcie pracy
tools/agent-delivery/agent-delivery.sh validate <track>

# bezpieczny commit checkpointu
tools/agent-delivery/agent-delivery.sh checkpoint <track> "wip(<track>): opis checkpointu"

# synchronizacja z GitHub i raport do odbioru
tools/agent-delivery/agent-delivery.sh handoff <track>
```

Dozwolone wartości `<track>`:

- `v8`
- `documents`
- `report-b-ui`

## Co mechanizm wymusza

- właściwy branch dla toru;
- obecność pliku w macierzy ownership;
- zgodność ownera każdego zmienionego i nowego pliku;
- commit przed zakończeniem;
- czyste worktree przed handoffem;
- identyczny SHA lokalny i na GitHubie;
- brak automatycznego merge i deployu.

Plik nieobecny w macierzy albo należący do integratora blokuje checkpoint. Agent zgłasza wtedy `BLOCKED`; nie omija kontroli.

