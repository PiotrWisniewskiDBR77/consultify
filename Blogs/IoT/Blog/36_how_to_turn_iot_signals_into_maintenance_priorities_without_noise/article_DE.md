# Wie man IoT-Signale in Instandhaltungs-Prioritaeten verwandelt, ohne Rauschen zu erzeugen

Zielpersona: Instandhaltungsleiter / Zuverlaessigkeitslead / Planer  

Funnel-Phase: Consideration Kernproblem: jeder neue Sensor-Trend wird zum P1-Ticket, Techniker jagen Daten und vertagen Arbeit, die Output wirklich schuetzt Hauptversprechen: eine von IoT gespeiste Prioritaetenleiter: Evidenzregeln, gemeinsames Triage mit Operations und ein hartes Limit gleichzeitiger "dringender" IoT-Punkte Instandhaltung lebt schon mit Rauschen. IoT soll Ratenzaehlen reduzieren, keine zweite Alarmkultur addieren.

Der Gewinn ist eine kleinere Menge hoehervertrauenswuerdiger Prioritaeten, gekoppelt an Fehlerbilder, die das Werk kennt.

Wandeln Sie IoT in Prioritaeten um, indem Sie Signale durch eine **Triage-Leiter** routen: **loggen und baselinen**, bis Varianz fuer dieses Asset und diese Saison verstanden ist; **auf Watchlist heben**, wenn ein Trend ueber Schichten mit Bestaetigung wiederholt; **geplanten Arbeitskandidaten erzeugen**, wenn Risiko eine werksdefinierte Schwelle kreuzt und ein Jobplan existiert; **Unterbrechungskandidaten** nur wenn Verzoegerung Sicherheit, Qualitaet oder ungeplanten Stillstand klar erhoeht. Alles andere bleibt fuer Engineering-Lernen sichtbar.

## Gemeinsames Triage: Operations plus Instandhaltung

Operations traegt Durchsatz und sicheren Sofortlauf. Instandhaltung traegt Asset-Gesundheit und Job-Planung.

IoT-Prioritaetsentscheidungen brauchen ein **kurzes gemeinsames Checkpoint** woechentlich, keine endlosen Mailketten.

Vereinbaren Sie dort: welche Watchlist-Signale aufsteigen; welche geplanten Jobs vorgezogen werden; welche Signale nach einem schlechten Korrelationsmonat zurueckgestuft werden.

## Priorisierungs-Framework (einfach)

Bewerten Sie jeden Kandidaten 0-3 pro Zeile, mental summieren, keine falsche Praezision vortaeuschen:

| Faktor | Frage |
|---|---|
| Konsequenz | Aendert Verzoegerung Ausschuss, Sicherheits-Exposure oder Kundenlieferung innerhalb von Tagen |
| Bestaetigung | Gibt es ein zweites Signal, physisches Symptom oder Historien-Match |
| Job-Readiness | Haben wir Teile, Zugangs-Fenster und eine schriftliche Aufgabenliste |
| Signalqualitaet | Ist der Sensor nach juengster Kalibrierung oder Cross-Check vertrauenswuerdig |

Hohe Summen sind kein automatisches P1. Sie sind automatische **diese Woche reviewen**-Punkte.

## Checkliste: CMMS sauber halten

- [ ] IoT darf in Monat eins bis drei kein P1 ohne benannten Human-Approver oeffnen
- [ ] jeder IoT-Arbeitsauftrag traegt Signal-Snapshot-Link oder ID
- [ ] Herabstufungen werden so offen geloggt wie Aufstufungen
- [ ] Standards: Prioritaetssprache an Safety- und Qualitaets-Gates ausrichten
- [ ] gleichzeitige IoT-Unterbrechungen pro Crew deckeln, damit Legacy-Backlog nicht verhungert

## Vergleich: Ticket-Sprawl versus Leiter-Disziplin

| Ticket-Sprawl | Leiter-Disziplin |
|---|---|
| jeder Spike wird Arbeit | Spikes werden Evidenz |
| Techniker misstrauen IoT | Techniker sehen weniger, bessere Calls |
| Planung bricht ein | Planung behaelt die Erzaehlung |

## Wann es scheitert

**Scheitert**, wenn Einkauf und Scheduling ehrlich sind zu Teilen und Fenstern. IoT wird weiter schreien und Leute werden es stumm schalten.

## Was das fuer DBR77 IoT bedeutet

DBR77 IoT liefert **Echtzeit-Maschinensichtbarkeit** und **Edge-first Entscheidungsunterstuetzung**, damit Prioritaetskandidaten mit lokalem Kontext bewertet werden.

Retrofit-freundliche Konnektivitaet holt aeltere Assets in dieselbe Triage-Leiter, ohne vollstaendigen CMMS-Rebuild. Schnelle Piloten tunen die Leiter mit einer Crew vor dem Scale.

## Bottom line

IoT soll **Instandhaltungs-Prioritaet schaerfen**, sie nicht multiplizieren.

Evidenz, Bestaetigung und Job-Readiness schlagen einen Strom roter Badges.
